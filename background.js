// 확장 프로그램 아이콘을 클릭했을 때 사이드 패널이 열리도록 설정
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 설치 시 초기화 로직 (선택 사항)
chrome.runtime.onInstalled.addListener(() => {
  console.log("나이스샷이 설치되었습니다.");
});

// ──────────────────────────────────────────────────────────────
// [추가] 생기부 수정 사이트 → 평어 데이터 수신 (외부 메시지)
//   · manifest.json 의 externally_connectable.matches 가 1차 보안 경계
//   · 아래 isAllowedSender() 출처 검증이 2차 방어
// ──────────────────────────────────────────────────────────────

// 발신 페이지가 신뢰할 수 있는 출처인지 검증한다.
//  · GitHub Pages 는 하나의 origin(veryhungryface.github.io)에 여러 프로젝트가
//    공존하므로, origin 만으로는 부족하고 경로(/student-record-ai-editor/)까지 확인한다.
//  · 로컬 개발(localhost / 127.0.0.1)은 포트와 무관하게 허용한다.
function isAllowedSender(sender) {
  try {
    const u = new URL(sender.url || sender.origin || "");
    if (
      u.origin === "https://issamgpt.com" ||
      u.hostname.endsWith(".issamgpt.com") ||
      u.origin === "https://student-record-ai-editor.vercel.app" ||
      u.origin === "https://student-record-ai-editor-cxk5.vercel.app"
    ) {
      return true;
    }
    if (u.origin === "https://veryhungryface.github.io") {
      return u.pathname.startsWith("/student-record-ai-editor/");
    }
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return true;
    }
  } catch (e) {
    // URL 파싱 실패 → 거부
  }
  return false;
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // 1) 발신 출처 검증 (manifest 외에 한 번 더 방어)
  if (!isAllowedSender(sender)) {
    sendResponse({ ok: false, error: "FORBIDDEN_ORIGIN" });
    return;
  }

  // 2) 페이로드 검증
  if (msg?.type !== "NEISSHOT_DATA" || !Array.isArray(msg.rows)) {
    sendResponse({ ok: false, error: "BAD_PAYLOAD" });
    return;
  }

  // 3) 정규화: 문자열화 + 트림 + 빈 행 제거
  const rows = msg.rows
    .map((r) => String(r ?? "").trim())
    .filter((r) => r.length > 0);

  // 3-1) 카테고리/과목 — 미리보기 제목, 메뉴 위치, 자동 탭 수에 사용.
  const category = typeof msg.category === "string" ? msg.category.trim() : "";
  const subject =
    typeof msg.subject === "string" ? msg.subject.trim() :
      typeof msg.subjectName === "string" ? msg.subjectName.trim() : "";

  // 4) 저장 (sidepanel.js 의 injectData / 미리보기가 읽는 키와 동일)
  chrome.storage.local.set({ savedArray: rows, savedCategory: category, savedSubject: subject }, () => {
    // 5) 확장 아이콘에 건수 배지 표시
    chrome.action.setBadgeText({ text: rows.length ? String(rows.length) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#E66914" });
    sendResponse({ ok: true, count: rows.length });
  });

  return true; // sendResponse 비동기 호출을 위해 필수
});



// ──────────────────────────────────────────────────────────────
// [추가] 단축키(Alt+G)로 사이드패널 열기 (manifest commands.open-side-panel)
//   · 키 입력은 사용자 제스처로 인정되어 sidePanel.open() 호출 가능
//   · onCommand 의 tab 인자를 그대로 사용해 제스처 컨텍스트 유지
// ──────────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-side-panel") return;
  const windowId = tab && tab.windowId;
  if (windowId != null) {
    chrome.sidePanel.open({ windowId }).catch((e) => console.error(e));
    return;
  }
  // tab 정보가 없으면 현재 창 기준으로 시도
  chrome.windows.getCurrent().then((win) => {
    if (win && win.id != null) {
      chrome.sidePanel.open({ windowId: win.id }).catch((e) => console.error(e));
    }
  });
});
