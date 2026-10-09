(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(18)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL18;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;

  // Speeds are px/second and movement is scaled by the real elapsed time
  // each frame (see `dt` in loop()) rather than a fixed px/frame step.
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;
  // The eel roams slower than a player, but charges much faster once it's
  // spotted someone -- a patrol/alert split, same state machine as every
  // other sight-based creature on this site, just with these two speeds.
  const EEL_ROAM_SPEED = PLAYER_SPEED * 0.6;
  const EEL_CHARGE_SPEED = PLAYER_SPEED * 1.8;
  const LURE_SPEED = PLAYER_SPEED * 0.6;
  const CATCH_RADIUS = 22;
  const REPATH_MS = 500;
  const ALERT_GRACE_MS = 3000;
  const DETECT_RADIUS = 130; // open water -- a longer sight line than a cramped hall
  const WHEEL_HOLD_MS = 10000;
  const RADAR_DURATION_MS = 10000;
  const ENERGY_DURATION_MS = 10000;
  const SCANNER_DURATION_MS = 10000;
  const FREEZE_DURATION_MS = 10000;
  const EAT_DURATION_MS = 3000;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const SUPER_RADAR_DURATION_MS = 10000;
  const SMOKE_FUSE_MS = 3000;
  const SMOKE_DURATION_MS = 10000;
  const SMOKE_RADIUS = 70;
  const DECOY_SPEED = PLAYER_SPEED * 0.8;
  const DECOY_CATCH_RADIUS = 24;
  const NVG_DURATION_MS = 10000;
  const NVG_RANGE_MULT = 2;
  const CRATE_ITEMS = ['radar', 'meat', 'co2', 'scanner', 'super-radar', 'smoke', 'decoy', 'nightvision', 'shotgun-ammo', 'energy'];
  const SHOTGUN_STUN_MS = 5000;
  const SHOTGUN_AMMO_MAX = 3;
  const SHOTGUN_RANGE = 70;

  // ---- sprint / stamina ----
  const DOUBLE_TAP_MS = 300;
  const STAMINA_MAX = 15; // seconds of sprint fuel
  const SPRINT_SPEED_MULT = 2;
  const EXHAUSTED_SPEED_MULT = 0.5;
  const SPRINT_DRAIN_RATE = STAMINA_MAX / 15; // empties over 15s of continuous sprint
  const EXHAUSTED_MS = 5000;
  const EXHAUSTED_REGEN_RATE = (STAMINA_MAX / 2) / (EXHAUSTED_MS / 1000); // refills to half over the 5s penalty
  const NORMAL_REGEN_RATE = EXHAUSTED_REGEN_RATE / 2; // half that rate while just walking
  const WALK_CYCLE_SPEED = 9; // radians/second the walk-cycle phase advances at 1x speed
  // The eel's body: a long, slim trail of segments tapering to a point,
  // slimmer than the armored caterpillars elsewhere on this site.
  const EEL_SEGMENT_COUNT = 16;
  const EEL_SEGMENT_SPACING = 24;
  const EEL_RADIUS = 15;

  // Ripples spawn at a moving player's feet and expand outward, fading as
  // they go -- purely cosmetic, reused for the eel's own wake too.
  const RIPPLE_INTERVAL_MS = 260;
  const RIPPLE_LIFE_MS = 900;
  const RIPPLE_MAX_RADIUS = 20;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

  const exploredCanvas = document.createElement('canvas');
  exploredCanvas.width = COLS;
  exploredCanvas.height = ROWS;
  const exploredCtx = exploredCanvas.getContext('2d');
  let explored = new Uint8Array(COLS * ROWS);
  const EXPLORE_RADIUS = 7;
  const MINIMAP_W = 90;

  const hudWheelEl = document.getElementById('hud-wheel');
  const hudDoorEl = document.getElementById('hud-door');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let musicMasterGain = null; // both the ambient drone and the safe-room pad route through this
  let musicEnabled = false;
  let ambientGain = null;
  let ambientSubOsc = null;
  let ambientMidGain = null;
  let safeMusicGain = null;
  let safeGlitchGain = null;
  let safeVoices = [];

  function makeBitcrushCurve(steps) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

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

    // Same layered-drone ambient bed as every other level, but the lowpass
    // sits lower and the whole thing breathes a little slower -- a muffled,
    // underwater character instead of a dry hallway drone.
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.05;
    ambientGain.connect(musicMasterGain);

    const ambientFilter = audioCtx.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = 230;
    ambientFilter.Q.value = 0.6;
    ambientFilter.connect(ambientGain);

    const filterLfo = audioCtx.createOscillator();
    filterLfo.frequency.value = 0.045;
    const filterLfoGain = audioCtx.createGain();
    filterLfoGain.gain.value = 70;
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

    ambientSubOsc = addDroneVoice(38.5, 'sine', 0.6, 0.04, 1.2).osc; // low foundation
    addDroneVoice(40.9, 'sine', 0.5, 0.06, 1.6); // slow beat against the foundation
    addDroneVoice(19.3, 'sine', 0.4, 0.03, 0.7); // sub-octave rumble
    ambientMidGain = addDroneVoice(91, 'sawtooth', 0, 0.12, 5).gain; // dissonant edge, fades in with tension
    addDroneVoice(540, 'triangle', 0.04, 0.02, 30); // faint distant ringing

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

  function playItemChime(freq) {
    playTone(freq, 0.25, 'square', 0.18);
  }

  function playDoorUnlockChime() {
    playTone(440, 0.2, 'triangle', 0.22, 0);
    playTone(660, 0.2, 'triangle', 0.22, 0.12);
    playTone(880, 0.3, 'triangle', 0.22, 0.24);
  }

  // A short buzzy welding-torch crackle (a harsh sawtooth flickering
  // between frequencies like an unsteady arc) finishing in a clean,
  // satisfied chime -- the sound of sealing a pipe shut, not a wet
  // valve-wheel clunk.
  function playWeldComplete() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const buzz = audioCtx.createOscillator();
    const buzzGain = audioCtx.createGain();
    buzz.type = 'sawtooth';
    buzzGain.gain.setValueAtTime(0.0001, start);
    buzzGain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
    buzzGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    buzz.connect(buzzGain);
    buzzGain.connect(audioCtx.destination);
    for (let i = 0; i < 6; i++) {
      buzz.frequency.setValueAtTime(180 + Math.random() * 220, start + i * 0.045);
    }
    buzz.start(start);
    buzz.stop(start + 0.32);

    playTone(880, 0.2, 'triangle', 0.2, 0.3);
    playTone(1320, 0.25, 'triangle', 0.18, 0.38);
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

  function playShotgunBlast() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(1800, start);
    crack.frequency.exponentialRampToValueAtTime(200, start + 0.08);
    crackGain.gain.setValueAtTime(0.3, start);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(start);
    crack.stop(start + 0.12);
    playChompThud(0.02);
  }

  function playWinJingle() {
    [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14));
  }

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.min(...players.map((p) => Math.hypot(p.x - monster.x, p.y - monster.y)));
    const proximity = clamp(1 - minDist / 380, 0, 1);
    ambientGain.gain.setTargetAtTime(0.05 + proximity * 0.18, audioCtx.currentTime, 0.3);
    ambientSubOsc.frequency.setTargetAtTime(38.5 + proximity * 11, audioCtx.currentTime, 0.3);
    ambientMidGain.gain.setTargetAtTime(proximity * 0.06, audioCtx.currentTime, 0.4);
  }

  function setMusicEnabled(on) {
    musicEnabled = on;
    ensureAudio();
    if (audioCtx && musicMasterGain) {
      musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
    }
  }

  const soundHintEl = document.getElementById('sound-hint');
  function updateSoundHint() {
    if (soundHintEl) soundHintEl.style.display = musicEnabled ? '' : 'none';
  }

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

  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const keys = {};

  const lastTapTime = [{}, {}];
  function handleMovementKeyPress(key, now) {
    const playerIndex = (key === 'w' || key === 'a' || key === 's' || key === 'd') ? 0 : 1;
    const last = lastTapTime[playerIndex][key] || 0;
    if (now - last < DOUBLE_TAP_MS) {
      const p = players[playerIndex];
      if (p.moveState !== 'exhausted' && p.stamina > 0) {
        p.sprintActive = true;
      }
    }
    lastTapTime[playerIndex][key] = now;
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (TRACKED_KEYS.has(e.key)) {
      if (!keys[e.key]) handleMovementKeyPress(e.key, performance.now());
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

  // A handful of near-identical deep blues, picked per-tile by hashing
  // its coordinates, so the flooded floor reads as moving, uneven water
  // instead of one flat color -- a clear blue, unlike the sickly greens
  // of the other two flood levels.
  const WATER_SHADES = ['#143c5c', '#184468', '#123354', '#1a4a70', '#0f3050', '#164060'];
  function floorShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % WATER_SHADES.length;
    return WATER_SHADES[idx];
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clampC = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clampC(((n >> 16) & 255) + 255 * amt);
    const g2 = clampC(((n >> 8) & 255) + 255 * amt);
    const b = clampC((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  // ---- game state ----

  const BEST_TIME_KEY = 'goofy-horror-best-level18';
  let bestMs = (() => {
    const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(v) ? v : null;
  })();
  let runStartTime = performance.now();
  let elapsedMs = 0;
  let bestRecorded = false;

  function formatTime(ms) {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  // The two pressure plates and the giant wheel they turn, straight from
  // the level data rather than scanned off the grid -- unlike the pipes
  // on Level 17, a plate's own tile char doesn't need to be unique per
  // instance since there are only ever exactly 2 of them.
  const PLATE_POSITIONS = LEVEL.pressurePlates;
  let wheelHeldMs = 0;
  let wheelSolved = false;

  // A pipe mounted to a wall points away from whichever side it's
  // actually flush against -- found by checking its own tile's 4
  // neighbors for '#', not guessed from room geometry.
  function pipeWallDir(tx, ty) {
    if (tileChar(tx - 1, ty) === '#') return { x: 1, y: 0 };
    if (tileChar(tx + 1, ty) === '#') return { x: -1, y: 0 };
    if (tileChar(tx, ty - 1) === '#') return { x: 0, y: 1 };
    if (tileChar(tx, ty + 1) === '#') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }

  // Purely decorative pipes ringing the giant pipe room's own walls --
  // every few tiles around its interior perimeter, each oriented away
  // from whichever wall it's actually mounted on.
  const HUB_WALL_PIPES = (() => {
    const hb = LEVEL.hubBounds;
    const spots = [];
    const addIfFloor = (x, y) => {
      if (tileChar(x, y) === '#') return;
      spots.push({ x, y, dir: pipeWallDir(x, y) });
    };
    for (let x = hb.x0 + 1; x < hb.x1; x += 3) {
      addIfFloor(x, hb.y0);
      addIfFloor(x, hb.y1);
    }
    for (let y = hb.y0 + 1; y < hb.y1; y += 3) {
      addIfFloor(hb.x0, y);
      addIfFloor(hb.x1, y);
    }
    return spots;
  })();

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
      shotgunAmmo: 0,
      nextRippleAt: 0,
    };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  const monster = {
    x: 0,
    y: 0,
    radius: EEL_RADIUS,
    seed: Math.random() * 100,
    path: [],
    pathIndex: 0,
    nextRepathAt: 0,
    lookDir: { x: 1, y: 0 },
    state: 'patrol', // 'patrol' | 'alert'
    alertUntil: 0,
    alertTargetTile: null,
    patrolIndex: 0,
    frozenUntil: 0,
    luredState: 'none', // 'none' | 'lured' | 'eating'
    lureTarget: null,
    eatingUntil: 0,
    trail: [],
    segments: [],
    nextRippleAt: 0,
  };

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let superRadarUntil = 0;
  let smokeBombs = [];
  let decoy = null; // { x, y, angle, turnAt }
  let nvgUntil = 0;
  let floatingTexts = [];
  let waterRipples = []; // { x, y, bornAt }

  // Ambient wildlife, purely decorative -- small/medium/large fish
  // wandering the open water, never interactive, never blocking anything.
  const FISH_COUNT = 16;
  let fish = []; // { x, y, angle, radius, speed, turnAt }

  function spawnFish() {
    fish = [];
    const openTiles = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isWallForPlayer(x, y)) openTiles.push({ x, y });
      }
    }
    for (let i = 0; i < FISH_COUNT && openTiles.length; i++) {
      const t = openTiles[Math.floor(Math.random() * openTiles.length)];
      const c = tileCenter(t.x, t.y);
      const roll = Math.random();
      const radius = roll < 0.5 ? 4 : roll < 0.85 ? 7 : 11;
      const speed = radius <= 4 ? 55 : radius <= 7 ? 38 : 24;
      fish.push({ x: c.x, y: c.y, angle: Math.random() * Math.PI * 2, radius, speed, turnAt: 0 });
    }
  }

  function updateFish(now, dt) {
    fish.forEach((f) => {
      if (now > f.turnAt) {
        f.angle += (Math.random() - 0.5) * 2.2;
        f.turnAt = now + 1200 + Math.random() * 2200;
      }
      const dx = Math.cos(f.angle) * f.speed * dt;
      const dy = Math.sin(f.angle) * f.speed * dt;
      if (canStandAt(f.x + dx, f.y)) f.x += dx; else f.angle = Math.PI - f.angle;
      if (canStandAt(f.x, f.y + dy)) f.y += dy; else f.angle = -f.angle;
    });
  }

  // Silhouette only -- a flat dark shape with no color or gradient
  // detail, read as a shadow glimpsed in the water rather than a fully
  // rendered creature.
  function drawFish(g) {
    fish.forEach((f) => {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.angle);
      g.fillStyle = 'rgba(4,6,10,0.55)';
      g.beginPath();
      g.ellipse(0, 0, f.radius * 1.5, f.radius * 0.6, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-f.radius * 1.3, 0);
      g.lineTo(-f.radius * 2.3, -f.radius * 0.75);
      g.lineTo(-f.radius * 2.3, f.radius * 0.75);
      g.closePath();
      g.fill();
      g.restore();
    });
  }

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  function resetLevel() {
    players.forEach((p) => {
      respawnPlayer(p);
      p.caught = false;
      p.caughtAt = 0;
      p.invulnerableUntil = 0;
      p.stamina = STAMINA_MAX;
      p.moveState = 'normal';
      p.exhaustedUntil = 0;
      p.sprintActive = false;
      p.shotgunAmmo = 0;
      p.nextRippleAt = 0;
    });

    const m = tileCenter(LEVEL.monsterSpawn.x, LEVEL.monsterSpawn.y);
    monster.x = m.x; monster.y = m.y;
    monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
    monster.state = 'patrol'; monster.alertUntil = 0; monster.alertTargetTile = null; monster.patrolIndex = 0;
    monster.frozenUntil = 0; monster.luredState = 'none'; monster.lureTarget = null; monster.eatingUntil = 0;
    monster.trail = []; monster.segments = []; monster.nextRippleAt = 0;

    wheelHeldMs = 0;
    wheelSolved = false;
    doorUnlocked = false;

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)], opened: false, openedAt: 0,
    }));
    radarUntil = 0;
    energyUntil = 0;
    scannerUntil = 0;
    superRadarUntil = 0;
    smokeBombs = [];
    decoy = null;
    nvgUntil = 0;
    floatingTexts = [];
    waterRipples = [];
    spawnFish();
    resetExploration();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
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

  function updateStamina(p, now, dt, isMoving) {
    if (now < energyUntil) {
      p.moveState = (p.sprintActive && isMoving) ? 'sprinting' : 'normal';
      p.stamina = STAMINA_MAX;
      if (!isMoving) p.sprintActive = false;
      return;
    }
    if (p.moveState === 'exhausted') {
      p.stamina = Math.min(STAMINA_MAX, p.stamina + EXHAUSTED_REGEN_RATE * dt);
      if (now >= p.exhaustedUntil) p.moveState = 'normal';
      return;
    }
    if (p.sprintActive && isMoving && p.stamina > 0) {
      p.moveState = 'sprinting';
      p.stamina = Math.max(0, p.stamina - SPRINT_DRAIN_RATE * dt);
      if (p.stamina <= 0) {
        p.moveState = 'exhausted';
        p.exhaustedUntil = now + EXHAUSTED_MS;
        p.sprintActive = false;
      }
    } else {
      p.moveState = 'normal';
      if (!isMoving) p.sprintActive = false;
      p.stamina = Math.min(STAMINA_MAX, p.stamina + NORMAL_REGEN_RATE * dt);
    }
  }

  function speedMultiplierFor(p) {
    if (p.moveState === 'exhausted') return EXHAUSTED_SPEED_MULT;
    if (p.moveState === 'sprinting') return SPRINT_SPEED_MULT;
    return 1;
  }

  function applyMovement(p, ix, iy, dt) {
    if (p.caught) return;
    if (ix !== 0 || iy !== 0) {
      const len = Math.hypot(ix, iy);
      const nx = ix / len, ny = iy / len;
      p.facing = { x: nx, y: ny };
      const speed = PLAYER_SPEED * speedMultiplierFor(p);
      movePlayer(p, nx * speed * dt, ny * speed * dt);
    }
  }

  function spawnRipple(x, y) {
    waterRipples.push({ x, y, bornAt: performance.now() });
    if (waterRipples.length > 60) waterRipples.shift();
  }

  function updatePlayerMovement(p, ix, iy, now, dt) {
    const isMoving = !p.caught && (ix !== 0 || iy !== 0);
    updateStamina(p, now, dt, isMoving);
    applyMovement(p, ix, iy, dt);
    if (isMoving) {
      p.walkPhase += dt * WALK_CYCLE_SPEED * speedMultiplierFor(p);
      if (now >= p.nextRippleAt) {
        spawnRipple(p.x, p.y + PLAYER_RADIUS * 0.8);
        p.nextRippleAt = now + RIPPLE_INTERVAL_MS;
      }
    }
  }

  function updateInputMovement(now, dt) {
    updatePlayerMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), now, dt);
    updatePlayerMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), now, dt);
  }

  function isInSafeZone(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  // The scanner just points at the giant wheel itself -- once it's
  // solved there's nothing left to point at.
  function scannerTarget() {
    if (wheelSolved) return null;
    return tileCenter(LEVEL.wheel.x, LEVEL.wheel.y);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#8f8f9a';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'Q') return '#ffb347';
    return '#163a56';
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
    if (now < superRadarUntil) {
      const px = mx + (monster.x / WORLD_W) * MINIMAP_W;
      const py = my + (monster.y / WORLD_H) * mh;
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4d6d';
      ctx.shadowColor = '#ff4d6d';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    players.forEach((pl) => {
      const px = mx + (pl.x / WORLD_W) * MINIMAP_W;
      const py = my + (pl.y / WORLD_H) * mh;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pl.color;
      ctx.fill();
    });
    ctx.restore();
    return mh;
  }

  function drawStaminaBar(vx, p, minimapH) {
    const barW = MINIMAP_W, barH = 7;
    const bx = vx + 8, by = 8 + minimapH + 8;
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.65)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#202225';
    ctx.fillRect(bx, by, barW, barH);
    const frac = clamp(p.stamina / STAMINA_MAX, 0, 1);
    const color = performance.now() < energyUntil ? '#ffe27a'
      : p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, barW * frac, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
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

  function applyItemEffect(item, x, y, now, p) {
    if (item === 'radar') {
      radarUntil = now + RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'RADAR');
      playItemChime(880);
    } else if (item === 'meat') {
      monster.luredState = 'lured';
      monster.lureTarget = { x, y };
      monster.path = []; monster.pathIndex = 0;
      spawnFloatingText(x, y, 'BAIT');
      playItemChime(220);
    } else if (item === 'co2') {
      monster.frozenUntil = now + FREEZE_DURATION_MS;
      spawnFloatingText(x, y, 'FROZEN');
      playItemChime(1200);
    } else if (item === 'scanner') {
      scannerUntil = now + SCANNER_DURATION_MS;
      spawnFloatingText(x, y, 'SCANNER');
      playItemChime(660);
    } else if (item === 'super-radar') {
      superRadarUntil = now + SUPER_RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'SUPER-RADAR');
      playItemChime(1400);
    } else if (item === 'smoke') {
      smokeBombs.push({ x, y, armAt: now + SMOKE_FUSE_MS, exploded: false, endsAt: 0 });
      spawnFloatingText(x, y, 'SMOKE BOMB');
      playItemChime(500);
    } else if (item === 'decoy') {
      decoy = { x, y, angle: Math.random() * Math.PI * 2, turnAt: 0 };
      spawnFloatingText(x, y, 'DECOY');
      playItemChime(340);
    } else if (item === 'nightvision') {
      nvgUntil = now + NVG_DURATION_MS;
      spawnFloatingText(x, y, 'NIGHT VISION');
      playItemChime(1000);
    } else if (item === 'shotgun-ammo') {
      if (p.shotgunAmmo < SHOTGUN_AMMO_MAX) {
        p.shotgunAmmo++;
        spawnFloatingText(x, y, `SHOTGUN LOADED (${p.shotgunAmmo}/${SHOTGUN_AMMO_MAX})`);
        playItemChime(760);
      } else {
        spawnFloatingText(x, y, 'AMMO FULL');
      }
    } else if (item === 'energy') {
      energyUntil = now + ENERGY_DURATION_MS;
      spawnFloatingText(x, y, 'ENERGY');
      playItemChime(900);
    }
  }

  function isInSmoke(p, now) {
    return smokeBombs.some((b) => b.exploded && now < b.endsAt && Math.hypot(p.x - b.x, p.y - b.y) < SMOKE_RADIUS);
  }

  function updateDecoy(now, dt) {
    if (!decoy) return;
    if (now > decoy.turnAt) {
      decoy.angle += (Math.random() - 0.5) * 2.2;
      decoy.turnAt = now + 500 + Math.random() * 900;
    }
    const step = DECOY_SPEED * dt;
    const dx = Math.cos(decoy.angle) * step, dy = Math.sin(decoy.angle) * step;
    if (canStandAt(decoy.x + dx, decoy.y)) decoy.x += dx; else decoy.angle = Math.PI - decoy.angle;
    if (canStandAt(decoy.x, decoy.y + dy)) decoy.y += dy; else decoy.angle = -decoy.angle;

    monster.luredState = 'lured';
    monster.lureTarget = { x: decoy.x, y: decoy.y };

    if (Math.hypot(monster.x - decoy.x, monster.y - decoy.y) < DECOY_CATCH_RADIUS) {
      spawnFloatingText(decoy.x, decoy.y, 'CAUGHT!');
      decoy = null;
      monster.luredState = 'none'; monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
    }
  }

  function updateSmokeBombs(now) {
    smokeBombs.forEach((b) => {
      if (b.exploded || now < b.armAt) return;
      b.exploded = true;
      b.endsAt = now + SMOKE_DURATION_MS;
      playItemChime(180);
    });
    smokeBombs = smokeBombs.filter((b) => !b.exploded || now < b.endsAt);
  }

  function drawSmokeBombs(g, now) {
    smokeBombs.forEach((b) => {
      if (!b.exploded) {
        const t = clamp(1 - (b.armAt - now) / SMOKE_FUSE_MS, 0, 1);
        g.beginPath();
        g.arc(b.x, b.y, 5 + t * 4, 0, Math.PI * 2);
        g.fillStyle = 'rgba(200,200,200,0.6)';
        g.fill();
        return;
      }
      const life = clamp((b.endsAt - now) / SMOKE_DURATION_MS, 0, 1);
      const elapsed = SMOKE_DURATION_MS - (b.endsAt - now);
      const radius = SMOKE_RADIUS * Math.min(1, Math.max(0, elapsed) / 800);
      g.beginPath();
      g.arc(b.x, b.y, radius, 0, Math.PI * 2);
      g.fillStyle = `rgba(210,210,220,${0.32 * life})`;
      g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.25 * life})`;
      g.lineWidth = 2;
      g.stroke();
    });
  }

  function drawDecoy(g, now) {
    if (!decoy) return;
    const pulse = 0.6 + 0.4 * Math.sin(now / 130);
    g.save();
    g.translate(decoy.x, decoy.y);
    g.beginPath();
    g.arc(0, 0, 10 + pulse * 2, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,220,80,0.35)';
    g.fill();
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fillStyle = '#ffd84d';
    g.shadowColor = '#ffd84d';
    g.shadowBlur = 8;
    g.fill();
    g.shadowBlur = 0;
    g.restore();
  }

  function updateCrates(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      crates.forEach((c) => {
        if (c.opened) return;
        if (c.x === t.x && c.y === t.y) {
          c.opened = true;
          c.openedAt = now;
          applyItemEffect(c.item, tileCenter(c.x, c.y).x, tileCenter(c.x, c.y).y, now, p);
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

  // Both players have to stand on their own pressure plate -- two
  // separate tiles, far enough apart that one player physically can't
  // cover both -- at the same time to hold the giant wheel turning.
  // Either one stepping off (or getting caught) drains the held time
  // back down at twice the fill rate, same fill/drain convention as
  // every other hold-mechanic on this site, so a quick tag-team shuffle
  // between the two plates doesn't work -- it has to be held together.
  function updateWheel(now, dt) {
    if (wheelSolved) return;
    const bothHolding = PLATE_POSITIONS.every((plate) => players.some((p) => {
      if (p.caught) return false;
      const t = worldToTile(p.x, p.y);
      return t.x === plate.x && t.y === plate.y;
    }));
    if (bothHolding) {
      wheelHeldMs = Math.min(WHEEL_HOLD_MS, wheelHeldMs + dt * 1000);
      if (wheelHeldMs >= WHEEL_HOLD_MS) {
        wheelSolved = true;
        doorUnlocked = true;
        playDoorUnlockChime();
        const c = tileCenter(LEVEL.wheel.x, LEVEL.wheel.y);
        spawnFloatingText(c.x, c.y, 'WHEEL TURNED');
      }
    } else {
      wheelHeldMs = Math.max(0, wheelHeldMs - dt * 1000 * 2);
    }
  }

  function updateTriggers() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);
      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
        if (window.GoofyStory) window.GoofyStory.completeLevel(18);
      }
    });
  }

  // ---- monster AI ----
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
      if (p.caught || isInSafeZone(p) || isInSmoke(p, now)) continue;
      const d = Math.hypot(p.x - monster.x, p.y - monster.y);
      if (d <= DETECT_RADIUS && hasLineOfSight(monster.x, monster.y, p.x, p.y)) {
        monster.state = 'alert';
        monster.alertUntil = now + ALERT_GRACE_MS;
        monster.alertTargetTile = worldToTile(p.x, p.y);
      }
    }
    if (monster.state === 'alert' && now >= monster.alertUntil) {
      monster.state = 'patrol';
      monster.path = [];
      monster.pathIndex = 0;
    }
  }

  function wallOffsetDir(tx, ty) {
    let dx = 0, dy = 0;
    if (tileChar(tx - 1, ty) === '#') dx += 1;
    if (tileChar(tx + 1, ty) === '#') dx -= 1;
    if (tileChar(tx, ty - 1) === '#') dy += 1;
    if (tileChar(tx, ty + 1) === '#') dy -= 1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  function tileTargetWithOffset(t) {
    const c = tileCenter(t.x, t.y);
    const off = wallOffsetDir(t.x, t.y);
    return { x: c.x + off.x * 10, y: c.y + off.y * 10 };
  }

  function updateEelSegments(m, now) {
    m.trail.unshift({ x: m.x, y: m.y });
    if (m.trail.length > 600) m.trail.length = 600;
    const segPositions = [];
    let distAccum = 0;
    let targetDist = EEL_SEGMENT_SPACING;
    let segIndex = 0;
    for (let i = 1; i < m.trail.length && segIndex < EEL_SEGMENT_COUNT; i++) {
      const a = m.trail[i - 1], b = m.trail[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      while (distAccum + segLen >= targetDist && segIndex < EEL_SEGMENT_COUNT) {
        const t = segLen > 0.0001 ? (targetDist - distAccum) / segLen : 0;
        segPositions.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        segIndex++;
        targetDist += EEL_SEGMENT_SPACING;
      }
      distAccum += segLen;
    }
    const last = m.trail[m.trail.length - 1] || { x: m.x, y: m.y };
    while (segPositions.length < EEL_SEGMENT_COUNT) segPositions.push(last);
    m.segments = segPositions;

    if (now >= m.nextRippleAt) {
      spawnRipple(m.x, m.y);
      m.nextRippleAt = now + RIPPLE_INTERVAL_MS;
    }
  }

  function updateMonster(now, dt) {
    if (now < monster.frozenUntil) { updateEelSegments(monster, now); return; }

    if (monster.luredState === 'eating') {
      if (now >= monster.eatingUntil) {
        monster.luredState = 'none';
        monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
      } else {
        updateEelSegments(monster, now);
        return;
      }
    }

    if (monster.luredState === 'lured') {
      if (now >= monster.nextRepathAt) {
        monster.nextRepathAt = now + REPATH_MS;
        const startTile = worldToTile(monster.x, monster.y);
        const goalTile = worldToTile(monster.lureTarget.x, monster.lureTarget.y);
        const graph = buildMonsterGraph();
        const path = bfsPath(graph, startTile, goalTile);
        monster.path = path && path.length > 1 ? path.slice(1) : [];
        monster.pathIndex = 0;
      }
      if (monster.path && monster.pathIndex < monster.path.length) {
        const step = LURE_SPEED * dt;
        const target = tileTargetWithOffset(monster.path[monster.pathIndex]);
        const dx = target.x - monster.x, dy = target.y - monster.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) monster.lookDir = { x: dx / d, y: dy / d };
        if (d < step) {
          monster.x = target.x; monster.y = target.y;
          monster.pathIndex++;
        } else {
          monster.x += (dx / d) * step;
          monster.y += (dy / d) * step;
        }
      } else {
        monster.luredState = 'eating';
        monster.eatingUntil = now + EAT_DURATION_MS;
      }
      updateEelSegments(monster, now);
      return;
    }

    updateDetection(now);

    if (now >= monster.nextRepathAt) {
      monster.nextRepathAt = now + REPATH_MS;
      const startTile = worldToTile(monster.x, monster.y);
      const goalTile = monster.state === 'alert' ? monster.alertTargetTile : LEVEL.patrolPoints[monster.patrolIndex];
      const graph = buildMonsterGraph();
      const path = bfsPath(graph, startTile, goalTile);
      if (path && path.length > 1) {
        monster.path = path.slice(1);
        monster.pathIndex = 0;
      } else {
        monster.path = [];
        monster.pathIndex = 0;
        if (monster.state === 'patrol') {
          monster.patrolIndex = (monster.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      }
    }

    const speed = monster.state === 'alert' ? EEL_CHARGE_SPEED : EEL_ROAM_SPEED;
    if (monster.path && monster.pathIndex < monster.path.length) {
      const step = speed * dt;
      const target = tileTargetWithOffset(monster.path[monster.pathIndex]);
      const dx = target.x - monster.x, dy = target.y - monster.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) monster.lookDir = { x: dx / d, y: dy / d };
      if (d < step) {
        monster.x = target.x; monster.y = target.y;
        monster.pathIndex++;
        if (monster.pathIndex >= monster.path.length && monster.state === 'patrol') {
          monster.patrolIndex = (monster.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      } else {
        monster.x += (dx / d) * step;
        monster.y += (dy / d) * step;
      }
    }

    updateEelSegments(monster, now);
  }

  // A last-ditch defense, not a weapon you aim and fire: carrying a shell
  // and getting close to something actively hunting you sets it off
  // automatically. Checked ahead of updateCatch so a stun this same frame
  // can still save a player who'd otherwise be caught on it.
  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught) return;
      if (p.shotgunAmmo <= 0) return;
      if (now < monster.frozenUntil || monster.state !== 'alert') return;
      if (Math.hypot(p.x - monster.x, p.y - monster.y) < SHOTGUN_RANGE) {
        monster.frozenUntil = now + SHOTGUN_STUN_MS;
        p.shotgunAmmo--;
        spawnFloatingText(monster.x, monster.y, 'STUNNED!');
        playShotgunBlast();
      }
    });
  }

  function updateCatch(now) {
    if (now < monster.frozenUntil) return;
    if (monster.luredState !== 'none') return;
    if (monster.state !== 'alert') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (isInSafeZone(p) || isInSmoke(p, now)) return;
      if (now < p.invulnerableUntil) return;
      if (Math.hypot(p.x - monster.x, p.y - monster.y) < CATCH_RADIUS) triggerCaught(p, now);
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

  // ---- water ripples (player wake + eel wake) ----
  function updateWaterRipples(now) {
    waterRipples = waterRipples.filter((r) => now - r.bornAt < RIPPLE_LIFE_MS);
  }

  function drawWaterRipples(g, now) {
    waterRipples.forEach((r) => {
      // Floored at 0 -- a ripple's bornAt (performance.now()) can land a
      // touch ahead of this frame's rAF timestamp, briefly going negative,
      // and arc() throws on a negative radius.
      const t = Math.max(0, (now - r.bornAt) / RIPPLE_LIFE_MS);
      const radius = t * RIPPLE_MAX_RADIUS;
      const alpha = (1 - t) * 0.35;
      g.beginPath();
      g.arc(r.x, r.y, radius, 0, Math.PI * 2);
      g.strokeStyle = `rgba(200,235,195,${alpha})`;
      g.lineWidth = 1.4;
      g.stroke();
    });
  }

  // ---- rendering ----
  const doorBounds = (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (LEVEL.grid[y][x] === 'D') {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y);
          x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    }
    return { x0, y0, x1, y1 };
  })();

  // A small branching coral clump -- a fixed base position per tile
  // (hashed, like the floor shading), 2-4 colorful branches radiating
  // up from it with a soft sway, each tipped with a small round polyp.
  const CORAL_PALETTE = ['#ff8a5c', '#ff6fa5', '#b985ff', '#ffb347'];
  function drawCoral(g, px, py, x, y, t) {
    const h = Math.imul(x, 2654435761) ^ Math.imul(y, 40503);
    const u = (h ^ (h >>> 15)) >>> 0;
    const branches = 2 + (u % 3);
    const baseX = px + 8 + (u % 16);
    const baseY = py + TILE - 3;
    for (let i = 0; i < branches; i++) {
      const color = CORAL_PALETTE[(u >> (i * 3)) % CORAL_PALETTE.length];
      const len = 9 + ((u >> (i * 5 + 1)) % 9);
      const angle = -Math.PI / 2 + (((u >> (i * 7 + 2)) % 100) / 100 - 0.5) * 1.3 + (i - branches / 2) * 0.45;
      const sway = Math.sin(t * 0.0015 + i + (u % 10)) * 2;
      const tipX = baseX + Math.cos(angle) * len + sway;
      const tipY = baseY + Math.sin(angle) * len;
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(baseX, baseY);
      g.quadraticCurveTo((baseX + tipX) / 2 + sway * 0.5, (baseY + tipY) / 2, tipX, tipY);
      g.stroke();
      g.beginPath();
      g.arc(tipX, tipY, 2.4, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
  }

  function drawTiles(g, camX, camY, now) {
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
          case '#': color = '#1a2226'; break;
          case 'S': color = floorShade(x, y); break;
          case 'E': color = '#15283c'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#1e3a50'; break;
          default: color = floorShade(x, y);
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }

        // A faint drifting light-caustic streak across every bit of open
        // water, not just the 'R' coral tiles -- a subtle moving band
        // instead of a static floor texture.
        if (ch === '.' || ch === 'R' || ch === 'S' || ch === 'E') {
          const h = Math.imul(x, 668265263) ^ Math.imul(y, 2246822519);
          const seed = ((h ^ (h >>> 13)) >>> 0) % 1000 / 1000;
          const band = Math.sin(now * 0.0005 + seed * 20 + x * 0.3 + y * 0.2);
          if (band > 0.65) {
            g.fillStyle = `rgba(205,230,255,${(band - 0.65) * 0.25})`;
            g.fillRect(px, py, TILE, TILE);
          }
        }

        if (ch === 'R') drawCoral(g, px, py, x, y, now);
      }
    }

    const dx0 = doorBounds.x0 * TILE, dy0 = doorBounds.y0 * TILE;
    const dw = (doorBounds.x1 - doorBounds.x0 + 1) * TILE;
    const dh = (doorBounds.y1 - doorBounds.y0 + 1) * TILE;
    if (!doorUnlocked) {
      g.strokeStyle = '#0d1114';
      g.lineWidth = 4;
      g.strokeRect(dx0 + 3, dy0 + 3, dw - 6, dh - 6);
      g.strokeStyle = 'rgba(255,190,60,0.5)';
      g.lineWidth = 3;
      g.strokeRect(dx0 + 9, dy0 + 9, dw - 18, dh - 18);
      g.beginPath();
      g.moveTo(dx0 + dw / 2, dy0 + 4);
      g.lineTo(dx0 + dw / 2, dy0 + dh - 4);
      g.stroke();
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 3;
      g.strokeRect(dx0 + 2, dy0 + 2, dw - 4, dh - 4);
    }

    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    g.beginPath();
    g.arc(ex.x, ex.y, doorUnlocked ? 12 : 6, 0, Math.PI * 2);
    g.fillStyle = doorUnlocked ? '#ffd27a' : '#5a4a30';
    g.fill();

    drawDecorPipes(g);
    drawGiantWheel(g, now);
    drawPressurePlates(g, now);
    drawSafeZone(g);
    drawBloodSplatters(g);
    drawCrates(g);
    drawMeatLure(g);
    drawWaterRipples(g, now);
    drawFloatingTexts(g);
  }

  // Decorative pipes ringing the giant pipe room's walls -- permanently
  // rusty, no weld state or leak; pure set-dressing so the room reads as
  // "pipes all over the walls."
  function drawDecorPipes(g) {
    HUB_WALL_PIPES.forEach((spot) => {
      const center = tileCenter(spot.x, spot.y);
      const angle = Math.atan2(spot.dir.y, spot.dir.x);
      g.save();
      g.translate(center.x, center.y);
      g.rotate(angle);
      g.fillStyle = '#2a2420';
      g.fillRect(-11, -8, 5, 16);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.strokeRect(-11, -8, 5, 16);
      const grad = g.createLinearGradient(0, -5, 0, 5);
      grad.addColorStop(0, '#8a7560');
      grad.addColorStop(1, '#4a3c30');
      g.fillStyle = grad;
      g.fillRect(-6, -5, 22, 10);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.2;
      g.strokeRect(-6, -5, 22, 10);
      g.restore();
    });
  }

  // Two pressure plates flanking the giant wheel, far enough apart that
  // one player can't straddle both -- lit amber while someone's actually
  // standing on them, dull rust otherwise.
  function drawPressurePlates(g, now) {
    PLATE_POSITIONS.forEach((plate) => {
      const center = tileCenter(plate.x, plate.y);
      const held = players.some((p) => {
        if (p.caught) return false;
        const t = worldToTile(p.x, p.y);
        return t.x === plate.x && t.y === plate.y;
      });
      g.save();
      g.translate(center.x, center.y);
      g.fillStyle = held ? '#6a4a1a' : '#3a2e22';
      g.fillRect(-13, -13, 26, 26);
      g.strokeStyle = held ? '#ffb347' : 'rgba(0,0,0,0.5)';
      g.lineWidth = held ? 2.5 : 1.5;
      if (held) { g.shadowColor = '#ffb347'; g.shadowBlur = 8; }
      g.strokeRect(-11, -11, 22, 22);
      g.shadowBlur = 0;
      g.restore();
    });
  }

  // The giant wheel at the hub's center -- its spokes creak slowly around
  // while both plates are held down, locking into a turned pose (and a
  // green glow) the instant it's solved. A progress ring above it tracks
  // the current hold, same convention as every other hold-to-fill gauge
  // on this site.
  function drawGiantWheel(g, now) {
    const c = tileCenter(LEVEL.wheel.x, LEVEL.wheel.y);
    const heldFrac = clamp(wheelHeldMs / WHEEL_HOLD_MS, 0, 1);
    const angle = wheelSolved ? Math.PI / 6 : (now * 0.0003 * heldFrac) % (Math.PI * 2);
    g.save();
    g.translate(c.x, c.y);
    g.beginPath();
    g.arc(0, 0, 30, 0, Math.PI * 2);
    g.fillStyle = 'rgba(20,15,10,0.5)';
    g.fill();
    g.rotate(angle);
    g.strokeStyle = wheelSolved ? '#7ad67a' : '#8a7560';
    g.lineWidth = 5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, 26, 0, Math.PI * 2);
    g.lineWidth = 4;
    g.strokeStyle = wheelSolved ? '#7ad67a' : '#5a4a38';
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 7, 0, Math.PI * 2);
    g.fillStyle = '#2a2420';
    g.fill();
    g.restore();

    if (!wheelSolved && heldFrac > 0) {
      g.save();
      g.translate(c.x, c.y);
      g.beginPath();
      g.arc(0, -42, 8, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 1.5;
      g.stroke();
      g.beginPath();
      g.arc(0, -42, 8, -Math.PI / 2, -Math.PI / 2 + heldFrac * Math.PI * 2);
      g.strokeStyle = '#ffb23c';
      g.lineWidth = 3;
      g.stroke();
      g.restore();
    }
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
    if (monster.luredState === 'none' || !monster.lureTarget) return;
    g.save();
    g.translate(monster.lureTarget.x, monster.lureTarget.y);
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

  // A single fin: a flat, translucent triangle with a faint membrane
  // highlight, reused for the dorsal fin and both side fins.
  function drawFin(g, baseX, baseY, tipX, tipY, width, color) {
    const dx = tipX - baseX, dy = tipY - baseY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    g.beginPath();
    g.moveTo(baseX + nx * width, baseY + ny * width);
    g.lineTo(tipX, tipY);
    g.lineTo(baseX - nx * width, baseY - ny * width);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 0.8;
    g.stroke();
  }

  // A handful of small raised bumps scattered across a segment's surface
  // -- fixed per segment (hashed from a seed, not from its live x/y, so
  // they read as a stable feature of the body rather than swimming
  // around as it moves), each with a faint highlight to sell the raised
  // shape instead of a flat dot.
  function drawEelBumps(g, r, seed) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = r * (0.25 + (u % 5) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const br = Math.max(1, r * (0.12 + (u % 3) * 0.03));
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fillStyle = 'rgba(190,225,245,0.55)';
      g.fill();
      g.beginPath();
      g.arc(bx - br * 0.3, by - br * 0.3, br * 0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fill();
    }
  }

  function drawEel(g, t) {
    // Ground shadow trail, drawn first so it sits under every segment.
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = monster.segments.length - 1; i >= 0; i--) {
      const seg = monster.segments[i];
      const r = monster.radius * (1 - i * 0.055);
      g.beginPath();
      g.ellipse(seg.x, seg.y + r * 0.5, Math.max(3, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    // Body segments, tail first so the head draws on top -- a pale,
    // sickly blue instead of the usual dark teal-green, tapering to a
    // thin point at the tail, with a scatter of small raised bumps
    // across every segment's surface.
    for (let i = monster.segments.length - 1; i >= 0; i--) {
      const seg = monster.segments[i];
      const r = Math.max(2.5, monster.radius * (1 - i * 0.055));
      const base = i % 2 === 0 ? '#7ab8d9' : '#8ac4e3';
      g.save();
      g.translate(seg.x, seg.y);

      // a dorsal fin along the spine, present on most body segments
      if (i % 2 === 0 && i < monster.segments.length - 2) {
        const next = monster.segments[Math.min(i + 1, monster.segments.length - 1)];
        const dx = seg.x - next.x, dy = seg.y - next.y;
        const ang = Math.atan2(dy, dx) + Math.PI / 2;
        drawFin(g, 0, 0, Math.cos(ang) * r * 1.6, Math.sin(ang) * r * 1.6, r * 0.5, 'rgba(120,180,220,0.55)');
      }

      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#2a5a75';
      g.shadowBlur = 5;
      g.fill();
      g.shadowBlur = 0;

      drawEelBumps(g, r, monster.seed + i * 13);

      // pale underbelly stripe
      g.beginPath();
      g.ellipse(0, r * 0.35, r * 0.75, r * 0.3, 0, 0, Math.PI);
      g.fillStyle = 'rgba(225,240,245,0.35)';
      g.fill();

      g.restore();
    }

    g.save();
    g.translate(monster.x, monster.y);

    const points = 12;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = monster.radius
        + Math.sin(t * 0.006 + i * 1.7 + monster.seed) * 2
        + Math.sin(t * 0.0021 + i * 3.1 + monster.seed) * 1;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    // a pair of side fins at the head, swept back along lookDir
    const headAngle = Math.atan2(monster.lookDir.y, monster.lookDir.x);
    [-1, 1].forEach((side) => {
      const perp = headAngle + (Math.PI / 2) * side;
      const baseX = Math.cos(perp) * monster.radius * 0.5, baseY = Math.sin(perp) * monster.radius * 0.5;
      const backAngle = headAngle + Math.PI + (0.5 * side);
      const tipX = baseX + Math.cos(backAngle) * monster.radius * 1.4;
      const tipY = baseY + Math.sin(backAngle) * monster.radius * 1.4;
      drawFin(g, baseX, baseY, tipX, tipY, monster.radius * 0.35, 'rgba(120,180,220,0.6)');
    });

    trace();
    const headGrad = g.createRadialGradient(-monster.radius * 0.3, -monster.radius * 0.35, 1, 0, 0, monster.radius * 1.05);
    headGrad.addColorStop(0, shade('#8ac4e3', 0.22));
    headGrad.addColorStop(0.55, '#8ac4e3');
    headGrad.addColorStop(1, shade('#8ac4e3', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#2a5a75';
    g.shadowBlur = 10;
    g.fill();
    g.shadowBlur = 0;
    drawEelBumps(g, monster.radius, monster.seed);

    g.save();
    trace();
    g.clip();
    g.beginPath();
    g.ellipse(-monster.radius * 0.3, -monster.radius * 0.35, monster.radius * 0.5, monster.radius * 0.3, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fill();
    g.restore();

    // mouth instead of an eye, same convention as the Dig Worm
    drawMonsterMouth(g, monster.radius, monster.lookDir);

    if (t < monster.frozenUntil) {
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = monster.radius + 3;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(140,220,255,0.45)';
      g.fill();
      g.strokeStyle = 'rgba(220,250,255,0.8)';
      g.lineWidth = 1.5;
      g.stroke();
    }

    g.restore();
  }

  // No eye on this one -- a mouth instead, same convention as the Dig
  // Worm: a dark wet oval, a row of teeth, oriented to face lookDir
  // instead of sitting fixed on the head.
  function drawMonsterMouth(g, radius, lookDir) {
    const mouthR = radius * 0.7;
    const angle = Math.atan2(lookDir.y, lookDir.x);
    g.save();
    g.rotate(angle);

    const mouthGrad = g.createRadialGradient(mouthR * 0.25, 0, 1, mouthR * 0.25, 0, mouthR * 0.9);
    mouthGrad.addColorStop(0, '#0a1410');
    mouthGrad.addColorStop(1, '#000000');
    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.fillStyle = mouthGrad;
    g.fill();

    g.beginPath();
    g.ellipse(mouthR * 0.55, 0, mouthR * 0.25, mouthR * 0.16, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(30,110,90,0.5)';
    g.fill();

    const teeth = 9;
    for (let i = 0; i < teeth; i++) {
      const a = (i / (teeth - 1)) * Math.PI * 2 - Math.PI;
      const rx = mouthR * 0.85, ry = mouthR * 0.62;
      const bx = mouthR * 0.25 + Math.cos(a) * rx;
      const by = Math.sin(a) * ry;
      const inX = mouthR * 0.25 + Math.cos(a) * rx * 0.45;
      const inY = Math.sin(a) * ry * 0.45;
      const tw = 2.2;
      const nx = -Math.sin(a) * tw, ny = Math.cos(a) * tw;
      const toothGrad = g.createLinearGradient(bx, by, inX, inY);
      toothGrad.addColorStop(0, '#ffffff');
      toothGrad.addColorStop(1, '#c9c0b0');
      g.beginPath();
      g.moveTo(bx + nx, by + ny);
      g.lineTo(bx - nx, by - ny);
      g.lineTo(inX, inY);
      g.closePath();
      g.fillStyle = toothGrad;
      g.fill();
    }

    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  function drawLimb(g, hipX, hipY, tipX, tipY, width, color, capColor, capR) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(tipX, tipY);
    g.stroke();
    g.beginPath();
    g.arc(tipX, tipY, capR, 0, Math.PI * 2);
    g.fillStyle = capColor;
    g.fill();
  }

  // A swim flipper instead of a boot -- a flattened teardrop, angled off
  // the leg's own direction, same cap-replacement spot drawLimb would
  // otherwise put a boot.
  function drawFlipper(g, tipX, tipY, hipX, hipY, color) {
    const dx = tipX - hipX, dy = tipY - hipY;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len, dirY = dy / len;
    const nx = -dirY, ny = dirX;
    g.save();
    g.translate(tipX, tipY);
    g.beginPath();
    g.moveTo(-dirX * 2, -dirY * 2 + nx * 3.2);
    g.lineTo(dirX * 7, dirY * 7);
    g.lineTo(-dirX * 2, -dirY * 2 - nx * 3.2);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  function drawHeldShotgun(g, R, p) {
    g.save();
    const grip = Math.sin(p.walkPhase) * R * 0.05;
    g.translate(R * 0.15, R * 0.25 + grip);
    g.rotate(-0.12);
    g.strokeStyle = '#5a4428';
    g.lineWidth = R * 0.22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-R * 0.35, 0);
    g.lineTo(R * 0.25, 0);
    g.stroke();
    g.strokeStyle = '#3a3d42';
    g.lineWidth = R * 0.15;
    g.beginPath();
    g.moveTo(R * 0.15, 0);
    g.lineTo(R * 1.55, 0);
    g.stroke();
    if (p.shotgunAmmo > 0) {
      g.beginPath();
      g.arc(R * 1.55, 0, R * 0.12, 0, Math.PI * 2);
      g.fillStyle = '#ff6a2a';
      g.shadowColor = '#ff6a2a';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;
    }
    g.restore();
  }

  function drawPlayers(g) {
    const R = PLAYER_RADIUS;
    players.forEach((p) => {
      g.save();
      g.translate(p.x, p.y);

      g.beginPath();
      g.ellipse(0, R * 1.05, R * 0.85, R * 0.26, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fill();

      g.rotate(Math.atan2(p.facing.y, p.facing.x));

      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(p.color, -0.45);
      const flipperColor = '#e8d94a';

      // legs -- drawn first so the torso overlaps their hip ends. Flipper
      // fins stand in for boots at each foot.
      g.strokeStyle = suitDark;
      g.lineWidth = R * 0.34;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, -R * 0.3);
      g.lineTo(swing, -R * 0.3);
      g.stroke();
      drawFlipper(g, swing, -R * 0.3, 0, -R * 0.3, flipperColor);

      g.beginPath();
      g.moveTo(0, R * 0.3);
      g.lineTo(-swing, R * 0.3);
      g.stroke();
      drawFlipper(g, -swing, R * 0.3, 0, R * 0.3, flipperColor);

      g.strokeStyle = '#54544c';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-R * 1.3, -3);
      g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
      g.stroke();
      const tankGrad = g.createLinearGradient(-R * 1.5, -4.5, -R * 1.5, 4.5);
      tankGrad.addColorStop(0, shade('#54544c', 0.25));
      tankGrad.addColorStop(1, shade('#54544c', -0.25));
      g.fillStyle = tankGrad;
      g.fillRect(-R * 1.5, -4.5, 7, 9);

      g.save();
      g.translate(0, -bob);
      const bodyGrad = g.createRadialGradient(-R * 0.32, -R * 0.4, 1, 0, 0, R * 1.1);
      bodyGrad.addColorStop(0, shade(p.color, 0.25));
      bodyGrad.addColorStop(0.6, p.color);
      bodyGrad.addColorStop(1, shade(p.color, -0.35));
      g.beginPath();
      g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
      g.fillStyle = bodyGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1.5;
      g.stroke();

      g.save();
      g.beginPath();
      g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(20,20,15,0.85)';
      g.fillRect(-R * 1.1, -R * 0.24, R * 2.2, R * 0.17);
      g.fillStyle = 'rgba(255,200,40,0.9)';
      g.fillRect(-R * 1.1, -R * 0.08, R * 2.2, R * 0.09);
      g.restore();
      g.restore();

      drawLimb(g, 0, -R * 0.55, -swing * 0.8, -R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
      drawLimb(g, 0, R * 0.55, swing * 0.8, R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
      drawHeldShotgun(g, R, p);

      g.save();
      g.translate(R * 0.55, -bob);
      const headR = R * 0.5;

      g.beginPath();
      g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 2.5;
      g.stroke();

      const helmetGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.35, 1, 0, 0, headR * 1.05);
      helmetGrad.addColorStop(0, '#ffffff');
      helmetGrad.addColorStop(0.35, 'rgba(224,226,216,0.95)');
      helmetGrad.addColorStop(1, 'rgba(150,155,146,0.92)');
      g.beginPath();
      g.arc(0, 0, headR, 0, Math.PI * 2);
      g.fillStyle = helmetGrad;
      g.fill();
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 1.5;
      g.stroke();

      const visorGrad = g.createLinearGradient(0, -headR * 0.3, 0, headR * 0.3);
      visorGrad.addColorStop(0, '#1c2a33');
      visorGrad.addColorStop(1, '#03060a');
      g.beginPath();
      g.ellipse(headR * 0.32, 0, headR * 0.34, headR * 0.62, 0, 0, Math.PI * 2);
      g.fillStyle = visorGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.moveTo(headR * 0.18, -headR * 0.4);
      g.lineTo(headR * 0.42, -headR * 0.15);
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = headR * 0.12;
      g.lineCap = 'round';
      g.stroke();

      g.restore();

      g.restore();
    });
  }

  function punchLight(g, x, y, radius, intensity) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return;
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

  function buildDarknessMask(camX, camY, now) {
    const worldToScreen = (wx, wy) => ({ x: wx - camX + VIEW_W / 2, y: wy - camY + VIEW_H / 2 });
    const nvgMult = now < nvgUntil ? NVG_RANGE_MULT : 1;

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
      punchLight(maskCtx, s.x, s.y, 90 * nvgMult, 1);
      punchLight(maskCtx, s.x, s.y, 230 * nvgMult, 0.85);
    });
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
    drawTiles(ctx, camX, camY, now);
    drawFish(ctx);
    drawSmokeBombs(ctx, now);
    drawDecoy(ctx, now);
    drawEel(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    drawProximityWarning(vx, Math.hypot(p.x - monster.x, p.y - monster.y), now);
    drawRadar(vx, p, now);
    drawScanner(vx, p, now);
    drawShotgunHud(vx, p);
    const minimapH = drawMinimap(vx, now);
    drawStaminaBar(vx, p, minimapH);

    if (p.caught) drawCutsceneOverlay(vx, p, now);

    ctx.restore();
  }

  function drawShotgunHud(vx, p) {
    if (p.shotgunAmmo <= 0) return;
    const cx = vx + VIEW_W - 34, cy = 64;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,20,10,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#ff9c3d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx - 6, cy);
    ctx.fillStyle = '#c9451f';
    ctx.fillRect(-4, -7, 8, 9);
    ctx.fillStyle = '#d9b24a';
    ctx.fillRect(-4, 2, 8, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -7, 8, 13);
    ctx.restore();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`${p.shotgunAmmo}x`, cx + 3, cy + 4);
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
    const angle = Math.atan2(monster.y - p.y, monster.x - p.x);
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

  const PROXIMITY_WARNING_RADIUS = 400;

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    const alpha = closeness * 0.6 * pulse;
    ctx.fillStyle = `rgba(200,20,20,${alpha})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
  }

  function drawScanner(vx, p, now) {
    if (now > scannerUntil) return;
    const target = scannerTarget();
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
    ctx.fillStyle = `rgba(10,30,30,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    const shake = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawJaw(ctx, vx, 1, jawProgress, '#163a34');
    drawJaw(ctx, vx, -1, jawProgress, '#0f2c28');

    if (t > 0.6) {
      const flash = clamp((t - 0.6) / 0.15, 0, 1) * (1 - clamp((t - 0.85) / 0.15, 0, 1));
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
  }

  function drawDivider() {
    ctx.strokeStyle = '#1a3a44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIEW_W, 0);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.stroke();
  }

  function updateOverlay() {
    if (gameState === 'complete') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE GREAT WHEEL TURNS &mdash; you made it out. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    if (wheelSolved) {
      hudWheelEl.textContent = 'Wheel: turned';
    } else {
      hudWheelEl.textContent = `Wheel: ${(wheelHeldMs / 1000).toFixed(1)}s / ${(WHEEL_HOLD_MS / 1000).toFixed(0)}s`;
    }
    hudWheelEl.classList.toggle('done', wheelSolved);
    hudDoorEl.textContent = `Door: ${doorUnlocked ? 'unlocked' : 'locked'}`;
    hudDoorEl.classList.toggle('done', doorUnlocked);

    if (gameState === 'complete' && !bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
      if (window.GoofyStory) window.GoofyStory.completeLevel(18);
    }

    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;

  function loop(now) {
    try {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'playing') {
      elapsedMs = now - runStartTime;
      updateInputMovement(now, dt);
      updateTriggers();
      updateCrates(now);
      updateWheel(now, dt);
      updateSmokeBombs(now);
      updateDecoy(now, dt);
      updateFish(now, dt);
      updateMonster(now, dt);
      updateShotgunDefense(now);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
      updateSafeMusic(players.some(isInSafeZone));
      updateWaterRipples(now);
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    renderViewport(1, now);
    drawDivider();

    if (catchFlash > 0) {
      ctx.fillStyle = `rgba(20,120,110,${catchFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      catchFlash -= dt * 1.2;
    }

    updateOverlay();
    updateHud();
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
