// Boss themes. Every boss fight gets its own track, all built from the same
// small synth/drum kit and a 4-bar, 16-step-per-bar sequencer so they stay
// small and procedural (no asset files):
//
//   ashen    (Level 5,  the Ashen One)      -- Doom-style gallop: palm-muted distorted
//                                              chugs, double kick, screaming lead
//   knight   (Level 10, the Last Knight)    -- a marching power-chord dirge: snare rolls,
//                                              brass fanfare, harmonic minor
//   mutation (Level 15, Frozen Mutation)    -- slow doom half-time, locrian, icy bells
//                                              through a long echo
//   cistern  (Level 20, the Cistern)        -- underwater: muffled swung sub-bass,
//                                              sonar pings, bubbling toms
//   cultivator (Level 25, the Cultivator)   -- industrial: harsh square-wave bass,
//                                              metal clanks, a stuttering plucked arp
//   gargoyle (Level 30, the Garguantuagoyle)-- gothic blast-beat metal: tremolo
//                                              picking under a choir/organ pad
//   candy    (Halloween 5, the Candy Kraken) -- a bouncy, sinister carnival oompah
//                                              with a music-box lead
//
// A level starts its track with BossMusic.start({ audioCtx, dest, theme:
// 'name', isActive, intensity }). `isActive()` says whether the fight is on
// right now and `intensity()` (0..1, usually 1 - bossHealthFraction) speeds
// the tempo up and fills in the drums/lead.
(function () {
  const N = null;
  const THEMES = {
    ashen: {
      root: 82.4, bpm: 150,
      bars: [
        [0, 0, 12, 0, 0, 10, 0, 0, 8, 0, 0, 6, 0, 0, 7, 8],
        [0, 0, 12, 0, 0, 10, 0, 0, 8, 0, 0, 7, 0, 0, 5, 3],
        [0, 0, 15, 0, 0, 13, 0, 0, 12, 0, 0, 10, 0, 0, 8, 7],
        [0, 0, 0, 0, 0, 0, 0, 0, -2, -2, -2, -2, -4, -4, -5, -5],
      ],
      lead: [
        [12, N, N, N, 13, N, 12, N, 8, N, N, N, 7, N, 8, N],
        [15, N, N, 15, 13, N, 12, N, 13, N, N, N, 12, N, N, N],
        [20, N, 19, N, 17, N, 15, N, 13, N, 15, N, 17, N, N, N],
        [24, N, N, N, N, N, 22, N, 20, N, 19, N, 17, N, 15, 13],
      ],
      leadBars: [2, 3], leadInten: 0.5, leadTimbre: 'saw',
      guitar: { k: 6, accentLP: 2600, chugLP: 1000, wave: 'sawtooth', accentLen: 1.9, chugLen: 0.8 },
      drums: 'doom',
    },
    knight: {
      root: 73.4, bpm: 138,
      bars: [
        [[0, 7], N, N, [0, 7], N, N, [0, 7], N, [7, 14], N, N, [7, 14], N, N, [5, 12], N],
        [[0, 7], N, N, [0, 7], N, N, [3, 10], N, [5, 12], N, N, [5, 12], N, N, [7, 14], N],
        [[5, 12], N, N, [5, 12], N, N, [3, 10], N, [2, 9], N, N, [2, 9], N, N, [0, 7], N],
        [[0, 7], N, [0, 7], N, [7, 14], N, [7, 14], N, [8, 15], N, [11, 18], N, [12, 19], N, [12, 19], [12, 19]],
      ],
      lead: [
        [N, N, N, N, N, N, N, N, N, N, N, N, N, N, N, N],
        [12, N, N, N, 15, N, N, N, 14, N, 12, N, 11, N, N, N],
        [19, N, N, 19, 17, N, 15, N, 14, N, 12, N, 14, N, N, N],
        [24, N, N, N, 23, N, 24, N, 26, N, N, N, 24, N, N, N],
      ],
      leadBars: [1, 2, 3], leadInten: 0.3, leadTimbre: 'brass',
      guitar: { k: 4, accentLP: 2200, chugLP: 1800, wave: 'sawtooth', accentLen: 2.6, chugLen: 2.6 },
      drums: 'march',
    },
    mutation: {
      root: 65.4, bpm: 78,
      bars: [
        [0, N, N, N, 0, N, N, N, 1, N, N, N, 0, N, 6, N],
        [0, N, N, N, 0, N, N, N, 3, N, N, N, 1, N, N, N],
        [0, N, N, 0, N, N, 0, N, 6, N, N, 6, N, N, 5, N],
        [-2, N, N, N, -2, N, N, N, -5, N, N, N, -6, N, N, N],
      ],
      lead: [
        [N, N, N, N, N, N, N, N, N, N, N, N, N, N, N, N],
        [N, N, N, N, 24, N, N, N, N, N, N, N, 22, N, N, N],
        [27, N, N, N, N, N, 24, N, N, N, N, N, 22, N, N, N],
        [30, N, N, N, 29, N, N, N, 27, N, N, N, N, N, 24, N],
      ],
      leadBars: [1, 2, 3], leadInten: 0, leadTimbre: 'bell',
      guitar: { k: 5, accentLP: 1500, chugLP: 700, wave: 'sawtooth', accentLen: 5, chugLen: 3 },
      drums: 'halftime',
      echo: { time: 0.38, feedback: 0.55, wet: 0.45 },
      pad: { chords: [[24, 27, 30], [24, 27, 30], [25, 28, 31], [22, 25, 28]], wave: 'sine', gain: 0.07, lp: 1800 },
    },
    cistern: {
      root: 55, bpm: 118, swing: 0.22,
      bars: [
        [0, N, N, 0, N, N, 0, N, N, 0, N, 0, N, N, 6, N],
        [0, N, N, 0, N, N, 0, N, N, 0, N, 0, N, N, 4, N],
        [0, N, N, 0, N, N, 0, N, N, 0, N, 0, N, 2, 4, 6],
        [-2, N, N, -2, N, N, -2, N, N, -4, N, -4, N, N, -6, N],
      ],
      lead: [
        [N, N, N, N, N, N, N, N, N, N, N, N, N, N, N, N],
        [N, N, 24, N, N, N, N, N, 28, N, N, N, N, N, N, N],
        [30, N, N, N, 28, N, N, 26, N, N, 24, N, N, N, N, N],
        [32, N, N, N, 30, N, N, N, 28, N, 26, N, 24, N, N, N],
      ],
      leadBars: [1, 2, 3], leadInten: 0, leadTimbre: 'ping',
      guitar: { k: 1.4, accentLP: 650, chugLP: 380, wave: 'sawtooth', accentLen: 2.4, chugLen: 1.6, lfo: 0.35 },
      drums: 'water',
      echo: { time: 0.32, feedback: 0.6, wet: 0.5 },
      pad: { chords: [[24, 30, 34], [24, 30, 34], [22, 28, 34], [20, 26, 32]], wave: 'sine', gain: 0.08, lp: 900 },
    },
    cultivator: {
      root: 92.5, bpm: 154,
      bars: [
        [0, 0, 6, 0, 0, 6, 0, 0, 6, 0, 0, 6, 0, 0, 5, 0],
        [0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 5, 0],
        [0, 0, 10, 0, 0, 10, 0, 0, 9, 0, 0, 9, 0, 0, 8, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -2, -2],
      ],
      lead: [
        [12, 15, 17, 19, 17, 15, 12, 15, 17, 19, 22, 19, 17, 15, 12, N],
        [12, 15, 17, 19, 17, 15, 12, 15, 17, 19, 22, 19, 24, 22, 19, N],
        [24, 22, 19, 17, 24, 22, 19, 17, 22, 19, 17, 15, 22, 19, 17, 15],
        [12, N, 12, N, 15, N, 15, N, 17, N, 17, N, 19, 22, 24, 27],
      ],
      leadBars: [0, 1, 2, 3], leadInten: 0, leadTimbre: 'pluck',
      guitar: { k: 14, accentLP: 3000, chugLP: 1300, wave: 'square', accentLen: 1.5, chugLen: 0.7 },
      drums: 'industrial',
    },
    candy: {
      root: 98, bpm: 148,
      bars: [
        [0, N, N, N, [7, 12], N, N, N, 0, N, N, N, [7, 12], N, N, N],
        [-2, N, N, N, [5, 10], N, N, N, -2, N, N, N, [5, 10], N, N, N],
        [3, N, N, N, [10, 15], N, N, N, 3, N, N, N, [10, 15], N, N, N],
        [0, N, 3, N, 5, N, 6, N, 7, N, 6, N, 5, N, 3, N],
      ],
      lead: [
        [12, N, 15, N, 19, N, 15, N, 12, N, 15, N, 19, N, N, N],
        [10, N, 14, N, 17, N, 14, N, 10, N, 14, N, 17, N, N, N],
        [15, N, 19, N, 22, N, 19, N, 15, N, 19, N, 22, N, N, N],
        [24, N, 22, N, 19, N, 15, N, 12, N, 15, N, 19, N, 24, N],
      ],
      leadBars: [0, 1, 2, 3], leadInten: 0, leadTimbre: 'pluck',
      guitar: { k: 3, accentLP: 2200, chugLP: 1200, wave: 'square', accentLen: 1.6, chugLen: 1.0 },
      drums: 'march',
    },
    gargoyle: {
      root: 98, bpm: 176,
      bars: [
        [0, 0, 0, 0, 3, 3, 3, 3, 5, 5, 5, 5, 3, 3, 2, 2],
        [0, 0, 0, 0, 7, 7, 7, 7, 8, 8, 8, 8, 7, 7, 5, 5],
        [8, 8, 8, 8, 7, 7, 7, 7, 5, 5, 3, 3, 2, 2, 0, 0],
        [0, 0, 12, 12, 0, 0, 11, 11, 0, 0, 10, 10, 0, 0, 7, 7],
      ],
      lead: [
        [N, N, N, N, N, N, N, N, N, N, N, N, N, N, N, N],
        [24, N, N, N, 27, N, N, N, 29, N, 27, N, 26, N, N, N],
        [31, N, N, 31, 29, N, 27, N, 26, N, 24, N, 26, N, N, N],
        [36, N, N, N, 35, N, N, N, 34, N, 31, N, 32, N, 31, N],
      ],
      leadBars: [1, 2, 3], leadInten: 0.4, leadTimbre: 'saw',
      guitar: { k: 7, accentLP: 3400, chugLP: 3200, wave: 'sawtooth', accentLen: 0.9, chugLen: 0.9 },
      drums: 'blast',
      pad: { chords: [[24, 27, 31], [29, 32, 36], [31, 34, 38], [27, 30, 34]], wave: 'sawtooth', gain: 0.05, lp: 900, attack: 0.35 },
    },
  };

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
    const base = typeof opts.theme === 'string' ? THEMES[opts.theme] : opts.theme;
    const T = Object.assign({}, THEMES.ashen, base || {});
    const isActive = opts.isActive || (() => true);
    const intensity = opts.intensity || (() => 0);

    const out = ctx.createGain();
    out.gain.value = opts.gain === undefined ? 0.55 : opts.gain;
    out.connect(opts.dest || ctx.destination);

    // guitar/bass bus: distortion, then a mix level
    const guitarDist = ctx.createWaveShaper();
    guitarDist.curve = distortionCurve(T.guitar.k);
    guitarDist.oversample = '2x';
    const guitarOut = ctx.createGain();
    guitarOut.gain.value = 0.35;
    guitarDist.connect(guitarOut);
    guitarOut.connect(out);

    // lead bus (optionally through an echo)
    const leadDist = ctx.createWaveShaper();
    leadDist.curve = distortionCurve(3);
    const leadOut = ctx.createGain();
    leadOut.gain.value = 0.16;
    leadDist.connect(leadOut);
    const leadClean = ctx.createGain();
    leadClean.gain.value = 0.22;
    const leadSum = ctx.createGain();
    leadOut.connect(leadSum); leadClean.connect(leadSum);
    leadSum.connect(out);
    if (T.echo) {
      const d = ctx.createDelay(1.5); d.delayTime.value = T.echo.time;
      const fb = ctx.createGain(); fb.gain.value = T.echo.feedback;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2400;
      const wet = ctx.createGain(); wet.gain.value = T.echo.wet;
      leadSum.connect(d); d.connect(damp); damp.connect(fb); fb.connect(d);
      damp.connect(wet); wet.connect(out);
    }
    const padOut = ctx.createGain();
    padOut.gain.value = 1;
    padOut.connect(out);

    const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const hz = (semi, octave) => T.root * (octave || 1) * Math.pow(2, semi / 12);

    function guitarNote(freq, t, dur, accent) {
      const G = T.guitar;
      [-7, 7].forEach((det) => {
        const osc = ctx.createOscillator();
        osc.type = G.wave;
        osc.frequency.value = freq;
        osc.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = accent ? G.accentLP : G.chugLP; // palm-muted chugs are dull, accents ring
        if (G.lfo) { // a slow wobble on the filter, for the underwater boss
          const lfo = ctx.createOscillator(); lfo.frequency.value = G.lfo;
          const lg = ctx.createGain(); lg.gain.value = G.accentLP * 0.35;
          lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + dur + 0.03);
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(accent ? 0.55 : 0.4, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(f); f.connect(g); g.connect(guitarDist);
        osc.start(t); osc.stop(t + dur + 0.03);
      });
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
      const kind = T.leadTimbre;
      if (kind === 'bell') {
        [[1, 0.7], [2.76, 0.3], [5.4, 0.12]].forEach(([m, v]) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(v, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 3.2);
          o.connect(g); g.connect(leadClean);
          o.start(t); o.stop(t + dur * 3.2 + 0.03);
        });
        return;
      }
      if (kind === 'ping') {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freq * 1.02, t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 2.4);
        o.connect(g); g.connect(leadClean);
        o.start(t); o.stop(t + dur * 2.4 + 0.03);
        return;
      }
      if (kind === 'pluck') {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(500, t + dur * 0.9);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.8, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
        o.connect(f); f.connect(g); g.connect(leadClean);
        o.start(t); o.stop(t + dur + 0.03);
        return;
      }
      if (kind === 'brass') {
        [0, 1].forEach((i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.value = freq * (i ? 2 : 1); o.detune.value = i ? 6 : -6;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass';
          f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.09);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(i ? 0.5 : 1, t + 0.04);
          g.gain.setValueAtTime(i ? 0.5 : 1, t + dur * 0.75);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(f); f.connect(g); g.connect(leadClean);
          o.start(t); o.stop(t + dur + 0.03);
        });
        return;
      }
      // 'saw': the screaming distorted lead with vibrato
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

    function padChord(semis, t, dur) {
      const P = T.pad;
      semis.forEach((s, i) => {
        const o = ctx.createOscillator(); o.type = P.wave; o.frequency.value = hz(s, 1); o.detune.value = (i - 1) * 7;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = P.lp;
        const g = ctx.createGain();
        const at = P.attack || 0.15;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(P.gain, t + at);
        g.gain.setValueAtTime(P.gain, t + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(padOut);
        o.start(t); o.stop(t + dur + 0.03);
      });
    }

    // ---- drums
    function kick(t, vol) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
      g.gain.setValueAtTime(vol || 0.7, t);
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
    function snare(t, vol) { noiseHit(t, 0.16, vol || 0.5, 1500); kick(t + 0.001, 0.4); }
    function hat(t, vol) { noiseHit(t, 0.04, vol || 0.12, 7000); }
    function crash(t) { noiseHit(t, 0.7, 0.2, 5000); }
    function tom(t, f, vol) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
      g.gain.setValueAtTime(vol || 0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    }
    function clank(t) {
      noiseHit(t, 0.09, 0.28, 3500);
      [523, 831, 1397].forEach((fr) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.16);
      });
    }

    const DRUMS = {
      // fast gallop: backbeat snare, kick on the beat, doubling into a constant gallop
      doom(s, bar, inten, t) {
        if (s === 4 || s === 12) snare(t);
        const gallop = inten > 0.45 || bar === 3;
        if (s % 4 === 0 || (gallop && s % 2 === 0 && s !== 4 && s !== 12) || (inten > 0.8 && s % 2 === 1 && s !== 5 && s !== 13)) kick(t);
        if (s % 2 === 0) hat(t);
        if (s === 0 && bar === 0) crash(t);
      },
      // a marching pulse: kick 1-and-3 with a gallop at the end of each phrase, a roll on bar 4
      march(s, bar, inten, t) {
        if ([0, 6, 8, 14].includes(s)) kick(t);
        if (s === 4 || s === 12) snare(t, 0.55);
        if (bar === 3 && s >= 12) snare(t, 0.28 + (s - 12) * 0.08);
        if (inten > 0.5 && s % 2 === 1) hat(t, 0.08);
        if (s === 0 && bar === 0) crash(t);
      },
      // slow, heavy half-time
      halftime(s, bar, inten, t) {
        if (s === 0 || s === 10 || (inten > 0.5 && s === 6)) kick(t, 0.8);
        if (s === 8) snare(t, 0.6);
        if (s % 4 === 2) hat(t, 0.07);
        if (s === 0 && bar === 0) crash(t);
        if (inten > 0.6 && bar === 3 && s >= 12) tom(t, 90 - (s - 12) * 8, 0.5);
      },
      // underwater: syncopated sub-kick with bubbling toms, no hats
      water(s, bar, inten, t) {
        if ([0, 3, 6, 10].includes(s)) kick(t, 0.75);
        if (s === 8) snare(t, 0.3);
        if (bar % 2 === 1 && (s === 13 || s === 15)) tom(t, 130 - s * 2, 0.35);
        if (bar === 3 && s >= 12) tom(t, 150 - (s - 12) * 15, 0.45);
        if (inten > 0.5 && s % 4 === 2) hat(t, 0.05);
      },
      // grouped 3-3-3-3-2-2 machine feel with metal clanks on the offbeats
      industrial(s, bar, inten, t) {
        if ([0, 3, 6, 9, 12, 14].includes(s)) kick(t, 0.75);
        if (s === 4 || s === 10) snare(t, 0.5);
        if ([2, 5, 8, 11, 13, 15].includes(s)) { if (s % 3 === 2 || inten > 0.5) clank(t); }
        if (s === 0 && bar === 0) crash(t);
      },
      // blast beat: kick and snare trade 16ths once the fight's hot
      blast(s, bar, inten, t) {
        if (inten > 0.35) { if (s % 2 === 0) kick(t, 0.6); else snare(t, 0.32); }
        else { if (s % 2 === 0) kick(t, 0.6); if (s === 4 || s === 12) snare(t); }
        if (s % 2 === 0) hat(t, 0.1);
        if (s === 0) crash(t);
      },
    };

    let step = 0;
    let nextTime = 0;
    const drumFn = DRUMS[T.drums] || DRUMS.doom;
    const semiOf = (v) => Array.isArray(v) ? v : [v];

    function stepDurFor(inten) { return 60 / (T.bpm * (1 + 0.22 * inten)) / 4; }

    function scheduleStep(idx, t0, inten) {
      const bar = Math.floor(idx / 16) % 4, s = idx % 16;
      const stepDur = stepDurFor(inten);
      // swing delays the off-sixteenths a little
      const t = t0 + (T.swing && s % 2 === 1 ? stepDur * T.swing : 0);

      const cell = T.bars[bar][s];
      if (cell !== null && cell !== undefined) {
        const semis = semiOf(cell);
        const accent = semis.some((x) => x !== 0);
        const len = stepDur * (accent ? T.guitar.accentLen : T.guitar.chugLen);
        semis.forEach((sm) => guitarNote(hz(sm, 2), t, len, accent));
      }
      drumFn(s, bar, inten, t0);

      if (T.pad && s === 0) padChord(T.pad.chords[bar], t0, stepDur * 16);

      if (T.leadBars.includes(bar) || inten > T.leadInten) {
        const n = T.lead[bar][s];
        if (n !== null && n !== undefined) leadNote(hz(n, 2), t, stepDur * (s % 4 === 0 ? 3.4 : 1.7));
      }
    }

    const timer = setInterval(() => {
      if (ctx.state !== 'running') { nextTime = ctx.currentTime + 0.1; return; }
      if (!isActive()) { nextTime = ctx.currentTime + 0.1; step = 0; return; }
      const inten = Math.max(0, Math.min(1, intensity()));
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime, inten);
        nextTime += stepDurFor(inten);
        step++;
      }
    }, 30);

    return { stop() { clearInterval(timer); out.disconnect(); } };
  }

  window.BossMusic = { start, themes: Object.keys(THEMES) };
})();
