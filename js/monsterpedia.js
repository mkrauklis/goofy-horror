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
  const luminescentCtx = ctxFor('monster-canvas-luminescent');
  const greatEelCtx = ctxFor('monster-canvas-greateel');
  const tinyEelsCtx = ctxFor('monster-canvas-tinyeels');
  const cisternCtx = ctxFor('monster-canvas-cistern');
  const grassDrifterCtx = ctxFor('monster-canvas-grassdrifter');
  const kindlingCtx = ctxFor('monster-canvas-kindling');
  const stalkerCtx = ctxFor('monster-canvas-stalker');
  const sentryCtx = ctxFor('monster-canvas-sentry');
  const cultivatorCtx = ctxFor('monster-canvas-cultivator');
  const reacherCtx = ctxFor('monster-canvas-reacher');
  const gargoyleCtx = ctxFor('monster-canvas-gargoyle');
  const wardenCtx = ctxFor('monster-canvas-warden');
  const grotesqueCtx = ctxFor('monster-canvas-grotesque');
  const garguantuagoyleCtx = ctxFor('monster-canvas-garguantuagoyle');
  const multipodCtx = ctxFor('monster-canvas-multipod');
  const hollowJackCtx = ctxFor('monster-canvas-hollowjack');
  const hushCtx = ctxFor('monster-canvas-hush');
  const rottenCtx = ctxFor('monster-canvas-rotten');
  const embergourdCtx = ctxFor('monster-canvas-embergourd');
  const pumpkinKingCtx = ctxFor('monster-canvas-pumpkinking');
  const PORTRAIT = 160;

  // While a portrait is being drawn as a member of the Multipod's swarm
  // (see window.MonsterModels) it must not wipe the canvas it's sharing.
  let swarmMode = false;
  function clear(g, w, h) {
    if (swarmMode) return;
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

  // Grass sprouting straight out of the body -- the one thing that sets
  // Level 21's Drifters apart from Level 2's plain ones, same branching
  // technique as every other body-growth on this site (the Bog's
  // seaweed, the Cistern's coral), just blades instead of fronds.
  function drawDrifterGrass(g, radius, seed, t) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = radius * (0.2 + (u % 6) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const height = radius * (0.35 + (u % 4) * 0.08);
      const sway = Math.sin(t * 0.0018 + i + seed) * radius * 0.08;
      g.strokeStyle = i % 2 === 0 ? '#4c9436' : '#6ab14a';
      g.lineWidth = Math.max(1.2, radius * 0.07);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + sway * 0.5, by - height * 0.6, bx + sway, by - height);
      g.stroke();
    }
  }

  function drawGrassDrifter(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 83;
    drawTentacles(g, 32, '#1a6a2e', t, seed);
    drawBlobBody(g, 32, '#0f4a1c', '#2f7a3f', seed, t);
    drawDrifterGrass(g, 32, seed, t);
    const angle = -t * 0.0004;
    drawEye(g, 32, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 });
    g.restore();
  }

  // Rigid sticks jutting out of the Kindling's hide, each with a short
  // side-twig -- unlike the Drifter's grass, these don't sway, same
  // rigid/swaying distinction Level 22's own game code draws.
  function drawKindlingSticks(g, radius, seed) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = radius * (0.2 + (u % 6) * 0.1);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const length = radius * (0.45 + (u % 4) * 0.12);
      const tipX = bx + Math.cos(a) * length, tipY = by + Math.sin(a) * length;
      g.strokeStyle = i % 2 === 0 ? '#6b4a26' : '#5a3d1f';
      g.lineWidth = Math.max(1.3, radius * 0.075);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(tipX, tipY);
      g.stroke();

      const midX = bx + (tipX - bx) * 0.55, midY = by + (tipY - by) * 0.55;
      const branchA = a + ((u % 2) ? 0.7 : -0.7);
      g.lineWidth = Math.max(1, radius * 0.05);
      g.beginPath();
      g.moveTo(midX, midY);
      g.lineTo(midX + Math.cos(branchA) * length * 0.3, midY + Math.sin(branchA) * length * 0.3);
      g.stroke();
    }
  }

  // A toothy maw instead of the usual single eye -- same technique the
  // Kindling's own in-game sprite uses (js/game22.js's drawMonsterMouth).
  function drawKindlingMouth(g, radius) {
    const mx = radius * 0.64, my = radius * 0.4;
    g.save();
    g.beginPath();
    g.ellipse(0, 0, mx, my, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#1a0806';
    g.fillRect(-mx, -my, mx * 2, my * 2);
    const glow = g.createRadialGradient(0, 0, 1, 0, 0, mx);
    glow.addColorStop(0, 'rgba(120,20,15,0.55)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(-mx, -my, mx * 2, my * 2);
    const teeth = 7;
    const toothW = (mx * 2) / teeth;
    g.fillStyle = '#e8ddc8';
    for (let i = 0; i < teeth; i++) {
      const tx = -mx + (i + 0.5) * toothW;
      const th = my * 0.58;
      g.beginPath();
      g.moveTo(tx - toothW * 0.4, -my);
      g.lineTo(tx + toothW * 0.4, -my);
      g.lineTo(tx, -my + th);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(tx - toothW * 0.4, my);
      g.lineTo(tx + toothW * 0.4, my);
      g.lineTo(tx, my - th);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.beginPath();
    g.ellipse(0, 0, mx, my, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  function drawKindling(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 47;
    drawTentacles(g, 32, '#5a3d1f', t, seed);
    drawBlobBody(g, 32, '#4a3018', '#6b4a26', seed, t);
    drawKindlingSticks(g, 32, seed);
    drawKindlingMouth(g, 32);
    g.restore();
  }

  // Long, gaunt reaching limbs -- same technique the Stalker's own
  // in-game sprite uses (js/game23.js's drawStalkerLimbs).
  function drawStalkerLimbs(g, radius, seed) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = radius * (0.25 + (u % 5) * 0.08);
      const bx = Math.cos(a) * dist, by = Math.sin(a) * dist;
      const length = radius * (0.7 + (u % 5) * 0.15);
      const curve = ((u % 2) ? 1 : -1) * radius * 0.2;
      const tipX = bx + Math.cos(a) * length, tipY = by + Math.sin(a) * length;
      const midX = bx + Math.cos(a) * length * 0.5 - Math.sin(a) * curve;
      const midY = by + Math.sin(a) * length * 0.5 + Math.cos(a) * curve;
      g.strokeStyle = i % 2 === 0 ? '#1f1a26' : '#140f1a';
      g.lineWidth = Math.max(1, radius * 0.05);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(midX, midY, tipX, tipY);
      g.stroke();
    }
  }

  // A mid-glow watching eye for the portrait -- not mid-charge, not
  // freshly spotted, just the ambient "always watching" state.
  function drawStalkerEye(g, radius) {
    const er = radius * 0.3;
    g.save();
    g.shadowColor = '#c93838';
    g.shadowBlur = 8;
    g.beginPath();
    g.arc(0, -radius * 0.1, er, 0, Math.PI * 2);
    g.fillStyle = '#c93838';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(0, -radius * 0.1, er * 0.4, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();
    g.restore();
  }

  function drawStalker(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 91;
    drawTentacles(g, 32, '#1f1a26', t, seed);
    drawBlobBody(g, 32, '#141018', '#2a2032', seed, t);
    drawStalkerLimbs(g, 32, seed);
    drawStalkerEye(g, 32);
    g.restore();
  }

  // Small gears studded around the hide, same convention as the in-game
  // sprite uses (js/game24.js's drawRobotGears).
  function drawSentryGears(g, radius, seed) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = radius * (0.45 + (u % 5) * 0.08);
      const gx = Math.cos(a) * dist, gy = Math.sin(a) * dist;
      const gr = radius * (0.12 + (u % 3) * 0.03);
      const teeth = 6;
      g.save();
      g.translate(gx, gy);
      g.rotate(seed + i);
      g.beginPath();
      for (let j = 0; j < teeth; j++) {
        const a0 = (j / teeth) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2) / teeth * 0.5;
        g.moveTo(Math.cos(a0) * gr, Math.sin(a0) * gr);
        g.lineTo(Math.cos(a0) * (gr + gr * 0.35), Math.sin(a0) * (gr + gr * 0.35));
        g.lineTo(Math.cos(a1) * (gr + gr * 0.35), Math.sin(a1) * (gr + gr * 0.35));
        g.lineTo(Math.cos(a1) * gr, Math.sin(a1) * gr);
      }
      g.closePath();
      g.fillStyle = '#6a6a5e';
      g.fill();
      g.beginPath();
      g.arc(0, 0, gr * 0.5, 0, Math.PI * 2);
      g.fillStyle = '#3a3a32';
      g.fill();
      g.restore();
    }
  }

  // A rigid, riveted metal chassis, same convention as the in-game sprite
  // (js/game24.js's drawRobotChassis) -- flat polygon panels instead of
  // an organic wobbling blob, so the portrait actually reads as a
  // machine rather than a creature with gears bolted on.
  function drawSentryChassis(g, radius, seed) {
    const sides = 8;
    const path = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + seed * 0.3;
      const h = Math.imul(Math.floor(seed * 1000) + i * 131, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const r = radius * (0.92 + (u % 10) * 0.012);
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };
    trace();
    const base = g.createLinearGradient(-radius, -radius, radius, radius);
    base.addColorStop(0, '#5a5f5a');
    base.addColorStop(0.5, '#363a36');
    base.addColorStop(1, '#1c1f1c');
    g.fillStyle = base;
    g.shadowColor = '#000';
    g.shadowBlur = Math.min(radius * 0.3, 14);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#111311';
    g.lineWidth = 2.5;
    g.stroke();
    g.save();
    trace();
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1.5;
    for (let i = 0; i < sides; i++) {
      const [px, py] = path[i];
      g.beginPath(); g.moveTo(0, 0); g.lineTo(px, py); g.stroke();
    }
    g.restore();
    g.fillStyle = '#121412';
    for (let i = 0; i < sides; i += 2) {
      const [px, py] = path[i];
      g.beginPath();
      g.arc(px * 0.9, py * 0.9, radius * 0.045, 0, Math.PI * 2);
      g.fill();
    }
  }

  // A turret head unit, same convention as the in-game sprite (js/game24
  // .js's drawRobotHead) -- the red lens housed in a bezel with a short
  // antenna, instead of an eye floating directly on the body.
  function drawSentryHead(g, radius) {
    const hr = radius * 0.42;
    const hy = -radius * 0.55;
    g.save();
    g.translate(0, hy);
    g.fillStyle = '#44483f';
    g.beginPath();
    g.rect(-hr, -hr * 0.6, hr * 2, hr * 1.2);
    g.fill();
    g.strokeStyle = '#121412';
    g.lineWidth = 2;
    g.strokeRect(-hr, -hr * 0.6, hr * 2, hr * 1.2);

    const er = hr * 0.5;
    g.beginPath();
    g.arc(0, 0, er * 1.25, 0, Math.PI * 2);
    g.fillStyle = '#1c1e1c';
    g.fill();
    g.shadowColor = '#c93838';
    g.shadowBlur = 8;
    g.beginPath();
    g.arc(0, 0, er, 0, Math.PI * 2);
    g.fillStyle = '#c93838';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(0, 0, er * 0.4, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();

    g.strokeStyle = '#2a2d2a';
    g.lineWidth = hr * 0.16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hr * 0.6, -hr * 0.6);
    g.lineTo(hr * 0.75, -hr * 1.5);
    g.stroke();
    g.beginPath();
    g.arc(hr * 0.75, -hr * 1.5, hr * 0.12, 0, Math.PI * 2);
    g.fillStyle = '#5a5f5a';
    g.fill();
    g.restore();
  }

  function drawSentry(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 47;
    drawTentacles(g, 32, '#1f1a26', t, seed);
    drawSentryChassis(g, 32, seed);
    drawSentryGears(g, 32, seed);
    drawSentryHead(g, 32);
    g.restore();
  }

  // The Cultivator's portrait -- a compact standalone version of its
  // in-game look (js/game25.js's drawCultivatorBody/drawRobotGears/
  // drawMoss/drawBossEye/drawMushroomCap); click the portrait to see its
  // phase 2.
  function drawCultivatorGears(g, radius, seed, phase2) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const h = Math.imul(Math.floor(seed * 1000) + i * 97, 2654435761);
      const u = (h ^ (h >>> 15)) >>> 0;
      const a = (u % 360) * Math.PI / 180;
      const dist = radius * (0.45 + (u % 5) * 0.08);
      const gx = Math.cos(a) * dist, gy = Math.sin(a) * dist;
      const gr = radius * (0.1 + (u % 3) * 0.025);
      g.save();
      g.translate(gx, gy);
      g.rotate(seed + i);
      const teeth = 6;
      g.beginPath();
      for (let j = 0; j < teeth; j++) {
        const a0 = (j / teeth) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / teeth) * 0.5;
        g.moveTo(Math.cos(a0) * gr, Math.sin(a0) * gr);
        g.lineTo(Math.cos(a0) * (gr * 1.35), Math.sin(a0) * (gr * 1.35));
        g.lineTo(Math.cos(a1) * (gr * 1.35), Math.sin(a1) * (gr * 1.35));
        g.lineTo(Math.cos(a1) * gr, Math.sin(a1) * gr);
      }
      g.closePath();
      g.fillStyle = phase2 ? '#8a5a3a' : '#6a6a5e';
      g.fill();
      g.restore();
    }
  }
  // Real grass growing out of the hull, same swaying-strand convention
  // as Level 17's Bog portrait uses for its seaweed, not a scatter of
  // moss dots.
  function drawCultivatorGrass(g, radius, seed, t, phase2) {
    const clumps = 9;
    for (let c = 0; c < clumps; c++) {
      const h = Math.imul(Math.floor(seed * 1000) + c * 131, 2246822519);
      const u = (h ^ (h >>> 15)) >>> 0;
      const baseAngle = ((u % 360) * Math.PI) / 180;
      const baseDist = radius * (0.35 + (u % 6) * 0.1);
      const baseX = Math.cos(baseAngle) * baseDist, baseY = Math.sin(baseAngle) * baseDist;
      const blades = 3 + (u % 2);
      for (let i = 0; i < blades; i++) {
        const bladeAngle = baseAngle + (i - blades / 2) * 0.35;
        const len = radius * (0.22 + ((u >> (i * 3 + 2)) % 6) * 0.03);
        const phase = ((u % 100) / 100) * Math.PI * 2 + i * 1.7 + seed;
        const sway = Math.sin(t * 0.0022 + phase) * radius * 0.06;
        const tipX = baseX + Math.cos(bladeAngle) * len + sway;
        const tipY = baseY + Math.sin(bladeAngle) * len;
        g.strokeStyle = phase2
          ? (i % 2 === 0 ? '#9a8a3a' : '#b4a24a')
          : (i % 2 === 0 ? '#3a7a2a' : '#4c9436');
        g.lineWidth = Math.max(1, radius * 0.045);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(baseX, baseY);
        g.quadraticCurveTo((baseX + tipX) / 2 + sway * 0.4, (baseY + tipY) / 2, tipX, tipY);
        g.stroke();
      }
    }
  }
  // phase2 = the "rusting" form from js/game25.js: yellowed grass, rust-
  // brown plating with rust streaks, red eye.
  function drawCultivator(g, w, h, t, phase2) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 30, seed = 63;
    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius * 1.05);
    grad.addColorStop(0, phase2 ? '#8a7260' : '#6a756a');
    grad.addColorStop(0.6, phase2 ? '#6a5240' : '#4a5248');
    grad.addColorStop(1, phase2 ? '#3a2a20' : '#2e332e');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.fill();
    g.strokeStyle = phase2 ? '#8a3a2a' : '#2a3a2a';
    g.lineWidth = 3;
    g.stroke();
    g.save();
    g.beginPath(); g.arc(0, 0, radius, 0, Math.PI * 2); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    [0.4, 0.75].forEach((f) => {
      g.beginPath(); g.arc(0, 0, radius * f, 0, Math.PI * 2); g.stroke();
    });
    const seams = 8;
    for (let i = 0; i < seams; i++) {
      const a = (i / seams) * Math.PI * 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius); g.stroke();
    }
    if (phase2) {
      g.strokeStyle = 'rgba(140,60,20,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.7;
        g.beginPath();
        g.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
        g.lineTo(Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3 + radius * 0.3);
        g.stroke();
      }
    }
    g.restore();
    drawCultivatorGears(g, radius, seed, phase2);
    drawCultivatorGrass(g, radius, seed, t, phase2);
    g.save();
    const cultEye = phase2 ? '#ff3b3b' : '#4ab0ff';
    g.shadowColor = cultEye; g.shadowBlur = 8;
    g.beginPath(); g.arc(0, -radius * 0.05, radius * 0.22, 0, Math.PI * 2);
    g.fillStyle = cultEye; g.fill(); g.shadowBlur = 0;
    g.beginPath(); g.arc(0, -radius * 0.05, radius * 0.09, 0, Math.PI * 2);
    g.fillStyle = '#050208'; g.fill();
    g.restore();
    g.save();
    g.translate(0, -radius * 1.15);
    g.strokeStyle = '#d9d2c0'; g.lineWidth = radius * 0.18;
    g.beginPath(); g.moveTo(0, radius * 0.1); g.lineTo(0, -radius * 0.25); g.stroke();
    g.beginPath();
    g.ellipse(0, -radius * 0.32, radius * 0.5, radius * 0.32, 0, Math.PI, 0);
    g.fillStyle = '#c94a6a';
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    [[-0.2, -0.1], [0.15, -0.2], [0.3, 0]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(dx * radius, -radius * 0.32 + dy * radius, radius * 0.06, 0, Math.PI * 2);
      g.fill();
    });
    g.restore();
    g.restore();
  }

  // A mottled violet blob with a crown of short, constantly-waving idle
  // tentacles and a slit red eye -- the same body drawReacher() builds in
  // js/game26.js, just a static pose (its signature long-reach lash is a
  // level mechanic, not part of the creature's own portrait).
  function drawReacher(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 32, seed = 41;

    const stubCount = 7;
    for (let i = 0; i < stubCount; i++) {
      const a = (i / stubCount) * Math.PI * 2 + seed;
      const len = radius * (1.3 + 0.3 * Math.sin(t * 0.0015 + i * 2 + seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const wob = Math.sin(t * 0.003 + i + seed) * radius * 0.3;
      const midX = Math.cos(a) * len * 0.5 - Math.sin(a) * wob;
      const midY = Math.sin(a) * len * 0.5 + Math.cos(a) * wob;
      drawTaperedTentacle(g, tx, ty, midX, midY, radius * 0.18, '#6a2a80');
    }

    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.3, 2, 0, 0, radius);
    grad.addColorStop(0, '#8a3aa0');
    grad.addColorStop(1, '#231228');
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = '#000';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#130a16';
    g.lineWidth = 2.5;
    g.stroke();

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed * 0.5;
      const bx = Math.cos(a) * radius * 0.65, by = Math.sin(a) * radius * 0.65;
      g.beginPath();
      g.arc(bx, by, radius * 0.14, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fill();
    }

    const er = radius * 0.32;
    g.beginPath();
    g.arc(0, 0, er * 1.3, 0, Math.PI * 2);
    g.fillStyle = '#0c0410';
    g.fill();
    g.shadowColor = '#8a2a40';
    g.shadowBlur = 6;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#8a2a40';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.ellipse(0, 0, er * 0.3, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();

    g.restore();
  }

  // The same family as drawReacher, recolored dark grey with a pair of
  // membrane wings instead of rooftop-reach tentacles -- a static pose
  // of the same winged body js/game27.js animates in flight.
  function drawGargoyle(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 30, seed = 41;
    const flap = t * 0.004;

    function drawWing(side) {
      // Sized relative to the body radius and anchored a little above-
      // behind it (not dead center) so the span clearly extends past the
      // body's own silhouette instead of being drawn almost entirely
      // behind it. 1.8x bigger again on top of that, direct follow-up
      // request.
      const span = radius * 3.24, sweep = Math.sin(flap) * 0.5;
      g.save();
      g.translate(0, -radius * 0.2);
      g.scale(side, 1);
      g.rotate(0.25 + sweep);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(span * 0.5, -span * 0.35, span, -span * 0.1);
      g.quadraticCurveTo(span * 0.6, span * 0.15, span * 0.3, span * 0.05);
      g.quadraticCurveTo(span * 0.15, span * 0.1, 0, 0);
      g.closePath();
      g.fillStyle = '#52525c';
      g.fill();
      g.strokeStyle = 'rgba(210,210,220,0.35)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 0.75;
      g.stroke();
      g.strokeStyle = 'rgba(220,220,230,0.3)';
      g.lineWidth = 1;
      [0.4, 0.7, 1].forEach((f) => {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(span * f, -span * 0.1 * f);
        g.stroke();
      });
      g.restore();
    }
    drawWing(-1);
    drawWing(1);

    const stubCount = 5;
    for (let i = 0; i < stubCount; i++) {
      const a = (i / stubCount) * Math.PI + Math.PI * 0.5 + seed * 0.1;
      const len = radius * 0.9;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + radius * 0.4;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.14, '#2a2c2e');
    }

    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.3, 2, 0, 0, radius);
    grad.addColorStop(0, '#4a4e54');
    grad.addColorStop(1, '#17181a');
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = '#000';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#0c0d0e';
    g.lineWidth = 2.5;
    g.stroke();

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed * 0.5;
      const bx = Math.cos(a) * radius * 0.65, by = Math.sin(a) * radius * 0.65;
      g.beginPath();
      g.arc(bx, by, radius * 0.14, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fill();
    }

    const er = radius * 0.32;
    g.beginPath();
    g.arc(0, 0, er * 1.3, 0, Math.PI * 2);
    g.fillStyle = '#0c0410';
    g.fill();
    g.shadowColor = '#6a3060';
    g.shadowBlur = 6;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#6a3060';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.ellipse(0, 0, er * 0.3, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();

    g.restore();
  }

  // The same stubby-tentacled family as the Reacher and the Gargoyle,
  // but light stone grey and genuinely four-winged (a larger front pair,
  // a smaller rear pair beating slightly out of phase, 2x the span of
  // the Gargoyle's own wings) -- matches the body js/game28.js animates
  // in flight.
  function drawWarden(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 28, seed = 41;
    const flap = t * 0.004;

    function drawWing(side, phase, color, spanMult, rootY) {
      const span = radius * spanMult, sweep = Math.sin(flap + phase) * 0.5;
      g.save();
      g.translate(0, rootY);
      g.scale(side, 1);
      g.rotate(0.25 + sweep);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(span * 0.5, -span * 0.35, span, -span * 0.1);
      g.quadraticCurveTo(span * 0.6, span * 0.15, span * 0.3, span * 0.05);
      g.quadraticCurveTo(span * 0.15, span * 0.1, 0, 0);
      g.closePath();
      g.fillStyle = color;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 0.75;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 1;
      [0.4, 0.7, 1].forEach((f) => {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(span * f, -span * 0.1 * f);
        g.stroke();
      });
      g.restore();
    }
    drawWing(-1, 0, '#6e7278', 2.6, radius * 0.1);
    drawWing(1, 0, '#6e7278', 2.6, radius * 0.1);
    drawWing(-1, 0.6, '#8a8e96', 3.8, -radius * 0.2);
    drawWing(1, 0.6, '#8a8e96', 3.8, -radius * 0.2);

    const stubCount = 5;
    for (let i = 0; i < stubCount; i++) {
      const a = (i / stubCount) * Math.PI + Math.PI * 0.5 + seed * 0.1;
      const len = radius * 0.9;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + radius * 0.4;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.14, '#5a5e64');
    }

    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.3, 2, 0, 0, radius);
    grad.addColorStop(0, '#9a9ea6');
    grad.addColorStop(1, '#55585e');
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = '#000';
    g.shadowBlur = 12;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#3a3c40';
    g.lineWidth = 2.5;
    g.stroke();

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + seed * 0.5;
      const bx = Math.cos(a) * radius * 0.65, by = Math.sin(a) * radius * 0.65;
      g.beginPath();
      g.arc(bx, by, radius * 0.14, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fill();
    }

    const er = radius * 0.32;
    g.beginPath();
    g.arc(0, 0, er * 1.3, 0, Math.PI * 2);
    g.fillStyle = '#16181c';
    g.fill();
    g.shadowColor = '#4a6a8a';
    g.shadowBlur = 6;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#4a6a8a';
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.ellipse(0, 0, er * 0.3, er * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = '#050208';
    g.fill();

    g.restore();
  }

  // The runt of the same family -- half the Warden's radius, no real
  // flight despite a pair of wings oversized for its own body, very dark
  // grey, and a single pale, vein-shot sclera around a dark red
  // bloodshot iris instead of a glowing dot -- matches js/game29.js's
  // own Grotesque.
  function drawGrotesque(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 28 * 0.5, seed = 17;
    const flap = Math.sin(t * 0.004 + seed) * 0.35;

    [-1, 1].forEach((side) => {
      const span = radius * 5.2;
      g.save();
      g.translate(0, -radius * 0.15);
      g.scale(side, 1);
      g.rotate(0.3 + flap);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(span * 0.5, -span * 0.4, span, -span * 0.12);
      g.quadraticCurveTo(span * 0.55, span * 0.12, span * 0.28, span * 0.05);
      g.quadraticCurveTo(span * 0.14, span * 0.08, 0, 0);
      g.closePath();
      g.fillStyle = '#232224';
      g.fill();
      g.strokeStyle = 'rgba(210,210,220,0.3)';
      g.lineWidth = 0.75;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 0.4;
      [0.4, 0.75, 1].forEach((f) => {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(span * f, -span * 0.12 * f);
        g.stroke();
      });
      g.restore();
    });

    const legCount = 3;
    for (let i = 0; i < legCount; i++) {
      const a = Math.PI * 0.25 + (i / (legCount - 1)) * Math.PI * 0.5;
      const len = radius * 0.8;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + radius * 0.5;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.2, '#1c1a1c');
    }

    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius);
    grad.addColorStop(0, '#2a282c');
    grad.addColorStop(1, '#121113');
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = '#000';
    g.shadowBlur = 10;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.stroke();

    const er = radius * 0.55;
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.72, 0, 0, Math.PI * 2);
    g.fillStyle = '#d8b8b4';
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(0, 0, er, er * 0.72, 0, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(180,20,20,0.7)';
    g.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * er * 1.2, Math.sin(a) * er * 1.2);
      g.lineTo(0, 0);
      g.stroke();
    }
    g.restore();
    g.beginPath();
    g.arc(0, 0, er * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#9c1414';
    g.shadowColor = '#ff2020';
    g.shadowBlur = 5;
    g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    g.arc(0, 0, er * 0.16, 0, Math.PI * 2);
    g.fillStyle = '#0a0304';
    g.fill();

    g.restore();
  }

  // The chapter 6 boss: the same family build blown up to 2.5x scale
  // with one giant eye instead of the family's small one -- matches
  // js/game30.js's own portrait pose. Click the portrait for phase 2
  // ("Primal Form"): every color genuinely inverted, wings 1.5x bigger,
  // and the eye flashes black and white.
  function drawGarguantuagoyle(g, w, h, t, phase2) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const radius = 50, seed = 7;
    const flap = t * 0.0035;
    if (phase2) g.scale(0.72, 0.72); // room for the 1.5x wings inside the portrait
    const inv = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      const f = (v) => (255 - v).toString(16).padStart(2, '0');
      return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
    };
    const col = (hex) => (phase2 ? inv(hex) : hex);

    function wing(side, span) {
      const sweep = Math.sin(flap) * 0.5;
      g.save();
      g.translate(0, radius * 0.05);
      g.scale(side, 1);
      g.rotate(0.25 + sweep);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(span * 0.5, -span * 0.35, span, -span * 0.1);
      g.quadraticCurveTo(span * 0.6, span * 0.15, span * 0.3, span * 0.05);
      g.quadraticCurveTo(span * 0.15, span * 0.1, 0, 0);
      g.closePath();
      g.fillStyle = col('#5a5e64');
      g.fill();
      g.strokeStyle = phase2 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 0.75;
      g.stroke();
      g.restore();
    }
    const wingSpan = radius * 2.9 * (phase2 ? 1.5 : 1);
    wing(-1, wingSpan);
    wing(1, wingSpan);

    const legCount = 7;
    for (let i = 0; i < legCount; i++) {
      const a = Math.PI * 0.18 + (i / (legCount - 1)) * Math.PI * 0.64;
      const len = radius * 0.95;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len + radius * 0.55;
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, radius * 0.1, col('#2e3034'));
    }

    const grad = g.createRadialGradient(-radius * 0.3, -radius * 0.3, 2, 0, 0, radius);
    grad.addColorStop(0, col('#7a7e84'));
    grad.addColorStop(1, col('#3a3c40'));
    g.beginPath();
    g.arc(0, 0, radius, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = '#000';
    g.shadowBlur = 14;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = col('#202224');
    g.lineWidth = 3;
    g.stroke();

    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + seed * 0.5;
      const bx = Math.cos(a) * radius * 0.65, by = Math.sin(a) * radius * 0.65;
      g.beginPath();
      g.arc(bx, by, radius * 0.1, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fill();
    }

    const er = radius * 0.62, ecy = -radius * 0.02;
    if (phase2) {
      // flashing black and white
      const on = Math.floor(t / 140) % 2 === 0;
      const a = on ? '#ffffff' : '#000000';
      const b = on ? '#000000' : '#ffffff';
      g.beginPath(); g.arc(0, ecy, er * 1.12, 0, Math.PI * 2); g.fillStyle = b; g.fill();
      g.beginPath(); g.arc(0, ecy, er, 0, Math.PI * 2); g.fillStyle = a; g.fill();
      g.beginPath(); g.arc(0, ecy, er * 0.5, 0, Math.PI * 2); g.fillStyle = b; g.fill();
      g.beginPath(); g.ellipse(0, ecy, er * 0.14, er * 0.45, 0, 0, Math.PI * 2); g.fillStyle = a; g.fill();
    } else {
      g.beginPath(); g.arc(0, ecy, er * 1.12, 0, Math.PI * 2); g.fillStyle = '#0c0608'; g.fill();
      g.beginPath(); g.arc(0, ecy, er, 0, Math.PI * 2);
      g.fillStyle = '#c81020'; g.shadowColor = '#ff2020'; g.shadowBlur = 14; g.fill(); g.shadowBlur = 0;
      g.beginPath(); g.arc(0, ecy, er * 0.62, 0, Math.PI * 2); g.fillStyle = '#e83a3a'; g.fill();
      g.beginPath(); g.ellipse(0, ecy, er * 0.14, er * 0.5, 0, 0, Math.PI * 2); g.fillStyle = '#1a0608'; g.fill();
      g.beginPath(); g.arc(-er * 0.3, ecy - er * 0.3, er * 0.12, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
    }

    g.restore();
  }


  // ---- The Multipod (Level 31): every monster in the game, bosses included,
  // in one swarm. The layout and member drawing are shared verbatim with
  // js/game31.js; each member is drawn with the real portrait function
  // for its monster (see window.MonsterModels below).
  // The Multipod: every monster in the game, bosses included, packed into
  // one swarm, each drawn with that monster's own model. Bosses are drawn
  // much bigger.
  function swarmRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // id order matches the Monsterpedia. Second value = size relative to the
  // swarm's spread: small pack creatures, normal, big armored ones, bosses.
  const SWARM_DEFS = [
    ['Crawler', 0.16], ['Drifter', 0.17], ['Caterpillar', 0.16], ['Mimic', 0.16], ['Crate Lurker', 0.15],
    ['Ashen One', 0.34], ['Knight', 0.17], ['Mine Dweller', 0.18], ['Vault Guardian', 0.24], ['Chain Wraith', 0.15],
    ['Dig Worm', 0.2], ['Last Knight', 0.34], ['Frost Tentacle', 0.17], ['Mutation', 0.17], ['Brood', 0.09],
    ['Thaw Spider', 0.16], ['Frozen Mutation', 0.34], ['Flood Eel', 0.17], ['Bog', 0.19], ['Current Eel', 0.17],
    ['Drain Swarm', 0.08], ['Cistern', 0.34], ['Grass Drifter', 0.17], ['Kindling', 0.16], ['Stalker', 0.16],
    ['Sentry', 0.17], ['Cultivator', 0.34], ['Reacher', 0.17], ['Gargoyle', 0.17], ['Warden', 0.17],
    ['Grotesque', 0.09], ['Garguantuagoyle', 0.36],
  ];
  // One of every monster, plus a few extra of the ones that come in packs
  // (the Brood, the Drain Swarm, the Grotesques).
  const SWARM_EXTRAS = [14, 14, 14, 14, 20, 20, 20, 20, 20, 20, 30, 30, 30, 30, 30, 30];
  function makeSwarmMembers(spread, seed) {
    const r = swarmRng(seed);
    const ids = SWARM_DEFS.map((_, i) => i).concat(SWARM_EXTRAS);
    const arr = ids.map((id) => ({
      id, ang: r() * Math.PI * 2, rad: Math.sqrt(r()) * spread,
      size: spread * SWARM_DEFS[id][1] * (0.92 + r() * 0.16),
      phase: r() * 10, spin: r() - 0.5,
    }));
    arr.sort((a, b) => b.size - a.size);
    return arr;
  }
  function swCirc(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  // Each member IS the actual model of the monster it's based on: the same
  // portrait drawing the Monsterpedia uses (window.MonsterModels, from
  // js/monsterpedia.js), scaled so its overall reach is about 1.5x the
  // member's body size. The model is rendered once into a cached sprite
  // (refreshed ~10x a second, so it still animates) rather than redrawn in
  // full for every one of the swarm's members every frame.
  function drawSwarmMember(g, id, s, now, ph, flash) {
    const M = window.MonsterModels;
    if (!M) return;
    const k = (s * 1.5) / M.extent(id);
    g.save();
    g.scale(k, k);
    g.drawImage(M.sprite(id, now), -80, -80);
    g.restore();
    if (flash) swCirc(g, 0, 0, s * 1.1, 'rgba(255,255,255,0.6)');
  }
  function drawSwarm(g, cx, cy, heading, now, members, spread, flash, scatter) {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    members.forEach((m) => {
      const a = m.ang + now * 0.0014 * m.spin;
      let u = Math.cos(a) * m.rad * 1.25 + Math.sin(now * 0.004 + m.phase) * spread * 0.03;
      let w = Math.sin(a) * m.rad * 0.8 + Math.cos(now * 0.0035 + m.phase) * spread * 0.03;
      if (scatter) { const k = 1 + scatter * 3.2; u *= k; w *= k; }
      g.save();
      g.translate(cx + u * cs - w * sn, cy + u * sn + w * cs);
      g.rotate(heading + Math.sin(now * 0.003 + m.phase) * 0.25 + (scatter ? scatter * m.spin * 6 : 0));
      if (scatter) g.globalAlpha = Math.max(0, 1 - scatter);
      drawSwarmMember(g, m.id, m.size, now, m.phase, flash);
      g.restore();
    });
  }

  const multipodMembers = makeSwarmMembers(52, 3131);
  function drawMultipod(g, w, h, t) {
    clear(g, w, h);
    drawSwarm(g, w / 2, h / 2, 0, t, multipodMembers, 52, false, 0);
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

  // The Ashen One's phase 2, Ashen One Magmatic (below 25 HP): the same burnt body, split
  // open with molten cracks and grown over with magma spikes -- game5.js draws the same two
  // overlays on the real boss. Shown by clicking the Ashen One's picture on the main menu.
  function drawBossMagmatic(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const seed = 74, radius = 46;
    const pulse = 0.8 + 0.2 * Math.sin(t * 0.004);
    const SPIKES = 11;
    for (let i = 0; i < SPIKES; i++) {      // spikes first, so the body sits over their roots
      const a = (i / SPIKES) * Math.PI * 2 + 0.2;
      const len = radius * (0.5 + 0.16 * Math.sin(i * 2.7 + 1));
      const bw = radius * 0.2;
      const bx = Math.cos(a) * radius * 0.86, by = Math.sin(a) * radius * 0.86;
      const tx = Math.cos(a) * (radius * 0.86 + len), ty = Math.sin(a) * (radius * 0.86 + len);
      const px = -Math.sin(a) * bw, py = Math.cos(a) * bw;
      g.beginPath();
      g.moveTo(bx + px, by + py); g.lineTo(tx, ty); g.lineTo(bx - px, by - py);
      g.closePath();
      g.fillStyle = '#1d0b08';
      g.fill();
      g.strokeStyle = `rgba(255,110,30,${0.75 * pulse})`;
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
      g.beginPath(); g.arc(tx, ty, 2.2, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,200,90,${pulse})`;
      g.fill();
    }
    drawBossTentacles(g, radius, t, seed, ['#1a0806', '#4a1210']);
    drawBlobBody(g, radius, '#2c0a06', '#ff5a1a', seed, t, { rim: '#0a0201', veinColor: 'rgba(255,120,40,0.35)' });
    g.save();                                // molten cracks, clipped to the body
    g.beginPath(); g.arc(0, 0, radius * 0.97, 0, Math.PI * 2); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + 0.35 * Math.sin(i * 3.1);
      let x = Math.cos(a) * radius * 0.12, y = Math.sin(a) * radius * 0.12;
      const pts = [[x, y]];
      for (let k = 0; k < 5; k++) {
        a += Math.sin(i * 5.3 + k * 2.1) * 0.7;
        x += Math.cos(a) * radius * 0.2; y += Math.sin(a) * radius * 0.2;
        pts.push([x, y]);
      }
      [[5, `rgba(255,70,10,${0.28 * pulse})`], [2.2, `rgba(255,150,40,${0.9 * pulse})`], [0.9, `rgba(255,235,160,${pulse})`]].forEach(([lw, col]) => {
        g.strokeStyle = col; g.lineWidth = lw;
        g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      });
    }
    g.restore();
    drawBossFlames(g, radius, t, seed);
    const angle = t * 0.0006;
    drawEye(g, radius, seed, { x: Math.cos(angle), y: Math.sin(angle) * 0.5 }, { irisHi: '#ffe27a', irisMid: '#ff7a1e', irisEdge: '#8a2208' });
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
  // Halloween-chapter entries unlock on that chapter's own progress.
  document.querySelectorAll('.monster-entry[data-halloween]').forEach((article) => {
    const n = parseInt(article.dataset.halloween, 10);
    if (!window.GoofyStory || window.GoofyStory.isHalloweenCompleted(n)) return;
    article.classList.add('locked');
    const h2 = article.querySelector('h2');
    const meta = article.querySelector('.monster-meta');
    const p = article.querySelector('p');
    if (h2) h2.textContent = '???';
    if (meta) meta.textContent = `Halloween ${n} — locked`;
    if (p) p.textContent = `Finish Halloween ${n} to unlock this entry.`;
  });
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


  // Halloween 2026's Hollow Jack: a pumpkin with eyeholes carved out,
  // worn by a mass of tentacles. Same drawing as the in-game creature
  // (js/halloween1.js), posed facing right.
  function drawHollowJack(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2 - 10, h / 2);
    const r = 31, ang = 0, seed = 7;
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) * 0.42;
      const a = ang + Math.PI + spread + Math.sin(t * 0.004 + i * 1.3 + seed) * 0.28;
      const len = r * (2.3 + 0.4 * Math.sin(t * 0.006 + i + seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.007 + i * 2.2 + seed) * r * 0.55;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.5, i % 2 ? '#4b2f66' : '#3a5a3a');
    }
    g.fillStyle = '#4a1a06';
    g.beginPath(); g.arc(0, 0, r * 1.18, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.15);
    body.addColorStop(0, '#ffb04a');
    body.addColorStop(0.55, '#ea7416');
    body.addColorStop(1, '#9a3c08');
    g.fillStyle = body;
    g.beginPath(); g.arc(0, 0, r * 1.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(100,36,4,0.55)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const a = ang + (i / 6) * Math.PI * 2 + Math.PI / 6;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
      g.quadraticCurveTo(Math.cos(a + 0.35) * r * 0.75, Math.sin(a + 0.35) * r * 0.75, Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08);
      g.stroke();
    }
    g.fillStyle = '#3d6a1c';
    g.fillRect(-r * 0.62, -r * 0.14, r * 0.42, r * 0.28);
    [-1, 1].forEach((side) => {
      const ex = r * 0.5, ey = side * r * 0.42;
      g.fillStyle = '#12060f';
      g.beginPath();
      g.moveTo(ex + r * 0.28, ey);
      g.lineTo(ex - r * 0.2, ey - r * 0.24);
      g.lineTo(ex - r * 0.2, ey + r * 0.24);
      g.closePath(); g.fill();
      g.fillStyle = `rgba(190,255,110,${0.55 + 0.35 * Math.sin(t * 0.01 + side * 2 + seed)})`;
      g.beginPath(); g.ellipse(ex - r * 0.02, ey + Math.sin(t * 0.008 + side) * r * 0.05, r * 0.07, r * 0.13, 0, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = '#12060f';
    g.beginPath();
    g.moveTo(r * 0.78, -r * 0.22);
    [[0.62, -0.1], [0.74, 0.0], [0.6, 0.1], [0.78, 0.22], [0.5, 0.3], [0.5, -0.3]].forEach(([dx, dy]) => g.lineTo(r * dx, r * dy));
    g.closePath(); g.fill();
    g.restore();
  }

  // The Halloween 2 ghost, drawn the way it looks while hunting (about 90%
  // opaque) -- on its roam it's only 5% visible, which would make for a
  // very empty portrait.
  function drawHush(g, w, h, t) {
    clear(g, w, h);
    g.save();
    g.translate(w / 2 - 10, h / 2);
    const r = 28, ang = 0, seed = 3;
    g.globalAlpha = 0.9;
    for (let i = 0; i < 8; i++) {
      const spread = (i - 3.5) * 0.38;
      const a = ang + Math.PI + spread + Math.sin(t * 0.0035 + i * 1.3 + seed) * 0.3;
      const len = r * (2.4 + 0.5 * Math.sin(t * 0.005 + i + seed));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = Math.sin(t * 0.006 + i * 2.2 + seed) * r * 0.6;
      drawTaperedTentacle(g, tx, ty, tx / 2 - Math.sin(a) * bow, ty / 2 + Math.cos(a) * bow, r * 0.42, i % 2 ? '#dfeef6' : '#bcd3e0');
    }
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = r * 1.12 + Math.sin(t * 0.005 + i * 1.9 + seed) * r * 0.1;
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
    g.fillStyle = '#050508';
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.ellipse(r * 0.42, side * r * 0.38, r * 0.3, r * 0.2, Math.PI / 2, 0, Math.PI * 2);
      g.fill();
    });
    g.restore();
  }

  // The Halloween 4 Embergourd: a hulking pumpkin with tentacles and a
  // smouldering face (same drawing as in js/halloween4.js).
  function drawEmbergourd(g, w, h, t) {
    clear(g, w, h);
    const cyc = t % 4200;
    const FIREBALL_WINDUP_MS = 500;
    const m = { radius: 26, lookDir: { x: Math.cos(t * 0.0008), y: Math.sin(t * 0.0008) * 0.6 }, state: 'alert', seed: 3, frozenUntil: 0,
      windUpAt: cyc > 3000 && cyc < 3700 ? t - cyc + 3700 : 0, castUntil: cyc >= 3700 && cyc < 3860 ? t + 100 : 0, x: 0, y: 0, tentacleTargets: [] };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    g.save();
    g.translate(w / 2 - 6, h / 2 + 2);
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const hunting = m.state === 'alert';
    const cast = clamp(((m.windUpAt || 0) - t) / FIREBALL_WINDUP_MS, 0, 1);           // 1 -> 0 as the shot winds up
    const flaring = (m.windUpAt && t < m.windUpAt) || t < (m.castUntil || 0);
    const hop = Math.abs(Math.sin(t * (hunting ? 0.016 : 0.009) + m.seed)) * (hunting ? 5 : 3);
    g.save();
    g.translate(0, 0);

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
    g.fillStyle = '#4a3a06';
    g.beginPath(); g.ellipse(0, r * 0.12, r * 1.18, r * 1.02, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.4, 2, 0, 0, r * 1.2);
    body.addColorStop(0, '#fff09a'); body.addColorStop(0.55, '#f2c21a'); body.addColorStop(1, '#9a7208');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, 0, r * 1.16, r, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(110,80,4,0.6)'; g.lineWidth = 1.6;
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
    if (window.HardMode && window.HardMode.on) {                                           // red-eyed in hard mode
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
    g.restore();
  }

  // The Level 18 Luminescent: a dark purple eel with lights down its sides
  // (same look as in js/game18.js).
  function drawLuminescent(g, w, h, t) {
    clear(g, w, h);
    const n = 17, hunting = Math.floor(t / 2500) % 2 === 1;
    const pos = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = w * 0.84 - u * w * 0.7;
      const y = h * 0.5 + Math.sin(t * 0.003 - u * 6) * h * 0.2 * (0.35 + u);
      pos.push({ x, y });
    }
    const ang = (i) => {
      const a = pos[Math.max(0, i - 1)], b = pos[Math.min(n - 1, i + 1)];
      return Math.atan2(a.y - b.y, a.x - b.x);
    };
    const rad = (i) => 2.5 + 8 * Math.pow(1 - i / (n - 1), 0.6);
    for (let i = n - 1; i >= 0; i--) {
      g.fillStyle = '#1b0a28'; g.beginPath(); g.arc(pos[i].x, pos[i].y, rad(i) + 1.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = i % 2 ? '#35124d' : '#2c0f42'; g.beginPath(); g.arc(pos[i].x, pos[i].y, rad(i), 0, Math.PI * 2); g.fill();
    }
    g.save();
    g.globalCompositeOperation = 'lighter';
    const col = hunting ? '255,95,150' : '110,245,255';
    for (let i = 1; i < n; i++) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 0.008 - i * 0.9);
      [-1, 1].forEach((side) => {
        const a = ang(i) + side * Math.PI / 2;
        const lx = pos[i].x + Math.cos(a) * (rad(i) - 1), ly = pos[i].y + Math.sin(a) * (rad(i) - 1);
        const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 10);
        gr.addColorStop(0, `rgba(${col},${0.85 * pulse})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, 10, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(255,255,255,${0.9 * pulse})`; g.beginPath(); g.arc(lx, ly, 1.5, 0, Math.PI * 2); g.fill();
      });
    }
    g.restore();
    const hd = pos[0], ha = ang(0);
    g.fillStyle = '#1b0a28';
    g.beginPath(); g.ellipse(hd.x + Math.cos(ha) * 5, hd.y + Math.sin(ha) * 5, 12, 8, ha, 0, Math.PI * 2); g.fill();
    [-1, 1].forEach((side) => {
      g.fillStyle = hunting ? '#ff4f7a' : '#d9a8ff';
      g.beginPath(); g.arc(hd.x + Math.cos(ha) * 8 + Math.cos(ha + side * Math.PI / 2) * 4.5, hd.y + Math.sin(ha) * 8 + Math.sin(ha + side * Math.PI / 2) * 4.5, 2.2, 0, Math.PI * 2); g.fill();
    });
  }

  // The Halloween 3 Rotten One: a rotting jack-o-lantern (same drawing as in
  // js/halloween3.js). The portrait lets out its low scream for a second every
  // five seconds.
  function drawRottenBody(g, t, m) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const r = m.radius;
    const look = m.lookDir || { x: 1, y: 0 };
    const ang = Math.atan2(look.y, look.x);
    const scream = clamp(((m.screamUntil || 0) - t) / 1000, 0, 1);       // 1 just as it screams, fading out
    const swell = (1 + 0.2 * Math.sin(scream * Math.PI)) * (1 + 0.04 * Math.sin(t * 0.0035 + m.seed));
    const flick = 0.8 + 0.2 * Math.sin(t * 0.021 + m.seed) * Math.sin(t * 0.007 + m.seed * 2);
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

    // the rotting jack-o-lantern: a squat, slumped, mouldy pumpkin
    g.scale(swell, swell);
    g.fillStyle = '#1c1204';
    g.beginPath(); g.ellipse(0, r * 0.1, r * 1.26, r * 1.0, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 2, 0, 0, r * 1.25);
    body.addColorStop(0, '#8e7440'); body.addColorStop(0.5, '#5a3c16'); body.addColorStop(1, '#1e1204');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, 0, r * 1.2, r * 0.96, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(28,14,2,0.55)'; g.lineWidth = 1.6;
    [-0.62, -0.3, 0.3, 0.62].forEach((k) => {
      g.beginPath();
      g.ellipse(0, 0, r * 1.2 * Math.abs(1 - Math.abs(k) * 0.75), r * 0.96, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    // mould furring the skin, and a soggy cave-in
    g.fillStyle = 'rgba(80,115,40,0.7)';
    g.beginPath(); g.ellipse(-r * 0.7, -r * 0.35, r * 0.4, r * 0.26, 0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(r * 0.6, r * 0.55, r * 0.42, r * 0.24, -0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-r * 0.25, r * 0.7, r * 0.3, r * 0.16, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(205,215,185,0.5)';
    g.beginPath(); g.ellipse(-r * 0.15, -r * 0.8, r * 0.3, r * 0.13, 0.1, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(r * 0.3, r * 0.05, r * 0.14, r * 0.08, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(20,10,0,0.7)';
    g.beginPath(); g.ellipse(r * 0.7, -r * 0.45, r * 0.38, r * 0.26, 0.5, 0, Math.PI * 2); g.fill();
    // a shrivelled, blackened stem leaning off the top
    g.fillStyle = '#2a2208';
    g.beginPath(); g.moveTo(-r * 0.16, -r * 0.88); g.lineTo(r * 0.14, -r * 0.9); g.lineTo(r * 0.42, -r * 1.28); g.lineTo(r * 0.14, -r * 1.34); g.closePath(); g.fill();

    // the carved face, sagging and caved in, a sick green light guttering behind it
    g.save();
    g.translate(look.x * r * 0.08, look.y * r * 0.05);
    const open = 0.15 + 0.85 * scream;
    const faceCol = scream > 0.2 ? '#f2ffa0' : '#aac838';
    g.shadowColor = '#8ab01a'; g.shadowBlur = 6 + 8 * scream;
    g.globalAlpha = Math.min(1, 0.85 * flick + 0.2 * scream);
    g.fillStyle = faceCol;
    g.beginPath();                                                       // eyes: one sunken and lopsided, one slumped half off its place
    g.moveTo(-r * 0.75, -r * 0.02); g.lineTo(-r * 0.22, -r * 0.08); g.lineTo(-r * 0.5, -r * 0.52); g.closePath();
    g.moveTo(r * 0.74, r * 0.04); g.lineTo(r * 0.28, -r * 0.04); g.lineTo(r * 0.58, -r * 0.34); g.closePath();
    g.fill();
    g.beginPath();                                                       // a crooked, gap-toothed grin that sags open
    g.moveTo(-r * 0.78, r * 0.2);
    [[-0.66, 0.34], [-0.58, 0.2], [-0.45, 0.22], [-0.38, 0.4], [-0.22, 0.26], [0.0, 0.3], [0.08, 0.52], [0.2, 0.3], [0.4, 0.34], [0.5, 0.58], [0.62, 0.32], [0.78, 0.28]]
      .forEach(([dx, dy]) => g.lineTo(r * dx, r * (dy + (dy > 0.3 ? open * 0.4 : 0))));
    g.lineTo(r * 0.7, r * 0.14); g.lineTo(r * 0.3, r * 0.2); g.lineTo(r * 0.2, r * 0.36 + open * r * 0.1);
    g.lineTo(r * 0.1, r * 0.2); g.lineTo(-r * 0.3, r * 0.22); g.lineTo(-r * 0.5, r * 0.12);
    g.closePath(); g.fill();
    g.shadowBlur = 0; g.globalAlpha = 1;
    // rot dripping out of the carved holes
    g.fillStyle = '#5a5420';
    [[-0.5, -0.02, 0.22], [0.5, 0.06, 0.28], [-0.1, 0.3, 0.26], [0.45, 0.4, 0.2]].forEach(([dx, dy, dl], i) => {
      const len = r * (dl + 0.1 * Math.sin(t * 0.004 + i * 2 + m.seed));
      g.beginPath(); g.ellipse(r * dx, r * dy + len / 2, r * 0.05, len / 2, 0, 0, Math.PI * 2); g.fill();
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

  function drawRotten(g, w, h, t) {
    clear(g, w, h);
    const ph = t % 5000;
    const m = { radius: 28, lookDir: { x: 1, y: 0 }, seed: 6, tentacleTargets: [], frozenUntil: 0, x: 0, y: 0, screamUntil: ph < 1000 ? t + (1000 - ph) : 0 };
    g.save();
    g.translate(w / 2 - 10, h / 2);
    drawRottenBody(g, t, m);
    g.restore();
  }

  // The Halloween 5 boss, the Pumpkin King, in the same drawing as the game
  // (js/halloween5.js). Click the portrait to see it flourished.
  // a flame teardrop standing on (x, y): used for eruptions and the mouth
  function drawFlameTongue(g, x, y, w, h, t, seed, blue) {
    const sway = Math.sin(t * 0.012 + seed) * w * 0.35;
    const flick = 0.9 + 0.1 * Math.sin(t * 0.03 + seed * 2);
    h *= flick;
    const layers = blue ? [['#1a3aff', 1], ['#3a8aff', 0.72], ['#8ad0ff', 0.46], ['#eefaff', 0.22]]
      : [['#ff3a10', 1], ['#ff8a1e', 0.72], ['#ffd25a', 0.46], ['#fff6c8', 0.22]];
    layers.forEach(([col, k]) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - w * k * 0.5, y);
      g.quadraticCurveTo(x - w * k * 0.55 + sway * 0.4, y - h * k * 0.55, x + sway * k, y - h * k);
      g.quadraticCurveTo(x + w * k * 0.55 + sway * 0.4, y - h * k * 0.55, x + w * k * 0.5, y);
      g.closePath(); g.fill();
    });
  }

  // Everything the boss is made of, drawn on a scratch canvas centered on the
  // origin: thick green vine-tentacles writhing out from under a huge ribbed
  // orange pumpkin, a carved face, and a fire burning in its mouth. Flourished,
  // it turns green, grows a much bigger nest of leafy vines, and the fire in it
  // burns blue.
  function drawPumpkinParts(s, now, flourished, stunned, screaming, boss) {
    const r = boss.radius;
    const look = boss.lookDir || { x: 0, y: 1 };

    // tentacles
    const curl = boss.curl || 0;                                // 0..1: how tightly the vines have curled up against it
    const tentCount = flourished ? 16 : 9;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + Math.sin(now * 0.0017 + i) * 0.2;
      let len = r * ((flourished ? 1.95 : 1.5) + 0.28 * Math.sin(now * 0.004 + i * 1.7 + boss.seed));
      if (stunned) len *= 0.8;
      len *= 1 - 0.68 * curl;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = (stunned ? 0.2 : 1 - 0.6 * curl) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.45 + curl * r * 0.35;
      const mx = tx / 2 - Math.sin(a) * bow, my = ty / 2 + Math.cos(a) * bow;
      const col = flourished ? (i % 2 ? '#4fb82a' : '#2f8a1c') : (i % 2 ? '#5c9a30' : '#417022');
      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.3, col);
      if (flourished) {                                          // leaves along each vine
        [0.4, 0.7].forEach((u, j) => {
          const px = 2 * (1 - u) * u * mx + u * u * tx, py = 2 * (1 - u) * u * my + u * u * ty;
          s.fillStyle = '#7be040';
          s.beginPath(); s.ellipse(px + Math.cos(a + 1.4) * 5, py + Math.sin(a + 1.4) * 5, r * 0.13, r * 0.055, a + 0.9 * (j ? -1 : 1), 0, Math.PI * 2); s.fill();
        });
      }
      s.strokeStyle = flourished ? '#b8ff7a' : '#6fbf3a'; s.lineWidth = 1.8;
      s.beginPath(); s.arc(tx + Math.cos(a + 1.2) * 3, ty + Math.sin(a + 1.2) * 3, 3.4, a - 2, a + 3.4); s.stroke();
    }

    s.save();
    if (stunned) s.scale(1.06, 0.93);
    const rx = r, ry = r * 0.9;
    // shadowed underside, then the ribbed body
    s.fillStyle = flourished ? '#10300a' : '#4a1a06';
    s.beginPath(); s.ellipse(0, ry * 0.1, rx * 1.02, ry * 1.03, 0, 0, Math.PI * 2); s.fill();
    const body = s.createRadialGradient(-rx * 0.3, -ry * 0.4, 3, 0, 0, rx * 1.15);
    if (flourished) { body.addColorStop(0, '#c4f27a'); body.addColorStop(0.55, '#5cb030'); body.addColorStop(1, '#1f5212'); }
    else { body.addColorStop(0, '#ffb24a'); body.addColorStop(0.55, '#ee6a0e'); body.addColorStop(1, '#8f3208'); }
    s.fillStyle = body;
    s.beginPath(); s.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); s.fill();
    s.strokeStyle = flourished ? 'rgba(8,50,8,0.6)' : 'rgba(100,32,4,0.6)'; s.lineWidth = 2.4;
    [-0.66, -0.34, 0, 0.34, 0.66].forEach((k) => {
      s.beginPath();
      s.ellipse(0, 0, rx * Math.abs(1 - Math.abs(k) * 0.75), ry, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      s.stroke();
    });
    s.fillStyle = 'rgba(255,255,255,0.28)';
    s.beginPath(); s.ellipse(-rx * 0.38, -ry * 0.5, rx * 0.26, ry * 0.12, -0.5, 0, Math.PI * 2); s.fill();
    if (flourished) {                                           // vines wrapped round the body, with leaves
      s.lineCap = 'round';
      [[-0.95, -0.2, -0.3, 0.35, 0.5, -0.75], [0.95, 0.15, 0.3, -0.3, -0.6, -0.65], [-0.7, 0.7, 0.0, 0.2, 0.8, 0.55]].forEach(([x0, y0, cx0, cy0, x1, y1], i) => {
        s.strokeStyle = '#1f6a14'; s.lineWidth = r * 0.07;
        s.beginPath(); s.moveTo(rx * x0, ry * y0); s.quadraticCurveTo(rx * cx0, ry * cy0, rx * x1, ry * y1); s.stroke();
        s.strokeStyle = '#4fb82a'; s.lineWidth = r * 0.04; s.stroke();
        [0.3, 0.6, 0.85].forEach((u, j) => {
          const px = 2 * (1 - u) * u * rx * cx0 + (1 - u) * (1 - u) * rx * x0 + u * u * rx * x1;
          const py = 2 * (1 - u) * u * ry * cy0 + (1 - u) * (1 - u) * ry * y0 + u * u * ry * y1;
          s.fillStyle = '#7be040';
          s.beginPath(); s.ellipse(px, py - 4, r * 0.1, r * 0.045, (i + j) % 2 ? -0.6 : 0.6, 0, Math.PI * 2); s.fill();
        });
      });
    }
    // stem, and a curling vine
    s.fillStyle = flourished ? '#3a8a1a' : '#4a5a1c';
    s.beginPath(); s.moveTo(-r * 0.14, -ry * 0.92); s.lineTo(r * 0.16, -ry * 0.92); s.lineTo(r * 0.24, -ry * 1.3); s.lineTo(-r * 0.2, -ry * 1.26); s.closePath(); s.fill();
    s.strokeStyle = flourished ? '#7be040' : '#4fae3a'; s.lineWidth = 3;
    s.beginPath(); s.moveTo(r * 0.2, -ry * 1.05); s.quadraticCurveTo(r * 0.8, -ry * 1.2, r * 0.7, -ry * 0.7); s.quadraticCurveTo(r * 0.6, -ry * 0.5, r * 0.45, -ry * 0.62); s.stroke();
    if (flourished) {                                           // big leaves round the stem, and the stem's alight with blue fire
      [[-0.42, -0.98, -0.5], [0.46, -1.0, 0.5], [-0.6, -0.78, -0.9], [0.62, -0.8, 0.9]].forEach(([lx, ly, rot]) => {
        s.fillStyle = '#58b830';
        s.beginPath(); s.ellipse(r * lx, ry * ly, r * 0.26, r * 0.1, rot, 0, Math.PI * 2); s.fill();
        s.strokeStyle = '#2f8a1c'; s.lineWidth = 1.5;
        s.beginPath(); s.moveTo(r * lx - Math.cos(rot) * r * 0.24, ry * ly - Math.sin(rot) * r * 0.24); s.lineTo(r * lx + Math.cos(rot) * r * 0.24, ry * ly + Math.sin(rot) * r * 0.24); s.stroke();
      });
      drawFlameTongue(s, r * 0.03, -ry * 1.2, r * 0.45, r * 0.7, now, 3 + boss.seed, true);
      drawFlameTongue(s, -r * 0.1, -ry * 1.2, r * 0.3, r * 0.45, now, 8 + boss.seed, true);
    }

    // the carved face: glowing eyes, and a mouth with a fire burning in it
    const fx = look.x * r * 0.06, fy = look.y * r * 0.04;
    s.save(); s.translate(fx, fy);
    const flick = 0.85 + 0.15 * Math.sin(now * 0.03 + boss.seed);
    const eyeCol = stunned ? (flourished ? '#4a6a8a' : '#8a5a2a') : screaming ? '#ffffff' : flourished ? '#aee4ff' : '#ffe27a';
    s.shadowColor = flourished ? '#2a8aff' : '#ff6a10'; s.shadowBlur = stunned ? 2 : 14;
    s.fillStyle = eyeCol; s.globalAlpha = stunned ? 0.8 : Math.min(1, 0.9 * flick + (screaming ? 0.2 : 0));
    [-1, 1].forEach((side) => {
      s.beginPath();
      s.moveTo(side * r * 0.62, -ry * 0.02); s.lineTo(side * r * 0.2, -ry * 0.02); s.lineTo(side * r * 0.42, -ry * 0.5); s.closePath(); s.fill();
    });
    s.shadowBlur = 0; s.globalAlpha = 1;
    if (stunned) {                                           // dizzy swirls where the pupils would be
      s.strokeStyle = flourished ? '#0a1a2a' : '#2a0e04'; s.lineWidth = 2;
      [-1, 1].forEach((side) => {
        const ex = side * r * 0.42, ey = -ry * 0.16;
        s.beginPath();
        for (let a = 0; a < 9; a += 0.4) { const rr = a * r * 0.014; const px = ex + Math.cos(a + now * 0.01) * rr, py = ey + Math.sin(a + now * 0.01) * rr; if (a === 0) s.moveTo(px, py); else s.lineTo(px, py); }
        s.stroke();
      });
    }
    if (flourished && !stunned) {                            // blue flames licking up from the eyes
      [-1, 1].forEach((side, i) => drawFlameTongue(s, side * r * 0.42, -ry * 0.22, r * 0.26, r * 0.4, now, 20 + i * 3 + boss.seed, true));
    }

    // the mouth: a wide jagged hollow with the fire inside it
    const open = screaming ? 1.35 : stunned ? 0.55 : 0.85;
    const mw = r * 0.78, mh = ry * 0.5 * open, my0 = ry * 0.3;
    s.beginPath();
    s.moveTo(-mw, my0 - mh * 0.15);
    const teeth = 8;
    for (let i = 0; i <= teeth; i++) {
      const x = -mw + (2 * mw * i) / teeth;
      s.lineTo(x, my0 + (i % 2 ? mh * 0.55 : mh * 1.0));            // bottom edge, zig-zag
    }
    for (let i = teeth; i >= 0; i--) {
      const x = -mw + (2 * mw * i) / teeth;
      s.lineTo(x, my0 - mh * (i % 2 ? 0.1 : 0.45));                  // top edge, zig-zag
    }
    s.closePath();
    s.save();
    s.clip();
    const fire = s.createLinearGradient(0, my0 - mh * 0.5, 0, my0 + mh);
    if (stunned) { fire.addColorStop(0, flourished ? '#0a1a3a' : '#3a1608'); fire.addColorStop(1, flourished ? '#183a7a' : '#6a2a0c'); }
    else if (flourished) { fire.addColorStop(0, '#f0fcff'); fire.addColorStop(0.5, '#4aa8ff'); fire.addColorStop(1, '#1a3acc'); }
    else { fire.addColorStop(0, '#ffe9a0'); fire.addColorStop(0.5, '#ff9a2e'); fire.addColorStop(1, '#c8300a'); }
    s.fillStyle = fire; s.fillRect(-mw, my0 - mh, mw * 2, mh * 2.4);
    if (!stunned) {                                          // flames roiling inside
      for (let i = 0; i < 6; i++) drawFlameTongue(s, -mw * 0.72 + i * mw * 0.288, my0 + mh * 0.95, r * 0.2, mh * (1.2 + 0.4 * Math.sin(now * 0.02 + i)), now, i * 2.3 + boss.seed, flourished);
    }
    s.restore();
    s.strokeStyle = flourished ? '#0a2a08' : '#5a1c04'; s.lineWidth = 2;
    s.stroke();
    // fire pouring out over the lip: big when it roars, small tongues otherwise, nearly dead when stunned
    if (!stunned) {
      const n = screaming ? 9 : 5;
      for (let i = 0; i < n; i++) {
        const x = -mw * 0.8 + (1.6 * mw * i) / (n - 1);
        const hgt = (screaming ? 0.62 : flourished ? 0.45 : 0.34) * ry * (0.75 + 0.25 * Math.sin(now * 0.025 + i * 1.7 + boss.seed));
        drawFlameTongue(s, x, my0 - mh * 0.2, r * (screaming ? 0.3 : 0.2), hgt, now, i * 1.3 + boss.seed, flourished);
      }
    } else {
      for (let i = 0; i < 3; i++) drawFlameTongue(s, -mw * 0.4 + i * mw * 0.4, my0 - mh * 0.2, r * 0.12, ry * 0.18, now, i + boss.seed, flourished);
    }
    s.restore();
    s.restore();
  }

  function drawPumpkinKing(g, w, h, t, phase2) {
    clear(g, w, h);
    const boss = { radius: 32, lookDir: { x: Math.cos(t * 0.0006) * 0.4, y: 0.9 }, seed: 3 };
    g.save();
    g.translate(w / 2, h / 2 + 4);
    g.scale(0.72, 0.72);
    drawPumpkinParts(g, t, !!phase2, false, false, boss);
    if (phase2) {                     // chunks bitten out of it
      g.globalCompositeOperation = 'destination-out';
      [[0.6, 34], [2.4, 33], [4.2, 36]].forEach(([ang, rr]) => { g.beginPath(); g.arc(Math.cos(ang) * rr * 0.94, Math.sin(ang) * rr * 0.94, rr * 0.34, 0, Math.PI * 2); g.fill(); });
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
  }

  // The real portrait drawing for every monster, in Monsterpedia order, so
  // the Level 31 Multipod can be built out of the actual models.
  const MODEL_FNS = [drawCrawler, drawDrifter, drawCaterpillar, drawMimic, drawLurker, drawBoss, drawKnight,
    drawWinged, drawVaultGuardian, drawWraith, drawDigWorm, drawLastKnight, drawFrostTentacleCreature,
    drawMutation, drawBrood, drawThawSpider, drawFrozenMutation, drawEel, drawGreatEel, drawCurrentEel,
    drawTinyEels, drawCistern, drawGrassDrifter, drawKindling, drawStalker, drawSentry, drawCultivator,
    drawReacher, drawGargoyle, drawWarden, drawGrotesque, drawGarguantuagoyle, drawPumpkinKing,
    drawHollowJack, drawHush, drawRotten, drawEmbergourd, drawBossMagmatic];
  let modelExtents = null;
  function measureModelExtents() {
    const c = document.createElement('canvas');
    c.width = PORTRAIT; c.height = PORTRAIT;
    const g = c.getContext('2d');
    modelExtents = MODEL_FNS.map((fn) => {
      g.clearRect(0, 0, PORTRAIT, PORTRAIT);
      fn(g, PORTRAIT, PORTRAIT, 0, false);
      const d = g.getImageData(0, 0, PORTRAIT, PORTRAIT).data;
      let ext = 12;
      for (let y = 0; y < PORTRAIT; y++) {
        for (let x = 0; x < PORTRAIT; x++) {
          if (d[(y * PORTRAIT + x) * 4 + 3] > 24) ext = Math.max(ext, Math.abs(x - PORTRAIT / 2), Math.abs(y - PORTRAIT / 2));
        }
      }
      return ext;
    });
  }
  const modelSprites = {};
  window.MonsterModels = {
    // a cached 160x160 canvas with monster `id` centered in it, redrawn at
    // most every 100ms
    sprite(id, t) {
      let e = modelSprites[id];
      if (!e) {
        const c = document.createElement('canvas');
        c.width = PORTRAIT; c.height = PORTRAIT;
        e = modelSprites[id] = { c, g: c.getContext('2d'), t: -1e9 };
      }
      if (t - e.t > 100) {
        e.g.clearRect(0, 0, PORTRAIT, PORTRAIT);
        MODEL_FNS[id](e.g, PORTRAIT, PORTRAIT, t, false);
        e.t = t;
      }
      return e.c;
    },
    // half the portrait's overall reach (body plus appendages), in portrait px
    extent(id) { if (!modelExtents) measureModelExtents(); return modelExtents[id]; },
    // draws monster `id` centered on the current origin, unscaled
    draw(id, g, t) {
      swarmMode = true;
      g.save();
      g.translate(-PORTRAIT / 2, -PORTRAIT / 2);
      MODEL_FNS[id](g, PORTRAIT, PORTRAIT, t, false);
      g.restore();
      swarmMode = false;
    },
  };

  // In hard mode the gallery shows the hard version of every monster: drawn on
  // a scratch canvas first (so the pale wash only touches the monster's own
  // pixels), washed pale, and given the red-pupiled eyes the real game gives
  // it -- except the two that draw their own face.
  const HARD = !!(window.HardMode && window.HardMode.on);
  const hardCanvas = document.createElement('canvas');
  hardCanvas.width = hardCanvas.height = PORTRAIT;
  const hardG = hardCanvas.getContext('2d');
  const OWN_FACE = new Set([embergourdCtx, pumpkinKingCtx]);
  function drawHardPortrait(ctx, drawFn, t, phase2) {
    const g = hardG;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, PORTRAIT, PORTRAIT);
    drawFn(g, PORTRAIT, PORTRAIT, t, phase2);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(234,230,240,0.5)';
    g.fillRect(0, 0, PORTRAIT, PORTRAIT);
    g.globalCompositeOperation = 'source-over';
    if (!OWN_FACE.has(ctx) && window.HardMode.redEyes) window.HardMode.redEyes(g, PORTRAIT / 2, PORTRAIT / 2, 26, { x: 1, y: 0 });
    ctx.clearRect(0, 0, PORTRAIT, PORTRAIT);
    ctx.drawImage(hardCanvas, 0, 0);
  }

  function drawPortraitOrLock(ctx, drawFn, t, phase2) {
    if (!ctx) return;
    if (isLocked(ctx)) { drawLockedPlaceholder(ctx, PORTRAIT, PORTRAIT); return; }
    if (HARD) { drawHardPortrait(ctx, drawFn, t, phase2); return; }
    drawFn(ctx, PORTRAIT, PORTRAIT, t, phase2);
  }

  if (HARD) {
    const first = document.querySelector('.monster-entry');
    if (first && first.parentNode) {
      const note = document.createElement('p');
      note.className = 'hard-note';
      note.style.cssText = 'color:#ff6a5a;text-align:center;margin:0 auto 14px;max-width:640px';
      note.innerHTML = '<strong>HARD MODE:</strong> every monster is shown as it appears on a hard run &mdash; pale, with red pupils &mdash; and is <strong>1.25x faster</strong> than the speeds listed below, with bosses on <strong>1.5x</strong> the health.';
      first.parentNode.insertBefore(note, first);
    }
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
  wirePhase2Toggle(cultivatorCtx);
  wirePhase2Toggle(garguantuagoyleCtx);
  wirePhase2Toggle(pumpkinKingCtx);

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
      drawPortraitOrLock(luminescentCtx, drawLuminescent, t);
      drawPortraitOrLock(greatEelCtx, drawGreatEel, t);
      drawPortraitOrLock(tinyEelsCtx, drawTinyEels, t);
      drawPortraitOrLock(cisternCtx, drawCistern, t, phase2Shown.has(cisternCtx));
      drawPortraitOrLock(grassDrifterCtx, drawGrassDrifter, t);
      drawPortraitOrLock(kindlingCtx, drawKindling, t);
      drawPortraitOrLock(stalkerCtx, drawStalker, t);
      drawPortraitOrLock(sentryCtx, drawSentry, t);
      drawPortraitOrLock(cultivatorCtx, drawCultivator, t, phase2Shown.has(cultivatorCtx));
      drawPortraitOrLock(reacherCtx, drawReacher, t);
      drawPortraitOrLock(gargoyleCtx, drawGargoyle, t);
      drawPortraitOrLock(wardenCtx, drawWarden, t);
      drawPortraitOrLock(grotesqueCtx, drawGrotesque, t);
      drawPortraitOrLock(garguantuagoyleCtx, drawGarguantuagoyle, t, phase2Shown.has(garguantuagoyleCtx));
      drawPortraitOrLock(multipodCtx, drawMultipod, t);
      drawPortraitOrLock(hollowJackCtx, drawHollowJack, t);
      drawPortraitOrLock(hushCtx, drawHush, t);
      drawPortraitOrLock(rottenCtx, drawRotten, t);
      drawPortraitOrLock(embergourdCtx, drawEmbergourd, t);
      drawPortraitOrLock(pumpkinKingCtx, drawPumpkinKing, t, phase2Shown.has(pumpkinKingCtx));
    }
    requestAnimationFrame(loop);
  }
  // (Level 31 loads this file only for window.MonsterModels -- no portrait
  // canvases there, so nothing to animate.)
  if (document.getElementById('monster-canvas-crawler')) requestAnimationFrame(loop);
})();
