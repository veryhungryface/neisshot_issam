// Nexacro-style components for the mock K-에듀파인 (연습용).
// Follows the captured DOM: absolute divs, dotted hierarchical ids ("<window>.form.divWork.form.edtCnsulSj"),
// component root classes (Button, Edit, Combo, Calendar, CheckBox, Radio, TextArea, Grid, Static),
// inner nexainput "<id>:input", accessible labels with a trailing space, grid body marked role="gridcell".
'use strict';
const NX = (() => {
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
    return e;
  }
  const lab = (s) => ` ${s} `.replace(/^ /, '');   // trailing space, as in the real aria-labels
  const press = (node, fn) => {
    node.addEventListener('click', (ev) => { if (node.getAttribute('aria-disabled') === 'true') return; fn(ev); });
    node.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); node.click(); } });
  };

  function Button(id, label, onClick, { cls = '' } = {}) {
    const b = el('div', { class: `Button ${cls}`.trim(), id, role: 'button', tabindex: 0, 'aria-label': lab(label), status: 'enabled' },
      el('div', { class: 'nexacontentsbox', id: id + ':icontext', text: label }));
    if (onClick) press(b, onClick);
    return b;
  }
  function Static(id, text, { cls = '' } = {}) {
    return el('div', { class: `Static ${cls}`.trim(), id }, el('div', { class: 'nexacontentsbox', id: id + ':text', text }));
  }
  function Edit(id, label, { value = '', readonly = false, required = false, cls = '' } = {}) {
    const input = el('input', { class: 'nexainput', id: id + ':input', type: 'text', autocomplete: 'off', readonly: readonly || null });
    input.value = value;
    const e = el('div', { class: `Edit ${cls}`.trim(), id, 'aria-label': lab(required ? `${label}(필수입력)` : label) }, input);
    e.value = () => input.value.trim();
    e.set = (v) => { input.value = v; };
    e.input = input;
    return e;
  }
  let openPop = null;
  const closePop = () => { if (openPop) { openPop.remove(); openPop = null; } };
  document.addEventListener('mousedown', (ev) => { if (openPop && !openPop.contains(ev.target) && !ev.target.closest('.dropbutton, .Combo')) closePop(); });
  function popAt(anchor, node) {
    closePop();
    const r = anchor.getBoundingClientRect();
    Object.assign(node.style, { position: 'fixed', left: r.left + 'px', top: r.bottom + 'px', minWidth: r.width + 'px', zIndex: 2000 });
    document.body.append(node);
    openPop = node;
  }
  function Combo(id, label, options, { value, required = false, onChange } = {}) {
    let cur = value ?? options[0];
    const input = el('input', { class: 'nexainput', id: id + '.comboedit:input', type: 'text', readonly: true });
    const c = el('div', { class: 'Combo', id, role: 'combobox', tabindex: 0, 'aria-expanded': 'false',
      'aria-label': lab(required ? `${label}(필수입력)` : label) },
    el('div', { class: 'EditControl', id: id + '.comboedit' }, input),
    el('div', { class: 'ButtonControl dropbutton', id: id + '.dropbutton' }));
    const set = (v) => { cur = v; input.value = v; c.dataset.value = v; onChange && onChange(v); };
    set(cur);
    const open = () => {
      const list = el('div', { class: 'ComboListControl', id: id + '.combolist', role: 'listbox' });
      options.forEach((o, i) => {
        const it = el('div', { class: 'ListBoxItemControl', id: `${id}.combolist.item_${i}`, role: 'option', 'aria-selected': String(o === cur), text: o });
        it.addEventListener('click', () => { set(o); closePop(); c.setAttribute('aria-expanded', 'false'); });
        list.append(it);
      });
      popAt(c, list);
      c.setAttribute('aria-expanded', 'true');
    };
    press(c, () => (c.getAttribute('aria-expanded') === 'true' ? (closePop(), c.setAttribute('aria-expanded', 'false')) : open()));
    c.value = () => cur;
    c.set = set;
    return c;
  }
  function Calendar(id, label, { value = '', required = false } = {}) {
    const input = el('input', { class: 'nexainput', id: id + '.calendaredit:input', type: 'text', placeholder: 'YYYY-MM-DD' });
    input.value = value;
    const mask = el('div', { class: 'MaskEditControl', id: id + '.calendaredit', 'aria-label': lab(required ? `${label}(필수입력)` : label) }, input);
    const drop = el('div', { class: 'ButtonControl dropbutton', id: id + '.dropbutton', role: 'button', tabindex: 0, 'aria-label': lab('달력') });
    const c = el('div', { class: 'Calendar', id }, mask, drop);
    press(drop, () => {
      const base = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? new Date(input.value + 'T00:00') : new Date('2026-10-11T00:00');
      const y = base.getFullYear(), m = base.getMonth();
      const pick = el('div', { class: 'DatePickerControl', id: id + '.datepicker', 'aria-label': `${y}년 ${m + 1}월` });
      for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
        const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const day = el('div', { class: 'DayItemControl', role: 'button', tabindex: -1, 'aria-label': `${y}년 ${m + 1}월 ${d}일`, text: String(d) });
        day.addEventListener('click', () => { input.value = iso; closePop(); });
        pick.append(day);
      }
      popAt(c, pick);
    });
    c.value = () => input.value.trim();
    c.input = input;
    return c;
  }
  function CheckBox(id, label, { checked = false } = {}) {
    const c = el('div', { class: 'CheckBox', id, role: 'checkbox', tabindex: 0, 'aria-checked': String(checked), 'aria-label': lab(label) },
      el('div', { class: 'CheckBoxControl', id: id + '.chkimg' }), el('div', { class: 'nexacontentsbox', text: label }));
    press(c, () => c.setAttribute('aria-checked', String(c.getAttribute('aria-checked') !== 'true')));
    c.value = () => c.getAttribute('aria-checked') === 'true';
    return c;
  }
  function Radio(id, label, items, { value } = {}) {
    let cur = value ?? items[0];
    const r = el('div', { class: 'Radio', id, role: 'radiogroup', 'aria-label': `${label}  radio` });
    items.forEach((it, i) => {
      const n = el('div', { class: 'RadioItemControl', id: `${id}.radioitem${i}`, role: 'radio', tabindex: 0, 'aria-checked': String(it === cur), 'aria-label': ` ${it} ` },
        el('div', { class: 'RadioItemIconControl' }), el('div', { class: 'nexacontentsbox', text: it }));
      press(n, () => { cur = it; r.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === n))); });
      r.append(n);
    });
    r.value = () => cur;
    return r;
  }
  function TextArea(id, label, { required = false } = {}) {
    const ta = el('textarea', { class: 'nexatextarea', id: id + ':textarea' });
    const t = el('div', { class: 'TextArea', id, 'aria-label': lab(required ? `${label}(필수입력)` : label) }, ta);
    t.value = () => ta.value.trim();
    t.input = ta;
    return t;
  }
  // Grid: head/body bands, cells "<grid>.body.gridrow_N.cell_N_M", body container role="gridcell" (as captured).
  function Grid(id, columns, { editable = [], tree = false, rowsVisible = 12 } = {}) {
    let rows = [];
    let current = -1;
    const g = el('div', { class: 'Grid', id, 'aria-label': `${id.split('.').pop()} 표시작 ` });
    const head = el('div', { class: 'GridBandControl head', id: id + '.head' },
      el('div', { class: 'GridRowControl', id: id + '.head.gridrow_-1' },
        columns.map((c, j) => el('div', { class: 'GridCellControl', id: `${id}.head.gridrow_-1.cell_-1_${j}`, 'aria-label': ` ${c} `, tabindex: -1 },
          el('div', { id: `${id}.head.gridrow_-1.cell_-1_${j}:text`, text: c })))));
    const body = el('div', { class: 'GridBandControl body', id: id + '.body', role: 'gridcell' });
    g.append(head, body);
    const draw = () => {
      body.textContent = '';
      if (!rows.length) { body.append(el('div', { class: 'nodata', text: '조회된 데이터가 없습니다.' })); return; }
      rows.slice(0, 200).forEach((row, i) => {
        const r = el('div', { class: 'GridRowControl' + (i === current ? ' selected' : ''), id: `${id}.body.gridrow_${i}` });
        columns.forEach((c, j) => {
          const v = row[j] ?? '';
          const cid = `${id}.body.gridrow_${i}.cell_${i}_${j}`;
          const cell = el('div', { class: 'GridCellControl cell' + (i % 2 ? ' oddcell' : ''), id: cid, tabindex: -1, 'aria-label': `${v} `,
            'aria-readonly': editable.includes(c) ? 'false' : 'true' }, el('div', { id: cid + ':text', text: String(v) }));
          cell.addEventListener('click', () => {
            current = i;
            body.querySelectorAll('.GridRowControl').forEach((x) => x.classList.toggle('selected', x === r));
            if (!editable.includes(c) || cell.querySelector('input')) return;
            const inp = el('input', { class: 'nexainput', id: cid + ':edit', type: 'text', 'aria-label': ` ${c} ` });
            inp.value = row[j] ?? '';
            cell.firstChild.replaceWith(inp);
            inp.focus();
            const done = () => { row[j] = inp.value; cell.setAttribute('aria-label', `${inp.value} `); draw(); };
            inp.addEventListener('blur', done);
            inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); inp.blur(); } });
          });
          r.append(cell);
        });
        body.append(r);
      });
    };
    g.setRows = (rs) => { rows = rs.map((r) => [...r]); current = -1; draw(); };
    g.addRow = (r) => { rows.push(r || columns.map(() => '')); current = rows.length - 1; draw(); };
    g.removeCurrent = () => { if (current >= 0) { rows.splice(current, 1); current = -1; draw(); return true; } return false; };
    g.rows = () => rows;
    g.columns = columns;
    draw();
    return g;
  }
  return { el, press, Button, Static, Edit, Combo, Calendar, CheckBox, Radio, TextArea, Grid, closePop };
})();
