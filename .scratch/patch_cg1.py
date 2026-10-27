import re
p = 'C:/claude_p/goofy-horror/js/customgame.js'
s = open(p, encoding='utf-8', newline='').read()
crlf = '\r\n' in s
s = s.replace('\r\n', '\n')


def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:70])
    s = s.replace(a, b)


# --- monsters pass obsidian ---
rep("""        x: m.x, y: m.y, t: now / 1000 + m.seed, look: m.lookDir, rage, tired: m.tired, flash: m.flash,
      }));""", """        x: m.x, y: m.y, t: now / 1000 + m.seed, look: m.lookDir, rage, tired: m.tired, flash: m.flash, obsidian: m.obsidian || 0,
      }));""")

# --- reset: boss counters ---
rep("""      boss.tired = false; boss.invulUntil = 0; boss.state = 'alert';""", """      boss.tired = false; boss.invulUntil = 0; boss.state = 'alert'; boss.atkCount = 0; boss.obsidian = 0;""")

# --- tiles: ashen style ---
rep("""        g.fillStyle = (ch === 'D' && !doorUnlocked) ? '#3a4552' : CHAP.floor[hash2(x, y) % CHAP.floor.length];
        g.fillRect(px, py, TILE, TILE);""", """        if (ch === 'L') { g.fillStyle = '#1a0c08'; g.fillRect(px, py, TILE, TILE); continue; } // drawn emissive, over the dark
        g.fillStyle = (ch === 'D' && !doorUnlocked) ? '#3a4552' : (STYLE === 'ashen' ? OBSIDIAN[hash2(x, y) % OBSIDIAN.length] : CHAP.floor[hash2(x, y) % CHAP.floor.length]);
        g.fillRect(px, py, TILE, TILE);
        if (STYLE === 'ashen' && (ch === '.' || ch === 'S' || (ch === 'D' && doorUnlocked))) drawObsidianSheen(g, x, y, px, py);""")
rep("""          g.fillStyle = CHAP.wall;
          g.fillRect(px, py, TILE, TILE);""", """          g.fillStyle = STYLE === 'ashen' ? '#1d1a22' : CHAP.wall;
          g.fillRect(px, py, TILE, TILE);""")
rep("""            g.fillStyle = CHAP.wallTop;
            g.fillRect(px, py + TILE - 10, TILE, 10);""", """            g.fillStyle = STYLE === 'ashen' ? '#2c2733' : CHAP.wallTop;
            g.fillRect(px, py + TILE - 10, TILE, 10);""")
rep("""    // exit
    LEVEL.exits.forEach((e) => {""", """    if (STYLE === 'ashen') drawMagmaCracks(g, camX, camY, now);

    // exit
    LEVEL.exits.forEach((e) => {""")

helpers = open('C:/claude_p/goofy-horror/.scratch/ashen_helpers.js', encoding='utf-8').read()
rep("  function drawTiles(g, camX, camY, now) {", helpers + "  function drawTiles(g, camX, camY, now) {")

rep("""  // every walkable open tile, for roaming and random spawns
  const floorTiles = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (LEVEL.grid[y][x] === '.') floorTiles.push({ x, y });""", """  // every walkable open tile, for roaming and random spawns
  const floorTiles = [];
  const lavaTiles = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (LEVEL.grid[y][x] === '.') floorTiles.push({ x, y });
      else if (LEVEL.grid[y][x] === 'L') lavaTiles.push({ x, y });
    }
  }""")

rep("""    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);
""", """    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);
    if (lavaTiles.length || embers.length || hazards.length) {
      ctx.save();
      ctx.translate(vx + VIEW_W / 2 - camX, VIEW_H / 2 - camY);
      drawEmissive(ctx, camX, camY, now);
      ctx.restore();
    }
""")

open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('ok')
