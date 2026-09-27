(function () {
  // Legend: # wall, . floor, S safe zone (spawn, monster can't enter),
  // V vent (players can hide in, monster can't enter), B button,
  // D door (blocks players and the monster until all 3 buttons are pressed),
  // E exit room floor, X exit trigger (reach it once the door is open to clear the level).
  const grid = [
    '################################',
    '#..........................#####',
    '#..........................#####',
    '#..SSSS######..#####.B.##..#####',
    '#..SSSS######..#####...##..#####',
    '#..SSSS######..##########..#####',
    '#..SSSS######..##########..#EEE#',
    '#..########................DEXE#',
    '#..........................#EEE#',
    '#..........................#####',
    '#..V#######......V#######..#####',
    '#..#########V..##########..#####',
    '#...B.#######..##########..#####',
    '#.....#######..#####.B.##..#####',
    '#..##########..#####...##..#####',
    '#..........................#####',
    '#..........................#####',
    '################################',
  ];

  window.LEVEL1 = {
    tileSize: 32,
    cols: grid[0].length,
    rows: grid.length,
    grid,
    spawn1: { x: 3, y: 4 },
    spawn2: { x: 5, y: 4 },
    monsterSpawn: { x: 13, y: 8 },
    hubTile: { x: 13, y: 8 },
    buttons: [
      { x: 4, y: 12 },
      { x: 21, y: 3 },
      { x: 21, y: 13 },
    ],
    door: { x: 27, y: 7 },
    exitTrigger: { x: 29, y: 7 },
    safeZone: { x0: 3, y0: 3, x1: 6, y1: 6 },
    lights: [
      { x: 13, y: 1 },
      { x: 5, y: 16 },
      { x: 21, y: 16 },
      { x: 7, y: 8 },
      { x: 20, y: 8 },
      { x: 22, y: 7 },
    ],
  };
})();
