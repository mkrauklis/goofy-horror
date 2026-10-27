import json
from collections import deque

# A single-screen boss arena, same footprint as Level 15's (35x21 @ 32px)
# -- proven size for the "whole arena visible, fixed zoomed-out camera"
# trick. Unlike Level 15/23/24's convention, 'N' here means WINDOW (this
# level's own newer convention, matching Level 23/24, not Level 15's
# older "N = plain floor" one) -- plain floor is '.'.
TILE = 32
COLS = 35
ROWS = 21

grid = [['#'] * COLS for _ in range(ROWS)]
for y in range(1, ROWS - 1):
    for x in range(1, COLS - 1):
        grid[y][x] = '.'

# ---- windows on all four walls, every 4 tiles, so the whole arena has
# natural light coming in from every side (direct request).
windows = []
for x in range(3, COLS - 3, 4):
    grid[0][x] = 'N'
    windows.append({'x': x, 'y': 0, 'dir': 'S'})
    grid[ROWS - 1][x] = 'N'
    windows.append({'x': x, 'y': ROWS - 1, 'dir': 'N'})
for y in range(3, ROWS - 3, 4):
    grid[y][0] = 'N'
    windows.append({'x': 0, 'y': y, 'dir': 'E'})
    grid[y][COLS - 1] = 'N'
    windows.append({'x': COLS - 1, 'y': y, 'dir': 'W'})

# ---- the furnace: a solid 3-wide fixture embedded in the south wall,
# dead center -- deposit coal here to damage the boss. Carved out of the
# window row we just placed along that wall, so it doesn't collide with
# one.
furnace_cx = COLS // 2
for dx in (-1, 0, 1):
    grid[ROWS - 1][furnace_cx + dx] = 'U'  # 'U' = fUrnace (solid, not a window)
furnace = {'x': furnace_cx, 'y': ROWS - 2}

# spawn points, near the north-west corner -- plain open floor, no safe
# zone, same as Level 15 (the boss can reach you right at spawn same as
# anywhere else).
spawn1 = {'x': 3, 'y': 3}
spawn2 = {'x': 4, 'y': 3}

# the boss spawns dead center.
monsterSpawns = [{'x': COLS // 2, 'y': ROWS // 2}]

# a handful of item crates around the edges, clear of the center where
# most of the attacks are centered on the boss itself.
crateSpawns = [
    {'x': 4, 'y': ROWS - 4}, {'x': COLS - 5, 'y': 3}, {'x': COLS - 5, 'y': ROWS - 4},
    {'x': 9, 'y': 10}, {'x': COLS - 10, 'y': 10}, {'x': 17, 'y': 4},
]

# coal piles -- the only way to actually damage the boss. Scattered
# around the room's perimeter, clear of the furnace and spawn.
coalSpawns = [
    {'x': 4, 'y': 7}, {'x': 4, 'y': 14},
    {'x': COLS - 5, 'y': 7}, {'x': COLS - 5, 'y': 14},
    {'x': 12, 'y': 3}, {'x': COLS - 13, 'y': 3},
    {'x': 12, 'y': ROWS - 4}, {'x': COLS - 13, 'y': ROWS - 4},
]

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2,
    'monsterSpawns': monsterSpawns,
    'crateSpawns': crateSpawns,
    'coalSpawns': coalSpawns,
    'windows': windows,
    'furnace': furnace,
}

# ---- connectivity check.
def is_wall(ch):
    return ch == '#' or ch == 'U'

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
    'monsterSpawns': [(p['x'], p['y']) for p in monsterSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'coalSpawns': [(c['x'], c['y']) for c in coalSpawns],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach:
            print('UNREACHABLE', name, p)
            ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'windows', len(windows),
      'crates', len(crateSpawns), 'coal', len(coalSpawns))

with open('C:/claude_p/goofy-horror/.scratch/level25_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level25_data.json')
