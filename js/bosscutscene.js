// Boss intro cutscenes. Every boss fight opens with a short film: a lone man
// in a hazmat suit wanders in with a flashlight and the boss kills him in the
// way that boss would. Each scene is a pure function of time (t in ms) so it
// can be scrubbed, skipped and replayed on every retry without any state --
// effects like embers, sparks and blood are hashed from their index, not
// simulated.
//
// A boss level uses it three ways:
//   BossCutscene.duration('pumpkin')                     -- how long the scene runs (ms)
//   BossCutscene.draw(ctx, canvas.width, canvas.height, t, 'pumpkin')   -- draw frame t
//   BossCutscene.skipRequested(introStartedAt)           -- Enter/Space/Esc pressed after the first moments
//
// The bosses themselves are the real Monsterpedia models (window.MonsterModels,
// from js/monsterpedia.js); this file only adds the man, the weapons and limbs
// that do the killing, the rooms, the light and the blood.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
  const outQuad = (v) => { v = clamp(v, 0, 1); return 1 - (1 - v) * (1 - v); };
  const outCubic = (v) => { v = clamp(v, 0, 1); return 1 - Math.pow(1 - v, 3); };
  const inQuad = (v) => { v = clamp(v, 0, 1); return v * v; };
  const lerp = (a, b, v) => a + (b - a) * v;
  // progress of t through [a, b], 0..1
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  function lerpHex(a, b, v) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * v);
    return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  // ---- sound: a few procedural effects, only if the level's music is switched on ----
  let actx = null;
  function audio() {
    const btn = document.getElementById('music-toggle');
    if (btn && btn.classList.contains('muted')) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) { /* ignore */ } }
    return actx && actx.state === 'running' ? actx : null;
  }
  let noiseBuf = null;
  function noise(c, at, dur, f0, f1, gain, type, q) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, at); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.03, dur * 0.3)); gn.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(gn); gn.connect(c.destination); s.start(at); s.stop(at + dur + 0.05);
  }
  function tone(c, at, dur, f0, f1, gain, type) {
    const o = c.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), at + dur);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(gain, at + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(gn); gn.connect(c.destination); o.start(at); o.stop(at + dur + 0.05);
  }
  const SFX = {
    thud(c, a) { tone(c, a, 0.3, 95, 38, 0.5, 'sine'); noise(c, a, 0.18, 400, 120, 0.25, 'lowpass'); },
    stab(c, a) { noise(c, a, 0.14, 4000, 1500, 0.35, 'highpass'); tone(c, a, 0.18, 900, 260, 0.12, 'square'); tone(c, a + 0.04, 0.3, 120, 50, 0.35, 'sine'); },
    whoosh(c, a) { noise(c, a, 0.45, 300, 2400, 0.3, 'bandpass', 2); },
    fire(c, a) { noise(c, a, 1.6, 1400, 300, 0.28, 'lowpass'); noise(c, a, 1.2, 3000, 1000, 0.08, 'bandpass'); },
    ice(c, a) { tone(c, a, 0.35, 2600, 1300, 0.08, 'triangle'); noise(c, a, 0.4, 5000, 2500, 0.18, 'highpass'); },
    shatter(c, a) { noise(c, a, 0.5, 7000, 1800, 0.5, 'highpass'); tone(c, a, 0.4, 3000, 700, 0.1, 'triangle'); tone(c, a, 0.3, 80, 35, 0.4, 'sine'); },
    splash(c, a) { noise(c, a, 0.6, 1400, 300, 0.4, 'bandpass', 1.2); tone(c, a, 0.3, 140, 60, 0.3, 'sine'); },
    roar(c, a) { tone(c, a, 1.0, 130, 50, 0.22, 'sawtooth'); tone(c, a, 1.0, 65, 30, 0.2, 'square'); noise(c, a, 0.9, 900, 200, 0.12, 'lowpass'); },
    slam(c, a) { tone(c, a, 0.8, 70, 26, 0.7, 'sine'); noise(c, a, 0.6, 600, 80, 0.5, 'lowpass'); },
    creak(c, a) { tone(c, a, 0.6, 210, 120, 0.07, 'sawtooth'); noise(c, a, 0.5, 800, 300, 0.05, 'bandpass', 4); },
    squelch(c, a) { noise(c, a, 0.25, 700, 250, 0.3, 'bandpass', 3); tone(c, a, 0.2, 200, 90, 0.15, 'sine'); },
    scream(c, a) { tone(c, a, 0.55, 640, 380, 0.07, 'sawtooth'); tone(c, a + 0.1, 0.4, 900, 420, 0.05, 'square'); },
    clang(c, a) { noise(c, a, 0.12, 5000, 2500, 0.3, 'highpass'); tone(c, a, 0.5, 1180, 1160, 0.1, 'square'); tone(c, a, 0.4, 2310, 2290, 0.06, 'triangle'); tone(c, a + 0.02, 0.3, 110, 55, 0.35, 'sine'); },
    rattle(c, a) { for (let i = 0; i < 5; i++) { noise(c, a + i * 0.07, 0.05, 4200, 2500, 0.14, 'highpass'); tone(c, a + i * 0.07, 0.08, 900 + (i % 2) * 300, 700, 0.04, 'square'); } },
    step(c, a) { noise(c, a, 0.07, 1500, 600, 0.1, 'bandpass', 1.5); tone(c, a, 0.06, 120, 70, 0.05, 'sine'); },
    chirp(c, a) { tone(c, a, 0.09, 3300, 4300, 0.05, 'sine'); tone(c, a + 0.13, 0.08, 3700, 4700, 0.04, 'sine'); tone(c, a + 0.25, 0.1, 3100, 4100, 0.04, 'sine'); },
    wind(c, a) { noise(c, a, 5, 300, 900, 0.07, 'bandpass', 0.8); },
    drip(c, a) { tone(c, a, 0.09, 1900, 800, 0.08, 'sine'); noise(c, a, 0.05, 3000, 1500, 0.04, 'highpass'); },
    spark(c, a) { noise(c, a, 0.3, 5000, 1500, 0.3, 'highpass'); tone(c, a, 0.15, 1400, 300, 0.07, 'square'); },
    knock(c, a) { tone(c, a, 0.25, 160, 80, 0.4, 'sine'); noise(c, a, 0.1, 2200, 900, 0.15, 'bandpass', 3); },
    rumble(c, a) { tone(c, a, 3.6, 42, 28, 0.5, 'sine'); noise(c, a, 3.6, 220, 60, 0.4, 'lowpass'); },
    tremor(c, a) { tone(c, a, 1.2, 48, 36, 0.25, 'sine'); noise(c, a, 1.2, 160, 80, 0.16, 'lowpass'); },
    crack(c, a) { noise(c, a, 0.3, 4000, 700, 0.5, 'highpass'); tone(c, a, 0.3, 110, 40, 0.4, 'sine'); },
    fall(c, a) { tone(c, a, 1.7, 900, 70, 0.12, 'triangle'); noise(c, a, 1.2, 2200, 200, 0.18, 'bandpass', 1); },
    heart(c, a) { tone(c, a, 0.2, 70, 40, 0.5, 'sine'); tone(c, a + 0.22, 0.2, 65, 36, 0.4, 'sine'); },
  };
  let lastSfxT = -1;
  function fireSfx(sc, t) {
    if (t < lastSfxT) lastSfxT = -1;
    const c = sc.sfx && audio();
    if (c) sc.sfx.forEach(([at, name]) => { if (at > lastSfxT && at <= t && SFX[name]) SFX[name](c, c.currentTime + 0.02); });
    lastSfxT = t;
  }

  // ---- the man in the hazmat suit, seen from above, facing +x ----
  //   x, y, ang, u (size)           where, which way, how big
  //   walk (phase), speed (0..1)    leg and arm swing
  //   armsUp, flail (0..1)          hands thrown up / thrashing (needs time)
  //   lie (0..1)                    collapsed flat, arms flung wide
  //   sx, sy                        squash along / across the facing direction
  //   burn, ice, moss (0..1)        suit tint: charred / frozen / overgrown
  //   visorCrack, fog               a cracked visor / a green haze inside it
  //   flashlight                    holds a torch in the right hand
  function drawHazmat(g, o) {
    const u = o.u || 15, time = o.time || 0;
    const burn = o.burn || 0, ice = o.ice || 0, moss = o.moss || 0, lie = o.lie || 0;
    const tint = (c) => {
      let col = c;
      if (burn) col = lerpHex(col, '#1b1511', burn);
      if (ice) col = lerpHex(col, '#c4e8f6', ice * 0.85);
      if (moss) col = lerpHex(col, '#4c6e2c', moss * 0.75);
      return col;
    };
    const suitA = tint('#ffe24d'), suitB = tint('#d29c00'), suitLine = tint('#6a4f00');
    g.save();
    g.translate(o.x, o.y);
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    if (o.shadow !== 0) {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.beginPath(); g.ellipse(u * 0.15, u * 0.2, u * 1.25, u * 1.3, 0, 0, TAU); g.fill();
    }
    g.rotate(o.ang || 0);
    g.scale(o.sx || 1, o.sy || 1);
    const ph = o.walk || 0, sw = Math.sin(ph) * (o.speed || 0);
    const jx = o.jitter ? (hash(Math.floor(time / 40)) - 0.5) * o.jitter * u : 0;
    const jy = o.jitter ? (hash(Math.floor(time / 40) + 9) - 0.5) * o.jitter * u : 0;
    g.translate(jx, jy);

    // backpack with two tanks, and the hose running up to the helmet
    g.fillStyle = tint('#59606b'); g.strokeStyle = tint('#22262c'); g.lineWidth = 1.3;
    rr(g, -1.12 * u, -0.5 * u, 0.62 * u, 1.0 * u, 0.2 * u); g.fill(); g.stroke();
    [-1, 1].forEach((s) => {
      const tg = g.createRadialGradient(-0.86 * u, s * 0.26 * u - 0.05 * u, 1, -0.82 * u, s * 0.26 * u, 0.26 * u);
      tg.addColorStop(0, tint('#f2f4f8')); tg.addColorStop(1, tint('#8d94a0'));
      g.fillStyle = tg; g.beginPath(); g.arc(-0.82 * u, s * 0.26 * u, 0.23 * u, 0, TAU); g.fill(); g.stroke();
    });
    g.strokeStyle = tint('#2a2e34'); g.lineWidth = 0.14 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-0.6 * u, 0); g.quadraticCurveTo(-0.45 * u, -0.5 * u, -0.1 * u, -0.3 * u); g.stroke();

    // boots
    const legSpread = lie * 0.35 * u;
    [-1, 1].forEach((s) => {
      const bx = (s * sw * 0.55 - lie * 0.5) * u, by = s * (0.38 * u + legSpread);
      g.fillStyle = tint('#3b4047'); g.strokeStyle = tint('#16181b'); g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(bx, by, 0.44 * u, 0.27 * u, 0, 0, TAU); g.fill(); g.stroke();
    });

    // torso with reflective tape
    const tg = g.createLinearGradient(0, -u, 0, u);
    tg.addColorStop(0, suitB); tg.addColorStop(0.5, suitA); tg.addColorStop(1, suitB);
    g.fillStyle = tg; g.strokeStyle = suitLine; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 0.66 * u, 1.0 * u, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = tint('#e4e6ea'); g.globalAlpha *= 0.75;
    [-0.2, 0.24].forEach((x) => { rr(g, (x - 0.04) * u, -0.84 * u, 0.09 * u, 1.68 * u, 0.04 * u); g.fill(); });
    g.globalAlpha /= 0.75;
    g.strokeStyle = 'rgba(60,45,0,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-0.55 * u, 0); g.lineTo(0.6 * u, 0); g.stroke();

    // arms
    const handFor = (s) => {
      let hx = (0.32 + sw * 0.5 * s) * u, hy = s * 1.08 * u;
      if (o.armsUp) { hx = lerp(hx, 1.05 * u, o.armsUp); hy = lerp(hy, s * 0.55 * u, o.armsUp); }
      if (o.reach) { hx = lerp(hx, o.reach.x * u, o.reach.k); hy = lerp(hy, (o.reach.y !== undefined ? o.reach.y : s * 0.4) * u * (o.reach.sym ? s : 1), o.reach.k); }
      if (o.flail) { hx += Math.cos(time * 0.021 + s * 2) * 0.62 * u * o.flail; hy += Math.sin(time * 0.027 + s) * 0.55 * u * o.flail; }
      if (lie) { hx = lerp(hx, -0.2 * u, lie); hy = lerp(hy, s * 1.95 * u, lie); }
      return [hx, hy];
    };
    const hands = [-1, 1].map((s) => [s, handFor(s)]);
    hands.forEach(([s, [hx, hy]]) => {
      const sx0 = 0.02 * u, sy0 = s * 0.84 * u;
      const cx = (sx0 + hx) / 2 - 0.1 * u, cy = (sy0 + hy) / 2 + s * 0.34 * u;
      g.lineCap = 'round';
      g.strokeStyle = suitLine; g.lineWidth = 0.5 * u;
      g.beginPath(); g.moveTo(sx0, sy0); g.quadraticCurveTo(cx, cy, hx, hy); g.stroke();
      g.strokeStyle = suitA; g.lineWidth = 0.37 * u;
      g.beginPath(); g.moveTo(sx0, sy0); g.quadraticCurveTo(cx, cy, hx, hy); g.stroke();
      g.fillStyle = tint('#25272b'); g.beginPath(); g.arc(hx, hy, 0.22 * u, 0, TAU); g.fill();
    });
    if (o.flashlight) {
      const [hx, hy] = hands[1][1];
      g.fillStyle = '#3d4046'; rr(g, hx, hy - 0.12 * u, 0.62 * u, 0.24 * u, 0.06 * u); g.fill();
      g.fillStyle = '#fff6c4'; g.beginPath(); g.ellipse(hx + 0.64 * u, hy, 0.09 * u, 0.15 * u, 0, 0, TAU); g.fill();
    }

    if (o.bare) {
      // helmet off: a chimp's head (fur, ears, a pale muzzle) and the helmet clipped to the pack
      const bx = 0.16 * u;
      g.fillStyle = suitB; g.strokeStyle = suitLine; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(bx - 0.04 * u, 0, 0.5 * u, 0.62 * u, 0, 0, TAU); g.fill(); g.stroke();
      [-1, 1].forEach((s) => {
        g.fillStyle = '#7a5636'; g.strokeStyle = '#2a1a10'; g.lineWidth = 1;
        g.beginPath(); g.arc(bx - 0.05 * u, s * 0.5 * u, 0.2 * u, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#d9a58a'; g.beginPath(); g.arc(bx - 0.04 * u, s * 0.5 * u, 0.11 * u, 0, TAU); g.fill();
      });
      const fg = g.createRadialGradient(bx - 0.15 * u, -0.15 * u, 1, bx, 0, 0.55 * u);
      fg.addColorStop(0, '#8a6540'); fg.addColorStop(1, '#4a3220');
      g.fillStyle = fg; g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(bx, 0, 0.5 * u, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#3a2616'; g.beginPath(); g.ellipse(bx - 0.18 * u, 0, 0.2 * u, 0.3 * u, 0, 0, TAU); g.fill();
      g.fillStyle = '#d6ac86'; g.strokeStyle = '#3a2616'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(bx + 0.4 * u, 0, 0.24 * u, 0.3 * u, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#2a1a14'; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(bx + 0.54 * u, s * 0.1 * u, 0.04 * u, 0.06 * u, 0, 0, TAU); g.fill(); });
      [-1, 1].forEach((s) => {
        g.fillStyle = '#14100c'; g.beginPath(); g.ellipse(bx + 0.24 * u, s * 0.24 * u, 0.07 * u, 0.09 * u, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(bx + 0.26 * u, s * 0.22 * u, 0.025 * u, 0, TAU); g.fill();
      });
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(bx + 0.2 * u, -0.36 * u); g.quadraticCurveTo(bx + 0.3 * u, 0, bx + 0.2 * u, 0.36 * u); g.stroke();
      const hc = o.helmetCol || '#ffe24d';
      g.fillStyle = hc; g.strokeStyle = suitLine; g.lineWidth = 1.2;
      g.beginPath(); g.arc(-0.92 * u, 0, 0.36 * u, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#12363e'; g.beginPath(); g.ellipse(-0.78 * u, 0, 0.17 * u, 0.25 * u, 0, 0, TAU); g.fill();
    } else {
    // helmet and visor
    const hx0 = (0.14 - lie * 0.25) * u, hy0 = lie * 0.6 * u * (o.lieSide || 1);
    const hg = g.createRadialGradient(hx0 - 0.2 * u, hy0 - 0.25 * u, 1, hx0, hy0, 0.78 * u);
    hg.addColorStop(0, tint('#fff59e')); hg.addColorStop(1, suitB);
    g.fillStyle = hg; g.strokeStyle = suitLine; g.lineWidth = 1.5;
    g.beginPath(); g.arc(hx0, hy0, 0.68 * u, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = tint('#3a3000'); g.beginPath(); g.arc(hx0 - 0.28 * u, hy0, 0.12 * u, 0, TAU); g.fill();
    const vg = g.createLinearGradient(hx0 + 0.1 * u, hy0 - 0.4 * u, hx0 + 0.6 * u, hy0 + 0.4 * u);
    if (ice) { vg.addColorStop(0, '#dff6ff'); vg.addColorStop(1, '#8cc4dc'); }
    else if (burn > 0.5) { vg.addColorStop(0, '#2a2420'); vg.addColorStop(1, '#0c0a08'); }
    else { vg.addColorStop(0, '#2c6f7d'); vg.addColorStop(1, '#0b232a'); }
    g.fillStyle = vg; g.strokeStyle = '#06161a'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(hx0 + 0.36 * u, hy0, 0.36 * u, 0.5 * u, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(hx0 + 0.28 * u, hy0 - 0.2 * u, 0.13 * u, 0.05 * u, -0.5, 0, TAU); g.fill();
    if (o.fog) { g.fillStyle = `rgba(150,230,90,${0.55 * o.fog})`; g.beginPath(); g.ellipse(hx0 + 0.36 * u, hy0, 0.36 * u, 0.5 * u, 0, 0, TAU); g.fill(); }
    if (o.visorCrack) {
      g.strokeStyle = `rgba(230,250,255,${0.9 * o.visorCrack})`; g.lineWidth = 1;
      [[0.2, -0.3, 0.55, 0.05], [0.4, -0.4, 0.45, 0.35], [0.3, 0.3, 0.65, -0.1]].forEach(([a, b, c, d]) => {
        g.beginPath(); g.moveTo(hx0 + a * u, hy0 + b * u); g.lineTo(hx0 + (a + c) * 0.5 * u, hy0 + (b + d) * 0.5 * u + 0.05 * u); g.lineTo(hx0 + c * u, hy0 + d * u); g.stroke();
      });
    }
    }
    g.restore();
  }

  // ---- shared effects ----
  function drawBloodPool(g, x, y, r, seed, alpha) {
    if (r < 0.5) return;
    g.save(); g.translate(x, y); g.globalAlpha *= (alpha === undefined ? 1 : alpha);
    const gr = g.createRadialGradient(-r * 0.2, -r * 0.2, 1, 0, 0, r * 1.1);
    gr.addColorStop(0, '#6e0f16'); gr.addColorStop(0.7, '#4a0a10'); gr.addColorStop(1, '#2c0508');
    g.fillStyle = gr;
    g.beginPath();
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, rr0 = r * (0.78 + 0.3 * hash(seed + (i % n) * 3.1));
      const px = Math.cos(a) * rr0, py = Math.sin(a) * rr0 * 0.9;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,170,170,0.22)';
    g.beginPath(); g.ellipse(-r * 0.3, -r * 0.3, r * 0.3, r * 0.12, -0.5, 0, TAU); g.fill();
    g.restore();
  }
  // a burst of droplets and streaks thrown out from (x, y) starting at t0
  function spray(g, x, y, t, t0, o) {
    const p = (t - t0) / (o.dur || 500);
    if (p <= 0 || p >= 1) return;
    const e = outCubic(p);
    for (let i = 0; i < o.n; i++) {
      const sd = o.seed + i * 7.3;
      const a = (o.dir !== undefined ? o.dir + (hash(sd) - 0.5) * (o.spread || TAU) : hash(sd) * TAU);
      const d = o.r * (0.25 + 0.75 * hash(sd + 2)) * e;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + (o.grav || 0) * p * p * 30;
      const sz = (o.size || 3) * (0.4 + hash(sd + 4)) * (p > 0.8 ? (1 - p) / 0.2 : 1);
      g.fillStyle = o.color || '#8a0f1a';
      g.beginPath(); g.arc(px, py, sz, 0, TAU); g.fill();
      if (o.streak && p < 0.6) {
        g.strokeStyle = o.color || '#8a0f1a'; g.lineWidth = sz * 0.7;
        g.beginPath(); g.moveTo(x + Math.cos(a) * d * 0.45, y + Math.sin(a) * d * 0.45); g.lineTo(px, py); g.stroke();
      }
    }
  }
  // dust / embers / snow / spores drifting through a box
  function drift(g, t, n, box, o) {
    for (let i = 0; i < n; i++) {
      const sd = i * 13.7 + (o.seed || 0);
      const sp = (o.speed || 1) * (0.5 + hash(sd));
      const wrap = (v, size) => ((v % size) + size) % size;
      const px = box.x + wrap(hash(sd + 1) * box.w + (o.vx || 0) * t * 0.001 * sp, box.w);
      const py = box.y + wrap(hash(sd + 2) * box.h + (o.vy || 0) * t * 0.001 * sp, box.h);
      const tw = 0.5 + 0.5 * Math.sin(t * 0.004 * (0.5 + hash(sd + 3)) + sd);
      g.globalAlpha = (o.alpha || 0.8) * (o.twinkle === false ? 1 : tw);
      g.fillStyle = o.colors ? o.colors[i % o.colors.length] : o.color;
      g.beginPath(); g.arc(px + Math.sin(t * 0.0015 + sd) * (o.sway || 0), py, (o.size || 1.5) * (0.5 + hash(sd + 4)), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
  function flame(g, x, y, w, h, t, seed, blue) {
    const sway = Math.sin(t * 0.012 + seed) * w * 0.35;
    h *= 0.9 + 0.1 * Math.sin(t * 0.03 + seed * 2);
    const layers = blue ? [['#1a3aff', 1], ['#3a8aff', 0.72], ['#8ad0ff', 0.46], ['#eefaff', 0.22]]
      : [['#ff3a10', 1], ['#ff8a1e', 0.72], ['#ffd25a', 0.46], ['#fff6c8', 0.22]];
    layers.forEach(([col, k]) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - w * k * 0.5, y);
      g.quadraticCurveTo(x - w * k * 0.55 + sway * 0.4, y - h * k * 0.55, x + sway * k, y - h * k);
      g.quadraticCurveTo(x + w * k * 0.55 + sway * 0.4, y - h * k * 0.55, x + w * k * 0.5, y);
      g.closePath(); g.fill();
    });
  }
  function glow(g, x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // a tapering vine / tentacle along a polyline of points, with optional thorns
  function drawVine(g, pts, w0, w1, c0, c1, thorns) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const f = i / (pts.length - 1);
        g.strokeStyle = pass === 0 ? c0 : c1;
        g.lineWidth = Math.max(0.8, lerp(w0, w1, f) * (pass === 0 ? 1 : 0.62));
        g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
      }
    }
    if (thorns) {
      g.fillStyle = thorns;
      for (let i = 2; i < pts.length - 1; i += 2) {
        const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
        const na = a + (i % 4 ? 1.25 : -1.25), wd = lerp(w0, w1, i / (pts.length - 1));
        g.beginPath();
        g.moveTo(pts[i][0] - Math.cos(a) * 2.5, pts[i][1] - Math.sin(a) * 2.5);
        g.lineTo(pts[i][0] + Math.cos(na) * (wd * 0.9 + 4), pts[i][1] + Math.sin(na) * (wd * 0.9 + 4));
        g.lineTo(pts[i][0] + Math.cos(a) * 2.5, pts[i][1] + Math.sin(a) * 2.5);
        g.closePath(); g.fill();
      }
    }
  }
  // a model from the Monsterpedia, centred on (x, y)
  function model(g, id, x, y, s, rot, t, alpha) {
    const M = window.MonsterModels;
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    if (alpha !== undefined) g.globalAlpha *= alpha;
    if (M && M.draw) M.draw(id, g, t);
    else { g.fillStyle = '#833'; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); }
    g.restore();
  }

  // ---- cached floors: drawn once per room, 1400 x 760 centred on the origin ----
  const FW = 1400, FH = 760;
  const floors = {};
  function floorFor(kind, build) {
    if (!floors[kind]) {
      const c = document.createElement('canvas'); c.width = FW; c.height = FH;
      const g = c.getContext('2d'); g.translate(FW / 2, FH / 2);
      build(g);
      floors[kind] = c;
    }
    return floors[kind];
  }
  function blitFloor(g, c) { g.drawImage(c, -FW / 2, -FH / 2); }

  // ---- the frame: camera, light, bars, title ----
  const SCENES = {};
  let maskCv = null;
  function maskFor(w, h) {
    if (!maskCv) maskCv = document.createElement('canvas');
    if (maskCv.width !== w || maskCv.height !== h) { maskCv.width = w; maskCv.height = h; }
    return maskCv;
  }
  function shakeAt(sc, t) {
    let a = 0;
    (sc.shakes || []).forEach(([t0, amp, decay]) => { if (t >= t0) a += amp * Math.exp(-(t - t0) / decay); });
    if (a < 0.05) return { x: 0, y: 0 };
    const f = Math.floor(t / 18);
    return { x: (hash(f) - 0.5) * 2 * a, y: (hash(f + 50) - 0.5) * 2 * a };
  }
  function punch(m, L, c) {
    const sx = c.w / 2 + c.sh.x * c.k + (L.x - c.cam.x) * c.k * c.cam.z;
    const sy = c.h / 2 + c.sh.y * c.k + (L.y - c.cam.y) * c.k * c.cam.z;
    const r = L.r * c.k * c.cam.z;
    m.save();
    if (L.cone) {
      m.beginPath(); m.moveTo(sx, sy); m.arc(sx, sy, r, L.ang - L.half, L.ang + L.half); m.closePath(); m.clip();
    }
    const gr = m.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, `rgba(0,0,0,${L.a})`); gr.addColorStop(0.55, `rgba(0,0,0,${L.a * 0.55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = gr; m.fillRect(sx - r, sy - r, r * 2, r * 2);
    m.restore();
  }
  function drawTitle(g, w, h, t, sc) {
    const start = sc.dur - 1900;
    if (t < start) return;
    const p = (t - start) / 1900;
    const a = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
    const slam = 1 + 0.55 * Math.max(0, 1 - (t - start) / 260);
    g.save();
    g.translate(w / 2, h / 2);
    g.fillStyle = `rgba(5,5,8,${0.62 * a})`; g.fillRect(-w / 2, -h * 0.1, w, h * 0.2);
    g.scale(slam, slam);
    g.font = `bold ${Math.round(h * 0.07)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = sc.color; g.shadowBlur = 14 * a;
    g.fillStyle = sc.color; g.globalAlpha = a;
    g.fillText(sc.name, 0, h * 0.005);
    g.restore();
  }

  function draw(g, w, h, t, kind) {
    const sc = SCENES[kind];
    if (!sc) return;
    t = clamp(t, 0, sc.dur);
    const k = h / 340;
    const cam = sc.camera(t);
    const sh = shakeAt(sc, t);
    const c = { t, k, w, h, sc, cam, sh };
    fireSfx(sc, t);

    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const apply = () => { g.translate(w / 2 + sh.x * k, h / 2 + sh.y * k); g.scale(k * cam.z, k * cam.z); g.translate(-cam.x, -cam.y); };
    g.save(); apply(); sc.world(g, t, c); g.restore();

    // darkness, with the lights punched through it
    const mc = maskFor(w, h), m = mc.getContext('2d');
    m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, w, h);
    const shade = typeof sc.shade === 'function' ? sc.shade(t) : (sc.shade || '2,2,6');
    const dark = typeof sc.dark === 'function' ? sc.dark(t) : sc.dark;
    m.fillStyle = `rgba(${shade},${dark})`; m.fillRect(0, 0, w, h);
    m.globalCompositeOperation = 'destination-out';
    (sc.lights ? sc.lights(t, c) : []).forEach((L) => punch(m, L, c));
    g.drawImage(mc, 0, 0);
    if (sc.after) { g.save(); apply(); sc.after(g, t, c); g.restore(); }

    if (sc.flash) { const f = sc.flash(t); if (f > 0.01) { g.fillStyle = `rgba(220,230,255,${f})`; g.fillRect(0, 0, w, h); } }
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    const bar = h * 0.075;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
    if (sc.dip) { const d = sc.dip(t); if (d > 0.003) { g.fillStyle = `rgba(0,0,0,${Math.min(1, d)})`; g.fillRect(0, 0, w, h); } }
    drawTitle(g, w, h, t, sc);
    const fade = Math.min(t / 500, 1) * Math.min((sc.dur - t) / 300, 1);
    if (fade < 1) { g.fillStyle = `rgba(0,0,0,${1 - fade})`; g.fillRect(0, 0, w, h); }
    if (t > 700 && t < sc.dur - 2000) {
      g.font = `${Math.round(h * 0.034)}px monospace`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(200,200,210,0.55)'; g.fillText('Enter: skip', w - 14, h - bar - 8);
    }
    g.restore();
  }

  // skipping: Enter / Space / Esc, but not in the opening moments (so the Enter
  // that restarts a level after a wipe doesn't also skip the scene)
  let skipAt = 0;
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skipAt = performance.now(); });

  // <<SCENES-START>>
  // ---- helpers the scenes share ----
  // the man's position while he walks from (x0,y0) to (x1,y1) between t0 and t1
  function walk(t, t0, t1, x0, y0, x1, y1) {
    const p = seg(t, t0, t1);
    return { x: lerp(x0, x1, p), y: lerp(y0, y1, p), moving: p > 0 && p < 1, walk: t * 0.0125, speed: p > 0 && p < 1 ? 1 : 0 };
  }
  // where his right hand (the flashlight) is, in the world
  function handPos(gx, gy, ang, u) {
    const lx = 0.7 * u, ly = 1.08 * u;
    return { x: gx + lx * Math.cos(ang) - ly * Math.sin(ang), y: gy + lx * Math.sin(ang) + ly * Math.cos(ang) };
  }
  // the flashlight: a cone of light plus a pool round the man, flickering in the dark
  function torchLights(gx, gy, ang, t, u, power) {
    const f = power === undefined ? 1 : power;
    const fl = 0.9 + 0.1 * Math.sin(t * 0.05) * Math.sin(t * 0.013);
    const h = handPos(gx, gy, ang, u || 15);
    return [
      { x: h.x, y: h.y, r: 330, a: 0.97 * f * fl, cone: true, ang, half: 0.4 },
      { x: gx, y: gy, r: 88, a: 0.8 * f },
    ];
  }
  function torchGlow(g, gx, gy, ang, u, t, power) {
    // a hot spot on the lens itself
    const h = handPos(gx, gy, ang, u);
    const f = power === undefined ? 1 : power;
    g.save(); g.globalCompositeOperation = 'lighter';
    glow(g, h.x + Math.cos(ang) * 12, h.y + Math.sin(ang) * 12, 22, '255,246,200', 0.5 * f);
    g.restore();
  }
  // a wall torch burning on the floor of the scene, drawn small with a warm glow
  function sconce(g, x, y, t, seed) {
    g.save(); g.translate(x, y);
    g.fillStyle = '#2a1a0c'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
    g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
    flame(g, 0, 2, 11, 20, t, seed, false);
    g.restore();
  }
  function sconceLight(x, y, t, seed, r) {
    return { x, y, r: r || 150, a: 0.55 + 0.1 * Math.sin(t * 0.02 + seed) };
  }

  // the roped-off ward floor: mottled pale tiles with vines creeping across
  function wardFloor() {
    return floorFor('ward', (g) => {
      g.fillStyle = '#47645f'; g.fillRect(-FW / 2, -FH / 2, FW, FH);
      for (let i = -11; i < 12; i++) for (let j = -7; j < 8; j++) {
        g.fillStyle = lerpHex('#6a918a', '#8db8b0', hash(i * 31 + j * 7));
        g.fillRect(i * 64, j * 64, 62, 62);
        g.fillStyle = 'rgba(30,60,56,0.18)';
        for (let k = 0; k < 4; k++) g.fillRect(i * 64 + hash(i + j * 9 + k) * 56, j * 64 + hash(i * 5 + j + k * 3) * 56, 3, 3);
      }
      for (let v = 0; v < 18; v++) {
        let x = (hash(v * 3.3) - 0.5) * FW, y = (hash(v * 5.1) - 0.5) * FH, a = hash(v * 7.7) * TAU;
        const pts = [[x, y]];
        for (let s = 0; s < 9; s++) { a += (hash(v * 11 + s) - 0.5) * 1.1; x += Math.cos(a) * 34; y += Math.sin(a) * 34; pts.push([x, y]); }
        drawVine(g, pts, 7, 3, '#173a12', '#3f8a24');
        g.fillStyle = '#5db33a';
        pts.forEach(([px, py], s) => { if (s % 2) { g.beginPath(); g.ellipse(px + 4, py - 3, 7, 3.5, hash(v + s) * 3, 0, TAU); g.fill(); } });
      }
    });
  }
  // a small glowing jack-o-lantern on the ground
  function lantern(g, x, y, t, seed) {
    const fl = 0.8 + 0.2 * Math.sin(t * 0.017 + seed);
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(2, 5, 15, 8, 0, 0, TAU); g.fill();
    const body = g.createRadialGradient(-4, -4, 1, 0, 0, 16);
    body.addColorStop(0, '#ffa63a'); body.addColorStop(1, '#a8420a');
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 15, 12, 0, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,230,120,${fl})`;
    g.beginPath(); g.moveTo(-9, -2); g.lineTo(-3, -2); g.lineTo(-6, -8); g.closePath(); g.moveTo(9, -2); g.lineTo(3, -2); g.lineTo(6, -8); g.closePath();
    g.moveTo(-9, 3); g.lineTo(-4, 6); g.lineTo(0, 3); g.lineTo(4, 6); g.lineTo(9, 3); g.lineTo(5, 8); g.lineTo(-5, 8); g.closePath(); g.fill();
    g.fillStyle = '#3a4a14'; g.fillRect(-2, -14, 4, 5);
    g.restore();
  }

  // a snaking vine reaching from `from` to `to`, `ext` (0..1) of the way there
  function vineTo(from, to, ext, t, seed, amp) {
    const pts = [], N = 16;
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 0; i <= N; i++) {
      const f = (i / N) * ext;
      const wave = Math.sin(f * 7 + t * 0.011 + seed) * (amp === undefined ? 26 : amp) * Math.sin(f * Math.PI) * (1 - ext * 0.55);
      pts.push([from.x + dx * f + nx * wave, from.y + dy * f + ny * wave]);
    }
    return pts;
  }
  // a coiled vine ring round a point (the thorny binding), tightness is the radius
  function vineRing(g, x, y, rx, ry, rot, w, t, seed) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.lineCap = 'round';
    [['#102c0c', w + 3], ['#37801f', w], ['#79cc48', w * 0.35]].forEach(([col, lw]) => {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0.2, TAU - 0.15); g.stroke();
    });
    g.fillStyle = '#e4dcb2';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + seed, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
      g.beginPath(); g.moveTo(px - 2.5, py); g.lineTo(px + Math.cos(a) * (w + 5), py + Math.sin(a) * (w + 5)); g.lineTo(px + 2.5, py); g.closePath(); g.fill();
    }
    g.restore();
  }
  // a flashlight lying on the floor
  function droppedTorch(g, x, y, ang, on) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#3d4046'; rr(g, -6, -3.5, 16, 7, 2); g.fill();
    g.fillStyle = on ? '#fff6c4' : '#6a6a60'; g.beginPath(); g.ellipse(10.5, 0, 2.2, 4, 0, 0, TAU); g.fill();
    g.restore();
  }

  // ============ THE PUMPKIN KING: strangled with its vines ============
  (function () {
    const KX = 190, KY = -6, KS = 2.5, U = 15;
    const DUR = 9000;
    // the man walks in from the left, stops at GX, is grabbed at 4100 and
    // dragged to GX2, strangled until 6300, dropped at 6800
    const GX = -95, GY = 14, GX2 = -10;
    function guy(t) {
      const w = walk(t, 400, 2500, -400, 20, GX, GY);
      let x = w.x, y = w.y, ang = 0;
      let o = { x, y, ang, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6300 };
      if (t > 2500) {                                   // stops, sweeps the beam around, hears something
        o.ang = Math.sin((t - 2500) * 0.0045) * 0.35 * (1 - seg(t, 3000, 3500));
        o.speed = 0;
      }
      if (t > 3300) { o.armsUp = smooth(seg(t, 3300, 3700)) * 0.85; }
      if (t > 4100) {                                    // yanked toward the king, kicking
        const p = smooth(seg(t, 4100, 4900));
        o.x = lerp(GX, GX2, p); o.y = lerp(GY, -4, p);
        o.flail = 1 - 0.55 * seg(t, 4900, 6300);
        o.armsUp = 0;
      }
      if (t > 4300) { o.jitter = 0.28 * (1 - seg(t, 5600, 6300)); }
      return o;
    }
    SCENES.pumpkin = {
      name: 'THE PUMPKIN KING', color: '#ff9a3c', dur: DUR, dark: 0.84, shade: '4,8,10',
      shakes: [[4100, 7, 160], [4900, 5, 140], [5500, 4, 130], [6300, 6, 200], [6800, 5, 160]],
      sfx: [[3300, 'heart'], [3900, 'whoosh'], [4150, 'creak'], [4900, 'creak'], [5600, 'creak'], [5900, 'scream'], [6500, 'thud'], [6900, 'roar']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4200, 7000));
        return { x: lerp(-150, lerp(30, 55, b), a), y: lerp(8, -4, a), z: lerp(1.05, 1.38, a) + 0.05 * b };
      },
      lights(t) {
        const o = guy(t);
        const L = [];
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.8 * seg(t, 5800, 6300)).forEach((l) => L.push(l));
        for (let i = 0; i < 6; i++) L.push({ x: -300 + i * 130, y: i % 2 ? 110 : -120, r: 90, a: 0.42 });
        const roar = 0.35 + 0.4 * seg(t, 3600, 4000) + 0.15 * Math.sin(t * 0.012) * seg(t, 4100, 6300);
        L.push({ x: KX, y: KY + 14, r: 150, a: roar });
        return L;
      },
      world(g, t) {
        blitFloor(g, wardFloor());
        [[-300, 110], [-170, -125], [-30, 120], [90, -118], [330, 105], [320, -120]].forEach(([x, y], i) => lantern(g, x, y, t, i * 2));
        const o = guy(t);
        const lift = (t > 4100 && t < 6800) ? 7 * Math.sin(Math.PI * seg(t, 4100, 4500)) + 5 * seg(t, 4500, 5000) * (1 - seg(t, 6300, 6800)) : 0;
        // the king, with a squeeze-pulse in its fire
        model(g, 32, KX, KY, KS, 0, t * 0.8 + 2000);
        // the man: standing, then lifted and strangled, then dropped
        const dropP = seg(t, 6300, 6900);
        const limp = smooth(dropP);
        g.save();
        const gp = { x: o.x, y: o.y };
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(gp.x + lift * 0.6, gp.y + 5 + lift * 0.5, U * 1.2 * (1 - lift * 0.01), U * 1.25, 0, 0, TAU); g.fill();
        const fall = outQuad(seg(t, 6600, 6900));
        drawHazmat(g, Object.assign({}, o, {
          y: o.y - lift * (1 - fall), shadow: 0, sx: 1 + lift * 0.016, sy: 1 + lift * 0.016,
          lie: t > 6300 ? Math.max(limp * 0.6, outQuad(seg(t, 6600, 7100))) : 0,
          flail: t > 6300 ? 0 : o.flail, visorCrack: seg(t, 5200, 6000), fog: 0, moss: 0,
          armsUp: t > 6300 ? 0 : o.armsUp,
        }));
        g.restore();
        // the vines: they lash out, bind him, and squeeze
        const reach = outCubic(seg(t, 3800, 4150)), release = seg(t, 6300, 6900);
        if (t > 3800 && release < 1) {
          const ext = reach * (1 - release);
          const target = (i) => {
            const tg = [{ x: o.x + 4, y: o.y - 14 - lift }, { x: o.x + 2, y: o.y + 14 - lift }, { x: o.x + 8, y: o.y - lift }, { x: o.x - 4, y: o.y + 4 - lift }][i];
            return tg;
          };
          for (let i = 0; i < 4; i++) {
            const from = { x: KX - 56, y: KY - 36 + i * 24 };
            drawVine(g, vineTo(from, target(i), ext, t, i * 2.1, i % 2 ? 30 : -30), 9, 4.5, '#12300e', '#46982a', '#e4dcb2');
          }
          if (t > 4050) {                                    // binding rings coil on after the grab
            const wrap = smooth(seg(t, 4050, 4500)) * (1 - release);
            const squeeze = 1 - 0.22 * Math.max(0, Math.sin((t - 4500) * 0.0075)) * seg(t, 4500, 4800) - 0.12 * seg(t, 4900, 6200);
            const cx = o.x, cy = o.y - lift;
            g.globalAlpha = wrap;
            vineRing(g, cx - 3, cy, 17 * squeeze, 21 * squeeze, 0, 3.6, t, 1);
            vineRing(g, cx + 8, cy, 13 * squeeze, 13 * squeeze, 0.4, 3.8, t, 3);           // round the neck
            vineRing(g, cx - 12, cy, 14 * squeeze, 19 * squeeze, 0, 3.4, t, 5);
            g.globalAlpha = 1;
          }
        }
        // the torch he drops, rolling to a stop and dying
        if (t > 6300) {
          const p = outCubic(seg(t, 6300, 6800));
          droppedTorch(g, lerp(o.x + 12, o.x - 50, p), lerp(o.y + 18, o.y + 44, p), lerp(0, -0.6, p), t < 7400 && (t % 160) < 110);
        }
      },
      after(g, t) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const squeeze = 0.3 + 0.2 * Math.max(0, Math.sin((t - 4500) * 0.0075)) * seg(t, 4200, 6300);
        glow(g, KX, KY + 16, 150, '255,140,40', 0.2 + squeeze * 0.4 + 0.25 * seg(t, 3600, 4100) * (1 - seg(t, 6300, 8000)));
        g.restore();
      },
    };
  })();

  // ============ THE LAST KNIGHT: run through with its sword ============
  (function () {
    const DUR = 8500, U = 15;
    const GX = -118, GY = 8;
    const KS = 1.5, BLADE = 150 * KS;
    const K0 = 270, K1 = 108;                     // the knight's x at rest, and at the end of its lunge
    function knightX(t) {
      let x = K0;
      if (t > 3550) x = lerp(K0, K1, inQuad(seg(t, 3550, 3720)));
      if (t > 5500) x = lerp(K1, K0 - 30, outCubic(seg(t, 5500, 6100)));
      return x;
    }
    function knightRot(t) { return Math.PI * smooth(seg(t, 2300, 3200)) + 0.04 * Math.sin(t * 0.02) * seg(t, 3720, 5500); }
    function guy(t) {
      const w = walk(t, 400, 2100, -420, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 3750 };
      if (t > 2100) { o.speed = 0; o.ang = Math.sin((t - 2100) * 0.005) * 0.3 * (1 - seg(t, 2500, 3000)); }
      if (t > 3100) o.armsUp = smooth(seg(t, 3100, 3500)) * 0.7;
      if (t > 3720) {                                // run through: he doubles over the blade, hands on it
        o.armsUp = 0; o.reach = { x: 1.1, y: 0.5, k: smooth(seg(t, 3720, 3900)), sym: true };
        o.jitter = 0.32 * (1 - seg(t, 4900, 5500));
        o.flashlight = false;
      }
      if (t > 5500) { o.reach = null; o.jitter = 0; }
      return o;
    }
    SCENES.knight = {
      name: 'THE LAST KNIGHT', color: '#dc3c3c', dur: DUR, dark: 0.85, shade: '6,5,10',
      shakes: [[3720, 11, 190], [4400, 3, 100], [5500, 5, 150], [6300, 4, 140]],
      sfx: [[2300, 'creak'], [2700, 'thud'], [3550, 'whoosh'], [3730, 'stab'], [5500, 'whoosh'], [5650, 'squelch'], [5800, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 3600)), b = smooth(seg(t, 3600, 6500));
        return { x: lerp(-180, lerp(-10, 20, b), a), y: lerp(10, 2, a), z: lerp(1.1, 1.5, a) + 0.1 * smooth(seg(t, 3600, 3900)) - 0.08 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const torchOn = t < 3750 ? 1 : (t < 6200 ? 0.5 * (1 - seg(t, 5600, 6200)) + 0.0 : 0);
        if (t < 3750) torchLights(o.x, o.y, o.ang, t, U, 1).forEach((l) => L.push(l));
        else if (t < 6300) {                          // the dropped torch, lying on the floor, still shining
          const f = (t > 5800 && (t % 190) < 70) ? 0.3 : 0.9;
          L.push({ x: o.x - 40, y: o.y + 40, r: 200, a: 0.7 * f * (1 - seg(t, 6000, 6300)), cone: true, ang: -0.5, half: 0.4 });
        }
        L.push({ x: o.x, y: o.y, r: 80, a: 0.6 });
        [[-330, -125], [-110, -128], [110, -126], [330, -125]].forEach(([x, y], i) => L.push(sconceLight(x, y, t, i, 170)));
        L.push({ x: knightX(t), y: 0, r: 120, a: 0.12 + 0.5 * seg(t, 2300, 3300) });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('castle', (f) => {
          f.fillStyle = '#1a1a20'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -10; i < 11; i++) {
            const ox = (j % 2) * 40;
            f.fillStyle = lerpHex('#34343e', '#4a4a56', hash(i * 17 + j * 13));
            f.fillRect(i * 80 + ox, j * 56, 78, 54);
            f.fillStyle = 'rgba(255,255,255,0.05)'; f.fillRect(i * 80 + ox, j * 56, 78, 2);
          }
          f.fillStyle = '#5a0f16'; f.fillRect(-FW / 2, -48, FW, 96);
          f.fillStyle = '#b8902c'; f.fillRect(-FW / 2, -48, FW, 3); f.fillRect(-FW / 2, 45, FW, 3);
          f.fillStyle = '#7a1620'; for (let i = -22; i < 23; i++) f.fillRect(i * 32, -30, 16, 60);
          // the hall's north wall, with a giant statue carved into it between each pair of torches
          f.fillStyle = '#202026'; f.fillRect(-FW / 2, -FH / 2, FW, FH / 2 - 118);
          for (let j = 0; j < 6; j++) for (let i = -10; i < 11; i++) {
            f.fillStyle = lerpHex('#25252c', '#2f2f37', hash(i * 7 + j * 19));
            f.fillRect(i * 70 + (j % 2) * 35, -118 - (j + 1) * 46, 68, 44);
          }
          f.fillStyle = '#4a4a56'; f.fillRect(-FW / 2, -120, FW, 5);
          f.fillStyle = '#0d0d11'; f.fillRect(-FW / 2, -115, FW, 3);
          [-440, -220, 0, 220, 440].forEach((cx, k) => {
            const by = -124, h = 118, w = 54;
            f.beginPath(); f.moveTo(cx - w / 2, by); f.lineTo(cx - w / 2, by - h + w / 2); f.arc(cx, by - h + w / 2, w / 2, Math.PI, 0); f.lineTo(cx + w / 2, by); f.closePath();
            f.fillStyle = '#09090c'; f.fill();
            f.strokeStyle = '#4c4c58'; f.lineWidth = 3; f.stroke();
            const st = '#7d808b', sd = '#575a64';
            const blob = (fill, fn) => { f.beginPath(); fn(); f.fillStyle = fill; f.fill(); f.strokeStyle = 'rgba(0,0,0,0.5)'; f.lineWidth = 1; f.stroke(); };
            if (k % 2) [-1, 1].forEach((s) => blob(sd, () => { f.moveTo(cx + s * 9, by - 80); f.lineTo(cx + s * 26, by - 112); f.lineTo(cx + s * 24, by - 76); f.lineTo(cx + s * 12, by - 60); f.closePath(); }));
            blob(sd, () => f.rect(cx - 22, by - 8, 44, 8));
            blob(st, () => { f.rect(cx - 11, by - 42, 9, 34); f.rect(cx + 2, by - 42, 9, 34); });
            blob(st, () => { f.moveTo(cx - 13, by - 40); f.lineTo(cx + 13, by - 40); f.lineTo(cx + 15, by - 80); f.lineTo(cx - 15, by - 80); f.closePath(); });
            blob('#a2a5b0', () => { f.arc(cx - 18, by - 78, 8, 0, TAU); f.moveTo(cx + 26, by - 78); f.arc(cx + 18, by - 78, 8, 0, TAU); });
            blob('#b6b9c6', () => { f.rect(cx - 2.5, by - 66, 5, 54); });
            blob('#8e7a3a', () => f.rect(cx - 11, by - 68, 22, 4));
            blob(st, () => f.arc(cx, by - 92, 10, 0, TAU));
            f.fillStyle = '#05050a'; f.fillRect(cx - 7, by - 94, 14, 3);
            f.fillStyle = '#d83a2a'; f.fillRect(cx - 5, by - 93.5, 3, 2); f.fillRect(cx + 2, by - 93.5, 3, 2);
          });
        }));
        [[-330, -125], [-110, -128], [110, -126], [330, -125]].forEach(([x, y], i) => sconce(g, x, y, t, i * 3));
        const o = guy(t);
        const kx = knightX(t), rot = knightRot(t);
        const hit = t >= 3720;
        const gone = seg(t, 5500, 6000);
        // blood on the floor: sprayed out behind him, then a growing pool
        if (hit) {
          drawBloodPool(g, o.x - 14, o.y + 6, 4 + 34 * outQuad(seg(t, 3800, 7600)), 3, 0.95);
          spray(g, o.x - 20, o.y, t, 3730, { n: 26, r: 85, seed: 5, dir: Math.PI, spread: 1.4, size: 3.2, dur: 600, streak: true });
          spray(g, o.x + 14, o.y, t, 3730, { n: 12, r: 40, seed: 9, dir: 0, spread: 1.6, size: 2.4, dur: 400 });
        }
        // the dropped flashlight
        if (t > 3750) {
          const p = outCubic(seg(t, 3750, 4300));
          droppedTorch(g, lerp(o.x + 14, o.x - 36, p), lerp(o.y + 16, o.y + 38, p), lerp(0, -0.5, p), t < 6000 && !(t > 5800 && (t % 190) < 70));
        }
        // the man
        let lie = 0;
        if (t > 5500) lie = outQuad(seg(t, 5500, 6300));
        const slump = t > 3720 ? 0.45 * smooth(seg(t, 3720, 4400)) : 0;
        drawHazmat(g, Object.assign({}, o, { lie: Math.max(lie, slump * (t < 5500 ? 1 : 0)), lieSide: 1, sx: 1 - slump * 0.1, flashlight: false, visorCrack: 0 }));
        // the knight, over him: his sword is the thing through his chest
        model(g, 11, kx, 0, KS, rot, 5226 + Math.sin(t * 0.01) * 30);
        // blood running up the blade from the tip
        if (hit && rot > Math.PI - 0.1) {
          const tipX = kx - BLADE, entry = o.x + 15;
          const upto = lerp(entry, kx - 40, 0.6 * smooth(seg(t, 4200, 7000)) * (t < 5500 ? 1 : 0.6));
          if (upto > tipX) {
            const gr = g.createLinearGradient(tipX, 0, upto, 0);
            gr.addColorStop(0, 'rgba(120,6,14,0.95)'); gr.addColorStop(0.15, 'rgba(150,10,20,0.9)'); gr.addColorStop(1, 'rgba(110,6,12,0.85)');
            g.fillStyle = gr;
            g.beginPath(); g.moveTo(tipX, 0); g.lineTo(tipX + 12, -3.4 * 1.2); g.lineTo(upto, -9); g.lineTo(upto, 9); g.lineTo(tipX + 12, 3.4 * 1.2); g.closePath(); g.fill();
          }
          if (t > 5500) {                                  // drips falling off the lifted blade
            for (let i = 0; i < 4; i++) {
              const fx = lerp(kx - BLADE * 0.9, kx - 60, hash(i + 4)), ph = ((t * 0.0008 + hash(i)) % 1);
              g.fillStyle = '#8a0f1a'; g.beginPath(); g.ellipse(fx, 6 + ph * 20, 1.6, 2.4, 0, 0, TAU); g.fill();
            }
          }
        }
      },
      after(g, t) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const flash = Math.max(0, 1 - (t - 3730) / 160) * (t >= 3730 ? 1 : 0);
        if (flash > 0) glow(g, GX + 5, GY, 120, '255,255,255', 0.8 * flash);       // the spark where steel meets suit
        g.restore();
      },
    };
  })();

  // ============ THE ASHEN ONE: burned alive by a fireball ============
  (function () {
    const KX = 175, KY = 0, KS = 2.0, U = 15, DUR = 8000;
    const GX = -105, GY = 14;
    // the man walks in, stops and sweeps his torch; the eye wakes; a fireball
    // leaves it at 4300 and lands on him at 4800
    const MUZZLE = { x: KX - 120, y: 0 };
    function guy(t) {
      const w = walk(t, 400, 2600, -400, 16, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6500 };
      if (t > 2600) {
        o.speed = 0;
        o.ang = Math.sin((t - 2600) * 0.004) * 0.3 * (1 - seg(t, 3100, 3600));
      }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3800)) * 0.8;
      if (t > 4800) {                                   // on fire: staggers back, spinning and thrashing
        const p = seg(t, 4800, 6300);
        o.x = GX - 55 * outQuad(p) + Math.sin(t * 0.021) * 4 * (1 - p);
        o.y = GY + Math.sin(t * 0.013) * 9 * (1 - p);
        o.ang = Math.sin(t * 0.017) * 1.2 * (1 - p);
        o.armsUp = 0; o.flail = 1 - seg(t, 6000, 6500);
        o.burn = smooth(seg(t, 4850, 6300));
        o.jitter = 0.3 * (1 - seg(t, 6000, 6500));
        o.speed = 0.7 * (1 - p);
        o.time = t;
        if (t > 6100) o.lie = outQuad(seg(t, 6100, 6800));
      }
      return o;
    }
    function ball(t) {                                  // the fireball in flight
      if (t < 4300 || t > 4800) return null;
      const o0 = seg(t, 4300, 4800), p = o0 * o0 * (3 - 2 * o0 * 0.4);
      const tgt = guy(4800);
      return { x: lerp(MUZZLE.x, tgt.x + 14, p), y: lerp(MUZZLE.y, tgt.y, p) };
    }
    SCENES.ashen = {
      name: 'THE ASHEN ONE', color: '#ff6a2a', dur: DUR, dark: 0.86, shade: '8,4,3',
      shakes: [[3500, 4, 260], [4300, 7, 200], [4800, 7, 180], [5400, 3, 160]],
      sfx: [[2900, 'heart'], [3500, 'roar'], [4250, 'fire'], [4800, 'scream'], [5400, 'scream'], [6300, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4800, 7000));
        return { x: lerp(-140, lerp(20, -5, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.28, a) + 0.1 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const chg = seg(t, 3300, 4300);
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.7 * (o.burn || 0)).forEach((l) => L.push(l));
        L.push({ x: KX, y: KY, r: 190 + 40 * chg, a: 0.42 + 0.35 * chg + 0.08 * Math.sin(t * 0.02) });
        const b = ball(t);
        if (b) L.push({ x: b.x, y: b.y, r: 190, a: 0.95 });
        if (t > 4800) {
          const fl = smooth(seg(t, 4800, 5200)) * (1 - smooth(seg(t, 6800, 7700)));
          L.push({ x: o.x, y: o.y, r: 210, a: 0.9 * fl * (0.85 + 0.15 * Math.sin(t * 0.04)) });
        }
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('basalt', (f) => {
          f.fillStyle = '#17100f'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -8; j < 9; j++) for (let i = -12; i < 13; i++) {
            f.fillStyle = lerpHex('#2a1d1b', '#40302c', hash(i * 19 + j * 11));
            f.fillRect(i * 70 + (j % 2) * 35, j * 52, 68, 50);
          }
          for (let v = 0; v < 26; v++) {               // lava veins in the cracks
            let x = (hash(v * 2.9) - 0.5) * FW, y = (hash(v * 4.3) - 0.5) * FH, a = hash(v * 6.1) * TAU;
            f.lineCap = 'round'; f.lineJoin = 'round';
            const pts = [[x, y]];
            for (let s = 0; s < 9; s++) { a += (hash(v * 9 + s) - 0.5) * 1.5; x += Math.cos(a) * 30; y += Math.sin(a) * 30; pts.push([x, y]); }
            [['rgba(255,70,10,0.25)', 11], ['#c4300a', 4.5], ['#ff9a30', 2]].forEach(([c, w]) => {
              f.strokeStyle = c; f.lineWidth = w; f.beginPath(); pts.forEach(([px, py], i) => (i ? f.lineTo(px, py) : f.moveTo(px, py))); f.stroke();
            });
          }
        }));
        const o = guy(t);
        // heat shimmer on the floor round the boss
        g.save(); g.globalCompositeOperation = 'lighter';
        glow(g, KX, KY, 260, '255,90,20', 0.2 + 0.1 * Math.sin(t * 0.01));
        g.restore();
        model(g, 5, KX, KY, KS, 0, t);
        // the fireball charging at the eye, then flying
        const chg = seg(t, 3300, 4300);
        if (chg > 0 && t < 4300) {
          g.save(); g.globalCompositeOperation = 'lighter';
          glow(g, MUZZLE.x, MUZZLE.y, 20 + 46 * chg, '255,150,40', 0.9 * chg);
          glow(g, MUZZLE.x, MUZZLE.y, 8 + 18 * chg, '255,240,190', chg);
          g.restore();
        }
        const b = ball(t);
        if (b) {
          for (let i = 0; i < 16; i++) {               // a streaming trail of embers
            const back = i * 0.045, s2 = Math.max(0, seg(t, 4300, 4800) - back);
            const tx = lerp(MUZZLE.x, b.x, 1), px = lerp(MUZZLE.x, tx, s2 / Math.max(0.001, seg(t, 4300, 4800)));
            g.fillStyle = `rgba(255,${120 + i * 6},30,${0.7 - i * 0.04})`;
            g.beginPath(); g.arc(lerp(b.x, MUZZLE.x, i / 16) + (hash(i + t * 0.01) - 0.5) * 8, lerp(b.y, MUZZLE.y, i / 16) + (hash(i * 3 + t * 0.01) - 0.5) * 8, 9 - i * 0.45, 0, TAU); g.fill();
            void px;
          }
          g.save(); g.globalCompositeOperation = 'lighter';
          glow(g, b.x, b.y, 60, '255,140,30', 0.9); glow(g, b.x, b.y, 24, '255,250,210', 1);
          g.restore();
          flame(g, b.x, b.y + 14, 34, 52, t, 3, false);
        }
        // the man, and the fire eating him
        if (t > 4800) drawBloodPool(g, o.x, o.y, 0, 1, 0);
        drawHazmat(g, o);
        if (t > 4800) {
          const fl = smooth(seg(t, 4800, 5100)) * (1 - smooth(seg(t, 6800, 7700)));
          if (fl > 0.02) {
            for (let i = 0; i < 6; i++) {
              const ox = Math.cos(i * 1.7 + t * 0.003) * 9, oy = Math.sin(i * 2.3 + t * 0.004) * 11;
              flame(g, o.x + ox, o.y + oy + 6, 17 * fl, (38 + 14 * hash(i)) * fl, t, i * 1.3, false);
            }
            g.save(); g.globalCompositeOperation = 'lighter'; glow(g, o.x, o.y, 54, '255,130,30', 0.7 * fl); g.restore();
          }
          if (t > 5100) {                                // embers rising, then drifting ash and smoke
            const a = seg(t, 5100, 5600) * (1 - seg(t, 7500, 8000));
            g.save(); g.globalAlpha = a;
            drift(g, t, 34, { x: o.x - 50, y: o.y - 110, w: 100, h: 130 }, { color: '#ff9a3c', vy: -45, vx: -8, size: 2, alpha: 0.9, seed: 7, sway: 6 });
            g.restore();
            if (t > 6300) {
              const sm = seg(t, 6300, 7000);
              for (let i = 0; i < 7; i++) {
                const ph = ((t * 0.0004 + hash(i)) % 1);
                g.fillStyle = `rgba(30,26,26,${0.28 * sm * (1 - ph)})`;
                g.beginPath(); g.arc(o.x + (hash(i + 3) - 0.5) * 24 + Math.sin(ph * 6 + i) * 8, o.y - ph * 70, 6 + ph * 18, 0, TAU); g.fill();
              }
            }
          }
          if (t > 6100) {                                // the dropped torch, still on
            droppedTorch(g, o.x + 28, o.y + 26, 0.6, t < 7400);
          }
        }
        g.save(); g.globalAlpha = 0.9;
        drift(g, t, 40, { x: -400, y: -170, w: 800, h: 340 }, { color: '#ffb060', vy: -18, vx: 4, size: 1.6, alpha: 0.7, seed: 31, sway: 10 });
        g.restore();
      },
    };
  })();

  // ============ THE FROZEN MUTATION: frozen solid, then shattered ============
  (function () {
    const KX0 = 175, KS = 2.3, U = 15, DUR = 8500;
    const GX = -110, GY = 12;
    // it breathes frost from 3400; he turns to run and slows as the ice takes him;
    // fully frozen by 5600; it lunges at 6000 and he shatters at 6250
    function kx(t) {
      return KX0 - 150 * smooth(seg(t, 5850, 6200)) + 150 * smooth(seg(t, 6450, 7300)) * 0.98;
    }
    function guy(t) {
      const w = walk(t, 400, 2600, -400, 14, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6250, time: t };
      if (t > 2600) { o.speed = 0; o.ang = Math.sin((t - 2600) * 0.004) * 0.3 * (1 - seg(t, 3000, 3500)); }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3700)) * 0.8;
      if (t > 3900) {                                  // turns and tries to run
        const p = seg(t, 3900, 5600);
        o.ang = lerp(0, Math.PI, smooth(seg(t, 3900, 4250)));
        o.x = GX - 30 * outQuad(p);
        o.speed = (1 - p) * 0.9; o.walk = t * 0.011 * (1 - 0.7 * p);
        o.armsUp = 0;
        o.ice = smooth(seg(t, 4100, 5600));
        o.visorCrack = 0;
      }
      return o;
    }
    // crystals growing out of the man as the ice takes him
    function crystals(g, o, ice, t) {
      if (ice < 0.05) return;
      g.save(); g.translate(o.x, o.y);
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 3.1) * TAU, d = 8 + hash(i + 7) * 10;
        const len = (8 + hash(i + 2) * 14) * ice, w = 3 + hash(i + 5) * 3;
        const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
        g.fillStyle = `rgba(${200 + hash(i) * 40},${235},255,${0.55 * ice + 0.2})`;
        g.beginPath();
        g.moveTo(cx - Math.sin(a) * w, cy + Math.cos(a) * w);
        g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        g.lineTo(cx + Math.sin(a) * w, cy - Math.cos(a) * w);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.7; g.stroke();
      }
      g.restore();
    }
    SCENES.frozen = {
      name: 'THE FROZEN MUTATION', color: '#8fd8ff', dur: DUR, dark: 0.76, shade: '3,6,12',
      shakes: [[3500, 3, 260], [6000, 6, 150], [6250, 14, 260], [7000, 3, 150]],
      sfx: [[2900, 'heart'], [3400, 'roar'], [3900, 'ice'], [4800, 'ice'], [5600, 'creak'], [6000, 'whoosh'], [6250, 'shatter'], [6400, 'thud']],
      flash: (t) => (t >= 6250 ? 0.55 * Math.exp(-(t - 6250) / 90) : 0),
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 5600, 6600));
        return { x: lerp(-140, lerp(20, 0, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.3, a) + 0.14 * b * (t < 6900 ? 1 : 1 - seg(t, 6900, 8000)) };
      },
      lights(t) {
        const o = guy(t), L = [];
        if (t < 6250) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.8 * (o.ice || 0)).forEach((l) => L.push(l));
        L.push({ x: kx(t), y: 0, r: 260, a: 0.45 + 0.25 * seg(t, 3000, 3600) });
        for (let i = 0; i < 6; i++) L.push({ x: -330 + i * 140, y: i % 2 ? 105 : -105, r: 110, a: 0.35 });
        const br = seg(t, 3400, 4400) * (1 - seg(t, 5600, 6000));
        if (br > 0) L.push({ x: lerp(kx(t) - 110, o.x + 20, 0.5), y: 0, r: 230, a: 0.5 * br });
        if (t >= 6250) L.push({ x: o.x, y: o.y, r: 150, a: 0.7 * Math.exp(-(t - 6250) / 500) + 0.2 });
        if (o.ice > 0.2 && t < 6250) L.push({ x: o.x, y: o.y, r: 110, a: 0.45 * o.ice });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('ice', (f) => {
          f.fillStyle = '#16303c'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -11; i < 12; i++) {
            f.fillStyle = lerpHex('#27505f', '#4a8296', hash(i * 23 + j * 9));
            f.fillRect(i * 64, j * 64, 62, 62);
            f.fillStyle = 'rgba(255,255,255,0.07)'; f.fillRect(i * 64, j * 64, 62, 3);
          }
          f.lineCap = 'round';
          for (let v = 0; v < 30; v++) {                // frost cracks
            let x = (hash(v * 2.3) - 0.5) * FW, y = (hash(v * 3.7) - 0.5) * FH, a = hash(v * 5.9) * TAU;
            f.strokeStyle = 'rgba(220,245,255,0.55)'; f.lineWidth = 1.4; f.beginPath(); f.moveTo(x, y);
            for (let s = 0; s < 6; s++) { a += (hash(v * 7 + s) - 0.5) * 1.3; x += Math.cos(a) * 26; y += Math.sin(a) * 26; f.lineTo(x, y); }
            f.stroke();
          }
        }));
        const o = guy(t);
        const K = kx(t);
        // the breath of frost: a drift of snow and ice rolling from its maw across the floor
        const br = seg(t, 3400, 4300), fade = 1 - seg(t, 5600, 6000);
        if (br > 0 && fade > 0) {
          const sx = K - 100, sy = 0, ex = o.x + 10, ey = o.y;
          const reach = smooth(br);
          g.save();
          for (let i = 0; i < 120; i++) {
            const sd = i * 7.7;
            const ph = (t * 0.00055 * (0.6 + hash(sd)) + hash(sd + 1)) % 1;
            const f = ph * reach;
            const spread = 6 + f * 70 * hash(sd + 2);
            const px = lerp(sx, ex, f) + (hash(sd + 3) - 0.5) * spread, py = lerp(sy, ey, f) + (hash(sd + 4) - 0.5) * spread;
            g.globalAlpha = 0.65 * fade * Math.sin(Math.PI * ph);
            g.fillStyle = hash(sd + 5) > 0.5 ? '#eaf8ff' : '#9bd8f2';
            g.beginPath(); g.arc(px, py, 1.4 + hash(sd + 6) * 3, 0, TAU); g.fill();
          }
          g.restore();
        }
        // the floor frosts over round him as it spreads
        const frost = o.ice || 0;
        if (frost > 0) {
          g.save(); g.globalAlpha = 0.55 * frost;
          g.fillStyle = 'rgba(210,240,255,0.55)';
          g.beginPath(); g.ellipse(o.x, o.y, 22 + 70 * frost, 18 + 52 * frost, 0, 0, TAU); g.fill();
          g.restore();
        }
        model(g, 16, K, 0, KS, 0, t * 0.9);
        if (t < 6250) {
          drawHazmat(g, o);
          crystals(g, o, o.ice || 0, t);
        } else {
          // the shatter: chunks of ice and suit flying out, then lying scattered
          const p = (t - 6250);
          const shardSeed = (i) => ({ a: hash(i * 3.7) * TAU, v: 60 + hash(i + 1) * 170, s: 3 + hash(i + 2) * 7, r: hash(i + 3) * TAU, rs: (hash(i + 4) - 0.5) * 0.02 });
          for (let i = 0; i < 46; i++) {
            const s = shardSeed(i), e = outCubic(p / 900);
            const px = o.x + Math.cos(s.a) * s.v * e, py = o.y + Math.sin(s.a) * s.v * e * 0.8;
            g.save(); g.translate(px, py); g.rotate(s.r + s.rs * p);
            g.fillStyle = i % 9 === 0 ? '#e8d63a' : i % 7 === 0 ? '#8a0f1a' : `rgba(${150 + hash(i) * 60},${215 + hash(i + 9) * 25},255,0.82)`;
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(-s.s, -s.s * 0.4); g.lineTo(s.s * 0.8, -s.s * 0.7); g.lineTo(s.s, s.s * 0.5); g.lineTo(-s.s * 0.3, s.s * 0.8); g.closePath(); g.fill(); g.stroke();
            g.restore();
          }
          drawBloodPool(g, o.x, o.y, 3 + 14 * outQuad(seg(t, 6300, 7600)), 7, 0.85);
          droppedTorch(g, o.x - 34, o.y + 30, 2.6, t < 7200);
          // the visor, landing intact on the floor
          g.fillStyle = 'rgba(180,225,240,0.9)'; g.beginPath(); g.ellipse(o.x + 18, o.y + 24, 8, 11, 0.5, 0, TAU); g.fill();
        }
        g.save(); g.globalAlpha = 0.9;
        drift(g, t, 50, { x: -420, y: -190, w: 840, h: 380 }, { color: '#e8f6ff', vy: 14, vx: -10, size: 1.8, alpha: 0.8, seed: 51, sway: 12 });
        g.restore();
      },
    };
  })();

  // ============ THE CISTERN: dragged under the water ============
  (function () {
    const KS = 2.4, U = 15, DUR = 8500;
    const GX = -70, GY = 8;
    const HEAD = 55;                                  // the model's mouth, this far right of its centre
    // the worm comes in under the water (a wake), rises at 4100, grabs him at 4550,
    // and drags him under, backing away to the right until 6300
    function wormX(t) {
      const come = smooth(seg(t, 3900, 4450));
      const back = smooth(seg(t, 4700, 6300));
      return lerp(GX + 330, GX + 78 + HEAD * KS, come) + back * 320;   // the head's x is wormX - HEAD*KS (it faces left)
    }
    function wormVisible(t) { return smooth(seg(t, 3900, 4250)) * (1 - smooth(seg(t, 5600, 6300))); }
    function guy(t) {
      const w = walk(t, 400, 2500, -400, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk * 0.7, speed: w.speed * 0.8, flashlight: t < 5900, time: t };
      if (t > 2500) { o.speed = 0; o.ang = Math.sin((t - 2500) * 0.004) * 0.32 * (1 - seg(t, 3000, 3600)); }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3800)) * 0.8;
      if (t > 4300) {                                  // turns, too late
        o.ang = lerp(o.ang, 0.3, smooth(seg(t, 4300, 4550)));
        o.armsUp = 0; o.flail = smooth(seg(t, 4550, 4800));
      }
      if (t > 4600) {                                  // dragged by the worm, sinking
        const p = seg(t, 4700, 6300);
        o.x = GX + 20 + 320 * smooth(p) * 0.82;
        o.y = GY + Math.sin(t * 0.012) * 5 * (1 - p);
        o.flail = (1 - seg(t, 5600, 6200)) * 1.2;
      }
      return o;
    }
    function sink(t) { return smooth(seg(t, 5000, 6300)); }  // 0 = at the surface, 1 = gone
    // concentric rings spreading across the water from (x,y)
    function ripples(g, x, y, t, t0, dur, n, maxR, col) {
      for (let i = 0; i < n; i++) {
        const p = (t - t0 - i * dur * 0.16) / dur;
        if (p <= 0 || p >= 1) continue;
        g.strokeStyle = `rgba(${col},${0.55 * (1 - p)})`; g.lineWidth = 2.2 * (1 - p) + 0.4;
        g.beginPath(); g.ellipse(x, y, maxR * outCubic(p), maxR * outCubic(p) * 0.72, 0, 0, TAU); g.stroke();
      }
    }
    SCENES.cistern = {
      name: 'THE CISTERN', color: '#3ad6b0', dur: DUR, dark: 0.77, shade: '2,8,10',
      shakes: [[3900, 3, 220], [4550, 9, 200], [5000, 4, 160], [6300, 2, 140]],
      sfx: [[2900, 'heart'], [3500, 'creak'], [3900, 'splash'], [4550, 'roar'], [4560, 'splash'], [4900, 'scream'], [5700, 'splash'], [6200, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4500, 6600));
        return { x: lerp(-150, lerp(5, 70, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.32, a) + 0.08 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const dim = 1 - 0.85 * sink(t);
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, dim).forEach((l) => L.push(l));
        L.push({ x: o.x, y: o.y, r: 90, a: 0.5 * dim });
        for (let i = 0; i < 5; i++) L.push({ x: -300 + i * 150, y: i % 2 ? 110 : -110, r: 120, a: 0.3 });
        const wv = wormVisible(t);
        if (wv > 0) L.push({ x: wormX(t) - HEAD * KS - 60, y: 0, r: 200, a: 0.5 * wv });
        // the torch, bobbing on the surface after he's gone
        if (t > 5900) L.push({ x: o.x + 10, y: o.y + 4, r: 170, a: 0.65 * (1 - seg(t, 7000, 7900)) * (0.7 + 0.3 * Math.sin(t * 0.011)) });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('cistern', (f) => {
          f.fillStyle = '#0c2a2e'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -11; i < 12; i++) {   // the tiled bottom, seen through the water
            f.fillStyle = lerpHex('#123a40', '#1d5a60', hash(i * 13 + j * 29));
            f.fillRect(i * 64, j * 64, 62, 62);
          }
          f.strokeStyle = 'rgba(120,230,215,0.12)'; f.lineWidth = 2;   // caustics
          for (let c = 0; c < 70; c++) {
            const x = (hash(c * 1.3) - 0.5) * FW, y = (hash(c * 2.9) - 0.5) * FH;
            f.beginPath(); f.moveTo(x, y); f.bezierCurveTo(x + 20, y - 14, x + 40, y + 14, x + 60, y); f.stroke();
          }
          f.fillStyle = '#1b1e22';                          // walkway posts and the walls' edge
          for (let i = -10; i < 11; i++) { f.fillRect(i * 70, -FH / 2, 8, 22); f.fillRect(i * 70, FH / 2 - 22, 8, 22); }
        }));
        const o = guy(t), sk = sink(t);
        // slow ambient ripples on the water
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.0003 + hash(i)) % 1;
          g.strokeStyle = `rgba(140,235,225,${0.16 * (1 - ph)})`; g.lineWidth = 1.2;
          g.beginPath(); g.ellipse(-300 + hash(i + 2) * 600, -110 + hash(i + 3) * 220, 6 + ph * 40, (6 + ph * 40) * 0.7, 0, 0, TAU); g.stroke();
        }
        // wading ripples round his legs while he's on his feet
        if (t > 400 && t < 5800) {
          const moving = t < 2500 ? 1 : 0.3;
          ripples(g, o.x - 2, o.y, t, Math.floor(t / 420) * 420 - 0, 700, 2, 26 * moving + 12, '170,245,235');
        }
        // the wake of the worm coming under the surface, then the churn where it grabs
        if (t > 3000 && t < 4600) {
          const p = seg(t, 3000, 4450);
          const hx = lerp(GX + 420, GX + 90, smooth(p));
          for (let i = 0; i < 9; i++) {
            const ox = hx + i * 16;
            g.strokeStyle = `rgba(190,250,240,${0.4 * (1 - i / 9)})`; g.lineWidth = 2;
            g.beginPath(); g.moveTo(ox, -4 - i * 2.1); g.lineTo(ox - 14, 0); g.lineTo(ox, 4 + i * 2.1); g.stroke();
          }
        }
        if (t > 4450) ripples(g, GX + 80, 0, t, 4450, 1500, 4, 120, '200,255,245');
        // blood clouding the water where he went
        if (t > 4800) {
          const e = seg(t, 4800, 7600);
          const bx = lerp(o.x, GX + 240, 0.4);
          const gr = g.createRadialGradient(bx, 4, 0, bx, 4, 20 + 90 * e);
          gr.addColorStop(0, `rgba(120,10,16,${0.55 * (1 - 0.4 * e)})`); gr.addColorStop(1, 'rgba(120,10,16,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(bx, 4, 20 + 90 * e, (20 + 90 * e) * 0.7, 0, 0, TAU); g.fill();
        }
        // the man: shrinking and fading as the water closes over him
        g.save();
        g.globalAlpha = 1 - 0.95 * sk;
        drawHazmat(g, Object.assign({}, o, { sx: 1 - 0.35 * sk, sy: 1 - 0.35 * sk, shadow: 0 }));
        g.restore();
        if (sk > 0.05 && sk < 0.98) {                  // the water already lapping over him
          g.fillStyle = `rgba(14,70,78,${0.6 * sk})`;
          g.beginPath(); g.ellipse(o.x, o.y, 22, 20, 0, 0, TAU); g.fill();
          ripples(g, o.x, o.y, t, 5000, 1000, 3, 44, '190,250,240');
        }
        // bubbles rising from where he went down
        if (t > 5600) {
          for (let i = 0; i < 16; i++) {
            const ph = ((t - 5600) * 0.0007 + hash(i)) % 1, bx = o.x + (hash(i + 4) - 0.5) * 34, by = o.y - ph * 40 + 10;
            g.strokeStyle = `rgba(200,250,245,${0.7 * (1 - ph)})`; g.lineWidth = 1;
            g.beginPath(); g.arc(bx, by, 1.5 + hash(i + 8) * 3, 0, TAU); g.stroke();
          }
        }
        // the worm: rises head-first, grabs, and slides back under
        const wv = wormVisible(t);
        if (wv > 0.01) {
          const wx = wormX(t);
          g.save();
          g.globalAlpha = wv;
          const rise = 0.35 + 0.65 * smooth(seg(t, 3900, 4400));
          model(g, 21, wx, 0, KS * rise, Math.PI, t * 0.9);
          g.restore();
          if (t > 4550 && t < 5800) {                // spray off the strike
            spray(g, wx - HEAD * KS, 0, t, 4550, { n: 22, r: 80, seed: 3, dir: Math.PI, spread: 2.2, size: 2.6, dur: 700, color: 'rgba(200,250,245,0.85)' });
          }
        }
        // the dropped torch, floating on the surface where he sank
        if (t > 5900) {
          const bob = Math.sin(t * 0.004) * 2;
          droppedTorch(g, o.x + 10, o.y + 6 + bob, 0.3 + Math.sin(t * 0.0025) * 0.2, t < 7200);
          ripples(g, o.x + 10, o.y + 6, t, 5900, 2000, 3, 36, '180,245,235');
        }
      },
    };
  })();

  // ============ THE CULTIVATOR: overgrown, a garden grows from him ============
  (function () {
    const KX = 190, KS = 2.5, U = 15, DUR = 8500;
    const GX = -95, GY = 10;
    // the robot vents spores from 3300; they reach him at 3900; he coughs and
    // staggers, drops at 5200, and mushrooms sprout through the suit until 7200
    function guy(t) {
      const w = walk(t, 400, 2500, -400, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 5900, time: t };
      if (t > 2500) { o.speed = 0; o.ang = Math.sin((t - 2500) * 0.004) * 0.3 * (1 - seg(t, 3000, 3500)); }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3700)) * 0.75;
      if (t > 3900) {                                  // coughing, swaying, staggering
        const p = seg(t, 3900, 5200);
        o.armsUp = 0;
        o.x = GX - 12 * Math.sin(p * 3) * (1 - p) + 6 * p;
        o.ang = Math.sin(t * 0.009) * 0.5 * (1 - p * 0.6);
        o.jitter = 0.14 * (1 - p); o.flail = 0.35 * (1 - seg(t, 4800, 5300));
        o.fog = smooth(seg(t, 3900, 4800));
        o.moss = smooth(seg(t, 4100, 7000));
        o.speed = 0.2 * (1 - p);
      }
      if (t > 5100) o.lie = outQuad(seg(t, 5100, 5900));
      return o;
    }
    function mushroom(g, x, y, s, t, seed, hue) {
      if (s <= 0.02) return;
      const sway = Math.sin(t * 0.0021 + seed) * 1.2 * s;
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 3, 9, 4, 0, 0, TAU); g.fill();
      const stem = g.createLinearGradient(-3, 0, 3, 0); stem.addColorStop(0, '#cfc4a8'); stem.addColorStop(1, '#fff1d4');
      g.fillStyle = stem; rr(g, -2.6 + sway * 0.2, -13, 5.2, 14, 2); g.fill();
      const cap = g.createRadialGradient(sway - 3, -17, 1, sway, -13, 13);
      cap.addColorStop(0, hue === 0 ? '#f08aa6' : '#8ae6d2'); cap.addColorStop(1, hue === 0 ? '#9c2d52' : '#27806f');
      g.fillStyle = cap; g.beginPath(); g.ellipse(sway, -13, 12, 8, 0, Math.PI, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      [[-5, -16, 1.8], [2, -18, 2.2], [6, -14, 1.5]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(sway + dx, dy, r, 0, TAU); g.fill(); });
      g.restore();
    }
    // where the garden grows: spots over and around his body, in order of appearance
    const SPOTS = [[0, 0, 0], [-14, 8, 1], [12, -7, 0], [-7, -13, 1], [20, 9, 0], [-24, -2, 0], [6, 15, 1], [26, -12, 1], [-18, 15, 0], [14, 20, 0], [-30, 12, 1], [32, 2, 0]];
    SCENES.cultivator = {
      name: 'THE CULTIVATOR', color: '#9ae04a', dur: DUR, dark: 0.7, shade: '3,8,3',
      shakes: [[3300, 3, 240], [4100, 2, 160], [5100, 5, 160], [6900, 2, 200]],
      sfx: [[2900, 'heart'], [3300, 'creak'], [3500, 'whoosh'], [4300, 'scream'], [5100, 'thud'], [5900, 'squelch'], [6500, 'squelch'], [7000, 'squelch']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 5000, 7200));
        return { x: lerp(-140, lerp(30, -30, b), a), y: lerp(6, 0, a), z: lerp(1.1, 1.42, a) + 0.22 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.7 * seg(t, 5000, 5900)).forEach((l) => L.push(l));
        L.push({ x: o.x, y: o.y, r: 95, a: 0.5 });
        L.push({ x: KX, y: 0, r: 250, a: 0.42 + 0.2 * Math.sin(t * 0.006) });
        for (let i = 0; i < 6; i++) L.push({ x: -330 + i * 140, y: i % 2 ? 110 : -110, r: 120, a: 0.3 });
        const g2 = seg(t, 5300, 7000);
        if (g2 > 0) L.push({ x: o.x, y: o.y, r: 140, a: 0.45 * g2 });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('greenhouse', (f) => {
          f.fillStyle = '#1a2a17'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -11; i < 12; i++) {
            f.fillStyle = lerpHex('#2c4325', '#475f35', hash(i * 11 + j * 17));
            f.fillRect(i * 64, j * 64, 62, 62);
            f.fillStyle = 'rgba(20,35,15,0.35)'; f.fillRect(i * 64 + 8, j * 64 + 8, 3, 3);
          }
          f.fillStyle = '#4a3322';                       // raised planting beds along the walls
          f.fillRect(-FW / 2, -FH / 2, FW, 86); f.fillRect(-FW / 2, FH / 2 - 86, FW, 86);
          for (let i = -22; i < 23; i++) {
            f.fillStyle = hash(i * 3) > 0.5 ? '#3c8a2a' : '#2f6e22';
            f.beginPath(); f.arc(i * 32 + 8, -FH / 2 + 44, 12 + hash(i) * 10, 0, TAU); f.fill();
            f.beginPath(); f.arc(i * 32 + 18, FH / 2 - 44, 12 + hash(i + 5) * 10, 0, TAU); f.fill();
          }
        }));
        const o = guy(t);
        // spores: a cloud rolling from the robot across the floor to him
        const vent = seg(t, 3300, 4200);
        if (vent > 0) {
          g.save();
          const alive = 1 - 0.7 * seg(t, 6200, 8000);
          const n = 130;
          for (let i = 0; i < n; i++) {
            const sd = i * 9.3;
            const ph = (t * 0.0005 * (0.5 + hash(sd)) + hash(sd + 1)) % 1;
            const toward = Math.min(1, smooth(vent) * 1.1);
            const sx = KX - 60, ex = o.x + 20;
            const f = ph * toward;
            const px = lerp(sx, ex, f) + (hash(sd + 2) - 0.5) * (30 + 90 * f), py = lerp(0, o.y, f) + (hash(sd + 3) - 0.5) * (30 + 70 * f);
            g.globalAlpha = 0.7 * alive * Math.sin(Math.PI * ph);
            g.fillStyle = hash(sd + 4) > 0.5 ? '#c8f06a' : '#8ae84a';
            g.beginPath(); g.arc(px, py, 1.2 + hash(sd + 5) * 2.6, 0, TAU); g.fill();
          }
          g.restore();
        }
        model(g, 26, KX, 0, KS, 0, t);
        // mushroom caps bursting up from the robot's hull with each puff
        // his body is overgrown: moss tint comes from drawHazmat; vines and the garden are drawn here
        const grow = seg(t, 5300, 7300);
        if (grow > 0) {
          g.save(); g.translate(o.x, o.y);
          for (let i = 0; i < 7; i++) {                  // vines creeping out over the floor
            const a = i * 0.9 + 0.3, len = (30 + hash(i) * 40) * smooth(grow);
            const pts = [];
            for (let s = 0; s <= 8; s++) { const f = s / 8 * len; pts.push([Math.cos(a + Math.sin(s * 0.9 + i) * 0.3) * f, Math.sin(a + Math.sin(s * 0.9 + i) * 0.3) * f * 0.8]); }
            drawVine(g, pts, 3.6, 1.2, '#173a12', '#4a9a2c', null);
          }
          g.restore();
        }
        drawHazmat(g, o);
        if (grow > 0) {
          SPOTS.forEach(([dx, dy, hue], i) => {
            const st = 0.08 * i + 0.0, s = smooth(seg(grow, st, st + 0.35)) * (0.7 + 0.5 * hash(i + 3));
            mushroom(g, o.x + dx, o.y + dy, s, t, i, hue);
          });
          // the glow of the spore garden
          g.save(); g.globalCompositeOperation = 'lighter';
          glow(g, o.x, o.y, 70, '140,255,200', 0.22 * grow * (0.8 + 0.2 * Math.sin(t * 0.004)));
          g.restore();
          if (t > 7000) {                                // a last twitch of the hand
            const tw = Math.max(0, Math.sin((t - 7000) * 0.02)) * (1 - seg(t, 7000, 7600));
            g.strokeStyle = '#2a2d31'; g.lineWidth = 3; g.lineCap = 'round';
            g.beginPath(); g.moveTo(o.x + 20, o.y + 24); g.lineTo(o.x + 28 + tw * 5, o.y + 30 - tw * 4); g.stroke();
          }
        }
        if (t > 5900) droppedTorch(g, o.x + 40, o.y + 40, 0.5, t < 6500 && (t % 230) > 60);
        g.save();
        drift(g, t, 60, { x: -420, y: -190, w: 840, h: 380 }, { colors: ['#c8f06a', '#8ae84a', '#eaff9a'], vy: -8, vx: -6, size: 1.7, alpha: 0.75, seed: 71, sway: 14 });
        g.restore();
      },
    };
  })();

  // ============ THE GARGUANTUAGOYLE: dropped on from above ============
  (function () {
    const U = 15, DUR = 8500;
    const GX = -60, GY = 10;
    // it circles in from the right, hovers over him (its shadow creeping across
    // the floor), climbs, and slams down at 5300
    function bossPos(t) {
      const come = smooth(seg(t, 2400, 4300)), o = guy(t);
      const dive = smooth(seg(t, 4700, 5300));                 // it settles right over him for the slam
      const x = lerp(260, o.x + 95 * (1 - dive), come) + 10 * Math.sin(t * 0.004) * (1 - seg(t, 4300, 4800));
      return { x, y: lerp(-70, lerp(GY - 30, o.y - 4, dive), come) + 6 * Math.sin(t * 0.003) * (1 - dive) };
    }
    // scale is height: big = high above the floor, small = down on the ground
    function bossScale(t) {
      if (t < 2400) return 2.0 + 0.05 * Math.sin(t * 0.004);
      const hover = lerp(2.0, 2.15, smooth(seg(t, 2400, 4300)));
      const climb = 0.35 * smooth(seg(t, 4300, 5000));
      const slam = (hover + climb - 1.45) * (1 - Math.pow(1 - seg(t, 5000, 5300), 3) * 0) ;
      let s = hover + climb;
      if (t > 5000) s = lerp(s, 1.45, Math.pow(seg(t, 5000, 5300), 2.2));
      if (t > 5900) s = lerp(1.45, 2.3, smooth(seg(t, 5900, 6900)));
      void slam;
      return s;
    }
    function guy(t) {
      const w = walk(t, 400, 2300, -400, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 5300, time: t };
      if (t > 2300) { o.speed = 0; o.ang = Math.sin((t - 2300) * 0.004) * 0.3 * (1 - seg(t, 2800, 3300)); }
      if (t > 3200) { o.armsUp = smooth(seg(t, 3200, 3600)) * 0.8; }
      if (t > 4100) {                                    // looks up, freezes, then tries to run
        const p = seg(t, 4100, 5300);
        o.ang = lerp(o.ang, Math.PI, smooth(seg(t, 4100, 4500)));
        o.x = GX - 40 * outQuad(p); o.speed = p < 1 ? 0.9 : 0; o.walk = t * 0.013; o.armsUp = 0;
      }
      return o;
    }
    SCENES.gargoyle = {
      name: 'THE GARGUANTUAGOYLE', color: '#d0d4dc', dur: DUR, dark: 0.74, shade: '5,5,10',
      shakes: [[2400, 2, 300], [4300, 3, 300], [5300, 17, 330], [5350, 8, 600], [6100, 3, 200]],
      sfx: [[2300, 'heart'], [2500, 'whoosh'], [3400, 'roar'], [4400, 'whoosh'], [5000, 'whoosh'], [5300, 'slam'], [5310, 'scream'], [5900, 'thud']],
      flash: (t) => (t >= 5300 ? 0.4 * Math.exp(-(t - 5300) / 70) : 0),
      camera(t) {
        const a = smooth(seg(t, 0, 4400)), b = smooth(seg(t, 5200, 6500));
        return { x: lerp(-150, lerp(0, -20, b), a), y: lerp(6, 0, a), z: lerp(1.05, 1.22, a) + 0.14 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1).forEach((l) => L.push(l));
        L.push({ x: o.x, y: o.y, r: 90, a: 0.5 });
        for (let i = 0; i < 7; i++) L.push({ x: -340 + i * 125, y: i % 2 ? 112 : -112, r: 120, a: 0.3 });
        const b = bossPos(t);
        L.push({ x: b.x, y: b.y, r: 190, a: 0.4 + 0.2 * Math.sin(t * 0.005) + 0.5 * seg(t, 3000, 3600) * (1 - seg(t, 5300, 5700)) });
        if (t >= 5300) L.push({ x: guy(5300).x, y: GY, r: 260, a: 0.8 * Math.exp(-(t - 5300) / 350) + 0.18 });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('landing', (f) => {
          f.fillStyle = '#26262d'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -8; j < 9; j++) for (let i = -12; i < 13; i++) {
            f.fillStyle = lerpHex('#35353f', '#4a4a56', hash(i * 31 + j * 5));
            f.fillRect(i * 66, j * 56, 64, 54);
          }
          f.strokeStyle = '#c8b020'; f.lineWidth = 4; f.setLineDash([22, 16]);      // the landing zone marking
          f.strokeRect(-210, -120, 420, 240); f.setLineDash([]);
          f.fillStyle = 'rgba(200,176,32,0.8)'; f.font = 'bold 56px monospace'; f.textAlign = 'center';
          f.fillText('H', -150, -60);
          f.fillStyle = 'rgba(0,0,0,0.25)';
          for (let c = 0; c < 22; c++) { f.fillRect((hash(c * 2) - 0.5) * FW, (hash(c * 3) - 0.5) * FH, 30 + hash(c) * 50, 2); }
        }));
        const o = guy(t), b = bossPos(t), bs = bossScale(t);
        const high = Math.max(0, (bs - 1.45) / 0.85);          // 0 = on the ground, 1 = high
        // its shadow on the floor: big and faint when it's high, tight and black when it's low
        g.save();
        const sh = 0.5 + 0.7 * (1 - high * 0.55);
        g.fillStyle = `rgba(0,0,0,${0.18 + 0.3 * (1 - high)})`;
        g.beginPath(); g.ellipse(b.x + 18 * high, b.y + 50 + 40 * high, 110 * bs * 0.8 * sh, 38 * bs * 0.8 * sh, 0, 0, TAU); g.fill();
        g.restore();
        // the man, until he's flattened
        const hit = t >= 5300;
        if (!hit) drawHazmat(g, o);
        else {
          // under it: a flat smear and the crushed torch
          const sp = seg(t, 5300, 6300);
          drawBloodPool(g, o.x, o.y + 2, 6 + 52 * outCubic(sp), 5, 0.95);
          spray(g, o.x, o.y, t, 5300, { n: 40, r: 140, seed: 2, size: 3.4, dur: 800, streak: true });
          g.save(); g.translate(o.x, o.y);
          g.fillStyle = '#d6bd2c'; g.beginPath(); g.ellipse(0, 0, 24, 8, 0.1, 0, TAU); g.fill();       // the flattened suit
          g.fillStyle = '#9a8412'; g.beginPath(); g.ellipse(2, 1, 17, 4, 0.1, 0, TAU); g.fill();
          g.fillStyle = 'rgba(110,8,16,0.8)'; g.beginPath(); g.ellipse(-3, 0, 14, 5, 0, 0, TAU); g.fill();
          g.restore();
          droppedTorch(g, o.x + 34 * Math.min(1, sp * 3), o.y + 16 * Math.min(1, sp * 3), 0.7, false);
        }
        // the beast, on top
        g.save();
        const lift = Math.max(0, bs - 1.45);
        g.translate(b.x, b.y - 6 * lift * 10 * 0.4);
        g.scale(bs / 2.0, bs / 2.0);
        model(g, 31, 0, 0, 2.0, 0, t);
        g.restore();
        // dust blown out by the impact, and cracks running across the floor
        if (hit) {
          const p = (t - 5300) / 1400;
          const cx = guy(5300).x, cy = GY;
          for (let i = 0; i < 9; i++) {
            const a = hash(i * 4.3) * TAU, len = (70 + hash(i + 1) * 120) * outCubic(Math.min(1, p * 1.6));
            g.strokeStyle = 'rgba(8,8,10,0.85)'; g.lineWidth = 2.2 - i * 0.12;
            g.beginPath(); g.moveTo(cx, cy);
            for (let s = 1; s <= 6; s++) { const f = (s / 6) * len, wob = (hash(i * 9 + s) - 0.5) * 14; g.lineTo(cx + Math.cos(a) * f - Math.sin(a) * wob, cy + Math.sin(a) * f * 0.8 + Math.cos(a) * wob); }
            g.stroke();
          }
          if (p < 1) {
            g.strokeStyle = `rgba(230,225,215,${0.6 * (1 - p)})`; g.lineWidth = 3 * (1 - p) + 1;
            const R = 20 + 360 * outCubic(p);
            g.beginPath(); g.ellipse(cx, cy, R, R * 0.8, 0, 0, TAU); g.stroke();
            for (let i = 0; i < 46; i++) {
              const a = hash(i * 2.3) * TAU, d = (30 + hash(i + 3) * 200) * outCubic(p), r = (3 + hash(i + 5) * 9) * (1 + p);
              g.fillStyle = `rgba(190,185,175,${0.5 * (1 - p)})`;
              g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r, 0, TAU); g.fill();
            }
          }
        }
        // wind off the wings: grit streaming across the floor while it hovers
        if (t > 2400 && t < 5300) {
          const f = seg(t, 2400, 3400);
          g.save(); g.globalAlpha = 0.5 * f;
          drift(g, t, 40, { x: -420, y: -190, w: 840, h: 380 }, { color: '#cfcab8', vy: 20, vx: -150, size: 1.5, alpha: 0.7, seed: 99, twinkle: false });
          g.restore();
        }
      },
    };
  })();

  // ============ THE MULTIPOD: bursts out of the facility doors, over the man holding them shut ============
  (function () {
    const U = 15, DUR = 8600;
    // the facade seen from above-and-in-front, like the level itself: the doors are
    // 2*DW wide and DH tall, their sill on y = 0, the lot spreading out south of it
    const DW = 70, DH = 66;
    const HITS = [[1500, 7, 10], [3200, 12, 22], [4800, 17, 34]];   // [when, how far the doors bow, how far it shoves him back]
    const BURST = 6000;
    const SWARM = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
    const M_N = 64;
    const MEMBERS = [];
    for (let i = 0; i < M_N; i++) {
      MEMBERS.push({
        id: SWARM[i % SWARM.length],
        lane: (hash(i * 3.3) - 0.5) * 140, s: 0.2 + hash(i * 5.7) * 0.2,
        ts: BURST + 40 + hash(i * 4.1) * 1250, v: 0.24 + hash(i * 9.3) * 0.18, ph: hash(i * 1.9) * 6,
      });
    }
    MEMBERS.sort((a, b) => a.s - b.s);                          // small ones first, so the big ones cover them
    const hitsSoFar = (t) => HITS.filter((h) => t >= h[0]).length;
    // the doors' permanent damage, plus the extra bow right after each hit
    function gapAt(t) {
      const perm = [0, 2.5, 7, 13][hitsSoFar(t)];
      let tr = 0;
      HITS.forEach(([t0, b]) => { if (t >= t0) tr += b * Math.exp(-(t - t0) / 170); });
      const tremble = t > 5000 && t < BURST ? Math.sin(t * 0.11) * 1.4 : 0;
      return perm + tr * 0.6 + tremble;
    }
    function glowAt(t) { return Math.min(1, 0.12 + 0.2 * hitsSoFar(t) + 0.08 * Math.sin(t * 0.008) + (t >= BURST ? 0.5 : 0)); }
    function guy(t) {
      let push = 0, jit = 0;
      const n = hitsSoFar(t);
      HITS.forEach(([t0, , s]) => { if (t >= t0) { push += s * Math.exp(-(t - t0) / 330); jit += 0.3 * Math.exp(-(t - t0) / 220); } });
      const o = { x: Math.sin(t * 0.012) * 1.2 * n, y: 17 + push, ang: -Math.PI / 2, u: U, walk: 0, speed: 0, armsUp: 1, time: t };
      o.jitter = 0.04 + n * 0.06 + jit;
      o.flail = n ? 0.45 * Math.exp(-(t - HITS[n - 1][0]) / 260) : 0;
      if (t >= BURST) {                                       // the doors go and he goes with them
        const p = seg(t, BURST + 40, BURST + 700);
        o.y = 17 + push + 125 * outQuad(p);
        o.x += 20 * outQuad(p);
        o.ang = -Math.PI / 2 + 2.4 * outQuad(p);
        o.lie = outQuad(seg(t, BURST + 80, BURST + 520));
        o.armsUp = 1 - outQuad(seg(t, BURST + 20, BURST + 300));
        o.flail = 1 - p; o.jitter = 0;
      }
      return o;
    }
    // one door leaf. side -1 = left, 1 = right; its seam edge bows in by `bulge`
    function leaf(g, side, gap, bulge, cracks, t) {
      const outer = side * DW, inner = side * (gap / 2 + 1), top = -DH, bot = -2;
      const edge = [[outer, top], [inner, top + bulge], [inner, bot - bulge], [outer, bot]];
      g.beginPath(); edge.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      g.fillStyle = '#3d424b'; g.fill(); g.strokeStyle = '#1b1e23'; g.lineWidth = 3; g.stroke();
      const ins = 9;                                           // the glass, a little inside the frame
      const gl = [[outer - side * ins, top + ins], [inner + side * ins * 0.4, top + bulge + ins], [inner + side * ins * 0.4, bot - bulge - ins], [outer - side * ins, bot - ins]];
      g.beginPath(); gl.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      g.fillStyle = 'rgba(127,180,216,0.5)'; g.fill();
      g.strokeStyle = 'rgba(20,30,40,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.moveTo(gl[0][0], gl[0][1] + 6); g.lineTo(gl[0][0] - side * 22, gl[0][1] + 6); g.lineTo(gl[0][0] - side * 44, gl[3][1] - 6); g.lineTo(gl[0][0] - side * 22, gl[3][1] - 6); g.closePath(); g.fill();
      if (cracks > 0) {                                        // the glass crazes out from where it's been hit
        const cx = side * (gap / 2 + DW * 0.2), cy = -DH * 0.5;
        g.strokeStyle = 'rgba(235,245,255,0.85)'; g.lineWidth = 1.2;
        for (let i = 0; i < cracks * 4; i++) {
          const a = hash(i * 2.7 + side) * TAU, len = 22 + hash(i + 4) * 40 * (0.5 + cracks * 0.3);
          g.beginPath(); g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * len * 0.5 + (hash(i + 9) - 0.5) * 6, cy + Math.sin(a) * len * 0.5 + (hash(i + 7) - 0.5) * 6);
          g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
        }
        g.strokeStyle = `rgba(10,12,16,${0.16 + 0.08 * cracks})`; g.lineWidth = 3 + cracks * 1.6;      // the dent itself
        g.beginPath(); g.ellipse(cx, cy, 14 + cracks * 7, 20 + cracks * 8, 0, 0, TAU); g.stroke();
      }
      g.fillStyle = '#c4c9d1';                                 // the push bar
      rr(g, inner - side * 6 - 4, -DH * 0.48, 8, 26, 3); g.fill();
      g.strokeStyle = '#1b1e23'; g.lineWidth = 1; g.stroke();
      void t;
    }
    SCENES.multipod = {
      name: 'THE MULTIPOD', color: '#ff4a4a', dur: DUR, dark: 0.4, shade: '12,6,22',
      shakes: [[1500, 7, 260], [3200, 11, 300], [4800, 15, 340], [BURST, 20, 420]],
      sfx: [[900, 'heart'], [1500, 'slam'], [1580, 'creak'], [2500, 'creak'], [3200, 'slam'], [3260, 'roar'], [4800, 'slam'], [4860, 'roar'],
        [BURST, 'shatter'], [BURST + 40, 'roar'], [BURST + 150, 'scream'], [BURST + 330, 'thud'], [BURST + 800, 'roar']],
      flash: (t) => (t >= BURST ? 0.55 * Math.exp(-(t - BURST) / 110) : 0),
      camera(t) {
        const push = smooth(seg(t, 0, 4800)), fol = smooth(seg(t, BURST, BURST + 1800));
        return { x: 0, y: lerp(-40, -34, push) + 40 * fol, z: lerp(1.5, 2.1, push) - 0.5 * fol };
      },
      lights(t) {
        const L = [{ x: 0, y: -20, r: 540, a: 0.92 }];
        L.push({ x: 0, y: -34, r: 110 + 90 * glowAt(t), a: 0.35 + 0.5 * glowAt(t) });
        if (t >= BURST) L.push({ x: 0, y: 60, r: 260, a: 0.5 * Math.exp(-(t - BURST) / 900) + 0.2 });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('facility-front', (f) => {
          // the lot
          f.fillStyle = '#7d828b'; f.fillRect(-FW / 2, 0, FW, FH / 2);
          for (let j = 0; j < 7; j++) for (let i = -11; i < 12; i++) {
            f.fillStyle = lerpHex('#777c85', '#8d929b', hash(i * 17 + j * 3));
            f.fillRect(i * 64, j * 56 + 8, 62, 54);
          }
          for (let k = 0; k < 160; k++) {                      // stains, grit, hairline cracks
            f.fillStyle = `rgba(0,0,0,${0.04 + hash(k) * 0.1})`;
            f.beginPath(); f.ellipse((hash(k * 2.3) - 0.5) * FW, 14 + hash(k * 3.1) * 340, 3 + hash(k + 2) * 12, 2 + hash(k + 5) * 6, 0, 0, TAU); f.fill();
          }
          f.strokeStyle = 'rgba(30,30,34,0.5)'; f.lineWidth = 1.2;
          for (let k = 0; k < 26; k++) {
            let x = (hash(k * 5.1) - 0.5) * FW, y = 20 + hash(k * 7.3) * 330;
            f.beginPath(); f.moveTo(x, y);
            for (let s = 0; s < 5; s++) { x += (hash(k * 9 + s) - 0.3) * 22; y += (hash(k * 11 + s) - 0.4) * 14; f.lineTo(x, y); }
            f.stroke();
          }
          f.strokeStyle = 'rgba(255,255,255,0.5)'; f.lineWidth = 3;      // parking lines
          for (let x = -420; x <= 420; x += 84) { f.beginPath(); f.moveTo(x, 170); f.lineTo(x, 280); f.stroke(); }
          // the facade
          f.fillStyle = '#8d939c'; f.fillRect(-FW / 2, -FH / 2, FW, FH / 2);
          f.fillStyle = '#6f757e'; f.fillRect(-FW / 2, -FH / 2, FW, 120);
          f.fillStyle = '#b6bcc4'; f.fillRect(-FW / 2, -14, FW, 14);
          f.strokeStyle = 'rgba(0,0,0,0.12)'; f.lineWidth = 1;
          for (let y = -300; y < 0; y += 34) { f.beginPath(); f.moveTo(-FW / 2, y); f.lineTo(FW / 2, y); f.stroke(); }
          for (let wy = -226; wy < -80; wy += 52) for (let wx = -600; wx < 600; wx += 64) {
            if (Math.abs(wx + 20) < 190 && wy > -190) continue;
            f.fillStyle = '#a8d4f0'; f.fillRect(wx, wy, 40, 30);
            f.fillStyle = 'rgba(255,255,255,0.45)'; f.fillRect(wx + 3, wy + 3, 14, 10);
            f.strokeStyle = '#4a4f57'; f.lineWidth = 2; f.strokeRect(wx, wy, 40, 30);
          }
          f.fillStyle = '#2a2d33'; f.fillRect(-DW - 10, -DH - 10, DW * 2 + 20, DH + 10);     // the door frame
          f.fillStyle = '#3a3d44'; f.fillRect(-DW - 22, -DH - 44, DW * 2 + 44, 26);          // the sign
          f.fillStyle = '#fff'; f.font = 'bold 17px monospace'; f.textAlign = 'center';
          f.fillText('THE FACILITY', 0, -DH - 25);
          for (let i = -DW - 10; i < DW + 10; i += 16) {                                      // hazard stripes on the sill
            f.fillStyle = (Math.floor(i / 16) % 2) ? '#d8c020' : '#222';
            f.fillRect(i, 0, 16, 7);
          }
        }));
        const gap = gapAt(t), gl = glowAt(t), n = hitsSoFar(t), o = guy(t);
        // behind the doors: the dark inside, lit purple by what's pressing on them
        g.fillStyle = '#10061a'; g.fillRect(-DW, -DH, DW * 2, DH - 2);
        g.save(); g.beginPath(); g.rect(-DW, -DH, DW * 2, DH - 2); g.clip();
        g.globalCompositeOperation = 'lighter';
        glow(g, 0, -DH * 0.45, 95, '190,60,230', 0.55 * gl);
        g.globalCompositeOperation = 'source-over';
        if (t < BURST + 200) {                                 // shapes shoving against the glass
          for (let k = 0; k < 7; k++) {
            const sx = -DW * 0.8 + k * DW * 0.27 + Math.sin(t * 0.004 + k * 1.7) * 6, sy = -DH * 0.5 + Math.cos(t * 0.005 + k) * 8;
            g.fillStyle = `rgba(14,0,22,${0.25 + 0.15 * n})`;
            g.beginPath(); g.ellipse(sx, sy, 10 + (k % 3) * 3, 17 + (k % 2) * 6, 0, 0, TAU); g.fill();
          }
        } else {
          g.globalCompositeOperation = 'lighter'; glow(g, 0, -DH * 0.5, 110, '210,90,250', 0.7); g.globalCompositeOperation = 'source-over';
        }
        g.restore();
        // light spilling through the gap onto the lot
        if (t < BURST && gap > 1) {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(0.5, gap * 0.04) * gl;
          g.fillStyle = 'rgb(190,60,230)'; g.fillRect(-gap / 2 - 1, -DH, gap + 2, DH - 2);
          glow(g, 0, 6, 55, '190,60,230', 0.35 * gl);
          g.restore();
        }
        if (t < BURST) {
          const bulge = gap * 0.55;
          leaf(g, -1, gap, bulge, n, t); leaf(g, 1, gap, bulge, n, t);
          HITS.forEach(([t0], i) => {                          // dust and sparks shaken off the frame at each hit
            spray(g, -DW * 0.7, -DH, t, t0, { n: 12, r: 46, seed: 30 + i, size: 2.6, dur: 800, color: 'rgba(190,190,195,0.75)', dir: Math.PI / 2, spread: 1.6, grav: 1.2 });
            spray(g, DW * 0.7, -DH, t, t0, { n: 12, r: 46, seed: 40 + i, size: 2.6, dur: 800, color: 'rgba(190,190,195,0.75)', dir: Math.PI / 2, spread: 1.6, grav: 1.2 });
            spray(g, 0, -DH * 0.5, t, t0, { n: 10, r: 38, seed: 50 + i, size: 1.8, dur: 380, color: '#ffd27a', streak: true });
          });
        }
        // after the burst: what's left of him
        if (t >= BURST + 150) {
          drawBloodPool(g, o.x + 4, o.y + 4, 4 + 40 * outQuad(seg(t, BURST + 200, BURST + 2400)), 5, 0.95);
          spray(g, o.x, o.y - 10, t, BURST + 150, { n: 36, r: 120, seed: 8, size: 3.2, dur: 800, streak: true });
        }
        g.save();
        g.globalAlpha = t >= BURST + 700 ? 1 - 0.55 * smooth(seg(t, BURST + 700, BURST + 1500)) : 1;
        drawHazmat(g, o);
        g.restore();
        // the swarm, out through the doorway and over him
        if (t >= BURST) {
          const M = window.MonsterModels;
          MEMBERS.forEach((m, i) => {
            const tau = t - m.ts;
            if (tau < 0) return;
            const y = -62 + tau * m.v, x = m.lane * 0.55 * (0.3 + Math.min(1, tau / 700)) + Math.sin(t * 0.009 * (0.6 + m.v) + m.ph) * 6;
            if (y > 230) return;
            const sz = 160 * m.s;
            g.save();
            g.globalAlpha = Math.min(1, tau / 120);
            g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x + 4, y + 6, sz * 0.3, sz * 0.14, 0, 0, TAU); g.fill();
            g.translate(x, y); g.rotate(Math.PI / 2 + Math.sin(t * 0.012 + m.ph) * 0.12);
            g.drawImage(M.sprite(m.id, t), -sz / 2, -sz / 2, sz, sz);
            g.restore();
          });
          // the doors, thrown out ahead of it
          const tt = t - BURST;
          [-1, 1].forEach((side) => {
            const a = 1 - seg(tt, 500, 1400);
            if (a <= 0) return;
            g.save(); g.globalAlpha = a;
            g.translate(side * DW * 0.5 + side * tt * 0.5, -DH * 0.5 + tt * 0.2);
            g.rotate(side * tt * 0.0017); g.scale(1 + tt * 0.0008, 1 + tt * 0.0008);
            g.translate(-side * DW * 0.5, DH * 0.5);
            leaf(g, side, 14, 8, 3, t);
            g.restore();
          });
          spray(g, 0, -DH * 0.5, t, BURST, { n: 48, r: 130, seed: 12, size: 3, dur: 800, color: 'rgba(200,225,240,0.85)', streak: true, dir: Math.PI / 2, spread: 2.8 });
          // a shock ring and a rolling cloud of dust
          const p = tt / 1100;
          if (p < 1) {
            g.strokeStyle = `rgba(230,200,255,${0.7 * (1 - p)})`; g.lineWidth = 5 * (1 - p) + 1;
            g.beginPath(); g.ellipse(0, -DH * 0.4, 30 + 330 * outCubic(p), 18 + 150 * outCubic(p), 0, 0, TAU); g.stroke();
          }
          for (let i = 0; i < 34; i++) {
            const ph = Math.min(1, tt / 2400), a = hash(i * 3.1) * TAU, d = (30 + hash(i + 2) * 170) * outCubic(ph);
            g.fillStyle = `rgba(150,146,152,${0.34 * (1 - ph)})`;
            g.beginPath(); g.arc(Math.cos(a) * d, -DH * 0.4 + Math.sin(a) * d * 0.7, 10 + 26 * ph + hash(i) * 14, 0, TAU); g.fill();
          }
        } else {
          g.save();
          drift(g, t, 40, { x: -330, y: -150, w: 660, h: 260 }, { color: '#fff', vy: 6, vx: 4, size: 1.2, alpha: 0.5, seed: 23, sway: 8 });
          g.restore();
        }
      },
    };
  })();
  // ============ SEASON 2: the woods, the ruin, and the floor giving way ============
  // Two helmet-less hazmat men walk a forest trail at dusk; the trees part on a
  // collapsed, vine-choked facility; they go in (15 seconds of exploring in the
  // dark with torches); the ground starts to shake, cracks spread across the
  // floor round a sealed hatch, and the floor falls away beneath them.
  (function () {
    const DUR = 34500, U = 15;
    const T_REVEAL = 9000, T_CUT = 13500, T_QUAKE = 28500, T_PIT = 29700, T_PIT_END = 32400, T_BLACK = 32600;
    const TRAIL_END = 892;                         // the door of the ruin
    const trailY = (x) => 40 * Math.sin(x * 0.0035 + 0.5) + 10 * Math.sin(x * 0.011);

    // cached backdrops, drawn once in world coordinates (ox, oy = where the origin sits on the canvas)
    const cache = {};
    function cached(key, w, h, ox, oy, build) {
      if (!cache[key]) {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.translate(ox, oy); build(g); cache[key] = c;
      }
      return cache[key];
    }
    const OX = 1300, OY = 450, OW = 3400, OH = 900;            // outdoors: world x -1300..2100, y -450..450
    const IX = 1300, IY = 380, IW = 2700, IH = 760;            // inside:   world x -1300..1400, y -380..380
    const blit = (g, c, ox, oy, dx, dy) => g.drawImage(c, -ox + (dx || 0), -oy + (dy || 0));

    // ---------- the forest ----------
    let treeList = null;
    function trees() {
      if (treeList) return treeList;
      treeList = [];
      for (let i = 0; i < 230; i++) {
        const x = -1250 + hash(i * 3.7) * 2050, y = -440 + hash(i * 6.1 + 2) * 880;
        if (Math.abs(y - trailY(x)) < 105 + hash(i * 8.3) * 25) continue;
        if (x > 760 && Math.abs(y) < 330) continue;
        treeList.push({ x, y, r: 62 + hash(i * 2.3 + 9) * 68, seed: i });
      }
      return treeList;
    }
    function fern(g, x, y, s, seed) {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + seed;
        g.fillStyle = lerpHex('#1d4a1a', '#47922c', hash(seed + k * 1.3));
        g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.62, s * 0.17, a, 0, TAU); g.fill();
      }
    }
    function buildGround(g) {
      g.fillStyle = '#14240e'; g.fillRect(-OX, -OY, OW, OH);
      for (let i = 0; i < 260; i++) {
        const lit = hash(i * 9.1) > 0.5;
        glow(g, -OX + hash(i * 1.7) * OW, -OY + hash(i * 2.9 + 4) * OH, 50 + hash(i * 5.3) * 130, lit ? '56,98,32' : '6,16,6', lit ? 0.32 : 0.5);
      }
      // the clearing in front of the ruin
      for (let i = 0; i < 90; i++) glow(g, 760 + hash(i * 3.1) * 300, (hash(i * 4.7) - 0.5) * 760, 60 + hash(i) * 70, '84,124,46', 0.3);
      // tree shadows
      trees().forEach((t) => glow(g, t.x + 16, t.y + 18, t.r * 1.25, '2,6,2', 0.6));
      // the trail: a dirt track worn through the undergrowth
      const stroke = (w, col) => {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); for (let x = -1250; x <= 900; x += 20) { if (x === -1250) g.moveTo(x, trailY(x)); else g.lineTo(x, trailY(x)); } g.stroke();
      };
      stroke(92, '#1b2a10'); stroke(74, '#3a2c1a'); stroke(56, '#5a4528'); stroke(32, '#6d5733');
      [-13, 13].forEach((d) => { g.save(); g.translate(0, d); stroke(5, 'rgba(30,20,10,0.55)'); g.restore(); });
      for (let i = 0; i < 700; i++) {          // pebbles and leaf litter, thickest on the trail
        const x = -1250 + hash(i * 1.9) * 2150, y = trailY(x) + (hash(i * 7.7) - 0.5) * 120;
        g.fillStyle = hash(i * 3.3) > 0.6 ? '#8a7a62' : lerpHex('#8a4a1a', '#c9842a', hash(i));
        g.beginPath(); g.ellipse(x, y, 2 + hash(i * 5.1) * 3, 1.4 + hash(i * 6.1) * 2, hash(i) * 3, 0, TAU); g.fill();
      }
      // undergrowth and little things
      for (let i = 0; i < 520; i++) {
        const x = -1250 + hash(i * 2.3 + 11) * 2100, y = -440 + hash(i * 4.1 + 5) * 880;
        if (Math.abs(y - trailY(x)) < 34) continue;
        fern(g, x, y, 14 + hash(i * 9.7) * 16, i);
      }
      for (let i = 0; i < 900; i++) {
        const x = -1250 + hash(i * 5.9 + 3) * 2150, y = -440 + hash(i * 3.3 + 8) * 880;
        if (Math.abs(y - trailY(x)) < 30) continue;
        g.strokeStyle = lerpHex('#2a5a1e', '#6aa83a', hash(i)); g.lineWidth = 1.5;
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 2, y); g.lineTo(x + k * 5, y - 8 - hash(i + k) * 6); g.stroke(); }
      }
      for (let i = 0; i < 70; i++) {                                  // mossy rocks
        const x = -1250 + hash(i * 6.7) * 2100, y = -430 + hash(i * 8.9 + 1) * 860, r = 8 + hash(i * 3.1) * 18;
        if (Math.abs(y - trailY(x)) < r + 40) continue;
        const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
        rg.addColorStop(0, '#8b8f88'); rg.addColorStop(1, '#3d413d');
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 4, y + 5, r * 1.1, r * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, r, r * 0.8, hash(i) * 3, 0, TAU); g.fill();
        g.fillStyle = 'rgba(70,120,40,0.7)'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.25, r * 0.7, r * 0.4, 0.4, 0, TAU); g.fill();
      }
      for (let i = 0; i < 16; i++) {                                  // fallen logs
        const x = -1200 + hash(i * 4.4) * 2000, y = -420 + hash(i * 7.3 + 2) * 840;
        if (Math.abs(y - trailY(x)) < 60) continue;
        g.save(); g.translate(x, y); g.rotate(hash(i * 2.2) * 3);
        const L = 60 + hash(i) * 70;
        g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -L / 2 + 4, -7, L, 18, 8); g.fill();
        g.fillStyle = '#4a3320'; rr(g, -L / 2, -9, L, 18, 8); g.fill();
        g.fillStyle = '#6a4a2e'; rr(g, -L / 2, -9, L, 6, 3); g.fill();
        g.fillStyle = 'rgba(80,130,44,0.8)'; g.beginPath(); g.ellipse(-L * 0.1, -4, L * 0.28, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#9a7a52'; g.beginPath(); g.ellipse(L / 2, 0, 5, 9, 0, 0, TAU); g.fill();
        g.restore();
      }
      for (let i = 0; i < 90; i++) {                                  // mushrooms and flowers
        const x = -1250 + hash(i * 9.3 + 6) * 2100, y = -420 + hash(i * 2.7 + 9) * 840;
        if (Math.abs(y - trailY(x)) < 40) continue;
        if (i % 3 === 0) { g.fillStyle = '#d8d0b0'; g.fillRect(x - 1, y, 2, 4); g.fillStyle = i % 2 ? '#c8402a' : '#d8a040'; g.beginPath(); g.ellipse(x, y, 5, 3.4, 0, 0, TAU); g.fill(); }
        else { g.fillStyle = ['#e8d86a', '#d890c8', '#f0f0f0'][i % 3]; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.6) * 2.6, y + Math.sin(k * 1.6) * 2.6, 1.6, 0, TAU); g.fill(); } }
      }
      buildRuin(g);
    }

    // ---------- the ruined facility, seen from above ----------
    const X0 = 920, X1 = 1900, Y0 = -250, Y1 = 250;
    const HOLES = [{ x: 1260, y: 70, rx: 150, ry: 100 }, { x: 1570, y: -110, rx: 120, ry: 90 }, { x: 1750, y: 130, rx: 160, ry: 105 }, { x: 1020, y: -135, rx: 78, ry: 58 }];
    function buildRuin(g) {
      // the cracked apron round it
      g.fillStyle = '#4d534f'; g.fillRect(840, -300, 1100, 600);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let x = 840; x < 1940; x += 110) { g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 300); g.stroke(); }
      for (let y = -300; y < 300; y += 100) { g.beginPath(); g.moveTo(840, y); g.lineTo(1940, y); g.stroke(); }
      for (let i = 0; i < 70; i++) glow(g, 840 + hash(i * 3.3) * 1100, -300 + hash(i * 5.9) * 600, 30 + hash(i) * 70, '60,102,36', 0.5);
      for (let i = 0; i < 26; i++) {                                  // cracks and weeds through them
        let x = 840 + hash(i * 7.1) * 1100, y = -300 + hash(i * 2.9) * 600, a = hash(i) * TAU;
        g.strokeStyle = 'rgba(10,12,10,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) { a += (hash(i * 9 + k) - 0.5) * 1.3; x += Math.cos(a) * 20; y += Math.sin(a) * 20; g.lineTo(x, y); if (k % 2) fern(g, x, y, 9, i + k); }
        g.stroke();
      }
      // the building: shadow, outer wall, roof
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X0 - 4, Y0 + 6, X1 - X0 + 36, Y1 - Y0 + 38);
      g.fillStyle = '#2b2f2d'; g.fillRect(X0 - 16, Y0 - 16, X1 - X0 + 32, Y1 - Y0 + 32);
      const rg = g.createLinearGradient(X0, Y0, X1, Y1);
      rg.addColorStop(0, '#6b716d'); rg.addColorStop(0.5, '#5c625e'); rg.addColorStop(1, '#4d534f');
      g.fillStyle = rg; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 2;
      for (let x = X0; x < X1; x += 98) { g.beginPath(); g.moveTo(x, Y0); g.lineTo(x, Y1); g.stroke(); }
      for (let y = Y0; y < Y1; y += 83) { g.beginPath(); g.moveTo(X0, y); g.lineTo(X1, y); g.stroke(); }
      for (let i = 0; i < 46; i++) glow(g, X0 + hash(i * 4.9) * (X1 - X0), Y0 + hash(i * 6.7) * (Y1 - Y0), 30 + hash(i) * 80, '14,20,14', 0.38);   // rain stains
      g.strokeStyle = '#3a3f3c'; g.lineWidth = 6; g.strokeRect(X0 + 16, Y0 + 16, X1 - X0 - 32, Y1 - Y0 - 32);
      // rooftop machinery
      [[1110, -175, 130, 80], [1480, 150, 160, 70], [1380, -200, 90, 46]].forEach(([x, y, w, h], k) => {
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 6, y + 8, w, h);
        g.fillStyle = '#7a6a54'; g.fillRect(x, y, w, h); g.fillStyle = '#9a8666'; g.fillRect(x, y, w, 8);
        g.strokeStyle = '#3a2e20'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
        for (let f = 0; f < Math.floor(w / 60); f++) {
          g.fillStyle = '#1c1c1a'; g.beginPath(); g.arc(x + 30 + f * 60, y + h / 2, 22, 0, TAU); g.fill();
          g.strokeStyle = '#6a6458'; g.lineWidth = 2; for (let b = 0; b < 4; b++) { g.beginPath(); g.moveTo(x + 30 + f * 60, y + h / 2); g.lineTo(x + 30 + f * 60 + Math.cos(b * 1.57 + k) * 20, y + h / 2 + Math.sin(b * 1.57 + k) * 20); g.stroke(); }
        }
      });
      const tg = g.createRadialGradient(1735, -138, 4, 1740, -130, 62);
      tg.addColorStop(0, '#8a7a62'); tg.addColorStop(0.7, '#5a4a38'); tg.addColorStop(1, '#2a2218');
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(1746, -122, 62, 0, TAU); g.fill();
      g.fillStyle = tg; g.beginPath(); g.arc(1740, -130, 62, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; [18, 38, 56].forEach((r) => { g.beginPath(); g.arc(1740, -130, r, 0, TAU); g.stroke(); });
      // a faded hazard mark painted on the roof
      g.save(); g.translate(1390, 8); g.globalAlpha = 0.34;
      g.strokeStyle = '#c9a227'; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, 92, 0, TAU); g.stroke();
      for (let k = 0; k < 3; k++) { g.save(); g.rotate(k * TAU / 3); g.fillStyle = '#c9a227'; g.beginPath(); g.arc(0, -42, 30, 0, TAU); g.fill(); g.fillStyle = '#5c625e'; g.beginPath(); g.arc(0, -42, 17, 0, TAU); g.fill(); g.restore(); }
      g.fillStyle = '#c9a227'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
      g.restore();
      // moss eating in from the edges
      for (let i = 0; i < 110; i++) {
        const edge = hash(i * 3.7), x = X0 + hash(i * 5.3) * (X1 - X0), y = edge > 0.5 ? Y0 + hash(i * 2.1) * 70 : Y1 - hash(i * 2.1) * 70;
        glow(g, x, y, 40 + hash(i) * 70, '64,112,36', 0.55);
      }
      // the collapsed parts of the roof
      HOLES.forEach((h, k) => {
        g.beginPath();
        for (let i = 0; i <= 18; i++) {
          const a = (i / 18) * TAU, r = 0.78 + 0.34 * hash(k * 31 + (i % 18) * 2.3);
          const px = h.x + Math.cos(a) * h.rx * r, py = h.y + Math.sin(a) * h.ry * r;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        const hg = g.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.rx);
        hg.addColorStop(0, '#000'); hg.addColorStop(0.75, '#060807'); hg.addColorStop(1, '#161a17');
        g.fillStyle = hg; g.fill(); g.strokeStyle = '#8a908a'; g.lineWidth = 4; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#7a4a2a'; g.lineWidth = 2;                      // bent rebar
        for (let b = 0; b < 5; b++) { const a = hash(k * 7 + b) * TAU; g.beginPath(); g.moveTo(h.x + Math.cos(a) * h.rx * 0.9, h.y + Math.sin(a) * h.ry * 0.9); g.quadraticCurveTo(h.x + Math.cos(a) * h.rx * 0.4, h.y + Math.sin(a) * h.ry * 0.4 - 10, h.x + Math.cos(a + 0.5) * h.rx * 0.2, h.y + Math.sin(a + 0.5) * h.ry * 0.2); g.stroke(); }
        for (let i = 0; i < 12; i++) {                                   // slabs that fell in
          const a = hash(k * 13 + i) * TAU, d = hash(k * 17 + i * 3) * 0.7;
          g.fillStyle = lerpHex('#3a3f3c', '#5a605c', hash(i + k)); g.save(); g.translate(h.x + Math.cos(a) * h.rx * d, h.y + Math.sin(a) * h.ry * d); g.rotate(hash(i * 5 + k) * 3);
          g.fillRect(-9, -6, 18, 12); g.restore();
        }
      });
      // trees that have grown up through two of the holes
      [[1750, 130, 96], [1260, 70, 90]].forEach(([x, y, r], k) => {
        for (let j = 0; j < 8; j++) {
          const a = hash(k * 9 + j) * TAU, d = hash(k * 4 + j * 2) * r * 0.5, cr = r * (0.42 + 0.22 * hash(k + j * 3));
          const cg = g.createRadialGradient(x + Math.cos(a) * d - cr * 0.3, y + Math.sin(a) * d - cr * 0.3, 2, x + Math.cos(a) * d, y + Math.sin(a) * d, cr);
          cg.addColorStop(0, '#5aa83c'); cg.addColorStop(0.6, '#2c6a26'); cg.addColorStop(1, '#14380f');
          g.fillStyle = cg; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, cr, 0, TAU); g.fill();
        }
      });
      // the antenna mast that came down across the roof
      g.save(); g.translate(1530, 30); g.rotate(-0.42);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-250 + 6, -4 + 8, 500, 8);
      for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#8a5a3a' : '#9a6a44'; g.fillRect(-250 + i * 50, -5, 50, 8); }
      g.strokeStyle = '#6a4a30'; g.lineWidth = 1.5; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(-250 + i * 50, -5); g.lineTo(-225 + i * 50, 3); g.lineTo(-200 + i * 50, -5); g.stroke(); }
      g.restore();
      // vines over everything
      for (let v = 0; v < 34; v++) {
        let x = hash(v * 3.1) > 0.5 ? X0 + hash(v * 5.7) * (X1 - X0) : (hash(v * 2.3) > 0.5 ? X0 - 20 : X1 + 20);
        let y = hash(v * 6.3) > 0.5 ? Y0 - 18 : Y1 + 18, a = hash(v * 7.7) * TAU;
        if (x < X0 || x > X1) y = Y0 + hash(v * 8.1) * (Y1 - Y0);
        const pts = [[x, y]];
        for (let s = 0; s < 11; s++) { a += (hash(v * 11 + s) - 0.5) * 1.2; x += Math.cos(a) * 30; y += Math.sin(a) * 30; pts.push([x, y]); }
        drawVine(g, pts, 7, 2.5, '#122a0e', '#3f8a24');
        g.fillStyle = '#58b034';
        pts.forEach(([px, py], s) => { if (s % 2) { g.beginPath(); g.ellipse(px + 4, py - 3, 7, 3.5, hash(v + s) * 3, 0, TAU); g.fill(); } });
      }
      // the doorway: the wall is broken open here and a door hangs off its frame
      g.fillStyle = '#7a7a72'; g.beginPath(); g.moveTo(868, -8); g.lineTo(X0 - 16, -2); g.lineTo(X0 - 16, 70); g.lineTo(862, 82); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(868 + k * 12, -6); g.lineTo(868 + k * 12, 80); g.stroke(); }
      g.fillStyle = '#030403'; g.fillRect(X0 - 16, 2, 20, 62);
      g.save(); g.translate(872, 90); g.rotate(0.5); g.fillStyle = '#5a3a24'; g.fillRect(-4, -26, 8, 52); g.fillStyle = '#7a5a40'; g.fillRect(-4, -26, 3, 52); g.restore();
    }

    // the canopy drawn over the trail
    function buildCanopy(g) {
      trees().slice().sort((a, b) => a.r - b.r).forEach((t) => {
        g.save(); g.translate(t.x, t.y);
        for (let k = 0; k < 7; k++) {
          const a = hash(t.seed * 7 + k) * TAU, d = hash(t.seed * 3 + k + 1) * t.r * 0.45, cr = t.r * (0.46 + 0.26 * hash(t.seed + k * 5));
          const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
          const gr = g.createRadialGradient(cx - cr * 0.3, cy - cr * 0.35, 2, cx, cy, cr);
          gr.addColorStop(0, lerpHex('#4f9a3a', '#78c050', hash(t.seed + k))); gr.addColorStop(0.6, '#2c6a26'); gr.addColorStop(1, '#13350f');
          g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
        }
        for (let j = 0; j < 16; j++) {
          g.fillStyle = `rgba(190,235,120,${0.25 + 0.3 * hash(t.seed + j * 2)})`;
          g.beginPath(); g.ellipse((hash(t.seed * 5 + j) - 0.5) * t.r * 1.3, (hash(t.seed * 9 + j) - 0.5) * t.r * 1.3, 4, 2, hash(j) * 3, 0, TAU); g.fill();
        }
        g.restore();
      });
    }

    // ---------- inside ----------
    const HATCH = { x: 700, y: 0, r: 150 };
    const SHAFTS = [[-120, -70], [250, 150], [520, -150], [930, 110]];       // holes in the ceiling
    function tiles(g, x0, y0, x1, y1, size, c0, c1, seed) {
      for (let x = x0, i = 0; x < x1; x += size, i++) for (let y = y0, j = 0; y < y1; y += size, j++) {
        g.fillStyle = lerpHex(c0, c1, hash(i * 17 + j * 5 + seed));
        g.fillRect(x, y, Math.min(size, x1 - x) - 2, Math.min(size, y1 - y) - 2);
      }
    }
    function crackLine(g, x, y, a, n, step, seed) {
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < n; k++) { a += (hash(seed + k * 3.1) - 0.5) * 1.1; x += Math.cos(a) * step; y += Math.sin(a) * step; g.lineTo(x, y); }
      g.stroke();
    }
    function buildInterior(g) {
      g.fillStyle = '#0a0c0c'; g.fillRect(-IX, -IY, IW, IH);
      // corridor
      tiles(g, -1180, -70, -300, 70, 56, '#283131', '#364141', 1);
      g.fillStyle = '#161a1a'; g.fillRect(-1180, -130, 880, 60); g.fillRect(-1180, 70, 880, 60);
      g.strokeStyle = '#2c3434'; g.lineWidth = 6;
      [[-110], [112]].forEach(([y]) => { g.beginPath(); g.moveTo(-1180, y); g.lineTo(-300, y); g.stroke(); });
      for (let x = -1100; x < -300; x += 150) { g.fillStyle = '#10100f'; g.fillRect(x, -128, 74, 56); g.fillStyle = '#403a2a'; g.fillRect(x + 4, -124, 66, 6); g.fillStyle = '#10100f'; g.fillRect(x + 40, 72, 74, 56); }
      // the side rooms off the junction
      [[-1, -70, -270], [1, 70, 270]].forEach(([s, ya, yb]) => {
        g.fillStyle = '#0d1010'; g.fillRect(-540, Math.min(ya, yb), 250, Math.abs(yb - ya));
        tiles(g, -520, Math.min(ya, yb), -310, Math.min(ya, yb) + Math.abs(yb - ya), 52, '#2a3232', '#364040', s * 9);
        for (let b = 0; b < 3; b++) {                                    // bed frames, one flung on its side
          const bx = -500 + b * 66, by = s * 150 + (b === 1 ? 20 : 0);
          g.save(); g.translate(bx + 22, by); g.rotate(b === 1 ? 0.5 : 0);
          g.fillStyle = '#3a3a3c'; g.fillRect(-22, -38, 44, 76); g.fillStyle = '#6a6458'; g.fillRect(-18, -34, 36, 68); g.fillStyle = '#4a4438'; g.fillRect(-18, -34, 36, 18);
          g.restore();
        }
      });
      g.fillStyle = '#10100f'; g.fillRect(-300, -70, 12, 140);
      // the great hall
      g.fillStyle = '#10130f'; g.fillRect(-306, -306, 1426, 612);
      tiles(g, -290, -290, 1110, 290, 70, '#2a3333', '#3a4747', 3);
      for (let i = 0; i < 70; i++) glow(g, -290 + hash(i * 3.3) * 1400, -290 + hash(i * 5.7) * 580, 40 + hash(i) * 90, '8,12,10', 0.5);
      g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 2;
      for (let i = 0; i < 22; i++) crackLine(g, -280 + hash(i * 2.1) * 1380, -280 + hash(i * 4.3) * 560, hash(i) * TAU, 7, 22, i * 11);
      // consoles along the north wall, lockers along the south
      for (let k = 0; k < 10; k++) {
        const x = -250 + k * 128, y = -290;
        g.fillStyle = '#1b1f20'; g.fillRect(x, y, 96, 44); g.fillStyle = '#2f3a3c'; g.fillRect(x, y, 96, 8);
        g.fillStyle = k % 3 === 0 ? '#16363a' : '#0c1618'; g.fillRect(x + 8, y + 14, 36, 22); g.fillRect(x + 52, y + 14, 36, 22);
        g.strokeStyle = 'rgba(200,230,235,0.5)'; g.lineWidth = 1; crackLine(g, x + 14, y + 16, 0.7, 4, 7, k * 5);
        g.fillStyle = '#6a4a2a'; g.fillRect(x + 4 + k * 4, y + 40, 12, 3);
      }
      for (let k = 0; k < 16; k++) {
        const x = -250 + k * 84, y = 246;
        g.fillStyle = '#5a3a24'; g.fillRect(x, y, 38, 44); g.fillStyle = '#7a5434'; g.fillRect(x, y, 38, 7);
        g.fillStyle = '#1a120c'; g.fillRect(x + 4, y + 10, 30, 30);
        if (k % 4 === 1) { g.save(); g.translate(x + 38, y + 4); g.rotate(-0.8); g.fillStyle = '#6a4630'; g.fillRect(0, 0, 32, 38); g.restore(); }
      }
      // pillars
      [-60, 280, 620, 960].forEach((x) => [-175, 175].forEach((y) => {
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x - 24, y - 22, 56, 56);
        g.fillStyle = '#4a504d'; g.fillRect(x - 28, y - 28, 56, 56); g.fillStyle = '#6a706c'; g.fillRect(x - 28, y - 28, 56, 7);
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; crackLine(g, x - 20, y - 20, 0.6, 4, 12, x);
      }));
      // wreckage: desks, gurneys, drums, paper
      for (let i = 0; i < 16; i++) {
        const x = -230 + hash(i * 6.1) * 1250, y = -210 + hash(i * 3.7 + 2) * 420;
        if (Math.hypot(x - HATCH.x, y - HATCH.y) < 215) continue;
        g.save(); g.translate(x, y); g.rotate(hash(i * 8.3) * 3);
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(-26, -15, 56, 36);
        if (i % 3 === 0) { g.fillStyle = '#7a7a76'; g.fillRect(-32, -13, 64, 26); g.fillStyle = '#9a9a96'; g.fillRect(-32, -13, 64, 6); g.fillStyle = '#222'; [-22, 22].forEach((wx) => { g.beginPath(); g.arc(wx, 16, 5, 0, TAU); g.fill(); }); }
        else if (i % 3 === 1) { g.fillStyle = '#4a3a28'; g.fillRect(-28, -17, 56, 34); g.fillStyle = '#6a5438'; g.fillRect(-28, -17, 56, 6); }
        else { g.fillStyle = '#5a2a22'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill(); g.strokeStyle = '#2a1410'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#7a4636'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); }
        g.restore();
      }
      for (let i = 0; i < 90; i++) { g.save(); g.translate(-280 + hash(i * 2.9) * 1380, -280 + hash(i * 4.7) * 560); g.rotate(hash(i) * 3); g.fillStyle = `rgba(210,205,190,${0.2 + 0.35 * hash(i + 3)})`; g.fillRect(-6, -4, 12, 8); g.restore(); }
      // puddles under the leaks
      [[150, 130, 70, 36], [-150, -20, 54, 28], [540, 120, 86, 40], [860, -60, 60, 30]].forEach(([x, y, rx, ry]) => {
        g.fillStyle = '#122c32'; g.beginPath(); g.ellipse(x, y, rx, ry, 0.2, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(150,200,210,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x - rx * 0.1, y - ry * 0.2, rx * 0.7, ry * 0.5, 0.2, 3.4, 5.4); g.stroke();
      });
      // the ceiling has come down in four places: rubble, roots and vines hanging through
      SHAFTS.forEach(([x, y], k) => {
        glow(g, x, y, 130, '150,190,200', 0.14);
        for (let i = 0; i < 14; i++) {
          const a = hash(k * 21 + i) * TAU, d = hash(k * 7 + i * 3) * 60;
          g.fillStyle = lerpHex('#3a3f3c', '#5a605c', hash(i + k * 9)); g.save(); g.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); g.rotate(hash(i * 5 + k) * 3);
          g.fillRect(-9, -6, 18, 12); g.restore();
        }
        for (let v = 0; v < 5; v++) {
          let vx = x + (hash(k * 5 + v) - 0.5) * 70, vy = y + (hash(k * 3 + v * 2) - 0.5) * 50, a = hash(k * 11 + v) * TAU;
          const pts = [[vx, vy]]; for (let s = 0; s < 6; s++) { a += (hash(k * 13 + v * 7 + s) - 0.5) * 1.1; vx += Math.cos(a) * 24; vy += Math.sin(a) * 24; pts.push([vx, vy]); }
          drawVine(g, pts, 6, 2, '#0f240c', '#2f6a1e');
        }
      });
      for (let i = 0; i < 40; i++) glow(g, -290 + hash(i * 7.3) * 1400, -290 + hash(i * 3.1) * 580, 24 + hash(i) * 40, '44,90,28', 0.42);   // moss
      // the sealed hatch
      const H = HATCH;
      g.fillStyle = '#1a1d1e'; g.beginPath(); g.arc(H.x, H.y, H.r + 38, 0, TAU); g.fill();
      for (let k = 0; k < 28; k++) {
        const a0 = (k / 28) * TAU, a1 = ((k + 1) / 28) * TAU;
        g.fillStyle = k % 2 ? '#c9a227' : '#15130a';
        g.beginPath(); g.arc(H.x, H.y, H.r + 34, a0, a1); g.arc(H.x, H.y, H.r + 8, a1, a0, true); g.closePath(); g.fill();
      }
      const dg = g.createRadialGradient(H.x - 40, H.y - 40, 10, H.x, H.y, H.r);
      dg.addColorStop(0, '#5a6268'); dg.addColorStop(1, '#2a3034');
      g.fillStyle = dg; g.beginPath(); g.arc(H.x, H.y, H.r, 0, TAU); g.fill();
      g.strokeStyle = '#14181a'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.65)'; g.lineWidth = 3;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU + 0.2; g.beginPath(); g.moveTo(H.x + Math.cos(a) * 44, H.y + Math.sin(a) * 44); g.lineTo(H.x + Math.cos(a) * H.r, H.y + Math.sin(a) * H.r); g.stroke(); }
      [60, 104].forEach((r) => { g.beginPath(); g.arc(H.x, H.y, r, 0, TAU); g.stroke(); });
      g.fillStyle = '#9aa2a8';
      for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; g.beginPath(); g.arc(H.x + Math.cos(a) * (H.r - 10), H.y + Math.sin(a) * (H.r - 10), 3.2, 0, TAU); g.fill(); }
      g.fillStyle = '#23282b'; g.beginPath(); g.arc(H.x, H.y, 40, 0, TAU); g.fill(); g.strokeStyle = '#7a828a'; g.lineWidth = 6;
      g.beginPath(); g.arc(H.x, H.y, 32, 0, TAU); g.stroke();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.beginPath(); g.moveTo(H.x, H.y); g.lineTo(H.x + Math.cos(a) * 32, H.y + Math.sin(a) * 32); g.stroke(); }
      g.fillStyle = '#9a6a3a'; g.beginPath(); g.arc(H.x, H.y, 9, 0, TAU); g.fill();
      for (let i = 0; i < 18; i++) glow(g, H.x + (hash(i * 3.1) - 0.5) * 220, H.y + (hash(i * 5.3) - 0.5) * 220, 14 + hash(i) * 22, '120,64,30', 0.4);   // rust
    }

    // ---------- the two men ----------
    //   A (orange) leads, B (green) walks behind him
    const COL = { A: '#f08a24', B: '#4ac26a' };
    const stride = (x) => x * 0.085;
    function leadX(t) {                                                   // outdoors, then up to the door
      if (t < T_REVEAL) { const p = seg(t, 300, T_REVEAL); return lerp(-820, 700, 0.5 * p + 0.5 * outQuad(p)); }
      if (t < 10700) return 700;
      return lerp(700, TRAIL_END, smooth(seg(t, 10700, T_CUT)));
    }
    function outdoorMan(t, who) {
      const lx = leadX(t), isA = who === 'A';
      const x = isA ? lx : lx - 72 - 6 * Math.sin(t * 0.0018);
      const toDoor = smooth(seg(t, 10700, T_CUT));
      const y0 = trailY(x) + (isA ? -16 : 22), y = lerp(y0, isA ? 22 : 44, toDoor);
      const slope = (trailY(x + 8) - trailY(x - 8)) / 16;
      let ang = Math.atan(slope);
      const moving = t < T_REVEAL ? seg(t, 300, 700) * (1 - seg(t, 8700, T_REVEAL)) : seg(t, 10700, 11100);
      const o = { x, y, ang, u: U, bare: true, helmetCol: COL[who], walk: stride(x) + (isA ? 0 : 1.6), speed: Math.min(1, moving * 1.1), shadow: 1 };
      if (t > 600 && t < T_REVEAL - 900) ang += (isA ? 0.12 : 0.4) * Math.sin(t * (isA ? 0.0011 : 0.0016) + (isA ? 0 : 2)) * seg(t, 1500, 3000);   // glancing around
      if (t >= T_REVEAL - 600 && t < 10700) {                              // they stop and take in the ruin
        const k = smooth(seg(t, T_REVEAL - 600, T_REVEAL + 500));
        if (isA) { ang = lerp(ang, -0.12, k); o.reach = { x: 1.35, y: -0.55, k: k * smooth(seg(t, T_REVEAL + 300, T_REVEAL + 900)) * (1 - seg(t, 10200, 10700)), sym: false }; }
        else { ang = lerp(ang, 0.15 + 0.1 * Math.sin(t * 0.002), k); o.armsUp = 0.5 * smooth(seg(t, T_REVEAL + 700, T_REVEAL + 1300)) * (1 - seg(t, 10200, 10700)); }
      }
      o.ang = ang;
      return o;
    }

    // inside, in absolute ms; the corridor runs along y ~ 0, the hall opens at x = -300
    function insideMan(t, who) {
      const isA = who === 'A', back = isA ? 0 : 74;
      let x, y = isA ? -14 : 16, ang = 0, walking = false, lean = 0;
      const o = { u: U, bare: true, helmetCol: COL[who], flashlight: true, shadow: 1 };
      if (t < 17900) { x = lerp(-1150, -430, smooth(seg(t, 13700, 17900) * 0.9 + 0.1 * seg(t, 13700, 17900))) - back; walking = t > 13750; ang = 0.05 * Math.sin(t * 0.002); }
      else if (t < 20700) {                                                // at the junction, torches into the side rooms
        x = -430 - back; ang = isA ? lerp(0, -1.5, smooth(seg(t, 17900, 18900))) : lerp(0, 1.55, smooth(seg(t, 18200, 19200)));
        if (isA) ang += 0.28 * Math.sin((t - 18900) * 0.004) * seg(t, 18900, 19300) * (1 - seg(t, 19900, 20700));
        if (!isA && t > 19300) ang += 0.22 * Math.sin((t - 19300) * 0.0045);
        const back0 = smooth(seg(t, 20000, 20700));
        ang = lerp(ang, 0.05, back0);
        if (isA) y += -22 * smooth(seg(t, 18200, 18800)) * (1 - back0);
        if (!isA) y += 22 * smooth(seg(t, 18500, 19100)) * (1 - back0);
        if (t > 19000 && t < 19250 && isA) o.jitter = 0.34;                  // the rat
      } else if (t < 24300) {
        x = lerp(-430, 400, smooth(seg(t, 20700, 24300) * 0.85 + 0.15 * seg(t, 20700, 24300))) - back; walking = true;
        y = (isA ? -14 : 16) + (isA ? 22 : -22) * smooth(seg(t, 21400, 23000)) * (1 - seg(t, 23200, 24300));
        ang = 0.4 * Math.sin(t * 0.0029 + (isA ? 0 : 1.3));
        if (t > 22200 && t < 23000) { ang = lerp(ang, -1.25, smooth(seg(t, 22200, 22350)) * (1 - smooth(seg(t, 22600, 23000)))); }
        if (t > 22200 && t < 22420) o.jitter = 0.3;
      } else if (t < T_QUAKE) {                                            // to the hatch, where they stop and look down at it
        const aX = 548, bX = 552;
        x = lerp(400 - back, isA ? aX : bX, smooth(seg(t, 24300, 26400)));
        y = lerp(isA ? 8 : 34, isA ? -26 : 52, smooth(seg(t, 24300, 26400)));
        walking = t < 26300;
        const aim = Math.atan2(HATCH.y - y, HATCH.x - x);
        ang = lerp(0.3 * Math.sin(t * 0.003), aim + 0.12 * Math.sin(t * 0.002 + (isA ? 0 : 2)), smooth(seg(t, 25400, 26400)));
        lean = smooth(seg(t, 26400, 27000)) * 0.1;
        if (t > 27600 && t < 27900 && !isA) o.jitter = 0.3;
        if (t > 27000) o.sy = 1 - 0.0;
      } else {
        const aim = Math.atan2(HATCH.y - (isA ? -26 : 52), HATCH.x - (isA ? 548 : 552));
        const tr = smooth(seg(t, T_QUAKE + 300, T_QUAKE + 1000)), run = smooth(seg(t, T_QUAKE + 900, T_QUAKE + 1100));
        const dir = Math.PI + (isA ? -0.1 : 0.12);
        ang = lerp(aim, dir, tr);
        const rs = smooth(seg(t, 29300, 29600));
        const runDist = 150 * smooth(seg(t, 29300, 30700) * 0.6 + 0.4 * seg(t, 29300, 30700)) * rs;
        x = (isA ? 548 : 552) - runDist; y = (isA ? -26 : 52) + (isA ? -10 : 6) * smooth(seg(t, 29300, 30700)); walking = rs > 0.2 && run > 0;
        o.jitter = 0.2 * seg(t, T_QUAKE, T_QUAKE + 500);
        o.armsUp = 0.8 * smooth(seg(t, T_QUAKE + 300, T_QUAKE + 900)) * (1 - rs);
      }
      o.x = x; o.y = y; o.ang = ang;
      o.walk = stride(x) + (isA ? 0 : 1.6) + t * 0.0001; o.speed = walking ? 1 : 0;
      if (lean) o.sx = 1 - lean;
      return o;
    }

    // when the pit's edge reaches each man (found once, by stepping through the collapse)
    const pitR = (t) => 600 * Math.pow(seg(t, T_PIT, T_PIT_END), 0.75);
    const fallAt = {};
    function fallTime(who) {
      if (fallAt[who] === undefined) {
        fallAt[who] = T_PIT_END;
        for (let t = T_PIT; t < T_PIT_END; t += 20) {
          const m = insideMan(t, who);
          if (Math.hypot(m.x - HATCH.x, m.y - HATCH.y) < pitR(t) - 6) { fallAt[who] = t; break; }
        }
      }
      return fallAt[who];
    }
    function manNow(t, who) {
      if (t < T_CUT) return outdoorMan(t, who);
      const o = insideMan(t, who);
      if (t >= T_QUAKE) {
        const f = fallTime(who);
        if (t >= f) {                                                      // the floor is gone
          const base = insideMan(f, who), p = seg(t, f, f + 1050);
          const pull = Math.atan2(HATCH.y - base.y, HATCH.x - base.x);
          o.x = base.x + Math.cos(pull) * 70 * outQuad(p); o.y = base.y + Math.sin(pull) * 70 * outQuad(p);
          o.ang = base.ang + 4.5 * p; o.flail = 1; o.armsUp = 0; o.speed = 0; o.jitter = 0;
          const sc = 1 - 0.9 * p * p; o.sx = sc; o.sy = sc;
          o.alpha = 1 - smooth(seg(p, 0.45, 1)); o.shadow = 0; o.time = t;
          o.fallen = p;
        }
      }
      return o;
    }
    function drawMan(g, o, t) {
      o.time = o.time || t;
      if (o.fallen !== undefined) {                                        // drawn smaller, spinning, into the dark
        g.save(); g.translate(o.x, o.y); g.scale(o.sx, o.sy); drawHazmat(g, Object.assign({}, o, { x: 0, y: 0, sx: 1, sy: 1 })); g.restore();
      } else drawHazmat(g, o);
    }

    // ---------- the quake: cracks, the pit, falling chunks ----------
    function drawCracks(g, t) {
      if (t < T_QUAKE) return;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + (hash(i * 4.1) - 0.5) * 0.3;
        const grow = outCubic(seg(t, T_QUAKE + 100 + i * 45, T_QUAKE + 1700 + i * 35));
        if (grow <= 0) continue;
        const L = (170 + 290 * hash(i * 2.9)) * grow, n = 10;
        const pts = [[HATCH.x + Math.cos(a) * 36, HATCH.y + Math.sin(a) * 36]];
        let ca = a;
        for (let k = 1; k <= n; k++) { ca += (hash(i * 31 + k) - 0.5) * 0.34; const d = 36 + (L / n) * k; pts.push([HATCH.x + Math.cos(ca) * d + (hash(i * 7 + k) - 0.5) * 3, HATCH.y + Math.sin(ca) * d + (hash(i * 9 + k) - 0.5) * 3]); }
        g.lineJoin = 'round'; g.lineCap = 'round';
        [['rgba(150,190,200,0.16)', 9, 1], ['#000', 3.4, 1], ['#000', 1.8, 0.45]].forEach(([col, w, part]) => {
          g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.slice(0, Math.max(2, Math.ceil(pts.length * part) + (part < 1 ? 0 : 0))).forEach(([px, py], k) => { if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); }); g.stroke();
        });
      }
    }
    function drawPit(g, t) {
      const R = pitR(t);
      if (R < 3) return;
      const edge = (r) => {
        g.beginPath();
        for (let i = 0; i <= 44; i++) {
          const a = (i / 44) * TAU, rr0 = r * (0.86 + 0.2 * hash((i % 44) * 3.3) + 0.05 * Math.sin(a * 5));
          const px = HATCH.x + Math.cos(a) * rr0, py = HATCH.y + Math.sin(a) * rr0;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
      };
      edge(R * 1.07); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill();             // the broken lip
      edge(R);
      const pg = g.createRadialGradient(HATCH.x, HATCH.y, 0, HATCH.x, HATCH.y, R);
      pg.addColorStop(0, '#000'); pg.addColorStop(0.7, '#020304'); pg.addColorStop(1, '#0a0d0e');
      g.fillStyle = pg; g.fill();
      g.strokeStyle = '#7a807c'; g.lineWidth = 3; g.stroke();
      g.save(); edge(R); g.clip();                                            // faint depth: pale mist rising in the dark
      const pulse = 0.75 + 0.25 * Math.sin(t * 0.004);
      glow(g, HATCH.x, HATCH.y, R * 0.9, '30,110,120', 0.34 * pulse * seg(t, T_PIT, T_PIT + 1200));
      glow(g, HATCH.x, HATCH.y, R * 0.45, '10,60,70', 0.4 * seg(t, T_PIT + 400, T_PIT + 1500));
      for (let i = 1; i <= 4; i++) { g.strokeStyle = `rgba(0,0,0,${0.18 * i})`; g.lineWidth = R * 0.07; g.beginPath(); g.arc(HATCH.x, HATCH.y, R * (1 - i * 0.15), 0, TAU); g.stroke(); }
      g.restore();
    }
    function drawChunks(g, t) {
      if (t < T_PIT) return;
      for (let i = 0; i < 80; i++) {
        const ts = T_PIT + 80 + hash(i * 3.7) * 2500, p = (t - ts) / 950;
        if (p < 0 || p > 1) continue;
        const a = hash(i * 5.3) * TAU, r0 = pitR(ts) * (0.78 + 0.26 * hash(i * 2.9));
        const x = HATCH.x + Math.cos(a) * r0 * (1 - 0.3 * outQuad(p)), y = HATCH.y + Math.sin(a) * r0 * (1 - 0.3 * outQuad(p));
        const sz = (12 + 20 * hash(i * 7.1)) * (1 - 0.8 * p);
        g.save(); g.translate(x, y); g.rotate(hash(i) * 3 + p * 5 * (hash(i + 1) - 0.5)); g.globalAlpha = 1 - p * p;
        g.fillStyle = lerpHex('#3a3f3c', '#7a807c', hash(i * 9.9)); g.beginPath(); g.moveTo(-sz, -sz * 0.6); g.lineTo(sz * 0.9, -sz * 0.8); g.lineTo(sz, sz * 0.7); g.lineTo(-sz * 0.7, sz * 0.9); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
        g.restore();
      }
    }

    // ---------- the camera ----------
    function camera(t) {
      if (t < T_REVEAL) {
        const m = outdoorMan(t, 'A');
        return { x: m.x + 150, y: lerp(m.y * 0.4, 0, seg(t, 5000, T_REVEAL)), z: 1.22 + 0.06 * Math.sin(t * 0.0004) + 0.05 * seg(t, 0, T_REVEAL) };
      }
      if (t < T_CUT) {
        const e = smooth(seg(t, T_REVEAL + 300, 12200));
        const m = outdoorMan(T_REVEAL, 'A');
        const mid = { x: m.x + 150, y: 0, z: 1.27 };
        return { x: lerp(mid.x, 1210, e), y: lerp(0, -4, e), z: lerp(mid.z, 0.6, e) + 0.03 * smooth(seg(t, 12200, T_CUT)) };
      }
      if (t < 17900) { const m = insideMan(t, 'A'); return { x: m.x + 130, y: 0, z: 1.38 }; }
      if (t < 20700) { const m = insideMan(t, 'A'); return { x: m.x + 150, y: -4, z: 1.4 - 0.06 * smooth(seg(t, 20000, 20700)) }; }
      if (t < 24300) { const m = insideMan(t, 'A'); return { x: m.x + 150, y: 0, z: lerp(1.3, 1.1, smooth(seg(t, 20700, 22000))) }; }
      if (t < T_QUAKE) { const e = smooth(seg(t, 24300, 27500)); return { x: lerp(560, 640, e), y: 0, z: lerp(1.1, 1.6, e) }; }
      return { x: lerp(640, 660, smooth(seg(t, T_QUAKE, 31000))), y: 0, z: lerp(1.6, 0.95, smooth(seg(t, T_QUAKE + 600, 30600))) + 0.12 * smooth(seg(t, 31200, T_PIT_END)) };
    }

    // ---------- lights ----------
    const shaftLights = () => SHAFTS.map(([x, y], i) => ({ x, y, r: 150, a: 0.5 }));
    function lights(t, c) {
      const L = [];
      if (t < T_CUT) {
        L.push({ x: c.cam.x, y: c.cam.y, r: 560 * (1 + 0.2 * (1.3 - Math.min(c.cam.z, 1.3))) , a: 0.55 });
        ['A', 'B'].forEach((w) => { const o = outdoorMan(t, w); L.push({ x: o.x, y: o.y, r: 130, a: 0.4 }); });
        if (t > T_REVEAL) L.push({ x: 1400, y: 0, r: 700, a: 0.3 * smooth(seg(t, T_REVEAL, 11500)) });
        return L;
      }
      const flick = t >= T_QUAKE ? (hash(Math.floor(t / 70)) > 0.3 + 0.3 * seg(t, T_QUAKE, 30500) ? 1 : 0.3) : 1;
      ['A', 'B'].forEach((w) => {
        const o = manNow(t, w);
        if (o.fallen !== undefined) { if (o.fallen < 0.9) L.push({ x: o.x, y: o.y, r: 80 * (1 - o.fallen), a: 0.7 * (1 - o.fallen) }); return; }
        torchLights(o.x, o.y, o.ang, t, U, flick).forEach((l) => L.push(l));
      });
      // cold light through the holes in the ceiling
      if (t < T_PIT_END) shaftLights().forEach((l) => { l.a *= flick > 0.5 ? 1 : 0.6; L.push(l); });
      if (t >= T_PIT) { const R = pitR(t); L.push({ x: HATCH.x, y: HATCH.y, r: R * 1.5 + 260, a: 0.55 * (1 - seg(t, 31800, T_BLACK)) }); }
      L.push({ x: -1150 + 0, y: 0, r: 260 * (1 - seg(t, 13500, 16500)), a: 0.9 * (1 - seg(t, 13500, 16500)) });       // daylight at the door
      if (t > 22190 && t < 22500) L.push({ x: 60, y: -285, r: 260, a: 0.9 * (1 - seg(t, 22190, 22500)) });       // the spark
      if (t < T_QUAKE + 900) L.push({ x: HATCH.x, y: HATCH.y, r: 190, a: 0.28 });
      return L;
    }

    // ---------- the scene ----------
    const steps = [];
    function stepRun(a, b, every) { for (let t = a; t < b; t += every) steps.push([t, 'step'], [t + every / 2, 'step']); }
    stepRun(500, 8800, 340); stepRun(10800, 13400, 400); stepRun(13900, 17800, 340); stepRun(20800, 24200, 340); stepRun(24400, 26200, 420); stepRun(29400, 30300, 240);
    SCENES.season2 = {
      name: 'STORY 2', color: '#e8c34a', dur: DUR,
      dark: (t) => (t < T_CUT ? (t < T_REVEAL ? 0.34 : 0.3) : 0.8 + 0.12 * seg(t, T_QUAKE, 31800)),
      shade: (t) => (t < T_CUT ? '6,16,10' : '2,5,7'),
      dip: (t) => (t > T_CUT - 700 && t < T_CUT ? seg(t, T_CUT - 700, T_CUT) : (t >= T_CUT && t < T_CUT + 500 ? 1 - seg(t, T_CUT, T_CUT + 500) : 0)) + seg(t, T_PIT_END - 200, T_BLACK),
      shakes: [[25200, 1.2, 600], [27000, 0.8, 500], [T_QUAKE, 2, 900], [T_QUAKE + 900, 3.5, 700], [29000, 6, 900], [29800, 9, 1000], [30800, 13, 1100], [31700, 12, 900], [T_PIT, 4, 500]],
      sfx: steps.concat([
        [0, 'wind'], [4800, 'wind'], [900, 'chirp'], [2600, 'chirp'], [4400, 'chirp'], [6300, 'chirp'], [8100, 'chirp'], [10300, 'chirp'],
        [11000, 'creak'], [T_CUT - 300, 'creak'], [14500, 'drip'], [16100, 'drip'], [18300, 'drip'], [19050, 'step'], [20900, 'drip'], [22200, 'spark'], [23600, 'drip'],
        [25200, 'tremor'], [26500, 'drip'], [27600, 'knock'], [27850, 'knock'],
        [T_QUAKE, 'rumble'], [28750, 'crack'], [29450, 'crack'], [29900, 'crack'], [30050, 'scream'], [30200, 'fall'], [30280, 'scream'], [30800, 'thud'], [31500, 'shatter'],
      ]),
      camera,
      lights,
      world(g, t) {
        if (t < T_CUT) {
          blit(g, cached('s2ground', OW, OH, OX, OY, buildGround), OX, OY);
          // slow cloud shadows drifting over the forest floor
          for (let i = 0; i < 6; i++) glow(g, -1000 + ((hash(i * 7) * 2800 + t * 0.012 * (1 + hash(i))) % 2800), -250 + hash(i * 3) * 500, 260, '0,6,2', 0.22);
          const A = outdoorMan(t, 'A'), B = outdoorMan(t, 'B');
          (A.x > B.x ? [B, A] : [A, B]).forEach((m) => drawMan(g, m, t));
          // the canopy overhead, easing away as the camera rises
          g.save(); g.globalAlpha = 1 - 0.78 * smooth(seg(t, T_REVEAL, 11800));
          blit(g, cached('s2canopy', OW, OH, OX, OY, buildCanopy), OX, OY, 3 * Math.sin(t * 0.0007), 2 * Math.sin(t * 0.0009 + 1));
          g.restore();
          return;
        }
        blit(g, cached('s2inside', IW, IH, IX, IY, buildInterior), IX, IY);
        // the rat
        if (t > 18900 && t < 19700) {
          const p = seg(t, 18900, 19700), rx = lerp(-500, -330, p), ry = 6 + 4 * Math.sin(p * 18);
          g.save(); g.translate(rx, ry); g.rotate(0.05 * Math.sin(p * 40));
          g.fillStyle = '#26211f'; g.beginPath(); g.ellipse(0, 0, 10, 5, 0, 0, TAU); g.fill();
          g.strokeStyle = '#4a3a38'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-18, 5 * Math.sin(p * 30), -26, 2); g.stroke();
          g.fillStyle = '#d83a2a'; g.beginPath(); g.arc(8, -2, 1, 0, TAU); g.fill();
          g.restore();
        }
        // a drip into the puddle
        [[150, 130, 0], [540, 120, 600]].forEach(([x, y, off]) => {
          const p = ((t + off) % 2200) / 2200;
          g.strokeStyle = `rgba(160,210,220,${0.5 * (1 - p)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, 4 + 26 * p, 2 + 12 * p, 0, 0, TAU); g.stroke();
        });
        drawCracks(g, t); drawPit(g, t); drawChunks(g, t);
        const A = manNow(t, 'A'), B = manNow(t, 'B');
        [B, A].forEach((m) => drawMan(g, m, t));
      },
      after(g, t, c) {
        g.save(); g.globalCompositeOperation = 'lighter';
        if (t < T_CUT) {
          // slanting shafts of low sun through the canopy
          for (let i = 0; i < 9; i++) {
            const x = -1100 + i * 260 + 40 * Math.sin(i * 3), w = 60 + 70 * hash(i * 3.3), a = (0.045 + 0.04 * hash(i * 5.1)) * (0.75 + 0.25 * Math.sin(t * 0.0008 + i));
            const lg = g.createLinearGradient(x, -460, x + 260, 460);
            lg.addColorStop(0, `rgba(255,236,170,${a})`); lg.addColorStop(1, 'rgba(255,236,170,0)');
            g.fillStyle = lg; g.beginPath(); g.moveTo(x, -460); g.lineTo(x + w, -460); g.lineTo(x + 260 + w, 460); g.lineTo(x + 260, 460); g.closePath(); g.fill();
          }
          for (let i = 0; i < 12; i++) glow(g, -1000 + ((hash(i * 11) * 2400 + t * 0.008) % 2400), -300 + hash(i * 13) * 600, 140 + 80 * hash(i), '160,200,150', 0.05);   // ground mist
          drift(g, t, 70, { x: -1000, y: -320, w: 2100, h: 640 }, { seed: 3, speed: 0.6, vx: 8, vy: -5, colors: ['#e8f090', '#c8e870', '#fff8b0'], size: 1.7, alpha: 0.85, sway: 8 });   // fireflies and pollen
          g.globalCompositeOperation = 'source-over';
          drift(g, t, 26, { x: -1000, y: -380, w: 2100, h: 760 }, { seed: 17, speed: 1, vx: 20, vy: 38, colors: ['#8a4a1a', '#c9842a', '#6a5a1a'], size: 2.6, alpha: 0.8, sway: 16 });   // falling leaves
        } else {
          g.globalCompositeOperation = 'lighter';
          // dust turning in the cold light
          SHAFTS.forEach(([x, y], k) => drift(g, t, 14, { x: x - 60, y: y - 60, w: 120, h: 120 }, { seed: k * 5, speed: 0.4, vx: 3, vy: 5, color: '#cfe4ea', size: 1.3, alpha: 0.7 }));
          // the red emergency lamp at the far end
          const on = (t % 1700) < 700 ? 1 : 0.15;
          glow(g, 1040, -262, 150, '255,40,30', 0.28 * on); glow(g, 1040, -262, 28, '255,150,120', 0.7 * on);
          // the spark
          if (t > 22190 && t < 22700) glow(g, 60, -285, 90, '255,226,140', 0.8 * (1 - seg(t, 22190, 22700)));
          // the quake: dust shaken out of the ceiling and boiling up out of the pit
          const q = seg(t, T_QUAKE, 29500);
          if (q > 0) drift(g, t, Math.floor(40 + 90 * q), { x: 300, y: -300, w: 800, h: 600 }, { seed: 41, speed: 1.6, vx: 0, vy: 90, color: '#b8b4a4', size: 2, alpha: 0.5 * q, sway: 6 });
          for (let i = 0; i < 12; i++) {
            const ts = T_QUAKE + 200 + i * 230, p = (t - ts) / 800;
            if (p > 0 && p < 1) glow(g, 330 + hash(i * 5) * 700, -250 + hash(i * 9) * 500, 40 + 60 * p, '170,166,150', 0.5 * (1 - p));
          }
          if (t > T_PIT) for (let i = 0; i < 10; i++) {
            const a = hash(i * 3.3) * TAU, rr0 = pitR(t) * (0.8 + 0.3 * hash(i)), p = (t - T_PIT) * 0.001;
            glow(g, HATCH.x + Math.cos(a) * rr0, HATCH.y + Math.sin(a) * rr0, 60 + 30 * hash(i * 2) + 30 * p, '150,152,140', 0.05 * (1 - seg(t, 31300, T_BLACK)));
          }
        }
        g.restore();
      },
    };
  })();

  // <<SCENES-END>>

  window.BossCutscene = {
    kinds: () => Object.keys(SCENES),
    duration: (kind) => (SCENES[kind] ? SCENES[kind].dur : 3000),
    draw,
    skipRequested: (startedAt) => skipAt > startedAt + 700,
    _SCENES: SCENES, _hazmat: drawHazmat,
  };
})();
