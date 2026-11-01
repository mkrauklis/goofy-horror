// The Dream, part 4 -- the Facility: an ordinary-looking facility, except that the floor and the walls will
// not stay what they are (tile, dirt, grass, cloud, water, snow, obsidian, one after another, the walls out of
// step with the floor), and you are the monster. Everyone in the building has to die. Every so often you
// flash, for a moment, between yourself and something that the old texts would recognise. When the last
// of them is dead the screen tells you what you are, and then you are sent on to the last of the dreams.
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud-buttons');
  const soundHintEl = document.getElementById('sound-hint');
  const Models = window.MonsterModels;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  const T = 32;
  const SLOT_W = 15, SLOT_H = 14, SX = 6, SY = 4;
  const GW = SLOT_W * SX, GH = SLOT_H * SY;
  const MON_ID = 24;                               // the red-eyed shadow from the Monsterpedia
  const MON_SPEED = 125, MON_R = 15;
  const PERSON_R = 10, WANDER = 40, FLEE = 108, SEE_TILES = 9, KILL_DIST = 24;
  const PEOPLE = 22;
  const THEME_MS = 3200, FADE_MS = 500;
  const WORDS = ['you monster', 'how could you', 'they had names', 'look at what you did', 'you monster'];
  const WORD_MS = 1100, BLACK_MS = 1500;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(x, y, k) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  let seed = (Date.now() ^ 0x51ed270b) >>> 0;
  function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  // ---------- the map: a 6x4 grid of rooms joined by wide corridors ----------
  const grid = new Uint8Array(GW * GH).fill(1);
  const idx = (x, y) => y * GW + x;
  const rooms = [];
  (function build() {
    for (let sy = 0; sy < SY; sy++) for (let sx = 0; sx < SX; sx++) {
      const w = ri(7, 11), h = ri(6, 9);
      const x0 = sx * SLOT_W + 2 + ri(0, SLOT_W - w - 4), y0 = sy * SLOT_H + 2 + ri(0, SLOT_H - h - 4);
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[idx(x, y)] = 0;
      rooms.push({ sx, sy, x0, y0, w, h, cx: x0 + (w >> 1), cy: y0 + (h >> 1) });
    }
    const room = (sx, sy) => rooms[sy * SX + sx];
    const link = (a, b) => {
      let x = a.cx, y = a.cy;
      const carve = () => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const gx = x + i, gy = y + j; if (gx > 0 && gy > 0 && gx < GW - 1 && gy < GH - 1) grid[idx(gx, gy)] = 0; } };
      while (x !== b.cx) { carve(); x += Math.sign(b.cx - x); }
      while (y !== b.cy) { carve(); y += Math.sign(b.cy - y); }
      carve();
    };
    const seen = new Set(['0,0']), stack = [[0, 0]];
    while (stack.length) {                                          // a random spanning tree...
      const [cx, cy] = stack[stack.length - 1];
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; return nx >= 0 && ny >= 0 && nx < SX && ny < SY && !seen.has(nx + ',' + ny); });
      if (!opts.length) { stack.pop(); continue; }
      const [dx, dy] = opts[ri(0, opts.length - 1)];
      link(room(cx, cy), room(cx + dx, cy + dy));
      seen.add((cx + dx) + ',' + (cy + dy)); stack.push([cx + dx, cy + dy]);
    }
    for (let sy = 0; sy < SY; sy++) for (let sx = 0; sx < SX; sx++) {  // ...plus loops, so nobody can be herded into a single dead end
      if (sx + 1 < SX && rnd() < 0.3) link(room(sx, sy), room(sx + 1, sy));
      if (sy + 1 < SY && rnd() < 0.3) link(room(sx, sy), room(sx, sy + 1));
    }
    rooms.forEach((r) => {                                          // a few pillars
      for (let n = ri(0, 3); n > 0; n--) {
        const px = ri(r.x0 + 2, r.x0 + r.w - 4), py = ri(r.y0 + 2, r.y0 + r.h - 4);
        if (Math.abs(px - r.cx) < 2 && Math.abs(py - r.cy) < 2) continue;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) grid[idx(px + i, py + j)] = 1;
      }
    });
  })();
  const solidTile = (tx, ty) => tx < 0 || ty < 0 || tx >= GW || ty >= GH || grid[idx(tx, ty)] === 1;
  function neighbours(tx, ty) { const o = []; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (!solidTile(tx + dx, ty + dy)) o.push([tx + dx, ty + dy]); }); return o; }
  function fieldFrom(sources) {
    const f = new Int16Array(GW * GH).fill(-1), q = [];
    sources.forEach(([x, y]) => { if (!solidTile(x, y) && f[idx(x, y)] < 0) { f[idx(x, y)] = 0; q.push([x, y]); } });
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; neighbours(x, y).forEach(([nx, ny]) => { if (f[idx(nx, ny)] < 0) { f[idx(nx, ny)] = f[idx(x, y)] + 1; q.push([nx, ny]); } }); }
    return f;
  }
  function hitsWall(x, y, r) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!solidTile(tx, ty)) continue;
      const cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
    }
    return false;
  }

  // ---------- the surfaces: seven of them, painted once into 32x32 sprites ----------
  const THEMES = ['tile', 'dirt', 'grass', 'cloud', 'water', 'snow', 'obsidian'];
  const STEP_SOUND = { tile: 'floor', dirt: 'grass', grass: 'grass', cloud: 'floor', water: 'water', snow: 'snow', obsidian: 'metal' };
  const WALL_ORDER = [0, 3, 6, 2, 5, 1, 4];
  const sprites = { floor: [], wall: [] };
  function paint(theme, wall, v) {
    const c = document.createElement('canvas'); c.width = c.height = T;
    const g = c.getContext('2d'), R = (k) => hash(v, theme * 7 + (wall ? 3 : 0), k);
    const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
    const name = THEMES[theme];
    if (name === 'tile') {
      g.fillStyle = wall ? '#262c36' : v % 2 ? '#3d4654' : '#434d5c'; g.fillRect(0, 0, T, T);
      g.strokeStyle = wall ? '#161a21' : '#2a313c'; g.lineWidth = 2; g.strokeRect(1, 1, T - 2, T - 2);
      g.fillStyle = wall ? '#3a4352' : '#566174'; [[5, 5], [T - 5, 5], [5, T - 5], [T - 5, T - 5]].forEach(([x, y]) => blob(x, y, 1.6, g.fillStyle));
      if (wall) { g.fillStyle = 'rgba(230,180,40,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(k * 9, 0, 4, 4); }
    } else if (name === 'dirt') {
      g.fillStyle = wall ? '#4a3a2c' : ['#5a4630', '#4e3d28', '#62503a', '#54432e'][v]; g.fillRect(0, 0, T, T);
      for (let k = 0; k < (wall ? 6 : 14); k++) blob(R(k) * T, R(k + 20) * T, wall ? 5 + R(k + 40) * 6 : 1 + R(k + 40) * 2, wall ? ['#3a2e22', '#594836', '#2e251b'][k % 3] : ['#3a2c1c', '#7a6446', '#463622'][k % 3]);
    } else if (name === 'grass') {
      g.fillStyle = wall ? '#1f4a22' : ['#3f7d2a', '#46862f', '#3a7326', '#4a8c33'][v]; g.fillRect(0, 0, T, T);
      if (wall) { for (let k = 0; k < 9; k++) blob(R(k) * T, R(k + 20) * T, 6 + R(k + 40) * 4, ['#2a6a2c', '#34803a', '#215a24'][k % 3]); }
      else { g.lineWidth = 1.3; for (let k = 0; k < 10; k++) { const x = R(k) * T, y = R(k + 20) * T; g.strokeStyle = k % 2 ? '#2a5c1c' : '#6bb544'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R(k + 40) - 0.5) * 5, y - 5 - R(k + 60) * 4); g.stroke(); } }
    } else if (name === 'cloud') {
      g.fillStyle = wall ? '#b8c8e4' : ['#dfeaf8', '#e8f0fb', '#d6e4f6', '#eaf2fc'][v]; g.fillRect(0, 0, T, T);
      for (let k = 0; k < (wall ? 6 : 4); k++) blob(R(k) * T, R(k + 20) * T, wall ? 7 + R(k + 40) * 5 : 6 + R(k + 40) * 6, wall ? (k % 2 ? '#f4f8ff' : '#9fb2d4') : 'rgba(255,255,255,0.7)');
    } else if (name === 'water') {
      g.fillStyle = wall ? '#0e2c4a' : ['#245c8a', '#2a6694', '#205482', '#2c6a98'][v]; g.fillRect(0, 0, T, T);
      g.strokeStyle = wall ? 'rgba(120,180,230,0.5)' : 'rgba(190,225,250,0.55)'; g.lineWidth = 1.3;
      for (let k = 0; k < 3; k++) { const y = 6 + k * 10 + R(k) * 4, x = R(k + 9) * 12; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 4, x + 16, y); g.quadraticCurveTo(x + 22, y + 3, x + 30, y - 1); g.stroke(); }
    } else if (name === 'snow') {
      g.fillStyle = wall ? '#9ccfe6' : ['#eef4fa', '#e4edf6', '#f4f8fc', '#e8f0f8'][v]; g.fillRect(0, 0, T, T);
      if (wall) { g.strokeStyle = '#e8f8ff'; g.lineWidth = 2; g.strokeRect(2, 2, T - 4, T - 4); g.strokeStyle = 'rgba(40,100,140,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(R(1) * T, 3); g.lineTo(R(2) * T, T - 3); g.stroke(); }
      else { for (let k = 0; k < 8; k++) blob(R(k) * T, R(k + 20) * T, 1 + R(k + 40), k % 3 ? 'rgba(255,255,255,0.9)' : 'rgba(150,185,215,0.5)'); }
    } else {
      g.fillStyle = wall ? '#07050c' : ['#100c18', '#140f1e', '#0c0914', '#16101f'][v]; g.fillRect(0, 0, T, T);
      g.strokeStyle = wall ? 'rgba(160,60,255,0.6)' : 'rgba(120,70,200,0.35)'; g.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(R(k) * T, 0); g.lineTo(R(k + 9) * T, R(k + 20) * T); g.lineTo(R(k + 30) * T, T); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; const sx = R(5) * 20; g.beginPath(); g.moveTo(sx, 4); g.lineTo(sx + 10, 14); g.stroke();
    }
    return c;
  }
  THEMES.forEach((_, th) => { sprites.floor[th] = [0, 1, 2, 3].map((v) => paint(th, false, v)); sprites.wall[th] = [0, 1, 2].map((v) => paint(th, true, v)); });
  function themeAt(now, wall) {
    const t = now + (wall ? 1600 + 9 * THEME_MS : 0), step = Math.floor(t / THEME_MS), into = t - step * THEME_MS;
    const pick = (s) => wall ? WALL_ORDER[((s % 7) + 7) % 7] : ((s % 7) + 7) % 7;
    return { cur: pick(step), next: pick(step + 1), mix: clamp((into - (THEME_MS - FADE_MS)) / FADE_MS, 0, 1) };
  }

  // ---------- people ----------
  const keys = {};
  const TRACKED = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const start = { x: rooms[0].cx, y: rooms[0].cy };
  const monsters = (PLAYER_MODE === 1 ? ['#ff5a3a'] : ['#ff8a3d', '#3ddc84']).map((color, i) => ({
    x: (start.x + 0.5 + (PLAYER_MODE === 2 ? (i ? 0.7 : -0.7) : 0)) * T, y: (start.y + 0.5) * T, color, face: 0, step: 0, walkPhase: 0,
  }));
  let people = [], blood = [], bits = [];
  (function populate() {
    const f = fieldFrom([[start.x, start.y]]), spots = [];
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) if (f[idx(x, y)] > 14) spots.push([x, y]);
    const cols = ['#e8e8f0', '#5ab0ff', '#ff6fa0', '#c8f060', '#f0a040', '#a070ff', '#40e0d0', '#f06060'];
    for (let i = 0; i < PEOPLE && spots.length; i++) {
      const [x, y] = spots.splice(ri(0, spots.length - 1), 1)[0];
      people.push({ x: (x + 0.5) * T, y: (y + 0.5) * T, color: cols[i % cols.length], facing: { x: 1, y: 0 }, walkPhase: rnd() * 6, alive: true, next: null, prev: null, fear: 0 });
    }
  })();
  let flee = fieldFrom([[start.x, start.y]]), fleeAt = -1e9;
  const alive = () => people.filter((p) => p.alive).length;

  let phase = 'play', phaseAt = 0, startAt = 0, leaving = false;
  let nextFlash = 0, flashUntil = 0, lastScream = 0;

  // ---------- sound ----------
  let ac = null, master = null, noiseBuf = null, nextBeat = 0;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), dg = ac.createGain();
    o1.type = 'sawtooth'; o1.frequency.value = 43; o2.type = 'sine'; o2.frequency.value = 64; lp.type = 'lowpass'; lp.frequency.value = 170; dg.gain.value = 0.07;
    o1.connect(lp); o2.connect(lp); lp.connect(dg); dg.connect(master); o1.start(); o2.start();
    const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function noise(dur, freq, q, vol, type) {
    if (!ac) return;
    const n = ac.createBufferSource(); n.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(); n.stop(ac.currentTime + dur + 0.02);
  }
  function thump(freq, vol, dur) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, ac.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 0.45, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function sweep(f0, f1, dur, vol, type) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sawtooth';
    o.frequency.setValueAtTime(f0, ac.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  const screamSound = () => { sweep(900 + Math.random() * 500, 420, 0.5, 0.14); noise(0.35, 2400, 1, 0.1); };
  const killSound = () => { noise(0.25, 700, 0.8, 0.35); thump(80, 0.4, 0.3); };
  const demonSound = () => { thump(50, 0.7, 0.6); sweep(180, 40, 0.5, 0.3); noise(0.4, 300, 0.5, 0.4, 'lowpass'); };

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (soundHintEl) soundHintEl.textContent = '';
    if (TRACKED.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (TRACKED.has(e.key)) { keys[e.key] = false; e.preventDefault(); } });

  // ---------- update ----------
  function kill(p, by, now) {
    p.alive = false; p.diedAt = now;
    blood.push({ x: p.x, y: p.y, r: 16 + rnd() * 8, blobs: Array.from({ length: 7 }, () => [(rnd() - 0.5) * 36, (rnd() - 0.5) * 36, 3 + rnd() * 7]) });
    if (blood.length > 120) blood.shift();
    for (let i = 0; i < 14; i++) { const a = rnd() * 6.283, sp = 60 + rnd() * 140; bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + rnd() * 0.4, age: 0 }); }
    killSound(); screamSound();
    if (alive() === 0) { phase = 'words'; phaseAt = now + 700; }
  }

  function updatePeople(now, dt) {
    if (now - fleeAt > 220) { fleeAt = now; flee = fieldFrom(monsters.map((m) => [Math.floor(m.x / T), Math.floor(m.y / T)])); }
    people.forEach((p) => {
      if (!p.alive) return;
      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), here = flee[idx(tx, ty)];
      const scared = here >= 0 && here <= SEE_TILES;
      if (scared && p.fear <= 0 && now - lastScream > 700) { screamSound(); lastScream = now; }
      p.fear = scared ? 1.5 : Math.max(0, p.fear - dt);
      if (!p.next || Math.hypot(p.next[0] * T + T / 2 - p.x, p.next[1] * T + T / 2 - p.y) < 3) {
        const opts = neighbours(tx, ty);
        let pick = null;
        if (p.fear > 0 && opts.length) {
          let best = -1; opts.forEach(([x, y]) => { const v = flee[idx(x, y)] + rnd() * 0.5; if (v > best) { best = v; pick = [x, y]; } });
        } else if (opts.length) {
          const fwd = opts.filter(([x, y]) => !p.prev || x !== p.prev[0] || y !== p.prev[1]);
          pick = (fwd.length ? fwd : opts)[ri(0, (fwd.length ? fwd : opts).length - 1)];
        }
        p.prev = [tx, ty]; p.next = pick;
      }
      if (p.next) {
        const gx = p.next[0] * T + T / 2, gy = p.next[1] * T + T / 2, dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy) || 1, sp = (p.fear > 0 ? FLEE : WANDER) * dt;
        p.x += (dx / d) * Math.min(d, sp); p.y += (dy / d) * Math.min(d, sp);
        p.facing = { x: dx / d, y: dy / d }; p.walkPhase += sp * 0.3;
      }
    });
  }

  function update(now, dt) {
    if (phase === 'play') {
      const solo = PLAYER_MODE === 1;
      const dirs = solo
        ? [[(keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0)]]
        : [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)],
          [(keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0)]];
      const surface = STEP_SOUND[THEMES[themeAt(now, false).cur]];
      monsters.forEach((m, i) => {
        const [ix, iy] = dirs[i];
        if (!ix && !iy) return;
        const len = Math.hypot(ix, iy), mx = (ix / len) * MON_SPEED * dt, my = (iy / len) * MON_SPEED * dt;
        m.face = Math.atan2(iy, ix);
        if (!hitsWall(m.x + mx, m.y, MON_R)) m.x += mx;
        if (!hitsWall(m.x, m.y + my, MON_R)) m.y += my;
        m.step += dt * 9;
        if (window.Footsteps) window.Footsteps.advance(m, dt * 9, ac, surface, 1);
      });
      updatePeople(now, dt);
      people.forEach((p) => { if (p.alive && monsters.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < KILL_DIST)) kill(p, null, now); });

      if (!nextFlash) nextFlash = now + 5000 + Math.random() * 4000;
      if (now >= nextFlash) { flashUntil = now + 460; nextFlash = now + 6500 + Math.random() * 9000; demonSound(); }

      if (ac && now >= nextBeat) {
        const near = Math.min(...people.filter((p) => p.alive).map((p) => Math.min(...monsters.map((m) => Math.hypot(m.x - p.x, m.y - p.y)))), 9999);
        thump(46, 0.22, 0.2); setTimeout(() => thump(42, 0.14, 0.18), 150);
        nextBeat = now + 600 + clamp(near / 600, 0, 1) * 500;
      }
    } else if (phase === 'words') {
      if (now - phaseAt > WORDS.length * WORD_MS + BLACK_MS && !leaving) {
        leaving = true;
        window.location.href = 'dreamend.html';
      }
    }
    for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.93; b.vy *= 0.93; if (b.age > b.life) bits.splice(i, 1); }
  }

  // ---------- drawing ----------
  function drawTiles(g, camX, camY, now) {
    const tx0 = Math.max(0, Math.floor((camX - VIEW_W / 2) / T) - 1), tx1 = Math.min(GW - 1, Math.ceil((camX + VIEW_W / 2) / T) + 1);
    const ty0 = Math.max(0, Math.floor((camY - VIEW_H / 2) / T) - 1), ty1 = Math.min(GH - 1, Math.ceil((camY + VIEW_H / 2) / T) + 1);
    const F = themeAt(now, false), W = themeAt(now, true);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const wall = grid[idx(tx, ty)] === 1, S = wall ? W : F, set = wall ? sprites.wall : sprites.floor, v = Math.floor(hash(tx, ty, 3) * set[0].length);
      g.drawImage(set[S.cur][v], tx * T, ty * T);
      if (S.mix > 0) { g.globalAlpha = S.mix; g.drawImage(set[S.next][v], tx * T, ty * T); g.globalAlpha = 1; }
    }
    if (F.cur === 4 || (F.next === 4 && F.mix > 0)) {                      // the water moves
      g.fillStyle = 'rgba(200,235,255,0.10)';
      for (let y = Math.floor(camY - VIEW_H / 2); y < camY + VIEW_H / 2; y += 14) { const o = Math.sin(now * 0.003 + y * 0.2) * 12; g.fillRect(camX - VIEW_W / 2 + o, y, VIEW_W, 3); }
    }
  }
  function drawBlood(g) {
    blood.forEach((b) => {
      g.fillStyle = 'rgba(110,8,12,0.85)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(150,16,20,0.9)'; b.blobs.forEach(([x, y, r]) => { g.beginPath(); g.arc(b.x + x, b.y + y, r, 0, 6.283); g.fill(); });
    });
  }
  function drawMonster(g, m, now, demon) {
    g.save(); g.translate(m.x, m.y);
    const bob = Math.sin(m.step) * 1.5;
    const aura = g.createRadialGradient(0, 0, 4, 0, 0, 46);
    aura.addColorStop(0, 'rgba(255,40,30,0.45)'); aura.addColorStop(1, 'rgba(255,40,30,0)');
    g.fillStyle = aura; g.fillRect(-46, -46, 92, 92);
    g.strokeStyle = m.color; g.lineWidth = 2; g.globalAlpha = 0.8; g.beginPath(); g.arc(0, 4, MON_R + 3, 0, 6.283); g.stroke(); g.globalAlpha = 1;
    if (demon) { window.DreamDemon.draw(g, now, 0.62); }
    else { const s = (MON_R * 2.3) / Models.extent(MON_ID); g.translate(0, bob); g.scale(s, s); Models.draw(MON_ID, g, now); }
    g.restore();
  }
  function viewport(i, now, flashing) {
    const m = monsters[i], vx = i * VIEW_W, camX = m.x, camY = m.y;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    const shake = flashing ? 5 : 0;
    ctx.translate(Math.round(vx + VIEW_W / 2 - camX + (Math.random() - 0.5) * shake), Math.round(VIEW_H / 2 - camY + (Math.random() - 0.5) * shake));
    drawTiles(ctx, camX, camY, now);
    drawBlood(ctx);
    const things = [];
    people.forEach((p) => { if (Math.abs(p.x - camX) < VIEW_W / 2 + 40 && Math.abs(p.y - camY) < VIEW_H / 2 + 40) things.push({ y: p.y, draw: () => { if (!p.alive) ctx.globalAlpha = 0.85; window.PlayerModel.draw(ctx, PERSON_R, p); ctx.globalAlpha = 1; } }); });
    monsters.forEach((mm) => things.push({ y: mm.y, draw: () => drawMonster(ctx, mm, now, flashing && (Math.floor(now / 70) % 2 === 0)) }));
    things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
    bits.forEach((b) => { ctx.fillStyle = `rgba(160,10,14,${1 - b.age / b.life})`; ctx.beginPath(); ctx.arc(b.x, b.y, 2.4, 0, 6.283); ctx.fill(); });
    ctx.restore();

    maskCtx.globalCompositeOperation = 'source-over'; maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.fillStyle = 'rgba(0,0,0,0.93)'; maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    monsters.forEach((mm) => { const sx = mm.x - camX + VIEW_W / 2, sy = mm.y - camY + VIEW_H / 2; punch(sx, sy, 70, 1); punch(sx, sy, 215, 0.88); });
    ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip(); ctx.drawImage(maskCanvas, vx, 0);
    let near = null, nd = Infinity;                                       // you can smell them: a red tick points at the nearest
    people.forEach((p) => { if (!p.alive) return; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < nd) { nd = d; near = p; } });
    if (near && nd > 120) {
      const a = Math.atan2(near.y - m.y, near.x - m.x), cx = vx + VIEW_W / 2 + Math.cos(a) * 50, cy = VIEW_H / 2 + Math.sin(a) * 50;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.fillStyle = `rgba(255,50,50,${0.35 + 0.25 * Math.sin(now * 0.006)})`;
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (flashing) { ctx.fillStyle = `rgba(255,0,0,${0.18 + 0.12 * Math.random()})`; ctx.fillRect(vx, 0, VIEW_W, VIEW_H); }
    ctx.restore();
  }
  const maskCanvas = document.createElement('canvas'); maskCanvas.width = VIEW_W; maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');
  function punch(x, y, r, a) {
    maskCtx.save(); maskCtx.globalCompositeOperation = 'destination-out';
    const gr = maskCtx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    maskCtx.fillStyle = gr; maskCtx.beginPath(); maskCtx.arc(x, y, r, 0, 6.283); maskCtx.fill(); maskCtx.restore();
  }

  function drawWords(now) {
    const t = now - phaseAt;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (t < 0) return;
    const i = Math.floor(t / WORD_MS);
    if (i >= WORDS.length) return;
    const k = (t % WORD_MS) / WORD_MS, on = k < 0.82 && !(k > 0.5 && Math.sin(t * 0.09) > 0.6);
    if (!on) return;
    const grow = 1 + k * 0.18;
    ctx.save(); ctx.translate(canvas.width / 2 + (Math.random() - 0.5) * 6, canvas.height / 2 + (Math.random() - 0.5) * 6); ctx.scale(grow, grow);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 56px Georgia, serif';
    ctx.fillStyle = 'rgba(255,0,0,0.7)'; ctx.fillText(WORDS[i], -3, 0);
    ctx.fillStyle = 'rgba(0,200,255,0.4)'; ctx.fillText(WORDS[i], 3, 0);
    ctx.fillStyle = '#f4efe8'; ctx.fillText(WORDS[i], 0, 0);
    ctx.restore();
    if (k < 0.12) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }

  let last = null;
  function loop(now) {
    try {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!startAt) startAt = now;
      update(now, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (phase === 'words') drawWords(now);
      else {
        const flashing = now < flashUntil;
        viewport(0, now, flashing);
        if (PLAYER_MODE === 2) { viewport(1, now, flashing); ctx.strokeStyle = '#2a0808'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke(); }
        const since = now - startAt;
        if (since < 1800) { ctx.fillStyle = `rgba(0,0,0,${1 - since / 1800})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        if (since > 1800 && since < 9000) {
          ctx.save(); ctx.globalAlpha = clamp(Math.min((since - 1800) / 700, (9000 - since) / 900), 0, 0.85); ctx.textAlign = 'center'; ctx.font = '15px Georgia, serif';
          ctx.fillStyle = '#e8d8d0'; ctx.fillText('Everyone in the facility has to die.', canvas.width / 2, canvas.height - 16); ctx.restore();
        }
      }
      hudEl.textContent = `People left: ${alive()}`;
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
