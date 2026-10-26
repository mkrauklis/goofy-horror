// Main menu music: a slow, dark ambient loop made entirely of Web Audio (no
// audio files, like everything else here) -- a low drone with a breathing
// filter, a pad that moves through four chords every 8 seconds, sparse
// music-box bell notes in A phrygian, and a faint heartbeat underneath.
//
// Browsers won't make sound before the page has been clicked or a key pressed,
// so it starts on the first of those. The #music-toggle button (shared look with
// the in-level one) turns it off and on, and the choice is remembered.
(function () {
  const KEY = 'goofy-horror-menu-music';
  const btn = document.getElementById('music-toggle');
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* storage blocked: stay on */ }

  let ctx = null, master = null, bus = null, timer = null;
  let nextBell = 0, nextBeat = 0, nextChord = 0, chordIndex = 0, started = false;

  const A = 110;                                    // A2
  const hz = (semi) => A * Math.pow(2, semi / 12);
  // chords as semitone offsets from A2: Am, F, Dm, E
  const CHORDS = [[0, 7, 12, 15], [-4, 3, 8, 12], [-7, 0, 5, 9], [-5, 2, 7, 11]];
  const SCALE = [0, 1, 4, 5, 7, 8, 12, 13, 16, 17, 19];  // A phrygian, two octaves up from the bass

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    master.connect(ctx.destination);
    // everything goes through a short feedback echo for a bit of space
    bus = ctx.createGain();
    bus.connect(master);
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1800;
    bus.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(master);
    drone();
    return true;
  }

  function drone() {
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260; filter.Q.value = 3;
    const g = ctx.createGain(); g.gain.value = 0.2;
    [[-24, 'sawtooth', 0], [-17, 'sawtooth', 4], [-24, 'square', -5]].forEach(([semi, type, cents]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz(semi); o.detune.value = cents;
      o.connect(filter); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 130;
    lfo.connect(lg); lg.connect(filter.frequency); lfo.start();
    filter.connect(g); g.connect(bus);
  }

  function pad(at, semis, dur) {
    semis.forEach((s, i) => {
      [0, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(s + 12); o.detune.value = det + i;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.05, at + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g); g.connect(bus); o.start(at); o.stop(at + dur + 0.1);
      });
    });
  }

  function bell(at, semi, vel) {
    [[1, 1], [2.76, 0.28], [5.4, 0.1]].forEach(([mul, amp]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(semi + 12) * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.11 * vel * amp, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4 / mul);
      o.connect(g); g.connect(bus); o.start(at); o.stop(at + 2.6);
    });
  }

  function beat(at) {
    [[0, 1], [0.24, 0.7]].forEach(([d, v]) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, at + d); o.frequency.exponentialRampToValueAtTime(34, at + d + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at + d);
      g.gain.exponentialRampToValueAtTime(0.22 * v, at + d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d + 0.26);
      o.connect(g); g.connect(master); o.start(at + d); o.stop(at + d + 0.3);
    });
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const ahead = ctx.currentTime + 0.6;
    while (nextChord < ahead) {
      pad(Math.max(nextChord, ctx.currentTime), CHORDS[chordIndex % CHORDS.length], 9);
      chordIndex++; nextChord += 8;
    }
    while (nextBeat < ahead) { beat(nextBeat); nextBeat += 2.1; }
    while (nextBell < ahead) {
      const chord = CHORDS[(chordIndex + 3) % CHORDS.length];
      // mostly notes that belong to the current chord, now and then one from the wider scale
      const semi = Math.random() < 0.65 ? chord[Math.floor(Math.random() * chord.length)] + 12 : SCALE[Math.floor(Math.random() * SCALE.length)] + 12;
      if (Math.random() < 0.8) bell(nextBell, semi, 0.5 + Math.random() * 0.5);
      nextBell += 0.5 + Math.random() * 1.7;
    }
  }

  function start() {
    if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    if (!build()) return;
    started = true;
    ctx.resume();
    nextChord = nextBeat = nextBell = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 200);
    schedule();
  }

  function render() {
    if (!btn) return;
    btn.textContent = enabled ? '♪ Music: On' : '♪ Music: Off';
    btn.classList.toggle('muted', !enabled);
  }
  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (on) start();
    if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.2);
    render();
  }
  render();
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); setEnabled(!enabled); });

  // the first click / key press starts it (if it's switched on)
  const kick = () => {
    if (enabled) start();
    if (started) { window.removeEventListener('pointerdown', kick, true); window.removeEventListener('keydown', kick, true); }
  };
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume();
  });
})();
