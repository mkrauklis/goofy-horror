files = [
    'js/game.js', 'js/game2.js', 'js/game3.js', 'js/game4.js', 'js/game5.js',
    'js/game6.js', 'js/game7.js', 'js/game8.js', 'js/game9.js', 'js/game10.js',
    'js/game11.js', 'js/game12.js', 'js/game13.js', 'js/game14.js', 'js/game15.js',
]

for fn in files:
    with open(fn, encoding='utf-8') as f:
        src = f.read()

    def rep(old, new, count=1, label=None):
        global src
        n = src.count(old)
        assert n == count, f'{fn}: MISMATCH ({label or old[:50]!r}): found {n}, need {count}'
        src = src.replace(old, new, count)

    # 1. CRATE_ITEMS: add 'energy'
    rep("'shotgun-ammo'];", "'shotgun-ammo', 'energy'];", label='crate-items')

    # 2. new duration constant, next to RADAR_DURATION_MS
    rep(
        "  const RADAR_DURATION_MS = 10000;",
        "  const RADAR_DURATION_MS = 10000;\n"
        "  // An energy bar grants infinite stamina (no sprint drain, instant\n"
        "  // cure from exhausted) for this long -- same team-wide-buff\n"
        "  // convention as radar/scanner/night vision, not tied to one player.\n"
        "  const ENERGY_DURATION_MS = 10000;",
        label='duration-const',
    )

    # 3. new state var, next to radarUntil's declaration
    rep(
        "  let radarUntil = 0;",
        "  let radarUntil = 0;\n  let energyUntil = 0;",
        label='let-decl',
    )

    # 4. reset in resetLevel(), next to radarUntil's reset
    rep(
        "\n    radarUntil = 0;",
        "\n    radarUntil = 0;\n    energyUntil = 0;",
        label='reset',
    )

    # 5. updateStamina bypass
    rep(
        "  function updateStamina(p, now, dt, isMoving) {\n    if (p.moveState === 'exhausted') {",
        "  function updateStamina(p, now, dt, isMoving) {\n"
        "    if (now < energyUntil) {\n"
        "      p.moveState = (p.sprintActive && isMoving) ? 'sprinting' : 'normal';\n"
        "      p.stamina = STAMINA_MAX;\n"
        "      if (!isMoving) p.sprintActive = false;\n"
        "      return;\n"
        "    }\n"
        "    if (p.moveState === 'exhausted') {",
        label='stamina-bypass',
    )

    # 6. applyItemEffect: new 'energy' branch, appended to the if/else chain
    #    right before it closes (same closing brace the shotgun-ammo branch
    #    already ends on, regardless of what follows it in each file).
    rep(
        "        spawnFloatingText(x, y, 'AMMO FULL');\n      }\n    }",
        "        spawnFloatingText(x, y, 'AMMO FULL');\n"
        "      }\n"
        "    } else if (item === 'energy') {\n"
        "      energyUntil = now + ENERGY_DURATION_MS;\n"
        "      spawnFloatingText(x, y, 'ENERGY');\n"
        "      playItemChime(900);\n"
        "    }",
        label='apply-item-effect',
    )

    # 7. stamina bar glows gold while energy is active
    rep(
        "    const color = p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';",
        "    const color = performance.now() < energyUntil ? '#ffe27a'\n"
        "      : p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';",
        label='stamina-bar-color',
    )

    with open(fn, 'w', encoding='utf-8') as f:
        f.write(src)
    print(fn, 'OK')

print('all done')
