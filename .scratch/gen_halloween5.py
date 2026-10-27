import json, math, os, random

# Halloween chapter, level 5 -- the Candy Kraken's arena: a round candy floor
# inside a ring of brick wall. Grid chars: '.' floor, '#' brick wall (outside
# the circle). The circular edge itself is enforced in code (js/halloween5.js),
# so the grid only blocks the corners well outside it.
rng = random.Random(1035)
COLS = ROWS = 49
CX = CY = 24.5            # circle centre, in tiles
R_FLOOR = 22.4            # floor radius, in tiles (twice the original 11.2)

def corner_dists(x, y):
    return [math.hypot(px - CX, py - CY) for px in (x, x + 1) for py in (y, y + 1)]

grid = []
for y in range(ROWS):
    row = ''
    for x in range(COLS):
        row += '#' if min(corner_dists(x, y)) > R_FLOOR else '.'
    grid.append(row)

def inside(x, y, r):  # tile centre within r tiles of the centre
    return math.hypot(x + 0.5 - CX, y + 0.5 - CY) <= r

spawn1 = {'x': 23, 'y': 41}; spawn2 = {'x': 25, 'y': 41}
monster = {'x': 24, 'y': 18}
crates = [{'x': 24, 'y': 5}, {'x': 7, 'y': 24}, {'x': 41, 'y': 24}, {'x': 11, 'y': 37}, {'x': 37, 'y': 37}, {'x': 24, 'y': 30},
          {'x': 12, 'y': 12}, {'x': 36, 'y': 12}]

# jack-o-lanterns: two rings round the arena, plus a few in the middle
lanterns = []
for ring, n in ((19.4, 26), (12.0, 14)):
    for i in range(n):
        a = (i / n) * math.pi * 2 + 0.1
        lanterns.append({'x': int(round(CX + math.cos(a) * ring - 0.5)), 'y': int(round(CY + math.sin(a) * ring - 0.5))})
for (x, y) in ((24, 24), (20, 24), (28, 24), (24, 20), (24, 28)):
    lanterns.append({'x': x, 'y': y})
lanterns = [l for l in lanterns if inside(l['x'], l['y'], 20.4)]
def clear(l):
    for o in [spawn1, spawn2, monster] + crates:
        if abs(o['x'] - l['x']) + abs(o['y'] - l['y']) < 2: return False
    return True
final = []
for l in lanterns:
    if clear(l) and all(abs(l['x'] - m['x']) + abs(l['y'] - m['y']) >= 3 for m in final): final.append(l)
lanterns = final

def pts(lst): return '[' + ', '.join('{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst) + ']'
js = 'window.HALLOWEEN5 = {\n  tileSize: 32,\n  cols: %d,\n  rows: %d,\n  grid: [\n' % (COLS, ROWS)
for r in grid: js += '    ' + json.dumps(r) + ',\n'
js += '  ],\n'
js += '  floorRadius: %s,\n' % R_FLOOR
js += '  spawn1: { x: %d, y: %d },\n  spawn2: { x: %d, y: %d },\n' % (spawn1['x'], spawn1['y'], spawn2['x'], spawn2['y'])
js += '  monsterSpawns: [{ x: %d, y: %d }],\n' % (monster['x'], monster['y'])
js += '  crateSpawns: %s,\n' % pts(crates)
js += '  lanterns: %s,\n' % pts(lanterns)
js += '};\n'
os.makedirs('C:/claude_p/goofy-horror/levels/halloween5', exist_ok=True)
open('C:/claude_p/goofy-horror/levels/halloween5/level.js', 'w', newline='\n').write(js)
print('grid', COLS, 'x', ROWS, 'lanterns', len(lanterns), 'floor tiles', sum(r.count('.') for r in grid))
