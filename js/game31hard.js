// Level 31 on hard mode: instead of the Multipod chase, the way out is blocked by
// the Being of Pure Chaos, on the rooftop landing pad from Level 30 (same 35x21
// arena, same auto-firing missile rig) -- 1000 HP, hundreds of eyes, skin and
// wings stitched from the textures of the whole game, only hurt by antimatter
// missiles (50 damage, one touches down every 10 seconds, at most 3 waiting).
// level31.html sends hard-mode runs to level31hard.html, which loads this.
(function () {
  const HM = window.HardMode;
  if (!HM.on) { window.location.replace('level31.html'); return; }
  const FOOT_SURFACE = 'normal'; // which footstep sound to use (js/footsteps.js)
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(31)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL30;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;

  // Same trick every boss level uses: ZOOM is picked so the visible half
  // width/height both exceed half the arena's own size, so the camera
  // clamp in renderViewport collapses to a fixed center point instead of
  // following either player -- the whole landing pad reads as one
  // screen. Same proven 35x21 @ 32px footprint as Level 15/25.
  const ZOOM = 0.42;
  function visibleHalfW() { return (VIEW_W / 2) / ZOOM; }
  function visibleHalfH() { return (VIEW_H / 2) / ZOOM; }

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss: 3x the usual family radius, a body stitched from textures and
  // covered in eyes.
  const BOSS_RADIUS = 28 * 3;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.1;
  const BOSS_SPIN_CATCH_RADIUS = BOSS_CATCH_RADIUS * 1.3;
  const BOSS_NAME = 'THE BEING OF PURE CHAOS';

  // no film for this one: a zoom in on it and its name card (Enter skips)
  const BOSS_INTRO_CUTSCENE_MS = 3600;
  const BOSS_INTRO_ZOOM_MULT = 1.7;
  const BOSS_INTRO_SHAKE_MAG = 7;
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_IDLE_SPEED = HM.speed(PLAYER_SPEED * 0.3);
  const BOSS_IDLE_MIN_MS = 900;
  const BOSS_IDLE_MAX_MS = 1700;

  const BOSS_MAX_HEALTH = 1000;
  const PHASE2_HEALTH_THRESHOLD = 500;
  const PHASE2_CUTSCENE_MS = 3000;
  const PHASE2_NAME_COLOR = '#ff3d6a';
  const PHASE2_SUBTITLE = 'CHAOS UNBOUND';
  const PHASE2_SPEED_MULT = 1.2;
  // in phase 2 the boss re-rolls every texture on it this often, and the sky flashes with them
  const RETEXTURE_MS = 1000;
  const SKY_FLASH_MS = 150;

  // Arena floor bounds (world px) -- the ring of '#' tiles around the
  // edge renders as open sunrise sky but still blocks movement, so these
  // are the real playable box the boss's charge/reposition/divebomb
  // attacks are clamped and randomized within.
  const ARENA_MIN_X = TILE, ARENA_MAX_X = (COLS - 1) * TILE;
  const ARENA_MIN_Y = TILE, ARENA_MAX_Y = (ROWS - 1) * TILE;

  // 1. Charge: wings fold back, it points in a random direction, then
  // barrels that way until it slams into the pad's own edge.
  const CHARGE_TELEGRAPH_MS = 700;
  const CHARGE_SPEED = HM.speed(PLAYER_SPEED * 2.5);
  const CHARGE_IMPACT_MS = 500;

  // 2. Reposition & spin: glides to a random spot over 2s, then spins
  // with its claws out for 5s straight, caroming around the pad off its
  // own edges at 1.5x player speed the whole time instead of holding
  // still.
  const REPOSITION_MS = 2000;
  const SPIN_MS = 5000;
  const SPIN_MOVE_SPEED = HM.speed(PLAYER_SPEED * 1.5);

  // 3. Feather fling: a stationary volley of razor feathers at whoever's
  // closest, flung at 6x player speed.
  const FEATHER_COUNT = 5;
  const FEATHER_INTERVAL_MS = 650;
  const FEATHER_SPEED = HM.proj(PLAYER_SPEED * 6);
  const FEATHER_HIT_RADIUS = 15;

  // 4. Dive bomb: launches off screen, a shadow its own size appears
  // somewhere on the pad, then it drops onto that exact spot.
  const DIVEBOMB_RISE_MS = 800;
  const DIVEBOMB_SHADOW_MS = 1200;
  const DIVEBOMB_SPEED = PLAYER_SPEED * 3;
  // 10 tiles trimmed 15% (direct request): 8.5 tiles.
  const DIVEBOMB_IMPACT_RADIUS = TILE * 10 * 0.85;
  const DIVEBLAST_EXPAND_MS = 420;

  // Phase 2, gained in addition to the four above once it's in Primal
  // Form.
  // 5. Antimatter barrage: a bolt at whoever's closest once a second for
  // 5 seconds straight.
  const ANTIMATTER_COUNT = 5;
  const ANTIMATTER_INTERVAL_MS = 1000;
  const ANTIMATTER_SPEED = HM.proj(PLAYER_SPEED * 2.5);
  const ANTIMATTER_HIT_RADIUS = 16;

  // 6. Shockwave: curls into a ball, then snaps open and sends a ring
  // out to 5 tiles in every direction.
  const CURL_WINDUP_MS = 1000;
  const SHOCKWAVE_EXPAND_MS = 700;
  const SHOCKWAVE_MAX_RADIUS = TILE * 5;

  // Antimatter missiles: the only way to actually hurt this boss. One
  // touches down on a random pad tile every 10s (the first the moment the
  // fight starts) and no more than 3 wait on the pad at once; walking into
  // one fires it automatically, and it homes in on the boss at 5x player
  // speed for 50 damage.
  const MISSILE_SPAWN_INTERVAL_MS = 10000;
  const MAX_MISSILES_ON_FIELD = 3;
  const MISSILE_PICKUP_RADIUS = 20;
  const MISSILE_SPEED = HM.proj(PLAYER_SPEED * 5);
  const MISSILE_DAMAGE = 50;
  const MISSILE_HIT_RADIUS = BOSS_RADIUS * 0.6;

  // Death: it falls forward onto whoever's nearest and drags them down
  // with it before the level hands off.
  const DEATH_FALL_MS = 900;
  const DEATH_DRAG_MS = 1400;

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

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

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
        audioCtx, dest: musicMasterGain, theme: 'chaos',
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
  function invertHex(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = 255 - ((n >> 16) & 255), g2 = 255 - ((n >> 8) & 255), b = 255 - (n & 255);
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g2)}${toHex(b)}`;
  }
  function bossColor(hex) { return hex; }

  // ---- textures borrowed from all over the game ----
  // Each is a small tile drawn in code from the palette of the place it came
  // from; the boss's skin and wings are stitched from them, the pad's floor
  // is patched with them, and in phase 2 they flash across the sky.
  const TAU = Math.PI * 2;
  const TEX = 64;
  function texRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const TEXTURE_MAKERS = [
    (g, r) => { // grass (the lot and the forest)
      g.fillStyle = '#5f9a3e'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 90; i++) { g.strokeStyle = pick(r, ['#72b04e', '#4f8a35', '#80bc58', '#3f7a2c']); g.lineWidth = 1.2; const x = r() * TEX, y = r() * TEX; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 4); g.stroke(); }
    },
    (g, r) => { // asphalt with lane paint (Level 31's road)
      g.fillStyle = '#50535a'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 140; i++) { g.fillStyle = pick(r, ['#63666d', '#44464c', '#6e7178']); g.fillRect(r() * TEX, r() * TEX, 1.5, 1.5); }
      g.fillStyle = '#e8c23d'; g.fillRect(0, 30, 30, 4);
    },
    (g, r) => { // brick (the facility)
      g.fillStyle = '#d2c2a8'; g.fillRect(0, 0, TEX, TEX);
      for (let row = 0; row < 4; row++) for (let c = -1; c < 3; c++) { g.fillStyle = pick(r, ['#9a4a36', '#8a3f2e', '#a85440', '#7e382a']); g.fillRect(c * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14); }
    },
    (g, r) => { // water (the flooded levels)
      g.fillStyle = '#2f78b8'; g.fillRect(0, 0, TEX, TEX);
      for (let k = 0; k < 9; k++) { g.strokeStyle = pick(r, ['#6fb3e6', '#8cc8f0', '#1f5f9a']); g.lineWidth = 1.5; g.beginPath(); const y0 = k * 8 + r() * 4; for (let x = 0; x <= TEX; x += 4) g.lineTo(x, y0 + Math.sin(x * 0.3 + k) * 2); g.stroke(); }
    },
    (g, r) => { // ice (the frozen levels)
      g.fillStyle = '#cdeaf6'; g.fillRect(0, 0, TEX, TEX);
      for (let k = 0; k < 10; k++) { g.strokeStyle = pick(r, ['#ffffff', '#8fc4dc', '#a8d8ea']); g.lineWidth = 1; g.beginPath(); let x = r() * TEX, y = r() * TEX; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 24; y += (r() - 0.5) * 24; g.lineTo(x, y); } g.stroke(); }
    },
    (g, r) => { // lava and embers (the Ashen One's, the pumpkin's)
      g.fillStyle = '#32100a'; g.fillRect(0, 0, TEX, TEX);
      for (let k = 0; k < 8; k++) { const x = r() * TEX, y = r() * TEX, rad = 6 + r() * 10; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, '#ffd23d'); gr.addColorStop(0.5, '#ff6a14'); gr.addColorStop(1, 'rgba(50,16,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
    },
    (g, r) => { // wood planks (crates, the mine)
      for (let p = 0; p < 4; p++) { g.fillStyle = pick(r, ['#8a5e34', '#7a5230', '#946a3c']); g.fillRect(0, p * 16, TEX, 16); g.strokeStyle = 'rgba(40,24,10,0.5)'; g.strokeRect(0.5, p * 16 + 0.5, TEX - 1, 15); for (let k = 0; k < 4; k++) { g.beginPath(); const y = p * 16 + 3 + r() * 10; g.moveTo(0, y); g.lineTo(TEX, y + (r() - 0.5) * 3); g.stroke(); } g.fillStyle = '#3a2a18'; g.fillRect(4, p * 16 + 7, 2, 2); g.fillRect(TEX - 6, p * 16 + 7, 2, 2); }
    },
    (g, r) => { // cobblestone (the castle)
      g.fillStyle = '#2c2c30'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 16; i++) { g.fillStyle = pick(r, ['#5a5a60', '#6a6a70', '#4c4c52', '#76767c']); g.beginPath(); g.ellipse((i % 4) * 16 + 8 + (r() - 0.5) * 3, Math.floor(i / 4) * 16 + 8 + (r() - 0.5) * 3, 7 + r() * 1.5, 6 + r() * 1.5, r(), 0, TAU); g.fill(); }
    },
    (g, r) => { // metal grate (the vents, the chain levels)
      g.fillStyle = '#0c0d10'; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = '#6c727c'; g.lineWidth = 3; for (let k = 0; k <= TEX; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, TEX); g.moveTo(0, k); g.lineTo(TEX, k); g.stroke(); }
      g.fillStyle = '#9aa2ae'; for (let x = 0; x < TEX; x += 16) for (let y = 0; y < TEX; y += 16) g.fillRect(x, y, 2, 2);
    },
    (g, r) => { // sand and dirt
      g.fillStyle = '#d8bb78'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 200; i++) { g.fillStyle = pick(r, ['#c4a35e', '#ecd592', '#b8964e']); g.fillRect(r() * TEX, r() * TEX, 1.5, 1.5); }
    },
    (g, r) => { // flesh (the mutations)
      g.fillStyle = '#8c3c48'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 10; i++) { g.fillStyle = pick(r, ['#a84e5a', '#6a2430', '#b85e6a']); g.beginPath(); g.ellipse(r() * TEX, r() * TEX, 5 + r() * 9, 4 + r() * 7, r() * 3, 0, TAU); g.fill(); }
      g.strokeStyle = '#4a1018'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r() * TEX, r() * TEX); g.bezierCurveTo(r() * TEX, r() * TEX, r() * TEX, r() * TEX, r() * TEX, r() * TEX); g.stroke(); }
    },
    (g, r) => { // circuit board (the labs)
      g.fillStyle = '#0c3326'; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = '#2fd39a'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { let x = Math.floor(r() * 8) * 8, y = Math.floor(r() * 8) * 8; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 3; j++) { if (r() < 0.5) x = Math.floor(r() * 8) * 8; else y = Math.floor(r() * 8) * 8; g.lineTo(x, y); } g.stroke(); g.fillStyle = '#7af0c0'; g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
    },
    (g, r) => { // hazard stripes
      g.fillStyle = '#16161a'; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = '#e8c23d'; for (let k = -TEX; k < TEX * 2; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 8, 0); g.lineTo(k + 8 + TEX, TEX); g.lineTo(k + TEX, TEX); g.closePath(); g.fill(); }
    },
    (g, r) => { // bark (the forest)
      g.fillStyle = '#4a3322'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 26; i++) { g.strokeStyle = pick(r, ['#3a2818', '#5e4430', '#2e2012']); g.lineWidth = 1 + r() * 2; const x = r() * TEX; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, TEX); g.stroke(); }
      g.fillStyle = '#2a1c10'; g.beginPath(); g.ellipse(20, 40, 5, 8, 0, 0, TAU); g.fill();
    },
    (g, r) => { // checker tile (the lobby)
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#33353a' : '#e6e0d2'; g.fillRect(x * 16, y * 16, 16, 16); }
    },
    (g, r) => { // moss on stone (the cistern, the garden)
      g.fillStyle = '#566b52'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 18; i++) { g.fillStyle = pick(r, ['#6f8a5a', '#3f5440', '#7f9a66']); g.beginPath(); g.arc(r() * TEX, r() * TEX, 3 + r() * 7, 0, TAU); g.fill(); }
    },
    (g, r) => { // ore (the mine)
      g.fillStyle = '#3a3138'; g.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 12; i++) { g.fillStyle = pick(r, ['#2a2229', '#4a3f48', '#524852']); g.beginPath(); g.arc(r() * TEX, r() * TEX, 4 + r() * 8, 0, TAU); g.fill(); }
      for (let i = 0; i < 9; i++) { g.fillStyle = pick(r, ['#ffd24a', '#6ab0ff', '#ffe8a0']); const x = r() * TEX, y = r() * TEX; g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.closePath(); g.fill(); }
    },
    (g, r) => { // red carpet (the Last Knight's throne room)
      g.fillStyle = '#8a1620'; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = '#d8b04a'; g.lineWidth = 3; g.strokeRect(3, 3, TEX - 6, TEX - 6);
      g.lineWidth = 2; g.beginPath(); g.moveTo(32, 12); g.lineTo(52, 32); g.lineTo(32, 52); g.lineTo(12, 32); g.closePath(); g.stroke();
    },
    (g, r) => { // static
      const img = g.createImageData(TEX, TEX);
      for (let i = 0; i < TEX * TEX; i++) { const v = 40 + Math.floor(r() * 200); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
    },
    (g, r) => { // scales (the gargoyles')
      g.fillStyle = '#5a5e64'; g.fillRect(0, 0, TEX, TEX);
      for (let row = 0; row < 8; row++) for (let c = -1; c < 8; c++) { g.strokeStyle = '#2e3034'; g.lineWidth = 1.2; g.beginPath(); g.arc(c * 8 + (row % 2) * 4, row * 8 + 4, 5, 0, Math.PI); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(c * 8 + (row % 2) * 4, row * 8 + 3, 4, 0.2, Math.PI - 0.2); g.stroke(); }
    },
  ];
  const TEXTURES = TEXTURE_MAKERS.map((make, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    make(c.getContext('2d'), texRng(1000 + i * 77));
    return c;
  });
  const PATTERNS = TEXTURES.map((c) => ctx.createPattern(c, 'repeat'));
  const NTEX = TEXTURES.length;
  function hash3(x, y, k) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k, 2246822519);
    return ((h ^ (h >>> 13)) >>> 0);
  }

  // ---- the helipad floor: bare concrete/asphalt, but patched here and there
  // (3x2-tile patches) with a random texture from the game
  const PAD_SHADES = ['#3a3a3e', '#404044', '#363638', '#3e3e42', '#383840'];
  function padShade(x, y) {
    return PAD_SHADES[hash3(x, y, 0) % PAD_SHADES.length];
  }
  function floorTextureFor(x, y) {
    const h = hash3(Math.floor(x / 3), Math.floor(y / 2), 5);
    return h % 100 < 40 ? (h >> 8) % NTEX : -1;
  }

  // The sky beyond the pad's own edge -- a sunrise gradient computed
  // smoothly from each tile's height, and drawn well past the pad on every
  // side (the camera sees far more than the pad).
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
  const SKY_PAD_X = 22, SKY_PAD_Y = 8;
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = (COLS + SKY_PAD_X * 2) * TILE; skyCanvas.height = (ROWS + SKY_PAD_Y * 2) * TILE;
  (function () {
    const sg = skyCanvas.getContext('2d');
    for (let y = -SKY_PAD_Y; y < ROWS + SKY_PAD_Y; y++) for (let x = -SKY_PAD_X; x < COLS + SKY_PAD_X; x++) drawVoidTile(sg, (x + SKY_PAD_X) * TILE, (y + SKY_PAD_Y) * TILE, x, y);
  }());
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = WORLD_W; floorCanvas.height = WORLD_H;
  (function () {
    const fg = floorCanvas.getContext('2d');
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (LEVEL.grid[y][x] === '#') continue;
      const px = x * TILE, py = y * TILE, tex = floorTextureFor(x, y);
      fg.fillStyle = padShade(x, y); fg.fillRect(px, py, TILE, TILE);
      if (tex >= 0) {
        fg.fillStyle = PATTERNS[tex]; fg.fillRect(px, py, TILE, TILE);
        fg.fillStyle = 'rgba(0,0,0,0.2)'; fg.fillRect(px, py, TILE, TILE);   // knocked back, so the paint and the H still read
      }
    }
  }());

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

  function isHidden(p, now) {
    return smokeBombs.some((b) => b.exploded && now < b.endsAt && Math.hypot(p.x - b.x, p.y - b.y) < SMOKE_RADIUS);
  }

  function formatTime(ms) {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }

  const BEST_TIME_KEY = 'goofy-horror-best-level31-chaos';
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
  // The boss's clock: how fast it moves and attacks (and how fast what it throws flies). It runs at BOSS_TEMPO
  // times the base speeds the whole fight; frozen slows it, phase 2 speeds it up further.
  const BOSS_TEMPO = 2;
  function speedMult(now) { return BOSS_TEMPO * (now < boss.frozenUntil ? FROZEN_SPEED_MULT : 1) * (boss.phase2 ? PHASE2_SPEED_MULT : 1); }

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
      bodyTex: [], wingTex: [], legTex: 0, texChangedAt: 0,

      phase: 'idle', // 'idle' | 'charge' | 'reposition' | 'featherfling' | 'divebomb' | 'antimatter' | 'curlshockwave'
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      lastAttack: null,

      // charge
      chargeDir: { x: 1, y: 0 },
      chargeHitWallAt: 0,

      // reposition & spin
      repoSubPhase: 'moving', // 'moving' | 'spinning'
      repoStartX: 0, repoStartY: 0, repoTargetX: 0, repoTargetY: 0,
      spinDir: { x: 1, y: 0 },

      // feather fling
      feathersThrown: 0,
      nextFeatherAt: 0,

      // dive bomb
      diveSubPhase: 'rising', // 'rising' | 'shadow' | 'diving'
      diveShadowX: 0, diveShadowY: 0,
      diveFromX: 0, diveFromY: 0,

      // antimatter barrage
      antimatterThrown: 0,
      nextAntimatterAt: 0,

      // curl & shockwave
      curlSubPhase: 'curling', // 'curling' | 'shockwave'
      shockwaveStartedAt: 0,
      shockwaveHit: null, // Set of players already caught by this ring
    };
  }
  const boss = makeBoss();
  const WING_SECTIONS = 3, BODY_SECTORS = 7;
  function rerollBossTextures(now) {
    boss.texChangedAt = now;
    const rt = () => Math.floor(Math.random() * NTEX);
    boss.bodyTex = Array.from({ length: BODY_SECTORS }, rt);
    boss.wingTex = Array.from({ length: WING_SECTIONS * 2 }, rt);
    boss.legTex = rt();
  }

  let missilePickups = []; // { x, y }
  let missileProjectiles = []; // { x, y }
  let nextMissileSpawnAt = 0;
  let feathers = []; // { x, y, vx, vy }
  let antimatterBolts = []; // { x, y, vx, vy }
  let diveBlast = null; // { x, y, t0, hit: Set } -- the expanding dive-bomb shockwave
  let explosions = [];
  let particles = [];
  let bloodSplatters = [];
  let floatingTexts = [];

  function spawnExplosion(x, y, kind) {
    explosions.push({ x, y, startedAt: performance.now(), kind: kind || 'fire' });
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
      // the straight-line charge is this boss's own stalkwalk-equivalent.
      if (boss.phase !== 'charge') return;
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
      g.fillStyle = `rgba(160,15,20,${alpha})`;
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
    });

    const spawn = LEVEL.monsterSpawns[0];
    const m = tileCenter(spawn.x, spawn.y);
    boss.x = m.x; boss.y = m.y;
    boss.frozenUntil = 0; boss.defeated = false; boss.phase2 = false; boss.intangible = false;
    boss.phase = 'idle'; boss.phaseStartedAt = 0;
    boss.nextIdleUntil = performance.now() + BOSS_INTRO_GRACE_MS;
    boss.lastAttack = null;
    rerollBossTextures(performance.now());

    missilePickups = []; missileProjectiles = [];
    nextMissileSpawnAt = 0;
    feathers = []; antimatterBolts = []; explosions = []; diveBlast = null;
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

  // ======================= missiles (damage) =======================
  function updateMissiles(now, dt) {
    if (now >= nextMissileSpawnAt) {
      nextMissileSpawnAt = now + MISSILE_SPAWN_INTERVAL_MS;
      const spots = LEVEL.missileSpawns || [];
      if (spots.length && missilePickups.length < MAX_MISSILES_ON_FIELD) {
        const spot = spots[Math.floor(Math.random() * spots.length)];
        const c = tileCenter(spot.x, spot.y);
        missilePickups.push({ x: c.x, y: c.y });
      }
    }

    players.forEach((p) => {
      if (p.caught) return;
      for (let i = missilePickups.length - 1; i >= 0; i--) {
        const m = missilePickups[i];
        if (Math.hypot(p.x - m.x, p.y - m.y) < MISSILE_PICKUP_RADIUS) {
          missilePickups.splice(i, 1);
          missileProjectiles.push({ x: m.x, y: m.y });
          playMissileLaunch();
        }
      }
    });

    for (let i = missileProjectiles.length - 1; i >= 0; i--) {
      const m = missileProjectiles[i];
      const dx = boss.x - m.x, dy = boss.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.x += (dx / d) * MISSILE_SPEED * dt;
      m.y += (dy / d) * MISSILE_SPEED * dt;
      m.angle = Math.atan2(dy, dx);
      if (!boss.intangible && !boss.defeated && d < MISSILE_HIT_RADIUS) {
        missileProjectiles.splice(i, 1);
        applyBossDamage(MISSILE_DAMAGE, now);
        spawnExplosion(boss.x, boss.y, 'anti');
        playBossHit();
      }
    }
  }

  function applyBossDamage(dmg, now) {
    if (boss.defeated) return;
    bossHealth = Math.max(0, bossHealth - dmg);
    spawnFloatingText(boss.x, boss.y - boss.radius - 10, `-${dmg} ANTIMATTER`);
    if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) enterPhase2(now);
    if (bossHealth <= 0 && !boss.defeated) triggerDeath(now);
  }

  function enterPhase2(now) {
    boss.phase2 = true;
    gameState = 'phase2intro';
    phase2IntroStartedAt = now;
    boss.phase = 'idle';
    boss.nextIdleUntil = now + 500;
    boss.intangible = false;
    spawnFloatingText(boss.x, boss.y - boss.radius - 10, 'CHAOS UNBOUND');
  }

  function triggerDeath(now) {
    boss.defeated = true;
    gameState = 'dying';
    deathStartedAt = now;
    deathTarget = nearestPlayer(boss.x, boss.y);
    feathers = []; antimatterBolts = []; missileProjectiles = []; missilePickups = []; diveBlast = null;
  }

  // ======================= THE ATTACK CYCLE =======================
  const PHASE1_ATTACKS = ['charge', 'reposition', 'featherfling', 'divebomb'];
  const PHASE2_ONLY_ATTACKS = ['antimatter', 'curlshockwave'];

  function attackPool() {
    return boss.phase2 ? PHASE1_ATTACKS.concat(PHASE2_ONLY_ATTACKS) : PHASE1_ATTACKS;
  }
  function pickAttack() {
    const pool = attackPool().filter((a) => a !== boss.lastAttack);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randomArenaPoint(margin) {
    return {
      x: ARENA_MIN_X + margin + Math.random() * (ARENA_MAX_X - ARENA_MIN_X - margin * 2),
      y: ARENA_MIN_Y + margin + Math.random() * (ARENA_MAX_Y - ARENA_MIN_Y - margin * 2),
    };
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'charge') {
      const angle = Math.random() * Math.PI * 2;
      boss.chargeDir = { x: Math.cos(angle), y: Math.sin(angle) };
      boss.lookDir = boss.chargeDir;
      boss.chargeHitWallAt = 0;
    } else if (kind === 'reposition') {
      boss.repoSubPhase = 'moving';
      boss.repoStartX = boss.x; boss.repoStartY = boss.y;
      const target = randomArenaPoint(boss.radius * 1.2);
      boss.repoTargetX = target.x; boss.repoTargetY = target.y;
    } else if (kind === 'featherfling') {
      boss.feathersThrown = 0;
      boss.nextFeatherAt = now;
    } else if (kind === 'divebomb') {
      boss.diveSubPhase = 'rising';
      boss.intangible = true;
    } else if (kind === 'antimatter') {
      boss.antimatterThrown = 0;
      boss.nextAntimatterAt = now;
    } else if (kind === 'curlshockwave') {
      boss.curlSubPhase = 'curling';
      boss.shockwaveHit = new Set();
    }
  }

  function finishAttack(now) {
    boss.phase = 'idle';
    boss.intangible = false;
    boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
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
      boss.x = clamp(boss.x, ARENA_MIN_X, ARENA_MAX_X);
      boss.y = clamp(boss.y, ARENA_MIN_Y, ARENA_MAX_Y);
    }
    if (now >= boss.nextIdleUntil) startAttack(pickAttack(), now);
  }

  function updateChargeAttack(now, dt) {
    const elapsed = now - boss.phaseStartedAt;
    if (elapsed < CHARGE_TELEGRAPH_MS) return; // wings back, telegraph the direction
    if (boss.chargeHitWallAt) {
      if (now - boss.chargeHitWallAt >= CHARGE_IMPACT_MS) finishAttack(now);
      return;
    }
    const step = CHARGE_SPEED * speedMult(now) * dt;
    const nx = clamp(boss.x + boss.chargeDir.x * step, ARENA_MIN_X, ARENA_MAX_X);
    const ny = clamp(boss.y + boss.chargeDir.y * step, ARENA_MIN_Y, ARENA_MAX_Y);
    const hitWall = nx !== boss.x + boss.chargeDir.x * step || ny !== boss.y + boss.chargeDir.y * step;
    boss.x = nx; boss.y = ny;
    if (hitWall) boss.chargeHitWallAt = now;
  }

  function updateRepositionAttack(now, dt) {
    if (boss.repoSubPhase === 'moving') {
      const t = clamp((now - boss.phaseStartedAt) / (REPOSITION_MS / speedMult(now)), 0, 1);
      boss.x = boss.repoStartX + (boss.repoTargetX - boss.repoStartX) * t;
      boss.y = boss.repoStartY + (boss.repoTargetY - boss.repoStartY) * t;
      if (t >= 1) {
        boss.repoSubPhase = 'spinning';
        boss.spinStartedAt = now;
        const angle = Math.random() * Math.PI * 2;
        boss.spinDir = { x: Math.cos(angle), y: Math.sin(angle) };
      }
      return;
    }
    // caroms around the pad off its own edges, same ricochet rule the
    // gear-throw-style projectiles elsewhere in this game use.
    const step = SPIN_MOVE_SPEED * speedMult(now) * dt;
    let nx = boss.x + boss.spinDir.x * step;
    let ny = boss.y + boss.spinDir.y * step;
    if (nx < ARENA_MIN_X || nx > ARENA_MAX_X) { boss.spinDir.x *= -1; nx = clamp(nx, ARENA_MIN_X, ARENA_MAX_X); }
    if (ny < ARENA_MIN_Y || ny > ARENA_MAX_Y) { boss.spinDir.y *= -1; ny = clamp(ny, ARENA_MIN_Y, ARENA_MAX_Y); }
    boss.x = nx; boss.y = ny;
    if (now - boss.spinStartedAt >= SPIN_MS / speedMult(now)) finishAttack(now);
  }

  function updateFeatherflingAttack(now) {
    if (boss.feathersThrown < FEATHER_COUNT && now >= boss.nextFeatherAt) {
      boss.nextFeatherAt = now + FEATHER_INTERVAL_MS / speedMult(now);
      boss.feathersThrown++;
      const target = nearestPlayer(boss.x, boss.y);
      const dx = target.x - boss.x, dy = target.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      feathers.push({ x: boss.x, y: boss.y, vx: (dx / d) * FEATHER_SPEED * speedMult(now), vy: (dy / d) * FEATHER_SPEED * speedMult(now), tex: Math.floor(Math.random() * NTEX) });
    }
    if (boss.feathersThrown >= FEATHER_COUNT) finishAttack(now);
  }

  function updateDivebombAttack(now, dt) {
    if (boss.diveSubPhase === 'rising') {
      if (now - boss.phaseStartedAt >= DIVEBOMB_RISE_MS) {
        boss.diveSubPhase = 'shadow';
        const target = randomArenaPoint(boss.radius * 1.3);
        boss.diveShadowX = target.x; boss.diveShadowY = target.y;
        boss.phaseStartedAt = now;
      }
      return;
    }
    if (boss.diveSubPhase === 'shadow') {
      if (now - boss.phaseStartedAt >= DIVEBOMB_SHADOW_MS) {
        boss.diveSubPhase = 'diving';
        const cx = (ARENA_MIN_X + ARENA_MAX_X) / 2, cy = (ARENA_MIN_Y + ARENA_MAX_Y) / 2;
        const dx = boss.diveShadowX - cx, dy = boss.diveShadowY - cy;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.max(WORLD_W, WORLD_H);
        boss.x = clamp(cx + (dx / d) * reach, ARENA_MIN_X, ARENA_MAX_X);
        boss.y = clamp(cy + (dy / d) * reach, ARENA_MIN_Y, ARENA_MAX_Y);
        boss.intangible = false;
      }
      return;
    }
    // diving
    const dx = boss.diveShadowX - boss.x, dy = boss.diveShadowY - boss.y;
    const d = Math.hypot(dx, dy);
    const step = DIVEBOMB_SPEED * speedMult(now) * dt;
    if (d < step || d < 4) {
      boss.x = boss.diveShadowX; boss.y = boss.diveShadowY;
      diveBlast = { x: boss.x, y: boss.y, t0: now, hit: new Set() };
      spawnExplosion(boss.x, boss.y);
      playExplosion();
      finishAttack(now);
    } else {
      boss.x += (dx / d) * step;
      boss.y += (dy / d) * step;
      boss.lookDir = { x: dx / d, y: dy / d };
    }
  }

  function updateAntimatterAttack(now) {
    if (boss.antimatterThrown < ANTIMATTER_COUNT && now >= boss.nextAntimatterAt) {
      boss.nextAntimatterAt = now + ANTIMATTER_INTERVAL_MS / speedMult(now);
      boss.antimatterThrown++;
      const target = nearestPlayer(boss.x, boss.y);
      const dx = target.x - boss.x, dy = target.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      antimatterBolts.push({ x: boss.x, y: boss.y, vx: (dx / d) * ANTIMATTER_SPEED * speedMult(now), vy: (dy / d) * ANTIMATTER_SPEED * speedMult(now) });
    }
    if (boss.antimatterThrown >= ANTIMATTER_COUNT) finishAttack(now);
  }

  function updateCurlShockwaveAttack(now) {
    if (boss.curlSubPhase === 'curling') {
      if (now - boss.phaseStartedAt >= CURL_WINDUP_MS / speedMult(now)) {
        boss.curlSubPhase = 'shockwave';
        boss.shockwaveStartedAt = now;
      }
      return;
    }
    const t = clamp((now - boss.shockwaveStartedAt) / (SHOCKWAVE_EXPAND_MS / speedMult(now)), 0, 1);
    const radius = t * SHOCKWAVE_MAX_RADIUS;
    players.forEach((p) => {
      if (p.caught || boss.shockwaveHit.has(p) || now < p.invulnerableUntil || isHidden(p, now)) return;
      const d = Math.hypot(p.x - boss.x, p.y - boss.y);
      if (d <= radius) { boss.shockwaveHit.add(p); triggerCaught(p, now); }
    });
    if (t >= 1) finishAttack(now);
  }

  // The dive bomb's blast sweeps outward to its full radius instead of
  // catching everyone in range on the same frame; anyone the ring reaches
  // is caught, and it outlives the attack that made it.
  function updateDiveBlast(now) {
    if (!diveBlast) return;
    const t = clamp((now - diveBlast.t0) / DIVEBLAST_EXPAND_MS, 0, 1);
    const radius = t * DIVEBOMB_IMPACT_RADIUS;
    players.forEach((p) => {
      if (p.caught || diveBlast.hit.has(p) || now < p.invulnerableUntil || isHidden(p, now)) return;
      if (Math.hypot(p.x - diveBlast.x, p.y - diveBlast.y) <= radius) { diveBlast.hit.add(p); triggerCaught(p, now); }
    });
    if (now - diveBlast.t0 > DIVEBLAST_EXPAND_MS + 350) diveBlast = null;
  }

  function updateBoss(now, dt) {
    if (boss.defeated) return;
    if (now < boss.frozenUntil) return;
    switch (boss.phase) {
      case 'idle': updateBossIdle(now, dt); break;
      case 'charge': updateChargeAttack(now, dt); break;
      case 'reposition': updateRepositionAttack(now, dt); break;
      case 'featherfling': updateFeatherflingAttack(now); break;
      case 'divebomb': updateDivebombAttack(now, dt); break;
      case 'antimatter': updateAntimatterAttack(now); break;
      case 'curlshockwave': updateCurlShockwaveAttack(now); break;
      default: boss.phase = 'idle';
    }
  }

  function updateFeathers(now, dt) {
    for (let i = feathers.length - 1; i >= 0; i--) {
      const s = feathers[i];
      const px = s.x, py = s.y;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < 0 || s.y < 0 || s.x > WORLD_W || s.y > WORLD_H) { feathers.splice(i, 1); continue; }
      let hit = false;
      players.forEach((p) => {
        if (hit || p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        // swept test along this frame's travel -- at 6x speed a plain
        // point check would tunnel straight through a player at low fps
        const sx = s.x - px, sy = s.y - py;
        const len2 = sx * sx + sy * sy || 1;
        const t = clamp(((p.x - px) * sx + (p.y - py) * sy) / len2, 0, 1);
        if (Math.hypot(p.x - (px + sx * t), p.y - (py + sy * t)) < FEATHER_HIT_RADIUS) { triggerCaught(p, now); hit = true; }
      });
      if (hit) feathers.splice(i, 1);
    }
  }
  function updateAntimatterBolts(now, dt) {
    for (let i = antimatterBolts.length - 1; i >= 0; i--) {
      const s = antimatterBolts[i];
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < 0 || s.y < 0 || s.x > WORLD_W || s.y > WORLD_H) { antimatterBolts.splice(i, 1); continue; }
      let hit = false;
      players.forEach((p) => {
        if (hit || p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - s.x, p.y - s.y) < ANTIMATTER_HIT_RADIUS) { triggerCaught(p, now); hit = true; }
      });
      if (hit) antimatterBolts.splice(i, 1);
    }
  }

  function updateCatch(now) {
    if (boss.defeated || boss.intangible) return;
    const spinning = boss.phase === 'reposition' && boss.repoSubPhase === 'spinning';
    const radius = spinning ? BOSS_SPIN_CATCH_RADIUS : BOSS_CATCH_RADIUS;
    players.forEach((p) => {
      if (p.caught) return;
      if (now < p.invulnerableUntil) return;
      if (isHidden(p, now)) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < radius) triggerCaught(p, now);
    });
  }

  // ======================= cutscenes =======================
  function updateIntroCutscene(now) {
    if (now - introStartedAt < BOSS_INTRO_CUTSCENE_MS && !(window.BossCutscene && window.BossCutscene.skipRequested(introStartedAt))) return;
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
    if (window.GoofyStory) window.GoofyStory.completeLevel(31);
    // level31.html plays the ending (the facility, the bomb, the credits) when it sees this
    try { sessionStorage.setItem('goofy-chaos-ending', '1'); } catch (e) { /* the ending just doesn't play */ }
    setTimeout(() => { window.location.href = 'level31.html'; }, 800);
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
      ctx.fillStyle = boss.phase2 ? '#ff3d6a' : '#9af0ff';
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

  function drawTiles(g, camX, camY, halfW, halfH, now) {
    g.drawImage(skyCanvas, -SKY_PAD_X * TILE, -SKY_PAD_Y * TILE);
    if (boss.phase2 && (gameState === 'playing' || gameState === 'phase2intro' || gameState === 'dying')) {
      // random textures flash in the sky
      const slot = Math.floor(now / SKY_FLASH_MS);
      const x0 = Math.floor((camX - halfW) / TILE) - 1, x1 = Math.ceil((camX + halfW) / TILE) + 1;
      const y0 = Math.floor((camY - halfH) / TILE) - 1, y1 = Math.ceil((camY + halfH) / TILE) + 1;
      g.save();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS && LEVEL.grid[y][x] !== '#') continue;
        const h = hash3(x, y, slot);
        if (h % 100 >= 17) continue;
        const size = TILE * (1 + ((h >> 20) & 1));
        g.globalAlpha = 0.5 + ((h >> 9) % 50) / 100;
        g.fillStyle = PATTERNS[(h >> 12) % NTEX];
        g.fillRect(x * TILE, y * TILE, size, size);
      }
      g.restore();
    }
    g.drawImage(floorCanvas, 0, 0);
    // painted perimeter stripe, yellow/black chevrons just inside the edge
    g.save();
    g.strokeStyle = '#e8c23d';
    g.lineWidth = 3;
    g.setLineDash([14, 10]);
    g.strokeRect(ARENA_MIN_X + 10, ARENA_MIN_Y + 10, ARENA_MAX_X - ARENA_MIN_X - 20, ARENA_MAX_Y - ARENA_MIN_Y - 20);
    g.setLineDash([]);
    g.restore();

    // the big white "H", dead center
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, TILE * 2.4, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(235,235,230,0.85)';
    g.fillRect(cx - TILE * 1.1, cy - TILE * 1.3, TILE * 0.32, TILE * 2.6);
    g.fillRect(cx + TILE * 0.78, cy - TILE * 1.3, TILE * 0.32, TILE * 2.6);
    g.fillRect(cx - TILE * 1.1, cy - TILE * 0.16, TILE * 2.2, TILE * 0.32);
    g.restore();

    // perimeter helipad lights, glowing amber in the dawn half-light
    const lightGlow = 0.6 + 0.4 * Math.sin(performance.now() * 0.002);
    g.save();
    for (let x = 3; x < COLS - 3; x += 4) {
      [ARENA_MIN_Y + 4, ARENA_MAX_Y - 4].forEach((ly) => {
        g.beginPath();
        g.arc(x * TILE, ly, 3, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,190,90,${0.5 + lightGlow * 0.4})`;
        g.shadowColor = '#ffbe5a'; g.shadowBlur = 6;
        g.fill(); g.shadowBlur = 0;
      });
    }
    for (let y = 3; y < ROWS - 3; y += 4) {
      [ARENA_MIN_X + 4, ARENA_MAX_X - 4].forEach((lx) => {
        g.beginPath();
        g.arc(lx, y * TILE, 3, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,190,90,${0.5 + lightGlow * 0.4})`;
        g.shadowColor = '#ffbe5a'; g.shadowBlur = 6;
        g.fill(); g.shadowBlur = 0;
      });
    }
    g.restore();
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

  function drawMissiles(g, now) {
    missilePickups.forEach((m) => {
      const bob = Math.sin(now * 0.005 + m.x) * 3;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.008 + m.y);
      g.save();
      g.translate(m.x, m.y + bob);
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, 22);
      gr.addColorStop(0, `rgba(190,250,255,${0.55 + 0.3 * pulse})`); gr.addColorStop(1, 'rgba(120,60,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
      g.rotate(-Math.PI / 2);
      g.fillStyle = '#2a2250';
      g.beginPath(); g.moveTo(11, 0); g.lineTo(-10, -5); g.lineTo(-6, 0); g.lineTo(-10, 5); g.closePath(); g.fill();
      g.strokeStyle = '#9af0ff'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#c8fbff'; g.shadowColor = '#7af0ff'; g.shadowBlur = 8;
      g.fillRect(-2, -3, 6, 6); g.shadowBlur = 0;
      g.restore();
      for (let k = 0; k < 3; k++) {                       // orbiting motes
        const a = now * 0.004 + k * (TAU / 3);
        g.beginPath(); g.arc(m.x + Math.cos(a) * 15, m.y + bob + Math.sin(a) * 15, 1.8, 0, TAU);
        g.fillStyle = '#e0c8ff'; g.fill();
      }
      g.beginPath();
      g.arc(m.x, m.y, MISSILE_PICKUP_RADIUS, 0, Math.PI * 2);
      g.strokeStyle = `rgba(140,230,255,${0.4 + 0.3 * Math.sin(now * 0.006)})`;
      g.lineWidth = 1.5;
      g.stroke();
    });
    missileProjectiles.forEach((m) => {
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.angle || 0);
      g.fillStyle = 'rgba(140,110,255,0.5)';
      g.beginPath(); g.moveTo(-12, -3); g.lineTo(-26, 0); g.lineTo(-12, 3); g.closePath(); g.fill();
      g.fillStyle = '#2a2250';
      g.fillRect(-5, -3, 11, 6);
      g.beginPath(); g.arc(7, 0, 3.4, 0, Math.PI * 2);
      g.fillStyle = '#d8fbff'; g.shadowColor = '#7af0ff'; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
      g.restore();
    });
  }
  // This whole arena renders at ZOOM 0.42 so the whole pad stays on
  // screen at once -- every projectile here is scaled up by roughly the
  // inverse of that (not the hit radius, just what you see) so they
  // still read clearly instead of shrinking into near-invisible specks,
  // which was making the attacks feel like they weren't doing anything.
  const ATTACK_VISUAL_SCALE = 2.4;
  function drawFeathers(g) {
    feathers.forEach((s) => {
      g.save();
      g.translate(s.x, s.y);
      g.rotate(Math.atan2(s.vy, s.vx));
      g.scale(ATTACK_VISUAL_SCALE, ATTACK_VISUAL_SCALE);
      g.strokeStyle = 'rgba(235,235,245,0.35)'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-26, 0); g.lineTo(-10, 0); g.stroke();
      g.beginPath();                                   // a shard torn out of the boss's skin
      g.moveTo(15, 0); g.lineTo(-2, -6); g.lineTo(-12, -1); g.lineTo(-8, 5); g.lineTo(3, 4); g.closePath();
      g.fillStyle = PATTERNS[s.tex]; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke();
      g.restore();
    });
  }
  function drawAntimatterBolts(g) {
    const t = performance.now();
    antimatterBolts.forEach((s) => {
      g.save();
      g.translate(s.x, s.y);
      g.scale(ATTACK_VISUAL_SCALE, ATTACK_VISUAL_SCALE);
      g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,40,70,0.28)'; g.shadowColor = '#ff2a4a'; g.shadowBlur = 14; g.fill(); g.shadowBlur = 0;
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2);
      g.fillStyle = PATTERNS[Math.floor(t / 90 + s.x * 0.01) % NTEX]; g.fill();
      g.strokeStyle = '#ff5a7a'; g.lineWidth = 1.4; g.stroke();
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
      g.strokeStyle = e.kind === 'anti' ? `rgba(150,230,255,${1 - t})` : `rgba(255,150,40,${1 - t})`;
      g.lineWidth = 4;
      g.stroke();
      g.beginPath();
      g.arc(e.x, e.y, (10 + t * 40) * 0.6, 0, Math.PI * 2);
      g.fillStyle = e.kind === 'anti' ? `rgba(180,140,255,${(1 - t) * 0.45})` : `rgba(255,200,80,${(1 - t) * 0.4})`;
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

  const EYE_COLORS = ['#c81020', '#e8c23d', '#2fd39a', '#4aa8ff', '#c06aff', '#ff8a2a', '#9af0ff', '#ffffff'];
  const eyeRng = texRng(31337);
  const BODY_EYES = Array.from({ length: 150 }, () => {
    const a = eyeRng() * TAU, d = Math.sqrt(eyeRng()) * 0.94;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 0.035 + eyeRng() * 0.07, ph: eyeRng(), rate: 0.15 + eyeRng() * 0.3, iris: EYE_COLORS[Math.floor(eyeRng() * EYE_COLORS.length)] };
  });
  const WING_EYES = Array.from({ length: 100 }, () => ({
    u: 0.1 + eyeRng() * 0.85, v: eyeRng() * 2 - 1, s: 0.016 + eyeRng() * 0.03, ph: eyeRng(), rate: 0.15 + eyeRng() * 0.3,
    iris: EYE_COLORS[Math.floor(eyeRng() * EYE_COLORS.length)],
  }));
  function drawEye(g, x, y, s, e, t, look) {
    const closed = ((t * 0.001 * e.rate + e.ph) % 1) < 0.07;
    g.beginPath(); g.ellipse(x, y, s, s * (closed ? 0.14 : 0.8), 0, 0, TAU);
    g.fillStyle = '#f2eee6'; g.fill();
    g.strokeStyle = 'rgba(30,0,16,0.75)'; g.lineWidth = Math.max(0.5, s * 0.14); g.stroke();
    if (closed) return;
    const px = x + look.x * s * 0.3, py = y + look.y * s * 0.22;
    g.beginPath(); g.arc(px, py, s * 0.52, 0, TAU); g.fillStyle = e.iris; g.fill();
    g.beginPath(); g.arc(px, py, s * 0.25, 0, TAU); g.fillStyle = '#08060a'; g.fill();
  }

  // a wing stitched from three textured sections along its span, bone lines
  // over the seams, and eyes all over it
  function drawWing(g, side, flap, span, rootY, t, look) {
    const sweep = Math.sin(flap) * 0.5;
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
    g.save();
    g.clip();
    const base = side < 0 ? 0 : WING_SECTIONS;
    for (let k = 0; k < WING_SECTIONS; k++) {
      g.fillStyle = PATTERNS[boss.wingTex[base + k]];
      g.fillRect(span * k / WING_SECTIONS - 1, -span, span / WING_SECTIONS + 2, span * 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, -span, span, span * 2);
    WING_EYES.forEach((e) => {
      const hw = span * 0.16 * (1 - 0.5 * e.u);
      drawEye(g, e.u * span, -0.09 * e.u * span + e.v * hw, e.s * span, e, t, look);
    });
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 0.75;
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1.5;
    [1 / 3, 2 / 3].forEach((f) => { g.beginPath(); g.moveTo(span * f, -span * 0.3); g.lineTo(span * f, span * 0.12); g.stroke(); });
    g.restore();
  }

  function drawBoss(g, t) {
    if (boss.defeated && gameState !== 'dying') return;
    if (boss.intangible && gameState === 'playing') return; // off-screen for dive bomb's rise/shadow telegraph
    g.save();
    g.translate(boss.x, boss.y);

    if (gameState === 'dying') {
      const dt2 = t - deathStartedAt;
      if (dt2 < DEATH_FALL_MS) {
        const ft = clamp(dt2 / DEATH_FALL_MS, 0, 1);
        if (deathTarget) {
          g.translate((deathTarget.x - boss.x) * ft, (deathTarget.y - boss.y) * ft);
        }
        g.rotate(ft * 0.5);
      } else {
        const dt3 = clamp((dt2 - DEATH_FALL_MS) / DEATH_DRAG_MS, 0, 1);
        if (deathTarget) g.translate(deathTarget.x - boss.x, deathTarget.y - boss.y);
        g.rotate(0.5 + dt3 * 0.3);
        g.globalAlpha = 1 - dt3 * 0.7;
        g.scale(1 - dt3 * 0.25, 1 - dt3 * 0.25);
      }
    }

    const radius = boss.radius;
    const flap = t * 0.0035;
    const charging = boss.phase === 'charge';
    const telegraphing = charging && (t - boss.phaseStartedAt) < CHARGE_TELEGRAPH_MS;
    const curled = boss.phase === 'curlshockwave' && boss.curlSubPhase === 'curling';
    const curlT = curled ? clamp((t - boss.phaseStartedAt) / (CURL_WINDUP_MS / speedMult(t)), 0, 1) : 0;
    // every eye watches whoever's nearest
    const tgt = nearestPlayer(boss.x, boss.y);
    const la = Math.atan2(tgt.y - boss.y, tgt.x - boss.x);
    const look = { x: Math.cos(la), y: Math.sin(la) };

    const spinning = boss.phase === 'reposition' && boss.repoSubPhase === 'spinning';
    if (spinning) {
      const spinElapsed = (t - boss.spinStartedAt) * speedMult(t);
      g.rotate(spinElapsed * 0.012);
      g.beginPath();
      g.arc(0, 0, BOSS_SPIN_CATCH_RADIUS, 0, Math.PI * 2);
      g.strokeStyle = `rgba(255,60,40,${0.4 + 0.25 * Math.sin(t * 0.02)})`;
      g.lineWidth = 5;
      g.stroke();
    }

    // wings fold flat against the body during a charge telegraph or the curl windup
    const wingSpanMult = (telegraphing || curled) ? 0.35 : 1;
    const wingSpan = radius * 2.9 * (boss.phase2 ? 1.5 : 1) * wingSpanMult;
    drawWing(g, -1, flap, wingSpan, radius * 0.05, t, look);
    drawWing(g, 1, flap, wingSpan, radius * 0.05, t, look);

    const legCount = 7;
    for (let i = 0; i < legCount; i++) {
      const a = Math.PI * 0.18 + (i / (legCount - 1)) * Math.PI * 0.64;
      const len = radius * (0.95 - curlT * 0.4);
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + radius * 0.55;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.12, PATTERNS[boss.legTex]);
    }

    g.save();
    g.scale(1, 1 - curlT * 0.3);
    g.save();
    g.shadowColor = '#000'; g.shadowBlur = 14;
    g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.fillStyle = '#222'; g.fill();
    g.restore();
    g.save();
    g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.clip();
    for (let k = 0; k < BODY_SECTORS; k++) {            // the skin: wedges, each a different texture
      const a0 = (k / BODY_SECTORS) * TAU + boss.seed, a1 = ((k + 1) / BODY_SECTORS) * TAU + boss.seed;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, radius * 1.05, a0, a1); g.closePath();
      g.fillStyle = PATTERNS[boss.bodyTex[k]]; g.fill();
      g.strokeStyle = 'rgba(10,0,10,0.7)'; g.lineWidth = 2; g.stroke();
    }
    const shd = g.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.2, 0, 0, radius);
    shd.addColorStop(0, 'rgba(255,255,255,0.08)'); shd.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = shd; g.fillRect(-radius, -radius, radius * 2, radius * 2);
    BODY_EYES.forEach((e) => drawEye(g, e.x * radius, e.y * radius, e.s * radius, e, t, look));
    g.restore();
    g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2);
    g.strokeStyle = '#120812'; g.lineWidth = 3; g.stroke();
    g.restore();

    if (telegraphing) {
      g.save();
      g.strokeStyle = 'rgba(255,90,60,0.8)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(boss.chargeDir.x * radius * 1.1, boss.chargeDir.y * radius * 1.1);
      g.lineTo(boss.chargeDir.x * radius * 2.4, boss.chargeDir.y * radius * 2.4);
      g.stroke();
      g.restore();
    }

    if (t < boss.frozenUntil) {
      const points = 14;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2, r = radius + 8;
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

  function drawDiveShadow(g, now) {
    if (boss.phase !== 'divebomb' || boss.diveSubPhase !== 'shadow') return;
    const t = clamp((now - boss.phaseStartedAt) / DIVEBOMB_SHADOW_MS, 0, 1);
    g.save();
    // the body-sized silhouette where it actually lands
    g.beginPath();
    g.ellipse(boss.diveShadowX, boss.diveShadowY, boss.radius * (0.6 + t * 0.5), boss.radius * (0.4 + t * 0.35), 0, 0, Math.PI * 2);
    g.fillStyle = `rgba(10,5,5,${0.35 + t * 0.35})`;
    g.fill();
    g.strokeStyle = `rgba(255,80,40,${0.3 + t * 0.5})`;
    g.lineWidth = 2;
    g.stroke();
    // the real blast radius (8.5 tiles), drawn as a growing ring so a blast this
    // big doesn't catch you with no real warning the way a body-sized
    // shadow alone would.
    g.beginPath();
    g.arc(boss.diveShadowX, boss.diveShadowY, DIVEBOMB_IMPACT_RADIUS * t, 0, Math.PI * 2);
    g.strokeStyle = `rgba(255,80,40,${0.5 * t})`;
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.stroke();
    g.setLineDash([]);
    g.restore();
  }

  function drawDiveBlast(g, now) {
    if (!diveBlast) return;
    const t = clamp((now - diveBlast.t0) / DIVEBLAST_EXPAND_MS, 0, 1);
    const fade = clamp(1 - (now - diveBlast.t0 - DIVEBLAST_EXPAND_MS) / 350, 0, 1);
    const r = t * DIVEBOMB_IMPACT_RADIUS;
    g.save();
    const grad = g.createRadialGradient(diveBlast.x, diveBlast.y, r * 0.2, diveBlast.x, diveBlast.y, Math.max(1, r));
    grad.addColorStop(0, 'rgba(255,200,90,0)');
    grad.addColorStop(1, `rgba(255,110,40,${0.45 * fade})`);
    g.beginPath(); g.arc(diveBlast.x, diveBlast.y, r, 0, Math.PI * 2); g.fillStyle = grad; g.fill();
    g.beginPath(); g.arc(diveBlast.x, diveBlast.y, r, 0, Math.PI * 2);
    g.strokeStyle = `rgba(255,230,170,${0.9 * fade})`; g.lineWidth = 16; g.stroke();
    g.strokeStyle = `rgba(255,90,40,${0.9 * fade})`; g.lineWidth = 6; g.stroke();
    g.restore();
  }

  function drawShockwaveRing(g, now) {
    if (boss.phase !== 'curlshockwave' || boss.curlSubPhase !== 'shockwave') return;
    // Must match updateCurlShockwaveAttack's own timing exactly (including
    // the Primal Form speed multiplier) -- this ring previously expanded
    // on a plain, un-boosted clock while the real hit check behind it ran
    // 1.2x faster in Phase 2, so the ring visibly lagged the actual hit
    // radius and the attack looked like it was catching you out of thin
    // air, well before the ring ever reached you.
    const t = clamp((now - boss.shockwaveStartedAt) / (SHOCKWAVE_EXPAND_MS / speedMult(now)), 0, 1);
    const radius = t * SHOCKWAVE_MAX_RADIUS;
    g.save();
    g.beginPath();
    g.arc(boss.x, boss.y, radius, 0, Math.PI * 2);
    g.strokeStyle = bossColor(`rgba(255,80,40,${0.8 * (1 - t * 0.6)})`);
    g.lineWidth = 14;
    g.stroke();
    g.beginPath();
    g.arc(boss.x, boss.y, radius, 0, Math.PI * 2);
    g.strokeStyle = bossColor(`rgba(255,220,180,${0.6 * (1 - t)})`);
    g.lineWidth = 4;
    g.stroke();
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
      const suitDark = shade(PlayerModel.suit(p), -0.35);
      const bootColor = '#2b2b28';
      drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      PlayerModel.drawTorso(g, R, p, bob, swing);
      drawHeldShotgun(g, R, p);
      PlayerModel.drawHead(g, R, p, bob);
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
  function buildDarknessMask(camX, camY, zoom, now) {
    const worldToScreen = (wx, wy) => ({
      x: (wx - camX) * zoom + VIEW_W / 2,
      y: (wy - camY) * zoom + VIEW_H / 2,
    });
    const nvgMult = now < nvgUntil ? NVG_RANGE_MULT : 1;

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.fillStyle = 'rgba(46,24,14,0.5)';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 150 * zoom * nvgMult * HM.flicker(pl), 1);
      punchLight(maskCtx, s.x, s.y, 340 * zoom * nvgMult * HM.flicker(pl), 0.85);
    });
    if (!boss.defeated && !boss.intangible) {
      const bs = worldToScreen(boss.x, boss.y);
      punchLight(maskCtx, bs.x, bs.y, boss.radius * 2 * zoom, 0.4);
    }
  }

  function drawBossIntroOverlay(vx, now) {
    const t = clamp((now - introStartedAt) / BOSS_INTRO_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 34, VIEW_W, 68);
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(200,138,232,${alpha})`;
    ctx.shadowColor = 'rgba(200,138,232,0.8)';
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
    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase2 ? PHASE2_NAME_COLOR : '#c08ae8';
    const label = boss.defeated ? `${BOSS_NAME} — DEFEATED` : `${BOSS_NAME} (${bossHealth}/${BOSS_MAX_HEALTH})`;
    ctx.fillText(label, bx + barW / 2, by - 4);
    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    if (boss.phase2) { grad.addColorStop(0, '#ff6a8a'); grad.addColorStop(0.5, '#c93a5a'); grad.addColorStop(1, '#6a1830'); }
    else { grad.addColorStop(0, '#c0a2e8'); grad.addColorStop(0.5, '#8a5ac0'); grad.addColorStop(1, '#4a2a6a'); }
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
    const target = missilePickups[0];
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
    const halfW = visibleHalfW(), halfH = visibleHalfH();
    const camX = cutscene ? boss.x : clamp(p.x, halfW, WORLD_W - halfW);
    const camY = cutscene ? boss.y : clamp(p.y, halfH, WORLD_H - halfH);
    const shakeX = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;
    const shakeY = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;

    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#5a3222'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, camX, camY, (VIEW_W / 2) / zoom, (VIEW_H / 2) / zoom, now);
    drawSmokeBombs(ctx, now);
    drawCrates(ctx);
    drawDiveShadow(ctx, now);
    drawMissiles(ctx, now);
    drawFeathers(ctx);
    drawAntimatterBolts(ctx);
    drawBoss(ctx, now);
    drawShockwaveRing(ctx, now);
    drawDiveBlast(ctx, now);
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
      drawRadar(vx, p, now);
      drawScanner(vx, p, now);
      drawShotgunHud(vx, p);
      const minimapH = drawMinimap(vx, now);
      drawStaminaBar(vx, p, minimapH);
    }
    ctx.restore();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'dying') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE BEING OF PURE CHAOS COLLAPSES&hellip;';
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
      hudPhaseEl.textContent = boss.phase2 ? 'Phase: 2 — CHAOS UNBOUND' : 'Phase: 1';
      hudPhaseEl.classList.toggle('done', boss.phase2);
    }
    if (hudMissilesEl) {
      hudMissilesEl.textContent = boss.defeated ? 'Antimatter missiles: --' : `Antimatter missiles: ${missilePickups.length}/${MAX_MISSILES_ON_FIELD} on the pad`;
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
        updateMissiles(now, dt);
        updateBoss(now, dt);
        updateDiveBlast(now);
        updateFeathers(now, dt);
        updateAntimatterBolts(now, dt);
        updateShotgunDefense(now);
        updateCatch(now);
        updateCutscenes(now);
        updateExploration();
        updateAmbientTension();
      } else if (gameState === 'dying') {
        updateDeathSequence(now);
      }
      if (boss.phase2 && !boss.defeated && now - boss.texChangedAt >= RETEXTURE_MS) rerollBossTextures(now);
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
