// The Crawler Chase: a short film in a facility corridor. Three people -- orange, green and yellow -- run
// for their lives, flashlights swinging, alarm lights washing the walls red. Behind them a baby Crawler
// scuttles after them. It gains, it leaps, it lands on yellow's back, and it holds on. The camera does not stop:
// it swings forward and goes with the other two while yellow struggles, smaller and smaller, in the dark behind.
//
// Used two ways, each a pure function of time (t in ms), like js/bosscutscene.js:
//   CrawlerChase.draw(ctx, w, h, t)                    -- the opening of Story 1, Level 1
//   CrawlerChase.draw(ctx, w, h, t, { dream: true })   -- the same film as it plays in the Dream's last room, where
//                                                         something large is chasing them too, and what happens when
//                                                         it reaches yellow (js/dreamend.js)
//   CrawlerChase.duration(opts), CrawlerChase.tick(audioCtx, prevT, t, opts) (optional sound), skipRequested()
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const lerp = (a, b, k) => a + (b - a) * k;
  function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  const V = 190;                       // how fast they run, px/s
  const SL = 3.3, LAND = 3.9;          // the leap, in seconds
  const STOP = 3.75;                   // yellow starts to be dragged down
  const START = { orange: 470, green: 395, yellow: 320 };
  const YELLOW_STOP = START.yellow + V * (STOP + 0.35);
  const COLORS = { orange: '#ff8a3d', green: '#3ddc84', yellow: '#f5d742' };
  const DREAM = { touch: 6.7, gone: 9.4, cut: 13.6 };

  function xOf(who, s) {
    if (who !== 'yellow') return START[who] + V * s;
    if (s <= STOP) return START.yellow + V * s;
    const u = Math.min(s - STOP, 0.7);
    return START.yellow + V * (STOP + u - (u * u) / 1.4);
  }
  const yellowFreeX = (s) => START.yellow + V * s;

  function yOf(who, s, cy) {
    const base = { orange: -27, green: 29, yellow: 2 }[who];
    const bob = who === 'yellow' && s > LAND ? 0 : Math.sin(s * 15 + base) * 1.8;
    return cy + base + bob + (who === 'yellow' && s > LAND ? Math.sin(s * 31) * 1.8 : 0);
  }

  function crawlerAt(s, cy) {                                   // { x, y, z, scale }
    const leapFrom = xOf('yellow', SL) - 95;
    if (s < SL) {
      const x = 80 + (leapFrom - 80) * (s / SL);
      return { x, y: cy + 4 + Math.sin(s * 22) * 3, z: Math.abs(Math.sin(s * 11)) * 5, scale: 0.5, leaping: false };
    }
    if (s < LAND) {
      const u = (s - SL) / (LAND - SL), e = 1 - (1 - u) * (1 - u);
      const tx = xOf('yellow', s) - 8, ty = yOf('yellow', s, cy);
      return { x: lerp(leapFrom, tx, e), y: lerp(cy + 4, ty, e), z: 52 * Math.sin(Math.PI * u), scale: 0.5 + 0.28 * Math.sin(Math.PI * u), leaping: true };
    }
    return { x: xOf('yellow', s) - 7 + Math.sin(s * 41) * 1.5, y: yOf('yellow', s, cy) + Math.cos(s * 37) * 1.5, z: 3, scale: 0.62 + 0.05 * Math.sin(s * 9), leaping: false };
  }

  function cameraX(s, dream) {
    const grp = (START.orange + START.green + START.yellow) / 3 + V * s + 90;
    const others = ((xOf('orange', s) + xOf('green', s)) / 2) + 170;
    let cam = lerp(grp, others, smooth((s - LAND) / 1.6));
    if (dream) cam = lerp(cam, YELLOW_STOP + 60, smooth((s - 5.2) / 1.6));
    const focus = smooth((s - (SL - 0.5)) / 0.7) - smooth((s - (LAND + 0.1)) / 1.1);
    cam = lerp(cam, xOf('yellow', s) + 50, clamp(focus, 0, 1) * 0.7);
    return cam;
  }

  // ---------- the corridor ----------
  function drawCorridor(g, w, h, cam, cy, s) {
    const x0 = cam - w / 2 - 60, x1 = cam + w / 2 + 60, TL = 48;
    g.fillStyle = '#12161d'; g.fillRect(0, 0, w, h);
    for (let tx = Math.floor(x0 / TL); tx * TL < x1; tx++) {                                    // the floor
      const sx = tx * TL - cam + w / 2;
      for (let ty = 0; ty < 5; ty++) {
        const sy = cy - 120 + ty * 48 + 0;
        const k = hash(tx * 7 + ty);
        g.fillStyle = (tx + ty) & 1 ? '#2a313c' : '#262c36'; g.fillRect(sx, sy, TL, TL);
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(sx + 1, sy + 1, TL - 2, TL - 2);
        if (k > 0.9) { g.fillStyle = 'rgba(0,0,0,0.5)'; for (let b = 0; b < 5; b++) g.fillRect(sx + 6 + b * 8, sy + 6, 4, TL - 12); }       // a grate
        else if (k < 0.12) { g.fillStyle = 'rgba(140,40,30,0.25)'; g.beginPath(); g.arc(sx + k * 300, sy + 28, 9, 0, TAU); g.fill(); }  // a stain
      }
    }
    for (const side of [-1, 1]) {                                                                // hazard stripes along each wall
      const y = cy + side * 96 - (side < 0 ? 0 : 10);
      g.save(); g.beginPath(); g.rect(0, y, w, 10); g.clip();
      for (let k = Math.floor(x0 / 20); k * 20 < x1; k++) { g.fillStyle = k & 1 ? '#c9a21f' : '#17191d'; g.beginPath(); const sx = k * 20 - cam + w / 2; g.moveTo(sx, y + 10); g.lineTo(sx + 10, y); g.lineTo(sx + 20, y); g.lineTo(sx + 10, y + 10); g.closePath(); g.fill(); }
      g.restore();
    }
    for (const side of [-1, 1]) {                                                                // the walls: panels, pipes, doors
      const y0 = side < 0 ? 0 : cy + 106, y1 = side < 0 ? cy - 106 : h;
      g.fillStyle = '#1b2029'; g.fillRect(0, y0, w, y1 - y0);
      for (let k = Math.floor(x0 / 96); k * 96 < x1; k++) {
        const sx = k * 96 - cam + w / 2, r = hash(k * 3 + side);
        g.fillStyle = '#222833'; g.fillRect(sx + 3, y0 + 3, 90, y1 - y0 - 6);
        g.strokeStyle = '#0d1015'; g.lineWidth = 2; g.strokeRect(sx + 3, y0 + 3, 90, y1 - y0 - 6);
        if (r > 0.72) {                                                                          // a shut blast door with a red light
          g.fillStyle = '#3a414d'; g.fillRect(sx + 14, side < 0 ? y1 - 66 : y0, 68, 66);
          g.fillStyle = `rgba(255,50,40,${0.5 + 0.5 * Math.sin(s * 5 + k)})`; g.beginPath(); g.arc(sx + 48, side < 0 ? y1 - 74 : y0 + 74, 3.5, 0, TAU); g.fill();
        } else if (r < 0.2) {
          g.fillStyle = '#d6b52a'; g.fillRect(sx + 30, y0 + (side < 0 ? 12 : y1 - y0 - 34), 36, 22);
          g.fillStyle = '#17191d'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText('!', sx + 48, y0 + (side < 0 ? 29 : y1 - y0 - 17));
        }
      }
      g.strokeStyle = '#33505c'; g.lineWidth = 5;                                                // pipes
      [10, 22].forEach((o) => { const py = side < 0 ? o + (cy > 150 ? 0 : 0) : h - o; g.beginPath(); g.moveTo(0, py); g.lineTo(w, py); g.stroke(); });
      g.strokeStyle = '#6a4a38'; g.lineWidth = 3; const py = side < 0 ? 38 : h - 38; g.beginPath(); g.moveTo(0, py); g.lineTo(w, py); g.stroke();
    }
  }

  function addLights(g, w, h, cam, cy, s) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const L = 360;
    for (let k = Math.floor((cam - w / 2 - 200) / L); k * L < cam + w / 2 + 200; k++) {            // ceiling lights, some failing
      const sx = k * L + 120 - cam + w / 2, r = hash(k * 5 + 1), flick = r < 0.3 ? (Math.sin(s * 40 + k * 9) > 0.3 ? 1 : 0.15) : 1;
      const gr = g.createRadialGradient(sx, cy, 4, sx, cy, 200);
      gr.addColorStop(0, `rgba(255,236,190,${0.34 * flick})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = gr; g.fillRect(sx - 200, 0, 400, h);
    }
    g.restore();
  }

  function flashlight(g, x, y, ang, len) {
    g.save(); g.translate(x, y); g.rotate(ang); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, 'rgba(255,248,215,0.42)'); gr.addColorStop(1, 'rgba(255,248,215,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -len * 0.3); g.lineTo(len, len * 0.3); g.closePath(); g.fill();
    g.restore();
  }

  // the Crawler, from the Monsterpedia, with a skitter of dark dust behind it and a red glint in its eye
  function drawCrawler(g, c, t, hold) {
    const M = window.MonsterModels;
    g.save(); g.translate(c.x, c.y);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(0, 9 + c.z * 0.15, 13 * c.scale * 1.6, 5, 0, 0, TAU); g.fill();
    g.translate(0, -c.z);
    if (hold) {                                                                                  // legs digging into its host
      g.strokeStyle = 'rgba(20,6,8,0.95)'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + 0.4, l = 17 + 5 * Math.sin(t * 0.03 + k); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l * 0.8); g.stroke(); }
    }
    if (M) { const sp = M.sprite(0, t), z = c.scale * 1.15; g.scale(z, z); g.drawImage(sp, -sp.width / 2, -sp.height / 2); }
    else { g.fillStyle = '#511'; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill(); }
    g.restore();
  }

  function runner(g, who, x, y, s, face, phase, scale) {
    g.save(); g.translate(x, y); g.scale(scale || 1.65, scale || 1.65);
    window.PlayerModel.draw(g, 10, { x: 0, y: 0, color: COLORS[who], facing: { x: Math.cos(face), y: Math.sin(face) }, walkPhase: phase });
    g.restore();
  }

  // ---------- the film ----------
  function draw(g, w, h, t, opts) {
    const dream = !!(opts && opts.dream), s = t / 1000, cy = h / 2 + 8;
    const cut = dream ? DREAM.cut : 11.3;
    if (s >= cut) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return; }
    const cam = cameraX(s, dream);
    const focus = clamp(smooth((s - (SL - 0.5)) / 0.7) - smooth((s - (LAND + 0.1)) / 1.1), 0, 1);
    const z = 1 + 0.32 * focus;
    const shake = (1 - clamp((s - LAND) / 0.5, 0, 1)) * (s >= LAND ? 9 : 0) + 1;
    const sx = (Math.sin(s * 53) + Math.sin(s * 31)) * 0.5 * shake, sy = (Math.cos(s * 47) + Math.cos(s * 29)) * 0.5 * shake;

    g.save();
    g.translate(w / 2 + sx, h / 2 + sy); g.scale(z, z); g.translate(-w / 2, -h / 2);
    drawCorridor(g, w, h, cam, cy, s);
    addLights(g, w, h, cam, cy, s);
    const toS = (wx) => wx - cam + w / 2;

    const crawler = crawlerAt(s, cy), held = s >= LAND;
    // footfall dust and the Crawler's skitter
    for (const who of ['orange', 'green', 'yellow']) {
      if (who === 'yellow' && s > LAND + 0.2) continue;
      for (let k = 0; k < 6; k++) {
        const tb = Math.floor(s / 0.11) * 0.11 - k * 0.11, age = s - tb;
        if (tb < 0 || age > 0.7) continue;
        g.fillStyle = `rgba(190,180,160,${0.22 * (1 - age / 0.7)})`; g.beginPath(); g.arc(toS(xOf(who, tb)) - 10, yOf(who, tb, cy) + 11, 3 + age * 14, 0, TAU); g.fill();
      }
    }
    if (!held) for (let k = 0; k < 6; k++) {
      const tb = Math.floor(s / 0.07) * 0.07 - k * 0.07, age = s - tb; if (tb < 0 || tb > SL) continue;
      const cx0 = 80 + (xOf('yellow', SL) - 95 - 80) * (tb / SL);
      g.fillStyle = `rgba(20,14,12,${0.4 * (1 - age / 0.42)})`; g.beginPath(); g.arc(toS(cx0) - 8, cy + 12, 2 + age * 8, 0, TAU); g.fill();
    }

    // the dream's monster: huge, dark, red-eyed, always a little behind
    let mon = null;
    if (dream) {
      const mx = s < 5.0 ? -60 + 150 * s : lerp(-60 + 150 * 5.0, YELLOW_STOP - 46, smooth((s - 5.0) / 1.8));
      mon = { x: mx, y: cy + 2 };
    }

    // flashlights, then bodies, back to front
    const lookBack = clamp((s - (LAND + 0.1)) / 0.3, 0, 1) - clamp((s - (LAND + 0.8)) / 0.5, 0, 1);
    const people = [
      { who: 'orange', x: xOf('orange', s), y: yOf('orange', s, cy), face: 0, phase: s * 17 },
      { who: 'green', x: xOf('green', s), y: yOf('green', s, cy), face: lookBack * 2.5, phase: s * 17 + 1.3 },
    ];
    const yellowTouched = dream && s > DREAM.touch;
    const yFace = !held ? 0 : yellowTouched ? (Math.floor(s * 11) % 2 ? 3.14 + 0.5 : 3.14 - 0.4) * (s > DREAM.touch + 0.3 ? 1 : 0.2) + 0.05 : Math.PI + Math.sin(s * 9) * 0.9;
    const yellowX = xOf('yellow', s) + (held ? Math.sin(s * 38) * 2.2 + (yellowTouched ? Math.sin(s * 70) * 2 : 0) : 0);
    people.push({ who: 'yellow', x: yellowX, y: yOf('yellow', s, cy), face: yFace, phase: held ? s * (yellowTouched ? 55 : 30) : s * 17 + 2.1 });
    people.forEach((p) => { if (p.who !== 'yellow' || !held) flashlight(g, toS(p.x), p.y, p.face * 0.4, 210); });
    if (held && !yellowTouched) flashlight(g, toS(yellowX), yOf('yellow', s, cy), 3.14 + Math.sin(s * 7) * 0.6, 150);

    const order = [{ k: 'p', y: 0 }].concat([]);
    const draws = [];
    people.forEach((p) => draws.push({ y: p.y, f: () => runner(g, p.who, toS(p.x), p.y, s, p.face, p.phase) }));
    draws.push({ y: crawler.y + 1, f: () => drawCrawler(g, { x: toS(crawler.x), y: crawler.y, z: crawler.z, scale: crawler.scale }, t, held) });
    if (mon) {
      const dissolve = clamp((s - DREAM.touch) / (DREAM.gone - DREAM.touch), 0, 1), M = window.MonsterModels;
      if (dissolve < 1) draws.push({ y: mon.y, f: () => {
        g.save(); g.translate(toS(mon.x), mon.y);
        const aura = g.createRadialGradient(0, 0, 6, 0, 0, 90); aura.addColorStop(0, `rgba(255,40,30,${0.5 * (1 - dissolve)})`); aura.addColorStop(1, 'rgba(255,40,30,0)');
        g.fillStyle = aura; g.fillRect(-90, -90, 180, 180);
        g.globalAlpha = 1 - smooth(dissolve * 1.15);
        const sc = (50 / (M ? M.extent(24) : 40)) * (1 - dissolve * 0.35), wob = dissolve > 0 ? Math.sin(s * 40) * dissolve * 4 : 0;
        g.translate(wob, -dissolve * 12); g.scale(sc, sc);
        if (M) M.draw(24, g, t);
        g.restore();
      } });
    }
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());

    if (mon && s > DREAM.touch) {                                                              // it evaporates: soot and embers rising off it
      const dis = (s - DREAM.touch);
      for (let k = 0; k < 70; k++) {
        const r1 = hash(k * 3 + 1), r2 = hash(k * 3 + 2), r3 = hash(k * 3 + 3), born = r1 * 2.4, age = dis - born;
        if (age < 0 || age > 2.4) continue;
        const px = toS(mon.x) + (r2 - 0.5) * 70 + Math.sin(age * 3 + k) * 14, py = mon.y - age * (30 + r3 * 40) + 6;
        g.fillStyle = k % 3 ? `rgba(40,12,14,${0.7 * (1 - age / 2.4)})` : `rgba(255,${70 + r3 * 90 | 0},30,${0.9 * (1 - age / 2.4)})`;
        g.beginPath(); g.arc(px, py, 1.5 + r2 * 3.5 * (1 - age / 2.4), 0, TAU); g.fill();
      }
      if (dis < 0.25) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - dis / 0.25)})`; g.fillRect(0, 0, w, h); }
    }

    // dust in the beams, and the beams of the ceiling
    g.fillStyle = 'rgba(255,245,220,0.5)';
    for (let k = 0; k < 40; k++) { const px = ((hash(k) * (w + 200) - cam * 0.4 * (0.5 + hash(k + 40)) + s * 8) % (w + 200) + (w + 200)) % (w + 200) - 100, py = cy - 100 + hash(k + 80) * 200 + Math.sin(s + k) * 5; g.globalAlpha = 0.15 + 0.25 * hash(k + 120); g.fillRect(px, py, 1.5, 1.5); }
    g.globalAlpha = 1;
    g.fillStyle = '#07090c';                                                                   // overhead beams that rush past, closer to the camera
    for (let k = Math.floor((cam * 1.35 - w) / 520); k * 520 < cam * 1.35 + w; k++) g.fillRect(k * 520 - cam * 1.35 + w / 2, 0, 16, h * 0.14);
    g.restore();

    // the red alarm, a vignette, film grain, a white flash at the moment of the leap, and the black bars
    g.fillStyle = `rgba(200,20,20,${0.07 + 0.06 * Math.sin(s * 6.28)})`; g.fillRect(0, 0, w, h);
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(255,255,255,${0.04 + 0.05 * hash(k + Math.floor(s * 24))})`; g.fillRect(hash(k * 3 + Math.floor(s * 24)) * w, hash(k * 5 + Math.floor(s * 24) + 7) * h, 2, 1); }
    const fl = s >= LAND && s < LAND + 0.09 ? 0.55 : 0;
    if (fl) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, w, h); }
    const bar = Math.round(26 * smooth(s / 0.9));
    g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
    if (!dream && s > 1.2) { g.fillStyle = `rgba(200,200,210,${0.5 * clamp((s - 1.2) / 0.6, 0, 1)})`; g.font = '11px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('Enter — skip', w - 12, h - bar / 2 + 4); }
    const fadeIn = clamp(1 - s / 0.8, 0, 1), fadeOut = dream ? 0 : clamp((s - 10.3) / 1.0, 0, 1);
    if (fadeIn || fadeOut) { g.fillStyle = `rgba(0,0,0,${Math.max(fadeIn, fadeOut)})`; g.fillRect(0, 0, w, h); }
  }

  // ---------- a little sound, if there is an audio context to play it on ----------
  const bufs = new WeakMap();
  function noise(ac, dur, freq, q, vol, delay) {
    let b = bufs.get(ac);
    if (!b) { b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; bufs.set(ac, b); }
    const n = ac.createBufferSource(); n.buffer = b; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(), t0 = ac.currentTime + (delay || 0); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(f); f.connect(g); g.connect(ac.destination); n.start(t0); n.stop(t0 + dur + 0.02);
  }
  function tone(ac, f0, f1, dur, vol, type) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, ac.currentTime); o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur + 0.02);
  }
  function tick(ac, prevT, t, opts) {
    if (!ac) return;
    const a = prevT / 1000, b = t / 1000, dream = !!(opts && opts.dream);
    const crossed = (x) => a < x && b >= x;
    const stepA = Math.floor(a / 0.2), stepB = Math.floor(b / 0.2);
    if (stepB !== stepA && b < (dream ? DREAM.cut : 11)) {
      const quiet = b > 7 && !dream ? clamp(1 - (b - 7) / 3, 0.15, 1) : 1;
      if (b < LAND + 1.2 || stepB % 2) { noise(ac, 0.07, 240, 1.2, 0.07 * quiet); if (b < SL) noise(ac, 0.05, 3000, 2, 0.03); }
    }
    if (crossed(SL)) { tone(ac, 900, 1500, 0.18, 0.08, 'square'); noise(ac, 0.2, 2500, 0.8, 0.05); }
    if (crossed(LAND)) { tone(ac, 130, 40, 0.3, 0.4); noise(ac, 0.25, 700, 0.6, 0.25); tone(ac, 1200, 400, 0.25, 0.06, 'sawtooth'); }
    if (b > LAND && b < LAND + 3 && Math.floor(a * 8) !== Math.floor(b * 8)) noise(ac, 0.05, 1800 + Math.random() * 1200, 2, 0.03);
    if (dream) {
      if (crossed(DREAM.touch)) { tone(ac, 60, 30, 1.2, 0.5); noise(ac, 0.8, 400, 0.5, 0.2); }
      if (crossed(DREAM.touch + 0.4)) tone(ac, 800, 80, 2.2, 0.1, 'sawtooth');
      if (b > DREAM.touch + 0.5 && b < DREAM.cut && Math.floor(a * 14) !== Math.floor(b * 14)) noise(ac, 0.04, 300 + Math.random() * 900, 3, 0.07);
    }
  }

  window.CrawlerChase = {
    duration: (opts) => (opts && opts.dream ? DREAM.cut : 11.3) * 1000,
    draw, tick,
    skipRequested(startedAt, skipAt) { return skipAt > startedAt + 600; },
  };
})();
