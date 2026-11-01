// Detailed floor tiles, shared by every level's renderer.
//
// Each level already picks a flat base colour per floor tile (its `floorShade(x, y)`), which is what gives it
// its palette. This module keeps that colour and bakes real detail over it: seams, bevels, rivets, grit,
// cracks, stains, grass, frost, embers, ripples ... whatever suits the level (see STYLE_BY_PAGE). Tiles are
// baked once into small canvases (a few variants per colour, chosen by hashing the tile's coordinates) and then
// just drawn with drawImage, so it is no slower than the flat fills it replaces.
//
// Hooking in: a level's floorShade() reports its colours through FloorTex.mark(colour), and where it fills a
// tile it calls FloorTex.tile(g, colour, x, y, px, py, TILE) first, falling back to the flat fill if that
// returns false (colour not a floor colour, or this script absent).
(function () {
  const VARIANTS = 10;
  const cache = new Map(), floorColors = new Set();
  const TAU = Math.PI * 2;

  // ---------- which look each page gets ----------
  const STYLE_BY_PAGE = {
    level1: 'plate', level2: 'plate', level3: 'rubble', level4: 'overgrown', level5: 'ash', level6: 'stone',
    level7: 'rock', level8: 'vault', level9: 'dirt', level10: 'stone', level11: 'ice', level12: 'mutant',
    level13: 'hive', level14: 'thaw', level15: 'thaw', level16: 'water', level17: 'water', level18: 'water',
    level19: 'water', level20: 'water', level21: 'overgrown', level22: 'greenhouse', level23: 'stone',
    level24: 'grating', level25: 'spore', level26: 'roof', level27: 'concrete', level28: 'concrete',
    level29: 'grass', level30: 'tarmac', level31: 'plate', level31hard: 'plate',
    halloween1: 'candy', halloween2: 'tile', halloween3: 'grating', halloween4: 'overgrown', halloween5: 'stone',
    season2level1: 'overgrown', season2level2: 'grass', mentalchallenge: 'plate', leprechaunfield: 'grass',
  };
  const page = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '');
  let STYLE = window.FLOOR_STYLE || STYLE_BY_PAGE[page] || 'plate';

  // ---------- small helpers ----------
  function parse(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (c, t, a) => [c[0] + (t[0] - c[0]) * a, c[1] + (t[1] - c[1]) * a, c[2] + (t[2] - c[2]) * a];
  const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
  function rngFor(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ---------- layers: each draws one kind of detail onto a tile ----------
  // E = { g, T, u (T/32), r (rng), c (base rgb) }
  const L = {
    bevel(E, o) {                                                   // lit top/left edge, shaded bottom/right, seam round the outside
      const { g, T, u, c } = E;
      g.fillStyle = rgba(WHITE, o.light); g.fillRect(0, 0, T, u * 1.2); g.fillRect(0, 0, u * 1.2, T);
      g.fillStyle = rgba(BLACK, o.dark); g.fillRect(0, T - u * 1.4, T, u * 1.4); g.fillRect(T - u * 1.4, 0, u * 1.4, T);
      g.strokeStyle = o.groutLight ? rgba(mix(c, WHITE, 0.35), o.seam) : rgba(BLACK, o.seam); g.lineWidth = u * 1.4;
      g.strokeRect(u * 0.7, u * 0.7, T - u * 1.4, T - u * 1.4);
    },
    panel(E, o) {                                                   // an embossed inset panel
      const { g, T, u, c } = E, i = (o.inset || 5) * u;
      g.fillStyle = rgba(BLACK, o.fill || 0.08); g.fillRect(i, i, T - 2 * i, T - 2 * i);
      g.strokeStyle = rgba(BLACK, 0.4); g.lineWidth = u; g.strokeRect(i, i, T - 2 * i, T - 2 * i);
      g.strokeStyle = rgba(mix(c, WHITE, 0.5), 0.16); g.beginPath(); g.moveTo(i + u, T - i); g.lineTo(i + u, i + u); g.lineTo(T - i, i + u); g.stroke();
    },
    noise(E, o) {                                                   // grit: light and dark specks
      const { g, u, T, r, c } = E;
      for (let k = 0; k < o.n; k++) {
        const s = u * (0.5 + r() * (o.size || 1.1)), x = r() * T, y = r() * T, light = r() < (o.lightBias == null ? 0.5 : o.lightBias);
        g.fillStyle = rgba(light ? mix(c, WHITE, 0.6) : BLACK, o.a * (0.4 + r() * 0.8)); g.fillRect(x, y, s, s);
      }
    },
    speckle(E, o) {                                                 // coloured specks (ore, flecks, aggregate)
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) { g.fillStyle = rgba(pick(r, o.colors), o.a * (0.5 + r() * 0.7)); const s = u * (0.6 + r() * 1.1); g.fillRect(r() * T, r() * T, s, s); }
    },
    scratches(E, o) {
      const { g, u, T, r, c } = E;
      for (let k = 0; k < o.n; k++) {
        const x = r() * T, y = r() * T, a = (o.angle || 0.5) + (r() - 0.5) * 0.5, l = u * (3 + r() * 7);
        g.strokeStyle = rgba(r() < 0.6 ? mix(c, WHITE, 0.7) : BLACK, o.a); g.lineWidth = u * 0.7;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
    },
    cracks(E, o) {                                                  // meandering cracks, with a lit lip beside each
      const { g, u, T, r, c } = E;
      if (r() > o.p) return;
      const n = 1 + Math.floor(r() * (o.n || 2));
      for (let k = 0; k < n; k++) {
        let x = r() < 0.5 ? 0 : r() * T, y = x === 0 ? r() * T : 0, a = (r() * 0.9 + 0.3) * (x === 0 ? 1 : 1.6);
        const pts = [[x, y]];
        for (let s = 0; s < 7; s++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * u * (3 + r() * 3); y += Math.sin(a) * u * (3 + r() * 3); pts.push([x, y]); }
        const stroke = (dx, dy, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy))); g.stroke(); };
        if (o.glow) stroke(0, 0, rgba(o.glow, 0.22), u * 3);
        stroke(0, 0, o.glow ? rgba(mix(o.glow, WHITE, 0.4), 0.9) : rgba(o.color || BLACK, o.a || 0.6), u * (o.glow ? 0.9 : 0.9));
        if (!o.glow) stroke(u * 0.9, u * 0.6, rgba(mix(c, WHITE, 0.6), 0.14), u * 0.7);
      }
    },
    stain(E, o) {
      const { g, u, T, r } = E;
      if (r() > o.p) return;
      const n = 1 + Math.floor(r() * (o.n || 1));
      for (let k = 0; k < n; k++) {
        const x = r() * T, y = r() * T, rad = u * (o.min || 4) + r() * u * (o.max || 9), col = pick(r, o.colors);
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, rgba(col, o.a)); gr.addColorStop(0.65, rgba(col, o.a * 0.45)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    },
    rivets(E, o) {
      const { g, T, u, c } = E, m = (o.inset || 4) * u;
      [[m, m], [T - m, m], [m, T - m], [T - m, T - m]].forEach(([x, y]) => {
        g.fillStyle = rgba(BLACK, 0.45); g.beginPath(); g.arc(x + u * 0.5, y + u * 0.6, u * 1.5, 0, TAU); g.fill();
        g.fillStyle = rgba(mix(c, WHITE, 0.4), 0.55); g.beginPath(); g.arc(x, y, u * 1.4, 0, TAU); g.fill();
        g.fillStyle = rgba(WHITE, 0.4); g.beginPath(); g.arc(x - u * 0.45, y - u * 0.5, u * 0.5, 0, TAU); g.fill();
      });
    },
    grate(E, o) {                                                   // a drain or vent grate set into the floor
      const { g, T, u, r, c } = E;
      if (r() > o.p) return;
      const i = 5 * u, w = T - 2 * i;
      g.fillStyle = rgba(BLACK, 0.75); g.fillRect(i, i, w, w);
      g.fillStyle = rgba(mix(c, WHITE, 0.3), 0.55);
      for (let k = 0; k < 5; k++) g.fillRect(i + u * 1.2, i + u * 1.5 + k * (w - 3 * u) / 5, w - u * 2.4, u * 1.5);
      g.strokeStyle = rgba(mix(c, WHITE, 0.5), 0.55); g.lineWidth = u * 1.2; g.strokeRect(i, i, w, w);
    },
    studs(E, o) {                                                   // diamond-plate studs
      const { g, T, u, c } = E;
      [[8, 8, 0], [24, 8, 1], [8, 24, 1], [24, 24, 0]].forEach(([cx, cy, rot]) => {
        g.save(); g.translate(cx * u, cy * u); g.rotate(rot ? -0.78 : 0.78);
        g.fillStyle = rgba(BLACK, 0.4); g.fillRect(-u * 3.6, -u * 0.9 + u * 0.8, u * 7.2, u * 1.8);
        g.fillStyle = rgba(mix(c, WHITE, 0.45), o.a || 0.5); g.fillRect(-u * 3.6, -u * 0.9, u * 7.2, u * 1.8);
        g.restore();
      });
    },
    slots(E, o) {                                                   // long slotted grating
      const { g, T, u } = E, n = o.n || 4, h = (T - 4 * u) / n;
      for (let k = 0; k < n; k++) {
        const y = 2 * u + k * h + u;
        g.fillStyle = rgba(BLACK, 0.7); g.fillRect(4 * u, y, T - 8 * u, h - 2.4 * u);
        g.fillStyle = rgba(WHITE, 0.12); g.fillRect(4 * u, y + h - 2.4 * u, T - 8 * u, u * 0.8);
      }
    },
    pebbles(E, o) {
      const { g, u, T, r, c } = E;
      for (let k = 0; k < o.n; k++) {
        const x = 3 * u + r() * (T - 6 * u), y = 3 * u + r() * (T - 6 * u), rx = u * (o.min || 0.9) + r() * u * (o.max || 1.6), ry = rx * (0.65 + r() * 0.3), rot = r() * 3;
        g.fillStyle = rgba(BLACK, 0.4); g.beginPath(); g.ellipse(x + u * 0.5, y + u * 0.6, rx, ry, rot, 0, TAU); g.fill();
        g.fillStyle = rgba(o.tint ? mix(c, o.tint, 0.45) : mix(c, r() < 0.5 ? WHITE : BLACK, 0.2 + r() * 0.2), 0.95); g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
        g.fillStyle = rgba(WHITE, 0.2); g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.4, ry * 0.3, rot, 0, TAU); g.fill();
      }
    },
    blotch(E, o) {                                                  // clustered patches of moss, mould, spores
      const { g, u, T, r } = E;
      if (r() > (o.p == null ? 1 : o.p)) return;
      for (let k = 0; k < o.n; k++) {
        const cx = r() * T, cy = r() * T, col = pick(r, o.colors), m = 3 + Math.floor(r() * 4);
        for (let j = 0; j < m; j++) { g.fillStyle = rgba(col, o.a * (0.6 + r() * 0.6)); g.beginPath(); g.arc(cx + (r() - 0.5) * 6 * u, cy + (r() - 0.5) * 5 * u, u * (0.9 + r() * 2), 0, TAU); g.fill(); }
      }
    },
    tufts(E, o) {
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) {
        const x = 2 * u + r() * (T - 4 * u), y = 4 * u + r() * (T - 5 * u), blades = 3 + Math.floor(r() * 4), col = pick(r, o.colors);
        for (let b = 0; b < blades; b++) {
          const a = -Math.PI / 2 + (b / (blades - 1 || 1) - 0.5) * 1.5 + (r() - 0.5) * 0.3, l = u * (2.6 + r() * 3.2);
          g.strokeStyle = rgba(r() < 0.3 ? mix(col, WHITE, 0.3) : col, 0.95); g.lineWidth = u * 0.9;
          g.beginPath(); g.moveTo(x + (b - blades / 2) * u * 0.5, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l + (r() - 0.5) * u, y + Math.sin(a) * l); g.stroke();
        }
      }
    },
    flowers(E, o) {
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) {
        if (r() > o.p) continue;
        const x = 2 * u + r() * (T - 4 * u), y = 2 * u + r() * (T - 4 * u);
        g.fillStyle = rgba(pick(r, o.colors), 0.95); for (let q = 0; q < 4; q++) { g.beginPath(); g.arc(x + Math.cos(q * 1.57) * u * 0.9, y + Math.sin(q * 1.57) * u * 0.9, u * 0.8, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(255,220,80,0.95)'; g.beginPath(); g.arc(x, y, u * 0.7, 0, TAU); g.fill();
      }
    },
    puddle(E, o) {
      const { g, u, T, r } = E;
      if (r() > o.p) return;
      const x = 8 * u + r() * (T - 16 * u), y = 8 * u + r() * (T - 16 * u), rx = u * (5 + r() * 5), ry = rx * (0.45 + r() * 0.25);
      g.fillStyle = rgba(BLACK, 0.3); g.beginPath(); g.ellipse(x, y + u * 0.5, rx + u * 0.6, ry + u * 0.6, 0, 0, TAU); g.fill();
      g.fillStyle = rgba(o.color, o.a); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba(WHITE, 0.35); g.lineWidth = u * 0.8; g.beginPath(); g.ellipse(x, y, rx * 0.7, ry * 0.65, 0, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    },
    ripples(E, o) {
      const { g, u, T, r, c } = E;
      for (let k = 0; k < o.n; k++) {
        const x = r() * T, y = r() * T, rx = u * (3 + r() * 6);
        g.strokeStyle = rgba(mix(c, WHITE, 0.55), o.a * (0.5 + r() * 0.7)); g.lineWidth = u * 0.8;
        g.beginPath(); g.ellipse(x, y, rx, rx * 0.4, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }
    },
    caustics(E, o) {                                                // frozen light wobble on a flooded floor
      const { g, u, T, r, c } = E;
      for (let k = 0; k < o.n; k++) {
        let x = r() * T, y = r() * T; g.strokeStyle = rgba(mix(c, [190, 255, 245], 0.65), o.a); g.lineWidth = u * 1.1;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 4; s++) { x += u * (2 + r() * 3); y += (r() - 0.5) * u * 5; g.lineTo(x, y); }
        g.stroke();
      }
    },
    frost(E, o) {
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) {
        const x = r() * T, y = r() * T, l = u * (1.6 + r() * 2.6);
        g.strokeStyle = rgba(WHITE, 0.4 + r() * 0.35); g.lineWidth = u * 0.7; g.beginPath();
        for (let q = 0; q < 3; q++) { const a = q * 1.0472 + r() * 0.2; g.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
        g.stroke();
      }
    },
    sparkle(E, o) {
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) {
        if (r() > o.p) continue;
        const x = 2 * u + r() * (T - 4 * u), y = 2 * u + r() * (T - 4 * u), l = u * (0.8 + r() * 1.1), col = o.color;
        g.fillStyle = rgba(col, 0.25); g.beginPath(); g.arc(x, y, l * 1.5, 0, TAU); g.fill();
        g.strokeStyle = rgba(mix(col, WHITE, 0.6), 0.95); g.lineWidth = u * 0.6; g.beginPath(); g.moveTo(x - l, y); g.lineTo(x + l, y); g.moveTo(x, y - l); g.lineTo(x, y + l); g.stroke();
      }
    },
    sheen(E, o) {
      const { g, T } = E, gr = g.createLinearGradient(0, 0, T, T);
      gr.addColorStop(0, rgba(WHITE, 0)); gr.addColorStop(0.45, rgba(WHITE, o.a)); gr.addColorStop(0.6, rgba(WHITE, 0)); gr.addColorStop(1, rgba(WHITE, 0));
      g.fillStyle = gr; g.fillRect(0, 0, T, T);
    },
    veins(E, o) {                                                   // organic, wet-looking veins and pores
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) {
        const x0 = r() * T, y0 = r() * T, x1 = x0 + (r() - 0.5) * u * 22, y1 = y0 + (r() - 0.5) * u * 22, col = pick(r, o.colors), qx = (x0 + x1) / 2 + (r() - 0.5) * u * 12, qy = (y0 + y1) / 2 + (r() - 0.5) * u * 12;
        g.strokeStyle = rgba(BLACK, 0.3); g.lineWidth = u * 1.9; g.beginPath(); g.moveTo(x0, y0 + u * 0.5); g.quadraticCurveTo(qx, qy, x1, y1 + u * 0.5); g.stroke();
        g.strokeStyle = rgba(col, o.a); g.lineWidth = u * 1.3; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(qx, qy, x1, y1); g.stroke();
      }
      for (let k = 0; k < (o.pores || 0); k++) {
        const x = r() * T, y = r() * T, rad = u * (0.8 + r() * 1.3);
        g.fillStyle = rgba(BLACK, 0.5); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
        g.fillStyle = rgba(o.colors[0], 0.55); g.beginPath(); g.arc(x - u * 0.3, y - u * 0.3, rad * 0.5, 0, TAU); g.fill();
      }
    },
    sprinkles(E, o) {
      const { g, u, T, r } = E;
      for (let k = 0; k < o.n; k++) {
        g.save(); g.translate(r() * T, r() * T); g.rotate(r() * 3.14); g.fillStyle = rgba(pick(r, o.colors), 0.95); g.fillRect(-u * 1.5, -u * 0.5, u * 3, u);
        g.restore();
      }
    },
    mark(E, o) {                                                    // worn painted line
      const { g, u, T, r } = E;
      if (r() > o.p) return;
      const horiz = r() < 0.5; g.strokeStyle = rgba(o.color, o.a); g.lineWidth = u * 2.2; g.setLineDash([u * 7, u * 4]);
      g.beginPath(); if (horiz) { g.moveTo(0, T * 0.5); g.lineTo(T, T * 0.5); } else { g.moveTo(T * 0.5, 0); g.lineTo(T * 0.5, T); } g.stroke(); g.setLineDash([]);
      for (let k = 0; k < 16; k++) { g.fillStyle = rgba(E.c, 0.85); g.fillRect(r() * T, r() * T, u * 1.6, u * 1.6); }   // worn away in places
    },
  };

  // ---------- the looks ----------
  const RUST = [[90, 50, 22], [60, 40, 25]], OIL = [[10, 10, 12], [18, 14, 10]], DAMP = [[10, 14, 18], [20, 26, 22]];
  const GREENS = [[52, 110, 48], [70, 130, 52], [38, 90, 44], [90, 145, 60]];
  const STYLES = {
    plate: [['bevel', { light: 0.1, dark: 0.3, seam: 0.45 }], ['noise', { n: 26, a: 0.11 }], ['rivets', {}], ['scratches', { n: 4, a: 0.14 }],
      ['stain', { p: 0.22, colors: RUST, a: 0.2 }], ['stain', { p: 0.18, colors: OIL, a: 0.3, n: 2 }], ['grate', { p: 0.04 }]],
    vault: [['bevel', { light: 0.12, dark: 0.34, seam: 0.55 }], ['panel', { inset: 5 }], ['rivets', { inset: 3 }], ['noise', { n: 18, a: 0.1 }],
      ['scratches', { n: 5, a: 0.15 }], ['stain', { p: 0.15, colors: OIL, a: 0.3 }], ['grate', { p: 0.04 }]],
    grating: [['bevel', { light: 0.08, dark: 0.3, seam: 0.5 }], ['studs', { a: 0.5 }], ['rivets', { inset: 3 }], ['noise', { n: 16, a: 0.09 }],
      ['stain', { p: 0.3, colors: OIL, a: 0.32, n: 2 }], ['scratches', { n: 3, a: 0.16 }]],
    concrete: [['bevel', { light: 0.05, dark: 0.18, seam: 0.3 }], ['noise', { n: 60, a: 0.12, size: 1.3 }], ['speckle', { n: 10, a: 0.4, colors: [[190, 185, 170], [70, 65, 60]] }],
      ['cracks', { p: 0.4, n: 2, a: 0.55 }], ['stain', { p: 0.35, colors: OIL, a: 0.22, max: 10 }], ['pebbles', { n: 2, min: 0.5, max: 0.8 }]],
    tarmac: [['noise', { n: 90, a: 0.14, size: 1.2 }], ['speckle', { n: 14, a: 0.35, colors: [[200, 200, 195], [60, 60, 66]] }], ['mark', { p: 0.08, color: [220, 190, 50], a: 0.55 }],
      ['cracks', { p: 0.45, n: 2, a: 0.7 }], ['stain', { p: 0.4, colors: OIL, a: 0.3, max: 11 }], ['bevel', { light: 0.02, dark: 0.12, seam: 0.12 }]],
    roof: [['noise', { n: 100, a: 0.17, size: 1.5 }], ['pebbles', { n: 12, min: 0.5, max: 1.0 }], ['stain', { p: 0.4, colors: OIL, a: 0.28, max: 11 }],
      ['cracks', { p: 0.3, n: 1, a: 0.6 }], ['bevel', { light: 0.03, dark: 0.15, seam: 0.2 }]],
    stone: [['bevel', { light: 0.1, dark: 0.32, seam: 0.55 }], ['noise', { n: 34, a: 0.12 }], ['cracks', { p: 0.55, n: 2, a: 0.65 }], ['pebbles', { n: 2, min: 0.5, max: 1.0 }],
      ['blotch', { p: 0.28, n: 1, a: 0.28, colors: [[40, 80, 44], [58, 96, 52]] }], ['stain', { p: 0.2, colors: DAMP, a: 0.28 }], ['scratches', { n: 2, a: 0.12 }]],
    rubble: [['noise', { n: 70, a: 0.15 }], ['pebbles', { n: 8, min: 0.8, max: 1.8 }], ['cracks', { p: 0.55, n: 2, a: 0.7 }], ['stain', { p: 0.3, colors: DAMP, a: 0.3, max: 11 }],
      ['bevel', { light: 0.04, dark: 0.18, seam: 0.2 }], ['speckle', { n: 6, a: 0.4, colors: [[120, 100, 150], [60, 50, 80]] }]],
    dirt: [['noise', { n: 80, a: 0.17, size: 1.4 }], ['pebbles', { n: 7, min: 0.7, max: 1.6, tint: [120, 100, 80] }], ['cracks', { p: 0.4, n: 2, a: 0.6 }],
      ['stain', { p: 0.4, colors: [[40, 26, 14], [58, 42, 26]], a: 0.28, max: 12 }], ['tufts', { n: 1, colors: [[110, 100, 50], [90, 84, 40]] }], ['bevel', { light: 0.02, dark: 0.1, seam: 0.1 }]],
    rock: [['noise', { n: 70, a: 0.15, size: 1.5 }], ['pebbles', { n: 6, min: 1, max: 2.2 }], ['cracks', { p: 0.6, n: 2, a: 0.75 }],
      ['sparkle', { n: 2, p: 0.16, color: [230, 190, 80] }], ['stain', { p: 0.3, colors: DAMP, a: 0.28, max: 11 }], ['bevel', { light: 0.05, dark: 0.22, seam: 0.3 }]],
    ash: [['noise', { n: 70, a: 0.16, lightBias: 0.3 }], ['cracks', { p: 0.7, n: 3, glow: [255, 110, 30] }], ['stain', { p: 0.55, colors: [[0, 0, 0]], a: 0.45, max: 12 }],
      ['pebbles', { n: 4, min: 0.6, max: 1.3 }], ['sparkle', { n: 4, p: 0.18, color: [255, 140, 40] }], ['bevel', { light: 0.03, dark: 0.2, seam: 0.25 }]],
    ice: [['bevel', { light: 0.16, dark: 0.18, seam: 0.2 }], ['sheen', { a: 0.12 }], ['cracks', { p: 0.65, n: 2, color: [225, 245, 255], a: 0.55 }], ['frost', { n: 5 }],
      ['noise', { n: 30, a: 0.1, lightBias: 0.8 }], ['sparkle', { n: 3, p: 0.35, color: [200, 235, 255] }], ['stain', { p: 0.25, colors: [[230, 245, 255]], a: 0.2 }]],
    thaw: [['bevel', { light: 0.12, dark: 0.22, seam: 0.3 }], ['sheen', { a: 0.08 }], ['cracks', { p: 0.55, n: 2, color: [225, 245, 255], a: 0.5 }], ['puddle', { p: 0.5, color: [70, 120, 160], a: 0.55 }],
      ['stain', { p: 0.35, colors: [[30, 24, 18], [40, 34, 26]], a: 0.3 }], ['pebbles', { n: 2, min: 0.6, max: 1.1 }], ['frost', { n: 2 }], ['noise', { n: 24, a: 0.1 }]],
    water: [['noise', { n: 30, a: 0.08, lightBias: 0.6 }], ['bevel', { light: 0.05, dark: 0.18, seam: 0.2 }], ['caustics', { n: 3, a: 0.13 }], ['ripples', { n: 3, a: 0.2 }],
      ['pebbles', { n: 3, min: 0.7, max: 1.4 }], ['stain', { p: 0.35, colors: [[0, 20, 30]], a: 0.25, max: 11 }]],
    overgrown: [['bevel', { light: 0.07, dark: 0.28, seam: 0.45 }], ['noise', { n: 24, a: 0.1 }], ['cracks', { p: 0.55, n: 2, a: 0.6 }], ['blotch', { n: 3, a: 0.5, colors: [[40, 90, 40], [60, 110, 46], [30, 70, 34]] }],
      ['tufts', { n: 3, colors: GREENS }], ['stain', { p: 0.2, colors: DAMP, a: 0.3 }], ['flowers', { n: 2, p: 0.1, colors: [[240, 240, 230], [235, 200, 70]] }]],
    greenhouse: [['bevel', { light: 0.1, dark: 0.26, seam: 0.45, groutLight: true }], ['sheen', { a: 0.08 }], ['noise', { n: 20, a: 0.09 }],
      ['stain', { p: 0.5, colors: [[50, 34, 20], [64, 44, 26]], a: 0.5, n: 2, max: 10 }], ['pebbles', { n: 3, min: 0.6, max: 1.2, tint: [110, 90, 70] }],
      ['tufts', { n: 2, colors: GREENS }], ['puddle', { p: 0.18, color: [60, 100, 90], a: 0.5 }], ['flowers', { n: 2, p: 0.15, colors: [[240, 120, 150], [240, 230, 120]] }]],
    spore: [['bevel', { light: 0.05, dark: 0.22, seam: 0.35 }], ['noise', { n: 30, a: 0.1 }], ['blotch', { n: 4, a: 0.45, colors: [[150, 170, 50], [110, 70, 140], [190, 160, 60]] }],
      ['veins', { n: 1, a: 0.5, colors: [[110, 150, 60], [140, 100, 160]], pores: 2 }], ['sparkle', { n: 5, p: 0.6, color: [220, 230, 90] }], ['cracks', { p: 0.3, n: 1, a: 0.55 }]],
    mutant: [['bevel', { light: 0.07, dark: 0.3, seam: 0.45 }], ['noise', { n: 20, a: 0.1 }], ['veins', { n: 2, a: 0.55, colors: [[150, 40, 70], [110, 40, 120]], pores: 2 }],
      ['stain', { p: 0.4, colors: [[100, 20, 40], [60, 20, 60]], a: 0.32, max: 11 }], ['scratches', { n: 2, a: 0.12 }], ['rivets', {}]],
    hive: [['noise', { n: 24, a: 0.1 }], ['veins', { n: 3, a: 0.55, colors: [[190, 130, 40], [150, 90, 30]], pores: 4 }], ['stain', { p: 0.5, colors: [[120, 80, 20], [60, 30, 10]], a: 0.35, max: 12 }],
      ['sparkle', { n: 2, p: 0.3, color: [255, 200, 90] }], ['bevel', { light: 0.05, dark: 0.22, seam: 0.3 }]],
    tile: [['bevel', { light: 0.14, dark: 0.16, seam: 0.5, groutLight: true }], ['sheen', { a: 0.1 }], ['noise', { n: 14, a: 0.08 }], ['scratches', { n: 4, a: 0.14 }],
      ['stain', { p: 0.22, colors: [[110, 30, 30], [60, 40, 30]], a: 0.26, max: 9 }], ['cracks', { p: 0.18, n: 1, a: 0.5 }]],
    candy: [['bevel', { light: 0.16, dark: 0.18, seam: 0.5, groutLight: true }], ['sheen', { a: 0.1 }], ['sprinkles', { n: 5, colors: [[240, 90, 140], [250, 220, 90], [100, 210, 230], [150, 230, 120], [250, 140, 50]] }],
      ['stain', { p: 0.35, colors: [[230, 80, 130], [120, 60, 30]], a: 0.28, max: 9 }], ['noise', { n: 14, a: 0.08 }], ['scratches', { n: 2, a: 0.12 }]],
    grass: [['noise', { n: 50, a: 0.13, size: 1.3 }], ['tufts', { n: 8, colors: GREENS }], ['flowers', { n: 3, p: 0.18, colors: [[250, 250, 240], [250, 220, 80], [240, 140, 190]] }],
      ['stain', { p: 0.3, colors: [[34, 56, 24], [24, 44, 20]], a: 0.35, max: 12 }], ['stain', { p: 0.12, colors: [[90, 66, 40]], a: 0.4, max: 8 }], ['pebbles', { n: 1, min: 0.6, max: 1.2 }]],
  };

  // ---------- baking ----------
  function bake(style, hex, variant, T) {
    const cv = document.createElement('canvas'); cv.width = cv.height = T;
    const g = cv.getContext('2d'), c = parse(hex), u = T / 32;
    g.fillStyle = hex; g.fillRect(0, 0, T, T);
    const E = { g, T, u, r: rngFor(strHash(style + hex) + variant * 7919), c };
    (STYLES[style] || STYLES.plate).forEach(([name, o]) => { g.save(); L[name](E, o); g.restore(); });
    return cv;
  }
  function tile(g, hex, x, y, px, py, T) {
    if (!floorColors.has(hex) || typeof hex !== 'string' || hex[0] !== '#' || hex.length !== 7) return false;
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263), v = ((h ^ (h >>> 13)) >>> 0) % VARIANTS;
    const key = STYLE + hex + v + T;
    let cv = cache.get(key);
    if (!cv) { cv = bake(STYLE, hex, v, T); cache.set(key, cv); }
    g.drawImage(cv, px, py);
    return true;
  }

  // For a renderer that picks its own look per tile (outdoor ground in Level 31): the given style, any colour.
  function tileAs(style, g, hex, x, y, px, py, T) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263), v = ((h ^ (h >>> 13)) >>> 0) % VARIANTS, key = style + hex + v + T;
    let cv = cache.get(key);
    if (!cv) { cv = bake(style, hex, v, T); cache.set(key, cv); }
    g.drawImage(cv, px, py, T + 0.5, T + 0.5);
  }

  window.FloorTex = { tileAs, mark(c) { floorColors.add(c); return c; }, tile, setStyle(s) { STYLE = s; }, STYLES };
})();
