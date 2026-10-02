(function () {
  // Legend: # wall, . floor, S safe zone (spawn), D door (blocks until all 3
  // dynamite sticks are found, then it's blown open), E exit room floor,
  // X exit trigger, ~ missing floor (a sand pit -- blocks the players,
  // the caterpillar crosses it freely), P boardwalk plank (the only way
  // across a ~ patch for the players).
  //
  // Rail tracks and the 20 stationary minecarts sitting on them aren't
  // stored in the grid -- LEVEL.rails (straight segments) and
  // LEVEL.minecarts (world positions, 3 flagged dynamite: true) below.
  const grid = [
    '############################################',
    '#SSSS.....##.........##.........##.........#',
    '#SSSS.....##.........##.........##.........#',
    '#SSSS.~P...........................~P......#',
    '#SSSS.~P...........................~P......#',
    '#.........##.........##.........##.........#',
    '#.........##.........##.........##.........#',
    '#.........##.........##.........##.........#',
    '####..#########..#########..#########..#####',
    '####..#########..#########..#########..#####',
    '#.........##.........##.........##.........#',
    '#.........##.........##.........##.........#',
    '#........................~P................#',
    '#........................~P................#',
    '#.........##.........##.........##.........#',
    '#.........##.........##.........##.........#',
    '#.........##.........##.........##.........#',
    '####..#########..#########..################',
    '####..#########..#########..################',
    '#.........##.........##.........##EEEEEEEEE#',
    '#.........##.........##.........##EEEEEEEEE#',
    '#............~~P................DDEEEEEEEEE#',
    '#............~~P................DDEEEEXEEEE#',
    '#.........##.........##.........##EEEEEEEEE#',
    '#.........##.........##.........##EEEEEEEEE#',
    '#.........##.........##.........##EEEEEEEEE#',
    '############################################',
  ];

  window.LEVEL9 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 2, y: 2 },
    spawn2: { x: 3, y: 2 },
    monsterSpawn: { x: 16, y: 13 },
    exitTrigger: { x: 38, y: 22 },
    safeZone: { x0: 1, y0: 1, x1: 4, y1: 4 },
    patrolPoints: [
      { x: 16, y: 2 }, { x: 27, y: 2 }, { x: 38, y: 2 }, { x: 5, y: 11 }, { x: 16, y: 11 }, { x: 27, y: 11 },
      { x: 38, y: 11 }, { x: 5, y: 20 }, { x: 16, y: 20 }, { x: 27, y: 20 },
    ],
    minecarts: [
      { x: 8, y: 16, dynamite: false }, { x: 24, y: 5, dynamite: false },
      { x: 20, y: 3, dynamite: false }, { x: 2, y: 21, dynamite: false },
      { x: 17, y: 19, dynamite: false }, { x: 14, y: 6, dynamite: false },
      { x: 19, y: 11, dynamite: false }, { x: 8, y: 21, dynamite: false },
      { x: 12, y: 16, dynamite: false }, { x: 17, y: 6, dynamite: false },
      { x: 27, y: 11, dynamite: true }, { x: 36, y: 13, dynamite: false },
      { x: 16, y: 13, dynamite: false }, { x: 20, y: 22, dynamite: false },
      { x: 30, y: 20, dynamite: true }, { x: 30, y: 16, dynamite: true },
      { x: 42, y: 2, dynamite: false }, { x: 28, y: 23, dynamite: false },
      { x: 29, y: 7, dynamite: false }, { x: 15, y: 3, dynamite: false },
    ],
    rails: [
      { a: 10, b: 11, cross: 4, horiz: true }, { a: 21, b: 22, cross: 4, horiz: true },
      { a: 32, b: 33, cross: 4, horiz: true }, { a: 10, b: 11, cross: 13, horiz: true },
      { a: 21, b: 22, cross: 13, horiz: true }, { a: 32, b: 33, cross: 13, horiz: true },
      { a: 10, b: 11, cross: 22, horiz: true }, { a: 21, b: 22, cross: 22, horiz: true },
      { a: 32, b: 33, cross: 22, horiz: true }, { a: 8, b: 9, cross: 5, horiz: false },
      { a: 17, b: 18, cross: 5, horiz: false }, { a: 8, b: 9, cross: 16, horiz: false },
      { a: 17, b: 18, cross: 16, horiz: false }, { a: 8, b: 9, cross: 27, horiz: false },
      { a: 17, b: 18, cross: 27, horiz: false }, { a: 8, b: 9, cross: 38, horiz: false },
    ],
    crateSpawns: [
      { x: 27, y: 13 }, { x: 14, y: 13 }, { x: 27, y: 20 }, { x: 23, y: 1 }, { x: 23, y: 22 }, { x: 36, y: 5 },
      { x: 5, y: 20 }, { x: 31, y: 7 }, { x: 17, y: 1 }, { x: 31, y: 3 }, { x: 1, y: 24 }, { x: 13, y: 24 },
      { x: 18, y: 7 }, { x: 27, y: 24 }, { x: 17, y: 20 }, { x: 3, y: 12 },
    ],
    torchSpawns: [
      { x: 1, y: 10 }, { x: 7, y: 10 }, { x: 24, y: 7 }, { x: 27, y: 1 }, { x: 16, y: 17 }, { x: 1, y: 22 },
      { x: 5, y: 18 }, { x: 23, y: 11 }, { x: 28, y: 7 }, { x: 12, y: 25 }, { x: 13, y: 7 }, { x: 41, y: 10 },
      { x: 23, y: 23 }, { x: 12, y: 16 }, { x: 37, y: 8 }, { x: 12, y: 20 }, { x: 23, y: 19 }, { x: 42, y: 4 },
      { x: 15, y: 1 }, { x: 32, y: 4 }, { x: 1, y: 14 }, { x: 7, y: 1 }, { x: 31, y: 24 }, { x: 17, y: 25 },
      { x: 27, y: 18 }, { x: 32, y: 13 }, { x: 31, y: 19 }, { x: 1, y: 4 }, { x: 6, y: 25 }, { x: 42, y: 14 },
    ],
  };
})();
