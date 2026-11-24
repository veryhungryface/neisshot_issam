"""What does kev-ultrafast's snapshot (jev_ultrafast/snapshot.js) offer the policy on each mock screen?"""
import re, sys, json, urllib.request
from playwright.sync_api import sync_playwright
SNAP = open(sys.argv[1], encoding='utf-8').read()
B = 'http://127.0.0.1:8770'
def show(tag, s, wants):
    labels = [a['label'] for a in s['actions'] if a['kind'] in ('click', 'fill', 'select')]
    seen = {w: any(w in l for l in labels) for w in wants}
    print(f"{tag}: actions={len(labels)} covered={s.get('covered', 0)} | " + ', '.join(f"{w}:{'O' if v else 'X'}" for w, v in seen.items()))
urllib.request.urlopen(urllib.request.Request(B + '/__sandbox/reset', data=b'{}', method='POST'))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1400, 'height': 860})
    pg.goto(B + '/neis/'); pg.wait_for_timeout(800)
    show('나이스 첫 화면', pg.evaluate(SNAP), ['복무', '교과담임', '상신함', '메뉴 검색', '개인초과근무관리'])
    pg.locator('a.cl-sidenavigation-item', has_text='복무').first.click(); pg.wait_for_timeout(300)
    pg.locator('a.cl-sidenavigation-item', has_text='개인초과근무관리').first.click(); pg.locator('.cl-loadmask').wait_for(state='detached'); pg.wait_for_timeout(600)
    show('나이스 초과근무 화면', pg.evaluate(SNAP), ['신청(새 창 열기)', '근무종별', '1행 선택', '회수', '삭제'])
    pg.get_by_role('button', name='신청(새 창 열기)').click(); pg.wait_for_timeout(400)
    show('나이스 신청 대화상자', pg.evaluate(SNAP), ['초과근무일자', '신청시작시', '하여야 할 일', '행추가', '추가', '승인요청'])
    # 학생부 문구 입력 화면: mega → 화면 메뉴(왼쪽) → 2차인증 → 조회 → 글칸
    pg.goto(B + '/neis/'); pg.wait_for_timeout(800)
    pg.locator('li.cl-navigationbar-item', has_text='3-1담임').click(); pg.wait_for_timeout(600)
    show('나이스 3-1담임 메가메뉴', pg.evaluate(SNAP), ['행동특성및종합의견', '독서활동상황', '진로희망사항'])
    pg.locator('.cl-navigationbar-menu a[role=link]', has_text=re.compile(r'^행동특성및종합의견')).first.click(); pg.wait_for_timeout(400)
    show('나이스 화면 메뉴(왼쪽 펼침)', pg.evaluate(SNAP), ['행동특성및종합의견', '독서활동상황'])
    pg.locator('.rolemenu a.cl-leaf', has_text=re.compile(r'^행동특성및종합의견')).first.click(); pg.wait_for_timeout(1200)
    show('나이스 2차인증', pg.evaluate(SNAP), ['인증번호', '인증', '취소'])
    d = pg.locator('[role=dialog][aria-label="2차인증"]'); d.locator('input').fill('000000'); d.get_by_role('button', name='인증', exact=True).click(); pg.wait_for_timeout(800)
    show('나이스 행특(조회 전)', pg.evaluate(SNAP), ['학년도', '학년', '반', '조회', '학생부자료기록', '누가기록', '입력창확대'])
    pnl = pg.locator('[role=tabpanel]:visible')
    for k, v in (('학년', '3'), ('반', '1')):
        pnl.locator(f'[role=combobox][aria-label^="{k},"]').click(); pg.locator('[role=listbox] [role=option]', has_text=re.compile(f'^{v}$')).click()
    pnl.get_by_role('button', name='조회', exact=True).click(); pg.wait_for_timeout(1200)
    s = pg.evaluate(SNAP)
    show('나이스 행특(조회 후)', s, ['1행 행동특성및종합의견', '3행 행동특성및종합의견', '3행 선택', '저장', '일괄적용'])
    print('   글칸 후보:', [a['label'] for a in s['actions'] if '행동특성및종합의견' in a['label']][:6])
    pg.goto(B + '/edufine/'); pg.wait_for_timeout(800)
    show('에듀파인 첫 화면', pg.evaluate(SNAP), ['문서관리', '학교회계', '결재', '기안'])
    pg.locator('.grd_LF_Menu .treeitemtext', has_text=re.compile('^결재$')).click(); pg.wait_for_timeout(300)
    pg.locator('.grd_LF_Menu .treeitemtext', has_text=re.compile('^결재대기$')).click(); pg.wait_for_timeout(3000)
    show('에듀파인 결재대기(JSP iframe)', pg.evaluate(SNAP), ['결재대기', '체육대회 물품 구입 요청', '조회', '일괄결재'])
    b.close()
