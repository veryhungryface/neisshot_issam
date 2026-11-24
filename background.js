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

// 받은 데이터 검사·정리 → chrome.storage.local 에 저장 → 응답.
//  issamGPT(외부 메시지)와 개발용 '예시 데이터 받기'(내부 메시지)가 같은 길을 쓴다.
//  형식 설명: docs/issamgpt-message-format.md
function acceptPayload(msg, sendResponse) {
  // 1) 페이로드 검증: groups(조회조건별 학생 묶음), students(학생별 반·번호·이름·문장), rows(문장 목록) 중 하나는 있어야 한다
  if (msg?.type !== "NEISSHOT_DATA" || !(Array.isArray(msg.groups) || Array.isArray(msg.rows) || Array.isArray(msg.students))) {
    sendResponse({ ok: false, error: "BAD_PAYLOAD" });
    return false;
  }

  // 2) 정규화
  //  · students 가 있으면 그것을 쓴다: 문장이 빈 학생은 빼고, 반·번호는 숫자 글자만 남긴다
  //  · 없으면 예전 방식: rows 를 문자열화 + 트림 + 빈 행 제거
  const digits = (v) => {
    const m = String(v ?? "").match(/\d+/g);
    return m ? String(Number(m[m.length - 1])) : "";
  };
  const normStudents = (list) => (Array.isArray(list) ? list : [])
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      ban: digits(s.ban),
      no: digits(s.no),
      name: typeof s.name === "string" ? s.name.trim() : "",
      text: String(s.text ?? "").trim(),
    }))
    .filter((s) => s.text.length > 0);
  // 나이스 조회조건: 아는 칸만 문자열로 남긴다
  const normQuery = (q) => {
    if (!q || typeof q !== "object") return null;
    const out = {};
    for (const k of ["year", "semester", "grade", "ban", "subject", "room"]) {
      const v = q[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") out[k] = String(v).trim();
    }
    return Object.keys(out).length ? out : null;
  };
  let students = null;
  let rows;
  let groups = null;
  if (Array.isArray(msg.groups)) {
    // 조회조건(학년·과목·강의실 등)이 다른 묶음 여러 개: 묶음마다 조회 → 입력 → 저장
    groups = msg.groups
      .filter((g) => g && typeof g === "object")
      .map((g) => ({ query: normQuery(g.query), subject: typeof g.subject === "string" ? g.subject.trim() : "", students: normStudents(g.students) }))
      .filter((g) => g.students.length > 0);
    if (!groups.length) {
      sendResponse({ ok: false, error: "BAD_PAYLOAD", detail: "groups 에 문장이 있는 학생이 없습니다" });
      return false;
    }
    if (groups.some((g) => !g.query)) {
      sendResponse({ ok: false, error: "BAD_PAYLOAD", detail: "groups[].query 가 없는 묶음이 있습니다" });
      return false;
    }
    students = groups.flatMap((g, gi) => g.students.map((s) => ({ ...s, g: gi })));
    if (students.some((s) => !s.no)) {
      sendResponse({ ok: false, error: "BAD_PAYLOAD", detail: "students[].no 가 없는 학생이 있습니다" });
      return false;
    }
    rows = students.map((s) => s.text);
  } else if (Array.isArray(msg.students)) {
    students = normStudents(msg.students);
    if (students.some((s) => !s.no)) {
      sendResponse({ ok: false, error: "BAD_PAYLOAD", detail: "students[].no 가 없는 학생이 있습니다" });
      return false;
    }
    rows = students.map((s) => s.text);
  } else {
    rows = msg.rows
      .map((r) => String(r ?? "").trim())
      .filter((r) => r.length > 0);
  }

  // 2-0) 나이스 조회조건 (선택). 아는 칸만 문자열로 남긴다.
  //  묶음이 하나뿐이면 그 묶음의 조회조건을 쓴다
  let query = groups ? (groups.length === 1 ? groups[0].query : null) : normQuery(msg.query);

  // 2-1) 카테고리/과목 — 미리보기 제목, 메뉴 위치, 자동 탭 수에 사용.
  const category = typeof msg.category === "string" ? msg.category.trim() : "";
  let subject =
    typeof msg.subject === "string" ? msg.subject.trim() :
      typeof msg.subjectName === "string" ? msg.subjectName.trim() : "";
  if (!subject && groups?.length === 1) subject = groups[0].subject || groups[0].query?.subject || "";

  // 3) 저장 (sidepanel.js 의 injectData / 미리보기가 읽는 키와 동일)
  //    savedStudents[i] 는 savedArray[i] 의 학생 정보(반·번호·이름). 예전 형식이면 null 로 지운다.
  chrome.storage.local.set({
    savedArray: rows, savedCategory: category, savedSubject: subject,
    savedStudents: students ? students.map(({ ban, no, name, g }) => (g === undefined ? { ban, no, name } : { ban, no, name, g })) : null,
    savedQuery: query,
    // 묶음별 조회조건 (savedStudents[i].g 가 묶음 번호). 묶음 형식이 아니면 null
    savedGroups: groups ? groups.map((g) => ({ query: g.query, subject: g.subject, count: g.students.length })) : null,
    // 개발용 시험 모드(저장하지 않음)는 새 데이터를 받으면 항상 끈다 (개발용 버튼이 받은 뒤 따로 켠다)
    savedDryRun: false,
  }, () => {
    // 4) 확장 아이콘에 건수 배지 표시
    chrome.action.setBadgeText({ text: rows.length ? String(rows.length) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#E66914" });
    sendResponse({ ok: true, count: rows.length, students: students ? students.length : null, query: !!query, groups: groups ? groups.length : null });
  });
  return true; // sendResponse 비동기 호출
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  // 발신 출처 검증 (manifest 외에 한 번 더 방어)
  if (!isAllowedSender(sender)) {
    sendResponse({ ok: false, error: "FORBIDDEN_ORIGIN" });
    return;
  }
  return acceptPayload(msg, sendResponse);
});

// [개발용] 사이드패널 '예시 데이터 받기' → issamGPT 에서 받은 것과 같은 길로 저장.
//  이 확장 프로그램의 자체 페이지(사이드패널)에서 온 것만 받는다 (웹 페이지 콘텐츠 스크립트는 없음).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "NEISSHOT_DEV_PAYLOAD") return false;
  if (sender.id !== chrome.runtime.id || sender.tab) {
    sendResponse({ ok: false, error: "FORBIDDEN_ORIGIN" });
    return false;
  }
  return acceptPayload(msg.payload, sendResponse);
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
