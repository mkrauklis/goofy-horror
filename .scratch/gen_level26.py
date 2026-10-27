import json, random
from collections import deque

rng = random.Random(2601)

# ---- Twelve rooftops (a 3-row by 4-column grid) linked by boardwalks
# over the gaps between them -- "bigger" means more rooftops to actually
# cross, not the same six buildings blown up larger (that was the first,
# wrong read of "make it bigger"; this is the corrected one: double the
# building count, back down to a modest per-building footprint). '#' =
# wall/void (the drop between buildings -- just impassable, no fall
# mechanic), '.' = floor, used for both rooftops and boardwalks alike
# (LEVEL.boardwalks below tags which floor tiles are boardwalk, purely
# for the wood-plank visual).
TILE = 32
ROWS_N, COLS_N = 3, 4   # the building GRID shape, not the tile grid
BW, BH = 28, 20   # each building's own footprint
GAP = 10          # the void between adjacent buildings
MARGIN = 8

def building(col, row):
    x0 = MARGIN + col * (BW + GAP)
    y0 = MARGIN + row * (BH + GAP)
    return {'x0': x0, 'y0': y0, 'x1': x0 + BW - 1, 'y1': y0 + BH - 1}

B = {(r, c): building(c, r) for r in range(ROWS_N) for c in range(COLS_N)}

COLS = B[(0, COLS_N - 1)]['x1'] + MARGIN + 1
ROWS = B[(ROWS_N - 1, 0)]['y1'] + MARGIN + 1

grid = [['#'] * COLS for _ in range(ROWS)]

def set_rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

for b in B.values():
    set_rect(b['x0'], b['y0'], b['x1'], b['y1'], '.')

# ---- boardwalks: 3-tile-wide bridges across every adjacent pair in the
# grid (every row-neighbor, every column-neighbor) -- a fully connected
# mesh, not a single forced path, so there's always more than one way
# to cross, same convention the original 6-building layout used, just
# generalized to however many buildings the grid actually has.
boardwalks = []
def h_bridge(left, right):
    x0, x1 = left['x1'] + 1, right['x0'] - 1
    cy = (left['y0'] + left['y1']) // 2
    y0, y1 = cy - 1, cy + 1
    set_rect(x0, y0, x1, y1, '.')
    boardwalks.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1})

def v_bridge(top, bottom):
    y0, y1 = top['y1'] + 1, bottom['y0'] - 1
    cx = (top['x0'] + top['x1']) // 2
    x0, x1 = cx - 1, cx + 1
    set_rect(x0, y0, x1, y1, '.')
    boardwalks.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1})

for r in range(ROWS_N):
    for c in range(COLS_N - 1):
        h_bridge(B[(r, c)], B[(r, c + 1)])
for r in range(ROWS_N - 1):
    for c in range(COLS_N):
        v_bridge(B[(r, c)], B[(r + 1, c)])

# ---- spawn + safe zone, on the NW corner building.
SPAWN_KEY = (0, 0)
sx0, sy0 = B[SPAWN_KEY]['x0'] + 3, B[SPAWN_KEY]['y0'] + 3
set_rect(sx0, sy0, sx0 + 5, sy0 + 5, 'S')
spawn1 = {'x': sx0 + 1, 'y': sy0 + 1}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 1}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + 5, 'y1': sy0 + 5}

# ---- exit, gated behind the 3 generators, on the SE corner building --
# the far diagonal from spawn, every path there crossing several bridges.
EXIT_KEY = (ROWS_N - 1, COLS_N - 1)
ex, ey = B[EXIT_KEY]['x1'] - 5, B[EXIT_KEY]['y1'] - 5
ROOM_R = 3
set_rect(ex - ROOM_R, ey - ROOM_R, ex + ROOM_R, ey + ROOM_R, '#')
set_rect(ex - ROOM_R + 1, ey - ROOM_R + 1, ex + ROOM_R - 1, ey + ROOM_R - 1, 'E')
GATE_W = 3
gate_x0 = ex - GATE_W // 2
for dx in range(GATE_W):
    grid[ey - ROOM_R][gate_x0 + dx] = 'G'
grid[ey][ex] = 'X'
exitTrigger = {'x': ex, 'y': ey}
gate = {'x0': gate_x0, 'x1': gate_x0 + GATE_W - 1, 'y': ey - ROOM_R}

reserved = set()
for y in range(safeZone['y0'] - 2, safeZone['y1'] + 3):
    for x in range(safeZone['x0'] - 2, safeZone['x1'] + 3):
        reserved.add((x, y))
for y in range(ey - 4, ey + 3):
    for x in range(ex - 4, ex + 4):
        reserved.add((x, y))

def random_floor_spot(room, margin=3):
    for _ in range(200):
        x = rng.randint(room['x0'] + margin, room['x1'] - margin)
        y = rng.randint(room['y0'] + margin, room['y1'] - margin)
        if grid[y][x] == '.' and (x, y) not in reserved:
            return x, y
    return None

# ---- 3 generators, spread across 3 different buildings well away from
# both spawn and the exit, so reaching all 3 means actually crossing a
# good chunk of the mesh.
GENERATOR_KEYS = [(0, COLS_N - 1), (ROWS_N - 1, 0), (1, 2)]
generatorSpawns = []
for key in GENERATOR_KEYS:
    spot = random_floor_spot(B[key], margin=6)
    generatorSpawns.append({'x': spot[0], 'y': spot[1]})
    reserved.add(spot)

# ---- the Reacher's spawn/patrol-start -- a roughly central building. It
# patrols the whole map from here (see patrolPoints below), not just
# this one building.
MON_KEY = (1, 1)
mon_spot = random_floor_spot(B[MON_KEY], margin=6)
monsterSpawns = [{'x': mon_spot[0], 'y': mon_spot[1]}]
reserved.add(mon_spot)

patrolPoints = [{'x': (b['x0'] + b['x1']) // 2, 'y': (b['y0'] + b['y1']) // 2} for b in B.values()]

# ---- crates, scattered across every building.
crate_candidates = []
for b in B.values():
    for y in range(b['y0'], b['y1'] + 1):
        for x in range(b['x0'], b['x1'] + 1):
            if grid[y][x] == '.' and (x, y) not in reserved:
                crate_candidates.append((x, y))
rng.shuffle(crate_candidates)
CRATE_COUNT = min(len(crate_candidates), 90)
crateSpawns = [{'x': x, 'y': y} for (x, y) in crate_candidates[:CRATE_COUNT]]

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger, 'gate': gate,
    'monsterSpawns': monsterSpawns, 'patrolPoints': patrolPoints,
    'generatorSpawns': generatorSpawns,
    'crateSpawns': crateSpawns,
    'boardwalks': boardwalks,
}

# ---- connectivity check. Gate is open for this check (closed-gate
# connectivity isn't meaningful here -- nothing needs to be reachable
# "through" it except the exit tile itself, checked separately below).
def is_wall(ch, gate_open):
    if ch == '#':
        return True
    if ch == 'G':
        return not gate_open
    return False

def bfs(start, gate_open):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and (nx, ny) not in seen:
                if not is_wall(grid_strs[ny][nx], gate_open):
                    seen.add((nx, ny))
                    q.append((nx, ny))
    return seen

start = (spawn1['x'], spawn1['y'])
reach_closed = bfs(start, gate_open=False)
reach_open = bfs(start, gate_open=True)
ok = True
checks_before_gate = {
    'monsterSpawns': [(p['x'], p['y']) for p in monsterSpawns],
    'generatorSpawns': [(p['x'], p['y']) for p in generatorSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'patrolPoints': [(p['x'], p['y']) for p in patrolPoints],
}
for name, pts in checks_before_gate.items():
    for p in pts:
        if p not in reach_closed:
            print('UNREACHABLE (gate closed)', name, p)
            ok = False
if (exitTrigger['x'], exitTrigger['y']) not in reach_open:
    print('UNREACHABLE (gate open) exitTrigger')
    ok = False
if (exitTrigger['x'], exitTrigger['y']) in reach_closed:
    print('WARNING: exit reachable even with gate closed')
    ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'buildings', len(B),
      'monsters', len(monsterSpawns), 'generators', len(generatorSpawns),
      'crates', len(crateSpawns), 'boardwalks', len(boardwalks))

with open('C:/claude_p/goofy-horror/.scratch/level26_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level26_data.json')
