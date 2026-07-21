const tableBody = document.getElementById('tableBody');
const rowCountDisplay = document.getElementById('rowCount');

// 커스텀 알림 모달 (네이티브 alert 대체) — 확장 아이콘이 들어간 자체 팝업
const nsModalOverlay = document.getElementById('nsModalOverlay');
const nsModalMsg = document.getElementById('nsModalMsg');
const nsModalOk = document.getElementById('nsModalOk');
let nsModalOnOk = null; // '확인' 클릭 시 실행할 콜백 (오버레이 클릭 취소 시에는 실행 안 함)
function showModal(message, onOk) {
  if (!nsModalOverlay || !nsModalMsg) {
    window.alert(message);
    if (typeof onOk === 'function') onOk();
    return;
  }
  nsModalMsg.textContent = message;
  nsModalOnOk = typeof onOk === 'function' ? onOk : null;
  nsModalOverlay.classList.add('open');
}
function hideModal(runOk = false) {
  if (nsModalOverlay) nsModalOverlay.classList.remove('open');
  const cb = nsModalOnOk;
  nsModalOnOk = null;
  if (runOk && cb) cb();
}
if (nsModalOk) nsModalOk.addEventListener('click', () => hideModal(true));
if (nsModalOverlay) nsModalOverlay.addEventListener('click', (e) => {
  if (e.target === nsModalOverlay) hideModal(false);
});

// 사이트에서 함께 넘어온 카테고리 → 미리보기 제목 매핑
//  · 사이트(Part B)는 메시지에 category 필드를 함께 보냄 (코드 또는 라벨)
//  · 알 수 없는 값이면 받은 문자열을 그대로 제목으로 사용
const CATEGORY_LABELS = {
  subject: '교과발달사항 특기사항',
  creative: '창의적 체험활동 특기사항',
  behavior: '행동발달 특기사항',
  reading: '독서활동상황',
};

const SOURCE_GUIDES = [
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
    menuPath: '지원되는 소스: 교과학습발달, 창체, 행발',
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

  const label = CATEGORY_LABELS[category] || category;
  return `${label} 미리보기`;
}

function applyCategoryTitle(category, subject = '') {
  const el = document.getElementById('previewTitle');
  if (el) el.textContent = previewTitleText(category, subject);
}

function applySourceGuide(category) {
  const guide = getSourceGuide(category);
  const sourceLabel = document.getElementById('menuSourceLabel');
  const menuPath = document.getElementById('menuPathText');

  if (sourceLabel) sourceLabel.textContent = guide.sourceLabel;
  if (menuPath) menuPath.textContent = guide.menuPath;
}

// 표 렌더링 함수
function renderTable(lines) {
  tableBody.innerHTML = '';
  rowCountDisplay.innerText = `${lines.length}건`;

  // 데이터 유무에 따라 실행 버튼 활성화 / 미리보기 빈 상태 토글
  const _execBtn = document.getElementById('btnExecute');
  if (_execBtn) _execBtn.disabled = lines.length === 0;
  const _empty = document.getElementById('previewEmpty');
  if (_empty) _empty.style.display = lines.length ? 'none' : 'block';

  lines.forEach((line, index) => {
    const tr = document.createElement('tr');

    const tdNum = document.createElement('td');
    tdNum.innerText = index + 1;
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

// --- 나이스 입력 실행 함수 (Tab 방식) ---
async function injectData(tabCount) {
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

  chrome.storage.local.get(['savedArray'], (res) => {
    const dataList = res.savedArray || [];
    if (dataList.length === 0) { showModal("데이터가 없습니다."); return; }

    chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (list, tabsPerRow, appendCfg, delayConfig) => {
        const TABS_PER_ROW = tabsPerRow;
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

        console.log('✅ 활성화된 입력 요소 발견! Tab 방식으로 입력 시작');

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
            let newInput = getActiveInput() || currentInput;

            if (newInput) {
              currentInput = newInput;
              console.log(`${i}번: Tab으로 이동 성공!`);
            } else {
              console.log(`${i}번: Tab 이동 실패, 입력 요소를 찾지 못함`);
            }
          }

          // 현재 입력 요소에 입력 (textarea 또는 input)
          if (isEditableInput(currentInput)) {
            console.log(`${i}번: ${currentInput.tagName} 발견, 입력 시작...`);

            // 확실히 포커스
            currentInput.focus();
            await wait(DELAYS.focus);

            // APPEND_CONFIG에 따라 기존 텍스트 처리
            let finalText = textData;
            if (APPEND_CONFIG.type !== 'none') {
              const existingText = (currentInput.value || currentInput.textContent || '').trim();
              if (existingText) {
                if (APPEND_CONFIG.type === 'newline') {
                  finalText = existingText + '\n' + textData;
                } else if (APPEND_CONFIG.type === 'custom') {
                  finalText = existingText + APPEND_CONFIG.separator + textData;
                }
                console.log(`${i}번: 기존 텍스트 뒤에 추가 (${APPEND_CONFIG.type})`);
              }
            } else {
              currentInput.select && currentInput.select();
            }

            if (currentInput.tagName === 'TEXTAREA' || currentInput.tagName === 'INPUT') {
              currentInput.value = finalText;

              // 네이티브 setter (textarea와 input 모두 지원)
              const setter = currentInput.tagName === 'TEXTAREA'
                ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
                : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (setter) setter.call(currentInput, finalText);
            } else {
              currentInput.textContent = finalText;
            }

            // 이벤트 발생
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            currentInput.dispatchEvent(new Event('change', { bubbles: true }));

            // blur 이벤트로 값 확정
            await wait(DELAYS.blur);
            currentInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

            successCount++;
            console.log(`✅ ${i}번 입력 완료: "${textData.substring(0, 20)}..."`);
          } else {
            console.warn(`⚠️ ${i}번: 입력 요소 없음, 스킵`);
          }

          // 다음 입력 전 대기 (값 확정 시간 부여)
          await wait(DELAYS.next);
        }

        return { success: true, total: list.length, count: successCount };
      },
      args: [dataList, tabCount, appendConfig, delays]
    }).then((results) => {
      // 모든 프레임의 결과 확인
      let hasSuccess = false;
      let totalCount = 0;
      let successCount = 0;
      let allNoCursor = true;

      if (results) {
        for (const r of results) {
          if (r.result) {
            if (r.result.success) {
              hasSuccess = true;
              totalCount = r.result.total;
              successCount += r.result.count;
              allNoCursor = false;
            } else if (r.result.error !== 'NO_CURSOR') {
              allNoCursor = false;
            }
          }
        }
      }

      if (hasSuccess) {
        chrome.action.setBadgeText({ text: '' }); // 입력 완료 → 아이콘 배지 정리
        showModal(`${totalCount}명 중 ${successCount}건 입력 완료\n\n⚠️ 저장 버튼을 눌러 저장해주세요!`);
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
    }).catch((err) => {
      console.error('executeScript 오류:', err);
      showModal('⚠️ 나이스 페이지에서 실행해주세요!');
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
  chrome.storage.local.remove(['savedArray', 'savedCategory', 'savedSubject', 'directPasteText', 'directPasteEnabled']);
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

// '일괄 입력 실행' — 저장된 데이터 소스에 맞춰 이동 횟수 자동 적용
const btnExecute = document.getElementById('btnExecute');
if (btnExecute) {
  btnExecute.addEventListener('click', () => {
    chrome.storage.local.get(['savedCategory'], (res) => {
      const guide = getSourceGuide(res.savedCategory || '');
      const forcedTabCount = getForcedTabCount();
      applySourceGuide(res.savedCategory || '');
      injectData(forcedTabCount || guide.tabCount);
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

  chrome.storage.local.set({ savedArray: rows, savedCategory: '', savedSubject: '' }, () => {
    chrome.action.setBadgeText({ text: String(rows.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#E66914' });
    applyCategoryTitle('');
    applySourceGuide('');
    renderTable(rows);
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
  chrome.storage.local.get(['savedArray', 'savedCategory', 'savedSubject'], (res) => {
    applyCategoryTitle(res.savedCategory || '', res.savedSubject || '');
    applySourceGuide(res.savedCategory || '');
    renderTable(res.savedArray || []);
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
  if (changes.savedArray) renderTable(changes.savedArray.newValue || []);
});
