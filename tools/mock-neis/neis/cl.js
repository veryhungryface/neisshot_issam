// eXbuilder6-style controls for the mock NEIS (연습용).
// Attribute patterns follow the captured NEIS DOM (2026-10-11, 두 차례 수집): cl-* classes, role/aria-label on the
// interactive node, ids "uuid-xxx" that change on every page load, grid cells labelled "N행 열이름 값"
// ("N행 마지막 행 …" on the last row), modal cl-dialog, text buttons named by their text (no aria-label),
// icon buttons named by aria-label, a masked date input that only takes real key presses.
'use strict';
const CL = (() => {
  let seq = Math.floor(Math.random() * 46000) + 1300;
  const uid = () => 'uuid-' + (seq++).toString(36);
  const ndid = () => (seq++).toString(36);

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
    return e;
  }
  const press = (node, fn) => {
    node.addEventListener('click', (ev) => {
      if (node.getAttribute('aria-disabled') === 'true' || node.classList.contains('cl-disabled')) return;
      fn(ev);
    });
    node.addEventListener('keydown', (ev) => {
      if (ev.target === node && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); node.click(); }
    });
  };

  // Small line icons (monochrome; color comes from CSS currentColor)
  const ICONS = {
    search: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    refresh: '<path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M19 4v4h-4"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>',
    book: '<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h6M9 11h6"/>',
    monitor: '<rect x="3" y="5" width="18" height="11" rx="1"/><path d="M9 20h6M12 16v4"/>',
    expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
    shrink: '<path d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>',
    list: '<circle cx="12" cy="12" r="9"/><path d="M8 9h8M8 12h8M8 15h8"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    settings: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5l2 2.6 3.2-.6.6 3.2 2.7 1.9-1.6 2.9 1.6 2.9-2.7 1.9-.6 3.2-3.2-.6-2 2.6-2-2.6-3.2.6-.6-3.2L3.5 15l1.6-2.9L3.5 9.2l2.7-1.9.6-3.2 3.2.6z"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h0"/>',
    chat: '<path d="M4 5h16v10H9l-5 4z"/>',
    doc: '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    call: '<path d="M6 3l3 4-2 2c1 3 3 5 6 6l2-2 4 3-2 3C9 19 5 15 3 6z"/>',
    video: '<rect x="4" y="5" width="16" height="13" rx="1"/><path d="M10 9l5 2.5L10 14z"/>',
    home: '<path d="M4 11l8-7 8 7M6 10v10h12V10"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
    closeall: '<path d="M4 6l8 8M12 6l-8 8M14 10h6M14 14h6"/>', listview: '<path d="M5 6h14M5 12h14M5 18h14"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  };
  const icon = (name, cls = '') => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', ('ico ' + cls).trim());
    s.innerHTML = ICONS[name] || '';
    return s;
  };

  // Text buttons are named by their text, like the real ones (회수, 확인, 승인요청). Icon-only buttons carry an
  // aria-label; `label` sets one explicitly ("신청(새 창 열기)" shows "신청").
  function button(text, onClick, { cls = '', title, disabled, label, ico, role = 'button', iconOnly = false } = {}) {
    const b = el('div', { class: `cl-control cl-button cl-unselectable ${cls}`.trim(), role, tabindex: 0,
      'aria-label': label || (iconOnly ? text : null), title: title || (iconOnly ? text : null), id: uid(), 'data-ndid': uid(),
      'aria-disabled': disabled ? 'true' : null },
    el('a', { class: 'cl-text-wrapper', 'data-ndid': ndid() }, ico ? icon(ico) : null, iconOnly ? null : el('div', { class: 'cl-text', text })));
    if (disabled) b.classList.add('cl-disabled');
    if (onClick) press(b, onClick);
    b.setDisabled = (v) => { b.classList.toggle('cl-disabled', v); v ? b.setAttribute('aria-disabled', 'true') : b.removeAttribute('aria-disabled'); };
    return b;
  }

  function output(text, { cls = '', label, tag = 'div' } = {}) {
    return el('div', { class: `cl-control cl-output cl-unselectable ${cls}`.trim(), id: uid(), 'data-ndid': uid(),
      'aria-label': label || null }, el(tag, { class: 'cl-text', text }));
  }
  // "*년월" style label; the star is a separate span like the real cl-sound-only "필수입력"
  const label = (text, { required = false, cls = '' } = {}) =>
    el('div', { class: `cl-control cl-output label ${required ? 'require' : ''} ${cls}`.trim(), id: uid() },
      el('div', { class: 'cl-text' }, text, required ? el('span', { class: 'cl-sound-only', text: '필수입력' }) : null));

  // ── combobox (listbox popup appended to body when opened) ──
  let openList = null;
  function closeList() { if (openList) { openList.close(); openList = null; } }
  document.addEventListener('mousedown', (ev) => {
    if (openList && !openList.node.contains(ev.target) && !openList.owner.contains(ev.target)) closeList();
  });
  function combo(name, options, value, { onChange, cls = '', labelPrefix } = {}) {
    let cur = value ?? options[0] ?? '';
    const lab = () => `${labelPrefix ? labelPrefix + ' ' : ''}${name}, ${cur}`;
    const text = el('div', { class: 'cl-combobox-text', text: cur });
    const box = el('div', { class: 'cl-text cl-preventinput cl-unselectable', role: 'combobox', 'aria-haspopup': 'listbox',
      'aria-expanded': 'false', 'aria-label': lab(), tabindex: 0, 'data-ndid': ndid() }, text);
    const wrap = el('div', { class: `cl-control cl-combobox ${cls}`.trim(), id: uid(), 'data-ndid': uid() },
      box, el('div', { class: 'cl-combobox-button', 'aria-hidden': 'true' }, icon('down')));
    const set = (v, fire = true) => {
      cur = v; text.textContent = v; box.setAttribute('aria-label', lab()); wrap.dataset.value = v;
      if (fire && onChange) onChange(v);
    };
    set(cur, false);
    const open = () => {
      closeList();
      const r = box.getBoundingClientRect();
      const list = el('div', { class: 'cl-control cl-combobox-list', role: 'listbox', 'aria-label': name, id: uid(),
        style: { left: r.left + 'px', top: (r.bottom + window.scrollY + 1) + 'px', minWidth: Math.max(r.width + 24, 90) + 'px' } });
      options.forEach((o) => {
        const it = el('div', { class: 'cl-combobox-list-item' + (o === cur ? ' cl-selected' : ''), role: 'option',
          'aria-selected': o === cur ? 'true' : 'false', tabindex: -1, text: o });
        it.addEventListener('click', () => { set(o); closeList(); box.focus(); });
        list.append(it);
      });
      document.body.append(list);
      box.setAttribute('aria-expanded', 'true');
      openList = { node: list, owner: wrap, close: () => { list.remove(); box.setAttribute('aria-expanded', 'false'); } };
    };
    box.addEventListener('click', () => (box.getAttribute('aria-expanded') === 'true' ? closeList() : open()));
    box.addEventListener('keydown', (ev) => {
      const i = options.indexOf(cur);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); set(options[Math.min(options.length - 1, i + 1)]); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); set(options[Math.max(0, i - 1)]); }
      else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
      else if (ev.key === 'Escape') closeList();
    });
    wrap.value = () => cur;
    wrap.set = set;
    wrap.box = box;
    return wrap;
  }

  // ── masked input: eXbuilder formats as you type and only accepts real key presses ──
  // Text pushed in without a key press (paste, Input.insertText from automation) is rejected, so the value stays
  // as it was. This reproduces the 2026-10-11 school-PC test: typing "2026-10-12" into 초과근무일자 changed nothing,
  // while picking the day in the calendar worked.
  function maskInput(input, format, onCommit) {
    const digits = (format.match(/[YMD9]/g) || []).length;
    const fmt = (raw) => {
      const d = raw.replace(/\D/g, '').slice(0, digits);
      let out = '', k = 0;
      for (const ch of format) {
        if (k >= d.length) break;
        if (/[YMD9]/.test(ch)) out += d[k++];
        else out += ch;
      }
      return out;
    };
    let keyed = false, last = input.value;
    input.addEventListener('keydown', (ev) => { if (ev.key.length === 1 || ev.key === 'Backspace' || ev.key === 'Delete') keyed = true; });
    input.addEventListener('beforeinput', (ev) => {
      if (!keyed && /^(insert|delete)/.test(ev.inputType)) ev.preventDefault();
      keyed = false;
    });
    input.addEventListener('input', () => { input.value = fmt(input.value); });
    const commit = () => {
      const v = input.value;
      if (v === last) return;
      if (v && v.length !== format.length) { input.value = last; return; }   // incomplete → previous value back
      last = v; onCommit && onCommit(v);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit(); });
    return { set: (v) => { input.value = v; last = v; }, get: () => input.value };
  }

  // ── date input with the eXbuilder calendar popup (day cells: role=button "2026년 10월 12일 월요일") ──
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const WEEK_CLS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function dateinput(name, value = '', { onChange, month = false, cls = '', required = false } = {}) {
    const format = month ? 'YYYY-MM' : 'YYYY-MM-DD';
    const input = el('input', { class: 'cl-text', type: 'text', 'aria-label': name, placeholder: month ? '' : '', tabindex: 0,
      'data-ndid': ndid(), value, autocomplete: 'off', 'aria-required': required ? 'true' : null });
    const btn = el('div', { class: 'cl-dateinput-button cl-right', role: 'button', 'aria-haspopup': 'true',
      'aria-label': '달력으로 날짜 선택', tabindex: 0, 'data-ndid': ndid() }, icon('calendar'));
    const wrap = el('div', { class: `cl-control cl-dateinput ${required ? 'require' : ''} ${cls}`.trim(), id: uid(), 'data-ndid': uid() }, input, btn);
    const mask = maskInput(input, format, (v) => onChange && onChange(v));
    const pickCalendar = () => {
      closeList();
      const base = /^\d{4}-\d{2}/.test(input.value) ? new Date(input.value.slice(0, 7) + '-01T00:00') : new Date('2026-10-01T00:00');
      let y = base.getFullYear(), m = base.getMonth();
      const r = wrap.getBoundingClientRect();
      const cal = el('div', { class: 'cl-control cl-bottom cl-calendar cl-calendar-day cl-popup', role: 'application', id: uid(),
        style: { left: r.left + 'px', top: (r.bottom + window.scrollY + 2) + 'px' } });
      const draw = () => {
        cal.textContent = '';
        const prev = el('div', { class: 'cl-calendar-header-prev', role: 'button', 'aria-label': '이전달', tabindex: 0 }, icon('left'));
        const next = el('div', { class: 'cl-calendar-header-next', role: 'button', 'aria-label': '다음달', tabindex: 0 }, icon('right'));
        press(prev, () => { m -= 1; if (m < 0) { m = 11; y -= 1; } draw(); });
        press(next, () => { m += 1; if (m > 11) { m = 0; y += 1; } draw(); });
        cal.append(el('div', { class: 'cl-calendar-header' }, prev, el('div', { class: 'cl-calendar-header-text', role: 'button', text: `${y} ${m + 1}월` }), next));
        const body = el('div', { class: 'cl-calendar-body' }, WEEK.map((w, i) => el('div', { class: 'cl-calendar-week ' + WEEK_CLS[i], text: w })));
        const first = new Date(y, m, 1).getDay();
        const days = new Date(y, m + 1, 0).getDate();
        const prevDays = new Date(y, m, 0).getDate();
        for (let i = 0; i < first; i++) body.append(el('div', { class: 'cl-calendar-other' }, el('div', { class: 'cl-text', text: String(prevDays - first + 1 + i) })));
        for (let d = 1; d <= days; d++) {
          const dt = new Date(y, m, d), wd = dt.getDay(), v = iso(dt);
          const c = el('div', { class: `cl-calendar-content-day cl-calendar-content-${WEEK_CLS[wd]}` + (v === input.value ? ' cl-calendar-current' : ''),
            role: 'button', tabindex: -1, 'aria-label': `${y}년 ${m + 1}월 ${d}일 ${WEEK[wd]}요일` }, el('div', { class: 'cl-text', text: String(d) }));
          press(c, () => { const nv = month ? v.slice(0, 7) : v; mask.set(nv); closeList(); onChange && onChange(nv); });
          body.append(c);
        }
        cal.append(body);
      };
      draw();
      document.body.append(cal);
      openList = { node: cal, owner: wrap, close: () => cal.remove() };
    };
    press(btn, () => (openList && openList.owner === wrap ? closeList() : pickCalendar()));
    wrap.value = () => input.value.trim();
    wrap.set = (v) => mask.set(v);
    wrap.input = input;
    return wrap;
  }

  function inputbox(name, value = '', { cls = '', placeholder, readonly, onChange, maxlength } = {}) {
    const input = el('input', { class: 'cl-text', type: 'text', 'aria-label': name, spellcheck: 'true', tabindex: 0,
      'data-ndid': ndid(), value, placeholder: placeholder || null, readonly: readonly || null, maxlength: maxlength || null, autocomplete: 'off' });
    const wrap = el('div', { class: `cl-control cl-inputbox ${cls} ${readonly ? 'cl-readonly' : ''}`.trim(), id: uid(), 'data-ndid': uid() }, input);
    if (onChange) input.addEventListener('change', () => onChange(input.value));
    wrap.value = () => input.value.trim();
    wrap.set = (v) => { input.value = v; };
    wrap.input = input;
    return wrap;
  }
  // two-digit time part (신청시작시 / 신청시작분 …)
  const numbox = (name, value = '', opts = {}) => inputbox(name, value, { cls: 'cl-numberbox ' + (opts.cls || ''), maxlength: 2, ...opts });

  function textarea(name, value = '', { cls = '', placeholder, onChange, readonly } = {}) {
    const t = el('textarea', { class: 'cl-text', 'aria-label': name, tabindex: 0, placeholder: placeholder || null, readonly: readonly || null, 'data-ndid': ndid() });
    t.value = value;
    const wrap = el('div', { class: `cl-control cl-textarea ${cls}`.trim(), id: uid(), 'data-ndid': uid() }, t);
    if (onChange) t.addEventListener('change', () => onChange(t.value));
    wrap.value = () => t.value.trim();
    wrap.set = (v) => { t.value = v; };
    wrap.input = t;
    return wrap;
  }

  // checkbox: the icon carries role/name; `text` is the visible caption (real: "휴일" next to "휴일 선택")
  function checkbox(name, checked = false, { onChange, text, disabled } = {}) {
    const icon_ = el('div', { class: 'cl-checkbox-icon', role: 'checkbox', 'aria-checked': String(checked), 'aria-label': name,
      tabindex: 0, 'data-role': 'checkbox', 'data-ndid': ndid(), 'aria-disabled': disabled ? 'true' : null });
    const wrap = el('div', { class: `cl-control cl-checkbox ${disabled ? 'cl-disabled' : ''}`.trim(), id: uid(), 'data-ndid': uid() },
      icon_, text === '' ? null : el('div', { class: 'cl-text', text: text ?? name }));
    press(icon_, () => { const v = icon_.getAttribute('aria-checked') !== 'true'; icon_.setAttribute('aria-checked', String(v)); onChange && onChange(v); });
    wrap.value = () => icon_.getAttribute('aria-checked') === 'true';
    wrap.set = (v) => icon_.setAttribute('aria-checked', String(!!v));
    return wrap;
  }

  function radios(name, items, value, { onChange } = {}) {
    const wrap = el('div', { class: 'cl-control cl-radiobutton', role: 'radiogroup', 'aria-label': name, id: uid(), 'data-ndid': uid() });
    let cur = value ?? items[0];
    const nodes = items.map((it, i) => {
      const ic = el('div', { class: 'cl-radiobutton-icon', role: 'radio', 'aria-checked': String(it === cur), 'aria-label': it,
        'data-role': 'radio', 'data-value': String(i + 1), tabindex: 0, 'data-ndid': ndid() });
      press(ic, () => { cur = it; nodes.forEach((n) => n.setAttribute('aria-checked', String(n === ic))); onChange && onChange(it); });
      wrap.append(el('div', { class: 'cl-radiobutton-item' }, ic, el('div', { class: 'cl-text', text: it })));
      return ic;
    });
    wrap.value = () => cur;
    return wrap;
  }

  // ── grid ──
  // columns: "이름" or {name, group, width, align, link}. A group puts a two-level header over its columns
  // ("초과근무 신청시간" over 시작시간/종료시간/시간합). Rows past 14 are virtualized like the real grid.
  // editors: {열: [선택지]} → combobox in the cell; {열: {kind: 'textarea' | 'text', rows}} → text typed in the cell
  // (학생부 문구 입력 화면). onEdit(rowIndex, key, value) fires on every keystroke.
  // scrollbar: true → the 4세대 NEIS 학생부 grid as captured on 2026-11-23 (과목별세부능력및특기사항): only the rows in view
  // are in the DOM (always virtual), rows sit in a [data-role=scroll-container] that does not scroll itself, and the
  // scrolling is done by a separate .cl-scrollbar next to it (wheel over the rows is forwarded to it). Text cells hold
  // no <textarea> until clicked (div.cl-control.cl-textarea > .cl-text); the editor goes away again on blur.
  // Columns may set idx (data-cellindex), aria (name used in the cell aria-label) and hidden (in the row, not the header).
  function grid(label, columns, { select = false, editors = {}, height = 300, onRowClick, onLink, onEdit, rowHeight = 34, virtual = true,
    scrollbar = false,
    emptyText = '조회된 데이터가 없습니다.', selectAllLabel = '행 전체선택',
    checkLabel = (n, last) => `${n}행${last ? ' 마지막 행' : ''} 선택 행선택 체크박스` } = {}) {
    let rows = [];
    let checked = new Set();
    let current = -1;
    const edits = new Map();
    let ROW_H = rowHeight;
    const norm = (c) => (typeof c === 'string' ? { name: c } : c);
    const cols = (select ? [{ name: '선택', width: 44, idx: 0 }] : []).concat(columns.map(norm).filter((c) => c.name !== '선택'));
    const shown = cols.filter((c) => !c.hidden);
    const cidx = (c, ci) => (c.idx ?? ci);
    const aname = (c) => c.aria || c.name.replace(/\s+/g, '');
    const plain = (n) => n.replace(/\s+/g, '');
    const groups = cols.some((c) => c.group);
    const tmpl = shown.map((c) => (c.width ? `${c.width}px` : 'minmax(64px, 1fr)')).join(' ');
    const g = el('div', { class: 'cl-control cl-grid', role: 'grid', 'aria-label': label, 'aria-colcount': cols.length,
      'aria-rowcount': 1, 'aria-readonly': Object.keys(editors).length ? null : 'true', id: uid(), 'data-ndid': uid(),
      style: { height: height + 'px' } });
    const head = el('div', { class: 'cl-grid-header', style: { gridTemplateColumns: tmpl } });
    let allBox = null;
    shown.forEach((c, i) => {
      const span = groups && !c.group ? { gridRow: '1 / span 2' } : {};
      if (c.group && (i === 0 || shown[i - 1].group !== c.group)) {
        const n = shown.filter((x) => x.group === c.group).length;
        head.append(el('div', { class: 'cl-grid-cell cl-grid-group', role: 'columnheader', 'aria-label': c.group,
          style: { gridColumn: `${i + 1} / span ${n}`, gridRow: '1' } }, el('div', { class: 'cl-text', text: c.group })));
      }
      const pos = c.group ? { gridColumn: String(i + 1), gridRow: '2' } : { gridColumn: String(i + 1), ...span };
      let inner = el('div', { class: 'cl-text cl-grid-cell-inherit', text: c.name });
      if (c.name === '선택' && select) {
        allBox = el('span', { class: 'cl-checkbox-icon', role: 'checkbox', 'aria-checked': 'false', 'aria-label': selectAllLabel, tabindex: 0 });
        press(allBox, () => {
          const on = allBox.getAttribute('aria-checked') !== 'true';
          checked = on ? new Set(rows.map((_, i2) => i2)) : new Set();
          allBox.setAttribute('aria-checked', String(on)); draw();
        });
        inner = allBox;
      }
      head.append(el('div', { class: 'cl-grid-cell cl-grid-cell-inherit' + (i === 0 ? ' cl-first-column' : ''), role: 'columnheader',
        'data-role': 'columnheader', 'data-cellindex': cidx(c, i), 'aria-label': c.name, 'aria-readonly': 'true', tabindex: -1, style: pos }, inner));
    });
    const view = el('div', { class: 'cl-grid-rows' });
    const minW = shown.reduce((a, c) => a + (c.width || 64), 0) + 'px';
    let body, spacer, sb = null, sbInner = null;
    if (scrollbar) {
      // detail band: rowgroup > scroll-container (no own scrolling) > rows, and .cl-blank > .cl-scrollbar beside it
      const sc = el('div', { 'data-role': 'scroll-container', class: 'cl-grid-sc' }, el('div', {}, el('div', { class: 'cl-grid-cell-inherit' }, view)));
      sbInner = el('div', { class: 'cl-scrollbar-inner' });
      sb = el('div', { class: 'cl-scrollbar', 'data-ndid': uid() }, sbInner);
      body = el('div', { class: 'cl-grid-detail cl-grid-detail-band' },
        el('div', { 'data-role': 'rowgroup', 'data-loc': 'middle', class: 'cl-grid-rowgroup' }, sc, el('div', { class: 'cl-blank cl-scrollbar-wrap' }, sb)));
      spacer = sbInner;
      // 행 상자는 스스로 움직이지 않는다 (scrollIntoView 로 가려진 행을 끌어올릴 수 없다: 정식 나이스 2026-11-24)
      sc.addEventListener('scroll', () => { if (sc.scrollTop || sc.scrollLeft) { sc.scrollTop = 0; sc.scrollLeft = 0; } });
      // 정식 나이스처럼 막대는 행 단위로만 멈춘다: 행 높이보다 작은 이동은 되돌린다 (2026-11-24 시험)
      let snapping = false;
      sb.addEventListener('scroll', () => {
        if (snapping) { snapping = false; return; }
        const snapped = Math.round(sb.scrollTop / ROW_H) * ROW_H;
        const atEndNow = sb.scrollTop + sb.clientHeight >= sb.scrollHeight - 1;
        if (!atEndNow && Math.abs(snapped - sb.scrollTop) > 1) { snapping = true; sb.scrollTop = snapped; }
        draw();
      });
      body.addEventListener('wheel', (ev) => { if (ev.target.closest('textarea')) return; sb.scrollTop += ev.deltaY; ev.preventDefault(); }, { passive: false });
    } else {
      body = el('div', { class: 'cl-grid-body' });
      spacer = el('div', { class: 'cl-grid-spacer' });
      body.append(spacer, view);
    }
    // wide grids scroll sideways as one piece (header + rows), like the real one
    head.style.minWidth = minW; body.style.minWidth = minW; view.style.minWidth = minW;
    const gscroll = el('div', { class: 'cl-grid-scroll' }, el('div', { class: 'cl-grid-head-wrap' }, head), body);
    g.append(gscroll);
    // 학생부 표는 세로로 통째로 밀리지 않는다 (scrollIntoView 가 가려진 행을 끌어올리지 못하게)
    if (scrollbar) gscroll.addEventListener('scroll', () => { if (gscroll.scrollTop) gscroll.scrollTop = 0; });
    const scrollTop = () => (sb ? sb.scrollTop : body.scrollTop);
    const valueOf = (ri, c) => (edits.get(ri) && c in edits.get(ri) ? edits.get(ri)[c] : rows[ri][c]);
    const visibleRows = () => (scrollbar ? Math.max(1, Math.ceil((height - 40) / ROW_H)) : Math.max(4, Math.floor((height - 40) / ROW_H)));
    let VISIBLE = visibleRows();
    function draw() {
      view.textContent = '';
      if (!rows.length) {
        view.append(el('div', { class: 'cl-grid-empty' }, icon('search', 'empty-ico'), el('div', { class: 'cl-text', text: emptyText })));
        spacer.style.height = '0px';
        return;
      }
      if (scrollbar) {
        // the real grid keeps whole rows only: rows [first, first + VISIBLE) and the scrollbar snaps to row steps
        const first = Math.max(0, Math.min(Math.floor(scrollTop() / ROW_H), rows.length - VISIBLE));
        // 보이는 행 뒤로 몇 행을 더 그려 둔다 (정식 나이스: 7행쯤 그리고 아래 행은 가려진 채)
        const end = Math.min(rows.length, first + VISIBLE + 3);
        spacer.style.height = (Math.max(rows.length - VISIBLE, 0) * ROW_H + (height - 40)) + 'px';
        for (let ri = first; ri < end; ri++) view.append(drawRow(ri));
        // 끝까지 내리면 마지막 행이 아래에 딱 맞게 보인다
        const sc0 = view.closest('[data-role="scroll-container"]');
        const over = sb && sc0 && sb.scrollTop + sb.clientHeight >= sb.scrollHeight - 1 ? (end - first) * ROW_H - sc0.clientHeight : 0;
        view.style.transform = over > 0 ? `translateY(${-over}px)` : '';
        return;
      }
      const virt = virtual && rows.length > 14;
      const first = virt ? Math.min(Math.max(0, Math.floor(body.scrollTop / ROW_H)), rows.length - VISIBLE) : 0;
      const end = virt ? Math.min(rows.length, first + VISIBLE + 1) : rows.length;
      spacer.style.height = virt ? (rows.length * ROW_H) + 'px' : '0px';
      view.style.transform = virt ? `translateY(${first * ROW_H}px)` : '';
      for (let ri = first; ri < end; ri++) view.append(drawRow(ri));
    }
    function drawRow(ri) {
      {
        const n = ri + 1, last = ri === rows.length - 1;
        const pre = `${n}행${last ? ' 마지막 행' : ''}`;
        const tr = el('div', { class: 'cl-grid-row' + (ri % 2 ? ' cl-even-row' : ' cl-odd-row') + (ri === current ? ' cl-selected' : '') + (scrollbar ? ' cl-viewing' : ''),
          role: 'row', 'aria-rowindex': n + 1, 'data-rowindex': scrollbar ? ri : null, 'data-vrowindex': scrollbar ? ri : null, 'aria-selected': ri === current ? 'true' : null, style: { gridTemplateColumns: tmpl } });
        cols.forEach((c, ci) => {
          let inner;
          if (c.name === '선택' && select) {
            inner = el('span', { class: 'cl-checkbox-icon', role: 'checkbox', 'aria-checked': String(checked.has(ri)),
              'aria-label': checkLabel(n, last), tabindex: 0, 'data-role': 'checkbox' });
            press(inner, (ev) => { ev.stopPropagation(); checked.has(ri) ? checked.delete(ri) : checked.add(ri);
              inner.setAttribute('aria-checked', String(checked.has(ri))); });
            tr.append(el('div', { class: 'cl-grid-cell cl-first-column', role: 'gridcell', 'data-role': 'gridcell', 'data-cellindex': cidx(c, ci) },
              el('div', { class: 'cl-checkbox cl-builtin' }, inner)));
            return;
          }
          const k = c.key || c.name;
          const v = valueOf(ri, k) ?? '';
          const ed = editors[c.name];
          const textEd = ed && !Array.isArray(ed);
          let cell = el('div', { class: 'cl-grid-cell cl-grid-cell-inherit' + (c.align ? ' text-' + c.align : '') + (textEd ? ' cl-edit-cell' : ''), role: 'gridcell', 'data-role': 'gridcell',
            'data-cellindex': cidx(c, ci), 'data-key': k, 'aria-label': textEd && !scrollbar ? `${pre} ${aname(c)}` : `${pre} ${aname(c)} ${v}`, tabindex: -1,
            style: c.hidden ? { display: 'none' } : null });
          if (textEd && scrollbar) {
            // no editor until the cell is clicked (real 4세대 grid); the editor is dropped again on blur
            const show = (val) => el('div', { class: 'cl-text', text: String(val) });
            inner = el('div', { class: `cl-control ${ed.kind === 'textarea' ? 'cl-textarea' : 'cl-inputbox'} cl-grid-ctrl-inherit` }, show(v));
            const open = () => {
              if (inner.querySelector('textarea, input')) return;
              const box = ed.kind === 'textarea'
                ? el('textarea', { class: 'cl-text cl-grid-textarea', 'aria-label': `${pre} ${aname(c)}`, spellcheck: 'false' })
                : el('input', { class: 'cl-text cl-grid-input', type: 'text', 'aria-label': `${pre} ${aname(c)}`, autocomplete: 'off' });
              box.value = String(valueOf(ri, k) ?? '');
              box.addEventListener('input', () => {
                const e = edits.get(ri) || {}; e[k] = box.value; edits.set(ri, e);
                onEdit && onEdit(ri, k, box.value);
              });
              box.addEventListener('click', (ev) => ev.stopPropagation());
              box.addEventListener('blur', () => setTimeout(() => {
                if (!box.isConnected || document.activeElement === box) return;
                const val = valueOf(ri, k) ?? '';
                inner.replaceChildren(show(val));
                cell.setAttribute('aria-label', `${pre} ${aname(c)} ${val}`);
              }, 0));
              inner.replaceChildren(box);
              // 정식 나이스처럼 입력칸을 열면서 칸을 새로 그린다: 미리 잡아 둔 칸은 문서에서 빠진다 (2026-11-24 시험)
              const fresh = cell.cloneNode(false);
              fresh.append(inner);
              bind(fresh);
              cell.replaceWith(fresh);
              cell = fresh;
              selectRow(ri, tr);
              box.focus();
            };
            // 정식 나이스처럼: click 만으로는 표에 포커스만 가고, 누르기(mousedown)가 있어야 입력칸이 열린다 (2026-11-24 시험)
            const bind = (node) => {
              node.addEventListener('click', () => { if (!inner.querySelector('textarea, input')) g.focus(); });
              node.addEventListener('mousedown', (ev) => {
                if (ev.target.closest('textarea, input')) return;
                ev.preventDefault();
                // 정식 나이스처럼: 아래가 가려진 행을 누르면 그 행이 보이게 표만 움직이고 입력칸은 안 열린다
                const vb = sb.closest('[data-loc="middle"]').getBoundingClientRect(), cb = node.getBoundingClientRect();
                if (cb.bottom > vb.bottom + 1) { sb.scrollTop += Math.ceil((cb.bottom - vb.bottom) / ROW_H) * ROW_H; return; }
                open();
              });
            };
            bind(cell);
          } else if (textEd) {
            inner = ed.kind === 'textarea'
              ? el('textarea', { class: 'cl-text cl-grid-textarea', 'aria-label': `${pre} ${plain(c.name)}`, tabindex: 0, spellcheck: 'false' })
              : el('input', { class: 'cl-text cl-grid-input', type: 'text', 'aria-label': `${pre} ${plain(c.name)}`, tabindex: 0, autocomplete: 'off' });
            inner.value = String(v);
            inner.addEventListener('input', () => {
              const e = edits.get(ri) || {}; e[k] = inner.value; edits.set(ri, e);
              onEdit && onEdit(ri, k, inner.value);
            });
            inner.addEventListener('click', (ev) => ev.stopPropagation());
            inner.addEventListener('focus', () => selectRow(ri, tr));
          } else if (ed) {
            inner = combo(plain(c.name), editors[c.name], v, { labelPrefix: pre, onChange: (nv) => {
              const e = edits.get(ri) || {}; e[k] = nv; edits.set(ri, e);
              cell.setAttribute('aria-label', `${pre} ${plain(c.name)} ${nv}`);
            } });
          } else if (c.link && v !== '') {
            inner = el('div', { class: 'cl-control cl-output text-underline', 'aria-label': `${pre} ${plain(c.name)} ${v}` }, el('div', { class: 'cl-text', text: String(v) }));
            inner.addEventListener('click', (ev) => { ev.stopPropagation(); onLink && onLink(rows[ri], ri, c.name); });
          } else inner = el('div', { class: 'cl-control cl-default-cell' }, el('div', { class: 'cl-text', text: String(v) }));
          cell.append(inner);
          tr.append(cell);
        });
        tr.addEventListener('click', () => { selectRow(ri, tr); onRowClick && onRowClick(rows[ri], ri); });
        return tr;
      }
    }
    // selecting a row only moves the highlight: redrawing would drop the focus of a cell being typed in
    function selectRow(ri, tr) {
      if (current === ri) return;
      view.querySelectorAll('.cl-grid-row.cl-selected').forEach((x) => { x.classList.remove('cl-selected'); x.removeAttribute('aria-selected'); });
      current = ri; tr.classList.add('cl-selected'); tr.setAttribute('aria-selected', 'true');
    }
    if (!scrollbar) body.addEventListener('scroll', () => { if (virtual && rows.length > 14) draw(); });
    // update one shown cell (a byte counter next to the text being typed) without redrawing the row
    g.setCell = (ri, key, value) => {
      if (rows[ri]) rows[ri][key] = value;
      const cell = view.querySelector(`[aria-rowindex="${ri + 2}"] [data-key="${CSS.escape(key)}"]`);
      if (!cell) return;
      const t = cell.querySelector('.cl-text');
      if (t) t.textContent = String(value);
      cell.setAttribute('aria-label', cell.getAttribute('aria-label').replace(/^(\S+행(?: 마지막 행)? \S+).*$/, `$1 ${value}`));
    };
    g.setRowHeight = (h) => { ROW_H = h; VISIBLE = visibleRows(); g.style.setProperty('--row-h', h + 'px'); draw(); };
    g.value = (ri, key) => valueOf(ri, key);
    g.setEdit = (ri, key, v) => { const e = edits.get(ri) || {}; e[key] = v; edits.set(ri, e); onEdit && onEdit(ri, key, v); draw(); };
    g.style.setProperty('--row-h', ROW_H + 'px');
    g.setRows = (r, { keep = false } = {}) => {
      rows = r; if (!keep) { checked = new Set(); current = -1; } edits.clear();
      g.setAttribute('aria-rowcount', r.length + 1); if (!keep) { if (sb) sb.scrollTop = 0; else body.scrollTop = 0; }
      if (allBox) allBox.setAttribute('aria-checked', 'false'); draw(); g.dispatchEvent(new CustomEvent('rows'));
    };
    g.selected = () => [...checked].sort((a, b) => a - b).map((i) => rows[i]);
    g.checkedIdx = () => [...checked].sort((a, b) => a - b);
    g.current = () => current;
    g.setCurrent = (i) => { current = i; draw(); };
    g.edits = () => [...edits.entries()].map(([ri, e]) => ({ row: rows[ri], changes: e }));
    g.rows = () => rows;
    g.redraw = draw;
    draw();
    return g;
  }

  // ── dialogs (modal mask blocks the page behind, like cl-dialog) ──
  const stack = [];
  function dialog(title, build, { width = 520, height, closable = true, kind = 'popup' } = {}) {
    const mask = el('div', { class: 'cl-dialog-modal' });
    const bodyEl = el('div', { class: 'cl-dialog-body' });
    const d = el('div', { class: `cl-control cl-dialog cl-resizable cl-focus ${kind === 'popup' ? '' : 'modal-msg' + (kind === 'error' ? ' modal-msg-danger' : '')}`.trim(),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: -1, id: uid(), 'data-ndid': uid(),
      style: { width: width + 'px', height: height ? height + 'px' : null } },
    el('div', { class: 'cl-dialog-header cl-movable cl-unselectable' },
      kind === 'error' ? icon('error', 'err-ico') : null, el('div', { class: 'cl-text', text: title }),
      closable ? button('닫기', () => close(), { cls: 'cl-dialog-close', iconOnly: true, ico: 'close' }) : null),
    el('div', { class: 'cl-dialog-body-wrapper' }, bodyEl));
    const close = (v) => {
      if (!d.isConnected) return;
      mask.remove(); d.remove(); stack.splice(stack.indexOf(d), 1); d.dispatchEvent(new CustomEvent('closed', { detail: v }));
    };
    document.body.append(mask, d);
    stack.push(d);
    build(bodyEl, close);
    setTimeout(() => d.focus(), 0);
    d.close = close;
    return d;
  }
  function message(msg, title, kind) {
    return new Promise((res) => {
      const d = dialog(title, (b, close) => {
        const [first, ...rest] = String(msg).split('\n');
        b.append(el('div', { class: 'msg-text' }, output(first, { cls: 'fw-bold' }), rest.length ? output(rest.join('\n'), { cls: 'text-break' }) : null),
          el('div', { class: 'btn-row' }, button('확인', () => close(true), { cls: 'btn-secondary' })));
      }, { width: 420, closable: false, kind });
      d.addEventListener('closed', () => res(true));
    });
  }
  const alert = (msg, title = '알림') => message(msg, title, 'msg');
  const error = (msg, title = '에러') => message(msg, title, 'error');
  function confirm(msg, title = '확인') {
    return new Promise((res) => {
      const d = dialog(title, (b, close) => {
        b.append(el('div', { class: 'msg-text' }, output(msg, { cls: 'fw-bold' })),
          el('div', { class: 'btn-row' }, button('확인', () => close(true), { cls: 'btn-secondary' }), button('취소', () => close(false), { cls: 'btn-outline' })));
      }, { width: 420, closable: false, kind: 'msg' });
      d.addEventListener('closed', (ev) => res(!!ev.detail));
    });
  }
  function busy(on, host = document.body) {
    const m = host.querySelector(':scope > .cl-loadmask');
    if (on && !m) host.append(el('div', { class: 'cl-loadmask', 'aria-busy': 'true' }, el('div', { class: 'spinner' }), el('div', { class: 'cl-text', text: '처리중입니다.' })));
    if (!on && m) m.remove();
  }
  async function api(name, body = {}) {
    const r = await fetch('/neis/api/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  return { uid, ndid, el, press, icon, button, output, label, combo, dateinput, inputbox, numbox, textarea, checkbox, radios, grid,
    dialog, alert, error, confirm, busy, api, closeList, iso };
})();
