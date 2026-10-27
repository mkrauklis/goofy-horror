import json, os, random
from collections import deque

# Halloween chapter, level 2 -- a hospital. Chars:
#   '.' floor   '#' wall   'S' safe room (monster can't enter)   'V' vent duct
#   'F' fan switch (inside a duct; stepping on it turns the fan off)
#   'D' exit door   'E' exit room floor   'X' exit trigger
rng = random.Random(1032)
W, H = 120, 72
PER = 5
grid = [['#'] * W for _ in range(H)]

def fill(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            grid[y][x] = ch

# corridors: three 4-tall horizontal ones, three 4-wide vertical ones
HC = [(17, 20), (33, 36), (49, 52)]
VC = [(17, 20), (58, 61), (99, 102)]
for y0, y1 in HC: fill(PER + 1, y0, W - PER - 2, y1, '.')
for x0, x1 in VC: fill(x0, PER + 1, x1, H - PER - 2, '.')

# bands of rooms between corridors (interior rows), with the wall rows that touch each corridor
bands = [  # (room y0, room y1, wall above?, wall below?) -> doors go to corridor above (up) or below (down)
    (6, 15, None, 'A'),      # top rooms open down to corridor A
    (22, 31, 'A', 'B'),
    (38, 47, 'B', 'C'),
    (54, 65, 'C', None),     # bottom rooms open up to corridor C
]
# room x-ranges per segment
segments = [(6, 15, 1), (22, 56, 4), (63, 97, 4), (104, 113, 1)]
rooms = []
for (ry0, ry1, up, down) in bands:
    for (sx0, sx1, n) in segments:
        if n == 1:
            rects = [(sx0, sx1)]
        else:
            total = sx1 - sx0 + 1
            w = (total - (n - 1)) // n
            rects = []
            x = sx0
            for i in range(n):
                ww = w + (1 if i < (total - (n - 1)) - w * n else 0)
                rects.append((x, x + ww - 1)); x += ww + 1
        for (x0, x1) in rects:
            fill(x0, ry0, x1, ry1, '.')
            rooms.append({'x0': x0, 'x1': x1, 'y0': ry0, 'y1': ry1, 'up': up, 'down': down})

def carve_door(room, side):
    cx = (room['x0'] + room['x1']) // 2 + rng.choice([-1, 0, 1])
    cx = max(room['x0'] + 1, min(room['x1'] - 1, cx))
    if side == 'up':
        for x in range(cx - 1, cx + 2): grid[room['y0'] - 1][x] = '.'
    else:
        for x in range(cx - 1, cx + 2): grid[room['y1'] + 1][x] = '.'

# the exit: bottom-right room, with a door D in its top wall onto corridor C
exit_room = [r for r in rooms if r['x0'] == 104 and r['y0'] == 54][0]
safe_room = [r for r in rooms if r['x0'] == 6 and r['y0'] == 6][0]
for r in rooms:
    if r is exit_room: continue
    if r['up'] and r['down']:
        side = rng.choice(['up', 'down'])
    else:
        side = 'up' if r['up'] else 'down'
    carve_door(r, side)
    r['side'] = side
# a few doors between side-by-side rooms, so rooms form loops
byrow = {}
for r in rooms: byrow.setdefault((r['y0']), []).append(r)
for row in byrow.values():
    row.sort(key=lambda r: r['x0'])
    for a, b in zip(row, row[1:]):
        if a['x1'] + 2 == b['x0'] and rng.random() < 0.4 and a is not exit_room and b is not exit_room and a is not safe_room and b is not safe_room:
            cy = (a['y0'] + a['y1']) // 2
            for y in range(cy - 1, cy + 2): grid[y][a['x1'] + 1] = '.'
fill(exit_room['x0'], exit_room['y0'], exit_room['x1'], exit_room['y1'], 'E')
for x in range(108, 111): grid[53][x] = 'D'
ex_x, ex_y = 109, 60
grid[ex_y][ex_x] = 'X'
fill(safe_room['x0'], safe_room['y0'], safe_room['x1'], safe_room['y1'], 'S')

# ---- ventilation duct systems in the thick outer wall ----
def vtile(x, y):
    if grid[y][x] in '#': grid[y][x] = 'V'
RING = {'n': 2, 's': H - 3, 'w': 2, 'e': W - 3}
# north: grates down from the top of corridors V1 and V3, a tunnel across, a fan chamber in the middle
for gx in (18, 19, 100, 101):
    for y in range(RING['n'], PER + 1): vtile(gx, y)
for x in range(18, 102): vtile(x, RING['n'])
fans = []
def chamber(cx, cy, horizontal):
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1): vtile(cx + dx, cy + dy)
    grid[cy][cx] = 'F'
    fans.append({'x': cx, 'y': cy})
chamber(60, RING['n'], True)
# south
for gx in (18, 19, 100, 101):
    for y in range(H - PER - 1, RING['s'] + 1): vtile(gx, y)
for x in range(18, 102): vtile(x, RING['s'])
chamber(60, RING['s'], True)
# west: grates onto corridor A and C, a tunnel down the side
for gy in (18, 19, 50, 51):
    for x in range(RING['w'], PER + 1): vtile(x, gy)
for y in range(18, 52): vtile(RING['w'], y)
chamber(RING['w'], 34, False)
# east
for gy in (18, 19, 50, 51):
    for x in range(W - PER - 1, RING['e'] + 1): vtile(x, gy)
for y in range(18, 52): vtile(RING['e'], y)
chamber(RING['e'], 34, False)

# ---- vents spread right through the ward ----
# extra grates: rooms all the way round the building open onto the ring ducts
def room_at(x, y):
    for r in rooms:
        if r['x0'] <= x <= r['x1'] and r['y0'] <= y <= r['y1']: return r
def grate_w(rx, ry):  # west side, into the duct at x=2
    for yy in (ry, ry + 1):
        for x in range(RING['w'], PER + 1): vtile(x, yy)
def grate_e(rx, ry):
    for yy in (ry, ry + 1):
        for x in range(W - PER - 1, RING['e'] + 1): vtile(x, yy)
def grate_n(rx, ry):
    for xx in (rx, rx + 1):
        for y in range(RING['n'], PER + 1): vtile(xx, y)
def grate_s(rx, ry):
    for xx in (rx, rx + 1):
        for y in range(H - PER - 1, RING['s'] + 1): vtile(xx, y)
# a long west/east duct reaching all the way down each side, a grate into every end room
for y in range(10, 63): vtile(RING['w'], y)
for y in range(10, 63): vtile(RING['e'], y)
extra = []
for ry in (27, 43, 60):
    grate_w(0, ry); extra.append(('w', ry))
for ry in (10, 27, 43):
    grate_e(0, ry); extra.append(('e', ry))
# north and south: a grate into about every other room along the top and bottom
top_rooms = sorted([r for r in rooms if r['y0'] == 6 and 18 < r['x0'] < 100], key=lambda r: r['x0'])
bot_rooms = sorted([r for r in rooms if r['y0'] == 54 and 18 < r['x0'] < 100], key=lambda r: r['x0'])
for i, r in enumerate(top_rooms):
    if i % 2 == 0: grate_n((r['x0'] + r['x1']) // 2, 0); extra.append(('n', r['x0']))
for i, r in enumerate(bot_rooms):
    if i % 2 == 1: grate_s((r['x0'] + r['x1']) // 2, 0); extra.append(('s', r['x0']))

# a hiding vent tucked into the far side of most rooms (away from the door, the bed and the crate)
inner_vents = 0
for r in rooms:
    if r is exit_room or r is safe_room: continue
    if rng.random() < 0.7:
        vy = r['y0'] + 1 if r.get('side') == 'down' else r['y1'] - 1
        vx = r['x1']
        if grid[vy][vx] == '.':
            grid[vy][vx] = 'V'; inner_vents += 1
print('extra grates', len(extra), 'inner vents', inner_vents)

# ---- sanity ----
rows = [''.join(r) for r in grid]
def reach(start, passable):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and passable(rows[ny][nx]):
                seen.add((nx, ny)); q.append((nx, ny))
    return seen
spawn1 = {'x': 8, 'y': 10}; spawn2 = {'x': 10, 'y': 10}
pr = reach((8, 10), lambda ch: ch != '#')
ok = True
for f in fans:
    if (f['x'], f['y']) not in pr: print('fan unreachable', f); ok = False
if (ex_x, ex_y) not in pr: print('exit unreachable'); ok = False
mon_spawn = {'x': 59, 'y': 34}
mr = reach((59, 34), lambda ch: ch not in '#SVFDX' and ch != 'E')
floor_tiles = [(x, y) for y in range(H) for x in range(W) if rows[y][x] == '.']
unreached = [t for t in floor_tiles if t not in mr]
print('floor tiles', len(floor_tiles), 'not reachable by monster', len(unreached))
if unreached: ok = False
# the monster must be able to reach every room (not just corridors) -- and every room must have a door
for r in rooms:
    if r is exit_room or r is safe_room: continue
    cx, cy = (r['x0'] + r['x1']) // 2, (r['y0'] + r['y1']) // 2
    if (cx, cy) not in mr: print('room unreachable', r); ok = False

# patrol: corridor crossings + a spread of rooms
patrol = []
for (y0, y1) in HC:
    for (x0, x1) in VC:
        patrol.append({'x': (x0 + x1) // 2, 'y': (y0 + y1) // 2})
cand_rooms = [r for r in rooms if r is not exit_room and r is not safe_room]
for r in rng.sample(cand_rooms, 10):
    patrol.append({'x': (r['x0'] + r['x1']) // 2, 'y': (r['y0'] + r['y1']) // 2})

def room_center(r): return {'x': (r['x0'] + r['x1']) // 2, 'y': (r['y0'] + r['y1']) // 2}
crate_rooms = rng.sample(cand_rooms, 14)
crates = [{'x': r['x0'] + 1, 'y': r['y0'] + 1} for r in crate_rooms]
corpse_rooms = rng.sample(cand_rooms, 8)
corpses = [dict(room_center(r), angle=round(rng.random() * 6.28, 2)) for r in corpse_rooms]

# beds: one or two per room, against the far wall
beds = []
for r in cand_rooms + [safe_room]:
    n = 2 if (r['x1'] - r['x0']) >= 7 else 1
    for i in range(n):
        bx = r['x0'] + 1 + i * 4
        if bx + 1 > r['x1']: continue
        by = r['y0'] if r.get('side') == 'down' else r['y1'] - 0
        by = r['y1'] if r.get('side') == 'up' else r['y0']
        if r is safe_room: by = r['y0']
        beds.append({'x': bx, 'y': by})
# ceiling lamps: down the corridors and one per room
lamps = []
for (y0, y1) in HC:
    for x in range(10, W - 10, 9): lamps.append({'x': x, 'y': (y0 + y1) // 2})
for (x0, x1) in VC:
    for y in range(10, H - 10, 9): lamps.append({'x': (x0 + x1) // 2, 'y': y})
for r in rooms:
    if r is exit_room: continue
    lamps.append(room_center(r))
lamps = [l for l in lamps if rows[l['y']][l['x']] in '.S']
print('ALL OK:', ok, 'grid', W, 'x', H, 'rooms', len(rooms), 'fans', fans, 'lamps', len(lamps), 'beds', len(beds))

def pts(lst): return '[' + ', '.join('{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst) + ']'
js = 'window.HALLOWEEN2 = {\n  tileSize: 32,\n  cols: %d,\n  rows: %d,\n  grid: [\n' % (W, H)
for r in rows: js += '    ' + json.dumps(r) + ',\n'
js += '  ],\n'
js += '  spawn1: { x: %d, y: %d },\n  spawn2: { x: %d, y: %d },\n' % (spawn1['x'], spawn1['y'], spawn2['x'], spawn2['y'])
js += '  monsterSpawn: { x: %d, y: %d },\n' % (mon_spawn['x'], mon_spawn['y'])
js += '  fans: %s,\n' % pts(fans)
js += '  exitTrigger: { x: %d, y: %d },\n' % (ex_x, ex_y)
js += '  safeZone: { x0: %d, y0: %d, x1: %d, y1: %d },\n' % (safe_room['x0'], safe_room['y0'], safe_room['x1'], safe_room['y1'])
js += '  patrolPoints: %s,\n' % pts(patrol)
js += '  crateSpawns: %s,\n' % pts(crates)
js += '  corpseSpawns: [' + ', '.join('{ x: %d, y: %d, angle: %s }' % (c['x'], c['y'], c['angle']) for c in corpses) + '],\n'
js += '  beds: %s,\n' % pts(beds)
js += '  lamps: %s,\n' % pts(lamps)
js += '};\n'
os.makedirs('C:/claude_p/goofy-horror/levels/halloween2', exist_ok=True)
open('C:/claude_p/goofy-horror/levels/halloween2/level.js', 'w', newline='\n').write(js)
print('wrote', len(js), 'bytes')
