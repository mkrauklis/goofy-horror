// Hard mode: unlocked by beating the game, switched on from the menu. A
// hard run keeps its own story save (see js/story.js) so it never touches
// your normal progress. Every game{N}.js reads its tuning through the
// helpers below -- e.g. `const PATROL_SPEED = HM.speed(PLAYER_SPEED * 0.5)` --
// so with hard mode off every one of them returns its input unchanged.
//
//   * the game is 1.2x darker and its colors paler (a CSS filter on the canvas)
//   * sprint stamina burns 2x as fast
//   * monsters (bosses included) are 1.25x faster -- except in chase scenes,
//     which keep their own speeds
//   * item/ability effects last half as long
//   * monsters are drawn pale with red pupils
//   * bosses have 1.5x the health
//   * enemy projectiles fly 1.25x faster
//   * your flashlight flickers at random
(function () {
  const KEY = 'goofy-horror-hard-mode';
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* storage blocked: stays off */ }

  const DARKER = 1.2;
  const STAMINA_DRAIN = 2;
  const MONSTER_SPEED = 1.25;
  const ABILITY_DURATION = 0.5;
  const BOSS_HEALTH = 1.5;
  const PROJECTILE_SPEED = 1.25;
  const PALE_SATURATION = 0.55;

  // ---- pale monsters with red pupils ----
  // A monster is drawn onto a scratch canvas first so the pale wash only
  // touches the monster's own pixels (not the floor around it), then the
  // result is stamped onto the real canvas. ctx.filter would do this in one
  // line but it's far too slow to run per monster per frame.
  const scratch = document.createElement('canvas');
  const sctx = scratch.getContext('2d');

  function redEyes(g, cx, cy, r, look) {
    const dx = look && Number.isFinite(look.x) ? look.x : 0;
    const dy = look && Number.isFinite(look.y) ? look.y : 1;
    const len = Math.hypot(dx, dy) || 1;
    const fx = dx / len, fy = dy / len;
    const nx = -fy, ny = fx;
    const er = Math.max(2.2, Math.min(7, r * 0.17));
    [-1, 1].forEach((side) => {
      const x = cx + fx * r * 0.32 + nx * side * r * 0.3;
      const y = cy + fy * r * 0.32 + ny * side * r * 0.3;
      const ang = Math.atan2(fy, fx);
      g.fillStyle = '#e9e4dc';                                      // pale eyeball ...
      g.beginPath(); g.ellipse(x, y, er, er * 0.72, ang, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff1a14';                                      // ... with a red pupil
      g.beginPath(); g.ellipse(x + fx * er * 0.15, y + fy * er * 0.15, er * 0.5, er * 0.5, ang, 0, Math.PI * 2); g.fill();
    });
  }

  // draw(g) must draw the monster at its world position onto g.
  function monster(g, m, draw, opts) {
    if (!on) { draw(g); return; }
    const r = m.radius || m.r || 22;
    const half = Math.ceil(r * 6) + 24; // generous: tentacles and limbs reach well past the body
    const size = half * 2;
    if (scratch.width < size || scratch.height < size) { scratch.width = size; scratch.height = size; }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.setTransform(1, 0, 0, 1, half - m.x, half - m.y);
    draw(sctx);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-atop';
    sctx.fillStyle = 'rgba(234,230,240,0.5)';
    sctx.fillRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = 'source-over';
    if (!opts || opts.eyes !== false) redEyes(sctx, half, half, r, m.lookDir || m.look || m.dir);
    g.drawImage(scratch, 0, 0, size, size, m.x - half, m.y - half, size, size);
  }

  // ---- flickering flashlight ----
  // Each player's light gets its own random flicker events: mostly small
  // flutters, now and then a sharp dip, rarely a near blackout. `key` is the
  // player object. Called more than once per frame per player (the inner and
  // outer light), so the value is cached for a few ms.
  const flickerState = new Map();
  function flicker(key) {
    if (!on) return 1;
    const now = performance.now();
    let st = flickerState.get(key);
    if (!st) { st = { nextAt: now + 1000 + Math.random() * 2000, until: 0, level: 1, evalAt: 0, value: 1 }; flickerState.set(key, st); }
    if (now - st.evalAt < 8) return st.value;
    st.evalAt = now;
    if (now >= st.nextAt) {
      const roll = Math.random();
      let dur;
      if (roll < 0.55) { st.level = 0.55 + Math.random() * 0.3; dur = 60 + Math.random() * 120; }      // flutter
      else if (roll < 0.88) { st.level = 0.22 + Math.random() * 0.25; dur = 50 + Math.random() * 90; } // sharp dip
      else { st.level = 0.05 + Math.random() * 0.1; dur = 100 + Math.random() * 260; }                  // near blackout
      st.until = now + dur;
      // sometimes it stutters twice in a row
      st.nextAt = now + dur + (Math.random() < 0.3 ? 70 + Math.random() * 120 : 600 + Math.random() * 2600);
    }
    if (now < st.until) st.value = Math.min(1, st.level * (0.8 + Math.random() * 0.35));
    else st.value = 0.97 + Math.random() * 0.03;
    return st.value;
  }

  const id = (v) => v;
  function applyChrome() {
    if (!on) return;
    document.documentElement.classList.add('hard-mode');
    const canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = `brightness(${(1 / DARKER).toFixed(3)}) saturate(${PALE_SATURATION}) contrast(0.95)`;
    const nav = document.querySelector('nav.level-nav');
    if (nav && !nav.querySelector('.hard-badge')) {
      const sep = document.createElement('span'); sep.textContent = '·';
      const badge = document.createElement('span');
      badge.className = 'hard-badge';
      badge.textContent = 'HARD MODE';
      badge.style.cssText = 'color:#ff4a3a;font-weight:bold;letter-spacing:1px';
      nav.append(sep, badge);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyChrome);
  else applyChrome();

  window.HardMode = {
    on,
    set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } },
    speed: on ? (v) => v * MONSTER_SPEED : id,
    proj: on ? (v) => v * PROJECTILE_SPEED : id,
    ability: on ? (v) => v * ABILITY_DURATION : id,
    drain: on ? (v) => v * STAMINA_DRAIN : id,
    bossHp: on ? (v) => Math.round(v * BOSS_HEALTH * 2) / 2 : id,
    monster,
    redEyes,
    flicker,
  };
})();
