import json, random

ROOM_W, ROOM_H, COR = 16, 9, 4
GC, GR = 8, 10  # 80 rooms -- 4x the room count/area of the original 4x5 layout

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

# Flipped from Level 16: spawn bottom-right, exit top-left.
SPAWN_ROOM = (GR - 1, GC - 1)
EXIT_ROOM = (0, 0)

# The exit room sits at a grid corner, so it structurally touches 2
# neighbors -- only the FIRST edge found touching it becomes the single
# gated door; the other edge is simply never carved at all, so the exit
# room has exactly one physical entrance instead of two separately-gated
# ones both driven by the same unlock flag.
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
rng = random.Random(1717)

# 3 pipes to weld, plus one welding-gun pickup, all in separate rooms.
# Each pipe sits against one of its room's actual walls (not floating in
# the middle of the floor) so it can be drawn sticking out of that wall --
# found by scanning for an interior floor tile with a solid '#' neighbor,
# not just assumed from room geometry, since a room's "wall" side can
# actually be a corridor/door opening depending on which neighbors it has.
def wall_adjacent_candidates(r, c):
    x0, y0 = room_origin(r, c)
    cands = []
    for y in range(y0, y0 + ROOM_H):
        for x in range(x0, x0 + ROOM_W):
            if grid[y][x] != '.':
                continue
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                if grid[y + dy][x + dx] == '#':
                    cands.append((x, y))
                    break
    return cands

pipe_rooms = rng.sample(non_spawn_exit, 3)
pipes = []
for (r, c) in pipe_rooms:
    cands = wall_adjacent_candidates(r, c)
    px, py = rng.choice(cands)
    grid[py][px] = 'P'
    pipes.append({'x': px, 'y': py})

gun_room = rng.choice([rc for rc in non_spawn_exit if rc not in pipe_rooms])
gx0, gy0 = room_origin(*gun_room)
weldingGun = {'x': gx0 + ROOM_W // 2, 'y': gy0 + ROOM_H // 2}
grid[weldingGun['y']][weldingGun['x']] = 'U'

monster_room = rng.choice([rc for rc in non_spawn_exit if rc not in pipe_rooms and rc != gun_room])
mx0, my0 = room_origin(*monster_room)
monsterSpawn = {'x': mx0 + ROOM_W // 2, 'y': my0 + ROOM_H // 2}

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
for p in pipes:
    reserved.add((p['x'], p['y']))
reserved.add((weldingGun['x'], weldingGun['y']))
reserved.add((monsterSpawn['x'], monsterSpawn['y']))
for p in patrolPoints:
    reserved.add((p['x'], p['y']))

# seaweed, same decoration as Level 16
seaweed_candidates = []
for (r, c) in rooms:
    x0, y0 = room_origin(r, c)
    for y in range(y0, y0 + ROOM_H):
        for x in range(x0, x0 + ROOM_W):
            if grid[y][x] == '.' and (x, y) not in reserved:
                seaweed_candidates.append((x, y))
rng.shuffle(seaweed_candidates)
SEAWEED_COUNT = 220 * 4
for (x, y) in seaweed_candidates[:SEAWEED_COUNT]:
    grid[y][x] = 'G'

remaining = [t for t in seaweed_candidates[SEAWEED_COUNT:] if t not in reserved]
rng.shuffle(remaining)
crateSpawns = [{'x': x, 'y': y} for (x, y) in remaining[:28 * 4]]

out = {
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger, 'monsterSpawn': monsterSpawn,
    'pipes': pipes, 'weldingGun': weldingGun,
    'patrolPoints': patrolPoints, 'crateSpawns': crateSpawns,
}

from collections import deque

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
    'pipes': [(p['x'], p['y']) for p in pipes],
    'weldingGun': [(weldingGun['x'], weldingGun['y'])],
    'monsterSpawn': [(monsterSpawn['x'], monsterSpawn['y'])],
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

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'pipes', len(pipes), 'crates', len(crateSpawns))

with open('C:/claude_p/goofy-horror/.scratch/level17_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level17_data.json')
