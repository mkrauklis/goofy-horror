import json, random, math

TILE = 32
RADIUS_TILES = 18
PAD = 3
SIZE = RADIUS_TILES * 2 + PAD * 2  # 42
CX, CY = SIZE // 2, SIZE // 2

grid = [['#'] * SIZE for _ in range(SIZE)]
for y in range(SIZE):
    for x in range(SIZE):
        if math.hypot(x - CX, y - CY) <= RADIUS_TILES:
            grid[y][x] = '.'

# Spawn: just inside the south edge of the circle, side by side.
spawn_y = CY + RADIUS_TILES - 3
spawn1 = {'x': CX - 1, 'y': spawn_y}
spawn2 = {'x': CX, 'y': spawn_y}

rng = random.Random(2020)

reserved = set()
reserved.add((CX, CY))  # boss start, dead center
for dx in range(-3, 4):
    for dy in range(-3, 4):
        reserved.add((CX + dx, CY + dy))
for dx in range(-2, 3):
    for dy in range(-2, 3):
        reserved.add((spawn1['x'] + dx, spawn1['y'] + dy))
        reserved.add((spawn2['x'] + dx, spawn2['y'] + dy))

open_tiles = []
for y in range(SIZE):
    for x in range(SIZE):
        if grid[y][x] == '.' and (x, y) not in reserved:
            open_tiles.append((x, y))
rng.shuffle(open_tiles)

coral_count = 90
seaweed_count = 70
coral_tiles = open_tiles[:coral_count]
seaweed_tiles = open_tiles[coral_count:coral_count + seaweed_count]
for (x, y) in coral_tiles:
    grid[y][x] = 'R'
for (x, y) in seaweed_tiles:
    grid[y][x] = 'G'

out = {
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2,
    'arenaCenter': {'x': CX, 'y': CY},
    'arenaRadiusTiles': RADIUS_TILES,
}

# ---- sanity check: spawn can reach every tile inside the circle ----
from collections import deque
def bfs(start):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < SIZE and 0 <= ny < SIZE and (nx,ny) not in seen and grid[ny][nx] != '#':
                seen.add((nx,ny)); q.append((nx,ny))
    return seen

reach = bfs((spawn1['x'], spawn1['y']))
ok = (CX, CY) in reach
print('ALL OK:', ok, 'grid', SIZE, 'x', SIZE, 'open tiles reachable', len(reach), 'coral', len(coral_tiles), 'seaweed', len(seaweed_tiles))

with open('C:/claude_p/goofy-horror/.scratch/level20_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level20_data.json')
