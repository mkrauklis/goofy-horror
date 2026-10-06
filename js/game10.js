(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(10)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL10;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;
  // Chosen so the WHOLE arena fits on screen at once -- VISIBLE_HALF_W/H
  // both end up bigger than half the world, so the clamp() in
  // renderViewport's camera math collapses to a fixed center point instead
  // of following either player around.
  const ZOOM = 0.33;
  const VISIBLE_HALF_W = (VIEW_W / 2) / ZOOM;
  const VISIBLE_HALF_H = (VIEW_H / 2) / ZOOM;

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss: a giant armored knight, dark ruby and iron, with a sword
  // roughly twice its own body width long. Every attack speed below is
  // defined relative to PLAYER_SPEED, same convention as every monster
  // elsewhere in this game.
  const BOSS_RADIUS = 72;
  const SWORD_LENGTH = 150;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.2;
  const BOSS_NAME = 'THE LAST KNIGHT';

  // A short intro cutscene plays every time this level starts (first
  // load or any retry after a wipe) -- the camera zooms in on the boss
  // and shakes while its name shows, then play begins. The usual
  // BOSS_INTRO_GRACE_MS window is re-armed from the moment play actually
  // starts, not from when the cutscene began, so it still means
  // something once control is handed back.
  const BOSS_INTRO_CUTSCENE_MS = 3000;
  const BOSS_INTRO_ZOOM_MULT = 1.7;
  const BOSS_INTRO_SHAKE_MAG = 7;

  const BOSS_IDLE_SPEED = PLAYER_SPEED * 0.35;
  const BOSS_IDLE_MIN_MS = 700;
  // A grace window after the level first loads, before the boss's very
  // first attack -- gives players a moment to get oriented instead of
  // getting hit before they've even seen the room.
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_IDLE_MAX_MS = 1400;

  // Phase 2 kicks in at half health: the rubies turn blue and start
  // producing fire, and the whole boss moves 1.5x faster across every
  // attack below -- see speedMult().
  const PHASE2_HEALTH_THRESHOLD = 25;
  const PHASE2_SPEED_MULT = 1.5;

  // 1. Charge: one straight-line dash, sword pointed forward, 5x speed.
  const CHARGE_SPEED_BASE = PLAYER_SPEED * 5;
  const CHARGE_WINDUP_MS = 400;
  const CHARGE_MAX_DASH_MS = 1400;
  const CHARGE_RECOVER_MS = 500;

  // 2. Swordspin: the blade turns red hot and the boss slowly wanders the
  // arena while swinging it fast in a full circle around itself.
  const SWORDSPIN_DURATION_MS = 4500;
  const SWORD_ANGULAR_SPEED_BASE = 9; // radians/second -- a bit over one full spin/sec
  const SWORDSPIN_MOVE_SPEED_BASE = PLAYER_SPEED * 0.4;
  const SWORD_HIT_WIDTH = 26;

  // 3. Floor tiles: a burst of broken floor shot outward in every direction
  // at once, 3x speed, until each one hits a wall or leaves the arena.
  const FLOORTILES_COUNT = 14;
  const FLOORTILE_SPEED_BASE = PLAYER_SPEED * 3;
  const FLOORTILE_HIT_RADIUS = 16;

  // 4. Tentacle sweep: tentacles extend all the way out and slowly swing
  // around together, 1x speed at the tip -- ducking behind any wall
  // corner still blocks a tentacle dead, same as the Ashen One.
  const TENTACLESWEEP_DURATION_MS = 5000;
  const TENTACLE_COUNT = 6;
  const TENTACLE_REACH = 320;
  const TENTACLE_SWEEP_LINEAR_SPEED_BASE = PLAYER_SPEED * 1;
  const TENTACLE_HIT_WIDTH = 22;

  const ATTACKS_PER_STUN = 5;
  const STUN_DURATION_MS = 10000;

  // The dynamite sticks players use against the boss: up to DYNAMITE_LIVE_COUNT
  // sit on the map at once, respawning elsewhere the instant one goes off.
  const DYNAMITE_LIVE_COUNT = 3;
  const BOSS_MAX_HEALTH = 50;
  const DYNAMITE_DAMAGE_STUNNED = 3;
  const DYNAMITE_DAMAGE_NORMAL = 1;

  // Once the boss is down, it freezes solid where it fell -- icicles form
  // over this long before a blast of snow carries both of you off to the
  // next level.
  const FREEZE_CUTSCENE_MS = 4000;
  const ICICLE_COUNT = 7;
  const SNOW_COUNT = 90;

  const RADAR_DURATION_MS = 10000;
  // An energy bar grants infinite stamina (no sprint drain, instant
  // cure from exhausted) for this long -- same team-wide-buff
  // convention as radar/scanner/night vision, not tied to one player.
  const ENERGY_DURATION_MS = 10000;
  const SCANNER_DURATION_MS = 10000;
  const FREEZE_DURATION_MS = 10000;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const SMOKE_FUSE_MS = 3000;
  const SMOKE_DURATION_MS = 10000;
  const SMOKE_RADIUS = 70;
  const NVG_DURATION_MS = 10000;
  const NVG_RANGE_MULT = 2;
  const CRATE_ITEMS = ['radar', 'co2', 'scanner', 'smoke', 'nightvision', 'shotgun-ammo', 'energy'];
  const SHOTGUN_STUN_MS = 5000;
  const SHOTGUN_AMMO_MAX = 3;
  const SHOTGUN_RANGE = 70;

  // ---- sprint / stamina ----
  const DOUBLE_TAP_MS = 300;
  const STAMINA_MAX = 15;
  const SPRINT_SPEED_MULT = 2;
  const EXHAUSTED_SPEED_MULT = 0.5;
  const SPRINT_DRAIN_RATE = STAMINA_MAX / 15;
  const EXHAUSTED_MS = 5000;
  const EXHAUSTED_REGEN_RATE = (STAMINA_MAX / 2) / (EXHAUSTED_MS / 1000);
  const NORMAL_REGEN_RATE = EXHAUSTED_REGEN_RATE / 2;
  const WALK_CYCLE_SPEED = 9;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');
  const hudBossEl = document.getElementById('hud-boss');
  const hudDoorEl = document.getElementById('hud-door');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  const exploredCanvas = document.createElement('canvas');
  exploredCanvas.width = COLS;
  exploredCanvas.height = ROWS;
  const exploredCtx = exploredCanvas.getContext('2d');
  let explored = new Uint8Array(COLS * ROWS);
  const EXPLORE_RADIUS = 7;
  const MINIMAP_W = 90;

  // ---- procedural audio (no asset files) ----
  const MUSIC_KEY = 'goofy-horror-level10-music';
  let audioCtx = null;
  let musicMasterGain = null;
  let musicEnabled = localStorage.getItem(MUSIC_KEY) === '1';
  let ambientGain = null;
  let ambientSubOsc = null;
  let ambientMidGain = null;
  let bossMusicGain = null;
  let bossBassFilter = null;
  let bossBassGain = null;
  let bossLeadGain = null;
  let bossNoiseBuffer = null;
  let bossStep = 0;
  let bossPulseTimer = null;

  function ensureAudio() {
    if (audioCtx) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioCtx = new AudioCtor();

    musicMasterGain = audioCtx.createGain();
    musicMasterGain.gain.value = musicEnabled ? 1 : 0;
    musicMasterGain.connect(audioCtx.destination);

    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.05;
    ambientGain.connect(musicMasterGain);

    const ambientFilter = audioCtx.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = 340;
    ambientFilter.Q.value = 0.6;
    ambientFilter.connect(ambientGain);

    const filterLfo = audioCtx.createOscillator();
    filterLfo.frequency.value = 0.07;
    const filterLfoGain = audioCtx.createGain();
    filterLfoGain.gain.value = 90;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(ambientFilter.frequency);
    filterLfo.start();

    function addDroneVoice(freq, type, gainValue, vibratoRate, vibratoDepth) {
      const osc = audioCtx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = audioCtx.createGain();
      gain.gain.value = gainValue;
      const vibrato = audioCtx.createOscillator();
      vibrato.frequency.value = vibratoRate;
      const vibratoGain = audioCtx.createGain();
      vibratoGain.gain.value = vibratoDepth;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();
      osc.connect(gain);
      gain.connect(ambientFilter);
      osc.start();
      return { osc, gain };
    }

    ambientSubOsc = addDroneVoice(41.2, 'sine', 0.6, 0.05, 1.5).osc;
    addDroneVoice(43.7, 'sine', 0.5, 0.08, 2);
    addDroneVoice(20.6, 'sine', 0.4, 0.03, 0.8);
    ambientMidGain = addDroneVoice(97, 'sawtooth', 0, 0.15, 6).gain;
    addDroneVoice(660, 'triangle', 0.05, 0.02, 40);

    bossMusicGain = audioCtx.createGain();
    bossMusicGain.gain.value = 0.55;
    bossMusicGain.connect(musicMasterGain);

    bossBassFilter = audioCtx.createBiquadFilter();
    bossBassFilter.type = 'lowpass';
    bossBassFilter.frequency.value = 900;
    bossBassFilter.Q.value = 0.7;
    bossBassGain = audioCtx.createGain();
    bossBassGain.gain.value = 1;
    bossBassFilter.connect(bossBassGain);
    bossBassGain.connect(bossMusicGain);

    bossLeadGain = audioCtx.createGain();
    bossLeadGain.gain.value = 1;
    bossLeadGain.connect(bossMusicGain);

    bossNoiseBuffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.08), audioCtx.sampleRate);
    const noiseData = bossNoiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

    bossStep = 0;
    scheduleBossStep();
  }

  // A different key, a different shape, and a galloping kick pattern
  // instead of Level 5's -- a marching, regal theme for a knight rather
  // than that one's frantic fire-demon riff.
  const BOSS_NOTE = { D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81, D3: 146.83, F3: 174.61, G3: 196.0 };
  const BOSS_BASS_RIFF = [
    BOSS_NOTE.D2, 0, BOSS_NOTE.F2, 0, BOSS_NOTE.G2, 0, BOSS_NOTE.D2, 0,
    BOSS_NOTE.A2, 0, BOSS_NOTE.G2, 0, BOSS_NOTE.F2, 0, BOSS_NOTE.D2, 0,
  ];
  const BOSS_LEAD_PHRASE = [BOSS_NOTE.D3, BOSS_NOTE.F3, BOSS_NOTE.G3, BOSS_NOTE.F3, BOSS_NOTE.D3, BOSS_NOTE.C3, BOSS_NOTE.Bb2, BOSS_NOTE.A2];

  function playBossBassNote(freq, t, dur, peak) {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(bossBassFilter);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playBossLeadNote(freq, t, dur, peak) {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    env.connect(bossLeadGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playBossKick(t) {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(env);
    env.connect(bossBassGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  function playBossHat(t, peak) {
    const src = audioCtx.createBufferSource();
    src.buffer = bossNoiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(peak, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(filter);
    filter.connect(env);
    env.connect(bossLeadGain);
    src.start(t);
  }

  function scheduleBossStep() {
    if (!audioCtx || !bossBassGain) return;
    if (boss.defeated) { bossPulseTimer = null; return; }

    const healthFrac = bossHealthFrac();
    const bpm = 84 + (1 - healthFrac) * 40;
    const stepDur = 60 / bpm / 4;
    const t = audioCtx.currentTime;
    const i = bossStep % 16;
    const bar = Math.floor(bossStep / 16) % 2;

    const bassNote = BOSS_BASS_RIFF[i];
    if (bassNote) playBossBassNote(bassNote, t, stepDur * 1.8, 0.18 + (1 - healthFrac) * 0.07);
    if (i === 0 || i === 6 || i === 8 || i === 12) playBossKick(t);
    if (i % 2 === 1) playBossHat(t, 0.04 + (1 - healthFrac) * 0.02);

    if (bar === 1 && i < 8) {
      playBossLeadNote(BOSS_LEAD_PHRASE[i], t + stepDur * 0.15, stepDur * 1.6, 0.07);
    }

    bossStep++;
    bossPulseTimer = setTimeout(scheduleBossStep, stepDur * 1000);
  }

  function playTone(freq, duration, type, peakGain, delay) {
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
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function playBombBlast() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, start);
    osc.frequency.exponentialRampToValueAtTime(30, start + 0.35);
    gain.gain.setValueAtTime(0.32, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  }

  function playItemChime(freq) {
    playTone(freq, 0.25, 'square', 0.18);
  }

  function playDoorUnlockChime() {
    playTone(440, 0.2, 'triangle', 0.22, 0);
    playTone(660, 0.2, 'triangle', 0.22, 0.12);
    playTone(880, 0.3, 'triangle', 0.22, 0.24);
  }

  function playCatchSting() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, start);
    osc.frequency.exponentialRampToValueAtTime(50, start + 0.45);
    gain.gain.setValueAtTime(0.28, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  }

  function playChompThud(delay) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(90, start);
    osc.frequency.exponentialRampToValueAtTime(40, start + 0.18);
    gain.gain.setValueAtTime(0.35, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  }

  function playShotgunBlast() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(1800, start);
    crack.frequency.exponentialRampToValueAtTime(200, start + 0.08);
    crackGain.gain.setValueAtTime(0.3, start);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(start);
    crack.stop(start + 0.12);
    playChompThud(0.02);
  }

  function playBossWindup() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(70, start);
    osc.frequency.exponentialRampToValueAtTime(200, start + 0.4);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, start);
    filter.frequency.exponentialRampToValueAtTime(1400, start + 0.4);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.28, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  }

  function playBossStunned() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, start);
    osc.frequency.exponentialRampToValueAtTime(90, start + 0.6);
    const vibrato = audioCtx.createOscillator();
    vibrato.frequency.value = 11;
    const vibratoGain = audioCtx.createGain();
    vibratoGain.gain.value = 25;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(start);
    vibrato.stop(start + 0.6);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.26, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.7);
  }

  // Marks a phase transformation -- a stuttering two-tone flicker, the same
  // cue Level 5's blink warning used, repurposed here for "it just changed."
  function playPhaseShift() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    for (let i = 0; i < 8; i++) {
      const t = start + i * 0.09;
      const osc = audioCtx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = i % 2 === 0 ? 220 : 880;
      const env = audioCtx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.16, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(env);
      env.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  function playTentacleStrike() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, start);
    osc.frequency.exponentialRampToValueAtTime(80, start + 0.12);
    gain.gain.setValueAtTime(0.32, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }

  // A heavy ringing clang -- the sword striking the ground on a charge's
  // recovery beat, distinct from every blast/chime cue above.
  function playSwordClang() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, start);
    osc.frequency.exponentialRampToValueAtTime(300, start + 0.3);
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  }

  function playWinJingle() {
    [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14));
  }

  // A sharp, glassy crack -- ice forming fast over the boss's armor as the
  // freeze cutscene starts.
  function playIceCrack() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = start + i * 0.12;
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600 - i * 200, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.25);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(env);
      env.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    }
  }

  // A rising, airy wind howl for the blast of snow that carries both
  // players off at the end of the freeze cutscene.
  function playSnowGust() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const dur = FREEZE_CUTSCENE_MS / 1000;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, start);
    osc.frequency.linearRampToValueAtTime(220, start + dur);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, start);
    filter.frequency.linearRampToValueAtTime(2200, start + dur);
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.3, start + dur - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur + 0.1);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.2);
  }

  function updateAmbientTension() {
    if (!audioCtx) return;
    const minDist = Math.min(...players.map((p) => Math.hypot(p.x - boss.x, p.y - boss.y)));
    const proximity = clamp(1 - minDist / 420, 0, 1);
    ambientGain.gain.setTargetAtTime(0.05 + proximity * 0.18, audioCtx.currentTime, 0.3);
    ambientSubOsc.frequency.setTargetAtTime(41.2 + proximity * 12, audioCtx.currentTime, 0.3);
    ambientMidGain.gain.setTargetAtTime(proximity * 0.06, audioCtx.currentTime, 0.4);
  }

  function setMusicEnabled(on) {
    musicEnabled = on;
    localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
    ensureAudio();
    if (audioCtx && musicMasterGain) {
      musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
    }
  }

  const soundHintEl = document.getElementById('sound-hint');
  function updateSoundHint() {
    if (soundHintEl) soundHintEl.style.display = musicEnabled ? '' : 'none';
  }
  updateSoundHint();

  const musicToggleEl = document.getElementById('music-toggle');
  if (musicToggleEl) {
    musicToggleEl.textContent = musicEnabled ? '♪ Music: On' : '♪ Music: Off';
    musicToggleEl.classList.toggle('muted', !musicEnabled);
    musicToggleEl.addEventListener('click', () => {
      setMusicEnabled(!musicEnabled);
      musicToggleEl.textContent = musicEnabled ? '♪ Music: On' : '♪ Music: Off';
      musicToggleEl.classList.toggle('muted', !musicEnabled);
      updateSoundHint();
    });
  }
  updateSoundHint();

  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const keys = {};

  const lastTapTime = [{}, {}];
  function handleMovementKeyPress(key, now) {
    const playerIndex = (key === 'w' || key === 'a' || key === 's' || key === 'd') ? 0 : 1;
    const last = lastTapTime[playerIndex][key] || 0;
    if (now - last < DOUBLE_TAP_MS) {
      const p = players[playerIndex];
      if (p.moveState !== 'exhausted' && p.stamina > 0) {
        p.sprintActive = true;
      }
    }
    lastTapTime[playerIndex][key] = now;
  }

  window.addEventListener('keydown', (e) => {
    ensureAudio();
    if (TRACKED_KEYS.has(e.key)) {
      if (!keys[e.key]) handleMovementKeyPress(e.key, performance.now());
      keys[e.key] = true;
      e.preventDefault();
    }
    if (e.key === 'Enter' && gameState === 'wiped') {
      resetLevel();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });

  function clamp(v, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.max(min, Math.min(max, v));
  }

  function worldToTile(x, y) {
    return { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
  }

  function tileChar(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return LEVEL.grid[ty][tx];
  }

  function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  const FLOOR_SHADES = ['#4c4c53', '#525258', '#58585f', '#5e5e66', '#54545c', '#605f68'];
  function floorShade(x, y) {
    const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % FLOOR_SHADES.length;
    return FLOOR_SHADES[idx];
  }

  const DIRT_SHADES = ['#5a4127', '#63482b', '#4e3a22', '#6b4f30'];
  function dirtShade(x, y) {
    const h = Math.imul(x + 91, 374761393) ^ Math.imul(y - 17, 668265263);
    const idx = ((h ^ (h >>> 13)) >>> 0) % DIRT_SHADES.length;
    return DIRT_SHADES[idx];
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clampC = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clampC(((n >> 16) & 255) + 255 * amt);
    const g2 = clampC(((n >> 8) & 255) + 255 * amt);
    const b = clampC((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  function drawTaperedTentacle(g, tx, ty, midX, midY, baseWidth, color) {
    const segs = 4;
    let prevX = 0, prevY = 0;
    for (let s = 1; s <= segs; s++) {
      const tt = s / segs;
      const it = 1 - tt;
      const x = 2 * it * tt * midX + tt * tt * tx;
      const y = 2 * it * tt * midY + tt * tt * ty;
      g.beginPath();
      g.moveTo(prevX, prevY);
      g.lineTo(x, y);
      g.strokeStyle = color;
      g.lineWidth = Math.max(0.6, baseWidth * (1 - tt * 0.75));
      g.lineCap = 'round';
      g.stroke();
      prevX = x; prevY = y;
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    [0.55, 0.82].forEach((s) => {
      const it = 1 - s;
      const x = 2 * it * s * midX + s * s * tx;
      const y = 2 * it * s * midY + s * s * ty;
      g.beginPath();
      g.arc(x, y, baseWidth * 0.16, 0, Math.PI * 2);
      g.fill();
    });
  }

  // ---- game state ----
  const BEST_TIME_KEY = 'goofy-horror-best-level10';
  let bestMs = (() => {
    const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(v) ? v : null;
  })();
  let runStartTime = performance.now();
  let elapsedMs = 0;
  let bestRecorded = false;
  let freezeFinished = false;

  function formatTime(ms) {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }

  const DYNAMITE_MIN_PLAYER_DIST = 100;
  const DYNAMITE_MIN_PLAYER_DIST_LOW = 55;
  let dynamiteSticks = []; // DYNAMITE_LIVE_COUNT live at once: [{x, y, seed}]
  let bossHealth = BOSS_MAX_HEALTH;
  let doorUnlocked = false;
  let gameState = 'intro'; // 'intro' | 'playing' | 'freezing' | 'wiped'
  let introStartedAt = 0;
  let catchFlash = 0;

  function bossHealthFrac() {
    return clamp(bossHealth / BOSS_MAX_HEALTH, 0, 1);
  }

  function speedMult() {
    return boss.phase2 ? PHASE2_SPEED_MULT : 1;
  }

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
      shotgunAmmo: 0,
    };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  // The boss: one giant armored knight. A single object, same as Level 5's
  // boss -- there's only ever one, so no need for the multi-monster array
  // machinery the other levels use.
  function makeBoss() {
    return {
      x: 0,
      y: 0,
      radius: BOSS_RADIUS,
      seed: Math.random() * 100,
      lookDir: { x: 1, y: 0 },
      defeated: false,
      phase2: false,

      frozenUntil: 0,

      // ---- attack cycle ----
      // 'idle' | 'charge' | 'swordspin' | 'floortiles' | 'tentaclesweep' | 'stunned'
      phase: 'idle',
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      attackCount: 0,
      lastAttack: null,

      chargeDir: { x: 1, y: 0 },
      chargeSubPhase: 'windup', // 'windup' | 'dash' | 'recover'
      chargeSubStartedAt: 0,

      swordAngle: 0,
      swordSpinUntil: 0,
      wanderDir: { x: 1, y: 0 },
      wanderChangeAt: 0,

      tentacleAngles: [],
      sweepRotation: 0,
      sweepUntil: 0,
      tentacleReaches: [],
    };
  }

  const boss = makeBoss();
  let floorTiles = []; // floortiles attack: [{x, y, dirX, dirY}]
  let snowParticles = []; // the freeze cutscene's blowing snow: [{x, y, vx, vy, size, drift}]
  let freezeStartedAt = 0;

  const OPEN_FLOOR_TILES = (() => {
    const list = [];
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const ch = LEVEL.grid[y][x];
        if (ch === '.' || ch === 'T') list.push({ x, y });
      }
    }
    return list;
  })();

  function spawnDynamite() {
    const minDist = DYNAMITE_MIN_PLAYER_DIST_LOW + bossHealthFrac() * (DYNAMITE_MIN_PLAYER_DIST - DYNAMITE_MIN_PLAYER_DIST_LOW);
    for (let tries = 0; tries < 30; tries++) {
      const t = OPEN_FLOOR_TILES[Math.floor(Math.random() * OPEN_FLOOR_TILES.length)];
      const c = tileCenter(t.x, t.y);
      if (players.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < minDist)) continue;
      dynamiteSticks.push({ x: c.x, y: c.y, seed: Math.random() * 1000 });
      return;
    }
  }

  let crates = [];
  let radarUntil = 0;
  let energyUntil = 0;
  let scannerUntil = 0;
  let smokeBombs = [];
  let nvgUntil = 0;
  let floatingTexts = [];

  function respawnPlayer(p) {
    const c = tileCenter(p.spawn.x, p.spawn.y);
    p.x = c.x; p.y = c.y; p.facing = { x: 0, y: 1 };
  }

  function resetLevel() {
    players.forEach((p) => {
      respawnPlayer(p);
      p.caught = false;
      p.caughtAt = 0;
      p.invulnerableUntil = 0;
      p.stamina = STAMINA_MAX;
      p.moveState = 'normal';
      p.exhaustedUntil = 0;
      p.sprintActive = false;
      p.shotgunAmmo = 0;
    });

    const spawn = LEVEL.monsterSpawns[0];
    const m = tileCenter(spawn.x, spawn.y);
    boss.x = m.x; boss.y = m.y;
    boss.frozenUntil = 0;
    boss.defeated = false;
    boss.phase2 = false;
    boss.phase = 'idle'; boss.phaseStartedAt = 0; boss.nextIdleUntil = performance.now() + BOSS_INTRO_GRACE_MS;
    boss.attackCount = 0; boss.lastAttack = null;
    boss.sweepRotation = 0; boss.swordAngle = 0;
    floorTiles = [];
    snowParticles = [];
    freezeStartedAt = 0;

    bossHealth = BOSS_MAX_HEALTH;
    dynamiteSticks = [];
    for (let i = 0; i < DYNAMITE_LIVE_COUNT; i++) spawnDynamite();
    doorUnlocked = false;

    if (audioCtx && bossPulseTimer === null) { bossStep = 0; scheduleBossStep(); }

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)],
      opened: false, openedAt: 0,
    }));
    radarUntil = 0;
    energyUntil = 0;
    scannerUntil = 0;
    smokeBombs = [];
    nvgUntil = 0;
    floatingTexts = [];
    resetExploration();
    gameState = 'intro';
    introStartedAt = performance.now();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
    freezeFinished = false;
  }
  resetLevel();

  // ---- player movement & collision ----
  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#') return true;
    if (ch === 'D') return !doorUnlocked;
    return false;
  }

  function isHidden(p, now) {
    return smokeBombs.some((b) => b.exploded && now < b.endsAt && Math.hypot(p.x - b.x, p.y - b.y) < SMOKE_RADIUS);
  }

  function canStandAt(x, y) {
    const r = PLAYER_RADIUS;
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return !isWallForPlayer(t.x, t.y);
    });
  }

  function movePlayer(p, dx, dy) {
    if (dx !== 0 && canStandAt(p.x + dx, p.y)) p.x += dx;
    if (dy !== 0 && canStandAt(p.x, p.y + dy)) p.y += dy;
  }

  function updateStamina(p, now, dt, isMoving) {
    if (now < energyUntil) {
      p.moveState = (p.sprintActive && isMoving) ? 'sprinting' : 'normal';
      p.stamina = STAMINA_MAX;
      if (!isMoving) p.sprintActive = false;
      return;
    }
    if (p.moveState === 'exhausted') {
      p.stamina = Math.min(STAMINA_MAX, p.stamina + EXHAUSTED_REGEN_RATE * dt);
      if (now >= p.exhaustedUntil) p.moveState = 'normal';
      return;
    }
    if (p.sprintActive && isMoving && p.stamina > 0) {
      p.moveState = 'sprinting';
      p.stamina = Math.max(0, p.stamina - SPRINT_DRAIN_RATE * dt);
      if (p.stamina <= 0) {
        p.moveState = 'exhausted';
        p.exhaustedUntil = now + EXHAUSTED_MS;
        p.sprintActive = false;
      }
    } else {
      p.moveState = 'normal';
      if (!isMoving) p.sprintActive = false;
      p.stamina = Math.min(STAMINA_MAX, p.stamina + NORMAL_REGEN_RATE * dt);
    }
  }

  function speedMultiplierFor(p) {
    if (p.moveState === 'exhausted') return EXHAUSTED_SPEED_MULT;
    if (p.moveState === 'sprinting') return SPRINT_SPEED_MULT;
    return 1;
  }

  function applyMovement(p, ix, iy, dt) {
    if (p.caught) return;
    if (ix === 0 && iy === 0) return;
    const len = Math.hypot(ix, iy);
    const nx = ix / len, ny = iy / len;
    p.facing = { x: nx, y: ny };
    const speed = PLAYER_SPEED * speedMultiplierFor(p);
    movePlayer(p, nx * speed * dt, ny * speed * dt);
  }

  function updatePlayerMovement(p, ix, iy, now, dt) {
    const isMoving = !p.caught && (ix !== 0 || iy !== 0);
    updateStamina(p, now, dt, isMoving);
    applyMovement(p, ix, iy, dt);
    if (isMoving) p.walkPhase += dt * WALK_CYCLE_SPEED * speedMultiplierFor(p);
  }

  function updateInputMovement(now, dt) {
    updatePlayerMovement(players[0], (keys.d ? 1 : 0) - (keys.a ? 1 : 0), (keys.s ? 1 : 0) - (keys.w ? 1 : 0), now, dt);
    updatePlayerMovement(players[1], (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0), now, dt);
  }

  function resetExploration() {
    explored = new Uint8Array(COLS * ROWS);
    exploredCtx.clearRect(0, 0, COLS, ROWS);
  }

  function minimapColorFor(ch) {
    if (ch === '#') return '#8f8f9a';
    if (ch === 'D') return '#d9ac4a';
    if (ch === 'T') return '#5a4127';
    return '#3c3c46';
  }

  function updateExploration() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      for (let dy = -EXPLORE_RADIUS; dy <= EXPLORE_RADIUS; dy++) {
        const ty = t.y + dy;
        if (ty < 0 || ty >= ROWS) continue;
        for (let dx = -EXPLORE_RADIUS; dx <= EXPLORE_RADIUS; dx++) {
          const tx = t.x + dx;
          if (tx < 0 || tx >= COLS) continue;
          if (dx * dx + dy * dy > EXPLORE_RADIUS * EXPLORE_RADIUS) continue;
          const idx = ty * COLS + tx;
          if (explored[idx]) continue;
          explored[idx] = 1;
          exploredCtx.fillStyle = minimapColorFor(LEVEL.grid[ty][tx]);
          exploredCtx.fillRect(tx, ty, 1, 1);
        }
      }
    });
  }

  function drawMinimap(vx, now) {
    const mh = Math.round(MINIMAP_W * ROWS / COLS);
    const mx = vx + 8, my = 8;
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.65)';
    ctx.fillRect(mx - 3, my - 3, MINIMAP_W + 6, mh + 6);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(exploredCanvas, mx, my, MINIMAP_W, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, my + 0.5, MINIMAP_W - 1, mh - 1);
    players.forEach((pl) => {
      const px = mx + (pl.x / WORLD_W) * MINIMAP_W;
      const py = my + (pl.y / WORLD_H) * mh;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pl.color;
      ctx.fill();
    });
    if (!boss.defeated) {
      const pulse = 0.6 + 0.4 * Math.sin(now / 180);
      dynamiteSticks.forEach((d) => {
        const dmx = mx + (d.x / WORLD_W) * MINIMAP_W;
        const dmy = my + (d.y / WORLD_H) * mh;
        ctx.beginPath();
        ctx.arc(dmx, dmy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,80,${pulse})`;
        ctx.shadowColor = '#ffcf6a';
        ctx.shadowBlur = 4;
        ctx.fill();
      });
    }

    const bx = mx + (boss.x / WORLD_W) * MINIMAP_W;
    const by = my + (boss.y / WORLD_H) * mh;
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = boss.phase2 ? '#4ab0ff' : '#ff5a2a';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
    return mh;
  }

  function drawStaminaBar(vx, p, minimapH) {
    const barW = MINIMAP_W, barH = 7;
    const bx = vx + 8, by = 8 + minimapH + 8;
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.65)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#202225';
    ctx.fillRect(bx, by, barW, barH);
    const frac = clamp(p.stamina / STAMINA_MAX, 0, 1);
    const color = performance.now() < energyUntil ? '#ffe27a'
      : p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, barW * frac, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
  }

  function drawBossHealthBar(vx, now) {
    const barW = 210;
    const barH = 10;
    const bx = vx + (VIEW_W - barW) / 2;
    const by = 12;
    const frac = bossHealthFrac();

    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.7)';
    ctx.fillRect(bx - 6, by - 16, barW + 12, barH + 22);

    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase === 'stunned' ? '#8fd6ff' : boss.phase2 ? '#6ac8ff' : '#e8b06a';
    const label = boss.defeated ? 'BOSS — DEFEATED' : boss.phase === 'stunned'
      ? `BOSS — STUNNED (${bossHealth}/${BOSS_MAX_HEALTH})` : `BOSS (${bossHealth}/${BOSS_MAX_HEALTH})${boss.phase2 ? ' — PHASE 2' : ''}`;
    ctx.fillText(label, bx + barW / 2, by - 4);

    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by, barW, barH);

    if (boss.defeated) {
      ctx.fillStyle = '#4a4640';
      ctx.fillRect(bx, by, barW * frac, barH);
    } else {
      const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
      if (boss.phase2) {
        grad.addColorStop(0, '#6ac8ff');
        grad.addColorStop(0.5, '#2a6bd6');
        grad.addColorStop(1, '#173a7a');
      } else {
        grad.addColorStop(0, '#ff5a6a');
        grad.addColorStop(0.5, '#b01c2a');
        grad.addColorStop(1, '#5a0f16');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, barW * frac, barH);

      if (frac > 0 && frac < 0.3) {
        const flicker = 0.5 + 0.5 * Math.sin(now / 120);
        ctx.fillStyle = `rgba(255,255,255,${0.14 * flicker})`;
        ctx.fillRect(bx, by, barW * frac, barH);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
    ctx.restore();
  }

  function spawnFloatingText(x, y, text) {
    floatingTexts.push({ x, y, text, life: 0, maxLife: 1.4 });
  }

  function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      floatingTexts[i].life += dt;
      if (floatingTexts[i].life >= floatingTexts[i].maxLife) floatingTexts.splice(i, 1);
    }
  }

  function nearestUnpressedButton(x, y) {
    if (boss.defeated || dynamiteSticks.length === 0) return null;
    let best = null, bestD = Infinity;
    dynamiteSticks.forEach((d) => {
      const dist = Math.hypot(x - d.x, y - d.y);
      if (dist < bestD) { bestD = dist; best = d; }
    });
    return best;
  }

  function applyItemEffect(item, x, y, now, p) {
    if (item === 'radar') {
      radarUntil = now + RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'RADAR');
      playItemChime(880);
    } else if (item === 'co2') {
      boss.frozenUntil = now + FREEZE_DURATION_MS;
      spawnFloatingText(x, y, 'FROZEN');
      playItemChime(1200);
    } else if (item === 'scanner') {
      scannerUntil = now + SCANNER_DURATION_MS;
      spawnFloatingText(x, y, 'SCANNER');
      playItemChime(660);
    } else if (item === 'smoke') {
      smokeBombs.push({ x, y, armAt: now + SMOKE_FUSE_MS, exploded: false, endsAt: 0 });
      spawnFloatingText(x, y, 'SMOKE BOMB');
      playItemChime(500);
    } else if (item === 'nightvision') {
      nvgUntil = now + NVG_DURATION_MS;
      spawnFloatingText(x, y, 'NIGHT VISION');
      playItemChime(1000);
    } else if (item === 'shotgun-ammo') {
      // Capped at SHOTGUN_AMMO_MAX -- each shell in stock triggers its own
      // automatic stun the next time something gets close, one at a time.
      if (p.shotgunAmmo < SHOTGUN_AMMO_MAX) {
        p.shotgunAmmo++;
        spawnFloatingText(x, y, `SHOTGUN LOADED (${p.shotgunAmmo}/${SHOTGUN_AMMO_MAX})`);
        playItemChime(760);
      } else {
        spawnFloatingText(x, y, 'AMMO FULL');
      }
    } else if (item === 'energy') {
      energyUntil = now + ENERGY_DURATION_MS;
      spawnFloatingText(x, y, 'ENERGY');
      playItemChime(900);
    }
  }

  function updateSmokeBombs(now) {
    smokeBombs.forEach((b) => {
      if (b.exploded || now < b.armAt) return;
      b.exploded = true;
      b.endsAt = now + SMOKE_DURATION_MS;
      playItemChime(180);
    });
    smokeBombs = smokeBombs.filter((b) => !b.exploded || now < b.endsAt);
  }

  function drawSmokeBombs(g, now) {
    smokeBombs.forEach((b) => {
      if (!b.exploded) {
        const t = clamp(1 - (b.armAt - now) / SMOKE_FUSE_MS, 0, 1);
        g.beginPath();
        g.arc(b.x, b.y, 5 + t * 4, 0, Math.PI * 2);
        g.fillStyle = 'rgba(200,200,200,0.6)';
        g.fill();
        return;
      }
      const life = clamp((b.endsAt - now) / SMOKE_DURATION_MS, 0, 1);
      const elapsed = SMOKE_DURATION_MS - (b.endsAt - now);
      const radius = SMOKE_RADIUS * Math.min(1, Math.max(0, elapsed) / 800);
      g.beginPath();
      g.arc(b.x, b.y, radius, 0, Math.PI * 2);
      g.fillStyle = `rgba(210,210,220,${0.32 * life})`;
      g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.25 * life})`;
      g.lineWidth = 2;
      g.stroke();
    });
  }

  function updateCrates(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      crates.forEach((c) => {
        if (c.x !== t.x || c.y !== t.y) return;
        if (!c.opened) {
          c.opened = true;
          c.openedAt = now;
          applyItemEffect(c.item, tileCenter(c.x, c.y).x, tileCenter(c.x, c.y).y, now, p);
        }
      });
    });
    crates.forEach((c) => {
      if (c.opened && now - c.openedAt >= CRATE_RESPAWN_MS) {
        c.opened = false;
        c.item = CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)];
      }
    });
  }

  // Walking onto a dynamite stick sets it off against the boss immediately.
  // Up to DYNAMITE_LIVE_COUNT are live at once; a fresh one spawns elsewhere
  // the instant one goes off, until the boss is out of health. The damage
  // depends on whether it's stunned right now.
  function updateDynamite(now) {
    if (boss.defeated) return;
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      for (let i = dynamiteSticks.length - 1; i >= 0; i--) {
        const d = dynamiteSticks[i];
        const dt_ = worldToTile(d.x, d.y);
        if (dt_.x !== t.x || dt_.y !== t.y) continue;
        dynamiteSticks.splice(i, 1);
        const stunned = boss.phase === 'stunned';
        const dmg = stunned ? DYNAMITE_DAMAGE_STUNNED : DYNAMITE_DAMAGE_NORMAL;
        bossHealth = Math.max(0, bossHealth - dmg);
        spawnFloatingText(d.x, d.y, stunned ? `BOOM! -${DYNAMITE_DAMAGE_STUNNED}` : `boom -${DYNAMITE_DAMAGE_NORMAL}`);
        playBombBlast();

        if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) {
          boss.phase2 = true;
          spawnFloatingText(boss.x, boss.y, 'PHASE 2');
          playPhaseShift();
        }

        if (bossHealth <= 0) {
          boss.defeated = true;
          doorUnlocked = true;
          gameState = 'freezing';
          freezeStartedAt = now;
          spawnSnow();
          playIceCrack();
          playSnowGust();
        } else {
          spawnDynamite();
        }
      }
    });
  }

  // ---- boss AI ----
  // A boss-sized version of the player's canStandAt.
  function canBossStandAt(x, y) {
    const r = boss.radius * 0.7;
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return !isWallForPlayer(t.x, t.y);
    });
  }

  const ALL_ATTACKS = ['charge', 'swordspin', 'floortiles', 'tentaclesweep'];

  function nearestPlayer(x, y) {
    return players.reduce((a, b) => (Math.hypot(x - a.x, y - a.y) <= Math.hypot(x - b.x, y - b.y) ? a : b));
  }

  // Every ATTACKS_PER_STUN'th attack, the boss keels over stunned instead
  // of picking the next one -- the window a dynamite hit actually costs it
  // real health (3 points instead of 1).
  function finishAttack(now) {
    boss.attackCount++;
    if (boss.attackCount % ATTACKS_PER_STUN === 0) {
      boss.phase = 'stunned';
      boss.phaseStartedAt = now;
      playBossStunned();
    } else {
      boss.phase = 'idle';
      boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
    }
  }

  function pickAttack() {
    const choices = ALL_ATTACKS.filter((a) => a !== boss.lastAttack);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function startChargeDash(now) {
    const target = nearestPlayer(boss.x, boss.y);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy) || 1;
    boss.chargeDir = { x: dx / d, y: dy / d };
    boss.lookDir = boss.chargeDir;
    boss.chargeSubPhase = 'windup';
    boss.chargeSubStartedAt = now;
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'charge') {
      startChargeDash(now);
      playBossWindup();
    } else if (kind === 'swordspin') {
      boss.swordAngle = 0;
      boss.swordSpinUntil = now + SWORDSPIN_DURATION_MS;
      const a = Math.random() * Math.PI * 2;
      boss.wanderDir = { x: Math.cos(a), y: Math.sin(a) };
      boss.wanderChangeAt = now + 600 + Math.random() * 500;
      playBossWindup();
    } else if (kind === 'floortiles') {
      floorTiles = [];
      for (let i = 0; i < FLOORTILES_COUNT; i++) {
        const a = (i / FLOORTILES_COUNT) * Math.PI * 2 + Math.random() * 0.2;
        floorTiles.push({ x: boss.x, y: boss.y, dirX: Math.cos(a), dirY: Math.sin(a) });
      }
      playBossWindup();
    } else if (kind === 'tentaclesweep') {
      boss.tentacleAngles = Array.from({ length: TENTACLE_COUNT }, (_, i) => (i / TENTACLE_COUNT) * Math.PI * 2);
      boss.sweepRotation = 0;
      boss.sweepUntil = now + TENTACLESWEEP_DURATION_MS;
      boss.tentacleReaches = boss.tentacleAngles.map(() => TENTACLE_REACH);
      playBossWindup();
    }
  }

  function updateBossIdle(now, dt) {
    if (now >= boss.nextIdleUntil) {
      startAttack(pickAttack(), now);
      return;
    }
    const target = nearestPlayer(boss.x, boss.y);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const step = BOSS_IDLE_SPEED * speedMult() * dt;
    const nx = boss.x + (dx / d) * step, ny = boss.y + (dy / d) * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx;
    if (canBossStandAt(boss.x, ny)) boss.y = ny;
    boss.lookDir = { x: dx / d, y: dy / d };
  }

  function updateBossCharge(now, dt) {
    const elapsed = now - boss.chargeSubStartedAt;
    if (boss.chargeSubPhase === 'windup') {
      if (elapsed >= CHARGE_WINDUP_MS) { boss.chargeSubPhase = 'dash'; boss.chargeSubStartedAt = now; }
      return;
    }
    if (boss.chargeSubPhase === 'dash') {
      const step = CHARGE_SPEED_BASE * speedMult() * dt;
      const nx = boss.x + boss.chargeDir.x * step;
      const ny = boss.y + boss.chargeDir.y * step;
      const blockedX = !canBossStandAt(nx, boss.y);
      const blockedY = !canBossStandAt(boss.x, ny);
      if (!blockedX) boss.x = nx;
      if (!blockedY) boss.y = ny;
      if ((blockedX && blockedY) || elapsed >= CHARGE_MAX_DASH_MS) {
        boss.chargeSubPhase = 'recover';
        boss.chargeSubStartedAt = now;
        playSwordClang();
      }
      return;
    }
    if (boss.chargeSubPhase === 'recover' && elapsed >= CHARGE_RECOVER_MS) {
      finishAttack(now);
    }
  }

  function updateBossSwordspin(now, dt) {
    if (now >= boss.swordSpinUntil) { finishAttack(now); return; }
    const mult = speedMult();
    boss.swordAngle += dt * SWORD_ANGULAR_SPEED_BASE * mult;

    if (now >= boss.wanderChangeAt) {
      const a = Math.random() * Math.PI * 2;
      boss.wanderDir = { x: Math.cos(a), y: Math.sin(a) };
      boss.wanderChangeAt = now + 600 + Math.random() * 500;
    }
    const step = SWORDSPIN_MOVE_SPEED_BASE * mult * dt;
    const nx = boss.x + boss.wanderDir.x * step, ny = boss.y + boss.wanderDir.y * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx; else boss.wanderDir.x *= -1;
    if (canBossStandAt(boss.x, ny)) boss.y = ny; else boss.wanderDir.y *= -1;
    boss.lookDir = boss.wanderDir;

    const dirX = Math.cos(boss.swordAngle), dirY = Math.sin(boss.swordAngle);
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      const relX = p.x - boss.x, relY = p.y - boss.y;
      const along = relX * dirX + relY * dirY;
      if (along < 0 || along > SWORD_LENGTH) return;
      const perp = Math.abs(relX * dirY - relY * dirX);
      if (perp < SWORD_HIT_WIDTH) triggerCaught(p, now);
    });
  }

  function updateBossFloortiles(now, dt) {
    const speed = FLOORTILE_SPEED_BASE * speedMult();
    for (let i = floorTiles.length - 1; i >= 0; i--) {
      const ft = floorTiles[i];
      const nx = ft.x + ft.dirX * speed * dt;
      const ny = ft.y + ft.dirY * speed * dt;
      const t = worldToTile(nx, ny);
      if (tileChar(t.x, t.y) === '#' || nx < 0 || ny < 0 || nx > WORLD_W || ny > WORLD_H) {
        floorTiles.splice(i, 1);
        continue;
      }
      ft.x = nx; ft.y = ny;
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - ft.x, p.y - ft.y) < FLOORTILE_HIT_RADIUS) triggerCaught(p, now);
      });
    }
    if (floorTiles.length === 0) finishAttack(now);
  }

  function updateBossTentaclesweep(now, dt) {
    if (now >= boss.sweepUntil) { finishAttack(now); return; }
    const mult = speedMult();
    const angularSpeed = (TENTACLE_SWEEP_LINEAR_SPEED_BASE * mult) / TENTACLE_REACH;
    boss.sweepRotation += dt * angularSpeed;

    boss.tentacleReaches = boss.tentacleAngles.map((baseA) => {
      const a = baseA + boss.sweepRotation;
      const dirX = Math.cos(a), dirY = Math.sin(a);
      const steps = Math.ceil(TENTACLE_REACH / (TILE / 2));
      let reach = TENTACLE_REACH;
      for (let i = 1; i <= steps; i++) {
        const d = (i / steps) * TENTACLE_REACH;
        const t = worldToTile(boss.x + dirX * d, boss.y + dirY * d);
        if (tileChar(t.x, t.y) === '#') { reach = d - TENTACLE_REACH / steps; break; }
      }
      return Math.max(reach, 0);
    });

    boss.tentacleAngles.forEach((baseA, i) => {
      const a = baseA + boss.sweepRotation;
      const dirX = Math.cos(a), dirY = Math.sin(a);
      const reach = boss.tentacleReaches[i];
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        const relX = p.x - boss.x, relY = p.y - boss.y;
        const along = relX * dirX + relY * dirY;
        if (along < 0 || along > reach) return;
        const perp = Math.abs(relX * dirY - relY * dirX);
        if (perp < TENTACLE_HIT_WIDTH) triggerCaught(p, now);
      });
    });
  }

  function updateBossStunned(now) {
    if (now - boss.phaseStartedAt >= STUN_DURATION_MS) {
      boss.phase = 'idle';
      boss.nextIdleUntil = now;
    }
  }

  function updateBoss(now, dt) {
    if (boss.defeated) return;
    if (now < boss.frozenUntil) return;

    switch (boss.phase) {
      case 'stunned': updateBossStunned(now); break;
      case 'idle': updateBossIdle(now, dt); break;
      case 'charge': updateBossCharge(now, dt); break;
      case 'swordspin': updateBossSwordspin(now, dt); break;
      case 'floortiles': updateBossFloortiles(now, dt); break;
      case 'tentaclesweep': updateBossTentaclesweep(now, dt); break;
    }
  }

  function updateShotgunDefense(now) {
    players.forEach((p) => {
      if (p.caught) return;
      if (p.shotgunAmmo <= 0) return;
      if (boss.defeated || now < boss.frozenUntil) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < SHOTGUN_RANGE) {
        boss.frozenUntil = now + SHOTGUN_STUN_MS;
        p.shotgunAmmo--;
        spawnFloatingText(boss.x, boss.y, 'STUNNED!');
        playShotgunBlast();
      }
    });
  }

  function updateCatch(now) {
    if (boss.defeated) return;
    if (now < boss.frozenUntil) return;
    if (boss.phase === 'stunned') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (now < p.invulnerableUntil) return;
      if (isHidden(p, now)) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < BOSS_CATCH_RADIUS) triggerCaught(p, now);
    });
  }

  function triggerCaught(p, now) {
    if (p.caught) return;
    catchFlash = 1;
    playCatchSting();
    playChompThud(0.35);
    spawnBloodEffect(p.x, p.y);
    p.caught = true;
    p.caughtAt = now;
    p.invulnerableUntil = now + CATCH_CUTSCENE_MS + 1200;
  }

  function updateCutscenes(now) {
    if (gameState === 'playing' && players.every((p) => p.caught)) {
      gameState = 'wiped';
    }
  }

  // ---- the freeze cutscene: the boss ices over, then a blast of snow
  // carries both players off to the next level ----
  function spawnSnow() {
    snowParticles = [];
    for (let i = 0; i < SNOW_COUNT; i++) {
      snowParticles.push({
        x: Math.random() * 920,
        y: Math.random() * 340,
        vx: -120 - Math.random() * 100,
        vy: 30 + Math.random() * 50,
        size: 1.5 + Math.random() * 2.5,
        drift: Math.random() * Math.PI * 2,
      });
    }
  }

  function updateSnow(dt) {
    snowParticles.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.drift += dt * 3;
      if (s.x < -10) { s.x = 930; s.y = Math.random() * 340; }
      if (s.y > 350) { s.y = -10; }
    });
  }

  function drawSnow(g) {
    g.save();
    snowParticles.forEach((s) => {
      const wob = Math.sin(s.drift) * 6;
      g.beginPath();
      g.arc(s.x + wob, s.y, s.size, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fill();
    });
    g.restore();
  }

  // The opening cutscene: runs every time this level starts, first load
  // or any retry after a wipe. Once it's over, play actually begins --
  // the run timer and the boss's own BOSS_INTRO_GRACE_MS window both
  // start counting from here, not from whenever the cutscene began.
  function updateIntroCutscene(now) {
    if (now - introStartedAt < BOSS_INTRO_CUTSCENE_MS) return;
    gameState = 'playing';
    runStartTime = now;
    elapsedMs = 0;
    boss.nextIdleUntil = now + BOSS_INTRO_GRACE_MS;
  }

  // Runs while the boss is freezing solid: records the win the instant the
  // cutscene is over (same "freeze elapsedMs the moment gameState leaves
  // 'playing'" pattern Level 5's own collapse cutscene uses) and warps to
  // the menu, same as every other level once the whole story's done.
  function updateFreezeCutscene(now) {
    if (freezeFinished || now - freezeStartedAt < FREEZE_CUTSCENE_MS) return;
    freezeFinished = true;
    if (!bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
    }
    if (window.GoofyStory) window.GoofyStory.completeLevel(10);
    window.location.href = 'level11.html';
  }

  // Icicles hanging from fixed anchor points on the boss's own silhouette,
  // growing in from nothing over the cutscene -- real icicles always point
  // straight down regardless of which way the boss itself is facing.
  const ICICLE_ANCHORS = (() => {
    const anchors = [];
    for (let i = 0; i < ICICLE_COUNT; i++) {
      const a = (i / ICICLE_COUNT) * Math.PI * 2 + 0.4;
      anchors.push({ x: Math.cos(a) * 0.55, y: Math.sin(a) * 0.5, delay: (i % 3) * 0.12 });
    }
    return anchors;
  })();

  function drawIcicles(g, freezeT, r) {
    ICICLE_ANCHORS.forEach((a) => {
      const local = clamp((freezeT - a.delay) / (1 - a.delay), 0, 1);
      if (local <= 0) return;
      const ax = a.x * r, ay = a.y * r;
      const len = r * 0.7 * local;
      const w = r * 0.1;
      g.beginPath();
      g.moveTo(ax - w, ay);
      g.lineTo(ax + w, ay);
      g.lineTo(ax, ay + len);
      g.closePath();
      const grad = g.createLinearGradient(ax, ay, ax, ay + len);
      grad.addColorStop(0, 'rgba(200,235,255,0.95)');
      grad.addColorStop(1, 'rgba(140,200,240,0.6)');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 1;
      g.stroke();
    });

    // a frost tint spreading over the whole body
    g.beginPath();
    g.ellipse(0, 0, r * 1.05, r * 1.05, 0, 0, Math.PI * 2);
    g.fillStyle = `rgba(210,240,255,${freezeT * 0.55})`;
    g.fill();
  }

  // ---- blood splatter / particles ----
  let bloodSplatters = [];
  let particles = [];

  function spawnBloodEffect(x, y) {
    bloodSplatters.push({ x, y, seed: Math.random() * 1000 });
    if (bloodSplatters.length > 24) bloodSplatters.shift();

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.45,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) { particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const drag = Math.min(1, dt * 4);
      pt.vx *= 1 - drag;
      pt.vy *= 1 - drag;
    }
  }

  function drawBloodSplatters(g) {
    bloodSplatters.forEach((b) => {
      g.save();
      g.translate(b.x, b.y);
      const points = 8;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = 6 + Math.abs(Math.sin(a * 3 + b.seed)) * 8;
        const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.7;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(90,10,14,0.75)';
      g.fill();
      for (let i = 0; i < 4; i++) {
        const a = b.seed * (i + 1);
        const dist = 10 + (i * 5);
        g.beginPath();
        g.arc(Math.cos(a) * dist, Math.sin(a) * dist * 0.7, 1.5 + (i % 2), 0, Math.PI * 2);
        g.fillStyle = 'rgba(90,10,14,0.6)';
        g.fill();
      }
      g.restore();
    });
  }

  function drawParticles(g) {
    particles.forEach((pt) => {
      const alpha = 1 - pt.life / pt.maxLife;
      g.beginPath();
      g.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      g.fillStyle = `rgba(160,15,20,${alpha})`;
      g.fill();
    });
  }

  function drawTiles(g, camX, camY, now) {
    const minTX = Math.max(0, Math.floor((camX - VISIBLE_HALF_W) / TILE) - 1);
    const maxTX = Math.min(COLS - 1, Math.ceil((camX + VISIBLE_HALF_W) / TILE) + 1);
    const minTY = Math.max(0, Math.floor((camY - VISIBLE_HALF_H) / TILE) - 1);
    const maxTY = Math.min(ROWS - 1, Math.ceil((camY + VISIBLE_HALF_H) / TILE) + 1);
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        let color;
        switch (ch) {
          case '#': color = '#262629'; break;
          case 'T': color = dirtShade(x, y); break;
          case 'E': color = '#3a301f'; break;
          case 'D': color = doorUnlocked ? floorShade(x, y) : '#3a4552'; break;
          default: color = floorShade(x, y);
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#') {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }

    let dx0 = Infinity, dy0 = Infinity, dx1 = -Infinity, dy1 = -Infinity;
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        if (LEVEL.grid[y][x] === 'D') {
          dx0 = Math.min(dx0, x); dy0 = Math.min(dy0, y);
          dx1 = Math.max(dx1, x); dy1 = Math.max(dy1, y);
        }
      }
    }
    if (dx0 !== Infinity) {
      const wx0 = dx0 * TILE, wy0 = dy0 * TILE;
      const dw = (dx1 - dx0 + 1) * TILE, dh = (dy1 - dy0 + 1) * TILE;
      if (!doorUnlocked) {
        g.strokeStyle = '#0d1114';
        g.lineWidth = 4;
        g.strokeRect(wx0 + 3, wy0 + 3, dw - 6, dh - 6);
        g.strokeStyle = 'rgba(255,190,60,0.5)';
        g.lineWidth = 3;
        g.strokeRect(wx0 + 9, wy0 + 9, Math.max(dw - 18, 2), Math.max(dh - 18, 2));
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.lineWidth = 3;
        g.strokeRect(wx0 + 2, wy0 + 2, dw - 4, dh - 4);
      }
    }

    const ex = tileCenter(LEVEL.exitTrigger.x, LEVEL.exitTrigger.y);
    g.beginPath();
    g.arc(ex.x, ex.y, doorUnlocked ? 12 : 6, 0, Math.PI * 2);
    g.fillStyle = doorUnlocked ? '#ffd27a' : '#5a4a30';
    g.fill();

    drawCorpses(g);
    drawBloodSplatters(g);
    drawCrates(g);
    drawDynamiteSticks(g, now);
  }

  function drawDynamiteSticks(g, now) {
    dynamiteSticks.forEach((d) => {
      g.save();
      g.translate(d.x, d.y);
      const pulse = 0.8 + Math.sin(now * 0.012 + d.seed) * 0.2;
      const glow = g.createRadialGradient(0, 0, 2, 0, 0, 18 * pulse);
      glow.addColorStop(0, 'rgba(255,90,40,0.5)');
      glow.addColorStop(1, 'rgba(255,90,40,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
      g.fill();

      // two bundled sticks of dynamite
      [-3, 3].forEach((ox) => {
        g.fillStyle = '#b5301f';
        g.fillRect(ox - 2.5, -9, 5, 18);
        g.strokeStyle = '#5a1610';
        g.lineWidth = 1;
        g.strokeRect(ox - 2.5, -9, 5, 18);
        g.strokeStyle = 'rgba(255,255,255,0.3)';
        g.beginPath();
        g.moveTo(ox - 2.5, -3); g.lineTo(ox + 2.5, -3);
        g.moveTo(ox - 2.5, 3); g.lineTo(ox + 2.5, 3);
        g.stroke();
      });

      g.strokeStyle = '#c9903a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -9);
      g.quadraticCurveTo(4, -14, 1, -18);
      g.stroke();
      g.beginPath();
      g.arc(1, -19, 2 + pulse, 0, Math.PI * 2);
      g.fillStyle = '#ffd27a';
      g.shadowColor = '#ff9c3d';
      g.shadowBlur = 8;
      g.fill();
      g.shadowBlur = 0;

      g.restore();
    });
  }

  function drawCorpses(g) {
    (LEVEL.corpseSpawns || []).forEach((cs) => {
      const c = tileCenter(cs.x, cs.y);
      g.save();
      g.translate(c.x, c.y);
      g.rotate(cs.angle || 0);
      g.fillStyle = '#3a2f38';
      g.beginPath();
      g.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(210,220,214,0.85)';
      g.beginPath();
      g.arc(-11, 0, 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.beginPath();
      g.arc(-12, -1, 1.2, 0, Math.PI * 2);
      g.arc(-10, -1, 1.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });
  }

  function drawCrates(g) {
    crates.forEach((c) => {
      const center = tileCenter(c.x, c.y);
      g.save();
      g.translate(center.x, center.y);
      if (c.opened) {
        g.fillStyle = '#4a3826';
        g.fillRect(-9, -6, 18, 12);
        g.strokeStyle = '#2a1e14';
        g.lineWidth = 1.5;
        g.strokeRect(-9, -6, 18, 12);
      } else {
        g.fillStyle = '#7a5a34';
        g.fillRect(-10, -10, 20, 20);
        g.strokeStyle = '#4a3520';
        g.lineWidth = 2;
        g.strokeRect(-10, -10, 20, 20);
        g.beginPath();
        g.moveTo(-10, 0); g.lineTo(10, 0);
        g.moveTo(0, -10); g.lineTo(0, 10);
        g.stroke();
      }
      g.restore();
    });
  }

  function drawFloorTiles(g) {
    floorTiles.forEach((ft) => {
      g.save();
      g.translate(ft.x, ft.y);
      g.rotate(Math.atan2(ft.dirY, ft.dirX));
      g.fillStyle = '#5a5248';
      g.fillRect(-9, -9, 18, 18);
      g.strokeStyle = '#2a2520';
      g.lineWidth = 2;
      g.strokeRect(-9, -9, 18, 18);
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-9, 0); g.lineTo(9, 0);
      g.moveTo(0, -9); g.lineTo(0, 9);
      g.stroke();
      g.restore();
    });
  }

  function drawFloatingTexts(g) {
    floatingTexts.forEach((f) => {
      const t = f.life / f.maxLife;
      g.save();
      g.globalAlpha = 1 - t;
      g.fillStyle = '#ffe27a';
      g.font = 'bold 11px monospace';
      g.textAlign = 'center';
      g.fillText(f.text, f.x, f.y - 18 - t * 20);
      g.restore();
    });
  }

  // ---- the boss: a giant armored knight ----
  function drawKnightTentacles(g, t) {
    boss.tentacleAngles.forEach((baseA, i) => {
      const a = baseA + boss.sweepRotation;
      const reach = boss.tentacleReaches[i] || TENTACLE_REACH;
      const tx = Math.cos(a) * reach, ty = Math.sin(a) * reach;
      const color = boss.phase2 ? '#1a3a6a' : '#3a0c10';
      drawTaperedTentacle(g, tx, ty, tx * 0.5, ty * 0.5, boss.radius * 0.12, color);
    });
  }

  function drawArmorGem(g, x, y, r, phase2) {
    const color = phase2 ? '#2a6bd6' : '#8a1620';
    const glow = phase2 ? '#8fd6ff' : '#ff3a4a';
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r);
    grad.addColorStop(0, glow);
    grad.addColorStop(1, color);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.shadowColor = glow;
    g.shadowBlur = phase2 ? 9 : 4;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
  }

  // A mouth instead of an eye -- same convention as Level 7/9's creatures:
  // a dark wet oval, a row of teeth, oriented to face lookDir.
  function drawMonsterMouth(g, radius, lookDir) {
    const mouthR = radius * 0.7;
    const angle = Math.atan2(lookDir.y, lookDir.x);
    g.save();
    g.rotate(angle);

    const mouthGrad = g.createRadialGradient(mouthR * 0.25, 0, 1, mouthR * 0.25, 0, mouthR * 0.9);
    mouthGrad.addColorStop(0, '#180810');
    mouthGrad.addColorStop(1, '#000000');
    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.fillStyle = mouthGrad;
    g.fill();

    g.beginPath();
    g.ellipse(mouthR * 0.55, 0, mouthR * 0.25, mouthR * 0.16, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(120,20,30,0.5)';
    g.fill();

    const teeth = 9;
    for (let i = 0; i < teeth; i++) {
      const a = (i / (teeth - 1)) * Math.PI * 2 - Math.PI;
      const rx = mouthR * 0.85, ry = mouthR * 0.62;
      const bx = mouthR * 0.25 + Math.cos(a) * rx;
      const by = Math.sin(a) * ry;
      const inX = mouthR * 0.25 + Math.cos(a) * rx * 0.45;
      const inY = Math.sin(a) * ry * 0.45;
      const tw = 2.6;
      const nx = -Math.sin(a) * tw, ny = Math.cos(a) * tw;
      const toothGrad = g.createLinearGradient(bx, by, inX, inY);
      toothGrad.addColorStop(0, '#ffffff');
      toothGrad.addColorStop(1, '#c9c0b0');
      g.beginPath();
      g.moveTo(bx + nx, by + ny);
      g.lineTo(bx - nx, by - ny);
      g.lineTo(inX, inY);
      g.closePath();
      g.fillStyle = toothGrad;
      g.fill();
    }

    g.beginPath();
    g.ellipse(mouthR * 0.25, 0, mouthR * 0.85, mouthR * 0.62, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  }

  // A proper suit of plate rather than the usual blob-with-floating-plates
  // look every other armored creature in this game uses -- a breastplate
  // with a tasset skirt and a pair of pauldrons, each carrying its own
  // ruby/sapphire gem. The body itself doesn't rotate (same convention as
  // every other monster here, only its eye/mouth tracks lookDir), so this
  // reads the same from whichever side it's facing.
  function drawKnightBody(g, t) {
    const r = boss.radius;
    const ironLight = boss.defeated ? '#4a4640' : '#8a8f99';
    const ironMid = boss.defeated ? '#302d28' : '#5a5e66';
    const ironDark = boss.defeated ? '#0d0c0a' : '#232529';
    const wobble = Math.sin(t * 0.003 + boss.seed) * (r * 0.015);

    g.beginPath();
    g.ellipse(0, r * 0.92, r * 0.78, r * 0.2, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fill();

    // tasset -- three overlapping skirt plates hanging off the waist
    [-0.4, 0, 0.4].forEach((f) => {
      g.save();
      g.translate(f * r * 0.75, r * 0.45 + wobble);
      g.rotate(f * 0.25);
      const tg = g.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
      tg.addColorStop(0, ironDark);
      tg.addColorStop(0.5, ironLight);
      tg.addColorStop(1, ironDark);
      g.beginPath();
      g.moveTo(-r * 0.2, -r * 0.08);
      g.lineTo(r * 0.2, -r * 0.08);
      g.lineTo(r * 0.14, r * 0.38);
      g.lineTo(-r * 0.14, r * 0.38);
      g.closePath();
      g.fillStyle = tg;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.3;
      g.stroke();
      g.restore();
    });

    // breastplate -- wide at the shoulders, tapering to the waist
    g.beginPath();
    g.moveTo(-r * 0.6, -r * 0.58 + wobble);
    g.lineTo(r * 0.6, -r * 0.58 + wobble);
    g.quadraticCurveTo(r * 0.76, -r * 0.1, r * 0.4, r * 0.48);
    g.lineTo(-r * 0.4, r * 0.48);
    g.quadraticCurveTo(-r * 0.76, -r * 0.1, -r * 0.6, -r * 0.58 + wobble);
    g.closePath();
    const torsoGrad = g.createLinearGradient(-r * 0.6, -r * 0.5, r * 0.6, r * 0.4);
    torsoGrad.addColorStop(0, ironMid);
    torsoGrad.addColorStop(0.5, ironLight);
    torsoGrad.addColorStop(1, ironDark);
    g.fillStyle = torsoGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 2;
    g.stroke();

    // center spine seam + a couple of riveted horizontal bands
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -r * 0.5 + wobble);
    g.lineTo(0, r * 0.4);
    g.stroke();
    if (!boss.defeated) {
      [-0.12, 0.22].forEach((f) => {
        const py = f * r + wobble;
        const bandGrad = g.createLinearGradient(-r * 0.56, py, r * 0.56, py);
        bandGrad.addColorStop(0, ironDark);
        bandGrad.addColorStop(0.5, '#7d828c');
        bandGrad.addColorStop(1, ironDark);
        g.fillStyle = bandGrad;
        g.beginPath();
        g.ellipse(0, py, r * 0.5, r * 0.06, 0, 0, Math.PI * 2);
        g.fill();
      });
    }

    // pauldrons -- round shoulder plates, each with its own gem
    [-1, 1].forEach((side) => {
      const px = side * r * 0.66, py = -r * 0.52 + wobble;
      const pg = g.createRadialGradient(px - side * r * 0.1, py - r * 0.1, 1, px, py, r * 0.3);
      pg.addColorStop(0, ironLight);
      pg.addColorStop(1, ironDark);
      g.beginPath();
      g.arc(px, py, r * 0.28, 0, Math.PI * 2);
      g.fillStyle = pg;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.5;
      g.stroke();
      if (!boss.defeated) drawArmorGem(g, px, py, r * 0.065, boss.phase2);
    });

    // the main crest gem, set in the chest
    if (!boss.defeated) drawArmorGem(g, 0, -r * 0.02 + wobble, r * 0.13, boss.phase2);

    // a soft highlight along the upper-left of the breastplate
    g.save();
    g.beginPath();
    g.ellipse(-r * 0.25, -r * 0.3, r * 0.3, r * 0.18, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fill();
    g.restore();
  }

  // The helm is two riveted plates (a brow and a jaw guard) with a gap
  // between them -- the mouth shows through that gap, same "visible mouth,
  // armored everywhere else" convention the user asked for, in place of
  // the glowing eye-slit a sighted monster would have instead.
  function drawKnightHelm(g) {
    const r = boss.radius;
    const angle = Math.atan2(boss.lookDir.y, boss.lookDir.x);
    g.save();
    g.rotate(angle);
    g.translate(r * 0.62, 0);
    const headR = r * 0.34;
    const ironLight = boss.defeated ? '#4a4640' : '#9aa0aa';
    const ironDark = boss.defeated ? '#201e1a' : '#3a3d44';
    const helmGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.4, 1, 0, 0, headR * 1.3);
    helmGrad.addColorStop(0, ironLight);
    helmGrad.addColorStop(1, ironDark);

    if (!boss.defeated) {
      drawMonsterMouth(g, headR * 1.5, { x: 1, y: 0 });
    } else {
      g.strokeStyle = 'rgba(20,10,8,0.85)';
      g.lineWidth = headR * 0.14;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-headR * 0.3, 0);
      g.lineTo(headR * 0.5, 0);
      g.stroke();
    }

    // brow guard (above the mouth)
    g.beginPath();
    g.ellipse(-headR * 0.05, -headR * 0.72, headR * 0.98, headR * 0.5, 0, 0, Math.PI * 2);
    g.fillStyle = helmGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.4;
    g.stroke();
    // a small crest nub on top of the brow
    g.fillStyle = ironDark;
    g.beginPath();
    g.ellipse(0, -headR * 1.3, headR * 0.16, headR * 0.35, 0, 0, Math.PI * 2);
    g.fill();

    // jaw guard (below the mouth)
    g.beginPath();
    g.ellipse(headR * 0.05, headR * 0.68, headR * 0.92, headR * 0.44, 0, 0, Math.PI * 2);
    g.fillStyle = helmGrad;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.4;
    g.stroke();

    // cheek guards framing the mouth on either side
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.ellipse(side * headR * 0.95, headR * 0.1, headR * 0.3, headR * 0.6, 0, 0, Math.PI * 2);
      g.fillStyle = helmGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.2;
      g.stroke();
    });

    g.restore();
  }

  function drawSword(g, angle, hot, length) {
    g.save();
    g.rotate(angle);
    g.strokeStyle = '#3a3d44';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-16, 0);
    g.stroke();

    g.strokeStyle = hot ? '#ffb43d' : '#8a8f99';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(8, -16);
    g.lineTo(8, 16);
    g.stroke();

    const grad = g.createLinearGradient(12, 0, length, 0);
    if (hot) {
      grad.addColorStop(0, '#ffe38a');
      grad.addColorStop(0.5, '#ff6a2a');
      grad.addColorStop(1, '#a3321f');
    } else {
      grad.addColorStop(0, '#d8dce2');
      grad.addColorStop(0.5, '#9fa6b0');
      grad.addColorStop(1, '#5a5f68');
    }
    g.beginPath();
    g.moveTo(10, -8);
    g.lineTo(length - 12, -3.5);
    g.lineTo(length, 0);
    g.lineTo(length - 12, 3.5);
    g.lineTo(10, 8);
    g.closePath();
    g.fillStyle = grad;
    if (hot) { g.shadowColor = '#ff6a2a'; g.shadowBlur = 16; }
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 1;
    g.stroke();

    // a small gem set in the pommel
    drawArmorGem(g, -16, 0, 5, boss.phase2);
    g.restore();
  }

  // Blue flame licking up off the armor once phase 2 kicks in -- the same
  // rising-ember trick Level 5's boss used for its own fire, recolored.
  function drawPhase2Flames(g, t) {
    const r = boss.radius;
    for (let i = 0; i < 10; i++) {
      const seed = boss.seed * 7 + i * 971;
      const cycle = 2200 + (i % 4) * 400;
      const phase = ((t + seed) % cycle) / cycle;
      const ex = Math.sin(seed + phase * 6.2) * r * 0.8;
      const ey = r * 0.5 - phase * r * 2.2;
      const alpha = 1 - phase;
      g.beginPath();
      g.arc(ex, ey, 2 + (i % 3), 0, Math.PI * 2);
      g.fillStyle = `rgba(${90 + (i % 3) * 20},${170 + (i % 3) * 20},255,${alpha * 0.85})`;
      g.fill();
    }
    const spots = 4;
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2 + boss.seed * 0.1;
      const bx = Math.cos(a) * r * 0.92;
      const by = Math.sin(a) * r * 0.92;
      const flicker = 0.8 + Math.sin(t * 0.02 + i * 3.1 + boss.seed) * 0.2;
      g.save();
      g.translate(bx, by);
      g.rotate(a - Math.PI / 2);
      const h = r * 0.4 * flicker;
      g.beginPath();
      g.moveTo(-r * 0.06, 4);
      g.quadraticCurveTo(r * 0.04, -h * 0.55, 0, -h);
      g.quadraticCurveTo(-r * 0.04, -h * 0.55, r * 0.06, 4);
      g.closePath();
      g.fillStyle = '#bfe8ff';
      g.fill();
      g.restore();
    }
  }

  function drawBoss(g, t) {
    g.save();
    g.translate(boss.x, boss.y);

    if (boss.phase === 'tentaclesweep') drawKnightTentacles(g, t);

    drawKnightBody(g, t);
    drawKnightHelm(g);

    if (!boss.defeated) {
      let swordAngle = Math.atan2(boss.lookDir.y, boss.lookDir.x);
      let hot = false;
      if (boss.phase === 'charge') swordAngle = Math.atan2(boss.chargeDir.y, boss.chargeDir.x);
      else if (boss.phase === 'swordspin') { swordAngle = boss.swordAngle; hot = true; }
      drawSword(g, swordAngle, hot, SWORD_LENGTH);

      if (boss.phase2) drawPhase2Flames(g, t);
    }

    if (gameState === 'freezing') {
      const freezeT = clamp((t - freezeStartedAt) / FREEZE_CUTSCENE_MS, 0, 1);
      drawIcicles(g, freezeT, boss.radius);
    }

    if (t < boss.frozenUntil) {
      const points = 14;
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const r = boss.radius + 6;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(140,220,255,0.4)';
      g.fill();
      g.strokeStyle = 'rgba(220,250,255,0.75)';
      g.lineWidth = 2;
      g.stroke();
    }

    if (boss.phase === 'stunned') {
      const starCount = 5;
      for (let i = 0; i < starCount; i++) {
        const a = (i / starCount) * Math.PI * 2 + t * 0.003;
        const sx = Math.cos(a) * boss.radius * 0.7;
        const sy = -boss.radius * 1.15 + Math.sin(a) * boss.radius * 0.18;
        g.save();
        g.translate(sx, sy);
        g.rotate(a * 2);
        g.beginPath();
        for (let k = 0; k < 5; k++) {
          const sa = (k / 5) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? 7 : 3;
          const px = Math.cos(sa) * rr, py = Math.sin(sa) * rr;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        g.fillStyle = '#8fd6ff';
        g.fill();
        g.restore();
      }
    }

    g.restore();
  }

  function drawLimb(g, hipX, hipY, tipX, tipY, width, color, capColor, capR) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(tipX, tipY);
    g.stroke();
    g.beginPath();
    g.arc(tipX, tipY, capR, 0, Math.PI * 2);
    g.fillStyle = capColor;
    g.fill();
  }

  function drawHeldShotgun(g, R, p) {
    g.save();
    const grip = Math.sin(p.walkPhase) * R * 0.05;
    g.translate(R * 0.15, R * 0.25 + grip);
    g.rotate(-0.12);
    g.strokeStyle = '#5a4428';
    g.lineWidth = R * 0.22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-R * 0.35, 0);
    g.lineTo(R * 0.25, 0);
    g.stroke();
    g.strokeStyle = '#3a3d42';
    g.lineWidth = R * 0.15;
    g.beginPath();
    g.moveTo(R * 0.15, 0);
    g.lineTo(R * 1.55, 0);
    g.stroke();
    if (p.shotgunAmmo > 0) {
      g.beginPath();
      g.arc(R * 1.55, 0, R * 0.12, 0, Math.PI * 2);
      g.fillStyle = '#ff6a2a';
      g.shadowColor = '#ff6a2a';
      g.shadowBlur = 6;
      g.fill();
      g.shadowBlur = 0;
    }
    g.restore();
  }

  function drawPlayers(g) {
    const R = PLAYER_RADIUS;
    players.forEach((p) => {
      g.save();
      g.translate(p.x, p.y);

      g.beginPath();
      g.ellipse(0, R * 1.05, R * 0.85, R * 0.26, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fill();

      g.rotate(Math.atan2(p.facing.y, p.facing.x));

      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(p.color, -0.45);
      const bootColor = '#2b2b28';

      drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);

      g.strokeStyle = '#54544c';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-R * 1.3, -3);
      g.quadraticCurveTo(-R * 1.1, -R * 0.9, -R * 0.55, -R * 0.55);
      g.stroke();
      const tankGrad = g.createLinearGradient(-R * 1.5, -4.5, -R * 1.5, 4.5);
      tankGrad.addColorStop(0, shade('#54544c', 0.25));
      tankGrad.addColorStop(1, shade('#54544c', -0.25));
      g.fillStyle = tankGrad;
      g.fillRect(-R * 1.5, -4.5, 7, 9);

      g.save();
      g.translate(0, -bob);
      const bodyGrad = g.createRadialGradient(-R * 0.32, -R * 0.4, 1, 0, 0, R * 1.1);
      bodyGrad.addColorStop(0, shade(p.color, 0.25));
      bodyGrad.addColorStop(0.6, p.color);
      bodyGrad.addColorStop(1, shade(p.color, -0.35));
      g.beginPath();
      g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
      g.fillStyle = bodyGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 1.5;
      g.stroke();

      g.save();
      g.beginPath();
      g.ellipse(0, 0, R * 0.85, R * 0.75, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(20,20,15,0.85)';
      g.fillRect(-R * 1.1, -R * 0.24, R * 2.2, R * 0.17);
      g.fillStyle = 'rgba(255,200,40,0.9)';
      g.fillRect(-R * 1.1, -R * 0.08, R * 2.2, R * 0.09);
      g.restore();
      g.restore();

      drawLimb(g, 0, -R * 0.55, -swing * 0.8, -R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
      drawLimb(g, 0, R * 0.55, swing * 0.8, R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
      drawHeldShotgun(g, R, p);

      g.save();
      g.translate(R * 0.55, -bob);
      const headR = R * 0.5;

      g.beginPath();
      g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
      g.fillStyle = '#3a3a34';
      g.fill();

      const visorGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.3, 1, 0, 0, headR);
      visorGrad.addColorStop(0, 'rgba(180,220,255,0.55)');
      visorGrad.addColorStop(0.6, 'rgba(100,150,190,0.4)');
      visorGrad.addColorStop(1, 'rgba(20,30,40,0.5)');
      g.beginPath();
      g.arc(0, 0, headR * 0.92, 0, Math.PI * 2);
      g.fillStyle = visorGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();

      g.restore();
    });
  }

  function punchLight(g, x, y, radius, intensity) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(0,0,0,${intensity})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, radius, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The whole arena is visible at once, so the darkness mask stays mostly
  // decorative -- punched generously around each player and the boss
  // itself rather than gating what's explorable the way earlier levels do.
  function buildDarknessMask(camX, camY, now) {
    const worldToScreen = (wx, wy) => ({ x: (wx - camX) * ZOOM + VIEW_W / 2, y: (wy - camY) * ZOOM + VIEW_H / 2 });
    const nvgMult = now < nvgUntil ? NVG_RANGE_MULT : 1;

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 140 * ZOOM * nvgMult, 1);
      punchLight(maskCtx, s.x, s.y, 320 * ZOOM * nvgMult, 0.85);
    });

    const bs = worldToScreen(boss.x, boss.y);
    punchLight(maskCtx, bs.x, bs.y, boss.radius * 2.4 * ZOOM, 0.5);
  }

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const intro = gameState === 'intro';
    const zoom = intro ? ZOOM * BOSS_INTRO_ZOOM_MULT : ZOOM;
    const camX = intro ? boss.x : clamp(p.x, VISIBLE_HALF_W, WORLD_W - VISIBLE_HALF_W);
    const camY = intro ? boss.y : clamp(p.y, VISIBLE_HALF_H, WORLD_H - VISIBLE_HALF_H);
    const shakeX = intro ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;
    const shakeY = intro ? (Math.random() - 0.5) * 2 * BOSS_INTRO_SHAKE_MAG : 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.fillStyle = '#050308';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2 + shakeX, VIEW_H / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, camX, camY, now);
    drawSmokeBombs(ctx, now);
    drawFloorTiles(ctx);
    drawBoss(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    drawFloatingTexts(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY, now);
    ctx.drawImage(maskCanvas, vx, 0);

    if (now < nvgUntil) {
      ctx.fillStyle = 'rgba(40,255,120,0.16)';
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }

    if (intro) {
      drawBossIntroOverlay(vx, now);
    } else {
      drawBossHealthBar(vx, now);
      drawProximityWarning(vx, Math.hypot(p.x - boss.x, p.y - boss.y), now);
      drawRadar(vx, p, now);
      drawScanner(vx, p, now);
      drawShotgunHud(vx, p);
      const minimapH = drawMinimap(vx, now);
      drawStaminaBar(vx, p, minimapH);

      if (p.caught) drawCutsceneOverlay(vx, p, now);
    }

    ctx.restore();
  }

  // The opening cutscene's name card -- a dark letterbox band with the
  // boss's name, fading in and settling for the last stretch of
  // BOSS_INTRO_CUTSCENE_MS so it's readable despite the shake.
  function drawBossIntroOverlay(vx, now) {
    const t = clamp((now - introStartedAt) / BOSS_INTRO_CUTSCENE_MS, 0, 1);
    const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
    ctx.save();
    ctx.fillStyle = `rgba(5,5,8,${0.55 * alpha})`;
    ctx.fillRect(vx, VIEW_H / 2 - 34, VIEW_W, 68);
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(220,60,60,${alpha})`;
    ctx.shadowColor = 'rgba(220,60,60,0.8)';
    ctx.shadowBlur = 10 * alpha;
    ctx.fillText(BOSS_NAME, vx + VIEW_W / 2, VIEW_H / 2 + 8);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // A small HUD badge in the corner once a player's carrying at least one
  // shotgun shell -- the shell icon plus a live "Nx" count, since ammo now
  // stacks up to SHOTGUN_AMMO_MAX instead of capping at a single shell.
  function drawShotgunHud(vx, p) {
    if (p.shotgunAmmo <= 0) return;
    const cx = vx + VIEW_W - 34, cy = 64;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,20,10,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#ff9c3d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx - 6, cy);
    ctx.fillStyle = '#c9451f';
    ctx.fillRect(-4, -7, 8, 9);
    ctx.fillStyle = '#d9b24a';
    ctx.fillRect(-4, 2, 8, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, -7, 8, 13);
    ctx.restore();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`${p.shotgunAmmo}x`, cx + 3, cy + 4);
    ctx.restore();
  }

  function drawRadar(vx, p, now) {
    if (now > radarUntil) return;
    const cx = vx + VIEW_W - 34, cy = 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,25,15,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = 2;
    ctx.stroke();
    const angle = Math.atan2(boss.y - p.y, boss.x - p.x);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = '#3ddc84';
    ctx.shadowColor = '#3ddc84';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }

  function drawScanner(vx, p, now) {
    if (now > scannerUntil) return;
    const target = nearestUnpressedButton(p.x, p.y);
    if (!target) return;
    const cx = vx + VIEW_W - 34, cy = VIEW_H - 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(35,25,5,0.75)';
    ctx.fill();
    ctx.strokeStyle = '#ffb43d';
    ctx.lineWidth = 2;
    ctx.stroke();
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffb43d';
    ctx.shadowColor = '#ffb43d';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }

  const PROXIMITY_WARNING_RADIUS = 500;

  function drawProximityWarning(vx, dist, now) {
    if (dist > PROXIMITY_WARNING_RADIUS) return;
    const closeness = 1 - dist / PROXIMITY_WARNING_RADIUS;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
    const alpha = closeness * 0.6 * pulse;
    ctx.fillStyle = `rgba(200,20,20,${alpha})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
  }

  function drawJaw(g, vx, direction, progress, color) {
    const teeth = 8;
    const toothW = VIEW_W / teeth;
    const reach = progress * (VIEW_H / 2 + 24);
    g.fillStyle = color;
    g.beginPath();
    if (direction === 1) {
      g.moveTo(vx, 0);
      g.lineTo(vx + VIEW_W, 0);
      g.lineTo(vx + VIEW_W, Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) {
        const x = vx + i * toothW;
        const y = reach + (i % 2 === 0 ? 14 : -6);
        g.lineTo(x, y);
      }
      g.lineTo(vx, 0);
    } else {
      g.moveTo(vx, VIEW_H);
      g.lineTo(vx + VIEW_W, VIEW_H);
      g.lineTo(vx + VIEW_W, VIEW_H - Math.max(0, reach - 14));
      for (let i = teeth; i >= 0; i--) {
        const x = vx + i * toothW;
        const y = VIEW_H - reach - (i % 2 === 0 ? 14 : -6);
        g.lineTo(x, y);
      }
      g.lineTo(vx, VIEW_H);
    }
    g.closePath();
    g.fill();
  }

  function drawCutsceneOverlay(vx, p, now) {
    const t = clamp((now - p.caughtAt) / CATCH_CUTSCENE_MS, 0, 1);
    const jawProgress = clamp(t / 0.75, 0, 1);

    ctx.save();
    ctx.fillStyle = `rgba(50,0,0,${0.25 + t * 0.35})`;
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    const shake = (1 - t) * 5;
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawJaw(ctx, vx, 1, jawProgress, '#3a0d16');
    drawJaw(ctx, vx, -1, jawProgress, '#2a0810');

    if (t > 0.6) {
      const flash = clamp((t - 0.6) / 0.15, 0, 1) * (1 - clamp((t - 0.85) / 0.15, 0, 1));
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
      ctx.fillRect(vx, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
  }

  function drawDivider() {
    ctx.strokeStyle = '#3a2a44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIEW_W, 0);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.stroke();
  }

  function updateOverlay() {
    if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    const hp = `${bossHealth}/${BOSS_MAX_HEALTH}`;
    hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : boss.phase === 'stunned' ? `Boss: ${hp} HP (stunned)` : `Boss: ${hp} HP${boss.phase2 ? ' — phase 2' : ''}`;
    hudBossEl.classList.toggle('done', boss.defeated);
    hudDoorEl.textContent = `Door: ${doorUnlocked ? 'open' : 'locked'}`;
    hudDoorEl.classList.toggle('done', doorUnlocked);

    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;

  function loop(now) {
    try {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'intro') {
      updateIntroCutscene(now);
    } else if (gameState === 'playing') {
      elapsedMs = now - runStartTime;
      updateInputMovement(now, dt);
      updateCrates(now);
      updateSmokeBombs(now);
      updateDynamite(now);
      updateBoss(now, dt);
      updateShotgunDefense(now);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
    } else if (gameState === 'freezing') {
      updateSnow(dt);
      updateFreezeCutscene(now);
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    renderViewport(1, now);
    drawDivider();

    if (gameState === 'freezing') {
      const freezeT = clamp((now - freezeStartedAt) / FREEZE_CUTSCENE_MS, 0, 1);
      drawSnow(ctx);
      ctx.fillStyle = `rgba(220,240,255,${freezeT * 0.75})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (freezeT > 0.3) {
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(20,40,60,${Math.min(1, (freezeT - 0.3) * 2.5)})`;
        ctx.fillText('THE COLD TAKES IT...', canvas.width / 2, canvas.height / 2);
      }
    }

    if (catchFlash > 0) {
      ctx.fillStyle = `rgba(180,20,30,${catchFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      catchFlash -= dt * 1.2;
    }

    updateOverlay();
    updateHud();
    } catch (err) {
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
