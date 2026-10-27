  // ============ THE MULTIPOD: bursts out of the facility doors, over the man holding them shut ============
  (function () {
    const U = 15, DUR = 8600;
    // the facade seen from above-and-in-front, like the level itself: the doors are
    // 2*DW wide and DH tall, their sill on y = 0, the lot spreading out south of it
    const DW = 70, DH = 66;
    const HITS = [[1500, 7, 10], [3200, 12, 22], [4800, 17, 34]];   // [when, how far the doors bow, how far it shoves him back]
    const BURST = 6000;
    const SWARM = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
    const M_N = 64;
    const MEMBERS = [];
    for (let i = 0; i < M_N; i++) {
      MEMBERS.push({
        id: SWARM[i % SWARM.length],
        lane: (hash(i * 3.3) - 0.5) * 140, s: 0.2 + hash(i * 5.7) * 0.2,
        ts: BURST + 40 + hash(i * 4.1) * 1250, v: 0.24 + hash(i * 9.3) * 0.18, ph: hash(i * 1.9) * 6,
      });
    }
    MEMBERS.sort((a, b) => a.s - b.s);                          // small ones first, so the big ones cover them
    const hitsSoFar = (t) => HITS.filter((h) => t >= h[0]).length;
    // the doors' permanent damage, plus the extra bow right after each hit
    function gapAt(t) {
      const perm = [0, 2.5, 7, 13][hitsSoFar(t)];
      let tr = 0;
      HITS.forEach(([t0, b]) => { if (t >= t0) tr += b * Math.exp(-(t - t0) / 170); });
      const tremble = t > 5000 && t < BURST ? Math.sin(t * 0.11) * 1.4 : 0;
      return perm + tr * 0.6 + tremble;
    }
    function glowAt(t) { return Math.min(1, 0.12 + 0.2 * hitsSoFar(t) + 0.08 * Math.sin(t * 0.008) + (t >= BURST ? 0.5 : 0)); }
    function guy(t) {
      let push = 0, jit = 0;
      const n = hitsSoFar(t);
      HITS.forEach(([t0, , s]) => { if (t >= t0) { push += s * Math.exp(-(t - t0) / 330); jit += 0.3 * Math.exp(-(t - t0) / 220); } });
      const o = { x: Math.sin(t * 0.012) * 1.2 * n, y: 17 + push, ang: -Math.PI / 2, u: U, walk: 0, speed: 0, armsUp: 1, time: t };
      o.jitter = 0.04 + n * 0.06 + jit;
      o.flail = n ? 0.45 * Math.exp(-(t - HITS[n - 1][0]) / 260) : 0;
      if (t >= BURST) {                                       // the doors go and he goes with them
        const p = seg(t, BURST + 40, BURST + 700);
        o.y = 17 + push + 125 * outQuad(p);
        o.x += 20 * outQuad(p);
        o.ang = -Math.PI / 2 + 2.4 * outQuad(p);
        o.lie = outQuad(seg(t, BURST + 80, BURST + 520));
        o.armsUp = 1 - outQuad(seg(t, BURST + 20, BURST + 300));
        o.flail = 1 - p; o.jitter = 0;
      }
      return o;
    }
    // one door leaf. side -1 = left, 1 = right; its seam edge bows in by `bulge`
    function leaf(g, side, gap, bulge, cracks, t) {
      const outer = side * DW, inner = side * (gap / 2 + 1), top = -DH, bot = -2;
      const edge = [[outer, top], [inner, top + bulge], [inner, bot - bulge], [outer, bot]];
      g.beginPath(); edge.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      g.fillStyle = '#3d424b'; g.fill(); g.strokeStyle = '#1b1e23'; g.lineWidth = 3; g.stroke();
      const ins = 9;                                           // the glass, a little inside the frame
      const gl = [[outer - side * ins, top + ins], [inner + side * ins * 0.4, top + bulge + ins], [inner + side * ins * 0.4, bot - bulge - ins], [outer - side * ins, bot - ins]];
      g.beginPath(); gl.forEach(([x, y], i) => { if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      g.fillStyle = 'rgba(127,180,216,0.5)'; g.fill();
      g.strokeStyle = 'rgba(20,30,40,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.moveTo(gl[0][0], gl[0][1] + 6); g.lineTo(gl[0][0] - side * 22, gl[0][1] + 6); g.lineTo(gl[0][0] - side * 44, gl[3][1] - 6); g.lineTo(gl[0][0] - side * 22, gl[3][1] - 6); g.closePath(); g.fill();
      if (cracks > 0) {                                        // the glass crazes out from where it's been hit
        const cx = side * (gap / 2 + DW * 0.2), cy = -DH * 0.5;
        g.strokeStyle = 'rgba(235,245,255,0.85)'; g.lineWidth = 1.2;
        for (let i = 0; i < cracks * 4; i++) {
          const a = hash(i * 2.7 + side) * TAU, len = 22 + hash(i + 4) * 40 * (0.5 + cracks * 0.3);
          g.beginPath(); g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * len * 0.5 + (hash(i + 9) - 0.5) * 6, cy + Math.sin(a) * len * 0.5 + (hash(i + 7) - 0.5) * 6);
          g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
        }
        g.strokeStyle = `rgba(10,12,16,${0.16 + 0.08 * cracks})`; g.lineWidth = 3 + cracks * 1.6;      // the dent itself
        g.beginPath(); g.ellipse(cx, cy, 14 + cracks * 7, 20 + cracks * 8, 0, 0, TAU); g.stroke();
      }
      g.fillStyle = '#c4c9d1';                                 // the push bar
      rr(g, inner - side * 6 - 4, -DH * 0.48, 8, 26, 3); g.fill();
      g.strokeStyle = '#1b1e23'; g.lineWidth = 1; g.stroke();
      void t;
    }
    SCENES.multipod = {
      name: 'THE MULTIPOD', color: '#ff4a4a', dur: DUR, dark: 0.4, shade: '12,6,22',
      shakes: [[1500, 7, 260], [3200, 11, 300], [4800, 15, 340], [BURST, 20, 420]],
      sfx: [[900, 'heart'], [1500, 'slam'], [1580, 'creak'], [2500, 'creak'], [3200, 'slam'], [3260, 'roar'], [4800, 'slam'], [4860, 'roar'],
        [BURST, 'shatter'], [BURST + 40, 'roar'], [BURST + 150, 'scream'], [BURST + 330, 'thud'], [BURST + 800, 'roar']],
      flash: (t) => (t >= BURST ? 0.55 * Math.exp(-(t - BURST) / 110) : 0),
      camera(t) {
        const push = smooth(seg(t, 0, 4800)), fol = smooth(seg(t, BURST, BURST + 1800));
        return { x: 0, y: lerp(-40, -34, push) + 40 * fol, z: lerp(1.5, 2.1, push) - 0.5 * fol };
      },
      lights(t) {
        const L = [{ x: 0, y: -20, r: 540, a: 0.92 }];
        L.push({ x: 0, y: -34, r: 110 + 90 * glowAt(t), a: 0.35 + 0.5 * glowAt(t) });
        if (t >= BURST) L.push({ x: 0, y: 60, r: 260, a: 0.5 * Math.exp(-(t - BURST) / 900) + 0.2 });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('facility-front', (f) => {
          // the lot
          f.fillStyle = '#7d828b'; f.fillRect(-FW / 2, 0, FW, FH / 2);
          for (let j = 0; j < 7; j++) for (let i = -11; i < 12; i++) {
            f.fillStyle = lerpHex('#777c85', '#8d929b', hash(i * 17 + j * 3));
            f.fillRect(i * 64, j * 56 + 8, 62, 54);
          }
          for (let k = 0; k < 160; k++) {                      // stains, grit, hairline cracks
            f.fillStyle = `rgba(0,0,0,${0.04 + hash(k) * 0.1})`;
            f.beginPath(); f.ellipse((hash(k * 2.3) - 0.5) * FW, 14 + hash(k * 3.1) * 340, 3 + hash(k + 2) * 12, 2 + hash(k + 5) * 6, 0, 0, TAU); f.fill();
          }
          f.strokeStyle = 'rgba(30,30,34,0.5)'; f.lineWidth = 1.2;
          for (let k = 0; k < 26; k++) {
            let x = (hash(k * 5.1) - 0.5) * FW, y = 20 + hash(k * 7.3) * 330;
            f.beginPath(); f.moveTo(x, y);
            for (let s = 0; s < 5; s++) { x += (hash(k * 9 + s) - 0.3) * 22; y += (hash(k * 11 + s) - 0.4) * 14; f.lineTo(x, y); }
            f.stroke();
          }
          f.strokeStyle = 'rgba(255,255,255,0.5)'; f.lineWidth = 3;      // parking lines
          for (let x = -420; x <= 420; x += 84) { f.beginPath(); f.moveTo(x, 170); f.lineTo(x, 280); f.stroke(); }
          // the facade
          f.fillStyle = '#8d939c'; f.fillRect(-FW / 2, -FH / 2, FW, FH / 2);
          f.fillStyle = '#6f757e'; f.fillRect(-FW / 2, -FH / 2, FW, 120);
          f.fillStyle = '#b6bcc4'; f.fillRect(-FW / 2, -14, FW, 14);
          f.strokeStyle = 'rgba(0,0,0,0.12)'; f.lineWidth = 1;
          for (let y = -300; y < 0; y += 34) { f.beginPath(); f.moveTo(-FW / 2, y); f.lineTo(FW / 2, y); f.stroke(); }
          for (let wy = -226; wy < -80; wy += 52) for (let wx = -600; wx < 600; wx += 64) {
            if (Math.abs(wx + 20) < 190 && wy > -190) continue;
            f.fillStyle = '#a8d4f0'; f.fillRect(wx, wy, 40, 30);
            f.fillStyle = 'rgba(255,255,255,0.45)'; f.fillRect(wx + 3, wy + 3, 14, 10);
            f.strokeStyle = '#4a4f57'; f.lineWidth = 2; f.strokeRect(wx, wy, 40, 30);
          }
          f.fillStyle = '#2a2d33'; f.fillRect(-DW - 10, -DH - 10, DW * 2 + 20, DH + 10);     // the door frame
          f.fillStyle = '#3a3d44'; f.fillRect(-DW - 22, -DH - 44, DW * 2 + 44, 26);          // the sign
          f.fillStyle = '#fff'; f.font = 'bold 17px monospace'; f.textAlign = 'center';
          f.fillText('THE FACILITY', 0, -DH - 25);
          for (let i = -DW - 10; i < DW + 10; i += 16) {                                      // hazard stripes on the sill
            f.fillStyle = (Math.floor(i / 16) % 2) ? '#d8c020' : '#222';
            f.fillRect(i, 0, 16, 7);
          }
        }));
        const gap = gapAt(t), gl = glowAt(t), n = hitsSoFar(t), o = guy(t);
        // behind the doors: the dark inside, lit purple by what's pressing on them
        g.fillStyle = '#10061a'; g.fillRect(-DW, -DH, DW * 2, DH - 2);
        g.save(); g.beginPath(); g.rect(-DW, -DH, DW * 2, DH - 2); g.clip();
        g.globalCompositeOperation = 'lighter';
        glow(g, 0, -DH * 0.45, 95, '190,60,230', 0.55 * gl);
        g.globalCompositeOperation = 'source-over';
        if (t < BURST + 200) {                                 // shapes shoving against the glass
          for (let k = 0; k < 7; k++) {
            const sx = -DW * 0.8 + k * DW * 0.27 + Math.sin(t * 0.004 + k * 1.7) * 6, sy = -DH * 0.5 + Math.cos(t * 0.005 + k) * 8;
            g.fillStyle = `rgba(14,0,22,${0.25 + 0.15 * n})`;
            g.beginPath(); g.ellipse(sx, sy, 10 + (k % 3) * 3, 17 + (k % 2) * 6, 0, 0, TAU); g.fill();
          }
        } else {
          g.globalCompositeOperation = 'lighter'; glow(g, 0, -DH * 0.5, 110, '210,90,250', 0.7); g.globalCompositeOperation = 'source-over';
        }
        g.restore();
        // light spilling through the gap onto the lot
        if (t < BURST && gap > 1) {
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(0.5, gap * 0.04) * gl;
          g.fillStyle = 'rgb(190,60,230)'; g.fillRect(-gap / 2 - 1, -DH, gap + 2, DH - 2);
          glow(g, 0, 6, 55, '190,60,230', 0.35 * gl);
          g.restore();
        }
        if (t < BURST) {
          const bulge = gap * 0.55;
          leaf(g, -1, gap, bulge, n, t); leaf(g, 1, gap, bulge, n, t);
          HITS.forEach(([t0], i) => {                          // dust and sparks shaken off the frame at each hit
            spray(g, -DW * 0.7, -DH, t, t0, { n: 12, r: 46, seed: 30 + i, size: 2.6, dur: 800, color: 'rgba(190,190,195,0.75)', dir: Math.PI / 2, spread: 1.6, grav: 1.2 });
            spray(g, DW * 0.7, -DH, t, t0, { n: 12, r: 46, seed: 40 + i, size: 2.6, dur: 800, color: 'rgba(190,190,195,0.75)', dir: Math.PI / 2, spread: 1.6, grav: 1.2 });
            spray(g, 0, -DH * 0.5, t, t0, { n: 10, r: 38, seed: 50 + i, size: 1.8, dur: 380, color: '#ffd27a', streak: true });
          });
        }
        // after the burst: what's left of him
        if (t >= BURST + 150) {
          drawBloodPool(g, o.x + 4, o.y + 4, 4 + 40 * outQuad(seg(t, BURST + 200, BURST + 2400)), 5, 0.95);
          spray(g, o.x, o.y - 10, t, BURST + 150, { n: 36, r: 120, seed: 8, size: 3.2, dur: 800, streak: true });
        }
        g.save();
        g.globalAlpha = t >= BURST + 700 ? 1 - 0.55 * smooth(seg(t, BURST + 700, BURST + 1500)) : 1;
        drawHazmat(g, o);
        g.restore();
        // the swarm, out through the doorway and over him
        if (t >= BURST) {
          const M = window.MonsterModels;
          MEMBERS.forEach((m, i) => {
            const tau = t - m.ts;
            if (tau < 0) return;
            const y = -62 + tau * m.v, x = m.lane * 0.55 * (0.3 + Math.min(1, tau / 700)) + Math.sin(t * 0.009 * (0.6 + m.v) + m.ph) * 6;
            if (y > 230) return;
            const sz = 160 * m.s;
            g.save();
            g.globalAlpha = Math.min(1, tau / 120);
            g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x + 4, y + 6, sz * 0.3, sz * 0.14, 0, 0, TAU); g.fill();
            g.translate(x, y); g.rotate(Math.PI / 2 + Math.sin(t * 0.012 + m.ph) * 0.12);
            g.drawImage(M.sprite(m.id, t), -sz / 2, -sz / 2, sz, sz);
            g.restore();
          });
          // the doors, thrown out ahead of it
          const tt = t - BURST;
          [-1, 1].forEach((side) => {
            const a = 1 - seg(tt, 500, 1400);
            if (a <= 0) return;
            g.save(); g.globalAlpha = a;
            g.translate(side * DW * 0.5 + side * tt * 0.5, -DH * 0.5 + tt * 0.2);
            g.rotate(side * tt * 0.0017); g.scale(1 + tt * 0.0008, 1 + tt * 0.0008);
            g.translate(-side * DW * 0.5, DH * 0.5);
            leaf(g, side, 14, 8, 3, t);
            g.restore();
          });
          spray(g, 0, -DH * 0.5, t, BURST, { n: 48, r: 130, seed: 12, size: 3, dur: 800, color: 'rgba(200,225,240,0.85)', streak: true, dir: Math.PI / 2, spread: 2.8 });
          // a shock ring and a rolling cloud of dust
          const p = tt / 1100;
          if (p < 1) {
            g.strokeStyle = `rgba(230,200,255,${0.7 * (1 - p)})`; g.lineWidth = 5 * (1 - p) + 1;
            g.beginPath(); g.ellipse(0, -DH * 0.4, 30 + 330 * outCubic(p), 18 + 150 * outCubic(p), 0, 0, TAU); g.stroke();
          }
          for (let i = 0; i < 34; i++) {
            const ph = Math.min(1, tt / 2400), a = hash(i * 3.1) * TAU, d = (30 + hash(i + 2) * 170) * outCubic(ph);
            g.fillStyle = `rgba(150,146,152,${0.34 * (1 - ph)})`;
            g.beginPath(); g.arc(Math.cos(a) * d, -DH * 0.4 + Math.sin(a) * d * 0.7, 10 + 26 * ph + hash(i) * 14, 0, TAU); g.fill();
          }
        } else {
          g.save();
          drift(g, t, 40, { x: -330, y: -150, w: 660, h: 260 }, { color: '#fff', vy: 6, vx: 4, size: 1.2, alpha: 0.5, seed: 23, sway: 8 });
          g.restore();
        }
      },
    };
  })();
