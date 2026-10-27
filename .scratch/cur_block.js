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
    // one line on how each monster hunts, shown under its name when you hover its level
    const MONSTER_DESC = {
      0: 'Blind until your flashlight lands on its eye, then it locks on and charges.',
      1: 'Hunts by sound alone. Stand still and it has no idea you are there.',
      2: 'Slow and nearly harmless itself. The meat vines around it are the real threat.',
      3: 'Disguises itself as a hazmat-suited teammate until you get close.',
      4: 'A trap: a few item crates are secretly occupied. Only a faint jitter gives it away.',
      5: 'A giant, burning Crawler. It cannot see you until your flashlight finds its eye.',
      6: 'A Crawler in plate armor with a sword, patrolling the stone halls on foot.',
      7: 'Stone-winged and full of teeth, with tentacles 2.5x as thick as normal.',
      8: 'An armored Crawler four times the size, and it spots you from twice as far.',
      9: 'Black or white, swinging a chained ball around itself as it hunts.',
      10: 'A giant armored Caterpillar: twice as thick, five times as long, full of teeth.',
      11: 'A giant ruby knight. Charges, red-hot slashes: four attacks on a loop.',
      12: 'Pale blue and spiked with icicles. A CO2 blast barely slows it.',
      13: 'Three heads on one body. It only notices you when you move.',
      14: 'Five tiny Crawlers, each as blind as the original until your flashlight finds it.',
      15: 'Icicle-legged spiders that are always hunting, at twice your speed.',
      16: 'The Mutation grown to twice its size, ice-crusted, splitting into hunting copies.',
      17: 'A long teal eel that patrols the flooded halls, then rushes you on sight.',
      18: 'The biggest eel, draped in seaweed. Only the drifting weeds give it away.',
      19: 'A pale, bumpy cousin of the Flood Eel, patrolling the Great Wheel.',
      20: 'Ten small coral-grown eels that never stop hunting you.',
      21: 'A monstrous teal eel overgrown with weed and coral. Three attacks.',
      22: 'Ten grassy Drifters, each hunting by sound alone.',
      23: 'A stick-studded Crawler that closes in steadily the instant it sees you.',
      24: 'A gaunt shadow with one eye that flares red and chases at 2.5x your speed.',
      25: 'A tentacled machine-creature with one red lens, closing in once it sees you.',
      26: 'A round, grass-grown robot with a giant mushroom. Only furnace coal hurts it.',
      27: 'A violet blob ringed with waving tentacles, patrolling the rooftops.',
      28: 'A winged grey cousin of the Reacher, airborne, its shadow trailing behind.',
      29: 'Four-winged fliers that only hunt while you are caught out on a ledge.',
      30: 'The runt of the family: tiny and dark, with comically oversized wings.',
      31: 'The winged family grown to 2.5x its size, with one giant eye. 100 HP.',
      32: 'A huge pumpkin with fire in its mouth, held up on a nest of vines.',
      33: 'Tentacles in a hollowed-out pumpkin. Slow, with the sharpest eyes in the facility.',
      34: 'A ghost, nearly invisible while it roams and solid the moment it spots you.',
      35: 'A rotting jack-o-lantern dragging itself through the ductwork.',
      36: 'A hulking yellow pumpkin with a smouldering face, crawling on vine-tentacles.',
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
        const on = () => {
          hoverLine = lineFor(el); if (hoverLine) lineup = hoverLine;
          const r = el.getBoundingClientRect();
          lineBottom = r.top + r.height / 2 < window.innerHeight / 2;
        };
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
    // The lineup is drawn on its own canvas above the page, on whichever half of the
    // screen the hovered card is NOT in, so the cards never cover it.
    const fg = document.createElement('canvas');
    fg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:30;pointer-events:none';
    document.body.appendChild(fg);
    const fctx = fg.getContext('2d');
    let lineBottom = true;
    function drawLineup(mode, now, show, slots, n) {
      const W = canvas.width, H = canvas.height, M = window.MonsterModels;
      if (fg.width !== W || fg.height !== H) { fg.width = W; fg.height = H; }
      fctx.clearRect(0, 0, W, H);
      if (show < 0.02) return;
      const g = fctx, crowded = n > 5, bandH = crowded ? 250 : 300;
      const spacing = n > 1 ? 0.76 * W / (n - 1) : 300;
      const maxW = Math.max(110, Math.min(300, spacing * 0.92));
      const by = lineBottom ? H - bandH / 2 - 8 : bandH / 2 + 8;
      // a dark band with soft top and bottom edges
      const gr = g.createLinearGradient(0, by - bandH / 2, 0, by + bandH / 2);
      gr.addColorStop(0, 'rgba(4,3,9,0)'); gr.addColorStop(0.18, `rgba(4,3,9,${0.9 * show})`);
      gr.addColorStop(0.82, `rgba(4,3,9,${0.9 * show})`); gr.addColorStop(1, 'rgba(4,3,9,0)');
      g.fillStyle = gr; g.fillRect(0, by - bandH / 2, W, bandH);
      const wrap = (text) => {
        const lines = []; let cur = '';
        text.split(' ').forEach((w) => {
          if (cur && g.measureText(cur + ' ' + w).width > maxW) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
        });
        if (cur) lines.push(cur);
        return lines;
      };
      const put = (str, x, y, col) => { g.fillStyle = '#000'; g.fillText(str, x + 1, y + 1); g.fillStyle = col; g.fillText(str, x, y); };
      g.globalAlpha = show;
      slots.forEach((s) => {
        const cy = by - bandH / 2 + 22 + s.r + 14;
        const halo = g.createRadialGradient(s.x, cy, 0, s.x, cy, s.r * 1.7);
        halo.addColorStop(0, mode === 'holiday' ? 'rgba(255,150,40,0.22)' : 'rgba(150,200,255,0.2)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = halo; g.beginPath(); g.arc(s.x, cy, s.r * 1.7, 0, 6.28); g.fill();
        if (!s.hidden) {
          g.save(); g.translate(s.x, cy); g.scale(s.k, s.k); M.draw(s.id, g, now); g.restore();
        } else {
          // not beaten yet: a blank, featureless blob with a question mark on it
          const q = s.r * 0.78;
          const bg = g.createRadialGradient(s.x - q * 0.3, cy - q * 0.3, 2, s.x, cy, q);
          bg.addColorStop(0, '#4a4f5a'); bg.addColorStop(1, '#1c1f26');
          g.fillStyle = bg; g.beginPath(); g.arc(s.x, cy, q, 0, 6.28); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.stroke();
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `700 ${Math.round(q * 1.3)}px "Courier New", monospace`;
          g.fillStyle = '#d8dce6'; g.fillText('?', s.x, cy + q * 0.06);
          g.textBaseline = 'alphabetic';
        }
        g.textAlign = 'center';
        let y = cy + s.r + 20;
        g.font = `700 ${crowded ? 12 : 17}px "Courier New", monospace`;
        wrap(s.hidden ? '???' : (MONSTER_NAMES[s.id] || '')).forEach((ln) => { put(ln, s.x, y, mode === 'holiday' ? '#ffae4a' : '#bfe0ff'); y += crowded ? 14 : 20; });
        if (!crowded) {
          g.font = '13px "Courier New", monospace';
          y += 2;
          wrap(s.hidden ? 'Beat this level to find out what lurks here.' : (MONSTER_DESC[s.id] || '')).forEach((ln) => { put(ln, s.x, y, '#c4c8d4'); y += 16; });
        }
      });
      g.globalAlpha = 1;
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
        const r = Math.max(34, Math.min(n === 1 ? 84 : 72, spacing * 0.46));
        return { id: e.id, hidden: e.hidden, x: n === 1 ? W / 2 : W * 0.12 + 0.76 * W * (k / (n - 1)), k: r / Math.max(30, M.extent(e.id)), r };
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
      ctx.save();
      hol.mons.forEach((m) => shadowed(m.id, m.x, m.y, m.scale));
      hol.players.forEach((p) => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(2.6, 2.6); ctx.translate(-p.x, -p.y);
        PlayerModel.draw(ctx, 10, { x: p.x, y: p.y, color: p.color, facing: { x: Math.cos(p.a), y: Math.sin(p.a) }, walkPhase: p.phase });
        ctx.restore();
      });
      ctx.restore();
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
      hol.mons.forEach((m) => light(m.x, m.y, 70, 0.28));
      ctx.drawImage(hol.dark, 0, 0);
      drawLineup(mode, now, show, slots, n);
    }

