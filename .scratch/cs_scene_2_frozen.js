  // ============ THE FROZEN MUTATION: frozen solid, then shattered ============
  (function () {
    const KX0 = 175, KS = 2.3, U = 15, DUR = 8500;
    const GX = -110, GY = 12;
    // it breathes frost from 3400; he turns to run and slows as the ice takes him;
    // fully frozen by 5600; it lunges at 6000 and he shatters at 6250
    function kx(t) {
      return KX0 - 150 * smooth(seg(t, 5850, 6200)) + 150 * smooth(seg(t, 6450, 7300)) * 0.98;
    }
    function guy(t) {
      const w = walk(t, 400, 2600, -400, 14, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6250, time: t };
      if (t > 2600) { o.speed = 0; o.ang = Math.sin((t - 2600) * 0.004) * 0.3 * (1 - seg(t, 3000, 3500)); }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3700)) * 0.8;
      if (t > 3900) {                                  // turns and tries to run
        const p = seg(t, 3900, 5600);
        o.ang = lerp(0, Math.PI, smooth(seg(t, 3900, 4250)));
        o.x = GX - 30 * outQuad(p);
        o.speed = (1 - p) * 0.9; o.walk = t * 0.011 * (1 - 0.7 * p);
        o.armsUp = 0;
        o.ice = smooth(seg(t, 4100, 5600));
        o.visorCrack = 0;
      }
      return o;
    }
    // crystals growing out of the man as the ice takes him
    function crystals(g, o, ice, t) {
      if (ice < 0.05) return;
      g.save(); g.translate(o.x, o.y);
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 3.1) * TAU, d = 8 + hash(i + 7) * 10;
        const len = (8 + hash(i + 2) * 14) * ice, w = 3 + hash(i + 5) * 3;
        const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
        g.fillStyle = `rgba(${200 + hash(i) * 40},${235},255,${0.55 * ice + 0.2})`;
        g.beginPath();
        g.moveTo(cx - Math.sin(a) * w, cy + Math.cos(a) * w);
        g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        g.lineTo(cx + Math.sin(a) * w, cy - Math.cos(a) * w);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.7; g.stroke();
      }
      g.restore();
    }
    SCENES.frozen = {
      name: 'THE FROZEN MUTATION', color: '#8fd8ff', dur: DUR, dark: 0.76, shade: '3,6,12',
      shakes: [[3500, 3, 260], [6000, 6, 150], [6250, 14, 260], [7000, 3, 150]],
      sfx: [[2900, 'heart'], [3400, 'roar'], [3900, 'ice'], [4800, 'ice'], [5600, 'creak'], [6000, 'whoosh'], [6250, 'shatter'], [6400, 'thud']],
      flash: (t) => (t >= 6250 ? 0.55 * Math.exp(-(t - 6250) / 90) : 0),
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 5600, 6600));
        return { x: lerp(-140, lerp(20, 0, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.3, a) + 0.14 * b * (t < 6900 ? 1 : 1 - seg(t, 6900, 8000)) };
      },
      lights(t) {
        const o = guy(t), L = [];
        if (t < 6250) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.8 * (o.ice || 0)).forEach((l) => L.push(l));
        L.push({ x: kx(t), y: 0, r: 260, a: 0.45 + 0.25 * seg(t, 3000, 3600) });
        for (let i = 0; i < 6; i++) L.push({ x: -330 + i * 140, y: i % 2 ? 105 : -105, r: 110, a: 0.35 });
        const br = seg(t, 3400, 4400) * (1 - seg(t, 5600, 6000));
        if (br > 0) L.push({ x: lerp(kx(t) - 110, o.x + 20, 0.5), y: 0, r: 230, a: 0.5 * br });
        if (t >= 6250) L.push({ x: o.x, y: o.y, r: 150, a: 0.7 * Math.exp(-(t - 6250) / 500) + 0.2 });
        if (o.ice > 0.2 && t < 6250) L.push({ x: o.x, y: o.y, r: 110, a: 0.45 * o.ice });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('ice', (f) => {
          f.fillStyle = '#16303c'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -11; i < 12; i++) {
            f.fillStyle = lerpHex('#27505f', '#4a8296', hash(i * 23 + j * 9));
            f.fillRect(i * 64, j * 64, 62, 62);
            f.fillStyle = 'rgba(255,255,255,0.07)'; f.fillRect(i * 64, j * 64, 62, 3);
          }
          f.lineCap = 'round';
          for (let v = 0; v < 30; v++) {                // frost cracks
            let x = (hash(v * 2.3) - 0.5) * FW, y = (hash(v * 3.7) - 0.5) * FH, a = hash(v * 5.9) * TAU;
            f.strokeStyle = 'rgba(220,245,255,0.55)'; f.lineWidth = 1.4; f.beginPath(); f.moveTo(x, y);
            for (let s = 0; s < 6; s++) { a += (hash(v * 7 + s) - 0.5) * 1.3; x += Math.cos(a) * 26; y += Math.sin(a) * 26; f.lineTo(x, y); }
            f.stroke();
          }
        }));
        const o = guy(t);
        const K = kx(t);
        // the breath of frost: a drift of snow and ice rolling from its maw across the floor
        const br = seg(t, 3400, 4300), fade = 1 - seg(t, 5600, 6000);
        if (br > 0 && fade > 0) {
          const sx = K - 100, sy = 0, ex = o.x + 10, ey = o.y;
          const reach = smooth(br);
          g.save();
          for (let i = 0; i < 120; i++) {
            const sd = i * 7.7;
            const ph = (t * 0.00055 * (0.6 + hash(sd)) + hash(sd + 1)) % 1;
            const f = ph * reach;
            const spread = 6 + f * 70 * hash(sd + 2);
            const px = lerp(sx, ex, f) + (hash(sd + 3) - 0.5) * spread, py = lerp(sy, ey, f) + (hash(sd + 4) - 0.5) * spread;
            g.globalAlpha = 0.65 * fade * Math.sin(Math.PI * ph);
            g.fillStyle = hash(sd + 5) > 0.5 ? '#eaf8ff' : '#9bd8f2';
            g.beginPath(); g.arc(px, py, 1.4 + hash(sd + 6) * 3, 0, TAU); g.fill();
          }
          g.restore();
        }
        // the floor frosts over round him as it spreads
        const frost = o.ice || 0;
        if (frost > 0) {
          g.save(); g.globalAlpha = 0.55 * frost;
          g.fillStyle = 'rgba(210,240,255,0.55)';
          g.beginPath(); g.ellipse(o.x, o.y, 22 + 70 * frost, 18 + 52 * frost, 0, 0, TAU); g.fill();
          g.restore();
        }
        model(g, 16, K, 0, KS, 0, t * 0.9);
        if (t < 6250) {
          drawHazmat(g, o);
          crystals(g, o, o.ice || 0, t);
        } else {
          // the shatter: chunks of ice and suit flying out, then lying scattered
          const p = (t - 6250);
          const shardSeed = (i) => ({ a: hash(i * 3.7) * TAU, v: 60 + hash(i + 1) * 170, s: 3 + hash(i + 2) * 7, r: hash(i + 3) * TAU, rs: (hash(i + 4) - 0.5) * 0.02 });
          for (let i = 0; i < 46; i++) {
            const s = shardSeed(i), e = outCubic(p / 900);
            const px = o.x + Math.cos(s.a) * s.v * e, py = o.y + Math.sin(s.a) * s.v * e * 0.8;
            g.save(); g.translate(px, py); g.rotate(s.r + s.rs * p);
            g.fillStyle = i % 9 === 0 ? '#e8d63a' : i % 7 === 0 ? '#8a0f1a' : `rgba(${150 + hash(i) * 60},${215 + hash(i + 9) * 25},255,0.82)`;
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(-s.s, -s.s * 0.4); g.lineTo(s.s * 0.8, -s.s * 0.7); g.lineTo(s.s, s.s * 0.5); g.lineTo(-s.s * 0.3, s.s * 0.8); g.closePath(); g.fill(); g.stroke();
            g.restore();
          }
          drawBloodPool(g, o.x, o.y, 3 + 14 * outQuad(seg(t, 6300, 7600)), 7, 0.85);
          droppedTorch(g, o.x - 34, o.y + 30, 2.6, t < 7200);
          // the visor, landing intact on the floor
          g.fillStyle = 'rgba(180,225,240,0.9)'; g.beginPath(); g.ellipse(o.x + 18, o.y + 24, 8, 11, 0.5, 0, TAU); g.fill();
        }
        g.save(); g.globalAlpha = 0.9;
        drift(g, t, 50, { x: -420, y: -190, w: 840, h: 380 }, { color: '#e8f6ff', vy: 14, vx: -10, size: 1.8, alpha: 0.8, seed: 51, sway: 12 });
        g.restore();
      },
    };
  })();

