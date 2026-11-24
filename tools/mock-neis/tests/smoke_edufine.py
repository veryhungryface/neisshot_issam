import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 860})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8770/edufine/'); pg.wait_for_timeout(800)
    tree = lambda name: pg.locator('.grd_LF_Menu .GridCellControl', has_text=name).first
    tree('결재').click(); pg.wait_for_timeout(200)
    print('tree rows:', pg.locator('.grd_LF_Menu .GridCellControl').count())
    tree('결재대기').click(); pg.wait_for_timeout(1500)
    fr = pg.frame_locator('iframe[title="결재대기"]')
    print('jsp title:', fr.locator('#LblockPageTitle h3').inner_text(), '| rows:', fr.locator('.LblockListTable tbody tr').count())
    pg.screenshot(path=OUT + '/edu_wait.png')
    pg.locator('.top-menu', has_text='학교회계').click(); pg.wait_for_timeout(200)
    for n in ['사업관리', '사업담당', '품의/정산']:
        tree(n).click(); pg.wait_for_timeout(150)
    tree('품의등록').click(); pg.wait_for_timeout(1200)
    pg.screenshot(path=OUT + '/edu_cnsul.png')
    print('windows:', pg.locator('.ChildFrame:not(.popup)').count(), '| title:', pg.locator('[id$=".imgTitle.imagetext:text"]').last.inner_text())
    print('errors:', errs)
    b.close()
