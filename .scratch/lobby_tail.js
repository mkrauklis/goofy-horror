    // Hovering a level opens a panel in the page right under its card (the cards
    // below it slide down) and the lineup is drawn into that panel's canvas.
    const reveal = document.createElement('div');
    reveal.className = 'monster-reveal';
    const rc = document.createElement('canvas');
    reveal.appendChild(rc);
    const rctx = rc.getContext('2d');
    reveal.addEventListener('mouseenter', () => { if (revealOpen) hoverLine = lineup; });
    reveal.addEventListener('mouseleave', () => { hoverLine = null; });
    let revealOpen = false;
    function openReveal(anchor) {
      if (reveal.previousElementSibling !== anchor) { anchor.after(reveal); lobbyShow = 0; }
      revealOpen = true;
    }
    function drawLineup(mode, now, show, n) {
      const M = window.MonsterModels;
      if (show < 0.003) {
        if (reveal.parentNode) reveal.remove();       // fully shut: take no space (or flex gap) at all
        revealOpen = false;
        return;
      }
      const crowded = n > 3, H = crowded ? 190 : 270;
      const W = reveal.clientWidth || 640;
      if (rc.width !== W || rc.height !== H) { rc.width = W; rc.height = H; rc.style.height = H + 'px'; }
      reveal.style.height = Math.round(show * H) + 'px';
      const g = rctx;
      g.clearRect(0, 0, W, H);
      const spacing = n > 1 ? 0.8 * W / (n - 1) : 0;
      const wrapW = n > 1 ? Math.max(100, Math.min(260, spacing * 0.92)) : 360;
      const wrap = (text) => {
        const lines = []; let cur = '';
        text.split(' ').forEach((w) => {
          if (cur && g.measureText(cur + ' ' + w).width > wrapW) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
        });
        if (cur) lines.push(cur);
        return lines;
      };
      const put = (str, x, y, col) => { g.fillStyle = '#000'; g.fillText(str, x + 1, y + 1); g.fillStyle = col; g.fillText(str, x, y); };
      g.globalAlpha = show;
      lineup.forEach((e, k) => {
        const r = n === 1 ? 62 : Math.max(26, Math.min(crowded ? 38 : 62, spacing * 0.42));
        const x = n === 1 ? W / 2 : W * 0.1 + 0.8 * W * (k / (n - 1)), cy = 22 + r + 12;
        const halo = g.createRadialGradient(x, cy, 0, x, cy, r * 1.8);
        halo.addColorStop(0, mode === 'holiday' ? 'rgba(255,150,40,0.24)' : 'rgba(150,200,255,0.22)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = halo; g.beginPath(); g.arc(x, cy, r * 1.8, 0, 6.28); g.fill();
        if (!e.hidden) {
          g.save(); g.translate(x, cy); const k2 = r / Math.max(30, M.extent(e.id)); g.scale(k2, k2); M.draw(e.id, g, now); g.restore();
        } else {
          // not beaten yet: a blank, featureless blob with a question mark on it
          const q = r * 0.8;
          const bg = g.createRadialGradient(x - q * 0.3, cy - q * 0.3, 2, x, cy, q);
          bg.addColorStop(0, '#4a4f5a'); bg.addColorStop(1, '#1c1f26');
          g.fillStyle = bg; g.beginPath(); g.arc(x, cy, q, 0, 6.28); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.stroke();
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `700 ${Math.round(q * 1.3)}px "Courier New", monospace`;
          g.fillStyle = '#d8dce6'; g.fillText('?', x, cy + q * 0.06);
          g.textBaseline = 'alphabetic';
        }
        g.textAlign = 'center';
        let y = cy + r + 22;
        g.font = `700 ${crowded ? 12 : 16}px "Courier New", monospace`;
        wrap(e.hidden ? '???' : (MONSTER_NAMES[e.id] || '')).forEach((ln) => { put(ln, x, y, mode === 'holiday' ? '#ffae4a' : '#bfe0ff'); y += crowded ? 14 : 19; });
        if (!crowded) {
          g.font = '13px "Courier New", monospace';
          y += 2;
          wrap(e.hidden ? 'Beat this level to find out what lurks here.' : (MONSTER_DESC[e.id] || '')).forEach((ln) => { put(ln, x, y, '#c4c8d4'); y += 16; });
        }
      });
      g.globalAlpha = 1;
    }
    function drawLobby(mode, now, dt) {
      const W = canvas.width, H = canvas.height, def = LOBBY[mode];
      let hol = scenes[mode];
      if (!hol || hol.W !== W || hol.H !== H) hol = scenes[mode] = initLobby(mode);
      const HW = hol.HW;
      // players run around, steering away from whatever gets close
      hol.players.forEach((p) => {
        if (now > p.turnAt) { p.wx = Math.random() * W; p.wy = Math.random() * HW; p.turnAt = now + 2500 + Math.random() * 3000; }
        let tx = p.wx, ty = p.wy;
        hol.mons.forEach((m) => {
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d < 260) { tx += (p.x - m.x) * (260 - d) / 40; ty += (p.y - m.y) * (260 - d) / 40; }
        });
        stepToward(p, tx, ty, 78, dt, 3.2);
        p.x = Math.max(30, Math.min(W - 30, p.x)); p.y = Math.max(40, Math.min(HW - 40, p.y));
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
        m.x = Math.max(40, Math.min(W - 40, m.x)); m.y = Math.max(60, Math.min(HW - 60, m.y));
      });
      // the panel under a hovered level opens and shuts smoothly
      lobbyShow += ((hoverLine ? 1 : 0) - lobbyShow) * Math.min(1, dt * 6);
      const show = lobbyShow < 0.003 ? 0 : lobbyShow * lobbyShow * (3 - 2 * lobbyShow);
      drawLineup(mode, now, show, lineup.length);

      // The room scrolls with the page: it repeats every HW pixels, so draw the visible
      // slice of it once or (across the seam) twice.
      const M = window.MonsterModels;
      const off = ((window.scrollY % HW) + HW) % HW;
      const tiles = off === 0 ? [0] : [-off, HW - off];
      const lamp = (l, oy, now2) => {
        const y = l.y + oy, fl = 0.8 + 0.2 * Math.sin(now2 * 0.017 + l.seed);
        if (def.lamps === 'cool') {
          const gr = ctx.createRadialGradient(l.x, y, 2, l.x, y, 130);
          gr.addColorStop(0, `rgba(190,225,255,${0.3 * fl})`); gr.addColorStop(1, 'rgba(150,200,255,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(l.x, y, 130, 0, 6.28); ctx.fill();
          ctx.fillStyle = '#2a3038'; ctx.beginPath(); ctx.arc(l.x, y, 11, 0, 6.28); ctx.fill();
          ctx.fillStyle = `rgba(225,242,255,${fl})`; ctx.beginPath(); ctx.arc(l.x, y, 6, 0, 6.28); ctx.fill();
          return;
        }
        const gr = ctx.createRadialGradient(l.x, y, 2, l.x, y, 120);
        gr.addColorStop(0, `rgba(255,170,50,${0.38 * fl})`); gr.addColorStop(1, 'rgba(255,140,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(l.x, y, 120, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#c4580c'; ctx.beginPath(); ctx.ellipse(l.x, y, 16, 13, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = `rgba(255,232,120,${fl})`;
        ctx.beginPath(); ctx.moveTo(l.x - 9, y - 2); ctx.lineTo(l.x - 3, y - 2); ctx.lineTo(l.x - 6, y - 8); ctx.closePath();
        ctx.moveTo(l.x + 9, y - 2); ctx.lineTo(l.x + 3, y - 2); ctx.lineTo(l.x + 6, y - 8); ctx.closePath();
        ctx.moveTo(l.x - 8, y + 4); ctx.lineTo(l.x, y + 8); ctx.lineTo(l.x + 8, y + 4); ctx.lineTo(l.x, y + 2); ctx.closePath(); ctx.fill();
      };
      const onScreen = (y, oy) => y + oy > -170 && y + oy < H + 170;
      const shadowed = (id, x, y, k) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(3, 14, 26, 10, 0, 0, 6.28); ctx.fill();
        M.draw(id, ctx, now);
        ctx.restore();
      };
      tiles.forEach((oy) => {
        ctx.drawImage(hol.floor, 0, oy);
        hol.lamps.forEach((l) => { if (onScreen(l.y, oy)) lamp(l, oy, now); });
        hol.mons.forEach((m) => { if (onScreen(m.y, oy)) shadowed(m.id, m.x, m.y + oy, m.scale); });
        hol.players.forEach((p) => {
          if (!onScreen(p.y, oy)) return;
          const py = p.y + oy;
          ctx.save(); ctx.translate(p.x, py); ctx.scale(2.6, 2.6); ctx.translate(-p.x, -py);
          PlayerModel.draw(ctx, 10, { x: p.x, y: py, color: p.color, facing: { x: Math.cos(p.a), y: Math.sin(p.a) }, walkPhase: p.phase });
          ctx.restore();
        });
      });
      // darkness like the real game: the whole room is near-black, lit only by the
      // players' flashlights, the lamps and a faint glow round each monster
      if (!hol.dark) { hol.dark = document.createElement('canvas'); hol.dark.width = W; hol.dark.height = HW; }
      const d = hol.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, HW);
      d.fillStyle = 'rgba(3,2,7,0.93)'; d.fillRect(0, 0, W, HW);
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
      // lights near the seam also glow on the far side of it
      hol.players.forEach((p) => { if (p.y < 320) light(p.x, p.y + HW, 90, 0.75); if (p.y > HW - 320) light(p.x, p.y - HW, 90, 0.75); });
      hol.lamps.forEach((l) => { if (l.y < 130) light(l.x, l.y + HW, 120, 0.7); if (l.y > HW - 130) light(l.x, l.y - HW, 120, 0.7); });
      tiles.forEach((oy) => ctx.drawImage(hol.dark, 0, oy));
    }

