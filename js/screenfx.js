// Shared screen effects. Right now: a cheap blur, used when a monster gets
// close -- the screen smears out the nearer it is, instead of flashing red.
//
// Real canvas blur (ctx.filter) is far too slow to run every frame, so this
// fakes it: copy the region down to a smaller scratch canvas in a few
// halving steps (each step averages neighbouring pixels), then stretch it
// back up over the original with smoothing on. The more halvings, the blurrier.
(function () {
  const steps = [];
  function scratch(i, w, h) {
    let c = steps[i];
    if (!c) { c = steps[i] = document.createElement('canvas'); c.ctx = c.getContext('2d'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  // amount: 0 (nothing) .. 1 (heavily blurred). Blurs the (x, y, w, h)
  // region of g's own canvas in place.
  function blur(g, x, y, w, h, amount) {
    if (!(amount > 0.03)) return;
    const a = Math.min(1, amount);
    const halvings = 1 + Math.floor(a * 3.2); // 1..4
    let src = g.canvas, sx = x, sy = y, sw = w, sh = h;
    let cw = w, ch = h;
    for (let i = 0; i < halvings; i++) {
      cw = Math.max(4, Math.round(cw / 2)); ch = Math.max(4, Math.round(ch / 2));
      const c = scratch(i, cw, ch);
      c.ctx.imageSmoothingEnabled = true;
      c.ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
      src = c; sx = 0; sy = 0; sw = cw; sh = ch;
    }
    g.save();
    g.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';
    g.globalAlpha = Math.min(1, 0.35 + a * 0.85); // fades in: a faint smear first, then fully blurred
    g.drawImage(src, 0, 0, sw, sh, x, y, w, h);
    g.restore();
  }

  // For a monster closing in: `closeness` runs 0 (far) to 1 (touching). There's
  // no blur at all until it's right next to you, then it ramps up fast.
  function proximity(g, x, y, w, h, closeness) {
    const k = Math.max(0, (closeness - 0.7) / 0.3);
    blur(g, x, y, w, h, k * k);
  }

  window.ScreenFx = { blur, proximity };
})();
