import sys
p='js/game5.js'
s=open(p,encoding='utf-8').read()
hook=open('.scratch/tmp_hook.txt',encoding='utf-8').read()
tail="  requestAnimationFrame(loop);\n})();"
if sys.argv[1]=='on' and '/*TMP*/' not in s:
    s=s.replace(tail,hook+tail)
elif sys.argv[1]=='off':
    s=s.replace(hook,'')
open(p,'w',encoding='utf-8').write(s)
