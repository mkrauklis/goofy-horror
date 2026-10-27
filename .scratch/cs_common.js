  // ---- helpers the scenes share ----
  // the man's position while he walks from (x0,y0) to (x1,y1) between t0 and t1
  function walk(t, t0, t1, x0, y0, x1, y1) {
    const p = seg(t, t0, t1);
    return { x: lerp(x0, x1, p), y: lerp(y0, y1, p), moving: p > 0 && p < 1, walk: t * 0.0125, speed: p > 0 && p < 1 ? 1 : 0 };
  }
  // where his right hand (the flashlight) is, in the world
  function handPos(gx, gy, ang, u) {
    const lx = 0.7 * u, ly = 1.08 * u;
    return { x: gx + lx * Math.cos(ang) - ly * Math.sin(ang), y: gy + lx * Math.sin(ang) + ly * Math.cos(ang) };
  }
  // the flashlight: a cone of light plus a pool round the man, flickering in the dark
  function torchLights(gx, gy, ang, t, u, power) {
    const f = power === undefined ? 1 : power;
    const fl = 0.9 + 0.1 * Math.sin(t * 0.05) * Math.sin(t * 0.013);
    const h = handPos(gx, gy, ang, u || 15);
    return [
      { x: h.x, y: h.y, r: 330, a: 0.97 * f * fl, cone: true, ang, half: 0.4 },
      { x: gx, y: gy, r: 88, a: 0.8 * f },
    ];
  }
  function torchGlow(g, gx, gy, ang, u, t, power) {
    // a hot spot on the lens itself
    const h = handPos(gx, gy, ang, u);
    const f = power === undefined ? 1 : power;
    g.save(); g.globalCompositeOperation = 'lighter';
    glow(g, h.x + Math.cos(ang) * 12, h.y + Math.sin(ang) * 12, 22, '255,246,200', 0.5 * f);
    g.restore();
  }
  // a wall torch burning on the floor of the scene, drawn small with a warm glow
  function sconce(g, x, y, t, seed) {
    g.save(); g.translate(x, y);
    g.fillStyle = '#2a1a0c'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
    g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
    flame(g, 0, 2, 11, 20, t, seed, false);
    g.restore();
  }
  function sconceLight(x, y, t, seed, r) {
    return { x, y, r: r || 150, a: 0.55 + 0.1 * Math.sin(t * 0.02 + seed) };
  }

  // the roped-off ward floor: mottled pale tiles with vines creeping across
  function wardFloor() {
    return floorFor('ward', (g) => {
      g.fillStyle = '#47645f'; g.fillRect(-FW / 2, -FH / 2, FW, FH);
      for (let i = -11; i < 12; i++) for (let j = -7; j < 8; j++) {
        g.fillStyle = lerpHex('#6a918a', '#8db8b0', hash(i * 31 + j * 7));
        g.fillRect(i * 64, j * 64, 62, 62);
        g.fillStyle = 'rgba(30,60,56,0.18)';
        for (let k = 0; k < 4; k++) g.fillRect(i * 64 + hash(i + j * 9 + k) * 56, j * 64 + hash(i * 5 + j + k * 3) * 56, 3, 3);
      }
      for (let v = 0; v < 18; v++) {
        let x = (hash(v * 3.3) - 0.5) * FW, y = (hash(v * 5.1) - 0.5) * FH, a = hash(v * 7.7) * TAU;
        const pts = [[x, y]];
        for (let s = 0; s < 9; s++) { a += (hash(v * 11 + s) - 0.5) * 1.1; x += Math.cos(a) * 34; y += Math.sin(a) * 34; pts.push([x, y]); }
        drawVine(g, pts, 7, 3, '#173a12', '#3f8a24');
        g.fillStyle = '#5db33a';
        pts.forEach(([px, py], s) => { if (s % 2) { g.beginPath(); g.ellipse(px + 4, py - 3, 7, 3.5, hash(v + s) * 3, 0, TAU); g.fill(); } });
      }
    });
  }
  // a small glowing jack-o-lantern on the ground
  function lantern(g, x, y, t, seed) {
    const fl = 0.8 + 0.2 * Math.sin(t * 0.017 + seed);
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(2, 5, 15, 8, 0, 0, TAU); g.fill();
    const body = g.createRadialGradient(-4, -4, 1, 0, 0, 16);
    body.addColorStop(0, '#ffa63a'); body.addColorStop(1, '#a8420a');
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 15, 12, 0, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,230,120,${fl})`;
    g.beginPath(); g.moveTo(-9, -2); g.lineTo(-3, -2); g.lineTo(-6, -8); g.closePath(); g.moveTo(9, -2); g.lineTo(3, -2); g.lineTo(6, -8); g.closePath();
    g.moveTo(-9, 3); g.lineTo(-4, 6); g.lineTo(0, 3); g.lineTo(4, 6); g.lineTo(9, 3); g.lineTo(5, 8); g.lineTo(-5, 8); g.closePath(); g.fill();
    g.fillStyle = '#3a4a14'; g.fillRect(-2, -14, 4, 5);
    g.restore();
  }

  // a snaking vine reaching from `from` to `to`, `ext` (0..1) of the way there
  function vineTo(from, to, ext, t, seed, amp) {
    const pts = [], N = 16;
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 0; i <= N; i++) {
      const f = (i / N) * ext;
      const wave = Math.sin(f * 7 + t * 0.011 + seed) * (amp === undefined ? 26 : amp) * Math.sin(f * Math.PI) * (1 - ext * 0.55);
      pts.push([from.x + dx * f + nx * wave, from.y + dy * f + ny * wave]);
    }
    return pts;
  }
  // a coiled vine ring round a point (the thorny binding), tightness is the radius
  function vineRing(g, x, y, rx, ry, rot, w, t, seed) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.lineCap = 'round';
    [['#102c0c', w + 3], ['#37801f', w], ['#79cc48', w * 0.35]].forEach(([col, lw]) => {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0.2, TAU - 0.15); g.stroke();
    });
    g.fillStyle = '#e4dcb2';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + seed, px = Math.cos(a) * rx, py = Math.sin(a) * ry;
      g.beginPath(); g.moveTo(px - 2.5, py); g.lineTo(px + Math.cos(a) * (w + 5), py + Math.sin(a) * (w + 5)); g.lineTo(px + 2.5, py); g.closePath(); g.fill();
    }
    g.restore();
  }
  // a flashlight lying on the floor
  function droppedTorch(g, x, y, ang, on) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#3d4046'; rr(g, -6, -3.5, 16, 7, 2); g.fill();
    g.fillStyle = on ? '#fff6c4' : '#6a6a60'; g.beginPath(); g.ellipse(10.5, 0, 2.2, 4, 0, 0, TAU); g.fill();
    g.restore();
  }

