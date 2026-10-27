import json, random
from collections import deque

ROOM_W, ROOM_H, COR = 16, 9, 4
GC, GR = 10, 12  # 120 rooms -- bigger than Level 17's 80-room "giant" layout

def room_origin(r, c):
    return 1 + c * (ROOM_W + COR), 1 + r * (ROOM_H + COR)

COLS = 1 + GC * ROOM_W + (GC - 1) * COR + 1
ROWS = 1 + GR * ROOM_H + (GR - 1) * COR + 1

grid = [['#'] * COLS for _ in range(ROWS)]
for r in range(GR):
    for c in range(GC):
        x0, y0 = room_origin(r, c)
        for y in range(y0, y0 + ROOM_H):
            for x in range(x0, x0 + ROOM_W):
                grid[y][x] = '.'

SPAWN_ROOM = (GR - 1, GC - 1)
EXIT_ROOM = (0, 0)

# The exit room sits at a grid corner (touches 2 neighbors) -- only the
# first edge found touching it becomes the single vine-gated entrance;
# the other is never carved, so the exit room has exactly one way in.
exit_door_carved = False
for r in range(GR):
    for c in range(GC):
        x0, y0 = room_origin(r, c)
        if c + 1 < GC:
            nx0, _ = room_origin(r, c + 1)
            cy = y0 + ROOM_H // 2 - COR // 2
            touches_exit = (r, c + 1) == EXIT_ROOM or (r, c) == EXIT_ROOM
            if touches_exit and not exit_door_carved:
                exit_door_carved = True
                for y in range(cy, cy + COR):
                    for x in range(x0 + ROOM_W, nx0):
                        grid[y][x] = 'D'
            elif not touches_exit:
                for y in range(cy, cy + COR):
                    for x in range(x0 + ROOM_W, nx0):
                        grid[y][x] = '.'
        if r + 1 < GR:
            _, ny0b = room_origin(r + 1, c)
            cx = x0 + ROOM_W // 2 - COR // 2
            touches_exit = (r + 1, c) == EXIT_ROOM or (r, c) == EXIT_ROOM
            if touches_exit and not exit_door_carved:
                exit_door_carved = True
                for x in range(cx, cx + COR):
                    for y in range(y0 + ROOM_H, ny0b):
                        grid[y][x] = 'D'
            elif not touches_exit:
                for x in range(cx, cx + COR):
                    for y in range(y0 + ROOM_H, ny0b):
                        grid[y][x] = '.'

sx0, sy0 = room_origin(*SPAWN_ROOM)
for y in range(sy0, sy0 + 6):
    for x in range(sx0, sx0 + 6):
        grid[y][x] = 'S'
spawn1 = {'x': sx0 + 1, 'y': sy0 + 1}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 1}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + 5, 'y1': sy0 + 5}

ex0, ey0 = room_origin(*EXIT_ROOM)
for y in range(ey0, ey0 + ROOM_H):
    for x in range(ex0, ex0 + ROOM_W):
        grid[y][x] = 'E'
exitTrigger = {'x': ex0 + ROOM_W // 2, 'y': ey0 + ROOM_H // 2}
grid[exitTrigger['y']][exitTrigger['x']] = 'X'

rooms = [(r, c) for r in range(GR) for c in range(GC)]
non_spawn_exit = [rc for rc in rooms if rc != SPAWN_ROOM and rc != EXIT_ROOM]
rng = random.Random(2121)

shears_room = rng.choice(non_spawn_exit)
shx0, shy0 = room_origin(*shears_room)
shears = {'x': shx0 + ROOM_W // 2, 'y': shy0 + ROOM_H // 2}
grid[shears['y']][shears['x']] = 'H'

MONSTER_COUNT = 10
monster_rooms = rng.sample([rc for rc in non_spawn_exit if rc != shears_room], MONSTER_COUNT)
monsterSpawns = []
for (r, c) in monster_rooms:
    mx0, my0 = room_origin(r, c)
    monsterSpawns.append({'x': mx0 + ROOM_W // 2, 'y': my0 + ROOM_H // 2})

patrolPoints = []
for (r, c) in rooms:
    if (r, c) == EXIT_ROOM:
        continue
    x0, y0 = room_origin(r, c)
    patrolPoints.append({'x': x0 + ROOM_W // 2, 'y': y0 + ROOM_H // 2})

reserved = set()
for y in range(sy0 - 1, sy0 + 7):
    for x in range(sx0 - 1, sx0 + 7):
        reserved.add((x, y))
reserved.add((shears['x'], shears['y']))
for p in monsterSpawns:
    reserved.add((p['x'], p['y']))
for p in patrolPoints:
    reserved.add((p['x'], p['y']))

# grass, scattered across most open floor tiles -- "growing all over the
# place" per the brief, so a denser fraction than Level 17's seaweed.
grass_candidates = []
for (r, c) in rooms:
    x0, y0 = room_origin(r, c)
    for y in range(y0, y0 + ROOM_H):
        for x in range(x0, x0 + ROOM_W):
            if grid[y][x] == '.' and (x, y) not in reserved:
                grass_candidates.append((x, y))
rng.shuffle(grass_candidates)
GRASS_COUNT = min(len(grass_candidates), 220 * 6)
for (x, y) in grass_candidates[:GRASS_COUNT]:
    grid[y][x] = 'G'

remaining = [t for t in grass_candidates[GRASS_COUNT:] if t not in reserved]
rng.shuffle(remaining)
crateSpawns = [{'x': x, 'y': y} for (x, y) in remaining[:28 * 6]]

out = {
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger, 'shears': shears,
    'monsterSpawns': monsterSpawns,
    'patrolPoints': patrolPoints, 'crateSpawns': crateSpawns,
}

def is_wall(ch, door_open):
    if ch == '#':
        return True
    if ch == 'D':
        return not door_open
    return False

def bfs(start, door_open):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and (nx, ny) not in seen:
                if not is_wall(grid[ny][nx], door_open):
                    seen.add((nx, ny))
                    q.append((nx, ny))
    return seen

start = (spawn1['x'], spawn1['y'])
reach_closed = bfs(start, False)
reach_open = bfs(start, True)

ok = True
checks = {
    'shears': [(shears['x'], shears['y'])],
    'monsterSpawns': [(p['x'], p['y']) for p in monsterSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'patrolPoints': [(p['x'], p['y']) for p in patrolPoints],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach_closed:
            print('UNREACHABLE(closed)', name, p)
            ok = False

if (exitTrigger['x'], exitTrigger['y']) in reach_closed:
    print('WARNING exit reachable closed')
    ok = False
if (exitTrigger['x'], exitTrigger['y']) not in reach_open:
    print('EXIT unreachable open')
    ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'monsters', len(monsterSpawns), 'crates', len(crateSpawns), 'grass', GRASS_COUNT)

with open('C:/claude_p/goofy-horror/.scratch/level21_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level21_data.json')
