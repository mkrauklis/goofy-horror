(function () {
  const HM = window.HardMode;
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(25)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL25;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  const SOLO_DAMAGE_MULT = PLAYER_MODE === 1 ? 1.5 : 1;

  // Same trick every boss level uses: ZOOM is picked so the visible half
  // width/height both exceed half the arena's own size, so the camera
  // clamp in renderViewport collapses to a fixed center point instead of
  // following either player -- the whole arena reads as one screen.
  const ZOOM = 0.42;
  function visibleHalfW() { return (VIEW_W / 2) / ZOOM; }
  function visibleHalfH() { return (VIEW_H / 2) / ZOOM; }

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss: a 3-tile-by-3-tile robot grown over with grass, a single
  // giant mushroom sprouting from its head.
  const BOSS_RADIUS = 48; // ~1.5 tiles -- a 3x3 footprint
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.1;
  const BOSS_NAME = 'THE CULTIVATOR';

  const BOSS_INTRO_CUTSCENE_MS = 3000;
  const BOSS_INTRO_ZOOM_MULT = 1.7;
  const BOSS_INTRO_SHAKE_MAG = 7;
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_IDLE_SPEED = HM.speed(PLAYER_SPEED * 0.3);
  const BOSS_IDLE_MIN_MS = 900;
  const BOSS_IDLE_MAX_MS = 1700;

  const BOSS_MAX_HEALTH = HM.bossHp(25);
  const PHASE2_HEALTH_THRESHOLD = HM.bossHp(15);
  const PHASE2_CUTSCENE_MS = 3000;
  const PHASE2_NAME_COLOR = '#ffd23d';
  const PHASE2_SUBTITLE = 'RUSTING';

  // 1. Gear throw: every 2s for 10s straight, a gear launches at whoever's
  // closest, flying at 2x player speed and rebounding off walls instead
  // of despawning, until its own lifetime runs out.
  const GEARTHROW_DURATION_MS = 10000;
  const GEARTHROW_INTERVAL_MS = 2000;
  const GEAR_SPEED = HM.proj(PLAYER_SPEED * 2);
  const GEAR_HIT_RADIUS = 16;
  const GEAR_LIFETIME_MS = 7000;

  // 2. Spore bloom: a head-shake windup, then ~20 spores scatter out to
  // random points across the whole arena over 3s, land, swell into a
  // mushroom over a short fuse, then burst in a 2x2-tile blast.
  const SPOREBLOOM_WINDUP_MS = 900;
  const SPORE_COUNT = 20;
  const SPORE_FLOAT_MS = 3000;
  const SPORE_FUSE_MS = 1400;
  const SPORE_BLAST_RADIUS = TILE * 1.2; // ~2x2 tiles across

  // 3. Mycelium chase: two extendo-arms plant into the ground and tunnel
  // after whoever's nearest, leaving a trail of harmless mounds behind
  // each hand -- only the hand itself is dangerous.
  const MYCELIUM_DURATION_MS = 8000;
  const MYCELIUM_ARM_COUNT = 2;
  const MYCELIUM_SPEED = PLAYER_SPEED * 1.3;
  const MYCELIUM_HIT_RADIUS = 18;
  const MOUND_INTERVAL_MS = 260;

  // 4. Rocket cannon: a cannon rises from its back and fires 8 rockets in
  // a spread, each one exploding on the first player, wall, or crate it
  // touches.
  const ROCKET_COUNT = 8;
  const ROCKET_INTERVAL_MS = 320;
  const ROCKET_SPEED = HM.proj(PLAYER_SPEED * 2.2);
  const ROCKET_BLAST_RADIUS = TILE * 1.3;

  // Phase 2, gained in addition to the four above once it's rusting.
  // 5. Fire breath: a mouth-open windup, then a 5-tile jet of fire locked
  // to whoever's nearest at the moment it fires.
  const FIREBREATH_WINDUP_MS = 700;
  const FIREBREATH_ACTIVE_MS = 1600;
  const FIREBREATH_RANGE = TILE * 5;
  const FIREBREATH_HALF_WIDTH = TILE * 0.8;

  // 6. Stalk walk: windows seal shut over 1s, then it bears down on
  // whoever's nearest at 1.4x speed with the mushroom flashing neon green
  // every 1.5s, while every player's own flashlight shrinks to barely a
  // tile around them.
  const STALKWALK_SEAL_MS = 1000;
  const STALKWALK_DURATION_MS = 7000;
  const STALKWALK_SPEED = PLAYER_SPEED * 1;
  const STALKWALK_FLASH_PERIOD_MS = 2000;
  const STALKWALK_LIGHT_RADIUS = TILE * 0.9;

  // The furnace: the only way to actually hurt this boss. Each coal
  // deposited (walking up to it while carrying at least one) costs 1 HP.
  const FURNACE_TRIGGER_RADIUS = 46;
  const COAL_PICKUP_RADIUS = 20;
  const COAL_RESPAWN_MS = 14000;
  const COAL_CARRY_MAX = 1;

  // Death: a short stumble-back, then a tumble out through the nearest
  // window before the level hands off.
  const DEATH_STUMBLE_MS = 1200;
  const DEATH_FALL_MS = 1600;

  const RADAR_DURATION_MS = HM.ability(10000);
  const ENERGY_DURATION_MS = HM.ability(10000);
  const SCANNER_DURATION_MS = HM.ability(10000);
  // The freeze item (CO2) has no effect on this boss at all -- see
  // applyItemEffect's 'co2' branch -- but the tranquilizer shotgun's own
  // stun still uses frozenUntil/this multiplier.
  const FROZEN_SPEED_MULT = 0.75;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
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

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

  const hudBossEl = document.getElementById('hud-boss');
  const hudCoalEl = document.getElementById('hud-coal');
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
  // drone every normal level uses; this boss doesn't get a bespoke theme.
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

    ambientSubOsc = addDroneVoice(38, 'sine', 0.6, 0.05, 1.5).osc;
    addDroneVoice(40.5, 'sine', 0.5, 0.08, 2);
    addDroneVoice(19, 'sine', 0.4, 0.03, 0.8);
    ambientMidGain = addDroneVoice(90, 'sawtooth', 0, 0.15, 6).gain;
    addDroneVoice(620, 'triangle', 0.05, 0.02, 40);
    // the boss theme: only while the fight is actually on, and more
    // frantic as the boss's health drops
    if (window.BossMusic) {
      window.BossMusic.start({
        audioCtx, dest: musicMasterGain, theme: 'cultivator',
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
    ambientSubOsc.frequency.setTargetAtTime(38 + proximity * 12, audioCtx.currentTime, 0.3);
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
  function playCoalChime() { playTone(220, 0.22, 'square', 0.22); playTone(130, 0.3, 'triangle', 0.2, 0.05); }
  function playWinJingle() { [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14)); }

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
  function playExplosion() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, start);
    osc.frequency.exponentialRampToValueAtTime(30, start + 0.4);
    gain.gain.setValueAtTime(0.32, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
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

  const FLOOR_SHADES = ['#3c4a30', '#425030', '#384a2c', '#405232', '#3a4a2e'];
  function floorShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % FLOOR_SHADES.length;
    return FLOOR_SHADES[idx];
  }
  const GRASS_TILE_CHANCE = 85;
  function hasGrassAt(x, y) {
    const h = Math.imul(x, 668265261) ^ Math.imul(y, 1274126177);
    const u = (h ^ (h >>> 15)) >>> 0;
    return (u % 100) < GRASS_TILE_CHANCE;
  }
  function drawGrassTuft(g, px, py, x, y, now) {
    const h = Math.imul(x, 2654435761) ^ Math.imul(y, 40503);
    const u = (h ^ (h >>> 15)) >>> 0;
    const blades = 3 + (u % 2);
    const baseX = px + 6 + (u % 20);
    for (let i = 0; i < blades; i++) {
      const bx = baseX + i * 4 - blades * 2;
      const height = 8 + ((u >> (i * 3)) % 7) * 1.6;
      const sway = Math.sin(now * 0.0017 + i + (u % 10)) * 2;
      g.strokeStyle = i % 2 === 0 ? '#3a7a2a' : '#4c9436';
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, py + TILE - 2);
      g.quadraticCurveTo(bx + sway * 0.5, py + TILE - height * 0.6, bx + sway, py + TILE - height);
      g.stroke();
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clampC = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clampC(((n >> 16) & 255) + 255 * amt);
    const g2 = clampC(((n >> 8) & 255) + 255 * amt);
    const b = clampC((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    return ch === '#' || ch === 'U' || ch === 'C';
  }
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

  function isHidden(p, now) {
    return smokeBombs.some((b) => b.exploded && now < b.endsAt && Math.hypot(p.x - b.x, p.y - b.y) < SMOKE_RADIUS);
  }

  function formatTime(ms) {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }

  const BEST_TIME_KEY = 'goofy-horror-best-level25';
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
  let catchFlash = 0;

  function bossHealthFrac() { return clamp(bossHealth / BOSS_MAX_HEALTH, 0, 1); }
  function speedMult(now) { return now < boss.frozenUntil ? FROZEN_SPEED_MULT : 1; }

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0, isMoving: false,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0, shotgunAmmo: 0, coalCount: 0,
    };
  }
  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  // The boss: one Cultivator. Every attack's own sub-state lives bundled
  // on this same object, same convention every other boss level uses.
  function makeBoss() {
    return {
      x: 0, y: 0, radius: BOSS_RADIUS, seed: Math.random() * 100,
      lookDir: { x: 0, y: 1 }, defeated: false, frozenUntil: 0,
      phase2: false,

      // ---- attack cycle ----
      phase: 'idle', // 'idle' | 'gearthrow' | 'sporebloom' | 'mycelium' | 'rocketcannon' | 'firebreath' | 'stalkwalk'
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      lastAttack: null,

      // gear throw
      nextGearAt: 0,
      gearthrowUntil: 0,

      // spore bloom
      sporeSubPhase: 'windup', // 'windup' | 'active'
      sporeWindupStartedAt: 0,

      // mycelium
      myceliumUntil: 0,

      // rocket cannon
      rocketsFired: 0,
      nextRocketAt: 0,

      // fire breath
      fireSubPhase: 'windup', // 'windup' | 'active'
      fireWindupStartedAt: 0,
      fireDir: { x: 1, y: 0 },
      fireActiveUntil: 0,

      // stalk walk
      stalkSubPhase: 'sealing', // 'sealing' | 'walking'
      stalkStartedAt: 0,
      stalkUntil: 0,

      // magnet pull
      magnetPullTarget: null,
      magnetPullUntil: 0,
      magnetActiveUntil: 0, // just drives the arm's visual pulse
    };
  }
  const boss = makeBoss();

  let gears = []; // { x, y, dx, dy, spawnedAt }
  let spores = []; // { x, y, dx, dy, landedAt, exploded }
  let myceliumArms = []; // { x, y, targetTile, mounds: [{x,y}], nextMoundAt }
  let rockets = []; // { x, y, dx, dy }
  let explosions = []; // visual-only blast rings: { x, y, startedAt }
  let particles = [];
  let bloodSplatters = [];
  let floatingTexts = [];

  function spawnExplosion(x, y) {
    explosions.push({ x, y, startedAt: performance.now() });
    playExplosion();
  }

  // Everyone within radius of (x,y) gets caught -- used by every blast
  // (spore mushrooms, rockets).
  function blastHit(x, y, radius, now) {
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      if (Math.hypot(p.x - x, p.y - y) < radius) triggerCaught(p, now);
    });
  }

  // ---- coal piles: the only item that actually matters here ----
  let coalPiles = []; // { x, y, nextSpawnAt } -- one slot per LEVEL.coalSpawns entry

  function resetCoalPiles() {
    coalPiles = (LEVEL.coalSpawns || []).map((c) => ({ x: c.x, y: c.y, live: true, nextSpawnAt: 0 }));
  }

  function updateCoalPiles(now) {
    players.forEach((p) => {
      if (p.caught) return;
      coalPiles.forEach((pile) => {
        if (!pile.live) {
          if (now >= pile.nextSpawnAt) pile.live = true;
          return;
        }
        const c = tileCenter(pile.x, pile.y);
        if (Math.hypot(p.x - c.x, p.y - c.y) < COAL_PICKUP_RADIUS && p.coalCount < COAL_CARRY_MAX) {
          pile.live = false;
          pile.nextSpawnAt = now + COAL_RESPAWN_MS;
          p.coalCount++;
          spawnFloatingText(c.x, c.y, `COAL (${p.coalCount})`);
          playPickupChime();
        }
      });
    });
  }

  function furnaceCenter() { return tileCenter(LEVEL.furnace.x, LEVEL.furnace.y); }

  function updateFurnace(now) {
    if (boss.defeated) return;
    const c = furnaceCenter();
    players.forEach((p) => {
      if (p.caught) return;
      if (p.coalCount <= 0) return;
      if (Math.hypot(p.x - c.x, p.y - c.y) > FURNACE_TRIGGER_RADIUS) return;
      p.coalCount--;
      const dmg = 1 * SOLO_DAMAGE_MULT;
      bossHealth = Math.max(0, bossHealth - dmg);
      spawnFloatingText(c.x, c.y - 10, `-${dmg} DAMAGE`);
      playCoalChime();
      if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) enterPhase2(now);
      if (bossHealth <= 0 && !boss.defeated) triggerDeath(now);
    });
  }

  function enterPhase2(now) {
    boss.phase2 = true;
    gameState = 'phase2intro';
    phase2IntroStartedAt = now;
    // whatever it was mid-attack, cut it short cleanly
    boss.phase = 'idle';
    boss.nextIdleUntil = now + 500;
    spawnFloatingText(boss.x, boss.y - boss.radius - 10, 'RUSTING...');
  }

  function triggerDeath(now) {
    boss.defeated = true;
    gameState = 'dying';
    deathStartedAt = now;
    gears = []; spores = []; myceliumArms = []; rockets = [];
  }

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let smokeBombs = [];
  let nvgUntil = 0;
  let freezeFinished = false;

  function resetLevel() {
    players.forEach((p) => {
      respawnPlayer(p);
      p.caught = false; p.caughtAt = 0; p.invulnerableUntil = 0;
      p.stamina = STAMINA_MAX; p.moveState = 'normal'; p.exhaustedUntil = 0;
      p.sprintActive = false; p.shotgunAmmo = 0; p.coalCount = 0;
    });

    const spawn = LEVEL.monsterSpawns[0];
    const m = tileCenter(spawn.x, spawn.y);
    boss.x = m.x; boss.y = m.y;
    boss.frozenUntil = 0; boss.defeated = false; boss.phase2 = false;
    boss.phase = 'idle'; boss.phaseStartedAt = 0;
    boss.nextIdleUntil = performance.now() + BOSS_INTRO_GRACE_MS;
    boss.lastAttack = null;
    boss.magnetPullTarget = null;
    boss.magnetPullUntil = 0;
    boss.magnetActiveUntil = 0;

    gears = []; spores = []; myceliumArms = []; rockets = []; explosions = [];
    bossHealth = BOSS_MAX_HEALTH;
    resetCoalPiles();

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)],
      opened: false, openedAt: 0,
    }));
    radarUntil = 0; energyUntil = 0; scannerUntil = 0; smokeBombs = []; nvgUntil = 0;
    floatingTexts = []; particles = []; bloodSplatters = [];
    resetExploration();
    gameState = 'intro';
    introStartedAt = performance.now();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
    freezeFinished = false;
  }
  resetLevel();

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
      // The Cultivator shrugs this off entirely -- a boss fight's own
      // tranquilizer-gun stun still works, just not the freeze item.
      spawnFloatingText(x, y, 'NO EFFECT'); playItemChime(300);
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
      } else spawnFloatingText(x, y, 'AMMO FULL');
    } else if (item === 'energy') {
      energyUntil = now + ENERGY_DURATION_MS;
      spawnFloatingText(x, y, 'ENERGY'); playItemChime(900);
    }
  }

  function updateCrates(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      crates.forEach((c) => {
        if (c.opened) return;
        if (c.x === t.x && c.y === t.y) {
          c.opened = true; c.openedAt = now;
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
      if (boss.phase !== 'stalkwalk') return; // only a real threat while it's actually bearing down
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
    p.invulnerableUntil = now + CATCH_CUTSCENE_MS + 1200;
  }
  // Once caught, a player stays down for the rest of the run -- no
  // respawn after the cutscene the way every other level works. Only
  // once EVERY player is caught does the group actually wipe.
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
  function spawnSporeBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 120;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0, maxLife: 0.3 + Math.random() * 0.3, size: 1.5 + Math.random() * 2, color: 'spore',
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
      g.fillStyle = pt.color === 'spore' ? `rgba(180,230,120,${alpha})` : `rgba(160,15,20,${alpha})`;
      g.fill();
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

  // ======================= THE ATTACK CYCLE =======================
  const PHASE1_ATTACKS = ['gearthrow', 'sporebloom', 'mycelium', 'rocketcannon', 'magnetpull'];
  const PHASE2_ONLY_ATTACKS = ['firebreath', 'stalkwalk'];

  function attackPool() {
    return boss.phase2 ? PHASE1_ATTACKS.concat(PHASE2_ONLY_ATTACKS) : PHASE1_ATTACKS;
  }
  function pickAttack() {
    const pool = attackPool().filter((a) => a !== boss.lastAttack);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'gearthrow') {
      boss.nextGearAt = now;
      boss.gearthrowUntil = now + GEARTHROW_DURATION_MS;
    } else if (kind === 'sporebloom') {
      boss.sporeSubPhase = 'windup';
      boss.sporeWindupStartedAt = now;
    } else if (kind === 'mycelium') {
      boss.myceliumUntil = now + MYCELIUM_DURATION_MS;
      myceliumArms = [];
      for (let i = 0; i < MYCELIUM_ARM_COUNT; i++) {
        const target = players[i % players.length];
        myceliumArms.push({
          x: boss.x + (i === 0 ? -boss.radius : boss.radius), y: boss.y + boss.radius * 0.6,
          mounds: [], nextMoundAt: now,
        });
      }
    } else if (kind === 'rocketcannon') {
      boss.rocketsFired = 0;
      boss.nextRocketAt = now;
    } else if (kind === 'firebreath') {
      boss.fireSubPhase = 'windup';
      boss.fireWindupStartedAt = now;
      const target = nearestPlayer(boss.x, boss.y);
      const dx = target.x - boss.x, dy = target.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      boss.fireDir = { x: dx / d, y: dy / d };
    } else if (kind === 'stalkwalk') {
      boss.stalkSubPhase = 'sealing';
      boss.stalkStartedAt = now;
    } else if (kind === 'magnetpull') {
      boss.magnetPullTarget = nearestPlayer(boss.x, boss.y);
      boss.magnetPullUntil = now + MAGNETPULL_DURATION_MS;
      boss.magnetActiveUntil = boss.magnetPullUntil;
      playItemChime(200);
    }
  }

  function finishAttack(now) {
    boss.phase = 'idle';
    boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
    gears = []; myceliumArms = [];
    boss.magnetPullTarget = null;
  }

  function updateBossIdle(now, dt) {
    const target = nearestPlayer(boss.x, boss.y);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d > boss.radius) {
      const step = BOSS_IDLE_SPEED * speedMult(now) * dt;
      boss.lookDir = { x: dx / d, y: dy / d };
      boss.x += (dx / d) * Math.min(step, d);
      boss.y += (dy / d) * Math.min(step, d);
    }
    if (now >= boss.nextIdleUntil) startAttack(pickAttack(), now);
  }

  function updateGearThrow(now) {
    if (now >= boss.nextGearAt && now < boss.gearthrowUntil) {
      boss.nextGearAt = now + GEARTHROW_INTERVAL_MS;
      const target = nearestPlayer(boss.x, boss.y);
      const dx = target.x - boss.x, dy = target.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      gears.push({ x: boss.x, y: boss.y, dx: (dx / d) * GEAR_SPEED, dy: (dy / d) * GEAR_SPEED, spawnedAt: now });
      playShotgunBlast();
    }
    if (now >= boss.gearthrowUntil && gears.length === 0) finishAttack(now);
    else if (now >= boss.gearthrowUntil + GEAR_LIFETIME_MS) finishAttack(now);
  }
  function updateGears(now, dt) {
    for (let i = gears.length - 1; i >= 0; i--) {
      const g = gears[i];
      if (now - g.spawnedAt > GEAR_LIFETIME_MS) { gears.splice(i, 1); continue; }
      let nx = g.x + g.dx * dt, ny = g.y + g.dy * dt;
      const t = worldToTile(nx, ny);
      if (isWallForPlayer(t.x, t.y)) {
        const tx = worldToTile(g.x, ny);
        const ty = worldToTile(nx, g.y);
        if (isWallForPlayer(tx.x, tx.y)) g.dy *= -1;
        if (isWallForPlayer(ty.x, ty.y)) g.dx *= -1;
        nx = g.x + g.dx * dt; ny = g.y + g.dy * dt;
      }
      g.x = nx; g.y = ny;
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - g.x, p.y - g.y) < GEAR_HIT_RADIUS) { triggerCaught(p, now); }
      });
    }
  }

  // A random open-floor point anywhere in the arena (margin kept off the
  // walls) -- used to scatter spores across the whole room instead of
  // just drifting near wherever the boss happens to be standing.
  function randomArenaPoint() {
    for (let tries = 0; tries < 20; tries++) {
      const tx = 2 + Math.floor(Math.random() * (COLS - 4));
      const ty = 2 + Math.floor(Math.random() * (ROWS - 4));
      if (!isWallForPlayer(tx, ty)) return tileCenter(tx, ty);
    }
    return tileCenter(Math.floor(COLS / 2), Math.floor(ROWS / 2));
  }

  function updateSporeBloom(now) {
    if (boss.sporeSubPhase === 'windup') {
      if (now - boss.sporeWindupStartedAt >= SPOREBLOOM_WINDUP_MS) {
        boss.sporeSubPhase = 'active';
        const headX = boss.x, headY = boss.y - boss.radius * 1.3;
        // 10 more once it's rusting -- the same bloom, just worse.
        const sporeCount = SPORE_COUNT + (boss.phase2 ? 10 : 0);
        for (let i = 0; i < sporeCount; i++) {
          const target = randomArenaPoint();
          const dx = target.x - headX, dy = target.y - headY;
          const travelSec = SPORE_FLOAT_MS / 1000;
          spores.push({
            x: headX, y: headY, dx: dx / travelSec, dy: dy / travelSec,
            targetX: target.x, targetY: target.y,
            wobbleSeed: Math.random() * 1000,
            bornAt: now, landedAt: 0, exploded: false,
          });
        }
        playItemChime(340);
      }
      return;
    }
    if (spores.length === 0 && now - boss.sporeWindupStartedAt > SPOREBLOOM_WINDUP_MS + 200) finishAttack(now);
  }
  function updateSpores(now, dt) {
    for (let i = spores.length - 1; i >= 0; i--) {
      const s = spores[i];
      if (s.exploded) continue;
      if (!s.landedAt) {
        if (now - s.bornAt >= SPORE_FLOAT_MS) {
          s.landedAt = now;
          s.x = s.targetX; s.y = s.targetY;
          const t = worldToTile(s.x, s.y);
          if (isWallForPlayer(t.x, t.y)) { spores.splice(i, 1); continue; }
        } else {
          // straight-line travel to its scattered destination, plus a
          // light perpendicular wobble so the path still reads as
          // drifting rather than a dead-straight dart.
          const frac = (now - s.bornAt) / SPORE_FLOAT_MS;
          const wob = Math.sin(now * 0.006 + s.wobbleSeed) * 14 * (1 - frac);
          const len = Math.hypot(s.dx, s.dy) || 1;
          s.x += s.dx * dt + (-s.dy / len) * wob * dt;
          s.y += s.dy * dt + (s.dx / len) * wob * dt;
        }
        continue;
      }
      if (now - s.landedAt >= SPORE_FUSE_MS) {
        s.exploded = true;
        blastHit(s.x, s.y, SPORE_BLAST_RADIUS, now);
        spawnSporeBurst(s.x, s.y);
        playExplosion();
        setTimeout(() => {
          const idx = spores.indexOf(s);
          if (idx !== -1) spores.splice(idx, 1);
        }, 400);
      }
    }
  }

  function updateMycelium(now, dt) {
    myceliumArms.forEach((arm) => {
      const target = nearestPlayer(arm.x, arm.y);
      const dx = target.x - arm.x, dy = target.y - arm.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = MYCELIUM_SPEED * dt;
      arm.x += (dx / d) * step; arm.y += (dy / d) * step;
      if (now >= arm.nextMoundAt) {
        arm.nextMoundAt = now + MOUND_INTERVAL_MS;
        arm.mounds.push({ x: arm.x, y: arm.y });
        if (arm.mounds.length > 40) arm.mounds.shift();
      }
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - arm.x, p.y - arm.y) < MYCELIUM_HIT_RADIUS) triggerCaught(p, now);
      });
    });
    if (now >= boss.myceliumUntil) finishAttack(now);
  }

  function updateRocketCannon(now) {
    if (boss.rocketsFired < ROCKET_COUNT && now >= boss.nextRocketAt) {
      boss.nextRocketAt = now + ROCKET_INTERVAL_MS;
      boss.rocketsFired++;
      const target = nearestPlayer(boss.x, boss.y);
      const spread = (Math.random() - 0.5) * 0.5;
      const baseAngle = Math.atan2(target.y - boss.y, target.x - boss.x) + spread;
      rockets.push({
        x: boss.x, y: boss.y - boss.radius * 0.5,
        dx: Math.cos(baseAngle) * ROCKET_SPEED, dy: Math.sin(baseAngle) * ROCKET_SPEED,
      });
      playShotgunBlast();
    }
    if (boss.rocketsFired >= ROCKET_COUNT && rockets.length === 0) finishAttack(now);
  }
  function updateRockets(now, dt) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.dx * dt; r.y += r.dy * dt;
      const t = worldToTile(r.x, r.y);
      let hit = false;
      if (isWallForPlayer(t.x, t.y)) hit = true;
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - r.x, p.y - r.y) < 16) hit = true;
      });
      if (hit) {
        spawnExplosion(r.x, r.y);
        blastHit(r.x, r.y, ROCKET_BLAST_RADIUS, now);
        rockets.splice(i, 1);
      }
    }
  }

  function updateFireBreath(now) {
    if (boss.fireSubPhase === 'windup') {
      if (now - boss.fireWindupStartedAt >= FIREBREATH_WINDUP_MS) {
        boss.fireSubPhase = 'active';
        boss.fireActiveUntil = now + FIREBREATH_ACTIVE_MS;
        playExplosion();
      }
      return;
    }
    // Rectangle hit test along fireDir from the boss's mouth.
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      const dx = p.x - boss.x, dy = p.y - boss.y;
      const along = dx * boss.fireDir.x + dy * boss.fireDir.y;
      const perp = Math.abs(dx * -boss.fireDir.y + dy * boss.fireDir.x);
      if (along > 0 && along < FIREBREATH_RANGE && perp < FIREBREATH_HALF_WIDTH) triggerCaught(p, now);
    });
    if (now >= boss.fireActiveUntil) finishAttack(now);
  }

  function updateStalkWalk(now, dt) {
    if (boss.stalkSubPhase === 'sealing') {
      if (now - boss.stalkStartedAt >= STALKWALK_SEAL_MS) {
        boss.stalkSubPhase = 'walking';
        boss.stalkUntil = now + STALKWALK_DURATION_MS;
      }
      return;
    }
    const target = nearestPlayer(boss.x, boss.y);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = STALKWALK_SPEED * speedMult(now) * dt;
      boss.lookDir = { x: dx / d, y: dy / d };
      boss.x += (dx / d) * Math.min(step, d);
      boss.y += (dy / d) * Math.min(step, d);
    }
    if (now >= boss.stalkUntil) finishAttack(now);
  }

  function updateBoss(now, dt) {
    if (boss.defeated) return;
    if (now < boss.frozenUntil) return;
    switch (boss.phase) {
      case 'idle': updateBossIdle(now, dt); break;
      case 'gearthrow': updateGearThrow(now); break;
      case 'sporebloom': updateSporeBloom(now); break;
      case 'mycelium': updateMycelium(now, dt); break;
      case 'rocketcannon': updateRocketCannon(now); break;
      case 'firebreath': updateFireBreath(now); break;
      case 'stalkwalk': updateStalkWalk(now, dt); break;
      case 'magnetpull': updateMagnetPullAttack(now, dt); break;
      default: boss.phase = 'idle';
    }
  }

  function updateCatch(now) {
    if (boss.defeated) return;
    if (boss.phase === 'sporebloom' && boss.sporeSubPhase === 'windup') return;
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
    if (t < DEATH_STUMBLE_MS) return;
    if (t < DEATH_STUMBLE_MS + DEATH_FALL_MS) return;
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
    if (window.GoofyStory) window.GoofyStory.completeLevel(25);
    setTimeout(() => { window.location.href = 'level26.html'; }, 800);
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }
  function minimapColorFor(ch) {
    if (ch === '#' || ch === 'U') return '#6a7a5a';
    return '#2e3a26';
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
    // The boss never shows up on the minimap during stalk walk -- it's
    // hunting you in the dark, not something you can track from a map.
    if (!(boss.phase === 'stalkwalk' && boss.stalkSubPhase === 'walking')) {
      const bx = mx + (boss.x / WORLD_W) * MINIMAP_W;
      const by = my + (boss.y / WORLD_H) * mh;
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#c08ae8';
      ctx.shadowColor = '#c08ae8';
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

  function drawBossHealthBar(vx, now) {
    const barW = 210, barH = 10;
    const bx = vx + (VIEW_W - barW) / 2, by = 12;
    const frac = bossHealthFrac();
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.7)';
    ctx.fillRect(bx - 6, by - 16, barW + 12, barH + 22);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase2 ? '#ffd23d' : '#8fd468';
    const label = boss.defeated ? 'CULTIVATOR — DEFEATED' : `CULTIVATOR (${bossHealth}/${BOSS_MAX_HEALTH})`;
    ctx.fillText(label, bx + barW / 2, by - 4);
    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    if (boss.phase2) { grad.addColorStop(0, '#ffe27a'); grad.addColorStop(0.5, '#c9903a'); grad.addColorStop(1, '#6a4418'); }
    else { grad.addColorStop(0, '#9fe16a'); grad.addColorStop(0.5, '#4c9436'); grad.addColorStop(1, '#2a5c1e'); }
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
  function nearestFurnaceOrCoal(p) {
    if (p.coalCount > 0) return furnaceCenter();
    let best = null, bestD = Infinity;
    coalPiles.forEach((pile) => {
      if (!pile.live) return;
      const c = tileCenter(pile.x, pile.y);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best || furnaceCenter();
  }
  function drawScanner(vx, p, now) {
    if (now > scannerUntil) return;
    const target = nearestFurnaceOrCoal(p);
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
  function drawCoalHud(vx, p) {
    if (p.coalCount <= 0) return;
    const cx = vx + VIEW_W - 34, cy = 94;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,10,0.75)'; ctx.fill();
    ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - 6, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c1c'; ctx.fill();
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#d9d9d9';
    ctx.fillText(`${p.coalCount}x`, cx - 1, cy + 4);
    ctx.restore();
  }

  const PROXIMITY_WARNING_RADIUS = 500;
  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    // the screen smears out the closer it gets (instead of a red flash)
    window.ScreenFx.blur(ctx, vx, 0, VIEW_W, VIEW_H, closeness);
  }

  function drawJaw(g, vx, direction, progress, color) {
    const teeth = 8;
    const toothW = VIEW_W / teeth;
    const reach = progress * (VIEW_H / 2 + 24);
    g.fillStyle = color;
    g.beginPath();
    if (direction === 1) {
      g.moveTo(vx, 0); g.lineTo(vx + VIEW_W, 0); g.lineTo(vx + VIEW_W, Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) { const x = vx + i * toothW; const y = reach + (i % 2 === 0 ? 14 : -6); g.lineTo(x, y); }
      g.lineTo(vx, 0);
    } else {
      g.moveTo(vx, VIEW_H); g.lineTo(vx + VIEW_W, VIEW_H); g.lineTo(vx + VIEW_W, VIEW_H - Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) { const x = vx + i * toothW; const y = VIEW_H - reach - (i % 2 === 0 ? 14 : -6); g.lineTo(x, y); }
      g.lineTo(vx, VIEW_H);
    }
    g.closePath(); g.fill();
  }
  function drawCutsceneOverlay(vx, p, now) {
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);
    const jawProgress = clamp(t / 0.75, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(40,10,15,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    const shakeA = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shakeA, (Math.random() - 0.5) * shakeA);
    drawJaw(ctx, vx, 1, jawProgress, '#2a0d12');
    drawJaw(ctx, vx, -1, jawProgress, '#200810');
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
    ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke();
  }

  // ======================= drawing: arena =======================
  function drawFurnace(g) {
    const c = furnaceCenter();
    const px = (LEVEL.furnace.x - 1) * TILE, py = LEVEL.furnace.y * TILE;
    g.save();
    g.fillStyle = '#2a2a2c';
    g.fillRect(px, py, TILE * 3, TILE);
    g.strokeStyle = '#141416';
    g.lineWidth = 2;
    g.strokeRect(px, py, TILE * 3, TILE);
    // the mouth -- glows brighter the more damage it's done recently
    const glow = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
    g.beginPath();
    g.arc(c.x, c.y, 13, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,${100 + glow * 60},40,0.9)`;
    g.shadowColor = '#ff6a1a';
    g.shadowBlur = 10 + glow * 6;
    g.fill();
    g.shadowBlur = 0;
    g.restore();
  }
  function drawCoalPiles(g, now) {
    coalPiles.forEach((pile) => {
      if (!pile.live) return;
      const c = tileCenter(pile.x, pile.y);
      g.save();
      g.translate(c.x, c.y);
      [[-5, 2], [4, 3], [0, -3], [-2, 5]].forEach(([dx, dy], i) => {
        g.beginPath();
        g.arc(dx, dy, 4 + (i % 2), 0, Math.PI * 2);
        g.fillStyle = '#1c1c1c';
        g.fill();
      });
      g.restore();
    });
  }

  const WINDOW_DIR_VEC = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
  function drawWindows(g, now) {
    const sealed = boss.phase === 'stalkwalk' && boss.stalkSubPhase === 'walking';
    (LEVEL.windows || []).forEach((w) => {
      const px = w.x * TILE, py = w.y * TILE;
      g.fillStyle = sealed ? '#3a3228' : '#9fc6d9';
      if (!sealed) { g.shadowColor = '#fff4d6'; g.shadowBlur = 10; }
      g.fillRect(px, py, TILE, TILE);
      g.shadowBlur = 0;
      g.strokeStyle = '#2a2a2e';
      g.lineWidth = 2;
      g.strokeRect(px, py, TILE, TILE);
      if (sealed) {
        g.strokeStyle = 'rgba(80,60,30,0.9)';
        g.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(px + 2, py + 6 + i * 10);
          g.lineTo(px + TILE - 2, py + 2 + i * 10);
          g.stroke();
        }
      } else {
        g.beginPath();
        g.moveTo(px + TILE / 2, py); g.lineTo(px + TILE / 2, py + TILE);
        g.moveTo(px, py + TILE / 2); g.lineTo(px + TILE, py + TILE / 2);
        g.strokeStyle = 'rgba(30,30,34,0.8)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    });
  }

  function drawTiles(g, now) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        if (ch === '#') { g.fillStyle = '#20281a'; g.fillRect(px, py, TILE, TILE); continue; }
        if (ch === 'U') { g.fillStyle = '#20281a'; g.fillRect(px, py, TILE, TILE); continue; }
        if (ch === 'N') { g.fillStyle = '#20281a'; g.fillRect(px, py, TILE, TILE); continue; }
        g.fillStyle = floorShade(x, y);
        g.fillRect(px, py, TILE, TILE);
        if (hasGrassAt(x, y)) drawGrassTuft(g, px, py, x, y, now);
      }
    }
    myceliumArms.forEach((arm) => {
      arm.mounds.forEach((m) => {
        g.beginPath();
        g.ellipse(m.x, m.y, 10, 6, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(80,60,30,0.6)';
        g.fill();
      });
    });
    drawFurnace(g);
    drawCoalPiles(g, now);
    drawWindows(g, now);
  }

  // ======================= drawing: boss =======================
  function drawRobotGears(g, radius, seed) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = radius * (0.45 + (u % 5) * 0.08);
      const gx = Math.cos(a) * dist, gy = Math.sin(a) * dist;
      const gr = radius * (0.1 + (u % 3) * 0.025);
      g.save();
      g.translate(gx, gy);
      g.rotate(seed + i);
      const teeth = 6;
      g.beginPath();
      for (let j = 0; j < teeth; j++) {
        const a0 = (j / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / teeth) * 0.5;
        g.moveTo(Math.cos(a0) * gr, Math.sin(a0) * gr);
        g.lineTo(Math.cos(a0) * (gr * 1.35), Math.sin(a0) * (gr * 1.35));
        g.lineTo(Math.cos(a1) * (gr * 1.35), Math.sin(a1) * (gr * 1.35));
        g.lineTo(Math.cos(a1) * gr, Math.sin(a1) * gr);
      }
      g.closePath();
      g.fillStyle = boss.phase2 ? '#8a5a3a' : '#6a6a5e';
      g.fill();
      g.restore();
    }
  }
  // Real grass growing out of the hull -- same swaying-strand convention
  // Level 17's Bog uses for its draped seaweed, not just a scatter of
  // moss dots: fixed clumps around the body, each a few blades radiating
  // outward and curving with `t`. Turns yellow once it's rusting, same
  // as the lore ("the robot's grass on its back starts turning yellow").
  function drawCultivatorGrass(g, radius, seed, t) {
    const clumps = 9;
    for (let c = 0; c < clumps; c++) {
      const h = Math.imul(Math.floor(seed * 1000) + c * 131, 2246822519);
      const u = (h ^ (h >>> 15)) >>> 0;
      const baseAngle = ((u % 360) * Math.PI) / 180;
      const baseDist = radius * (0.35 + (u % 6) * 0.1);
      const baseX = Math.cos(baseAngle) * baseDist, baseY = Math.sin(baseAngle) * baseDist;
      const blades = 3 + (u % 2);
      for (let i = 0; i < blades; i++) {
        const bladeAngle = baseAngle + (i - blades / 2) * 0.35;
        const len = radius * (0.22 + ((u >> (i * 3 + 2)) % 6) * 0.03);
        const phase = ((u % 100) / 100) * Math.PI * 2 + i * 1.7 + seed;
        const sway = Math.sin(t * 0.0022 + phase) * radius * 0.06;
        const tipX = baseX + Math.cos(bladeAngle) * len + sway;
        const tipY = baseY + Math.sin(bladeAngle) * len;
        g.strokeStyle = boss.phase2
          ? (i % 2 === 0 ? '#9a8a3a' : '#b4a24a')
          : (i % 2 === 0 ? '#3a7a2a' : '#4c9436');
        g.lineWidth = Math.max(1, radius * 0.045);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(baseX, baseY);
        g.quadraticCurveTo((baseX + tipX) / 2 + sway * 0.4, (baseY + tipY) / 2, tipX, tipY);
        g.stroke();
      }
    }
  }
  function drawMushroomCap(g, radius, now) {
    // While the lights are out (stalk walk), the cap flashes pitch black
    // to neon green every 2 seconds instead of its usual color -- the
    // one thing still visible in the dark.
    const flashing = boss.phase === 'stalkwalk' && boss.stalkSubPhase === 'walking';
    const flashOn = flashing && Math.floor((now - boss.stalkStartedAt) / STALKWALK_FLASH_PERIOD_MS) % 2 === 0;
    const capColor = flashing ? (flashOn ? '#3dff7a' : '#050806') : '#c94a6a';
    g.save();
    g.translate(0, -radius * 1.15);
    g.strokeStyle = '#d9d2c0';
    g.lineWidth = radius * 0.18;
    g.beginPath();
    g.moveTo(0, radius * 0.1); g.lineTo(0, -radius * 0.25);
    g.stroke();
    g.beginPath();
    g.ellipse(0, -radius * 0.32, radius * 0.5, radius * 0.32, 0, Math.PI, 0);
    g.fillStyle = capColor;
    if (flashOn) { g.shadowColor = capColor; g.shadowBlur = 18; }
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.5)';
    [[-0.2, -0.1], [0.15, -0.2], [0.3, 0]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(dx * radius, -radius * 0.32 + dy * radius, radius * 0.06, 0, Math.PI * 2);
      g.fill();
    });
    g.restore();
  }
  function drawBossEye(g, radius) {
    const er = radius * 0.22;
    g.save();
    g.shadowColor = boss.phase2 ? '#ff3b3b' : '#4ab0ff';
    g.shadowBlur = 10;
    g.beginPath();
    g.arc(0, -radius * 0.05, er, 0, Math.PI * 2);
    g.fillStyle = boss.phase2 ? '#ff3b3b' : '#4ab0ff';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(0, -radius * 0.05, er * 0.4, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();
    g.restore();
  }
  // A round riveted hull instead of a squared-off panel block -- a
  // domed radial gradient for volume, a couple of latitude rings and a
  // handful of radial seams standing in for the old 3x3 grid, rust
  // streaks still following the rim once it's rusting.
  function drawCultivatorBody(g, radius, now) {
    g.save();
    const bodyColor = boss.phase2 ? '#6a5240' : '#4a5248';
    const rimColor = boss.phase2 ? '#8a3a2a' : '#2a3a2a';
    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius * 1.05);
    grad.addColorStop(0, shade(bodyColor, 0.22));
    grad.addColorStop(0.6, bodyColor);
    grad.addColorStop(1, shade(bodyColor, -0.3));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rimColor;
    g.lineWidth = 3;
    g.stroke();

    // latitude rings + radial seams, clipped to the hull
    g.save();
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    [0.4, 0.75].forEach((f) => {
      g.beginPath();
      g.arc(0, 0, radius * f, 0, Math.PI * 2);
      g.stroke();
    });
    const seams = 8;
    for (let i = 0; i < seams; i++) {
      const a = (i / seams) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      g.stroke();
    }
    // rivets along the rim
    g.fillStyle = 'rgba(0,0,0,0.4)';
    const rivets = 10;
    for (let i = 0; i < rivets; i++) {
      const a = (i / rivets) * Math.PI * 2 + 0.3;
      g.beginPath();
      g.arc(Math.cos(a) * radius * 0.92, Math.sin(a) * radius * 0.92, radius * 0.035, 0, Math.PI * 2);
      g.fill();
    }
    if (boss.phase2) {
      // rust streaks
      g.strokeStyle = 'rgba(140,60,20,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.7;
        g.beginPath();
        g.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
        g.lineTo(Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3 + radius * 0.3);
        g.stroke();
      }
    }
    g.restore();
    g.restore();
  }
  // A proper two-segment jointed arm (shoulder->elbow->hand) instead of
  // one straight tapered line, extending further during the mycelium
  // attack same as before. side=-1 is the left arm (a simple claw); the
  // right arm (side=1) ends in a magnet head instead -- see
  // updateMagnetPull for what it actually does.
  function drawRoboticArm(g, side, isMagnet, now) {
    const extended = boss.phase === 'mycelium';
    const reach = extended ? boss.radius * 1.9 : boss.radius * 0.55;
    const shoulderX = side * boss.radius * 0.95, shoulderY = boss.radius * 0.1;
    const elbowX = shoulderX + side * reach * 0.5, elbowY = shoulderY + reach * 0.35;
    const handX = elbowX + side * reach * 0.5, handY = elbowY + reach * 0.45;
    const armColor = boss.phase2 ? '#7a4a30' : '#525a4e';

    g.save();
    g.strokeStyle = armColor;
    g.lineWidth = boss.radius * 0.2;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(shoulderX, shoulderY); g.lineTo(elbowX, elbowY); g.stroke();

    g.beginPath();
    g.arc(elbowX, elbowY, boss.radius * 0.11, 0, Math.PI * 2);
    g.fillStyle = shade(armColor, -0.2);
    g.fill();

    g.lineWidth = boss.radius * 0.16;
    g.beginPath(); g.moveTo(elbowX, elbowY); g.lineTo(handX, handY); g.stroke();

    const handAngle = Math.atan2(handY - elbowY, handX - elbowX);
    g.translate(handX, handY);
    g.rotate(handAngle);

    if (isMagnet) {
      const magnetActive = now < boss.magnetActiveUntil;
      g.strokeStyle = '#8a3a3a';
      g.lineWidth = boss.radius * 0.1;
      g.beginPath();
      g.arc(0, 0, boss.radius * 0.18, Math.PI * 0.25, Math.PI * 1.75);
      g.stroke();
      g.fillStyle = '#d94a3a';
      g.beginPath(); g.arc(boss.radius * 0.17, -boss.radius * 0.12, boss.radius * 0.065, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a6ad9';
      g.beginPath(); g.arc(boss.radius * 0.17, boss.radius * 0.12, boss.radius * 0.065, 0, Math.PI * 2); g.fill();
      if (magnetActive) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
        g.beginPath();
        g.arc(boss.radius * 0.08, 0, boss.radius * 0.4 + pulse * boss.radius * 0.18, 0, Math.PI * 2);
        g.strokeStyle = `rgba(217,74,58,${0.45 * pulse})`;
        g.lineWidth = 2;
        g.stroke();
      }
    } else {
      g.fillStyle = shade(armColor, -0.1);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(boss.radius * 0.24, -boss.radius * 0.13);
      g.lineTo(boss.radius * 0.17, 0);
      g.lineTo(boss.radius * 0.24, boss.radius * 0.13);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // 5. Magnet pull: locks onto whoever's nearest and hauls them straight
  // toward it at 0.8x player speed for 7 seconds -- the magnet arm's
  // real attack, not just a flourish. Touching the boss while it's
  // reeling you in is lethal same as any other contact (updateCatch
  // doesn't exclude this phase), so the whole point is fighting the pull
  // or breaking line of sight, not just waiting it out.
  const MAGNETPULL_DURATION_MS = 7000;
  const MAGNETPULL_SPEED = PLAYER_SPEED * 0.8;
  function updateMagnetPullAttack(now, dt) {
    const target = boss.magnetPullTarget;
    if (target && !target.caught) {
      const dx = boss.x - target.x, dy = boss.y - target.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) movePlayer(target, (dx / d) * MAGNETPULL_SPEED * dt, (dy / d) * MAGNETPULL_SPEED * dt);
    }
    if (now >= boss.magnetPullUntil) finishAttack(now);
  }

  function drawBoss(g, t) {
    if (boss.defeated && gameState !== 'dying') return;
    g.save();
    g.translate(boss.x, boss.y);

    if (gameState === 'dying') {
      const dt2 = t - deathStartedAt;
      if (dt2 < DEATH_STUMBLE_MS) {
        const back = Math.sin(clamp(dt2 / DEATH_STUMBLE_MS, 0, 1) * Math.PI) * 14;
        g.translate(-boss.lookDir.x * back, -boss.lookDir.y * back);
        g.rotate(Math.sin(dt2 * 0.02) * 0.1);
      } else {
        const ft = clamp((dt2 - DEATH_STUMBLE_MS) / DEATH_FALL_MS, 0, 1);
        g.globalAlpha = 1 - ft;
        g.scale(1 - ft * 0.4, 1 - ft * 0.4);
        g.rotate(ft * 1.4);
      }
    }

    drawRoboticArm(g, -1, false, t);
    drawRoboticArm(g, 1, true, t);
    drawCultivatorBody(g, boss.radius, t);
    drawRobotGears(g, boss.radius, boss.seed);
    drawCultivatorGrass(g, boss.radius, boss.seed, t);
    drawBossEye(g, boss.radius);
    drawMushroomCap(g, boss.radius, t);

    if (boss.phase === 'sporebloom' && boss.sporeSubPhase === 'windup') {
      const shake = Math.sin(t * 0.05) * 4;
      g.translate(0, -boss.radius * 1.3);
      g.rotate(shake * 0.05);
      g.translate(0, boss.radius * 1.3);
    }
    if (boss.phase === 'firebreath' && boss.fireSubPhase === 'windup') {
      g.beginPath();
      g.arc(boss.fireDir.x * boss.radius, boss.fireDir.y * boss.radius, 6, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,140,40,0.8)';
      g.shadowColor = '#ff8a2a'; g.shadowBlur = 10;
      g.fill(); g.shadowBlur = 0;
    }

    if (t < boss.frozenUntil) {
      const points = 14;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2, r = boss.radius + 6;
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

  function drawGearsProjectiles(g) {
    gears.forEach((gp) => {
      g.save();
      g.translate(gp.x, gp.y);
      g.rotate(performance.now() * 0.01);
      const teeth = 8, gr = 10;
      g.beginPath();
      for (let j = 0; j < teeth; j++) {
        const a0 = (j / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / teeth) * 0.5;
        g.moveTo(Math.cos(a0) * gr, Math.sin(a0) * gr);
        g.lineTo(Math.cos(a0) * (gr * 1.4), Math.sin(a0) * (gr * 1.4));
        g.lineTo(Math.cos(a1) * (gr * 1.4), Math.sin(a1) * (gr * 1.4));
        g.lineTo(Math.cos(a1) * gr, Math.sin(a1) * gr);
      }
      g.closePath();
      g.fillStyle = '#9a9a8c';
      g.fill();
      g.strokeStyle = '#4a4a40';
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    });
  }
  function drawSpores(g, now) {
    spores.forEach((s) => {
      if (s.exploded) return;
      g.save();
      g.translate(s.x, s.y);
      if (!s.landedAt) {
        g.beginPath();
        g.arc(0, 0, 4, 0, Math.PI * 2);
        g.fillStyle = 'rgba(180,230,120,0.85)';
        g.shadowColor = '#b4e678'; g.shadowBlur = 6;
        g.fill(); g.shadowBlur = 0;
      } else {
        const growT = clamp((now - s.landedAt) / SPORE_FUSE_MS, 0, 1);
        const r = 4 + growT * 10;
        g.strokeStyle = '#d9d2c0'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, 2); g.lineTo(0, -r * 0.4); g.stroke();
        g.beginPath();
        g.ellipse(0, -r * 0.5, r, r * 0.6, 0, Math.PI, 0);
        g.fillStyle = growT > 0.75 ? `rgba(255,${100 - growT * 40},80,0.9)` : '#c94a6a';
        g.fill();
      }
      g.restore();
    });
  }
  function drawRockets(g) {
    rockets.forEach((r) => {
      const angle = Math.atan2(r.dy, r.dx);
      g.save();
      g.translate(r.x, r.y);
      g.rotate(angle);
      g.fillStyle = 'rgba(255,140,40,0.5)';
      g.beginPath(); g.moveTo(-12, -2); g.lineTo(-19, 0); g.lineTo(-12, 2); g.closePath(); g.fill();
      g.fillStyle = '#6a6a5e';
      g.fillRect(-5, -3, 11, 6);
      g.beginPath(); g.arc(7, 0, 3, 0, Math.PI * 2);
      g.fillStyle = '#ffcf5c'; g.shadowColor = '#ffcf5c'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0;
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
  function drawMyceliumArms(g) {
    myceliumArms.forEach((arm) => {
      g.save();
      g.translate(arm.x, arm.y);
      g.beginPath();
      g.arc(0, 0, 13, 0, Math.PI * 2);
      g.fillStyle = '#4a3a28';
      g.fill();
      g.strokeStyle = '#8a6a3a';
      g.lineWidth = 2;
      g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
        g.strokeStyle = '#6a5230';
        g.lineWidth = 2;
        g.stroke();
      }
      g.restore();
    });
  }
  function drawFireBreath(g, now) {
    if (boss.phase !== 'firebreath' || boss.fireSubPhase !== 'active') return;
    const steps = 10;
    g.save();
    g.translate(boss.x, boss.y);
    g.rotate(Math.atan2(boss.fireDir.y, boss.fireDir.x));
    const flick = 0.85 + 0.15 * Math.sin(now * 0.03);
    const grad = g.createLinearGradient(0, 0, FIREBREATH_RANGE, 0);
    grad.addColorStop(0, 'rgba(255,220,120,0.9)');
    grad.addColorStop(0.5, 'rgba(255,120,40,0.75)');
    grad.addColorStop(1, 'rgba(200,40,20,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, -FIREBREATH_HALF_WIDTH * 0.2);
    g.lineTo(FIREBREATH_RANGE * flick, -FIREBREATH_HALF_WIDTH);
    g.lineTo(FIREBREATH_RANGE * flick, FIREBREATH_HALF_WIDTH);
    g.lineTo(0, FIREBREATH_HALF_WIDTH * 0.2);
    g.closePath();
    g.fill();
    g.restore();
  }

  function punchLight(g, x, y, radius, intensity) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function buildDarknessMask(camX, camY, zoom, now) {
    const worldToScreen = (wx, wy) => ({ x: (wx - camX) * zoom + VIEW_W / 2, y: (wy - camY) * zoom + VIEW_H / 2 });
    const nvgMult = now < nvgUntil ? NVG_RANGE_MULT : 1;
    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    const stalking = boss.phase === 'stalkwalk' && boss.stalkSubPhase === 'walking';
    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      if (stalking) {
        punchLight(maskCtx, s.x, s.y, STALKWALK_LIGHT_RADIUS * zoom, 1);
      } else {
        punchLight(maskCtx, s.x, s.y, 150 * zoom * nvgMult * HM.flicker(pl), 1);
        punchLight(maskCtx, s.x, s.y, 340 * zoom * nvgMult * HM.flicker(pl), 0.85);
      }
    });
    if (!stalking) {
      const bs = worldToScreen(boss.x, boss.y);
      punchLight(maskCtx, bs.x, bs.y, boss.radius * 2.4 * zoom, 0.5);
      if (!(boss.phase === 'stalkwalk')) {
        (LEVEL.windows || []).forEach((w) => {
          const vec = WINDOW_DIR_VEC[w.dir] || WINDOW_DIR_VEC.S;
          const wx = w.x * TILE + TILE / 2 + vec.x * TILE, wy = w.y * TILE + TILE / 2 + vec.y * TILE;
          const s2 = worldToScreen(wx, wy);
          punchLight(maskCtx, s2.x, s2.y, 110 * zoom, 0.9);
        });
      }
    }
  }

  function drawBossIntroOverlay(vx, now) {
    const t = clamp((now - introStartedAt) / BOSS_INTRO_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 34, VIEW_W, 68);
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(90,200,90,${alpha})`;
    ctx.shadowColor = 'rgba(90,200,90,0.8)';
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
    ctx.font = 'bold 24px monospace';
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

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const intro = gameState === 'intro';
    const phase2Intro = gameState === 'phase2intro';
    const cutscene = intro || phase2Intro;
    const zoom = cutscene ? ZOOM * BOSS_INTRO_ZOOM_MULT : ZOOM;
    const halfW = visibleHalfW(), halfH = visibleHalfH();
    const camX = cutscene ? boss.x : clamp(p.x, halfW, WORLD_W - halfW);
    const camY = cutscene ? boss.y : clamp(p.y, halfH, WORLD_H - halfH);
    const shakeX = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;
    const shakeY = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;

    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#05080a'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, now);
    drawSmokeBombs(ctx, now);
    drawCrates(ctx);
    drawMyceliumArms(ctx);
    drawGearsProjectiles(ctx);
    drawSpores(ctx, now);
    drawRockets(ctx);
    drawFireBreath(ctx, now);
    drawBoss(ctx, now);
    drawExplosions(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    drawBloodSplatters(ctx);
    drawFloatingTexts(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY, zoom, now);
    ctx.drawImage(maskCanvas, vx, 0);

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    if (intro) {
      drawBossIntroOverlay(vx, now);
    } else if (phase2Intro) {
      drawPhase2IntroOverlay(vx, now);
    } else {
      drawBossHealthBar(vx, now);
      drawProximityWarning(vx, Math.hypot(p.x - boss.x, p.y - boss.y), now);
      drawRadar(vx, p, now);
      drawScanner(vx, p, now);
      drawShotgunHud(vx, p);
      drawCoalHud(vx, p);
      const minimapH = drawMinimap(vx, now);
      drawStaminaBar(vx, p, minimapH);
      if (p.caught) drawCutsceneOverlay(vx, p, now);
    }
    ctx.restore();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'dying') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE CULTIVATOR TUMBLES OUT THE WINDOW&hellip;';
    } else {
      messageEl.style.display = 'none';
    }
  }
  function updateHud() {
    const hp = `${bossHealth}/${BOSS_MAX_HEALTH}`;
    if (hudBossEl) {
      hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : `Boss: ${hp} HP`;
      hudBossEl.classList.toggle('done', boss.defeated);
    }
    if (hudPhaseEl) {
      hudPhaseEl.textContent = boss.phase2 ? 'Phase: 2 — RUSTING' : 'Phase: 1';
      hudPhaseEl.classList.toggle('done', boss.phase2);
    }
    if (hudCoalEl) {
      const liveCoal = coalPiles.filter((c) => c.live).length;
      hudCoalEl.textContent = boss.defeated ? 'Coal: --' : `Coal: ${liveCoal} on the field`;
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
        updateCoalPiles(now);
        updateFurnace(now);
        updateBoss(now, dt);
        updateGears(now, dt);
        updateSpores(now, dt);
        updateRockets(now, dt);
        updateShotgunDefense(now);
        updateCatch(now);
        updateCutscenes(now);
        updateExploration();
        updateAmbientTension();
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
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
