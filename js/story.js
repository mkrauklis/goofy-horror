// Story mode progress, shared across every level page and the menu. A
// single localStorage record (not ten separate "did you beat it" flags)
// so the whole save lives in one place and resetting the story resets
// everything at once. Per-level best times still live in their own
// goofy-horror-best-levelN keys (see index.html) -- this is purely about
// which levels are unlocked/finished, not how fast you did it.
(function () {
  const KEY = 'goofy-horror-story';
  const TOTAL_LEVELS = 13;

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
  // records its best time. Idempotent -- replaying a finished level
  // calls this again harmlessly.
  function completeLevel(n) {
    if (!isCompleted(n)) state.completed.push(n);
    if (n + 1 > state.unlocked && n + 1 <= TOTAL_LEVELS) state.unlocked = n + 1;
    persist();
  }

  // Where "Continue" on the menu should send you: the first level not
  // yet beaten, or the last one if the whole story's done (so replaying
  // from the menu lands you back on the finale, not level 1).
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

  // Each level belongs to a 5-level area (Area 1 = levels 1-5, Area 2 =
  // levels 6-10, Area 3 = levels 11-15, and so on) -- a plain-text label
  // in the nav, not a link, so a level page shows which area it's part of
  // without reintroducing the old row of direct level-to-level jump links.
  function areaForLevel(n) {
    return Math.ceil(n / 5);
  }

  function injectAreaLabel() {
    const match = window.location.pathname.match(/\/level(\d+)\.html$/);
    if (!match) return;
    const n = parseInt(match[1], 10);
    const nav = document.querySelector('nav.level-nav');
    const menuLink = nav && nav.querySelector('a[href="index.html"]');
    if (!nav || !menuLink) return;
    const label = document.createElement('span');
    label.className = 'nav-area-label';
    label.textContent = `Area ${areaForLevel(n)}`;
    const sep = document.createElement('span');
    sep.textContent = '·';
    menuLink.after(sep, label);
  }

  // A fullscreen toggle next to the music toggle, on every level page --
  // shared here instead of duplicated into all 10 game{N}.js files. Targets
  // a wrapper around BOTH the HUD and the canvas holder (not just the
  // canvas holder alone) so the HUD -- and whatever of the objective
  // you've got done -- stays on screen while fullscreen, instead of
  // disappearing the way it did when only the canvas itself went
  // fullscreen and the HUD, a sibling outside it, was left behind.
  function setupFullscreenToggle() {
    const wrap = document.getElementById('game-fullscreen-wrap');
    const hud = document.getElementById('hud');
    if (!wrap || !hud || !document.fullscreenEnabled) return;

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
        wrap.requestFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const active = document.fullscreenElement === wrap;
      btn.textContent = active ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
      wrap.classList.toggle('is-fullscreen', active);
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(injectAreaLabel);
  onReady(setupFullscreenToggle);
})();
