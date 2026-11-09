// 개발용 버튼을 한 번 실행하고 목표 달성 여부를 판정한다 (루프의 한 바퀴)
//   node tools/neis-dev-loop/run.mjs            코드 수정 반영(확장 새로 불러오기) 후 실행
//   node tools/neis-dev-loop/run.mjs --no-reload 확장을 새로 불러오지 않고 실행
//   node tools/neis-dev-loop/run.mjs --discard   임시 문구 버리기(다시 조회)만
//
// 출력에는 학생 이름·학생부 문구가 나오지 않는다 (숫자와 행 번호만). 화면 구조는 진단 파일(가린 것)로 본다.
// 저장·삭제 버튼은 절대 누르지 않는다. 페이지를 새로고침하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  sleep, connect, neisTab, devExtension, reloadExtension, openSidePanel,
  diagFilesSince, isRealNeisUrl,
} from './cdp.mjs';

const args = new Set(process.argv.slice(2));
const startedAt = Date.now();
const log = (...a) => console.error(`[${new Date().toTimeString().slice(0, 8)}]`, ...a);
// 상태줄의 "창 내용:" 줄은 나이스 알림 원문이라 학생 이름이 있을 수 있어 출력하지 않는다
const safeStatus = (s) => (s || '').split('\n').filter((l) => !l.startsWith('창 내용:')).join(' / ');

// ── 페이지 함수 (나이스 탭에서 실행) ──────────────────────────
// 2차인증 창이 떠 있는지
function otpVisible() {
  return [...document.querySelectorAll('[role=dialog]')]
    .some((d) => d.getClientRects().length && /인증/.test(d.getAttribute('aria-label') || ''));
}

// 임시 문구가 남아 있으면 [조회]를 다시 눌러 버린다. 저장 여부를 묻는 창에는 '아니오'만 누른다.
async function discardTemp() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (e) => e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  const panel = [...document.querySelectorAll('[role=tabpanel]')].find(visible);
  if (!panel) return { done: true, note: '열린 화면 없음' };
  const temps = () => [...panel.querySelectorAll('textarea')].filter((t) => t.value.startsWith('[임시 ')).length;
  if (!temps()) return { done: true, note: '임시 문구 없음' };
  const q = [...panel.querySelectorAll('[role=button], button')].find((b) => visible(b) && text(b) === '조회');
  if (!q) return { done: false, note: '조회 버튼을 찾지 못함' };
  q.click();
  for (let i = 0; i < 100; i++) {
    await wait(100);
    const d = [...document.querySelectorAll('[role=dialog]')].find((x) => visible(x) && !/인증/.test(x.getAttribute('aria-label') || ''));
    if (d) {
      const no = [...d.querySelectorAll('[role=button], button')].find((b) => visible(b) && text(b) === '아니오');
      if (/저장/.test(text(d)) && no) { no.click(); await wait(300); continue; }
      return { done: false, note: `사람 확인 필요: 처리 방법을 모르는 창 (창 이름: ${d.getAttribute('aria-label') || '없음'})` };
    }
    if (!temps() && ![...document.querySelectorAll('.cl-loadmask')].some(visible)) return { done: true, note: '다시 조회로 임시 문구 버림' };
  }
  return { done: false, note: `다시 조회 후에도 임시 문구 ${temps()}칸 남음` };
}

// 화면의 학생 이름 목록 (진단 파일 가리기 점검용, 이 스크립트 밖으로 출력하지 않는다)
function studentNames() {
  const out = new Set();
  document.querySelectorAll('[role=gridcell]').forEach((c) => {
    const m = /^\d+행 (?:마지막 행 )?성명 (.+)$/.exec(c.getAttribute('aria-label') || '');
    if (m) out.add(m[1].trim());
  });
  document.querySelectorAll('[data-key="성명"]').forEach((c) => out.add((c.textContent || '').trim()));
  return [...out].filter((n) => n.length >= 2);
}

// 입력 결과 검증 (숫자만 돌려준다)
function verifyGrid() {
  const visible = (e) => e && e.getClientRects().length > 0;
  const text = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
  const panel = [...document.querySelectorAll('[role=tabpanel]')].find(visible);
  if (!panel) return { error: '열린 화면 없음' };
  const grid = panel.querySelector('[role=grid]') || panel;
  const rows = [...grid.querySelectorAll('[role=row][aria-rowindex]')]
    .filter((r) => r.querySelector('[role=gridcell]') && !r.querySelector('[role=columnheader]'));
  const editorOf = (r) => [...r.querySelectorAll('textarea')].find((t) => !t.disabled && !t.readOnly);
  const nameOf = (r) => {
    const c = [...r.querySelectorAll('[role=gridcell]')].find((x) => /^\d+행 (마지막 행 )?성명 /.test(x.getAttribute('aria-label') || ''));
    return c ? c.getAttribute('aria-label').replace(/^\d+행 (마지막 행 )?성명 /, '').trim() : '';
  };
  // 글자수/바이트 열: 머리글 이름으로 찾고, 같은 열 번호(data-cellindex → aria-colindex)의 칸을 읽는다
  const headers = [...grid.querySelectorAll('[role=columnheader]')];
  const counterHead = headers.find((h) => /글자|바이트/.test(h.getAttribute('aria-label') || text(h)));
  const colKey = (c) => c?.getAttribute('data-cellindex') ?? c?.getAttribute('aria-colindex');
  const counterOf = (r) => {
    if (!counterHead) return null;
    const k = colKey(counterHead);
    const cell = [...r.querySelectorAll('[role=gridcell]')].find((c) => colKey(c) === k);
    return cell ? text(cell) : null;
  };
  const start = rows.findIndex(editorOf);
  const work = start < 0 ? [] : rows.slice(start);
  let editable = 0, matched = 0, counterChanged = 0;
  const mismatchRows = [], notCommittedRows = [];
  work.forEach((r, i) => {
    const ed = editorOf(r);
    if (!ed) return;
    editable++;
    const no = Number(r.getAttribute('aria-rowindex')) - 1;
    if (ed.value.startsWith(`[임시 ${i + 1}] ${nameOf(r)} `)) matched++; else mismatchRows.push(no);
    const cnt = counterOf(r);
    if (cnt !== null && cnt && !/^0(\D|$)/.test(cnt)) counterChanged++; else notCommittedRows.push(no);
  });
  return {
    화면: text(panel.querySelector('h1')),
    조회조건: [...panel.querySelectorAll('[role=combobox]')].filter((b) => !b.closest('[role=row][aria-rowindex]'))
      .map((b) => b.getAttribute('aria-label')),
    학생행: rows.length,
    입력가능행: editable,
    이름일치: matched,
    어긋난행: mismatchRows.slice(0, 30),
    글자수열: counterHead ? (counterHead.getAttribute('aria-label') || text(counterHead)) : null,
    글자수바뀜: counterChanged,
    글자수안바뀐행: notCommittedRows.slice(0, 30),
    글자수예시: work.slice(0, 3).map(counterOf),
  };
}

// ── 실행 ────────────────────────────────────────────────────
const result = { 시각: new Date().toISOString(), 목표달성: false, 사유: [] };
let neisConn, panelConn;

// 코드 점검: 문법 오류가 있으면 확장 프로그램이 조용히 안 돌기 때문에 나이스에 손대기 전에 확인한다
function preflight() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const errs = [];
  try { JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); } catch (e) { errs.push(`manifest.json: ${e.message}`); }
  for (const f of ['background.js', 'sidepanel.js', 'dev-tools.js']) {
    try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); } catch (e) {
      errs.push(`${f}: ${String(e.stderr || e.message).split('\n').filter(Boolean).slice(0, 4).join(' | ')}`);
    }
  }
  return errs;
}

// 진단 파일에 학생 이름이 남았는지 점검. 남았으면 파일 이름을 바꿔 격리하고 목록에서 뺀다 (Claude 가 읽지 않도록)
function guardDiagFiles(files, names) {
  const safe = [];
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const leaked = names.filter((n) => raw.includes(n)).length + (raw.includes('[임시 ') ? 1 : 0);
    if (!leaked) { safe.push(f); continue; }
    const q = `${f}.가리기실패-사람확인`;
    fs.renameSync(f, q);
    result.사유.push(`사람 확인 필요: 진단 파일에 학생 이름·문구 ${leaked}건이 가려지지 않아 격리함 (${path.basename(q)}). 이 파일은 Claude 에게 보여주지 말고, collectNeisDiag 가리기 규칙부터 고칠 것`);
  }
  return safe;
}

try {
  const bad = preflight();
  if (bad.length) { result.사유.push(...bad.map((b) => `코드 문법 오류 → ${b}`)); throw null; }

  const neis = await neisTab();
  result.정식나이스 = isRealNeisUrl(neis.url);
  neisConn = await connect(neis.webSocketDebuggerUrl);

  if (args.has('--discard')) {
    result.버리기 = await neisConn.call(discardTemp);
    result.목표달성 = !!result.버리기.done;
    throw null;
  }

  const ext = await devExtension();
  if (!args.has('--no-reload')) { log('확장 프로그램 새로 불러오기 (코드 수정 반영)'); await reloadExtension(ext.id); }

  // 이전 바퀴의 임시 문구가 남아 있으면 먼저 버린다 (버튼이 다시 조회할 때 저장 확인 창이 뜨지 않도록)
  const pre = await neisConn.call(discardTemp);
  log('시작 전 정리:', pre.note);
  if (!pre.done) { result.사유.push(`시작 전 정리 실패: ${pre.note}`); throw null; }

  const panel = await openSidePanel(ext.id, neis);
  panelConn = await connect(panel.webSocketDebuggerUrl);
  await sleep(800);
  const hasBtn = await panelConn.ev(`!!document.getElementById('btnDevQuickQuery') && !document.getElementById('devTools').hidden`);
  if (!hasBtn) { result.사유.push('사이드패널에 개발용 버튼이 없음 (압축해제 설치인지, dev-tools.js 가 실행 중 오류로 멈췄는지 확인)'); throw null; }

  log('개발용 버튼 클릭');
  await panelConn.ev(`document.getElementById('btnDevQuickQuery').click()`);
  let status = '', prev = '', otpTold = false, reacted = false;
  const clickedAt = Date.now();
  const deadline = clickedAt + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(500);
    status = await panelConn.ev(`document.getElementById('devQuickQueryStatus').textContent`);
    if (status !== prev) { log('상태줄:', safeStatus(status)); prev = status; }
    if (!otpTold && await neisConn.call(otpVisible)) { otpTold = true; log('👤 2차인증 창이 떴습니다. 사람이 직접 인증해 주세요 (최대 3분).'); }
    const busy = await panelConn.ev(`document.getElementById('btnDevQuickQuery').disabled`);
    if (busy || status) reacted = true;
    // 15초 동안 아무 반응이 없으면 클릭 처리기가 붙지 않은 것 (스크립트 실행 오류 등)
    if (!reacted && Date.now() - clickedAt > 15000) { status = ''; result.사유.push('버튼을 눌러도 반응이 없음 (dev-tools.js 실행 오류 의심, 사이드패널 콘솔 확인)'); break; }
    if (!busy && /^(완료|실패)/.test(status)) break;
  }
  result.상태줄 = safeStatus(status);
  result.완료팝업 = await panelConn.ev(`document.getElementById('nsModalOverlay')?.classList.contains('open') ? document.getElementById('nsModalMsg').textContent : ''`);
  await panelConn.ev(`document.getElementById('nsModalOk')?.click()`);
  result.진단파일 = diagFilesSince(startedAt);

  if (!status.startsWith('완료')) {
    if (status) result.사유.push(`버튼 실패: ${safeStatus(status)}`);
    else if (reacted) result.사유.push('6분 안에 끝나지 않음 (어느 단계에서 멈췄는지는 진단 파일 참고)');
  } else {
    const v = await neisConn.call(verifyGrid);
    result.검증 = v;
    if (v.error) result.사유.push(v.error);
    else {
      if (!v.입력가능행) result.사유.push('입력 가능한 학생 행이 없음');
      if (v.이름일치 !== v.입력가능행) result.사유.push(`이름 불일치: ${v.입력가능행 - v.이름일치}행 (행 번호 ${v.어긋난행.join(', ')})`);
      if (!v.글자수열) result.사유.push('글자수/바이트 열을 찾지 못함 (반영 여부 확인 불가)');
      else if (v.글자수바뀜 !== v.입력가능행) result.사유.push(`글자수 칸이 안 바뀐 행 ${v.입력가능행 - v.글자수바뀜}개 (나이스 내부 미반영 의심, 행 번호 ${v.글자수안바뀐행.join(', ')})`);
    }
    if (/진단 파일 저장/.test(status)) result.사유.push('버튼이 입력 부족으로 진단 파일을 저장함');
    result.목표달성 = result.사유.length === 0;
  }

  // 진단 파일이 없으면 지금 화면을 저장한다: 성공했을 때의 구조, 그리고 버튼이 멈췄거나 검증만 실패한 경우
  if (!result.진단파일.length && !args.has('--no-diag')) {
    await panelConn.ev(`document.getElementById('btnDevSaveDiag')?.click()`);
    await sleep(2000);
    result.진단파일 = diagFilesSince(startedAt);
    if (!result.진단파일.length) result.사유.push('진단 파일도 저장하지 못함 (사이드패널 오류 의심)');
  }

  // 진단 파일 가리기 점검 (화면에 학생 명단이 있을 때만 가능)
  const names = await neisConn.call(studentNames).catch(() => []);
  if (names.length) result.진단파일 = guardDiagFiles(result.진단파일, names);
  else if (result.진단파일.length) result.가리기점검 = '화면에 학생 명단이 없어 이름 대조는 생략';

  // 실제 학생부에 임시 문구를 남기지 않도록 마지막에 버린다 (--keep 이면 사람이 눈으로 확인하도록 남김)
  if (!args.has('--keep')) {
    result.버리기 = await neisConn.call(discardTemp);
    if (!result.버리기.done) result.사유.push(`임시 문구 버리기 실패 → 사람이 저장하지 말고 직접 다시 조회: ${result.버리기.note}`);
  }
} catch (e) {
  if (e) result.사유.push(`스크립트 오류: ${e.message}`);
} finally {
  neisConn?.close();
  panelConn?.close();
}

if (result.목표달성 && result.사유.length) result.목표달성 = false;
console.log(JSON.stringify(result, null, 2));
process.exit(result.목표달성 ? 0 : 1);
