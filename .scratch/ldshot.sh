#!/bin/bash
# usage: ldshot.sh out.png "query"
out=$1; qs=$2
prof="C:/claude_p/goofy-horror/.scratch/chrome-prof-$$"
timeout 60 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --window-size=920,340 --virtual-time-budget=2500 --screenshot="C:/claude_p/goofy-horror/.scratch/$out" "http://localhost:5174/.scratch/ld-test.html?$qs" >/dev/null 2>&1
rm -rf "$prof"
ls -la ".scratch/$out"
