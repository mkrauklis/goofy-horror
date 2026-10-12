// Story mode progress, shared across every level page and the menu. A
// single localStorage record (not ten separate "did you beat it" flags)
// so the whole save lives in one place and resetting the story resets
// everything at once. Per-level best times still live in their own
// goofy-horror-best-levelN keys (see index.html) -- this is purely about
// which levels are unlocked/finished, not how fast you did it.
(function () {
  const KEY = 'goofy-horror-story';
  const TOTAL_LEVELS = 23;

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

  // Guns found once, in a specific level, and kept forever after -- a
  // completely separate save from story progress, since finding one isn't
  // tied to beating a level. One shared key, a small array of unlocked
  // ids, so a new gun is just a new entry in GUNS below plus a call to
  // unlockGun(id) wherever it's actually found.
  const LOADOUT_KEY = 'goofy-horror-loadout';
  const GUNS = [
    { id: 'revolver', name: 'Revolver', level: 4, hint: 'Find it in a crack in the wall.' },
    { id: 'flamethrower', name: 'Flamethrower', level: 14, hint: 'Hidden behind the melted snow wall.' },
    { id: 'watergun', name: 'Water Gun', level: 18, hint: 'Down the long hallway, past the door the wheel opens.' },
  ];

  function loadLoadout() {
    try {
      const raw = localStorage.getItem(LOADOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // corrupt or blocked storage -- reads as nothing unlocked
    }
    return [];
  }
  let unlockedGuns = loadLoadout();

  function isGunUnlocked(id) {
    return unlockedGuns.indexOf(id) !== -1;
  }

  function unlockGun(id) {
    if (isGunUnlocked(id)) return;
    unlockedGuns.push(id);
    try {
      localStorage.setItem(LOADOUT_KEY, JSON.stringify(unlockedGuns));
    } catch (e) {
      // private-browsing / storage-full -- unlock just won't stick
    }
    renderLoadout();
  }

  // The Loadout overlay: press R any time during a level to see which guns
  // you've found so far. Built once per page load (not per level, since
  // this lives in the one shared story.js every level page already
  // includes) and toggled by visibility rather than add/remove, so it
  // doesn't fight each level's own canvas rendering.
  let loadoutEl = null;
  function buildLoadoutOverlay() {
    if (loadoutEl || !document.body) return;
    loadoutEl = document.createElement('div');
    loadoutEl.id = 'loadout-overlay';
    loadoutEl.className = 'loadout-overlay';
    loadoutEl.style.display = 'none';
    document.body.appendChild(loadoutEl);
    renderLoadout();
  }

  function renderLoadout() {
    if (!loadoutEl) return;
    const rows = GUNS.map((g) => {
      const unlocked = isGunUnlocked(g.id);
      return `<div class="loadout-row ${unlocked ? 'unlocked' : 'locked'}">`
        + `<span class="loadout-name">${g.name}</span>`
        + `<span class="loadout-state">${unlocked ? 'UNLOCKED' : 'LOCKED'}</span>`
        + `<span class="loadout-hint">${unlocked ? `Level ${g.level}` : g.hint}</span>`
        + `</div>`;
    }).join('');
    loadoutEl.innerHTML = `<div class="loadout-panel panel">`
      + `<h2>Loadout</h2>`
      + rows
      + `<p class="loadout-close">Press R to close</p>`
      + `</div>`;
  }

  function toggleLoadout() {
    if (!loadoutEl) return;
    const showing = loadoutEl.style.display !== 'none';
    loadoutEl.style.display = showing ? 'none' : 'flex';
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') toggleLoadout();
  });

  window.GoofyStory = {
    TOTAL_LEVELS,
    isUnlocked,
    isCompleted,
    completeLevel,
    nextLevel,
    isStoryComplete,
    resetProgress,
    getPlayerMode,
    setPlayerMode,
    isGunUnlocked,
    unlockGun,
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
  onReady(buildLoadoutOverlay);
})();
