(function () {
  const LEVEL = window.LEVEL2;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 1.25;
  const MONSTER_SPEED = PLAYER_SPEED * 0.7;
  const CATCH_RADIUS = 20;
  const REPATH_MS = 500;
  const DETECT_RADIUS = 150;
  const ALERT_GRACE_MS = 2500;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');
  const hudFuseEl = document.getElementById('hud-fuse');
  const hudDoorEl = document.getElementById('hud-door');

  // Darkness is composited from a separate offscreen mask so that punching
  // light holes (globalCompositeOperation 'destination-out') erases only the
  // mask's own darkness pixels, not the scene already drawn on the main canvas.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let ambientOsc = null;
  let ambientGain = null;

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

  function playWrongSocketBuzz() {
    playTone(140, 0.2, 'square', 0.15);
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

  // ---- game state ----
  let fuseState = 'ground'; // 'ground' | 'carried' | 'installed'
  let fuseCarrier = null; // player object currently holding it
  let activeFuseBox = null; // the randomly chosen real candidate this playthrough
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete'
  let catchFlash = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return { x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0, isMoving: false };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  const monster = {
    x: 0,
    y: 0,
    radius: 16,
    seed: Math.random() * 100,
    path: [],
    pathIndex: 0,
    nextRepathAt: 0,
    lookDir: { x: 1, y: 0 },
    tentacleTargets: [],
    state: 'patrol', // 'patrol' | 'alert'
    alertUntil: 0,
    alertTargetTile: null,
    patrolIndex: 0,
  };

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  function resetLevel() {
    players.forEach(respawnPlayer);

    const m = tileCenter(LEVEL.monsterSpawn.x, LEVEL.monsterSpawn.y);
    monster.x = m.x; monster.y = m.y;
    monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0;
    monster.state = 'patrol'; monster.alertUntil = 0; monster.alertTargetTile = null; monster.patrolIndex = 0;

    fuseState = 'ground';
    fuseCarrier = null;
    doorUnlocked = false;
    activeFuseBox = LEVEL.fuseBoxCandidates[Math.floor(Math.random() * LEVEL.fuseBoxCandidates.length)];
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

  function applyMovement(p, ix, iy) {
    p.isMoving = ix !== 0 || iy !== 0;
    if (!p.isMoving) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    movePlayer(p, nx * PLAYER_SPEED, ny * PLAYER_SPEED);
  }

  function updateInputMovement() {
    applyMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0));
    applyMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0));
  }

  function isHidden(p) {
    const t = worldToTile(p.x, p.y);
    return tileChar(t.x, t.y) === 'S';
  }

  function updateTriggers() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);

      if (ch === 'F' && fuseState === 'ground') {
        fuseState = 'carried';
        fuseCarrier = p;
        playPickupChime();
      }

      if (ch === 'K' && fuseState === 'carried' && fuseCarrier === p) {
        if (t.x === activeFuseBox.x && t.y === activeFuseBox.y) {
          fuseState = 'installed';
          fuseCarrier = null;
          doorUnlocked = true;
          playDoorUnlockChime();
        } else {
          playWrongSocketBuzz();
        }
      }

      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
      }
    });
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

  function updateTentacleTargets(tile) {
    const targets = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (tileChar(tile.x + dx, tile.y + dy) === '#') {
          targets.push(tileCenter(tile.x + dx, tile.y + dy));
        }
      }
    }
    monster.tentacleTargets = targets.slice(0, 3);
  }

  function updateDetection(now) {
    for (const p of players) {
      if (isHidden(p) || !p.isMoving) continue;
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

  function updateMonster(now) {
    updateDetection(now);

    if (now >= monster.nextRepathAt) {
      monster.nextRepathAt = now + REPATH_MS;
      const startTile = worldToTile(monster.x, monster.y);
      let goalTile;
      if (monster.state === 'alert') {
        goalTile = monster.alertTargetTile;
      } else {
        goalTile = LEVEL.patrolPoints[monster.patrolIndex];
      }
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
      updateTentacleTargets(startTile);
    }

    if (monster.path && monster.pathIndex < monster.path.length) {
      const target = tileTargetWithOffset(monster.path[monster.pathIndex]);
      const dx = target.x - monster.x, dy = target.y - monster.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) monster.lookDir = { x: dx / d, y: dy / d };
      if (d < MONSTER_SPEED) {
        monster.x = target.x; monster.y = target.y;
        monster.pathIndex++;
        if (monster.pathIndex >= monster.path.length && monster.state === 'patrol') {
          monster.patrolIndex = (monster.patrolIndex + 1) % LEVEL.patrolPoints.length;
        }
      } else {
        monster.x += (dx / d) * MONSTER_SPEED;
        monster.y += (dy / d) * MONSTER_SPEED;
      }
    }
  }

  function updateCatch(now) {
    if (monster.state !== 'alert') return;
    players.forEach((p) => {
      if (isHidden(p)) return;
      if (now < p.invulnerableUntil) return;
      if (Math.hypot(p.x - monster.x, p.y - monster.y) < CATCH_RADIUS) triggerCaught(p, now);
    });
  }

  function triggerCaught(p, now) {
    catchFlash = 1;
    playCatchSting();
    if (fuseCarrier === p) {
      fuseState = 'ground';
      fuseCarrier = null;
    }
    respawnPlayer(p);
    p.invulnerableUntil = now + 1200;
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

  function drawTiles(g) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        let color;
        switch (ch) {
          case '#': color = '#262629'; break;
          case 'S': color = '#26301f'; break;
          case 'E': color = '#3a301f'; break;
          case 'D': color = doorUnlocked ? '#58585f' : '#3a4552'; break;
          default: color = '#58585f';
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
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

    // fuse-box sockets (visually identical so the real one can't be spotted from afar)
    LEVEL.fuseBoxCandidates.forEach((k) => {
      const c = tileCenter(k.x, k.y);
      const isThisOneLit = doorUnlocked && k.x === activeFuseBox.x && k.y === activeFuseBox.y;
      g.fillStyle = '#141418';
      g.fillRect(c.x - 10, c.y - 12, 20, 24);
      g.fillStyle = isThisOneLit ? '#3ddc84' : '#555';
      g.beginPath();
      g.arc(c.x, c.y, 4, 0, Math.PI * 2);
      g.shadowColor = g.fillStyle;
      g.shadowBlur = isThisOneLit ? 10 : 0;
      g.fill();
      g.shadowBlur = 0;
    });

    if (fuseState === 'ground') {
      const c = tileCenter(LEVEL.fuse.x, LEVEL.fuse.y);
      g.save();
      g.translate(c.x, c.y);
      g.fillStyle = '#e0b23d';
      g.fillRect(-4, -10, 8, 20);
      g.fillStyle = '#c9a02f';
      g.fillRect(-6, -12, 12, 4);
      g.fillRect(-6, 8, 12, 4);
      g.shadowColor = '#ffd76b';
      g.shadowBlur = 10;
      g.fillStyle = 'rgba(255,215,107,0.5)';
      g.beginPath();
      g.arc(0, 0, 3, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.restore();
    }

    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    g.beginPath();
    g.arc(ex.x, ex.y, doorUnlocked ? 12 : 6, 0, Math.PI * 2);
    g.fillStyle = doorUnlocked ? '#ffd27a' : '#5a4a30';
    g.fill();
  }

  function drawMonster(g, t) {
    g.save();
    g.translate(monster.x, monster.y);

    monster.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + monster.seed) * 6;
      const tx = tt.x - monster.x, ty = tt.y - monster.y;
      const midX = tx / 2 + wobble;
      const midY = ty / 2 - wobble;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(midX, midY, tx, ty);
      g.strokeStyle = '#6a1826';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.stroke();
    });

    const points = 10;
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = monster.radius + Math.sin(t * 0.006 + i * 1.7 + monster.seed) * 4;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = '#4a0f1c';
    g.shadowColor = '#7a1f2f';
    g.shadowBlur = 14;
    g.fill();
    g.shadowBlur = 0;

    drawMonsterEye(g, monster.lookDir);

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

    g.save();
    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(170,25,25,0.4)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + monster.seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * eyeR, Math.sin(a) * eyeR * 0.8);
      g.lineTo(Math.cos(a) * eyeR * 0.1, Math.sin(a) * eyeR * 0.1);
      g.stroke();
    }
    g.restore();

    const ix = lookDir.x * eyeR * 0.32, iy = lookDir.y * eyeR * 0.26;
    const irisR = eyeR * 0.48;
    const iris = g.createRadialGradient(ix, iy, 1, ix, iy, irisR);
    iris.addColorStop(0, '#c96a2e');
    iris.addColorStop(0.6, '#7a2f10');
    iris.addColorStop(1, '#200a05');
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
    players.forEach((p) => {
      g.beginPath();
      g.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
      g.fillStyle = p.color;
      g.fill();

      const fx = p.x + p.facing.x * PLAYER_RADIUS * 1.6;
      const fy = p.y + p.facing.y * PLAYER_RADIUS * 1.6;
      g.beginPath();
      g.arc(fx, fy, 3, 0, Math.PI * 2);
      g.fillStyle = '#fff8e6';
      g.fill();

      if (fuseState === 'carried' && fuseCarrier === p) {
        g.fillStyle = '#e0b23d';
        g.fillRect(p.x - 3, p.y - PLAYER_RADIUS - 12, 6, 10);
      }
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
    drawTiles(ctx);
    drawMonster(ctx, now);
    drawPlayers(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY);
    ctx.drawImage(maskCanvas, vx, 0);

    drawProximityWarning(vx, Math.hypot(p.x - monster.x, p.y - monster.y), now);

    ctx.restore();
  }

  const PROXIMITY_WARNING_RADIUS = 260;

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    const alpha = closeness * closeness * 0.55 * pulse;
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
    const fuseLabel = fuseState === 'ground' ? 'on the ground'
      : fuseState === 'carried' ? `carried by ${fuseCarrier === players[0] ? 'P1' : 'P2'}`
      : 'installed';
    hudFuseEl.textContent = `Fuse: ${fuseLabel}`;
    hudFuseEl.classList.toggle('done', fuseState === 'installed');
    hudDoorEl.textContent = `Door: ${doorUnlocked ? 'open' : 'locked'}`;
    hudDoorEl.classList.toggle('done', doorUnlocked);
  }

  function loop(now) {
    if (gameState === 'playing') {
      updateInputMovement();
      updateTriggers();
      updateMonster(now);
      updateCatch(now);
      updateAmbientTension();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    renderViewport(1, now);
    drawDivider();

    if (catchFlash > 0) {
      ctx.fillStyle = `rgba(180,20,30,${catchFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      catchFlash -= 0.02;
    }

    updateOverlay();
    updateHud();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
