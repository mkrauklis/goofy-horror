P = 'C:/claude_p/goofy-horror/js/halloween5.js'
s = open(P, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a))
    s = s.replace(a, b)


# ---- constants ----
rep("  // Attack 5 (flourished phase only) -- three 5x5 clouds of poisonous spores.", """  // Attack 5 (flourished phase only) -- the thorn burst: it curls up all its
  // vines, then a shockwave of thorn vines bursts out 6 tiles in every direction.
  const THORN_CURL_MS = 1700;       // the warning: vines curl in, a red circle shows the reach
  const THORN_BURST_MS = 450;       // the shockwave races out to full reach
  const THORN_HOLD_MS = 650;        // ...and stays out
  const THORN_RETRACT_MS = 350;
  const THORN_REACH = TILE * 6;     // from the edge of its body

  // Attack 6 (flourished phase only) -- three 5x5 clouds of poisonous spores.""")
# keep the old comment numbering consistent
s = s.replace("  // Attack 6 (flourished phase only) -- three 5x5 clouds of poisonous spores. Stay in", "  // Attack 6 (flourished phase only) -- three 5x5 clouds of poisonous spores. Stay in")

# ---- boss state ----
rep("      vx: 0, vy: 0, whipAngle: 0,\n    };", "      vx: 0, vy: 0, whipAngle: 0,\n      // thorn burst\n      curl: 0, thornE: 0, thornBurst: false,\n    };")
rep("'idle' | 'spiral' | 'scream' | 'eruption' | 'whip' | 'spore' | 'stunned'", "'idle' | 'spiral' | 'scream' | 'eruption' | 'whip' | 'thorn' | 'spore' | 'stunned'")

# ---- attack pool & start ----
rep("  const PHASE2_ONLY_ATTACKS = ['spore'];", "  const PHASE2_ONLY_ATTACKS = ['spore', 'thorn'];")
rep("    } else if (kind === 'spore') {\n", """    } else if (kind === 'thorn') {
      boss.curl = 0; boss.thornE = 0; boss.thornBurst = false;
      spawnFloatingText(boss.x, boss.y - boss.radius - 14, 'CURLING UP...');
      playStunSound();
    } else if (kind === 'spore') {
""")

# ---- update ----
rep("  function updateSporeAttack(now) {", """  // Attack 5: every vine curls up tight against the body (a red circle on the
  // floor shows how far the burst will reach), then a shockwave of thorn
  // vines bursts out 6 tiles in every direction, holds, and snaps back.
  function updateThornAttack(now) {
    const el = now - boss.phaseStartedAt;
    if (el < THORN_CURL_MS) {
      boss.curl = el / THORN_CURL_MS; boss.thornE = 0;
      return;
    }
    const b = el - THORN_CURL_MS;
    if (!boss.thornBurst) { boss.thornBurst = true; playExplosion(); spawnEmberBurst(boss.x, boss.y, 24, 260); }
    if (b < THORN_BURST_MS) {
      const u = b / THORN_BURST_MS;
      boss.thornE = 1 - (1 - u) * (1 - u); boss.curl = 1 - u;
    } else if (b < THORN_BURST_MS + THORN_HOLD_MS) {
      boss.thornE = 1; boss.curl = 0;
    } else {
      const u = (b - THORN_BURST_MS - THORN_HOLD_MS) / THORN_RETRACT_MS;
      boss.thornE = Math.max(0, 1 - u); boss.curl = 0;
      if (u >= 1) { boss.thornE = 0; finishAttack(now); }
    }
  }
  function thornRadius() { return boss.radius + THORN_REACH * boss.thornE; }
  function updateThornHits(now) {
    if (boss.phase !== 'thorn' || boss.defeated || now < boss.frozenUntil || boss.thornE <= 0.02) return;
    const R = thornRadius();
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < R) triggerCaught(p, now);
    });
  }

  function updateSporeAttack(now) {""")
rep("    if (now < boss.frozenUntil) return;\n    switch (boss.phase) {", "    if (boss.phase !== 'thorn') { boss.curl = 0; boss.thornE = 0; }\n    if (now < boss.frozenUntil) return;\n    switch (boss.phase) {")
rep("      case 'whip': updateWhipAttack(now, dt); break;\n", "      case 'whip': updateWhipAttack(now, dt); break;\n      case 'thorn': updateThornAttack(now); break;\n")
rep("        updateWhipHits(now);\n", "        updateWhipHits(now);\n        updateThornHits(now);\n")

# ---- drawing: the shockwave ----
rep("  // ---- the Pumpkin King ----\n", """  // The thorn burst: a flashing red circle on the floor while the vines curl up,
  // then a shockwave of thorn vines racing out 6 tiles in every direction.
  function drawThornShockwave(g, now) {
    if (boss.phase !== 'thorn' || boss.defeated) return;
    const reachR = boss.radius + THORN_REACH;
    if (!boss.thornBurst) {
      const el = now - boss.phaseStartedAt;
      const blink = Math.floor(el / (el > THORN_CURL_MS * 0.7 ? 80 : 160)) % 2 === 0;
      g.beginPath(); g.arc(boss.x, boss.y, reachR, 0, Math.PI * 2);
      g.fillStyle = blink ? 'rgba(255,40,40,0.28)' : 'rgba(255,40,40,0.08)'; g.fill();
      g.strokeStyle = blink ? '#ff3030' : 'rgba(255,70,70,0.45)'; g.lineWidth = 3; g.stroke();
      return;
    }
    const R = thornRadius();
    if (boss.thornE <= 0.01) return;
    g.save();
    g.beginPath(); g.arc(boss.x, boss.y, R, 0, Math.PI * 2);
    g.fillStyle = 'rgba(30,90,16,0.38)'; g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    const N = 44;
    for (let j = 0; j < N; j++) {
      const a0 = (j / N) * Math.PI * 2 + 0.07 * Math.sin(j * 2.3);
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const f = k / 8;
        const a = a0 + Math.sin(now * 0.006 + j * 1.7 + f * 4) * 0.05 * f;
        const d = boss.radius * 0.8 + f * (R - boss.radius * 0.8);
        pts.push({ x: boss.x + Math.cos(a) * d, y: boss.y + Math.sin(a) * d, a });
      }
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? '#0e300c' : (j % 2 ? '#3f9a22' : '#2f7a1a');
        for (let k = 1; k < pts.length; k++) {
          g.lineWidth = (pass === 0 ? 11 : 7) * (1 - (k / 8) * 0.6);
          g.beginPath(); g.moveTo(pts[k - 1].x, pts[k - 1].y); g.lineTo(pts[k].x, pts[k].y); g.stroke();
        }
      }
      g.fillStyle = '#e8f0c8';                                    // the thorns
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k], side = k % 2 ? 1 : -1;
        const tx = Math.cos(p.a + side * Math.PI / 2), ty = Math.sin(p.a + side * Math.PI / 2);
        const fx = Math.cos(p.a), fy = Math.sin(p.a);
        g.beginPath();
        g.moveTo(p.x - fx * 5 + tx * 3, p.y - fy * 5 + ty * 3);
        g.lineTo(p.x + tx * 13 + fx * 3, p.y + ty * 13 + fy * 3);
        g.lineTo(p.x + fx * 5 + tx * 3, p.y + fy * 5 + ty * 3);
        g.closePath(); g.fill();
      }
    }
    g.strokeStyle = `rgba(200,255,130,${0.85 * Math.min(1, boss.thornE * 1.5)})`; g.lineWidth = 5;   // the shockwave's front
    g.beginPath(); g.arc(boss.x, boss.y, R, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  // ---- the Pumpkin King ----
""")
rep("    drawWhipVines(ctx, now);\n    drawBoss(ctx, now);\n", "    drawWhipVines(ctx, now);\n    drawThornShockwave(ctx, now);\n    drawBoss(ctx, now);\n")

# ---- boss look: vines curl up ----
rep("    const tentCount = flourished ? 16 : 9;\n", "    const curl = boss.curl || 0;                                // 0..1: how tightly the vines have curled up against it\n    const tentCount = flourished ? 16 : 9;\n")
rep("      if (stunned) len *= 0.8;\n      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;\n      const bow = (stunned ? 0.2 : 1) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.45;",
    "      if (stunned) len *= 0.8;\n      len *= 1 - 0.68 * curl;\n      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;\n      const bow = (stunned ? 0.2 : 1 - 0.6 * curl) * Math.sin(now * 0.005 + i * 2.3 + boss.seed) * r * 0.45 + curl * r * 0.35;")
# while curling the body trembles
rep("    if (screaming) g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);", "    if (screaming) g.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);\n    else if (boss.curl > 0.3 && boss.phase === 'thorn') g.translate((Math.random() - 0.5) * 4 * boss.curl, (Math.random() - 0.5) * 4 * boss.curl);")

open(P, 'w', encoding='utf-8', newline='').write(s)
print('ok')
