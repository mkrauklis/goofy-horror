  // The Seeper: a slimy purple mutation. A lumpy, glistening mass with too many
  // mismatched eyes and a wide wet mouth, dragging itself through the ducts on
  // blobby pseudopods and leaving a trail of purple goo behind it. When it spots
  // you it lets out a low scream (the mouth gapes and it swells for a moment).
  function playLowScream() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
    const filt = audioCtx.createBiquadFilter(), g = audioCtx.createGain(), lfo = audioCtx.createOscillator(), lfoG = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(48, t + 1.2);
    o2.type = 'square'; o2.frequency.setValueAtTime(48, t); o2.frequency.exponentialRampToValueAtTime(26, t + 1.2);
    filt.type = 'lowpass'; filt.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.34, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    lfo.frequency.value = 26; lfoG.gain.value = 0.12;                // a rattling growl
    lfo.connect(lfoG); lfoG.connect(g.gain);
    o.connect(filt); o2.connect(filt); filt.connect(g); g.connect(audioCtx.destination);
    o.start(t); o2.start(t); lfo.start(t);
    o.stop(t + 1.4); o2.stop(t + 1.4); lfo.stop(t + 1.4);
  }
  let lastScreamAt = 0;
  function screamAt(m, now) {
    m.screamUntil = now + 1000;
    if (now - lastScreamAt > 600) { lastScreamAt = now; playLowScream(); }
  }

  // ---- the goo trail ----
  const GOO_LIFE_MS = 30000;
  const GOO_STEP = 22;
  function updateGoo(now) {
    monsters.forEach((m) => {
      if (m.gooX === undefined) { m.gooX = m.x; m.gooY = m.y; }
      if (Math.hypot(m.x - m.gooX, m.y - m.gooY) >= GOO_STEP) {
        m.gooX = m.x; m.gooY = m.y;
        goo.push({ x: m.x + (Math.random() - 0.5) * 10, y: m.y + (Math.random() - 0.5) * 10, r: 9 + Math.random() * 7, born: now, seed: Math.random() * 100 });
        if (goo.length > 500) goo.shift();
      }
    });
    while (goo.length && now - goo[0].born > GOO_LIFE_MS) goo.shift();
  }
  function drawGoo(g, now) {
    goo.forEach((b) => {
      const age = (now - b.born) / GOO_LIFE_MS;
      const a = age < 0.1 ? 0.75 : 0.75 * (1 - (age - 0.1) / 0.9);
      g.save();
      g.globalAlpha = Math.max(0, a);
      g.translate(b.x, b.y);
      g.fillStyle = '#5a2480';
      g.beginPath(); g.ellipse(0, 0, b.r * 1.15, b.r * 0.85, b.seed, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a3ca8';
      g.beginPath(); g.ellipse(-b.r * 0.15, -b.r * 0.1, b.r * 0.7, b.r * 0.5, b.seed, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(235,200,255,0.55)';
      g.beginPath(); g.ellipse(-b.r * 0.3, -b.r * 0.3, b.r * 0.22, b.r * 0.12, b.seed, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }

  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    const scream = clamp(((m.screamUntil || 0) - t) / 1000, 0, 1);       // 1 just as it screams, fading out
    const swell = 1 + 0.18 * Math.sin(scream * Math.PI);
    g.save();
    g.translate(m.x, m.y);

    // pseudopods gripping the duct walls
    m.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      const perpX = -ty / dist, perpY = tx / dist;
      drawTaperedTentacle(g, tx, ty, tx / 2 + perpX * wobble, ty / 2 + perpY * wobble, r * 0.3, '#5a2480');
    });
    // slimy trailing pseudopods
    for (let i = 0; i < 6; i++) {
      const a = ang + Math.PI * 0.62 + (i / 5) * Math.PI * 0.76 + Math.sin(t * 0.004 + i * 1.7 + m.seed) * 0.3;
      const len = r * (1.4 + 0.4 * Math.sin(t * 0.006 + i * 1.3 + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.007 + i * 2.2 + m.seed) * r * 0.5;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.4, i % 2 ? '#6e30a0' : '#52217a');
    }

    // the lumpy body
    g.scale(swell, swell);
    g.fillStyle = '#3a1058';
    g.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rr = r * 1.12 + Math.sin(t * 0.005 + i * 2.3 + m.seed) * r * 0.1 + Math.sin(a * 3 + m.seed) * r * 0.1;
      if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.15);
    body.addColorStop(0, '#c18be8'); body.addColorStop(0.45, '#8a46b8'); body.addColorStop(1, '#4a1a6e');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, r * 1.02, 0, Math.PI * 2); g.fill();
    // slime sheen and a couple of bubbles
    g.fillStyle = 'rgba(245,225,255,0.6)';
    g.beginPath(); g.ellipse(-r * 0.4, -r * 0.5, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(230,200,255,0.5)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(r * 0.1, -r * 0.7, r * 0.12, 0, Math.PI * 2); g.arc(-r * 0.6, r * 0.2, r * 0.09, 0, Math.PI * 2); g.stroke();

    g.save();
    g.rotate(ang);
    // drips hanging off it
    g.fillStyle = '#7a3ca8';
    [-0.5, 0.1, 0.55].forEach((k, i) => {
      const dl = r * (0.25 + 0.18 * Math.sin(t * 0.004 + i * 2 + m.seed));
      g.beginPath(); g.ellipse(-r * 0.2, k * r, r * 0.12, dl, 0, 0, Math.PI * 2); g.fill();
    });
    // mismatched eyes
    const eyes = [[0.52, -0.36, 0.2], [0.5, 0.32, 0.16], [0.18, -0.02, 0.1], [0.02, -0.5, 0.08]];
    eyes.forEach(([ex, ey, er]) => {
      g.fillStyle = '#e8ff6a';
      g.beginPath(); g.arc(ex * r, ey * r, er * r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a0a3a';
      g.beginPath(); g.arc(ex * r + er * r * 0.3, ey * r, er * r * 0.5, 0, Math.PI * 2); g.fill();
    });
    // the mouth, gaping wide mid-scream
    const open = 0.22 + 0.7 * scream;
    g.fillStyle = '#1a0526';
    g.beginPath(); g.ellipse(r * 0.78, 0, r * (0.12 + 0.2 * open), r * (0.12 + 0.34 * open), 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d8c8e8';
    for (let i = 0; i < 4; i++) {
      const aa = (i / 3 - 0.5) * 1.8;
      g.beginPath(); g.moveTo(r * 0.78 + Math.cos(aa) * r * 0.2 * open, Math.sin(aa) * r * 0.34 * open); g.lineTo(r * 0.78 + Math.cos(aa) * r * 0.08, Math.sin(aa) * r * 0.12); g.lineTo(r * 0.78 + Math.cos(aa + 0.3) * r * 0.2 * open, Math.sin(aa + 0.3) * r * 0.34 * open); g.closePath(); g.fill();
    }
    g.restore();

    if (t < m.frozenUntil) {
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = r * 1.3 + 3;
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.fillStyle = 'rgba(140,220,255,0.45)'; g.fill();
      g.strokeStyle = 'rgba(220,250,255,0.8)'; g.lineWidth = 1.5; g.stroke();
    }
    g.restore();
  }
