// A shared boss theme in the vein of old-school Doom: a palm-muted
// distorted-guitar gallop on one low note, jumping up and down the scale
// on the accents, driven by a double-kick, a backbeat snare and a
// screaming lead over the top. Every boss level starts one of these with
// its own key and tempo (see the `theme` argument), and tells it two
// things through callbacks: whether the fight is on right now, and how
// intense it is (0..1, typically 1 - bossHealthFraction) -- intensity
// speeds the tempo up, turns the kick into a constant double-bass gallop,
// and brings the lead in earlier.
//
//   const music = BossMusic.start({ audioCtx, dest: musicMasterGain,
//     theme: { root: 82.4, bpm: 150 },
//     isActive: () => gameState === 'playing',
//     intensity: () => 1 - bossHealthFrac() });
(function () {
  // Riff bars, 16 sixteenth-notes each, in semitones above the root.
  // `null` = a rest; 0 = the palm-muted chug; anything else is an accent.
  const BARS = [
    [0, 0, 12, 0, 0, 10, 0, 0, 8, 0, 0, 6, 0, 0, 7, 8],
    [0, 0, 12, 0, 0, 10, 0, 0, 8, 0, 0, 7, 0, 0, 5, 3],
    [0, 0, 15, 0, 0, 13, 0, 0, 12, 0, 0, 10, 0, 0, 8, 7],
    [0, 0, 0, 0, 0, 0, 0, 0, -2, -2, -2, -2, -4, -4, -5, -5],
  ];
  // Lead phrases (semitones above the root, in the octave three up), one
  // per bar, 0 = hold the previous note. Phrygian-flavoured.
  const LEAD = [
    [12, 0, 0, 0, 13, 0, 12, 0, 8, 0, 0, 0, 7, 0, 8, 0],
    [15, 0, 0, 15, 13, 0, 12, 0, 13, 0, 0, 0, 12, 0, 0, 0],
    [20, 0, 19, 0, 17, 0, 15, 0, 13, 0, 15, 0, 17, 0, 0, 0],
    [24, 0, 0, 0, 0, 0, 22, 0, 20, 0, 19, 0, 17, 0, 15, 13],
  ];

  function distortionCurve(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * k);
    }
    return curve;
  }

  function start(opts) {
    const ctx = opts.audioCtx;
    if (!ctx) return null;
    const theme = Object.assign({ root: 82.4, bpm: 150 }, opts.theme || {});
    const isActive = opts.isActive || (() => true);
    const intensity = opts.intensity || (() => 0);

    const out = ctx.createGain();
    out.gain.value = opts.gain === undefined ? 0.55 : opts.gain;
    out.connect(opts.dest || ctx.destination);

    // guitar bus: heavy distortion, then a lowpass so it growls rather than fizzes
    const guitarDist = ctx.createWaveShaper();
    guitarDist.curve = distortionCurve(6);
    guitarDist.oversample = '2x';
    const guitarOut = ctx.createGain();
    guitarOut.gain.value = 0.35;
    guitarDist.connect(guitarOut);
    guitarOut.connect(out);

    const leadDist = ctx.createWaveShaper();
    leadDist.curve = distortionCurve(3);
    const leadOut = ctx.createGain();
    leadOut.gain.value = 0.16;
    leadDist.connect(leadOut);
    leadOut.connect(out);

    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    function guitar(freq, t, dur, accent) {
      [-7, 7].forEach((det) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = accent ? 2600 : 1000; // palm-muted chugs are dull, accents ring
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(accent ? 0.55 : 0.4, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(f); f.connect(g); g.connect(guitarDist);
        osc.start(t); osc.stop(t + dur + 0.03);
      });
      // a sub-octave under it so it hits in the chest
      const sub = ctx.createOscillator();
      sub.type = 'square';
      sub.frequency.value = freq / 2;
      const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 200;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sub.connect(sf); sf.connect(sg); sg.connect(out);
      sub.start(t); sub.stop(t + dur + 0.03);
    }
    function leadNote(freq, t, dur) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 0.97, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vg = ctx.createGain(); vg.gain.value = freq * 0.012;
      vib.connect(vg); vg.connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.02);
      g.gain.setValueAtTime(1, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(leadDist);
      osc.start(t); vib.start(t);
      osc.stop(t + dur + 0.03); vib.stop(t + dur + 0.03);
    }
    function kick(t) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.16);
    }
    function noiseHit(t, dur, vol, hp) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t); src.stop(t + dur + 0.02);
    }
    function snare(t) { noiseHit(t, 0.16, 0.5, 1500); kick(t + 0.001); }

    let step = 0;
    let nextTime = 0;
    const hz = (semi, octave) => theme.root * (octave || 1) * Math.pow(2, semi / 12);

    function scheduleStep(idx, t, inten) {
      const bar = Math.floor(idx / 16) % 4, s = idx % 16;
      const stepDur = 60 / (theme.bpm * (1 + 0.22 * inten)) / 4;
      const semi = BARS[bar][s];
      const accent = semi !== 0;
      guitar(hz(semi, 2), t, stepDur * (accent ? 1.9 : 0.8), accent);

      // drums: backbeat snare; kick on the beat, doubling up into a
      // constant gallop once the fight gets intense (and in bar 4 always)
      if (s === 4 || s === 12) snare(t);
      const gallop = inten > 0.45 || bar === 3;
      if (s % 4 === 0 || (gallop && s % 2 === 0 && s !== 4 && s !== 12) || (inten > 0.8 && s % 2 === 1 && s !== 5 && s !== 13)) kick(t);
      if (s % 2 === 0) noiseHit(t, 0.04, 0.12, 7000);
      if (s === 0 && bar === 0) noiseHit(t, 0.7, 0.2, 5000); // crash at the top of the cycle

      // the lead: bars 3 and 4 of the cycle always; every bar once it's intense
      if (bar >= 2 || inten > 0.5) {
        const n = LEAD[bar][s];
        if (n) { leadNote(hz(n, 2), t, stepDur * (s % 4 === 0 ? 3.4 : 1.7)); }
      }
    }

    const timer = setInterval(() => {
      if (ctx.state !== 'running') { nextTime = ctx.currentTime + 0.1; return; }
      if (!isActive()) { nextTime = ctx.currentTime + 0.1; step = 0; return; }
      const inten = Math.max(0, Math.min(1, intensity()));
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime, inten);
        nextTime += 60 / (theme.bpm * (1 + 0.22 * inten)) / 4;
        step++;
      }
    }, 30);

    return { stop() { clearInterval(timer); out.disconnect(); } };
  }

  window.BossMusic = { start };
})();
