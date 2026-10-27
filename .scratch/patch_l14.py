p='js/game14.js'
s=open(p,encoding='utf-8',newline='').read()
crlf = '\r\n' in s
s=s.replace('\r\n','\n')
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a,s.count(a))
    s=s.replace(a,b)

# constants
rep("  const SHOTGUN_RANGE = 70;\n","""  const SHOTGUN_RANGE = 70;
  const FLAME_STUN_MS = HM.ability(3000);
  const FLAME_AMMO_MAX = 6;
  const FLAME_AMMO_PER_PICKUP = 2;
  const FLAME_RANGE = 90;
  const FLAME_FIND_RADIUS = 28;
""")
# state
rep("  let heaterOn = false;\n","  let heaterOn = false;\n  let flamethrowerAtAlcove = false; // the secret flamethrower, until someone finds it\n  let flameBursts = []; // short-lived jets of flame from a player to a monster they just burned\n")
rep("      shotgunAmmo: 0,\n","      shotgunAmmo: 0,\n      flameAmmo: 0,\n")
rep("      p.shotgunAmmo = 0;\n    });\n","      p.shotgunAmmo = 0;\n      p.flameAmmo = 0;\n    });\n")
rep("    heaterOn = false;\n    meltedSet = new Set();\n    doorUnlocked = false;\n","""    heaterOn = false;
    flameBursts = [];
    meltedSet = new Set();
    doorUnlocked = false;
    flamethrowerAtAlcove = !(window.GoofyStory && window.GoofyStory.isGunUnlocked('flamethrower'));
""")
rep("""    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)], opened: false, openedAt: 0,
    }));""","""    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: pickCrateItem(), opened: false, openedAt: 0,
    }));""")
rep("        c.item = CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)];\n","        c.item = pickCrateItem();\n")
rep("  function resetLevel() {\n","""  // The flamethrower's fuel only turns up in crates once it's equipped.
  function pickCrateItem() {
    const pool = (window.GoofyStory && window.GoofyStory.isGunEquipped('flamethrower'))
      ? CRATE_ITEMS.concat(['flame-fuel'])
      : CRATE_ITEMS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function resetLevel() {
""")
# walls
rep("""    if (ch === '#' || ch === 'C') return true;
    if (ch === 'D') return !doorUnlocked;
    return false;""","""    if (ch === '#' || ch === 'C') return true;
    if (ch === 'D') return !doorUnlocked;
    if (ch === 'M') return !heaterOn;   // packed snow, until the heater melts it
    return false;""")
rep("""    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'C') return false;
    if (ch === 'D') return doorUnlocked;""","""    if (ch === '#' || ch === 'S' || ch === 'V' || ch === 'C' || ch === 'M') return false;
    if (ch === 'D') return doorUnlocked;""")
rep("      if (tileChar(t2.x, t2.y) === '#') return false;\n","      const lc = tileChar(t2.x, t2.y);\n      if (lc === '#' || (lc === 'M' && !heaterOn)) return false;\n")
rep("""    if (tileChar(tx - 1, ty) === '#') dx += 1;
    if (tileChar(tx + 1, ty) === '#') dx -= 1;
    if (tileChar(tx, ty - 1) === '#') dy += 1;
    if (tileChar(tx, ty + 1) === '#') dy -= 1;""","""    const solid = (x, y) => { const c = tileChar(x, y); return c === '#' || (c === 'M' && !heaterOn); };
    if (solid(tx - 1, ty)) dx += 1;
    if (solid(tx + 1, ty)) dx -= 1;
    if (solid(tx, ty - 1)) dy += 1;
    if (solid(tx, ty + 1)) dy -= 1;""")
# minimap
rep("    if (ch === 'D') return '#d9ac4a';\n    if (ch === 'S')","    if (ch === 'D') return '#d9ac4a';\n    if (ch === 'M') return heaterOn ? '#3c3c46' : '#cfe0ea';\n    if (ch === 'S')")
# crate item effect
rep("""    } else if (item === 'energy') {
      energyUntil""","""    } else if (item === 'flame-fuel') {
      if (p.flameAmmo < FLAME_AMMO_MAX) {
        p.flameAmmo = Math.min(FLAME_AMMO_MAX, p.flameAmmo + FLAME_AMMO_PER_PICKUP);
        spawnFloatingText(x, y, `FUEL (${p.flameAmmo}/${FLAME_AMMO_MAX})`);
        playItemChime(540);
      } else {
        spawnFloatingText(x, y, 'FUEL FULL');
      }
    } else if (item === 'energy') {
      energyUntil""")
# triggers: pickup
rep("""      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
        if (window.GoofyStory) window.GoofyStory.completeLevel(14);""","""      if (flamethrowerAtAlcove && heaterOn) {
        const fc = tileCenter(LEVEL.flamethrower.x, LEVEL.flamethrower.y);
        if (Math.hypot(p.x - fc.x, p.y - fc.y) < FLAME_FIND_RADIUS) {
          flamethrowerAtAlcove = false;
          if (window.GoofyStory) window.GoofyStory.unlockGun('flamethrower');
          spawnFloatingText(fc.x, fc.y, 'FLAMETHROWER FOUND!');
          playDoorUnlockChime();
        }
      }
      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
        if (window.GoofyStory) window.GoofyStory.completeLevel(14);""")
# defense
rep("  function updateCatch(now) {\n    monsters.forEach((m) => {","""  // The flamethrower's own automatic defense: its own fuel, a shorter
  // stun than the tranquilizer, and the monster visibly burns while it lasts.
  function updateFlamethrowerDefense(now) {
    if (!(window.GoofyStory && window.GoofyStory.isGunEquipped('flamethrower'))) return;
    players.forEach((p) => {
      if (p.caught || p.flameAmmo <= 0) return;
      monsters.forEach((m) => {
        if (p.flameAmmo <= 0) return;
        if (now < m.frozenUntil || m.state !== 'alert') return;
        if (Math.hypot(p.x - m.x, p.y - m.y) < FLAME_RANGE) {
          m.frozenUntil = now + FLAME_STUN_MS;
          m.burnUntil = now + FLAME_STUN_MS;
          p.flameAmmo--;
          flameBursts.push({ x: p.x, y: p.y, tx: m.x, ty: m.y, at: now });
          spawnFloatingText(m.x, m.y, 'BURNED!');
          playShotgunBlast();
        }
      });
    });
  }

  function updateCatch(now) {
    monsters.forEach((m) => {""")
rep("      updateShotgunDefense(now);\n","      updateShotgunDefense(now);\n      updateFlamethrowerDefense(now);\n")
# heater melts wall: message
rep("    spawnFloatingText(tileCenter(LEVEL.heater.x, LEVEL.heater.y).x, tileCenter(LEVEL.heater.x, LEVEL.heater.y).y, 'HEATER ON');\n","""    spawnFloatingText(tileCenter(LEVEL.heater.x, LEVEL.heater.y).x, tileCenter(LEVEL.heater.x, LEVEL.heater.y).y, 'HEATER ON');
    if (flamethrowerAtAlcove) {
      const w = tileCenter(LEVEL.flamethrower.x, LEVEL.flamethrower.y - 1);
      spawnFloatingText(w.x, w.y, 'SOMETHING MELTED...');
    }
""")
# tile colour
rep("          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;\n","          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;\n          case 'M': color = heaterOn ? '#2a3a44' : '#dce8f0'; break;\n")
rep("        if (ch === 'N' && meltedSet.has(`${x},${y}`)) {","""        if (ch === 'M') {
          if (!heaterOn) {                       // packed snow, drifting and crusted
            g.fillStyle = 'rgba(255,255,255,0.55)';
            g.fillRect(px + 2, py + 2, TILE - 4, 5);
            g.strokeStyle = 'rgba(120,160,190,0.55)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(px + 3, py + TILE - 6); g.lineTo(px + TILE - 3, py + TILE - 10); g.moveTo(px + 6, py + 12); g.lineTo(px + TILE - 8, py + 14); g.stroke();
          } else {                               // a puddle where the wall stood
            g.fillStyle = 'rgba(60,100,130,0.35)';
            g.beginPath(); g.ellipse(px + TILE / 2, py + TILE / 2, 9, 5, 0, 0, Math.PI * 2); g.fill();
          }
        }
        if (ch === 'N' && meltedSet.has(`${x},${y}`)) {""")
# world draw hooks
rep("    drawCrates(g);\n    drawBigCrates(g);\n","    drawCrates(g);\n    drawBigCrates(g);\n    drawFlamethrowerPickup(g, performance.now());\n")
rep("  function drawCrates(g) {\n","""  // The secret flamethrower, resting in the alcove behind the snow wall --
  // gone for good the moment someone picks it up.
  function drawFlamethrowerPickup(g, now) {
    if (!flamethrowerAtAlcove) return;
    const c = tileCenter(LEVEL.flamethrower.x, LEVEL.flamethrower.y);
    const bob = Math.sin(now * 0.003) * 3;
    g.save();
    g.translate(c.x, c.y + bob);
    const glow = g.createRadialGradient(0, 0, 2, 0, 0, 28);
    glow.addColorStop(0, 'rgba(255,150,40,0.5)'); glow.addColorStop(1, 'rgba(255,100,10,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 28, 0, Math.PI * 2); g.fill();
    g.rotate(-0.5);
    g.fillStyle = '#b8321e';                        // fuel tank
    g.fillRect(-12, -5, 11, 10);
    g.strokeStyle = '#3a0e08'; g.lineWidth = 1.2; g.strokeRect(-12, -5, 11, 10);
    g.fillStyle = '#4a4a52';                        // barrel and nozzle
    g.fillRect(-1, -2, 14, 4);
    g.fillRect(11, -3.5, 3, 7);
    g.fillStyle = '#ffb02e';                        // pilot flame
    g.shadowColor = '#ff8a1e'; g.shadowBlur = 8;
    g.beginPath(); g.ellipse(17, 0, 3 + Math.sin(now * 0.03) * 0.8, 2, 0, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.restore();
  }

  function drawCrates(g) {
""")
# burn visual on frozen monster
rep("    if (t < m.frozenUntil) {","""    if (t < (m.burnUntil || 0)) {
      for (let i = 0; i < 5; i++) {
        const fa = (i / 5) * Math.PI * 2 + t * 0.004;
        const fr = m.radius * (0.5 + 0.35 * Math.sin(t * 0.02 + i * 1.7));
        const fx = Math.cos(fa) * fr, fy = Math.sin(fa) * fr - 4 - Math.abs(Math.sin(t * 0.015 + i)) * 7;
        g.fillStyle = i % 2 ? 'rgba(255,200,60,0.85)' : 'rgba(255,100,20,0.85)';
        g.beginPath(); g.ellipse(fx, fy, 4, 7, 0, 0, Math.PI * 2); g.fill();
      }
    }
    if (t < m.frozenUntil) {""")
# flame jets + HUD
rep("  function drawShotgunHud(vx, p) {","""  function drawFlameBursts(g, now) {
    flameBursts = flameBursts.filter((b) => now - b.at < 450);
    flameBursts.forEach((b) => {
      const k = (now - b.at) / 450;
      const dx = b.tx - b.x, dy = b.ty - b.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let i = 0; i < 14; i++) {
        const u = Math.min(1, (i / 14) + k * 0.4);
        const spread = (u * 14) * Math.sin(i * 12.9 + k * 6);
        const x = b.x + dx * u + nx * spread, y = b.y + dy * u + ny * spread;
        g.fillStyle = i % 2 ? `rgba(255,210,70,${0.9 - k * 0.8})` : `rgba(255,90,20,${0.9 - k * 0.8})`;
        g.beginPath(); g.arc(x, y, 3 + u * 6 * (1 - k * 0.5), 0, Math.PI * 2); g.fill();
      }
    });
  }

  function drawFlamethrowerHud(vx, p) {
    if (p.flameAmmo <= 0) return;
    if (!(window.GoofyStory && window.GoofyStory.isGunEquipped('flamethrower'))) return;
    const cx = vx + VIEW_W - 34, cy = 98;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(45,15,5,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#ff7a2e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx - 6, cy);
    ctx.fillStyle = '#ff9a2e';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(5, -1, 3, 4);
    ctx.quadraticCurveTo(0, 8, -3, 4);
    ctx.quadraticCurveTo(-5, -1, 0, -7);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.ellipse(0, 3, 1.8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`${p.flameAmmo}x`, cx + 3, cy + 4);
    ctx.restore();
  }

  function drawShotgunHud(vx, p) {""")
rep("    drawShotgunHud(vx, p);\n","    drawShotgunHud(vx, p);\n    drawFlamethrowerHud(vx, p);\n")
rep("    drawFloatingTexts(g);\n  }\n\n  function drawTable","    drawFloatingTexts(g);\n    drawFlameBursts(g, performance.now());\n  }\n\n  function drawTable")
if crlf: s=s.replace('\n','\r\n')
open(p,'w',encoding='utf-8',newline='').write(s)
print('ok crlf',crlf)
