    // ---- the lobby background: the real monsters (the Monsterpedia's own models)
    // stalking the real players (a chimp in a hazmat suit, orange and green) in a
    // dark room lit only by flashlights and lamps, like the game itself. Hovering
    // a level (or a holiday) lines up that level's monsters, named -- or, for a
    // level not beaten yet, a "?" in their place ----
    const MONSTER_NAMES = {
      0: 'The Crawler', 1: 'The Drifter', 2: 'The Caterpillar', 3: 'The Mimic', 4: 'The Crate Lurker', 5: 'The Ashen One',
      6: 'The Knight', 7: 'The Mine Dweller', 8: 'The Vault Guardian', 9: 'The Chain Wraith', 10: 'The Dig Worm',
      11: 'The Last Knight', 12: 'The Frost Tentacle', 13: 'The Mutation', 14: 'The Brood', 15: 'The Thaw Spider',
      16: 'The Frozen Mutation', 17: 'The Flood Eel', 18: 'The Bog', 19: 'The Current Eel', 20: 'The Drain Swarm',
      21: 'The Cistern', 22: 'The Grass Drifter', 23: 'The Kindling', 24: 'The Stalker', 25: 'The Sentry',
      26: 'The Cultivator', 27: 'The Reacher', 28: 'The Gargoyle', 29: 'The Warden', 30: 'The Grotesque',
      31: 'Garguantuagoyle', 32: 'The Pumpkin King', 33: 'The Hollow Jack', 34: 'The Hush', 35: 'The Rotten One',
      36: 'The Embergourd',
    };
    // MonsterModels ids of each story level's monsters (Level 31 is the Multipod: all of them at once)
    const LEVEL_MONSTERS = {
      1: [0], 2: [1], 3: [2], 4: [3, 4], 5: [5], 6: [6], 7: [7], 8: [8, 9], 9: [10], 10: [11], 11: [12], 12: [13], 13: [14],
      14: [15], 15: [16], 16: [17], 17: [18], 18: [19], 19: [20], 20: [21], 21: [22], 22: [23], 23: [24], 24: [25],
      25: [26], 26: [27], 27: [28], 28: [29], 29: [30], 30: [31], 31: [0, 5, 6, 11, 14, 16, 21, 26, 31],
    };
    const HALLOWEEN_LEVEL_MONSTERS = { 1: [33], 2: [34], 3: [35], 4: [36], 5: [32] };
    const HALLOWEEN_LEVEL_OF = { 33: 1, 34: 2, 35: 3, 36: 4, 32: 5 };
    const LOBBY = {
      story: { pool: [0, 1, 3, 6, 11, 16, 21, 26, 31].map((id, i) => ({ id, speed: 24 + (i % 4) * 4 })), lamps: 'cool' },
      holiday: { pool: [33, 34, 35, 36, 32].map((id, i) => ({ id, speed: [30, 34, 26, 30, 20][i], scale: [1.5, 1.4, 1.4, 1.5, 1.9][i] })), lamps: 'pumpkin' },
    };
    const scenes = {};
    let lobbyShow = 0, hoverLine = null, lineup = [];
    // what hovering an element lines up: [{ id, hidden }], hidden when that level isn't beaten yet
    function bindHover(selector, lineFor) {
      document.querySelectorAll(selector).forEach((el) => {
        const on = () => { hoverLine = lineFor(el); if (hoverLine) lineup = hoverLine; };
        const off = () => { hoverLine = null; };
        el.addEventListener('mouseenter', on); el.addEventListener('mouseleave', off);
        el.addEventListener('focus', on); el.addEventListener('blur', off);
      });
    }
    bindHover('.menu-item[data-level]', (el) => {
      const n = parseInt(el.dataset.level, 10), beaten = !!(window.GoofyStory && window.GoofyStory.isCompleted(n));
      return LEVEL_MONSTERS[n].map((id) => ({ id, hidden: !beaten }));
    });
    bindHover('.menu-item[data-halloween]', (el) => {
      const n = parseInt(el.dataset.halloween, 10), beaten = !!(window.GoofyStory && window.GoofyStory.isHalloweenCompleted(n));
      return HALLOWEEN_LEVEL_MONSTERS[n].map((id) => ({ id, hidden: !beaten }));
    });
    bindHover('.holiday-card', () => [33, 34, 35, 36, 32].map((id) => ({
      id, hidden: !(window.GoofyStory && window.GoofyStory.isHalloweenCompleted(HALLOWEEN_LEVEL_OF[id])),
    })));

    function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
    function buildLobbyFloor(mode, W, H) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      const T = 60;
      if (mode === 'holiday') {
        g.fillStyle = '#243a37'; g.fillRect(0, 0, W, H);
        for (let y = 0; y * T < H; y++) for (let x = 0; x * T < W; x++) {
          const h = hash(x * 31 + y * 7);
          g.fillStyle = `rgb(${Math.round(48 + 26 * h)},${Math.round(78 + 36 * h)},${Math.round(74 + 34 * h)})`;
          g.fillRect(x * T, y * T, T - 2, T - 2);
        }
        for (let v = 0; v < 22; v++) {      // vines creeping across the floor
          let px = hash(v * 3.3) * W, py = hash(v * 5.1) * H, a = hash(v * 7.7) * 6.28;
          g.lineCap = 'round';
          for (let s = 0; s < 10; s++) {
            const nx = px + Math.cos(a) * 36, ny = py + Math.sin(a) * 36;
            g.strokeStyle = '#143010'; g.lineWidth = 8; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
            g.strokeStyle = '#3a8a22'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
            if (s % 2) { g.fillStyle = '#5db33a'; g.beginPath(); g.ellipse(nx + 4, ny - 3, 8, 4, a, 0, 6.28); g.fill(); }
            px = nx; py = ny; a += (hash(v * 11 + s) - 0.5) * 1.2;
          }
        }
      } else {
        // the facility: grey concrete plates, hazard-yellow floor markings, a few vents
        g.fillStyle = '#1b2128'; g.fillRect(0, 0, W, H);
        for (let y = 0; y * T < H; y++) for (let x = 0; x * T < W; x++) {
          const h = hash(x * 17 + y * 13);
          g.fillStyle = `rgb(${Math.round(52 + 22 * h)},${Math.round(62 + 24 * h)},${Math.round(72 + 26 * h)})`;
          g.fillRect(x * T, y * T, T - 2, T - 2);
          if (hash(x * 5 + y * 29) > 0.9) {
            g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x * T + 12, y * T + 12, T - 26, T - 26);
            g.fillStyle = 'rgba(255,255,255,0.1)';
            for (let s = 0; s < 4; s++) g.fillRect(x * T + 14, y * T + 16 + s * 8, T - 30, 2);
          }
        }
        g.fillStyle = '#c9a41a';
        for (let r = 0; r < 4; r++) {
          const ry = Math.floor((0.12 + 0.25 * r) * H / T) * T + T / 2 - 2;
          for (let x = 0; x < W; x += 44) g.fillRect(x, ry, 24, 4);
        }
      }
      return c;
    }
    function initLobby(mode) {
      const W = canvas.width, H = canvas.height, def = LOBBY[mode], M = window.MonsterModels;
      const rnd = (a, b) => a + Math.random() * (b - a);
      return {
        W, H,
        mons: def.pool.map((m) => Object.assign({}, m, {
          scale: m.scale || Math.max(0.8, Math.min(2, 75 / M.extent(m.id))),
          x: rnd(0.1, 0.9) * W, y: rnd(0.15, 0.85) * H, a: rnd(0, 6.28), turnAt: 0,
        })),
        players: [PlayerModel.ORANGE, PlayerModel.GREEN].map((color, i) => ({ color, x: W * (0.3 + 0.4 * i), y: H * 0.6, a: rnd(0, 6.28), phase: 0, turnAt: 0 })),
        lamps: Array.from({ length: 9 }, (_, i) => ({ x: hash(i * 9.1) * W, y: hash(i * 4.7 + 2) * H, seed: i * 3 })),
        floor: buildLobbyFloor(mode, W, H),
        dark: null,
      };
    }
    function stepToward(o, tx, ty, speed, dt, turn) {
      const want = Math.atan2(ty - o.y, tx - o.x);
      let d = want - o.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      o.a += Math.max(-turn * dt, Math.min(turn * dt, d));
      o.x += Math.cos(o.a) * speed * dt; o.y += Math.sin(o.a) * speed * dt;
    }
    function drawLobby(mode, now, dt) {
      const W = canvas.width, H = canvas.height, def = LOBBY[mode];
      let hol = scenes[mode];
      if (!hol || hol.W !== W || hol.H !== H) hol = scenes[mode] = initLobby(mode);
      // players run around, steering away from whatever gets close
      hol.players.forEach((p) => {
        if (now > p.turnAt) { p.wx = Math.random() * W; p.wy = Math.random() * H; p.turnAt = now + 2500 + Math.random() * 3000; }
        let tx = p.wx, ty = p.wy;
        hol.mons.forEach((m) => {
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d < 260) { tx += (p.x - m.x) * (260 - d) / 40; ty += (p.y - m.y) * (260 - d) / 40; }
        });
        stepToward(p, tx, ty, 78, dt, 3.2);
        p.x = Math.max(30, Math.min(W - 30, p.x)); p.y = Math.max(30, Math.min(H - 30, p.y));
        p.phase += 78 * dt * 0.11;
      });
      // monsters amble about and creep after the nearest player
      hol.mons.forEach((m) => {
        let near = null, nd = 1e9;
        hol.players.forEach((p) => { const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < nd) { nd = d; near = p; } });
        if (nd < 500) stepToward(m, near.x, near.y, m.speed, dt, 1.4);
        else {
          if (now > m.turnAt) { m.wa = Math.random() * 6.28; m.turnAt = now + 1500 + Math.random() * 2500; }
          stepToward(m, m.x + Math.cos(m.wa || 0) * 100, m.y + Math.sin(m.wa || 0) * 100, m.speed * 0.7, dt, 1);
        }
        m.x = Math.max(40, Math.min(W - 40, m.x)); m.y = Math.max(40, Math.min(H - 40, m.y));
      });
      // hovering a level lines up its monsters along the lower part of the screen
      lobbyShow += ((hoverLine ? 1 : 0) - lobbyShow) * Math.min(1, dt * 4);
      const show = lobbyShow < 0.003 ? 0 : lobbyShow * lobbyShow * (3 - 2 * lobbyShow);
      const M = window.MonsterModels, n = lineup.length;
      const slots = lineup.map((e, k) => {
        const spacing = n > 1 ? 0.76 * W / (n - 1) : 0;
        const r = Math.max(34, Math.min(n === 1 ? 120 : 100, spacing * 0.46));
        return { id: e.id, hidden: e.hidden, x: n === 1 ? W / 2 : W * 0.12 + 0.76 * W * (k / (n - 1)), y: H * 0.74, k: r / Math.max(30, M.extent(e.id)), r };
      });

      ctx.drawImage(hol.floor, 0, 0);
      hol.lamps.forEach((l) => {
        const fl = 0.8 + 0.2 * Math.sin(now * 0.017 + l.seed);
        if (def.lamps === 'cool') {
          const gr = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 130);
          gr.addColorStop(0, `rgba(190,225,255,${0.3 * fl})`); gr.addColorStop(1, 'rgba(150,200,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(l.x, l.y, 130, 0, 6.28); ctx.fill();
          ctx.fillStyle = '#2a3038'; ctx.beginPath(); ctx.arc(l.x, l.y, 11, 0, 6.28); ctx.fill();
          ctx.fillStyle = `rgba(225,242,255,${fl})`; ctx.beginPath(); ctx.arc(l.x, l.y, 6, 0, 6.28); ctx.fill();
          return;
        }
        const gr = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 120);
        gr.addColorStop(0, `rgba(255,170,50,${0.38 * fl})`); gr.addColorStop(1, 'rgba(255,140,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(l.x, l.y, 120, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#c4580c'; ctx.beginPath(); ctx.ellipse(l.x, l.y, 16, 13, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = `rgba(255,232,120,${fl})`;
        ctx.beginPath(); ctx.moveTo(l.x - 9, l.y - 2); ctx.lineTo(l.x - 3, l.y - 2); ctx.lineTo(l.x - 6, l.y - 8); ctx.closePath();
        ctx.moveTo(l.x + 9, l.y - 2); ctx.lineTo(l.x + 3, l.y - 2); ctx.lineTo(l.x + 6, l.y - 8); ctx.closePath();
        ctx.moveTo(l.x - 8, l.y + 4); ctx.lineTo(l.x, l.y + 8); ctx.lineTo(l.x + 8, l.y + 4); ctx.lineTo(l.x, l.y + 2); ctx.closePath(); ctx.fill();
      });
      const shadowed = (id, x, y, k) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 14, 26, 10, 0, 0, 6.28); ctx.fill();
        M.draw(id, ctx, now);
        ctx.restore();
      };
      ctx.save(); ctx.globalAlpha = 1 - 0.7 * show;
      hol.mons.forEach((m) => shadowed(m.id, m.x, m.y, m.scale));
      hol.players.forEach((p) => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(2.6, 2.6); ctx.translate(-p.x, -p.y);
        PlayerModel.draw(ctx, 10, { x: p.x, y: p.y, color: p.color, facing: { x: Math.cos(p.a), y: Math.sin(p.a) }, walkPhase: p.phase });
        ctx.restore();
      });
      ctx.restore();
      if (show > 0.02) {
        ctx.save(); ctx.globalAlpha = show;
        slots.forEach((s) => {
          if (!s.hidden) { shadowed(s.id, s.x, s.y, s.k); return; }
          // not beaten yet: a blank, featureless blob with a question mark on it
          const q = s.r * 0.78;
          const gr = ctx.createRadialGradient(s.x - q * 0.3, s.y - q * 0.3, 2, s.x, s.y, q);
          gr.addColorStop(0, '#4a4f5a'); gr.addColorStop(1, '#1c1f26');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, q, 0, 6.28); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = `700 ${Math.round(q * 1.3)}px "Courier New", monospace`;
          ctx.fillStyle = '#d8dce6'; ctx.fillText('?', s.x, s.y + q * 0.06);
          ctx.textBaseline = 'alphabetic';
        });
        ctx.restore();
      }
      // darkness like the real game: the whole screen is near-black, lit only by the
      // players' flashlights, the lamps and a faint glow round each monster
      if (!hol.dark) { hol.dark = document.createElement('canvas'); hol.dark.width = W; hol.dark.height = H; }
      const d = hol.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H);
      d.fillStyle = 'rgba(3,2,7,0.93)'; d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out';
      const light = (x, y, r, a) => {
        const gr = d.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, 6.28); d.fill();
      };
      hol.players.forEach((p) => {
        light(p.x, p.y, 90, 0.75);
        const gr = d.createRadialGradient(p.x, p.y, 10, p.x, p.y, 300);
        gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = gr; d.beginPath(); d.moveTo(p.x, p.y); d.arc(p.x, p.y, 300, p.a - 0.38, p.a + 0.38); d.closePath(); d.fill();
      });
      hol.lamps.forEach((l) => light(l.x, l.y, 120 * (0.9 + 0.1 * Math.sin(now * 0.017 + l.seed)), 0.7));
      hol.mons.forEach((m) => light(m.x, m.y, 70, 0.28 * (1 - show)));
      if (show > 0.02) slots.forEach((s) => light(s.x, s.y, (s.r + 70) * (0.5 + 0.5 * show), 0.85 * show));
      ctx.drawImage(hol.dark, 0, 0);
      if (show > 0.02) {
        ctx.textAlign = 'center'; ctx.font = '700 17px "Courier New", monospace';
        slots.forEach((s) => {
          const name = s.hidden ? '???' : (MONSTER_NAMES[s.id] || '');
          ctx.globalAlpha = show;
          ctx.fillStyle = '#000'; ctx.fillText(name, s.x + 1, s.y + s.r + 22 + 1);
          ctx.fillStyle = mode === 'holiday' ? '#ffae4a' : '#bfe0ff'; ctx.fillText(name, s.x, s.y + s.r + 22);
        });
        ctx.globalAlpha = 1;
      }
    }

