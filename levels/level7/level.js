(function () {
  // Legend: # wall, . floor (cobblestone, same look as level 6), S safe
  // zone (spawn), Z statue (solid), B lever, D wooden door (blocks until
  // the minecart breaks it open), E vault floor, X exit trigger, ~ missing
  // floor (a real chasm -- players can't cross it, the monster can), P
  // boardwalk plank (the one safe path across a pit room, straight across
  // the room on the same line the corridors already connect on).
  //
  // The minecart's rail isn't stored in the grid -- LEVEL.rail below is a
  // straight line in world space the cart lerps along once the lever's
  // thrown, riding the same line as the pit room's boardwalk.
  const grid = [
    '#######################################################',
    '#SSSS.....##.........##.........##~~~~~~~~~##EEEEEEEEE#',
    '#SSSS.....##.........##.........##~~~~~~~~~##EEEEEEEEE#',
    '#SSSS.............................PPPPPPPPPDDEEEEEEEEE#',
    '#SSSS...........Z..........Z......PPPPPPPPPDDEEEEXEEEE#',
    '#.........##.........##.........##~~~~~~~~~##EEEEEEEEE#',
    '#.........##.........##.........##~~~~~~~~~##EEEEEEEEE#',
    '#.........##.........##.........##~~~~~~~~~##EEEEEEEEE#',
    '##########################..###########################',
    '##########################..###########################',
    '#######################.........#######################',
    '#######################.B.......#######################',
    '#######################.........#######################',
    '#######################....Z....#######################',
    '#######################.........#######################',
    '#######################.........#######################',
    '#######################.........#######################',
    '#######################################################',
  ];

  window.LEVEL7 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 2, y: 2 },
    spawn2: { x: 3, y: 2 },
    monsterSpawns: [
      { x: 19, y: 6 }, { x: 36, y: 2 }
    ],
    levers: [
      { x: 24, y: 11 }
    ],
    rail: { from: { x: 11, y: 4 }, to: { x: 45, y: 4 } },
    exitTrigger: { x: 49, y: 4 },
    safeZone: { x0: 1, y0: 1, x1: 4, y1: 4 },
    patrolPoints: [
      { x: 16, y: 3 }, { x: 27, y: 3 }, { x: 38, y: 3 }, { x: 27, y: 12 },
    ],
    crateSpawns: [
      { x: 24, y: 3 }, { x: 29, y: 2 }, { x: 26, y: 14 }, { x: 17, y: 3 }, { x: 31, y: 7 }, { x: 31, y: 15 },
      { x: 40, y: 4 }, { x: 35, y: 4 },
    ],
    torchSpawns: [
      { x: 31, y: 1 }, { x: 27, y: 16 }, { x: 2, y: 1 }, { x: 31, y: 13 }, { x: 9, y: 1 }, { x: 20, y: 1 },
      { x: 20, y: 7 }, { x: 3, y: 7 }, { x: 16, y: 7 }, { x: 23, y: 14 }, { x: 26, y: 8 }, { x: 26, y: 1 },
      { x: 7, y: 7 }, { x: 12, y: 5 }, { x: 31, y: 5 }, { x: 15, y: 1 },
    ],
  };
})();
