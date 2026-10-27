P = 'C:/claude_p/goofy-horror/index.html'
t = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')


def rep(a, b):
    global t
    assert t.count(a) == 1, (a[:60], t.count(a))
    t = t.replace(a, b)


rep('<script src="js/story.js"></script>\n<script>\n  // Best times',
    '<script src="js/story.js"></script>\n<script src="js/playermodel.js"></script>\n<script src="js/monsterpedia.js"></script>\n<script>\n  // Best times')
rep("    document.querySelectorAll('[data-view]').forEach((el) => { el.hidden = el.dataset.view !== name; });",
    "    document.querySelectorAll('[data-view]').forEach((el) => { el.hidden = el.dataset.view !== name; });\n    window.__lobbyMode = name === 'story' ? 'story' : 'holiday';")

HOLIDAY = r"""    // ---- the Holidays background: the real Halloween monsters (the Monsterpedia's
    // own models) stalking the real players (a chimp in a hazmat suit, orange and
    // green), over the ward's mottled floor with glowing jack-o-lanterns ----
    const HOLIDAY_MONSTERS = [   // MonsterModels ids: Hollow Jack, Hush, Rotten One, Embergourd, Pumpkin King
      { id: 33, scale: 1.5, speed: 30 }, { id: 34, scale: 1.4, speed: 34 }, { id: 35, scale: 1.4, speed: 26 },
      { id: 36, scale: 1.5, speed: 30 }, { id: 32, scale: 1.9, speed: 20 },
    ];
    let holiday = null, holidayFloor = null;
    function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
    function buildHolidayFloor() {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      const g = c.getContext('2d');
      g.fillStyle = '#243a37'; g.fillRect(0, 0, c.width, c.height);
      const T = 60;
      for (let y = 0; y * T < c.height; y++) for (let x = 0; x * T < c.width; x++) {
        const h = hash(x * 31 + y * 7);
        g.fillStyle = `rgb(${Math.round(48 + 26 * h)},${Math.round(78 + 36 * h)},${Math.round(74 + 34 * h)})`;
        g.fillRect(x * T, y * T, T - 2, T - 2);
      }
      for (let v = 0; v < 22; v++) {      // vines creeping across the floor
        let px = hash(v * 3.3) * c.width, py = hash(v * 5.1) * c.height, a = hash(v * 7.7) * 6.28;
        g.lineCap = 'round';
        for (let s = 0; s < 10; s++) {
          const nx = px + Math.cos(a) * 36, ny = py + Math.sin(a) * 36;
          g.strokeStyle = '#143010'; g.lineWidth = 8; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
          g.strokeStyle = '#3a8a22'; g.lineWidth = 4; g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
          if (s % 2) { g.fillStyle = '#5db33a'; g.beginPath(); g.ellipse(nx + 4, ny - 3, 8, 4, a, 0, 6.28); g.fill(); }
          px = nx; py = ny; a += (hash(v * 11 + s) - 0.5) * 1.2;
        }
      }
      holidayFloor = c;
    }
    function initHoliday() {
      const W = canvas.width, H = canvas.height;
      const rnd = (a, b) => a + Math.random() * (b - a);
      holiday = {
        mons: HOLIDAY_MONSTERS.map((m, i) => Object.assign({}, m, { x: rnd(0.1, 0.9) * W, y: rnd(0.15, 0.85) * H, a: rnd(0, 6.28), turnAt: 0, seed: i * 17 })),
        players: [PlayerModel.ORANGE, PlayerModel.GREEN].map((color, i) => ({ color, x: W * (0.3 + 0.4 * i), y: H * 0.6, a: rnd(0, 6.28), phase: 0, turnAt: 0 })),
        lanterns: Array.from({ length: 9 }, (_, i) => ({ x: hash(i * 9.1) * W, y: hash(i * 4.7 + 2) * H, seed: i * 3 })),
      };
      buildHolidayFloor();
    }
    function stepToward(o, tx, ty, speed, dt, turn) {
      const want = Math.atan2(ty - o.y, tx - o.x);
      let d = want - o.a; d = Math.atan2(Math.sin(d), Math.cos(d));
      o.a += Math.max(-turn * dt, Math.min(turn * dt, d));
      o.x += Math.cos(o.a) * speed * dt; o.y += Math.sin(o.a) * speed * dt;
    }
    function drawHoliday(now, dt) {
      const W = canvas.width, H = canvas.height;
      if (!holiday || !holidayFloor || holidayFloor.width !== W || holidayFloor.height !== H) initHoliday();
      const hol = holiday;
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
      ctx.drawImage(holidayFloor, 0, 0);
      hol.lanterns.forEach((l) => {
        const fl = 0.8 + 0.2 * Math.sin(now * 0.017 + l.seed);
        const gr = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 120);
        gr.addColorStop(0, `rgba(255,170,50,${0.38 * fl})`); gr.addColorStop(1, 'rgba(255,140,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(l.x, l.y, 120, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#c4580c'; ctx.beginPath(); ctx.ellipse(l.x, l.y, 16, 13, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = `rgba(255,232,120,${fl})`;
        ctx.beginPath(); ctx.moveTo(l.x - 9, l.y - 2); ctx.lineTo(l.x - 3, l.y - 2); ctx.lineTo(l.x - 6, l.y - 8); ctx.closePath();
        ctx.moveTo(l.x + 9, l.y - 2); ctx.lineTo(l.x + 3, l.y - 2); ctx.lineTo(l.x + 6, l.y - 8); ctx.closePath();
        ctx.moveTo(l.x - 8, l.y + 4); ctx.lineTo(l.x, l.y + 8); ctx.lineTo(l.x + 8, l.y + 4); ctx.lineTo(l.x, l.y + 2); ctx.closePath(); ctx.fill();
      });
      const M = window.MonsterModels;
      hol.mons.forEach((m) => {
        ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.scale, m.scale);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 14, 26, 10, 0, 0, 6.28); ctx.fill();
        if (M) M.draw(m.id, ctx, now);
        ctx.restore();
      });
      hol.players.forEach((p) => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(2.6, 2.6); ctx.translate(-p.x, -p.y);
        PlayerModel.draw(ctx, 10, { x: p.x, y: p.y, color: p.color, facing: { x: Math.cos(p.a), y: Math.sin(p.a) }, walkPhase: p.phase });
        ctx.restore();
      });
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(8,6,12,0.35)'); vg.addColorStop(1, 'rgba(8,6,12,0.82)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

"""
rep("    let last = null;\n    function frame(now) {", HOLIDAY + "    let last = null;\n    function frame(now) {")
rep("      drawFacility();\n      creatures.forEach((c) => { updateCreature(c, now, dt); drawCreature(ctx, c, now); });\n      requestAnimationFrame(frame);",
    "      if (window.__lobbyMode === 'holiday' && window.MonsterModels && window.PlayerModel) {\n        drawHoliday(now, dt);\n      } else {\n        drawFacility();\n        creatures.forEach((c) => { updateCreature(c, now, dt); drawCreature(ctx, c, now); });\n      }\n      requestAnimationFrame(frame);")
open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('ok')
