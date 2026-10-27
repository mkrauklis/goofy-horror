import re, sys, json

def runs(lines):
    out=[];start=0
    for i in range(1,len(lines)+1):
        if i==len(lines) or lines[i]!=lines[start]:
            out.append((start,i-start)); start=i
    return out

def plan(lines, factor, minlong=4, minkeep=3):
    """Return (new_len, mapping old_index->new_index) compressing runs of identical lines >= minlong."""
    N=len(lines); target=round(N*factor)
    rs=runs(lines)
    fixed=sum(L for s,L in rs if L<minlong)
    longs=[(s,L) for s,L in rs if L>=minlong]
    totalLong=sum(L for s,L in longs)
    want=target-fixed
    # find scale f so sum(max(minkeep, round(L*f))) ~= want
    lo,hi=0.0,1.0
    for _ in range(40):
        f=(lo+hi)/2
        tot=sum(max(minkeep,round(L*f)) for s,L in longs)
        if tot>want: hi=f
        else: lo=f
    f=lo
    newlens={s:(max(minkeep,round(L*f)) if L>=minlong else L) for s,L in rs}
    newlines=[];mapping=[0]*N;pos=0
    for s,L in rs:
        nl=newlens[s]
        for k in range(L):
            mapping[s+k]=pos+min(nl-1,int(k*nl/L))
        newlines.extend([lines[s]]*nl); pos+=nl
    return newlines,mapping,f

def shrink(grid, factor):
    rows=grid
    newrows,rmap,rf=plan(rows,factor)
    cols=[''.join(r[c] for r in newrows) for c in range(len(newrows[0]))]
    newcols,cmap,cf=plan(cols,factor)
    out=[''.join(newcols[c][r] for c in range(len(newcols))) for r in range(len(newrows))]
    return out,rmap,cmap,rf,cf

if __name__=='__main__':
    n=int(sys.argv[1]); factor=float(sys.argv[2])
    s=open(f'levels/level{n}/level.js',encoding='utf-8').read()
    grid=re.findall(r"^\s*'([^']+)',\s*$",s,re.M)
    out,rmap,cmap,rf,cf=shrink(grid,factor)
    print(n,'old',len(grid[0]),'x',len(grid),'new',len(out[0]),'x',len(out),'run scale',round(rf,2),round(cf,2))


def apply(n, factor):
    from collections import Counter, deque
    path=f'levels/level{n}/level.js'
    s=open(path,encoding='utf-8').read()
    lines=s.split('\n')
    gi=next(i for i,l in enumerate(lines) if 'const grid = [' in l)
    ge=next(i for i in range(gi,len(lines)) if lines[i].strip()=='];')
    grid=[re.match(r"^\s*'([^']+)',\s*$",l).group(1) for l in lines[gi+1:ge]]
    new,rmap,cmap,rf,cf=shrink(grid,factor)
    H,W=len(grid),len(grid[0]); nH,nW=len(new),len(new[0])
    print('grid',W,'x',H,'->',nW,'x',nH)
    print('tile counts old',dict(Counter(''.join(grid))),'new',dict(Counter(''.join(new))))
    meta_start=next(i for i,l in enumerate(lines) if 'window.LEVEL' in l)
    meta='\n'.join(lines[meta_start:])
    pts=[]
    def fix(x,y,old_ch):
        nx,ny=cmap[min(x,W-1)],rmap[min(y,H-1)]
        if new[ny][nx]==old_ch: return nx,ny
        want=old_ch if old_ch in 'BXDESV' else None
        best=None
        for r in range(1,10):
            for dy in range(-r,r+1):
                for dx in range(-r,r+1):
                    xx,yy=nx+dx,ny+dy
                    if 0<=xx<nW and 0<=yy<nH:
                        c=new[yy][xx]
                        ok=(c==want) if want else (c in '.PS' )
                        if ok and (best is None or abs(dx)+abs(dy)<best[0]): best=(abs(dx)+abs(dy),xx,yy)
            if best: return best[1],best[2]
        raise Exception(('no tile',x,y,old_ch))
    moved=[0]
    def sub_xy(m):
        x,y=int(m.group(1)),int(m.group(2))
        if y>=H or x>=W: return m.group(0)
        old=grid[y][x]
        # walls shouldn't hold points; treat as floor
        old_ch=old if old in 'BXDESV' else '.'
        nx,ny=fix(x,y,old_ch if old_ch!='.' else (old if old in '.P' else '.'))
        if (nx,ny)!=(cmap[x],rmap[y]): moved[0]+=1
        pts.append((nx,ny,old_ch))
        return f"x: {nx}, y: {ny}"
    meta2=re.sub(r"x: (\d+), y: (\d+)",sub_xy,meta)
    def sub_zone(m):
        x0,y0,x1,y1=map(int,m.groups())
        return f"x0: {cmap[x0]}, y0: {rmap[y0]}, x1: {cmap[x1]}, y1: {rmap[y1]}"
    meta2=re.sub(r"x0: (\d+), y0: (\d+), x1: (\d+), y1: (\d+)",sub_zone,meta2)
    print('points remapped',len(pts),'nudged',moved[0])
    # connectivity check (doors passable)
    def reach(g,start):
        seen={start};q=deque([start]);h,w=len(g),len(g[0])
        while q:
            x,y=q.popleft()
            for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
                a,b=x+dx,y+dy
                if 0<=a<w and 0<=b<h and (a,b) not in seen and g[b][a]!='#':
                    seen.add((a,b));q.append((a,b))
        return seen
    mm=re.search(r"spawn1: \{ x: (\d+), y: (\d+)",meta2); s1=(int(mm.group(1)),int(mm.group(2)))
    om=re.search(r"spawn1: \{ x: (\d+), y: (\d+)",meta); o1=(int(om.group(1)),int(om.group(2)))
    ro=reach(grid,o1); rn=reach(new,s1)
    # every old special tile reachable <=> new
    for ch in 'BXD':
        old_pts=[(x,y) for y,r in enumerate(grid) for x,c in enumerate(r) if c==ch]
        new_pts=[(x,y) for y,r in enumerate(new) for x,c in enumerate(r) if c==ch]
        print(ch,'old tiles',len(old_pts),'reachable',sum(p in ro for p in old_pts),'| new tiles',len(new_pts),'reachable',sum(p in rn for p in new_pts))
    print('floor tiles reachable old',len(ro),'new',len(rn),'ratio',round(len(rn)/len(ro),3))
    bad=[p for p in pts if p[:2] not in rn]
    print('unreachable remapped points',bad[:5],len(bad))
    # write
    out=lines[:gi+1]+[f"    '{r}'," for r in new]+lines[ge:meta_start]+meta2.split('\n')
    if len(sys.argv)>3 and sys.argv[3]=='write':
        open(path,'w',encoding='utf-8',newline='\n').write('\n'.join(out))
        print('WROTE',path)

if __name__=='__main__' and len(sys.argv)>2:
    apply(int(sys.argv[1]),float(sys.argv[2]))
