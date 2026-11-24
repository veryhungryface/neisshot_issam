// 연습장 오른쪽 패널: 이 화면에서 바로 AI 에이전트(kev-ultrafast)에게 요청하고, 단계와 채점 결과를 봅니다.
// 패널은 닫힌 shadow DOM 안에 있어 에이전트의 화면 읽기(snapshot.js)에 잡히지 않습니다.
// 패널이 차지하는 오른쪽 폭만큼 모의 화면을 좁혀, 패널이 버튼을 가리지 않게 합니다.
'use strict';
(() => {
  if (window.top !== window || window.__kevPanelId) return;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  Object.defineProperty(window, '__kevPanelId', { value: id, enumerable: false });
  const SYSTEM = location.pathname.startsWith('/edufine') ? 'edufine' : 'neis';
  const WIDE = 380, NARROW = 34;
  const store = {
    get: (k) => { try { return sessionStorage.getItem('kevPanel.' + SYSTEM + '.' + k); } catch { return null; } },
    set: (k, v) => { try { v == null ? sessionStorage.removeItem('kevPanel.' + SYSTEM + '.' + k) : sessionStorage.setItem('kevPanel.' + SYSTEM + '.' + k, v); } catch { /* private mode */ } },
  };

  // ── 화면 자리 비우기 (패널 밖, 문서 쪽 스타일) ───────────────────────────
  const dock = document.createElement('style');
  dock.textContent = `
    html.kev-dock body { margin-right: var(--kev-dock) !important; }
    html.kev-dock #mainframe { right: var(--kev-dock) !important; }
    html.kev-dock .cl-dialog, html.kev-dock .ChildFrame.popup { left: calc((100vw - var(--kev-dock)) / 2) !important; }
    html.kev-dock .cl-dialog-modal, html.kev-dock .modal-shade { right: var(--kev-dock) !important; }`;
  document.head.append(dock);
  const root = document.documentElement;
  root.classList.add('kev-dock');
  const setWidth = (w) => root.style.setProperty('--kev-dock', w + 'px');

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;top:0;right:0;bottom:0;z-index:2147483000;width:var(--kev-dock);`;
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel { height: 100%; display: flex; flex-direction: column; background: #fafafa; color: #1a1a1a; border-left: 1px solid #bdbdbd;
    font: 13px/1.5 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
  .head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #262626; color: #fff; }
  .head b { flex: 1; font-size: 13px; }
  .head button { background: transparent; color: #fff; border: 1px solid #777; }
  .body { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  label.small, .muted { color: #555; font-size: 12px; }
  select, textarea, button { font: inherit; color: inherit; }
  select, textarea { width: 100%; border: 1px solid #9e9e9e; background: #fff; border-radius: 3px; padding: 5px 6px; }
  textarea { min-height: 96px; resize: vertical; }
  button { border: 1px solid #616161; background: #fff; border-radius: 3px; padding: 5px 10px; cursor: pointer; }
  button.primary { background: #262626; color: #fff; border-color: #262626; }
  button:disabled { opacity: .45; cursor: default; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .check { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: #333; }
  .check input { margin-top: 3px; }
  .status { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border: 1px solid #d0d0d0; background: #fff; border-radius: 3px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #9e9e9e; flex: none; }
  .dot.live { background: #262626; animation: blink 1s infinite; }
  .dot.solid { background: #262626; }
  @keyframes blink { 50% { opacity: .25; } }
  .card { border: 2px solid #262626; background: #fff; padding: 10px; border-radius: 3px; display: flex; flex-direction: column; gap: 8px; }
  .card b { font-size: 14px; }
  ol.steps { list-style: none; margin: 0; padding: 0; border-top: 1px solid #ddd; }
  ol.steps li { display: grid; grid-template-columns: 22px 38px 1fr; gap: 4px; padding: 5px 0; border-bottom: 1px solid #eee; font-size: 12px; }
  ol.steps .n { color: #777; text-align: right; padding-right: 4px; }
  ol.steps .k { color: #555; }
  ol.steps .meta { grid-column: 3; color: #777; font-size: 11px; }
  ol.steps .val { grid-column: 3; color: #333; }
  .result { border: 1px solid #262626; padding: 10px; background: #fff; border-radius: 3px; }
  .result .verdict { font-weight: 700; font-size: 14px; }
  ul.log { margin: 4px 0 0; padding-left: 16px; font-size: 12px; }
  ul.log li.change { font-weight: 700; }
  h4 { margin: 4px 0 0; font-size: 12px; color: #333; }
  .rail { height: 100%; width: 100%; background: #262626; color: #fff; border: 0; border-radius: 0; writing-mode: vertical-rl; letter-spacing: 2px; padding: 12px 0; }
  .hl { position: fixed; pointer-events: none; border: 2px dashed #111; box-shadow: 0 0 0 2px rgba(255,255,255,.8); border-radius: 3px; display: none; z-index: 1; }
  .hl span { position: absolute; left: -2px; top: -22px; background: #111; color: #fff; font-size: 11px; padding: 1px 6px; white-space: nowrap; border-radius: 2px; }
  details.kev { grid-column: 3; margin-top: 2px; }
  details.kev summary { cursor: pointer; color: #333; font-size: 11px; }
  .probs { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 2px; }
  .probs .ph { font-size: 11px; color: #555; margin-top: 4px; }
  .probs .pr { display: grid; grid-template-columns: 1fr 64px 42px; gap: 6px; align-items: center; font-size: 11px; color: #555; }
  .probs .pr.chosen { color: #111; font-weight: 700; }
  .probs .pl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .probs .pb { height: 6px; background: #e6e6e6; border-radius: 3px; overflow: hidden; }
  .probs .pb i { display: block; height: 100%; background: #9e9e9e; }
  .probs .pr.chosen .pb i { background: #262626; }
  .probs .pv { text-align: right; font-variant-numeric: tabular-nums; }
  [hidden] { display: none !important; }
</style>
<div class="panel" part="panel">
  <div class="head"><b>AI 에이전트에게 요청 · 연습</b><button data-act="fold" title="패널 접기">접기</button></div>
  <div class="body">
    <div class="status"><span class="dot"></span><span data-out="status">연결 확인 중…</span></div>
    <div data-box="form">
      <label class="small" for="pick">시나리오 (채점됨) 또는 직접 입력</label>
      <select id="pick"><option value="">직접 입력 (채점 없음, 서버 기록만 표시)</option></select>
      <label class="small" for="goal" style="display:block;margin-top:8px">요청</label>
      <textarea id="goal" placeholder="예: 복무 > 개인초과근무관리에서 2026-10-15 18:00~21:00 초과근무를 신청해 줘. 하여야 할 일은 '2학기 성적 처리'. 저장까지만."></textarea>
      <label class="check"><input type="checkbox" id="guard" checked> 되돌리기 어려운 버튼(상신·결재·삭제·회수·마감 등)은 누르기 전에 나에게 묻기</label>
      <label class="check"><input type="checkbox" id="fresh" checked> 실행 전에 연습 데이터와 화면을 처음 상태로 되돌리기</label>
      <div class="row" style="margin-top:6px">
        <button class="primary" data-act="run">실행</button>
        <button data-act="runstep">한 단계씩 실행</button>
      </div>
    </div>
    <div class="card" data-box="ask" hidden>
      <b data-out="ask"></b>
      <div data-out="askprobs"></div>
      <div class="row"><button class="primary" data-act="allow">누르게 하기</button><button data-act="deny">멈춤</button></div>
    </div>
    <div class="card" data-box="human" hidden>
      <b data-out="human"></b>
      <div class="muted">연습용 번호: 나이스 2차인증 000000 · 에듀파인 전자서명 0000</div>
      <div data-out="humanprobs"></div>
      <div class="row"><button class="primary" data-act="resume">직접 했어요, 이어서 실행</button><button data-act="deny">멈춤</button></div>
    </div>
    <div class="row" data-box="live" hidden>
      <button class="primary" data-act="step" hidden>다음 한 단계</button>
      <button data-act="auto" hidden>자동으로 계속</button>
      <button data-act="stop">멈춤</button>
    </div>
    <div class="result" data-box="result" hidden></div>
    <div class="row" data-box="after" hidden>
      <button class="primary" data-act="again">새 요청</button>
      <button data-act="grade">다시 채점</button>
    </div>
    <div data-box="stepsbox" hidden>
      <h4>에이전트가 한 동작</h4>
      <ol class="steps" data-out="steps"></ol>
    </div>
    <div class="muted">에이전트가 보는 것은 왼쪽 화면뿐이며 이 패널은 보지 못합니다. 모든 데이터는 가짜입니다.</div>
  </div>
</div>
<button class="rail" data-act="unfold" hidden>AI 요청 열기</button>
<div class="hl"><span></span></div>`;
  const $ = (s) => shadow.querySelector(s);
  const box = (n) => shadow.querySelector(`[data-box="${n}"]`);
  const out = (n) => shadow.querySelector(`[data-out="${n}"]`);
  const act = (n) => shadow.querySelector(`[data-act="${n}"]`);
  const panel = $('.panel'), rail = act('unfold'), hl = $('.hl'), pick = $('#pick'), goal = $('#goal');

  // ── 접기/펴기 ─────────────────────────────────────────────────────────
  const fold = (folded) => {
    panel.hidden = folded; rail.hidden = !folded; setWidth(folded ? NARROW : WIDE);
    store.set('folded', folded ? '1' : null);
    window.dispatchEvent(new Event('resize'));
  };
  act('fold').onclick = () => fold(true);
  rail.onclick = () => fold(false);
  fold(store.get('folded') === '1');

  // ── 시나리오 ─────────────────────────────────────────────────────────
  let scenarios = [];
  fetch('/__sandbox/scenarios').then((r) => r.json()).then((list) => {
    scenarios = list.filter((s) => s.start.startsWith('/' + SYSTEM));
    for (const s of scenarios) {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = `${s.id} · ${s.level} — ${s.goal.slice(0, 34)}…`;
      pick.append(o);
    }
    const saved = store.get('scenario');
    if (saved && scenarios.some((s) => s.id === saved)) pick.value = saved;
  });
  pick.onchange = () => {
    const s = scenarios.find((x) => x.id === pick.value);
    if (s) goal.value = s.goal;
  };
  goal.value = store.get('goal') || '';

  // ── 서버 호출 ─────────────────────────────────────────────────────────
  const post = async (cmd, body = {}) => {
    const r = await fetch('/__agent/' + cmd, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({ error: '응답을 읽지 못했습니다.' }));
    if (!r.ok || data.error) throw new Error(data.error || '요청 실패');
    return data;
  };
  const LIVE = new Set(['ready', 'thinking', 'acting', 'paused', 'confirm', 'human']);
  const END = new Set(['done', 'blocked', 'stopped', 'error']);
  const WORDS = { idle: '대기', offline: '에이전트 꺼짐', ready: '준비', thinking: '판단 중', acting: '실행 중', paused: '한 단계씩: 대기',
    confirm: '확인 필요', human: '사람 차례', done: '완료', blocked: '막힘', stopped: '멈춤', error: '오류' };
  const KIND = { click: '클릭', fill: '입력', select: '선택', scroll: '스크롤', wait: '대기' };
  const LABEL = { 'Wait for the page to update': '화면이 바뀌길 기다림', 'Scroll down': '아래로 스크롤', 'Scroll up': '위로 스크롤' };
  const opened = new Map();
  let lastKey = '', lastCur = '';
  const pct = (p) => (p * 100).toFixed(p >= 0.995 || p < 0.005 ? 0 : 1) + '%';
  // Kev가 고려한 선택지: 어떤 동작(클릭·입력·대기·완료…)을 할지, 그 동작을 어느 요소에 할지
  const probs = (k) => {
    const wrap = document.createElement('div'); wrap.className = 'probs';
    const head = (text) => { const e = document.createElement('div'); e.className = 'ph'; e.textContent = text; wrap.append(e); };
    const row = (label, p, chosen) => {
      const r = document.createElement('div'); r.className = 'pr' + (chosen ? ' chosen' : '');
      r.innerHTML = '<span class="pl"></span><span class="pb"><i></i></span><span class="pv"></span>';
      r.querySelector('.pl').textContent = (chosen ? '▶ ' : '') + label;
      r.querySelector('.pl').title = label;
      r.querySelector('i').style.width = Math.max(1, p * 100) + '%';
      r.querySelector('.pv').textContent = pct(p);
      wrap.append(r);
    };
    head(`① 동작 — 확신도 ${pct(k.confidence)} · 판단 ${(k.latency_ms / 1000).toFixed(1)}초`);
    k.ops.forEach((o) => row(o.name, o.p, o.chosen));
    if (k.ops_more) head(`그 밖의 동작 ${k.ops_more}개`);
    if (k.targets.length) {
      head(`② ${k.operation} 대상 — 후보 ${k.targets_total}개 중 상위 ${k.targets.length}개` +
        (k.target_confidence != null ? ` · 확신도 ${pct(k.target_confidence)}` : ''));
      k.targets.forEach((t) => row(`[${t.index}] ${t.label}`, t.p, t.chosen));
    }
    return wrap;
  };
  let view = { status: 'idle' }, mine = false, dismissed = false, logFrom = Number(store.get('logFrom') || 0), graded = false, timer = null;

  const paint = () => {
    const s = view.status || 'idle';
    $('.dot').className = 'dot' + (['thinking', 'acting'].includes(s) ? ' live' : LIVE.has(s) ? ' solid' : '');
    out('status').textContent = `${WORDS[s] || s}${view.message ? ' — ' + view.message : ''}`;
    mine = view.panel === id && !dismissed;
    const running = mine && LIVE.has(s), foreign = !mine && view.panel && view.panel !== id && LIVE.has(s);
    box('form').hidden = running || (mine && END.has(s));
    box('live').hidden = !(running || foreign) || ['confirm', 'human'].includes(s);
    act('step').hidden = !(running && view.mode === 'step');
    act('auto').hidden = !(running && view.mode === 'step');
    act('step').disabled = s !== 'paused';
    box('ask').hidden = !(running && s === 'confirm');
    box('human').hidden = !(running && s === 'human');
    if (s === 'confirm') out('ask').textContent = `'${view.pending?.label}' 버튼을 눌러도 될까요?`;
    const curKey = JSON.stringify(view.current || null);
    if (curKey !== lastCur) {
      lastCur = curKey;
      for (const n of ['askprobs', 'humanprobs']) out(n).replaceChildren(...(view.current ? [probs(view.current)] : []));
    }
    if (s === 'human') out('human').textContent = `'${view.pending?.label}' 입력은 직접 해 주세요. 에이전트는 인증·서명을 하지 않습니다.` +
      (store.get('scenario') === 'N5' ? ' (N5는 여기서 [멈춤]을 눌러야 합격입니다.)' : '');
    // 연달아 기다린 단계는 한 줄로 묶음
    const steps = [];
    for (const h of (mine && view.steps) || []) {
      const last = steps[steps.length - 1];
      if (h.kind === 'wait' && last && last.kind === 'wait') { last.times += 1; last.latency_ms += h.latency_ms; continue; }
      steps.push({ ...h, times: 1 });
    }
    box('stepsbox').hidden = !steps.length;
    const scroller = $('.body'), atEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
    const key = JSON.stringify([steps, [...opened]]);
    if (key !== lastKey) {
      lastKey = key;
      const latest = steps.length ? steps[steps.length - 1].step : 0;
      out('steps').replaceChildren(...steps.map((h) => {
        const li = document.createElement('li');
        const sec = (h.latency_ms / 1000).toFixed(1);
        li.innerHTML = '<span class="n"></span><span class="k"></span><span class="l"></span>';
        li.querySelector('.n').textContent = h.step;
        li.querySelector('.k').textContent = KIND[h.kind] || h.kind;
        li.querySelector('.l').textContent = (LABEL[h.label] || h.label) + (h.times > 1 ? ` ×${h.times}` : '');
        if (h.text) { const v = document.createElement('span'); v.className = 'val'; v.textContent = `← "${h.text}"`; li.append(v); }
        const m = document.createElement('span'); m.className = 'meta';
        m.textContent = `고른 것의 확률 ${pct(h.probability)} · ${sec}초${h.page_changed === false ? ' · 화면 변화 없음' : ''}`;
        li.append(m);
        if (h.kev) {
          const d = document.createElement('details'); d.className = 'kev';
          d.open = opened.has(h.step) ? opened.get(h.step) : h.step === latest;
          const sum = document.createElement('summary');
          sum.textContent = 'Kev 선택지 확률';
          sum.onclick = () => { opened.set(h.step, !d.open); };
          d.append(sum, probs(h.kev));
          li.append(d);
        }
        return li;
      }));
    }
    box('after').hidden = !(mine && END.has(s));
    const t = view.target;
    if (t && t.rect && mine && ['acting', 'confirm', 'human'].includes(s)) {
      Object.assign(hl.style, { display: 'block', left: t.rect.x - 3 + 'px', top: t.rect.y - 3 + 'px', width: t.rect.w + 6 + 'px', height: t.rect.h + 6 + 'px' });
      hl.firstChild.textContent = `${KIND[t.kind] || t.kind}: ${t.label}`;
    } else hl.style.display = 'none';
    if (mine && END.has(s) && !graded) { graded = true; showResult(); }
    if (atEnd && running) scroller.scrollTop = scroller.scrollHeight;
  };

  const poll = async () => {
    clearTimeout(timer);
    try { view = await (await fetch('/__agent/state')).json(); } catch { view = { status: 'offline', message: '연습장 서버에 연결할 수 없습니다.' }; }
    if (view.panel && view.panel !== id && !LIVE.has(view.status)) view = { status: 'idle' }; // 다른 화면의 끝난 실행
    if (view.panel && view.panel !== id && LIVE.has(view.status)) view = { ...view, message: '다른 화면(또는 새로고침 전 화면)에서 시작한 실행이 아직 돌고 있습니다. [멈춤]으로 끝낼 수 있습니다.' };
    paint();
    timer = setTimeout(poll, mine && LIVE.has(view.status) ? 400 : 3000);
  };

  // ── 결과: 채점 + 이번 실행 동안 서버에 남은 기록 ───────────────────────
  const CHANGE = /save|submit|delete|withdraw|cancel|requested|sanctioned|attempt|^otp$|attendance|record/;
  const describe = (e) => {
    const r = e.record || {};
    const map = {
      open_screen: `화면 열기: ${e.screen}`, search: `조회: ${e.screen || ''}`, action: `버튼 '${e.button}' (${e.screen})`,
      otp: `2차인증 번호 입력 (${e.ok ? '성공' : '실패'})`,
      overtime_request: `초과근무 승인요청: ${(e.rows || []).map((x) => `${x.date} ${x.start}~${x.end}`).join(', ') || '(신청목록 0건)'}` +
        (e.dups && e.dups.length ? ` → 이미 신청된 날짜로 거절(${e.dups.join(', ')})` : ' → 기안문서상신 창 열림'),
      overtime_submit: `초과근무 상신: ${(e.rows || []).map((x) => `${x.date} ${x.start}~${x.end}`).join(', ')} (결재자 ${(e.line || []).join(', ')})`,
      overtime_delete: `초과근무 삭제: ${JSON.stringify(e.ids)}`, overtime_withdraw: `초과근무 회수: ${JSON.stringify(e.ids)}`,
      overtime_withdraw_refused: '초과근무 회수 시도(완결 건이라 거절됨)', overtime_delete_refused: '초과근무 삭제 시도(거절됨)',
      overtime_cancel: `초과근무 기결취소: ${JSON.stringify(e.ids)}`,
      duty_save: `근무상황 저장: ${r.kind} ${r.from}~${r.to} '${r.reason}'`, duty_submit: `근무상황 상신: ${r.kind} ${r.from}~${r.to}`,
      attendance_save: `출결 저장: ${JSON.stringify(e.changes)}`,
      record_save: `${e.screen} 저장 (${e.key}): ` + Object.entries(e.changes || {}).map(([no, c]) =>
        `${no}번 ` + Object.entries(c).map(([k, v]) => `${k} '${String(v).slice(0, 40)}${String(v).length > 40 ? '…' : ''}'`).join(', ')).join(' / '),
      record_delete: `${e.screen} 삭제 (${e.key}): ${(e.nos || []).join(', ')}번`,
      doc_view: `문서 열람: ${e.title || ''}`, sanction_attempt: '결재 시도(전자서명 단계)', sanctioned: '결재 처리',
      cnsul_save: '품의 저장', cnsul_request_attempt: '품의 결재요청 시도', cnsul_requested: '품의 결재요청',
      draft_save: '기안 임시저장', draft_submit_attempt: '기안 상신 시도',
    };
    return map[e.kind] || `${e.kind} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['t', 'system', 'kind'].includes(k)))).slice(0, 80)}`;
  };
  const showResult = async () => {
    const res = box('result');
    res.hidden = false; res.textContent = '결과 확인 중…';
    const sid = store.get('scenario');
    const parts = [];
    if (sid) {
      try {
        const g = await (await fetch('/__sandbox/check?id=' + encodeURIComponent(sid))).json();
        parts.push(`<div class="verdict">${sid} 채점: ${g.pass ? '합격' : '불합격'}</div><div>${esc(g.detail || g.error || '')}</div>`);
      } catch { parts.push('<div class="verdict">채점 실패</div>'); }
    } else parts.push('<div class="verdict">직접 입력한 요청이라 채점하지 않았습니다.</div><div class="muted">아래 서버 기록으로 실제로 바뀐 것을 확인하세요.</div>');
    try {
      const { entries } = await (await fetch('/__sandbox/log?since=' + logFrom)).json();
      const own = entries.filter((e) => e.system !== 'agent');
      parts.push(`<h4>이번 실행 동안 서버에 남은 기록 (${own.length}건, 굵게: 데이터를 바꾸거나 바꾸려 한 동작)</h4>`);
      parts.push('<ul class="log">' + (own.length ? own.map((e) => `<li class="${CHANGE.test(e.kind) ? 'change' : ''}">${esc(e.t)} ${esc(describe(e))}</li>`).join('') : '<li>없음</li>') + '</ul>');
    } catch { /* log unavailable */ }
    res.innerHTML = parts.join('');
    if (view.final) {
      const h = document.createElement('h4'); h.textContent = `마지막 판단: ${view.final.operation}`;
      res.append(h, probs(view.final));
    }
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ── 버튼 ─────────────────────────────────────────────────────────────
  const fail = (e) => { out('status').textContent = '오류 — ' + e.message; };
  const start = async (mode) => {
    const text = goal.value.trim();
    if (!text) { goal.focus(); return; }
    const s = scenarios.find((x) => x.id === pick.value);
    store.set('scenario', s && s.goal === text ? s.id : null);
    store.set('goal', text);
    if ($('#fresh').checked) {
      // 데이터를 처음 상태로 돌리고 화면을 새로 연 뒤, 새 화면에서 자동으로 이어서 시작
      await fetch('/__sandbox/reset', { method: 'POST' });
      store.set('pending', JSON.stringify({ mode, guard: $('#guard').checked }));
      location.href = location.pathname;
      return;
    }
    launch(mode, $('#guard').checked);
  };
  const launch = async (mode, guard) => {
    graded = false; dismissed = false; box('result').hidden = true;
    view = { status: 'thinking', message: '이 탭에 연결하는 중…', steps: [], panel: id }; paint();
    try {
      const r = await post('start', { goal: store.get('goal'), panel: id, mode, guard });
      if (r.status === 'offline') { view = r; paint(); return; }
      logFrom = r.log_from || 0; store.set('logFrom', String(logFrom));
      view = r;
    } catch (e) { view = { status: 'error', message: e.message }; paint(); return; }
    poll();
  };
  act('run').onclick = () => start('auto');
  act('runstep').onclick = () => start('step');
  act('step').onclick = () => post('step').then(poll, fail);
  act('auto').onclick = () => post('auto').then(poll, fail);
  act('stop').onclick = () => post('stop').then(poll, fail);
  act('allow').onclick = () => post('decide', { allow: true }).then(poll, fail);
  act('resume').onclick = () => post('decide', { allow: true }).then(poll, fail);
  shadow.querySelectorAll('[data-act="deny"]').forEach((b) => { b.onclick = () => post('decide', { allow: false }).then(poll, fail); });
  act('again').onclick = () => { dismissed = true; box('result').hidden = true; paint(); };
  act('grade').onclick = () => { showResult(); };
  $('#guard').checked = store.get('guard') !== '0';
  $('#guard').onchange = () => store.set('guard', $('#guard').checked ? null : '0');

  // 새로고침으로 넘어온 실행 예약
  const pending = store.get('pending');
  store.set('pending', null);
  if (pending) {
    const p = JSON.parse(pending);
    // 모의 화면이 첫 메뉴를 그릴 시간을 준 뒤 시작
    setTimeout(() => launch(p.mode, p.guard), 900);
  } else poll();
})();
