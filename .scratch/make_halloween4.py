s = open('js/halloween2.js', encoding='utf-8').read()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:90])
    s = s.replace(a, b)

# --- level data, gate, keys
rep("isHalloweenUnlocked(2)", "isHalloweenUnlocked(4)")
rep("finish Halloween 1 first.", "finish Halloween 3 first.")
rep("window.HALLOWEEN2", "window.HALLOWEEN4")
rep("goofy-horror-best-halloween2", "goofy-horror-best-halloween4")
rep("completeHalloween(2)", "completeHalloween(4)", 2)
rep("window.location.href = 'halloween3.html'", "window.location.href = 'index.html'")
rep("THE VENTS ARE SILENT &mdash; the way out is open&hellip;", "THE PUMPKINS BURN BLUE &mdash; the way out is open&hellip;")

# --- the monster: an Embergourd (a pumpkin) -- 0.8x roaming, 1.3x hunting, a fireball every 5 seconds
rep("""  // The Hush: it drifts around at exactly your speed, but the moment it
  // spots you it comes at 1.9x.
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.9);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 1);""", """  // The Embergourd: a pumpkin that rolls around at 0.8x your speed, speeds up
  // to 1.3x the moment it sees you, and spits a fireball (2.5x your speed)
  // once every 5 seconds while it's after you.
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.3);
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * 0.8);
  const FIREBALL_SPEED = HM.proj(PLAYER_SPEED * 2.5);
  const FIREBALL_EVERY_MS = 5000;
  const FIREBALL_WINDUP_MS = 500;
  const FIREBALL_LIFE_MS = 4000;
  const FIREBALL_RADIUS = 7;""")
rep("      vis: 0.05, // 0.05 = 95% transparent, 0.9 = almost solid\n", "      nextFireAt: 0,\n      windUpAt: 0,\n      castUntil: 0,\n")
rep("    // fade between nearly invisible (roaming) and nearly solid (hunting)\n    m.vis += ((m.state === 'alert' ? 0.9 : 0.05) - m.vis) * Math.min(1, dt * 7);\n", "")

# --- state: the bluelighter, the three green pumpkins, fireballs
rep("  let buttonsPressed = LEVEL.fans.map(() => false); // which vent fans are switched off",
    """  let hasLighter = false;                              // the team has found the bluelighter
  let litPumpkins = LEVEL.pumpkins.map(() => 0);       // 0 = unlit, otherwise the time it was lit
  let fireballs = [];""")
rep("      mon.frozenUntil = 0; mon.luredState = 'none'; mon.lureTarget = null; mon.eatingUntil = 0;",
    "      mon.frozenUntil = 0; mon.luredState = 'none'; mon.lureTarget = null; mon.eatingUntil = 0;\n      mon.nextFireAt = 0; mon.windUpAt = 0; mon.castUntil = 0;")
rep("    buttonsPressed = LEVEL.fans.map(() => false);\n    doorUnlocked = false;",
    "    hasLighter = false;\n    litPumpkins = LEVEL.pumpkins.map(() => 0);\n    fireballs = [];\n    doorUnlocked = false;")

# --- 2x2 crates ('B') are solid; no vents
rep("    if (ch === '#') return true;\n    if (ch === 'D') return !doorUnlocked;", "    if (ch === '#' || ch === 'B') return true;\n    if (ch === 'D') return !doorUnlocked;")
rep("    return ch === 'S' || ch === 'V' || ch === 'F';", "    return ch === 'S';")
rep("    if (ch === '#') return '#8aa0a8';", "    if (ch === '#') return '#8aa0a8';\n    if (ch === 'B') return '#a8793c';")
rep("    if (ch === 'V' || ch === 'F') return '#8a929c';\n", "")
rep("    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'F') return false;", "    if (ch === '#' || ch === 'S' || ch === 'B') return false;")
rep("      if (tileChar(t2.x, t2.y) === '#') return false;", "      const c2 = tileChar(t2.x, t2.y);\n      if (c2 === '#' || c2 === 'B') return false;")
rep("""    if (tileChar(tx - 1, ty) === '#') dx += 1;
    if (tileChar(tx + 1, ty) === '#') dx -= 1;
    if (tileChar(tx, ty - 1) === '#') dy += 1;
    if (tileChar(tx, ty + 1) === '#') dy -= 1;""", """    const solid = (cx, cy) => { const c = tileChar(cx, cy); return c === '#' || c === 'B'; };
    if (solid(tx - 1, ty)) dx += 1;
    if (solid(tx + 1, ty)) dx -= 1;
    if (solid(tx, ty - 1)) dy += 1;
    if (solid(tx, ty + 1)) dy -= 1;""")
rep("        if (tileChar(tile.x + dx, tile.y + dy) === '#') {", "        if (tileChar(tile.x + dx, tile.y + dy) === '#' || tileChar(tile.x + dx, tile.y + dy) === 'B') {")

# --- scanner points at the lighter, then the nearest unlit pumpkin, then the exit
a = s.index("  function nearestUnpressedButton(x, y) {")
b = s.index("  function applyItemEffect(item, x, y, now, p) {")
s = s[:a] + """  function nearestUnpressedButton(x, y) {
    if (doorUnlocked) return tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    if (!hasLighter) return tileCenter(LEVEL.lighter.x, LEVEL.lighter.y);
    let best = null, bestD = Infinity;
    LEVEL.pumpkins.forEach((pk, i) => {
      if (litPumpkins[i]) return;
      const c = tileCenter(pk.x, pk.y);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

""" + s[b:]

# --- picking up the lighter, lighting the pumpkins
a = s.index("      if (ch === 'F') {")
b = s.index("      if (ch === 'X' && doorUnlocked")
s = s[:a] + """      if (!hasLighter && !p.caught) {
        const lc = tileCenter(LEVEL.lighter.x, LEVEL.lighter.y);
        if (Math.hypot(p.x - lc.x, p.y - lc.y) < 26) {
          hasLighter = true;
          spawnFloatingText(lc.x, lc.y - 8, 'BLUELIGHTER FOUND');
          playItemChime(1100);
        }
      }
      if (hasLighter && !p.caught) {
        LEVEL.pumpkins.forEach((pk, i) => {
          if (litPumpkins[i]) return;
          const c = tileCenter(pk.x, pk.y);
          if (Math.hypot(p.x - c.x, p.y - c.y) >= 30) return;
          litPumpkins[i] = performance.now();
          const n = litPumpkins.filter(Boolean).length;
          spawnFloatingText(c.x, c.y - 14, `PUMPKIN LIT ${n}/${LEVEL.pumpkins.length}`);
          playButtonChime();
          if (n === LEVEL.pumpkins.length) {
            doorUnlocked = true;
            spawnFloatingText(p.x, p.y - 30, 'THE EXIT OPENS');
            playDoorUnlockChime();
          }
        });
      }
""" + s[b:]

# --- fireballs
fireball_logic = """  // ---- the Embergourd's fireballs ----
  let fireImpactAt = 0;
  function playFireball() {
    playTone(190, 0.3, 'sawtooth', 0.12);
    playTone(95, 0.4, 'sine', 0.16, 0.02);
    playTone(520, 0.14, 'square', 0.05, 0.04);
  }

  function fireTarget(m, now) {
    let best = null, bestD = Infinity;
    players.forEach((p) => {
      if (p.caught || isHidden(p) || isInSmoke(p, now)) return;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d <= MONSTER_SIGHT * 1.15 && d < bestD && hasLineOfSight(m.x, m.y, p.x, p.y)) { best = p; bestD = d; }
    });
    return best;
  }

  function emberBurst(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 110;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: 0.25 + Math.random() * 0.35, size: 1.6 + Math.random() * 2, col: '255,150,30' });
    }
  }

  function updateFireballs(now, dt) {
    monsters.forEach((m) => {
      if (now < m.frozenUntil || m.luredState !== 'none' || m.state !== 'alert') { m.windUpAt = 0; return; }
      if (m.windUpAt) {
        if (now >= m.windUpAt) {
          m.windUpAt = 0;
          const tgt = fireTarget(m, now);
          if (tgt) {
            const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy) || 1;
            fireballs.push({ x: m.x + (dx / d) * 18, y: m.y + (dy / d) * 18, vx: (dx / d) * FIREBALL_SPEED, vy: (dy / d) * FIREBALL_SPEED, born: now });
            m.nextFireAt = now + FIREBALL_EVERY_MS;
            m.castUntil = now + 160;
            playFireball();
          }
        }
        return;
      }
      if (now >= m.nextFireAt && fireTarget(m, now)) m.windUpAt = now + FIREBALL_WINDUP_MS;
    });

    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i];
      if (now - f.born > FIREBALL_LIFE_MS) { fireballs.splice(i, 1); continue; }
      const total = Math.hypot(f.vx, f.vy) * dt;
      const steps = Math.max(1, Math.ceil(total / 6));
      let dead = false;
      for (let k = 0; k < steps && !dead; k++) {
        f.x += (f.vx * dt) / steps;
        f.y += (f.vy * dt) / steps;
        const t = worldToTile(f.x, f.y);
        const ch = tileChar(t.x, t.y);
        if (ch === '#' || ch === 'B' || ch === 'S' || (ch === 'D' && !doorUnlocked)) { dead = true; break; }
        for (const p of players) {
          if (p.caught || isHidden(p) || now < p.invulnerableUntil) continue;
          if (Math.hypot(p.x - f.x, p.y - f.y) < PLAYER_RADIUS + FIREBALL_RADIUS) { triggerCaught(p, now); dead = true; break; }
        }
      }
      if (dead) { emberBurst(f.x, f.y); fireballs.splice(i, 1); }
    }
  }

"""
rep("  function updateCutscenes(now) {", fireball_logic + "  function updateCutscenes(now) {")
rep("      updateCatch(now);\n", "      updateCatch(now);\n      updateFireballs(now, dt);\n")
rep("      const alpha = 1 - pt.life / pt.maxLife;\n      g.beginPath();\n      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);\n      g.fillStyle = `rgba(160,15,20,${alpha})`;",
    "      const alpha = 1 - pt.life / pt.maxLife;\n      g.beginPath();\n      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);\n      g.fillStyle = `rgba(${pt.col || '160,15,20'},${alpha})`;")

# --- tiles: no vents, crates are floor underneath
rep("          case 'V': color = '#444c55'; break;\n          case 'F': color = '#3a4149'; break;\n", "")
a = s.index("        if (ch === 'V') {")
b = s.index("      }\n    }\n\n    const dx0 = doorBounds.x0")
s = s[:a].rstrip(' ') + s[b:]
rep("""    drawCandies(g, minTX, maxTX, minTY, maxTY);
    drawBeds(g, minTX, maxTX, minTY, maxTY);
    LEVEL.fans.forEach((b, i) => drawFan(g, tileCenter(b.x, b.y), buttonsPressed[i], performance.now()));
""", """    const nowT = performance.now();
    drawCandies(g, minTX, maxTX, minTY, maxTY);
    drawVines(g, minTX, maxTX, minTY, maxTY);
    drawBeds(g, minTX, maxTX, minTY, maxTY);
    drawLanterns(g, minTX, maxTX, minTY, maxTY, nowT);
    LEVEL.pumpkins.forEach((pk, i) => drawGreenPumpkin(g, pk, litPumpkins[i] > 0, litPumpkins[i], nowT, i));
    drawLighter(g, nowT);
""")
rep("    drawCrates(g);\n    drawMeatLure(g);", "    drawCrates(g);\n    drawBigCrates(g, minTX, maxTX, minTY, maxTY);\n    drawMeatLure(g);")

# --- the decor
dec = open('.scratch/h4_decor.js', encoding='utf-8').read()
a = s.index("  // An industrial vent fan sunk into the duct floor")
b = s.index("  // Flickering fluorescent tubes: mostly steady")
s = s[:a] + dec + s[b:]

# --- the monster drawing
mon = open('.scratch/h4_monster.js', encoding='utf-8').read()
a = s.index("  // The Hush: a ghost with tentacles and two black eyes.")
b = s.index("  // A single limb: a thick rounded stroke from (hipX,hipY)")
s = s[:a] + mon + s[b:]

# fireballs drawn above the floor, below the darkness
rep("    drawPlayers(ctx);\n    drawParticles(ctx);", "    drawPlayers(ctx);\n    drawFireballs(ctx, now);\n    drawParticles(ctx);")

# --- lights: lanterns, the pumpkins, the lighter, fireballs
rep("""    LEVEL.fans.forEach((f) => {
      const c = tileCenter(f.x, f.y), s = worldToScreen(c.x, c.y);
      if (s.x < -90 || s.x > VIEW_W + 90 || s.y < -90 || s.y > VIEW_H + 90) return;
      punchLight(maskCtx, s.x, s.y, 60, 0.6);
    });""", """    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y), s = worldToScreen(c.x + l.ox, c.y + l.oy);
      if (s.x < -90 || s.x > VIEW_W + 90 || s.y < -90 || s.y > VIEW_H + 90) return;
      punchLight(maskCtx, s.x, s.y, 72, 0.5 * (0.88 + 0.12 * Math.sin(now * 0.012 + i * 1.7)));
    });
    LEVEL.pumpkins.forEach((pk, i) => {
      const c = tileCenter(pk.x, pk.y), s = worldToScreen(c.x, c.y);
      if (s.x < -150 || s.x > VIEW_W + 150 || s.y < -150 || s.y > VIEW_H + 150) return;
      punchLight(maskCtx, s.x, s.y, litPumpkins[i] ? 125 : 48, litPumpkins[i] ? 0.8 : 0.4);
    });
    if (!hasLighter) {
      const c = tileCenter(LEVEL.lighter.x, LEVEL.lighter.y), s = worldToScreen(c.x, c.y);
      if (s.x > -100 && s.x < VIEW_W + 100 && s.y > -100 && s.y < VIEW_H + 100) punchLight(maskCtx, s.x, s.y, 80, 0.75);
    }
    fireballs.forEach((f) => {
      const s = worldToScreen(f.x, f.y);
      if (s.x < -90 || s.x > VIEW_W + 90 || s.y < -90 || s.y > VIEW_H + 90) return;
      punchLight(maskCtx, s.x, s.y, 85, 0.85);
    });
    monsters.forEach((m) => {
      const s = worldToScreen(m.x, m.y);
      if (s.x < -90 || s.x > VIEW_W + 90 || s.y < -90 || s.y > VIEW_H + 90) return;
      punchLight(maskCtx, s.x, s.y, m.state === 'alert' ? 70 : 45, 0.55);
    });""")
rep("    // flickering ceiling lamps, and a little light on each fan so you can find it in the duct", "    // flickering ceiling lamps, and the glow of lanterns, pumpkins, the lighter and the fire")
rep("    drawShotgunHud(vx, p);\n", "    drawShotgunHud(vx, p);\n    drawLighterHud(vx);\n")

# --- HUD
rep("""    const pressedCount = buttonsPressed.filter(Boolean).length;
    hudButtonsEl.textContent = `Fans off: ${pressedCount} / ${LEVEL.fans.length}`;
    hudButtonsEl.classList.toggle('done', pressedCount === LEVEL.fans.length);""", """    const lit = litPumpkins.filter(Boolean).length;
    hudButtonsEl.textContent = `Bluelighter: ${hasLighter ? 'got it' : 'find it'} | Pumpkins: ${lit} / ${LEVEL.pumpkins.length}`;
    hudButtonsEl.classList.toggle('done', doorUnlocked);""")

open('js/halloween4.js', 'w', encoding='utf-8', newline='\n').write(s)
print('ok', len(s.split('\n')), [w for w in ('LEVEL.fans', 'buttonsPressed', 'drawFan(', 'm.vis', "'V'", "'F'") if w in s])
