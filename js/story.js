// Story mode progress, shared across every level page and the menu. A
// single localStorage record (not five separate "did you beat it" flags)
// so the whole save lives in one place and resetting the story resets
// everything at once. Per-level best times still live in their own
// goofy-horror-best-levelN keys (see index.html) -- this is purely about
// which chapters are unlocked/finished, not how fast you did it.
(function () {
  const KEY = 'goofy-horror-story';
  const TOTAL_LEVELS = 8;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.completed) && Number.isFinite(parsed.unlocked)) return parsed;
      }
    } catch (e) {
      // corrupt or blocked storage -- fall through to a fresh save
    }
    return { completed: [], unlocked: 1 };
  }

  let state = load();

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // private-browsing / storage-full -- story mode just won't persist
    }
  }

  function isUnlocked(n) {
    return n <= state.unlocked;
  }

  function isCompleted(n) {
    return state.completed.indexOf(n) !== -1;
  }

  // Called once from the level that was just won, right where it already
  // records its best time. Idempotent -- replaying a finished chapter
  // calls this again harmlessly.
  function completeLevel(n) {
    if (!isCompleted(n)) state.completed.push(n);
    if (n + 1 > state.unlocked && n + 1 <= TOTAL_LEVELS) state.unlocked = n + 1;
    persist();
  }

  // Where "Continue" on the menu should send you: the first chapter not
  // yet beaten, or the last one if the whole story's done (so replaying
  // from the menu lands you back on the finale, not chapter 1).
  function nextLevel() {
    for (let i = 1; i <= TOTAL_LEVELS; i++) {
      if (!isCompleted(i)) return i;
    }
    return TOTAL_LEVELS;
  }

  function isStoryComplete() {
    return state.completed.length >= TOTAL_LEVELS;
  }

  function resetProgress() {
    state = { completed: [], unlocked: 1 };
    persist();
  }

  window.GoofyStory = {
    TOTAL_LEVELS,
    isUnlocked,
    isCompleted,
    completeLevel,
    nextLevel,
    isStoryComplete,
    resetProgress,
  };

  // Locks the top nav's own level links too -- the menu's cards already
  // hide a locked chapter, but the same nav bar is duplicated at the top of
  // every page, and clicking straight from there used to skip that check
  // entirely (the level itself would still refuse to run, but only after
  // a confusing "why did it lock me out" trip).
  function gateNav() {
    document.querySelectorAll('nav.level-nav a[href]').forEach((a) => {
      const m = a.getAttribute('href').match(/^level(\d+)\.html$/);
      if (!m) return;
      const n = parseInt(m[1], 10);
      if (isUnlocked(n)) return;
      a.classList.add('nav-locked');
      a.removeAttribute('href');
      a.title = `Locked — finish Chapter ${n - 1} first`;
    });
  }

  // A fullscreen toggle next to the music toggle, on every level page --
  // shared here instead of duplicated into all 6 game{N}.js files. Targets
  // the canvas holder specifically (not the whole page) so the HUD stays
  // visible and legible while fullscreen.
  function setupFullscreenToggle() {
    const holder = document.getElementById('game-canvas-holder');
    const hud = document.getElementById('hud');
    if (!holder || !hud || !document.fullscreenEnabled) return;

    const btn = document.createElement('button');
    btn.id = 'fullscreen-toggle';
    btn.type = 'button';
    btn.className = 'music-toggle';
    btn.textContent = '⛶ Fullscreen';
    hud.appendChild(btn);

    btn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        holder.requestFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const active = document.fullscreenElement === holder;
      btn.textContent = active ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
      holder.classList.toggle('is-fullscreen', active);
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(gateNav);
  onReady(setupFullscreenToggle);
})();
