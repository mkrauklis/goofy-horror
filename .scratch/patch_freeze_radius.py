import re

# Boss-fight levels excluded on purpose: single `boss` object in a
# visible-whole-arena fight (game15's phase-2 chase specifically relies
# on freezing the boss even when it's far down the hallway).
FILES = [
    'js/game.js', 'js/game2.js', 'js/game3.js', 'js/game4.js', 'js/game6.js',
    'js/game7.js', 'js/game8.js', 'js/game9.js', 'js/game11.js', 'js/game12.js',
    'js/game13.js', 'js/game14.js', 'js/game16.js', 'js/game17.js', 'js/game18.js',
    'js/game19.js', 'js/game21.js', 'js/game22.js', 'js/game23.js', 'js/game24.js',
]

DURATION_RE = re.compile(r'(  const FREEZE_DURATION_MS = \d+;\n)')
RADIUS_LINE = '  const FREEZE_RADIUS_TILES = 15; // freezes only reach monsters this close to where the item was used\n'

PATTERNS = [
    (
        re.compile(r"monsters\.forEach\(\(m\) => \{ m\.frozenUntil = now \+ FREEZE_DURATION_MS; \}\);"),
        "monsters.forEach((m) => { if (Math.hypot(m.x - x, m.y - y) <= FREEZE_RADIUS_TILES * TILE) m.frozenUntil = now + FREEZE_DURATION_MS; });",
    ),
    (
        re.compile(r"nearestMonster\(x, y\)\.frozenUntil = now \+ FREEZE_DURATION_MS;"),
        "{ const target = nearestMonster(x, y); if (Math.hypot(target.x - x, target.y - y) <= FREEZE_RADIUS_TILES * TILE) target.frozenUntil = now + FREEZE_DURATION_MS; }",
    ),
    (
        re.compile(r"monster\.frozenUntil = now \+ FREEZE_DURATION_MS;"),
        "if (Math.hypot(monster.x - x, monster.y - y) <= FREEZE_RADIUS_TILES * TILE) monster.frozenUntil = now + FREEZE_DURATION_MS;",
    ),
    (
        re.compile(r"monster\.slowedUntil = now \+ FREEZE_DURATION_MS;"),
        "if (Math.hypot(monster.x - x, monster.y - y) <= FREEZE_RADIUS_TILES * TILE) monster.slowedUntil = now + FREEZE_DURATION_MS;",
    ),
]

report = []
for path in FILES:
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    orig = src

    n_dur = len(DURATION_RE.findall(src))
    src = DURATION_RE.sub(lambda mo: mo.group(1) + RADIUS_LINE, src, count=1)

    n_pat = 0
    for rx, repl in PATTERNS:
        matches = len(rx.findall(src))
        if matches:
            src = rx.sub(repl, src)
            n_pat += matches

    changed = src != orig
    report.append((path, n_dur, n_pat, changed))
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)

for r in report:
    print(r)
