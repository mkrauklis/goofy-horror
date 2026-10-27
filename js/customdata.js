// The 18 designer slots (mini bosses 4/9/14/19/24/29 and levels 32-43): where they sit in the story, how a
// design is stored, validated and turned into the LEVEL object the engine
// (js/customgame.js) plays. Designs live in localStorage under
// goofy-horror-custom-<id> so a design made in editor.html is playable
// immediately; js/customdefaults.js supplies the built-in starter for any
// slot you haven't touched (window.CUSTOM_DEFAULTS[id]).
(function () {
  const KEY_PREFIX = 'goofy-horror-custom-';

  const CHAPTERS = [
    { n: 1, name: 'The Facility',  boss: 'Level 5 (the Ashen One)',        music: 'ashen',      surface: 'normal', floor: ['#4c4c53', '#525258', '#58585f', '#5e5e66', '#54545c', '#605f68'], wall: '#262629', wallTop: '#3a3a40', accent: '#3ddc84' },
    { n: 2, name: 'The Undercroft', boss: 'Level 10 (the Last Knight)',     music: 'knight',     surface: 'normal', floor: ['#302f34', '#343338', '#38373c', '#3c3b41', '#363539', '#3a393e'], wall: '#1d1c20', wallTop: '#2d2c33', accent: '#c9a94a' },
    { n: 3, name: 'The Frost',      boss: 'Level 15 (Frozen Mutation)',     music: 'mutation',   surface: 'snow',   floor: ['#58606c', '#5e6672', '#646c78', '#6a727e', '#5b636f', '#687080'], wall: '#2a323c', wallTop: '#46515e', accent: '#8fd8ff' },
    { n: 4, name: 'The Flood',      boss: 'Level 20 (the Cistern)',         music: 'cistern',    surface: 'water',  floor: ['#27363b', '#2b3b40', '#2f4045', '#33444a', '#2a393e', '#314248'], wall: '#1a2226', wallTop: '#2b3a40', accent: '#4fd0c0' },
    { n: 5, name: 'The Overgrowth', boss: 'Level 25 (the Cultivator)',      music: 'cultivator', surface: 'grass',  floor: ['#33421f', '#3c4d24', '#2c391a', '#445a28', '#38481f', '#40532a'], wall: '#1d2614', wallTop: '#2e3d1d', accent: '#9be04a' },
    { n: 6, name: 'The Rooftops',   boss: 'Level 30 (the Garguantuagoyle)', music: 'gargoyle',   surface: 'normal', floor: ['#3b3b44', '#40404a', '#454550', '#4a4a56', '#3e3e48', '#484853'], wall: '#1c1c22', wallTop: '#30303a', accent: '#ff9a4a' },
  ];

  // The designer slots: per chapter, the mini boss that replaced the chapter's
  // 4th level (ids 4, 9, 14, 19, 24, 29) and two levels after it (ids 32-43).
  const SLOTS = [];
  for (let c = 1; c <= 6; c++) {
    SLOTS.push({ id: c * 5 - 1, chapter: c, role: 'M', kind: 'miniboss' });
    SLOTS.push({ id: 32 + (c - 1) * 2, chapter: c, role: 'A', kind: 'level' });
    SLOTS.push({ id: 33 + (c - 1) * 2, chapter: c, role: 'B', kind: 'level' });
  }
  const slotInfo = (id) => SLOTS.find((s) => s.id === id) || null;
  const chapterInfo = (c) => CHAPTERS[c - 1];

  // Grid legend (editor + engine):
  //  # wall   . floor   S safe room (monsters can't enter)   D door (shut until every key is taken / the boss falls)
  //  K key    X exit    1 / 2 player spawns   M monster spawn (several allowed)
  //  P patrol point (stalkers/listeners walk these in order of placement; none = they roam)
  //  B bomb spawn (mini boss: where bombs appear)   L lava (walking on it burns you to death)
  const SPECIAL = '12MPBKX';

  function blankGrid(cols, rows) {
    const g = [];
    for (let y = 0; y < rows; y++) {
      let row = '';
      for (let x = 0; x < cols; x++) row += (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) ? '#' : '.';
      g.push(row);
    }
    return g;
  }

  function blank(id) {
    const info = slotInfo(id);
    const kind = info ? info.kind : 'level';
    const cols = kind === 'miniboss' ? 30 : 40, rows = kind === 'miniboss' ? 20 : 30;
    const grid = blankGrid(cols, rows).map((r) => r.split(''));
    grid[2][2] = '1'; grid[2][3] = '2';
    for (let y = 1; y <= 4; y++) for (let x = 1; x <= 5; x++) if (grid[y][x] === '.') grid[y][x] = 'S';
    grid[rows - 3][cols - 3] = 'X';
    grid[Math.floor(rows / 2)][Math.floor(cols / 2)] = 'M';
    return {
      v: 1, id, kind,
      title: 'Untitled ' + (kind === 'miniboss' ? 'Mini Boss' : 'Level'),
      blurb: 'Designed by you.',
      grid: grid.map((r) => r.join('')),
      monster: window.CustomMonster.defaultMonster(kind),
    };
  }

  function readStored(id) {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + id);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Array.isArray(d.grid) && d.monster) return d;
      }
    } catch (e) { /* corrupt or blocked storage -- fall through to the starter */ }
    return null;
  }

  function get(id) {
    const stored = readStored(id);
    if (stored) return stored;
    const def = window.CUSTOM_DEFAULTS && window.CUSTOM_DEFAULTS[id];
    if (def) return JSON.parse(JSON.stringify(def));
    return blank(id);
  }

  function isCustomized(id) { return !!readStored(id); }

  function save(id, design) {
    design.id = id;
    try { localStorage.setItem(KEY_PREFIX + id, JSON.stringify(design)); return true; } catch (e) { return false; }
  }

  function reset(id) {
    try { localStorage.removeItem(KEY_PREFIX + id); } catch (e) { /* ignore */ }
  }

  function exportAll() {
    const out = {};
    SLOTS.forEach((s) => { out[s.id] = get(s.id); });
    return out;
  }

  // ---- parsing a design into what the engine plays ----
  function levelFromDesign(design) {
    const rows = design.grid.length;
    const cols = Math.max(...design.grid.map((r) => r.length));
    const grid = [];
    const L = {
      tileSize: 32, cols, rows, grid,
      spawn1: null, spawn2: null, monsterSpawns: [], patrolPoints: [], bombSpawns: [], keys: [], exits: [], doors: [],
    };
    for (let y = 0; y < rows; y++) {
      let row = '';
      for (let x = 0; x < cols; x++) {
        const ch = design.grid[y][x] || '#';
        let out = ch;
        if (ch === '1') { L.spawn1 = { x, y }; out = 'S'; }
        else if (ch === '2') { L.spawn2 = { x, y }; out = 'S'; }
        else if (ch === 'M') { L.monsterSpawns.push({ x, y }); out = '.'; }
        else if (ch === 'P') { L.patrolPoints.push({ x, y }); out = '.'; }
        else if (ch === 'B') { L.bombSpawns.push({ x, y }); out = '.'; }
        else if (ch === 'K') { L.keys.push({ x, y }); out = '.'; }
        else if (ch === 'X') { L.exits.push({ x, y }); out = '.'; }
        else if (ch === 'D') { L.doors.push({ x, y }); }
        else if (ch !== '#' && ch !== '.' && ch !== 'S' && ch !== 'L') out = '.';
        row += out;
      }
      grid.push(row);
    }
    if (!L.spawn2) L.spawn2 = L.spawn1;
    L.exitTrigger = L.exits[0] || null;
    return L;
  }

  // Returns { errors: [], warnings: [] } -- errors make the level unplayable.
  function validate(design) {
    const errors = [], warnings = [];
    const L = levelFromDesign(design);
    if (!L.spawn1) errors.push('Place player 1’s spawn (1).');
    if (!L.exits.length) errors.push('Place an exit (X).');
    if (!L.monsterSpawns.length) errors.push('Place at least one monster spawn (M).');
    if (design.kind === 'miniboss' && !design.monster.boss) errors.push('Mini boss levels need boss settings.');
    if (!errors.length) {
      // reachability: flood fill from spawn 1 through everything except walls
      // (a door only matters once opened, so treat it as passable)
      const seen = new Uint8Array(L.cols * L.rows);
      const q = [L.spawn1.x + L.spawn1.y * L.cols];
      seen[q[0]] = 1;
      for (let qi = 0; qi < q.length; qi++) {
        const cx = q[qi] % L.cols, cy = (q[qi] / L.cols) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) return;
          const i = nx + ny * L.cols;
          if (seen[i] || L.grid[ny][nx] === '#' || L.grid[ny][nx] === 'L') return; // lava kills, so it can't be walked through
          seen[i] = 1; q.push(i);
        });
      }
      const reach = (t) => seen[t.x + t.y * L.cols];
      if (!L.exits.some(reach)) errors.push('The exit can’t be reached from the spawn.');
      if (L.spawn2 && !reach(L.spawn2)) errors.push('Player 2’s spawn can’t reach player 1’s.');
      if (L.keys.some((k) => !reach(k))) errors.push('A key can’t be reached from the spawn.');
      if (L.monsterSpawns.some((m) => !reach(m))) warnings.push('A monster spawn is cut off from the players.');
      if (design.kind === 'level' && !L.keys.length) warnings.push('No keys placed, so the exit is open from the start.');
      if (design.kind === 'miniboss' && !L.doors.length) warnings.push('No door (D) placed, so the exit is open from the start; put one in front of the exit to lock it until the boss falls.');
      if (design.kind === 'miniboss' && !L.bombSpawns.length) warnings.push('No bomb spawns (B): bombs will appear on random floor tiles.');
    }
    return { errors, warnings };
  }

  window.CustomStore = {
    SLOTS, CHAPTERS, SPECIAL, slotInfo, chapterInfo,
    blank, blankGrid, get, save, reset, isCustomized, exportAll, levelFromDesign, validate,
  };
})();
