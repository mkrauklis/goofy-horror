import re
ROOT = 'C:/claude_p/goofy-horror/'
GAMES = [('level5.html', 'game5', 'ashen'), ('level10.html', 'game10', 'knight'), ('level15.html', 'game15', 'frozen'),
         ('level20.html', 'game20', 'cistern'), ('level25.html', 'game25', 'cultivator'), ('level30.html', 'game30', 'gargoyle'),
         ('halloween5.html', 'halloween5', 'pumpkin')]
for page, js, kind in GAMES:
    # page: models + cutscene before the game script
    p = ROOT + page
    t = open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in t else '\n'
    tag = '<script src="js/%s.js"></script>' % js
    assert t.count(tag) == 1, page
    t = t.replace(tag, '<script src="js/monsterpedia.js"></script>' + nl + '<script src="js/bosscutscene.js"></script>' + nl + tag)
    open(p, 'w', encoding='utf-8', newline='').write(t)
    # game
    p = ROOT + 'js/%s.js' % js
    s = open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    a = 'const BOSS_INTRO_CUTSCENE_MS = 3000;'
    assert s.count(a) == 1, js
    s = s.replace(a, "// the opening film (js/bosscutscene.js) sets how long the intro runs; 3s name card if it isn't loaded\n  const BOSS_INTRO_CUTSCENE_MS = window.BossCutscene ? window.BossCutscene.duration('%s') : 3000;" % kind)
    pat = re.compile(r'( *)renderViewport\(0, now\);\s*if \(PLAYER_MODE === 2\) \{[^}]*\}')
    m = pat.search(s)
    assert m and len(pat.findall(s)) == 1, js
    ind = m.group(1)
    block = m.group(0)
    new = (ind + "if (gameState === 'intro' && window.BossCutscene) {\n" +
           ind + "  window.BossCutscene.draw(ctx, canvas.width, canvas.height, now - introStartedAt, '%s');\n" % kind +
           ind + "} else {\n" + '\n'.join('  ' + ln if ln.strip() else ln for ln in block.split('\n')) + '\n' + ind + "}")
    s = s[:m.start()] + new + s[m.end():]
    skip = "(window.BossCutscene && window.BossCutscene.skipRequested(introStartedAt))"
    old1 = 'now - introStartedAt < BOSS_INTRO_CUTSCENE_MS) return;'
    old2 = 'if (now - introStartedAt >= BOSS_INTRO_CUTSCENE_MS) {'
    if old1 in s:
        assert s.count(old1) == 1, js
        s = s.replace(old1, 'now - introStartedAt < BOSS_INTRO_CUTSCENE_MS && !%s) return;' % skip)
    else:
        assert s.count(old2) == 1, js
        s = s.replace(old2, 'if (now - introStartedAt >= BOSS_INTRO_CUTSCENE_MS || %s) {' % skip)
    open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))
    print('wired', js, kind)
# level 31: just the page for now
p = ROOT + 'level31.html'
t = open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in t else '\n'
tag = '<script src="js/monsterpedia.js"></script>'
t = t.replace(tag, tag + nl + '<script src="js/bosscutscene.js"></script>')
open(p, 'w', encoding='utf-8', newline='').write(t)
