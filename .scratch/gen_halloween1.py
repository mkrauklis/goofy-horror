import json, os, random
from collections import deque

# Halloween chapter, level 1 -- a maze. Chars:
#   '.' floor   '#' wall   'S' safe room (monster can't enter)   'V' hiding vent
#   'B' candy bucket   'D' exit door   'E' exit room floor   'X' exit trigger
# Cells are 3x3 floor tiles with 1-tile walls between them.
rng = random.Random(1031)
CW, CH = 22, 14
W0, H = CW * 4 + 1, CH * 4 + 1
EXIT_W = 10
W = W0 + EXIT_W

grid = [['#'] * W for _ in range(H)]

def cell_origin(i, j):
    return 1 + 4 * i, 1 + 4 * j

def carve_cell(i, j, ch='.'):
    x0, y0 = cell_origin(i, j)
    for y in range(y0, y0 + 3):
        for x in range(x0, x0 + 3):
            grid[y][x] = ch

def carve_edge(a, b):
    (i1, j1), (i2, j2) = a, b
    x0, y0 = cell_origin(i1, j1)
    if i2 == i1 + 1:
        for y in range(y0, y0 + 3): grid[y][x0 + 3] = '.'
    elif i2 == i1 - 1:
        for y in range(y0, y0 + 3): grid[y][x0 - 1] = '.'
    elif j2 == j1 + 1:
        for x in range(x0, x0 + 3): grid[y0 + 3][x] = '.'
    elif j2 == j1 - 1:
        for x in range(x0, x0 + 3): grid[y0 - 1][x] = '.'

for j in range(CH):
    for i in range(CW):
        carve_cell(i, j)

# the safe room: cells (0..1, 0..1) merged into one open 7x7 block
BLOCK = {(0, 0), (1, 0), (0, 1), (1, 1)}
for y in range(1, 8):
    for x in range(1, 8):
        grid[y][x] = 'S'

def nbrs(c):
    i, j = c
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        a, b = i + di, j + dj
        if 0 <= a < CW and 0 <= b < CH: yield (a, b)

edges = set()  # open connections between cells (frozenset pairs); block-internal ones are implicit

def node(c): return 'B' if c in BLOCK else c

# DFS maze over nodes, with the block collapsed into one node 'B'
visited = {'B'}
stack = ['B']
def out_edges(n):
    cells = BLOCK if n == 'B' else {n}
    res = []
    for c in cells:
        for d in nbrs(c):
            if d in BLOCK and n == 'B': continue
            if n != 'B' and d in BLOCK: res.append((c, d))
            else: res.append((c, d))
    return res
while stack:
    n = stack[-1]
    opts = [(c, d) for c, d in out_edges(n) if node(d) not in visited]
    if not opts:
        stack.pop(); continue
    c, d = rng.choice(opts)
    edges.add(frozenset((c, d))); carve_edge(c, d)
    visited.add(node(d)); stack.append(node(d))

def degree(c):
    return sum(1 for d in nbrs(c) if frozenset((c, d)) in edges)

# braid: open some dead ends and a few random walls so there are loops
cells = [(i, j) for j in range(CH) for i in range(CW) if (i, j) not in BLOCK]
for c in cells:
    if degree(c) == 1 and rng.random() < 0.30:
        cand = [d for d in nbrs(c) if frozenset((c, d)) not in edges]
        d = rng.choice(cand)
        edges.add(frozenset((c, d))); carve_edge(c, d)
for _ in range(25):
    c = rng.choice(cells)
    cand = [d for d in nbrs(c) if frozenset((c, d)) not in edges and d not in BLOCK]
    if cand:
        d = rng.choice(cand); edges.add(frozenset((c, d))); carve_edge(c, d)

# monsters can't enter the safe room, so the maze must stay connected without it
def comps_without_block():
    seen = {}; comps = 0
    for c in cells:
        if c in seen: continue
        comps += 1; q = deque([c]); seen[c] = comps
        while q:
            u = q.popleft()
            for v in nbrs(u):
                if v in BLOCK or v in seen: continue
                if frozenset((u, v)) in edges:
                    seen[v] = comps; q.append(v)
    return seen, comps
while True:
    seen, n = comps_without_block()
    if n == 1: break
    # open a wall between two different components
    pairs = [(c, d) for c in cells for d in nbrs(c) if d not in BLOCK and seen[c] != seen[d]]
    c, d = rng.choice(pairs); edges.add(frozenset((c, d))); carve_edge(c, d)

# distances from the safe room (BFS over cells; the block counts as distance 0)
dist = {c: 0 for c in BLOCK}
q = deque(BLOCK)
while q:
    u = q.popleft()
    for v in nbrs(u):
        if v in dist: continue
        if u in BLOCK and v in BLOCK: continue
        if frozenset((u, v)) in edges or (u in BLOCK and v not in BLOCK and frozenset((u, v)) in edges):
            dist[v] = dist[u] + 1; q.append(v)

# exit: the right-hand column cell farthest from the start
exit_cell = max(((CW - 1, j) for j in range(CH)), key=lambda c: dist[c])
er = exit_cell[1]
dx_ = W0 - 1
for y in range(4 * er + 1, 4 * er + 4):
    grid[y][dx_] = 'D'
room_y0, room_y1 = max(1, 4 * er - 1), min(H - 2, 4 * er + 5)
for y in range(room_y0, room_y1 + 1):
    for x in range(W0, W - 1):
        grid[y][x] = 'E'
ex_x, ex_y = W0 + 5, 4 * er + 2
grid[ex_y][ex_x] = 'X'

def center(c):
    x0, y0 = cell_origin(*c)
    return x0 + 1, y0 + 1

# candy buckets: three dead-end-ish cells, far from the start and from each other
dead_ends = [c for c in cells if degree(c) == 1 and c != exit_cell]
dead_ends.sort(key=lambda c: -dist[c])
buckets = []
for c in dead_ends:
    if dist[c] < 14: break
    if all(abs(c[0] - b[0]) + abs(c[1] - b[1]) >= 9 for b in buckets):
        buckets.append(c)
    if len(buckets) == 3: break
if len(buckets) < 3:
    for c in sorted(cells, key=lambda c: -dist[c]):
        if c == exit_cell or c in buckets: continue
        if all(abs(c[0] - b[0]) + abs(c[1] - b[1]) >= 8 for b in buckets):
            buckets.append(c)
        if len(buckets) == 3: break
for c in buckets:
    x, y = center(c); grid[y][x] = 'B'

# hiding vents in other dead ends
vents = [c for c in dead_ends if c not in buckets and dist[c] >= 5]
rng.shuffle(vents)
for c in vents[:9]:
    x, y = center(c); grid[y][x] = 'V'

used = set(buckets) | {exit_cell}
free_cells = [c for c in cells if c not in used and grid[center(c)[1]][center(c)[0]] == '.']

# the monster starts well away from the safe room
mids = [c for c in free_cells if 18 <= dist[c] <= 30]
mon_cell = rng.choice(mids or free_cells)
patrol = rng.sample([c for c in free_cells if dist[c] >= 4], 16)
crate_cells = rng.sample([c for c in free_cells if dist[c] >= 3], 11)
corpse_cells = rng.sample(free_cells, 6)

def tile_of(c, dx=1, dy=1):
    x0, y0 = cell_origin(*c); return {'x': x0 + dx, 'y': y0 + dy}

# jack-o-lanterns tucked in cell corners (decor + light)
lanterns = []
for c in rng.sample(free_cells + buckets, 55):
    if c in BLOCK: continue
    dx, dy = rng.choice([(0, 0), (2, 0), (0, 2), (2, 2)])
    t = tile_of(c, dx, dy)
    if grid[t['y']][t['x']] == '.': lanterns.append(t)
# a couple inside the safe room too
for t in ({'x': 1, 'y': 1}, {'x': 7, 'y': 1}, {'x': 1, 'y': 7}, {'x': 7, 'y': 7}):
    lanterns.append(t)

# orange windows: wall tiles that face open floor
def faces_floor(x, y):
    return any(0 <= x + dx < W and 0 <= y + dy < H and grid[y + dy][x + dx] in '.SBV' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
cand = [(x, y) for y in range(H) for x in range(W)
        if grid[y][x] == '#' and faces_floor(x, y)
        and not (x % 4 == 0 and y % 4 == 0)]
rng.shuffle(cand)
windows = []
for x, y in cand:
    if all(abs(x - wx) + abs(y - wy) >= 6 for wx, wy in windows):
        windows.append((x, y))
    if len(windows) >= 110: break
windows = [{'x': x, 'y': y} for x, y in windows]

# sanity: everything reachable by players (doors passable), buckets reachable by monsters
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
spawn1 = {'x': 3, 'y': 4}; spawn2 = {'x': 5, 'y': 4}
pr = reach((3, 4), lambda ch: ch != '#')
ok = True
for name, c in (('bucket', None),):
    pass
for c in buckets:
    x, y = center(c)
    if (x, y) not in pr: print('bucket unreachable', c); ok = False
if (ex_x, ex_y) not in pr: print('exit unreachable'); ok = False
mr = reach(tuple(center(mon_cell)), lambda ch: ch not in '#SV' and ch != 'D')
for c in patrol:
    if center(c) not in mr: print('patrol unreachable for monster', c); ok = False
for c in buckets:
    if center(c) not in mr: print('monster cannot reach bucket', c); ok = False
print('ALL OK:', ok, 'grid', W, 'x', H, 'buckets', buckets, 'exit cell', exit_cell, 'dist', [dist[b] for b in buckets], 'windows', len(windows), 'lanterns', len(lanterns), 'vents', len(vents[:9]))

def pts(lst): return '[' + ', '.join('{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst) + ']'
def cpts(cs): return [{'x': center(c)[0], 'y': center(c)[1]} for c in cs]

js = 'window.HALLOWEEN1 = {\n  tileSize: 32,\n  cols: %d,\n  rows: %d,\n  grid: [\n' % (W, H)
for r in rows: js += '    ' + json.dumps(r) + ',\n'
js += '  ],\n'
js += '  spawn1: { x: %d, y: %d },\n  spawn2: { x: %d, y: %d },\n' % (spawn1['x'], spawn1['y'], spawn2['x'], spawn2['y'])
mc = center(mon_cell)
js += '  monsterSpawn: { x: %d, y: %d },\n' % mc
js += '  buckets: %s,\n' % pts(cpts(buckets))
js += '  exitTrigger: { x: %d, y: %d },\n' % (ex_x, ex_y)
js += '  safeZone: { x0: 1, y0: 1, x1: 7, y1: 7 },\n'
js += '  patrolPoints: %s,\n' % pts(cpts(patrol))
js += '  crateSpawns: %s,\n' % pts(cpts(crate_cells))
corp = [dict(center_ , angle=round(rng.random() * 6.28, 2)) for center_ in cpts(corpse_cells)]
js += '  corpseSpawns: [' + ', '.join('{ x: %d, y: %d, angle: %s }' % (p['x'], p['y'], p['angle']) for p in corp) + '],\n'
js += '  lanterns: %s,\n' % pts(lanterns)
js += '  windows: %s,\n' % pts(windows)
js += '};\n'
os.makedirs('C:/claude_p/goofy-horror/levels/halloween1', exist_ok=True)
open('C:/claude_p/goofy-horror/levels/halloween1/level.js', 'w', newline='\n').write(js)
print('wrote', len(js), 'bytes')
