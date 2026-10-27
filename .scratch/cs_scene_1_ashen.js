  // ============ THE ASHEN ONE: burned alive by a fireball ============
  (function () {
    const KX = 175, KY = 0, KS = 2.0, U = 15, DUR = 8000;
    const GX = -105, GY = 14;
    // the man walks in, stops and sweeps his torch; the eye wakes; a fireball
    // leaves it at 4300 and lands on him at 4800
    const MUZZLE = { x: KX - 120, y: 0 };
    function guy(t) {
      const w = walk(t, 400, 2600, -400, 16, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6500 };
      if (t > 2600) {
        o.speed = 0;
        o.ang = Math.sin((t - 2600) * 0.004) * 0.3 * (1 - seg(t, 3100, 3600));
      }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3800)) * 0.8;
      if (t > 4800) {                                   // on fire: staggers back, spinning and thrashing
        const p = seg(t, 4800, 6300);
        o.x = GX - 55 * outQuad(p) + Math.sin(t * 0.021) * 4 * (1 - p);
        o.y = GY + Math.sin(t * 0.013) * 9 * (1 - p);
        o.ang = Math.sin(t * 0.017) * 1.2 * (1 - p);
        o.armsUp = 0; o.flail = 1 - seg(t, 6000, 6500);
        o.burn = smooth(seg(t, 4850, 6300));
        o.jitter = 0.3 * (1 - seg(t, 6000, 6500));
        o.speed = 0.7 * (1 - p);
        o.time = t;
        if (t > 6100) o.lie = outQuad(seg(t, 6100, 6800));
      }
      return o;
    }
    function ball(t) {                                  // the fireball in flight
      if (t < 4300 || t > 4800) return null;
      const o0 = seg(t, 4300, 4800), p = o0 * o0 * (3 - 2 * o0 * 0.4);
      const tgt = guy(4800);
      return { x: lerp(MUZZLE.x, tgt.x + 14, p), y: lerp(MUZZLE.y, tgt.y, p) };
    }
    SCENES.ashen = {
      name: 'THE ASHEN ONE', color: '#ff6a2a', dur: DUR, dark: 0.86, shade: '8,4,3',
      shakes: [[3500, 4, 260], [4300, 7, 200], [4800, 7, 180], [5400, 3, 160]],
      sfx: [[2900, 'heart'], [3500, 'roar'], [4250, 'fire'], [4800, 'scream'], [5400, 'scream'], [6300, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4800, 7000));
        return { x: lerp(-140, lerp(20, -5, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.28, a) + 0.1 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const chg = seg(t, 3300, 4300);
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.7 * (o.burn || 0)).forEach((l) => L.push(l));
        L.push({ x: KX, y: KY, r: 190 + 40 * chg, a: 0.42 + 0.35 * chg + 0.08 * Math.sin(t * 0.02) });
        const b = ball(t);
        if (b) L.push({ x: b.x, y: b.y, r: 190, a: 0.95 });
        if (t > 4800) {
          const fl = smooth(seg(t, 4800, 5200)) * (1 - smooth(seg(t, 6800, 7700)));
          L.push({ x: o.x, y: o.y, r: 210, a: 0.9 * fl * (0.85 + 0.15 * Math.sin(t * 0.04)) });
        }
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('basalt', (f) => {
          f.fillStyle = '#17100f'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -8; j < 9; j++) for (let i = -12; i < 13; i++) {
            f.fillStyle = lerpHex('#2a1d1b', '#40302c', hash(i * 19 + j * 11));
            f.fillRect(i * 70 + (j % 2) * 35, j * 52, 68, 50);
          }
          for (let v = 0; v < 26; v++) {               // lava veins in the cracks
            let x = (hash(v * 2.9) - 0.5) * FW, y = (hash(v * 4.3) - 0.5) * FH, a = hash(v * 6.1) * TAU;
            f.lineCap = 'round'; f.lineJoin = 'round';
            const pts = [[x, y]];
            for (let s = 0; s < 9; s++) { a += (hash(v * 9 + s) - 0.5) * 1.5; x += Math.cos(a) * 30; y += Math.sin(a) * 30; pts.push([x, y]); }
            [['rgba(255,70,10,0.25)', 11], ['#c4300a', 4.5], ['#ff9a30', 2]].forEach(([c, w]) => {
              f.strokeStyle = c; f.lineWidth = w; f.beginPath(); pts.forEach(([px, py], i) => (i ? f.lineTo(px, py) : f.moveTo(px, py))); f.stroke();
            });
          }
        }));
        const o = guy(t);
        // heat shimmer on the floor round the boss
        g.save(); g.globalCompositeOperation = 'lighter';
        glow(g, KX, KY, 260, '255,90,20', 0.2 + 0.1 * Math.sin(t * 0.01));
        g.restore();
        model(g, 5, KX, KY, KS, 0, t);
        // the fireball charging at the eye, then flying
        const chg = seg(t, 3300, 4300);
        if (chg > 0 && t < 4300) {
          g.save(); g.globalCompositeOperation = 'lighter';
          glow(g, MUZZLE.x, MUZZLE.y, 20 + 46 * chg, '255,150,40', 0.9 * chg);
          glow(g, MUZZLE.x, MUZZLE.y, 8 + 18 * chg, '255,240,190', chg);
          g.restore();
        }
        const b = ball(t);
        if (b) {
          for (let i = 0; i < 16; i++) {               // a streaming trail of embers
            const back = i * 0.045, s2 = Math.max(0, seg(t, 4300, 4800) - back);
            const tx = lerp(MUZZLE.x, b.x, 1), px = lerp(MUZZLE.x, tx, s2 / Math.max(0.001, seg(t, 4300, 4800)));
            g.fillStyle = `rgba(255,${120 + i * 6},30,${0.7 - i * 0.04})`;
            g.beginPath(); g.arc(lerp(b.x, MUZZLE.x, i / 16) + (hash(i + t * 0.01) - 0.5) * 8, lerp(b.y, MUZZLE.y, i / 16) + (hash(i * 3 + t * 0.01) - 0.5) * 8, 9 - i * 0.45, 0, TAU); g.fill();
            void px;
          }
          g.save(); g.globalCompositeOperation = 'lighter';
          glow(g, b.x, b.y, 60, '255,140,30', 0.9); glow(g, b.x, b.y, 24, '255,250,210', 1);
          g.restore();
          flame(g, b.x, b.y + 14, 34, 52, t, 3, false);
        }
        // the man, and the fire eating him
        if (t > 4800) drawBloodPool(g, o.x, o.y, 0, 1, 0);
        drawHazmat(g, o);
        if (t > 4800) {
          const fl = smooth(seg(t, 4800, 5100)) * (1 - smooth(seg(t, 6800, 7700)));
          if (fl > 0.02) {
            for (let i = 0; i < 6; i++) {
              const ox = Math.cos(i * 1.7 + t * 0.003) * 9, oy = Math.sin(i * 2.3 + t * 0.004) * 11;
              flame(g, o.x + ox, o.y + oy + 6, 17 * fl, (38 + 14 * hash(i)) * fl, t, i * 1.3, false);
            }
            g.save(); g.globalCompositeOperation = 'lighter'; glow(g, o.x, o.y, 54, '255,130,30', 0.7 * fl); g.restore();
          }
          if (t > 5100) {                                // embers rising, then drifting ash and smoke
            const a = seg(t, 5100, 5600) * (1 - seg(t, 7500, 8000));
            g.save(); g.globalAlpha = a;
            drift(g, t, 34, { x: o.x - 50, y: o.y - 110, w: 100, h: 130 }, { color: '#ff9a3c', vy: -45, vx: -8, size: 2, alpha: 0.9, seed: 7, sway: 6 });
            g.restore();
            if (t > 6300) {
              const sm = seg(t, 6300, 7000);
              for (let i = 0; i < 7; i++) {
                const ph = ((t * 0.0004 + hash(i)) % 1);
                g.fillStyle = `rgba(30,26,26,${0.28 * sm * (1 - ph)})`;
                g.beginPath(); g.arc(o.x + (hash(i + 3) - 0.5) * 24 + Math.sin(ph * 6 + i) * 8, o.y - ph * 70, 6 + ph * 18, 0, TAU); g.fill();
              }
            }
          }
          if (t > 6100) {                                // the dropped torch, still on
            droppedTorch(g, o.x + 28, o.y + 26, 0.6, t < 7400);
          }
        }
        g.save(); g.globalAlpha = 0.9;
        drift(g, t, 40, { x: -400, y: -170, w: 800, h: 340 }, { color: '#ffb060', vy: -18, vx: 4, size: 1.6, alpha: 0.7, seed: 31, sway: 10 });
        g.restore();
      },
    };
  })();

