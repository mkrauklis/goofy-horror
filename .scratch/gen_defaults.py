"""Builds js/customdefaults.js: the starter design for each of the 18 designer slots.

Slot 4  = the Magmatron mini boss (replaces the old level 4) -- designed to the user's spec.
Slot 32 = Level 5, the volcanic hallways with the Flare       -- designed to the user's spec.
Everything else is a playable starter for the user to redesign in editor.html.
"""
import json
import random
from collections import deque

OUT = 'C:/claude_p/goofy-horror/js/customdefaults.js'


# ---------------------------------------------------------------- parts
def part(t, c, **kw):
    d = {'t': t, 'c': c, 'mir': 0, 'wob': 0, 'a': 1}
    spec = {
        'circle': {'x': 0, 'y': 0, 'r': 0.5},
        'ellipse': {'x': 0, 'y': 0, 'rx': 0.7, 'ry': 0.4, 'rot': 0},
        'tri': {'x': 0.6, 'y': 0, 'r': 0.5, 'rot': 0},
        'rect': {'x': 0, 'y': 0, 'w': 0.8, 'h': 0.4, 'rot': 0},
        'eye': {'x': 0.5, 'y': 0.25, 'r': 0.2},
        'tentacle': {'x': -0.4, 'y': 0.3, 'len': 1.1, 'w': 0.18, 'rot': 150},
        'mouth': {'x': 0.65, 'y': 0, 'w': 0.5, 'h': 0.3, 'rot': 0},
        'glow': {'x': 0, 'y': 0, 'r': 0.9},
    }[t]
    d.update(spec)
    d.update(kw)
    return d


def monster(name, desc, size, parts, ai, **extra):
    m = {'name': name, 'desc': desc, 'size': size, 'rotate': True, 'parts': parts, 'ai': ai}
    m.update(extra)
    return m


def ai(kind='stalker', patrol=0.55, chase=1.45, detect=150, grace=3, count=1, blink=0, aura=False):
    return {'type': kind, 'patrol': patrol, 'chase': chase, 'detect': detect, 'grace': grace,
            'count': count, 'blink': blink, 'aura': aura}


# ---------------------------------------------------------------- monster templates
def t_blob(base, light, eye):
    return [
        part('circle', base, r=1.0),
        part('circle', light, x=-0.15, y=-0.15, r=0.6, a=0.55, wob=0.25),
        part('eye', eye, x=0.5, y=0.3, r=0.2, mir=1),
        part('mouth', '#efe8d8', x=0.8, y=0, w=0.5, h=0.3),
    ]


def t_crawler(base, dark, eye):
    legs = []
    for rot in (55, 90, 125):
        legs.append(part('tentacle', dark, x=0.1 - (rot - 90) / 200, y=0.45, len=0.95, w=0.1, rot=rot, mir=1, wob=0.15))
    return legs + [
        part('ellipse', base, rx=1.05, ry=0.62),
        part('ellipse', dark, x=-0.5, rx=0.5, ry=0.5),
        part('tri', dark, x=1.0, y=0.2, r=0.4, rot=-20, mir=1),
        part('eye', eye, x=0.6, y=0.25, r=0.15, mir=1),
    ]


def t_wraith(base, glow, eye):
    return [
        part('glow', glow, r=1.5),
        part('tentacle', base, x=-0.5, y=0.0, len=1.6, w=0.3, rot=180, wob=0.4),
        part('tentacle', base, x=-0.4, y=0.3, len=1.4, w=0.22, rot=160, mir=1, wob=0.5),
        part('ellipse', base, rx=1.1, ry=0.6, a=0.8, wob=0.1),
        part('eye', eye, x=0.55, y=0.22, r=0.17, mir=1),
        part('mouth', '#d8d0e0', x=0.8, y=0, w=0.35, h=0.2),
    ]


def t_brute(base, plate, horn, eye):
    return [
        part('tri', horn, x=0.8, y=0.65, r=0.7, rot=40, mir=1),
        part('circle', base, r=1.0),
        part('rect', plate, x=-0.1, y=0, w=1.2, h=0.5, rot=0),
        part('rect', plate, x=0.2, y=0.55, w=0.7, h=0.25, rot=25, mir=1),
        part('eye', eye, x=0.6, y=0.2, r=0.14, mir=1),
        part('mouth', '#e8e0cc', x=0.85, y=0, w=0.45, h=0.25),
    ]


def t_eyeball(skin, iris):
    return [
        part('tentacle', '#6a2a3a', x=-0.7, y=0.3, len=1.2, w=0.14, rot=165, mir=1, wob=0.4),
        part('circle', skin, r=1.0),
        part('rect', '#a02a3a', x=-0.2, y=0.4, w=0.7, h=0.04, rot=30, mir=1),
        part('eye', iris, x=0.4, y=0.0, r=0.5),
    ]


def t_serpent(base, belly, eye):
    ps = []
    xs = [(-2.0, 0.28), (-1.5, 0.36), (-1.0, 0.46), (-0.5, 0.56)]
    for i, (x, r) in enumerate(xs):
        ps.append(part('circle', base if i % 2 == 0 else belly, x=x, y=0, r=r, wob=0.15))
    ps += [
        part('circle', base, x=0.15, r=0.65),
        part('eye', eye, x=0.5, y=0.25, r=0.15, mir=1),
        part('tri', '#c43a4a', x=1.0, y=0, r=0.35, rot=0),
    ]
    return ps


# ---------------------------------------------------------------- the two specified monsters
MAGMATRON = monster(
    'Magmatron',
    'A hulking furnace of black rock and molten seams. It spits fire, locks into glossy obsidian and ricochets round the room, and lobs blobs of magma. Every third attack it chokes up a bomb.',
    34,
    [
        part('tentacle', '#5a1c10', x=-0.55, y=0.5, len=1.3, w=0.26, rot=150, mir=1, wob=0.35),
        part('tri', '#2a1612', x=0.9, y=0.55, r=0.62, rot=35, mir=1),
        part('tri', '#2a1612', x=0.2, y=0.95, r=0.65, rot=85, mir=1),
        part('tri', '#2a1612', x=-0.6, y=0.85, r=0.6, rot=130, mir=1),
        part('glow', '#ff5a1a', r=1.5, wob=0.2),
        part('circle', '#34170f', r=1.0),
        part('ellipse', '#ff7a1a', x=-0.1, y=0.25, rx=0.7, ry=0.07, rot=18, mir=1, wob=0.1),
        part('ellipse', '#ffb43d', x=-0.3, y=0.5, rx=0.4, ry=0.05, rot=-24, mir=1, wob=0.1),
        part('circle', '#ff6a1a', x=-0.2, y=0.0, r=0.4, a=0.55, wob=0.3),
        part('eye', '#ffd25a', x=0.5, y=0.3, r=0.2, mir=1),
        part('mouth', '#ffe08a', x=0.85, y=0, w=0.55, h=0.35),
    ],
    ai(kind='hunter', patrol=0.55, chase=1.0, detect=300, grace=3),
    boss={'hp': 25, 'attacks': ['fireballs', 'obsidian', 'magma'], 'rest': 6, 'speed': 0.7, 'bombEvery': 3, 'bombDmg': 5, 'pause': 1.5},
    intro={'effect': 'magma', 'floor': 'basalt', 'color': '#ff6a2a'},
)

FLARE = monster(
    'The Flare',
    'A roiling ball of living magma that roams the hallways. Once it spots you it flares up and runs you down at 1.8x speed.',
    24,
    [
        part('glow', '#ff5a1a', r=1.7, wob=0.2),
        part('tentacle', '#ff6a1a', x=-0.6, y=0.0, len=1.7, w=0.34, rot=180, wob=0.55),
        part('tentacle', '#ff8a22', x=-0.5, y=0.35, len=1.4, w=0.24, rot=158, mir=1, wob=0.6),
        part('circle', '#7a240c', r=1.0, wob=0.05),
        part('circle', '#d8460f', x=0.05, y=0.0, r=0.8, wob=0.15),
        part('circle', '#ff8a22', x=0.1, y=0.0, r=0.55, wob=0.25),
        part('circle', '#ffe08a', x=0.12, y=0.0, r=0.28, wob=0.35),
        part('tri', '#ff9a30', x=0.1, y=0.82, r=0.55, rot=70, mir=1, wob=0.4),
        part('tri', '#ffd25a', x=-0.4, y=0.75, r=0.45, rot=110, mir=1, wob=0.5),
        part('tri', '#ff9a30', x=0.7, y=0.55, r=0.4, rot=40, mir=1, wob=0.4),
        part('eye', '#3a0a00', x=0.55, y=0.28, r=0.17, mir=1),
    ],
    ai(kind='stalker', patrol=0.6, chase=1.8, detect=190, grace=3.5),
)


# ---------------------------------------------------------------- maps
class Grid:
    def __init__(self, w, h, fill='#'):
        self.w, self.h = w, h
        self.g = [[fill] * w for _ in range(h)]

    def carve(self, x0, y0, x1, y1, ch='.'):
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                self.g[y][x] = ch

    def rows(self):
        return [''.join(r) for r in self.g]

    def blocked(self, x, y):
        return self.g[y][x] in '#L'

    def reach(self, sx, sy):
        seen = {(sx, sy)}
        q = deque([(sx, sy)])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.w and 0 <= ny < self.h and (nx, ny) not in seen and not self.blocked(nx, ny):
                    seen.add((nx, ny))
                    q.append((nx, ny))
        return seen


def lattice(rx, ry, seed, rw=9, rh=7, gap=5, extra=0.3, lava=False):
    """Rooms joined by 3-wide corridors. Returns (Grid, rooms, edges)."""
    rnd = random.Random(seed)
    m = 2
    W = m * 2 + rx * rw + (rx - 1) * gap
    H = m * 2 + ry * rh + (ry - 1) * gap
    g = Grid(W, H)
    rooms = {}
    for i in range(rx):
        for j in range(ry):
            x0 = m + i * (rw + gap)
            y0 = m + j * (rh + gap)
            g.carve(x0, y0, x0 + rw - 1, y0 + rh - 1)
            rooms[(i, j)] = (x0, y0, x0 + rw - 1, y0 + rh - 1)
    # spanning tree + a few extra links
    seen = {(0, 0)}
    stack = [(0, 0)]
    edges = set()
    while stack:
        cur = stack[-1]
        opts = [(cur[0] + dx, cur[1] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                if 0 <= cur[0] + dx < rx and 0 <= cur[1] + dy < ry and (cur[0] + dx, cur[1] + dy) not in seen]
        if not opts:
            stack.pop()
            continue
        nxt = rnd.choice(opts)
        seen.add(nxt)
        edges.add(tuple(sorted((cur, nxt))))
        stack.append(nxt)
    for i in range(rx):
        for j in range(ry):
            for dx, dy in ((1, 0), (0, 1)):
                n = (i + dx, j + dy)
                if n in rooms and tuple(sorted(((i, j), n))) not in edges and rnd.random() < extra:
                    edges.add(tuple(sorted(((i, j), n))))
    corridors = []
    for a, b in edges:
        ra, rb = rooms[a], rooms[b]
        if a[1] == b[1]:  # horizontal
            cy = (ra[1] + ra[3]) // 2
            g.carve(ra[2] + 1, cy - 1, rb[0] - 1, cy + 1)
            corridors.append(('h', ra[2] + 1, rb[0] - 1, cy))
        else:
            cx = (ra[0] + ra[2]) // 2
            g.carve(cx - 1, ra[3] + 1, cx + 1, rb[1] - 1)
            corridors.append(('v', ra[3] + 1, rb[1] - 1, cx))
    return g, rooms, edges, corridors, rnd


def centre(room):
    return ((room[0] + room[2]) // 2, (room[1] + room[3]) // 2)


def room_dist(rooms, edges, start):
    adj = {k: [] for k in rooms}
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    d = {start: 0}
    q = deque([start])
    while q:
        c = q.popleft()
        for n in adj[c]:
            if n not in d:
                d[n] = d[c] + 1
                q.append(n)
    return d


def build_level(rx, ry, seed, title, blurb, mon, style=None, lava=False, keys=3, pillars=True):
    for attempt in range(60):
        g, rooms, edges, corridors, rnd = lattice(rx, ry, seed + attempt * 101, lava=lava)
        start = (0, 0)
        dist = room_dist(rooms, edges, start)
        far = sorted(rooms, key=lambda k: -dist[k])
        exit_room = far[0]
        cands = [k for k in far[1:] if k != start]
        key_rooms = cands[:keys]
        mon_room = None
        for k in sorted(rooms, key=lambda k: dist[k]):
            if k not in key_rooms and k != exit_room and k != start and dist[k] >= 2:
                mon_room = k
                break
        mon_room = mon_room or far[len(far) // 2]
        # pillars in ordinary rooms for cover
        special = {start, exit_room, mon_room, *key_rooms}
        if pillars:
            for k, r in rooms.items():
                if k in special:
                    continue
                cx, cy = centre(r)
                if rnd.random() < 0.7:
                    g.carve(cx - 1, cy - 1, cx, cy, '#')
        # lava: patches in corridors (leaving one lane free) and pools in some rooms
        if lava:
            for kind, a, b, c in corridors:
                if rnd.random() < 0.75 and b - a >= 3:
                    run = rnd.randint(3, min(5, b - a + 1))
                    s0 = rnd.randint(a, b - run + 1)
                    lanes = rnd.choice([(-1, 0), (0, 1), (-1, 1)])
                    for t in range(s0, s0 + run):
                        for l in lanes:
                            if kind == 'h':
                                g.g[c + l][t] = 'L'
                            else:
                                g.g[t][c + l] = 'L'
            for k, r in rooms.items():
                if k in special and k != mon_room:
                    continue
                if rnd.random() < 0.6:
                    pw, ph = rnd.randint(2, 3), rnd.randint(2, 3)
                    px = rnd.randint(r[0] + 2, r[2] - pw - 1)
                    py = rnd.randint(r[1] + 2, r[3] - ph - 1)
                    g.carve(px, py, px + pw - 1, py + ph - 1, 'L')
        # place symbols
        sx, sy = rooms[start][0] + 2, rooms[start][1] + 2
        g.carve(sx - 1, sy - 1, sx + 3, sy + 2, 'S')
        g.g[sy][sx] = '1'
        g.g[sy][sx + 1] = '2'
        ex, ey = centre(rooms[exit_room])
        g.g[ey][ex] = 'X'
        mx, my = centre(rooms[mon_room])
        for yy in range(my - 1, my + 1):
            for xx in range(mx - 1, mx + 1):
                if g.g[yy][xx] in '#L':
                    g.g[yy][xx] = '.'
        g.g[my][mx] = 'M'
        for k in key_rooms:
            kx, ky = centre(rooms[k])
            if g.g[ky][kx] in '#L':
                g.g[ky][kx] = '.'
            g.g[ky][kx] = 'K'
        pats = 0
        for k, r in rooms.items():
            if k in (start,):
                continue
            px, py = centre(r)
            if g.g[py][px] == '.':
                g.g[py][px] = 'P'
                pats += 1
        # everything important must be reachable without crossing lava
        seen = g.reach(sx, sy)
        targets = [(ex, ey), (mx, my)] + [centre(rooms[k]) for k in key_rooms]
        if all(t in seen for t in targets):
            design = {
                'v': 1, 'kind': 'level', 'title': title, 'blurb': blurb,
                'grid': g.rows(), 'monster': mon,
            }
            if style:
                design['style'] = style
            return design
    raise SystemExit('could not build ' + title)


def build_arena(seed, cols=30, rows=20, pillars=4, door=True):
    g = Grid(cols, rows)
    g.carve(1, 1, cols - 4, rows - 2)
    rnd = random.Random(seed)
    placed = 0
    tries = 0
    while placed < pillars and tries < 200:
        tries += 1
        px, py = rnd.randint(5, cols - 9), rnd.randint(3, rows - 5)
        if abs(px - 3) < 5 and abs(py - rows // 2) < 4:
            continue
        g.carve(px, py, px + 1, py + 1, '#')
        placed += 1
    cy = rows // 2
    g.carve(cols - 3, cy - 1, cols - 2, cy, '.')
    g.carve(cols - 3, cy - 1, cols - 3, cy, 'D' if door else '.')
    g.g[cy - 1][cols - 2] = 'X'
    g.g[cy - 1][2] = '1'
    g.g[cy][2] = '2'
    g.g[cy][3] = 'S'
    g.g[cy - 1][3] = 'S'
    g.g[rows // 2][cols // 2 + 3] = 'M'
    return g


def arena_design(title, blurb, mon, style=None, reward=None, seed=3, **kw):
    g = build_arena(seed, **kw)
    d = {'v': 1, 'kind': 'miniboss', 'title': title, 'blurb': blurb, 'grid': g.rows(), 'monster': mon}
    if style:
        d['style'] = style
    if reward:
        d['reward'] = reward
    return d


def boss_stats(hp, attacks, rest=4, speed=0.75, every=0, dmg=1, pause=1.5):
    return {'hp': hp, 'attacks': attacks, 'rest': rest, 'speed': speed, 'bombEvery': every, 'bombDmg': dmg, 'pause': pause}


# ---------------------------------------------------------------- the 18 designs
D = {}

# --- chapter 1: the Facility (ashen / volcanic)
mag = json.loads(json.dumps(MAGMATRON))
D[4] = arena_design(
    'Magmatron',
    'The facility\u2019s old smelter has woken up. A tiny obsidian pit, and something made of magma in the middle of it.',
    mag, style='ashen', reward={'gun': 'revolver'}, seed=11, cols=26, rows=16, pillars=3,
)

D[32] = build_level(
    5, 4, 700, 'Smelter Run',
    'Hallways of cooled obsidian, with rivers of magma poured across the floor. Step in it and you burn. The Flare roams the halls.',
    FLARE, style='ashen', lava=True, keys=3, pillars=True,
)

D[33] = build_level(
    5, 4, 910, 'The Pump Room',
    'A flooded maintenance wing, all pipes and standing water. Something blind down here listens for footsteps \u2014 sprint and it hears you from far away.',
    monster('Drainling', 'Blind and bloated, it hunts by sound. Walk softly.', 22,
            t_blob('#6a7a8a', '#9ab0c0', '#ffd25a'), ai('listener', 0.5, 1.5, 150, 3.5)),
    keys=3,
)

# --- chapter 2: the Undercroft
D[9] = arena_design(
    'The Ossuary Warden',
    'A round chamber stacked with bones. The warden has been waiting a very long time.',
    monster('Ossuary Warden', 'A towering knight of fused bone. It charges, shakes the room and slams the floor.', 36,
            t_brute('#cfc7b0', '#8a8472', '#e8e0cc', '#ff4a3a'),
            ai('hunter', 0.5, 1.0, 300, 3),
            boss=boss_stats(7, ['charge', 'shockwave', 'slam'], 4.5, 0.7),
            intro={'effect': 'slash', 'floor': 'stone', 'color': '#c9a94a'}),
    seed=21, cols=30, rows=20, pillars=5,
)
D[34] = build_level(
    5, 4, 1210, 'Catacombs',
    'Cobbled halls under the old keep. Shapes move between the sarcophagi.',
    monster('Crypt Creeper', 'It waits motionless between the statues, then lunges the instant you get close.', 20,
            t_crawler('#4a3d56', '#2a2233', '#ff5a5a'), ai('ambusher', 0.4, 1.9, 120, 2.5)),
    keys=3,
)
D[35] = build_level(
    6, 4, 1330, 'The Long Dark',
    'The torches here have all gone out. Something that eats the light follows you.',
    monster('Gloomer', 'Its presence swallows your torchlight whole. The closer it is, the darker it gets.', 24,
            t_wraith('#2a2236', '#6a4a9a', '#e8e0ff'), ai('stalker', 0.55, 1.5, 170, 3, aura=True)),
    keys=4,
)

# --- chapter 3: the Frost
D[14] = arena_design(
    'Rimeback',
    'A frozen cistern. Ice creaks under the weight of whatever lives here.',
    monster('Rimeback', 'A glacier-backed beast. It spins up a storm of ice, charges and sends shockwaves through the frozen floor.', 36,
            t_brute('#7da6c4', '#b8d8ea', '#e8f6ff', '#aef4ff'),
            ai('hunter', 0.5, 1.0, 300, 3),
            boss=boss_stats(8, ['charge', 'spin', 'shockwave'], 4.5, 0.7),
            intro={'effect': 'bite', 'floor': 'frost', 'color': '#8fd8ff'}),
    reward={'gun': 'flamethrower'}, seed=31, cols=30, rows=20, pillars=4,
)
D[36] = build_level(
    5, 5, 1510, 'Whiteout',
    'A blizzard has buried the lower wing. It blinks through the snow.',
    monster('Snowblink', 'It flickers out of sight and reappears right behind you.', 20,
            t_wraith('#9ec2dc', '#d8f0ff', '#2a6a9a'), ai('stalker', 0.5, 1.5, 160, 3, blink=5)),
    keys=3,
)
D[37] = build_level(
    5, 5, 1630, 'Black Ice',
    'Sheets of ice and a pack of things that hunt together.',
    monster('Frostpack', 'They always travel in threes.', 16,
            t_crawler('#8ab4d0', '#4a6a86', '#fff6a0'), ai('stalker', 0.55, 1.4, 150, 3, count=3)),
    keys=3,
)

# --- chapter 4: the Flood
D[19] = arena_design(
    'The Tidegrub',
    'A drained reservoir. The last of the water is still moving.',
    monster('Tidegrub', 'A bloated, many-mouthed grub from the deep. It spits fireballs of boiling gas, charges, and slams the floor.', 34,
            t_blob('#3f7a72', '#7fd0c0', '#ffd25a'),
            ai('hunter', 0.5, 1.0, 300, 3),
            boss=boss_stats(8, ['slam', 'fireballs', 'charge'], 4.5, 0.7),
            intro={'effect': 'bite', 'floor': 'flood', 'color': '#4fd0c0'}),
    seed=41, cols=30, rows=20, pillars=4,
)
D[38] = build_level(
    5, 5, 1710, 'Cistern Walk',
    'Catwalks over black water.',
    monster('Eelwraith', 'A long, slick shape that glides after you.', 20,
            t_serpent('#2f5a60', '#4a8a88', '#ffe08a'), ai('hunter', 0.5, 1.15, 200, 3)),
    keys=3,
)
D[39] = build_level(
    6, 4, 1830, 'The Drowned Wing',
    'Half the corridors are underwater.',
    monster('Brine Mother', 'She stands perfectly still, until you take a step too close.', 24,
            t_eyeball('#8ab0a8', '#2a4a6a'), ai('ambusher', 0.4, 1.8, 130, 3)),
    keys=4,
)

# --- chapter 5: the Overgrowth
D[24] = arena_design(
    'Thornmother',
    'A greenhouse choked with roots, and the thing that grows them.',
    monster('Thornmother', 'A bramble queen. She whirls thorned arms, sends out rings of seeds and slams the earth.', 36,
            t_brute('#3f5a2a', '#2a3d1a', '#7aa040', '#ffe05a'),
            ai('hunter', 0.5, 1.0, 300, 3),
            boss=boss_stats(8, ['spin', 'slam', 'shockwave'], 4.5, 0.7),
            intro={'effect': 'slash', 'floor': 'moss', 'color': '#9be04a'}),
    seed=51, cols=30, rows=20, pillars=6,
)
D[40] = build_level(
    5, 5, 1910, 'The Hedge Maze',
    'Overgrown corridors. Something is waiting in the leaves.',
    monster('Leafcutter', 'A hunting swarm in one shape.', 18,
            t_crawler('#4a6a2a', '#2a3d1a', '#ffe05a'), ai('listener', 0.55, 1.6, 170, 3)),
    keys=3,
)
D[41] = build_level(
    6, 4, 2030, 'Rootworks',
    'The roots have swallowed the old pipes.',
    monster('Bloomer', 'A flower that watches. It never blinks.', 22,
            t_eyeball('#a85a8a', '#3a1a2a'), ai('stalker', 0.5, 1.5, 180, 3.5, count=2)),
    keys=3,
)

# --- chapter 6: the Rooftops
D[29] = arena_design(
    'Gutterwing',
    'A rooftop in the wind, and a gargoyle that came loose.',
    monster('Gutterwing', 'A stone gargoyle that dives, fires bolts of lightning and spins its wings.', 34,
            t_brute('#6a6a78', '#4a4a58', '#8a8a98', '#ffb43d'),
            ai('hunter', 0.5, 1.0, 300, 3),
            boss=boss_stats(9, ['charge', 'fireballs', 'spin'], 4.5, 0.75),
            intro={'effect': 'slash', 'floor': 'roof', 'color': '#ff9a4a'}),
    seed=61, cols=30, rows=20, pillars=3,
)
D[42] = build_level(
    6, 4, 2110, 'Chimney Row',
    'Rooftop after rooftop, and a shape in the smoke.',
    monster('Soot Hound', 'Faster than you. Don\u2019t let it see you.', 18,
            t_serpent('#3a3a44', '#55555f', '#ff7a3a'), ai('stalker', 0.5, 1.7, 170, 3)),
    keys=3,
)
D[43] = build_level(
    6, 5, 2230, 'The Last Gable',
    'The final stretch before the gargoyle. Something big has been following you across the roofs.',
    monster('Slate Titan', 'It hunts relentlessly, and it is huge.', 30,
            t_brute('#55555f', '#3a3a44', '#8a8a98', '#ff4a3a'), ai('hunter', 0.5, 1.1, 220, 3)),
    keys=4,
)

for k, d in D.items():
    d['id'] = k


# ---------------------------------------------------------------- write
js = ('// Starter designs for the designer slots (mini bosses 4/9/14/19/24/29 and levels 32-43).\n'
      '// Generated by .scratch/gen_defaults.py -- the Magmatron (4) and the Flare\u2019s level (32) are\n'
      '// designed to spec; the rest are playable starters to redesign in editor.html. A design you\n'
      '// save in the editor lives in localStorage and overrides these.\n'
      'window.CUSTOM_DEFAULTS = ' + json.dumps({str(k): D[k] for k in sorted(D)}, indent=None, separators=(',', ':')) + ';\n')
open(OUT, 'w', encoding='utf-8').write(js)
print('wrote', OUT, len(js))
