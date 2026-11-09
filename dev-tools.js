// ──────────────────────────────────────────────────────────────
// [개발용] 나이스 행특 빠른 조회 버튼 (모의 나이스 · 정식 나이스 공용)
//   · 압축해제로 불러온 개발 설치에서만 보인다 (웹스토어 설치에는 update_url 이 있음)
//   · 나이스 탭(정식 *.neis.go.kr 또는 모의 127.0.0.1:8770)이면 새로고침 없이 메뉴로 이동,
//     그 밖의 탭이면 모의 나이스로 이동한 뒤 진행
//   · ○-○담임 → 행동특성및종합의견(메가메뉴 폴더) → 왼쪽 화면 메뉴 → 학년/반(비어 있을 때만) → 조회 → 첫 입력칸 강조
//   · 미리보기에 학생 수만큼 임시 데이터를 넣고 일괄 입력까지 실행 (표 구조로 행을 찾는 grid 모드)
//     정식 나이스에서도 입력하지만 저장은 하지 않는다 (임시 문구이므로 저장 버튼은 누르지 말 것)
//   · 메뉴·조건·표는 실제 화면에 있는 이름(글자, role, aria-label)으로만 찾는다
//     (메뉴 코드는 사용자마다 달라 쓰지 않는다)
//   · 2차인증 번호는 사람이 직접 넣고, 스크립트는 창이 닫힐 때까지 기다린다
//   · 중간에 멈추거나 입력이 모자라면 화면 구조를 진단 파일(JSON)로 내려받는다
//     (학생 이름·입력값·상단 사용자 정보 등은 ▒▒▒ 로 가림, 밖으로 자동 전송하지 않음)
//   · '단계별 화면 구조 수집' 버튼은 같은 동작을 하면서 단계마다(메가메뉴, 왼쪽 메뉴, 2차인증,
//     화면 열림, 목록, 조회 결과, 입력 후/멈춘 곳) 화면 구조를 모아 파일 하나로 저장한다.
//     VPN 을 켜면 인터넷이 끊기는 학교 PC에서 VPN 을 켠 채 한 번 돌리고, 끈 뒤 그 파일만 전달하는 용도.
// ──────────────────────────────────────────────────────────────
(() => {
  const IS_DEV_INSTALL = !('update_url' in chrome.runtime.getManifest());
  const MOCK_NEIS_URL = 'http://127.0.0.1:8770/neis/';
  // 학년·반이 비어 있을 때만 쓰는 값 (정식 나이스는 담임 학급이 이미 골라져 있음)
  const QUERY = { grade: '3', cls: '1' };
  const SCREEN_NAME = '행동특성및종합의견';
  // 기다리는 시간(ms). 학교 망에서 정식 나이스가 느릴 수 있어 넉넉하게 잡는다.
  const TIMEOUTS = { step: 10000, roleMenu: 4000, screen: 25000, result: 30000, otp: 180000 };

  const devTools = document.getElementById('devTools');
  const btn = document.getElementById('btnDevQuickQuery');
  const diagBtn = document.getElementById('btnDevSaveDiag');
  const capBtn = document.getElementById('btnDevStepCapture');
  const status = document.getElementById('devQuickQueryStatus');
  if (!IS_DEV_INSTALL || !devTools || !btn) return;
  devTools.hidden = false;

  const setStatus = (text) => { if (status) status.textContent = text; };
  const isRealNeis = (url) => { try { return /(^|\.)neis\.go\.kr$/.test(new URL(url).hostname); } catch { return false; } };
  const isMockNeis = (url) => !!url?.startsWith(MOCK_NEIS_URL);
  const urlPath = (url) => { try { const u = new URL(url); return u.origin + u.pathname; } catch { return ''; } };

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
    const activePanel = () => [...document.querySelectorAll('[role=tabpanel]')].find(visible);
    const comboIn = (scope, name) => [...scope.querySelectorAll('[role=combobox]')]
      .find((b) => (b.getAttribute('aria-label') || '').startsWith(`${name}, `));
    // '처리중' 가림막: 화면 안이 아니라 페이지 전체에 뜰 수도 있어 문서 전체에서 찾는다
    const loadmaskVisible = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
    // 2차인증 창 (창 이름에 '인증'이 들어간 창) / 그 밖의 알림·확인 창 → 사람이 판단하도록 멈춘다
    const isAuthDialog = (d) => /인증/.test(d.getAttribute('aria-label') || '');
    const otpDialog = () => [...document.querySelectorAll('[role=dialog]')].find((d) => visible(d) && isAuthDialog(d));
    const msgDialog = () => [...document.querySelectorAll('[role=dialog]')].find((d) => visible(d) && !isAuthDialog(d));

    const pickCombo = async (scope, name, value) => {
      const box = await waitFor(() => comboIn(scope, name), `${name} 조회조건`);
      if (box.getAttribute('aria-label') === `${name}, ${value}`) return;
      box.click();
      const opt = await waitFor(() => {
        const lists = [...document.querySelectorAll('[role=listbox]')].filter(visible);
        const list = lists.find((l) => l.getAttribute('aria-label') === name) || lists[lists.length - 1];
        return list && [...list.querySelectorAll('[role=option]')].find((o) => text(o) === value);
      }, `${name}=${value} 항목`);
      await snap(`목록 펼침 (${name})`);
      opt.click();
      await waitFor(() => box.getAttribute('aria-label') === `${name}, ${value}`, `${name} 선택 반영`);
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
      const megaFolder = () => [...document.querySelectorAll('.cl-navigationbar-menu a[role=link]')]
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
      const comboValue = (name) => (comboIn(panel, name)?.getAttribute('aria-label') || '').slice(name.length + 2).trim();
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
        (await waitFor(() => [...panel.querySelectorAll('[role=button], button')]
          .find((b) => visible(b) && text(b) === '조회'), '조회 버튼')).click();
        await waitFor(() => {
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

  // 진단 정보 수집 (페이지의 모든 프레임에서 실행). 구조는 남기고 개인정보가 될 수 있는 글자는 가린다.
  //  · 글자를 남기는 곳: 역할·메가·왼쪽 메뉴, MDI 탭, 조회조건, 표 머리글, 펼친 목록, 화면 안 버튼, 화면 제목
  //  · 그 밖의 글자(상단 학교·사용자 정보, 알림 내용 등)와 학생 행의 글자·칸 이름 값, 입력값은 모두 ▒▒▒
  function collectNeisDiag() {
    const MASK = '▒▒▒';
    const LIMIT = 300000;
    const SAFE = [
      '.cl-navigationbar-item', '.cl-navigationbar-menu', '.cl-sidenavigation-item', '.rolemenu a',
      '[role=tablist]', '.search-box', '[role=columnheader]', '[role=listbox]',
      '[role=tabpanel] [role=button]', '[role=tabpanel] button', '[role=tabpanel] h1',
      '[role=dialog] [role=button]', '[role=dialog] button',
    ].join(',');
    const KEEP_ATTR = /^(id|class|role|tabindex|type|name|for|disabled|readonly|hidden|colspan|rowspan)$|^aria-|^data-/;
    const TEXT_ATTR = new Set(['aria-label', 'aria-valuetext', 'aria-description', 'aria-placeholder', 'title', 'alt', 'placeholder', 'value']);
    const visible = (e) => !!e && e.getClientRects().length > 0;
    const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
    const dataRowOf = (el) => {
      const r = el?.closest?.('[role=row]');
      return r && r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]') ? r : null;
    };
    const safe = (el) => !!el && !dataRowOf(el) && !!el.closest(SAFE);
    // "3행 성명 홍길동" → "3행 성명 ▒▒▒" (칸 이름 형식은 남기고 값만 가림)
    const maskLabel = (v) => {
      const m = /^(\d+행 (?:마지막 행 )?\S+)( .*)?$/.exec(v);
      if (m) return m[1] + (m[2] ? ` ${MASK}` : '');
      return v.trim() ? MASK : v;
    };
    const attrText = (el, v) => (safe(el) ? v : maskLabel(v));
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const srcPath = (u) => { try { const x = new URL(u, location.href); return x.origin + x.pathname; } catch { return ''; } };

    let size = 0;
    const ser = (node, depth = 0) => {
      if (size > LIMIT) return '';
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.nodeValue;
        if (!t.trim()) return t ? ' ' : '';
        const out = esc(safe(node.parentElement) ? t.trim() : MASK);
        size += out.length;
        return out;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'link', 'meta', 'template'].includes(tag)) return '';
      if (tag === 'svg') return '<svg></svg>';
      const attrs = [];
      for (const a of el.attributes) {
        if (TEXT_ATTR.has(a.name)) attrs.push(`${a.name}="${esc(attrText(el, a.value).slice(0, 200))}"`);
        else if (KEEP_ATTR.test(a.name)) attrs.push(`${a.name}="${esc(a.value.slice(0, 200))}"`);
      }
      if (tag === 'iframe') attrs.push(`src="${esc(srcPath(el.getAttribute('src') || ''))}"`);
      if (tag === 'textarea' || tag === 'input') attrs.push(`data-diag-len="${(el.value || '').length}"`);
      if (!visible(el)) attrs.push('data-diag-hidden="1"');
      let inner = '';
      if (tag !== 'textarea' && tag !== 'input' && tag !== 'iframe') {
        if (depth > 60) inner = '<!-- 깊이 제한 -->';
        else {
          // 학생 행이 많으면 앞 3행과 마지막 행만 남긴다
          const kids = [...el.childNodes];
          const rowKids = kids.filter((k) => k.nodeType === Node.ELEMENT_NODE && k.getAttribute('role') === 'row' && dataRowOf(k) === k);
          const keep = new Set(rowKids.length > 4 ? [...rowKids.slice(0, 3), rowKids[rowKids.length - 1]] : rowKids);
          let skipped = 0;
          for (const k of kids) {
            if (rowKids.includes(k) && !keep.has(k)) { skipped++; continue; }
            if (skipped) { inner += `<!-- 학생 행 ${skipped}개 생략 -->`; skipped = 0; }
            inner += ser(k, depth + 1);
          }
        }
      }
      const out = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner}</${tag}>`;
      size += out.length - inner.length;
      return size > LIMIT ? `${out}<!-- 크기 제한으로 이후 생략 -->` : out;
    };

    const topLevel = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.parentElement?.closest(sel));
    const activePanel = [...document.querySelectorAll('[role=tabpanel]')].find(visible) || null;
    const notInRow = (e) => !dataRowOf(e);
    const roleItems = [...document.querySelectorAll('li.cl-navigationbar-item')];

    // 선택자별로 몇 개가 잡히는지 (각 단계에서 찾는 선택자)
    const COUNT_SELECTORS = [
      'li.cl-navigationbar-item', '.cl-navigationbar-menu', '.cl-navigationbar-menu a[role=link]',
      '.rolemenu a.cl-leaf', 'a.cl-sidenavigation-item.cl-leaf', '[role=tab]', '[role=tabpanel]',
      '[role=combobox]', '[role=listbox]', '[role=grid]', '[role=row][aria-rowindex]', '[role=gridcell]',
      '[role=columnheader]', 'textarea', '[role=dialog]', '.cl-loadmask', '.search-box', '.search-btn', 'iframe',
    ];
    const counts = Object.fromEntries(COUNT_SELECTORS.map((s) => [s, document.querySelectorAll(s).length]));
    // cl-* 클래스 사용 빈도 (실제 화면의 구성 요소 파악용)
    const classFreq = {};
    document.querySelectorAll('[class*="cl-"]').forEach((e) => e.classList.forEach((c) => {
      if (c.startsWith('cl-')) classFreq[c] = (classFreq[c] || 0) + 1;
    }));

    const grids = activePanel ? [...activePanel.querySelectorAll('[role=grid]')].map((g) => {
      const rows = [...g.querySelectorAll('[role=row][aria-rowindex]')].filter((r) => dataRowOf(r) === r);
      const idx = rows.map((r) => Number(r.getAttribute('aria-rowindex')));
      const scroller = [...g.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
      return {
        이름: g.getAttribute('aria-label') || '',
        aria_rowcount: g.getAttribute('aria-rowcount'),
        머리글: [...g.querySelectorAll('[role=columnheader]')].map((h) => h.getAttribute('aria-label') || text(h)),
        학생행수: rows.length,
        행번호범위: idx.length ? [Math.min(...idx), Math.max(...idx)] : null,
        글상자수: g.querySelectorAll('textarea').length,
        입력가능글상자수: [...g.querySelectorAll('textarea')].filter((t) => !t.disabled && !t.readOnly).length,
        첫학생행_칸이름: rows[0] ? [...rows[0].querySelectorAll('[role=gridcell]')].map((c) => maskLabel(c.getAttribute('aria-label') || '')) : [],
        스크롤: scroller ? { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, class: scroller.className } : null,
      };
    }) : [];

    const ae = document.activeElement;
    const summary = {
      프레임: {
        주소: srcPath(location.href),
        최상위: window === window.top,
        제목: document.title,
        iframe: [...document.querySelectorAll('iframe')].map((f) => ({
          src: srcPath(f.getAttribute('src') || ''), name: f.name, title: f.title, 보임: visible(f),
          크기: [f.clientWidth, f.clientHeight],
        })),
      },
      선택자개수: counts,
      역할메뉴: roleItems.map((li) => ({ 이름: text(li).split(' ')[0], 펼침: li.querySelector('a')?.getAttribute('aria-expanded') ?? null })),
      메가메뉴_보이는항목: [...document.querySelectorAll('.cl-navigationbar-menu a[role=link]')].filter(visible).map(text).slice(0, 80),
      왼쪽메뉴_보이는화면: [...document.querySelectorAll('.rolemenu a.cl-leaf, a.cl-sidenavigation-item')].filter(visible).map(text).slice(0, 80),
      탭: [...document.querySelectorAll('[role=tab]')].map((t) => t.getAttribute('aria-label') || text(t)).slice(0, 60),
      현재화면: activePanel ? {
        제목: text(activePanel.querySelector('h1')),
        조회조건: [...activePanel.querySelectorAll('[role=combobox]')].filter(notInRow).map((b) => b.getAttribute('aria-label')),
        버튼: [...activePanel.querySelectorAll('[role=button], button')].filter((b) => notInRow(b) && visible(b)).map((b) => text(b) || `[${b.getAttribute('aria-label') || ''}]`).slice(0, 80),
        표: grids,
      } : null,
      떠있는창: [...document.querySelectorAll('[role=dialog]')].filter(visible).map((d) => ({ 이름: d.getAttribute('aria-label'), class: d.className })),
      펼친목록: [...document.querySelectorAll('[role=listbox]')].filter(visible).map((l) => ({
        이름: l.getAttribute('aria-label'), 항목수: l.querySelectorAll('[role=option]').length,
        앞항목: [...l.querySelectorAll('[role=option]')].slice(0, 15).map(text),
      })),
      가림막보임: [...document.querySelectorAll('.cl-loadmask')].some(visible),
      포커스: ae && ae !== document.body ? {
        tag: ae.tagName.toLowerCase(), class: ae.className, role: ae.getAttribute('role'),
        이름: maskLabel(ae.getAttribute('aria-label') || ''), 학생행안: !!dataRowOf(ae),
      } : null,
      cl클래스빈도: Object.fromEntries(Object.entries(classFreq).sort((a, b) => b[1] - a[1]).slice(0, 60)),
    };

    // 화면 구조 (가린 HTML). 역할 메뉴·현재 화면을 못 찾으면 body 전체를 크기 제한 안에서 남긴다.
    const regions = {};
    if (roleItems[0]?.parentElement) regions.역할메뉴 = ser(roleItems[0].parentElement);
    topLevel('.cl-navigationbar-menu').forEach((e, i) => { regions[`메가메뉴${i + 1}`] = ser(e); });
    topLevel('.rolemenu, .cl-sidenavigation').filter(visible).forEach((e, i) => { regions[`왼쪽메뉴${i + 1}`] = ser(e); });
    [...document.querySelectorAll('[role=tablist]')].filter((t) => visible(t) && !t.closest('[role=tabpanel]'))
      .forEach((e, i) => { regions[`탭줄${i + 1}`] = ser(e); });
    if (activePanel) regions.현재화면 = ser(activePanel);
    [...document.querySelectorAll('[role=dialog]')].filter(visible).forEach((e, i) => { regions[`창${i + 1}`] = ser(e); });
    [...document.querySelectorAll('[role=listbox]')].filter(visible).forEach((e, i) => { regions[`목록${i + 1}`] = ser(e); });
    if (!regions.역할메뉴 && !regions.현재화면 && document.body) regions.body = ser(document.body);

    return { summary, regions, 잘림: size > LIMIT };
  }

  // 모든 프레임에서 진단 정보를 모은다
  async function collectFrames(tabId) {
    try {
      const res = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: collectNeisDiag });
      return res.map((f) => ({ frameId: f.frameId, ...(f.result || { 오류: '결과 없음' }) }));
    } catch (e) {
      return [{ 오류: `수집 실패: ${e.message}` }];
    }
  }

  // 가리기 규칙에서 빠진 학생 이름·임시 문구가 있으면 한 번 더 가린다 (명단을 읽은 뒤에만 가능)
  function scrubNames(json, names) {
    const list = [...new Set((names || []).filter((n) => n && n.length >= 2))].sort((a, b) => b.length - a.length);
    let hits = 0;
    for (const word of [...list, '[임시 ']) {
      const parts = json.split(word);
      hits += parts.length - 1;
      json = parts.join('▒▒▒');
    }
    return { json, hits };
  }

  const fileStamp = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  // JSON 을 다운로드 폴더에 내려받는다 (새 권한 없이 사이드패널에서 직접 저장).
  // 파일 이름은 Windows 에서도 쓸 수 있는 글자(한글·숫자·-)만 쓴다.
  // 저장하기 전에 명단과 대조해 남은 이름을 가리고, 가린 곳 수를 파일 안에 적는다.
  function downloadJson(prefix, doc, names) {
    const now = new Date();
    const checked = names?.length
      ? { 대조한학생수: names.length }
      : { 안내: '학생 명단을 읽기 전에 멈춰 이름 대조를 하지 못했습니다. 보내기 전에 파일을 열어 학생 이름이 없는지 확인해 주세요.' };
    const draft = JSON.stringify({ ...doc, 가리기점검: { ...checked, 추가로가린곳: '__HITS__' } }, null, 2);
    const { json, hits } = scrubNames(draft, names);
    const name = `${prefix}-${fileStamp(now)}.json`;
    const url = URL.createObjectURL(new Blob([json.replace('"__HITS__"', String(hits))], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { name, hits };
  }

  const baseDoc = (tab) => ({
    안내: '학생 이름·입력값·상단 사용자 정보·알림 내용은 ▒▒▒ 로 가렸습니다. 전달하기 전에 파일을 열어 확인해 주세요.',
    확장버전: chrome.runtime.getManifest().version,
    시각: new Date().toISOString(),
    탭주소: urlPath(tab.url),
    정식나이스: isRealNeis(tab.url),
    화면크기: [tab.width, tab.height],
    환경: { 브라우저: navigator.userAgent, 언어: navigator.language, 화면배율: window.devicePixelRatio },
  });

  async function saveDiagnostics(tab, info, names) {
    const doc = { 종류: '나이스입력도우미 개발용 진단', ...baseDoc(tab), 실패정보: info, 프레임: await collectFrames(tab.id) };
    return downloadJson('neis-진단', doc, names);
  }

  // 탭 로딩이 끝날 때까지 대기
  function waitForTabComplete(tabId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('페이지 로딩 시간 초과')); }, timeout);
      const onUpdated = (id, info) => {
        if (id === tabId && info.status === 'complete') { cleanup(); resolve(); }
      };
      const cleanup = () => { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(onUpdated); };
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  }

  // 프레임별 결과 중 쓸 것: 성공한 프레임 → 없으면 가장 멀리 진행한 프레임
  const pickFrameResult = (results) => {
    const rs = results.map((x) => ({ frameId: x.frameId, ...(x.result || { ok: false, stepNo: 0, error: '결과 없음' }) }));
    return rs.find((x) => x.ok) || rs.sort((a, b) => (b.stepNo || 0) - (a.stepNo || 0))[0];
  };

  // 단계별 수집 중인 실행 (없으면 null). 페이지의 snap() 요청을 받아 그 순간의 화면 구조를 쌓는다.
  let capture = null;
  const addSnap = async (name, extra = {}) => {
    const c = capture;
    if (!c) return;
    const order = c.steps.length + 1;
    c.steps.push({ 순서: order, 이름: name, 경과ms: Date.now() - c.t0, ...extra, 프레임: await collectFrames(c.tabId) });
    if (status) status.textContent = `${status.textContent.split('\n[화면 수집')[0]}\n[화면 수집 ${order}개] ${name}`;
  };
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'ns-dev-snap' || !capture || sender.tab?.id !== capture.tabId) return false;
    addSnap(msg.name, { 단계번호: msg.stepNo, 페이지경과ms: msg.ms }).then(() => sendResponse(true), () => sendResponse(false));
    return true;
  });

  const buttons = [btn, capBtn, diagBtn].filter(Boolean);
  const setBusy = (busy) => buttons.forEach((b) => { b.disabled = busy; });

  // 행특 조회 → 임시 데이터 입력.
  // withCapture 이면 단계마다 화면 구조를 모아 끝에 파일 하나로 저장한다 (성공·실패 모두).
  // VPN 을 켜면 인터넷이 끊기는 학교 PC용: VPN 을 켠 채 한 번 돌리고, 끈 뒤 파일만 전달하면 된다.
  async function runFlow(withCapture) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    setBusy(true);
    let failInfo = null;
    let result = null;
    let names = null;
    try {
      // 나이스 탭이면 새로고침하지 않는다 (정식 나이스는 새로고침하면 열린 화면·입력이 사라지고 초기화면으로 감).
      // 화면이 어떤 상태든 메뉴를 처음부터 눌러 들어가므로 새로고침 없이도 같은 결과가 된다.
      // 나이스가 아닌 탭에서만 모의 나이스로 이동한다.
      const real = isRealNeis(tab.url);
      if (!real && !isMockNeis(tab.url)) {
        setStatus('모의 나이스로 이동하는 중...');
        const loaded = waitForTabComplete(tab.id);
        await chrome.tabs.update(tab.id, { url: MOCK_NEIS_URL });
        await loaded;
      }

      setStatus('진행 중... 2차인증 창이 뜨면 번호를 입력하세요.');
      if (withCapture) {
        capture = { tabId: tab.id, t0: Date.now(), steps: [] };
        await addSnap('시작');
      }
      // 나이스 화면이 iframe 안에 있을 수도 있어 모든 프레임에서 실행한다
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: runNeisQuery,
        args: [QUERY, SCREEN_NAME, TIMEOUTS, withCapture],
      });
      const r = pickFrameResult(results);
      result = { 단계: r?.step, 단계번호: r?.stepNo, 성공: !!r?.ok, 단계시간: r?.timeline || [] };
      if (!r?.ok) {
        setStatus(`실패 (${r?.step || '?'}): ${r?.error || '알 수 없는 오류'}${r?.dialogText ? `\n창 내용: ${r.dialogText}` : ''}`);
        failInfo = {
          단계: r?.step, 단계번호: r?.stepNo, 오류: r?.error,
          프레임별: results.map((x) => ({ frameId: x.frameId, 단계: x.result?.step, 오류: x.result?.error, 성공: !!x.result?.ok })),
        };
        return;
      }
      names = r.names;

      // 미리보기에 임시 데이터 (학생 수만큼). 사이트에서 받은 데이터와 같은 키에 저장하므로
      // sidepanel.js 의 storage.onChanged 가 미리보기·제목·메뉴 위치를 갱신한다.
      const rows = r.names.map((name, i) => `[임시 ${i + 1}] ${name} 학생 행동특성 및 종합의견 테스트 문장입니다.`);
      await chrome.storage.local.set({ savedArray: rows, savedCategory: 'behavior', savedSubject: '' });
      chrome.action.setBadgeText({ text: rows.length ? String(rows.length) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#E66914' });
      // 이어서 일괄 입력 실행 (sidepanel.js 의 injectData, 결과는 완료 팝업으로 표시)
      //  · 'Tab 강제' 설정과 상관없이 표 구조로 행을 찾는 grid 모드로 입력한다
      //    (표를 못 찾을 때만 injectData 가 Tab 방식으로 돌아가며, 이때 tabCount 를 쓴다)
      setStatus(`조회 완료, 임시 데이터 ${rows.length}건 일괄 입력 중...`);
      const saveNote = real
        ? '⚠️ 개발용 임시 문구입니다. 저장하지 말고 다시 조회해 주세요.\n(저장 여부를 묻는 창이 뜨면 아니오)'
        : '모의 나이스 임시 문구입니다. (저장해도 연습 데이터만 바뀝니다)';
      const sum = await injectData(getSourceGuide('behavior').tabCount, { forceTab: false, saveNote });
      const expected = rows.length - (r.readonlyRows || 0);
      Object.assign(result, { 학년: r.grade, 반: r.cls, 학생수: rows.length, 입력칸없는행: r.readonlyRows, 입력결과: sum || null });
      setStatus(`완료: ${r.grade}학년 ${r.cls}반 조회 → 임시 데이터 ${sum?.count ?? 0}/${rows.length}건 입력 (결과는 팝업 확인)`
        + (real ? '\n정식 나이스입니다. 임시 문구이니 저장하지 말고 다시 조회하세요.' : ''));
      // 입력이 모자라거나 표 구조 방식이 아니었으면 진단 저장
      if (!sum || sum.error || sum.noCursor || sum.count < expected || (sum.modes.length && !sum.modes.every((m) => m === 'grid'))) {
        failInfo = { 단계: '입력', 학생수: rows.length, 입력칸없는행: r.readonlyRows, 입력결과: sum || null };
      }
    } catch (e) {
      setStatus(`실패: ${e.message}`);
      failInfo = { 단계: '확장 프로그램', 오류: e.message };
    } finally {
      try {
        if (withCapture) {
          // 끝난 시점(입력 후 또는 멈춘 곳) 화면까지 남기고 파일 하나로 저장
          await addSnap(failInfo ? '멈춘 곳' : '입력 후');
          const doc = { 종류: '나이스입력도우미 개발용 단계별 화면 수집', ...baseDoc(tab), 결과: { ...result, 실패정보: failInfo }, 단계: capture?.steps || [] };
          capture = null;
          const { name, hits } = downloadJson('neis-단계수집', doc, names);
          setStatus(`${status?.textContent.split('\n[화면 수집')[0] || ''}\n단계별 수집 파일 저장 (다운로드 폴더): ${name}`
            + (hits ? `\n⚠️ 가리기에서 빠진 이름 ${hits}곳을 추가로 가렸습니다. 개발자에게 알려 주세요.` : ''));
        } else if (failInfo) {
          const { name } = await saveDiagnostics(tab, failInfo, names);
          setStatus(`${status?.textContent || ''}\n진단 파일 저장: ${name}`);
        }
      } catch (e) {
        setStatus(`${status?.textContent || ''}\n파일 저장 실패: ${e.message}`);
      } finally {
        capture = null;
        setBusy(false);
      }
    }
  }

  btn.addEventListener('click', () => runFlow(false));
  capBtn?.addEventListener('click', () => runFlow(true));

  // 실패하지 않았어도 지금 화면 구조를 직접 저장
  diagBtn?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    setBusy(true);
    try {
      const { name } = await saveDiagnostics(tab, { 단계: '수동 저장' });
      setStatus(`진단 파일 저장: ${name}`);
    } catch (e) {
      setStatus(`진단 파일 저장 실패: ${e.message}`);
    } finally {
      setBusy(false);
    }
  });
})();
