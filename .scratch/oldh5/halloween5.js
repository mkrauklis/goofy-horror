(function () {
  const HM = window.HardMode;
  const FOOT_SURFACE = 'normal'; // which footstep sound to use (js/footsteps.js)
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isHalloweenUnlocked(5)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish Halloween 4 first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.HALLOWEEN5;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 460;
  const SOLO_DAMAGE_MULT = PLAYER_MODE === 1 ? 1.5 : 1;

  // Same trick every boss level uses: ZOOM is picked so the visible half
  // width/height both exceed half the arena's own size, so the camera
  // clamp in renderViewport collapses to a fixed center point instead of
  // following either player -- the whole landing pad reads as one
  // screen. Same proven 35x21 @ 32px footprint as Level 15/25.
  const ZOOM = 0.3;
  function visibleHalfW() { return (VIEW_W / 2) / ZOOM; }
  function visibleHalfH() { return (VIEW_H / 2) / ZOOM; }

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss: the Candy Kraken -- a tentacled monster made entirely of candy,
  // 2x2 tiles across.
  const BOSS_RADIUS = 32;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.1;
  const BOSS_NAME = 'THE CANDY KRAKEN';

  const BOSS_INTRO_CUTSCENE_MS = 3000;
  const BOSS_INTRO_ZOOM_MULT = 1.7;
  const BOSS_INTRO_SHAKE_MAG = 7;
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_IDLE_SPEED = HM.speed(PLAYER_SPEED * 0.35);
  const BOSS_IDLE_MIN_MS = 900;
  const BOSS_IDLE_MAX_MS = 1500;

  const BOSS_MAX_HEALTH = HM.bossHp(50);
  const PHASE2_HEALTH_THRESHOLD = HM.bossHp(30);
  const PHASE2_CUTSCENE_MS = 3000;
  const PHASE2_NAME_COLOR = '#c9b4d6';
  const PHASE2_SUBTITLE = 'WITHERED';

  // Every 5th attack ends with the boss stunned for 7.5 seconds. That's the
  // only time you can hurt it: run up and take a bite out of it (10 damage).
  const ATTACKS_PER_STUN = 5;
  const STUN_DURATION_MS = 7500;
  const BITE_DAMAGE = 10;
  const BITE_RADIUS = BOSS_RADIUS + PLAYER_RADIUS + 8;
  const BITE_COOLDOWN_MS = 1100; // per player, between bites

  // The round arena: the floor is a circle inside a ring of brick wall.
  const ARENA_CX = WORLD_W / 2, ARENA_CY = WORLD_H / 2;
  const ARENA_R = LEVEL.floorRadius * TILE;

  // Attack 1 -- the candy spiral: it spins and spits candy out at 5x speed for
  // 10 seconds, each piece twice the normal size.
  const SPIRAL_MS = 10000;
  const SPIRAL_INTERVAL_MS = 140;
  const SPIRAL_SPIN_RATE = 2.4; // radians per second
  const CANDY_SPEED = HM.proj(PLAYER_SPEED * 5);
  const CANDY_NORMAL_RADIUS = 7;
  const CANDY_RADIUS = CANDY_NORMAL_RADIUS * 2;
  const CANDY_HIT_RADIUS = CANDY_RADIUS + PLAYER_RADIUS * 0.5;

  // Attack 2 -- it screams, then runs you down at 1.3x speed for 10 seconds.
  const SCREAM_MS = 900;
  const CHASE_MS = 10000;
  const CHASE_SPEED = PLAYER_SPEED * 1.3;

  // Attack 3 -- ten candy corn patches (2x2 tiles, round): a red circle flashes
  // for a second, then the candy corn shoots up.
  const CORN_COUNT = 10;
  const CORN_WARN_MS = 1000;
  const CORN_ACTIVE_MS = 700;
  const CORN_RADIUS = TILE;

  // Attack 4 (withered phase only) -- three 5x5 clouds of cotton candy. Stay in
  // one for 2.5 seconds and you're done; get out sooner and you're only
  // slowed by 30% for 5 seconds.
  const GAS_COUNT = 3;
  const GAS_WARN_MS = 1000;
  const GAS_LIFE_MS = 8000;
  const GAS_RADIUS = TILE * 2.5;
  const GAS_KILL_MS = 2500;
  const GAS_SLOW_MS = 5000;
  const GAS_SLOW_MULT = 0.7;

  // The candy the boss leaves behind as it moves, fading away slowly.
  const TRAIL_LIFE_MS = 7000;
  const TRAIL_STEP = 24;

  const DEATH_FALL_MS = 1200;
  const DEATH_DRAG_MS = 1800;

  const RADAR_DURATION_MS = HM.ability(10000);
  const ENERGY_DURATION_MS = HM.ability(10000);
  const SCANNER_DURATION_MS = HM.ability(10000);
  const FROZEN_SPEED_MULT = 0.75;
  const CRATE_RESPAWN_MS = 60000;
  const SMOKE_FUSE_MS = 3000;
  const SMOKE_DURATION_MS = HM.ability(10000);
  const SMOKE_RADIUS = 70;
  const NVG_DURATION_MS = HM.ability(10000);
  const NVG_RANGE_MULT = 2;
  const CRATE_ITEMS = ['radar', 'co2', 'scanner', 'smoke', 'nightvision', 'shotgun-ammo', 'energy'];
  const SHOTGUN_STUN_MS = HM.ability(4000);
  const SHOTGUN_AMMO_MAX = 3;
  const SHOTGUN_RANGE = 70;

  // ---- sprint / stamina ----
  const DOUBLE_TAP_MS = 300;
  const STAMINA_MAX = 15;
  const SPRINT_SPEED_MULT = 2;
  const EXHAUSTED_SPEED_MULT = 0.5;
  const SPRINT_DRAIN_RATE = HM.drain(STAMINA_MAX / 15);
  const EXHAUSTED_MS = 5000;
  const EXHAUSTED_REGEN_RATE = (STAMINA_MAX / 2) / (EXHAUSTED_MS / 1000);
  const NORMAL_REGEN_RATE = EXHAUSTED_REGEN_RATE / 2;
  const WALK_CYCLE_SPEED = 9;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');


  const hudBossEl = document.getElementById('hud-boss');
  const hudMissilesEl = document.getElementById('hud-missiles');
  const hudPhaseEl = document.getElementById('hud-phase');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  const exploredCanvas = document.createElement('canvas');
  exploredCanvas.width = COLS;
  exploredCanvas.height = ROWS;
  const exploredCtx = exploredCanvas.getContext('2d');
  let explored = new Uint8Array(COLS * ROWS);
  const EXPLORE_RADIUS = 7;
  const MINIMAP_W = 90;

  // ---- procedural audio (no asset files) -- the same plain ambient
  // drone every boss level uses.
  let audioCtx = null;
  let musicMasterGain = null;
  let musicEnabled = false;
  let ambientGain = null;
  let ambientSubOsc = null;
  let ambientMidGain = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = new AudioCtor();

    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.value = musicEnabled ? 1 : 0;
    musicMasterGain.connect(audioCtx.destination);

    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.06;
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

    ambientSubOsc = addDroneVoice(42, 'sine', 0.6, 0.05, 1.5).osc;
    addDroneVoice(44.5, 'sine', 0.5, 0.08, 2);
    addDroneVoice(21, 'sine', 0.4, 0.03, 0.8);
    ambientMidGain = addDroneVoice(94, 'sawtooth', 0, 0.15, 6).gain;
    addDroneVoice(640, 'triangle', 0.05, 0.02, 40);
    // the boss theme: only while the fight is actually on, and more
    // frantic as the boss's health drops
    if (window.BossMusic) {
      window.BossMusic.start({
        audioCtx, dest: musicMasterGain, theme: 'candy',
        isActive: () => gameState === 'playing' && !boss.defeated,
        intensity: () => 1 - bossHealthFrac(),
      });
    }
  }

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.hypot(players[0].x - boss.x, players[0].y - boss.y);
    const proximity = clamp(1 - minDist / 420, 0, 1);
    ambientGain.gain.setTargetAtTime(0.06 + proximity * 0.18, audioCtx.currentTime, 0.3);
    ambientSubOsc.frequency.setTargetAtTime(42 + proximity * 12, audioCtx.currentTime, 0.3);
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
  function playPickupChime() { playTone(660, 0.16, 'sine', 0.2); }
  function playItemChime(freq) { playTone(freq, 0.25, 'square', 0.18); }
  function playMissileLaunch() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, start);
    osc.frequency.exponentialRampToValueAtTime(760, start + 0.3);
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }
  function playBossHit() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, start);
    osc.frequency.exponentialRampToValueAtTime(60, start + 0.15);
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  }
  function playExplosion() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, start);
    osc.frequency.exponentialRampToValueAtTime(30, start + 0.4);
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
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

  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const keys = {};
  const lastTapTime = [{}, {}];
  function handleMovementKeyPress(key, now) {
    const playerIndex = PLAYER_MODE === 1 ? 0 : (key === 'w' || key === 'a' || key === 's' || key === 'd') ? 0 : 1;
    const last = lastTapTime[playerIndex][key] || 0;
    if (now - last < DOUBLE_TAP_MS) {
      const p = players[playerIndex];
      if (p.moveState !== 'exhausted' && p.stamina > 0) p.sprintActive = true;
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
    if (e.key === 'Enter' && gameState === 'wiped') resetLevel();
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) { keys[e.key] = false; e.preventDefault(); }
  });

  function clamp(v, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.max(min, Math.min(max, v));
  }
  function worldToTile(x, y) { return { x: Math.floor(x / TILE), y: Math.floor(y / TILE) }; }
  function tileChar(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return LEVEL.grid[ty][tx];
  }
  function tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clampC = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clampC(((n >> 16) & 255) + 255 * amt);
    const g2 = clampC(((n >> 8) & 255) + 255 * amt);
    const b = clampC((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }
  // The boss's "colors invert" phase-2 transformation is genuine channel
  // inversion, not a hand-picked second palette -- every color drawBoss
  // uses is piped through this instead.
  function isWallForPlayer(tx, ty) { return tileChar(tx, ty) === '#'; }
  function canStandAt(x, y) {
    const r = PLAYER_RADIUS;
    const corners = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return !isWallForPlayer(t.x, t.y);
    });
  }
  function movePlayer(p, dx, dy) {
    if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;
    // keep everyone inside the round brick wall
    const ex = p.x - ARENA_CX, ey = p.y - ARENA_CY, ed = Math.hypot(ex, ey), emax = ARENA_R - PLAYER_RADIUS;
    if (ed > emax) { p.x = ARENA_CX + (ex / ed) * emax; p.y = ARENA_CY + (ey / ed) * emax; }
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
    const slow = performance.now() < p.slowUntil ? GAS_SLOW_MULT : 1; // cotton candy slows you by 30%
    if (p.moveState === 'exhausted') return EXHAUSTED_SPEED_MULT * slow;
    if (p.moveState === 'sprinting') return SPRINT_SPEED_MULT * slow;
    return slow;
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

  function isHidden(p, now) {
    return smokeBombs.some((b) => b.exploded && now < b.endsAt && Math.hypot(p.x - b.x, p.y - b.y) < SMOKE_RADIUS);
  }

  function formatTime(ms) {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }

  const BEST_TIME_KEY = 'goofy-horror-best-halloween5';
  let bestMs = (() => {
    const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(v) ? v : null;
  })();
  let runStartTime = performance.now();
  let elapsedMs = 0;
  let bestRecorded = false;

  let bossHealth = BOSS_MAX_HEALTH;
  // 'intro' | 'playing' | 'phase2intro' | 'dying' | 'wiped'
  let gameState = 'intro';
  let introStartedAt = 0;
  let phase2IntroStartedAt = 0;
  let deathStartedAt = 0;
  let deathTarget = null;
  let catchFlash = 0;

  function bossHealthFrac() { return clamp(bossHealth / BOSS_MAX_HEALTH, 0, 1); }
  function speedMult(now) { return now < boss.frozenUntil ? FROZEN_SPEED_MULT : 1; }

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0, isMoving: false,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0, shotgunAmmo: 0,
    };
  }
  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  function makeBoss() {
    return {
      x: 0, y: 0, radius: BOSS_RADIUS, seed: Math.random() * 100,
      lookDir: { x: 0, y: 1 }, defeated: false, frozenUntil: 0, phase2: false,
      intangible: false,

      phase: 'idle', // 'idle' | 'spiral' | 'scream' | 'candycorn' | 'cottoncandy' | 'stunned'
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      lastAttack: null,
      attacksSinceStun: 0,
      stunUntil: 0,
      chunks: [], // bites taken out of it: [{ ang, size }]

      // spiral
      spin: 0,
      spiralNextAt: 0,
      spiralOrbit: 0,
      // scream & chase
      chasing: false,
      trailDist: 0,
    };
  }
  const boss = makeBoss();

  let candies = []; // the spiral's shots: { x, y, vx, vy, rot, spin, kind, c1, c2 }
  let cornPatches = []; // { x, y, fireAt, endAt }
  let gasPatches = []; // { x, y, startAt, endAt }
  let trail = []; // the boss's candy trail: { x, y, kind, c1, c2, rot, born }
  let explosions = [];
  let particles = [];
  let bloodSplatters = [];
  let floatingTexts = [];

  function spawnExplosion(x, y) {
    explosions.push({ x, y, startedAt: performance.now() });
    playExplosion();
  }

  function nearestPlayer(x, y) {
    let best = players[0], bestD = Infinity;
    players.forEach((p) => {
      if (p.caught) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
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
      spawnFloatingText(x, y, 'RADAR'); playItemChime(880);
    } else if (item === 'co2') {
      boss.frozenUntil = now + 3000;
      spawnFloatingText(x, y, 'FROZEN'); playItemChime(1200);
    } else if (item === 'scanner') {
      scannerUntil = now + SCANNER_DURATION_MS;
      spawnFloatingText(x, y, 'SCANNER'); playItemChime(660);
    } else if (item === 'smoke') {
      smokeBombs.push({ x, y, armAt: now + SMOKE_FUSE_MS, exploded: false, endsAt: 0 });
      spawnFloatingText(x, y, 'SMOKE BOMB'); playItemChime(500);
    } else if (item === 'nightvision') {
      nvgUntil = now + NVG_DURATION_MS;
      spawnFloatingText(x, y, 'NIGHT VISION'); playItemChime(1000);
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
      spawnFloatingText(x, y, 'ENERGY'); playItemChime(900);
    }
  }

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let smokeBombs = [];
  let nvgUntil = 0;
  let freezeFinished = false;

  function updateCrates(now) {
    players.forEach((p) => {
      if (p.caught) return;
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
  function updateSmokeBombs(now) {
    smokeBombs.forEach((b) => {
      if (b.exploded || now < b.armAt) return;
      b.exploded = true; b.endsAt = now + SMOKE_DURATION_MS;
      playItemChime(180);
    });
    smokeBombs = smokeBombs.filter((b) => !b.exploded || now < b.endsAt);
  }

  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught) return;
      if (p.shotgunAmmo <= 0) return;
      if (boss.defeated || now < boss.frozenUntil) return;
      // only a real defensive option while it's actually bearing down --
      // the scream-and-chase is this boss's own stalkwalk-equivalent.
      if (boss.phase !== 'scream' || !boss.chasing) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < SHOTGUN_RANGE) {
        boss.frozenUntil = now + SHOTGUN_STUN_MS;
        p.shotgunAmmo--;
        spawnFloatingText(boss.x, boss.y, 'STUNNED!');
        playShotgunBlast();
      }
    });
  }

  function triggerCaught(p, now) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    playChompThud(0.35);
    spawnBloodEffect(p.x, p.y);
    p.caught = true; p.caughtAt = now;
    p.invulnerableUntil = now + 2000 + 1200;
  }
  // Once caught, a player stays down for the rest of the run -- no
  // respawn after a cutscene. Only once EVERY player is caught does the
  // group actually wipe.
  function updateCutscenes(now) {
    if (gameState === 'playing' && players.every((p) => p.caught)) gameState = 'wiped';
  }

  function spawnBloodEffect(x, y) {
    bloodSplatters.push({ x, y, seed: Math.random() * 1000 });
    if (bloodSplatters.length > 24) bloodSplatters.shift();
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0, maxLife: 0.35 + Math.random() * 0.45, size: 2 + Math.random() * 2.5, color: 'blood',
      });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) { particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      const drag = Math.min(1, dt * 4);
      pt.vx *= 1 - drag; pt.vy *= 1 - drag;
    }
  }
  function drawParticles(g) {
    particles.forEach((pt) => {
      const alpha = 1 - pt.life / pt.maxLife;
      g.beginPath();
      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      if (pt.color === 'blood') { g.fillStyle = `rgba(160,15,20,${alpha})`; g.fill(); }
      else { g.globalAlpha = alpha; g.fillStyle = pt.color; g.fill(); g.globalAlpha = 1; }
    });
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

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  function resetLevel() {
    players.forEach((p) => {
      respawnPlayer(p);
      p.caught = false; p.caughtAt = 0; p.invulnerableUntil = 0;
      p.stamina = STAMINA_MAX; p.moveState = 'normal'; p.exhaustedUntil = 0;
      p.sprintActive = false; p.shotgunAmmo = 0;
      p.biteReadyAt = 0; p.gasSince = 0; p.slowUntil = 0;
    });

    const spawn = LEVEL.monsterSpawns[0];
    const m = tileCenter(spawn.x, spawn.y);
    boss.x = m.x; boss.y = m.y;
    boss.frozenUntil = 0; boss.defeated = false; boss.phase2 = false; boss.intangible = false;
    boss.phase = 'idle'; boss.phaseStartedAt = 0;
    boss.nextIdleUntil = performance.now() + BOSS_INTRO_GRACE_MS;
    boss.lastAttack = null;
    boss.attacksSinceStun = 0; boss.stunUntil = 0; boss.chunks = []; boss.chasing = false; boss.trailDist = 0;

    candies = []; cornPatches = []; gasPatches = []; trail = []; explosions = [];
    bossHealth = BOSS_MAX_HEALTH;

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)],
      opened: false, openedAt: 0,
    }));
    radarUntil = 0; energyUntil = 0; scannerUntil = 0; smokeBombs = []; nvgUntil = 0;
    floatingTexts = []; particles = []; bloodSplatters = [];
    resetExploration();
    gameState = 'intro';
    introStartedAt = performance.now();
    deathTarget = null;
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
    freezeFinished = false;
  }
  resetLevel();

  // ======================= biting (the only way to hurt it) =======================
  function playScream() { [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].forEach((d) => playTone(480 + Math.random() * 520, 0.4, 'sawtooth', 0.12, d)); }
  function playStunSound() { [330, 277, 220, 175].forEach((f, i) => playTone(f, 0.24, 'triangle', 0.2, i * 0.12)); }
  function playCandyCrunch() { playTone(900, 0.06, 'square', 0.13); playTone(1500, 0.05, 'square', 0.1, 0.035); playTone(240, 0.12, 'sawtooth', 0.12, 0.02); }

  function spawnCandyBurst(x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, maxLife: 0.45 + Math.random() * 0.6, size: 2.5 + Math.random() * 3.5,
        color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      });
    }
  }

  function updateBites(now) {
    if (boss.phase !== 'stunned' || boss.defeated) return;
    players.forEach((p) => {
      if (p.caught || now < p.biteReadyAt) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BITE_RADIUS) {
        p.biteReadyAt = now + BITE_COOLDOWN_MS;
        const ang = Math.atan2(p.y - boss.y, p.x - boss.x);
        boss.chunks.push({ ang, size: 0.85 + Math.random() * 0.35 });
        spawnCandyBurst(boss.x + Math.cos(ang) * boss.radius, boss.y + Math.sin(ang) * boss.radius, 14, 220);
        playCandyCrunch();
        applyBossDamage(BITE_DAMAGE, now);
      }
    });
  }

  function applyBossDamage(dmg, now) {
    if (boss.defeated) return;
    bossHealth = Math.max(0, bossHealth - dmg);
    spawnFloatingText(boss.x, boss.y - boss.radius - 12, `BITE! -${dmg}`);
    if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) enterPhase2(now);
    if (bossHealth <= 0 && !boss.defeated) triggerDeath(now);
  }

  function enterPhase2(now) {
    boss.phase2 = true;
    gameState = 'phase2intro';
    phase2IntroStartedAt = now;
    if (boss.phase === 'stunned') boss.stunUntil += PHASE2_CUTSCENE_MS + 800; // the cutscene shouldn't eat your bite window
    candies = []; cornPatches = [];
    spawnFloatingText(boss.x, boss.y - boss.radius - 12, 'WITHERED');
  }

  function triggerDeath(now) {
    boss.defeated = true;
    gameState = 'dying';
    deathStartedAt = now;
    candies = []; cornPatches = []; gasPatches = [];
    spawnCandyBurst(boss.x, boss.y, 40, 300);
    spawnExplosion(boss.x, boss.y);
  }

  // ======================= THE ATTACK CYCLE =======================
  const PHASE1_ATTACKS = ['spiral', 'scream', 'candycorn'];
  const PHASE2_ONLY_ATTACKS = ['cottoncandy'];

  function attackPool() {
    return boss.phase2 ? PHASE1_ATTACKS.concat(PHASE2_ONLY_ATTACKS) : PHASE1_ATTACKS;
  }
  function pickAttack() {
    const pool = attackPool().filter((a) => a !== boss.lastAttack);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randomArenaPoint(margin) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (ARENA_R - margin);
    return { x: ARENA_CX + Math.cos(a) * r, y: ARENA_CY + Math.sin(a) * r };
  }
  function clampToArena(x, y, margin) {
    const dx = x - ARENA_CX, dy = y - ARENA_CY, d = Math.hypot(dx, dy), max = ARENA_R - margin;
    if (d <= max) return { x, y };
    return { x: ARENA_CX + (dx / d) * max, y: ARENA_CY + (dy / d) * max };
  }
  function livePlayers() { return players.filter((p) => !p.caught); }

  // n patch positions: a few right on top of players (so they have to move),
  // the rest scattered, none overlapping the ones already picked
  function patchSpots(n, radius, onPlayers) {
    const spots = [];
    const live = livePlayers();
    for (let i = 0; i < n; i++) {
      let best = null;
      for (let tries = 0; tries < 25; tries++) {
        let c;
        if (i < onPlayers && live.length) {
          const p = live[i % live.length];
          const a = Math.random() * Math.PI * 2, r = Math.random() * radius * 1.4;
          c = clampToArena(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, radius);
        } else {
          c = randomArenaPoint(radius);
        }
        best = c;
        if (spots.every((s) => Math.hypot(s.x - c.x, s.y - c.y) > radius * 1.3)) break;
      }
      spots.push(best);
    }
    return spots;
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'spiral') {
      boss.spin = Math.random() * Math.PI * 2;
      boss.spiralNextAt = now;
      boss.spiralOrbit = Math.atan2(boss.y - ARENA_CY, boss.x - ARENA_CX);
    } else if (kind === 'scream') {
      boss.chasing = false;
      playScream();
    } else if (kind === 'candycorn') {
      cornPatches = patchSpots(CORN_COUNT, CORN_RADIUS, 4).map((s) => ({ x: s.x, y: s.y, fireAt: now + CORN_WARN_MS, endAt: now + CORN_WARN_MS + CORN_ACTIVE_MS }));
    } else if (kind === 'cottoncandy') {
      patchSpots(GAS_COUNT, GAS_RADIUS, 2).forEach((s) => gasPatches.push({ x: s.x, y: s.y, startAt: now + GAS_WARN_MS, endAt: now + GAS_WARN_MS + GAS_LIFE_MS }));
    }
  }

  function startStun(now) {
    boss.phase = 'stunned';
    boss.phaseStartedAt = now;
    boss.stunUntil = now + STUN_DURATION_MS;
    boss.attacksSinceStun = 0;
    boss.chasing = false;
    spawnFloatingText(boss.x, boss.y - boss.radius - 14, 'STUNNED -- BITE IT!');
    playStunSound();
  }

  function finishAttack(now) {
    boss.phase = 'idle';
    boss.attacksSinceStun++;
    if (boss.attacksSinceStun >= ATTACKS_PER_STUN) { startStun(now); return; }
    boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
  }

  // The boss moves through here, so everywhere it goes it sheds candy that
  // fades away over TRAIL_LIFE_MS.
  function moveBoss(nx, ny) {
    const c = clampToArena(nx, ny, boss.radius * 0.7);
    const d = Math.hypot(c.x - boss.x, c.y - boss.y);
    boss.x = c.x; boss.y = c.y;
    boss.trailDist += d;
    while (boss.trailDist >= TRAIL_STEP) {
      boss.trailDist -= TRAIL_STEP;
      trail.push({
        x: boss.x + (Math.random() - 0.5) * boss.radius * 1.1, y: boss.y + (Math.random() - 0.5) * boss.radius * 1.1,
        kind: Math.floor(Math.random() * 5),
        c1: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)], c2: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
        rot: Math.random() * Math.PI * 2, born: performance.now(),
      });
    }
    if (trail.length > 450) trail.splice(0, trail.length - 450);
  }
  function moveToward(tx, ty, speed, dt) {
    const dx = tx - boss.x, dy = ty - boss.y, d = Math.hypot(dx, dy);
    if (d < 0.5) return d;
    boss.lookDir = { x: dx / d, y: dy / d };
    const step = Math.min(speed * dt, d);
    moveBoss(boss.x + (dx / d) * step, boss.y + (dy / d) * step);
    return d - step;
  }
  function updateTrail(now) {
    while (trail.length && now - trail[0].born > TRAIL_LIFE_MS) trail.shift();
  }

  function updateBossIdle(now, dt) {
    const live = livePlayers();
    if (live.length) {
      const target = nearestPlayer(boss.x, boss.y);
      if (Math.hypot(target.x - boss.x, target.y - boss.y) > boss.radius) moveToward(target.x, target.y, BOSS_IDLE_SPEED, dt);
    }
    if (now >= boss.nextIdleUntil) startAttack(pickAttack(), now);
  }

  function updateSpiralAttack(now, dt) {
    const elapsed = now - boss.phaseStartedAt;
    boss.spin += dt * SPIRAL_SPIN_RATE;
    boss.spiralOrbit += dt * 0.6;
    boss.lookDir = { x: Math.cos(boss.spin), y: Math.sin(boss.spin) };
    // drifts in and out around the middle of the arena as it spins
    const orbitR = ARENA_R * 0.36 * (0.5 + 0.5 * Math.sin(elapsed * 0.0012 - 1.2));
    moveToward(ARENA_CX + Math.cos(boss.spiralOrbit) * orbitR, ARENA_CY + Math.sin(boss.spiralOrbit) * orbitR, 200, dt);
    let shots = 0;
    while (now >= boss.spiralNextAt && shots < 5) {
      boss.spiralNextAt += SPIRAL_INTERVAL_MS;
      shots++;
      const a = boss.spin + (Math.random() < 0.3 ? (Math.random() - 0.5) * Math.PI * 2 : (Math.random() - 0.5) * 0.8);
      const ca = Math.cos(a), sa = Math.sin(a);
      candies.push({
        x: boss.x + ca * boss.radius * 0.8, y: boss.y + sa * boss.radius * 0.8,
        vx: ca * CANDY_SPEED, vy: sa * CANDY_SPEED,
        rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 9,
        kind: Math.floor(Math.random() * 5),
        c1: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)], c2: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      });
    }
    if (elapsed >= SPIRAL_MS) finishAttack(now);
  }

  function updateScreamAttack(now, dt) {
    const elapsed = now - boss.phaseStartedAt;
    const live = livePlayers();
    if (elapsed < SCREAM_MS) {
      if (live.length) {
        const t = nearestPlayer(boss.x, boss.y);
        const d = Math.hypot(t.x - boss.x, t.y - boss.y) || 1;
        boss.lookDir = { x: (t.x - boss.x) / d, y: (t.y - boss.y) / d };
      }
      return;
    }
    boss.chasing = true;
    if (live.length) {
      const t = nearestPlayer(boss.x, boss.y);
      moveToward(t.x, t.y, CHASE_SPEED, dt);
    }
    if (elapsed >= SCREAM_MS + CHASE_MS) { boss.chasing = false; finishAttack(now); }
  }

  function updateCandyCornAttack(now) {
    if (now - boss.phaseStartedAt >= CORN_WARN_MS + CORN_ACTIVE_MS + 500) finishAttack(now);
  }
  function updateCottonCandyAttack(now) {
    if (now - boss.phaseStartedAt >= GAS_WARN_MS + 700) finishAttack(now);
  }
  function updateStunned(now) {
    if (now < boss.stunUntil) return;
    boss.phase = 'idle';
    boss.nextIdleUntil = now + 700;
    spawnFloatingText(boss.x, boss.y - boss.radius - 14, 'IT RECOVERS!');
  }

  function updateBoss(now, dt) {
    if (boss.defeated) return;
    updateTrail(now);
    if (now < boss.frozenUntil) return;
    switch (boss.phase) {
      case 'idle': updateBossIdle(now, dt); break;
      case 'spiral': updateSpiralAttack(now, dt); break;
      case 'scream': updateScreamAttack(now, dt); break;
      case 'candycorn': updateCandyCornAttack(now); break;
      case 'cottoncandy': updateCottonCandyAttack(now); break;
      case 'stunned': updateStunned(now); break;
      default: boss.phase = 'idle';
    }
  }

  // ---- the hazards the attacks leave on the floor ----
  function updateCandies(now, dt) {
    for (let i = candies.length - 1; i >= 0; i--) {
      const s = candies[i];
      const px = s.x, py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt;
      if (Math.hypot(s.x - ARENA_CX, s.y - ARENA_CY) > ARENA_R + 30) { candies.splice(i, 1); continue; }
      let hit = false;
      players.forEach((p) => {
        if (hit || p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        // swept test along this frame's travel -- at 5x speed a plain point
        // check would tunnel straight through a player at low fps
        const sx = s.x - px, sy = s.y - py;
        const len2 = sx * sx + sy * sy || 1;
        const t = clamp(((p.x - px) * sx + (p.y - py) * sy) / len2, 0, 1);
        if (Math.hypot(p.x - (px + sx * t), p.y - (py + sy * t)) < CANDY_HIT_RADIUS) { triggerCaught(p, now); hit = true; }
      });
      if (hit) { spawnCandyBurst(s.x, s.y, 6, 120); candies.splice(i, 1); }
    }
  }

  function updateCornPatches(now) {
    for (let i = cornPatches.length - 1; i >= 0; i--) {
      const c = cornPatches[i];
      if (now > c.endAt + 250) { cornPatches.splice(i, 1); continue; }
      if (now < c.fireAt || now > c.endAt) continue;
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - c.x, p.y - c.y) < CORN_RADIUS) triggerCaught(p, now);
      });
    }
  }

  function updateGas(now) {
    for (let i = gasPatches.length - 1; i >= 0; i--) if (now > gasPatches[i].endAt) gasPatches.splice(i, 1);
    players.forEach((p) => {
      let inside = false;
      if (!p.caught) {
        for (const g of gasPatches) {
          if (now >= g.startAt && Math.hypot(p.x - g.x, p.y - g.y) < GAS_RADIUS) { inside = true; break; }
        }
      }
      if (inside) {
        if (!p.gasSince) p.gasSince = now;
        else if (now - p.gasSince >= GAS_KILL_MS && now >= p.invulnerableUntil) { p.gasSince = 0; triggerCaught(p, now); }
      } else if (p.gasSince) {
        p.gasSince = 0;
        if (!p.caught) {
          p.slowUntil = now + GAS_SLOW_MS;
          spawnFloatingText(p.x, p.y - 8, 'SLOWED');
        }
      }
    });
  }

  // Touching the boss is deadly -- except while it's stunned, when touching it
  // is how you bite it.
  function updateCatch(now) {
    if (boss.defeated || boss.phase === 'stunned') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (now < p.invulnerableUntil) return;
      if (isHidden(p, now)) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BOSS_CATCH_RADIUS) triggerCaught(p, now);
    });
  }

  // ======================= cutscenes =======================
  function updateIntroCutscene(now) {
    if (now - introStartedAt < BOSS_INTRO_CUTSCENE_MS) return;
    gameState = 'playing';
    runStartTime = now;
    elapsedMs = 0;
    boss.nextIdleUntil = now + BOSS_INTRO_GRACE_MS;
  }
  function updatePhase2Cutscene(now) {
    if (now - phase2IntroStartedAt < PHASE2_CUTSCENE_MS) return;
    gameState = 'playing';
    boss.nextIdleUntil = now + 800;
  }

  function updateDeathSequence(now) {
    const t = now - deathStartedAt;
    // the boss crumbles into a shower of candy
    if (t < DEATH_FALL_MS + DEATH_DRAG_MS && Math.random() < 0.35) {
      spawnCandyBurst(boss.x + (Math.random() - 0.5) * boss.radius * 1.6, boss.y + (Math.random() - 0.5) * boss.radius * 1.6, 5, 160);
    }
    if (t < DEATH_FALL_MS + DEATH_DRAG_MS) return;
    if (freezeFinished) return;
    freezeFinished = true;
    if (!bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
    }
    playWinJingle();
    if (window.GoofyStory) window.GoofyStory.completeHalloween(5);
    setTimeout(() => { window.location.href = 'index.html'; }, 2200);
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }
  function minimapColorFor(ch) {
    if (ch === '#') return '#8a5a34';
    return '#3a3a3e';
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
    if (!boss.defeated) {
      const bx = mx + (boss.x / WORLD_W) * MINIMAP_W;
      const by = my + (boss.y / WORLD_H) * mh;
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = boss.phase2 ? '#ff3d6a' : '#ff8ac0';
      ctx.shadowColor = ctx.fillStyle;
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

  // ======================= rendering =======================
  function hash2(x, y, k) {
    let h = Math.imul(x + 1013 * k, 374761393) ^ Math.imul(y + 7 * k, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const CANDY_COLORS = ['#ff4f9a', '#ffe14a', '#6df0ff', '#8aff5a', '#c07aff', '#ff8a2a', '#ff5252', '#ffffff'];
  // One piece of candy: a wrapped sweet, a lollipop, a gumdrop, a candy corn
  // or a hard candy, in a hash-picked color.
  function drawCandyPiece(g, x, y, kind, c1, c2, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    if (kind === 0) {            // wrapped sweet: body + twisted ends
      g.fillStyle = c1;
      g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c2;
      g.beginPath();
      g.moveTo(5, 0); g.lineTo(9, -3); g.lineTo(9, 3); g.closePath();
      g.moveTo(-5, 0); g.lineTo(-9, -3); g.lineTo(-9, 3); g.closePath();
      g.fill();
    } else if (kind === 1) {     // lollipop
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke();
      g.fillStyle = c1;
      g.beginPath(); g.arc(0, -1, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, -1, 2.6, 0, Math.PI * 1.6); g.stroke();
    } else if (kind === 2) {     // gumdrop
      g.fillStyle = c1;
      g.beginPath(); g.arc(0, 1, 4, Math.PI, 0); g.lineTo(4, 3); g.lineTo(-4, 3); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(-1.4, -0.6, 1.1, 0, Math.PI * 2); g.fill();
    } else if (kind === 3) {     // candy corn
      g.fillStyle = '#ffd23a';
      g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.fillStyle = '#ff8a1e';
      g.beginPath(); g.moveTo(-1.6, -1); g.lineTo(1.6, -1); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.fillStyle = '#fff6e0';
      g.beginPath(); g.moveTo(-0.8, -3); g.lineTo(0.8, -3); g.lineTo(0, -5); g.closePath(); g.fill();
    } else {                     // hard candy
      g.fillStyle = c1;
      g.beginPath(); g.arc(0, 0, 3.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(-1.2, -1.2, 1.1, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }



  // A carved jack-o-lantern: ribbed orange pumpkin, green stem, glowing
  // triangle eyes and a jagged grin.
  function drawJackOLantern(g, cx, cy, r, now, seed) {
    const flick = 0.85 + 0.15 * Math.sin(now * 0.012 + seed);
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, r * 4.2);
    halo.addColorStop(0, `rgba(255,170,50,${0.38 * flick})`);
    halo.addColorStop(1, 'rgba(255,140,20,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, r * 4.2, 0, Math.PI * 2); g.fill();

    g.fillStyle = '#5a2208';
    g.beginPath(); g.ellipse(cx, cy + r * 0.15, r * 1.12, r * 0.95, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 1, cx, cy, r * 1.15);
    body.addColorStop(0, '#ffb24a');
    body.addColorStop(0.6, '#ee7a14');
    body.addColorStop(1, '#a8420a');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(cx, cy, r * 1.1, r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(110,40,5,0.55)';
    g.lineWidth = 1;
    [-0.55, 0, 0.55].forEach((k) => {
      g.beginPath();
      g.ellipse(cx, cy, r * 1.1 * Math.abs(1 - Math.abs(k) * 0.7), r * 0.92, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    g.fillStyle = '#3d6a1c';
    g.fillRect(cx - r * 0.12, cy - r * 1.05, r * 0.26, r * 0.35);

    // carved face, lit from inside
    g.fillStyle = `rgba(255,222,110,${0.95 * flick})`;
    g.beginPath();
    g.moveTo(cx - r * 0.6, cy - r * 0.05); g.lineTo(cx - r * 0.2, cy - r * 0.05); g.lineTo(cx - r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx + r * 0.6, cy - r * 0.05); g.lineTo(cx + r * 0.2, cy - r * 0.05); g.lineTo(cx + r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx - r * 0.65, cy + r * 0.2);
    [[-0.45, 0.5], [-0.25, 0.3], [-0.05, 0.52], [0.15, 0.3], [0.35, 0.5], [0.65, 0.2]].forEach(([dx, dy]) => g.lineTo(cx + r * dx, cy + r * dy));
    g.lineTo(cx + r * 0.4, cy + r * 0.12); g.lineTo(cx - r * 0.4, cy + r * 0.12); g.closePath();
    g.fill();
  }



  // The whole arena painted once: a brick wall filling the square, and a round
  // floor of glossy candy tiles (with sprinkles and peppermint disks) cut into it.
  let floorCanvas = null;
  function buildFloor() {
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = WORLD_H;
    const f = c.getContext('2d');
    f.fillStyle = '#2a1713';
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    // brick, laid in a running bond
    const BH = 14, BW = 30;
    const brickCols = ['#7a3a2a', '#8a4430', '#6e3426', '#93503a', '#7f3e2c'];
    for (let row = 0; row * BH < WORLD_H; row++) {
      const off = (row % 2) * (BW / 2);
      for (let col = -1; col * BW < WORLD_W + BW; col++) {
        const x = col * BW + off, y = row * BH;
        f.fillStyle = brickCols[Math.floor(hash2(col, row, 1) * brickCols.length)];
        f.fillRect(x + 1, y + 1, BW - 2, BH - 2);
        f.fillStyle = 'rgba(255,200,160,0.12)'; f.fillRect(x + 1, y + 1, BW - 2, 2);
        f.fillStyle = 'rgba(0,0,0,0.25)'; f.fillRect(x + 1, y + BH - 3, BW - 2, 2);
      }
    }
    const vg = f.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R, ARENA_CX, ARENA_CY, ARENA_R + 150);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    f.fillStyle = vg; f.fillRect(0, 0, WORLD_W, WORLD_H);

    // the candy floor, clipped to a circle
    f.save();
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R, 0, Math.PI * 2); f.clip();
    const pastel = ['#ff9ec7', '#a8f0d0', '#ffe9a0', '#d6b8ff', '#ffc08a', '#9fd8ff'];
    const sprinkle = ['#ff3d7f', '#2fb5ff', '#ffe14a', '#4cd47a', '#ffffff', '#ff8a2a'];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE, py = y * TILE;
        f.fillStyle = pastel[Math.floor(hash2(x, y, 2) * pastel.length)];
        f.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        const gr = f.createLinearGradient(px, py, px + TILE, py + TILE);
        gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)');
        f.fillStyle = gr; f.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        if (hash2(x, y, 9) < 0.14) {          // a peppermint disk
          const cx = px + TILE / 2, cy = py + TILE / 2;
          f.fillStyle = '#ffffff'; f.beginPath(); f.arc(cx, cy, 12, 0, Math.PI * 2); f.fill();
          f.fillStyle = '#e8365d';
          for (let i = 0; i < 6; i++) { const a0 = (i / 6) * Math.PI * 2 + hash2(x, y, 10); f.beginPath(); f.moveTo(cx, cy); f.arc(cx, cy, 12, a0, a0 + Math.PI / 6); f.closePath(); f.fill(); }
          f.strokeStyle = 'rgba(0,0,0,0.2)'; f.lineWidth = 1; f.beginPath(); f.arc(cx, cy, 12, 0, Math.PI * 2); f.stroke();
        }
        for (let k = 0; k < 3; k++) {         // sprinkles
          f.save();
          f.translate(px + 4 + hash2(x, y, 20 + k) * (TILE - 8), py + 4 + hash2(y, x, 30 + k) * (TILE - 8));
          f.rotate(hash2(x, y, 40 + k) * Math.PI);
          f.fillStyle = sprinkle[Math.floor(hash2(x, y, 50 + k) * sprinkle.length)];
          f.fillRect(-3, -1, 6, 2.2);
          f.restore();
        }
      }
    }
    // dim it down: the candy is deep in the dark, lit mostly by the jack-o-lanterns
    f.fillStyle = 'rgba(14,6,30,0.56)';
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    const fv = f.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R * 0.55, ARENA_CX, ARENA_CY, ARENA_R);
    fv.addColorStop(0, 'rgba(0,0,0,0)'); fv.addColorStop(1, 'rgba(0,0,0,0.38)');
    f.fillStyle = fv;
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    f.restore();
    // the lip of the wall round the floor
    f.lineWidth = 9; f.strokeStyle = 'rgba(28,10,8,0.9)';
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R + 4.5, 0, Math.PI * 2); f.stroke();
    f.lineWidth = 3; f.strokeStyle = 'rgba(255,214,176,0.55)';
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R - 1, 0, Math.PI * 2); f.stroke();
    return c;
  }

  function drawTiles(g, now) {
    if (!floorCanvas) floorCanvas = buildFloor();
    g.drawImage(floorCanvas, 0, 0);
    // each jack-o-lantern lights the candy round it
    g.save();
    g.globalCompositeOperation = 'lighter';
    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      const f = 0.85 + 0.15 * Math.sin(now * 0.011 + i * 1.7);
      const gr = g.createRadialGradient(c.x, c.y, 4, c.x, c.y, TILE * 5);
      gr.addColorStop(0, `rgba(255,150,50,${0.34 * f})`); gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, TILE * 5, 0, Math.PI * 2); g.fill();
    });
    g.restore();
    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      drawJackOLantern(g, c.x, c.y, 15, now, i * 1.7);
    });
  }

  // the candy the boss has left behind: it fades out as it ages
  function drawTrail(g, now) {
    trail.forEach((t) => {
      const age = clamp((now - t.born) / TRAIL_LIFE_MS, 0, 1);
      g.save();
      g.globalAlpha = (1 - age) * (1 - age) * 0.9 + 0.05 * (1 - age);
      g.translate(t.x, t.y);
      g.scale(1.5, 1.5);
      drawCandyPiece(g, 0, 0, t.kind, t.c1, t.c2, t.rot);
      g.restore();
    });
  }

  // the spiral's candy: twice the size of an ordinary piece
  function drawCandies(g) {
    candies.forEach((s) => {
      g.save();
      g.translate(s.x, s.y);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.arc(0, 0, CANDY_RADIUS * 1.15, 0, Math.PI * 2); g.fill();
      g.scale(2, 2);
      drawCandyPiece(g, 0, 0, s.kind, s.c1, s.c2, s.rot);
      g.restore();
    });
  }

  function drawCornSpike(g, x, y, w, h) {
    g.save();
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.clip();
    g.fillStyle = '#ffd23a'; g.fillRect(x - w, y - h * 0.4, w * 2, h * 0.4 + 2);
    g.fillStyle = '#ff8a1e'; g.fillRect(x - w, y - h * 0.75, w * 2, h * 0.35);
    g.fillStyle = '#fff6e0'; g.fillRect(x - w, y - h - 1, w * 2, h * 0.26);
    g.restore();
    g.strokeStyle = 'rgba(110,60,10,0.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.stroke();
  }

  // Candy corn patches: a red circle flashes for a second, then the candy corn
  // shoots up out of the floor.
  function drawCornPatches(g, now) {
    cornPatches.forEach((c) => {
      if (now < c.fireAt) {
        const on = Math.floor((now - (c.fireAt - CORN_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(c.x, c.y, CORN_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,40,40,0.4)' : 'rgba(255,40,40,0.1)'; g.fill();
        g.strokeStyle = on ? '#ff3030' : 'rgba(255,70,70,0.45)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const t = clamp((now - c.fireAt) / CORN_ACTIVE_MS, 0, 1);
      const rise = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      g.beginPath(); g.arc(c.x, c.y, CORN_RADIUS, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,60,40,0.22)'; g.fill();
      const spikes = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3, rad = i === 8 ? 0 : CORN_RADIUS * 0.58;
        spikes.push({ x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad, h: (i === 8 ? 40 : 28 + (i % 3) * 4) * rise });
      }
      spikes.sort((a, b) => a.y - b.y);
      spikes.forEach((s) => drawCornSpike(g, s.x, s.y + 6, 15, s.h));
    });
  }

  // Cotton candy clouds: a flashing circle first, then a swirling pink-and-blue cloud.
  function drawGasPatches(g, now) {
    gasPatches.forEach((gp) => {
      if (now < gp.startAt) {
        const on = Math.floor((now - (gp.startAt - GAS_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(gp.x, gp.y, GAS_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,60,120,0.32)' : 'rgba(255,60,120,0.08)'; g.fill();
        g.strokeStyle = on ? '#ff3a7a' : 'rgba(255,90,140,0.4)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const life = clamp((gp.endAt - now) / 1000, 0, 1);
      const grow = clamp((now - gp.startAt) / 500, 0, 1);
      const cols = ['255,179,221', '179,224,255', '255,255,255', '255,210,235'];
      g.save();
      g.beginPath(); g.arc(gp.x, gp.y, GAS_RADIUS * grow, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,105,180,${0.3 * life})`; g.fill();   // a pink base so it stands out on the pale candy floor
      for (let i = 0; i < 20; i++) {
        const a = i * 2.4 + now * 0.0004 * (i % 2 ? 1 : -1);
        const rad = GAS_RADIUS * 0.66 * Math.sqrt((i + 1) / 20) * grow;
        const px = gp.x + Math.cos(a) * rad, py = gp.y + Math.sin(a) * rad;
        const size = GAS_RADIUS * 0.36;
        const col = cols[i % cols.length];
        const gr = g.createRadialGradient(px, py, 1, px, py, size);
        gr.addColorStop(0, `rgba(${col},${0.85 * life})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, size, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = `rgba(255,50,140,${0.85 * life})`; g.lineWidth = 3; g.setLineDash([8, 8]);
      g.beginPath(); g.arc(gp.x, gp.y, GAS_RADIUS, 0, Math.PI * 2); g.stroke();
      g.restore();
    });
  }

  // a ring filling up round a player who's standing in cotton candy
  function drawGasDanger(g, now) {
    players.forEach((p) => {
      if (p.caught || !p.gasSince) return;
      const f = clamp((now - p.gasSince) / GAS_KILL_MS, 0, 1);
      g.strokeStyle = `rgba(255,${Math.round(220 - 200 * f)},${Math.round(150 - 130 * f)},0.95)`;
      g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.stroke();
    });
  }

  function drawCrates(g) {
    crates.forEach((c) => {
      const center = tileCenter(c.x, c.y);
      g.save();
      g.translate(center.x, center.y);
      if (c.opened) {
        g.fillStyle = '#4a3826'; g.fillRect(-9, -6, 18, 12);
        g.strokeStyle = '#2a1e14'; g.lineWidth = 1.5; g.strokeRect(-9, -6, 18, 12);
      } else {
        g.fillStyle = '#7a5a34'; g.fillRect(-10, -10, 20, 20);
        g.strokeStyle = '#4a3520'; g.lineWidth = 2; g.strokeRect(-10, -10, 20, 20);
        g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.moveTo(0, -10); g.lineTo(0, 10); g.stroke();
      }
      g.restore();
    });
  }
  function drawSmokeBombs(g, now) {
    smokeBombs.forEach((b) => {
      if (!b.exploded) {
        const t = clamp(1 - (b.armAt - now) / SMOKE_FUSE_MS, 0, 1);
        g.beginPath(); g.arc(b.x, b.y, 5 + t * 4, 0, Math.PI * 2);
        g.fillStyle = 'rgba(200,200,200,0.6)'; g.fill();
        return;
      }
      const life = clamp((b.endsAt - now) / SMOKE_DURATION_MS, 0, 1);
      const elapsed = SMOKE_DURATION_MS - (b.endsAt - now);
      const radius = SMOKE_RADIUS * Math.min(1, Math.max(0, elapsed) / 800);
      g.beginPath(); g.arc(b.x, b.y, radius, 0, Math.PI * 2);
      g.fillStyle = `rgba(210,210,220,${0.32 * life})`; g.fill();
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

  function drawExplosions(g, now) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      const t = (now - e.startedAt) / 400;
      if (t >= 1) { explosions.splice(i, 1); continue; }
      g.beginPath();
      g.arc(e.x, e.y, 10 + t * 40, 0, Math.PI * 2);
      g.strokeStyle = `rgba(255,150,40,${1 - t})`;
      g.lineWidth = 4;
      g.stroke();
      g.beginPath();
      g.arc(e.x, e.y, (10 + t * 40) * 0.6, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,200,80,${(1 - t) * 0.4})`;
      g.fill();
    }
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

  // ---- the Candy Kraken ----
  const bossScratch = document.createElement('canvas');
  bossScratch.width = 320; bossScratch.height = 320;
  const bossG = bossScratch.getContext('2d');

  // Everything the boss is made of, drawn on a scratch canvas centered on the
  // origin: candy-rope tentacles, a peppermint-swirl body studded with
  // gumdrops, candy-corn teeth and gumball eyes. Withered, its colors go stale,
  // tentacles snap, and a hole in its front shows its candy-cane ribcage.
  function drawKrakenParts(s, now, withered, stunned, screaming) {
    const r = boss.radius;
    const look = boss.lookDir || { x: 0, y: 1 };
    const ang = Math.atan2(look.y, look.x);

    const ropes = withered ? ['#b79aa6', '#cfc5ca', '#a38c9a', '#8f9c93'] : ['#e8365d', '#ffffff', '#ff9ec7', '#4fd0a0', '#ffd23a', '#b48cff'];
    const tentCount = 8;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + Math.sin(now * 0.0017 + i) * 0.2;
      let len = r * (2.1 + 0.4 * Math.sin(now * 0.004 + i * 1.7 + boss.seed));
      if (withered) len *= (i % 3 === 0 ? 0.45 : 0.8);
      if (stunned) len *= 0.85;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = (stunned ? 0.2 : 1) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.5;
      const mx = tx / 2 - Math.sin(a) * bow, my = ty / 2 + Math.cos(a) * bow;
      const col = ropes[i % ropes.length];
      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.52, col);
      if (!withered) {      // the twist in the candy rope
        s.strokeStyle = col === '#ffffff' ? '#e8365d' : '#ffffff'; s.lineWidth = 2.4;
        const nx = -Math.sin(a), ny = Math.cos(a);
        [0.28, 0.5, 0.72].forEach((t) => {
          const px = 2 * (1 - t) * t * mx + t * t * tx, py = 2 * (1 - t) * t * my + t * t * ty;
          s.beginPath(); s.moveTo(px - nx * 4, py - ny * 4); s.lineTo(px + nx * 4, py + ny * 4); s.stroke();
        });
      }
    }

    s.save();
    if (stunned) s.scale(1.08, 0.92);
    // body
    const stops = withered ? ['#dcc8d0', '#b89aa8', '#8a7482'] : ['#ffc2dd', '#ff7eb0', '#c93a76'];
    const grad = s.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 1.1);
    grad.addColorStop(0, stops[0]); grad.addColorStop(0.6, stops[1]); grad.addColorStop(1, stops[2]);
    s.fillStyle = grad; s.beginPath(); s.arc(0, 0, r, 0, Math.PI * 2); s.fill();
    // peppermint swirl
    s.fillStyle = withered ? 'rgba(150,100,120,0.5)' : 'rgba(255,255,255,0.78)';
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + now * 0.0006;
      s.beginPath(); s.moveTo(0, 0); s.arc(0, 0, r * 0.98, a0, a0 + Math.PI / 8); s.closePath(); s.fill();
    }
    // gumdrops round the rim
    for (let i = 0; i < 10; i++) {
      if (withered && i % 2) continue;
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const px = Math.cos(a) * r * 0.96, py = Math.sin(a) * r * 0.96;
      s.fillStyle = withered ? '#a89aa6' : CANDY_COLORS[i % CANDY_COLORS.length];
      s.beginPath(); s.arc(px, py, r * 0.17, 0, Math.PI * 2); s.fill();
      s.fillStyle = 'rgba(255,255,255,0.5)'; s.beginPath(); s.arc(px - r * 0.05, py - r * 0.05, r * 0.05, 0, Math.PI * 2); s.fill();
    }
    if (!withered) {
      s.fillStyle = 'rgba(255,255,255,0.4)';
      s.beginPath(); s.ellipse(-r * 0.3, -r * 0.4, r * 0.34, r * 0.18, -0.6, 0, Math.PI * 2); s.fill();
    }

    s.save();
    s.rotate(ang); // from here +x is the way it's facing
    if (withered) {          // a hole in its front, and the ribcage inside
      s.globalCompositeOperation = 'destination-out';
      s.beginPath(); s.ellipse(-r * 0.15, 0, r * 0.62, r * 0.74, 0, 0, Math.PI * 2); s.fill();
      s.globalCompositeOperation = 'source-over';
      s.fillStyle = '#2a0e18';
      s.beginPath(); s.ellipse(-r * 0.15, 0, r * 0.58, r * 0.7, 0, 0, Math.PI * 2); s.fill();
      s.strokeStyle = '#efe6dc'; s.lineWidth = r * 0.08; s.lineCap = 'round';
      s.beginPath(); s.moveTo(-r * 0.62, 0); s.lineTo(r * 0.3, 0); s.stroke();
      for (let k = -2; k <= 2; k++) {
        const x = -r * 0.15 + k * r * 0.2;
        [-1, 1].forEach((sd) => {
          s.strokeStyle = '#efe6dc'; s.lineWidth = r * 0.075; s.setLineDash([]);
          s.beginPath(); s.moveTo(x, 0); s.quadraticCurveTo(x + r * 0.06, sd * r * 0.4, x - r * 0.1, sd * r * 0.62); s.stroke();
          s.strokeStyle = '#e8365d'; s.lineWidth = r * 0.075; s.setLineDash([3, 5]);
          s.beginPath(); s.moveTo(x, 0); s.quadraticCurveTo(x + r * 0.06, sd * r * 0.4, x - r * 0.1, sd * r * 0.62); s.stroke();
          s.setLineDash([]);
        });
      }
    }
    // the mouth: candy-corn teeth round a dark hollow (wide open mid-scream)
    const open = screaming ? 1.35 : stunned ? 0.5 : 0.7;
    s.fillStyle = '#3a0a18';
    s.beginPath(); s.ellipse(r * 0.7, 0, r * 0.22 * open, r * 0.34 * open, 0, 0, Math.PI * 2); s.fill();
    for (let i = 0; i < 7; i++) {
      const t = (i / 6 - 0.5) * 2.2;
      const bx = r * 0.7 + Math.cos(t) * r * 0.3 * open * 0.7, by = Math.sin(t) * r * 0.4 * open;
      const tipx = r * 0.7 + Math.cos(t) * r * 0.1, tipy = Math.sin(t) * r * 0.16;
      s.fillStyle = i % 3 === 0 ? '#fff6e0' : i % 3 === 1 ? '#ffd23a' : '#ff8a1e';
      s.beginPath(); s.moveTo(bx - 2.5, by - 2); s.lineTo(tipx, tipy); s.lineTo(bx + 2.5, by + 2); s.closePath(); s.fill();
    }
    // gumball eyes
    [-1, 1].forEach((side) => {
      const ex = r * 0.34, ey = side * r * 0.36;
      if (withered && side === -1) {            // an empty socket
        s.fillStyle = '#2a0e18'; s.beginPath(); s.arc(ex, ey, r * 0.2, 0, Math.PI * 2); s.fill();
        return;
      }
      s.fillStyle = withered ? '#e8e0dc' : '#ffffff';
      s.beginPath(); s.arc(ex, ey, r * 0.22, 0, Math.PI * 2); s.fill();
      s.strokeStyle = 'rgba(0,0,0,0.3)'; s.lineWidth = 1; s.stroke();
      if (stunned) {                              // dizzy swirl instead of a pupil
        s.strokeStyle = '#1a0a10'; s.lineWidth = 2;
        s.beginPath(); for (let a = 0; a < 9; a += 0.4) { const rr = a * r * 0.017; const px = ex + Math.cos(a + now * 0.01) * rr, py = ey + Math.sin(a + now * 0.01) * rr; if (a === 0) s.moveTo(px, py); else s.lineTo(px, py); } s.stroke();
      } else {
        s.fillStyle = screaming ? '#c01030' : '#1a0a10';
        s.beginPath(); s.arc(ex + r * 0.07, ey, r * 0.11, 0, Math.PI * 2); s.fill();
        s.fillStyle = '#ffffff'; s.beginPath(); s.arc(ex + r * 0.1, ey - r * 0.04, r * 0.035, 0, Math.PI * 2); s.fill();
      }
    });
    s.restore();
    s.restore();
  }

  function drawBoss(g, now) {
    const dying = gameState === 'dying';
    const dp = dying ? clamp((now - deathStartedAt) / (DEATH_FALL_MS + DEATH_DRAG_MS), 0, 1) : 0;
    const stunned = boss.phase === 'stunned' && !dying;
    const screaming = boss.phase === 'scream' && !boss.chasing && !dying;
    const s = bossG;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.clearRect(0, 0, 320, 320);
    s.translate(160, 160);
    drawKrakenParts(s, now, boss.phase2, stunned, screaming);
    // the bites that have been taken out of it
    s.globalCompositeOperation = 'destination-out';
    boss.chunks.forEach((c) => {
      s.beginPath();
      s.arc(Math.cos(c.ang) * boss.radius * 0.94, Math.sin(c.ang) * boss.radius * 0.94, boss.radius * 0.34 * c.size, 0, Math.PI * 2);
      s.fill();
    });
    s.globalCompositeOperation = 'source-over';

    g.save();
    g.translate(boss.x, boss.y);
    if (screaming) g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    if (dying) { g.globalAlpha = 1 - dp; g.scale(1 - dp * 0.5, 1 - dp * 0.5); g.rotate(dp * 0.8); }
    else if (now < boss.frozenUntil) g.globalAlpha = 0.85;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.ellipse(4, 8, boss.radius * 1.05, boss.radius * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(bossScratch, -160, -160);
    if (now < boss.frozenUntil) {
      g.fillStyle = 'rgba(140,220,255,0.35)'; g.beginPath(); g.arc(0, 0, boss.radius * 1.2, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    if (stunned) {
      // dizzy stars, and a bar counting down the bite window
      for (let i = 0; i < 4; i++) {
        const a = now * 0.005 + (i / 4) * Math.PI * 2;
        const sx = boss.x + Math.cos(a) * boss.radius * 0.9, sy = boss.y - boss.radius * 1.15 + Math.sin(a) * 6;
        g.fillStyle = '#ffe14a'; g.beginPath();
        for (let k = 0; k < 10; k++) { const rr = k % 2 ? 3 : 7, aa = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
        g.closePath(); g.fill();
      }
      const frac = clamp((boss.stunUntil - now) / STUN_DURATION_MS, 0, 1);
      const bw = 70, bx = boss.x - bw / 2, by = boss.y + boss.radius * 1.5;
      g.fillStyle = 'rgba(10,6,10,0.7)'; g.fillRect(bx - 2, by - 2, bw + 4, 9);
      g.fillStyle = '#ffe14a'; g.fillRect(bx, by, bw * frac, 5);
      g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('BITE IT!', boss.x, by + 22);
    }
  }

  // rings of sound spreading from the boss while it screams
  function drawScreamRings(g, now) {
    if (boss.phase !== 'scream' || boss.chasing || boss.defeated) return;
    const t = clamp((now - boss.phaseStartedAt) / SCREAM_MS, 0, 1);
    for (let i = 0; i < 3; i++) {
      const tt = (t * 1.4 + i * 0.28) % 1;
      g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - tt)})`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(boss.x, boss.y, boss.radius + tt * 150, 0, Math.PI * 2); g.stroke();
    }
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
  function drawHeldShotgun(g, R, p) {
    g.save();
    const grip = Math.sin(p.walkPhase) * R * 0.05;
    g.translate(R * 0.15, R * 0.25 + grip);
    g.rotate(-0.12);
    g.strokeStyle = '#5a4428'; g.lineWidth = R * 0.22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-R * 0.35, 0); g.lineTo(R * 0.25, 0); g.stroke();
    g.strokeStyle = '#3a3d42'; g.lineWidth = R * 0.15;
    g.beginPath(); g.moveTo(R * 0.15, 0); g.lineTo(R * 1.55, 0); g.stroke();
    if (p.shotgunAmmo > 0) {
      g.beginPath(); g.arc(R * 1.55, 0, R * 0.12, 0, Math.PI * 2);
      g.fillStyle = '#ff6a2a'; g.shadowColor = '#ff6a2a'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0;
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
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
      g.rotate(Math.atan2(p.facing.y, p.facing.x));
      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(p.color, -0.45);
      const bootColor = '#2b2b28';
      drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      g.save();
      g.translate(0, -bob);
      const bodyGrad = g.createRadialGradient(-R * 0.32, -R * 0.4, 1, 0, 0, R * 1.1);
      bodyGrad.addColorStop(0, shade(p.color, 0.25));
      bodyGrad.addColorStop(0.6, p.color);
      bodyGrad.addColorStop(1, shade(p.color, -0.35));
      g.beginPath(); g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
      g.fillStyle = bodyGrad; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5; g.stroke();
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
      g.beginPath(); g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
      g.strokeStyle = '#1c1c18'; g.lineWidth = 2.5; g.stroke();
      const helmetGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.35, 1, 0, 0, headR * 1.05);
      helmetGrad.addColorStop(0, '#ffffff');
      helmetGrad.addColorStop(0.35, 'rgba(224,226,216,0.95)');
      helmetGrad.addColorStop(1, 'rgba(150,155,146,0.92)');
      g.beginPath(); g.arc(0, 0, headR, 0, Math.PI * 2); g.fillStyle = helmetGrad; g.fill();
      g.strokeStyle = '#1c1c18'; g.lineWidth = 1.5; g.stroke();
      const visorGrad = g.createLinearGradient(0, -headR * 0.3, 0, headR * 0.3);
      visorGrad.addColorStop(0, '#1c2a33'); visorGrad.addColorStop(1, '#03060a');
      g.beginPath(); g.ellipse(headR * 0.32, 0, headR * 0.34, headR * 0.62, 0, 0, Math.PI * 2);
      g.fillStyle = visorGrad; g.fill();
      g.restore();
      g.restore();
    });
  }

  function drawBossIntroOverlay(vx, now) {
    const t = clamp((now - introStartedAt) / BOSS_INTRO_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 34, VIEW_W, 68);
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,138,192,${alpha})`;
    ctx.shadowColor = 'rgba(255,138,192,0.8)';
    ctx.shadowBlur = 10 * alpha;
    ctx.fillText(BOSS_NAME, vx + VIEW_W / 2, VIEW_H / 2 + 8);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  function hexToRgbTriplet(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  function drawPhase2IntroOverlay(vx, now) {
    const t = clamp((now - phase2IntroStartedAt) / PHASE2_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    const rgb = hexToRgbTriplet(PHASE2_NAME_COLOR);
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 42, VIEW_W, 84);
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = `rgba(${rgb},${alpha})`;
    ctx.shadowColor = `rgba(${rgb},0.8)`;
    ctx.shadowBlur = 10 * alpha;
    ctx.fillText(BOSS_NAME, vx + VIEW_W / 2, VIEW_H / 2);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = `rgba(${rgb},${alpha * 0.85})`;
    ctx.fillText(PHASE2_SUBTITLE, vx + VIEW_W / 2, VIEW_H / 2 + 24);
    ctx.restore();
  }

  function drawBossHealthBar(vx, now) {
    const barW = 210, barH = 10;
    const bx = vx + (VIEW_W - barW) / 2, by = 12;
    const frac = bossHealthFrac();
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.7)';
    ctx.fillRect(bx - 6, by - 16, barW + 12, barH + 22);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase2 ? PHASE2_NAME_COLOR : '#ff8ac0';
    const label = boss.defeated ? `${BOSS_NAME} — DEFEATED` : `${BOSS_NAME} (${bossHealth}/${BOSS_MAX_HEALTH})`;
    ctx.fillText(label, bx + barW / 2, by - 4);
    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    if (boss.phase2) { grad.addColorStop(0, '#d8c4e0'); grad.addColorStop(0.5, '#9a88aa'); grad.addColorStop(1, '#4a3a58'); }
    else { grad.addColorStop(0, '#ffb0d6'); grad.addColorStop(0.5, '#ff6aa8'); grad.addColorStop(1, '#a82a68'); }
    ctx.fillStyle = boss.defeated ? '#4a4640' : grad;
    ctx.fillRect(bx, by, barW * frac, barH);
    if (!boss.defeated && frac > 0 && frac < 0.3) {
      const flicker = 0.5 + 0.5 * Math.sin(now / 120);
      ctx.fillStyle = `rgba(255,255,255,${0.14 * flicker})`;
      ctx.fillRect(bx, by, barW * frac, barH);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
  }

  function drawShotgunHud(vx, p) {
    if (p.shotgunAmmo <= 0) return;
    const cx = vx + VIEW_W - 34, cy = 64;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,20,10,0.75)'; ctx.fill();
    ctx.strokeStyle = '#ff9c3d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`${p.shotgunAmmo}x`, cx - 7, cy + 4);
    ctx.restore();
  }
  function drawRadar(vx, p, now) {
    if (now > radarUntil) return;
    const cx = vx + VIEW_W - 34, cy = 34;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,25,15,0.75)'; ctx.fill();
    ctx.strokeStyle = '#3ddc84'; ctx.lineWidth = 2; ctx.stroke();
    const angle = Math.atan2(boss.y - p.y, boss.x - p.x);
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fillStyle = '#3ddc84'; ctx.shadowColor = '#3ddc84'; ctx.shadowBlur = 6; ctx.fill();
    ctx.restore();
  }
  function drawScanner(vx, p, now) {
    if (now > scannerUntil) return;
    const target = boss.defeated ? null : boss;
    if (!target) return;
    const cx = vx + VIEW_W - 34, cy = VIEW_H - 34;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35,25,5,0.75)'; ctx.fill();
    ctx.strokeStyle = '#ffb43d'; ctx.lineWidth = 2; ctx.stroke();
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fillStyle = '#ffb43d'; ctx.shadowColor = '#ffb43d'; ctx.shadowBlur = 6; ctx.fill();
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

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const intro = gameState === 'intro';
    const phase2Intro = gameState === 'phase2intro';
    const cutscene = intro || phase2Intro;
    const zoom = cutscene ? ZOOM * BOSS_INTRO_ZOOM_MULT : ZOOM;
    // The whole arena is on screen at all times: the camera sits fixed on the
    // middle of it (except during the boss's own cutscenes).
    const camX = cutscene ? boss.x : ARENA_CX;
    const camY = cutscene ? boss.y : ARENA_CY;
    const screaming = boss.phase === 'scream' && !boss.chasing && !boss.defeated && gameState === 'playing';
    const shakeX = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : screaming ? (Math.random() - 0.5) * 5 : 0;
    const shakeY = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : screaming ? (Math.random() - 0.5) * 5 : 0;

    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#1c0f0d'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, now);
    drawTrail(ctx, now);
    drawSmokeBombs(ctx, now);
    drawCrates(ctx);
    drawGasPatches(ctx, now);
    drawCornPatches(ctx, now);
    drawCandies(ctx);
    drawBoss(ctx, now);
    drawScreamRings(ctx, now);
    drawExplosions(ctx, now);
    // the arena is so big on screen that people are tiny: a ring under each makes them easy to find
    players.forEach((pl) => {
      if (pl.caught) return;
      ctx.strokeStyle = pl.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, 17, 0, Math.PI * 2); ctx.stroke();
    });
    drawPlayers(ctx);
    drawGasDanger(ctx, now);
    drawParticles(ctx);
    drawBloodSplatters(ctx);
    drawFloatingTexts(ctx);
    ctx.restore();

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }
    if (now < p.slowUntil) {                    // pink glow round the edges while cotton candy's slowing you
      const vg = ctx.createRadialGradient(vx + VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, vx + VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.55);
      vg.addColorStop(0, 'rgba(255,150,210,0)'); vg.addColorStop(1, 'rgba(255,150,210,0.3)');
      ctx.fillStyle = vg; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    if (intro) {
      drawBossIntroOverlay(vx, now);
    } else if (phase2Intro) {
      drawPhase2IntroOverlay(vx, now);
    } else {
      drawBossHealthBar(vx, now);
      drawRadar(vx, p, now);
      drawScanner(vx, p, now);
      drawShotgunHud(vx, p);
      drawStaminaBar(vx, p, 0);
    }
    ctx.restore();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'dying') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE CANDY KRAKEN CRUMBLES&hellip;<br>HAPPY HALLOWEEN!';
    } else {
      messageEl.style.display = 'none';
    }
  }
  function updateHud() {
    if (hudBossEl) {
      hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : `Boss: ${bossHealth}/${BOSS_MAX_HEALTH} HP`;
      hudBossEl.classList.toggle('done', boss.defeated);
    }
    if (hudPhaseEl) {
      hudPhaseEl.textContent = boss.phase2 ? 'Phase: 2 — WITHERED' : 'Phase: 1';
      hudPhaseEl.classList.toggle('done', boss.phase2);
    }
    if (hudMissilesEl) {
      const now = performance.now();
      hudMissilesEl.textContent = boss.defeated ? 'Stun: --'
        : boss.phase === 'stunned' ? `STUNNED — BITE IT! ${Math.max(0, (boss.stunUntil - now) / 1000).toFixed(1)}s`
          : `Stun in: ${ATTACKS_PER_STUN - boss.attacksSinceStun} attacks`;
      hudMissilesEl.classList.toggle('done', boss.phase === 'stunned');
    }
    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;
  function loop(now) {
    try {
      const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;

      if (gameState === 'intro') {
        updateIntroCutscene(now);
      } else if (gameState === 'phase2intro') {
        updatePhase2Cutscene(now);
      } else if (gameState === 'playing') {
        elapsedMs = now - runStartTime;
        updateInputMovement(now, dt);
        updateCrates(now);
        updateSmokeBombs(now);
        updateBoss(now, dt);
        updateBites(now);
        updateCandies(now, dt);
        updateCornPatches(now);
        updateGas(now);
        updateShotgunDefense(now);
        updateCatch(now);
        updateCutscenes(now);
      } else if (gameState === 'dying') {
        updateDeathSequence(now);
      }
      updateParticles(dt);
      updateFloatingTexts(dt);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderViewport(0, now);
      if (PLAYER_MODE === 2) { renderViewport(1, now); drawDivider(); }

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
