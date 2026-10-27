import json, random, os
from collections import deque

rng = random.Random(3100)

# Level 31 -- the finale. Daytime, the front of the facility: the building
# and its lot in a bright clearing at the west end, and ONE straight road
# running east out of the lot through a very dense forest. Chars:
#   '.' grass   'R' road   'P' parking lot   'B' facility building (solid)
#   'T' tree (solid)   '#' perimeter hedge (solid)   'K' traffic cone
#   (car-only obstacle -- knocked flat when driven through)
TILE = 32
COLS, ROWS = 160, 44

grid = [['.'] * COLS for _ in range(ROWS)]

def rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

FAC = {'x0': 8, 'y0': 3, 'x1': 58, 'y1': 12}
LOT = {'x0': 8, 'y0': 13, 'x1': 58, 'y1': 30}
ROAD = {'x0': 59, 'y0': 19, 'x1': COLS - 1, 'y1': 26}   # the road never really ends: js/game31.js keeps generating it past this edge
rect(FAC['x0'], FAC['y0'], FAC['x1'], FAC['y1'], 'B')
rect(LOT['x0'], LOT['y0'], LOT['x1'], LOT['y1'], 'P')
rect(ROAD['x0'], ROAD['y0'], ROAD['x1'], ROAD['y1'], 'R')

# perimeter hedge
for x in range(COLS):
    grid[0][x] = '#'; grid[ROWS - 1][x] = '#'
for y in range(ROWS):
    grid[y][0] = '#'

spawn1 = {'x': 36, 'y': 21}
spawn2 = {'x': 36, 'y': 24}
cars = [{'x': 46, 'y': 21, 'heading': 0.0}, {'x': 46, 'y': 24, 'heading': 0.0}]   # side by side, already facing down the road
door = {'x': 33, 'y': 13}                       # the facility's front doors
forest = {'startX': 80, 'fullX': 104}           # where it starts getting dark

def near_paved(x, y, d):
    for dy in range(-d, d + 1):
        for dx in range(-d, d + 1):
            xx, yy = x + dx, y + dy
            if 0 <= xx < COLS and 0 <= yy < ROWS and grid[yy][xx] in ('R', 'P', 'B'):
                return True
    return False

trees = 0
for y in range(1, ROWS - 1):
    for x in range(1, COLS - 1):
        if grid[y][x] != '.':
            continue
        if x < 62:
            # the clearing in front of the facility: only a few lawn trees
            if not near_paved(x, y, 2) and rng.random() < 0.03:
                grid[y][x] = 'T'; trees += 1
            continue
        # the forest: a one-tile grass verge either side of the road, then
        # trees thick enough to read as a wall, ramping up from the clearing
        if ROAD['y0'] - 1 <= y <= ROAD['y1'] + 1:
            continue
        dens = 0.74 * min(1.0, (x - 62) / 22.0)
        if rng.random() < dens:
            grid[y][x] = 'T'; trees += 1

# traffic cones along the forest stretch of the road
cones = 0
for y in range(ROAD['y0'], ROAD['y1'] + 1):
    for x in range(110, ROAD['x1'] - 1):
        if grid[y][x] == 'R' and rng.random() < 0.0045:
            grid[y][x] = 'K'; cones += 1

grid_strs = [''.join(r) for r in grid]

def solid_foot(ch): return ch in ('B', 'T', '#')

def bfs(start, passable):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and (nx, ny) not in seen and passable(grid_strs[ny][nx]):
                seen.add((nx, ny)); q.append((nx, ny))
    return seen

ok = True
foot = bfs((spawn1['x'], spawn1['y']), lambda c: not solid_foot(c))
for name, pt in (('car1', (cars[0]['x'], cars[0]['y'])), ('car2', (cars[1]['x'], cars[1]['y'])), ('spawn2', (spawn2['x'], spawn2['y']))):
    if pt not in foot:
        print('UNREACHABLE on foot:', name); ok = False
drive = bfs((cars[0]['x'], cars[0]['y']), lambda c: c in ('R', 'P', 'K'))
for name, pt in (('road mid', (110, 22)), ('road end', (ROAD['x1'], 22))):
    if pt not in drive:
        print('UNREACHABLE by car:', name); ok = False
# every road tile in the forest stretch must be reachable too (cones count as passable)
if not all((x, y) in drive for y in range(ROAD['y0'], ROAD['y1'] + 1) for x in range(ROAD['x0'], ROAD['x1'] + 1)):
    print('ROAD NOT FULLY CONNECTED'); ok = False

out = {
    'cols': COLS, 'rows': ROWS, 'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2, 'cars': cars, 'door': door,
    'facility': FAC, 'lot': LOT, 'road': ROAD, 'forest': forest,
}
print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'cones', cones, 'trees', trees)

def js_val(v):
    if isinstance(v, str): return json.dumps(v)
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return json.dumps(v)
    if isinstance(v, list): return '[' + ','.join(js_val(x) for x in v) + ']'
    if isinstance(v, dict): return '{' + ','.join(f'{k}:{js_val(val)}' for k, val in v.items()) + '}'
    return 'null'

js = 'window.LEVEL31 = {\n  tileSize: 32,\n'
js += f'  cols: {COLS},\n  rows: {ROWS},\n  grid: [\n'
for row in grid_strs:
    js += '    ' + json.dumps(row) + ',\n'
js += '  ],\n'
for k in ('spawn1', 'spawn2', 'cars', 'door', 'facility', 'lot', 'road', 'forest'):
    js += f'  {k}: {js_val(out[k])},\n'
js += '};\n'
os.makedirs('C:/claude_p/goofy-horror/levels/level31', exist_ok=True)
with open('C:/claude_p/goofy-horror/levels/level31/level.js', 'w', newline='\n') as f:
    f.write(js)
print('wrote levels/level31/level.js', len(js), 'bytes')
