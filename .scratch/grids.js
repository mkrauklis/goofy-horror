const fs=require('fs');
for (let n=1;n<=30;n++){
  const w={}; global.window=w;
  try{ new Function('window',fs.readFileSync(`levels/level${n}/level.js`,'utf8'))(w);}catch(e){console.log(n,'ERR',e.message);continue;}
  const L=w['LEVEL'+n]; if(!L){console.log(n,'no LEVEL',Object.keys(w));continue;}
  const g=L.grid; const rows=Array.isArray(g)?g.length:'?';
  const first=Array.isArray(g)?(typeof g[0]):typeof g;
  const cnt={}; if(Array.isArray(g)) for(const r of g) for(const c of (typeof r==='string'?r:r)) cnt[c]=(cnt[c]||0)+1;
  console.log(n,L.cols+'x'+L.rows,first,JSON.stringify(cnt));
}
