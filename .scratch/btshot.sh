#!/bin/bash
# usage: btshot.sh out.png budgetms "query"
out=$1; bud=$2; qs=$3
prof="C:/claude_p/goofy-horror/.scratch/chrome-prof-$$"
timeout 90 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --window-size=920,760 --virtual-time-budget=$bud --screenshot="C:/claude_p/goofy-horror/.scratch/$out" "http://localhost:5174/.scratch/bt.html?$qs" >/dev/null 2>&1
rm -rf "$prof"
ls -la "$out"
