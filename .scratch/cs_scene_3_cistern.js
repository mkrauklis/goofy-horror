  // ============ THE CISTERN: dragged under the water ============
  (function () {
    const KS = 2.4, U = 15, DUR = 8500;
    const GX = -70, GY = 8;
    const HEAD = 55;                                  // the model's mouth, this far right of its centre
    // the worm comes in under the water (a wake), rises at 4100, grabs him at 4550,
    // and drags him under, backing away to the right until 6300
    function wormX(t) {
      const come = smooth(seg(t, 3900, 4450));
      const back = smooth(seg(t, 4700, 6300));
      return lerp(GX + 330, GX + 78 + HEAD * KS, come) + back * 320;   // the head's x is wormX - HEAD*KS (it faces left)
    }
    function wormVisible(t) { return smooth(seg(t, 3900, 4250)) * (1 - smooth(seg(t, 5600, 6300))); }
    function guy(t) {
      const w = walk(t, 400, 2500, -400, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk * 0.7, speed: w.speed * 0.8, flashlight: t < 5900, time: t };
      if (t > 2500) { o.speed = 0; o.ang = Math.sin((t - 2500) * 0.004) * 0.32 * (1 - seg(t, 3000, 3600)); }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3800)) * 0.8;
      if (t > 4300) {                                  // turns, too late
        o.ang = lerp(o.ang, 0.3, smooth(seg(t, 4300, 4550)));
        o.armsUp = 0; o.flail = smooth(seg(t, 4550, 4800));
      }
      if (t > 4600) {                                  // dragged by the worm, sinking
        const p = seg(t, 4700, 6300);
        o.x = GX + 20 + 320 * smooth(p) * 0.82;
        o.y = GY + Math.sin(t * 0.012) * 5 * (1 - p);
        o.flail = (1 - seg(t, 5600, 6200)) * 1.2;
      }
      return o;
    }
    function sink(t) { return smooth(seg(t, 5000, 6300)); }  // 0 = at the surface, 1 = gone
    // concentric rings spreading across the water from (x,y)
    function ripples(g, x, y, t, t0, dur, n, maxR, col) {
      for (let i = 0; i < n; i++) {
        const p = (t - t0 - i * dur * 0.16) / dur;
        if (p <= 0 || p >= 1) continue;
        g.strokeStyle = `rgba(${col},${0.55 * (1 - p)})`; g.lineWidth = 2.2 * (1 - p) + 0.4;
        g.beginPath(); g.ellipse(x, y, maxR * outCubic(p), maxR * outCubic(p) * 0.72, 0, 0, TAU); g.stroke();
      }
    }
    SCENES.cistern = {
      name: 'THE CISTERN', color: '#3ad6b0', dur: DUR, dark: 0.77, shade: '2,8,10',
      shakes: [[3900, 3, 220], [4550, 9, 200], [5000, 4, 160], [6300, 2, 140]],
      sfx: [[2900, 'heart'], [3500, 'creak'], [3900, 'splash'], [4550, 'roar'], [4560, 'splash'], [4900, 'scream'], [5700, 'splash'], [6200, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4500, 6600));
        return { x: lerp(-150, lerp(5, 70, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.32, a) + 0.08 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const dim = 1 - 0.85 * sink(t);
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, dim).forEach((l) => L.push(l));
        L.push({ x: o.x, y: o.y, r: 90, a: 0.5 * dim });
        for (let i = 0; i < 5; i++) L.push({ x: -300 + i * 150, y: i % 2 ? 110 : -110, r: 120, a: 0.3 });
        const wv = wormVisible(t);
        if (wv > 0) L.push({ x: wormX(t) - HEAD * KS - 60, y: 0, r: 200, a: 0.5 * wv });
        // the torch, bobbing on the surface after he's gone
        if (t > 5900) L.push({ x: o.x + 10, y: o.y + 4, r: 170, a: 0.65 * (1 - seg(t, 7000, 7900)) * (0.7 + 0.3 * Math.sin(t * 0.011)) });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('cistern', (f) => {
          f.fillStyle = '#0c2a2e'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -11; i < 12; i++) {   // the tiled bottom, seen through the water
            f.fillStyle = lerpHex('#123a40', '#1d5a60', hash(i * 13 + j * 29));
            f.fillRect(i * 64, j * 64, 62, 62);
          }
          f.strokeStyle = 'rgba(120,230,215,0.12)'; f.lineWidth = 2;   // caustics
          for (let c = 0; c < 70; c++) {
            const x = (hash(c * 1.3) - 0.5) * FW, y = (hash(c * 2.9) - 0.5) * FH;
            f.beginPath(); f.moveTo(x, y); f.bezierCurveTo(x + 20, y - 14, x + 40, y + 14, x + 60, y); f.stroke();
          }
          f.fillStyle = '#1b1e22';                          // walkway posts and the walls' edge
          for (let i = -10; i < 11; i++) { f.fillRect(i * 70, -FH / 2, 8, 22); f.fillRect(i * 70, FH / 2 - 22, 8, 22); }
        }));
        const o = guy(t), sk = sink(t);
        // slow ambient ripples on the water
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.0003 + hash(i)) % 1;
          g.strokeStyle = `rgba(140,235,225,${0.16 * (1 - ph)})`; g.lineWidth = 1.2;
          g.beginPath(); g.ellipse(-300 + hash(i + 2) * 600, -110 + hash(i + 3) * 220, 6 + ph * 40, (6 + ph * 40) * 0.7, 0, 0, TAU); g.stroke();
        }
        // wading ripples round his legs while he's on his feet
        if (t > 400 && t < 5800) {
          const moving = t < 2500 ? 1 : 0.3;
          ripples(g, o.x - 2, o.y, t, Math.floor(t / 420) * 420 - 0, 700, 2, 26 * moving + 12, '170,245,235');
        }
        // the wake of the worm coming under the surface, then the churn where it grabs
        if (t > 3000 && t < 4600) {
          const p = seg(t, 3000, 4450);
          const hx = lerp(GX + 420, GX + 90, smooth(p));
          for (let i = 0; i < 9; i++) {
            const ox = hx + i * 16;
            g.strokeStyle = `rgba(190,250,240,${0.4 * (1 - i / 9)})`; g.lineWidth = 2;
            g.beginPath(); g.moveTo(ox, -4 - i * 2.1); g.lineTo(ox - 14, 0); g.lineTo(ox, 4 + i * 2.1); g.stroke();
          }
        }
        if (t > 4450) ripples(g, GX + 80, 0, t, 4450, 1500, 4, 120, '200,255,245');
        // blood clouding the water where he went
        if (t > 4800) {
          const e = seg(t, 4800, 7600);
          const bx = lerp(o.x, GX + 240, 0.4);
          const gr = g.createRadialGradient(bx, 4, 0, bx, 4, 20 + 90 * e);
          gr.addColorStop(0, `rgba(120,10,16,${0.55 * (1 - 0.4 * e)})`); gr.addColorStop(1, 'rgba(120,10,16,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(bx, 4, 20 + 90 * e, (20 + 90 * e) * 0.7, 0, 0, TAU); g.fill();
        }
        // the man: shrinking and fading as the water closes over him
        g.save();
        g.globalAlpha = 1 - 0.95 * sk;
        drawHazmat(g, Object.assign({}, o, { sx: 1 - 0.35 * sk, sy: 1 - 0.35 * sk, shadow: 0 }));
        g.restore();
        if (sk > 0.05 && sk < 0.98) {                  // the water already lapping over him
          g.fillStyle = `rgba(14,70,78,${0.6 * sk})`;
          g.beginPath(); g.ellipse(o.x, o.y, 22, 20, 0, 0, TAU); g.fill();
          ripples(g, o.x, o.y, t, 5000, 1000, 3, 44, '190,250,240');
        }
        // bubbles rising from where he went down
        if (t > 5600) {
          for (let i = 0; i < 16; i++) {
            const ph = ((t - 5600) * 0.0007 + hash(i)) % 1, bx = o.x + (hash(i + 4) - 0.5) * 34, by = o.y - ph * 40 + 10;
            g.strokeStyle = `rgba(200,250,245,${0.7 * (1 - ph)})`; g.lineWidth = 1;
            g.beginPath(); g.arc(bx, by, 1.5 + hash(i + 8) * 3, 0, TAU); g.stroke();
          }
        }
        // the worm: rises head-first, grabs, and slides back under
        const wv = wormVisible(t);
        if (wv > 0.01) {
          const wx = wormX(t);
          g.save();
          g.globalAlpha = wv;
          const rise = 0.35 + 0.65 * smooth(seg(t, 3900, 4400));
          model(g, 21, wx, 0, KS * rise, Math.PI, t * 0.9);
          g.restore();
          if (t > 4550 && t < 5800) {                // spray off the strike
            spray(g, wx - HEAD * KS, 0, t, 4550, { n: 22, r: 80, seed: 3, dir: Math.PI, spread: 2.2, size: 2.6, dur: 700, color: 'rgba(200,250,245,0.85)' });
          }
        }
        // the dropped torch, floating on the surface where he sank
        if (t > 5900) {
          const bob = Math.sin(t * 0.004) * 2;
          droppedTorch(g, o.x + 10, o.y + 6 + bob, 0.3 + Math.sin(t * 0.0025) * 0.2, t < 7200);
          ripples(g, o.x + 10, o.y + 6, t, 5900, 2000, 3, 36, '180,245,235');
        }
      },
    };
  })();

