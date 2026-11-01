// A "biblically accurate" demon, drawn the way the old texts describe such things and not the way they are
// usually drawn: wheels within wheels set with burning eyes, a crown of horns, three pairs of torn wings
// and, in the middle of it all, a skull-like face with too many eyes. Used for the flashes in the Dream's
// facility (js/dreamfac.js). window.DreamDemon.draw(g, t, scale) paints it centred on the current origin,
// roughly 110 * scale px from the middle to the tips of its wings.
(function () {
  const TAU = Math.PI * 2;
  function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  function slitEye(g, x, y, w, glow) {
    g.fillStyle = glow ? 'rgba(255,60,20,0.55)' : 'rgba(0,0,0,0)';
    if (glow) { g.beginPath(); g.arc(x, y, w * 1.1, 0, TAU); g.fill(); }
    g.fillStyle = '#ffb02a';
    g.beginPath(); g.ellipse(x, y, w, w * 0.62, 0, 0, TAU); g.fill();
    g.fillStyle = '#e02a10';
    g.beginPath(); g.ellipse(x, y, w * 0.6, w * 0.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(x, y, w * 0.14, w * 0.5, 0, 0, TAU); g.fill();
  }

  function draw(g, t, s) {
    g.save();
    g.scale(s, s);
    const tt = t * 0.001;

    const aura = g.createRadialGradient(0, 0, 10, 0, 0, 130);
    aura.addColorStop(0, 'rgba(255,70,20,0.6)'); aura.addColorStop(0.5, 'rgba(120,10,10,0.35)'); aura.addColorStop(1, 'rgba(60,0,0,0)');
    g.fillStyle = aura; g.fillRect(-130, -130, 260, 260);

    // wings: black, raggedly feathered, with an ember edge
    [{ a: -1.25, l: 118 }, { a: -0.35, l: 128 }, { a: 0.7, l: 104 }].forEach((w, wi) => {
      [-1, 1].forEach((dir) => {
        g.save(); g.scale(dir, 1);
        const base = w.a + Math.sin(tt * 3 + wi) * 0.08;
        g.fillStyle = '#0a0406'; g.strokeStyle = 'rgba(255,90,30,0.75)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(8, 0);
        const n = 9;
        for (let k = 0; k <= n; k++) {
          const a = base - 0.5 + (k / n) * 1.0, r = w.l * (0.7 + 0.3 * hash(wi * 11 + k) + (k % 2 ? 0.1 : -0.1));
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(Math.cos(a + 0.05) * r * 0.62, Math.sin(a + 0.05) * r * 0.62);
        }
        g.closePath(); g.fill(); g.stroke();
        g.restore();
      });
    });

    // two wheels of burning eyes, turning against each other
    [{ R: 92, n: 22, sp: 0.5, ew: 5.5 }, { R: 62, n: 14, sp: -0.8, ew: 6.5 }].forEach((w, wi) => {
      g.strokeStyle = '#1a0a0c'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, w.R, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,100,30,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, w.R + 4, 0, TAU); g.stroke();
      for (let i = 0; i < w.n; i++) {
        const a = tt * w.sp + (i / w.n) * TAU;
        slitEye(g, Math.cos(a) * w.R, Math.sin(a) * w.R, w.ew, true);
      }
    });

    // a crown of curved horns
    g.fillStyle = '#17090a'; g.strokeStyle = '#4a1a14'; g.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + tt * 0.1, r0 = 30, r1 = 54 + 14 * hash(i);
      g.save(); g.rotate(a);
      g.beginPath(); g.moveTo(r0, -5); g.quadraticCurveTo(r0 + (r1 - r0) * 0.6, -16, r1, -4 + 10 * (i % 2 ? 1 : -1)); g.quadraticCurveTo(r0 + (r1 - r0) * 0.6, -4, r0, 5); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }

    // the face: a long pale skull, three eyes, a mouth of teeth
    g.fillStyle = '#d8cfc0'; g.strokeStyle = '#3a2a22'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -34); g.bezierCurveTo(26, -34, 26, 8, 12, 26); g.lineTo(0, 34); g.lineTo(-12, 26); g.bezierCurveTo(-26, 8, -26, -34, 0, -34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(-11, -8, 8, 11, 0.3, 0, TAU); g.ellipse(11, -8, 8, 11, -0.3, 0, TAU); g.fill();
    slitEye(g, -11, -8, 6, true); slitEye(g, 11, -8, 6, true); slitEye(g, 0, -22, 5, true);
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(-2, 4); g.lineTo(2, 4); g.lineTo(0, 12); g.closePath(); g.fill();
    const open = 5 + 6 * (0.5 + 0.5 * Math.sin(tt * 9));
    g.fillStyle = '#1a0306'; g.beginPath(); g.ellipse(0, 21, 10, open, 0, 0, TAU); g.fill();
    g.fillStyle = '#efe6d0';
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(k * 2.2 - 1, 21 - open + 1); g.lineTo(k * 2.2 + 1, 21 - open + 1); g.lineTo(k * 2.2, 21 - open + 6); g.closePath(); g.fill(); g.beginPath(); g.moveTo(k * 2.2 - 1, 21 + open - 1); g.lineTo(k * 2.2 + 1, 21 + open - 1); g.lineTo(k * 2.2, 21 + open - 6); g.closePath(); g.fill(); }
    g.restore();
  }

  window.DreamDemon = { draw };
})();
