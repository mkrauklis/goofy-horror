P='C:/claude_p/goofy-horror/index.html'
t=open(P,encoding='utf-8',newline='').read()
crlf='\r\n' in t
t=t.replace('\r\n','\n')
def rep(a,b):
    global t
    assert t.count(a)==1,(a[:60],t.count(a))
    t=t.replace(a,b)
GR=open('C:/claude_p/goofy-horror/.scratch/true_block.js',encoding='utf-8').read()
rep("    const LOBBY = {", GR+"    const LOBBY = {")
rep("holiday: { pool: [33, 34, 35, 36, 32].map((id, i) => ({ id, speed: [30, 34, 26, 30, 20][i], scale: [1.5, 1.4, 1.4, 1.5, 1.9][i] })), lamps: 'pumpkin' },",
    "holiday: { pool: [33, 34, 35, 36, 32].map((id, i) => ({ id, speed: [30, 34, 26, 30, 20][i] })), lamps: 'pumpkin' },")
rep("scale: m.scale || Math.max(0.8, Math.min(2, 75 / M.extent(m.id))),","scale: trueScale(m.id),")
open(P,'w',encoding='utf-8',newline='').write(t.replace('\n','\r\n') if crlf else t)
print('ok')
