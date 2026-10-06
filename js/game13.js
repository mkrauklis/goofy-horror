(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(13)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL13;
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
  const MONSTER_SPEED = PLAYER_SPEED * 1.1;
  const PATROL_SPEED = PLAYER_SPEED * 0.5;
  const LURE_SPEED = PLAYER_SPEED * 0.6;
  const CATCH_RADIUS = 20;
  const REPATH_MS = 500;
  const ALERT_GRACE_MS = 2500;
  const FLASHLIGHT_RADIUS = 230;
  const RADAR_DURATION_MS = 10000;
  // An energy bar grants infinite stamina (no sprint drain, instant
  // cure from exhausted) for this long -- same team-wide-buff
  // convention as radar/scanner/night vision, not tied to one player.
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
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

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

  // A sharp crack (fast-decaying high sawtooth) layered over a short low
  // punch (same shape as playChompThud) -- reads as one blast, not a
  // melodic cue like the item chimes.
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

  function nearestMonster(x, y) {
    let best = monsters[0], bestD = Infinity;
    monsters.forEach((m) => {
      const d = Math.hypot(x - m.x, y - m.y);
      if (d < bestD) { bestD = d; best = m; }
    });
    return best;
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
  // one flat color -- stable across frames since it's a function of (x, y),
  // not random noise re-rolled every draw.
  const FLOOR_SHADES = ['#4c4c53', '#525258', '#58585f', '#5e5e66', '#54545c', '#605f68'];
  function floorShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % FLOOR_SHADES.length;
    return FLOOR_SHADES[idx];
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

  // A single tapered, suckered tentacle from (0,0) to (tx,ty) bowing through
  // (midX,midY) -- thick at the root, thin at the tip, with a couple of
  // suckers, instead of one uniform-width stroke.
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

  // ---- game state ----
  let buttonsPressed = [false, false, false];
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  // ---- timer / best time (best is kept per-browser in localStorage, not
  // shared between players or devices) ----
  const BEST_TIME_KEY = 'goofy-horror-best-level13';
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

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
      shotgunAmmo: 0,
    };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  function makeMonster(patrolStartIndex) {
    return {
      x: 0,
      y: 0,
      radius: 8,
      seed: Math.random() * 100,
      path: [],
      pathIndex: 0,
      nextRepathAt: 0,
      lookDir: { x: 1, y: 0 },
      state: 'patrol', // 'patrol' | 'alert'
      alertUntil: 0,
      alertTargetTile: null,
      patrolIndex: patrolStartIndex,
      frozenUntil: 0,
      luredState: 'none', // 'none' | 'lured' | 'eating'
      lureTarget: null,
      eatingUntil: 0,
      trail: [],
      segments: [],
    };
  }

  const SEGMENT_COUNT = 6;
  const SEGMENT_SPACING = 9;

  const MONSTER_COUNT = 5;
  const monsters = Array.from({ length: MONSTER_COUNT }, (_, i) =>
    makeMonster(Math.floor((i * LEVEL.patrolPoints.length) / MONSTER_COUNT))
  );

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let superRadarUntil = 0;
  let smokeBombs = [];
  let decoy = null; // { x, y, angle, turnAt }
  let nvgUntil = 0;
  let floatingTexts = [];

  // A light, constant drift of snow across the whole canvas, same as
  // Level 11's -- drawn in absolute canvas coordinates since each
  // renderViewport call is already clipped to its own half.
  let ambientSnow = [];
  (function initAmbientSnow() {
    for (let i = 0; i < 40; i++) {
      ambientSnow.push({
        x: Math.random() * 920, y: Math.random() * 340,
        vx: -20 - Math.random() * 20, vy: 25 + Math.random() * 20,
        size: 1 + Math.random() * 2, drift: Math.random() * Math.PI * 2,
      });
    }
  })();

  function updateAmbientSnow(dt) {
    ambientSnow.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.drift += dt * 2;
      if (s.x < -10) s.x = 930;
      if (s.y > 350) { s.y = -10; s.x = Math.random() * 920; }
    });
  }

  function drawAmbientSnow(g) {
    g.save();
    ambientSnow.forEach((s) => {
      const wob = Math.sin(s.drift) * 4;
      g.beginPath();
      g.arc(s.x + wob, s.y, s.size, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fill();
    });
    g.restore();
  }

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

    const spawns = LEVEL.monsterSpawns;
    monsters.forEach((mon, i) => {
      const m = tileCenter(spawns[i % spawns.length].x, spawns[i % spawns.length].y);
      mon.x = m.x; mon.y = m.y;
      mon.path = []; mon.pathIndex = 0; mon.nextRepathAt = 0;
      mon.state = 'patrol'; mon.alertUntil = 0; mon.alertTargetTile = null;
      mon.frozenUntil = 0; mon.luredState = 'none'; mon.lureTarget = null; mon.eatingUntil = 0;
      mon.trail = []; mon.segments = [];
    });

    buttonsPressed = [false, false, false];
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
    resetExploration();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
  }
  resetLevel();

  // ---- player movement & collision ----
  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#' || ch === 'C') return true;
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

  function isHidden(p) {
    const t = worldToTile(p.x, p.y);
    const ch = tileChar(t.x, t.y);
    return ch === 'S' || ch === 'V';
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
    if (ch === 'V') return '#4a6a86';
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
      // Floored at 0 -- arc() throws on a negative radius, which elapsed can
      // briefly go to if now ever lands ahead of where endsAt expects it.
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

  function applyItemEffect(item, x, y, now, p) {
    if (item === 'radar') {
      radarUntil = now + RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'RADAR');
      playItemChime(880);
    } else if (item === 'meat') {
      monsters.forEach((m) => {
        m.luredState = 'lured';
        m.lureTarget = { x, y };
        m.path = []; m.pathIndex = 0;
      });
      spawnFloatingText(x, y, 'MEAT');
      playItemChime(220);
    } else if (item === 'co2') {
      monsters.forEach((m) => { m.frozenUntil = now + FREEZE_DURATION_MS; });
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
      // Capped at SHOTGUN_AMMO_MAX -- each shell in stock triggers its own
      // automatic stun the next time something gets close, one at a time.
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

  // Walks the arena at a fixed slow wander, bouncing off whatever a player
  // would also bounce off of. Every monster is kept re-targeted at its
  // live (moving) position each frame rather than a fixed point the way
  // meat works, so they visibly give chase instead of walking to a spot
  // and waiting. Caught the instant any monster gets within
  // DECOY_CATCH_RADIUS of it -- no "eating" pause, since there is nothing
  // left there to eat once that happens.
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

    monsters.forEach((m) => {
      m.luredState = 'lured';
      m.lureTarget = { x: decoy.x, y: decoy.y };
    });

    if (monsters.some((m) => Math.hypot(m.x - decoy.x, m.y - decoy.y) < DECOY_CATCH_RADIUS)) {
      spawnFloatingText(decoy.x, decoy.y, 'CAUGHT!');
      decoy = null;
      monsters.forEach((m) => { m.luredState = 'none'; m.path = []; m.pathIndex = 0; m.nextRepathAt = 0; });
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
        if (window.GoofyStory) window.GoofyStory.completeLevel(13);
        setTimeout(() => { window.location.href = 'level14.html'; }, 2000);
      }
    });
  }

  // ---- monster AI ----
  function monsterCanOccupy(ch) {
    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'C') return false;
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

  function updateDetection(m, now) {
    for (const p of players) {
      if (p.caught || isHidden(p) || isInSmoke(p, now)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d <= FLASHLIGHT_RADIUS && hasLineOfSight(m.x, m.y, p.x, p.y)) {
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

  // Lays down a short trail of body segments behind the head, same
  // technique as Level 3/9's caterpillars -- just generalized to take any
  // monster object instead of a single global one, since this level has
  // five of them.
  function updateCaterpillarSegments(m) {
    m.trail.unshift({ x: m.x, y: m.y });
    if (m.trail.length > 200) m.trail.length = 200;
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

  function updateMonster(m, now, dt) {
    if (now < m.frozenUntil) { updateCaterpillarSegments(m); return; } // frozen solid: no movement, no perception

    if (m.luredState === 'eating') {
      if (now >= m.eatingUntil) {
        m.luredState = 'none';
        m.path = []; m.pathIndex = 0; m.nextRepathAt = 0;
      } else {
        updateCaterpillarSegments(m);
        return;
      }
    }

    if (m.luredState === 'lured') {
      if (now >= m.nextRepathAt) {
        m.nextRepathAt = now + REPATH_MS;
        const startTile = worldToTile(m.x, m.y);
        const goalTile = worldToTile(m.lureTarget.x, m.lureTarget.y);
        const graph = buildMonsterGraph();
        const path = bfsPath(graph, startTile, goalTile);
        m.path = path && path.length > 1 ? path.slice(1) : [];
        m.pathIndex = 0;
      }
      if (m.path && m.pathIndex < m.path.length) {
        const step = LURE_SPEED * dt;
        const target = tileTargetWithOffset(m.path[m.pathIndex]);
        const dx = target.x - m.x, dy = target.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) m.lookDir = { x: dx / d, y: dy / d };
        if (d < step) {
          m.x = target.x; m.y = target.y;
          m.pathIndex++;
        } else {
          m.x += (dx / d) * step;
          m.y += (dy / d) * step;
        }
      } else {
        m.luredState = 'eating';
        m.eatingUntil = now + EAT_DURATION_MS;
      }
      updateCaterpillarSegments(m);
      return;
    }

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
      const step = (m.state === 'alert' ? MONSTER_SPEED : PATROL_SPEED) * dt;
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
    updateCaterpillarSegments(m);
  }


  // A last-ditch defense, not a weapon you aim and fire: carrying a shell
  // and getting close to something actively hunting you sets it off
  // automatically. Checked ahead of updateCatch so a stun this same frame
  // can still save a player who'd otherwise be caught on it.
  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught) return;
      monsters.forEach((m) => {
        if (p.shotgunAmmo <= 0) return;
        if (now < m.frozenUntil || !(m.state === 'alert')) return;
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
      if (m.luredState !== 'none') return;
      if (m.state !== 'alert') return;
      players.forEach((p) => {
        if (p.caught) return;
        if (isHidden(p) || isInSmoke(p, now)) return;
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
          case 'V': color = '#2a3038'; break;
          case 'E': color = '#3a301f'; break;
          case 'I': color = '#243440'; break;
          case 'C': color = floorShade(x, y); break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;
          default: color = floorShade(x, y);
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
        if (ch === 'I') {
          const seed = (x * 11 + y * 17) % 13;
          const ix = px + 8 + (seed % 5) * 4;
          const len = 6 + (seed % 4) * 2;
          g.beginPath();
          g.moveTo(ix - 2, py);
          g.lineTo(ix + 2, py);
          g.lineTo(ix, py + len);
          g.closePath();
          const grad = g.createLinearGradient(ix, py, ix, py + len);
          grad.addColorStop(0, 'rgba(200,235,255,0.55)');
          grad.addColorStop(1, 'rgba(140,200,240,0.2)');
          g.fillStyle = grad;
          g.fill();
        }
        if (ch === 'V') {
          g.strokeStyle = 'rgba(180,200,220,0.35)';
          g.lineWidth = 2;
          for (let i = 1; i < 4; i++) {
            const gy = py + (TILE / 4) * i;
            g.beginPath(); g.moveTo(px + 4, gy); g.lineTo(px + TILE - 4, gy); g.stroke();
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
    drawBigCrates(g);
    drawMeatLure(g);
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

  // Big 2x2 crates -- solid, can't be opened, just scattered around for
  // cover (and to break sightlines). One per LEVEL.bigCrateSpawns entry,
  // anchored at its top-left tile.
  function drawBigCrates(g) {
    (LEVEL.bigCrateSpawns || []).forEach((c) => {
      const px = c.x * TILE, py = c.y * TILE;
      const w = TILE * 2, h = TILE * 2;
      g.fillStyle = '#5a4428';
      g.fillRect(px, py, w, h);
      g.strokeStyle = '#2a1e14';
      g.lineWidth = 2;
      g.strokeRect(px + 1, py + 1, w - 2, h - 2);
      g.beginPath();
      g.moveTo(px + 2, py + 2); g.lineTo(px + w - 2, py + h - 2);
      g.moveTo(px + w - 2, py + 2); g.lineTo(px + 2, py + h - 2);
      g.stroke();
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
    const lured = monsters.find((m) => m.luredState !== 'none' && m.lureTarget);
    if (!lured) return;
    g.save();
    g.translate(lured.lureTarget.x, lured.lureTarget.y);
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

  function drawMonster(g, t, m) {
    // Ground shadow trail, drawn first so it sits under every segment.
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = m.segments.length - 1; i >= 0; i--) {
      const seg = m.segments[i];
      const r = m.radius * (1 - i * 0.08);
      g.beginPath();
      g.ellipse(seg.x, seg.y + r * 0.5, Math.max(2, r * 0.85), Math.max(1.5, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    // Body segments, tail first so the head draws on top.
    for (let i = m.segments.length - 1; i >= 0; i--) {
      const seg = m.segments[i];
      const r = Math.max(2.5, m.radius * (1 - i * 0.08));
      const base = i % 2 === 0 ? '#8a7a5a' : '#978967';
      g.save();
      g.translate(seg.x, seg.y);
      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.28));
      grad.addColorStop(0.6, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#5a4a30';
      g.shadowBlur = 4;
      g.fill();
      g.shadowBlur = 0;

      // a pair of stubby legs per segment
      g.strokeStyle = 'rgba(40,32,18,0.6)';
      g.lineWidth = 1.1;
      [-1, 1].forEach((side) => {
        g.beginPath();
        g.moveTo(0, side * r * 0.7);
        g.lineTo(-1.4, side * (r * 0.7 + 2.6));
        g.stroke();
      });
      g.restore();
    }

    g.save();
    g.translate(m.x, m.y);

    const points = 12;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = m.radius
        + Math.sin(t * 0.006 + i * 1.7 + m.seed) * 1.5
        + Math.sin(t * 0.0021 + i * 3.1 + m.seed) * 0.7;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const headGrad = g.createRadialGradient(-m.radius * 0.3, -m.radius * 0.35, 1, 0, 0, m.radius * 1.05);
    headGrad.addColorStop(0, shade('#978967', 0.3));
    headGrad.addColorStop(0.55, '#978967');
    headGrad.addColorStop(1, shade('#978967', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#5a4a30';
    g.shadowBlur = 6;
    g.fill();
    g.shadowBlur = 0;

    g.save();
    trace();
    g.clip();
    g.beginPath();
    g.ellipse(-m.radius * 0.3, -m.radius * 0.35, m.radius * 0.5, m.radius * 0.3, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
    g.restore();

    drawMonsterEye(g, m);

    if (t < m.frozenUntil) {
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = m.radius + 3;
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

  // A fleshy, lit blob body: an irregular two-octave silhouette, an offset
  // gradient for volume, one soft specular highlight and a couple of veins,
  // all clipped to the silhouette. Kept deliberately light on draw calls --
  // this runs per monster, per frame.
  function drawBlobBody(g, radius, fillColor, shadowColor, seed, t, opts) {
    opts = opts || {};
    const points = 14;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius
        + Math.sin(t * 0.006 + i * 1.7 + seed) * radius * 0.1
        + Math.sin(t * 0.0021 + i * 3.3 + seed * 1.7) * radius * 0.04;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const base = g.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.1, 0, 0, radius * 1.05);
    base.addColorStop(0, opts.core || shade(fillColor, 0.22));
    base.addColorStop(0.55, fillColor);
    base.addColorStop(1, opts.rim || shade(fillColor, -0.35));
    g.fillStyle = base;
    g.shadowColor = shadowColor;
    g.shadowBlur = Math.min(radius * 0.4, 18);
    g.fill();
    g.shadowBlur = 0;

    g.save();
    trace();
    g.clip();

    g.beginPath();
    g.ellipse(-radius * 0.32, -radius * 0.38, radius * 0.5, radius * 0.32, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fill();

    g.strokeStyle = opts.veinColor || 'rgba(0,0,0,0.2)';
    g.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * radius * 0.15, Math.sin(a) * radius * 0.15);
      g.lineTo(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88);
      g.stroke();
    }

    g.restore();
  }

  function drawMonsterEye(g, m) {
    const lookDir = m.lookDir;
    const ex = m.radius * 0.62, ey = ex * 0.8;

    g.save();
    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.clip();

    const sclera = g.createRadialGradient(-ex * 0.2, -ey * 0.25, 1, 0, 0, ex * 1.15);
    sclera.addColorStop(0, '#faf1e4');
    sclera.addColorStop(0.55, '#dcc4b2');
    sclera.addColorStop(1, '#6b5142');
    g.fillStyle = sclera;
    g.fillRect(-ex, -ey, ex * 2, ey * 2);

    g.strokeStyle = 'rgba(170,25,25,0.38)';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.15 + m.seed;
      g.lineWidth = 0.5 + ((i * 13) % 3) * 0.35;
      g.beginPath();
      g.moveTo(Math.cos(a) * ex, Math.sin(a) * ey);
      g.quadraticCurveTo(Math.cos(a + 0.1) * ex * 0.5, Math.sin(a - 0.1) * ey * 0.5, Math.cos(a) * ex * 0.08, Math.sin(a) * ey * 0.08);
      g.stroke();
    }

    const ix = lookDir.x * ex * 0.32, iy = lookDir.y * ey * 0.32;
    const irisR = ex * 0.48;
    const iris = g.createRadialGradient(ix - irisR * 0.22, iy - irisR * 0.22, 1, ix, iy, irisR);
    iris.addColorStop(0, '#e8903f');
    iris.addColorStop(0.45, '#c96a2e');
    iris.addColorStop(0.8, '#7a2f10');
    iris.addColorStop(1, '#200a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

    g.save();
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + m.seed * 0.3;
      g.beginPath();
      g.moveTo(ix + Math.cos(a) * irisR * 0.35, iy + Math.sin(a) * irisR * 0.35);
      g.lineTo(ix + Math.cos(a) * irisR, iy + Math.sin(a) * irisR);
      g.stroke();
    }
    g.restore();

    g.beginPath();
    g.arc(ix, iy, irisR * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#050202';
    g.fill();

    g.beginPath();
    g.arc(ix - irisR * 0.32, iy - irisR * 0.32, irisR * 0.22, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fill();
    g.beginPath();
    g.arc(ix - irisR * 0.28, iy - irisR * 0.3, irisR * 0.11, 0, Math.PI * 2);
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


  // A shotgun actually held out in front, gripped where the hands are --
  // stock near the body, barrel reaching past the head, with a lit shell
  // glowing at the muzzle once loaded. Sways very slightly with the walk
  // cycle instead of standing dead rigid.
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

      // ground shadow, drawn before rotation so it never tilts with the player
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

      // oxygen tank + hose up to the collar
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

      // hazard chevron stripe across the chest
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
      drawHeldShotgun(g, R, p);

      // head group -- smaller than the torso and pushed out toward the
      // front, so the silhouette reads as a body with a head on it rather
      // than one circle sitting concentrically inside another (which, at
      // this scale, just looked like an eyeball: white sclera, dark iris,
      // catchlight).
      g.save();
      g.translate(R * 0.55, -bob);
      const headR = R * 0.5;

      // sealed collar ring
      g.beginPath();
      g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 2.5;
      g.stroke();

      // glassy helmet dome
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

      // a narrow faceplate slit, not a big round visor -- a flat band
      // across the front of the helmet reads as a mask, not a pupil.
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
    drawTiles(ctx, camX, camY);
    drawSmokeBombs(ctx, now);
    drawDecoy(ctx, now);
    monsters.forEach((m) => drawMonster(ctx, now, m));
    drawPlayers(ctx);
    drawParticles(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);

    if (now < nvgUntil) {
      // A flat green wash over the whole viewport -- cheap, but reads
      // instantly as "night vision" without touching every draw call's
      // own colors.
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    drawAmbientSnow(ctx);

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

  // A small HUD badge in the corner once a player's carrying at least one
  // shotgun shell -- the shell icon plus a live "Nx" count, since ammo now
  // stacks up to SHOTGUN_AMMO_MAX instead of capping at a single shell.
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

  const PROXIMITY_WARNING_RADIUS = 400;

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
      messageEl.innerHTML = 'FACILITY CLEARED &mdash; warping to Level 2&hellip;';
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

    if (gameState === 'complete' && !bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
      if (window.GoofyStory) window.GoofyStory.completeLevel(13);
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
      updateSmokeBombs(now);
      updateDecoy(now, dt);
      monsters.forEach((m) => updateMonster(m, now, dt));
      updateShotgunDefense(now);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
      updateSafeMusic(players.some(isInSafeZone));
    }
    updateParticles(dt);
    updateFloatingTexts(dt);
    updateAmbientSnow(dt);

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
