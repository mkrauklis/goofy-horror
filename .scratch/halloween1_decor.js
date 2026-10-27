  // ---- Halloween decor ----
  // Orange windows set into the walls: a warm pane with a dark cross frame
  // and a faint candle-flicker.
  function drawWindows(g, minTX, maxTX, minTY, maxTY, now) {
    LEVEL.windows.forEach((w) => {
      if (w.x < minTX || w.x > maxTX || w.y < minTY || w.y > maxTY) return;
      const px = w.x * TILE, py = w.y * TILE;
      const flick = 0.88 + 0.12 * Math.sin(now * 0.007 + w.x * 1.7 + w.y * 2.3);
      const grad = g.createLinearGradient(px, py, px, py + TILE);
      grad.addColorStop(0, `rgba(255,214,110,${flick})`);
      grad.addColorStop(1, `rgba(255,120,24,${flick})`);
      g.fillStyle = '#1c0e22';
      g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      g.fillStyle = grad;
      g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
      g.strokeStyle = '#2a1233';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(px + TILE / 2, py + 6); g.lineTo(px + TILE / 2, py + TILE - 6);
      g.moveTo(px + 6, py + TILE / 2); g.lineTo(px + TILE - 6, py + TILE / 2);
      g.stroke();
    });
  }

  // A carved jack-o-lantern: ribbed orange pumpkin, green stem, glowing
  // triangle eyes and a jagged grin.
  function drawJackOLantern(g, cx, cy, r, now, seed) {
    const flick = 0.85 + 0.15 * Math.sin(now * 0.012 + seed);
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, r * 4.2);
    halo.addColorStop(0, `rgba(255,170,50,${0.38 * flick})`);
    halo.addColorStop(1, 'rgba(255,140,20,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, r * 4.2, 0, Math.PI * 2); g.fill();

    g.fillStyle = '#5a2208';
    g.beginPath(); g.ellipse(cx, cy + r * 0.15, r * 1.12, r * 0.95, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 1, cx, cy, r * 1.15);
    body.addColorStop(0, '#ffb24a');
    body.addColorStop(0.6, '#ee7a14');
    body.addColorStop(1, '#a8420a');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(cx, cy, r * 1.1, r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(110,40,5,0.55)';
    g.lineWidth = 1;
    [-0.55, 0, 0.55].forEach((k) => {
      g.beginPath();
      g.ellipse(cx, cy, r * 1.1 * Math.abs(1 - Math.abs(k) * 0.7), r * 0.92, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    g.fillStyle = '#3d6a1c';
    g.fillRect(cx - r * 0.12, cy - r * 1.05, r * 0.26, r * 0.35);

    // carved face, lit from inside
    g.fillStyle = `rgba(255,222,110,${0.95 * flick})`;
    g.beginPath();
    g.moveTo(cx - r * 0.6, cy - r * 0.05); g.lineTo(cx - r * 0.2, cy - r * 0.05); g.lineTo(cx - r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx + r * 0.6, cy - r * 0.05); g.lineTo(cx + r * 0.2, cy - r * 0.05); g.lineTo(cx + r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx - r * 0.65, cy + r * 0.2);
    [[-0.45, 0.5], [-0.25, 0.3], [-0.05, 0.52], [0.15, 0.3], [0.35, 0.5], [0.65, 0.2]].forEach(([dx, dy]) => g.lineTo(cx + r * dx, cy + r * dy));
    g.lineTo(cx + r * 0.4, cy + r * 0.12); g.lineTo(cx - r * 0.4, cy + r * 0.12); g.closePath();
    g.fill();
  }

  function drawLanterns(g, minTX, maxTX, minTY, maxTY, now) {
    LEVEL.lanterns.forEach((l) => {
      if (l.x < minTX || l.x > maxTX || l.y < minTY || l.y > maxTY) return;
      const c = tileCenter(l.x, l.y);
      drawJackOLantern(g, c.x, c.y, 9, now, l.x * 2.1 + l.y);
    });
  }

  // A trick-or-treat pail brimming with candy, with a pulsing glow so it
  // reads from across a room.
  function drawCandyBucket(g, c, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    const halo = g.createRadialGradient(c.x, c.y, 2, c.x, c.y, 42);
    halo.addColorStop(0, `rgba(255,120,220,${0.28 + 0.15 * pulse})`);
    halo.addColorStop(1, 'rgba(255,120,220,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(c.x, c.y, 42, 0, Math.PI * 2); g.fill();

    g.save();
    g.translate(c.x, c.y);
    g.strokeStyle = '#2a1a10';
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, -3, 11, Math.PI, 0); g.stroke();                     // handle
    g.fillStyle = '#e8650c';
    g.beginPath(); g.moveTo(-11, -4); g.lineTo(11, -4); g.lineTo(8, 11); g.lineTo(-8, 11); g.closePath(); g.fill();
    g.strokeStyle = '#7a3004'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#1a0d1f';                                                     // a little pumpkin face on the pail
    g.beginPath(); g.moveTo(-5, 1); g.lineTo(-2, 1); g.lineTo(-3.5, -1.5); g.closePath();
    g.moveTo(5, 1); g.lineTo(2, 1); g.lineTo(3.5, -1.5); g.closePath(); g.fill();
    ['#ff4f9a', '#6df0ff', '#ffe14a', '#8aff5a', '#c07aff'].forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath(); g.arc(-8 + i * 4, -6 + (i % 2) * 2, 3, 0, Math.PI * 2); g.fill();
    });
    g.restore();
  }
