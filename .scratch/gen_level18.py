import json, random

# A completely different shape from Level 16/17's grid-of-rooms lattice: a
# radial cross. One big hub room (the "giant pipe room") in the middle,
# with a spoke corridor running out to each of 4 satellite rooms (N/E/S/W),
# plus a small gated exit alcove tapped off the hub's east wall at a
# different height than the east spoke so the two openings don't collide.

# Every room/corridor dimension below is the original scaled by ~1.73
# (sqrt(3)) so the total floor area comes out to roughly 3x the original
# radial-cross layout -- ARM_W stays a fixed corridor width, not a room
# dimension, so it doesn't scale.
HUB = 34          # hub is HUB x HUB
ARM_LEN = 14        # spoke corridor length from hub edge to satellite edge
ARM_W = 4           # spoke corridor width
SAT_W, SAT_H = 24, 17  # every satellite room is the same size

hub_cx, hub_cy = HUB // 2, HUB // 2  # local coords, hub top-left is (0,0)

rects = []  # list of (x0,y0,x1,y1) exclusive, in LOCAL coords, carved to '.'
def rect(x0, y0, x1, y1):
    rects.append((x0, y0, x1, y1))

# hub
rect(0, 0, HUB, HUB)

# north satellite + spoke
n_x0 = hub_cx - SAT_W // 2
n_y1 = -ARM_LEN
n_y0 = n_y1 - SAT_H
rect(n_x0, n_y0, n_x0 + SAT_W, n_y1)
rect(hub_cx - ARM_W // 2, n_y1, hub_cx + ARM_W // 2, 0)

# south satellite + spoke
s_x0 = hub_cx - SAT_W // 2
s_y0 = HUB + ARM_LEN
rect(s_x0, s_y0, s_x0 + SAT_W, s_y0 + SAT_H)
rect(hub_cx - ARM_W // 2, HUB, hub_cx + ARM_W // 2, s_y0)

# west satellite + spoke
w_y0 = hub_cy - SAT_H // 2
w_x1 = -ARM_LEN
w_x0 = w_x1 - SAT_W
rect(w_x0, w_y0, w_x1, w_y0 + SAT_H)
rect(w_x1, hub_cy - ARM_W // 2, 0, hub_cy + ARM_W // 2)

# east satellite + spoke
e_y0 = hub_cy - SAT_H // 2
e_x0 = HUB + ARM_LEN
rect(e_x0, e_y0, e_x0 + SAT_W, e_y0 + SAT_H)
rect(HUB, hub_cy - ARM_W // 2, e_x0, hub_cy + ARM_W // 2)

# exit alcove, gated off the FAR (outer) wall of the east satellite room --
# well clear of every other rect so the door is the only way in.
e_x1 = e_x0 + SAT_W
exit_corridor = (e_x1, e_y0 + 5, e_x1 + 6, e_y0 + 10)
rect(*exit_corridor)
exit_room = (e_x1 + 6, e_y0 - 1, e_x1 + 23, e_y0 + SAT_H + 1)
rect(*exit_room)

# ---- compute bounds, offset everything into positive grid coords ----
min_x = min(r[0] for r in rects)
min_y = min(r[1] for r in rects)
max_x = max(r[2] for r in rects)
max_y = max(r[3] for r in rects)
OX = -min_x + 1
OY = -min_y + 1
COLS = (max_x - min_x) + 2
ROWS = (max_y - min_y) + 2

def go(x, y):
    return x + OX, y + OY

grid = [['#'] * COLS for _ in range(ROWS)]
for (x0, y0, x1, y1) in rects:
    gx0, gy0 = go(x0, y0)
    gx1, gy1 = go(x1, y1)
    for y in range(gy0, gy1):
        for x in range(gx0, gx1):
            grid[y][x] = '.'

# door on the exit corridor (gated until the wheel is solved)
dgx0, dgy0 = go(*exit_corridor[:2])
dgx1, dgy1 = go(*exit_corridor[2:])
for y in range(dgy0, dgy1):
    for x in range(dgx0, dgx1):
        grid[y][x] = 'D'

hub_gx0, hub_gy0 = go(0, 0)
hub_gx1, hub_gy1 = go(HUB, HUB)
hub_bounds = {'x0': hub_gx0, 'y0': hub_gy0, 'x1': hub_gx1 - 1, 'y1': hub_gy1 - 1}

# spawn: south satellite's outer (southmost) corner, with a 6x6 safe zone
s_gx0, s_gy0 = go(s_x0, s_y0)
sz_x0, sz_y0 = s_gx0 + 1, s_gy0 + SAT_H - 7
grid_safe = {'x0': sz_x0, 'y0': sz_y0, 'x1': sz_x0 + 5, 'y1': sz_y0 + 5}
for y in range(sz_y0, sz_y0 + 6):
    for x in range(sz_x0, sz_x0 + 6):
        grid[y][x] = 'S'
spawn1 = {'x': sz_x0 + 1, 'y': sz_y0 + 1}
spawn2 = {'x': sz_x0 + 2, 'y': sz_y0 + 1}

# exit room + trigger
er_gx0, er_gy0 = go(exit_room[0], exit_room[1])
er_gx1, er_gy1 = go(exit_room[2], exit_room[3])
for y in range(er_gy0, er_gy1):
    for x in range(er_gx0, er_gx1):
        grid[y][x] = 'E'
exitTrigger = {'x': (er_gx0 + er_gx1) // 2, 'y': (er_gy0 + er_gy1) // 2}
grid[exitTrigger['y']][exitTrigger['x']] = 'X'

# the giant wheel sits at hub center; two pressure plates flank it --
# far enough apart that one player standing on one can't also reach the
# other, forcing both players to hold them down together.
hub_cgx, hub_cgy = go(hub_cx, hub_cy)
wheel = {'x': hub_cgx, 'y': hub_cgy}
plateA = {'x': hub_cgx - 9, 'y': hub_cgy}
plateB = {'x': hub_cgx + 9, 'y': hub_cgy}
grid[plateA['y']][plateA['x']] = 'Q'
grid[plateB['y']][plateB['x']] = 'Q'

# monster spawns in the hub itself, guarding the wheel room; patrols the
# hub and all 4 satellites in a loop.
monsterSpawn = {'x': hub_cgx, 'y': hub_cgy - 10}
patrolPoints = [
    {'x': hub_cgx, 'y': hub_cgy - 10},
    go(n_x0 + SAT_W // 2, n_y0 + SAT_H // 2),
    go(e_x0 + SAT_W // 2, e_y0 + SAT_H // 2),
    go(s_x0 + SAT_W // 2, s_y0 + SAT_H // 2),
    go(w_x0 + SAT_W // 2, w_y0 + SAT_H // 2),
]
patrolPoints = [{'x': p[0], 'y': p[1]} if isinstance(p, tuple) else p for p in patrolPoints]

rng = random.Random(1818)

reserved = set()
for y in range(sz_y0 - 1, sz_y0 + 7):
    for x in range(sz_x0 - 1, sz_x0 + 7):
        reserved.add((x, y))
reserved.add((plateA['x'], plateA['y']))
reserved.add((plateB['x'], plateB['y']))
reserved.add((wheel['x'], wheel['y']))
reserved.add((monsterSpawn['x'], monsterSpawn['y']))
for p in patrolPoints:
    reserved.add((p['x'], p['y']))
# keep a clear ring around the wheel/plates so the hub centerpiece reads
# cleanly and isn't cluttered with coral/crates right on top of it
for dy in range(-5, 6):
    for dx in range(-14, 15):
        reserved.add((hub_cgx + dx, hub_cgy + dy))

coral_candidates = []
for y in range(ROWS):
    for x in range(COLS):
        if grid[y][x] == '.' and (x, y) not in reserved:
            coral_candidates.append((x, y))
rng.shuffle(coral_candidates)
coral_count = 180 * 3
for (x, y) in coral_candidates[:coral_count]:
    grid[y][x] = 'R'

remaining = [t for t in coral_candidates[coral_count:] if t not in reserved]
rng.shuffle(remaining)
crateSpawns = [{'x': x, 'y': y} for (x, y) in remaining[:22 * 3]]

out = {
    'grid': [''.join(row) for row in grid],
    'spawn1': spawn1, 'spawn2': spawn2, 'safeZone': grid_safe,
    'exitTrigger': exitTrigger, 'monsterSpawn': monsterSpawn,
    'wheel': wheel, 'pressurePlates': [plateA, plateB],
    'hubBounds': hub_bounds,
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
    'plates': [(plateA['x'], plateA['y']), (plateB['x'], plateB['y'])],
    'wheel': [(wheel['x'], wheel['y'])],
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

print('ALL OK:', ok, 'grid', COLS, 'x', ROWS, 'crates', len(crateSpawns))

with open('C:/claude_p/goofy-horror/.scratch/level18_data.json', 'w') as f:
    json.dump(out, f)
print('wrote level18_data.json')
