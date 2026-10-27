  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const intro = gameState === 'intro';
    const phase2Intro = gameState === 'phase2intro';
    const cutscene = intro || phase2Intro;
    const zoom = cutscene ? ZOOM * BOSS_INTRO_ZOOM_MULT : ZOOM;
    // The whole arena is on screen at all times: the camera sits fixed on the
    // middle of it (except during the boss's own cutscenes).
    const camX = cutscene ? boss.x : ARENA_CX;
    const camY = cutscene ? boss.y : ARENA_CY;
    const screaming = boss.phase === 'scream' && !boss.chasing && !boss.defeated && gameState === 'playing';
    const shakeX = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : screaming ? (Math.random() - 0.5) * 5 : 0;
    const shakeY = cutscene ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : screaming ? (Math.random() - 0.5) * 5 : 0;

    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, VIEW_W, VIEW_H); ctx.clip();
    ctx.fillStyle = '#1c0f0d'; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, now);
    drawTrail(ctx, now);
    drawSmokeBombs(ctx, now);
    drawCrates(ctx);
    drawGasPatches(ctx, now);
    drawCornPatches(ctx, now);
    drawCandies(ctx);
    drawBoss(ctx, now);
    drawScreamRings(ctx, now);
    drawExplosions(ctx, now);
    // the arena is so big on screen that people are tiny: a ring under each makes them easy to find
    players.forEach((pl) => {
      if (pl.caught) return;
      ctx.strokeStyle = pl.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, 17, 0, Math.PI * 2); ctx.stroke();
    });
    drawPlayers(ctx);
    drawGasDanger(ctx, now);
    drawParticles(ctx);
    drawBloodSplatters(ctx);
    drawFloatingTexts(ctx);
    ctx.restore();

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }
    if (now < p.slowUntil) {                    // pink glow round the edges while cotton candy's slowing you
      const vg = ctx.createRadialGradient(vx + VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, vx + VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.55);
      vg.addColorStop(0, 'rgba(255,150,210,0)'); vg.addColorStop(1, 'rgba(255,150,210,0.3)');
      ctx.fillStyle = vg; ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    if (intro) {
      drawBossIntroOverlay(vx, now);
    } else if (phase2Intro) {
      drawPhase2IntroOverlay(vx, now);
    } else {
      drawBossHealthBar(vx, now);
      drawRadar(vx, p, now);
      drawScanner(vx, p, now);
      drawShotgunHud(vx, p);
      drawStaminaBar(vx, p, 0);
    }
    ctx.restore();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'dying') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE CANDY KRAKEN CRUMBLES&hellip;<br>HAPPY HALLOWEEN!';
    } else {
      messageEl.style.display = 'none';
    }
  }
  function updateHud() {
    if (hudBossEl) {
      hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : `Boss: ${bossHealth}/${BOSS_MAX_HEALTH} HP`;
      hudBossEl.classList.toggle('done', boss.defeated);
    }
    if (hudPhaseEl) {
      hudPhaseEl.textContent = boss.phase2 ? 'Phase: 2 — WITHERED' : 'Phase: 1';
      hudPhaseEl.classList.toggle('done', boss.phase2);
    }
    if (hudMissilesEl) {
      const now = performance.now();
      hudMissilesEl.textContent = boss.defeated ? 'Stun: --'
        : boss.phase === 'stunned' ? `STUNNED — BITE IT! ${Math.max(0, (boss.stunUntil - now) / 1000).toFixed(1)}s`
          : `Stun in: ${ATTACKS_PER_STUN - boss.attacksSinceStun} attacks`;
      hudMissilesEl.classList.toggle('done', boss.phase === 'stunned');
    }
    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;
  function loop(now) {
    try {
      const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;

      if (gameState === 'intro') {
        updateIntroCutscene(now);
      } else if (gameState === 'phase2intro') {
        updatePhase2Cutscene(now);
      } else if (gameState === 'playing') {
        elapsedMs = now - runStartTime;
        updateInputMovement(now, dt);
        updateCrates(now);
        updateSmokeBombs(now);
        updateBoss(now, dt);
        updateBites(now);
        updateCandies(now, dt);
        updateCornPatches(now);
        updateGas(now);
        updateShotgunDefense(now);
        updateCatch(now);
        updateCutscenes(now);
      } else if (gameState === 'dying') {
        updateDeathSequence(now);
      }
      updateParticles(dt);
      updateFloatingTexts(dt);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderViewport(0, now);
      if (PLAYER_MODE === 2) { renderViewport(1, now); drawDivider(); }

      if (catchFlash > 0) {
        ctx.fillStyle = `rgba(180,20,30,${catchFlash * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        catchFlash -= dt * 1.2;
      }

      updateOverlay();
      updateHud();
    } catch (err) {
      console.error('desolate-apes: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
