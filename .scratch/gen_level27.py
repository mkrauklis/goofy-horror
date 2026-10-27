import json, random
from collections import deque

rng = random.Random(2703)

# ---- Three buildings in a row, each with a real inside and outside: a
# hollow rectangular building (solid wall ring, hollow interior) wrapped
# by a walkway ledge on its exterior side, the buildings themselves
# linked building-to-building by boardwalks across the open sky between
# them -- "a bunch of rooftops" plus "go in and out of the building",
# together. Four doorways per building punch through its own wall ring,
# letting you step from its ledge straight into its interior and back.
# Chars (this level's own, independent of every other level's grid):
#   '#' void/sky (blocks players; the Gargoyles fly through it freely,
#       including straight across the gaps between buildings)
#   'W' solid building wall (blocks everyone, including the Gargoyles)
#   'L' ledge/exterior floor (also used for the boardwalks) -- "outside"
#   '.' interior floor -- "inside"
#   'S' safe zone (always interior)
#   'G' the final exit gate, 'X' the exit trigger, 'E' exit-room floor
#   'P' a power switch tile (see switchSpawns for inside/outside)
#   'C' a 2x2 big crate, 'F' a 2x2 fan (exterior only)
TILE = 32
BW, BH = 36, 28
WALL_T = 2
LEDGE_W = 4
GAP = 10
MARGIN = 10

def make_building(index):
    lx0 = MARGIN + index * (BW + 2 * LEDGE_W + GAP)
    ly0 = MARGIN
    bx0, by0 = lx0 + LEDGE_W, ly0 + LEDGE_W
    bx1, by1 = bx0 + BW - 1, by0 + BH - 1
    lx1, ly1 = bx1 + LEDGE_W, by1 + LEDGE_W
    ix0, iy0, ix1, iy1 = bx0 + WALL_T, by0 + WALL_T, bx1 - WALL_T, by1 - WALL_T
    return {
        'wall': {'x0': bx0, 'y0': by0, 'x1': bx1, 'y1': by1},
        'ledge': {'x0': lx0, 'y0': ly0, 'x1': lx1, 'y1': ly1},
        'interior': {'x0': ix0, 'y0': iy0, 'x1': ix1, 'y1': iy1},
    }

BUILDINGS = [make_building(i) for i in range(3)]
A, B, C = BUILDINGS

COLS = C['ledge']['x1'] + MARGIN + 1
ROWS = A['ledge']['y1'] + MARGIN + 1

grid = [['#'] * COLS for _ in range(ROWS)]

def set_rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

boardwalks = []
for bldg in BUILDINGS:
    l = bldg['ledge']
    set_rect(l['x0'], l['y0'], l['x1'], l['y1'], 'L')
for bldg in BUILDINGS:
    w = bldg['wall']
    set_rect(w['x0'], w['y0'], w['x1'], w['y1'], 'W')
for bldg in BUILDINGS:
    i = bldg['interior']
    set_rect(i['x0'], i['y0'], i['x1'], i['y1'], '.')

def h_bridge(left_bldg, right_bldg):
    ll, rl = left_bldg['ledge'], right_bldg['ledge']
    x0, x1 = ll['x1'] + 1, rl['x0'] - 1
    cy = (ll['y0'] + ll['y1']) // 2
    y0, y1 = cy - 1, cy + 1
    set_rect(x0, y0, x1, y1, 'L')
    boardwalks.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1})

h_bridge(A, B)
h_bridge(B, C)

# ---- four doorways through each building's own wall ring.
DOOR_W = 3
def carve_h_door(y_range, x_center):
    for y in y_range:
        for x in range(x_center - DOOR_W // 2, x_center - DOOR_W // 2 + DOOR_W):
            grid[y][x] = '.'
def carve_v_door(x_range, y_center):
    for x in x_range:
        for y in range(y_center - DOOR_W // 2, y_center - DOOR_W // 2 + DOOR_W):
            grid[y][x] = '.'

for bldg in BUILDINGS:
    w = bldg['wall']
    cx, cy = (w['x0'] + w['x1']) // 2, (w['y0'] + w['y1']) // 2
    carve_h_door(range(w['y0'], w['y0'] + WALL_T), cx)
    carve_h_door(range(w['y1'] - WALL_T + 1, w['y1'] + 1), cx)
    carve_v_door(range(w['x0'], w['x0'] + WALL_T), cy)
    carve_v_door(range(w['x1'] - WALL_T + 1, w['x1'] + 1), cy)

# ---- spawn + safe zone, interior of building A, just inside its west door.
wA, iA = A['wall'], A['interior']
cyA = (wA['y0'] + wA['y1']) // 2
sx0, sy0 = iA['x0'] + 2, cyA - 4
set_rect(sx0, sy0, sx0 + 5, sy0 + 5, 'S')
spawn1 = {'x': sx0 + 1, 'y': sy0 + 2}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 2}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + 5, 'y1': sy0 + 5}

# ---- the gated exit room, interior of building C, far SE corner.
iC = C['interior']
ex, ey = iC['x1'] - 6, iC['y1'] - 6
ROOM_R = 4
set_rect(ex - ROOM_R, ey - ROOM_R, ex + ROOM_R, ey + ROOM_R, 'W')
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
for y in range(ey - ROOM_R - 2, ey + ROOM_R + 2):
    for x in range(ex - ROOM_R - 2, ex + ROOM_R + 2):
        reserved.add((x, y))
for bldg in BUILDINGS:
    w = bldg['wall']
    cx, cy = (w['x0'] + w['x1']) // 2, (w['y0'] + w['y1']) // 2
    for y in range(w['y0'] - 1, w['y0'] + WALL_T + 1):
        for x in range(cx - DOOR_W, cx + DOOR_W + 1):
            reserved.add((x, y))
    for y in range(w['y1'] - WALL_T, w['y1'] + 2):
        for x in range(cx - DOOR_W, cx + DOOR_W + 1):
            reserved.add((x, y))
    for x in range(w['x0'] - 1, w['x0'] + WALL_T + 1):
        for y in range(cy - DOOR_W, cy + DOOR_W + 1):
            reserved.add((x, y))
    for x in range(w['x1'] - WALL_T, w['x1'] + 2):
        for y in range(cy - DOOR_W, cy + DOOR_W + 1):
            reserved.add((x, y))

def random_spot(x0, y0, x1, y1, floor_ch, margin=2):
    for _ in range(300):
        x = rng.randint(x0 + margin, x1 - margin)
        y = rng.randint(y0 + margin, y1 - margin)
        if grid[y][x] == floor_ch and (x, y) not in reserved:
            return x, y
    return None

# ---- 3 power switches -- 2 inside (buildings A and B), 1 outside (on
# building C's ledge, the far side of the whole complex).
iB = B['interior']
sw_in_1 = random_spot(iA['x0'], iA['y0'], iA['x1'], iA['y1'], '.', margin=3)
sw_in_2 = random_spot(iB['x0'], iB['y0'], iB['x1'], iB['y1'], '.', margin=3)
lC = C['ledge']
sw_out = random_spot(lC['x0'], lC['y0'], lC['x1'], lC['y1'], 'L', margin=2)
for spot in (sw_in_1, sw_in_2, sw_out):
    grid[spot[1]][spot[0]] = 'P'
    reserved.add(spot)
switchSpawns = [
    {'x': sw_in_1[0], 'y': sw_in_1[1], 'inside': True},
    {'x': sw_in_2[0], 'y': sw_in_2[1], 'inside': True},
    {'x': sw_out[0], 'y': sw_out[1], 'inside': False},
]

# ---- a handful of ceiling light fixtures in every building's interior
# -- dark until all 3 switches are pressed, then real light sources.
interiorLights = []
for bldg in BUILDINGS:
    i = bldg['interior']
    for _ in range(4):
        spot = random_spot(i['x0'], i['y0'], i['x1'], i['y1'], '.', margin=3)
        if spot:
            interiorLights.append({'x': spot[0], 'y': spot[1]})
            reserved.add(spot)

# ---- 3 Gargoyles patrol a ring around the WHOLE complex -- out past
# every building's ledge and straight across both gaps between them, the
# same open sky they're free to fly through anywhere.
outer_x0 = A['ledge']['x0']
outer_y0 = min(bldg['ledge']['y0'] for bldg in BUILDINGS)
outer_x1 = C['ledge']['x1']
outer_y1 = max(bldg['ledge']['y1'] for bldg in BUILDINGS)
outer_cx = (outer_x0 + outer_x1) // 2
outer_cy = (outer_y0 + outer_y1) // 2
ring = [
    {'x': outer_cx, 'y': outer_y0 - 2},
    {'x': B['ledge']['x1'], 'y': outer_y0 - 2},
    {'x': outer_x1 + 2, 'y': outer_y0 - 2},
    {'x': outer_x1 + 2, 'y': outer_cy},
    {'x': outer_x1 + 2, 'y': outer_y1 + 2},
    {'x': B['ledge']['x1'], 'y': outer_y1 + 2},
    {'x': outer_cx, 'y': outer_y1 + 2},
    {'x': A['ledge']['x0'] - 2, 'y': outer_y1 + 2},
    {'x': outer_x0 - 2, 'y': outer_cy},
    {'x': A['ledge']['x0'] - 2, 'y': outer_y0 - 2},
]
monsterSpawns = [ring[0], ring[4], ring[7]]
patrolPoints = ring

# ---- big 2x2 crates and fans: scattered across every building's ledge
# and interior.
bigCrateSpawns = []
fanSpawns = []
def scatter_big(x0, y0, x1, y1, floor_ch, count, ch):
    out = []
    for _ in range(count):
        for _attempt in range(50):
            x = rng.randint(x0, x1 - 1)
            y = rng.randint(y0, y1 - 1)
            cells = [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
            if any((cx2, cy2) in reserved or grid[cy2][cx2] != floor_ch for (cx2, cy2) in cells):
                continue
            for (cx2, cy2) in cells:
                grid[cy2][cx2] = ch
                reserved.add((cx2, cy2))
            out.append({'x': x, 'y': y})
            break
    return out

for bldg in BUILDINGS:
    l, i = bldg['ledge'], bldg['interior']
    bigCrateSpawns += scatter_big(l['x0'] + 1, l['y0'] + 1, l['x1'] - 1, l['y1'] - 1, 'L', 3, 'C')
    bigCrateSpawns += scatter_big(i['x0'] + 1, i['y0'] + 1, i['x1'] - 1, i['y1'] - 1, '.', 3, 'C')
    fanSpawns += scatter_big(l['x0'] + 1, l['y0'] + 1, l['x1'] - 1, l['y1'] - 1, 'L', 3, 'F')

# ---- regular 1x1 item crates, both inside and outside, every building.
def crate_candidates(x0, y0, x1, y1, floor_ch):
    out = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if grid[y][x] == floor_ch and (x, y) not in reserved:
                out.append((x, y))
    return out

cands = []
for bldg in BUILDINGS:
    l, i = bldg['ledge'], bldg['interior']
    cands += crate_candidates(l['x0'], l['y0'], l['x1'], l['y1'], 'L')
    cands += crate_candidates(i['x0'], i['y0'], i['x1'], i['y1'], '.')
rng.shuffle(cands)
CRATE_COUNT = min(len(cands), 70)
crateSpawns = [{'x': x, 'y': y} for (x, y) in cands[:CRATE_COUNT]]

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger, 'gate': gate,
    'switchSpawns': switchSpawns, 'interiorLights': interiorLights,
    'monsterSpawns': monsterSpawns, 'patrolPoints': patrolPoints,
    'bigCrateSpawns': bigCrateSpawns, 'fanSpawns': fanSpawns,
    'crateSpawns': crateSpawns,
    'boardwalks': boardwalks,
}

# ---- connectivity check (players only -- Gargoyles don't use the
# walkable graph at all, they fly in continuous space).
def is_wall(ch, gate_open):
    if ch in ('#', 'W', 'C', 'F'):
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
    'switchSpawns': [(s['x'], s['y']) for s in switchSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'interiorLights': [(p['x'], p['y']) for p in interiorLights],
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

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'buildings', len(BUILDINGS),
      'switches', len(switchSpawns), 'lights', len(interiorLights),
      'gargoyles', len(monsterSpawns), 'bigCrates', len(bigCrateSpawns),
      'fans', len(fanSpawns), 'crates', len(crateSpawns), 'boardwalks', len(boardwalks))

with open('C:/claude_p/goofy-horror/.scratch/level27_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level27_data.json')
