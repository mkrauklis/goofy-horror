(function () {
  function ctxFor(id) {
    const c = document.getElementById(id);
    return c ? c.getContext('2d') : null;
  }

  const crawlerCtx = ctxFor('monster-canvas-crawler');
  const drifterCtx = ctxFor('monster-canvas-drifter');
  const caterpillarCtx = ctxFor('monster-canvas-caterpillar');
  const mimicCtx = ctxFor('monster-canvas-mimic');
  const lurkerCtx = ctxFor('monster-canvas-lurker');
  const bossCtx = ctxFor('monster-canvas-boss');
  const knightCtx = ctxFor('monster-canvas-knight');
  const wingedCtx = ctxFor('monster-canvas-winged');
  const PORTRAIT = 160;

  function clear(g, w, h) {
    g.clearRect(0, 0, w, h);
  }

  // Shifts a '#rrggbb' color toward white (amt > 0) or black (amt < 0) --
  // used everywhere below instead of hand-picking a second/third shade of
  // every color, so a highlight or shadow always tracks the base tone.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) + 255 * amt);
    const g2 = clamp(((n >> 8) & 255) + 255 * amt);
    const b = clamp((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  // ---- the realistic eye shared by the Crawler, Drifter, Caterpillar and
  // the boss -- a proper eyeball with volume (offset gradient instead of a
  // flat radial fill), an eyelid shadow to seat it in a socket, fibered
  // iris, and a double wet highlight instead of one flat white dot.
  function drawEye(g, radius, seed, lookDir, opts) {
    opts = opts || {};
    const ex = radius * 0.62, ey = ex * 0.8;

    g.save();
    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.clip();

    const sclera = g.createRadialGradient(-ex * 0.2, -ey * 0.25, 1, 0, 0, ex * 1.15);
    sclera.addColorStop(0, opts.scleraHi || '#faf1e4');
    sclera.addColorStop(0.55, opts.scleraMid || '#dcc4b2');
    sclera.addColorStop(1, opts.scleraEdge || '#6b5142');
    g.fillStyle = sclera;
    g.fillRect(-ex, -ey, ex * 2, ey * 2);

    g.strokeStyle = opts.veinColor || 'rgba(170,25,25,0.38)';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.15 + seed;
      g.lineWidth = 0.5 + ((i * 13) % 3) * 0.35;
      g.beginPath();
      g.moveTo(Math.cos(a) * ex, Math.sin(a) * ey);
      g.quadraticCurveTo(Math.cos(a + 0.1) * ex * 0.5, Math.sin(a - 0.1) * ey * 0.5, Math.cos(a) * ex * 0.08, Math.sin(a) * ey * 0.08);
      g.stroke();
    }

    const ix = lookDir.x * ex * 0.32, iy = lookDir.y * ey * 0.32;
    const irisR = ex * 0.48;
    const iris = g.createRadialGradient(ix - irisR * 0.22, iy - irisR * 0.22, 1, ix, iy, irisR);
    iris.addColorStop(0, opts.irisHi || '#e8903f');
    iris.addColorStop(0.45, opts.irisMid || '#c96a2e');
    iris.addColorStop(0.8, opts.irisEdge || '#7a2f10');
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
      const a = (i / 6) * Math.PI * 2 + seed * 0.3;
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

  // ---- a fleshy, lit blob body: irregular two-octave silhouette, an
  // offset gradient for volume, one soft specular highlight and a couple of
  // veins, all clipped to the silhouette. Kept intentionally light -- this
  // runs once per monster per frame, and several monsters can be on screen
  // (or, in the Monsterpedia, animating at once) at the same time.
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

  // A single tapered, suckered tentacle from (0,0) to (tx,ty) bowing through
  // (midX,midY) -- thick at the root, thin at the tip, instead of a single
  // uniform-width stroke. Segment count is kept low for the same reason as
  // drawBlobBody above.
  function drawTaperedTentacle(g, tx, ty, midX, midY, baseWidth, color) {
    const segs = 4;
    let prevX = 0, prevY = 0;
    for (let s = 1; s <= segs; s++) {
      const tt = s / segs;
      const it = 1 - tt;
      const x = 2 * it * tt * midX + tt * tt * tx;
      const y = 2 * it * tt * midY + tt * tt * ty;
      g.beginPath();
      g.moveTo(prevX, prevY);
      g.lineTo(x, y);
      g.strokeStyle = color;
      g.lineWidth = Math.max(0.6, baseWidth * (1 - tt * 0.75));
      g.lineCap = 'round';
      g.stroke();
      prevX = x; prevY = y;
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    [0.55, 0.82].forEach((s) => {
      const it = 1 - s;
      const x = 2 * it * s * midX + s * s * tx;
      const y = 2 * it * s * midY + s * s * ty;
      g.beginPath();
      g.arc(x, y, baseWidth * 0.16, 0, Math.PI * 2);
      g.fill();
    });
  }

  // A single limb (arm/leg): a thick rounded stroke from (hipX,hipY) to
  // (tipX,tipY) with a small cap circle (boot/glove) at the moving end --
  // used by the hazmat figure's walk cycle, distinct from the radiating
  // drawTaperedTentacle above (which always starts at the origin).
  function drawStubLimb(g, hipX, hipY, tipX, tipY, width, color, capColor, capR) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(tipX, tipY);
    g.stroke();
    g.beginPath();
    g.arc(tipX, tipY, capR, 0, Math.PI * 2);
    g.fillStyle = capColor;
    g.fill();
  }

  function drawTentacles(g, radius, color, t, seed, lineWidth, count) {
    const n = count || 3;
    for (let i = 0; i < n; i++) {
      const baseAngle = (i / n) * Math.PI * 2 + seed;
      const len = radius + radius * 1.05;
      const wobble = Math.sin(t * 0.003 + i * 2.1 + seed) * radius * 0.3;
      const tx = Math.cos(baseAngle) * len, ty = Math.sin(baseAngle) * len;
      const perp = baseAngle + Math.PI / 2;
      const midX = tx / 2 + Math.cos(perp) * wobble, midY = ty / 2 + Math.sin(perp) * wobble;
      drawTaperedTentacle(g, tx, ty, midX, midY, lineWidth || radius * 0.17, color);
    }
  }

  function drawCrawler(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 12;
    drawTentacles(g, 24, '#6a1826', t, seed);
    drawBlobBody(g, 24, '#4a0f1c', '#7a1f2f', seed, t);
    const angle = t * 0.0006;
    drawEye(g, 24, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  function drawDrifter(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 47;
    drawTentacles(g, 32, '#1a6a2e', t, seed);
    drawBlobBody(g, 32, '#0f4a1c', '#2f7a3f', seed, t);
    const angle = -t * 0.0004;
    drawEye(g, 32, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  function drawCaterpillar(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 7, spacing = 17;

    // ground shadow trail, drawn before the segments so it sits underneath
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.002 + i * 0.6) * 6;
      g.beginPath();
      g.ellipse(-46 + along, wob + 6, 13 * (1 - i * 0.06), 4, 0, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.002 + i * 0.6) * 6;
      const x = -46 + along;
      const y = wob;
      const r = Math.max(5, 15 * (1 - i * 0.06));
      const base = i % 2 === 0 ? '#4a3a1e' : '#5a4726';
      const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
      grad.addColorStop(0, shade(base, 0.28));
      grad.addColorStop(0.6, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#2a2010';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;

      // a pair of stubby legs per segment
      g.strokeStyle = 'rgba(20,14,6,0.6)';
      g.lineWidth = 1.6;
      [-1, 1].forEach((side) => {
        g.beginPath();
        g.moveTo(x, y + side * r * 0.7);
        g.lineTo(x - 2, y + side * (r * 0.7 + 4));
        g.stroke();
      });
    }
    g.save();
    const headY = Math.sin(t * 0.002) * 6;
    g.translate(-46 + segCount * spacing, headY);
    const points = 12;
    const headPath = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = 15 + Math.sin(t * 0.008 + i * 1.7) * 3;
      headPath.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    headPath.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
    g.closePath();
    const headGrad = g.createRadialGradient(-6, -7, 1, 0, 0, 16);
    headGrad.addColorStop(0, shade('#3a2e16', 0.3));
    headGrad.addColorStop(0.6, '#3a2e16');
    headGrad.addColorStop(1, shade('#3a2e16', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#6b5228';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    const angle = t * 0.0005;
    drawEye(g, 15, 88, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // ---- the mimic's disguise, borrowed from the players' own hazmat suit --
  // shared with drawPlayers-style rendering in the level files: a gradient
  // suit body, a glassy gradient helmet, animated limbs and a soft ground
  // shadow. walkPhase drives the same swinging-limb walk cycle the level
  // files use, so the preview reads as a person actually walking.
  function drawHazmatFigure(g, R, color, walkPhase) {
    walkPhase = walkPhase || 0;
    const swing = Math.sin(walkPhase) * R * 0.62;
    const bob = Math.abs(Math.cos(walkPhase)) * R * 0.05;
    const suitDark = shade(color, -0.45);
    const bootColor = '#2b2b28';

    g.beginPath();
    g.ellipse(0, R * 1.05, R * 0.85, R * 0.24, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fill();

    drawStubLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
    drawStubLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);

    const tankGrad = g.createLinearGradient(-R * 1.5, -8, -R * 1.5, 6);
    tankGrad.addColorStop(0, shade('#54544c', 0.25));
    tankGrad.addColorStop(1, shade('#54544c', -0.25));
    g.strokeStyle = '#54544c';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-R * 1.3, -3);
    g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
    g.stroke();
    g.fillStyle = tankGrad;
    g.fillRect(-R * 1.5, -4.5, 7, 9);

    g.save();
    g.translate(0, -bob);
    const bodyGrad = g.createRadialGradient(-R * 0.32, -R * 0.4, 1, 0, 0, R * 1.1);
    bodyGrad.addColorStop(0, shade(color, 0.25));
    bodyGrad.addColorStop(0.6, color);
    bodyGrad.addColorStop(1, shade(color, -0.35));
    g.beginPath();
    g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
    g.fillStyle = bodyGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1.5;
    g.stroke();

    g.save();
    g.beginPath();
    g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(20,20,15,0.85)';
    g.fillRect(-R * 1.1, -R * 0.24, R * 2.2, R * 0.17);
    g.fillStyle = 'rgba(255,200,40,0.9)';
    g.fillRect(-R * 1.1, -R * 0.08, R * 2.2, R * 0.09);
    const rim = g.createRadialGradient(-R * 0.4, -R * 0.5, 1, -R * 0.4, -R * 0.5, R * 1.1);
    rim.addColorStop(0, 'rgba(255,255,255,0.22)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rim;
    g.fillRect(-R * 1.1, -R * 1.1, R * 2.2, R * 2.2);
    g.restore();
    g.restore();

    drawStubLimb(g, 0, -R * 0.55, -swing * 0.8, -R * 0.55, R * 0.24, color, '#e8d94a', R * 0.22);
    drawStubLimb(g, 0, R * 0.55, swing * 0.8, R * 0.55, R * 0.24, color, '#e8d94a', R * 0.22);

    g.save();
    g.translate(R * 0.55, -bob);
    const headR = R * 0.5;

    g.beginPath();
    g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
    g.strokeStyle = '#1c1c18';
    g.lineWidth = 2.5;
    g.stroke();

    const helmetGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.35, 1, 0, 0, headR * 1.05);
    helmetGrad.addColorStop(0, '#ffffff');
    helmetGrad.addColorStop(0.35, 'rgba(224,226,216,0.95)');
    helmetGrad.addColorStop(1, 'rgba(150,155,146,0.92)');
    g.beginPath();
    g.arc(0, 0, headR, 0, Math.PI * 2);
    g.fillStyle = helmetGrad;
    g.fill();
    g.strokeStyle = '#1c1c18';
    g.lineWidth = 1.5;
    g.stroke();

    const visorGrad = g.createLinearGradient(0, -headR * 0.3, 0, headR * 0.3);
    visorGrad.addColorStop(0, '#1c2a33');
    visorGrad.addColorStop(1, '#03060a');
    g.beginPath();
    g.ellipse(headR * 0.32, 0, headR * 0.34, headR * 0.62, 0, 0, Math.PI * 2);
    g.fillStyle = visorGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.moveTo(headR * 0.18, -headR * 0.4);
    g.lineTo(headR * 0.42, -headR * 0.15);
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = headR * 0.12;
    g.lineCap = 'round';
    g.stroke();

    g.restore();
  }

  function drawMonsterTeeth(g, radius, lookDir) {
    const mouthR = radius * 0.7;
    const angle = Math.atan2(lookDir.y, lookDir.x);
    g.save();
    g.rotate(angle);

    const mouthGrad = g.createRadialGradient(mouthR * 0.25, 0, 1, mouthR * 0.25, 0, mouthR * 0.9);
    mouthGrad.addColorStop(0, '#180810');
    mouthGrad.addColorStop(1, '#000000');
    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.fillStyle = mouthGrad;
    g.fill();

    // a wet tongue-like glint at the back of the throat
    g.beginPath();
    g.ellipse(mouthR * 0.55, 0, mouthR * 0.25, mouthR * 0.16, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(120,20,30,0.5)';
    g.fill();

    const teeth = 9;
    for (let i = 0; i < teeth; i++) {
      const a = (i / (teeth - 1)) * Math.PI * 2 - Math.PI;
      const rx = mouthR * 0.85, ry = mouthR * 0.62;
      const bx = mouthR * 0.25 + Math.cos(a) * rx;
      const by = Math.sin(a) * ry;
      const inX = mouthR * 0.25 + Math.cos(a) * rx * 0.45;
      const inY = Math.sin(a) * ry * 0.45;
      const tw = 2.6;
      const nx = -Math.sin(a) * tw, ny = Math.cos(a) * tw;
      const toothGrad = g.createLinearGradient(bx, by, inX, inY);
      toothGrad.addColorStop(0, '#ffffff');
      toothGrad.addColorStop(1, '#c9c0b0');
      g.beginPath();
      g.moveTo(bx + nx, by + ny);
      g.lineTo(bx - nx, by - ny);
      g.lineTo(inX, inY);
      g.closePath();
      g.fillStyle = toothGrad;
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
      drawHazmatFigure(g, 24, '#7c8a72', t * 0.006);
      g.restore();
    } else {
      const seed = 30;
      drawTentacles(g, 17, '#3a1f4a', t, seed, 3);
      drawBlobBody(g, 17, '#2a1533', '#5a2a6e', seed, t, { veinColor: 'rgba(160,63,214,0.3)' });
      const angle = t * 0.003;
      drawMonsterTeeth(g, 17, { x: Math.cos(angle), y: Math.sin(angle) });
    }
    g.restore();
  }

  // The crate lurker: a small purple tentacle ambusher, always "revealed"
  // since it has no disguise to keep up -- just a faint idle wobble.
  function drawLurker(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 61;
    drawTentacles(g, 15, '#3a1f4a', t, seed, 2.5);
    drawBlobBody(g, 15, '#3a1550', '#a03fd6', seed, t, { veinColor: 'rgba(160,63,214,0.35)' });
    const angle = t * 0.004;
    drawMonsterTeeth(g, 15, { x: Math.cos(angle), y: Math.sin(angle) });
    g.restore();
  }

  // The Level 5 boss: a Crawler burnt black and set on fire, blown up far
  // past what fits a 160px portrait at true scale -- radius is picked to
  // read as "the biggest thing in this book," not a literal 8x Crawler.
  function drawBossTentacles(g, radius, t, seed) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const baseAngle = (i / n) * Math.PI * 2 + seed;
      const len = radius + radius * 1.05;
      const wobble = Math.sin(t * 0.0017 + i * 1.6 + seed) * radius * 0.32;
      const tx = Math.cos(baseAngle) * len, ty = Math.sin(baseAngle) * len;
      const perp = baseAngle + Math.PI / 2;
      const midX = tx / 2 + Math.cos(perp) * wobble, midY = ty / 2 + Math.sin(perp) * wobble;
      const color = i % 3 === 0 ? '#2a0c06' : '#6a1826';
      drawTaperedTentacle(g, tx, ty, midX, midY, radius * 0.14, color);
    }
  }

  function drawBossFlames(g, radius, t, seed) {
    const spots = 3;
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2 + seed * 0.1;
      const bx = Math.cos(a) * radius * 0.92, by = Math.sin(a) * radius * 0.92;
      const flicker = 0.8 + Math.sin(t * 0.02 + i * 3.1 + seed) * 0.2;
      g.save();
      g.translate(bx, by);
      g.rotate(a - Math.PI / 2);
      for (let j = 0; j < 2; j++) {
        const h = radius * (0.45 + j * 0.18) * flicker;
        g.beginPath();
        g.moveTo(-4 + j * 3, 4);
        g.quadraticCurveTo(3, -h * 0.55, 0, -h);
        g.quadraticCurveTo(-3, -h * 0.55, 4 - j * 3, 4);
        g.closePath();
        g.fillStyle = j === 0 ? '#ff9c3d' : '#ffe38a';
        g.fill();
      }
      g.restore();
    }
  }

  function drawBoss(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 74, radius = 50;
    drawBossTentacles(g, radius, t, seed);
    drawBlobBody(g, radius, '#4a0f0a', '#ff6a2a', seed, t, { rim: '#100302', veinColor: 'rgba(255,120,40,0.28)' });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      const cx = Math.cos(a) * radius * 0.4, cy = Math.sin(a) * radius * 0.4;
      g.beginPath();
      g.arc(cx, cy, radius * 0.24, 0, Math.PI * 2);
      g.fillStyle = 'rgba(10,6,6,0.55)';
      g.fill();
    }
    drawBossFlames(g, radius, t, seed);
    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 }, { irisHi: '#ffb43d', irisMid: '#c96a2e', irisEdge: '#7a2f10' });
    g.restore();
  }

  // The Level 6 Knight: the same Crawler blob, but in riveted plate armor
  // with a banded helm-ring over the eye (not covering it -- the eye is
  // still the actual gameplay tell) and a sword held out to one side.
  // Kept pixel-for-pixel identical to game6.js's own drawKnightGear so this
  // page is a genuine preview, not a redrawn approximation.
  function drawKnightGear(g, radius, t, seed) {
    g.save();
    g.rotate(Math.sin(t * 0.0015 + seed) * 0.1);

    const plate = '#7d828c';
    const plateShade = '#4a4d54';
    [-0.55, 0, 0.55].forEach((a) => {
      const px = Math.cos(a) * radius * 0.55, py = Math.sin(a) * radius * 0.55;
      g.save();
      g.translate(px, py);
      g.rotate(a);
      const grad = g.createLinearGradient(-radius * 0.3, 0, radius * 0.3, 0);
      grad.addColorStop(0, plateShade);
      grad.addColorStop(0.5, plate);
      grad.addColorStop(1, plateShade);
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, radius * 0.32, radius * 0.22, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(15,15,18,0.6)';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    });

    g.beginPath();
    g.arc(0, -radius * 0.05, radius * 1.05, -0.85 - Math.PI / 2, 0.85 - Math.PI / 2);
    g.strokeStyle = plate;
    g.lineWidth = radius * 0.2;
    g.lineCap = 'round';
    g.stroke();
    g.restore();

    g.save();
    g.rotate(0.7);
    const reach = radius * 0.85;
    g.strokeStyle = '#4a3216';
    g.lineWidth = radius * 0.16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(reach * 0.55, 0);
    g.lineTo(reach, 0);
    g.stroke();
    g.strokeStyle = '#8a6a2a';
    g.lineWidth = radius * 0.14;
    g.beginPath();
    g.moveTo(reach, -radius * 0.3);
    g.lineTo(reach, radius * 0.3);
    g.stroke();
    g.strokeStyle = '#c9ccd4';
    g.lineWidth = radius * 0.1;
    g.beginPath();
    g.moveTo(reach, 0);
    g.lineTo(reach + radius * 2, 0);
    g.stroke();
    g.restore();
  }

  function drawKnight(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 53;
    drawTentacles(g, 24, '#6a1826', t, seed);
    drawBlobBody(g, 24, '#4a0f1c', '#7a1f2f', seed, t);
    const angle = t * 0.0006;
    drawEye(g, 24, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    drawKnightGear(g, 24, t, seed);
    g.restore();
  }

  // The Level 7 creature: grey, mouth instead of an eye, tentacles 2.5x the
  // normal base width, and a pair of angular stone wings -- kept pixel-for-
  // pixel identical to game7.js's own drawStoneWings/drawMonster so this
  // page is a genuine preview, not a redrawn approximation.
  function drawStoneWings(g, radius, t, seed) {
    const sway = Math.sin(t * 0.0009 + seed) * 0.05;
    [-1, 1].forEach((side) => {
      g.save();
      g.rotate(side * (0.5 + sway));
      const span = radius * 1.9, reach = radius * 1.1;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(side * reach * 0.4, -span * 0.35);
      g.lineTo(side * reach * 0.85, -span * 0.62);
      g.lineTo(side * reach, -span * 0.3);
      g.lineTo(side * reach * 0.6, 0);
      g.lineTo(side * reach * 0.8, span * 0.22);
      g.lineTo(side * reach * 0.3, span * 0.1);
      g.closePath();
      const grad = g.createLinearGradient(0, -span * 0.6, 0, span * 0.2);
      grad.addColorStop(0, '#8a8d93');
      grad.addColorStop(0.5, '#5d6066');
      grad.addColorStop(1, '#35373c');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(side * reach * 0.85, -span * 0.62);
      g.moveTo(side * reach * 0.4, -span * 0.35);
      g.lineTo(side * reach * 0.6, 0);
      g.stroke();
      g.restore();
    });
  }

  function drawWinged(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 91, radius = 24;
    drawStoneWings(g, radius, t, seed);
    drawTentacles(g, radius, '#45484e', t, seed, radius * 0.55);
    drawBlobBody(g, radius, '#55585f', '#7a7e86', seed, t, { veinColor: 'rgba(0,0,0,0.3)' });
    const angle = t * 0.0006;
    drawMonsterTeeth(g, radius, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  // This page redraws eight fully-detailed monster portraits at once, so it
  // caps itself around 30fps instead of riding requestAnimationFrame's full
  // 60 -- plenty smooth for a reference gallery nobody is dodging, and it
  // halves the cost of a page that (unlike any single level) never has
  // fewer than eight creatures on screen simultaneously.
  let lastDraw = 0;
  function loop(t) {
    if (t - lastDraw >= 33) {
      lastDraw = t;
      if (crawlerCtx) drawCrawler(crawlerCtx, PORTRAIT, PORTRAIT, t);
      if (drifterCtx) drawDrifter(drifterCtx, PORTRAIT, PORTRAIT, t);
      if (caterpillarCtx) drawCaterpillar(caterpillarCtx, PORTRAIT, PORTRAIT, t);
      if (mimicCtx) drawMimic(mimicCtx, PORTRAIT, PORTRAIT, t);
      if (lurkerCtx) drawLurker(lurkerCtx, PORTRAIT, PORTRAIT, t);
      if (bossCtx) drawBoss(bossCtx, PORTRAIT, PORTRAIT, t);
      if (knightCtx) drawKnight(knightCtx, PORTRAIT, PORTRAIT, t);
      if (wingedCtx) drawWinged(wingedCtx, PORTRAIT, PORTRAIT, t);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
