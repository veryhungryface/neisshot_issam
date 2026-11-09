// Chrome DevTools Protocol 도우미 (Node 22 이상, 외부 패키지 없음)
// Chrome 을 --remote-debugging-port 로 띄워 두어야 한다 (README.md 참고).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PORT = Number(process.env.CDP_PORT || 9222);
const BASE = `http://127.0.0.1:${PORT}`;
export const EXT_NAME = '나이스입력도우미';
export const MOCK_NEIS_PREFIX = 'http://127.0.0.1:8770/neis/';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function targets() {
  try {
    return await (await fetch(`${BASE}/json/list`)).json();
  } catch {
    throw new Error(`Chrome 디버깅 포트(${PORT})에 연결할 수 없습니다. README 의 'Chrome 띄우기'를 먼저 하세요.`);
  }
}

// 대상 하나에 붙어 Runtime.evaluate 를 쓰는 연결
export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('CDP 연결 실패')); });
  const send = (method, params = {}) => new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expression, opts = {}) => {
    const d = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, ...opts });
    if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description || '스크립트 오류');
    return d.result?.result?.value;
  };
  // 페이지 함수 호출: fn 은 직렬화되어 페이지에서 실행되므로 바깥 변수를 쓰면 안 된다
  const call = (fn, ...args) => ev(`(${fn})(...${JSON.stringify(args)})`);
  return { ws, send, ev, call, close: () => ws.close() };
}

export async function browser() {
  const v = await (await fetch(`${BASE}/json/version`)).json();
  return connect(v.webSocketDebuggerUrl);
}

// 임시 탭을 열어 fn(conn) 을 실행하고 닫는다
export async function withTempTab(url, fn) {
  const br = await browser();
  const { result: { targetId } } = await br.send('Target.createTarget', { url });
  try {
    await sleep(1200);
    const t = (await targets()).find((x) => x.id === targetId);
    const c = await connect(t.webSocketDebuggerUrl);
    try { return await fn(c); } finally { c.close(); }
  } finally {
    await br.send('Target.closeTarget', { targetId });
    br.close();
  }
}

export const isNeisUrl = (u) => /^https:\/\/([^/]+\.)?neis\.go\.kr\//.test(u) || u.startsWith(MOCK_NEIS_PREFIX);
export const isRealNeisUrl = (u) => /^https:\/\/([^/]+\.)?neis\.go\.kr\//.test(u);

export async function neisTab() {
  const t = (await targets()).filter((x) => x.type === 'page' && isNeisUrl(x.url));
  if (!t.length) throw new Error('열린 나이스 탭이 없습니다. 이 Chrome 창에서 나이스에 로그인해 두세요.');
  return t[0];
}

// 압축해제로 불러온 개발용 확장 프로그램 찾기 (chrome://extensions 의 developerPrivate 사용)
export async function devExtension({ enable = true } = {}) {
  return withTempTab('chrome://extensions/', async (c) => {
    const list = await c.ev(`chrome.developerPrivate.getExtensionsInfo().then(a => a.map(e => ({ id: e.id, name: e.name, state: e.state, location: e.location, path: e.path || '' })))`);
    const ext = list.find((e) => e.name.includes(EXT_NAME) && e.location === 'UNPACKED');
    if (!ext) throw new Error(`압축해제로 불러온 '${EXT_NAME}' 확장 프로그램이 없습니다. chrome://extensions 에서 폴더를 불러오세요.`);
    if (enable && ext.state !== 'ENABLED') {
      await c.ev(`chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true })`);
      await c.ev(`chrome.management.setEnabled('${ext.id}', true)`);
      ext.state = 'ENABLED';
    }
    return ext;
  });
}

// 코드 수정을 반영: 확장 프로그램 새로 불러오기
export async function reloadExtension(id) {
  await withTempTab('chrome://extensions/', (c) => c.ev(`chrome.developerPrivate.reload('${id}', { failQuietly: false }).then(() => 'ok')`));
  await sleep(1500);
}

// 나이스 탭이 있는 창에 사이드패널 열기 (확장 페이지에서 사용자 동작으로 sidePanel.open 호출)
export async function openSidePanel(extId, neis) {
  const br = await browser();
  await br.send('Target.activateTarget', { targetId: neis.id });
  br.close();
  const res = await withTempTab(`chrome-extension://${extId}/sidepanel.html#loop-opener`, (c) =>
    c.ev(`chrome.windows.getCurrent().then(w => chrome.sidePanel.open({ windowId: w.id })).then(() => 'ok', e => String(e))`, { userGesture: true }));
  const br2 = await browser();
  await br2.send('Target.activateTarget', { targetId: neis.id });
  br2.close();
  if (res !== 'ok') throw new Error(`사이드패널을 열지 못했습니다: ${res}`);
  for (let i = 0; i < 20; i++) {
    const p = (await targets()).find((x) => x.url === `chrome-extension://${extId}/sidepanel.html`);
    if (p) return p;
    await sleep(300);
  }
  throw new Error('사이드패널 대상을 찾지 못했습니다');
}

export const downloadsDir = () => process.env.NEIS_DIAG_DIR || path.join(os.homedir(), 'Downloads');

// since 이후에 생긴 진단 파일 목록 (새 것부터)
export function diagFilesSince(since) {
  const dir = downloadsDir();
  try {
    return fs.readdirSync(dir)
      .filter((f) => /^neis-진단-.*\.json$/.test(f.normalize('NFC')))
      .map((f) => ({ file: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .filter((x) => x.mtime >= since - 1000)
      .sort((a, b) => b.mtime - a.mtime)
      .map((x) => x.file);
  } catch {
    return [];
  }
}
