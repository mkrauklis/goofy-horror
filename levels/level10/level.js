(function () {
  // Legend: # wall, . floor, T dirt (decorative only). The walls are three tiles
  // thick on every side so giant statues can be carved into them (see game10.js's
  // buildArenaDecor): the playable floor is x3-30, y3-18, with the red carpet
  // running down the middle to a throne set into the north wall. There is no
  // exit: the level is won the moment the boss dies.
  //
  // A plain rectangular arena with the whole thing visible on screen at once --
  // see game10.js's ZOOM, chosen to fit the full arena rather than following
  // the players.
  const grid = [
    '########################################',
    '########################################',
    '########################################',
    '###.T.............T...T........#########',
    '###.....TT........T....T....TT.#########',
    '###.T..T..T.T....T.....T....T..#########',
    '###...........T..............T.#########',
    '###....T.......................#########',
    '###.T..T.T..T...T.T.........T..#########',
    '###T....TT.........T...........#########',
    '###..T...T................TT.T.#########',
    '###...T...T....................#########',
    '###....T.................T.....#########',
    '###..T...................T.....#########',
    '###..T............T....TT.T.T..#########',
    '###.....T....T...T..T.....T....#########',
    '###..T.....T...........T.......#########',
    '###T.......T......TTT..........#########',
    '###..............T....TT..T....#########',
    '########################################',
    '########################################',
    '########################################',
  ];

  window.LEVEL10 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 3, y: 3 },
    spawn2: { x: 5, y: 3 },
    monsterSpawns: [{ x: 15, y: 10 }],
    crateSpawns: [
      { x: 27, y: 4 }, { x: 4, y: 7 }, { x: 3, y: 5 }, { x: 17, y: 17 }, { x: 12, y: 18 },
      { x: 9, y: 18 }, { x: 28, y: 6 }, { x: 24, y: 17 }, { x: 6, y: 10 }, { x: 5, y: 17 },
    ],
    corpseSpawns: [
      { x: 23, y: 4, angle: 1.1 }, { x: 16, y: 15, angle: 2.4 },
    ],
  };
})();
