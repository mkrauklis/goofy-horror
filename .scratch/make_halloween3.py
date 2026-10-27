s = open('js/halloween2.js', encoding='utf-8').read()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:80])
    s = s.replace(a, b)

# --- level data, gate, keys
rep("isHalloweenUnlocked(2)", "isHalloweenUnlocked(3)")
rep("finish Halloween 1 first.", "finish Halloween 2 first.")
rep("window.HALLOWEEN2", "window.HALLOWEEN3")
rep("goofy-horror-best-halloween2", "goofy-horror-best-halloween3")
rep("completeHalloween(2)", "completeHalloween(3)", 2)
rep("window.location.href = 'halloween3.html'", "window.location.href = 'index.html'")
rep("THE VENTS ARE SILENT &mdash; the way out is open&hellip;", "THE FAN STOPS &mdash; the way out is open&hellip;")

# --- the lever and the giant fan replace the vent fans
rep("  let buttonsPressed = LEVEL.fans.map(() => false); // which vent fans are switched off", """  // The giant fan: both players hold a lever each (in a solo run, just the first
  // lever) at the same time for LEVER_S seconds to stop it. Let go of either and
  // the progress drains away fast.
  const LEVER_S = 5;
  let leverProgress = 0;
  let leversHeld = LEVEL.levers.map(() => false);
  let leverTickAt = 0;
  let fanSpin = 0;
  let fanSpeed = 1;
  let goo = []; // the Seepers' trail of purple goo""")
rep("    buttonsPressed = LEVEL.fans.map(() => false);\n    doorUnlocked = false;", "    leverProgress = 0;\n    leversHeld = LEVEL.levers.map(() => false);\n    fanSpin = 0;\n    fanSpeed = 1;\n    doorUnlocked = false;")
a = s.index("  function nearestUnpressedButton(x, y) {")
b = s.index("  function applyItemEffect(item, x, y, now, p) {")
s = s[:a] + """  function nearestUnpressedButton(x, y) {
    if (doorUnlocked) return tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    let best = null, bestD = Infinity;
    LEVEL.levers.forEach((lv, i) => {
      if (PLAYER_MODE === 1 && i > 0) return;
      const c = tileCenter(lv.x, lv.y);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

""" + s[b:]
a = s.index("      if (ch === 'F') {")
b = s.index("      if (ch === 'X' && doorUnlocked")
s = s[:a] + s[b:]
rep("  function updateTriggers() {", """  function updateLevers(now, dt) {
    const need = PLAYER_MODE === 1 ? [0] : [0, 1];
    LEVEL.levers.forEach((lv, i) => {
      const c = tileCenter(lv.x, lv.y);
      leversHeld[i] = players.some((p) => !p.caught && Math.hypot(p.x - c.x, p.y - c.y) < TILE * 1.3);
    });
    if (!doorUnlocked) {
      if (need.every((i) => leversHeld[i])) {
        leverProgress = Math.min(1, leverProgress + dt / LEVER_S);
        if (now >= leverTickAt) { leverTickAt = now + 350; playTone(110 + leverProgress * 200, 0.1, 'square', 0.06); }
        if (leverProgress >= 1) {
          doorUnlocked = true;
          const fc = tileCenter(LEVEL.fan.x, LEVEL.fan.y);
          spawnFloatingText(fc.x, fc.y - 130, 'THE FAN IS OFF');
          playDoorUnlockChime();
        }
      } else {
        leverProgress = Math.max(0, leverProgress - (dt / LEVER_S) * 3);
      }
    }
    const target = doorUnlocked ? 0 : 1 - 0.85 * leverProgress;
    fanSpeed += (target - fanSpeed) * Math.min(1, dt * (doorUnlocked ? 0.9 : 3));
    fanSpin += dt * 16 * fanSpeed;
  }

  function updateTriggers() {""")
rep("      updateTriggers();\n", "      updateTriggers();\n      updateLevers(now, dt);\n")

# --- the giant fan is solid
rep("    if (ch === '#') return true;\n    if (ch === 'D') return !doorUnlocked;", "    if (ch === '#' || ch === 'W') return true;\n    if (ch === 'D') return !doorUnlocked;")
rep("    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'F') return false;", "    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'F' || ch === 'W') return false;")
rep("      if (tileChar(t2.x, t2.y) === '#') return false;", "      const c2 = tileChar(t2.x, t2.y);\n      if (c2 === '#' || c2 === 'W') return false;")

# --- steel ducts instead of a hospital
a = s.index("        let color;\n        switch (ch) {\n          case '#': color = '#27363b'; break;")
b = s.index("\n      }\n    }\n\n    const dx0 = doorBounds.x0")
s = s[:a] + "        drawVentTile(g, ch, x, y, px, py);" + s[b:]
rep("""    if (ch === '#') return '#8aa0a8';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'V' || ch === 'F') return '#8a929c';
    return '#3f5f5b';""", """    if (ch === '#') return '#8a929c';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'W') return '#c8d0d8';
    return '#4a525c';""")

dec2 = open('.scratch/halloween2_decor.js', encoding='utf-8').read()
candy = dec2[dec2.index("  function hash2"):dec2.index("  // A hospital bed")]
candy = candy.replace("(k === 0 ? 0.5 : 0.22)", "(k === 0 ? 0.06 : 0.02)")   # candy only now and then
lamp = dec2[dec2.index("  // Flickering fluorescent tubes"):]
decor = open('.scratch/halloween3_decor.js', encoding='utf-8').read().replace("//@@CANDY@@", candy).replace("//@@LAMP@@", lamp)
a = s.index("  // ---- Hospital decor ----")
b = s.index("  function drawTable(g, cx, cy) {")
s = s[:a] + decor + "\n" + s[b:]

rep("""    drawCandies(g, minTX, maxTX, minTY, maxTY);
    drawBeds(g, minTX, maxTX, minTY, maxTY);
    LEVEL.fans.forEach((b, i) => drawFan(g, tileCenter(b.x, b.y), buttonsPressed[i], performance.now()));
""", """    const nowT = performance.now();
    drawCandies(g, minTX, maxTX, minTY, maxTY);
    drawGiantFan(g, LEVEL.fan, fanSpin, fanSpeed, nowT);
    LEVEL.levers.forEach((lv, i) => drawLever(g, lv, leversHeld[i], PLAYER_MODE === 2 || i === 0, nowT));
""")

# --- lights: caged lamps, and the levers and the fan are lit
rep("""    LEVEL.fans.forEach((f) => {
      const c = tileCenter(f.x, f.y), s = worldToScreen(c.x, c.y);
      if (s.x < -90 || s.x > VIEW_W + 90 || s.y < -90 || s.y > VIEW_H + 90) return;
      punchLight(maskCtx, s.x, s.y, 60, 0.6);
    });""", """    LEVEL.levers.forEach((lv) => {
      const c = tileCenter(lv.x, lv.y), s = worldToScreen(c.x, c.y);
      if (s.x < -110 || s.x > VIEW_W + 110 || s.y < -110 || s.y > VIEW_H + 110) return;
      punchLight(maskCtx, s.x, s.y, 85, 0.7);
    });
    {
      const c = tileCenter(LEVEL.fan.x, LEVEL.fan.y), s = worldToScreen(c.x, c.y);
      if (s.x > -200 && s.x < VIEW_W + 200 && s.y > -200 && s.y < VIEW_H + 200) punchLight(maskCtx, s.x, s.y, 150, 0.45);
    }""")
rep("    // flickering ceiling lamps, and a little light on each fan so you can find it in the duct", "    // flickering caged lamps, and the levers and the fan are lit so you can find them")

# --- HUD
rep("""    const pressedCount = buttonsPressed.filter(Boolean).length;
    hudButtonsEl.textContent = `Fans off: ${pressedCount} / ${LEVEL.fans.length}`;
    hudButtonsEl.classList.toggle('done', pressedCount === LEVEL.fans.length);""", """    hudButtonsEl.textContent = `Fan: ${(leverProgress * LEVER_S).toFixed(1)} / ${LEVER_S}s`;
    hudButtonsEl.classList.toggle('done', doorUnlocked);""")
# ---- the monsters: two slimy purple mutations (the Seepers) ----
rep("""  // The Hush: it drifts around at exactly your speed, but the moment it
  // spots you it comes at 1.9x.
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.9);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 1);""", """  // The Seepers: two of them. They ooze along at 0.6x your speed, and the moment
  // one sees you it screams and comes at 1.2x.
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.2);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 0.6);""")
rep("      radius: 17,\n      vis: 0.05, // 0.05 = 95% transparent, 0.9 = almost solid\n", "      radius: 16,\n")
rep("    // fade between nearly invisible (roaming) and nearly solid (hunting)\n    m.vis += ((m.state === 'alert' ? 0.9 : 0.05) - m.vis) * Math.min(1, dt * 7);\n", "")
rep("  const monsters = [makeMonster(0)];", "  const monsters = LEVEL.monsterSpawns.map((_, i) => makeMonster((i * 9) % LEVEL.patrolPoints.length));")
rep("const spawns = [LEVEL.monsterSpawn];", "const spawns = LEVEL.monsterSpawns;")
rep("      mon.path = []; mon.pathIndex = 0; mon.nextRepathAt = 0;", "      mon.path = []; mon.pathIndex = 0; mon.nextRepathAt = performance.now() + i * 97; mon.screamUntil = 0; mon.gooX = undefined;")
rep("        m.state = 'alert';\n        m.alertUntil = now + ALERT_GRACE_MS;", "        if (m.state !== 'alert') screamAt(m, now);   // it sees you: a low scream\n        m.state = 'alert';\n        m.alertUntil = now + ALERT_GRACE_MS;")
# the goo trail: dropped as they move, drawn under everything else
rep("    drawCandies(g, minTX, maxTX, minTY, maxTY);\n    drawGiantFan", "    drawCandies(g, minTX, maxTX, minTY, maxTY);\n    drawGoo(g, nowT);\n    drawGiantFan")
rep("      updateLevers(now, dt);\n", "      updateLevers(now, dt);\n      updateGoo(now);\n")
rep("    monsters.forEach((m) => HM.monster(ctx, m, (c) => drawMonster(c, now, m), { eyes: false }));", "    monsters.forEach((m) => HM.monster(ctx, m, (c) => drawMonster(c, now, m)));")
mon3 = open('.scratch/halloween3_monster.js', encoding='utf-8').read()
a = s.index("  // The Hush: a ghost with tentacles and two black eyes.")
b = s.index("  // A single limb: a thick rounded stroke from (hipX,hipY)")
s = s[:a] + mon3 + "\n" + s[b:]
# reset the trail with the level
rep("    leverProgress = 0;\n    leversHeld = LEVEL.levers.map(() => false);\n    fanSpin = 0;", "    goo = [];\n    leverProgress = 0;\n    leversHeld = LEVEL.levers.map(() => false);\n    fanSpin = 0;")

# many monsters path-finding: build the walkable graph once, and use a head index instead of Array.shift()
rep("  function buildMonsterGraph() {", """  let graphCache = null;
  let graphCacheDoor = null;
  function getMonsterGraph() {
    if (!graphCache || graphCacheDoor !== doorUnlocked) { graphCache = buildMonsterGraph(); graphCacheDoor = doorUnlocked; }
    return graphCache;
  }

  function buildMonsterGraph() {""")
rep("        const graph = buildMonsterGraph();", "        const graph = getMonsterGraph();")
rep("      const graph = buildMonsterGraph();", "      const graph = getMonsterGraph();")
rep("""    const queue = [start];
    let found = false;
    while (queue.length) {
      const cur = queue.shift();""", """    const queue = [start];
    let head = 0;
    let found = false;
    while (head < queue.length) {
      const cur = queue[head++];""")
open('js/halloween3.js', 'w', encoding='utf-8', newline='\n').write(s)
print('ok', len(s.split('\n')), [w for w in ('LEVEL.fans', 'LEVEL.beds', 'drawFan(', 'buttonsPressed', 'drawBeds') if w in s])
