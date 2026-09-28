(function () {
  function ctxFor(id) {
    const c = document.getElementById(id);
    return c ? c.getContext('2d') : null;
  }

  const crawlerCtx = ctxFor('monster-canvas-crawler');
  const drifterCtx = ctxFor('monster-canvas-drifter');
  const caterpillarCtx = ctxFor('monster-canvas-caterpillar');
  const mimicCtx = ctxFor('monster-canvas-mimic');

  function clear(g, w, h) {
    g.clearRect(0, 0, w, h);
  }

  // ---- the realistic eye shared by the Crawler and the Drifter ----
  function drawEye(g, radius, seed, lookDir) {
    const eyeR = radius * 0.62;

    const sclera = g.createRadialGradient(0, 0, 1, 0, 0, eyeR);
    sclera.addColorStop(0, '#f2e6d8');
    sclera.addColorStop(0.75, '#dcc4b2');
    sclera.addColorStop(1, '#7a6252');
    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.fillStyle = sclera;
    g.fill();

    g.save();
    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(170,25,25,0.4)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * eyeR, Math.sin(a) * eyeR * 0.8);
      g.lineTo(Math.cos(a) * eyeR * 0.1, Math.sin(a) * eyeR * 0.1);
      g.stroke();
    }
    g.restore();

    const ix = lookDir.x * eyeR * 0.32, iy = lookDir.y * eyeR * 0.26;
    const irisR = eyeR * 0.48;
    const iris = g.createRadialGradient(ix, iy, 1, ix, iy, irisR);
    iris.addColorStop(0, '#c96a2e');
    iris.addColorStop(0.6, '#7a2f10');
    iris.addColorStop(1, '#200a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

    g.beginPath();
    g.arc(ix, iy, irisR * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#050202';
    g.fill();

    g.beginPath();
    g.arc(ix - irisR * 0.3, iy - irisR * 0.3, irisR * 0.16, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fill();

    g.beginPath();
    g.ellipse(0, 0, eyeR, eyeR * 0.8, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  function drawBlobBody(g, radius, fillColor, shadowColor, seed, t) {
    const points = 10;
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius + Math.sin(t * 0.006 + i * 1.7 + seed) * 4;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = fillColor;
    g.shadowColor = shadowColor;
    g.shadowBlur = 14;
    g.fill();
    g.shadowBlur = 0;
  }

  function drawTentacles(g, radius, color, t, seed, lineWidth) {
    for (let i = 0; i < 3; i++) {
      const baseAngle = (i / 3) * Math.PI * 2 + seed;
      const wobble = Math.sin(t * 0.003 + i * 2.1 + seed) * 8;
      const tx = Math.cos(baseAngle) * (radius + 26), ty = Math.sin(baseAngle) * (radius + 26);
      const midX = tx / 2 + wobble, midY = ty / 2 - wobble;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(midX, midY, tx, ty);
      g.strokeStyle = color;
      g.lineWidth = lineWidth || 4;
      g.lineCap = 'round';
      g.stroke();
    }
  }

  function drawCrawler(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 12;
    drawTentacles(g, 18, '#6a1826', t, seed);
    drawBlobBody(g, 18, '#4a0f1c', '#7a1f2f', seed, t);
    const angle = t * 0.0006;
    drawEye(g, 18, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  function drawDrifter(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 47;
    drawTentacles(g, 24, '#1a6a2e', t, seed);
    drawBlobBody(g, 24, '#0f4a1c', '#2f7a3f', seed, t);
    const angle = -t * 0.0004;
    drawEye(g, 24, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  function drawCaterpillar(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 7, spacing = 13;
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.002 + i * 0.6) * 5;
      const x = -34 + along;
      const y = wob;
      const r = 12 * (1 - i * 0.06);
      g.beginPath();
      g.arc(x, y, Math.max(4, r), 0, Math.PI * 2);
      g.fillStyle = i % 2 === 0 ? '#4a3a1e' : '#5a4726';
      g.shadowColor = '#2a2010';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;
    }
    g.save();
    const headY = Math.sin(t * 0.002) * 5;
    g.translate(-34 + segCount * spacing, headY);
    const points = 10;
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = 12 + Math.sin(t * 0.008 + i * 1.7) * 2.5;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = '#3a2e16';
    g.shadowColor = '#6b5228';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    const angle = t * 0.0005;
    drawEye(g, 12, 88, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // ---- the mimic's disguise, borrowed from the players' own hazmat suit ----
  function drawHazmatFigure(g, R, color) {
    g.fillStyle = '#2b2b28';
    g.beginPath(); g.ellipse(-R * 0.9, -R * 0.35, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-R * 0.9, R * 0.35, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill();

    g.strokeStyle = '#54544c';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-R * 1.3, -3);
    g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
    g.stroke();
    g.fillStyle = '#54544c';
    g.fillRect(-R * 1.5, -4.5, 7, 9);

    g.beginPath();
    g.ellipse(0, 0, R * 1.05, R * 0.95, 0, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1.5;
    g.stroke();

    g.save();
    g.beginPath();
    g.ellipse(0, 0, R * 1.05, R * 0.95, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(20,20,15,0.85)';
    g.fillRect(-R * 1.3, -R * 0.28, R * 2.6, R * 0.2);
    g.fillStyle = 'rgba(255,200,40,0.9)';
    g.fillRect(-R * 1.3, -R * 0.1, R * 2.6, R * 0.1);
    g.restore();

    g.fillStyle = '#e8d94a';
    g.beginPath(); g.arc(-R * 0.15, -R * 0.95, 3.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(-R * 0.15, R * 0.95, 3.4, 0, Math.PI * 2); g.fill();

    g.beginPath();
    g.arc(0, 0, R * 0.8, 0, Math.PI * 2);
    g.strokeStyle = '#1c1c18';
    g.lineWidth = 3;
    g.stroke();

    g.beginPath();
    g.arc(0, 0, R * 0.78, 0, Math.PI * 2);
    g.fillStyle = 'rgba(220,222,210,0.95)';
    g.fill();
    g.strokeStyle = '#1c1c18';
    g.lineWidth = 1.5;
    g.stroke();

    g.beginPath();
    g.ellipse(R * 0.18, 0, R * 0.56, R * 0.44, 0, 0, Math.PI * 2);
    g.fillStyle = '#0d1418';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.ellipse(R * 0.28, -R * 0.14, R * 0.14, R * 0.08, -0.4, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
  }

  function drawMonsterTeeth(g, radius, lookDir) {
    const mouthR = radius * 0.7;
    const angle = Math.atan2(lookDir.y, lookDir.x);
    g.save();
    g.rotate(angle);

    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.fillStyle = '#0a0308';
    g.fill();

    const teeth = 9;
    g.fillStyle = '#e8e2d8';
    for (let i = 0; i < teeth; i++) {
      const a = (i / (teeth - 1)) * Math.PI * 2 - Math.PI;
      const rx = mouthR * 0.85, ry = mouthR * 0.62;
      const bx = mouthR * 0.25 + Math.cos(a) * rx;
      const by = Math.sin(a) * ry;
      const inX = mouthR * 0.25 + Math.cos(a) * rx * 0.45;
      const inY = Math.sin(a) * ry * 0.45;
      const tw = 2.6;
      const nx = -Math.sin(a) * tw, ny = Math.cos(a) * tw;
      g.beginPath();
      g.moveTo(bx + nx, by + ny);
      g.lineTo(bx - nx, by - ny);
      g.lineTo(inX, inY);
      g.closePath();
      g.fill();
    }

    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  function drawMimic(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);

    const cycle = 5000;
    const revealed = (t % cycle) > cycle * 0.55;
    if (!revealed) {
      g.save();
      g.rotate(Math.sin(t * 0.0008) * 0.3);
      drawHazmatFigure(g, 18, '#7c8a72');
      g.restore();
    } else {
      const seed = 30;
      drawTentacles(g, 13, '#3a1f4a', t, seed, 3);
      const points = 10;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = 13 + Math.sin(t * 0.008 + i * 1.7 + seed) * 3;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = '#2a1533';
      g.shadowColor = '#5a2a6e';
      g.shadowBlur = 12;
      g.fill();
      g.shadowBlur = 0;
      const angle = t * 0.003;
      drawMonsterTeeth(g, 13, { x: Math.cos(angle), y: Math.sin(angle) });
    }
    g.restore();
  }

  function loop(t) {
    if (crawlerCtx) drawCrawler(crawlerCtx, 120, 120, t);
    if (drifterCtx) drawDrifter(drifterCtx, 120, 120, t);
    if (caterpillarCtx) drawCaterpillar(caterpillarCtx, 120, 120, t);
    if (mimicCtx) drawMimic(mimicCtx, 120, 120, t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
