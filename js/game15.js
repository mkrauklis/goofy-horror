(function () {
  // Story mode gate: direct URL access can't skip ahead even though the
  // menu already hides the link for a locked level.
  if (window.GoofyStory && !window.GoofyStory.isUnlocked(15)) {
    const msg = document.getElementById('game-message');
    if (msg) {
      msg.style.display = 'flex';
      msg.innerHTML = 'LOCKED &mdash; finish the previous level first. <a href="index.html" style="color:var(--accent)">Back to the menu</a>';
    }
    return;
  }

  const LEVEL = window.LEVEL15;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;
  // Chosen so the WHOLE arena fits on screen at once in phase 1 --
  // VISIBLE_HALF_W/H (computed from whichever zoom is active -- see
  // currentZoom()) both end up bigger than half the arena, so the
  // clamp() in renderViewport's camera math collapses to a fixed center
  // point instead of following either player around. Phase 2's chase
  // hallway switches to CHASE_ZOOM, a normal 1:1 follow-cam, once the
  // fight leaves the arena -- a zoomed-out view of an 80-tile corridor
  // would make the chase unreadable.
  const ZOOM = 0.4;
  const CHASE_ZOOM = 1;
  function currentZoom() {
    return boss.phase2 ? CHASE_ZOOM : ZOOM;
  }
  function visibleHalfW() { return (VIEW_W / 2) / currentZoom(); }
  function visibleHalfH() { return (VIEW_H / 2) / currentZoom(); }

  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss: the Mutation from Level 12, grown to twice its old size and
  // partly iced over. Every attack speed below is defined relative to
  // PLAYER_SPEED, same convention as every monster elsewhere in this game.
  const BOSS_RADIUS = 48;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.15;

  const BOSS_IDLE_SPEED = PLAYER_SPEED * 0.3;
  const BOSS_IDLE_MIN_MS = 700;
  // A grace window after the level first loads, before the boss's very
  // first attack -- gives players a moment to get oriented instead of
  // getting hit before they've even seen the room.
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_IDLE_MAX_MS = 1400;

  // 1. Split: the mutation tears itself into two smaller copies -- one a
  // slow lumbering 1.2x, the other a fast 1.9x -- that hunt independently
  // until the attack's timer runs out and they collapse back into one.
  const SPLIT_DURATION_MS = 9000;
  const SPLIT_CLONE_RADIUS = BOSS_RADIUS * 0.72;
  const SPLIT_SLOW_SPEED = PLAYER_SPEED * 1.2;
  const SPLIT_FAST_SPEED = PLAYER_SPEED * 1.9;

  // 2. Icicle shower: fires a shard at the nearest player every
  // ICICLE_FIRE_INTERVAL_MS for ICICLESHOOT_DURATION_MS straight, each one
  // a straight-line shot at 2x speed from wherever the boss is standing.
  const ICICLESHOOT_DURATION_MS = 5000;
  const ICICLE_FIRE_INTERVAL_MS = 550;
  const ICICLE_PROJECTILE_SPEED = PLAYER_SPEED * 2;
  const ICICLE_HIT_RADIUS = 20;

  // 3. Wall push: an ice wall rises along the arena's left edge, one gap
  // (WALLPUSH_GAP_TILES tall, picked fresh each time) left open, and
  // sweeps right at 1.5x player speed -- anyone it reaches outside the
  // gap's row range is crushed.
  const WALLPUSH_SPEED = PLAYER_SPEED * 1.5;
  const WALLPUSH_GAP_TILES = 2;
  const WALLPUSH_WARNING_MS = 900;

  // 4. Expand: the mutation plants itself at the arena's center and swells
  // a growing hazard ring out from its body over EXPAND_DURATION_MS --
  // EXPAND_MAX_RADIUS stays well short of the distance to any corner, so
  // the corners are always safe no matter how far it grows.
  const EXPAND_WINDUP_MS = 700;
  const EXPAND_DURATION_MS = 6000;
  const EXPAND_MAX_RADIUS = 350;

  // Torches: the only way to actually hurt this boss. One spawns
  // somewhere on the open floor every TORCH_SPAWN_INTERVAL_MS as long as
  // fewer than TORCH_MAX_LIVE are already down; walking onto one picks it
  // up and lands TORCH_DAMAGE immediately.
  const TORCH_SPAWN_INTERVAL_MS = 10000;
  const TORCH_MAX_LIVE = 5;
  const TORCH_DAMAGE = 2;
  const TORCH_RESPAWN_MS = 8000; // phase 2's hallway points, after a pickup
  const BOSS_MAX_HEALTH = 25;

  // Phase 2: at 15 HP the gate opens, a spike wall seals the retreat, and
  // the boss permanently switches to chasing. Speed scales with how far
  // ahead or behind the nearest player is down the corridor -- 1.25x at
  // an even pace, 2x if they've pulled ahead, 0.8x if they've fallen
  // behind, so neither sprinting nor dawdling is ever free.
  const PHASE2_HEALTH_THRESHOLD = 15;
  const CHASE_SPEED_BASE = PLAYER_SPEED * 1.25;
  const CHASE_SPEED_AHEAD = PLAYER_SPEED * 2;
  const CHASE_SPEED_BEHIND = PLAYER_SPEED * 0.8;
  const CHASE_PACE_MARGIN = 40;
  const CHASE_ICICLE_SPEED = PLAYER_SPEED * 2.5;
  const CHASE_ICICLE_INTERVAL_MS = 650;
  // The freeze item used to stop the boss dead; now it only costs it 20%
  // of its current speed, in or out of the chase.
  const FROZEN_SPEED_MULT = 0.8;
  // A blast of water once the boss finally goes down, the drowning
  // counterpart to every other boss's freeze/icicle cutscene.
  const WATERWAVE_CUTSCENE_MS = 3000;
  const WATER_PARTICLE_COUNT = 110;

  const RADAR_DURATION_MS = 10000;
  const SCANNER_DURATION_MS = 10000;
  const FREEZE_DURATION_MS = 10000;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const SMOKE_FUSE_MS = 3000;
  const SMOKE_DURATION_MS = 10000;
  const SMOKE_RADIUS = 70;
  const NVG_DURATION_MS = 10000;
  const NVG_RANGE_MULT = 2;
  const CRATE_ITEMS = ['radar', 'co2', 'scanner', 'smoke', 'nightvision', 'shotgun-ammo'];
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
  const hudTorchesEl = document.getElementById('hud-torches');
  const hudPhaseEl = document.getElementById('hud-phase');
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
  const MUSIC_KEY = 'goofy-horror-level15-music';
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
  let bossWellDelay = null;
  let bossWellFeedback = null;
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
    bossBassFilter.frequency.value = 420; // muffled, like it's rising up a stone shaft
    bossBassFilter.Q.value = 0.6;
    bossBassGain = audioCtx.createGain();
    bossBassGain.gain.value = 1;
    bossBassFilter.connect(bossBassGain);
    bossBassGain.connect(bossMusicGain);

    bossLeadGain = audioCtx.createGain();
    bossLeadGain.gain.value = 1;

    // A well-shaft echo: every drip/lead note repeats, fainter, four times
    // on a slow feedback loop -- the one thing that makes this boss's
    // theme read as "dwelling somewhere hollow and far down" rather than
    // just another quiet minor-key riff.
    bossWellDelay = audioCtx.createDelay(1);
    bossWellDelay.delayTime.value = 0.34;
    bossWellFeedback = audioCtx.createGain();
    bossWellFeedback.gain.value = 0.46;
    const wellDamp = audioCtx.createBiquadFilter();
    wellDamp.type = 'lowpass';
    wellDamp.frequency.value = 1800;
    bossLeadGain.connect(bossMusicGain);
    bossLeadGain.connect(bossWellDelay);
    bossWellDelay.connect(wellDamp);
    wellDamp.connect(bossWellFeedback);
    bossWellFeedback.connect(bossWellDelay);
    bossWellFeedback.connect(bossMusicGain);

    bossNoiseBuffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.08), audioCtx.sampleRate);
    const noiseData = bossNoiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

    bossStep = 0;
    scheduleBossStep();
  }

  // A hollow, dripping well-dweller theme -- low, sparse, mostly rests,
  // in place of every other boss's busier riff. The well-echo delay above
  // does most of the work; the notes themselves just need room for it to
  // be heard.
  const BOSS_NOTE = { D1: 36.71, F1: 43.65, G1: 49.0, A1: 55.0, C2: 65.41, D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0 };
  const BOSS_BASS_RIFF = [
    BOSS_NOTE.D1, 0, 0, 0, 0, 0, BOSS_NOTE.F1, 0,
    0, 0, BOSS_NOTE.G1, 0, 0, 0, 0, 0,
  ];
  const BOSS_LEAD_PHRASE = [BOSS_NOTE.D2, 0, BOSS_NOTE.A1, 0, BOSS_NOTE.C2, 0, BOSS_NOTE.G1, 0];

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
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.3);
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(env);
    env.connect(bossBassGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  // A single glassy drip -- a short, high triangle blip that falls
  // through the well-echo delay and repeats, fainter, trailing off into
  // the dark. Replaces the usual hi-hat.
  function playBossDrip(t, peak) {
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1900 + Math.random() * 300, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.09);
    env.gain.setValueAtTime(peak, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(env);
    env.connect(bossLeadGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  function scheduleBossStep() {
    if (!audioCtx || !bossBassGain) return;
    if (boss.defeated) { bossPulseTimer = null; return; }

    // Slow and sparse throughout -- a well-dweller doesn't rush, and the
    // long rests are what let the echo actually be heard between hits.
    const healthFrac = bossHealthFrac();
    const bpm = 58 + (1 - healthFrac) * 18;
    const stepDur = 60 / bpm / 4;
    const t = audioCtx.currentTime;
    const i = bossStep % 16;
    const bar = Math.floor(bossStep / 16) % 2;

    const bassNote = BOSS_BASS_RIFF[i];
    if (bassNote) playBossBassNote(bassNote, t, stepDur * 3.2, 0.22 + (1 - healthFrac) * 0.08);
    if (i === 0 || i === 10) playBossKick(t);
    if (i === 3 || i === 11 || i === 14) playBossDrip(t, 0.09 + (1 - healthFrac) * 0.04);

    if (bar === 1) {
      const leadNote = BOSS_LEAD_PHRASE[i % BOSS_LEAD_PHRASE.length];
      if (leadNote) playBossLeadNote(leadNote, t, stepDur * 2.4, 0.08);
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

  // A rising, airy rush for the wave of water that carries both players
  // off at the end of the drowning cutscene -- the same filtered-sweep
  // shape a wind howl would use, just as fitting for a flood.
  function playSnowGust() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const dur = WATERWAVE_CUTSCENE_MS / 1000;
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
      gameState = 'playing';
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
  const BEST_TIME_KEY = 'goofy-horror-best-level15';
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

  let bossHealth = BOSS_MAX_HEALTH;
  let gameState = 'playing'; // 'playing' | 'drowning' | 'wiped'
  let catchFlash = 0;

  function bossHealthFrac() {
    return clamp(bossHealth / BOSS_MAX_HEALTH, 0, 1);
  }

  // The freeze item used to stop the boss dead; now it only costs 20% of
  // whatever speed it's currently moving at, in or out of the chase.
  function speedMult(now) {
    return now < boss.frozenUntil ? FROZEN_SPEED_MULT : 1;
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

  // The boss: one giant mutation. A single object, same convention as
  // Level 5 and Level 10's bosses -- there's only ever one "real" boss
  // entity, even while it's torn itself into two clones for the split
  // attack (those live in a separate array below).
  function makeBoss() {
    return {
      x: 0,
      y: 0,
      radius: BOSS_RADIUS,
      seed: Math.random() * 100,
      lookDir: { x: 1, y: 0 },
      defeated: false,

      // Phase 2: once health drops to 15, the gate opens, a spike wall
      // seals off the retreat, and the boss permanently switches to
      // 'chase' -- no more picking from the phase-1 attack list.
      phase2: false,
      spikeWallActive: false,
      spikeWallY: 0,

      frozenUntil: 0,

      // ---- attack cycle ----
      // 'idle' | 'split' | 'iceshoot' | 'wallpush' | 'expand' | 'chase'
      phase: 'idle',
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      attackCount: 0,
      lastAttack: null,

      splitUntil: 0,

      nextIcicleAt: 0,
      iceshootUntil: 0,

      wallSubPhase: 'warning', // 'warning' | 'sweeping'
      wallStartedAt: 0,
      wallX: 0,
      wallGapY0: 0,
      wallGapY1: 0,

      expandSubPhase: 'windup', // 'windup' | 'growing'
      expandStartedAt: 0,
      expandRadius: 0,
    };
  }

  const boss = makeBoss();
  let clones = []; // split attack: [{x, y, radius, speed, seed, lookDir}]
  let icicles = []; // icicle shower / chase: [{x, y, dirX, dirY, seed, speed}]
  let waterParticles = []; // the drowning cutscene's foam: [{x, y, vx, vy, size, drift}]
  let freezeStartedAt = 0; // kept as the generic cutscene start-time field

  // Torches: the only way to actually hurt this boss. In phase 1 one
  // spawns somewhere on the open floor every TORCH_SPAWN_INTERVAL_MS as
  // long as fewer than TORCH_MAX_LIVE are already down; in phase 2 they
  // spawn at the hallway's fixed points instead (see updateTorches).
  let torches = []; // [{x, y, seed}]
  let nextTorchSpawnAt = 0;
  let hallwayTorchState = []; // [{x, y, nextAt}]

  const OPEN_FLOOR_TILES = (() => {
    const list = [];
    for (let y = 1; y < LEVEL.arenaRows - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        if (LEVEL.grid[y][x] === 'N') list.push({ x, y });
      }
    }
    return list;
  })();

  function spawnTorch() {
    const MIN_PLAYER_DIST = 90;
    for (let tries = 0; tries < 30; tries++) {
      const t = OPEN_FLOOR_TILES[Math.floor(Math.random() * OPEN_FLOOR_TILES.length)];
      const c = tileCenter(t.x, t.y);
      if (players.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < MIN_PLAYER_DIST)) continue;
      torches.push({ x: c.x, y: c.y, seed: Math.random() * 1000 });
      return;
    }
  }

  let crates = [];
  let radarUntil = 0;
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
    boss.spikeWallActive = false;
    boss.phase = 'idle'; boss.phaseStartedAt = 0; boss.nextIdleUntil = performance.now() + BOSS_INTRO_GRACE_MS;
    boss.attackCount = 0; boss.lastAttack = null;
    clones = [];
    icicles = [];
    waterParticles = [];
    freezeStartedAt = 0;

    bossHealth = BOSS_MAX_HEALTH;
    torches = [];
    nextTorchSpawnAt = performance.now() + TORCH_SPAWN_INTERVAL_MS;
    hallwayTorchState = LEVEL.hallwayTorchPoints.map((p) => ({ x: p.x, y: p.y, nextAt: 0 }));

    if (audioCtx && bossPulseTimer === null) { bossStep = 0; scheduleBossStep(); }

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)],
      opened: false, openedAt: 0,
    }));
    radarUntil = 0;
    scannerUntil = 0;
    smokeBombs = [];
    nvgUntil = 0;
    floatingTexts = [];
    resetExploration();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
    freezeFinished = false;
  }
  resetLevel();

  // ---- player movement & collision ----
  // 'G' (the phase-2 gate) is a solid wall until the boss drops to 15 HP
  // and the chase begins -- it opens for players and the boss at the
  // same moment.
  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#') return true;
    if (ch === 'G') return !boss.phase2;
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
    if (ch === 'N') return '#c9d8e0';
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

  // The minimap only ever shows the arena -- once phase 2 starts the
  // fight leaves it for a long straight corridor a traditional top-down
  // minimap doesn't help with, so it collapses to a plain "CHASE" plate
  // in the same footprint instead (keeps the stamina bar below it from
  // jumping around).
  function drawMinimap(vx, now) {
    const arenaH = LEVEL.arenaRows * TILE;
    const mh = Math.round(MINIMAP_W * LEVEL.arenaRows / COLS);
    const mx = vx + 8, my = 8;
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.65)';
    ctx.fillRect(mx - 3, my - 3, MINIMAP_W + 6, mh + 6);

    if (boss.phase2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx + 0.5, my + 0.5, MINIMAP_W - 1, mh - 1);
      ctx.fillStyle = 'rgba(200,60,60,0.85)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CHASE', mx + MINIMAP_W / 2, my + mh / 2 + 3);
      ctx.restore();
      return mh;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(exploredCanvas, 0, 0, COLS, LEVEL.arenaRows, mx, my, MINIMAP_W, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, my + 0.5, MINIMAP_W - 1, mh - 1);
    players.forEach((pl) => {
      const px = mx + (pl.x / WORLD_W) * MINIMAP_W;
      const py = my + (pl.y / arenaH) * mh;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pl.color;
      ctx.fill();
    });
    if (!boss.defeated) {
      const pulse = 0.6 + 0.4 * Math.sin(now / 180);
      torches.forEach((tr) => {
        const tmx = mx + (tr.x / WORLD_W) * MINIMAP_W;
        const tmy = my + (tr.y / arenaH) * mh;
        ctx.beginPath();
        ctx.arc(tmx, tmy, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,160,60,${pulse})`;
        ctx.shadowColor = '#ff8c3c';
        ctx.shadowBlur = 4;
        ctx.fill();
      });
    }

    const bx = mx + (boss.x / WORLD_W) * MINIMAP_W;
    const by = my + (boss.y / arenaH) * mh;
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#9a4ac9';
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
    const color = p.moveState === 'exhausted' ? '#c9403a' : p.moveState === 'sprinting' ? '#ffd27a' : '#3ddc84';
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
    ctx.fillStyle = boss.defeated ? '#8a8578' : '#c08ae8';
    const label = boss.defeated ? 'BOSS — DEFEATED' : `BOSS (${bossHealth}/${BOSS_MAX_HEALTH})`;
    ctx.fillText(label, bx + barW / 2, by - 4);

    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by, barW, barH);

    if (boss.defeated) {
      ctx.fillStyle = '#4a4640';
      ctx.fillRect(bx, by, barW * frac, barH);
    } else {
      const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
      grad.addColorStop(0, '#c08ae8');
      grad.addColorStop(0.5, '#7a3a9a');
      grad.addColorStop(1, '#3a1452');
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
    if (boss.defeated || torches.length === 0) return null;
    let best = null, bestD = Infinity;
    torches.forEach((tr) => {
      const d = Math.hypot(x - tr.x, y - tr.y);
      if (d < bestD) { bestD = d; best = tr; }
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

  function updateTorches(now) {
    if (boss.defeated) return;

    if (boss.phase2) {
      hallwayTorchState.forEach((pt) => {
        if (now < pt.nextAt) return;
        const occupied = torches.some((tr) => tr.x === pt.x * TILE + TILE / 2 && tr.y === pt.y * TILE + TILE / 2);
        if (occupied) return;
        torches.push({ x: pt.x * TILE + TILE / 2, y: pt.y * TILE + TILE / 2, seed: Math.random() * 1000 });
        pt.nextAt = Infinity; // cleared again once this torch is picked up
      });
    } else if (now >= nextTorchSpawnAt) {
      if (torches.length < TORCH_MAX_LIVE) spawnTorch();
      nextTorchSpawnAt = now + TORCH_SPAWN_INTERVAL_MS;
    }

    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      for (let i = torches.length - 1; i >= 0; i--) {
        const tr = torches[i];
        const trT = worldToTile(tr.x, tr.y);
        if (trT.x !== t.x || trT.y !== t.y) continue;
        torches.splice(i, 1);

        if (boss.phase2) {
          const pt = hallwayTorchState.find((hp) => hp.x === trT.x && hp.y === trT.y);
          if (pt) pt.nextAt = now + TORCH_RESPAWN_MS;
        }

        bossHealth = Math.max(0, bossHealth - TORCH_DAMAGE);
        spawnFloatingText(tr.x, tr.y, `-${TORCH_DAMAGE}`);
        playBombBlast();

        if (!boss.phase2 && bossHealth > 0 && bossHealth <= PHASE2_HEALTH_THRESHOLD) {
          enterPhase2(now);
        }

        if (bossHealth <= 0) {
          boss.defeated = true;
          gameState = 'drowning';
          freezeStartedAt = now;
          spawnWaterWave();
          playIceCrack();
          playSnowGust();
        }
      }
    });
  }

  // ---- boss AI ----
  // 'S' (the spawn safe zone) blocks the boss and its clones even though
  // it's open floor for players -- that's what keeps a respawn from
  // walking straight into an attack already in progress.
  function isWallForBoss(tx, ty) {
    const ch = tileChar(tx, ty);
    return isWallForPlayer(tx, ty) || ch === 'S';
  }

  // A boss-sized version of the player's canStandAt.
  function canBossStandAt(x, y) {
    const r = boss.radius * 0.7;
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return !isWallForBoss(t.x, t.y);
    });
  }

  const ALL_ATTACKS = ['split', 'iceshoot', 'wallpush', 'expand'];
  const CLONE_CATCH_RADIUS = SPLIT_CLONE_RADIUS * 1.2;
  let wallPassedPlayers = new Set();

  function nearestPlayer(x, y) {
    return players.reduce((a, b) => (Math.hypot(x - a.x, y - a.y) <= Math.hypot(x - b.x, y - b.y) ? a : b));
  }

  // This boss has no stun window -- its only real damage source is
  // torches, on their own independent spawn timer, so finishing an
  // attack just means picking the next one.
  function finishAttack(now) {
    boss.attackCount++;
    boss.phase = 'idle';
    boss.nextIdleUntil = now + BOSS_IDLE_MIN_MS + Math.random() * (BOSS_IDLE_MAX_MS - BOSS_IDLE_MIN_MS);
  }

  function pickAttack() {
    const choices = ALL_ATTACKS.filter((a) => a !== boss.lastAttack);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // A generic, radius-aware version of canBossStandAt -- used for the
  // (smaller) split clones.
  function canEntityStandAt(x, y, r) {
    const corners = [
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => {
      const t = worldToTile(cx, cy);
      return !isWallForBoss(t.x, t.y);
    });
  }

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'split') {
      boss.splitUntil = now + SPLIT_DURATION_MS;
      const a = Math.random() * Math.PI * 2;
      clones = [
        { x: boss.x, y: boss.y, radius: SPLIT_CLONE_RADIUS, speed: SPLIT_SLOW_SPEED, seed: Math.random() * 100, lookDir: { x: Math.cos(a), y: Math.sin(a) } },
        { x: boss.x, y: boss.y, radius: SPLIT_CLONE_RADIUS, speed: SPLIT_FAST_SPEED, seed: Math.random() * 100, lookDir: { x: -Math.cos(a), y: -Math.sin(a) } },
      ];
      playBossWindup();
    } else if (kind === 'iceshoot') {
      boss.iceshootUntil = now + ICICLESHOOT_DURATION_MS;
      boss.nextIcicleAt = now;
      icicles = [];
      playBossWindup();
    } else if (kind === 'wallpush') {
      boss.wallSubPhase = 'warning';
      boss.wallStartedAt = now;
      boss.wallX = TILE;
      const gapRows = Math.max(1, LEVEL.arenaRows - 2 - WALLPUSH_GAP_TILES);
      const gapStart = 1 + Math.floor(Math.random() * gapRows);
      boss.wallGapY0 = gapStart;
      boss.wallGapY1 = gapStart + WALLPUSH_GAP_TILES;
      wallPassedPlayers = new Set();
      playBossWindup();
    } else if (kind === 'expand') {
      boss.x = WORLD_W / 2;
      boss.y = (LEVEL.arenaRows * TILE) / 2;
      boss.expandSubPhase = 'windup';
      boss.expandStartedAt = now;
      boss.expandRadius = 0;
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
    const step = BOSS_IDLE_SPEED * speedMult(now) * dt;
    const nx = boss.x + (dx / d) * step, ny = boss.y + (dy / d) * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx;
    if (canBossStandAt(boss.x, ny)) boss.y = ny;
    boss.lookDir = { x: dx / d, y: dy / d };
  }

  // 1. Split: two clones hunt independently at their own fixed speeds
  // until the timer runs out, then collapse back into one boss at their
  // midpoint. The main boss body isn't drawn and can't be touched while
  // this is active -- the clones are the only threat.
  function updateBossSplit(now, dt) {
    if (now >= boss.splitUntil) {
      if (clones.length) {
        boss.x = clones.reduce((s, c) => s + c.x, 0) / clones.length;
        boss.y = clones.reduce((s, c) => s + c.y, 0) / clones.length;
      }
      clones = [];
      finishAttack(now);
      return;
    }
    clones.forEach((c) => {
      const target = nearestPlayer(c.x, c.y);
      const dx = target.x - c.x, dy = target.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        const step = c.speed * speedMult(now) * dt;
        const nx = c.x + (dx / d) * step, ny = c.y + (dy / d) * step;
        if (canEntityStandAt(nx, c.y, c.radius * 0.7)) c.x = nx;
        if (canEntityStandAt(c.x, ny, c.radius * 0.7)) c.y = ny;
        c.lookDir = { x: dx / d, y: dy / d };
      }
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - c.x, p.y - c.y) < CLONE_CATCH_RADIUS) triggerCaught(p, now);
      });
    });
  }

  // Moves and collides every icicle currently in flight, regardless of
  // which attack (or phase) fired it -- each carries its own speed, so
  // phase 1's shower and phase 2's continuous chase fire can coexist with
  // the same physics. Runs every frame so nothing already airborne just
  // freezes in place the instant its attack ends.
  function updateIciclesPhysics(now, dt) {
    for (let i = icicles.length - 1; i >= 0; i--) {
      const ic = icicles[i];
      const nx = ic.x + ic.dirX * ic.speed * dt;
      const ny = ic.y + ic.dirY * ic.speed * dt;
      const t = worldToTile(nx, ny);
      if (tileChar(t.x, t.y) === '#' || nx < 0 || ny < 0 || nx > WORLD_W || ny > WORLD_H) {
        icicles.splice(i, 1);
        continue;
      }
      ic.x = nx; ic.y = ny;
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
        if (Math.hypot(p.x - ic.x, p.y - ic.y) < ICICLE_HIT_RADIUS) triggerCaught(p, now);
      });
    }
  }

  // 2. Icicle shower: fires one shard at each player's current position
  // every ICICLE_FIRE_INTERVAL_MS while the window is open, then finishes
  // once the window closes -- anything still airborne keeps flying and
  // colliding via updateIciclesPhysics regardless.
  function updateBossIceshoot(now, dt) {
    if (now < boss.iceshootUntil && now >= boss.nextIcicleAt) {
      players.forEach((p) => {
        const dx = p.x - boss.x, dy = p.y - boss.y;
        const d = Math.hypot(dx, dy) || 1;
        icicles.push({ x: boss.x, y: boss.y, dirX: dx / d, dirY: dy / d, seed: Math.random() * 100, speed: ICICLE_PROJECTILE_SPEED });
      });
      boss.nextIcicleAt = now + ICICLE_FIRE_INTERVAL_MS;
      playTentacleStrike();
    }
    if (now >= boss.iceshootUntil) finishAttack(now);
  }

  // 3. Wall push: a solid line sweeps right from the left wall at 1.5x
  // player speed. The gap's row range never moves; a player is crushed
  // the instant the sweeping line reaches their column while they're
  // outside it.
  function updateBossWallpush(now, dt) {
    if (boss.wallSubPhase === 'warning') {
      if (now - boss.wallStartedAt >= WALLPUSH_WARNING_MS) {
        boss.wallSubPhase = 'sweeping';
      }
      return;
    }
    boss.wallX += WALLPUSH_SPEED * speedMult(now) * dt;
    players.forEach((p) => {
      if (wallPassedPlayers.has(p) || p.caught || now < p.invulnerableUntil) return;
      if (boss.wallX < p.x) return;
      wallPassedPlayers.add(p);
      const t = worldToTile(p.x, p.y);
      if (t.y < boss.wallGapY0 || t.y >= boss.wallGapY1) {
        if (!isHidden(p, now)) triggerCaught(p, now);
      }
    });
    if (boss.wallX > WORLD_W + TILE) finishAttack(now);
  }

  // 4. Expand: the boss plants itself at the arena center and a hazard
  // ring grows out from its body -- EXPAND_MAX_RADIUS is well short of
  // the distance to any corner, so the corners always stay safe.
  function updateBossExpand(now, dt) {
    if (boss.expandSubPhase === 'windup') {
      if (now - boss.expandStartedAt >= EXPAND_WINDUP_MS) {
        boss.expandSubPhase = 'growing';
        boss.expandStartedAt = now;
      }
      return;
    }
    const elapsed = now - boss.expandStartedAt;
    boss.expandRadius = Math.min(EXPAND_MAX_RADIUS, EXPAND_MAX_RADIUS * (elapsed / EXPAND_DURATION_MS));
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      if (Math.hypot(p.x - boss.x, p.y - boss.y) < boss.expandRadius) triggerCaught(p, now);
    });
    if (elapsed >= EXPAND_DURATION_MS) {
      boss.expandRadius = 0;
      finishAttack(now);
    }
  }

  // Phase 2: triggered once, at 15 HP. The gate opens, a spike wall seals
  // off the retreat behind wherever the boss currently is, and it locks
  // into 'chase' for good -- no more picking from the attack list.
  function enterPhase2(now) {
    boss.phase2 = true;
    boss.phase = 'chase';
    boss.spikeWallActive = true;
    boss.spikeWallY = boss.y - 60;
    boss.nextIcicleAt = now + CHASE_ICICLE_INTERVAL_MS;
    clones = [];
    spawnFloatingText(boss.x, boss.y, 'IT TEARS THE WALL OPEN');
    playIceCrack();
  }

  // The retreat-sealing spike wall: a stationary line just north of
  // wherever the boss was standing when phase 2 began, damaging anyone
  // who touches it. It only matters until the boss itself has committed
  // to the hallway -- once it's past the gate, there's nothing left to
  // sneak around it for.
  function updateSpikeWall(now) {
    if (!boss.spikeWallActive) return;
    if (boss.y >= LEVEL.hallway.y0 * TILE) {
      boss.spikeWallActive = false;
      return;
    }
    const BAND = 16;
    players.forEach((p) => {
      if (p.caught || now < p.invulnerableUntil || isHidden(p, now)) return;
      if (Math.abs(p.y - boss.spikeWallY) < BAND) triggerCaught(p, now);
    });
  }

  // Phase 2's chase: the boss hunts forever, down the corridor's own Y
  // axis. Falling behind the nearest player lets it ease off; pulling
  // ahead of it (toward the exit) makes it put on a burst of speed --
  // neither sprinting ahead nor stalling behind is ever free.
  function updateBossChase(now, dt) {
    const target = nearestPlayer(boss.x, boss.y);
    const diff = target.y - boss.y;
    let speed = CHASE_SPEED_BASE;
    if (diff > CHASE_PACE_MARGIN) speed = CHASE_SPEED_AHEAD;
    else if (diff < -CHASE_PACE_MARGIN) speed = CHASE_SPEED_BEHIND;
    speed *= speedMult(now);

    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = speed * dt;
      const nx = boss.x + (dx / d) * step, ny = boss.y + (dy / d) * step;
      if (canBossStandAt(nx, boss.y)) boss.x = nx;
      if (canBossStandAt(boss.x, ny)) boss.y = ny;
      boss.lookDir = { x: dx / d, y: dy / d };
    }

    if (now >= boss.nextIcicleAt) {
      players.forEach((p) => {
        const idx = p.x - boss.x, idy = p.y - boss.y;
        const id = Math.hypot(idx, idy) || 1;
        icicles.push({ x: boss.x, y: boss.y, dirX: idx / id, dirY: idy / id, seed: Math.random() * 100, speed: CHASE_ICICLE_SPEED });
      });
      boss.nextIcicleAt = now + CHASE_ICICLE_INTERVAL_MS;
      playTentacleStrike();
    }
  }

  function updateBoss(now, dt) {
    if (boss.defeated) return;
    updateIciclesPhysics(now, dt);

    switch (boss.phase) {
      case 'idle': updateBossIdle(now, dt); break;
      case 'split': updateBossSplit(now, dt); break;
      case 'iceshoot': updateBossIceshoot(now, dt); break;
      case 'wallpush': updateBossWallpush(now, dt); break;
      case 'expand': updateBossExpand(now, dt); break;
      case 'chase': updateBossChase(now, dt); break;
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
    // While split, the main body is off-screen and the clones carry their
    // own contact check inside updateBossSplit.
    if (boss.phase === 'split') return;
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

  // ---- the drowning cutscene: once the boss finally goes down, a wave
  // of water sweeps up the screen before both players are carried off to
  // the next level ----
  function spawnWaterWave() {
    waterParticles = [];
    for (let i = 0; i < WATER_PARTICLE_COUNT; i++) {
      waterParticles.push({
        x: Math.random() * 920,
        y: 340 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 40,
        vy: -90 - Math.random() * 60,
        size: 1.5 + Math.random() * 3,
        drift: Math.random() * Math.PI * 2,
      });
    }
  }

  function updateWaterWave(dt) {
    waterParticles.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.drift += dt * 4;
      if (s.y < -10) { s.y = 350; s.x = Math.random() * 920; }
    });
  }

  function drawWaterWave(g, t) {
    const waveT = clamp((t - freezeStartedAt) / WATERWAVE_CUTSCENE_MS, 0, 1);
    const level = 340 * (1 - waveT);
    g.save();
    g.fillStyle = 'rgba(20,70,130,0.88)';
    g.fillRect(0, level, 920, 340 - level);
    g.strokeStyle = 'rgba(140,210,240,0.8)';
    g.lineWidth = 4;
    g.beginPath();
    for (let x = 0; x <= 920; x += 20) {
      const y = level + Math.sin(x * 0.04 + t * 0.006) * 6;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    waterParticles.forEach((s) => {
      const wob = Math.sin(s.drift) * 5;
      g.beginPath();
      g.arc(s.x + wob, s.y, s.size, 0, Math.PI * 2);
      g.fillStyle = 'rgba(210,240,255,0.8)';
      g.fill();
    });
    g.restore();
  }

  // Runs while the boss drowns: records the win the instant the cutscene
  // is over (same "freeze elapsedMs the moment gameState leaves 'playing'"
  // pattern every other boss cutscene uses) and warps onward to the next
  // level.
  function updateWaterCutscene(now) {
    if (freezeFinished || now - freezeStartedAt < WATERWAVE_CUTSCENE_MS) return;
    freezeFinished = true;
    if (!bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
    }
    if (window.GoofyStory) window.GoofyStory.completeLevel(15);
    window.location.href = 'level16.html';
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
    const halfW = visibleHalfW(), halfH = visibleHalfH();
    const minTX = Math.max(0, Math.floor((camX - halfW) / TILE) - 1);
    const maxTX = Math.min(COLS - 1, Math.ceil((camX + halfW) / TILE) + 1);
    const minTY = Math.max(0, Math.floor((camY - halfH) / TILE) - 1);
    const maxTY = Math.min(ROWS - 1, Math.ceil((camY + halfH) / TILE) + 1);
    for (let y = minTY; y <= maxTY; y++) {
      for (let x = minTX; x <= maxTX; x++) {
        const ch = LEVEL.grid[y][x];
        const px = x * TILE, py = y * TILE;
        let color;
        switch (ch) {
          case '#': color = '#262629'; break;
          case 'N': color = '#d8e6ee'; break;
          case 'S': color = '#2a3a42'; break;
          case 'G': color = boss.phase2 ? floorShade(x, y) : '#3a4552'; break;
          default: color = floorShade(x, y);
        }
        g.fillStyle = color;
        g.fillRect(px, py, TILE, TILE);

        if (ch === '#' || (ch === 'G' && !boss.phase2)) {
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
        if (ch === 'N') {
          g.fillStyle = 'rgba(255,255,255,0.3)';
          const seed = (x * 13 + y * 19) % 11;
          g.beginPath();
          g.arc(px + 10 + (seed % 4) * 4, py + 10 + ((seed * 2) % 4) * 4, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    // The gate glows a warning amber while closed, across its whole
    // width, so it reads as "this is where it's going to open" well
    // before the boss actually drops to 15 HP.
    if (!boss.phase2) {
      const gx0 = LEVEL.gate.x0 * TILE, gx1 = (LEVEL.gate.x1 + 1) * TILE;
      const gy = LEVEL.gate.y * TILE;
      g.strokeStyle = 'rgba(255,190,60,0.5)';
      g.lineWidth = 3;
      g.strokeRect(gx0 + 3, gy + 3, gx1 - gx0 - 6, TILE - 6);
    }

    drawCorpses(g);
    drawBloodSplatters(g);
    drawCrates(g);
    drawTorches(g, now);
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

  // A single icicle shard in flight -- a tapered sliver pointed the way
  // it's travelling, same linear-gradient technique as every other icicle
  // on this site, just oriented along its own velocity instead of always
  // pointing down.
  function drawIcicleProjectiles(g) {
    icicles.forEach((ic) => {
      g.save();
      g.translate(ic.x, ic.y);
      g.rotate(Math.atan2(ic.dirY, ic.dirX));
      g.beginPath();
      g.moveTo(-18, -7);
      g.lineTo(-18, 7);
      g.lineTo(22, 0);
      g.closePath();
      const grad = g.createLinearGradient(-18, 0, 22, 0);
      grad.addColorStop(0, 'rgba(50,90,130,0.75)');
      grad.addColorStop(1, 'rgba(90,150,190,0.95)');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(180,220,240,0.7)';
      g.lineWidth = 1.2;
      g.stroke();
      g.restore();
    });
  }

  // The split clones: smaller, single-head versions of the mutation --
  // enough of a family resemblance to read as "pieces of the same thing"
  // without the full three-head silhouette.
  function drawClones(g, t) {
    clones.forEach((c) => {
      g.save();
      g.translate(c.x, c.y);
      drawBlobBody(g, c.radius, '#7a3a9a', '#3a1452', c.seed, t);
      drawMonsterEye(g, c);
      g.restore();
    });
  }

  // The wall-push attack's ice barrier -- a solid purple-frost slab
  // sweeping across the arena in world space, with a lit gap punched
  // through it at the attack's chosen row range.
  // One jagged slab of the ice wall -- a rigid, angular silhouette (not a
  // plain rectangle) with a row of icicle shards jutting out of its
  // leading edge, pointing the way it's travelling.
  function drawIceWallSlab(g, cx, yTop, yBottom, thickness, warning) {
    if (yBottom <= yTop) return;
    const halfT = thickness / 2;
    const jagCount = Math.max(2, Math.round((yBottom - yTop) / 22));
    const jagH = (yBottom - yTop) / jagCount;

    g.beginPath();
    g.moveTo(cx - halfT, yTop);
    for (let i = 0; i <= jagCount; i++) {
      const y = yTop + i * jagH;
      const x = cx + halfT + (i % 2 === 0 ? 4 : -4);
      g.lineTo(x, y);
    }
    g.lineTo(cx - halfT, yBottom);
    g.closePath();

    const grad = g.createLinearGradient(cx - halfT, 0, cx + halfT, 0);
    if (warning) {
      grad.addColorStop(0, 'rgba(140,195,230,0.3)');
      grad.addColorStop(1, 'rgba(180,220,245,0.45)');
    } else {
      grad.addColorStop(0, 'rgba(120,180,220,0.8)');
      grad.addColorStop(1, 'rgba(190,230,250,0.95)');
    }
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = 'rgba(225,245,255,0.8)';
    g.lineWidth = 2;
    g.stroke();

    if (!warning) {
      const spikeCount = Math.max(1, Math.round((yBottom - yTop) / 30));
      for (let i = 0; i < spikeCount; i++) {
        const sy = yTop + ((i + 0.5) / spikeCount) * (yBottom - yTop);
        const len = 16 + (i % 3) * 5;
        g.beginPath();
        g.moveTo(cx + halfT - 2, sy - 6);
        g.lineTo(cx + halfT - 2, sy + 6);
        g.lineTo(cx + halfT + len, sy);
        g.closePath();
        const sgrad = g.createLinearGradient(cx + halfT, sy, cx + halfT + len, sy);
        sgrad.addColorStop(0, 'rgba(200,235,255,0.7)');
        sgrad.addColorStop(1, 'rgba(230,248,255,0.3)');
        g.fillStyle = sgrad;
        g.fill();
      }
    }
  }

  function drawWallPush(g) {
    if (boss.phase !== 'wallpush') return;
    const gapTop = boss.wallGapY0 * TILE;
    const gapBottom = boss.wallGapY1 * TILE;
    const arenaBottom = LEVEL.arenaRows * TILE;
    const wallThickness = 26;
    const warning = boss.wallSubPhase === 'warning';
    g.save();
    drawIceWallSlab(g, boss.wallX, 0, gapTop, wallThickness, warning);
    drawIceWallSlab(g, boss.wallX, gapBottom, arenaBottom, wallThickness, warning);
    // the gap itself, lit so it reads as the way through rather than a gap
    // in the rendering
    g.strokeStyle = 'rgba(255,230,150,0.8)';
    g.lineWidth = 3;
    g.strokeRect(boss.wallX - wallThickness / 2, gapTop, wallThickness, gapBottom - gapTop);
    g.restore();
  }

  // The torches scattered in phase 1, or waiting at fixed points down the
  // hallway in phase 2 -- a simple stick-and-flame, distinct from every
  // other pickup on this site.
  function drawTorches(g, now) {
    torches.forEach((tr) => {
      g.save();
      g.translate(tr.x, tr.y);
      const flick = 0.75 + Math.sin(now * 0.012 + tr.seed) * 0.25;
      g.fillStyle = '#5a4428';
      g.fillRect(-2.5, -2, 5, 16);
      g.strokeStyle = '#2a1d10';
      g.lineWidth = 1;
      g.strokeRect(-2.5, -2, 5, 16);
      const glow = g.createRadialGradient(0, -14, 1, 0, -14, 14 * flick);
      glow.addColorStop(0, 'rgba(255,200,90,0.6)');
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, -14, 14 * flick, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-4, -4);
      g.quadraticCurveTo(-5 * flick, -12, 0, -18 * flick);
      g.quadraticCurveTo(5 * flick, -12, 4, -4);
      g.closePath();
      const flame = g.createLinearGradient(0, -4, 0, -18);
      flame.addColorStop(0, '#ff5a1e');
      flame.addColorStop(0.6, '#ffb23c');
      flame.addColorStop(1, '#fff0a0');
      g.fillStyle = flame;
      g.fill();
      g.restore();
    });
  }

  // The retreat-sealing spike wall: a jagged red-lit line across the
  // arena, same "rigid, angular" silhouette technique as the wall-push
  // attack's ice slabs, just a single stationary band instead of a
  // sweeping pair.
  function drawSpikeWall(g) {
    if (!boss.spikeWallActive) return;
    const y = boss.spikeWallY;
    const spikeCount = Math.round(WORLD_W / 26);
    g.save();
    g.beginPath();
    g.moveTo(0, y - 10);
    for (let i = 0; i <= spikeCount; i++) {
      const x = (i / spikeCount) * WORLD_W;
      const sy = i % 2 === 0 ? y - 10 : y + 10;
      g.lineTo(x, sy);
    }
    g.lineTo(WORLD_W, y - 10);
    g.closePath();
    g.fillStyle = 'rgba(150,20,20,0.75)';
    g.fill();
    g.strokeStyle = 'rgba(255,90,70,0.8)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
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

  // ---- the boss: the Mutation, grown huge and partly frozen ----

  // A fleshy, lit blob body -- ported from Level 12's mutation, unchanged.
  function drawBlobBody(g, radius, fillColor, shadowColor, seed, t, opts) {
    opts = opts || {};
    const points = 14;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius
        + Math.sin(t * 0.006 + i * 1.7 + seed) * radius * 0.1
        + Math.sin(t * 0.0021 + i * 3.3 + seed * 1.7) * radius * 0.04;
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const base = g.createRadialGradient(-radius * 0.25, -radius * 0.3, radius * 0.1, 0, 0, radius * 1.05);
    base.addColorStop(0, opts.core || shade(fillColor, 0.22));
    base.addColorStop(0.55, fillColor);
    base.addColorStop(1, opts.rim || shade(fillColor, -0.35));
    g.fillStyle = base;
    g.shadowColor = shadowColor;
    g.shadowBlur = Math.min(radius * 0.4, 18);
    g.fill();
    g.shadowBlur = 0;

    g.save();
    trace();
    g.clip();

    g.beginPath();
    g.ellipse(-radius * 0.32, -radius * 0.38, radius * 0.5, radius * 0.32, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fill();

    g.strokeStyle = opts.veinColor || 'rgba(0,0,0,0.2)';
    g.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + seed;
      g.beginPath();
      g.moveTo(Math.cos(a) * radius * 0.15, Math.sin(a) * radius * 0.15);
      g.lineTo(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88);
      g.stroke();
    }

    g.restore();
  }

  // The mutation's single eye -- ported from Level 12, unchanged.
  function drawMonsterEye(g, m) {
    const lookDir = m.lookDir;
    const ex = m.radius * 0.62, ey = ex * 0.8;

    g.save();
    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.clip();

    const sclera = g.createRadialGradient(-ex * 0.2, -ey * 0.25, 1, 0, 0, ex * 1.15);
    sclera.addColorStop(0, '#faf1e4');
    sclera.addColorStop(0.55, '#dcc4b2');
    sclera.addColorStop(1, '#6b5142');
    g.fillStyle = sclera;
    g.fillRect(-ex, -ey, ex * 2, ey * 2);

    g.strokeStyle = 'rgba(170,25,25,0.38)';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.15 + m.seed;
      g.lineWidth = 0.5 + ((i * 13) % 3) * 0.35;
      g.beginPath();
      g.moveTo(Math.cos(a) * ex, Math.sin(a) * ey);
      g.quadraticCurveTo(Math.cos(a + 0.1) * ex * 0.5, Math.sin(a - 0.1) * ey * 0.5, Math.cos(a) * ex * 0.08, Math.sin(a) * ey * 0.08);
      g.stroke();
    }

    const ix = lookDir.x * ex * 0.32, iy = lookDir.y * ey * 0.32;
    const irisR = ex * 0.48;
    const iris = g.createRadialGradient(ix - irisR * 0.22, iy - irisR * 0.22, 1, ix, iy, irisR);
    iris.addColorStop(0, '#e8903f');
    iris.addColorStop(0.45, '#c96a2e');
    iris.addColorStop(0.8, '#7a2f10');
    iris.addColorStop(1, '#200a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

    g.save();
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + m.seed * 0.3;
      g.beginPath();
      g.moveTo(ix + Math.cos(a) * irisR * 0.35, iy + Math.sin(a) * irisR * 0.35);
      g.lineTo(ix + Math.cos(a) * irisR, iy + Math.sin(a) * irisR);
      g.stroke();
    }
    g.restore();

    g.beginPath();
    g.arc(ix, iy, irisR * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#050202';
    g.fill();

    g.beginPath();
    g.arc(ix - irisR * 0.32, iy - irisR * 0.32, irisR * 0.22, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fill();
    g.beginPath();
    g.arc(ix - irisR * 0.28, iy - irisR * 0.3, irisR * 0.11, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fill();

    g.beginPath();
    g.ellipse(0, -ey * 0.32, ex * 0.98, ey * 0.6, 0, Math.PI, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fill();

    g.restore();

    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(15,4,4,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
  }

  // "Partly frozen": a handful of icicle shards clinging to the lower
  // half of the body, same tapered-shard technique as every other icicle
  // on this site -- only the bottom arc, not the whole silhouette, so it
  // still reads as a mutation that's half-iced-over rather than a
  // different creature entirely.
  const FROST_ANCHORS = (() => {
    const anchors = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.7; // bottom arc only
      anchors.push({ angle: a, len: 0.3 + (i % 3) * 0.08 });
    }
    return anchors;
  })();

  function drawFrostPatches(g, radius) {
    FROST_ANCHORS.forEach((f) => {
      const ax = Math.cos(f.angle) * radius * 0.92, ay = Math.sin(f.angle) * radius * 0.92;
      const len = radius * f.len;
      const nx = Math.cos(f.angle), ny = Math.sin(f.angle);
      const px = -ny, py = nx;
      g.beginPath();
      g.moveTo(ax + px * radius * 0.08, ay + py * radius * 0.08);
      g.lineTo(ax - px * radius * 0.08, ay - py * radius * 0.08);
      g.lineTo(ax + nx * len, ay + ny * len);
      g.closePath();
      const grad = g.createLinearGradient(ax, ay, ax + nx * len, ay + ny * len);
      grad.addColorStop(0, 'rgba(210,240,255,0.7)');
      grad.addColorStop(1, 'rgba(170,220,250,0.25)');
      g.fillStyle = grad;
      g.fill();
    });
    g.beginPath();
    g.ellipse(0, radius * 0.45, radius * 0.85, radius * 0.4, 0, 0, Math.PI);
    g.fillStyle = 'rgba(200,235,255,0.18)';
    g.fill();
  }

  function drawMutationBoss(g, t) {
    const r = boss.radius;
    const sideR = r * 0.6;
    // Bright red once phase 2 starts -- same palette shape (a dark
    // tentacle tone, a dim side-head tone, a bright core tone) as the
    // purple it wore all through phase 1, just shifted hue.
    const tentColor = boss.phase2 ? '#8a1414' : '#4a1a6a';
    const sideColor = boss.phase2 ? '#b02424' : '#6a2a8a';
    const coreColor = boss.phase2 ? '#d83a3a' : '#7a3a9a';
    const shadowColor = boss.phase2 ? '#4a0a0a' : '#3a1452';

    [-1, 1].forEach((side) => {
      const tx = side * r * 0.9, ty = r * 0.5;
      const wobble = Math.sin(t * 0.004 + side) * r * 0.1;
      drawTaperedTentacle(g, tx, ty + wobble, tx * 0.5, (ty + wobble) * 0.5, r * 0.16, tentColor);
    });

    [-1, 1].forEach((side) => {
      g.save();
      g.translate(side * r * 0.7, r * 0.35);
      drawBlobBody(g, sideR, sideColor, shadowColor, boss.seed + side * 7, t);
      g.restore();
    });

    drawBlobBody(g, r, coreColor, shadowColor, boss.seed, t);

    drawMonsterEye(g, boss);
    g.save();
    g.translate(-r * 0.7, r * 0.35);
    drawMonsterEye(g, { radius: sideR, lookDir: boss.lookDir, seed: boss.seed + 3 });
    g.restore();

    if (!boss.phase2) drawFrostPatches(g, r);
  }

  function drawExpandHazard(g, t) {
    if (boss.expandSubPhase !== 'growing' || boss.expandRadius <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
    g.beginPath();
    g.arc(0, 0, boss.expandRadius, 0, Math.PI * 2);
    g.fillStyle = `rgba(154,74,201,${0.12 + pulse * 0.08})`;
    g.fill();
    g.strokeStyle = `rgba(220,180,255,${0.4 + pulse * 0.3})`;
    g.lineWidth = 3;
    g.stroke();
  }

  function drawBoss(g, t) {
    if (boss.phase === 'split') return; // the clones stand in for it

    g.save();
    g.translate(boss.x, boss.y);

    if (boss.phase === 'expand') drawExpandHazard(g, t);

    if (!boss.defeated) drawMutationBoss(g, t);
    else {
      g.save();
      g.globalAlpha = 0.6;
      drawMutationBoss(g, t);
      g.restore();
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
    const zoom = currentZoom();
    const worldToScreen = (wx, wy) => ({ x: (wx - camX) * zoom + VIEW_W / 2, y: (wy - camY) * zoom + VIEW_H / 2 });
    const nvgMult = now < nvgUntil ? NVG_RANGE_MULT : 1;

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 140 * zoom * nvgMult, 1);
      punchLight(maskCtx, s.x, s.y, 320 * zoom * nvgMult, 0.85);
    });

    const bs = worldToScreen(boss.x, boss.y);
    punchLight(maskCtx, bs.x, bs.y, boss.radius * 2.4 * zoom, 0.5);
  }

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const zoom = currentZoom();
    const halfW = visibleHalfW(), halfH = visibleHalfH();
    // Phase 1 clamps against the arena's own height so the camera
    // collapses to a fixed, whole-arena view the same way it always has;
    // phase 2 clamps against the full world (arena + hallway) so it
    // follows the player normally down the corridor.
    const camWorldH = boss.phase2 ? WORLD_H : LEVEL.arenaRows * TILE;
    const camX = clamp(p.x, halfW, WORLD_W - halfW);
    const camY = clamp(p.y, halfH, camWorldH - halfH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.fillStyle = '#050308';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2, VIEW_H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, camX, camY, now);
    drawSmokeBombs(ctx, now);
    drawWallPush(ctx);
    drawSpikeWall(ctx);
    drawIcicleProjectiles(ctx);
    drawBoss(ctx, now);
    drawClones(ctx, now);
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

    drawBossHealthBar(vx, now);
    drawProximityWarning(vx, Math.hypot(p.x - boss.x, p.y - boss.y), now);
    drawRadar(vx, p, now);
    drawScanner(vx, p, now);
    drawShotgunHud(vx, p);
    const minimapH = drawMinimap(vx, now);
    drawStaminaBar(vx, p, minimapH);

    if (p.caught) drawCutsceneOverlay(vx, p, now);

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
    hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : `Boss: ${hp} HP`;
    hudBossEl.classList.toggle('done', boss.defeated);
    hudPhaseEl.textContent = boss.phase2 ? 'Phase: 2 — CHASE' : 'Phase: 1';
    hudPhaseEl.classList.toggle('done', boss.phase2);
    if (hudTorchesEl) {
      hudTorchesEl.textContent = boss.defeated ? 'Torches: --' : `Torches: ${torches.length} live`;
      hudTorchesEl.classList.toggle('done', torches.length > 0 && !boss.defeated);
    }

    if (hudTimerEl) hudTimerEl.textContent = `Time: ${formatTime(elapsedMs)}`;
    if (hudBestEl) hudBestEl.textContent = `Best: ${bestMs === null ? '--:--' : formatTime(bestMs)}`;
  }

  let lastFrameTime = null;

  function loop(now) {
    try {
    const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if (gameState === 'playing') {
      elapsedMs = now - runStartTime;
      updateInputMovement(now, dt);
      updateCrates(now);
      updateSmokeBombs(now);
      updateTorches(now);
      updateBoss(now, dt);
      updateSpikeWall(now);
      updateShotgunDefense(now);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
    } else if (gameState === 'drowning') {
      updateWaterWave(dt);
      updateWaterCutscene(now);
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    renderViewport(1, now);
    drawDivider();

    if (gameState === 'drowning') {
      const waveT = clamp((now - freezeStartedAt) / WATERWAVE_CUTSCENE_MS, 0, 1);
      drawWaterWave(ctx, now);
      if (waveT > 0.3) {
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(230,245,255,${Math.min(1, (waveT - 0.3) * 2.5)})`;
        ctx.fillText('THE CURRENT TAKES IT...', canvas.width / 2, canvas.height / 2);
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
