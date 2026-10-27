P = 'C:/claude_p/goofy-horror/index.html'
t = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')


def rep(a, b):
    global t
    assert t.count(a) == 1, (a[:70], t.count(a))
    t = t.replace(a, b)


DESC = """    // one line on how each monster hunts, shown under its name when you hover its level
    const MONSTER_DESC = {
      0: 'Blind until your flashlight lands on its eye, then it locks on and charges.',
      1: 'Hunts by sound alone. Stand still and it has no idea you are there.',
      2: 'Slow and nearly harmless itself. The meat vines around it are the real threat.',
      3: 'Disguises itself as a hazmat-suited teammate until you get close.',
      4: 'A trap: a few item crates are secretly occupied. Only a faint jitter gives it away.',
      5: 'A giant, burning Crawler. It cannot see you until your flashlight finds its eye.',
      6: 'A Crawler in plate armor with a sword, patrolling the stone halls on foot.',
      7: 'Stone-winged and full of teeth, with tentacles 2.5x as thick as normal.',
      8: 'An armored Crawler four times the size, and it spots you from twice as far.',
      9: 'Black or white, swinging a chained ball around itself as it hunts.',
      10: 'A giant armored Caterpillar: twice as thick, five times as long, full of teeth.',
      11: 'A giant ruby knight. Charges, red-hot slashes: four attacks on a loop.',
      12: 'Pale blue and spiked with icicles. A CO2 blast barely slows it.',
      13: 'Three heads on one body. It only notices you when you move.',
      14: 'Five tiny Crawlers, each as blind as the original until your flashlight finds it.',
      15: 'Icicle-legged spiders that are always hunting, at twice your speed.',
      16: 'The Mutation grown to twice its size, ice-crusted, splitting into hunting copies.',
      17: 'A long teal eel that patrols the flooded halls, then rushes you on sight.',
      18: 'The biggest eel, draped in seaweed. Only the drifting weeds give it away.',
      19: 'A pale, bumpy cousin of the Flood Eel, patrolling the Great Wheel.',
      20: 'Ten small coral-grown eels that never stop hunting you.',
      21: 'A monstrous teal eel overgrown with weed and coral. Three attacks.',
      22: 'Ten grassy Drifters, each hunting by sound alone.',
      23: 'A stick-studded Crawler that closes in steadily the instant it sees you.',
      24: 'A gaunt shadow with one eye that flares red and chases at 2.5x your speed.',
      25: 'A tentacled machine-creature with one red lens, closing in once it sees you.',
      26: 'A round, grass-grown robot with a giant mushroom. Only furnace coal hurts it.',
      27: 'A violet blob ringed with waving tentacles, patrolling the rooftops.',
      28: 'A winged grey cousin of the Reacher, airborne, its shadow trailing behind.',
      29: 'Four-winged fliers that only hunt while you are caught out on a ledge.',
      30: 'The runt of the family: tiny and dark, with comically oversized wings.',
      31: 'The winged family grown to 2.5x its size, with one giant eye. 100 HP.',
      32: 'A huge pumpkin with fire in its mouth, held up on a nest of vines.',
      33: 'Tentacles in a hollowed-out pumpkin. Slow, with the sharpest eyes in the facility.',
      34: 'A ghost, nearly invisible while it roams and solid the moment it spots you.',
      35: 'A rotting jack-o-lantern dragging itself through the ductwork.',
      36: 'A hulking yellow pumpkin with a smouldering face, crawling on vine-tentacles.',
    };
"""
rep("    // MonsterModels ids of each story level's monsters", DESC + "    // MonsterModels ids of each story level's monsters")

rep("y: H * 0.74, k: r", "y: H * 0.66, k: r")

OLD = """      if (show > 0.02) {
        ctx.textAlign = 'center'; ctx.font = '700 17px "Courier New", monospace';
        slots.forEach((s) => {
          const name = s.hidden ? '???' : (MONSTER_NAMES[s.id] || '');
          ctx.globalAlpha = show;
          ctx.fillStyle = '#000'; ctx.fillText(name, s.x + 1, s.y + s.r + 22 + 1);
          ctx.fillStyle = mode === 'holiday' ? '#ffae4a' : '#bfe0ff'; ctx.fillText(name, s.x, s.y + s.r + 22);
        });
        ctx.globalAlpha = 1;
      }"""
NEW = """      if (show > 0.02) {
        // name, then (for up to five monsters across) what it does, wrapped to its slot
        ctx.textAlign = 'center';
        const spacing = n > 1 ? 0.76 * W / (n - 1) : 300;
        const maxW = Math.max(110, Math.min(300, spacing * 0.92)), crowded = n > 5;
        const wrap = (text) => {
          const lines = []; let cur = '';
          text.split(' ').forEach((w) => {
            if (cur && ctx.measureText(cur + ' ' + w).width > maxW) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
          });
          if (cur) lines.push(cur);
          return lines;
        };
        const put = (str, x, y, col) => { ctx.fillStyle = '#000'; ctx.fillText(str, x + 1, y + 1); ctx.fillStyle = col; ctx.fillText(str, x, y); };
        slots.forEach((s) => {
          ctx.globalAlpha = show;
          let y = s.y + s.r + 22;
          ctx.font = `700 ${crowded ? 12 : 17}px "Courier New", monospace`;
          wrap(s.hidden ? '???' : (MONSTER_NAMES[s.id] || '')).forEach((ln) => { put(ln, s.x, y, mode === 'holiday' ? '#ffae4a' : '#bfe0ff'); y += crowded ? 14 : 20; });
          if (!crowded) {
            ctx.font = '13px "Courier New", monospace';
            y += 2;
            wrap(s.hidden ? 'Beat this level to find out what lurks here.' : (MONSTER_DESC[s.id] || '')).forEach((ln) => { put(ln, s.x, y, '#c4c8d4'); y += 16; });
          }
        });
        ctx.globalAlpha = 1;
      }"""
rep(OLD, NEW)
open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('ok')
