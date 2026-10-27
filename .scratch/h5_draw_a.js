  // ======================= rendering =======================
  function hash2(x, y, k) {
    let h = Math.imul(x + 1013 * k, 374761393) ^ Math.imul(y + 7 * k, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

//@@CANDY_PIECE@@

//@@JACK@@

  // The whole arena painted once: a brick wall filling the square, and a round
  // floor of glossy candy tiles (with sprinkles and peppermint disks) cut into it.
  let floorCanvas = null;
  function buildFloor() {
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = WORLD_H;
    const f = c.getContext('2d');
    f.fillStyle = '#2a1713';
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    // brick, laid in a running bond
    const BH = 14, BW = 30;
    const brickCols = ['#7a3a2a', '#8a4430', '#6e3426', '#93503a', '#7f3e2c'];
    for (let row = 0; row * BH < WORLD_H; row++) {
      const off = (row % 2) * (BW / 2);
      for (let col = -1; col * BW < WORLD_W + BW; col++) {
        const x = col * BW + off, y = row * BH;
        f.fillStyle = brickCols[Math.floor(hash2(col, row, 1) * brickCols.length)];
        f.fillRect(x + 1, y + 1, BW - 2, BH - 2);
        f.fillStyle = 'rgba(255,200,160,0.12)'; f.fillRect(x + 1, y + 1, BW - 2, 2);
        f.fillStyle = 'rgba(0,0,0,0.25)'; f.fillRect(x + 1, y + BH - 3, BW - 2, 2);
      }
    }
    const vg = f.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R, ARENA_CX, ARENA_CY, ARENA_R + 150);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    f.fillStyle = vg; f.fillRect(0, 0, WORLD_W, WORLD_H);

    // the candy floor, clipped to a circle
    f.save();
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R, 0, Math.PI * 2); f.clip();
    const pastel = ['#ff9ec7', '#a8f0d0', '#ffe9a0', '#d6b8ff', '#ffc08a', '#9fd8ff'];
    const sprinkle = ['#ff3d7f', '#2fb5ff', '#ffe14a', '#4cd47a', '#ffffff', '#ff8a2a'];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TILE, py = y * TILE;
        f.fillStyle = pastel[Math.floor(hash2(x, y, 2) * pastel.length)];
        f.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        const gr = f.createLinearGradient(px, py, px + TILE, py + TILE);
        gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.14)');
        f.fillStyle = gr; f.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        if (hash2(x, y, 9) < 0.14) {          // a peppermint disk
          const cx = px + TILE / 2, cy = py + TILE / 2;
          f.fillStyle = '#ffffff'; f.beginPath(); f.arc(cx, cy, 12, 0, Math.PI * 2); f.fill();
          f.fillStyle = '#e8365d';
          for (let i = 0; i < 6; i++) { const a0 = (i / 6) * Math.PI * 2 + hash2(x, y, 10); f.beginPath(); f.moveTo(cx, cy); f.arc(cx, cy, 12, a0, a0 + Math.PI / 6); f.closePath(); f.fill(); }
          f.strokeStyle = 'rgba(0,0,0,0.2)'; f.lineWidth = 1; f.beginPath(); f.arc(cx, cy, 12, 0, Math.PI * 2); f.stroke();
        }
        for (let k = 0; k < 3; k++) {         // sprinkles
          f.save();
          f.translate(px + 4 + hash2(x, y, 20 + k) * (TILE - 8), py + 4 + hash2(y, x, 30 + k) * (TILE - 8));
          f.rotate(hash2(x, y, 40 + k) * Math.PI);
          f.fillStyle = sprinkle[Math.floor(hash2(x, y, 50 + k) * sprinkle.length)];
          f.fillRect(-3, -1, 6, 2.2);
          f.restore();
        }
      }
    }
    // dim it down: the candy is deep in the dark, lit mostly by the jack-o-lanterns
    f.fillStyle = 'rgba(14,6,30,0.56)';
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    const fv = f.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R * 0.55, ARENA_CX, ARENA_CY, ARENA_R);
    fv.addColorStop(0, 'rgba(0,0,0,0)'); fv.addColorStop(1, 'rgba(0,0,0,0.38)');
    f.fillStyle = fv;
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    f.restore();
    // the lip of the wall round the floor
    f.lineWidth = 9; f.strokeStyle = 'rgba(28,10,8,0.9)';
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R + 4.5, 0, Math.PI * 2); f.stroke();
    f.lineWidth = 3; f.strokeStyle = 'rgba(255,214,176,0.55)';
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R - 1, 0, Math.PI * 2); f.stroke();
    return c;
  }

  function drawTiles(g, now) {
    if (!floorCanvas) floorCanvas = buildFloor();
    g.drawImage(floorCanvas, 0, 0);
    // each jack-o-lantern lights the candy round it
    g.save();
    g.globalCompositeOperation = 'lighter';
    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      const f = 0.85 + 0.15 * Math.sin(now * 0.011 + i * 1.7);
      const gr = g.createRadialGradient(c.x, c.y, 4, c.x, c.y, TILE * 5);
      gr.addColorStop(0, `rgba(255,150,50,${0.34 * f})`); gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, TILE * 5, 0, Math.PI * 2); g.fill();
    });
    g.restore();
    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      drawJackOLantern(g, c.x, c.y, 15, now, i * 1.7);
    });
  }

  // the candy the boss has left behind: it fades out as it ages
  function drawTrail(g, now) {
    trail.forEach((t) => {
      const age = clamp((now - t.born) / TRAIL_LIFE_MS, 0, 1);
      g.save();
      g.globalAlpha = (1 - age) * (1 - age) * 0.9 + 0.05 * (1 - age);
      g.translate(t.x, t.y);
      g.scale(1.5, 1.5);
      drawCandyPiece(g, 0, 0, t.kind, t.c1, t.c2, t.rot);
      g.restore();
    });
  }

  // the spiral's candy: twice the size of an ordinary piece
  function drawCandies(g) {
    candies.forEach((s) => {
      g.save();
      g.translate(s.x, s.y);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.arc(0, 0, CANDY_RADIUS * 1.15, 0, Math.PI * 2); g.fill();
      g.scale(2, 2);
      drawCandyPiece(g, 0, 0, s.kind, s.c1, s.c2, s.rot);
      g.restore();
    });
  }

  function drawCornSpike(g, x, y, w, h) {
    g.save();
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.clip();
    g.fillStyle = '#ffd23a'; g.fillRect(x - w, y - h * 0.4, w * 2, h * 0.4 + 2);
    g.fillStyle = '#ff8a1e'; g.fillRect(x - w, y - h * 0.75, w * 2, h * 0.35);
    g.fillStyle = '#fff6e0'; g.fillRect(x - w, y - h - 1, w * 2, h * 0.26);
    g.restore();
    g.strokeStyle = 'rgba(110,60,10,0.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.stroke();
  }

  // Candy corn patches: a red circle flashes for a second, then the candy corn
  // shoots up out of the floor.
  function drawCornPatches(g, now) {
    cornPatches.forEach((c) => {
      if (now < c.fireAt) {
        const on = Math.floor((now - (c.fireAt - CORN_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(c.x, c.y, CORN_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,40,40,0.4)' : 'rgba(255,40,40,0.1)'; g.fill();
        g.strokeStyle = on ? '#ff3030' : 'rgba(255,70,70,0.45)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const t = clamp((now - c.fireAt) / CORN_ACTIVE_MS, 0, 1);
      const rise = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      g.beginPath(); g.arc(c.x, c.y, CORN_RADIUS, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,60,40,0.22)'; g.fill();
      const spikes = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3, rad = i === 8 ? 0 : CORN_RADIUS * 0.58;
        spikes.push({ x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad, h: (i === 8 ? 40 : 28 + (i % 3) * 4) * rise });
      }
      spikes.sort((a, b) => a.y - b.y);
      spikes.forEach((s) => drawCornSpike(g, s.x, s.y + 6, 15, s.h));
    });
  }

  // Cotton candy clouds: a flashing circle first, then a swirling pink-and-blue cloud.
  function drawGasPatches(g, now) {
    gasPatches.forEach((gp) => {
      if (now < gp.startAt) {
        const on = Math.floor((now - (gp.startAt - GAS_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(gp.x, gp.y, GAS_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,60,120,0.32)' : 'rgba(255,60,120,0.08)'; g.fill();
        g.strokeStyle = on ? '#ff3a7a' : 'rgba(255,90,140,0.4)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const life = clamp((gp.endAt - now) / 1000, 0, 1);
      const grow = clamp((now - gp.startAt) / 500, 0, 1);
      const cols = ['255,179,221', '179,224,255', '255,255,255', '255,210,235'];
      g.save();
      g.beginPath(); g.arc(gp.x, gp.y, GAS_RADIUS * grow, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,105,180,${0.3 * life})`; g.fill();   // a pink base so it stands out on the pale candy floor
      for (let i = 0; i < 20; i++) {
        const a = i * 2.4 + now * 0.0004 * (i % 2 ? 1 : -1);
        const rad = GAS_RADIUS * 0.66 * Math.sqrt((i + 1) / 20) * grow;
        const px = gp.x + Math.cos(a) * rad, py = gp.y + Math.sin(a) * rad;
        const size = GAS_RADIUS * 0.36;
        const col = cols[i % cols.length];
        const gr = g.createRadialGradient(px, py, 1, px, py, size);
        gr.addColorStop(0, `rgba(${col},${0.85 * life})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, size, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = `rgba(255,50,140,${0.85 * life})`; g.lineWidth = 3; g.setLineDash([8, 8]);
      g.beginPath(); g.arc(gp.x, gp.y, GAS_RADIUS, 0, Math.PI * 2); g.stroke();
      g.restore();
    });
  }

  // a ring filling up round a player who's standing in cotton candy
  function drawGasDanger(g, now) {
    players.forEach((p) => {
      if (p.caught || !p.gasSince) return;
      const f = clamp((now - p.gasSince) / GAS_KILL_MS, 0, 1);
      g.strokeStyle = `rgba(255,${Math.round(220 - 200 * f)},${Math.round(150 - 130 * f)},0.95)`;
      g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.stroke();
    });
  }

