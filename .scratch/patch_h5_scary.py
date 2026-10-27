P = 'C:/claude_p/goofy-horror/js/halloween5.js'
raw = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')


def rep(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)


# ---- darker, thorned vines ----
rep("const col = flourished ? (i % 2 ? '#4fb82a' : '#2f8a1c') : (i % 2 ? '#5c9a30' : '#417022');\n      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.3, col);",
    """const col = flourished ? (i % 2 ? '#4fb82a' : '#2f8a1c') : (i % 2 ? '#456f22' : '#2c4c14');
      drawTaperedTentacle(s, tx, ty, mx, my, r * 0.3, col);
      [0.3, 0.55, 0.8].forEach((u, j) => {                       // barbs along every vine
        const px = 2 * (1 - u) * u * mx + u * u * tx, py = 2 * (1 - u) * u * my + u * u * ty;
        const na = a + ((i + j) % 2 ? 1.25 : -1.25);
        s.fillStyle = flourished ? '#e8f8c0' : '#d6caa0';
        s.beginPath();
        s.moveTo(px - Math.cos(a) * 3.5, py - Math.sin(a) * 3.5);
        s.lineTo(px + Math.cos(na) * r * 0.15, py + Math.sin(na) * r * 0.15);
        s.lineTo(px + Math.cos(a) * 3.5, py + Math.sin(a) * 3.5);
        s.closePath(); s.fill();
      });""")

# ---- the burnt, cracked body ----
a = s.index("    // shadowed underside, then the ribbed body")
b = s.index("    if (flourished) {                                           // vines wrapped round the body, with leaves")
s = s[:a] + """    // shadowed underside, then the burnt, ribbed body
    s.fillStyle = flourished ? '#0a2006' : '#200800';
    s.beginPath(); s.ellipse(0, ry * 0.1, rx * 1.02, ry * 1.03, 0, 0, Math.PI * 2); s.fill();
    const body = s.createRadialGradient(-rx * 0.3, -ry * 0.4, 3, 0, 0, rx * 1.15);
    if (flourished) { body.addColorStop(0, '#9bd25a'); body.addColorStop(0.55, '#3f8a24'); body.addColorStop(1, '#143a0c'); }
    else { body.addColorStop(0, '#e0861e'); body.addColorStop(0.5, '#b8420a'); body.addColorStop(1, '#3a0e02'); }
    s.fillStyle = body;
    s.beginPath(); s.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); s.fill();
    s.strokeStyle = flourished ? 'rgba(4,30,4,0.75)' : 'rgba(30,6,0,0.78)'; s.lineWidth = 3.2;
    [-0.66, -0.34, 0, 0.34, 0.66].forEach((k) => {
      s.beginPath();
      s.ellipse(0, 0, rx * Math.abs(1 - Math.abs(k) * 0.75), ry, 0, Math.PI * 0.5, Math.PI * 1.5, k < 0);
      s.stroke();
    });
    // glowing fissures splitting its skin, as if the fire inside is bursting out
    const crackRgb = flourished ? '110,200,255' : '255,140,30';
    const pulse = (stunned ? 0.25 : 0.55) + (stunned ? 0.05 : 0.35) * Math.sin(now * 0.004 + boss.seed);
    s.lineCap = 'round'; s.lineJoin = 'round';
    [[-2.6, 0.9], [-1.95, 1.0], [-1.2, 0.8], [-0.45, 0.95], [0.4, 1.0], [1.15, 0.9], [2.0, 1.0], [2.7, 0.85]].forEach(([ca, ln], i) => {
      let px = Math.cos(ca) * rx * 0.5, py = Math.sin(ca) * ry * 0.5;
      const pts = [[px, py]];
      for (let k = 1; k <= 4; k++) {
        const ca2 = ca + Math.sin(i * 3.1 + k * 2.3) * 0.55;
        px += Math.cos(ca2) * rx * ln * 0.13; py += Math.sin(ca2) * ry * ln * 0.13;
        pts.push([px, py]);
      }
      [[`rgba(${crackRgb},${pulse * 0.85})`, 2.6], ['rgba(255,245,210,' + pulse * 0.55 + ')', 1]].forEach(([col, w]) => {
        s.strokeStyle = col; s.lineWidth = w;
        s.beginPath(); pts.forEach(([x, y], k) => (k ? s.lineTo(x, y) : s.moveTo(x, y))); s.stroke();
      });
    });
    s.fillStyle = 'rgba(255,255,255,0.12)';
    s.beginPath(); s.ellipse(-rx * 0.38, -ry * 0.55, rx * 0.22, ry * 0.08, -0.5, 0, Math.PI * 2); s.fill();
""" + s[b:]

# ---- the face and mouth ----
a = s.index("    // the carved face: glowing eyes, and a mouth with a fire burning in it")
b = s.index("  function drawBoss(g, now) {")
s = s[:a] + """    // the carved face: clawed-out slanted eyes with slit pupils that never leave
    // you, and a hideous wide mouth full of fangs with a fire burning inside it
    const fx = look.x * r * 0.06, fy = look.y * r * 0.04;
    s.save(); s.translate(fx, fy);
    const flick = 0.85 + 0.15 * Math.sin(now * 0.03 + boss.seed);
    const hot = flourished ? '#7ad4ff' : '#ffb21e';
    const core = screaming ? '#ffffff' : flourished ? '#f4fcff' : '#fff1b0';
    const dimCol = flourished ? '#183a5a' : '#6a2a0a';
    // heavy brow ridges, and a hole where the nose should be
    s.fillStyle = 'rgba(14,2,0,0.6)';
    [-1, 1].forEach((side) => {
      s.beginPath();
      s.moveTo(side * r * 0.05, -ry * 0.16); s.lineTo(side * r * 0.5, -ry * 0.62); s.lineTo(side * r * 0.95, -ry * 0.66); s.lineTo(side * r * 0.7, -ry * 0.34); s.lineTo(side * r * 0.3, -ry * 0.12);
      s.closePath(); s.fill();
    });
    s.fillStyle = '#140200';
    s.beginPath(); s.moveTo(0, 0); s.lineTo(-r * 0.08, ry * 0.2); s.lineTo(r * 0.08, ry * 0.2); s.closePath(); s.fill();
    const EYE = [[0.10, 0.14], [0.14, -0.02], [0.32, -0.2], [0.55, -0.36], [0.88, -0.54], [0.66, -0.2], [0.42, -0.01], [0.22, 0.06]];
    [-1, 1].forEach((side) => {
      s.save();
      s.translate(side * r * 0.42, -ry * 0.2);
      if (stunned) s.scale(1, 0.32);                           // half-shut, the light draining out
      s.shadowColor = hot; s.shadowBlur = stunned ? 0 : 20;
      s.fillStyle = stunned ? dimCol : hot; s.globalAlpha = stunned ? 0.9 : Math.min(1, 0.92 * flick + (screaming ? 0.15 : 0));
      s.beginPath();
      EYE.forEach(([x, y], i) => { const px = side * (x - 0.42) * r, py = (y + 0.2) * ry; if (i) s.lineTo(px, py); else s.moveTo(px, py); });
      s.closePath(); s.fill();
      s.shadowBlur = 0;
      if (!stunned) {
        s.fillStyle = core; s.globalAlpha = 0.9;                // the white-hot heart of the eye
        s.beginPath(); s.ellipse(side * r * 0.04, -ry * 0.02, r * 0.17, ry * 0.07, side * -0.5, 0, Math.PI * 2); s.fill();
        s.fillStyle = '#160300'; s.globalAlpha = 1;             // a slit pupil, always on you
        s.beginPath(); s.ellipse(side * r * 0.04 + look.x * r * 0.05, -ry * 0.02 + look.y * ry * 0.03, r * (screaming ? 0.012 : 0.026), ry * 0.1, side * -0.2, 0, Math.PI * 2); s.fill();
      }
      s.restore();
    });
    s.globalAlpha = 1;
    if (!stunned) {                                          // molten tears running from the eyes
      [-1, 1].forEach((side, i) => {
        const dl = ry * (0.16 + 0.1 * Math.sin(now * 0.004 + i * 2 + boss.seed));
        s.fillStyle = hot; s.globalAlpha = 0.75;
        s.beginPath(); s.moveTo(side * r * 0.4 - 2, -ry * 0.12); s.lineTo(side * r * 0.4 + 2, -ry * 0.12); s.lineTo(side * r * 0.4, -ry * 0.12 + dl); s.closePath(); s.fill();
        s.globalAlpha = 1;
      });
    }
    if (flourished && !stunned) {                            // blue flames licking up from the eyes
      [-1, 1].forEach((side, i) => drawFlameTongue(s, side * r * 0.42, -ry * 0.3, r * 0.26, r * 0.4, now, 20 + i * 3 + boss.seed, true));
    }

    // the mouth: a rictus stretched across the whole face, fire roaring in the throat
    const open = screaming ? 1.45 : stunned ? 0.5 : 0.9;
    const mw = r * 0.88, mh = ry * 0.52 * open, my0 = ry * 0.32;
    const topY = (x) => { const u = (x + mw) / (2 * mw); return (1 - u) * (1 - u) * (my0 - mh * 0.3) + 2 * u * (1 - u) * (my0 - mh * 0.55) + u * u * (my0 - mh * 0.3); };
    const botY = (x) => my0 + mh * (1.2 - 1.5 * (x / mw) * (x / mw));
    s.beginPath();
    s.moveTo(-mw, my0 - mh * 0.3);
    s.quadraticCurveTo(0, my0 - mh * 0.55, mw, my0 - mh * 0.3);
    s.quadraticCurveTo(mw * 0.6, my0 + mh * 1.15, 0, my0 + mh * 1.2);
    s.quadraticCurveTo(-mw * 0.6, my0 + mh * 1.15, -mw, my0 - mh * 0.3);
    s.closePath();
    s.save();
    s.clip();
    const fire = s.createLinearGradient(0, my0 - mh * 0.5, 0, my0 + mh * 1.2);
    if (stunned) { fire.addColorStop(0, flourished ? '#0a1a3a' : '#3a1608'); fire.addColorStop(1, flourished ? '#183a7a' : '#6a2a0c'); }
    else if (flourished) { fire.addColorStop(0, '#f0fcff'); fire.addColorStop(0.5, '#4aa8ff'); fire.addColorStop(1, '#1a3acc'); }
    else { fire.addColorStop(0, '#ffe9a0'); fire.addColorStop(0.5, '#ff9a2e'); fire.addColorStop(1, '#c8300a'); }
    s.fillStyle = fire; s.fillRect(-mw, my0 - mh, mw * 2, mh * 2.6);
    s.fillStyle = 'rgba(10,0,0,0.5)';                          // a black void behind the flames
    s.beginPath(); s.ellipse(0, my0 + mh * 0.3, mw * 0.55, mh * 0.5, 0, 0, Math.PI * 2); s.fill();
    if (!stunned) {                                          // flames roiling inside
      for (let i = 0; i < 6; i++) drawFlameTongue(s, -mw * 0.72 + i * mw * 0.288, my0 + mh * 1.0, r * 0.2, mh * (1.2 + 0.4 * Math.sin(now * 0.02 + i)), now, i * 2.3 + boss.seed, flourished);
    }
    s.restore();
    s.strokeStyle = flourished ? '#0a2a08' : '#3a1002'; s.lineWidth = 3;
    s.stroke();
    // fire pouring out over the lip: big when it roars, small tongues otherwise, nearly dead when stunned
    if (!stunned) {
      const n = screaming ? 9 : 5;
      for (let i = 0; i < n; i++) {
        const x = -mw * 0.8 + (1.6 * mw * i) / (n - 1);
        const hgt = (screaming ? 0.62 : flourished ? 0.45 : 0.34) * ry * (0.75 + 0.25 * Math.sin(now * 0.025 + i * 1.7 + boss.seed));
        drawFlameTongue(s, x, topY(x) + mh * 0.1, r * (screaming ? 0.3 : 0.2), hgt, now, i * 1.3 + boss.seed, flourished);
      }
    } else {
      for (let i = 0; i < 3; i++) drawFlameTongue(s, -mw * 0.4 + i * mw * 0.4, topY(0) + mh * 0.1, r * 0.12, ry * 0.18, now, i + boss.seed, flourished);
    }
    // fangs: two uneven rows that interlock, the upper ones the longest
    const NF = 9;
    s.fillStyle = flourished ? '#dcecb0' : '#eadfba'; s.strokeStyle = 'rgba(30,10,0,0.85)'; s.lineWidth = 1.2; s.lineJoin = 'round';
    const fang = (x, y0, dir, len, w, lean) => {
      s.beginPath(); s.moveTo(x - w, y0); s.lineTo(x + lean, y0 + dir * len); s.lineTo(x + w, y0); s.closePath(); s.fill(); s.stroke();
    };
    for (let i = 0; i < NF; i++) {
      const x = -mw * 0.9 + (1.8 * mw * i) / (NF - 1);
      const kk = 0.55 + 0.45 * (((i * 37 + 11) % 7) / 6);
      fang(x, topY(x) - 1, 1, mh * kk * (i % 3 === 1 ? 1.35 : 1.0), r * 0.055, (i % 2 ? 1 : -1) * r * 0.02);
    }
    for (let i = 0; i < NF - 1; i++) {
      const x = -mw * 0.9 + (1.8 * mw * (i + 0.5)) / (NF - 1);
      const kk = 0.5 + 0.5 * (((i * 53 + 5) % 7) / 6);
      fang(x, botY(x) + 1, -1, mh * 0.8 * kk, r * 0.05, (i % 2 ? -1 : 1) * r * 0.02);
    }
    // molten drool strung from the lower lip
    [-0.55, -0.2, 0.25, 0.6].forEach((k, i) => {
      const x = mw * k, y0 = botY(x);
      const dl = ry * (0.12 + 0.18 * (0.5 + 0.5 * Math.sin(now * 0.003 + i * 1.9 + boss.seed))) * (screaming ? 1.6 : 1) * (stunned ? 0.6 : 1);
      s.strokeStyle = stunned ? dimCol : hot; s.lineWidth = 2.4; s.lineCap = 'round';
      s.beginPath(); s.moveTo(x, y0); s.lineTo(x, y0 + dl); s.stroke();
      s.fillStyle = stunned ? dimCol : hot;
      s.beginPath(); s.arc(x, y0 + dl, 2.8, 0, Math.PI * 2); s.fill();
    });
    s.restore();
    s.restore();
  }

""" + s[b:]
open(P, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)

# ---- sync the Monsterpedia copy ----
a = s.index("  function drawPumpkinParts(s, now, flourished, stunned, screaming, boss) {")
b = s.index("  function drawBoss(g, now) {")
func = s[a:b].rstrip('\n') + '\n'
P2 = 'C:/claude_p/goofy-horror/js/monsterpedia.js'
t = open(P2, encoding='utf-8', newline='').read()
crlf2 = '\r\n' in t
t = t.replace('\r\n', '\n')
a2 = t.index("  function drawPumpkinParts(s, now, flourished, stunned, screaming, boss) {")
b2 = t.index("\n  }\n", a2) + 5
t = t[:a2] + func + t[b2:]
open(P2, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf2 else t)
print('ok')
