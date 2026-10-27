p = 'js/game5.js'
s = open(p, encoding='utf-8').read()


def sub(old, new, count=1):
    global s
    assert s.count(old) >= 1, old[:70]
    s = s.replace(old, new, count)


# ---- constants ----
sub("""  // 1. Spin: bounces off the arena walls DVD-logo style at high speed.
  const SPIN_DURATION_MS = 5000;
  const SPIN_SPEED = HM.speed(PLAYER_SPEED * 5);
""", """  // 1. Fireballs: four volleys of three 2x2-tile fireballs, one volley every
  // 2.5s across a 10s attack. They ricochet off the walls and leave a trail of
  // fire behind them that can't be walked through until it burns out, and a
  // fireball itself catches whoever it touches.
  const FIREBALL_VOLLEYS = 4;
  const FIREBALL_PER_VOLLEY = 3;
  const FIREBALL_VOLLEY_GAP_MS = 2500;
  const FIREBALL_FIRST_MS = 500;
  const FIREBALL_DURATION_MS = 10000;
  const FIREBALL_WINDUP_MS = 450; // the boss flares this long before each volley
  const FIREBALL_RADIUS = TILE; // 2 tiles across
  const FIREBALL_SPEED = HM.speed(PLAYER_SPEED * 1.7);
  const FIREBALL_LIFE_MS = 5500;
  const FIRE_TRAIL_MS = 6000;
  const FIRE_TRAIL_R = 17;
  const FIRE_TRAIL_STEP = 20; // a patch of fire every this many px of travel
  const FIRE_TRAIL_CAP = 520;
""")

# ---- boss state ----
sub("      // 'idle' | 'spin' | 'throw' | 'spike' | 'charge' | 'bombs' | 'blink' | 'stunned'",
    "      // 'idle' | 'fireballs' | 'throw' | 'spike' | 'charge' | 'bombs' | 'blink' | 'stunned'")
sub("      spinAngle: 0,\n      spinDir: { x: 1, y: 0 },\n",
    "      volleysFired: 0,\n      nextVolleyAt: 0,\n      windupFor: -1,\n")
sub("boss.attackCount = 0; boss.lastAttack = null; boss.spinAngle = 0;",
    "boss.attackCount = 0; boss.lastAttack = null; boss.volleysFired = 0; boss.windupFor = -1;")
sub("  let bossBombs = []; // bombs attack: [{x, y, landAt, explodeAt, exploded}]\n",
    "  let bossBombs = []; // bombs attack: [{x, y, landAt, explodeAt, exploded}]\n"
    "  let fireballs = []; // fireballs attack: [{x, y, vx, vy, dies, seed, trailX, trailY}]\n"
    "  let fireTrail = []; // what they leave behind: [{x, y, born, until, seed}] -- blocks players\n")
sub("    telegraphs = []; spikeTelegraphs = []; bossBombs = [];\n",
    "    telegraphs = []; spikeTelegraphs = []; bossBombs = []; fireballs = []; fireTrail = [];\n")

# ---- player movement: fire blocks the way in ----
sub("""  function movePlayer(p, dx, dy) {
    if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;
  }
""", """  // A burning patch can't be walked into -- but it never traps someone it
  // landed on, who can still walk out.
  function inFire(x, y) {
    for (let i = 0; i < fireTrail.length; i++) {
      if (Math.hypot(x - fireTrail[i].x, y - fireTrail[i].y) < FIRE_TRAIL_R + PLAYER_RADIUS * 0.5) return true;
    }
    return false;
  }

  function movePlayer(p, dx, dy) {
    const trapped = fireTrail.length > 0 && inFire(p.x, p.y);
    const clear = (x, y) => trapped || fireTrail.length === 0 || !inFire(x, y);
    if (dx !== 0 && canStandAt(p.x + dx, p.y) && clear(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && canStandAt(p.x, p.y + dy) && clear(p.x, p.y + dy)) p.y += dy;
  }
""")

# ---- sounds ----
sub("  // The spike attack's own impact sound -- a sharper crack than the", """  // A fireball leaving the boss: a falling roar with a thump under it.
  function playFireballShot() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, start);
    osc.frequency.exponentialRampToValueAtTime(70, start + 0.4);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, start);
    filter.frequency.exponentialRampToValueAtTime(260, start + 0.4);
    gain.gain.setValueAtTime(0.26, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  }

  // A fireball glancing off a wall.
  function playFireballBounce() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, start);
    osc.frequency.exponentialRampToValueAtTime(70, start + 0.14);
    gain.gain.setValueAtTime(0.16, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  }

  // The spike attack's own impact sound -- a sharper crack than the""")

# ---- attack list and start ----
sub("const ALL_ATTACKS = ['spin', 'throw', 'spike', 'charge', 'bombs', 'blink'];",
    "const ALL_ATTACKS = ['fireballs', 'throw', 'spike', 'charge', 'bombs', 'blink'];")
sub("""    if (kind === 'spin') {
      const a = Math.random() * Math.PI * 2;
      boss.spinDir = { x: Math.cos(a), y: Math.sin(a) };
      playBossWindup();
    } else if (kind === 'throw') {""", """    if (kind === 'fireballs') {
      boss.volleysFired = 0;
      boss.windupFor = -1;
      boss.nextVolleyAt = now + FIREBALL_FIRST_MS;
    } else if (kind === 'throw') {""")

# ---- the attack itself ----
sub("""  function updateBossSpin(now, dt) {
    if (now - boss.phaseStartedAt >= SPIN_DURATION_MS) { finishAttack(now); return; }
    boss.spinAngle += dt * 26;
    const step = SPIN_SPEED * dt;
    const nx = boss.x + boss.spinDir.x * step;
    const ny = boss.y + boss.spinDir.y * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx; else boss.spinDir.x *= -1;
    if (canBossStandAt(boss.x, ny)) boss.y = ny; else boss.spinDir.y *= -1;
    boss.lookDir = boss.spinDir;
  }
""", """  function fireballHitsWall(x, y) {
    const r = FIREBALL_RADIUS * 0.8;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const t = worldToTile(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (isWallForPlayer(t.x, t.y)) return true;
    }
    return false;
  }

  // One volley: the first two fireballs go straight at the players (both at
  // the same one when solo, fanned out), the third strays a little.
  function fireVolley(now) {
    const live = players.filter((p) => !p.caught);
    const pool = live.length ? live : players;
    for (let i = 0; i < FIREBALL_PER_VOLLEY; i++) {
      const tgt = pool[i % pool.length];
      let a = Math.atan2(tgt.y - boss.y, tgt.x - boss.x);
      if (pool.length === 1) a += (i - 1) * 0.42;
      else if (i === FIREBALL_PER_VOLLEY - 1) a += (Math.random() - 0.5) * 1.1;
      let sx = boss.x + Math.cos(a) * boss.radius * 0.5;
      let sy = boss.y + Math.sin(a) * boss.radius * 0.5;
      if (fireballHitsWall(sx, sy)) { sx = boss.x; sy = boss.y; }
      fireballs.push({
        x: sx, y: sy,
        vx: Math.cos(a) * FIREBALL_SPEED, vy: Math.sin(a) * FIREBALL_SPEED,
        dies: now + FIREBALL_LIFE_MS, seed: Math.random() * 1000,
        trailX: sx, trailY: sy,
      });
      spawnEmberBurst(sx, sy, 12);
    }
    playFireballShot();
  }

  function updateBossFireballs(now, dt) {
    if (now - boss.phaseStartedAt >= FIREBALL_DURATION_MS) { finishAttack(now); return; }
    if (boss.volleysFired < FIREBALL_VOLLEYS) {
      if (boss.windupFor !== boss.volleysFired && now >= boss.nextVolleyAt - FIREBALL_WINDUP_MS) {
        boss.windupFor = boss.volleysFired;
        playBossWindup();
      }
      if (now >= boss.nextVolleyAt) {
        fireVolley(now);
        boss.volleysFired++;
        boss.nextVolleyAt = Math.max(boss.nextVolleyAt + FIREBALL_VOLLEY_GAP_MS, now + 1000);
      }
    }
    // it holds its ground, turning to face whoever's nearest and creeping closer
    const target = nearestPlayer(boss.x, boss.y);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    boss.lookDir = { x: dx / d, y: dy / d };
    const step = BOSS_IDLE_SPEED * 0.5 * dt;
    const nx = boss.x + boss.lookDir.x * step, ny = boss.y + boss.lookDir.y * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx;
    if (canBossStandAt(boss.x, ny)) boss.y = ny;
  }

  // Fireballs fly on their own clock, whatever the boss is doing next: they
  // ricochet, drop fire behind them, and catch anyone they touch.
  function updateFireballs(now, dt) {
    if (gameState !== 'playing' || boss.defeated) { fireballs = []; fireTrail = []; return; }
    for (let i = fireTrail.length - 1; i >= 0; i--) if (now >= fireTrail[i].until) fireTrail.splice(i, 1);
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i];
      if (now >= f.dies || fireballHitsWall(f.x, f.y)) {
        spawnEmberBurst(f.x, f.y, 14);
        fireballs.splice(i, 1);
        continue;
      }
      let bounced = false;
      if (fireballHitsWall(f.x + f.vx * dt, f.y)) { f.vx = -f.vx; bounced = true; } else f.x += f.vx * dt;
      if (fireballHitsWall(f.x, f.y + f.vy * dt)) { f.vy = -f.vy; bounced = true; } else f.y += f.vy * dt;
      if (bounced) {
        spawnEmberBurst(f.x, f.y, 10);
        playFireballBounce();
      }
      if (Math.hypot(f.x - f.trailX, f.y - f.trailY) >= FIRE_TRAIL_STEP) {
        f.trailX = f.x; f.trailY = f.y;
        if (fireTrail.length < FIRE_TRAIL_CAP) fireTrail.push({ x: f.x, y: f.y, born: now, until: now + FIRE_TRAIL_MS, seed: Math.random() * 1000 });
      }
      if (Math.random() < dt * 45) spawnEmber(f.x + (Math.random() - 0.5) * FIREBALL_RADIUS, f.y + (Math.random() - 0.5) * FIREBALL_RADIUS, false);
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - f.x, p.y - f.y) < FIREBALL_RADIUS * 0.85 + PLAYER_RADIUS * 0.8) triggerCaught(p, now);
      });
    }
  }
""")

sub("      case 'spin': updateBossSpin(now, dt); break;", "      case 'fireballs': updateBossFireballs(now, dt); break;")
sub("    updateParticles(dt);\n    updateEmbers(dt);\n", "    updateParticles(dt);\n    updateEmbers(dt);\n    updateFireballs(now, dt);\n")

# ---- drawing ----
sub("""    // Visibly spinning (rather than just relocating fast) is what sells the
    // DVD-logo bounce as an attack in progress and not just fast pathing.
    if (boss.phase === 'spin') g.rotate(boss.spinAngle);

""", "")
sub("      if (boss.phase !== 'stunned') drawBossFlames(g, t);\n      drawBossEye(g);\n", """      if (boss.phase !== 'stunned') drawBossFlames(g, t);
      drawBossEye(g);
      if (boss.phase === 'fireballs' && boss.volleysFired < FIREBALL_VOLLEYS) {
        // it swells and brightens just before every volley
        const lead = boss.nextVolleyAt - t;
        if (lead < FIREBALL_WINDUP_MS && lead > -60) {
          const k = 1 - clamp(lead / FIREBALL_WINDUP_MS, 0, 1);
          const r = boss.radius * (0.25 + 0.6 * k);
          const gl = g.createRadialGradient(0, 0, 0, 0, 0, r);
          gl.addColorStop(0, `rgba(255,240,170,${0.85 * k})`);
          gl.addColorStop(0.5, `rgba(255,150,40,${0.5 * k})`);
          gl.addColorStop(1, 'rgba(255,80,20,0)');
          g.fillStyle = gl;
          g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        }
      }
""")

fire_draw = """  // The fire the fireballs leave behind -- solid ground nobody can step on.
  function drawFireTrail(g, camX, camY, now) {
    for (let i = 0; i < fireTrail.length; i++) {
      const f = fireTrail[i];
      if (Math.abs(f.x - camX) > VISIBLE_HALF_W + 40 || Math.abs(f.y - camY) > VISIBLE_HALF_H + 40) continue;
      const age = (now - f.born) / (f.until - f.born);
      const fade = Math.min(1, (now - f.born) / 150) * (age > 0.78 ? Math.max(0, (1 - age) / 0.22) : 1);
      if (fade <= 0) continue;
      g.save();
      g.translate(f.x, f.y);
      g.globalAlpha = fade;
      g.fillStyle = 'rgba(20,8,4,0.45)';
      g.beginPath(); g.ellipse(0, 3, FIRE_TRAIL_R * 1.15, FIRE_TRAIL_R * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,110,30,0.38)';
      g.beginPath(); g.arc(0, 0, FIRE_TRAIL_R * 1.1, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 3; k++) {
        const wob = Math.sin(now * 0.015 + f.seed + k * 2.1) * 3.5;
        const h = (16 + k * 5 + Math.sin(now * 0.02 + f.seed * 1.7 + k) * 3) * (1 - 0.35 * age);
        const ox = (k - 1) * 8;
        g.beginPath();
        g.moveTo(ox - 5, 5);
        g.quadraticCurveTo(ox + 3 + wob, -h * 0.5, ox + wob * 0.6, -h);
        g.quadraticCurveTo(ox - 3 + wob, -h * 0.5, ox + 5, 5);
        g.closePath();
        g.fillStyle = k === 1 ? '#ffd873' : k === 0 ? '#ff9c3d' : '#e0541f';
        g.fill();
      }
      g.restore();
    }
  }

  function drawFireballs(g, now) {
    fireballs.forEach((f) => {
      const r = FIREBALL_RADIUS;
      const sp = Math.hypot(f.vx, f.vy) || 1;
      const ux = f.vx / sp, uy = f.vy / sp;
      g.save();
      g.translate(f.x, f.y);
      const halo = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
      halo.addColorStop(0, 'rgba(255,140,40,0.42)');
      halo.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = halo;
      g.beginPath(); g.arc(0, 0, r * 2, 0, Math.PI * 2); g.fill();
      for (let j = 7; j >= 1; j--) {            // a streaming tail
        const wob = Math.sin(now * 0.02 + f.seed + j) * 3;
        g.fillStyle = `rgba(${255 - j * 6},${120 - j * 10},30,${0.5 * (1 - j / 8)})`;
        g.beginPath();
        g.arc(-ux * j * r * 0.42 - uy * wob, -uy * j * r * 0.42 + ux * wob, r * (1 - j * 0.1), 0, Math.PI * 2);
        g.fill();
      }
      const body = g.createRadialGradient(0, 0, 2, 0, 0, r);
      body.addColorStop(0, '#fff6c8');
      body.addColorStop(0.3, '#ffc23a');
      body.addColorStop(0.68, '#ff6a1a');
      body.addColorStop(1, '#b52008');
      g.fillStyle = body;
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 6; k++) {             // licking flame lobes round the rim
        const a = now * 0.009 + f.seed + (k * Math.PI) / 3;
        const rr = r * (0.82 + Math.sin(now * 0.02 + k * 1.7 + f.seed) * 0.12);
        g.fillStyle = k % 2 ? 'rgba(255,200,80,0.6)' : 'rgba(255,120,30,0.6)';
        g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.3, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    });
  }

"""
sub("  // ---- rendering ----\n  function drawTiles(", fire_draw + "  // ---- rendering ----\n  function drawTiles(")

sub("    drawFires(ctx, now);\n", "    drawFires(ctx, now);\n    drawFireTrail(ctx, camX, camY, now);\n")
sub("    drawPlayers(ctx);\n    drawParticles(ctx);\n", "    drawPlayers(ctx);\n    drawFireballs(ctx, now);\n    drawParticles(ctx);\n")

# ---- light: fireballs and the fire they leave light the dark ----
sub("""    // the boss is on fire -- it lights up its own surroundings, giving""", """    fireballs.forEach((f) => {
      const sc = worldToScreen(f.x, f.y);
      punchLight(maskCtx, sc.x, sc.y, 170 * ZOOM, 0.95);
    });
    for (let i = 0; i < fireTrail.length; i += 3) {
      const sc = worldToScreen(fireTrail[i].x, fireTrail[i].y);
      punchLight(maskCtx, sc.x, sc.y, 60 * ZOOM, 0.55);
    }

    // the boss is on fire -- it lights up its own surroundings, giving""")

# ---- glow over the mask ----
sub("    embers.forEach((e) => {\n      if (Math.abs(e.x - camX)", """    for (let i = 0; i < fireTrail.length; i += 2) {
      const f = fireTrail[i];
      if (Math.abs(f.x - camX) > VISIBLE_HALF_W + 40 || Math.abs(f.y - camY) > VISIBLE_HALF_H + 40) continue;
      const age = (now - f.born) / (f.until - f.born);
      g.globalAlpha = 0.2 * (age > 0.78 ? Math.max(0, (1 - age) / 0.22) : 1);
      g.fillStyle = '#ff7a20';
      g.beginPath(); g.arc(f.x, f.y, FIRE_TRAIL_R * 2, 0, Math.PI * 2); g.fill();
    }
    fireballs.forEach((f) => {
      g.globalAlpha = 0.3;
      g.fillStyle = '#ff8a30';
      g.beginPath(); g.arc(f.x, f.y, FIREBALL_RADIUS * 1.9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.55;
      g.fillStyle = '#ffd27a';
      g.beginPath(); g.arc(f.x, f.y, FIREBALL_RADIUS * 0.7, 0, Math.PI * 2); g.fill();
    });
    embers.forEach((e) => {
      if (Math.abs(e.x - camX)""")

open(p, 'w', encoding='utf-8').write(s)
print('ok')
