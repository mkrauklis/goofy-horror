import glob
import os

ROOT = 'C:/claude_p/goofy-horror/'
P = ROOT + 'js/bosscutscene.js'
s = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in s
s = s.replace('\r\n', '\n')
parts = ['cs_common.js', 'cs_pumpkin_knight.js'] + [os.path.basename(f) for f in sorted(glob.glob(ROOT + '.scratch/cs_scene_*.js'))]
body = ''.join(open(ROOT + '.scratch/' + p, encoding='utf-8').read() for p in parts)
body = body.replace("        if (t > 3750 && t < 5500) drawHazmat(g, { x: 9999, y: 9999, u: 1 });  // (keeps the draw order simple)\n", "")
a = s.index('  // <<SCENES-START>>\n') + len('  // <<SCENES-START>>\n')
b = s.index('  // <<SCENES-END>>')
s = s[:a] + body + s[b:]
open(P, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('built', len(s))
