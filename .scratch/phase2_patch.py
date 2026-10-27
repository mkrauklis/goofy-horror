p = 'js/game5.js'
s = open(p, encoding='utf-8').read()


def sub(old, new, count=1):
    global s
    assert s.count(old) >= 1, old[:80]
    s = s.replace(old, new, count)


# ---- constants ----
sub("  const ATTACKS_PER_STUN = 10;\n", """  // 7. Magma (phase 2 only): three 3x3-tile circles of magma well up out of
  // the floor, each marked for a full second first, then burn for 3 seconds.
  const MAGMA_COUNT = 3;
  const MAGMA_RADIUS = TILE * 1.5; // 3 tiles across
  const MAGMA_WARN_MS = 1000;
  const MAGMA_LIFE_MS = 3000;

  // Phase 2: at half health the boss becomes the Ashen One Magmatic -- molten
  // cracks across its body, magma spikes growing out of it, and the magma
  // attack added to its set. It spends a moment transforming, unable to hurt.
  const PHASE2_AT = 0.5;
  const PHASE2_TRANSFORM_MS = 2600;
  const PHASE2_SPIKE_GROW_MS = 2000;

  const ATTACKS_PER_STUN = 10;
""")

# ---- state ----
sub("      volleysFired: 0,\n", "      phase2: false,\n      phase2At: 0,\n      volleysFired: 0,\n")
sub("boss.attackCount = 0; boss.lastAttack = null; boss.volleysFired = 0; boss.windupFor = -1;",
    "boss.attackCount = 0; boss.lastAttack = null; boss.volleysFired = 0; boss.windupFor = -1; boss.phase2 = false; boss.phase2At = 0;")
sub("  let fireTrail = []; // what they leave behind",
    "  let magmaPools = []; // magma attack: [{x, y, warnAt, activeAt, endsAt, seed}]\n  let fireTrail = []; // what they leave behind")
sub("bossBombs = []; fireballs = []; fireTrail = [];\n", "bossBombs = []; fireballs = []; fireTrail = []; magmaPools = [];\n")
sub("      // 'idle' | 'fireballs' | 'throw' | 'spike' | 'charge' | 'bombs' | 'blink' | 'stunned'",
    "      // 'idle' | 'fireballs' | 'throw' | 'spike' | 'charge' | 'bombs' | 'blink' | 'magma' | 'transform' | 'stunned'")

# ---- picking attacks ----
sub("""  function pickAttack() {
    const choices = ALL_ATTACKS.filter((a) => a !== boss.lastAttack);""", """  function pickAttack() {
    const pool = boss.phase2 ? ALL_ATTACKS.concat('magma') : ALL_ATTACKS;
    const choices = pool.filter((a) => a !== boss.lastAttack);""")

sub("""    } else if (kind === 'throw') {
      telegraphs = [];""", """    } else if (kind === 'magma') {
      startMagma(now);
    } else if (kind === 'throw') {
      telegraphs = [];""")

# ---- phase 2 trigger ----
sub("""        if (bossHealth <= 0) {
          boss.defeated = true;""", """        if (bossHealth > 0 && !boss.phase2 && bossHealth <= BOSS_MAX_HEALTH * PHASE2_AT) startPhase2(now, b.x, b.y);
        if (bossHealth <= 0) {
          boss.defeated = true;""")

# ---- the new logic ----
sub("  function fireballHitsWall(x, y) {", """  // ---- phase 2: the Ashen One Magmatic ----
  function startPhase2(now, hx, hy) {
    boss.phase2 = true;
    boss.phase2At = now;
    boss.phase = 'transform';
    boss.phaseStartedAt = now;
    telegraphs = []; spikeTelegraphs = []; bossBombs = [];
    boss.chargeSubPhase = 'recover';
    spawnEmberBurst(boss.x, boss.y, 60);
    spawnFloatingText(boss.x, boss.y - boss.radius * 0.4, 'PHASE 2');
    spawnFloatingText(boss.x, boss.y, 'THE ASHEN ONE MAGMATIC');
    catchFlash = 0.55;
    playBossWindup();
    playBombBlast();
    void hx; void hy;
  }

  function updateBossTransform(now) {
    if (Math.random() < 0.5) spawnEmber(boss.x + (Math.random() - 0.5) * boss.radius * 1.6, boss.y + (Math.random() - 0.5) * boss.radius * 1.6, true);
    if (now - boss.phaseStartedAt >= PHASE2_TRANSFORM_MS) {
      boss.phase = 'idle';
      boss.nextIdleUntil = now + 700;
    }
  }

  function startMagma(now) {
    magmaPools = [];
    const live = players.filter((p) => !p.caught);
    const pool = live.length ? live : players;
    const standable = (x, y) => {
      const r = MAGMA_RADIUS * 0.7;
      return [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([ox, oy]) => {
        const t = worldToTile(x + ox, y + oy);
        return !isWallForPlayer(t.x, t.y);
      });
    };
    for (let i = 0; i < MAGMA_COUNT; i++) {
      const p = pool[i % pool.length];
      let x = p.x, y = p.y;
      for (let tries = 0; tries < 14; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = i < pool.length ? Math.random() * 44 : 70 + Math.random() * 60;
        const cx = clamp(p.x + Math.cos(a) * d, TILE * 2, WORLD_W - TILE * 2);
        const cy = clamp(p.y + Math.sin(a) * d, TILE * 2, WORLD_H - TILE * 2);
        if (standable(cx, cy)) { x = cx; y = cy; break; }
      }
      magmaPools.push({ x, y, warnAt: now, activeAt: now + MAGMA_WARN_MS, endsAt: now + MAGMA_WARN_MS + MAGMA_LIFE_MS, seed: Math.random() * 1000 });
    }
    playBossWindup();
  }

  function updateBossMagma(now) {
    if (now - boss.phaseStartedAt >= MAGMA_WARN_MS + MAGMA_LIFE_MS) finishAttack(now);
  }

  // Pools burn on their own clock: whoever stands in one while it's lit is caught.
  function updateMagmaPools(now, dt) {
    if (gameState !== 'playing' || boss.defeated) { magmaPools = []; return; }
    for (let i = magmaPools.length - 1; i >= 0; i--) {
      const m = magmaPools[i];
      if (now >= m.endsAt) { magmaPools.splice(i, 1); continue; }
      if (now < m.activeAt) continue;
      if (Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * MAGMA_RADIUS * 0.85;
        spawnEmber(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, false);
      }
      if (now - m.activeAt < 120) spawnEmberBurst(m.x, m.y, 3);
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - m.x, p.y - m.y) < MAGMA_RADIUS * 0.92 + PLAYER_RADIUS * 0.5) triggerCaught(p, now);
      });
    }
  }

  function fireballHitsWall(x, y) {""")

sub("      case 'fireballs': updateBossFireballs(now, dt); break;",
    "      case 'fireballs': updateBossFireballs(now, dt); break;\n      case 'magma': updateBossMagma(now); break;\n      case 'transform': updateBossTransform(now); break;")
sub("    updateFireballs(now, dt);\n    updateFloatingTexts(dt);", "    updateFireballs(now, dt);\n    updateMagmaPools(now, dt);\n    updateFloatingTexts(dt);")
sub("    if (boss.phase === 'stunned') return;\n    players.forEach((p) => {\n      if (p.caught) return;\n      if (now < p.invulnerableUntil) return;",
    "    if (boss.phase === 'stunned' || boss.phase === 'transform') return;\n    players.forEach((p) => {\n      if (p.caught) return;\n      if (now < p.invulnerableUntil) return;")

# ---- boss bar label ----
sub("""    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase === 'stunned' ? '#8fd6ff' : '#e8b06a';
    const label = boss.defeated ? 'BOSS — DEFEATED' : boss.phase === 'stunned'
      ? `BOSS — STUNNED (${bossHealth}/${BOSS_MAX_HEALTH})` : `BOSS (${bossHealth}/${BOSS_MAX_HEALTH})`;""", """    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase === 'stunned' ? '#8fd6ff' : boss.phase2 ? '#ff8a3a' : '#e8b06a';
    const bossName = boss.phase2 ? 'ASHEN ONE MAGMATIC' : 'BOSS';
    const label = boss.defeated ? 'BOSS — DEFEATED' : boss.phase === 'stunned'
      ? `${boss.phase2 ? 'MAGMATIC' : 'BOSS'} — STUNNED (${bossHealth}/${BOSS_MAX_HEALTH})` : `${bossName} (${bossHealth}/${BOSS_MAX_HEALTH})`;""")

# ---- drawing: body, spikes, pools ----
draw_block = """  // a soft additive glow: a radial gradient from rgb at alpha a down to nothing
  function softGlow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.globalAlpha = 1;
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // ---- phase 2 drawing: molten cracks, magma spikes, magma pools ----
  // Fixed crack lines in unit-radius coordinates, made once from a seed so
  // the body doesn't re-roll them every frame.
  const BODY_CRACKS = (() => {
    let sd = 0x2b0de7;
    const rnd = () => {
      sd = (sd + 0x6D2B79F5) | 0;
      let t = Math.imul(sd ^ (sd >>> 15), 1 | sd);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const lines = [];
    for (let i = 0; i < 10; i++) {
      let a = (i / 10) * Math.PI * 2 + rnd() * 0.5;
      let r = 0.1 + rnd() * 0.15;
      const pts = [[Math.cos(a) * r, Math.sin(a) * r]];
      while (r < 1.0) {
        a += (rnd() - 0.5) * 0.9;
        r += 0.09 + rnd() * 0.1;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        if (rnd() < 0.2 && lines.length < 22) {
          let ba = a + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.5), br = r;
          const bp = [[Math.cos(ba) * br, Math.sin(ba) * br]];
          for (let k = 0; k < 3; k++) { ba += (rnd() - 0.5) * 0.9; br += 0.07 + rnd() * 0.06; bp.push([Math.cos(ba) * br, Math.sin(ba) * br]); }
          lines.push(bp);
        }
      }
      lines.push(pts);
    }
    return lines;
  })();
  const BODY_SPIKES = (() => {
    const list = [];
    for (let i = 0; i < 13; i++) {
      const h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      list.push({ a: (i / 13) * Math.PI * 2 + 0.2, len: 0.26 + h * 0.24, w: 0.1 + (1 - h) * 0.05 });
    }
    return list;
  })();

  // behind the body: dark basalt spikes, veined and tipped with glowing magma
  function drawMagmaSpikes(g, t) {
    const R = boss.radius;
    const grow = clamp((t - boss.phase2At) / PHASE2_SPIKE_GROW_MS, 0, 1);
    const cold = boss.defeated;
    BODY_SPIKES.forEach((sp, i) => {
      const gi = clamp(grow * 1.7 - i * 0.06, 0, 1);
      if (gi <= 0) return;
      const eased = 1 - Math.pow(1 - gi, 3);
      const len = sp.len * eased * (1 + 0.04 * Math.sin(t * 0.004 + i));
      const r0 = R * 0.78, r1 = R * (1 + len);
      const ca = Math.cos(sp.a), sa = Math.sin(sp.a);
      const px = -sa, py = ca;
      const bw = R * sp.w;
      const bx = ca * r0, by = sa * r0, tx = ca * r1, ty = sa * r1;
      const grad = g.createLinearGradient(bx, by, tx, ty);
      grad.addColorStop(0, '#120807');
      grad.addColorStop(0.55, cold ? '#2a2420' : '#3a140c');
      grad.addColorStop(1, cold ? '#4a3f36' : '#ff7a1e');
      g.beginPath();
      g.moveTo(bx + px * bw, by + py * bw);
      g.lineTo(tx, ty);
      g.lineTo(bx - px * bw, by - py * bw);
      g.closePath();
      g.fillStyle = grad;
      g.fill();
      if (!cold) {
        g.strokeStyle = `rgba(255,140,50,${0.45 + 0.2 * Math.sin(t * 0.006 + i * 1.3)})`;
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(tx - ca * R * 0.04, ty - sa * R * 0.04); g.stroke();
      }
    });
  }

  // over the body: charred shading and glowing seams, clipped to the silhouette
  function drawMagmaBody(g, t) {
    if (boss.defeated) return;
    const R = boss.radius;
    const grow = clamp((t - boss.phase2At) / PHASE2_SPIKE_GROW_MS, 0, 1);
    g.save();
    g.beginPath();
    g.arc(0, 0, R * 0.98, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = `rgba(14,5,3,${0.38 * grow})`;
    g.fillRect(-R, -R, R * 2, R * 2);
    const pulse = 0.75 + 0.25 * Math.sin(t * 0.0045);
    g.lineCap = 'round'; g.lineJoin = 'round';
    BODY_CRACKS.forEach((ln, li) => {
      const upto = clamp(grow * 1.4 - (li % 5) * 0.08, 0, 1);
      if (upto <= 0) return;
      const n = Math.max(1, Math.floor((ln.length - 1) * upto));
      const trace = () => {
        g.beginPath();
        g.moveTo(ln[0][0] * R, ln[0][1] * R);
        for (let i = 1; i <= n; i++) g.lineTo(ln[i][0] * R, ln[i][1] * R);
      };
      g.save();
      g.shadowColor = '#ff6a1a'; g.shadowBlur = R * 0.09;
      g.globalAlpha = pulse;
      g.strokeStyle = '#d4521a'; g.lineWidth = R * 0.034; trace(); g.stroke();
      g.restore();
      g.strokeStyle = '#ffc060'; g.globalAlpha = 0.9 * pulse; g.lineWidth = R * 0.012; trace(); g.stroke();
      g.globalAlpha = 1;
    });
    g.restore();
  }

  // the rings and flash as the boss changes
  function drawPhase2Burst(g, now) {
    if (!boss.phase2) return;
    const age = now - boss.phase2At;
    if (age < 0 || age > 1500) return;
    const k = age / 1500;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const kk = clamp(k * 1.4 - i * 0.18, 0, 1);
      if (kk <= 0 || kk >= 1) continue;
      g.strokeStyle = `rgba(255,${150 + i * 25},60,${0.7 * (1 - kk)})`;
      g.lineWidth = 8 * (1 - kk) + 1;
      g.beginPath(); g.arc(boss.x, boss.y, boss.radius * (0.8 + 2.4 * kk), 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }

  function drawMagmaPools(g, camX, camY, now) {
    magmaPools.forEach((m) => {
      if (Math.abs(m.x - camX) > VISIBLE_HALF_W + 120 || Math.abs(m.y - camY) > VISIBLE_HALF_H + 120) return;
      const R = MAGMA_RADIUS;
      g.save();
      g.translate(m.x, m.y);
      if (now < m.activeAt) {
        // the warning: a ring closing in on the spot, the ground reddening
        const k = clamp((now - m.warnAt) / MAGMA_WARN_MS, 0, 1);
        const flick = 0.7 + 0.3 * Math.sin(now * 0.03);
        g.fillStyle = `rgba(255,90,20,${(0.1 + 0.2 * k) * flick})`;
        g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
        g.strokeStyle = `rgba(255,150,50,${0.55 + 0.35 * flick})`;
        g.lineWidth = 3;
        g.setLineDash([10, 8]);
        g.lineDashOffset = -now * 0.04;
        g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        g.strokeStyle = `rgba(255,220,140,${0.6 * (1 - k)})`;
        g.lineWidth = 2;
        g.beginPath(); g.arc(0, 0, R * (1.5 - 0.5 * k), 0, Math.PI * 2); g.stroke();
      } else {
        const born = clamp((now - m.activeAt) / 160, 0, 1);
        const out = clamp((m.endsAt - now) / 380, 0, 1);
        const rr = R * (0.55 + 0.45 * (1 - Math.pow(1 - born, 3)));
        g.globalAlpha = out;
        g.fillStyle = 'rgba(16,6,4,0.7)';                     // scorched crust round the edge
        g.beginPath(); g.arc(0, 0, rr * 1.12, 0, Math.PI * 2); g.fill();
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        grad.addColorStop(0, '#fff0a0');
        grad.addColorStop(0.3, '#ffb030');
        grad.addColorStop(0.7, '#ff5a14');
        grad.addColorStop(1, '#a02208');
        g.fillStyle = grad;
        g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 7; i++) {                          // the surface churning
          const a = now * 0.0008 * (i % 2 ? 1 : -1) + i * 0.9 + m.seed;
          const d = rr * (0.25 + 0.45 * ((i * 37) % 10) / 10);
          g.fillStyle = i % 2 ? 'rgba(255,230,140,0.45)' : 'rgba(255,120,30,0.5)';
          g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, rr * 0.22, rr * 0.13, a, 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 6; i++) {                          // bubbles swelling and bursting
          const cyc = 900 + i * 130;
          const ph = ((now + m.seed * 13 + i * 377) % cyc) / cyc;
          const a = i * 1.07 + m.seed, d = rr * (0.15 + 0.6 * (((i * 53) % 10) / 10));
          g.strokeStyle = `rgba(255,236,170,${0.8 * (1 - ph)})`;
          g.lineWidth = 1.5;
          g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + ph * 9, 0, Math.PI * 2); g.stroke();
        }
        g.strokeStyle = 'rgba(255,120,40,0.7)';
        g.lineWidth = 2.5;
        g.beginPath(); g.arc(0, 0, rr * 1.0, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    });
  }

"""
sub("  // ---- rendering ----\n  function drawTiles(", draw_block + "  // ---- rendering ----\n  function drawTiles(")

# body pieces in drawBoss
sub("    drawBossTentacles(g, t);\n    drawBossBody(g, t);\n", """    if (boss.phase === 'transform') {            // it shudders as it changes
      g.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    }
    drawBossTentacles(g, t);
    if (boss.phase2) drawMagmaSpikes(g, t);
    drawBossBody(g, t);
    if (boss.phase2) drawMagmaBody(g, t);
""")
sub("    drawBoss(ctx, now);\n    drawPlayers(ctx);", "    drawMagmaPools(ctx, camX, camY, now);\n    drawBoss(ctx, now);\n    drawPhase2Burst(ctx, now);\n    drawPlayers(ctx);")

# lights and glow
sub("    fireballs.forEach((f) => {\n      const sc = worldToScreen(f.x, f.y);\n      punchLight(maskCtx, sc.x, sc.y, 170 * ZOOM, 0.95);\n    });", """    fireballs.forEach((f) => {
      const sc = worldToScreen(f.x, f.y);
      punchLight(maskCtx, sc.x, sc.y, 170 * ZOOM, 0.95);
    });
    magmaPools.forEach((m) => {
      const sc = worldToScreen(m.x, m.y);
      punchLight(maskCtx, sc.x, sc.y, (m.activeAt > now ? 80 : 170) * ZOOM, m.activeAt > now ? 0.5 : 0.95);
    });""")
sub("    const bs = worldToScreen(boss.x, boss.y);\n    punchLight(maskCtx, bs.x, bs.y, boss.radius * 2.2 * ZOOM, 0.6);",
    "    const bs = worldToScreen(boss.x, boss.y);\n    punchLight(maskCtx, bs.x, bs.y, boss.radius * (boss.phase2 ? 2.8 : 2.2) * ZOOM, boss.phase2 ? 0.75 : 0.6);")

# softer glow discs: gradients instead of flat circles
sub("""    fireballs.forEach((f) => {
      g.globalAlpha = 0.3;
      g.fillStyle = '#ff8a30';
      g.beginPath(); g.arc(f.x, f.y, FIREBALL_RADIUS * 1.9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.55;
      g.fillStyle = '#ffd27a';
      g.beginPath(); g.arc(f.x, f.y, FIREBALL_RADIUS * 0.7, 0, Math.PI * 2); g.fill();
    });""", """    fireballs.forEach((f) => softGlow(g, f.x, f.y, FIREBALL_RADIUS * 2.1, '255,140,50', 0.5));
    magmaPools.forEach((m) => { if (now >= m.activeAt) softGlow(g, m.x, m.y, MAGMA_RADIUS * 1.7, '255,110,30', 0.5 * Math.min(1, (m.endsAt - now) / 380)); });""")
sub("      g.globalAlpha = 0.2 * (age > 0.78 ? Math.max(0, (1 - age) / 0.22) : 1);\n      g.fillStyle = '#ff7a20';\n      g.beginPath(); g.arc(f.x, f.y, FIRE_TRAIL_R * 2, 0, Math.PI * 2); g.fill();",
    "      softGlow(g, f.x, f.y, FIRE_TRAIL_R * 2.2, '255,120,32', 0.26 * (age > 0.78 ? Math.max(0, (1 - age) / 0.22) : 1));")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
