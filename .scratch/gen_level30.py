import json
from collections import deque

# The chapter 6 boss arena -- a rooftop helicopter landing pad, open to
# the sunrise sky on every side (same footprint as Level 15/25's proven
# "whole arena visible, fixed zoomed-out camera" size). Unlike Level 25's
# grassy room, there's no interior wall ring at all -- the boundary tiles
# render as open dawn sky (Level 29's own void treatment, reused as-is)
# while still blocking movement, so "sunrise all around" reads as a real
# open rooftop, not a windowed box.
TILE = 32
COLS = 35
ROWS = 21

grid = [['#'] * COLS for _ in range(ROWS)]
for y in range(1, ROWS - 1):
    for x in range(1, COLS - 1):
        grid[y][x] = '.'

# spawn points, south edge of the pad, clear of the boss's center spawn
# and of the charge/divebomb attacks' usual travel lines.
spawn1 = {'x': COLS // 2 - 1, 'y': ROWS - 4}
spawn2 = {'x': COLS // 2, 'y': ROWS - 4}

# the boss spawns dead center, same convention as every other boss level.
monsterSpawns = [{'x': COLS // 2, 'y': ROWS // 2}]

# a handful of item crates around the pad's edges, clear of the center.
crateSpawns = [
    {'x': 4, 'y': 4}, {'x': COLS - 5, 'y': 4},
    {'x': 4, 'y': ROWS - 5}, {'x': COLS - 5, 'y': ROWS - 5},
    {'x': COLS // 2, 'y': 3}, {'x': 4, 'y': ROWS // 2},
    {'x': COLS - 5, 'y': ROWS // 2},
]

# missile pickup candidate tiles -- a new one spawns at a random candidate
# every 10s (js/game30.js's own timer); kept well clear of the exact
# center (the boss's own spawn/return point) and the outer ring.
missileSpawns = []
for y in range(4, ROWS - 4, 3):
    for x in range(4, COLS - 4, 3):
        if abs(x - COLS // 2) <= 2 and abs(y - ROWS // 2) <= 2:
            continue
        missileSpawns.append({'x': x, 'y': y})

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2,
    'monsterSpawns': monsterSpawns,
    'crateSpawns': crateSpawns,
    'missileSpawns': missileSpawns,
}

def is_wall(ch):
    return ch == '#'

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
    'missileSpawns': [(c['x'], c['y']) for c in missileSpawns],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach:
            print('UNREACHABLE', name, p)
            ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS,
      'crates', len(crateSpawns), 'missileSpawns', len(missileSpawns))

with open('C:/claude_p/goofy-horror/.scratch/level30_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level30_data.json')
