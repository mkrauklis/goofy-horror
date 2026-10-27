  // The Multipod: every monster in the game, bosses included, packed into
  // one swarm, each drawn with that monster's own model. Bosses are drawn
  // much bigger.
  function swarmRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // id order matches the Monsterpedia. Second value = size relative to the
  // swarm's spread: small pack creatures, normal, big armored ones, bosses.
  const SWARM_DEFS = [
    ['Crawler', 0.16], ['Drifter', 0.17], ['Caterpillar', 0.16], ['Mimic', 0.16], ['Crate Lurker', 0.15],
    ['Ashen One', 0.34], ['Knight', 0.17], ['Mine Dweller', 0.18], ['Vault Guardian', 0.24], ['Chain Wraith', 0.15],
    ['Dig Worm', 0.2], ['Last Knight', 0.34], ['Frost Tentacle', 0.17], ['Mutation', 0.17], ['Brood', 0.09],
    ['Thaw Spider', 0.16], ['Frozen Mutation', 0.34], ['Flood Eel', 0.17], ['Bog', 0.19], ['Current Eel', 0.17],
    ['Drain Swarm', 0.08], ['Cistern', 0.34], ['Grass Drifter', 0.17], ['Kindling', 0.16], ['Stalker', 0.16],
    ['Sentry', 0.17], ['Cultivator', 0.34], ['Reacher', 0.17], ['Gargoyle', 0.17], ['Warden', 0.17],
    ['Grotesque', 0.09], ['Garguantuagoyle', 0.36],
  ];
  // One of every monster, plus a few extra of the ones that come in packs
  // (the Brood, the Drain Swarm, the Grotesques).
  const SWARM_EXTRAS = [14, 14, 14, 14, 20, 20, 20, 20, 20, 20, 30, 30, 30, 30, 30, 30];
  function makeSwarmMembers(spread, seed) {
    const r = swarmRng(seed);
    const ids = SWARM_DEFS.map((_, i) => i).concat(SWARM_EXTRAS);
    const arr = ids.map((id) => ({
      id, ang: r() * Math.PI * 2, rad: Math.sqrt(r()) * spread,
      size: spread * SWARM_DEFS[id][1] * (0.92 + r() * 0.16),
      phase: r() * 10, spin: r() - 0.5,
    }));
    arr.sort((a, b) => b.size - a.size);
    return arr;
  }
  function swCirc(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  // Each member IS the actual model of the monster it's based on: the same
  // portrait drawing the Monsterpedia uses (window.MonsterModels, from
  // js/monsterpedia.js), scaled so its overall reach is about 1.5x the
  // member's body size. The model is rendered once into a cached sprite
  // (refreshed ~10x a second, so it still animates) rather than redrawn in
  // full for every one of the swarm's members every frame.
  function drawSwarmMember(g, id, s, now, ph, flash) {
    const M = window.MonsterModels;
    if (!M) return;
    const k = (s * 1.5) / M.extent(id);
    g.save();
    g.scale(k, k);
    g.drawImage(M.sprite(id, now), -80, -80);
    g.restore();
    if (flash) swCirc(g, 0, 0, s * 1.1, 'rgba(255,255,255,0.6)');
  }
  function drawSwarm(g, cx, cy, heading, now, members, spread, flash, scatter) {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    members.forEach((m) => {
      const a = m.ang + now * 0.0014 * m.spin;
      let u = Math.cos(a) * m.rad * 1.25 + Math.sin(now * 0.004 + m.phase) * spread * 0.03;
      let w = Math.sin(a) * m.rad * 0.8 + Math.cos(now * 0.0035 + m.phase) * spread * 0.03;
      if (scatter) { const k = 1 + scatter * 3.2; u *= k; w *= k; }
      g.save();
      g.translate(cx + u * cs - w * sn, cy + u * sn + w * cs);
      g.rotate(heading + Math.sin(now * 0.003 + m.phase) * 0.25 + (scatter ? scatter * m.spin * 6 : 0));
      if (scatter) g.globalAlpha = Math.max(0, 1 - scatter);
      drawSwarmMember(g, m.id, m.size, now, m.phase, flash);
      g.restore();
    });
  }
