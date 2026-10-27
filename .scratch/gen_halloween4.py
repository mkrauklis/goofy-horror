import json, os, random, math
from collections import deque

# Halloween chapter, level 4 -- the overgrown ward. Same deco as the hospital
# (beds, lamps, corpses, candy) but a completely different floor plan: an
# irregular scatter of rooms of all sizes joined by winding 3-wide passages,
# found by splitting the building up (BSP) rather than a tidy grid. Chars:
#   '.' floor   '#' wall   'S' safe room   'B' a 2x2 crate (solid)
#   'D' exit door   'E' exit room floor   'X' exit trigger
rng = random.Random(4417)
W, H = 120, 72
BORDER = 3
grid = [['#'] * W for _ in range(H)]

MINW, MINH = 16, 12
leaves = []
def split(x0, y0, x1, y1, depth):
    w, h = x1 - x0 + 1, y1 - y0 + 1
    can_v = w >= 2 * MINW
    can_h = h >= 2 * MINH
    if not (can_v or can_h) or (depth >= 2 and rng.random() < 0.1):
        leaves.append((x0, y0, x1, y1)); return {'leaf': (x0, y0, x1, y1)}
    if can_v and can_h:
        vertical = (w / h > 1.3) or (rng.random() < 0.5 and w / h > 0.8)
    else:
        vertical = can_v
    if vertical:
        cut = rng.randint(x0 + MINW, x1 - MINW + 1)
        a = split(x0, y0, cut - 1, y1, depth + 1); b = split(cut, y0, x1, y1, depth + 1)
    else:
        cut = rng.randint(y0 + MINH, y1 - MINH + 1)
        a = split(x0, y0, x1, cut - 1, depth + 1); b = split(x0, cut, x1, y1, depth + 1)
    return {'a': a, 'b': b}

tree = split(BORDER, BORDER, W - BORDER - 1, H - BORDER - 1, 0)

rooms = []
leaf_room = {}
for lf in leaves:
    x0, y0, x1, y1 = lf
    mx0, mx1 = rng.randint(1, 4), rng.randint(1, 4)
    my0, my1 = rng.randint(1, 3), rng.randint(1, 3)
    r = {'x0': x0 + mx0, 'x1': x1 - mx1, 'y0': y0 + my0, 'y1': y1 - my1}
    assert r['x1'] - r['x0'] >= 8 and r['y1'] - r['y0'] >= 6
    rooms.append(r); leaf_room[lf] = r
    for y in range(r['y0'], r['y1'] + 1):
        for x in range(r['x0'], r['x1'] + 1): grid[y][x] = '.'
print('rooms', len(rooms))

def center(r): return ((r['x0'] + r['x1']) // 2, (r['y0'] + r['y1']) // 2)
def in_room(r, x, y): return r['x0'] <= x <= r['x1'] and r['y0'] <= y <= r['y1']

spawn_room = min(rooms, key=lambda r: center(r)[0] + center(r)[1])
exit_room = max(rooms, key=lambda r: center(r)[0] + center(r)[1])
print('spawn room', spawn_room, 'exit room', exit_room)

forbidden = set()
fr = exit_room
for y in range(fr['y0'] - 3, fr['y1'] + 4):
    for x in range(fr['x0'] - 3, fr['x1'] + 4):
        if not in_room(fr, x, y): forbidden.add((x, y))

def carve_path(a, b, allow_forbidden=False):
    ax, ay = center(a); bx, by = center(b)
    pts = []
    if rng.random() < 0.5:
        sx = 1 if bx >= ax else -1
        for x in range(ax, bx + sx, sx): pts.append((x, ay))
        sy = 1 if by >= ay else -1
        for y in range(ay + sy, by + sy, sy): pts.append((bx, y))
    else:
        sy = 1 if by >= ay else -1
        for y in range(ay, by + sy, sy): pts.append((ax, y))
        sx = 1 if bx >= ax else -1
        for x in range(ax + sx, bx + sx, sx): pts.append((x, by))
    for (px, py) in pts:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                x, y = px + dx, py + dy
                if not (BORDER <= x < W - BORDER and BORDER <= y < H - BORDER): continue
                if (x, y) in forbidden and not allow_forbidden: continue
                if grid[y][x] == '#': grid[y][x] = '.'
    return pts

def pick(node, avoid):
    if 'leaf' in node: return leaf_room[node['leaf']]
    opts = []
    def walk(n):
        if 'leaf' in n: opts.append(leaf_room[n['leaf']])
        else: walk(n['a']); walk(n['b'])
    walk(node)
    opts2 = [r for r in opts if r is not avoid]
    return rng.choice(opts2 or opts)

edges = []
corridor_paths = []
exit_path = None
def connect(node):
    global exit_path
    if 'leaf' in node: return
    connect(node['a']); connect(node['b'])
    ra, rb = pick(node['a'], exit_room), pick(node['b'], exit_room)
    ends_exit = (ra is exit_room) or (rb is exit_room)
    if ends_exit:
        a_, b_ = (rb, ra) if ra is exit_room else (ra, rb)
        pts = carve_path(a_, b_, allow_forbidden=True)
        exit_path = pts
        edges.append((a_, b_))
    else:
        corridor_paths.append(carve_path(ra, rb))
        edges.append((ra, rb))
connect(tree)
assert exit_path is not None, 'the exit room got no connection'

# a few extra loops between rooms (never the exit room)
others = [r for r in rooms if r is not exit_room]
for _ in range(max(3, len(others) // 3)):
    a, b = rng.sample(others, 2)
    if (a, b) in edges or (b, a) in edges: continue
    if math.hypot(center(a)[0] - center(b)[0], center(a)[1] - center(b)[1]) > 55: continue
    corridor_paths.append(carve_path(a, b)); edges.append((a, b))

# ---- the exit room: one gated entrance ----
fill = lambda r, ch: [grid[y].__setitem__(x, ch) for y in range(r['y0'], r['y1'] + 1) for x in range(r['x0'], r['x1'] + 1)]
fill(exit_room, 'E')
idx = next(i for i, (x, y) in enumerate(exit_path) if in_room(exit_room, x, y))
inx, iny = exit_path[idx]; outx, outy = exit_path[idx - 1]
dx, dy = inx - outx, iny - outy
assert abs(dx) + abs(dy) == 1
px, py = -dy, dx
door_cells = []
for off in (-1, 0, 1):
    for back in (0, 1):
        x, y = outx + px * off - dx * back, outy + py * off - dy * back
        grid[y][x] = 'D'; door_cells.append((x, y))
# the door has to seal the passage completely: no floor may slip around it
for (x, y) in list(door_cells):
    pass
ex_x, ex_y = center(exit_room)
grid[ex_y][ex_x] = 'X'
fill(spawn_room, 'S')
spawn1 = {'x': spawn_room['x0'] + 1, 'y': spawn_room['y0'] + 1}
spawn2 = {'x': spawn_room['x0'] + 2, 'y': spawn_room['y0'] + 1}

# every tile that now belongs to a room, and the floor outside them
def room_of(x, y):
    for r in rooms:
        if in_room(r, x, y): return r
cand_rooms = [r for r in rooms if r is not exit_room and r is not spawn_room]

def flood(start, passable):
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + ddx, y + ddy
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and passable(grid[ny][nx]):
                seen.add((nx, ny)); q.append((nx, ny))
    return seen
closed = flood((spawn1['x'], spawn1['y']), lambda c: c not in '#BD')
if (ex_x, ex_y) in closed: raise SystemExit('exit reachable with the door closed -- another way in')
opened = flood((spawn1['x'], spawn1['y']), lambda c: c not in '#B')
assert (ex_x, ex_y) in opened, 'exit unreachable'
floor_all = [(x, y) for y in range(H) for x in range(W) if grid[y][x] in '.SED']
unreach = [t for t in floor_all if t not in opened]
if unreach:                      # seal off any orphaned pockets
    for (x, y) in unreach: grid[y][x] = '#'
    print('sealed', len(unreach), 'orphan tiles')

# ---- furniture, as in the hospital ----
def mouth_cells():
    out = set()
    outside = set()
    for y in range(H):
        for x in range(W):
            if grid[y][x] in '.SD' and room_of(x, y) is None: outside.add((x, y))
    for r in rooms:
        for y in range(r['y0'], r['y1'] + 1):
            for x in range(r['x0'], r['x1'] + 1):
                if any((x + ddx, y + ddy) in outside for ddx in range(-2, 3) for ddy in range(-2, 3)): out.add((x, y))
    return out
mouths = mouth_cells()

crate_rooms = rng.sample(cand_rooms, min(14, len(cand_rooms)))
crates = []
for r in crate_rooms:
    for _ in range(20):
        x, y = rng.randint(r['x0'] + 1, r['x1'] - 1), rng.randint(r['y0'] + 1, r['y1'] - 1)
        if (x, y) not in mouths: crates.append({'x': x, 'y': y}); break
# a couple more in the roomier ones
for r in sorted(cand_rooms, key=lambda r: -(r['x1'] - r['x0']) * (r['y1'] - r['y0']))[:4]:
    x, y = rng.randint(r['x0'] + 1, r['x1'] - 1), rng.randint(r['y0'] + 1, r['y1'] - 1)
    if (x, y) not in mouths: crates.append({'x': x, 'y': y})
corpses = []
for r in rng.sample(cand_rooms, min(8, len(cand_rooms))):
    c = center(r); corpses.append({'x': c[0], 'y': c[1], 'angle': round(rng.random() * 6.28, 2)})
beds = []
for r in cand_rooms + [spawn_room]:
    n = 2 if (r['x1'] - r['x0']) >= 9 else 1
    for i in range(n):
        bx = r['x0'] + 1 + i * 4
        if bx + 1 > r['x1']: continue
        for by in (r['y0'], r['y1']):
            if (bx, by) not in mouths and (bx + 1, by) not in mouths:
                beds.append({'x': bx, 'y': by}); break

def dist(a, b): return math.hypot(a['x'] - b['x'], a['y'] - b['y'])
def rc(r): return {'x': center(r)[0], 'y': center(r)[1]}

# ---- the green pumpkins and the bluelighter ----
chosen = []
pool = list(cand_rooms)
for _ in range(3):
    best = max(pool, key=lambda r: min([dist(rc(r), spawn1)] + [dist(rc(r), rc(c)) for c in chosen]))
    chosen.append(best); pool.remove(best)
pumpkins = [{'x': center(r)[0] + 1, 'y': center(r)[1]} for r in chosen]
mid = {'x': W / 2, 'y': H / 2}
lighter_room = min([r for r in cand_rooms if r not in chosen], key=lambda r: dist(rc(r), mid))
lighter = {'x': center(lighter_room)[0] - 1, 'y': center(lighter_room)[1]}
print('pumpkins', pumpkins, 'lighter', lighter)

# ---- 2x2 crates ----
reserved = set(mouths)
def reserve(x, y, m=1):
    for ddy in range(-m, m + 1):
        for ddx in range(-m, m + 1): reserved.add((x + ddx, y + ddy))
for b in beds:
    for k in range(2): reserve(b['x'] + k, b['y'], 1)
for c in crates: reserve(c['x'], c['y'], 1)
for c in corpses: reserve(c['x'], c['y'], 1)
for p in pumpkins: reserve(p['x'], p['y'], 2)
reserve(lighter['x'], lighter['y'], 2)
for y in range(spawn_room['y0'] - 1, spawn_room['y1'] + 2):
    for x in range(spawn_room['x0'] - 1, spawn_room['x1'] + 2): reserved.add((x, y))
for y in range(exit_room['y0'] - 1, exit_room['y1'] + 2):
    for x in range(exit_room['x0'] - 1, exit_room['x1'] + 2): reserved.add((x, y))
mon_room = min(cand_rooms, key=lambda r: dist(rc(r), mid))
mon_spawn = {'x': center(mon_room)[0], 'y': center(mon_room)[1] - 1}
reserve(mon_spawn['x'], mon_spawn['y'], 2)

def connected():
    seen = flood((spawn1['x'], spawn1['y']), lambda c: c not in '#BD')
    floor = [(x, y) for y in range(H) for x in range(W) if grid[y][x] == '.' or grid[y][x] == 'S']
    return all(t in seen for t in floor)
assert connected()
big = []
def try_crate(x, y):
    cells = [(x + ddx, y + ddy) for ddx in (0, 1) for ddy in (0, 1)]
    if any(grid[cy][cx] != '.' or (cx, cy) in reserved for cx, cy in cells): return False
    for cx, cy in cells: grid[cy][cx] = 'B'
    if not connected():
        for cx, cy in cells: grid[cy][cx] = '.'
        return False
    big.append({'x': x, 'y': y})
    for cx, cy in cells: reserve(cx, cy, 1)
    return True
for r in cand_rooms:
    area = (r['x1'] - r['x0'] + 1) * (r['y1'] - r['y0'] + 1)
    for _ in range(max(1, area // 70)):
        for _ in range(14):
            x = rng.randint(r['x0'], r['x1'] - 1); y = rng.randint(r['y0'], r['y1'] - 1)
            if try_crate(x, y): break
print('2x2 crates', len(big))

rows = [''.join(r) for r in grid]
floor_tiles = [(x, y) for y in range(H) for x in range(W) if rows[y][x] == '.']

lanterns = []
rng.shuffle(floor_tiles)
for (x, y) in floor_tiles:
    if (x, y) in reserved: continue
    if any(math.hypot(x - l['x'], y - l['y']) < 8 for l in lanterns): continue
    if any(math.hypot(x - p['x'], y - p['y']) < 3 for p in pumpkins + [lighter]): continue
    lanterns.append({'x': x, 'y': y, 'ox': rng.randint(-6, 6), 'oy': rng.randint(-6, 6)})
print('lanterns', len(lanterns))

vines = []
rng.shuffle(floor_tiles)
for (x, y) in floor_tiles:
    if len(vines) >= 170: break
    if any(math.hypot(x - v['x'], y - v['y']) < 3.0 for v in vines): continue
    vines.append({'x': round(x + rng.random(), 2), 'y': round(y + rng.random(), 2), 'a': round(rng.random() * 6.28, 2), 'n': rng.randint(5, 9), 's': rng.randint(1, 9999)})
for b in big:
    for _ in range(2):
        vines.append({'x': round(b['x'] + rng.choice([-0.3, 2.3]), 2), 'y': round(b['y'] + rng.random() * 2, 2), 'a': round(rng.random() * 6.28, 2), 'n': rng.randint(4, 7), 's': rng.randint(1, 9999)})
print('vines', len(vines))

# ---- sanity ----
ok = True
pr = flood((spawn1['x'], spawn1['y']), lambda c: c not in '#B')
for t, n in [((ex_x, ex_y), 'exit')] + [((p['x'], p['y']), 'pumpkin') for p in pumpkins] + [((lighter['x'], lighter['y']), 'lighter'), ((mon_spawn['x'], mon_spawn['y']), 'monster')]:
    if t not in pr: print(n, 'unreachable', t); ok = False
mr = flood((mon_spawn['x'], mon_spawn['y']), lambda c: c == '.')
unreached = [t for t in floor_tiles if t not in mr]
print('not reachable by monster', len(unreached))
if unreached: ok = False
for p in pumpkins + [lighter]:
    if (p['x'], p['y']) not in mr: print('monster cannot reach', p); ok = False

patrol = [rc(r) for r in cand_rooms]
patrol = [p for p in patrol if rows[p['y']][p['x']] == '.']
lamps = [rc(r) for r in rooms if r is not exit_room]
for path in corridor_paths:
    for i in range(6, len(path), 9):
        x, y = path[i]
        if room_of(x, y) is None and rows[y][x] == '.': lamps.append({'x': x, 'y': y})
lamps = [l for l in lamps if rows[l['y']][l['x']] in '.S']
print('ALL OK:', ok, 'rooms', len(rooms), 'lamps', len(lamps), 'patrol', len(patrol))
assert ok

def pts(lst): return '[' + ', '.join('{ x: %d, y: %d }' % (p['x'], p['y']) for p in lst) + ']'
sz = spawn_room
js = 'window.HALLOWEEN4 = {\n  tileSize: 32,\n  cols: %d,\n  rows: %d,\n  grid: [\n' % (W, H)
for r in rows: js += '    ' + json.dumps(r) + ',\n'
js += '  ],\n'
js += '  spawn1: { x: %d, y: %d },\n  spawn2: { x: %d, y: %d },\n' % (spawn1['x'], spawn1['y'], spawn2['x'], spawn2['y'])
js += '  monsterSpawn: { x: %d, y: %d },\n' % (mon_spawn['x'], mon_spawn['y'])
js += '  exitTrigger: { x: %d, y: %d },\n' % (ex_x, ex_y)
js += '  safeZone: { x0: %d, y0: %d, x1: %d, y1: %d },\n' % (sz['x0'], sz['y0'], sz['x1'], sz['y1'])
js += '  patrolPoints: %s,\n' % pts(patrol)
js += '  crateSpawns: %s,\n' % pts(crates)
js += '  corpseSpawns: [' + ', '.join('{ x: %d, y: %d, angle: %s }' % (c['x'], c['y'], c['angle']) for c in corpses) + '],\n'
js += '  beds: %s,\n' % pts(beds)
js += '  lamps: %s,\n' % pts(lamps)
js += '  bigCrates: %s,\n' % pts(big)
js += '  lanterns: [' + ', '.join('{ x: %d, y: %d, ox: %d, oy: %d }' % (l['x'], l['y'], l['ox'], l['oy']) for l in lanterns) + '],\n'
js += '  vines: [' + ', '.join('{ x: %s, y: %s, a: %s, n: %d, s: %d }' % (v['x'], v['y'], v['a'], v['n'], v['s']) for v in vines) + '],\n'
js += '  pumpkins: %s,\n' % pts(pumpkins)
js += '  lighter: { x: %d, y: %d },\n' % (lighter['x'], lighter['y'])
js += '};\n'
os.makedirs('C:/claude_p/goofy-horror/levels/halloween4', exist_ok=True)
open('C:/claude_p/goofy-horror/levels/halloween4/level.js', 'w', newline='\n').write(js)
open('C:/claude_p/goofy-horror/.scratch/h4_preview.txt', 'w').write('\n'.join(rows))
print('wrote', len(js), 'bytes')
