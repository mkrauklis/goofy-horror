  // ---- the Candy Kraken ----
  const bossScratch = document.createElement('canvas');
  bossScratch.width = 320; bossScratch.height = 320;
  const bossG = bossScratch.getContext('2d');

  // Everything the boss is made of, drawn on a scratch canvas centered on the
  // origin: candy-rope tentacles, a peppermint-swirl body studded with
  // gumdrops, candy-corn teeth and gumball eyes. Withered, its colors go stale,
  // tentacles snap, and a hole in its front shows its candy-cane ribcage.
  function drawKrakenParts(s, now, withered, stunned, screaming) {
    const r = boss.radius;
    const look = boss.lookDir || { x: 0, y: 1 };
    const ang = Math.atan2(look.y, look.x);

    const ropes = withered ? ['#b79aa6', '#cfc5ca', '#a38c9a', '#8f9c93'] : ['#e8365d', '#ffffff', '#ff9ec7', '#4fd0a0', '#ffd23a', '#b48cff'];
    const tentCount = 8;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + Math.sin(now * 0.0017 + i) * 0.2;
      let len = r * (2.1 + 0.4 * Math.sin(now * 0.004 + i * 1.7 + boss.seed));
      if (withered) len *= (i % 3 === 0 ? 0.45 : 0.8);
      if (stunned) len *= 0.85;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = (stunned ? 0.2 : 1) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.5;
      const mx = tx / 2 - Math.sin(a) * bow, my = ty / 2 + Math.cos(a) * bow;
      const col = ropes[i % ropes.length];
      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.52, col);
      if (!withered) {      // the twist in the candy rope
        s.strokeStyle = col === '#ffffff' ? '#e8365d' : '#ffffff'; s.lineWidth = 2.4;
        const nx = -Math.sin(a), ny = Math.cos(a);
        [0.28, 0.5, 0.72].forEach((t) => {
          const px = 2 * (1 - t) * t * mx + t * t * tx, py = 2 * (1 - t) * t * my + t * t * ty;
          s.beginPath(); s.moveTo(px - nx * 4, py - ny * 4); s.lineTo(px + nx * 4, py + ny * 4); s.stroke();
        });
      }
    }

    s.save();
    if (stunned) s.scale(1.08, 0.92);
    // body
    const stops = withered ? ['#dcc8d0', '#b89aa8', '#8a7482'] : ['#ffc2dd', '#ff7eb0', '#c93a76'];
    const grad = s.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 1.1);
    grad.addColorStop(0, stops[0]); grad.addColorStop(0.6, stops[1]); grad.addColorStop(1, stops[2]);
    s.fillStyle = grad; s.beginPath(); s.arc(0, 0, r, 0, Math.PI * 2); s.fill();
    // peppermint swirl
    s.fillStyle = withered ? 'rgba(150,100,120,0.5)' : 'rgba(255,255,255,0.78)';
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + now * 0.0006;
      s.beginPath(); s.moveTo(0, 0); s.arc(0, 0, r * 0.98, a0, a0 + Math.PI / 8); s.closePath(); s.fill();
    }
    // gumdrops round the rim
    for (let i = 0; i < 10; i++) {
      if (withered && i % 2) continue;
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const px = Math.cos(a) * r * 0.96, py = Math.sin(a) * r * 0.96;
      s.fillStyle = withered ? '#a89aa6' : CANDY_COLORS[i % CANDY_COLORS.length];
      s.beginPath(); s.arc(px, py, r * 0.17, 0, Math.PI * 2); s.fill();
      s.fillStyle = 'rgba(255,255,255,0.5)'; s.beginPath(); s.arc(px - r * 0.05, py - r * 0.05, r * 0.05, 0, Math.PI * 2); s.fill();
    }
    if (!withered) {
      s.fillStyle = 'rgba(255,255,255,0.4)';
      s.beginPath(); s.ellipse(-r * 0.3, -r * 0.4, r * 0.34, r * 0.18, -0.6, 0, Math.PI * 2); s.fill();
    }

    s.save();
    s.rotate(ang); // from here +x is the way it's facing
    if (withered) {          // a hole in its front, and the ribcage inside
      s.globalCompositeOperation = 'destination-out';
      s.beginPath(); s.ellipse(-r * 0.15, 0, r * 0.62, r * 0.74, 0, 0, Math.PI * 2); s.fill();
      s.globalCompositeOperation = 'source-over';
      s.fillStyle = '#2a0e18';
      s.beginPath(); s.ellipse(-r * 0.15, 0, r * 0.58, r * 0.7, 0, 0, Math.PI * 2); s.fill();
      s.strokeStyle = '#efe6dc'; s.lineWidth = r * 0.08; s.lineCap = 'round';
      s.beginPath(); s.moveTo(-r * 0.62, 0); s.lineTo(r * 0.3, 0); s.stroke();
      for (let k = -2; k <= 2; k++) {
        const x = -r * 0.15 + k * r * 0.2;
        [-1, 1].forEach((sd) => {
          s.strokeStyle = '#efe6dc'; s.lineWidth = r * 0.075; s.setLineDash([]);
          s.beginPath(); s.moveTo(x, 0); s.quadraticCurveTo(x + r * 0.06, sd * r * 0.4, x - r * 0.1, sd * r * 0.62); s.stroke();
          s.strokeStyle = '#e8365d'; s.lineWidth = r * 0.075; s.setLineDash([3, 5]);
          s.beginPath(); s.moveTo(x, 0); s.quadraticCurveTo(x + r * 0.06, sd * r * 0.4, x - r * 0.1, sd * r * 0.62); s.stroke();
          s.setLineDash([]);
        });
      }
    }
    // the mouth: candy-corn teeth round a dark hollow (wide open mid-scream)
    const open = screaming ? 1.35 : stunned ? 0.5 : 0.7;
    s.fillStyle = '#3a0a18';
    s.beginPath(); s.ellipse(r * 0.7, 0, r * 0.22 * open, r * 0.34 * open, 0, 0, Math.PI * 2); s.fill();
    for (let i = 0; i < 7; i++) {
      const t = (i / 6 - 0.5) * 2.2;
      const bx = r * 0.7 + Math.cos(t) * r * 0.3 * open * 0.7, by = Math.sin(t) * r * 0.4 * open;
      const tipx = r * 0.7 + Math.cos(t) * r * 0.1, tipy = Math.sin(t) * r * 0.16;
      s.fillStyle = i % 3 === 0 ? '#fff6e0' : i % 3 === 1 ? '#ffd23a' : '#ff8a1e';
      s.beginPath(); s.moveTo(bx - 2.5, by - 2); s.lineTo(tipx, tipy); s.lineTo(bx + 2.5, by + 2); s.closePath(); s.fill();
    }
    // gumball eyes
    [-1, 1].forEach((side) => {
      const ex = r * 0.34, ey = side * r * 0.36;
      if (withered && side === -1) {            // an empty socket
        s.fillStyle = '#2a0e18'; s.beginPath(); s.arc(ex, ey, r * 0.2, 0, Math.PI * 2); s.fill();
        return;
      }
      s.fillStyle = withered ? '#e8e0dc' : '#ffffff';
      s.beginPath(); s.arc(ex, ey, r * 0.22, 0, Math.PI * 2); s.fill();
      s.strokeStyle = 'rgba(0,0,0,0.3)'; s.lineWidth = 1; s.stroke();
      if (stunned) {                              // dizzy swirl instead of a pupil
        s.strokeStyle = '#1a0a10'; s.lineWidth = 2;
        s.beginPath(); for (let a = 0; a < 9; a += 0.4) { const rr = a * r * 0.017; const px = ex + Math.cos(a + now * 0.01) * rr, py = ey + Math.sin(a + now * 0.01) * rr; if (a === 0) s.moveTo(px, py); else s.lineTo(px, py); } s.stroke();
      } else {
        s.fillStyle = screaming ? '#c01030' : '#1a0a10';
        s.beginPath(); s.arc(ex + r * 0.07, ey, r * 0.11, 0, Math.PI * 2); s.fill();
        s.fillStyle = '#ffffff'; s.beginPath(); s.arc(ex + r * 0.1, ey - r * 0.04, r * 0.035, 0, Math.PI * 2); s.fill();
      }
    });
    s.restore();
    s.restore();
  }

  function drawBoss(g, now) {
    const dying = gameState === 'dying';
    const dp = dying ? clamp((now - deathStartedAt) / (DEATH_FALL_MS + DEATH_DRAG_MS), 0, 1) : 0;
    const stunned = boss.phase === 'stunned' && !dying;
    const screaming = boss.phase === 'scream' && !boss.chasing && !dying;
    const s = bossG;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.clearRect(0, 0, 320, 320);
    s.translate(160, 160);
    drawKrakenParts(s, now, boss.phase2, stunned, screaming);
    // the bites that have been taken out of it
    s.globalCompositeOperation = 'destination-out';
    boss.chunks.forEach((c) => {
      s.beginPath();
      s.arc(Math.cos(c.ang) * boss.radius * 0.94, Math.sin(c.ang) * boss.radius * 0.94, boss.radius * 0.34 * c.size, 0, Math.PI * 2);
      s.fill();
    });
    s.globalCompositeOperation = 'source-over';

    g.save();
    g.translate(boss.x, boss.y);
    if (screaming) g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    if (dying) { g.globalAlpha = 1 - dp; g.scale(1 - dp * 0.5, 1 - dp * 0.5); g.rotate(dp * 0.8); }
    else if (now < boss.frozenUntil) g.globalAlpha = 0.85;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath(); g.ellipse(4, 8, boss.radius * 1.05, boss.radius * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(bossScratch, -160, -160);
    if (now < boss.frozenUntil) {
      g.fillStyle = 'rgba(140,220,255,0.35)'; g.beginPath(); g.arc(0, 0, boss.radius * 1.2, 0, Math.PI * 2); g.fill();
    }
    g.restore();

    if (stunned) {
      // dizzy stars, and a bar counting down the bite window
      for (let i = 0; i < 4; i++) {
        const a = now * 0.005 + (i / 4) * Math.PI * 2;
        const sx = boss.x + Math.cos(a) * boss.radius * 0.9, sy = boss.y - boss.radius * 1.15 + Math.sin(a) * 6;
        g.fillStyle = '#ffe14a'; g.beginPath();
        for (let k = 0; k < 10; k++) { const rr = k % 2 ? 3 : 7, aa = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
        g.closePath(); g.fill();
      }
      const frac = clamp((boss.stunUntil - now) / STUN_DURATION_MS, 0, 1);
      const bw = 70, bx = boss.x - bw / 2, by = boss.y + boss.radius * 1.5;
      g.fillStyle = 'rgba(10,6,10,0.7)'; g.fillRect(bx - 2, by - 2, bw + 4, 9);
      g.fillStyle = '#ffe14a'; g.fillRect(bx, by, bw * frac, 5);
      g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.fillStyle = '#fff';
      g.fillText('BITE IT!', boss.x, by + 22);
    }
  }

  // rings of sound spreading from the boss while it screams
  function drawScreamRings(g, now) {
    if (boss.phase !== 'scream' || boss.chasing || boss.defeated) return;
    const t = clamp((now - boss.phaseStartedAt) / SCREAM_MS, 0, 1);
    for (let i = 0; i < 3; i++) {
      const tt = (t * 1.4 + i * 0.28) % 1;
      g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - tt)})`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(boss.x, boss.y, boss.radius + tt * 150, 0, Math.PI * 2); g.stroke();
    }
  }

