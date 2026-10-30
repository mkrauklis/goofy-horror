// "Back to the Sourcerer": a corner button on the levels his codes warp you into (the Mental Challenge,
// Season 2 Level 1). js/sourcerer.js leaves a session flag naming the page it sent you to; this shows
// the button only on that page, and halloween1.js drops you back into his room when it sees the
// return flag. Opening the menu clears the warp flag (index.html), so ordinary visits never show it.
(function () {
  const WARP_KEY = 'goofy-horror-sourcerer-warp';
  const RETURN_KEY = 'goofy-horror-sourcerer-return';
  let from = null;
  try { from = sessionStorage.getItem(WARP_KEY); } catch (e) { return; }
  const here = location.pathname.split('/').pop();
  if (!from || from !== here) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '↩ Back to the Sourcerer';
  btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99990;padding:8px 14px;font:bold 14px Georgia,serif;'
    + 'color:#ffe27a;background:rgba(30,12,56,0.92);border:2px solid #8a5ad8;border-radius:8px;cursor:pointer;'
    + 'box-shadow:0 0 14px rgba(150,80,255,0.5)';
  btn.addEventListener('click', () => {
    try { sessionStorage.setItem(RETURN_KEY, '1'); sessionStorage.removeItem(WARP_KEY); } catch (e) { /* ignore */ }
    location.href = 'halloween1.html';
  });
  // the page may be greyed or filtered; keep the button above everything and out of the game's key handling
  btn.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.appendChild(btn);
})();
