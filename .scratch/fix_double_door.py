import re, sys, json
from collections import deque

def fix(level_num):
    path = f'levels/level{level_num}/level.js'
    lines = open(path, encoding='utf-8').read().split('\n')

    # locate the grid block
    start = None
    for i, l in enumerate(lines):
        if re.search(r'grid\s*[:=]\s*\[\s*$', l):
            start = i
            break
    if start is None:
        print(level_num, 'GRID START NOT FOUND'); return False
    end = None
    for i in range(start + 1, len(lines)):
        if re.match(r'\s*\]\s*[;,]?\s*$', lines[i]):
            end = i
            break
    if end is None:
        print(level_num, 'GRID END NOT FOUND'); return False

    row_lines = list(range(start + 1, end))
    rows = []
    quote_chars = []
    for i in row_lines:
        m = re.search(r'''(['"])((?:(?!\1).)*)\1''', lines[i])
        if not m:
            print(level_num, 'ROW PARSE FAIL at', i, lines[i]); return False
        quote_chars.append(m.group(1))
        rows.append(m.group(2))

    H = len(rows)

    # find door clusters
    seen = set()
    clusters = []
    for y in range(H):
        for x in range(len(rows[y])):
            if rows[y][x] == 'D' and (x, y) not in seen:
                comp = []
                q = deque([(x, y)]); seen.add((x, y))
                while q:
                    cx, cy = q.popleft(); comp.append((cx, cy))
                    for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                        nx, ny = cx+dx, cy+dy
                        if 0 <= ny < H and 0 <= nx < len(rows[ny]) and rows[ny][nx] == 'D' and (nx, ny) not in seen:
                            seen.add((nx, ny)); q.append((nx, ny))
                clusters.append(comp)

    if len(clusters) <= 1:
        print(level_num, 'already OK --', len(clusters), 'cluster(s)')
        return True

    # keep the first cluster (arbitrary, consistent choice), wall off the rest
    keep = clusters[0]
    remove_tiles = [t for c in clusters[1:] for t in c]
    print(level_num, 'clusters', len(clusters), '-- keeping', len(keep), 'tiles, removing', len(remove_tiles), 'tiles')

    # patch rows in memory
    row_lists = [list(r) for r in rows]
    for (x, y) in remove_tiles:
        row_lists[y][x] = '#'
    new_rows = [''.join(r) for r in row_lists]

    # ---- reachability sanity check (generic: # and closed-D are walls) ----
    spawn_m = re.search(r'spawn1:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}', '\n'.join(lines))
    exit_m = re.search(r'exitTrigger:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}', '\n'.join(lines))
    if not spawn_m or not exit_m:
        print(level_num, 'spawn/exit not found for verification, skipping BFS check')
    else:
        sx, sy = int(spawn_m.group(1)), int(spawn_m.group(2))
        ex, ey = int(exit_m.group(1)), int(exit_m.group(2))

        def is_wall(ch, door_open):
            if ch == '#':
                return True
            if ch == 'D':
                return not door_open
            return False

        def bfs(door_open):
            W = max(len(r) for r in new_rows)
            seenb = {(sx, sy)}
            q = deque([(sx, sy)])
            while q:
                cx, cy = q.popleft()
                for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                    nx, ny = cx+dx, cy+dy
                    if 0 <= ny < H and 0 <= nx < len(new_rows[ny]) and (nx, ny) not in seenb:
                        if not is_wall(new_rows[ny][nx], door_open):
                            seenb.add((nx, ny)); q.append((nx, ny))
            return seenb

        closed = bfs(False)
        opened = bfs(True)
        ok = True
        if (ex, ey) in closed:
            print(level_num, 'WARNING exit reachable with door closed'); ok = False
        if (ex, ey) not in opened:
            print(level_num, 'WARNING exit NOT reachable with door open'); ok = False
        print(level_num, 'BFS check:', 'OK' if ok else 'FAILED', '-- reach(open)=', len(opened), 'reach(closed)=', len(closed))
        if not ok:
            return False

    # write back -- only touch the grid row lines, preserve everything else byte-identical
    for idx, i in enumerate(row_lines):
        q = quote_chars[idx]
        old_line = lines[i]
        new_row_escaped = new_rows[idx]
        new_line = re.sub(rf'''({q})((?:(?!{q}).)*)({q})''', lambda m: m.group(1) + new_row_escaped + m.group(3), old_line, count=1)
        lines[i] = new_line

    open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print(level_num, 'written')
    return True

if __name__ == '__main__':
    for n in sys.argv[1:]:
        fix(int(n))
