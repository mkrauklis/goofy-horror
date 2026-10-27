import re,sys
root='C:/claude_p/goofy-horror/'
names={}
for n in range(1,31):
    if n%5==0: continue
    names[n]='js/game.js' if n==1 else f'js/game{n}.js'
for n,f in names.items():
    s=open(root+f,encoding='utf8').read()
    if 'LevelDetails' in s:
        print('skip',f); continue
    def sub(pat,rep,s,count=1):
        new,c=re.subn(pat,rep,s,count=count,flags=re.M)
        assert c==1,(f,pat,c)
        return new
    s=sub(r'^(  const TILE = LEVEL\.tileSize;\n)', r'\1  const LD = window.LevelDetails.make(LEVEL, %d);\n'%n, s)
    s=sub(r'^(    drawTiles\(ctx, camX, camY[^\n]*\);\n)', r'\1    LD.floor(ctx, camX, camY, VIEW_W, VIEW_H, now);\n', s)
    s=sub(r'^(    drawParticles\(ctx\);\n)', r'\1    LD.above(ctx, camX, camY, VIEW_W, VIEW_H, now);\n', s)
    s=sub(r'^(    updateParticles\(dt\);\n)', r'\1    LD.update(dt, players);\n', s)
    s=sub(r'^(    maskCtx\.fillRect\(0, 0, VIEW_W, VIEW_H\);\n)', r'\1    LD.lights(maskCtx, camX, camY, VIEW_W, VIEW_H, now, punchLight);\n', s)
    if 11<=n<=14:
        s=sub(r'^(  function applyMovement\(p, ix, iy, dt\) \{\n)', r'\1    if (LD.ice(p, ix, iy, dt, movePlayer, PLAYER_SPEED * speedMultiplierFor(p))) return;\n', s)
    open(root+f,'w',encoding='utf8',newline='').write(s)
    h=root+f'level{n}.html'
    t=open(h,encoding='utf8').read()
    tag='<script src="js/leveldetails.js"></script>\n'
    if tag not in t:
        gs=re.search(r'^<script src="js/game%s\.js"></script>'%('' if n==1 else n), t, flags=re.M)
        assert gs,(h)
        t=t[:gs.start()]+tag+t[gs.start():]
        open(h,'w',encoding='utf8',newline='').write(t)
    print('ok',f)
