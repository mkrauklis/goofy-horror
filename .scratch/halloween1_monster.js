  // The Hollow Jack: a tentacled thing wearing a hollowed-out pumpkin. Seven
  // tentacles trail and writhe behind it, and the pumpkin has eyeholes carved
  // out -- seen from above, the carved face points where it's looking.
  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    g.save();
    g.translate(m.x, m.y);

    // tentacles gripping the nearby walls (same crawl as the other creatures)
    m.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      const perpX = -ty / dist, perpY = tx / dist;
      drawTaperedTentacle(g, tx, ty, tx / 2 + perpX * wobble, ty / 2 + perpY * wobble, r * 0.2, '#3d2a55');
    });

    // the writhing tail of tentacles, fanned out behind it
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) * 0.42;
      const a = ang + Math.PI + spread + Math.sin(t * 0.004 + i * 1.3 + m.seed) * 0.28;
      const len = r * (2.3 + 0.4 * Math.sin(t * 0.006 + i + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.007 + i * 2.2 + m.seed) * r * 0.55;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.5, i % 2 ? '#4b2f66' : '#3a5a3a');
    }

    // pumpkin body: ribbed and lit orange
    g.fillStyle = '#4a1a06';
    g.beginPath(); g.arc(0, 0, r * 1.18, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.15);
    body.addColorStop(0, '#ffb04a');
    body.addColorStop(0.55, '#ea7416');
    body.addColorStop(1, '#9a3c08');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, r * 1.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(100,36,4,0.55)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const a = ang + (i / 6) * Math.PI * 2 + Math.PI / 6;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
      g.quadraticCurveTo(Math.cos(a + 0.35) * r * 0.75, Math.sin(a + 0.35) * r * 0.75, Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08);
      g.stroke();
    }

    // stem set back from the face, then the carved face itself
    g.save();
    g.rotate(ang);
    g.fillStyle = '#3d6a1c';
    g.fillRect(-r * 0.62, -r * 0.14, r * 0.42, r * 0.28);

    // eyeholes: dark triangles with something moving behind them
    [-1, 1].forEach((side) => {
      const ex = r * 0.5, ey = side * r * 0.42;
      g.fillStyle = '#12060f';
      g.beginPath();
      g.moveTo(ex + r * 0.28, ey);
      g.lineTo(ex - r * 0.2, ey - r * 0.24);
      g.lineTo(ex - r * 0.2, ey + r * 0.24);
      g.closePath(); g.fill();
      g.fillStyle = `rgba(190,255,110,${0.55 + 0.35 * Math.sin(t * 0.01 + side * 2 + m.seed)})`;
      g.beginPath(); g.ellipse(ex - r * 0.02, ey + Math.sin(t * 0.008 + side) * r * 0.05, r * 0.07, r * 0.13, 0, 0, Math.PI * 2); g.fill();
    });
    // jagged carved mouth
    g.fillStyle = '#12060f';
    g.beginPath();
    g.moveTo(r * 0.78, -r * 0.22);
    [[0.62, -0.1], [0.74, 0.0], [0.6, 0.1], [0.78, 0.22], [0.5, 0.3], [0.5, -0.3]].forEach(([dx, dy]) => g.lineTo(r * dx, r * dy));
    g.closePath(); g.fill();
    g.restore();

    if (t < m.frozenUntil) {
      const points = 12;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const rr = r * 1.2 + 3;
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
