  // ---- Graveyard decor ----
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

  // Candy strewn across the grass and gravel, scattered by a hash of the tile
  // so it's identical every frame without storing thousands of positions.
  function drawCandies(g, minTX, maxTX, minTY, maxTY) {
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        const ch = LEVEL.grid[y][x];
        if (ch !== '.' && ch !== ',' && ch !== 'E') continue;
        for (let k = 0; k < 2; k++) {
          if (hash2(x, y, k) > (k === 0 ? 0.45 : 0.2)) continue;
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

  // Solid tiles in the graveyard: gravestones (rounded, cross or obelisk) with
  // a mound of fresh earth, and the odd dead tree.
  function drawGravestone(g, x, y, px, py) {
    const cx = px + TILE / 2, cy = py + TILE / 2;
    const roll = hash2(x, y, 70);
    if (roll < 0.14) {              // dead tree: trunk and bare branches
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(cx + 2, cy + 8, 11, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b1f17'; g.lineCap = 'round';
      g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy + 9); g.lineTo(cx, cy - 4); g.stroke();
      g.lineWidth = 2.4;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.62 + (hash2(x, y, 80 + i) - 0.5) * 0.3;
        const bx = cx + Math.cos(a) * 15, by = cy - 4 + Math.sin(a) * 15;
        g.beginPath(); g.moveTo(cx, cy - 4); g.lineTo(bx, by); g.stroke();
        g.lineWidth = 1.4; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + 0.6) * 7, by + Math.sin(a + 0.6) * 7); g.stroke(); g.lineWidth = 2.4;
      }
      return;
    }
    g.fillStyle = '#3a2c20';                   // the mound
    g.beginPath(); g.ellipse(cx, cy + 10, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(cx + 3, cy + 4, 9, 4, 0, 0, Math.PI * 2); g.fill();
    const shade = ['#8a8d96', '#7d8089', '#9a9da6'][Math.floor(hash2(x, y, 71) * 3)];
    g.fillStyle = shade; g.strokeStyle = '#3c3e45'; g.lineWidth = 1.2;
    if (roll < 0.5) {               // rounded slab
      g.beginPath(); g.moveTo(cx - 7, cy + 6); g.lineTo(cx - 7, cy - 4); g.arc(cx, cy - 4, 7, Math.PI, 0); g.lineTo(cx + 7, cy + 6); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(30,32,38,0.6)'; g.beginPath(); g.moveTo(cx - 3, cy - 3); g.lineTo(cx + 3, cy - 3); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy); g.stroke();
    } else if (roll < 0.78) {       // cross
      g.fillRect(cx - 2.5, cy - 12, 5, 20); g.fillRect(cx - 8, cy - 7, 16, 5);
      g.strokeRect(cx - 2.5, cy - 12, 5, 20);
    } else {                        // obelisk
      g.beginPath(); g.moveTo(cx - 6, cy + 7); g.lineTo(cx - 4, cy - 8); g.lineTo(cx, cy - 13); g.lineTo(cx + 4, cy - 8); g.lineTo(cx + 6, cy + 7); g.closePath(); g.fill(); g.stroke();
    }
  }

  // An open grave: a dark pit with a heap of earth beside it.
  function drawOpenGrave(g, px, py) {
    g.fillStyle = '#0c0807';
    g.fillRect(px + 4, py + 3, TILE - 8, TILE - 6);
    g.strokeStyle = '#4a3422'; g.lineWidth = 3;
    g.strokeRect(px + 3.5, py + 2.5, TILE - 7, TILE - 5);
    g.fillStyle = '#4a3422';
    g.beginPath(); g.ellipse(px + TILE - 4, py + TILE - 6, 8, 5, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6b4c2c';
    g.beginPath(); g.ellipse(px + TILE - 6, py + TILE - 8, 4, 2.4, 0.4, 0, Math.PI * 2); g.fill();
  }

  // One tile of the cemetery.
  function drawGraveTile(g, ch, x, y, px, py) {
    let color;
    switch (ch) {
      case ',': case 'W': color = ['#5a544c', '#605a51', '#554f47', '#665f55'][Math.floor(hash2(x, y, 3) * 4)]; break;
      case 'S': color = '#6a6470'; break;
      case 'E': color = '#2e2a30'; break;
      case 'D': color = '#2a2530'; break;
      default: color = floorShade(x, y);
    }
    g.fillStyle = color;
    g.fillRect(px, py, TILE, TILE);
    if (ch === ',' && hash2(x, y, 4) < 0.5) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(px + hash2(x, y, 5) * 20, py + hash2(x, y, 6) * 20, 6, 4);
    } else if (ch === 'S') {
      g.strokeStyle = 'rgba(20,16,26,0.5)'; g.lineWidth = 1.5;
      g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    } else if (ch === 'T') {
      drawGravestone(g, x, y, px, py);
    } else if (ch === 'V') {
      drawOpenGrave(g, px, py);
    } else if (ch === '#') {
      const solid = (tileChar(x - 1, y) === '#' ? 1 : 0) + (tileChar(x + 1, y) === '#' ? 1 : 0) + (tileChar(x, y - 1) === '#' ? 1 : 0) + (tileChar(x, y + 1) === '#' ? 1 : 0);
      if (solid >= 3) {            // mausoleum stone
        g.fillStyle = '#4a4852'; g.fillRect(px, py, TILE, TILE);
        g.strokeStyle = 'rgba(15,14,20,0.6)'; g.lineWidth = 1.2;
        g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        g.beginPath(); g.moveTo(px, py + TILE / 2); g.lineTo(px + TILE, py + TILE / 2); g.moveTo(px + TILE / 2, py); g.lineTo(px + TILE / 2, py + TILE / 2); g.stroke();
      } else {                     // wrought-iron fence: bars with spear tips
        const horiz = tileChar(x - 1, y) === '#' || tileChar(x + 1, y) === '#';
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        g.strokeStyle = '#1c1a22'; g.fillStyle = '#1c1a22'; g.lineWidth = 3;
        if (horiz) {
          g.beginPath(); g.moveTo(px, py + 10); g.lineTo(px + TILE, py + 10); g.moveTo(px, py + 22); g.lineTo(px + TILE, py + 22); g.stroke();
          g.lineWidth = 2;
          for (let i = 0; i < 4; i++) { const bx = px + 4 + i * 8; g.beginPath(); g.moveTo(bx, py + 5); g.lineTo(bx, py + 27); g.stroke(); g.beginPath(); g.moveTo(bx - 2, py + 7); g.lineTo(bx, py + 2); g.lineTo(bx + 2, py + 7); g.closePath(); g.fill(); }
        } else {
          g.beginPath(); g.moveTo(px + 10, py); g.lineTo(px + 10, py + TILE); g.moveTo(px + 22, py); g.lineTo(px + 22, py + TILE); g.stroke();
          g.lineWidth = 2;
          for (let i = 0; i < 4; i++) { const by = py + 4 + i * 8; g.beginPath(); g.moveTo(px + 5, by); g.lineTo(px + 27, by); g.stroke(); }
        }
        g.fillStyle = '#2a2830'; g.fillRect(px + TILE / 2 - 3, py + TILE / 2 - 3, 6, 6);
      }
    }
  }

  // An iron lamp post with a guttering lantern on top.
  function drawLampPost(g, l, now) {
    const c = tileCenter(l.x, l.y);
    const f = 0.8 + 0.2 * Math.sin(now * 0.013 + l.x * 2.3 + l.y * 1.1);
    const halo = g.createRadialGradient(c.x, c.y, 1, c.x, c.y, 44);
    halo.addColorStop(0, `rgba(255,160,60,${0.42 * f})`);
    halo.addColorStop(1, 'rgba(255,130,30,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(c.x, c.y, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#17151c'; g.fillRect(c.x - 3, c.y - 3, 6, 6);
    g.fillStyle = '#2a2630'; g.fillRect(c.x - 6, c.y - 6, 12, 12);
    g.fillStyle = `rgba(255,${180 + 40 * f},80,0.95)`;
    g.fillRect(c.x - 4, c.y - 4, 8, 8);
    g.strokeStyle = '#17151c'; g.lineWidth = 1.2; g.strokeRect(c.x - 5.5, c.y - 5.5, 11, 11);
  }

  // The great iron wheel on its stone plinth. Spokes turn while somebody is
  // heaving on it; a ring fills up around it as it goes, and it glows green
  // once the gate is open.
  function drawWheel(g, wp, progress, angle, done, now) {
    const c = tileCenter(wp.x, wp.y);
    g.save();
    g.translate(c.x, c.y);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(4, 6, 52, 46, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4852'; g.beginPath(); g.arc(0, 0, 48, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#26242c'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#5c5a66'; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
    g.save();
    g.rotate(angle);
    g.strokeStyle = done ? '#7be08a' : '#161419'; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 31, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 31, Math.sin(a) * 31); g.stroke();
      g.fillStyle = '#161419';
      g.beginPath(); g.arc(Math.cos(a) * 36, Math.sin(a) * 36, 4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    g.fillStyle = done ? '#7be08a' : '#8a6a3c';
    g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill();
    if (progress > 0.005 && !done) {
      g.strokeStyle = 'rgba(255,200,110,0.95)'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, 55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); g.stroke();
    }
    if (done) {
      const f = 0.6 + 0.4 * Math.sin(now * 0.006);
      g.strokeStyle = `rgba(123,224,138,${0.5 * f})`; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
