  // The Risen: a zombie that has grown tentacles -- a hunched, rotting body
  // with a tangle of tentacles for legs and two more reaching out ahead of
  // it, dead white eyes and a slack, torn mouth.
  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    g.save();
    g.translate(m.x, m.y);

    // tentacles gripping the nearby fences and gravestones
    m.tentacleTargets.forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      const perpX = -ty / dist, perpY = tx / dist;
      drawTaperedTentacle(g, tx, ty, tx / 2 + perpX * wobble, ty / 2 + perpY * wobble, r * 0.22, '#51663f');
    });
    // the writhing tentacles it drags itself along on
    for (let i = 0; i < 7; i++) {
      const a = ang + Math.PI * 0.62 + (i / 6) * Math.PI * 0.76 + Math.sin(t * 0.0045 + i * 1.7 + m.seed) * 0.28;
      const len = r * (1.6 + 0.4 * Math.sin(t * 0.006 + i * 1.3 + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.007 + i * 2.2 + m.seed) * r * 0.5;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.32, i % 2 ? '#6f8756' : '#4d6240');
    }
    // two tentacles reaching out in front, the way a zombie's arms would
    [-1, 1].forEach((side, k) => {
      const reach = r * (2.0 + 0.35 * Math.sin(t * 0.005 + k * 2 + m.seed));
      const lx = Math.cos(ang) * reach - Math.sin(ang) * side * r * 0.9;
      const ly = Math.sin(ang) * reach + Math.cos(ang) * side * r * 0.9;
      const sw = Math.sin(t * 0.006 + k * 3 + m.seed) * r * 0.4;
      drawTaperedTentacle(g, lx, ly, lx * 0.5 - Math.sin(ang) * sw, ly * 0.5 + Math.cos(ang) * sw, r * 0.3, '#7b9560');
    });

    // rotting body
    g.fillStyle = '#2d3a26';
    g.beginPath(); g.arc(0, 0, r * 1.1, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 1.1);
    body.addColorStop(0, '#a3bd86'); body.addColorStop(0.6, '#728d58'); body.addColorStop(1, '#45573a');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.save();
    g.rotate(ang);
    g.fillStyle = 'rgba(58,40,50,0.55)';                              // sores and rot
    g.beginPath(); g.ellipse(-r * 0.2, r * 0.45, r * 0.3, r * 0.18, 0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-r * 0.4, -r * 0.35, r * 0.22, r * 0.14, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2f26';                                          // rags
    g.beginPath(); g.moveTo(-r * 0.8, -r * 0.5); g.lineTo(-r * 0.1, -r * 0.7); g.lineTo(-r * 0.3, -r * 0.1); g.lineTo(-r * 0.7, -r * 0.1); g.closePath(); g.fill();
    // the head: a smaller, paler lump at the front with milky eyes and a slack mouth
    g.fillStyle = '#b5c79a';
    g.beginPath(); g.arc(r * 0.55, 0, r * 0.58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4d6240'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#e7ecc4';
    [-1, 1].forEach((side) => { g.beginPath(); g.arc(r * 0.72, side * r * 0.25, r * 0.15, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#16190f';
    [-1, 1].forEach((side) => { g.beginPath(); g.arc(r * 0.76, side * r * 0.25, r * 0.06, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#251018';
    g.beginPath(); g.ellipse(r * 0.9, 0, r * 0.1, r * 0.2, 0, 0, Math.PI * 2); g.fill();
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
