  // ============ DESIGNER BOSSES: a boss from the editor kills a lone man ============
  // Configured per level with BossCutscene.setCustom({ name, color, effect, floor, monster }):
  //   effect 'magma'  -- it spits a glob of magma that lands on him; he burns
  //   effect 'slash'  -- it lunges and rakes him with a claw
  //   effect 'bite'   -- it lunges and snaps its jaws shut on him
  (function () {
    const KX = 150, KY = 0, U = 15, DUR = 8000;
    const GX = -112, GY = 14;
    const MUZZLE = { x: KX - 104, y: 0 };
    const cfg = { name: 'THE BOSS', color: '#ff6a2a', effect: 'magma', floor: 'basalt', monster: null, scale: 90 };
    const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };

    const FLOORS = {
      basalt: { base: '#17100f', a: '#2a1d1b', b: '#40302c', vein: ['rgba(255,70,10,0.25)', '#c4300a', '#ff9a30'] },
      stone:  { base: '#141318', a: '#26242b', b: '#3a3741', vein: null },
      frost:  { base: '#1a2330', a: '#34455a', b: '#52687f', vein: ['rgba(160,220,255,0.18)', '#8cc8ea', '#e4f6ff'] },
      flood:  { base: '#0d1619', a: '#1d3036', b: '#2e4b52', vein: ['rgba(80,200,190,0.15)', '#2f8f88', '#7de0d4'] },
      moss:   { base: '#0f150a', a: '#233018', b: '#3a4d25', vein: ['rgba(120,200,60,0.15)', '#4c8a2a', '#9be04a'] },
      roof:   { base: '#101014', a: '#25252e', b: '#3a3a46', vein: null },
    };
    function floorBuild(kind) {
      const F = FLOORS[kind] || FLOORS.basalt;
      return floorFor('custom-' + kind, (f) => {
        f.fillStyle = F.base; f.fillRect(-FW / 2, -FH / 2, FW, FH);
        for (let j = -8; j < 9; j++) for (let i = -12; i < 13; i++) {
          f.fillStyle = lerpHex(F.a, F.b, hash(i * 19 + j * 11));
          f.fillRect(i * 70 + (j % 2) * 35, j * 52, 68, 50);
        }
        if (!F.vein) return;
        for (let v = 0; v < 26; v++) {
          let x = (hash(v * 2.9) - 0.5) * FW, y = (hash(v * 4.3) - 0.5) * FH, a = hash(v * 6.1) * TAU;
          f.lineCap = 'round'; f.lineJoin = 'round';
          const pts = [[x, y]];
          for (let s = 0; s < 9; s++) { a += (hash(v * 9 + s) - 0.5) * 1.5; x += Math.cos(a) * 30; y += Math.sin(a) * 30; pts.push([x, y]); }
          [[F.vein[0], 11], [F.vein[1], 4.5], [F.vein[2], 2]].forEach(([c, w]) => {
            f.strokeStyle = c; f.lineWidth = w; f.beginPath(); pts.forEach(([px, py], i) => (i ? f.lineTo(px, py) : f.moveTo(px, py))); f.stroke();
          });
        }
      });
    }

    const lunge = () => cfg.effect === 'slash' || cfg.effect === 'bite';
    // where the boss body is (it lunges at the man for slash / bite)
    function bossX(t) {
      if (!lunge()) return KX;
      const out = outCubic(seg(t, 4000, 4400)), back = smooth(seg(t, 5000, 6200));
      return KX - 150 * out * (1 - back);
    }
    function guy(t) {
      const w = walk(t, 400, 2600, -400, 16, GX, GY);
      const o = { x: w.x, y: w.y, ang: 0, u: U, walk: w.walk, speed: w.speed, flashlight: t < 6500 };
      if (t > 2600) {
        o.speed = 0;
        o.ang = Math.sin((t - 2600) * 0.004) * 0.3 * (1 - seg(t, 3100, 3600));
      }
      if (t > 3300) o.armsUp = smooth(seg(t, 3300, 3800)) * 0.8;
      if (cfg.effect === 'magma') {
        if (t > 4800) {
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
      } else if (t > 4350) {
        const p = seg(t, 4350, 5300);
        o.x = GX - 70 * outCubic(p);
        o.y = GY + 8 * outCubic(p);
        o.ang = 0.9 * outCubic(p);
        o.armsUp = 0; o.flail = 0.8 * (1 - p);
        o.time = t; o.jitter = 0.25 * (1 - p);
        o.visorCrack = smooth(seg(t, 4400, 4700));
        if (t > 5000) o.lie = outQuad(seg(t, 5000, 5800));
      }
      return o;
    }
    function ball(t) {
      if (cfg.effect !== 'magma' || t < 4300 || t > 4800) return null;
      const o0 = seg(t, 4300, 4800), p = o0 * o0 * (3 - 2 * o0 * 0.4);
      const tgt = guy(4800);
      const arc = Math.sin(p * Math.PI) * -26;
      return { x: lerp(MUZZLE.x, tgt.x + 14, p), y: lerp(MUZZLE.y, tgt.y, p) + arc };
    }
    const hitT = () => (cfg.effect === 'magma' ? 4800 : 4400);

    SCENES.custom = {
      get name() { return cfg.name; },
      get color() { return cfg.color; },
      dur: DUR, dark: 0.86, shade: '6,3,4',
      set(c) { Object.assign(cfg, c); },
      shakes: [[3500, 4, 260], [4300, 7, 200], [4400, 6, 200], [4800, 7, 180], [5400, 3, 160]],
      sfx: [[2900, 'heart'], [3500, 'roar'], [4250, 'fire'], [4800, 'scream'], [5400, 'scream'], [6300, 'thud']],
      camera(t) {
        const a = smooth(seg(t, 0, 4200)), b = smooth(seg(t, 4800, 7000));
        return { x: lerp(-140, lerp(20, -5, b), a), y: lerp(8, 0, a), z: lerp(1.05, 1.28, a) + 0.1 * b };
      },
      lights(t) {
        const o = guy(t), L = [];
        const chg = seg(t, 3300, 4300);
        const bx = bossX(t);
        if (o.flashlight) torchLights(o.x, o.y, o.ang, t, U, 1 - 0.7 * (o.burn || 0)).forEach((l) => L.push(l));
        L.push({ x: bx, y: KY, r: 190 + 40 * chg, a: 0.42 + 0.35 * chg + 0.08 * Math.sin(t * 0.02) });
        const b = ball(t);
        if (b) L.push({ x: b.x, y: b.y, r: 190, a: 0.95 });
        if (cfg.effect === 'magma' && t > 4800) {
          const fl = smooth(seg(t, 4800, 5200)) * (1 - smooth(seg(t, 6800, 7700)));
          L.push({ x: o.x, y: o.y, r: 210, a: 0.9 * fl * (0.85 + 0.15 * Math.sin(t * 0.04)) });
        }
        return L;
      },
      world(g, t) {
        blitFloor(g, floorBuild(cfg.floor));
        const o = guy(t), bx = bossX(t);
        const rgb = rgbOf(cfg.color);
        g.save(); g.globalCompositeOperation = 'lighter';
        glow(g, bx, KY, 260, rgb, 0.2 + 0.1 * Math.sin(t * 0.01));
        g.restore();
        // the boss itself
        if (cfg.monster && window.CustomMonster) {
          const chg0 = seg(t, 3200, 4300);
          window.CustomMonster.draw(g, cfg.monster, {
            x: bx, y: KY, t: t / 1000, look: { x: -1, y: 0 }, scale: cfg.scale / (cfg.monster.size || 30),
            rage: t > 3200 ? 1 : 0, flash: 0.0 * chg0,
          });
        } else {
          g.fillStyle = '#833'; g.beginPath(); g.arc(bx, KY, 70, 0, TAU); g.fill();
        }

        if (cfg.effect === 'magma') {
          // a glob gathers in its mouth, then flies
          const chg = seg(t, 3300, 4300);
          if (chg > 0 && t < 4300) {
            g.save(); g.globalCompositeOperation = 'lighter';
            glow(g, MUZZLE.x, MUZZLE.y, 20 + 46 * chg, '255,130,30', 0.9 * chg);
            glow(g, MUZZLE.x, MUZZLE.y, 8 + 18 * chg, '255,240,170', chg);
            g.restore();
          }
          const b = ball(t);
          if (b) {
            for (let i = 0; i < 14; i++) {              // dripping trail
              const f = i / 14;
              g.fillStyle = `rgba(255,${100 + i * 8},20,${0.75 - i * 0.05})`;
              g.beginPath();
              g.arc(lerp(b.x, MUZZLE.x, f) + (hash(i + Math.floor(t * 0.02)) - 0.5) * 7, lerp(b.y, MUZZLE.y, f) + f * 8 + (hash(i * 3 + Math.floor(t * 0.02)) - 0.5) * 7, 9 - i * 0.5, 0, TAU);
              g.fill();
            }
            g.save(); g.globalCompositeOperation = 'lighter';
            glow(g, b.x, b.y, 62, '255,120,20', 0.9); glow(g, b.x, b.y, 26, '255,245,190', 1);
            g.restore();
            g.fillStyle = '#ff7a1a'; g.beginPath(); g.ellipse(b.x, b.y, 13, 10, 0, 0, TAU); g.fill();
            g.fillStyle = '#ffd25a'; g.beginPath(); g.ellipse(b.x - 2, b.y - 2, 7, 5, 0, 0, TAU); g.fill();
          }
          if (t > 4800) {
            // the splat: droplets thrown off, a glowing puddle that slowly crusts over
            spray(g, o.x + 14, o.y, t, 4800, { n: 26, r: 70, size: 4, color: '#ff8a22', dur: 650, seed: 9, grav: 0.5 });
            const pr = 22 * outCubic(seg(t, 4800, 5300));
            const cool = smooth(seg(t, 5400, 7600));
            g.save();
            g.fillStyle = lerpHex('#ff7a1a', '#3a1a10', cool);
            g.beginPath(); g.ellipse(o.x + 6, o.y + 8, pr * 1.3, pr, 0.3, 0, TAU); g.fill();
            g.globalCompositeOperation = 'lighter';
            glow(g, o.x + 6, o.y + 8, 50, '255,110,20', 0.5 * (1 - cool));
            g.restore();
          }
        } else if (t > hitT()) {
          // the strike itself
          const p = seg(t, hitT(), hitT() + 380);
          const tgt = guy(hitT());
          if (cfg.effect === 'slash') {
            g.save();
            g.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
              const off = (i - 1) * 9;
              g.strokeStyle = `rgba(255,240,230,${0.9 * (1 - p)})`; g.lineWidth = 3.2 - i * 0.5;
              g.beginPath();
              g.moveTo(tgt.x - 26 + off * 0.6, tgt.y - 24 + off);
              g.quadraticCurveTo(tgt.x + 4, tgt.y + off * 0.4, tgt.x + 30 - off * 0.6, tgt.y + 26 + off);
              g.stroke();
            }
            g.restore();
          } else {
            g.save();
            g.translate(tgt.x + 22, tgt.y);
            const jaw = 26 * (1 - outQuad(p)) + 2;
            g.fillStyle = '#e8e0cc';
            for (let k = -2; k <= 2; k++) {
              g.beginPath(); g.moveTo(k * 11 - 5, -jaw - 8); g.lineTo(k * 11, -jaw + 6); g.lineTo(k * 11 + 5, -jaw - 8); g.closePath(); g.fill();
              g.beginPath(); g.moveTo(k * 11 - 5, jaw + 8); g.lineTo(k * 11, jaw - 6); g.lineTo(k * 11 + 5, jaw + 8); g.closePath(); g.fill();
            }
            g.restore();
          }
          spray(g, tgt.x, tgt.y, t, hitT(), { n: 30, r: 85, size: 3.4, color: '#8a0f1a', dur: 700, seed: 3, streak: true });
          if (t > hitT() + 200) drawBloodPool(g, o.x, o.y + 6, 36 * outCubic(seg(t, hitT() + 200, hitT() + 2400)), 4, 0.95);
        }

        // the man, and what is done to him
        drawHazmat(g, o);
        if (cfg.effect === 'magma' && t > 4800) {
          const fl = smooth(seg(t, 4800, 5100)) * (1 - smooth(seg(t, 6800, 7700)));
          if (fl > 0.02) {
            for (let i = 0; i < 6; i++) {
              const ox = Math.cos(i * 1.7 + t * 0.003) * 9, oy = Math.sin(i * 2.3 + t * 0.004) * 11;
              flame(g, o.x + ox, o.y + oy + 6, 17 * fl, (38 + 14 * hash(i)) * fl, t, i * 1.3, false);
            }
            g.save(); g.globalCompositeOperation = 'lighter'; glow(g, o.x, o.y, 54, '255,130,30', 0.7 * fl); g.restore();
          }
          // magma clinging to the suit
          const cl = smooth(seg(t, 4800, 5000)) * (1 - 0.6 * smooth(seg(t, 5600, 7400)));
          g.fillStyle = `rgba(255,${120 - 60 * smooth(seg(t, 5000, 7000))},20,${0.85 * cl})`;
          for (let i = 0; i < 5; i++) {
            g.beginPath(); g.ellipse(o.x + (hash(i) - 0.5) * 18, o.y + (hash(i + 7) - 0.5) * 22, 4 + hash(i + 3) * 4, 3 + hash(i + 5) * 3, hash(i) * 3, 0, TAU); g.fill();
          }
          if (t > 5100) {
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
        }
        if (t > 6100 || (cfg.effect !== 'magma' && t > 5300)) droppedTorch(g, o.x + 28, o.y + 26, 0.6, t < 7400);
        g.save(); g.globalAlpha = 0.9;
        drift(g, t, 40, { x: -400, y: -170, w: 800, h: 340 }, { color: '#ffb060', vy: -18, vx: 4, size: 1.6, alpha: 0.7, seed: 31, sway: 10 });
        g.restore();
      },
    };
  })();
