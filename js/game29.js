(function () {
  const HM = window.HardMode;
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(29)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL29;
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
  // Direct spec: half the player's own size, individually slower than
  // you -- the threat here is numbers (15 of them), not any one chaser.
  const MONSTER_RADIUS = PLAYER_RADIUS * 0.5;
  const MONSTER_SPEED = HM.speed(PLAYER_SPEED * 0.8);
  const MONSTER_SIGHT_RADIUS = 200;
  const ALERT_GRACE_MS = 2500;
  const CATCH_RADIUS = 16;
  const PROXIMITY_WARNING_RADIUS = 340;
  const RADAR_DURATION_MS = HM.ability(10000);
  const ENERGY_DURATION_MS = HM.ability(10000);
  const SCANNER_DURATION_MS = HM.ability(10000);
  const FREEZE_DURATION_MS = HM.ability(10000);
  const FREEZE_RADIUS_TILES = 15; // freezes only reach a Grotesque if it's this close to where the item was used
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

  // ---- ziplines -- the only way across any gap. Walking up to a post
  // fires it automatically; the ride is a scripted straight-line glide
  // at 2.2x your own speed, during which you can't be caught.
  const ZIPLINE_INTERACT_RADIUS = 26;
  const ZIPLINE_SPEED_MULT = 2.2;

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
  const hudZiplinesEl = document.getElementById('hud-ziplines');

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

  function playZiplineWhoosh() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, start);
    osc.frequency.exponentialRampToValueAtTime(220, start + 0.5);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.08);
    gain.gain.linearRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
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
    const proximity = clamp(1 - minDist / 300, 0, 1);
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

  // Rooftop floor -- the exact same worn tar/gravel palette Level 27
  // uses ("same deco" -- direct request).
  const ROOF_SHADES = ['#33343a', '#383a40', '#3d3f45', '#30323a', '#3a3c43'];
  function roofShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % ROOF_SHADES.length;
    return ROOF_SHADES[idx];
  }

  const ROOFPROP_TILE_CHANCE = 5;
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

  // The sky beyond the rooftop edges -- dawn, not night: a genuine
  // orange sunrise gradient (deep dusk up high fading into a warm,
  // saturated orange near the rooftops) computed smoothly from each
  // tile's own height rather than picked from a handful of per-tile
  // hues -- the old hash-picked palette read as a visible checkerboard
  // of five fairly different colors ("too griddy", direct feedback).
  // Only a tiny brightness jitter (not a hue swap) is layered on top
  // for texture, so neighboring tiles stay close enough to blend into
  // one continuous sky.
  function lerpHex(a, b, t) {
    const an = parseInt(a.slice(1), 16), bn = parseInt(b.slice(1), 16);
    const ar = (an >> 16) & 255, ag = (an >> 8) & 255, ab = an & 255;
    const br = (bn >> 16) & 255, bg = (bn >> 8) & 255, bb = bn & 255;
    const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
  }
  const SKY_TOP = '#3a2230';
  const SKY_BOTTOM = '#d8762e';
  function skyShade(x, y) {
    const t = clamp(y / ROWS, 0, 1);
    const base = lerpHex(SKY_TOP, SKY_BOTTOM, t);
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const u = ((h ^ (h >>> 13)) >>> 0) % 100;
    return shade(base, (u - 50) / 1400);
  }
  function drawVoidTile(g, px, py, x, y) {
    g.fillStyle = skyShade(x, y);
    g.fillRect(px, py, TILE, TILE);
    const h = Math.imul(x, 1274126177) ^ Math.imul(y, 2516582981);
    const u = (h ^ (h >>> 15)) >>> 0;
    if (u % 10 === 0) {
      g.fillStyle = `rgba(255,165,70,${0.25 + (u % 5) * 0.1})`;
      g.beginPath();
      g.arc(px + (u % TILE), py + ((u >> 4) % TILE), 1.1, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawRoofEdges(g, minTX, maxTX, minTY, maxTY) {
    g.strokeStyle = 'rgba(255,224,196,0.55)';
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
  }

  // Open sky never blocks sight -- a flying Grotesque has a clear view
  // across a gap the same as across its own rooftop. Big crates and fans
  // still do, same as they always have.
  function hasLineOfSight(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist / (TILE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const t2 = worldToTile(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      const ch = tileChar(t2.x, t2.y);
      if (ch === 'C' || ch === 'F') return false;
    }
    return true;
  }

  // ---- game state ----

  const BEST_TIME_KEY = 'goofy-horror-best-level29';
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
      riding: null, // { x0,y0,x1,y1, startedAt, durationMs } while on a zipline
      lastZiplineAnchor: null,
    };
  }

  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  // Fifteen Grotesques -- tiny, dark grey, one bloodshot eye apiece. Each
  // one patrols its own rooftop normally, but unlike every ground
  // monster elsewhere in this game, a spotted intruder isn't safe just
  // because there's open sky between them -- it flies the gap straight
  // at you, direct-line, the same true-flight model Level 28's Warden
  // uses (no walkable-tile pathfinding at all, since there's nothing to
  // path around up there).
  function makeGrotesque(spawn) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, radius: MONSTER_RADIUS, seed: Math.random() * 100,
      platform: spawn.platform,
      state: 'patrol', // 'patrol' | 'alert'
      alertUntil: 0, alertTargetTile: null,
      patrolIndex: Math.floor(Math.random() * (LEVEL.platformPatrolPoints[spawn.platform] || [{}]).length),
      frozenUntil: 0,
      legPhase: Math.random() * 10,
    };
  }
  const monsters = (LEVEL.monsterSpawns || []).map((spawn) => makeGrotesque(spawn));

  let ziplinesRiddenCount = 0;

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
    p.riding = null;
    p.lastZiplineAnchor = null;
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
      m.state = 'patrol'; m.alertUntil = 0; m.alertTargetTile = null;
      m.frozenUntil = 0;
    });

    ziplinesRiddenCount = 0;

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
    return ch === '#' || ch === 'C' || ch === 'F';
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
    if (p.caught || p.riding) { p.isMoving = p.riding ? true : false; return; }
    p.isMoving = ix !== 0 || iy !== 0;
    if (!p.isMoving) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    const speed = PLAYER_SPEED * speedMultiplierFor(p);
    movePlayer(p, nx * speed * dt, ny * speed * dt);
  }

  function updatePlayerMovement(p, ix, iy, now, dt) {
    if (p.riding) return; // the ride itself drives position -- see updateZiplines
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

  function inElevator(p) {
    const el = LEVEL.elevator;
    const t = worldToTile(p.x, p.y);
    return t.x >= el.x0 && t.x <= el.x1 && t.y >= el.y0 && t.y <= el.y1;
  }

  // The maze has no fixed "next" zipline the way the old 4-roof chain
  // did -- there are 39 of them and every one is two-way -- so the
  // scanner just always points straight at the elevator itself. It
  // won't thread the maze for you, but dead-reckoning toward the goal
  // is still the right tool for "which general direction."
  function scannerTarget() {
    const el = LEVEL.elevator;
    return tileCenter(Math.round((el.x0 + el.x1) / 2), Math.round((el.y0 + el.y1) / 2));
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#3a2a34';
    if (ch === 'C' || ch === 'F') return '#24221e';
    if (ch === 'S') return '#3ddc84';
    if (ch === 'V') return '#ffd27a';
    if (ch === 'Z') return '#9fc6ff';
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
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4d6d';
        ctx.fill();
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

  // ---- ziplines: walking up to EITHER post rides it in that direction,
  // scripted and automatic -- the maze rework made every one two-way.
  // A time-based cooldown alone isn't enough here: a player standing
  // still exactly on a landing anchor would just auto-fire right back
  // the instant the cooldown expired, with no input at all. Instead each
  // player remembers the anchor they just landed on and it stays
  // disarmed until they've actually moved out of its interact radius at
  // least once -- stepping away and back deliberately still re-triggers
  // it, standing still never does.
  function updateZiplines(now) {
    players.forEach((p) => {
      if (p.lastZiplineAnchor) {
        const d = Math.hypot(p.x - p.lastZiplineAnchor.x, p.y - p.lastZiplineAnchor.y);
        if (d > ZIPLINE_INTERACT_RADIUS) p.lastZiplineAnchor = null;
      }
      if (p.caught || p.riding) return;
      for (const z of (LEVEL.ziplines || [])) {
        const c0 = tileCenter(z.x0, z.y0);
        const c1 = tileCenter(z.x1, z.y1);
        let from = null, to = null;
        if (Math.hypot(p.x - c0.x, p.y - c0.y) <= ZIPLINE_INTERACT_RADIUS) { from = c0; to = c1; }
        else if (Math.hypot(p.x - c1.x, p.y - c1.y) <= ZIPLINE_INTERACT_RADIUS) { from = c1; to = c0; }
        if (!from) continue;
        if (p.lastZiplineAnchor && from.x === p.lastZiplineAnchor.x && from.y === p.lastZiplineAnchor.y) continue;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const durationMs = (dist / (PLAYER_SPEED * ZIPLINE_SPEED_MULT)) * 1000;
        p.x = from.x; p.y = from.y;
        p.riding = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, startedAt: now, durationMs };
        p.invulnerableUntil = Math.max(p.invulnerableUntil, now + durationMs + 500);
        ziplinesRiddenCount++;
        playZiplineWhoosh();
        break;
      }
    });
    players.forEach((p) => {
      if (!p.riding) return;
      const t = clamp((now - p.riding.startedAt) / p.riding.durationMs, 0, 1);
      const nx = p.riding.x1 - p.riding.x0, ny = p.riding.y1 - p.riding.y0;
      const len = Math.hypot(nx, ny) || 1;
      p.x = p.riding.x0 + nx * t;
      p.y = p.riding.y0 + ny * t;
      p.facing = { x: nx / len, y: ny / len };
      p.isMoving = true;
      if (t >= 1) {
        p.lastZiplineAnchor = { x: p.riding.x1, y: p.riding.y1 };
        p.riding = null;
      }
    });
  }

  let lastElevatorHintAt = -Infinity;
  function updateTriggers(now) {
    if (gameState !== 'playing') return;
    const allIn = players.every((p) => !p.caught && !p.riding && inElevator(p));
    if (allIn) {
      gameState = 'complete';
      playWinJingle();
      if (window.GoofyStory) window.GoofyStory.completeLevel(29);
      setTimeout(() => { window.location.href = 'level30.html'; }, 2000);
      return;
    }
    const anyoneIn = players.some((p) => !p.caught && !p.riding && inElevator(p));
    if (anyoneIn && PLAYER_MODE === 2 && now - lastElevatorHintAt > 2000) {
      lastElevatorHintAt = now;
      const p = players.find((pp) => inElevator(pp));
      spawnFloatingText(p.x, p.y, 'WAIT FOR EVERYONE');
    }
  }

  // ---- Grotesque AI: sight-based patrol/chase. Flies, so there's no
  // walkable-tile pathfinding here at all -- just steer straight at the
  // target every frame, same true-flight model Level 28's Warden uses.
  // Open sky is no longer an obstacle, it's just more sky.
  function updateDetection(m, now) {
    for (const p of players) {
      if (p.caught || p.riding || isHidden(p) || isInSmoke(p, now)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d <= MONSTER_SIGHT_RADIUS && hasLineOfSight(m.x, m.y, p.x, p.y)) {
        m.state = 'alert';
        m.alertUntil = now + ALERT_GRACE_MS;
        m.alertTargetTile = worldToTile(p.x, p.y);
      }
    }
    if (m.state === 'alert' && now >= m.alertUntil) {
      m.state = 'patrol';
    }
  }

  function updateMonster(m, now, dt) {
    if (now < m.frozenUntil) return;

    updateDetection(m, now);

    const myPoints = LEVEL.platformPatrolPoints[m.platform] || [];
    let target = null;
    if (m.state === 'alert' && m.alertTargetTile) {
      target = tileCenter(m.alertTargetTile.x, m.alertTargetTile.y);
    } else if (myPoints.length) {
      const pt = myPoints[m.patrolIndex % myPoints.length];
      target = tileCenter(pt.x, pt.y);
    }

    const speed = MONSTER_SPEED;
    if (target) {
      const dx = target.x - m.x, dy = target.y - m.y;
      const d = Math.hypot(dx, dy);
      const step = speed * dt;
      if (d < step || d < 4) {
        m.x = target.x; m.y = target.y;
        if (m.state === 'patrol' && myPoints.length) m.patrolIndex = (m.patrolIndex + 1) % myPoints.length;
      } else {
        m.x += (dx / d) * step;
        m.y += (dy / d) * step;
      }
      m.legPhase += dt * (m.state === 'alert' ? 14 : 8);
    } else {
      m.legPhase += dt * 3;
    }
  }

  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught || p.riding) return;
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
        if (p.caught || p.riding) return;
        if (isHidden(p) || isInSmoke(p, now)) return;
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
      g.restore();
    });
  }

  // The zipline itself: a taut cable between the two posts, drawn once
  // regardless of which viewport it's clipped into (world-space), plus
  // a small post at each end.
  function drawZiplinePost(g, x, y, isStart) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = '#3a3a3e';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 10);
    g.lineTo(0, -14);
    g.stroke();
    g.beginPath();
    g.arc(0, -14, 4, 0, Math.PI * 2);
    g.fillStyle = isStart ? '#ffd27a' : '#9fc6ff';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 6;
    g.fill();
    g.shadowBlur = 0;
    g.restore();
  }
  function drawZiplines(g) {
    (LEVEL.ziplines || []).forEach((z) => {
      const c0 = tileCenter(z.x0, z.y0);
      const c1 = tileCenter(z.x1, z.y1);
      g.strokeStyle = 'rgba(40,40,46,0.9)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(c0.x, c0.y - 12);
      g.lineTo(c1.x, c1.y - 12);
      g.stroke();
      drawZiplinePost(g, c0.x, c0.y, true);
      drawZiplinePost(g, c1.x, c1.y, false);
    });
  }

  // The elevator pad -- a glowing marked square on the final roof.
  function drawElevator(g, now) {
    const el = LEVEL.elevator;
    const x0 = el.x0 * TILE, y0 = el.y0 * TILE;
    const w = (el.x1 - el.x0 + 1) * TILE, h = (el.y1 - el.y0 + 1) * TILE;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
    g.save();
    g.fillStyle = `rgba(255,210,122,${0.1 + pulse * 0.08})`;
    g.fillRect(x0, y0, w, h);
    g.strokeStyle = '#ffd27a';
    g.lineWidth = 3;
    g.shadowColor = '#ffd27a';
    g.shadowBlur = 8;
    g.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
    g.shadowBlur = 0;
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
        if (ch === 'S') {
          g.fillStyle = roofShade(x, y);
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        if (ch === 'C' || ch === 'F') {
          g.fillStyle = roofShade(x, y);
          g.fillRect(px, py, TILE, TILE);
          continue;
        }
        // '.' / 'V' / 'Z' -- plain rooftop floor
        g.fillStyle = roofShade(x, y);
        g.fillRect(px, py, TILE, TILE);
        if (hasRoofProp(x, y)) drawRoofProp(g, px, py, x, y);
      }
    }

    drawRoofEdges(g, minTX, maxTX, minTY, maxTY);
    drawBigCrates(g);
    drawFans(g, now);
    drawElevator(g, now);
    drawZiplines(g);
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

  // The Grotesque: a tiny, hunched, very dark grey gargoyle-family body
  // with real, working wings -- same membrane-and-rim-stroke build as
  // the Gargoyle/Warden, just scaled to its own tiny radius and anchored
  // off-center so the span actually reads as wings instead of a dark
  // blob fused to the body -- and one bloodshot red eye, a pale,
  // vein-shot sclera with a dark red iris, not just a glowing dot like
  // its bigger cousins.
  function drawGrotesque(g, now, m) {
    const r = m.radius;
    const bob = Math.sin(m.legPhase) * r * 0.1;

    g.save();
    g.translate(m.x, m.y + bob);

    // real wings, scaled down -- they flap along with its scurry instead
    // of just idling, even though it never leaves the ground.
    const flap = Math.sin(m.legPhase * 0.6 + m.seed) * 0.35;
    const wingColor = m.state === 'alert' ? '#3a2226' : '#232224';
    [-1, 1].forEach((side) => {
      const span = r * 5.2; // 2x bigger again on top of the earlier wing fix, direct follow-up request
      g.save();
      g.translate(0, -r * 0.15);
      g.scale(side, 1);
      g.rotate(0.3 + flap);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(span * 0.5, -span * 0.4, span, -span * 0.12);
      g.quadraticCurveTo(span * 0.55, span * 0.12, span * 0.28, span * 0.05);
      g.quadraticCurveTo(span * 0.14, span * 0.08, 0, 0);
      g.closePath();
      g.fillStyle = wingColor;
      g.fill();
      g.strokeStyle = 'rgba(210,210,220,0.3)';
      g.lineWidth = 0.75;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 0.4;
      [0.4, 0.75, 1].forEach((f) => {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(span * f, -span * 0.12 * f);
        g.stroke();
      });
      g.restore();
    });

    // stubby legs
    const legCount = 3;
    for (let i = 0; i < legCount; i++) {
      const a = Math.PI * 0.25 + (i / (legCount - 1)) * Math.PI * 0.5;
      const len = r * 0.8;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + r * 0.5;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, r * 0.2, '#1c1a1c');
    }

    const grad = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, m.state === 'alert' ? '#3a383c' : '#2a282c');
    grad.addColorStop(1, '#121113');
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.stroke();

    // the bloodshot eye -- pale sclera, thin red veins, dark red iris.
    const er = r * 0.55;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.72, 0, 0, Math.PI * 2);
    g.fillStyle = '#d8b8b4';
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.72, 0, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(180,20,20,0.7)';
    g.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + m.seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * er * 1.2, Math.sin(a) * er * 1.2);
      g.lineTo(0, 0);
      g.stroke();
    }
    g.restore();
    const alert = m.state === 'alert';
    g.beginPath();
    g.arc(0, 0, er * 0.42, 0, Math.PI * 2);
    g.fillStyle = alert ? '#ff2020' : '#9c1414';
    g.shadowColor = alert ? '#ff2020' : 'transparent';
    g.shadowBlur = alert ? 8 : 0;
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(0, 0, er * 0.16, 0, Math.PI * 2);
    g.fillStyle = '#0a0304';
    g.fill();

    if (now < m.frozenUntil) {
      g.beginPath();
      g.arc(0, 0, r + 2, 0, Math.PI * 2);
      g.fillStyle = 'rgba(140,220,255,0.45)';
      g.fill();
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

  // The sun's coming up -- the unlit mask is a dim warm dusk tint at
  // less than full opacity, not flat black, so the whole scene reads
  // as "getting light out" rather than night, even before the
  // flashlight does its own work.
  function buildDarknessMask(camX, camY, now) {
    const worldToScreen = (wx, wy) => ({ x: wx - camX + VIEW_W / 2, y: wy - camY + VIEW_H / 2 });
    const nvgMult = now < nvgUntil ? NVG_RANGE_MULT : 1;

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'rgba(46,24,14,0.78)';
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
      punchLight(maskCtx, s.x, s.y, 100 * nvgMult * HM.flicker(pl), 1);
      punchLight(maskCtx, s.x, s.y, 250 * nvgMult * HM.flicker(pl), 0.85);
    });
  }

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    // the screen smears out the closer it gets (instead of a red flash)
    window.ScreenFx.blur(ctx, vx, 0, VIEW_W, VIEW_H, closeness);
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
    ctx.fillStyle = '#5a3222';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);
    drawTiles(ctx, camX, camY, now);
    drawSmokeBombs(ctx, now);
    monsters.forEach((m) => HM.monster(ctx, m, (c) => drawGrotesque(c, now, m)));
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
    ctx.fillStyle = `rgba(60,10,15,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    const shake = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawJaw(ctx, vx, 1, jawProgress, '#1c0a0a');
    drawJaw(ctx, vx, -1, jawProgress, '#130707');

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
      messageEl.innerHTML = 'ESCAPED &mdash; heading back to the menu&hellip;';
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
      if (window.GoofyStory) window.GoofyStory.completeLevel(29);
    }

    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
    if (hudZiplinesEl) hudZiplinesEl.textContent = `Ziplines ridden: ${ziplinesRiddenCount}`;
  }

  let lastFrameTime = null;

  function loop(now) {
    try {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'playing') {
      elapsedMs = now - runStartTime;
      updateInputMovement(now, dt);
      updateZiplines(now);
      updateTriggers(now);
      updateCrates(now);
      updateSmokeBombs(now);
      monsters.forEach((m) => updateMonster(m, now, dt));
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
      console.error('desolate-apes: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
