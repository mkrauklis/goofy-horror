// The Dream (the Sourcerer's "dream" secret): a dark, endless room with a checkered floor and a giant
// mushroom, covered in hundreds of real-looking eyes and walking on legs, that is always walking toward
// you. It speeds up the longer you survive; there is no door, and the only way out is to let it catch you.
// Then the picture smears out, everything goes black, and it screams in your face.
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud-buttons');
  const soundHintEl = document.getElementById('sound-hint');
  const Eyes = window.RealEyes;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 118;
  const TILE = 80;                                  // the checkered floor
  const CATCH_DIST = 58;                            // from the mushroom's feet
  const BLUR_MS = 2800, BLACK_MS = 2000, SCARE_MS = 3400, END_MS = 1800;

  function hash(x, y, k) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- the mushroom ----------
  // Eyes are scattered once over the cap and stalk (positions in the mushroom's own units, ground at y = 0).
  const CAP = { cx: 0, cy: -128, rx: 158, ry: 104 };
  const eyes = [];
  (function scatter() {
    for (let i = 0; eyes.length < 230 && i < 4000; i++) {                      // the cap's dome
      const x = (hash(i, 1, 21) * 2 - 1) * CAP.rx, y = CAP.cy - hash(i, 2, 21) * CAP.ry;
      const nx = (x - CAP.cx) / CAP.rx, ny = (y - CAP.cy) / CAP.ry, r2 = nx * nx + ny * ny;
      if (r2 > 0.9) continue;
      eyes.push({ x, y, w: (15 + hash(i, 3, 21) * 22) * (0.55 + 0.45 * Math.sqrt(1 - r2)), v: Math.floor(hash(i, 4, 21) * Eyes.COUNT), ph: hash(i, 5, 21) * 100 });
    }
    for (let i = 0; i < 60; i++) {                                              // the stalk
      const y = -112 + hash(i, 6, 22) * 100, half = 30 + (y + 112) * 0.2;
      const x = (hash(i, 7, 22) * 2 - 1) * half * 0.85;
      if (Math.abs(x) < 26 && y > -88 && y < -48) continue;                      // keep the mouth clear
      eyes.push({ x, y, w: 11 + hash(i, 8, 22) * 14, v: Math.floor(hash(i, 9, 22) * Eyes.COUNT), ph: hash(i, 10, 22) * 100 });
    }
  })();

  // `gaze` is {gx, gy} (each -1, 0, 1): the way every eye is looking -- always at you. `mouth` is 0 (stitched
  // shut) to 1 (screaming). `walk` is the leg-cycle phase.
  function drawMushroom(g, now, s, mouth, gaze, walk) {
    g.save();
    g.scale(s, s);

    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath(); g.ellipse(0, 4, 130, 20, 0, 0, 6.283); g.fill();

    // legs: two rows of jointed, knobbly legs; the far row is drawn darker and first
    const drawLeg = (hx, dir, ph, far) => {
      const lift = Math.max(0, Math.sin(ph)) * 22, sway = Math.cos(ph) * 15;
      const kx = hx + dir * 62, ky = -96 - lift * 0.4;
      const fx = hx + dir * (104 + sway), fy = -lift * 0.9 + (far ? -6 : 0);
      g.strokeStyle = far ? '#251722' : '#3c2634'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = 11; g.beginPath(); g.moveTo(hx, -34); g.lineTo(kx, ky); g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke();
      g.strokeStyle = far ? '#4a3040' : '#6a4a5e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(hx, -37); g.lineTo(kx, ky - 3); g.lineTo(fx, fy - 3); g.stroke();
      g.fillStyle = far ? '#2e1c28' : '#503448';
      g.beginPath(); g.arc(kx, ky, 8, 0, 6.283); g.fill();
      g.beginPath(); g.arc(fx, fy, 6, 0, 6.283); g.fill();
    };
    [-1, 1].forEach((dir) => { [14, 36].forEach((hx, i) => drawLeg(hx * dir, dir, walk + (i * 2 + (dir > 0 ? 1 : 0)) * 1.57 + 0.8, true)); });

    // stalk
    const sg = g.createLinearGradient(-60, 0, 60, 0);
    sg.addColorStop(0, '#8e7a64'); sg.addColorStop(0.45, '#e2d3b8'); sg.addColorStop(1, '#85715b');
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(-34, -118); g.bezierCurveTo(-46, -80, -70, -40, -74, -6); g.quadraticCurveTo(0, 14, 74, -6);
    g.bezierCurveTo(70, -40, 46, -80, 34, -118); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,24,0.4)'; g.lineWidth = 2; g.stroke();

    // the mouth: stitched shut while it hunts you, a bottomless scream when it catches you
    const mw = 20 + 40 * mouth, mh = 3 + 80 * mouth, my = -66;
    if (mouth < 0.04) {
      g.strokeStyle = '#2a1018'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-26, my); g.quadraticCurveTo(0, my + 5, 26, my); g.stroke();
      g.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 8, my - 5); g.lineTo(i * 8 + 2, my + 6); g.stroke(); }
    } else {
      g.fillStyle = '#12020a';
      g.beginPath(); g.ellipse(0, my + mh * 0.35, mw, mh, 0, 0, 6.283); g.fill();
      const tg = g.createLinearGradient(0, my - mh * 0.6, 0, my + mh * 1.5);
      tg.addColorStop(0, '#dcd2bd'); tg.addColorStop(1, '#9a8a70');
      g.fillStyle = tg;
      for (let i = 0; i < 14; i++) {                                              // teeth, top and bottom
        const a = (i / 13) * Math.PI, x = Math.cos(a) * mw * 0.94, th = 8 + 22 * mouth * (0.6 + 0.4 * hash(i, 1, 23));
        g.beginPath(); g.moveTo(x - 4, my + mh * 0.35 - Math.sin(a) * mh * 0.94); g.lineTo(x, my + mh * 0.35 - Math.sin(a) * mh * 0.94 + th); g.lineTo(x + 4, my + mh * 0.35 - Math.sin(a) * mh * 0.94); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x - 4, my + mh * 0.35 + Math.sin(a) * mh * 0.94); g.lineTo(x, my + mh * 0.35 + Math.sin(a) * mh * 0.94 - th); g.lineTo(x + 4, my + mh * 0.35 + Math.sin(a) * mh * 0.94); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(150,20,40,0.85)';                                       // a tongue
      g.beginPath(); g.ellipse(0, my + mh * 0.8, mw * 0.5, mh * 0.35, 0, 0, 6.283); g.fill();
    }

    // near row of legs, in front of the stalk
    if (mouth < 0.3) [-1, 1].forEach((dir) => { [10, 30, 50].forEach((hx, i) => drawLeg(hx * dir, dir, walk + (i * 2 + (dir > 0 ? 0 : 1)) * 1.57, false)); });

    // cap: a big red-purple dome with a pale gilled underside showing at the rim
    g.fillStyle = '#d8c8aa';
    g.beginPath(); g.ellipse(0, CAP.cy + 6, CAP.rx * 0.97, 24, 0, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(80,56,36,0.55)'; g.lineWidth = 1.2;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(i * 10.5, CAP.cy + 2); g.lineTo(i * 9.4, CAP.cy + 24 * Math.sqrt(1 - (i / 15) ** 2)); g.stroke(); }
    const cg = g.createRadialGradient(-40, CAP.cy - 60, 10, 0, CAP.cy, CAP.rx * 1.05);
    cg.addColorStop(0, '#a02a3e'); cg.addColorStop(0.6, '#681626'); cg.addColorStop(1, '#2c0810');
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(-CAP.rx, CAP.cy + 6); g.bezierCurveTo(-CAP.rx, CAP.cy - CAP.ry * 1.35, CAP.rx, CAP.cy - CAP.ry * 1.35, CAP.rx, CAP.cy + 6);
    g.quadraticCurveTo(0, CAP.cy + 28, -CAP.rx, CAP.cy + 6); g.closePath(); g.fill();

    // hundreds of eyes, each blinking on its own, each turned to look at you
    const gi = (gaze.gx + 1) * 3 + (gaze.gy + 1);
    eyes.forEach((e) => {
      if (mouth > 0.04 && e.y > -112 && Math.abs(e.x) < 20 + 40 * mouth + 14) return;   // none inside the open mouth
      const blink = Math.sin(now * 0.0011 + e.ph * 6.3) > 0.985 ? 0.12 : 1;
      const w = e.w * (1 + 0.05 * Math.sin(now * 0.004 + e.ph));
      g.drawImage(Eyes.sprite(e.v, gaze.gx, gaze.gy), e.x - w / 2, e.y - w * 0.31 * blink, w, w * 0.62 * blink);
    });
    g.restore();
  }

  // ---------- players & state ----------
  const keys = {};
  const TRACKED = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const players = PLAYER_MODE === 1
    ? [{ x: 0, y: 0, color: '#ff8a3d', facing: { x: 0, y: 1 }, walkPhase: 0 }]
    : [{ x: -30, y: 0, color: '#ff8a3d', facing: { x: 0, y: 1 }, walkPhase: 0 }, { x: 30, y: 0, color: '#3ddc84', facing: { x: 0, y: 1 }, walkPhase: 0 }];
  const mush = { x: 0, y: -950, walk: 0, gaze: { gx: 0, gy: 0 } };

  let phase = 'chase';                 // 'chase' | 'blur' | 'black' | 'scare' | 'end'
  let phaseAt = 0, startAt = 0;
  let caughtBy = null;
  let leaving = false;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W; maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');

  // ---------- sound ----------
  let ac = null, master = null, droneGain = null, noiseBuf = null;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = 41; o2.type = 'sine'; o2.frequency.value = 62;
    lp.type = 'lowpass'; lp.frequency.value = 160;
    droneGain = ac.createGain(); droneGain.gain.value = 0.07;
    o1.connect(lp); o2.connect(lp); lp.connect(droneGain); droneGain.connect(master);
    o1.start(); o2.start();
    const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function thump(freq, vol, dur) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, ac.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 0.45, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function distortion(k) {
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; c[i] = Math.tanh(x * k); }
    return c;
  }
  // It screams: a stack of sawtooth voices swooping up through a fierce distortion, over a roar of noise.
  function playScream() {
    if (!ac) return;
    const t0 = ac.currentTime, dur = SCARE_MS / 1000;
    const ws = ac.createWaveShaper(); ws.curve = distortion(9);
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.9, t0 + 0.04);
    out.gain.setValueAtTime(0.9, t0 + dur - 0.5); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    ws.connect(hp); hp.connect(out); out.connect(master);
    [[520, 1.0], [780, 1.01], [1240, 0.99], [330, 1.02]].forEach(([f, det], i) => {
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.7, t0);
      o.frequency.exponentialRampToValueAtTime(f * 1.5 * det, t0 + 0.5);
      o.frequency.linearRampToValueAtTime(f * 1.15 * det, t0 + dur);
      lfo.frequency.value = 11 + i * 3; lg.gain.value = f * 0.06;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(ws); o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
    });
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.7;
    const ng = ac.createGain(); ng.gain.value = 0.5;
    n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t0); n.stop(t0 + dur + 0.05);
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (soundHintEl) soundHintEl.textContent = '';
    if (TRACKED.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (TRACKED.has(e.key)) { keys[e.key] = false; e.preventDefault(); } });

  // ---------- update ----------
  let nextBeat = 0;
  function update(now, dt) {
    if (phase === 'chase') {
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
        p.x += p.facing.x * PLAYER_SPEED * dt; p.y += p.facing.y * PLAYER_SPEED * dt;
        if (window.Footsteps) window.Footsteps.advance(p, dt * 9, ac, 'floor', 1);
      });

      // it walks straight at whoever is nearest, and it gets faster the longer you last
      const t = (now - startAt) / 1000;
      const speed = Math.min(176, 64 + 1.15 * t);
      let near = players[0], nd = Infinity;
      players.forEach((p) => { const d = Math.hypot(p.x - mush.x, p.y - mush.y); if (d < nd) { nd = d; near = p; } });
      const dx = near.x - mush.x, dy = near.y - mush.y, d = Math.hypot(dx, dy) || 1;
      const before = Math.floor(mush.walk / 3.1416);
      mush.x += (dx / d) * speed * dt; mush.y += (dy / d) * speed * dt;
      mush.walk += dt * (3 + speed * 0.045);
      if (Math.floor(mush.walk / 3.1416) !== before) thump(60, clamp(1 - nd / 900, 0.04, 0.55), 0.25);
      mush.gaze = { gx: clamp(Math.round(dx / 180), -1, 1), gy: clamp(Math.round(dy / 140), -1, 1) };

      if (ac && now >= nextBeat && nd < 520) {                       // a heartbeat, faster as it closes in
        thump(48, 0.35 * (1 - nd / 520) + 0.06, 0.2);
        setTimeout(() => thump(44, 0.25 * (1 - nd / 520) + 0.04, 0.18), 140);
        nextBeat = now + 380 + (nd / 520) * 700;
      }
      if (nd < CATCH_DIST) { caughtBy = near; phase = 'blur'; phaseAt = now; if (droneGain) droneGain.gain.setTargetAtTime(0.0, ac.currentTime, 1.2); }
    } else if (phase === 'blur' && now - phaseAt > BLUR_MS) {
      phase = 'black'; phaseAt = now;
      if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    } else if (phase === 'black' && now - phaseAt > BLACK_MS) {
      phase = 'scare'; phaseAt = now;
      if (ac) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(1, ac.currentTime); }
      playScream();
    } else if (phase === 'scare' && now - phaseAt > SCARE_MS) {
      phase = 'end'; phaseAt = now;
    } else if (phase === 'end' && now - phaseAt > END_MS && !leaving) {
      leaving = true;
      window.location.href = 'cloudmaze.html';     // ...and you wake up somewhere very high and very bright
    }
  }

  // ---------- drawing ----------
  function punch(g, x, y, r, a) {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    g.restore();
  }

  function renderViewport(i, now) {
    const p = players[i], vx = i * VIEW_W;
    const camX = p.x, camY = p.y;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);

    // the endless checkered floor
    const x0 = Math.floor((camX - VIEW_W / 2) / TILE) - 1, x1 = Math.ceil((camX + VIEW_W / 2) / TILE) + 1;
    const y0 = Math.floor((camY - VIEW_H / 2) / TILE) - 1, y1 = Math.ceil((camY + VIEW_H / 2) / TILE) + 1;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        ctx.fillStyle = (tx + ty) & 1 ? '#0e0e13' : '#aeaeb9';
        ctx.fillRect(tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
      }
    }

    // mushroom and players, back to front
    const items = players.map((pl) => ({ y: pl.y, draw: () => window.PlayerModel.draw(ctx, PLAYER_RADIUS, pl) }));
    if (Math.abs(mush.x - camX) < VIEW_W / 2 + 260 && mush.y - camY > -VIEW_H / 2 - 40 && mush.y - camY < VIEW_H / 2 + 420) {
      items.push({ y: mush.y, draw: () => { ctx.save(); ctx.translate(mush.x, mush.y); drawMushroom(ctx, now, 1, 0, mush.gaze, mush.walk); ctx.restore(); } });
    }
    items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
    ctx.restore();

    // darkness: only your own light, plus a sickly glow round the thing so you can see it coming
    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#000'; maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);
    punch(maskCtx, VIEW_W / 2, VIEW_H / 2, 90, 1);
    punch(maskCtx, VIEW_W / 2, VIEW_H / 2, 235, 0.85);
    const mx = mush.x - camX + VIEW_W / 2, my = mush.y - camY + VIEW_H / 2 - 120;
    if (mx > -300 && mx < VIEW_W + 300 && my > -300 && my < VIEW_H + 300) punch(maskCtx, mx, my, 230, 0.55);
    ctx.drawImage(maskCanvas, vx, 0);
    ctx.restore();
  }

  // The jumpscare: the mushroom fills the screen, mouth wide, shaking, with white flashes.
  function drawScare(now, t) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const sh = 10;
    ctx.translate(canvas.width / 2 + (Math.random() - 0.5) * sh, canvas.height * 1.18 + (Math.random() - 0.5) * sh);
    const open = clamp(t / 140, 0, 1) * (0.88 + 0.12 * Math.sin(now * 0.05));
    const zoom = 2.5 + 0.3 * clamp(t / 1200, 0, 1) + 0.04 * Math.sin(now * 0.06);
    drawMushroom(ctx, now, zoom, open, { gx: 0, gy: 0 }, now * 0.004);
    ctx.restore();
    const flash = Math.sin(now * 0.07) > 0.93 ? 0.4 : 0;
    if (t < 120) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    const v = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.6);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  let blurNow = -1;
  function setBlur(px) {
    const q = Math.round(px * 2) / 2;
    if (q === blurNow) return;
    blurNow = q;
    canvas.style.filter = q ? `blur(${q}px)` : '';
  }

  let last = null;
  function loop(now) {
    try {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!startAt) startAt = now;
      update(now, dt);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (phase === 'scare') {
        setBlur(0);
        drawScare(now, now - phaseAt);
      } else if (phase === 'black' || phase === 'end') {
        setBlur(0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        const k = phase === 'blur' ? clamp((now - phaseAt) / BLUR_MS, 0, 1) : 0;
        setBlur(k * 13);
        ctx.save();
        if (phase === 'blur') ctx.translate(Math.sin(now * 0.004) * 6 * k, Math.cos(now * 0.003) * 4 * k);   // the world starts to swim
        renderViewport(0, now);
        if (PLAYER_MODE === 2) {
          renderViewport(1, now);
          ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke();
        }
        ctx.restore();
        if (phase === 'blur') {                                      // the edges close in, then everything goes dark
          const v = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * (0.5 - 0.45 * k), canvas.width / 2, canvas.height / 2, canvas.width * 0.62);
          v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.3 + 0.7 * k})`);
          ctx.fillStyle = v; ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (k > 0.55) { ctx.fillStyle = `rgba(0,0,0,${(k - 0.55) / 0.45})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        } else {
          const t = (now - startAt) / 1000;
          if (t > 40) {                                                // a whisper of advice, for anyone still running
            ctx.save(); ctx.globalAlpha = clamp((t - 40) / 6, 0, 0.6);
            ctx.fillStyle = '#d8d8e0'; ctx.font = '15px Georgia, serif'; ctx.textAlign = 'center';
            ctx.fillText("you can't run forever. the only way out is to let it catch you.", canvas.width / 2, canvas.height - 14);
            ctx.restore();
          }
        }
      }
      hudEl.textContent = phase === 'chase' ? `Survived: ${Math.floor((now - startAt) / 1000)}s` : '';
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
