// ──────────────────────────────────────────────────────────────
// [개발용] 압축해제로 불러온 개발 설치에서만 보인다 (웹스토어 설치에는 update_url 이 있음)
//   · 지금 화면 진단 저장 / 수동 화면 수집: 화면 구조를 가린 JSON 파일로 내려받는다
//     (학생 이름·입력값·상단 사용자 정보·알림 내용은 ▒▒▒ 로 가림, 밖으로 자동 전송하지 않음)
//   · 예시 데이터: issamGPT 형식(docs/issamgpt-message-format.md)의 데이터를 받은 것처럼 넣는다
//   · 자동 입력 로그: 사이드패널 [과세특/행특 자동 입력]이 중간에 멈추면 단계별 화면 구조·표 상태·
//     묶음별 결과를 파일 하나(neis-자동입력-*.json)로 내려받는다 (sidepanel.js 의 runAutoInput 이 부름)
//   · VPN 을 켜면 인터넷이 끊기는 학교 PC: VPN 을 켠 채 돌리고, 끈 뒤 다운로드 폴더의 파일만 전달한다
// ──────────────────────────────────────────────────────────────
(() => {
  const IS_DEV_INSTALL = !('update_url' in chrome.runtime.getManifest());
  const MOCK_NEIS_URL = 'http://127.0.0.1:8770/neis/';

  const devTools = document.getElementById('devTools');
  const diagBtn = document.getElementById('btnDevSaveDiag');
  const status = document.getElementById('devQuickQueryStatus');
  if (!IS_DEV_INSTALL || !devTools) return;
  devTools.hidden = false;

  const setStatus = (text) => { if (status) status.textContent = text; };
  const isRealNeis = (url) => { try { return /(^|\.)neis\.go\.kr$/.test(new URL(url).hostname); } catch { return false; } };
  const isMockNeis = (url) => !!url?.startsWith(MOCK_NEIS_URL);
  const urlPath = (url) => { try { const u = new URL(url); return u.origin + u.pathname; } catch { return ''; } };


  // 진단 정보 수집 (페이지의 모든 프레임에서 실행). 구조는 남기고 개인정보가 될 수 있는 글자는 가린다.
  //  · 글자를 남기는 곳: 역할·메가·왼쪽 메뉴, MDI 탭, 조회조건, 표 머리글, 펼친 목록, 화면 안 버튼, 화면 제목
  //  · 그 밖의 글자(상단 학교·사용자 정보, 알림 내용 등)와 학생 행의 글자·칸 이름 값, 입력값은 모두 ▒▒▒
  function collectNeisDiag() {
    const MASK = '▒▒▒';
    const LIMIT = 300000;
    const SAFE = [
      '.cl-navigationbar-item', '.cl-navigationbar-menu', '.cl-navigationbar-accessiblemegamenu', '.cl-sidenavigation-item', '.rolemenu a',
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
      'li.cl-navigationbar-item', '.cl-navigationbar-menu', '.cl-navigationbar-menu a[role=link]', '.cl-navigationbar-accessiblemegamenu',
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
      메가메뉴_보이는항목: [...document.querySelectorAll('.cl-navigationbar-menu a[role=link], .cl-navigationbar-accessiblemegamenu a[role=link]')].filter(visible).map(text).slice(0, 80),
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

  // 단계별 수집 중인 실행 (없으면 null). 페이지의 snap() 요청을 받아 그 순간의 화면 구조를 쌓는다.
  let capture = null;
  const addSnap = async (name, extra = {}) => {
    const c = capture;
    if (!c) return;
    const order = (c.n = (c.n || 0) + 1);
    c.steps.push({ 순서: order, 이름: name, 경과ms: Date.now() - c.t0, ...extra, 프레임: await collectFrames(c.tabId) });
    if (status) status.textContent = `${status.textContent.split('\n[화면 수집')[0]}\n[화면 수집 ${order}개] ${name}`;
  };
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== 'ns-dev-snap' || !capture || sender.tab?.id !== capture.tabId) return false;
    addSnap(msg.name, { 단계번호: msg.stepNo, 페이지경과ms: msg.ms }).then(() => sendResponse(true), () => sendResponse(false));
    return true;
  });

  const buttons = [diagBtn].filter(Boolean);
  const setBusy = (busy) => buttons.forEach((b) => { b.disabled = busy; });

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

  // 2-2) 실패했을 때 표 전체 상태: 그려진 행·칸의 화면 위치, 스크롤 막대 값, 바깥 상자들의 스크롤 성질, 포커스.
  //  글자는 넣지 않고 글자 수만 남긴다 (학생 이름·학생부 문장이 파일에 들어가지 않게).
  function gridLayoutDump() {
    const visible = (e) => !!e && e.getClientRects().length > 0;
    const R = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const cls = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/).filter(Boolean).slice(0, 5).join('.') : ''}`;
    const scrollInfo = (e) => {
      const st = getComputedStyle(e);
      return { 요소: cls(e), 위치: R(e), overflow: `${st.overflowX}/${st.overflowY}`, scrollTop: Math.round(e.scrollTop), scrollLeft: Math.round(e.scrollLeft),
        clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, transform: st.transform !== 'none' ? st.transform : undefined };
    };
    // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
    const panel = (() => {
      const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
      const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
      return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
    })();
    if (!panel) return { here: false };
    const grids = [...panel.querySelectorAll('[role=grid]')].filter(visible).map((g) => {
      const rows = [...g.querySelectorAll('[role=row]')];
      const first = rows.find((r) => r.querySelector('[role=gridcell]'));
      // 첫 학생 행에서 표까지 올라가며 각 상자의 스크롤 성질
      const chain = [];
      for (let e = first?.parentElement; e && e !== g.parentElement; e = e.parentElement) chain.push(scrollInfo(e));
      // 표 위쪽 (표 바깥) 스크롤 상자들
      const outer = [];
      for (let e = g.parentElement; e && e !== document.documentElement; e = e.parentElement) {
        if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) outer.push(scrollInfo(e));
      }
      const bars = [...g.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 || /cl-scrollbar/.test(String(e.className))).slice(0, 12).map(scrollInfo);
      const mids = [...g.querySelectorAll('[data-role=rowgroup]')].map((e) => ({ 위치: R(e), loc: e.getAttribute('data-loc'), 보임: visible(e) }));
      return {
        이름: /그리드$/.test(g.getAttribute('aria-label') || '') ? g.getAttribute('aria-label') : '▒▒▒', 위치: R(g), aria_rowcount: g.getAttribute('aria-rowcount'),
        머리글: [...g.querySelectorAll('[role=columnheader]')].map((h) => ({ 열: h.getAttribute('data-cellindex'), 글: (h.textContent || '').replace(/\s+/g, ''), 위치: R(h) })),
        행묶음: mids, 스크롤상자: bars, 첫행에서표까지: chain, 표바깥스크롤: outer,
        행: rows.slice(0, 40).map((r) => ({
          aria_rowindex: r.getAttribute('aria-rowindex'), data_rowindex: r.getAttribute('data-rowindex'),
          상태: String(r.className || '').split(/\s+/).filter((x) => /editing|selected|modified|viewing|row$/.test(x)).join(' '),
          위치: R(r), 머리글행: !!r.querySelector('[role=columnheader]'), 보임: visible(r),
          칸: [...r.querySelectorAll('[role=gridcell]')].filter((c) => c.closest('[role=row]') === r).map((c) => {
            const ed = c.querySelector('textarea, input, [contenteditable=true]');
            return { 열: c.getAttribute('data-cellindex'), 위치: R(c), 글자수: (c.textContent || '').trim().length,
              입력칸: ed ? `${ed.tagName.toLowerCase()}${ed.readOnly ? '(읽기전용)' : ''}${ed.disabled ? '(꺼짐)' : ''}` : null,
              안쪽: c.firstElementChild ? cls(c.firstElementChild) : null };
          }),
        })),
      };
    });
    const a = document.activeElement;
    return {
      here: true, 창: { innerWidth, innerHeight, scrollY: Math.round(scrollY), 배율: devicePixelRatio },
      포커스: a && a !== document.body ? { 요소: cls(a), 위치: R(a), 행: a.closest?.('[role=row]')?.getAttribute('aria-rowindex') || null,
        칸열: a.closest?.('[role=gridcell]')?.getAttribute('data-cellindex') || null, 값글자수: 'value' in a ? String(a.value || '').length : undefined } : null,
      표: grids,
    };
  }


  // ── 자동 입력 로그 ──
  // 사이드패널 [과세특/행특 자동 입력](sidepanel.js runAutoInput)이 단계마다 부른다.
  //  · 단계마다 화면 구조를 모아 두고(최근 8개), 끝나면(성공·멈춤 모두) 표 상태와 함께 파일 하나로 내려받는다.
  //    (선생님과 주고받는 동안은 성공한 경우의 화면 구조도 받아 본다)
  //  · 묶음별 결과는 숫자만 남긴다 (표에 없는 학생·이름 다른 학생은 몇 명인지만).
  const MAX_AUTO_SNAPS = 8;
  window.nsAutoLog = {
    async start(tab, meta) {
      capture = { tabId: tab.id, t0: Date.now(), steps: [], tab, meta };
      await addSnap('시작');
    },
    async step(name) {
      if (!capture) return;
      await addSnap(name);
      // 처음('시작')은 남기고 나머지는 최근 것만
      if (capture.steps.length > MAX_AUTO_SNAPS) capture.steps.splice(1, capture.steps.length - MAX_AUTO_SNAPS);
    },
    async finish(info) {
      const c = capture;
      if (!c) return null;
      try {
        await addSnap(info.ok ? '끝' : '멈춘 곳');
        let layout = null;
        try {
          layout = (await chrome.scripting.executeScript({ target: { tabId: c.tabId, allFrames: true }, func: gridLayoutDump }))
            .map((x) => x.result).find((x) => x && x.here) || null;
        } catch (e) { layout = { 오류: e.message }; }
        // 가리기 대조용 이름: 받은 데이터의 이름 + 지금 나이스 표의 성명 (파일에는 넣지 않고 대조에만 쓴다)
        const { savedStudents } = await chrome.storage.local.get(['savedStudents']);
        let onScreen = [];
        try {
          onScreen = (await chrome.scripting.executeScript({ target: { tabId: c.tabId, allFrames: true }, func: () => {
            const out = new Set();
            document.querySelectorAll('[role=gridcell]').forEach((x) => {
              const m = /^\d+행 (?:마지막 행 )?성명 (.+)$/.exec(x.getAttribute('aria-label') || '');
              if (m) out.add(m[1].trim());
            });
            document.querySelectorAll('[role=grid]').forEach((g) => {
              const h = [...g.querySelectorAll('[role=columnheader]')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '성명');
              const col = h?.getAttribute('data-cellindex');
              if (col != null) g.querySelectorAll(`[role=gridcell][data-cellindex="${col}"]`).forEach((x) => out.add((x.textContent || '').trim()));
            });
            return [...out].filter((n) => n.length >= 2);
          } })).flatMap((x) => x.result || []);
        } catch { /* 이름 대조는 받은 데이터 것만 */ }
        const names = [...new Set([...(savedStudents || []).map((x) => x?.name).filter(Boolean), ...onScreen])];
        const count = (a) => (Array.isArray(a) ? a.length : 0);
        const doc = {
          종류: '나이스입력도우미 자동 입력 로그', ...baseDoc(c.tab),
          실행: c.meta,
          결과: {
            성공: !!info.ok, 멈춘단계: info.ok ? null : info.stage, 오류: info.error || null, 나이스창: info.dialog || null,
            묶음별: (info.report || []).map((r) => ({
              묶음: r.묶음, 넣음: r.넣음, 표에없음: count(r.못찾음), 이름달라안넣음: count(r.이름다름),
              저장: r.저장 || '', 확인: r.확인 || undefined, 나이스알림: r.알림 || undefined,
            })),
            마지막입력: info.sum ? {
              입력: info.sum.count, 건너뜀: info.sum.skipped, 표에없음: count(info.sum.notFound), 이름달라안넣음: count(info.sum.mismatch),
              편집기열기: info.sum.openStats || null, 못연칸: info.sum.openFails?.length ? info.sum.openFails : undefined,
            } : null,
            저장기록: info.save || null,
          },
          단계: c.steps,
          ...(layout ? { 표상태: layout } : {}),
        };
        capture = null;
        // 파일 이름만 봐도 알 수 있게: neis-자동입력-성공-… / neis-자동입력-멈춤-…
        const { name, hits } = downloadJson(`neis-자동입력-${info.ok ? '성공' : '멈춤'}`, doc, names);
        return { name, hits };
      } catch (e) {
        capture = null;
        return { error: e.message };
      }
    },
    done() { capture = null; },
  };

  // ── 수동 화면 수집 ──
  // 사람이 직접 메뉴를 누르며 원하는 순간마다 '담기' → 마지막에 파일 하나로 저장.
  // 새 화면(과세특 등)으로 들어가는 길을 스크립트로 만들기 전에 메뉴·화면 구조를 파악하는 용도.
  // VPN 을 켜 둔 채로도 저장(다운로드 폴더)까지 되므로, VPN 을 끈 뒤 파일만 전달하면 된다.
  // 모은 화면은 사이드패널 메모리에만 있으므로 사이드패널을 닫으면 사라진다.
  const snapNowBtn = document.getElementById('btnDevSnapNow');
  const snapDelayBtn = document.getElementById('btnDevSnapDelay');
  const snapSaveBtn = document.getElementById('btnDevSnapSave');
  const snapClearBtn = document.getElementById('btnDevSnapClear');
  const snapMemo = document.getElementById('devSnapMemo');
  const snapStatus = document.getElementById('devSnapStatus');
  if (!snapNowBtn) return;

  let manual = { t0: 0, tab: null, steps: [] };
  let snapping = false;
  const setSnapStatus = (t) => { if (snapStatus) snapStatus.textContent = t; };
  const refreshSnapButtons = () => {
    const n = manual.steps.length;
    snapNowBtn.disabled = snapping;
    snapDelayBtn.disabled = snapping;
    snapSaveBtn.disabled = snapping || !n;
    snapClearBtn.disabled = snapping || !n;
    snapSaveBtn.textContent = `파일로 저장 (${n}개)`;
  };

  async function manualSnap(delayMs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    snapping = true;
    refreshSnapButtons();
    const memo = snapMemo?.value.trim() || '';
    try {
      for (let s = Math.ceil(delayMs / 1000); s > 0; s--) {
        setSnapStatus(`${s}초 뒤 담습니다... 나이스 화면에서 원하는 상태(메뉴 펼침 등)로 두세요.`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setSnapStatus('담는 중...');
      if (!manual.steps.length) manual = { t0: Date.now(), tab, steps: [] };
      const order = manual.steps.length + 1;
      manual.steps.push({
        순서: order, 메모: memo, 경과ms: Date.now() - manual.t0,
        탭주소: urlPath(tab.url), 탭제목: tab.title || '', 프레임: await collectFrames(tab.id),
      });
      if (snapMemo) snapMemo.value = '';
      setSnapStatus(`${order}번째 화면 담음${memo ? ` (${memo})` : ''}. 다음 단계로 이동한 뒤 다시 담으세요.\n※ 사이드패널을 닫으면 모은 화면이 사라집니다.`);
    } catch (e) {
      setSnapStatus(`담기 실패: ${e.message}`);
    } finally {
      snapping = false;
      refreshSnapButtons();
    }
  }

  snapNowBtn.addEventListener('click', () => manualSnap(0));
  snapDelayBtn.addEventListener('click', () => manualSnap(3000));
  snapMemo?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !snapping) manualSnap(0); });
  snapSaveBtn.addEventListener('click', () => {
    if (!manual.steps.length) return;
    try {
      const doc = { 종류: '나이스입력도우미 개발용 수동 화면 수집', ...baseDoc(manual.tab), 단계: manual.steps };
      const { name } = downloadJson('neis-수동수집', doc, null);
      setSnapStatus(`저장 완료 (다운로드 폴더): ${name}\n보내기 전에 파일을 열어 학생 이름이 없는지 확인해 주세요.`);
      manual = { t0: 0, tab: null, steps: [] };
    } catch (e) {
      setSnapStatus(`저장 실패: ${e.message}`);
    }
    refreshSnapButtons();
  });
  snapClearBtn.addEventListener('click', () => {
    manual = { t0: 0, tab: null, steps: [] };
    setSnapStatus('모은 화면을 비웠습니다.');
    refreshSnapButtons();
  });
  refreshSnapButtons();
  // ── 예시 데이터: issamGPT 가 보내는 형식(docs/issamgpt-message-format.md) 그대로 만들어 받은 것처럼 넣는다 ──
  const sampleJson = document.getElementById('devSampleJson');
  const sampleStatus = document.getElementById('devSampleStatus');
  const setSampleStatus = (t) => { if (sampleStatus) sampleStatus.textContent = t; };
  // 예시는 학생 10명씩. 모의 나이스 명단(강의실 5 → 5/1…, 3-1 담임 → 1번…)에 맞춘다
  //  (정식 나이스에서는 [지금 나이스 표의 반/번호·조회조건으로 채우기] 를 쓴다)
  const TEN = Array.from({ length: 10 }, (_, i) => i + 1);
  const SAMPLES = {
    seteuk: {
      type: 'NEISSHOT_DATA', category: 'seteuk', subject: '공통수학2',
      query: { year: '2026', semester: '2', grade: '1', subject: '공통수학2', room: '5' },
      students: TEN.map((n) => ({ ban: '5', no: n, name: '', text: `[예시 5/${n}] 과세특 예시 문장입니다.` })),
    },
    // 조회조건(학년·과목·강의실)이 다른 묶음 3개, 묶음마다 10명 → 묶음마다 조회 → 입력 → 저장
    groups: {
      type: 'NEISSHOT_DATA', category: 'seteuk',
      groups: [
        { query: { year: '2026', semester: '2', grade: '1', subject: '공통수학2', room: '5' },
          students: TEN.map((n) => ({ ban: '5', no: n, name: '', text: `[예시 5/${n}] 1학년 공통수학2 강의실5` })) },
        { query: { year: '2026', semester: '2', grade: '1', subject: '공통수학2', room: '6' },
          students: TEN.map((n) => ({ ban: '6', no: n, name: '', text: `[예시 6/${n}] 1학년 공통수학2 강의실6` })) },
        { query: { year: '2026', semester: '2', grade: '2', subject: '확률과 통계', room: '2' },
          students: TEN.map((n) => ({ ban: '2', no: n, name: '', text: `[예시 2/${n}] 2학년 확률과 통계 강의실2` })) },
      ],
    },
    behavior: {
      type: 'NEISSHOT_DATA', category: 'behavior', subject: '',
      query: { year: '2026', semester: '2', grade: '3', ban: '1' },
      students: TEN.map((n) => ({ ban: '1', no: n, name: '', text: `[예시 ${n}번] 행발 예시 문장입니다.` })),
    },
  };
  // 학생 한 명을 한 줄로 보여 주는 JSON (길어도 읽기 쉽게)
  const pretty = (p) => {
    if (p.groups) {
      const { groups, ...rest } = p;
      const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
      return `${head},\n  "groups": [\n${groups.map((g) => `    {\n      "query": ${JSON.stringify(g.query)},\n      "students": [\n${g.students.map((x) => `        ${JSON.stringify(x)}`).join(',\n')}\n      ]\n    }`).join(',\n')}\n  ]\n}`;
    }
    const { students, ...rest } = p;
    const head = JSON.stringify(rest, null, 2).replace(/\n}$/, '');
    if (!students) return JSON.stringify(p, null, 2);
    return `${head},\n  "students": [\n${students.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]\n}`;
  };
  const showSample = (p, note) => { if (sampleJson) sampleJson.value = pretty(p); setSampleStatus(note || ''); };
  // 예시 버튼은 채우고 바로 받는다 (JSON 을 고쳤으면 [이 데이터로 받기]로 다시 받는다)
  document.getElementById('btnDevSampleSeteuk')?.addEventListener('click', () => { showSample(SAMPLES.seteuk); sendSample(); });
  document.getElementById('btnDevSampleBehavior')?.addEventListener('click', () => { showSample(SAMPLES.behavior); sendSample(); });
  // 과세특 묶음 예시: 지금 과세특 화면의 학년·과목·강의실 목록에서 서로 다른 조합 3개를 골라,
  //  조합마다 조회해 실제 명단 앞 10명(반/번호·성명)으로 묶음을 만들고 받는다.
  //  · 모의 나이스: 자동 입력이 묶음마다 [저장]까지 한다
  //  · 정식 나이스: 시험 모드 — 저장하지 않고, 넣고 → 맞게 들어갔는지 확인 → 다시 조회해 버린다
  //  · 과세특 화면이 아니면 모의 나이스 명단에 맞춘 고정 예시를 쓴다 (모의 나이스에서만)
  document.getElementById('btnDevSampleGroups')?.addEventListener('click', async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    const real = active && isRealNeis(active.url);
    const run = (func, args = []) => chrome.scripting.executeScript({ target: { tabId: active.id, allFrames: true }, func, args });
    const here = (rs) => rs.map((x) => x.result).find((x) => x && x.here) || null;
    try {
      if (!active || !(real || isMockNeis(active.url))) { setSampleStatus('나이스 탭(정식 또는 모의)에서 과세특 화면을 연 채로 누르세요.'); return; }
      setSampleStatus('과세특 화면의 학년·과목·강의실 목록 읽는 중...');
      const lc = here(await run(listSeteukCombosInPage, [3, 4]));
      if (!lc) {
        if (real) { setSampleStatus('과세특 화면을 찾지 못했습니다. 정식 나이스에서는 과세특 화면을 연 뒤 누르세요.'); return; }
        showSample(SAMPLES.groups);
        await sendSample();
        setSampleStatus(`과세특 화면이 아니어서 고정 예시(모의 나이스 명단)를 넣었습니다.\n${sampleStatus?.textContent || ''}`);
        return;
      }
      const triples = lc.combos.flatMap((c) => c.rooms.map((room) => ({ grade: c.grade, subject: c.subject, room })));
      if (!triples.length) { setSampleStatus('고를 수 있는 과목·강의실이 없습니다.'); return; }
      const groups = [];
      for (const t of pickVaried(triples, triples.length)) {
        if (groups.length >= 3) break;
        const query = { year: lc.year, semester: lc.semester, ...(t.grade ? { grade: t.grade } : {}), subject: t.subject, room: t.room };
        setSampleStatus(`조회해서 명단 읽는 중... (${[t.grade && `${t.grade}학년`, t.subject, `강의실 ${t.room}`].filter(Boolean).join(' · ')})`);
        const q = here(await run(applyNeisQueryInPage, [query]));
        if (!q?.ok) continue;
        const r = here(await run(readGridForSample, [true]));
        if (!r?.ok || !r.keys.length) continue;
        const students = r.keys.slice(0, 10).map((k, i) => {
          const n = (k.match(/\d+/g) || []).map(Number);
          if (!n.length) return null;
          const no = n[n.length - 1], ban = n.length > 1 ? n[n.length - 2] : null;
          const tag = ban != null ? `${ban}/${no}` : `${no}번`;
          return { ...(ban != null ? { ban: String(ban) } : {}), no, name: r.names?.[i] || '', text: `[예시 ${tag}] ${t.subject} 강의실${t.room} 묶음 예시` };
        }).filter(Boolean);
        // issamGPT 처럼 과목은 괄호 앞만 보낸다
        if (students.length) groups.push({ query: { ...query, subject: t.subject.replace(/\s*\(\d+\)\s*$/, '') }, students });
      }
      if (!groups.length) { setSampleStatus('명단이 있는 조합을 찾지 못했습니다.'); return; }
      showSample({ type: 'NEISSHOT_DATA', category: 'seteuk', groups });
      await sendSample();
      if (real) await chrome.storage.local.set({ savedDryRun: true });
      setSampleStatus(`화면에서 ${groups.length}개 묶음(${groups.map((g) => g.students.length).join('·')}명)을 만들어 받았습니다.`
        + (real ? '\n정식 나이스: 시험 모드 — [과세특 자동 입력]은 저장하지 않고, 넣고 확인한 뒤 다시 조회해 버립니다.' : '\n모의 나이스: [과세특 자동 입력]은 묶음마다 [저장]까지 합니다.'));
    } catch (e) {
      setSampleStatus(`실패: ${e.message}`);
    }
  });

  // 페이지 함수: 지금 열린 표의 반/번호(번호)와 조회조건. 학생 이름·문장은 읽지 않는다.
  //  withNames: 성명 열 글자도 읽는다 (묶음 예시의 이름 확인용. 사이드패널 안에만 두고 파일로 내보내지 않는다)
  async function readGridForSample(withNames = false) {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (e) => !!e && e.getClientRects().length > 0;
    const plain = (e) => (e?.textContent || '').replace(/\s+/g, '');
    // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
    const panel = (() => {
      const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
      const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
      return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
    })();
    if (!panel) return { here: false };
    const grid = [...panel.querySelectorAll('[role=grid]')].filter(visible).find((g) => !/엑셀/.test(g.getAttribute('aria-label') || '')
      && [...g.querySelectorAll('[role=columnheader]')].some((h) => ['반/번호', '번호'].includes(plain(h))));
    if (!grid) return { here: true, ok: false, error: '반/번호(번호) 열이 있는 표가 없습니다. 조회한 뒤 다시 누르세요.' };
    const head = (n) => [...grid.querySelectorAll('[role=columnheader]')].find((h) => plain(h) === n);
    const keyH = head('반/번호') || head('번호');
    const keyCol = keyH.getAttribute('data-cellindex');
    const rows = () => [...grid.querySelectorAll('[role=row][aria-rowindex]')].filter((r) => !r.querySelector('[role=columnheader]'));
    const keyOf = (r) => plain(r.querySelector(`[role=gridcell][data-cellindex="${keyCol}"]`));
    const sb = [...grid.querySelectorAll('.cl-scrollbar')].find((e) => e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 1);
    const seen = new Map();
    const nameH = head('성명');
    const nameCol = withNames && nameH ? nameH.getAttribute('data-cellindex') : null;
    const names = new Map();
    const take = () => rows().forEach((r) => {
      const k = keyOf(r);
      if (!k) return;
      const ri = Number(r.getAttribute('aria-rowindex'));
      seen.set(ri, k);
      if (nameCol != null) names.set(ri, (r.querySelector(`[role=gridcell][data-cellindex="${nameCol}"]`)?.textContent || '').replace(/\s+/g, ' ').trim());
    });
    if (sb) { sb.scrollTop = 0; await wait(200); }
    take();
    for (let i = 0; sb && i < 300 && sb.scrollTop + sb.clientHeight < sb.scrollHeight - 1; i++) {
      sb.scrollTop += Math.max(20, Math.ceil(sb.scrollHeight / (Number(grid.getAttribute('aria-rowcount') || 2))));
      await wait(80);
      take();
    }
    if (sb) { sb.scrollTop = 0; await wait(150); }
    const combos = [...panel.querySelectorAll('[role=combobox]')].filter((b) => visible(b) && !b.closest('[role=row]'));
    const val = (n) => { const b = combos.find((x) => (x.getAttribute('aria-label') || '').startsWith(`${n}, `)); return b ? b.getAttribute('aria-label').replace(/^[^,]*,\s*/, '').trim() : ''; };
    const label = `${grid.getAttribute('aria-label') || ''} ${plain(panel.querySelector('h1, .title, [role=heading]'))}`;
    const category = /세부능력/.test(label) ? 'seteuk' : /행동특성/.test(label) ? 'behavior' : /창의적|자율|동아리|진로활동/.test(label) ? 'creative' : /종합의견|교과학습/.test(label) ? 'subject' : '';
    const q = { year: val('학년도'), semester: val('학기'), grade: val('계열/학년/학과') || val('학년'), ban: val('반'), subject: val('과목'), room: val('강의실') };
    const order = [...seen.keys()].sort((a, b) => a - b);
    return { here: true, ok: true, keyName: plain(keyH), keys: order.map((ri) => seen.get(ri)), names: nameCol != null ? order.map((ri) => names.get(ri) || '') : null, category, query: q };
  }

  // 페이지 함수: 과세특 화면의 학년(계열/학년/학과) → 과목 → 강의실 목록을 차례로 골라 보며 조합을 모은다.
  //  고르기만 하고 [조회]는 누르지 않는다. 끝나면 처음 값으로 되돌린다.
  async function listSeteukCombosInPage(maxGrades, maxSubjects) {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (e) => !!e && e.getClientRects().length > 0;
    const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
    // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
    const panel = (() => {
      const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
      const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
      return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
    })();
    if (!panel) return { here: false };
    const box = (n) => [...panel.querySelectorAll('[role=combobox]')].find((b) => visible(b) && !b.closest('[role=row]') && (b.getAttribute('aria-label') || '').startsWith(`${n}, `));
    if (!box('과목') || !box('강의실')) return { here: false };
    const cur = (n) => (box(n)?.getAttribute('aria-label') || '').replace(/^[^,]*,\s*/, '').trim();
    const loadmask = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
    const settle = async () => { await wait(250); for (let i = 0; i < 100 && loadmask(); i++) await wait(100); };
    const real = (v) => v && !/없음|선택|^전체$/.test(v);
    const openList = async (n) => {
      const b = box(n); b.click();
      for (let i = 0; i < 30; i++) {
        await wait(100);
        const lists = [...document.querySelectorAll('[role=listbox]')].filter(visible);
        const list = lists.find((l) => l.getAttribute('aria-label') === n) || lists[lists.length - 1];
        const o = list ? [...list.querySelectorAll('[role=option]')] : [];
        if (o.length) return o;
      }
      return [];
    };
    const closeList = () => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    const options = async (n) => { const o = (await openList(n)).map(text).filter(real); closeList(); await wait(150); return o; };
    const pick = async (n, v) => {
      if (cur(n) === v) return true;
      const o = (await openList(n)).find((x) => text(x) === v);
      if (!o) { closeList(); return false; }
      o.click();
      await settle();
      return cur(n) === v;
    };
    const G = '계열/학년/학과';
    const orig = { g: cur(G), s: cur('과목'), r: cur('강의실') };
    const combos = [];
    const grades = box(G) ? (await options(G)).slice(0, maxGrades) : [''];
    for (const g of grades) {
      if (g && !(await pick(G, g))) continue;
      const subjects = (await options('과목')).slice(0, maxSubjects);
      for (const s of subjects) {
        if (!(await pick('과목', s))) continue;
        const rooms = await options('강의실');
        if (rooms.length) combos.push({ grade: g, subject: s, rooms });
      }
    }
    // 처음 값으로 되돌린다
    if (box(G) && real(orig.g)) await pick(G, orig.g);
    if (real(orig.s)) await pick('과목', orig.s);
    if (real(orig.r)) await pick('강의실', orig.r);
    return { here: true, ok: true, combos, year: cur('학년도'), semester: cur('학기') };
  }

  // 조합 여러 개 중 서로 다른 것을 고른다: 새 과목이면 +2, 새 강의실 +1, 새 학년 +1 — 점수가 높은 것부터 하나씩
  const pickVaried = (triples, n) => {
    const out = [];
    const rest = [...triples];
    while (out.length < n && rest.length) {
      const score = (t) => (out.some((x) => x.subject === t.subject) ? 0 : 2) + (out.some((x) => x.room === t.room) ? 0 : 1) + (out.some((x) => x.grade === t.grade) ? 0 : 1);
      let best = 0;
      rest.forEach((t, k) => { if (score(t) > score(rest[best])) best = k; });
      out.push(rest.splice(best, 1)[0]);
    }
    return out;
  };

  document.getElementById('btnDevSampleFromGrid')?.addEventListener('click', async () => {
    try {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!active || !(isRealNeis(active.url) || isMockNeis(active.url))) { setSampleStatus('나이스 탭(정식 또는 모의)을 연 채로 누르세요.'); return; }
      setSampleStatus('표 읽는 중...');
      const r = (await chrome.scripting.executeScript({ target: { tabId: active.id, allFrames: true }, func: readGridForSample }))
        .map((x) => x.result).find((x) => x && x.here);
      if (!r) { setSampleStatus('나이스 화면을 찾지 못했습니다.'); return; }
      if (!r.ok) { setSampleStatus(r.error); return; }
      const cat = r.category || 'seteuk';
      const query = Object.fromEntries(Object.entries(r.query).filter(([, v]) => v));
      // 과목은 나이스 표기 '공통수학2(4)' 에서 괄호 앞만 보내도 맞춰진다 (형식 문서와 같게)
      if (query.subject) query.subject = query.subject.replace(/\s*\(\d+\)\s*$/, '');
      const nums = (k) => (k.match(/\d+/g) || []).map(Number);
      const students = r.keys.map((k) => {
        const n = nums(k);
        if (!n.length) return null;
        const no = n[n.length - 1], ban = n.length > 1 ? n[n.length - 2] : null;
        // 꼬리표는 표의 반/번호(번호) 칸과 같은 모양으로 (맞는 행 판정에 쓰임)
        const tag = ban != null ? `${ban}/${no}` : `${no}번`;
        // 행특처럼 표에 번호만 있으면 반은 조회조건의 반으로 채운다 (issamGPT 도 반을 함께 보냄)
        const qBan = (String(query.ban || '').match(/\d+/g) || []).pop();
        const b = ban != null ? String(ban) : qBan || null;
        return { ...(b ? { ban: b } : {}), no, name: '', text: `[예시 ${tag}] ${CATEGORY_NAMES[cat] || '학생부'} 예시 문장입니다.` };
      }).filter(Boolean);
      showSample({ type: 'NEISSHOT_DATA', category: cat, subject: query.subject || '', query, students });
      await sendSample();
      setSampleStatus(`표에서 ${students.length}명(${r.keyName})과 조회조건을 읽어 받았습니다. 이름은 비워 두었습니다.\n${sampleStatus?.textContent || ''}`);
    } catch (e) {
      setSampleStatus(`실패: ${e.message}`);
    }
  });
  const CATEGORY_NAMES = { seteuk: '과세특', behavior: '행발', creative: '창체', subject: '평어' };

  // issamGPT 가 보낸 것과 같은 길(background.js acceptPayload)로 받는다 → 미리보기 제목·내용·버튼이 바로 바뀐다
  const sendSample = async () => {
    let payload;
    try { payload = JSON.parse(sampleJson?.value || ''); } catch (e) { setSampleStatus(`JSON 형식 오류: ${e.message}`); return; }
    try {
      const res = await chrome.runtime.sendMessage({ type: 'NEISSHOT_DEV_PAYLOAD', payload });
      setSampleStatus(res?.ok
        ? `받았습니다: ${res.count}건${res.groups ? ` (조회조건 묶음 ${res.groups}개)` : ''}${res.students != null ? ` (학생별 반·번호 ${res.students}명)` : ' (예전 rows 형식)'}${res.query ? ', 조회조건 있음' : ''}`
          + (res.groups ? '\n[자동 입력]은 묶음마다 [저장]까지 합니다. 모의 나이스에서만 시험하세요.' : '\n[자동 입력] 버튼을 누르면 화면을 찾아 넣습니다. (정식 나이스는 저장하지 말 것)')
        : `거절: ${res?.error || '응답 없음'}${res?.detail ? ` (${res.detail})` : ''}`);
    } catch (e) {
      setSampleStatus(`보내기 실패: ${e.message}`);
    }
  };
  document.getElementById('btnDevSampleSend')?.addEventListener('click', sendSample);
  showSample(SAMPLES.seteuk);
})();
