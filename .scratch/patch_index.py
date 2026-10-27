import json
import re

IDX = 'C:/claude_p/goofy-horror/index.html'
s = open(IDX, encoding='utf-8', newline='').read()
crlf = '\r\n' in s
s = s.replace('\r\n', '\n')

defs = open('C:/claude_p/goofy-horror/js/customdefaults.js', encoding='utf-8').read()
D = {int(k): v for k, v in json.loads(defs[defs.index('=') + 1:].strip().rstrip(';')).items()}

ORDER = [1, 2, 3, 4, 32, 33, 5, 6, 7, 8, 9, 34, 35, 10, 11, 12, 13, 14, 36, 37, 15, 16, 17, 18, 19, 38, 39, 20,
         21, 22, 23, 24, 40, 41, 25, 26, 27, 28, 29, 42, 43, 30, 31]
DISPLAY = {n: i + 1 for i, n in enumerate(ORDER)}
CHAPTERS = {
    1: [1, 2, 3, 4, 32, 33, 5], 2: [6, 7, 8, 9, 34, 35, 10], 3: [11, 12, 13, 14, 36, 37, 15],
    4: [16, 17, 18, 19, 38, 39, 20], 5: [21, 22, 23, 24, 40, 41, 25], 6: [26, 27, 28, 29, 42, 43, 30], 7: [31],
}
MINI = {4: 'Magmatron', 9: 'The Ossuary Warden', 14: 'Rimeback', 19: 'The Tidegrub', 24: 'Thornmother', 29: 'Gutterwing'}


def esc(t):
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('\u2019', '&rsquo;').replace('\u2014', '&mdash;'))


def custom_card(n):
    d = D[n]
    mini = d['kind'] == 'miniboss'
    title = ('Mini Boss: ' if mini else '') + d['title']
    tail = ' ' + d['monster']['desc'] if not mini else ''
    if mini:
        extra = ' Beat it with bombs to earn a new weapon.' if d.get('reward') else ' Beat it with bombs.'
    else:
        extra = ''
    body = esc(d['blurb'] + tail + extra)
    return (f'    <a class="menu-item panel" href="level{n}.html" data-level="{n}">\n'
            f'      <h2>Level {DISPLAY[n]} &mdash; {esc(title)} <span class="best-time" data-level="level{n}"></span></h2>\n'
            f'      <p>{body}</p>\n'
            f'      <p class="lock-note"></p>\n'
            f'    </a>\n')


card_re = re.compile(r'    <a class="menu-item panel" href="level(\d+)\.html" data-level="(\d+)">\n.*?    </a>\n', re.S)
cards = {}
for m in card_re.finditer(s):
    cards[int(m.group(2))] = m.group(0)
assert set(cards) == set(range(1, 32)), sorted(set(range(1, 32)) - set(cards))


def renumber(card, n):
    return re.sub(r'<h2>Level \d+ &mdash;', f'<h2>Level {DISPLAY[n]} &mdash;', card, count=1)


# rebuild each chapter's menu list
for c, ids in CHAPTERS.items():
    html = ''
    for n in ids:
        if n in D:
            html += custom_card(n)
        else:
            html += renumber(cards[n], n)
    sec = re.search(r'(<section class="chapter chapter-%d" data-view="chapter-%d" hidden>.*?<div class="menu-list">\n)(.*?)(  </div>\n  </section>)' % (c, c), s, re.S)
    assert sec, c
    s = s[:sec.start(2)] + html + s[sec.end(2):]

# chapter card ranges
RANGES = {1: ('1&ndash;7', 'The Ashen One'), 2: ('8&ndash;14', 'The Last Knight'), 3: ('15&ndash;21', 'The Frozen Mutation'),
          4: ('22&ndash;28', 'The Cistern'), 5: ('29&ndash;35', 'The Cultivator'), 6: ('36&ndash;42', 'The Garguantuagoyle')}
for c, (rng, boss) in RANGES.items():
    pat = re.compile(r'(<span class="chapter-range">)Levels [\d&;a-z]+ &middot; boss: ' + re.escape(boss) + '</span>')
    assert len(pat.findall(s)) == 1, c
    s = pat.sub(r'\g<1>Levels ' + rng + ' &middot; mini boss + boss: ' + boss + '</span>', s)
a = '<span class="chapter-range">Level 31 &middot; boss: The Multipod</span>'
assert s.count(a) == 1
s = s.replace(a, '<span class="chapter-range">Level 43 &middot; boss: The Multipod</span>')

# lock notes, continue button
a = "note.textContent = !unlocked ? `Locked — finish Level ${n - 1} first` : completed ? 'Completed' : '';"
assert s.count(a) == 1
s = s.replace(a, "note.textContent = !unlocked ? `Locked — finish Level ${story.displayNumber(story.previousLevel(n))} first` : completed ? 'Completed' : '';")
a = ": next === 1 ? 'Start the Story' : `Continue — Level ${next}`);"
assert s.count(a) == 1
s = s.replace(a, ": next === 1 ? 'Start the Story' : `Continue — Level ${story.displayNumber(next)}`);")

# chapter progress
a = """      const first = (c - 1) * 5 + 1, last = Math.min(31, c * 5);
      let done = 0;
      for (let n = first; n <= last; n++) if (story.isCompleted(n)) done++;
      const total = last - first + 1;"""
assert s.count(a) == 1
s = s.replace(a, """      const ids = story.ORDER.filter((n) => story.chapterOf(n) === c);
      const first = ids[0];
      let done = 0;
      ids.forEach((n) => { if (story.isCompleted(n)) done++; });
      const total = ids.length;""")

# lineup: custom monsters have no Monsterpedia model
a = "    const HALLOWEEN_LEVEL_MONSTERS ="
assert s.count(a) == 1
s = s.replace(a, "    [4, 9, 14, 19, 24, 29, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43].forEach((n) => { LEVEL_MONSTERS[n] = []; }); // designer slots: their monsters live in the designer, not the Monsterpedia\n" + a)

# side tab for the designer
a = '  <button type="button" class="side-tab" data-goto="holidays">&#127881; Holidays</button>\n'
assert s.count(a) == 1
s = s.replace(a, a + '  <a class="side-tab" href="editor.html">&#128736;&#65039; Designer</a>\n')

open(IDX, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n') if crlf else s)
print('ok', len(cards))
