const tableBody = document.getElementById('tableBody');
const rowCountDisplay = document.getElementById('rowCount');

// 커스텀 알림 모달 (네이티브 alert 대체) — 확장 아이콘이 들어간 자체 팝업
const nsModalOverlay = document.getElementById('nsModalOverlay');
const nsModalMsg = document.getElementById('nsModalMsg');
const nsModalOk = document.getElementById('nsModalOk');
function showModal(message) {
  if (!nsModalOverlay || !nsModalMsg) { window.alert(message); return; }
  nsModalMsg.textContent = message;
  nsModalOverlay.classList.add('open');
}
function hideModal() {
  if (nsModalOverlay) nsModalOverlay.classList.remove('open');
  const cancel = document.getElementById('nsModalCancel');
  if (cancel) cancel.hidden = true;
  if (modalAnswer) { const a = modalAnswer; modalAnswer = null; a(false); }
}
// 확인/취소 팝업 → true/false
let modalAnswer = null;
function showConfirm(message, okText = '계속') {
  return new Promise((resolve) => {
    showModal(message);
    const cancel = document.getElementById('nsModalCancel');
    if (cancel) cancel.hidden = false;
    if (nsModalOk) nsModalOk.textContent = okText;
    modalAnswer = (v) => { if (nsModalOk) nsModalOk.textContent = '확인'; resolve(v); };
  });
}
if (nsModalOk) nsModalOk.addEventListener('click', () => {
  if (modalAnswer) { const a = modalAnswer; modalAnswer = null; a(true); }
  hideModal();
});
document.getElementById('nsModalCancel')?.addEventListener('click', hideModal);
if (nsModalOverlay) nsModalOverlay.addEventListener('click', (e) => {
  if (e.target === nsModalOverlay) hideModal();
});

// 사이트에서 함께 넘어온 카테고리 → 미리보기 제목 매핑
//  · 사이트(Part B)는 메시지에 category 필드를 함께 보냄 (코드 또는 라벨)
//  · 알 수 없는 값이면 받은 문자열을 그대로 제목으로 사용
const CATEGORY_LABELS = {
  subject: '교과발달사항 특기사항',
  seteuk: '과목별 세부능력 및 특기사항',
  creative: '창의적 체험활동 특기사항',
  behavior: '행동발달 특기사항',
  reading: '독서활동상황',
};

const SOURCE_GUIDES = [
  // 과세특은 '교과'가 들어간 이름(교과세특)도 있으므로 교과학습발달보다 먼저 찾는다
  {
    keys: ['seteuk', '과세특', '세특', '과목별세부능력', '세부능력및특기사항'],
    sourceLabel: '과세특',
    menuPath: '교과담임-성적-성적처리-과목별세부능력및특기사항',
    tabCount: 2,
    titleType: 'seteuk',
  },
  {
    keys: ['subject', '교과학습발달', '교과발달사항', '교과발달', '교과'],
    sourceLabel: '교과학습발달',
    menuPath: '학급담임-학생평가-학기말종합의견',
    tabCount: 3,
    titleType: 'subject',
  },
  {
    keys: ['creative', '창체', '창의적체험활동', '자율자치활동', '자율활동'],
    sourceLabel: '창체',
    menuPath: '학급담임-창의적체험활동-자율자치활동(자율활동)관리',
    tabCount: 2,
    titleType: 'creative',
  },
  {
    keys: ['behavior', '행발', '행동발달', '행동특성및종합의견', '행동특성'],
    sourceLabel: '행발',
    menuPath: '학급담임-행동특성및종합의견-행동특성및종합의견',
    tabCount: 2,
    titleType: 'behavior',
  },
];

const DEFAULT_SOURCE_GUIDE = {
  sourceLabel: '소스 미확인',
  menuPath: '사이트에서 데이터를 보내면 메뉴 위치가 자동 표시됩니다.',
  tabCount: 2,
};

function normalizeSourceKey(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function getSourceGuide(category) {
  const normalized = normalizeSourceKey(category);
  if (!normalized) return DEFAULT_SOURCE_GUIDE;

  const guide = SOURCE_GUIDES.find((item) =>
    item.keys.some((key) => normalized.includes(normalizeSourceKey(key)))
  );

  if (guide) return guide;

  return {
    sourceLabel: CATEGORY_LABELS[category] || category || DEFAULT_SOURCE_GUIDE.sourceLabel,
    menuPath: '지원되는 소스: 과세특, 교과학습발달, 창체, 행발',
    tabCount: DEFAULT_SOURCE_GUIDE.tabCount,
  };
}

function previewTitleText(category, subject = '') {
  if (!category) return '미리보기';
  const guide = getSourceGuide(category);
  const subjectLabel = String(subject || '').trim();

  if (guide.titleType === 'subject') {
    return `교과${subjectLabel ? `(${subjectLabel})` : ''} 학기말종합의견 미리보기`;
  }
  if (guide.titleType === 'creative') return '창체 자율활동관리 미리보기';
  if (guide.titleType === 'behavior') return '행동특성및종합의견 미리보기';
  if (guide.titleType === 'seteuk') return `과세특${subjectLabel ? `(${subjectLabel})` : ''} 미리보기`;

  const label = CATEGORY_LABELS[category] || category;
  return `${label} 미리보기`;
}

function applyCategoryTitle(category, subject = '') {
  const el = document.getElementById('previewTitle');
  if (el) el.textContent = previewTitleText(category, subject);
}

// 화면을 찾아 들어가 자동으로 넣을 수 있는 종류 (그 밖은 커서를 둔 칸부터 넣는 예전 방식)
const AUTO_SCREENS = {
  seteuk: { label: '과세특', button: '과세특 자동 입력' },
  behavior: { label: '행특', button: '행특 자동 입력' },
};
const DEFAULT_CAUTION = '⚠️ 실행 전 NEIS에서 입력할 첫 칸을 클릭해 커서가 깜박이는지 꼭 확인하세요.';
const AUTO_CAUTION = '⚠️ 나이스에 로그인만 해 두세요. 화면을 찾아 열고 조회한 뒤 반/번호에 맞춰 넣습니다. 2차인증 번호는 직접 넣어 주세요.';
function autoScreenOf(category) {
  const t = getSourceGuide(category || '').titleType;
  return AUTO_SCREENS[t] ? t : null;
}
function applyExecMode(category) {
  const auto = autoScreenOf(category);
  const exec = document.getElementById('btnExecute');
  if (exec) exec.textContent = auto ? AUTO_SCREENS[auto].button : '일괄 입력 실행';
  const caution = document.getElementById('execCaution');
  if (caution) caution.textContent = auto ? AUTO_CAUTION : DEFAULT_CAUTION;
}

function applySourceGuide(category) {
  applyExecMode(category);
  const guide = getSourceGuide(category);
  const sourceLabel = document.getElementById('menuSourceLabel');
  const menuPath = document.getElementById('menuPathText');

  if (sourceLabel) sourceLabel.textContent = guide.sourceLabel;
  if (menuPath) menuPath.textContent = guide.menuPath;
}

// 표 렌더링 함수
//  students: 사이트가 학생별 반·번호를 함께 보낸 경우 (lines 와 같은 순서). 번호 칸에 반/번호를 보여 준다.
//  groups: 조회조건별 묶음 (students[i].g 가 묶음 번호). 묶음이 바뀌는 곳에 묶음 제목 줄을 넣는다.
function groupLabel(g, i) {
  const q = g?.query || {};
  const parts = [q.grade && `${q.grade}학년`, q.subject || g?.subject, q.room && `강의실 ${q.room}`, q.ban && `${q.ban}반`].filter(Boolean);
  return `묶음 ${i + 1}: ${parts.join(' · ') || '조회조건 없음'} (${g?.count ?? '?'}명)`;
}
//  query: 받은 조회조건. 학생에게 반이 없으면 (묶음 또는 전체) 조회조건의 반을 보여 준다
function renderTable(lines, students = null, groups = null, query = null) {
  tableBody.innerHTML = '';
  rowCountDisplay.innerText = `${lines.length}건`;

  // 데이터 유무에 따라 실행 버튼 활성화 / 미리보기 빈 상태 토글
  const _execBtn = document.getElementById('btnExecute');
  if (_execBtn) _execBtn.disabled = lines.length === 0;
  const _empty = document.getElementById('previewEmpty');
  if (_empty) _empty.style.display = lines.length ? 'none' : 'block';

  // 반·번호가 있으면 번호 칸을 넓혀 '5반 10번' 으로 보여 준다
  tableBody.closest('table')?.classList.toggle('has-ban', !!students?.some(Boolean));
  let lastGroup = null;
  lines.forEach((line, index) => {
    const gi = groups && students?.[index] ? students[index].g : undefined;
    if (gi !== undefined && gi !== lastGroup) {
      lastGroup = gi;
      const gr = document.createElement('tr');
      gr.className = 'group-row';
      const td = document.createElement('td');
      td.colSpan = 2;
      td.innerText = groupLabel(groups[gi], gi);
      gr.appendChild(td);
      tableBody.appendChild(gr);
    }
    const tr = document.createElement('tr');

    const tdNum = document.createElement('td');
    const st = students && students[index];
    const qBan = (String((st && groups?.[st.g]?.query?.ban) || query?.ban || '').match(/\d+/g) || []).pop();
    const ban = st?.ban || qBan;
    tdNum.innerText = st ? (ban ? `${ban}반 ${st.no}번` : `${st.no}번`) : index + 1;
    tdNum.style.textAlign = 'center';
    tdNum.style.color = '#999';

    const tdContent = document.createElement('td');
    tdContent.innerText = line;
    tdContent.style.whiteSpace = 'pre-wrap';

    tr.appendChild(tdNum);
    tr.appendChild(tdContent);
    tableBody.appendChild(tr);
  });
}

// --- 나이스 입력 실행 함수 ---
//  · 기본: 표 구조(HTML)를 읽어 같은 열의 다음 행 입력칸에 직접 입력
//  · 표가 아니거나 탭수 강제 설정이 켜져 있으면 Tab 방식
//  · saveNote: 완료 팝업 끝줄 (개발용 임시 입력은 '저장하지 마세요'로 바꿔 부른다)
//  · 입력 결과 요약 { total, count, skipped, modes, noCursor } 을 돌려준다 (개발용 진단 저장이 사용)
//  · data: { list, students } 를 주면 저장된 데이터 대신 그것을 넣는다 (묶음 자동 입력이 묶음 하나씩 넣을 때)
//  · quiet: 결과 팝업을 띄우지 않고 요약만 돌려준다
async function injectData(tabCount, { forceTab = false, saveNote = '⚠️ 저장 버튼을 눌러 저장해주세요!', data = null, quiet = false } = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // 추가 모드 확인
  const appendType = document.querySelector('input[name="appendType"]:checked')?.value || 'none';
  const customSeparator = document.getElementById('customSeparator')?.value || ', ';
  const appendConfig = { type: appendType, separator: customSeparator };

  // 딜레이 설정 - 5단계 속도 프리셋
  const speedPresets = {
    fastest: { tab: 20, afterTab: 30, focus: 8, blur: 20, next: 55 },
    fast: { tab: 35, afterTab: 40, focus: 15, blur: 35, next: 85 },
    normal: { tab: 55, afterTab: 70, focus: 20, blur: 55, next: 140 },
    slow: { tab: 85, afterTab: 105, focus: 35, blur: 85, next: 210 },
    slowest: { tab: 140, afterTab: 175, focus: 55, blur: 125, next: 280 }
  };

  const selectedSpeed = document.querySelector('input[name="speed"]:checked')?.value || 'normal';
  const delays = speedPresets[selectedSpeed] || speedPresets.normal;

  // 입력이 끝날 때까지 기다릴 수 있도록 Promise 를 반환한다 (개발용 버튼이 사용)
  const source = data ? Promise.resolve({ savedArray: data.list, savedStudents: data.students }) : chrome.storage.local.get(['savedArray', 'savedStudents']);
  return source.then((res) => {
    const dataList = res.savedArray || [];
    if (dataList.length === 0) { showModal("데이터가 없습니다."); return; }
    // 사이트가 학생별 반·번호를 보냈으면 순서대로가 아니라 표의 반/번호를 보고 맞는 행에 넣는다
    const students = Array.isArray(res.savedStudents) && res.savedStudents.length === dataList.length ? res.savedStudents : null;
    if (students && forceTab) {
      showModal('학생별 반·번호가 있는 데이터는 표에서 학생을 맞춰 넣어야 해서\n탭수 강제 설정을 끈 뒤 실행해 주세요.');
      return;
    }

    return chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (list, tabsPerRow, appendCfg, delayConfig, useTabMode, students) => {
        const TABS_PER_ROW = tabsPerRow;
        const USE_TAB_MODE = useTabMode;
        const APPEND_CONFIG = appendCfg;
        const DELAYS = delayConfig;
        const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let successCount = 0;
        const KEY_EVENT_DELAY = Math.max(8, Math.round(DELAYS.tab * 0.5));
        const FALLBACK_FOCUS_DELAY = Math.max(8, Math.round(DELAYS.focus * 0.75));

        const isEditableInput = (element) => {
          if (!element || !(element instanceof HTMLElement)) return false;
          const tagName = element.tagName;

          if (tagName === 'TEXTAREA') {
            return !element.disabled && !element.readOnly;
          }

          if (tagName === 'INPUT') {
            const type = String(element.type || 'text').toLowerCase();
            const ignoredTypes = ['hidden', 'button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color'];
            return !ignoredTypes.includes(type) && !element.disabled && !element.readOnly;
          }

          return element.isContentEditable || element.getAttribute('role') === 'textbox';
        };

        const isVisibleInput = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden';
        };

        const getActiveInput = () => {
          if (isEditableInput(document.activeElement)) return document.activeElement;

          return document.querySelector('textarea.cl-text:focus') ||
            document.querySelector('input.cl-text:focus') ||
            document.querySelector('[contenteditable="true"]:focus') ||
            document.querySelector('[role="textbox"]:focus') ||
            document.querySelector('.cl-grid-row.cl-selected textarea.cl-text') ||
            document.querySelector('.cl-grid-row.cl-selected input.cl-text') ||
            document.querySelector('.cl-grid-row.cl-editing textarea.cl-text') ||
            document.querySelector('.cl-grid-row.cl-editing input.cl-text');
        };

        const getFocusableInputs = () => Array.from(document.querySelectorAll([
          'textarea',
          'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
          '[contenteditable="true"]',
          '[role="textbox"]',
        ].join(','))).filter((element) => isEditableInput(element) && isVisibleInput(element));

        const focusInput = async (element) => {
          if (!element) return null;
          element.scrollIntoView({ behavior: 'auto', block: 'center' });
          await wait(FALLBACK_FOCUS_DELAY);
          element.focus({ preventScroll: true });
          await wait(FALLBACK_FOCUS_DELAY);

          if (document.activeElement !== element && typeof element.click === 'function') {
            element.click();
            await wait(FALLBACK_FOCUS_DELAY);
            element.focus({ preventScroll: true });
          }

          return getActiveInput();
        };

        const focusNextInput = async (fromElement) => {
          const inputs = getFocusableInputs();
          if (inputs.length === 0) return null;

          let index = inputs.indexOf(fromElement);
          if (index === -1 && fromElement?.compareDocumentPosition) {
            index = inputs.findIndex((input) =>
              Boolean(fromElement.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING)
            );
            index = index === -1 ? inputs.length - 1 : index - 1;
          }

          const nextInput = inputs[(Math.max(index, -1) + 1) % inputs.length];
          return focusInput(nextInput);
        };

        // 활성화된 입력 요소 확인 (사용자가 클릭한 요소 우선!)
        console.log('🔄 활성화된 입력 요소 확인...');

        // 1. 먼저 현재 포커스된 요소 확인 (사용자가 실제로 클릭한 것)
        let activeInput = getActiveInput();
        if (activeInput) {
          console.log('✅ activeElement에서 입력 요소 발견:', activeInput.tagName);
        }

        // 활성화된 입력 요소가 없으면 결과 반환
        if (!activeInput) {
          console.warn('⚠️ 활성화된 입력 요소 없음');
          return { success: false, error: 'NO_CURSOR' };
        }

        console.log('✅ 활성화된 입력 요소 발견! 입력 시작');

        // Tab 키 이벤트 헬퍼. 일반 웹폼은 synthetic Tab으로 포커스가 이동하지 않아 직접 다음 입력칸을 잡는다.
        const pressTab = async (element) => {
          const startInput = getActiveInput() || (isEditableInput(element) ? element : null);
          const target = startInput || element || document.activeElement || document.body;
          const tabDown = new KeyboardEvent('keydown', {
            key: 'Tab', code: 'Tab', keyCode: 9, which: 9,
            bubbles: true, cancelable: true
          });
          const tabUp = new KeyboardEvent('keyup', {
            key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true
          });
          target.dispatchEvent(tabDown);
          await wait(KEY_EVENT_DELAY);
          target.dispatchEvent(tabUp);
          await wait(DELAYS.tab);

          const movedInput = getActiveInput();
          if (movedInput && movedInput !== startInput) return movedInput;

          return focusNextInput(startInput || target);
        };

        // 값 입력 (APPEND_CONFIG 반영 → 네이티브 setter → input/change/blur 이벤트)
        const fillInput = async (input, textData, i) => {
          // 확실히 포커스
          input.focus();
          await wait(DELAYS.focus);

          // APPEND_CONFIG에 따라 기존 텍스트 처리
          let finalText = textData;
          if (APPEND_CONFIG.type !== 'none') {
            const existingText = (input.value || input.textContent || '').trim();
            if (existingText) {
              if (APPEND_CONFIG.type === 'newline') {
                finalText = existingText + '\n' + textData;
              } else if (APPEND_CONFIG.type === 'custom') {
                finalText = existingText + APPEND_CONFIG.separator + textData;
              }
              console.log(`${i}번: 기존 텍스트 뒤에 추가 (${APPEND_CONFIG.type})`);
            }
          } else {
            input.select && input.select();
          }

          if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            input.value = finalText;

            // 네이티브 setter (textarea와 input 모두 지원)
            const setter = input.tagName === 'TEXTAREA'
              ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
              : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(input, finalText);
          } else {
            input.textContent = finalText;
          }

          // 이벤트 발생
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));

          // blur 이벤트로 값 확정
          await wait(DELAYS.blur);
          input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          console.log(`✅ ${i}번 입력 완료: "${textData.substring(0, 20)}..."`);
        };

        // ── 표 구조(HTML) 방식 ──
        //  커서가 있는 칸의 그리드·행·열을 찾고, 같은 열의 다음 행 입력칸에 직접 넣는다.
        //  Tab 순서(행 안의 입력칸 수, 체크박스 등)에 영향을 받지 않는다.
        const EDITOR_SELECTOR = 'textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]), [contenteditable="true"], [role="textbox"]';
        // 편집기가 칸 밖(표 위에 따로 띄운 층)에 생기는 그리드도 있다: 그 자리 밑에 깔린 칸을 찾는다
        const cellUnder = (el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return null;
          const pts = document.elementsFromPoint(r.left + Math.min(8, r.width / 2), r.top + Math.min(8, r.height / 2));
          return pts.map((e) => e.closest('[role="gridcell"], .cl-grid-cell')).find(Boolean) || null;
        };
        const overlaps = (a, b) => {
          const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
          return x.width > 0 && x.height > 0 && x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        };
        // 칸의 편집기: 칸 안에 있거나, 포커스를 가진 편집기가 그 칸 위에 떠 있으면 그것
        const editorOver = (c) => {
          const inCell = Array.from(c.querySelectorAll(EDITOR_SELECTOR)).find(isEditableInput);
          if (inCell) return inCell;
          const a = document.activeElement;
          return isEditableInput(a) && (c.contains(a) || overlaps(a, c)) ? a : null;
        };
        // 칸을 실제 마우스처럼 누른다 (pointerdown → mousedown → pointerup → mouseup → click).
        // 4세대 나이스 표는 click 만 보내면 표에 포커스만 가고 입력칸이 안 열린다 (2026-11-24 정식 나이스 시험).
        const pressCell = (c, detail = 1) => {
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
        // 키는 표 안에 포커스가 있을 때만 보낸다 (조회조건 칸에 가면 조건이 바뀔 수 있다)
        const pressKey = (c, key, keyCode) => {
          const g = c.closest('[role="grid"], [role="treegrid"], .cl-grid');
          if (!g || !g.contains(document.activeElement)) c.focus?.();
          const t = document.activeElement;
          if (!g || !t || !g.contains(t)) return;
          const o = { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };
          t.dispatchEvent(new KeyboardEvent('keydown', o));
          t.dispatchEvent(new KeyboardEvent('keyup', o));
        };
        // 편집기를 여는 방법들. 앞에서부터 해 보고 열리면 멈춘다. 어떤 방법이 통했는지 센다.
        const openStats = {};
        const openFails = [];
        // cellNow(): 지금 문서에 있는 그 칸. 정식 나이스는 입력칸을 열면서 행을 새로 그리므로
        // 누르기 전에 잡아 둔 칸은 문서에서 빠져 있다 (2026-11-24 정식 나이스 시험) → 매번 새로 찾는다.
        // 칸 하나의 지금 상태 (위치·스크롤·포커스. 글자는 넣지 않는다) — 못 열었을 때 원인 찾기용
        const cellState = (c) => {
          const g = c?.closest('[role="grid"], [role="treegrid"], .cl-grid');
          const b = c?.getBoundingClientRect();
          const bar = g && Array.from(g.querySelectorAll('.cl-scrollbar')).find((e) => e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 1);
          const a = document.activeElement;
          return {
            행: c?.closest('[role="row"], .cl-grid-row')?.getAttribute('aria-rowindex') || null,
            칸: b ? [Math.round(b.top), Math.round(b.bottom)] : null,
            막대: bar ? Math.round(bar.scrollTop) : null,
            포커스: a && a !== document.body ? `${a.tagName.toLowerCase()}${a.closest?.('[role="row"]') ? '@' + a.closest('[role="row"]').getAttribute('aria-rowindex') : ''}` : '없음',
            칸안입력칸: c ? c.querySelectorAll('textarea, input').length : 0,
          };
        };
        const openEditor = async (cellNow, scrollTrace = null) => {
          let c = cellNow();
          if (!c) return null;
          const trace = [{ 때: '시작', ...cellState(c) }];
          let ed = editorOver(c);
          if (ed) { openStats['이미 열림'] = (openStats['이미 열림'] || 0) + 1; return ed; }
          c.scrollIntoView({ block: 'nearest' });
          const tries = [
            ['누르기', (x) => pressCell(x, 1)],
            ['한 번 더 누르기', (x) => pressCell(x, 1)],
            // 앞 학생 칸의 입력칸이 아직 열려 있으면 닫고(사람이 다른 곳을 누를 때와 같다) 다시 누른다
            ['앞 칸 닫고 누르기', (x) => {
              const a = document.activeElement;
              if (isEditableInput(a) && !x.contains(a)) a.blur();
              pressCell(x, 1);
            }],
            ['두 번 누르기', (x) => { pressCell(x, 1); pressCell(x, 2); }],
            ['Enter', (x) => pressKey(x, 'Enter', 13)],
            ['F2', (x) => pressKey(x, 'F2', 113)],
          ];
          for (const [how, act] of tries) {
            act(c);
            for (let w = 0; w < 4 && !ed; w++) {
              await wait(Math.max(60, Math.round(DELAYS.afterTab / 2)));
              c = cellNow() || c;
              ed = editorOver(c);
            }
            if (ed) { openStats[how] = (openStats[how] || 0) + 1; return ed; }
            trace.push({ 때: how, ...cellState(c) });
          }
          openStats['못 염'] = (openStats['못 염'] || 0) + 1;
          if (openFails.length < 10) {
            // 왜 못 열었는지 (개발용 결과 파일에 남는다. 글자 내용은 넣지 않는다)
            const b = c.getBoundingClientRect();
            const g = c.closest('[role="grid"], [role="treegrid"], .cl-grid');
            const mid = g?.querySelector('[data-role="rowgroup"][data-loc="middle"]')?.getBoundingClientRect();
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + Math.min(b.height / 2, 12));
            const row = c.closest('[role="row"], .cl-grid-row');
            const a = document.activeElement;
            const cls = (e) => (e ? `${e.tagName.toLowerCase()}.${String(e.className || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.')}` : '없음');
            openFails.push({
              행: row?.getAttribute('aria-rowindex'), 행상태: String(row?.className || '').split(/\s+/).filter((x) => /editing|selected|modified|viewing/.test(x)).join(' '),
              칸위치: [Math.round(b.top), Math.round(b.bottom)], 보이는곳: mid ? [Math.round(mid.top), Math.round(mid.bottom)] : null,
              누른곳: hit ? (c.contains(hit) ? `칸 안 ${cls(hit)}` : `칸 밖 ${cls(hit)}`) : '없음',
              칸연결됨: c.isConnected, 포커스: cls(a), 포커스행: a?.closest?.('[role="row"]')?.getAttribute('aria-rowindex') || null,
              그려진행: g ? Array.from(g.querySelectorAll('[role="row"][aria-rowindex]')).map((r) => r.getAttribute('aria-rowindex')).filter((x) => x !== '1').join(',') : null,
              스크롤시도: scrollTrace, 누를때마다: trace,
            });
          }
          return null;
        };

        const findGridContext = (input) => {
          let grid = input.closest('[role="grid"], [role="treegrid"], .cl-grid');
          let cell = input.closest('[role="gridcell"], .cl-grid-cell');
          if (!cell) { cell = cellUnder(input); grid = grid || cell?.closest('[role="grid"], [role="treegrid"], .cl-grid'); }
          const row = cell?.closest('[role="row"], .cl-grid-row');
          if (!grid || !row || !cell || !grid.contains(row)) return null;

          const rowsOf = () => Array.from(grid.querySelectorAll('[role="row"], .cl-grid-row'))
            .filter((r) => r.querySelector('[role="gridcell"], .cl-grid-cell') && !r.querySelector('[role="columnheader"]'));
          // 열 식별: data-cellindex → aria-colindex → 행 안에서의 칸 순서
          const cellsOf = (r) => Array.from(r.querySelectorAll('[role="gridcell"], .cl-grid-cell'))
            .filter((c) => c.closest('[role="row"], .cl-grid-row') === r);
          const colAttr = cell.hasAttribute('data-cellindex') ? 'data-cellindex'
            : cell.hasAttribute('aria-colindex') ? 'aria-colindex' : null;
          const colValue = colAttr ? cell.getAttribute(colAttr) : String(cellsOf(row).indexOf(cell));
          const cellAt = (r) => (colAttr
            ? cellsOf(r).find((c) => c.getAttribute(colAttr) === colValue)
            : cellsOf(r)[Number(colValue)]);
          // 행 번호: aria-rowindex (가상 스크롤로 행이 다시 그려져도 유지됨) → 없으면 DOM 순서
          const useRowIndex = row.hasAttribute('aria-rowindex');
          const rowNo = (r) => (useRowIndex ? Number(r.getAttribute('aria-rowindex')) : rowsOf().indexOf(r));
          const startNo = rowNo(row);
          if (!Number.isFinite(startNo) || startNo < 0) return null;

          // 화면에 아직 그려지지 않은 행(가상 스크롤)은 스크롤해서 그리게 한다
          const scroller = (() => {
            for (let el = row.parentElement; el && el !== grid.parentElement; el = el.parentElement) {
              const st = window.getComputedStyle(el);
              if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight) return el;
            }
            return null;
          })();
          // 4세대 나이스 학생부 표(과세특 등): 보이는 몇 행만 그리고, 행이 든 상자는 스스로 스크롤하지 않는다.
          // 스크롤은 표 안에 따로 있는 .cl-scrollbar 가 맡으므로 그것을 움직인다 (2026-11-23 정식 나이스 수집).
          const customBar = scroller ? null : Array.from(grid.querySelectorAll('.cl-scrollbar'))
            .find((el) => el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1) || null;
          // 행은 스크롤할 때마다 새로 그려져 처음 행이 문서에서 빠지므로, 행 높이와 상자는 미리 잡아 둔다
          const rowStep = Math.max(row.offsetHeight, 20);
          const rowsBoxOf = () => grid.querySelector('[data-role="scroll-container"] [role="row"], [data-role="scroll-container"] .cl-grid-row')
            ?.closest('[data-role="scroll-container"]') || row.closest('[data-role="scroll-container"]') || row.parentElement;
          const atEnd = (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          const shownRows = () => rowsOf().map(rowNo).join(',');
          const scrollDown = async () => {
            const step = rowStep;
            const settle = () => wait(Math.max(30, DELAYS.tab));
            if (scroller) {
              if (atEnd(scroller)) return false;
              scroller.scrollTop += step;
              await settle();
              return true;
            }
            const before = shownRows();
            if (customBar && !atEnd(customBar)) {
              customBar.scrollTop += step;
              await settle();
              if (shownRows() !== before) return true;
            }
            // 막대가 없거나 움직여도 행이 그대로면 행 위에 마우스 휠을 보낸다
            const rowsBox = rowsBoxOf();
            const box = rowsBox.getBoundingClientRect();
            rowsBox.dispatchEvent(new WheelEvent('wheel', {
              deltaY: step, deltaMode: 0, bubbles: true, cancelable: true,
              clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
            }));
            await settle();
            return shownRows() !== before;
          };
          const findRow = async (no) => {
            for (let attempt = 0; attempt < 30; attempt++) {
              const r = rowsOf().find((x) => rowNo(x) === no);
              if (r) return r;
              if (!(await scrollDown())) return null;
            }
            return null;
          };
          // 칸 안의 편집기. 선택해야 편집기가 생기는 그리드는 칸을 클릭해서 연다.
          // 행이 표의 보이는 부분에 다 들어오게 한다 (반쯤 가려진 행은 눌러도 안 열릴 수 있다)
          const viewBox = () => {
            const mid = grid.querySelector('[data-role="rowgroup"][data-loc="middle"]');
            const a = (mid || rowsBoxOf() || grid).getBoundingClientRect(), gb = grid.getBoundingClientRect();
            return { top: Math.max(a.top, gb.top), bottom: Math.min(a.bottom, gb.bottom) };
          };
          // 정식 나이스 스크롤 막대는 행 단위로만 움직여 작은 이동은 무시된다 (2026-11-24 정식 나이스 시험):
          // 막대 높이를 행 수로 나눈 한 칸씩 움직이고, 행 위치가 그대로면 휠을 보낸다.
          const bringIntoView = async (no, trace = []) => {
            const bar = scroller || customBar;
            const note = (what) => {
              const r = rowsOf().find((x) => rowNo(x) === no);
              const b = r?.getBoundingClientRect(), v = viewBox();
              trace.push({ 한것: what, 행위치: b ? [Math.round(b.top), Math.round(b.bottom)] : null, 보이는곳: [Math.round(v.top), Math.round(v.bottom)], 막대: bar ? Math.round(bar.scrollTop) : null });
            };
            const total = Math.max(1, Number(grid.getAttribute('aria-rowcount') || 0) - 1);
            const unit = bar ? Math.max(rowStep, Math.ceil(bar.scrollHeight / (total + 1))) : rowStep;
            const find = () => rowsOf().find((x) => rowNo(x) === no);
            for (let i = 0; i < 8; i++) {
              const r = find();
              if (!r) return;
              const b = r.getBoundingClientRect(), v = viewBox();
              const dir = b.top < v.top - 1 ? -1 : b.bottom > v.bottom + 1 ? 1 : 0;
              if (!dir) { if (i) note('보임'); return; }
              if (!i) note('처음');
              const before = Math.round(b.top);
              const moved = () => { const x = find(); return !x || Math.round(x.getBoundingClientRect().top) !== before; };
              if (bar && (dir > 0 ? !atEnd(bar) : bar.scrollTop > 0)) {
                bar.scrollTop += dir * unit;
                await wait(Math.max(80, DELAYS.tab));
                note(`막대 ${dir > 0 ? '+' : '-'}${unit}`);
                if (moved()) continue;
              }
              const box = rowsBoxOf().getBoundingClientRect();
              rowsBoxOf().dispatchEvent(new WheelEvent('wheel', {
                deltaY: dir * unit, deltaMode: 0, bubbles: true, cancelable: true,
                clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
              }));
              await wait(Math.max(80, DELAYS.tab));
              note(`휠 ${dir * unit}`);
              if (!moved()) return;
            }
          };
          const editorIn = async (r) => {
            const no = rowNo(r);
            const scrollTrace = [];
            await bringIntoView(no, scrollTrace);
            // 행 상자는 스크롤하면 다른 학생 행으로 재활용되므로 (문서에는 남아 있다) 매번 행 번호로 다시 찾는다
            return openEditor(() => {
              const now = rowsOf().find((x) => rowNo(x) === no);
              return now ? cellAt(now) : null;
            }, scrollTrace.length ? scrollTrace : null);
          };
          // 머리글 이름(공백 무시)으로 열 찾기 → 행에서 그 열 칸의 글자
          const colOf = (names) => {
            const want = names.map((n) => n.replace(/\s+/g, ''));
            const h = Array.from(grid.querySelectorAll('[role="columnheader"]'))
              .find((x) => want.includes((x.textContent || '').replace(/\s+/g, '')));
            if (!h) return null;
            if (colAttr && h.hasAttribute(colAttr)) return h.getAttribute(colAttr);
            return null;
          };
          const cellText = (r, col) => {
            const c = col == null ? null : cellsOf(r).find((x) => x.getAttribute(colAttr) === col);
            return c ? (c.textContent || '').replace(/\s+/g, ' ').trim() : '';
          };
          return { startNo, findRow, editorIn, colOf, cellText, rowOf: (el) => (el.closest('[role="row"], .cl-grid-row') || cellUnder(el)?.closest('[role="row"], .cl-grid-row')) };
        };

        const gridCtx = USE_TAB_MODE ? null : findGridContext(activeInput);
        let mode = gridCtx ? 'grid' : 'tab';
        console.log(`입력 방식: ${mode === 'grid' ? '표 구조(HTML)' : `Tab ${TABS_PER_ROW}회`}`);
        let skipped = 0;

        // ── 학생 맞춰 넣기 (사이트가 반·번호를 보낸 경우) ──
        //  커서가 있는 행부터 표 끝까지 내려가며 각 행의 반/번호(와 이름)를 읽고, 같은 학생의 문장을 넣는다.
        //  데이터에 없는 학생 행은 건드리지 않는다. 이름이 다르면 넣지 않고 알려 준다.
        if (students) {
          if (!gridCtx) return { success: false, error: 'NEED_GRID' };
          const keyCol = gridCtx.colOf(['반/번호', '번호']);
          const nameCol = gridCtx.colOf(['성명', '이름']);
          if (keyCol == null) return { success: false, error: 'NO_KEY_COLUMN' };
          const nums = (v) => (String(v ?? '').match(/\d+/g) || []).map((n) => String(Number(n)));
          const plain = (v) => String(v ?? '').replace(/\s+/g, '');
          const label = (s) => (s.ban ? `${s.ban}/${s.no}` : s.no) + (s.name ? ` ${s.name}` : '');
          const byBanNo = new Map();
          const byNo = new Map();
          students.forEach((s, i) => {
            if (s.ban) byBanNo.set(`${s.ban}/${s.no}`, i);
            byNo.set(s.no, byNo.has(s.no) ? -1 : i); // 같은 번호가 여러 반에 있으면 번호만으로는 못 고른다
          });
          const used = new Set();
          const mismatch = [];
          const startRow = gridCtx.rowOf(activeInput);
          for (let k = 0; ; k++) {
            const row = k === 0 ? startRow : await gridCtx.findRow(gridCtx.startNo + k);
            if (!row) break;
            const n = nums(gridCtx.cellText(row, keyCol));
            if (!n.length) continue;
            const gNo = n[n.length - 1];
            const gBan = n.length > 1 ? n[n.length - 2] : '';
            let idx = gBan ? byBanNo.get(`${gBan}/${gNo}`) : undefined;
            if (idx === undefined) {
              const only = byNo.get(gNo);
              // 표에 반이 있는데 데이터에도 반이 있으면 반이 달라 다른 학생이다
              if (only !== undefined && only >= 0 && !(gBan && students[only].ban)) idx = only;
            }
            if (idx === undefined || used.has(idx)) continue;
            used.add(idx);
            const s = students[idx];
            if (s.name && nameCol != null) {
              const gName = gridCtx.cellText(row, nameCol);
              if (gName && plain(gName) !== plain(s.name)) { mismatch.push(`${label(s)} (나이스: ${gName})`); continue; }
            }
            const input = k === 0 ? activeInput : await gridCtx.editorIn(row);
            if (!input) { skipped++; console.warn(`⚠️ ${label(s)}: 편집할 수 없는 행, 스킵`); continue; }
            input.scrollIntoView({ block: 'nearest' });
            await fillInput(input, list[idx], idx);
            successCount++;
            await wait(DELAYS.next);
          }
          const notFound = students.map((s, i) => (used.has(i) ? null : label(s))).filter(Boolean);
          return { success: true, total: list.length, count: successCount, skipped, mode: 'match', notFound, mismatch, openStats, openFails };
        }

        if (gridCtx) {
          for (let i = 0; i < list.length; i++) {
            const row = i === 0 ? gridCtx.rowOf(activeInput) : await gridCtx.findRow(gridCtx.startNo + i);
            if (!row) {
              console.warn(`⚠️ ${i}번: ${list.length - i}건은 대응하는 행이 없어 입력하지 않음`);
              break;
            }
            const input = i === 0 ? activeInput : await gridCtx.editorIn(row);
            if (input) {
              input.scrollIntoView({ block: 'nearest' });
              await fillInput(input, list[i], i);
              successCount++;
            } else {
              // 읽기 전용 행(학적변동 등)은 건너뛰되 데이터는 행과 1:1로 맞춘다
              skipped++;
              console.warn(`⚠️ ${i}번: 편집할 수 없는 행, 스킵`);
            }
            await wait(DELAYS.next);
          }
        } else {
          let currentInput = activeInput;

          for (let i = 0; i < list.length; i++) {
            const textData = list[i];

            // 첫 번째가 아니면 Tab으로 다음 행 이동
            if (i > 0) {
              console.log(`${i}번: Tab ${TABS_PER_ROW}회로 다음 행 이동...`);

              // 설정된 횟수만큼 Tab
              for (let t = 0; t < TABS_PER_ROW; t++) {
                const movedInput = await pressTab(currentInput);
                if (movedInput) currentInput = movedInput;
                await wait(DELAYS.tab);
              }
              await wait(DELAYS.afterTab);

              // 새로 활성화된 입력 요소 찾기 (textarea 또는 input)
              const newInput = getActiveInput() || currentInput;
              if (newInput) currentInput = newInput;
            }

            // 현재 입력 요소에 입력 (textarea 또는 input)
            if (isEditableInput(currentInput)) {
              await fillInput(currentInput, textData, i);
              successCount++;
            } else {
              skipped++;
              console.warn(`⚠️ ${i}번: 입력 요소 없음, 스킵`);
            }

            // 다음 입력 전 대기 (값 확정 시간 부여)
            await wait(DELAYS.next);
          }
        }

        return { success: true, total: list.length, count: successCount, skipped, mode, openStats, openFails };
      },
      args: [dataList, tabCount, appendConfig, delays, forceTab, students]
    }).then((results) => {
      // 모든 프레임의 결과 확인
      let hasSuccess = false;
      let totalCount = 0;
      let successCount = 0;
      let skippedCount = 0;
      let allNoCursor = true;
      const modes = [];
      const notFound = [];
      const mismatch = [];
      let matchError = null;
      const openStats = {};
      const openFails = [];

      if (results) {
        for (const r of results) {
          if (r.result) {
            if (r.result.success) {
              hasSuccess = true;
              totalCount = r.result.total;
              successCount += r.result.count;
              skippedCount += r.result.skipped || 0;
              if (r.result.mode) modes.push(r.result.mode);
              if (r.result.notFound) notFound.push(...r.result.notFound);
              if (r.result.mismatch) mismatch.push(...r.result.mismatch);
              for (const [k, v] of Object.entries(r.result.openStats || {})) openStats[k] = (openStats[k] || 0) + v;
              if (r.result.openFails) openFails.push(...r.result.openFails);
              allNoCursor = false;
            } else if (r.result.error !== 'NO_CURSOR') {
              allNoCursor = false;
              if (r.result.error === 'NEED_GRID' || r.result.error === 'NO_KEY_COLUMN') matchError = r.result.error;
            }
          }
        }
      }

      if (quiet) {
        // 묶음 자동 입력: 팝업 없이 요약만
      } else if (hasSuccess) {
        chrome.action.setBadgeText({ text: '' }); // 입력 완료 → 아이콘 배지 정리
        const skippedText = skippedCount ? `\n(입력할 수 없는 칸 ${skippedCount}건 건너뜀)` : '';
        const list = (arr) => arr.slice(0, 10).join(', ') + (arr.length > 10 ? ` 외 ${arr.length - 10}명` : '');
        const matchText = modes.includes('match')
          ? '\n반/번호로 학생을 맞춰 넣었습니다.'
            + (mismatch.length ? `\n\n⚠️ 이름이 달라 넣지 않음 ${mismatch.length}명: ${list(mismatch)}` : '')
            + (notFound.length ? `\n\n⚠️ 표에서 찾지 못함 ${notFound.length}명: ${list(notFound)}\n(조회조건이 맞는지, 첫 학생 칸에서 시작했는지 확인하세요)` : '')
          : '';
        showModal(`${totalCount}명 중 ${successCount}건 입력 완료${skippedText}${matchText}\n\n${saveNote}`);
      } else if (matchError) {
        showModal(matchError === 'NEED_GRID'
          ? '⚠️ 학생별 반·번호가 있는 데이터는 나이스 표에서만 넣을 수 있습니다.\n표의 입력칸을 클릭한 뒤 다시 실행해 주세요.'
          : '⚠️ 표에서 반/번호(번호) 열을 찾지 못해 학생을 맞출 수 없습니다.\n입력하지 않았습니다.');
      } else if (allNoCursor) {
        showModal(
          '⚠️ 커서가 활성화되지 않았습니다!\n\n' +
          '【사용 방법】\n' +
          '1. 나이스에서 입력을 시작할 첫 번째 칸을 클릭하세요\n' +
          '2. 커서가 깜빡이는 것을 확인하세요\n' +
          '3. 다시 "일괄 입력 실행" 버튼을 누르세요\n\n' +
          '※ 반드시 입력칸을 클릭한 상태에서 버튼을 눌러야 합니다.'
        );
      }
      return { total: totalCount, count: successCount, skipped: skippedCount, modes, notFound, mismatch, openStats, openFails, matchError, noCursor: !hasSuccess && allNoCursor };
    }).catch((err) => {
      console.error('executeScript 오류:', err);
      if (!quiet) showModal('⚠️ 나이스 페이지에서 실행해주세요!');
      return { total: 0, count: 0, skipped: 0, modes: [], error: String(err?.message || err) };
    });
  });
}

// ──────────────────────────────────────────────────────────────
// 새 UI 배선 (초기화 / 일괄 입력 실행 / 입력 방식 / 메뉴 위치)
// ──────────────────────────────────────────────────────────────

// 데이터 초기화 — ✕ 버튼과 하단 '초기화' 버튼 공용
function clearAllData() {
  tableBody.innerHTML = '';
  rowCountDisplay.textContent = '0건';
  chrome.storage.local.remove(['savedArray', 'savedCategory', 'savedSubject', 'savedStudents', 'savedQuery', 'savedGroups', 'directPasteText', 'directPasteEnabled']);
  renderQueryGuide(null);
  chrome.action.setBadgeText({ text: '' }); // 데이터 비우면 아이콘 배지도 정리
  applyCategoryTitle('');
  applySourceGuide('');
  const directInput = document.getElementById('directPasteInput');
  const directStatus = document.getElementById('directPasteStatus');
  if (directInput) directInput.value = '';
  if (directStatus) directStatus.textContent = '0건 대기';
  applyDirectPasteState(false);
  const execBtn = document.getElementById('btnExecute');
  if (execBtn) execBtn.disabled = true;
  const empty = document.getElementById('previewEmpty');
  if (empty) empty.style.display = 'block';
}

// ──────────────────────────────────────────────────────────────
// 사이트가 보낸 나이스 조회조건 (query) → 화면의 조회조건을 맞추고 [조회]
//   · 고르기와 조회만 한다. 입력·저장은 하지 않는다.
//   · 저장 여부를 묻는 창 등 다른 창이 뜨면 누르지 않고 멈춘다 (사람이 판단)
// ──────────────────────────────────────────────────────────────
const QUERY_FIELDS = [
  ['year', '학년도'], ['semester', '학기'], ['grade', '학년'], ['ban', '반'], ['subject', '과목'], ['room', '강의실'],
];

//  category: 과세특·행특은 [자동 입력]이 직접 조회하므로 [이 조건으로 나이스 조회] 버튼을 숨기고 조건만 보여 준다
function renderQueryGuide(query, groups = null, category = '') {
  const box = document.getElementById('queryGuide');
  if (!box) return;
  const t = document.getElementById('queryText');
  const apply = document.getElementById('btnApplyQuery');
  if (groups && groups.length > 1) {
    // 묶음이 여럿이면 조회는 자동 입력이 묶음마다 한다
    box.hidden = false;
    if (t) t.textContent = `조회조건이 다른 묶음 ${groups.length}개: 자동 입력이 묶음마다 조회 → 입력 → 저장합니다.`;
    if (apply) apply.hidden = true;
    const st0 = document.getElementById('queryStatus');
    if (st0) st0.textContent = '';
    return;
  }
  const auto = !!autoScreenOf(category);
  if (apply) apply.hidden = auto;
  const parts = query ? QUERY_FIELDS.filter(([k]) => query[k]).map(([k, label]) => `${label} ${query[k]}`) : [];
  box.hidden = parts.length === 0;
  if (t) t.textContent = parts.length ? `${auto ? '자동 입력이 조회할 조건' : '받은 조회조건'}: ${parts.join(' · ')}` : '';
  const st = document.getElementById('queryStatus');
  if (st) st.textContent = '';
}

// 나이스 화면에서 실행 (모든 프레임에 주입되므로 바깥 변수를 쓰지 않는다)
async function applyNeisQueryInPage(q) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => !!e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
  // 지금 선택된 화면 탭의 화면 (탭이 여러 개 열려 있어도 선택된 것만). 못 찾으면 보이는 첫 화면
  const panel = (() => {
    const tab = [...document.querySelectorAll('[role=tab]')].find((t) => visible(t) && (t.getAttribute('aria-selected') === 'true' || /^선택됨,/.test(t.getAttribute('aria-label') || '')));
    const byTab = tab && [...document.querySelectorAll('[role=tabpanel]')].find((p) => p.getAttribute('aria-labelledby') === tab.id && visible(p));
    return byTab || [...document.querySelectorAll('[role=tabpanel]')].find((p) => visible(p) && !p.closest('[role=dialog]'));
  })();
  const combos = panel ? [...panel.querySelectorAll('[role=combobox]')].filter(visible) : [];
  if (!combos.length) return { ok: false, here: false };

  // 조회조건 이름 (나이스 화면마다 다름: 과세특은 '계열/학년/학과', 행특은 '학년')
  const FIELDS = [
    ['year', ['학년도']], ['semester', ['학기']], ['grade', ['계열/학년/학과', '학년']],
    ['ban', ['반']], ['subject', ['과목']], ['room', ['강의실']],
  ];
  const labelOf = (b) => b.getAttribute('aria-label') || '';
  const comboFor = (names) => combos.find((b) => names.some((n) => labelOf(b).startsWith(`${n}, `)));
  const current = (b) => labelOf(b).replace(/^[^,]*,\s*/, '');
  // 항목과 받은 값이 맞는 정도: 3 같음, 2 '학기'·'반' 등을 붙이면 같음, 1 받은 값 뒤에 '(' 로 덧붙은 것 (공통수학2 → 공통수학2(4))
  const score = (opt, want, key) => {
    const o = norm(opt), w = norm(want);
    if (!o || !w) return 0;
    if (o === w) return 3;
    const suffix = { semester: '학기', ban: '반', grade: '학년', year: '학년도' }[key];
    if (suffix && o === w + suffix) return 2;
    if (o.startsWith(`${w}(`)) return 1;
    return 0;
  };
  const otherDialog = () => [...document.querySelectorAll('[role=dialog]')]
    .find((d) => visible(d) && !/인증/.test(d.getAttribute('aria-label') || ''));
  const loadmask = () => [...document.querySelectorAll('.cl-loadmask')].some(visible);
  const settle = async () => {
    await wait(200);
    for (let i = 0; i < 100 && loadmask(); i++) await wait(100);
  };
  const closeList = (box) => {
    (document.activeElement || box).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  };

  // 학생이 누구인지 정하는 조건(학년·반·과목·강의실)이 이 화면에 없으면 다른 화면이 열려 있는 것이므로
  // 아무것도 바꾸지 않고 멈춘다. 학년도·학기는 화면에 따라 없을 수 있어 건너뛴다.
  const NEEDED = ['grade', 'ban', 'subject', 'room'];
  const missing = FIELDS.filter(([key, names]) => NEEDED.includes(key) && q[key] !== undefined && !comboFor(names))
    .map(([, names]) => names[names.length - 1]);
  if (missing.length) {
    return { ok: false, here: true, done: [], error: `지금 화면에는 ${missing.join('·')} 조회조건이 없습니다.\n데이터에 맞는 화면(메뉴 위치 참고)을 열었는지 확인해 주세요.` };
  }

  const done = [];
  const notOnScreen = [];
  for (const [key, names] of FIELDS) {
    if (q[key] === undefined) continue;
    const box = comboFor(names);
    if (!box) { notOnScreen.push(names[0]); continue; }
    const name = labelOf(box).split(',')[0];
    if (score(current(box), q[key], key) > 0) { done.push(`${name} ${current(box)}`); continue; }
    box.click();
    let opts = null;
    for (let i = 0; i < 30 && !opts; i++) {
      await wait(100);
      const lists = [...document.querySelectorAll('[role=listbox]')].filter(visible);
      const list = lists.find((l) => l.getAttribute('aria-label') === name) || lists[lists.length - 1];
      const found = list ? [...list.querySelectorAll('[role=option]')] : [];
      if (found.length) opts = found;
    }
    if (!opts) return { ok: false, here: true, error: `'${name}' 목록이 열리지 않았습니다.`, done };
    const scored = opts.map((o) => ({ o, s: score(text(o), q[key], key) })).filter((x) => x.s > 0);
    const best = Math.max(0, ...scored.map((x) => x.s));
    const top = scored.filter((x) => x.s === best);
    if (top.length !== 1) {
      closeList(box);
      const have = opts.map(text).filter(Boolean).slice(0, 12).join(', ');
      return {
        ok: false, here: true, done,
        error: top.length ? `'${name}'에 '${q[key]}'와 맞는 항목이 여러 개입니다: ${top.map((x) => text(x.o)).join(', ')}`
          : `'${name}'에 '${q[key]}' 항목이 없습니다.\n(있는 항목: ${have})`,
      };
    }
    top[0].o.click();
    for (let i = 0; i < 30 && score(current(box), q[key], key) === 0; i++) await wait(100);
    if (score(current(box), q[key], key) === 0) return { ok: false, here: true, error: `'${name}'을(를) 고르지 못했습니다.`, done };
    done.push(`${name} ${current(box)}`);
    await settle(); // 다음 조건의 목록이 앞 조건에 따라 바뀌므로 기다린다
    if (otherDialog()) return { ok: false, here: true, error: '나이스에 창이 떴습니다. 창을 확인한 뒤 다시 눌러 주세요.', done };
  }

  const btn = [...panel.querySelectorAll('[role=button], button')].find((b) => visible(b) && text(b) === '조회' && !b.closest('[role=row]'));
  if (!btn) return { ok: false, here: true, error: '[조회] 버튼을 찾지 못했습니다.', done };

  // 조회 결과가 표에 실제로 나올 때까지 기다린다 (2026-11-24 정식 나이스: 빈 표에서 조회 직후 0.3초 만에
  // 다음 단계로 넘어가 '첫 입력칸을 열지 못했습니다'로 멈춤). 조회 전 행에 표시를 해 두고,
  // 새로 그려진 행이 나오거나 가림막이 떴다 사라진 뒤 조용해지면 끝으로 본다.
  const studentGrid = () => [...panel.querySelectorAll('[role=grid]')]
    .find((g) => visible(g) && !/엑셀/.test(g.getAttribute('aria-label') || '') && g.querySelector('[role=columnheader]'));
  const dataRows = () => {
    const g = studentGrid();
    return g ? [...g.querySelectorAll('[role=row][aria-rowindex]')].filter((r) => r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]')) : [];
  };
  dataRows().forEach((r) => { r.dataset.nsStale = '1'; });
  let maskSeen = false;
  const mo = new MutationObserver((ms) => {
    if (ms.some((m) => [...m.addedNodes].some((n) => n.classList?.contains('cl-loadmask')))) maskSeen = true;
  });
  mo.observe(document.body, { childList: true, subtree: true });
  // 나이스 버튼은 click 만으로는 반응하지 않을 때가 있다 (2026-11-24 정식 나이스: [조회]를 눌러도 조회 안 됨).
  // 실제 마우스처럼 누르고, 2.5초 동안 반응(가림막·새 행·창)이 없으면 키보드로 누른다.
  const pressBtn = (b, how) => {
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const t = hit && b.contains(hit) ? hit : (b.querySelector('.cl-text-wrapper, .cl-text') || b);
    if (how === 'mouse') {
      const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: 1 };
      const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
      t.dispatchEvent(new MouseEvent('mouseover', base));
      t.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
      t.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
      t.dispatchEvent(new PointerEvent('pointerup', { ...ptr, buttons: 0 }));
      t.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
      t.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
    } else {
      b.focus?.();
      for (const [key, code] of [['Enter', 13], [' ', 32]]) {
        const o = { key, code: key === ' ' ? 'Space' : key, keyCode: code, which: code, bubbles: true, cancelable: true };
        b.dispatchEvent(new KeyboardEvent('keydown', o));
        b.dispatchEvent(new KeyboardEvent('keyup', o));
      }
    }
  };
  let rows = 0;
  let pressedBy = null;
  let round = 1; // 조회 시도 횟수 (빈 결과면 한 번 더)
  try {
    const t0 = Date.now();
    let quietSince = Date.now();
    const tries = [['mouse', '마우스'], ['key', '키보드'], ['click', '클릭']];
    let tryAt = 0;
    let lastPress = 0;
    while (Date.now() - t0 < 30000) {
      // 아직 아무 반응이 없으면 다음 방법으로 누른다
      if (!maskSeen && !dataRows().some((r) => !r.dataset.nsStale) && tryAt < tries.length && Date.now() - lastPress > 2500) {
        const [how, label] = tries[tryAt++];
        if (how === 'click') btn.click(); else pressBtn(btn, how);
        pressedBy = label;
        lastPress = Date.now();
        quietSince = Date.now();
      }
      await wait(150);
      if (otherDialog()) {
        return { ok: false, here: true, error: '조회 중 나이스에 창이 떴습니다 (저장 여부 확인 등). 창을 직접 확인해 주세요.', done };
      }
      if (loadmask()) { maskSeen = true; quietSince = Date.now(); continue; }
      const now = dataRows();
      const fresh = now.some((r) => !r.dataset.nsStale);
      // 새 행이 나옴 → 조금 더 기다려 다 그려지게
      if (now.length && (fresh || maskSeen) && Date.now() - quietSince > 400) { rows = now.length; break; }
      // 가림막이 떴다 사라졌는데 2초 동안 행이 없음 → 화면 초기화가 조회를 지웠을 수 있어 한 번 더 조회, 그래도 없으면 학생 없음
      if (maskSeen && !now.length && Date.now() - quietSince > 2000) {
        if (round < 2) { round++; maskSeen = false; tryAt = 0; lastPress = 0; continue; }
        break;
      }
      // 세 방법 다 눌렀는데도 가림막도 새 행도 없이 3초 → 같은 결과가 그대로 있는 것으로 본다
      if (!maskSeen && tryAt >= tries.length && Date.now() - lastPress > 3000) { rows = now.length; break; }
    }
  } finally {
    mo.disconnect();
  }
  if (!rows) {
    return { ok: false, here: true, done, pressedBy, maskSeen, error: `조회했는데 학생이 나오지 않았습니다 (누른 방법: ${pressedBy || '없음'}, 처리중 표시 ${maskSeen ? '있었음' : '없었음'}, 조회 ${round}번). 조회조건(학년·과목·강의실 등)이 맞는지 확인해 주세요.` };
  }
  return { ok: true, here: true, done, notOnScreen, rows, pressedBy, round };
}

const btnApplyQuery = document.getElementById('btnApplyQuery');
if (btnApplyQuery) {
  btnApplyQuery.addEventListener('click', async () => {
    const st = document.getElementById('queryStatus');
    const say = (t) => { if (st) st.textContent = t; };
    const { savedQuery } = await chrome.storage.local.get(['savedQuery']);
    if (!savedQuery) { say('받은 조회조건이 없습니다.'); return; }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    btnApplyQuery.disabled = true;
    say('조회조건을 맞추는 중...');
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true }, func: applyNeisQueryInPage, args: [savedQuery],
      });
      const r = results.map((x) => x.result).find((x) => x && x.here);
      if (!r) say('나이스 입력 화면을 찾지 못했습니다. 메뉴에서 화면을 먼저 열어 주세요.');
      else if (!r.ok) say(`⚠️ ${r.error}${r.done?.length ? `\n(맞춘 조건: ${r.done.join(' · ')})` : ''}`);
      else {
        say(`조회 완료: ${r.done.join(' · ')}`
          + (r.notOnScreen?.length ? `\n(이 화면에 없는 조건은 건너뜀: ${r.notOnScreen.join(', ')})` : '')
          + '\n이제 첫 학생의 입력칸을 클릭하고 [일괄 입력 실행]을 누르세요.');
      }
    } catch (e) {
      say('⚠️ 나이스 페이지에서 실행해 주세요.');
    } finally {
      btnApplyQuery.disabled = false;
    }
  });
}

// 하단 '초기화' 버튼
const btnReset = document.getElementById('btnReset');
if (btnReset) btnReset.addEventListener('click', clearAllData);

function clampTabCount(value) {
  const count = parseInt(value, 10);
  if (!Number.isFinite(count)) return 2;
  return Math.min(Math.max(count, 1), 20);
}

function getForcedTabCount() {
  const forceTabToggle = document.getElementById('forceTabToggle');
  const forceTabCount = document.getElementById('forceTabCount');
  if (!forceTabToggle?.checked) return null;
  return clampTabCount(forceTabCount?.value);
}

// ──────────────────────────────────────────────────────────────
// 자동 입력 (과세특·행특): 받은 데이터의 종류에 맞는 나이스 화면을 찾아 열고 → 받은 조회조건으로 조회
//   → 첫 학생 입력칸을 열고 → 반/번호(번호)에 맞춰 넣는다. 저장은 사람이 한다.
//   화면 열기·조회 함수는 neis-pages.js (개발용 버튼과 같은 코드)
// ──────────────────────────────────────────────────────────────
const isNeisUrl = (url) => {
  try {
    const u = new URL(url);
    return /(^|\.)neis\.go\.kr$/.test(u.hostname) || (u.hostname === '127.0.0.1' && u.port === '8770' && u.pathname.startsWith('/neis/'));
  } catch { return false; }
};
// 지금 탭이 나이스면 그 탭, 아니면 이 창의 나이스 탭으로 옮긴다 (새로 열지는 않는다: 시도교육청마다 주소가 다르다)
async function findNeisTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active && isNeisUrl(active.url)) return active;
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const t = tabs.find((x) => isNeisUrl(x.url));
  if (!t) return null;
  await chrome.tabs.update(t.id, { active: true });
  return t;
}

let autoRunning = false;
//  묶음(groups) 데이터: 묶음마다 조회 → 첫 칸 열기 → 넣기 → [저장] → 다음 묶음. 시작 전에 한 번 묻는다.
//  묶음이 없는 데이터: 조회 → 넣기까지만 (저장은 사람이)
async function runAutoInput(screen) {
  if (autoRunning) return;
  const st = document.getElementById('autoStatus');
  const say = (t) => { if (st) st.textContent = t; };
  const exec = document.getElementById('btnExecute');
  const saved = await chrome.storage.local.get(['savedCategory', 'savedQuery', 'savedArray', 'savedStudents', 'savedGroups', 'savedDryRun']);
  // 개발용 시험 모드: 저장하지 않고 넣기 → 확인 → 다시 조회해 버리기 (개발용 '과세특 묶음 예시'가 정식 나이스에서 켠다)
  const dryRun = !!saved.savedDryRun;
  const label = AUTO_SCREENS[screen].label;
  const list = saved.savedArray || [];
  const students = Array.isArray(saved.savedStudents) && saved.savedStudents.length === list.length ? saved.savedStudents : null;
  const grouped = Array.isArray(saved.savedGroups) && saved.savedGroups.length > 0 && !!students;
  // 묶음별 [조회조건, 넣을 학생 번호들]
  const plan = grouped
    ? saved.savedGroups.map((g, gi) => ({ g, gi, idx: students.map((s, k) => (s.g === gi ? k : -1)).filter((k) => k >= 0) }))
    : [{ g: { query: saved.savedQuery, count: list.length }, gi: 0, idx: list.map((_, k) => k) }];
  if (!list.length) { showModal('데이터가 없습니다.'); return; }
  const tab = await findNeisTab();
  if (!tab) { showModal('⚠️ 나이스 탭을 찾지 못했습니다.\n나이스에 로그인한 탭을 연 뒤 다시 눌러 주세요.'); return; }
  if (grouped) {
    const lines = plan.map(({ g, gi }) => groupLabel(g, gi)).join('\n');
    const ok = dryRun
      ? await showConfirm(`[시험 모드] ${label} ${plan.length}개 묶음을 차례로\n조회 → 입력 → 확인 → 다시 조회(버림) 합니다.\n저장하지 않습니다.\n\n${lines}\n\n계속할까요?`, '시험 진행')
      : await showConfirm(`${label} ${plan.length}개 묶음을 차례로\n조회 → 입력 → [저장] 합니다.\n\n${lines}\n\n나이스에 바로 저장됩니다. 계속할까요?`, '저장까지 진행');
    if (!ok) return;
  }
  autoRunning = true;
  if (exec) exec.disabled = true;
  const run = (func, args) => chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func, args });
  const here = (results) => results.map((x) => x.result).find((x) => x && x.here) || null;
  const report = [];
  const guide = getSourceGuide(saved.savedCategory || '');
  // 개발 설치: 멈추면 단계별 화면 구조를 파일로 남긴다 (dev-tools.js 의 nsAutoLog, 웹스토어 설치에는 없음)
  const log = window.nsAutoLog || null;
  let stage = '시작';
  let lastSum = null;
  let lastSave = null;
  let lastDialog = null;
  const mark = async (name) => { stage = name; if (log) await log.step(name).catch(() => {}); };
  if (log) await log.start(tab, { 종류: label, 묶음수: plan.length, 묶음: grouped, 시험모드: dryRun, 학생수: list.length }).catch(() => {});
  try {
    // 1) 화면 열기 (한 번)
    say(`${label}: 나이스 화면 여는 중... (2차인증 창이 뜨면 번호를 넣어 주세요)`);
    const q0 = plan[0].g.query || {};
    const opened = screen === 'seteuk'
      ? pickNeisFrameResult(await run(openSeteukScreen, [NEIS_PAGE_TIMEOUTS]))
      : pickNeisFrameResult(await run(runNeisQuery, [{ grade: q0.grade || '', cls: q0.ban || '' }, '행동특성및종합의견', NEIS_PAGE_TIMEOUTS, false]));
    stage = `화면 열기 (${opened?.step || '?'})`;
    if (!opened?.ok) throw new Error(`화면을 열지 못했습니다 (${opened?.step || '?'}): ${opened?.error || '나이스 화면을 찾지 못함'}`);
    await mark('화면 열림');
    // 이미 열려 있던 화면을 다시 열면 나이스가 조금 뒤에 화면을 초기화한다 → 잠잠해질 때까지 기다린 뒤 조회
    say(`${label}: 화면이 다 열리기를 기다리는 중...`);
    stage = '화면 안정 대기';
    await run(waitScreenSettledInPage, [1500, 15000]);
    await mark('화면 안정');

    for (const { g, gi, idx } of plan) {
      const name = grouped ? `${label} 묶음 ${gi + 1}/${plan.length}` : label;
      // 2) 조회
      if (g.query) {
        say(`${name}: 조회하는 중... (${groupLabel(g, gi).replace(/^묶음 \d+: /, '')})`);
        stage = `${name} 조회`;
        const q = here(await run(applyNeisQueryInPage, [g.query]));
        if (!q) throw new Error(`${name}: 조회조건 칸을 찾지 못했습니다.`);
        if (!q.ok) throw new Error(`${name}: ${q.error}`);
        await mark(`${name} 조회 후`);
      }
      // 3) 첫 학생 입력칸
      say(`${name}: 첫 학생 입력칸 여는 중...`);
      stage = `${name} 첫 입력칸`;
      const fe = here(await run(openFirstEditorInPage, [screen]));
      if (!fe?.ok) throw new Error(`${name}: ${fe?.error || '첫 학생 입력칸을 열지 못했습니다.'}`);
      // 4) 넣기
      say(`${name}: ${idx.length}명 넣는 중...`);
      stage = `${name} 입력`;
      const sum = lastSum = await injectData(guide.tabCount, {
        forceTab: false, quiet: grouped,
        data: grouped ? { list: idx.map((k) => list[k]), students: idx.map((k) => students[k]) } : null,
      });
      await mark(`${name} 입력 후`);
      if (!grouped) { say(sum?.count ? `${label}: ${sum.count}건 넣음. 확인 후 나이스에서 [저장]을 눌러 주세요.` : ''); break; }
      const row = { 묶음: groupLabel(g, gi), 넣음: sum?.count || 0, 못찾음: sum?.notFound || [], 이름다름: sum?.mismatch || [], 저장: '' };
      report.push(row);
      if (sum?.matchError) throw new Error(`${name}: 표에서 반/번호 열을 찾지 못해 넣지 못했습니다.`);
      // 5) 시험 모드: 맞게 들어갔는지 세고 → 다시 조회해 버린다 (저장 안 함)
      if (dryRun) {
        say(`${name}: 확인하는 중...`);
        const v = here(await run(verifySampleTextsInPage, []));
        row.확인 = v?.ok ? `맞는 행 ${v.right} / 엉뚱한 행 ${v.wrong}` : '확인 못 함';
        say(`${name}: 다시 조회해서 버리는 중...`);
        stage = `${name} 다시 조회(버리기)`;
        const dc = here(await run(discardEditsInPage, [NEIS_PAGE_TIMEOUTS]));
        lastDialog = dc?.dialog || null;
        if (!dc?.ok) throw new Error(`${name}: ${dc?.error || '다시 조회하지 못했습니다.'}${dc?.dialog ? `\n[나이스 창] ${dc.dialog}` : ''}`);
        row.저장 = '시험 모드: 저장 안 하고 버림';
        continue;
      }
      // 5) 저장
      if (!row.넣음) { row.저장 = '넣은 학생 없음 → 저장 안 함'; continue; }
      say(`${name}: [저장] 중...`);
      stage = `${name} 저장`;
      // 나이스가 브라우저 기본 알림창을 띄워도 멈추지 않게, 저장하는 동안만 대신 처리한다
      const runMain = (func) => chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, world: 'MAIN', func }).catch(() => []);
      await runMain(patchNativeDialogsInPage);
      let sv;
      try {
        sv = here(await run(saveNeisScreenInPage, [NEIS_PAGE_TIMEOUTS]));
      } finally {
        // 기본 창도 저장 확인·완료 말고 다른 것만 결과에 남긴다
        const nativeLog = (await runMain(restoreNativeDialogsInPage)).flatMap((x) => x.result || [])
          .filter((m) => !/^확인: .*저장\s*하시겠|^알림: .*(저장\s*되었|저장되었|완료)/.test(m))
          .map((m) => `[기본 창] ${m.replace(/^(알림|확인|취소): /, '')}`);
        if (sv && nativeLog.length) sv.notes = [...(sv.notes || []), ...nativeLog];
      }
      lastSave = sv ? { 단계: sv.steps || [], 알림수: sv.notes?.length || 0 } : null;
      lastDialog = sv?.dialog || null;
      if (!sv?.ok) {
        row.저장 = '실패';
        throw new Error(`${name}: ${sv?.error || '저장 화면을 찾지 못했습니다.'}${sv?.dialog ? `\n[나이스 창] ${sv.dialog}` : ''}`
          + (sv?.notes?.length ? `\n[닫은 알림] ${sv.notes.join(' / ')}` : ''));
      }
      row.저장 = sv.nothing ? '바뀐 내용 없음' : '저장됨';
      if (sv.notes?.length) row.알림 = sv.notes;
      await mark(`${name} 저장 후`);
    }
    // 개발 설치: 성공해도 로그 파일을 남긴다 (선생님과 주고받는 동안 화면 구조 확인용)
    let okLog = null;
    if (log) {
      say('로그 저장 중...');
      okLog = await log.finish({ ok: true, stage: '끝', report, sum: lastSum, save: lastSave }).catch(() => null);
      // 묶음 하나짜리는 결과 팝업을 injectData 가 이미 띄웠으므로 상태줄에 이어 적는다
      say(!grouped && lastSum?.count
        ? `${label}: ${lastSum.count}건 넣음. 확인 후 나이스에서 [저장]을 눌러 주세요.${okLog?.name ? `\n[개발용] 로그 파일: ${okLog.name}` : ''}`
        : '');
    }
    const logNote = okLog?.name ? `\n\n[개발용] 로그 파일: 다운로드 폴더의 ${okLog.name}` : '';
    if (grouped) {
      say('');
      showModal(`${dryRun ? '[시험 모드] ' : ''}${label} ${plan.length}개 묶음을 마쳤습니다.\n\n${summarize(report)}${logNote}`);
    }
  } catch (e) {
    say('');
    // 개발 설치: 멈춘 곳 로그 파일
    let logFile = null;
    if (log) {
      say('멈춘 곳 로그 저장 중...');
      logFile = await log.finish({ ok: false, stage, error: e.message, dialog: lastDialog, report, sum: lastSum, save: lastSave }).catch(() => null);
      say('');
    }
    showModal(`⚠️ ${label} 자동 입력을 멈췄습니다.\n${e.message}`
      + (logFile?.name ? `\n\n[개발용] 로그 파일: 다운로드 폴더의 ${logFile.name}` : '')
      + (report.length ? `\n\n지금까지:\n${summarize(report)}` : '')
      + (grouped ? '\n\n멈춘 묶음은 저장되지 않았을 수 있습니다. 나이스 화면을 확인해 주세요.' : '\n\n화면을 직접 연 뒤 첫 학생 칸을 클릭하고 다시 눌러도 됩니다.'));
  } finally {
    autoRunning = false;
    if (exec) exec.disabled = false;
  }
}
function summarize(report) {
  const names = (arr) => arr.slice(0, 6).join(', ') + (arr.length > 6 ? ` 외 ${arr.length - 6}명` : '');
  return report.map((r) => `· ${r.묶음}\n   ${r.넣음}명 넣음${r.확인 ? ` (${r.확인})` : ''} / ${r.저장 || '저장 전'}`
    + (r.못찾음.length ? `\n   ⚠️ 표에 없음: ${names(r.못찾음)}` : '')
    + (r.이름다름.length ? `\n   ⚠️ 이름 달라 안 넣음: ${names(r.이름다름)}` : '')
    + (r.알림?.length ? `\n   나이스 알림(확인으로 닫음): ${r.알림.join(' / ')}` : '')).join('\n');
}

// '일괄 입력 실행' — 과세특·행특은 화면을 찾아 들어가 자동 입력, 그 밖은 커서를 둔 칸부터 (저장된 데이터 소스에 맞춰 이동 횟수 자동 적용)
const btnExecute = document.getElementById('btnExecute');
if (btnExecute) {
  btnExecute.addEventListener('click', () => {
    chrome.storage.local.get(['savedCategory'], (res) => {
      const guide = getSourceGuide(res.savedCategory || '');
      const forcedTabCount = getForcedTabCount();
      applySourceGuide(res.savedCategory || '');
      const auto = autoScreenOf(res.savedCategory || '');
      // 탭 수 강제 설정을 켰으면 예전 방식 (사람이 커서를 둔 칸부터)
      if (auto && forcedTabCount === null) { runAutoInput(auto); return; }
      injectData(forcedTabCount || guide.tabCount, { forceTab: forcedTabCount !== null });
    });
  });
}

// 입력 방식 세그먼트 (덮어쓰기 / 줄바꿈 추가 / 문구 추가)
const appendSegs = document.querySelectorAll('.segmented .seg');
appendSegs.forEach((seg) => {
  seg.addEventListener('click', () => {
    appendSegs.forEach((s) => s.classList.remove('active'));
    seg.classList.add('active');
    const radio = seg.querySelector('input[name="appendType"]');
    if (radio) radio.checked = true;
    const sepRow = document.getElementById('customSeparatorRow');
    if (sepRow) sepRow.style.display = (radio && radio.value === 'custom') ? 'flex' : 'none';
  });
});

// --- 옵션 사이드바 ---
const optionsBtn = document.getElementById('optionsBtn');
const optionsSidebar = document.getElementById('optionsSidebar');
const optionsOverlay = document.getElementById('optionsOverlay');
const optionsClose = document.getElementById('optionsClose');

function openOptions() {
  optionsSidebar.classList.add('open');
  optionsOverlay.classList.add('open');
}

function closeOptions() {
  commitDirectPasteIfEnabled();
  optionsSidebar.classList.remove('open');
  optionsOverlay.classList.remove('open');
}

optionsBtn.addEventListener('click', openOptions);
optionsClose.addEventListener('click', closeOptions);
optionsOverlay.addEventListener('click', closeOptions);

// 속도 선택 UI 로직
const speedOptions = document.querySelectorAll('.speed-option');
speedOptions.forEach(option => {
  option.addEventListener('click', () => {
    // 모든 선택 해제
    speedOptions.forEach(o => o.classList.remove('selected'));
    // 클릭된 것 선택
    option.classList.add('selected');
    option.querySelector('input[type="radio"]').checked = true;

    // 저장
    const speed = option.dataset.speed;
    chrome.storage.local.set({ speedSetting: speed });
  });
});

// 저장된 속도 설정 로드
chrome.storage.local.get(['speedSetting'], (res) => {
  const savedSpeed = res.speedSetting || 'normal';
  speedOptions.forEach(option => {
    if (option.dataset.speed === savedSpeed) {
      option.classList.add('selected');
      option.querySelector('input[type="radio"]').checked = true;
    } else {
      option.classList.remove('selected');
    }
  });
});

// 데이터 직접 붙여넣기
const directPasteToggle = document.getElementById('directPasteToggle');
const directPasteInput = document.getElementById('directPasteInput');
const directPasteControls = document.getElementById('directPasteControls');
const directPasteStatus = document.getElementById('directPasteStatus');

function parseDirectPasteRows(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split('\t').map((cell) => cell.trim()).filter(Boolean).join(' '))
    .map((line) => line.trim())
    .filter(Boolean);
}

function setDirectPasteStatus(text) {
  if (directPasteStatus) directPasteStatus.textContent = text;
}

function applyDirectPasteState(enabled) {
  if (directPasteToggle) directPasteToggle.checked = enabled;
  if (directPasteInput) directPasteInput.disabled = !enabled;
  if (directPasteControls) directPasteControls.classList.toggle('enabled', enabled);
}

function commitDirectPasteData() {
  const rows = parseDirectPasteRows(directPasteInput?.value || '');
  if (rows.length === 0) {
    setDirectPasteStatus('0건 대기');
    return;
  }

  chrome.storage.local.set({ savedArray: rows, savedCategory: '', savedSubject: '', savedStudents: null, savedQuery: null, savedGroups: null }, () => {
    chrome.action.setBadgeText({ text: String(rows.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#E66914' });
    applyCategoryTitle('');
    applySourceGuide('');
    renderTable(rows);
    renderQueryGuide(null);
    setDirectPasteStatus(`${rows.length}건 반영됨`);
  });
}

function commitDirectPasteIfEnabled() {
  if (!directPasteToggle?.checked) return;
  applyDirectPasteState(false);
  chrome.storage.local.set({ directPasteEnabled: false });
  commitDirectPasteData();
}

if (directPasteToggle) {
  directPasteToggle.addEventListener('change', () => {
    const enabled = directPasteToggle.checked;
    applyDirectPasteState(enabled);
    chrome.storage.local.set({ directPasteEnabled: enabled });

    if (enabled) {
      directPasteInput?.focus();
      setDirectPasteStatus(`${parseDirectPasteRows(directPasteInput?.value || '').length}건 대기`);
    } else {
      commitDirectPasteData();
    }
  });
}

if (directPasteInput) {
  directPasteInput.addEventListener('input', () => {
    const rows = parseDirectPasteRows(directPasteInput.value);
    setDirectPasteStatus(`${rows.length}건 대기`);
    chrome.storage.local.set({ directPasteText: directPasteInput.value });
  });
}

chrome.storage.local.get(['directPasteEnabled', 'directPasteText'], (res) => {
  if (directPasteInput) directPasteInput.value = res.directPasteText || '';
  applyDirectPasteState(Boolean(res.directPasteEnabled));
  setDirectPasteStatus(`${parseDirectPasteRows(res.directPasteText || '').length}건 대기`);
});

// 탭수 강제 설정
const forceTabToggle = document.getElementById('forceTabToggle');
const forceTabCount = document.getElementById('forceTabCount');
const forceTabControls = document.getElementById('forceTabControls');

function applyForceTabState(enabled) {
  if (forceTabToggle) forceTabToggle.checked = enabled;
  if (forceTabCount) forceTabCount.disabled = !enabled;
  if (forceTabControls) forceTabControls.classList.toggle('enabled', enabled);
}

if (forceTabToggle) {
  forceTabToggle.addEventListener('change', () => {
    const enabled = forceTabToggle.checked;
    applyForceTabState(enabled);
    chrome.storage.local.set({ forceTabEnabled: enabled });
  });
}

if (forceTabCount) {
  forceTabCount.addEventListener('input', () => {
    const count = parseInt(forceTabCount.value, 10);
    if (Number.isFinite(count)) chrome.storage.local.set({ forceTabCount: clampTabCount(count) });
  });

  forceTabCount.addEventListener('change', () => {
    const count = clampTabCount(forceTabCount.value);
    forceTabCount.value = String(count);
    chrome.storage.local.set({ forceTabCount: count });
  });
}

chrome.storage.local.get(['forceTabEnabled', 'forceTabCount'], (res) => {
  const count = clampTabCount(res.forceTabCount ?? 2);
  if (forceTabCount) forceTabCount.value = String(count);
  applyForceTabState(Boolean(res.forceTabEnabled));
});


// ──────────────────────────────────────────────────────────────
// 사이트에서 전송돼 저장된 데이터(savedArray)+카테고리(savedCategory)를 미리보기에 표시
// ──────────────────────────────────────────────────────────────

// 패널을 열었을 때 저장된 데이터 표시
function loadSavedData() {
  chrome.storage.local.get(['savedArray', 'savedCategory', 'savedSubject', 'savedStudents', 'savedQuery', 'savedGroups'], (res) => {
    applyCategoryTitle(res.savedCategory || '', res.savedSubject || '');
    applySourceGuide(res.savedCategory || '');
    renderTable(res.savedArray || [], res.savedStudents || null, res.savedGroups || null, res.savedQuery || null);
    renderQueryGuide(res.savedQuery || null, res.savedGroups || null, res.savedCategory || '');
  });
}
loadSavedData();

// 패널이 열려 있는 동안 사이트에서 새 데이터가 들어오면 실시간 반영
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.savedCategory || changes.savedSubject) {
    chrome.storage.local.get(['savedCategory', 'savedSubject'], (res) => {
      applyCategoryTitle(res.savedCategory || '', res.savedSubject || '');
      applySourceGuide(res.savedCategory || '');
    });
  }
  if (changes.savedArray || changes.savedStudents || changes.savedQuery || changes.savedGroups || changes.savedCategory) {
    chrome.storage.local.get(['savedArray', 'savedStudents', 'savedQuery', 'savedGroups', 'savedCategory'], (res) => {
      renderTable(res.savedArray || [], res.savedStudents || null, res.savedGroups || null, res.savedQuery || null);
      renderQueryGuide(res.savedQuery || null, res.savedGroups || null, res.savedCategory || '');
    });
  }
});
