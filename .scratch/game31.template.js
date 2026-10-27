(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(31)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL31;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const FULL_W = 920;
  const VIEW_H = 340;
  // On foot each player gets their own viewport (like every other level);
  // once everyone's in the car there's only one thing to look at, so the
  // chase is a single full-width view in both modes.
  const FOOT_VIEW_W = PLAYER_MODE === 1 ? FULL_W : FULL_W / 2;
  const FOOT_ZOOM = 1;
  const CHASE_ZOOM = 0.62;

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;
  const WALK_CYCLE_SPEED = 9;

  // The car: 3x player speed, direct request.
  const CAR_MAX = PLAYER_SPEED * 3;
  const CAR_ACCEL = 420;
  const CAR_BRAKE = 760;
  const CAR_REV_MAX = 110;
  const CAR_TURN = 2.7;
  const BOARD_RADIUS = 84;

  // The Multipod: every monster in the game in one group, 500 HP, chasing
  // at 3x player speed. Each missile does 25 damage (20 hits).
  const BOSS_MAX_HEALTH = 500;
  const MISSILE_DAMAGE = 25;
  const MISSILE_SPEED = PLAYER_SPEED * 5;
  const MISSILE_TURN = 6.5;
  const MISSILE_COOLDOWN_MS = 1100;
  const MISSILE_LIFE_MS = 6000;
  const BOSS_SPEED = PLAYER_SPEED * 3;
  const BOSS_SPREAD = 100;
  const BOSS_HIT_RADIUS = 95;
  const BOSS_EMERGE_MS = 1800;
  const BOSS_RAMP_MS = 900;
  const HIT_KNOCKBACK = 170;
  const CATCH_DIST = 82;
  const DYING_MS = 2600;
  const VICTORY_REDIRECT_MS = 8000;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');
  const hudBossEl = document.getElementById('hud-boss');
  const hudGapEl = document.getElementById('hud-gap');
  const hudSpeedEl = document.getElementById('hud-speed');
  const hudPhaseEl = document.getElementById('hud-phase');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  // ---- procedural audio (no asset files): an engine whose pitch follows
  // the car's speed, a bass line under the chase, and one-shot effects.
  let audioCtx = null;
  let musicMasterGain = null;
  let musicEnabled = false;
  let engineOsc = null;
  let engineGain = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = new AudioCtor();
    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.value = musicEnabled ? 1 : 0;
    musicMasterGain.connect(audioCtx.destination);

    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();

    setInterval(playBassStep, 190);
  }

  const BASS_PATTERN = [55, 55, 82.4, 55, 73.4, 55, 98, 82.4];
  let bassStep = 0;
  function playBassStep() {
    if (!audioCtx || !musicEnabled) return;
    const chasing = gameState === 'chase';
    const f = BASS_PATTERN[bassStep++ % BASS_PATTERN.length] * (chasing ? 1 : 0.5);
    playTone(f, 0.16, 'sawtooth', chasing ? 0.09 : 0.04, 0, musicMasterGain);
  }

  function playTone(freq, duration, type, peakGain, delay, dest) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain || 0.15, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(dest || audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
  function sweep(f0, f1, dur, type, peak) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
  function playMissileLaunch() { sweep(260, 800, 0.3, 'sawtooth', 0.2); }
  function playHit() { sweep(180, 40, 0.4, 'sawtooth', 0.32); }
  function playBonk() { sweep(140, 60, 0.15, 'square', 0.2); }
  function playCrash() { sweep(300, 30, 0.7, 'sawtooth', 0.4); }
  function playDoorBurst() { sweep(90, 30, 0.9, 'sawtooth', 0.35); }
  function playBoard() { [440, 660].forEach((f, i) => playTone(f, 0.18, 'triangle', 0.2, i * 0.1)); }
  function playWinJingle() { [523, 659, 784, 1046, 1318].forEach((f, i) => playTone(f, 0.4, 'triangle', 0.22, i * 0.16)); }

  function updateEngineSound(speedFrac) {
    if (!audioCtx || !engineOsc) return;
    const t = audioCtx.currentTime;
    const active = gameState === 'chase' || gameState === 'dying';
    engineOsc.frequency.setTargetAtTime(48 + Math.abs(speedFrac) * 110, t, 0.08);
    engineGain.gain.setTargetAtTime(active ? 0.05 + Math.abs(speedFrac) * 0.07 : 0, t, 0.1);
  }

  function setMusicEnabled(on) {
    musicEnabled = on;
    ensureAudio();
    if (audioCtx && musicMasterGain) musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
  }
  const soundHintEl = document.getElementById('sound-hint');
  function updateSoundHint() { if (soundHintEl) soundHintEl.style.display = musicEnabled ? '' : 'none'; }
  const musicToggleEl = document.getElementById('music-toggle');
  if (musicToggleEl) {
    musicToggleEl.addEventListener('click', () => {
      setMusicEnabled(!musicEnabled);
      musicToggleEl.textContent = musicEnabled ? '♪ Music: On' : '♪ Music: Off';
      musicToggleEl.classList.toggle('muted', !musicEnabled);
      updateSoundHint();
    });
  }
  updateSoundHint();

  // ---- input ----
  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);
  const keys = {};
  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (TRACKED_KEYS.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
    if (e.key === 'Enter' && gameState === 'wiped') resetLevel();
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) { keys[e.key] = false; e.preventDefault(); }
  });

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // ---- map (a mutable copy: cones get knocked flat) ----
  let tiles = LEVEL.grid.map((r) => r.split(''));
  function tileChar(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return tiles[ty][tx];
  }
  function tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${c(((n >> 16) & 255) + 255 * amt)},${c(((n >> 8) & 255) + 255 * amt)},${c((n & 255) + 255 * amt)})`;
  }
  function hash2(x, y, k) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k, 2246822519);
    return ((h ^ (h >>> 13)) >>> 0);
  }

  // The whole map, flattened to one pixel per tile once up front, for the
  // chase minimap.
  const MAP_COLORS = { '.': '#7fb85a', R: '#6b6e74', P: '#80838a', B: '#aab0b8', T: '#3f7a35', '#': '#2f5a2a', K: '#6b6e74' };
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = COLS; mapCanvas.height = ROWS;
  (function () {
    const mg = mapCanvas.getContext('2d');
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      mg.fillStyle = MAP_COLORS[LEVEL.grid[y][x]] || '#7fb85a';
      mg.fillRect(x, y, 1, 1);
    }
  })();

  // <<SWARM-BEGIN>>
  // The Multipod: every monster in the game, packed into one swarm. Each
  // member is a small stand-in for one of the game's creature families --
  // not a pixel-for-pixel copy of any one level's drawing code, just
  // enough of each one's signature (teeth, wings, tentacles, gears, cap,
  // spikes, a lot of eyes) to read as "all of them at once."
  function swarmRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SWARM_TYPES = 14;
  function makeSwarmMembers(count, spread, seed) {
    const r = swarmRng(seed);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        ang: r() * Math.PI * 2, rad: Math.sqrt(r()) * spread,
        size: spread * (0.11 + r() * 0.15), type: i % SWARM_TYPES,
        phase: r() * 10, spin: r() - 0.5,
      });
    }
    arr.sort((a, b) => b.size - a.size);
    return arr;
  }
  function swCirc(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function swTri(g, x1, y1, x2, y2, x3, y3, fill) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fillStyle = fill; g.fill();
  }
  function drawSwarmMember(g, type, s, now, ph, flash) {
    g.lineJoin = 'round';
    g.lineCap = 'round';
    switch (type) {
      case 0: // blob with a ring of teeth
        swCirc(g, 0, 0, s, '#5a2a6e'); g.strokeStyle = '#2a1233'; g.lineWidth = 2; g.stroke();
        swCirc(g, s * 0.3, 0, s * 0.3, '#e8d0d0'); swCirc(g, s * 0.36, 0, s * 0.15, '#c81020');
        [-1, 0, 1].forEach((k) => swTri(g, s * 0.78, k * s * 0.34 - s * 0.12, s * 1.15, k * s * 0.34, s * 0.78, k * s * 0.34 + s * 0.12, '#f4f0e8'));
        break;
      case 1: // gargoyle
        swTri(g, -s * 0.2, -s * 0.2, -s * 0.9, -s * 1.6, s * 0.3, -s * 0.8, '#52525c');
        swTri(g, -s * 0.2, s * 0.2, -s * 0.9, s * 1.6, s * 0.3, s * 0.8, '#52525c');
        swCirc(g, 0, 0, s, '#4a4e54'); g.strokeStyle = '#17181a'; g.lineWidth = 2; g.stroke();
        swCirc(g, s * 0.45, 0, s * 0.2, '#e03030');
        break;
      case 2: // warden: four wings
        [[-1, 1.7], [1, 1.7], [-1, 1.1], [1, 1.1]].forEach(([sd, len], i) => {
          const off = i < 2 ? -0.25 : 0.2;
          swTri(g, off * s, sd * s * 0.2, -s * 0.8, sd * s * len, s * 0.4, sd * s * len * 0.5, i < 2 ? '#8a8e96' : '#6e7278');
        });
        swCirc(g, 0, 0, s, '#9a9ea6'); g.strokeStyle = '#3a3c40'; g.lineWidth = 2; g.stroke();
        swCirc(g, s * 0.4, 0, s * 0.22, '#4a6a8a');
        break;
      case 3: // grotesque
        swTri(g, 0, -s * 0.2, -s * 0.5, -s * 1.5, s * 0.3, -s * 0.7, '#1c1a1c');
        swTri(g, 0, s * 0.2, -s * 0.5, s * 1.5, s * 0.3, s * 0.7, '#1c1a1c');
        swCirc(g, 0, 0, s, '#232224');
        swCirc(g, s * 0.2, 0, s * 0.5, '#d8b8b4'); swCirc(g, s * 0.26, 0, s * 0.25, '#c81020'); swCirc(g, s * 0.28, 0, s * 0.1, '#0a0304');
        break;
      case 4: // reacher: lashing tentacles
        for (let k = 0; k < 6; k++) {
          const a = k * 1.05 + Math.sin(now * 0.004 + ph + k) * 0.4;
          g.strokeStyle = '#6a2a80'; g.lineWidth = s * 0.22;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 1.7, Math.sin(a) * s * 1.7); g.stroke();
        }
        swCirc(g, 0, 0, s, '#8a3aa0'); g.strokeStyle = '#231228'; g.lineWidth = 2; g.stroke();
        g.beginPath(); g.ellipse(s * 0.2, 0, s * 0.35, s * 0.2, 0, 0, Math.PI * 2); g.fillStyle = '#8a2a40'; g.fill();
        break;
      case 5: // caterpillar
        swCirc(g, -s * 1.1, 0, s * 0.6, '#5a9a3a'); swCirc(g, -s * 0.5, 0, s * 0.75, '#6aa84a');
        swCirc(g, s * 0.3, 0, s * 0.85, '#7ab85a');
        swCirc(g, s * 0.55, -s * 0.3, s * 0.18, '#c81020'); swCirc(g, s * 0.55, s * 0.3, s * 0.18, '#c81020');
        break;
      case 6: // robot with gears
        g.fillStyle = '#8a8c80'; g.fillRect(-s, -s, s * 2, s * 2);
        g.strokeStyle = '#3a3c34'; g.lineWidth = 2; g.strokeRect(-s, -s, s * 2, s * 2);
        g.save(); g.rotate(now * 0.004 + ph);
        for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.fillStyle = '#6a6a5e'; g.fillRect(s * 0.4, -s * 0.12, s * 0.3, s * 0.24); }
        g.restore();
        swCirc(g, 0, 0, s * 0.45, '#6a6a5e'); swCirc(g, s * 0.1, 0, s * 0.22, '#4ab0ff');
        break;
      case 7: // mushroom
        g.fillStyle = '#d9d2c0'; g.fillRect(-s * 0.9, -s * 0.28, s * 1.2, s * 0.56);
        g.beginPath(); g.ellipse(s * 0.2, 0, s * 0.75, s, 0, -Math.PI / 2, Math.PI / 2, true);
        g.fillStyle = '#c94a6a'; g.fill();
        swCirc(g, s * 0.35, -s * 0.4, s * 0.14, 'rgba(255,255,255,0.7)'); swCirc(g, s * 0.5, s * 0.25, s * 0.12, 'rgba(255,255,255,0.7)');
        break;
      case 8: // ghost
        swCirc(g, 0, 0, s, 'rgba(228,234,246,0.92)');
        swCirc(g, s * 0.3, -s * 0.32, s * 0.2, '#111'); swCirc(g, s * 0.3, s * 0.32, s * 0.2, '#111');
        g.beginPath(); g.ellipse(s * 0.62, 0, s * 0.12, s * 0.22, 0, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill();
        break;
      case 9: { // slime
        const wob = 1 + Math.sin(now * 0.006 + ph) * 0.12;
        g.save(); g.scale(wob, 2 - wob);
        swCirc(g, 0, 0, s, '#5ac84a'); g.strokeStyle = '#2a7a22'; g.lineWidth = 2; g.stroke();
        g.restore();
        swCirc(g, s * 0.35, -s * 0.28, s * 0.2, '#fff'); swCirc(g, s * 0.35, s * 0.28, s * 0.2, '#fff');
        swCirc(g, s * 0.42, -s * 0.28, s * 0.09, '#111'); swCirc(g, s * 0.42, s * 0.28, s * 0.09, '#111');
        break;
      }
      case 10: // spiky
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          swTri(g, Math.cos(a - 0.2) * s * 0.8, Math.sin(a - 0.2) * s * 0.8, Math.cos(a) * s * 1.55, Math.sin(a) * s * 1.55, Math.cos(a + 0.2) * s * 0.8, Math.sin(a + 0.2) * s * 0.8, '#d9792a');
        }
        swCirc(g, 0, 0, s * 0.85, '#a8501a'); swCirc(g, s * 0.3, 0, s * 0.25, '#ffd23d');
        break;
      case 11: // eyeball cluster
        swCirc(g, 0, 0, s, '#e8d8d0'); g.strokeStyle = '#8a6a60'; g.lineWidth = 2; g.stroke();
        [[0.35, 0], [-0.1, -0.45], [-0.1, 0.45], [-0.55, 0.1], [0.2, -0.65]].forEach(([x, y]) => {
          swCirc(g, x * s, y * s, s * 0.22, '#fff'); swCirc(g, x * s + s * 0.05, y * s, s * 0.12, '#c81020');
        });
        break;
      case 12: { // frozen mutation
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(Math.cos(a) * s * 1.1, Math.sin(a) * s * 1.1); }
        g.closePath(); g.fillStyle = '#9fd8ff'; g.fill(); g.strokeStyle = '#e8f8ff'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(-s * 0.6, -s * 0.3); g.lineTo(0, 0); g.lineTo(s * 0.5, -s * 0.6); g.moveTo(0, 0); g.lineTo(s * 0.2, s * 0.7); g.stroke();
        swCirc(g, s * 0.1, 0, s * 0.2, '#d83a3a');
        break;
      }
      default: // knight
        swTri(g, -s * 0.8, 0, -s * 1.5, -s * 0.5, -s * 1.3, s * 0.5, '#c0392b');
        swCirc(g, 0, 0, s, '#7a7f8a'); g.strokeStyle = '#2a2d33'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#111'; g.fillRect(s * 0.2, -s * 0.14, s * 0.7, s * 0.28);
        swCirc(g, s * 0.62, 0, s * 0.07, '#ff3a3a');
    }
    if (flash) swCirc(g, 0, 0, s * 1.1, 'rgba(255,255,255,0.6)');
  }
  function drawSwarm(g, cx, cy, heading, now, members, spread, flash, scatter) {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    members.forEach((m) => {
      const a = m.ang + now * 0.0014 * m.spin;
      let u = Math.cos(a) * m.rad * 1.25 + Math.sin(now * 0.004 + m.phase) * spread * 0.03;
      let w = Math.sin(a) * m.rad * 0.8 + Math.cos(now * 0.0035 + m.phase) * spread * 0.03;
      if (scatter) { const k = 1 + scatter * 3.2; u *= k; w *= k; }
      g.save();
      g.translate(cx + u * cs - w * sn, cy + u * sn + w * cs);
      g.rotate(heading + Math.sin(now * 0.003 + m.phase) * 0.25 + (scatter ? scatter * m.spin * 6 : 0));
      if (scatter) g.globalAlpha = Math.max(0, 1 - scatter);
      drawSwarmMember(g, m.type, m.size, now, m.phase, flash);
      g.restore();
    });
  }
  // <<SWARM-END>>

  // ---- game state ----
  const BEST_TIME_KEY = 'goofy-horror-best-level31';
  let bestMs = (() => {
    const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(v) ? v : null;
  })();
  function formatTime(ms) {
    const total = Math.max(0, ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }
  let runStartTime = performance.now();
  let elapsedMs = 0;
  // 'foot' | 'chase' | 'dying' | 'victory' | 'wiped'
  let gameState = 'foot';
  let chaseStartedAt = 0;
  let dyingStartedAt = 0;
  let victoryAt = 0;
  let shake = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return { x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, isMoving: false, walkPhase: 0, shotgunAmmo: 0 };
  }
  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  const car = { x: 0, y: 0, heading: 0, v: 0, nextFireAt: 0, braking: false };
  const carStart = tileCenter(LEVEL.car.x, LEVEL.car.y);
  const doorPos = { x: LEVEL.door.x * TILE + TILE / 2, y: (LEVEL.door.y + 0.5) * TILE };

  const members = makeSwarmMembers(46, BOSS_SPREAD, 3131);
  const boss = { hp: BOSS_MAX_HEALTH, s: 0, x: 0, y: 0, heading: 0, emerge: 0, flashUntil: 0 };

  // The path the car has driven -- the Multipod follows it exactly, so it
  // can never cut a corner and catch up for free; only a slowdown costs
  // you ground.
  let trail = [];
  let missiles = [];
  let particles = [];
  let explosions = [];
  let floatingTexts = [];
  let cam = { x: 0, y: 0 };

  function resetTrail() {
    trail = [];
    const dx = carStart.x - doorPos.x, dy = carStart.y - doorPos.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / 8);
    for (let i = 0; i <= steps; i++) {
      trail.push({ x: doorPos.x + (dx * i) / steps, y: doorPos.y + (dy * i) / steps, c: (len * i) / steps });
    }
  }
  function carS() {
    const last = trail[trail.length - 1];
    return last.c + Math.hypot(car.x - last.x, car.y - last.y);
  }
  function pushTrail() {
    const last = trail[trail.length - 1];
    const d = Math.hypot(car.x - last.x, car.y - last.y);
    if (d >= 6) trail.push({ x: car.x, y: car.y, c: last.c + d });
  }
  function trailAt(s) {
    let lo = 0, hi = trail.length - 1;
    if (s <= 0) return { x: trail[0].x, y: trail[0].y, hx: trail[1].x - trail[0].x, hy: trail[1].y - trail[0].y };
    if (s >= trail[hi].c) return { x: car.x, y: car.y, hx: Math.cos(car.heading), hy: Math.sin(car.heading) };
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (trail[mid].c <= s) lo = mid; else hi = mid;
    }
    const a = trail[lo], b = trail[hi];
    const f = (s - a.c) / Math.max(0.0001, b.c - a.c);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, hx: b.x - a.x, hy: b.y - a.y };
  }

  function spawnFloatingText(x, y, text) { floatingTexts.push({ x, y, text, life: 0, maxLife: 1.3 }); }
  function spawnParticles(x, y, n, color, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color });
    }
  }
  function spawnExplosion(x, y) { explosions.push({ x, y, t0: performance.now() }); }

  function resetLevel() {
    tiles = LEVEL.grid.map((r) => r.split(''));
    players[0].x = tileCenter(LEVEL.spawn1.x, LEVEL.spawn1.y).x; players[0].y = tileCenter(LEVEL.spawn1.x, LEVEL.spawn1.y).y;
    if (players[1]) { players[1].x = tileCenter(LEVEL.spawn2.x, LEVEL.spawn2.y).x; players[1].y = tileCenter(LEVEL.spawn2.x, LEVEL.spawn2.y).y; }
    players.forEach((p) => { p.facing = { x: 0, y: 1 }; p.walkPhase = 0; p.isMoving = false; });
    car.x = carStart.x; car.y = carStart.y; car.heading = LEVEL.car.heading; car.v = 0; car.nextFireAt = 0; car.braking = false;
    boss.hp = BOSS_MAX_HEALTH; boss.s = 0; boss.emerge = 0; boss.flashUntil = 0;
    boss.x = doorPos.x; boss.y = doorPos.y; boss.heading = Math.PI / 2;
    resetTrail();
    missiles = []; particles = []; explosions = []; floatingTexts = [];
    gameState = 'foot';
    shake = 0;
    runStartTime = performance.now();
    elapsedMs = 0;
    cam = { x: car.x, y: car.y };
    victoryAt = 0;
  }
  resetLevel();

  // ---- on foot ----
  function solidForFoot(ch) { return ch === 'B' || ch === 'T' || ch === '#'; }
  function canStandAt(x, y) {
    const r = PLAYER_RADIUS;
    return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].every(([cx, cy]) => !solidForFoot(tileChar(Math.floor(cx / TILE), Math.floor(cy / TILE))));
  }
  function updateFoot(now, dt) {
    const inputs = PLAYER_MODE === 1
      ? [{ ix: (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), iy: (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0) }]
      : [{ ix: (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iy: (keys.s ? 1 : 0) - (keys.w ? 1 : 0) },
         { ix: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), iy: (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0) }];
    players.forEach((p, i) => {
      const { ix, iy } = inputs[i];
      p.isMoving = ix !== 0 || iy !== 0;
      if (!p.isMoving) return;
      const len = Math.hypot(ix, iy);
      const nx = ix / len, ny = iy / len;
      p.facing = { x: nx, y: ny };
      const dx = nx * PLAYER_SPEED * dt, dy = ny * PLAYER_SPEED * dt;
      if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;
      if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;
      p.walkPhase += dt * WALK_CYCLE_SPEED;
    });
    if (players.every((p) => Math.hypot(p.x - car.x, p.y - car.y) < BOARD_RADIUS)) startChase(now);
  }
  function playersAtCar() {
    return players.filter((p) => Math.hypot(p.x - car.x, p.y - car.y) < BOARD_RADIUS).length;
  }

  function startChase(now) {
    gameState = 'chase';
    chaseStartedAt = now;
    playBoard();
    setTimeout(playDoorBurst, 350);
    shake = 14;
    cam = { x: car.x, y: car.y };
    spawnFloatingText(car.x, car.y - 40, 'GO GO GO');
  }

  // ---- driving ----
  function carSamples(x, y, h) {
    const c = Math.cos(h), s = Math.sin(h);
    const pts = [[20, 0], [-20, 0], [0, 11], [0, -11], [18, 10], [18, -10], [-18, 10], [-18, -10]];
    return pts.map(([u, w]) => [x + u * c - w * s, y + u * s + w * c]);
  }
  function carHit(x, y, h) {
    const res = { hard: false, cones: [] };
    carSamples(x, y, h).forEach(([sx, sy]) => {
      const tx = Math.floor(sx / TILE), ty = Math.floor(sy / TILE);
      const ch = tileChar(tx, ty);
      if (ch === 'K') res.cones.push([tx, ty]);
      else if (ch === 'B' || ch === 'T' || ch === '#') res.hard = true;
    });
    return res;
  }

  function updateCar(now, dt, inputLive) {
    const up = inputLive && (keys.w || (PLAYER_MODE === 1 && keys.ArrowUp));
    const down = inputLive && (keys.s || (PLAYER_MODE === 1 && keys.ArrowDown));
    const left = inputLive && (keys.a || (PLAYER_MODE === 1 && keys.ArrowLeft));
    const right = inputLive && (keys.d || (PLAYER_MODE === 1 && keys.ArrowRight));
    const throttle = (up ? 1 : 0) - (down ? 1 : 0);
    const ch = tileChar(Math.floor(car.x / TILE), Math.floor(car.y / TILE));
    const onGrass = ch === '.';
    const cap = CAR_MAX * (onGrass ? 0.5 : 1);
    car.braking = throttle < 0 && car.v > 0;
    if (throttle > 0) car.v += (car.v < 0 ? CAR_BRAKE : CAR_ACCEL) * dt;
    else if (throttle < 0) car.v -= (car.v > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
    else car.v -= Math.sign(car.v) * Math.min(Math.abs(car.v), 180 * dt);
    if (car.v > cap) car.v = Math.max(cap, car.v - 900 * dt);
    car.v = Math.max(car.v, -CAR_REV_MAX);

    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    const newH = car.heading + steer * CAR_TURN * clamp(car.v / 170, -1, 1) * dt;
    if (!carHit(car.x, car.y, newH).hard) car.heading = newH;

    const nx = car.x + Math.cos(car.heading) * car.v * dt;
    const ny = car.y + Math.sin(car.heading) * car.v * dt;
    const hit = carHit(nx, ny, car.heading);
    if (hit.cones.length) {
      hit.cones.forEach(([tx, ty]) => {
        tiles[ty][tx] = 'R';
        const c = tileCenter(tx, ty);
        spawnParticles(c.x, c.y, 10, '#ff8a2a', 260, 0.7, 3);
        spawnFloatingText(c.x, c.y - 10, 'BONK');
      });
      car.v *= 0.78;
      playBonk();
    }
    if (hit.hard) {
      if (Math.abs(car.v) > 120) { shake = Math.max(shake, 8); playBonk(); spawnParticles(car.x, car.y, 8, '#ddd', 200, 0.5, 3); }
      car.v = -car.v * 0.25;
    } else {
      car.x = nx; car.y = ny;
    }
    pushTrail();

    const speedFrac = Math.abs(car.v) / CAR_MAX;
    if (Math.abs(car.v) > 90 && Math.random() < dt * 40) {
      const bx = car.x - Math.cos(car.heading) * 24, by = car.y - Math.sin(car.heading) * 24;
      if (onGrass) spawnParticles(bx, by, 1, '#9b7a4a', 90, 0.6, 5);
      else spawnParticles(bx, by, 1, 'rgba(210,210,215,0.7)', 40, 0.45, 4);
    }
    updateEngineSound(speedFrac);
  }

  // ---- missiles & the Multipod ----
  function fireMissile(now) {
    car.nextFireAt = now + MISSILE_COOLDOWN_MS;
    missiles.push({ x: car.x + Math.cos(car.heading) * 24, y: car.y + Math.sin(car.heading) * 24, angle: car.heading, born: now });
    playMissileLaunch();
  }
  function bossAlive() { return boss.hp > 0 && gameState !== 'dying' && gameState !== 'victory'; }

  function updateMissiles(now, dt) {
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      if (now - m.born > MISSILE_LIFE_MS) { missiles.splice(i, 1); continue; }
      if (bossAlive()) {
        const want = Math.atan2(boss.y - m.y, boss.x - m.x);
        let diff = want - m.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        m.angle += clamp(diff, -MISSILE_TURN * dt, MISSILE_TURN * dt);
      }
      m.x += Math.cos(m.angle) * MISSILE_SPEED * dt;
      m.y += Math.sin(m.angle) * MISSILE_SPEED * dt;
      spawnParticles(m.x - Math.cos(m.angle) * 10, m.y - Math.sin(m.angle) * 10, 1, 'rgba(255,170,60,0.9)', 30, 0.3, 3);
      if (bossAlive() && boss.emerge >= 1 && Math.hypot(m.x - boss.x, m.y - boss.y) < BOSS_HIT_RADIUS) {
        missiles.splice(i, 1);
        hitBoss(now);
      }
    }
  }
  function hitBoss(now) {
    boss.hp = Math.max(0, boss.hp - MISSILE_DAMAGE);
    boss.flashUntil = now + 150;
    boss.s = Math.max(0, boss.s - HIT_KNOCKBACK);
    const ox = (Math.random() - 0.5) * BOSS_SPREAD, oy = (Math.random() - 0.5) * BOSS_SPREAD;
    spawnExplosion(boss.x + ox, boss.y + oy);
    spawnParticles(boss.x + ox, boss.y + oy, 14, '#ff8a2a', 300, 0.7, 4);
    spawnFloatingText(boss.x + ox, boss.y + oy - 20, `-${MISSILE_DAMAGE}`);
    shake = Math.max(shake, 5);
    playHit();
    if (boss.hp <= 0) startDying(now);
  }

  function updateBoss(now, dt) {
    const since = now - chaseStartedAt;
    if (since < BOSS_EMERGE_MS) {
      boss.emerge = clamp(since / BOSS_EMERGE_MS, 0, 1);
      boss.x = doorPos.x; boss.y = doorPos.y; boss.heading = Math.atan2(trail[1].y - trail[0].y, trail[1].x - trail[0].x);
      return;
    }
    boss.emerge = 1;
    const ramp = clamp((since - BOSS_EMERGE_MS) / BOSS_RAMP_MS, 0, 1);
    boss.s += BOSS_SPEED * ramp * dt;
    const p = trailAt(boss.s);
    boss.x = p.x; boss.y = p.y;
    boss.heading = Math.atan2(p.hy, p.hx);
    // a gap of 0 or less means it's on the car, however the trail got there
    if (carS() - boss.s <= CATCH_DIST * 0.8 || Math.hypot(boss.x - car.x, boss.y - car.y) < CATCH_DIST) crash(now);
  }
  function gapNow() { return Math.max(0, carS() - boss.s); }

  function crash(now) {
    if (gameState !== 'chase') return;
    gameState = 'wiped';
    shake = 18;
    playCrash();
    spawnExplosion(car.x, car.y);
    spawnParticles(car.x, car.y, 40, '#ff8a2a', 400, 1.2, 5);
    spawnParticles(car.x, car.y, 30, '#333', 300, 1.5, 6);
    car.v = 0;
    updateEngineSound(0);
  }

  function startDying(now) {
    gameState = 'dying';
    dyingStartedAt = now;
    missiles = [];
    shake = 14;
  }
  function updateDying(now, dt) {
    const t = clamp((now - dyingStartedAt) / DYING_MS, 0, 1);
    car.v *= Math.max(0, 1 - dt * 1.6);
    updateCar(now, dt, false);
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * BOSS_SPREAD * (1 + t * 2);
      spawnExplosion(boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r);
      playHit();
    }
    if (t >= 1) {
      gameState = 'victory';
      victoryAt = now;
      if (bestMs === null || elapsedMs < bestMs) { bestMs = elapsedMs; localStorage.setItem(BEST_TIME_KEY, String(bestMs)); }
      playWinJingle();
      if (window.GoofyStory) window.GoofyStory.completeLevel(31);
      setTimeout(() => { window.location.href = 'index.html'; }, VICTORY_REDIRECT_MS);
    }
  }

  // ---- effects ----
  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = Math.min(1, dt * 3.5);
      p.vx *= 1 - drag; p.vy *= 1 - drag;
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].life += dt;
      if (floatingTexts[i].life >= floatingTexts[i].maxLife) floatingTexts.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 22);
  }

  // ---- rendering ----
  const GRASS = ['#6dab4a', '#72b04e', '#68a647', '#76b552'];
  const ROAD = ['#585b61', '#5c5f65', '#54575d'];
  const LOTC = ['#6c6f75', '#707379', '#686b71'];

  function drawTiles(g, camX, camY, vw, zoom) {
    const halfW = vw / 2 / zoom, halfH = VIEW_H / 2 / zoom;
    const x0 = Math.max(0, Math.floor((camX - halfW) / TILE) - 1), x1 = Math.min(COLS - 1, Math.ceil((camX + halfW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor((camY - halfH) / TILE) - 1), y1 = Math.min(ROWS - 1, Math.ceil((camY + halfH) / TILE) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = tiles[y][x];
        const px = x * TILE, py = y * TILE;
        const hh = hash2(x, y, 1);
        if (ch === 'R' || ch === 'K') g.fillStyle = ROAD[hh % 3];
        else if (ch === 'P') g.fillStyle = LOTC[hh % 3];
        else if (ch === 'B') g.fillStyle = '#9aa0a8';
        else g.fillStyle = GRASS[hh % 4];
        g.fillRect(px, py, TILE + 0.5, TILE + 0.5);
        if (ch === 'T') {
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(px + 18, py + 24, 12, 6, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#5a3d22'; g.fillRect(px + 13, py + 14, 6, 14);
          g.fillStyle = '#2f7a2a'; g.beginPath(); g.arc(px + 16, py + 12, 14, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#3f9a36'; g.beginPath(); g.arc(px + 12, py + 9, 8, 0, Math.PI * 2); g.fill();
        } else if (ch === '#') {
          g.fillStyle = '#2f5a2a'; g.fillRect(px, py, TILE, TILE);
          g.fillStyle = '#3f7a35'; g.beginPath(); g.arc(px + 10, py + 10, 9, 0, Math.PI * 2); g.arc(px + 22, py + 20, 9, 0, Math.PI * 2); g.fill();
        } else if (ch === 'K') {
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(px + 16, py + 26, 9, 4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(px + 16, py + 4); g.lineTo(px + 25, py + 26); g.lineTo(px + 7, py + 26); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.fillRect(px + 11, py + 15, 10, 4);
        }
      }
    }
  }

  function drawScenery(g, now, doorsOpen) {
    // road markings: a dashed centerline around the ring, a stop line at
    // the end of the driveway
    g.save();
    g.strokeStyle = 'rgba(255,214,70,0.85)';
    g.lineWidth = 4;
    g.setLineDash([36, 28]);
    g.strokeRect(13 * TILE, 13 * TILE, (126.5 - 13) * TILE, (76.5 - 13) * TILE);
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    g.setLineDash([22, 22]);
    g.beginPath(); g.moveTo(70.5 * TILE, LEVEL.driveway.y0 * TILE); g.lineTo(70.5 * TILE, 72 * TILE); g.stroke();
    g.setLineDash([]);
    // parking stripes
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 2;
    for (let x = LEVEL.lot.x0 + 1; x <= LEVEL.lot.x1; x += 3) {
      g.beginPath(); g.moveTo(x * TILE, (LEVEL.lot.y0 + 1) * TILE); g.lineTo(x * TILE, (LEVEL.lot.y0 + 5) * TILE); g.stroke();
    }
    g.restore();

    // the facility itself
    const F = LEVEL.facility;
    const fx = F.x0 * TILE, fy = F.y0 * TILE, fw = (F.x1 - F.x0 + 1) * TILE, fh = (F.y1 - F.y0 + 1) * TILE;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(fx + 10, fy + fh - 4, fw, 16);
    g.fillStyle = '#8d939c'; g.fillRect(fx, fy, fw, fh);
    g.fillStyle = '#6f757e'; g.fillRect(fx, fy, fw, 26);
    g.fillStyle = '#b6bcc4'; g.fillRect(fx, fy + fh - 12, fw, 12);
    g.strokeStyle = '#4a4f57'; g.lineWidth = 3; g.strokeRect(fx, fy, fw, fh);
    for (let wy = fy + 52; wy < fy + fh - 70; wy += 52) {
      for (let wx = fx + 28; wx < fx + fw - 40; wx += 64) {
        if (Math.abs(wx + 20 - (doorPos.x)) < 150 && wy > fy + fh - 150) continue;
        g.fillStyle = '#a8d4f0'; g.fillRect(wx, wy, 40, 30);
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(wx + 3, wy + 3, 14, 10);
        g.strokeStyle = '#4a4f57'; g.lineWidth = 2; g.strokeRect(wx, wy, 40, 30);
      }
    }
    // entrance
    const dw = 9 * TILE, dx = doorPos.x - dw / 2, dy = fy + fh - 96;
    g.fillStyle = '#2a2d33'; g.fillRect(dx - 8, dy - 8, dw + 16, 104 + 8);
    if (doorsOpen > 0) {
      g.fillStyle = `rgba(15,5,20,${0.6 + doorsOpen * 0.4})`; g.fillRect(dx, dy, dw, 96);
      const glow = g.createRadialGradient(doorPos.x, dy + 90, 5, doorPos.x, dy + 90, 160);
      glow.addColorStop(0, `rgba(190,60,230,${0.55 * doorsOpen})`); glow.addColorStop(1, 'rgba(190,60,230,0)');
      g.fillStyle = glow; g.fillRect(dx - 80, dy - 60, dw + 160, 220);
    } else {
      g.fillStyle = '#7fb4d8'; g.fillRect(dx, dy, dw / 2 - 3, 96); g.fillRect(dx + dw / 2 + 3, dy, dw / 2 - 3, 96);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(dx + 8, dy + 8, 26, 40); g.fillRect(dx + dw / 2 + 11, dy + 8, 26, 40);
    }
    g.fillStyle = '#3a3d44'; g.fillRect(dx - 16, dy - 40, dw + 32, 28);
    g.fillStyle = '#fff'; g.font = 'bold 20px monospace'; g.textAlign = 'center';
    g.fillText('THE FACILITY', doorPos.x, dy - 20);
    g.textAlign = 'left';
  }

  function drawCar(g, now, inCar) {
    g.save();
    g.translate(car.x, car.y);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(2, 5, 26, 15, car.heading, 0, Math.PI * 2); g.fill();
    g.rotate(car.heading);
    g.fillStyle = '#111';
    [[-13, -14], [13, -14], [-13, 9], [13, 9]].forEach(([wx, wy]) => g.fillRect(wx - 6, wy, 12, 5));
    const grad = g.createLinearGradient(0, -12, 0, 12);
    grad.addColorStop(0, '#e0453c'); grad.addColorStop(1, '#a8241e');
    g.fillStyle = grad;
    g.beginPath();
    if (g.roundRect) g.roundRect(-22, -12, 44, 24, 6); else g.rect(-22, -12, 44, 24);
    g.fill();
    g.strokeStyle = '#5a120e'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#8a1c17'; g.fillRect(-11, -9, 19, 18);
    g.fillStyle = 'rgba(150,200,235,0.9)'; g.fillRect(8, -9, 6, 18);
    g.fillStyle = 'rgba(150,200,235,0.6)'; g.fillRect(-15, -8, 4, 16);
    g.fillStyle = '#ffe8a0'; g.fillRect(20, -10, 3, 5); g.fillRect(20, 5, 3, 5);
    g.fillStyle = car.braking ? '#ff3030' : '#8a1010'; g.fillRect(-23, -10, 3, 5); g.fillRect(-23, 5, 3, 5);
    if (inCar) {
      players.forEach((p, i) => {
        const hy = players.length === 1 ? 0 : (i === 0 ? -5 : 5);
        swCirc(g, -2, hy, 5.5, p.color);
        swCirc(g, -1, hy, 4, 'rgba(235,238,230,0.95)');
        g.fillStyle = '#10181f'; g.fillRect(1, hy - 2.5, 2.4, 5);
      });
    }
    g.restore();
  }

  /*__LIMB__*/
  /*__PLAYERS__*/

  function drawMissilesWorld(g) {
    missiles.forEach((m) => {
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.angle);
      g.scale(1.6, 1.6);
      g.fillStyle = 'rgba(255,140,40,0.6)';
      g.beginPath(); g.moveTo(-12, -2.5); g.lineTo(-22, 0); g.lineTo(-12, 2.5); g.closePath(); g.fill();
      g.fillStyle = '#d8d8d0'; g.fillRect(-6, -3, 14, 6);
      g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(8, -3); g.lineTo(14, 0); g.lineTo(8, 3); g.closePath(); g.fill();
      g.restore();
    });
  }
  function drawParticlesWorld(g) {
    particles.forEach((p) => {
      const a = 1 - p.life / p.maxLife;
      g.globalAlpha = Math.max(0, a);
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fillStyle = p.color; g.fill();
    });
    g.globalAlpha = 1;
  }
  function drawExplosionsWorld(g, now) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      const t = (now - e.t0) / 450;
      if (t >= 1) { explosions.splice(i, 1); continue; }
      g.beginPath(); g.arc(e.x, e.y, 14 + t * 60, 0, Math.PI * 2);
      g.strokeStyle = `rgba(255,150,40,${1 - t})`; g.lineWidth = 5; g.stroke();
      g.beginPath(); g.arc(e.x, e.y, (14 + t * 60) * 0.65, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,214,90,${(1 - t) * 0.5})`; g.fill();
    }
  }
  function drawFloatingTextsWorld(g) {
    floatingTexts.forEach((f) => {
      const t = f.life / f.maxLife;
      g.save(); g.globalAlpha = 1 - t;
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
      g.font = 'bold 16px monospace'; g.textAlign = 'center';
      g.strokeText(f.text, f.x, f.y - t * 30); g.fillText(f.text, f.x, f.y - t * 30);
      g.restore();
    });
  }

  function drawBossWorld(g, now) {
    if (gameState === 'foot' || gameState === 'victory') return;
    const flash = now < boss.flashUntil;
    const dyingT = gameState === 'dying' ? clamp((now - dyingStartedAt) / DYING_MS, 0, 1) : 0;
    g.save();
    if (boss.emerge < 1) g.globalAlpha = boss.emerge;
    const scale = 0.4 + boss.emerge * 0.6;
    g.translate(boss.x, boss.y); g.scale(scale, scale); g.translate(-boss.x, -boss.y);
    drawSwarm(g, boss.x, boss.y, boss.heading, now, members, BOSS_SPREAD, flash, dyingT);
    g.restore();
  }

  function drawViewWorld(vx, vw, camX, camY, zoom, now) {
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, vw, VIEW_H); ctx.clip();
    ctx.fillStyle = '#6dab4a'; ctx.fillRect(vx, 0, vw, VIEW_H);
    ctx.translate(vx + vw / 2 + sx, VIEW_H / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, camX, camY, vw, zoom);
    const doorsOpen = gameState === 'foot' ? 0 : clamp((performance.now() - chaseStartedAt) / 600, 0, 1) * (boss.emerge < 1 || gameState === 'chase' ? 1 : 0.6);
    drawScenery(ctx, now, doorsOpen);
    drawParticlesWorld(ctx);
    if (gameState === 'foot') {
      drawCar(ctx, now, false);
      drawPlayers(ctx);
    } else {
      drawBossWorld(ctx, now);
      if (gameState !== 'wiped') drawCar(ctx, now, true);
      drawMissilesWorld(ctx);
    }
    drawExplosionsWorld(ctx, now);
    drawFloatingTextsWorld(ctx);
    ctx.restore();
  }

  function worldToScreen(vx, vw, camX, camY, zoom, x, y) {
    return { x: vx + vw / 2 + (x - camX) * zoom, y: VIEW_H / 2 + (y - camY) * zoom };
  }

  function drawHintOverFoot(vx, vw, camX, camY, now) {
    const s = worldToScreen(vx, vw, camX, camY, FOOT_ZOOM, car.x, car.y - 36);
    const n = playersAtCar();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    const bob = Math.sin(now * 0.006) * 3;
    const label = players.length === 1 ? 'GET IN THE CAR' : `GET IN THE CAR (${n}/${players.length})`;
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(10,12,18,0.75)'; ctx.fillRect(s.x - w / 2, s.y + bob - 14, w, 20);
    ctx.fillStyle = n === players.length ? '#3ddc84' : '#ffd27a';
    ctx.fillText(label, s.x, s.y + bob);
    ctx.restore();
  }

  function drawMinimap() {
    const mw = 126, mh = Math.round(mw * ROWS / COLS), mx = 8, my = 8;
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.65)'; ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapCanvas, mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
    const dot = (x, y, r, c) => { ctx.beginPath(); ctx.arc(mx + (x / WORLD_W) * mw, my + (y / WORLD_H) * mh, r, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); };
    if (gameState === 'foot') players.forEach((p) => dot(p.x, p.y, 2.2, p.color));
    dot(car.x, car.y, 3, '#ff3a30');
    if (gameState !== 'foot' && gameState !== 'victory') dot(boss.x, boss.y, 4, '#b04ad8');
    ctx.restore();
  }

  function drawBossBar(now) {
    const barW = 280, barH = 11, bx = (FULL_W - barW) / 2, by = 18;
    const frac = clamp(boss.hp / BOSS_MAX_HEALTH, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.7)'; ctx.fillRect(bx - 7, by - 17, barW + 14, barH + 24);
    ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#d88af0';
    ctx.fillText(boss.hp > 0 ? `THE MULTIPOD (${boss.hp}/${BOSS_MAX_HEALTH})` : 'THE MULTIPOD — DESTROYED', FULL_W / 2, by - 4);
    ctx.fillStyle = '#1a1a1c'; ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    grad.addColorStop(0, '#d88af0'); grad.addColorStop(0.5, '#a03ac8'); grad.addColorStop(1, '#5a1a78');
    ctx.fillStyle = grad; ctx.fillRect(bx, by, barW * frac, barH);
    if (frac > 0 && frac < 0.3) { ctx.fillStyle = `rgba(255,255,255,${0.14 * (0.5 + 0.5 * Math.sin(now / 120))})`; ctx.fillRect(bx, by, barW * frac, barH); }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
  }

  function drawFireBar(now) {
    const w = 150, x = (FULL_W - w) / 2, y = VIEW_H - 22;
    const ready = now >= car.nextFireAt;
    const frac = ready ? 1 : clamp(1 - (car.nextFireAt - now) / MISSILE_COOLDOWN_MS, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.7)'; ctx.fillRect(x - 4, y - 14, w + 8, 26);
    ctx.fillStyle = ready ? '#3ddc84' : '#ffb43d'; ctx.fillRect(x, y, w * frac, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 6);
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(ready ? (PLAYER_MODE === 2 ? 'MISSILE READY — P2: UP / SPACE' : 'MISSILE READY — SPACE') : 'RELOADING', FULL_W / 2, y - 3);
    ctx.restore();
  }

  function drawBossPointer(camX, camY, now) {
    const s = worldToScreen(0, FULL_W, camX, camY, CHASE_ZOOM, boss.x, boss.y);
    const m = 26;
    if (s.x > m && s.x < FULL_W - m && s.y > m + 30 && s.y < VIEW_H - m) return;
    const cx = FULL_W / 2, cy = VIEW_H / 2;
    const ang = Math.atan2(s.y - cy, s.x - cx);
    const k = Math.min((FULL_W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (VIEW_H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
    const px = cx + Math.cos(ang) * k, py = cy + Math.sin(ang) * k;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    const pulse = 0.75 + 0.25 * Math.sin(now * 0.012);
    ctx.fillStyle = `rgba(190,70,230,${pulse})`;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawDangerVignette(now) {
    const gap = gapNow();
    if (gap > 320) return;
    const a = (1 - gap / 320) * (0.25 + 0.15 * Math.sin(now * 0.02));
    const g = ctx.createRadialGradient(FULL_W / 2, VIEW_H / 2, VIEW_H * 0.35, FULL_W / 2, VIEW_H / 2, FULL_W * 0.55);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, FULL_W, VIEW_H);
  }

  function drawBanner(text, color, alpha) {
    ctx.save();
    ctx.fillStyle = `rgba(5,8,12,${0.6 * alpha})`; ctx.fillRect(0, VIEW_H / 2 - 36, FULL_W, 72);
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.fillText(text, FULL_W / 2, VIEW_H / 2 + 9);
    ctx.restore();
  }

  function render(now, dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'foot') {
      players.forEach((p, i) => {
        const vx = i * FOOT_VIEW_W;
        const halfW = FOOT_VIEW_W / 2 / FOOT_ZOOM, halfH = VIEW_H / 2 / FOOT_ZOOM;
        const camX = clamp(p.x, halfW, WORLD_W - halfW), camY = clamp(p.y, halfH, WORLD_H - halfH);
        drawViewWorld(vx, FOOT_VIEW_W, camX, camY, FOOT_ZOOM, now);
        ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, FOOT_VIEW_W, VIEW_H); ctx.clip();
        drawHintOverFoot(vx, FOOT_VIEW_W, camX, camY, now);
        ctx.restore();
      });
      if (PLAYER_MODE === 2) { ctx.strokeStyle = '#2a3a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(FOOT_VIEW_W, 0); ctx.lineTo(FOOT_VIEW_W, VIEW_H); ctx.stroke(); }
      return;
    }
    // chase: camera leads the car a little and eases toward it
    const lead = 150;
    const tx = car.x + Math.cos(car.heading) * lead * (car.v / CAR_MAX), ty = car.y + Math.sin(car.heading) * lead * (car.v / CAR_MAX);
    const k = Math.min(1, dt * 5);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    const halfW = FULL_W / 2 / CHASE_ZOOM, halfH = VIEW_H / 2 / CHASE_ZOOM;
    const camX = clamp(cam.x, halfW, WORLD_W - halfW), camY = clamp(cam.y, halfH, WORLD_H - halfH);
    drawViewWorld(0, FULL_W, camX, camY, CHASE_ZOOM, now);
    if (gameState === 'chase') {
      drawDangerVignette(now);
      drawBossPointer(camX, camY, now);
      const since = now - chaseStartedAt;
      if (since < 2200) drawBanner('THE MULTIPOD BREAKS OUT!', '#d88af0', clamp(1 - Math.max(0, since - 1500) / 700, 0, 1));
    }
    if (gameState === 'chase' || gameState === 'dying') { drawBossBar(now); drawFireBar(now); }
    drawMinimap();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE MULTIPOD RAN YOU DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'dying') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE MULTIPOD IS COMING APART&hellip;';
    } else if (gameState === 'victory') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'YOU MADE IT OUT.<br>THE FACILITY IS BEHIND YOU.<br><br>THE END';
    } else {
      messageEl.style.display = 'none';
    }
  }
  function updateHud() {
    if (hudBossEl) hudBossEl.textContent = gameState === 'foot' ? 'Multipod: asleep' : (boss.hp > 0 ? `Multipod: ${boss.hp}/${BOSS_MAX_HEALTH} HP` : 'Multipod: destroyed');
    if (hudGapEl) hudGapEl.textContent = (gameState === 'chase') ? `Gap: ${Math.round(gapNow() / TILE)} tiles` : 'Gap: --';
    if (hudSpeedEl) hudSpeedEl.textContent = `Speed: ${Math.round(Math.abs(car.v) / CAR_MAX * 180)} mph`;
    if (hudPhaseEl) hudPhaseEl.textContent = gameState === 'foot' ? 'On foot' : (gameState === 'chase' ? 'Chase' : (gameState === 'wiped' ? 'Crashed' : 'Escaped'));
    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;
  function loop(now) {
    try {
      const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      if (gameState === 'foot') {
        elapsedMs = now - runStartTime;
        updateFoot(now, dt);
        updateEngineSound(0);
      } else if (gameState === 'chase') {
        elapsedMs = now - runStartTime;
        updateCar(now, dt, true);
        const fire = keys[' '] || (PLAYER_MODE === 2 && keys.ArrowUp);
        if (fire && now >= car.nextFireAt) fireMissile(now);
        updateBoss(now, dt);
        if (gameState === 'chase') updateMissiles(now, dt);
      } else if (gameState === 'dying') {
        elapsedMs = now - runStartTime;
        updateDying(now, dt);
        updateMissiles(now, dt);
      } else if (gameState === 'wiped') {
        updateEngineSound(0);
      }
      updateEffects(dt);
      render(now, dt);
      updateOverlay();
      updateHud();
    } catch (err) {
      console.error('desolate-apes: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
