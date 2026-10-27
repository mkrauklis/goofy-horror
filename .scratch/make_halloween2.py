import re
s = open('js/halloween1.js', encoding='utf-8').read()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:70])
    s = s.replace(a, b)

# --- level data, gate, keys
rep("isHalloweenUnlocked(1)", "isHalloweenUnlocked(2)")
rep("window.HALLOWEEN1", "window.HALLOWEEN2")
rep("goofy-horror-best-halloween1", "goofy-horror-best-halloween2")
rep("completeHalloween(1)", "completeHalloween(2)", 2)
rep("finish the previous Halloween level first.", "finish Halloween 1 first.")

rep("window.location.href = 'halloween2.html'", "window.location.href = 'halloween3.html'", 1)
rep("HAPPY HALLOWEEN &mdash; you got the candy out&hellip; on to the hospital", "THE VENTS ARE SILENT &mdash; the way out is open&hellip;")

# --- the ghost: roams at 1x, hunts at 1.9x
rep("""  // The Hollow Jack: it ambles around at 0.8x your speed, but the moment it
  // spots you it hunts at 1.6x -- and its eyesight is excellent (MONSTER_SIGHT).
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.6);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 0.8);""", """  // The Hush: it drifts around at exactly your speed, but the moment it
  // spots you it comes at 1.9x.
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.9);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 1);""")
rep("""  // It sees you across a whole corridor, flashlight or not, as long as nothing
  // solid is in the way.
  const MONSTER_SIGHT = 640;""", """  // It notices you from a fair way off down a clear line, flashlight or not.
  const MONSTER_SIGHT = 460;""")
rep("      radius: 19,\n", "      radius: 17,\n      vis: 0.05, // 0.05 = 95% transparent, 0.9 = almost solid\n")
rep("""  function updateMonster(m, now, dt) {
""", """  function updateMonster(m, now, dt) {
    // fade between nearly invisible (roaming) and nearly solid (hunting)
    m.vis += ((m.state === 'alert' ? 0.9 : 0.05) - m.vis) * Math.min(1, dt * 7);
""")

# --- fans instead of candy buckets
s = s.replace("LEVEL.buckets", "LEVEL.fans")
rep("// which candy buckets are collected", "// which vent fans are switched off")
rep("      if (ch === 'B') {", "      if (ch === 'F') {")
rep("`CANDY ${buttonsPressed.filter(Boolean).length}/${LEVEL.fans.length}`", "`FAN OFF ${buttonsPressed.filter(Boolean).length}/${LEVEL.fans.length}`")
rep("hudButtonsEl.textContent = `Candy:", "hudButtonsEl.textContent = `Fans off:")

# --- ducts and fan chambers are safe from the monster, and you hide in them
rep("    return ch === 'S' || ch === 'V';\n", "    return ch === 'S' || ch === 'V' || ch === 'F';\n")
rep("    if (ch === '#' || ch === 'S' || ch === 'V') return false;", "    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'F') return false;")

# --- hospital palette
rep("const FLOOR_SHADES = ['#b4541a', '#bb5c1e', '#c26523', '#b85a1c', '#bf6221', '#c76c28'];",
    "const FLOOR_SHADES = ['#7fa39f', '#86aba6', '#8db0ab', '#82a69f', '#89ada8', '#92b5b0'];")
rep("""          case '#': color = '#2a1633'; break;
          case 'S': color = '#8a4a2e'; break;
          case 'V': color = '#3a2a1c'; break;
          case 'E': color = '#d98a2e'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#4a2410'; break;""", """          case '#': color = '#27363b'; break;
          case 'S': color = '#a9c9bf'; break;
          case 'V': color = '#444c55'; break;
          case 'F': color = '#3a4149'; break;
          case 'E': color = '#c9a35a'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#2e3d4d'; break;""")
rep("""    if (ch === '#') return '#9a7ab0';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'V') return '#6a4a2a';
    return '#7a4416';""", """    if (ch === '#') return '#8aa0a8';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'V' || ch === 'F') return '#8a929c';
    return '#3f5f5b';""")

# --- decor and monster drawing
a = s.index("  // ---- Halloween decor ----")
b = s.index("  function drawTable(g, cx, cy) {")
s = s[:a] + open('.scratch/halloween2_decor.js', encoding='utf-8').read() + "\n" + s[b:]
a = s.index("  // The Hollow Jack: a tentacled thing wearing a hollowed-out pumpkin.")
b = s.index("  // A single limb: a thick rounded stroke from (hipX,hipY)")
s = s[:a] + open('.scratch/halloween2_monster.js', encoding='utf-8').read() + "\n" + s[b:]

rep("""    drawWindows(g, minTX, maxTX, minTY, maxTY, performance.now());
    LEVEL.fans.forEach((b, i) => { if (!buttonsPressed[i]) drawCandyBucket(g, tileCenter(b.x, b.y), performance.now()); });
""", """    drawCandies(g, minTX, maxTX, minTY, maxTY);
    drawBeds(g, minTX, maxTX, minTY, maxTY);
    LEVEL.fans.forEach((b, i) => drawFan(g, tileCenter(b.x, b.y), buttonsPressed[i], performance.now()));
""")
rep("    drawLanterns(g, minTX, maxTX, minTY, maxTY, performance.now());\n", "")

# --- lights: fluorescent lamps and the glow of the fans' own indicator
a = s.index("    // jack-o-lanterns and the orange windows glow on their own")
b = s.index("    players.forEach((pl) => {\n      const s = worldToScreen(pl.x, pl.y);\n      punchLight(maskCtx")
s = s[:a] + """    // flickering ceiling lamps, and a little light on each fan so you can find it in the duct
    LEVEL.lamps.forEach((l) => {
      const c = tileCenter(l.x, l.y), s = worldToScreen(c.x, c.y);
      if (s.x < -130 || s.x > VIEW_W + 130 || s.y < -130 || s.y > VIEW_H + 130) return;
      punchLight(maskCtx, s.x, s.y, 105, 0.5 * lampLevel(l, now));
    });
    LEVEL.fans.forEach((f) => {
      const c = tileCenter(f.x, f.y), s = worldToScreen(c.x, c.y);
      if (s.x < -90 || s.x > VIEW_W + 90 || s.y < -90 || s.y > VIEW_H + 90) return;
      punchLight(maskCtx, s.x, s.y, 60, 0.6);
    });

""" + s[b:]

# the ghost is faint when roaming, so the usual red-eye overlay would give it away:
# its own drawing handles the eyes in hard mode
rep("HM.monster(ctx, m, (c) => drawMonster(c, now, m))", "HM.monster(ctx, m, (c) => drawMonster(c, now, m), { eyes: false })")
open('js/halloween2.js', 'w', encoding='utf-8', newline='\n').write(s)
print('ok', len(s.split('\n')))
