p = 'C:/claude_p/goofy-horror/js/customgame.js'
s = open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in s
s = s.replace('\r\n', '\n')


def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:70])
    s = s.replace(a, b)


# ---- caught: cause, lava ----
rep("""  function triggerCaught(p, now) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    spawnBloodEffect(p.x, p.y);
    p.caught = true;""", """  function triggerCaught(p, now, cause) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    p.cause = cause || 'monster';
    if (p.cause === 'lava') {
      spawnBurst(p.x, p.y);
      spawnEmberBurst(p.x, p.y, 50);
      spawnFloatingText(p.x, p.y - 14, 'BURNED!');
      sweep(900, 120, 0.6, 'sawtooth', 0.2);
    } else {
      spawnBloodEffect(p.x, p.y);
    }
    p.caught = true;""")

rep("""  function updateCutscenes(now) {""", """  // Magma floor kills on contact: the tile under a player's centre decides it.
  function updateLava(now) {
    if (!lavaTiles.length) return;
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil) return;
      const t = worldToTile(p.x, p.y);
      if (tileChar(t.x, t.y) === 'L') triggerCaught(p, now, 'lava');
    });
  }

  function updateCutscenes(now) {""")

# ---- overlay for burning ----
rep("""  function drawCutsceneOverlay(vx, p, now) {
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);""", """  function drawBurnOverlay(vx, p, now) {
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    const gr = ctx.createLinearGradient(0, VIEW_H, 0, 0);
    gr.addColorStop(0, `rgba(255,120,20,${0.85 * Math.min(1, t * 2)})`);
    gr.addColorStop(0.6, `rgba(180,40,10,${0.55 * t})`);
    gr.addColorStop(1, `rgba(30,6,4,${0.7 * t})`);
    ctx.fillStyle = gr;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    // flame tongues licking up from the bottom edge
    const reach = (0.25 + 0.75 * Math.min(1, t * 1.6)) * VIEW_H;
    for (let i = 0; i < 18; i++) {
      const fx = vx + (i + 0.5) * (VIEW_W / 18);
      const hh = reach * (0.45 + 0.55 * Math.abs(Math.sin(now * 0.012 + i * 1.7)));
      ctx.fillStyle = i % 2 ? '#ff8a1e' : '#ffd25a';
      ctx.beginPath();
      ctx.moveTo(fx - VIEW_W / 40, VIEW_H);
      ctx.quadraticCurveTo(fx + Math.sin(now * 0.02 + i) * 8, VIEW_H - hh * 0.55, fx, VIEW_H - hh);
      ctx.quadraticCurveTo(fx + VIEW_W / 60, VIEW_H - hh * 0.5, fx + VIEW_W / 40, VIEW_H);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCutsceneOverlay(vx, p, now) {
    if (p.cause === 'lava') { drawBurnOverlay(vx, p, now); return; }
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);""")

# ---- hazards: blobs ----
rep("""      } else if (h.type === 'circle') {
        const k = h.boomed ? 1 : clamp(1 - (h.armAt - now) / 1000, 0, 1);""", """      } else if (h.type === 'blob') {
        const sinceLaunch = now - h.launchAt;
        if (sinceLaunch >= 0 && sinceLaunch < 450) { // the blob leaving the boss, shot up into the air
          const f = sinceLaunch / 450;
          g.save();
          g.globalAlpha = 1 - f;
          softGlow(g, h.sx, h.sy - 90 * f, 22, '255,130,30', 0.9);
          g.fillStyle = '#ff8a22';
          g.beginPath(); g.arc(h.sx, h.sy - 90 * f, 9 * (1 - f * 0.4), 0, Math.PI * 2); g.fill();
          g.restore();
        }
        if (sinceLaunch < 0) return;
        if (!h.boomed) { // its shadow on the ground, growing and darkening for 2s
          const k = clamp(sinceLaunch / 2000, 0, 1);
          g.save();
          g.fillStyle = `rgba(0,0,0,${0.18 + 0.32 * k})`;
          g.beginPath(); g.ellipse(h.x, h.y, h.r * (0.3 + 0.7 * k), h.r * (0.3 + 0.7 * k) * 0.86, 0, 0, Math.PI * 2); g.fill();
          g.strokeStyle = `rgba(255,${80 + 40 * Math.sin(now / 90)},40,${0.3 + 0.5 * k})`;
          g.lineWidth = 2; g.setLineDash([6, 5]);
          g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke();
          g.setLineDash([]);
          const fall = (h.armAt - now) / 380; // the glob dropping in at the very end
          if (fall > 0 && fall <= 1) {
            softGlow(g, h.x, h.y - 150 * fall, 26, '255,130,30', 0.9);
            g.fillStyle = '#ff8a22';
            g.beginPath(); g.arc(h.x, h.y - 150 * fall, 11, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#ffd25a';
            g.beginPath(); g.arc(h.x - 2, h.y - 150 * fall - 2, 5, 0, Math.PI * 2); g.fill();
          }
          g.restore();
        } else { // the puddle
          const fade = clamp((h.until - now) / 380, 0, 1);
          g.save();
          g.globalAlpha = fade;
          const gr = g.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r);
          gr.addColorStop(0, '#ffe08a');
          gr.addColorStop(0.45, '#ff8a22');
          gr.addColorStop(0.85, '#b8380e');
          gr.addColorStop(1, '#3a1208');
          g.fillStyle = gr;
          g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,230,140,0.55)';
          for (let b = 0; b < 5; b++) {
            const a = now / 600 + b * 1.9, rr = h.r * (0.2 + 0.5 * ((Math.sin(now / 280 + b * 2.3) + 1) / 2));
            g.beginPath(); g.arc(h.x + Math.cos(a) * rr * 0.8, h.y + Math.sin(a) * rr * 0.8, 3 + (b % 2) * 2, 0, Math.PI * 2); g.fill();
          }
          g.restore();
        }
      } else if (h.type === 'circle') {
        const k = h.boomed ? 1 : clamp(1 - (h.armAt - now) / 1000, 0, 1);""")

# ---- boss bar: segments every bombDmg ----
rep("""    for (let i = 1; i < BOSS.hp && BOSS.hp <= 30; i++) {
      ctx.beginPath(); ctx.moveTo(x + (w * i) / BOSS.hp, y); ctx.lineTo(x + (w * i) / BOSS.hp, y + h); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
    }""", """    for (let i = BOSS.bombDmg; i < BOSS.hp; i += BOSS.bombDmg) {
      ctx.beginPath(); ctx.moveTo(x + (w * i) / BOSS.hp, y); ctx.lineTo(x + (w * i) / BOSS.hp, y + h); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
    }""")

# ---- overlay text: not during intro ----
rep("""  function updateOverlay() {
    if (gameState === 'complete') {""", """  function updateOverlay() {
    if (gameState === 'intro') {
      messageEl.style.display = 'none';
    } else if (gameState === 'complete') {""")

# ---- loop ----
rep("""      const playable = !check.errors.length;

      if (gameState === 'playing' && playable) {""", """      const playable = !check.errors.length;

      if (gameState === 'intro' && (now - introStartedAt >= INTRO_MS || window.BossCutscene.skipRequested(introStartedAt))) {
        gameState = 'playing';
        runStartTime = now;
        elapsedMs = 0;
        if (boss) boss.phaseAt = now + 1500;
      }

      if (gameState === 'playing' && playable) {""")
rep("""        updateCatch(now);
        updateCutscenes(now);
        updateExploration();""", """        updateLava(now);
        updateCatch(now);
        updateCutscenes(now);
        updateExploration();""")
rep("""      updateParticles(dt);
      LD.update(dt, players);
      updateFloatingTexts(dt);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderViewport(0, now);
      if (PLAYER_MODE === 2) {
        renderViewport(1, now);
        drawDivider();
      }""", """      updateParticles(dt);
      updateEmbers(dt);
      LD.update(dt, players);
      updateFloatingTexts(dt);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (gameState === 'intro') {
        window.BossCutscene.draw(ctx, canvas.width, canvas.height, now - introStartedAt, 'custom');
      } else {
        renderViewport(0, now);
        if (PLAYER_MODE === 2) {
          renderViewport(1, now);
          drawDivider();
        }
      }""")

# embers/particles cleared on reset
rep("""    hazards = [];
    bombs = [];
    bombRespawnAt = 0;
    attackQueue = [];""", """    hazards = [];
    bombs = [];
    bombRespawnAt = 0;
    attackQueue = [];
    particles = [];
    embers = [];""")

open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('ok')
