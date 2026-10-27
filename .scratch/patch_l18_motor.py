p = 'js/game18.js'
s = open(p, encoding='utf-8').read()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:80])
    s = s.replace(a, b)

# ---- players remember where they started, so a checkpoint at the dock can be undone by a level reset
rep("      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,", "      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, homeSpawn: spawn, invulnerableUntil: 0,")
rep("    players.forEach((p) => {\n      respawnPlayer(p);\n      p.caught = false;", "    players.forEach((p) => {\n      p.spawn = p.homeSpawn;\n      respawnPlayer(p);\n      p.caught = false;")

# ---- motor boats, driven like the Level 31 cars
rep("""      return { x: c.x, y: c.y, angle: 0, rider: null, sunk: false, sunkAt: 0, rowUntil: 0 };""", """      return { x: c.x, y: c.y, angle: 0, heading: 0, v: 0, rider: null, sunk: false, sunkAt: 0, home: { x: b.x, y: b.y }, nextHumAt: 0 };""")
rep("  const BOAT_BOARD_RADIUS = 64;", """  const BOAT_BOARD_RADIUS = 64;
  // The boats are motor boats and handle just like the Level 31 cars: W / up is
  // gas, S / down is brake then reverse, A D / left right steer (and steering
  // only bites while you're moving).
  const BOAT_MAX = PLAYER_SPEED * 3;
  const BOAT_ACCEL = 420;
  const BOAT_BRAKE = 760;
  const BOAT_REV_MAX = 110;
  const BOAT_TURN = 2.7;""")

rep("  function updatePlayerMovement(p, ix, iy, now, dt) {\n", """  function boatHit(x, y, h) {
    const c = Math.cos(h), s2 = Math.sin(h);
    const pts = [[27, 0], [-27, 0], [0, 11], [0, -11], [24, 9], [24, -9], [-24, 9], [-24, -9]];
    return pts.some(([u, w]) => {
      const t = worldToTile(x + u * c - w * s2, y + u * s2 + w * c);
      return tileChar(t.x, t.y) !== '~';
    });
  }

  function driveBoat(p, ix, iy, now, dt) {
    const b = p.boat;
    const throttle = -iy;                       // up = gas, down = brake / reverse
    if (throttle > 0) b.v += (b.v < 0 ? BOAT_BRAKE : BOAT_ACCEL) * dt;
    else if (throttle < 0) b.v -= (b.v > 0 ? BOAT_BRAKE : BOAT_ACCEL * 0.6) * dt;
    else b.v -= Math.sign(b.v) * Math.min(Math.abs(b.v), 140 * dt);   // the water drags you to a stop
    b.v = clamp(b.v, -BOAT_REV_MAX, BOAT_MAX);

    const newH = b.heading + ix * BOAT_TURN * clamp(b.v / 170, -1, 1) * dt;
    if (!boatHit(b.x, b.y, newH)) b.heading = newH;
    const nx = b.x + Math.cos(b.heading) * b.v * dt;
    const ny = b.y + Math.sin(b.heading) * b.v * dt;
    if (boatHit(nx, ny, b.heading)) {           // bounced off a wall
      if (Math.abs(b.v) > 120) { playTone(110, 0.14, 'square', 0.2); for (let i = 0; i < 4; i++) spawnRipple(b.x + (Math.random() - 0.5) * 40, b.y + (Math.random() - 0.5) * 40); }
      b.v = -b.v * 0.25;
    } else {
      b.x = nx; b.y = ny;
    }
    b.angle = b.heading;
    p.x = b.x; p.y = b.y;
    p.facing = { x: Math.cos(b.heading), y: Math.sin(b.heading) };
    if (Math.abs(b.v) > 70 && now >= p.nextRippleAt) {      // a wake behind it
      spawnRipple(b.x - Math.cos(b.heading) * 30, b.y - Math.sin(b.heading) * 30);
      p.nextRippleAt = now + 70;
    }
    if (now >= b.nextHumAt) {                                 // the outboard's drone
      b.nextHumAt = now + 150;
      playTone(55 + Math.abs(b.v) * 0.22, 0.17, 'sawtooth', 0.035);
    }
  }

  function updatePlayerMovement(p, ix, iy, now, dt) {
    if (p.boat && !p.caught) { driveBoat(p, ix, iy, now, dt); return; }
""")

# boarding: the boat starts nose-east, still, and the dock becomes your checkpoint
rep("            b.rider = p; p.boat = b; p.x = b.x; p.y = b.y;\n            spawnFloatingText(b.x, b.y - 18, 'ABOARD');",
    "            b.rider = p; p.boat = b; p.x = b.x; p.y = b.y; b.v = 0; b.heading = 0; b.angle = 0;\n            p.spawn = { x: LEVEL.water.x0 - 2, y: worldToTile(b.home.x * TILE, b.home.y * TILE).y === 0 ? b.home.y : b.home.y };\n            spawnFloatingText(b.x, b.y - 18, 'ABOARD');")

# getting caught on the water sinks your boat, and a fresh one is waiting at the dock
rep("""    p.caught = true;
    p.caughtAt = now;
    p.invulnerableUntil = now + CATCH_CUTSCENE_MS + 1200;
  }""", """    p.caught = true;
    p.caughtAt = now;
    p.invulnerableUntil = now + CATCH_CUTSCENE_MS + 1200;
    if (p.boat) {
      const b = p.boat;
      b.rider = null; b.sunk = true; b.sunkAt = now; p.boat = null;
      for (let i = 0; i < 8; i++) spawnRipple(b.x + (Math.random() - 0.5) * 50, b.y + (Math.random() - 0.5) * 50);
      const c = tileCenter(b.home.x, b.home.y);
      boats.push({ x: c.x, y: c.y, angle: 0, heading: 0, v: 0, rider: null, sunk: false, sunkAt: 0, home: b.home, nextHumAt: 0 });
    }
  }""")

# ---- the Luminescent: a dark purple eel with lights down its sides, living in the dark water
rep("  function respawnPlayer(p) {", """  // ---- the Luminescent ----
  // A long dark-purple eel with glowing lights down both sides, living in the
  // dark part of the channel. It roams at your walking speed; the moment it
  // sees a boat it speeds up to 3x.
  const LUM_ROAM_SPEED = HM.speed(PLAYER_SPEED * 1);
  const LUM_HUNT_SPEED = HM.speed(PLAYER_SPEED * 3);
  const LUM_SIGHT = 440;
  const LUM_CATCH = 30;
  const LUM_ALERT_MS = 3500;
  const LUM_SEGS = 17, LUM_SPACING = 17;
  let lum = null;
  function makeLuminescent() {
    if (!LEVEL.luminescent) return null;
    const c = tileCenter(LEVEL.luminescent.x, LEVEL.luminescent.y);
    const segs = [];
    for (let i = 0; i < LUM_SEGS; i++) segs.push({ x: c.x - i * LUM_SPACING, y: c.y });
    return { x: c.x, y: c.y, heading: 0, state: 'roam', target: null, nextTargetAt: 0, alertUntil: 0, lastSeen: null, segs, seed: Math.random() * 100 };
  }
  function lumFree(x, y) {
    const r = 10;
    return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return tileChar(t.x, t.y) === '~';
    });
  }
  function lineClearOfWalls(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 16);
    for (let i = 1; i < steps; i++) {
      const t = worldToTile(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      if (tileChar(t.x, t.y) !== '~') return false;
    }
    return true;
  }
  function lumPickTarget(now) {
    const L = LEVEL.luminescent;
    for (let tries = 0; tries < 30; tries++) {
      const tx = L.x0 + Math.random() * (L.x1 - L.x0), ty = 41 + Math.random() * 17;
      const px = tx * TILE, py = ty * TILE;
      if (lumFree(px, py)) { lum.target = { x: px, y: py }; lum.nextTargetAt = now + 6000; return; }
    }
    lum.target = null;
  }
  function updateLuminescent(now, dt) {
    if (!lum) return;
    let seen = null, seenD = Infinity;
    players.forEach((p) => {
      if (p.caught || !p.boat) return;
      const d = Math.hypot(p.x - lum.x, p.y - lum.y);
      if (d < LUM_SIGHT && d < seenD && lineClearOfWalls(lum.x, lum.y, p.x, p.y)) { seen = p; seenD = d; }
    });
    if (seen) {
      if (lum.state !== 'hunt') { playTone(70, 0.6, 'sawtooth', 0.2); playTone(52, 0.8, 'sine', 0.22, 0.05); }
      lum.state = 'hunt'; lum.alertUntil = now + LUM_ALERT_MS; lum.lastSeen = { x: seen.x, y: seen.y };
    } else if (lum.state === 'hunt' && now >= lum.alertUntil) {
      lum.state = 'roam'; lum.target = null;
    }

    let target, speed;
    if (lum.state === 'hunt') { target = lum.lastSeen; speed = LUM_HUNT_SPEED; }
    else {
      if (!lum.target || now >= lum.nextTargetAt || Math.hypot(lum.target.x - lum.x, lum.target.y - lum.y) < 40) lumPickTarget(now);
      target = lum.target; speed = LUM_ROAM_SPEED;
    }
    if (target) {
      const want = Math.atan2(target.y - lum.y, target.x - lum.x);
      let chosen = null;
      for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.3, -1.3, 1.9, -1.9]) {   // steer round the walls
        const h = want + off;
        if (lumFree(lum.x + Math.cos(h) * 26, lum.y + Math.sin(h) * 26) && lumFree(lum.x + Math.cos(h) * 52, lum.y + Math.sin(h) * 52)) { chosen = h; break; }
      }
      if (chosen === null) { lum.target = null; chosen = lum.heading + 1; }
      let d = chosen - lum.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const turn = (lum.state === 'hunt' ? 4.6 : 3) * dt;
      lum.heading += clamp(d, -turn, turn);
      const nx = lum.x + Math.cos(lum.heading) * speed * dt, ny = lum.y + Math.sin(lum.heading) * speed * dt;
      if (lumFree(nx, ny)) { lum.x = nx; lum.y = ny; } else lum.target = null;
    }
    // the body follows the head
    lum.segs[0].x = lum.x; lum.segs[0].y = lum.y;
    for (let i = 1; i < lum.segs.length; i++) {
      const a = lum.segs[i - 1], b = lum.segs[i];
      const dx = a.x - b.x, dy = a.y - b.y, dist = Math.hypot(dx, dy) || 1;
      if (dist > LUM_SPACING) { b.x = a.x - (dx / dist) * LUM_SPACING; b.y = a.y - (dy / dist) * LUM_SPACING; }
    }
    // bite anyone on a boat it reaches
    players.forEach((p) => {
      if (p.caught || !p.boat || now < p.invulnerableUntil) return;
      for (let i = 0; i < 4; i++) {
        if (Math.hypot(p.x - lum.segs[i].x, p.y - lum.segs[i].y) < LUM_CATCH - i * 3) { triggerCaught(p, now); break; }
      }
    });
  }

  function drawLuminescent(g, now) {
    if (!lum) return;
    const hunting = lum.state === 'hunt';
    const n = lum.segs.length;
    const pos = lum.segs.map((sg, i) => {              // a ripple travels down the body
      const prev = lum.segs[Math.max(0, i - 1)], next = lum.segs[Math.min(n - 1, i + 1)];
      const ang = Math.atan2(prev.y - next.y, prev.x - next.x);
      const sway = Math.sin(now * (hunting ? 0.014 : 0.006) - i * 0.7) * (2 + i * 0.5);
      return { x: sg.x - Math.sin(ang) * sway, y: sg.y + Math.cos(ang) * sway, ang };
    });
    g.save();
    for (let i = n - 1; i >= 0; i--) {
      const t = 1 - i / (n - 1);
      const r = 3 + 10 * Math.pow(t, 0.6);
      g.fillStyle = '#1b0a28';
      g.beginPath(); g.arc(pos[i].x, pos[i].y, r + 1.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = i % 2 ? '#35124d' : '#2c0f42';
      g.beginPath(); g.arc(pos[i].x, pos[i].y, r, 0, Math.PI * 2); g.fill();
    }
    // fins near the head
    [3, 4].forEach((i) => [-1, 1].forEach((side) => {
      const q = pos[i];
      g.fillStyle = '#3d1a5a';
      g.beginPath();
      g.moveTo(q.x + Math.cos(q.ang + side * 1.5) * 8, q.y + Math.sin(q.ang + side * 1.5) * 8);
      g.lineTo(q.x + Math.cos(q.ang + side * 1.1) * 22 - Math.cos(q.ang) * 8, q.y + Math.sin(q.ang + side * 1.1) * 22 - Math.sin(q.ang) * 8);
      g.lineTo(q.x + Math.cos(q.ang + side * 1.5) * 8 - Math.cos(q.ang) * 14, q.y + Math.sin(q.ang + side * 1.5) * 8 - Math.sin(q.ang) * 14);
      g.closePath(); g.fill();
    }));
    // the lights along both sides of its body
    g.globalCompositeOperation = 'lighter';
    const lightCol = hunting ? '255,95,150' : '110,245,255';
    for (let i = 1; i < n; i++) {
      const t = 1 - i / (n - 1);
      const r = 3 + 10 * Math.pow(t, 0.6);
      const pulse = 0.7 + 0.3 * Math.sin(now * 0.008 - i * 0.9);
      [-1, 1].forEach((side) => {
        const lx = pos[i].x + Math.cos(pos[i].ang + side * Math.PI / 2) * (r - 1), ly = pos[i].y + Math.sin(pos[i].ang + side * Math.PI / 2) * (r - 1);
        const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 12);
        gr.addColorStop(0, `rgba(${lightCol},${0.85 * pulse})`); gr.addColorStop(1, `rgba(${lightCol},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(255,255,255,${0.9 * pulse})`; g.beginPath(); g.arc(lx, ly, 1.8, 0, Math.PI * 2); g.fill();
      });
    }
    g.globalCompositeOperation = 'source-over';
    // the head: a pointed snout and two eyes
    const hd = pos[0];
    g.fillStyle = '#1b0a28';
    g.beginPath(); g.ellipse(hd.x + Math.cos(hd.ang) * 6, hd.y + Math.sin(hd.ang) * 6, 14, 9, hd.ang, 0, Math.PI * 2); g.fill();
    [-1, 1].forEach((side) => {
      const ex = hd.x + Math.cos(hd.ang) * 9 + Math.cos(hd.ang + side * Math.PI / 2) * 5, ey = hd.y + Math.sin(hd.ang) * 9 + Math.sin(hd.ang + side * Math.PI / 2) * 5;
      g.fillStyle = hunting ? '#ff4f7a' : '#d9a8ff';
      g.beginPath(); g.arc(ex, ey, 2.4, 0, Math.PI * 2); g.fill();
    });
    g.restore();
  }

  function respawnPlayer(p) {""")
rep("    boats = makeBoats();\n    waterGunAtEnd", "    boats = makeBoats();\n    lum = makeLuminescent();\n    waterGunAtEnd")
rep("      updateBoats(now);\n", "      updateBoats(now);\n      updateLuminescent(now, dt);\n")
rep("    drawBoats(ctx, now);\n    drawPlayers(ctx);", "    drawLuminescent(ctx, now);\n    drawBoats(ctx, now);\n    drawPlayers(ctx);")

# ---- glowing neon-blue coral on the walls of the dark water
rep("    drawWaterGunPickup(g, now);", """    drawNeonCoral(g, minTX, maxTX, minTY, maxTY, now);
    drawWaterGunPickup(g, now);""")
rep("  function drawBoats(g, now) {", """  // Neon-blue coral clinging to the channel walls, glowing in the dark.
  function drawNeonCoral(g, minTX, maxTX, minTY, maxTY, now) {
    const list = LEVEL.neonCoral || [];
    g.save();
    list.forEach((c, idx) => {
      if (c.x < minTX || c.x > maxTX || c.y < minTY || c.y > maxTY) return;
      let dx = 0, dy = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ax, ay]) => { if (tileChar(c.x + ax, c.y + ay) === '~') { dx = ax; dy = ay; } });
      const cx = c.x * TILE + TILE / 2 + dx * 12, cy = c.y * TILE + TILE / 2 + dy * 12;
      const pulse = 0.75 + 0.25 * Math.sin(now * 0.003 + idx * 1.9);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const halo = g.createRadialGradient(cx, cy, 2, cx, cy, 46);
      halo.addColorStop(0, `rgba(40,200,255,${0.38 * pulse})`); halo.addColorStop(1, 'rgba(40,200,255,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fill();
      g.restore();
      g.lineCap = 'round';
      const base = Math.atan2(dy, dx);
      for (let k = 0; k < 6; k++) {                    // branching fingers of coral
        const a = base + (k - 2.5) * 0.42 + Math.sin(now * 0.002 + idx + k) * 0.06;
        const len = 14 + (k % 3) * 5;
        const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
        g.strokeStyle = `rgba(30,150,255,${0.9 * pulse})`; g.lineWidth = 4;
        g.beginPath(); g.moveTo(cx - dx * 6, cy - dy * 6); g.lineTo(ex, ey); g.stroke();
        g.strokeStyle = `rgba(150,245,255,${pulse})`; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(cx - dx * 6, cy - dy * 6); g.lineTo(ex, ey); g.stroke();
        g.fillStyle = '#e6ffff'; g.beginPath(); g.arc(ex, ey, 2.4, 0, Math.PI * 2); g.fill();
      }
    });
    g.restore();
  }

  function drawBoats(g, now) {""")
# ---- motor boats instead of rowboats
a = s.index("  function drawBoats(g, now) {")
b = s.index("  function drawPlayers(g) {")
s = s[:a] + """  function drawBoats(g, now) {
    boats.forEach((b) => {
      let alpha = 1, sink = 0;
      if (b.sunk) {
        const t = (now - b.sunkAt) / 1600;
        if (t >= 1) return;
        alpha = 1 - t; sink = t * 12;
      }
      const speedFrac = clamp(Math.abs(b.v) / BOAT_MAX, 0, 1);
      g.save();
      g.translate(b.x, b.y + sink);
      g.rotate(b.angle);
      g.globalAlpha = alpha;
      if (b.rider && speedFrac > 0.12) {            // the churn behind the outboard
        for (let k = 0; k < 4; k++) {
          g.fillStyle = `rgba(225,242,255,${0.34 * speedFrac * (1 - k / 4)})`;
          g.beginPath(); g.ellipse(-38 - k * 15, (Math.random() - 0.5) * 3, 13 + k * 5, 5 + k * 3.5, 0, 0, Math.PI * 2); g.fill();
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(3, 5, 33, 15, 0, 0, Math.PI * 2); g.fill();
      // the hull: a sleek white speedboat, pointed at the bow
      g.fillStyle = '#e8edf3'; g.strokeStyle = '#3c4a5a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(36, 0); g.quadraticCurveTo(22, -14, -20, -13); g.lineTo(-30, -10); g.lineTo(-30, 10); g.lineTo(-20, 13); g.quadraticCurveTo(22, 14, 36, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c9302c';                      // a racing stripe down the middle
      g.beginPath(); g.moveTo(34, 0); g.lineTo(-26, -3); g.lineTo(-26, 3); g.closePath(); g.fill();
      g.fillStyle = '#243444';                      // the cockpit
      g.beginPath(); g.ellipse(-4, 0, 14, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(160,215,255,0.55)';        // windscreen
      g.beginPath(); g.moveTo(11, -8); g.lineTo(18, -5); g.lineTo(18, 5); g.lineTo(11, 8); g.closePath(); g.fill();
      g.fillStyle = '#2a2f36';                      // the outboard motor on the stern
      g.fillRect(-36, -6, 9, 12);
      g.fillStyle = '#6b7684'; g.fillRect(-35, -4, 3, 8);
      g.fillStyle = '#fff3a8';                      // bow light
      g.beginPath(); g.arc(33, 0, 2.2, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }

""" + s[b:]

# ---- lights: the neon coral glows, the boats have headlights, the Luminescent's lights show in the dark
rep("    players.forEach((pl) => {\n      const s = worldToScreen(pl.x, pl.y);\n      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl) * boatLight(pl), 1);", """    (LEVEL.neonCoral || []).forEach((c, i) => {
      const cx = c.x * TILE + TILE / 2, cy = c.y * TILE + TILE / 2;
      const s = worldToScreen(cx, cy);
      if (s.x < -110 || s.x > VIEW_W + 110 || s.y < -110 || s.y > VIEW_H + 110) return;
      punchLight(maskCtx, s.x, s.y, 80 * (0.92 + 0.08 * Math.sin(now * 0.003 + i * 1.9)), 0.6);
    });
    boats.forEach((b) => {
      if (!b.rider || b.sunk) return;
      const s = worldToScreen(b.x + Math.cos(b.heading) * 80, b.y + Math.sin(b.heading) * 80);
      punchLight(maskCtx, s.x, s.y, 135, 0.8);                      // the headlight
    });
    if (lum) {
      for (let i = 1; i < lum.segs.length; i += 2) {
        const s = worldToScreen(lum.segs[i].x, lum.segs[i].y);
        if (s.x < -60 || s.x > VIEW_W + 60 || s.y < -60 || s.y > VIEW_H + 60) continue;
        punchLight(maskCtx, s.x, s.y, 42, 0.8);
      }
    }
    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl) * boatLight(pl), 1);""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)

h = open('level18.html', encoding='utf-8').read()
a = "it opens onto a dock, and the only way on is by <strong>boat</strong>."
assert a in h
h = h.replace(a, "it opens onto a dock, and the only way on is by <strong>motor boat</strong> &mdash; they steer just like the cars in Level 31. The channel past it gets darker the further you go, with walls to weave through, glowing neon-blue coral to light your way, and something in the dark water: <strong>the Luminescent</strong>, a dark purple eel with lights down its sides that roams at your walking speed and, once it sees you, comes at <strong>3x</strong>.")
open('level18.html', 'w', encoding='utf-8', newline='\n').write(h)
print('patched')
