P = 'C:/claude_p/goofy-horror/js/halloween5.js'
raw = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in raw
s = raw.replace('\r\n', '\n')
a = s.index("    const EYE = [[")
b = s.index("    if (!stunned) {                                          // molten tears running")
new = """    // too many mismatched, bloodshot eyes: two huge bulging ones and a scatter of
    // little ones, sunk in dark sockets, each with a slit pupil that never leaves
    // you; they blink out of step, and dilate when it roars
    const EYES = [[-0.42, -0.2, 0.21, 0], [0.42, -0.2, 0.21, 1.3], [0, -0.64, 0.09, 2.1], [-0.74, -0.02, 0.08, 0.7], [0.74, -0.02, 0.08, 2.6], [-0.2, -0.52, 0.065, 3.1], [0.22, -0.5, 0.065, 1.9]];
    EYES.forEach(([ex, ey, er, ph]) => {
      const e = r * er * (1 + 0.2 * (screaming ? 1 : 0)), cx = ex * r, cy = ey * ry;
      if (!stunned) {
        s.fillStyle = flourished ? 'rgba(120,210,255,0.22)' : 'rgba(255,170,30,0.22)';        // a glow round the socket
        s.beginPath(); s.arc(cx, cy, e * 2, 0, Math.PI * 2); s.fill();
      }
      s.fillStyle = '#0c0200';                                      // the sunken socket
      s.beginPath(); s.ellipse(cx, cy, e * 1.28, e * 1.22, 0, 0, Math.PI * 2); s.fill();
      const blink = ((now * 0.001 + ph * 1.7) % (3.4 + ph * 0.5)) < 0.14;
      if (blink) {
        s.strokeStyle = stunned ? dimCol : hot; s.lineWidth = 2;
        s.beginPath(); s.moveTo(cx - e, cy); s.quadraticCurveTo(cx, cy + e * 0.5, cx + e, cy); s.stroke();
        return;
      }
      s.fillStyle = stunned ? (flourished ? '#6a8a9a' : '#9a8a5a') : screaming ? '#fff0c8' : flourished ? '#d8f4ff' : '#f2e8a0';
      s.beginPath(); s.arc(cx, cy, e, 0, Math.PI * 2); s.fill();
      s.strokeStyle = 'rgba(190,20,40,0.75)'; s.lineWidth = 1;     // bloodshot
      for (let k = 0; k < 6; k++) {
        const va = (k / 6) * Math.PI * 2 + ph;
        s.beginPath(); s.moveTo(cx + Math.cos(va) * e, cy + Math.sin(va) * e);
        s.lineTo(cx + Math.cos(va + 0.2) * e * 0.45, cy + Math.sin(va + 0.2) * e * 0.45); s.stroke();
      }
      const jx = Math.sin(now * 0.013 + ph * 3) * e * 0.06, jy = Math.cos(now * 0.017 + ph) * e * 0.06;
      s.fillStyle = '#080000';                                      // a slit pupil, staring at you
      s.beginPath(); s.ellipse(cx + look.x * e * 0.35 + jx, cy + look.y * e * 0.25 + jy, e * (screaming ? 0.1 : 0.17), e * 0.68, 0, 0, Math.PI * 2); s.fill();
      if (stunned) {                                                // heavy lids sagging over the top
        s.fillStyle = flourished ? '#10300a' : '#3a1204';
        s.beginPath(); s.ellipse(cx, cy - e * 0.05, e * 1.05, e * 0.8, 0, Math.PI, Math.PI * 2); s.fill();
      }
    });
"""
s = s[:a] + new + s[b:]
# tears now run from the big eyes' lower rim
s = s.replace("s.moveTo(side * r * 0.4 - 2, -ry * 0.12); s.lineTo(side * r * 0.4 + 2, -ry * 0.12); s.lineTo(side * r * 0.4, -ry * 0.12 + dl);",
              "s.moveTo(side * r * 0.42 - 2, ry * 0.0); s.lineTo(side * r * 0.42 + 2, ry * 0.0); s.lineTo(side * r * 0.42, ry * 0.0 + dl);")
open(P, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)

a = s.index("  function drawPumpkinParts(s, now, flourished, stunned, screaming, boss) {")
b = s.index("  function drawBoss(g, now) {")
func = s[a:b].rstrip('\n') + '\n'
P2 = 'C:/claude_p/goofy-horror/js/monsterpedia.js'
t = open(P2, encoding='utf-8', newline='').read()
c2 = '\r\n' in t
t = t.replace('\r\n', '\n')
a2 = t.index("  function drawPumpkinParts(s, now, flourished, stunned, screaming, boss) {")
b2 = t.index("\n  }\n", a2) + 5
t = t[:a2] + func + t[b2:]
open(P2, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if c2 else t)
print('ok')
