  // ---- Hospital decor ----
  function hash2(x, y, k) {
    let h = Math.imul(x + 1013 * k, 374761393) ^ Math.imul(y + 7 * k, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const CANDY_COLORS = ['#ff4f9a', '#ffe14a', '#6df0ff', '#8aff5a', '#c07aff', '#ff8a2a', '#ff5252', '#ffffff'];
  // One piece of candy: a wrapped sweet, a lollipop, a gumdrop, a candy corn
  // or a hard candy, in a hash-picked color.
  function drawCandyPiece(g, x, y, kind, c1, c2, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    if (kind === 0) {            // wrapped sweet: body + twisted ends
      g.fillStyle = c1;
      g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = c2;
      g.beginPath();
      g.moveTo(5, 0); g.lineTo(9, -3); g.lineTo(9, 3); g.closePath();
      g.moveTo(-5, 0); g.lineTo(-9, -3); g.lineTo(-9, 3); g.closePath();
      g.fill();
    } else if (kind === 1) {     // lollipop
      g.strokeStyle = '#e8e0d0'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke();
      g.fillStyle = c1;
      g.beginPath(); g.arc(0, -1, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, -1, 2.6, 0, Math.PI * 1.6); g.stroke();
    } else if (kind === 2) {     // gumdrop
      g.fillStyle = c1;
      g.beginPath(); g.arc(0, 1, 4, Math.PI, 0); g.lineTo(4, 3); g.lineTo(-4, 3); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(-1.4, -0.6, 1.1, 0, Math.PI * 2); g.fill();
    } else if (kind === 3) {     // candy corn
      g.fillStyle = '#ffd23a';
      g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.fillStyle = '#ff8a1e';
      g.beginPath(); g.moveTo(-1.6, -1); g.lineTo(1.6, -1); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.fillStyle = '#fff6e0';
      g.beginPath(); g.moveTo(-0.8, -3); g.lineTo(0.8, -3); g.lineTo(0, -5); g.closePath(); g.fill();
    } else {                     // hard candy
      g.fillStyle = c1;
      g.beginPath(); g.arc(0, 0, 3.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(-1.2, -1.2, 1.1, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // Candy strewn across every floor tile, scattered by a hash of the tile so
  // it's identical every frame without storing thousands of positions.
  function drawCandies(g, minTX, maxTX, minTY, maxTY) {
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        const ch = LEVEL.grid[y][x];
        if (ch !== '.' && ch !== 'E') continue;
        for (let k = 0; k < 2; k++) {
          if (hash2(x, y, k) > (k === 0 ? 0.5 : 0.22)) continue;
          const px = x * TILE + 4 + hash2(x, y, k + 10) * (TILE - 8);
          const py = y * TILE + 4 + hash2(y, x, k + 20) * (TILE - 8);
          const kind = Math.floor(hash2(x, y, k + 30) * 5);
          const c1 = CANDY_COLORS[Math.floor(hash2(x, y, k + 40) * CANDY_COLORS.length)];
          const c2 = CANDY_COLORS[Math.floor(hash2(x, y, k + 50) * CANDY_COLORS.length)];
          drawCandyPiece(g, px, py, kind, c1, c2, hash2(x, y, k + 60) * Math.PI * 2);
        }
      }
    }
  }

  // A hospital bed, two tiles wide: steel frame, white mattress, pillow and
  // a blue blanket.
  function drawBeds(g, minTX, maxTX, minTY, maxTY) {
    LEVEL.beds.forEach((b) => {
      if (b.x + 2 < minTX || b.x > maxTX || b.y < minTY || b.y > maxTY) return;
      const px = b.x * TILE, py = b.y * TILE;
      g.fillStyle = '#5c6b73';
      g.fillRect(px + 2, py + 4, TILE * 2 - 4, TILE - 8);
      g.fillStyle = '#e9eef0';
      g.fillRect(px + 4, py + 6, TILE * 2 - 8, TILE - 12);
      g.fillStyle = '#ffffff';
      g.fillRect(px + 6, py + 8, 14, TILE - 16);
      g.fillStyle = '#6ea3c9';
      g.fillRect(px + 24, py + 6, TILE * 2 - 30, TILE - 12);
    });
  }

  // An industrial vent fan sunk into the duct floor: while it's on, the
  // blades spin and a red lamp burns; switched off, the blades stop dead and
  // the lamp goes green.
  function drawFan(g, c, off, now) {
    g.save();
    g.translate(c.x, c.y);
    g.fillStyle = '#1b2127';
    g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b7882'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.stroke();
    const spin = off ? 0.6 : now * 0.03;
    g.fillStyle = off ? '#7a8791' : 'rgba(190,205,215,0.75)';
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate(spin + i * Math.PI / 2);
      g.beginPath(); g.ellipse(7.5, 0, 7, 3, 0.35, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = '#39434b';
    g.beginPath(); g.arc(0, 0, 3.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = off ? '#3ddc84' : '#ff4b3a';
    g.shadowColor = g.fillStyle; g.shadowBlur = 8;
    g.beginPath(); g.arc(11, -11, 2.4, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // Flickering fluorescent tubes: mostly steady, with the odd stutter.
  function lampLevel(l, now) {
    const ph = now * 0.001 + l.x * 1.7 + l.y * 0.9;
    let v = 0.85 + 0.15 * Math.sin(ph * 9.1);
    if (Math.sin(ph * 2.3) + Math.sin(ph * 5.9 + 1.3) > 1.75) v *= 0.12;
    return v;
  }
