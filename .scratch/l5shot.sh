#!/bin/bash
# usage: l5shot.sh out.png "js code" [virtual-ms] [lvl]
out=$1; js=$2; ms=${3:-6000}; lvl=${4:-5}
prof="C:/claude_p/goofy-horror/.scratch/chrome-prof-$$"
enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$js")
timeout 90 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --window-size=1100,640 --virtual-time-budget=$ms --screenshot="C:/claude_p/goofy-horror/.scratch/$out" "http://localhost:5174/.scratch/l5-test.html?lvl=$lvl&js=$enc" >/dev/null 2>&1
rm -rf "$prof"
ls -la ".scratch/$out"
