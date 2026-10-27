  // ---- magma cracks and embers ----
  // The floor is split open and glowing. The cracks are generated once from a
  // fixed seed (so every run has the same ones), baked into three offscreen
  // layers -- a charred edge, the hot orange/yellow seam, and a small soft
  // glow -- so each frame is only a few drawImage calls with a pulsing alpha.
  const crackPts = [];
  let crackCrust = null, crackHot = null, crackGlow = null;
  const GLOW_DIV = 4;
  (function bakeMagmaCracks() {
    let seed = 0x5eed1234;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const onFloor = (x, y) => {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && LEVEL.grid[ty][tx] === '.';
    };
    const lines = [];
    function walk(x, y, a, steps, w, depth) {
      const pts = [[x, y]];
      for (let i = 0; i < steps; i++) {
        a += (rnd() - 0.5) * 1.2;
        const len = 10 + rnd() * 14;
        const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
        if (!onFloor(nx, ny)) break;
        x = nx; y = ny;
        pts.push([x, y]);
        if (depth < 2 && rnd() < 0.2) {
          walk(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), 3 + Math.floor(rnd() * 5), w * 0.6, depth + 1);
        }
      }
      if (pts.length > 1) lines.push({ pts, w });
    }
    for (let i = 0; i < 46; i++) {
      let x = 0, y = 0, tries = 0;
      do { x = rnd() * WORLD_W; y = rnd() * WORLD_H; } while (!onFloor(x, y) && ++tries < 60);
      if (tries >= 60) continue;
      const a = rnd() * Math.PI * 2, w = 2.6 + rnd() * 1.4, n = 5 + Math.floor(rnd() * 8);
      walk(x, y, a, n, w, 0);              // a crack runs both ways from where it starts
      walk(x, y, a + Math.PI, n, w, 0);
    }
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    crackCrust = mk(WORLD_W, WORLD_H);
    crackHot = mk(WORLD_W, WORLD_H);
    crackGlow = mk(Math.ceil(WORLD_W / GLOW_DIV), Math.ceil(WORLD_H / GLOW_DIV));
    // each seam tapers toward its tip: drawn edge by edge, a little thinner each time
    const stroke = (c, sc, extra, scale) => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      lines.forEach((ln) => {
        const n = ln.pts.length - 1;
        for (let i = 0; i < n; i++) {
          c.beginPath();
          c.moveTo(ln.pts[i][0] * sc, ln.pts[i][1] * sc);
          c.lineTo(ln.pts[i + 1][0] * sc, ln.pts[i + 1][1] * sc);
          c.lineWidth = Math.max(0.6, (ln.w * (1 - 0.65 * (i / n)) + extra) * scale) * sc;
          c.stroke();
        }
      });
    };
    const cc = crackCrust.getContext('2d');
    cc.strokeStyle = 'rgba(12,6,4,0.85)';
    stroke(cc, 1, 4, 1);
    const ch = crackHot.getContext('2d');
    ch.strokeStyle = '#c8380d'; stroke(ch, 1, 1.4, 1);
    ch.strokeStyle = '#ff8a2a'; stroke(ch, 1, 0, 0.7);
    ch.strokeStyle = '#ffe27a'; stroke(ch, 1, -1.2, 0.35);
    const cg = crackGlow.getContext('2d');
    try { cg.filter = 'blur(1.5px)'; } catch (e) { /* no canvas filters: the glow just stays crisp */ }
    cg.strokeStyle = 'rgba(255,110,30,0.6)';
    stroke(cg, 1 / GLOW_DIV, 12, 1);
    lines.forEach((ln) => ln.pts.forEach((pt) => crackPts.push({ x: pt[0], y: pt[1] })));
  })();

  let embers = [];
  const EMBER_CAP = 320;

  function spawnEmber(x, y, burst) {
    if (embers.length >= EMBER_CAP) return;
    const a = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const sp = burst ? 40 + Math.random() * 120 : 14 + Math.random() * 34;
    embers.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - (burst ? 30 : 0),
      life: 0,
      maxLife: burst ? 0.5 + Math.random() * 0.8 : 1.3 + Math.random() * 2.2,
      size: burst ? 1 + Math.random() * 1.6 : 0.8 + Math.random() * 1.7,
      wob: Math.random() * 6.28,
      burst: !!burst,
    });
  }
  function spawnEmberBurst(x, y, n) {
    for (let i = 0; i < n; i++) spawnEmber(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, true);
  }

  function updateEmbers(dt) {
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life += dt;
      if (e.life >= e.maxLife) { embers.splice(i, 1); continue; }
      e.x += (e.vx + Math.sin(e.life * 3 + e.wob) * 9) * dt;
      e.y += e.vy * dt;
      const drag = Math.min(1, dt * (e.burst ? 3 : 0.6));
      e.vx *= 1 - drag;
      e.vy *= 1 - drag;
      if (!e.burst) e.vy -= 10 * dt; // heat keeps them climbing
    }
    // ambient: only worth spawning where somebody can see them
    if (!players.length) return;
    const near = (x, y) => players.some((pl) => Math.abs(x - pl.x) < VISIBLE_HALF_W + 30 && Math.abs(y - pl.y) < VISIBLE_HALF_H + 30);
    let budget = dt * 42 * PLAYER_MODE;
    while (budget > 0) {
      if (Math.random() > budget) break;
      budget -= 1;
      let src = null;
      if (Math.random() < 0.8 && crackPts.length) src = crackPts[Math.floor(Math.random() * crackPts.length)];
      else if (fires.length) { const f = fires[Math.floor(Math.random() * fires.length)]; src = tileCenter(f.x, f.y); }
      if (src && near(src.x, src.y)) spawnEmber(src.x + (Math.random() - 0.5) * 6, src.y + (Math.random() - 0.5) * 4, false);
    }
    // now and then a seam spits a handful of sparks
    if (crackPts.length && Math.random() < dt * 2.2) {
      const src = crackPts[Math.floor(Math.random() * crackPts.length)];
      if (near(src.x, src.y)) spawnEmberBurst(src.x, src.y, 5 + Math.floor(Math.random() * 5));
    }
  }

  // under the darkness: the charred edge, then the seam, pulsing
  function drawMagmaCracks(g, camX, camY, now) {
    const x0 = Math.max(0, camX - VISIBLE_HALF_W), y0 = Math.max(0, camY - VISIBLE_HALF_H);
    const w = Math.min(WORLD_W - x0, VISIBLE_HALF_W * 2), h = Math.min(WORLD_H - y0, VISIBLE_HALF_H * 2);
    if (w <= 0 || h <= 0) return;
    g.drawImage(crackCrust, x0, y0, w, h, x0, y0, w, h);
    const pulse = 0.72 + 0.22 * Math.sin(now * 0.0031) + 0.06 * Math.sin(now * 0.011);
    g.save();
    g.globalAlpha = pulse;
    g.drawImage(crackHot, x0, y0, w, h, x0, y0, w, h);
    g.restore();
  }

  // over the darkness mask: magma and embers are light sources, so they
  // shine through the black instead of being swallowed by it
  function drawMagmaGlow(g, camX, camY, now) {
    const x0 = Math.max(0, camX - VISIBLE_HALF_W), y0 = Math.max(0, camY - VISIBLE_HALF_H);
    const w = Math.min(WORLD_W - x0, VISIBLE_HALF_W * 2), h = Math.min(WORLD_H - y0, VISIBLE_HALF_H * 2);
    if (w <= 0 || h <= 0) return;
    const pulse = 0.72 + 0.22 * Math.sin(now * 0.0031) + 0.06 * Math.sin(now * 0.011);
    g.save();
    g.translate(VIEW_W / 2, VIEW_H / 2);
    g.scale(ZOOM, ZOOM);
    g.translate(-camX, -camY);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 * pulse;
    g.drawImage(crackHot, x0, y0, w, h, x0, y0, w, h);
    g.globalAlpha = 0.55 * pulse;
    g.drawImage(crackGlow, x0 / GLOW_DIV, y0 / GLOW_DIV, w / GLOW_DIV, h / GLOW_DIV, x0, y0, w, h);
    embers.forEach((e) => {
      if (Math.abs(e.x - camX) > VISIBLE_HALF_W + 10 || Math.abs(e.y - camY) > VISIBLE_HALF_H + 10) return;
      const k = e.life / e.maxLife;
      const flick = 0.75 + 0.25 * Math.sin(now * 0.04 + e.wob * 7);
      const r = e.size * (1 - 0.5 * k);
      g.globalAlpha = Math.min(1, (1 - k) * 1.3) * flick;
      g.fillStyle = k < 0.25 ? '#fff2b0' : k < 0.6 ? '#ffa030' : '#e8481a';
      g.beginPath(); g.arc(e.x, e.y, r, 0, Math.PI * 2); g.fill();
      if (r > 1.4) {
        g.globalAlpha *= 0.28;
        g.beginPath(); g.arc(e.x, e.y, r * 3, 0, Math.PI * 2); g.fill();
      }
    });
    g.restore();
  }

