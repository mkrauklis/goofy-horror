// The player: a chimp in a hazmat suit and a glass helmet, seen from above --
// the same drawing every level uses for its players (copied from the level
// scripts' drawPlayers, minus the held shotgun) so menus can show the real
// thing. Usage: PlayerModel.draw(g, R, { x, y, color, facing: {x, y}, walkPhase }).
(function () {
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) + 255 * amt);
    const g2 = clamp(((n >> 8) & 255) + 255 * amt);
    const b = clamp((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  function drawLimb(g, hipX, hipY, tipX, tipY, width, color, capColor, capR) {
    // A slight elbow/knee bow instead of a dead-straight line, plus a
    // lit hand/foot instead of a flat-filled circle -- more follow-up
    // for a more expressive chimp body.
    const mx = (hipX + tipX) / 2, my = (hipY + tipY) / 2;
    const dx = tipX - hipX, dy = tipY - hipY;
    const len = Math.hypot(dx, dy) || 1;
    const bend = len * 0.14;
    const bx = mx - (dy / len) * bend, by = my + (dx / len) * bend;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.quadraticCurveTo(bx, by, tipX, tipY);
    g.stroke();
    const capGrad = g.createRadialGradient(tipX - capR * 0.3, tipY - capR * 0.3, capR * 0.1, tipX, tipY, capR);
    capGrad.addColorStop(0, capColor);
    capGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.beginPath();
    g.arc(tipX, tipY, capR, 0, Math.PI * 2);
    g.fillStyle = capGrad;
    g.fill();
  }

  function drawPlayerModel(g, R, p) {
  g.save();
  g.translate(p.x, p.y);

  // ground shadow, drawn before rotation so it never tilts with the player
  g.beginPath();
  g.ellipse(0, R * 1.05, R * 0.85, R * 0.26, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fill();

  g.rotate(Math.atan2(p.facing.y, p.facing.x));

  // Legs swing fore/aft opposite each other; arms swing opposite their
  // same-side leg (contralateral, like a real walking gait). Frozen in
  // place while standing still rather than easing to neutral -- reads
  // as a mid-step pause, which is fine at this scale.
  const swing = Math.sin(p.walkPhase) * R * 0.62;
  const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
  const suitDark = shade(p.color, -0.45);
  const bootColor = '#2b2b28';

  // legs -- drawn first so the torso overlaps their hip ends
  drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
  drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);

  // oxygen tank + hose up to the collar
  g.strokeStyle = '#54544c';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-R * 1.3, -3);
  g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
  g.stroke();
  const tankGrad = g.createLinearGradient(-R * 1.5, -4.5, -R * 1.5, 4.5);
  tankGrad.addColorStop(0, shade('#54544c', 0.25));
  tankGrad.addColorStop(1, shade('#54544c', -0.25));
  g.fillStyle = tankGrad;
  g.fillRect(-R * 1.5, -4.5, 7, 9);

  // torso, lit from the upper-left, bobbing slightly with the stride
  g.save();
  g.translate(0, -bob);
  const bodyGrad = g.createRadialGradient(-R * 0.32, -R * 0.4, 1, 0, 0, R * 1.1);
  bodyGrad.addColorStop(0, shade(p.color, 0.25));
  bodyGrad.addColorStop(0.6, p.color);
  bodyGrad.addColorStop(1, shade(p.color, -0.35));
  g.beginPath();
  g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
  g.fillStyle = bodyGrad;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 1.5;
  g.stroke();

  // hazard chevron stripe across the chest
  g.save();
  g.beginPath();
  g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = 'rgba(20,20,15,0.85)';
  g.fillRect(-R * 1.1, -R * 0.24, R * 2.2, R * 0.17);
  g.fillStyle = 'rgba(255,200,40,0.9)';
  g.fillRect(-R * 1.1, -R * 0.08, R * 2.2, R * 0.09);
  g.restore();
  g.restore();

  // arms -- on top of the torso, swinging opposite their same-side leg
  drawLimb(g, 0, -R * 0.55, -swing * 0.8, -R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
  drawLimb(g, 0, R * 0.55, swing * 0.8, R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);

  // head group -- smaller than the torso and pushed out toward the
  // front, so the silhouette reads as a body with a head on it rather
  // than one circle sitting concentrically inside another (which, at
  // this scale, just looked like an eyeball: white sclera, dark iris,
  // catchlight).
  g.save();
  g.translate(R * 0.55, -bob);
  const headR = R * 0.5;

  // Chimp ears + muzzle, drawn first so the glass dome mostly
  // covers them -- only the bits that poke out past its round rim
  // show, same as a real head inside an open helmet. Direct
  // request: "make the player model a chimp with a helmet on", with
  // a later follow-up for more face/fur detail.
  const furShade = shade(p.color, -0.2);
  [-1, 1].forEach((side) => {
    g.beginPath();
    g.arc(-headR * 0.1, side * headR * 0.75, headR * 0.38, 0, Math.PI * 2);
    g.fillStyle = furShade;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 0.75;
    g.stroke();
    // a little inner-ear shading so the ears read as cupped, not flat
    g.beginPath();
    g.arc(-headR * 0.05, side * headR * 0.75, headR * 0.2, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fill();
  });
  // a small tuft of fur at the back of the head, poking past the
  // dome's rim the same way the ears do -- breaks up the dome's
  // silhouette on the side with no muzzle to do that job instead.
  g.beginPath();
  g.moveTo(-headR * 0.85, -headR * 0.2);
  g.quadraticCurveTo(-headR * 1.18, -headR * 0.06, -headR * 0.92, headR * 0.12);
  g.quadraticCurveTo(-headR * 1.08, headR * 0.2, -headR * 0.8, headR * 0.3);
  g.closePath();
  g.fillStyle = furShade;
  g.fill();
  g.beginPath();
  g.ellipse(headR * 0.65, headR * 0.1, headR * 0.5, headR * 0.38, 0, 0, Math.PI * 2);
  g.fillStyle = '#4a3828';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 0.75;
  g.stroke();
  g.beginPath();
  g.arc(headR * 1.0, headR * 0.0, headR * 0.07, 0, Math.PI * 2);
  g.arc(headR * 1.0, headR * 0.22, headR * 0.07, 0, Math.PI * 2);
  g.fillStyle = '#1c130c';
  g.fill();
  // a small mouth line under the nostrils
  g.beginPath();
  g.moveTo(headR * 0.88, headR * 0.38);
  g.quadraticCurveTo(headR * 1.02, headR * 0.46, headR * 1.16, headR * 0.36);
  g.strokeStyle = 'rgba(15,8,6,0.65)';
  g.lineWidth = headR * 0.08;
  g.lineCap = 'round';
  g.stroke();

  // sealed collar ring
  g.beginPath();
  g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
  g.strokeStyle = '#1c1c18';
  g.lineWidth = 2.5;
  g.stroke();

  // glassy helmet dome
  const helmetGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.35, 1, 0, 0, headR * 1.05);
  helmetGrad.addColorStop(0, '#ffffff');
  helmetGrad.addColorStop(0.35, 'rgba(224,226,216,0.95)');
  helmetGrad.addColorStop(1, 'rgba(150,155,146,0.92)');
  g.beginPath();
  g.arc(0, 0, headR, 0, Math.PI * 2);
  g.fillStyle = helmetGrad;
  g.fill();
  g.strokeStyle = '#1c1c18';
  g.lineWidth = 1.5;
  g.stroke();

  // a narrow faceplate slit, not a big round visor -- a flat band
  // across the front of the helmet reads as a mask, not a pupil.
  const visorGrad = g.createLinearGradient(0, -headR * 0.3, 0, headR * 0.3);
  visorGrad.addColorStop(0, '#1c2a33');
  visorGrad.addColorStop(1, '#03060a');
  g.beginPath();
  g.ellipse(headR * 0.32, 0, headR * 0.34, headR * 0.62, 0, 0, Math.PI * 2);
  g.fillStyle = visorGrad;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.moveTo(headR * 0.18, -headR * 0.4);
  g.lineTo(headR * 0.42, -headR * 0.15);
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = headR * 0.12;
  g.lineCap = 'round';
  g.stroke();

  g.restore();

  g.restore();
  }

  window.PlayerModel = { draw: drawPlayerModel, ORANGE: '#ff8a3d', GREEN: '#3ddc84' };
})();
