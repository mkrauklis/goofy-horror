P = 'C:/claude_p/goofy-horror/index.html'
t = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')


def rep(a, b):
    global t
    assert t.count(a) == 1, (a[:70], t.count(a))
    t = t.replace(a, b)


# bindHover: open the panel under the hovered card
rep("""        const on = () => {
          hoverLine = lineFor(el); if (hoverLine) lineup = hoverLine;
          const r = el.getBoundingClientRect();
          lineBottom = r.top + r.height / 2 < window.innerHeight / 2;
        };""", """        const on = () => {
          hoverLine = lineFor(el); if (!hoverLine) return;
          lineup = hoverLine;
          openReveal(el.classList.contains('holiday-card') ? el.parentElement : el);
        };""")
# floor / world height: a multiple of the tile size so it repeats seamlessly
rep("""    function initLobby(mode) {
      const W = canvas.width, H = canvas.height, def = LOBBY[mode], M = window.MonsterModels;""",
    """    function initLobby(mode) {
      const W = canvas.width, H = canvas.height, def = LOBBY[mode], M = window.MonsterModels;
      const HW = Math.ceil(H / 60) * 60;       // the room's height: whole tiles, repeating as the page scrolls""")
rep("""        W, H,
        mons: def.pool.map((m) => Object.assign({}, m, {
          scale: m.scale || Math.max(0.8, Math.min(2, 75 / M.extent(m.id))),
          x: rnd(0.1, 0.9) * W, y: rnd(0.15, 0.85) * H, a: rnd(0, 6.28), turnAt: 0,""",
    """        W, H, HW,
        mons: def.pool.map((m) => Object.assign({}, m, {
          scale: m.scale || Math.max(0.8, Math.min(2, 75 / M.extent(m.id))),
          x: rnd(0.1, 0.9) * W, y: rnd(0.15, 0.85) * HW, a: rnd(0, 6.28), turnAt: 0,""")
rep("x: W * (0.3 + 0.4 * i), y: H * 0.6,", "x: W * (0.3 + 0.4 * i), y: HW * 0.6,")
rep("lamps: Array.from({ length: 9 }, (_, i) => ({ x: hash(i * 9.1) * W, y: hash(i * 4.7 + 2) * H, seed: i * 3 })),",
    "lamps: Array.from({ length: 9 }, (_, i) => ({ x: hash(i * 9.1) * W, y: hash(i * 4.7 + 2) * HW, seed: i * 3 })),")
rep("floor: buildLobbyFloor(mode, W, H),", "floor: buildLobbyFloor(mode, W, HW),")
# replace the overlay + drawLineup + drawLobby with the scrolling / in-page versions
a = t.index("    // The lineup is drawn on its own canvas above the page")
b = t.index("    let last = null;")
t = t[:a] + open('C:/claude_p/goofy-horror/.scratch/lobby_tail.js', encoding='utf-8').read() + t[b:]
t = t.replace("let lobbyShow = 0, hoverLine = null, lineup = [];", "let lobbyShow = 0, hoverLine = null, lineup = [];")
open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('ok')
