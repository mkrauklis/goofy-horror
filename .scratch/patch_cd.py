def patch(path, edits):
    s = open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in s
    s = s.replace('\r\n', '\n')
    for a, b in edits:
        assert s.count(a) == 1, (path, s.count(a), a[:60])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)


patch('C:/claude_p/goofy-horror/js/customdata.js', [
    ("else if (ch !== '#' && ch !== '.' && ch !== 'S') out = '.';",
     "else if (ch !== '#' && ch !== '.' && ch !== 'S' && ch !== 'L') out = '.';"),
    ("          if (seen[i] || L.grid[ny][nx] === '#') return;",
     "          if (seen[i] || L.grid[ny][nx] === '#' || L.grid[ny][nx] === 'L') return; // lava kills, so it can't be walked through"),
    ("  //  B bomb spawn (mini boss: where bombs appear)",
     "  //  B bomb spawn (mini boss: where bombs appear)   L lava (walking on it burns you to death)"),
])

patch('C:/claude_p/goofy-horror/js/custommonster.js', [
    ("""  function draw(g, design, o) {
    o = o || {};
    const size = design.size || 22;""", """  // Obsidian: the whole monster hardens into glossy black glass. Drawn to a
  // scratch canvas first so the dark tint only lands on the monster's own pixels.
  let scratch = null;
  function drawObsidian(g, design, o) {
    const size = design.size || 22;
    const half = Math.ceil(size * 3.4) + 24;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width !== half * 2) { scratch.width = half * 2; scratch.height = half * 2; }
    const sg = scratch.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, scratch.width, scratch.height);
    draw(sg, design, Object.assign({}, o, { x: half, y: half, obsidian: 0, rage: 0, tired: false, flash: 0 }));
    sg.globalCompositeOperation = 'source-atop';
    sg.fillStyle = `rgba(16,12,24,${0.84 * o.obsidian})`;
    sg.fillRect(0, 0, scratch.width, scratch.height);
    const gl = sg.createLinearGradient(half - size, half - size, half + size, half + size);
    gl.addColorStop(0, `rgba(220,200,255,${0.0})`);
    gl.addColorStop(0.45, `rgba(220,200,255,${0.32 * o.obsidian})`);
    gl.addColorStop(0.55, `rgba(220,200,255,${0.0})`);
    sg.fillStyle = gl;
    sg.fillRect(0, 0, scratch.width, scratch.height);
    sg.globalCompositeOperation = 'source-over';
    g.drawImage(scratch, (o.x || 0) - half, (o.y || 0) - half);
    if (o.flash) {
      g.save();
      g.fillStyle = `rgba(255,255,255,${0.55 * o.flash})`;
      g.beginPath(); g.arc(o.x || 0, o.y || 0, size * 1.05, 0, TAU); g.fill();
      g.restore();
    }
  }

  function draw(g, design, o) {
    o = o || {};
    if (o.obsidian > 0) { drawObsidian(g, design, o); return; }
    const size = design.size || 22;"""),
])
print('ok')
