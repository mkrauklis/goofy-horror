(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked chapter.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(3)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous chapter first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL3;
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
  const PATROL_SPEED = PLAYER_SPEED * 0.9; // the caterpillar is a slow roamer...
  const CHARGE_SPEED = PLAYER_SPEED * 20; // ...until something sets it off
  const LURE_SPEED = PLAYER_SPEED * 0.6;
  const CATCH_RADIUS = 22;
  const REPATH_MS = 500;
  const ALERT_GRACE_MS = 3000;
  const DETECT_RADIUS = 70; // very short range of "vision"
  const GENERATOR_FILL_MS = 5000;
  const VINE_RESPAWN_MS = 45000;
  const RADAR_DURATION_MS = 10000;
  const SCANNER_DURATION_MS = 10000;
  const FREEZE_DURATION_MS = 10000;
  const EAT_DURATION_MS = 3000;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const CRATE_ITEMS = ['radar', 'meat', 'co2', 'scanner'];

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
  const SEGMENT_COUNT = 7;
  const SEGMENT_SPACING = 15;

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

  const hudGeneratorEl = document.getElementById('hud-generator');
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

  function playItemChime(freq) {
    playTone(freq, 0.25, 'square', 0.18);
  }

  function playDoorUnlockChime() {
    playTone(440, 0.2, 'triangle', 0.22, 0);
    playTone(660, 0.2, 'triangle', 0.22, 0.12);
    playTone(880, 0.3, 'triangle', 0.22, 0.24);
  }

  function playVineShriek() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, start);
    osc.frequency.exponentialRampToValueAtTime(900, start + 0.3);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
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
    const minDist = Math.min(...players.map((p) => Math.hypot(p.x - monster.x, p.y - monster.y)));
    const proximity = clamp(1 - minDist / 380, 0, 1);
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

  // Double-tapping a movement key starts a sprint (see updateStamina/
  // applyMovement) as long as there's stamina left. Only counted on the
  // real edge of a fresh keydown, not the browser's auto-repeat.
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

  // A handful of near-identical grays, picked per-tile by hashing its
  // coordinates, so plain floor reads as worn/mottled concrete instead of
  // one flat color.
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

  // Shifts a '#rrggbb' color toward white (amt > 0) or black (amt < 0) --
  // used to derive a highlight/shadow tone from a single base color instead
  // of hand-picking a second and third shade for everything drawn below.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) + 255 * amt);
    const g2 = clamp(((n >> 8) & 255) + 255 * amt);
    const b = clamp((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  // ---- game state ----

  // ---- timer / best time (best is kept per-browser in localStorage, not
  // shared between players or devices) ----
  const BEST_TIME_KEY = 'goofy-horror-best-level3';
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
  let generatorProgress = 0;
  let generatorActive = false;
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
    };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  const monster = {
    x: 0,
    y: 0,
    radius: 12,
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
  };

  let crates = [];
  let vines = [];
  let radarUntil = 0;
  let scannerUntil = 0;
  let floatingTexts = [];

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
    });

    const m = tileCenter(LEVEL.monsterSpawn.x, LEVEL.monsterSpawn.y);
    monster.x = m.x; monster.y = m.y;
    monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
    monster.state = 'patrol'; monster.alertUntil = 0; monster.alertTargetTile = null; monster.patrolIndex = 0;
    monster.frozenUntil = 0; monster.luredState = 'none'; monster.lureTarget = null; monster.eatingUntil = 0;
    monster.trail = []; monster.segments = [];

    generatorProgress = 0;
    generatorActive = false;
    doorUnlocked = false;

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)], opened: false, openedAt: 0,
    }));
    vines = (LEVEL.vineSpawns || []).map((v) => ({ x: v.x, y: v.y, triggered: false, triggeredAt: 0 }));
    radarUntil = 0;
    scannerUntil = 0;
    floatingTexts = [];
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

  // Sprinting drains stamina over 15s of continuous use; run out and you're
  // stuck at half speed for 5s while it refills halfway. Walking normally
  // (not sprinting, not exhausted) also refills it, just at half the rate
  // the exhausted penalty does.
  function updateStamina(p, now, dt, isMoving) {
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
      if (!isMoving) p.sprintActive = false; // stopping cancels the sprint; needs a fresh double-tap
      p.stamina = Math.min(STAMINA_MAX, p.stamina + NORMAL_REGEN_RATE * dt);
    }
  }

  function speedMultiplierFor(p) {
    if (p.moveState === 'exhausted') return EXHAUSTED_SPEED_MULT;
    if (p.moveState === 'sprinting') return SPRINT_SPEED_MULT;
    return 1;
  }

  function applyMovement(p, ix, iy, dt) {
    if (p.caught) return; // held fast during the catch cutscene
    if (ix === 0 && iy === 0) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    const speed = PLAYER_SPEED * speedMultiplierFor(p);
    movePlayer(p, nx * speed * dt, ny * speed * dt);
  }

  function updatePlayerMovement(p, ix, iy, now, dt) {
    const isMoving = !p.caught && (ix !== 0 || iy !== 0);
    updateStamina(p, now, dt, isMoving);
    applyMovement(p, ix, iy, dt);
    if (isMoving) p.walkPhase += dt * WALK_CYCLE_SPEED * speedMultiplierFor(p);
  }

  function updateInputMovement(now, dt) {
    updatePlayerMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), now, dt);
    updatePlayerMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), now, dt);
  }

  function isInSafeZone(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  // The scanner points at the generator until it's finished charging --
  // nothing left to find after that, so it just stops showing anything.
  function scannerTarget() {
    if (generatorActive) return null;
    return tileCenter(LEVEL.generator.x, LEVEL.generator.y);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#8f8f9a';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'P') return '#5ec9e8';
    if (ch === 'T') return '#7a5a34';
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

  function drawMinimap(vx) {
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
    const color = p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';
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

  function applyItemEffect(item, x, y, now) {
    if (item === 'radar') {
      radarUntil = now + RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'RADAR');
      playItemChime(880);
    } else if (item === 'meat') {
      monster.luredState = 'lured';
      monster.lureTarget = { x, y };
      monster.path = []; monster.pathIndex = 0;
      spawnFloatingText(x, y, 'MEAT');
      playItemChime(220);
    } else if (item === 'co2') {
      monster.frozenUntil = now + FREEZE_DURATION_MS;
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

  function updateVines(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      vines.forEach((v) => {
        if (v.triggered) return;
        if (v.x === t.x && v.y === t.y) {
          v.triggered = true;
          v.triggeredAt = now;
          const target = tileCenter(v.x, v.y);
          monster.state = 'alert';
          monster.alertUntil = now + ALERT_GRACE_MS;
          monster.alertTargetTile = { x: v.x, y: v.y };
          monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
          spawnFloatingText(target.x, target.y, 'SNARE!');
          playVineShriek();
        }
      });
    });
    vines.forEach((v) => {
      if (v.triggered && now - v.triggeredAt >= VINE_RESPAWN_MS) {
        v.triggered = false;
      }
    });
  }

  function updateTriggers() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);
      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
        if (window.GoofyStory) window.GoofyStory.completeLevel(3);
        setTimeout(() => { window.location.href = 'level4.html'; }, 650);
      }
    });
  }

  function updateGenerator(dt) {
    if (generatorActive) return;
    const onPlate1 = players.some((p) => {
      const t = worldToTile(p.x, p.y);
      return t.x === LEVEL.plate1.x && t.y === LEVEL.plate1.y;
    });
    const onPlate2 = players.some((p) => {
      const t = worldToTile(p.x, p.y);
      return t.x === LEVEL.plate2.x && t.y === LEVEL.plate2.y;
    });
    const p0t = worldToTile(players[0].x, players[0].y);
    const p1t = worldToTile(players[1].x, players[1].y);
    const samePlayerTile = p0t.x === p1t.x && p0t.y === p1t.y;
    const bothHeld = onPlate1 && onPlate2 && !samePlayerTile;

    if (bothHeld) {
      generatorProgress = Math.min(1, generatorProgress + dt / (GENERATOR_FILL_MS / 1000));
      if (generatorProgress >= 1) {
        generatorActive = true;
        doorUnlocked = true;
        playDoorUnlockChime();
      }
    } else {
      generatorProgress = Math.max(0, generatorProgress - dt / (GENERATOR_FILL_MS / 1000 / 2));
    }
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
      if (p.caught || isInSafeZone(p)) continue;
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

  function updateCaterpillarSegments(m) {
    m.trail.unshift({ x: m.x, y: m.y });
    if (m.trail.length > 600) m.trail.length = 600;
    const segPositions = [];
    let distAccum = 0;
    let targetDist = SEGMENT_SPACING;
    let segIndex = 0;
    for (let i = 1; i < m.trail.length && segIndex < SEGMENT_COUNT; i++) {
      const a = m.trail[i - 1], b = m.trail[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      while (distAccum + segLen >= targetDist && segIndex < SEGMENT_COUNT) {
        const t = segLen > 0.0001 ? (targetDist - distAccum) / segLen : 0;
        segPositions.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        segIndex++;
        targetDist += SEGMENT_SPACING;
      }
      distAccum += segLen;
    }
    const last = m.trail[m.trail.length - 1] || { x: m.x, y: m.y };
    while (segPositions.length < SEGMENT_COUNT) segPositions.push(last);
    m.segments = segPositions;
  }

  function updateMonster(now, dt) {
    if (now < monster.frozenUntil) { updateCaterpillarSegments(monster); return; }

    if (monster.luredState === 'eating') {
      if (now >= monster.eatingUntil) {
        monster.luredState = 'none';
        monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
      } else {
        updateCaterpillarSegments(monster);
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
      updateCaterpillarSegments(monster);
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

    if (monster.path && monster.pathIndex < monster.path.length) {
      const step = (monster.state === 'alert' ? CHARGE_SPEED : PATROL_SPEED) * dt;
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

    updateCaterpillarSegments(monster);
  }

  function updateCatch(now) {
    if (now < monster.frozenUntil) return;
    if (monster.luredState !== 'none') return;
    if (monster.state !== 'alert') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (isInSafeZone(p)) return;
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
          case 'P': color = floorShade(x, y); break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;
          default: color = floorShade(x, y);
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
        if (ch === 'T') {
          g.fillStyle = 'rgba(0,0,0,0.15)';
          const pebbles = 3;
          for (let i = 0; i < pebbles; i++) {
            const seed = (x * 7 + y * 13 + i * 31) % 17;
            g.beginPath();
            g.arc(px + 6 + (seed % 5) * 5, py + 6 + ((seed * 3) % 5) * 5, 1.5, 0, Math.PI * 2);
            g.fill();
          }
        }
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

    drawGeneratorRoom(g);
    drawSafeZone(g);
    drawCorpses(g);
    drawBloodSplatters(g);
    drawVines(g);
    drawCrates(g);
    drawMeatLure(g);
    drawFloatingTexts(g);
  }

  function drawWireSegment(g, x0, y0, x1, y1, active) {
    g.save();
    g.strokeStyle = active ? '#3ddc84' : '#7a2f10';
    g.lineWidth = 3;
    g.lineCap = 'round';
    if (active) { g.shadowColor = '#3ddc84'; g.shadowBlur = 6; }
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.shadowBlur = 0;
    g.restore();
  }

  function drawGeneratorRoom(g) {
    const genC = tileCenter(LEVEL.generator.x, LEVEL.generator.y);
    const p1C = tileCenter(LEVEL.plate1.x, LEVEL.plate1.y);
    const p2C = tileCenter(LEVEL.plate2.x, LEVEL.plate2.y);

    drawWireSegment(g, p1C.x, p1C.y, genC.x, genC.y, generatorActive);
    drawWireSegment(g, p2C.x, p2C.y, genC.x, genC.y, generatorActive);

    [[p1C, onPlateNow(LEVEL.plate1)], [p2C, onPlateNow(LEVEL.plate2)]].forEach(([c, pressed]) => {
      g.save();
      g.translate(c.x, c.y);
      g.fillStyle = pressed ? '#5ec9e8' : '#3a4048';
      g.fillRect(-11, -11, 22, 22);
      g.strokeStyle = '#1c2226';
      g.lineWidth = 2;
      g.strokeRect(-11, -11, 22, 22);
      if (pressed) {
        g.shadowColor = '#5ec9e8';
        g.shadowBlur = 10;
        g.fillStyle = 'rgba(94,201,232,0.5)';
        g.fillRect(-7, -7, 14, 14);
        g.shadowBlur = 0;
      }
      g.restore();
    });

    g.save();
    g.translate(genC.x, genC.y);
    g.fillStyle = '#33363c';
    g.fillRect(-16, -14, 32, 28);
    g.strokeStyle = '#181a1e';
    g.lineWidth = 2;
    g.strokeRect(-16, -14, 32, 28);
    const litColor = generatorActive ? '#3ddc84' : `rgba(255,200,60,${0.3 + generatorProgress * 0.6})`;
    g.fillStyle = litColor;
    g.shadowColor = litColor;
    g.shadowBlur = generatorActive ? 12 : 4 + generatorProgress * 8;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(-9 + i * 9, -6, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.shadowBlur = 0;
    if (!generatorActive) {
      g.fillStyle = '#1c1e22';
      g.fillRect(-12, 4, 24, 6);
      g.fillStyle = '#ffd27a';
      g.fillRect(-12, 4, 24 * generatorProgress, 6);
    }
    g.restore();
  }

  function onPlateNow(plate) {
    return players.some((p) => {
      const t = worldToTile(p.x, p.y);
      return t.x === plate.x && t.y === plate.y;
    });
  }

  function drawVines(g) {
    vines.forEach((v) => {
      if (v.triggered) return;
      const c = tileCenter(v.x, v.y);
      g.save();
      g.translate(c.x, c.y);
      g.strokeStyle = '#3a6b2a';
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + v.x * 0.3;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 11, Math.sin(a) * 11);
        g.stroke();
      }
      g.fillStyle = '#5a2a3a';
      g.beginPath();
      g.arc(0, 0, 3.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
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

  function drawMonster(g, t) {
    // Ground shadow trail, drawn first so it sits under every segment.
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = monster.segments.length - 1; i >= 0; i--) {
      const seg = monster.segments[i];
      const r = monster.radius * (1 - i * 0.06);
      g.beginPath();
      g.ellipse(seg.x, seg.y + r * 0.5, Math.max(3, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    // Body segments, tail first so the head draws on top.
    for (let i = monster.segments.length - 1; i >= 0; i--) {
      const seg = monster.segments[i];
      const r = Math.max(4, monster.radius * (1 - i * 0.06));
      const base = i % 2 === 0 ? '#4a3a1e' : '#5a4726';
      g.save();
      g.translate(seg.x, seg.y);
      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.28));
      grad.addColorStop(0.6, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#2a2010';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;

      // a pair of stubby legs per segment
      g.strokeStyle = 'rgba(20,14,6,0.6)';
      g.lineWidth = 1.6;
      [-1, 1].forEach((side) => {
        g.beginPath();
        g.moveTo(0, side * r * 0.7);
        g.lineTo(-2, side * (r * 0.7 + 4));
        g.stroke();
      });
      g.restore();
    }

    g.save();
    g.translate(monster.x, monster.y);

    const points = 12;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = monster.radius
        + Math.sin(t * 0.006 + i * 1.7 + monster.seed) * 2.5
        + Math.sin(t * 0.0021 + i * 3.1 + monster.seed) * 1.2;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const headGrad = g.createRadialGradient(-monster.radius * 0.3, -monster.radius * 0.35, 1, 0, 0, monster.radius * 1.05);
    headGrad.addColorStop(0, shade('#3a2e16', 0.3));
    headGrad.addColorStop(0.55, '#3a2e16');
    headGrad.addColorStop(1, shade('#3a2e16', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#6b5228';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;

    g.save();
    trace();
    g.clip();
    g.beginPath();
    g.ellipse(-monster.radius * 0.3, -monster.radius * 0.35, monster.radius * 0.5, monster.radius * 0.3, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
    g.restore();

    drawMonsterEye(g, monster.lookDir);

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

  function drawMonsterEye(g, lookDir) {
    const ex = monster.radius * 0.62, ey = ex * 0.8;

    g.save();
    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.clip();

    const sclera = g.createRadialGradient(-ex * 0.2, -ey * 0.25, 1, 0, 0, ex * 1.15);
    sclera.addColorStop(0, '#f2e6d8');
    sclera.addColorStop(0.55, '#dcc4b2');
    sclera.addColorStop(1, '#6b5142');
    g.fillStyle = sclera;
    g.fillRect(-ex, -ey, ex * 2, ey * 2);

    const ix = lookDir.x * ex * 0.32, iy = lookDir.y * ey * 0.32;
    const irisR = ex * 0.48;
    const iris = g.createRadialGradient(ix - irisR * 0.22, iy - irisR * 0.22, 1, ix, iy, irisR);
    iris.addColorStop(0, '#a3822e');
    iris.addColorStop(0.5, '#8a6a2e');
    iris.addColorStop(0.85, '#4a3210');
    iris.addColorStop(1, '#150a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

    g.beginPath();
    g.arc(ix, iy, irisR * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#050202';
    g.fill();

    g.beginPath();
    g.arc(ix - irisR * 0.3, iy - irisR * 0.3, irisR * 0.2, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fill();
    g.beginPath();
    g.arc(ix - irisR * 0.27, iy - irisR * 0.28, irisR * 0.1, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fill();

    g.beginPath();
    g.ellipse(0, -ey * 0.32, ex * 0.98, ey * 0.6, 0, Math.PI, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fill();

    g.restore();

    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  // A single limb: a thick rounded stroke from (hipX,hipY) to (tipX,tipY)
  // with a small cap circle (boot/glove) at the moving end.
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

      // Legs swing fore/aft opposite each other; arms swing opposite their
      // same-side leg (contralateral, like a real walking gait). Frozen in
      // place while standing still rather than easing to neutral -- reads
      // as a mid-step pause, which is fine at this scale.
      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(p.color, -0.45);
      const bootColor = '#2b2b28';

      // legs -- drawn first so the torso overlaps their hip ends
      drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);

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

      // torso, lit from the upper-left, bobbing slightly with the stride
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

      // arms -- on top of the torso, swinging opposite their same-side leg
      drawLimb(g, 0, -R * 0.55, -swing * 0.8, -R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
      drawLimb(g, 0, R * 0.55, swing * 0.8, R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);

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
    drawMonster(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY);
    ctx.drawImage(maskCanvas, vx, 0);

    drawProximityWarning(vx, Math.hypot(p.x - monster.x, p.y - monster.y), now);
    drawRadar(vx, p, now);
    drawScanner(vx, p, now);
    const minimapH = drawMinimap(vx);
    drawStaminaBar(vx, p, minimapH);

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

  // A short "gotcha" cutscene rendered only in the caught player's own half:
  // the screen darkens and shakes while a jagged pair of jaws close in from
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
    ctx.fillStyle = `rgba(40,30,10,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    const shake = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawJaw(ctx, vx, 1, jawProgress, '#3a2e16');
    drawJaw(ctx, vx, -1, jawProgress, '#2a2210');

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
      messageEl.innerHTML = 'FACILITY CLEARED &mdash; warping to Level 4&hellip;';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    const genLabel = generatorActive ? 'online' : `charging ${Math.round(generatorProgress * 100)}%`;
    hudGeneratorEl.textContent = `Generator: ${genLabel}`;
    hudGeneratorEl.classList.toggle('done', generatorActive);
    hudDoorEl.textContent = `Door: ${doorUnlocked ? 'open' : 'locked'}`;
    hudDoorEl.classList.toggle('done', doorUnlocked);

    if (gameState === 'complete' && !bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
      if (window.GoofyStory) window.GoofyStory.completeLevel(3);
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
      updateGenerator(dt);
      updateCrates(now);
      updateVines(now);
      updateMonster(now, dt);
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
    } catch (err) {
      // A single bad frame should never freeze the whole game -- log it
      // and keep the loop running instead of letting the exception cancel
      // the next requestAnimationFrame.
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
