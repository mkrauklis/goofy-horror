(function () {
  // Legend: # wall, . floor (cobblestone), S safe zone (spawn, the knights
  // can't enter), Z statue (solid, decorative -- one stands over every
  // room's crossing), B lever, D door (blocks players and the knights until
  // all 3 levers are thrown), E exit room floor, X exit trigger.
  //
  // A dungeon rebuilt from Level 1's own bones: the same blind, wall-crawling
  // creature (armored and slower here, but there are three of them), the
  // same 3-switches-unlock-the-door shape, just laid out as a lattice of
  // stone rooms instead of one sprawling facility.
  const grid = [
    '#################################',
    '#SSSS.....##.........##.........#',
    '#SSSS.....##.........##.B.......#',
    '#SSSS...........................#',
    '#SSSS...........Z..........Z....#',
    '#.........##.........##.........#',
    '#.........##.........##.........#',
    '#.........##.........##.........#',
    '####..#########..#########..#####',
    '####..#########..#########..#####',
    '#.........##.........##.........#',
    '#.........##.B.......##.........#',
    '#...............................#',
    '#....Z..........Z..........Z....#',
    '#.........##.........##.........#',
    '#.........##.........##.........#',
    '#.........##.........##.........#',
    '####..#########..#########DD#####',
    '####..#########..#########DD#####',
    '#.........##.........##EEEEEEEEE#',
    '#.B.......##.........##EEEEEEEEE#',
    '#....................DDEEEEEEEEE#',
    '#....Z..........Z....DDEEEEXEEEE#',
    '#.........##.........##EEEEEEEEE#',
    '#.........##.........##EEEEEEEEE#',
    '#.........##.........##EEEEEEEEE#',
    '#################################',
  ];

  window.LEVEL6 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 2, y: 2 },
    spawn2: { x: 3, y: 2 },
    monsterSpawns: [
      { x: 19, y: 6 }, { x: 8, y: 15 }, { x: 30, y: 15 }
    ],
    levers: [
      { x: 24, y: 2 }, { x: 2, y: 20 }, { x: 13, y: 11 }
    ],
    exitTrigger: { x: 27, y: 22 },
    safeZone: { x0: 1, y0: 1, x1: 4, y1: 4 },
    patrolPoints: [
      { x: 16, y: 4 }, { x: 27, y: 4 }, { x: 27, y: 13 }, { x: 16, y: 13 }, { x: 5, y: 13 }, { x: 5, y: 22 }, { x: 16, y: 22 }
    ],
    crateSpawns: [
      { x: 13, y: 22 }, { x: 31, y: 16 }, { x: 28, y: 4 }, { x: 20, y: 14 }, { x: 1, y: 23 }, { x: 17, y: 2 },
    ],
    torchSpawns: [
      { x: 7, y: 10 }, { x: 20, y: 19 }, { x: 25, y: 16 }, { x: 14, y: 10 }, { x: 15, y: 1 }, { x: 20, y: 11 },
      { x: 12, y: 5 }, { x: 28, y: 1 }, { x: 31, y: 14 }, { x: 2, y: 1 }, { x: 24, y: 1 }, { x: 5, y: 25 },
      { x: 4, y: 18 }, { x: 12, y: 20 }, { x: 1, y: 13 }, { x: 20, y: 15 },
    ],
  };
})();
