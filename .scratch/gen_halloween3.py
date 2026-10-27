import json, os, random, math
from collections import deque

# Halloween chapter, level 3 -- a ventilation system: a maze of narrow ducts
# leading to a giant vent room with a huge fan in the middle. Chars:
#   '.' duct floor   '#' wall   'S' the start room (safe)   'W' the giant fan (solid)
#   'D' exit door   'E' exit room floor   'X' exit trigger
rng = random.Random(1036)
CW, CH = 18, 16            # maze cells, each 2x2 floor tiles with 1-tile walls
PITCH = 3
WM, H = CW * PITCH + 1, CH * PITCH + 1     # 55 x 49
ROOM_X0, ROOM_X1 = WM + 1, WM + 21         # giant vent room interior x
ROOM_Y0, ROOM_Y1 = 14, 34                  # and y (21 x 21)
EXIT_W = 9
W = ROOM_X1 + 2 + EXIT_W                   # wall, then the exit room
grid = [['#'] * W for _ in range(H)]

def cell_origin(i, j): return 1 + PITCH * i, 1 + PITCH * j
def carve_cell(i, j, ch='.'):
    x0, y0 = cell_origin(i, j)
    for y in range(y0, y0 + 2):
        for x in range(x0, x0 + 2): grid[y][x] = ch
def carve_edge(a, b):
    (i1, j1), (i2, j2) = a, b
    x0, y0 = cell_origin(i1, j1)
    if i2 == i1 + 1:
        for y in range(y0, y0 + 2): grid[y][x0 + 2] = '.'
    elif i2 == i1 - 1:
        for y in range(y0, y0 + 2): grid[y][x0 - 1] = '.'
    elif j2 == j1 + 1:
        for x in range(x0, x0 + 2): grid[y0 + 2][x] = '.'
    elif j2 == j1 - 1:
        for x in range(x0, x0 + 2): grid[y0 - 1][x] = '.'

for j in range(CH):
    for i in range(CW): carve_cell(i, j)

BLOCK = {(0, 0), (1, 0), (0, 1), (1, 1)}
for y in range(1, 6):
    for x in range(1, 6): grid[y][x] = 'S'

def nbrs(c):
    i, j = c
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = i + di, j + dj
        if 0 <= a < CW and 0 <= b < CH: yield (a, b)
edges = set()
def node(c): return 'B' if c in BLOCK else c
visited = {'B'}; stack = ['B']
def out_edges(n):
    cells = BLOCK if n == 'B' else {n}
    res = []
    for c in cells:
        for d in nbrs(c):
            if d in BLOCK and n == 'B': continue
            res.append((c, d))
    return res
while stack:
    n = stack[-1]
    opts = [(c, d) for c, d in out_edges(n) if node(d) not in visited]
    if not opts: stack.pop(); continue
    c, d = rng.choice(opts)
    edges.add(frozenset((c, d))); carve_edge(c, d)
    visited.add(node(d)); stack.append(node(d))

def degree(c): return sum(1 for d in nbrs(c) if frozenset((c, d)) in edges)
cells = [(i, j) for j in range(CH) for i in range(CW) if (i, j) not in BLOCK]
for c in cells:
    if degree(c) == 1 and rng.random() < 0.28:
        cand = [d for d in nbrs(c) if frozenset((c, d)) not in edges]
        d = rng.choice(cand); edges.add(frozenset((c, d))); carve_edge(c, d)
for _ in range(20):
    c = rng.choice(cells)
    cand = [d for d in nbrs(c) if frozenset((c, d)) not in edges and d not in BLOCK]
    if cand:
        d = rng.choice(cand); edges.add(frozenset((c, d))); carve_edge(c, d)

def comps():
    seen = {}; n = 0
    for c in cells:
        if c in seen: continue
        n += 1; q = deque([c]); seen[c] = n
        while q:
            u = q.popleft()
            for v in nbrs(u):
                if v in BLOCK or v in seen: continue
                if frozenset((u, v)) in edges: seen[v] = n; q.append(v)
    return seen, n
while True:
    seen, n = comps()
    if n == 1: break
    pairs = [(c, d) for c in cells for d in nbrs(c) if d not in BLOCK and seen[c] != seen[d]]
    c, d = rng.choice(pairs); edges.add(frozenset((c, d))); carve_edge(c, d)

# distances from the start, in cells
dist = {c: 0 for c in BLOCK}; q = deque(BLOCK)
while q:
    u = q.popleft()
    for v in nbrs(u):
        if v in dist or (u in BLOCK and v in BLOCK): continue
        if frozenset((u, v)) in edges: dist[v] = dist[u] + 1; q.append(v)

# ---- the giant vent room ----
for y in range(ROOM_Y0, ROOM_Y1 + 1):
    for x in range(ROOM_X0, ROOM_X1 + 1): grid[y][x] = '.'
mid_y = (ROOM_Y0 + ROOM_Y1) // 2           # 24
entry_cell = (CW - 1, 7)                    # the maze cell at the room's door, rows y 22..23
ey0 = cell_origin(*entry_cell)[1]
for x in range(WM - 1, ROOM_X0):               # an opening through the walls between maze and room
    for y in (ey0, ey0 + 1): grid[y][x] = '.'
# the giant fan, a solid disc in the middle of the room
fan_cx, fan_cy = (ROOM_X0 + ROOM_X1) // 2, mid_y
for y in range(fan_cy - 4, fan_cy + 5):
    for x in range(fan_cx - 4, fan_cx + 5):
        if math.hypot(x - fan_cx, y - fan_cy) <= 3.6: grid[y][x] = 'W'
levers = [{'x': ROOM_X0 + 3, 'y': mid_y}, {'x': ROOM_X1 - 3, 'y': mid_y}]
# the exit: a door in the room's far wall, and an exit room beyond
for y in (mid_y - 1, mid_y):
    grid[y][ROOM_X1 + 1] = 'D'
for y in range(mid_y - 3, mid_y + 3):
    for x in range(ROOM_X1 + 2, W - 1): grid[y][x] = 'E'
ex_x, ex_y = ROOM_X1 + 6, mid_y - 1
grid[ex_y][ex_x] = 'X'

def center(c):
    x0, y0 = cell_origin(*c); return x0, y0

rows = [''.join(r) for r in grid]
def reach(start, passable):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and passable(rows[ny][nx]):
                seen.add((nx, ny)); q.append((nx, ny))
    return seen
spawn1 = {'x': 2, 'y': 3}; spawn2 = {'x': 4, 'y': 3}

mids = [c for c in cells if 12 <= dist[c] <= 28]
mon_cell = rng.choice(mids)
second = [c for c in mids if abs(c[0] - mon_cell[0]) + abs(c[1] - mon_cell[1]) >= 10] or mids
mon_cell2 = rng.choice(second)
mon_tile = center(mon_cell)
mon_tile2 = center(mon_cell2)
patrol = [center(c) for c in rng.sample([c for c in cells if dist[c] >= 5], 14)]
patrol += [(fan_cx, fan_cy - 7), (fan_cx, fan_cy + 7), (ROOM_X0 + 3, mid_y + 6), (ROOM_X1 - 3, mid_y - 6)]
crate_cells = rng.sample([c for c in cells if dist[c] >= 4], 9)
crates = [center(c) for c in crate_cells] + [(ROOM_X0 + 1, ROOM_Y0 + 1), (ROOM_X1 - 1, ROOM_Y1 - 1)]
corpses = [center(c) for c in rng.sample(cells, 4)]
lamps = [center(c) for c in cells if (c[0] + c[1] * 2) % 5 == 0]
lamps += [(ROOM_X0 + 1, ROOM_Y0 + 1), (ROOM_X1 - 1, ROOM_Y0 + 1), (ROOM_X0 + 1, ROOM_Y1 - 1), (ROOM_X1 - 1, ROOM_Y1 - 1), (fan_cx, ROOM_Y0 + 1), (fan_cx, ROOM_Y1 - 1)]
lamps = [l for l in lamps if rows[l[1]][l[0]] == '.']

ok = True
pr = reach((2, 3), lambda ch: ch not in '#W')
for name, p in [('lever1', (levers[0]['x'], levers[0]['y'])), ('lever2', (levers[1]['x'], levers[1]['y'])), ('exit', (ex_x, ex_y))]:
    if p not in pr: print(name, 'unreachable'); ok = False
mr = reach(mon_tile, lambda ch: ch not in '#WSDE')
if mon_tile2 not in mr: print('second monster cannot reach the first'); ok = False
bad = [p for p in patrol if p not in mr]
print('patrol', len(patrol), 'unreachable for monster', len(bad))
if bad: ok = False
print('ALL OK:', ok, 'grid', W, 'x', H, 'monster dist', dist[mon_cell], 'room', (ROOM_X0, ROOM_Y0, ROOM_X1, ROOM_Y1), 'fan', (fan_cx, fan_cy), 'levers', levers)

def pts(lst): return '[' + ', '.join('{ x: %d, y: %d }' % (p[0], p[1]) if isinstance(p, tuple) else '{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst) + ']'
js = 'window.HALLOWEEN3 = {\n  tileSize: 32,\n  cols: %d,\n  rows: %d,\n  grid: [\n' % (W, H)
for r in rows: js += '    ' + json.dumps(r) + ',\n'
js += '  ],\n'
js += '  spawn1: { x: %d, y: %d },\n  spawn2: { x: %d, y: %d },\n' % (spawn1['x'], spawn1['y'], spawn2['x'], spawn2['y'])
js += '  monsterSpawns: [{ x: %d, y: %d }, { x: %d, y: %d }],\n' % (mon_tile + mon_tile2)
js += '  fan: { x: %d, y: %d },\n' % (fan_cx, fan_cy)
js += '  levers: %s,\n' % pts(levers)
js += '  exitTrigger: { x: %d, y: %d },\n' % (ex_x, ex_y)
js += '  safeZone: { x0: 1, y0: 1, x1: 5, y1: 5 },\n'
js += '  patrolPoints: %s,\n' % pts(patrol)
js += '  crateSpawns: %s,\n' % pts(crates)
js += '  corpseSpawns: [' + ', '.join('{ x: %d, y: %d, angle: %s }' % (c[0], c[1], round(rng.random() * 6.28, 2)) for c in corpses) + '],\n'
js += '  lamps: %s,\n' % pts(lamps)
js += '};\n'
os.makedirs('C:/claude_p/goofy-horror/levels/halloween3', exist_ok=True)
open('C:/claude_p/goofy-horror/levels/halloween3/level.js', 'w', newline='\n').write(js)
print('wrote', len(js), 'bytes')
