(function () {
  const LEVEL = window.LEVEL5;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;

  // Speeds are px/second and movement is scaled by the real elapsed time
  // each frame (see `dt` in loop()) rather than a fixed px/frame step --
  // fixed-per-frame movement made real-world speed drift with the frame
  // rate, which showed up as random-feeling slowdowns whenever a frame
  // took longer than usual (e.g. a big tile grid redraw).
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss is a single Crawler (Level 1) blown up to 8x normal size and
  // set alight -- slower and heavier than the original, but its sheer bulk
  // and reach more than make up for it. Everything below is scaled off the
  // original Crawler's numbers (radius 16, catch 20, chase 2.5x) rather
  // than picked arbitrarily.
  const BOSS_RADIUS = 16 * 8;
  const BOSS_CHASE_SPEED = PLAYER_SPEED * 2;
  const BOSS_PATROL_SPEED = PLAYER_SPEED * 0.3;
  const BOSS_LURE_SPEED = PLAYER_SPEED * 0.5;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.25;
  const REPATH_MS = 500;
  const ALERT_GRACE_MS = 3200;
  const FLASHLIGHT_RADIUS = 260;
  const RADAR_DURATION_MS = 10000;
  const SCANNER_DURATION_MS = 10000;
  const FREEZE_DURATION_MS = 10000;
  const EAT_DURATION_MS = 3000;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const CRATE_ITEMS = ['radar', 'meat', 'co2', 'scanner'];

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');

  // Darkness is composited from a separate offscreen mask so that punching
  // light holes (globalCompositeOperation 'destination-out') erases only the
  // mask's own darkness pixels, not the scene already drawn on the main canvas.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');
  const hudButtonsEl = document.getElementById('hud-buttons');
  const hudDoorEl = document.getElementById('hud-door');

  // Explored-tiles minimap: an offscreen 1px-per-tile canvas that only ever
  // gets painted to (never cleared), so it builds up a fog-of-war record of
  // what each session has actually walked near, rather than showing the
  // whole huge map from the start.
  const exploredCanvas = document.createElement('canvas');
  exploredCanvas.width = COLS;
  exploredCanvas.height = ROWS;
  const exploredCtx = exploredCanvas.getContext('2d');
  let explored = new Uint8Array(COLS * ROWS);
  const EXPLORE_RADIUS = 7;
  const MINIMAP_W = 90;

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let musicMasterGain = null; // both the ambient drone and the safe-room pad route through this
  let musicEnabled = true;
  let ambientGain = null;
  let ambientSubOsc = null;
  let ambientMidGain = null;
  let safeMusicGain = null;
  let safeGlitchGain = null;
  let safeVoices = [];

  // A stepped/quantized waveshaper curve -- crushes a smooth sine into a
  // rougher, lower-resolution digital stair-step, for a lo-fi "glitchy"
  // texture instead of a clean tone.
  function makeBitcrushCurve(steps) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  // Every several seconds, a brief, gentle flutter in the safe-room music's
  // volume and a soft pitch dip on a couple of voices -- runs continuously
  // in the background; it's inaudible whenever safeMusicGain itself is
  // faded near zero. Subtle on purpose: enough to read as "not quite
  // right" without undercutting the calming point of the music.
  function scheduleSafeMusicGlitch() {
    const delay = 3000 + Math.random() * 4500;
    setTimeout(() => {
      if (!audioCtx || !safeGlitchGain) return;
      const t = audioCtx.currentTime;
      safeGlitchGain.gain.cancelScheduledValues(t);
      safeGlitchGain.gain.setValueAtTime(1, t);
      let tt = t;
      const stutters = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < stutters; i++) {
        tt += 0.05 + Math.random() * 0.04;
        safeGlitchGain.gain.setValueAtTime(0.4, tt);
        tt += 0.04 + Math.random() * 0.04;
        safeGlitchGain.gain.setValueAtTime(1, tt);
      }
      if (Math.random() < 0.4) {
        safeVoices.forEach((osc) => {
          const base = osc.frequency.value;
          osc.frequency.cancelScheduledValues(t);
          osc.frequency.setValueAtTime(base, t);
          osc.frequency.linearRampToValueAtTime(base * 0.975, t + 0.09);
          osc.frequency.linearRampToValueAtTime(base, t + 0.22);
        });
      }
      scheduleSafeMusicGlitch();
    }, delay);
  }

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = new AudioCtor();

    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.value = musicEnabled ? 1 : 0;
    musicMasterGain.connect(audioCtx.destination);

    // A layered drone instead of one flat tone: two closely-detuned low
    // sines beat slowly against each other, a sub-octave adds weight, a
    // muffled lowpass "breathes" via its own slow LFO, and a faint high
    // triangle drifts by like a distant ringing. Each voice has its own
    // independent vibrato rate so nothing ever locks into a static pitch.
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.05;
    ambientGain.connect(musicMasterGain);

    const ambientFilter = audioCtx.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = 340;
    ambientFilter.Q.value = 0.6;
    ambientFilter.connect(ambientGain);

    const filterLfo = audioCtx.createOscillator();
    filterLfo.frequency.value = 0.07;
    const filterLfoGain = audioCtx.createGain();
    filterLfoGain.gain.value = 90;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(ambientFilter.frequency);
    filterLfo.start();

    function addDroneVoice(freq, type, gainValue, vibratoRate, vibratoDepth) {
      const osc = audioCtx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = audioCtx.createGain();
      gain.gain.value = gainValue;
      const vibrato = audioCtx.createOscillator();
      vibrato.frequency.value = vibratoRate;
      const vibratoGain = audioCtx.createGain();
      vibratoGain.gain.value = vibratoDepth;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();
      osc.connect(gain);
      gain.connect(ambientFilter);
      osc.start();
      return { osc, gain };
    }

    ambientSubOsc = addDroneVoice(41.2, 'sine', 0.6, 0.05, 1.5).osc; // low foundation
    addDroneVoice(43.7, 'sine', 0.5, 0.08, 2); // slow beat against the foundation
    addDroneVoice(20.6, 'sine', 0.4, 0.03, 0.8); // sub-octave rumble
    ambientMidGain = addDroneVoice(97, 'sawtooth', 0, 0.15, 6).gain; // dissonant edge, fades in with tension
    addDroneVoice(660, 'triangle', 0.05, 0.02, 40); // faint distant ringing

    // Gentle chord pad that fades in while a player is resting in the safe
    // zone -- pitched down a bit, softly bitcrushed and lightly echoed for
    // a lower, dreamier "liminal elevator music" character, with an
    // occasional subtle flutter (see scheduleSafeMusicGlitch) rather than
    // anything harsh.
    safeMusicGain = audioCtx.createGain();
    safeMusicGain.gain.value = 0.0001;
    safeMusicGain.connect(musicMasterGain);

    const safeCrusher = audioCtx.createWaveShaper();
    safeCrusher.curve = makeBitcrushCurve(14);
    safeCrusher.oversample = '2x';

    const safeFilter = audioCtx.createBiquadFilter();
    safeFilter.type = 'lowpass';
    safeFilter.frequency.value = 1600;
    safeFilter.Q.value = 0.3;

    // A soft echo gives the pad some room/space instead of sounding dry
    // and flat, like a real elevator's reverberant little box.
    const safeDelay = audioCtx.createDelay(1.0);
    safeDelay.delayTime.value = 0.24;
    const safeDelayFeedback = audioCtx.createGain();
    safeDelayFeedback.gain.value = 0.25;
    const safeDelayMix = audioCtx.createGain();
    safeDelayMix.gain.value = 0.3;
    safeDelay.connect(safeDelayFeedback);
    safeDelayFeedback.connect(safeDelay);
    safeDelay.connect(safeDelayMix);
    safeDelayMix.connect(safeMusicGain);

    safeGlitchGain = audioCtx.createGain();
    safeGlitchGain.gain.value = 1;
    safeGlitchGain.connect(safeCrusher);
    safeCrusher.connect(safeFilter);
    safeFilter.connect(safeMusicGain);
    safeFilter.connect(safeDelay);

    safeVoices = [];
    [261.6, 329.6, 392.0, 523.2].map((f) => f * 0.8).forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const voiceGain = audioCtx.createGain();
      voiceGain.gain.value = 0.16;
      const vibrato = audioCtx.createOscillator();
      vibrato.frequency.value = 0.1 + i * 0.03;
      const vibratoGain = audioCtx.createGain();
      vibratoGain.gain.value = 1.5;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();
      osc.connect(voiceGain);
      voiceGain.connect(safeGlitchGain);
      osc.start();
      safeVoices.push(osc);
    });
    scheduleSafeMusicGlitch();
  }

  function updateSafeMusic(inSafeZone) {
    if (!audioCtx) return;
    safeMusicGain.gain.setTargetAtTime(inSafeZone ? 0.09 : 0.0001, audioCtx.currentTime, 0.8);
  }

  function playTone(freq, duration, type, peakGain, delay) {
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
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function playButtonChime() {
    playTone(880, 0.18, 'sine', 0.2);
  }

  function playItemChime(freq) {
    playTone(freq, 0.25, 'square', 0.18);
  }

  function playDoorUnlockChime() {
    playTone(440, 0.2, 'triangle', 0.22, 0);
    playTone(660, 0.2, 'triangle', 0.22, 0.12);
    playTone(880, 0.3, 'triangle', 0.22, 0.24);
  }

  function playCatchSting() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, start);
    osc.frequency.exponentialRampToValueAtTime(50, start + 0.45);
    gain.gain.setValueAtTime(0.28, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  }

  function playChompThud(delay) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(90, start);
    osc.frequency.exponentialRampToValueAtTime(40, start + 0.18);
    gain.gain.setValueAtTime(0.35, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  }

  function playWinJingle() {
    [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14));
  }

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.min(...players.map((p) => Math.hypot(p.x - boss.x, p.y - boss.y)));
    const proximity = clamp(1 - minDist / 420, 0, 1);
    ambientGain.gain.setTargetAtTime(0.05 + proximity * 0.18, audioCtx.currentTime, 0.3);
    ambientSubOsc.frequency.setTargetAtTime(41.2 + proximity * 12, audioCtx.currentTime, 0.3);
    ambientMidGain.gain.setTargetAtTime(proximity * 0.06, audioCtx.currentTime, 0.4);
  }

  function setMusicEnabled(on) {
    musicEnabled = on;
    ensureAudio();
    if (audioCtx && musicMasterGain) {
      musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
    }
  }

  const musicToggleEl = document.getElementById('music-toggle');
  if (musicToggleEl) {
    musicToggleEl.addEventListener('click', () => {
      setMusicEnabled(!musicEnabled);
      musicToggleEl.textContent = musicEnabled ? '♪ Music: On' : '♪ Music: Off';
      musicToggleEl.classList.toggle('muted', !musicEnabled);
    });
  }

  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const keys = {};

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (TRACKED_KEYS.has(e.key)) {
      keys[e.key] = true;
      e.preventDefault();
    }
    if (e.key === 'Enter' && gameState === 'complete') {
      resetLevel();
      gameState = 'playing';
    }
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });

  function clamp(v, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.max(min, Math.min(max, v));
  }

  function worldToTile(x, y) {
    return { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
  }

  function tileChar(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return LEVEL.grid[ty][tx];
  }

  function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  // A handful of near-identical grays, picked per-tile by hashing its
  // coordinates, so plain floor reads as worn/mottled concrete instead of
  // one flat color -- stable across frames since it's a function of (x, y),
  // not random noise re-rolled every draw.
  const FLOOR_SHADES = ['#4c4c53', '#525258', '#58585f', '#5e5e66', '#54545c', '#605f68'];
  function floorShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % FLOOR_SHADES.length;
    return FLOOR_SHADES[idx];
  }

  const DIRT_SHADES = ['#5a4127', '#63482b', '#4e3a22', '#6b4f30'];
  function dirtShade(x, y) {
    const h = Math.imul(x + 91, 374761393) ^ Math.imul(y - 17, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % DIRT_SHADES.length;
    return DIRT_SHADES[idx];
  }

  // ---- game state ----
  let buttonsPressed = [false, false, false];
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
    };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  // The boss: one giant, burnt Crawler. There's only ever one, so it's a
  // single object rather than an array of monsters like the other levels --
  // no need for the multi-monster machinery when there's nothing to iterate.
  function makeBoss(patrolStartIndex) {
    const tentacleCount = 9;
    const tentacleAngles = [];
    for (let i = 0; i < tentacleCount; i++) {
      tentacleAngles.push((i / tentacleCount) * Math.PI * 2 + Math.random() * 0.4);
    }
    return {
      x: 0,
      y: 0,
      radius: BOSS_RADIUS,
      seed: Math.random() * 100,
      path: [],
      pathIndex: 0,
      nextRepathAt: 0,
      lookDir: { x: 1, y: 0 },
      tentacleAngles,
      state: 'patrol', // 'patrol' | 'alert'
      alertUntil: 0,
      alertTargetTile: null,
      patrolIndex: patrolStartIndex,
      frozenUntil: 0,
      luredState: 'none', // 'none' | 'lured' | 'eating'
      lureTarget: null,
      eatingUntil: 0,
    };
  }

  const boss = makeBoss(0);

  let crates = [];
  let fires = [];
  let radarUntil = 0;
  let scannerUntil = 0;
  let floatingTexts = [];

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  function resetLevel() {
    players.forEach((p) => {
      respawnPlayer(p);
      p.caught = false;
      p.caughtAt = 0;
      p.invulnerableUntil = 0;
    });

    const spawn = LEVEL.monsterSpawns[0];
    const m = tileCenter(spawn.x, spawn.y);
    boss.x = m.x; boss.y = m.y;
    boss.path = []; boss.pathIndex = 0; boss.nextRepathAt = 0;
    boss.state = 'patrol'; boss.alertUntil = 0; boss.alertTargetTile = null;
    boss.frozenUntil = 0; boss.luredState = 'none'; boss.lureTarget = null; boss.eatingUntil = 0;

    buttonsPressed = [false, false, false];
    doorUnlocked = false;

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)], opened: false, openedAt: 0,
    }));
    fires = (LEVEL.fireSpawns || []).map((f, i) => ({
      x: f.x, y: f.y, seed: i * 1471.7 + Math.random() * 5000,
    }));
    radarUntil = 0;
    scannerUntil = 0;
    floatingTexts = [];
    resetExploration();
  }
  resetLevel();

  // ---- player movement & collision ----
  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#') return true;
    if (ch === 'D') return !doorUnlocked;
    return false;
  }

  function canStandAt(x, y) {
    const r = PLAYER_RADIUS;
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return !isWallForPlayer(t.x, t.y);
    });
  }

  function movePlayer(p, dx, dy) {
    if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;
  }

  function applyMovement(p, ix, iy, dt) {
    if (p.caught) return; // held fast during the catch cutscene
    if (ix === 0 && iy === 0) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    movePlayer(p, nx * PLAYER_SPEED * dt, ny * PLAYER_SPEED * dt);
  }

  function updateInputMovement(dt) {
    applyMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), dt);
    applyMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), dt);
  }

  function isHidden(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  function isInSafeZone(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#8f8f9a';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'T') return '#5a4127';
    return '#3c3c46';
  }

  function updateExploration() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      for (let dy = -EXPLORE_RADIUS; dy <= EXPLORE_RADIUS; dy++) {
        const ty = t.y + dy;
        if (ty < 0 || ty >= ROWS) continue;
        for (let dx = -EXPLORE_RADIUS; dx <= EXPLORE_RADIUS; dx++) {
          const tx = t.x + dx;
          if (tx < 0 || tx >= COLS) continue;
          if (dx * dx + dy * dy > EXPLORE_RADIUS * EXPLORE_RADIUS) continue;
          const idx = ty * COLS + tx;
          if (explored[idx]) continue;
          explored[idx] = 1;
          exploredCtx.fillStyle = minimapColorFor(LEVEL.grid[ty][tx]);
          exploredCtx.fillRect(tx, ty, 1, 1);
        }
      }
    });
  }

  function drawMinimap(vx, now) {
    const mh = Math.round(MINIMAP_W * ROWS / COLS);
    const mx = vx + 8, my = 8;
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.65)';
    ctx.fillRect(mx - 3, my - 3, MINIMAP_W + 6, mh + 6);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(exploredCanvas, mx, my, MINIMAP_W, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, my + 0.5, MINIMAP_W - 1, mh - 1);
    players.forEach((pl) => {
      const px = mx + (pl.x / WORLD_W) * MINIMAP_W;
      const py = my + (pl.y / WORLD_H) * mh;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pl.color;
      ctx.fill();
    });
    const bx = mx + (boss.x / WORLD_W) * MINIMAP_W;
    const by = my + (boss.y / WORLD_H) * mh;
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff5a2a';
    ctx.shadowColor = '#ff5a2a';
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
    return mh;
  }

  function spawnFloatingText(x, y, text) {
    floatingTexts.push({ x, y, text, life: 0, maxLife: 1.4 });
  }

  function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].life += dt;
      if (floatingTexts[i].life >= floatingTexts[i].maxLife) floatingTexts.splice(i, 1);
    }
  }

  // The scanner points at the nearest button that hasn't been pressed yet --
  // once a button's done, it drops out of consideration entirely so the
  // scanner never wastes a reading on somewhere you've already been.
  function nearestUnpressedButton(x, y) {
    let best = null, bestD = Infinity;
    LEVEL.buttons.forEach((b, i) => {
      if (buttonsPressed[i]) return;
      const c = tileCenter(b.x, b.y);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }

  function applyItemEffect(item, x, y, now) {
    if (item === 'radar') {
      radarUntil = now + RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'RADAR');
      playItemChime(880);
    } else if (item === 'meat') {
      boss.luredState = 'lured';
      boss.lureTarget = { x, y };
      boss.path = []; boss.pathIndex = 0;
      spawnFloatingText(x, y, 'MEAT');
      playItemChime(220);
    } else if (item === 'co2') {
      boss.frozenUntil = now + FREEZE_DURATION_MS;
      spawnFloatingText(x, y, 'FROZEN');
      playItemChime(1200);
    } else if (item === 'scanner') {
      scannerUntil = now + SCANNER_DURATION_MS;
      spawnFloatingText(x, y, 'SCANNER');
      playItemChime(660);
    }
  }

  function updateCrates(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      crates.forEach((c) => {
        if (c.opened) return;
        if (c.x === t.x && c.y === t.y) {
          c.opened = true;
          c.openedAt = now;
          applyItemEffect(c.item, tileCenter(c.x, c.y).x, tileCenter(c.x, c.y).y, now);
        }
      });
    });
    crates.forEach((c) => {
      if (c.opened && now - c.openedAt >= CRATE_RESPAWN_MS) {
        c.opened = false;
        c.item = CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)];
      }
    });
  }

  function updateTriggers() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);
      if (ch === 'B') {
        const idx = LEVEL.buttons.findIndex((b) => b.x === t.x && b.y === t.y);
        if (idx >= 0 && !buttonsPressed[idx]) {
          buttonsPressed[idx] = true;
          playButtonChime();
          if (buttonsPressed.every(Boolean)) {
            doorUnlocked = true;
            playDoorUnlockChime();
          }
        }
      }
      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
      }
    });
  }

  // ---- boss AI ----
  function monsterCanOccupy(ch) {
    if (ch === '#' || ch === 'S') return false;
    if (ch === 'D') return doorUnlocked;
    return true;
  }

  function buildMonsterGraph() {
    const graph = new Map();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!monsterCanOccupy(LEVEL.grid[y][x])) continue;
        const list = [];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
          if (monsterCanOccupy(LEVEL.grid[ny][nx])) list.push({ x: nx, y: ny });
        });
        graph.set(y * COLS + x, list);
      }
    }
    return graph;
  }

  function bfsPath(graph, start, goal) {
    const key = (t) => t.y * COLS + t.x;
    const startKey = key(start), goalKey = key(goal);
    if (!graph.has(startKey) || !graph.has(goalKey)) return null;
    if (startKey === goalKey) return [start];
    const visited = new Set([startKey]);
    const prev = new Map();
    const queue = [start];
    let found = false;
    while (queue.length) {
      const cur = queue.shift();
      if (key(cur) === goalKey) { found = true; break; }
      const neighbors = graph.get(key(cur)) || [];
      for (const n of neighbors) {
        const k = key(n);
        if (!visited.has(k)) {
          visited.add(k);
          prev.set(k, cur);
          queue.push(n);
        }
      }
    }
    if (!found) return null;
    const path = [goal];
    let curKey = goalKey;
    while (curKey !== startKey) {
      const p = prev.get(curKey);
      path.push(p);
      curKey = key(p);
    }
    path.reverse();
    return path;
  }

  function hasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / (TILE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const t2 = worldToTile(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (tileChar(t2.x, t2.y) === '#') return false;
    }
    return true;
  }

  function updateDetection(now) {
    for (const p of players) {
      if (p.caught || isHidden(p)) continue;
      const d = Math.hypot(p.x - boss.x, p.y - boss.y);
      if (d <= FLASHLIGHT_RADIUS && hasLineOfSight(boss.x, boss.y, p.x, p.y)) {
        boss.state = 'alert';
        boss.alertUntil = now + ALERT_GRACE_MS;
        boss.alertTargetTile = worldToTile(p.x, p.y);
      }
    }
    if (boss.state === 'alert' && now >= boss.alertUntil) {
      boss.state = 'patrol';
      boss.path = [];
      boss.pathIndex = 0;
    }
  }

  function tileTargetSimple(t) {
    return tileCenter(t.x, t.y);
  }

  function updateBoss(now, dt) {
    if (now < boss.frozenUntil) return; // frozen solid: no movement, no perception

    if (boss.luredState === 'eating') {
      if (now >= boss.eatingUntil) {
        boss.luredState = 'none';
        boss.path = []; boss.pathIndex = 0; boss.nextRepathAt = 0;
      } else {
        return;
      }
    }

    if (boss.luredState === 'lured') {
      if (now >= boss.nextRepathAt) {
        boss.nextRepathAt = now + REPATH_MS;
        const startTile = worldToTile(boss.x, boss.y);
        const goalTile = worldToTile(boss.lureTarget.x, boss.lureTarget.y);
        const graph = buildMonsterGraph();
        const path = bfsPath(graph, startTile, goalTile);
        boss.path = path && path.length > 1 ? path.slice(1) : [];
        boss.pathIndex = 0;
      }
      if (boss.path && boss.pathIndex < boss.path.length) {
        const step = BOSS_LURE_SPEED * dt;
        const target = tileTargetSimple(boss.path[boss.pathIndex]);
        const dx = target.x - boss.x, dy = target.y - boss.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) boss.lookDir = { x: dx / d, y: dy / d };
        if (d < step) {
          boss.x = target.x; boss.y = target.y;
          boss.pathIndex++;
        } else {
          boss.x += (dx / d) * step;
          boss.y += (dy / d) * step;
        }
      } else {
        boss.luredState = 'eating';
        boss.eatingUntil = now + EAT_DURATION_MS;
      }
      return;
    }

    updateDetection(now);

    if (now >= boss.nextRepathAt) {
      boss.nextRepathAt = now + REPATH_MS;
      const startTile = worldToTile(boss.x, boss.y);
      const goalTile = boss.state === 'alert' ? boss.alertTargetTile : LEVEL.patrolPoints[boss.patrolIndex];
      const graph = buildMonsterGraph();
      const path = bfsPath(graph, startTile, goalTile);
      if (path && path.length > 1) {
        boss.path = path.slice(1);
        boss.pathIndex = 0;
      } else {
        boss.path = [];
        boss.pathIndex = 0;
        if (boss.state === 'patrol') {
          boss.patrolIndex = (boss.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      }
    }

    if (boss.path && boss.pathIndex < boss.path.length) {
      const step = (boss.state === 'alert' ? BOSS_CHASE_SPEED : BOSS_PATROL_SPEED) * dt;
      const target = tileTargetSimple(boss.path[boss.pathIndex]);
      const dx = target.x - boss.x, dy = target.y - boss.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) boss.lookDir = { x: dx / d, y: dy / d };
      if (d < step) {
        boss.x = target.x; boss.y = target.y;
        boss.pathIndex++;
        if (boss.pathIndex >= boss.path.length && boss.state === 'patrol') {
          boss.patrolIndex = (boss.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      } else {
        boss.x += (dx / d) * step;
        boss.y += (dy / d) * step;
      }
    }
  }

  function updateCatch(now) {
    if (now < boss.frozenUntil) return;
    if (boss.luredState !== 'none') return;
    if (boss.state !== 'alert') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (isHidden(p)) return;
      if (now < p.invulnerableUntil) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BOSS_CATCH_RADIUS) triggerCaught(p, now);
    });
  }

  function triggerCaught(p, now) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    playChompThud(0.35);
    spawnBloodEffect(p.x, p.y);
    p.caught = true;
    p.caughtAt = now;
    p.invulnerableUntil = now + CATCH_CUTSCENE_MS + 1200;
  }

  function updateCutscenes(now) {
    players.forEach((p) => {
      if (p.caught && now - p.caughtAt >= CATCH_CUTSCENE_MS) {
        respawnPlayer(p);
        p.caught = false;
      }
    });
  }

  // ---- blood splatter / particles ----
  let bloodSplatters = [];
  let particles = [];

  function spawnBloodEffect(x, y) {
    bloodSplatters.push({ x, y, seed: Math.random() * 1000 });
    if (bloodSplatters.length > 24) bloodSplatters.shift();

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.45,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) { particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const drag = Math.min(1, dt * 4);
      pt.vx *= 1 - drag;
      pt.vy *= 1 - drag;
    }
  }

  function drawBloodSplatters(g) {
    bloodSplatters.forEach((b) => {
      g.save();
      g.translate(b.x, b.y);
      const points = 8;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = 6 + Math.abs(Math.sin(a * 3 + b.seed)) * 8;
        const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.7;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(90,10,14,0.75)';
      g.fill();
      for (let i = 0; i < 4; i++) {
        const a = b.seed * (i + 1);
        const dist = 10 + (i * 5);
        g.beginPath();
        g.arc(Math.cos(a) * dist, Math.sin(a) * dist * 0.7, 1.5 + (i % 2), 0, Math.PI * 2);
        g.fillStyle = 'rgba(90,10,14,0.6)';
        g.fill();
      }
      g.restore();
    });
  }

  function drawParticles(g) {
    particles.forEach((pt) => {
      const alpha = 1 - pt.life / pt.maxLife;
      g.beginPath();
      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      g.fillStyle = `rgba(160,15,20,${alpha})`;
      g.fill();
    });
  }

  // ---- fires (always burning) ----
  function drawFires(g, now) {
    fires.forEach((f) => {
      const c = tileCenter(f.x, f.y);
      g.save();
      g.translate(c.x, c.y);
      const flicker = 0.85 + Math.sin(now * 0.02 + f.seed) * 0.15;
      const glow = g.createRadialGradient(0, 0, 2, 0, 0, 30 * flicker);
      glow.addColorStop(0, 'rgba(255,170,60,0.55)');
      glow.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, 30 * flicker, 0, Math.PI * 2);
      g.fill();

      for (let i = 0; i < 3; i++) {
        const wobble = Math.sin(now * 0.014 + f.seed + i * 2) * 3;
        const h = (9 + i * 3) * flicker;
        g.beginPath();
        g.moveTo(-4 + i * 2, 6);
        g.quadraticCurveTo(2 + wobble, -h * 0.5, 0 + wobble * 0.5, -h);
        g.quadraticCurveTo(-2 + wobble, -h * 0.5, 4 - i * 2, 6);
        g.closePath();
        g.fillStyle = i === 0 ? '#ffdf8a' : i === 1 ? '#ff9c3d' : '#e0541f';
        g.fill();
      }
      g.restore();
    });
  }

  function fireLightPunches() {
    return fires.map((f) => tileCenter(f.x, f.y));
  }

  // ---- rendering ----
  function drawTiles(g, camX, camY) {
    const minTX = Math.max(0, Math.floor((camX - VIEW_W / 2) / TILE) - 1);
    const maxTX = Math.min(COLS - 1, Math.ceil((camX + VIEW_W / 2) / TILE) + 1);
    const minTY = Math.max(0, Math.floor((camY - VIEW_H / 2) / TILE) - 1);
    const maxTY = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H / 2) / TILE) + 1);
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        let color;
        switch (ch) {
          case '#': color = '#262629'; break;
          case 'S': color = floorShade(x, y); break;
          case 'T': color = dirtShade(x, y); break;
          case 'E': color = '#3a301f'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;
          default: color = floorShade(x, y);
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }

    // door plug (a short 2-tile gap in the exit alcove's wall)
    let dx0 = Infinity, dy0 = Infinity, dx1 = -Infinity, dy1 = -Infinity;
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        if (LEVEL.grid[y][x] === 'D') {
          dx0 = Math.min(dx0, x); dy0 = Math.min(dy0, y);
          dx1 = Math.max(dx1, x); dy1 = Math.max(dy1, y);
        }
      }
    }
    if (dx0 !== Infinity) {
      const wx0 = dx0 * TILE, wy0 = dy0 * TILE;
      const dw = (dx1 - dx0 + 1) * TILE, dh = (dy1 - dy0 + 1) * TILE;
      if (!doorUnlocked) {
        g.strokeStyle = '#0d1114';
        g.lineWidth = 4;
        g.strokeRect(wx0 + 3, wy0 + 3, dw - 6, dh - 6);
        g.strokeStyle = 'rgba(255,190,60,0.5)';
        g.lineWidth = 3;
        g.strokeRect(wx0 + 9, wy0 + 9, Math.max(dw - 18, 2), Math.max(dh - 18, 2));
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.lineWidth = 3;
        g.strokeRect(wx0 + 2, wy0 + 2, dw - 4, dh - 4);
      }
    }

    LEVEL.buttons.forEach((b, i) => {
      const c = tileCenter(b.x, b.y);
      g.beginPath();
      g.arc(c.x, c.y, 9, 0, Math.PI * 2);
      g.fillStyle = buttonsPressed[i] ? '#3ddc84' : '#e0546b';
      g.shadowColor = g.fillStyle;
      g.shadowBlur = 10;
      g.fill();
      g.shadowBlur = 0;
    });

    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    g.beginPath();
    g.arc(ex.x, ex.y, doorUnlocked ? 12 : 6, 0, Math.PI * 2);
    g.fillStyle = doorUnlocked ? '#ffd27a' : '#5a4a30';
    g.fill();

    drawSafeZone(g);
    drawCorpses(g);
    drawBloodSplatters(g);
    drawCrates(g);
    drawMeatLure(g);
  }

  function drawTable(g, cx, cy) {
    g.fillStyle = '#5a4530';
    g.fillRect(cx - 12, cy - 8, 24, 16);
    g.strokeStyle = '#382a1c';
    g.lineWidth = 1.5;
    g.strokeRect(cx - 12, cy - 8, 24, 16);
    g.fillStyle = '#4a3826';
    [[-10, -6], [10, -6], [-10, 6], [10, 6]].forEach(([dx, dy]) => {
      g.fillRect(cx + dx - 1.5, cy + dy - 1.5, 3, 3);
    });
  }

  function drawSafeZone(g) {
    const sz = LEVEL.safeZone;
    const x0 = sz.x0 * TILE, y0 = sz.y0 * TILE;
    const w = (sz.x1 - sz.x0 + 1) * TILE, h = (sz.y1 - sz.y0 + 1) * TILE;

    g.strokeStyle = '#3ddc84';
    g.lineWidth = 3;
    g.shadowColor = '#3ddc84';
    g.shadowBlur = 6;
    g.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
    g.shadowBlur = 0;

    const cx = x0 + w / 2, cy = y0 + h / 2;
    drawTable(g, cx - w / 4, cy);
    drawTable(g, cx + w / 4, cy);
  }

  function drawCorpses(g) {
    (LEVEL.corpseSpawns || []).forEach((cs) => {
      const c = tileCenter(cs.x, cs.y);
      g.save();
      g.translate(c.x, c.y);
      g.rotate(cs.angle || 0);
      g.fillStyle = '#3a2f38';
      g.beginPath();
      g.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(210,220,214,0.85)';
      g.beginPath();
      g.arc(-11, 0, 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.beginPath();
      g.arc(-12, -1, 1.2, 0, Math.PI * 2);
      g.arc(-10, -1, 1.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
  }

  function drawCrates(g) {
    crates.forEach((c) => {
      const center = tileCenter(c.x, c.y);
      g.save();
      g.translate(center.x, center.y);
      if (c.opened) {
        g.fillStyle = '#4a3826';
        g.fillRect(-9, -6, 18, 12);
        g.strokeStyle = '#2a1e14';
        g.lineWidth = 1.5;
        g.strokeRect(-9, -6, 18, 12);
      } else {
        g.fillStyle = '#7a5a34';
        g.fillRect(-10, -10, 20, 20);
        g.strokeStyle = '#4a3520';
        g.lineWidth = 2;
        g.strokeRect(-10, -10, 20, 20);
        g.beginPath();
        g.moveTo(-10, 0); g.lineTo(10, 0);
        g.moveTo(0, -10); g.lineTo(0, 10);
        g.stroke();
      }
      g.restore();
    });
  }

  function drawMeatLure(g) {
    if (boss.luredState === 'none' || !boss.lureTarget) return;
    g.save();
    g.translate(boss.lureTarget.x, boss.lureTarget.y);
    g.fillStyle = '#8a2a2a';
    g.beginPath();
    g.ellipse(0, 0, 9, 6, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(-2, -1, 3, 1.6, 0.3, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawFloatingTexts(g) {
    floatingTexts.forEach((f) => {
      const t = f.life / f.maxLife;
      g.save();
      g.globalAlpha = 1 - t;
      g.fillStyle = '#ffe27a';
      g.font = 'bold 11px monospace';
      g.textAlign = 'center';
      g.fillText(f.text, f.x, f.y - 18 - t * 20);
      g.restore();
    });
  }

  // ---- the boss: a Crawler blown up 8x and set on fire ----
  function drawBossTentacles(g, t) {
    boss.tentacleAngles.forEach((baseA, i) => {
      const sway = Math.sin(t * 0.0017 + i * 1.6 + boss.seed) * 0.5;
      const a = baseA + sway * 0.3;
      const len = boss.radius * (1.5 + 0.25 * Math.sin(t * 0.0013 + i * 2.3));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const wobble = Math.sin(t * 0.004 + i * 2.1 + boss.seed) * (boss.radius * 0.18);
      const perpA = a + Math.PI / 2;
      const midX = (tx / 2) + Math.cos(perpA) * wobble;
      const midY = (ty / 2) + Math.sin(perpA) * wobble;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(midX, midY, tx, ty);
      g.strokeStyle = i % 3 === 0 ? '#3a1008' : '#6a1826';
      g.lineWidth = boss.radius * 0.05;
      g.lineCap = 'round';
      g.stroke();
    });
  }

  // A few fixed dark, cracked scorch patches over the body -- positions are
  // derived from the boss's own seed so they're stable frame to frame
  // instead of re-rolled every draw.
  const CHAR_PATCHES = (() => {
    const patches = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.6;
      patches.push({ a, d: 0.35 + (i % 3) * 0.15, r: 0.22 + (i % 2) * 0.1 });
    }
    return patches;
  })();

  function drawBossBody(g, t) {
    const points = 14;
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = boss.radius + Math.sin(t * 0.004 + i * 1.7 + boss.seed) * (boss.radius * 0.05);
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    const grad = g.createRadialGradient(0, 0, boss.radius * 0.2, 0, 0, boss.radius);
    grad.addColorStop(0, '#7a1c14');
    grad.addColorStop(0.6, '#4a0f0a');
    grad.addColorStop(1, '#200705');
    g.fillStyle = grad;
    g.shadowColor = '#ff6a2a';
    g.shadowBlur = boss.radius * 0.4;
    g.fill();
    g.shadowBlur = 0;

    // charred, cracked scorch patches
    CHAR_PATCHES.forEach((cp) => {
      const cx = Math.cos(cp.a) * boss.radius * cp.d;
      const cy = Math.sin(cp.a) * boss.radius * cp.d;
      const r = boss.radius * cp.r;
      g.beginPath();
      for (let i = 0; i <= 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const pr = r * (0.75 + 0.25 * Math.sin(a * 3 + cp.a * 5));
        const px = cx + Math.cos(a) * pr, py = cy + Math.sin(a) * pr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(10,6,6,0.55)';
      g.fill();
      g.strokeStyle = 'rgba(255,120,40,0.25)';
      g.lineWidth = 1.5;
      g.stroke();
    });
  }

  function drawBossFlames(g, t) {
    const spots = 6;
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2 + boss.seed * 0.1;
      const bx = Math.cos(a) * boss.radius * 0.92;
      const by = Math.sin(a) * boss.radius * 0.92;
      const flicker = 0.8 + Math.sin(t * 0.02 + i * 3.1 + boss.seed) * 0.2;
      g.save();
      g.translate(bx, by);
      g.rotate(a - Math.PI / 2);
      for (let j = 0; j < 3; j++) {
        const wobble = Math.sin(t * 0.016 + i * 5 + j * 2) * (boss.radius * 0.04);
        const h = boss.radius * (0.5 + j * 0.16) * flicker;
        g.beginPath();
        g.moveTo(-boss.radius * 0.08 + j * 4, 4);
        g.quadraticCurveTo(boss.radius * 0.05 + wobble, -h * 0.55, wobble * 0.5, -h);
        g.quadraticCurveTo(-boss.radius * 0.05 + wobble, -h * 0.55, boss.radius * 0.08 - j * 4, 4);
        g.closePath();
        g.fillStyle = j === 0 ? '#ffe38a' : j === 1 ? '#ff9c3d' : '#e0541f';
        g.fill();
      }
      g.restore();
    }

    // rising embers -- a cheap, self-looping effect rather than a real
    // particle array, since it only ever needs to sit on the boss itself.
    for (let i = 0; i < 10; i++) {
      const seed = boss.seed * 7 + i * 971;
      const cycle = 2200 + (i % 4) * 400;
      const phase = ((t + seed) % cycle) / cycle;
      const ex = Math.sin(seed + phase * 6.2) * boss.radius * 0.8;
      const ey = boss.radius * 0.6 - phase * boss.radius * 2.4;
      const alpha = 1 - phase;
      g.beginPath();
      g.arc(ex, ey, 2 + (i % 3), 0, Math.PI * 2);
      g.fillStyle = `rgba(255,${140 + (i % 3) * 30},60,${alpha * 0.85})`;
      g.fill();
    }
  }

  function drawBossEye(g) {
    const lookDir = boss.lookDir;
    const eyeR = boss.radius * 0.4;

    const sclera = g.createRadialGradient(0, 0, 1, 0, 0, eyeR);
    sclera.addColorStop(0, '#f2e6d8');
    sclera.addColorStop(0.75, '#dcc4b2');
    sclera.addColorStop(1, '#7a6252');
    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.fillStyle = sclera;
    g.fill();

    g.save();
    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(170,25,25,0.4)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + boss.seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * eyeR, Math.sin(a) * eyeR * 0.8);
      g.lineTo(Math.cos(a) * eyeR * 0.1, Math.sin(a) * eyeR * 0.1);
      g.stroke();
    }
    g.restore();

    const ix = lookDir.x * eyeR * 0.32, iy = lookDir.y * eyeR * 0.26;
    const irisR = eyeR * 0.48;
    const iris = g.createRadialGradient(ix, iy, 1, ix, iy, irisR);
    iris.addColorStop(0, '#ffb43d');
    iris.addColorStop(0.6, '#a3390f');
    iris.addColorStop(1, '#200a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

    g.beginPath();
    g.arc(ix, iy, irisR * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#050202';
    g.fill();

    g.beginPath();
    g.arc(ix - irisR * 0.3, iy - irisR * 0.3, irisR * 0.16, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();

    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  function drawBoss(g, t) {
    g.save();
    g.translate(boss.x, boss.y);

    drawBossTentacles(g, t);
    drawBossBody(g, t);
    drawBossFlames(g, t);
    drawBossEye(g);

    if (t < boss.frozenUntil) {
      const points = 14;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = boss.radius + 6;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(140,220,255,0.4)';
      g.fill();
      g.strokeStyle = 'rgba(220,250,255,0.75)';
      g.lineWidth = 2;
      g.stroke();
    }

    g.restore();
  }

  function drawPlayers(g) {
    const R = PLAYER_RADIUS;
    players.forEach((p) => {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.facing.y, p.facing.x));

      // boots, peeking out from under the suit
      g.fillStyle = '#2b2b28';
      g.beginPath(); g.ellipse(-R * 0.9, -R * 0.35, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-R * 0.9, R * 0.35, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill();

      // oxygen tank + hose up to the collar
      g.strokeStyle = '#54544c';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-R * 1.3, -3);
      g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
      g.stroke();
      g.fillStyle = '#54544c';
      g.fillRect(-R * 1.5, -4.5, 7, 9);

      // bulky coverall body
      g.beginPath();
      g.ellipse(0, 0, R * 1.05, R * 0.95, 0, 0, Math.PI * 2);
      g.fillStyle = p.color;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1.5;
      g.stroke();

      // hazard chevron stripe across the chest
      g.save();
      g.beginPath();
      g.ellipse(0, 0, R * 1.05, R * 0.95, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(20,20,15,0.85)';
      g.fillRect(-R * 1.3, -R * 0.28, R * 2.6, R * 0.2);
      g.fillStyle = 'rgba(255,200,40,0.9)';
      g.fillRect(-R * 1.3, -R * 0.1, R * 2.6, R * 0.1);
      g.restore();

      // rubber gloves
      g.fillStyle = '#e8d94a';
      g.beginPath(); g.arc(-R * 0.15, -R * 0.95, 3.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(-R * 0.15, R * 0.95, 3.4, 0, Math.PI * 2); g.fill();

      // sealed collar ring
      g.beginPath();
      g.arc(0, 0, R * 0.8, 0, Math.PI * 2);
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 3;
      g.stroke();

      // helmet dome
      g.beginPath();
      g.arc(0, 0, R * 0.78, 0, Math.PI * 2);
      g.fillStyle = 'rgba(220,222,210,0.95)';
      g.fill();
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 1.5;
      g.stroke();

      // big face visor, facing forward
      g.beginPath();
      g.ellipse(R * 0.18, 0, R * 0.56, R * 0.44, 0, 0, Math.PI * 2);
      g.fillStyle = '#0d1418';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.ellipse(R * 0.28, -R * 0.14, R * 0.14, R * 0.08, -0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fill();

      g.restore();
    });
  }

  function punchLight(g, x, y, radius, intensity) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, radius, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function buildDarknessMask(camX, camY) {
    const worldToScreen = (wx, wy) => ({ x: wx - camX + VIEW_W / 2, y: wy - camY + VIEW_H / 2 });

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    const sz = LEVEL.safeZone;
    const s0 = worldToScreen(sz.x0 * TILE, sz.y0 * TILE);
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fillStyle = 'rgba(0,0,0,1)';
    maskCtx.fillRect(s0.x, s0.y, (sz.x1 - sz.x0 + 1) * TILE, (sz.y1 - sz.y0 + 1) * TILE);
    maskCtx.restore();

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 90, 1);
      punchLight(maskCtx, s.x, s.y, 230, 0.85);
    });

    fireLightPunches().forEach((fc) => {
      const s = worldToScreen(fc.x, fc.y);
      punchLight(maskCtx, s.x, s.y, 130, 0.75);
    });

    // the boss is on fire -- it lights up its own surroundings, giving
    // players a chance to spot the glow before they're close enough for
    // its own detection range to find them.
    const bs = worldToScreen(boss.x, boss.y);
    punchLight(maskCtx, bs.x, bs.y, boss.radius * 2.2, 0.6);
  }

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const camX = clamp(p.x, VIEW_W / 2, WORLD_W - VIEW_W / 2);
    const camY = clamp(p.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.fillStyle = '#050308';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);
    drawTiles(ctx, camX, camY);
    drawFires(ctx, now);
    drawBoss(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    drawFloatingTexts(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY);
    ctx.drawImage(maskCanvas, vx, 0);

    drawProximityWarning(vx, Math.hypot(p.x - boss.x, p.y - boss.y), now);
    drawRadar(vx, p, now);
    drawScanner(vx, p, now);
    drawMinimap(vx, now);

    if (p.caught) drawCutsceneOverlay(vx, p, now);

    ctx.restore();
  }

  function drawRadar(vx, p, now) {
    if (now > radarUntil) return;
    const cx = vx + VIEW_W - 34, cy = 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,25,15,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = 2;
    ctx.stroke();
    const angle = Math.atan2(boss.y - p.y, boss.x - p.x);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = '#3ddc84';
    ctx.shadowColor = '#3ddc84';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }

  function drawScanner(vx, p, now) {
    if (now > scannerUntil) return;
    const target = nearestUnpressedButton(p.x, p.y);
    if (!target) return;
    const cx = vx + VIEW_W - 34, cy = VIEW_H - 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35,25,5,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#ffb43d';
    ctx.lineWidth = 2;
    ctx.stroke();
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffb43d';
    ctx.shadowColor = '#ffb43d';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }

  const PROXIMITY_WARNING_RADIUS = 500;

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    const alpha = closeness * 0.6 * pulse;
    ctx.fillStyle = `rgba(200,20,20,${alpha})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
  }

  // A short "gotcha" cutscene rendered only in the caught player's own half:
  // the screen reddens and shakes while a jagged pair of jaws close in from
  // the top and bottom edges, meeting in the middle right as the bite lands.
  function drawJaw(g, vx, direction, progress, color) {
    const teeth = 8;
    const toothW = VIEW_W / teeth;
    const reach = progress * (VIEW_H / 2 + 24);
    g.fillStyle = color;
    g.beginPath();
    if (direction === 1) {
      g.moveTo(vx, 0);
      g.lineTo(vx + VIEW_W, 0);
      g.lineTo(vx + VIEW_W, Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) {
        const x = vx + i * toothW;
        const y = reach + (i % 2 === 0 ? 14 : -6);
        g.lineTo(x, y);
      }
      g.lineTo(vx, 0);
    } else {
      g.moveTo(vx, VIEW_H);
      g.lineTo(vx + VIEW_W, VIEW_H);
      g.lineTo(vx + VIEW_W, VIEW_H - Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) {
        const x = vx + i * toothW;
        const y = VIEW_H - reach - (i % 2 === 0 ? 14 : -6);
        g.lineTo(x, y);
      }
      g.lineTo(vx, VIEW_H);
    }
    g.closePath();
    g.fill();
  }

  function drawCutsceneOverlay(vx, p, now) {
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);
    const jawProgress = clamp(t / 0.75, 0, 1);

    ctx.save();
    ctx.fillStyle = `rgba(50,0,0,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    const shake = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawJaw(ctx, vx, 1, jawProgress, '#3a0d16');
    drawJaw(ctx, vx, -1, jawProgress, '#2a0810');

    if (t > 0.6) {
      const flash = clamp((t - 0.6) / 0.15, 0, 1) * (1 - clamp((t - 0.85) / 0.15, 0, 1));
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
  }

  function drawDivider() {
    ctx.strokeStyle = '#3a2a44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIEW_W, 0);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.stroke();
  }

  function updateOverlay() {
    if (gameState === 'complete') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE FIRE GOES OUT &mdash; press Enter to replay, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    const pressedCount = buttonsPressed.filter(Boolean).length;
    hudButtonsEl.textContent = `Buttons: ${pressedCount} / ${LEVEL.buttons.length}`;
    hudButtonsEl.classList.toggle('done', pressedCount === LEVEL.buttons.length);
    hudDoorEl.textContent = `Door: ${doorUnlocked ? 'open' : 'locked'}`;
    hudDoorEl.classList.toggle('done', doorUnlocked);
  }

  let lastFrameTime = null;

  function loop(now) {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'playing') {
      updateInputMovement(dt);
      updateTriggers();
      updateCrates(now);
      updateBoss(now, dt);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
      updateSafeMusic(players.some(isInSafeZone));
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    renderViewport(1, now);
    drawDivider();

    if (catchFlash > 0) {
      ctx.fillStyle = `rgba(180,20,30,${catchFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      catchFlash -= dt * 1.2;
    }

    updateOverlay();
    updateHud();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
