  // ============ THE PUMPKIN KING: strangled with its vines ============
  (function () {
    const KX = 190, KY = -6, KS = 2.5, U = 15;
    const DUR = 9000;
    // the man walks in from the left, stops at GX, is grabbed at 4100 and
    // dragged to GX2, strangled until 6300, dropped at 6800
    const GX = -95, GY = 14, GX2 = -10;
    function guy(t) {
      const w = walk(t, 400, 2500, -400, 20, GX, GY);
      let x = w.x, y = w.y, ang = 0;
      let o = { x, y, ang, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6300 };
      if (t > 2500) {                                   // stops, sweeps the beam around, hears something
        o.ang = Math.sin((t - 2500) * 0.0045) * 0.35 * (1 - seg(t, 3000, 3500));
        o.speed = 0;
      }
      if (t > 3300) { o.armsUp = smooth(seg(t, 3300, 3700)) * 0.85; }
      if (t > 4100) {                                    // yanked toward the king, kicking
        const p = smooth(seg(t, 4100, 4900));
        o.x = lerp(GX, GX2, p); o.y = lerp(GY, -4, p);
        o.flail = 1 - 0.55 * seg(t, 4900, 6300);
        o.armsUp = 0;
      }
      if (t > 4300) { o.jitter = 0.28 * (1 - seg(t, 5600, 6300)); }
      return o;
    }
    SCENES.pumpkin = {
      name: 'THE PUMPKIN KING', color: '#ff9a3c', dur: DUR, dark: 0.84, shade: '4,8,10',
      shakes: [[4100, 7, 160], [4900, 5, 140], [5500, 4, 130], [6300, 6, 200], [6800, 5, 160]],
      sfx: [[3300, 'heart'], [3900, 'whoosh'], [4150, 'creak'], [4900, 'creak'], [5600, 'creak'], [5900, 'scream'], [6500, 'thud'], [6900, 'roar']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4200, 7000));
        return { x: lerp(-150, lerp(30, 55, b), a), y: lerp(8, -4, a), z: lerp(1.05, 1.38, a) + 0.05 * b };
      },
      lights(t) {
        const o = guy(t);
        const L = [];
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.8 * seg(t, 5800, 6300)).forEach((l) => L.push(l));
        for (let i = 0; i < 6; i++) L.push({ x: -300 + i * 130, y: i % 2 ? 110 : -120, r: 90, a: 0.42 });
        const roar = 0.35 + 0.4 * seg(t, 3600, 4000) + 0.15 * Math.sin(t * 0.012) * seg(t, 4100, 6300);
        L.push({ x: KX, y: KY + 14, r: 150, a: roar });
        return L;
      },
      world(g, t) {
        blitFloor(g, wardFloor());
        [[-300, 110], [-170, -125], [-30, 120], [90, -118], [330, 105], [320, -120]].forEach(([x, y], i) => lantern(g, x, y, t, i * 2));
        const o = guy(t);
        const lift = (t > 4100 && t < 6800) ? 7 * Math.sin(Math.PI * seg(t, 4100, 4500)) + 5 * seg(t, 4500, 5000) * (1 - seg(t, 6300, 6800)) : 0;
        // the king, with a squeeze-pulse in its fire
        model(g, 32, KX, KY, KS, 0, t * 0.8 + 2000);
        // the man: standing, then lifted and strangled, then dropped
        const dropP = seg(t, 6300, 6900);
        const limp = smooth(dropP);
        g.save();
        const gp = { x: o.x, y: o.y };
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(gp.x + lift * 0.6, gp.y + 5 + lift * 0.5, U * 1.2 * (1 - lift * 0.01), U * 1.25, 0, 0, TAU); g.fill();
        const fall = outQuad(seg(t, 6600, 6900));
        drawHazmat(g, Object.assign({}, o, {
          y: o.y - lift * (1 - fall), shadow: 0, sx: 1 + lift * 0.016, sy: 1 + lift * 0.016,
          lie: t > 6300 ? Math.max(limp * 0.6, outQuad(seg(t, 6600, 7100))) : 0,
          flail: t > 6300 ? 0 : o.flail, visorCrack: seg(t, 5200, 6000), fog: 0, moss: 0,
          armsUp: t > 6300 ? 0 : o.armsUp,
        }));
        g.restore();
        // the vines: they lash out, bind him, and squeeze
        const reach = outCubic(seg(t, 3800, 4150)), release = seg(t, 6300, 6900);
        if (t > 3800 && release < 1) {
          const ext = reach * (1 - release);
          const target = (i) => {
            const tg = [{ x: o.x + 4, y: o.y - 14 - lift }, { x: o.x + 2, y: o.y + 14 - lift }, { x: o.x + 8, y: o.y - lift }, { x: o.x - 4, y: o.y + 4 - lift }][i];
            return tg;
          };
          for (let i = 0; i < 4; i++) {
            const from = { x: KX - 56, y: KY - 36 + i * 24 };
            drawVine(g, vineTo(from, target(i), ext, t, i * 2.1, i % 2 ? 30 : -30), 9, 4.5, '#12300e', '#46982a', '#e4dcb2');
          }
          if (t > 4050) {                                    // binding rings coil on after the grab
            const wrap = smooth(seg(t, 4050, 4500)) * (1 - release);
            const squeeze = 1 - 0.22 * Math.max(0, Math.sin((t - 4500) * 0.0075)) * seg(t, 4500, 4800) - 0.12 * seg(t, 4900, 6200);
            const cx = o.x, cy = o.y - lift;
            g.globalAlpha = wrap;
            vineRing(g, cx - 3, cy, 17 * squeeze, 21 * squeeze, 0, 3.6, t, 1);
            vineRing(g, cx + 8, cy, 13 * squeeze, 13 * squeeze, 0.4, 3.8, t, 3);           // round the neck
            vineRing(g, cx - 12, cy, 14 * squeeze, 19 * squeeze, 0, 3.4, t, 5);
            g.globalAlpha = 1;
          }
        }
        // the torch he drops, rolling to a stop and dying
        if (t > 6300) {
          const p = outCubic(seg(t, 6300, 6800));
          droppedTorch(g, lerp(o.x + 12, o.x - 50, p), lerp(o.y + 18, o.y + 44, p), lerp(0, -0.6, p), t < 7400 && (t % 160) < 110);
        }
      },
      after(g, t) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const squeeze = 0.3 + 0.2 * Math.max(0, Math.sin((t - 4500) * 0.0075)) * seg(t, 4200, 6300);
        glow(g, KX, KY + 16, 150, '255,140,40', 0.2 + squeeze * 0.4 + 0.25 * seg(t, 3600, 4100) * (1 - seg(t, 6300, 8000)));
        g.restore();
      },
    };
  })();

  // ============ THE LAST KNIGHT: run through with its sword ============
  (function () {
    const DUR = 8500, U = 15;
    const GX = -118, GY = 8;
    const KS = 1.5, BLADE = 150 * KS;
    const K0 = 270, K1 = 108;                     // the knight's x at rest, and at the end of its lunge
    function knightX(t) {
      let x = K0;
      if (t > 3550) x = lerp(K0, K1, inQuad(seg(t, 3550, 3720)));
      if (t > 5500) x = lerp(K1, K0 - 30, outCubic(seg(t, 5500, 6100)));
      return x;
    }
    function knightRot(t) { return Math.PI * smooth(seg(t, 2300, 3200)) + 0.04 * Math.sin(t * 0.02) * seg(t, 3720, 5500); }
    function guy(t) {
      const w = walk(t, 400, 2100, -420, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 3750 };
      if (t > 2100) { o.speed = 0; o.ang = Math.sin((t - 2100) * 0.005) * 0.3 * (1 - seg(t, 2500, 3000)); }
      if (t > 3100) o.armsUp = smooth(seg(t, 3100, 3500)) * 0.7;
      if (t > 3720) {                                // run through: he doubles over the blade, hands on it
        o.armsUp = 0; o.reach = { x: 1.1, y: 0.5, k: smooth(seg(t, 3720, 3900)), sym: true };
        o.jitter = 0.32 * (1 - seg(t, 4900, 5500));
        o.flashlight = false;
      }
      if (t > 5500) { o.reach = null; o.jitter = 0; }
      return o;
    }
    SCENES.knight = {
      name: 'THE LAST KNIGHT', color: '#dc3c3c', dur: DUR, dark: 0.85, shade: '6,5,10',
      shakes: [[3720, 11, 190], [4400, 3, 100], [5500, 5, 150], [6300, 4, 140]],
      sfx: [[2300, 'creak'], [2700, 'thud'], [3550, 'whoosh'], [3730, 'stab'], [5500, 'whoosh'], [5650, 'squelch'], [5800, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 3600)), b = smooth(seg(t, 3600, 6500));
        return { x: lerp(-180, lerp(-10, 20, b), a), y: lerp(10, 2, a), z: lerp(1.1, 1.5, a) + 0.1 * smooth(seg(t, 3600, 3900)) - 0.08 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const torchOn = t < 3750 ? 1 : (t < 6200 ? 0.5 * (1 - seg(t, 5600, 6200)) + 0.0 : 0);
        if (t < 3750) torchLights(o.x, o.y, o.ang, t, U, 1).forEach((l) => L.push(l));
        else if (t < 6300) {                          // the dropped torch, lying on the floor, still shining
          const f = (t > 5800 && (t % 190) < 70) ? 0.3 : 0.9;
          L.push({ x: o.x - 40, y: o.y + 40, r: 200, a: 0.7 * f * (1 - seg(t, 6000, 6300)), cone: true, ang: -0.5, half: 0.4 });
        }
        L.push({ x: o.x, y: o.y, r: 80, a: 0.6 });
        [[-330, -125], [-110, -128], [110, -126], [330, -125]].forEach(([x, y], i) => L.push(sconceLight(x, y, t, i, 170)));
        L.push({ x: knightX(t), y: 0, r: 120, a: 0.12 + 0.5 * seg(t, 2300, 3300) });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('castle', (f) => {
          f.fillStyle = '#1a1a20'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -10; i < 11; i++) {
            const ox = (j % 2) * 40;
            f.fillStyle = lerpHex('#34343e', '#4a4a56', hash(i * 17 + j * 13));
            f.fillRect(i * 80 + ox, j * 56, 78, 54);
            f.fillStyle = 'rgba(255,255,255,0.05)'; f.fillRect(i * 80 + ox, j * 56, 78, 2);
          }
          f.fillStyle = '#5a0f16'; f.fillRect(-FW / 2, -48, FW, 96);
          f.fillStyle = '#b8902c'; f.fillRect(-FW / 2, -48, FW, 3); f.fillRect(-FW / 2, 45, FW, 3);
          f.fillStyle = '#7a1620'; for (let i = -22; i < 23; i++) f.fillRect(i * 32, -30, 16, 60);
        }));
        [[-330, -125], [-110, -128], [110, -126], [330, -125]].forEach(([x, y], i) => sconce(g, x, y, t, i * 3));
        const o = guy(t);
        const kx = knightX(t), rot = knightRot(t);
        const hit = t >= 3720;
        const gone = seg(t, 5500, 6000);
        // blood on the floor: sprayed out behind him, then a growing pool
        if (hit) {
          drawBloodPool(g, o.x - 14, o.y + 6, 4 + 34 * outQuad(seg(t, 3800, 7600)), 3, 0.95);
          spray(g, o.x - 20, o.y, t, 3730, { n: 26, r: 85, seed: 5, dir: Math.PI, spread: 1.4, size: 3.2, dur: 600, streak: true });
          spray(g, o.x + 14, o.y, t, 3730, { n: 12, r: 40, seed: 9, dir: 0, spread: 1.6, size: 2.4, dur: 400 });
        }
        // the dropped flashlight
        if (t > 3750) {
          const p = outCubic(seg(t, 3750, 4300));
          droppedTorch(g, lerp(o.x + 14, o.x - 36, p), lerp(o.y + 16, o.y + 38, p), lerp(0, -0.5, p), t < 6000 && !(t > 5800 && (t % 190) < 70));
        }
        // the man
        let lie = 0;
        if (t > 5500) lie = outQuad(seg(t, 5500, 6300));
        const slump = t > 3720 ? 0.45 * smooth(seg(t, 3720, 4400)) : 0;
        drawHazmat(g, Object.assign({}, o, { lie: Math.max(lie, slump * (t < 5500 ? 1 : 0)), lieSide: 1, sx: 1 - slump * 0.1, flashlight: false, visorCrack: 0 }));
        if (t > 3750 && t < 5500) drawHazmat(g, { x: 9999, y: 9999, u: 1 });  // (keeps the draw order simple)
        // the knight, over him: his sword is the thing through his chest
        model(g, 11, kx, 0, KS, rot, 5226 + Math.sin(t * 0.01) * 30);
        // blood running up the blade from the tip
        if (hit && rot > Math.PI - 0.1) {
          const tipX = kx - BLADE, entry = o.x + 15;
          const upto = lerp(entry, kx - 40, 0.6 * smooth(seg(t, 4200, 7000)) * (t < 5500 ? 1 : 0.6));
          if (upto > tipX) {
            const gr = g.createLinearGradient(tipX, 0, upto, 0);
            gr.addColorStop(0, 'rgba(120,6,14,0.95)'); gr.addColorStop(0.15, 'rgba(150,10,20,0.9)'); gr.addColorStop(1, 'rgba(110,6,12,0.85)');
            g.fillStyle = gr;
            g.beginPath(); g.moveTo(tipX, 0); g.lineTo(tipX + 12, -3.4 * 1.2); g.lineTo(upto, -9); g.lineTo(upto, 9); g.lineTo(tipX + 12, 3.4 * 1.2); g.closePath(); g.fill();
          }
          if (t > 5500) {                                  // drips falling off the lifted blade
            for (let i = 0; i < 4; i++) {
              const fx = lerp(kx - BLADE * 0.9, kx - 60, hash(i + 4)), ph = ((t * 0.0008 + hash(i)) % 1);
              g.fillStyle = '#8a0f1a'; g.beginPath(); g.ellipse(fx, 6 + ph * 20, 1.6, 2.4, 0, 0, TAU); g.fill();
            }
          }
        }
      },
      after(g, t) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const flash = Math.max(0, 1 - (t - 3730) / 160) * (t >= 3730 ? 1 : 0);
        if (flash > 0) glow(g, GX + 5, GY, 120, '255,255,255', 0.8 * flash);       // the spark where steel meets suit
        g.restore();
      },
    };
  })();

