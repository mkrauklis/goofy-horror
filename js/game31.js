(function () {
  const HM = window.HardMode;
  const FOOT_SURFACE = 'normal'; // which footstep sound to use (js/footsteps.js)
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(31)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  // Hard mode swaps the whole level for the Being of Pure Chaos (level31hard.html);
  // once it's dead that page sends you back here just for the ending.
  let endingOnly = false;
  try {
    endingOnly = sessionStorage.getItem('goofy-chaos-ending') === '1';
    if (endingOnly) sessionStorage.removeItem('goofy-chaos-ending');
  } catch (e) { /* no sessionStorage: play the level */ }

  const LEVEL = window.LEVEL31;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_H = ROWS * TILE;
  const WORLD_W = COLS * TILE;

  const PLAYER_MODE = (window.GoofyStory && window.GoofyStory.getPlayerMode()) || 2;
  const FULL_W = 920;
  const VIEW_H = 340;
  // On foot each player gets their own viewport (like every other level);
  // once everyone's in a car there's one road to watch, so the chase is a
  // single full-width view in both modes.
  const FOOT_VIEW_W = PLAYER_MODE === 1 ? FULL_W : FULL_W / 2;
  const FOOT_ZOOM = 1;
  const FOOT_CAM_LEAN = 60; // on foot the camera sits this far north of the player, so the facility's entrance stays in view
  const CHASE_ZOOM_MAX = 0.62;
  const CHASE_ZOOM_MIN = 0.3;

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;
  const WALK_CYCLE_SPEED = 9;

  // The cars: 3x player speed, direct request. Two players get a car each.
  const CAR_MAX = PLAYER_SPEED * 3;
  const CONE_SLOW_MS = 3000; // hitting a traffic cone caps your speed at half for this long
  const CAR_ACCEL = 420;
  const CAR_BRAKE = 760;
  const CAR_REV_MAX = 110;
  const CAR_TURN = 2.7;
  const BOARD_RADIUS = 84;

  // The Multipod: every monster in the game in one group, 500 HP, chasing
  // at 3x player speed. A solo missile does 25; with two cars each car's
  // missiles do half of that (12.5), so the pair of you still do the same
  // damage per volley.
  const BOSS_MAX_HEALTH = HM.bossHp(500);
  const MISSILE_DAMAGE = PLAYER_MODE === 1 ? 25 : 12.5;
  const MISSILE_SPEED = HM.proj(PLAYER_SPEED * 5);
  const MISSILE_TURN = 6.5;
  const MISSILE_COOLDOWN_MS = 1100;
  const MISSILE_LIFE_MS = 6000;
  const BOSS_SPEED = PLAYER_SPEED * 3;
  // Every 2.5s the swarm hurls one of the game's own projectiles at a car,
  // at 6x walking speed, led to where the car's going. One hit and it's dead.
  const THROW_INTERVAL_MS = 2500;
  const THROW_SPEED = HM.proj(PLAYER_SPEED * 6);
  const THROW_HIT_RADIUS = 24;
  const CATCHUP_START = 560;
  const CATCHUP_FULL = 1000;
  const BOSS_SPREAD = 180; // 1.5x the original 120
  const BOSS_HIT_RADIUS = 168;
  const BOSS_EMERGE_MS = 1200;
  const BOSS_RAMP_MS = 600;
  const HIT_KNOCKBACK = 170;
  const CATCH_DIST = 142;
  const DYING_MS = 2600;
  const NUKE_MS = 14000;
  const NUKE_IMPACT_MS = 2600;
  const VICTORY_REDIRECT_MS = 3500;
  // After the Multipod falls its car is wrecked and the swarm splits into its
  // individual monsters, every one of them chasing at the runners' own speed.
  // You get out and run -- at the double, no stamina -- down a road that winds
  // through the forest and is littered with 2x1-tile concrete roadblocks to
  // weave around, to a military roadblock; passing through that plays the
  // soldiers' film just before the ending.
  const ESCAPE_RUN = PLAYER_SPEED * 2;
  const ESCAPE_ROAD_TILES = 52;
  const ESCAPE_HEAD = 640;         // nothing starts closer than this to a runner
  const SPLIT_STUN_MS = 1600;      // the pieces are dazed for this long after the split
  const ESCAPE_RAMP_MS = 500;
  const MILITARY_MS = 10000;
  // The road bends: [tiles from where the escape starts, rows the road has shifted]
  // smoothed between points, and it is back on the original line for the roadblock.
  const ESCAPE_BENDS = [[0, 0], [8, 0], [15, -7], [21, -7], [28, 5], [34, 5], [39, -4], [43, -4], [49, 0]];
  const ESCAPE_BLOCKS_FROM = 11, ESCAPE_BLOCKS_TO = 44, ESCAPE_BLOCK_EVERY = 5;
  // The credits that roll once the bomb has gone off: scrolled up the
  // screen like movie credits, then "THE END..." and a sting for "FOR NOW...".
  // gap = extra blank space (px) above that line.
  const CREDITS_TEXT = [
    { text: 'CREDITS', size: 13, color: '#8a8f99' },
    { text: 'yetidude-creator', size: 30, color: '#e8e2d6', gap: 6 },
    { text: 'are you happy with what you’ve done.', size: 20, color: '#d8d2c6', gap: 90 },
    { text: 'have you accomplished anything.', size: 20, color: '#d8d2c6', gap: 14 },
    { text: 'did you really win', size: 20, color: '#c9564a', gap: 14 },
    { text: 'thanks for playing.', size: 26, color: '#e8e2d6', gap: 90 },
    { text: 'especially bigredness and FGM.', size: 18, color: '#d88af0', gap: 10 },
    { text: 'and a special shout out to', size: 14, color: '#8a8f99', gap: 40 },
    { text: 'mdhkay', size: 22, color: '#d88af0', gap: 4 },
    { text: 'for testing the game.', size: 14, color: '#8a8f99', gap: 4 },
  ];
  const CREDITS_SCROLL_SPEED = 40; // px/s
  let creditsTotalH = 0;
  CREDITS_TEXT.forEach((l) => { creditsTotalH += (l.gap || 0); l.pos = creditsTotalH; creditsTotalH += l.size * 1.7; });
  const CREDITS_SCROLL_MS = (VIEW_H + 30 + creditsTotalH + 30) / CREDITS_SCROLL_SPEED * 1000;
  // after the scroll: THE END, an ellipsis fading in dot by dot, then FOR NOW...
  const END_DOTS_AT = [2200, 3200, 4200], END_OUT_AT = 6400, FORNOW_AT = 8000, FORNOW_OUT_AT = 11800, END_TAIL_MS = 12800;
  const CREDITS_MS = CREDITS_SCROLL_MS + END_TAIL_MS;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');
  const hudBossEl = document.getElementById('hud-boss');
  const hudGapEl = document.getElementById('hud-gap');
  const hudSpeedEl = document.getElementById('hud-speed');
  const hudPhaseEl = document.getElementById('hud-phase');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  // ---- procedural audio (no asset files): engines whose pitch follows the
  // lead car's speed, a calm bass pulse on foot, a full driving boss theme
  // during the chase, and one-shot effects.
  let audioCtx = null;
  let musicMasterGain = null;
  let musicEnabled = false;
  let musicTouched = false;
  let engineOsc = null;
  let engineGain = null;
  let noiseBuf = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = new AudioCtor();
    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.value = musicEnabled ? 1 : 0;
    musicMasterGain.connect(audioCtx.destination);

    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    const engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();

    setInterval(playFootBass, 190);
    setInterval(scheduleMusic, 25);
  }

  function playTone(freq, duration, type, peakGain, delay, dest) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain || 0.15, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(dest || audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
  function sweep(f0, f1, dur, type, peak) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
  function playMissileLaunch() { sweep(260, 800, 0.3, 'sawtooth', 0.2); }
  function playHit() { sweep(180, 40, 0.4, 'sawtooth', 0.32); }
  function playBonk() { sweep(140, 60, 0.15, 'square', 0.2); }
  function playCrash() { sweep(300, 30, 0.7, 'sawtooth', 0.4); }
  function playDoorBurst() { sweep(90, 30, 0.9, 'sawtooth', 0.35); }
  function playBoard() { [440, 660].forEach((f, i) => playTone(f, 0.18, 'triangle', 0.2, i * 0.1)); }
  function playThrow() { sweep(520, 180, 0.25, 'square', 0.15); }
  function playGun() {
    if (!audioCtx || !noiseBuf) return;
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
    const f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100 + Math.random() * 1000;
    const gn = audioCtx.createGain();
    gn.gain.setValueAtTime(0.14, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f); f.connect(gn); gn.connect(audioCtx.destination);
    src.start(t); src.stop(t + 0.09);
  }
  function playSplat() { sweep(190, 45, 0.2, 'sawtooth', 0.12); }
  function playNukeBoom() { sweep(110, 22, 2.4, 'sawtooth', 0.55); sweep(70, 18, 3.2, 'square', 0.3); }

  // ---- the boss theme: a driving minor-key track -- kick/snare/hat
  // pulse, a pumping saw bass, a square-wave arpeggio over an Am-F-G-E
  // progression -- that speeds up and adds a high stab line once the
  // Multipod is down to half health.
  const SEQ_ROOTS = [55, 43.65, 49, 41.2];
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
  let musicStep = 0;
  let nextNoteTime = 0;

  function musicTone(freq, t, dur, type, gainV, lp) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainV, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (lp) {
      const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      osc.connect(f); node = f;
    }
    node.connect(gain); gain.connect(musicMasterGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function musicNoise(t, dur, gainV, hp) {
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
    const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(gainV, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gain); gain.connect(musicMasterGain);
    src.start(t); src.stop(t + dur + 0.02);
  }
  function musicKick(t) {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(140, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(0.55, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain); gain.connect(musicMasterGain); osc.start(t); osc.stop(t + 0.2);
  }
  function scheduleStep(stepIdx, t, intense) {
    const bar = Math.floor(stepIdx / 16) % 4, s = stepIdx % 16;
    if (s % 4 === 0 || s === 10) musicKick(t);
    if (s === 4 || s === 12) { musicNoise(t, 0.13, 0.32, 1400); musicTone(190, t, 0.08, 'triangle', 0.12); }
    if (intense || s % 2 === 0) musicNoise(t, 0.04, s % 4 === 2 ? 0.1 : 0.06, 7000);
    if (s % 2 === 0) musicTone(s % 8 === 6 ? SEQ_ROOTS[bar] * 2 : SEQ_ROOTS[bar], t, 0.17, 'sawtooth', 0.17, 430);
    const ch = CHORDS[bar];
    const note = ch[[0, 1, 2, 1][s % 4]] * (intense && s % 8 >= 4 ? 2 : 1);
    musicTone(note, t, 0.09, 'square', 0.04, 2600);
    if (s === 0) musicTone(ch[0] * (intense ? 2 : 1), t, 0.6, 'sawtooth', intense ? 0.06 : 0.04, 1500);
    if (intense && s === 8) musicTone(ch[2] * 2, t, 0.35, 'square', 0.05, 3200);
  }
  // ---- the end-game theme: plays under the scrolling credits. A slow,
  // bittersweet A-minor/C-major ballad (Am F C G | Am F G C): a warm saw pad,
  // a round bass, a rising arpeggio, and a singing triangle lead that comes in
  // on the third bar, with a soft heartbeat kick and brushed hats joining as
  // it builds. It's routed through its own bus so it can be faded out the
  // moment the credits end (or are skipped), before the closing sting.
  const CREDITS_BPM = 72;
  const CR_CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]];
  const CR_PROG = [0, 1, 2, 3, 0, 1, 3, 2];                      // Am F C G | Am F G C
  const CR_ROOTS = [110, 87.31, 130.81, 98];
  const CR_MELODY = [                                             // [step, Hz, length in steps]
    [[0, 659.25, 6], [8, 523.25, 4], [12, 587.33, 4]],
    [[0, 698.46, 6], [8, 587.33, 4], [12, 523.25, 4]],
    [[0, 659.25, 4], [4, 783.99, 4], [8, 659.25, 8]],
    [[0, 587.33, 6], [8, 493.88, 4], [12, 587.33, 4]],
    [[0, 659.25, 6], [8, 880, 4], [12, 783.99, 4]],
    [[0, 698.46, 6], [8, 783.99, 4], [12, 698.46, 4]],
    [[0, 587.33, 4], [4, 698.46, 4], [8, 783.99, 8]],
    [[0, 659.25, 14]],
  ];
  let creditsBus = null;
  let creditsBusOn = false;
  let creditsStep = 0;
  function creditsTone(freq, t, dur, type, gainV, lp, attack) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainV, t + (attack || 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (lp) {
      const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
      osc.connect(f); node = f;
    }
    node.connect(gain); gain.connect(creditsBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function creditsKick(t) {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    gain.gain.setValueAtTime(0.32, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain); gain.connect(creditsBus); osc.start(t); osc.stop(t + 0.25);
  }
  function creditsHat(t, gainV) {
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
    const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(gainV, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f); f.connect(gain); gain.connect(creditsBus);
    src.start(t); src.stop(t + 0.08);
  }
  function scheduleCreditsStep(idx, t, stepDur) {
    const barIdx = Math.floor(idx / 16), s = idx % 16, bar = barIdx % 8;
    const ci = CR_PROG[bar], ch = CR_CHORDS[ci];
    if (s === 0) {
      ch.forEach((f) => creditsTone(f, t, stepDur * 15, 'sawtooth', 0.03, 900, stepDur * 4));   // the pad swells in over each bar
      creditsTone(CR_ROOTS[ci], t, stepDur * 7, 'triangle', 0.2, 500, 0.03);
    }
    if (s === 8) creditsTone(CR_ROOTS[ci], t, stepDur * 6, 'triangle', 0.16, 500, 0.03);
    if (s % 2 === 0) creditsTone(ch[[0, 1, 2, 1, 2, 1, 0, 1][(s / 2) % 8]] * 2, t, stepDur * 2.5, 'triangle', 0.05, 2600, 0.01);
    if (barIdx >= 2) {
      CR_MELODY[bar].forEach(([ms, hz, len]) => { if (ms === s) creditsTone(hz, t, stepDur * len, 'triangle', 0.1, 3200, 0.05); });
    }
    if (barIdx >= 4 && (s === 0 || s === 8)) creditsKick(t);
    if (barIdx >= 8 && s % 2 === 0) creditsHat(t, s % 4 === 0 ? 0.05 : 0.03);
  }
  function scheduleCredits() {
    if (!creditsBus) { creditsBus = audioCtx.createGain(); creditsBus.gain.value = 0; creditsBus.connect(musicMasterGain); }
    if (!creditsBusOn) {
      creditsBus.gain.cancelScheduledValues(audioCtx.currentTime);
      creditsBus.gain.setTargetAtTime(1, audioCtx.currentTime, 0.4);
      creditsBusOn = true;
      creditsStep = 0;
      nextNoteTime = audioCtx.currentTime + 0.1;
    }
    const stepDur = 60 / CREDITS_BPM / 4;
    while (nextNoteTime < audioCtx.currentTime + 0.14) {
      scheduleCreditsStep(creditsStep++, nextNoteTime, stepDur);
      nextNoteTime += stepDur;
    }
  }
  function scheduleMusic() {
    if (!audioCtx) return;
    const chasing = gameState === 'chase' || gameState === 'dying' || gameState === 'escape';
    const rolling = gameState === 'credits' && performance.now() - creditsStartedAt < CREDITS_SCROLL_MS;
    if (creditsBusOn && !(musicEnabled && rolling)) {              // credits over or skipped: fade the theme out
      creditsBus.gain.cancelScheduledValues(audioCtx.currentTime);
      creditsBus.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
      creditsBusOn = false;
    }
    if (musicEnabled && rolling) { scheduleCredits(); return; }
    if (!musicEnabled || !chasing) { nextNoteTime = audioCtx.currentTime + 0.08; return; }
    const intense = boss.hp <= BOSS_MAX_HEALTH / 2;
    const stepDur = 60 / (intense ? 172 : 152) / 4;
    if (nextNoteTime < audioCtx.currentTime) nextNoteTime = audioCtx.currentTime + 0.05;
    while (nextNoteTime < audioCtx.currentTime + 0.14) {
      scheduleStep(musicStep++, nextNoteTime, intense);
      nextNoteTime += stepDur;
    }
  }
  const FOOT_BASS = [55, 55, 82.4, 55, 73.4, 55, 98, 82.4];
  let footStep = 0;
  function playFootBass() {
    if (!audioCtx || !musicEnabled || gameState !== 'foot') return;
    playTone(FOOT_BASS[footStep++ % FOOT_BASS.length] * 0.5, 0.16, 'sawtooth', 0.04, 0, musicMasterGain);
  }

  function updateEngineSound(speedFrac) {
    if (!audioCtx || !engineOsc) return;
    const t = audioCtx.currentTime;
    const active = gameState === 'chase' || gameState === 'dying';
    engineOsc.frequency.setTargetAtTime(48 + Math.abs(speedFrac) * 110, t, 0.08);
    engineGain.gain.setTargetAtTime(active ? 0.05 + Math.abs(speedFrac) * 0.07 : 0, t, 0.1);
  }

  const musicToggleEl = document.getElementById('music-toggle');
  const soundHintEl = document.getElementById('sound-hint');
  function updateSoundHint() { if (soundHintEl) soundHintEl.style.display = musicEnabled ? '' : 'none'; }
  function setMusicEnabled(on) {
    musicEnabled = on;
    ensureAudio();
    if (audioCtx && musicMasterGain) musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
    if (musicToggleEl) {
      musicToggleEl.textContent = on ? '♪ Music: On' : '♪ Music: Off';
      musicToggleEl.classList.toggle('muted', !on);
    }
    updateSoundHint();
  }
  if (musicToggleEl) {
    musicToggleEl.addEventListener('click', () => { musicTouched = true; setMusicEnabled(!musicEnabled); });
  }
  updateSoundHint();

  // ---- input ----
  // Solo: W A S D or the arrows drive, Space fires. Two players: P1 drives
  // with W A S D and fires with Space, P2 drives with the arrows and fires
  // with Enter (or /).
  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', '/']);
  const keys = {};
  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (TRACKED_KEYS.has(e.key)) { keys[e.key] = true; e.preventDefault(); }
    if (e.key === 'Enter') {
      if (gameState === 'wiped') { if (escape) retryEscape(performance.now()); else resetLevel(); }
      else if (gameState === 'military' && performance.now() - militaryStartedAt > 1500) militaryStartedAt = performance.now() - MILITARY_MS;
      else if (gameState === 'nuke' && performance.now() - nukeStartedAt > 1500) nukeStartedAt = performance.now() - NUKE_MS;
      else if (gameState === 'credits' && performance.now() - creditsStartedAt > 1500 && performance.now() - creditsStartedAt < CREDITS_SCROLL_MS) creditsStartedAt = performance.now() - CREDITS_SCROLL_MS;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) { keys[e.key] = false; e.preventDefault(); }
  });
  function inputFor(i) {
    if (PLAYER_MODE === 1) {
      return {
        up: keys.w || keys.ArrowUp, down: keys.s || keys.ArrowDown,
        left: keys.a || keys.ArrowLeft, right: keys.d || keys.ArrowRight, fire: keys[' '],
      };
    }
    if (i === 0) return { up: keys.w, down: keys.s, left: keys.a, right: keys.d, fire: keys[' '] };
    return { up: keys.ArrowUp, down: keys.ArrowDown, left: keys.ArrowLeft, right: keys.ArrowRight, fire: keys.Enter || keys['/'] };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- map: a generated opening stretch (the facility, its lot, the start
  // of the road and forest), then the straight road simply never ends --
  // every tile past the generated part is computed on the spot from a
  // hash, so there's no finish line to drive off the edge of.
  let tiles = LEVEL.grid.map((r) => r.split(''));
  const knocked = new Set();
  function hash2(x, y, k) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(k, 2246822519);
    return ((h ^ (h >>> 13)) >>> 0);
  }
  function procTile(tx, ty) {
    const R = LEVEL.road;
    if (ty <= 0 || ty >= ROWS - 1) return '#';
    if (ty >= R.y0 && ty <= R.y1) return (hash2(tx, ty, 7) % 10000 < 45 && !knocked.has(tx + ',' + ty)) ? 'K' : 'R';
    if (ty === R.y0 - 1 || ty === R.y1 + 1) return '.';
    return hash2(tx, ty, 9) % 1000 < 740 ? 'T' : '.';
  }
  function tileChar(tx, ty) {
    if (ty < 0 || ty >= ROWS || tx < 0) return '#';
    if (escape && tx >= escape.t0) return escapeTile(tx, ty);
    if (tx < COLS) return tiles[ty][tx];
    return procTile(tx, ty);
  }
  function setTile(tx, ty, ch) {
    if (tx < COLS) tiles[ty][tx] = ch;
    else if (ch === 'R') knocked.add(tx + ',' + ty);
  }
  function tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${c(((n >> 16) & 255) + 255 * amt)},${c(((n >> 8) & 255) + 255 * amt)},${c((n & 255) + 255 * amt)})`;
  }
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const f = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t));
    return `rgb(${f(16)},${f(8)},${f(0)})`;
  }

  // <<SWARM-BEGIN>>
  // The Multipod: every monster in the game, bosses included, packed into
  // one swarm, each drawn with that monster's own model. Bosses are drawn
  // much bigger.
  function swarmRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // id order matches the Monsterpedia. Second value = size relative to the
  // swarm's spread: small pack creatures, normal, big armored ones, bosses.
  const SWARM_DEFS = [
    ['Crawler', 0.16], ['Drifter', 0.17], ['Caterpillar', 0.16], ['Mimic', 0.16], ['Crate Lurker', 0.15],
    ['Ashen One', 0.34], ['Knight', 0.17], ['Mine Dweller', 0.18], ['Vault Guardian', 0.24], ['Chain Wraith', 0.15],
    ['Dig Worm', 0.2], ['Last Knight', 0.34], ['Frost Tentacle', 0.17], ['Mutation', 0.17], ['Brood', 0.09],
    ['Thaw Spider', 0.16], ['Frozen Mutation', 0.34], ['Flood Eel', 0.17], ['Bog', 0.19], ['Current Eel', 0.17],
    ['Drain Swarm', 0.08], ['Cistern', 0.34], ['Grass Drifter', 0.17], ['Kindling', 0.16], ['Stalker', 0.16],
    ['Sentry', 0.17], ['Cultivator', 0.34], ['Reacher', 0.17], ['Gargoyle', 0.17], ['Warden', 0.17],
    ['Grotesque', 0.09], ['Garguantuagoyle', 0.36],
  ];
  // One of every monster, plus a few extra of the ones that come in packs
  // (the Brood, the Drain Swarm, the Grotesques).
  const SWARM_EXTRAS = [14, 14, 14, 14, 20, 20, 20, 20, 20, 20, 30, 30, 30, 30, 30, 30];
  function makeSwarmMembers(spread, seed) {
    const r = swarmRng(seed);
    const ids = SWARM_DEFS.map((_, i) => i).concat(SWARM_EXTRAS);
    const arr = ids.map((id) => ({
      id, ang: r() * Math.PI * 2, rad: Math.sqrt(r()) * spread,
      size: spread * SWARM_DEFS[id][1] * (0.92 + r() * 0.16),
      phase: r() * 10, spin: r() - 0.5,
    }));
    arr.sort((a, b) => b.size - a.size);
    return arr;
  }
  function swCirc(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  // Each member IS the actual model of the monster it's based on: the same
  // portrait drawing the Monsterpedia uses (window.MonsterModels, from
  // js/monsterpedia.js), scaled so its overall reach is about 1.5x the
  // member's body size. The model is rendered once into a cached sprite
  // (refreshed ~10x a second, so it still animates) rather than redrawn in
  // full for every one of the swarm's members every frame.
  function drawSwarmMember(g, id, s, now, ph, flash) {
    const M = window.MonsterModels;
    if (!M) return;
    const k = (s * 1.5) / M.extent(id);
    g.save();
    g.scale(k, k);
    g.drawImage(M.sprite(id, now), -80, -80);
    g.restore();
    if (flash) swCirc(g, 0, 0, s * 1.1, `rgba(255,255,255,${0.6 * flash})`);
  }
  function drawSwarm(g, cx, cy, heading, now, members, spread, flash, scatter) {
    const cs = Math.cos(heading), sn = Math.sin(heading);
    members.forEach((m) => {
      const a = m.ang + now * 0.0014 * m.spin;
      let u = Math.cos(a) * m.rad * 1.25 + Math.sin(now * 0.004 + m.phase) * spread * 0.03;
      let w = Math.sin(a) * m.rad * 0.8 + Math.cos(now * 0.0035 + m.phase) * spread * 0.03;
      if (scatter) { const k = 1 + scatter * 3.2; u *= k; w *= k; }
      g.save();
      g.translate(cx + u * cs - w * sn, cy + u * sn + w * cs);
      g.rotate(heading + Math.sin(now * 0.003 + m.phase) * 0.25 + (scatter ? scatter * m.spin * 6 : 0));
      drawSwarmMember(g, m.id, m.size, now, m.phase, flash);
      g.restore();
    });
  }
  // <<SWARM-END>>

  // ---- game state ----
  const BEST_TIME_KEY = 'goofy-horror-best-level31';
  let bestMs = (() => {
    const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(v) ? v : null;
  })();
  function formatTime(ms) {
    const total = Math.max(0, ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }
  function fmtHp(v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); }
  let runStartTime = performance.now();
  let elapsedMs = 0;
  // 'foot' | 'intro' | 'chase' | 'dying' | 'escape' | 'military' | 'nuke' | 'credits' | 'victory' | 'wiped'
  let gameState = 'foot';
  let chaseStartedAt = 0;
  let dyingStartedAt = 0;
  let nukeStartedAt = 0;
  let creditsStartedAt = 0;
  let stingPlayed = false;
  let shake = 0;
  let chaseZoom = CHASE_ZOOM_MAX;
  let escape = null;            // set once the Multipod splits: { startedAt, endX, start }
  let chasers = [];
  let militaryStartedAt = 0;
  let milKillIdx = 0;

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return { x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, isMoving: false, walkPhase: 0, shotgunAmmo: 0, down: false };
  }
  const players = PLAYER_MODE === 1
    ? [makePlayer(LEVEL.spawn1, '#ff8a3d')]
    : [makePlayer(LEVEL.spawn1, '#ff8a3d'), makePlayer(LEVEL.spawn2, '#3ddc84')];

  // One car per player, parked side by side facing down the road.
  const carStarts = LEVEL.cars.slice(0, players.length).map((c) => ({ ...tileCenter(c.x, c.y), heading: c.heading }));
  const cars = carStarts.map(() => ({ x: 0, y: 0, heading: 0, v: 0, nextFireAt: 0, braking: false, alive: true, slowUntil: 0 }));
  const doorPos = { x: LEVEL.door.x * TILE + TILE / 2, y: (LEVEL.door.y + 0.5) * TILE };

  const members = makeSwarmMembers(BOSS_SPREAD, 3131);
  const boss = { hp: BOSS_MAX_HEALTH, x: 0, y: 0, heading: 0, emerge: 0, flashUntil: 0, speedMult: 3, nextThrowAt: 0, knockLeft: 0 };

  let missiles = [];
  let thrown = [];
  let particles = [];
  let explosions = [];
  let floatingTexts = [];
  let cam = { x: 0, y: 0 };

  function aliveCars() { return cars.filter((c) => c.alive); }
  function rearCar() {
    let best = null;
    cars.forEach((c) => { if (c.alive && (!best || c.x < best.x)) best = c; });
    return best;
  }
  function leadCar() {
    let best = null;
    cars.forEach((c) => { if (c.alive && (!best || c.x > best.x)) best = c; });
    return best || cars[0];
  }

  function spawnFloatingText(x, y, text) { floatingTexts.push({ x, y, text, life: 0, maxLife: 1.3 }); }
  function spawnParticles(x, y, n, color, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.3 + Math.random() * 0.7);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, maxLife: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color });
    }
  }
  function spawnExplosion(x, y) { explosions.push({ x, y, t0: performance.now() }); }

  function resetLevel() {
    tiles = LEVEL.grid.map((r) => r.split(''));
    knocked.clear();
    players.forEach((p, i) => {
      const sp = tileCenter(i === 0 ? LEVEL.spawn1.x : LEVEL.spawn2.x, i === 0 ? LEVEL.spawn1.y : LEVEL.spawn2.y);
      p.x = sp.x; p.y = sp.y; p.facing = { x: 0, y: 1 }; p.walkPhase = 0; p.isMoving = false; p.down = false;
    });
    cars.forEach((c, i) => {
      c.x = carStarts[i].x; c.y = carStarts[i].y; c.heading = carStarts[i].heading;
      c.v = 0; c.nextFireAt = 0; c.braking = false; c.alive = true; c.slowUntil = 0;
    });
    boss.hp = BOSS_MAX_HEALTH; boss.emerge = 0; boss.flashUntil = 0; boss.speedMult = 3; boss.knockLeft = 0;
    boss.x = doorPos.x; boss.y = doorPos.y; boss.heading = 0;
    missiles = []; thrown = []; particles = []; explosions = []; floatingTexts = [];
    gameState = 'foot';
    escape = null; chasers = [];
    shake = 0;
    runStartTime = performance.now();
    elapsedMs = 0;
    cam = { x: cars[0].x, y: cars[0].y };
    chaseZoom = CHASE_ZOOM_MAX;
    musicStep = 0;
  }
  resetLevel();
  if (endingOnly) { setMusicEnabled(true); startNuke(performance.now()); }

  // ---- on foot ----
  function solidForFoot(ch) { return ch === 'B' || ch === 'T' || ch === '#' || ch === 'X'; }
  function canStandAt(x, y) {
    const r = PLAYER_RADIUS;
    if (escape && blockedByRoadblock(x, y)) return false;
    return [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]].every(([cx, cy]) => !solidForFoot(tileChar(Math.floor(cx / TILE), Math.floor(cy / TILE))));
  }
  function movePlayers(dt, speed) {
    const inputs = PLAYER_MODE === 1
      ? [{ ix: (keys.d || keys.ArrowRight ? 1 : 0) - (keys.a || keys.ArrowLeft ? 1 : 0), iy: (keys.s || keys.ArrowDown ? 1 : 0) - (keys.w || keys.ArrowUp ? 1 : 0) }]
      : [{ ix: (keys.d ? 1 : 0) - (keys.a ? 1 : 0), iy: (keys.s ? 1 : 0) - (keys.w ? 1 : 0) },
         { ix: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), iy: (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0) }];
    players.forEach((p, i) => {
      const { ix, iy } = inputs[i];
      if (p.down) { p.isMoving = false; return; }
      p.isMoving = ix !== 0 || iy !== 0;
      if (!p.isMoving) return;
      const len = Math.hypot(ix, iy);
      const nx = ix / len, ny = iy / len;
      p.facing = { x: nx, y: ny };
      const dx = nx * speed * dt, dy = ny * speed * dt;
      if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;
      if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;
      window.Footsteps.advance(p, dt * WALK_CYCLE_SPEED * (speed / PLAYER_SPEED), audioCtx, FOOT_SURFACE, 1);
    });
  }
  function updateFoot(now, dt) {
    movePlayers(dt, PLAYER_SPEED);
    if (players.every((p, i) => Math.hypot(p.x - cars[i].x, p.y - cars[i].y) < BOARD_RADIUS)) startChase(now);
  }
  function playerAtOwnCar(i) { return Math.hypot(players[i].x - cars[i].x, players[i].y - cars[i].y) < BOARD_RADIUS; }

  // boarding the cars first plays the Multipod's opening film (js/bosscutscene.js),
  // then the chase begins; Enter / Space / Esc skips it
  let introStartedAt = 0;
  function startChase(now) {
    if (window.BossCutscene) { gameState = 'intro'; introStartedAt = now; updateEngineSound(0); return; }
    beginChase(now);
  }
  function beginChase(now) {
    if (gameState === 'intro') runStartTime += now - introStartedAt;   // the film isn't part of the run
    gameState = 'chase';
    chaseStartedAt = now;
    playBoard();
    setTimeout(playDoorBurst, 350);
    shake = 14;
    cam = { x: cars[0].x, y: cars[0].y };
    spawnFloatingText(cars[0].x, cars[0].y - 40, 'GO GO GO');
    musicStep = 0;
    boss.nextThrowAt = now + BOSS_EMERGE_MS + 1500;
    if (!musicTouched) setMusicEnabled(true);
  }

  // ---- driving ----
  function carSamples(x, y, h) {
    const c = Math.cos(h), s = Math.sin(h);
    const pts = [[20, 0], [-20, 0], [0, 11], [0, -11], [18, 10], [18, -10], [-18, 10], [-18, -10]];
    return pts.map(([u, w]) => [x + u * c - w * s, y + u * s + w * c]);
  }
  function carHit(x, y, h) {
    const res = { hard: false, cones: [] };
    carSamples(x, y, h).forEach(([sx, sy]) => {
      const tx = Math.floor(sx / TILE), ty = Math.floor(sy / TILE);
      const ch = tileChar(tx, ty);
      if (ch === 'K') res.cones.push([tx, ty]);
      else if (ch === 'B' || ch === 'T' || ch === '#') res.hard = true;
    });
    return res;
  }

  function updateCar(car, input, dt) {
    const up = input && input.up, down = input && input.down, left = input && input.left, right = input && input.right;
    const throttle = (up ? 1 : 0) - (down ? 1 : 0);
    const ch = tileChar(Math.floor(car.x / TILE), Math.floor(car.y / TILE));
    const onGrass = ch === '.';
    const coneSlowed = performance.now() < car.slowUntil;
    const cap = CAR_MAX * (onGrass || coneSlowed ? 0.5 : 1);
    car.braking = throttle < 0 && car.v > 0;
    if (throttle > 0) car.v += (car.v < 0 ? CAR_BRAKE : CAR_ACCEL) * dt;
    else if (throttle < 0) car.v -= (car.v > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
    else car.v -= Math.sign(car.v) * Math.min(Math.abs(car.v), 180 * dt);
    if (car.v > cap) car.v = Math.max(cap, car.v - 900 * dt);
    car.v = Math.max(car.v, -CAR_REV_MAX);

    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    const newH = car.heading + steer * CAR_TURN * clamp(car.v / 170, -1, 1) * dt;
    if (!carHit(car.x, car.y, newH).hard) car.heading = newH;

    const nx = car.x + Math.cos(car.heading) * car.v * dt;
    const ny = car.y + Math.sin(car.heading) * car.v * dt;
    const hit = carHit(nx, ny, car.heading);
    if (hit.cones.length) {
      hit.cones.forEach(([tx, ty]) => {
        setTile(tx, ty, 'R');
        const c = tileCenter(tx, ty);
        spawnParticles(c.x, c.y, 10, '#ff8a2a', 260, 0.7, 3);
        spawnFloatingText(c.x, c.y - 10, 'BONK');
      });
      car.v *= 0.78;
      car.slowUntil = performance.now() + CONE_SLOW_MS;
      spawnFloatingText(car.x, car.y - 28, 'SLOWED');
      playBonk();
    }
    if (hit.hard) {
      if (Math.abs(car.v) > 120) { shake = Math.max(shake, 8); playBonk(); spawnParticles(car.x, car.y, 8, '#ddd', 200, 0.5, 3); }
      car.v = -car.v * 0.25;
    } else {
      car.x = nx; car.y = ny;
    }
    if (Math.abs(car.v) > 90 && Math.random() < dt * 40) {
      const bx = car.x - Math.cos(car.heading) * 24, by = car.y - Math.sin(car.heading) * 24;
      if (onGrass) spawnParticles(bx, by, 1, '#9b7a4a', 90, 0.6, 5);
      else spawnParticles(bx, by, 1, 'rgba(210,210,215,0.7)', 40, 0.45, 4);
    }
  }

  // ---- the Multipod's own projectiles: a random pick from everything
  // the game's monsters ever threw at you ----
  const THROWN_TYPES = ['gear', 'rocket', 'icicle', 'feather', 'antimatter', 'coral', 'spore', 'chainball', 'slug', 'rock'];
  function throwAtCar(now) {
    const targets = aliveCars();
    if (!targets.length) return;
    const car = targets[Math.floor(Math.random() * targets.length)];
    const a0 = Math.random() * Math.PI * 2, r0 = Math.random() * BOSS_SPREAD * 0.6;
    const ox = boss.x + Math.cos(a0) * r0, oy = boss.y + Math.sin(a0) * r0;
    // aim where the car will be, not where it is: solve |rel + v*t| = speed*t
    const vx = Math.cos(car.heading) * car.v, vy = Math.sin(car.heading) * car.v;
    const rx = car.x - ox, ry = car.y - oy;
    const qa = vx * vx + vy * vy - THROW_SPEED * THROW_SPEED, qb = 2 * (rx * vx + ry * vy), qc = rx * rx + ry * ry;
    let t = Math.hypot(rx, ry) / THROW_SPEED;
    const roots = [];
    if (Math.abs(qa) > 1e-6) {
      const disc = qb * qb - 4 * qa * qc;
      if (disc >= 0) { const sq = Math.sqrt(disc); roots.push((-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)); }
    }
    const good = roots.filter((x) => x > 0);
    if (good.length) t = Math.min(...good);
    const ang = Math.atan2(car.y + vy * t - oy, car.x + vx * t - ox);
    thrown.push({
      x: ox, y: oy, vx: Math.cos(ang) * THROW_SPEED, vy: Math.sin(ang) * THROW_SPEED,
      type: THROWN_TYPES[Math.floor(Math.random() * THROWN_TYPES.length)], born: now, spin: Math.random() * 6,
    });
    boss.flashUntil = now + 120;
    playThrow();
  }
  function updateThrown(now, dt) {
    for (let i = thrown.length - 1; i >= 0; i--) {
      const p = thrown[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (now - p.born > 5000) { thrown.splice(i, 1); continue; }
      if (Math.random() < dt * 30) spawnParticles(p.x, p.y, 1, 'rgba(255,255,255,0.5)', 20, 0.25, 2);
      for (const c of cars) {
        if (c.alive && Math.hypot(p.x - c.x, p.y - c.y) < THROW_HIT_RADIUS) {
          spawnFloatingText(c.x, c.y - 30, 'DIRECT HIT');
          crash(c);
          thrown.splice(i, 1);
          break;
        }
      }
    }
  }
  function drawThrownWorld(g, now) {
    thrown.forEach((p) => {
      const a = Math.atan2(p.vy, p.vx), sp = p.spin + (now - p.born) * 0.012;
      g.save();
      g.translate(p.x, p.y);
      g.scale(1.9, 1.9);
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-Math.cos(a) * 22, -Math.sin(a) * 22); g.lineTo(0, 0); g.stroke();
      switch (p.type) {
        case 'gear': { // the Cultivator's
          g.rotate(sp); g.beginPath();
          for (let j = 0; j < 8; j++) { const a0 = (j / 8) * Math.PI * 2, a1 = a0 + Math.PI / 8; g.moveTo(Math.cos(a0) * 8, Math.sin(a0) * 8); g.lineTo(Math.cos(a0) * 11.5, Math.sin(a0) * 11.5); g.lineTo(Math.cos(a1) * 11.5, Math.sin(a1) * 11.5); g.lineTo(Math.cos(a1) * 8, Math.sin(a1) * 8); }
          g.closePath(); g.fillStyle = '#9a9a8c'; g.fill(); g.strokeStyle = '#4a4a40'; g.lineWidth = 1.5; g.stroke(); break;
        }
        case 'rocket': // the Reacher's and Cultivator's
          g.rotate(a); g.fillStyle = 'rgba(255,140,40,0.6)'; g.beginPath(); g.moveTo(-7, -2); g.lineTo(-14, 0); g.lineTo(-7, 2); g.closePath(); g.fill();
          g.fillStyle = '#6a6a5e'; g.fillRect(-5, -3, 11, 6); swCirc(g, 7, 0, 3, '#ffcf5c'); break;
        case 'icicle': // the Frozen Mutation's
          g.rotate(a); g.fillStyle = '#d8f2ff'; g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -4); g.lineTo(-8, 4); g.closePath(); g.fill();
          g.strokeStyle = '#6ab8e8'; g.lineWidth = 1; g.stroke(); break;
        case 'feather': // the Garguantuagoyle's
          g.rotate(a); g.fillStyle = '#e8e8f0'; g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-2, -6, 14, 0); g.quadraticCurveTo(-2, 6, -12, 0); g.fill();
          g.strokeStyle = '#55555e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke(); break;
        case 'antimatter': { // the Garguantuagoyle's, too
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 10);
          gr.addColorStop(0, '#f0d6ff'); gr.addColorStop(0.5, '#8a2aff'); gr.addColorStop(1, 'rgba(30,0,60,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill(); break;
        }
        case 'coral': // the Cistern's coral ball
          swCirc(g, 0, 0, 8, '#ff5a7a'); swCirc(g, -3, -3, 4, '#ffd23d'); swCirc(g, 4, 2, 3.5, '#ff8a5c'); swCirc(g, -1, 5, 3, '#ff3b8a'); break;
        case 'spore': // the Cultivator's spore
          swCirc(g, 0, 0, 7, 'rgba(180,230,120,0.9)'); swCirc(g, 0, 0, 3.5, '#f0ffd0'); break;
        case 'chainball': // the Chain Wraith's
          g.strokeStyle = '#9a9a9a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-Math.cos(a) * 16, -Math.sin(a) * 16); g.lineTo(0, 0); g.stroke();
          swCirc(g, 0, 0, 7, '#2a2a2e'); swCirc(g, -2, -2, 2.5, '#6a6a70'); break;
        case 'slug': // the Kindling's and Sentry's shotgun
          g.rotate(a); g.fillStyle = '#fff2b0'; g.beginPath(); g.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,170,40,0.7)'; g.beginPath(); g.ellipse(-4, 0, 7, 2, 0, 0, Math.PI * 2); g.fill(); break;
        default: // the Last Knight's flung floor
          g.rotate(sp); g.fillStyle = '#6a625a'; g.beginPath(); g.moveTo(-8, -3); g.lineTo(-3, -9); g.lineTo(8, -5); g.lineTo(9, 4); g.lineTo(0, 9); g.lineTo(-7, 5); g.closePath(); g.fill();
          g.strokeStyle = '#2a2622'; g.lineWidth = 1.5; g.stroke();
      }
      g.restore();
    });
  }

  // ---- missiles & the Multipod ----
  function fireMissile(car, now) {
    car.nextFireAt = now + MISSILE_COOLDOWN_MS;
    missiles.push({ x: car.x + Math.cos(car.heading) * 24, y: car.y + Math.sin(car.heading) * 24, angle: car.heading, born: now });
    playMissileLaunch();
  }
  function bossAlive() { return boss.hp > 0 && gameState !== 'dying' && gameState !== 'nuke' && gameState !== 'victory'; }

  function updateMissiles(now, dt) {
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i];
      if (now - m.born > MISSILE_LIFE_MS) { missiles.splice(i, 1); continue; }
      if (bossAlive()) {
        const want = Math.atan2(boss.y - m.y, boss.x - m.x);
        let diff = want - m.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        m.angle += clamp(diff, -MISSILE_TURN * dt, MISSILE_TURN * dt);
      }
      m.x += Math.cos(m.angle) * MISSILE_SPEED * dt;
      m.y += Math.sin(m.angle) * MISSILE_SPEED * dt;
      spawnParticles(m.x - Math.cos(m.angle) * 10, m.y - Math.sin(m.angle) * 10, 1, 'rgba(255,170,60,0.9)', 30, 0.3, 3);
      if (bossAlive() && boss.emerge >= 1 && Math.hypot(m.x - boss.x, m.y - boss.y) < BOSS_HIT_RADIUS) {
        missiles.splice(i, 1);
        hitBoss(now);
      }
    }
  }
  function hitBoss(now) {
    boss.hp = Math.max(0, boss.hp - MISSILE_DAMAGE);
    boss.flashUntil = now + 150;
    boss.knockLeft += HIT_KNOCKBACK; // straight road: back down it, eased in over a few frames in updateBoss (the camera is pinned to the boss, so a one-frame jump would snap the whole screen)
    const ox = (Math.random() - 0.5) * BOSS_SPREAD, oy = (Math.random() - 0.5) * BOSS_SPREAD;
    spawnExplosion(boss.x + ox, boss.y + oy);
    spawnParticles(boss.x + ox, boss.y + oy, 14, '#ff8a2a', 300, 0.7, 4);
    spawnFloatingText(boss.x + ox, boss.y + oy - 20, `-${fmtHp(MISSILE_DAMAGE)}`);
    shake = Math.max(shake, 3);
    playHit();
    if (boss.hp <= 0) startDying(now);
  }

  // The road is a straight line, so the swarm doesn't need a trail to
  // follow -- it just runs at the rearmost car that's still alive at 3x
  // walking speed, and only gains on you when you slow down.
  function updateBoss(now, dt) {
    const since = now - chaseStartedAt;
    if (since < BOSS_EMERGE_MS) {
      boss.emerge = clamp(since / BOSS_EMERGE_MS, 0, 1);
      boss.x = doorPos.x; boss.y = doorPos.y; boss.heading = 0;
      return;
    }
    boss.emerge = 1;
    const target = rearCar();
    if (!target) return;
    if (now >= boss.nextThrowAt) { boss.nextThrowAt = now + THROW_INTERVAL_MS; throwAtCar(now); }
    const ramp = clamp((since - BOSS_EMERGE_MS) / BOSS_RAMP_MS, 0, 1);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy) || 1;
    // Falling behind makes it sprint: from 3x walking speed up to 5x once
    // the gap has grown past CATCHUP_FULL, so a few good hits (each knocks
    // it back) buy you a breather, not an escape.
    const sprint = clamp((d - CATCHUP_START) / (CATCHUP_FULL - CATCHUP_START), 0, 1);
    boss.speedMult = lerp(3, 5, sprint);
    const eased = boss.knockLeft * Math.min(1, dt * 9);
    boss.knockLeft -= eased;
    boss.x -= eased;
    const step = PLAYER_SPEED * boss.speedMult * ramp * dt;
    boss.x += (dx / d) * Math.min(step, d);
    boss.y += (dy / d) * Math.min(step, d);
    boss.heading = Math.atan2(dy, dx);
    cars.forEach((c) => { if (c.alive && Math.hypot(boss.x - c.x, boss.y - c.y) < CATCH_DIST) crash(c); });
  }
  function gapNow() {
    const t = rearCar();
    return t ? Math.max(0, Math.hypot(t.x - boss.x, t.y - boss.y)) : 0;
  }

  function wreck(car) {
    if (!car.alive) return;
    car.alive = false;
    car.v = 0;
    shake = 18;
    playCrash();
    spawnExplosion(car.x, car.y);
    spawnParticles(car.x, car.y, 40, '#ff8a2a', 400, 1.2, 5);
    spawnParticles(car.x, car.y, 30, '#333', 300, 1.5, 6);
  }
  function crash(car) {
    if (!car.alive) return;
    wreck(car);
    if (!aliveCars().length) { gameState = 'wiped'; updateEngineSound(0); }
  }

  function startDying(now) {
    gameState = 'dying';
    dyingStartedAt = now;
    missiles = []; thrown = [];
    shake = 14;
  }
  function updateDying(now, dt) {
    const t = clamp((now - dyingStartedAt) / DYING_MS, 0, 1);
    cars.forEach((c) => { if (c.alive) { c.v *= Math.max(0, 1 - dt * 1.6); updateCar(c, null, dt); } });
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * BOSS_SPREAD * (1 + t * 2);
      spawnExplosion(boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r);
      playHit();
    }
    if (t >= 1) startEscape(now);
  }

  // ---- the escape: the car is wrecked, the swarm comes apart into its
  // monsters, and the road ends at a military roadblock ----
  // the winding road: rows 0..7 of it start at escapeRoadTop(tx)
  function escapeRoadTop(tx) {
    const off = tx - escape.t0;
    let shift = 0;
    for (let i = 1; i < ESCAPE_BENDS.length; i++) {
      const [o0, r0] = ESCAPE_BENDS[i - 1], [o1, r1] = ESCAPE_BENDS[i];
      if (off <= o1) { const f = clamp((off - o0) / (o1 - o0), 0, 1); shift = lerp(r0, r1, f * f * (3 - 2 * f)); break; }
      shift = r1;
    }
    return LEVEL.road.y0 + Math.round(shift);
  }
  function escapeTile(tx, ty) {
    if (ty <= 0 || ty >= ROWS - 1) return '#';
    const rt = escapeRoadTop(tx);
    if (ty >= rt && ty < rt + 8) return escape.blockSet.has(tx + ',' + ty) ? 'X' : 'R';
    if (ty === rt - 1 || ty === rt + 8) return '.';
    return hash2(tx, ty, 9) % 1000 < 740 ? 'T' : '.';
  }
  // 2x1-tile concrete roadblocks every few tiles, one or two across the road, never
  // enough to close it
  function layRoadblocks() {
    escape.blocks = []; escape.blockSet = new Set();
    for (let off = ESCAPE_BLOCKS_FROM; off < ESCAPE_BLOCKS_TO; off += ESCAPE_BLOCK_EVERY) {
      const tx = escape.t0 + off;
      const lo = Math.max(escapeRoadTop(tx), escapeRoadTop(tx + 1)), hi = Math.min(escapeRoadTop(tx), escapeRoadTop(tx + 1)) + 7;
      const rows = [lo + (hash2(tx, 3, 21) % (hi - lo + 1))];
      if (hash2(tx, 5, 22) % 3 === 0) {
        const second = lo + (hash2(tx, 7, 23) % (hi - lo + 1));
        if (Math.abs(second - rows[0]) >= 3) rows.push(second);
      }
      rows.forEach((ty) => {
        escape.blocks.push({ tx, ty });
        escape.blockSet.add(tx + ',' + ty); escape.blockSet.add((tx + 1) + ',' + ty);
      });
    }
  }
  function blockedByRoadblock(x, y) {
    const E = escape.endX;
    if (x < E - PLAYER_RADIUS || x > E + 36 + PLAYER_RADIUS) return false;
    const R = LEVEL.road, mid = (R.y0 + R.y1 + 1) / 2 * TILE;
    return Math.abs(y - mid) > 2.5 * TILE - PLAYER_RADIUS;
  }
  function startEscape(now) {
    cars.forEach(wreck);
    players.forEach((p, i) => {
      const c = cars[i] || cars[0];
      const offs = i === 0 ? [[0, -26], [0, 26], [0, 0]] : [[0, 26], [0, -26], [0, 0]];
      p.x = c.x; p.y = c.y;
      for (const [ox, oy] of offs) { if (canStandAt(c.x + ox, c.y + oy)) { p.x = c.x + ox; p.y = c.y + oy; break; } }
      p.down = false; p.facing = { x: 1, y: 0 }; p.isMoving = false;
    });
    const scatter = 0.45;                       // where drawBossWorld left the pieces at the end of the dying
    const cs = Math.cos(boss.heading), sn = Math.sin(boss.heading), kk = 1 + scatter * 3.2;
    chasers = members.map((m) => {
      const a = m.ang + now * 0.0014 * m.spin;
      const u = (Math.cos(a) * m.rad * 1.25 + Math.sin(now * 0.004 + m.phase) * BOSS_SPREAD * 0.03) * kk;
      const w = (Math.sin(a) * m.rad * 0.8 + Math.cos(now * 0.0035 + m.phase) * BOSS_SPREAD * 0.03) * kk;
      return {
        id: m.id, size: m.size, phase: m.phase, spin: m.spin, kx: 0,
        x: Math.max(48, boss.x + u * cs - w * sn), y: clamp(boss.y + u * sn + w * cs, 48, WORLD_H - 48),
        heading: boss.heading, speed: HM.speed(ESCAPE_RUN),
      };
    });
    // the blast throws every piece back down the road until none starts within ESCAPE_HEAD of a runner
    let need = 0;
    chasers.forEach((c) => players.forEach((p) => {
      const dx = p.x - c.x, dy = p.y - c.y;
      if (Math.hypot(dx, dy) < ESCAPE_HEAD && Math.abs(dy) < ESCAPE_HEAD) need = Math.max(need, -dx + Math.sqrt(ESCAPE_HEAD * ESCAPE_HEAD - dy * dy));
    }));
    chasers.forEach((c) => { c.kx = need; });
    escape = {
      startedAt: now,
      t0: Math.floor(Math.min(...players.map((p) => p.x)) / TILE),
      blocks: [], blockSet: new Set(),
      endX: Math.max(...players.map((p) => p.x)) + ESCAPE_ROAD_TILES * TILE,
      start: { players: players.map((p) => ({ x: p.x, y: p.y })), chasers: chasers.map((c) => ({ x: c.x, y: c.y, kx: c.kx })) },
    };
    layRoadblocks();
    gameState = 'escape';
    missiles = []; thrown = [];
    shake = 20;
    for (let i = 0; i < 5; i++) spawnExplosion(boss.x + (Math.random() - 0.5) * BOSS_SPREAD * 2, boss.y + (Math.random() - 0.5) * BOSS_SPREAD * 2);
    spawnFloatingText(players[0].x, players[0].y - 44, 'RUN!');
    updateEngineSound(0);
  }
  function retryEscape(now) {
    players.forEach((p, i) => { const s0 = escape.start.players[i]; p.x = s0.x; p.y = s0.y; p.down = false; p.facing = { x: 1, y: 0 }; p.isMoving = false; });
    chasers.forEach((c, i) => { const s0 = escape.start.chasers[i]; c.x = s0.x; c.y = s0.y; c.kx = s0.kx; });
    escape.startedAt = now;
    particles = []; explosions = []; floatingTexts = [];
    gameState = 'escape';
    shake = 8;
  }
  function nearestChaser() {
    let best = null, bd = Infinity;
    chasers.forEach((c) => players.forEach((p) => {
      if (p.down) return;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }));
    return best ? { c: best, d: bd } : null;
  }
  function catchPlayer(p) {
    p.down = true; p.isMoving = false;
    spawnParticles(p.x, p.y, 40, '#b0141c', 260, 0.9, 4);
    spawnFloatingText(p.x, p.y - 30, 'CAUGHT');
    playHit();
    shake = Math.max(shake, 10);
    if (players.every((q) => q.down)) { gameState = 'wiped'; updateEngineSound(0); }
  }
  function updateEscape(now, dt) {
    const since = now - escape.startedAt;
    movePlayers(dt, ESCAPE_RUN);
    const ramp = clamp((since - SPLIT_STUN_MS) / ESCAPE_RAMP_MS, 0, 1);
    for (const c of chasers) {
      const e = c.kx * Math.min(1, dt * 5);
      c.kx -= e; c.x -= e;
      if (since < SPLIT_STUN_MS) { c.heading += c.spin * dt * 3; continue; }
      let tgt = null, td = Infinity;
      players.forEach((p) => { if (p.down) return; const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < td) { td = d; tgt = p; } });
      if (!tgt) break;
      const dx = tgt.x - c.x, dy = tgt.y - c.y, d = td || 1;
      const step = Math.min(c.speed * ramp * dt, d);
      c.x += dx / d * step; c.y = clamp(c.y + dy / d * step, 48, WORLD_H - 48);
      c.heading = Math.atan2(dy, dx);
      if (d < PLAYER_RADIUS + c.size * 0.55) catchPlayer(tgt);
      if (gameState !== 'escape') return;
    }
    const live = players.filter((p) => !p.down);
    if (live.length && live.every((p) => p.x >= escape.endX + 52)) startMilitary(now);
  }
  function startMilitary(now) {
    gameState = 'military';
    militaryStartedAt = now;
    milKillIdx = 0;
    particles = []; explosions = []; floatingTexts = [];
    updateEngineSound(0);
  }
  function updateMilitary(now, dt) {
    const t = now - militaryStartedAt;
    if (t > 500 && t < 9300 && Math.random() < dt * 16) playGun();
    while (milKillIdx < milMonsters.length && milMonsters[milKillIdx].dieT <= t) { playSplat(); milKillIdx++; }
    if (t >= MILITARY_MS) startNuke(now);
  }

  // After the Multipod falls, the facility is destroyed: a cutscene.
  function startNuke(now) {
    gameState = 'nuke';
    nukeStartedAt = now;
    if (!endingOnly && (bestMs === null || elapsedMs < bestMs)) { bestMs = elapsedMs; localStorage.setItem(BEST_TIME_KEY, String(bestMs)); }
    if (window.GoofyStory) window.GoofyStory.completeLevel(31);
    setTimeout(() => { if (gameState === 'nuke') playNukeBoom(); }, NUKE_IMPACT_MS);
    updateEngineSound(0);
  }
  function updateNuke(now) {
    if (now - nukeStartedAt >= NUKE_MS) {
      gameState = 'credits';
      creditsStartedAt = now;
      stingPlayed = false;
    }
  }
  // "dun dun dunnnnn"
  function playSting() {
    [[0, 0.45], [0.5, 0.45], [1.0, 3.2]].forEach(([d, dur], i) => {
      const f = i < 2 ? 110 : 82.4;
      playTone(f, dur, 'sawtooth', 0.4, d);
      playTone(f / 2, dur, 'square', 0.3, d);
      playTone(f * 2, dur, 'triangle', 0.18, d);
    });
  }
  function updateCredits(now) {
    if (!stingPlayed && now - creditsStartedAt >= CREDITS_SCROLL_MS + FORNOW_AT - 1000) { stingPlayed = true; playSting(); }
    if (now - creditsStartedAt >= CREDITS_MS) {
      gameState = 'victory';
      setTimeout(() => { window.location.href = 'index.html'; }, VICTORY_REDIRECT_MS);
    }
  }

  // ---- effects ----
  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = Math.min(1, dt * 3.5);
      p.vx *= 1 - drag; p.vy *= 1 - drag;
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].life += dt;
      if (floatingTexts[i].life >= floatingTexts[i].maxLife) floatingTexts.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 22);
    cars.forEach((c) => { if (!c.alive && Math.random() < dt * 8) spawnParticles(c.x, c.y, 1, 'rgba(40,40,40,0.7)', 40, 1.2, 6); });
  }

  // ---- rendering ----
  const GRASS = ['#6dab4a', '#72b04e', '#68a647', '#76b552'];
  const ROAD = ['#585b61', '#5c5f65', '#54575d'];
  const LOTC = ['#6c6f75', '#707379', '#686b71'];

  function drawTiles(g, camX, camY, vw, zoom) {
    const halfW = vw / 2 / zoom, halfH = VIEW_H / 2 / zoom;
    const x0 = Math.max(0, Math.floor((camX - halfW) / TILE) - 1), x1 = Math.ceil((camX + halfW) / TILE) + 1;
    const y0 = Math.max(0, Math.floor((camY - halfH) / TILE) - 1), y1 = Math.min(ROWS - 1, Math.ceil((camY + halfH) / TILE) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ch = tileChar(x, y);
        const px = x * TILE, py = y * TILE;
        const hh = hash2(x, y, 1);
        if (ch === 'R' || ch === 'K' || ch === 'X') g.fillStyle = ROAD[hh % 3];
        else if (ch === 'P') g.fillStyle = LOTC[hh % 3];
        else if (ch === 'B') g.fillStyle = '#9aa0a8';
        else g.fillStyle = GRASS[hh % 4];
        g.fillRect(px, py, TILE + 0.5, TILE + 0.5);
        if (ch === 'T') {
          const forestTree = x > 62;
          g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(px + 18, py + 24, 12, 6, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#5a3d22'; g.fillRect(px + 13, py + 14, 6, 14);
          g.fillStyle = forestTree ? ['#1f5a22', '#256428', '#1a4e1e'][hh % 3] : '#2f7a2a';
          g.beginPath(); g.arc(px + 16 + (hh % 5) - 2, py + 12, forestTree ? 19 : 14, 0, Math.PI * 2); g.fill();
          g.fillStyle = forestTree ? '#2f8a30' : '#3f9a36';
          g.beginPath(); g.arc(px + 12, py + 9, forestTree ? 10 : 8, 0, Math.PI * 2); g.fill();
        } else if (ch === '#') {
          g.fillStyle = '#2f5a2a'; g.fillRect(px, py, TILE, TILE);
          g.fillStyle = '#3f7a35'; g.beginPath(); g.arc(px + 10, py + 10, 9, 0, Math.PI * 2); g.arc(px + 22, py + 20, 9, 0, Math.PI * 2); g.fill();
        } else if (ch === 'K') {
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(px + 16, py + 26, 9, 4, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(px + 16, py + 4); g.lineTo(px + 25, py + 26); g.lineTo(px + 7, py + 26); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.fillRect(px + 11, py + 15, 10, 4);
        }
      }
    }
  }

  // the 2x1-tile concrete roadblocks: hazard-striped barriers
  function drawEscapeBlocks(g, camX, vw, zoom) {
    const lo = camX - vw / 2 / zoom - 3 * TILE, hi = camX + vw / 2 / zoom + 3 * TILE;
    escape.blocks.forEach((b) => {
      const x = b.tx * TILE;
      if (x < lo || x > hi) return;
      const y = b.ty * TILE, w = 2 * TILE;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 3, y + 6, w - 2, TILE - 4);
      g.save();
      g.beginPath(); g.rect(x + 1, y + 2, w - 2, TILE - 5); g.clip();
      g.fillStyle = '#b9bcc2'; g.fillRect(x, y, w, TILE);
      g.fillStyle = '#d8281e';
      for (let k = -2; k < 9; k++) { g.beginPath(); g.moveTo(x + k * 10, y + TILE); g.lineTo(x + k * 10 + 5, y + TILE); g.lineTo(x + k * 10 + 5 + TILE, y); g.lineTo(x + k * 10 + TILE, y); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x, y + 2, w, 5);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + TILE - 8, w, 8);
      g.restore();
      g.strokeStyle = '#4a4d53'; g.lineWidth = 2; g.strokeRect(x + 1, y + 2, w - 2, TILE - 5);
    });
  }

  // the dashes and edge lines of the road, following its bends
  function drawEscapeRoadMarkings(g, camX, vw, zoom) {
    const tx0 = Math.max(escape.t0, Math.floor((camX - vw / 2 / zoom) / TILE) - 2), tx1 = Math.ceil((camX + vw / 2 / zoom) / TILE) + 2;
    const trace = (dy) => {
      g.beginPath();
      for (let tx = tx0; tx <= tx1; tx++) {
        const y = escapeRoadTop(tx) * TILE + dy;
        if (tx === tx0) g.moveTo(tx * TILE, y); else g.lineTo(tx * TILE, y);
        g.lineTo((tx + 1) * TILE, y);
      }
    };
    g.save();
    g.strokeStyle = 'rgba(255,214,70,0.85)'; g.lineWidth = 4; g.setLineDash([36, 28]);
    trace(4 * TILE); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3;
    trace(3); g.stroke(); trace(8 * TILE - 3); g.stroke();
    g.restore();
  }

  function drawRoadMarkings(g, camX, vw, zoom) {
    if (escape) { drawEscapeRoadMarkings(g, camX, vw, zoom); drawEscapeBlocks(g, camX, vw, zoom); }
    const R = LEVEL.road;
    const left = Math.max(R.x0 * TILE, camX - vw / 2 / zoom - 40);
    const right = Math.min(camX + vw / 2 / zoom + 40, escape ? escape.t0 * TILE : Infinity);   // the bends take over from here
    if (right <= left) return;
    g.save();
    g.strokeStyle = 'rgba(255,214,70,0.85)';
    g.lineWidth = 4;
    g.setLineDash([36, 28]);
    const cy = (R.y0 + R.y1 + 1) / 2 * TILE;
    g.beginPath(); g.moveTo(left, cy); g.lineTo(right, cy); g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(left, R.y0 * TILE + 3); g.lineTo(right, R.y0 * TILE + 3);
    g.moveTo(left, (R.y1 + 1) * TILE - 3); g.lineTo(right, (R.y1 + 1) * TILE - 3);
    g.stroke();
    g.restore();
  }

  function drawScenery(g, now, doorsOpen) {
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 2;
    for (let x = LEVEL.lot.x0 + 1; x <= LEVEL.lot.x1; x += 3) {
      g.beginPath(); g.moveTo(x * TILE, (LEVEL.lot.y0 + 1) * TILE); g.lineTo(x * TILE, (LEVEL.lot.y0 + 5) * TILE); g.stroke();
    }
    g.restore();

    // the facility itself
    const F = LEVEL.facility;
    const fx = F.x0 * TILE, fy = F.y0 * TILE, fw = (F.x1 - F.x0 + 1) * TILE, fh = (F.y1 - F.y0 + 1) * TILE;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(fx + 10, fy + fh - 4, fw, 16);
    g.fillStyle = '#8d939c'; g.fillRect(fx, fy, fw, fh);
    g.fillStyle = '#6f757e'; g.fillRect(fx, fy, fw, 26);
    g.fillStyle = '#b6bcc4'; g.fillRect(fx, fy + fh - 12, fw, 12);
    g.strokeStyle = '#4a4f57'; g.lineWidth = 3; g.strokeRect(fx, fy, fw, fh);
    for (let wy = fy + 52; wy < fy + fh - 70; wy += 52) {
      for (let wx = fx + 28; wx < fx + fw - 40; wx += 64) {
        if (Math.abs(wx + 20 - doorPos.x) < 95 && wy > fy + fh - 110) continue;
        g.fillStyle = '#a8d4f0'; g.fillRect(wx, wy, 40, 30);
        g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(wx + 3, wy + 3, 14, 10);
        g.strokeStyle = '#4a4f57'; g.lineWidth = 2; g.strokeRect(wx, wy, 40, 30);
      }
    }
    // entrance
    const dw = 4 * TILE, DOOR_H = 64, dx = doorPos.x - dw / 2, dy = fy + fh - DOOR_H;
    g.fillStyle = '#2a2d33'; g.fillRect(dx - 8, dy - 8, dw + 16, DOOR_H + 16);
    if (doorsOpen > 0) {
      g.fillStyle = `rgba(15,5,20,${0.6 + doorsOpen * 0.4})`; g.fillRect(dx, dy, dw, DOOR_H);
      const glow = g.createRadialGradient(doorPos.x, dy + 60, 5, doorPos.x, dy + 60, 110);
      glow.addColorStop(0, `rgba(190,60,230,${0.55 * doorsOpen})`); glow.addColorStop(1, 'rgba(190,60,230,0)');
      g.fillStyle = glow; g.fillRect(dx - 60, dy - 50, dw + 120, 170);
    } else {
      g.fillStyle = '#7fb4d8'; g.fillRect(dx, dy, dw / 2 - 3, DOOR_H); g.fillRect(dx + dw / 2 + 3, dy, dw / 2 - 3, DOOR_H);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(dx + 6, dy + 6, 18, 26); g.fillRect(dx + dw / 2 + 9, dy + 6, 18, 26);
    }
    // a man in a hazmat suit braced against the doors, holding them shut; every few
    // seconds something thumps them from inside and shoves him back a step. Once the
    // chase starts there's only a stain on the step where he stood.
    const stoop = dy + DOOR_H;
    if (doorsOpen === 0 && window.BossCutscene && window.BossCutscene._hazmat) {
      const cyc = now % 3400, thump = cyc < 260 ? Math.exp(-cyc / 90) : 0;
      if (thump > 0.05) {                                    // the leaves flinch with it
        g.fillStyle = `rgba(190,60,230,${0.45 * thump})`; g.fillRect(dx + dw / 2 - 3, dy, 6, DOOR_H);
        g.strokeStyle = `rgba(20,20,26,${0.5 * thump})`; g.lineWidth = 4;
        g.beginPath(); g.ellipse(doorPos.x - 22, dy + 32, 10, 14, 0, 0, Math.PI * 2); g.stroke();
      }
      window.BossCutscene._hazmat(g, { x: doorPos.x + Math.sin(now * 0.011) * 1.2, y: stoop + 17 + thump * 6, ang: -Math.PI / 2, u: PLAYER_RADIUS * 1.05, armsUp: 1, jitter: 0.05 + 0.2 * thump, time: now, walk: 0, speed: 0 });
    } else if (doorsOpen > 0) {
      g.fillStyle = 'rgba(90,10,14,0.8)'; g.beginPath(); g.ellipse(doorPos.x + 6, stoop + 26, 22, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(110,12,18,0.7)';
      [[-14, 18, 5], [20, 34, 4], [-4, 44, 3], [30, 20, 3]].forEach(([ox, oy, r]) => { g.beginPath(); g.arc(doorPos.x + ox, stoop + oy, r, 0, Math.PI * 2); g.fill(); });
    }
    g.fillStyle = '#3a3d44'; g.fillRect(dx - 12, dy - 34, dw + 24, 24);
    g.fillStyle = '#fff'; g.font = 'bold 16px monospace'; g.textAlign = 'center';
    g.fillText('THE FACILITY', doorPos.x, dy - 17);
    g.textAlign = 'left';
  }

  function drawCar(g, car, idx, inCar) {
    g.save();
    g.translate(car.x, car.y);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.ellipse(2, 5, 26, 15, car.heading, 0, Math.PI * 2); g.fill();
    g.rotate(car.heading);
    g.fillStyle = '#111';
    [[-13, -14], [13, -14], [-13, 9], [13, 9]].forEach(([wx, wy]) => g.fillRect(wx - 6, wy, 12, 5));
    const dead = !car.alive;
    const body = [['#e0453c', '#a8241e'], ['#3c7ee0', '#1e4aa8']][idx % 2];
    const grad = g.createLinearGradient(0, -12, 0, 12);
    grad.addColorStop(0, dead ? '#3a3a3a' : body[0]); grad.addColorStop(1, dead ? '#1c1c1c' : body[1]);
    g.fillStyle = grad;
    g.beginPath();
    if (g.roundRect) g.roundRect(-22, -12, 44, 24, 6); else g.rect(-22, -12, 44, 24);
    g.fill();
    g.strokeStyle = dead ? '#000' : '#2a1010'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = dead ? '#222' : 'rgba(0,0,0,0.25)'; g.fillRect(-11, -9, 19, 18);
    g.fillStyle = dead ? '#333' : 'rgba(150,200,235,0.9)'; g.fillRect(8, -9, 6, 18);
    g.fillStyle = dead ? '#333' : 'rgba(150,200,235,0.6)'; g.fillRect(-15, -8, 4, 16);
    if (!dead) {
      g.fillStyle = '#ffe8a0'; g.fillRect(20, -10, 3, 5); g.fillRect(20, 5, 3, 5);
      g.fillStyle = car.braking ? '#ff3030' : '#8a1010'; g.fillRect(-23, -10, 3, 5); g.fillRect(-23, 5, 3, 5);
      if (inCar) {
        const p = players[idx];
        swCirc(g, -2, 0, 5.5, p.color);
        swCirc(g, -1, 0, 4, 'rgba(235,238,230,0.95)');
        g.fillStyle = '#10181f'; g.fillRect(1, -2.5, 2.4, 5);
      }
    }
    g.restore();
  }

  function drawLimb(g, hipX, hipY, tipX, tipY, width, color, capColor, capR) {
    // A slight elbow/knee bow instead of a dead-straight line, plus a
    // lit hand/foot instead of a flat-filled circle -- more follow-up
    // for a more expressive chimp body.
    const mx = (hipX + tipX) / 2, my = (hipY + tipY) / 2;
    const dx = tipX - hipX, dy = tipY - hipY;
    const len = Math.hypot(dx, dy) || 1;
    const bend = len * 0.14;
    const bx = mx - (dy / len) * bend, by = my + (dx / len) * bend;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.quadraticCurveTo(bx, by, tipX, tipY);
    g.stroke();
    const capGrad = g.createRadialGradient(tipX - capR * 0.3, tipY - capR * 0.3, capR * 0.1, tipX, tipY, capR);
    capGrad.addColorStop(0, capColor);
    capGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.beginPath();
    g.arc(tipX, tipY, capR, 0, Math.PI * 2);
    g.fillStyle = capGrad;
    g.fill();
  }
  function drawPlayers(g) {
    const R = PLAYER_RADIUS;
    players.forEach((p) => {
      g.save();
      g.translate(p.x, p.y);
      if (p.down) {
        g.fillStyle = 'rgba(120,10,16,0.75)'; g.beginPath(); g.ellipse(0, 2, R * 1.7, R * 1.1, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.6; g.rotate(1.2);
      }
      g.beginPath();
      g.ellipse(0, R * 1.05, R * 0.85, R * 0.26, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill();
      g.rotate(Math.atan2(p.facing.y, p.facing.x));
      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(PlayerModel.suit(p), -0.35);
      const bootColor = '#2b2b28';
      drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      PlayerModel.drawTorso(g, R, p, bob, swing);
      PlayerModel.drawHead(g, R, p, bob);
      g.restore();
    });
  }

  function drawMissilesWorld(g) {
    missiles.forEach((m) => {
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.angle);
      g.scale(1.6, 1.6);
      g.fillStyle = 'rgba(255,140,40,0.6)';
      g.beginPath(); g.moveTo(-12, -2.5); g.lineTo(-22, 0); g.lineTo(-12, 2.5); g.closePath(); g.fill();
      g.fillStyle = '#d8d8d0'; g.fillRect(-6, -3, 14, 6);
      g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(8, -3); g.lineTo(14, 0); g.lineTo(8, 3); g.closePath(); g.fill();
      g.restore();
    });
  }
  function drawParticlesWorld(g) {
    particles.forEach((p) => {
      const a = 1 - p.life / p.maxLife;
      g.globalAlpha = Math.max(0, a);
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fillStyle = p.color; g.fill();
    });
    g.globalAlpha = 1;
  }
  function drawExplosionsWorld(g, now) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      const t = (now - e.t0) / 450;
      if (t >= 1) { explosions.splice(i, 1); continue; }
      g.beginPath(); g.arc(e.x, e.y, 14 + t * 60, 0, Math.PI * 2);
      g.strokeStyle = `rgba(255,150,40,${1 - t})`; g.lineWidth = 5; g.stroke();
      g.beginPath(); g.arc(e.x, e.y, (14 + t * 60) * 0.65, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,214,90,${(1 - t) * 0.5})`; g.fill();
    }
  }
  function drawFloatingTextsWorld(g) {
    floatingTexts.forEach((f) => {
      const t = f.life / f.maxLife;
      g.save(); g.globalAlpha = 1 - t;
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
      g.font = 'bold 16px monospace'; g.textAlign = 'center';
      g.strokeText(f.text, f.x, f.y - t * 30); g.fillText(f.text, f.x, f.y - t * 30);
      g.restore();
    });
  }

  function drawBossWorld(g, now) {
    if (gameState === 'foot' || gameState === 'escape' || gameState === 'military') return;
    const flash = clamp((boss.flashUntil - now) / 150, 0, 1);
    const dyingT = gameState === 'dying' ? clamp((now - dyingStartedAt) / DYING_MS, 0, 1) : 0;
    g.save();
    if (boss.emerge < 1) g.globalAlpha = boss.emerge;
    const scale = 0.4 + boss.emerge * 0.6;
    g.translate(boss.x, boss.y); g.scale(scale, scale); g.translate(-boss.x, -boss.y);
    drawSwarm(g, boss.x, boss.y, boss.heading, now, members, BOSS_SPREAD, flash, dyingT * 0.45);
    g.restore();
  }

  function drawViewWorld(vx, vw, camX, camY, zoom, now) {
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, 0, vw, VIEW_H); ctx.clip();
    ctx.fillStyle = '#6dab4a'; ctx.fillRect(vx, 0, vw, VIEW_H);
    ctx.translate(vx + vw / 2 + sx, VIEW_H / 2 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, camX, camY, vw, zoom);
    drawRoadMarkings(ctx, camX, vw, zoom);
    const doorsOpen = gameState === 'foot' ? 0 : clamp((performance.now() - chaseStartedAt) / 600, 0, 1);
    drawScenery(ctx, now, doorsOpen);
    if (escape) drawRoadblock(ctx, now);
    drawParticlesWorld(ctx);
    if (gameState === 'foot') {
      cars.forEach((c, i) => drawCar(ctx, c, i, false));
      drawPlayers(ctx);
    } else if (escape) {
      cars.forEach((c, i) => drawCar(ctx, c, i, true));
      drawPlayers(ctx);
      drawChasers(ctx, now);
    } else {
      drawBossWorld(ctx, now);
      cars.forEach((c, i) => drawCar(ctx, c, i, true));
      drawMissilesWorld(ctx);
      drawThrownWorld(ctx, now);
    }
    drawExplosionsWorld(ctx, now);
    drawFloatingTextsWorld(ctx);
    ctx.restore();
  }

  function worldToScreen(vx, vw, camX, camY, zoom, x, y) {
    return { x: vx + vw / 2 + (x - camX) * zoom, y: VIEW_H / 2 + (y - camY) * zoom };
  }

  function drawHintOverFoot(vx, vw, camX, camY, now) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    const bob = Math.sin(now * 0.006) * 3;
    cars.forEach((c, i) => {
      const s = worldToScreen(vx, vw, camX, camY, FOOT_ZOOM, c.x, c.y - 36);
      const ready = playerAtOwnCar(i);
      const label = players.length === 1 ? 'GET IN THE CAR' : `P${i + 1}: GET IN YOUR CAR`;
      const w = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(10,12,18,0.75)'; ctx.fillRect(s.x - w / 2, s.y + bob - 14, w, 20);
      ctx.fillStyle = ready ? '#3ddc84' : '#ffd27a';
      ctx.fillText(label, s.x, s.y + bob);
    });
    ctx.restore();
  }

  // Distance down the road, plus a fixed marker for where the forest (and
  // the dark) begins.
  function drawDistance() {
    const lead = leadCar();
    const dist = Math.max(0, Math.round((lead.x / TILE - LEVEL.road.x0) * 2));
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.65)'; ctx.fillRect(6, 8, 138, 24);
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e8e8'; ctx.fillText(`${dist} m DOWN THE ROAD`, 12, 24);
    ctx.restore();
  }

  // Past the treeline it gets dark -- fading in over the first stretch of
  // forest -- and the only light is your headlights, a glow around the
  // swarm, and any missile or explosion.
  const darkCanvas = document.createElement('canvas');
  darkCanvas.width = FULL_W; darkCanvas.height = VIEW_H;
  const darkCtx = darkCanvas.getContext('2d');
  function forestDarkness(x) {
    const F = LEVEL.forest;
    return clamp((x / TILE - F.startX) / (F.fullX - F.startX), 0, 1);
  }
  function drawForestDarkness(camX, camY, z) {
    const dk = forestDarkness(cam.x);
    if (dk <= 0.01) return;
    const sp = (x, y) => worldToScreen(0, FULL_W, camX, camY, z, x, y);
    darkCtx.globalCompositeOperation = 'source-over';
    darkCtx.clearRect(0, 0, FULL_W, VIEW_H);
    darkCtx.fillStyle = `rgba(2,9,5,${0.9 * dk})`;
    darkCtx.fillRect(0, 0, FULL_W, VIEW_H);
    darkCtx.globalCompositeOperation = 'destination-out';
    const punch = (x, y, r, a) => {
      const g = darkCtx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      darkCtx.fillStyle = g; darkCtx.beginPath(); darkCtx.arc(x, y, r, 0, Math.PI * 2); darkCtx.fill();
    };
    cars.forEach((car) => {
      if (!car.alive) return;
      const c = sp(car.x, car.y);
      punch(c.x, c.y, 120 * z * 1.6, 0.95);
      const ca = Math.cos(car.heading), sa = Math.sin(car.heading);
      const tip = sp(car.x + ca * 30, car.y + sa * 30), far = sp(car.x + ca * 520, car.y + sa * 520);
      const cg = darkCtx.createLinearGradient(tip.x, tip.y, far.x, far.y);
      cg.addColorStop(0, 'rgba(0,0,0,0.95)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      darkCtx.fillStyle = cg;
      const a1 = sp(car.x + Math.cos(car.heading - 0.34) * 540, car.y + Math.sin(car.heading - 0.34) * 540);
      const a2 = sp(car.x + Math.cos(car.heading + 0.34) * 540, car.y + Math.sin(car.heading + 0.34) * 540);
      darkCtx.beginPath(); darkCtx.moveTo(tip.x, tip.y); darkCtx.lineTo(a1.x, a1.y); darkCtx.lineTo(a2.x, a2.y); darkCtx.closePath(); darkCtx.fill();
    });
    if (escape) {
      players.forEach((p) => { if (p.down) return; const q = sp(p.x, p.y); punch(q.x, q.y, 210 * z, 0.95); });
      chasers.forEach((c) => { const q = sp(c.x, c.y); punch(q.x, q.y, (c.size * 2.4 + 24) * z, 0.7); });
      const R = LEVEL.road, q = sp(escape.endX + 30, (R.y0 + R.y1 + 1) / 2 * TILE);
      punch(q.x, q.y, 620 * z, 0.97);                    // the roadblock's floodlights
    } else if (gameState !== 'foot') { const b = sp(boss.x, boss.y); punch(b.x, b.y, BOSS_SPREAD * 2.6 * z, 0.88); }
    missiles.forEach((m) => { const q = sp(m.x, m.y); punch(q.x, q.y, 90 * z, 0.8); });
    thrown.forEach((m) => { const q = sp(m.x, m.y); punch(q.x, q.y, 110 * z, 0.9); });
    explosions.forEach((e) => { const q = sp(e.x, e.y); punch(q.x, q.y, 130 * z, 0.9); });
    darkCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCanvas, 0, 0);
  }

  function drawBossBar(now) {
    const barW = 340, barH = 15, bx = (FULL_W - barW) / 2, by = 22;
    const frac = clamp(boss.hp / BOSS_MAX_HEALTH, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.75)'; ctx.fillRect(bx - 8, by - 21, barW + 16, barH + 30);
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#e6a8ff';
    ctx.fillText(boss.hp > 0 ? `THE MULTIPOD (${fmtHp(boss.hp)}/${BOSS_MAX_HEALTH})` : 'THE MULTIPOD — DESTROYED', FULL_W / 2, by - 4);
    ctx.fillStyle = '#1a1a1c'; ctx.fillRect(bx, by, barW, barH);
    const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    grad.addColorStop(0, '#d88af0'); grad.addColorStop(0.5, '#a03ac8'); grad.addColorStop(1, '#5a1a78');
    ctx.fillStyle = grad; ctx.fillRect(bx, by, barW * frac, barH);
    if (frac > 0 && frac < 0.3) { ctx.fillStyle = `rgba(255,255,255,${0.14 * (0.5 + 0.5 * Math.sin(now / 120))})`; ctx.fillRect(bx, by, barW * frac, barH); }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    if (gameState === 'chase' && boss.speedMult > 3.3) {
      ctx.font = 'bold 11px monospace'; ctx.fillStyle = `rgba(255,90,90,${0.6 + 0.4 * Math.sin(now / 90)})`;
      ctx.fillText(`SPRINTING — ${boss.speedMult.toFixed(1)}x`, FULL_W / 2, by + barH + 14);
    }
    ctx.restore();
  }

  // A health bar riding on the swarm itself, so you can read it while
  // you're watching the thing that's chasing you.
  function drawBossHealthTag(camX, camY, z) {
    if (gameState !== 'chase' && gameState !== 'dying') return;
    if (boss.emerge < 1 && gameState === 'chase') return;
    const s = worldToScreen(0, FULL_W, camX, camY, z, boss.x, boss.y);
    const w = 170, h = 12;
    const cx = clamp(s.x + 30, w / 2 + 8, FULL_W - w / 2 - 8);
    const cy = clamp(s.y - BOSS_SPREAD * 1.3 * z - 18, 70, VIEW_H - 40);
    const frac = clamp(boss.hp / BOSS_MAX_HEALTH, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.8)'; ctx.fillRect(cx - w / 2 - 5, cy - 19, w + 10, h + 26);
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(`${fmtHp(boss.hp)} / ${BOSS_MAX_HEALTH} HP`, cx, cy - 6);
    ctx.fillStyle = '#2a1a30'; ctx.fillRect(cx - w / 2, cy, w, h);
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, frac < 0.3 ? '#ff6a6a' : '#d88af0'); g.addColorStop(1, frac < 0.3 ? '#a02020' : '#7a2aa8');
    ctx.fillStyle = g; ctx.fillRect(cx - w / 2, cy, w * frac, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(cx - w / 2 + 0.5, cy + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  function drawFireBars(now) {
    const w = 130;
    cars.forEach((car, i) => {
      const cx = cars.length === 1 ? FULL_W / 2 : (i === 0 ? FULL_W * 0.28 : FULL_W * 0.72);
      const x = cx - w / 2, y = VIEW_H - 22;
      const ready = now >= car.nextFireAt;
      const frac = ready ? 1 : clamp(1 - (car.nextFireAt - now) / MISSILE_COOLDOWN_MS, 0, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(5,8,12,0.7)'; ctx.fillRect(x - 4, y - 14, w + 8, 26);
      ctx.fillStyle = !car.alive ? '#555' : (ready ? '#3ddc84' : '#ffb43d'); ctx.fillRect(x, y, w * (car.alive ? frac : 0), 7);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 6);
      ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = players[i].color;
      const keyName = PLAYER_MODE === 1 ? 'SPACE' : (i === 0 ? 'SPACE' : 'ENTER');
      ctx.fillText(!car.alive ? `P${i + 1} DOWN` : (ready ? `${PLAYER_MODE === 1 ? '' : `P${i + 1}: `}MISSILE READY — ${keyName}` : 'RELOADING'), cx, y - 3);
      ctx.restore();
    });
  }

  function drawBossPointer(camX, camY, z, now, tx = boss.x, ty = boss.y) {
    const s = worldToScreen(0, FULL_W, camX, camY, z, tx, ty);
    const m = 26;
    if (s.x > m && s.x < FULL_W - m && s.y > m + 30 && s.y < VIEW_H - m) return;
    const cx = FULL_W / 2, cy = VIEW_H / 2;
    const ang = Math.atan2(s.y - cy, s.x - cx);
    const k = Math.min((FULL_W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (VIEW_H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
    const px = cx + Math.cos(ang) * k, py = cy + Math.sin(ang) * k;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    const pulse = 0.75 + 0.25 * Math.sin(now * 0.012);
    ctx.fillStyle = `rgba(190,70,230,${pulse})`;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // The nearer the Multipod gets, the more the screen smears out (instead of
  // flashing red).
  function drawDangerVignette(now) {
    const gap = gapNow();
    if (gap > CATCH_DIST + 220) return;
    window.ScreenFx.proximity(ctx, 0, 0, FULL_W, VIEW_H, clamp(1 - (gap - CATCH_DIST) / 220, 0, 1));
  }

  function drawBanner(text, color, alpha) {
    ctx.save();
    ctx.fillStyle = `rgba(5,8,12,${0.6 * alpha})`; ctx.fillRect(0, VIEW_H / 2 - 36, FULL_W, 72);
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.fillText(text, FULL_W / 2, VIEW_H / 2 + 9);
    ctx.restore();
  }

  // ---- the ending cutscene: a picture of the facility, a bomb coming
  // down on it, and the rest. Pure canvas drawing, no assets.
  const nukeRng = swarmRng(777);
  const nukeDebris = Array.from({ length: 70 }, () => ({
    a: -Math.PI / 2 + (nukeRng() - 0.5) * 2.6, sp: 80 + nukeRng() * 260,
    w: 2 + nukeRng() * 6, h: 2 + nukeRng() * 5, spin: (nukeRng() - 0.5) * 8,
  }));
  const nukeTrees = Array.from({ length: 30 }, (_, i) => ({ x: i * 32 + nukeRng() * 20, h: 36 + nukeRng() * 40, w: 16 + nukeRng() * 14 }));
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

  function drawNukeScene(g, t) {
    const W = FULL_W, H = VIEW_H, gx = 460, gy = 258;
    const post = Math.max(0, t - NUKE_IMPACT_MS);
    const heat = clamp(post / 1500, 0, 1);
    const shk = post > 0 && post < 2400 ? (1 - post / 2400) * 9 : 0;
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.clip();
    if (shk) g.translate((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk);

    // dusk sky that goes hot-orange when the bomb goes off
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, mixHex('#16213f', '#4a1c14', heat));
    sky.addColorStop(1, mixHex('#e89a5a', '#ffb868', heat));
    g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
    // far hills
    g.fillStyle = mixHex('#3a3050', '#2a1612', heat);
    g.beginPath(); g.moveTo(-20, gy);
    for (let x = -20; x <= W + 20; x += 40) g.lineTo(x, gy - 22 - Math.sin(x * 0.013) * 14 - Math.sin(x * 0.04) * 6);
    g.lineTo(W + 20, gy); g.closePath(); g.fill();
    g.fillStyle = mixHex('#1a2214', '#140d08', heat);
    g.fillRect(-20, gy, W + 40, H - gy + 20);

    // the facility, seen from far off
    const facDamage = clamp((post - 250) / 1300, 0, 1);
    if (facDamage < 1) {
      g.save();
      g.translate(gx, gy);
      if (post > 0) g.translate((Math.random() - 0.5) * 6, 0);
      g.globalAlpha = 1 - facDamage;
      g.scale(1, 1 - facDamage * 0.7);
      g.fillStyle = '#2b2e35'; g.fillRect(-135, -62, 270, 62);
      g.fillStyle = '#22252b'; g.fillRect(-22, -98, 44, 40);
      g.strokeStyle = '#22252b'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -98); g.lineTo(0, -122); g.stroke();
      g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(0, -124, 2.5, 0, Math.PI * 2); g.fill();
      for (let wx = -120; wx < 120; wx += 24) for (let wy = -52; wy < -14; wy += 18) {
        g.fillStyle = (Math.floor(wx / 24) + Math.floor(wy / 18)) % 3 ? 'rgba(255,214,120,0.85)' : 'rgba(255,214,120,0.25)';
        g.fillRect(wx, wy, 12, 8);
      }
      g.fillStyle = '#3a3d44'; g.fillRect(-26, -18, 52, 18);
      g.restore();
    } else {
      g.fillStyle = '#1a1612';
      g.beginPath(); g.moveTo(gx - 150, gy); g.lineTo(gx - 110, gy - 9); g.lineTo(gx - 60, gy - 4); g.lineTo(gx - 10, gy - 15); g.lineTo(gx + 50, gy - 6); g.lineTo(gx + 110, gy - 12); g.lineTo(gx + 150, gy); g.closePath(); g.fill();
    }

    // the bomb
    if (t < NUKE_IMPACT_MS) {
      const p = clamp(t / NUKE_IMPACT_MS, 0, 1), q = p * p;
      const sx = W * 0.9, sy = -30, ex = gx, ey = gy - 64;
      const bx = lerp(sx, ex, q), by = lerp(sy, ey, q);
      const tr = g.createLinearGradient(sx, sy, bx, by);
      tr.addColorStop(0, 'rgba(255,200,120,0)'); tr.addColorStop(1, 'rgba(255,230,180,0.85)');
      g.strokeStyle = tr; g.lineWidth = 3; g.beginPath(); g.moveTo(lerp(sx, ex, Math.max(0, q - 0.35)), lerp(sy, ey, Math.max(0, q - 0.35))); g.lineTo(bx, by); g.stroke();
      g.save(); g.translate(bx, by); g.rotate(Math.atan2(ey - sy, ex - sx));
      g.fillStyle = '#c8ccd2'; g.beginPath(); g.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d83a2a'; g.fillRect(-12, -1.5, 5, 3);
      g.restore();
    }

    // foreground treeline silhouette
    g.fillStyle = mixHex('#0c1208', '#080503', heat);
    nukeTrees.forEach((tr) => {
      g.beginPath(); g.moveTo(tr.x - tr.w, H + 4); g.lineTo(tr.x, H - tr.h); g.lineTo(tr.x + tr.w, H + 4); g.closePath(); g.fill();
    });

    if (post > 0) {
      // shockwave sweeping out along the ground
      const sw = easeOut(post / 4200);
      const rx = sw * W * 0.95;
      g.strokeStyle = `rgba(255,230,190,${0.7 * (1 - sw)})`; g.lineWidth = 5;
      g.beginPath(); g.ellipse(gx, gy, rx, rx * 0.09 + 3, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(110,80,60,${0.35 * (1 - sw)})`;
      g.beginPath(); g.ellipse(gx, gy + 2, rx, rx * 0.05 + 2, 0, 0, Math.PI * 2); g.fill();

      // fireball
      const fb = easeOut(post / 2600);
      const fr = 12 + fb * 125, fcy = gy - fr * 0.35;
      const fa = post > 4800 ? clamp(1 - (post - 4800) / 3500, 0.25, 1) : 1;
      const fg = g.createRadialGradient(gx, fcy, 0, gx, fcy, fr);
      fg.addColorStop(0, `rgba(255,255,255,${fa})`); fg.addColorStop(0.22, `rgba(255,236,150,${fa})`);
      fg.addColorStop(0.55, `rgba(255,140,40,${0.95 * fa})`); fg.addColorStop(0.88, `rgba(160,40,16,${0.7 * fa})`); fg.addColorStop(1, 'rgba(100,20,10,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(gx, fcy, fr, 0, Math.PI * 2); g.fill();

      // the mushroom cloud: a stem climbing, a cap of billowing lobes
      if (post > 900) {
        const u = easeOut((post - 900) / 7000);
        const stemH = u * 175;
        const sw0 = 24 - u * 6;
        const sg = g.createLinearGradient(gx - sw0, 0, gx + sw0, 0);
        sg.addColorStop(0, '#5a2a14'); sg.addColorStop(0.5, '#d0702a'); sg.addColorStop(1, '#4a2210');
        g.fillStyle = sg;
        g.beginPath(); g.moveTo(gx - sw0 - 12, gy); g.quadraticCurveTo(gx - sw0, gy - stemH * 0.5, gx - sw0 * 0.55, gy - stemH);
        g.lineTo(gx + sw0 * 0.55, gy - stemH); g.quadraticCurveTo(gx + sw0, gy - stemH * 0.5, gx + sw0 + 12, gy); g.closePath(); g.fill();
        const capR = 18 + u * 78, capY = gy - stemH - capR * 0.25;
        for (let k = 0; k < 11; k++) {
          const a = Math.PI + (k / 10) * Math.PI;
          const lx = gx + Math.cos(a) * capR * 1.15, ly = capY + Math.sin(a) * capR * 0.55 + Math.sin(post * 0.002 + k) * 2;
          const lr = capR * (0.38 + 0.1 * Math.sin(k * 2.1));
          const lg = g.createRadialGradient(lx, ly - lr * 0.25, 0, lx, ly, lr);
          lg.addColorStop(0, '#ffcf80'); lg.addColorStop(0.6, '#d9702a'); lg.addColorStop(1, '#5a2a14');
          g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, lr, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(60,30,18,0.9)'; g.beginPath(); g.ellipse(gx, capY + capR * 0.28, capR * 1.1, capR * 0.3, 0, 0, Math.PI * 2); g.fill();
        const cg2 = g.createRadialGradient(gx, capY, 0, gx, capY, capR * 1.4);
        cg2.addColorStop(0, 'rgba(255,200,120,0.35)'); cg2.addColorStop(1, 'rgba(255,160,60,0)');
        g.fillStyle = cg2; g.beginPath(); g.arc(gx, capY, capR * 1.4, 0, Math.PI * 2); g.fill();
      }

      // debris thrown out of the facility
      const tt = post / 1000;
      nukeDebris.forEach((d) => {
        const dx = Math.cos(d.a) * d.sp * tt, dy = Math.sin(d.a) * d.sp * tt + 160 * tt * tt;
        const da = clamp(1 - post / 4200, 0, 1);
        if (da <= 0) return;
        g.save(); g.translate(gx + dx, gy - 20 + dy); g.rotate(d.spin * tt); g.globalAlpha = da;
        g.fillStyle = '#2a2622'; g.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); g.restore();
      });
    }

    // haze, then the blinding flash on top of everything
    if (post > 0) { g.fillStyle = `rgba(60,28,12,${0.28 * heat})`; g.fillRect(-20, -20, W + 40, H + 40); }
    const flashA = post > 0 ? clamp(1 - post / 950, 0, 1) : 0;
    if (flashA > 0) { g.fillStyle = `rgba(255,255,255,${flashA})`; g.fillRect(-20, -20, W + 40, H + 40); }
    g.restore();

    // letterbox, captions, fade out
    g.fillStyle = '#000'; g.fillRect(0, 0, W, 22); g.fillRect(0, H - 22, W, 22);
    g.textAlign = 'center';
    if (t > 7200) {
      g.font = 'bold 22px monospace'; g.fillStyle = `rgba(255,236,210,${clamp((t - 7200) / 900, 0, 1)})`;
      g.fillText('THE FACILITY IS GONE.', W / 2, H - 40);
    }
    if (t > 10400) {
      g.font = '13px monospace'; g.fillStyle = `rgba(210,200,190,${clamp((t - 10400) / 900, 0, 1)})`;
      g.fillText('NOTHING IN IT SURVIVED.', W / 2, H - 28);
    }
    if (t > 1500 && t < NUKE_MS - 1500) { g.font = '10px monospace'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillText('ENTER: SKIP', W - 10, H - 28); }
    const fade = clamp((t - (NUKE_MS - 1400)) / 1300, 0, 1);
    if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
  }

  // ---- the escape, drawn ----
  function drawChasers(g, now) {
    chasers.forEach((c) => {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.heading + Math.sin(now * 0.006 + c.phase) * 0.18);
      drawSwarmMember(g, c.id, c.size, now, c.phase, 0);
      g.restore();
    });
  }

  // the military roadblock the road ends at: a sandbag wall with a gap just
  // wide enough to run through, trucks, soldiers with rifles trained down the
  // road, and floodlights
  function drawRoadblock(g, now) {
    const E = escape.endX, R = LEVEL.road;
    const top = R.y0 * TILE, bot = (R.y1 + 1) * TILE, mid = (top + bot) / 2, GAP = 2.5 * TILE;
    const y0 = top - 5 * TILE, y1 = bot + 5 * TILE;
    g.save();
    g.fillStyle = '#4b4e53'; g.fillRect(E - 30, y0, 300, y1 - y0);
    g.fillStyle = '#585b61'; g.fillRect(E - 30, top, 300, bot - top);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(E - 24, top); g.lineTo(E - 24, bot); g.stroke();
    g.save(); g.translate(E - 58, mid); g.rotate(-Math.PI / 2);
    g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText('HALT', 0, 8);
    g.restore();
    // sandbag walls either side of the gap
    const bags = (ya, yb) => {
      for (let y = ya; y < yb; y += 13) for (let c = 0; c < 2; c++) {
        g.fillStyle = (Math.floor(y / 13) + c) % 2 ? '#9a8a62' : '#8a7a54';
        g.beginPath(); g.ellipse(E + 8 + c * 15, y + 7 + (c ? 6 : 0), 10, 8, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,30,10,0.55)'; g.lineWidth = 1; g.stroke();
      }
    };
    bags(y0, mid - GAP); bags(mid + GAP, y1);
    [mid - GAP, mid + GAP].forEach((py) => {                   // striped posts either side of the gap
      for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#f2f2f2' : '#d8281e'; g.fillRect(E - 2, py - 8 + k * 4, 40, 4); }
    });
    // trucks
    const truck = (ty, up) => {
      g.save(); g.translate(E + 80, ty);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(4, 6, 130, 50);
      g.fillStyle = '#4a5530'; g.fillRect(0, 0, 130, 50);
      g.fillStyle = '#5b6a3a'; g.fillRect(34, 4, 94, 42);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let x = 50; x < 128; x += 16) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, 46); g.stroke(); }
      g.fillStyle = '#333c22'; g.fillRect(0, 0, 30, 50);
      g.fillStyle = 'rgba(150,200,235,0.8)'; g.fillRect(2, 6, 7, 38);
      g.fillStyle = '#ffe8a0'; g.fillRect(-2, 6, 3, 8); g.fillRect(-2, 36, 3, 8);
      g.restore();
    };
    truck(mid - GAP - 70, true); truck(mid + GAP + 20, false);
    // soldiers: along the wall, and a few at the gap, rifles pointing back down the road
    const soldier = (sx, sy, k) => {
      g.save(); g.translate(sx, sy);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-2, 4 * (k % 2 ? 1 : -1)); g.lineTo(-17, 2 * (k % 2 ? 1 : -1)); g.stroke();
      g.fillStyle = '#3f4a26'; g.beginPath(); g.ellipse(0, 0, 6, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#566632'; g.beginPath(); g.arc(1, 0, 5.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#262e14'; g.lineWidth = 1; g.stroke();
      g.restore();
    };
    for (let y = y0 + 20, k = 0; y < y1 - 10; y += 26, k++) { if (Math.abs(y - mid) < GAP + 4) continue; soldier(E + 44, y, k); }
    [-1, 1].forEach((s, k) => { soldier(E + 62, mid + s * (GAP - 14), k); soldier(E + 90, mid + s * (GAP + 8), k + 1); });
    // floodlights, throwing long cones back down the road
    g.globalCompositeOperation = 'lighter';
    [y0 + 14, y1 - 14].forEach((ly) => {
      const lg = g.createLinearGradient(E + 22, ly, E - 560, mid);
      lg.addColorStop(0, 'rgba(255,244,200,0.34)'); lg.addColorStop(1, 'rgba(255,244,200,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(E + 22, ly); g.lineTo(E - 560, mid - 240); g.lineTo(E - 560, mid + 240); g.closePath(); g.fill();
    });
    g.globalCompositeOperation = 'source-over';
    [y0 + 14, y1 - 14].forEach((ly) => {
      g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(E + 22, ly, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(E + 18, ly, 5, 0, Math.PI * 2); g.fill();
    });
    g.restore();
  }

  function drawEscapeHud(now) {
    const live = players.filter((p) => !p.down);
    const lead = live.length ? Math.max(...live.map((p) => p.x)) : players[0].x;
    const left = Math.max(0, Math.round((escape.endX + 52 - lead) / TILE * 2));
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,12,0.65)'; ctx.fillRect(6, 8, 188, 24);
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffe28a';
    ctx.fillText(`${left} m TO THE ROADBLOCK`, 12, 24);
    ctx.restore();
  }
  function renderEscape(now, dt) {
    const since = now - escape.startedAt;
    const live = players.filter((p) => !p.down);
    const focus = live.length ? live : players;
    const near = nearestChaser();
    const lead = Math.max(...focus.map((p) => p.x));
    let left = Math.min(...focus.map((p) => p.x));
    if (near && near.c.x < left) left = Math.max(near.c.x, left - 900);
    const right = lead + 240;
    const wantZoom = clamp((FULL_W * 0.9) / Math.max(right - left, 200), 0.3, 0.8);
    chaseZoom += (wantZoom - chaseZoom) * Math.min(1, dt * 5);
    const halfH = VIEW_H / 2 / chaseZoom;
    const camX = (left + right) / 2;
    const avgY = focus.reduce((a, p) => a + p.y, 0) / focus.length;
    const camY = clamp(avgY, halfH, WORLD_H - halfH);
    cam.x = camX; cam.y = camY;
    drawViewWorld(0, FULL_W, camX, camY, chaseZoom, now);
    drawForestDarkness(camX, camY, chaseZoom);
    if (near && gameState === 'escape') {
      window.ScreenFx.proximity(ctx, 0, 0, FULL_W, VIEW_H, clamp(1 - (near.d - 90) / 200, 0, 1));
      drawBossPointer(camX, camY, chaseZoom, now, near.c.x, near.c.y);
    }
    drawEscapeHud(now);
    if (gameState === 'escape') {
      if (since < 2600) drawBanner('IT\u2019S SPLITTING UP \u2014 RUN!', '#ff6a5a', clamp(1 - Math.max(0, since - 1900) / 700, 0, 1));
      if (since > 600 && since < 6000 && live.length) {
        ctx.save(); ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,255,255,${0.75 * clamp((6000 - since) / 800, 0, 1)})`;
        ctx.fillText(PLAYER_MODE === 1 ? 'W A S D / ARROWS: RUN' : 'P1: W A S D     P2: ARROWS', FULL_W / 2, VIEW_H - 14);
        ctx.restore();
      }
    }
  }

  // ---- the military cutscene: ten seconds of soldiers behind a sandbag
  // line shooting the monsters as they come up the road, blood everywhere.
  // Pure canvas drawing, a pure function of t (deterministic).
  const MIL_GY = 252, MIL_SOLDIERS = 11;
  const milRng = swarmRng(4242);
  const milBossIds = new Set([5, 11, 16, 21, 26, 31]);
  const milMonsters = Array.from({ length: 44 }, (_, i) => {
    const id = Math.floor(milRng() * SWARM_DEFS.length);
    const dieT = 1000 + (i / 44) * 8300 + (milRng() - 0.5) * 120;
    const dur = 1600 + milRng() * 1000, dieX = 140 + milRng() * 350;
    const gore = Array.from({ length: 18 }, () => ({
      a: -Math.PI / 2 + (milRng() - 0.5) * 3.2, sp: 90 + milRng() * 250, sz: 1.5 + milRng() * 3.2, gz: milRng() * 26, dark: milRng(),
    }));
    return {
      id, dieT, dieX, x0: -90, spd: (dieX + 90) / dur * 1000, lane: milRng(),
      s: (milBossIds.has(id) ? 46 : 20) + milRng() * 16, gore,
      shots: [0, 1, 2].map((k) => ({ at: dieT - 330 + k * 110 + milRng() * 40, from: Math.floor(milRng() * MIL_SOLDIERS) })),
    };
  }).sort((a, b) => a.dieT - b.dieT);
  const milSplats = Array.from({ length: 9 }, (_, i) => ({
    at: 1900 + i * 800 + milRng() * 300, x: 60 + milRng() * 800, y: 50 + milRng() * 230, r: 24 + milRng() * 40, drip: 0.5 + milRng(), seed: milRng(),
  }));
  const milStars = Array.from({ length: 50 }, () => ({ x: milRng() * FULL_W, y: milRng() * 120, r: 0.5 + milRng() * 1.1 }));
  const milTrees = Array.from({ length: 34 }, (_, i) => ({ x: i * 29 + milRng() * 16, h: 50 + milRng() * 60, w: 14 + milRng() * 12 }));
  const milLaneY = (m) => MIL_GY - 30 + m.lane * 34;
  const milSoldier = (i) => ({ x: 600 + i * 26 + (i % 2) * 8, y: MIL_GY + (i % 2) * 8, kneel: i % 3 === 0 });

  function drawMilitaryScene(g, t) {
    const W = FULL_W, H = VIEW_H, gy = MIL_GY;
    const kills = milMonsters.filter((m) => m.dieT <= t).length;
    g.save();
    g.beginPath(); g.rect(0, 0, W, H); g.clip();
    const jolt = (t > 800 && t < 9400) ? 1.6 + Math.sin(t * 0.07) * 0.8 : 0;
    g.translate((Math.sin(t * 0.093) * jolt), (Math.cos(t * 0.081) * jolt));
    // night sky, stars, moon
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#04060c'); sky.addColorStop(1, '#16202a');
    g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
    milStars.forEach((s) => { g.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 0.003 + s.x)})`; g.fillRect(s.x, s.y, s.r, s.r); });
    g.fillStyle = '#d8dce6'; g.beginPath(); g.arc(780, 62, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#10161e'; g.beginPath(); g.arc(790, 56, 18, 0, Math.PI * 2); g.fill();
    // forest wall on the far side
    g.fillStyle = '#070b08';
    milTrees.forEach((tr) => { g.beginPath(); g.moveTo(tr.x - tr.w, gy - 6); g.lineTo(tr.x, gy - 6 - tr.h); g.lineTo(tr.x + tr.w, gy - 6); g.closePath(); g.fill(); });
    // the road
    const rg = g.createLinearGradient(0, gy - 8, 0, H);
    rg.addColorStop(0, '#2b2e34'); rg.addColorStop(1, '#16181c');
    g.fillStyle = rg; g.fillRect(-20, gy - 8, W + 40, H);
    g.strokeStyle = 'rgba(255,214,70,0.5)'; g.lineWidth = 3; g.setLineDash([34, 26]); g.beginPath(); g.moveTo(0, gy + 30); g.lineTo(W, gy + 30); g.stroke(); g.setLineDash([]);
    // floodlight beams across the killing field
    g.save(); g.globalCompositeOperation = 'lighter';
    [[590, 70], [900, 60]].forEach(([lx, ly], k) => {
      const bg = g.createLinearGradient(lx, ly, 120, gy);
      bg.addColorStop(0, 'rgba(255,244,205,0.30)'); bg.addColorStop(1, 'rgba(255,244,205,0.02)');
      g.fillStyle = bg; g.beginPath(); g.moveTo(lx, ly); g.lineTo(60 + k * 80, gy - 40); g.lineTo(380 + k * 80, gy + 36); g.closePath(); g.fill();
    });
    g.restore();
    [[590, 70], [900, 60]].forEach(([lx, ly]) => {
      g.fillStyle = '#1a1c20'; g.fillRect(lx - 2, ly, 4, gy - ly);
      g.fillStyle = '#fff4d0'; g.beginPath(); g.arc(lx, ly, 6, 0, Math.PI * 2); g.fill();
    });

    // blood already on the ground, under everything that's still alive
    milMonsters.forEach((m) => {
      if (t < m.dieT) return;
      const age = t - m.dieT, y = milLaneY(m) + 8, k = clamp(age / 260, 0, 1);
      g.fillStyle = `rgba(110,6,12,${0.85 * k})`;
      g.beginPath(); g.ellipse(m.dieX, y, (16 + m.s * 0.8) * k, (5 + m.s * 0.22) * k, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(150,12,20,${0.7 * k})`;
      g.beginPath(); g.ellipse(m.dieX + 4, y - 1, (9 + m.s * 0.4) * k, (3 + m.s * 0.1) * k, 0, 0, Math.PI * 2); g.fill();
    });

    // the monsters, back lanes first
    milMonsters.slice().sort((a, b) => a.lane - b.lane).forEach((m) => {
      const t0 = m.dieT - (m.dieX - m.x0) / m.spd * 1000;
      if (t < t0 || t >= m.dieT) return;
      const x = m.x0 + m.spd * (t - t0) / 1000, y = milLaneY(m);
      const sc = 0.8 + m.lane * 0.35;
      g.save(); g.translate(x, y - m.s * 0.35); g.scale(sc, sc * 0.9);
      g.rotate(Math.sin(t * 0.012 + m.id) * 0.1);
      drawSwarmMember(g, m.id, m.s, t, m.id, 0);
      g.restore();
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 8, m.s * 0.9 * sc, 5, 0, 0, Math.PI * 2); g.fill();
    });

    // blood in the air, then settling on the ground
    milMonsters.forEach((m) => {
      if (t < m.dieT) return;
      const age = (t - m.dieT) / 1000, y0 = milLaneY(m) - m.s * 0.4;
      if (age < 0.7) {                                          // the burst
        const k = clamp(age / 0.7, 0, 1);
        const bgr = g.createRadialGradient(m.dieX, y0, 0, m.dieX, y0, 20 + m.s * 1.6 * k);
        bgr.addColorStop(0, `rgba(190,14,22,${0.85 * (1 - k)})`); bgr.addColorStop(1, 'rgba(120,4,10,0)');
        g.fillStyle = bgr; g.beginPath(); g.arc(m.dieX, y0, 20 + m.s * 1.6 * k, 0, Math.PI * 2); g.fill();
      }
      m.gore.forEach((q) => {
        const rest = MIL_GY + 2 + q.gz * 0.5;
        let px = m.dieX + Math.cos(q.a) * q.sp * age, py = y0 + Math.sin(q.a) * q.sp * age + 520 * age * age;
        const landed = py >= rest;
        if (landed) {
          const ta = (Math.sqrt(Math.max(0, (Math.sin(q.a) * q.sp) ** 2 + 2 * 520 * (rest - y0))) - Math.sin(q.a) * q.sp) / 520;
          px = m.dieX + Math.cos(q.a) * q.sp * ta; py = rest;
          g.fillStyle = q.dark > 0.5 ? 'rgba(120,6,12,0.9)' : 'rgba(160,14,22,0.85)';
          g.beginPath(); g.ellipse(px, py, q.sz * 1.8, q.sz * 0.7, 0, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = q.dark > 0.5 ? '#8a0a12' : '#c4161e';
          g.beginPath(); g.arc(px, py, q.sz, 0, Math.PI * 2); g.fill();
        }
      });
    });

    // the sandbag line and the soldiers behind it
    for (let x = 540; x < W + 20; x += 20) for (let r = 0; r < 2; r++) {
      g.fillStyle = (x / 20 + r) % 2 ? '#9a8a62' : '#8a7a54';
      g.beginPath(); g.ellipse(x + r * 10, gy + 10 - r * 11, 11, 7, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,22,8,0.6)'; g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = '#3c4a24';
    for (let i = 0; i < MIL_SOLDIERS; i++) {
      const s = milSoldier(i), by = s.y - 6, h = s.kneel ? 24 : 36;
      g.fillStyle = '#2f3a1b'; g.fillRect(s.x - 5, by - h * 0.45, 4, h * 0.45); g.fillRect(s.x + 1, by - h * 0.45, 4, h * 0.45);   // legs
      g.fillStyle = '#44532a'; g.fillRect(s.x - 7, by - h * 0.95, 14, h * 0.55);                                                       // torso
      g.fillStyle = '#c69a78'; g.beginPath(); g.arc(s.x, by - h * 0.95 - 5, 5, 0, Math.PI * 2); g.fill();                              // face
      g.fillStyle = '#566632'; g.beginPath(); g.arc(s.x, by - h * 0.95 - 7, 6.2, Math.PI, Math.PI * 2); g.fill();                       // helmet
      g.fillRect(s.x - 7, by - h * 0.95 - 7, 14, 2);
      g.strokeStyle = '#141414'; g.lineWidth = 3; g.lineCap = 'round';                                                                // rifle, aimed down the road
      g.beginPath(); g.moveTo(s.x + 3, by - h * 0.7); g.lineTo(s.x - 25, by - h * 0.78); g.stroke();
      const rate = 7 + (i % 4), f = ((t / 1000 * rate + i * 0.37) % 1);
      if (t > 600 && t < 9300 && f < 0.28) {
        const fx = s.x - 27, fy = by - h * 0.78, fr = 5 + (i % 3) * 2;
        const fg = g.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.2);
        fg.addColorStop(0, 'rgba(255,255,230,0.95)'); fg.addColorStop(0.4, 'rgba(255,200,80,0.8)'); fg.addColorStop(1, 'rgba(255,120,20,0)');
        g.fillStyle = fg; g.beginPath(); g.arc(fx, fy, fr * 2.2, 0, Math.PI * 2); g.fill();
      }
    }
    // an armoured truck at the end of the line, and the two hazmat men crouched behind it
    g.fillStyle = '#3a4526'; g.fillRect(840, gy - 52, 90, 56);
    g.fillStyle = '#2b3419'; g.fillRect(810, gy - 40, 34, 44);
    g.fillStyle = 'rgba(150,200,235,0.55)'; g.fillRect(814, gy - 36, 24, 14);
    g.fillStyle = '#111'; g.beginPath(); g.arc(826, gy + 6, 9, 0, Math.PI * 2); g.arc(900, gy + 6, 9, 0, Math.PI * 2); g.fill();
    if (window.BossCutscene && window.BossCutscene._hazmat) {
      [[772, 0], [754, 1]].forEach(([hx, k]) => {
        try { window.BossCutscene._hazmat(g, { x: hx, y: gy + 20, ang: Math.PI, u: 12, armsUp: 0, jitter: 0.12, time: t + k * 300, walk: 0, speed: 0 }); } catch (e) { /* the film goes on without them */ }
      });
    }

    // tracers from the muzzles to whatever they hit
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    milMonsters.forEach((m) => {
      m.shots.forEach((sh) => {
        const age = t - sh.at;
        if (age < 0 || age > 90) return;
        const s = milSoldier(sh.from), sx = s.x - 27, sy = s.y - 6 - (s.kneel ? 24 : 36) * 0.78;
        const tx = m.dieX + (m.dieT - sh.at) * 0, ty = milLaneY(m) - m.s * 0.4;
        const k = age / 90, head = k, tail = Math.max(0, k - 0.35);
        g.strokeStyle = 'rgba(255,230,150,0.9)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(lerp(sx, tx, tail), lerp(sy, ty, tail)); g.lineTo(lerp(sx, tx, head), lerp(sy, ty, head)); g.stroke();
      });
    });
    g.restore();

    // a darkening red cast as the body count climbs
    g.fillStyle = `rgba(90,0,6,${0.05 + 0.18 * (kills / milMonsters.length)})`; g.fillRect(-20, -20, W + 40, H + 40);
    g.restore();

    // blood on the lens
    milSplats.forEach((sp) => {
      const age = t - sp.at;
      if (age < 0) return;
      const k = easeOut(age / 220), a = clamp(1 - Math.max(0, age - 4200) / 3000, 0.55, 1);
      g.save(); g.translate(sp.x, sp.y); g.globalAlpha = a;
      g.fillStyle = '#7a0810';
      g.beginPath(); g.arc(0, 0, sp.r * k, 0, Math.PI * 2); g.fill();
      for (let j = 0; j < 9; j++) {
        const aa = j * 0.7 + sp.seed * 6, rr = sp.r * (1.15 + ((j * 37 + sp.seed * 91) % 10) / 14) * k;
        g.beginPath(); g.arc(Math.cos(aa) * rr, Math.sin(aa) * rr, sp.r * (0.1 + ((j * 53) % 7) / 30) * k, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#9c0e18'; g.beginPath(); g.arc(-sp.r * 0.15, -sp.r * 0.2, sp.r * 0.55 * k, 0, Math.PI * 2); g.fill();
      g.fillRect(-sp.r * 0.12, 0, sp.r * 0.24, Math.min(age / 1000 * 14 * sp.drip, 70));          // it runs down the glass
      g.restore();
    });

    // letterbox, captions, tally, fades
    g.fillStyle = '#000'; g.fillRect(0, 0, W, 22); g.fillRect(0, H - 22, W, 22);
    g.textAlign = 'center';
    const cap = t < 1800 ? 'SOMETHING IS COMING UP THE ROAD.' : (t < 6800 ? 'OPEN FIRE.' : 'NOTHING GETS PAST THIS LINE.');
    const ca = t < 1800 ? clamp(t / 500, 0, 1) : (t < 6800 ? clamp((t - 1800) / 300, 0, 1) * clamp((2500 - (t - 1800)) / 400, 0, 1) : clamp((t - 6800) / 500, 0, 1));
    g.font = 'bold 20px monospace'; g.fillStyle = `rgba(255,236,210,${ca})`; g.fillText(cap, W / 2, H - 38);
    g.font = 'bold 11px monospace'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,200,200,0.85)'; g.fillText(`HOSTILES DOWN: ${kills}`, 12, 40);
    if (t > 1500 && t < MILITARY_MS - 1500) { g.font = '10px monospace'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillText('ENTER: SKIP', W - 10, H - 28); }
    const fin = 1 - clamp(t / 400, 0, 1), fout = clamp((t - (MILITARY_MS - 900)) / 800, 0, 1);
    if (fin > 0 || fout > 0) { g.fillStyle = `rgba(0,0,0,${Math.max(fin, fout)})`; g.fillRect(0, 0, W, H); }
  }

  function drawCredits(g, t) {
    g.fillStyle = '#000'; g.fillRect(0, 0, FULL_W, VIEW_H);
    g.textAlign = 'center';
    if (t < CREDITS_SCROLL_MS) {
      const top = VIEW_H + 30 - CREDITS_SCROLL_SPEED * t / 1000;
      CREDITS_TEXT.forEach((l) => {
        const y = top + l.pos + l.size;
        if (y < -30 || y > VIEW_H + 30) return;
        g.font = `${l.size}px monospace`; g.fillStyle = l.color;
        g.fillText(l.text, FULL_W / 2, y);
      });
      if (t > 1500) { g.font = '10px monospace'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillText('ENTER: SKIP', FULL_W - 10, VIEW_H - 12); }
      return;
    }
    const e = t - CREDITS_SCROLL_MS;
    const cy = VIEW_H / 2;
    if (e < END_OUT_AT + 700) {
      const a = Math.min(clamp(e / 1200, 0, 1), clamp((END_OUT_AT + 700 - e) / 700, 0, 1));
      const size = 44;
      g.font = `bold ${size}px monospace`; g.textAlign = 'left';
      const full = 'THE END...';
      const cw = g.measureText('M').width;
      const x0 = FULL_W / 2 - cw * full.length / 2;
      const base = cy + size * 0.35;
      g.globalAlpha = a; g.fillStyle = '#e8e2d6';
      g.fillText('THE END', x0, base);
      END_DOTS_AT.forEach((at, i) => {
        const da = clamp((e - at) / 800, 0, 1) * clamp((END_OUT_AT + 700 - e) / 700, 0, 1);
        g.globalAlpha = da; g.fillText('.', x0 + cw * (7 + i), base);
      });
      g.globalAlpha = 1;
    } else if (e >= FORNOW_AT) {
      const a = clamp((FORNOW_OUT_AT + 900 - e) / 900, 0, 1);
      const flash = clamp(1 - (e - FORNOW_AT) / 350, 0, 1);
      if (flash > 0) { g.fillStyle = `rgba(140,20,20,${0.55 * flash})`; g.fillRect(0, 0, FULL_W, VIEW_H); }
      g.globalAlpha = a; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.fillStyle = '#c9302a';
      g.fillText('FOR NOW...', FULL_W / 2, cy + 19);
      g.globalAlpha = 1;
    }
  }

  function render(now, dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'intro') { window.BossCutscene.draw(ctx, canvas.width, canvas.height, now - introStartedAt, 'multipod'); return; }
    if (gameState === 'nuke') { drawNukeScene(ctx, now - nukeStartedAt); return; }
    if (gameState === 'credits') { drawCredits(ctx, now - creditsStartedAt); return; }
    if (gameState === 'victory') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, FULL_W, VIEW_H); return; }
    if (gameState === 'military') { drawMilitaryScene(ctx, now - militaryStartedAt); return; }
    if (escape && (gameState === 'escape' || gameState === 'wiped')) { renderEscape(now, dt); return; }
    if (gameState === 'foot') {
      players.forEach((p, i) => {
        const vx = i * FOOT_VIEW_W;
        const halfW = FOOT_VIEW_W / 2 / FOOT_ZOOM, halfH = VIEW_H / 2 / FOOT_ZOOM;
        const camX = clamp(p.x, halfW, WORLD_W - halfW), camY = clamp(p.y - FOOT_CAM_LEAN, halfH, WORLD_H - halfH);
        drawViewWorld(vx, FOOT_VIEW_W, camX, camY, FOOT_ZOOM, now);
        ctx.save(); ctx.beginPath(); ctx.rect(vx, 0, FOOT_VIEW_W, VIEW_H); ctx.clip();
        drawHintOverFoot(vx, FOOT_VIEW_W, camX, camY, now);
        ctx.restore();
      });
      if (PLAYER_MODE === 2) { ctx.strokeStyle = '#2a3a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(FOOT_VIEW_W, 0); ctx.lineTo(FOOT_VIEW_W, VIEW_H); ctx.stroke(); }
      return;
    }
    // chase: the Multipod is pinned to the left edge of the screen the whole
    // time. The camera sits wherever puts the swarm against that edge, and
    // zooms out as needed (the swarm falling back after a hit, a car
    // pulling ahead, the two cars spreading apart) so the front car stays
    // on screen too.
    const alive = aliveCars();
    const focus = alive.length ? alive : cars;
    const frontX = Math.max(...focus.map((c) => c.x));
    const avgY = focus.reduce((s, c) => s + c.y, 0) / focus.length;
    const EDGE_INSET = 96, FRONT_MARGIN = 100;
    const span = Math.max(frontX - boss.x, 200);
    const wantZoom = clamp((FULL_W - EDGE_INSET - FRONT_MARGIN) / span, CHASE_ZOOM_MIN, CHASE_ZOOM_MAX);
    const k = Math.min(1, dt * 6);
    chaseZoom += (wantZoom - chaseZoom) * k;
    const halfH = VIEW_H / 2 / chaseZoom;
    const camX = boss.x + (FULL_W / 2 - EDGE_INSET) / chaseZoom;
    const camY = clamp((avgY + boss.y) / 2, halfH, WORLD_H - halfH);
    cam.x = camX; cam.y = camY;
    drawViewWorld(0, FULL_W, camX, camY, chaseZoom, now);
    drawForestDarkness(camX, camY, chaseZoom);
    if (gameState === 'chase') drawDangerVignette(now);
    drawBossHealthTag(camX, camY, chaseZoom);
    if (gameState === 'chase') {
      drawBossPointer(camX, camY, chaseZoom, now);
      const since = now - chaseStartedAt;
      if (since < 2200) drawBanner('THE MULTIPOD BREAKS OUT!', '#d88af0', clamp(1 - Math.max(0, since - 1500) / 700, 0, 1));
    }
    if (gameState === 'chase' || gameState === 'dying') { drawBossBar(now); drawFireBars(now); }
    drawDistance();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = (escape ? 'THEY CAUGHT YOU' : 'THE MULTIPOD RAN YOU DOWN') + ' &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'dying') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE MULTIPOD IS COMING APART&hellip;';
    } else if (gameState === 'victory') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE END';
    } else {
      messageEl.style.display = 'none';
    }
  }
  function updateHud() {
    if (hudBossEl) hudBossEl.textContent = gameState === 'foot' ? 'Multipod: asleep' : (boss.hp > 0 ? `Multipod: ${fmtHp(boss.hp)}/${BOSS_MAX_HEALTH} HP` : 'Multipod: destroyed');
    if (hudGapEl) hudGapEl.textContent = gameState === 'chase' ? `Gap: ${Math.round(gapNow() / TILE)} tiles` : (gameState === 'escape' && nearestChaser() ? `Nearest: ${Math.round(nearestChaser().d / TILE)} tiles` : 'Gap: --');
    if (hudSpeedEl) hudSpeedEl.textContent = `Speed: ${cars.map((c) => Math.round(Math.abs(c.v) / CAR_MAX * 180)).join(' / ')} mph`;
    if (hudPhaseEl) hudPhaseEl.textContent = { foot: 'On foot', chase: 'Chase', dying: 'Chase', escape: 'Escape', military: 'Escaped', nuke: 'Escaped', credits: 'Escaped', victory: 'Escaped', wiped: 'Crashed' }[gameState];
    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;
  function loop(now) {
    try {
      const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      if (gameState === 'foot') {
        elapsedMs = now - runStartTime;
        updateFoot(now, dt);
        updateEngineSound(0);
      } else if (gameState === 'chase') {
        elapsedMs = now - runStartTime;
        cars.forEach((c, i) => {
          if (!c.alive) return;
          const inp = inputFor(i);
          updateCar(c, inp, dt);
          if (inp.fire && now >= c.nextFireAt) fireMissile(c, now);
        });
        updateEngineSound(Math.abs(leadCar().v) / CAR_MAX);
        updateBoss(now, dt);
        if (gameState === 'chase') { updateMissiles(now, dt); updateThrown(now, dt); }
      } else if (gameState === 'intro') {
        updateEngineSound(0);
        if (now - introStartedAt >= window.BossCutscene.duration('multipod') || window.BossCutscene.skipRequested(introStartedAt)) beginChase(now);
      } else if (gameState === 'dying') {
        elapsedMs = now - runStartTime;
        updateDying(now, dt);
        updateMissiles(now, dt);
      } else if (gameState === 'escape') {
        elapsedMs = now - runStartTime;
        updateEscape(now, dt);
        updateEngineSound(0);
      } else if (gameState === 'military') {
        elapsedMs = now - runStartTime;
        updateMilitary(now, dt);
      } else if (gameState === 'nuke') {
        updateNuke(now);
      } else if (gameState === 'credits') {
        updateCredits(now);
      } else if (gameState === 'wiped') {
        updateEngineSound(0);
      }
      updateEffects(dt);
      render(now, dt);
      updateOverlay();
      updateHud();
    } catch (err) {
      console.error('desolate-apes: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
