// Realistic eyes, painted once on demand into small canvases: skin and pores, sclera with blood vessels, a
// fibred iris with a limbal ring, wet highlights, a pink lower rim and lashes. Used by the Green Field's
// flashing eyes (js/leprechaun.js) and the Dream's hundred-eyed mushroom (js/dream.js).
(function () {
  function hash(x, y, k) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  const EYE_W = 320, EYE_H = 200;
  const IRISES = [
    ['#c98a4a', '#7a4a22', '#2a140a'], ['#7ab8e8', '#3a78b0', '#14304a'], ['#8fc46a', '#4a8a3a', '#1a3a14'],
    ['#d0a040', '#7a6a2a', '#2a2010'], ['#b8c4cc', '#6a7a86', '#1a2228'],
  ];
  const eyeCache = [];
  function bez(t, p0, p1, p2, p3) {
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  }
  function makeEye(v, gx, gy) {
    const c = document.createElement('canvas');
    c.width = EYE_W; c.height = EYE_H;
    const g = c.getContext('2d');
    const [hi, mid, edge] = IRISES[v];
    const A = [30, 104], U1 = [90, 18], U2 = [232, 10], B = [292, 98], L1 = [240, 182], L2 = [100, 192];
    // skin around it, darker toward the edges, with pores
    const sk = g.createRadialGradient(160, 100, 30, 160, 100, 175);
    sk.addColorStop(0, '#dcae90'); sk.addColorStop(0.55, '#c38d6e'); sk.addColorStop(1, '#85563f');
    g.fillStyle = sk; g.fillRect(0, 0, EYE_W, EYE_H);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = hash(i, v, 61) < 0.5 ? 'rgba(70,30,18,0.07)' : 'rgba(255,225,205,0.07)';
      g.fillRect(hash(i, v, 62) * EYE_W, hash(i, v, 63) * EYE_H, 1.4, 1.4);
    }
    // the fold of the upper lid, and the bag under the eye
    g.save();
    g.shadowColor = 'rgba(50,18,10,0.7)'; g.shadowBlur = 9;
    g.strokeStyle = 'rgba(80,36,22,0.55)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 80); g.bezierCurveTo(95, -6, 232, -14, 288, 74); g.stroke();
    g.strokeStyle = 'rgba(80,36,22,0.3)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(60, 150); g.bezierCurveTo(110, 200, 220, 204, 270, 146); g.stroke();
    g.restore();

    const eye = new Path2D();
    eye.moveTo(A[0], A[1]); eye.bezierCurveTo(U1[0], U1[1], U2[0], U2[1], B[0], B[1]); eye.bezierCurveTo(L1[0], L1[1], L2[0], L2[1], A[0], A[1]);
    g.save();
    g.shadowColor = 'rgba(30,8,4,0.8)'; g.shadowBlur = 10;
    g.fillStyle = '#2a0e0a'; g.fill(eye);
    g.restore();
    g.save();
    g.clip(eye);
    // sclera: warm white, greying into the corners where the lids shade it
    const sc = g.createRadialGradient(158, 104, 10, 160, 102, 150);
    sc.addColorStop(0, '#f8f3ec'); sc.addColorStop(0.6, '#e9dfd4'); sc.addColorStop(1, '#a89183');
    g.fillStyle = sc; g.fillRect(0, 0, EYE_W, EYE_H);
    // blood vessels from both corners
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const left = i % 2 === 0, y0 = 96 + (hash(i, v, 64) - 0.5) * 36;
      let x = left ? 34 : 288, y = y0;
      g.strokeStyle = `rgba(170,40,40,${0.12 + hash(i, v, 65) * 0.2})`; g.lineWidth = 0.6 + hash(i, v, 66) * 0.9;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (left ? 1 : -1) * (14 + hash(i, k, 67) * 16); y += (hash(i, k, 68) - 0.5) * 22; g.lineTo(x, y); }
      g.stroke();
    }
    // the iris: pupil, a pale collarette, fibres, a dark limbal ring
    const ix = 160 + gx * 34, iy = 102 + gy * 18, R = 66;   // gx, gy in -1..1: where the eye is looking
    const ig = g.createRadialGradient(ix, iy, R * 0.2, ix, iy, R);
    ig.addColorStop(0, mid); ig.addColorStop(0.35, hi); ig.addColorStop(0.75, mid); ig.addColorStop(0.93, edge); ig.addColorStop(1, '#0c0606');
    g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, R, 0, 6.283); g.fill();
    g.save();
    g.beginPath(); g.arc(ix, iy, R, 0, 6.283); g.clip();
    for (let i = 0; i < 260; i++) {
      const a = hash(i, v, 69) * 6.283, r0 = R * (0.3 + hash(i, v, 70) * 0.2), r1 = R * (0.7 + hash(i, v, 71) * 0.3);
      g.strokeStyle = hash(i, v, 72) < 0.5 ? hi : edge;
      g.globalAlpha = 0.18 + hash(i, v, 73) * 0.3; g.lineWidth = 0.7 + hash(i, v, 74) * 1.3;
      g.beginPath(); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0);
      g.lineTo(ix + Math.cos(a + (hash(i, v, 75) - 0.5) * 0.12) * r1, iy + Math.sin(a + (hash(i, v, 75) - 0.5) * 0.12) * r1); g.stroke();
    }
    g.globalAlpha = 1;
    g.restore();
    g.fillStyle = '#050304'; g.beginPath(); g.arc(ix, iy, R * 0.36, 0, 6.283); g.fill();
    // wet highlights: a soft window reflection and a pinprick
    g.save();
    g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 8;
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.roundRect ? g.roundRect(ix - 40, iy - 40, 26, 22, 5) : g.rect(ix - 40, iy - 40, 26, 22); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(ix + 26, iy + 24, 4.2, 0, 6.283); g.fill();
    g.restore();
    // the upper lid shades the top of the eye
    const lid = g.createLinearGradient(0, 8, 0, 100);
    lid.addColorStop(0, 'rgba(25,8,4,0.78)'); lid.addColorStop(1, 'rgba(25,8,4,0)');
    g.fillStyle = lid; g.fillRect(0, 0, EYE_W, EYE_H);
    const low = g.createLinearGradient(0, 190, 0, 140);
    low.addColorStop(0, 'rgba(25,8,4,0.4)'); low.addColorStop(1, 'rgba(25,8,4,0)');
    g.fillStyle = low; g.fillRect(0, 120, EYE_W, EYE_H);
    g.restore();
    // wet pink rim along the lower lid, the tear duct, the dark lash line
    g.strokeStyle = 'rgba(214,120,118,0.85)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(52, 118); g.bezierCurveTo(100, 172, 236, 172, 280, 106); g.stroke();
    g.fillStyle = '#d98a86'; g.beginPath(); g.ellipse(40, 106, 13, 8, 0.1, 0, 6.283); g.fill();
    g.fillStyle = '#e9aaa4'; g.beginPath(); g.ellipse(38, 104, 5, 3, 0, 0, 6.283); g.fill();
    g.strokeStyle = '#1a0806'; g.lineWidth = 4.5;
    g.beginPath(); g.moveTo(A[0], A[1]); g.bezierCurveTo(U1[0], U1[1], U2[0], U2[1], B[0], B[1]); g.stroke();
    // lashes
    g.strokeStyle = '#120706'; g.lineCap = 'round';
    for (let i = 0; i < 54; i++) {
      const t = 0.06 + (i / 53) * 0.9, [px, py] = bez(t, A, U1, U2, B), [qx, qy] = bez(Math.min(1, t + 0.01), A, U1, U2, B);
      const tx = qx - px, ty = qy - py, tl = Math.hypot(tx, ty) || 1, nx = ty / tl, ny = -tx / tl;
      const len = 13 + hash(i, v, 76) * 14, curl = (t - 0.5) * 12 + (hash(i, v, 77) - 0.5) * 6;
      g.lineWidth = 1.4 + hash(i, v, 78) * 0.9;
      g.beginPath(); g.moveTo(px, py);
      g.quadraticCurveTo(px + nx * len * 0.55 + curl * 0.3, py + ny * len * 0.55, px + nx * len + curl, py + ny * len); g.stroke();
    }
    // fade the skin out at the edges so it floats on the screen
    g.globalCompositeOperation = 'destination-in';
    g.translate(160, 100); g.scale(1, 0.62);                 // an oval mask, so the top and bottom fade as well
    const m = g.createRadialGradient(0, 0, 66, 0, 0, 158);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(-160, -170, 320, 340);
    return c;
  }
  // gx, gy: -1, 0 or 1 -- the eye looking left/right and up/down. Painted on first use, then cached.
  function sprite(v, gx, gy) {
    const k = v * 9 + (gx + 1) * 3 + (gy + 1);
    return eyeCache[k] || (eyeCache[k] = makeEye(v, gx, gy));
  }

  window.RealEyes = { W: EYE_W, H: EYE_H, COUNT: IRISES.length, sprite };
})();
