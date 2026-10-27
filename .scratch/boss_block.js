  // =====================================================================
  //  Mini boss
  // =====================================================================
  // Two ways to hurt it, picked per design:
  //   classic   (bombEvery 0): bombs lie around the arena all the time; after every
  //                            attack it is worn out for a while and a bomb lands.
  //   coughing  (bombEvery N): it only coughs up a bomb after every Nth attack, and
  //                            is worn out (and hittable) just then.
  const BOSS_TARGET_BOMBS = PLAYER_MODE === 1 ? 2 : 3;
  const COUGH_MODE = IS_BOSS && BOSS.bombEvery > 0;
  const MAGMA_R = 48; // a 3x3-tile puddle

  function openFloorFarFromBoss() {
    const cands = floorTiles.filter((t) => {
      const c = tileCenter(t.x, t.y);
      return boss && Math.hypot(c.x - boss.x, c.y - boss.y) > 150 && !bombs.some((b) => Math.hypot(b.x - c.x, b.y - c.y) < 40);
    });
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : floorTiles[0];
  }
  function spawnBomb() {
    let t = null;
    const free = LEVEL.bombSpawns.filter((s) => {
      const c = tileCenter(s.x, s.y);
      return !bombs.some((b) => Math.hypot(b.x - c.x, b.y - c.y) < 10);
    });
    if (free.length) t = free[Math.floor(Math.random() * free.length)];
    else t = openFloorFarFromBoss();
    if (!t) return;
    const c = tileCenter(t.x, t.y);
    bombs.push({ x: c.x, y: c.y, seed: Math.random() * 100 });
  }
  // the boss retches a bomb up onto the floor a short way from itself
  function coughBomb(now) {
    if (bombs.length + players.filter((p) => p.bomb).length >= 2) return;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, d = MON_SIZE + 40 + Math.random() * 40;
      const x = boss.x + Math.cos(a) * d, y = boss.y + Math.sin(a) * d;
      if (!bossCanOccupyPoint(x, y) || isInSafeZone({ x, y })) continue;
      bombs.push({ x, y, seed: Math.random() * 100, born: now });
      spawnBurst(x, y);
      spawnFloatingText(x, y - 10, 'BOMB!');
      return;
    }
    bombs.push({ x: boss.x, y: boss.y + MON_SIZE + 24, seed: Math.random() * 100, born: now });
  }

  function shuffleAttacks() {
    const list = (BOSS.attacks && BOSS.attacks.length ? BOSS.attacks : ['charge']).slice();
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }
  function nextAttack() {
    if (!attackQueue.length) attackQueue = shuffleAttacks();
    return attackQueue.pop();
  }
  function aimAt(m, p) {
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  function beginAttack(now) {
    const kind = nextAttack();
    boss.phase = 'attack';
    boss.atk = { kind, start: now, fired: 0, dir: null, crashed: false, ring: 0 };
    boss.state = 'alert';
    if (kind === 'slam') planSlam(now);
    if (kind === 'magma') planMagma(now);
    if (kind === 'obsidian') { boss.atk.vx = 0; boss.atk.vy = 0; }
    playWarn();
  }

  // The vulnerable window. In coughing mode this is when the bomb comes up.
  function enterTired(now, mult) {
    boss.phase = 'tired';
    boss.tired = true;
    boss.phaseAt = now + BOSS.rest * 1000 * (mult || 1);
    boss.atk = null;
    boss.obsidian = 0;
    boss.path = []; boss.pathIndex = 0;
  }
  // Every attack finishes through here.
  function endAttack(now, mult) {
    boss.atkCount = (boss.atkCount || 0) + 1;
    boss.obsidian = 0;
    if (COUGH_MODE && boss.atkCount % BOSS.bombEvery !== 0) {
      boss.phase = 'recover';
      boss.phaseAt = now + BOSS.pause * 1000 * (mult || 1);
      boss.atk = null;
      boss.path = []; boss.pathIndex = 0;
      return;
    }
    enterTired(now, mult);
    if (COUGH_MODE) { coughBomb(now); spawnFloatingText(boss.x, boss.y - MON_SIZE - 8, '*COUGH*'); sweep(160, 70, 0.3, 'sawtooth', 0.2); }
  }

  function planSlam(now) {
    const targets = players.filter((p) => !p.caught && !isInSafeZone(p)).map((p) => ({ x: p.x, y: p.y }));
    const extra = floorTiles.length ? floorTiles[Math.floor(Math.random() * floorTiles.length)] : null;
    if (extra) { const c = tileCenter(extra.x, extra.y); targets.push({ x: c.x, y: c.y }); }
    targets.forEach((t) => hazards.push({ type: 'circle', x: t.x, y: t.y, r: 46, armAt: now + 1000, until: now + 1300, hit: false }));
  }

  // Three blobs lobbed into the air: each leaves a shadow on the ground for 2s, then
  // splatters into a 3x3-tile puddle of magma that burns for 3s.
  function planMagma(now) {
    const live = players.filter((p) => !p.caught && !isInSafeZone(p));
    for (let i = 0; i < 3; i++) {
      const tgt = live.length ? live[i % live.length] : null;
      let x = tgt ? tgt.x : boss.x, y = tgt ? tgt.y : boss.y;
      for (let tries = 0; tries < 20; tries++) {
        const a = Math.random() * Math.PI * 2, d = tgt ? (i < live.length ? Math.random() * 14 : 30 + Math.random() * 70) : 80 + Math.random() * 200;
        const cx = (tgt ? tgt.x : boss.x) + Math.cos(a) * d, cy = (tgt ? tgt.y : boss.y) + Math.sin(a) * d;
        if (bossCanOccupyPoint(cx, cy) && !isInSafeZone({ x: cx, y: cy })) { x = cx; y = cy; break; }
      }
      const launch = now + 250 + i * 330;
      hazards.push({ type: 'blob', x, y, sx: boss.x, sy: boss.y, launchAt: launch, armAt: launch + 2000, until: launch + 5000, r: MAGMA_R, boomed: false });
    }
  }

  function bossCanOccupyPoint(x, y) {
    const t = worldToTile(x, y);
    const ch = tileChar(t.x, t.y);
    return ch !== '#' && !(ch === 'D' && !doorUnlocked);
  }

  function updateBoss(now, dt) {
    const m = boss;
    if (m.dead) return;
    const hpFrac = m.hp / BOSS.hp;

    if (m.phase === 'chase') {
      m.state = 'alert';
      const near = nearestTarget(m, true);
      if (near && now >= m.nextRepathAt) {
        m.nextRepathAt = now + REPATH_MS;
        const st = worldToTile(m.x, m.y), gt = worldToTile(near.p.x, near.p.y);
        const path = bfsPath(st.x, st.y, gt.x, gt.y);
        m.path = path || []; m.pathIndex = 0;
      }
      followPath(m, HM.speed(PLAYER_SPEED * BOSS.speed), dt);
      if (now >= m.phaseAt) beginAttack(now);
      return;
    }

    if (m.phase === 'recover') {
      m.state = 'alert';
      if (now >= m.phaseAt) { m.phase = 'chase'; m.phaseAt = now + 1500 - 600 * (1 - hpFrac); }
      return;
    }

    if (m.phase === 'tired') {
      m.state = 'idle';
      if (now >= m.phaseAt) {
        m.tired = false;
        m.phase = 'chase';
        m.phaseAt = now + 1700 - 700 * (1 - hpFrac);
        m.state = 'alert';
      }
      return;
    }

    if (m.phase !== 'attack' || !m.atk) return;
    const a = m.atk;
    const t = (now - a.start) / 1000;
    const near = nearestTarget(m, true);

    if (a.kind === 'charge') {
      if (t < 0.95) {
        if (near && t < 0.5) a.dir = aimAt(m, near.p);
        if (a.dir) m.lookDir = a.dir;
      } else {
        if (!a.dir) a.dir = near ? aimAt(m, near.p) : { x: 1, y: 0 };
        const step = HM.speed(PLAYER_SPEED * 3.4) * dt;
        const nx = m.x + a.dir.x * step, ny = m.y + a.dir.y * step;
        const lead = MON_SIZE * 0.6;
        if (!bossCanOccupyPoint(nx + a.dir.x * lead, ny + a.dir.y * lead)) {
          a.crashed = true;
          sweep(120, 35, 0.3, 'square', 0.4);
          spawnFloatingText(m.x, m.y - MON_SIZE - 6, 'CRASH!');
          endAttack(now, 1.4);
          return;
        }
        m.x = nx; m.y = ny;
        if (t > 2.1) endAttack(now, 1);
      }
      return;
    }

    if (a.kind === 'fireballs') {
      const times = [0.5, 1.2, 1.9];
      if (a.fired < times.length && t >= times[a.fired]) {
        const tgt = near ? near.p : players[0];
        const base = Math.atan2(tgt.y - m.y, tgt.x - m.x);
        m.lookDir = { x: Math.cos(base), y: Math.sin(base) };
        for (let i = -1; i <= 1; i++) {
          const ang = base + i * 0.3;
          hazards.push({ type: 'proj', x: m.x, y: m.y, vx: Math.cos(ang) * 175, vy: Math.sin(ang) * 175, r: 7, born: now });
        }
        sweep(900, 300, 0.12, 'sawtooth', 0.18);
        a.fired++;
      }
      if (t > 2.7) endAttack(now, 1);
      return;
    }

    // Hardens into obsidian and ricochets round the arena for 10s at 1.5x a player's speed.
    if (a.kind === 'obsidian') {
      m.obsidian = clamp(t / 0.9, 0, 1);
      if (t < 0.9) {
        if (near) m.lookDir = aimAt(m, near.p);
        return;
      }
      if (!a.vx && !a.vy) {
        const d = near ? aimAt(m, near.p) : { x: 1, y: 0.4 };
        const sp = HM.speed(PLAYER_SPEED * 1.5);
        a.vx = d.x * sp; a.vy = d.y * sp;
        sweep(300, 90, 0.35, 'square', 0.3);
      }
      const lead = MON_SIZE * 0.75;
      let nx = m.x + a.vx * dt, ny = m.y;
      if (!bossCanOccupyPoint(nx + Math.sign(a.vx) * lead, ny) || !bossCanOccupyPoint(nx + Math.sign(a.vx) * lead, ny - lead * 0.6) || !bossCanOccupyPoint(nx + Math.sign(a.vx) * lead, ny + lead * 0.6)) {
        spawnBurst(m.x + Math.sign(a.vx) * lead, m.y);
        a.vx = -a.vx; nx = m.x; playTone(120, 0.1, 'square', 0.18);
      }
      ny = m.y + a.vy * dt;
      if (!bossCanOccupyPoint(nx, ny + Math.sign(a.vy) * lead) || !bossCanOccupyPoint(nx - lead * 0.6, ny + Math.sign(a.vy) * lead) || !bossCanOccupyPoint(nx + lead * 0.6, ny + Math.sign(a.vy) * lead)) {
        spawnBurst(m.x, m.y + Math.sign(a.vy) * lead);
        a.vy = -a.vy; ny = m.y; playTone(120, 0.1, 'square', 0.18);
      }
      m.x = nx; m.y = ny;
      m.lookDir = { x: a.vx, y: a.vy };
      if (t > 10.9) endAttack(now, 1);
      return;
    }

    if (a.kind === 'magma') {
      if (near) m.lookDir = aimAt(m, near.p);
      if (t > 2.8) endAttack(now, 1);
      return;
    }

    if (a.kind === 'shockwave') {
      if (a.ring === 0 && t >= 0.85) {
        hazards.push({ type: 'ring', x: m.x, y: m.y, r: 18, gap: Math.random() * Math.PI * 2, gapW: 1.25, speed: 165, max: 470 });
        a.ring = 1;
        sweep(200, 60, 0.4, 'sawtooth', 0.25);
      }
      if (a.ring === 1 && t >= 1.9) {
        hazards.push({ type: 'ring', x: m.x, y: m.y, r: 18, gap: Math.random() * Math.PI * 2, gapW: 1.1, speed: 165, max: 470 });
        a.ring = 2;
        sweep(200, 60, 0.4, 'sawtooth', 0.25);
      }
      if (t > 4.2) endAttack(now, 1);
      return;
    }

    if (a.kind === 'slam') {
      if (a.fired === 0 && t >= 1.6) { planSlam(now); a.fired = 1; playWarn(); }
      if (t > 3.2) endAttack(now, 1);
      return;
    }

    if (a.kind === 'spin') {
      if (t >= 0.6) {
        a.spinAngle = (a.spinAngle || 0) + dt * 2.3;
        if (near && now >= m.nextRepathAt) {
          m.nextRepathAt = now + REPATH_MS;
          const st = worldToTile(m.x, m.y), gt = worldToTile(near.p.x, near.p.y);
          const path = bfsPath(st.x, st.y, gt.x, gt.y);
          m.path = path || []; m.pathIndex = 0;
        }
        followPath(m, HM.speed(PLAYER_SPEED * BOSS.speed * 0.45), dt);
      }
      if (t > 3.8) endAttack(now, 1);
      return;
    }

    endAttack(now, 1);
  }

  function hurtsPlayer(p, now) { return !p.caught && !isInSafeZone(p) && now >= p.invulnerableUntil; }

  function updateHazards(now, dt) {
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      if (h.type === 'proj') {
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (STYLE === 'ashen' && Math.random() < dt * 40) spawnEmber(h.x, h.y, false);
        const t = worldToTile(h.x, h.y);
        if (tileChar(t.x, t.y) === '#' || (tileChar(t.x, t.y) === 'D' && !doorUnlocked) || now - h.born > 6000) { spawnBurst(h.x, h.y); hazards.splice(i, 1); continue; }
        players.forEach((p) => {
          if (hurtsPlayer(p, now) && Math.hypot(p.x - h.x, p.y - h.y) < h.r + PLAYER_RADIUS * 0.8) { triggerCaught(p, now); h.dead = true; }
        });
        if (h.dead) hazards.splice(i, 1);
      } else if (h.type === 'ring') {
        h.r += h.speed * dt;
        if (h.r > h.max) { hazards.splice(i, 1); continue; }
        players.forEach((p) => {
          if (!hurtsPlayer(p, now)) return;
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (Math.abs(d - h.r) > 9 + PLAYER_RADIUS * 0.6) return;
          let diff = Math.atan2(p.y - h.y, p.x - h.x) - h.gap;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(diff) > h.gapW / 2) triggerCaught(p, now);
        });
      } else if (h.type === 'circle') {
        if (now >= h.armAt && !h.boomed) { h.boomed = true; playBlast(); spawnBurst(h.x, h.y); }
        if (h.boomed) {
          players.forEach((p) => {
            if (hurtsPlayer(p, now) && Math.hypot(p.x - h.x, p.y - h.y) < h.r) triggerCaught(p, now);
          });
        }
        if (now >= h.until) hazards.splice(i, 1);
      } else if (h.type === 'blob') {
        if (now >= h.armAt && !h.boomed) {
          h.boomed = true;
          playBlast();
          for (let k = 0; k < 3; k++) spawnBurst(h.x + (Math.random() - 0.5) * 30, h.y + (Math.random() - 0.5) * 30);
          if (STYLE === 'ashen') spawnEmberBurst(h.x, h.y, 30);
        }
        if (h.boomed) {
          if (STYLE === 'ashen' && Math.random() < dt * 14) spawnEmber(h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r, false);
          players.forEach((p) => {
            if (hurtsPlayer(p, now) && Math.hypot(p.x - h.x, p.y - h.y) < h.r - 2) triggerCaught(p, now);
          });
        }
        if (now >= h.until) hazards.splice(i, 1);
      }
    }
    // spinning blades
    if (boss && boss.phase === 'attack' && boss.atk && boss.atk.kind === 'spin' && (now - boss.atk.start) / 1000 >= 0.6) {
      const len = MON_SIZE + 78;
      for (let k = 0; k < 3; k++) {
        const ang = (boss.atk.spinAngle || 0) + k * (Math.PI * 2 / 3);
        const ex = boss.x + Math.cos(ang) * len, ey = boss.y + Math.sin(ang) * len;
        players.forEach((p) => {
          if (!hurtsPlayer(p, now)) return;
          const vx = ex - boss.x, vy = ey - boss.y;
          const tt = clamp(((p.x - boss.x) * vx + (p.y - boss.y) * vy) / (vx * vx + vy * vy), 0, 1);
          if (Math.hypot(p.x - (boss.x + vx * tt), p.y - (boss.y + vy * tt)) < PLAYER_RADIUS + 5) triggerCaught(p, now);
        });
      }
    }
  }

  function updateBombs(now) {
    if (!IS_BOSS || boss.dead) return;
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      const taker = players.find((p) => !p.caught && !p.bomb && Math.hypot(p.x - b.x, p.y - b.y) < 16);
      if (taker) { taker.bomb = true; bombs.splice(i, 1); playBombPick(); spawnFloatingText(b.x, b.y, 'BOMB'); bombRespawnAt = now + 3000; }
    }
    if (!COUGH_MODE && bombs.length < BOSS_TARGET_BOMBS && now >= bombRespawnAt) { spawnBomb(); bombRespawnAt = now + 1500; }
    // land a held bomb on a worn-out boss
    if (boss.phase === 'tired' && now >= boss.invulUntil) {
      players.forEach((p) => {
        if (!p.bomb || p.caught) return;
        if (Math.hypot(p.x - boss.x, p.y - boss.y) < MON_SIZE + 18) {
          p.bomb = false;
          boss.hp = Math.max(0, boss.hp - BOSS.bombDmg);
          boss.flash = 1;
          boss.invulUntil = now + 900;
          playBlast();
          spawnBurst(boss.x, boss.y);
          if (STYLE === 'ashen') spawnEmberBurst(boss.x, boss.y, 40);
          spawnFloatingText(boss.x, boss.y - MON_SIZE - 6, boss.hp > 0 ? `-${BOSS.bombDmg} HP` : 'DOWN!');
          if (boss.hp <= 0) killBoss(now);
        }
      });
    }
  }

  function killBoss(now) {
    boss.dead = true;
    boss.phase = 'dead';
    boss.diedAt = now;
    boss.tired = false;
    boss.obsidian = 0;
    hazards = [];
    bombs = [];
    doorUnlocked = true;
    for (let i = 0; i < 4; i++) setTimeout(() => { spawnBurst(boss.x + (Math.random() - 0.5) * MON_SIZE * 2, boss.y + (Math.random() - 0.5) * MON_SIZE * 2); playBlast(); }, i * 220);
    playDoorUnlockChime();
    spawnFloatingText(boss.x, boss.y - MON_SIZE - 20, 'EXIT OPEN');
    const gun = DESIGN.reward && DESIGN.reward.gun;
    if (gun && window.GoofyStory && !window.GoofyStory.isGunUnlocked(gun)) {
      window.GoofyStory.unlockGun(gun);
      spawnFloatingText(boss.x, boss.y - MON_SIZE - 40, gun.toUpperCase() + ' FOUND! (R)');
    }
  }

