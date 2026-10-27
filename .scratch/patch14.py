fn = 'js/game14.js'
with open(fn, encoding='utf-8') as f:
    src = f.read()

def rep(old, new, count=1, label=None):
    global src
    n = src.count(old)
    assert n == count, "MISMATCH (%s): found %d, need %d" % (label or old[:60], n, count)
    src = src.replace(old, new, count)

rep("if (window.GoofyStory && !window.GoofyStory.isUnlocked(13)) {",
    "if (window.GoofyStory && !window.GoofyStory.isUnlocked(14)) {")
rep("const LEVEL = window.LEVEL13;", "const LEVEL = window.LEVEL14;")
rep("const BEST_TIME_KEY = 'goofy-horror-best-level13';",
    "const BEST_TIME_KEY = 'goofy-horror-best-level14';")
rep("if (window.GoofyStory) window.GoofyStory.completeLevel(13);",
    "if (window.GoofyStory) window.GoofyStory.completeLevel(14);", count=2)
rep("setTimeout(() => { window.location.href = 'index.html'; }, 2000);",
    "setTimeout(() => { window.location.href = 'index.html'; }, 2000);")

rep("const MONSTER_SPEED = PLAYER_SPEED * 1.1;", "const MONSTER_SPEED = PLAYER_SPEED * 2;")
rep("      radius: 8,", "      radius: 15,")
rep("""  const MONSTER_COUNT = 5;
  const monsters = Array.from({ length: MONSTER_COUNT }, (_, i) =>
    makeMonster(Math.floor((i * LEVEL.patrolPoints.length) / MONSTER_COUNT))
  );""",
    """  const MONSTER_COUNT = 2;
  const monsters = Array.from({ length: MONSTER_COUNT }, (_, i) =>
    makeMonster(Math.floor((i * LEVEL.patrolPoints.length) / MONSTER_COUNT))
  );""")

with open(fn, 'w', encoding='utf-8') as f:
    f.write(src)
print('stage1 ok')
