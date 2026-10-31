// The Green Field (the Sourcerer's "lilleperchaun" secret): a giant grassy field with 25 leprechauns.
// They are not hostile -- they wander about hopping, and when you walk up to one it goes completely
// black, eyes red, and stays that way. Every one you meet tints the screen a little redder; the 25th turns
// it solid red, the screen shakes, the word "why" appears, then black, then the Gold achievement.
// From the 10th on the picture goes faintly blurry and realistic eyes flash up, now and then.
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudCountEl = document.getElementById('hud-buttons');
  const soundHintEl = document.getElementById('sound-hint');

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  const WORLD_W = 2560, WORLD_H = 1600;
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 118;
  const EDGE = 56;                  // the tree line: players stay this far in from the world edge
  const TOTAL = 25;
  const FADE_NEAR = 70, FADE_FAR = 250, MEET_DIST = 100;
  const WANDER_SPEED = 34, WANDER_RANGE = 280;   // leprechauns stroll about within this far of where they started
  const TINT_SPEED = 0.16;          // how fast the red creeps in, per second
  const SHAKE_MS = 6500, BLACK_MS = 3200, LEAVE_MS = 5500;
  const UNEASY_AT = 10;             // after this many, the blur and the eyes start

  function hash(x, y, k) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // ---- the field: painted once into an offscreen canvas ----
  const ground = document.createElement('canvas');
  ground.width = WORLD_W; ground.height = WORLD_H;
  (function paintGround() {
    const g = ground.getContext('2d');
    g.fillStyle = '#4f9a3a';
    g.fillRect(0, 0, WORLD_W, WORLD_H);
    // big soft blotches of lighter and darker grass
    for (let i = 0; i < 260; i++) {
      const x = hash(i, 1, 1) * WORLD_W, y = hash(i, 2, 1) * WORLD_H, r = 70 + hash(i, 3, 1) * 190;
      const light = hash(i, 4, 1) > 0.5;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, light ? 'rgba(150,215,90,0.34)' : 'rgba(20,70,25,0.30)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // blades
    g.lineCap = 'round';
    for (let i = 0; i < 26000; i++) {
      const x = hash(i, 5, 2) * WORLD_W, y = hash(i, 6, 2) * WORLD_H;
      const a = -Math.PI / 2 + (hash(i, 7, 2) - 0.5) * 1.1, l = 4 + hash(i, 8, 2) * 8;
      const sh = hash(i, 9, 2);
      g.strokeStyle = sh < 0.4 ? '#2f7a2c' : sh < 0.75 ? '#68b44a' : '#8fd05f';
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // clover, daisies, buttercups
    for (let i = 0; i < 900; i++) {
      const x = hash(i, 10, 3) * WORLD_W, y = hash(i, 11, 3) * WORLD_H, k = hash(i, 12, 3);
      if (k < 0.45) {
        g.fillStyle = '#fff';
        for (let p = 0; p < 5; p++) { const a = p * 1.2566; g.beginPath(); g.arc(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.5, 0, 6.3); g.fill(); }
        g.fillStyle = '#f2c516'; g.beginPath(); g.arc(x, y, 1.4, 0, 6.3); g.fill();
      } else if (k < 0.75) {
        g.fillStyle = '#ffd83a'; g.beginPath(); g.arc(x, y, 2.3, 0, 6.3); g.fill();
      } else {
        g.fillStyle = '#2f8a3a';
        for (let p = 0; p < 3; p++) { const a = p * 2.094 + hash(i, 13, 3); g.beginPath(); g.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.1, 0, 6.3); g.fill(); }
      }
    }
    // a few stones
    for (let i = 0; i < 40; i++) {
      const x = hash(i, 14, 4) * WORLD_W, y = hash(i, 15, 4) * WORLD_H, r = 4 + hash(i, 16, 4) * 7;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + 1, y + 3, r * 1.1, r * 0.6, 0, 0, 6.3); g.fill();
      g.fillStyle = '#8b8f86'; g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, 6.3); g.fill();
      g.fillStyle = '#a9aca2'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.3, 0, 0, 6.3); g.fill();
    }
    // the tree line round the edge
    for (let i = 0; i < 700; i++) {
      const side = Math.floor(hash(i, 17, 5) * 4);
      const along = hash(i, 18, 5), depth = hash(i, 19, 5) * EDGE * 0.95;
      const x = side < 2 ? along * WORLD_W : (side === 2 ? depth : WORLD_W - depth);
      const y = side < 2 ? (side === 0 ? depth : WORLD_H - depth) : along * WORLD_H;
      const r = 20 + hash(i, 20, 5) * 22;
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(x + 4, y + 6, r, 0, 6.3); g.fill();
      g.fillStyle = hash(i, 21, 5) < 0.5 ? '#1f5a26' : '#26692d'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(120,200,90,0.28)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, 6.3); g.fill();
    }
  })();

  // ---- the leprechauns: spread over the field, never close to each other or to where you start ----
  const SPAWNS = [{ x: 260, y: 800 }, { x: 310, y: 800 }];
  const leps = [];
  (function place() {
    let tries = 0;
    while (leps.length < TOTAL && tries++ < 20000) {
      const x = 150 + hash(tries, 31, 7) * (WORLD_W - 300), y = 150 + hash(tries, 32, 7) * (WORLD_H - 300);
      if (Math.hypot(x - SPAWNS[0].x, y - SPAWNS[0].y) < 380) continue;
      if (leps.some((l) => Math.hypot(l.x - x, l.y - y) < 300)) continue;
      leps.push({ x, y, hx: x, hy: y, tx: x, ty: y, wait: Math.random() * 3, seed: hash(tries, 33, 7) * 10, f: 0, met: false });
    }
  })();

  // ---- players ----
  const keys = {};
  const TRACKED = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  function makePlayer(spawn, color) {
    return { x: spawn.x, y: spawn.y, color, facing: { x: 1, y: 0 }, walkPhase: 0 };
  }
  const players = PLAYER_MODE === 1
    ? [makePlayer(SPAWNS[0], '#ff8a3d')]
    : [makePlayer(SPAWNS[0], '#ff8a3d'), makePlayer(SPAWNS[1], '#3ddc84')];

  // ---- state ----
  let phase = 'play';               // 'play' | 'shake' | 'black' | 'done'
  let phaseAt = 0;
  let met = 0;
  let tint = 0;                     // what's on screen (eases toward its target)
  let awarded = false;

  // ---- sound: wind, and a drone that sours as the red comes in ----
  let ac = null, master = null, droneGain = null, droneOsc = null, droneOsc2 = null, windGain = null;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const wind = ac.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.6;
    windGain = ac.createGain(); windGain.gain.value = 0.05;
    wind.connect(wf); wf.connect(windGain); windGain.connect(master); wind.start();
    droneOsc = ac.createOscillator(); droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 55;
    droneOsc2 = ac.createOscillator(); droneOsc2.type = 'sawtooth'; droneOsc2.frequency.value = 55;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    droneGain = ac.createGain(); droneGain.gain.value = 0;
    droneOsc.connect(lp); droneOsc2.connect(lp); lp.connect(droneGain); droneGain.connect(master);
    droneOsc.start(); droneOsc2.start();
  }
  function pluck(freq, vol) {
    if (!ac) return;
    [1, 1.0595].forEach((r, i) => {            // a note and the one a semitone above it: wrong on purpose
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = i ? 'square' : 'triangle';
      o.frequency.value = freq * r;
      g.gain.setValueAtTime(vol * (i ? 0.5 : 1), ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.4);
      o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + 1.5);
    });
  }
  function updateSound(now) {
    if (!ac) return;
    const k = tint;
    droneGain.gain.setTargetAtTime(phase === 'black' || phase === 'done' ? 0 : 0.02 + k * 0.22 + (phase === 'shake' ? 0.25 : 0), ac.currentTime, 0.2);
    droneOsc.frequency.setTargetAtTime(55 - k * 10, ac.currentTime, 0.3);
    droneOsc2.frequency.setTargetAtTime(55 * (1.01 + k * 0.07), ac.currentTime, 0.3);
    windGain.gain.setTargetAtTime(phase === 'black' || phase === 'done' ? 0 : 0.05 + k * 0.1, ac.currentTime, 0.3);
    if (phase === 'black' || phase === 'done') master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (soundHintEl) soundHintEl.textContent = '';
    if (TRACKED.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (TRACKED.has(e.key)) { keys[e.key] = false; e.preventDefault(); } });

  function movePlayers(dt) {
    const solo = PLAYER_MODE === 1;
    const dirs = solo
      ? [[(keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0)]]
      : [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)],
        [(keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0)]];
    players.forEach((p, i) => {
      const [ix, iy] = dirs[i];
      if (!ix && !iy) return;
      const len = Math.hypot(ix, iy);
      p.facing = { x: ix / len, y: iy / len };
      p.x = clamp(p.x + p.facing.x * PLAYER_SPEED * dt, EDGE, WORLD_W - EDGE);
      p.y = clamp(p.y + p.facing.y * PLAYER_SPEED * dt, EDGE, WORLD_H - EDGE);
      if (window.Footsteps) window.Footsteps.advance(p, dt * 9, ac, 'grass', 1);
    });
  }

  // They roam: stroll to a spot near home, stand a while, pick another. Harmless.
  function wander(l, dt) {
    if (l.wait > 0) { l.wait -= dt; return; }
    const dx = l.tx - l.x, dy = l.ty - l.y, d = Math.hypot(dx, dy);
    if (d < 4) {
      l.wait = 1 + Math.random() * 3;
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * (WANDER_RANGE - 50);
      l.tx = clamp(l.hx + Math.cos(a) * r, EDGE + 30, WORLD_W - EDGE - 30);
      l.ty = clamp(l.hy + Math.sin(a) * r, EDGE + 30, WORLD_H - EDGE - 30);
      return;
    }
    l.x += (dx / d) * WANDER_SPEED * dt;
    l.y += (dy / d) * WANDER_SPEED * dt;
  }

  function updateLeprechauns(dt) {
    leps.forEach((l) => {
      wander(l, dt);
      const d = Math.min(...players.map((p) => Math.hypot(p.x - l.x, p.y - l.y)));
      // darkens as you approach; once you've reached one it goes completely black and stays that way
      const target = l.met ? 1 : clamp((FADE_FAR - d) / (FADE_FAR - FADE_NEAR), 0, 1);
      l.f += (target - l.f) * Math.min(1, dt * (l.met ? 2.5 : 4));
      if (!l.met && d <= MEET_DIST) {
        l.met = true;
        met++;
        pluck(196 - met * 3, 0.1 + met * 0.006);
      }
    });
  }

  // ---- drawing ----
  // A little green man, front-on: top hat, orange beard, green coat, black boots, gold buckles. `f`
  // (0 far .. 1 reached) drains him to black and dims him -- except his eyes, which go red.
  function drawLeprechaun(g, x, y, now, f, seed) {
    const hop = Math.abs(Math.sin(now * 0.0042 + seed)) * 4 * (1 - f * 0.85);
    const C = (c) => mix(c, '#040404', Math.min(1, f * 1.15));
    g.save();
    g.translate(x, y - hop);
    g.globalAlpha = 1 - 0.3 * f;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(0, 15 + hop, 11, 3.6, 0, 0, 6.3); g.fill();
    g.fillStyle = C('#1a1a1a');
    g.fillRect(-7, 11, 6, 5); g.fillRect(1, 11, 6, 5);
    g.fillStyle = C('#2e9a3c');
    g.beginPath(); g.moveTo(-9, -3); g.quadraticCurveTo(-11, 6, -7, 12); g.lineTo(7, 12); g.quadraticCurveTo(11, 6, 9, -3); g.closePath(); g.fill();
    g.fillStyle = C('#1b1b1b'); g.fillRect(-8.5, 4, 17, 3);
    g.fillStyle = C('#e6b422'); g.fillRect(-2.5, 3.5, 5, 4);
    g.beginPath(); g.arc(-3, -1, 1.1, 0, 6.3); g.arc(3, -1, 1.1, 0, 6.3); g.fill();
    g.fillStyle = C('#2e9a3c');
    g.beginPath(); g.ellipse(-10.5, 3, 3, 6.5, 0.15, 0, 6.3); g.ellipse(10.5, 3, 3, 6.5, -0.15, 0, 6.3); g.fill();
    g.fillStyle = C('#f1c9a1');
    g.beginPath(); g.arc(-10.5, 8.5, 2.3, 0, 6.3); g.arc(10.5, 8.5, 2.3, 0, 6.3); g.fill();
    g.fillStyle = C('#e8782a');
    g.beginPath(); g.arc(0, -9, 8.5, 0.15, Math.PI - 0.15); g.lineTo(0, 2); g.closePath(); g.fill();
    g.fillStyle = C('#f1c9a1');
    g.beginPath(); g.arc(0, -11, 7, 0, 6.3); g.fill();
    g.fillStyle = C('#e8782a');
    g.beginPath(); g.ellipse(0, -7.5, 5.4, 2.6, 0, 0, Math.PI); g.fill();
    g.fillStyle = C('#d9604c');
    g.beginPath(); g.arc(0, -10, 1.4, 0, 6.3); g.fill();                       // nose
    g.fillStyle = C('#1c7a2a');
    g.beginPath(); g.ellipse(0, -17, 11, 3.2, 0, 0, 6.3); g.fill();            // brim
    g.fillRect(-6.5, -30, 13, 13);                                              // crown
    g.fillStyle = C('#101010'); g.fillRect(-6.5, -21, 13, 3.5);
    g.fillStyle = C('#e6b422'); g.fillRect(-2.2, -21.4, 4.4, 4.3);
    g.restore();
    // eyes: friendly dots until he fades, then they go red and burn through the black
    g.save();
    g.translate(x, y - hop);
    const ex = [-3, 3], ey = -12.5;
    if (f < 0.1) {
      ex.forEach((px) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(px, ey, 1.9, 0, 6.3); g.fill(); g.fillStyle = '#16210f'; g.beginPath(); g.arc(px, ey, 1, 0, 6.3); g.fill(); });
    } else {
      const k = clamp((f - 0.1) / 0.6, 0, 1);
      ex.forEach((px) => {
        const gl = g.createRadialGradient(px, ey, 0, px, ey, 9 + 7 * k);
        gl.addColorStop(0, `rgba(255,30,20,${0.75 * k})`); gl.addColorStop(1, 'rgba(255,0,0,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(px, ey, 9 + 7 * k, 0, 6.3); g.fill();
        g.fillStyle = `rgb(255,${Math.round(60 * (1 - k))},${Math.round(40 * (1 - k))})`;
        g.beginPath(); g.ellipse(px, ey, 1.9 + 0.8 * k, 1.5 + 0.5 * k, 0, 0, 6.3); g.fill();
      });
    }
    g.restore();
  }

  function drawWorld(camX, camY, now, vx) {
    ctx.drawImage(ground, camX - VIEW_W / 2, camY - VIEW_H / 2, VIEW_W, VIEW_H, vx, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);
    const items = [];
    leps.forEach((l) => { if (Math.abs(l.x - camX) < VIEW_W / 2 + 40 && Math.abs(l.y - camY) < VIEW_H / 2 + 60) items.push({ y: l.y, draw: () => drawLeprechaun(ctx, l.x, l.y, now, l.f, l.seed) }); });
    players.forEach((p) => items.push({ y: p.y, draw: () => window.PlayerModel.draw(ctx, PLAYER_RADIUS, p) }));
    items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
    ctx.restore();
  }

  function renderViewport(i, now) {
    const p = players[i], vx = i * VIEW_W;
    const camX = clamp(p.x, VIEW_W / 2, WORLD_W - VIEW_W / 2), camY = clamp(p.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    drawWorld(camX, camY, now, vx);
    ctx.restore();
  }

  function drawWhy(now, t) {
    const k = clamp((t - 900) / 1200, 0, 1);
    if (k <= 0) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const flick = 0.85 + 0.15 * Math.sin(now * 0.05);
    ctx.fillStyle = `rgba(20,0,0,${k * flick})`;
    ctx.font = 'bold 120px Georgia, serif';
    ctx.fillText('why', canvas.width / 2, canvas.height / 2);
    // more of them, smaller and from further away, the longer it goes on
    const extra = Math.floor(clamp((t - 2200) / 220, 0, 22));
    for (let n = 0; n < extra; n++) {
      const x = hash(n, 41, 9) * canvas.width, y = hash(n, 42, 9) * canvas.height, s = 16 + hash(n, 43, 9) * 36;
      ctx.font = `bold ${s}px Georgia, serif`;
      ctx.fillStyle = `rgba(20,0,0,${0.35 + 0.4 * hash(n, 44, 9)})`;
      ctx.fillText('why', x, y);
    }
    ctx.restore();
  }


  // ---- the eyes: the shared painter (js/eyes.js) ----
  const EYE_W = window.RealEyes.W, EYE_H = window.RealEyes.H, IRIS_COUNT = window.RealEyes.COUNT;
  function eyeSprite(v) { return window.RealEyes.sprite(v, 0, 0); }

  // Now and then, from the 10th leprechaun on, an eye (sometimes a pair) is just there for a moment.
  let flashes = [], nextFlashAt = 0;
  function scheduleFlash(now) {
    const k = clamp((met - UNEASY_AT) / (TOTAL - UNEASY_AT), 0, 1);
    nextFlashAt = now + (6500 - 4200 * k) * (0.55 + Math.random() * 0.9);
  }
  function updateFlashes(now) {
    flashes = flashes.filter((f) => now < f.start + f.dur);
    if (met < UNEASY_AT || phase !== 'play') { if (phase !== 'play') flashes = []; return; }
    if (!nextFlashAt) scheduleFlash(now);
    if (now < nextFlashAt) return;
    scheduleFlash(now);
    const dur = 110 + Math.random() * 190, s = 0.55 + Math.random() * 0.75, rot = (Math.random() - 0.5) * 0.4;
    const x = 120 + Math.random() * (canvas.width - 240), y = 70 + Math.random() * (canvas.height - 140);
    const v = Math.floor(Math.random() * IRIS_COUNT);
    flashes.push({ start: now, dur, x, y, s, rot, v });
    if (Math.random() < 0.35) flashes.push({ start: now, dur, x: x + 150 * s * (Math.random() < 0.5 ? -1 : 1), y: y + (Math.random() - 0.5) * 30 * s, s: s * 0.92, rot: rot + 0.05, v });
  }
  function drawFlashes(now) {
    flashes.forEach((f) => {
      const t = (now - f.start) / f.dur;
      const a = Math.min(1, t * 8) * (t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1) * (0.88 + 0.12 * Math.sin(now * 0.09));
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(f.s, f.s);
      ctx.drawImage(eyeSprite(f.v), -EYE_W / 2, -EYE_H / 2);
      ctx.restore();
    });
  }
  // The picture goes faintly soft from the 10th on, and a little softer with each after it.
  let blurNow = -1;
  function updateBlur() {
    const px = (phase === 'play' || phase === 'shake') && met >= UNEASY_AT ? 0.5 + (met - UNEASY_AT) * 0.07 : 0;
    const q = Math.round(px * 10) / 10;
    if (q === blurNow) return;
    blurNow = q;
    canvas.style.filter = q ? `blur(${q}px)` : '';
  }

  function setPhase(p, now) { phase = p; phaseAt = now; }

  let last = null;
  function loop(now) {
    try {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (phaseAt === 0) phaseAt = now;

      if (phase === 'play') {
        movePlayers(dt);
        updateLeprechauns(dt);
      } else {
        leps.forEach((l) => { l.f += (1 - l.f) * Math.min(1, dt * 3); });   // by the end, every one of them is dark
      }
      const target = met >= TOTAL ? 1 : 0.88 * Math.pow(met / TOTAL, 1.3);
      tint += clamp(target - tint, -TINT_SPEED * dt, TINT_SPEED * dt);
      if (phase === 'play' && met >= TOTAL && tint >= 0.995) setPhase('shake', now);
      if (phase === 'shake' && now - phaseAt > SHAKE_MS) setPhase('black', now);
      if (phase === 'black' && now - phaseAt > BLACK_MS && !awarded) {
        awarded = true;
        if (window.Achievements) window.Achievements.unlock('gold');
        setPhase('done', now);
      }
      if (phase === 'done' && now - phaseAt > LEAVE_MS) { window.location.href = 'index.html#achievements'; phaseAt = now + 1e9; }
      updateSound(now);
      updateFlashes(now);
      updateBlur();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (phase === 'black' || phase === 'done') {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.save();
        if (phase === 'shake') {
          const m = 2 + 14 * clamp((now - phaseAt) / 3500, 0, 1);
          ctx.translate((Math.random() - 0.5) * m * 2, (Math.random() - 0.5) * m * 2);
        }
        renderViewport(0, now);
        if (PLAYER_MODE === 2) {
          renderViewport(1, now);
          ctx.strokeStyle = '#2a1a1a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke();
        }
        if (tint > 0.002) {
          ctx.fillStyle = `rgba(205,6,6,${tint})`;
          ctx.fillRect(-40, -40, canvas.width + 80, canvas.height + 80);
          // the edges go first: a darker red creeping in from the border
          const v = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.2, canvas.width / 2, canvas.height / 2, canvas.width * 0.6);
          v.addColorStop(0, 'rgba(60,0,0,0)'); v.addColorStop(1, `rgba(60,0,0,${0.55 * tint})`);
          ctx.fillStyle = v; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        drawFlashes(now);
        if (phase === 'shake') drawWhy(now, now - phaseAt);
        ctx.restore();
      }
      hudCountEl.textContent = phase === 'play' || phase === 'shake' ? `Leprechauns: ${met} / ${TOTAL}` : '';
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
