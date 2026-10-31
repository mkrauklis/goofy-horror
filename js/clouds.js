// The Clouds (the second half of the Sourcerer's "dream"): after the mushroom screams, you come to in a
// bright maze of cloud-walls high above everything. A creature that looks like what the old texts actually
// describe -- wheels within wheels, rimmed with eyes, under three pairs of wings -- patrols it. Five torn
// pieces of a book are scattered through the dead ends; bring them all home and the gate at the far end opens.
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud-buttons');
  const soundHintEl = document.getElementById('sound-hint');
  const Eyes = window.RealEyes;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 118;
  const T = 56;                                      // tile size: a corridor is one tile wide
  const GW = 27, GH = 17;                            // tiles; cells sit on odd coordinates
  const PIECES = 5;
  const ANGEL_GRACE_MS = 7000;
  const CATCH_DIST = 30;
  const FADE_IN_MS = 2200, CAUGHT_MS = 1500, WHITE_MS = 2600, END_MS = 1500;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(x, y, k) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  let seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  function rnd() {                                   // mulberry32
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- the maze ----------
  const grid = new Uint8Array(GW * GH).fill(1);       // 1 = cloud wall, 0 = open
  const idx = (x, y) => y * GW + x;
  (function carve() {
    const stack = [[1, 1]];
    grid[idx(1, 1)] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        return nx > 0 && ny > 0 && nx < GW - 1 && ny < GH - 1 && grid[idx(nx, ny)] === 1;
      });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[Math.floor(rnd() * opts.length)];
      grid[idx(cx + dx / 2, cy + dy / 2)] = 0;
      grid[idx(cx + dx, cy + dy)] = 0;
      stack.push([cx + dx, cy + dy]);
    }
    // knock a few walls through so it isn't one single winding path (and nothing can be trapped in a dead end)
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 1; x < GW - 1; x++) {
        if (grid[idx(x, y)] !== 1 || ((x & 1) === (y & 1))) continue;
        const a = (x & 1) ? grid[idx(x, y - 1)] === 0 && grid[idx(x, y + 1)] === 0 : grid[idx(x - 1, y)] === 0 && grid[idx(x + 1, y)] === 0;
        if (a && rnd() < 0.13) grid[idx(x, y)] = 0;
      }
    }
  })();
  const START = { tx: 1, ty: 1 };
  const EXIT = { tx: GW - 2, ty: GH - 2 };
  const gate = { tx: GW - 2, ty: GH - 1, open: 0, opening: false };   // open: 0..1

  function neighbours(tx, ty) {
    const out = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = tx + dx, ny = ty + dy;
      if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && grid[idx(nx, ny)] === 0) out.push([nx, ny]);
    });
    return out;
  }
  function field(tx, ty) {                             // BFS steps from a tile to every open tile
    const f = new Int16Array(GW * GH).fill(-1);
    const q = [[tx, ty]]; f[idx(tx, ty)] = 0;
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      neighbours(x, y).forEach(([nx, ny]) => { if (f[idx(nx, ny)] < 0) { f[idx(nx, ny)] = f[idx(x, y)] + 1; q.push([nx, ny]); } });
    }
    return f;
  }

  // the five pieces: dead ends, as far from the start and from each other as the maze allows
  const pieces = [];
  (function place() {
    const ends = [];
    for (let y = 1; y < GH; y += 2) for (let x = 1; x < GW; x += 2) {
      if (neighbours(x, y).length === 1 && Math.hypot(x - START.tx, y - START.ty) > 5 && Math.hypot(x - EXIT.tx, y - EXIT.ty) > 2) ends.push([x, y]);
    }
    for (let y = 1; y < GH; y += 2) for (let x = 1; x < GW; x += 2) {   // not enough dead ends: any cell will do
      if (ends.length >= 30) break;
      if (Math.hypot(x - START.tx, y - START.ty) > 6 && !ends.some((e) => e[0] === x && e[1] === y)) ends.push([x, y]);
    }
    const chosen = [];
    while (chosen.length < PIECES && ends.length) {
      let best = 0, bd = -1;
      ends.forEach((e, i) => {
        let d = Math.hypot(e[0] - START.tx, e[1] - START.ty);
        chosen.forEach((c) => { d = Math.min(d, Math.hypot(e[0] - c[0], e[1] - c[1])); });
        d += rnd() * 1.5;
        if (d > bd) { bd = d; best = i; }
      });
      chosen.push(ends.splice(best, 1)[0]);
    }
    chosen.forEach(([x, y], i) => pieces.push({ x: (x + 0.5) * T, y: (y + 0.5) * T, got: false, ph: i * 1.3, n: i }));
  })();

  function solidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) return true;
    if (tx === gate.tx && ty === gate.ty) return gate.open < 1;
    return grid[idx(tx, ty)] === 1;
  }
  function hits(x, y, r) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!solidTile(tx, ty)) continue;
      const cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
    return false;
  }

  // ---------- the pre-painted world: sky-white marble paths between cloud walls ----------
  const world = document.createElement('canvas');
  world.width = GW * T; world.height = GH * T;
  (function paint() {
    const g = world.getContext('2d');
    for (let ty = 0; ty < GH; ty++) for (let tx = 0; tx < GW; tx++) {
      if (grid[idx(tx, ty)] === 0) {
        g.fillStyle = (tx + ty) & 1 ? '#f8eecf' : '#efe2b8';
        g.fillRect(tx * T, ty * T, T, T);
        g.strokeStyle = 'rgba(190,160,90,0.25)'; g.lineWidth = 1; g.strokeRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(tx * T + 4, ty * T + 4, T - 8, 3);
      }
    }
    for (let ty = 0; ty < GH; ty++) for (let tx = 0; tx < GW; tx++) {
      if (grid[idx(tx, ty)] !== 1) continue;
      const cx = tx * T + T / 2, cy = ty * T + T / 2;
      g.fillStyle = '#b9c9e6';                                                  // the shaded underside
      g.beginPath(); g.arc(cx - 2, cy + 6, T * 0.5, 0, 6.283); g.arc(cx + 8, cy + 8, T * 0.42, 0, 6.283); g.fill();
      for (let k = 0; k < 5; k++) {
        const ox = (hash(tx, ty, k) - 0.5) * T * 0.34, oy = (hash(tx, ty, k + 9) - 0.5) * T * 0.34, r = T * (0.3 + hash(tx, ty, k + 3) * 0.12);
        const gr = g.createRadialGradient(cx + ox - r * 0.3, cy + oy - r * 0.4, 2, cx + ox, cy + oy, r);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#eef3fc'); gr.addColorStop(1, '#cfdbf0');
        g.fillStyle = gr; g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, 6.283); g.fill();
      }
    }
  })();

  // ---------- state ----------
  const keys = {};
  const TRACKED = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const homeXY = (i) => ({ x: (START.tx + 0.5) * T + (PLAYER_MODE === 2 ? (i ? 12 : -12) : 0), y: (START.ty + 0.5) * T });
  const players = (PLAYER_MODE === 1 ? [['#ff8a3d']] : [['#ff8a3d'], ['#3ddc84']]).map(([color], i) => ({
    ...homeXY(i), color, facing: { x: 0, y: 1 }, walkPhase: 0, flash: 0,
  }));
  const angel = { x: (13 + 0.5) * T, y: (9 + 0.5) * T, tx: 13, ty: 9, next: null, gaze: { gx: 0, gy: 0 }, fields: [], fieldAt: -1e9 };
  let gotCount = 0;
  let phase = 'play';                 // 'play' | 'caught' | 'white' | 'end'
  let phaseAt = 0, startAt = 0;
  let caught = null, leaving = false;
  let toast = '', toastAt = -1e9;
  let whiteFlash = 0;

  // ---------- sound ----------
  let ac = null, master = null, dissGain = null, noiseBuf = null;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    // a choir-ish pad: a bare open chord, drifting very slightly out of tune with itself
    const pad = ac.createGain(); pad.gain.value = 0.045;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    pad.connect(lp); lp.connect(master);
    [220, 329.6, 440, 554.4, 659.3].forEach((f, i) => {
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = i % 2 ? 'sine' : 'triangle'; o.frequency.value = f;
      lfo.frequency.value = 0.15 + i * 0.07; lg.gain.value = 1.8 + i;
      lfo.connect(lg); lg.connect(o.detune); o.connect(pad); o.start(); lfo.start();
    });
    // the creature's own note: a tritone against the pad that swells as it gets near
    dissGain = ac.createGain(); dissGain.gain.value = 0;
    const d1 = ac.createOscillator(), d2 = ac.createOscillator();
    d1.type = 'sawtooth'; d1.frequency.value = 311.1; d2.type = 'sawtooth'; d2.frequency.value = 313.4;
    const dl = ac.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 900;
    d1.connect(dl); d2.connect(dl); dl.connect(dissGain); dissGain.connect(master); d1.start(); d2.start();
    const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function chime(freq, delay, vol, dur) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    [1, 2.01, 3.02].forEach((m, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.2) / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 1.6));
      o.connect(g); g.connect(master); o.start(t); o.stop(t + (dur || 1.6) + 0.05);
    });
  }
  function shriek() {
    if (!ac) return;
    const t0 = ac.currentTime, dur = 1.3;
    const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) c[i] = Math.tanh(((i / 512) - 1) * 8);
    const ws = ac.createWaveShaper(); ws.curve = c;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.7, t0 + 0.03); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    ws.connect(out); out.connect(master);
    [880, 1318, 1760].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.8, t0); o.frequency.exponentialRampToValueAtTime(f * 1.6, t0 + 0.25); o.frequency.linearRampToValueAtTime(f * 1.3, t0 + dur);
      o.connect(ws); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (soundHintEl) soundHintEl.textContent = '';
    if (TRACKED.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (TRACKED.has(e.key)) { keys[e.key] = false; e.preventDefault(); } });

  // ---------- the creature ----------
  const gi = (gaze) => gaze;
  function eyeAt(g, v, x, y, w, gaze, now, ph) {
    const blink = Math.sin(now * 0.0013 + ph * 6.3) > 0.985 ? 0.15 : 1;
    g.drawImage(Eyes.sprite(v % Eyes.COUNT, gaze.gx, gaze.gy), x - w / 2, y - w * 0.31 * blink, w, w * 0.62 * blink);
  }
  // Wheels within wheels, full of eyes, under three pairs of wings; a blazing core with one great eye.
  function drawAngel(g, now, s, gaze) {
    g.save(); g.scale(s, s);
    const gl = g.createRadialGradient(0, 0, 10, 0, 0, 240);
    gl.addColorStop(0, 'rgba(255,250,210,0.95)'); gl.addColorStop(0.3, 'rgba(255,226,140,0.45)'); gl.addColorStop(1, 'rgba(255,226,140,0)');
    g.fillStyle = gl; g.fillRect(-240, -240, 480, 480);

    // wings: three pairs, each a fan of long feathers with eyes set along it
    const pairs = [{ ang: -1.2, len: 215, w: 30 }, { ang: -0.3, len: 245, w: 34 }, { ang: 0.75, len: 200, w: 30 }];
    pairs.forEach((p, wi) => {
      [-1, 1].forEach((dir) => {
        const base = p.ang + Math.sin(now * 0.0016 + wi * 1.1) * 0.13;
        g.save(); g.scale(dir, 1);
        for (let k = 0; k < 11; k++) {
          const a = base + (k - 5) * 0.085, l = p.len * (0.62 + 0.38 * Math.sin((k / 10) * 3.1416 * 0.9 + 0.2));
          g.save(); g.rotate(a);
          const fg = g.createLinearGradient(0, 0, l, 0);
          fg.addColorStop(0, '#fffdf2'); fg.addColorStop(0.7, '#f3ead0'); fg.addColorStop(1, '#d8c690');
          g.fillStyle = fg; g.strokeStyle = 'rgba(190,150,60,0.8)'; g.lineWidth = 1.2;
          g.beginPath(); g.ellipse(l / 2 + 14, 0, l / 2, p.w * 0.3, 0, 0, 6.283); g.fill(); g.stroke();
          g.restore();
        }
        g.restore();
        for (let e = 0; e < 4; e++) {
          const d = p.len * (0.28 + e * 0.2), ex = Math.cos(base) * d * dir, ey = Math.sin(base) * d;
          eyeAt(g, wi * 7 + e * 3 + (dir > 0 ? 1 : 0), ex, ey, 40 - e * 4, gaze, now, wi * 5 + e + dir);
        }
      });
    });

    // the wheels: rings of gold turning against each other, an eye at every spoke
    const wheels = [
      { R: 128, n: 30, rot: now * 0.00022, sx: 1, sy: 0.34, ew: 38 },
      { R: 128, n: 30, rot: -now * 0.00027, sx: 0.34, sy: 1, ew: 38 },
      { R: 86, n: 20, rot: -now * 0.0004, sx: 1, sy: 1, ew: 36 },
      { R: 54, n: 12, rot: now * 0.0006, sx: 1, sy: 1, ew: 30 },
    ];
    wheels.forEach((w, wi) => {
      g.save(); g.scale(w.sx, w.sy);
      g.lineWidth = 9 / Math.min(w.sx, w.sy) * (wi < 2 ? 0.4 : 1);
      g.strokeStyle = '#b8862a'; g.beginPath(); g.arc(0, 0, w.R, 0, 6.283); g.stroke();
      g.lineWidth = 3 / Math.min(w.sx, w.sy) * (wi < 2 ? 0.4 : 1);
      g.strokeStyle = '#ffe9a0'; g.beginPath(); g.arc(0, 0, w.R - 1, 0, 6.283); g.stroke();
      g.restore();
      for (let i = 0; i < w.n; i++) {
        const a = w.rot + (i / w.n) * 6.283;
        eyeAt(g, wi * 11 + i, Math.cos(a) * w.R * w.sx, Math.sin(a) * w.R * w.sy, w.ew, gaze, now, wi * 3 + i * 0.37);
      }
    });

    // core and halo
    const cg = g.createRadialGradient(-6, -8, 2, 0, 0, 36);
    cg.addColorStop(0, '#ffffff'); cg.addColorStop(0.6, '#fff3b0'); cg.addColorStop(1, '#f0b840');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 36, 0, 6.283); g.fill();
    eyeAt(g, 3, 0, 0, 66, gaze, now, 0.5);
    g.strokeStyle = 'rgba(255,240,170,0.95)'; g.lineWidth = 5;
    g.beginPath(); g.ellipse(0, -66, 38, 10, 0, 0, 6.283); g.stroke();
    g.restore();
  }

  // ---------- update ----------
  function respawn(p, i) { const h = homeXY(i); p.x = h.x; p.y = h.y; p.flash = 1; }

  function pickDir(now) {
    // every few tenths of a second, work out the way to each player; the creature follows the maze's own corridors
    if (now - angel.fieldAt > 300) {
      angel.fieldAt = now;
      angel.fields = players.map((p) => field(clamp(Math.floor(p.x / T), 0, GW - 1), clamp(Math.floor(p.y / T), 0, GH - 1)));
    }
  }
  function updateAngel(now, dt) {
    if (now - startAt < ANGEL_GRACE_MS) return;
    pickDir(now);
    const speed = Math.min(112, 58 + 11 * gotCount);
    let near = players[0], nd = Infinity;
    players.forEach((p) => { const d = Math.hypot(p.x - angel.x, p.y - angel.y); if (d < nd) { nd = d; near = p; } });
    angel.gaze = { gx: clamp(Math.round((near.x - angel.x) / 120), -1, 1), gy: clamp(Math.round((near.y - angel.y) / 90), -1, 1) };

    let tx, ty;
    if (nd < T * 1.1) { tx = near.x; ty = near.y; }                                 // right on top of you: no more corridors
    else {
      if (!angel.next || Math.hypot(angel.next[0] * T + T / 2 - angel.x, angel.next[1] * T + T / 2 - angel.y) < 3) {
        const cx = clamp(Math.floor(angel.x / T), 0, GW - 1), cy = clamp(Math.floor(angel.y / T), 0, GH - 1);
        let bf = null, bd = Infinity;
        angel.fields.forEach((f) => { const v = f[idx(cx, cy)]; if (v >= 0 && v < bd) { bd = v; bf = f; } });
        angel.next = null;
        if (bf) {
          let bn = null, bv = bf[idx(cx, cy)];
          neighbours(cx, cy).forEach(([nx, ny]) => { const v = bf[idx(nx, ny)]; if (v >= 0 && v < bv) { bv = v; bn = [nx, ny]; } });
          angel.next = bn;
        }
      }
      if (angel.next) { tx = angel.next[0] * T + T / 2; ty = angel.next[1] * T + T / 2; } else return;
    }
    const dx = tx - angel.x, dy = ty - angel.y, d = Math.hypot(dx, dy) || 1, step = Math.min(d, speed * dt);
    angel.x += (dx / d) * step; angel.y += (dy / d) * step;
  }

  function update(now, dt) {
    const sinceStart = now - startAt;
    if (phase === 'play') {
      const solo = PLAYER_MODE === 1;
      const dirs = solo
        ? [[(keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0)]]
        : [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)],
          [(keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0)]];
      players.forEach((p, i) => {
        p.flash = Math.max(0, p.flash - dt * 1.5);
        const [ix, iy] = dirs[i];
        if (sinceStart < FADE_IN_MS * 0.5 || (!ix && !iy)) return;
        const len = Math.hypot(ix, iy);
        p.facing = { x: ix / len, y: iy / len };
        const mx = p.facing.x * PLAYER_SPEED * dt, my = p.facing.y * PLAYER_SPEED * dt;
        let moved = 0;
        if (!hits(p.x + mx, p.y, PLAYER_RADIUS)) { p.x += mx; moved += Math.abs(mx); }
        if (!hits(p.x, p.y + my, PLAYER_RADIUS)) { p.y += my; moved += Math.abs(my); }
        if (moved && window.Footsteps) window.Footsteps.advance(p, dt * 9, ac, 'floor', 1);
      });

      pieces.forEach((pc) => {
        if (pc.got) return;
        players.forEach((p) => {
          if (pc.got || Math.hypot(p.x - pc.x, p.y - pc.y) > 26) return;
          pc.got = true; gotCount++;
          toast = gotCount >= PIECES ? 'The book is whole. A gate is opening.' : `A piece of the book  (${gotCount} / ${PIECES})`;
          toastAt = now;
          chime(660 + gotCount * 110, 0, 0.25, 1.8); chime(990 + gotCount * 110, 0.12, 0.15, 1.6);
          if (gotCount >= PIECES) {
            gate.opening = true;
            [523, 659, 784, 1047, 1318].forEach((f, k) => chime(f, 0.3 + k * 0.18, 0.2, 2.6));
          }
        });
      });
      if (gate.opening && gate.open < 1) gate.open = Math.min(1, gate.open + dt / 2.2);

      updateAngel(now, dt);

      let nd = Infinity;
      players.forEach((p, i) => {
        const d = Math.hypot(p.x - angel.x, p.y - angel.y);
        nd = Math.min(nd, d);
        if (sinceStart >= ANGEL_GRACE_MS && d < CATCH_DIST && phase === 'play') { caught = i; phase = 'caught'; phaseAt = now; shriek(); }
        if (gate.open >= 1 && phase === 'play' && Math.floor(p.x / T) === gate.tx && Math.floor(p.y / T) === gate.ty) {
          phase = 'white'; phaseAt = now; chime(1047, 0, 0.3, 3.5); chime(1568, 0.2, 0.2, 3.5);
        }
      });
      if (dissGain) dissGain.gain.setTargetAtTime(clamp(1 - nd / 420, 0, 1) * 0.07, ac.currentTime, 0.2);
    } else if (phase === 'caught') {
      if (now - phaseAt > CAUGHT_MS) { respawn(players[caught], caught); angel.next = null; phase = 'play'; }
    } else if (phase === 'white') {
      players.forEach((p) => { p.facing = { x: 0, y: 1 }; });
      if (now - phaseAt > WHITE_MS) { phase = 'end'; phaseAt = now; if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.4); }
    } else if (phase === 'end' && now - phaseAt > END_MS && !leaving) {
      leaving = true;
      try { sessionStorage.setItem('goofy-horror-sourcerer-return', '1'); } catch (e) { /* ignore */ }
      window.location.href = 'halloween1.html';        // you wake up in the Sourcerer's room
    }
  }

  // ---------- drawing ----------
  function drawSky(g, vx, camX, camY) {
    const sg = g.createLinearGradient(0, 0, 0, VIEW_H);
    sg.addColorStop(0, '#6fa6e8'); sg.addColorStop(1, '#d6e8fb');
    g.fillStyle = sg; g.fillRect(vx, 0, VIEW_W, VIEW_H);
    const CELL = 260;                                       // drifting cloud banks, further off so they move slower
    for (let layer = 0; layer < 2; layer++) {
      const par = 0.35 + layer * 0.25;
      const ox = camX * par, oy = camY * par, cx0 = Math.floor(ox / CELL) - 1, cy0 = Math.floor(oy / CELL) - 1;
      for (let cy = cy0; cy <= cy0 + Math.ceil(VIEW_H / CELL) + 2; cy++) for (let cx = cx0; cx <= cx0 + Math.ceil(VIEW_W / CELL) + 2; cx++) {
        if (hash(cx, cy, 40 + layer) > 0.55) continue;
        const x = vx + (cx + hash(cx, cy, 41)) * CELL - ox, y = (cy + hash(cx, cy, 42)) * CELL - oy;
        g.fillStyle = layer ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)';
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 34 - 50, y + Math.sin(k * 2) * 8, 26 + hash(cx, cy, k) * 18, 0, 6.283); g.fill(); }
      }
    }
  }

  function drawPiece(g, pc, now) {
    const bob = Math.sin(now * 0.003 + pc.ph) * 3;
    const gl = g.createRadialGradient(pc.x, pc.y + bob, 2, pc.x, pc.y + bob, 40);
    gl.addColorStop(0, 'rgba(255,240,150,0.85)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gl; g.fillRect(pc.x - 40, pc.y + bob - 40, 80, 80);
    g.save(); g.translate(pc.x, pc.y + bob); g.rotate(Math.sin(now * 0.002 + pc.ph) * 0.18 + (pc.n - 2) * 0.1);
    g.fillStyle = '#f3e3b0'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.5;
    g.beginPath();                                                   // a torn page
    g.moveTo(-9, -12); g.lineTo(6, -13); g.lineTo(10, -6); g.lineTo(8, 3); g.lineTo(11, 11); g.lineTo(-2, 13); g.lineTo(-10, 8); g.lineTo(-8, 0); g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = '#8a5a1c'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-6, -7 + i * 4.5); g.lineTo(5 - (i % 2) * 3, -7 + i * 4.5); g.stroke(); }
    g.strokeStyle = '#a02020'; g.lineWidth = 1.6;                    // a little red cross, the way an old book marks a page
    g.beginPath(); g.moveTo(0, -11); g.lineTo(0, -3); g.moveTo(-3, -8); g.lineTo(3, -8); g.stroke();
    g.restore();
  }

  function drawGate(g, now) {
    const x = gate.tx * T, y = gate.ty * T, o = gate.open;
    if (o > 0) {                                                      // the light on the other side
      const lg = g.createLinearGradient(0, y, 0, y + T * 2.4);
      lg.addColorStop(0, `rgba(255,252,220,${0.95 * o})`); lg.addColorStop(1, 'rgba(255,252,220,0)');
      g.fillStyle = lg; g.fillRect(x - 6, y, T + 12, T * 2.4);
    }
    g.fillStyle = o > 0 ? `rgba(255,248,205,${0.35 + 0.65 * o})` : '#2a2418';
    g.beginPath(); g.moveTo(x + 3, y + T); g.lineTo(x + 3, y + T * 0.42); g.arc(x + T / 2, y + T * 0.42, T / 2 - 3, Math.PI, 0); g.lineTo(x + T - 3, y + T); g.closePath(); g.fill();
    const doorW = (T / 2 - 4) * (1 - 0.82 * o);                       // two leaves swing back
    g.fillStyle = '#d6a93a'; g.strokeStyle = '#7a5a10'; g.lineWidth = 2;
    [[x + 4, 1], [x + T - 4, -1]].forEach(([dx, dir]) => {
      g.beginPath(); g.rect(dir > 0 ? dx : dx - doorW, y + T * 0.38, doorW, T * 0.62); g.fill(); g.stroke();
      g.strokeStyle = '#8a6a18'; g.lineWidth = 1.5;
      for (let i = 1; i < 4; i++) { const bx = dir > 0 ? dx + doorW * i / 4 : dx - doorW * i / 4; g.beginPath(); g.moveTo(bx, y + T * 0.4); g.lineTo(bx, y + T * 0.98); g.stroke(); }
      g.strokeStyle = '#7a5a10'; g.lineWidth = 2;
    });
    g.strokeStyle = '#e8c860'; g.lineWidth = 4;                       // the arch
    g.beginPath(); g.moveTo(x + 2, y + T); g.lineTo(x + 2, y + T * 0.42); g.arc(x + T / 2, y + T * 0.42, T / 2 - 2, Math.PI, 0); g.lineTo(x + T - 2, y + T); g.stroke();
    for (let i = 0; i < PIECES; i++) {                                // five sockets above it: one lights for each piece
      const sx = x + T / 2 + (i - 2) * 9, sy = y - 4, lit = i < gotCount;
      if (lit) { g.fillStyle = 'rgba(255,240,150,0.5)'; g.beginPath(); g.arc(sx, sy, 7, 0, 6.283); g.fill(); }
      g.fillStyle = lit ? '#fff3b0' : '#44392a'; g.strokeStyle = '#7a5a10'; g.lineWidth = 1;
      g.beginPath(); g.arc(sx, sy, 3.3, 0, 6.283); g.fill(); g.stroke();
    }
  }

  function renderViewport(i, now) {
    const p = players[i], vx = i * VIEW_W;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    drawSky(ctx, vx, p.x, p.y);
    ctx.translate(Math.round(vx + VIEW_W / 2 - p.x), Math.round(VIEW_H / 2 - p.y));

    ctx.fillStyle = 'rgba(70,100,160,0.28)';                          // the platform's own shadow drifting off below
    ctx.beginPath(); ctx.ellipse(GW * T / 2, GH * T + 40, GW * T * 0.5, 40, 0, 0, 6.283); ctx.fill();
    ctx.drawImage(world, 0, 0);

    drawGate(ctx, now);
    pieces.forEach((pc) => { if (!pc.got) drawPiece(ctx, pc, now); });
    players.slice().sort((a, b) => a.y - b.y).forEach((pl) => window.PlayerModel.draw(ctx, PLAYER_RADIUS, pl));
    // the creature floats above the clouds, bigger than the corridors it is hunting you down
    if (Math.abs(angel.x - p.x) < VIEW_W / 2 + 160 && Math.abs(angel.y - p.y) < VIEW_H / 2 + 160) {
      ctx.save(); ctx.translate(angel.x, angel.y + Math.sin(now * 0.002) * 4);
      drawAngel(ctx, now, 0.58, angel.gaze);
      ctx.restore();
    }
    ctx.restore();

    // when it is close the edges of the screen start to burn white
    const nd = Math.hypot(p.x - angel.x, p.y - angel.y);
    if (nd < 300 && now - startAt > ANGEL_GRACE_MS) {
      const k = 1 - nd / 300;
      const v = ctx.createRadialGradient(vx + VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, vx + VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
      v.addColorStop(0, 'rgba(255,250,220,0)'); v.addColorStop(1, `rgba(255,250,220,${0.55 * k})`);
      ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
      ctx.fillStyle = v; ctx.fillRect(vx, 0, VIEW_W, VIEW_H); ctx.restore();
    }
  }

  function text(msg, y, alpha, size) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center';
    ctx.font = `${size || 16}px Georgia, serif`;
    ctx.fillStyle = 'rgba(40,50,90,0.85)'; ctx.fillText(msg, canvas.width / 2 + 1, y + 1);
    ctx.fillStyle = '#fffbe8'; ctx.fillText(msg, canvas.width / 2, y);
    ctx.restore();
  }

  let last = null;
  function loop(now) {
    try {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!startAt) startAt = now;
      update(now, dt);
      const since = now - startAt;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderViewport(0, now);
      if (PLAYER_MODE === 2) {
        renderViewport(1, now);
        ctx.strokeStyle = '#7a9ac8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke();
      }
      players.forEach((p, i) => {                                      // a respawning player blinks back in
        if (p.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${p.flash * 0.7})`; ctx.fillRect(i * VIEW_W, 0, VIEW_W, VIEW_H); }
      });

      if (phase === 'caught') {                                        // it has seen you: a flash of white, the shriek, and back to the start
        const k = clamp((now - phaseAt) / CAUGHT_MS, 0, 1);
        const sx = caught * VIEW_W;
        ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, VIEW_W, VIEW_H); ctx.clip();
        ctx.fillStyle = `rgba(255,255,255,${k < 0.2 ? 1 : 1 - (k - 0.2) / 0.8 * 0.15})`; ctx.fillRect(sx, 0, VIEW_W, VIEW_H);
        ctx.translate(sx + VIEW_W / 2 + (Math.random() - 0.5) * 8, VIEW_H / 2 + 60 + (Math.random() - 0.5) * 8);
        drawAngel(ctx, now, 1.1 + k * 0.5, { gx: 0, gy: 0 });
        ctx.restore();
      }
      if (phase === 'white') {
        const k = clamp((now - phaseAt) / WHITE_MS, 0, 1);
        ctx.fillStyle = `rgba(255,252,235,${k})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (phase === 'end') {
        ctx.fillStyle = '#fffcec'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const k = clamp((now - phaseAt) / END_MS, 0, 1);
        ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (since < FADE_IN_MS) { ctx.fillStyle = `rgba(255,255,255,${1 - since / FADE_IN_MS})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }

      if (phase === 'play') {
        if (since > 1800 && since < 9500) text('Find the five pieces of the book. The gate will open when it is whole.', canvas.height - 16, clamp(Math.min((since - 1800) / 600, (9500 - since) / 800), 0, 1), 15);
        const ta = now - toastAt;
        if (ta < 3200) text(toast, 34, clamp(Math.min(ta / 300, (3200 - ta) / 600), 0, 1), 20);
      }
      hudEl.textContent = `Pieces of the book: ${gotCount} / ${PIECES}`;
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
