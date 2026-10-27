import json, random

ROOM_W, ROOM_H, COR = 16, 9, 4
GC, GR = 5, 4  # 20 rooms, same scope as the original (pre-resize) Level 16/17

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

SPAWN_ROOM = (0, 0)
EXIT_ROOM = (GR - 1, GC - 1)

# The exit room sits at a grid corner, so it structurally touches 2
# neighbors -- only the FIRST edge found touching it becomes the single
# gated door; the other edge is simply never carved at all, so the exit
# room has exactly one physical entrance instead of two separately-gated
# ones both driven by the same unlock flag (same fix applied to every
# other room-lattice level on this site).
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
rng = random.Random(1919)

# 3 storm drains, each in its own room, floor-mounted (center of room,
# no wall-adjacency needed -- unlike Level 17's wall pipes, a drain sits
# in the floor).
drain_rooms = rng.sample(non_spawn_exit, 3)
drains = []
for (r, c) in drain_rooms:
    x0, y0 = room_origin(r, c)
    dx, dy = x0 + ROOM_W // 2, y0 + ROOM_H // 2
    grid[dy][dx] = 'V'
    drains.append({'x': dx, 'y': dy})

# 10 tiny eels, spread across distinct rooms away from spawn.
eel_rooms_pool = [rc for rc in non_spawn_exit if rc not in drain_rooms]
eel_rooms = (eel_rooms_pool * 2)[:10] if len(eel_rooms_pool) < 10 else rng.sample(eel_rooms_pool, 10)
rng.shuffle(eel_rooms)
monsterSpawns = []
for i, (r, c) in enumerate(eel_rooms):
    x0, y0 = room_origin(r, c)
    # offset a little within the room so eels sharing a room don't stack
    ox = 4 + (i % 3) * 4
    oy = 3 + (i % 2) * 3
    monsterSpawns.append({'x': x0 + ox, 'y': y0 + oy})

reserved = set()
for y in range(sy0 - 1, sy0 + 7):
    for x in range(sx0 - 1, sx0 + 7):
        reserved.add((x, y))
for d in drains:
    reserved.add((d['x'], d['y']))
for m in monsterSpawns:
    reserved.add((m['x'], m['y']))

# coral, same decoration as Level 18
coral_candidates = []
for (r, c) in rooms:
    x0, y0 = room_origin(r, c)
    for y in range(y0, y0 + ROOM_H):
        for x in range(x0, x0 + ROOM_W):
            if grid[y][x] == '.' and (x, y) not in reserved:
                coral_candidates.append((x, y))
rng.shuffle(coral_candidates)
coral_count = 220
for (x, y) in coral_candidates[:coral_count]:
    grid[y][x] = 'R'

remaining = [t for t in coral_candidates[coral_count:] if t not in reserved]
rng.shuffle(remaining)
crateSpawns = [{'x': x, 'y': y} for (x, y) in remaining[:28]]

out = {
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger, 'monsterSpawns': monsterSpawns,
    'drains': drains, 'crateSpawns': crateSpawns,
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
    'drains': [(d['x'], d['y']) for d in drains],
    'monsterSpawns': [(m['x'], m['y']) for m in monsterSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
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

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'drains', len(drains), 'eels', len(monsterSpawns), 'crates', len(crateSpawns))

with open('C:/claude_p/goofy-horror/.scratch/level19_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level19_data.json')
