import json, random
from collections import deque

rng = random.Random(2902)

# Rework, direct request: "10x more buildings... ziplines you can go back
# and forth on them... basically make it a zipline maze... buildings 50%
# smaller". A 8x5 grid of 40 small rooftops (was 4 in a row), each one a
# real orthogonal grid neighbor of up to four others, joined into a true
# maze -- a randomized spanning tree over grid-adjacency edges, so there
# is exactly one zipline route between any two platforms, no shortcuts,
# no loops. Every zipline is ridden from EITHER end (js/game29.js checks
# both anchors), unlike the old one-way-only version.
# Chars: '#' void/sky, '.' rooftop floor, 'S' safe zone, 'C' 2x2 big
# crate, 'F' 2x2 fan, 'Z' a zipline anchor tile, 'V' the elevator floor.
TILE = 32
GRID_COLS, GRID_ROWS = 8, 5
PLATFORM_W, PLATFORM_H = 24, 18  # 50% smaller than the original 48x36
GAP = 14
MARGIN = 8

def make_platform(col, row):
    x0 = MARGIN + col * (PLATFORM_W + GAP)
    y0 = MARGIN + row * (PLATFORM_H + GAP)
    return {'x0': x0, 'y0': y0, 'x1': x0 + PLATFORM_W - 1, 'y1': y0 + PLATFORM_H - 1}

PLATFORMS = [make_platform(c, r) for r in range(GRID_ROWS) for c in range(GRID_COLS)]
def pid(col, row):
    return row * GRID_COLS + col

COLS = PLATFORMS[-1]['x1'] + MARGIN + 1
ROWS = PLATFORMS[-1]['y1'] + MARGIN + 1

grid = [['#'] * COLS for _ in range(ROWS)]
def set_rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

for p in PLATFORMS:
    set_rect(p['x0'], p['y0'], p['x1'], p['y1'], '.')

# ---- candidate grid-adjacency edges (right & down neighbors only, so
# every edge is a real orthogonal zipline between two touching sides --
# every platform in the same row shares an identical y-extent, and every
# platform in the same column shares an identical x-extent, so an
# adjacent pair's anchor range is just that platform's own range).
candidate_edges = []
for row in range(GRID_ROWS):
    for col in range(GRID_COLS):
        a = pid(col, row)
        if col + 1 < GRID_COLS:
            candidate_edges.append((a, pid(col + 1, row), 'h'))
        if row + 1 < GRID_ROWS:
            candidate_edges.append((a, pid(col, row + 1), 'v'))
rng.shuffle(candidate_edges)

parent = list(range(len(PLATFORMS)))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra == rb:
        return False
    parent[ra] = rb
    return True

ziplines = []
for a, b, direction in candidate_edges:
    if union(a, b):
        pa, pb = PLATFORMS[a], PLATFORMS[b]
        if direction == 'h':
            y = rng.randint(pa['y0'] + 2, pa['y1'] - 2)
            x0, y0, x1, y1 = pa['x1'], y, pb['x0'], y
        else:
            x = rng.randint(pa['x0'] + 2, pa['x1'] - 2)
            x0, y0, x1, y1 = x, pa['y1'], x, pb['y0']
        grid[y0][x0] = 'Z'
        grid[y1][x1] = 'Z'
        ziplines.append({'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1})

# ---- spawn + safe zone, the (0,0) platform.
p0 = PLATFORMS[pid(0, 0)]
sx0 = p0['x0'] + 2
sy0 = p0['y0'] + (PLATFORM_H // 2) - 2
set_rect(sx0, sy0, sx0 + 3, sy0 + 3, 'S')
spawn1 = {'x': sx0 + 1, 'y': sy0 + 2}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 2}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + 3, 'y1': sy0 + 3}

reserved = set()
for y in range(safeZone['y0'] - 1, safeZone['y1'] + 2):
    for x in range(safeZone['x0'] - 1, safeZone['x1'] + 2):
        reserved.add((x, y))

# ---- the elevator, the far corner platform, opposite the spawn.
pLast = PLATFORMS[pid(GRID_COLS - 1, GRID_ROWS - 1)]
evx0 = pLast['x0'] + (PLATFORM_W // 2) - 2
evy0 = pLast['y0'] + (PLATFORM_H // 2) - 2
set_rect(evx0, evy0, evx0 + 3, evy0 + 3, 'V')
elevator = {'x0': evx0, 'y0': evy0, 'x1': evx0 + 3, 'y1': evy0 + 3}
for y in range(evy0 - 1, evy0 + 5):
    for x in range(evx0 - 1, evx0 + 5):
        reserved.add((x, y))

def random_spot(x0, y0, x1, y1, floor_ch, margin=2):
    for _ in range(200):
        x = rng.randint(x0 + margin, x1 - margin)
        y = rng.randint(y0 + margin, y1 - margin)
        if grid[y][x] == floor_ch and (x, y) not in reserved:
            return x, y
    return None

# ---- patrol points, every platform (even the ones with no monster on
# them get a set -- cheap, and keeps js/game29.js's own per-platform
# lookup simple). Computed after the ziplines are carved in, since a
# corner candidate can land on a zipline anchor tile at this small a
# platform size -- nudged toward the platform's own center until it
# lands back on real floor.
def safe_pt(x, y, p):
    if grid[y][x] == '.':
        return {'x': x, 'y': y}
    cx, cy = (p['x0'] + p['x1']) // 2, (p['y0'] + p['y1']) // 2
    nx, ny = x, y
    for _ in range(8):
        nx += 1 if cx > nx else (-1 if cx < nx else 0)
        ny += 1 if cy > ny else (-1 if cy < ny else 0)
        if grid[ny][nx] == '.':
            return {'x': nx, 'y': ny}
    return {'x': cx, 'y': cy}

SPECIAL_PLATFORMS = {pid(0, 0), pid(GRID_COLS - 1, GRID_ROWS - 1)}
platformPatrolPoints = []
for idx, p in enumerate(PLATFORMS):
    pts = [
        safe_pt(p['x0'] + 2, p['y0'] + 2, p),
        safe_pt(p['x1'] - 2, p['y0'] + 2, p),
        safe_pt(p['x0'] + 2, p['y1'] - 2, p),
        safe_pt(p['x1'] - 2, p['y1'] - 2, p),
    ]
    if idx not in SPECIAL_PLATFORMS:
        # the spawn and elevator platforms have their own fixture sitting
        # in the center (the safe zone / the elevator pad itself), so
        # just the four corners for those two -- a center point there
        # would have nowhere real to nudge to.
        cx, cy = (p['x0'] + p['x1']) // 2, (p['y0'] + p['y1']) // 2
        pts.append(safe_pt(cx, cy, p))
    platformPatrolPoints.append(pts)
for pts in platformPatrolPoints:
    for pt in pts:
        reserved.add((pt['x'], pt['y']))

# ---- the swarm -- still 15 tiny Grotesques total, but now scattered
# across a random 15 of the 40 platforms (never the spawn or elevator
# platform) instead of 4 per platform -- most platforms in the maze are
# empty, the threat is getting lost and boxed in, not density.
eligible = [i for i in range(len(PLATFORMS)) if i != pid(0, 0) and i != pid(GRID_COLS - 1, GRID_ROWS - 1)]
rng.shuffle(eligible)
monsterSpawns = []
for i in eligible[:15]:
    p = PLATFORMS[i]
    spot = random_spot(p['x0'], p['y0'], p['x1'], p['y1'], '.', margin=3)
    if spot:
        monsterSpawns.append({'x': spot[0], 'y': spot[1], 'platform': i})
        reserved.add(spot)

# ---- big 2x2 crates and fans, Level 27's own deco, on a random subset
# of platforms (every platform would be too dense at this scale).
bigCrateSpawns = []
fanSpawns = []
def scatter_big(x0, y0, x1, y1, floor_ch, count, ch):
    out = []
    for _ in range(count):
        for _attempt in range(40):
            x = rng.randint(x0, x1 - 1)
            y = rng.randint(y0, y1 - 1)
            cells = [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
            if any((cx2, cy2) in reserved or grid[cy2][cx2] != floor_ch for (cx2, cy2) in cells):
                continue
            for (cx2, cy2) in cells:
                grid[cy2][cx2] = ch
                reserved.add((cx2, cy2))
            out.append({'x': x, 'y': y})
            break
    return out

for p in PLATFORMS:
    if rng.random() < 0.4:
        bigCrateSpawns += scatter_big(p['x0'] + 1, p['y0'] + 1, p['x1'] - 1, p['y1'] - 1, '.', 1, 'C')
    if rng.random() < 0.3:
        fanSpawns += scatter_big(p['x0'] + 1, p['y0'] + 1, p['x1'] - 1, p['y1'] - 1, '.', 1, 'F')

def crate_candidates(x0, y0, x1, y1, floor_ch):
    out = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if grid[y][x] == floor_ch and (x, y) not in reserved:
                out.append((x, y))
    return out

cands = []
for p in PLATFORMS:
    cands += crate_candidates(p['x0'], p['y0'], p['x1'], p['y1'], '.')
rng.shuffle(cands)
CRATE_COUNT = min(len(cands), 60)
crateSpawns = [{'x': x, 'y': y} for (x, y) in cands[:CRATE_COUNT]]

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'ziplines': ziplines, 'elevator': elevator,
    'monsterSpawns': monsterSpawns, 'platformPatrolPoints': platformPatrolPoints,
    'bigCrateSpawns': bigCrateSpawns, 'fanSpawns': fanSpawns,
    'crateSpawns': crateSpawns,
}

# ---- connectivity check -- platform (0,0) only, on foot; ziplines are a
# scripted ride, not part of the walkable graph. Confirm everything on
# that platform is reachable, every patrol point/monster/crate sits on a
# real floor tile, and the maze itself is a single connected component
# (one zipline fewer than there are platforms, since it's a spanning
# tree over all 40).
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
if (elevator['x0'], elevator['y0']) in reach:
    print('ELEVATOR REACHABLE ON FOOT (should not be)')
    ok = False
for pts in platformPatrolPoints:
    for pt in pts:
        if grid_strs[pt['y']][pt['x']] != '.':
            print('PATROL POINT NOT ON FLOOR', pt)
            ok = False
for m in monsterSpawns:
    if grid_strs[m['y']][m['x']] != '.':
        print('MONSTER NOT ON FLOOR', m)
        ok = False
for c in crateSpawns:
    if grid_strs[c['y']][c['x']] != '.':
        print('CRATE NOT ON FLOOR', c)
        ok = False
if len(ziplines) != len(PLATFORMS) - 1:
    print('MAZE NOT FULLY CONNECTED -- expected', len(PLATFORMS) - 1, 'ziplines, got', len(ziplines))
    ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'platforms', len(PLATFORMS),
      'ziplines', len(ziplines), 'monsters', len(monsterSpawns),
      'bigCrates', len(bigCrateSpawns), 'fans', len(fanSpawns), 'crates', len(crateSpawns))

with open('C:/claude_p/goofy-horror/.scratch/level29_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level29_data.json')
