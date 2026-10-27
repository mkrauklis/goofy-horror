  // ======================= biting (the only way to hurt it) =======================
  function playScream() { [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].forEach((d) => playTone(480 + Math.random() * 520, 0.4, 'sawtooth', 0.12, d)); }
  function playStunSound() { [330, 277, 220, 175].forEach((f, i) => playTone(f, 0.24, 'triangle', 0.2, i * 0.12)); }
  function playCandyCrunch() { playTone(900, 0.06, 'square', 0.13); playTone(1500, 0.05, 'square', 0.1, 0.035); playTone(240, 0.12, 'sawtooth', 0.12, 0.02); }

  function spawnCandyBurst(x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, maxLife: 0.45 + Math.random() * 0.6, size: 2.5 + Math.random() * 3.5,
        color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      });
    }
  }

  function updateBites(now) {
    if (boss.phase !== 'stunned' || boss.defeated) return;
    players.forEach((p) => {
      if (p.caught || now < p.biteReadyAt) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BITE_RADIUS) {
        p.biteReadyAt = now + BITE_COOLDOWN_MS;
        const ang = Math.atan2(p.y - boss.y, p.x - boss.x);
        boss.chunks.push({ ang, size: 0.85 + Math.random() * 0.35 });
        spawnCandyBurst(boss.x + Math.cos(ang) * boss.radius, boss.y + Math.sin(ang) * boss.radius, 14, 220);
        playCandyCrunch();
        applyBossDamage(BITE_DAMAGE, now);
      }
    });
  }

  function applyBossDamage(dmg, now) {
    if (boss.defeated) return;
    bossHealth = Math.max(0, bossHealth - dmg);
    spawnFloatingText(boss.x, boss.y - boss.radius - 12, `BITE! -${dmg}`);
    if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) enterPhase2(now);
    if (bossHealth <= 0 && !boss.defeated) triggerDeath(now);
  }

  function enterPhase2(now) {
    boss.phase2 = true;
    gameState = 'phase2intro';
    phase2IntroStartedAt = now;
    if (boss.phase === 'stunned') boss.stunUntil += PHASE2_CUTSCENE_MS + 800; // the cutscene shouldn't eat your bite window
    candies = []; cornPatches = [];
    spawnFloatingText(boss.x, boss.y - boss.radius - 12, 'WITHERED');
  }

  function triggerDeath(now) {
    boss.defeated = true;
    gameState = 'dying';
    deathStartedAt = now;
    candies = []; cornPatches = []; gasPatches = [];
    spawnCandyBurst(boss.x, boss.y, 40, 300);
    spawnExplosion(boss.x, boss.y);
  }

  // ======================= THE ATTACK CYCLE =======================
  const PHASE1_ATTACKS = ['spiral', 'scream', 'candycorn'];
  const PHASE2_ONLY_ATTACKS = ['cottoncandy'];

  function attackPool() {
    return boss.phase2 ? PHASE1_ATTACKS.concat(PHASE2_ONLY_ATTACKS) : PHASE1_ATTACKS;
  }
  function pickAttack() {
    const pool = attackPool().filter((a) => a !== boss.lastAttack);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randomArenaPoint(margin) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ARENA_R - margin);
    return { x: ARENA_CX + Math.cos(a) * r, y: ARENA_CY + Math.sin(a) * r };
  }
  function clampToArena(x, y, margin) {
    const dx = x - ARENA_CX, dy = y - ARENA_CY, d = Math.hypot(dx, dy), max = ARENA_R - margin;
    if (d <= max) return { x, y };
    return { x: ARENA_CX + (dx / d) * max, y: ARENA_CY + (dy / d) * max };
  }
  function livePlayers() { return players.filter((p) => !p.caught); }

  // n patch positions: a few right on top of players (so they have to move),
  // the rest scattered, none overlapping the ones already picked
  function patchSpots(n, radius, onPlayers) {
    const spots = [];
    const live = livePlayers();
    for (let i = 0; i < n; i++) {
      let best = null;
      for (let tries = 0; tries < 25; tries++) {
        let c;
        if (i < onPlayers && live.length) {
          const p = live[i % live.length];
          const a = Math.random() * Math.PI * 2, r = Math.random() * radius * 1.4;
          c = clampToArena(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, radius);
        } else {
          c = randomArenaPoint(radius);
        }
        best = c;
        if (spots.every((s) => Math.hypot(s.x - c.x, s.y - c.y) > radius * 1.3)) break;
      }
      spots.push(best);
    }
    return spots;
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'spiral') {
      boss.spin = Math.random() * Math.PI * 2;
      boss.spiralNextAt = now;
      boss.spiralOrbit = Math.atan2(boss.y - ARENA_CY, boss.x - ARENA_CX);
    } else if (kind === 'scream') {
      boss.chasing = false;
      playScream();
    } else if (kind === 'candycorn') {
      cornPatches = patchSpots(CORN_COUNT, CORN_RADIUS, 4).map((s) => ({ x: s.x, y: s.y, fireAt: now + CORN_WARN_MS, endAt: now + CORN_WARN_MS + CORN_ACTIVE_MS }));
    } else if (kind === 'cottoncandy') {
      patchSpots(GAS_COUNT, GAS_RADIUS, 2).forEach((s) => gasPatches.push({ x: s.x, y: s.y, startAt: now + GAS_WARN_MS, endAt: now + GAS_WARN_MS + GAS_LIFE_MS }));
    }
  }

  function startStun(now) {
    boss.phase = 'stunned';
    boss.phaseStartedAt = now;
    boss.stunUntil = now + STUN_DURATION_MS;
    boss.attacksSinceStun = 0;
    boss.chasing = false;
    spawnFloatingText(boss.x, boss.y - boss.radius - 14, 'STUNNED -- BITE IT!');
    playStunSound();
  }

  function finishAttack(now) {
    boss.phase = 'idle';
    boss.attacksSinceStun++;
    if (boss.attacksSinceStun >= ATTACKS_PER_STUN) { startStun(now); return; }
    boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
  }

  // The boss moves through here, so everywhere it goes it sheds candy that
  // fades away over TRAIL_LIFE_MS.
  function moveBoss(nx, ny) {
    const c = clampToArena(nx, ny, boss.radius * 0.7);
    const d = Math.hypot(c.x - boss.x, c.y - boss.y);
    boss.x = c.x; boss.y = c.y;
    boss.trailDist += d;
    while (boss.trailDist >= TRAIL_STEP) {
      boss.trailDist -= TRAIL_STEP;
      trail.push({
        x: boss.x + (Math.random() - 0.5) * boss.radius * 1.1, y: boss.y + (Math.random() - 0.5) * boss.radius * 1.1,
        kind: Math.floor(Math.random() * 5),
        c1: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)], c2: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
        rot: Math.random() * Math.PI * 2, born: performance.now(),
      });
    }
    if (trail.length > 450) trail.splice(0, trail.length - 450);
  }
  function moveToward(tx, ty, speed, dt) {
    const dx = tx - boss.x, dy = ty - boss.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return d;
    boss.lookDir = { x: dx / d, y: dy / d };
    const step = Math.min(speed * dt, d);
    moveBoss(boss.x + (dx / d) * step, boss.y + (dy / d) * step);
    return d - step;
  }
  function updateTrail(now) {
    while (trail.length && now - trail[0].born > TRAIL_LIFE_MS) trail.shift();
  }

  function updateBossIdle(now, dt) {
    const live = livePlayers();
    if (live.length) {
      const target = nearestPlayer(boss.x, boss.y);
      if (Math.hypot(target.x - boss.x, target.y - boss.y) > boss.radius) moveToward(target.x, target.y, BOSS_IDLE_SPEED, dt);
    }
    if (now >= boss.nextIdleUntil) startAttack(pickAttack(), now);
  }

  function updateSpiralAttack(now, dt) {
    const elapsed = now - boss.phaseStartedAt;
    boss.spin += dt * SPIRAL_SPIN_RATE;
    boss.spiralOrbit += dt * 0.6;
    boss.lookDir = { x: Math.cos(boss.spin), y: Math.sin(boss.spin) };
    // drifts in and out around the middle of the arena as it spins
    const orbitR = ARENA_R * 0.36 * (0.5 + 0.5 * Math.sin(elapsed * 0.0012 - 1.2));
    moveToward(ARENA_CX + Math.cos(boss.spiralOrbit) * orbitR, ARENA_CY + Math.sin(boss.spiralOrbit) * orbitR, 200, dt);
    let shots = 0;
    while (now >= boss.spiralNextAt && shots < 5) {
      boss.spiralNextAt += SPIRAL_INTERVAL_MS;
      shots++;
      const a = boss.spin + (Math.random() < 0.3 ? (Math.random() - 0.5) * Math.PI * 2 : (Math.random() - 0.5) * 0.8);
      const ca = Math.cos(a), sa = Math.sin(a);
      candies.push({
        x: boss.x + ca * boss.radius * 0.8, y: boss.y + sa * boss.radius * 0.8,
        vx: ca * CANDY_SPEED, vy: sa * CANDY_SPEED,
        rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 9,
        kind: Math.floor(Math.random() * 5),
        c1: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)], c2: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      });
    }
    if (elapsed >= SPIRAL_MS) finishAttack(now);
  }

  function updateScreamAttack(now, dt) {
    const elapsed = now - boss.phaseStartedAt;
    const live = livePlayers();
    if (elapsed < SCREAM_MS) {
      if (live.length) {
        const t = nearestPlayer(boss.x, boss.y);
        const d = Math.hypot(t.x - boss.x, t.y - boss.y) || 1;
        boss.lookDir = { x: (t.x - boss.x) / d, y: (t.y - boss.y) / d };
      }
      return;
    }
    boss.chasing = true;
    if (live.length) {
      const t = nearestPlayer(boss.x, boss.y);
      moveToward(t.x, t.y, CHASE_SPEED, dt);
    }
    if (elapsed >= SCREAM_MS + CHASE_MS) { boss.chasing = false; finishAttack(now); }
  }

  function updateCandyCornAttack(now) {
    if (now - boss.phaseStartedAt >= CORN_WARN_MS + CORN_ACTIVE_MS + 500) finishAttack(now);
  }
  function updateCottonCandyAttack(now) {
    if (now - boss.phaseStartedAt >= GAS_WARN_MS + 700) finishAttack(now);
  }
  function updateStunned(now) {
    if (now < boss.stunUntil) return;
    boss.phase = 'idle';
    boss.nextIdleUntil = now + 700;
    spawnFloatingText(boss.x, boss.y - boss.radius - 14, 'IT RECOVERS!');
  }

  function updateBoss(now, dt) {
    if (boss.defeated) return;
    updateTrail(now);
    if (now < boss.frozenUntil) return;
    switch (boss.phase) {
      case 'idle': updateBossIdle(now, dt); break;
      case 'spiral': updateSpiralAttack(now, dt); break;
      case 'scream': updateScreamAttack(now, dt); break;
      case 'candycorn': updateCandyCornAttack(now); break;
      case 'cottoncandy': updateCottonCandyAttack(now); break;
      case 'stunned': updateStunned(now); break;
      default: boss.phase = 'idle';
    }
  }

  // ---- the hazards the attacks leave on the floor ----
  function updateCandies(now, dt) {
    for (let i = candies.length - 1; i >= 0; i--) {
      const s = candies[i];
      const px = s.x, py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt;
      if (Math.hypot(s.x - ARENA_CX, s.y - ARENA_CY) > ARENA_R + 30) { candies.splice(i, 1); continue; }
      let hit = false;
      players.forEach((p) => {
        if (hit || p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        // swept test along this frame's travel -- at 5x speed a plain point
        // check would tunnel straight through a player at low fps
        const sx = s.x - px, sy = s.y - py;
        const len2 = sx * sx + sy * sy || 1;
        const t = clamp(((p.x - px) * sx + (p.y - py) * sy) / len2, 0, 1);
        if (Math.hypot(p.x - (px + sx * t), p.y - (py + sy * t)) < CANDY_HIT_RADIUS) { triggerCaught(p, now); hit = true; }
      });
      if (hit) { spawnCandyBurst(s.x, s.y, 6, 120); candies.splice(i, 1); }
    }
  }

  function updateCornPatches(now) {
    for (let i = cornPatches.length - 1; i >= 0; i--) {
      const c = cornPatches[i];
      if (now > c.endAt + 250) { cornPatches.splice(i, 1); continue; }
      if (now < c.fireAt || now > c.endAt) continue;
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - c.x, p.y - c.y) < CORN_RADIUS) triggerCaught(p, now);
      });
    }
  }

  function updateGas(now) {
    for (let i = gasPatches.length - 1; i >= 0; i--) if (now > gasPatches[i].endAt) gasPatches.splice(i, 1);
    players.forEach((p) => {
      let inside = false;
      if (!p.caught) {
        for (const g of gasPatches) {
          if (now >= g.startAt && Math.hypot(p.x - g.x, p.y - g.y) < GAS_RADIUS) { inside = true; break; }
        }
      }
      if (inside) {
        if (!p.gasSince) p.gasSince = now;
        else if (now - p.gasSince >= GAS_KILL_MS && now >= p.invulnerableUntil) { p.gasSince = 0; triggerCaught(p, now); }
      } else if (p.gasSince) {
        p.gasSince = 0;
        if (!p.caught) {
          p.slowUntil = now + GAS_SLOW_MS;
          spawnFloatingText(p.x, p.y - 8, 'SLOWED');
        }
      }
    });
  }

  // Touching the boss is deadly -- except while it's stunned, when touching it
  // is how you bite it.
  function updateCatch(now) {
    if (boss.defeated || boss.phase === 'stunned') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (now < p.invulnerableUntil) return;
      if (isHidden(p, now)) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BOSS_CATCH_RADIUS) triggerCaught(p, now);
    });
  }

