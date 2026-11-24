"""Record the mock sites with the real site-recorder extension (v0.2.1), writing a session folder exactly like
the one captured on the real NEIS / K-에듀파인. The same extractors then read both.

    xvfb-run python3 tests/record_with_extension.py <extension dir> <out dir>
"""
import base64, json, os, re, shutil, sys, time
from playwright.sync_api import sync_playwright

EXT, OUT = sys.argv[1], sys.argv[2]
B = 'http://127.0.0.1:8770'
UD = '/tmp/sandbox-rec-profile'
shutil.rmtree(UD, ignore_errors=True)
shutil.rmtree(OUT, ignore_errors=True)
HOOK = """(() => { if (self.__dl) return 'ok'; self.__dl = []; const o = chrome.downloads.download.bind(chrome.downloads);
  chrome.downloads.download = (x) => { self.__dl.push({ filename: x.filename, url: x.url }); return o(x); }; return 'hooked'; })()"""

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(UD, headless=False, executable_path='/opt/pw-browsers/chromium',
        args=[f'--disable-extensions-except={EXT}', f'--load-extension={EXT}'], viewport={'width': 1400, 'height': 860})
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
    sw.evaluate(HOOK)
    sw.evaluate("chrome.storage.local.set({settings:{recording:true,domains:'',mask:true,screenshots:true,html:true}})")
    pg = ctx.pages[0]
    # NEIS: 2 screens through the left menu, 1 through the role mega menu
    pg.goto(B + '/neis/'); pg.wait_for_timeout(2500)
    pg.locator('a.cl-sidenavigation-item', has_text='복무').first.click(); pg.wait_for_timeout(2500)
    pg.locator('a.cl-sidenavigation-item', has_text='개인초과근무관리').first.click(); pg.wait_for_timeout(4000)
    pg.locator('a.cl-sidenavigation-item', has_text='개인근무상황관리').first.click(); pg.wait_for_timeout(4000)
    pg.locator('li.cl-navigationbar-item', has_text='교과담임').click(); pg.wait_for_timeout(2500)
    pg.locator('.cl-navigationbar-menu a[role=link]', has_text=re.compile('^출결관리')).first.click(); pg.wait_for_timeout(2500)
    pg.locator('.cl-navigationbar-menu a[role=link]', has_text=re.compile('^과목별출결관리')).first.click(); pg.wait_for_timeout(4000)
    # K-에듀파인: a JSP screen (iframe) and a Nexacro screen
    pg.goto(B + '/edufine/'); pg.wait_for_timeout(2500)
    tree = lambda n: pg.locator('.grd_LF_Menu .treeitemtext', has_text=re.compile('^' + re.escape(n) + '$')).first
    tree('결재').click(); pg.wait_for_timeout(2500)
    tree('결재대기').click(); pg.wait_for_timeout(5000)
    pg.locator('.top-menu', has_text='학교회계').click(); pg.wait_for_timeout(2500)
    for n in ('사업관리', '사업담당', '품의/정산'):
        tree(n).click(); pg.wait_for_timeout(2000)
    tree('품의등록').click(); pg.wait_for_timeout(4500)
    sw = ctx.service_workers[0]
    sw.evaluate('exportSession()'); time.sleep(2)
    dls = sw.evaluate('self.__dl')
    for d in dls:
        rel = d['filename'].split('/', 2)[-1]
        path = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'wb').write(base64.b64decode(d['url'].split(',', 1)[1]))
    caps = sw.evaluate("chrome.storage.local.get('captures')")['captures']
    for c in caps:
        print(c['n'], c['trigger'], repr(c['screen']), '|', c['clicked'][:40], '| frames', c['frames'], c['files'])
    ctx.close()
print('written to', OUT)
