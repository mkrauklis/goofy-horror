import json, random
from collections import deque

rng = random.Random(2202)

COLS, ROWS = 184, 135  # 1.5x bigger: ~1.5x each dimension vs the original 150x110
grid = [['#'] * COLS for _ in range(ROWS)]

# ---- random, irregularly-sized rooms (NOT a uniform grid lattice like
# Level 21) connected by a pure spanning tree of corridors -- no loops, so
# the layout reads as a winding, mazey building instead of a clean block
# grid. A handful of rooms are specifically forced flush against each of
# the 4 outer edges so there's always real wall for the windows to sit in.
rooms = []  # each: {'x0','y0','w','h'}

def overlaps(x0, y0, w, h, pad=2):
    for r in rooms:
        if (x0 - pad < r['x0'] + r['w'] and x0 + w + pad > r['x0']
                and y0 - pad < r['y0'] + r['h'] and y0 + h + pad > r['y0']):
            return True
    return False

def try_place(x0, y0, w, h):
    if x0 < 1 or y0 < 1 or x0 + w > COLS - 1 or y0 + h > ROWS - 1:
        return False
    if overlaps(x0, y0, w, h):
        return False
    rooms.append({'x0': x0, 'y0': y0, 'w': w, 'h': h})
    return True

# A few rooms deliberately flush against each boundary, for windows.
for _ in range(5):
    for attempt in range(60):
        w, h = rng.randint(8, 12), rng.randint(6, 10)
        if try_place(1, rng.randint(1, ROWS - h - 1), w, h):
            break
for _ in range(5):
    for attempt in range(60):
        w, h = rng.randint(8, 12), rng.randint(6, 10)
        if try_place(COLS - 1 - w, rng.randint(1, ROWS - h - 1), w, h):
            break
for _ in range(5):
    for attempt in range(60):
        w, h = rng.randint(8, 12), rng.randint(6, 10)
        if try_place(rng.randint(1, COLS - w - 1), 1, w, h):
            break
for _ in range(5):
    for attempt in range(60):
        w, h = rng.randint(8, 12), rng.randint(6, 10)
        if try_place(rng.randint(1, COLS - w - 1), ROWS - 1 - h, w, h):
            break

# General random scatter for the rest of the building -- 1.5x the room
# count to match the 1.5x bigger map area at similar density.
TARGET_ROOMS = 83
attempts = 0
while len(rooms) < TARGET_ROOMS and attempts < 6000:
    attempts += 1
    w = rng.randint(6, 13)
    h = rng.randint(6, 11)
    x0 = rng.randint(1, COLS - w - 1)
    y0 = rng.randint(1, ROWS - h - 1)
    try_place(x0, y0, w, h)

for r in rooms:
    for y in range(r['y0'], r['y0'] + r['h']):
        for x in range(r['x0'], r['x0'] + r['w']):
            grid[y][x] = '.'
    r['cx'] = r['x0'] + r['w'] // 2
    r['cy'] = r['y0'] + r['h'] // 2

def carve_corridor(a, b):
    ax, ay = a['cx'], a['cy']
    bx, by = b['cx'], b['cy']
    if rng.random() < 0.5:
        for x in range(min(ax, bx), max(ax, bx) + 1):
            for yy in range(ay - 1, ay + 2):
                if 0 <= yy < ROWS:
                    grid[yy][x] = '.'
        for y in range(min(ay, by), max(ay, by) + 1):
            for xx in range(bx - 1, bx + 2):
                if 0 <= xx < COLS:
                    grid[y][xx] = '.'
    else:
        for y in range(min(ay, by), max(ay, by) + 1):
            for xx in range(ax - 1, ax + 2):
                if 0 <= xx < COLS:
                    grid[y][xx] = '.'
        for x in range(min(ax, bx), max(ax, bx) + 1):
            for yy in range(by - 1, by + 2):
                if 0 <= yy < ROWS:
                    grid[yy][x] = '.'

# Prim's-style minimum spanning tree over room centers -- every room gets
# exactly one path in from the rest of the building, no loops.
connected = [rooms[0]]
remaining = rooms[1:]
edges = []  # (room, parent) pairs actually carved
while remaining:
    best = None
    best_d = None
    best_parent = None
    for r in remaining:
        for c in connected:
            d = abs(r['cx'] - c['cx']) + abs(r['cy'] - c['cy'])
            if best_d is None or d < best_d:
                best_d = d
                best = r
                best_parent = c
    carve_corridor(best_parent, best)
    edges.append((best, best_parent))
    connected.append(best)
    remaining.remove(best)

parent_of = {id(r): p for (r, p) in edges}

# ---- spawn room: the room placed first among the "general scatter" that's
# roughly central, picked as the one whose room-graph distance (hop count
# through the tree) to the farthest room is largest, so the exit room (the
# single farthest leaf) sits as far from spawn as the tree allows.
room_by_id = {id(r): r for r in rooms}
children = {id(r): [] for r in rooms}
for (r, p) in edges:
    children[id(p)].append(r)

def hop_distances(src):
    dist = {id(src): 0}
    q = deque([src])
    adj = {id(r): [] for r in rooms}
    for (r, p) in edges:
        adj[id(r)].append(p)
        adj[id(p)].append(r)
    while q:
        cur = q.popleft()
        for nb in adj[id(cur)]:
            if id(nb) not in dist:
                dist[id(nb)] = dist[id(cur)] + 1
                q.append(nb)
    return dist

spawn_room = rooms[0]
dist_from_spawn = hop_distances(spawn_room)
exit_room = max(rooms, key=lambda r: dist_from_spawn[id(r)])

# storage room: a leaf (no children) reasonably far from spawn, not the
# exit room itself.
leaf_rooms = [r for r in rooms if not children[id(r)] and r is not exit_room and r is not spawn_room]
leaf_rooms.sort(key=lambda r: -dist_from_spawn[id(r)])
storage_room = leaf_rooms[0] if leaf_rooms else rooms[1]

# Safe zone sized to fit inside the spawn room (capped at 6x6 like Level 21).
sz_w = min(6, spawn_room['w'] - 2)
sz_h = min(6, spawn_room['h'] - 2)
sx0 = spawn_room['cx'] - sz_w // 2
sy0 = spawn_room['cy'] - sz_h // 2
for y in range(sy0, sy0 + sz_h):
    for x in range(sx0, sx0 + sz_w):
        grid[y][x] = 'S'
spawn1 = {'x': sx0 + 1, 'y': sy0 + 1}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 1}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + sz_w - 1, 'y1': sy0 + sz_h - 1}

# Exit room floor + trigger, and the single corridor into it becomes the
# vine gate ('D').
for y in range(exit_room['y0'], exit_room['y0'] + exit_room['h']):
    for x in range(exit_room['x0'], exit_room['x0'] + exit_room['w']):
        grid[y][x] = 'E'
exitTrigger = {'x': exit_room['cx'], 'y': exit_room['cy']}
grid[exitTrigger['y']][exitTrigger['x']] = 'X'

gate_parent = parent_of[id(exit_room)]
# Re-carve that one corridor as 'D' instead of '.' (it was carved '.' above).
gax, gay = gate_parent['cx'], gate_parent['cy']
gbx, gby = exit_room['cx'], exit_room['cy']
gate_tiles = set()
if abs(gax - gbx) >= abs(gay - gby):
    for x in range(min(gax, gbx), max(gax, gbx) + 1):
        for yy in range(gay - 1, gay + 2):
            gate_tiles.add((x, yy))
    for y in range(min(gay, gby), max(gay, gby) + 1):
        for xx in range(gbx - 1, gbx + 2):
            gate_tiles.add((xx, y))
else:
    for y in range(min(gay, gby), max(gay, gby) + 1):
        for xx in range(gax - 1, gax + 2):
            gate_tiles.add((xx, y))
    for x in range(min(gax, gbx), max(gax, gbx) + 1):
        for yy in range(gby - 1, gby + 2):
            gate_tiles.add((x, yy))
# Only tiles strictly between the two room interiors become the gate, so
# the rooms' own floors (on either side) stay plain floor/exit tiles.
def inside(r, x, y):
    return r['x0'] <= x < r['x0'] + r['w'] and r['y0'] <= y < r['y0'] + r['h']

for (x, y) in gate_tiles:
    if grid[y][x] == '.' and not inside(exit_room, x, y) and not inside(gate_parent, x, y):
        grid[y][x] = 'D'

# Lighter, in the storage room.
lighter = {'x': storage_room['cx'], 'y': storage_room['cy']}
grid[lighter['y']][lighter['x']] = 'L'

# ---- monsters: 5 of them, in rooms other than spawn/exit/storage.
other_rooms = [r for r in rooms if r not in (spawn_room, exit_room, storage_room)]
MONSTER_COUNT = 5
monster_rooms = rng.sample(other_rooms, min(MONSTER_COUNT, len(other_rooms)))
monsterSpawns = [{'x': r['cx'], 'y': r['cy']} for r in monster_rooms]

patrolPoints = [{'x': r['cx'], 'y': r['cy']} for r in rooms if r is not exit_room]

reserved = set()
for y in range(sy0 - 1, sy0 + sz_h + 1):
    for x in range(sx0 - 1, sx0 + sz_w + 1):
        reserved.add((x, y))
reserved.add((lighter['x'], lighter['y']))
for p in monsterSpawns:
    reserved.add((p['x'], p['y']))
for p in patrolPoints:
    reserved.add((p['x'], p['y']))

# ---- 2x2 crates, in rooms big enough to take them without blocking the
# room's own doorway -- away from the room center (reserved for patrol/
# monster spawns) and away from the room edges (where corridors meet it).
bigCrateSpawns = []
big_crate_cells = set()
big_candidates = [r for r in rooms if r['w'] >= 6 and r['h'] >= 6 and r not in (spawn_room, exit_room)]
rng.shuffle(big_candidates)
BIG_CRATE_COUNT = 15
for r in big_candidates:
    if len(bigCrateSpawns) >= BIG_CRATE_COUNT:
        break
    bx = rng.randint(r['x0'] + 1, r['x0'] + r['w'] - 3)
    by = rng.randint(r['y0'] + 1, r['y0'] + r['h'] - 3)
    cells = [(bx, by), (bx + 1, by), (bx, by + 1), (bx + 1, by + 1)]
    if any((x, y) in reserved or grid[y][x] != '.' for (x, y) in cells):
        continue
    for (x, y) in cells:
        grid[y][x] = 'C'
        big_crate_cells.add((x, y))
    bigCrateSpawns.append({'x': bx, 'y': by})

# ---- normal single-tile crates, scattered across remaining open floor.
crate_candidates = []
for r in rooms:
    for y in range(r['y0'], r['y0'] + r['h']):
        for x in range(r['x0'], r['x0'] + r['w']):
            if grid[y][x] == '.' and (x, y) not in reserved and (x, y) not in big_crate_cells:
                crate_candidates.append((x, y))
rng.shuffle(crate_candidates)
CRATE_COUNT = min(len(crate_candidates), 225)
crateSpawns = [{'x': x, 'y': y} for (x, y) in crate_candidates[:CRATE_COUNT]]

# ---- windows: along boundary wall segments that have open floor just
# inside them (the rooms deliberately placed flush against each edge
# above guarantee several of these), light shining in the direction
# pointing away from the wall into the room.
windows = []
# Row/col index 0 (and COLS-1/ROWS-1) is the true universe frame -- a room
# placed flush (x0/y0 == 1, or x0+w/y0+h == COLS-1/ROWS-1) leaves floor
# right at index 1 (or COLS-2/ROWS-2), with the frame itself as its wall.
for x in range(2, COLS - 2):
    if grid[0][x] == '#' and grid[1][x] == '.':
        windows.append({'x': x, 'y': 0, 'dir': 'S'})
for x in range(2, COLS - 2):
    if grid[ROWS - 1][x] == '#' and grid[ROWS - 2][x] == '.':
        windows.append({'x': x, 'y': ROWS - 1, 'dir': 'N'})
for y in range(2, ROWS - 2):
    if grid[y][0] == '#' and grid[y][1] == '.':
        windows.append({'x': 0, 'y': y, 'dir': 'E'})
for y in range(2, ROWS - 2):
    if grid[y][COLS - 1] == '#' and grid[y][COLS - 2] == '.':
        windows.append({'x': COLS - 1, 'y': y, 'dir': 'W'})

# Thin the found candidates down to tidy, spaced-out clusters of 3 rather
# than lighting up every single boundary tile that happens to qualify.
def thin(ws, min_gap=6):
    kept = []
    last = None
    key = 'x' if ws and ws[0]['dir'] in ('S', 'N') else 'y'
    for w in ws:
        if last is None or w[key] - last >= min_gap:
            kept.append(w)
            last = w[key]
    return kept

windows_by_dir = {}
for w in windows:
    windows_by_dir.setdefault(w['dir'], []).append(w)
final_windows = []
for d, ws in windows_by_dir.items():
    key = 'x' if d in ('S', 'N') else 'y'
    ws.sort(key=lambda w: w[key])
    thinned = thin(ws)
    for w in thinned:
        # a 3-wide window: the found tile plus its two neighbors along the wall
        for off in (-1, 0, 1):
            if d in ('S', 'N'):
                wx, wy = w['x'] + off, w['y']
            else:
                wx, wy = w['x'], w['y'] + off
            if 0 <= wx < COLS and 0 <= wy < ROWS and grid[wy][wx] == '#':
                final_windows.append({'x': wx, 'y': wy, 'dir': d})
                grid[wy][wx] = 'N'

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger, 'lighter': lighter,
    'monsterSpawns': monsterSpawns,
    'patrolPoints': patrolPoints, 'crateSpawns': crateSpawns,
    'bigCrateSpawns': bigCrateSpawns, 'windows': final_windows,
}

# ---- connectivity verification, same discipline as Level 21's generator.
def is_wall(ch, door_open):
    if ch == '#' or ch == 'N' or ch == 'C':
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
    'lighter': [(lighter['x'], lighter['y'])],
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

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'rooms', len(rooms),
      'monsters', len(monsterSpawns), 'crates', len(crateSpawns),
      'bigCrates', len(bigCrateSpawns), 'windows', len(final_windows))

with open('C:/claude_p/goofy-horror/.scratch/level22_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level22_data.json')
