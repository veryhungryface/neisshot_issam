// ──────────────────────────────────────────────────────────────
// 나이스 화면 안에서 실행하는 함수들 (사이드패널 실제 기능과 개발용 버튼이 함께 쓴다)
//   · chrome.scripting.executeScript({ func }) 로 나이스 탭의 모든 프레임에 주입된다.
//     함수 밖의 변수는 쓸 수 없다 (인자로만 받는다).
//   · 저장·삭제 버튼은 누르지 않는다. 2차인증 번호는 사람이 넣고, 창이 닫힐 때까지 기다린다.
// ──────────────────────────────────────────────────────────────

// 화면 열기·조회에서 기다리는 시간(ms). 학교 망에서 정식 나이스가 느릴 수 있어 넉넉하게 잡는다.
//  otp: 2차인증 번호를 사람이 넣을 때까지 (10분)
//  notice/noticeQuiet: 공지 창 닫기 (창이 없는 상태가 2.5초 이어지면 끝, 최대 20초)
//  leafRetry: 왼쪽 메뉴를 눌렀는데 4초 동안 화면·2차인증이 안 뜨면 다시 누름
const NEIS_PAGE_TIMEOUTS = { step: 10000, roleMenu: 4000, screen: 25000, result: 30000, otp: 600000, notice: 20000, noticeQuiet: 2500, leafRetry: 4000 };

// 모든 프레임 결과 중 쓸 것: 성공한 프레임, 없으면 가장 멀리 간 프레임
function pickNeisFrameResult(results) {
  const rs = results.map((x) => ({ frameId: x.frameId, ...(x.result || { ok: false, stepNo: 0, error: '결과 없음' }) }));
  return rs.find((x) => x.ok) || rs.sort((p, q) => (q.stepNo || 0) - (p.stepNo || 0))[0];
}

// 페이지 안에서 실행되는 함수 (chrome.scripting 으로 모든 프레임에 주입되므로 바깥 변수를 쓰지 않는다)
async function runNeisQuery(conds, screenName, T, capture) {
  let step = '시작';
  let stepNo = 0;
  const t0 = Date.now();
  // 단계별 걸린 시간 (학교 망에서 어느 단계가 느린지 보려고 남긴다)
  const timeline = [];
  // 알림창 내용은 학생 이름 등이 들어 있을 수 있어 오류 문구와 따로 돌려준다 (진단 파일에는 넣지 않음)
  let dialogText = '';
  const dialogError = (d, msg) => {
    dialogText = text(d).slice(0, 80);
    return new Error(`${msg} (창 이름: ${d.getAttribute('aria-label') || '없음'})`);
  };
  const at = (no, name) => { stepNo = no; step = name; timeline.push({ 단계번호: no, 단계: name, ms: Date.now() - t0 }); };
  // 단계별 수집: 사이드패널에 지금 화면 구조를 저장해 달라고 요청하고 끝날 때까지 기다린다
  // (수집은 사이드패널이 모든 프레임에서 하므로 메뉴와 화면이 다른 프레임에 있어도 함께 남는다)
  const snap = async (name) => {
    if (!capture) return;
    try {
      await chrome.runtime.sendMessage({ type: 'ns-dev-snap', name, stepNo, ms: Date.now() - t0 });
    } catch { /* 수집 실패는 진행에 영향을 주지 않는다 */ }
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, what, timeout = T.step, interval = 100) => {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) throw new Error(`시간 초과: ${what}`);
      await wait(interval);
    }
  };
  const visible = (e) => e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  // 메뉴 글자 뒤에 숨은 글자(" 2단계", " 0단계 메뉴항목")가 붙으므로 앞부분으로 비교
  const named = (e, name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text(e));
  // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
  const activePanel = () => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  };
  // 조회조건 칸 이름: 칸 앞에 보이는 이름표(label) 글자. 없으면 aria-label 앞부분.
  //  (초등 학기말종합의견은 학년·반·교과(목) 칸의 aria-label 이 모두 '학기, 값' 으로 잘못 붙어 있다, 2026-11-26 정식 나이스)
  const condName = (b) => {
    const al = (b.getAttribute('aria-label') || '').split(',')[0].replace(/\s+/g, '');
    for (let e = b; e && e.getAttribute?.('role') !== 'tabpanel'; e = e.parentElement) {
      if (e !== b && e.querySelectorAll('[role=combobox]').length > 1) break;
      for (let p = e.previousElementSibling; p; p = p.previousElementSibling) {
        if (/(^|\s)label(\s|$)/.test(String(p.className || ''))) {
          const t = (p.textContent || '').replace(/필수입력/g, '').replace(/\s+/g, '');
          if (t) return t;
        }
      }
    }
    return al;
  };
  // 칸의 지금 값 (aria-label 의 쉼표 뒤. 이름표가 틀려도 값은 맞다)
  const condValue = (b) => (b.getAttribute('aria-label') || '').replace(/^[^,]*,\s*/, '').trim();
  const comboIn = (scope, name) => [...scope.querySelectorAll('[role=combobox]')]
    .find((b) => condName(b) === name.replace(/\s+/g, ''));
  // '처리중' 가림막: 화면 안이 아니라 페이지 전체에 뜰 수도 있어 문서 전체에서 찾는다
  const loadmaskVisible = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
  // 2차인증 창 (창 이름에 '인증'이 들어간 창) / 그 밖의 알림·확인 창 → 사람이 판단하도록 멈춘다
  const isAuthDialog = (d) => /인증/.test(d.getAttribute('aria-label') || '');
  const otpDialog = () => [...document.querySelectorAll('[role=dialog]')].find((d) => visible(d) && isAuthDialog(d));
  const msgDialog = () => [...document.querySelectorAll('[role=dialog]')].find((d) => visible(d) && !isAuthDialog(d));

  const pickCombo = async (scope, name, value) => {
    const box = await waitFor(() => comboIn(scope, name), `${name} 조회조건`);
    if (condValue(box) === value) return;
    box.click();
    const opt = await waitFor(() => {
      const lists = [...document.querySelectorAll('[role=listbox]')].filter(visible);
      const list = lists.find((l) => l.getAttribute('aria-label') === name) || lists[lists.length - 1];
      return list && [...list.querySelectorAll('[role=option]')].find((o) => text(o) === value);
    }, `${name}=${value} 항목`);
    await snap(`목록 펼침 (${name})`);
    opt.click();
    await waitFor(() => condValue(box) === value, `${name} 선택 반영`);
  };

  try {
    at(1, '상단 역할 메뉴');
    // 나이스 화면이 없는 프레임은 여기서 시간 초과로 끝난다 (stepNo 가 가장 큰 프레임의 결과를 쓴다)
    const roles = await waitFor(() => {
      const r = [...document.querySelectorAll('li.cl-navigationbar-item')];
      return r.length ? r : null;
    }, '상단 역할 메뉴');
    at(1, '시작 전 열린 창 확인');
    const blocking = msgDialog();
    if (blocking) throw dialogError(blocking, '열려 있는 창을 먼저 닫아 주세요');

    // 1) 상단 역할 메뉴 → 메가메뉴(늦게 그려짐) → 2) '행동특성및종합의견' 폴더 (왼쪽 화면 메뉴에 갈래가 펼쳐짐)
    //    역할 이름·코드는 사용자마다 다르므로 후보를 차례로 열어 보고 그 폴더가 있는 역할을 쓴다:
    //    '학년-반담임'(조회할 반) → 다른 '○-○담임' → '학급담임'
    at(2, '메가메뉴 폴더');
    const roleLabel = (li) => text(li).split(' ')[0];
    const exact = `${conds.grade}-${conds.cls}담임`;
    const candidates = [
      ...roles.filter((li) => named(li, exact)),
      ...roles.filter((li) => /^\d+-\d+담임$/.test(roleLabel(li)) && !named(li, exact)),
      ...roles.filter((li) => named(li, '학급담임')),
    ];
    const megaFolder = () => [...document.querySelectorAll('.cl-navigationbar-menu a[role=link], .cl-navigationbar-accessiblemegamenu a[role=link]')]
      .find((a) => visible(a) && named(a, screenName));
    let folder = null;
    for (const li of candidates) {
      const link = li.querySelector('a') || li;
      if (link.getAttribute('aria-expanded') !== 'true') link.click();
      folder = await waitFor(megaFolder, '메가메뉴 폴더', T.roleMenu).catch(() => null);
      await snap(`메가메뉴 (${roleLabel(li)})`);
      if (folder) break;
    }
    if (!folder) {
      throw new Error(`'${screenName}' 메뉴가 있는 담임 역할을 찾지 못했습니다 (있는 역할: ${roles.map(roleLabel).join(', ')})`);
    }
    folder.click();

    // 3) 왼쪽 화면 메뉴의 화면 (이미 열려 있으면 그 탭으로 전환됨)
    at(3, '왼쪽 화면 메뉴');
    const leaf = await waitFor(() => [...document.querySelectorAll('.rolemenu a.cl-leaf, a.cl-sidenavigation-item.cl-leaf')]
      .find((a) => visible(a) && named(a, screenName)), '왼쪽 화면 메뉴');
    await snap('왼쪽 메뉴');
    leaf.click();

    // 4) 화면 탭이 선택되거나 2차인증이 뜰 때까지. 2차인증은 사람이 입력할 때까지 대기 (최대 3분)
    at(4, '화면 열기 / 2차인증');
    const selectedTab = () => document.querySelector(`[role=tab][aria-label="선택됨, ${screenName}"]`);
    //    2차인증은 화면 탭이 먼저 선택된 뒤에 뜰 수도 있어, 화면이 준비될 때까지 계속 살핀다.
    //    인증을 기다린 시간은 화면 대기 시간에서 빼지 않는다 (사람이 늦게 넣어도 실패하지 않게).
    const readyPanel = () => {
      const p = activePanel();
      return selectedTab() && p && comboIn(p, '반') && !loadmaskVisible() && !otpDialog() ? p : null;
    };
    let panel = null;
    let otpSnapped = false;
    let end = Date.now() + T.screen;
    while (!(panel = readyPanel())) {
      const otp = otpDialog();
      if (otp) {
        if (!otpSnapped) { otpSnapped = true; await snap('2차인증 창'); }
        await waitFor(() => !otp.isConnected || !visible(otp), '2차인증 입력', T.otp, 300);
        end = Date.now() + T.screen;
        continue;
      }
      if (Date.now() > end) throw new Error(`시간 초과: ${selectedTab() ? `${screenName} 화면` : '화면 또는 2차인증'}`);
      await wait(100);
    }
    await snap('화면 열림');

    // 5) 조회조건: 학년/반 → 조회
    //    정식 나이스는 담임 역할로 들어가면 학년·반이 이미 골라져 있으므로 그 값을 그대로 쓴다.
    //    비어 있을 때('-없음-' 등, 모의 나이스의 기본값)만 conds 값으로 고른다.
    at(5, '조회조건');
    const comboValue = (name) => { const b = comboIn(panel, name); return b ? condValue(b) : ''; };
    const isEmpty = (v) => !v || /없음|선택/.test(v);
    for (const [name, value] of [['학년', conds.grade], ['반', conds.cls]]) {
      await waitFor(() => comboIn(panel, name), `${name} 조회조건`);
      if (isEmpty(comboValue(name))) await pickCombo(panel, name, value);
    }
    const used = { grade: comboValue('학년'), cls: comboValue('반') };

    //    이미 조회된 표가 있으면 조회 직후에 읽으면 이전 명단이 잡힌다.
    //    조회 전 행에 표시를 해 두고, 행이 새로 그려지거나 '처리중' 가림막이 떴다 사라질 때까지 기다린다.
    at(6, '조회 결과');
    const grid = panel.querySelector('[role=grid]');
    // 학생 행: 칸(gridcell)이 있는 행 전부 (입력칸이 없는 학적변동 행도 포함해야 입력과 1:1로 맞는다)
    const dataRows = () => [...(grid || panel).querySelectorAll('[role=row][aria-rowindex]')]
      .filter((r) => r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]'));
    const editorOf = (r) => [...r.querySelectorAll('textarea')].find((t) => !t.disabled && !t.readOnly);
    dataRows().forEach((r) => { r.dataset.nsStale = '1'; });
    let maskSeen = false;
    let emptyTicks = 0;
    const mo = new MutationObserver((ms) => {
      if (ms.some((m) => [...m.addedNodes].some((n) => n.classList?.contains('cl-loadmask')))) maskSeen = true;
    });
    mo.observe(document.body, { childList: true, subtree: true });
    try {
      const qBtn = await waitFor(() => [...panel.querySelectorAll('[role=button], button')]
        .find((b) => visible(b) && text(b) === '조회' && !b.closest('[role=row]')), '조회 버튼');
      // 실제 마우스처럼 누른다 (click 만으로는 반응하지 않을 때가 있음, 2026-11-24 정식 나이스).
      // 반응이 없으면 3초 뒤 키보드, 6초 뒤 click 으로 한 번 더
      const pressQ = (how) => {
        const r = qBtn.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        const t = hit && qBtn.contains(hit) ? hit : (qBtn.querySelector('.cl-text-wrapper, .cl-text') || qBtn);
        if (how === 'key') {
          qBtn.focus?.();
          for (const [key, code] of [['Enter', 13], [' ', 32]]) {
            const o = { key, code: key === ' ' ? 'Space' : key, keyCode: code, which: code, bubbles: true, cancelable: true };
            qBtn.dispatchEvent(new KeyboardEvent('keydown', o)); qBtn.dispatchEvent(new KeyboardEvent('keyup', o));
          }
          return;
        }
        if (how === 'click') { qBtn.click(); return; }
        const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: 1 };
        const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
        t.dispatchEvent(new MouseEvent('mouseover', base));
        t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
        t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
        t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
        t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
        t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
      };
      pressQ('mouse');
      const qAt = Date.now();
      let qPresses = 1;
      await waitFor(() => {
        if (!maskSeen && !loadmaskVisible() && !dataRows().some((r) => !r.dataset.nsStale) && Date.now() - qAt > 3000 * qPresses && qPresses < 3) {
          pressQ(qPresses === 1 ? 'key' : 'click');
          qPresses++;
        }
        const d = msgDialog();
        if (d) throw dialogError(d, '나이스 창이 떴습니다. 직접 처리해 주세요');
        if (loadmaskVisible()) return false;
        const rows = dataRows();
        if (!rows.length && maskSeen && ++emptyTicks > 20) throw new Error('조회된 학생이 없습니다');
        return rows.length && (maskSeen || rows.every((r) => !r.dataset.nsStale));
      }, '조회 결과', T.result);
    } finally {
      mo.disconnect();
    }
    await snap('조회 결과');

    // 6) 첫 번째 입력 가능한 학생 칸 강조 (일괄 입력 실행이 이 칸부터 시작)
    //    사이드패널이 키보드 포커스를 쥐고 있어 커서가 그려지지 않으므로 테두리로 강조한다.
    //    입력이 들어오면(input 이벤트) 강조를 지운다.
    at(7, '첫 입력칸');
    const allRows = dataRows();
    const startIdx = allRows.findIndex(editorOf);
    if (startIdx < 0) throw new Error('입력할 수 있는 칸이 있는 학생 행이 없습니다');
    const rows = allRows.slice(startIdx);
    const firstInput = editorOf(rows[0]);
    firstInput.scrollIntoView({ block: 'center' });
    firstInput.click();
    firstInput.focus();
    firstInput.style.outline = '3px solid #E66914';
    firstInput.style.outlineOffset = '-3px';
    firstInput.addEventListener('input', () => {
      firstInput.style.outline = '';
      firstInput.style.outlineOffset = '';
    }, { once: true });

    // 7) 학생 이름: 칸 이름 "N행 성명 홍길동" / "N행 마지막 행 성명 홍길동"
    //    입력칸이 없는 행도 자리를 지켜야 뒤 학생 문구가 밀리지 않는다 (입력 단계에서 그 행은 건너뜀)
    const names = rows.map((r) => {
      const cell = [...r.querySelectorAll('[role=gridcell]')]
        .find((c) => /^\d+행 (마지막 행 )?성명 /.test(c.getAttribute('aria-label') || ''));
      return cell ? cell.getAttribute('aria-label').replace(/^\d+행 (마지막 행 )?성명 /, '').trim() : '';
    });
    const readonlyRows = rows.filter((r) => !editorOf(r)).length;
    at(8, '완료');
    return { ok: true, stepNo: 8, step: '완료', names, readonlyRows, timeline, ...used };
  } catch (e) {
    return { ok: false, stepNo, step, error: e.message, dialogText, timeline };
  }
}

// 과세특 화면 열기 (페이지 안에서 실행, 모든 프레임에 주입되므로 바깥 변수를 쓰지 않는다)
//   교과담임(상단 역할) → 메가메뉴 '성적' 폴더의 '성적처리' → 왼쪽 메뉴 '과목별세부능력및특기사항'
//   → 2차인증 창이 뜨면 사람이 번호를 넣어 창이 사라질 때까지 기다림 → 화면 준비 완료
//   정식 나이스 수동 수집(2026-11-11)에서 확인한 구조:
//   · 메가메뉴는 역할을 펼쳤을 때만 그려진다: li.cl-navigationbar-item > .cl-navigationbar-accessiblemegamenu
//     안에 a.cl-folder(1단계, 예: 성적) / a.cl-leaf(2단계, 예: 성적처리), 둘 다 role=link
//   · 왼쪽 메뉴: a.cl-sidenavigation-item (cl-folder 는 aria-expanded, cl-leaf 는 화면)
//   · 화면 탭: [role=tab][aria-label="선택됨, 과목별세부능력및특기사항"]
//   · 2차인증: [role=dialog][aria-label="2차인증"] (창 안에도 M-OTP 등 tab/tabpanel 이 있음)
//   kind: 'secondary'(중고등, 기본) | 'elementary'(초등 학급담임)
//     중고등: 교과담임 › 성적 › 성적처리 › 과목별세부능력및특기사항
//     초등:   학급담임 › 성적 › 학생평가 › 학기말종합의견 (교과(목)마다 조회, 2026-11-26 정식 나이스 로그)
//   역할이 없으면 { ok:false, noRole:true, roles:[…] } 를 돌려준다 (자동 입력이 다른 쪽으로 다시 시도)
async function openSeteukScreen(T, kind = 'secondary') {
  const SPEC = kind === 'elementary'
    ? { ROLES: ['학급담임'], MEGA_FOLDER: '성적', MEGA_LEAF: '학생평가', SCREEN: '학기말종합의견', COND: ['교과(목)', '교과', '과목'] }
    : { ROLES: ['교과담임'], MEGA_FOLDER: '성적', MEGA_LEAF: '성적처리', SCREEN: '과목별세부능력및특기사항', COND: ['과목'] };
  const ROLE = SPEC.ROLES[0];
  const MEGA_FOLDER = SPEC.MEGA_FOLDER;
  const MEGA_LEAF = SPEC.MEGA_LEAF;
  const SCREEN = SPEC.SCREEN;
  let noRole = false;
  let roleNames = [];
  let step = '시작';
  let stepNo = 0;
  const t0 = Date.now();
  const timeline = [];
  let dialogText = '';
  const at = (no, name) => { stepNo = no; step = name; timeline.push({ 단계번호: no, 단계: name, ms: Date.now() - t0 }); };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, what, timeout = T.step, interval = 100) => {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) throw new Error(`시간 초과: ${what}`);
      await wait(interval);
    }
  };
  const visible = (e) => e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  const named = (e, name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(text(e));
  // 조회조건 칸 이름: 칸 앞에 보이는 이름표(label) 글자. 없으면 aria-label 앞부분.
  //  (초등 학기말종합의견은 학년·반·교과(목) 칸의 aria-label 이 모두 '학기, 값' 으로 잘못 붙어 있다, 2026-11-26 정식 나이스)
  const condName = (b) => {
    const al = (b.getAttribute('aria-label') || '').split(',')[0].replace(/\s+/g, '');
    for (let e = b; e && e.getAttribute?.('role') !== 'tabpanel'; e = e.parentElement) {
      if (e !== b && e.querySelectorAll('[role=combobox]').length > 1) break;
      for (let p = e.previousElementSibling; p; p = p.previousElementSibling) {
        if (/(^|\s)label(\s|$)/.test(String(p.className || ''))) {
          const t = (p.textContent || '').replace(/필수입력/g, '').replace(/\s+/g, '');
          if (t) return t;
        }
      }
    }
    return al;
  };
  // 칸의 지금 값 (aria-label 의 쉼표 뒤. 이름표가 틀려도 값은 맞다)
  const condValue = (b) => (b.getAttribute('aria-label') || '').replace(/^[^,]*,\s*/, '').trim();
  const isAuthDialog = (d) => /인증/.test(d.getAttribute('aria-label') || '');
  const dialogs = () => [...document.querySelectorAll('[role=dialog]')].filter(visible);
  const otpDialog = () => dialogs().find(isAuthDialog);
  const msgDialog = () => dialogs().find((d) => !isAuthDialog(d));
  const dialogError = (d, msg) => {
    dialogText = text(d).slice(0, 80);
    return new Error(`${msg} (창 이름: ${d.getAttribute('aria-label') || '없음'})`);
  };
  const loadmaskVisible = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
  // 2차인증 창 안에도 tabpanel 이 있으므로 창 밖의 화면만 본다
  const activePanel = () => [...document.querySelectorAll('[role=tabpanel]')]
    .find((p) => visible(p) && !p.closest('[role=dialog]'));
  const sideItem = (name, kind) => [...document.querySelectorAll(`a.cl-sidenavigation-item.cl-${kind}`)]
    .find((a) => visible(a) && named(a, name));
  const selectedTab = () => document.querySelector(`[role=tab][aria-label="선택됨, ${SCREEN}"]`);
  // 메뉴 클릭: 나이스 메뉴는 마우스 올림으로 열리는 곳도 있어 mouseover 도 같이 보낸다
  const press = (el) => {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.click();
  };

  // 2차인증 창이 있으면 사라질 때까지 기다린다 (번호는 사람이 입력)
  const waitOtp = async () => {
    const otp = otpDialog();
    if (!otp) return false;
    await waitFor(() => !otp.isConnected || !visible(otp), '2차인증 입력', T.otp, 300);
    return true;
  };

  try {
    at(1, '상단 역할 메뉴');
    const roles = await waitFor(() => {
      const r = [...document.querySelectorAll('li.cl-navigationbar-item')];
      return r.length ? r : null;
    }, '상단 역할 메뉴');
    // 접속 직후 뜨는 공지 등 창을 닫는다. 늦게 뜨는 창도 있어, 창이 없는 상태가
    // T.noticeQuiet 동안 이어지면 끝낸다 (전체 최대 T.notice). 2차인증 창은 건드리지 않는다.
    at(1, '공지 창 닫기');
    const closeBtnOf = (d) => d.querySelector('.cl-dialog-close[role=button]')
      || [...d.querySelectorAll('[role=button], button')].find((b) => visible(b) && (text(b) === '닫기' || b.getAttribute('aria-label') === '닫기'));
    let closed = 0;
    const noticeEnd = Date.now() + T.notice;
    let quietSince = Date.now();
    while (Date.now() < noticeEnd && Date.now() - quietSince < T.noticeQuiet) {
      const d = msgDialog();
      if (!d) { await wait(200); continue; }
      const close = closeBtnOf(d);
      if (!close) throw dialogError(d, '닫기 버튼이 없는 창이 떠 있습니다. 직접 처리해 주세요');
      for (const type of ['mousedown', 'mouseup']) close.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      close.click();
      closed++;
      await waitFor(() => !d.isConnected || !visible(d), '공지 창 닫힘', 3000)
        .catch(() => { throw dialogError(d, '창이 닫히지 않습니다. 직접 닫아 주세요'); });
      quietSince = Date.now();
    }
    const blocking = msgDialog();
    if (blocking) throw dialogError(blocking, '창이 계속 뜹니다. 직접 닫아 주세요');
    await waitOtp();

    // 왼쪽 메뉴에 이미 과세특이 보이면 (성적처리 메뉴가 열려 있으면) 역할·메가메뉴는 건너뛴다
    let leaf = sideItem(SCREEN, 'leaf');
    if (!leaf) {
      at(2, `역할 '${ROLE}'`);
      const role = roles.find((li) => SPEC.ROLES.some((r) => named(li, r)));
      if (!role) {
        noRole = true;
        roleNames = roles.map((li) => text(li).split(' ')[0]);
        throw new Error(`상단에 '${ROLE}' 역할이 없습니다 (있는 역할: ${roleNames.join(', ')})`);
      }
      const roleLink = role.querySelector('a') || role;

      at(3, `메가메뉴 '${MEGA_FOLDER}' → '${MEGA_LEAF}'`);
      const megaLeaf = () => {
        const mega = role.querySelector('.cl-navigationbar-accessiblemegamenu');
        if (!mega || !visible(mega)) {
          // 접근성 메가메뉴가 없는 화면(모의 나이스, 행특 버튼과 같은 구조): 펼친 메가메뉴의 '성적처리' 링크
          return [...document.querySelectorAll('.cl-navigationbar-menu a[role=link]')].find((a) => visible(a) && named(a, MEGA_LEAF)) || null;
        }
        const folder = [...mega.querySelectorAll('a.cl-folder[role=link]')].find((a) => named(a, MEGA_FOLDER));
        const cat = folder?.closest('.cl-navigationbar-category') || mega;
        return [...cat.querySelectorAll('a.cl-leaf[role=link]')].find((a) => visible(a) && named(a, MEGA_LEAF)) || null;
      };
      // 역할을 눌러 메가메뉴를 연다. 이미 열려 있으면 누르지 않는다(다시 누르면 닫힘).
      // 한 번 눌러도 안 보이면(펼침 표시만 남아 있던 경우 등) 한 번 더 누른다.
      let link = megaLeaf();
      if (!link) {
        press(roleLink);
        link = await waitFor(megaLeaf, `메가메뉴 '${MEGA_LEAF}'`, T.roleMenu).catch(() => null);
      }
      if (!link) {
        press(roleLink);
        link = await waitFor(megaLeaf, `메가메뉴 '${MEGA_LEAF}' (역할 '${ROLE}'을 펼쳐도 안 보임)`, T.roleMenu);
      }
      press(link);

      at(4, `왼쪽 메뉴 '${SCREEN}'`);
      leaf = await waitFor(() => {
        const l = sideItem(SCREEN, 'leaf');
        if (l) return l;
        // 성적처리 갈래가 접혀 있으면 펼친다
        const f = sideItem(MEGA_LEAF, 'folder');
        if (f && f.getAttribute('aria-expanded') === 'false') f.click();
        return null;
      }, `왼쪽 메뉴 '${SCREEN}'`);
    }
    press(leaf);

    // 화면 탭 선택 + 조회조건이 그려지고 가림막·2차인증이 없을 때까지.
    // 2차인증은 화면 탭이 먼저 선택된 뒤에 뜰 수도 있어 화면이 준비될 때까지 계속 살핀다.
    at(5, '화면 열기 / 2차인증');
    const readyPanel = () => {
      const p = activePanel();
      const hasCond = p && [...p.querySelectorAll('[role=combobox]')].some((b) => SPEC.COND.includes(condName(b)));
      return selectedTab() && hasCond && !loadmaskVisible() && !otpDialog() ? p : null;
    };
    let panel = null;
    let otpWaited = false;
    let end = Date.now() + T.screen;
    // 왼쪽 메뉴가 메가메뉴 클릭 직후 다시 그려지면 처음 누른 칸이 먹지 않는다 (실제로 화면이 안 열린 적 있음).
    // 화면 탭도 2차인증도 안 뜬 채 T.leafRetry 가 지나면 칸을 새로 찾아 다시 누른다 (최대 2번 더).
    let lastPress = Date.now();
    let presses = 1;
    while (!(panel = readyPanel())) {
      if (await waitOtp()) { otpWaited = true; end = Date.now() + T.screen; continue; }
      const d = msgDialog();
      if (d) throw dialogError(d, '나이스 창이 떴습니다. 직접 처리해 주세요');
      if (!selectedTab() && presses < 3 && Date.now() - lastPress > T.leafRetry) {
        const again = sideItem(SCREEN, 'leaf');
        if (again) { press(again); presses++; lastPress = Date.now(); }
      }
      if (Date.now() > end) throw new Error(`시간 초과: ${selectedTab() ? `${SCREEN} 화면` : '화면 또는 2차인증'}`);
      await wait(100);
    }

    at(6, '완료');
    const conds = [...panel.querySelectorAll('[role=combobox]')].map((b) => `${condName(b)}, ${condValue(b)}`);
    return { ok: true, kind, stepNo, step, otpWaited, closed, conds, timeline };
  } catch (e) {
    return { ok: false, kind, stepNo, step, error: e.message, dialogText, timeline, noRole, roles: roleNames };
  }
}

// 첫 학생 본문 칸의 입력칸을 연다 (자동 입력이 이 칸부터 시작한다).
//   · 반/번호(번호) 열이 있는 표에서, 본문 열(과세특 '세부능력 및 특기사항', 행특 '행동특성 및 종합의견')을 찾는다.
//   · 4세대 나이스 표는 실제 마우스처럼 눌러야 입력칸이 생기고, 그때 행을 새로 그린다 (2026-11-24 정식 나이스):
//     누를 때마다 행 번호로 칸을 다시 찾아 확인한다. 입력칸이 없는 행(학적변동 등)은 다음 행으로 넘어간다.
async function openFirstEditorInPage(category) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => !!e && e.getClientRects().length > 0;
  const plain = (e) => (e?.textContent || '').replace(/\s+/g, '');
  // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
  const panel = (() => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  })();
  // 나이스 버튼은 click 만으로 반응하지 않을 때가 있어 실제 마우스처럼 누른다 (2026-11-24 정식 나이스 [조회])
  const pressBtn = (b) => {
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const t = hit && b.contains(hit) ? hit : (b.querySelector('.cl-text-wrapper, .cl-text') || b);
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: 1 };
    const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    t.dispatchEvent(new MouseEvent('mouseover', base));
    t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
    t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  };
  const pressKey = (b) => {
    b.focus?.();
    for (const [key, code] of [['Enter', 13], [' ', 32]]) {
      const o = { key, code: key === ' ' ? 'Space' : key, keyCode: code, which: code, bubbles: true, cancelable: true };
      b.dispatchEvent(new KeyboardEvent('keydown', o));
      b.dispatchEvent(new KeyboardEvent('keyup', o));
    }
  };
  if (!panel) return { here: false };
  const heads = (g) => [...g.querySelectorAll('[role=columnheader]')];
  const findGrid = () => [...panel.querySelectorAll('[role=grid]')].filter(visible)
    .find((g) => !/엑셀/.test(g.getAttribute('aria-label') || '') && heads(g).some((h) => ['반/번호', '번호'].includes(plain(h))));
  // 조회 결과가 늦게 그려질 수 있어 학생 행이 나올 때까지 잠시 기다린다 (최대 10초)
  let grid = findGrid();
  const hasRows = (g) => !!g && [...g.querySelectorAll('[role=row][aria-rowindex]')].some((r) => r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]'));
  for (let i = 0; i < 50 && !hasRows(grid); i++) { await wait(200); grid = findGrid(); }
  if (!grid) return { here: true, ok: false, error: '반/번호(번호) 열이 있는 학생 표를 찾지 못했습니다. 조회가 되었는지 확인해 주세요.' };
  if (!hasRows(grid)) return { here: true, ok: false, error: '표에 학생이 없습니다. 조회조건을 확인하고 [조회]가 되었는지 봐 주세요.' };
  const want = { seteuk: ['세부능력및특기사항', '학기말종합의견'], behavior: ['행동특성및종합의견'] }[category] || [];
  const rows = () => [...grid.querySelectorAll('[role=row][aria-rowindex]')].filter((r) => r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]'));
  let textCol = heads(grid).find((h) => want.includes(plain(h)))?.getAttribute('data-cellindex');
  if (textCol == null) {
    // 이름으로 못 찾으면 글상자(textarea 또는 4세대 표의 cl-textarea)가 든 열
    const c = rows()[0] && [...rows()[0].querySelectorAll('[role=gridcell]')].find((x) => x.querySelector('textarea, .cl-textarea'));
    textCol = c?.getAttribute('data-cellindex');
  }
  if (textCol == null) return { here: true, ok: false, error: '입력할 본문 열을 찾지 못했습니다.' };
  const cellOf = (ri) => rows().find((r) => r.getAttribute('aria-rowindex') === ri)?.querySelector(`[role=gridcell][data-cellindex="${textCol}"]`) || null;
  const editable = (e) => !!e && ((e.tagName === 'TEXTAREA' || e.tagName === 'INPUT') ? !e.disabled && !e.readOnly : e.isContentEditable);
  const edIn = (c) => {
    if (!c) return null;
    const own = [...c.querySelectorAll('textarea, input, [contenteditable=true]')].find(editable);
    if (own) return own;
    const a = document.activeElement, b = c.getBoundingClientRect();
    if (!editable(a)) return null;
    const x = a.getBoundingClientRect();
    return x.left < b.right && x.right > b.left && x.top < b.bottom && x.bottom > b.top ? a : null;
  };
  const press = (c, detail) => {
    const b = c.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + Math.min(b.height / 2, 12);
    const hit = document.elementFromPoint(x, y);
    const t = hit && c.contains(hit) ? hit : (c.querySelector('.cl-text') || c);
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail };
    const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
    t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
    if (detail === 2) t.dispatchEvent(new MouseEvent('dblclick', { ...base, buttons: 0 }));
  };
  // 맨 위로
  const bar = [...grid.querySelectorAll('.cl-scrollbar')].find((e) => e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 1);
  if (bar && bar.scrollTop) { bar.scrollTop = 0; await wait(250); }
  const order = rows().map((r) => r.getAttribute('aria-rowindex')).sort((p, q) => p - q).slice(0, 3);
  const tried = [];
  for (const ri of order) {
    let c = cellOf(ri);
    let ed = edIn(c);
    for (const detail of [1, 1, 2]) {
      if (ed || !c) break;
      press(c, detail);
      for (let w = 0; w < 5 && !ed; w++) { await wait(100); c = cellOf(ri) || c; ed = edIn(c); }
    }
    if (ed) {
      ed.focus();
      return { here: true, ok: true, row: Number(ri) };
    }
    tried.push(ri);
  }
  return { here: true, ok: false, error: `첫 학생 입력칸을 열지 못했습니다 (시도한 행 ${tried.join(', ') || '없음'}). 첫 학생 칸을 직접 클릭한 뒤 다시 실행해 주세요.` };
}

// 지금 화면의 [저장]을 누르고 나이스 창을 처리한다 (묶음 자동 입력에서 묶음마다 부른다).
//   · 묻는 창(버튼이 예/아니오, 확인/취소): 내용이 '저장'을 묻는 것이면 [예]/[확인], 아니면 누르지 않고 멈춘다
//   · 알림 창(고를 것 없이 [확인]/[닫기]만 있는 창): [확인]으로 닫고 계속한다. 창 제목·내용은 notes 로 돌려준다
//     (정식 나이스 과세특 묶음 저장 때 알림 창이 떠서 멈췄음, 2026-11-24)
//   · 2차인증 창은 사람이 번호를 넣을 때까지 기다린다
//   · 끝난 뒤 수정 표시(cl-modified)가 남은 행이 있으면 저장이 안 된 것으로 보고 멈춘다
async function saveNeisScreenInPage(T) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => !!e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
  const panel = (() => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  })();
  // 나이스 버튼은 click 만으로 반응하지 않을 때가 있어 실제 마우스처럼 누른다 (2026-11-24 정식 나이스 [조회])
  const pressBtn = (b) => {
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const t = hit && b.contains(hit) ? hit : (b.querySelector('.cl-text-wrapper, .cl-text') || b);
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: 1 };
    const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    t.dispatchEvent(new MouseEvent('mouseover', base));
    t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
    t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  };
  const pressKey = (b) => {
    b.focus?.();
    for (const [key, code] of [['Enter', 13], [' ', 32]]) {
      const o = { key, code: key === ' ' ? 'Space' : key, keyCode: code, which: code, bubbles: true, cancelable: true };
      b.dispatchEvent(new KeyboardEvent('keydown', o));
      b.dispatchEvent(new KeyboardEvent('keyup', o));
    }
  };
  if (!panel) return { here: false };
  const dialogs = () => [...document.querySelectorAll('[role=dialog]')].filter(visible);
  const isAuth = (d) => /인증/.test(d.getAttribute('aria-label') || '');
  const loadmask = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
  const buttonsOf = (d) => [...d.querySelectorAll('[role=button], button')]
    .filter((b) => visible(b) && b.getAttribute('aria-disabled') !== 'true' && !b.disabled && text(b));
  const btnIn = (d, names) => buttonsOf(d).find((b) => names.includes(text(b)));
  const modifiedRows = () => panel.querySelectorAll('[role=row].cl-modified').length;
  // 창 본문 글자 (제목줄·버튼 글자 빼고)
  const bodyText = (d) => {
    const c = d.cloneNode(true);
    c.querySelectorAll('.cl-dialog-header, [class*="dialog-header"], [role=button], button').forEach((x) => x.remove());
    return text(c);
  };
  const save = [...panel.querySelectorAll('[role=button], button')]
    .find((b) => visible(b) && text(b) === '저장' && !b.closest('[role=row]') && !b.closest('[role=dialog]'));
  if (!save) return { here: true, ok: false, error: '화면에서 [저장] 버튼을 찾지 못했습니다.' };
  const before = dialogs().find((d) => !isAuth(d));
  if (before) return { here: true, ok: false, error: '저장 전에 나이스 창이 열려 있습니다. 직접 확인해 주세요.', dialog: text(before).slice(0, 160) };

  const modifiedBefore = modifiedRows();
  pressBtn(save);
  let savePresses = 1;
  const steps = [];
  const notes = []; // 닫은 알림 창 (제목: 내용)
  let done = false;
  let nothing = false;
  let quietSince = Date.now();
  const end = Date.now() + T.result;
  // 브라우저 기본 알림창을 대신 처리한 횟수 (patchNativeDialogsInPage 가 문서에 남김)
  const nativeCount = () => Number(document.documentElement.getAttribute('data-ns-native') || 0);
  let nativeSeen = nativeCount();
  while (Date.now() < end) {
    await wait(200);
    if (nativeCount() > nativeSeen) {
      nativeSeen = nativeCount();
      quietSince = Date.now();
      const m = document.documentElement.getAttribute('data-ns-native-last') || '';
      if (/^확인: .*저장/.test(m)) steps.push('저장 확인 (기본 창)');
      else if (/^취소: /.test(m)) return { here: true, ok: false, error: '저장 중 나이스가 묻는 창(기본 창)을 띄워 [취소]로 답했습니다. 직접 확인해 주세요.', dialog: m.replace(/^취소: /, ''), steps };
      else if (/변경된?\s*(내용|자료|데이터)[이가]?\s*없/.test(m)) { nothing = true; done = true; steps.push('변경 없음'); }
      else if (/저장\s*되었|저장되었|저장\s*완료|처리\s*되었|처리되었|완료/.test(m)) { done = true; steps.push('저장 완료 (기본 창)'); }
      else steps.push('알림 닫음 (기본 창)');
      continue;
    }
    const d = dialogs().pop();
    if (d) {
      quietSince = Date.now();
      if (isAuth(d)) { // 2차인증: 사람이 넣을 때까지
        const tEnd = Date.now() + T.otp;
        while (d.isConnected && visible(d) && Date.now() < tEnd) await wait(300);
        continue;
      }
      const msg = bodyText(d) || text(d);
      const title = d.getAttribute('aria-label') || '';
      const names = buttonsOf(d).map(text);
      const asks = names.some((n) => ['아니오', '아니요', '취소'].includes(n));
      if (asks) {
        // 묻는 창: 저장을 묻는 것만 [예]/[확인]
        if (/저장/.test(msg) || /저장/.test(title)) {
          const yes = btnIn(d, ['예', '확인']);
          if (!yes) return { here: true, ok: false, error: '저장 확인 창에서 [예]/[확인] 버튼을 찾지 못했습니다.', dialog: msg.slice(0, 160), steps, notes };
          pressBtn(yes); steps.push('저장 확인');
          await wait(300);
          continue;
        }
        return { here: true, ok: false, error: `저장 중 나이스가 묻는 창을 띄웠습니다 (버튼: ${names.join('/')}). 직접 확인해 주세요.`, dialog: msg.slice(0, 160), steps, notes };
      }
      // 알림 창: [확인]으로 닫고 계속
      const ok = btnIn(d, ['확인', '예', '닫기']) || buttonsOf(d).find((b) => /확인|닫기/.test(text(b)));
      if (!ok) return { here: true, ok: false, error: `저장 중 뜬 나이스 창에서 [확인] 버튼을 찾지 못했습니다 (버튼: ${names.join('/') || '없음'}).`, dialog: msg.slice(0, 160), steps, notes };
      if (/변경된?\s*(내용|자료|데이터)[이가]?\s*없/.test(msg)) { nothing = true; done = true; steps.push('변경 없음'); }
      else if (/저장\s*되었|저장되었|저장\s*완료|정상\s*처리|처리\s*되었|처리되었|완료/.test(msg)) { done = true; steps.push('저장 완료'); }
      else {
        // 저장 확인·완료 말고 다른 알림만 결과에 남긴다
        steps.push('알림 닫음');
        notes.push(`${title && !msg.startsWith(title) ? `[${title}] ` : ''}${msg}`.slice(0, 160));
      }
      pressBtn(ok);
      await wait(400);
      continue;
    }
    if (loadmask()) { quietSince = Date.now(); continue; }
    const calm = Date.now() - quietSince;
    if (!steps.length) {
      // 반응이 없으면 키보드로 한 번, 그래도 없으면 click 으로 한 번 더 누른다
      if (calm > 2500 && savePresses < 3) {
        if (savePresses === 1) pressKey(save); else save.click();
        savePresses++;
        quietSince = Date.now();
        continue;
      }
      if (calm > 6000) return { here: true, ok: false, error: '[저장]을 눌렀는데 나이스가 반응하지 않았습니다. 직접 눌러 확인해 주세요.', steps, notes };
      continue;
    }
    // 창·가림막 없이 조용해지면 끝: 수정 표시가 남았으면 저장 안 된 것
    if (calm > (done ? 800 : 2500)) {
      const left = modifiedRows();
      if (left && modifiedBefore && !nothing) {
        return { here: true, ok: false, error: `저장 뒤에도 수정 표시된 행이 ${left}개 남았습니다. 나이스 알림을 확인해 주세요.`, steps, notes };
      }
      return { here: true, ok: true, nothing, steps, notes };
    }
  }
  return { here: true, ok: false, error: '저장이 끝나지 않았습니다 (시간 초과).', steps, notes };
}

// [개발용 시험 모드] 표의 행마다 '[예시 반/번호]' 꼬리표가 그 행의 반/번호와 같은지 센다 (숫자만 돌려준다).
async function verifySampleTextsInPage() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => !!e && e.getClientRects().length > 0;
  const plain = (e) => (e?.textContent || '').replace(/\s+/g, '');
  // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
  const panel = (() => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  })();
  // 나이스 버튼은 click 만으로 반응하지 않을 때가 있어 실제 마우스처럼 누른다 (2026-11-24 정식 나이스 [조회])
  const pressBtn = (b) => {
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const t = hit && b.contains(hit) ? hit : (b.querySelector('.cl-text-wrapper, .cl-text') || b);
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: 1 };
    const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    t.dispatchEvent(new MouseEvent('mouseover', base));
    t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
    t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  };
  const pressKey = (b) => {
    b.focus?.();
    for (const [key, code] of [['Enter', 13], [' ', 32]]) {
      const o = { key, code: key === ' ' ? 'Space' : key, keyCode: code, which: code, bubbles: true, cancelable: true };
      b.dispatchEvent(new KeyboardEvent('keydown', o));
      b.dispatchEvent(new KeyboardEvent('keyup', o));
    }
  };
  if (!panel) return { here: false };
  const grid = [...panel.querySelectorAll('[role=grid]')].filter(visible).find((g) => !/엑셀/.test(g.getAttribute('aria-label') || '')
    && [...g.querySelectorAll('[role=columnheader]')].some((h) => ['반/번호', '번호'].includes(plain(h))));
  if (!grid) return { here: true, ok: false };
  const keyCol = [...grid.querySelectorAll('[role=columnheader]')].find((h) => ['반/번호', '번호'].includes(plain(h))).getAttribute('data-cellindex');
  const rows = () => [...grid.querySelectorAll('[role=row][aria-rowindex]')].filter((r) => r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]'));
  const nums = (v) => (String(v).match(/\d+/g) || []).map(Number);
  const keyOf = (v) => { const n = nums(v); return n.length ? (n.length > 1 ? `${n[n.length - 2]}/${n[n.length - 1]}` : `${n[0]}`) : ''; };
  const seen = new Map();
  const take = () => rows().forEach((r) => {
    const texts = [...r.querySelectorAll('textarea')].map((t) => t.value).concat([...r.querySelectorAll('[role=gridcell]')].map((c) => c.textContent || ''));
    const m = texts.map((t) => /\[예시 ([^\]]+)\]/.exec(t)).find(Boolean);
    seen.set(r.getAttribute('aria-rowindex'), { key: keyOf(r.querySelector(`[role=gridcell][data-cellindex="${keyCol}"]`)?.textContent || ''), tag: m ? keyOf(m[1]) : null });
  });
  const bar = [...grid.querySelectorAll('.cl-scrollbar')].find((e) => e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 1);
  const step = bar ? Math.max(20, Math.ceil(bar.scrollHeight / (Number(grid.getAttribute('aria-rowcount') || 2)))) : 0;
  if (bar) { bar.scrollTop = 0; await wait(200); }
  take();
  for (let i = 0; bar && i < 200 && bar.scrollTop + bar.clientHeight < bar.scrollHeight - 1; i++) { bar.scrollTop += step; await wait(80); take(); }
  if (bar) { bar.scrollTop = 0; await wait(150); }
  const v = [...seen.values()];
  return { here: true, ok: true, rows: v.length, right: v.filter((x) => x.tag && x.tag === x.key).length, wrong: v.filter((x) => x.tag && x.tag !== x.key).length };
}

// [개발용 시험 모드] 넣은 것을 저장하지 않고 버린다: [조회]를 다시 누르고, 저장 여부를 묻는 창에는 [아니오]만 누른다.
async function discardEditsInPage(T) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => !!e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
  const panel = (() => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  })();
  // 나이스 버튼은 click 만으로 반응하지 않을 때가 있어 실제 마우스처럼 누른다 (2026-11-24 정식 나이스 [조회])
  const pressBtn = (b) => {
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const t = hit && b.contains(hit) ? hit : (b.querySelector('.cl-text-wrapper, .cl-text') || b);
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: 1 };
    const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    t.dispatchEvent(new MouseEvent('mouseover', base));
    t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
    t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  };
  const pressKey = (b) => {
    b.focus?.();
    for (const [key, code] of [['Enter', 13], [' ', 32]]) {
      const o = { key, code: key === ' ' ? 'Space' : key, keyCode: code, which: code, bubbles: true, cancelable: true };
      b.dispatchEvent(new KeyboardEvent('keydown', o));
      b.dispatchEvent(new KeyboardEvent('keyup', o));
    }
  };
  if (!panel) return { here: false };
  const q = [...panel.querySelectorAll('[role=button], button')].find((b) => visible(b) && text(b) === '조회' && !b.closest('[role=row]'));
  if (!q) return { here: true, ok: false, error: '[조회] 버튼을 찾지 못했습니다.' };
  pressBtn(q);
  const hasSample = () => [...panel.querySelectorAll('[role=row] textarea')].some((t) => /\[예시 /.test(t.value))
    || [...panel.querySelectorAll('[role=row] [role=gridcell]')].some((c) => /\[예시 /.test(c.textContent || ''));
  const end = Date.now() + T.result;
  let quiet = 0;
  while (Date.now() < end) {
    await wait(200);
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => visible(x) && !/인증/.test(x.getAttribute('aria-label') || ''));
    if (d) {
      const no = [...d.querySelectorAll('[role=button], button')].find((b) => visible(b) && ['아니오', '아니요'].includes(text(b)));
      if (/저장|변경/.test(text(d)) && no) { pressBtn(no); quiet = 0; continue; }
      return { here: true, ok: false, error: '다시 조회 중 처리 방법을 모르는 나이스 창이 떴습니다. 직접 확인해 주세요.', dialog: text(d).slice(0, 120) };
    }
    if ([...document.querySelectorAll('.cl-loadmask')].some(visible)) { quiet = 0; continue; }
    if (++quiet >= 4) return hasSample() ? { here: true, ok: false, error: '다시 조회했는데 예시 문구가 남아 있습니다.' } : { here: true, ok: true };
  }
  return { here: true, ok: false, error: '다시 조회가 끝나지 않았습니다 (시간 초과).' };
}

// 저장하는 동안만 브라우저 기본 알림창(window.alert/confirm)을 대신 처리한다 (페이지 본래 세계 MAIN 에서 실행).
//   나이스가 기본 알림창을 쓰면 확장 프로그램이 누를 수 없어 진행이 멈추므로:
//   alert → 내용을 적어 두고 닫은 것으로, confirm → '저장'을 묻는 것만 [확인], 그 밖은 [취소]로 답하고 적어 둔다.
//   저장이 끝나면 restoreNativeDialogsInPage 로 원래대로 돌리고 적어 둔 내용을 돌려받는다.
function patchNativeDialogsInPage() {
  if (window.__nsDialogPatch) return true;
  const log = [];
  const orig = { alert: window.alert, confirm: window.confirm };
  window.__nsDialogPatch = { log, orig };
  // 확장 프로그램 쪽(분리된 세계)에서도 알 수 있게 문서에 표시를 남긴다 (저장 함수가 읽음)
  const mark = (m) => {
    log.push(m.slice(0, 160));
    document.documentElement.setAttribute('data-ns-native', String(log.length));
    document.documentElement.setAttribute('data-ns-native-last', m.slice(0, 160));
  };
  window.alert = (m) => { mark(`알림: ${String(m ?? '')}`); };
  window.confirm = (m) => {
    const yes = /저장/.test(String(m ?? ''));
    mark(`${yes ? '확인' : '취소'}: ${String(m ?? '')}`);
    return yes;
  };
  return true;
}
function restoreNativeDialogsInPage() {
  const p = window.__nsDialogPatch;
  if (!p) return [];
  window.alert = p.orig.alert;
  window.confirm = p.orig.confirm;
  delete window.__nsDialogPatch;
  document.documentElement.removeAttribute('data-ns-native');
  document.documentElement.removeAttribute('data-ns-native-last');
  return p.log;
}

// 화면이 잠잠해질 때까지 기다린다: 처리중 가림막이 없고, 선택된 화면 안이 quietMs 동안 바뀌지 않으면 끝.
//   이미 열려 있던 화면 탭을 메뉴로 다시 열면 나이스가 조금 뒤에 화면을 초기화한다 (이전 조회 결과가 잠깐 보였다가 비워짐).
//   그 사이에 [조회]를 누르면 결과가 초기화에 지워지므로, 화면을 연 뒤 이 함수로 기다렸다가 조회한다 (2026-11-24 정식 나이스).
async function waitScreenSettledInPage(quietMs, maxMs) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => !!e && e.getClientRects().length > 0;
  const panelNow = () => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  };
  if (!panelNow()) return { here: false };
  const loadmask = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
  let last = Date.now();
  let changes = 0;
  let maskSeen = false;
  const mo = new MutationObserver((ms) => {
    const p = panelNow();
    if (ms.some((m) => p && p.contains(m.target))) { last = Date.now(); changes++; }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < maxMs) {
      await wait(150);
      if (loadmask()) { maskSeen = true; last = Date.now(); continue; }
      if (Date.now() - last >= quietMs) break;
    }
  } finally {
    mo.disconnect();
  }
  const p = panelNow();
  const grid = p && [...p.querySelectorAll('[role=grid]')].find((g) => visible(g) && !/엑셀/.test(g.getAttribute('aria-label') || ''));
  return { here: true, ok: true, waitedMs: Date.now() - t0, changes, maskSeen, gridRowcount: grid?.getAttribute('aria-rowcount') || null };
}
