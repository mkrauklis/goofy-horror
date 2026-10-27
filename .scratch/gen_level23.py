import json, random
from collections import deque

rng = random.Random(2301)

# ---- 2x the original 120x60 layout, on direct request ("make level 23
# and 24 2x bigger") -- section/hallway dimensions below are exactly
# double their original size, but computed from each other (not
# hand-doubled absolute coordinates) so the pieces stay directly
# adjacent -- doubling "45" to "90" while also doubling "44" to "88"
# leaves a 1-tile gap that a blind coordinate-doubling pass would
# silently wall off.
SEC_A_W, SEC_A_H = 86, 112  # 43x56 original, doubled
HALL_LEN, HALL_H = 62, 12   # 31x6 original, doubled

SEC_A = {'x0': 4, 'y0': 4, 'x1': 4 + SEC_A_W - 1, 'y1': 4 + SEC_A_H - 1}
hall_cy = (SEC_A['y0'] + SEC_A['y1']) // 2
HALL = {
    'x0': SEC_A['x1'] + 1, 'x1': SEC_A['x1'] + HALL_LEN,
    'y0': hall_cy - HALL_H // 2, 'y1': hall_cy - HALL_H // 2 + HALL_H - 1,
}
SEC_B = {
    'x0': HALL['x1'] + 1, 'x1': HALL['x1'] + SEC_A_W,
    'y0': SEC_A['y0'], 'y1': SEC_A['y1'],
}
COLS = SEC_B['x1'] + 4
ROWS = SEC_A['y1'] + 4

grid = [['#'] * COLS for _ in range(ROWS)]

def set_rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

set_rect(SEC_A['x0'], SEC_A['y0'], SEC_A['x1'], SEC_A['y1'], '.')
set_rect(SEC_B['x0'], SEC_B['y0'], SEC_B['x1'], SEC_B['y1'], '.')
set_rect(HALL['x0'], HALL['y0'], HALL['x1'], HALL['y1'], '.')

# Windows along both hallway walls (the row just above HALL.y0 and just
# below HALL.y1 are the hallway's own walls -- window tiles punched into
# them every few tiles, each with open hallway floor on one side).
windows = []
wall_n = HALL['y0'] - 1
wall_s = HALL['y1'] + 1
for x in range(HALL['x0'] + 2, HALL['x1'] - 1, 4):
    grid[wall_n][x] = 'N'
    windows.append({'x': x, 'y': wall_n, 'dir': 'S'})
    grid[wall_s][x] = 'N'
    windows.append({'x': x, 'y': wall_s, 'dir': 'N'})

# ---- Safe zone / spawn, in Section A.
sx0, sy0 = SEC_A['x0'] + 3, SEC_A['y0'] + 3
set_rect(sx0, sy0, sx0 + 5, sy0 + 5, 'S')
spawn1 = {'x': sx0 + 1, 'y': sy0 + 1}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 1}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + 5, 'y1': sy0 + 5}

# ---- Exit, in Section B, far corner -- already open, no gate.
ex, ey = SEC_B['x1'] - 4, SEC_B['y1'] - 4
set_rect(ex - 2, ey - 2, ex + 2, ey + 2, 'E')
grid[ey][ex] = 'X'
exitTrigger = {'x': ex, 'y': ey}

# ---- Shelves: 1-wide, 3-tall furniture blocking movement/sightlines,
# scattered through both sections -- grid char 'F', paired with a
# shelfSpawns entry giving the top tile (vertical footprint). Count
# quadrupled (24 attempts/room, up from 6) to match the ~4x floor area
# the 2x resize gives each section, so clutter density stays the same.
reserved = set()
for y in range(safeZone['y0'] - 2, safeZone['y1'] + 3):
    for x in range(safeZone['x0'] - 2, safeZone['x1'] + 3):
        reserved.add((x, y))
for y in range(ey - 3, ey + 4):
    for x in range(ex - 3, ex + 4):
        reserved.add((x, y))

def random_floor_spot(room, margin=3):
    for _ in range(200):
        x = rng.randint(room['x0'] + margin, room['x1'] - margin)
        y = rng.randint(room['y0'] + margin, room['y1'] - margin - 2)
        cells = [(x, y), (x, y + 1), (x, y + 2)]
        if all(grid[cy][cx] == '.' and (cx, cy) not in reserved for (cx, cy) in cells):
            return x, y
    return None

shelfSpawns = []
for room in (SEC_A, SEC_B):
    for _ in range(24):
        spot = random_floor_spot(room)
        if not spot:
            continue
        x, y = spot
        for dy in range(3):
            grid[y + dy][x] = 'F'
            reserved.add((x, y + dy))
        shelfSpawns.append({'x': x, 'y': y})

# ---- 2x2 big crates, same convention as Level 22's. Count quadrupled
# (20/room, up from 5) for the same density-matching reason as shelves.
bigCrateSpawns = []
big_crate_cells = set()
for room in (SEC_A, SEC_B):
    for _ in range(20):
        for _attempt in range(50):
            x = rng.randint(room['x0'] + 2, room['x1'] - 3)
            y = rng.randint(room['y0'] + 2, room['y1'] - 3)
            cells = [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
            if any((cx, cy) in reserved or grid[cy][cx] != '.' for (cx, cy) in cells):
                continue
            for (cx, cy) in cells:
                grid[cy][cx] = 'C'
                big_crate_cells.add((cx, cy))
                reserved.add((cx, cy))
            bigCrateSpawns.append({'x': x, 'y': y})
            break

# ---- normal single-tile crates, scattered across remaining floor. Cap
# quadrupled (360, up from 90) to match the ~4x total floor area.
crate_candidates = []
for room in (SEC_A, SEC_B, HALL):
    for y in range(room['y0'], room['y1'] + 1):
        for x in range(room['x0'], room['x1'] + 1):
            if grid[y][x] == '.' and (x, y) not in reserved:
                crate_candidates.append((x, y))
rng.shuffle(crate_candidates)
CRATE_COUNT = min(len(crate_candidates), 360)
crateSpawns = [{'x': x, 'y': y} for (x, y) in crate_candidates[:CRATE_COUNT]]

# ---- 3 stalkers, one spawn each, spread across both sections and the
# hallway. Stalkers hunt by sight (see js/game23.js's updateDetection),
# so these are just spawn points -- patrolPoints below is their route.
monsterSpawns = [
    {'x': SEC_A['x1'] - 10, 'y': SEC_A['y1'] - 10},
    {'x': SEC_B['x0'] + 10, 'y': SEC_B['y0'] + 10},
    {'x': (HALL['x0'] + HALL['x1']) // 2, 'y': (HALL['y0'] + HALL['y1']) // 2},
]

# A handful of generic waypoints (room centers, hallway midpoint) kept for
# any fallback/idle wander logic.
patrolPoints = [
    {'x': (SEC_A['x0'] + SEC_A['x1']) // 2, 'y': (SEC_A['y0'] + SEC_A['y1']) // 2},
    {'x': (SEC_B['x0'] + SEC_B['x1']) // 2, 'y': (SEC_B['y0'] + SEC_B['y1']) // 2},
    {'x': (HALL['x0'] + HALL['x1']) // 2, 'y': (HALL['y0'] + HALL['y1']) // 2},
]

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger,
    'monsterSpawns': monsterSpawns, 'patrolPoints': patrolPoints,
    'crateSpawns': crateSpawns, 'bigCrateSpawns': bigCrateSpawns,
    'shelfSpawns': shelfSpawns, 'windows': windows,
}

# ---- connectivity check.
def is_wall(ch):
    return ch == '#' or ch == 'N' or ch == 'C' or ch == 'F'

def bfs(start):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and (nx, ny) not in seen:
                if not is_wall(grid_strs[ny][nx]):
                    seen.add((nx, ny))
                    q.append((nx, ny))
    return seen

start = (spawn1['x'], spawn1['y'])
reach = bfs(start)
ok = True
checks = {
    'exitTrigger': [(exitTrigger['x'], exitTrigger['y'])],
    'monsterSpawns': [(p['x'], p['y']) for p in monsterSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'patrolPoints': [(p['x'], p['y']) for p in patrolPoints],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach:
            print('UNREACHABLE', name, p)
            ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'monsters', len(monsterSpawns),
      'crates', len(crateSpawns), 'bigCrates', len(bigCrateSpawns),
      'shelves', len(shelfSpawns), 'windows', len(windows))

with open('C:/claude_p/goofy-horror/.scratch/level23_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level23_data.json')
