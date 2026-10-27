// Plays a designer slot (levels 32-49, see editor.html and js/customdata.js):
// either an ordinary level (collect every key, then reach the exit, with the
// designed monster stalking the halls) or a mini boss arena (the designed
// monster is a boss with a health bar and a handful of attacks; bombs are the
// only thing that hurts it). Everything about a slot -- map, monster shapes,
// monster behaviour, boss stats -- is data; this file is just the engine.
(function () {
  const HM = window.HardMode;
  const ID = window.CUSTOM_SLOT;
  const SLOT = window.CustomStore.slotInfo(ID);
  const CHAP = window.CustomStore.chapterInfo(SLOT.chapter);
  const FOOT_SURFACE = CHAP.surface;
  // Opened from the designer's "test play": skips the story lock and leaves progress and best times alone.
  const TEST_MODE = /[?&]test(=|&|$)/.test(window.location.search);

  // Same story gate as every other level: a typed-in URL can't skip ahead.
  if (window.GoofyStory && !TEST_MODE && !window.GoofyStory.isUnlocked(ID)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const DESIGN = window.CustomStore.get(ID);
  const IS_BOSS = DESIGN.kind === 'miniboss' && !!DESIGN.monster.boss;
  const LEVEL = window.CustomStore.levelFromDesign(DESIGN);
  const MON = DESIGN.monster;
  const AI = Object.assign(window.CustomMonster.defaultAI(), MON.ai || {});
  const BOSS = IS_BOSS ? Object.assign(window.CustomMonster.defaultBoss(), MON.boss) : null;
  if (BOSS) { BOSS.bombEvery = Math.max(0, Math.round(BOSS.bombEvery || 0)); BOSS.bombDmg = Math.max(1, BOSS.bombDmg || 1); BOSS.pause = BOSS.pause == null ? 1.5 : BOSS.pause; }
  const INTRO = IS_BOSS && MON.intro && MON.intro.effect && MON.intro.effect !== 'none' && window.BossCutscene ? MON.intro : null;
  const INTRO_MS = INTRO ? window.BossCutscene.duration('custom') : 0;
  const check = window.CustomStore.validate(DESIGN);

  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  // 'ashen' = the Ashen One's arena look (obsidian floor, glowing magma cracks, embers);
  // anything else uses the chapter's own palette and scenery.
  const STYLE = DESIGN.style === 'ashen' ? 'ashen' : 'chapter';
  const LD = STYLE === 'ashen' ? window.LevelDetails.make(null) : window.LevelDetails.make(LEVEL, ID, SLOT.chapter);

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;
  const REPATH_MS = 450;
  const CATCH_CUTSCENE_MS = 2000;
  const MON_SIZE = Math.max(10, Math.min(60, MON.size || 22));
  const CATCH_RADIUS = 10 + MON_SIZE * 0.5;
  const PATROL_SPEED = HM.speed(PLAYER_SPEED * AI.patrol);
  const CHASE_SPEED = HM.speed(PLAYER_SPEED * AI.chase);
  const ALERT_GRACE_MS = AI.grace * 1000;

  // ---- sprint / stamina (identical to every other level) ----
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

  const exploredCanvas = document.createElement('canvas');
  exploredCanvas.width = COLS;
  exploredCanvas.height = ROWS;
  const exploredCtx = exploredCanvas.getContext('2d');
  let explored = new Uint8Array(COLS * ROWS);
  const EXPLORE_RADIUS = IS_BOSS ? 40 : 7;
  const MINIMAP_W = 90;

  const hudObjEl = document.getElementById('hud-obj');
  const hudDoorEl = document.getElementById('hud-door');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  // ---- page text comes from the design, so edits show up without touching HTML ----
  (function fillPage() {
    const h1 = document.getElementById('level-title');
    if (h1) h1.innerHTML = `Level ${(window.GoofyStory && window.GoofyStory.displayNumber) ? window.GoofyStory.displayNumber(ID) : ID} &mdash; ${escapeHtml(DESIGN.title || 'Untitled')}`;
    const obj = document.getElementById('level-objective');
    if (obj) {
      obj.innerHTML = IS_BOSS
        ? `Pick up a <strong>bomb</strong>, wait for <strong>${escapeHtml(MON.name || 'the boss')}</strong> to wear itself out, then land the bomb on it &mdash; ${BOSS.hp} hit${BOSS.hp === 1 ? '' : 's'} to bring it down.`
        : (LEVEL.keys.length
          ? `Find ${LEVEL.keys.length === 1 ? 'the' : 'all ' + LEVEL.keys.length} <strong>key${LEVEL.keys.length === 1 ? '' : 's'}</strong> to open the exit &mdash; and get both players out past <strong>${escapeHtml(MON.name || 'the monster')}</strong>.`
          : `Reach the <strong>exit</strong> &mdash; and get both players out past <strong>${escapeHtml(MON.name || 'the monster')}</strong>.`);
    }
    const desc = document.getElementById('level-desc');
    if (desc) {
      const kind = AI_HELP();
      desc.innerHTML = `${escapeHtml(DESIGN.blurb || '')} <strong>${escapeHtml(MON.name || '')}</strong> &mdash; ${escapeHtml(MON.desc || '')} ${kind}`;
    }
  })();
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function AI_HELP() {
    if (IS_BOSS) return '';
    const t = window.CustomMonster.AI_TYPES[AI.type];
    return t ? escapeHtml(t.help) : '';
  }

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let musicMasterGain = null;
  let musicEnabled = false;
  let ambientGain = null;
  let ambientSubOsc = null;

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
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.6;
    filter.connect(ambientGain);
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    function voice(freq, type, gainValue, vibRate, vibDepth) {
      const osc = audioCtx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = audioCtx.createGain();
      gain.gain.value = gainValue;
      const vib = audioCtx.createOscillator();
      vib.frequency.value = vibRate;
      const vibGain = audioCtx.createGain();
      vibGain.gain.value = vibDepth;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);
      vib.start();
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      return osc;
    }
    ambientSubOsc = voice(41.2, 'sine', 0.6, 0.05, 1.5);
    voice(43.7, 'sine', 0.5, 0.08, 2);
    voice(20.6, 'sine', 0.4, 0.03, 0.8);
    voice(660, 'triangle', 0.05, 0.02, 40);

    if (IS_BOSS && window.BossMusic) {
      window.BossMusic.start({
        audioCtx, dest: musicMasterGain, theme: CHAP.music,
        isActive: () => boss && !boss.dead,
        intensity: () => (boss ? 1 - boss.hp / BOSS.hp : 0),
      });
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
  function sweep(f0, f1, dur, type, vol, delay) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.08);
  }
  const playKeyChime = () => { playTone(660, 0.18, 'triangle', 0.2); playTone(990, 0.25, 'triangle', 0.2, 0.1); };
  const playDoorUnlockChime = () => { playTone(440, 0.2, 'triangle', 0.22, 0); playTone(660, 0.2, 'triangle', 0.22, 0.12); playTone(880, 0.3, 'triangle', 0.22, 0.24); };
  const playCatchSting = () => { sweep(320, 50, 0.45, 'sawtooth', 0.28); sweep(90, 40, 0.18, 'square', 0.35, 0.35); };
  const playBlink = () => sweep(1400, 200, 0.18, 'sine', 0.16);
  const playBombPick = () => playTone(520, 0.12, 'square', 0.14);
  const playBlast = () => { sweep(1800, 200, 0.08, 'sawtooth', 0.3); sweep(120, 40, 0.3, 'square', 0.35, 0.02); };
  const playWarn = () => playTone(180, 0.12, 'square', 0.1);
  const playWinJingle = () => [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.35, 'triangle', 0.2, i * 0.14));

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.min(...players.flatMap((p) => monsters.map((m) => Math.hypot(p.x - m.x, p.y - m.y))));
    const proximity = clamp(1 - minDist / 380, 0, 1);
    ambientGain.gain.setTargetAtTime(0.05 + proximity * 0.18, audioCtx.currentTime, 0.3);
    ambientSubOsc.frequency.setTargetAtTime(41.2 + proximity * 12, audioCtx.currentTime, 0.3);
  }

  function setMusicEnabled(on) {
    musicEnabled = on;
    ensureAudio();
    if (audioCtx && musicMasterGain) musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
  }
  const soundHintEl = document.getElementById('sound-hint');
  const musicToggleEl = document.getElementById('music-toggle');
  if (musicToggleEl) {
    musicToggleEl.addEventListener('click', () => {
      setMusicEnabled(!musicEnabled);
      musicToggleEl.textContent = musicEnabled ? '♪ Music: On' : '♪ Music: Off';
      musicToggleEl.classList.toggle('muted', !musicEnabled);
      if (soundHintEl) soundHintEl.style.display = musicEnabled ? 'none' : '';
    });
  }

  // ---- input ----
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
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) { keys[e.key] = false; e.preventDefault(); }
  });

  // ---- tiles ----
  function clamp(v, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.max(min, Math.min(max, v));
  }
  const worldToTile = (x, y) => ({ x: Math.floor(x / TILE), y: Math.floor(y / TILE) });
  function tileChar(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return LEVEL.grid[ty][tx];
  }
  const tileCenter = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
  function hash2(x, y) {
    const h = Math.imul(x + 91, 374761393) ^ Math.imul(y - 17, 668265263);
    return ((h ^ (h >>> 13)) >>> 0);
  }
  const shade = window.CustomMonster.shade;

  // ---- timer / best time ----
  const BEST_TIME_KEY = 'goofy-horror-best-level' + ID;
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

  let gameState = 'playing'; // 'intro' | 'playing' | 'complete'
  let introStartedAt = 0;
  let catchFlash = 0;
  let keysTaken = [];
  let doorUnlocked = false;
  let floatingTexts = [];
  let bloodSplatters = [];
  let particles = [];
  let embers = [];

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0, moving: false, bomb: false,
    };
  }
  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1 || { x: 1, y: 1 }, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1 || { x: 1, y: 1 }, '#ff8a3d'), makePlayer(LEVEL.spawn2 || LEVEL.spawn1 || { x: 1, y: 1 }, '#3ddc84')];

  // every walkable open tile, for roaming and random spawns
  const floorTiles = [];
  const lavaTiles = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (LEVEL.grid[y][x] === '.') floorTiles.push({ x, y });
      else if (LEVEL.grid[y][x] === 'L') lavaTiles.push({ x, y });
    }
  }

  // ---- monsters ----
  const monsters = [];
  const SPAWNS = LEVEL.monsterSpawns.length ? LEVEL.monsterSpawns : [LEVEL.spawn1 || { x: 1, y: 1 }];
  const MON_COUNT = IS_BOSS ? 1 : Math.max(1, Math.min(4, Math.round(AI.count || 1)));
  for (let i = 0; i < MON_COUNT; i++) {
    monsters.push({
      x: 0, y: 0, radius: MON_SIZE, seed: Math.random() * 100,
      spawn: SPAWNS[i % SPAWNS.length],
      path: [], pathIndex: 0, nextRepathAt: 0, lookDir: { x: 1, y: 0 },
      state: 'patrol', alertUntil: 0, alertTile: null, patrolIndex: i, roamGoal: null,
      frozenUntil: 0, nextBlinkAt: 0, flash: 0,
    });
  }
  const boss = IS_BOSS ? monsters[0] : null;

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  // mini boss state
  let hazards = [];   // projectiles / rings / circles
  let bombs = [];     // bombs lying around
  let bombRespawnAt = 0;
  let attackQueue = [];

  function resetLevel() {
    players.forEach((p) => {
      respawnPlayer(p);
      p.caught = false; p.caughtAt = 0; p.invulnerableUntil = 0;
      p.stamina = STAMINA_MAX; p.moveState = 'normal'; p.exhaustedUntil = 0; p.sprintActive = false; p.bomb = false;
    });
    monsters.forEach((m, i) => {
      const c = tileCenter(m.spawn.x, m.spawn.y);
      m.x = c.x + (i ? (i % 2 ? 6 : -6) : 0); m.y = c.y;
      m.path = []; m.pathIndex = 0; m.nextRepathAt = 0; m.frozenUntil = 0; m.flash = 0;
      m.state = AI.type === 'ambusher' ? 'wait' : 'patrol';
      m.alertUntil = 0; m.alertTile = null; m.patrolIndex = i; m.roamGoal = null; m.nextBlinkAt = 0;
    });
    keysTaken = LEVEL.keys.map(() => false);
    doorUnlocked = IS_BOSS ? false : LEVEL.keys.length === 0;
    floatingTexts = [];
    hazards = [];
    bombs = [];
    bombRespawnAt = 0;
    attackQueue = [];
    particles = [];
    embers = [];
    if (boss) {
      boss.hp = BOSS.hp; boss.dead = false; boss.diedAt = 0;
      boss.phase = 'chase'; boss.phaseAt = performance.now() + 1200; boss.atk = null;
      boss.tired = false; boss.invulUntil = 0; boss.state = 'alert'; boss.atkCount = 0; boss.obsidian = 0;
    }
    resetExploration();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
    gameState = 'playing';
    if (INTRO) {
      window.BossCutscene.setCustom({
        name: (MON.name || 'THE BOSS').toUpperCase(),
        color: INTRO.color || (STYLE === 'ashen' ? '#ff6a2a' : CHAP.accent),
        effect: INTRO.effect,
        floor: INTRO.floor || (STYLE === 'ashen' ? 'basalt' : ['stone', 'stone', 'frost', 'flood', 'moss', 'roof'][SLOT.chapter - 1]),
        monster: MON,
        scale: 40 + Math.min(70, MON_SIZE * 1.6),
      });
      gameState = 'intro';
      introStartedAt = performance.now();
    }
  }
  resetLevel();

  // ---- player movement ----
  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#') return true;
    if (ch === 'D') return !doorUnlocked;
    return false;
  }
  function canStandAt(x, y) {
    const r = PLAYER_RADIUS;
    return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].every(([cx, cy]) => {
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
      if (p.stamina <= 0) { p.moveState = 'exhausted'; p.exhaustedUntil = now + EXHAUSTED_MS; p.sprintActive = false; }
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
    if (LD.ice(p, ix, iy, dt, movePlayer, PLAYER_SPEED * speedMultiplierFor(p))) return;
    if (p.caught) return;
    if (ix === 0 && iy === 0) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    const speed = PLAYER_SPEED * speedMultiplierFor(p);
    movePlayer(p, nx * speed * dt, ny * speed * dt);
  }
  function updatePlayerMovement(p, ix, iy, now, dt) {
    const isMoving = !p.caught && (ix !== 0 || iy !== 0);
    p.moving = isMoving;
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
  function isInSafeZone(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  // ---- minimap exploration ----
  function minimapColorFor(ch) {
    if (ch === '#') return '#8f8f9a';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'S') return '#3ddc84';
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

  function spawnFloatingText(x, y, text) { floatingTexts.push({ x, y, text, life: 0, maxLife: 1.4 }); }
  function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].life += dt;
      if (floatingTexts[i].life >= floatingTexts[i].maxLife) floatingTexts.splice(i, 1);
    }
  }

  // ---- keys, door, exit ----
  function exitOpen() { return doorUnlocked; }
  function updateKeys(now) {
    if (IS_BOSS) return;
    LEVEL.keys.forEach((k, i) => {
      if (keysTaken[i]) return;
      const c = tileCenter(k.x, k.y);
      if (players.some((p) => !p.caught && Math.hypot(p.x - c.x, p.y - c.y) < 18)) {
        keysTaken[i] = true;
        playKeyChime();
        spawnFloatingText(c.x, c.y, 'KEY!');
        if (keysTaken.every(Boolean)) {
          doorUnlocked = true;
          playDoorUnlockChime();
          spawnFloatingText(c.x, c.y - 14, 'EXIT OPEN');
        }
      }
    });
  }
  function updateTriggers() {
    if (!exitOpen() || gameState !== 'playing') return;
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      if (LEVEL.exits.some((e) => e.x === t.x && e.y === t.y) && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
        if (window.GoofyStory && !TEST_MODE) window.GoofyStory.completeLevel(ID);
        const nx = window.GoofyStory ? window.GoofyStory.nextInOrder(ID) : 0;
        setTimeout(() => { window.location.href = TEST_MODE ? `editor.html#${ID}` : (nx ? `level${nx}.html` : 'index.html'); }, 2000);
      }
    });
  }

  // ---- monster pathing ----
  const NODES = COLS * ROWS;
  const bfsPrev = new Int32Array(NODES);
  const bfsQueue = new Int32Array(NODES);
  function monsterCanOccupy(ch) {
    if (ch === '#' || ch === 'S') return false;
    if (ch === 'D') return doorUnlocked;
    return true;
  }
  function bfsPath(sx, sy, gx, gy) {
    if (sx === gx && sy === gy) return [];
    if (!monsterCanOccupy(tileChar(gx, gy))) return null;
    bfsPrev.fill(-2);
    const start = sy * COLS + sx, goal = gy * COLS + gx;
    bfsPrev[start] = -1;
    let head = 0, tail = 0;
    bfsQueue[tail++] = start;
    let found = false;
    while (head < tail) {
      const cur = bfsQueue[head++];
      if (cur === goal) { found = true; break; }
      const cx = cur % COLS, cy = (cur / COLS) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ni = ny * COLS + nx;
        if (bfsPrev[ni] !== -2 || !monsterCanOccupy(LEVEL.grid[ny][nx])) continue;
        bfsPrev[ni] = cur;
        bfsQueue[tail++] = ni;
      }
    }
    if (!found) return null;
    const path = [];
    for (let c = goal; c !== start; c = bfsPrev[c]) path.push({ x: c % COLS, y: (c / COLS) | 0 });
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

  function wallOffsetDir(tx, ty) {
    let dx = 0, dy = 0;
    if (tileChar(tx - 1, ty) === '#') dx += 1;
    if (tileChar(tx + 1, ty) === '#') dx -= 1;
    if (tileChar(tx, ty - 1) === '#') dy += 1;
    if (tileChar(tx, ty + 1) === '#') dy -= 1;
    const len = Math.hypot(dx, dy);
    return len === 0 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len };
  }
  function tileTargetWithOffset(t) {
    const c = tileCenter(t.x, t.y);
    const off = wallOffsetDir(t.x, t.y);
    return { x: c.x + off.x * 10, y: c.y + off.y * 10 };
  }

  function followPath(m, speed, dt) {
    if (!(m.pathIndex < m.path.length)) return true;
    const step = speed * dt;
    const target = tileTargetWithOffset(m.path[m.pathIndex]);
    const dx = target.x - m.x, dy = target.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.001) m.lookDir = { x: dx / d, y: dy / d };
    if (d < step) { m.x = target.x; m.y = target.y; m.pathIndex++; return m.pathIndex >= m.path.length; }
    m.x += (dx / d) * step;
    m.y += (dy / d) * step;
    return false;
  }

  function nearestTarget(m, includeSafe) {
    let best = null, bd = Infinity;
    players.forEach((p) => {
      if (p.caught || (!includeSafe && isInSafeZone(p))) return;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bd) { bd = d; best = p; }
    });
    return best ? { p: best, d: bd } : null;
  }

  function pickRoamGoal(m) {
    for (let tries = 0; tries < 12; tries++) {
      const t = floorTiles[Math.floor(Math.random() * floorTiles.length)];
      if (!t) return null;
      const d = Math.hypot(t.x * TILE - m.x, t.y * TILE - m.y);
      if (d > 8 * TILE) return t;
    }
    return floorTiles.length ? floorTiles[Math.floor(Math.random() * floorTiles.length)] : null;
  }

  // Works out whether this monster has noticed anyone and flips its state.
  function sense(m, now) {
    const type = AI.type;
    if (type === 'hunter') {
      const near = nearestTarget(m, false);
      if (near) { m.state = 'alert'; m.alertTile = worldToTile(near.p.x, near.p.y); m.alertUntil = now + 800; }
      else if (m.state === 'alert') { m.state = 'patrol'; m.path = []; m.pathIndex = 0; }
      return;
    }
    for (const p of players) {
      if (p.caught || isInSafeZone(p)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      let noticed = false;
      if (type === 'listener') {
        const range = AI.detect * (p.moveState === 'sprinting' ? 1.8 : p.moving ? 0.5 : 0);
        noticed = range > 0 && d <= range;
      } else {
        noticed = d <= AI.detect && hasLineOfSight(m.x, m.y, p.x, p.y);
      }
      if (noticed) {
        if (m.state !== 'alert') spawnFloatingText(m.x, m.y - m.radius - 8, '!');
        m.state = 'alert';
        m.alertUntil = now + ALERT_GRACE_MS;
        m.alertTile = worldToTile(p.x, p.y);
      }
    }
    if (m.state === 'alert' && now >= m.alertUntil) {
      m.path = []; m.pathIndex = 0;
      m.state = type === 'ambusher' ? 'return' : 'patrol';
    }
  }

  function tryBlink(m, now) {
    if (!(AI.blink > 0) || m.state !== 'alert' || now < m.nextBlinkAt) return;
    m.nextBlinkAt = now + AI.blink * 1000;
    const near = nearestTarget(m, false);
    if (!near) return;
    const pt = worldToTile(near.p.x, near.p.y);
    // candidates 5-9 tiles from the target, on open floor, outside safe rooms
    const cands = floorTiles.filter((t) => {
      const d = Math.hypot(t.x - pt.x, t.y - pt.y);
      return d >= 5 && d <= 9;
    });
    if (!cands.length) return;
    const t = cands[Math.floor(Math.random() * cands.length)];
    const c = tileCenter(t.x, t.y);
    m.x = c.x; m.y = c.y;
    m.path = []; m.pathIndex = 0; m.nextRepathAt = 0;
    m.flash = 1;
    playBlink();
  }

  function updateMonster(m, now, dt) {
    if (now < m.frozenUntil) return;
    m.flash = Math.max(0, m.flash - dt * 3);
    sense(m, now);
    tryBlink(m, now);

    let goal = null, speed = 0;
    if (m.state === 'alert') { goal = m.alertTile; speed = CHASE_SPEED; }
    else if (m.state === 'return') {
      goal = m.spawn; speed = PATROL_SPEED;
      const t = worldToTile(m.x, m.y);
      if (t.x === m.spawn.x && t.y === m.spawn.y) { m.state = 'wait'; m.path = []; m.pathIndex = 0; }
    } else if (m.state === 'patrol') {
      speed = PATROL_SPEED;
      if (LEVEL.patrolPoints.length) goal = LEVEL.patrolPoints[m.patrolIndex % LEVEL.patrolPoints.length];
      else { if (!m.roamGoal) m.roamGoal = pickRoamGoal(m); goal = m.roamGoal; }
    }
    if (!goal || speed <= 0) return;

    if (now >= m.nextRepathAt) {
      m.nextRepathAt = now + REPATH_MS;
      const st = worldToTile(m.x, m.y);
      const path = bfsPath(st.x, st.y, goal.x, goal.y);
      if (path && path.length) { m.path = path; m.pathIndex = 0; }
      else {
        m.path = []; m.pathIndex = 0;
        if (m.state === 'patrol') {
          if (LEVEL.patrolPoints.length) m.patrolIndex = (m.patrolIndex + 1) % LEVEL.patrolPoints.length;
          else m.roamGoal = pickRoamGoal(m);
        }
      }
    }
    const arrived = followPath(m, speed, dt);
    if (arrived && m.state === 'patrol') {
      if (LEVEL.patrolPoints.length) m.patrolIndex = (m.patrolIndex + 1) % LEVEL.patrolPoints.length;
      else m.roamGoal = pickRoamGoal(m);
    }
  }

  // ---- catching ----
  function updateCatch(now) {
    monsters.forEach((m) => {
      if (m.state !== 'alert' || now < m.frozenUntil || m.dead || (boss && (boss.tired || boss.phase === 'dead'))) return;
      players.forEach((p) => {
        if (p.caught || isInSafeZone(p) || now < p.invulnerableUntil) return;
        if (Math.hypot(p.x - m.x, p.y - m.y) < CATCH_RADIUS) triggerCaught(p, now);
      });
    });
  }
  function triggerCaught(p, now, cause) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    p.cause = cause || 'monster';
    if (p.cause === 'lava') {
      spawnBurst(p.x, p.y);
      spawnEmberBurst(p.x, p.y, 50);
      spawnFloatingText(p.x, p.y - 14, 'BURNED!');
      sweep(900, 120, 0.6, 'sawtooth', 0.2);
    } else {
      spawnBloodEffect(p.x, p.y);
    }
    p.caught = true;
    p.caughtAt = now;
    p.bomb = false;
    p.invulnerableUntil = now + CATCH_CUTSCENE_MS + 1200;
  }
  // Magma floor kills on contact: the tile under a player's centre decides it.
  function updateLava(now) {
    if (!lavaTiles.length) return;
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil) return;
      const t = worldToTile(p.x, p.y);
      if (tileChar(t.x, t.y) === 'L') triggerCaught(p, now, 'lava');
    });
  }

  function updateCutscenes(now) {
    players.forEach((p) => {
      if (p.caught && now - p.caughtAt >= CATCH_CUTSCENE_MS) { respawnPlayer(p); p.caught = false; }
    });
  }

  // =====================================================================
  //  Mini boss
  // =====================================================================
  // Two ways to hurt it, picked per design:
  //   classic   (bombEvery 0): bombs lie around the arena all the time; after every
  //                            attack it is worn out for a while and a bomb lands.
  //   coughing  (bombEvery N): it only coughs up a bomb after every Nth attack, and
  //                            is worn out (and hittable) just then.
  const BOSS_TARGET_BOMBS = PLAYER_MODE === 1 ? 2 : 3;
  const COUGH_MODE = IS_BOSS && BOSS.bombEvery > 0;
  const MAGMA_R = 48; // a 3x3-tile puddle

  function openFloorFarFromBoss() {
    const cands = floorTiles.filter((t) => {
      const c = tileCenter(t.x, t.y);
      return boss && Math.hypot(c.x - boss.x, c.y - boss.y) > 150 && !bombs.some((b) => Math.hypot(b.x - c.x, b.y - c.y) < 40);
    });
    return cands.length ? cands[Math.floor(Math.random() * cands.length)] : floorTiles[0];
  }
  function spawnBomb() {
    let t = null;
    const free = LEVEL.bombSpawns.filter((s) => {
      const c = tileCenter(s.x, s.y);
      return !bombs.some((b) => Math.hypot(b.x - c.x, b.y - c.y) < 10);
    });
    if (free.length) t = free[Math.floor(Math.random() * free.length)];
    else t = openFloorFarFromBoss();
    if (!t) return;
    const c = tileCenter(t.x, t.y);
    bombs.push({ x: c.x, y: c.y, seed: Math.random() * 100 });
  }
  // the boss retches a bomb up onto the floor a short way from itself
  function coughBomb(now) {
    if (bombs.length + players.filter((p) => p.bomb).length >= 2) return;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2, d = MON_SIZE + 40 + Math.random() * 40;
      const x = boss.x + Math.cos(a) * d, y = boss.y + Math.sin(a) * d;
      if (!bossCanOccupyPoint(x, y) || isInSafeZone({ x, y })) continue;
      bombs.push({ x, y, seed: Math.random() * 100, born: now });
      spawnBurst(x, y);
      spawnFloatingText(x, y - 10, 'BOMB!');
      return;
    }
    bombs.push({ x: boss.x, y: boss.y + MON_SIZE + 24, seed: Math.random() * 100, born: now });
  }

  // Attacks run in the order the design lists them, round and round.
  function nextAttack() {
    if (!attackQueue.length) attackQueue = (BOSS.attacks && BOSS.attacks.length ? BOSS.attacks : ['charge']).slice().reverse();
    return attackQueue.pop();
  }
  function aimAt(m, p) {
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  function beginAttack(now) {
    const kind = nextAttack();
    boss.phase = 'attack';
    boss.atk = { kind, start: now, fired: 0, dir: null, crashed: false, ring: 0 };
    boss.state = 'alert';
    if (kind === 'slam') planSlam(now);
    if (kind === 'magma') planMagma(now);
    if (kind === 'obsidian') { boss.atk.vx = 0; boss.atk.vy = 0; }
    playWarn();
  }

  // The vulnerable window. In coughing mode this is when the bomb comes up.
  function enterTired(now, mult) {
    boss.phase = 'tired';
    boss.tired = true;
    boss.phaseAt = now + BOSS.rest * 1000 * (mult || 1);
    boss.atk = null;
    boss.obsidian = 0;
    boss.path = []; boss.pathIndex = 0;
  }
  // Every attack finishes through here.
  function endAttack(now, mult) {
    boss.atkCount = (boss.atkCount || 0) + 1;
    boss.obsidian = 0;
    if (COUGH_MODE && boss.atkCount % BOSS.bombEvery !== 0) {
      boss.phase = 'recover';
      boss.phaseAt = now + BOSS.pause * 1000 * (mult || 1);
      boss.atk = null;
      boss.path = []; boss.pathIndex = 0;
      return;
    }
    enterTired(now, mult);
    if (COUGH_MODE) { coughBomb(now); spawnFloatingText(boss.x, boss.y - MON_SIZE - 8, '*COUGH*'); sweep(160, 70, 0.3, 'sawtooth', 0.2); }
  }

  function planSlam(now) {
    const targets = players.filter((p) => !p.caught && !isInSafeZone(p)).map((p) => ({ x: p.x, y: p.y }));
    const extra = floorTiles.length ? floorTiles[Math.floor(Math.random() * floorTiles.length)] : null;
    if (extra) { const c = tileCenter(extra.x, extra.y); targets.push({ x: c.x, y: c.y }); }
    targets.forEach((t) => hazards.push({ type: 'circle', x: t.x, y: t.y, r: 46, armAt: now + 1000, until: now + 1300, hit: false }));
  }

  // Three blobs lobbed into the air: each leaves a shadow on the ground for 2s, then
  // splatters into a 3x3-tile puddle of magma that burns for 3s.
  function planMagma(now) {
    const live = players.filter((p) => !p.caught && !isInSafeZone(p));
    for (let i = 0; i < 3; i++) {
      const tgt = live.length ? live[i % live.length] : null;
      let x = tgt ? tgt.x : boss.x, y = tgt ? tgt.y : boss.y;
      for (let tries = 0; tries < 20; tries++) {
        const a = Math.random() * Math.PI * 2, d = tgt ? (i < live.length ? Math.random() * 14 : 30 + Math.random() * 70) : 80 + Math.random() * 200;
        const cx = (tgt ? tgt.x : boss.x) + Math.cos(a) * d, cy = (tgt ? tgt.y : boss.y) + Math.sin(a) * d;
        if (bossCanOccupyPoint(cx, cy) && !isInSafeZone({ x: cx, y: cy })) { x = cx; y = cy; break; }
      }
      const launch = now + 250 + i * 330;
      hazards.push({ type: 'blob', x, y, sx: boss.x, sy: boss.y, launchAt: launch, armAt: launch + 2000, until: launch + 5000, r: MAGMA_R, boomed: false });
    }
  }

  function bossCanOccupyPoint(x, y) {
    const t = worldToTile(x, y);
    const ch = tileChar(t.x, t.y);
    return ch !== '#' && !(ch === 'D' && !doorUnlocked);
  }

  function updateBoss(now, dt) {
    const m = boss;
    if (m.dead) return;
    const hpFrac = m.hp / BOSS.hp;

    if (m.phase === 'chase') {
      m.state = 'alert';
      const near = nearestTarget(m, true);
      if (near && now >= m.nextRepathAt) {
        m.nextRepathAt = now + REPATH_MS;
        const st = worldToTile(m.x, m.y), gt = worldToTile(near.p.x, near.p.y);
        const path = bfsPath(st.x, st.y, gt.x, gt.y);
        m.path = path || []; m.pathIndex = 0;
      }
      followPath(m, HM.speed(PLAYER_SPEED * BOSS.speed), dt);
      if (now >= m.phaseAt) beginAttack(now);
      return;
    }

    if (m.phase === 'recover') {
      m.state = 'alert';
      if (now >= m.phaseAt) { m.phase = 'chase'; m.phaseAt = now + 1500 - 600 * (1 - hpFrac); }
      return;
    }

    if (m.phase === 'tired') {
      m.state = 'idle';
      if (now >= m.phaseAt) {
        m.tired = false;
        m.phase = 'chase';
        m.phaseAt = now + 1700 - 700 * (1 - hpFrac);
        m.state = 'alert';
      }
      return;
    }

    if (m.phase !== 'attack' || !m.atk) return;
    const a = m.atk;
    const t = (now - a.start) / 1000;
    const near = nearestTarget(m, true);

    if (a.kind === 'charge') {
      if (t < 0.95) {
        if (near && t < 0.5) a.dir = aimAt(m, near.p);
        if (a.dir) m.lookDir = a.dir;
      } else {
        if (!a.dir) a.dir = near ? aimAt(m, near.p) : { x: 1, y: 0 };
        const step = HM.speed(PLAYER_SPEED * 3.4) * dt;
        const nx = m.x + a.dir.x * step, ny = m.y + a.dir.y * step;
        const lead = MON_SIZE * 0.6;
        if (!bossCanOccupyPoint(nx + a.dir.x * lead, ny + a.dir.y * lead)) {
          a.crashed = true;
          sweep(120, 35, 0.3, 'square', 0.4);
          spawnFloatingText(m.x, m.y - MON_SIZE - 6, 'CRASH!');
          endAttack(now, 1.4);
          return;
        }
        m.x = nx; m.y = ny;
        if (t > 2.1) endAttack(now, 1);
      }
      return;
    }

    if (a.kind === 'fireballs') {
      const times = [0.5, 1.2, 1.9];
      if (a.fired < times.length && t >= times[a.fired]) {
        const tgt = near ? near.p : players[0];
        const base = Math.atan2(tgt.y - m.y, tgt.x - m.x);
        m.lookDir = { x: Math.cos(base), y: Math.sin(base) };
        for (let i = -1; i <= 1; i++) {
          const ang = base + i * 0.3;
          hazards.push({ type: 'proj', x: m.x, y: m.y, vx: Math.cos(ang) * 175, vy: Math.sin(ang) * 175, r: 7, born: now });
        }
        sweep(900, 300, 0.12, 'sawtooth', 0.18);
        a.fired++;
      }
      if (t > 2.7) endAttack(now, 1);
      return;
    }

    // Hardens into obsidian and ricochets round the arena for 10s at 1.5x a player's speed.
    if (a.kind === 'obsidian') {
      m.obsidian = clamp(t / 0.9, 0, 1);
      if (t < 0.9) {
        if (near) m.lookDir = aimAt(m, near.p);
        return;
      }
      if (!a.vx && !a.vy) {
        const d = near ? aimAt(m, near.p) : { x: 1, y: 0.4 };
        const sp = HM.speed(PLAYER_SPEED * 1.5);
        a.vx = d.x * sp; a.vy = d.y * sp;
        sweep(300, 90, 0.35, 'square', 0.3);
      }
      const lead = MON_SIZE * 0.75;
      let nx = m.x + a.vx * dt, ny = m.y;
      if (!bossCanOccupyPoint(nx + Math.sign(a.vx) * lead, ny) || !bossCanOccupyPoint(nx + Math.sign(a.vx) * lead, ny - lead * 0.6) || !bossCanOccupyPoint(nx + Math.sign(a.vx) * lead, ny + lead * 0.6)) {
        spawnBurst(m.x + Math.sign(a.vx) * lead, m.y);
        a.vx = -a.vx; nx = m.x; playTone(120, 0.1, 'square', 0.18);
      }
      ny = m.y + a.vy * dt;
      if (!bossCanOccupyPoint(nx, ny + Math.sign(a.vy) * lead) || !bossCanOccupyPoint(nx - lead * 0.6, ny + Math.sign(a.vy) * lead) || !bossCanOccupyPoint(nx + lead * 0.6, ny + Math.sign(a.vy) * lead)) {
        spawnBurst(m.x, m.y + Math.sign(a.vy) * lead);
        a.vy = -a.vy; ny = m.y; playTone(120, 0.1, 'square', 0.18);
      }
      m.x = nx; m.y = ny;
      m.lookDir = { x: a.vx, y: a.vy };
      if (t > 10.9) endAttack(now, 1);
      return;
    }

    if (a.kind === 'magma') {
      if (near) m.lookDir = aimAt(m, near.p);
      if (t > 2.8) endAttack(now, 1);
      return;
    }

    if (a.kind === 'shockwave') {
      if (a.ring === 0 && t >= 0.85) {
        hazards.push({ type: 'ring', x: m.x, y: m.y, r: 18, gap: Math.random() * Math.PI * 2, gapW: 1.25, speed: 165, max: 470 });
        a.ring = 1;
        sweep(200, 60, 0.4, 'sawtooth', 0.25);
      }
      if (a.ring === 1 && t >= 1.9) {
        hazards.push({ type: 'ring', x: m.x, y: m.y, r: 18, gap: Math.random() * Math.PI * 2, gapW: 1.1, speed: 165, max: 470 });
        a.ring = 2;
        sweep(200, 60, 0.4, 'sawtooth', 0.25);
      }
      if (t > 4.2) endAttack(now, 1);
      return;
    }

    if (a.kind === 'slam') {
      if (a.fired === 0 && t >= 1.6) { planSlam(now); a.fired = 1; playWarn(); }
      if (t > 3.2) endAttack(now, 1);
      return;
    }

    if (a.kind === 'spin') {
      if (t >= 0.6) {
        a.spinAngle = (a.spinAngle || 0) + dt * 2.3;
        if (near && now >= m.nextRepathAt) {
          m.nextRepathAt = now + REPATH_MS;
          const st = worldToTile(m.x, m.y), gt = worldToTile(near.p.x, near.p.y);
          const path = bfsPath(st.x, st.y, gt.x, gt.y);
          m.path = path || []; m.pathIndex = 0;
        }
        followPath(m, HM.speed(PLAYER_SPEED * BOSS.speed * 0.45), dt);
      }
      if (t > 3.8) endAttack(now, 1);
      return;
    }

    endAttack(now, 1);
  }

  function hurtsPlayer(p, now) { return !p.caught && !isInSafeZone(p) && now >= p.invulnerableUntil; }

  function updateHazards(now, dt) {
    for (let i = hazards.length - 1; i >= 0; i--) {
      const h = hazards[i];
      if (h.type === 'proj') {
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (STYLE === 'ashen' && Math.random() < dt * 40) spawnEmber(h.x, h.y, false);
        const t = worldToTile(h.x, h.y);
        if (tileChar(t.x, t.y) === '#' || (tileChar(t.x, t.y) === 'D' && !doorUnlocked) || now - h.born > 6000) { spawnBurst(h.x, h.y); hazards.splice(i, 1); continue; }
        players.forEach((p) => {
          if (hurtsPlayer(p, now) && Math.hypot(p.x - h.x, p.y - h.y) < h.r + PLAYER_RADIUS * 0.8) { triggerCaught(p, now); h.dead = true; }
        });
        if (h.dead) hazards.splice(i, 1);
      } else if (h.type === 'ring') {
        h.r += h.speed * dt;
        if (h.r > h.max) { hazards.splice(i, 1); continue; }
        players.forEach((p) => {
          if (!hurtsPlayer(p, now)) return;
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (Math.abs(d - h.r) > 9 + PLAYER_RADIUS * 0.6) return;
          let diff = Math.atan2(p.y - h.y, p.x - h.x) - h.gap;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(diff) > h.gapW / 2) triggerCaught(p, now);
        });
      } else if (h.type === 'circle') {
        if (now >= h.armAt && !h.boomed) { h.boomed = true; playBlast(); spawnBurst(h.x, h.y); }
        if (h.boomed) {
          players.forEach((p) => {
            if (hurtsPlayer(p, now) && Math.hypot(p.x - h.x, p.y - h.y) < h.r) triggerCaught(p, now);
          });
        }
        if (now >= h.until) hazards.splice(i, 1);
      } else if (h.type === 'blob') {
        if (now >= h.armAt && !h.boomed) {
          h.boomed = true;
          playBlast();
          for (let k = 0; k < 3; k++) spawnBurst(h.x + (Math.random() - 0.5) * 30, h.y + (Math.random() - 0.5) * 30);
          if (STYLE === 'ashen') spawnEmberBurst(h.x, h.y, 30);
        }
        if (h.boomed) {
          if (STYLE === 'ashen' && Math.random() < dt * 14) spawnEmber(h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r, false);
          players.forEach((p) => {
            if (hurtsPlayer(p, now) && Math.hypot(p.x - h.x, p.y - h.y) < h.r - 2) triggerCaught(p, now);
          });
        }
        if (now >= h.until) hazards.splice(i, 1);
      }
    }
    // spinning blades
    if (boss && boss.phase === 'attack' && boss.atk && boss.atk.kind === 'spin' && (now - boss.atk.start) / 1000 >= 0.6) {
      const len = MON_SIZE + 78;
      for (let k = 0; k < 3; k++) {
        const ang = (boss.atk.spinAngle || 0) + k * (Math.PI * 2 / 3);
        const ex = boss.x + Math.cos(ang) * len, ey = boss.y + Math.sin(ang) * len;
        players.forEach((p) => {
          if (!hurtsPlayer(p, now)) return;
          const vx = ex - boss.x, vy = ey - boss.y;
          const tt = clamp(((p.x - boss.x) * vx + (p.y - boss.y) * vy) / (vx * vx + vy * vy), 0, 1);
          if (Math.hypot(p.x - (boss.x + vx * tt), p.y - (boss.y + vy * tt)) < PLAYER_RADIUS + 5) triggerCaught(p, now);
        });
      }
    }
  }

  function updateBombs(now) {
    if (!IS_BOSS || boss.dead) return;
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      const taker = players.find((p) => !p.caught && !p.bomb && Math.hypot(p.x - b.x, p.y - b.y) < 16);
      if (taker) { taker.bomb = true; bombs.splice(i, 1); playBombPick(); spawnFloatingText(b.x, b.y, 'BOMB'); bombRespawnAt = now + 3000; }
    }
    if (!COUGH_MODE && bombs.length < BOSS_TARGET_BOMBS && now >= bombRespawnAt) { spawnBomb(); bombRespawnAt = now + 1500; }
    // land a held bomb on a worn-out boss
    if (boss.phase === 'tired' && now >= boss.invulUntil) {
      players.forEach((p) => {
        if (!p.bomb || p.caught) return;
        if (Math.hypot(p.x - boss.x, p.y - boss.y) < MON_SIZE + 18) {
          p.bomb = false;
          boss.hp = Math.max(0, boss.hp - BOSS.bombDmg);
          boss.flash = 1;
          boss.invulUntil = now + 900;
          playBlast();
          spawnBurst(boss.x, boss.y);
          if (STYLE === 'ashen') spawnEmberBurst(boss.x, boss.y, 40);
          spawnFloatingText(boss.x, boss.y - MON_SIZE - 6, boss.hp > 0 ? `-${BOSS.bombDmg} HP` : 'DOWN!');
          if (boss.hp <= 0) killBoss(now);
        }
      });
    }
  }

  function killBoss(now) {
    boss.dead = true;
    boss.phase = 'dead';
    boss.diedAt = now;
    boss.tired = false;
    boss.obsidian = 0;
    hazards = [];
    bombs = [];
    doorUnlocked = true;
    for (let i = 0; i < 4; i++) setTimeout(() => { spawnBurst(boss.x + (Math.random() - 0.5) * MON_SIZE * 2, boss.y + (Math.random() - 0.5) * MON_SIZE * 2); playBlast(); }, i * 220);
    playDoorUnlockChime();
    spawnFloatingText(boss.x, boss.y - MON_SIZE - 20, 'EXIT OPEN');
    const gun = DESIGN.reward && DESIGN.reward.gun;
    if (gun && window.GoofyStory && !TEST_MODE && !window.GoofyStory.isGunUnlocked(gun)) {
      window.GoofyStory.unlockGun(gun);
      spawnFloatingText(boss.x, boss.y - MON_SIZE - 40, gun.toUpperCase() + ' FOUND! (R)');
    }
  }

  // ---- particles ----
  function spawnBloodEffect(x, y) {
    bloodSplatters.push({ x, y, seed: Math.random() * 1000 });
    if (bloodSplatters.length > 24) bloodSplatters.shift();
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, maxLife: 0.35 + Math.random() * 0.45, size: 2 + Math.random() * 2.5, color: '#a01020' });
    }
  }
  function spawnBurst(x, y) {
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 60 + Math.random() * 200;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, maxLife: 0.3 + Math.random() * 0.5, size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? '#ffb43d' : '#ff5a2a' });
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
  function drawBloodSplatters(g) {
    bloodSplatters.forEach((b) => {
      g.save();
      g.translate(b.x, b.y);
      g.fillStyle = 'rgba(110,10,20,0.55)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + b.seed;
        const r = 5 + ((b.seed * (i + 3)) % 9);
        g.beginPath();
        g.arc(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, 2 + (i % 3), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    });
  }
  function drawParticles(g) {
    particles.forEach((pt) => {
      g.globalAlpha = 1 - pt.life / pt.maxLife;
      g.fillStyle = pt.color;
      g.beginPath();
      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      g.fill();
    });
    g.globalAlpha = 1;
  }
  function drawFloatingTexts(g) {
    floatingTexts.forEach((f) => {
      const k = f.life / f.maxLife;
      g.save();
      g.globalAlpha = 1 - k * k;
      g.font = 'bold 12px monospace';
      g.textAlign = 'center';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.strokeText(f.text, f.x, f.y - k * 24);
      g.fillStyle = '#ffd27a';
      g.fillText(f.text, f.x, f.y - k * 24);
      g.restore();
    });
  }

  // =====================================================================
  //  Rendering
  // =====================================================================
  // =====================================================================
  //  The Ashen look: obsidian floor, glowing magma cracks, drifting embers.
  //  (Ported from the Ashen One's arena, js/game5.js.)
  // =====================================================================
  const OBSIDIAN = ['#25222d', '#2a2634', '#2f2a3a', '#272330', '#322c40', '#2b2736'];
  function drawObsidianSheen(g, tx, ty, px, py) {
    const h = Math.imul(tx + 7, 374761393) ^ Math.imul(ty + 3, 668265263);
    const r1 = ((h ^ (h >>> 13)) >>> 0) % 1000 / 1000;
    const r2 = ((h >>> 7) >>> 0) % 1000 / 1000;
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(px, py, TILE, 1.5);
    g.fillRect(px, py, 1.5, TILE);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(px, py + TILE - 1.5, TILE, 1.5);
    g.fillRect(px + TILE - 1.5, py, 1.5, TILE);
    g.strokeStyle = `rgba(200,185,240,${0.1 + 0.12 * r1})`;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(px + TILE * (0.1 + 0.4 * r2), py + TILE * 0.95);
    g.lineTo(px + TILE * (0.5 + 0.4 * r2), py + TILE * 0.05);
    g.stroke();
    if (r1 > 0.78) {
      g.fillStyle = 'rgba(220,200,255,0.3)';
      g.fillRect(px + TILE * 0.2, py + TILE * 0.2, 4, 4);
    }
  }

  const crackPts = [];
  let crackCrust = null, crackHot = null, crackGlow = null;
  const GLOW_DIV = 4;
  (function bakeMagmaCracks() {
    if (STYLE !== 'ashen') return;
    let seed = 0x5eed1234 ^ (ID * 7919);
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const onFloor = (x, y) => {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS && LEVEL.grid[ty][tx] === '.';
    };
    const lines = [];
    function walk(x, y, a, steps, w, depth) {
      const pts = [[x, y]];
      for (let i = 0; i < steps; i++) {
        a += (rnd() - 0.5) * 1.2;
        const len = 10 + rnd() * 14;
        const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
        if (!onFloor(nx, ny)) break;
        x = nx; y = ny;
        pts.push([x, y]);
        if (depth < 2 && rnd() < 0.2) walk(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), 3 + Math.floor(rnd() * 5), w * 0.6, depth + 1);
      }
      if (pts.length > 1) lines.push({ pts, w });
    }
    const seeds = Math.max(8, Math.round(floorTiles.length / 38));
    for (let i = 0; i < seeds; i++) {
      let x = 0, y = 0, tries = 0;
      do { x = rnd() * WORLD_W; y = rnd() * WORLD_H; } while (!onFloor(x, y) && ++tries < 60);
      if (tries >= 60) continue;
      const a = rnd() * Math.PI * 2, w = 1.8 + rnd() * 1.1, n = 4 + Math.floor(rnd() * 7);
      walk(x, y, a, n, w, 0);
      walk(x, y, a + Math.PI, n, w, 0);
    }
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    crackCrust = mk(WORLD_W, WORLD_H);
    crackHot = mk(WORLD_W, WORLD_H);
    crackGlow = mk(Math.ceil(WORLD_W / GLOW_DIV), Math.ceil(WORLD_H / GLOW_DIV));
    const stroke = (c, sc, extra, scale) => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      lines.forEach((ln) => {
        const n = ln.pts.length - 1;
        for (let i = 0; i < n; i++) {
          c.beginPath();
          c.moveTo(ln.pts[i][0] * sc, ln.pts[i][1] * sc);
          c.lineTo(ln.pts[i + 1][0] * sc, ln.pts[i + 1][1] * sc);
          c.lineWidth = Math.max(0.6, (ln.w * (1 - 0.65 * (i / n)) + extra) * scale) * sc;
          c.stroke();
        }
      });
    };
    const cc = crackCrust.getContext('2d');
    cc.strokeStyle = 'rgba(14,8,6,0.55)'; stroke(cc, 1, 3, 1);
    const ch = crackHot.getContext('2d');
    ch.strokeStyle = '#6e2610'; stroke(ch, 1, 1.2, 1);
    ch.strokeStyle = '#b8501a'; stroke(ch, 1, 0, 0.65);
    ch.strokeStyle = '#e08a34'; stroke(ch, 1, -1, 0.3);
    const cg = crackGlow.getContext('2d');
    try { cg.filter = 'blur(1.5px)'; } catch (e) { /* no canvas filters: the glow just stays crisp */ }
    cg.strokeStyle = 'rgba(220,90,30,0.45)';
    stroke(cg, 1 / GLOW_DIV, 9, 1);
    lines.forEach((ln) => ln.pts.forEach((pt) => crackPts.push({ x: pt[0], y: pt[1] })));
  })();

  function drawMagmaCracks(g, camX, camY, now) {
    if (!crackCrust) return;
    const x0 = Math.max(0, camX - VIEW_W / 2), y0 = Math.max(0, camY - VIEW_H / 2);
    const w = Math.min(WORLD_W - x0, VIEW_W), h = Math.min(WORLD_H - y0, VIEW_H);
    if (w <= 0 || h <= 0) return;
    g.drawImage(crackCrust, x0, y0, w, h, x0, y0, w, h);
    const pulse = 0.8 + 0.14 * Math.sin(now * 0.0031) + 0.04 * Math.sin(now * 0.011);
    g.save();
    g.globalAlpha = 0.6 * pulse;
    g.drawImage(crackHot, x0, y0, w, h, x0, y0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 * pulse;
    g.drawImage(crackGlow, x0 / GLOW_DIV, y0 / GLOW_DIV, w / GLOW_DIV, h / GLOW_DIV, x0, y0, w, h);
    g.restore();
  }

  const EMBER_CAP = 260;
  function spawnEmber(x, y, burst) {
    if (STYLE !== 'ashen' || embers.length >= EMBER_CAP) return;
    const a = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const sp = burst ? 40 + Math.random() * 120 : 14 + Math.random() * 34;
    embers.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (burst ? 30 : 0), life: 0,
      maxLife: burst ? 0.5 + Math.random() * 0.8 : 1.3 + Math.random() * 2.2,
      size: burst ? 1 + Math.random() * 1.6 : 0.8 + Math.random() * 1.7, wob: Math.random() * 6.28, burst: !!burst,
    });
  }
  function spawnEmberBurst(x, y, n) { for (let i = 0; i < n; i++) spawnEmber(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, true); }
  function updateEmbers(dt) {
    if (STYLE !== 'ashen') return;
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life += dt;
      if (e.life >= e.maxLife) { embers.splice(i, 1); continue; }
      e.x += (e.vx + Math.sin(e.life * 3 + e.wob) * 9) * dt;
      e.y += e.vy * dt;
      const drag = Math.min(1, dt * (e.burst ? 3 : 0.6));
      e.vx *= 1 - drag; e.vy *= 1 - drag;
      if (!e.burst) e.vy -= 10 * dt;
    }
    const near = (x, y) => players.some((pl) => Math.abs(x - pl.x) < VIEW_W / 2 + 30 && Math.abs(y - pl.y) < VIEW_H / 2 + 30);
    let budget = dt * 38 * PLAYER_MODE;
    while (budget > 0) {
      if (Math.random() > budget) break;
      budget -= 1;
      let src = null;
      if (Math.random() < 0.8 && crackPts.length) src = crackPts[Math.floor(Math.random() * crackPts.length)];
      else if (lavaTiles.length) { const l = lavaTiles[Math.floor(Math.random() * lavaTiles.length)]; src = tileCenter(l.x, l.y); }
      if (src && near(src.x, src.y)) spawnEmber(src.x + (Math.random() - 0.5) * 6, src.y + (Math.random() - 0.5) * 4, false);
    }
    if (crackPts.length && Math.random() < dt * 2.2) {
      const src = crackPts[Math.floor(Math.random() * crackPts.length)];
      if (near(src.x, src.y)) spawnEmberBurst(src.x, src.y, 5 + Math.floor(Math.random() * 5));
    }
  }

  function softGlow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function lerpHexLocal(a, b, v) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * v);
    return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
  }

  // Everything that burns is a light source, so it's drawn over the darkness:
  // lava tiles, fireballs, magma puddles and embers.
  function drawEmissive(g, camX, camY, now) {
    const minTX = Math.max(0, Math.floor((camX - VIEW_W / 2) / TILE) - 1), maxTX = Math.min(COLS - 1, Math.ceil((camX + VIEW_W / 2) / TILE) + 1);
    const minTY = Math.max(0, Math.floor((camY - VIEW_H / 2) / TILE) - 1), maxTY = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H / 2) / TILE) + 1);
    // lava floor
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        if (LEVEL.grid[y][x] !== 'L') continue;
        const px = x * TILE, py = y * TILE;
        const flow = 0.5 + 0.5 * Math.sin(now * 0.0018 + x * 1.7 + y * 2.3);
        const grd = g.createLinearGradient(px, py, px + TILE, py + TILE);
        grd.addColorStop(0, lerpHexLocal('#8a2208', '#e0561a', flow));
        grd.addColorStop(1, lerpHexLocal('#b83a0e', '#ffb43d', 1 - flow));
        g.fillStyle = grd;
        g.fillRect(px, py, TILE, TILE);
        // darker crust drifting on top
        g.fillStyle = 'rgba(40,12,6,0.55)';
        for (let k = 0; k < 3; k++) {
          const ox = (Math.sin(now * 0.0004 + (x + y * 3) * 1.3 + k * 2.1) * 0.5 + 0.5) * (TILE - 12);
          const oy = (Math.cos(now * 0.0005 + (x * 2 + y) * 1.1 + k * 1.7) * 0.5 + 0.5) * (TILE - 10);
          g.beginPath(); g.ellipse(px + 6 + ox, py + 5 + oy, 5 + (k % 2) * 2, 3.5, k, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(255,230,140,0.5)';
        g.fillRect(px + (Math.sin(now * 0.002 + x + y) * 0.5 + 0.5) * (TILE - 4), py + (Math.cos(now * 0.0023 + x * y) * 0.5 + 0.5) * (TILE - 4), 2, 2);
      }
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        if (LEVEL.grid[y][x] === 'L') softGlow(g, x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 1.5, '255,100,30', 0.32);
      }
    }
    hazards.forEach((h) => {
      if (h.type === 'proj') softGlow(g, h.x, h.y, 24, '255,140,50', 0.5);
      else if (h.type === 'blob' && h.boomed) softGlow(g, h.x, h.y, h.r * 1.7, '255,110,30', 0.5 * Math.min(1, (h.until - now) / 380));
    });
    embers.forEach((e) => {
      if (Math.abs(e.x - camX) > VIEW_W / 2 + 10 || Math.abs(e.y - camY) > VIEW_H / 2 + 10) return;
      const k = e.life / e.maxLife;
      const flick = 0.75 + 0.25 * Math.sin(now * 0.04 + e.wob * 7);
      const r = e.size * (1 - 0.5 * k);
      g.globalAlpha = Math.min(1, (1 - k) * 1.3) * flick;
      g.fillStyle = k < 0.25 ? '#fff2b0' : k < 0.6 ? '#ffa030' : '#e8481a';
      g.beginPath(); g.arc(e.x, e.y, r, 0, Math.PI * 2); g.fill();
      if (r > 1.4) { g.globalAlpha *= 0.28; g.beginPath(); g.arc(e.x, e.y, r * 3, 0, Math.PI * 2); g.fill(); }
    });
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
          g.fillStyle = STYLE === 'ashen' ? '#1d1a22' : CHAP.wall;
          g.fillRect(px, py, TILE, TILE);
          const below = tileChar(x, y + 1);
          if (below !== '#') {
            // the lit face of the wall, where it meets the floor
            g.fillStyle = STYLE === 'ashen' ? '#2c2733' : CHAP.wallTop;
            g.fillRect(px, py + TILE - 10, TILE, 10);
            g.fillStyle = 'rgba(0,0,0,0.25)';
            g.fillRect(px, py + TILE - 2, TILE, 2);
          }
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          continue;
        }
        if (ch === 'L') { g.fillStyle = '#1a0c08'; g.fillRect(px, py, TILE, TILE); continue; } // drawn emissive, over the dark
        g.fillStyle = (ch === 'D' && !doorUnlocked) ? '#3a4552' : (STYLE === 'ashen' ? OBSIDIAN[hash2(x, y) % OBSIDIAN.length] : CHAP.floor[hash2(x, y) % CHAP.floor.length]);
        g.fillRect(px, py, TILE, TILE);
        if (STYLE === 'ashen' && (ch === '.' || ch === 'S' || (ch === 'D' && doorUnlocked))) drawObsidianSheen(g, x, y, px, py);
        if (ch === 'S') {
          g.fillStyle = 'rgba(61,220,132,0.1)';
          g.fillRect(px, py, TILE, TILE);
          g.strokeStyle = '#3ddc84';
          g.lineWidth = 3;
          g.shadowColor = '#3ddc84';
          g.shadowBlur = 6;
          g.beginPath();
          if (tileChar(x, y - 1) !== 'S') { g.moveTo(px, py + 1.5); g.lineTo(px + TILE, py + 1.5); }
          if (tileChar(x, y + 1) !== 'S') { g.moveTo(px, py + TILE - 1.5); g.lineTo(px + TILE, py + TILE - 1.5); }
          if (tileChar(x - 1, y) !== 'S') { g.moveTo(px + 1.5, py); g.lineTo(px + 1.5, py + TILE); }
          if (tileChar(x + 1, y) !== 'S') { g.moveTo(px + TILE - 1.5, py); g.lineTo(px + TILE - 1.5, py + TILE); }
          g.stroke();
          g.shadowBlur = 0;
        }
        if (ch === 'D' && !doorUnlocked) {
          g.strokeStyle = '#0d1114';
          g.lineWidth = 3;
          g.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
          g.strokeStyle = 'rgba(255,190,60,0.55)';
          g.lineWidth = 2;
          g.strokeRect(px + 8, py + 8, TILE - 16, TILE - 16);
        } else if (ch === 'D') {
          g.strokeStyle = 'rgba(255,255,255,0.12)';
          g.lineWidth = 2;
          g.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
        }
      }
    }

    if (STYLE === 'ashen') drawMagmaCracks(g, camX, camY, now);

    // exit
    LEVEL.exits.forEach((e) => {
      const c = tileCenter(e.x, e.y);
      const open = exitOpen();
      const pulse = open ? 1 + Math.sin(now / 260) * 0.15 : 1;
      g.beginPath();
      g.arc(c.x, c.y, (open ? 12 : 6) * pulse, 0, Math.PI * 2);
      g.fillStyle = open ? '#ffd27a' : '#5a4a30';
      g.fill();
      if (open) {
        g.strokeStyle = 'rgba(255,210,122,0.5)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(c.x, c.y, 18 * pulse, 0, Math.PI * 2); g.stroke();
      }
    });

    // keys
    LEVEL.keys.forEach((k, i) => {
      if (keysTaken[i]) return;
      const c = tileCenter(k.x, k.y);
      const bob = Math.sin(now / 300 + i) * 2.5;
      g.save();
      g.translate(c.x, c.y + bob);
      g.shadowColor = '#ffd27a';
      g.shadowBlur = 10;
      g.fillStyle = '#ffd27a';
      g.beginPath(); g.arc(-4, 0, 5, 0, Math.PI * 2); g.fill();
      g.fillRect(-1, -1.6, 12, 3.2);
      g.fillRect(7, 0, 2.6, 5);
      g.fillRect(3, 0, 2.6, 4);
      g.shadowBlur = 0;
      g.fillStyle = '#12090a';
      g.beginPath(); g.arc(-4, 0, 1.8, 0, Math.PI * 2); g.fill();
      g.restore();
    });

    drawBloodSplatters(g);
    drawBombsOnFloor(g, now);
    drawFloatingTexts(g);
  }

  function drawBombIcon(g, x, y, now, seed) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#16161a';
    g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a4a55'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.arc(-2.5, -2.5, 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#a58a4a'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(3, -6); g.quadraticCurveTo(7, -10, 9, -8); g.stroke();
    if (Math.floor(now / 110 + seed) % 2) {
      g.fillStyle = '#ffb43d';
      g.shadowColor = '#ff7a2a'; g.shadowBlur = 8;
      g.beginPath(); g.arc(9, -8, 2.2, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function drawBombsOnFloor(g, now) {
    bombs.forEach((b) => drawBombIcon(g, b.x, b.y + Math.sin(now / 350 + b.seed) * 1.5, now, b.seed));
  }

  function drawHazards(g, now) {
    hazards.forEach((h) => {
      if (h.type === 'proj') {
        const gr = g.createRadialGradient(h.x, h.y, 1, h.x, h.y, h.r * 2.4);
        gr.addColorStop(0, 'rgba(255,230,160,1)');
        gr.addColorStop(0.35, 'rgba(255,120,40,0.9)');
        gr.addColorStop(1, 'rgba(255,60,20,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(h.x, h.y, h.r * 2.4, 0, Math.PI * 2); g.fill();
      } else if (h.type === 'ring') {
        g.save();
        g.lineWidth = 9;
        g.strokeStyle = 'rgba(255,90,60,0.85)';
        g.shadowColor = '#ff4a2a'; g.shadowBlur = 12;
        g.beginPath();
        g.arc(h.x, h.y, h.r, h.gap + h.gapW / 2, h.gap - h.gapW / 2 + Math.PI * 2);
        g.stroke();
        g.restore();
      } else if (h.type === 'blob') {
        const sinceLaunch = now - h.launchAt;
        if (sinceLaunch >= 0 && sinceLaunch < 450) { // the blob leaving the boss, shot up into the air
          const f = sinceLaunch / 450;
          g.save();
          g.globalAlpha = 1 - f;
          softGlow(g, h.sx, h.sy - 90 * f, 22, '255,130,30', 0.9);
          g.fillStyle = '#ff8a22';
          g.beginPath(); g.arc(h.sx, h.sy - 90 * f, 9 * (1 - f * 0.4), 0, Math.PI * 2); g.fill();
          g.restore();
        }
        if (sinceLaunch < 0) return;
        if (!h.boomed) { // its shadow on the ground, growing and darkening for 2s
          const k = clamp(sinceLaunch / 2000, 0, 1);
          g.save();
          g.fillStyle = `rgba(0,0,0,${0.18 + 0.32 * k})`;
          g.beginPath(); g.ellipse(h.x, h.y, h.r * (0.3 + 0.7 * k), h.r * (0.3 + 0.7 * k) * 0.86, 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = `rgba(255,${80 + 40 * Math.sin(now / 90)},40,${0.3 + 0.5 * k})`;
          g.lineWidth = 2; g.setLineDash([6, 5]);
          g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke();
          g.setLineDash([]);
          const fall = (h.armAt - now) / 380; // the glob dropping in at the very end
          if (fall > 0 && fall <= 1) {
            softGlow(g, h.x, h.y - 150 * fall, 26, '255,130,30', 0.9);
            g.fillStyle = '#ff8a22';
            g.beginPath(); g.arc(h.x, h.y - 150 * fall, 11, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#ffd25a';
            g.beginPath(); g.arc(h.x - 2, h.y - 150 * fall - 2, 5, 0, Math.PI * 2); g.fill();
          }
          g.restore();
        } else { // the puddle
          const fade = clamp((h.until - now) / 380, 0, 1);
          g.save();
          g.globalAlpha = fade;
          const gr = g.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r);
          gr.addColorStop(0, '#ffe08a');
          gr.addColorStop(0.45, '#ff8a22');
          gr.addColorStop(0.85, '#b8380e');
          gr.addColorStop(1, '#3a1208');
          g.fillStyle = gr;
          g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,230,140,0.55)';
          for (let b = 0; b < 5; b++) {
            const a = now / 600 + b * 1.9, rr = h.r * (0.2 + 0.5 * ((Math.sin(now / 280 + b * 2.3) + 1) / 2));
            g.beginPath(); g.arc(h.x + Math.cos(a) * rr * 0.8, h.y + Math.sin(a) * rr * 0.8, 3 + (b % 2) * 2, 0, Math.PI * 2); g.fill();
          }
          g.restore();
        }
      } else if (h.type === 'circle') {
        const k = h.boomed ? 1 : clamp(1 - (h.armAt - now) / 1000, 0, 1);
        g.save();
        if (!h.boomed) {
          g.strokeStyle = 'rgba(255,60,60,0.8)'; g.lineWidth = 2; g.setLineDash([6, 5]);
          g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke();
          g.setLineDash([]);
          g.fillStyle = 'rgba(255,60,60,0.22)';
          g.beginPath(); g.arc(h.x, h.y, h.r * k, 0, Math.PI * 2); g.fill();
        } else {
          const gr = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
          gr.addColorStop(0, 'rgba(255,240,180,0.95)');
          gr.addColorStop(0.6, 'rgba(255,120,40,0.8)');
          gr.addColorStop(1, 'rgba(255,60,20,0.1)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }
    });
    // charge telegraph + spin blades
    if (boss && boss.phase === 'attack' && boss.atk) {
      const a = boss.atk;
      const t = (now - a.start) / 1000;
      if (a.kind === 'charge' && t < 0.95 && a.dir) {
        g.save();
        g.strokeStyle = `rgba(255,60,60,${0.25 + 0.3 * Math.sin(now / 60)})`;
        g.lineWidth = MON_SIZE * 1.4;
        g.lineCap = 'butt';
        g.beginPath(); g.moveTo(boss.x, boss.y); g.lineTo(boss.x + a.dir.x * 420, boss.y + a.dir.y * 420); g.stroke();
        g.restore();
      }
      if (a.kind === 'shockwave' && a.ring === 0) {
        g.save();
        g.strokeStyle = `rgba(255,120,60,${0.2 + 0.3 * Math.sin(now / 70)})`;
        g.lineWidth = 3; g.setLineDash([8, 8]);
        g.beginPath(); g.arc(boss.x, boss.y, MON_SIZE + 24 + (t / 0.85) * 40, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      if (a.kind === 'spin') {
        const len = MON_SIZE + 78;
        const live = t >= 0.6;
        for (let k = 0; k < 3; k++) {
          const ang = (a.spinAngle || 0) + k * (Math.PI * 2 / 3);
          g.save();
          g.strokeStyle = live ? 'rgba(255,90,70,0.9)' : 'rgba(255,90,70,0.3)';
          g.lineWidth = live ? 9 : 4;
          g.lineCap = 'round';
          if (live) { g.shadowColor = '#ff4a2a'; g.shadowBlur = 10; }
          g.beginPath(); g.moveTo(boss.x + Math.cos(ang) * MON_SIZE * 0.6, boss.y + Math.sin(ang) * MON_SIZE * 0.6);
          g.lineTo(boss.x + Math.cos(ang) * len, boss.y + Math.sin(ang) * len); g.stroke();
          g.restore();
        }
      }
    }
  }

  function drawMonsters(g, now) {
    monsters.forEach((m) => {
      if (m.dead) {
        const k = clamp((now - m.diedAt) / 1500, 0, 1);
        if (k >= 1) return;
        g.save();
        g.globalAlpha = 1 - k;
        window.CustomMonster.draw(g, MON, { x: m.x, y: m.y, t: now / 1000, look: m.lookDir, flash: 1 - k });
        g.restore();
        return;
      }
      const rage = m.state === 'alert' ? 1 : 0;
      HM.monster(g, m, (c) => window.CustomMonster.draw(c, MON, {
        x: m.x, y: m.y, t: now / 1000 + m.seed, look: m.lookDir, rage, tired: m.tired, flash: m.flash, obsidian: m.obsidian || 0,
      }));
    });
  }

  function drawPlayers(g, now) {
    players.forEach((p) => {
      window.PlayerModel.draw(g, PLAYER_RADIUS, { x: p.x, y: p.y, color: p.color, facing: p.facing, walkPhase: p.walkPhase });
      if (p.bomb) drawBombIcon(g, p.x, p.y - 22 + Math.sin(now / 200) * 1.5, now, 0);
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

  // monsters that eat the light shrink a player's flashlight as they close in
  function auraFactor(p) {
    if (!AI.aura) return 1;
    let f = 1;
    monsters.forEach((m) => {
      if (m.dead) return;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < 230) f = Math.min(f, 0.4 + 0.6 * (d / 230));
    });
    return f;
  }

  function buildDarknessMask(camX, camY, now) {
    const w2s = (wx, wy) => ({ x: wx - camX + VIEW_W / 2, y: wy - camY + VIEW_H / 2 });
    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    // boss arenas are dim rather than pitch black, so the attacks stay readable
    maskCtx.fillStyle = IS_BOSS ? 'rgba(0,0,0,0.74)' : '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    LD.lights(maskCtx, camX, camY, VIEW_W, VIEW_H, now, punchLight);

    // safe rooms are always lit
    const minTX = Math.max(0, Math.floor((camX - VIEW_W / 2) / TILE) - 1), maxTX = Math.min(COLS - 1, Math.ceil((camX + VIEW_W / 2) / TILE) + 1);
    const minTY = Math.max(0, Math.floor((camY - VIEW_H / 2) / TILE) - 1), maxTY = Math.min(ROWS - 1, Math.ceil((camY + VIEW_H / 2) / TILE) + 1);
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fillStyle = 'rgba(0,0,0,1)';
    for (let y = minTY; y <= maxTY; y++) for (let x = minTX; x <= maxTX; x++) {
      if (LEVEL.grid[y][x] === 'S') { const s = w2s(x * TILE, y * TILE); maskCtx.fillRect(s.x, s.y, TILE, TILE); }
    }
    maskCtx.restore();

    LEVEL.keys.forEach((k, i) => {
      if (keysTaken[i]) return;
      const c = tileCenter(k.x, k.y); const s = w2s(c.x, c.y);
      punchLight(maskCtx, s.x, s.y, 46, 0.55);
    });
    if (exitOpen()) LEVEL.exits.forEach((e) => { const c = tileCenter(e.x, e.y); const s = w2s(c.x, c.y); punchLight(maskCtx, s.x, s.y, 70, 0.6); });
    bombs.forEach((b) => { const s = w2s(b.x, b.y); punchLight(maskCtx, s.x, s.y, 40, 0.6); });
    // a monster that's glowing/alert is a little visible even in the dark
    monsters.forEach((m) => { if (m.state === 'alert' && !m.dead) { const s = w2s(m.x, m.y); punchLight(maskCtx, s.x, s.y, 54, 0.35); } });
    hazards.forEach((h) => { if (h.type === 'proj' || (h.type === 'circle' && h.boomed)) { const s = w2s(h.x, h.y); punchLight(maskCtx, s.x, s.y, 60, 0.7); } });

    players.forEach((pl) => {
      const s = w2s(pl.x, pl.y);
      const k = auraFactor(pl);
      punchLight(maskCtx, s.x, s.y, 90 * k * HM.flicker(pl), 1);
      punchLight(maskCtx, s.x, s.y, 230 * k * HM.flicker(pl), 0.85);
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
      ctx.beginPath();
      ctx.arc(mx + (pl.x / WORLD_W) * MINIMAP_W, my + (pl.y / WORLD_H) * mh, 2.2, 0, Math.PI * 2);
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
    ctx.fillStyle = p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';
    ctx.fillRect(bx, by, barW * frac, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
  }

  function drawBossBar(vx) {
    if (!boss) return;
    const w = Math.min(VIEW_W - 150, 240), h = 10;
    const x = vx + VIEW_W / 2 - w / 2 + 40, y = 12;
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.7)';
    ctx.fillRect(x - 3, y - 14, w + 6, h + 20);
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ece3f0';
    ctx.fillText(MON.name || 'Boss', x, y - 3);
    ctx.fillStyle = '#2a1a1c';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = boss.tired ? '#ffd27a' : '#d9453a';
    ctx.fillRect(x, y, w * clamp(boss.hp / BOSS.hp, 0, 1), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    for (let i = BOSS.bombDmg; i < BOSS.hp; i += BOSS.bombDmg) {
      ctx.beginPath(); ctx.moveTo(x + (w * i) / BOSS.hp, y); ctx.lineTo(x + (w * i) / BOSS.hp, y + h); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
    }
    ctx.restore();
  }

  function drawProximityWarning(vx, dist) {
    const R = 400;
    if (dist > R) return;
    window.ScreenFx.proximity(ctx, vx, 0, VIEW_W, VIEW_H, 1 - dist / R);
  }

  function drawJaw(g, vx, direction, progress, color) {
    const teeth = 8, toothW = VIEW_W / teeth;
    const reach = progress * (VIEW_H / 2 + 24);
    g.fillStyle = color;
    g.beginPath();
    if (direction === 1) {
      g.moveTo(vx, 0); g.lineTo(vx + VIEW_W, 0); g.lineTo(vx + VIEW_W, Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) g.lineTo(vx + i * toothW, reach + (i % 2 === 0 ? 14 : -6));
      g.lineTo(vx, 0);
    } else {
      g.moveTo(vx, VIEW_H); g.lineTo(vx + VIEW_W, VIEW_H); g.lineTo(vx + VIEW_W, VIEW_H - Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) g.lineTo(vx + i * toothW, VIEW_H - reach - (i % 2 === 0 ? 14 : -6));
      g.lineTo(vx, VIEW_H);
    }
    g.closePath();
    g.fill();
  }
  function drawBurnOverlay(vx, p, now) {
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    const gr = ctx.createLinearGradient(0, VIEW_H, 0, 0);
    gr.addColorStop(0, `rgba(255,120,20,${0.85 * Math.min(1, t * 2)})`);
    gr.addColorStop(0.6, `rgba(180,40,10,${0.55 * t})`);
    gr.addColorStop(1, `rgba(30,6,4,${0.7 * t})`);
    ctx.fillStyle = gr;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    // flame tongues licking up from the bottom edge
    const reach = (0.25 + 0.75 * Math.min(1, t * 1.6)) * VIEW_H;
    for (let i = 0; i < 18; i++) {
      const fx = vx + (i + 0.5) * (VIEW_W / 18);
      const hh = reach * (0.45 + 0.55 * Math.abs(Math.sin(now * 0.012 + i * 1.7)));
      ctx.fillStyle = i % 2 ? '#ff8a1e' : '#ffd25a';
      ctx.beginPath();
      ctx.moveTo(fx - VIEW_W / 40, VIEW_H);
      ctx.quadraticCurveTo(fx + Math.sin(now * 0.02 + i) * 8, VIEW_H - hh * 0.55, fx, VIEW_H - hh);
      ctx.quadraticCurveTo(fx + VIEW_W / 60, VIEW_H - hh * 0.5, fx + VIEW_W / 40, VIEW_H);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCutsceneOverlay(vx, p, now) {
    if (p.cause === 'lava') { drawBurnOverlay(vx, p, now); return; }
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
    LD.floor(ctx, camX, camY, VIEW_W, VIEW_H, now);
    drawHazards(ctx, now);
    drawMonsters(ctx, now);
    drawPlayers(ctx, now);
    drawParticles(ctx);
    LD.above(ctx, camX, camY, VIEW_W, VIEW_H, now);
    ctx.restore();

    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);
    if (lavaTiles.length || embers.length || hazards.length) {
      ctx.save();
      ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);
      drawEmissive(ctx, camX, camY, now);
      ctx.restore();
    }

    const nearest = Math.min(...monsters.filter((m) => !m.dead).map((m) => Math.hypot(p.x - m.x, p.y - m.y)));
    if (Number.isFinite(nearest)) drawProximityWarning(vx, nearest);
    const minimapH = drawMinimap(vx);
    drawStaminaBar(vx, p, minimapH);
    drawBossBar(vx);
    if (p.caught) drawCutsceneOverlay(vx, p, now);
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
    if (gameState === 'intro') {
      messageEl.style.display = 'none';
    } else if (gameState === 'complete') {
      messageEl.style.display = 'flex';
      const nx = window.GoofyStory ? window.GoofyStory.nextInOrder(ID) : 0;
      const label = TEST_MODE ? 'the designer' : nx ? `Level ${window.GoofyStory.displayNumber(nx)}` : 'the menu';
      messageEl.innerHTML = `${IS_BOSS ? 'MINI BOSS DEFEATED' : 'CLEARED'} &mdash; warping to ${label}&hellip;`;
    } else if (check.errors.length) {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'This level isn’t finished: ' + escapeHtml(check.errors[0]) + ' <a href="editor.html#' + ID + '" style="color:var(--accent)">Open in the editor</a>';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    if (hudObjEl) {
      if (IS_BOSS) {
        hudObjEl.textContent = `Boss: ${boss.hp}/${BOSS.hp} HP`;
        hudObjEl.classList.toggle('done', boss.dead);
      } else {
        const got = keysTaken.filter(Boolean).length;
        hudObjEl.textContent = `Keys: ${got} / ${LEVEL.keys.length}`;
        hudObjEl.classList.toggle('done', got === LEVEL.keys.length);
      }
    }
    if (hudDoorEl) {
      hudDoorEl.textContent = `Exit: ${doorUnlocked ? 'open' : 'locked'}`;
      hudDoorEl.classList.toggle('done', doorUnlocked);
    }
    if (gameState === 'complete' && !bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        if (!TEST_MODE) localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
    }
    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;
  function loop(now) {
    try {
      const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      const playable = !check.errors.length;

      if (gameState === 'intro' && (now - introStartedAt >= INTRO_MS || window.BossCutscene.skipRequested(introStartedAt))) {
        gameState = 'playing';
        runStartTime = now;
        elapsedMs = 0;
        if (boss) boss.phaseAt = now + 1500;
      }

      if (gameState === 'playing' && playable) {
        elapsedMs = now - runStartTime;
        updateInputMovement(now, dt);
        updateKeys(now);
        updateTriggers();
        if (IS_BOSS) {
          updateBoss(now, dt);
          updateHazards(now, dt);
          updateBombs(now);
        } else {
          monsters.forEach((m) => updateMonster(m, now, dt));
        }
        updateLava(now);
        updateCatch(now);
        updateCutscenes(now);
        updateExploration();
        updateAmbientTension();
      }
      updateParticles(dt);
      updateEmbers(dt);
      LD.update(dt, players);
      updateFloatingTexts(dt);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (gameState === 'intro') {
        window.BossCutscene.draw(ctx, canvas.width, canvas.height, now - introStartedAt, 'custom');
      } else {
        renderViewport(0, now);
        if (PLAYER_MODE === 2) {
          renderViewport(1, now);
          drawDivider();
        }
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
