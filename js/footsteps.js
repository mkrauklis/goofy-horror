// Footstep sound effects, one sound per surface: a hard facility floor, a
// crunchy snow floor, a flooded floor (splashes) and grass. Each level
// declares which surface it is, and routes its walk cycle through
// Footsteps.advance() -- a step plays every time the walk animation puts a
// foot down, so the pace of the steps always matches how fast you're moving
// (and sprinting is louder).
(function () {
  const state = new WeakMap(); // audioCtx -> { out, noise }

  function setup(ctx) {
    let s = state.get(ctx);
    if (s) return s;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    s = { out, noise };
    state.set(ctx, s);
    return s;
  }

  function burst(ctx, s, t, dur, vol, type, freq, q, freqEnd) {
    const src = ctx.createBufferSource(); src.buffer = s.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(s.out);
    src.start(t, Math.random() * 0.2); src.stop(t + dur + 0.02);
  }
  function thump(ctx, s, t, vol, f0, f1, dur) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(s.out); o.start(t); o.stop(t + dur + 0.02);
  }

  // loud: ~0.5 (exhausted shuffle) .. 1 (walking) .. 2 (sprinting)
  function step(ctx, surface, loud) {
    if (!ctx || ctx.state !== 'running') return;
    const s = setup(ctx);
    const t = ctx.currentTime + 0.005;
    const v = Math.max(0.35, Math.min(1.6, loud || 1));
    const r = 0.88 + Math.random() * 0.24; // every step a little different
    if (surface === 'snow') {
      // a crunch: a handful of tiny grains, plus a soft dull thud
      for (let i = 0; i < 5; i++) burst(ctx, s, t + i * 0.011 + Math.random() * 0.008, 0.03, 0.07 * v, 'bandpass', 2600 * r, 0.8);
      burst(ctx, s, t, 0.09, 0.05 * v, 'lowpass', 700, 0.7);
      thump(ctx, s, t, 0.05 * v, 90, 50, 0.08);
    } else if (surface === 'water') {
      // a splash: a wet whoosh that falls in pitch, and often a small bubble
      burst(ctx, s, t, 0.17, 0.13 * v, 'lowpass', 2200 * r, 0.9, 420);
      burst(ctx, s, t + 0.02, 0.07, 0.05 * v, 'highpass', 3200, 0.7);
      if (Math.random() < 0.6) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(380 * r, t + 0.03); o.frequency.exponentialRampToValueAtTime(980 * r, t + 0.1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + 0.03); g.gain.exponentialRampToValueAtTime(0.04 * v, t + 0.045); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        o.connect(g); g.connect(s.out); o.start(t + 0.03); o.stop(t + 0.13);
      }
      thump(ctx, s, t, 0.05 * v, 120, 60, 0.07);
    } else if (surface === 'grass') {
      // a soft swish of blades, and a muffled step underneath
      burst(ctx, s, t, 0.1, 0.075 * v, 'bandpass', 3400 * r, 0.5);
      burst(ctx, s, t + 0.015, 0.06, 0.04 * v, 'highpass', 5200, 0.6);
      thump(ctx, s, t, 0.035 * v, 100, 55, 0.07);
    } else {
      // a hard floor: a crisp tap and a low knock
      burst(ctx, s, t, 0.04, 0.11 * v, 'bandpass', 1500 * r, 1.1);
      burst(ctx, s, t, 0.025, 0.05 * v, 'highpass', 4200, 0.7);
      thump(ctx, s, t, 0.09 * v, 130 * r, 55, 0.07);
    }
  }

  // Advances a player's walk cycle by `amount` radians and plays a footstep
  // each time it passes a half-cycle (a foot coming down).
  function advance(p, amount, ctx, surface, loud) {
    const before = Math.floor(p.walkPhase / Math.PI);
    p.walkPhase += amount;
    if (Math.floor(p.walkPhase / Math.PI) !== before) step(ctx, surface, loud);
  }

  window.Footsteps = { step, advance };
})();
