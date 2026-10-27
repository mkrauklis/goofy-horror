  // ============ THE CULTIVATOR: overgrown, a garden grows from him ============
  (function () {
    const KX = 190, KS = 2.5, U = 15, DUR = 8500;
    const GX = -95, GY = 10;
    // the robot vents spores from 3300; they reach him at 3900; he coughs and
    // staggers, drops at 5200, and mushrooms sprout through the suit until 7200
    function guy(t) {
      const w = walk(t, 400, 2500, -400, 12, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 5900, time: t };
      if (t > 2500) { o.speed = 0; o.ang = Math.sin((t - 2500) * 0.004) * 0.3 * (1 - seg(t, 3000, 3500)); }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3700)) * 0.75;
      if (t > 3900) {                                  // coughing, swaying, staggering
        const p = seg(t, 3900, 5200);
        o.armsUp = 0;
        o.x = GX - 12 * Math.sin(p * 3) * (1 - p) + 6 * p;
        o.ang = Math.sin(t * 0.009) * 0.5 * (1 - p * 0.6);
        o.jitter = 0.14 * (1 - p); o.flail = 0.35 * (1 - seg(t, 4800, 5300));
        o.fog = smooth(seg(t, 3900, 4800));
        o.moss = smooth(seg(t, 4100, 7000));
        o.speed = 0.2 * (1 - p);
      }
      if (t > 5100) o.lie = outQuad(seg(t, 5100, 5900));
      return o;
    }
    function mushroom(g, x, y, s, t, seed, hue) {
      if (s <= 0.02) return;
      const sway = Math.sin(t * 0.0021 + seed) * 1.2 * s;
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 3, 9, 4, 0, 0, TAU); g.fill();
      const stem = g.createLinearGradient(-3, 0, 3, 0); stem.addColorStop(0, '#cfc4a8'); stem.addColorStop(1, '#fff1d4');
      g.fillStyle = stem; rr(g, -2.6 + sway * 0.2, -13, 5.2, 14, 2); g.fill();
      const cap = g.createRadialGradient(sway - 3, -17, 1, sway, -13, 13);
      cap.addColorStop(0, hue === 0 ? '#f08aa6' : '#8ae6d2'); cap.addColorStop(1, hue === 0 ? '#9c2d52' : '#27806f');
      g.fillStyle = cap; g.beginPath(); g.ellipse(sway, -13, 12, 8, 0, Math.PI, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      [[-5, -16, 1.8], [2, -18, 2.2], [6, -14, 1.5]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(sway + dx, dy, r, 0, TAU); g.fill(); });
      g.restore();
    }
    // where the garden grows: spots over and around his body, in order of appearance
    const SPOTS = [[0, 0, 0], [-14, 8, 1], [12, -7, 0], [-7, -13, 1], [20, 9, 0], [-24, -2, 0], [6, 15, 1], [26, -12, 1], [-18, 15, 0], [14, 20, 0], [-30, 12, 1], [32, 2, 0]];
    SCENES.cultivator = {
      name: 'THE CULTIVATOR', color: '#9ae04a', dur: DUR, dark: 0.7, shade: '3,8,3',
      shakes: [[3300, 3, 240], [4100, 2, 160], [5100, 5, 160], [6900, 2, 200]],
      sfx: [[2900, 'heart'], [3300, 'creak'], [3500, 'whoosh'], [4300, 'scream'], [5100, 'thud'], [5900, 'squelch'], [6500, 'squelch'], [7000, 'squelch']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 5000, 7200));
        return { x: lerp(-140, lerp(30, -30, b), a), y: lerp(6, 0, a), z: lerp(1.1, 1.42, a) + 0.22 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.7 * seg(t, 5000, 5900)).forEach((l) => L.push(l));
        L.push({ x: o.x, y: o.y, r: 95, a: 0.5 });
        L.push({ x: KX, y: 0, r: 250, a: 0.42 + 0.2 * Math.sin(t * 0.006) });
        for (let i = 0; i < 6; i++) L.push({ x: -330 + i * 140, y: i % 2 ? 110 : -110, r: 120, a: 0.3 });
        const g2 = seg(t, 5300, 7000);
        if (g2 > 0) L.push({ x: o.x, y: o.y, r: 140, a: 0.45 * g2 });
        return L;
      },
      world(g, t) {
        blitFloor(g, floorFor('greenhouse', (f) => {
          f.fillStyle = '#1a2a17'; f.fillRect(-FW / 2, -FH / 2, FW, FH);
          for (let j = -7; j < 8; j++) for (let i = -11; i < 12; i++) {
            f.fillStyle = lerpHex('#2c4325', '#475f35', hash(i * 11 + j * 17));
            f.fillRect(i * 64, j * 64, 62, 62);
            f.fillStyle = 'rgba(20,35,15,0.35)'; f.fillRect(i * 64 + 8, j * 64 + 8, 3, 3);
          }
          f.fillStyle = '#4a3322';                       // raised planting beds along the walls
          f.fillRect(-FW / 2, -FH / 2, FW, 86); f.fillRect(-FW / 2, FH / 2 - 86, FW, 86);
          for (let i = -22; i < 23; i++) {
            f.fillStyle = hash(i * 3) > 0.5 ? '#3c8a2a' : '#2f6e22';
            f.beginPath(); f.arc(i * 32 + 8, -FH / 2 + 44, 12 + hash(i) * 10, 0, TAU); f.fill();
            f.beginPath(); f.arc(i * 32 + 18, FH / 2 - 44, 12 + hash(i + 5) * 10, 0, TAU); f.fill();
          }
        }));
        const o = guy(t);
        // spores: a cloud rolling from the robot across the floor to him
        const vent = seg(t, 3300, 4200);
        if (vent > 0) {
          g.save();
          const alive = 1 - 0.7 * seg(t, 6200, 8000);
          const n = 130;
          for (let i = 0; i < n; i++) {
            const sd = i * 9.3;
            const ph = (t * 0.0005 * (0.5 + hash(sd)) + hash(sd + 1)) % 1;
            const toward = Math.min(1, smooth(vent) * 1.1);
            const sx = KX - 60, ex = o.x + 20;
            const f = ph * toward;
            const px = lerp(sx, ex, f) + (hash(sd + 2) - 0.5) * (30 + 90 * f), py = lerp(0, o.y, f) + (hash(sd + 3) - 0.5) * (30 + 70 * f);
            g.globalAlpha = 0.7 * alive * Math.sin(Math.PI * ph);
            g.fillStyle = hash(sd + 4) > 0.5 ? '#c8f06a' : '#8ae84a';
            g.beginPath(); g.arc(px, py, 1.2 + hash(sd + 5) * 2.6, 0, TAU); g.fill();
          }
          g.restore();
        }
        model(g, 26, KX, 0, KS, 0, t);
        // mushroom caps bursting up from the robot's hull with each puff
        // his body is overgrown: moss tint comes from drawHazmat; vines and the garden are drawn here
        const grow = seg(t, 5300, 7300);
        if (grow > 0) {
          g.save(); g.translate(o.x, o.y);
          for (let i = 0; i < 7; i++) {                  // vines creeping out over the floor
            const a = i * 0.9 + 0.3, len = (30 + hash(i) * 40) * smooth(grow);
            const pts = [];
            for (let s = 0; s <= 8; s++) { const f = s / 8 * len; pts.push([Math.cos(a + Math.sin(s * 0.9 + i) * 0.3) * f, Math.sin(a + Math.sin(s * 0.9 + i) * 0.3) * f * 0.8]); }
            drawVine(g, pts, 3.6, 1.2, '#173a12', '#4a9a2c', null);
          }
          g.restore();
        }
        drawHazmat(g, o);
        if (grow > 0) {
          SPOTS.forEach(([dx, dy, hue], i) => {
            const st = 0.08 * i + 0.0, s = smooth(seg(grow, st, st + 0.35)) * (0.7 + 0.5 * hash(i + 3));
            mushroom(g, o.x + dx, o.y + dy, s, t, i, hue);
          });
          // the glow of the spore garden
          g.save(); g.globalCompositeOperation = 'lighter';
          glow(g, o.x, o.y, 70, '140,255,200', 0.22 * grow * (0.8 + 0.2 * Math.sin(t * 0.004)));
          g.restore();
          if (t > 7000) {                                // a last twitch of the hand
            const tw = Math.max(0, Math.sin((t - 7000) * 0.02)) * (1 - seg(t, 7000, 7600));
            g.strokeStyle = '#2a2d31'; g.lineWidth = 3; g.lineCap = 'round';
            g.beginPath(); g.moveTo(o.x + 20, o.y + 24); g.lineTo(o.x + 28 + tw * 5, o.y + 30 - tw * 4); g.stroke();
          }
        }
        if (t > 5900) droppedTorch(g, o.x + 40, o.y + 40, 0.5, t < 6500 && (t % 230) > 60);
        g.save();
        drift(g, t, 60, { x: -420, y: -190, w: 840, h: 380 }, { colors: ['#c8f06a', '#8ae84a', '#eaff9a'], vy: -8, vx: -6, size: 1.7, alpha: 0.75, seed: 71, sway: 14 });
        g.restore();
      },
    };
  })();

