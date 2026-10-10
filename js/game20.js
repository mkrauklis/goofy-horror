(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(20)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL20;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  const ARENA_CENTER_X = LEVEL.arenaCenter.x * TILE + TILE / 2;
  const ARENA_CENTER_Y = LEVEL.arenaCenter.y * TILE + TILE / 2;
  const ARENA_RADIUS_PX = LEVEL.arenaRadiusTiles * TILE;

  // 1-player or 2-player, picked on the menu (js/story.js) before this
  // level ever loads. Solo gets one full-width viewport instead of two
  // half-width ones sharing the same canvas.
  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  // Boss fights read the whole arena at once rather than following a
  // player closely -- the camera sits fixed on the arena's center and
  // ZOOM is computed so the full circle (plus a little margin) fits
  // inside the shorter screen dimension, same spirit as Level 10/15's
  // own fixed low-zoom boss camera.
  const ZOOM = (Math.min(VIEW_W, VIEW_H) - 24) / (ARENA_RADIUS_PX * 2);

  // Speeds are px/second and movement is scaled by the real elapsed time
  // each frame (see `dt` in loop()) rather than a fixed px/frame step.
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;
  const CATCH_CUTSCENE_MS = 2000;

  // ---- the boss ----
  const BOSS_NAME = 'THE CISTERN';
  const BOSS_MAX_HEALTH = 50;
  const PHASE2_HEALTH_THRESHOLD = 25;
  const PHASE2_SPEED_MULT = 1.1; // "attacks are 1.1x faster" in phase 2
  const BOSS_RADIUS = 34;
  const BOSS_SEGMENT_COUNT = 16;
  const BOSS_SEGMENT_SPACING = 20;
  const BOSS_IDLE_SPEED = PLAYER_SPEED * 0.55;
  const BOSS_IDLE_MIN_MS = 700;
  const BOSS_IDLE_MAX_MS = 1400;

  // Spears: a fresh one spawns every 10s, never more than 3 live at
  // once, and walking onto one is the hit -- same "pickup is the damage
  // action" convention every other boss weapon on this site uses (Level
  // 10's dynamite, Level 15's torches), no separate aim/throw step.
  const SPEAR_SPAWN_INTERVAL_MS = 10000;
  const SPEAR_MAX_LIVE = 3;
  const SPEAR_DAMAGE = 2.5;
  const SPEAR_MIN_PLAYER_DIST = 90;

  // The corner radar -- small enough to stay out of the way, big enough
  // to show where the live spears actually are at this zoomed-way-out scale.
  const MINIMAP_RADIUS = 46;
  const MINIMAP_MARGIN = 14;

  // Attack 1: wall spin -- a 2s warning while the boss glides to the
  // arena wall, then 5s circling the perimeter at 4x player speed.
  const WALLSPIN_WARNING_MS = 2000;
  const WALLSPIN_DURATION_MS = 5000;
  const WALLSPIN_SPEED = PLAYER_SPEED * 4;
  // A whirlpool opens up in the middle of the arena for the whole
  // wall-spin attack (warning included), dragging both players outward
  // toward the wall -- and the spinning boss -- at a flat 0.8x speed.
  const WHIRLPOOL_SPEED = PLAYER_SPEED * 0.8;

  // Attack 2: vanish -- fades to near-invisible but for a couple of
  // faint ripples, glides to a random spot in the arena, then slams
  // back into view.
  const VANISH_FADE_MS = 600;
  const VANISH_TRAVEL_MS = 1600;
  const VANISH_LAND_WARNING_MS = 350;
  const VANISH_MIN_ALPHA = 0.06;
  const VANISH_SLAM_RADIUS = BOSS_RADIUS * 1.9;
  const VANISH_RIPPLE_INTERVAL_MS = 450;
  // Coming back up out of the water throws out a real shockwave -- a ring
  // expanding from the landing spot out to a full 6 tiles, not just the
  // tight point-blank slam radius above.
  const VANISH_SHOCKWAVE_RADIUS = TILE * 6;
  const VANISH_SHOCKWAVE_MS = 650;

  // Attack 3: barrage -- coral balls fired at each player in turn, two
  // at once in a tight spread, twice as often as the original single shot.
  const BARRAGE_DURATION_MS = 5000;
  const BARRAGE_FIRE_INTERVAL_MS = 275;
  const BARRAGE_PROJECTILE_SPEED = PLAYER_SPEED * 2.2;
  const BARRAGE_VOLLEY_COUNT = 2;
  const BARRAGE_VOLLEY_SPREAD = 0.12; // radians between the two balls in a volley

  // Phase-2-only attack: wave splash -- a burst of waves in random
  // directions every 2.5s, for 10s straight.
  const WAVESPLASH_DURATION_MS = 10000;
  const WAVESPLASH_INTERVAL_MS = 2500;
  const WAVESPLASH_COUNT = 8;
  const WAVESPLASH_SPEED = PLAYER_SPEED * 2.2;

  const PROJECTILE_HIT_RADIUS = 20;

  // Attack 4: coral burst -- the boss settles at the center (at 2x its
  // usual approach speed), 25 spots scattered around the arena flash a
  // warning for 2 seconds, then red coral grows at every one of them and
  // stays, a real hazard, for 3 seconds before the attack ends.
  const CORALBURST_SPOT_COUNT = 25;
  const CORALBURST_SPOT_RADIUS = TILE * 1.05; // roughly a 2x2-tile footprint
  const CORALBURST_MIN_SPOT_DIST = TILE * 2.2;
  const CORALBURST_WARN_MS = 2000;
  const CORALBURST_GROWTH_MS = 3000;
  const CORALBURST_APPROACH_SPEED = BOSS_IDLE_SPEED * 2;

  // The arena itself is always dark now, not just during coral burst --
  // lit only by each player's own light and by a fixed scatter of neon
  // blue coral, planted once when the level loads and never moving.
  const ARENA_BLUE_CORAL_COUNT = 8;
  const ARENA_BLUE_CORAL_RADIUS = TILE * 0.8;
  const ARENA_BLUE_CORAL_LIGHT_RADIUS = TILE * 5; // "5 tiles around"
  const PLAYER_LIGHT_RADIUS = TILE * 7;

  // ---- boss intro / phase-2 cutscenes ----
  const BOSS_INTRO_CUTSCENE_MS = 3000;
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_INTRO_ZOOM_MULT = 1.7;
  const BOSS_INTRO_SHAKE_MAG = 7;
  const PHASE2_CUTSCENE_MS = 3000;
  const PHASE2_NAME_COLOR = '#d9a24a';
  const PHASE2_SUBTITLE = 'DEHYDRATED';
  const DRY_CUTSCENE_MS = 4000;

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

  // Ripples spawn at a moving player's feet and expand outward, fading as
  // they go -- purely cosmetic, reused for the boss's own wake and its
  // vanish-attack tell too.
  const RIPPLE_INTERVAL_MS = 260;
  const RIPPLE_LIFE_MS = 900;
  const RIPPLE_MAX_RADIUS = 20;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');

  // Only ever used during the coral-burst attack -- the rest of this
  // level is always fully lit (that's the whole point of the zoomed-out
  // boss camera), so there's no reason to build or composite a mask any
  // other time.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

  const hudBossEl = document.getElementById('hud-boss');
  const hudSpearsEl = document.getElementById('hud-spears');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let musicMasterGain = null; // both the ambient drone and the safe-room pad route through this
  let musicEnabled = false;
  let ambientGain = null;
  let ambientSubOsc = null;
  let ambientMidGain = null;
  // The actual boss-battle track -- a pulsing bass/kick/lead pattern
  // scheduled a beat at a time (see scheduleBossMusicStep) rather than a
  // fixed loop, so phase 2 can just replay the same pattern faster and
  // louder instead of needing a whole second track.
  let bossMusicGain = null;
  let bossMusicTimer = null;
  let bossMusicStarted = false;
  let bossMusicPhase2 = false;
  let bossMusicStep = 0;

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

    bossMusicGain = audioCtx.createGain();
    bossMusicGain.gain.value = 0.55;
    bossMusicGain.connect(musicMasterGain);
  }

  // A-minor-ish bass riff, a kick on every other step, and a sparse lead
  // that only sounds on non-rest steps -- aquatic and a little eerie
  // rather than triumphant, to match the boss. Phase 2 replays the exact
  // same pattern at a faster tempo with a louder lead pitched up an
  // octave, which reads as "the same fight, now hungrier" instead of a
  // jarring track switch.
  const BOSS_MUSIC_BASS = [55, 55, 65.4, 55, 61.7, 55, 73.4, 65.4];
  const BOSS_MUSIC_LEAD = [0, 220, 0, 261.6, 0, 220, 246.9, 0];

  function scheduleBossMusicStep() {
    if (!bossMusicStarted || !audioCtx || !bossMusicGain) return;
    const bpm = bossMusicPhase2 ? 150 : 112;
    const stepSec = 60 / bpm / 2;
    const i = bossMusicStep % BOSS_MUSIC_BASS.length;
    const t = audioCtx.currentTime;

    const bassOsc = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.value = BOSS_MUSIC_BASS[i];
    bassGain.gain.setValueAtTime(0.0001, t);
    bassGain.gain.exponentialRampToValueAtTime(bossMusicPhase2 ? 0.3 : 0.22, t + 0.015);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, t + stepSec * 0.9);
    bassOsc.connect(bassGain);
    bassGain.connect(bossMusicGain);
    bassOsc.start(t);
    bassOsc.stop(t + stepSec);

    if (i % 2 === 0) {
      const kick = audioCtx.createOscillator();
      const kickGain = audioCtx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(110, t);
      kick.frequency.exponentialRampToValueAtTime(38, t + 0.09);
      kickGain.gain.setValueAtTime(0.3, t);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      kick.connect(kickGain);
      kickGain.connect(bossMusicGain);
      kick.start(t);
      kick.stop(t + 0.14);
    }

    const leadFreq = BOSS_MUSIC_LEAD[i];
    if (leadFreq) {
      const leadOsc = audioCtx.createOscillator();
      const leadGain = audioCtx.createGain();
      leadOsc.type = 'square';
      leadOsc.frequency.value = bossMusicPhase2 ? leadFreq * 2 : leadFreq;
      leadGain.gain.setValueAtTime(0.0001, t);
      leadGain.gain.exponentialRampToValueAtTime(bossMusicPhase2 ? 0.15 : 0.09, t + 0.02);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, t + stepSec * 0.75);
      leadOsc.connect(leadGain);
      leadGain.connect(bossMusicGain);
      leadOsc.start(t);
      leadOsc.stop(t + stepSec);
    }

    bossMusicStep++;
    bossMusicTimer = setTimeout(scheduleBossMusicStep, stepSec * 1000);
  }

  function startBossMusic() {
    if (bossMusicStarted) return;
    ensureAudio();
    if (!audioCtx) return;
    bossMusicStarted = true;
    bossMusicStep = 0;
    scheduleBossMusicStep();
  }

  function stopBossMusic() {
    bossMusicStarted = false;
    if (bossMusicTimer) {
      clearTimeout(bossMusicTimer);
      bossMusicTimer = null;
    }
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

  // A wet thunk-and-crack -- the sound of a spear actually landing in
  // the boss, not just a generic chime.
  function playSpearHit() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, start);
    osc.frequency.exponentialRampToValueAtTime(70, start + 0.2);
    gain.gain.setValueAtTime(0.26, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.28);
    playTone(180, 0.15, 'square', 0.2, 0.03);
  }

  // A low, ominous drop into a darker tone -- the phase-2 shift.
  function playPhaseShift() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, start);
    osc.frequency.exponentialRampToValueAtTime(55, start + 1.1);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 1.25);
  }

  // A long dry crackle -- the boss's death, the water going out of it.
  function playBossDefeat() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const crackle = audioCtx.createOscillator();
    const crackleGain = audioCtx.createGain();
    crackle.type = 'sawtooth';
    crackle.frequency.setValueAtTime(140, start);
    crackle.frequency.exponentialRampToValueAtTime(30, start + 2);
    crackleGain.gain.setValueAtTime(0.3, start);
    crackleGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
    crackle.connect(crackleGain);
    crackleGain.connect(audioCtx.destination);
    crackle.start(start);
    crackle.stop(start + 2.25);
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
    // Solo: both control schemes drive the one character that exists.
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
    if (e.key === 'Enter' && gameState === 'wiped') {
      resetLevel();
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

  // A handful of near-identical deep teals, picked per-tile by hashing
  // its coordinates, so the flooded floor reads as moving, uneven water
  // instead of one flat color -- teal to match the boss itself.
  const WATER_SHADES = ['#0f4a46', '#115450', '#0c3e3a', '#135a54', '#0a3632', '#105048'];
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

  // Namespaced by the active save slot (js/story.js) so each slot reads
  // as its own separate playthrough's record, not one shared globally.
  const BEST_TIME_KEY = (window.GoofyStory && window.GoofyStory.bestTimeKey(20)) || 'goofy-horror-best-level20';
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
  // gameState: 'intro' | 'playing' | 'phase2intro' | 'drying' | 'wiped'
  let gameState = 'intro';
  let introStartedAt = 0;
  let phase2IntroStartedAt = 0;
  let dryStartedAt = 0;
  let dryFinished = false;
  let catchFlash = 0;
  let bossHealth = BOSS_MAX_HEALTH;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
      nextRippleAt: 0,
    };
  }

  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  // The boss: a giant, Bog-styled eel (segmented trailing body, same
  // technique as every eel on this site) -- teal, grown over with both
  // seaweed AND coral, unlike the Bog's seaweed-only coat.
  const boss = {
    x: ARENA_CENTER_X, y: ARENA_CENTER_Y,
    radius: BOSS_RADIUS,
    seed: Math.random() * 100,
    lookDir: { x: 0, y: -1 },
    trail: [], segments: [],
    nextRippleAt: 0,
    alpha: 1,
    phase: 'idle', // 'idle' | 'wallspin' | 'vanish' | 'barrage' | 'wavesplash' | 'coralburst'
    phase2: false,
    defeated: false,
    lastAttack: null,
    nextIdleUntil: 0,
    // wallspin
    wsSubPhase: 'warn', wsWarnUntil: 0, wsUntil: 0, wsAngle: 0, wsDir: 1,
    // vanish
    vSubPhase: 'fade', vPhaseUntil: 0, vStartX: 0, vStartY: 0, vTargetX: 0, vTargetY: 0, vNextRippleAt: 0,
    vSlamAt: 0, vSlamX: 0, vSlamY: 0, vShockwaveHits: [],
    // barrage
    bNextFireAt: 0, bUntil: 0, bPlayerIndex: 0,
    // wavesplash
    wNextBurstAt: 0, wUntil: 0,
    // coralburst
    cbSubPhase: 'approach', cbPhaseUntil: 0, cbSpots: [],
  };

  // The arena's fixed neon blue coral, planted once per level load (see
  // resetLevel) and never moving -- not part of the boss object since
  // it's a property of the room, not of any one attack.
  let permanentBlueCoral = [];

  function speedMult(now) {
    return boss.phase2 ? PHASE2_SPEED_MULT : 1;
  }

  // Spears, the boss's one weak point -- spawn on a timer up to a cap,
  // same convention Level 15's torches use. Walking onto one is the hit,
  // same as Level 10's dynamite and Level 15's torches.
  let spears = []; // [{x, y, seed}]
  let nextSpearSpawnAt = 0;

  // Shared projectile pool for both the barrage and wave-splash attacks
  // -- one physics/render pass regardless of which attack spawned them,
  // same convention Level 15's icicle shower uses.
  let projectiles = []; // [{x, y, dirX, dirY, speed}]

  let floatingTexts = [];
  let waterRipples = []; // { x, y, bornAt }

  // Ambient wildlife, purely decorative -- small/medium/large fish
  // wandering the water around the SIDES of the arena, not through the
  // open fighting space in the middle: confined to an outer ring
  // between FISH_BAND_INNER and the wall, same spirit as the wall-hug
  // boundary other hazards respect.
  const FISH_COUNT = 16;
  const FISH_BAND_INNER = ARENA_RADIUS_PX * 0.6;
  let fish = []; // { x, y, angle, radius, speed, turnAt }

  function spawnFish() {
    fish = [];
    const bandTiles = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (isWallForPlayer(x, y)) continue;
        const c = tileCenter(x, y);
        const d = Math.hypot(c.x - ARENA_CENTER_X, c.y - ARENA_CENTER_Y);
        if (d >= FISH_BAND_INNER && d <= ARENA_RADIUS_PX - TILE) bandTiles.push({ x, y });
      }
    }
    for (let i = 0; i < FISH_COUNT && bandTiles.length; i++) {
      const t = bandTiles[Math.floor(Math.random() * bandTiles.length)];
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
      const step = f.speed * dt;
      const nx = f.x + Math.cos(f.angle) * step;
      const ny = f.y + Math.sin(f.angle) * step;
      const distFromCenter = Math.hypot(nx - ARENA_CENTER_X, ny - ARENA_CENTER_Y);
      if (canStandAt(nx, ny) && distFromCenter >= FISH_BAND_INNER) {
        f.x = nx; f.y = ny;
      } else {
        // bounced off the outer wall or the inner edge of its band --
        // turn back toward the band instead of into the open middle
        const awayFromCenter = Math.atan2(f.y - ARENA_CENTER_Y, f.x - ARENA_CENTER_X);
        f.angle = awayFromCenter + (Math.random() - 0.5) * 2;
        f.turnAt = now + 300;
      }
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
      p.nextRippleAt = 0;
    });

    boss.x = ARENA_CENTER_X; boss.y = ARENA_CENTER_Y;
    boss.lookDir = { x: 0, y: -1 };
    boss.trail = []; boss.segments = []; boss.nextRippleAt = 0;
    boss.alpha = 1;
    boss.phase = 'idle';
    boss.phase2 = false;
    boss.defeated = false;
    boss.lastAttack = null;
    boss.nextIdleUntil = 0;
    boss.cbSubPhase = 'approach';
    boss.cbPhaseUntil = 0;
    boss.cbSpots = [];
    boss.vSlamAt = -Infinity;
    boss.vShockwaveHits = [];
    permanentBlueCoral = pickCoralSpots(ARENA_BLUE_CORAL_COUNT, CORALBURST_MIN_SPOT_DIST, []);
    bossHealth = BOSS_MAX_HEALTH;

    stopBossMusic();
    bossMusicPhase2 = false;

    spears = [];
    nextSpearSpawnAt = 0;
    projectiles = [];

    floatingTexts = [];
    waterRipples = [];
    spawnFish();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
    gameState = 'intro';
    introStartedAt = performance.now();
  }
  resetLevel();

  // ---- player movement & collision ----
  function isWallForPlayer(tx, ty) {
    return tileChar(tx, ty) === '#';
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
    // The whirlpool only spins up during the wall-spin attack, pushing
    // outward toward the wall (and the spinning boss) regardless of
    // input -- a real current, not just a movement penalty.
    if (boss.phase === 'wallspin') {
      const dx = p.x - ARENA_CENTER_X, dy = p.y - ARENA_CENTER_Y;
      const d = Math.hypot(dx, dy) || 1;
      movePlayer(p, (dx / d) * WHIRLPOOL_SPEED * dt, (dy / d) * WHIRLPOOL_SPEED * dt);
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
    if (PLAYER_MODE === 1) {
      // Solo: either control scheme moves the one character that exists.
      const ix = (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0);
      const iy = (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0);
      updatePlayerMovement(players[0], ix, iy, now, dt);
      return;
    }
    updatePlayerMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), now, dt);
    updatePlayerMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), now, dt);
  }

  // Stamina bar sits top-left of each viewport -- no minimap in a single
  // circular room you can already see the whole of.
  function drawStaminaBar(vx, p) {
    const barW = 90, barH = 7;
    const bx = vx + 8, by = 8;
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

  // ---- spears ----
  // One floor tile's worth of candidates, scanned once -- same "scan the
  // grid once up front" convention Level 15 uses for its torch spawns.
  const OPEN_FLOOR_TILES = (() => {
    const list = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isWallForPlayer(x, y)) list.push({ x, y });
      }
    }
    return list;
  })();

  function spawnSpear() {
    for (let tries = 0; tries < 30; tries++) {
      const t = OPEN_FLOOR_TILES[Math.floor(Math.random() * OPEN_FLOOR_TILES.length)];
      const c = tileCenter(t.x, t.y);
      const tooClose = players.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < SPEAR_MIN_PLAYER_DIST);
      if (tooClose) continue;
      spears.push({ x: c.x, y: c.y, seed: Math.random() * 100 });
      return;
    }
  }

  // Walking onto a spear is the hit -- same "pickup is the damage action"
  // convention Level 10's dynamite and Level 15's torches use.
  function updateSpears(now) {
    if (now >= nextSpearSpawnAt && spears.length < SPEAR_MAX_LIVE && !boss.defeated) {
      spawnSpear();
      nextSpearSpawnAt = now + SPEAR_SPAWN_INTERVAL_MS;
    }
    players.forEach((p) => {
      if (p.caught) return;
      for (let i = spears.length - 1; i >= 0; i--) {
        const s = spears[i];
        if (Math.hypot(p.x - s.x, p.y - s.y) < 18) {
          spears.splice(i, 1);
          damageBoss(SPEAR_DAMAGE, s.x, s.y, now);
          playSpearHit();
        }
      }
    });
  }

  function damageBoss(amount, x, y, now) {
    if (boss.defeated) return;
    bossHealth = Math.max(0, bossHealth - amount);
    spawnFloatingText(x, y, `-${amount}`);
    if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) {
      boss.phase2 = true;
      bossMusicPhase2 = true;
      spawnFloatingText(boss.x, boss.y, 'PHASE 2');
      playPhaseShift();
      gameState = 'phase2intro';
      phase2IntroStartedAt = now;
    }
    if (bossHealth <= 0 && !boss.defeated) {
      boss.defeated = true;
      gameState = 'drying';
      dryStartedAt = now;
      dryFinished = false;
      playBossDefeat();
      stopBossMusic();
    }
  }

  // ---- boss body (same trailing-segment technique as every eel here) ----
  function updateBossSegments(m, now) {
    m.trail.unshift({ x: m.x, y: m.y });
    if (m.trail.length > 600) m.trail.length = 600;
    const segPositions = [];
    let distAccum = 0;
    let targetDist = BOSS_SEGMENT_SPACING;
    let segIndex = 0;
    for (let i = 1; i < m.trail.length && segIndex < BOSS_SEGMENT_COUNT; i++) {
      const a = m.trail[i - 1], b = m.trail[i];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      while (distAccum + segLen >= targetDist && segIndex < BOSS_SEGMENT_COUNT) {
        const t = segLen > 0.0001 ? (targetDist - distAccum) / segLen : 0;
        segPositions.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        segIndex++;
        targetDist += BOSS_SEGMENT_SPACING;
      }
      distAccum += segLen;
    }
    const last = m.trail[m.trail.length - 1] || { x: m.x, y: m.y };
    while (segPositions.length < BOSS_SEGMENT_COUNT) segPositions.push(last);
    m.segments = segPositions;

    if (now >= m.nextRippleAt) {
      spawnRipple(m.x, m.y);
      m.nextRippleAt = now + RIPPLE_INTERVAL_MS;
    }
  }

  // Simple vector movement toward a point, clamped to the arena's
  // circular boundary -- the whole arena is one open room, so there's
  // no pathfinding to do, just don't let anything cross the wall.
  function moveToward(entity, tx, ty, speed, dt, radius) {
    const dx = tx - entity.x, dy = ty - entity.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return true;
    const step = speed * dt;
    if (d > 0.001) entity.lookDir = { x: dx / d, y: dy / d };
    if (d <= step) {
      entity.x = tx; entity.y = ty;
    } else {
      entity.x += (dx / d) * step;
      entity.y += (dy / d) * step;
    }
    clampToArena(entity, radius);
    return d <= step;
  }

  function clampToArena(entity, radius) {
    const dx = entity.x - ARENA_CENTER_X, dy = entity.y - ARENA_CENTER_Y;
    const d = Math.hypot(dx, dy);
    const maxD = ARENA_RADIUS_PX - radius;
    if (d > maxD && d > 0.001) {
      entity.x = ARENA_CENTER_X + (dx / d) * maxD;
      entity.y = ARENA_CENTER_Y + (dy / d) * maxD;
    }
  }

  // ---- boss attack state machine ----
  const ALL_ATTACKS = ['wallspin', 'vanish', 'barrage', 'coralburst'];

  // Spots scattered around the arena for the coral-burst attack, spread
  // apart (rejection sampling) so they don't cluster into one big blob,
  // and sampled with sqrt(random()) radius so they're spread evenly
  // across the whole disk instead of bunching up near the center. `avoid`
  // lets the blue light spots steer clear of the red hazard spots (and
  // vice versa) by checking against a second, already-picked list too.
  function pickCoralSpots(count, minDist, avoid) {
    const spots = [];
    const avoidList = avoid || [];
    let tries = 0;
    while (spots.length < count && tries < 500) {
      tries++;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (ARENA_RADIUS_PX - CORALBURST_SPOT_RADIUS - 10);
      const x = ARENA_CENTER_X + Math.cos(a) * r;
      const y = ARENA_CENTER_Y + Math.sin(a) * r;
      if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < minDist)) continue;
      if (avoidList.some((s) => Math.hypot(s.x - x, s.y - y) < minDist)) continue;
      spots.push({ x, y, seed: Math.random() * 1000 });
    }
    return spots;
  }

  function pickAttack() {
    const pool = boss.phase2 ? ALL_ATTACKS.concat(['wavesplash']) : ALL_ATTACKS;
    const choices = pool.filter((a) => a !== boss.lastAttack);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.lastAttack = kind;
    if (kind === 'wallspin') {
      boss.wsSubPhase = 'warn';
      boss.wsWarnUntil = now + WALLSPIN_WARNING_MS;
      boss.wsAngle = Math.atan2(boss.y - ARENA_CENTER_Y, boss.x - ARENA_CENTER_X);
      boss.wsDir = Math.random() < 0.5 ? 1 : -1;
    } else if (kind === 'vanish') {
      boss.vSubPhase = 'fade';
      boss.vPhaseUntil = now + VANISH_FADE_MS;
      boss.vStartX = boss.x; boss.vStartY = boss.y;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * (ARENA_RADIUS_PX - boss.radius * 2.2);
      boss.vTargetX = ARENA_CENTER_X + Math.cos(angle) * r;
      boss.vTargetY = ARENA_CENTER_Y + Math.sin(angle) * r;
      boss.vNextRippleAt = now;
    } else if (kind === 'barrage') {
      boss.bUntil = now + BARRAGE_DURATION_MS;
      boss.bNextFireAt = now + 400;
      boss.bPlayerIndex = 0;
    } else if (kind === 'wavesplash') {
      boss.wUntil = now + WAVESPLASH_DURATION_MS;
      boss.wNextBurstAt = now;
    } else if (kind === 'coralburst') {
      boss.cbSubPhase = 'approach';
      boss.cbSpots = pickCoralSpots(CORALBURST_SPOT_COUNT, CORALBURST_MIN_SPOT_DIST, permanentBlueCoral);
    }
  }

  function finishAttack(now) {
    boss.phase = 'idle';
    boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
  }

  function updateBossIdle(now, dt) {
    if (now >= boss.nextIdleUntil) {
      startAttack(pickAttack(), now);
      return;
    }
    // Prefers a non-caught player over a caught one; otherwise whoever's
    // nearest. Written as a reduce over `players` (not hardcoded to two)
    // so it works unchanged whether there's one player or two.
    const pool = players.some((p) => !p.caught) ? players.filter((p) => !p.caught) : players;
    const target = pool.reduce((best, p) =>
      Math.hypot(p.x - boss.x, p.y - boss.y) < Math.hypot(best.x - boss.x, best.y - boss.y) ? p : best);
    moveToward(boss, target.x, target.y, BOSS_IDLE_SPEED, dt, boss.radius);
  }

  function bossContactCheck(now, radius) {
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < radius) triggerCaught(p, now);
    });
  }

  function updateBossWallspin(now, dt) {
    const wallR = ARENA_RADIUS_PX - boss.radius;
    if (boss.wsSubPhase === 'warn') {
      const tx = ARENA_CENTER_X + Math.cos(boss.wsAngle) * wallR;
      const ty = ARENA_CENTER_Y + Math.sin(boss.wsAngle) * wallR;
      moveToward(boss, tx, ty, PLAYER_SPEED * 1.6, dt, boss.radius);
      if (now >= boss.wsWarnUntil) {
        boss.wsSubPhase = 'spin';
        boss.wsUntil = now + WALLSPIN_DURATION_MS;
        boss.wsAngle = Math.atan2(boss.y - ARENA_CENTER_Y, boss.x - ARENA_CENTER_X);
      }
      return;
    }
    const speed = WALLSPIN_SPEED * speedMult(now);
    boss.wsAngle += (speed / wallR) * boss.wsDir * dt;
    boss.x = ARENA_CENTER_X + Math.cos(boss.wsAngle) * wallR;
    boss.y = ARENA_CENTER_Y + Math.sin(boss.wsAngle) * wallR;
    boss.lookDir = { x: -Math.sin(boss.wsAngle) * boss.wsDir, y: Math.cos(boss.wsAngle) * boss.wsDir };
    bossContactCheck(now, boss.radius + PLAYER_RADIUS + 6);
    if (now >= boss.wsUntil) finishAttack(now);
  }

  function updateBossVanish(now, dt) {
    if (boss.vSubPhase === 'fade') {
      const t = clamp(1 - (boss.vPhaseUntil - now) / VANISH_FADE_MS, 0, 1);
      boss.alpha = 1 - t * (1 - VANISH_MIN_ALPHA);
      if (now >= boss.vPhaseUntil) {
        boss.vSubPhase = 'travel';
        boss.vPhaseUntil = now + VANISH_TRAVEL_MS;
      }
      return;
    }
    if (boss.vSubPhase === 'travel') {
      boss.alpha = VANISH_MIN_ALPHA;
      const dist = Math.hypot(boss.vTargetX - boss.vStartX, boss.vTargetY - boss.vStartY) || 1;
      const speed = (dist / (VANISH_TRAVEL_MS / 1000)) * speedMult(now);
      moveToward(boss, boss.vTargetX, boss.vTargetY, speed, dt, boss.radius);
      if (now >= boss.vNextRippleAt) {
        waterRipples.push({ x: boss.x, y: boss.y, bornAt: now, faint: true });
        boss.vNextRippleAt = now + VANISH_RIPPLE_INTERVAL_MS;
      }
      if (now >= boss.vPhaseUntil) {
        boss.vSubPhase = 'warn';
        boss.vPhaseUntil = now + VANISH_LAND_WARNING_MS;
      }
      return;
    }
    if (boss.vSubPhase === 'warn') {
      const t = clamp(1 - (boss.vPhaseUntil - now) / VANISH_LAND_WARNING_MS, 0, 1);
      boss.alpha = VANISH_MIN_ALPHA + (1 - VANISH_MIN_ALPHA) * t;
      if (now >= boss.vPhaseUntil) {
        boss.vSubPhase = 'settle';
        boss.vPhaseUntil = now + 400;
        boss.alpha = 1;
        boss.vSlamAt = now;
        boss.vSlamX = boss.x;
        boss.vSlamY = boss.y;
        boss.vShockwaveHits = [];
        playChompThud(0);
        bossContactCheck(now, VANISH_SLAM_RADIUS);
      }
      return;
    }
    if (now >= boss.vPhaseUntil) finishAttack(now);
  }

  function updateBossBarrage(now, dt) {
    moveToward(boss, ARENA_CENTER_X, ARENA_CENTER_Y, BOSS_IDLE_SPEED * 0.5, dt, boss.radius);
    if (now >= boss.bNextFireAt) {
      const mult = speedMult(now);
      const speed = BARRAGE_PROJECTILE_SPEED * mult;
      const target = players[boss.bPlayerIndex % players.length];
      boss.bPlayerIndex++;
      const dx = target.x - boss.x, dy = target.y - boss.y;
      const baseAngle = Math.atan2(dy, dx);
      for (let i = 0; i < BARRAGE_VOLLEY_COUNT; i++) {
        const off = (i - (BARRAGE_VOLLEY_COUNT - 1) / 2) * BARRAGE_VOLLEY_SPREAD;
        const a = baseAngle + off;
        projectiles.push({ x: boss.x, y: boss.y, dirX: Math.cos(a), dirY: Math.sin(a), speed, seed: Math.random() * 1000 });
      }
      boss.bNextFireAt = now + BARRAGE_FIRE_INTERVAL_MS / mult;
      playChompThud(0);
    }
    if (now >= boss.bUntil) finishAttack(now);
  }

  function updateBossWavesplash(now, dt) {
    moveToward(boss, ARENA_CENTER_X, ARENA_CENTER_Y, BOSS_IDLE_SPEED * 0.5, dt, boss.radius);
    if (now >= boss.wNextBurstAt) {
      for (let i = 0; i < WAVESPLASH_COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        projectiles.push({ x: boss.x, y: boss.y, dirX: Math.cos(a), dirY: Math.sin(a), speed: WAVESPLASH_SPEED, wave: true });
      }
      boss.wNextBurstAt = now + WAVESPLASH_INTERVAL_MS;
      playChompThud(0);
    }
    if (now >= boss.wUntil) finishAttack(now);
  }

  // Settle at the center (at double the usual approach speed), let the
  // picked spots flash a warning, then let them actually grow into a
  // real hazard for a few seconds before clearing out and handing
  // control back to updateBossIdle.
  function updateBossCoralburst(now, dt) {
    if (boss.cbSubPhase === 'approach') {
      const arrived = moveToward(boss, ARENA_CENTER_X, ARENA_CENTER_Y, CORALBURST_APPROACH_SPEED, dt, boss.radius);
      if (arrived) {
        boss.cbSubPhase = 'warn';
        boss.cbPhaseUntil = now + CORALBURST_WARN_MS;
      }
      return;
    }
    if (boss.cbSubPhase === 'warn') {
      if (now >= boss.cbPhaseUntil) {
        boss.cbSubPhase = 'grown';
        boss.cbPhaseUntil = now + CORALBURST_GROWTH_MS;
        playChompThud(0);
      }
      return;
    }
    // 'grown' -- the coral itself is the hazard now, not the boss.
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil) return;
      if (boss.cbSpots.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < CORALBURST_SPOT_RADIUS)) {
        triggerCaught(p, now);
      }
    });
    if (now >= boss.cbPhaseUntil) {
      boss.cbSpots = [];
      finishAttack(now);
    }
  }

  function updateProjectiles(now, dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      const nx = pr.x + pr.dirX * pr.speed * dt;
      const ny = pr.y + pr.dirY * pr.speed * dt;
      if (Math.hypot(nx - ARENA_CENTER_X, ny - ARENA_CENTER_Y) > ARENA_RADIUS_PX) { projectiles.splice(i, 1); continue; }
      pr.x = nx; pr.y = ny;
      let hit = false;
      players.forEach((p) => {
        if (hit || p.caught || now < p.invulnerableUntil) return;
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < PROJECTILE_HIT_RADIUS) { triggerCaught(p, now); hit = true; }
      });
      if (hit) projectiles.splice(i, 1);
    }
  }

  // The shockwave from the vanish attack's landing -- an expanding ring
  // out to a full 6 tiles from the spot it came back up at, not tied to
  // boss.phase so it keeps expanding and catching players for its whole
  // VANISH_SHOCKWAVE_MS even after the attack itself has already finished
  // and handed control back to updateBossIdle.
  function updateVanishShockwave(now) {
    const elapsed = now - boss.vSlamAt;
    if (elapsed < 0 || elapsed >= VANISH_SHOCKWAVE_MS) return;
    const ringRadius = VANISH_SHOCKWAVE_RADIUS * (elapsed / VANISH_SHOCKWAVE_MS);
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || boss.vShockwaveHits.includes(p)) return;
      if (Math.hypot(p.x - boss.vSlamX, p.y - boss.vSlamY) <= ringRadius) {
        triggerCaught(p, now);
        boss.vShockwaveHits.push(p);
      }
    });
  }

  function updateBoss(now, dt) {
    updateProjectiles(now, dt);
    updateVanishShockwave(now);
    updateBossSegments(boss, now);
    if (boss.defeated) return;
    switch (boss.phase) {
      case 'idle': updateBossIdle(now, dt); break;
      case 'wallspin': updateBossWallspin(now, dt); break;
      case 'vanish': updateBossVanish(now, dt); break;
      case 'barrage': updateBossBarrage(now, dt); break;
      case 'wavesplash': updateBossWavesplash(now, dt); break;
      case 'coralburst': updateBossCoralburst(now, dt); break;
    }
  }

  // A caught player stays down -- no auto-respawn timer. Only when
  // BOTH players are down at once does the fight actually end, and it
  // ends in a full wipe/retry rather than a quiet respawn.
  function triggerCaught(p, now) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    playChompThud(0.35);
    spawnBloodEffect(p.x, p.y);
    p.caught = true;
    p.caughtAt = now;
    p.invulnerableUntil = Infinity;
    if (gameState === 'playing' && players.every((pl) => pl.caught)) {
      gameState = 'wiped';
      stopBossMusic();
    }
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

  // A spinning vortex at the arena's center, visible for the whole
  // wall-spin attack (warning included) -- several arms of churned
  // water rotating around the middle, matching the outward pull every
  // player actually feels during this attack.
  function drawWhirlpool(g, now) {
    if (boss.phase !== 'wallspin') return;
    g.save();
    g.translate(ARENA_CENTER_X, ARENA_CENTER_Y);
    const rings = 4;
    for (let i = 0; i < rings; i++) {
      const r = 30 + i * 22;
      const spin = (now * 0.0018 + i * 0.7) * (i % 2 === 0 ? 1 : -1);
      g.save();
      g.rotate(spin);
      g.beginPath();
      for (let a = 0; a <= Math.PI * 1.6; a += 0.15) {
        const rr = r * (0.7 + 0.3 * (a / (Math.PI * 1.6)));
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = `rgba(190,245,230,${0.3 - i * 0.05})`;
      g.lineWidth = 3;
      g.stroke();
      g.restore();
    }
    g.restore();
  }

  // The vanish attack's landing shockwave -- a bright ring expanding out
  // from the spot the boss just resurfaced at, out to a full 6 tiles,
  // fading out as it grows. Driven by boss.vSlamAt/vSlamX/vSlamY rather
  // than the current attack phase, same as updateVanishShockwave, so it
  // keeps drawing for its whole lifetime even once the boss has already
  // moved on to idle.
  function drawVanishShockwave(g, now) {
    const elapsed = now - boss.vSlamAt;
    if (elapsed < 0 || elapsed >= VANISH_SHOCKWAVE_MS) return;
    const t = elapsed / VANISH_SHOCKWAVE_MS;
    const r = VANISH_SHOCKWAVE_RADIUS * t;
    const alpha = 1 - t;
    g.save();
    g.translate(boss.vSlamX, boss.vSlamY);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.strokeStyle = `rgba(200,245,235,${alpha * 0.8})`;
    g.lineWidth = 7 * (1 - t * 0.6);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, Math.max(0, r - 16), 0, Math.PI * 2);
    g.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
    g.lineWidth = 2.5;
    g.stroke();
    g.restore();
  }

  // Coral-burst attack: a red danger ring pulsing at each picked spot
  // during the 2s warning, replaced by an actual red coral clump once it
  // grows in -- same red CORAL_PALETTE override the boss's own body uses
  // in phase 2, just planted in the sand instead of growing on its hide.
  const CORALBURST_RED = '#ff3b3b';
  const CORALBURST_BLUE = '#3ad4ff';
  function drawCoralPatch(g, cx, cy, radius, seed, now, color, coreColor) {
    color = color || CORALBURST_RED;
    coreColor = coreColor || '#b8291f';
    const h = Math.imul(Math.floor(seed * 1000), 2654435761) >>> 0;
    const branches = 6 + (h % 3);
    g.save();
    g.translate(cx, cy);
    for (let i = 0; i < branches; i++) {
      const a = (i / branches) * Math.PI * 2 + (h % 100) / 100;
      const len = radius * (0.55 + ((h >> (i * 3 + 1)) % 10) / 20);
      const sway = Math.sin(now * 0.002 + i + seed) * 2;
      const baseX = Math.cos(a) * radius * 0.15, baseY = Math.sin(a) * radius * 0.15;
      const tipX = Math.cos(a) * len + sway, tipY = Math.sin(a) * len;
      g.strokeStyle = color;
      g.lineWidth = 3.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(baseX, baseY);
      g.quadraticCurveTo((baseX + tipX) / 2 + sway * 0.4, (baseY + tipY) / 2, tipX, tipY);
      g.stroke();
      g.beginPath();
      g.arc(tipX, tipY, 3, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
    g.fillStyle = coreColor;
    g.fill();
    g.restore();
  }

  // A neon blue coral clump, always lit -- the arena's one permanent
  // light source besides each player's own, fixed in place for the
  // whole fight rather than tied to any one attack.
  function drawBlueCoral(g, s, now) {
    g.save();
    g.translate(s.x, s.y);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, ARENA_BLUE_CORAL_RADIUS * 2.4);
    glow.addColorStop(0, 'rgba(58,212,255,0.4)');
    glow.addColorStop(1, 'rgba(58,212,255,0)');
    g.beginPath();
    g.arc(0, 0, ARENA_BLUE_CORAL_RADIUS * 2.4, 0, Math.PI * 2);
    g.fillStyle = glow;
    g.fill();
    g.restore();
    drawCoralPatch(g, s.x, s.y, ARENA_BLUE_CORAL_RADIUS, s.seed, now, CORALBURST_BLUE, '#1a7a9e');
  }

  function drawPermanentBlueCoral(g, now) {
    permanentBlueCoral.forEach((s) => drawBlueCoral(g, s, now));
  }

  function drawCoralBurst(g, now) {
    if (boss.phase !== 'coralburst') return;
    if (boss.cbSubPhase === 'warn') {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
      boss.cbSpots.forEach((s) => {
        g.save();
        g.translate(s.x, s.y);
        g.beginPath();
        g.arc(0, 0, CORALBURST_SPOT_RADIUS * (0.9 + pulse * 0.1), 0, Math.PI * 2);
        g.fillStyle = `rgba(255,50,50,${0.16 + pulse * 0.22})`;
        g.fill();
        g.strokeStyle = `rgba(255,100,80,${0.5 + pulse * 0.4})`;
        g.lineWidth = 2.5;
        g.stroke();
        g.restore();
      });
    } else if (boss.cbSubPhase === 'grown') {
      boss.cbSpots.forEach((s) => drawCoralPatch(g, s.x, s.y, CORALBURST_SPOT_RADIUS, s.seed, now));
    }
  }

  function punchLight(g, x, y, radius, intensity) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) return;
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

  // The arena is always dark now -- a flat black overlay with a hole
  // punched out around each player's own light and around every neon
  // blue coral spot, composited on top of the scaled world every frame
  // of actual play (not during the intro/phase-2 cutscenes, which do
  // their own tight zoomed-in framing instead).
  function buildArenaDarkness(camX, camY, zoom) {
    const worldToScreen = (wx, wy) => ({ x: (wx - camX) * zoom + VIEW_W / 2, y: (wy - camY) * zoom + VIEW_H / 2 });

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, PLAYER_LIGHT_RADIUS * zoom, 1);
    });
    permanentBlueCoral.forEach((bs) => {
      const s = worldToScreen(bs.x, bs.y);
      punchLight(maskCtx, s.x, s.y, ARENA_BLUE_CORAL_LIGHT_RADIUS * zoom, 0.92);
    });
  }

  // A swaying clump of 3-4 seaweed strands -- a fixed base position per
  // tile (hashed, like the floor shading) with each strand's sway phase
  // offset so the clump doesn't move as one rigid unit.
  function drawSeaweed(g, px, py, x, y, t) {
    const h = Math.imul(x, 2654435761) ^ Math.imul(y, 40503);
    const u = (h ^ (h >>> 15)) >>> 0;
    const strands = 3 + (u % 2);
    for (let i = 0; i < strands; i++) {
      const baseX = px + 6 + ((u >> (i * 4)) % 20);
      const height = 14 + ((u >> (i * 3 + 2)) % 10);
      const phase = (u % 100) / 100 * Math.PI * 2 + i * 1.7;
      const sway = Math.sin(t * 0.0022 + phase) * 5;
      g.strokeStyle = i % 2 === 0 ? '#2f6b4a' : '#3a7d55';
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(baseX, py + TILE - 2);
      g.quadraticCurveTo(baseX + sway * 0.6, py + TILE - height * 0.6, baseX + sway, py + TILE - height);
      g.stroke();
    }
  }

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

  // Zoomed all the way out to show the whole arena, so there's no
  // camera-relative culling to do -- the full 42x42 grid is cheap
  // enough to just draw every frame regardless of camX/camY/zoom.
  function drawTiles(g, now) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        g.fillStyle = ch === '#' ? '#1a2226' : floorShade(x, y);
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          continue;
        }

        // A faint drifting light-caustic streak across every bit of
        // open water -- a subtle moving band instead of a static floor
        // texture.
        const h = Math.imul(x, 668265263) ^ Math.imul(y, 2246822519);
        const seed = ((h ^ (h >>> 13)) >>> 0) % 1000 / 1000;
        const band = Math.sin(now * 0.0005 + seed * 20 + x * 0.3 + y * 0.2);
        if (band > 0.65) {
          g.fillStyle = `rgba(190,245,230,${(band - 0.65) * 0.25})`;
          g.fillRect(px, py, TILE, TILE);
        }

        if (ch === 'R') drawCoral(g, px, py, x, y, now);
        if (ch === 'G') drawSeaweed(g, px, py, x, y, now);
      }
    }

    drawWhirlpool(g, now);
    drawPermanentBlueCoral(g, now);
    drawCoralBurst(g, now);
    drawVanishShockwave(g, now);
    drawBloodSplatters(g);
    drawSpears(g, now);
    drawWaterRipples(g, now);
    drawFloatingTexts(g);
  }
  // A spear stuck upright in the sand, glinting faintly -- walking onto
  // it is the hit.
  function drawSpears(g, now) {
    spears.forEach((s) => {
      const bob = Math.sin(now * 0.003 + s.seed) * 2;
      g.save();
      g.translate(s.x, s.y + bob);
      g.strokeStyle = '#8a7560';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 10);
      g.lineTo(0, -12);
      g.stroke();
      g.beginPath();
      g.moveTo(0, -18);
      g.lineTo(-4, -8);
      g.lineTo(4, -8);
      g.closePath();
      g.fillStyle = '#c9d4d8';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    });
  }

  function drawFloatingTexts(g) {
    // Counter-scaled against the boss camera's own zoom so damage
    // numbers stay a fixed, readable size on screen instead of
    // shrinking down with everything else in the zoomed-out arena.
    const invZoom = 1 / ZOOM;
    floatingTexts.forEach((f) => {
      const t = f.life / f.maxLife;
      g.save();
      g.globalAlpha = 1 - t;
      g.fillStyle = '#ffe27a';
      g.font = `bold ${11 * invZoom}px monospace`;
      g.textAlign = 'center';
      g.fillText(f.text, f.x, f.y - (18 + t * 20) * invZoom);
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

  // A single tiny coral nub, in a random spot per segment (hashed from a
  // seed, not live position, so it reads as a stable growth rather than
  // something drifting around) -- same CORAL_PALETTE as the floor's own
  // coral, just shrunk down to fit a body a third the usual eel's size.
  // Coral growths on the boss's own body -- the same branching-clump
  // technique as the arena floor's own coral, just anchored to a moving
  // body segment instead of a tile. Phase 2: every patch turns red and
  // grows to 2x the size.
  function drawBossCoralGrowth(g, r, seed, phase2) {
    const count = 2;
    const sizeMult = phase2 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = r * (0.3 + (u % 5) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const color = phase2 ? '#ff3b3b' : CORAL_PALETTE[u % CORAL_PALETTE.length];
      const tipLen = Math.max(1.4, r * 0.32) * sizeMult;
      g.strokeStyle = color;
      g.lineWidth = Math.max(1, r * 0.17) * sizeMult;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a) * tipLen, by + Math.sin(a) * tipLen);
      g.stroke();
      g.beginPath();
      g.arc(bx + Math.cos(a) * tipLen, by + Math.sin(a) * tipLen, Math.max(1, r * 0.15) * sizeMult, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
  }

  // Dried, cracked skin once DEHYDRATED (phase 2) -- a few jagged dark
  // fracture lines wandering out from a point near the center, clipped
  // to this segment/head's own circular silhouette so they never poke
  // outside it. Fixed per segment (hashed from its own seed, not its
  // live position), same stable-growth convention as the coral above.
  function drawBossCracks(g, r, seed) {
    const h = Math.imul(Math.floor(seed * 1000), 2654435761) >>> 0;
    g.save();
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.clip();
    const crackCount = 3;
    for (let c = 0; c < crackCount; c++) {
      const ch = Math.imul(h + c * 131, 2246822519) >>> 0;
      let angle = ((ch % 360) * Math.PI) / 180;
      let x = Math.cos(angle) * r * 0.15, y = Math.sin(angle) * r * 0.15;
      g.strokeStyle = 'rgba(25,12,8,0.7)';
      g.lineWidth = Math.max(0.8, r * 0.055);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y);
      const segs = 3 + (ch % 2);
      for (let i = 0; i < segs; i++) {
        angle += (((ch >> (i * 3 + 2)) % 7) - 3) * 0.35;
        const len = r * (0.25 + ((ch >> (i * 2 + 1)) % 4) * 0.08);
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();
  }

  // Trailing seaweed, same strands-off-a-fixed-anchor technique the Bog
  // itself uses -- the boss "looks like the Bog" in this exact way.
  function drawBossWeed(g, r, seed, t) {
    const h = Math.imul(Math.floor(seed * 1000), 2654435761) >>> 0;
    const strands = 1 + (h % 2);
    for (let i = 0; i < strands; i++) {
      const baseAngle = ((h >> (i * 5)) % 360) * Math.PI / 180;
      const baseX = Math.cos(baseAngle) * r * 0.8;
      const baseY = Math.sin(baseAngle) * r * 0.8;
      const len = r * (0.7 + ((h >> (i * 3 + 2)) % 10) / 15);
      const phase = ((h % 100) / 100) * Math.PI * 2 + i * 1.3 + seed;
      const sway = Math.sin(t * 0.0025 + phase) * 4;
      const tipX = baseX + Math.cos(baseAngle) * len + sway;
      const tipY = baseY + Math.sin(baseAngle) * len;
      g.strokeStyle = i % 2 === 0 ? '#2f6b4a' : '#3a7d55';
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(baseX, baseY);
      g.quadraticCurveTo((baseX + tipX) / 2 + sway * 0.4, (baseY + tipY) / 2, tipX, tipY);
      g.stroke();
    }
  }

  // Coral balls (barrage) and waves (wavesplash) -- both share the same
  // projectile pool and physics, so one draw pass covers both. A wave
  // reads as an actual curling crest -- a thick teal band with a bright
  // foam highlight along its leading edge, open toward the trailing side
  // so it reads as water curling forward, plus a fading wake behind it
  // to sell the motion. A coral ball is a core sphere with a scatter of
  // small coral polyps around it, not a plain glowing orb.
  function drawProjectiles(g) {
    projectiles.forEach((pr) => {
      g.save();
      g.translate(pr.x, pr.y);
      if (pr.wave) {
        g.rotate(Math.atan2(pr.dirY, pr.dirX));

        // fading wake behind the crest
        g.strokeStyle = 'rgba(180,230,220,0.28)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(-7, 0, 9, -Math.PI * 0.5, Math.PI * 0.5);
        g.stroke();
        g.strokeStyle = 'rgba(180,230,220,0.16)';
        g.beginPath();
        g.arc(-13, 0, 11, -Math.PI * 0.45, Math.PI * 0.45);
        g.stroke();

        // the crest itself -- a thick curved teal band
        g.beginPath();
        g.arc(0, 0, 10, -Math.PI * 0.58, Math.PI * 0.58);
        g.strokeStyle = 'rgba(110,190,180,0.9)';
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.stroke();

        // a bright foam line along its leading edge
        g.beginPath();
        g.arc(0, 0, 10, -Math.PI * 0.5, Math.PI * 0.5);
        g.strokeStyle = 'rgba(255,255,255,0.95)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.stroke();

        // a few foam flecks scattered along the crest
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI * 0.38 + i * 0.38;
          const fx = Math.cos(a) * 10, fy = Math.sin(a) * 10;
          g.beginPath();
          g.arc(fx, fy, 1.2, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fill();
        }
      } else {
        // An actual knobbly ball of coral -- a core sphere plus a
        // scatter of small polyps around its surface in the same
        // CORAL_PALETTE the arena floor's own coral uses, not a plain
        // glowing lava-orb. The bump layout is hashed from the
        // projectile's own seed, not its live position, so it stays
        // fixed as the ball travels instead of flickering every frame.
        const grad = g.createRadialGradient(-3, -3, 1, 0, 0, 9);
        grad.addColorStop(0, '#ffb48a');
        grad.addColorStop(0.6, '#c96a3a');
        grad.addColorStop(1, '#6b3016');
        g.beginPath();
        g.arc(0, 0, 9, 0, Math.PI * 2);
        g.fillStyle = grad;
        g.shadowColor = '#ff6f4a';
        g.shadowBlur = 8;
        g.fill();
        g.shadowBlur = 0;

        const h = Math.imul(Math.floor((pr.seed || 0) * 1000), 2654435761) >>> 0;
        for (let i = 0; i < 4; i++) {
          const u = ((h >> (i * 5)) >>> 0) % 360;
          const a = u * Math.PI / 180;
          const dist = 5 + ((h >> (i * 3 + 1)) % 3);
          const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
          g.beginPath();
          g.arc(bx, by, 1.6, 0, Math.PI * 2);
          g.fillStyle = CORAL_PALETTE[(u + i) % CORAL_PALETTE.length];
          g.fill();
        }
      }
      g.restore();
    });
  }

  function drawBoss(g, t) {
    if (boss.defeated) return;
    const m = boss;
    g.save();
    g.globalAlpha = m.alpha;

    // Ground shadow trail, drawn first so it sits under every segment.
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = m.segments.length - 1; i >= 0; i--) {
      const seg = m.segments[i];
      const r = m.radius * (1 - i * 0.045);
      g.beginPath();
      g.ellipse(seg.x, seg.y + r * 0.5, Math.max(2, r * 0.85), Math.max(1.5, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    // Body segments, tail first so the head draws on top -- a deep
    // teal, grown over with both seaweed and coral.
    for (let i = m.segments.length - 1; i >= 0; i--) {
      const seg = m.segments[i];
      const r = Math.max(2, m.radius * (1 - i * 0.045));
      const base = i % 2 === 0 ? '#1a7a6e' : '#1f8c7e';
      g.save();
      g.translate(seg.x, seg.y);

      if (i % 2 === 0 && i < m.segments.length - 2) {
        const next = m.segments[Math.min(i + 1, m.segments.length - 1)];
        const dx = seg.x - next.x, dy = seg.y - next.y;
        const ang = Math.atan2(dy, dx) + Math.PI / 2;
        drawFin(g, 0, 0, Math.cos(ang) * r * 1.5, Math.sin(ang) * r * 1.5, r * 0.45, 'rgba(60,180,160,0.5)');
      }

      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#0a2e28';
      g.shadowBlur = 4;
      g.fill();
      g.shadowBlur = 0;

      drawBossWeed(g, r, m.seed + i * 13, t);
      drawBossCoralGrowth(g, r, m.seed + i * 13 + 6.5, m.phase2);
      if (m.phase2) drawBossCracks(g, r, m.seed + i * 13 + 3.2);

      g.restore();
    }

    g.save();
    g.translate(m.x, m.y);

    const points = 12;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = m.radius
        + Math.sin(t * 0.006 + i * 1.7 + m.seed) * 1.6
        + Math.sin(t * 0.0021 + i * 3.1 + m.seed) * 0.8;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    const headAngle = Math.atan2(m.lookDir.y, m.lookDir.x);
    [-1, 1].forEach((side) => {
      const perp = headAngle + (Math.PI / 2) * side;
      const baseX = Math.cos(perp) * m.radius * 0.5, baseY = Math.sin(perp) * m.radius * 0.5;
      const backAngle = headAngle + Math.PI + (0.5 * side);
      const tipX = baseX + Math.cos(backAngle) * m.radius * 1.3;
      const tipY = baseY + Math.sin(backAngle) * m.radius * 1.3;
      drawFin(g, baseX, baseY, tipX, tipY, m.radius * 0.32, 'rgba(60,180,160,0.55)');
    });

    trace();
    const headGrad = g.createRadialGradient(-m.radius * 0.3, -m.radius * 0.35, 1, 0, 0, m.radius * 1.05);
    headGrad.addColorStop(0, shade('#1f8c7e', 0.22));
    headGrad.addColorStop(0.55, '#1f8c7e');
    headGrad.addColorStop(1, shade('#1f8c7e', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#0a2e28';
    g.shadowBlur = 8;
    g.fill();
    g.shadowBlur = 0;
    drawBossWeed(g, m.radius, m.seed, t);
    drawBossCoralGrowth(g, m.radius, m.seed + 6.5, m.phase2);
    if (m.phase2) drawBossCracks(g, m.radius, m.seed + 3.2);

    // mouth instead of an eye, same convention as the Dig Worm
    drawMonsterMouth(g, m.radius, m.lookDir);

    g.restore();
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

  function hexToRgbTriplet(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function drawBossIntroOverlay(vx, now) {
    const t = clamp((now - introStartedAt) / BOSS_INTRO_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 34, VIEW_W, 68);
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(220,60,60,${alpha})`;
    ctx.shadowColor = 'rgba(220,60,60,0.8)';
    ctx.shadowBlur = 10 * alpha;
    ctx.fillText(BOSS_NAME, vx + VIEW_W / 2, VIEW_H / 2 + 8);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawPhase2IntroOverlay(vx, now) {
    const t = clamp((now - phase2IntroStartedAt) / PHASE2_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    const rgb = hexToRgbTriplet(PHASE2_NAME_COLOR);
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 42, VIEW_W, 84);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = `rgba(${rgb},${alpha})`;
    ctx.shadowColor = `rgba(${rgb},0.8)`;
    ctx.shadowBlur = 10 * alpha;
    ctx.fillText(BOSS_NAME, vx + VIEW_W / 2, VIEW_H / 2);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = `rgba(${rgb},${alpha * 0.85})`;
    ctx.fillText(PHASE2_SUBTITLE, vx + VIEW_W / 2, VIEW_H / 2 + 24);
    ctx.restore();
  }

  function drawBossHealthBar(vx, now) {
    const barW = 210, barH = 10;
    const bx = vx + VIEW_W / 2 - barW / 2, by = 14;
    const frac = clamp(bossHealth / BOSS_MAX_HEALTH, 0, 1);
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.phase2 ? PHASE2_NAME_COLOR : '#7ad6c8';
    ctx.fillText(boss.phase2 ? `${BOSS_NAME} — ${PHASE2_SUBTITLE}` : BOSS_NAME, vx + VIEW_W / 2, by - 4);
    ctx.fillStyle = 'rgba(5,5,8,0.7)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#202225';
    ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    if (boss.phase2) { grad.addColorStop(0, '#8a1a1a'); grad.addColorStop(1, '#d9a24a'); }
    else { grad.addColorStop(0, '#0f4a46'); grad.addColorStop(1, '#2fb0a0'); }
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, barW * frac, barH);
    if (frac < 0.3) {
      const flicker = 0.3 + 0.3 * Math.sin(now * 0.02);
      ctx.fillStyle = `rgba(255,255,255,${flicker * 0.4})`;
      ctx.fillRect(bx, by, barW * frac, barH);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
  }

  // A small radar in the corner -- the main view is zoomed out far enough
  // that a planted spear is only a few screen pixels, easy to lose track
  // of against the coral and seaweed. This draws the arena flattened to a
  // fixed-size circle with bright, oversized dots for the spears (the
  // whole point of it), plus the boss and both players for orientation.
  function drawMinimap(vx, now) {
    const cx = vx + VIEW_W - MINIMAP_RADIUS - MINIMAP_MARGIN;
    const cy = MINIMAP_RADIUS + MINIMAP_MARGIN;
    const scale = MINIMAP_RADIUS / ARENA_RADIUS_PX;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5,16,20,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,210,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_RADIUS - 1, 0, Math.PI * 2);
    ctx.clip();

    spears.forEach((s) => {
      const sx = cx + (s.x - ARENA_CENTER_X) * scale;
      const sy = cy + (s.y - ARENA_CENTER_Y) * scale;
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.006 + s.seed);
      ctx.beginPath();
      ctx.arc(sx, sy, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,224,110,${pulse})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 5.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,224,110,${pulse * 0.4})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    const bx2 = cx + (boss.x - ARENA_CENTER_X) * scale;
    const by2 = cy + (boss.y - ARENA_CENTER_Y) * scale;
    ctx.beginPath();
    ctx.arc(bx2, by2, 4, 0, Math.PI * 2);
    ctx.fillStyle = boss.phase2 ? '#e0603a' : '#2fb8a8';
    ctx.fill();

    players.forEach((pl, i) => {
      const px2 = cx + (pl.x - ARENA_CENTER_X) * scale;
      const py2 = cy + (pl.y - ARENA_CENTER_Y) * scale;
      ctx.beginPath();
      ctx.arc(px2, py2, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#f2a33c' : '#5fd45f';
      ctx.fill();
    });

    ctx.restore();
    ctx.restore();
  }

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const intro = gameState === 'intro';
    const phase2Intro = gameState === 'phase2intro';
    const cutscene = intro || phase2Intro;
    // Fully zoomed out, fixed on the arena's own center -- the whole
    // circular room fits on screen at once, so there's no reason to
    // follow either player around. The intro/phase-2 cutscenes punch in
    // tighter on the boss itself for a dramatic close-up instead.
    const zoom = cutscene ? ZOOM * BOSS_INTRO_ZOOM_MULT : ZOOM;
    const camX = cutscene ? boss.x : ARENA_CENTER_X;
    const camY = cutscene ? boss.y : ARENA_CENTER_Y;
    const shakeX = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;
    const shakeY = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.fillStyle = '#050308';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, now);
    drawFish(ctx);
    drawProjectiles(ctx);
    drawBoss(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    ctx.restore();

    if (!cutscene) {
      buildArenaDarkness(camX, camY, zoom);
      ctx.drawImage(maskCanvas, vx, 0);
    }

    if (intro) {
      drawBossIntroOverlay(vx, now);
    } else if (phase2Intro) {
      drawPhase2IntroOverlay(vx, now);
    } else {
      drawProximityWarning(vx, Math.hypot(p.x - boss.x, p.y - boss.y), now);
      drawBossHealthBar(vx, now);
      drawStaminaBar(vx, p);
      drawMinimap(vx, now);
      if (p.caught) drawCutsceneOverlay(vx, p, now);
    }

    ctx.restore();
  }

  const PROXIMITY_WARNING_RADIUS = 300;

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    const alpha = closeness * 0.6 * pulse;
    ctx.fillStyle = `rgba(200,20,20,${alpha})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
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
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again.';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateIntroCutscene(now) {
    if (gameState !== 'intro') return;
    if (now - introStartedAt >= BOSS_INTRO_CUTSCENE_MS) {
      gameState = 'playing';
      boss.nextIdleUntil = now + BOSS_INTRO_GRACE_MS;
      nextSpearSpawnAt = now + 1500;
      startBossMusic();
    }
  }

  function updatePhase2Cutscene(now) {
    if (gameState !== 'phase2intro') return;
    if (now - phase2IntroStartedAt >= PHASE2_CUTSCENE_MS) gameState = 'playing';
  }

  function updateDryCutscene(now) {
    if (gameState !== 'drying' || dryFinished) return;
    if (now - dryStartedAt < DRY_CUTSCENE_MS) return;
    dryFinished = true;
    if (!bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
    }
    if (window.GoofyStory) window.GoofyStory.completeLevel(20);
    window.location.href = 'level21.html';
  }

  function drawDryingOverlay(now) {
    const t = clamp((now - dryStartedAt) / DRY_CUTSCENE_MS, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(226,204,150,${t * 0.82})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (t > 0.3) {
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(60,42,16,${clamp((t - 0.3) / 0.3, 0, 1)})`;
      ctx.fillText('THE FACILITY DRIES UP...', canvas.width / 2, canvas.height / 2);
    }
    ctx.restore();
  }

  function updateHud() {
    hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : `Boss: ${bossHealth}/${BOSS_MAX_HEALTH} HP${boss.phase2 ? ' — phase 2' : ''}`;
    hudBossEl.classList.toggle('done', boss.defeated);
    hudSpearsEl.textContent = boss.defeated ? 'Spears: --' : `Spears: ${spears.length} live`;
    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;

  function loop(now) {
    try {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    updateIntroCutscene(now);
    updatePhase2Cutscene(now);
    updateDryCutscene(now);

    if (gameState === 'playing') {
      elapsedMs = now - runStartTime;
      updateInputMovement(now, dt);
      updateSpears(now);
      updateFish(now, dt);
      updateBoss(now, dt);
      updateAmbientTension();
      updateWaterRipples(now);
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
      ctx.fillStyle = `rgba(20,120,110,${catchFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      catchFlash -= dt * 1.2;
    }

    if (gameState === 'drying') drawDryingOverlay(now);

    updateOverlay();
    updateHud();
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
