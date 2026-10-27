// Per-chapter scenery for the regular levels: decor drawn on plain floor tiles, ambient
// particles, the facility's flickering floor lights (which also light the dark), the frost's
// slippery ice, and the rooftops' birds. Every game file builds one instance with
// LevelDetails.make(LEVEL, n) and calls floor / above / lights / update / ice from its own loop.
// Everything is generated deterministically from the level grid, so nothing has to be authored.
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  function hash(x, y, s) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  const mod = (a, m) => ((a % m) + m) % m;
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];

  function disc(g, x, y, r, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  function glow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const NOOP = {
    floor() {}, above() {}, lights() {}, update() {}, ice() { return false; },
  };

  function make(LEVEL, n) {
    if (!LEVEL || !LEVEL.grid || n % 5 === 0 || n > 30) return NOOP;
    const T = LEVEL.tileSize, G = LEVEL.grid, cols = LEVEL.cols, rows = LEVEL.rows;
    const chapter = Math.ceil(n / 5);
    const S = n * 17 + 3;

    const at = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? '#' : G[y][x];
    const isF = (x, y) => at(x, y) === '.';
    const isW = (x, y) => at(x, y) === '#';
    const wallAdj = (x, y) => (isW(x, y - 1) ? 1 : 0) + (isW(x + 1, y) ? 1 : 0) + (isW(x, y + 1) ? 1 : 0) + (isW(x - 1, y) ? 1 : 0);

    function view(camX, camY, vw, vh) {
      const hw = vw / 2, hh = vh / 2;
      return {
        x0: Math.max(0, Math.floor((camX - hw) / T) - 1), x1: Math.min(cols - 1, Math.floor((camX + hw) / T) + 1),
        y0: Math.max(0, Math.floor((camY - hh) / T) - 1), y1: Math.min(rows - 1, Math.floor((camY + hh) / T) + 1),
        L: camX - hw, Tp: camY - hh, W: vw, H: vh,
      };
    }

    // Scatters `count` (per 460x340 of view) motes that drift and wrap inside the viewport, but
    // stay anchored to the world, so they don't slide along with the camera.
    function motes(g, v, now, o) {
      const cnt = Math.round(o.count * (v.W * v.H) / (460 * 340));
      const t = now / 1000;
      for (let i = 0; i < cnt; i++) {
        const sz = lerp(o.size[0], o.size[1], hash(i, 3, S));
        const x = v.L + mod(hash(i, 1, S) * v.W + o.vx * t * (0.6 + hash(i, 4, S) * 0.8) - v.L, v.W) + Math.sin(t * 1.3 + i) * o.sway;
        const y = v.Tp + mod(hash(i, 2, S) * v.H + o.vy * t * (0.6 + hash(i, 4, S) * 0.8) - v.Tp, v.H);
        const a = o.alpha * (o.twinkle ? 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + i * 2.3)) : 1);
        if (o.glow) glow(g, x, y, sz * 5, o.rgb, a * 0.55);
        g.fillStyle = `rgba(${o.rgb},${a})`;
        if (o.leaf) {
          g.save();
          g.translate(x, y);
          g.rotate(t * (1 + hash(i, 5, S) * 2) + i);
          g.fillRect(-sz, -sz * 0.45, sz * 2, sz * 0.9);
          g.restore();
        } else {
          g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }
    }

    // ---- small effect particles (feathers, ice shavings) ----------------------------------
    const fx = [];
    function addFx(x, y, vx, vy, life, kind) {
      if (fx.length > 160) fx.shift();
      fx.push({ x, y, vx, vy, life, max: life, rot: Math.random() * TAU, kind });
    }
    function drawFx(g) {
      fx.forEach((p) => {
        const a = Math.max(0, p.life / p.max);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.globalAlpha = a;
        if (p.kind === 'feather') {
          g.fillStyle = '#d8dce2';
          g.fillRect(-3, -0.8, 6, 1.6);
        } else {
          g.fillStyle = '#dff4ff';
          g.fillRect(-1, -1, 2, 2);
        }
        g.restore();
      });
    }

    // =========================================================================================
    // Chapter 1 -- the Facility: flickering floor lights, shelving along the walls
    // =========================================================================================
    const lamps = [];
    const shelves = [];
    if (chapter === 1) {
      const buckets = new Map();
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          if (!isF(x, y) || hash(x, y, S) > 0.05) continue;
          if (!(isF(x - 1, y) && isF(x + 1, y) && isF(x, y - 1) && isF(x, y + 1))) continue;
          const bx = x >> 3, by = y >> 3;
          let ok = true;
          for (let ox = -1; ox <= 1 && ok; ox++) for (let oy = -1; oy <= 1 && ok; oy++) {
            const list = buckets.get((bx + ox) + ',' + (by + oy));
            if (list && list.some((q) => Math.hypot(q.x - x, q.y - y) < 6)) ok = false;
          }
          if (!ok) continue;
          const lamp = {
            x, y, id: lamps.length, ph: hash(x, y, 5), faulty: hash(x, y, 6) < 0.4, cool: hash(x, y, 7) < 0.5,
          };
          lamps.push(lamp);
          const key = bx + ',' + by;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(lamp);
        }
      }
      const used = new Set();
      const sides = [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]];
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          if (!isF(x, y) || used.has(x + ',' + y)) continue;
          for (const [dx, dy, side] of sides) {
            if (!isW(x + dx, y + dy)) continue;
            // along the wall: east for N/S walls, south for E/W walls
            const ax = dy !== 0 ? 1 : 0, ay = dy !== 0 ? 0 : 1;
            const nx = x + ax, ny = y + ay;
            if (!isF(nx, ny) || !isW(nx + dx, ny + dy) || used.has(nx + ',' + ny)) continue;
            if (hash(x, y, S + side) > 0.1) continue;
            used.add(x + ',' + y); used.add(nx + ',' + ny);
            shelves.push({ x, y, side, r: hash(x, y, 40) });
            break;
          }
        }
      }
    }

    function lampLevel(l, now) {
      if (!l.faulty) return 0.9 + 0.1 * Math.sin(now / 700 + l.ph * 6);
      const k = Math.floor(now / 75 + l.ph * 9);
      const r = hash(k, l.id, 99);
      if (r < 0.2) return 0.06 + r * 1.2;
      if (r < 0.3) return 0.5;
      return 1;
    }

    function drawLamp(g, l, now) {
      const f = lampLevel(l, now);
      const cx = l.x * T + T / 2, cy = l.y * T + T / 2;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(cx - 13, cy - 6, 26, 12);
      g.fillStyle = '#161a20';
      g.fillRect(cx - 12, cy - 5, 24, 10);
      const rgb = l.cool ? [190, 232, 255] : [255, 228, 160];
      const k = 0.18 + 0.82 * f;
      g.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
      g.fillRect(cx - 10, cy - 3, 20, 6);
      g.fillStyle = `rgba(255,255,255,${0.55 * f})`;
      g.fillRect(cx - 9, cy - 2, 18, 1.5);
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, cx, cy, 64, l.cool ? '120,190,255' : '255,200,110', 0.3 * f);
      g.restore();
    }

    function drawShelf(g, s) {
      g.save();
      const x = s.x * T, y = s.y * T;
      if (s.side === 0) g.translate(x, y);
      else if (s.side === 1) { g.translate(x + T, y); g.rotate(Math.PI / 2); }
      else if (s.side === 2) { g.translate(x + T * 2, y + T); g.rotate(Math.PI); }
      else { g.translate(x, y + T * 2); g.rotate(-Math.PI / 2); }
      const L = T * 2 - 4, D = 12;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(3, 1, L, D + 2);
      g.fillStyle = '#2b323b';
      g.fillRect(2, 0, L, D);
      g.fillStyle = '#1b2027';
      for (let i = 1; i < 4; i++) g.fillRect(2 + (L / 4) * i - 1, 0, 2, D);
      g.fillStyle = '#4a5560';
      g.fillRect(2, D - 2, L, 2);
      const cols2 = ['#8a6a3a', '#6f7f8a', '#9a4a3a', '#4f7a5a', '#b8a35a', '#5a6aa8'];
      for (let c = 0; c < 4; c++) {
        const r = hash(s.x * 7 + c, s.y, 41);
        if (r < 0.15) continue;
        const bw = 5 + hash(c, s.y, 42) * 6, bh = 4 + hash(s.x, c, 43) * 5;
        const bx = 2 + (L / 4) * c + 2 + hash(s.x, s.y + c, 44) * (L / 4 - bw - 4);
        g.fillStyle = pick(cols2, hash(s.x + c, s.y, 45));
        g.fillRect(bx, 1.5, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(bx, 1.5, bw, 1);
        if (r > 0.7) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(bx + bw / 2 - 0.5, 1.5, 1, bh); }
      }
      g.restore();
    }

    // =========================================================================================
    // Chapter 2 -- the Undercroft: moss
    // =========================================================================================
    function mossAmount(x, y) {
      return vnoise(x * 0.21, y * 0.21, S) * 0.8 + wallAdj(x, y) * 0.14 + (hash(x, y, 9) - 0.5) * 0.2;
    }
    // Moss is just mossy floor tiles: whole tiles in a few greens, nothing growing on the walls.
    const MOSS_TILES = ['#2c4a2a', '#315230', '#365a35', '#2a4527', '#3a5f38'];
    function drawMoss(g, x, y) {
      if (mossAmount(x, y) < 0.63) return;
      g.fillStyle = pick(MOSS_TILES, hash(x, y, 10));
      g.fillRect(x * T, y * T, T, T);
    }

    // =========================================================================================
    // Chapter 3 -- the Frost: slippery ice, snow drifts, hoarfrost
    // =========================================================================================
    const icy = (x, y) => isF(x, y) && vnoise(x * 0.11, y * 0.11, S) > 0.52;
    let iceSprite = null;
    function getIceSprite() {
      if (iceSprite) return iceSprite;
      iceSprite = document.createElement('canvas');
      iceSprite.width = iceSprite.height = 64;
      const c = iceSprite.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(176,228,250,0.42)');
      gr.addColorStop(0.55, 'rgba(176,228,250,0.4)');
      gr.addColorStop(1, 'rgba(176,228,250,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, 64, 64);
      return iceSprite;
    }
    function drawIce(g, x, y, now) {
      if (!icy(x, y)) return;
      g.drawImage(getIceSprite(), x * T - 16, y * T - 16, T + 32, T + 32);
      // sheen streaks
      const r = hash(x, y, 120);
      if (r < 0.55) {
        g.strokeStyle = 'rgba(255,255,255,0.4)';
        g.lineWidth = 1;
        const sx = x * T + 4 + hash(x, y, 121) * 16, sy = y * T + 4 + hash(x, y, 122) * 16;
        g.beginPath();
        g.moveTo(sx, sy + 9); g.lineTo(sx + 9, sy);
        g.moveTo(sx + 5, sy + 12); g.lineTo(sx + 13, sy + 4);
        g.stroke();
      }
      if (r > 0.82) { // hairline crack
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        let cx = x * T + hash(x, y, 123) * T, cy = y * T + hash(x, y, 124) * T;
        g.moveTo(cx, cy);
        for (let i = 0; i < 4; i++) {
          cx += (hash(x, y, 130 + i) - 0.5) * 14; cy += (hash(x, y, 140 + i) - 0.5) * 14;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
      if (hash(x, y, 125) < 0.16) { // glint
        const tw = Math.max(0, Math.sin(now / 420 + hash(x, y, 126) * 40));
        if (tw > 0.4) {
          const gx = x * T + 6 + hash(x, y, 127) * 20, gy = y * T + 6 + hash(x, y, 128) * 20;
          g.fillStyle = `rgba(255,255,255,${tw})`;
          g.fillRect(gx - 3, gy - 0.5, 6, 1);
          g.fillRect(gx - 0.5, gy - 3, 1, 6);
        }
      }
    }
    function drawDrift(g, x, y) {
      if (!wallAdj(x, y) || hash(x, y, 150) > 0.4) return;
      for (let i = 0; i < 4; i++) {
        const t = (i + hash(x, y, 151 + i) * 0.5) / 4;
        const rr = 3 + hash(x, y, 160 + i) * 4;
        const pts = [];
        if (isW(x, y - 1)) pts.push([x * T + t * T, y * T + 3]);
        if (isW(x, y + 1)) pts.push([x * T + t * T, (y + 1) * T - 3]);
        if (isW(x - 1, y)) pts.push([x * T + 3, y * T + t * T]);
        if (isW(x + 1, y)) pts.push([(x + 1) * T - 3, y * T + t * T]);
        pts.forEach(([px, py]) => {
          disc(g, px + 1, py + 1.5, rr, 'rgba(120,150,180,0.35)');
          disc(g, px, py, rr, 'rgba(238,246,255,0.82)');
        });
      }
    }

    // Slippery ice: momentum with very little traction on ice, normal traction off it.
    function iceStep(p, ix, iy, dt, move, speed) {
      if (chapter !== 3) return false;
      if (p.caught) { p._ivx = p._ivy = 0; return false; }
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
      const on = icy(tx, ty);
      const len = Math.hypot(ix, iy);
      const tvx = len ? (ix / len) * speed : 0, tvy = len ? (iy / len) * speed : 0;
      let vx = p._ivx || 0, vy = p._ivy || 0;
      if (!on && Math.hypot(vx - tvx, vy - tvy) < 6) { p._ivx = tvx; p._ivy = tvy; return false; } // plain floor: the game's own movement
      const k = 1 - Math.exp(-dt * (on ? (len ? 2.8 : 1.1) : 30));
      vx += (tvx - vx) * k;
      vy += (tvy - vy) * k;
      if (len) p.facing = { x: ix / len, y: iy / len };
      p.isMoving = len > 0;
      const bx = p.x, by = p.y;
      move(p, vx * dt, vy * dt);
      if (Math.abs(p.x - bx) < Math.abs(vx * dt) * 0.4) vx *= 0.25; // slid into a wall
      if (Math.abs(p.y - by) < Math.abs(vy * dt) * 0.4) vy *= 0.25;
      p._ivx = vx; p._ivy = vy;
      if (on && Math.hypot(vx, vy) > 60 && Math.random() < dt * 14) {
        addFx(p.x, p.y + 6, (Math.random() - 0.5) * 30 - vx * 0.15, (Math.random() - 0.5) * 30 - vy * 0.15, 0.45, 'ice');
      }
      return true;
    }

    // =========================================================================================
    // Chapter 4 -- the Flood: rough rocks, puddles, mist
    // =========================================================================================
    const rockAt = (x, y) => isF(x, y) && hash(x, y, S + 200) < 0.1;
    function drawRock(g, cx, cy, r, seed) {
      const nv = 8 + Math.floor(hash(seed, 1, 2) * 3);
      const pts = [];
      for (let i = 0; i < nv; i++) {
        const a = (i / nv) * TAU + (hash(seed, i, 3) - 0.5) * 0.5;
        const rr = r * (0.68 + hash(seed, i, 4) * 0.5);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86, a]);
      }
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px + 2.5, py + 3) : g.moveTo(px + 2.5, py + 3)));
      g.fill();
      for (let i = 0; i < nv; i++) {
        const a = pts[i], b = pts[(i + 1) % nv];
        const mid = (a[2] + b[2]) / 2 + (i === nv - 1 ? Math.PI : 0);
        const lit = -(Math.cos(mid) + Math.sin(mid)) * 0.7071; // light from the top-left
        const v = 82 + lit * 34 + hash(seed, i, 5) * 10;
        g.fillStyle = `rgb(${Math.round(v)},${Math.round(v + 4)},${Math.round(v + 2)})`;
        g.beginPath();
        g.moveTo(cx - 1, cy - 1.5);
        g.lineTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(20,26,28,0.7)';
      g.lineWidth = 0.8;
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.closePath();
      g.stroke();
      g.strokeStyle = 'rgba(210,235,240,0.45)'; // wet shine on the upper-left edge
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(pts[nv - 1][0], pts[nv - 1][1]);
      g.lineTo(pts[0][0], pts[0][1]);
      g.lineTo(pts[1][0], pts[1][1]);
      g.stroke();
    }
    function drawRocks(g, x, y) {
      if (!rockAt(x, y)) return;
      const cnt = 1 + Math.floor(hash(x, y, 210) * 3);
      for (let i = 0; i < cnt; i++) {
        const cx = x * T + 6 + hash(x, y, 220 + i) * (T - 12), cy = y * T + 6 + hash(x, y, 230 + i) * (T - 12);
        drawRock(g, cx, cy, 5 + hash(x, y, 240 + i) * 6, x * 131 + y * 17 + i);
      }
    }
    const puddleAt = (x, y) => isF(x, y) && vnoise(x * 0.17 + 40, y * 0.17, S) > 0.66;
    let puddleSprite = null;
    function getPuddleSprite() {
      if (puddleSprite) return puddleSprite;
      puddleSprite = document.createElement('canvas');
      puddleSprite.width = puddleSprite.height = 64;
      const c = puddleSprite.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(18,44,58,0.62)');
      gr.addColorStop(0.6, 'rgba(24,56,72,0.55)');
      gr.addColorStop(1, 'rgba(24,56,72,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, 64, 64);
      return puddleSprite;
    }
    function drawPuddle(g, x, y, now) {
      if (!puddleAt(x, y)) return;
      g.drawImage(getPuddleSprite(), x * T - 10, y * T - 10, T + 20, T + 20);
      g.fillStyle = 'rgba(180,220,235,0.12)';
      g.fillRect(x * T + 6, y * T + 9, 14, 1.5);
      if (hash(x, y, 250) < 0.18) {
        const ph = ((now / 2400) + hash(x, y, 251)) % 1;
        g.strokeStyle = `rgba(190,230,245,${0.5 * (1 - ph)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(x * T + 8 + hash(x, y, 252) * 16, y * T + 8 + hash(x, y, 253) * 16, 2 + ph * 11, 1 + ph * 5, 0, 0, TAU);
        g.stroke();
      }
    }

    // =========================================================================================
    // Chapter 5 -- the Overgrowth: glowing mushrooms, streams with plank bridges
    // =========================================================================================
    const shrooms = [];
    const bridges = [];
    const SHROOM_COL = [['95,240,208', '#5ff0d0'], ['190,130,255', '#be82ff'], ['255,176,90', '#ffb05a'], ['140,255,150', '#8cff96']];
    if (chapter === 5) {
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          if (!isF(x, y)) continue;
          const wa = wallAdj(x, y);
          if (hash(x, y, S + 300) > 0.022 + wa * 0.016) continue;
          const [rgb, hex] = pick(SHROOM_COL, hash(x, y, 301));
          const caps = [];
          const c = 2 + Math.floor(hash(x, y, 302) * 3);
          for (let i = 0; i < c; i++) {
            caps.push({
              dx: (hash(x, y, 310 + i) - 0.5) * 20, dy: (hash(x, y, 320 + i) - 0.5) * 14,
              r: 4.5 + hash(x, y, 330 + i) * 4.5, h: 6 + hash(x, y, 340 + i) * 7,
            });
          }
          shrooms.push({ cx: x * T + T / 2, cy: y * T + T / 2, rgb, hex, caps, ph: hash(x, y, 303) * 6 });
        }
      }
      // Streams: a 2-wide, 5-long shallow channel with a 4-tile plank bridge across its middle.
      const CW = 14, CH = 12;
      for (let cy = 0; cy < Math.floor(rows / CH); cy++) {
        for (let cx = 0; cx < Math.floor(cols / CW); cx++) {
          if (hash(cx, cy, S + 400) > 0.7) continue;
          for (let attempt = 0; attempt < 14; attempt++) {
            const vert = hash(cx, cy, 401 + attempt) < 0.5;
            const w = vert ? 4 : 5, h = vert ? 5 : 4;
            const bx = cx * CW + 1 + Math.floor(hash(cx, cy, 410 + attempt) * (CW - w - 1));
            const by = cy * CH + 1 + Math.floor(hash(cx, cy, 420 + attempt) * (CH - h - 1));
            let clear = true;
            for (let yy = by; yy < by + h && clear; yy++) for (let xx = bx; xx < bx + w && clear; xx++) if (!isF(xx, yy)) clear = false;
            if (!clear) continue;
            bridges.push({ x: bx, y: by, w, h, vert });
            break;
          }
        }
      }
    }
    function drawShroom(g, s, now) {
      const pulse = 0.75 + 0.25 * Math.sin(now / 900 + s.ph);
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, s.cx, s.cy - 3, 40, s.rgb, 0.3 * pulse);
      g.restore();
      s.caps.slice().sort((a, b) => a.dy - b.dy).forEach((c) => {
        const x = s.cx + c.dx * 1.2, y = s.cy + c.dy * 1.2;
        disc(g, x + 1.5, y + 1.5, c.r * 0.9, 'rgba(0,0,0,0.3)');
        g.fillStyle = '#d9d2b8';
        g.fillRect(x - 1.6, y - c.h, 3.2, c.h);
        g.fillStyle = s.hex;
        g.globalAlpha = 0.65 + 0.35 * pulse;
        g.beginPath();
        g.ellipse(x, y - c.h, c.r, c.r * 0.7, 0, Math.PI, TAU);
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(x - c.r * 0.35, y - c.h - c.r * 0.45, 1.6, 1.2);
        g.fillRect(x + c.r * 0.2, y - c.h - c.r * 0.3, 1.2, 1.2);
      });
    }
    function drawBridge(g, b, now) {
      const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
      // the stream: 2 tiles wide through the middle of the clear area
      let sx, sy, sw, sh;
      if (b.vert) { sx = x + T; sy = y; sw = T * 2; sh = h; } else { sx = x; sy = y + T; sw = w; sh = T * 2; }
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.roundRect(sx - 4, sy - 2, sw + 8, sh + 6, 14); g.fill();
      g.fillStyle = '#3a4a2c'; // mossy bank
      g.beginPath(); g.roundRect(sx - 3, sy - 3, sw + 6, sh + 6, 14); g.fill();
      g.fillStyle = '#17353a';
      g.beginPath(); g.roundRect(sx + 2, sy + 2, sw - 4, sh - 4, 12); g.fill();
      g.fillStyle = 'rgba(70,150,150,0.35)';
      g.beginPath(); g.roundRect(sx + 6, sy + 6, sw - 12, sh - 12, 10); g.fill();
      g.strokeStyle = 'rgba(190,240,235,0.35)';
      g.lineWidth = 1;
      const flow = (now / 40) % 28;
      g.save();
      g.beginPath(); g.roundRect(sx + 2, sy + 2, sw - 4, sh - 4, 12); g.clip();
      for (let i = 0; i < 9; i++) {
        const o = (i * 28 + flow) % (b.vert ? sh : sw);
        const lane = 10 + hash(b.x, b.y, 430 + i) * ((b.vert ? sw : sh) - 20);
        g.beginPath();
        if (b.vert) { g.moveTo(sx + lane, sy + o); g.lineTo(sx + lane + 2, sy + o + 10); } else { g.moveTo(sx + o, sy + lane); g.lineTo(sx + o + 10, sy + lane + 2); }
        g.stroke();
      }
      g.restore();
      // the bridge, spanning the whole 4-tile width/height
      const bw = b.vert ? w : T * 1.1, bh = b.vert ? T * 1.1 : h;
      const bxx = b.vert ? x : x + (w - bw) / 2, byy = b.vert ? y + (h - bh) / 2 : y;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(bxx + 2, byy + 3, bw, bh);
      const planks = Math.floor((b.vert ? bw : bh) / 8);
      for (let i = 0; i < planks; i++) {
        const v = 100 + hash(b.x * 9 + i, b.y, 440) * 40;
        g.fillStyle = `rgb(${Math.round(v)},${Math.round(v * 0.7)},${Math.round(v * 0.42)})`;
        if (b.vert) g.fillRect(bxx + i * 8 + 0.5, byy, 7, bh); else g.fillRect(bxx, byy + i * 8 + 0.5, bw, 7);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        if (b.vert) g.fillRect(bxx + i * 8 + 7.5, byy, 1, bh); else g.fillRect(bxx, byy + i * 8 + 7.5, bw, 1);
      }
      // rope rails with posts
      g.strokeStyle = '#cdbd8a';
      g.lineWidth = 1.5;
      g.beginPath();
      if (b.vert) { g.moveTo(bxx, byy + 1); g.lineTo(bxx + bw, byy + 1); g.moveTo(bxx, byy + bh - 1); g.lineTo(bxx + bw, byy + bh - 1); } else { g.moveTo(bxx + 1, byy); g.lineTo(bxx + 1, byy + bh); g.moveTo(bxx + bw - 1, byy); g.lineTo(bxx + bw - 1, byy + bh); }
      g.stroke();
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const p1 = b.vert ? [bxx + t * bw, byy + 1] : [bxx + 1, byy + t * bh];
        const p2 = b.vert ? [bxx + t * bw, byy + bh - 1] : [bxx + bw - 1, byy + t * bh];
        [p1, p2].forEach((p) => { disc(g, p[0], p[1], 2.6, '#4a3320'); disc(g, p[0] - 0.5, p[1] - 0.5, 1.2, '#7a5a38'); });
      }
    }

    // =========================================================================================
    // Chapter 6 -- the Rooftops: gravel, puddles, and pigeons that scatter
    // =========================================================================================
    const birds = [];
    if (chapter === 6) {
      const buckets = new Map();
      for (let y = 2; y < rows - 2; y++) {
        for (let x = 2; x < cols - 2; x++) {
          if (!isF(x, y) || hash(x, y, S + 500) > 0.012) continue;
          if (!(isF(x - 1, y) && isF(x + 1, y) && isF(x, y - 1) && isF(x, y + 1))) continue;
          const key = (x >> 3) + ',' + (y >> 3);
          if (buckets.has(key)) continue;
          buckets.set(key, true);
          const nb = 2 + Math.floor(hash(x, y, 501) * 3);
          const flock = [];
          for (let i = 0; i < nb; i++) {
            const bd = {
              hx: x * T + T / 2 + (hash(x, y, 510 + i) - 0.5) * 34, hy: y * T + T / 2 + (hash(x, y, 520 + i) - 0.5) * 30,
              state: 'perch', x: 0, y: 0, z: 0, vx: 0, vy: 0, t: 0, away: 0, delay: 0,
              ph: hash(x, y, 530 + i) * 20, face: hash(x, y, 540 + i) < 0.5 ? -1 : 1,
              shade: pick(['#8b919b', '#a9aeb7', '#6d737c', '#c9cdd3'], hash(x, y, 550 + i)), flock,
            };
            bd.x = bd.hx; bd.y = bd.hy;
            flock.push(bd);
            birds.push(bd);
          }
        }
      }
    }
    function scare(b, px, py) {
      const dx = b.x - px, dy = b.y - py;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 120 + Math.random() * 70;
      b.state = 'fly';
      b.t = 0;
      b.vx = (dx / d) * sp + (Math.random() - 0.5) * 40;
      b.vy = (dy / d) * sp * 0.6 - 25;
      b.face = b.vx < 0 ? -1 : 1;
      for (let i = 0; i < 3; i++) addFx(b.x, b.y, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40 - 15, 0.9, 'feather');
    }
    function updateBirds(dt, players) {
      birds.forEach((b) => {
        let nearest = Infinity, np = null;
        for (const p of players) {
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          if (d < nearest) { nearest = d; np = p; }
        }
        if (b.state === 'perch') {
          if (np && nearest < 105) {
            scare(b, np.x, np.y);
            // the rest of the flock goes up a beat later
            b.flock.forEach((o) => { if (o !== b && o.state === 'perch') { o.state = 'wait'; o.delay = 0.04 + Math.random() * 0.22; o.away = [np.x, np.y]; } });
          }
        } else if (b.state === 'wait') {
          b.delay -= dt;
          if (b.delay <= 0) scare(b, b.away[0], b.away[1]);
        } else if (b.state === 'fly') {
          b.t += dt;
          b.x += b.vx * dt; b.y += b.vy * dt;
          b.z = Math.min(70, b.z + (30 + b.t * 55) * dt);
          if (b.t > 3.6) { b.state = 'gone'; b.t = 0; }
        } else if (b.state === 'gone') {
          b.t += dt;
          if (b.t > 8 && (!np || nearest > 520)) { b.state = 'perch'; b.x = b.hx; b.y = b.hy; b.z = 0; }
        }
      });
    }
    function drawBird(g, b, now) {
      const f = b.face;
      if (b.state === 'fly') {
        const flap = Math.sin(now / 38 + b.ph);
        const sc = 1.3 + b.z / 140;
        g.fillStyle = `rgba(0,0,0,${0.3 * (1 - b.z / 100)})`; // shadow stays on the roof, swings away
        g.beginPath(); g.ellipse(b.x - b.vx * 0.12 + b.z * 0.2, b.y - b.vy * 0.1 + b.z * 0.4, 5 * sc, 2.5 * sc, 0, 0, TAU); g.fill();
        g.save();
        g.translate(b.x, b.y - b.z);
        g.scale(sc * f, sc);
        g.globalAlpha = Math.max(0, 1 - Math.max(0, b.t - 2.8) / 0.8);
        g.fillStyle = b.shade;
        g.beginPath(); g.ellipse(0, 0, 5.5, 3, 0, 0, TAU); g.fill();
        g.fillStyle = '#2b2f36';
        g.beginPath(); g.arc(6, -0.5, 2, 0, TAU); g.fill();
        g.fillStyle = '#e0a040'; g.fillRect(7.5, -0.8, 2, 1.2);
        g.fillStyle = b.shade;
        g.beginPath(); g.moveTo(-5, -1); g.lineTo(-10, 0); g.lineTo(-5, 1.5); g.fill();
        // wings, flapping up and down past the body
        g.fillStyle = 'rgba(70,76,86,0.9)';
        g.beginPath(); g.ellipse(-1, -3.5 * flap - (flap > 0 ? 1 : 0), 6.5, 3 * Math.abs(flap) + 1, -0.3, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(-1, 3.5 * flap + (flap > 0 ? 1 : 0), 6.5, 3 * Math.abs(flap) + 1, 0.3, 0, TAU); g.fill();
        g.restore();
      } else if (b.state === 'perch' || b.state === 'wait') {
        const peck = Math.max(0, Math.sin(now / 600 + b.ph * 3)) > 0.93 ? 1.6 : 0;
        g.save();
        g.translate(b.x, b.y);
        g.scale(f * 1.3, 1.3);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath(); g.ellipse(0.8, 1.5, 5, 2.6, 0, 0, TAU); g.fill();
        g.fillStyle = b.shade;
        g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(70,76,86,0.8)';
        g.beginPath(); g.ellipse(-0.8, 0, 3.6, 2, 0, 0, TAU); g.fill();
        g.fillStyle = b.shade;
        g.beginPath(); g.moveTo(-4.5, -1); g.lineTo(-8, 0.4); g.lineTo(-4.5, 1.5); g.fill();
        g.fillStyle = '#2b2f36';
        g.beginPath(); g.arc(4.6 + peck * 0.6, -0.4 + peck * 0.5, 1.9, 0, TAU); g.fill();
        g.fillStyle = '#e0a040'; g.fillRect(6.2 + peck * 0.6, -0.8 + peck * 0.5, 1.8, 1.1);
        g.restore();
      }
    }
    const grit = (x, y) => hash(x, y, S + 600);
    function drawRoof(g, x, y) {
      const r = grit(x, y);
      if (r < 0.34) { // gravel specks
        for (let i = 0; i < 5; i++) {
          g.fillStyle = hash(x, y, 610 + i) < 0.5 ? 'rgba(20,20,26,0.5)' : 'rgba(170,175,185,0.35)';
          g.fillRect(x * T + hash(x, y, 620 + i) * (T - 2), y * T + hash(x, y, 630 + i) * (T - 2), 1.6, 1.6);
        }
      }
      if (vnoise(x * 0.14 + 20, y * 0.14, S) > 0.67 && isF(x, y)) { // tar-dark rain puddle with sky in it
        g.fillStyle = 'rgba(30,38,52,0.55)';
        g.beginPath(); g.ellipse(x * T + T / 2, y * T + T / 2, 15, 12, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(140,165,200,0.2)';
        g.beginPath(); g.ellipse(x * T + T / 2 - 2, y * T + T / 2 - 2, 9, 5, -0.3, 0, TAU); g.fill();
      }
    }

    // =========================================================================================
    // the hooks the game files call
    // =========================================================================================
    const AMBIENT = {
      1: { count: 18, size: [1, 2], vx: 6, vy: -3, sway: 3, alpha: 0.22, rgb: '210,220,230' },
      2: { count: 22, size: [1, 2.2], vx: 2, vy: -9, sway: 4, alpha: 0.55, rgb: '150,220,120', twinkle: true },
      3: { count: 55, size: [1.2, 2.6], vx: -14, vy: 36, sway: 7, alpha: 0.85, rgb: '240,248,255' },
      4: { count: 14, size: [2, 4], vx: 4, vy: 5, sway: 9, alpha: 0.1, rgb: '200,225,235' },
      5: { count: 22, size: [1.4, 2.4], vx: 3, vy: -5, sway: 10, alpha: 0.8, rgb: '210,255,120', twinkle: true, glow: true },
      6: { count: 16, size: [1.5, 3], vx: 90, vy: 22, sway: 2, alpha: 0.6, rgb: '120,110,90', leaf: true },
    }[chapter];

    return {
      floor(g, camX, camY, vw, vh, now) {
        const v = view(camX, camY, vw, vh);
        if (chapter === 5) bridges.forEach((b) => { if (b.x * T < v.L + vw && (b.x + b.w) * T > v.L && b.y * T < v.Tp + vh && (b.y + b.h) * T > v.Tp) drawBridge(g, b, now); });
        for (let y = v.y0; y <= v.y1; y++) {
          for (let x = v.x0; x <= v.x1; x++) {
            if (!isF(x, y)) continue;
            if (chapter === 2) drawMoss(g, x, y);
            else if (chapter === 3) { drawIce(g, x, y, now); drawDrift(g, x, y); }
            else if (chapter === 4) { drawPuddle(g, x, y, now); drawRocks(g, x, y); }
            else if (chapter === 6) drawRoof(g, x, y);
          }
        }
        if (chapter === 1) {
          lamps.forEach((l) => { if (l.x >= v.x0 - 2 && l.x <= v.x1 + 2 && l.y >= v.y0 - 2 && l.y <= v.y1 + 2) drawLamp(g, l, now); });
          shelves.forEach((s) => { if (s.x >= v.x0 - 2 && s.x <= v.x1 + 2 && s.y >= v.y0 - 2 && s.y <= v.y1 + 2) drawShelf(g, s); });
        } else if (chapter === 5) {
          shrooms.forEach((s) => { if (s.cx > v.L - 30 && s.cx < v.L + vw + 30 && s.cy > v.Tp - 30 && s.cy < v.Tp + vh + 30) drawShroom(g, s, now); });
        } else if (chapter === 6) {
          birds.forEach((b) => { if (b.state !== 'fly' && b.x > v.L - 20 && b.x < v.L + vw + 20 && b.y > v.Tp - 20 && b.y < v.Tp + vh + 20) drawBird(g, b, now); });
        }
      },
      above(g, camX, camY, vw, vh, now) {
        const v = view(camX, camY, vw, vh);
        if (chapter === 6) birds.forEach((b) => { if (b.state === 'fly' && b.x > v.L - 60 && b.x < v.L + vw + 60 && b.y - b.z > v.Tp - 60 && b.y < v.Tp + vh + 60) drawBird(g, b, now); });
        drawFx(g);
        g.save();
        if (AMBIENT.glow) g.globalCompositeOperation = 'lighter';
        motes(g, v, now, AMBIENT);
        g.restore();
        if (chapter === 4) { // drifting mist banks
          const t = now / 1000;
          for (let i = 0; i < 6; i++) {
            const mx = v.L + mod(hash(i, 1, S) * vw + 9 * t - v.L, vw), my = v.Tp + hash(i, 2, S) * vh + Math.sin(t * 0.3 + i) * 10;
            glow(g, mx, my, 70 + hash(i, 3, S) * 40, '200,225,235', 0.07);
          }
        }
      },
      lights(maskCtx, camX, camY, vw, vh, now, punch) {
        const v = view(camX, camY, vw, vh);
        const sx = (wx) => wx - camX + vw / 2, sy = (wy) => wy - camY + vh / 2;
        if (chapter === 1) {
          lamps.forEach((l) => {
            if (l.x < v.x0 - 6 || l.x > v.x1 + 6 || l.y < v.y0 - 6 || l.y > v.y1 + 6) return;
            const f = lampLevel(l, now);
            punch(maskCtx, sx(l.x * T + T / 2), sy(l.y * T + T / 2), 90 + 110 * f, 0.92 * f);
          });
        } else if (chapter === 5) {
          shrooms.forEach((s) => {
            if (s.cx < v.L - 80 || s.cx > v.L + vw + 80 || s.cy < v.Tp - 80 || s.cy > v.Tp + vh + 80) return;
            punch(maskCtx, sx(s.cx), sy(s.cy), 52 + 8 * Math.sin(now / 900 + s.ph), 0.5);
          });
        }
      },
      update(dt, players) {
        for (let i = fx.length - 1; i >= 0; i--) {
          const p = fx[i];
          p.life -= dt;
          if (p.life <= 0) { fx.splice(i, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.97; p.vy *= 0.97;
          p.rot += dt * 5;
        }
        if (chapter === 6) updateBirds(dt, players);
      },
      ice: iceStep,
      debug: { lamps, shelves, shrooms, bridges, birds },
    };
  }

  window.LevelDetails = { make };
})();
