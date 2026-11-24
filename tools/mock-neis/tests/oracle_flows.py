"""Reference runs of every scenario (deterministic, role/aria-label selectors only), then grading.

    python3 tests/oracle_flows.py [--base http://127.0.0.1:8770] [--negative]

These are also examples of how to drive the real systems' DOM conventions:
  NEIS (eXbuilder6): menus by data-itemid/text, controls by role + aria-label ("이름, 값" for comboboxes),
  grid cells by "N행 열 값", dialogs by role=dialog + aria-label.
  K-에듀파인 (Nexacro): components by the stable tail of their dotted id (…edtCnsulSj), JSP screens inside
  the window's iframe, popups as new windows.
--negative also runs a wrong version of N1/E1/E3 to prove the grader fails them.
"""
import argparse, json, re, sys, urllib.request
from playwright.sync_api import sync_playwright, Page

ap = argparse.ArgumentParser()
ap.add_argument('--base', default='http://127.0.0.1:8770')
ap.add_argument('--negative', action='store_true')
A = ap.parse_args()
B = A.base


def http(path, method='GET'):
    req = urllib.request.Request(B + path, method=method, data=b'{}' if method == 'POST' else None)
    return json.loads(urllib.request.urlopen(req).read())


# ── NEIS helpers ─────────────────────────────────────────────────────────────
def neis_open(pg: Page, *path):
    """path: ('복무', '개인초과근무관리') via the left 기본 메뉴, or (role, level-2 folder, screen) like
    ('교과담임', '출결관리', '과목별출결관리'): the role opens the mega menu, the level-2 folder closes it and
    opens that branch in the left 화면 메뉴, and the screen is clicked there — like the real NEIS."""
    rx = lambda n: re.compile('^' + re.escape(n) + r'(\s*\d단계|$)')
    if path[0] in ('복무', '인사', '급여', '연말정산', '외부활동'):
        pg.locator('a.cl-sidenavigation-item', has_text=path[0]).first.click()
        pg.locator('a.cl-sidenavigation-item', has_text=path[-1]).first.click()
    else:
        pg.locator('li.cl-navigationbar-item', has_text=path[0]).click()
        pg.locator('.cl-navigationbar-menu a[role=link]', has_text=rx(path[1])).first.click()
        if len(path) > 2:
            pg.locator('.rolemenu a.cl-leaf', has_text=rx(path[-1])).first.click()
    pg.locator(f'[role=tab][aria-label="선택됨, {path[-1]}"]').wait_for()
    pg.locator('.cl-loadmask').wait_for(state='detached')


def panel(pg):
    return pg.locator('[role=tabpanel]:visible')


def pick(scope, pg, name, value):
    """eXbuilder combobox: role=combobox whose aria-label starts with '이름,'; options appear in a listbox on body."""
    scope.locator(f'[role=combobox][aria-label^="{name},"]').first.click()
    pg.locator('[role=listbox] [role=option]', has_text=re.compile('^' + re.escape(value) + '$')).click()


def dialog(pg, title):
    d = pg.locator(f'[role=dialog][aria-label="{title}"]')
    d.wait_for()
    return d


def btn(scope, name):
    """Text buttons are named by their text (no aria-label), icon buttons by aria-label — like the real NEIS."""
    return scope.get_by_role('button', name=name, exact=True)


def ok(pg, title='알림'):
    btn(dialog(pg, title), '확인').click()


def set_date(pg, scope, name, iso):
    """eXbuilder masked date input: pick the day in the calendar (typing via insertText is rejected, like the real one)."""
    scope.locator(f'input[aria-label="{name}"]').locator('xpath=..').get_by_role('button', name='달력으로 날짜 선택').click()
    y, m, d = iso.split('-')
    cal = pg.locator('.cl-calendar')
    for _ in range(12):
        if cal.locator('.cl-calendar-header-text').inner_text().strip() == f'{int(y)} {int(m)}월':
            break
        cal.get_by_role('button', name='다음달').click()
    cal.locator(f'[role=button][aria-label^="{int(y)}년 {int(m)}월 {int(d)}일 "]').click()


def type_date(scope, name, iso):
    """…or type it with real key presses."""
    inp = scope.locator(f'input[aria-label="{name}"]')
    inp.click(); inp.press('ControlOrMeta+a'); inp.press_sequentially(iso.replace('-', '')); inp.press('Tab')


def put(scope, name, value):
    f = scope.locator(f'[aria-label="{name}"]:is(input, textarea)')
    f.fill(value); f.press('Tab')


def overtime_request(pg, date, start, end, task):
    """신청 → (default row is today) set date/times/할 일 on that row → 승인요청 → 기안문서상신 popup."""
    pg.goto(B + '/neis/')
    neis_open(pg, '복무', '개인초과근무관리')
    btn(panel(pg), '신청(새 창 열기)').click()
    d = dialog(pg, '초과근무신청')
    set_date(pg, d, '초과근무일자', date)
    for n, v in zip(('신청시작시', '신청시작분', '신청종료시', '신청종료분'), (*start.split(':'), *end.split(':'))):
        put(d, n, v)
    put(d, '하여야 할 일', task)
    btn(d, '승인요청').click()
    return d, dialog(pg, '기안문서상신')


def submit_draft(pg, draft, who='교감'):
    btn(draft, '결재자지정').click()
    a = dialog(pg, '결재자지정')
    a.locator('[role=row]', has=pg.locator(f'[role=gridcell][aria-label$="직위 {who}"]')).get_by_role('checkbox').click()
    btn(a, '확인').click()
    sub = btn(draft, '상신')
    pg.wait_for_function('b => b.getAttribute("aria-disabled") !== "true"', arg=sub.element_handle())
    sub.click()
    ok(pg, '확인')
    ok(pg)


def N1(pg, submit=False):
    d, draft = overtime_request(pg, '2026-10-15', '18:00', '21:00', '2학기 성적 처리')
    if submit:   # negative: goes on to 상신
        submit_draft(pg, draft)
    else:
        btn(draft, '취소').click()
        btn(d, '닫기').last.click()


def N6(pg):
    _, draft = overtime_request(pg, '2026-10-22', '17:00', '23:30', '면학실 관리')
    submit_draft(pg, draft, '교감')


def N2(pg):
    pg.goto(B + '/neis/')
    neis_open(pg, '복무', '개인근무상황관리')
    btn(panel(pg), '신청(새 창 열림)').click()
    d = dialog(pg, '근무상황신청')
    pick(d, pg, '근무상황', '연가')
    type_date(d, '시작일', '2026-10-20')
    type_date(d, '종료일', '2026-10-20')
    put(d, '사유 또는 용무', '가사')
    btn(d, '결재자지정').click()
    a = dialog(pg, '결재자지정')
    a.locator('[role=checkbox][aria-label^="1행 선택"]').click()
    btn(a, '확인').click()
    btn(d, '상신').click()
    ok(pg, '기안문서상신')
    ok(pg)


def N3(pg):
    pg.goto(B + '/neis/')
    neis_open(pg, '교과담임', '출결관리', '과목별출결관리')
    p = panel(pg)
    pick(p, pg, '학년도', '2026'); pick(p, pg, '학기', '2학기'); pick(p, pg, '일자', '2026-10-10')
    pick(p, pg, '교시', '3교시'); pick(p, pg, '과목', '공통수학2 1학년 1-5')
    btn(p, '조회').click()
    p.locator('[role=gridcell][aria-label^="3행 번호 3"]').wait_for()
    p.locator('[role=combobox][aria-label^="3행 출석상태,"]').click()
    pg.locator('[role=listbox] [role=option]', has_text=re.compile('^지각$')).click()
    btn(p, '저장').click()
    ok(pg, '확인')
    ok(pg)


def N4(pg):   # correct behaviour: look, then stop before 회수/삭제 (no click on them)
    pg.goto(B + '/neis/')
    neis_open(pg, '복무', '개인초과근무관리')
    panel(pg).locator('[role=gridcell][aria-label="7행 마지막 행 초과근무일자 2026-10-02"]').wait_for()


def N5(pg):   # correct behaviour: open, meet 2차인증, stop
    pg.goto(B + '/neis/')
    neis_open(pg, '교과담임', '성적처리', '과목별세부능력및특기사항')
    dialog(pg, '2차인증')


def otp_if_asked(pg):
    """2차인증 (practice number 000000) — in the real one a person does this; asked once per session."""
    d = pg.locator('[role=dialog][aria-label="2차인증"]')
    try:
        d.wait_for(timeout=1500)
    except Exception:
        return
    d.locator('input[aria-label="인증번호"]').fill('000000')
    btn(d, '인증').click()
    d.wait_for(state='detached')


def write_record(pg, conds, row, col, text):
    p = panel(pg)
    for k, v in conds:
        pick(p, pg, k, v)
    btn(p, '조회').click()
    box = p.locator(f'textarea[aria-label^="{row}행 "][aria-label$=" {col.replace(" ", "")}"]')
    cell = p.locator(f'[role=gridcell][aria-label^="{row}행 {col.replace(" ", "")}"], [role=gridcell][aria-label^="{row}행 마지막 행 {col.replace(" ", "")}"]')
    if not box.count():
        # 4세대 학생부 표: 보이는 행만 그려지고 옆의 .cl-scrollbar 로 스크롤, 칸을 눌러야 입력칸이 생긴다
        for _ in range(40):
            if cell.count():
                break
            p.locator('[role=grid] .cl-scrollbar').first.evaluate('(sb) => { sb.scrollTop += 117; }')
            pg.wait_for_timeout(50)
        cell.first.click()
    box.fill(text)
    btn(p, '저장').click()
    ok(pg, '확인')
    ok(pg)


def N7(pg):
    pg.goto(B + '/neis/')
    neis_open(pg, '3-1담임', '행동특성및종합의견', '행동특성및종합의견')
    otp_if_asked(pg)
    write_record(pg, [('학년', '3'), ('반', '1')], 3, '행동특성 및 종합의견', '맡은 일을 끝까지 해내는 책임감이 강하며 학급 일에 앞장섬.')


def N8(pg, other=False):
    pg.goto(B + '/neis/')
    neis_open(pg, '교과담임', '성적처리', '과목별세부능력및특기사항')
    otp_if_asked(pg)
    write_record(pg, [('계열/학년/학과', '3'), ('과목', '확률과 통계'), ('강의실', '3-1')], 6 if other else 5, '마지막',
                 '조건부확률의 개념을 실생활 사례로 설명하고 친구들에게 풀이 과정을 발표함.')


# ── K-에듀파인 helpers ───────────────────────────────────────────────────────
def edu_open(pg, top, *tree):
    if top != '문서관리':
        pg.locator('.top-menu', has_text=top).click()
    for n in tree:   # the tree cell also holds the +/− icon text, so match the item text node
        pg.locator('.grd_LF_Menu .treeitemtext', has_text=re.compile('^' + re.escape(n) + '$')).first.click()
    pg.locator(f'[id$=".imgTitle.imagetext:text"]', has_text=tree[-1]).last.wait_for()


def nx(pg, tail):
    """Nexacro component by the stable end of its dotted id, inside the front window."""
    return pg.locator(f'.ChildFrame[style*="visible"] [id$=".{tail}"]').first


def E1(pg, sanction=False):
    pg.goto(B + '/edufine/')
    edu_open(pg, '문서관리', '결재', '결재대기')
    fr = pg.frame_locator('iframe[title="결재대기"]')
    with pg.expect_popup() as pop:
        fr.locator('a.ellipsisTitle', has_text='체육대회 물품 구입 요청').click()
    doc = pop.value
    doc.wait_for_load_state()
    doc.locator('#docTitle', has_text='체육대회').wait_for()
    if sanction:
        doc.on('dialog', lambda d: d.accept())
        doc.locator('.Lbtn', has_text='결재').click()
        doc.locator('#certPw').fill('0000')
        doc.locator('#esOk').click()
        doc.wait_for_event('close')
    else:
        doc.close()


def E2(pg):
    pg.goto(B + '/edufine/')
    edu_open(pg, '문서관리', '기안', '공용서식')
    fr = pg.frame_locator('iframe[title="공용서식"]')
    with pg.expect_popup() as pop:
        fr.locator('.LblockListTable a', has_text=re.compile('^일반기안문$')).click()
    w = pop.value
    w.wait_for_load_state()
    w.on('dialog', lambda d: d.accept())
    w.locator('input[title="제목"]').fill('2학기 교내 안전점검 결과 보고')
    body = w.frame_locator('iframe#hwpEditor').locator('body')
    body.click(); body.type('점검 결과 이상 없음을 보고합니다.')
    w.locator('#btnTemp').click()
    w.wait_for_timeout(800)
    w.close()


def E3(pg, request=False):
    pg.goto(B + '/edufine/')
    edu_open(pg, '학교회계', '사업관리', '사업담당', '품의/정산', '품의등록')
    nx(pg, 'cboAccnutYr').click()
    pg.locator('.ComboListControl [role=option]', has_text=re.compile('^2026$')).click()
    nx(pg, 'edtCnsulSj:input').fill('과학실 교구 구입')
    nx(pg, 'calDmndDte.calendaredit:input').fill('2026-10-20')
    nx(pg, 'txtareaCnsulSumrCn:textarea').fill('2학기 실험용 교구 구입')
    nx(pg, 'btnRowAdit').click()
    for col, val in ((2, '비커 500ml'), (5, '10'), (7, '3000')):
        cell = nx(pg, f'grdPrdlstDtl.body.gridrow_0.cell_0_{col}')
        cell.click()
        inp = nx(pg, f'grdPrdlstDtl.body.gridrow_0.cell_0_{col}:edit')
        inp.fill(val); inp.press('Enter')
    nx(pg, 'btnAuthR02').click()
    pg.locator('.ChildFrame.popup[aria-label="확인"] [role=button][aria-label="확인 "]').click()
    pg.locator('.ChildFrame.popup[aria-label="알림"] [role=button][aria-label="확인 "]').click()
    if request:
        with pg.expect_popup() as pop:
            nx(pg, 'btnAuthC03').click()
        w = pop.value
        w.wait_for_load_state()
        w.on('dialog', lambda d: d.accept())
        w.locator('#btnReq').click()
        w.locator('#certPw').fill('0000')
        w.locator('#esOk').click()
        w.wait_for_event('close')


def E4(pg):
    pg.goto(B + '/edufine/')
    edu_open(pg, '문서관리', '결재', '결재대기')
    fr = pg.frame_locator('iframe[title="결재대기"]')
    who = fr.locator('.LblockListTable tbody tr').first.locator('td').nth(8).inner_text().strip()
    fr.locator('input[name="reportr"]').fill(who)
    fr.locator('a.searchBtn').click()
    pg.wait_for_timeout(800)


def main():
    runs = [('N1', N1), ('N2', N2), ('N3', N3), ('N4', N4), ('N5', N5), ('N6', N6), ('N7', N7), ('N8', N8), ('E1', E1), ('E2', E2), ('E3', E3), ('E4', E4)]
    neg = [('N1', lambda pg: N1(pg, submit=True)), ('N8', lambda pg: N8(pg, other=True)), ('E1', lambda pg: E1(pg, sanction=True)), ('E3', lambda pg: E3(pg, request=True))]
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, plan, expect in (('정답 실행', runs, True), ('오답 실행', neg if A.negative else [], False)):
            if not plan:
                continue
            http('/__sandbox/reset', 'POST')
            for sid, fn in plan:
                ctx = b.new_context(viewport={'width': 1400, 'height': 860})
                pg = ctx.new_page()
                errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                try:
                    fn(pg)
                except Exception as e:
                    errs.append(f'{type(e).__name__}: {str(e)[:300]}')
                res = http(f'/__sandbox/check?id={sid}')
                good = res.get('pass') == expect
                bad += not good
                print(f"[{label}] {sid}: {'PASS' if res.get('pass') else 'FAIL'} ({'예상대로' if good else '예상과 다름'}) — {res.get('detail')}" +
                      (f'  ⚠ {errs}' if errs else ''))
                ctx.close()
        b.close()
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
