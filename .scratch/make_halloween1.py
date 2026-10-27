import re
src=open('js/game.js',encoding='utf-8').read()
s=src
def rep(a,b,count=1):
    global s
    assert s.count(a)==count,(s.count(a),a[:70])
    s=s.replace(a,b)

# --- gate / level data
rep("""  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(1)) {""","""  // The Halloween chapter has its own unlock chain (see js/story.js): the
  // first level is always open, each later one needs the one before it.
  if (window.GoofyStory && !window.GoofyStory.isHalloweenUnlocked(1)) {""")
rep("finish the previous level first.","finish the previous Halloween level first.")
rep("const LEVEL = window.LEVEL1;","const LEVEL = window.HALLOWEEN1;")

# --- the creature: slow roamer, fast hunter, great eyesight
rep("  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 2.5);\n  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 0.5);",
"""  // The Hollow Jack: it ambles around at 0.8x your speed, but the moment it
  // spots you it hunts at 1.6x -- and its eyesight is excellent (MONSTER_SIGHT).
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.6);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 0.8);""")
rep("  const FLASHLIGHT_RADIUS = 230;\n","  // It sees you across a whole corridor, flashlight or not, as long as nothing\n  // solid is in the way.\n  const MONSTER_SIGHT = 640;\n")
rep("if (d <= FLASHLIGHT_RADIUS && hasLineOfSight","if (d <= MONSTER_SIGHT && hasLineOfSight")
rep("const BEST_TIME_KEY = 'goofy-horror-best-level1';","const BEST_TIME_KEY = 'goofy-horror-best-halloween1';")
rep("  const monsters = [makeMonster(0), makeMonster(Math.floor(LEVEL.patrolPoints.length / 2))];","  const monsters = [makeMonster(0)];")
rep("      radius: 16,\n      seed: Math.random() * 100,","      radius: 19,\n      seed: Math.random() * 100,")
rep("const spawns = [LEVEL.monsterSpawn, LEVEL.monsterSpawn2 || LEVEL.monsterSpawn];","const spawns = [LEVEL.monsterSpawn];")

# --- candy buckets instead of buttons
s=s.replace("LEVEL.buttons","LEVEL.buckets")
rep("let buttonsPressed = [false, false, false];","let buttonsPressed = LEVEL.buckets.map(() => false); // which candy buckets are collected")
rep("    buttonsPressed = [false, false, false];\n    doorUnlocked = false;","    buttonsPressed = LEVEL.buckets.map(() => false);\n    doorUnlocked = false;")
rep("""          buttonsPressed[idx] = true;
          playButtonChime();""","""          buttonsPressed[idx] = true;
          spawnFloatingText(p.x, p.y - 18, `CANDY ${buttonsPressed.filter(Boolean).length}/${LEVEL.buckets.length}`);
          playButtonChime();""")
rep("if (window.GoofyStory) window.GoofyStory.completeLevel(1);\n        setTimeout(() => { window.location.href = 'level2.html'; }, 2000);",
    "if (window.GoofyStory) window.GoofyStory.completeHalloween(1);\n        setTimeout(() => { window.location.href = 'index.html'; }, 2500);")
rep("      if (window.GoofyStory) window.GoofyStory.completeLevel(1);\n    }\n\n    if (hudTimerEl)","      if (window.GoofyStory) window.GoofyStory.completeHalloween(1);\n    }\n\n    if (hudTimerEl)")
rep("hudButtonsEl.textContent = `Buttons: ${pressedCount} / ${LEVEL.buckets.length}`;","hudButtonsEl.textContent = `Candy: ${pressedCount} / ${LEVEL.buckets.length}`;")
rep("messageEl.innerHTML = 'FACILITY CLEARED &mdash; warping to Level 2&hellip;';","messageEl.innerHTML = 'HAPPY HALLOWEEN &mdash; you got the candy out&hellip;';")

# --- orange floors, purple walls
rep("const FLOOR_SHADES = ['#4c4c53', '#525258', '#58585f', '#5e5e66', '#54545c', '#605f68'];","const FLOOR_SHADES = ['#b4541a', '#bb5c1e', '#c26523', '#b85a1c', '#bf6221', '#c76c28'];")
rep("""          case '#': color = '#262629'; break;
          case 'S': color = floorShade(x, y); break;
          case 'V': color = '#2a3038'; break;
          case 'E': color = '#3a301f'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;""","""          case '#': color = '#2a1633'; break;
          case 'S': color = '#8a4a2e'; break;
          case 'V': color = '#3a2a1c'; break;
          case 'E': color = '#d98a2e'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#4a2410'; break;""")
rep("""    if (ch === '#') return '#8f8f9a';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'V') return '#4a6a86';
    return '#3c3c46';""","""    if (ch === '#') return '#9a7ab0';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'V') return '#6a4a2a';
    return '#7a4416';""")
rep("          g.strokeStyle = 'rgba(0,0,0,0.4)';\n          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);","          g.strokeStyle = 'rgba(0,0,0,0.45)';\n          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);")

# --- draw candy buckets (replaces the button dots)
a=s.index("    LEVEL.buckets.forEach((b, i) => {\n      const c = tileCenter(b.x, b.y);\n      g.beginPath();")
b=s.index("    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);",a)
s=s[:a]+"    drawWindows(g, minTX, maxTX, minTY, maxTY, performance.now());\n    LEVEL.buckets.forEach((b, i) => { if (!buttonsPressed[i]) drawCandyBucket(g, tileCenter(b.x, b.y), performance.now()); });\n\n"+s[b:]
rep("    drawSafeZone(g);\n    drawCorpses(g);","    drawSafeZone(g);\n    drawLanterns(g, minTX, maxTX, minTY, maxTY, performance.now());\n    drawCorpses(g);")

# --- new decor / monster drawing, inserted before drawTable
decor = open('.scratch/halloween1_decor.js',encoding='utf-8').read()
rep("  function drawTable(g, cx, cy) {", decor+"\n  function drawTable(g, cx, cy) {")

# --- replace the monster drawing (and drop the now-unused blob/eye code)
a=s.index("  function drawMonster(g, t, m) {")
b=s.index("  // A single limb: a thick rounded stroke from (hipX,hipY)")
s=s[:a]+open('.scratch/halloween1_monster.js',encoding='utf-8').read()+"\n"+s[b:]

# --- lights from jack-o-lanterns / windows
rep("""    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl), 1);""","""    // jack-o-lanterns and the orange windows glow on their own
    LEVEL.lanterns.forEach((l) => {
      const c = tileCenter(l.x, l.y), s = worldToScreen(c.x, c.y);
      if (s.x < -140 || s.x > VIEW_W + 140 || s.y < -140 || s.y > VIEW_H + 140) return;
      const f = 0.9 + 0.1 * Math.sin(now * 0.011 + l.x * 3.1 + l.y);
      punchLight(maskCtx, s.x, s.y, 120 * f, 0.8);
    });
    LEVEL.windows.forEach((w) => {
      const c = tileCenter(w.x, w.y), s = worldToScreen(c.x, c.y);
      if (s.x < -100 || s.x > VIEW_W + 100 || s.y < -100 || s.y > VIEW_H + 100) return;
      punchLight(maskCtx, s.x, s.y, 70, 0.55);
    });

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl), 1);""")
open('js/halloween1.js','w',encoding='utf-8',newline='\n').write(s)
print('ok',len(s.split('\n')))
