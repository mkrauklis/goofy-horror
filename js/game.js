(function () {
  const LEVEL = window.LEVEL1;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 2.5;
  const MONSTER_SPEED = PLAYER_SPEED * 1.1;
  const CATCH_RADIUS = 20;
  const REPATH_MS = 500;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');
  const hudButtonsEl = document.getElementById('hud-buttons');
  const hudDoorEl = document.getElementById('hud-door');

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

  function playButtonChime() {
    playTone(880, 0.18, 'sine', 0.2);
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

  // ---- game state ----
  let buttonsPressed = [false, false, false];
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'caught' | 'complete'
  let catchFlash = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return { x: c.x, y: c.y, color, facing: { x: 0, y: 1 } };
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
    tentacleTargets: [],
  };

  function resetLevel() {
    const p1 = tileCenter(LEVEL.spawn1.x, LEVEL.spawn1.y);
    const p2 = tileCenter(LEVEL.spawn2.x, LEVEL.spawn2.y);
    players[0].x = p1.x; players[0].y = p1.y; players[0].facing = { x: 0, y: 1 };
    players[1].x = p2.x; players[1].y = p2.y; players[1].facing = { x: 0, y: 1 };

    const m = tileCenter(LEVEL.monsterSpawn.x, LEVEL.monsterSpawn.y);
    monster.x = m.x; monster.y = m.y;
    monster.path = []; monster.pathIndex = 0; monster.nextRepathAt = 0; monster.tentacleTargets = [];

    buttonsPressed = [false, false, false];
    doorUnlocked = false;
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
    if (ix === 0 && iy === 0) return;
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
    const ch = tileChar(t.x, t.y);
    return ch === 'S' || ch === 'V';
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
      }
    });
  }

  // ---- monster AI ----
  function monsterCanOccupy(ch) {
    if (ch === '#' || ch === 'S' || ch === 'V') return false;
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

  function pickTargetTile() {
    const visible = players.filter((p) => !isHidden(p));
    if (visible.length === 0) return LEVEL.hubTile;
    visible.sort((a, b) => Math.hypot(a.x - monster.x, a.y - monster.y) - Math.hypot(b.x - monster.x, b.y - monster.y));
    return worldToTile(visible[0].x, visible[0].y);
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

  function updateMonster(now) {
    if (now >= monster.nextRepathAt) {
      monster.nextRepathAt = now + REPATH_MS;
      const startTile = worldToTile(monster.x, monster.y);
      const goalTile = pickTargetTile();
      const graph = buildMonsterGraph();
      const path = bfsPath(graph, startTile, goalTile);
      if (path && path.length > 1) {
        monster.path = path.slice(1);
        monster.pathIndex = 0;
      } else {
        monster.path = [];
        monster.pathIndex = 0;
      }
      updateTentacleTargets(startTile);
    }

    if (monster.path && monster.pathIndex < monster.path.length) {
      const target = tileTargetWithOffset(monster.path[monster.pathIndex]);
      const dx = target.x - monster.x, dy = target.y - monster.y;
      const d = Math.hypot(dx, dy);
      if (d < MONSTER_SPEED) {
        monster.x = target.x; monster.y = target.y;
        monster.pathIndex++;
      } else {
        monster.x += (dx / d) * MONSTER_SPEED;
        monster.y += (dy / d) * MONSTER_SPEED;
      }
    }
  }

  function updateCatch() {
    players.forEach((p) => {
      if (isHidden(p)) return;
      if (Math.hypot(p.x - monster.x, p.y - monster.y) < CATCH_RADIUS) triggerCaught();
    });
  }

  function triggerCaught() {
    if (gameState !== 'playing') return;
    gameState = 'caught';
    catchFlash = 1;
    playCatchSting();
    setTimeout(() => {
      resetLevel();
      gameState = 'playing';
    }, 1400);
  }

  // ---- rendering ----
  function drawTiles(g) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        let color;
        switch (ch) {
          case '#': color = '#241c2c'; break;
          case 'S': color = '#1c2a1e'; break;
          case 'V': color = '#141018'; break;
          case 'E': color = '#241a10'; break;
          case 'D': color = doorUnlocked ? '#1a1420' : '#3a4552'; break;
          default: color = '#1a1420';
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
        if (ch === 'V') {
          g.strokeStyle = 'rgba(255,255,255,0.08)';
          g.lineWidth = 2;
          for (let i = 1; i < 4; i++) {
            const gy = py + (TILE / 4) * i;
            g.beginPath(); g.moveTo(px + 4, gy); g.lineTo(px + TILE - 4, gy); g.stroke();
          }
        }
        if (ch === 'D' && !doorUnlocked) {
          g.strokeStyle = '#0d1114';
          g.lineWidth = 3;
          g.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        }
      }
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
    g.restore();
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

  function punchCone(g, x, y, angle, halfAngle, length, intensity) {
    g.save();
    g.beginPath();
    g.moveTo(x, y);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const a = angle - halfAngle + (halfAngle * 2 * i) / steps;
      g.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
    }
    g.closePath();
    g.clip();
    g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(x, y, 0, x, y, length);
    grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
    grad.addColorStop(0.7, `rgba(0,0,0,${intensity * 0.6})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - length, y - length, length * 2, length * 2);
    g.restore();
  }

  function flickerIntensity(seed, t) {
    const n = Math.sin(t * 0.0025 + seed * 12.9) * Math.sin(t * 0.011 + seed * 3.7);
    let v = 0.5 + 0.5 * n;
    if (Math.sin(t * 0.03 + seed * 5.5) > 0.93) v *= 0.1;
    return v;
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
    ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);

    drawTiles(ctx);
    drawMonster(ctx, now);
    drawPlayers(ctx);

    ctx.fillStyle = 'rgba(3,2,6,0.95)';
    ctx.fillRect(camX - VIEW_W / 2 - 4, camY - VIEW_H / 2 - 4, VIEW_W + 8, VIEW_H + 8);

    const sz = LEVEL.safeZone;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(sz.x0 * TILE, sz.y0 * TILE, (sz.x1 - sz.x0 + 1) * TILE, (sz.y1 - sz.y0 + 1) * TILE);
    ctx.restore();

    players.forEach((pl) => {
      punchLight(ctx, pl.x, pl.y, 55, 0.95);
      punchCone(ctx, pl.x, pl.y, Math.atan2(pl.facing.y, pl.facing.x), 0.5, 230, 0.95);
    });

    LEVEL.lights.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      const inten = flickerIntensity(i, now);
      punchLight(ctx, c.x, c.y, 40 + 30 * inten, 0.15 + 0.55 * inten);
    });

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
    if (gameState === 'caught') {
      messageEl.style.display = 'flex';
      messageEl.textContent = 'CAUGHT — resetting…';
    } else if (gameState === 'complete') {
      messageEl.style.display = 'flex';
      messageEl.textContent = 'FACILITY CLEARED — press Enter to play again';
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
  }

  function loop(now) {
    if (gameState === 'playing') {
      updateInputMovement();
      updateTriggers();
      updateMonster(now);
      updateCatch();
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
