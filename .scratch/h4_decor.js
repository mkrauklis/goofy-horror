  // ---- Overgrown ward decor ----
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

    g.fillStyle = `rgba(255,222,110,${0.95 * flick})`;
    g.beginPath();
    g.moveTo(cx - r * 0.6, cy - r * 0.05); g.lineTo(cx - r * 0.2, cy - r * 0.05); g.lineTo(cx - r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx + r * 0.6, cy - r * 0.05); g.lineTo(cx + r * 0.2, cy - r * 0.05); g.lineTo(cx + r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx - r * 0.65, cy + r * 0.2);
    [[-0.45, 0.5], [-0.25, 0.3], [-0.05, 0.52], [0.15, 0.3], [0.35, 0.5], [0.65, 0.2]].forEach(([dx, dy]) => g.lineTo(cx + r * dx, cy + r * dy));
    g.lineTo(cx + r * 0.4, cy + r * 0.12); g.lineTo(cx - r * 0.4, cy + r * 0.12); g.closePath();
    g.fill();
  }

  // Jack-o-lanterns left sitting on the floor, well spread out.
  function drawLanterns(g, minTX, maxTX, minTY, maxTY, now) {
    LEVEL.lanterns.forEach((l, i) => {
      if (l.x < minTX - 1 || l.x > maxTX + 1 || l.y < minTY - 1 || l.y > maxTY + 1) return;
      const c = tileCenter(l.x, l.y);
      drawJackOLantern(g, c.x + l.ox, c.y + l.oy, 9, now, i * 1.7);
    });
  }

  // Vines growing across the floor: a wandering stem with leaves along it and
  // a little curl at the tip, each one grown from its own seed so it looks
  // identical every frame.
  function drawVines(g, minTX, maxTX, minTY, maxTY) {
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    LEVEL.vines.forEach((v) => {
      if (v.x < minTX - 3 || v.x > maxTX + 3 || v.y < minTY - 3 || v.y > maxTY + 3) return;
      let s = v.s;
      const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      let x = v.x * TILE, y = v.y * TILE, a = v.a;
      const pts = [{ x, y, a }];
      for (let i = 0; i < v.n; i++) {
        a += (rnd() - 0.5) * 1.1;
        x += Math.cos(a) * 10; y += Math.sin(a) * 10;
        pts.push({ x, y, a });
      }
      const stem = (w, col) => {
        g.strokeStyle = col; g.lineWidth = w;
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
        g.stroke();
      };
      stem(4.4, 'rgba(18,48,14,0.85)');
      stem(2.4, '#3d8a2c');
      for (let i = 1; i < pts.length; i++) {
        if (rnd() < 0.78) {
          const side = i % 2 ? 1 : -1, p = pts[i];
          g.fillStyle = rnd() < 0.5 ? '#4fae3a' : '#3a8a2a';
          g.beginPath();
          g.ellipse(p.x + Math.cos(p.a + side * 1.2) * 4, p.y + Math.sin(p.a + side * 1.2) * 4, 4.6, 2.2, p.a + side * 1.0, 0, Math.PI * 2);
          g.fill();
        }
      }
      const tip = pts[pts.length - 1];
      g.strokeStyle = '#4fae3a'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(tip.x + Math.cos(tip.a + 1.3) * 3, tip.y + Math.sin(tip.a + 1.3) * 3, 3, tip.a - 2, tip.a + 3.4); g.stroke();
    });
    g.restore();
  }

  // 2x2 wooden crates: solid, with planks, braces and iron corners.
  function drawBigCrates(g, minTX, maxTX, minTY, maxTY) {
    LEVEL.bigCrates.forEach((b) => {
      if (b.x + 2 < minTX || b.x > maxTX || b.y + 2 < minTY || b.y > maxTY) return;
      const px = b.x * TILE, py = b.y * TILE, S = TILE * 2;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(px + 3, py + 5, S, S);
      g.fillStyle = '#8a6234';
      g.fillRect(px + 1, py + 1, S - 2, S - 2);
      g.strokeStyle = 'rgba(60,38,16,0.7)'; g.lineWidth = 1.5;
      for (let i = 1; i < 6; i++) {
        g.beginPath(); g.moveTo(px + 2, py + (S / 6) * i); g.lineTo(px + S - 2, py + (S / 6) * i); g.stroke();
      }
      g.fillStyle = 'rgba(255,220,150,0.1)';
      g.fillRect(px + 3, py + 3, S - 6, 6);
      g.strokeStyle = '#4a3016'; g.lineWidth = 5;
      g.strokeRect(px + 3, py + 3, S - 6, S - 6);
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(px + 6, py + 6); g.lineTo(px + S - 6, py + S - 6); g.moveTo(px + S - 6, py + 6); g.lineTo(px + 6, py + S - 6); g.stroke();
      g.fillStyle = '#2a2420';
      [[7, 7], [S - 7, 7], [7, S - 7], [S - 7, S - 7]].forEach(([dx, dy]) => { g.beginPath(); g.arc(px + dx, py + dy, 2.4, 0, Math.PI * 2); g.fill(); });
    });
  }

  // A green pumpkin. Cold and dark until it's lit; then its carved face and a
  // tall flame burn bright blue.
  function drawGreenPumpkin(g, pk, lit, litAt, now, idx) {
    const c = tileCenter(pk.x, pk.y), r = 14;
    const burn = lit ? Math.min(1, (now - litAt) / 700) : 0;
    const flick = 0.85 + 0.15 * Math.sin(now * 0.014 + idx * 2);
    g.save();
    g.translate(c.x, c.y);
    const halo = g.createRadialGradient(0, 0, 2, 0, 0, lit ? r * 5 : r * 3);
    if (lit) { halo.addColorStop(0, `rgba(90,200,255,${0.5 * burn * flick})`); halo.addColorStop(1, 'rgba(60,170,255,0)'); }
    else { halo.addColorStop(0, 'rgba(120,230,90,0.16)'); halo.addColorStop(1, 'rgba(120,230,90,0)'); }
    g.fillStyle = halo;
    g.beginPath(); g.arc(0, 0, lit ? r * 5 : r * 3, 0, Math.PI * 2); g.fill();

    g.fillStyle = '#16300c';
    g.beginPath(); g.ellipse(0, r * 0.18, r * 1.14, r * 0.96, 0, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r * 1.15);
    body.addColorStop(0, '#b4f27a'); body.addColorStop(0.6, '#58a832'); body.addColorStop(1, '#25621a');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(20,70,14,0.6)'; g.lineWidth = 1;
    [-0.55, 0, 0.55].forEach((k) => {
      g.beginPath();
      g.ellipse(0, 0, r * 1.1 * Math.abs(1 - Math.abs(k) * 0.7), r * 0.92, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      g.stroke();
    });
    g.fillStyle = '#5a4a1e';
    g.fillRect(-r * 0.12, -r * 1.08, r * 0.28, r * 0.38);

    // the carved face: hollow and dark, or full of blue fire
    g.fillStyle = lit ? `rgba(140,235,255,${(0.35 + 0.65 * burn) * flick})` : '#0c1a07';
    g.beginPath();
    g.moveTo(-r * 0.6, -r * 0.05); g.lineTo(-r * 0.2, -r * 0.05); g.lineTo(-r * 0.4, -r * 0.42); g.closePath();
    g.moveTo(r * 0.6, -r * 0.05); g.lineTo(r * 0.2, -r * 0.05); g.lineTo(r * 0.4, -r * 0.42); g.closePath();
    g.moveTo(-r * 0.65, r * 0.2);
    [[-0.45, 0.5], [-0.25, 0.3], [-0.05, 0.52], [0.15, 0.3], [0.35, 0.5], [0.65, 0.2]].forEach(([dx, dy]) => g.lineTo(r * dx, r * dy));
    g.lineTo(r * 0.4, r * 0.12); g.lineTo(-r * 0.4, r * 0.12); g.closePath();
    g.fill();

    if (lit) {                                          // a flame licking up from the stem
      const h = r * 1.5 * burn * (0.85 + 0.15 * Math.sin(now * 0.02 + idx));
      g.globalCompositeOperation = 'lighter';
      [[0.55, 'rgba(60,140,255,0.55)'], [0.34, 'rgba(120,210,255,0.8)'], [0.16, 'rgba(235,252,255,0.95)']].forEach(([k, col]) => {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(-r * k, -r * 0.9);
        g.quadraticCurveTo(-r * k * 0.6, -r * 0.9 - h * 0.6, Math.sin(now * 0.017 + idx) * 3, -r * 0.9 - h * (0.6 + k));
        g.quadraticCurveTo(r * k * 0.6, -r * 0.9 - h * 0.6, r * k, -r * 0.9);
        g.closePath(); g.fill();
      });
    }
    g.restore();
  }

  // The bluelighter: a steel lighter with a steady blue flame, bobbing and
  // glowing so it can be found across a dark room.
  function drawLighter(g, now) {
    if (hasLighter) return;
    const c = tileCenter(LEVEL.lighter.x, LEVEL.lighter.y);
    const bob = Math.sin(now * 0.004) * 2.5, flick = 0.85 + 0.15 * Math.sin(now * 0.02);
    g.save();
    g.translate(c.x, c.y + bob);
    const halo = g.createRadialGradient(0, -4, 2, 0, -4, 40);
    halo.addColorStop(0, `rgba(90,180,255,${0.55 * flick})`); halo.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(0, -4, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(2, 10 - bob, 8, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a9bdd0'; g.fillRect(-5, -6, 10, 15);
    g.fillStyle = '#2d5fa8'; g.fillRect(-5, 3, 10, 6);
    g.fillStyle = '#6f8398'; g.fillRect(-5, -9, 10, 4);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-3.5, -5, 2, 9);
    g.globalCompositeOperation = 'lighter';
    [[7, 'rgba(60,140,255,0.6)'], [4.5, 'rgba(120,210,255,0.85)'], [2.2, 'rgba(240,252,255,0.95)']].forEach(([w, col]) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(-w * 0.6, -10);
      g.quadraticCurveTo(-w * 0.5, -17, Math.sin(now * 0.02) * 1.5, -10 - w * 2.3 * flick);
      g.quadraticCurveTo(w * 0.5, -17, w * 0.6, -10);
      g.closePath(); g.fill();
    });
    for (let i = 0; i < 3; i++) {
      const a = now * 0.003 + i * 2.1;
      g.fillStyle = `rgba(200,240,255,${0.5 + 0.5 * Math.sin(now * 0.01 + i)})`;
      g.beginPath(); g.arc(Math.cos(a) * 15, -4 + Math.sin(a) * 9, 1.4, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // The lighter in your pocket once you've found it.
  function drawLighterHud(vx) {
    if (!hasLighter) return;
    const cx = vx + VIEW_W - 34, cy = 100;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,18,40,0.78)'; ctx.fill();
    ctx.strokeStyle = '#6ab8ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#a9bdd0'; ctx.fillRect(cx - 4, cy - 4, 8, 12);
    ctx.fillStyle = '#2d5fa8'; ctx.fillRect(cx - 4, cy + 3, 8, 5);
    ctx.fillStyle = '#6f8398'; ctx.fillRect(cx - 4, cy - 7, 8, 3);
    ctx.fillStyle = '#7fd0ff';
    ctx.beginPath(); ctx.moveTo(cx - 2.5, cy - 7); ctx.quadraticCurveTo(cx, cy - 15, cx + 0.5, cy - 13); ctx.quadraticCurveTo(cx + 3, cy - 12, cx + 2.5, cy - 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFireballs(g, now) {
    fireballs.forEach((f) => {
      const len = Math.hypot(f.vx, f.vy) || 1, dx = f.vx / len, dy = f.vy / len;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 6; i++) {
        g.fillStyle = `rgba(255,${130 - i * 8},20,${0.42 - i * 0.06})`;
        g.beginPath(); g.arc(f.x - dx * i * 7 + (Math.random() - 0.5) * 2, f.y - dy * i * 7 + (Math.random() - 0.5) * 2, 8 - i, 0, Math.PI * 2); g.fill();
      }
      const halo = g.createRadialGradient(f.x, f.y, 1, f.x, f.y, 26);
      halo.addColorStop(0, 'rgba(255,190,70,0.75)'); halo.addColorStop(1, 'rgba(255,110,20,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(f.x, f.y, 26, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = '#ff9a1e'; g.beginPath(); g.arc(f.x, f.y, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff1a8'; g.beginPath(); g.arc(f.x, f.y, 3.6, 0, Math.PI * 2); g.fill();
    });
  }

