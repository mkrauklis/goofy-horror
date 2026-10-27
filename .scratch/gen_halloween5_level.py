import re, random, math

old = open('C:/claude_p/goofy-horror/.scratch/oldh5/level.js', encoding='utf-8').read()
m = re.search(r"lanterns: \[(.*?)\],\n", old, re.S)
lanterns = [(int(a), int(b)) for a, b in re.findall(r"\{ x: (\d+), y: (\d+) \}", m.group(1))]
print('old lanterns', len(lanterns))

cx = cy = 24.5
FLOOR_R = 22.4
crates = [(int(a), int(b)) for a, b in re.findall(r"\{ x: (\d+), y: (\d+) \}", re.search(r"crateSpawns: \[(.*?)\],\n", old, re.S).group(1))]
spawns = [(23, 41), (25, 41)]
mons = [(24, 18)]

rng = random.Random(5050)

# a handful of extra jack-o-lanterns scattered over the floor (the old ones ring the edge)
extra = []
for _ in range(400):
    if len(extra) >= 14: break
    a = rng.random() * math.pi * 2
    r = 5 + rng.random() * 13
    x = round(cx + math.cos(a) * r - 0.5); y = round(cy + math.sin(a) * r - 0.5)
    pts = lanterns + extra + crates + spawns
    if all(math.hypot(x - px, y - py) > 4.5 for px, py in pts) and math.hypot(x - 24, y - 18) > 4:
        extra.append((x, y))
all_lanterns = lanterns + extra
print('lanterns now', len(all_lanterns))

# vines: wandering stems seeded across the floor
vines = []
tries = 0
while len(vines) < 70 and tries < 5000:
    tries += 1
    a = rng.random() * math.pi * 2
    r = math.sqrt(rng.random()) * (FLOOR_R - 1.5)
    x = cx + math.cos(a) * r; y = cy + math.sin(a) * r
    if any(math.hypot(x - sx, y - sy) < 3 for sx, sy in spawns):
        continue
    vines.append({'x': round(x, 2), 'y': round(y, 2), 'a': round(rng.random() * math.pi * 2, 2), 'n': rng.randint(7, 16), 's': rng.randint(1, 2 ** 31 - 1)})
print('vines', len(vines))

def fmt_pts(pts):
    return '[' + ', '.join('{ x: %d, y: %d }' % p for p in pts) + ']'

out = old[:m.start()] + 'lanterns: ' + fmt_pts(all_lanterns) + ',\n'
out += '  vines: [\n' + ''.join('    { x: %s, y: %s, a: %s, n: %d, s: %d },\n' % (v['x'], v['y'], v['a'], v['n'], v['s']) for v in vines) + '  ],\n'
out += old[m.end():]
import os
os.makedirs('C:/claude_p/goofy-horror/levels/halloween5', exist_ok=True)
open('C:/claude_p/goofy-horror/levels/halloween5/level.js', 'w', encoding='utf-8', newline='\n').write(out)
print('wrote level.js', len(out))
