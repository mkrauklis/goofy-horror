import json

TILE = 32
COLS = 35
ROWS = 21

grid = [['#'] * COLS for _ in range(ROWS)]
for y in range(1, ROWS - 1):
    for x in range(1, COLS - 1):
        grid[y][x] = 'N'

# spawn point, left side -- plain open floor, no safe zone; the boss can
# walk in and catch you right at spawn same as anywhere else
spawn1 = {'x': 2, 'y': ROWS // 2 - 1}
spawn2 = {'x': 2, 'y': ROWS // 2 + 1}

monsterSpawns = [{'x': COLS // 2, 'y': ROWS // 2}]

# a handful of item crates around the arena's edges, clear of the center
# (the expand attack's danger zone)
crateSpawns = [
    {'x': 8, 'y': 4}, {'x': 8, 'y': ROWS - 5},
    {'x': COLS - 10, 'y': 4}, {'x': COLS - 20, 'y': 4},
    {'x': COLS - 20, 'y': ROWS - 5}, {'x': COLS - 8, 'y': ROWS // 2 - 6},
    {'x': 12, 'y': 10}, {'x': 22, 'y': 16},
]

# ---- phase 2: the gate and the chase hallway ----
# A gate in the arena's bottom wall, closed (a plain wall) until the boss
# drops to 15 HP -- opening it is what starts the chase. The hallway
# beyond is a long, straight, narrow corridor (nothing in it to dodge
# around -- the chase itself, the icicles, and the torches every 15
# tiles are the whole challenge) with a dead end at the far end.
HALL_W = 5
hall_x0 = COLS // 2 - HALL_W // 2  # leftmost hallway column
gate_y = ROWS - 1
for x in range(hall_x0, hall_x0 + HALL_W):
    grid[gate_y][x] = 'G'
gate = {'x0': hall_x0, 'x1': hall_x0 + HALL_W - 1, 'y': gate_y}

HALL_LEN = 600  # rows of corridor below the gate (10x the original 60)
hall_row0 = ROWS  # first hallway row (grid row index)
for i in range(HALL_LEN):
    y = ROWS + i
    grid.append(['#'] * COLS)
    for x in range(hall_x0, hall_x0 + HALL_W):
        grid[y][x] = 'N'
TOTAL_ROWS = ROWS + HALL_LEN

hallway = {
    'x0': hall_x0, 'x1': hall_x0 + HALL_W - 1,
    'y0': hall_row0, 'y1': hall_row0 + HALL_LEN - 1,
}

# fixed torch spawn points, every 15 tiles down the hallway, centered
hallCenterX = hall_x0 + HALL_W // 2
hallwayTorchPoints = []
step = 15
y = hall_row0 + step
while y < hall_row0 + HALL_LEN - 2:
    hallwayTorchPoints.append({'x': hallCenterX, 'y': y})
    y += step

# the holding-pen barrier: a solid line BARRIER_DEPTH_TILES into the hall
# from the gate -- players can't push past it until everyone's inside and
# the boss has finished spawning in, so the group can't scatter down the
# corridor before the chase actually starts
BARRIER_DEPTH_TILES = 10
barrier = {'y': hall_row0 + BARRIER_DEPTH_TILES}

# big 2x2 crates down the hall, alternating sides of the corridor so
# there's always a clear lane past one of them -- starts well past the
# barrier so the holding pen itself stays open
bigCrateSpawns = []
y = hall_row0 + 20
side = 0
while y < hall_row0 + HALL_LEN - 15:
    bx = hall_x0 if side == 0 else hall_x0 + HALL_W - 2
    bigCrateSpawns.append({'x': bx, 'y': y})
    for dx in (0, 1):
        for dy in (0, 1):
            grid[y + dy][bx + dx] = 'C'
    side = 1 - side
    y += 25

out = {
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2,
    'monsterSpawns': monsterSpawns, 'crateSpawns': crateSpawns,
    'gate': gate, 'hallway': hallway, 'hallwayTorchPoints': hallwayTorchPoints,
    'barrier': barrier, 'bigCrateSpawns': bigCrateSpawns,
}

# ---- BFS verification (arena-only reachability; the hallway is sealed
# by the gate until phase 2, so it's intentionally NOT reachable here) ----
from collections import deque

def is_wall(ch, gate_open=False):
    if ch == '#' or ch == 'C':
        return True
    if ch == 'G':
        return not gate_open
    return False

def bfs(start, gate_open=False):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < TOTAL_ROWS and (nx, ny) not in seen:
                if not is_wall(grid[ny][nx], gate_open):
                    seen.add((nx, ny))
                    q.append((nx, ny))
    return seen

start = (spawn1['x'], spawn1['y'])
reach = bfs(start, gate_open=False)
reach_open = bfs(start, gate_open=True)

ok = True
checks = {
    'monsterSpawns': [(m['x'], m['y']) for m in monsterSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach:
            print('UNREACHABLE', name, p)
            ok = False

# hallway must NOT be reachable while the gate is closed
hall_sample = (hallCenterX, hall_row0 + 5)
if hall_sample in reach:
    print('WARNING hallway reachable before gate opens')
    ok = False

# every torch point and the floor immediately beside each big crate must
# be reachable once the gate is open
for t in hallwayTorchPoints:
    if (t['x'], t['y']) not in reach_open:
        print('UNREACHABLE(open) torch', t)
        ok = False
for c in bigCrateSpawns:
    bx, by = c['x'], c['y']
    neighbors = [(bx - 1, by), (bx + 2, by), (bx, by - 1), (bx, by + 2)]
    if not any(n in reach_open for n in neighbors):
        print('BIGCRATE UNREACHABLE AREA', c)
        ok = False

cx, cy = COLS * TILE / 2, ROWS * TILE / 2
corners = [(1.5 * TILE, 1.5 * TILE), ((COLS - 1.5) * TILE, 1.5 * TILE),
           (1.5 * TILE, (ROWS - 1.5) * TILE), ((COLS - 1.5) * TILE, (ROWS - 1.5) * TILE)]
import math
min_corner_dist = min(math.hypot(cx - px, cy - py) for px, py in corners)
print('ALL OK:', ok, 'arena', COLS, 'x', ROWS, 'total grid', COLS, 'x', TOTAL_ROWS,
      'center-to-corner min dist', round(min_corner_dist),
      'hallway torches', len(hallwayTorchPoints),
      'big crates', len(bigCrateSpawns), 'barrier y', barrier['y'])

with open('C:/claude_p/goofy-horror/.scratch/level15_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level15_data.json')
