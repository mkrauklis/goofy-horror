  function updateDeathSequence(now) {
    const t = now - deathStartedAt;
    // the boss crumbles into a shower of candy
    if (t < DEATH_FALL_MS + DEATH_DRAG_MS && Math.random() < 0.35) {
      spawnCandyBurst(boss.x + (Math.random() - 0.5) * boss.radius * 1.6, boss.y + (Math.random() - 0.5) * boss.radius * 1.6, 5, 160);
    }
    if (t < DEATH_FALL_MS + DEATH_DRAG_MS) return;
    if (freezeFinished) return;
    freezeFinished = true;
    if (!bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
    }
    playWinJingle();
    if (window.GoofyStory) window.GoofyStory.completeHalloween(5);
    setTimeout(() => { window.location.href = 'index.html'; }, 2200);
  }

