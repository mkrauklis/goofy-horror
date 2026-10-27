  // ============ THE GARGUANTUAGOYLE: dropped on from above ============
  (function () {
    const U = 15, DUR = 8500;
    const GX = -60, GY = 10;
    // it circles in from the right, hovers over him (its shadow creeping across
    // the floor), climbs, and slams down at 5300
    function bossPos(t) {
      const come = smooth(seg(t, 2400, 4300)), o = guy(t);
      const dive = smooth(seg(t, 4700, 5300));                 // it settles right over him for the slam
      const x = lerp(260, o.x + 95 * (1 - dive), come) + 10 * Math.sin(t * 0.004) * (1 - seg(t, 4300, 4800));
      return { x, y: lerp(-70, lerp(GY - 30, o.y - 4, dive), come) + 6 * Math.sin(t * 0.003) * (1 - dive) };
    }
    // scale is height: big = high above the floor, small = down on the ground
    function bossScale(t) {
      if (t < 2400) return 2.0 + 0.05 * Math.sin(t * 0.004);
      const hover = lerp(2.0, 2.15, smooth(seg(t, 2400, 4300)));
      const climb = 0.35 * smooth(seg(t, 4300, 5000));
      const slam = (hover + climb - 1.45) * (1 - Math.pow(1 - seg(t, 5000, 5300), 3) * 0) ;
      let s = hover + climb;
      if (t > 5000) s = lerp(s, 1.45, Math.pow(seg(t, 5000, 5300), 2.2));
      if (t > 5900) s = lerp(1.45, 2.3, smooth(seg(t, 5900, 6900)));
      void slam;
      return s;
    }
    function guy(t) {
      const w = walk(t, 400, 2300, -400, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 5300, time: t };
      if (t > 2300) { o.speed = 0; o.ang = Math.sin((t - 2300) * 0.004) * 0.3 * (1 - seg(t, 2800, 3300)); }
      if (t > 3200) { o.armsUp = smooth(seg(t, 3200, 3600)) * 0.8; }
      if (t > 4100) {                                    // looks up, freezes, then tries to run
        const p = seg(t, 4100, 5300);
        o.ang = lerp(o.ang, Math.PI, smooth(seg(t, 4100, 4500)));
        o.x = GX - 40 * outQuad(p); o.speed = p < 1 ? 0.9 : 0; o.walk = t * 0.013; o.armsUp = 0;
      }
      return o;
    }
    SCENES.gargoyle = {
      name: 'THE GARGUANTUAGOYLE', color: '#d0d4dc', dur: DUR, dark: 0.74, shade: '5,5,10',
      shakes: [[2400, 2, 300], [4300, 3, 300], [5300, 17, 330], [5350, 8, 600], [6100, 3, 200]],
      sfx: [[2300, 'heart'], [2500, 'whoosh'], [3400, 'roar'], [4400, 'whoosh'], [5000, 'whoosh'], [5300, 'slam'], [5310, 'scream'], [5900, 'thud']],
      flash: (t) => (t >= 5300 ? 0.4 * Math.exp(-(t - 5300) / 70) : 0),
      camera(t) {
        const a = smooth(seg(t, 0, 4400)), b = smooth(seg(t, 5200, 6500));
        return { x: lerp(-150, lerp(0, -20, b), a), y: lerp(6, 0, a), z: lerp(1.05, 1.22, a) + 0.14 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1).forEach((l) => L.push(l));
        L.push({ x: o.x, y: o.y, r: 90, a: 0.5 });
        for (let i = 0; i < 7; i++) L.push({ x: -340 + i * 125, y: i % 2 ? 112 : -112, r: 120, a: 0.3 });
        const b = bossPos(t);
        L.push({ x: b.x, y: b.y, r: 190, a: 0.4 + 0.2 * Math.sin(t * 0.005) + 0.5 * seg(t, 3000, 3600) * (1 - seg(t, 5300, 5700)) });
        if (t >= 5300) L.push({ x: guy(5300).x, y: GY, r: 260, a: 0.8 * Math.exp(-(t - 5300) / 350) + 0.18 });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('landing', (f) => {
          f.fillStyle = '#26262d'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -8; j < 9; j++) for (let i = -12; i < 13; i++) {
            f.fillStyle = lerpHex('#35353f', '#4a4a56', hash(i * 31 + j * 5));
            f.fillRect(i * 66, j * 56, 64, 54);
          }
          f.strokeStyle = '#c8b020'; f.lineWidth = 4; f.setLineDash([22, 16]);      // the landing zone marking
          f.strokeRect(-210, -120, 420, 240); f.setLineDash([]);
          f.fillStyle = 'rgba(200,176,32,0.8)'; f.font = 'bold 56px monospace'; f.textAlign = 'center';
          f.fillText('H', -150, -60);
          f.fillStyle = 'rgba(0,0,0,0.25)';
          for (let c = 0; c < 22; c++) { f.fillRect((hash(c * 2) - 0.5) * FW, (hash(c * 3) - 0.5) * FH, 30 + hash(c) * 50, 2); }
        }));
        const o = guy(t), b = bossPos(t), bs = bossScale(t);
        const high = Math.max(0, (bs - 1.45) / 0.85);          // 0 = on the ground, 1 = high
        // its shadow on the floor: big and faint when it's high, tight and black when it's low
        g.save();
        const sh = 0.5 + 0.7 * (1 - high * 0.55);
        g.fillStyle = `rgba(0,0,0,${0.18 + 0.3 * (1 - high)})`;
        g.beginPath(); g.ellipse(b.x + 18 * high, b.y + 50 + 40 * high, 110 * bs * 0.8 * sh, 38 * bs * 0.8 * sh, 0, 0, TAU); g.fill();
        g.restore();
        // the man, until he's flattened
        const hit = t >= 5300;
        if (!hit) drawHazmat(g, o);
        else {
          // under it: a flat smear and the crushed torch
          const sp = seg(t, 5300, 6300);
          drawBloodPool(g, o.x, o.y + 2, 6 + 52 * outCubic(sp), 5, 0.95);
          spray(g, o.x, o.y, t, 5300, { n: 40, r: 140, seed: 2, size: 3.4, dur: 800, streak: true });
          g.save(); g.translate(o.x, o.y);
          g.fillStyle = '#d6bd2c'; g.beginPath(); g.ellipse(0, 0, 24, 8, 0.1, 0, TAU); g.fill();       // the flattened suit
          g.fillStyle = '#9a8412'; g.beginPath(); g.ellipse(2, 1, 17, 4, 0.1, 0, TAU); g.fill();
          g.fillStyle = 'rgba(110,8,16,0.8)'; g.beginPath(); g.ellipse(-3, 0, 14, 5, 0, 0, TAU); g.fill();
          g.restore();
          droppedTorch(g, o.x + 34 * Math.min(1, sp * 3), o.y + 16 * Math.min(1, sp * 3), 0.7, false);
        }
        // the beast, on top
        g.save();
        const lift = Math.max(0, bs - 1.45);
        g.translate(b.x, b.y - 6 * lift * 10 * 0.4);
        g.scale(bs / 2.0, bs / 2.0);
        model(g, 31, 0, 0, 2.0, 0, t);
        g.restore();
        // dust blown out by the impact, and cracks running across the floor
        if (hit) {
          const p = (t - 5300) / 1400;
          const cx = guy(5300).x, cy = GY;
          for (let i = 0; i < 9; i++) {
            const a = hash(i * 4.3) * TAU, len = (70 + hash(i + 1) * 120) * outCubic(Math.min(1, p * 1.6));
            g.strokeStyle = 'rgba(8,8,10,0.85)'; g.lineWidth = 2.2 - i * 0.12;
            g.beginPath(); g.moveTo(cx, cy);
            for (let s = 1; s <= 6; s++) { const f = (s / 6) * len, wob = (hash(i * 9 + s) - 0.5) * 14; g.lineTo(cx + Math.cos(a) * f - Math.sin(a) * wob, cy + Math.sin(a) * f * 0.8 + Math.cos(a) * wob); }
            g.stroke();
          }
          if (p < 1) {
            g.strokeStyle = `rgba(230,225,215,${0.6 * (1 - p)})`; g.lineWidth = 3 * (1 - p) + 1;
            const R = 20 + 360 * outCubic(p);
            g.beginPath(); g.ellipse(cx, cy, R, R * 0.8, 0, 0, TAU); g.stroke();
            for (let i = 0; i < 46; i++) {
              const a = hash(i * 2.3) * TAU, d = (30 + hash(i + 3) * 200) * outCubic(p), r = (3 + hash(i + 5) * 9) * (1 + p);
              g.fillStyle = `rgba(190,185,175,${0.5 * (1 - p)})`;
              g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r, 0, TAU); g.fill();
            }
          }
        }
        // wind off the wings: grit streaming across the floor while it hovers
        if (t > 2400 && t < 5300) {
          const f = seg(t, 2400, 3400);
          g.save(); g.globalAlpha = 0.5 * f;
          drift(g, t, 40, { x: -420, y: -190, w: 840, h: 380 }, { color: '#cfcab8', vy: 20, vx: -150, size: 1.5, alpha: 0.7, seed: 99, twinkle: false });
          g.restore();
        }
      },
    };
  })();

