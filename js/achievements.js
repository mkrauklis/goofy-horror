// Achievements: a tiny shared save (one localStorage record, like the Halloween and Season 2
// saves in js/story.js) plus the "achievement unlocked" toast and the icon art, so a level page
// and the menu's Achievements tab agree on what has been earned. Not touched by "Reset progress".
(function () {
  const KEY = 'goofy-horror-achievements';

  // kind: 'boss' (earned by beating that boss) | 'secret' (hidden until earned). `model` is the
  // Monsterpedia model id (window.MonsterModels) the icon shows; `cluster` draws a few of them.
  const DEFS = [
    { id: 'ashen', kind: 'boss', name: 'Cooled Off', desc: 'Beat the Ashen One in the Cinder Pit (Level 5).', model: 5 },
    { id: 'knight', kind: 'boss', name: 'Knight Fall', desc: 'Beat the Last Knight (Level 10).', model: 11 },
    { id: 'frozen', kind: 'boss', name: 'Thawed Out', desc: "Beat the Frozen Mutation at the Thaw's End (Level 15).", model: 16 },
    { id: 'cistern', kind: 'boss', name: 'Drained', desc: 'Beat the Cistern (Level 20).', model: 21 },
    { id: 'cultivator', kind: 'boss', name: 'Weeded Out', desc: 'Beat the Cultivator in the Spore Engine (Level 25).', model: 26 },
    { id: 'garguantuagoyle', kind: 'boss', name: 'Stone Cold', desc: 'Beat the Garguantuagoyle at the Landing Zone (Level 30).', model: 31 },
    { id: 'multipod', kind: 'boss', name: 'Swarm Breaker', desc: 'Survive the Multipod and get out (Level 31).', cluster: [0, 6, 10, 30, 24] },
    { id: 'chaos', kind: 'boss', name: 'Order Restored', desc: 'Beat the Being of Pure Chaos on the rooftop (Level 31, Hard Mode).', icon: 'chaos' },
    { id: 'hardmode', kind: 'boss', name: 'Hard Earned', desc: 'Beat Hard Mode: finish the whole game again, harder.', icon: 'missing' },
    {
      id: 'homebeforemidnight', kind: 'seasonal', name: 'Home Before Midnight',
      desc: 'Beat all 5 Halloween levels before November 1st, 2026.', icon: 'pumpkin',
      deadline: new Date(2026, 10, 1).getTime(),
    },
    { id: 'pumpkinking', kind: 'boss', name: 'Pumpkin Smasher', desc: 'Beat the Pumpkin King (Halloween 5).', model: 32 },
    {
      id: 'greatape',
      kind: 'secret',
      name: 'Great Ape',
      desc: 'Said the word the apes were waiting for, and sat through all twenty seconds of them.',
      hint: 'There is a word the primates know. It may be spelled wrong.',
      icon: 'apes',
    },
    {
      id: 'mentalist',
      kind: 'secret',
      name: 'Mentalist',
      desc: 'Escaped The Mental Challenge: 25 buttons, every monster in the game, and no colour to tell them apart.',
      hint: 'Some doors only open for the right word. Ask the one who knows.',
      icon: 'eye',
    },
  ];

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (e) {
      // corrupt or blocked storage -- starts fresh
    }
    return {};
  }
  let earned = load();

  function has(id) { return !!earned[id]; }

  function def(id) { return DEFS.find((d) => d.id === id); }

  // A blurry black-and-white eye: drawn sharp, then softened by a CSS blur on the canvas itself.
  function drawEye(c) {
    const W = c.width, H = c.height, g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, '#3a3a3a'); bg.addColorStop(1, '#0a0a0a');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2, ew = W * 0.42, eh = H * 0.27;
    g.save();
    g.beginPath();
    g.moveTo(cx - ew, cy);
    g.quadraticCurveTo(cx, cy - eh * 2.1, cx + ew, cy);
    g.quadraticCurveTo(cx, cy + eh * 2.1, cx - ew, cy);
    g.closePath();
    g.clip();
    const sclera = g.createRadialGradient(cx - ew * 0.2, cy - eh * 0.3, 2, cx, cy, ew * 1.1);
    sclera.addColorStop(0, '#f4f4f4'); sclera.addColorStop(0.65, '#bdbdbd'); sclera.addColorStop(1, '#4a4a4a');
    g.fillStyle = sclera;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(60,60,60,0.55)';
    g.lineWidth = Math.max(1, W * 0.012);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4, side = i % 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(cx + side * ew * 0.98, cy + Math.sin(a) * eh * 0.6);
      g.quadraticCurveTo(cx + side * ew * 0.6, cy + Math.cos(a) * eh * 0.5, cx + side * ew * 0.3, cy + Math.sin(a * 1.7) * eh * 0.12);
      g.stroke();
    }
    const ir = H * 0.2;
    const iris = g.createRadialGradient(cx - ir * 0.25, cy - ir * 0.25, 1, cx, cy, ir);
    iris.addColorStop(0, '#d8d8d8'); iris.addColorStop(0.5, '#7c7c7c'); iris.addColorStop(1, '#161616');
    g.fillStyle = iris;
    g.beginPath(); g.arc(cx, cy, ir, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * ir * 0.4, cy + Math.sin(a) * ir * 0.4); g.lineTo(cx + Math.cos(a) * ir * 0.95, cy + Math.sin(a) * ir * 0.95); g.stroke();
    }
    g.fillStyle = '#000';
    g.beginPath(); g.arc(cx, cy, ir * 0.42, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(cx - ir * 0.38, cy - ir * 0.4, ir * 0.17, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + ir * 0.3, cy + ir * 0.32, ir * 0.07, 0, Math.PI * 2); g.fill();
    g.restore();

    g.strokeStyle = '#050505';
    g.lineWidth = Math.max(2, W * 0.035);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - ew, cy);
    g.quadraticCurveTo(cx, cy - eh * 2.1, cx + ew, cy);
    g.quadraticCurveTo(cx, cy + eh * 2.1, cx - ew, cy);
    g.stroke();
    g.lineWidth = Math.max(1.5, W * 0.02);
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * ew * 0.28, y = cy - eh * 1.55 * (1 - Math.pow(i / 3.6, 2)) * 0.95;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + i * 2.2, y - H * 0.07); g.stroke();
    }
  }

  // The classic "missing texture": a magenta and black checkerboard.
  function drawMissingTexture(c) {
    const W = c.width, H = c.height, g = c.getContext('2d'), n = 4;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#000' : '#ff00ff';
        g.fillRect(Math.floor(x * W / n), Math.floor(y * H / n), Math.ceil(W / n), Math.ceil(H / n));
      }
    }
  }

  // A bunch of apes crowded together, back row to front: round brown heads, tan faces, big ears.
  function drawApesIcon(c) {
    const W = c.width, H = c.height, g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2c5a2a'); sky.addColorStop(1, '#0f2410');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(80,160,70,0.35)';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(W * (0.1 + i * 0.17), H * 0.1, W * 0.12, H * 0.07, 0, 0, Math.PI * 2); g.fill(); }
    const apes = [
      [0.22, 0.46, 0.17, '#4a3020'], [0.5, 0.4, 0.2, '#3a2418'], [0.78, 0.46, 0.17, '#5a3c26'],
      [0.12, 0.74, 0.2, '#6a4a30'], [0.4, 0.74, 0.22, '#4a3020'], [0.68, 0.76, 0.2, '#5a3c26'], [0.92, 0.72, 0.17, '#3a2418'],
    ];
    apes.forEach(([x, y, r, fur], i) => {
      const cx = W * x, cy = H * y, R = W * r;
      g.fillStyle = fur;
      g.beginPath(); g.arc(cx - R * 0.95, cy, R * 0.34, 0, Math.PI * 2); g.arc(cx + R * 0.95, cy, R * 0.34, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d9a67a';
      g.beginPath(); g.arc(cx - R * 0.95, cy, R * 0.2, 0, Math.PI * 2); g.arc(cx + R * 0.95, cy, R * 0.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = fur;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d9a67a';
      g.beginPath(); g.ellipse(cx, cy + R * 0.12, R * 0.72, R * 0.78, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = fur;
      g.beginPath(); g.arc(cx - R * 0.3, cy - R * 0.22, R * 0.28, 0, Math.PI * 2); g.arc(cx + R * 0.3, cy - R * 0.22, R * 0.28, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(cx - R * 0.3, cy - R * 0.15, R * 0.14, 0, Math.PI * 2); g.arc(cx + R * 0.3, cy - R * 0.15, R * 0.14, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111';
      g.beginPath(); g.arc(cx - R * 0.28, cy - R * 0.13, R * 0.07, 0, Math.PI * 2); g.arc(cx + R * 0.32, cy - R * 0.13, R * 0.07, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#b87a52';
      g.beginPath(); g.ellipse(cx, cy + R * 0.32, R * 0.4, R * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a1a10';
      g.beginPath(); g.arc(cx - R * 0.08, cy + R * 0.22, R * 0.04, 0, Math.PI * 2); g.arc(cx + R * 0.08, cy + R * 0.22, R * 0.04, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a1a10'; g.lineWidth = Math.max(1, R * 0.05);
      g.beginPath(); g.arc(cx, cy + R * 0.34, R * 0.22, 0.2, Math.PI - 0.2); g.stroke();
      if (i % 3 === 1) { g.fillStyle = '#6a1a14'; g.beginPath(); g.ellipse(cx, cy + R * 0.46, R * 0.14, R * 0.09, 0, 0, Math.PI * 2); g.fill(); }
    });
  }

  function drawPumpkinIcon(c) {
    const g = drawBackdrop(c, true), W = c.width, H = c.height, cx = W / 2, cy = H * 0.54, r = W * 0.34;
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, r * 1.9);
    halo.addColorStop(0, 'rgba(255,170,50,0.5)'); halo.addColorStop(1, 'rgba(255,140,20,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    const body = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 2, cx, cy, r * 1.2);
    body.addColorStop(0, '#ffb24a'); body.addColorStop(0.6, '#ee7a14'); body.addColorStop(1, '#a8420a');
    g.fillStyle = body;
    g.beginPath(); g.ellipse(cx, cy, r * 1.1, r * 0.92, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d6a1c'; g.fillRect(cx - r * 0.12, cy - r * 1.05, r * 0.26, r * 0.35);
    g.fillStyle = '#ffe27a';
    g.beginPath();
    g.moveTo(cx - r * 0.6, cy - r * 0.05); g.lineTo(cx - r * 0.2, cy - r * 0.05); g.lineTo(cx - r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx + r * 0.6, cy - r * 0.05); g.lineTo(cx + r * 0.2, cy - r * 0.05); g.lineTo(cx + r * 0.4, cy - r * 0.42); g.closePath();
    g.moveTo(cx - r * 0.65, cy + r * 0.2);
    [[-0.45, 0.5], [-0.25, 0.3], [-0.05, 0.52], [0.15, 0.3], [0.35, 0.5], [0.65, 0.2]].forEach(([dx, dy]) => g.lineTo(cx + r * dx, cy + r * dy));
    g.lineTo(cx + r * 0.4, cy + r * 0.12); g.lineTo(cx - r * 0.4, cy + r * 0.12); g.closePath();
    g.fill();
  }

  function drawBackdrop(c, dark) {
    const W = c.width, H = c.height, g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, dark ? '#3a2f4a' : '#2b2b2b'); bg.addColorStop(1, '#0c0a10');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    return g;
  }

  // The boss's own Monsterpedia model when the page has it loaded, else a plain medal.
  function drawBossIcon(c, d) {
    const g = drawBackdrop(c, true), W = c.width, H = c.height, M = window.MonsterModels;
    const ids = d.cluster || (d.model != null ? [d.model] : null);
    if (d.icon === 'chaos') {
      g.fillStyle = '#05030a';
      g.beginPath(); g.arc(W / 2, H / 2, W * 0.36, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 26; i++) {
        const a = i * 2.4, r = W * 0.3 * Math.sqrt((i + 1) / 26);
        const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r, e = W * (0.035 + 0.02 * ((i * 7) % 3) / 2);
        g.fillStyle = '#f2f2f2'; g.beginPath(); g.ellipse(x, y, e * 1.4, e, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#d83a2a'; g.beginPath(); g.arc(x, y, e * 0.55, 0, Math.PI * 2); g.fill();
      }
      return;
    }
    if (M && ids) {
      const t = performance.now();
      ids.forEach((id, i) => {
        const n = ids.length;
        const k = (W * (n > 1 ? 0.2 : 0.44)) / M.extent(id);
        const ox = n > 1 ? Math.cos(i / n * Math.PI * 2 - 1.2) * W * 0.22 : 0;
        const oy = n > 1 ? Math.sin(i / n * Math.PI * 2 - 1.2) * H * 0.22 : 0;
        g.save();
        g.translate(W / 2 + ox, H / 2 + oy);
        g.scale(k, k);
        g.drawImage(M.sprite(id, t), -80, -80);
        g.restore();
      });
      return;
    }
    g.fillStyle = '#d9b24a';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? W * 0.14 : W * 0.3, a = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  }

  // Fills `canvas` with the achievement's icon (a "?" tile while locked).
  function drawIcon(canvas, id, locked) {
    const d = def(id);
    if (!canvas) return;
    if (locked || !d) {
      const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#17141c';
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.font = `bold ${Math.round(H * 0.55)}px monospace`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', W / 2, H / 2 + 3);
      canvas.style.filter = '';
      return;
    }
    if (d.icon === 'apes') {
      drawApesIcon(canvas);
      canvas.style.filter = '';
    } else if (d.icon === 'pumpkin') {
      drawPumpkinIcon(canvas);
      canvas.style.filter = '';
    } else if (d.icon === 'missing') {
      drawMissingTexture(canvas);
      canvas.style.filter = '';
    } else if (d.icon === 'eye') {
      drawEye(canvas);
      canvas.style.filter = 'grayscale(1) blur(1.7px) contrast(1.15)';
    } else {
      drawBossIcon(canvas, d);
      canvas.style.filter = '';
    }
  }

  function toast(d) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;align-items:center;gap:12px;'
      + 'padding:10px 16px 10px 10px;background:#111;border:1px solid #777;border-radius:10px;color:#eee;'
      + 'font:14px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,0.6);filter:none;'
      + 'transform:translateY(20px);opacity:0;transition:transform .4s,opacity .4s;pointer-events:none';
    const c = document.createElement('canvas');
    c.width = c.height = 56;
    c.style.cssText = 'width:56px;height:56px;border-radius:8px;flex:none';
    drawIcon(c, d.id, false);
    const t = document.createElement('div');
    t.innerHTML = '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#aaa">Achievement unlocked</div>'
      + `<div style="font-size:18px;font-weight:700">${d.name}</div>`;
    el.appendChild(c); el.appendChild(t);
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'none'; el.style.opacity = '1'; });
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 600); }, 6500);
  }

  // Idempotent. Returns true only the first time (the toast shows then, too).
  function unlock(id) {
    const d = def(id);
    if (!d || has(id) || !available(id)) return false;
    earned[id] = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch (e) { /* ignore */ }
    if (document.body) toast(d);
    return true;
  }

  // True while a timed achievement can still be earned.
  function available(id) {
    const d = def(id);
    return !!d && (!d.deadline || Date.now() < d.deadline);
  }

  window.Achievements = { DEFS, has, unlock, available, drawIcon };
})();
