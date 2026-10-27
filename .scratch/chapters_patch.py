import re
p='index.html'
s=open(p,encoding='utf-8').read()

CH=[
 (1,'&#128293;','The Facility','Levels 1&ndash;5','The Ashen One'),
 (2,'&#9876;&#65039;','The Undercroft','Levels 6&ndash;10','The Last Knight'),
 (3,'&#10052;&#65039;','The Frost','Levels 11&ndash;15','The Frozen Mutation'),
 (4,'&#127754;','The Flood','Levels 16&ndash;20','The Cistern'),
 (5,'&#127812;','The Overgrowth','Levels 21&ndash;25','The Cultivator'),
 (6,'&#127747;','The Rooftops','Levels 26&ndash;30','The Garguantuagoyle'),
 (7,'&#128663;','The Way Out','Level 31','The Multipod'),
]
# 1. each chapter section becomes its own view with a back link and a name
for n,ic,name,rng,boss in CH:
    old='  <section class="chapter chapter-%d">\n  <h2 class="chapter-divider">Chapter %d</h2>\n'%(n,n)
    new=('  <section class="chapter chapter-%d" data-view="chapter-%d" hidden>\n'
         '  <h2 class="chapter-divider">%s Chapter %d &mdash; %s</h2>\n'
         '  <button type="button" class="back-link" data-goto="story">&larr; All chapters</button>\n')%(n,n,ic,n,name)
    assert old in s, n
    s=s.replace(old,new)

# 2. close the story view before the chapters and put the picker inside it
picker='  <div class="chapter-list">\n'
for n,ic,name,rng,boss in CH:
    picker+=('    <button type="button" class="chapter-card panel chapter-%d" data-goto="chapter-%d">\n'
             '      <span class="chapter-icon">%s</span>\n'
             '      <span class="chapter-num">Chapter %d</span>\n'
             '      <span class="chapter-name">%s</span>\n'
             '      <span class="chapter-range">%s &middot; boss: %s</span>\n'
             '      <span class="chapter-progress" data-chapter-progress="%d"></span>\n'
             '    </button>\n')%(n,n,ic,n,name,rng,boss,n)
picker+='  </div>\n  </div>\n'
marker='  <section class="chapter chapter-1"'
assert marker in s
s=s.replace(marker,picker+marker,1)
# drop the old story-div closer that followed chapter 7
old_close='  </section>\n  </div>\n  <section class="holidays"'
assert old_close in s
s=s.replace(old_close,'  </section>\n  <section class="holidays"')

# 3. view switching
s=s.replace("const VIEWS = ['story', 'holidays', 'halloween-2026'];",
 "const VIEWS = ['story', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5', 'chapter-6', 'chapter-7', 'holidays', 'halloween-2026'];")
s=s.replace("window.__lobbyMode = name === 'story' ? 'story' : 'holiday';",
 "const isStory = name === 'story' || name.startsWith('chapter-');\n    window.__lobbyMode = isStory ? 'story' : 'holiday';")
s=s.replace("b.classList.toggle('active', b.dataset.goto === name || (b.dataset.goto === 'holidays' && name === 'halloween-2026'));",
 "b.classList.toggle('active', (b.dataset.goto === 'story' && isStory) || b.dataset.goto === name || (b.dataset.goto === 'holidays' && name === 'halloween-2026'));")
s=s.replace("""  (function renderHolidayProgress() {""","""  (function renderChapterProgress() {
    const story = window.GoofyStory;
    if (!story) return;
    document.querySelectorAll('[data-chapter-progress]').forEach((el) => {
      const c = parseInt(el.dataset.chapterProgress, 10);
      const first = (c - 1) * 5 + 1, last = Math.min(31, c * 5);
      let done = 0;
      for (let n = first; n <= last; n++) if (story.isCompleted(n)) done++;
      const total = last - first + 1;
      el.textContent = !story.isUnlocked(first) ? 'Locked' : done === total ? `All ${total} completed` : `${done} / ${total} completed`;
      el.closest('.chapter-card').classList.toggle('locked', !story.isUnlocked(first));
    });
  })();
  (function renderHolidayProgress() {""",1)
open(p,'w',encoding='utf-8').write(s)

# story.js: the in-level Menu link returns to that level's chapter
p='js/story.js'
s=open(p,encoding='utf-8').read()
old="    label.textContent = hallo ? 'Halloween' : `Chapter ${chapterForLevel(n)}`;\n"
assert old in s
s=s.replace(old,old+"    if (!hallo) menuLink.setAttribute('href', `index.html#chapter-${chapterForLevel(n)}`);\n")
open(p,'w',encoding='utf-8').write(s)

# css
p='css/style.css'
s=open(p,encoding='utf-8').read()
s=s.rstrip()+'''

/* ---- the Story view's chapter picker ---- */
.chapter-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  max-width: 1000px;
  margin: 1.5rem auto 0;
}

.chapter-card {
  font: inherit;
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 220px;
  padding: 1.1rem 1rem;
  cursor: pointer;
  text-align: center;
  border: 1px solid var(--chapter-color);
  background: linear-gradient(180deg, var(--chapter-wash), rgba(20, 14, 28, 0.8));
}

.chapter-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.chapter-card.locked { opacity: 0.5; }
.chapter-icon { font-size: 2.1rem; }
.chapter-num { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
.chapter-name { font-size: 1.15rem; font-weight: 700; color: #fff; }
.chapter-range { color: var(--dim); font-size: 0.85rem; }
.chapter-progress { margin-top: 0.25rem; font-size: 0.85rem; color: var(--accent); }

.chapter-5 { --chapter-color: rgba(122, 200, 70, 0.4); --chapter-wash: rgba(122, 200, 70, 0.05); }
.chapter-6 { --chapter-color: rgba(214, 160, 90, 0.4); --chapter-wash: rgba(214, 160, 90, 0.05); }
.chapter-7 { --chapter-color: rgba(255, 90, 90, 0.4); --chapter-wash: rgba(255, 90, 90, 0.05); }
'''
open(p,'w',encoding='utf-8').write(s)
