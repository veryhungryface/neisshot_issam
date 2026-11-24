import sys, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 860})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8770/neis/'); pg.wait_for_timeout(800)
    pg.locator('a.cl-sidenavigation-item', has_text='복무').first.click(); pg.wait_for_timeout(300)
    pg.locator('[data-itemid] >> text=개인초과근무관리').first.click(); pg.wait_for_timeout(1800)
    pg.screenshot(path=OUT + '/neis_overtime.png')
    print('tabs:', pg.locator('[role=tab]').all_inner_texts())
    print('selected:', pg.locator('[role=tab][aria-label^="선택됨"]').get_attribute('aria-label'))
    print('grid rows:', pg.locator('[role=grid][aria-label="초과근무목록"]').get_attribute('aria-rowcount'))
    print('cells:', pg.locator('[role=gridcell][aria-label^="1행 신청 상태"]').get_attribute('aria-label'))
    # role mega menu
    pg.locator('li[data-itemid="002002"]').click(); pg.wait_for_timeout(700)
    pg.locator('.mega-l2 a', has_text='출결관리').first.click(); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT + '/neis_mega.png')
    pg.locator('.mega-l3 a', has_text='과목별출결관리').click(); pg.wait_for_timeout(1800)
    pg.screenshot(path=OUT + '/neis_attendance.png')
    print('attendance tab:', pg.locator('[role=tab][aria-label^="선택됨"]').get_attribute('aria-label'))
    print('errors:', errs)
    b.close()
