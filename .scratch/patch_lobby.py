P = 'C:/claude_p/goofy-horror/index.html'
t = open(P, encoding='utf-8', newline='').read()
crlf = '\r\n' in t
t = t.replace('\r\n', '\n')
a = t.index("    // ---- the Holidays background")
b = t.index("    let last = null;")
blk = open('C:/claude_p/goofy-horror/.scratch/lobby_block.js', encoding='utf-8').read()
t = t[:a] + blk + t[b:]
old = """      if (window.__lobbyMode === 'holiday' && window.MonsterModels && window.PlayerModel) {
        drawHoliday(now, dt);
      } else {"""
assert old in t
t = t.replace(old, """      if (window.MonsterModels && window.PlayerModel) {
        drawLobby(window.__lobbyMode === 'holiday' ? 'holiday' : 'story', now, dt);
      } else {""")
open(P, 'w', encoding='utf-8', newline='').write(t.replace('\n', '\r\n') if crlf else t)
print('ok')
