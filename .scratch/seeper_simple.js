  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    const scream = clamp(((m.screamUntil || 0) - t) / 1000, 0, 1);       // 1 just as it screams, fading out
    const swell = (1 + 0.2 * Math.sin(scream * Math.PI)) * (1 + 0.04 * Math.sin(t * 0.0035 + m.seed));
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

    // the rotting pumpkin: a squat, slumped body with a couple of mouldy patches
    g.scale(swell * 1.06, swell * 0.94);
    g.fillStyle = '#1c1204';
    g.beginPath(); g.arc(0, 0, r * 1.1, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.15);
    body.addColorStop(0, '#b89050'); body.addColorStop(0.5, '#7a4e1e'); body.addColorStop(1, '#2a1806');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, r * 1.03, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(28,14,2,0.55)'; g.lineWidth = 1.6;
    [-0.5, 0, 0.5].forEach((k) => {
      g.beginPath();
      g.ellipse(0, 0, r * 1.03 * Math.abs(1 - Math.abs(k) * 0.75), r, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    g.fillStyle = 'rgba(80,110,40,0.55)';
    g.beginPath(); g.ellipse(-r * 0.2, -r * 0.5, r * 0.3, r * 0.2, 0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-r * 0.4, r * 0.35, r * 0.28, r * 0.2, -0.3, 0, Math.PI * 2); g.fill();
    // a shrivelled, blackened stem
    g.fillStyle = '#2a2208';
    g.beginPath(); g.moveTo(-r * 0.16, -r * 0.88); g.lineTo(r * 0.14, -r * 0.9); g.lineTo(r * 0.4, -r * 1.3); g.lineTo(r * 0.12, -r * 1.34); g.closePath(); g.fill();

    g.save();
    g.rotate(ang);
    // a gaping mouth with a few crooked teeth, wider when it screams
    const open = 0.25 + 0.75 * scream;
    g.fillStyle = '#0a0802';
    g.beginPath(); g.ellipse(r * 0.72, 0, r * (0.12 + 0.18 * open), r * (0.4 + 0.2 * open), 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cdb877';
    [-0.5, -0.17, 0.17, 0.5].forEach((k, i) => {
      const tl = r * (0.1 + 0.08 * (i % 2)) * (0.8 + 0.6 * open);
      g.beginPath();
      g.moveTo(r * 0.72 - tl * 0.2, k * r * 0.72 - r * 0.05);
      g.lineTo(r * 0.72 + tl * (i % 2 ? -0.7 : 0.7), k * r * 0.72);
      g.lineTo(r * 0.72 - tl * 0.2, k * r * 0.72 + r * 0.05);
      g.closePath(); g.fill();
    });
    // three sickly eyes
    [[0.3, -0.42, 0.2], [0.3, 0.4, 0.15], [-0.15, 0.02, 0.1]].forEach(([ex, ey, er]) => {
      g.fillStyle = scream > 0.2 ? '#ffe0a8' : '#e9f2a4';
      g.beginPath(); g.arc(ex * r, ey * r, er * r * (1 + 0.2 * scream), 0, Math.PI * 2); g.fill();
      g.fillStyle = '#060400';
      g.beginPath(); g.arc(ex * r + er * r * 0.3, ey * r, er * r * 0.45, 0, Math.PI * 2); g.fill();
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

