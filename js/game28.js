(function () {
  const HM = window.HardMode;
  const FOOT_SURFACE = 'normal'; // which footstep sound to use (js/footsteps.js)
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(28)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL28;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  // 1-player or 2-player, picked on the menu (js/story.js) before this
  // level ever loads. Solo gets one full-width viewport instead of two
  // half-width ones sharing the same canvas.
  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;

  // Speeds are px/second and movement is scaled by the real elapsed time
  // each frame (see `dt` in loop()) rather than a fixed px/frame step --
  // fixed-per-frame movement made real-world speed drift with the frame
  // rate, which showed up as random-feeling slowdowns whenever a frame
  // took longer than usual.
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;
  // Direct spec: these things fly, they don't walk a route -- a steady
  // patrol glide around the buildings outside, and the instant one spots
  // you out there, a straight-line dive at 3x your speed.
  const WARDEN_PATROL_SPEED = HM.speed(PLAYER_SPEED * 1.0);
  const WARDEN_CHASE_SPEED = HM.speed(PLAYER_SPEED * 3.0);
  const WARDEN_RADIUS = 28;
  const WARDEN_SIGHT_RADIUS = 480; // 2x the original range, direct request
  const CATCH_RADIUS = 22;
  const PROXIMITY_WARNING_RADIUS = 380;
  const RADAR_DURATION_MS = HM.ability(10000);
  const ENERGY_DURATION_MS = HM.ability(10000);
  const SCANNER_DURATION_MS = HM.ability(10000);
  const FREEZE_DURATION_MS = HM.ability(10000);
  const FREEZE_RADIUS_TILES = 15; // freezes only reach a Warden if it's this close to where the item was used
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const SUPER_RADAR_DURATION_MS = HM.ability(10000);
  const SMOKE_FUSE_MS = 3000;
  const SMOKE_DURATION_MS = HM.ability(10000);
  const SMOKE_RADIUS = 70;
  const NVG_DURATION_MS = HM.ability(10000);
  const NVG_RANGE_MULT = 2;
  const CRATE_ITEMS = ['radar', 'co2', 'scanner', 'super-radar', 'smoke', 'nightvision', 'shotgun-ammo', 'energy'];
  const SHOTGUN_STUN_MS = HM.ability(5000);
  const SHOTGUN_AMMO_MAX = 3;
  const SHOTGUN_RANGE = 70;
  const SWITCH_PRESS_RADIUS = 30;

  // ---- sprint / stamina ----
  const DOUBLE_TAP_MS = 300;
  const STAMINA_MAX = 15; // seconds of sprint fuel
  const SPRINT_SPEED_MULT = 2;
  const EXHAUSTED_SPEED_MULT = 0.5;
  const SPRINT_DRAIN_RATE = HM.drain(STAMINA_MAX / 15); // empties over 15s of continuous sprint
  const EXHAUSTED_MS = 5000;
  const EXHAUSTED_REGEN_RATE = (STAMINA_MAX / 2) / (EXHAUSTED_MS / 1000); // refills to half over the 5s penalty
  const NORMAL_REGEN_RATE = EXHAUSTED_REGEN_RATE / 2; // half that rate while just walking
  const WALK_CYCLE_SPEED = 9; // radians/second the walk-cycle phase advances at 1x speed

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');
  const hudSwitchesEl = document.getElementById('hud-switches');

  // Darkness is composited from a separate offscreen mask so that punching
  // light holes (globalCompositeOperation 'destination-out') erases only the
  // mask's own darkness pixels, not the scene already drawn on the main canvas.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

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
  let musicMasterGain = null;
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

    ambientSubOsc = addDroneVoice(41.2, 'sine', 0.6, 0.05, 1.5).osc;
    addDroneVoice(43.7, 'sine', 0.5, 0.08, 2);
    addDroneVoice(20.6, 'sine', 0.4, 0.03, 0.8);
    ambientMidGain = addDroneVoice(97, 'sawtooth', 0, 0.15, 6).gain;
    addDroneVoice(660, 'triangle', 0.05, 0.02, 40);

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

  function playPickupChime() {
    playTone(660, 0.16, 'sine', 0.2);
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
    const minDist = Math.min(...players.flatMap((p) => monsters.map((m) => Math.hypot(p.x - m.x, p.y - m.y))));
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

  const lastTapTime = [{}, {}];
  function handleMovementKeyPress(key, now) {
    const playerIndex = PLAYER_MODE === 1 ? 0 : (key === 'w' || key === 'a' || key === 's' || key === 'd') ? 0 : 1;
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

  function gateOpen() {
    return switches.every((s) => s.pressed);
  }

  // Exterior floor (the ledge) -- the same worn tar/gravel palette the
  // rooftop levels use.
  const LEDGE_SHADES = ['#33343a', '#383a40', '#3d3f45', '#30323a', '#3a3c43'];
  function ledgeShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % LEDGE_SHADES.length;
    return LEDGE_SHADES[idx];
  }

  // The boardwalks slung between buildings -- same wood-plank floor the
  // other rooftop levels use, layered over any 'L' tile that's part of
  // a bridge span rather than a building's own ledge.
  const boardwalkSet = new Set();
  (LEVEL.boardwalks || []).forEach((b) => {
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) boardwalkSet.add(`${x},${y}`);
    }
  });
  function isBoardwalk(x, y) {
    return boardwalkSet.has(`${x},${y}`);
  }
  function drawBoardwalkPlank(g, px, py, x, y) {
    const h = Math.imul(x, 2654435761) ^ Math.imul(y, 40503);
    const u = (h ^ (h >>> 15)) >>> 0;
    g.fillStyle = (u % 2) ? '#5a4228' : '#543e26';
    g.fillRect(px, py, TILE, TILE);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px, py + TILE / 2);
    g.lineTo(px + TILE, py + TILE / 2);
    g.moveTo(px + TILE / 2, py);
    g.lineTo(px + TILE / 2, py + TILE);
    g.stroke();
    g.strokeStyle = 'rgba(255,220,160,0.08)';
    for (let i = 0; i < 3; i++) {
      const gy = py + 4 + i * (TILE / 3);
      g.beginPath();
      g.moveTo(px + 2, gy);
      g.lineTo(px + TILE - 2, gy);
      g.stroke();
    }
  }

  // Interior floor -- a distinct, slightly warmer indoor tile tone, so
  // "inside" reads differently from "outside" at a glance, not just by
  // checking whether a Warden is currently diving at you.
  const INTERIOR_SHADES = ['#3a3836', '#403e3b', '#443f3c', '#383634', '#413d39'];
  function interiorShade(x, y) {
    const h = Math.imul(x, 668265261) ^ Math.imul(y, 1274126177);
    const idx = ((h ^ (h >>> 13)) >>> 0) % INTERIOR_SHADES.length;
    return INTERIOR_SHADES[idx];
  }

  // A sparse scatter of rooftop/ledge clutter -- vent caps and stubby
  // pipes, fixed per tile (hashed), purely decorative.
  const PROP_TILE_CHANCE = 5;
  function hasProp(x, y) {
    const h = Math.imul(x, 2246822519) ^ Math.imul(y, 3266489917);
    const u = (h ^ (h >>> 15)) >>> 0;
    return (u % 100) < PROP_TILE_CHANCE;
  }
  function drawLedgeProp(g, px, py, x, y) {
    const h = Math.imul(x, 2246822519) ^ Math.imul(y, 3266489917);
    const u = (h ^ (h >>> 13)) >>> 0;
    const cx = px + TILE / 2, cy = py + TILE / 2;
    if (u % 2 === 0) {
      g.fillStyle = '#555a5e';
      g.beginPath();
      g.ellipse(cx, cy + 3, 9, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3a3e42';
      g.fillRect(cx - 7, cy - 6, 14, 9);
      g.fillStyle = '#6a7074';
      g.beginPath();
      g.ellipse(cx, cy - 6, 7, 3, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = '#4a4e52';
      g.fillRect(cx - 3, cy - 9, 6, 13);
      g.fillStyle = '#6a7074';
      g.beginPath();
      g.arc(cx, cy - 9, 4, Math.PI, Math.PI * 2);
      g.fill();
    }
  }

  // The night sky beyond the ledge -- a single flat color rather than a
  // per-tile gradient (which reads as a visible seam grid once you're
  // looking across more than one void tile), plus a sparse scatter of
  // twinkling stars.
  const VOID_COLOR = '#07080f';
  function drawVoidTile(g, px, py, x, y) {
    g.fillStyle = VOID_COLOR;
    g.fillRect(px, py, TILE, TILE);
    const h = Math.imul(x, 1274126177) ^ Math.imul(y, 2516582981);
    const u = (h ^ (h >>> 15)) >>> 0;
    if (u % 9 === 0) {
      g.fillStyle = `rgba(220,225,255,${0.3 + (u % 5) * 0.12})`;
      g.beginPath();
      g.arc(px + (u % TILE), py + ((u >> 4) % TILE), 0.9, 0, Math.PI * 2);
      g.fill();
    }
  }

  // A bright ledge line on the floor side of any tile bordering the void.
  function drawOuterEdges(g, minTX, maxTX, minTY, maxTY) {
    g.strokeStyle = 'rgba(210,212,224,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        const ch = LEVEL.grid[y][x];
        if (ch === '#') continue;
        const px = x * TILE, py = y * TILE;
        if (tileChar(x, y - 1) === '#') { g.moveTo(px, py + 1); g.lineTo(px + TILE, py + 1); }
        if (tileChar(x, y + 1) === '#') { g.moveTo(px, py + TILE - 1); g.lineTo(px + TILE, py + TILE - 1); }
        if (tileChar(x - 1, y) === '#') { g.moveTo(px + 1, py); g.lineTo(px + 1, py + TILE); }
        if (tileChar(x + 1, y) === '#') { g.moveTo(px + TILE - 1, py); g.lineTo(px + TILE - 1, py + TILE); }
      }
    }
    g.stroke();
  }

  // Shifts a '#rrggbb' color toward white (amt > 0) or black (amt < 0).
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clampC = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clampC(((n >> 16) & 255) + 255 * amt);
    const g2 = clampC(((n >> 8) & 255) + 255 * amt);
    const b = clampC((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  // A single tapered, suckered tentacle from (0,0) to (tx,ty) bowing through
  // (midX,midY) -- thick at the root, thin at the tip.
  function drawTaperedTentacle(g, tx, ty, midX, midY, baseWidth, color) {
    const segs = 4;
    let prevX = 0, prevY = 0;
    for (let s = 1; s <= segs; s++) {
      const tt = s / segs;
      const it = 1 - tt;
      const x = 2 * it * tt * midX + tt * tt * tx;
      const y = 2 * it * tt * midY + tt * tt * ty;
      g.beginPath();
      g.moveTo(prevX, prevY);
      g.lineTo(x, y);
      g.strokeStyle = color;
      g.lineWidth = Math.max(0.6, baseWidth * (1 - tt * 0.75));
      g.lineCap = 'round';
      g.stroke();
      prevX = x; prevY = y;
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    [0.55, 0.82].forEach((s) => {
      const it = 1 - s;
      const x = 2 * it * s * midX + s * s * tx;
      const y = 2 * it * s * midY + s * s * ty;
      g.beginPath();
      g.arc(x, y, baseWidth * 0.16, 0, Math.PI * 2);
      g.fill();
    });
  }

  function isOutside(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'L';
  }

  // A Warden's sight is only ever blocked by a building's own solid wall
  // -- everything else it can see over is open air, inside or out.
  function hasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / (TILE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const t2 = worldToTile(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      const ch = tileChar(t2.x, t2.y);
      if (ch === 'W') return false;
    }
    return true;
  }

  // ---- game state ----

  const BEST_TIME_KEY = 'goofy-horror-best-level28';
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
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0, isMoving: false,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
      shotgunAmmo: 0,
    };
  }

  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  // Three Wardens, light grey, four-winged -- true fliers. They never
  // touch the walkable graph players use: no pathfinding, just a direct
  // glide toward a patrol point or (once alert) straight at whoever
  // they're chasing, blocked only by a building's own solid wall and
  // the edge of the map. Nothing stops them crossing the open sky
  // between buildings -- that's the whole point of flying.
  function makeWarden(spawn, patrolStartIndex) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, radius: WARDEN_RADIUS, seed: Math.random() * 100,
      state: 'patrol', // 'patrol' | 'alert'
      target: null, targetX: 0, targetY: 0,
      patrolIndex: patrolStartIndex,
      frozenUntil: 0,
      wingPhase: Math.random() * 10,
    };
  }
  const monsters = LEVEL.monsterSpawns.map((spawn, i) =>
    makeWarden(spawn, Math.floor(i * LEVEL.patrolPoints.length / LEVEL.monsterSpawns.length)));

  // ---- the 3 power switches -- 2 inside, 1 outside. Walking near one
  // presses it permanently; once all 3 are pressed, the interior lights
  // come on and the exit gate opens.
  let switches = [];

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let superRadarUntil = 0;
  let smokeBombs = [];
  let nvgUntil = 0;
  let floatingTexts = [];
  let lightsAnnounced = false;

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
      p.stamina = STAMINA_MAX;
      p.moveState = 'normal';
      p.exhaustedUntil = 0;
      p.sprintActive = false;
      p.shotgunAmmo = 0;
    });

    monsters.forEach((m, i) => {
      const spawn = LEVEL.monsterSpawns[i];
      const c = tileCenter(spawn.x, spawn.y);
      m.x = c.x; m.y = c.y;
      m.state = 'patrol'; m.target = null;
      m.patrolIndex = Math.floor(i * LEVEL.patrolPoints.length / LEVEL.monsterSpawns.length);
      m.frozenUntil = 0;
    });

    switches = (LEVEL.switchSpawns || []).map((s) => ({ x: s.x, y: s.y, inside: s.inside, pressed: false }));
    lightsAnnounced = false;

    crates = (LEVEL.crateSpawns || []).map((c2) => ({
      x: c2.x, y: c2.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)], opened: false, openedAt: 0,
    }));
    radarUntil = 0;
    energyUntil = 0;
    scannerUntil = 0;
    superRadarUntil = 0;
    smokeBombs = [];
    nvgUntil = 0;
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
    if (ch === '#' || ch === 'W' || ch === 'C' || ch === 'F') return true;
    if (ch === 'G') return !gateOpen();
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
    if (p.caught) { p.isMoving = false; return; }
    p.isMoving = ix !== 0 || iy !== 0;
    if (!p.isMoving) return;
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
    if (isMoving) window.Footsteps.advance(p, dt * WALK_CYCLE_SPEED * speedMultiplierFor(p), audioCtx, FOOT_SURFACE, speedMultiplierFor(p));
  }

  function updateInputMovement(now, dt) {
    if (PLAYER_MODE === 1) {
      const ix = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0);
      const iy = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
      updatePlayerMovement(players[0], ix, iy, now, dt);
      return;
    }
    updatePlayerMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), now, dt);
    updatePlayerMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), now, dt);
  }

  function isHidden(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  function scannerTarget() {
    const next = switches.find((s) => !s.pressed);
    if (next) return tileCenter(next.x, next.y);
    return tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#10121c';
    if (ch === 'W' || ch === 'C' || ch === 'F') return '#24221e';
    if (ch === 'G') return gateOpen() ? '#4c9436' : '#8a3030';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'L') return '#4c4038';
    return '#45433e';
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

  function nearestMonster(x, y) {
    let best = monsters[0], bestD = Infinity;
    monsters.forEach((m) => {
      const d = Math.hypot(x - m.x, y - m.y);
      if (d < bestD) { bestD = d; best = m; }
    });
    return best;
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
      monsters.forEach((m) => {
        const px = mx + (m.x / WORLD_W) * MINIMAP_W;
        const py = my + (m.y / WORLD_H) * mh;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4d6d';
        ctx.shadowColor = '#ff4d6d';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
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
    } else if (item === 'co2') {
      monsters.forEach((m) => { if (Math.hypot(m.x - x, m.y - y) <= FREEZE_RADIUS_TILES * TILE) m.frozenUntil = now + FREEZE_DURATION_MS; });
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
    } else if (item === 'nightvision') {
      nvgUntil = now + NVG_DURATION_MS;
      spawnFloatingText(x, y, 'NIGHT VISION');
      playItemChime(1000);
    } else if (item === 'shotgun-ammo') {
      if (p.shotgunAmmo < SHOTGUN_AMMO_MAX) {
        p.shotgunAmmo++;
        spawnFloatingText(x, y, `TRANQUILIZER LOADED (${p.shotgunAmmo}/${SHOTGUN_AMMO_MAX})`);
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

  let lastGateHintAt = -Infinity;
  function updateTriggers(now) {
    // Pressing a switch -- instant on proximity, stays pressed.
    switches.forEach((s) => {
      if (s.pressed) return;
      const c = tileCenter(s.x, s.y);
      const held = players.some((p) => !p.caught && Math.hypot(p.x - c.x, p.y - c.y) < SWITCH_PRESS_RADIUS);
      if (held) {
        s.pressed = true;
        spawnFloatingText(c.x, c.y, 'SWITCH ON');
        playItemChime(820);
      }
    });
    if (!lightsAnnounced && gateOpen()) {
      lightsAnnounced = true;
      playDoorUnlockChime();
    }

    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);
      if (ch === 'X' && gameState === 'playing') {
        if (gateOpen()) {
          gameState = 'complete';
          playWinJingle();
          if (window.GoofyStory) window.GoofyStory.completeLevel(28);
          setTimeout(() => { window.location.href = 'level29.html'; }, 2000);
        } else if (now - lastGateHintAt > 2000) {
          lastGateHintAt = now;
          spawnFloatingText(tileCenter(t.x, t.y).x, tileCenter(t.x, t.y).y, 'PRESS ALL 3 SWITCHES FIRST');
        }
      }
    });
  }

  // ---- Warden AI: true flight, no pathfinding. Confined to the void
  // and the ledges -- a building's own solid wall (and the edge of the
  // map) are the only things that ever stop one.
  function wardenCanOccupy(ch) {
    return ch === '#' || ch === 'L';
  }

  function canWardenStandAt(x, y, radius) {
    const r = radius * 0.6;
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return wardenCanOccupy(tileChar(t.x, t.y));
    });
  }

  function moveWarden(m, dx, dy) {
    if (dx !== 0 && canWardenStandAt(m.x + dx, m.y, m.radius)) m.x += dx;
    if (dy !== 0 && canWardenStandAt(m.x, m.y + dy, m.radius)) m.y += dy;
  }

  // Direct spec: once a Warden locks onto you, that's it -- no grace
  // period to wait out. It stays locked on that specific player,
  // tracking their real position whenever it can still see them and
  // otherwise pursuing wherever it saw them last, until either it
  // catches them or they make it through a doorway. Only ever locks on
  // in the first place while you're actually moving -- stand still
  // outside, even in plain sight, and it has no reason to notice you.
  function updateWarden(m, now, dt) {
    if (now < m.frozenUntil) return; // frozen solid: no flight, no perception

    if (m.state === 'patrol') {
      for (const p of players) {
        if (p.caught || !p.isMoving || !isOutside(p) || isInSmoke(p, now)) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d <= WARDEN_SIGHT_RADIUS && hasLineOfSight(m.x, m.y, p.x, p.y)) {
          m.state = 'alert';
          m.target = p;
          m.targetX = p.x; m.targetY = p.y;
          break;
        }
      }
    } else {
      const p = m.target;
      if (!p || p.caught || !isOutside(p)) {
        m.state = 'patrol';
        m.target = null;
      } else if (hasLineOfSight(m.x, m.y, p.x, p.y)) {
        m.targetX = p.x; m.targetY = p.y;
      }
    }

    let tx, ty, speed;
    if (m.state === 'alert') {
      tx = m.targetX; ty = m.targetY; speed = WARDEN_CHASE_SPEED;
    } else {
      const pt = tileCenter(LEVEL.patrolPoints[m.patrolIndex].x, LEVEL.patrolPoints[m.patrolIndex].y);
      tx = pt.x; ty = pt.y; speed = WARDEN_PATROL_SPEED;
    }
    const dx = tx - m.x, dy = ty - m.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d < Math.max(step, 6)) {
      if (m.state === 'patrol') m.patrolIndex = (m.patrolIndex + 1) % LEVEL.patrolPoints.length;
    } else {
      moveWarden(m, (dx / d) * step, (dy / d) * step);
    }
    m.wingPhase += dt * (m.state === 'alert' ? 16 : 7);
  }

  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught) return;
      if (p.shotgunAmmo <= 0) return;
      monsters.forEach((m) => {
        if (now < m.frozenUntil || m.state !== 'alert') return;
        if (Math.hypot(p.x - m.x, p.y - m.y) < SHOTGUN_RANGE) {
          m.frozenUntil = now + SHOTGUN_STUN_MS;
          p.shotgunAmmo--;
          spawnFloatingText(m.x, m.y, 'STUNNED!');
          playShotgunBlast();
        }
      });
    });
  }

  function updateCatch(now) {
    monsters.forEach((m) => {
      if (now < m.frozenUntil) return;
      if (m.state !== 'alert') return;
      players.forEach((p) => {
        if (p.caught) return;
        if (!isOutside(p) || isInSmoke(p, now)) return; // ducking inside is immediate safety
        if (!p.isMoving) return;
        if (now < p.invulnerableUntil) return;
        if (Math.hypot(p.x - m.x, p.y - m.y) < CATCH_RADIUS) triggerCaught(p, now);
      });
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

  function drawBigCrates(g) {
    (LEVEL.bigCrateSpawns || []).forEach((c) => {
      const px = c.x * TILE, py = c.y * TILE;
      const w = TILE * 2, h = TILE * 2;
      const grad = g.createLinearGradient(px, py, px + w, py + h);
      grad.addColorStop(0, '#5a4228');
      grad.addColorStop(1, '#3a2a18');
      g.fillStyle = grad;
      g.fillRect(px + 2, py + 2, w - 4, h - 4);

      g.strokeStyle = '#1c130a';
      g.lineWidth = 2;
      g.strokeRect(px + 2, py + 2, w - 4, h - 4);
      g.beginPath();
      g.moveTo(px + 2, py + 2); g.lineTo(px + w - 2, py + h - 2);
      g.moveTo(px + w - 2, py + 2); g.lineTo(px + 2, py + h - 2);
      g.stroke();

      g.strokeStyle = 'rgba(255,200,120,0.25)';
      g.lineWidth = 1;
      g.strokeRect(px + 6, py + 6, w - 12, h - 12);

      g.fillStyle = '#1c130a';
      [[px + 5, py + 5], [px + w - 5, py + 5], [px + 5, py + h - 5], [px + w - 5, py + h - 5]].forEach(([bx, by]) => {
        g.beginPath();
        g.arc(bx, by, 2, 0, Math.PI * 2);
        g.fill();
      });
    });
  }

  function drawFans(g, now) {
    (LEVEL.fanSpawns || []).forEach((f) => {
      const cx = f.x * TILE + TILE, cy = f.y * TILE + TILE;
      const r = TILE * 0.9;
      g.save();
      g.translate(cx, cy);
      g.fillStyle = '#2e3034';
      g.fillRect(-r, -r, r * 2, r * 2);
      g.strokeStyle = '#17181a';
      g.lineWidth = 2;
      g.strokeRect(-r, -r, r * 2, r * 2);

      g.save();
      g.beginPath();
      g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#121315';
      g.fill();
      g.rotate(now * 0.006);
      g.fillStyle = '#4a4e54';
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.ellipse(r * 0.35, 0, r * 0.4, r * 0.14, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      g.strokeStyle = '#55585c';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      g.stroke();
      const spokes = 8;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
        g.lineTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
        g.stroke();
      }
      g.restore();
    });
  }

  // A power switch: a small wall-mounted box with a toggle -- dim red
  // and down while unpressed, lit green once it's on.
  function drawSwitch(g, s) {
    const c = tileCenter(s.x, s.y);
    g.save();
    g.translate(c.x, c.y);
    g.fillStyle = '#3a3a3e';
    g.fillRect(-7, -10, 14, 20);
    g.strokeStyle = '#161618';
    g.lineWidth = 1.5;
    g.strokeRect(-7, -10, 14, 20);
    const on = s.pressed;
    g.fillStyle = on ? '#2a9c5c' : '#6a2a2a';
    g.fillRect(-4, on ? -7 : 1, 8, 6);
    g.beginPath();
    g.arc(0, on ? -9 : 8, 2, 0, Math.PI * 2);
    g.fillStyle = on ? '#3ddc84' : '#ff4040';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = on ? 7 : 3;
    g.fill();
    g.shadowBlur = 0;
    g.restore();
  }

  // A ceiling light fixture, interior only -- a dark, unlit disc until
  // every switch is pressed, then a warm, glowing lamp.
  function drawLightFixture(g, p, on, now) {
    const c = tileCenter(p.x, p.y);
    g.save();
    g.translate(c.x, c.y);
    if (on) {
      const flicker = 0.9 + Math.sin(now * 0.01 + p.x) * 0.05;
      g.beginPath();
      g.arc(0, 0, 14 * flicker, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,228,170,${0.5 * flicker})`;
      g.shadowColor = '#ffe4aa';
      g.shadowBlur = 16;
      g.fill();
      g.shadowBlur = 0;
    }
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fillStyle = on ? '#2a241a' : '#1c1c1e';
    g.fill();
    g.strokeStyle = on ? '#ffe4aa' : '#3a3a3e';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  function drawGate(g) {
    const gate = LEVEL.gate;
    if (!gate) return;
    const open = gateOpen();
    const x0 = gate.x0 * TILE, y0 = gate.y * TILE;
    const w = (gate.x1 - gate.x0 + 1) * TILE, h = (gate.h || 1) * TILE;
    g.save();
    if (open) {
      g.fillStyle = 'rgba(61,220,132,0.12)';
      g.fillRect(x0, y0, w, h);
      g.strokeStyle = '#3ddc84';
      g.lineWidth = 2;
      g.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
    } else {
      g.fillStyle = '#2a1216';
      g.fillRect(x0, y0, w, h);
      g.strokeStyle = '#120608';
      g.lineWidth = 2;
      g.strokeRect(x0, y0, w, h);
      g.save();
      g.beginPath();
      g.rect(x0, y0, w, h);
      g.clip();
      g.strokeStyle = 'rgba(200,60,50,0.55)';
      g.lineWidth = 5;
      for (let i = -h; i < w + h; i += 10) {
        g.beginPath();
        g.moveTo(x0 + i, y0 + h);
        g.lineTo(x0 + i + h, y0);
        g.stroke();
      }
      g.restore();
    }
    g.restore();
  }

  // A plain brick-coursed concrete wall for the building's own shell.
  function drawWallTile(g, px, py, x, y) {
    g.fillStyle = '#423f3a';
    g.fillRect(px, py, TILE, TILE);
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1;
    const rowOffset = (y % 2) * (TILE / 2);
    g.beginPath();
    g.moveTo(px, py + TILE / 2);
    g.lineTo(px + TILE, py + TILE / 2);
    g.moveTo(px + ((rowOffset) % TILE), py);
    g.lineTo(px + ((rowOffset) % TILE), py + TILE / 2);
    g.moveTo(px + ((rowOffset + TILE / 2) % TILE), py + TILE / 2);
    g.lineTo(px + ((rowOffset + TILE / 2) % TILE), py + TILE);
    g.stroke();
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
        if (ch === '#') {
          drawVoidTile(g, px, py, x, y);
          continue;
        }
        if (ch === 'W') {
          drawWallTile(g, px, py, x, y);
          continue;
        }
        if (ch === 'G') {
          g.fillStyle = gateOpen() ? interiorShade(x, y) : '#2a1216';
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'S') {
          g.fillStyle = interiorShade(x, y);
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'E') {
          g.fillStyle = '#3a301f';
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'C' || ch === 'F') {
          g.fillStyle = ledgeShade(x, y);
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'L') {
          if (isBoardwalk(x, y)) {
            drawBoardwalkPlank(g, px, py, x, y);
          } else {
            g.fillStyle = ledgeShade(x, y);
            g.fillRect(px, py, TILE, TILE);
            if (hasProp(x, y)) drawLedgeProp(g, px, py, x, y);
          }
          continue;
        }
        // '.' / 'X' / 'P' -- interior floor
        g.fillStyle = interiorShade(x, y);
        g.fillRect(px, py, TILE, TILE);
      }
    }

    drawOuterEdges(g, minTX, maxTX, minTY, maxTY);
    drawBigCrates(g);
    drawFans(g, now);
    drawGate(g);
    switches.forEach((s) => drawSwitch(g, s));
    (LEVEL.interiorLights || []).forEach((p) => drawLightFixture(g, p, gateOpen(), now));

    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    g.beginPath();
    g.arc(ex.x, ex.y, 12, 0, Math.PI * 2);
    g.fillStyle = gateOpen() ? '#ffd27a' : '#6a6a62';
    g.fill();

    drawSafeZone(g);
    drawBloodSplatters(g);
    drawCrates(g);
    drawFloatingTexts(g);
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

  // A single wing, scaled relative to the body radius and anchored off
  // -center so the span clearly reads past the body's own silhouette.
  function drawWing(g, side, flap, color, radius, spanMult, rootY) {
    const span = radius * spanMult, sweep = Math.sin(flap) * 0.5;
    g.save();
    g.translate(0, rootY);
    g.scale(side, 1);
    g.rotate(0.25 + sweep);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(span * 0.5, -span * 0.35, span, -span * 0.1);
    g.quadraticCurveTo(span * 0.6, span * 0.15, span * 0.3, span * 0.05);
    g.quadraticCurveTo(span * 0.15, span * 0.1, 0, 0);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 0.75;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = 1;
    [0.4, 0.7, 1].forEach((f) => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(span * f, -span * 0.1 * f);
      g.stroke();
    });
    g.restore();
  }

  // The Warden: light grey stone, four wings (a larger front pair and a
  // smaller rear pair, beating slightly out of phase, 2x the original
  // span -- direct request, so they read as the biggest thing in view),
  // a drop shadow on whatever's below it, and the same short idle
  // tentacle stubs its cousin the Reacher has underneath.
  function drawWarden(g, now, m) {
    const flap = m.wingPhase;
    const hover = Math.sin(now * 0.004 + m.seed) * 3;

    g.save();
    g.translate(m.x, m.y + m.radius * 0.6);
    g.beginPath();
    g.ellipse(0, 10, m.radius * 0.8, m.radius * 0.3, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fill();
    g.restore();

    g.save();
    g.translate(m.x, m.y + hover);

    const wingColor = m.state === 'alert' ? '#a85a68' : '#8a8e96';
    const wingColorBack = m.state === 'alert' ? '#8a4a56' : '#6e7278';
    drawWing(g, -1, flap, wingColorBack, m.radius, 2.6, m.radius * 0.1);
    drawWing(g, 1, flap, wingColorBack, m.radius, 2.6, m.radius * 0.1);
    drawWing(g, -1, flap + 0.6, wingColor, m.radius, 3.8, -m.radius * 0.2);
    drawWing(g, 1, flap + 0.6, wingColor, m.radius, 3.8, -m.radius * 0.2);

    const stubCount = 5;
    for (let i = 0; i < stubCount; i++) {
      const a = (i / stubCount) * Math.PI + Math.PI * 0.5 + m.seed * 0.1;
      const len = m.radius * 0.9;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + m.radius * 0.4;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, m.radius * 0.14, '#5a5e64');
    }

    const r = m.radius;
    const grad = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    grad.addColorStop(0, m.state === 'alert' ? '#c4c8d0' : '#9a9ea6');
    grad.addColorStop(1, '#55585e');
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#3a3c40';
    g.lineWidth = 2.5;
    g.stroke();

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + m.seed * 0.5;
      const bx = Math.cos(a) * r * 0.65, by = Math.sin(a) * r * 0.65;
      g.beginPath();
      g.arc(bx, by, r * 0.14, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fill();
    }

    const alert = m.state === 'alert';
    const er = r * 0.32;
    g.beginPath();
    g.arc(0, 0, er * 1.3, 0, Math.PI * 2);
    g.fillStyle = '#16181c';
    g.fill();
    g.shadowColor = alert ? '#ff3050' : '#4a6a8a';
    g.shadowBlur = alert ? 18 : 6;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = alert ? '#ff3050' : '#4a6a8a';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.ellipse(0, 0, er * 0.3, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();

    if (now < m.frozenUntil) {
      const points = 12;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const rr = r + 3;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
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

  function drawLimb(g, hipX, hipY, tipX, tipY, width, color, capColor, capR) {
    // A slight elbow/knee bow instead of a dead-straight line, plus a
    // lit hand/foot instead of a flat-filled circle -- more follow-up
    // for a more expressive chimp body.
    const mx = (hipX + tipX) / 2, my = (hipY + tipY) / 2;
    const dx = tipX - hipX, dy = tipY - hipY;
    const len = Math.hypot(dx, dy) || 1;
    const bend = len * 0.14;
    const bx = mx - (dy / len) * bend, by = my + (dx / len) * bend;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.quadraticCurveTo(bx, by, tipX, tipY);
    g.stroke();
    const capGrad = g.createRadialGradient(tipX - capR * 0.3, tipY - capR * 0.3, capR * 0.1, tipX, tipY, capR);
    capGrad.addColorStop(0, capColor);
    capGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.beginPath();
    g.arc(tipX, tipY, capR, 0, Math.PI * 2);
    g.fillStyle = capGrad;
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

      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(p.color, -0.45);
      const bootColor = '#2b2b28';

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

      // Chimp ears + muzzle, drawn first so the glass dome mostly
      // covers them -- only the bits that poke out past its round rim
      // show, same as a real head inside an open helmet. Direct
      // request: "make the player model a chimp with a helmet on", with
      // a later follow-up for more face/fur detail.
      const furShade = shade(p.color, -0.2);
      [-1, 1].forEach((side) => {
        g.beginPath();
        g.arc(-headR * 0.1, side * headR * 0.75, headR * 0.38, 0, Math.PI * 2);
        g.fillStyle = furShade;
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        g.lineWidth = 0.75;
        g.stroke();
        // a little inner-ear shading so the ears read as cupped, not flat
        g.beginPath();
        g.arc(-headR * 0.05, side * headR * 0.75, headR * 0.2, 0, Math.PI * 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fill();
      });
      // a small tuft of fur at the back of the head, poking past the
      // dome's rim the same way the ears do -- breaks up the dome's
      // silhouette on the side with no muzzle to do that job instead.
      g.beginPath();
      g.moveTo(-headR * 0.85, -headR * 0.2);
      g.quadraticCurveTo(-headR * 1.18, -headR * 0.06, -headR * 0.92, headR * 0.12);
      g.quadraticCurveTo(-headR * 1.08, headR * 0.2, -headR * 0.8, headR * 0.3);
      g.closePath();
      g.fillStyle = furShade;
      g.fill();
      g.beginPath();
      g.ellipse(headR * 0.65, headR * 0.1, headR * 0.5, headR * 0.38, 0, 0, Math.PI * 2);
      g.fillStyle = '#4a3828';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 0.75;
      g.stroke();
      g.beginPath();
      g.arc(headR * 1.0, headR * 0.0, headR * 0.07, 0, Math.PI * 2);
      g.arc(headR * 1.0, headR * 0.22, headR * 0.07, 0, Math.PI * 2);
      g.fillStyle = '#1c130c';
      g.fill();
      // a small mouth line under the nostrils
      g.beginPath();
      g.moveTo(headR * 0.88, headR * 0.38);
      g.quadraticCurveTo(headR * 1.02, headR * 0.46, headR * 1.16, headR * 0.36);
      g.strokeStyle = 'rgba(15,8,6,0.65)';
      g.lineWidth = headR * 0.08;
      g.lineCap = 'round';
      g.stroke();

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
      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl), 1);
      punchLight(maskCtx, s.x, s.y, 230 * nvgMult * HM.flicker(pl), 0.85);
    });

    // Once every switch is pressed, the interior's own ceiling lights
    // become real light sources too, not just a visual flourish.
    if (gateOpen()) {
      (LEVEL.interiorLights || []).forEach((p) => {
        const c = tileCenter(p.x, p.y);
        const s = worldToScreen(c.x, c.y);
        punchLight(maskCtx, s.x, s.y, 80, 0.9);
        punchLight(maskCtx, s.x, s.y, 150, 0.6);
      });
    }
  }

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    // the screen smears out the closer it gets (instead of a red flash)
    window.ScreenFx.proximity(ctx, vx, 0, VIEW_W, VIEW_H, closeness);
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
    ctx.fillStyle = '#05060c';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);
    drawTiles(ctx, camX, camY, now);
    drawSmokeBombs(ctx, now);
    monsters.forEach((m) => HM.monster(ctx, m, (c) => drawWarden(c, now, m)));
    drawPlayers(ctx);
    drawParticles(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    const nearest = nearestMonster(p.x, p.y);
    drawProximityWarning(vx, Math.hypot(p.x - nearest.x, p.y - nearest.y), now);
    drawRadar(vx, p, now, nearest);
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

  function drawRadar(vx, p, now, nearest) {
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
    const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
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
    ctx.fillStyle = `rgba(50,10,55,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    const shake = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawJaw(ctx, vx, 1, jawProgress, '#1c0a24');
    drawJaw(ctx, vx, -1, jawProgress, '#13071a');

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
      messageEl.innerHTML = 'POWER RESTORED &mdash; heading back to the menu&hellip;';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    if (gameState === 'complete' && !bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
      if (window.GoofyStory) window.GoofyStory.completeLevel(28);
    }

    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
    if (hudSwitchesEl) {
      const pressedCount = switches.filter((s) => s.pressed).length;
      hudSwitchesEl.textContent = `Switches: ${pressedCount}/${switches.length}`;
      hudSwitchesEl.classList.toggle('done', pressedCount === switches.length);
    }
  }

  let lastFrameTime = null;

  function loop(now) {
    try {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'playing') {
      elapsedMs = now - runStartTime;
      updateInputMovement(now, dt);
      updateTriggers(now);
      updateCrates(now);
      updateSmokeBombs(now);
      monsters.forEach((m) => updateWarden(m, now, dt));
      updateShotgunDefense(now);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
      updateSafeMusic(players.some(isHidden));
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    if (PLAYER_MODE === 2) {
      renderViewport(1, now);
      drawDivider();
    }

    if (catchFlash > 0) {
      ctx.fillStyle = `rgba(180,20,30,${catchFlash * 0.5})`;
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
