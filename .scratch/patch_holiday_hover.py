P = 'C:/claude_p/goofy-horror/index.html'
t = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')

def rep(a, b):
    global t
    assert t.count(a) == 1, (a[:70], t.count(a))
    t = t.replace(a, b)

# which monsters each holiday has (MonsterModels ids + display names)
rep("""    const HOLIDAY_MONSTERS = [   // MonsterModels ids: Hollow Jack, Hush, Rotten One, Embergourd, Pumpkin King
      { id: 33, scale: 1.5, speed: 30 }, { id: 34, scale: 1.4, speed: 34 }, { id: 35, scale: 1.4, speed: 26 },
      { id: 36, scale: 1.5, speed: 30 }, { id: 32, scale: 1.9, speed: 20 },
    ];""",
"""    const HOLIDAY_MONSTERS = [   // MonsterModels ids: Hollow Jack, Hush, Rotten One, Embergourd, Pumpkin King
      { id: 33, name: 'Hollow Jack', scale: 1.5, speed: 30 }, { id: 34, name: 'Hush', scale: 1.4, speed: 34 },
      { id: 35, name: 'The Rotten One', scale: 1.4, speed: 26 }, { id: 36, name: 'Embergourd', scale: 1.5, speed: 30 },
      { id: 32, name: 'Pumpkin King', scale: 1.9, speed: 20 },
    ];
    // hovering a holiday's card lines up every monster that holiday has
    const HOLIDAY_LINEUP = { 'halloween-2026': [33, 34, 35, 36, 32] };
    let holidayShow = 0, holidayShowing = null;
    document.querySelectorAll('.holiday-card').forEach((card) => {
      const on = () => { holidayShowing = card.dataset.goto; };
      const off = () => { if (holidayShowing === card.dataset.goto) holidayShowing = null; };
      card.addEventListener('mouseenter', on); card.addEventListener('mouseleave', off);
      card.addEventListener('focus', on); card.addEventListener('blur', off);
    });""")

# darkness mask + lineup
rep("""      ctx.drawImage(holidayFloor, 0, 0);
      hol.lanterns.forEach((l) => {""",
"""      const lineup = holidayShowing && HOLIDAY_LINEUP[holidayShowing] || null;
      holidayShow += ((lineup ? 1 : 0) - holidayShow) * Math.min(1, dt * 4);
      const show = holidayShow < 0.003 ? 0 : holidayShow * holidayShow * (3 - 2 * holidayShow);
      if (lineup) hol.lineup = lineup;
      const row = (hol.lineup || []).map((id) => hol.mons.findIndex((m) => m.id === id)).filter((i) => i >= 0);
      const slot = {};
      row.forEach((mi, k) => { slot[mi] = { x: W * (0.14 + 0.72 * (k / Math.max(1, row.length - 1))), y: H * 0.74 }; });
      ctx.drawImage(holidayFloor, 0, 0);
      hol.lanterns.forEach((l) => {""")

rep("""      hol.mons.forEach((m) => {
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
""",
"""      const spot = (i, m) => {   // where monster i is drawn, blending from roaming to the lineup
        const s = slot[i];
        return s ? { x: m.x + (s.x - m.x) * show, y: m.y + (s.y - m.y) * show, k: m.scale * (1 + 0.75 * show) }
                 : { x: m.x, y: m.y, k: m.scale };
      };
      hol.mons.forEach((m, i) => {
        const o = spot(i, m);
        ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.k, o.k);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 14, 26, 10, 0, 0, 6.28); ctx.fill();
        if (M) M.draw(m.id, ctx, now);
        ctx.restore();
      });
      ctx.save(); ctx.globalAlpha = 1 - 0.65 * show;
      hol.players.forEach((p) => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(2.6, 2.6); ctx.translate(-p.x, -p.y);
        PlayerModel.draw(ctx, 10, { x: p.x, y: p.y, color: p.color, facing: { x: Math.cos(p.a), y: Math.sin(p.a) }, walkPhase: p.phase });
        ctx.restore();
      });
      ctx.restore();
      // darkness like the real game: the whole screen is near-black, lit only by the
      // players' flashlights, the jack-o-lanterns and a faint glow round each monster
      if (!hol.dark || hol.dark.width !== W || hol.dark.height !== H) { hol.dark = document.createElement('canvas'); hol.dark.width = W; hol.dark.height = H; }
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
      hol.lanterns.forEach((l) => light(l.x, l.y, 120 * (0.9 + 0.1 * Math.sin(now * 0.017 + l.seed)), 0.7));
      hol.mons.forEach((m, i) => { const o = spot(i, m); light(o.x, o.y, 70 + 130 * show, 0.28 + 0.62 * show); });
      ctx.drawImage(hol.dark, 0, 0);
      // the monsters' red-orange eyes keep glowing in the dark, and the lineup is named
      ctx.textAlign = 'center';
      if (show > 0.02) {
        hol.mons.forEach((m, i) => {
          if (!slot[i]) return;
          const o = spot(i, m);
          ctx.globalAlpha = show;
          ctx.font = '700 17px "Courier New", monospace';
          ctx.fillStyle = '#000'; ctx.fillText(m.name, o.x + 1, o.y + 78 + 1);
          ctx.fillStyle = '#ffae4a'; ctx.fillText(m.name, o.x, o.y + 78);
        });
        ctx.globalAlpha = 1;
      }
    }
""")
open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('ok')
