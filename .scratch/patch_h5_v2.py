import re

P = 'C:/claude_p/goofy-horror/js/halloween5.js'
s = open(P, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a))
    s = s.replace(a, b)


def block(start, end, new):
    global s
    i = s.index(start)
    j = s.index(end, i)
    s = s[:i] + new + s[j:]


# ---------- renames: bite -> hit, ash -> spore ----------
for a, b in [
    (r'\bBITE_DAMAGE\b', 'HIT_DAMAGE'), (r'\bBITE_RADIUS\b', 'HIT_RADIUS'), (r'\bBITE_COOLDOWN_MS\b', 'HIT_COOLDOWN_MS'),
    (r'\bupdateBites\b', 'updateHits'), (r'\bbiteReadyAt\b', 'hitReadyAt'), (r'\bplayBiteSound\b', 'playHitSound'),
    (r'\bupdateAshAttack\b', 'updateSporeAttack'), (r'\bupdateAsh\b', 'updateSpore'),
    (r'\bdrawAshClouds\b', 'drawSporeClouds'), (r'\bdrawAshDanger\b', 'drawSporeDanger'),
    (r'\bashClouds\b', 'sporeClouds'), (r'\bashSince\b', 'sporeSince'),
    (r'\bASH_(COUNT|WARN_MS|LIFE_MS|RADIUS|KILL_MS|SLOW_MS|SLOW_MULT)\b', r'SPORE_\1'),
    (r"'ash'", "'spore'"),
]:
    s = re.sub(a, b, s)

# ---------- constants ----------
rep("""  // The boss: the Pumpkin King -- a huge orange pumpkin, 3x3 tiles across, with
  // a fire burning in its mouth.
  const BOSS_RADIUS = 48;""", """  // The boss: the Pumpkin King -- a huge orange pumpkin, 4.5x4.5 tiles across
  // (50% bigger than it started), with a fire burning in its mouth.
  const BOSS_RADIUS = 72;""")
rep("  const PHASE2_NAME_COLOR = '#ff6a2a';\n  const PHASE2_SUBTITLE = 'ABLAZE';", "  const PHASE2_NAME_COLOR = '#7be04a';\n  const PHASE2_SUBTITLE = 'FLOURISHED';")
rep("""  // Every 5th attack ends with the boss stunned for 7.5 seconds. That's the
  // only time you can hurt it: run up and take a bite out of it (10 damage).""", """  // Every 5th attack ends with the boss stunned for 7.5 seconds. That's the
  // only time you can hurt it: walk up and hit it (5 damage).""")
rep("  const BITE_DAMAGE = 10;", "  const HIT_DAMAGE = 5;") if 'BITE_DAMAGE' in s else rep("  const HIT_DAMAGE = 10;", "  const HIT_DAMAGE = 5;")
rep("  const HIT_COOLDOWN_MS = 1100; // per player, between bites", "  const HIT_COOLDOWN_MS = 1100; // per player, between hits")
rep("  const CHASE_SPEED = PLAYER_SPEED * 1.3;\n", """  const CHASE_SPEED = PLAYER_SPEED * 1.3;

  // Attack 4 -- the vine whirl: it ricochets off the arena wall at 2x your speed
  // for 10 seconds, swinging 5-tile vines round itself (7 of them once it has
  // flourished, 4 before).
  const WHIP_MS = 10000;
  const WHIP_SPEED = PLAYER_SPEED * 2;
  const WHIP_SPIN = 1.7;            // radians per second
  const WHIP_GROW_MS = 700;         // the vines unfurl over this long
  const WHIP_VINES = 4;
  const WHIP_VINES_FLOURISHED = 7;
  const VINE_LEN = TILE * 5;
  const VINE_SEGS = 12;
  const VINE_HALF_WIDTH = 8;
""")
rep("  // Attack 4 (ablaze phase only) -- three 5x5 clouds of choking ash. Stay in", "  // Attack 5 (flourished phase only) -- three 5x5 clouds of poisonous spores. Stay in")
rep("? SPORE_SLOW_MULT : 1; // ash slows you by 30%", "? SPORE_SLOW_MULT : 1; // spores slow you by 30%")

# ---------- boss state ----------
rep("      phase: 'idle', // 'idle' | 'spiral' | 'scream' | 'eruption' | 'spore' | 'stunned'", "      phase: 'idle', // 'idle' | 'spiral' | 'scream' | 'eruption' | 'whip' | 'spore' | 'stunned'")
rep("      chasing: false,\n      trailDist: 0,\n    };", "      chasing: false,\n      trailDist: 0,\n      // vine whirl\n      vx: 0, vy: 0, whipAngle: 0,\n    };")

# ---------- hitting it ----------
rep("    spawnFloatingText(boss.x, boss.y - boss.radius - 12, `BITE! -${dmg}`);", "    spawnFloatingText(boss.x, boss.y - boss.radius - 12, `HIT! -${dmg}`);")
rep("  // ======================= biting (the only way to hurt it) =======================", "  // ======================= hitting it (only while it's stunned) =======================") if "biting (the only way to hurt it)" in s else None
rep("'ABLAZE');", "'FLOURISHED');")
rep("// the cutscene shouldn't eat your bite window", "// the cutscene shouldn't eat your hit window")
rep("'STUNNED -- BITE IT!'", "'STUNNED -- HIT IT!'")
rep("g.fillText('BITE IT!', boss.x, by + 22);", "g.fillText('HIT IT!', boss.x, by + 22);")
rep("'STUNNED — BITE IT!", "'STUNNED — HIT IT!") if "'STUNNED — BITE IT!" in s else None
s = s.replace("STUNNED — BITE IT! ", "STUNNED — HIT IT! ")
rep("'Phase: 2 — ABLAZE'", "'Phase: 2 — FLOURISHED'")
rep("'THE PUMPKIN KING BURNS OUT&hellip;<br>HAPPY HALLOWEEN!'", "'THE PUMPKIN KING WILTS&hellip;<br>HAPPY HALLOWEEN!'")
rep("    // the bites that have been taken out of it\n", "    // the chunks that have been smashed out of it\n")

# ---------- the attack cycle ----------
rep("  const PHASE1_ATTACKS = ['spiral', 'scream', 'eruption'];", "  const PHASE1_ATTACKS = ['spiral', 'scream', 'eruption', 'whip'];")
rep("    } else if (kind === 'spore') {\n", """    } else if (kind === 'whip') {
      const t = nearestPlayer(boss.x, boss.y);
      const a = Math.atan2(t.y - boss.y, t.x - boss.x) + (Math.random() - 0.5) * 0.9;
      boss.vx = Math.cos(a) * WHIP_SPEED; boss.vy = Math.sin(a) * WHIP_SPEED;
      boss.whipAngle = Math.random() * Math.PI * 2;
      spawnFloatingText(boss.x, boss.y - boss.radius - 14, 'VINE WHIRL!');
      playScream();
    } else if (kind === 'spore') {
""")
rep("  function updateEruptionAttack(now) {", """  // Attack 4: it bounces round the arena at 2x speed, ricocheting off the wall
  // (with a little random english so the path never repeats), vines swinging.
  function updateWhipAttack(now, dt) {
    const elapsed = now - boss.phaseStartedAt;
    boss.whipAngle += dt * WHIP_SPIN;
    const nx = boss.x + boss.vx * dt, ny = boss.y + boss.vy * dt;
    const limit = ARENA_R - boss.radius * 0.7;
    const dx = nx - ARENA_CX, dy = ny - ARENA_CY, d = Math.hypot(dx, dy);
    if (d > limit) {
      const ux = dx / d, uy = dy / d;
      const dot = boss.vx * ux + boss.vy * uy;
      if (dot > 0) {                                            // heading into the wall: reflect
        boss.vx -= 2 * dot * ux; boss.vy -= 2 * dot * uy;
        const j = (Math.random() - 0.5) * 0.35, cj = Math.cos(j), sj = Math.sin(j);
        const rx = boss.vx * cj - boss.vy * sj, ry = boss.vx * sj + boss.vy * cj;
        boss.vx = rx; boss.vy = ry;
        spawnEmberBurst(boss.x + ux * boss.radius * 0.8, boss.y + uy * boss.radius * 0.8, 10, 200);
        playChompThud(0);
      }
    }
    const vl = Math.hypot(boss.vx, boss.vy) || 1;
    boss.lookDir = { x: boss.vx / vl, y: boss.vy / vl };
    moveBoss(nx, ny);
    if (elapsed >= WHIP_MS) finishAttack(now);
  }

  // The points along swinging vine i, from the boss's edge out to 5 tiles. It
  // trails behind the way it's swinging, with a little ripple, and unfurls
  // over the first WHIP_GROW_MS.
  function whipVineCount() { return boss.phase2 ? WHIP_VINES_FLOURISHED : WHIP_VINES; }
  function vinePoints(i, now) {
    const n = whipVineCount();
    const grow = clamp((now - boss.phaseStartedAt) / WHIP_GROW_MS, 0, 1);
    const base = boss.whipAngle + (i / n) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= VINE_SEGS; k++) {
      const f = k / VINE_SEGS;
      const a = base - f * 0.75 + Math.sin(now * 0.008 + f * 5 + i * 1.3) * 0.07 * f;
      const dist = boss.radius * 0.8 + f * VINE_LEN * grow;
      pts.push({ x: boss.x + Math.cos(a) * dist, y: boss.y + Math.sin(a) * dist });
    }
    return pts;
  }
  function distToSegment(px, py, a, b) {
    const sx = b.x - a.x, sy = b.y - a.y;
    const len2 = sx * sx + sy * sy || 1;
    const t = clamp(((px - a.x) * sx + (py - a.y) * sy) / len2, 0, 1);
    return Math.hypot(px - (a.x + sx * t), py - (a.y + sy * t));
  }
  function updateWhipHits(now) {
    if (boss.phase !== 'whip' || boss.defeated || now < boss.frozenUntil) return;
    const n = whipVineCount();
    const reach = VINE_HALF_WIDTH + PLAYER_RADIUS * 0.7;
    const vines = [];
    for (let i = 0; i < n; i++) vines.push(vinePoints(i, now));
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      for (const pts of vines) {
        for (let k = 1; k < pts.length; k++) {
          if (distToSegment(p.x, p.y, pts[k - 1], pts[k]) < reach) { triggerCaught(p, now); return; }
        }
      }
    });
  }

  function updateEruptionAttack(now) {""")
rep("      case 'eruption': updateEruptionAttack(now); break;\n", "      case 'eruption': updateEruptionAttack(now); break;\n      case 'whip': updateWhipAttack(now, dt); break;\n")
rep("        updateFireballs(now, dt);\n", "        updateFireballs(now, dt);\n        updateWhipHits(now);\n")

# ---------- fire palette: blue once it has flourished ----------
rep("  const FIRE_COLORS = ['#ffe27a', '#ffb02e', '#ff8a1e', '#ff5a1a', '#ff3a10', '#fff2b0'];", "  const FIRE_COLORS = ['#ffe27a', '#ffb02e', '#ff8a1e', '#ff5a1a', '#ff3a10', '#fff2b0'];\n  const BLUE_FIRE_COLORS = ['#e8faff', '#9ad8ff', '#4aa8ff', '#2a78ff', '#1a4aff', '#ffffff'];")
rep("        color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],", "        color: (boss.phase2 ? BLUE_FIRE_COLORS : FIRE_COLORS)[Math.floor(Math.random() * FIRE_COLORS.length)],")
rep("  function drawFlameTongue(g, x, y, w, h, t, seed) {", "  function drawFlameTongue(g, x, y, w, h, t, seed, blue) {")
rep("    const layers = [['#ff3a10', 1], ['#ff8a1e', 0.72], ['#ffd25a', 0.46], ['#fff6c8', 0.22]];", "    const layers = blue ? [['#1a3aff', 1], ['#3a8aff', 0.72], ['#8ad0ff', 0.46], ['#eefaff', 0.22]]\n      : [['#ff3a10', 1], ['#ff8a1e', 0.72], ['#ffd25a', 0.46], ['#fff6c8', 0.22]];")
# trail
rep("      g.fillStyle = `rgba(255,120,30,${0.28 * a})`;", "      const bl = boss.phase2;\n      g.fillStyle = bl ? `rgba(60,140,255,${0.28 * a})` : `rgba(255,120,30,${0.28 * a})`;")
rep("      g.fillStyle = `rgba(255,${190 - 80 * age | 0},60,${0.95 * a * flick})`;", "      g.fillStyle = bl ? `rgba(${120 + 60 * age | 0},${200 - 40 * age | 0},255,${0.95 * a * flick})` : `rgba(255,${190 - 80 * age | 0},60,${0.95 * a * flick})`;")
# fireballs
rep("""      halo.addColorStop(0, 'rgba(255,170,50,0.55)'); halo.addColorStop(1, 'rgba(255,100,20,0)');""", """      const bl = boss.phase2;
      halo.addColorStop(0, bl ? 'rgba(80,170,255,0.55)' : 'rgba(255,170,50,0.55)'); halo.addColorStop(1, bl ? 'rgba(30,90,255,0)' : 'rgba(255,100,20,0)');""")
rep("      g.fillStyle = '#ff5a1a';                                  // tail", "      g.fillStyle = bl ? '#1a5aff' : '#ff5a1a';                 // tail")
rep("      g.fillStyle = '#ff9a2e';\n      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();\n      g.fillStyle = '#ffe27a';\n      g.beginPath(); g.arc(R * 0.1, 0, R * 0.6, 0, Math.PI * 2); g.fill();",
    "      g.fillStyle = bl ? '#4aa8ff' : '#ff9a2e';\n      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();\n      g.fillStyle = bl ? '#bfeaff' : '#ffe27a';\n      g.beginPath(); g.arc(R * 0.1, 0, R * 0.6, 0, Math.PI * 2); g.fill();")
# eruptions
rep("      glow.addColorStop(0, `rgba(255,170,50,${0.55 * rise})`); glow.addColorStop(1, 'rgba(255,60,20,0.16)');", "      glow.addColorStop(0, boss.phase2 ? `rgba(90,180,255,${0.55 * rise})` : `rgba(255,170,50,${0.55 * rise})`); glow.addColorStop(1, boss.phase2 ? 'rgba(30,70,255,0.16)' : 'rgba(255,60,20,0.16)');")
rep("      tongues.forEach((tg) => drawFlameTongue(g, tg.x, tg.y + 6, 22, tg.h, now, tg.i * 1.9 + c.x));", "      tongues.forEach((tg) => drawFlameTongue(g, tg.x, tg.y + 6, 22, tg.h, now, tg.i * 1.9 + c.x, boss.phase2));")
# muzzle flash
rep("      gl.addColorStop(0, `rgba(255,220,120,${0.8 * fl})`); gl.addColorStop(1, 'rgba(255,100,20,0)');", "      gl.addColorStop(0, boss.phase2 ? `rgba(180,230,255,${0.8 * fl})` : `rgba(255,220,120,${0.8 * fl})`); gl.addColorStop(1, boss.phase2 ? 'rgba(40,110,255,0)' : 'rgba(255,100,20,0)');")

# ---------- spore clouds (were ash) ----------
block("  // Ash clouds: a flashing circle first", "  // a ring filling up round a player who's standing in the ash", """  // Spore clouds: a flashing circle first, then a swirling cloud of poisonous green spores.
  function drawSporeClouds(g, now) {
    sporeClouds.forEach((gp) => {
      if (now < gp.startAt) {
        const on = Math.floor((now - (gp.startAt - SPORE_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(gp.x, gp.y, SPORE_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(150,230,60,0.3)' : 'rgba(150,230,60,0.08)'; g.fill();
        g.strokeStyle = on ? '#8adf3a' : 'rgba(150,230,80,0.4)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const life = clamp((gp.endAt - now) / 1000, 0, 1);
      const grow = clamp((now - gp.startAt) / 500, 0, 1);
      const cols = ['100,160,36', '140,200,56', '70,120,28', '180,226,96'];
      g.save();
      g.beginPath(); g.arc(gp.x, gp.y, SPORE_RADIUS * grow, 0, Math.PI * 2);
      g.fillStyle = `rgba(50,92,22,${0.42 * life})`; g.fill();   // a dark green base so it stands out on the pale floor
      for (let i = 0; i < 20; i++) {
        const a = i * 2.4 + now * 0.0004 * (i % 2 ? 1 : -1);
        const rad = SPORE_RADIUS * 0.66 * Math.sqrt((i + 1) / 20) * grow;
        const px = gp.x + Math.cos(a) * rad, py = gp.y + Math.sin(a) * rad;
        const size = SPORE_RADIUS * 0.36;
        const col = cols[i % cols.length];
        const gr = g.createRadialGradient(px, py, 1, px, py, size);
        gr.addColorStop(0, `rgba(${col},${0.9 * life})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, size, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 14; i++) {                              // glowing spores drifting in it
        const a = i * 1.9 + now * 0.0007, rad = SPORE_RADIUS * 0.9 * ((i * 37 % 10) / 10 + 0.05) * grow;
        g.fillStyle = `rgba(${200 + (i % 3) * 18},255,${110 + (i % 3) * 30},${0.85 * life * (0.5 + 0.5 * Math.sin(now * 0.01 + i))})`;
        g.beginPath(); g.arc(gp.x + Math.cos(a) * rad, gp.y + Math.sin(a) * rad, 2.4, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = `rgba(150,235,70,${0.85 * life})`; g.lineWidth = 3; g.setLineDash([8, 8]);
      g.beginPath(); g.arc(gp.x, gp.y, SPORE_RADIUS, 0, Math.PI * 2); g.stroke();
      g.restore();
    });
  }

""")
rep("  // a ring filling up round a player who's standing in the ash", "  // a ring filling up round a player who's standing in the spores")
rep("    if (now < p.slowUntil) {                    // grey haze round the edges while the ash is slowing you", "    if (now < p.slowUntil) {                    // green haze round the edges while the spores are slowing you")
rep("vg.addColorStop(0, 'rgba(120,110,110,0)'); vg.addColorStop(1, 'rgba(120,110,110,0.38)');", "vg.addColorStop(0, 'rgba(130,200,70,0)'); vg.addColorStop(1, 'rgba(130,200,70,0.34)');")

# ---------- the swinging vines ----------
rep("  // ---- the Pumpkin King ----\n", """  // The vines it swings during the vine whirl: thick green whips, tapering to the
  // tip, with leaves along them (bigger, brighter and more of them once it has
  // flourished). Drawn under the boss so they unfurl from beneath its body.
  function drawWhipVines(g, now) {
    if (boss.phase !== 'whip' || boss.defeated) return;
    const n = whipVineCount();
    const fl = boss.phase2;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const pts = vinePoints(i, now);
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 1; k < pts.length; k++) {
          const f = k / VINE_SEGS;
          const w = (VINE_HALF_WIDTH * 2 + 4) * (1 - f * 0.65);
          g.strokeStyle = pass === 0 ? (fl ? '#0e3a0c' : '#1a3410') : (fl ? (k % 2 ? '#5ed02e' : '#46b020') : (k % 2 ? '#4f8f2a' : '#3f7a20'));
          g.lineWidth = pass === 0 ? w + 3 : w;
          g.beginPath(); g.moveTo(pts[k - 1].x, pts[k - 1].y); g.lineTo(pts[k].x, pts[k].y); g.stroke();
        }
      }
      for (let k = 2; k < pts.length; k += 2) {                      // leaves
        const p = pts[k], q = pts[k - 1];
        const a = Math.atan2(p.y - q.y, p.x - q.x);
        const side = (k / 2) % 2 ? 1 : -1;
        g.fillStyle = fl ? '#8be84a' : '#5fa83a';
        g.beginPath();
        g.ellipse(p.x + Math.cos(a + side * 1.3) * 9, p.y + Math.sin(a + side * 1.3) * 9, 10, 4.2, a + side * 0.9, 0, Math.PI * 2);
        g.fill();
      }
      const tip = pts[pts.length - 1];                                // a curl at the tip
      g.strokeStyle = fl ? '#b8ff7a' : '#7bc04a'; g.lineWidth = 2.4;
      g.beginPath(); g.arc(tip.x, tip.y, 6, 0, Math.PI * 1.7); g.stroke();
    }
    g.restore();
  }

  // ---- the Pumpkin King ----
""")
rep("    drawBoss(ctx, now);\n", "    drawWhipVines(ctx, now);\n    drawBoss(ctx, now);\n")

# ---------- boss canvas: bigger scratch ----------
rep("  bossScratch.width = 320; bossScratch.height = 320;", "  bossScratch.width = 420; bossScratch.height = 420;")
rep("    s.clearRect(0, 0, 320, 320);\n    s.translate(160, 160);", "    s.clearRect(0, 0, 420, 420);\n    s.translate(210, 210);")
rep("    g.drawImage(bossScratch, -160, -160);", "    g.drawImage(bossScratch, -210, -210);")

# ---------- boss look ----------
block("  // Everything the boss is made of, drawn on a scratch canvas", "  function drawBoss(g, now) {", """  // Everything the boss is made of, drawn on a scratch canvas centered on the
  // origin: thick green vine-tentacles writhing out from under a huge ribbed
  // orange pumpkin, a carved face, and a fire burning in its mouth. Flourished,
  // it turns green, grows a much bigger nest of leafy vines, and the fire in it
  // burns blue.
  function drawPumpkinParts(s, now, flourished, stunned, screaming, boss) {
    const r = boss.radius;
    const look = boss.lookDir || { x: 0, y: 1 };

    // tentacles
    const tentCount = flourished ? 16 : 9;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + Math.sin(now * 0.0017 + i) * 0.2;
      let len = r * ((flourished ? 1.95 : 1.5) + 0.28 * Math.sin(now * 0.004 + i * 1.7 + boss.seed));
      if (stunned) len *= 0.8;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = (stunned ? 0.2 : 1) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.45;
      const mx = tx / 2 - Math.sin(a) * bow, my = ty / 2 + Math.cos(a) * bow;
      const col = flourished ? (i % 2 ? '#4fb82a' : '#2f8a1c') : (i % 2 ? '#5c9a30' : '#417022');
      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.3, col);
      if (flourished) {                                          // leaves along each vine
        [0.4, 0.7].forEach((u, j) => {
          const px = 2 * (1 - u) * u * mx + u * u * tx, py = 2 * (1 - u) * u * my + u * u * ty;
          s.fillStyle = '#7be040';
          s.beginPath(); s.ellipse(px + Math.cos(a + 1.4) * 5, py + Math.sin(a + 1.4) * 5, r * 0.13, r * 0.055, a + 0.9 * (j ? -1 : 1), 0, Math.PI * 2); s.fill();
        });
      }
      s.strokeStyle = flourished ? '#b8ff7a' : '#6fbf3a'; s.lineWidth = 1.8;
      s.beginPath(); s.arc(tx + Math.cos(a + 1.2) * 3, ty + Math.sin(a + 1.2) * 3, 3.4, a - 2, a + 3.4); s.stroke();
    }

    s.save();
    if (stunned) s.scale(1.06, 0.93);
    const rx = r, ry = r * 0.9;
    // shadowed underside, then the ribbed body
    s.fillStyle = flourished ? '#10300a' : '#4a1a06';
    s.beginPath(); s.ellipse(0, ry * 0.1, rx * 1.02, ry * 1.03, 0, 0, Math.PI * 2); s.fill();
    const body = s.createRadialGradient(-rx * 0.3, -ry * 0.4, 3, 0, 0, rx * 1.15);
    if (flourished) { body.addColorStop(0, '#c4f27a'); body.addColorStop(0.55, '#5cb030'); body.addColorStop(1, '#1f5212'); }
    else { body.addColorStop(0, '#ffb24a'); body.addColorStop(0.55, '#ee6a0e'); body.addColorStop(1, '#8f3208'); }
    s.fillStyle = body;
    s.beginPath(); s.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); s.fill();
    s.strokeStyle = flourished ? 'rgba(8,50,8,0.6)' : 'rgba(100,32,4,0.6)'; s.lineWidth = 2.4;
    [-0.66, -0.34, 0, 0.34, 0.66].forEach((k) => {
      s.beginPath();
      s.ellipse(0, 0, rx * Math.abs(1 - Math.abs(k) * 0.75), ry, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      s.stroke();
    });
    s.fillStyle = 'rgba(255,255,255,0.28)';
    s.beginPath(); s.ellipse(-rx * 0.38, -ry * 0.5, rx * 0.26, ry * 0.12, -0.5, 0, Math.PI * 2); s.fill();
    if (flourished) {                                           // vines wrapped round the body, with leaves
      s.lineCap = 'round';
      [[-0.95, -0.2, -0.3, 0.35, 0.5, -0.75], [0.95, 0.15, 0.3, -0.3, -0.6, -0.65], [-0.7, 0.7, 0.0, 0.2, 0.8, 0.55]].forEach(([x0, y0, cx0, cy0, x1, y1], i) => {
        s.strokeStyle = '#1f6a14'; s.lineWidth = r * 0.07;
        s.beginPath(); s.moveTo(rx * x0, ry * y0); s.quadraticCurveTo(rx * cx0, ry * cy0, rx * x1, ry * y1); s.stroke();
        s.strokeStyle = '#4fb82a'; s.lineWidth = r * 0.04; s.stroke();
        [0.3, 0.6, 0.85].forEach((u, j) => {
          const px = 2 * (1 - u) * u * rx * cx0 + (1 - u) * (1 - u) * rx * x0 + u * u * rx * x1;
          const py = 2 * (1 - u) * u * ry * cy0 + (1 - u) * (1 - u) * ry * y0 + u * u * ry * y1;
          s.fillStyle = '#7be040';
          s.beginPath(); s.ellipse(px, py - 4, r * 0.1, r * 0.045, (i + j) % 2 ? -0.6 : 0.6, 0, Math.PI * 2); s.fill();
        });
      });
    }
    // stem, and a curling vine
    s.fillStyle = flourished ? '#3a8a1a' : '#4a5a1c';
    s.beginPath(); s.moveTo(-r * 0.14, -ry * 0.92); s.lineTo(r * 0.16, -ry * 0.92); s.lineTo(r * 0.24, -ry * 1.3); s.lineTo(-r * 0.2, -ry * 1.26); s.closePath(); s.fill();
    s.strokeStyle = flourished ? '#7be040' : '#4fae3a'; s.lineWidth = 3;
    s.beginPath(); s.moveTo(r * 0.2, -ry * 1.05); s.quadraticCurveTo(r * 0.8, -ry * 1.2, r * 0.7, -ry * 0.7); s.quadraticCurveTo(r * 0.6, -ry * 0.5, r * 0.45, -ry * 0.62); s.stroke();
    if (flourished) {                                           // big leaves round the stem, and the stem's alight with blue fire
      [[-0.42, -0.98, -0.5], [0.46, -1.0, 0.5], [-0.6, -0.78, -0.9], [0.62, -0.8, 0.9]].forEach(([lx, ly, rot]) => {
        s.fillStyle = '#58b830';
        s.beginPath(); s.ellipse(r * lx, ry * ly, r * 0.26, r * 0.1, rot, 0, Math.PI * 2); s.fill();
        s.strokeStyle = '#2f8a1c'; s.lineWidth = 1.5;
        s.beginPath(); s.moveTo(r * lx - Math.cos(rot) * r * 0.24, ry * ly - Math.sin(rot) * r * 0.24); s.lineTo(r * lx + Math.cos(rot) * r * 0.24, ry * ly + Math.sin(rot) * r * 0.24); s.stroke();
      });
      drawFlameTongue(s, r * 0.03, -ry * 1.2, r * 0.45, r * 0.7, now, 3 + boss.seed, true);
      drawFlameTongue(s, -r * 0.1, -ry * 1.2, r * 0.3, r * 0.45, now, 8 + boss.seed, true);
    }

    // the carved face: glowing eyes, and a mouth with a fire burning in it
    const fx = look.x * r * 0.06, fy = look.y * r * 0.04;
    s.save(); s.translate(fx, fy);
    const flick = 0.85 + 0.15 * Math.sin(now * 0.03 + boss.seed);
    const eyeCol = stunned ? (flourished ? '#4a6a8a' : '#8a5a2a') : screaming ? '#ffffff' : flourished ? '#aee4ff' : '#ffe27a';
    s.shadowColor = flourished ? '#2a8aff' : '#ff6a10'; s.shadowBlur = stunned ? 2 : 14;
    s.fillStyle = eyeCol; s.globalAlpha = stunned ? 0.8 : Math.min(1, 0.9 * flick + (screaming ? 0.2 : 0));
    [-1, 1].forEach((side) => {
      s.beginPath();
      s.moveTo(side * r * 0.62, -ry * 0.02); s.lineTo(side * r * 0.2, -ry * 0.02); s.lineTo(side * r * 0.42, -ry * 0.5); s.closePath(); s.fill();
    });
    s.shadowBlur = 0; s.globalAlpha = 1;
    if (stunned) {                                           // dizzy swirls where the pupils would be
      s.strokeStyle = flourished ? '#0a1a2a' : '#2a0e04'; s.lineWidth = 2;
      [-1, 1].forEach((side) => {
        const ex = side * r * 0.42, ey = -ry * 0.16;
        s.beginPath();
        for (let a = 0; a < 9; a += 0.4) { const rr = a * r * 0.014; const px = ex + Math.cos(a + now * 0.01) * rr, py = ey + Math.sin(a + now * 0.01) * rr; if (a === 0) s.moveTo(px, py); else s.lineTo(px, py); }
        s.stroke();
      });
    }
    if (flourished && !stunned) {                            // blue flames licking up from the eyes
      [-1, 1].forEach((side, i) => drawFlameTongue(s, side * r * 0.42, -ry * 0.22, r * 0.26, r * 0.4, now, 20 + i * 3 + boss.seed, true));
    }

    // the mouth: a wide jagged hollow with the fire inside it
    const open = screaming ? 1.35 : stunned ? 0.55 : 0.85;
    const mw = r * 0.78, mh = ry * 0.5 * open, my0 = ry * 0.3;
    s.beginPath();
    s.moveTo(-mw, my0 - mh * 0.15);
    const teeth = 8;
    for (let i = 0; i <= teeth; i++) {
      const x = -mw + (2 * mw * i) / teeth;
      s.lineTo(x, my0 + (i % 2 ? mh * 0.55 : mh * 1.0));            // bottom edge, zig-zag
    }
    for (let i = teeth; i >= 0; i--) {
      const x = -mw + (2 * mw * i) / teeth;
      s.lineTo(x, my0 - mh * (i % 2 ? 0.1 : 0.45));                  // top edge, zig-zag
    }
    s.closePath();
    s.save();
    s.clip();
    const fire = s.createLinearGradient(0, my0 - mh * 0.5, 0, my0 + mh);
    if (stunned) { fire.addColorStop(0, flourished ? '#0a1a3a' : '#3a1608'); fire.addColorStop(1, flourished ? '#183a7a' : '#6a2a0c'); }
    else if (flourished) { fire.addColorStop(0, '#f0fcff'); fire.addColorStop(0.5, '#4aa8ff'); fire.addColorStop(1, '#1a3acc'); }
    else { fire.addColorStop(0, '#ffe9a0'); fire.addColorStop(0.5, '#ff9a2e'); fire.addColorStop(1, '#c8300a'); }
    s.fillStyle = fire; s.fillRect(-mw, my0 - mh, mw * 2, mh * 2.4);
    if (!stunned) {                                          // flames roiling inside
      for (let i = 0; i < 6; i++) drawFlameTongue(s, -mw * 0.72 + i * mw * 0.288, my0 + mh * 0.95, r * 0.2, mh * (1.2 + 0.4 * Math.sin(now * 0.02 + i)), now, i * 2.3 + boss.seed, flourished);
    }
    s.restore();
    s.strokeStyle = flourished ? '#0a2a08' : '#5a1c04'; s.lineWidth = 2;
    s.stroke();
    // fire pouring out over the lip: big when it roars, small tongues otherwise, nearly dead when stunned
    if (!stunned) {
      const n = screaming ? 9 : 5;
      for (let i = 0; i < n; i++) {
        const x = -mw * 0.8 + (1.6 * mw * i) / (n - 1);
        const hgt = (screaming ? 0.62 : flourished ? 0.45 : 0.34) * ry * (0.75 + 0.25 * Math.sin(now * 0.025 + i * 1.7 + boss.seed));
        drawFlameTongue(s, x, my0 - mh * 0.2, r * (screaming ? 0.3 : 0.2), hgt, now, i * 1.3 + boss.seed, flourished);
      }
    } else {
      for (let i = 0; i < 3; i++) drawFlameTongue(s, -mw * 0.4 + i * mw * 0.4, my0 - mh * 0.2, r * 0.12, ry * 0.18, now, i + boss.seed, flourished);
    }
    s.restore();
    s.restore();
  }

""")

# ---------- health bar / overlay colours ----------
rep("""    if (boss.phase2) { grad.addColorStop(0, '#ff9a6a'); grad.addColorStop(0.5, '#ff4a1a'); grad.addColorStop(1, '#7a1404'); }""", """    if (boss.phase2) { grad.addColorStop(0, '#b8ff7a'); grad.addColorStop(0.5, '#5cc02e'); grad.addColorStop(1, '#1f5a12'); }""")

# ---------- anything left? ----------
open(P, 'w', encoding='utf-8', newline='').write(s)
left = [(i + 1, l.strip()[:130]) for i, l in enumerate(s.split('\n')) if re.search(r'\bash\b|bite|ablaze|charred|ASH_|Ash', l, re.I)]
print('patched; leftovers:')
for x in left: print(x)
