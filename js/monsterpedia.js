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
  const vaultGuardCtx = ctxFor('monster-canvas-vaultguard');
  const wraithCtx = ctxFor('monster-canvas-wraith');
  const digWormCtx = ctxFor('monster-canvas-digworm');
  const lastKnightCtx = ctxFor('monster-canvas-lastknight');
  const frostCtx = ctxFor('monster-canvas-frost');
  const mutationCtx = ctxFor('monster-canvas-mutation');
  const broodCtx = ctxFor('monster-canvas-brood');
  const thawSpiderCtx = ctxFor('monster-canvas-thawspider');
  const frozenMutationCtx = ctxFor('monster-canvas-frozenmutation');
  const eelCtx = ctxFor('monster-canvas-eel');
  const currentEelCtx = ctxFor('monster-canvas-currenteel');
  const greatEelCtx = ctxFor('monster-canvas-greateel');
  const tinyEelsCtx = ctxFor('monster-canvas-tinyeels');
  const cisternCtx = ctxFor('monster-canvas-cistern');
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
  function drawBossTentacles(g, radius, t, seed, colors) {
    const n = 5;
    const cols = colors || ['#2a0c06', '#6a1826'];
    for (let i = 0; i < n; i++) {
      const baseAngle = (i / n) * Math.PI * 2 + seed;
      const len = radius + radius * 1.05;
      const wobble = Math.sin(t * 0.0017 + i * 1.6 + seed) * radius * 0.32;
      const tx = Math.cos(baseAngle) * len, ty = Math.sin(baseAngle) * len;
      const perp = baseAngle + Math.PI / 2;
      const midX = tx / 2 + Math.cos(perp) * wobble, midY = ty / 2 + Math.sin(perp) * wobble;
      const color = i % 3 === 0 ? cols[0] : cols[1];
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

  // Armor plates and helm-ring only, no sword -- the Vault Guardian is
  // armored, not armed. Ported from drawKnightGear minus its weapon half.
  function drawArmorPlates(g, radius, t, seed) {
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
  }

  // Pale green, 4x Level 1's Crawler, armored -- drawn at a bigger radius
  // than the other portraits so the scale difference reads even in a
  // uniform 160px frame.
  function drawVaultGuardian(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 67, radius = 34;
    // Same reach as drawBossTentacles above (radius*2.05) -- as long as
    // the Ashen One's, not the short wall-adjacency kind.
    drawBossTentacles(g, radius, t, seed, ['#0f2a16', '#1a4a26']);
    drawBlobBody(g, radius, '#2f6a3a', '#1a4020', seed, t, { veinColor: 'rgba(0,0,0,0.25)' });
    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    drawArmorPlates(g, radius, t, seed);
    g.restore();
  }

  // Player-sized, tinted solid black or white, swinging a chained ball
  // around itself -- pixel-for-pixel the same draw code as game8.js's own
  // drawWraith, just with an explicit radius/seed/tint instead of reading
  // them off a live monster object.
  function drawWraith(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 41, radius = 22, tint = '#e8e8e8', flailAngle = 1.1;

    const n = 4;
    const tentColor = shade(tint, -0.3);
    for (let i = 0; i < n; i++) {
      const baseAngle = (i / n) * Math.PI * 2 + seed;
      const len = radius * 1.6;
      const wobble = Math.sin(t * 0.006 + i * 2.3 + seed) * radius * 0.3;
      const tx = Math.cos(baseAngle) * len, ty = Math.sin(baseAngle) * len;
      const perp = baseAngle + Math.PI / 2;
      const midX = tx / 2 + Math.cos(perp) * wobble, midY = ty / 2 + Math.sin(perp) * wobble;
      drawTaperedTentacle(g, tx, ty, midX, midY, radius * 0.22, tentColor);
    }

    drawBlobBody(g, radius, tint, '#ffffff', seed, t, { veinColor: 'rgba(0,0,0,0.15)' });
    const angle0 = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle0), y: Math.sin(angle0) * 0.5 });

    const angle = t * 0.0025 + flailAngle;
    const chainLen = radius * 2.4;
    const bx = Math.cos(angle) * chainLen, by = Math.sin(angle) * chainLen;
    g.strokeStyle = '#6a6a6a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, 0);
    const links = 5;
    for (let i = 1; i <= links; i++) {
      const lt = i / links;
      const wob = Math.sin(t * 0.01 + i) * 1.2;
      const perp = angle + Math.PI / 2;
      g.lineTo(bx * lt + Math.cos(perp) * wob, by * lt + Math.sin(perp) * wob);
    }
    g.stroke();

    const ballR = radius * 0.45;
    const ballGrad = g.createRadialGradient(bx - ballR * 0.3, by - ballR * 0.3, 1, bx, by, ballR);
    ballGrad.addColorStop(0, '#9a9a9a');
    ballGrad.addColorStop(1, '#3a3a3a');
    g.beginPath();
    g.arc(bx, by, ballR, 0, Math.PI * 2);
    g.fillStyle = ballGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#1c1c1c';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(bx + Math.cos(a) * ballR * 0.7, by + Math.sin(a) * ballR * 0.7, ballR * 0.2, 0, Math.PI * 2);
      g.fill();
    }
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

  // The Level 9 creature: a pale, armor-plated cousin of the Level 3
  // Caterpillar -- thicker, longer (more segments, wider spacing), riveted
  // metal strapped across every segment via the same drawSegmentArmor used
  // by game9.js, and a mouth instead of an eye on the head.
  function drawSegmentArmor(g, r) {
    const plate = '#7d828c';
    const plateShade = '#4a4d54';
    const grad = g.createLinearGradient(-r * 0.8, 0, r * 0.8, 0);
    grad.addColorStop(0, plateShade);
    grad.addColorStop(0.5, plate);
    grad.addColorStop(1, plateShade);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, -r * 0.1, r * 0.82, r * 0.5, 0, Math.PI, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(15,15,18,0.6)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = 'rgba(20,20,22,0.8)';
    [-0.5, 0, 0.5].forEach((f) => {
      g.beginPath();
      g.arc(f * r * 0.7, -r * 0.35, Math.max(1, r * 0.08), 0, Math.PI * 2);
      g.fill();
    });
  }

  function drawDigWorm(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 10, spacing = 14, baseRadius = 19;

    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.002 + i * 0.6) * 6;
      const r = Math.max(4, baseRadius * (1 - i * 0.03));
      g.beginPath();
      g.ellipse(-60 + along, wob + r * 0.5, Math.max(3, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.002 + i * 0.6) * 6;
      const x = -60 + along;
      const y = wob;
      const r = Math.max(4, baseRadius * (1 - i * 0.03));
      const base = i % 2 === 0 ? '#d8d0bc' : '#e3dcc8';
      g.save();
      g.translate(x, y);
      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.2));
      grad.addColorStop(0.6, base);
      grad.addColorStop(1, shade(base, -0.25));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#a89a7a';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;

      drawSegmentArmor(g, r);

      g.strokeStyle = 'rgba(40,36,28,0.6)';
      g.lineWidth = 1.6 * (r / 15);
      [-1, 1].forEach((side) => {
        g.beginPath();
        g.moveTo(0, side * r * 0.7);
        g.lineTo(-2, side * (r * 0.7 + 4));
        g.stroke();
      });
      g.restore();
    }

    g.save();
    const headY = Math.sin(t * 0.002) * 6;
    g.translate(-60 + segCount * spacing, headY);
    const points = 12;
    const headPath = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = baseRadius + Math.sin(t * 0.008 + i * 1.7) * 3;
      headPath.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    headPath.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
    g.closePath();
    const headGrad = g.createRadialGradient(-baseRadius * 0.3, -baseRadius * 0.35, 1, 0, 0, baseRadius * 1.05);
    headGrad.addColorStop(0, shade('#e3dcc8', 0.2));
    headGrad.addColorStop(0.55, '#e3dcc8');
    headGrad.addColorStop(1, shade('#e3dcc8', -0.25));
    g.fillStyle = headGrad;
    g.shadowColor = '#a89a7a';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    drawSegmentArmor(g, baseRadius);
    const angle = t * 0.0005;
    drawMonsterTeeth(g, baseRadius, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // The Level 10 boss: a giant armored knight, dark ruby and iron, with a
  // sword roughly twice its own body width -- condensed from game10.js's
  // own drawKnightBody/drawKnightHelm/drawSword into a single static pose
  // instead of a live attack cycle, since this is a reference gallery, not
  // the fight itself.
  // A single icicle hanging from a fixed point on the armor, phase 2
  // only -- ported straight from game10.js's own drawArmorIcicle.
  function drawLastKnightArmorIcicle(g, x, y, len) {
    const w = len * 0.22;
    g.beginPath();
    g.moveTo(x - w, y);
    g.lineTo(x + w, y);
    g.lineTo(x, y + len);
    g.closePath();
    const grad = g.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, 'rgba(200,235,255,0.9)');
    grad.addColorStop(1, 'rgba(140,200,240,0.55)');
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1;
    g.stroke();
  }

  function drawLastKnightArmorGem(g, x, y, r, phase2) {
    const hi = phase2 ? '#8fd6ff' : '#ff3a4a';
    const lo = phase2 ? '#2a6bd6' : '#8a1620';
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r);
    grad.addColorStop(0, hi);
    grad.addColorStop(1, lo);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = hi;
    g.shadowBlur = phase2 ? 7 : 4;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
  }

  // phase2 swaps every gem from ruby-red to sapphire-blue and adds a faint
  // blue flame along the blade -- the same two tells game10.js's own boss
  // uses once it drops to half health.
  function drawLastKnight(g, w, h, t, phase2) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const r = 44;
    const ironLight = '#8a8f99', ironMid = '#5a5e66', ironDark = '#232529';
    const wobble = Math.sin(t * 0.003 + 53) * (r * 0.015);

    // tasset
    [-0.4, 0, 0.4].forEach((f) => {
      g.save();
      g.translate(f * r * 0.75, r * 0.45 + wobble);
      g.rotate(f * 0.25);
      const tg = g.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
      tg.addColorStop(0, ironDark);
      tg.addColorStop(0.5, ironLight);
      tg.addColorStop(1, ironDark);
      g.beginPath();
      g.moveTo(-r * 0.2, -r * 0.08);
      g.lineTo(r * 0.2, -r * 0.08);
      g.lineTo(r * 0.14, r * 0.38);
      g.lineTo(-r * 0.14, r * 0.38);
      g.closePath();
      g.fillStyle = tg;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.3;
      g.stroke();
      g.restore();
    });

    // breastplate
    g.beginPath();
    g.moveTo(-r * 0.6, -r * 0.58 + wobble);
    g.lineTo(r * 0.6, -r * 0.58 + wobble);
    g.quadraticCurveTo(r * 0.76, -r * 0.1, r * 0.4, r * 0.48);
    g.lineTo(-r * 0.4, r * 0.48);
    g.quadraticCurveTo(-r * 0.76, -r * 0.1, -r * 0.6, -r * 0.58 + wobble);
    g.closePath();
    const torsoGrad = g.createLinearGradient(-r * 0.6, -r * 0.5, r * 0.6, r * 0.4);
    torsoGrad.addColorStop(0, ironMid);
    torsoGrad.addColorStop(0.5, ironLight);
    torsoGrad.addColorStop(1, ironDark);
    g.fillStyle = torsoGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 2;
    g.stroke();

    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -r * 0.5 + wobble);
    g.lineTo(0, r * 0.4);
    g.stroke();
    [-0.12, 0.22].forEach((f) => {
      const py = f * r + wobble;
      const bandGrad = g.createLinearGradient(-r * 0.56, py, r * 0.56, py);
      bandGrad.addColorStop(0, ironDark);
      bandGrad.addColorStop(0.5, '#7d828c');
      bandGrad.addColorStop(1, ironDark);
      g.fillStyle = bandGrad;
      g.beginPath();
      g.ellipse(0, py, r * 0.5, r * 0.06, 0, 0, Math.PI * 2);
      g.fill();
    });

    // pauldrons
    [-1, 1].forEach((side) => {
      const px = side * r * 0.66, py = -r * 0.52 + wobble;
      const pg = g.createRadialGradient(px - side * r * 0.1, py - r * 0.1, 1, px, py, r * 0.3);
      pg.addColorStop(0, ironLight);
      pg.addColorStop(1, ironDark);
      g.beginPath();
      g.arc(px, py, r * 0.28, 0, Math.PI * 2);
      g.fillStyle = pg;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.5;
      g.stroke();
      drawLastKnightArmorGem(g, px, py, r * 0.065, phase2);
      if (phase2) {
        drawLastKnightArmorIcicle(g, px - r * 0.1, py + r * 0.24, r * 0.26);
        drawLastKnightArmorIcicle(g, px + r * 0.12, py + r * 0.2, r * 0.18);
      }
    });

    drawLastKnightArmorGem(g, 0, -r * 0.02 + wobble, r * 0.13, phase2);
    if (phase2) {
      drawLastKnightArmorIcicle(g, -r * 0.3, r * 0.44, r * 0.3);
      drawLastKnightArmorIcicle(g, r * 0.26, r * 0.4, r * 0.22);
    }

    g.save();
    g.beginPath();
    g.ellipse(-r * 0.25, -r * 0.3, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fill();
    g.restore();

    // helm -- a mouth shows through the gap between the brow and jaw guards
    const angle = Math.sin(t * 0.0007) * 0.3;
    g.save();
    g.rotate(angle);
    g.translate(r * 0.62, 0);
    const headR = r * 0.34;
    const helmGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.4, 1, 0, 0, headR * 1.3);
    helmGrad.addColorStop(0, '#9aa0aa');
    helmGrad.addColorStop(1, '#3a3d44');

    drawMonsterTeeth(g, headR * 1.5, { x: 1, y: 0 });

    g.beginPath();
    g.ellipse(-headR * 0.05, -headR * 0.72, headR * 0.98, headR * 0.5, 0, 0, Math.PI * 2);
    g.fillStyle = helmGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = '#3a3d44';
    g.beginPath();
    g.ellipse(0, -headR * 1.3, headR * 0.16, headR * 0.35, 0, 0, Math.PI * 2);
    g.fill();

    g.beginPath();
    g.ellipse(headR * 0.05, headR * 0.68, headR * 0.92, headR * 0.44, 0, 0, Math.PI * 2);
    g.fillStyle = helmGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.4;
    g.stroke();

    [-1, 1].forEach((side) => {
      g.beginPath();
      g.ellipse(side * headR * 0.95, headR * 0.1, headR * 0.3, headR * 0.6, 0, 0, Math.PI * 2);
      g.fillStyle = helmGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.2;
      g.stroke();
    });
    g.restore();

    const swordAngle = angle + 0.15;
    g.save();
    g.rotate(swordAngle);
    g.strokeStyle = '#3a3d44';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-16, 0);
    g.stroke();
    g.strokeStyle = '#8a8f99';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(8, -16);
    g.lineTo(8, 16);
    g.stroke();
    const swordGrad = g.createLinearGradient(12, 0, 150, 0);
    swordGrad.addColorStop(0, '#d8dce2');
    swordGrad.addColorStop(0.5, '#9fa6b0');
    swordGrad.addColorStop(1, '#5a5f68');
    g.beginPath();
    g.moveTo(10, -8);
    g.lineTo(138, -3.5);
    g.lineTo(150, 0);
    g.lineTo(138, 3.5);
    g.lineTo(10, 8);
    g.closePath();
    g.fillStyle = swordGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1;
    g.stroke();
    drawLastKnightArmorGem(g, -16, 0, 5, phase2);
    if (phase2) {
      const flick = 0.6 + 0.4 * Math.sin(t * 0.01);
      const flameGrad = g.createLinearGradient(12, 0, 150, 0);
      flameGrad.addColorStop(0, `rgba(143,214,255,${0.5 * flick})`);
      flameGrad.addColorStop(1, 'rgba(42,107,214,0)');
      g.beginPath();
      g.moveTo(10, -8);
      g.lineTo(138, -3.5);
      g.lineTo(150, 0);
      g.lineTo(138, 3.5);
      g.lineTo(10, 8);
      g.closePath();
      g.fillStyle = flameGrad;
      g.fill();
    }
    g.restore();

    g.restore();
  }

  // A monster stays a mystery -- no portrait, no name, no description --
  // until the level it's actually in has been beaten. Locking is decided
  // once at load (reload the page after finishing a level to see it
  // unlock) rather than polled continuously, same as every other
  // story-progress read on this site.
  function applyLockState() {
    const story = window.GoofyStory;
    document.querySelectorAll('.monster-entry[data-level]').forEach((article) => {
      const n = parseInt(article.dataset.level, 10);
      const unlocked = !story || story.isCompleted(n);
      if (unlocked) return;
      article.classList.add('locked');
      const h2 = article.querySelector('h2');
      const meta = article.querySelector('.monster-meta');
      const p = article.querySelector('p');
      if (h2) h2.textContent = '???';
      if (meta) meta.textContent = `Level ${n} — locked`;
      if (p) p.textContent = `Finish Level ${n} to unlock this entry.`;
    });
  }
  applyLockState();

  function isLocked(ctx) {
    const article = ctx.canvas.closest('.monster-entry');
    return !!article && article.classList.contains('locked');
  }

  function drawLockedPlaceholder(g, w, h) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.arc(0, 0, 54, 0, Math.PI * 2);
    g.fillStyle = '#1c1c22';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.15)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.font = 'bold 56px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 0, 4);
    g.restore();
  }

  // The Level 11 creature: a pale blue tentacle thing with icicles jutting
  // out of every side of its body -- condensed from game11.js's own
  // drawMonster/drawTaperedTentacle into a single static pose.
  function drawFrostTentacleCreature(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 30, seed = 61;

    const tentCount = 6;
    for (let i = 0; i < tentCount; i++) {
      const baseA = (i / tentCount) * Math.PI * 2 + seed;
      const sway = Math.sin(t * 0.0017 + i * 1.6 + seed) * 0.4;
      const a = baseA + sway * 0.3;
      const len = radius * (1.6 + 0.2 * Math.sin(t * 0.0013 + i * 2.3));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const wobble = Math.sin(t * 0.004 + i * 2.1 + seed) * (radius * 0.2);
      const perpA = a + Math.PI / 2;
      const midX = (tx / 2) + Math.cos(perpA) * wobble;
      const midY = (ty / 2) + Math.sin(perpA) * wobble;
      drawTaperedTentacle(g, tx, ty, midX, midY, radius * 0.16, i % 2 === 0 ? '#2a5a7a' : '#3a7a9a');
    }

    const points = 12;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius + Math.sin(t * 0.006 + i * 1.7 + seed) * 2.5 + Math.sin(t * 0.0021 + i * 3.1 + seed) * 1.2;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const bodyGrad = g.createRadialGradient(-radius * 0.3, -radius * 0.35, 1, 0, 0, radius * 1.05);
    bodyGrad.addColorStop(0, '#bfe8ff');
    bodyGrad.addColorStop(0.55, '#6ab0d8');
    bodyGrad.addColorStop(1, '#2e5e7e');
    g.fillStyle = bodyGrad;
    g.shadowColor = '#8fd6ff';
    g.shadowBlur = 10;
    g.fill();
    g.shadowBlur = 0;

    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
      const a = (i / spikeCount) * Math.PI * 2 + seed * 0.3;
      const baseX = Math.cos(a) * radius * 0.92, baseY = Math.sin(a) * radius * 0.92;
      const tipLen = radius * (0.45 + (i % 3) * 0.12);
      const tipX = Math.cos(a) * (radius * 0.92 + tipLen), tipY = Math.sin(a) * (radius * 0.92 + tipLen);
      const perp = a + Math.PI / 2;
      const w2 = radius * 0.14;
      g.beginPath();
      g.moveTo(baseX + Math.cos(perp) * w2, baseY + Math.sin(perp) * w2);
      g.lineTo(baseX - Math.cos(perp) * w2, baseY - Math.sin(perp) * w2);
      g.lineTo(tipX, tipY);
      g.closePath();
      const spikeGrad = g.createLinearGradient(baseX, baseY, tipX, tipY);
      spikeGrad.addColorStop(0, 'rgba(200,235,255,0.95)');
      spikeGrad.addColorStop(1, 'rgba(140,200,240,0.55)');
      g.fillStyle = spikeGrad;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1;
      g.stroke();
    }

    g.save();
    trace();
    g.clip();
    g.beginPath();
    g.ellipse(-radius * 0.3, -radius * 0.35, radius * 0.5, radius * 0.3, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fill();
    g.restore();

    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  // The Level 12 creature: a purple, three-headed mutant tentacle thing --
  // condensed from game12.js's own drawMonster/drawBlobBody.
  function drawMutation(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 30, seed = 73;

    const tentCount = 5;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + seed + Math.sin(t * 0.0015 + i) * 0.3;
      const len = radius * 1.7;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.2, '#4a1a6a');
    }

    const sideR = radius * 0.6;
    [-1, 1].forEach((side) => {
      g.save();
      g.translate(side * radius * 0.7, radius * 0.35);
      drawBlobBody(g, sideR, '#6a2a8a', '#3a1452', seed + side * 7, t);
      g.restore();
    });

    drawBlobBody(g, radius, '#7a3a9a', '#3a1452', seed, t);

    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.save();
    g.translate(-radius * 0.7, radius * 0.35);
    drawEye(g, sideR, seed + 3, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();

    g.restore();
  }

  // The Level 15 boss: the Mutation grown to twice its old size, with a
  // few icicle shards clinging to its lower half -- the same frost-patch
  // technique game15.js's own drawFrostPatches uses, just reused here
  // against this file's plain 2D context.
  function drawFrostPatches(g, radius) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.7;
      const len = radius * (0.3 + (i % 3) * 0.08);
      const ax = Math.cos(angle) * radius * 0.92, ay = Math.sin(angle) * radius * 0.92;
      const nx = Math.cos(angle), ny = Math.sin(angle);
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
    }
    g.beginPath();
    g.ellipse(0, radius * 0.45, radius * 0.85, radius * 0.4, 0, 0, Math.PI);
    g.fillStyle = 'rgba(200,235,255,0.18)';
    g.fill();
  }

  // phase2 turns the whole thing bright red and drops the frost patches
  // -- the same two tells game15.js's own boss uses once it drops to 15
  // HP and the chase begins.
  function drawFrozenMutation(g, w, h, t, phase2) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 38, seed = 91;
    const tentColor = phase2 ? '#8a1414' : '#4a1a6a';
    const sideColor = phase2 ? '#b02424' : '#6a2a8a';
    const coreColor = phase2 ? '#d83a3a' : '#7a3a9a';
    const shadowColor = phase2 ? '#4a0a0a' : '#3a1452';

    const tentCount = 5;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + seed + Math.sin(t * 0.0015 + i) * 0.3;
      const len = radius * 1.6;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.18, tentColor);
    }

    const sideR = radius * 0.6;
    [-1, 1].forEach((side) => {
      g.save();
      g.translate(side * radius * 0.7, radius * 0.35);
      drawBlobBody(g, sideR, sideColor, shadowColor, seed + side * 7, t);
      g.restore();
    });

    drawBlobBody(g, radius, coreColor, shadowColor, seed, t);

    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.save();
    g.translate(-radius * 0.7, radius * 0.35);
    drawEye(g, sideR, seed + 3, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();

    if (!phase2) drawFrostPatches(g, radius);

    g.restore();
  }

  // The Level 13 creatures: tiny, pale, half-size cousins of the Crawler --
  // three of them clustered to read as "a bunch of these," not just one.
  function drawBrood(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    [[-30, -14, 31], [26, -18, 47], [2, 20, 63]].forEach(([ox, oy, seed]) => {
      g.save();
      g.translate(ox, oy);
      const r = 13;
      drawTentacles(g, r, '#5a4a30', t, seed);
      drawBlobBody(g, r, '#8a7a5a', '#5a4a30', seed, t);
      const angle = t * 0.0006 + seed;
      drawEye(g, r, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
      g.restore();
    });
    g.restore();
  }

  // A single leg rendered as a tapered icicle shard -- same technique as
  // Level 14's own drawIcicleLeg, just reused here against this file's
  // plain 2D context instead of a translated monster-local one.
  function drawIcicleLeg(g, baseX, baseY, footX, footY, baseWidth) {
    const dx = footX - baseX, dy = footY - baseY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const midX = baseX + dx * 0.4, midY = baseY + dy * 0.4;
    const bendX = midX + nx * baseWidth * 0.7, bendY = midY + ny * baseWidth * 0.7;

    g.beginPath();
    g.moveTo(baseX + nx * baseWidth, baseY + ny * baseWidth);
    g.lineTo(baseX - nx * baseWidth, baseY - ny * baseWidth);
    g.quadraticCurveTo(bendX, bendY, footX, footY);
    g.closePath();
    const grad = g.createLinearGradient(baseX, baseY, footX, footY);
    grad.addColorStop(0, 'rgba(200,245,220,0.75)');
    grad.addColorStop(0.6, 'rgba(170,230,195,0.55)');
    grad.addColorStop(1, 'rgba(210,250,235,0.3)');
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(230,255,240,0.5)';
    g.lineWidth = 0.6;
    g.stroke();
  }

  // The Level 14 creature: a pale green spider whose legs are rendered as
  // tapered icicle shards rather than joints -- same body silhouette as
  // the Crawler family, just recolored and re-legged.
  function drawThawSpider(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 24, seed = 11;
    const legCount = 8;
    for (let i = 0; i < legCount; i++) {
      const a = (i / legCount) * Math.PI * 2 + seed
        + Math.sin(t * 0.0012 + i * 1.3 + seed) * 0.12;
      const reach = radius * (1.9 + ((i * 7) % 3) * 0.18)
        + Math.sin(t * 0.0015 + i * 2.1 + seed) * radius * 0.1;
      const baseX = Math.cos(a) * radius * 0.7, baseY = Math.sin(a) * radius * 0.7;
      const footX = Math.cos(a) * reach, footY = Math.sin(a) * reach;
      drawIcicleLeg(g, baseX, baseY, footX, footY, Math.max(1, radius * 0.12));
    }
    drawBlobBody(g, radius, '#7fd68a', '#1f4a28', seed, t);
    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  // A single fin: a flat, translucent triangle -- same technique as
  // game16.js's own drawFin, reused here against this file's plain,
  // untranslated-per-call context.
  function drawFin(g, baseX, baseY, tipX, tipY, width, color) {
    const dx = tipX - baseX, dy = tipY - baseY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    g.beginPath();
    g.moveTo(baseX + nx * width, baseY + ny * width);
    g.lineTo(tipX, tipY);
    g.lineTo(baseX - nx * width, baseY - ny * width);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 0.8;
    g.stroke();
  }

  // The Level 16 creature: a long, finned eel with a mouth instead of an
  // eye, drawn as a wavy segment trail -- same body technique as the Dig
  // Worm, just slimmer, finned, and recolored a dark teal-green.
  function drawEel(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 11, spacing = 13, baseRadius = 16;

    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const r = Math.max(3, baseRadius * (1 - i * 0.055));
      g.beginPath();
      g.ellipse(-55 + along, wob + r * 0.5, Math.max(2.5, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const x = -55 + along;
      const y = wob;
      const r = Math.max(3, baseRadius * (1 - i * 0.055));
      const base = i % 2 === 0 ? '#2e6b63' : '#357a70';
      g.save();
      g.translate(x, y);

      if (i % 2 === 0 && i < segCount - 1) {
        drawFin(g, 0, 0, 0, -r * 1.7, r * 0.5, 'rgba(70,170,150,0.55)');
      }

      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#1a4a44';
      g.shadowBlur = 5;
      g.fill();
      g.shadowBlur = 0;

      g.beginPath();
      g.ellipse(0, r * 0.35, r * 0.75, r * 0.3, 0, 0, Math.PI);
      g.fillStyle = 'rgba(210,235,225,0.35)';
      g.fill();
      g.restore();
    }

    g.save();
    const headY = Math.sin(t * 0.0022) * 7;
    g.translate(-55 + segCount * spacing, headY);
    [-1, 1].forEach((side) => {
      drawFin(g, 0, 0, side * baseRadius * 1.3, baseRadius * 0.9, baseRadius * 0.3, 'rgba(70,170,150,0.6)');
    });
    const points = 12;
    const headPath = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = baseRadius + Math.sin(t * 0.008 + i * 1.7) * 2;
      headPath.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    headPath.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
    g.closePath();
    const headGrad = g.createRadialGradient(-baseRadius * 0.3, -baseRadius * 0.35, 1, 0, 0, baseRadius * 1.05);
    headGrad.addColorStop(0, shade('#357a70', 0.22));
    headGrad.addColorStop(0.55, '#357a70');
    headGrad.addColorStop(1, shade('#357a70', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#1a4a44';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    const angle = t * 0.0006;
    drawMonsterTeeth(g, baseRadius, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // A handful of small raised bumps on a segment's surface -- fixed per
  // segment (hashed from a seed, not live position) so they read as a
  // stable body feature rather than swimming around as it moves. Same
  // technique as game17.js's own drawEelBumps.
  function drawEelBumps(g, r, seed) {
    for (let i = 0; i < 3; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = r * (0.25 + (u % 5) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const br = Math.max(1, r * (0.12 + (u % 3) * 0.03));
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fillStyle = 'rgba(190,225,245,0.55)';
      g.fill();
      g.beginPath();
      g.arc(bx - br * 0.3, by - br * 0.3, br * 0.4, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fill();
    }
  }

  // The Level 17 creature: a cousin of the Flood Eel, pale sickly blue
  // instead of dark teal, with raised bumps scattered across its body.
  function drawCurrentEel(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 11, spacing = 13, baseRadius = 16;

    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const r = Math.max(3, baseRadius * (1 - i * 0.055));
      g.beginPath();
      g.ellipse(-55 + along, wob + r * 0.5, Math.max(2.5, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const x = -55 + along;
      const y = wob;
      const r = Math.max(3, baseRadius * (1 - i * 0.055));
      const base = i % 2 === 0 ? '#7ab8d9' : '#8ac4e3';
      g.save();
      g.translate(x, y);

      if (i % 2 === 0 && i < segCount - 1) {
        drawFin(g, 0, 0, 0, -r * 1.7, r * 0.5, 'rgba(120,180,220,0.55)');
      }

      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#2a5a75';
      g.shadowBlur = 5;
      g.fill();
      g.shadowBlur = 0;

      drawEelBumps(g, r, i * 13 + 5);

      g.beginPath();
      g.ellipse(0, r * 0.35, r * 0.75, r * 0.3, 0, 0, Math.PI);
      g.fillStyle = 'rgba(225,240,245,0.35)';
      g.fill();
      g.restore();
    }

    g.save();
    const headY = Math.sin(t * 0.0022) * 7;
    g.translate(-55 + segCount * spacing, headY);
    [-1, 1].forEach((side) => {
      drawFin(g, 0, 0, side * baseRadius * 1.3, baseRadius * 0.9, baseRadius * 0.3, 'rgba(120,180,220,0.6)');
    });
    const points = 12;
    const headPath = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = baseRadius + Math.sin(t * 0.008 + i * 1.7) * 2;
      headPath.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    headPath.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
    g.closePath();
    const headGrad = g.createRadialGradient(-baseRadius * 0.3, -baseRadius * 0.35, 1, 0, 0, baseRadius * 1.05);
    headGrad.addColorStop(0, shade('#8ac4e3', 0.22));
    headGrad.addColorStop(0.55, '#8ac4e3');
    headGrad.addColorStop(1, shade('#8ac4e3', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#2a5a75';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    drawEelBumps(g, baseRadius, 5);
    const angle = t * 0.0006;
    drawMonsterTeeth(g, baseRadius, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // The giant eel is draped head to tail in a heavy coat of seaweed --
  // several strands per call (fixed per spot, hashed from a seed, same
  // stable-feature convention as drawEelBumps) swaying with `t`, same
  // technique game17.js's own drawEelWeed uses.
  function drawEelWeed(g, r, seed, t) {
    const h = Math.imul(Math.floor(seed * 1000), 2654435761) >>> 0;
    const strands = 3 + (h % 4);
    for (let i = 0; i < strands; i++) {
      const baseAngle = ((h >> (i * 5)) % 360) * Math.PI / 180;
      const baseX = Math.cos(baseAngle) * r * 0.8;
      const baseY = Math.sin(baseAngle) * r * 0.8;
      const len = r * (0.8 + ((h >> (i * 3 + 2)) % 10) / 15);
      const phase = ((h % 100) / 100) * Math.PI * 2 + i * 1.3 + seed;
      const sway = Math.sin(t * 0.0025 + phase) * 4;
      const tipX = baseX + Math.cos(baseAngle) * len + sway;
      const tipY = baseY + Math.sin(baseAngle) * len;
      g.strokeStyle = i % 2 === 0 ? '#2f6b3a' : '#3a7d45';
      g.lineWidth = 1.8;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(baseX, baseY);
      g.quadraticCurveTo((baseX + tipX) / 2 + sway * 0.4, (baseY + tipY) / 2, tipX, tipY);
      g.stroke();
    }
  }

  // The Level 17 creature: the biggest of the three eels, deep green and
  // draped in trailing seaweed rather than bare-skinned like its cousins.
  function drawGreatEel(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 9, spacing = 14, baseRadius = 20;

    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const r = Math.max(3, baseRadius * (1 - i * 0.065));
      g.beginPath();
      g.ellipse(-56 + along, wob + r * 0.5, Math.max(2.5, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const x = -56 + along;
      const y = wob;
      const r = Math.max(3, baseRadius * (1 - i * 0.065));
      const base = i % 2 === 0 ? '#3f8f52' : '#4aa05e';
      g.save();
      g.translate(x, y);

      if (i % 2 === 0 && i < segCount - 1) {
        drawFin(g, 0, 0, 0, -r * 1.7, r * 0.5, 'rgba(70,140,85,0.55)');
      }

      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#15401f';
      g.shadowBlur = 5;
      g.fill();
      g.shadowBlur = 0;

      drawEelBumps(g, r, i * 13 + 5);
      drawEelWeed(g, r, i * 13 + 5, t);
      drawEelWeed(g, r, i * 13 + 5 + 6.5, t);

      g.beginPath();
      g.ellipse(0, r * 0.35, r * 0.75, r * 0.3, 0, 0, Math.PI);
      g.fillStyle = 'rgba(215,235,200,0.35)';
      g.fill();
      g.restore();
    }

    g.save();
    const headY = Math.sin(t * 0.0022) * 7;
    g.translate(-56 + segCount * spacing, headY);
    [-1, 1].forEach((side) => {
      drawFin(g, 0, 0, side * baseRadius * 1.3, baseRadius * 0.9, baseRadius * 0.3, 'rgba(70,140,85,0.6)');
    });
    const points = 12;
    const headPath = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = baseRadius + Math.sin(t * 0.008 + i * 1.7) * 2;
      headPath.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    headPath.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
    g.closePath();
    const headGrad = g.createRadialGradient(-baseRadius * 0.3, -baseRadius * 0.35, 1, 0, 0, baseRadius * 1.05);
    headGrad.addColorStop(0, shade('#4aa05e', 0.22));
    headGrad.addColorStop(0.55, '#4aa05e');
    headGrad.addColorStop(1, shade('#4aa05e', -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#15401f';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    drawEelBumps(g, baseRadius, 5);
    drawEelWeed(g, baseRadius, 5, t);
    drawEelWeed(g, baseRadius, 11.5, t);
    const angle = t * 0.0006;
    drawMonsterTeeth(g, baseRadius, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // Coral growths on the Level 20 boss's body -- same branching-clump
  // technique as the floor's own coral, anchored to a body segment.
  // Phase 2: every patch turns red and doubles in size.
  function drawCisternCoral(g, r, seed, phase2) {
    const sizeMult = phase2 ? 2 : 1;
    for (let i = 0; i < 2; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = r * (0.3 + (u % 5) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const color = phase2 ? '#ff3b3b' : TINY_CORAL_PALETTE[u % TINY_CORAL_PALETTE.length];
      const tipLen = Math.max(1.4, r * 0.32) * sizeMult;
      g.strokeStyle = color;
      g.lineWidth = Math.max(1, r * 0.17) * sizeMult;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a) * tipLen, by + Math.sin(a) * tipLen);
      g.stroke();
      g.beginPath();
      g.arc(bx + Math.cos(a) * tipLen, by + Math.sin(a) * tipLen, Math.max(1, r * 0.15) * sizeMult, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
  }

  // The Level 20 boss: looks like the Bog, but teal, and grown over
  // with both seaweed AND coral (the Bog only has seaweed). Phase 2 --
  // DEHYDRATED -- turns every coral patch red and 2x bigger.
  function drawCistern(g, w, h, t, phase2) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const segCount = 9, spacing = 14, baseRadius = 20;
    const base1 = '#1a7a6e', base2 = '#1f8c7e';

    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const r = Math.max(3, baseRadius * (1 - i * 0.065));
      g.beginPath();
      g.ellipse(-56 + along, wob + r * 0.5, Math.max(2.5, r * 0.85), Math.max(2, r * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.0022 + i * 0.6) * 7;
      const x = -56 + along;
      const y = wob;
      const r = Math.max(3, baseRadius * (1 - i * 0.065));
      const base = i % 2 === 0 ? base1 : base2;
      g.save();
      g.translate(x, y);

      if (i % 2 === 0 && i < segCount - 1) {
        drawFin(g, 0, 0, 0, -r * 1.7, r * 0.5, 'rgba(60,180,160,0.55)');
      }

      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.shadowColor = '#0a2e28';
      g.shadowBlur = 5;
      g.fill();
      g.shadowBlur = 0;

      drawEelWeed(g, r, i * 13 + 5, t);
      drawCisternCoral(g, r, i * 13 + 5 + 6.5, phase2);

      g.restore();
    }

    g.save();
    const headY = Math.sin(t * 0.0022) * 7;
    g.translate(-56 + segCount * spacing, headY);
    [-1, 1].forEach((side) => {
      drawFin(g, 0, 0, side * baseRadius * 1.3, baseRadius * 0.9, baseRadius * 0.3, 'rgba(60,180,160,0.6)');
    });
    const points = 12;
    const headPath = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = baseRadius + Math.sin(t * 0.008 + i * 1.7) * 2;
      headPath.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    g.beginPath();
    headPath.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
    g.closePath();
    const headGrad = g.createRadialGradient(-baseRadius * 0.3, -baseRadius * 0.35, 1, 0, 0, baseRadius * 1.05);
    headGrad.addColorStop(0, shade(base2, 0.22));
    headGrad.addColorStop(0.55, base2);
    headGrad.addColorStop(1, shade(base2, -0.3));
    g.fillStyle = headGrad;
    g.shadowColor = '#0a2e28';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    drawEelWeed(g, baseRadius, 5, t);
    drawCisternCoral(g, baseRadius, 11.5, phase2);
    const angle = t * 0.0006;
    drawMonsterTeeth(g, baseRadius, { x: Math.cos(angle), y: Math.sin(angle) * 0.4 });
    g.restore();
    g.restore();
  }

  // The Level 19 creature: not one eel but a swarm of ten tiny ones, a
  // third the size of the Flood Eel, each grown over with its own patch
  // of coral. The portrait shows three of them at once rather than a
  // single body, to read as "a swarm," not "a small eel."
  const TINY_CORAL_PALETTE = ['#ff8a5c', '#ff6fa5', '#b985ff', '#ffb347'];
  function drawTinyEelCoral(g, r, seed) {
    for (let i = 0; i < 2; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = r * (0.3 + (u % 5) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const color = TINY_CORAL_PALETTE[u % TINY_CORAL_PALETTE.length];
      const tipLen = Math.max(1.2, r * 0.3);
      g.strokeStyle = color;
      g.lineWidth = Math.max(0.8, r * 0.16);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a) * tipLen, by + Math.sin(a) * tipLen);
      g.stroke();
      g.beginPath();
      g.arc(bx + Math.cos(a) * tipLen, by + Math.sin(a) * tipLen, Math.max(0.8, r * 0.14), 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    }
  }

  function drawOneTinyEel(g, cx, cy, seed, t) {
    const segCount = 6, spacing = 6, baseRadius = 6.5;
    g.save();
    g.translate(cx, cy);
    for (let i = segCount - 1; i >= 0; i--) {
      const along = i * spacing;
      const wob = Math.sin(t * 0.004 + seed + i * 0.6) * 3;
      const x = -(segCount - 1) * spacing / 2 + along;
      const y = wob;
      const r = Math.max(1, baseRadius * (1 - i * 0.1));
      const base = i % 2 === 0 ? '#6a7a85' : '#7a8a95';
      g.save();
      g.translate(x, y);
      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      grad.addColorStop(0, shade(base, 0.22));
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, shade(base, -0.3));
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.fill();
      drawTinyEelCoral(g, r, seed + i * 13);
      g.restore();
    }
    const headX = -(segCount - 1) * spacing / 2 + segCount * spacing;
    const headY = Math.sin(t * 0.004 + seed) * 3;
    g.translate(headX, headY);
    g.beginPath();
    g.arc(0, 0, baseRadius, 0, Math.PI * 2);
    const headGrad = g.createRadialGradient(-baseRadius * 0.3, -baseRadius * 0.35, 1, 0, 0, baseRadius * 1.05);
    headGrad.addColorStop(0, shade('#7a8a95', 0.22));
    headGrad.addColorStop(0.55, '#7a8a95');
    headGrad.addColorStop(1, shade('#7a8a95', -0.3));
    g.fillStyle = headGrad;
    g.fill();
    drawTinyEelCoral(g, baseRadius, seed);
    drawMonsterTeeth(g, baseRadius, { x: 1, y: 0 });
    g.restore();
  }

  function drawTinyEels(g, w, h, t) {
    clear(g, w, h);
    drawOneTinyEel(g, w * 0.3, h * 0.32, 2, t);
    drawOneTinyEel(g, w * 0.62, h * 0.55, 9, t);
    drawOneTinyEel(g, w * 0.4, h * 0.75, 16, t);
  }

  function drawPortraitOrLock(ctx, drawFn, t, phase2) {
    if (!ctx) return;
    if (isLocked(ctx)) { drawLockedPlaceholder(ctx, PORTRAIT, PORTRAIT); return; }
    drawFn(ctx, PORTRAIT, PORTRAIT, t, phase2);
  }

  // Bosses with a real phase 2 (a health-threshold recolor/behavior
  // change in the actual level, not just a palette swap for its own
  // sake) show it on click -- a second click flips back to phase 1.
  // Every other portrait's canvas is left alone.
  const phase2Shown = new Set();
  function wirePhase2Toggle(ctx) {
    if (!ctx) return;
    ctx.canvas.style.cursor = 'pointer';
    ctx.canvas.title = 'Click for phase 2';
    ctx.canvas.addEventListener('click', () => {
      if (isLocked(ctx)) return;
      if (phase2Shown.has(ctx)) phase2Shown.delete(ctx); else phase2Shown.add(ctx);
    });
  }
  wirePhase2Toggle(lastKnightCtx);
  wirePhase2Toggle(frozenMutationCtx);
  wirePhase2Toggle(cisternCtx);

  // This page redraws seventeen fully-detailed monster portraits at once, so
  // it caps itself around 30fps instead of riding requestAnimationFrame's
  // full 60 -- plenty smooth for a reference gallery nobody is dodging, and
  // it halves the cost of a page that (unlike any single level) never has
  // fewer than seventeen creatures on screen simultaneously.
  let lastDraw = 0;
  function loop(t) {
    if (t - lastDraw >= 33) {
      lastDraw = t;
      drawPortraitOrLock(crawlerCtx, drawCrawler, t);
      drawPortraitOrLock(drifterCtx, drawDrifter, t);
      drawPortraitOrLock(caterpillarCtx, drawCaterpillar, t);
      drawPortraitOrLock(mimicCtx, drawMimic, t);
      drawPortraitOrLock(lurkerCtx, drawLurker, t);
      drawPortraitOrLock(bossCtx, drawBoss, t);
      drawPortraitOrLock(knightCtx, drawKnight, t);
      drawPortraitOrLock(wingedCtx, drawWinged, t);
      drawPortraitOrLock(frostCtx, drawFrostTentacleCreature, t);
      drawPortraitOrLock(mutationCtx, drawMutation, t);
      drawPortraitOrLock(broodCtx, drawBrood, t);
      drawPortraitOrLock(thawSpiderCtx, drawThawSpider, t);
      drawPortraitOrLock(frozenMutationCtx, drawFrozenMutation, t, phase2Shown.has(frozenMutationCtx));
      drawPortraitOrLock(vaultGuardCtx, drawVaultGuardian, t);
      drawPortraitOrLock(wraithCtx, drawWraith, t);
      drawPortraitOrLock(digWormCtx, drawDigWorm, t);
      drawPortraitOrLock(lastKnightCtx, drawLastKnight, t, phase2Shown.has(lastKnightCtx));
      drawPortraitOrLock(eelCtx, drawEel, t);
      drawPortraitOrLock(currentEelCtx, drawCurrentEel, t);
      drawPortraitOrLock(greatEelCtx, drawGreatEel, t);
      drawPortraitOrLock(tinyEelsCtx, drawTinyEels, t);
      drawPortraitOrLock(cisternCtx, drawCistern, t, phase2Shown.has(cisternCtx));
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
