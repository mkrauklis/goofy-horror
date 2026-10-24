(function () {
  // Legend: # wall, . floor, T dirt (missing floor tile, decorative),
  // D door (blocks players and the boss until it's defeated),
  // E exit alcove floor, X exit trigger. The dead-end pockets punched into
  // the outer wall used to be vent safe-zones (a 'V' tile the boss couldn't
  // enter); removed on direct request, so they're now just plain floor.
  //
  // The arena was shrunk to 1/3 its old size (32x20, was 96x60) so the
  // boss's attack set had a room small enough to reach every corner, then
  // made 1.5x bigger again (48x30) on direct request -- generated from the
  // 32x20 layout by nearest-neighbour scaling, so the layout is the same
  // shape, just roomier. Every spawn point below was scaled the same way.
  const grid = [
    '#########..#############..#############..#######',
    '#########..#############..#############..#######',
    '##...............T........................TTTTT#',
    '##.............TTT.......................TTTTTT#',
    '##.............TTT.......................TTTTTT#',
    '##.............TTTTT.......TTT..T......TTTTT.TT#',
    '##.............TTT..T...TTTTTTTT.......TTTTT...#',
    '##.............TTT..T...TTTTTTTT.......TTTTT...#',
    '##................TTT..TTTTTTTTTT........T.....#',
    '..............TTTTTT......TTT..........TTT......',
    '..............TTTTTT......TTT..........TTT......',
    '##.TTT..TTTTTTTTT.TT.....................T.....#',
    '##T..TTT.......TTTTT...........................#',
    '##T..TTT.......TTTTT...........................#',
    '##.TTT...........TTT...........................#',
    '##...T.........................................#',
    '##...T.........................................#',
    '##.............................................#',
    '##.............................................#',
    '##.............................................#',
    '##...............TTT................############',
    '.................TTT....TT..........##EEEEEEE###',
    '.................TTT....TT..........##EEEEEEE###',
    '##....TT.........T..TTTTTTTTTTTT....DDEEEXEEE###',
    '##TTTTTT.........T...TTTTTTTT.......DDEEEEEEE###',
    '##TTTTTT.........T...TTTTTTTT.......DDEEEEEEE###',
    '##TTTTTTT.........TTTTTTTT..........##EEEEEEE###',
    '##......TTT.........................############',
    '##......TTT.........................############',
    '#########..#############..######################',
  ];

  window.LEVEL5 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 5, y: 5 },
    spawn2: { x: 8, y: 5 },
    monsterSpawns: [{ x: 24, y: 15 }],
    exitTrigger: { x: 41, y: 23 },
    fireSpawns: [
      { x: 33, y: 17 }, { x: 41, y: 8 }, { x: 39, y: 12 }, { x: 41, y: 15 }, { x: 11, y: 26 }, { x: 14, y: 24 },
      { x: 12, y: 18 }, { x: 12, y: 14 }, { x: 20, y: 6 }, { x: 30, y: 15 }, { x: 2, y: 26 }, { x: 17, y: 18 },
      { x: 35, y: 12 }, { x: 26, y: 24 }, { x: 39, y: 5 }, { x: 17, y: 3 }, { x: 23, y: 11 }, { x: 33, y: 23 },
    ],
    crateSpawns: [
      { x: 33, y: 18 }, { x: 41, y: 3 }, { x: 29, y: 6 }, { x: 18, y: 20 }, { x: 2, y: 14 },
    ],
    corpseSpawns: [
      { x: 42, y: 14, angle: 3.58 },
      { x: 11, y: 15, angle: 1.93 },
      { x: 45, y: 5, angle: 1.33 },
    ],
  };
})();
