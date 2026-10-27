// The designer (editor.html): paint a slot's map, shape its monster, tune how
// it behaves. A slot is one plain-data design (see js/customdata.js); this page
// only edits that object and saves it to localStorage, where js/customgame.js
// picks it up.
(function () {
  const CS = window.CustomStore;
  const CM = window.CustomMonster;
  const GS = window.GoofyStory;
  const $ = (id) => document.getElementById(id);

  const TILES = [
    { ch: '#', name: 'Wall', col: '#3a3a44' },
    { ch: '.', name: 'Floor', col: '#1d1826' },
    { ch: 'S', name: 'Safe room', col: '#1f5a3a' },
    { ch: 'D', name: 'Door', col: '#8a5a2a' },
    { ch: 'K', name: 'Key', col: '#e8c84a' },
    { ch: 'X', name: 'Exit', col: '#3ddc84' },
    { ch: '1', name: 'P1 spawn', col: '#ff8a3d' },
    { ch: '2', name: 'P2 spawn', col: '#6fe08a' },
    { ch: 'M', name: 'Monster', col: '#e0546b' },
    { ch: 'P', name: 'Patrol', col: '#6aa8ff' },
    { ch: 'B', name: 'Bomb', col: '#c8c8d0' },
    { ch: 'L', name: 'Lava', col: '#ff6a1a' },
  ];
  const SINGLE = '12X';
  const GUNS = [['', 'None'], ['revolver', 'Revolver'], ['flamethrower', 'Flamethrower'], ['watergun', 'Water Gun']];
  const INTRO_FX = [['none', 'No cutscene'], ['magma', 'Magma splash'], ['slash', 'Slashed'], ['bite', 'Bitten']];
  const INTRO_FLOORS = [['basalt', 'Basalt'], ['stone', 'Stone'], ['frost', 'Frost'], ['flood', 'Flood'], ['moss', 'Moss'], ['roof', 'Rooftop']];

  let slotId = 0;
  let design = null;
  let dirty = false;
  let tool = '#';
  let mode = 'brush';
  let brush = 1;
  let zoom = 20;
  let undoStack = [];
  let sel = 0;
  let preview = 'idle';

  const gridCv = $('grid-canvas');
  const gctx = gridCv.getContext('2d');
  const monCv = $('mon-canvas');
  const mctx = monCv.getContext('2d');

  const label = (n) => `Level ${GS ? GS.displayNumber(n) : n}`;
  const slotLabel = (s) => {
    const d = CS.get(s.id);
    return `Ch ${s.chapter} · ${label(s.id)} · ${s.kind === 'miniboss' ? 'Mini boss: ' : ''}${d.title}${CS.isCustomized(s.id) ? ' ✎' : ''}`;
  };

  // ---------------------------------------------------------------- slot handling
  function fillSlots() {
    const sel = $('slot-select');
    const keep = sel.value;
    sel.innerHTML = '';
    const order = GS ? GS.ORDER : CS.SLOTS.map((s) => s.id);
    order.forEach((id) => {
      const s = CS.slotInfo(id);
      if (!s) return;
      const o = document.createElement('option');
      o.value = id; o.textContent = slotLabel(s);
      sel.appendChild(o);
    });
    sel.value = keep || String(slotId);
  }

  function loadSlot(id) {
    slotId = id;
    design = CS.get(id);
    if (!design.monster.ai) design.monster.ai = CM.defaultAI();
    if (design.kind === 'miniboss' && !design.monster.boss) design.monster.boss = CM.defaultBoss();
    if (design.kind === 'miniboss' && !design.monster.intro) design.monster.intro = { effect: 'none', floor: 'basalt', color: '#ff6a2a' };
    undoStack = [];
    sel = 0;
    setDirty(false);
    $('slot-select').value = String(id);
    if (location.hash !== '#' + id) replaceHash(id);
    syncMeta();
    syncSize();
    drawGrid();
    renderMsgs();
    renderParts();
    renderBehaviour();
    $('status').textContent = CS.isCustomized(id) ? 'Your saved version' : 'Built-in starter';
  }
  function replaceHash(id) { try { window.history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } }

  function setDirty(v) {
    dirty = v;
    const st = $('status');
    if (v) { st.textContent = '● Unsaved changes'; st.className = 'ed-status dirty'; } else st.className = 'ed-status';
  }

  function save() {
    const ok = CS.save(slotId, design);
    setDirty(false);
    $('status').textContent = ok ? 'Saved ✓ (kept in this browser — use Export to back it up)' : 'Could not save (storage blocked?)';
    fillSlots();
    return ok;
  }

  // ---------------------------------------------------------------- generic bound fields
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, v) {
    const ks = path.split('.');
    const last = ks.pop();
    const t = ks.reduce((o, k) => o[k], obj);
    t[last] = v;
  }
  function syncBound(root) {
    root.querySelectorAll('[data-b]').forEach((el) => {
      const v = getPath(design, el.dataset.b);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
  }
  function onBound(e) {
    const el = e.target;
    if (!el.dataset || !el.dataset.b) return;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number' || el.type === 'range') { v = parseFloat(el.value); if (!Number.isFinite(v)) return; }
    else v = el.value;
    if (el.dataset.b.endsWith('.gun')) { // reward: empty means none
      if (!design.reward) design.reward = {};
      design.reward.gun = v || undefined;
      if (!v) delete design.reward;
      setDirty(true); return;
    }
    if (el.dataset.empty && v === '') { setPath(design, el.dataset.b, undefined); } else setPath(design, el.dataset.b, v);
    setDirty(true);
    if (el.dataset.b.startsWith('monster.parts')) renderPartRow();
    if (el.dataset.b === 'monster.boss.hp' || el.dataset.b.startsWith('monster.boss')) { /* nothing derived */ }
  }
  document.addEventListener('input', onBound);
  document.addEventListener('change', onBound);

  function syncMeta() { syncBound(document.querySelector('.ed-meta')); }

  // ---------------------------------------------------------------- tabs
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.tab-pane').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
      if (b.dataset.tab === 'level') drawGrid();
    });
  });

  // ---------------------------------------------------------------- level painter
  function buildTools() {
    const box = $('tile-tools');
    box.innerHTML = '';
    TILES.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tile-btn' + (t.ch === tool ? ' active' : '');
      b.dataset.tile = t.ch;
      b.innerHTML = `<i style="background:${t.col}"></i>${t.name}`;
      b.addEventListener('click', () => { tool = t.ch; box.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); });
      box.appendChild(b);
    });
  }
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.addEventListener('click', () => { mode = b.dataset.mode; document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b)); });
  });
  $('brush-size').addEventListener('change', (e) => { brush = parseInt(e.target.value, 10); });
  $('zoom').addEventListener('input', (e) => { zoom = parseInt(e.target.value, 10); drawGrid(); });

  const dims = () => ({ cols: Math.max(...design.grid.map((r) => r.length)), rows: design.grid.length });
  function cellAt(e) {
    const r = gridCv.getBoundingClientRect();
    const { cols, rows } = dims();
    const x = Math.floor((e.clientX - r.left) / (r.width / cols));
    const y = Math.floor((e.clientY - r.top) / (r.height / rows));
    return { x: Math.max(0, Math.min(cols - 1, x)), y: Math.max(0, Math.min(rows - 1, y)) };
  }
  function gridChars() { const { cols } = dims(); return design.grid.map((r) => r.padEnd(cols, '#').split('')); }
  function commit(g) { design.grid = g.map((r) => r.join('')); setDirty(true); }
  function snapshot() { undoStack.push(design.grid.slice()); if (undoStack.length > 80) undoStack.shift(); }

  function put(g, x, y, ch) {
    if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return;
    if (SINGLE.includes(ch)) {
      for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === ch) g[j][i] = '.';
    }
    g[y][x] = ch;
  }
  function stamp(g, cx, cy, ch) {
    const n = SINGLE.includes(ch) ? 1 : brush;
    const o = Math.floor((n - 1) / 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(g, cx - o + i, cy - o + j, ch);
  }
  function floodFill(g, x, y, ch) {
    const from = g[y][x];
    if (from === ch) return;
    if (SINGLE.includes(ch)) { put(g, x, y, ch); return; }
    const q = [[x, y]];
    while (q.length) {
      const [cx, cy] = q.pop();
      if (cy < 0 || cy >= g.length || cx < 0 || cx >= g[0].length || g[cy][cx] !== from) continue;
      g[cy][cx] = ch;
      q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  let drag = null;
  gridCv.addEventListener('contextmenu', (e) => e.preventDefault());
  gridCv.addEventListener('pointerdown', (e) => {
    gridCv.setPointerCapture(e.pointerId);
    const c = cellAt(e);
    const ch = e.button === 2 ? '.' : tool;
    snapshot();
    const g = gridChars();
    if (mode === 'fill') { floodFill(g, c.x, c.y, ch); commit(g); drawGrid(); renderMsgs(); return; }
    if (mode === 'rect') { drag = { start: c, end: c, ch }; drawGrid(); return; }
    drag = { brush: true, ch, g };
    stamp(g, c.x, c.y, ch);
    commit(g); drawGrid();
  });
  gridCv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const c = cellAt(e);
    if (drag.brush) { stamp(drag.g, c.x, c.y, drag.ch); commit(drag.g); drawGrid(); return; }
    drag.end = c; drawGrid();
  });
  function endDrag() {
    if (!drag) return;
    if (!drag.brush) {
      const g = gridChars();
      const x0 = Math.min(drag.start.x, drag.end.x), x1 = Math.max(drag.start.x, drag.end.x);
      const y0 = Math.min(drag.start.y, drag.end.y), y1 = Math.max(drag.start.y, drag.end.y);
      if (SINGLE.includes(drag.ch)) put(g, drag.end.x, drag.end.y, drag.ch);
      else for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = drag.ch;
      commit(g);
    }
    drag = null; drawGrid(); renderMsgs();
  }
  gridCv.addEventListener('pointerup', endDrag);
  gridCv.addEventListener('pointercancel', endDrag);

  function undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    design.grid = prev; setDirty(true); syncSize(); drawGrid(); renderMsgs();
  }
  $('btn-undo').addEventListener('click', undo);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); undo(); }
  });

  function syncSize() { const d = dims(); $('g-cols').value = d.cols; $('g-rows').value = d.rows; }
  $('btn-resize').addEventListener('click', () => {
    const cols = Math.max(12, Math.min(90, parseInt($('g-cols').value, 10) || 30));
    const rows = Math.max(10, Math.min(70, parseInt($('g-rows').value, 10) || 20));
    snapshot();
    const out = [];
    for (let y = 0; y < rows; y++) {
      const src = design.grid[y] || '';
      let row = '';
      for (let x = 0; x < cols; x++) row += src[x] || '#';
      out.push(row);
    }
    design.grid = out; setDirty(true); syncSize(); drawGrid(); renderMsgs();
  });
  $('btn-border').addEventListener('click', () => {
    snapshot();
    const g = gridChars();
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      if (y === 0 || x === 0 || y === g.length - 1 || x === g[0].length - 1) g[y][x] = '#';
    }
    commit(g); drawGrid(); renderMsgs();
  });

  function tileColors() {
    const ch = CS.chapterInfo(CS.slotInfo(slotId).chapter);
    const ashen = design.style === 'ashen';
    return { wall: ashen ? '#2c2733' : ch.wallTop, floor: ashen ? '#24202c' : ch.floor[0] };
  }
  function drawGrid() {
    const { cols, rows } = dims();
    const w = cols * zoom, h = rows * zoom;
    if (gridCv.width !== w || gridCv.height !== h) { gridCv.width = w; gridCv.height = h; }
    const pal = tileColors();
    const g = gctx;
    g.clearRect(0, 0, w, h);
    const lookup = {};
    TILES.forEach((t) => { lookup[t.ch] = t; });
    const rowsArr = design.grid;
    for (let y = 0; y < rows; y++) {
      const row = rowsArr[y] || '';
      for (let x = 0; x < cols; x++) {
        const ch = row[x] || '#';
        const px = x * zoom, py = y * zoom;
        if (ch === '#') { g.fillStyle = pal.wall; g.fillRect(px, py, zoom, zoom); continue; }
        g.fillStyle = ch === 'L' ? '#ff6a1a' : ch === 'S' ? '#1f5a3a' : pal.floor;
        g.fillRect(px, py, zoom, zoom);
        if (ch === 'L') { g.fillStyle = '#ffb43d'; g.fillRect(px + zoom * 0.2, py + zoom * 0.3, zoom * 0.3, zoom * 0.15); g.fillRect(px + zoom * 0.5, py + zoom * 0.6, zoom * 0.3, zoom * 0.15); }
        else if (ch === 'D') { g.fillStyle = '#8a5a2a'; g.fillRect(px + 2, py + 2, zoom - 4, zoom - 4); }
        else if ('KX12MPB'.includes(ch)) {
          g.fillStyle = lookup[ch].col;
          g.beginPath(); g.arc(px + zoom / 2, py + zoom / 2, zoom * 0.38, 0, Math.PI * 2); g.fill();
          if (zoom >= 14) { g.fillStyle = '#10101a'; g.font = `bold ${Math.floor(zoom * 0.5)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, px + zoom / 2, py + zoom / 2 + 1); }
        }
      }
    }
    if (zoom >= 12) {
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= cols; x++) { g.moveTo(x * zoom + 0.5, 0); g.lineTo(x * zoom + 0.5, h); }
      for (let y = 0; y <= rows; y++) { g.moveTo(0, y * zoom + 0.5); g.lineTo(w, y * zoom + 0.5); }
      g.stroke();
    }
    if (drag && !drag.brush) {
      const x0 = Math.min(drag.start.x, drag.end.x), x1 = Math.max(drag.start.x, drag.end.x);
      const y0 = Math.min(drag.start.y, drag.end.y), y1 = Math.max(drag.start.y, drag.end.y);
      g.strokeStyle = '#ffb43d'; g.lineWidth = 2;
      g.strokeRect(x0 * zoom + 1, y0 * zoom + 1, (x1 - x0 + 1) * zoom - 2, (y1 - y0 + 1) * zoom - 2);
    }
  }

  function renderMsgs() {
    const { errors, warnings } = CS.validate(design);
    const ul = $('msgs');
    ul.innerHTML = '';
    errors.forEach((m) => { const li = document.createElement('li'); li.className = 'err'; li.textContent = '✖ ' + m; ul.appendChild(li); });
    warnings.forEach((m) => { const li = document.createElement('li'); li.className = 'warn'; li.textContent = '⚠ ' + m; ul.appendChild(li); });
    if (!errors.length && !warnings.length) { const li = document.createElement('li'); li.className = 'ok'; li.textContent = '✔ Playable.'; ul.appendChild(li); }
  }

  // ---------------------------------------------------------------- monster
  const UNIT = 100; // preview pixels per body radius (on the 600px canvas)
  function selPart() { return design.monster.parts[sel] || null; }

  function renderParts() {
    const parts = design.monster.parts;
    if (sel >= parts.length) sel = Math.max(0, parts.length - 1);
    const list = $('part-list');
    list.innerHTML = '';
    parts.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'part-row' + (i === sel ? ' active' : '');
      b.innerHTML = `<i style="background:${p.c}"></i>${i + 1}. ${CM.PART_TYPES[p.t].label}${p.mir ? ' (mirrored)' : ''}`;
      b.addEventListener('click', () => { sel = i; renderParts(); });
      list.appendChild(b);
    });
    renderPartFields();
    syncBound(document.querySelector('[data-pane="monster"]'));
  }
  function renderPartRow() { // cheap refresh of just the swatch/label while typing
    const rows = $('part-list').children;
    const p = selPart();
    if (rows[sel] && p) rows[sel].innerHTML = `<i style="background:${p.c}"></i>${sel + 1}. ${CM.PART_TYPES[p.t].label}${p.mir ? ' (mirrored)' : ''}`;
  }
  function renderPartFields() {
    const box = $('part-fields');
    const p = selPart();
    box.innerHTML = '';
    if (!p) return;
    const base = `monster.parts.${sel}.`;
    const num = (k, lab, step, min, max) => `<label>${lab}<input type="number" data-b="${base}${k}" step="${step}"${min != null ? ` min="${min}"` : ''}${max != null ? ` max="${max}"` : ''}></label>`;
    let html = `<label>Colour<input type="color" data-b="${base}c"></label>`;
    Object.keys(CM.PART_TYPES[p.t].fields).forEach((k) => {
      html += num(k, k === 'rot' ? 'Angle (°)' : { x: 'Position x', y: 'Position y', r: 'Radius', rx: 'Width', ry: 'Height', w: 'Width', h: 'Height', len: 'Length' }[k] || k, k === 'rot' ? 5 : 0.05);
    });
    html += num('wob', 'Wobble', 0.05, 0, 1) + num('a', 'Opacity', 0.05, 0, 1);
    html += `<label class="chk"><input type="checkbox" data-b="${base}mir"> Mirror across the middle</label>`;
    box.innerHTML = html;
    syncBound(box);
  }
  $('add-type').innerHTML = Object.keys(CM.PART_TYPES).map((k) => `<option value="${k}">${CM.PART_TYPES[k].label}</option>`).join('');
  $('btn-add-part').addEventListener('click', () => {
    design.monster.parts.push(CM.newPart($('add-type').value, '#9a5a6a'));
    sel = design.monster.parts.length - 1; setDirty(true); renderParts();
  });
  $('btn-dup-part').addEventListener('click', () => {
    const p = selPart(); if (!p) return;
    const c = JSON.parse(JSON.stringify(p)); c.y = (c.y || 0) + 0.15;
    design.monster.parts.splice(sel + 1, 0, c); sel += 1; setDirty(true); renderParts();
  });
  $('btn-del-part').addEventListener('click', () => {
    if (!selPart()) return;
    design.monster.parts.splice(sel, 1); setDirty(true); renderParts();
  });
  function movePart(d) {
    const a = design.monster.parts, j = sel + d;
    if (j < 0 || j >= a.length) return;
    [a[sel], a[j]] = [a[j], a[sel]]; sel = j; setDirty(true); renderParts();
  }
  $('btn-up-part').addEventListener('click', () => movePart(-1));
  $('btn-down-part').addEventListener('click', () => movePart(1));

  // copy another slot's monster shapes as a starting point
  function fillCopyFrom() {
    $('copy-from').innerHTML = CS.SLOTS.map((s) => `<option value="${s.id}">${CS.get(s.id).monster.name} (${label(s.id)})</option>`).join('');
  }
  $('btn-copy-from').addEventListener('click', () => {
    const src = CS.get(parseInt($('copy-from').value, 10)).monster;
    design.monster.parts = JSON.parse(JSON.stringify(src.parts));
    design.monster.size = src.size;
    sel = 0; setDirty(true); renderParts();
  });

  // live preview + dragging shapes around
  let pointer = { x: 600, y: 300 };
  let dragPart = null;
  function toUnit(e) {
    const r = monCv.getBoundingClientRect();
    const px = (e.clientX - r.left) * (monCv.width / r.width), py = (e.clientY - r.top) * (monCv.height / r.height);
    return { px, py, ux: (px - monCv.width / 2) / UNIT, uy: (py - monCv.height / 2) / UNIT };
  }
  monCv.addEventListener('pointerdown', (e) => {
    const u = toUnit(e);
    let best = -1, bd = 0.45;
    design.monster.parts.forEach((p, i) => {
      const d = Math.min(Math.hypot((p.x || 0) - u.ux, (p.y || 0) - u.uy), p.mir ? Math.hypot((p.x || 0) - u.ux, -(p.y || 0) - u.uy) : 9);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) {
      sel = best;
      const p = design.monster.parts[best];
      dragPart = { i: best, flip: p.mir && Math.hypot((p.x || 0) - u.ux, -(p.y || 0) - u.uy) < Math.hypot((p.x || 0) - u.ux, (p.y || 0) - u.uy) };
      monCv.setPointerCapture(e.pointerId);
      renderParts();
    }
  });
  monCv.addEventListener('pointermove', (e) => {
    const u = toUnit(e);
    pointer = { x: u.px, y: u.py };
    if (!dragPart) return;
    const p = design.monster.parts[dragPart.i];
    p.x = Math.round(u.ux * 20) / 20; p.y = Math.round((dragPart.flip ? -u.uy : u.uy) * 20) / 20;
    setDirty(true);
    renderPartFields();
  });
  monCv.addEventListener('pointerup', () => { dragPart = null; });
  document.querySelectorAll('[data-pv]').forEach((b) => {
    b.addEventListener('click', () => { preview = b.dataset.pv; document.querySelectorAll('[data-pv]').forEach((x) => x.classList.toggle('active', x === b)); });
  });

  function previewLoop(ms) {
    if (design && !document.querySelector('[data-pane="monster"]').hidden) {
      const g = mctx;
      g.clearRect(0, 0, monCv.width, monCv.height);
      const m = Object.assign({}, design.monster, { rotate: false });
      const look = { x: pointer.x - monCv.width / 2, y: pointer.y - monCv.height / 2 };
      const size = m.size || 22;
      CM.draw(g, m, {
        x: monCv.width / 2, y: monCv.height / 2, t: ms / 1000, look, scale: UNIT / size,
        rage: preview === 'rage' ? 1 : 0, tired: preview === 'tired', obsidian: preview === 'obsidian' ? 1 : 0,
      });
      // the selected shape's anchor
      const p = selPart();
      if (p) {
        g.strokeStyle = '#ffb43d'; g.lineWidth = 2;
        [1, -1].forEach((s) => {
          if (s === -1 && !p.mir) return;
          g.beginPath(); g.arc(monCv.width / 2 + (p.x || 0) * UNIT, monCv.height / 2 + (p.y || 0) * UNIT * s, 9, 0, Math.PI * 2); g.stroke();
        });
      }
    }
    requestAnimationFrame(previewLoop);
  }

  // ---------------------------------------------------------------- behaviour
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${l}</option>`).join('');
  function renderBehaviour() {
    const m = design.monster;
    const box = $('behaviour');
    const isBoss = design.kind === 'miniboss';
    let h = '';
    h += `<h3 class="sec">Look of the place</h3><div class="fields">
      <label>Style <select data-b="style" data-empty="1">${opt([['', 'Chapter default'], ['ashen', 'Ashen (obsidian + magma cracks)']], design.style || '')}</select></label></div>`;
    if (isBoss) {
      const b = m.boss;
      h += `<h3 class="sec">Boss</h3><div class="fields">
        <label>Health <input type="number" min="1" max="200" step="1" data-b="monster.boss.hp"></label>
        <label>Speed (× player) <input type="number" min="0.2" max="3" step="0.05" data-b="monster.boss.speed"></label>
        <label>Rest when stunned (s) <input type="number" min="1" max="20" step="0.5" data-b="monster.boss.rest"></label>
        <label>Cough a bomb every N attacks <input type="number" min="0" max="12" step="1" data-b="monster.boss.bombEvery"></label>
        <label>Damage per bomb <input type="number" min="1" max="50" step="1" data-b="monster.boss.bombDmg"></label>
        <label>Pause between attacks (s) <input type="number" min="0" max="6" step="0.25" data-b="monster.boss.pause"></label>
        <label>Drops a gun <select data-b="reward.gun">${opt(GUNS, design.reward && design.reward.gun || '')}</select></label>
      </div>
      <p class="help">Bomb mode: 0 means bombs lie around the arena and the boss tires after <em>every</em> attack. A number N means bombs only appear when the boss coughs one up after every Nth attack, and it only tires then.</p>
      <h3 class="sec">Attacks, in order (they repeat)</h3><div id="atk-list"></div>
      <div class="ed-tools"><select id="atk-add">${Object.keys(CM.BOSS_ATTACKS).map((k) => `<option value="${k}">${CM.BOSS_ATTACKS[k].label}</option>`).join('')}</select><button type="button" id="btn-atk-add">Add attack</button></div>
      <h3 class="sec">Opening cutscene</h3><div class="fields">
        <label>What happens <select data-b="monster.intro.effect">${opt(INTRO_FX, (m.intro && m.intro.effect) || 'none')}</select></label>
        <label>Floor <select data-b="monster.intro.floor">${opt(INTRO_FLOORS, (m.intro && m.intro.floor) || 'basalt')}</select></label>
        <label>Colour <input type="color" data-b="monster.intro.color"></label>
      </div>`;
    } else {
      h += `<h3 class="sec">How it hunts</h3><div class="fields">
        <label>Type <select data-b="monster.ai.type">${opt(Object.keys(CM.AI_TYPES).map((k) => [k, CM.AI_TYPES[k].label]), m.ai.type)}</select></label>
        <label>Patrol speed (× player) <input type="number" min="0.1" max="3" step="0.05" data-b="monster.ai.patrol"></label>
        <label>Chase speed (× player) <input type="number" min="0.1" max="4" step="0.05" data-b="monster.ai.chase"></label>
        <label>Sight range (px) <input type="number" min="30" max="500" step="10" data-b="monster.ai.detect"></label>
        <label>Gives up after (s) <input type="number" min="0" max="15" step="0.5" data-b="monster.ai.grace"></label>
        <label>How many <input type="number" min="1" max="8" step="1" data-b="monster.ai.count"></label>
        <label>Blinks away every (s, 0 = never) <input type="number" min="0" max="30" step="1" data-b="monster.ai.blink"></label>
        <label class="chk"><input type="checkbox" data-b="monster.ai.aura"> Darkens your light when near</label>
      </div>
      <p class="help" id="ai-help"></p>`;
    }
    box.innerHTML = h;
    syncBound(box);
    if (isBoss) { renderAttacks(); $('btn-atk-add').addEventListener('click', () => { design.monster.boss.attacks.push($('atk-add').value); setDirty(true); renderAttacks(); }); }
    else { const upd = () => { $('ai-help').textContent = (CM.AI_TYPES[design.monster.ai.type] || {}).help || ''; }; upd(); box.querySelector('[data-b="monster.ai.type"]').addEventListener('change', upd); }
  }
  function renderAttacks() {
    const list = $('atk-list');
    const a = design.monster.boss.attacks;
    list.innerHTML = '';
    a.forEach((k, i) => {
      const row = document.createElement('div');
      row.className = 'atk-row';
      const info = CM.BOSS_ATTACKS[k] || { label: k, help: '' };
      row.innerHTML = `<span>${i + 1}. ${info.label}</span><button type="button" data-a="up">↑</button><button type="button" data-a="down">↓</button><button type="button" data-a="del" class="danger">✕</button><span class="atk-help">${info.help}</span>`;
      row.querySelector('[data-a="up"]').addEventListener('click', () => { if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; setDirty(true); renderAttacks(); } });
      row.querySelector('[data-a="down"]').addEventListener('click', () => { if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; setDirty(true); renderAttacks(); } });
      row.querySelector('[data-a="del"]').addEventListener('click', () => { if (a.length > 1) { a.splice(i, 1); setDirty(true); renderAttacks(); } });
      list.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- top bar
  $('slot-select').addEventListener('change', (e) => {
    if (dirty && !confirm('Discard your unsaved changes to this level?')) { e.target.value = String(slotId); return; }
    loadSlot(parseInt(e.target.value, 10));
  });
  $('btn-save').addEventListener('click', save);
  $('btn-test').addEventListener('click', () => {
    const errs = CS.validate(design).errors;
    if (errs.length && !confirm('This level has problems it can’t be played with:\n\n' + errs.join('\n') + '\n\nSave and open it anyway?')) return;
    if (save()) window.open(`level${slotId}.html?test=1`, '_blank');
  });
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Throw away your version of this level and go back to the built-in starter?')) return;
    CS.reset(slotId); fillSlots(); loadSlot(slotId);
  });

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('btn-export').addEventListener('click', () => {
    if (dirty) save();
    download('desolate-apes-designs.json', JSON.stringify(CS.exportAll(), null, 1));
  });
  $('btn-defaults').addEventListener('click', () => {
    if (dirty) save();
    download('customdefaults.js', 'window.CUSTOM_DEFAULTS = ' + JSON.stringify(CS.exportAll()) + ';\n', 'text/javascript');
  });
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      let data;
      try { data = JSON.parse(t); } catch (err) { alert('That file isn’t valid JSON.'); return; }
      let n = 0;
      Object.keys(data).forEach((k) => {
        const id = parseInt(k, 10), d = data[k];
        if (CS.slotInfo(id) && d && Array.isArray(d.grid) && d.monster && Array.isArray(d.monster.parts)) { CS.save(id, d); n++; }
      });
      alert(`Imported ${n} design${n === 1 ? '' : 's'}.`);
      fillSlots(); loadSlot(slotId);
    });
    e.target.value = '';
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- start
  buildTools();
  fillSlots();
  fillCopyFrom();
  const fromHash = parseInt(location.hash.replace('#', ''), 10);
  loadSlot(CS.slotInfo(fromHash) ? fromHash : 4);
  requestAnimationFrame(previewLoop);
})();
