import json, random
random.seed(1414)

ROOM_W, ROOM_H, COR = 11, 7, 4   # ~25% smaller in each direction than the original 16x10 rooms
GC, GR = 10, 8  # 80 rooms -- 4x the room count/area of the original 5x4

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
rng = random.Random(14)

heater_room = rng.sample(non_spawn_exit, 1)[0]
hx0, hy0 = room_origin(*heater_room)
heater = {'x': hx0 + ROOM_W // 2, 'y': hy0 + ROOM_H // 2}
grid[heater['y']][heater['x']] = 'H'

# ---- the secret: a sealed pocket in the wall below a room, behind a wall of
# packed snow ('M') that only melts once the heater's on. A flamethrower
# is lying inside.
rng3 = random.Random(1414)
alcove_candidates = [rc for rc in non_spawn_exit if rc != heater_room and rc[0] < GR - 2 and rc[1] < GC - 2 and rc[0] >= 1 and rc[1] >= 1]
alcove_room = rng3.choice(alcove_candidates)
ax0, ay0 = room_origin(*alcove_room)
snow_wall = [(ax0 + ROOM_W - 2, ay0 + ROOM_H), (ax0 + ROOM_W - 1, ay0 + ROOM_H)]
alcove_floor = [(x, y) for x in range(ax0 + ROOM_W - 3, ax0 + ROOM_W) for y in (ay0 + ROOM_H + 1, ay0 + ROOM_H + 2)]
for (x, y) in snow_wall:
    assert grid[y][x] == '#', (x, y)
    grid[y][x] = 'M'
for (x, y) in alcove_floor:
    assert grid[y][x] == '#', (x, y)
    grid[y][x] = '.'
flamethrower = {'x': ax0 + ROOM_W - 2, 'y': ay0 + ROOM_H + 1}
print('alcove under room', alcove_room, 'flamethrower', flamethrower)

monster_rooms = rng.sample([rc for rc in non_spawn_exit if rc != heater_room], 2)
monsterSpawns = []
for (r, c) in monster_rooms:
    x0, y0 = room_origin(r, c)
    monsterSpawns.append({'x': x0 + ROOM_W // 2, 'y': y0 + 3})

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
for dx in range(-1, 2):
    for dy in range(-1, 2):
        reserved.add((heater['x'] + dx, heater['y'] + dy))
for m in monsterSpawns:
    reserved.add((m['x'], m['y']))
for p in patrolPoints:
    reserved.add((p['x'], p['y']))
# keep the approach to the snow wall clear of crates
for x in range(ax0 + ROOM_W - 4, ax0 + ROOM_W):
    for y in range(ay0 + ROOM_H - 3, ay0 + ROOM_H):
        reserved.add((x, y))

# big 2x2 crates
bigcrate_rooms = rng.sample(non_spawn_exit, 16)
bigCrateSpawns = []
for (r, c) in bigcrate_rooms:
    x0, y0 = room_origin(r, c)
    bx = x0 + 3 + rng.randint(0, ROOM_W - 7)
    by = y0 + 2 + rng.randint(0, ROOM_H - 5)
    footprint_ok = all(grid[by + dy][bx + dx] == '.' and (bx + dx, by + dy) not in reserved
                       for dx in (0, 1) for dy in (0, 1))
    if not footprint_ok:
        continue
    for dx in (0, 1):
        for dy in (0, 1):
            grid[by + dy][bx + dx] = 'C'
            reserved.add((bx + dx, by + dy))
    bigCrateSpawns.append({'x': bx, 'y': by})

all_room_tiles = []
for (r, c) in rooms:
    if (r, c) == EXIT_ROOM:
        continue
    x0, y0 = room_origin(r, c)
    for y in range(y0 + 1, y0 + ROOM_H - 1):
        for x in range(x0 + 1, x0 + ROOM_W - 1):
            if grid[y][x] == '.' and (x, y) not in reserved:
                all_room_tiles.append((x, y))

rng2 = random.Random(28)
rng2.shuffle(all_room_tiles)
CRATE_COUNT = 42
crateSpawns = [{'x': x, 'y': y} for (x, y) in all_room_tiles[:CRATE_COUNT]]
for t in all_room_tiles[:CRATE_COUNT]:
    reserved.add(t)

# wire-covered floor tiles -- decorative, scattered through the remaining
# open floor
remaining = [t for t in all_room_tiles[CRATE_COUNT:] if t not in reserved]
rng2.shuffle(remaining)
wire_tiles = remaining[:600]
for (x, y) in wire_tiles:
    grid[y][x] = 'W'
    reserved.add((x, y))

# snow-covered floor tiles -- dense coverage across most of the remaining
# open floor, so the heater has something real to visibly melt
remaining2 = [t for t in all_room_tiles if t not in reserved]
snow_tiles = remaining2  # everything left over
for (x, y) in snow_tiles:
    grid[y][x] = 'N'

# ---- BFS verification ----
from collections import deque

def is_wall(ch, door_open):
    if ch == '#' or ch == 'C':
        return True
    if ch == 'M':
        return not door_open
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
    'heater': [(heater['x'], heater['y'])],
    'monsterSpawns': [(m['x'], m['y']) for m in monsterSpawns],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'patrolPoints': [(p['x'], p['y']) for p in patrolPoints],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach_closed:
            print('UNREACHABLE(closed)', name, p)
            ok = False

for c in bigCrateSpawns:
    x, y = c['x'], c['y']
    neighbors = [(x - 1, y), (x + 2, y), (x, y - 1), (x, y + 2)]
    if not any(n in reach_closed for n in neighbors):
        print('BIGCRATE UNREACHABLE AREA', c)
        ok = False

if (flamethrower['x'], flamethrower['y']) in reach_closed:
    print('FLAMETHROWER reachable before the heater'); ok = False
if (flamethrower['x'], flamethrower['y']) not in reach_open:
    print('FLAMETHROWER unreachable after the heater'); ok = False
if (exitTrigger['x'], exitTrigger['y']) in reach_closed:
    print('WARNING exit reachable closed')
    ok = False
if (exitTrigger['x'], exitTrigger['y']) not in reach_open:
    print('EXIT unreachable open')
    ok = False
print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'bigcrates', len(bigCrateSpawns),
      'wire', len(wire_tiles), 'snow', len(snow_tiles))

def pts(lst): return ', '.join('{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst)
def wrap(lst, per):
    items = ['{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst]
    return (',' + chr(10) + '      ').join(', '.join(items[i:i + per]) for i in range(0, len(items), per))
assert ok
js = '''(function () {
  // Legend: # wall, . floor, W wire-covered floor (decorative only), N
  // snow-covered floor (the heater melts 10% of these on activation),
  // S safe zone (spawn, monsters can't enter), H the heater switch
  // (walk onto it to turn it on), C big 2x2 crate (solid, can't be
  // opened), D door (blocks until the heater's on), M a wall of packed
  // snow (solid until the heater's on, then it melts away -- it hides a
  // secret pocket with the flamethrower), E exit room floor, X exit trigger.
  //
  // A 10x8 room lattice (80 rooms) of 11x7-tile rooms -- about 25%
  // smaller in each direction than the original 16x10 rooms -- with a
  // single gated entrance into the exit room.
  const grid = [
'''
for row in grid: js += "    '" + ''.join(row) + "'," + chr(10)
js += '''  ];

  window.LEVEL14 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: %d, y: %d },
    spawn2: { x: %d, y: %d },
    monsterSpawns: [
      %s,
    ],
    heater: { x: %d, y: %d },
    exitTrigger: { x: %d, y: %d },
    safeZone: { x0: %d, y0: %d, x1: %d, y1: %d },
    flamethrower: { x: %d, y: %d },
    patrolPoints: [
      %s,
    ],
    crateSpawns: [
      %s,
    ],
    bigCrateSpawns: [
      %s,
    ],
  };
})();
''' % (spawn1['x'], spawn1['y'], spawn2['x'], spawn2['y'], pts(monsterSpawns), heater['x'], heater['y'],
       exitTrigger['x'], exitTrigger['y'], safeZone['x0'], safeZone['y0'], safeZone['x1'], safeZone['y1'],
       flamethrower['x'], flamethrower['y'], wrap(patrolPoints, 6), wrap(crateSpawns, 6), wrap(bigCrateSpawns, 6))
open('C:/claude_p/goofy-horror/levels/level14/level.js', 'w', newline=chr(10)).write(js)
print('wrote level.js', len(js))
