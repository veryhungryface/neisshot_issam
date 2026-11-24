// 모의 K-에듀파인 (연습용) — Nexacro-style shell, tree menu, MDI windows, JSP screens in iframes, 품의 flow.
'use strict';
(async () => {
  const { el, press, Button, Static, Edit, Combo, Calendar, CheckBox, Radio, TextArea, Grid } = NX;
  const SPEC = await (await fetch('/data/edufine.json')).json();
  const SCREENS = SPEC.screens;
  const api = async (name, body = {}) => (await fetch('/edufine/api/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const MF = 'mainframe.MainVFrameSet';

  // ── frame sets ─────────────────────────────────────────────────────────────
  const root = el('div', { class: 'nexacontainer', id: 'mainframe' });
  const top = el('div', { class: 'Form TopFrame', id: `${MF}.TopFrame.form` });
  const leftF = el('div', { class: 'Form LeftFrame', id: `${MF}.SubHFrameSet.LeftFrame.form` });
  const work = el('div', { class: 'WorkFrame', id: `${MF}.SubHFrameSet.WorkVFrameSet.WorkFrame` });
  const mdi = el('div', { class: 'Form MdiTabFrame', id: `${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form` });
  root.append(top, el('div', { class: 'SubHFrameSet', id: `${MF}.SubHFrameSet` }, leftF,
    el('div', { class: 'WorkVFrameSet', id: `${MF}.SubHFrameSet.WorkVFrameSet` }, work, mdi)));
  document.body.append(root);

  // top: logo, counters, top menu
  const T = `${MF}.TopFrame.form`;
  const TOPMENU = ['문서관리', '메모관리', '과제관리', '업무인계인수', '업무지원', '내부메일', '기능분류', '자료집계', '학교회계'];
  let current = '문서관리';
  const topBtns = TOPMENU.map((m, i) => Button(`${T}.divTopMenu.form.btnTopMenu${String(i).padStart(2, '0')}`, m, () => {
    if (!['문서관리', '학교회계'].includes(m)) return alert(`${m}: 연습장에 없는 메뉴입니다.`);
    current = m; topBtns.forEach((b) => b.classList.toggle('selected', b.textContent === m)); drawTree();
  }, { cls: m === current ? 'top-menu selected' : 'top-menu' }));
  const clock = Static(`${T}.staTimer`, '59:59', { cls: 'timer' });
  let left = 3599;
  setInterval(() => { left = Math.max(0, left - 1); clock.firstChild.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; }, 1000);
  top.append(
    el('div', { class: 'top-row' }, Static(`${T}.staLogo`, 'K-에듀파인(모의·연습용)', { cls: 'logo' }), clock,
      Static(`${T}.staCnt`, '결재(긴급) 2(0) | 공람 3 | 문서진행 1 | 발송대기 0', { cls: 'counters' }),
      Edit(`${T}.edtSearch`, '통합검색 조회'), Static(`${T}.staUser`, '모의교사님', { cls: 'user' })),
    el('div', { class: 'Div top-menu-bar', id: `${T}.divTopMenu` }, topBtns));

  // left: tree menu (a Nexacro grid of tree items; only rows in view exist in the DOM)
  const G = `${MF}.SubHFrameSet.LeftFrame.form.divLnb.form.gridMenu`;
  const nodes = [];   // flattened tree for the current top menu
  const expanded = new Set();
  function treeFor(topName) {
    const rootNode = { name: topName, kids: new Map() };
    for (const m of SPEC.menus) {
      const parts = (m.path || '').split(' > ').map((s) => s.trim()).filter(Boolean);
      if (parts[0] !== topName) continue;
      let cur = rootNode;
      parts.slice(1).forEach((p, i) => {
        if (!cur.kids.has(p)) cur.kids.set(p, { name: p, kids: new Map(), code: null });
        cur = cur.kids.get(p);
        if (i === parts.length - 2) cur.code = m.code;
      });
    }
    return rootNode;
  }
  const treeBody = el('div', { class: 'tree-scroll' });
  const gridMenu = el('div', { class: 'Grid grd_LF_Menu', id: G, 'aria-label': 'gridMenu 표시작 ' },
    el('div', { class: 'GridBandControl body', id: G + '.body', role: 'gridcell' }, treeBody));
  leftF.append(el('div', { class: 'Div', id: `${MF}.SubHFrameSet.LeftFrame.form.divLnb` },
    el('div', { class: 'lnb-tabs' }, Button(`${MF}.SubHFrameSet.LeftFrame.form.btnWorkMenu`, '업무메뉴', null, { cls: 'selected' }),
      Button(`${MF}.SubHFrameSet.LeftFrame.form.btnFavorite`, '즐겨찾기', () => alert('즐겨찾기한 메뉴가 없습니다.'))),
    Static(`${MF}.SubHFrameSet.LeftFrame.form.divLnb.form.staTitle`, '문서관리', { cls: 'lnb-title' }), gridMenu));
  const ROW_H = 34, VIS = 16;
  function flatten(node, depth, out) {
    for (const k of node.kids.values()) {
      out.push({ ...k, depth, leaf: k.kids.size === 0 });
      if (k.kids.size && expanded.has(k.name + depth)) flatten(k, depth + 1, out);
    }
    return out;
  }
  function drawTree() {
    leftF.querySelector('.lnb-title .nexacontentsbox').textContent = current;
    nodes.length = 0;
    nodes.push(...flatten(treeFor(current), 1, []));
    treeBody.style.height = (nodes.length * ROW_H) + 'px';
    renderRows();
  }
  function renderRows() {
    const body = gridMenu.querySelector('.body');
    [...treeBody.children].forEach((c) => c.remove());
    const first = Math.max(0, Math.floor(body.scrollTop / ROW_H));
    nodes.slice(first, first + VIS).forEach((n, k) => {
      const i = first + k;
      const cid = `${G}.body.gridrow_${i}.cell_${i}_0`;
      const cls = n.leaf ? `cell_SubLv${n.depth}` : `cell_Lv${n.depth}`;
      const item = el('div', { class: 'CellTreeItemControl celltreeitem', id: cid + '.celltreeitem', tabindex: -1, 'aria-label': `${n.name} `,
        style: { paddingLeft: (n.depth * 12) + 'px' } },
      el('div', { class: 'TreeItemIconControl treeitembutton', id: cid + '.celltreeitem.treeitembutton', text: n.leaf ? '' : (expanded.has(n.name + n.depth) ? '−' : '+') }),
      el('div', { class: 'StaticControl treeitemtext', id: cid + '.celltreeitem.treeitemtext', text: n.name }));
      const cell = el('div', { class: `GridCellControl cell ${cls}`, id: cid, tabindex: -1, 'aria-label': n.leaf ? `${n.name}화면 열기 ` : `${n.name} `,
        'aria-readonly': 'false', 'aria-selected': 'false', 'aria-expanded': n.leaf ? null : String(expanded.has(n.name + n.depth)) }, item);
      cell.addEventListener('click', () => {
        if (!n.leaf) { const key = n.name + n.depth; expanded.has(key) ? expanded.delete(key) : expanded.add(key); return drawTree(); }
        openWindow(n.name, n.code);
      });
      treeBody.append(el('div', { class: 'GridRowControl row', id: `${G}.body.gridrow_${i}`, style: { top: (i * ROW_H) + 'px' } }, cell));
    });
  }
  gridMenu.querySelector('.body').addEventListener('scroll', renderRows);
  drawTree();

  // ── MDI windows ─────────────────────────────────────────────────────────────
  const W = `${MF}.SubHFrameSet.WorkVFrameSet.WorkFrame`;
  const windows = new Map();   // code → {frame, tab, title}
  let z = 100;
  const tabsBar = el('div', { class: 'Div tabs', id: `${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form.divTab` });
  mdi.append(tabsBar, el('div', { class: 'mdi-btns' },
    Button(`${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form.btnPreMdi`, '이전 화면목록으로', null),
    Button(`${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form.btnNexMdi`, '다음 화면목록으로', null),
    Button(`${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form.btnCloseAll`, '전체 화면 닫기', () => [...windows.keys()].forEach(closeWindow))));
  function front(code) {
    for (const [c, w] of windows) {
      const on = c === code;
      if (on) w.frame.style.zIndex = String(++z);
      w.frame.style.visibility = on ? 'visible' : 'hidden';
      w.tab.classList.toggle('selected', on);
    }
  }
  function closeWindow(code) {
    const w = windows.get(code);
    if (!w) return;
    w.frame.remove(); w.tab.remove(); windows.delete(code);
    const last = [...windows.keys()].pop();
    if (last) front(last);
  }
  async function openWindow(name, code) {
    if (code && windows.has(code)) return front(code);
    if (windows.size >= 10) return alert('화면은 10개 까지만 열립니다.');
    const sc = SCREENS[name];
    const wid = `${W}.winId_${code || 'NOCODE'}_${Math.floor(Math.random() * 900 + 10)}`;
    const F = wid + '.form';
    const frame = el('div', { class: 'ChildFrame', id: wid, style: { zIndex: String(++z) } });
    const form = el('div', { class: 'Form', id: F });
    const path = (sc && sc.paths && sc.paths[0]) || name;
    const navi = Edit(F + '.edtNavi', '메뉴경로', { readonly: true });
    navi.set(path);
    form.append(el('div', { class: 'win-head' },
      el('div', { class: 'ImageViewer', id: F + '.imgTitle' }, el('div', { class: 'StaticControl', id: F + '.imgTitle.imagetext' }, el('div', { id: F + '.imgTitle.imagetext:text', text: name }))),
      Static(F + '.imgOrgNm', `( ${'모의고등학교'} / ${code || '-'} )`, { cls: 'org' }),
      Edit(F + '.edtMenuId', `메뉴아이디 ${code || ''}`, { readonly: true, value: code || '' }), navi,
      el('div', { class: 'win-head-btns' }, Button(F + '.btnHelp', '도움말(팝업열기)', () => alert('연습용 도움말입니다.')),
        Button(F + '.btnFavorite', '즐겨찾기(팝업열기)', () => alert('즐겨찾기에 추가했습니다. (연습용)')),
        Button(F + '.btnToolTip', '툴팁(팝업열기)', null))));
    frame.append(form);
    work.append(frame);
    const tab = Button(`${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form.divTab.form.btnTab_${code}`, name, () => front(code), { cls: 'mdi-tab' });
    tab.append(Button(`${MF}.SubHFrameSet.WorkVFrameSet.MdiTabFrame.form.divTab.form.btnTabClose_${code}`, `${name} 닫기`, (ev) => { ev.stopPropagation(); closeWindow(code); }, { cls: 'mdi-close' }));
    tabsBar.append(tab);
    windows.set(code, { frame, tab, title: name });
    front(code);
    const body = el('div', { class: 'Div win-body', id: F + '.divWork' });
    form.append(body);
    if (!sc) { body.append(Static(F + '.staNone', '이 화면은 수집 자료에 구조가 없어 연습장에 없습니다.')); return; }
    const res = await api('screen', { name });
    const s = res.screen || sc;
    if (s.server_page) {   // JSP screen inside an iframe, like the real document-management screens
      const src = `/edufine${s.server_page}?MENU_ID=${encodeURIComponent(code)}`;
      body.append(el('div', { class: 'WebBrowser', id: F + '.webWork' },
        el('iframe', { id: F + '.webWork_WebBrowser', name: F + '.webWork_WebBrowser', src, title: name })));
      return;
    }
    if (FLOWS[name]) { await FLOWS[name](body, s, F + '.divWork.form', code); fillMissing(body, s, F + '.divWork.form'); }
    else genericNexa(body, s, F + '.divWork.form', code);
  }
  function fillMissing(body, s, P) {
    const tails = new Set([...body.querySelectorAll('[id]')].map((x) => x.id.split('.').pop()));
    const extra = el('div', { class: 'Div extra', id: P + '.divEtc' });
    (s.nexacro_components || []).filter((c) => !tails.has(c.id) && c.kind !== 'file').forEach((c) => {
      if (c.kind === 'button') extra.append(Button(`${P}.${c.id}`, c.label, async () => {
        const k = btnKind(c.id);
        if ((k === 'R' || k === 'C') && !(await confirm(`${c.label.split(' ')[0]} 하시겠습니까?`))) return;
        alert((await api('action', { screen: s.name, button: c.label, id: c.id })).message);
      }, { cls: btnKind(c.id) ? `auth-${btnKind(c.id)}` : '' }));
      else { const comp = component(P, c); if (comp) extra.append(el('div', { class: 'field' }, Static(`${P}.sta_${c.id}`, c.label, { cls: 'field-label' }), comp)); }
    });
    if (extra.children.length) body.append(Static(P + '.staEtc', '기타 항목', { cls: 'sub-title' }), extra);
    (s.nexacro_grids || []).filter((g) => !g.tree && g.columns.length && !tails.has(g.id)).forEach((g) => body.append(Grid(`${P}.${g.id}`, g.columns)));
  }

  // ── alerts / confirms (Nexacro popup forms; modal) ───────────────────────────
  function modal(title, build) {
    const shade = el('div', { class: 'modal-shade' });
    const pid = `${MF}.popup_${Math.floor(Math.random() * 9999)}`;
    const box = el('div', { class: 'ChildFrame popup', id: pid, 'aria-label': title, role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'Form', id: pid + '.form' }, Static(pid + '.form.staTitle', title, { cls: 'popup-title' })));
    document.body.append(shade, box);
    const close = (v) => { shade.remove(); box.remove(); box.dispatchEvent(new CustomEvent('closed', { detail: v })); };
    build(box.firstChild, close, pid + '.form');
    return box;
  }
  function alert(msg) {
    return new Promise((res) => {
      const b = modal('알림', (f, close, p) => {
        f.append(Static(p + '.staMsg', msg, { cls: 'popup-msg' }), el('div', { class: 'popup-btns' }, Button(p + '.btnOk', '확인', () => close(true))));
      });
      b.addEventListener('closed', () => res(true));
    });
  }
  function confirm(msg) {
    return new Promise((res) => {
      const b = modal('확인', (f, close, p) => {
        f.append(Static(p + '.staMsg', msg, { cls: 'popup-msg' }),
          el('div', { class: 'popup-btns' }, Button(p + '.btnOk', '확인', () => close(true)), Button(p + '.btnCancel', '취소', () => close(false))));
      });
      b.addEventListener('closed', (ev) => res(!!ev.detail));
    });
  }
  window.nxAlert = alert;

  // ── generated Nexacro screen ────────────────────────────────────────────────
  function component(P, c) {
    const id = `${P}.${c.id}`;
    switch (c.kind) {
      case 'textbox': return Edit(id, c.label, { required: c.required });
      case 'date': return Calendar(id, c.label, { required: c.required });
      case 'combobox': return Combo(id, c.label, /연도|년도/.test(c.label) ? ['2026', '2025', '2024'] : ['전체', `${c.label} 1`, `${c.label} 2`], { required: c.required });
      case 'checkbox': return CheckBox(id, c.label);
      case 'radio': return Radio(id, c.label, ['예', '아니오']);
      case 'textarea': return TextArea(id, c.label, { required: c.required });
      default: return null;
    }
  }
  const btnKind = (id) => (/^btnAuth([SRCDP])/.exec(id) || [])[1];
  function genericNexa(body, s, P, code) {
    const fields = el('div', { class: 'Div search', id: P + '.divSearch' });
    const grids = {};
    (s.nexacro_components || []).filter((c) => c.kind !== 'button' && c.kind !== 'file' && c.kind !== 'tab').forEach((c) => {
      const comp = component(P, c);
      if (comp) fields.append(el('div', { class: 'field' }, Static(`${P}.sta_${c.id}`, c.label, { cls: 'field-label' }), comp));
    });
    const btns = el('div', { class: 'Div btns', id: P + '.divCmmnButton' });
    (s.nexacro_components || []).filter((c) => c.kind === 'button').forEach((c) => {
      btns.append(Button(`${P}.${c.id}`, c.label, async () => {
        const k = btnKind(c.id);
        if ((k === 'R' || k === 'C' || c.danger === 'high') && !(await confirm(`${c.label.split(' ')[0]} 하시겠습니까?`))) return;
        if (/조회/.test(c.label) || k === 'S') {
          const r = await api('search', { screen: s.name, conditions: {} });
          Object.entries(r.grids || {}).forEach(([gid, rows]) => grids[gid] && grids[gid].setRows(rows));
          return;
        }
        const r = await api('action', { screen: s.name, button: c.label, id: c.id });
        alert(r.message);
      }, { cls: btnKind(c.id) ? `auth-${btnKind(c.id)}` : '' }));
    });
    body.append(fields, btns);
    (s.nexacro_grids || []).filter((g) => !g.tree && g.columns.length).forEach((g) => {
      const grid = Grid(`${P}.${g.id}`, g.columns);
      grids[g.id] = grid;
      body.append(grid);
    });
  }

  // ── 품의등록 / 품의목록 (working) ────────────────────────────────────────────
  const FLOWS = {
    '품의등록'(body, s, P) {
      const f = {
        year: Combo(`${P}.divMain.form.cboAccnutYr`, '회계연도 구분', ['선택', '2026', '2025'], { required: true, value: '선택' }),
        title: Edit(`${P}.divMain.form.edtCnsulSj`, '제목', { required: true }),
        date: Calendar(`${P}.divMain.form.calDmndDte`, '요구일자', { required: true }),
        done: Calendar(`${P}.divMain.form.calComptDmndDte`, '완료요구일자'),
        summary: TextArea(`${P}.divMain.form.txtareaCnsulSumrCn`, '개요', { required: true }),
        sbsidy: Radio(`${P}.divMain.form.rdoSbsidyExpdYn`, '보조금지출여부', ['예', '아니오'], { value: '아니오' }),
        status: Edit(`${P}.divMain.form.edtProgrsSts`, '진행상태', { readonly: true, value: '작성중' }),
        no: Edit(`${P}.divMain.form.edtCnsulNoRe`, '품의번호', { readonly: true }),
      };
      const items = Grid(`${P}.grdPrdlstDtl`, ['상태', '순번', '내용(필수입력)', 'S2B물품번호', '규격', '수량', '단위', '예상단가', '예상금액(필수입력)', '수수료'],
        { editable: ['내용(필수입력)', '규격', '수량', '단위', '예상단가'] });
      const bgt = Grid(`${P}.grdBgtDtl`, ['상태', '세부사업', '세부사업잔액', '세부항목', '원가통계비목', '산출내역', '예산현액', '예산잔액', '요구금액']);
      bgt.setRows([['', '교육활동 지원', '3,200,000', '일반수용비', '', '교구 구입', '5,000,000', '3,200,000', '0']]);
      let savedNo = null;
      const save = async () => {
        if (!(await confirm('저장하시겠습니까?'))) return;
        const rows = items.rows().map((r) => ({ name: r[2], spec: r[4], qty: String(r[5]).replace(/,/g, ''), unit: r[6], price: String(r[7]).replace(/,/g, '') }));
        const r = await api('cnsul/save', { year: f.year.value() === '선택' ? '' : f.year.value(), title: f.title.value(), date: f.date.value(),
          done: f.done.value(), summary: f.summary.value(), subsidy: f.sbsidy.value(), items: rows });
        if (r.error) return alert(r.error);
        savedNo = r.record.no; f.no.set(savedNo); f.status.set('작성중');
        items.setRows(r.record.items.map((it, i) => ['', i + 1, it.name, '', it.spec || '', it.qty, it.unit || '', it.price, it.amount.toLocaleString(), '']));
        alert(r.message);
      };
      body.append(
        el('div', { class: 'Div btns', id: P + '.divCmmnButton' },
          Button(`${P}.btnAuthR00`, '신규', async () => { if (await confirm('입력 중인 내용을 지우고 새로 작성하시겠습니까?')) location.reload(); }, { cls: 'auth-R' }),
          Button(`${P}.btnAuthR02`, '저장', save, { cls: 'auth-R' }),
          Button(`${P}.btnAuthR01`, '삭제', () => alert('저장된 품의가 없습니다. (연습용)'), { cls: 'auth-R' }),
          Button(`${P}.btnAuthC03`, '결재요청(새창열기)', () => {
            if (!savedNo) return alert('품의를 먼저 저장하세요.');
            window.open(`/edufine/popup/sanction.html?no=${encodeURIComponent(savedNo)}`, 'sanction', 'width=760,height=620');
          }, { cls: 'auth-C' }),
          Button(`${P}.btnAuthC01`, '결재정보(새창열기)', () => alert('결재정보가 없습니다. (연습용)'), { cls: 'auth-C' }),
          Button(`${P}.btnAuthS02`, '출력 지출 품의서 출력', () => alert('출력은 연습장에서 지원하지 않습니다.'), { cls: 'auth-S' }),
          Button(`${P}.btnAuthS01`, '목록', () => openWindow('품의목록', 'A00FAA0104001002'), { cls: 'auth-S' })),
        el('div', { class: 'Div form-grid', id: P + '.divMain' },
          ...[['회계연도 구분', f.year], ['품의번호', f.no], ['진행상태', f.status], ['제목', f.title], ['요구일자', f.date], ['완료요구일자', f.done],
            ['보조금지출여부', f.sbsidy], ['개요', f.summary]].map(([l, c]) => el('div', { class: 'field' }, Static(`${P}.divMain.form.sta_${c.id.split('.').pop()}`, l, { cls: 'field-label' }), c))),
        Static(`${P}.imgBgtDtl`, '예산내역', { cls: 'sub-title' }), bgt,
        el('div', { class: 'sub-head' }, Static(`${P}.imgPrdlstDtl`, '품목내역', { cls: 'sub-title' }),
          Button(`${P}.btnRowAdit`, '행추가', () => items.addRow(['', items.rows().length + 1, '', '', '', '', '개', '', '', ''])),
          Button(`${P}.btnAuthRDelRow`, '행삭제', () => { if (!items.removeCurrent()) alert('삭제할 행을 선택하세요.'); }, { cls: 'auth-R' })),
        items);
    },
    async '품의목록'(body, s, P) {
      const year = Combo(`${P}.cboAccnutYr`, '회계연도', ['2026', '2025'], { required: true });
      const grid = Grid(`${P}.grdMain`, ['품의번호', '요구일자', '제목', '품의자', '품의금액', '상태']);
      const load = async () => { const r = await api('search', { screen: '품의목록', conditions: { year: year.value() } }); grid.setRows(r.grids.grdMain); };
      body.append(el('div', { class: 'Div search', id: P + '.divSearch' }, el('div', { class: 'field' }, Static(`${P}.staYr`, '회계연도', { cls: 'field-label' }), year),
        Button(`${P}.btnAuthS01`, '조회', load, { cls: 'auth-S' })), grid);
      load();
    },
  };
})();
