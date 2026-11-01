// The Dream, part 3 -- the Hill: a grassy hill under a sky that is plainly painted on the inside of a
// dome. Little houses stand about on it. Every 15 seconds the sky goes out for 10, and pairs of enormous,
// wet, realistic eyes open in the dark and float about. Stay in a house and they only drift. Step outside
// and every one of them comes for you at six times its drifting speed, until you are back indoors.
// There is a door painted into the edge of the sky. That is the way out.
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
  const HILL_R = 1500;                               // the grass; beyond it, the painted sky
  const DAY_MS = 15000, NIGHT_MS = 10000, CYCLE_MS = DAY_MS + NIGHT_MS;
  const EYE_WANDER = 30, EYE_CHASE = EYE_WANDER * 6; // px/s; they chase at 6x their drifting speed
  const EYE_COUNT = 14, EYE_CATCH = 22, EYE_WAKE_MS = 1200;
  const HW = 124, HH = 100, WALL = 8, DOOR_W = 36;   // a house: footprint, wall thickness, doorway
  const CAUGHT_MS = 1400, FADE_IN_MS = 2200, WHITE_MS = 2200, END_MS = 1400;
  const DOOR = { x: 0, y: -HILL_R };                 // the way out, in the dome's wall to the north

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(x, y, k) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- houses ----------
  // The first is where you start; the next six lead on toward the door; the rest are somewhere else to run to.
  const HOUSE_POS = [
    [0, 1050], [-260, 700], [180, 380], [-200, 40], [240, -300], [-120, -640], [140, -980],
    [-700, 500], [650, 650], [-800, -200], [780, -250], [-500, -900], [600, -800], [-40, 760],
  ];
  const houses = HOUSE_POS.map(([x, y], i) => {
    const x0 = x - HW / 2, y0 = y - HH / 2, x1 = x + HW / 2, y1 = y + HH / 2, half = (HW - DOOR_W) / 2;
    return {
      x, y, x0, y0, x1, y1, seed: i,
      walls: [
        [x0, y0, HW, WALL], [x0, y0, WALL, HH], [x1 - WALL, y0, WALL, HH],
        [x0, y1 - WALL, half, WALL], [x1 - half, y1 - WALL, half, WALL],
      ],
    };
  });
  function insideHouse(o) {
    for (let i = 0; i < houses.length; i++) {
      const h = houses[i];
      if (o.x > h.x0 + WALL && o.x < h.x1 - WALL && o.y > h.y0 + WALL && o.y < h.y1 - WALL) return h;
    }
    return null;
  }
  function hits(x, y, r) {
    for (let i = 0; i < houses.length; i++) {
      const h = houses[i];
      if (x < h.x0 - r - 2 || x > h.x1 + r + 2 || y < h.y0 - r - 2 || y > h.y1 + r + 2) continue;
      for (let k = 0; k < h.walls.length; k++) {
        const [wx, wy, ww, wh] = h.walls[k];
        const cx = clamp(x, wx, wx + ww), cy = clamp(y, wy, wy + wh);
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
      }
    }
    return false;
  }

  // ---------- state ----------
  const keys = {};
  const TRACKED = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const homeXY = (i) => ({ x: houses[0].x + (PLAYER_MODE === 2 ? (i ? 18 : -18) : 0), y: houses[0].y });
  const players = (PLAYER_MODE === 1 ? ['#ff8a3d'] : ['#ff8a3d', '#3ddc84']).map((color, i) => ({
    ...homeXY(i), color, facing: { x: 0, y: -1 }, walkPhase: 0, caughtAt: -1e9, flash: 0,
  }));
  let eyes = [];
  let phase = 'play';                 // 'play' | 'white' | 'end'
  let phaseAt = 0, startAt = 0, leaving = false;
  let wasNight = false, nightStartedAt = 0, notice = '', noticeAt = -1e9;

  // ---------- sound ----------
  let ac = null, master = null, droneGain = null, windGain = null, noiseBuf = null, nextBird = 0, nextBeat = 0;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    windGain = ac.createGain(); windGain.gain.value = 0.04;
    n.connect(lp); lp.connect(windGain); windGain.connect(master); n.start();
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), dl = ac.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = 46; o2.type = 'sine'; o2.frequency.value = 69;
    dl.type = 'lowpass'; dl.frequency.value = 180;
    droneGain = ac.createGain(); droneGain.gain.value = 0;
    o1.connect(dl); o2.connect(dl); dl.connect(droneGain); droneGain.connect(master); o1.start(); o2.start();
  }
  function thump(freq, vol, dur) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, ac.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 0.45, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function chirp() {
    if (!ac) return;
    const t = ac.currentTime, f = 2400 + Math.random() * 1600;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.07); o.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
  }
  function bell() {                                        // the sky going out
    if (!ac) return;
    const t = ac.currentTime;
    [110, 165.7, 220.9].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 4.1);
    });
  }
  function shriek() {
    if (!ac) return;
    const t0 = ac.currentTime, dur = 1.2;
    const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) c[i] = Math.tanh(((i / 512) - 1) * 8);
    const ws = ac.createWaveShaper(); ws.curve = c;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.6, t0 + 0.03); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    ws.connect(out); out.connect(master);
    [430, 650, 990].forEach((f) => {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.8, t0); o.frequency.exponentialRampToValueAtTime(f * 1.7, t0 + 0.3); o.frequency.linearRampToValueAtTime(f * 1.2, t0 + dur);
      o.connect(ws); o.start(t0); o.stop(t0 + dur + 0.05);
    });
  }
  function chime(freq, delay, dur) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    [1, 2.01].forEach((m, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (soundHintEl) soundHintEl.textContent = '';
    if (TRACKED.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (TRACKED.has(e.key)) { keys[e.key] = false; e.preventDefault(); } });

  // ---------- the clock ----------
  function clock(now) {
    const t = (now - startAt) % CYCLE_MS;
    const night = t >= DAY_MS;
    const nightK = night ? Math.min(1, (t - DAY_MS) / 700, (CYCLE_MS - t) / 900) : 0;
    const dusk = night ? 0 : clamp((t - (DAY_MS - 3000)) / 3000, 0, 1);       // three seconds of warning: the sky reddens
    return { t, night, nightK: Math.max(0, nightK), dusk, left: night ? CYCLE_MS - t : DAY_MS - t };
  }

  // ---------- eyes ----------
  function spawnEyes(now) {
    eyes = [];
    for (let i = 0; i < EYE_COUNT; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * (HILL_R - 60);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (players.some((p) => Math.hypot(p.x - x, p.y - y) < 460)) continue;
        if (houses.some((h) => x > h.x0 - 30 && x < h.x1 + 30 && y > h.y0 - 30 && y < h.y1 + 30)) continue;
        eyes.push({ x, y, head: Math.random() * 6.283, turn: 0, v: Math.floor(Math.random() * Eyes.COUNT), ph: Math.random() * 100, alpha: 0, dying: false, size: 0.9 + Math.random() * 0.45 });
        break;
      }
    }
  }
  function pushOutOfHouses(e) {
    for (let i = 0; i < houses.length; i++) {
      const h = houses[i], m = 20;
      if (e.x > h.x0 - m && e.x < h.x1 + m && e.y > h.y0 - m && e.y < h.y1 + m) {         // they cannot go indoors
        const dl = e.x - (h.x0 - m), dr = (h.x1 + m) - e.x, dt = e.y - (h.y0 - m), db = (h.y1 + m) - e.y, mn = Math.min(dl, dr, dt, db);
        if (mn === dl) e.x = h.x0 - m; else if (mn === dr) e.x = h.x1 + m; else if (mn === dt) e.y = h.y0 - m; else e.y = h.y1 + m;
        e.head += 1.6;
      }
    }
  }
  function updateEyes(now, dt, ck) {
    const outside = players.filter((p) => !insideHouse(p) && now - p.caughtAt > CAUGHT_MS);
    const awake = ck.night && now - nightStartedAt > EYE_WAKE_MS;
    eyes.forEach((e) => {
      e.alpha = clamp(e.alpha + (e.dying ? -dt * 1.5 : dt * 0.9), 0, 1);
      let target = null, nd = Infinity;
      if (awake && !e.dying) outside.forEach((p) => { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < nd) { nd = d; target = p; } });
      let speed = EYE_WANDER;
      if (target) {
        speed = EYE_CHASE;
        e.head = Math.atan2(target.y - e.y, target.x - e.x);
      } else {
        e.turn += (Math.random() - 0.5) * dt * 2.4; e.turn = clamp(e.turn, -0.8, 0.8);
        e.head += e.turn * dt;
        if (Math.hypot(e.x, e.y) > HILL_R - 80) e.head = Math.atan2(-e.y, -e.x);
      }
      e.x += Math.cos(e.head) * speed * dt; e.y += Math.sin(e.head) * speed * dt;
      pushOutOfHouses(e);
      e.chasing = !!target;
      const near = players.reduce((m, p) => Math.min(m, Math.hypot(p.x - e.x, p.y - e.y)), Infinity);
      e.gaze = nearestGaze(e);
      e.near = near;
    });
    eyes = eyes.filter((e) => !(e.dying && e.alpha <= 0));
  }
  function nearestGaze(e) {
    let best = players[0], bd = Infinity;
    players.forEach((p) => { const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; } });
    return { gx: clamp(Math.round((best.x - e.x) / 140), -1, 1), gy: clamp(Math.round((best.y - e.y) / 90), -1, 1) };
  }

  // ---------- update ----------
  function respawn(p, i) { const h = homeXY(i); p.x = h.x; p.y = h.y; p.flash = 1; }

  function update(now, dt) {
    const ck = clock(now);
    if (ck.night && !wasNight) {                                  // the sky goes out
      nightStartedAt = now; spawnEyes(now); bell(); notice = 'the sky goes out'; noticeAt = now;
    } else if (!ck.night && wasNight) {
      eyes.forEach((e) => { e.dying = true; });
      notice = 'morning'; noticeAt = now;
    }
    wasNight = ck.night;

    if (phase === 'play') {
      const solo = PLAYER_MODE === 1;
      const dirs = solo
        ? [[(keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0)]]
        : [[(keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0)],
          [(keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0)]];
      players.forEach((p, i) => {
        p.flash = Math.max(0, p.flash - dt * 1.4);
        if (now - p.caughtAt < CAUGHT_MS) return;
        if (p.caughtAt > 0 && now - p.caughtAt >= CAUGHT_MS && p.caughtAt > -1) { respawn(p, i); p.caughtAt = -1e9; return; }
        const [ix, iy] = dirs[i];
        if (now - startAt < FADE_IN_MS * 0.5 || (!ix && !iy)) return;
        const len = Math.hypot(ix, iy);
        p.facing = { x: ix / len, y: iy / len };
        const mx = p.facing.x * PLAYER_SPEED * dt, my = p.facing.y * PLAYER_SPEED * dt;
        let moved = 0;
        if (!hits(p.x + mx, p.y, PLAYER_RADIUS)) { p.x += mx; moved += Math.abs(mx); }
        if (!hits(p.x, p.y + my, PLAYER_RADIUS)) { p.y += my; moved += Math.abs(my); }
        const d = Math.hypot(p.x, p.y);
        if (d > HILL_R - 14) { p.x *= (HILL_R - 14) / d; p.y *= (HILL_R - 14) / d; }          // the edge of the grass
        if (moved && window.Footsteps) window.Footsteps.advance(p, dt * 9, ac, 'grass', 1);
      });

      updateEyes(now, dt, ck);

      let chaseNear = Infinity;
      players.forEach((p, i) => {
        if (now - p.caughtAt < CAUGHT_MS || insideHouse(p)) return;
        eyes.forEach((e) => {
          if (e.dying || e.alpha < 0.6) return;
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (e.chasing) chaseNear = Math.min(chaseNear, d);
          if (d < EYE_CATCH && now - p.caughtAt >= CAUGHT_MS) { p.caughtAt = now; shriek(); }
        });
        if (Math.hypot(p.x - DOOR.x, p.y - DOOR.y) < 46) {
          phase = 'white'; phaseAt = now; chime(784, 0, 3); chime(1175, 0.2, 3); chime(1568, 0.4, 3);
        }
      });

      if (ac) {
        droneGain.gain.setTargetAtTime(ck.nightK * 0.07, ac.currentTime, 0.4);
        windGain.gain.setTargetAtTime(0.035 + ck.nightK * 0.03, ac.currentTime, 0.5);
        if (!ck.night && now >= nextBird) { chirp(); nextBird = now + 700 + Math.random() * 2600; }
        if (chaseNear < 700 && now >= nextBeat) {
          const k = 1 - chaseNear / 700;
          thump(48, 0.12 + 0.35 * k, 0.2); setTimeout(() => thump(44, 0.08 + 0.25 * k, 0.18), 140);
          nextBeat = now + 330 + (1 - k) * 600;
        }
      }
    } else if (phase === 'white') {
      if (now - phaseAt > WHITE_MS) { phase = 'end'; phaseAt = now; if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.4); }
    } else if (phase === 'end' && now - phaseAt > END_MS && !leaving) {
      leaving = true;
      window.location.href = 'dreamfacility.html';               // not awake yet
    }
    return ck;
  }

  // ---------- drawing ----------
  function mix(a, b, k) { return a.map((v, i) => Math.round(v + (b[i] - v) * k)); }
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  function drawSky(g, vx, camX, camY, ck) {
    const top = mix(mix([104, 164, 232], [232, 140, 90], ck.dusk * 0.8), [8, 12, 38], ck.nightK);
    const bot = mix(mix([208, 230, 250], [250, 190, 130], ck.dusk * 0.8), [22, 30, 70], ck.nightK);
    const sg = g.createLinearGradient(0, 0, 0, VIEW_H);
    sg.addColorStop(0, rgb(top)); sg.addColorStop(1, rgb(bot));
    g.fillStyle = sg; g.fillRect(vx, 0, VIEW_W, VIEW_H);
  }
  // The "sky" outside the grass: flat painted clouds, a painted sun and moon, panel seams and bolts.
  function drawSkyArt(g, camX, camY, ck) {
    const x0 = camX - VIEW_W / 2 - 60, x1 = camX + VIEW_W / 2 + 60, y0 = camY - VIEW_H / 2 - 60, y1 = camY + VIEW_H / 2 + 60;
    g.strokeStyle = `rgba(0,0,30,${0.10 + 0.08 * ck.nightK})`; g.lineWidth = 2;
    const S = 220;
    for (let x = Math.floor(x0 / S) * S; x < x1; x += S) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
    for (let y = Math.floor(y0 / S) * S; y < y1; y += S) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    g.fillStyle = `rgba(40,40,60,${0.35})`;
    for (let x = Math.floor(x0 / S) * S; x < x1; x += S) for (let y = Math.floor(y0 / S) * S; y < y1; y += S) { g.beginPath(); g.arc(x, y, 3, 0, 6.283); g.fill(); }

    const C = 330;
    for (let cx = Math.floor(x0 / C) - 1; cx <= Math.floor(x1 / C) + 1; cx++) for (let cy = Math.floor(y0 / C) - 1; cy <= Math.floor(y1 / C) + 1; cy++) {
      const px = (cx + hash(cx, cy, 1)) * C, py = (cy + hash(cx, cy, 2)) * C;
      if (Math.hypot(px, py) < HILL_R + 70) continue;
      if (ck.nightK > 0.3) {                                         // stars, cut out of paper
        if (hash(cx, cy, 3) > 0.7) continue;
        g.save(); g.translate(px, py); g.rotate(hash(cx, cy, 4));
        g.fillStyle = `rgba(255,248,200,${ck.nightK})`; g.strokeStyle = `rgba(30,30,60,${ck.nightK})`; g.lineWidth = 1.5;
        g.beginPath();
        for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283, r = k % 2 ? 7 : 16; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill(); g.stroke(); g.restore();
      } else if (hash(cx, cy, 5) < 0.55) {                             // a cloud, painted with an outline
        g.save(); g.translate(px, py); g.globalAlpha = 1 - ck.nightK;
        g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(70,90,130,0.6)'; g.lineWidth = 2;
        g.beginPath();
        [[-34, 4, 20], [-10, -8, 26], [20, -2, 24], [42, 8, 17]].forEach(([x, y, r]) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.283); });
        g.fill(); g.stroke(); g.restore();
      }
    }
    const sunX = Math.cos(-0.7) * (HILL_R + 260), sunY = Math.sin(-0.7) * (HILL_R + 260);
    g.save(); g.translate(sunX, sunY);
    if (ck.nightK < 0.5) {
      g.globalAlpha = 1 - ck.nightK * 2;
      g.strokeStyle = '#f4b73c'; g.lineWidth = 6;
      for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 62, Math.sin(a) * 62); g.lineTo(Math.cos(a) * 92, Math.sin(a) * 92); g.stroke(); }
      g.fillStyle = '#ffd95a'; g.strokeStyle = '#d69a20'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 52, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = '#6b4a10';                                       // a painted face, very pleased with itself
      g.beginPath(); g.arc(-17, -8, 4, 0, 6.283); g.arc(17, -8, 4, 0, 6.283); g.fill();
      g.strokeStyle = '#6b4a10'; g.lineWidth = 3; g.beginPath(); g.arc(0, 6, 22, 0.2, Math.PI - 0.2); g.stroke();
    }
    g.restore();
    const moonX = Math.cos(-2.4) * (HILL_R + 260), moonY = Math.sin(-2.4) * (HILL_R + 260);
    if (ck.nightK > 0.2) {
      g.save(); g.translate(moonX, moonY); g.globalAlpha = Math.min(1, ck.nightK * 1.4);
      g.fillStyle = '#f2efd8'; g.strokeStyle = '#a9a58a'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 46, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = '#d6d2b6'; g.beginPath(); g.arc(-14, -10, 9, 0, 6.283); g.arc(14, 12, 6, 0, 6.283); g.arc(8, -18, 5, 0, 6.283); g.fill();
      g.restore();
    }
  }

  function drawGround(g, camX, camY, ck) {
    const gg = g.createRadialGradient(0, -200, 100, 0, 0, HILL_R);
    gg.addColorStop(0, '#5fae48'); gg.addColorStop(0.7, '#4a9a3a'); gg.addColorStop(1, '#357a2c');
    g.fillStyle = gg; g.beginPath(); g.arc(0, 0, HILL_R, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(30,80,30,0.18)'; g.lineWidth = 3;                  // contour lines: it is a hill
    for (let r = 300; r < HILL_R; r += 300) { g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke(); }
    const S = 46, x0 = Math.floor((camX - VIEW_W / 2) / S) - 1, x1 = Math.ceil((camX + VIEW_W / 2) / S) + 1, y0 = Math.floor((camY - VIEW_H / 2) / S) - 1, y1 = Math.ceil((camY + VIEW_H / 2) / S) + 1;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const px = (tx + hash(tx, ty, 6)) * S, py = (ty + hash(tx, ty, 7)) * S;
      if (Math.hypot(px, py) > HILL_R - 8) continue;
      const k = hash(tx, ty, 8);
      g.strokeStyle = k < 0.5 ? '#2f7a2a' : '#7ccd5a'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(px - 3, py); g.lineTo(px - 4, py - 7); g.moveTo(px, py); g.lineTo(px, py - 9); g.moveTo(px + 3, py); g.lineTo(px + 4.5, py - 6); g.stroke();
      if (k > 0.94) { g.fillStyle = k > 0.97 ? '#fff4b0' : '#ff9ab0'; g.beginPath(); g.arc(px, py - 9, 2.2, 0, 6.283); g.fill(); }
    }
    // the dome's rim: planks bolted round the bottom of the sky, and a small door in it
    g.strokeStyle = '#4a3a28'; g.lineWidth = 26; g.beginPath(); g.arc(0, 0, HILL_R + 12, 0, 6.283); g.stroke();
    g.strokeStyle = '#6d5638'; g.lineWidth = 3;
    for (let k = 0; k < 120; k++) { const a = (k / 120) * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * (HILL_R - 1), Math.sin(a) * (HILL_R - 1)); g.lineTo(Math.cos(a) * (HILL_R + 25), Math.sin(a) * (HILL_R + 25)); g.stroke(); }
  }

  function drawExitDoor(g, now, ck) {
    g.save(); g.translate(DOOR.x, DOOR.y);
    const glow = g.createRadialGradient(0, 0, 4, 0, 0, 120);
    glow.addColorStop(0, `rgba(255,236,170,${0.35 + 0.25 * Math.sin(now * 0.004) + 0.25 * ck.nightK})`); glow.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = glow; g.fillRect(-120, -120, 240, 240);
    g.fillStyle = '#2b2118'; g.fillRect(-26, -34, 52, 50);
    g.fillStyle = '#7a5a34'; g.fillRect(-20, -28, 40, 44);
    g.strokeStyle = '#4a3418'; g.lineWidth = 2; g.strokeRect(-20, -28, 40, 44);
    g.beginPath(); g.moveTo(0, -28); g.lineTo(0, 16); g.stroke();
    g.fillStyle = '#e8c860'; g.beginPath(); g.arc(8, -4, 2.6, 0, 6.283); g.fill();
    g.restore();
  }

  function drawHouse(g, h, now, ck) {
    const lit = ck.nightK;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(h.x0 + 6, h.y0 + 8, HW, HH);
    g.fillStyle = '#b58a5a'; g.fillRect(h.x0, h.y0, HW, HH);                    // the floor, seen with the roof lifted off
    g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 1;
    for (let y = h.y0 + 12; y < h.y1; y += 12) { g.beginPath(); g.moveTo(h.x0, y); g.lineTo(h.x1, y); g.stroke(); }
    g.fillStyle = '#8a3a3a'; g.fillRect(h.x0 + 30, h.y0 + 40, 56, 30);          // a rug
    g.fillStyle = '#b05252'; g.fillRect(h.x0 + 34, h.y0 + 44, 48, 22);
    g.fillStyle = '#d8d0c0'; g.fillRect(h.x0 + 12, h.y0 + 12, 28, 40);          // a bed
    g.fillStyle = '#4a6a9a'; g.fillRect(h.x0 + 12, h.y0 + 24, 28, 28);
    g.fillStyle = '#f2ece0'; g.fillRect(h.x0 + 15, h.y0 + 14, 22, 9);
    g.fillStyle = '#6a4a2a'; g.fillRect(h.x1 - 40, h.y0 + 14, 28, 22);          // a table and its lamp
    g.fillStyle = lit > 0.1 ? '#ffe49a' : '#d8c070'; g.beginPath(); g.arc(h.x1 - 26, h.y0 + 25, 5, 0, 6.283); g.fill();
    g.fillStyle = '#6a4a32';
    h.walls.forEach(([wx, wy, ww, wh]) => g.fillRect(wx, wy, ww, wh));
    g.strokeStyle = '#3a2814'; g.lineWidth = 1.5;
    h.walls.forEach(([wx, wy, ww, wh]) => g.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1));
    g.fillStyle = lit > 0.1 ? `rgba(255,226,140,${0.5 + 0.5 * lit})` : 'rgba(170,200,230,0.8)';   // windows
    g.fillRect(h.x0 + 40, h.y0 + 1, 14, 6); g.fillRect(h.x1 - 7, h.y0 + 40, 6, 16); g.fillRect(h.x0 + 1, h.y0 + 56, 6, 14);
    g.fillStyle = '#8a2e2e';                                                     // the near edge of the roof, overhanging the front
    g.fillRect(h.x0 - 5, h.y1 - 1, (HW - DOOR_W) / 2 + 5, 6); g.fillRect(h.x1 - (HW - DOOR_W) / 2, h.y1 - 1, (HW - DOOR_W) / 2 + 5, 6);
    g.fillStyle = '#7a5230';                                                     // the front door, standing open
    g.beginPath(); g.moveTo(h.x + DOOR_W / 2, h.y1 - WALL); g.lineTo(h.x + DOOR_W / 2 + 10, h.y1 + 10); g.lineTo(h.x + DOOR_W / 2 + 14, h.y1 + 10); g.lineTo(h.x + DOOR_W / 2 + 4, h.y1 - WALL); g.closePath(); g.fill();
  }

  function drawEye(g, e, now) {
    if (e.alpha <= 0) return;
    const w = 66 * e.size * (e.chasing ? 1.15 : 1), h = w * 0.62;
    const bob = Math.sin(now * 0.002 + e.ph) * 5, jx = e.chasing ? (Math.random() - 0.5) * 2.5 : 0, jy = e.chasing ? (Math.random() - 0.5) * 2.5 : 0;
    g.save(); g.globalAlpha = e.alpha;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(e.x, e.y + 30, w * 0.4, 6, 0, 0, 6.283); g.fill();
    const gl = g.createRadialGradient(e.x, e.y - 20 + bob, 4, e.x, e.y - 20 + bob, w);
    gl.addColorStop(0, e.chasing ? 'rgba(255,60,60,0.35)' : 'rgba(255,255,255,0.25)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(e.x - w, e.y - 20 + bob - w, w * 2, w * 2);
    const blink = Math.sin(now * 0.0011 + e.ph * 3) > 0.985 ? 0.12 : 1;
    g.drawImage(Eyes.sprite(e.v, e.gaze.gx, e.gaze.gy), e.x - w / 2 + jx, e.y - 20 + bob - h / 2 * blink + jy, w, h * blink);
    g.restore();
  }

  function renderViewport(i, now, ck) {
    const p = players[i], vx = i * VIEW_W;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    drawSky(ctx, vx, p.x, p.y, ck);
    ctx.translate(Math.round(vx + VIEW_W / 2 - p.x), Math.round(VIEW_H / 2 - p.y));
    drawSkyArt(ctx, p.x, p.y, ck);
    drawGround(ctx, p.x, p.y, ck);
    drawExitDoor(ctx, now, ck);
    houses.forEach((h) => { if (Math.abs(h.x - p.x) < VIEW_W / 2 + 100 && Math.abs(h.y - p.y) < VIEW_H / 2 + 100) drawHouse(ctx, h, now, ck); });
    players.slice().sort((a, b) => a.y - b.y).forEach((pl) => window.PlayerModel.draw(ctx, PLAYER_RADIUS, pl));
    eyes.forEach((e) => { if (Math.abs(e.x - p.x) < VIEW_W / 2 + 80 && Math.abs(e.y - p.y) < VIEW_H / 2 + 100) drawEye(ctx, e, now); });
    ctx.restore();

    if (ck.dusk > 0 || ck.nightK > 0) {                                           // the dark, with a light round you and the houses' lamps
      maskCtx.globalCompositeOperation = 'source-over';
      maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
      maskCtx.fillStyle = '#02030c'; maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);
      const sx = (wx) => wx - p.x + VIEW_W / 2, sy = (wy) => wy - p.y + VIEW_H / 2;
      punch(maskCtx, VIEW_W / 2, VIEW_H / 2, 90, 1); punch(maskCtx, VIEW_W / 2, VIEW_H / 2, 230, 0.85);
      houses.forEach((h) => { punch(maskCtx, sx(h.x), sy(h.y), 120, 0.95); });
      punch(maskCtx, sx(DOOR.x), sy(DOOR.y), 130, 0.8);
      eyes.forEach((e) => { punch(maskCtx, sx(e.x), sy(e.y - 20), 70, 0.5 * e.alpha); });
      ctx.save(); ctx.globalAlpha = ck.nightK * 0.95; ctx.drawImage(maskCanvas, vx, 0); ctx.restore();
      if (ck.dusk > 0) { ctx.fillStyle = `rgba(255,120,40,${0.18 * ck.dusk})`; ctx.fillRect(vx, 0, VIEW_W, VIEW_H); }
    }
    ctx.restore();
  }
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W; maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');
  function punch(g, x, y, r, a) {
    if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) return;
    g.save(); g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); g.restore();
  }

  function text(msg, y, alpha, size) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.font = `${size || 16}px Georgia, serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(msg, canvas.width / 2 + 1, y + 1);
    ctx.fillStyle = '#fff6dc'; ctx.fillText(msg, canvas.width / 2, y);
    ctx.restore();
  }

  let last = null;
  function loop(now) {
    try {
      const dt = last === null ? 1 / 60 : Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!startAt) startAt = now;
      const ck = update(now, dt);
      const since = now - startAt;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderViewport(0, now, ck);
      if (PLAYER_MODE === 2) {
        renderViewport(1, now, ck);
        ctx.strokeStyle = '#2a3a2a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(VIEW_W, 0); ctx.lineTo(VIEW_W, VIEW_H); ctx.stroke();
      }
      players.forEach((p, i) => {
        if (p.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${p.flash * 0.6})`; ctx.fillRect(i * VIEW_W, 0, VIEW_W, VIEW_H); }
        const c = now - p.caughtAt;
        if (c >= 0 && c < CAUGHT_MS) {                                           // it has you: one eye, filling the picture
          ctx.save(); ctx.beginPath(); ctx.rect(i * VIEW_W, 0, VIEW_W, VIEW_H); ctx.clip();
          ctx.fillStyle = '#000'; ctx.fillRect(i * VIEW_W, 0, VIEW_W, VIEW_H);
          const k = clamp(c / CAUGHT_MS, 0, 1), w = VIEW_W * (0.9 + k * 0.6);
          ctx.drawImage(Eyes.sprite(2, 0, 0), i * VIEW_W + VIEW_W / 2 - w / 2 + (Math.random() - 0.5) * 8, VIEW_H / 2 - w * 0.31 + (Math.random() - 0.5) * 8, w, w * 0.62);
          if (c < 140) { ctx.fillStyle = '#fff'; ctx.fillRect(i * VIEW_W, 0, VIEW_W, VIEW_H); }
          ctx.restore();
        }
      });
      if (phase === 'white') { ctx.fillStyle = `rgba(255,252,235,${clamp((now - phaseAt) / WHITE_MS, 0, 1)})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      else if (phase === 'end') {
        ctx.fillStyle = '#fffcec'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = `rgba(0,0,0,${clamp((now - phaseAt) / END_MS, 0, 1)})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (since < FADE_IN_MS) { ctx.fillStyle = `rgba(0,0,0,${1 - since / FADE_IN_MS})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }

      if (phase === 'play') {
        if (since > 1800 && since < 11000) text('Somewhere along the edge of the sky there is a door.', canvas.height - 16, clamp(Math.min((since - 1800) / 600, (11000 - since) / 900), 0, 1), 15);
        const na = now - noticeAt;
        if (na < 2600) text(notice, 36, clamp(Math.min(na / 300, (2600 - na) / 700), 0, 1), 22);
      }
      hudEl.textContent = ck.night ? `Night — morning in ${Math.ceil(ck.left / 1000)}s` : `Day — night falls in ${Math.ceil(ck.left / 1000)}s`;
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
