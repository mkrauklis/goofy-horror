#!/bin/bash
# usage: shot.sh kind "f1,f2,.." out.png [h]
kind=$1; frames=$2; out=$3; h=${4:-340}
n=$(echo "$frames" | tr ',' '\n' | wc -l)
prof="C:/claude_p/goofy-horror/.scratch/chrome-prof-$$"
timeout 60 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" --window-size=920,$((n*h+20)) --virtual-time-budget=3000 --screenshot="C:/claude_p/goofy-horror/.scratch/$out" "http://localhost:5174/.scratch/cs-test.html?kind=$kind&cols=1&h=$h&f=$frames" >/dev/null 2>&1
rm -rf "$prof"
ls -la ".scratch/$out"
