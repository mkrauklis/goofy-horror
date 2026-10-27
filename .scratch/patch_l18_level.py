import json, random, re
from collections import deque

rng = random.Random(1802)
p = 'levels/level18/level.js'
s = open(p, encoding='utf-8').read()
rows = re.findall(r'^(\s*)"([^"]+)",\s*$', s, re.M)
indent = rows[0][0]
grid = [list(r[1]) for r in rows]
H, W = len(grid), len(grid[0])

Y0, Y1 = 40, 58          # the channel's rows
SLALOM_X = [160, 182, 200]   # the dark water gets walls: a slalom
GAP = 12
for i, x in enumerate(SLALOM_X):
    gap_top = (Y0, Y0 + GAP - 1) if i % 3 == 0 else (Y1 - GAP + 1, Y1) if i % 3 == 1 else (Y0 + 3, Y0 + 3 + GAP - 1)
    for y in range(Y0, Y1 + 1):
        if gap_top[0] <= y <= gap_top[1]: continue
        for dx in (0, 1): grid[y][x + dx] = '#'

# can a boat (which needs a clear tile all round it) get all the way through?
def clear(x, y):
    return all(grid[y + dy][x + dx] == '~' for dx in (-1, 0, 1) for dy in (-1, 0, 1))
def boat_can_pass():
    start = (129, 49)
    seen = {start}; q = deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 128 <= nx <= 209 and Y0 <= ny <= Y1 and (nx, ny) not in seen and clear(nx, ny):
                seen.add((nx, ny)); q.append((nx, ny))
    return any(x >= 207 for x, y in seen)
print('slalom alone passable:', boat_can_pass())

# a few 2x2 pillars in the long stretches between the slalom walls
pillars = 0
tries = 0
while pillars < 6 and tries < 400:
    tries += 1
    x = rng.randint(143, 203); y = rng.randint(Y0 + 1, Y1 - 3)
    if not any(5 <= x - sx <= 14 for sx in SLALOM_X + [140]): continue   # only mid-way between the walls
    cells = [(x + dx, y + dy) for dx in (0, 1) for dy in (0, 1)]
    if any(grid[cy][cx] != '~' for cx, cy in cells): continue
    # keep a wide lane clear all round it
    if any(grid[y + dy][x + dx] == '#' for dx in range(-2, 4) for dy in range(-2, 4) if (x + dx, y + dy) not in cells and 0 <= y + dy < H):
        continue
    for cx, cy in cells: grid[cy][cx] = '#'
    if not boat_can_pass():                       # never block the way through
        for cx, cy in cells: grid[cy][cx] = '~'
        continue
    pillars += 1

assert boat_can_pass(), 'the channel is blocked for a boat'
print('boat can get through; pillars', pillars)

# glowing neon-blue coral clinging to the walls that face the dark water
cands = []
for y in range(Y0 - 1, Y1 + 2):
    for x in range(138, 210):
        if grid[y][x] == '#' and any(grid[y + dy][x + dx] == '~' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < H and 0 <= x + dx < W):
            cands.append((x, y))
rng.shuffle(cands)
coral = []
for x, y in cands:
    if all(abs(x - a) + abs(y - b) >= 3 for a, b in coral): coral.append((x, y))
    if len(coral) >= 130: break
print('neon coral', len(coral))

new = [''.join(r) for r in grid]
a = s.index(indent + '"' + ''.join(rows[0][1]) + '"')
b = s.index('  ];', a)
s = s[:a] + ''.join(f'{indent}"{r}",\n' for r in new) + s[b:]
coral_js = '[' + ', '.join('{"x": %d, "y": %d}' % c for c in coral) + ']'
marker = '    boats: ['
assert marker in s
s = s.replace(marker, '    luminescent: {"x": 172, "y": 49, "x0": 134, "x1": 206},\n    neonCoral: %s,\n' % coral_js + marker, 1)
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
