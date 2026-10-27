  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    const scream = clamp(((m.screamUntil || 0) - t) / 1000, 0, 1);       // 1 just as it screams, fading out
    const breathe = 1 + 0.05 * Math.sin(t * 0.0035 + m.seed);            // slow, wet breathing
    const swell = (1 + 0.22 * Math.sin(scream * Math.PI)) * breathe;
    const beat = Math.pow(Math.max(0, Math.sin(t * 0.006 + m.seed)), 6); // a heartbeat the veins throb with
    const rnd = (i) => { const v = Math.sin(i * 127.1 + m.seed * 311.7) * 43758.5453; return v - Math.floor(v); };
    g.save();
    g.translate(m.x, m.y);
    if (scream > 0) g.translate((Math.random() - 0.5) * 4 * scream, (Math.random() - 0.5) * 4 * scream);

    // pseudopods gripping the duct walls, ending in pale, curling fingers
    m.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      const perpX = -ty / dist, perpY = tx / dist;
      drawTaperedTentacle(g, tx, ty, tx / 2 + perpX * wobble, ty / 2 + perpY * wobble, r * 0.3, '#3a2f12');
      const fa = Math.atan2(ty, tx);
      g.strokeStyle = '#9a8a58'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (let f = 0; f < 4; f++) {
        const a = fa + (f - 1.5) * 0.55 + Math.sin(t * 0.008 + f + i) * 0.25;
        g.beginPath(); g.moveTo(tx, ty);
        g.quadraticCurveTo(tx + Math.cos(a) * 6, ty + Math.sin(a) * 6, tx + Math.cos(a + 0.7) * 10, ty + Math.sin(a + 0.7) * 10);
        g.stroke();
      }
    });
    // limp, hair-thin strands trailing behind it, some ending in tiny pale hands
    for (let i = 0; i < 9; i++) {
      const a = ang + Math.PI * 0.55 + (i / 8) * Math.PI * 0.9 + Math.sin(t * 0.004 + i * 1.7 + m.seed) * 0.3;
      const len = r * (1.5 + 0.55 * Math.sin(t * 0.006 + i * 1.3 + m.seed) + 0.5 * rnd(i));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.007 + i * 2.2 + m.seed) * r * 0.55;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * (i % 3 ? 0.2 : 0.36), i % 2 ? '#4a3d1a' : '#2a2a0e');
      if (i % 3 === 0) {
        g.strokeStyle = '#a89a66'; g.lineWidth = 1.3; g.lineCap = 'round';
        for (let f = 0; f < 3; f++) {
          const fa = a + (f - 1) * 0.6 + Math.sin(t * 0.01 + f * 2 + i) * 0.3;
          g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(fa) * 7, ty + Math.sin(fa) * 7); g.stroke();
        }
      }
    }

    // the rotting pumpkin: a squat, slumped, lumpy body
    g.scale(swell * 1.06, swell * 0.94);
    g.fillStyle = '#1c1204';
    g.beginPath();
    for (let i = 0; i <= 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rr = r * 1.14 + Math.sin(t * 0.005 + i * 2.3 + m.seed) * r * 0.1 + Math.sin(a * 3 + m.seed) * r * 0.12 + Math.sin(a * 5 + m.seed * 2) * r * 0.05;
      if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    const body = g.createRadialGradient(-r * 0.25, -r * 0.3, 2, 0, 0, r * 1.15);
    body.addColorStop(0, '#b89050'); body.addColorStop(0.4, '#7a4e1e'); body.addColorStop(1, '#2a1806');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, r * 1.03, 0, Math.PI * 2); g.fill();
    // the ribs of the pumpkin, sunk and sagging
    g.strokeStyle = 'rgba(28,14,2,0.6)'; g.lineWidth = 1.6;
    [-0.62, -0.3, 0, 0.3, 0.62].forEach((k) => {
      g.beginPath();
      g.ellipse(0, 0, r * 1.03 * Math.abs(1 - Math.abs(k) * 0.75), r * 1.0, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    // a collapsed, soggy patch with green-brown mould furring the rim
    g.fillStyle = 'rgba(30,18,4,0.65)';
    g.beginPath(); g.ellipse(-r * 0.35, r * 0.3, r * 0.4, r * 0.3, 0.5, 0, Math.PI * 2); g.fill();
    [[-0.1, -0.55, 0.3, 'rgba(95,125,45,0.55)'], [0.35, 0.5, 0.22, 'rgba(60,90,35,0.6)'], [-0.62, -0.1, 0.2, 'rgba(120,135,80,0.5)'],
      [0.05, 0.1, 0.16, 'rgba(210,220,190,0.32)'], [-0.3, 0.55, 0.18, 'rgba(70,100,30,0.55)']].forEach(([bx, by, br, col], i) => {
      g.fillStyle = col;
      g.beginPath();
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2, rr = r * br * (1 + 0.35 * Math.sin(k * 2.7 + i * 1.9));
        if (k === 0) g.moveTo(bx * r + Math.cos(a) * rr, by * r + Math.sin(a) * rr); else g.lineTo(bx * r + Math.cos(a) * rr, by * r + Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
    });
    // a shrivelled, blackened stem leaning off the top, grown over with mould
    g.fillStyle = '#2a2208';
    g.beginPath(); g.moveTo(-r * 0.16, -r * 0.88); g.lineTo(r * 0.14, -r * 0.9); g.lineTo(r * 0.4, -r * 1.3); g.lineTo(r * 0.12, -r * 1.34); g.closePath(); g.fill();
    g.fillStyle = 'rgba(110,140,60,0.6)';
    g.beginPath(); g.arc(r * 0.26, -r * 1.2, r * 0.1, 0, Math.PI * 2); g.fill();
    // wet sheen
    g.fillStyle = 'rgba(225,225,160,0.38)';
    g.beginPath(); g.ellipse(-r * 0.4, -r * 0.55, r * 0.28, r * 0.1, -0.6, 0, Math.PI * 2); g.fill();

    g.save();
    g.rotate(ang);

    const eyes = [[0.4, -0.42, 0.2, 0], [0.4, 0.36, 0.15, 1.3], [0.2, -0.04, 0.09, 2.1], [0.02, -0.6, 0.1, 0.7], [-0.18, 0.5, 0.17, 3.0],
      [-0.42, -0.22, 0.13, 1.9], [-0.56, 0.12, 0.08, 2.6], [0.16, 0.66, 0.07, 0.4], [-0.22, -0.66, 0.09, 3.4]];

    // cracks splitting out from the eyes, oozing
    g.strokeStyle = `rgba(26,14,2,${0.5 + 0.3 * beat})`; g.lineWidth = 1; g.lineCap = 'round';
    eyes.forEach(([ex, ey, er], i) => {
      for (let k = 0; k < 2; k++) {
        const va = rnd(i * 3 + k) * Math.PI * 2;
        let vx = ex * r, vy = ey * r;
        g.beginPath(); g.moveTo(vx, vy);
        for (let s = 1; s <= 3; s++) {
          vx += Math.cos(va + Math.sin(s * 2.1 + i) * 0.7) * r * 0.2;
          vy += Math.sin(va + Math.sin(s * 2.1 + i) * 0.7) * r * 0.2;
          g.lineTo(vx, vy);
        }
        g.stroke();
      }
    });
    // pale boils that pulse
    [[-0.1, 0.25, 0.07], [-0.5, -0.5, 0.06], [0.3, 0.1, 0.05]].forEach(([bx, by, br], i) => {
      const pr = r * br * (1 + 0.25 * Math.sin(t * 0.007 + i * 2 + m.seed));
      g.fillStyle = 'rgba(190,200,140,0.55)';
      g.beginPath(); g.arc(bx * r, by * r, pr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(50,40,8,0.7)';
      g.beginPath(); g.arc(bx * r + pr * 0.2, by * r, pr * 0.4, 0, Math.PI * 2); g.fill();
    });
    // drips hanging off it
    g.fillStyle = '#5a5420';
    [-0.5, 0.1, 0.55].forEach((k, i) => {
      const dl = r * (0.25 + 0.18 * Math.sin(t * 0.004 + i * 2 + m.seed));
      g.beginPath(); g.ellipse(-r * 0.2, k * r, r * 0.1, dl, 0, 0, Math.PI * 2); g.fill();
    });

    // the mouth: a long split across its face that never quite closes, wrapping
    // round its sides, lined with uneven needle teeth; it tears wide open mid-scream
    const open = 0.2 + 0.8 * scream;
    const mouthC = (u) => r * (0.86 - 0.34 * u * u);                      // centre line of the split
    const gap = (u) => r * (0.035 + 0.26 * open) * Math.pow(1 - u * u, 0.7);
    const MU = 14;
    g.beginPath();
    for (let i = 0; i <= MU; i++) { const u = -1 + (2 * i) / MU; g.lineTo(mouthC(u) + gap(u), u * r * 0.74); }
    for (let i = MU; i >= 0; i--) { const u = -1 + (2 * i) / MU; g.lineTo(mouthC(u) - gap(u), u * r * 0.74); }
    g.closePath();
    const throat = g.createRadialGradient(r * 0.7, 0, 1, r * 0.7, 0, r * 0.5);
    throat.addColorStop(0, '#040300'); throat.addColorStop(1, '#3a2c08');
    g.fillStyle = throat; g.fill();
    // the tongue, lolling out and writhing as it screams
    if (scream > 0.15) {
      const tl = r * 0.95 * scream;
      g.strokeStyle = '#6a6a2a'; g.lineWidth = r * 0.16; g.lineCap = 'round';
      g.beginPath(); g.moveTo(r * 0.7, 0);
      g.quadraticCurveTo(r * 0.7 + tl * 0.5, Math.sin(t * 0.03) * r * 0.25, r * 0.7 + tl, Math.sin(t * 0.03 + 1.5) * r * 0.3);
      g.stroke();
    }
    // needle teeth on both jaws, irregular and too many
    g.fillStyle = '#cdb877';
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 13; i++) {
        const u = -0.88 + (i / 12) * 1.76 + (rnd(i + side * 9) - 0.5) * 0.08;
        const base = mouthC(u) + side * gap(u);
        const tl = r * (0.07 + 0.13 * rnd(i * 2 + side * 5)) * (0.7 + 0.8 * open);
        const hw = r * (0.025 + 0.02 * rnd(i + 3));
        const yy = u * r * 0.74;
        g.beginPath();
        g.moveTo(base, yy - hw);
        g.lineTo(base - side * tl, yy + (rnd(i + 7) - 0.5) * hw * 2);
        g.lineTo(base, yy + hw);
        g.closePath(); g.fill();
      }
    }
    // stretched strings of drool across the gap
    if (open > 0.4) {
      g.strokeStyle = 'rgba(170,175,90,0.55)'; g.lineWidth = 0.9;
      [-0.5, -0.2, 0.15, 0.45].forEach((u, i) => {
        const x0 = mouthC(u) + gap(u), x1 = mouthC(u) - gap(u), yy = u * r * 0.74;
        g.beginPath(); g.moveTo(x0, yy);
        g.quadraticCurveTo((x0 + x1) / 2, yy + Math.sin(t * 0.01 + i) * r * 0.06 + r * 0.05, x1, yy);
        g.stroke();
      });
    }

    // too many mismatched eyes, scattered over it, all fixed on you; they blink
    // out of step, and dilate and shrink to pinpricks when it screams
    eyes.forEach(([ex, ey, er, ph]) => {
      const e = er * r * (1 + 0.25 * scream);
      const cx = ex * r, cy = ey * r;
      g.fillStyle = 'rgba(200,235,90,0.12)';                              // a faint sickly glow
      g.beginPath(); g.arc(cx, cy, e * 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a0802';                                            // the sunken socket
      g.beginPath(); g.ellipse(cx, cy, e * 1.25, e * 1.2, 0, 0, Math.PI * 2); g.fill();
      const blink = ((t * 0.001 + ph * 1.7) % (3.2 + ph * 0.6)) < 0.14;
      if (blink) {
        g.strokeStyle = '#5a4a1c'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx, cy - e); g.quadraticCurveTo(cx + e * 0.35, cy, cx, cy + e); g.stroke();
        return;
      }
      g.fillStyle = scream > 0.2 ? '#ffe0a8' : '#e9f2a4';
      g.beginPath(); g.arc(cx, cy, e, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(110,90,20,0.75)'; g.lineWidth = 0.8;           // bloodshot
      for (let k = 0; k < 4; k++) {
        const va = (k / 4) * Math.PI * 2 + ph;
        g.beginPath(); g.moveTo(cx + Math.cos(va) * e, cy + Math.sin(va) * e);
        g.lineTo(cx + Math.cos(va + 0.25) * e * 0.5, cy + Math.sin(va + 0.25) * e * 0.5); g.stroke();
      }
      const jx = Math.sin(t * 0.013 + ph * 3) * e * 0.07, jy = Math.cos(t * 0.017 + ph) * e * 0.07;
      g.fillStyle = '#060400';                                            // a slit pupil, staring forward
      g.beginPath(); g.ellipse(cx + e * 0.3 + jx, cy + jy, e * (0.16 - 0.08 * scream), e * 0.62, 0, 0, Math.PI * 2); g.fill();
    });
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

