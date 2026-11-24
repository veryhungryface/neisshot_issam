// 모의 나이스(http://127.0.0.1:8770/neis/) 전용 임시 버튼.
// 클릭하면: 3-1담임 → 학생생활 > 행동특성및종합의견 → 학년 1 / 반 1 → 조회
// 2차인증 창이 뜨면 번호는 사람이 직접 넣고, 스크립트는 창이 닫힐 때까지 기다린다.
// 사용: 개발자도구 콘솔에 붙여넣기 (페이지를 새로고침하면 다시 넣어야 함)
(() => {
  const ROLE = '118001';                   // 3-1담임
  const FOLDER = '118001_AMGHS30249';      // 학생생활 > 행동특성및종합의견 (폴더)
  const SCREEN = '118001_AMGHS40898';      // 행동특성및종합의견 (화면)
  const SCREEN_NAME = '행동특성및종합의견';
  const CONDS = { 학년: '1', 반: '1' };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, { timeout = 5000, step = 100, what = '' } = {}) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) throw new Error(`시간 초과: ${what}`);
      await wait(step);
    }
  }
  const visible = (e) => e && e.getClientRects().length > 0;
  const activePanel = () => [...document.querySelectorAll('[role=tabpanel]')].find(visible);

  async function pickCombo(scope, name, value) {
    const box = await waitFor(() => [...scope.querySelectorAll('[role=combobox]')]
      .find((b) => (b.getAttribute('aria-label') || '').startsWith(`${name}, `)), { what: `${name} 콤보` });
    if (box.getAttribute('aria-label') === `${name}, ${value}`) return;
    box.click();
    const opt = await waitFor(() => [...document.querySelectorAll(`[role=listbox][aria-label="${name}"] [role=option]`)]
      .find((o) => o.textContent.trim() === value), { what: `${name}=${value} 항목` });
    opt.click();
    await waitFor(() => box.getAttribute('aria-label') === `${name}, ${value}`, { what: `${name} 선택 반영` });
  }

  async function run(btn) {
    btn.textContent = '진행 중...';
    try {
      // 1) 상단 역할 메뉴 '3-1담임' → 메가메뉴(늦게 그려짐)
      const role = await waitFor(() => document.querySelector(`li[data-itemid="${ROLE}"] > a`), { what: '3-1담임 메뉴' });
      if (role.getAttribute('aria-expanded') !== 'true') role.click();

      // 2) 메가메뉴의 '행동특성및종합의견' 폴더 → 왼쪽 화면 메뉴에 갈래가 펼쳐짐
      const folder = await waitFor(() => document.querySelector(`.mega-l2[data-itemid="${FOLDER}"] > a`), { what: '메가메뉴 폴더' });
      folder.click();

      // 3) 왼쪽 화면 메뉴의 '행동특성및종합의견' 화면
      const leaf = await waitFor(() => [...document.querySelectorAll(`a[data-itemid="${SCREEN}"]`)].find(visible), { what: '왼쪽 메뉴 화면' });
      leaf.click();

      // 4) 2차인증이 뜨면 사람이 입력할 때까지 대기 (최대 3분)
      const otpDlg = await waitFor(() => document.querySelector('[role=dialog][aria-label="2차인증"]')
        || [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes(SCREEN_NAME) && activePanel()?.querySelector('[role=combobox]')),
      { timeout: 8000, what: '화면 또는 2차인증' }).catch(() => null);
      if (otpDlg?.getAttribute?.('role') === 'dialog') {
        btn.textContent = '2차인증 입력 대기 중...';
        await waitFor(() => !otpDlg.isConnected, { timeout: 180000, step: 300, what: '2차인증' });
      }

      // 5) 조회조건: 학년/반
      const panel = await waitFor(() => {
        const p = activePanel();
        return p && [...p.querySelectorAll('[role=combobox]')].some((b) => (b.getAttribute('aria-label') || '').startsWith('반, ')) && p;
      }, { timeout: 8000, what: '행동특성 화면' });
      for (const [n, v] of Object.entries(CONDS)) await pickCombo(panel, n, v);

      // 6) 조회
      const search = await waitFor(() => [...panel.querySelectorAll('.search-btn [role=button]')].find((b) => b.textContent.trim() === '조회'), { what: '조회 버튼' });
      search.click();
      btn.textContent = '완료';
    } catch (e) {
      console.error('[빠른조회]', e);
      btn.textContent = `실패: ${e.message}`;
    } finally {
      setTimeout(() => { btn.textContent = BTN_TEXT; }, 3000);
    }
  }

  const BTN_TEXT = '3-1 행특 1학년 1반 조회';
  document.getElementById('nsQuickQuery')?.remove();
  const btn = document.createElement('button');
  btn.id = 'nsQuickQuery';
  btn.textContent = BTN_TEXT;
  Object.assign(btn.style, {
    position: 'fixed', right: '16px', bottom: '56px', zIndex: 2147483647, padding: '10px 14px',
    background: '#E66914', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px',
    fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.25)',
  });
  btn.addEventListener('click', () => { if (btn.textContent === BTN_TEXT) run(btn); });
  document.body.append(btn);
})();
