(function () {
  // Legend: # wall, . floor, T dirt (missing floor tile, decorative),
  // D door (2 tiles wide; blocks players and the boss until it's defeated),
  // E exit alcove floor, X exit trigger.
  //
  // The arena was shrunk to 1/3 its old size (32x20, was 96x60) so the boss's
  // new attack set -- a bouncing spin dash, a straight-line charge -- has a room
  // small enough that it can actually reach every corner of it.
  const grid = [
    '################################',
    '#..........T................TTT#',
    '#.........TT...............TTTT#',
    '#.........TTT.....TT.T....TTT.T#',
    '#.........TT.T..TTTTT.....TTT..#',
    '#...........TT.TTTTTTT.....T...#',
    '#........TTTT....TT.......TT...#',
    '#.TT.TTTTTT.T..............T...#',
    '#T.TT.....TTT..................#',
    '#.TT.......TT..................#',
    '#..T...........................#',
    '#..............................#',
    '#..............................#',
    '#..........TT...........########',
    '#..........TT...T.......#EEEEE##',
    '#...T......T.TTTTTTTT...DEEXEE##',
    '#TTTT......T..TTTTT.....DEEEEE##',
    '#TTTTT......TTTTT.......#EEEEE##',
    '#....TT.................########',
    '################################',
  ];

  window.LEVEL5 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 3, y: 3 },
    spawn2: { x: 5, y: 3 },
    monsterSpawns: [{ x: 16, y: 10 }],
    exitTrigger: { x: 27, y: 15 },
    fireSpawns: [
      { x: 22, y: 11 }, { x: 27, y: 5 }, { x: 26, y: 8 }, { x: 27, y: 10 }, { x: 7, y: 17 }, { x: 9, y: 16 },
      { x: 8, y: 12 }, { x: 8, y: 9 }, { x: 13, y: 4 }, { x: 20, y: 10 }, { x: 1, y: 17 }, { x: 11, y: 12 },
      { x: 23, y: 8 }, { x: 17, y: 16 }, { x: 26, y: 3 }, { x: 11, y: 2 }, { x: 15, y: 7 }, { x: 22, y: 15 },
    ],
    crateSpawns: [
      { x: 22, y: 12 }, { x: 27, y: 2 }, { x: 19, y: 4 }, { x: 12, y: 13 }, { x: 1, y: 9 },
    ],
    corpseSpawns: [
      { x: 28, y: 9, angle: 3.58 },
      { x: 7, y: 10, angle: 1.93 },
      { x: 30, y: 3, angle: 1.33 },
    ],
  };
})();
