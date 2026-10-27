#!/bin/bash
# usage: btdom.sh budgetms "query"  -> prints the log
prof="C:/claude_p/goofy-horror/.scratch/chrome-prof-$$"
timeout 90 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir="$prof" --virtual-time-budget=$1 --dump-dom "http://localhost:5174/.scratch/bt.html?$2" 2>/dev/null | python3 -c "
import sys,re
s=sys.stdin.read()
m=re.search(r'<pre id=\"log\"[^>]*>(.*?)</pre>',s,re.S)
print(m.group(1) if m else s[:500])"
rm -rf "$prof"
