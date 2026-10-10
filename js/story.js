// Story mode progress, shared across every level page and the menu. A
// single localStorage record per save slot (not ten separate "did you
// beat it" flags) so each slot's whole save lives in one place and
// resetting a slot's story resets everything in it at once. Per-level
// best times live in their own goofy-horror-best-levelN-slotI keys (see
// index.html and bestTimeKey below) -- namespaced by slot too, since
// each slot is meant to read as its own separate playthrough.
(function () {
  const TOTAL_LEVELS = 21;
  const SLOT_COUNT = 3;
  const LEGACY_KEY = 'goofy-horror-story'; // pre-slots single save, migrated into slot 0 below
  const SLOTS_NAMES_KEY = 'goofy-horror-slot-names';
  const ACTIVE_SLOT_KEY = 'goofy-horror-active-slot';

  function storyKeyFor(slot) {
    return `goofy-horror-story-${slot}`;
  }

  // A player who already had progress before save slots existed gets it
  // preserved as slot 0's save, the first time anything asks for slot 0
  // and finds it empty -- one-time, harmless to repeat, never overwrites
  // a real slot-0 save that already exists.
  function migrateLegacyIfNeeded() {
    try {
      if (localStorage.getItem(storyKeyFor(0)) !== null) return;
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === null) return;
      localStorage.setItem(storyKeyFor(0), legacy);
    } catch (e) {
      // private-browsing / storage-full -- nothing to migrate into
    }
  }
  migrateLegacyIfNeeded();

  function getActiveSlot() {
    try {
      const v = parseInt(localStorage.getItem(ACTIVE_SLOT_KEY), 10);
      if (Number.isFinite(v) && v >= 0 && v < SLOT_COUNT) return v;
    } catch (e) {
      // fall through to the default slot
    }
    return 0;
  }

  function setActiveSlot(i) {
    if (!Number.isFinite(i) || i < 0 || i >= SLOT_COUNT) return;
    try {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(i));
    } catch (e) {
      // private-browsing / storage-full -- stays on whatever slot was active
    }
    state = load();
  }

  function loadSlotNames() {
    try {
      const raw = localStorage.getItem(SLOTS_NAMES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // corrupt or blocked storage -- fall through to defaults
    }
    return [];
  }
  let slotNames = loadSlotNames();

  function getSlotName(i) {
    const custom = slotNames[i];
    return (typeof custom === 'string' && custom.trim()) || `Save ${i + 1}`;
  }

  function setSlotName(i, name) {
    slotNames[i] = name;
    try {
      localStorage.setItem(SLOTS_NAMES_KEY, JSON.stringify(slotNames));
    } catch (e) {
      // private-browsing / storage-full -- name just won't stick
    }
  }

  // A read-only peek at another slot's own progress -- used by the menu's
  // slot picker to show "3/21 completed" on each button without actually
  // switching the active slot to read it.
  function getSlotSummary(i) {
    try {
      const raw = localStorage.getItem(storyKeyFor(i));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.completed) && Number.isFinite(parsed.unlocked)) {
          return { completed: parsed.completed.length, unlocked: parsed.unlocked };
        }
      }
    } catch (e) {
      // corrupt or blocked storage -- reads as a fresh slot
    }
    return { completed: 0, unlocked: 1 };
  }

  function load() {
    try {
      const raw = localStorage.getItem(storyKeyFor(getActiveSlot()));
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
      localStorage.setItem(storyKeyFor(getActiveSlot()), JSON.stringify(state));
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

  // Each level's best time is namespaced by the currently active slot,
  // so switching slots genuinely switches to a separate playthrough's
  // records too, not just its unlock progress. A player who already had
  // a best time saved under the old global key (from before save slots
  // existed) has it copied into slot 0's own key the first time slot 0
  // asks for it, same one-time migration story progress gets above.
  function bestTimeKey(n) {
    const slot = getActiveSlot();
    const key = `goofy-horror-best-level${n}-slot${slot}`;
    if (slot === 0) {
      try {
        if (localStorage.getItem(key) === null) {
          const legacy = localStorage.getItem(`goofy-horror-best-level${n}`);
          if (legacy !== null) localStorage.setItem(key, legacy);
        }
      } catch (e) {
        // private-browsing / storage-full -- nothing to migrate
      }
    }
    return key;
  }

  // 1-player or 2-player, picked on the menu and read by every game{N}.js
  // at startup -- one shared key rather than per-level storage, since it's
  // a play-style preference, not level progress. Defaults to 2 (the game's
  // original, still-primary mode) whenever nothing's been chosen yet or
  // storage is blocked.
  const PLAYER_MODE_KEY = 'goofy-horror-player-mode';
  function getPlayerMode() {
    try {
      return localStorage.getItem(PLAYER_MODE_KEY) === '1' ? 1 : 2;
    } catch (e) {
      return 2;
    }
  }
  function setPlayerMode(n) {
    try {
      localStorage.setItem(PLAYER_MODE_KEY, n === 1 ? '1' : '2');
    } catch (e) {
      // private-browsing / storage-full -- falls back to 2-player each load
    }
  }

  window.GoofyStory = {
    TOTAL_LEVELS,
    SLOT_COUNT,
    isUnlocked,
    isCompleted,
    completeLevel,
    nextLevel,
    isStoryComplete,
    resetProgress,
    getPlayerMode,
    setPlayerMode,
    getActiveSlot,
    setActiveSlot,
    getSlotName,
    setSlotName,
    getSlotSummary,
    bestTimeKey,
  };

  // Each level belongs to a 5-level chapter (Chapter 1 = levels 1-5,
  // Chapter 2 = levels 6-10, Chapter 3 = levels 11-15, and so on) -- a
  // plain-text label in the nav, not a link, so a level page shows which
  // chapter it's part of without reintroducing the old row of direct
  // level-to-level jump links.
  function chapterForLevel(n) {
    return Math.ceil(n / 5);
  }

  function injectChapterLabel() {
    const match = window.location.pathname.match(/\/level(\d+)\.html$/);
    if (!match) return;
    const n = parseInt(match[1], 10);
    const nav = document.querySelector('nav.level-nav');
    const menuLink = nav && nav.querySelector('a[href="index.html"]');
    if (!nav || !menuLink) return;
    const label = document.createElement('span');
    label.className = 'nav-chapter-label';
    label.textContent = `Chapter ${chapterForLevel(n)}`;
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

  // Every level page's hint paragraph is identical, hardcoded markup:
  // "Player 1 ... Player 2 ..." as a leading text node followed by the
  // #sound-hint span. In solo mode that's misleading (there's no Player
  // 2), so this rewrites just that leading text node -- never touching
  // the span itself -- rather than editing all 20 HTML files by hand.
  function applyPlayerModeHint() {
    if (!window.GoofyStory || window.GoofyStory.getPlayerMode() !== 1) return;
    const hint = document.querySelector('p.hint');
    if (!hint) return;
    const firstNode = hint.childNodes[0];
    if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
      firstNode.textContent = 'Solo: W A S D or Arrow keys move your character';
    }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  onReady(injectChapterLabel);
  onReady(setupFullscreenToggle);
  onReady(applyPlayerModeHint);
})();
