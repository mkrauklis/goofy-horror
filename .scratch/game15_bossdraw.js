  // ---- the boss: the Mutation, grown huge and partly frozen ----

  // A fleshy, lit blob body -- ported from Level 12's mutation, unchanged.
  function drawBlobBody(g, radius, fillColor, shadowColor, seed, t, opts) {
    opts = opts || {};
    const points = 14;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius
        + Math.sin(t * 0.006 + i * 1.7 + seed) * radius * 0.1
        + Math.sin(t * 0.0021 + i * 3.3 + seed * 1.7) * radius * 0.04;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const base = g.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.1, 0, 0, radius * 1.05);
    base.addColorStop(0, opts.core || shade(fillColor, 0.22));
    base.addColorStop(0.55, fillColor);
    base.addColorStop(1, opts.rim || shade(fillColor, -0.35));
    g.fillStyle = base;
    g.shadowColor = shadowColor;
    g.shadowBlur = Math.min(radius * 0.4, 18);
    g.fill();
    g.shadowBlur = 0;

    g.save();
    trace();
    g.clip();

    g.beginPath();
    g.ellipse(-radius * 0.32, -radius * 0.38, radius * 0.5, radius * 0.32, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fill();

    g.strokeStyle = opts.veinColor || 'rgba(0,0,0,0.2)';
    g.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * radius * 0.15, Math.sin(a) * radius * 0.15);
      g.lineTo(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88);
      g.stroke();
    }

    g.restore();
  }

  // The mutation's single eye -- ported from Level 12, unchanged.
  function drawMonsterEye(g, m) {
    const lookDir = m.lookDir;
    const ex = m.radius * 0.62, ey = ex * 0.8;

    g.save();
    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.clip();

    const sclera = g.createRadialGradient(-ex * 0.2, -ey * 0.25, 1, 0, 0, ex * 1.15);
    sclera.addColorStop(0, '#faf1e4');
    sclera.addColorStop(0.55, '#dcc4b2');
    sclera.addColorStop(1, '#6b5142');
    g.fillStyle = sclera;
    g.fillRect(-ex, -ey, ex * 2, ey * 2);

    g.strokeStyle = 'rgba(170,25,25,0.38)';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.15 + m.seed;
      g.lineWidth = 0.5 + ((i * 13) % 3) * 0.35;
      g.beginPath();
      g.moveTo(Math.cos(a) * ex, Math.sin(a) * ey);
      g.quadraticCurveTo(Math.cos(a + 0.1) * ex * 0.5, Math.sin(a - 0.1) * ey * 0.5, Math.cos(a) * ex * 0.08, Math.sin(a) * ey * 0.08);
      g.stroke();
    }

    const ix = lookDir.x * ex * 0.32, iy = lookDir.y * ey * 0.32;
    const irisR = ex * 0.48;
    const iris = g.createRadialGradient(ix - irisR * 0.22, iy - irisR * 0.22, 1, ix, iy, irisR);
    iris.addColorStop(0, '#e8903f');
    iris.addColorStop(0.45, '#c96a2e');
    iris.addColorStop(0.8, '#7a2f10');
    iris.addColorStop(1, '#200a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

    g.save();
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + m.seed * 0.3;
      g.beginPath();
      g.moveTo(ix + Math.cos(a) * irisR * 0.35, iy + Math.sin(a) * irisR * 0.35);
      g.lineTo(ix + Math.cos(a) * irisR, iy + Math.sin(a) * irisR);
      g.stroke();
    }
    g.restore();

    g.beginPath();
    g.arc(ix, iy, irisR * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#050202';
    g.fill();

    g.beginPath();
    g.arc(ix - irisR * 0.32, iy - irisR * 0.32, irisR * 0.22, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fill();
    g.beginPath();
    g.arc(ix - irisR * 0.28, iy - irisR * 0.3, irisR * 0.11, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fill();

    g.beginPath();
    g.ellipse(0, -ey * 0.32, ex * 0.98, ey * 0.6, 0, Math.PI, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fill();

    g.restore();

    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  // "Partly frozen": a handful of icicle shards clinging to the lower
  // half of the body, same tapered-shard technique as every other icicle
  // on this site -- only the bottom arc, not the whole silhouette, so it
  // still reads as a mutation that's half-iced-over rather than a
  // different creature entirely.
  const FROST_ANCHORS = (() => {
    const anchors = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.7; // bottom arc only
      anchors.push({ angle: a, len: 0.3 + (i % 3) * 0.08 });
    }
    return anchors;
  })();

  function drawFrostPatches(g, radius) {
    FROST_ANCHORS.forEach((f) => {
      const ax = Math.cos(f.angle) * radius * 0.92, ay = Math.sin(f.angle) * radius * 0.92;
      const len = radius * f.len;
      const nx = Math.cos(f.angle), ny = Math.sin(f.angle);
      const px = -ny, py = nx;
      g.beginPath();
      g.moveTo(ax + px * radius * 0.08, ay + py * radius * 0.08);
      g.lineTo(ax - px * radius * 0.08, ay - py * radius * 0.08);
      g.lineTo(ax + nx * len, ay + ny * len);
      g.closePath();
      const grad = g.createLinearGradient(ax, ay, ax + nx * len, ay + ny * len);
      grad.addColorStop(0, 'rgba(210,240,255,0.7)');
      grad.addColorStop(1, 'rgba(170,220,250,0.25)');
      g.fillStyle = grad;
      g.fill();
    });
    g.beginPath();
    g.ellipse(0, radius * 0.45, radius * 0.85, radius * 0.4, 0, 0, Math.PI);
    g.fillStyle = 'rgba(200,235,255,0.18)';
    g.fill();
  }

  function drawMutationBoss(g, t) {
    const r = boss.radius;
    const sideR = r * 0.6;

    [-1, 1].forEach((side) => {
      const tx = side * r * 0.9, ty = r * 0.5;
      const wobble = Math.sin(t * 0.004 + side) * r * 0.1;
      drawTaperedTentacle(g, tx, ty + wobble, tx * 0.5, (ty + wobble) * 0.5, r * 0.16, '#4a1a6a');
    });

    [-1, 1].forEach((side) => {
      g.save();
      g.translate(side * r * 0.7, r * 0.35);
      drawBlobBody(g, sideR, '#6a2a8a', '#3a1452', boss.seed + side * 7, t);
      g.restore();
    });

    drawBlobBody(g, r, '#7a3a9a', '#3a1452', boss.seed, t);

    drawMonsterEye(g, boss);
    g.save();
    g.translate(-r * 0.7, r * 0.35);
    drawMonsterEye(g, { radius: sideR, lookDir: boss.lookDir, seed: boss.seed + 3 });
    g.restore();

    drawFrostPatches(g, r);
  }

  function drawExpandHazard(g, t) {
    if (boss.expandSubPhase !== 'growing' || boss.expandRadius <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
    g.beginPath();
    g.arc(0, 0, boss.expandRadius, 0, Math.PI * 2);
    g.fillStyle = `rgba(154,74,201,${0.12 + pulse * 0.08})`;
    g.fill();
    g.strokeStyle = `rgba(220,180,255,${0.4 + pulse * 0.3})`;
    g.lineWidth = 3;
    g.stroke();
  }

  function drawBoss(g, t) {
    if (boss.phase === 'split') return; // the clones stand in for it

    g.save();
    g.translate(boss.x, boss.y);

    if (boss.phase === 'expand') drawExpandHazard(g, t);

    if (!boss.defeated) drawMutationBoss(g, t);
    else {
      g.save();
      g.globalAlpha = 0.6;
      drawMutationBoss(g, t);
      g.restore();
    }

    if (gameState === 'freezing') {
      const freezeT = clamp((t - freezeStartedAt) / FREEZE_CUTSCENE_MS, 0, 1);
      drawIcicles(g, freezeT, boss.radius);
    }

    if (t < boss.frozenUntil) {
      const points = 14;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = boss.radius + 6;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(140,220,255,0.4)';
      g.fill();
      g.strokeStyle = 'rgba(220,250,255,0.75)';
      g.lineWidth = 2;
      g.stroke();
    }

    g.restore();
  }
