// 모의 나이스 (연습용) — 4세대 나이스 화면 구조와 모양을 따라 만든 연습장.
// 기준: 2026-10-11 두 차례 수집(나이스 화면 233기록). 모든 이름·숫자·문서는 가짜입니다.
'use strict';
(async () => {
  const { el, icon, button, output, label, combo, dateinput, inputbox, numbox, textarea, checkbox, radios, grid, dialog,
    alert, error, confirm, busy, api, press, uid } = CL;
  const SPEC = await (await fetch('/data/neis.json')).json();
  const MENU = Object.fromEntries(SPEC.menus.map((m) => [m.code, m]));
  // ?school=elem → 초등 학급담임 계정처럼: 교과담임·○-○담임·동아리담임·부서장 역할이 없다 (2026-11-26 정식 나이스 로그)
  if (new URLSearchParams(location.search).get('school') === 'elem') {
    SPEC.roles = SPEC.roles.filter((c) => !['002002', '118001', '002003', '101000'].includes(c));
  }
  const KIDS = {};
  SPEC.menus.forEach((m) => { (KIDS[m.parent] = KIDS[m.parent] || []).push(m.code); });
  Object.values(KIDS).forEach((k) => k.sort());   // NEIS menu codes run in display order (AMCMC40043, 40044 …)
  const SCREENS = SPEC.screens;
  const TODAY = '2026-10-11';   // 연습장의 "오늘" (일요일)
  const NOISE = /달력으로 날짜 선택|필터 등$|^지시문 닫기$|^도움말 닫기$|^안내문구|^조회숨김$/;
  const ME = { name: '모의교사', id: 'sandbox', school: '모의고등학교', office: '모의교육청', pos: '교사(중등)' };

  // ── root ──────────────────────────────────────────────────────────────────
  const app = el('div', { id: 'app', class: 'body cl-control cl-container' });
  document.body.append(app);

  // ── header: logo · blue bar (school, user, session, buttons) · role menus ──
  let left = 3599;
  const t1 = output('60분 00초', { cls: 'session-time', label: '세션 종료 시간' });
  setInterval(() => { left = Math.max(0, left - 1); t1.firstChild.textContent = `${Math.floor(left / 60)}분 ${String(left % 60).padStart(2, '0')}초`; }, 1000);
  const logo = el('div', { class: 'cl-control cl-output mainLogo', role: 'link', 'aria-label': '나이스로고', title: '나이스로고', tabindex: 0, id: uid() },
    el('span', { class: 'logo-mark', 'aria-hidden': 'true' }), el('div', { class: 'cl-text', text: ME.office }));
  const navbar = el('ul', { class: 'cl-navigationbar-bar' });
  const mega = el('div', { class: 'cl-navigationbar-menu', hidden: true });
  const nav = el('nav', { class: 'cl-control cl-navigationbar', 'aria-label': '메뉴', id: uid() }, navbar);
  const header = el('div', { class: 'cl-control cl-container header neis-top', id: uid() },
    el('div', { class: 'logo-area' }, logo),
    el('div', { class: 'hd-main' },
      el('div', { class: 'top-bar' },
        output(ME.school, { cls: 'school-chip', label: ME.school }),
        output(`${ME.name}(${ME.id})`, { cls: 'user-name', label: `${ME.name}(${ME.id})` }),
        el('span', { class: 'sandbox-tag', text: '연습용' }),
        el('div', { class: 'top-right' },
          el('div', { class: 'cl-control cl-button btn-transparent ico-only', role: 'link', 'aria-label': '세션시간', tabindex: 0 }, icon('clock')), t1,
          button('로그아웃', () => alert('연습용 환경에서는 로그아웃하지 않습니다.'), { cls: 'btn-top', ico: 'logout', label: '로그아웃', title: '로그아웃' }),
          button('튜토리얼', () => alert('연습용 환경입니다.'), { cls: 'btn-top', ico: 'book', label: '튜토리얼', title: '튜토리얼', role: 'link' }),
          button('사용자지원', () => alert('연습용 환경입니다.'), { cls: 'btn-top', ico: 'monitor', label: '사용자지원', title: '사용자지원', role: 'link' }),
          el('div', { class: 'zoom-btns' },
            button('화면 확대', () => {}, { cls: 'btn-sq', ico: 'expand', iconOnly: true }),
            button('화면 축소', () => {}, { cls: 'btn-sq', ico: 'shrink', iconOnly: true })))),
      nav),
    mega);
  press(logo, () => selectTab('초기화면'));

  // role menus + mega menu (filled after a short delay, like the real one)
  const levelSuffix = (lv, hasKids) => ` ${lv}단계${hasKids ? ' 메뉴항목' : ''}`;
  const menuLabel = (name, lv, hasKids) => [name, el('span', { class: 'text-transparent fs-zero', text: levelSuffix(lv, hasKids) })];
  let megaRole = null;
  SPEC.roles.forEach((code, idx) => {
    const m = MENU[code];
    const a = el('a', { class: 'cl-navigationbar-content', role: 'link', 'aria-expanded': 'false', tabindex: 0 },
      el('div', { class: 'cl-navigationbar-text cl-text' }, ...menuLabel(m.name, 0, true)), el('div', { class: 'cl-navigationbar-arrow' }));
    const li = el('li', { class: 'cl-navigationbar-item', 'data-itemid': code, 'data-itemidx': idx, 'data-role': 'menuitem', id: `pt-ae/${code}` }, a);
    press(a, () => toggleMega(code, a));
    navbar.append(li);
  });
  function toggleMega(code, a) {
    navbar.querySelectorAll('a[aria-expanded]').forEach((x) => { x.setAttribute('aria-expanded', 'false'); x.classList.remove('on'); });
    if (megaRole === code) return closeMega();
    megaRole = code;
    a.setAttribute('aria-expanded', 'true'); a.classList.add('on');
    mega.hidden = false;
    mega.textContent = '';
    mega.append(el('div', { class: 'mega-loading', text: '메뉴를 불러오는 중...' }));
    setTimeout(() => {
      if (megaRole !== code) return;
      mega.textContent = '';
      const cols = el('div', { class: 'mega-cols' });
      (KIDS[code] || []).forEach((c1) => {
        const col = el('ul', { class: 'mega-col' },
          el('li', { class: 'mega-l1', 'data-itemid': c1, 'data-role': 'menuitem' }, el('div', { class: 'cl-text' }, ...menuLabel(MENU[c1].name, 1, true))));
        (KIDS[c1] || []).forEach((c2) => {
          const kids = KIDS[c2] || [];
          const a2 = el('a', { role: 'link', tabindex: 0, class: 'cl-text' + (kids.length ? ' has-kids' : '') }, ...menuLabel(MENU[c2].name, 2, kids.length > 0));
          const li2 = el('li', { class: 'mega-l2', 'data-itemid': c2, 'data-role': 'menuitem' }, a2);
          // like the real one: a folder closes the mega menu and opens that branch in the left "화면 메뉴";
          // the screen itself is then picked in the left menu.
          press(a2, () => {
            closeMega();
            if (!kids.length) { showRoleTree(c1, c2); return openScreen(MENU[c2].name, pathOf(c2), c2); }
            showRoleTree(c1, c2);
          });
          col.append(li2);
        });
        cols.append(col);
      });
      mega.append(cols, button('닫기', closeMega, { cls: 'mega-close', iconOnly: true, ico: 'close' }));
    }, 350);
  }
  function closeMega() {
    megaRole = null; mega.hidden = true; mega.textContent = '';
    navbar.querySelectorAll('a[aria-expanded]').forEach((x) => { x.setAttribute('aria-expanded', 'false'); x.classList.remove('on'); });
  }
  function pathOf(code) {
    const names = [];
    for (let c = code, i = 0; c && MENU[c] && i < 6; c = MENU[c].parent, i++) if (MENU[c].name) names.unshift(MENU[c].name);
    return names.join(' > ');
  }

  // ── left: icon rail + panels (기본메뉴 및 승인사항 / 화면 메뉴 / 나의 할일 / 메뉴 검색 / 즐겨찾기 / 개인설정) ──
  const rail = el('div', { class: 'rail' });
  const panels = el('div', { class: 'panels' });
  const aside = el('div', { class: 'aside cl-control cl-container', id: uid() }, rail, panels);
  const PANELS = {};
  const RAIL = [['main', '기본메뉴 및 승인사항', 'person', 'button'], ['roles', '화면 메뉴', 'list', 'button'], ['todo', '미확인 나의 할일', 'bell', 'link'],
    ['search', '메뉴 검색', 'search', 'link'], ['fav', '즐겨찾기', 'star', 'link'], ['personal', '개인설정', 'settings', 'button']];
  RAIL.forEach(([key, name, ico, role]) => {
    const b = button(name, () => showPanel(key), { cls: `btn-asd ${key}`, iconOnly: true, ico, role });
    b.dataset.panel = key;
    rail.append(b);
  });
  rail.append(el('div', { class: 'rail-fill' }), button('맞춤', () => alert('맞춤 메뉴는 연습장에서 지원하지 않습니다.'), { cls: 'btn-fit' }));
  function showPanel(key) {
    Object.entries(PANELS).forEach(([k, p]) => { p.hidden = k !== key; });
    rail.querySelectorAll('.btn-asd').forEach((b) => b.classList.toggle('selected', b.dataset.panel === key));
    app.classList.remove('lnb-folded');
  }
  const panelHead = (title, ...tools) => el('div', { class: 'pannel-head' }, output(title, { cls: 'pannel-title' }), ...tools);
  const refreshBtn = (what) => button(`${what} 새로고침`, () => {}, { cls: 'btn-refresh', iconOnly: true, ico: 'refresh' });

  // eXbuilder side navigation: list/listitem, folders are a[role=menuitem][aria-expanded], leaves are plain a.
  // Child lists stay in the DOM (hidden) like the real one.
  const sideAnchors = new Map();   // code → a
  function sidenav(codes, cls, { leafOpens = true, badge } = {}) {
    const navEl = el('div', { class: `cl-control cl-sidenavigation ${cls}`, role: 'navigation' });
    const list = (cs, lv) => {
      const l = el('div', { class: `cl-list cl-level-${lv}`, role: 'list' });
      cs.forEach((c, i) => l.append(item(c, lv, i === 0, i === cs.length - 1)));
      return l;
    };
    const item = (code, lv, first, last) => {
      const m = MENU[code] || { name: code };
      const kids = KIDS[code] || [];
      const folder = kids.length > 0;
      const b = badge ? badge(code) : null;
      const a = el('a', { class: `cl-sidenavigation-item cl-level-${lv} ${folder ? 'cl-folder cl-collapsed' : 'cl-leaf'}${first ? ' cl-first' : ''}${last ? ' cl-last' : ''}`,
        'data-itemid': code, 'data-role': 'menuitem', title: m.name, role: folder ? 'menuitem' : null, 'aria-expanded': folder ? 'false' : null, tabindex: 0 },
      el('div', { class: 'cl-text' }, m.name, b !== null && b !== undefined ? el('span', { class: 'text-transparent fs-zero', text: `${b}건` })
        : el('span', { class: 'text-transparent fs-zero', text: levelSuffix(lv - 1, folder) })),
      b !== null && b !== undefined ? el('div', { class: 'cl-badge', text: String(b) }) : null,
      folder ? icon('down', 'chev') : null);
      sideAnchors.set(code, a);
      const li = el('div', { role: 'listitem' }, a);
      let sub = null;
      if (folder) { sub = list(kids, lv + 1); sub.hidden = true; li.append(sub); }
      press(a, () => {
        if (!folder) { if (leafOpens) openScreen(m.name, (cls.includes('base') ? '기본메뉴 > ' : '') + pathOf(code), code); return; }
        const open = a.getAttribute('aria-expanded') === 'true';
        a.setAttribute('aria-expanded', String(!open));
        a.classList.toggle('cl-expanded', !open); a.classList.toggle('cl-collapsed', open);
        sub.hidden = open;
      });
      return li;
    };
    navEl.append(list(codes, 1));
    return navEl;
  }
  const APPVL = [['AMWAM40011', '상신함', null], ['AMWAM40012', '미결/협조함', 0], ['AMWAM40013', '공람함', 0], ['AMWAM40014', '예결함', 0],
    ['AMWAM40015', '기결함', null], ['AMWAM40016', '반려함', 0], ['AMWAM40017', '메시지함', 0]];
  APPVL.forEach(([c, n]) => { MENU[c] = MENU[c] || { code: c, name: n, parent: '' }; });
  PANELS.main = el('div', { class: 'cl-control cl-container pannel main' },
    panelHead('승인사항', refreshBtn('승인사항')),
    sidenav(APPVL.map((x) => x[0]), 'appvl', { badge: (c) => APPVL.find((x) => x[0] === c)[2] }),
    panelHead('기본 메뉴', button('기본메뉴 설정', () => alert('기본메뉴 설정은 연습장에서 지원하지 않습니다.'), { cls: 'btn-setting', iconOnly: true, ico: 'gear', role: 'link' })),
    sidenav(SPEC.basic, 'base'));
  PANELS.roles = el('div', { class: 'cl-control cl-container pannel roles', hidden: true }, panelHead('화면 메뉴'), sidenav(SPEC.roles, 'rolemenu'));
  // 화면 메뉴 after a mega-menu pick: the picked level-1 group's tree, with the picked folder (and its parents) open
  function showRoleTree(group, focus) {
    PANELS.roles.textContent = '';
    PANELS.roles.append(panelHead(MENU[group].name), sidenav(KIDS[group] || [], 'rolemenu'));
    PANELS.roles.dataset.group = group;
    const chain = [];
    for (let c = focus; c && c !== group && MENU[c]; c = MENU[c].parent) chain.unshift(c);
    chain.forEach((c) => {
      const a = sideAnchors.get(c);
      if (!a || a.getAttribute('aria-expanded') !== 'false') return;
      a.setAttribute('aria-expanded', 'true'); a.classList.add('cl-expanded'); a.classList.remove('cl-collapsed');
      if (a.nextElementSibling) a.nextElementSibling.hidden = false;
    });
    showPanel('roles');
    const f = sideAnchors.get(focus);
    if (f) setTimeout(() => f.scrollIntoView({ block: 'nearest' }), 0);
  }
  const TODO = [['MENU_ID1', '미접수'], ['MENU_ID2', '처리요청'], ['MENU_ID3', '기한임박'], ['MENU_ID4', '처리지연'], ['MENU_ID5', '미확인']];
  TODO.forEach(([c, n]) => { MENU[c] = { code: c, name: n, parent: '' }; });
  PANELS.todo = el('div', { class: 'cl-control cl-container pannel todo', hidden: true }, panelHead('민원현황 알림', refreshBtn('민원현황')),
    sidenav(TODO.map((x) => x[0]), 'complaint', { leafOpens: false, badge: () => 0 }));
  const sInput = el('input', { class: 'cl-text', role: 'searchbox', 'aria-label': '메뉴검색', type: 'text', placeholder: '2자이상 검색단어 입력', autocomplete: 'off' });
  const sResult = el('div', { class: 'search-result' });
  const doSearch = () => {
    const q = sInput.value.trim();
    sResult.textContent = '';
    if (q.length < 2) return sResult.append(el('p', { class: 'muted', text: '2자 이상 입력하세요.' }));
    const hits = SPEC.menus.filter((m) => m.name.includes(q) && !(KIDS[m.code] || []).length).slice(0, 40);
    if (!hits.length) return sResult.append(el('p', { class: 'muted', text: '검색 결과가 없습니다.' }));
    const l = el('div', { class: 'cl-control cl-sidenavigation found', role: 'navigation' }, el('div', { class: 'cl-list cl-level-1', role: 'list' },
      hits.map((m) => {
        const a = el('a', { class: 'cl-sidenavigation-item cl-level-1 cl-leaf', 'data-itemid': m.code, 'data-role': 'menuitem', title: pathOf(m.code), tabindex: 0 },
          el('div', { class: 'cl-text' }, m.name), el('div', { class: 'menu-path', text: pathOf(m.code) }));
        press(a, () => openScreen(m.name, pathOf(m.code), m.code));
        return el('div', { role: 'listitem' }, a);
      })));
    sResult.append(l);
  };
  const sBtn = el('div', { class: 'cl-right cl-searchinput-search', role: 'button', 'aria-label': '검색', tabindex: 0 }, icon('search'));
  press(sBtn, doSearch);
  sInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doSearch(); });
  PANELS.search = el('div', { class: 'cl-control cl-container pannel search', hidden: true }, panelHead('메뉴검색'),
    el('div', { class: 'cl-control cl-searchinput pannel-search', role: 'search' }, sInput, sBtn), sResult);
  PANELS.fav = el('div', { class: 'cl-control cl-container pannel fav', hidden: true }, panelHead('즐겨찾기', refreshBtn('즐겨찾기')),
    el('div', { class: 'fav-list' }, button('권한신청', () => alert('권한신청은 연습장에서 지원하지 않습니다.'), { role: 'link', cls: 'fav-item' })));
  PANELS.personal = el('div', { class: 'cl-control cl-container pannel personal', hidden: true }, panelHead('개인설정'),
    sidenav(SPEC.personal || [], 'personalmenu'));
  Object.values(PANELS).forEach((p) => panels.append(p));
  showPanel('main');
  const lnb = button('메뉴 접기', () => { app.classList.toggle('lnb-folded'); lnb.setAttribute('aria-label', app.classList.contains('lnb-folded') ? '메뉴 펼치기' : '메뉴 접기'); },
    { cls: 'lnb-toggle', iconOnly: true, ico: 'left' });

  // ── MDI tab folder (tabs at the bottom) ──────────────────────────────────
  const tabbody = el('div', { class: 'cl-tabfolder-body' });
  const tablist = el('div', { class: 'cl-tabfolder-header-viewport content', role: 'tablist' });
  const listBtn = button('목록보기', () => tabMenu(), { cls: 'btn-tablist', label: '탭 아이템 목록 보기 [1]', ico: 'listview' });
  const fullBtn = button('전체화면', () => app.classList.toggle('full-screen'), { cls: 'btn-full', label: '전체 화면', ico: 'expand' });
  const prevTab = el('div', { class: 'cl-tabfolder-prev' }, icon('left'));
  const nextTab = el('div', { class: 'cl-tabfolder-next' }, icon('right'));
  const tabs = new Map();   // name → {item, tab, panel}
  press(prevTab, () => { const k = [...tabs.keys()]; selectTab(k[Math.max(0, k.indexOf(active) - 1)]); });
  press(nextTab, () => { const k = [...tabs.keys()]; selectTab(k[Math.min(k.length - 1, k.indexOf(active) + 1)]); });
  const folder = el('div', { class: 'cl-control cl-tabfolder cl-mdifolder tab-content', id: 'uuid-cf', 'data-ndid': 'cf' },
    el('div', { class: 'content' }, tabbody,
      el('div', { class: 'cl-bottom cl-tabfolder-header cl-unselectable content' }, el('div', { class: 'content tl-wrap' }, tablist), prevTab, nextTab,
        el('div', { class: 'cl-control cl-container tab-utils', id: uid() },
          button('탭 아이템 전체 닫기', () => [...tabs.keys()].forEach(closeTab), { iconOnly: true, ico: 'closeall', cls: 'btn-tu' }),
          button('활성 및 고정 탭 아이템 이외 전체 닫기', () => [...tabs.keys()].filter((n) => n !== active).forEach(closeTab), { iconOnly: true, ico: 'close', cls: 'btn-tu' }),
          listBtn, fullBtn))));
  app.append(header, el('div', { class: 'main' }, aside, lnb, folder));
  let active = null;
  function addTab(name, title, closable = true) {
    const key = uid().slice(5);
    const tab = el('div', { class: 'cl-text', role: 'tab', id: `pt-cf/th-${key}`, tabindex: 0 }, closable ? icon('doc', 'tab-ico') : null, name);
    const item = el('div', { class: 'cl-tabfolder-item cl-unselectable' + (closable ? ' type-B' : ' unable-to-close cl-first'), title }, tab);
    if (closable) item.append(button('닫기', (ev) => { ev.stopPropagation(); closeTab(name); }, { cls: 'tab-close', iconOnly: true, ico: 'close' }));
    const panel = el('div', { class: 'content', role: 'tabpanel', id: `pt-cf/tb-${key}`, 'aria-labelledby': `pt-cf/th-${key}`, tabindex: -1 },
      el('div', { class: 'cl-control cl-embeddedapp', id: uid() }));
    press(tab, () => selectTab(name));
    tablist.append(item);
    tabbody.append(panel);
    tabs.set(name, { item, tab, panel });
    selectTab(name);
    return panel.firstChild;
  }
  function selectTab(name) {
    active = name;
    for (const [n, t] of tabs) {
      const on = n === name;
      t.item.classList.toggle('cl-selected', on);
      t.panel.style.display = on ? '' : 'none';
      if (on) { t.tab.setAttribute('aria-label', `선택됨, ${n}`); t.tab.setAttribute('aria-controls', t.panel.id); }
      else { t.tab.removeAttribute('aria-label'); t.tab.removeAttribute('aria-controls'); }
    }
    listBtn.setAttribute('aria-label', `탭 아이템 목록 보기 [${tabs.size - 1}]`);
    listBtn.dataset.count = String(tabs.size - 1);
  }
  function closeTab(name) {
    if (name === '초기화면') return;
    const t = tabs.get(name);
    if (!t) return;
    t.item.remove(); t.panel.remove(); tabs.delete(name);
    if (active === name) selectTab([...tabs.keys()].pop());
    else selectTab(active);
  }
  function tabMenu() {
    dialog('탭 아이템 목록', (b, close) => {
      b.append(el('div', { class: 'tab-menu' }, [...tabs.keys()].map((n) => button(n, () => { selectTab(n); close(); }, { cls: 'btn-outline' }))));
    }, { width: 360 });
  }

  // ── 초기화면: 월간일정 · 학교일지/전달사항 · 업무요청내역 ──
  const home = addTab('초기화면', '초기화면', false);
  home.append(homeScreen());
  function homeScreen() {
    const EV = { 3: '개천절', 5: '대체공휴일', 9: '한글날', 10: '토요휴업일', 13: '2학기 중간시험', 14: '2학기 중간시험', 15: '2학기 중간시험',
      16: '2학기 중간시험', 17: '토요휴업일', 24: '토요휴업일', 31: '토요휴업일' };
    const cal = el('div', { class: 'month-cal' }, ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'].map((d, i) =>
      el('div', { class: 'mc-head' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: d })));
    const first = new Date('2026-10-01T00:00').getDay();
    for (let i = 0; i < 35; i++) {
      const day = i - first + 1, inMonth = day >= 1 && day <= 31;
      const d = inMonth ? day : day < 1 ? 30 + day : day - 31;
      const wd = i % 7;
      cal.append(el('div', { class: 'mc-day' + (inMonth ? '' : ' other') + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + (inMonth && day === 11 ? ' today' : '') },
        el('div', { class: 'mc-num', text: String(d) }), inMonth && EV[day] ? el('div', { class: 'mc-ev', text: `· ${EV[day]} ①②③` }) : null));
    }
    const notice = grid('학교일지/전달사항', [{ name: '순번', width: 56 }, '제목', { name: '날짜', width: 110 }], { height: 290 });
    notice.setRows([{ 순번: 1, 제목: '2학기 중간시험 감독 배정 안내(연습용)', 날짜: '2026-10-08' }, { 순번: 2, 제목: '학년말 업무분장 희망 조사(연습용)', 날짜: '2026-10-06' }]);
    const req = grid('업무요청내역', [{ name: '업무', width: 70 }, '요청내용', { name: '날짜', width: 100 }], { height: 260 });
    return el('div', { class: 'home' },
      el('div', { class: 'home-left' },
        el('div', { class: 'sec-head' }, el('div', { class: 'cl-control cl-output app-tit' }, el('h2', { class: 'cl-text', text: '월간일정' }))),
        el('div', { class: 'cal-bar' }, button('지난달', () => {}, { iconOnly: true, ico: 'left', cls: 'btn-plain' }), output('2026년 10월', { cls: 'cal-title' }),
          button('다음달', () => {}, { iconOnly: true, ico: 'right', cls: 'btn-plain' }), el('div', { class: 'cal-legend' }, output('· 학사일정'), output('· 기타일정'))),
        cal),
      el('div', { class: 'home-right' },
        el('div', { class: 'sec-head' }, el('div', { class: 'cl-control cl-output app-tit' }, el('h2', { class: 'cl-text', text: '학교일지/전달사항' })),
          inputbox('학교일지 검색어', '', { cls: 'w-120' }), button('조회', () => {}, { cls: 'btn-primary btn-i-search', ico: 'search' }),
          combo('연도', ['2026년', '2025년'], '2026년')),
        notice,
        el('div', { class: 'sec-head' }, el('div', { class: 'cl-control cl-output app-tit' }, el('h2', { class: 'cl-text', text: '업무요청내역' }))),
        req));
  }

  // ── open a screen ─────────────────────────────────────────────────────────
  async function openScreen(name, title, code) {
    closeMega();
    if (code) {
      document.querySelectorAll('.cl-sidenavigation-item.cl-selected').forEach((x) => x.classList.remove('cl-selected'));
      const a = sideAnchors.get(code);
      if (a) { a.classList.add('cl-selected'); a.closest('[role=listitem]')?.parentElement?.previousElementSibling?.classList?.add('cl-selected'); }
    }
    if (tabs.has(name)) {
      selectTab(name);
      // 정식 나이스처럼: 이미 열린 화면을 메뉴로 다시 열면 조금 뒤에 화면을 초기화한다
      // (이전 조회 결과가 잠깐 보였다가 비워짐, 2026-11-24 정식 나이스 로그)
      const t = tabs.get(name);
      const host = t.panel.firstChild;
      setTimeout(async () => {
        busy(true, t.panel);
        const res = await api('screen.do', { name });
        await new Promise((r) => setTimeout(r, 300));
        busy(false, t.panel);
        host.textContent = '';
        if (FLOWS[name]) FLOWS[name](host, res.screen, res); else genericScreen(host, res.screen, res);
      }, 700);
      return;
    }
    if (tabs.size > 10) return alert('화면은 최대 10개까지 열 수 있습니다. 사용하지 않는 화면을 닫으세요.');
    const host = addTab(name, title || name);
    host.dataset.path = title || name;
    busy(true, host.parentElement);
    await api('menuCheckAuth.do', { menu: name });
    if (BOXES[name]) { busy(false, host.parentElement); return BOXES[name](host); }
    const res = await api('screen.do', { name });
    busy(false, host.parentElement);
    if (res.error) {
      host.append(el('div', { class: 'screen' }, appHead(name), el('p', { class: 'note', text: '이 화면은 수집 자료에 구조가 없어 연습장에 없습니다.' })));
      return;
    }
    if (res.needs_otp) {
      const ok = await otp();
      if (!ok) return closeTab(name);
    }
    if (FLOWS[name]) FLOWS[name](host, res.screen, res);
    else genericScreen(host, res.screen, res);
  }
  async function otp() {
    return new Promise((resolve) => {
      const d = dialog('2차인증', (b, close) => {
        const code = inputbox('인증번호');
        b.append(el('p', { class: 'note', text: '개인정보 보호를 위해 2차인증이 필요합니다. 등록한 인증수단의 번호 6자리를 입력하세요. (연습용 번호: 000000)' }),
          el('div', { class: 'form-line' }, label('인증번호'), code),
          el('div', { class: 'btn-row' }, button('인증', async () => {
            const r = await api('otp.do', { code: code.value() });
            if (r.ok) close(true); else alert(r.message);
          }, { cls: 'btn-primary' }), button('취소', () => close(false), { cls: 'btn-outline' })));
      }, { width: 460 });
      d.addEventListener('closed', (ev) => resolve(!!ev.detail));
    });
  }

  // ── screen building blocks ────────────────────────────────────────────────
  const OPTIONS = (name) => {
    if (/학년도|년도/.test(name)) return ['2026', '2025', '2024'];
    if (/학기/.test(name)) return ['1학기', '2학기'];
    if (/^학년$/.test(name)) return ['1', '2', '3'];
    if (/^반$/.test(name)) return ['1', '2', '3', '4', '5', '6', '7', '8'];
    if (/과정/.test(name)) return ['주간', '야간'];
    if (/과목|교과/.test(name)) return ['공통수학2 1학년 1-5', '공통수학2 1학년 1-6', '확률과 통계 2학년 2-1'];
    if (/상태/.test(name)) return ['전체', '저장', '상신', '결재완료', '반려'];
    if (/월/.test(name)) return ['10월', '9월', '11월'];
    return ['전체', `${name} 1`, `${name} 2`];
  };
  // title row: h1 · (right) 위치 버튼 "⌂ ...화면명" · [A A] · 도움말 … 즐겨찾기 · 축소 · [조회숨김]
  function appHead(title, { path, fontBtns = false, hideSearch = false } = {}) {
    const crumb = button(`...${title}`, () => alert(`메뉴 위치: ${path || title}`), { cls: 'btn-outline crumb', ico: 'home', title: path || title });
    const head = el('div', { class: 'app-head' },
      el('div', { class: 'cl-control cl-output app-tit', title }, el('h1', { class: 'cl-text cl-ellipsis', text: title })),
      el('div', { class: 'app-utils' },
        crumb,
        ...(fontBtns ? [button('A', (ev) => fontStep(ev, 1), { cls: 'btn-outline btn-a', title: '글자 크게' }),
          button('A', (ev) => fontStep(ev, -1), { cls: 'btn-outline btn-a small-a', title: '글자 작게' })] : []),
        ...[['도움말', 'question'], ['질의응답', 'chat'], ['FAQ', 'doc'], ['연락처', 'call'], ['온라인컨텐츠', 'video']].map(([n, i]) =>
          button(n, () => alert(`${n}: 연습용 환경에서는 열리지 않습니다.`), { iconOnly: true, ico: i, cls: 'btn-ut' })),
        button('즐겨찾기', null, { iconOnly: true, ico: 'star', cls: 'btn-ut', disabled: true }),
        button('축소', (ev) => ev.currentTarget.closest('.screen')?.classList.toggle('folded'), { cls: 'app-hd-fold', title: '스탭퍼, 조회조건, 지시문 영역 축소' }),
        ...(hideSearch ? [button('조회숨김', (ev) => {
          const sb = ev.currentTarget.closest('.screen')?.querySelector('.search-box');
          if (sb) sb.hidden = !sb.hidden;
        }, { cls: 'btn-outline btn-hide-search' })] : [])));
    return head;
  }
  function fontStep(ev, d) {
    const scr = ev.currentTarget.closest('.screen');
    const cur = parseFloat(scr.style.fontSize || '13');
    scr.style.fontSize = Math.max(11, Math.min(17, cur + d)) + 'px';
  }
  function frame(host, sc, title, opts = {}) {
    const root = el('div', { class: 'cl-control cl-container screen neis-emb-base', 'data-screen': sc.name });
    root.append(appHead(title || sc.name, { path: host.dataset.path, ...opts }));
    host.append(root);
    return root;
  }
  const field = (lab, ctl) => el('div', { class: 'field', 'data-role': 'nowrap-container' }, lab, ctl);
  function searchBox(fields, onSearch) {
    const box = el('div', { class: 'cl-control cl-container search-box', id: uid() });
    const ctl = {};
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const r = radios(run[0] + '/' + run.slice(1).join('/'), run, run[0]);
      box.append(field(null, r));
      run.forEach((n) => { ctl[n] = r; });
      run = [];
    };
    fields.forEach((f) => {
      if (f.role === 'radio') { run.push(f.name); return; }
      flush();
      if (NOISE.test(f.name)) return;
      let c;
      if (f.role === 'combobox') c = combo(f.name, f.options || OPTIONS(f.name), f.value);
      else if (f.role === 'checkbox') c = checkbox(f.name);
      else if (f.role === 'date' || f.role === 'month') c = dateinput(f.name, f.value || '', { month: f.role === 'month', required: f.required });
      else c = inputbox(f.name, f.value || '');
      ctl[f.name] = c;
      box.append(field(f.role === 'checkbox' ? null : label(f.name, { required: f.required }), c));
    });
    flush();
    box.append(el('div', { class: 'search-btn' }, button('조회', onSearch, { cls: 'btn-primary btn-i-search', ico: 'search' })));
    box.ctl = ctl;
    box.values = () => Object.fromEntries(Object.entries(ctl).map(([k, c]) => [k, c.value()]));
    return box;
  }
  // grid title row: h3 + Total N + filter(gear) on the left, the screen's buttons on the right
  function gridHead(title, g, ...btns) {
    const total = el('div', { class: 'cl-control cl-output total' }, el('div', { class: 'cl-text' }, 'Total ', el('span', { class: 'fw-medium', text: '0' })));
    const upd = () => { total.querySelector('span').textContent = String(g.rows().length); };
    g.addEventListener('rows', upd);
    return el('div', { class: 'grid-head' },
      el('div', { class: 'cl-control cl-output h3', 'aria-label': title }, el('h3', { class: 'cl-text', text: title })), total,
      button(`${title}  필터 등`, () => alert('필터는 연습장에서 지원하지 않습니다.'), { iconOnly: true, ico: 'gear', cls: 'btn-i-setting' }),
      el('div', { class: 'grid-btns' }, ...btns));
  }
  const btnFor = (b, fn) => {
    const m = b.name.match(/^(.*)\((새 창 열기|새 창 열림)\)$/);
    return button(m ? m[1] : b.name, fn, { cls: b.danger === 'high' ? 'btn-secondary' : 'btn-outline', label: m ? b.name : null });
  };

  // sub tabs (학생부자료기록 / 누가기록 …): tab header only, onSelect(name, index)
  function subTabs(names, onSelect, cls = '') {
    const st = el('div', { class: `cl-control cl-tabfolder sub-tabs ${cls}`.trim(), id: uid() });
    const tl = el('div', { class: 'cl-tabfolder-header-viewport', role: 'tablist' });
    const k = uid().slice(5);
    names.forEach((t, i) => {
      const tab = el('div', { class: 'cl-text', role: 'tab', id: `pt-${k}/th-${i}`, tabindex: 0, text: t });
      const sel = (fire = true) => {
        tl.querySelectorAll('[role=tab]').forEach((x) => {
          const on = x === tab;
          on ? x.setAttribute('aria-label', `선택됨, ${x.textContent}`) : x.removeAttribute('aria-label');
          x.parentElement.classList.toggle('cl-selected', on);
        });
        if (fire && onSelect) onSelect(t, i);
      };
      press(tab, () => sel());
      tl.append(el('div', { class: 'cl-tabfolder-item' }, tab));
      if (!i) setTimeout(() => sel(false));
    });
    st.append(tl);
    return st;
  }

  // ── generated screen (any captured screen) ────────────────────────────────
  function genericScreen(host, sc) {
    const root = frame(host, sc, null, { hideSearch: sc.buttons.some((b) => b.name === '조회숨김') });
    const grids = sc.grids.filter((g) => g.columns.length).map((g) => ({ g, node: grid(g.label || sc.name + ' 목록', g.columns, { select: g.columns[0] === '선택', height: 300 }) }));
    const search = searchBox(sc.fields, async () => {
      busy(true, root);
      const r = await api('search.do', { screen: sc.name, conditions: search.values() });
      busy(false, root);
      r.grids.forEach((rg, i) => grids[i] && grids[i].node.setRows(rg.rows.map((row) => Object.fromEntries(grids[i].g.columns.map((c, j) => [c, row[j]])))));
    });
    const acts = sc.buttons.filter((b) => !NOISE.test(b.name)).map((b) => btnFor(b, async () => {
      if (b.danger === 'high' && !(await confirm(`${b.name.replace(/\(.*\)$/, '')}하시겠습니까?`))) return;
      const sel = grids[0] ? grids[0].node.selected().length : 0;
      const r = await api('action.do', { screen: sc.name, button: b.name, selected: sel });
      alert(r.message || r.error);
    }));
    root.append(search);
    if (sc.subtabs.length) root.append(subTabs(sc.subtabs));
    if (!grids.length && acts.length) root.append(el('div', { class: 'grid-head' }, el('div', { class: 'grid-btns' }, ...acts)));
    grids.forEach(({ g, node }, i) => root.append(gridHead(g.label || '', node, ...(i === 0 ? acts : [])), node));
  }

  // ── 승인사항 boxes (상신함 …) ─────────────────────────────────────────────
  const BOXES = {
    async 상신함(host) {
      const root = frame(host, { name: '상신함' }, '상신함');
      const g = grid('상신문서목록', [{ name: '순번', width: 56 }, '결재문서명', { name: '상신일자', width: 120 }, { name: '결재상태', width: 100 }, { name: '결재자', width: 120 }], { height: 380 });
      const load = async () => {
        const r = await api('approval_box.do', { box: '상신함' });
        g.setRows(r.docs.map((d, i) => ({ 순번: i + 1, 결재문서명: d.title, 상신일자: d.date, 결재상태: d.status, 결재자: d.approver })));
      };
      root.append(searchBox([{ role: 'month', name: '상신년월', value: '2026-10' }], load), gridHead('상신문서목록', g), g);
      load();
    },
  };
  ['미결/협조함', '공람함', '예결함', '기결함', '반려함', '메시지함'].forEach((n) => {
    BOXES[n] = (host) => {
      const root = frame(host, { name: n }, n);
      const g = grid(`${n} 목록`, [{ name: '순번', width: 56 }, '결재문서명', { name: '기안자', width: 120 }, { name: '일자', width: 120 }], { height: 380 });
      root.append(gridHead(`${n} 목록`, g), g);
    };
  });

  // ── working flows ─────────────────────────────────────────────────────────
  const pad = (n) => String(n).padStart(2, '0');
  const isHoliday = (d) => { const w = new Date(d + 'T00:00').getDay(); return w === 0 || w === 6 || ['2026-10-03', '2026-10-05', '2026-10-09'].includes(d); };
  const minsOf = (h, m) => Number(h) * 60 + Number(m);
  const hm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  const NOTES = ['※ 휴일에 체크하는 경우 초과근무 전일 18시 이전에 올려야 사전신청으로 인정됩니다.',
    '※ 법정공휴일이 유연근무신청일자에 포함될 경우 반드시 휴일 체크를 하신뒤 시간 선택을 하시기 바랍니다.',
    '※ 초과근무 시간은 최대 57시간까지 인정되며, 월별 연가전환 합계 시간 중 1시간 미만은 절사됩니다.',
    '※ 초과근무 연가전환은 1일 1회 신청가능합니다.'];
  const formTable = (rows, cls = '') => el('div', { class: `form-table ${cls}`.trim() }, rows.map((cells) => el('div', { class: 'ft-row' },
    cells.flatMap(([lab, ctl, opt = {}]) => [el('div', { class: 'ft-th' + (opt.required ? ' require' : '') }, label(lab, { required: opt.required })),
      el('div', { class: 'ft-td' + (opt.wide ? ' wide' : '') }, ...[].concat(ctl))]))));

  function approverPicker(onPick, staff) {
    dialog('결재자지정', (b, close) => {
      const q = inputbox('성명');
      const g = grid('결재자목록', [{ name: '성명', width: 110 }, '직위', '조직명'], { select: true, height: 240 });
      const fill = () => g.setRows(staff.filter((s) => !q.value() || s.name.includes(q.value())).map((s) => ({ 성명: s.name, 직위: s.pos, 조직명: s.org })));
      fill();
      b.append(el('div', { class: 'search-box' }, field(label('성명'), q), el('div', { class: 'search-btn' }, button('조회', fill, { cls: 'btn-primary btn-i-search', ico: 'search' }))),
        gridHead('결재자목록', g), g,
        el('div', { class: 'btn-row' }, button('확인', () => {
          const s = g.selected();
          if (!s.length) return alert('결재자를 선택하십시오.');
          onPick(s.map((x) => staff.find((t) => t.name === x['성명']))); close(true);
        }, { cls: 'btn-primary' }), button('닫기', () => close(false), { cls: 'btn-outline' })));
    }, { width: 600 });
  }

  // 기안문서상신 (approval request popup): opened by 승인요청 with the request rows.
  function draftPopup(rows, res, onDone) {
    dialog('기안문서상신', (b, close) => {
      const line = [{ 결재순서: 0, 구분: '기안', 위임구분: '', 사용자ID: ME.id, 사용자명: ME.name, 직위: ME.pos, 조직명: ME.school, 비고: '' }];
      const title = inputbox('결재문서명', rows.length ? `개인초과근무신청(${rows.map((r) => r.date).join(', ')})` : '');
      const approver = inputbox('결재자', '', { placeholder: '' });
      const content = textarea('내용', '', { placeholder: '1000자까지 입력 가능합니다.' });
      const kind = radios('결재구분', ['결재', '검토', '협조', '공람'], '결재');
      const lg = grid('결재선', [{ name: '결재순서', width: 70 }, { name: '구분', width: 60 }, { name: '위임구분', width: 70 }, '사용자ID', '사용자명', '직위', '조직명', '비고'],
        { select: true, height: 150 });
      const redraw = () => { lg.setRows(line.map((x, i) => ({ ...x, 결재순서: i }))); approver.set(line.slice(1).map((x) => x.사용자명).join(', ')); };
      redraw();
      const add = (people) => { people.forEach((p) => { if (!line.some((x) => x.사용자명 === p.name)) line.push({ 구분: kind.value(), 위임구분: '', 사용자ID: p.id, 사용자명: p.name, 직위: p.pos, 조직명: p.org, 비고: '' }); }); redraw(); };
      const move = (fn) => { const i = lg.checkedIdx().filter((x) => x > 0); if (!i.length) return alert('이동할 결재자를 선택하십시오.'); fn(i[0]); redraw(); };
      const swap = (a, c) => { if (a < 1 || c < 1 || a >= line.length || c >= line.length) return; [line[a], line[c]] = [line[c], line[a]]; };
      const submit = button('상신', async () => {
        if (line.length < 2) return alert('결재자를 지정하십시오.');
        if (!title.value()) return alert('결재문서명은(는) 필수 입력 항목입니다.');
        if (!(await confirm('상신하시겠습니까?'))) return;
        const r = await api('srv_mym_mm02_002.do', { rows, title: title.value(), content: content.value(), line: line.slice(1).map((x) => ({ name: x.사용자명, kind: x.구분 })) });
        if (r.error) return alert(r.error);
        await alert(r.message);
        close(true); onDone && onDone();
      }, { cls: 'btn-primary', disabled: true });
      const body = el('div', { class: 'draft-body' });
      if (rows.length) {
        body.append(el('div', { class: 'draft-table' },
          el('div', { class: 'dt-row dt-head' }, ['순번', '초과근무일자', '신청당시 부서', '성명', '종별', '휴일', '시작', '종료', '방과후수업 차감', '사유'].map((h) => el('div', { text: h }))),
          rows.map((r, i) => el('div', { class: 'dt-row' }, [i + 1, r.date, '교무부', ME.name, r.kind, r.holiday ? 'Y' : 'N', r.start, r.end, r.after || '00:00', r.task].map((v) => el('div', { text: String(v) }))))));
      } else {
        body.append(el('div', { class: 'draft-error', text: '상신화면을 팝업을 띄운 업무화면에서 설정오류가 발생하였습니다\n(업무승인 메뉴가 아닌, 기안문상신 화면을 팝업을 호출한 업무)\n아래 내용을 업무화면 담당자에게 문의하세요\n   항목 : doReadyUnitWrk 파라메터 단위업무 데이터셋 규약\n   파라메터 poParams.dataset.getRowCount()는 0건 입니다' }));
      }
      b.append(
        el('div', { class: 'app-head in-dialog' }, el('div', { class: 'cl-control cl-output app-tit' }, el('h1', { class: 'cl-text', text: '기안문서상신' })),
          el('div', { class: 'app-utils' }, button('화면 확대', () => {}, { iconOnly: true, ico: 'expand', cls: 'btn-ut' }), button('화면 축소', () => {}, { iconOnly: true, ico: 'shrink', cls: 'btn-ut' }))),
        el('div', { class: 'draft-top' }, output('* 화면 하단의 기안내용이 정상적으로 초기화하면 상신 버튼이 활성화 됩니다.', { cls: 'hint' }), submit,
          button('취소', () => close(false), { cls: 'btn-outline' })),
        el('div', { class: 'cl-control cl-output h3' }, el('h3', { class: 'cl-text', text: '기안문서' })),
        formTable([
          [['결재문서명', title, { wide: true }]],
          [['결재자', [approver, button('개인결재선', () => personalLine(add, res.staff), { cls: 'btn-primary' }),
            button('결재자지정', () => approverPicker(add, res.staff), { cls: 'btn-primary' })], { wide: true }]],
          [['내용', content, { wide: true }]],
          [['결재선', [el('div', { class: 'line-tools' }, kind,
            button('영결', () => alert('영결은 연습장에서 지원하지 않습니다.'), { cls: 'btn-outline btn-sm' }), button('영결해제', () => {}, { cls: 'btn-outline btn-sm' }),
            button('최상단', () => move((i) => { const x = line.splice(i, 1)[0]; line.splice(1, 0, x); }), { cls: 'btn-outline btn-sm' }),
            button('위', () => move((i) => swap(i, i - 1)), { cls: 'btn-outline btn-sm' }), button('아래', () => move((i) => swap(i, i + 1)), { cls: 'btn-outline btn-sm' }),
            button('최하단', () => move((i) => { const x = line.splice(i, 1)[0]; line.push(x); }), { cls: 'btn-outline btn-sm' }),
            button('삭제', () => { const i = lg.checkedIdx().filter((x) => x > 0).reverse(); i.forEach((k) => line.splice(k, 1)); redraw(); }, { cls: 'btn-outline btn-sm' })), lg], { wide: true }]],
        ], 'draft-form'),
        el('div', { class: 'cl-control cl-output h3' }, el('h3', { class: 'cl-text', text: '기안내용' })), body);
      // the content area "initializes"; only then 상신 is enabled (or the setup error shows)
      setTimeout(() => {
        if (rows.length) submit.setDisabled(false);
        else error('상신화면을 팝업을 띄운 업무화면에서 설정오류가 발생하였습니다\n(업무승인 메뉴가 아닌, 기안문상신 화면을 팝업을 호출한 업무)\n아래 내용을 업무화면 담당자에게 문의하세요\n   항목 : doReadyUnitWrk 파라메터 단위업무 데이터셋 규약\n   파라메터 poParams.dataset.getRowCount()는 0건 입니다');
      }, 700);
    }, { width: 1000 });
  }
  function personalLine(add, staff) {
    dialog('개인결재선', (b, close) => {
      const g = grid('개인결재선목록', [{ name: '순번', width: 56 }, '결재선명', '결재자'], { select: true, height: 160 });
      const lines = [{ name: '기본결재선', who: staff.filter((s) => /교감|교장/.test(s.pos)) }];
      g.setRows(lines.map((l, i) => ({ 순번: i + 1, 결재선명: l.name, 결재자: l.who.map((w) => `${w.name}(${w.pos})`).join(' → ') })));
      b.append(gridHead('개인결재선목록', g), g, el('div', { class: 'btn-row' }, button('적용', () => {
        const s = g.selected(); if (!s.length) return alert('결재선을 선택하십시오.');
        add(lines[0].who); close(true);
      }, { cls: 'btn-primary' }), button('닫기', () => close(false), { cls: 'btn-outline' })));
    }, { width: 560 });
  }

  // ── 학생부 기록 화면 (세특 · 독서 · 행특 · 창체 · 진로희망 …) ─────────────────
  // Built from the 2026-10-11 captures (행동특성및종합의견, 과목별독서활동, 과목별세부능력및특기사항 …).
  // The captured grids were empty, so the cell editor is the usual eXbuilder one: a textarea inside the cell,
  // a live counter column (NEIS byte rule: 한글 3 · 영문/숫자/공백 1 · 줄바꿈 2), 저장 sends only changed rows.
  const BYTES = (t) => [...String(t)].reduce((n, ch) => n + (ch === '\n' ? 2 : ch.charCodeAt(0) > 127 ? 3 : 1), 0);
  const NONE = '-없음-';
  const SUBJECTS = [NONE, '확률과 통계', '미적분', '기하', '수학Ⅰ'];
  const ROOMS = [NONE, '3-1', '3-2', '3-3', '2-1'];
  const BY_CLASS = [['학년도', ['2026', '2025'], '2026'], ['학년', [NONE, '1', '2', '3'], NONE], ['반', [NONE, '1', '2', '3', '4', '5', '6', '7', '8'], NONE]];
  const BY_SUBJECT = [['학년도', ['2026', '2025'], '2026'], ['학기', ['1학기', '2학기'], '2학기'], ['학년', [NONE, '1', '2', '3'], NONE],
    ['과목', SUBJECTS, NONE], ['강의실', ROOMS, NONE]];
  // 과세특 조회조건: 2026-11-23 정식 나이스 수집 (화면을 열면 이미 골라져 있음). N8 시나리오용 선택지(3 · 확률과 통계 · 3-1)도 남겨 둔다.
  const BY_SUBJECT_REAL = [['학년도', ['2026', '2025'], '2026'], ['학기', ['1학기', '2학기'], '2학기'], ['과정', ['주간'], '주간'],
    ['계열/학년/학과', [NONE, '1', '2', '3'], '1'], ['과목', [NONE, '공통수학2(4)', '실용 수학(4)', '확률과 통계'], '공통수학2(4)'],
    ['강의실', [NONE, '5', '6', '2', '3-1'], '5']];
  const CREATIVE = (extra = []) => ({
    by: 'class', onoff: true, subtabs: ['학생부자료기록', '누가기록'], text: '특기사항', limit: 1500, unit: 'byte',
    cols: [['번호', 56], ['성명', 90], ['학생부 이수시간', 90, 'input'], ['누가기록 이수시간 합계', 110], ['특기사항', 0, 'textarea'], ...extra, ['글자수', 96, 'count'], ['위탁/공동', 70]],
    btns: ['이수시간반영', '입력창축소', '입력창확대', '저장', '삭제', '출력'],
  });
  const RECORD = {
    // 2026-11-23 정식 나이스 수집에 맞춤: 보이는 4행만 그리고 옆의 .cl-scrollbar 로 스크롤, 칸을 눌러야 입력칸이 생김,
    // data-cellindex 7·8·9·10·11·13 (+숨은 16·17), 칸 aria 이름 반/번호·성명·학적변동·구분·세특(Byte)·마지막(본문)
    과목별세부능력및특기사항: { by: 'subject', conds: BY_SUBJECT_REAL, text: '세부능력 및 특기사항', limit: 1500, unit: 'byte', fontBtns: true, hideSearch: true,
      title: '과목별 세부능력 및 특기사항', gridLabel: '과목별 세부능력 및 특기사항 그리드',
      grid: { scrollbar: true, height: 508, rowHeight: 117 },
      cols: [['반/번호', 80, null, { idx: 7 }], ['성명', 90, null, { idx: 8 }], ['학적변동\n구분', 90, null, { idx: 9, aria: '학적변동' }],
        ['구분', 70, null, { idx: 10 }], ['입력가능글자\n(Byte)', 110, 'count', { idx: 11, aria: '세특' }],
        ['세부능력 및 특기사항', 0, 'textarea', { idx: 13, aria: '마지막' }],
        ['구분2', 0, null, { idx: 16, aria: '구분', hidden: true }], ['영재기록', 0, null, { idx: 17, hidden: true }]],
      excelGrid: { label: '과목별 세부능력 및 특기사항 엑셀다운로드 그리드',
        cols: ['학년도', '학기', '학년', '학생개인번호', '과목', '과목코드', '반/번호', '성명', '학적변동\n구분', '세부능력 및 특기사항', '영재·발명교육 기록사항'] },
      btns: ['셀 크기 상하로 확대', '셀 크기 상하로 축소', '엑셀내려받기', '엑셀업로드', '저장', '삭제'] },
    // 초등 학급담임 교과 세특: 학급담임 › 성적 › 학생평가 › 학기말종합의견 (2026-11-26 정식 나이스 로그).
    // 정식 나이스처럼 학년·반·교과(목) 조회조건의 aria-label 이 모두 '학기, 값' 으로 잘못 붙어 있다 (보이는 글자는 맞음).
    학기말종합의견: { by: 'elem', conds: [['학년도', ['2026', '2025'], '2026'], ['학기', ['1', '2'], '2'], ['학년', [NONE, '1', '2', '3', '4', '5', '6'], '6'],
        ['반', [NONE, '1', '2', '3', '4', '5'], '1'], ['교과(목)', ['국어', '사회', '수학', '과학', '영어', '도덕', '실과', '체육', '음악', '미술'], '국어']],
      ariaNames: { 학년: '학기', 반: '학기', '교과(목)': '학기' },
      text: '학기말 종합의견', limit: 1500, unit: 'byte', hideSearch: true, title: '학기말종합의견', gridLabel: '학기말종합의견 그리드',
      grid: { scrollbar: true, height: 508, rowHeight: 117 },
      cols: [['반/번호', 80, null, { aria: '번호' }], ['성명', 90], ['참고자료', 90, null, { aria: '조회/가져오기' }], ['학기말 종합의견', 0, 'textarea', { aria: '마지막' }]],
      btns: ['학생/학부모서비스 일괄반영', '관찰내용일괄복사', '교과평가일괄복사', '저장', '삭제'] },
    과목별독서활동: { by: 'subject', text: '독서활동상황', limit: 1500, unit: 'byte', fontBtns: true, hideSearch: true, title: '',
      cols: [['반/번호', 80], ['성명', 90], ['학적변동구분', 90], ['입력가능글자 (Byte)', 110, 'count'], ['독서활동상황', 0, 'textarea']],
      btns: ['입력창확대', '입력창축소', '일괄입력', '저장', '삭제', '출력'] },
    행동특성및종합의견: { by: 'class', onoff: true, subtabs: ['학생부자료기록', '누가기록'], text: '행동특성 및 종합의견', limit: 500, unit: 'char',
      title: '행동특성 및 종합의견 - 학교생활기록부 반영기록',
      cols: [['번호', 60], ['성명', 100], ['행동특성 및 종합의견', 0, 'textarea'], ['글자수', 96, 'count'], ['위탁', 70]],
      btns: ['입력창축소', '입력창확대', '저장', '삭제', '일괄적용', '출력'] },
    독서활동상황기록: { by: 'class', semester: true, subtabs: ['반별', '개인별'], text: '독서활동상황', limit: 1500, unit: 'byte',
      title: '학교생활기록부 반영기록',
      cols: [['번호', 56], ['성명', 90], ['과목 또는 영역', 140, 'input'], ['독서활동상황', 0, 'textarea'], ['글자수 (1,2학기 통합)', 120, 'count']],
      btns: ['입력창축소', '입력창확대', '저장', '삭제', '위탁/공동 가져오기'] },
    진로희망사항기록: { by: 'class', text: '특기사항', limit: 1500, unit: 'byte', hideSearch: true, title: '진로희망사항기록',
      cols: [['상태', 60], ['번호', 56], ['성명', 90], ['특기 또는 흥미', 140, 'input'], ['진로희망 학생', 120, 'input'], ['진로희망 학부모', 120, 'input'], ['특기사항', 0, 'textarea'], ['글자수', 96, 'count']],
      btns: ['입력창축소', '입력창확대', '저장', '삭제', '출력'] },
    자율활동관리: { ...CREATIVE(), title: '자율활동 학생부자료기록 목록' },
    진로활동관리: { ...CREATIVE([['희망분야', 120, 'input']]), title: '진로활동 학생부자료 테이블' },
    '동아리활동관리(담임용)': { by: 'class', subtabs: ['학생부자료', '이수시간계산내역', '누가기록'], text: '특기사항', limit: 1500, unit: 'byte',
      title: '학생부자료기록 목록',
      cols: [['번호', 56], ['성명', 90], ['학적변동', 70], ['동아리 부서구분', 110], ['부서명', 120], ['이수시간', 70], ['특기사항', 0, 'textarea'], ['글자수', 96, 'count']],
      btns: ['그리드 축소', '그리드 확대', '저장', '삭제', '위탁/공동'] },
  };
  const PM = { 입력창확대: ['+', 1], 입력창축소: ['−', -1], '셀 크기 상하로 확대': ['+', 1], '셀 크기 상하로 축소': ['−', -1], '그리드 확대': ['+', 1], '그리드 축소': ['−', -1] };

  function recordScreen(host, sc, res, cfg) {
    const root = frame(host, sc, sc.name, { fontBtns: cfg.fontBtns, hideSearch: cfg.hideSearch });
    const conds = cfg.conds || (cfg.by === 'subject' ? BY_SUBJECT : (cfg.semester ? [BY_CLASS[0], ['학기', ['1학기', '2학기'], '2학기'], ...BY_CLASS.slice(1)] : BY_CLASS));
    const ctl = {};
    let key = null, loaded = [];
    const textCols = cfg.cols.filter((c) => c[2] === 'textarea' || c[2] === 'input').map((c) => c[0]);
    const countCol = (cfg.cols.find((c) => c[2] === 'count') || [])[0];
    const size = (t) => (cfg.unit === 'byte' ? BYTES(t) : [...String(t)].length);
    const counter = (t) => `${size(t)}/${cfg.limit}`;

    // top line: sub tabs (left) · 누가기록 작성 ON/OFF (right)
    const recView = el('div', { class: 'rec-view' });
    const offView = el('div', { class: 'notice-off', hidden: true });
    if (cfg.subtabs || cfg.onoff) {
      root.append(el('div', { class: 'rec-top' },
        cfg.subtabs ? subTabs(cfg.subtabs, (t, i) => {
          recView.hidden = i !== 0; offView.hidden = i === 0;
          offView.textContent = `${t} 탭은 연습장에서 지원하지 않습니다. 첫 번째 탭(${cfg.subtabs[0]})에서 입력하세요.`;
        }, 'rec-tabs') : el('div'),
        cfg.onoff ? el('div', { class: 'rec-onoff' }, output('누가기록 작성'), radios('누가기록 작성', ['ON', 'OFF'], 'ON')) : null));
    }
    const box = el('div', { class: 'cl-control cl-container search-box', id: uid() });
    conds.forEach(([n, opts, v]) => {
      ctl[n] = combo(cfg.ariaNames?.[n] || n, opts, v);
      box.append(field(label(n, { required: true }), ctl[n]));
    });
    if (cfg.by === 'subject' && /세부능력/.test(sc.name)) box.append(field(null, checkbox('개별출력', false, { text: '개별출력' })));
    box.append(el('div', { class: 'search-btn' }, button('조회', () => load(), { cls: 'btn-primary btn-i-search', ico: 'search' })));

    const editors = Object.fromEntries(cfg.cols.filter((c) => c[2] === 'textarea' || c[2] === 'input').map((c) => [c[0], { kind: c[2] === 'textarea' ? 'textarea' : 'text' }]));
    const cols = cfg.cols.map(([name, w, kind, extra]) => ({ name, key: name, width: w || null, ...(extra || {}),
      align: kind === 'count' || /번호|구분|위탁|상태|이수시간|글자/.test(name) && kind !== 'input' ? 'center' : null }));
    const g = grid(cfg.gridLabel || cfg.title || `${sc.name} 목록`, cols, { select: true, editors, height: 540, rowHeight: 64, virtual: false, ...(cfg.grid || {}),
      emptyText: '데이터를 조회해 주십시오.',
      onEdit: (ri, k, v) => {
        if (k !== cfg.text || !countCol) return;
        g.setCell(ri, countCol, counter(v));
        const cell = g.querySelector(`[aria-rowindex="${ri + 2}"] [data-key="${CSS.escape(countCol)}"]`);
        if (cell) cell.classList.toggle('byte-over', size(v) > cfg.limit);
      } });

    let rowH = cfg.grid?.rowHeight || 64;
    const acts = cfg.btns.map((b) => {
      if (PM[b]) return button(PM[b][0], () => { rowH = Math.max(40, Math.min(220, rowH + PM[b][1] * 30)); g.setRowHeight(rowH); },
        { cls: 'btn-outline btn-pm', label: b, title: b });
      if (b === '저장') return button('저장', save, { cls: 'btn-primary need-data' });
      if (b === '삭제') return button('삭제', del, { cls: 'btn-navy need-data' });
      if (b === '일괄입력' || b === '일괄적용') return button(b, () => bulk(b), { cls: 'btn-primary need-data' });
      return button(b, () => alert(`${b}: 연습용 환경에서는 지원하지 않습니다.`), { cls: 'btn-primary' + (/출력|엑셀|가져오기|반영/.test(b) ? ' need-data' : '') });
    });
    const gate = (on) => acts.forEach((b) => b.classList.contains('need-data') && b.setDisabled(!on));
    gate(false);
    recView.append(gridHead(cfg.title, g, ...acts), g);
    if (cfg.excelGrid) {   // 정식 나이스에도 있는 숨은 엑셀 내려받기용 표 (입력 표와 헷갈리지 않는지 보기 위해 둔다)
      const xg = grid(cfg.excelGrid.label, cfg.excelGrid.cols, { select: true, height: 120 });
      xg.style.display = 'none';
      recView.append(xg);
    }
    root.append(box, recView, offView);

    const cond = () => Object.fromEntries(conds.map(([n]) => [n, ctl[n].value()]));
    async function load(keep = false) {
      const c = cond();
      const miss = conds.find(([n]) => c[n] === NONE);
      if (miss) return alert(`${miss[0]}을(를) 선택하십시오.`);
      const k = cfg.by === 'subject' ? `${c['학년도']}|${c['학기']}|${c['과목']}|${c['강의실']}`
        : cfg.by === 'elem' ? `${c['학년도']}|${c['학기']}|${c['학년']}|${c['반']}|${c['교과(목)']}`
        : `${c['학년도']}|${c['학년']}|${c['반']}` + (cfg.semester ? `|${c['학기']}` : '');
      busy(true, root);
      const r = await api('roster.do', { screen: sc.name, key: k, cond: c });
      busy(false, root);
      key = k;
      const ban = cfg.by === 'subject' ? (c['강의실'].includes('-') ? c['강의실'].split('-')[1] : c['강의실']) : c['반'];
      loaded = r.students.map((st) => {
        const row = {};
        cfg.cols.forEach(([n, , kind]) => {
          if (kind === 'textarea' || kind === 'input') row[n] = st.texts[n] || '';
          else if (n === '번호') row[n] = st.no;
          else if (n === '반/번호') row[n] = `${ban}/${st.no}`;
          else if (n === '성명') row[n] = st.name;
          else if (/학적변동/.test(n)) row[n] = st.change;
          else if (n === '구분') row[n] = '일반';
          else if (n === '상태') row[n] = st.texts[cfg.text] ? '저장' : '';
          else if (/이수시간/.test(n)) row[n] = n === '학생부 이수시간' ? '' : '12';
          else if (n === '동아리 부서구분') row[n] = '정규';
          else if (n === '부서명') row[n] = '수학탐구반';
          else row[n] = '';
        });
        if (countCol) row[countCol] = counter(row[cfg.text]);
        row._no = st.no;
        return row;
      });
      g.setRows(loaded, { keep });
      gate(true);
    }
    async function save() {
      const changes = {};
      g.edits().forEach(({ row, changes: ch }) => {
        const real = Object.fromEntries(Object.entries(ch).filter(([k2, v]) => textCols.includes(k2) && v !== row[k2]));
        if (Object.keys(real).length) changes[row._no] = real;
      });
      if (!Object.keys(changes).length) return alert('변경된 내용이 없습니다.');
      const over = Object.entries(changes).find(([, ch]) => ch[cfg.text] !== undefined && size(ch[cfg.text]) > cfg.limit);
      if (over) return error(`${over[0]}번 학생의 ${cfg.text}이(가) 입력 가능한 ${cfg.unit === 'byte' ? '바이트' : '글자 수'}(${cfg.limit})를 초과하였습니다.`);
      if (!(await confirm('저장하시겠습니까?'))) return;
      busy(true, root);
      const r = await api('record_save.do', { screen: sc.name, key, changes });
      busy(false, root);
      await alert(r.message || '저장되었습니다.');
      await load(true);
    }
    async function del() {
      const idx = g.checkedIdx();
      if (!idx.length) return alert('삭제할 학생을 선택하십시오.');
      if (!(await confirm(`선택한 ${idx.length}명의 ${cfg.text}을(를) 삭제하시겠습니까?`))) return;
      const r = await api('record_delete.do', { screen: sc.name, key, nos: idx.map((i) => g.rows()[i]._no) });
      await alert(r.message);
      await load();
    }
    function bulk(name) {
      const idx = g.checkedIdx();
      if (!idx.length) return alert(`${name}할 학생을 선택하십시오.`);
      dialog(name, (b, close) => {
        const t = textarea(`${cfg.text} ${name} 내용`, '');
        const cnt = output(`0/${cfg.limit}`);
        t.querySelector('textarea').addEventListener('input', (ev) => { cnt.firstChild.textContent = counter(ev.target.value); });
        b.append(el('p', { class: 'note', text: `선택한 ${idx.length}명에게 같은 내용을 넣습니다. 넣은 뒤 [저장]을 눌러야 반영됩니다.` }),
          el('div', { class: 'form-line' }, label(cfg.text), t), el('div', { class: 'form-line' }, label(cfg.unit === 'byte' ? '바이트' : '글자수'), cnt),
          el('div', { class: 'btn-row' }, button('적용', () => {
            const v = t.value();
            idx.forEach((i) => g.setEdit(i, cfg.text, v));
            close(true);
          }, { cls: 'btn-primary' }), button('취소', () => close(false), { cls: 'btn-outline' })));
      }, { width: 560 });
    }
  }

  const FLOWS = {
    // 개인초과근무관리 — title 개인초과근무신청. Mirrors the real screen captured on 2026-10-11:
    // 년월 search, 인적사항 table, totals, 초과근무목록 (two-level header), 신청 popup with 신청목록 + 상세, 승인요청 → 기안문서상신.
    '개인초과근무관리'(host, sc, res) {
      const root = frame(host, sc, '개인초과근무신청');
      const P = res.person;
      const ym = dateinput('년월', '2026-10', { month: true, required: true });
      const kind = combo('근무종별', ['전체', '시간외 근무', '휴일 근무'], '전체');
      const COLS = [{ name: '순번', key: '순번', width: 50 }, { name: '초과근무\n일자', key: '일자', link: true, width: 104 }, { name: '초과근무\n종별', key: '종별', width: 90 },
        { name: '시작시간', key: '신청시작', group: '초과근무 신청시간' }, { name: '종료시간', key: '신청종료', group: '초과근무 신청시간' }, { name: '시간합', key: '신청합', group: '초과근무 신청시간' },
        { name: '시작시간', key: '실제시작', group: '실제초과 근무시간' }, { name: '종료시간', key: '실제종료', group: '실제초과 근무시간' }, { name: '시간합', key: '실제합', group: '실제초과 근무시간' },
        { name: '하여야 할 일', key: '할일', width: 200 }, { name: '신청\n상태', key: '신청상태', width: 60 }, { name: '승인\n상태', key: '승인상태', width: 60 },
        { name: '결재\n상태', key: '결재상태', width: 60 }, { name: '삭제\n여부', key: '삭제여부', width: 60 }, { name: '대체\n휴무\n여부', key: '대체휴무', width: 52 }];
      const g1 = grid('초과근무목록', COLS, { select: true, height: 330, onLink: (r) => alert(`${r['일자']} 초과근무 신청 내역입니다. (연습용)\n하여야 할 일: ${r['할일']}`) });
      const g2 = grid('연장근로목록', (SCREENS['개인초과근무관리']?.grids?.[1]?.columns || ['선택', '순번']).filter((c) => c !== '선택'), { select: true, height: 140 });
      const tot1 = output('0시간 0분'), tot2 = output('0시간 0분');
      const load = async () => {
        busy(true, root);
        const r = await api('srv_mym_mm02_001.do', { ym: ym.value(), kind: kind.value() });
        busy(false, root);
        let sum = 0;
        g1.setRows(r.rows.map((o, i) => {
          const m = minsOf(...o.end.split(':')) - minsOf(...o.start.split(':'));
          if (o.sanction === '완결') sum += m;
          return { _id: o.id, 순번: i + 1, 일자: o.date, 종별: o.kind, 신청시작: o.start, 신청종료: o.end, 신청합: hm(m),
            실제시작: o.sanction === '완결' ? o.start : '', 실제종료: o.sanction === '완결' ? o.end : '', 실제합: o.sanction === '완결' ? hm(m) : '',
            할일: o.task, 신청상태: o.req, 승인상태: o.approval, 결재상태: o.sanction, 삭제여부: o.deleted, 대체휴무: o.substitute };
        }));
        tot1.firstChild.textContent = tot2.firstChild.textContent = `${Math.floor(sum / 60)}시간 ${sum % 60}분`;
      };
      const op = async (name) => {
        const sel = g1.selected();
        if (!sel.length) return alert(`${name}할 건을 선택하십시오.`);
        if (!(await confirm(`선택한 ${sel.length}건을 ${name}하시겠습니까?`))) return;
        const r = await api('srv_mym_mm02_003.do', { op: name, ids: sel.map((s) => s._id) });
        await alert(r.message || r.error);
        load();
      };
      const info = formTable([
        [['이름/소속', output(P.nameOrg, { label: '이름/소속' })], ['직위/호봉', output(P.rank, { label: '직위/호봉' })], ['재직상태', output('재직', { label: '재직상태' })]],
        [['교원구분', output('교사(고등학교)', { label: '교원구분' })], ['직급', output('중고등학교교사', { label: '직급' })], ['보직구분', output('담임교사', { label: '보직구분' })], ['담당과목', output('수학', { label: '담당과목' })]],
        [['최초임용일', output(P.first, { label: '최초임용일' })], ['현소속교육청\n임용일', output(P.first, { label: '현소속교육청\n임용일' })],
          ['현기관임용일', output(P.here, { label: '현기관임용일' })], ['현직위임용일', output('', { label: '현직위임용일' })]],
      ], 'info-table');
      root.append(
        el('div', { class: 'search-box' }, field(label('년월', { required: true }), ym), field(label('근무종별'), kind),
          el('div', { class: 'search-btn' }, button('조회', load, { cls: 'btn-primary btn-i-search', ico: 'search' }))),
        info,
        el('div', { class: 'totals' }, output('총 초과근무확인시간', { cls: 'tt-th' }), tot1, output('총 초과근무인정시간', { cls: 'tt-th' }), tot2),
        el('div', { class: 'conv' }, output('당월 연가전환 시간', { cls: 'label' }), output('0시간'), output('연가전환 누적시간', { cls: 'label' }), output('0시간'),
          output('연가전환 누적사용시간', { cls: 'label' }), output('0시간')),
        gridHead('초과근무목록', g1,
          button('신청', () => applyDialog(), { cls: 'btn-primary', label: '신청(새 창 열기)' }),
          button('회수', () => op('회수'), { cls: 'btn-secondary' }), button('기결취소', () => op('기결취소'), { cls: 'btn-secondary' }),
          button('삭제', () => op('삭제'), { cls: 'btn-secondary' })),
        g1, gridHead('연장근로목록', g2), g2);

      function applyDialog() {
        dialog('초과근무신청', (b, close) => {
          const defRow = (d) => ({ date: d, kind: '시간외 근무', holiday: isHoliday(d), start: isHoliday(d) ? '09:00' : '16:40', end: isHoliday(d) ? '24:00' : '21:40',
            after: '00:00', task: '', substitute: false });
          let rows = [defRow(TODAY)];
          let cur = 0;
          const notes = el('div', { class: 'notes' }, NOTES.map((t) => el('p', { text: t })));
          const fold = button('지시문 닫기', () => { notes.hidden = !notes.hidden; fold.setAttribute('aria-label', notes.hidden ? '지시문 열기' : '지시문 닫기'); },
            { iconOnly: true, ico: 'up', cls: 'btn-fold' });
          fold.setAttribute('aria-expanded', 'true');
          const from = dateinput('초과근무 시작일자'), to = dateinput('초과근무 종료일자');
          const skipHol = checkbox('휴일제외', false);
          const lg = grid('초과근무신청목록', [{ name: '초과근무일자', key: 'date' }, { name: '초과근무종별', key: 'kind' }, { name: '초과근무시간', key: 'time' }, { name: '초과근무시간합', key: 'sum' }],
            { select: true, height: 150, onRowClick: (_, i) => { cur = i; fill(); } });
          const sumOf = (r) => Math.max(0, minsOf(...r.end.split(':')) - minsOf(...r.start.split(':')) - minsOf(...r.after.split(':')));
          const view = () => { lg.setRows(rows.map((r) => ({ date: r.date, kind: r.kind, time: `${r.start}      ~      ${r.end}`, sum: hm(sumOf(r)) })), { keep: true });
            if (rows.length) lg.setCurrent(Math.min(cur, rows.length - 1)); };
          // detail form (bound to the selected row)
          const f = {
            date: dateinput('초과근무일자', TODAY, { required: true, onChange: (v) => { upd({ date: v, holiday: isHoliday(v) }); f.hol.set(isHoliday(v)); } }),
            kind: combo('초과근무종별', ['시간외 근무', '휴일 근무'], '시간외 근무', { onChange: (v) => upd({ kind: v }) }),
            hol: checkbox('휴일 선택', true, { text: '휴일', onChange: (v) => upd({ holiday: v }) }),
            sh: numbox('신청시작시', '09'), sm: numbox('신청시작분', '00'), eh: numbox('신청종료시', '24'), em: numbox('신청종료분', '00'),
            th: numbox('초과근무시간 합 시', '15', { readonly: true }), tm: numbox('초과근무시간 합 분', '00', { readonly: true }),
            dual: checkbox('겸임기관신청여부 선택', false, { text: '', disabled: true }),
            ah: numbox('방과후수업차감시간 시', '00'), am: numbox('방과후수업차감시간 분', '00'),
            task: textarea('하여야 할 일', '', { onChange: (v) => upd({ task: v }) }),
            sub: checkbox('대체휴무 선택', false, { text: '대체휴무', onChange: (v) => upd({ substitute: v }) }),
          };
          let loose = defRow(TODAY);   // edits made while the list is empty go nowhere
          const target = () => rows[cur] || loose;
          function upd(patch) { Object.assign(target(), patch); recompute(); view(); }
          const timeChange = () => upd({ start: `${pad(f.sh.value() || 0)}:${pad(f.sm.value() || 0)}`, end: `${pad(f.eh.value() || 0)}:${pad(f.em.value() || 0)}`,
            after: `${pad(f.ah.value() || 0)}:${pad(f.am.value() || 0)}` });
          ['sh', 'sm', 'eh', 'em', 'ah', 'am'].forEach((k) => f[k].input.addEventListener('change', timeChange));
          const monthSum = output('37시간 50분'), weekSum = output('17시간 00분');
          function recompute() { const s = sumOf(target()); f.th.set(pad(Math.floor(s / 60))); f.tm.set(pad(s % 60)); }
          function fill() {
            const r = target();
            f.date.set(r.date); f.kind.set(r.kind, false); f.hol.set(r.holiday);
            const [sh, sm] = r.start.split(':'), [eh, em] = r.end.split(':'), [ah, am] = r.after.split(':');
            f.sh.set(sh); f.sm.set(sm); f.eh.set(eh); f.em.set(em); f.ah.set(ah); f.am.set(am);
            f.task.set(r.task); f.sub.set(r.substitute); recompute();
          }
          const rowAdd = () => { rows.push(defRow(TODAY)); cur = rows.length - 1; view(); fill(); };
          const rowDel = () => {
            const idx = lg.checkedIdx();
            if (!idx.length) return alert('삭제할 행을 선택하십시오.');
            rows = rows.filter((_, i) => !idx.includes(i)); cur = 0; view(); fill();
          };
          const addRange = () => {
            const a = from.value(), z = to.value();
            if (!a || !z) return alert('초과근무 시작일자와 종료일자를 입력하십시오.');
            if (z < a) return alert('종료일자가 시작일자보다 빠릅니다.');
            for (let d = new Date(a + 'T00:00'); CL.iso(d) <= z; d.setDate(d.getDate() + 1)) {
              const v = CL.iso(d);
              if (skipHol.value() && isHoliday(v)) continue;
              if (!rows.some((r) => r.date === v)) rows.push(defRow(v));
            }
            rows.sort((x, y) => (x.date < y.date ? -1 : 1)); cur = rows.length - 1; view(); fill();
          };
          const request = async () => {
            for (const r of rows) {
              if (!r.task.trim()) return alert(`${r.date} : 하여야 할 일은(는) 필수 입력 항목입니다.`);
              if (sumOf(r) <= 0) return alert(`${r.date} : 초과근무 종료시간은 시작시간 이후여야 합니다.`);
            }
            const r = await api('srv_mym_mm02_004.do', { rows });
            if (r.dups && r.dups.length) {
              await alert(`아래 내용을 확인하시기 바랍니다.\n${r.dups[0].replace(/-/g, '.')}일에 신청한 시간의 초과근무는 이미 신청하였거나, 진행중입니다.\n개인초과근무신청 메뉴에서 초과근무 해당 월을 선택하여 확인 하시기 바랍니다.`);
              rows = rows.filter((x) => !r.dups.includes(x.date)); cur = 0; view();
              return;
            }
            draftPopup(rows.map((x) => ({ ...x })), res, () => { close(true); load(); });
          };
          b.append(
            el('div', { class: 'app-head in-dialog' }, el('div', { class: 'cl-control cl-output app-tit' }, el('h1', { class: 'cl-text', text: '초과근무신청' })),
              el('div', { class: 'app-utils' }, button('화면 확대', () => {}, { iconOnly: true, ico: 'expand', cls: 'btn-ut' }), button('화면 축소', () => {}, { iconOnly: true, ico: 'shrink', cls: 'btn-ut' }))),
            notes, el('div', { class: 'fold-bar' }, fold),
            gridHead('초과근무신청목록', lg, button('행추가', rowAdd, { cls: 'btn-outline-primary' }), button('행삭제', rowDel, { cls: 'btn-secondary' })),
            el('div', { class: 'range-bar' }, from, el('span', { class: 'tilde', text: '~' }), to, button('추가', addRange, { cls: 'btn-outline-primary' }), skipHol),
            lg,
            formTable([
              [['월간 초과근무\n신청시간', monthSum], ['주간 초과근무\n신청시간', weekSum]],
              [['초과근무일자', f.date, { required: true }], ['초과근무종별', f.kind, { required: true }]],
              [['초과근무시간', el('div', { class: 'time-row' }, f.hol, f.sh, el('span', { text: ':' }), f.sm, el('span', { class: 'tilde', text: '~' }), f.eh, el('span', { text: ':' }), f.em), { required: true }],
                ['초과근무시간 합', el('div', { class: 'time-row' }, f.th, el('span', { text: '시' }), f.tm, el('span', { text: '분' })), { required: true }]],
              [['겸임기관신청여부', f.dual], ['방과후수업차감시간', el('div', { class: 'time-row' }, f.ah, el('span', { text: '시' }), f.am, el('span', { text: '분' }))]],
              [['하여야 할 일', f.task, { required: true }], ['초과근무 신청구분', f.sub]],
            ], 'detail-form'),
            el('div', { class: 'btn-row' }, button('승인요청', request, { cls: 'btn-primary' }), button('닫기', () => close(false), { cls: 'btn-outline' })));
          view(); fill();
        }, { width: 940 });
      }
      load();
    },

    '개인근무상황관리'(host, sc, res) {
      const root = frame(host, sc);
      const cols = sc.grids[0].columns.filter((c) => c !== '선택');
      const g = grid('근무상황목록', cols, { select: true, height: 320 });
      const load = async () => {
        busy(true, root);
        const r = await api('srv_mym_mm00_001.do', search.values());
        busy(false, root);
        g.setRows(r.rows.map((d) => ({ _id: d.id, '신청당시 부서명': '교무부', 성명: ME.name, 근무상황: d.kind, 기간: d.from === d.to ? d.from : `${d.from}~${d.to}`,
          '일수/기간': d.days, '사유 또는 용무': d.reason, 목적지: d.place, 연가신청구분: d.kind === '연가' ? '일반' : '', 신청자: ME.name,
          결재상태: d.status, 삭제여부: d.deleted, 첨부파일: '' })));
      };
      const KIND = { 휴가: ['연가', '병가', '공가', '특별휴가'], 출장: ['출장'], '외출/조퇴': ['외출', '조퇴'] };
      const search = searchBox([{ role: 'combobox', name: '근무상황대분류', options: ['전체', ...Object.keys(KIND)] },
        { role: 'combobox', name: '근무상황소분류', options: ['전체', ...Object.values(KIND).flat()] },
        { role: 'combobox', name: '결재상태', options: ['전체', '저장', '결재중', '결재완료', '반려'] },
        { role: 'date', name: '조회시작일', value: '2026-09-01' }, { role: 'date', name: '조회종료일', value: '2026-12-31' }], load);
      const btns = sc.buttons.filter((b) => !NOISE.test(b.name)).map((b) => {
        if (b.name.startsWith('신청(')) return button('신청', () => apply(), { cls: 'btn-primary', label: b.name });
        return btnFor(b, async () => {
          if (b.danger === 'high' && !(await confirm(`${b.name}하시겠습니까?`))) return;
          const r = await api('action.do', { screen: sc.name, button: b.name, selected: g.selected().length });
          alert(r.message);
        });
      });
      root.append(search, gridHead('근무상황목록', g, ...btns), g);
      function apply() {
        dialog('근무상황신청', (b, close) => {
          let approver = '';
          const appr = inputbox('결재자', '', { readonly: true });
          const kind = combo('근무상황', KIND['휴가'], '연가');
          const big = combo('근무상황대분류', Object.keys(KIND), '휴가', { onChange: (v) => {
            const nk = combo('근무상황', KIND[v], KIND[v][0]); f.kind.replaceWith(nk); f.kind = nk; } });
          const f = { big, kind, from: dateinput('시작일', '', { required: true }), to: dateinput('종료일', '', { required: true }), reason: inputbox('사유 또는 용무'), place: inputbox('목적지') };
          const send = async (submit) => {
            if (!(await (submit ? confirm('기안문서를 상신하시겠습니까?', '기안문서상신') : confirm('저장하시겠습니까?')))) return;
            const r = await api('srv_mym_mm00_002.do', { big: f.big.value(), kind: f.kind.value(), from: f.from.value(), to: f.to.value(),
              reason: f.reason.value(), place: f.place.value(), approver, submit });
            if (r.error) return alert(r.error);
            await alert(r.message); close(true); load();
          };
          b.append(el('div', { class: 'app-head in-dialog' }, el('div', { class: 'cl-control cl-output app-tit' }, el('h1', { class: 'cl-text', text: '근무상황신청' }))),
            formTable([[['근무상황대분류', f.big, { required: true }], ['근무상황', f.kind, { required: true }]],
              [['시작일', f.from, { required: true }], ['종료일', f.to, { required: true }]],
              [['사유 또는 용무', f.reason, { required: true }], ['목적지', f.place]],
              [['결재자', [appr, button('결재자지정', () => approverPicker((p) => { approver = p[0].name; appr.set(p[0].name); }, res.staff), { cls: 'btn-primary' })], { wide: true }]]]),
            el('div', { class: 'btn-row' }, button('저장', () => send(false), { cls: 'btn-primary' }), button('상신', () => send(true), { cls: 'btn-secondary' }),
              button('닫기', () => close(false), { cls: 'btn-outline' })));
        }, { width: 760 });
      }
      load();
    },

    '과목별출결관리'(host, sc) {
      const root = frame(host, sc);
      const DATES = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13'];
      const STATUS = ['출석', '결석', '지각', '조퇴', '결과', '인정결석', '인정지각'];
      const cols = sc.grids.find((g) => g.label.startsWith('교과교시별')).columns;
      const g = grid('교과교시별등록 테이블', cols, { editors: { 출석상태: STATUS }, height: 430 });
      let key = null;
      const load = async () => {
        const v = search.values();
        key = { year: v['학년도'], term: v['학기'], date: v['일자'], period: v['교시'].replace('교시', ''), subject: v['과목'] };
        busy(true, root);
        const r = await api('his_srg_aa04_010.do', key);
        busy(false, root);
        g.setRows(r.rows.map((s) => ({ 학년: s.grade, 반: s.cls, 번호: s.no, 성명: s.name, '전달 내용': '', 출석상태: s.status, 일출결사유: '' })));
      };
      const search = searchBox([{ role: 'combobox', name: '학년도', options: ['2026', '2025'] }, { role: 'combobox', name: '학기', options: ['1학기', '2학기'], value: '2학기' },
        { role: 'radio', name: '일자순' }, { role: 'radio', name: '과목순' },
        { role: 'combobox', name: '일자', options: DATES, value: '2026-10-08' }, { role: 'combobox', name: '교시', options: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시'] },
        { role: 'combobox', name: '과목', options: OPTIONS('과목') }, { role: 'checkbox', name: '교과담임 과목 기준' }], load);
      const shift = (ctl, list, d) => { const c = search.ctl[ctl]; const i = list.indexOf(c.value()); c.set(list[Math.min(list.length - 1, Math.max(0, i + d))]); };
      const PER = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시'];
      root.append(search, gridHead('교과교시별등록', g,
        button('일자빼기', () => shift('일자', DATES, -1), { cls: 'btn-outline' }), button('일자더하기', () => shift('일자', DATES, 1), { cls: 'btn-outline' }),
        button('이전교시', () => shift('교시', PER, -1), { cls: 'btn-outline' }), button('다음교시', () => shift('교시', PER, 1), { cls: 'btn-outline' }),
        button('초기화', async () => { if (await confirm('입력한 내용을 초기화하시겠습니까?')) load(); }, { cls: 'btn-secondary' }),
        button('저장', async () => {
          if (!key) return alert('먼저 조회하십시오.');
          const changes = Object.fromEntries(g.edits().filter((e) => '출석상태' in e.changes).map((e) => [e.row['번호'], e.changes['출석상태']]));
          if (!Object.keys(changes).length) return alert('변경된 내용이 없습니다.');
          if (!(await confirm('저장하시겠습니까?'))) return;
          const r = await api('his_srg_aa04_020.do', { ...key, changes });
          await alert(r.message || r.error); load();
        }, { cls: 'btn-primary' }),
        button('출결마감', () => alert('연습용: 출결마감은 하지 않습니다.'), { cls: 'btn-secondary' }),
        button('마감취소', () => alert('연습용: 마감된 출결이 없습니다.'), { cls: 'btn-secondary' })), g);
    },
  };
  Object.keys(RECORD).forEach((n) => { FLOWS[n] = (host, sc, res) => recordScreen(host, sc, res, RECORD[n]); });
})();
