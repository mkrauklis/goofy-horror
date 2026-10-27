  // The Embergourd: a hulking pumpkin that hops along on stubby, rooty feet.
  // Its carved face smoulders while it roams, burns white-hot once it has seen
  // you, and its mouth blazes open just before it spits a fireball.
  function drawMonster(g, t, m) {
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const hunting = m.state === 'alert';
    const cast = clamp(((m.windUpAt || 0) - t) / FIREBALL_WINDUP_MS, 0, 1);           // 1 -> 0 as the shot winds up
    const flaring = (m.windUpAt && t < m.windUpAt) || t < (m.castUntil || 0);
    const hop = Math.abs(Math.sin(t * (hunting ? 0.016 : 0.009) + m.seed)) * (hunting ? 5 : 3);
    g.save();
    g.translate(m.x, m.y);

    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(2, r * 0.85, r * 1.05, r * 0.4, 0, 0, Math.PI * 2); g.fill();

    // tentacles: some reach out and grip the walls beside it, and a nest of
    // thick green vine-tentacles writhes out behind and under the body
    const ang = Math.atan2(look.y, look.x);
    (m.tentacleTargets || []).forEach((tt, i) => {
      const wobble = Math.sin(t * 0.005 + i * 2.1 + m.seed) * r * 0.35;
      const tx = tt.x - m.x, ty = tt.y - m.y;
      const dist = Math.hypot(tx, ty) || 1;
      drawTaperedTentacle(g, tx, ty, tx / 2 + (-ty / dist) * wobble, ty / 2 + (tx / dist) * wobble, r * 0.34, '#4a8228');
    });
    for (let i = 0; i < 9; i++) {
      const spread = (i - 4) * 0.42;
      const a = ang + Math.PI + spread + Math.sin(t * (hunting ? 0.007 : 0.0042) + i * 1.3 + m.seed) * 0.34;
      const len = r * (1.9 + 0.55 * Math.sin(t * 0.005 + i + m.seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.0065 + i * 2.2 + m.seed) * r * 0.7;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.52, i % 2 ? '#5c9a30' : '#417022');
      g.strokeStyle = '#6fbf3a'; g.lineWidth = 1.6;                      // a little curl at each tip
      g.beginPath(); g.arc(tx + Math.cos(a + 1.2) * 3, ty + Math.sin(a + 1.2) * 3, 3, a - 2, a + 3.4); g.stroke();
    }
    // two thick ones reaching out in front, as if feeling the way
    [-1, 1].forEach((side, i) => {
      const a = ang + side * 0.75 + Math.sin(t * 0.006 + i * 3 + m.seed) * 0.25;
      const len = r * 1.55;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      drawTaperedTentacle(g, tx, ty, tx / 2 + Math.sin(a) * r * 0.3 * side, ty / 2 - Math.cos(a) * r * 0.3 * side, r * 0.4, '#4a8228');
    });

    g.translate(0, -hop);
    const heat = hunting ? 1 : 0.55;
    // glow thrown by the fire inside
    const halo = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.6);
    halo.addColorStop(0, `rgba(255,${hunting ? 120 : 150},30,${0.32 * heat})`); halo.addColorStop(1, 'rgba(255,100,10,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(0, 0, r * 2.6, 0, Math.PI * 2); g.fill();

    // the pumpkin
    g.fillStyle = '#4a1a06';
    g.beginPath(); g.ellipse(0, r * 0.12, r * 1.18, r * 1.02, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, r * 1.2);
    body.addColorStop(0, '#ffb24a'); body.addColorStop(0.55, '#e96a0e'); body.addColorStop(1, '#8f3208');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, 0, r * 1.16, r, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(100,32,4,0.6)'; g.lineWidth = 1.6;
    [-0.62, -0.3, 0, 0.3, 0.62].forEach((k) => {
      g.beginPath();
      g.ellipse(0, 0, r * 1.16 * Math.abs(1 - Math.abs(k) * 0.75), r, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    // stem and a curling vine
    g.fillStyle = '#4a5a1c';
    g.beginPath(); g.moveTo(-r * 0.14, -r * 0.92); g.lineTo(r * 0.16, -r * 0.92); g.lineTo(r * 0.24, -r * 1.34); g.lineTo(-r * 0.2, -r * 1.3); g.closePath(); g.fill();
    g.strokeStyle = '#4fae3a'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(r * 0.2, -r * 1.05); g.quadraticCurveTo(r * 0.8, -r * 1.2, r * 0.7, -r * 0.7); g.quadraticCurveTo(r * 0.6, -r * 0.5, r * 0.45, -r * 0.62); g.stroke();

    // the carved face, glowing from within (a little toward where it's looking)
    const fx = look.x * r * 0.1, fy = look.y * r * 0.06;
    g.save(); g.translate(fx, fy);
    const flick = 0.85 + 0.15 * Math.sin(t * 0.03 + m.seed);
    const glow = flaring ? '#ffffff' : (hunting ? '#fff0a0' : '#ffb02e');
    g.fillStyle = glow;
    g.shadowColor = hunting ? '#ff3a10' : '#ff8a1e'; g.shadowBlur = 8 + 10 * (flaring ? 1 : 0);
    g.globalAlpha = Math.min(1, 0.85 * flick + (flaring ? 0.2 : 0));
    g.beginPath();
    g.moveTo(-r * 0.7, -r * 0.05); g.lineTo(-r * 0.2, -r * 0.05); g.lineTo(-r * 0.45, -r * 0.5); g.closePath();           // brows slanted: angry
    g.moveTo(r * 0.7, -r * 0.05); g.lineTo(r * 0.2, -r * 0.05); g.lineTo(r * 0.45, -r * 0.5); g.closePath();
    g.fill();
    // the mouth: a jagged grin, gaping while it casts
    const open = flaring ? 0.55 + 0.45 * (1 - cast) : 0.1;
    g.beginPath();
    g.moveTo(-r * 0.75, r * 0.2);
    [[-0.5, 0.2 + open * 0.45], [-0.3, 0.22], [-0.1, 0.25 + open * 0.55], [0.1, 0.22], [0.3, 0.25 + open * 0.45], [0.5, 0.2], [0.75, 0.22]].forEach(([dx, dy]) => g.lineTo(r * dx, r * dy));
    g.lineTo(r * 0.5, r * 0.1); g.lineTo(-r * 0.5, r * 0.1); g.closePath(); g.fill();
    g.shadowBlur = 0; g.globalAlpha = 1;
    if (HM.on) {                                           // red-eyed in hard mode
      g.fillStyle = '#ff1a14';
      [-1, 1].forEach((s) => { g.beginPath(); g.arc(s * r * 0.4, -r * 0.2, r * 0.1, 0, Math.PI * 2); g.fill(); });
    }
    g.restore();

    if (flaring) {                                         // the fireball gathering in front of its mouth
      const gr = g.createRadialGradient(look.x * r * 1.1, look.y * r * 0.9, 1, look.x * r * 1.1, look.y * r * 0.9, r * (0.5 + 0.9 * (1 - cast)));
      gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(0.5, 'rgba(255,140,30,0.6)'); gr.addColorStop(1, 'rgba(255,90,10,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(look.x * r * 1.1, look.y * r * 0.9, r * (0.5 + 0.9 * (1 - cast)), 0, Math.PI * 2); g.fill();
    }

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

