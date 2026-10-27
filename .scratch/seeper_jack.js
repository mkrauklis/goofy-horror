  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    const scream = clamp(((m.screamUntil || 0) - t) / 1000, 0, 1);       // 1 just as it screams, fading out
    const swell = (1 + 0.2 * Math.sin(scream * Math.PI)) * (1 + 0.04 * Math.sin(t * 0.0035 + m.seed));
    const flick = 0.8 + 0.2 * Math.sin(t * 0.021 + m.seed) * Math.sin(t * 0.007 + m.seed * 2);
    g.save();
    g.translate(m.x, m.y);

    // withered vines gripping the duct walls
    m.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      const perpX = -ty / dist, perpY = tx / dist;
      drawTaperedTentacle(g, tx, ty, tx / 2 + perpX * wobble, ty / 2 + perpY * wobble, r * 0.3, '#3a2f12');
    });
    // a few limp vines trailing behind it
    for (let i = 0; i < 5; i++) {
      const a = ang + Math.PI * 0.62 + (i / 4) * Math.PI * 0.76 + Math.sin(t * 0.004 + i * 1.7 + m.seed) * 0.3;
      const len = r * (1.4 + 0.4 * Math.sin(t * 0.006 + i * 1.3 + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.007 + i * 2.2 + m.seed) * r * 0.5;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.38, i % 2 ? '#4a3d1a' : '#2e2a10');
    }

    // the rotting jack-o-lantern: a squat, slumped, mouldy pumpkin
    g.scale(swell, swell);
    g.fillStyle = '#1c1204';
    g.beginPath(); g.ellipse(0, r * 0.1, r * 1.26, r * 1.0, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.25);
    body.addColorStop(0, '#b08040'); body.addColorStop(0.5, '#734a1a'); body.addColorStop(1, '#2a1806');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, 0, r * 1.2, r * 0.96, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(28,14,2,0.55)'; g.lineWidth = 1.6;
    [-0.62, -0.3, 0.3, 0.62].forEach((k) => {
      g.beginPath();
      g.ellipse(0, 0, r * 1.2 * Math.abs(1 - Math.abs(k) * 0.75), r * 0.96, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    // mould furring the skin, and a soggy cave-in
    g.fillStyle = 'rgba(80,110,40,0.55)';
    g.beginPath(); g.ellipse(-r * 0.7, -r * 0.35, r * 0.28, r * 0.18, 0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(r * 0.6, r * 0.55, r * 0.3, r * 0.17, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(205,215,185,0.35)';
    g.beginPath(); g.ellipse(-r * 0.15, -r * 0.8, r * 0.2, r * 0.1, 0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(26,14,2,0.55)';
    g.beginPath(); g.ellipse(r * 0.7, -r * 0.45, r * 0.3, r * 0.2, 0.5, 0, Math.PI * 2); g.fill();
    // a shrivelled, blackened stem leaning off the top
    g.fillStyle = '#2a2208';
    g.beginPath(); g.moveTo(-r * 0.16, -r * 0.88); g.lineTo(r * 0.14, -r * 0.9); g.lineTo(r * 0.42, -r * 1.28); g.lineTo(r * 0.14, -r * 1.34); g.closePath(); g.fill();

    // the carved face, sagging and caved in, a sick green light guttering behind it
    g.save();
    g.translate(look.x * r * 0.08, look.y * r * 0.05);
    const open = 0.15 + 0.85 * scream;
    const faceCol = scream > 0.2 ? '#f2ffa0' : '#aac838';
    g.shadowColor = '#8ab01a'; g.shadowBlur = 6 + 8 * scream;
    g.globalAlpha = Math.min(1, 0.85 * flick + 0.2 * scream);
    g.fillStyle = faceCol;
    g.beginPath();                                                       // eyes: one sunken and lopsided, one slumped half off its place
    g.moveTo(-r * 0.75, -r * 0.02); g.lineTo(-r * 0.22, -r * 0.08); g.lineTo(-r * 0.5, -r * 0.52); g.closePath();
    g.moveTo(r * 0.74, r * 0.04); g.lineTo(r * 0.28, -r * 0.04); g.lineTo(r * 0.58, -r * 0.34); g.closePath();
    g.fill();
    g.beginPath();                                                       // a crooked, gap-toothed grin that sags open
    g.moveTo(-r * 0.78, r * 0.2);
    [[-0.66, 0.34], [-0.58, 0.2], [-0.45, 0.22], [-0.38, 0.4], [-0.22, 0.26], [0.0, 0.3], [0.08, 0.52], [0.2, 0.3], [0.4, 0.34], [0.5, 0.58], [0.62, 0.32], [0.78, 0.28]]
      .forEach(([dx, dy]) => g.lineTo(r * dx, r * (dy + (dy > 0.3 ? open * 0.4 : 0))));
    g.lineTo(r * 0.7, r * 0.14); g.lineTo(r * 0.3, r * 0.2); g.lineTo(r * 0.2, r * 0.36 + open * r * 0.1);
    g.lineTo(r * 0.1, r * 0.2); g.lineTo(-r * 0.3, r * 0.22); g.lineTo(-r * 0.5, r * 0.12);
    g.closePath(); g.fill();
    g.shadowBlur = 0; g.globalAlpha = 1;
    // rot dripping out of the carved holes
    g.fillStyle = '#5a5420';
    [[-0.5, -0.02, 0.22], [0.5, 0.06, 0.28], [-0.1, 0.3, 0.26], [0.45, 0.4, 0.2]].forEach(([dx, dy, dl], i) => {
      const len = r * (dl + 0.1 * Math.sin(t * 0.004 + i * 2 + m.seed));
      g.beginPath(); g.ellipse(r * dx, r * dy + len / 2, r * 0.05, len / 2, 0, 0, Math.PI * 2); g.fill();
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

