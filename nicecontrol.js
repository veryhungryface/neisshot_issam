// ──────────────────────────────────────────────────────────────
// NiceControl — 나이스(NEIS) 퀵 런처
//  · 사이드패널의 '나이스 바로가기' 버튼을 눌렀을 때:
//    1) 열려 있는 나이스 탭이 있으면 그 탭을 활성화(창 포커스 포함)하고
//       목표 URL로 즉시 이동시킨다. (탭 재활용 — 새 탭 남발 방지)
//    2) 없으면 세션 쿠키로 로그인 여부를 확인한 뒤,
//       미로그인 → 안내 모달 후 로그인 화면 새 탭,
//       로그인 → 목표 URL 새 탭을 연다.
//  · sidepanel.js 뒤에 로드되어 showModal(message, onOk)을 함께 사용한다.
// ──────────────────────────────────────────────────────────────

// 대상 사이트 정의 — 테스트 모드에서는 나이스 대신 i-scream.co.kr 로 동일 로직을 검증한다.
const NC_SITES = {
  neis: {
    key: 'neis',
    patterns: ['https://neis.go.kr/*', 'https://*.neis.go.kr/*'],
    home: 'https://www.neis.go.kr/',
    name: '나이스',
  },
  test: {
    key: 'test',
    patterns: [
      'https://i-scream.co.kr/*',
      'https://*.i-scream.co.kr/*',
      'http://i-scream.co.kr/*',
      'http://*.i-scream.co.kr/*',
    ],
    home: 'https://www.i-scream.co.kr/',
    name: '아이스크림(테스트)',
  },
};

// 시·도 교육청별 나이스 도메인 접두어 — 미선택 시 통합 포털로 이동
const NC_REGIONS = [
  { code: '', label: '통합 포털(자동)' },
  { code: 'sen', label: '서울' },
  { code: 'pen', label: '부산' },
  { code: 'dge', label: '대구' },
  { code: 'ice', label: '인천' },
  { code: 'gen', label: '광주' },
  { code: 'dje', label: '대전' },
  { code: 'use', label: '울산' },
  { code: 'sje', label: '세종' },
  { code: 'goe', label: '경기' },
  { code: 'gwe', label: '강원' },
  { code: 'cbe', label: '충북' },
  { code: 'cne', label: '충남' },
  { code: 'jbe', label: '전북' },
  { code: 'jne', label: '전남' },
  { code: 'gbe', label: '경북' },
  { code: 'gne', label: '경남' },
  { code: 'jje', label: '제주' },
];

// 로그인 세션으로 간주할 쿠키 이름 패턴 — 하나라도 있으면 로그인 상태로 판단.
// (WMONID 처럼 로그인 여부와 무관하게 발급되는 쿠키는 제외)
const NC_SESSION_COOKIE_PATTERN = /^(jsessionid|session.*|.*token.*|.*sso.*)$/i;

// 기본 제공 바로가기 — url 이 비어 있으면 나이스 홈으로 이동
const NC_BUILTIN_MENUS = [
  { label: '🏠 나이스 홈', url: '' },
];

const ncGrid = document.getElementById('ncGrid');
const ncMenuInput = document.getElementById('ncMenuInput');
const ncMenuStatus = document.getElementById('ncMenuStatus');
const ncRegionSelect = document.getElementById('ncRegionSelect');
const ncTestToggle = document.getElementById('ncTestToggle');

function ncActiveSite() {
  return ncTestToggle && ncTestToggle.checked ? NC_SITES.test : NC_SITES.neis;
}

function ncRegionOrigin(code) {
  return code ? `https://${code}.neis.go.kr/` : NC_SITES.neis.home;
}

// 메뉴 url 이 절대 주소면 그대로, 경로(/...)면 origin 기준으로 합쳐 목표 URL 을 만든다.
function ncResolveTarget(url, origin) {
  const raw = String(url || '').trim();
  if (!raw) return origin;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, origin).href;
  } catch (e) {
    return origin;
  }
}

// ① 로그인 상태 확인 — 세션 쿠키 존재 여부로 판별
async function ncIsLoggedIn(originUrl) {
  try {
    const cookies = await chrome.cookies.getAll({ url: originUrl });
    return cookies.some((cookie) => NC_SESSION_COOKIE_PATTERN.test(cookie.name));
  } catch (e) {
    console.warn('NiceControl: 쿠키 확인 실패 — 이동은 계속 진행', e);
    return true; // 판별 불가 시 이동은 진행 (세션 만료는 나이스가 로그인 화면으로 처리)
  }
}

// ②·③ 탭 탐색 + 제어 — 명세서의 핵심 흐름
async function ncOpenMenu(menu) {
  const site = ncActiveSite();
  const regionCode = ncRegionSelect ? ncRegionSelect.value : '';
  let origin = site.key === 'neis' ? ncRegionOrigin(regionCode) : site.home;

  // 열려 있는 대상 사이트 탭 전체 스캔 (모든 창 대상)
  const tabs = await chrome.tabs.query({ url: site.patterns });

  if (tabs.length > 0) {
    // 다중 탭이 열려 있으면 첫 번째 탭 기준으로 재활용 (명세서 5. 예외 처리)
    const tab = tabs[0];
    try {
      origin = new URL(tab.url).origin + '/';
    } catch (e) { /* origin 파싱 실패 시 지역 설정값 유지 */ }

    await chrome.tabs.update(tab.id, { active: true, url: ncResolveTarget(menu.url, origin) });
    if (tab.windowId != null) {
      await chrome.windows.update(tab.windowId, { focused: true }); // 다른 창이면 창째로 끌어올림
    }
    return;
  }

  // 대상 사이트 탭이 없음 → 로그인 상태 검증
  const loggedIn = await ncIsLoggedIn(origin);
  if (!loggedIn) {
    showModal(
      `${site.name} 로그인이 필요합니다.\n확인을 누르면 ${site.name} 화면을 새 탭으로 엽니다.`,
      () => { chrome.tabs.create({ url: origin, active: true }); }
    );
    return;
  }

  await chrome.tabs.create({ url: ncResolveTarget(menu.url, origin), active: true });
}

// ──────────────────────────────────────────────────────────────
// 사용자 정의 바로가기 — 설정에서 「이름 | 주소」 한 줄씩 입력
// ──────────────────────────────────────────────────────────────

function ncParseMenus(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split('|');
      return { label: String(label || '').trim(), url: rest.join('|').trim() };
    })
    .filter((menu) => menu.label);
}

function ncRenderMenus(customMenus) {
  if (!ncGrid) return;
  ncGrid.innerHTML = '';

  [...NC_BUILTIN_MENUS, ...customMenus].forEach((menu) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nc-btn';
    btn.textContent = menu.label;
    btn.title = menu.url || '나이스 홈';
    btn.addEventListener('click', () => {
      ncOpenMenu(menu).catch((e) => {
        console.error('NiceControl: 이동 실패', e);
        showModal('⚠️ 나이스 탭을 여는 데 실패했습니다.\n잠시 후 다시 시도해 주세요.');
      });
    });
    ncGrid.appendChild(btn);
  });
}

function ncSetStatus(count) {
  if (ncMenuStatus) ncMenuStatus.textContent = `내 바로가기 ${count}개`;
}

if (ncMenuInput) {
  ncMenuInput.addEventListener('input', () => {
    const menus = ncParseMenus(ncMenuInput.value);
    chrome.storage.local.set({ ncMenuText: ncMenuInput.value });
    ncRenderMenus(menus);
    ncSetStatus(menus.length);
  });
}

if (ncRegionSelect) {
  NC_REGIONS.forEach((region) => {
    const option = document.createElement('option');
    option.value = region.code;
    option.textContent = region.label;
    ncRegionSelect.appendChild(option);
  });

  ncRegionSelect.addEventListener('change', () => {
    chrome.storage.local.set({ ncRegion: ncRegionSelect.value });
  });
}

if (ncTestToggle) {
  ncTestToggle.addEventListener('change', () => {
    chrome.storage.local.set({ ncTestMode: ncTestToggle.checked });
  });
}

// 저장된 설정 로드 후 초기 렌더링
chrome.storage.local.get(['ncMenuText', 'ncRegion', 'ncTestMode'], (res) => {
  if (ncMenuInput) ncMenuInput.value = res.ncMenuText || '';
  if (ncRegionSelect) ncRegionSelect.value = res.ncRegion || '';
  if (ncTestToggle) ncTestToggle.checked = Boolean(res.ncTestMode);
  const menus = ncParseMenus(res.ncMenuText || '');
  ncRenderMenus(menus);
  ncSetStatus(menus.length);
});
