import re

SRC = 'C:/claude_p/goofy-horror/.scratch/oldh5/halloween5.js'
OUT = 'C:/claude_p/goofy-horror/js/halloween5.js'
s = open(SRC, encoding='utf-8').read().replace('\r\n', '\n')


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:80], s.count(a))
    s = s.replace(a, b)


def block(start, end, new):
    """Replace from `start` (inclusive) up to `end` (exclusive) with `new`."""
    global s
    i = s.index(start)
    j = s.index(end, i)
    s = s[:i] + new + s[j:]


# ---------- 1. identifier renames (candy -> fire, corn -> eruption, cotton candy -> ash) ----------
for a, b in [
    (r'\bupdateCandyCornAttack\b', 'updateEruptionAttack'),
    (r'\bupdateCottonCandyAttack\b', 'updateAshAttack'),
    (r'\bupdateCandies\b', 'updateFireballs'),
    (r'\bdrawCandies\b', 'drawFireballs'),
    (r'\bupdateCornPatches\b', 'updateEruptions'),
    (r'\bdrawCornPatches\b', 'drawEruptions'),
    (r'\bupdateGas\b', 'updateAsh'),
    (r'\bdrawGasPatches\b', 'drawAshClouds'),
    (r'\bdrawGasDanger\b', 'drawAshDanger'),
    (r'\bspawnCandyBurst\b', 'spawnEmberBurst'),
    (r'\bplayCandyCrunch\b', 'playBiteSound'),
    (r'\bcandies\b', 'fireballs'),
    (r'\bcornPatches\b', 'eruptions'),
    (r'\bgasPatches\b', 'ashClouds'),
    (r'\bgasSince\b', 'ashSince'),
    (r'\bCANDY_SPEED\b', 'FIREBALL_SPEED'),
    (r'\bCANDY_NORMAL_RADIUS\b', 'FIREBALL_NORMAL_RADIUS'),
    (r'\bCANDY_HIT_RADIUS\b', 'FIREBALL_HIT_RADIUS'),
    (r'\bCANDY_RADIUS\b', 'FIREBALL_RADIUS'),
    (r'\bCANDY_COLORS\b', 'FIRE_COLORS'),
    (r'\bCORN_(COUNT|WARN_MS|ACTIVE_MS|RADIUS)\b', r'ERUPT_\1'),
    (r'\bGAS_(COUNT|WARN_MS|LIFE_MS|RADIUS|KILL_MS|SLOW_MS|SLOW_MULT)\b', r'ASH_\1'),
    (r"'candycorn'", "'eruption'"),
    (r"'cottoncandy'", "'ash'"),
    (r'\bdrawKrakenParts\b', 'drawPumpkinParts'),
]:
    s = re.sub(a, b, s)

# ---------- 2. header / constants ----------
rep("""  // The boss: the Candy Kraken -- a tentacled monster made entirely of candy,
  // 2x2 tiles across.
  const BOSS_RADIUS = 32;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.1;
  const BOSS_NAME = 'THE CANDY KRAKEN';""", """  // The boss: the Pumpkin King -- a huge orange pumpkin, 3x3 tiles across, with
  // a fire burning in its mouth.
  const BOSS_RADIUS = 48;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.1;
  const BOSS_NAME = 'THE PUMPKIN KING';""")
rep("  const PHASE2_NAME_COLOR = '#c9b4d6';\n  const PHASE2_SUBTITLE = 'WITHERED';", "  const PHASE2_NAME_COLOR = '#ff6a2a';\n  const PHASE2_SUBTITLE = 'ABLAZE';")
rep("  // Attack 1 -- the candy spiral: it spins and spits candy out at 5x speed for\n  // 10 seconds, each piece twice the normal size.",
    "  // Attack 1 -- the fire spiral: it spins and spits fireballs out of its mouth at\n  // 5x speed for 10 seconds, each one twice the normal size.")
rep("""  // Attack 3 -- ten candy corn patches (2x2 tiles, round): a red circle flashes
  // for a second, then the candy corn shoots up.""", """  // Attack 3 -- ten eruption patches (2x2 tiles, round): a red circle flashes
  // for a second, then a pillar of fire shoots up out of the floor.""")
rep("""  // Attack 4 (withered phase only) -- three 5x5 clouds of cotton candy. Stay in
  // one for 2.5 seconds and you're done; get out sooner and you're only
  // slowed by 30% for 5 seconds.""", """  // Attack 4 (ablaze phase only) -- three 5x5 clouds of choking ash. Stay in
  // one for 2.5 seconds and you're done; get out sooner and you're only
  // slowed by 30% for 5 seconds.""")
rep("  // The candy the boss leaves behind as it moves, fading away slowly.", "  // The embers the boss leaves behind as it moves, fading away slowly.")
rep("theme: 'candy',", "theme: 'ashen',")
s = s.replace("ASH_SLOW_MULT : 1; // cotton candy slows you by 30%", "ASH_SLOW_MULT : 1; // ash slows you by 30%")
rep("  let trail = []; // the boss's candy trail: { x, y, kind, c1, c2, rot, born }", "  let trail = []; // the embers the boss leaves behind: { x, y, size, born }")
rep("'WITHERED');", "'ABLAZE');")
rep("    // the boss crumbles into a shower of candy\n", "    // the boss burns out in a shower of sparks\n")

# ---------- 3. sounds / bites ----------
rep("""  function playBiteSound() { playTone(900, 0.06, 'square', 0.13); playTone(1500, 0.05, 'square', 0.1, 0.035); playTone(240, 0.12, 'sawtooth', 0.12, 0.02); }""",
    """  function playBiteSound() { playTone(300, 0.08, 'sawtooth', 0.14); playTone(150, 0.14, 'square', 0.12, 0.03); playTone(1100, 0.05, 'square', 0.08, 0.05); }""")
rep("""        color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
      });""", """        color: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
      });""")

# ---------- 4. trail + fireball creation ----------
rep("""      trail.push({
        x: boss.x + (Math.random() - 0.5) * boss.radius * 1.1, y: boss.y + (Math.random() - 0.5) * boss.radius * 1.1,
        kind: Math.floor(Math.random() * 5),
        c1: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)], c2: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
        rot: Math.random() * Math.PI * 2, born: performance.now(),
      });""", """      trail.push({
        x: boss.x + (Math.random() - 0.5) * boss.radius * 1.3, y: boss.y + (Math.random() - 0.5) * boss.radius * 1.3,
        size: 2.5 + Math.random() * 3.5, born: performance.now(),
      });""")
rep("  // The boss moves through here, so everywhere it goes it sheds candy that\n", "  // The boss moves through here, so everywhere it goes it sheds embers that\n")
rep("""        rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 9,
        kind: Math.floor(Math.random() * 5),
        c1: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)], c2: FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)],
      });""", """        seed: Math.random() * 100,
      });""")
rep("      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt;", "      s.x += s.vx * dt; s.y += s.vy * dt;")
rep("  let fireballs = []; // the spiral's shots: { x, y, vx, vy, rot, spin, kind, c1, c2 }", "  let fireballs = []; // the spiral's shots: { x, y, vx, vy, seed }")
# the spiral launches from the mouth, which sits low on the face
rep("        x: boss.x + ca * boss.radius * 0.8, y: boss.y + sa * boss.radius * 0.8,", "        x: boss.x + ca * boss.radius * 0.85, y: boss.y + sa * boss.radius * 0.85,")

# ---------- 5. rendering: candy drawing -> embers, fireballs; floor ----------
block("  const FIRE_COLORS = [", "  // A carved jack-o-lantern:", """  const FIRE_COLORS = ['#ffe27a', '#ffb02e', '#ff8a1e', '#ff5a1a', '#ff3a10', '#fff2b0'];

  // a flame teardrop standing on (x, y): used for eruptions and the mouth
  function drawFlameTongue(g, x, y, w, h, t, seed) {
    const sway = Math.sin(t * 0.012 + seed) * w * 0.35;
    const flick = 0.9 + 0.1 * Math.sin(t * 0.03 + seed * 2);
    h *= flick;
    const layers = [['#ff3a10', 1], ['#ff8a1e', 0.72], ['#ffd25a', 0.46], ['#fff6c8', 0.22]];
    layers.forEach(([col, k]) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - w * k * 0.5, y);
      g.quadraticCurveTo(x - w * k * 0.55 + sway * 0.4, y - h * k * 0.55, x + sway * k, y - h * k);
      g.quadraticCurveTo(x + w * k * 0.55 + sway * 0.4, y - h * k * 0.55, x + w * k * 0.5, y);
      g.closePath(); g.fill();
    });
  }

""")

block("  // The whole arena painted once:", "  function drawTrail(g, now) {", """  // Vines growing across the floor (same as the Overgrown Ward's): a wandering
  // stem with leaves along it and a little curl at the tip, each grown from its
  // own seed so it's identical every time it's painted.
  function paintVines(f) {
    f.save();
    f.lineCap = 'round';
    f.lineJoin = 'round';
    LEVEL.vines.forEach((v) => {
      let seed = v.s;
      const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      let x = v.x * TILE, y = v.y * TILE, a = v.a;
      const pts = [{ x, y, a }];
      for (let i = 0; i < v.n; i++) {
        a += (rnd() - 0.5) * 1.1;
        x += Math.cos(a) * 10; y += Math.sin(a) * 10;
        pts.push({ x, y, a });
      }
      const stem = (w, col) => {
        f.strokeStyle = col; f.lineWidth = w;
        f.beginPath(); f.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) f.lineTo(pts[i].x, pts[i].y);
        f.stroke();
      };
      stem(4.4, 'rgba(18,48,14,0.85)');
      stem(2.4, '#3d8a2c');
      for (let i = 1; i < pts.length; i++) {
        if (rnd() < 0.78) {
          const side = i % 2 ? 1 : -1, p = pts[i];
          f.fillStyle = rnd() < 0.5 ? '#4fae3a' : '#3a8a2a';
          f.beginPath();
          f.ellipse(p.x + Math.cos(p.a + side * 1.2) * 4, p.y + Math.sin(p.a + side * 1.2) * 4, 4.6, 2.2, p.a + side * 1.0, 0, Math.PI * 2);
          f.fill();
        }
      }
      const tip = pts[pts.length - 1];
      f.strokeStyle = '#4fae3a'; f.lineWidth = 1.4;
      f.beginPath(); f.arc(tip.x + Math.cos(tip.a + 1.3) * 3, tip.y + Math.sin(tip.a + 1.3) * 3, 3, tip.a - 2, tip.a + 3.4); f.stroke();
    });
    f.restore();
  }

  // The ward's floor shades, hashed per tile (the same mottled teal as the
  // Quiet Ward and the Overgrown Ward).
  const FLOOR_SHADES = ['#7fa39f', '#86aba6', '#8db0ab', '#82a69f', '#89ada8', '#92b5b0'];
  function floorShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    return FLOOR_SHADES[((h ^ (h >>> 13)) >>> 0) % FLOOR_SHADES.length];
  }

  // The whole arena painted once: a brick wall filling the square, and a round
  // floor of ward tiles overgrown with vines cut into it.
  let floorCanvas = null;
  function buildFloor() {
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = WORLD_H;
    const f = c.getContext('2d');
    f.fillStyle = '#2a1713';
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    // brick, laid in a running bond
    const BH = 14, BW = 30;
    const brickCols = ['#7a3a2a', '#8a4430', '#6e3426', '#93503a', '#7f3e2c'];
    for (let row = 0; row * BH < WORLD_H; row++) {
      const off = (row % 2) * (BW / 2);
      for (let col = -1; col * BW < WORLD_W + BW; col++) {
        const x = col * BW + off, y = row * BH;
        f.fillStyle = brickCols[Math.floor(hash2(col, row, 1) * brickCols.length)];
        f.fillRect(x + 1, y + 1, BW - 2, BH - 2);
        f.fillStyle = 'rgba(255,200,160,0.12)'; f.fillRect(x + 1, y + 1, BW - 2, 2);
        f.fillStyle = 'rgba(0,0,0,0.25)'; f.fillRect(x + 1, y + BH - 3, BW - 2, 2);
      }
    }
    const vg = f.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R, ARENA_CX, ARENA_CY, ARENA_R + 150);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    f.fillStyle = vg; f.fillRect(0, 0, WORLD_W, WORLD_H);

    // the ward floor, clipped to a circle
    f.save();
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R, 0, Math.PI * 2); f.clip();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        f.fillStyle = floorShade(x, y);
        f.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    paintVines(f);
    // dim it down: the floor is deep in the dark, lit mostly by the jack-o-lanterns
    f.fillStyle = 'rgba(8,10,20,0.6)';
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    const fv = f.createRadialGradient(ARENA_CX, ARENA_CY, ARENA_R * 0.55, ARENA_CX, ARENA_CY, ARENA_R);
    fv.addColorStop(0, 'rgba(0,0,0,0)'); fv.addColorStop(1, 'rgba(0,0,0,0.38)');
    f.fillStyle = fv;
    f.fillRect(0, 0, WORLD_W, WORLD_H);
    f.restore();
    // the lip of the wall round the floor
    f.lineWidth = 9; f.strokeStyle = 'rgba(28,10,8,0.9)';
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R + 4.5, 0, Math.PI * 2); f.stroke();
    f.lineWidth = 3; f.strokeStyle = 'rgba(255,214,176,0.55)';
    f.beginPath(); f.arc(ARENA_CX, ARENA_CY, ARENA_R - 1, 0, Math.PI * 2); f.stroke();
    return c;
  }

  function drawTiles(g, now) {
    if (!floorCanvas) floorCanvas = buildFloor();
    g.drawImage(floorCanvas, 0, 0);
    // each jack-o-lantern lights the floor round it
    g.save();
    g.globalCompositeOperation = 'lighter';
    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      const f = 0.85 + 0.15 * Math.sin(now * 0.011 + i * 1.7);
      const gr = g.createRadialGradient(c.x, c.y, 4, c.x, c.y, TILE * 5);
      gr.addColorStop(0, `rgba(255,150,50,${0.34 * f})`); gr.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, TILE * 5, 0, Math.PI * 2); g.fill();
    });
    g.restore();
    LEVEL.lanterns.forEach((l, i) => {
      const c = tileCenter(l.x, l.y);
      drawJackOLantern(g, c.x, c.y, 11, now, i * 1.7);
    });
  }

""")

# trail, fireballs, eruptions, ash clouds
block("  function drawTrail(g, now) {", "  function drawCrates(g) {", """  // the embers the boss has left behind: they fade out as they age
  function drawTrail(g, now) {
    trail.forEach((t) => {
      const age = clamp((now - t.born) / TRAIL_LIFE_MS, 0, 1);
      const a = (1 - age) * (1 - age);
      const flick = 0.7 + 0.3 * Math.sin(now * 0.02 + t.x);
      g.fillStyle = `rgba(255,120,30,${0.28 * a})`;
      g.beginPath(); g.arc(t.x, t.y, t.size * 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,${190 - 80 * age | 0},60,${0.95 * a * flick})`;
      g.beginPath(); g.arc(t.x, t.y, t.size * (1 - age * 0.5), 0, Math.PI * 2); g.fill();
    });
  }

  // the spiral's fireballs: twice the size of an ordinary one, with a flame trailing behind
  function drawFireballs(g, now) {
    fireballs.forEach((s) => {
      const ang = Math.atan2(s.vy, s.vx);
      g.save();
      g.translate(s.x, s.y);
      g.rotate(ang);
      const R = FIREBALL_RADIUS;
      const halo = g.createRadialGradient(0, 0, 2, 0, 0, R * 2.4);
      halo.addColorStop(0, 'rgba(255,170,50,0.55)'); halo.addColorStop(1, 'rgba(255,100,20,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(0, 0, R * 2.4, 0, Math.PI * 2); g.fill();
      const flick = 1 + 0.12 * Math.sin(now * 0.04 + s.seed);
      g.fillStyle = '#ff5a1a';                                  // tail
      g.beginPath(); g.moveTo(0, -R * 0.9); g.quadraticCurveTo(-R * 2.2, -R * 0.4, -R * 3.4 * flick, 0); g.quadraticCurveTo(-R * 2.2, R * 0.4, 0, R * 0.9); g.closePath(); g.fill();
      g.fillStyle = '#ff9a2e';
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffe27a';
      g.beginPath(); g.arc(R * 0.1, 0, R * 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff6d0';
      g.beginPath(); g.arc(R * 0.2, 0, R * 0.28, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  }

  // Eruption patches: a red circle flashes for a second, then pillars of fire
  // shoot up out of the floor.
  function drawEruptions(g, now) {
    eruptions.forEach((c) => {
      if (now < c.fireAt) {
        const on = Math.floor((now - (c.fireAt - ERUPT_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(c.x, c.y, ERUPT_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,40,40,0.4)' : 'rgba(255,40,40,0.1)'; g.fill();
        g.strokeStyle = on ? '#ff3030' : 'rgba(255,70,70,0.45)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const t = clamp((now - c.fireAt) / ERUPT_ACTIVE_MS, 0, 1);
      const rise = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      const glow = g.createRadialGradient(c.x, c.y, 2, c.x, c.y, ERUPT_RADIUS);
      glow.addColorStop(0, `rgba(255,170,50,${0.55 * rise})`); glow.addColorStop(1, 'rgba(255,60,20,0.16)');
      g.fillStyle = glow; g.beginPath(); g.arc(c.x, c.y, ERUPT_RADIUS, 0, Math.PI * 2); g.fill();
      const tongues = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3, rad = i === 8 ? 0 : ERUPT_RADIUS * 0.58;
        tongues.push({ x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad, h: (i === 8 ? 62 : 44 + (i % 3) * 6) * rise, i });
      }
      tongues.sort((a, b) => a.y - b.y);
      tongues.forEach((tg) => drawFlameTongue(g, tg.x, tg.y + 6, 22, tg.h, now, tg.i * 1.9 + c.x));
    });
  }

  // Ash clouds: a flashing circle first, then a swirling cloud of grey ash and glowing embers.
  function drawAshClouds(g, now) {
    ashClouds.forEach((gp) => {
      if (now < gp.startAt) {
        const on = Math.floor((now - (gp.startAt - ASH_WARN_MS)) / 125) % 2 === 0;
        g.beginPath(); g.arc(gp.x, gp.y, ASH_RADIUS, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,120,40,0.3)' : 'rgba(255,120,40,0.08)'; g.fill();
        g.strokeStyle = on ? '#ff7a2a' : 'rgba(255,140,70,0.4)'; g.lineWidth = 3; g.stroke();
        return;
      }
      const life = clamp((gp.endAt - now) / 1000, 0, 1);
      const grow = clamp((now - gp.startAt) / 500, 0, 1);
      const cols = ['40,36,40', '70,64,66', '30,26,30', '95,86,84'];
      g.save();
      g.beginPath(); g.arc(gp.x, gp.y, ASH_RADIUS * grow, 0, Math.PI * 2);
      g.fillStyle = `rgba(30,24,28,${0.4 * life})`; g.fill();   // a dark base so it stands out on the pale floor
      for (let i = 0; i < 20; i++) {
        const a = i * 2.4 + now * 0.0004 * (i % 2 ? 1 : -1);
        const rad = ASH_RADIUS * 0.66 * Math.sqrt((i + 1) / 20) * grow;
        const px = gp.x + Math.cos(a) * rad, py = gp.y + Math.sin(a) * rad;
        const size = ASH_RADIUS * 0.36;
        const col = cols[i % cols.length];
        const gr = g.createRadialGradient(px, py, 1, px, py, size);
        gr.addColorStop(0, `rgba(${col},${0.9 * life})`); gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, size, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 14; i++) {                              // embers drifting in the ash
        const a = i * 1.9 + now * 0.0007, rad = ASH_RADIUS * 0.9 * ((i * 37 % 10) / 10 + 0.05) * grow;
        g.fillStyle = `rgba(255,${130 + (i % 3) * 40},40,${0.8 * life * (0.5 + 0.5 * Math.sin(now * 0.01 + i))})`;
        g.beginPath(); g.arc(gp.x + Math.cos(a) * rad, gp.y + Math.sin(a) * rad, 2.2, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = `rgba(255,110,40,${0.85 * life})`; g.lineWidth = 3; g.setLineDash([8, 8]);
      g.beginPath(); g.arc(gp.x, gp.y, ASH_RADIUS, 0, Math.PI * 2); g.stroke();
      g.restore();
    });
  }

  // a ring filling up round a player who's standing in the ash
  function drawAshDanger(g, now) {
    players.forEach((p) => {
      if (p.caught || !p.ashSince) return;
      const f = clamp((now - p.ashSince) / ASH_KILL_MS, 0, 1);
      g.strokeStyle = `rgba(255,${Math.round(220 - 200 * f)},${Math.round(150 - 130 * f)},0.95)`;
      g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.stroke();
    });
  }

""")

# ---------- 6. the boss ----------
block("  // ---- the Candy Kraken ----", "  function drawBoss(g, now) {", """  // ---- the Pumpkin King ----
  const bossScratch = document.createElement('canvas');
  bossScratch.width = 320; bossScratch.height = 320;
  const bossG = bossScratch.getContext('2d');

  // Everything the boss is made of, drawn on a scratch canvas centered on the
  // origin: thick green vine-tentacles writhing out from under a huge ribbed
  // orange pumpkin, a carved face, and a fire burning in its mouth. Ablaze, its
  // skin chars and cracks, the stem catches, and flames pour from eyes and mouth.
  function drawPumpkinParts(s, now, ablaze, stunned, screaming, boss) {
    const r = boss.radius;
    const look = boss.lookDir || { x: 0, y: 1 };
    const ang = Math.atan2(look.y, look.x);

    // tentacles
    const tentCount = 9;
    for (let i = 0; i < tentCount; i++) {
      const a = (i / tentCount) * Math.PI * 2 + Math.sin(now * 0.0017 + i) * 0.2;
      let len = r * (1.5 + 0.28 * Math.sin(now * 0.004 + i * 1.7 + boss.seed));
      if (stunned) len *= 0.8;
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const bow = (stunned ? 0.2 : 1) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.45;
      const mx = tx / 2 - Math.sin(a) * bow, my = ty / 2 + Math.cos(a) * bow;
      const col = ablaze ? (i % 2 ? '#3a4a1a' : '#2a3414') : (i % 2 ? '#5c9a30' : '#417022');
      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.3, col);
      s.strokeStyle = ablaze ? '#d9701e' : '#6fbf3a'; s.lineWidth = 1.8;
      s.beginPath(); s.arc(tx + Math.cos(a + 1.2) * 3, ty + Math.sin(a + 1.2) * 3, 3.4, a - 2, a + 3.4); s.stroke();
    }

    s.save();
    if (stunned) s.scale(1.06, 0.93);
    const rx = r, ry = r * 0.9;
    // shadowed underside, then the ribbed body
    s.fillStyle = ablaze ? '#1e0a04' : '#4a1a06';
    s.beginPath(); s.ellipse(0, ry * 0.1, rx * 1.02, ry * 1.03, 0, 0, Math.PI * 2); s.fill();
    const body = s.createRadialGradient(-rx * 0.3, -ry * 0.4, 3, 0, 0, rx * 1.15);
    if (ablaze) { body.addColorStop(0, '#b4501a'); body.addColorStop(0.55, '#6a2408'); body.addColorStop(1, '#1e0a04'); }
    else { body.addColorStop(0, '#ffb24a'); body.addColorStop(0.55, '#ee6a0e'); body.addColorStop(1, '#8f3208'); }
    s.fillStyle = body;
    s.beginPath(); s.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); s.fill();
    s.strokeStyle = ablaze ? 'rgba(20,6,2,0.8)' : 'rgba(100,32,4,0.6)'; s.lineWidth = 2.4;
    [-0.66, -0.34, 0, 0.34, 0.66].forEach((k) => {
      s.beginPath();
      s.ellipse(0, 0, rx * Math.abs(1 - Math.abs(k) * 0.75), ry, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      s.stroke();
    });
    if (ablaze) {                                           // glowing cracks in the charred skin
      s.strokeStyle = `rgba(255,140,40,${0.75 + 0.25 * Math.sin(now * 0.015)})`; s.lineWidth = 2;
      [[-0.7, -0.2, -0.45, -0.55], [0.72, -0.1, 0.5, -0.5], [-0.62, 0.45, -0.3, 0.7], [0.6, 0.5, 0.34, 0.74], [0.05, -0.85, -0.12, -0.6]].forEach(([x0, y0, x1, y1]) => {
        s.beginPath(); s.moveTo(rx * x0, ry * y0); s.lineTo(rx * (x0 + x1) / 2 + 4, ry * (y0 + y1) / 2 - 3); s.lineTo(rx * x1, ry * y1); s.stroke();
      });
    } else {
      s.fillStyle = 'rgba(255,255,255,0.28)';
      s.beginPath(); s.ellipse(-rx * 0.38, -ry * 0.5, rx * 0.26, ry * 0.12, -0.5, 0, Math.PI * 2); s.fill();
    }
    // stem, and a curling vine
    s.fillStyle = ablaze ? '#2a2a14' : '#4a5a1c';
    s.beginPath(); s.moveTo(-r * 0.14, -ry * 0.92); s.lineTo(r * 0.16, -ry * 0.92); s.lineTo(r * 0.24, -ry * 1.3); s.lineTo(-r * 0.2, -ry * 1.26); s.closePath(); s.fill();
    s.strokeStyle = ablaze ? '#3a4a1a' : '#4fae3a'; s.lineWidth = 3;
    s.beginPath(); s.moveTo(r * 0.2, -ry * 1.05); s.quadraticCurveTo(r * 0.8, -ry * 1.2, r * 0.7, -ry * 0.7); s.quadraticCurveTo(r * 0.6, -ry * 0.5, r * 0.45, -ry * 0.62); s.stroke();
    if (ablaze) {                                            // the stem's alight
      drawFlameTongue(s, r * 0.03, -ry * 1.2, r * 0.45, r * 0.7, now, 3 + boss.seed);
      drawFlameTongue(s, -r * 0.1, -ry * 1.2, r * 0.3, r * 0.45, now, 8 + boss.seed);
    }

    // the carved face: glowing eyes, and a mouth with a fire burning in it
    const fx = look.x * r * 0.06, fy = look.y * r * 0.04;
    s.save(); s.translate(fx, fy);
    const flick = 0.85 + 0.15 * Math.sin(now * 0.03 + boss.seed);
    const eyeCol = stunned ? '#8a5a2a' : screaming ? '#ffffff' : ablaze ? '#ff8a3a' : '#ffe27a';
    s.shadowColor = '#ff6a10'; s.shadowBlur = stunned ? 2 : 14;
    s.fillStyle = eyeCol; s.globalAlpha = stunned ? 0.8 : Math.min(1, 0.9 * flick + (screaming ? 0.2 : 0));
    [-1, 1].forEach((side) => {
      s.beginPath();
      s.moveTo(side * r * 0.62, -ry * 0.02); s.lineTo(side * r * 0.2, -ry * 0.02); s.lineTo(side * r * 0.42, -ry * 0.5); s.closePath(); s.fill();
    });
    s.shadowBlur = 0; s.globalAlpha = 1;
    if (stunned) {                                           // dizzy swirls where the pupils would be
      s.strokeStyle = '#2a0e04'; s.lineWidth = 2;
      [-1, 1].forEach((side) => {
        const ex = side * r * 0.42, ey = -ry * 0.16;
        s.beginPath();
        for (let a = 0; a < 9; a += 0.4) { const rr = a * r * 0.014; const px = ex + Math.cos(a + now * 0.01) * rr, py = ey + Math.sin(a + now * 0.01) * rr; if (a === 0) s.moveTo(px, py); else s.lineTo(px, py); }
        s.stroke();
      });
    }
    if (ablaze && !stunned) {                                // flames licking up from the eyes
      [-1, 1].forEach((side, i) => drawFlameTongue(s, side * r * 0.42, -ry * 0.22, r * 0.26, r * 0.4, now, 20 + i * 3 + boss.seed));
    }

    // the mouth: a wide jagged hollow with the fire inside it
    const open = screaming ? 1.35 : stunned ? 0.55 : 0.85;
    const mw = r * 0.78, mh = ry * 0.5 * open, my0 = ry * 0.3;
    s.beginPath();
    s.moveTo(-mw, my0 - mh * 0.15);
    const teeth = 8;
    for (let i = 0; i <= teeth; i++) {
      const x = -mw + (2 * mw * i) / teeth;
      s.lineTo(x, my0 + (i % 2 ? mh * 0.55 : mh * 1.0));            // bottom edge, zig-zag
    }
    for (let i = teeth; i >= 0; i--) {
      const x = -mw + (2 * mw * i) / teeth;
      s.lineTo(x, my0 - mh * (i % 2 ? 0.1 : 0.45));                  // top edge, zig-zag
    }
    s.closePath();
    s.save();
    s.clip();
    const fire = s.createLinearGradient(0, my0 - mh * 0.5, 0, my0 + mh);
    if (stunned) { fire.addColorStop(0, '#3a1608'); fire.addColorStop(1, '#6a2a0c'); }
    else { fire.addColorStop(0, '#ffe9a0'); fire.addColorStop(0.5, '#ff9a2e'); fire.addColorStop(1, '#c8300a'); }
    s.fillStyle = fire; s.fillRect(-mw, my0 - mh, mw * 2, mh * 2.4);
    if (!stunned) {                                          // flames roiling inside
      for (let i = 0; i < 6; i++) drawFlameTongue(s, -mw * 0.72 + i * mw * 0.288, my0 + mh * 0.95, r * 0.2, mh * (1.2 + 0.4 * Math.sin(now * 0.02 + i)), now, i * 2.3 + boss.seed);
    }
    s.restore();
    s.strokeStyle = ablaze ? '#1a0804' : '#5a1c04'; s.lineWidth = 2;
    s.stroke();
    // fire pouring out over the lip: big when it roars, small tongues otherwise, nearly dead when stunned
    if (!stunned) {
      const n = screaming ? 9 : 5;
      for (let i = 0; i < n; i++) {
        const x = -mw * 0.8 + (1.6 * mw * i) / (n - 1);
        const hgt = (screaming ? 0.62 : ablaze ? 0.45 : 0.34) * ry * (0.75 + 0.25 * Math.sin(now * 0.025 + i * 1.7 + boss.seed));
        drawFlameTongue(s, x, my0 - mh * 0.2, r * (screaming ? 0.3 : 0.2), hgt, now, i * 1.3 + boss.seed);
      }
    } else {
      for (let i = 0; i < 3; i++) drawFlameTongue(s, -mw * 0.4 + i * mw * 0.4, my0 - mh * 0.2, r * 0.12, ry * 0.18, now, i + boss.seed);
    }
    s.restore();
    s.restore();
  }

""")

rep("    drawPumpkinParts(s, now, boss.phase2, stunned, screaming);", "    drawPumpkinParts(s, now, boss.phase2, stunned, screaming, boss);")
rep("""    if (now < boss.frozenUntil) {
      g.fillStyle = 'rgba(140,220,255,0.35)'; g.beginPath(); g.arc(0, 0, boss.radius * 1.2, 0, Math.PI * 2); g.fill();
    }""", """    if (now < boss.frozenUntil) {
      g.fillStyle = 'rgba(140,220,255,0.35)'; g.beginPath(); g.arc(0, 0, boss.radius * 1.2, 0, Math.PI * 2); g.fill();
    }
    if (boss.phase === 'spiral' && !dying) {                 // the fire spiral: a muzzle flash where each fireball leaves
      const fl = 0.6 + 0.4 * Math.sin(now * 0.05);
      const mx = boss.lookDir.x * boss.radius * 0.85, my = boss.lookDir.y * boss.radius * 0.85;
      const gl = g.createRadialGradient(mx, my, 1, mx, my, boss.radius * 0.7);
      gl.addColorStop(0, `rgba(255,220,120,${0.8 * fl})`); gl.addColorStop(1, 'rgba(255,100,20,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(mx, my, boss.radius * 0.7, 0, Math.PI * 2); g.fill();
    }""")
rep("      g.strokeStyle = `rgba(255,255,255,${0.7 * (1 - tt)})`;", "      g.strokeStyle = `rgba(255,170,60,${0.75 * (1 - tt)})`;")
rep("  // rings of sound spreading from the boss while it screams", "  // rings of heat spreading from the boss while it roars")

# ---------- 7. overlays, bars, hud text ----------
rep("    ctx.fillStyle = `rgba(255,138,192,${alpha})`;\n    ctx.shadowColor = 'rgba(255,138,192,0.8)';", "    ctx.fillStyle = `rgba(255,150,60,${alpha})`;\n    ctx.shadowColor = 'rgba(255,120,30,0.8)';")
rep("boss.phase2 ? PHASE2_NAME_COLOR : '#ff8ac0';", "boss.phase2 ? PHASE2_NAME_COLOR : '#ffa84a';")
rep("""    if (boss.phase2) { grad.addColorStop(0, '#d8c4e0'); grad.addColorStop(0.5, '#9a88aa'); grad.addColorStop(1, '#4a3a58'); }
    else { grad.addColorStop(0, '#ffb0d6'); grad.addColorStop(0.5, '#ff6aa8'); grad.addColorStop(1, '#a82a68'); }""",
    """    if (boss.phase2) { grad.addColorStop(0, '#ff9a6a'); grad.addColorStop(0.5, '#ff4a1a'); grad.addColorStop(1, '#7a1404'); }
    else { grad.addColorStop(0, '#ffd27a'); grad.addColorStop(0.5, '#ff9a2e'); grad.addColorStop(1, '#b84a08'); }""")
rep("    if (now < p.slowUntil) {                    // pink glow round the edges while cotton candy's slowing you", "    if (now < p.slowUntil) {                    // grey haze round the edges while the ash is slowing you")
rep("vg.addColorStop(0, 'rgba(255,150,210,0)'); vg.addColorStop(1, 'rgba(255,150,210,0.3)');", "vg.addColorStop(0, 'rgba(120,110,110,0)'); vg.addColorStop(1, 'rgba(120,110,110,0.38)');")
rep("'THE CANDY KRAKEN CRUMBLES&hellip;<br>HAPPY HALLOWEEN!'", "'THE PUMPKIN KING BURNS OUT&hellip;<br>HAPPY HALLOWEEN!'")
rep("'Phase: 2 — WITHERED'", "'Phase: 2 — ABLAZE'")
rep("    ctx.strokeStyle = '#3a2a44';\n    ctx.lineWidth = 2;", "    ctx.strokeStyle = '#3a2a44';\n    ctx.lineWidth = 2;")

# the first viewport's background and any lingering strings
open(OUT, 'w', encoding='utf-8', newline='\n').write(s)
left = [(i + 1, l.strip()[:120]) for i, l in enumerate(s.split('\n')) if re.search(r'candy|kraken|corn|cotton|withered|gumdrop|peppermint|sprinkle', l, re.I)]
print('wrote', len(s.split('\n')), 'lines; leftovers:')
for x in left: print(x)
