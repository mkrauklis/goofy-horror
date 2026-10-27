  // The Hush: a ghost with tentacles and two black eyes. 95% transparent while
  // it roams (m.vis ~ 0.05, see updateMonster); the moment it spots you it
  // turns almost solid (0.9) and comes at you fast.
  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    const alpha = m.vis;
    g.save();
    g.translate(m.x, m.y);
    g.globalAlpha = alpha;

    // tentacles it's reaching along the nearby walls with
    m.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      const perpX = -ty / dist, perpY = tx / dist;
      drawTaperedTentacle(g, tx, ty, tx / 2 + perpX * wobble, ty / 2 + perpY * wobble, r * 0.2, '#cfe3ee');
    });

    // the long, drifting tail of tentacles
    for (let i = 0; i < 8; i++) {
      const spread = (i - 3.5) * 0.38;
      const a = ang + Math.PI + spread + Math.sin(t * 0.0035 + i * 1.3 + m.seed) * 0.3;
      const len = r * (2.4 + 0.5 * Math.sin(t * 0.005 + i + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.006 + i * 2.2 + m.seed) * r * 0.6;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.42, i % 2 ? '#dfeef6' : '#bcd3e0');
    }

    // the sheet-like body: a soft, wavering white blob
    const points = 16;
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const rr = r * 1.12 + Math.sin(t * 0.005 + i * 1.9 + m.seed) * r * 0.1;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    const body = g.createRadialGradient(-r * 0.25, -r * 0.3, 2, 0, 0, r * 1.2);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.7, '#e1eef5');
    body.addColorStop(1, '#a9c4d4');
    g.fillStyle = body;
    g.fill();
    g.strokeStyle = 'rgba(140,175,195,0.8)';
    g.lineWidth = 1.2;
    g.stroke();

    // two black eyes (red in hard mode), set toward where it's looking
    const fx = Math.cos(ang), fy = Math.sin(ang);
    const nx = -fy, ny = fx;
    g.fillStyle = HM.on ? '#ff1a14' : '#050508';
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.ellipse(fx * r * 0.42 + nx * side * r * 0.38, fy * r * 0.42 + ny * side * r * 0.38, r * 0.3, r * 0.2, ang + Math.PI / 2, 0, Math.PI * 2);
      g.fill();
    });

    if (t < m.frozenUntil) {
      g.globalAlpha = Math.max(alpha, 0.5);
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = r * 1.25 + 3;
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(140,220,255,0.45)';
      g.fill();
      g.strokeStyle = 'rgba(220,250,255,0.8)';
      g.lineWidth = 1.5;
      g.stroke();
    }

    g.restore();
  }
