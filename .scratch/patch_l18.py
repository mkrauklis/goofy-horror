p = 'js/game18.js'
s = open(p, encoding='utf-8').read()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (s.count(a), a[:70])
    s = s.replace(a, b)

# state
rep("  function respawnPlayer(p) {", """  // ---- the boat crossing past the exit ----
  // Beyond the exit room is a channel of deep water: you can't wade it, you need
  // a boat. The water gets darker the further you go, and at the far end the
  // boats tip you out onto a shore, where the real exit is.
  const BOAT_BOARD_RADIUS = 64;
  let boats = [];
  function makeBoats() {
    return (LEVEL.boats || []).map((b) => {
      const c = tileCenter(b.x, b.y);
      return { x: c.x, y: c.y, angle: 0, rider: null, sunk: false, sunkAt: 0, rowUntil: 0 };
    });
  }
  // 0 at the dock .. 1 at the darkest part of the channel
  function waterDepth(tx) {
    const w = LEVEL.water;
    return w ? clamp((tx - w.x0) / (w.darkX - w.x0), 0, 1) : 0;
  }
  function boatLight(p) { return p.boat ? 1 - 0.45 * waterDepth(worldToTile(p.x, p.y).x) : 1; }
  function waterShade(x) {
    const t = Math.pow(waterDepth(x), 1.15);
    const r = Math.round(24 + (1 - 24) * t), g2 = Math.round(92 + (5 - 92) * t), b = Math.round(134 + (9 - 134) * t);
    return `rgb(${r},${g2},${b})`;
  }

  function respawnPlayer(p) {""")
rep("      p.nextRippleAt = 0;\n    });\n    waterGunAtEnd", "      p.nextRippleAt = 0;\n      p.boat = null;\n    });\n    boats = makeBoats();\n    waterGunAtEnd")

# movement
rep("""  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#') return true;""", """  function isWallForPlayer(tx, ty, boat) {
    const ch = tileChar(tx, ty);
    if (boat) return ch !== '~';          // a boat only goes on deep water
    if (ch === '~') return true;          // and you can't wade it without one
    if (ch === '#') return true;""")
rep("  function canStandAt(x, y) {", "  function canStandAt(x, y, boat) {")
rep("      return !isWallForPlayer(t.x, t.y);\n    });\n  }\n\n  function movePlayer(p, dx, dy) {\n    if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;\n    if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;\n  }",
"""      return !isWallForPlayer(t.x, t.y, boat);
    });
  }

  function movePlayer(p, dx, dy) {
    const boat = !!p.boat;
    if (dx !== 0 && canStandAt(p.x + dx, p.y, boat)) p.x += dx;
    if (dy !== 0 && canStandAt(p.x, p.y + dy, boat)) p.y += dy;
    if (p.boat) {                           // the boat goes where you paddle it, nose first
      const b = p.boat;
      b.x = p.x; b.y = p.y;
      let d = Math.atan2(p.facing.y, p.facing.x) - b.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      b.angle += d * 0.18;
      b.rowUntil = performance.now() + 220;
    }
  }""")
rep("""    if (isMoving) {
      window.Footsteps.advance(p, dt * WALK_CYCLE_SPEED * speedMultiplierFor(p), audioCtx, FOOT_SURFACE, speedMultiplierFor(p));""", """    if (isMoving) {
      if (!p.boat) window.Footsteps.advance(p, dt * WALK_CYCLE_SPEED * speedMultiplierFor(p), audioCtx, FOOT_SURFACE, speedMultiplierFor(p));""")

# boarding, and the tip-out at the far end
rep("  function updateTriggers() {", """  function updateBoats(now) {
    const W = LEVEL.water;
    if (!W) return;
    players.forEach((p) => {
      if (p.caught) return;
      if (!p.boat) {
        for (const b of boats) {
          if (b.sunk || b.rider) continue;
          if (Math.hypot(p.x - b.x, p.y - b.y) < BOAT_BOARD_RADIUS) {
            b.rider = p; p.boat = b; p.x = b.x; p.y = b.y;
            spawnFloatingText(b.x, b.y - 18, 'ABOARD');
            playItemChime(520);
            break;
          }
        }
      } else if (worldToTile(p.x, p.y).x >= W.kickX) {
        const b = p.boat;
        b.rider = null; b.sunk = true; b.sunkAt = now; p.boat = null;
        for (let i = 0; i < 10; i++) spawnRipple(p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 60);
        spawnFloatingText(p.x, p.y - 26, 'THE BOAT TIPS YOU OUT!');
        playTone(160, 0.35, 'sawtooth', 0.14);
        playTone(90, 0.5, 'sine', 0.2, 0.05);
        const c = tileCenter(W.landX, clamp(worldToTile(p.x, p.y).y, W.landY0, W.landY1));
        p.x = c.x; p.y = c.y;
      }
    });
  }

  function updateTriggers() {""")
rep("      updateTriggers();\n", "      updateTriggers();\n      updateBoats(now);\n")

# the eel can't enter deep water
rep("    if (ch === '#' || ch === 'S') return false;\n    if (ch === 'D' || ch === 'W') return doorUnlocked;", "    if (ch === '#' || ch === 'S' || ch === '~') return false;\n    if (ch === 'D' || ch === 'W') return doorUnlocked;")
rep("    if (ch === 'Q') return '#ffb347';\n    return '#163a56';", "    if (ch === 'Q') return '#ffb347';\n    if (ch === '~') return '#082640';\n    return '#163a56';")

# drawing: the dark channel, and the boats
rep("          case 'E': color = '#15283c'; break;", "          case 'E': color = '#15283c'; break;\n          case '~': color = waterShade(x); break;")
rep("        if (ch === 'R') drawCoral(g, px, py, x, y, now);", """        if (ch === '~') {                       // slow wave lines, fading as the water darkens
          const clear = 1 - waterDepth(x);
          if (clear > 0.05) {
            g.strokeStyle = `rgba(190,225,255,${0.14 * clear})`; g.lineWidth = 1.5;
            const ph = now * 0.002 + x * 0.9 + y * 0.6;
            g.beginPath(); g.moveTo(px + 3, py + 10 + Math.sin(ph) * 3); g.quadraticCurveTo(px + 16, py + 6 + Math.sin(ph + 1) * 3, px + 29, py + 10 + Math.sin(ph + 2) * 3); g.stroke();
            g.beginPath(); g.moveTo(px + 3, py + 24 + Math.sin(ph + 3) * 3); g.quadraticCurveTo(px + 16, py + 20 + Math.sin(ph + 4) * 3, px + 29, py + 24 + Math.sin(ph + 5) * 3); g.stroke();
          }
        }

        if (ch === 'R') drawCoral(g, px, py, x, y, now);""")
rep("  function drawPlayers(g) {", """  function drawBoats(g, now) {
    boats.forEach((b) => {
      let alpha = 1, sink = 0;
      if (b.sunk) {
        const t = (now - b.sunkAt) / 1600;
        if (t >= 1) return;
        alpha = 1 - t; sink = t * 12;
      }
      g.save();
      g.translate(b.x, b.y + sink);
      g.rotate(b.angle);
      g.globalAlpha = alpha;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(3, 5, 28, 14, 0, 0, Math.PI * 2); g.fill();
      // oars first, so they sit under the hull's rim
      if (b.rider) {
        const swing = now < b.rowUntil ? Math.sin(now * 0.014) * 0.55 : 0.1;
        g.strokeStyle = '#d9c9a0'; g.lineWidth = 3; g.lineCap = 'round';
        [-1, 1].forEach((side) => {
          g.beginPath(); g.moveTo(-2, side * 11); g.lineTo(-8 - swing * 8 * side, side * 30); g.stroke();
          g.fillStyle = '#d9c9a0'; g.beginPath(); g.ellipse(-8 - swing * 8 * side, side * 31, 4, 2.4, 0, 0, Math.PI * 2); g.fill();
        });
      }
      // hull: pointed bow in front
      g.fillStyle = '#8a5a2e'; g.strokeStyle = '#3a2410'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(30, 0); g.quadraticCurveTo(18, -15, -18, -13); g.lineTo(-25, -8); g.lineTo(-25, 8); g.lineTo(-18, 13); g.quadraticCurveTo(18, 15, 30, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#5e3a1a';
      g.beginPath(); g.moveTo(24, 0); g.quadraticCurveTo(14, -9, -16, -8); g.lineTo(-20, -5); g.lineTo(-20, 5); g.lineTo(-16, 8); g.quadraticCurveTo(14, 9, 24, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,16,6,0.55)'; g.lineWidth = 1.2;
      for (let x = -12; x <= 14; x += 9) { g.beginPath(); g.moveTo(x, -8); g.lineTo(x, 8); g.stroke(); }
      g.fillStyle = '#c9a15a'; g.fillRect(-3, -3, 6, 6);        // a seat plank
      g.restore();
    });
  }

  function drawPlayers(g) {""")
rep("    drawPlayers(ctx);", "    drawBoats(ctx, now);\n    drawPlayers(ctx);")
rep("      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl), 1);\n      punchLight(maskCtx, s.x, s.y, 230 * nvgMult * HM.flicker(pl), 0.85);", "      punchLight(maskCtx, s.x, s.y, 90 * nvgMult * HM.flicker(pl) * boatLight(pl), 1);\n      punchLight(maskCtx, s.x, s.y, 230 * nvgMult * HM.flicker(pl) * boatLight(pl), 0.85);")
open(p, 'w', encoding='utf-8', newline='\n').write(s)

h = open('level18.html', encoding='utf-8').read()
a = "unlock the exit. A pale, bump-skinned eel"
assert a in h
h = h.replace(a, "unlock the exit &mdash; but the exit isn't the end: it opens onto a dock, and the only way on is by <strong>boat</strong>. A pale, bump-skinned eel")
open('level18.html', 'w', encoding='utf-8', newline='\n').write(h)
print('patched')
