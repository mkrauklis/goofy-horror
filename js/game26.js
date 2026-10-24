(function () {
  const HM = window.HardMode;
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(26)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL26;
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
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 1.0);
  const MONSTER_SIGHT_RADIUS = 220;
  const ALERT_GRACE_MS = 2500;
  const REPATH_MS = 500;
  const CATCH_RADIUS = 22;
  const PROXIMITY_WARNING_RADIUS = 380;
  const RADAR_DURATION_MS = HM.ability(10000);
  const ENERGY_DURATION_MS = HM.ability(10000);
  const SCANNER_DURATION_MS = HM.ability(10000);
  const FREEZE_DURATION_MS = HM.ability(10000);
  const FREEZE_RADIUS_TILES = 15; // freezes only reach the Reacher if it's this close to where the item was used
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

  // ---- generators (the way out) ----
  const GENERATOR_HOLD_MS = 5000;
  const GENERATOR_INTERACT_RADIUS = 30;
  const GENERATOR_DECAY_MULT = 2; // decays twice as fast as it fills once nobody's there

  // ---- missiles -- the Reacher's own ranged attack. Fires at whichever
  // player it can currently see, every few seconds, independent of
  // patrol/alert state (same convention as Level 22's Kindling and Level
  // 24's Sentry) -- a real flying projectile, not an instant hitscan, so
  // it can be seen coming and dodged.
  const MISSILE_INTERVAL_MS = 3000;
  const MISSILE_SPEED = HM.proj(PLAYER_SPEED * 2.5);
  const MISSILE_HIT_RADIUS = TILE * 0.65;
  const MISSILE_LIFETIME_MS = 4500;

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
  const hudGeneratorsEl = document.getElementById('hud-generators');

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

  // A short rising-pitch whoosh -- the missile's own launch cue, distinct
  // from the shotgun-stun's sharp crack.
  function playMissileLaunch() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, start);
    osc.frequency.exponentialRampToValueAtTime(520, start + 0.22);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.26);
  }

  function playWinJingle() {
    [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14));
  }

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.min(...players.map((p) => Math.hypot(p.x - mon.x, p.y - mon.y)));
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
    return generators.every((g) => g.solved);
  }

  // A handful of near-identical dark tar/gravel tones, picked per-tile by
  // hashing its coordinates, so a rooftop reads as a worn, uneven surface
  // instead of one flat color.
  const ROOF_SHADES = ['#33343a', '#383a40', '#3d3f45', '#30323a', '#3a3c43'];
  function roofShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % ROOF_SHADES.length;
    return ROOF_SHADES[idx];
  }

  const boardwalkSet = new Set();
  (LEVEL.boardwalks || []).forEach((b) => {
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) boardwalkSet.add(`${x},${y}`);
    }
  });
  function isBoardwalk(x, y) {
    return boardwalkSet.has(`${x},${y}`);
  }

  // A plain wood-plank floor across every boardwalk tile: horizontal grain
  // lines plus a vertical seam every TILE/2 for individual planks.
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

  // A sparse scatter of rooftop clutter -- vent caps and stubby pipes,
  // fixed per tile (hashed, like the roof shading), purely decorative.
  const ROOFPROP_TILE_CHANCE = 6;
  function hasRoofProp(x, y) {
    const h = Math.imul(x, 2246822519) ^ Math.imul(y, 3266489917);
    const u = (h ^ (h >>> 15)) >>> 0;
    return (u % 100) < ROOFPROP_TILE_CHANCE;
  }
  function drawRoofProp(g, px, py, x, y) {
    const h = Math.imul(x, 2246822519) ^ Math.imul(y, 3266489917);
    const u = (h ^ (h >>> 13)) >>> 0;
    const cx = px + TILE / 2, cy = py + TILE / 2;
    if (u % 2 === 0) {
      // a squat vent cap
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
      // a thin pipe stub with a cap
      g.fillStyle = '#4a4e52';
      g.fillRect(cx - 3, cy - 9, 6, 13);
      g.fillStyle = '#6a7074';
      g.beginPath();
      g.arc(cx, cy - 9, 4, Math.PI, Math.PI * 2);
      g.fill();
    }
  }

  // The night sky beyond the rooftop edges -- a single flat color rather
  // than a per-tile gradient. A gradient that restarts at every tile's own
  // top edge reads as a visible repeating band once you're looking across
  // more than one void tile at a time -- a seam grid, not a sky. One flat
  // color plus a sparse scatter of twinkling stars avoids that seam
  // entirely while still reading as open night air.
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

  // A bright ledge line on the floor side of any tile bordering the void --
  // sells the "edge of a roof, a long way up" read without needing an
  // actual falling mechanic.
  function drawRoofEdges(g, minTX, maxTX, minTY, maxTY) {
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

  function hasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / (TILE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const t2 = worldToTile(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      const ch = tileChar(t2.x, t2.y);
      if (ch === '#' || (ch === 'G' && !gateOpen())) return false;
    }
    return true;
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

  // ---- game state ----

  const BEST_TIME_KEY = 'goofy-horror-best-level26';
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

  // The Reacher -- a mottled violet blob that actually roams the rooftops
  // now, same sight-based patrol/chase model every other monster in this
  // game uses, plus its own missile launcher firing at whichever player
  // it can currently see.
  function makeReacher(patrolStartIndex) {
    const spawn = LEVEL.monsterSpawns[0];
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, radius: 32, seed: Math.random() * 100,
      path: [], pathIndex: 0, nextRepathAt: 0,
      lookDir: { x: 1, y: 0 },
      state: 'patrol', // 'patrol' | 'alert'
      alertUntil: 0, alertTargetTile: null,
      patrolIndex: patrolStartIndex,
      frozenUntil: 0,
      nextMissileAt: 0,
    };
  }
  const mon = makeReacher(0);

  let missiles = []; // { x, y, dx, dy, bornAt }

  let generators = (LEVEL.generatorSpawns || []).map((g) => ({ x: g.x, y: g.y, heldMs: 0, solved: false }));

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let superRadarUntil = 0;
  let smokeBombs = [];
  let nvgUntil = 0;
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
      p.stamina = STAMINA_MAX;
      p.moveState = 'normal';
      p.exhaustedUntil = 0;
      p.sprintActive = false;
      p.shotgunAmmo = 0;
    });

    const spawn = LEVEL.monsterSpawns[0];
    const c = tileCenter(spawn.x, spawn.y);
    mon.x = c.x; mon.y = c.y;
    mon.path = []; mon.pathIndex = 0; mon.nextRepathAt = 0;
    mon.state = 'patrol'; mon.alertUntil = 0; mon.alertTargetTile = null;
    mon.frozenUntil = 0;
    mon.nextMissileAt = performance.now() + MISSILE_INTERVAL_MS;
    missiles = [];

    generators.forEach((g) => { g.heldMs = 0; g.solved = false; });

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
    if (ch === '#') return true;
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
    if (isMoving) p.walkPhase += dt * WALK_CYCLE_SPEED * speedMultiplierFor(p);
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
    const next = generators.find((g) => !g.solved);
    if (next) return tileCenter(next.x, next.y);
    return tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#10121c';
    if (ch === 'G') return gateOpen() ? '#4c9436' : '#8a3030';
    if (ch === 'S') return '#3ddc84';
    return '#4c4038';
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
      const px = mx + (mon.x / WORLD_W) * MINIMAP_W;
      const py = my + (mon.y / WORLD_H) * mh;
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
    } else if (item === 'co2') {
      if (Math.hypot(mon.x - x, mon.y - y) <= FREEZE_RADIUS_TILES * TILE) mon.frozenUntil = now + FREEZE_DURATION_MS;
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

  let lastGeneratorHintAt = -Infinity;
  function updateTriggers(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);

      if (ch === 'X' && gameState === 'playing') {
        if (generators.every((g) => g.solved)) {
          gameState = 'complete';
          playWinJingle();
          if (window.GoofyStory) window.GoofyStory.completeLevel(26);
          setTimeout(() => { window.location.href = 'level27.html'; }, 2000);
        } else if (now - lastGeneratorHintAt > 2000) {
          lastGeneratorHintAt = now;
          spawnFloatingText(tileCenter(t.x, t.y).x, tileCenter(t.x, t.y).y, 'START ALL 3 GENERATORS FIRST');
        }
      }
    });
  }

  function updateGenerators(now, dt) {
    generators.forEach((g) => {
      if (g.solved) return;
      const c = tileCenter(g.x, g.y);
      const held = players.some((p) => !p.caught && Math.hypot(p.x - c.x, p.y - c.y) < GENERATOR_INTERACT_RADIUS);
      if (held) {
        g.heldMs = Math.min(GENERATOR_HOLD_MS, g.heldMs + dt * 1000);
        if (g.heldMs >= GENERATOR_HOLD_MS) {
          g.solved = true;
          spawnFloatingText(c.x, c.y, 'GENERATOR ONLINE');
          playDoorUnlockChime();
        }
      } else {
        g.heldMs = Math.max(0, g.heldMs - dt * 1000 * GENERATOR_DECAY_MULT);
      }
    });
  }

  // ---- Reacher AI: sight-based patrol/chase, same model as every other
  // monster in this game, plus its own missile launcher. ----
  function monsterCanOccupy(ch) {
    if (ch === '#' || ch === 'S') return false;
    if (ch === 'G') return gateOpen();
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

  function updateDetection(m, now) {
    for (const p of players) {
      if (p.caught || isHidden(p) || isInSmoke(p, now)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d <= MONSTER_SIGHT_RADIUS && hasLineOfSight(m.x, m.y, p.x, p.y)) {
        m.state = 'alert';
        m.alertUntil = now + ALERT_GRACE_MS;
        m.alertTargetTile = worldToTile(p.x, p.y);
      }
    }
    if (m.state === 'alert' && now >= m.alertUntil) {
      m.state = 'patrol';
      m.path = [];
      m.pathIndex = 0;
    }
  }

  // The closest currently-visible player, for the missile launcher to aim
  // at -- null if nothing is in sight right now.
  function closestVisiblePlayer(m, now) {
    let best = null, bestD = Infinity;
    for (const p of players) {
      if (p.caught || isHidden(p) || isInSmoke(p, now)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d <= MONSTER_SIGHT_RADIUS && d < bestD && hasLineOfSight(m.x, m.y, p.x, p.y)) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  // Fires every 3 seconds at whichever player it can currently see that's
  // closest -- independent of patrol/alert state, same convention as
  // Level 22's Kindling and Level 24's Sentry shotguns, just a slower,
  // dodgeable projectile instead of a hitscan blast.
  function updateMonsterMissiles(m, now) {
    if (now < m.nextMissileAt) return;
    const target = closestVisiblePlayer(m, now);
    if (!target) return;
    m.nextMissileAt = now + MISSILE_INTERVAL_MS;
    const dx = target.x - m.x, dy = target.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    missiles.push({
      x: m.x, y: m.y, dx: (dx / d) * MISSILE_SPEED, dy: (dy / d) * MISSILE_SPEED, bornAt: now,
    });
    playMissileLaunch();
  }

  // Missiles fly straight and don't care about the void between buildings
  // -- they're airborne, not foot traffic -- so the only things that stop
  // one are a player (a hit) or its own fuel running out (lifetime).
  function updateMissiles(now, dt) {
    for (let i = missiles.length - 1; i >= 0; i--) {
      const b = missiles[i];
      b.x += b.dx * dt;
      b.y += b.dy * dt;
      if (now - b.bornAt > MISSILE_LIFETIME_MS) { missiles.splice(i, 1); continue; }
      let hit = false;
      players.forEach((p) => {
        if (hit || p.caught || now < p.invulnerableUntil) return;
        if (Math.hypot(p.x - b.x, p.y - b.y) < MISSILE_HIT_RADIUS) {
          triggerCaught(p, now);
          hit = true;
        }
      });
      if (hit) missiles.splice(i, 1);
    }
  }

  function updateMonster(m, now, dt) {
    if (now < m.frozenUntil) return; // frozen solid: no movement, no perception

    updateMonsterMissiles(m, now);
    updateDetection(m, now);

    if (now >= m.nextRepathAt) {
      m.nextRepathAt = now + REPATH_MS;
      const startTile = worldToTile(m.x, m.y);
      const goalTile = m.state === 'alert' ? m.alertTargetTile : LEVEL.patrolPoints[m.patrolIndex];
      const graph = buildMonsterGraph();
      const path = bfsPath(graph, startTile, goalTile);
      if (path && path.length > 1) {
        m.path = path.slice(1);
        m.pathIndex = 0;
      } else {
        m.path = [];
        m.pathIndex = 0;
        if (m.state === 'patrol') {
          m.patrolIndex = (m.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      }
    }

    if (m.path && m.pathIndex < m.path.length) {
      const step = MONSTER_SPEED * dt;
      const target = tileTargetWithOffset(m.path[m.pathIndex]);
      const dx = target.x - m.x, dy = target.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) m.lookDir = { x: dx / d, y: dy / d };
      if (d < step) {
        m.x = target.x; m.y = target.y;
        m.pathIndex++;
        if (m.pathIndex >= m.path.length && m.state === 'patrol') {
          m.patrolIndex = (m.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      } else {
        m.x += (dx / d) * step;
        m.y += (dy / d) * step;
      }
    }
  }

  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught) return;
      if (p.shotgunAmmo <= 0) return;
      if (now < mon.frozenUntil || mon.state !== 'alert') return;
      if (Math.hypot(p.x - mon.x, p.y - mon.y) < SHOTGUN_RANGE) {
        mon.frozenUntil = now + SHOTGUN_STUN_MS;
        p.shotgunAmmo--;
        spawnFloatingText(mon.x, mon.y, 'STUNNED!');
        playShotgunBlast();
      }
    });
  }

  function updateCatch(now) {
    if (now < mon.frozenUntil) return;
    if (mon.state !== 'alert') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (isHidden(p) || isInSmoke(p, now)) return;
      if (!p.isMoving) return;
      if (now < p.invulnerableUntil) return;
      if (Math.hypot(p.x - mon.x, p.y - mon.y) < CATCH_RADIUS) triggerCaught(p, now);
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

  function drawGenerators(g, now) {
    generators.forEach((gen) => {
      const c = tileCenter(gen.x, gen.y);
      const frac = gen.heldMs / GENERATOR_HOLD_MS;
      g.save();
      g.translate(c.x, c.y);
      g.fillStyle = gen.solved ? '#2a9c5c' : '#4a4a46';
      g.fillRect(-11, -14, 22, 28);
      g.strokeStyle = '#1c1c1a';
      g.lineWidth = 2;
      g.strokeRect(-11, -14, 22, 28);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 1;
      [-7, -2, 3, 8].forEach((yy) => {
        g.beginPath(); g.moveTo(-11, yy); g.lineTo(11, yy); g.stroke();
      });
      if (!gen.solved && frac > 0) {
        g.fillStyle = '#3ddc84';
        g.fillRect(-9, 12 - 24 * frac, 18, 24 * frac);
      }
      g.fillStyle = '#2a2a28';
      g.fillRect(-5, -20, 10, 7);
      g.beginPath();
      g.arc(0, -17, 2.2, 0, Math.PI * 2);
      const lightColor = gen.solved ? '#3ddc84' : '#ff4040';
      g.fillStyle = lightColor;
      g.shadowColor = lightColor;
      g.shadowBlur = gen.solved ? 8 : (now % 1000 < 500 ? 6 : 2);
      g.fill();
      g.shadowBlur = 0;
      g.restore();
    });
  }

  // The gate: a chain-link shutter, red and hazard-striped while closed,
  // green and standing open once all 3 generators are running.
  function drawGate(g) {
    const gate = LEVEL.gate;
    if (!gate) return;
    const open = gateOpen();
    const x0 = gate.x0 * TILE, y0 = gate.y * TILE;
    const w = (gate.x1 - gate.x0 + 1) * TILE, h = TILE;
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
        if (ch === 'G') {
          g.fillStyle = gateOpen() ? roofShade(x, y) : '#2a1216';
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'S') {
          g.fillStyle = roofShade(x, y);
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'E') {
          g.fillStyle = '#3a301f';
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        // plain floor ('.'/'X') -- boardwalk plank or bare rooftop
        if (isBoardwalk(x, y)) {
          drawBoardwalkPlank(g, px, py, x, y);
        } else {
          g.fillStyle = roofShade(x, y);
          g.fillRect(px, py, TILE, TILE);
          if (hasRoofProp(x, y)) drawRoofProp(g, px, py, x, y);
        }
      }
    }

    drawRoofEdges(g, minTX, maxTX, minTY, maxTY);
    drawGenerators(g, now);
    drawGate(g);

    const allSolved = generators.every((gr) => gr.solved);
    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    g.beginPath();
    g.arc(ex.x, ex.y, 12, 0, Math.PI * 2);
    g.fillStyle = allSolved ? '#ffd27a' : '#6a6a62';
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

  // A mottled violet blob with a slit red eye and a crown of short idle
  // tentacle stubs that wave constantly as it roams -- the body is the
  // same one the stationary version of this creature had, it just
  // actually walks around on it now.
  function drawReacher(g, now, m) {
    g.save();
    g.translate(m.x, m.y);

    const stubCount = 7;
    for (let i = 0; i < stubCount; i++) {
      const a = (i / stubCount) * Math.PI * 2 + m.seed;
      const len = m.radius * (1.3 + 0.3 * Math.sin(now * 0.0015 + i * 2 + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const wob = Math.sin(now * 0.003 + i + m.seed) * m.radius * 0.3;
      const midX = Math.cos(a) * len * 0.5 - Math.sin(a) * wob;
      const midY = Math.sin(a) * len * 0.5 + Math.cos(a) * wob;
      drawTaperedTentacle(g, tx, ty, midX, midY, m.radius * 0.18, m.state === 'alert' ? '#8a3aa0' : '#4a2a5a');
    }

    const r = m.radius;
    const grad = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    grad.addColorStop(0, m.state === 'alert' ? '#9a4ab0' : '#5a3468');
    grad.addColorStop(1, '#231228');
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 14;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#130a16';
    g.lineWidth = 2.5;
    g.stroke();

    // a few knobby bumps for texture
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + m.seed * 0.5;
      const bx = Math.cos(a) * r * 0.65, by = Math.sin(a) * r * 0.65;
      g.beginPath();
      g.arc(bx, by, r * 0.14, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fill();
    }

    const alert = m.state === 'alert';
    const er = r * 0.32;
    g.beginPath();
    g.arc(0, 0, er * 1.3, 0, Math.PI * 2);
    g.fillStyle = '#0c0410';
    g.fill();
    g.shadowColor = alert ? '#ff3050' : '#8a2a40';
    g.shadowBlur = alert ? 18 : 6;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = alert ? '#ff3050' : '#8a2a40';
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

  // The Reacher's missiles: a bright flame trail with a dark body and a
  // red warhead nose, oriented along its direction of travel.
  function drawMissiles(g) {
    missiles.forEach((b) => {
      const d = Math.hypot(b.dx, b.dy) || 1;
      const ux = b.dx / d, uy = b.dy / d;
      const tailX = b.x - ux * 22, tailY = b.y - uy * 22;
      g.strokeStyle = 'rgba(255,140,40,0.85)';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.shadowColor = '#ff6a1a';
      g.shadowBlur = 10;
      g.beginPath();
      g.moveTo(tailX, tailY);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.shadowBlur = 0;

      g.save();
      g.translate(b.x, b.y);
      g.rotate(Math.atan2(b.dy, b.dx));
      g.fillStyle = '#5a5f66';
      g.fillRect(-14, -2.4, 11, 4.8);
      g.fillStyle = '#c94a2a';
      g.beginPath();
      g.moveTo(-3, -2.6); g.lineTo(4, 0); g.lineTo(-3, 2.6); g.closePath();
      g.fill();
      g.restore();

      g.beginPath();
      g.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
      g.fillStyle = '#fff4c0';
      g.fill();
    });
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
      punchLight(maskCtx, s.x, s.y, 90 * nvgMult, 1);
      punchLight(maskCtx, s.x, s.y, 230 * nvgMult, 0.85);
    });
  }

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    const alpha = closeness * 0.6 * pulse;
    ctx.fillStyle = `rgba(200,20,20,${alpha})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
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
    drawMissiles(ctx);
    HM.monster(ctx, mon, (c) => drawReacher(c, now, mon));
    drawPlayers(ctx);
    drawParticles(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    drawProximityWarning(vx, Math.hypot(p.x - mon.x, p.y - mon.y), now);
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
    const angle = Math.atan2(mon.y - p.y, mon.x - p.x);
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
      messageEl.innerHTML = 'ALL GENERATORS ONLINE &mdash; heading to the next wing&hellip;';
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
      if (window.GoofyStory) window.GoofyStory.completeLevel(26);
    }

    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
    if (hudGeneratorsEl) {
      const solvedCount = generators.filter((g) => g.solved).length;
      hudGeneratorsEl.textContent = `Generators: ${solvedCount}/${generators.length}`;
      hudGeneratorsEl.classList.toggle('done', solvedCount === generators.length);
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
      updateGenerators(now, dt);
      updateMonster(mon, now, dt);
      updateMissiles(now, dt);
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
