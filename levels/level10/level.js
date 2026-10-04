(function () {
  // Legend: # wall, . floor, T dirt (decorative only), D door (2
  // tiles tall, blocks until the boss is defeated), E exit alcove floor,
  // X exit trigger. The single-tile notches in the outer wall used to be
  // vent safe-zones (a 'V' tile the boss couldn't enter); removed on
  // direct request, so they're now just plain floor.
  //
  // A plain rectangular arena, a little bigger than Level 5's (40x22 vs
  // 34x20), with the whole thing visible on screen at once -- see game10.js's
  // ZOOM, chosen to fit the full arena rather than following the players.
  const grid = [
    '##########.#########.###################',
    '#..............................#########',
    '#.....T.............T...T......#########',
    '#.T.T.............T...T........#########',
    '#.T.....TT........T....T....TT.#########',
    '#...T..T..T.T....T.....T....T..#########',
    '..T...........T..............T.#########',
    '#......T.......................#########',
    '#...T..T.T..T...T.T.........T..#EEEEEEE#',
    '#..T....TT.........T...........#EEEEEEE#',
    '#.T..T...T................TT.T.DEEEXEEE#',
    '#.....T...T....................DEEEEEEE#',
    '#......T.................T.....#EEEEEEE#',
    '#....T...................T.....#EEEEEEE#',
    '#....T............T....TT.T.T..#########',
    '........T....T...T..T.....T....#########',
    '#....T.....T...........T.......#########',
    '#.TT.......T......TTT..........#########',
    '#................T....TT..T....#########',
    '#...T.T....T....TT......T..T...#########',
    '#..............................#########',
    '########.#############.#################',
  ];

  window.LEVEL10 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 3, y: 3 },
    spawn2: { x: 5, y: 3 },
    monsterSpawns: [{ x: 15, y: 10 }],
    exitTrigger: { x: 35, y: 10 },
    crateSpawns: [
      { x: 27, y: 2 }, { x: 1, y: 6 }, { x: 2, y: 3 }, { x: 17, y: 17 }, { x: 12, y: 18 },
      { x: 9, y: 19 }, { x: 28, y: 6 }, { x: 24, y: 17 }, { x: 6, y: 10 }, { x: 2, y: 20 },
    ],
    corpseSpawns: [
      { x: 23, y: 4, angle: 1.1 }, { x: 16, y: 15, angle: 2.4 },
    ],
  };
})();
