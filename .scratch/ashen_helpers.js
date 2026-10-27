  // =====================================================================
  //  The Ashen look: obsidian floor, glowing magma cracks, drifting embers.
  //  (Ported from the Ashen One's arena, js/game5.js.)
  // =====================================================================
  const OBSIDIAN = ['#25222d', '#2a2634', '#2f2a3a', '#272330', '#322c40', '#2b2736'];
  function drawObsidianSheen(g, tx, ty, px, py) {
    const h = Math.imul(tx + 7, 374761393) ^ Math.imul(ty + 3, 668265263);
    const r1 = ((h ^ (h >>> 13)) >>> 0) % 1000 / 1000;
    const r2 = ((h >>> 7) >>> 0) % 1000 / 1000;
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(px, py, TILE, 1.5);
    g.fillRect(px, py, 1.5, TILE);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(px, py + TILE - 1.5, TILE, 1.5);
    g.fillRect(px + TILE - 1.5, py, 1.5, TILE);
    g.strokeStyle = `rgba(200,185,240,${0.1 + 0.12 * r1})`;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(px + TILE * (0.1 + 0.4 * r2), py + TILE * 0.95);
    g.lineTo(px + TILE * (0.5 + 0.4 * r2), py + TILE * 0.05);
    g.stroke();
    if (r1 > 0.78) {
      g.fillStyle = 'rgba(220,200,255,0.3)';
      g.fillRect(px + TILE * 0.2, py + TILE * 0.2, 4, 4);
    }
  }

  const crackPts = [];
  let crackCrust = null, crackHot = null, crackGlow = null;
  const GLOW_DIV = 4;
  (function bakeMagmaCracks() {
    if (STYLE !== 'ashen') return;
    let seed = 0x5eed1234 ^ (ID * 7919);
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
        if (depth < 2 && rnd() < 0.2) walk(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), 3 + Math.floor(rnd() * 5), w * 0.6, depth + 1);
      }
      if (pts.length > 1) lines.push({ pts, w });
    }
    const seeds = Math.max(8, Math.round(floorTiles.length / 38));
    for (let i = 0; i < seeds; i++) {
      let x = 0, y = 0, tries = 0;
      do { x = rnd() * WORLD_W; y = rnd() * WORLD_H; } while (!onFloor(x, y) && ++tries < 60);
      if (tries >= 60) continue;
      const a = rnd() * Math.PI * 2, w = 1.8 + rnd() * 1.1, n = 4 + Math.floor(rnd() * 7);
      walk(x, y, a, n, w, 0);
      walk(x, y, a + Math.PI, n, w, 0);
    }
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    crackCrust = mk(WORLD_W, WORLD_H);
    crackHot = mk(WORLD_W, WORLD_H);
    crackGlow = mk(Math.ceil(WORLD_W / GLOW_DIV), Math.ceil(WORLD_H / GLOW_DIV));
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
    cc.strokeStyle = 'rgba(14,8,6,0.55)'; stroke(cc, 1, 3, 1);
    const ch = crackHot.getContext('2d');
    ch.strokeStyle = '#6e2610'; stroke(ch, 1, 1.2, 1);
    ch.strokeStyle = '#b8501a'; stroke(ch, 1, 0, 0.65);
    ch.strokeStyle = '#e08a34'; stroke(ch, 1, -1, 0.3);
    const cg = crackGlow.getContext('2d');
    try { cg.filter = 'blur(1.5px)'; } catch (e) { /* no canvas filters: the glow just stays crisp */ }
    cg.strokeStyle = 'rgba(220,90,30,0.45)';
    stroke(cg, 1 / GLOW_DIV, 9, 1);
    lines.forEach((ln) => ln.pts.forEach((pt) => crackPts.push({ x: pt[0], y: pt[1] })));
  })();

  function drawMagmaCracks(g, camX, camY, now) {
    if (!crackCrust) return;
    const x0 = Math.max(0, camX - VIEW_W / 2), y0 = Math.max(0, camY - VIEW_H / 2);
    const w = Math.min(WORLD_W - x0, VIEW_W), h = Math.min(WORLD_H - y0, VIEW_H);
    if (w <= 0 || h <= 0) return;
    g.drawImage(crackCrust, x0, y0, w, h, x0, y0, w, h);
    const pulse = 0.8 + 0.14 * Math.sin(now * 0.0031) + 0.04 * Math.sin(now * 0.011);
    g.save();
    g.globalAlpha = 0.6 * pulse;
    g.drawImage(crackHot, x0, y0, w, h, x0, y0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 * pulse;
    g.drawImage(crackGlow, x0 / GLOW_DIV, y0 / GLOW_DIV, w / GLOW_DIV, h / GLOW_DIV, x0, y0, w, h);
    g.restore();
  }

  let embers = [];
  const EMBER_CAP = 260;
  function spawnEmber(x, y, burst) {
    if (STYLE !== 'ashen' || embers.length >= EMBER_CAP) return;
    const a = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const sp = burst ? 40 + Math.random() * 120 : 14 + Math.random() * 34;
    embers.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (burst ? 30 : 0), life: 0,
      maxLife: burst ? 0.5 + Math.random() * 0.8 : 1.3 + Math.random() * 2.2,
      size: burst ? 1 + Math.random() * 1.6 : 0.8 + Math.random() * 1.7, wob: Math.random() * 6.28, burst: !!burst,
    });
  }
  function spawnEmberBurst(x, y, n) { for (let i = 0; i < n; i++) spawnEmber(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, true); }
  function updateEmbers(dt) {
    if (STYLE !== 'ashen') return;
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life += dt;
      if (e.life >= e.maxLife) { embers.splice(i, 1); continue; }
      e.x += (e.vx + Math.sin(e.life * 3 + e.wob) * 9) * dt;
      e.y += e.vy * dt;
      const drag = Math.min(1, dt * (e.burst ? 3 : 0.6));
      e.vx *= 1 - drag; e.vy *= 1 - drag;
      if (!e.burst) e.vy -= 10 * dt;
    }
    const near = (x, y) => players.some((pl) => Math.abs(x - pl.x) < VIEW_W / 2 + 30 && Math.abs(y - pl.y) < VIEW_H / 2 + 30);
    let budget = dt * 38 * PLAYER_MODE;
    while (budget > 0) {
      if (Math.random() > budget) break;
      budget -= 1;
      let src = null;
      if (Math.random() < 0.8 && crackPts.length) src = crackPts[Math.floor(Math.random() * crackPts.length)];
      else if (lavaTiles.length) { const l = lavaTiles[Math.floor(Math.random() * lavaTiles.length)]; src = tileCenter(l.x, l.y); }
      if (src && near(src.x, src.y)) spawnEmber(src.x + (Math.random() - 0.5) * 6, src.y + (Math.random() - 0.5) * 4, false);
    }
    if (crackPts.length && Math.random() < dt * 2.2) {
      const src = crackPts[Math.floor(Math.random() * crackPts.length)];
      if (near(src.x, src.y)) spawnEmberBurst(src.x, src.y, 5 + Math.floor(Math.random() * 5));
    }
  }

  function softGlow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function lerpHexLocal(a, b, v) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * v);
    return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
  }

  // Everything that burns is a light source, so it's drawn over the darkness:
  // lava tiles, fireballs, magma puddles and embers.
  function drawEmissive(g, camX, camY, now) {
    const minTX = Math.max(0, Math.floor((camX - VIEW_W / 2) / TILE) - 1), maxTX = Math.min(COLS - 1, Math.ceil((camX + VIEW_W / 2) / TILE) + 1);
    const minTY = Math.max(0, Math.floor((camY - VIEW_H / 2) / TILE) - 1), maxTY = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H / 2) / TILE) + 1);
    // lava floor
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        if (LEVEL.grid[y][x] !== 'L') continue;
        const px = x * TILE, py = y * TILE;
        const flow = 0.5 + 0.5 * Math.sin(now * 0.0018 + x * 1.7 + y * 2.3);
        const grd = g.createLinearGradient(px, py, px + TILE, py + TILE);
        grd.addColorStop(0, lerpHexLocal('#8a2208', '#e0561a', flow));
        grd.addColorStop(1, lerpHexLocal('#b83a0e', '#ffb43d', 1 - flow));
        g.fillStyle = grd;
        g.fillRect(px, py, TILE, TILE);
        // darker crust drifting on top
        g.fillStyle = 'rgba(40,12,6,0.55)';
        for (let k = 0; k < 3; k++) {
          const ox = (Math.sin(now * 0.0004 + (x + y * 3) * 1.3 + k * 2.1) * 0.5 + 0.5) * (TILE - 12);
          const oy = (Math.cos(now * 0.0005 + (x * 2 + y) * 1.1 + k * 1.7) * 0.5 + 0.5) * (TILE - 10);
          g.beginPath(); g.ellipse(px + 6 + ox, py + 5 + oy, 5 + (k % 2) * 2, 3.5, k, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(255,230,140,0.5)';
        g.fillRect(px + (Math.sin(now * 0.002 + x + y) * 0.5 + 0.5) * (TILE - 4), py + (Math.cos(now * 0.0023 + x * y) * 0.5 + 0.5) * (TILE - 4), 2, 2);
      }
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        if (LEVEL.grid[y][x] === 'L') softGlow(g, x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 1.5, '255,100,30', 0.32);
      }
    }
    hazards.forEach((h) => {
      if (h.type === 'proj') softGlow(g, h.x, h.y, 24, '255,140,50', 0.5);
      else if (h.type === 'blob' && h.boomed) softGlow(g, h.x, h.y, h.r * 1.7, '255,110,30', 0.5 * Math.min(1, (h.until - now) / 380));
    });
    embers.forEach((e) => {
      if (Math.abs(e.x - camX) > VIEW_W / 2 + 10 || Math.abs(e.y - camY) > VIEW_H / 2 + 10) return;
      const k = e.life / e.maxLife;
      const flick = 0.75 + 0.25 * Math.sin(now * 0.04 + e.wob * 7);
      const r = e.size * (1 - 0.5 * k);
      g.globalAlpha = Math.min(1, (1 - k) * 1.3) * flick;
      g.fillStyle = k < 0.25 ? '#fff2b0' : k < 0.6 ? '#ffa030' : '#e8481a';
      g.beginPath(); g.arc(e.x, e.y, r, 0, Math.PI * 2); g.fill();
      if (r > 1.4) { g.globalAlpha *= 0.28; g.beginPath(); g.arc(e.x, e.y, r * 3, 0, Math.PI * 2); g.fill(); }
    });
    g.restore();
  }

