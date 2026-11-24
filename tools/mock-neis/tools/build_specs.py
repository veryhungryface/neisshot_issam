"""Catalog (structure only, already privacy-screened) → specs the sandbox renders from."""
import json, re, sys, collections, os
CAT = sys.argv[1]; MENUMAP = sys.argv[2]; OUT = sys.argv[3] if len(sys.argv) > 3 else 'data'   # argv[4]: a captured page for menu order
c = json.load(open(CAT, encoding='utf-8'))
raw = {m['itemid']: re.sub(r'\s*\d단계(\s*메뉴항목)?\s*$', '', m['name']).strip()
       for path in MENUMAP.split(',') for m in json.load(open(path, encoding='utf-8'))}   # several menu-map.json, comma-separated

# ── NEIS ──
menus = [dict(m) for m in c['neis']['menus'] if not m['code'].startswith('MENU_ID')]
for m in menus:
    if not m['name']:
        m['name'] = raw.get(m['code'], '')
    m['name'] = re.sub(r'\s*\d+건\d*$', '', m['name'])
keep = {m['code'] for m in menus if m['name']}
menus = [m for m in menus if m['code'] in keep]
# Two captures, two schools: the same role carries two menu trees (일반고 AMHIS…, 영재학교 AMGHS…). Merge siblings with the
# same name top-down (the first code wins, children move under it) so every role shows one tree with the union of screens.
by_code = {m['code']: m for m in menus}
alias = {}
def resolve(c):
    while c in alias:
        c = alias[c]
    return c
changed = True
while changed:
    changed = False
    seen = {}
    for m in sorted(menus, key=lambda m: m['code']):
        if m['code'] in alias:
            continue
        m['parent'] = resolve(m['parent']) if m['parent'] else ''
        k = (m['parent'], m['name'])
        if k in seen and seen[k] != m['code']:
            alias[m['code']] = seen[k]
            changed = True
        else:
            seen[k] = m['code']
menus = [m for m in menus if m['code'] not in alias]
for m in menus:
    m['parent'] = resolve(m['parent']) if m['parent'] else ''
screens = {}
for s in c['neis']['screens']:
    screens[s['name']] = {k: s[k] for k in ('name', 'menu_codes', 'paths', 'fields', 'buttons', 'grids', 'subtabs', 'modules', 'endpoints')}
roles = [m for m in menus if not m['parent'] and re.fullmatch(r'\d{6}', m['code'])]
basic = [m for m in menus if not m['parent'] and m['code'].startswith('AMCMC')]
# screen order as on the real page (role menu bar, 기본 메뉴) when a captured page is given
if len(sys.argv) > 4:
    from bs4 import BeautifulSoup
    page = BeautifulSoup(open(sys.argv[4], encoding='utf-8').read(), 'html.parser')
    seen_roles = [li['data-itemid'] for li in page.select('li.cl-navigationbar-item[data-itemid]')]
    seen_basic = [a['data-itemid'] for a in page.select('.base a.cl-level-1[data-itemid]')]
    pos = lambda order, code: order.index(code) if code in order else len(order)
    roles.sort(key=lambda m: (pos(seen_roles, m['code']), m['name']))
    basic.sort(key=lambda m: (pos(seen_basic, m['code']), m['name']))
personal = [m for m in menus if not m['parent'] and m['code'].startswith('personal')]
json.dump({'menus': menus, 'roles': [r['code'] for r in roles], 'basic': [b['code'] for b in basic],
           'personal': [p['code'] for p in personal], 'template_buttons': c['neis']['template_buttons'], 'screens': screens},
          open(os.path.join(OUT, 'neis.json'), 'w', encoding='utf-8'), ensure_ascii=False)
# ── K-에듀파인 ──
e = c['edufine']
json.dump({'menus': e['menus'], 'nav_tree': e['nav_tree'], 'template_components': e['template_components'],
           'screens': {s['name']: s for s in e['screens']}},
          open(os.path.join(OUT, 'edufine.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('neis menus', len(menus), 'screens', len(screens), 'roles', len(roles), 'basic', len(basic), '| edufine screens', len(e['screens']))
