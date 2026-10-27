import json, random
from collections import deque

rng = random.Random(2401)

# ---- 2x the original 120x60 layout, same computed-adjacency approach as
# gen_level23.py (hand-doubling absolute coordinates leaves a 1-tile gap
# between sections -- see that script's comment for why).
SEC_A_W, SEC_A_H = 86, 112  # 43x56 original, doubled
HALL_LEN, HALL_H = 62, 12   # 31x6 original, doubled

SEC_A = {'x0': 4, 'y0': 4, 'x1': 4 + SEC_A_W - 1, 'y1': 4 + SEC_A_H - 1}
hall_cy = (SEC_A['y0'] + SEC_A['y1']) // 2
HALL = {
    'x0': SEC_A['x1'] + 1, 'x1': SEC_A['x1'] + HALL_LEN,
    'y0': hall_cy - HALL_H // 2, 'y1': hall_cy - HALL_H // 2 + HALL_H - 1,
}
SEC_B = {
    'x0': HALL['x1'] + 1, 'x1': HALL['x1'] + SEC_A_W,
    'y0': SEC_A['y0'], 'y1': SEC_A['y1'],
}
COLS = SEC_B['x1'] + 4
ROWS = SEC_A['y1'] + 4

grid = [['#'] * COLS for _ in range(ROWS)]

def set_rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

# 'B' (conveyor) is open floor for pathing -- moved up here (instead of
# living only next to the final report) so carve_hallway_walls below can
# also use it to sanity-check connectivity as it goes.
def is_wall(ch):
    return ch == '#' or ch == 'N' or ch == 'C' or ch == 'F'

def bfs(start):
    seen = {start}
    q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < COLS and 0 <= ny < ROWS and (nx, ny) not in seen:
                if not is_wall(grid[ny][nx]):
                    seen.add((nx, ny))
                    q.append((nx, ny))
    return seen

set_rect(SEC_A['x0'], SEC_A['y0'], SEC_A['x1'], SEC_A['y1'], '.')
set_rect(SEC_B['x0'], SEC_B['y0'], SEC_B['x1'], SEC_B['y1'], '.')
set_rect(HALL['x0'], HALL['y0'], HALL['x1'], HALL['y1'], '.')

windows = []
wall_n = HALL['y0'] - 1
wall_s = HALL['y1'] + 1
for x in range(HALL['x0'] + 2, HALL['x1'] - 1, 4):
    grid[wall_n][x] = 'N'
    windows.append({'x': x, 'y': wall_n, 'dir': 'S'})
    grid[wall_s][x] = 'N'
    windows.append({'x': x, 'y': wall_s, 'dir': 'N'})

# ---- Safe zone / spawn, in Section A.
sx0, sy0 = SEC_A['x0'] + 3, SEC_A['y0'] + 3
set_rect(sx0, sy0, sx0 + 5, sy0 + 5, 'S')
spawn1 = {'x': sx0 + 1, 'y': sy0 + 1}
spawn2 = {'x': sx0 + 2, 'y': sy0 + 1}
safeZone = {'x0': sx0, 'y0': sy0, 'x1': sx0 + 5, 'y1': sy0 + 5}

# ---- Exit, in Section B, far corner -- gated behind the 3 gears this time.
ex, ey = SEC_B['x1'] - 4, SEC_B['y1'] - 4
set_rect(ex - 2, ey - 2, ex + 2, ey + 2, 'E')
grid[ey][ex] = 'X'
exitTrigger = {'x': ex, 'y': ey}

reserved = set()
for y in range(safeZone['y0'] - 2, safeZone['y1'] + 3):
    for x in range(safeZone['x0'] - 2, safeZone['x1'] + 3):
        reserved.add((x, y))
for y in range(ey - 3, ey + 4):
    for x in range(ex - 3, ex + 4):
        reserved.add((x, y))

def random_floor_spot(room, margin=3, h=1):
    for _ in range(200):
        x = rng.randint(room['x0'] + margin, room['x1'] - margin)
        y = rng.randint(room['y0'] + margin, room['y1'] - margin - (h - 1))
        cells = [(x, y + dy) for dy in range(h)]
        if all(grid[cy][cx] == '.' and (cx, cy) not in reserved for (cx, cy) in cells):
            return x, y
    return None

# ---- Shelves: same as Level 23 -- count quadrupled (24/room, up from 6)
# to match the ~4x floor area each section gets from the 2x resize.
shelfSpawns = []
for room in (SEC_A, SEC_B):
    for _ in range(24):
        spot = random_floor_spot(room, h=3)
        if not spot:
            continue
        x, y = spot
        for dy in range(3):
            grid[y + dy][x] = 'F'
            reserved.add((x, y + dy))
        shelfSpawns.append({'x': x, 'y': y})

# ---- 2x2 big crates. Count quadrupled (20/room, up from 5).
bigCrateSpawns = []
for room in (SEC_A, SEC_B):
    for _ in range(20):
        for _attempt in range(50):
            x = rng.randint(room['x0'] + 2, room['x1'] - 3)
            y = rng.randint(room['y0'] + 2, room['y1'] - 3)
            cells = [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
            if any((cx, cy) in reserved or grid[cy][cx] != '.' for (cx, cy) in cells):
                continue
            for (cx, cy) in cells:
                grid[cy][cx] = 'C'
                reserved.add((cx, cy))
            bigCrateSpawns.append({'x': x, 'y': y})
            break

# ---- Conveyor belts: 2 runs per section now (up from 1), each 12 tiles
# long (up from 8) to match the bigger rooms, carrying anyone standing on
# them along 'dir' at a slow 0.5x player speed. Grid char 'B' (still
# plain walkable floor for BFS/connectivity -- the push is extra, not a
# different surface).
conveyorSpawns = []
def place_conveyor(room, dir_, length=12):
    for _attempt in range(80):
        if dir_ in ('E', 'W'):
            x = rng.randint(room['x0'] + 3, room['x1'] - 3 - length)
            y = rng.randint(room['y0'] + 3, room['y1'] - 3)
            cells = [(x + i, y) for i in range(length)]
        else:
            x = rng.randint(room['x0'] + 3, room['x1'] - 3)
            y = rng.randint(room['y0'] + 3, room['y1'] - 3 - length)
            cells = [(x, y + i) for i in range(length)]
        if any((cx, cy) in reserved or grid[cy][cx] != '.' for (cx, cy) in cells):
            continue
        for (cx, cy) in cells:
            grid[cy][cx] = 'B'
            reserved.add((cx, cy))
            conveyorSpawns.append({'x': cx, 'y': cy, 'dir': dir_})
        return True
    return False

place_conveyor(SEC_A, 'E')
place_conveyor(SEC_A, 'S')
place_conveyor(SEC_B, 'S')
place_conveyor(SEC_B, 'W')

# ---- 3 gears to spin (5s hold each) -- the way out of this level,
# spread one per section plus one in the hallway so you can't camp one
# room and ignore the rest.
gearSpawns = []
gA = random_floor_spot(SEC_A, margin=4)
gB = random_floor_spot(SEC_B, margin=4)
gearSpawns.append({'x': gA[0], 'y': gA[1]})
gearSpawns.append({'x': gB[0], 'y': gB[1]})
gearSpawns.append({'x': (HALL['x0'] + HALL['x1']) // 2 - 3, 'y': HALL['y0']})
for g in gearSpawns:
    reserved.add((g['x'], g['y']))

# ---- 2 Sentries, one per section. Sight-based roamers (same traits as
# Level 22's Kindling, just 15% slower -- see js/game24.js), so they need
# a real patrol route this time instead of a single fixed spot. Defined
# here (before hallway carving below) so carving can sanity-check against
# these spawn/route points too, not just the exit and gears.
monsterSpawns = [
    {'x': SEC_A['x1'] - 10, 'y': SEC_A['y1'] - 10},
    {'x': SEC_B['x0'] + 10, 'y': SEC_B['y0'] + 10},
]
patrolPoints = [
    {'x': SEC_A['x0'] + SEC_A_W // 4, 'y': SEC_A['y0'] + SEC_A_H // 4},
    {'x': SEC_A['x1'] - SEC_A_W // 4, 'y': SEC_A['y1'] - SEC_A_H // 4},
    {'x': (HALL['x0'] + HALL['x1']) // 2, 'y': (HALL['y0'] + HALL['y1']) // 2},
    {'x': SEC_B['x0'] + SEC_A_W // 4, 'y': SEC_B['y0'] + SEC_A_H // 4},
    {'x': SEC_B['x1'] - SEC_A_W // 4, 'y': SEC_B['y1'] - SEC_A_H // 4},
]

# ---- Random interior hallway walls, on direct request ("make the
# gearworks have a bunch of random hallways") -- each section was just
# one big open box before; this partitions it with random wall segments
# (each leaving a 3-5 tile gap as its own doorway) so it reads as a
# cluster of rooms linked by hallways instead. Every segment is placed
# then immediately connectivity-checked against every spawn/route/item
# point already defined above -- plus already-placed shelves/crates/
# conveyors/gears, which a wall segment skips over rather than overwrite
# -- and reverted on the spot if it would wall anything off.
def all_check_points():
    # shelfSpawns/bigCrateSpawns are deliberately excluded -- their anchor
    # tile is itself solid furniture ('F'/'C', both blocking), not floor,
    # so it was never reachable even before any wall carving and isn't a
    # meaningful connectivity check.
    pts = [(exitTrigger['x'], exitTrigger['y'])]
    pts += [(p['x'], p['y']) for p in monsterSpawns]
    pts += [(p['x'], p['y']) for p in patrolPoints]
    pts += [(g['x'], g['y']) for g in gearSpawns]
    pts += [(c['x'], c['y']) for c in conveyorSpawns]
    return pts

def connectivity_ok():
    reach = bfs((spawn1['x'], spawn1['y']))
    return all(p in reach for p in all_check_points())

def pick_gaps(span_len, gap_count, gap_len_range, min_gap_spacing=4):
    # gap_count non-overlapping [start, start+len) windows spaced at least
    # min_gap_spacing apart, picked within [0, span_len).
    for _try in range(40):
        gaps = []
        ok = True
        for _ in range(gap_count):
            placed = False
            for _inner in range(20):
                g_len = rng.randint(*gap_len_range)
                g_start = rng.randint(3, span_len - 3 - g_len)
                if all(g_start >= e + min_gap_spacing or g_start + g_len <= s - min_gap_spacing for (s, e) in gaps):
                    gaps.append((g_start, g_start + g_len))
                    placed = True
                    break
            if not placed:
                ok = False
                break
        if ok:
            return gaps
    return []

def carve_hallway_walls(room, count):
    # Each wall segment now gets 2 separate openings instead of 1 (direct
    # request: "more openings") -- two independent doorways rather than
    # one wide one, so a segment reads as a wall with a couple of gaps in
    # it, not a wall with a single choke point.
    placed = 0
    for _ in range(count * 3):  # generous attempt budget -- many candidates get skipped or reverted
        if placed >= count:
            break
        vertical = rng.random() < 0.5
        cells = []
        if vertical:
            x = rng.randint(room['x0'] + 10, room['x1'] - 10)
            y0, y1 = room['y0'] + 2, room['y1'] - 2
            span = y1 - y0 + 1
            gaps = pick_gaps(span, 2, (3, 4))
            if not gaps:
                continue
            for y in range(y0, y1 + 1):
                rel = y - y0
                if any(s <= rel < e for (s, e) in gaps):
                    continue
                if grid[y][x] == '.':
                    cells.append((x, y))
        else:
            y = rng.randint(room['y0'] + 10, room['y1'] - 10)
            x0, x1 = room['x0'] + 2, room['x1'] - 2
            span = x1 - x0 + 1
            gaps = pick_gaps(span, 2, (3, 4))
            if not gaps:
                continue
            for x in range(x0, x1 + 1):
                rel = x - x0
                if any(s <= rel < e for (s, e) in gaps):
                    continue
                if grid[y][x] == '.':
                    cells.append((x, y))
        if len(cells) < 10:  # mostly already walls/other features -- not a useful segment
            continue
        for (cx, cy) in cells:
            grid[cy][cx] = '#'
        if connectivity_ok():
            placed += 1
        else:
            for (cx, cy) in cells:
                grid[cy][cx] = '.'
    return placed

hallway_walls_a = carve_hallway_walls(SEC_A, 10)
hallway_walls_b = carve_hallway_walls(SEC_B, 10)

# ---- normal single-tile crates, scattered across remaining floor
# (including the new hallway nooks carved above). Cap quadrupled (360,
# up from 90). Filtered to the actually-reachable set -- hallway carving
# above only checks connectivity to named spawn/route/item points, not
# every stray floor tile, so a small nook can end up walled into its own
# unreachable island without tripping that check.
post_carve_reach = bfs((spawn1['x'], spawn1['y']))
crate_candidates = []
for room in (SEC_A, SEC_B, HALL):
    for y in range(room['y0'], room['y1'] + 1):
        for x in range(room['x0'], room['x1'] + 1):
            if grid[y][x] == '.' and (x, y) not in reserved and (x, y) in post_carve_reach:
                crate_candidates.append((x, y))
rng.shuffle(crate_candidates)
CRATE_COUNT = min(len(crate_candidates), 360)
crateSpawns = [{'x': x, 'y': y} for (x, y) in crate_candidates[:CRATE_COUNT]]

grid_strs = [''.join(r) for r in grid]

out = {
    'cols': COLS, 'rows': ROWS,
    'grid': grid_strs,
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': safeZone,
    'exitTrigger': exitTrigger,
    'monsterSpawns': monsterSpawns, 'patrolPoints': patrolPoints,
    'crateSpawns': crateSpawns, 'bigCrateSpawns': bigCrateSpawns,
    'shelfSpawns': shelfSpawns, 'windows': windows,
    'conveyorSpawns': conveyorSpawns, 'gearSpawns': gearSpawns,
}

# ---- final connectivity check (re-verifies everything, including the
# loose crates placed after hallway carving).
reach = bfs((spawn1['x'], spawn1['y']))
ok = True
checks = {
    'exitTrigger': [(exitTrigger['x'], exitTrigger['y'])],
    'monsterSpawns': [(p['x'], p['y']) for p in monsterSpawns],
    'patrolPoints': [(p['x'], p['y']) for p in patrolPoints],
    'crateSpawns': [(c['x'], c['y']) for c in crateSpawns],
    'gearSpawns': [(g['x'], g['y']) for g in gearSpawns],
    'conveyorSpawns': [(c['x'], c['y']) for c in conveyorSpawns],
}
for name, pts in checks.items():
    for p in pts:
        if p not in reach:
            print('UNREACHABLE', name, p)
            ok = False

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'monsters', len(monsterSpawns),
      'patrolPoints', len(patrolPoints),
      'crates', len(crateSpawns), 'bigCrates', len(bigCrateSpawns),
      'shelves', len(shelfSpawns), 'windows', len(windows),
      'conveyors', len(conveyorSpawns), 'gears', len(gearSpawns),
      'hallwayWalls', hallway_walls_a + hallway_walls_b)

with open('C:/claude_p/goofy-horror/.scratch/level24_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level24_data.json')
