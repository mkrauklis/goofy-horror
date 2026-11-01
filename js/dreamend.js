// The Dream, part 5 -- the last room: dark, one light, and in the light a cage with a little Crawler in it.
// Touch the cage and the picture stops. Then everything, the room and you in it, begins to come apart; and
// then there is a film (js/crawlerchase.js) of what happened to three people running from something, and to the
// something. Then black, and a few small words.
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud-buttons');
  const soundHintEl = document.getElementById('sound-hint');
  const CC = window.CrawlerChase;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const VIEW_W = PLAYER_MODE === 1 ? 920 : 460;
  const VIEW_H = 340;
  const W = canvas.width, H = canvas.height;
  const PLAYER_RADIUS = 10, PLAYER_SPEED = 118;
  const ROOM = { x0: -430, x1: 430, y0: -320, y1: 320 };
  const CAGE = { x: 0, y: -24, touch: 40 };
  const FADE_IN_MS = 2500, FREEZE_MS = 900, DISTORT_MS = 4600, BLACK_MS = 1700, TEXT_IN = 1400, TEXT_HOLD = 5200, TEXT_OUT = 1600;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  const keys = {};
  const TRACKED = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const players = (PLAYER_MODE === 1 ? ['#ff8a3d'] : ['#ff8a3d', '#3ddc84']).map((color, i) => ({
    x: -150 + i * 30, y: 150 - i * 14, color, facing: { x: 1, y: -1 }, walkPhase: 0,
  }));
  let phase = 'walk', phaseAt = 0, startAt = 0, leaving = false, filmPrev = 0;
  const snap = document.createElement('canvas'); snap.width = W; snap.height = H;
  const tints = ['#ff0000', '#00ff00', '#0000ff'].map((c) => { const o = document.createElement('canvas'); o.width = W; o.height = H; o._c = c; return o; });

  // ---------- sound ----------
  let ac = null, master = null, humGain = null, noiseBuf = null;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 38; o2.type = 'sine'; o2.frequency.value = 57; lp.type = 'lowpass'; lp.frequency.value = 140;
    humGain = ac.createGain(); humGain.gain.value = 0.06;
    o.connect(lp); o2.connect(lp); lp.connect(humGain); humGain.connect(master); o.start(); o2.start();
    const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function warpSound() {
    if (!ac) return;
    const t0 = ac.currentTime, dur = DISTORT_MS / 1000;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master);
    [220, 331, 441].forEach((f, i) => {
      const o = ac.createOscillator(); o.type = i ? 'sawtooth' : 'sine';
      o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.18, t0 + dur);
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5 + i * 3; lg.gain.value = f * 0.2; l.connect(lg); lg.connect(o.frequency);
      o.connect(g); o.start(t0); l.start(t0); o.stop(t0 + dur + 0.05); l.stop(t0 + dur + 0.05);
    });
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(3500, t0 + dur);
    const ng = ac.createGain(); ng.gain.value = 0.4; n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t0); n.stop(t0 + dur + 0.05);
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (soundHintEl) soundHintEl.textContent = '';
    if (TRACKED.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (TRACKED.has(e.key)) { keys[e.key] = false; e.preventDefault(); } });

  // ---------- the room ----------
  function drawRoom(g, camX, camY, now) {
    g.fillStyle = '#0b0c10'; g.fillRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    for (let x = ROOM.x0; x <= ROOM.x1; x += 64) { g.beginPath(); g.moveTo(x, ROOM.y0); g.lineTo(x, ROOM.y1); g.stroke(); }
    for (let y = ROOM.y0; y <= ROOM.y1; y += 64) { g.beginPath(); g.moveTo(ROOM.x0, y); g.lineTo(ROOM.x1, y); g.stroke(); }
    g.fillStyle = '#16181f'; g.fillRect(ROOM.x0 - 40, ROOM.y0 - 40, ROOM.x1 - ROOM.x0 + 80, 40); g.fillRect(ROOM.x0 - 40, ROOM.y1, ROOM.x1 - ROOM.x0 + 80, 40);
    g.fillRect(ROOM.x0 - 40, ROOM.y0, 40, ROOM.y1 - ROOM.y0); g.fillRect(ROOM.x1, ROOM.y0, 40, ROOM.y1 - ROOM.y0);
    // the pool of light under the one lamp
    const fl = 0.94 + 0.06 * Math.sin(now * 0.021) * Math.sin(now * 0.0071);
    const gr = g.createRadialGradient(CAGE.x, CAGE.y, 6, CAGE.x, CAGE.y, 200);
    gr.addColorStop(0, `rgba(255,240,205,${0.62 * fl})`); gr.addColorStop(0.55, `rgba(255,236,190,${0.2 * fl})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = gr; g.fillRect(CAGE.x - 200, CAGE.y - 200, 400, 400);
  }
  function drawCage(g, now) {
    g.save(); g.translate(CAGE.x, CAGE.y);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(2, 20, 28, 9, 0, 0, 6.283); g.fill();
    g.fillStyle = '#17181c'; g.fillRect(-24, -22, 48, 44);
    const M = window.MonsterModels;
    if (M) { const sp = M.sprite(0, now), j = Math.sin(now * 0.04) * 0.8; g.save(); g.translate(j, Math.cos(now * 0.05) * 0.8); g.scale(0.5, 0.5); g.drawImage(sp, -sp.width / 2, -sp.height / 2); g.restore(); }
    g.strokeStyle = '#8a8f9a'; g.lineWidth = 2.4;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 7, -22); g.lineTo(k * 7, 22); g.stroke(); }
    g.strokeStyle = '#6a6f7a'; g.lineWidth = 3; g.strokeRect(-24, -22, 48, 44);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-24, -22); g.lineTo(24, -22); g.stroke();
    g.fillStyle = '#d6b45a'; g.fillRect(-4, 20, 8, 5);
    g.restore();
  }

  const maskCanvas = document.createElement('canvas'); maskCanvas.width = VIEW_W; maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');
  function punch(x, y, r, a) {
    maskCtx.save(); maskCtx.globalCompositeOperation = 'destination-out';
    const gr = maskCtx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    maskCtx.fillStyle = gr; maskCtx.beginPath(); maskCtx.arc(x, y, r, 0, 6.283); maskCtx.fill(); maskCtx.restore();
  }
  function renderViewport(i, now) {
    const p = players[i], vx = i * VIEW_W;
    ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    ctx.translate(Math.round(vx + VIEW_W / 2 - p.x), Math.round(VIEW_H / 2 - p.y));
    drawRoom(ctx, p.x, p.y, now);
    drawCage(ctx, now);
    players.slice().sort((a, b) => a.y - b.y).forEach((pl) => window.PlayerModel.draw(ctx, PLAYER_RADIUS, pl));
    ctx.restore();
    maskCtx.globalCompositeOperation = 'source-over'; maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.fillStyle = 'rgba(0,0,0,0.985)'; maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);       // almost nothing but the one light
    const sx = (wx) => wx - p.x + VIEW_W / 2, sy = (wy) => wy - p.y + VIEW_H / 2;
    punch(sx(CAGE.x), sy(CAGE.y), 205, 1);
    punch(VIEW_W / 2, VIEW_H / 2, 46, 0.45);                                              // just enough to see your own feet by
    ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip(); ctx.drawImage(maskCanvas, vx, 0); ctx.restore();
    ctx.restore();
  }

  // ---------- the picture coming apart ----------
  function makeTints() {
    tints.forEach((o) => { const g = o.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.drawImage(snap, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = o._c; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; });
  }
  function drawDistort(now, k) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const amp = 2 + 95 * k * k, tt = now * 0.001;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(Math.sin(tt * 3) * 0.035 * k); const zs = 1 + 0.18 * k * Math.sin(tt * 5) + 0.25 * k * k; ctx.scale(zs, zs); ctx.translate(-W / 2, -H / 2);
    ctx.globalCompositeOperation = 'lighter';
    tints.forEach((o, ci) => {
      const split = (ci - 1) * (3 + 22 * k);
      for (let y = 0; y < H; y += 4) {
        const n = Math.sin(y * 0.045 + tt * 7 + ci) * amp * 0.5 + (hash(Math.floor(y / 12) + Math.floor(tt * 14)) - 0.5) * amp * (k > 0.3 ? 1.6 : 0.4) + split;
        const drip = k > 0.45 ? Math.max(0, Math.sin(y * 0.2 + tt * 3)) * 18 * (k - 0.45) : 0;
        ctx.drawImage(o, 0, y, W, 4, n, y + drip, W, 4);
      }
    });
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    for (let b = 0; b < 8 * k; b++) { const bx = hash(b + Math.floor(tt * 10)) * W, by = hash(b + 50 + Math.floor(tt * 10)) * H; ctx.fillStyle = hash(b * 3 + Math.floor(tt * 12)) > 0.5 ? `rgba(255,255,255,${0.2 * k})` : `rgba(0,0,0,${0.5 * k})`; ctx.fillRect(bx, by, 40 + hash(b) * 160 * k, 4 + hash(b + 9) * 28 * k); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.3 + 0.6 * k})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (k > 0.94) { ctx.fillStyle = `rgba(255,255,255,${(k - 0.94) / 0.06})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- update ----------
  function update(now, dt) {
    if (phase === 'walk') {
      const solo = PLAYER_MODE === 1;
      const dirs = solo
        ? [[(keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0)]]
        : [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)],
          [(keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0)]];
      players.forEach((p, i) => {
        const [ix, iy] = dirs[i];
        if (now - startAt < FADE_IN_MS * 0.4 || (!ix && !iy)) return;
        const len = Math.hypot(ix, iy); p.facing = { x: ix / len, y: iy / len };
        let nx = p.x + p.facing.x * PLAYER_SPEED * dt, ny = p.y + p.facing.y * PLAYER_SPEED * dt;
        nx = clamp(nx, ROOM.x0 + PLAYER_RADIUS, ROOM.x1 - PLAYER_RADIUS); ny = clamp(ny, ROOM.y0 + PLAYER_RADIUS, ROOM.y1 - PLAYER_RADIUS);
        const d = Math.hypot(nx - CAGE.x, ny - CAGE.y);
        if (d < 28) { const a = Math.atan2(ny - CAGE.y, nx - CAGE.x); nx = CAGE.x + Math.cos(a) * 28; ny = CAGE.y + Math.sin(a) * 28; }
        p.x = nx; p.y = ny;
        if (window.Footsteps) window.Footsteps.advance(p, dt * 9, ac, 'floor', 1);
        if (Math.hypot(p.x - CAGE.x, p.y - CAGE.y) < CAGE.touch + 2) {
          phase = 'freeze'; phaseAt = now;
          snap.getContext('2d').drawImage(canvas, 0, 0); makeTints();                // the picture, as it was at the moment of touching
          if (ac) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(0, ac.currentTime); }
        }
      });
    } else if (phase === 'freeze' && now - phaseAt > FREEZE_MS) {
      phase = 'distort'; phaseAt = now;
      if (ac) { master.gain.setValueAtTime(1, ac.currentTime); warpSound(); }
    } else if (phase === 'distort' && now - phaseAt > DISTORT_MS) {
      phase = 'film'; phaseAt = now; filmPrev = 0;
    } else if (phase === 'film') {
      const t = now - phaseAt;
      if (CC) CC.tick(ac, filmPrev, t, { dream: true });
      filmPrev = t;
      if (!CC || t >= CC.duration({ dream: true })) { phase = 'black'; phaseAt = now; if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.05); }
    } else if (phase === 'black' && now - phaseAt > BLACK_MS) {
      phase = 'text'; phaseAt = now;
    } else if (phase === 'text' && now - phaseAt > TEXT_IN + TEXT_HOLD + TEXT_OUT + 700 && !leaving) {
      leaving = true;
      try { sessionStorage.setItem('goofy-horror-sourcerer-return', '1'); } catch (e) { /* ignore */ }
      window.location.href = 'halloween1.html';                                      // you wake up in the Sourcerer's room
    }
  }

  let last = null;
  function loop(now) {
    try {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!startAt) startAt = now;
      update(now, dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      if (phase === 'walk') {
        renderViewport(0, now);
        if (PLAYER_MODE === 2) { renderViewport(1, now); ctx.strokeStyle = '#15161c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke(); }
        const since = now - startAt;
        if (since < FADE_IN_MS) { ctx.fillStyle = `rgba(0,0,0,${1 - since / FADE_IN_MS})`; ctx.fillRect(0, 0, W, H); }
      } else if (phase === 'freeze') {
        ctx.drawImage(snap, (Math.random() - 0.5) * 1.2, 0);                          // frozen, and trembling very slightly
      } else if (phase === 'distort') {
        drawDistort(now, clamp((now - phaseAt) / DISTORT_MS, 0, 1));
      } else if (phase === 'film') {
        CC.draw(ctx, W, H, now - phaseAt, { dream: true });
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (phase === 'text') {
          const t = now - phaseAt, a = clamp(Math.min(t / TEXT_IN, (TEXT_IN + TEXT_HOLD + TEXT_OUT - t) / TEXT_OUT), 0, 1);
          ctx.save(); ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#d8d4cc'; ctx.font = '9px Georgia, serif'; ctx.textAlign = 'center';
          ctx.fillText('you started this', W / 2, H / 2 + 3); ctx.restore();
        }
      }
      hudEl.textContent = '';
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
