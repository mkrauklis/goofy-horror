// The player: a hazmat-suited chimp seen from above, drawn like the hazmat men in
// the boss cutscenes (js/bosscutscene.js): a yellow suit with reflective tape, a
// grey backpack with two tanks and a hose up to the helmet, black gloves, and a
// yellow helmet with a dark teal visor. Every level script draws its players with
// these shared pieces (the legs stay in each level, since the swimming levels swap
// boots for flippers; held weapons are drawn between torso and head):
//   PlayerModel.suit(p)                      -- the suit colour (the player's colour, pulled towards hazmat yellow)
//   PlayerModel.drawTorso(g, R, p, bob, swing) -- backpack, torso and arms
//   PlayerModel.drawHead(g, R, p, bob)        -- the helmet
//   PlayerModel.draw(g, R, { x, y, color, facing: {x, y}, walkPhase })  -- the whole thing (menus)
(function () {
  const TAU = Math.PI * 2;
  const HAZMAT_YELLOW = '#ffe24d';

  function mix(a, b, v) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * v);
    return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${clamp(((n >> 16) & 255) + 255 * amt)},${clamp(((n >> 8) & 255) + 255 * amt)},${clamp((n & 255) + 255 * amt)})`;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  // the player's colour, pulled towards hazmat yellow so both players read as the cutscene's suit
  function suit(p) { return mix(p.color || '#ffa84d', HAZMAT_YELLOW, 0.62); }

  // backpack with two tanks, torso with reflective tape, and the arms
  function drawTorso(g, R, p, bob, swing) {
    const u = R * 0.9;
    const sw = swing / (R * 0.62);
    const A = suit(p), B = mix(A, '#8a6400', 0.42), line = mix(A, '#3a2a00', 0.7);
    g.save();
    // backpack and tanks, with the hose running up to the helmet
    g.fillStyle = '#59606b'; g.strokeStyle = '#22262c'; g.lineWidth = 1;
    rr(g, -1.12 * u, -0.5 * u, 0.62 * u, 1.0 * u, 0.2 * u); g.fill(); g.stroke();
    [-1, 1].forEach((s) => {
      const tg = g.createRadialGradient(-0.86 * u, s * 0.26 * u - 0.05 * u, 0.5, -0.82 * u, s * 0.26 * u, 0.26 * u);
      tg.addColorStop(0, '#f2f4f8'); tg.addColorStop(1, '#8d94a0');
      g.fillStyle = tg; g.beginPath(); g.arc(-0.82 * u, s * 0.26 * u, 0.23 * u, 0, TAU); g.fill(); g.stroke();
    });
    g.strokeStyle = '#2a2e34'; g.lineWidth = 0.14 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-0.6 * u, 0); g.quadraticCurveTo(-0.45 * u, -0.5 * u, -0.1 * u, -0.3 * u); g.stroke();

    // torso, bobbing with the stride
    g.save();
    g.translate(0, -bob);
    const tg = g.createLinearGradient(0, -u, 0, u);
    tg.addColorStop(0, B); tg.addColorStop(0.5, A); tg.addColorStop(1, B);
    g.fillStyle = tg; g.strokeStyle = line; g.lineWidth = 1.1;
    g.beginPath(); g.ellipse(0, 0, 0.66 * u, 1.0 * u, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(228,230,234,0.78)';
    [-0.2, 0.24].forEach((x) => { rr(g, (x - 0.04) * u, -0.84 * u, 0.09 * u, 1.68 * u, 0.04 * u); g.fill(); });
    g.strokeStyle = 'rgba(60,45,0,0.5)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-0.55 * u, 0); g.lineTo(0.6 * u, 0); g.stroke();
    g.restore();

    // arms, swinging opposite their same-side leg, hands brought in towards the middle
    // so a held weapon sits between them
    [-1, 1].forEach((s) => {
      const hx = (0.5 - sw * 0.34 * s) * u, hy = s * 0.74 * u;
      const sx0 = 0.02 * u, sy0 = s * 0.84 * u;
      const cx = (sx0 + hx) / 2 + 0.1 * u, cy = (sy0 + hy) / 2 + s * 0.2 * u;
      g.lineCap = 'round';
      g.strokeStyle = line; g.lineWidth = 0.5 * u;
      g.beginPath(); g.moveTo(sx0, sy0); g.quadraticCurveTo(cx, cy, hx, hy); g.stroke();
      g.strokeStyle = A; g.lineWidth = 0.37 * u;
      g.beginPath(); g.moveTo(sx0, sy0); g.quadraticCurveTo(cx, cy, hx, hy); g.stroke();
      g.fillStyle = '#25272b'; g.beginPath(); g.arc(hx, hy, 0.22 * u, 0, TAU); g.fill();
    });
    g.restore();
  }

  // the yellow helmet with its dark teal visor, a band across the crown in the player's colour
  function drawHead(g, R, p, bob) {
    const u = R * 0.9;
    const A = suit(p), B = mix(A, '#8a6400', 0.42), line = mix(A, '#3a2a00', 0.7);
    g.save();
    g.translate(0.14 * u, -bob);
    const hg = g.createRadialGradient(-0.2 * u, -0.25 * u, 0.5, 0, 0, 0.78 * u);
    hg.addColorStop(0, mix(A, '#ffffff', 0.5)); hg.addColorStop(1, B);
    g.fillStyle = hg; g.strokeStyle = line; g.lineWidth = 1.1;
    g.beginPath(); g.arc(0, 0, 0.68 * u, 0, TAU); g.fill(); g.stroke();
    // the colour band over the crown, and the filter on the back of the helmet
    g.strokeStyle = p.color || '#ff8a3d'; g.lineWidth = 0.16 * u; g.lineCap = 'butt';
    g.beginPath(); g.arc(0, 0, 0.5 * u, Math.PI * 0.62, Math.PI * 1.38); g.stroke();
    g.fillStyle = '#3a3000'; g.beginPath(); g.arc(-0.28 * u, 0, 0.12 * u, 0, TAU); g.fill();
    // visor
    const vg = g.createLinearGradient(0.1 * u, -0.4 * u, 0.6 * u, 0.4 * u);
    vg.addColorStop(0, '#2c6f7d'); vg.addColorStop(1, '#0b232a');
    g.fillStyle = vg; g.strokeStyle = '#06161a'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(0.36 * u, 0, 0.36 * u, 0.5 * u, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(0.28 * u, -0.2 * u, 0.13 * u, 0.05 * u, -0.5, 0, TAU); g.fill();
    g.restore();
  }

  function drawPlayerModel(g, R, p) {
    g.save();
    g.translate(p.x, p.y);
    g.beginPath();
    g.ellipse(0, R * 1.05, R * 0.85, R * 0.26, 0, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fill();
    g.rotate(Math.atan2(p.facing.y, p.facing.x));
    const swing = Math.sin(p.walkPhase) * R * 0.62;
    const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
    const u = R * 0.9;
    [-1, 1].forEach((s) => {
      g.fillStyle = '#3b4047'; g.strokeStyle = '#16181b'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(s * swing * 0.9, s * 0.38 * u, 0.44 * u, 0.27 * u, 0, 0, TAU); g.fill(); g.stroke();
    });
    drawTorso(g, R, p, bob, swing);
    drawHead(g, R, p, bob);
    g.restore();
  }

  window.PlayerModel = { draw: drawPlayerModel, drawTorso, drawHead, suit, ORANGE: '#ff8a3d', GREEN: '#3ddc84' };
})();
