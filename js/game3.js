(function () {
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
  const FREEZE_DURATION_MS = 10000;
  const EAT_DURATION_MS = 3000;
  const CRATE_RESPAWN_MS = 60000;
  const CRATE_ITEMS = ['radar', 'meat', 'co2'];
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

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let ambientOsc = null;
  let ambientGain = null;
  let safeMusicGain = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = new AudioCtor();

    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.05;
    ambientGain.connect(audioCtx.destination);

    ambientOsc = audioCtx.createOscillator();
    ambientOsc.type = 'sine';
    ambientOsc.frequency.value = 55;
    ambientOsc.connect(ambientGain);
    ambientOsc.start();

    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain);
    lfoGain.connect(ambientOsc.frequency);
    lfo.start();

    safeMusicGain = audioCtx.createGain();
    safeMusicGain.gain.value = 0.0001;
    safeMusicGain.connect(audioCtx.destination);
    [261.6, 329.6, 392.0, 523.2].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const voiceGain = audioCtx.createGain();
      voiceGain.gain.value = 0.2;
      const vibrato = audioCtx.createOscillator();
      vibrato.frequency.value = 0.1 + i * 0.03;
      const vibratoGain = audioCtx.createGain();
      vibratoGain.gain.value = 1.5;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();
      osc.connect(voiceGain);
      voiceGain.connect(safeMusicGain);
      osc.start();
    });
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

  function playWinJingle() {
    [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14));
  }

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.min(...players.map((p) => Math.hypot(p.x - monster.x, p.y - monster.y)));
    const proximity = clamp(1 - minDist / 380, 0, 1);
    ambientGain.gain.setTargetAtTime(0.05 + proximity * 0.18, audioCtx.currentTime, 0.3);
    ambientOsc.frequency.setTargetAtTime(55 + proximity * 45, audioCtx.currentTime, 0.3);
  }

  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const keys = {};

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (TRACKED_KEYS.has(e.key)) {
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

  // ---- game state ----
  let generatorProgress = 0;
  let generatorActive = false;
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return { x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0 };
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
    players.forEach(respawnPlayer);

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
    floatingTexts = [];
    resetExploration();
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

  function applyMovement(p, ix, iy, dt) {
    if (ix === 0 && iy === 0) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    movePlayer(p, nx * PLAYER_SPEED * dt, ny * PLAYER_SPEED * dt);
  }

  function updateInputMovement(dt) {
    applyMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), dt);
    applyMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), dt);
  }

  function isInSafeZone(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
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
      if (isInSafeZone(p)) continue;
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
      if (isInSafeZone(p)) return;
      if (now < p.invulnerableUntil) return;
      if (Math.hypot(p.x - monster.x, p.y - monster.y) < CATCH_RADIUS) triggerCaught(p, now);
    });
  }

  function triggerCaught(p, now) {
    catchFlash = 1;
    playCatchSting();
    spawnBloodEffect(p.x, p.y);
    respawnPlayer(p);
    p.invulnerableUntil = now + 1200;
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
    // Body segments, tail first so the head draws on top.
    for (let i = monster.segments.length - 1; i >= 0; i--) {
      const seg = monster.segments[i];
      const r = monster.radius * (1 - i * 0.06);
      g.save();
      g.translate(seg.x, seg.y);
      g.beginPath();
      g.arc(0, 0, Math.max(4, r), 0, Math.PI * 2);
      g.fillStyle = i % 2 === 0 ? '#4a3a1e' : '#5a4726';
      g.shadowColor = '#2a2010';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;
      g.restore();
    }

    g.save();
    g.translate(monster.x, monster.y);

    const points = 10;
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = monster.radius + Math.sin(t * 0.006 + i * 1.7 + monster.seed) * 2.5;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = '#3a2e16';
    g.shadowColor = '#6b5228';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;

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
    const eyeR = monster.radius * 0.62;

    const sclera = g.createRadialGradient(0, 0, 1, 0, 0, eyeR);
    sclera.addColorStop(0, '#f2e6d8');
    sclera.addColorStop(0.75, '#dcc4b2');
    sclera.addColorStop(1, '#7a6252');
    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.fillStyle = sclera;
    g.fill();

    const ix = lookDir.x * eyeR * 0.32, iy = lookDir.y * eyeR * 0.26;
    const irisR = eyeR * 0.48;
    const iris = g.createRadialGradient(ix, iy, 1, ix, iy, irisR);
    iris.addColorStop(0, '#8a6a2e');
    iris.addColorStop(0.6, '#4a3210');
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
    g.arc(ix - irisR * 0.3, iy - irisR * 0.3, irisR * 0.16, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();

    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  function drawPlayers(g) {
    const R = PLAYER_RADIUS;
    players.forEach((p) => {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.facing.y, p.facing.x));

      g.fillStyle = '#2b2b28';
      g.beginPath(); g.ellipse(-R * 0.9, -R * 0.35, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-R * 0.9, R * 0.35, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill();

      g.strokeStyle = '#54544c';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-R * 1.3, -3);
      g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
      g.stroke();
      g.fillStyle = '#54544c';
      g.fillRect(-R * 1.5, -4.5, 7, 9);

      g.beginPath();
      g.ellipse(0, 0, R * 1.05, R * 0.95, 0, 0, Math.PI * 2);
      g.fillStyle = p.color;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1.5;
      g.stroke();

      g.save();
      g.beginPath();
      g.ellipse(0, 0, R * 1.05, R * 0.95, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(20,20,15,0.85)';
      g.fillRect(-R * 1.3, -R * 0.28, R * 2.6, R * 0.2);
      g.fillStyle = 'rgba(255,200,40,0.9)';
      g.fillRect(-R * 1.3, -R * 0.1, R * 2.6, R * 0.1);
      g.restore();

      g.fillStyle = '#e8d94a';
      g.beginPath(); g.arc(-R * 0.15, -R * 0.95, 3.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(-R * 0.15, R * 0.95, 3.4, 0, Math.PI * 2); g.fill();

      g.beginPath();
      g.arc(0, 0, R * 0.8, 0, Math.PI * 2);
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 3;
      g.stroke();

      g.beginPath();
      g.arc(0, 0, R * 0.78, 0, Math.PI * 2);
      g.fillStyle = 'rgba(220,222,210,0.95)';
      g.fill();
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 1.5;
      g.stroke();

      g.beginPath();
      g.ellipse(R * 0.18, 0, R * 0.56, R * 0.44, 0, 0, Math.PI * 2);
      g.fillStyle = '#0d1418';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.ellipse(R * 0.28, -R * 0.14, R * 0.14, R * 0.08, -0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fill();

      g.restore();
    });
  }

  function punchLight(g, x, y, radius, intensity) {
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
    drawMinimap(vx);

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
      messageEl.innerHTML = 'FACILITY CLEARED &mdash; press Enter to replay, or <a href="index.html" style="color:var(--accent)">back to Level 1</a>';
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
  }

  let lastFrameTime = null;

  function loop(now) {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'playing') {
      updateInputMovement(dt);
      updateTriggers();
      updateGenerator(dt);
      updateCrates(now);
      updateVines(now);
      updateMonster(now, dt);
      updateCatch(now);
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
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
