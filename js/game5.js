(function () {
  const LEVEL = window.LEVEL5;
  const TILE = LEVEL.tileSize;
  const COLS = LEVEL.cols;
  const ROWS = LEVEL.rows;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;

  const VIEW_W = 460;
  const VIEW_H = 340;
  // The arena is huge and the boss is the whole point of the level, so the
  // camera sits noticeably further back than the other levels' 1:1 view --
  // enough to see the boss's full patrol loop at once instead of just
  // whatever's a few tiles away.
  const ZOOM = 0.55;
  const VISIBLE_HALF_W = (VIEW_W / 2) / ZOOM;
  const VISIBLE_HALF_H = (VIEW_H / 2) / ZOOM;

  // Speeds are px/second and movement is scaled by the real elapsed time
  // each frame (see `dt` in loop()) rather than a fixed px/frame step --
  // fixed-per-frame movement made real-world speed drift with the frame
  // rate, which showed up as random-feeling slowdowns whenever a frame
  // took longer than usual (e.g. a big tile grid redraw).
  const PLAYER_RADIUS = 10;
  const PLAYER_SPEED = 112.5;

  // The boss is a single Crawler (Level 1) blown up to 8x normal size and
  // set alight -- slower and heavier than the original, but its sheer bulk
  // and reach more than make up for it. Everything below is scaled off the
  // original Crawler's numbers (radius 16, catch 20) rather than picked
  // arbitrarily.
  const BOSS_RADIUS = 16 * 8;
  const BOSS_LURE_SPEED = PLAYER_SPEED * 0.5;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.25;
  const REPATH_MS = 500; // only used while lured by a meat item -- see the 'lured' boss state

  // ---- boss attack cycle ----
  // Five attacks fire in random order for as long as the boss is alive,
  // each separated by a short recovery pause where it drifts toward
  // whoever's nearest. Every ATTACKS_PER_STUN'th attack it's stunned
  // instead -- see BOMB_DAMAGE_* for why that window matters.
  const BOSS_IDLE_SPEED = PLAYER_SPEED * 0.35;
  const BOSS_IDLE_MIN_MS = 700;
  const BOSS_IDLE_MAX_MS = 1400;

  // 1. Spin: bounces off the arena walls DVD-logo style at high speed.
  const SPIN_DURATION_MS = 5000;
  const SPIN_SPEED = PLAYER_SPEED * 5;

  // 2. Throw: 3 chunks of rubble land near the players after a telegraphed
  // delay -- a red circle marks each landing spot for the full delay.
  const THROW_COUNT = 3;
  const THROW_TELEGRAPH_MS = 2500;
  const THROW_RADIUS = 52;

  // 3. Spike: tentacles burst up out of the ground at telegraphed spots.
  const SPIKE_COUNT = 4;
  const SPIKE_TELEGRAPH_MS = 2500;
  const SPIKE_RADIUS = 40;

  // 4. Charge: three straight-line dashes at a chosen player, each with a
  // brief wind-up (so there's *some* warning) and recovery beat.
  const CHARGE_COUNT = 3;
  const CHARGE_SPEED = PLAYER_SPEED * 3;
  const CHARGE_WINDUP_MS = 350;
  const CHARGE_MAX_DASH_MS = 1200;
  const CHARGE_RECOVER_MS = 450;

  // 5. Bombs: 10 smoke-bomb-style charges dropped across the arena that
  // arm on landing and go off fast -- stand in the blast and you're caught.
  const BOMBTHROW_COUNT = 10;
  const BOMBTHROW_LAND_MS = 700; // time in the air before landing
  const BOMBTHROW_FUSE_MS = 900; // time armed on the ground before it goes off
  const BOMBTHROW_RADIUS = 60;

  const ATTACKS_PER_STUN = 10;
  const STUN_DURATION_MS = 10000;

  // The bombs players themselves use against the boss: up to BOMB_LIVE_COUNT
  // sit on the map at once. A hit only really counts while the boss is
  // stunned (1/10 health) -- landing one outside that window still chips
  // it, but only for 1/50, so the stun window is where the fight is won.
  const BOMB_LIVE_COUNT = 3;
  const BOMB_DAMAGE_STUNNED = 0.10;
  const BOMB_DAMAGE_NORMAL = 0.02;

  const RADAR_DURATION_MS = 10000;
  const SCANNER_DURATION_MS = 10000;
  const FREEZE_DURATION_MS = 10000;
  const EAT_DURATION_MS = 3000;
  const CRATE_RESPAWN_MS = 60000;
  const CATCH_CUTSCENE_MS = 2000;
  const CRATE_ITEMS = ['radar', 'meat', 'co2', 'scanner'];

  // ---- sprint / stamina ----
  const DOUBLE_TAP_MS = 300;
  const STAMINA_MAX = 15; // seconds of sprint fuel
  const SPRINT_SPEED_MULT = 2;
  const EXHAUSTED_SPEED_MULT = 0.5;
  const SPRINT_DRAIN_RATE = STAMINA_MAX / 15; // empties over 15s of continuous sprint
  const EXHAUSTED_MS = 5000;
  const EXHAUSTED_REGEN_RATE = (STAMINA_MAX / 2) / (EXHAUSTED_MS / 1000); // refills to half over the 5s penalty
  const NORMAL_REGEN_RATE = EXHAUSTED_REGEN_RATE / 2; // half that rate while just walking
  const WALK_CYCLE_SPEED = 9; // radians/second the walk-cycle phase advances at 1x speed

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const messageEl = document.getElementById('game-message');

  // Darkness is composited from a separate offscreen mask so that punching
  // light holes (globalCompositeOperation 'destination-out') erases only the
  // mask's own darkness pixels, not the scene already drawn on the main canvas.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = VIEW_W;
  maskCanvas.height = VIEW_H;
  const maskCtx = maskCanvas.getContext('2d');
  const hudBossEl = document.getElementById('hud-boss');
  const hudDoorEl = document.getElementById('hud-door');
  const hudTimerEl = document.getElementById('hud-timer');
  const hudBestEl = document.getElementById('hud-best');

  // Explored-tiles minimap: an offscreen 1px-per-tile canvas that only ever
  // gets painted to (never cleared), so it builds up a fog-of-war record of
  // what each session has actually walked near, rather than showing the
  // whole huge map from the start.
  const exploredCanvas = document.createElement('canvas');
  exploredCanvas.width = COLS;
  exploredCanvas.height = ROWS;
  const exploredCtx = exploredCanvas.getContext('2d');
  let explored = new Uint8Array(COLS * ROWS);
  const EXPLORE_RADIUS = 7;
  const MINIMAP_W = 90;

  // ---- procedural audio (no asset files) ----
  let audioCtx = null;
  let musicMasterGain = null; // both the ambient drone and the boss theme route through this
  let musicEnabled = false;
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

    // A layered drone instead of one flat tone: two closely-detuned low
    // sines beat slowly against each other, a sub-octave adds weight, a
    // muffled lowpass "breathes" via its own slow LFO, and a faint high
    // triangle drifts by like a distant ringing. Each voice has its own
    // independent vibrato rate so nothing ever locks into a static pitch.
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

    ambientSubOsc = addDroneVoice(41.2, 'sine', 0.6, 0.05, 1.5).osc; // low foundation
    addDroneVoice(43.7, 'sine', 0.5, 0.08, 2); // slow beat against the foundation
    addDroneVoice(20.6, 'sine', 0.4, 0.03, 0.8); // sub-octave rumble
    ambientMidGain = addDroneVoice(97, 'sawtooth', 0, 0.15, 6).gain; // dissonant edge, fades in with tension
    addDroneVoice(660, 'triangle', 0.05, 0.02, 40); // faint distant ringing

    // A real short loop -- a bassline riff, a kick/hat pulse, and a
    // call-and-response lead motif -- instead of randomized stabs, so it
    // reads as an actual boss theme rather than noise. The whole level is
    // the boss encounter (unlike earlier levels, there's no separate "safe"
    // state to score against), so it runs continuously once music is on,
    // and its tempo climbs as bossHealth drops so the fight escalates toward
    // the last couple of bombs.
    bossMusicGain = audioCtx.createGain();
    bossMusicGain.gain.value = 0.55;
    bossMusicGain.connect(musicMasterGain);

    // The riff and kick share a gentle lowpass so the sawtooth reads as a
    // rounded synth-bass tone rather than a buzzy raw wave.
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

  // A minor-key riff and lead phrase, low register for the ostinato, an
  // octave up for the melody -- deliberately a fixed, memorable pattern
  // rather than randomized notes.
  const BOSS_NOTE = { A1: 55.0, C2: 65.41, D2: 73.42, E2: 82.41, G2: 98.0, A2: 110.0, C3: 130.81, D3: 146.83, E3: 164.81 };
  const BOSS_BASS_RIFF = [
    BOSS_NOTE.A1, 0, BOSS_NOTE.C2, 0, BOSS_NOTE.A1, 0, BOSS_NOTE.E2, 0,
    BOSS_NOTE.A1, 0, BOSS_NOTE.C2, 0, BOSS_NOTE.G2, 0, BOSS_NOTE.E2, 0,
  ];
  const BOSS_LEAD_PHRASE = [BOSS_NOTE.A2, BOSS_NOTE.C3, BOSS_NOTE.D3, BOSS_NOTE.E3, BOSS_NOTE.D3, BOSS_NOTE.C3, BOSS_NOTE.A2, BOSS_NOTE.G2];

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

  // Self-rescheduling via setTimeout at 16th-note resolution rather than a
  // fixed-interval clock, so tempo can change between steps just by
  // changing how long until the next call.
  function scheduleBossStep() {
    if (!audioCtx || !bossBassGain) return;
    if (boss.defeated) { bossPulseTimer = null; return; }

    const healthFrac = bossHealthFrac();
    const bpm = 96 + (1 - healthFrac) * 48; // 96 BPM at full health -> 144 BPM near defeat
    const stepDur = 60 / bpm / 4;
    const t = audioCtx.currentTime;
    const i = bossStep % 16;
    const bar = Math.floor(bossStep / 16) % 2;

    const bassNote = BOSS_BASS_RIFF[i];
    if (bassNote) playBossBassNote(bassNote, t, stepDur * 1.8, 0.18 + (1 - healthFrac) * 0.07);
    if (i === 0 || i === 8) playBossKick(t);
    if (i % 2 === 1) playBossHat(t, 0.04 + (1 - healthFrac) * 0.02);

    // The lead phrase answers the riff every other bar, call-and-response.
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

  function playButtonChime() {
    playTone(880, 0.18, 'sine', 0.2);
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

  // Fires right as the boss commits to any of its five attacks -- a short
  // rising growl gives players an audio cue that something's starting
  // before the visual telegraph (if that attack even has one) catches up.
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

  // The spike attack's own impact sound -- a sharper crack than the
  // throw/bomb explosions, so the three telegraphed attacks stay tellable
  // apart by ear alone.
  function playSpikeStrike() {
    if (!audioCtx) return;
    const start = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, start);
    osc.frequency.exponentialRampToValueAtTime(60, start + 0.15);
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  }

  // The stun's own sting -- a falling, dazed wobble, distinct from every
  // other cue since it's the one moment players should feel safe.
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

  function playWinJingle() {
    [523, 659, 784, 1046].forEach((freq, i) => playTone(freq, 0.35, 'triangle', 0.2, i * 0.14));
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
    ensureAudio();
    if (audioCtx && musicMasterGain) {
      musicMasterGain.gain.setTargetAtTime(on ? 1 : 0, audioCtx.currentTime, 0.15);
    }
  }

  const soundHintEl = document.getElementById('sound-hint');
  function updateSoundHint() {
    if (soundHintEl) soundHintEl.style.display = musicEnabled ? '' : 'none';
  }

  const musicToggleEl = document.getElementById('music-toggle');
  if (musicToggleEl) {
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

  // Double-tapping a movement key starts a sprint (see updateStamina/
  // applyMovement) as long as there's stamina left. Only counted on the
  // real edge of a fresh keydown, not the browser's auto-repeat.
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
    if (e.key === 'Enter' && (gameState === 'complete' || gameState === 'wiped')) {
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

  // A handful of near-identical grays, picked per-tile by hashing its
  // coordinates, so plain floor reads as worn/mottled concrete instead of
  // one flat color -- stable across frames since it's a function of (x, y),
  // not random noise re-rolled every draw.
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

  // Shifts a '#rrggbb' color toward white (amt > 0) or black (amt < 0) --
  // used to derive a highlight/shadow tone from a single base color instead
  // of hand-picking a second and third shade for everything drawn below.
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) + 255 * amt);
    const g2 = clamp(((n >> 8) & 255) + 255 * amt);
    const b = clamp((n & 255) + 255 * amt);
    return `rgb(${r},${g2},${b})`;
  }

  // A single tapered, suckered tentacle from (0,0) to (tx,ty) bowing through
  // (midX,midY) -- thick at the root, thin at the tip, with a couple of
  // suckers, instead of one uniform-width stroke.
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

  // ---- timer / best time (best is kept per-browser in localStorage, not
  // shared between players or devices) ----
  const BEST_TIME_KEY = 'goofy-horror-best-level5';
  let bestMs = (() => {
    const v = parseFloat(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(v) ? v : null;
  })();
  let runStartTime = performance.now();
  let elapsedMs = 0;
  let bestRecorded = false;

  function formatTime(ms) {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
  }
  const BOMB_MIN_PLAYER_DIST = 100; // don't spawn a bomb right under someone's feet, at full health
  const BOMB_MIN_PLAYER_DIST_LOW = 55; // shrinks toward this near defeat, so the endgame doesn't
                                         // turn into a long, undramatic walk
  let bombs = []; // BOMB_LIVE_COUNT live at once: [{x, y, seed}]
  let bossHealth = 1; // 1 -> 0; decremented by BOMB_DAMAGE_STUNNED/BOMB_DAMAGE_NORMAL per hit
  let doorUnlocked = false;
  let gameState = 'playing'; // 'playing' | 'complete' | 'wiped'
  let catchFlash = 0;

  // Drives the boss theme's tempo and the bomb search distance, so both
  // escalate together as the fight goes on.
  function bossHealthFrac() {
    return clamp(bossHealth, 0, 1);
  }

  function makePlayer(spawn, color) {
    const c = tileCenter(spawn.x, spawn.y);
    return {
      x: c.x, y: c.y, color, facing: { x: 0, y: 1 }, spawn, invulnerableUntil: 0,
      caught: false, caughtAt: 0,
      stamina: STAMINA_MAX, moveState: 'normal', exhaustedUntil: 0, sprintActive: false,
      walkPhase: 0,
    };
  }

  const players = [
    makePlayer(LEVEL.spawn1, '#ff8a3d'),
    makePlayer(LEVEL.spawn2, '#3ddc84'),
  ];

  // The boss: one giant, burnt Crawler. There's only ever one, so it's a
  // single object rather than an array of monsters like the other levels --
  // no need for the multi-monster machinery when there's nothing to iterate.
  function makeBoss() {
    const tentacleCount = 9;
    const tentacleAngles = [];
    for (let i = 0; i < tentacleCount; i++) {
      tentacleAngles.push((i / tentacleCount) * Math.PI * 2 + Math.random() * 0.4);
    }
    return {
      x: 0,
      y: 0,
      radius: BOSS_RADIUS,
      seed: Math.random() * 100,
      lookDir: { x: 1, y: 0 },
      tentacleAngles,
      defeated: false,

      frozenUntil: 0,
      luredState: 'none', // 'none' | 'lured' | 'eating' -- pauses the attack cycle below
      lureTarget: null,
      eatingUntil: 0,
      path: [], pathIndex: 0, nextRepathAt: 0, // only used while lured, via BFS to the meat item

      // ---- attack cycle ----
      // 'idle' | 'spin' | 'throw' | 'spike' | 'charge' | 'bombs' | 'stunned'
      phase: 'idle',
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      attackCount: 0,
      lastAttack: null,
      spinAngle: 0,
      spinDir: { x: 1, y: 0 },
      chargeDashesLeft: 0,
      chargeDir: { x: 1, y: 0 },
      chargeSubPhase: 'windup', // 'windup' | 'dash' | 'recover'
      chargeSubStartedAt: 0,
    };
  }

  const boss = makeBoss();
  let telegraphs = []; // throw attack: [{x, y, firesAt}]
  let spikeTelegraphs = []; // spike attack: [{x, y, firesAt}]
  let bossBombs = []; // bombs attack: [{x, y, landAt, explodeAt, exploded}]

  // Every open floor tile, precomputed once so spawning a bomb is just a
  // pick from a list instead of re-scanning the whole grid each time.
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

  function spawnBomb() {
    const minDist = BOMB_MIN_PLAYER_DIST_LOW + bossHealthFrac() * (BOMB_MIN_PLAYER_DIST - BOMB_MIN_PLAYER_DIST_LOW);
    for (let tries = 0; tries < 30; tries++) {
      const t = OPEN_FLOOR_TILES[Math.floor(Math.random() * OPEN_FLOOR_TILES.length)];
      const c = tileCenter(t.x, t.y);
      if (players.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < minDist)) continue;
      bombs.push({ x: c.x, y: c.y, seed: Math.random() * 1000 });
      return;
    }
  }

  let crates = [];
  let fires = [];
  let radarUntil = 0;
  let scannerUntil = 0;
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
    });

    const spawn = LEVEL.monsterSpawns[0];
    const m = tileCenter(spawn.x, spawn.y);
    boss.x = m.x; boss.y = m.y;
    boss.path = []; boss.pathIndex = 0; boss.nextRepathAt = 0;
    boss.frozenUntil = 0; boss.luredState = 'none'; boss.lureTarget = null; boss.eatingUntil = 0;
    boss.defeated = false;
    boss.phase = 'idle'; boss.phaseStartedAt = 0; boss.nextIdleUntil = 0;
    boss.attackCount = 0; boss.lastAttack = null; boss.spinAngle = 0;
    telegraphs = []; spikeTelegraphs = []; bossBombs = [];

    bossHealth = 1;
    bombs = [];
    for (let i = 0; i < BOMB_LIVE_COUNT; i++) spawnBomb();
    doorUnlocked = false;

    // A replay after a win leaves the sequencer stopped (see
    // scheduleBossStep's boss.defeated check) -- restart it now that the
    // boss is alive again.
    if (audioCtx && bossPulseTimer === null) { bossStep = 0; scheduleBossStep(); }

    crates = (LEVEL.crateSpawns || []).map((c) => ({
      x: c.x, y: c.y, item: CRATE_ITEMS[Math.floor(Math.random() * CRATE_ITEMS.length)], opened: false, openedAt: 0,
    }));
    fires = (LEVEL.fireSpawns || []).map((f, i) => ({
      x: f.x, y: f.y, seed: i * 1471.7 + Math.random() * 5000,
    }));
    radarUntil = 0;
    scannerUntil = 0;
    floatingTexts = [];
    resetExploration();
    runStartTime = performance.now();
    elapsedMs = 0;
    bestRecorded = false;
  }
  resetLevel();

  // ---- player movement & collision ----
  function isWallForPlayer(tx, ty) {
    const ch = tileChar(tx, ty);
    if (ch === '#') return true;
    if (ch === 'D') return !doorUnlocked;
    return false;
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

  // Sprinting drains stamina over 15s of continuous use; run out and you're
  // stuck at half speed for 5s while it refills halfway. Walking normally
  // (not sprinting, not exhausted) also refills it, just at half the rate
  // the exhausted penalty does.
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
      if (!isMoving) p.sprintActive = false; // stopping cancels the sprint; needs a fresh double-tap
      p.stamina = Math.min(STAMINA_MAX, p.stamina + NORMAL_REGEN_RATE * dt);
    }
  }

  function speedMultiplierFor(p) {
    if (p.moveState === 'exhausted') return EXHAUSTED_SPEED_MULT;
    if (p.moveState === 'sprinting') return SPRINT_SPEED_MULT;
    return 1;
  }

  function applyMovement(p, ix, iy, dt) {
    if (p.caught) return; // held fast during the catch cutscene
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
    if (ch === 'S') return '#3ddc84';
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
    // Always-visible (not tied to the scanner pickup) -- up to BOMB_LIVE_COUNT
    // are live at once and the arena is big enough that making players
    // search them blind on top of dodging the boss was tedium, not challenge.
    if (!boss.defeated) {
      const pulse = 0.6 + 0.4 * Math.sin(now / 180);
      bombs.forEach((bomb) => {
        const bmx = mx + (bomb.x / WORLD_W) * MINIMAP_W;
        const bmy = my + (bomb.y / WORLD_H) * mh;
        ctx.beginPath();
        ctx.arc(bmx, bmy, 2.6, 0, Math.PI * 2);
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
    ctx.fillStyle = '#ff5a2a';
    ctx.shadowColor = '#ff5a2a';
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

  // A classic top-of-screen boss bar rather than folding this into the HUD
  // text spans -- the boss fight is the entire level, so it earns the same
  // prominent treatment a dedicated boss encounter would get elsewhere.
  function drawBossHealthBar(vx, now) {
    // Centered in the strip between the minimap (top-left) and the
    // radar/scanner corner icons (top-right) rather than spanning the full
    // viewport width, so it never overlaps either.
    const barW = 210;
    const barH = 10;
    const bx = vx + (VIEW_W - barW) / 2;
    const by = 12;
    const frac = clamp(bossHealth, 0, 1);

    ctx.save();
    ctx.fillStyle = 'rgba(5,5,8,0.7)';
    ctx.fillRect(bx - 6, by - 16, barW + 12, barH + 22);

    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.defeated ? '#8a8578' : boss.phase === 'stunned' ? '#8fd6ff' : '#e8b06a';
    const label = boss.defeated ? 'BOSS — DEFEATED' : boss.phase === 'stunned' ? 'BOSS — STUNNED' : 'BOSS';
    ctx.fillText(label, bx + barW / 2, by - 4);

    ctx.fillStyle = '#1a1a1c';
    ctx.fillRect(bx, by, barW, barH);

    if (boss.defeated) {
      ctx.fillStyle = '#4a4640';
      ctx.fillRect(bx, by, barW * frac, barH);
    } else {
      const grad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
      grad.addColorStop(0, '#ffb43d');
      grad.addColorStop(0.5, '#e8461f');
      grad.addColorStop(1, '#a3321f');
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, barW * frac, barH);

      // A soft flicker over the fill once the boss is close to defeated,
      // to read as "critical" without needing a separate warning UI.
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

  // The scanner points at the live bomb -- there's only ever one -- so it
  // never has to choose between multiple objectives the way earlier
  // levels' scanners did.
  function nearestUnpressedButton(x, y) {
    if (boss.defeated || bombs.length === 0) return null;
    let best = null, bestD = Infinity;
    bombs.forEach((b) => {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < bestD) { bestD = d; best = b; }
    });
    return best;
  }

  function applyItemEffect(item, x, y, now) {
    if (item === 'radar') {
      radarUntil = now + RADAR_DURATION_MS;
      spawnFloatingText(x, y, 'RADAR');
      playItemChime(880);
    } else if (item === 'meat') {
      boss.luredState = 'lured';
      boss.lureTarget = { x, y };
      boss.path = []; boss.pathIndex = 0;
      spawnFloatingText(x, y, 'MEAT');
      playItemChime(220);
    } else if (item === 'co2') {
      boss.frozenUntil = now + FREEZE_DURATION_MS;
      spawnFloatingText(x, y, 'FROZEN');
      playItemChime(1200);
    } else if (item === 'scanner') {
      scannerUntil = now + SCANNER_DURATION_MS;
      spawnFloatingText(x, y, 'SCANNER');
      playItemChime(660);
    }
  }

  function updateCrates(now) {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      crates.forEach((c) => {
        if (c.opened) return;
        if (c.x === t.x && c.y === t.y) {
          c.opened = true;
          c.openedAt = now;
          applyItemEffect(c.item, tileCenter(c.x, c.y).x, tileCenter(c.x, c.y).y, now);
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

  function updateTriggers() {
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      const ch = tileChar(t.x, t.y);
      if (ch === 'X' && doorUnlocked && gameState === 'playing') {
        gameState = 'complete';
        playWinJingle();
      }
    });
  }

  // Walking onto a bomb detonates it immediately -- no carrying it anywhere
  // first. Up to BOMB_LIVE_COUNT are live at once; a fresh one spawns
  // elsewhere the instant one goes off, until the boss is out of health.
  // The damage it actually does depends entirely on whether the boss is
  // stunned right now -- see BOMB_DAMAGE_STUNNED/BOMB_DAMAGE_NORMAL.
  function updateBombs(now) {
    if (boss.defeated) return;
    players.forEach((p) => {
      const t = worldToTile(p.x, p.y);
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        const bt = worldToTile(b.x, b.y);
        if (bt.x !== t.x || bt.y !== t.y) continue;
        bombs.splice(i, 1);
        const stunned = boss.phase === 'stunned';
        const dmg = stunned ? BOMB_DAMAGE_STUNNED : BOMB_DAMAGE_NORMAL;
        bossHealth = Math.max(0, bossHealth - dmg);
        spawnFloatingText(b.x, b.y, stunned ? 'BOOM! -10%' : 'boom -2%');
        playBombBlast();
        if (bossHealth <= 0) {
          boss.defeated = true;
          doorUnlocked = true;
          playDoorUnlockChime();
        } else {
          spawnBomb();
        }
      }
    });
  }

  // ---- boss AI ----
  function monsterCanOccupy(ch) {
    if (ch === '#' || ch === 'S') return false;
    if (ch === 'D') return doorUnlocked;
    return true;
  }

  function buildMonsterGraph() {
    const graph = new Map();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!monsterCanOccupy(LEVEL.grid[y][x])) continue;
        const list = [];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
          if (monsterCanOccupy(LEVEL.grid[ny][nx])) list.push({ x: nx, y: ny });
        });
        graph.set(y * COLS + x, list);
      }
    }
    return graph;
  }

  function bfsPath(graph, start, goal) {
    const key = (t) => t.y * COLS + t.x;
    const startKey = key(start), goalKey = key(goal);
    if (!graph.has(startKey) || !graph.has(goalKey)) return null;
    if (startKey === goalKey) return [start];
    const visited = new Set([startKey]);
    const prev = new Map();
    const queue = [start];
    let found = false;
    while (queue.length) {
      const cur = queue.shift();
      if (key(cur) === goalKey) { found = true; break; }
      const neighbors = graph.get(key(cur)) || [];
      for (const n of neighbors) {
        const k = key(n);
        if (!visited.has(k)) {
          visited.add(k);
          prev.set(k, cur);
          queue.push(n);
        }
      }
    }
    if (!found) return null;
    const path = [goal];
    let curKey = goalKey;
    while (curKey !== startKey) {
      const p = prev.get(curKey);
      path.push(p);
      curKey = key(p);
    }
    path.reverse();
    return path;
  }

  function tileTargetSimple(t) {
    return tileCenter(t.x, t.y);
  }

  // A boss-sized version of the player's canStandAt -- corner-checks a box
  // of the boss's own radius against walls, so its attacks respect the
  // same geometry players do instead of clipping through walls.
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

  const ALL_ATTACKS = ['spin', 'throw', 'spike', 'charge', 'bombs'];

  function nearestPlayer(x, y) {
    return players.reduce((a, b) => (Math.hypot(x - a.x, y - a.y) <= Math.hypot(x - b.x, y - b.y) ? a : b));
  }

  // Called once an attack has fully played out: every ATTACKS_PER_STUN'th
  // one, the boss keels over stunned instead of picking the next one --
  // that's the window a bomb hit actually costs it real health.
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

  function startAttack(kind, now) {
    boss.phase = kind;
    boss.phaseStartedAt = now;
    boss.lastAttack = kind;

    if (kind === 'spin') {
      const a = Math.random() * Math.PI * 2;
      boss.spinDir = { x: Math.cos(a), y: Math.sin(a) };
      playBossWindup();
    } else if (kind === 'throw') {
      telegraphs = [];
      for (let i = 0; i < THROW_COUNT; i++) {
        const p = players[i % players.length];
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 50;
        telegraphs.push({
          x: clamp(p.x + Math.cos(a) * d, TILE, WORLD_W - TILE),
          y: clamp(p.y + Math.sin(a) * d, TILE, WORLD_H - TILE),
          firesAt: now + THROW_TELEGRAPH_MS,
        });
      }
      playBossWindup();
    } else if (kind === 'spike') {
      spikeTelegraphs = [];
      for (let i = 0; i < SPIKE_COUNT; i++) {
        const p = players[i % players.length];
        const a = (i / SPIKE_COUNT) * Math.PI * 2;
        const d = 20 + (i % 2) * 40;
        spikeTelegraphs.push({
          x: clamp(p.x + Math.cos(a) * d, TILE, WORLD_W - TILE),
          y: clamp(p.y + Math.sin(a) * d, TILE, WORLD_H - TILE),
          firesAt: now + SPIKE_TELEGRAPH_MS,
        });
      }
      playBossWindup();
    } else if (kind === 'charge') {
      boss.chargeDashesLeft = CHARGE_COUNT;
      startChargeDash(now);
    } else if (kind === 'bombs') {
      bossBombs = [];
      for (let i = 0; i < BOMBTHROW_COUNT; i++) {
        const t = OPEN_FLOOR_TILES[Math.floor(Math.random() * OPEN_FLOOR_TILES.length)];
        const c = tileCenter(t.x, t.y);
        bossBombs.push({
          x: c.x, y: c.y, exploded: false,
          landAt: now + BOMBTHROW_LAND_MS,
          explodeAt: now + BOMBTHROW_LAND_MS + BOMBTHROW_FUSE_MS,
        });
      }
      playBossWindup();
    }
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

  function updateBossIdle(now, dt) {
    if (now >= boss.nextIdleUntil) {
      startAttack(pickAttack(), now);
      return;
    }
    // A slow, direct drift toward whoever's nearest, so the room between
    // attacks never feels totally static -- no pathfinding, just a step
    // that backs off on whichever axis a wall blocks.
    const target = nearestPlayer(boss.x, boss.y);
    const dx = target.x - boss.x, dy = target.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const step = BOSS_IDLE_SPEED * dt;
    const nx = boss.x + (dx / d) * step, ny = boss.y + (dy / d) * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx;
    if (canBossStandAt(boss.x, ny)) boss.y = ny;
    boss.lookDir = { x: dx / d, y: dy / d };
  }

  function updateBossSpin(now, dt) {
    if (now - boss.phaseStartedAt >= SPIN_DURATION_MS) { finishAttack(now); return; }
    boss.spinAngle += dt * 26;
    const step = SPIN_SPEED * dt;
    const nx = boss.x + boss.spinDir.x * step;
    const ny = boss.y + boss.spinDir.y * step;
    if (canBossStandAt(nx, boss.y)) boss.x = nx; else boss.spinDir.x *= -1;
    if (canBossStandAt(boss.x, ny)) boss.y = ny; else boss.spinDir.y *= -1;
    boss.lookDir = boss.spinDir;
  }

  // Shared resolution for the throw/spike telegraph arrays: fires whatever
  // has reached its timer, catches anyone still standing in it, and
  // reports back whether the whole batch is now resolved.
  function resolveTelegraphs(arr, radius, now, onFire) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const tg = arr[i];
      if (now >= tg.firesAt) {
        onFire(tg);
        players.forEach((p) => {
          if (p.caught || now < p.invulnerableUntil) return;
          if (Math.hypot(p.x - tg.x, p.y - tg.y) < radius) triggerCaught(p, now);
        });
        arr.splice(i, 1);
      }
    }
    return arr.length === 0;
  }

  function updateBossThrow(now) {
    const done = resolveTelegraphs(telegraphs, THROW_RADIUS, now, (tg) => {
      spawnFloatingText(tg.x, tg.y, 'BOOM!');
      playBombBlast();
    });
    if (done) finishAttack(now);
  }

  function updateBossSpike(now) {
    const done = resolveTelegraphs(spikeTelegraphs, SPIKE_RADIUS, now, (tg) => {
      spawnFloatingText(tg.x, tg.y, 'SPIKE!');
      playSpikeStrike();
    });
    if (done) finishAttack(now);
  }

  function updateBossCharge(now, dt) {
    const elapsed = now - boss.chargeSubStartedAt;
    if (boss.chargeSubPhase === 'windup') {
      if (elapsed >= CHARGE_WINDUP_MS) { boss.chargeSubPhase = 'dash'; boss.chargeSubStartedAt = now; }
      return;
    }
    if (boss.chargeSubPhase === 'dash') {
      const step = CHARGE_SPEED * dt;
      const nx = boss.x + boss.chargeDir.x * step;
      const ny = boss.y + boss.chargeDir.y * step;
      const blockedX = !canBossStandAt(nx, boss.y);
      const blockedY = !canBossStandAt(boss.x, ny);
      if (!blockedX) boss.x = nx;
      if (!blockedY) boss.y = ny;
      if ((blockedX && blockedY) || elapsed >= CHARGE_MAX_DASH_MS) {
        boss.chargeSubPhase = 'recover';
        boss.chargeSubStartedAt = now;
        boss.chargeDashesLeft--;
      }
      return;
    }
    if (boss.chargeSubPhase === 'recover' && elapsed >= CHARGE_RECOVER_MS) {
      if (boss.chargeDashesLeft > 0) startChargeDash(now);
      else finishAttack(now);
    }
  }

  function updateBossBombsAttack(now) {
    if (bossBombs.length && bossBombs.every((b) => b.exploded)) finishAttack(now);
  }

  // Runs every frame regardless of boss.phase -- once thrown, a bomb keeps
  // ticking toward its own fuse even if the boss has already moved on.
  function updateBossBombHazards(now) {
    bossBombs.forEach((b) => {
      if (b.exploded || now < b.explodeAt) return;
      b.exploded = true;
      playBombBlast();
      players.forEach((p) => {
        if (p.caught || now < p.invulnerableUntil) return;
        if (Math.hypot(p.x - b.x, p.y - b.y) < BOMBTHROW_RADIUS) triggerCaught(p, now);
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
    if (boss.defeated) return; // its last bomb landed -- done for good, not just frozen
    if (now < boss.frozenUntil) return; // frozen solid: no movement, no attacks

    if (boss.luredState === 'eating') {
      if (now >= boss.eatingUntil) {
        boss.luredState = 'none';
        boss.path = []; boss.pathIndex = 0; boss.nextRepathAt = 0;
      } else {
        return;
      }
    }

    if (boss.luredState === 'lured') {
      if (now >= boss.nextRepathAt) {
        boss.nextRepathAt = now + REPATH_MS;
        const startTile = worldToTile(boss.x, boss.y);
        const goalTile = worldToTile(boss.lureTarget.x, boss.lureTarget.y);
        const graph = buildMonsterGraph();
        const path = bfsPath(graph, startTile, goalTile);
        boss.path = path && path.length > 1 ? path.slice(1) : [];
        boss.pathIndex = 0;
      }
      if (boss.path && boss.pathIndex < boss.path.length) {
        const step = BOSS_LURE_SPEED * dt;
        const target = tileTargetSimple(boss.path[boss.pathIndex]);
        const dx = target.x - boss.x, dy = target.y - boss.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001) boss.lookDir = { x: dx / d, y: dy / d };
        if (d < step) {
          boss.x = target.x; boss.y = target.y;
          boss.pathIndex++;
        } else {
          boss.x += (dx / d) * step;
          boss.y += (dy / d) * step;
        }
      } else {
        boss.luredState = 'eating';
        boss.eatingUntil = now + EAT_DURATION_MS;
      }
      return;
    }

    switch (boss.phase) {
      case 'stunned': updateBossStunned(now); break;
      case 'idle': updateBossIdle(now, dt); break;
      case 'spin': updateBossSpin(now, dt); break;
      case 'throw': updateBossThrow(now); break;
      case 'spike': updateBossSpike(now); break;
      case 'charge': updateBossCharge(now, dt); break;
      case 'bombs': updateBossBombsAttack(now); break;
    }
  }

  // Contact with the boss's own body still catches you at any point in the
  // cycle except while it's stunned -- that window is deliberately the one
  // safe moment to walk up and land a bomb hit instead of dodging it.
  function updateCatch(now) {
    if (boss.defeated) return;
    if (now < boss.frozenUntil) return;
    if (boss.luredState !== 'none') return;
    if (boss.phase === 'stunned') return;
    players.forEach((p) => {
      if (p.caught) return;
      if (now < p.invulnerableUntil) return;
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

  // A caught player stays down (the held cutscene overlay reads as "downed")
  // rather than auto-respawning -- nobody gets back up until the whole
  // party is down, at which point it's a wipe and Enter starts the fight
  // over from scratch, same as a win.
  function updateCutscenes(now) {
    if (gameState === 'playing' && players.every((p) => p.caught)) {
      gameState = 'wiped';
    }
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

  // ---- fires (always burning) ----
  function drawFires(g, now) {
    fires.forEach((f) => {
      const c = tileCenter(f.x, f.y);
      g.save();
      g.translate(c.x, c.y);
      const flicker = 0.85 + Math.sin(now * 0.02 + f.seed) * 0.15;
      const glow = g.createRadialGradient(0, 0, 2, 0, 0, 30 * flicker);
      glow.addColorStop(0, 'rgba(255,170,60,0.55)');
      glow.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, 30 * flicker, 0, Math.PI * 2);
      g.fill();

      g.beginPath();
      g.ellipse(0, 6, 8, 3, 0, 0, Math.PI * 2);
      g.fillStyle = '#1c1410';
      g.fill();
      g.fillStyle = 'rgba(255,120,30,0.5)';
      g.beginPath(); g.ellipse(-3, 6, 2, 1, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(3, 6.5, 1.6, 0.8, 0, 0, Math.PI * 2); g.fill();

      for (let i = 0; i < 3; i++) {
        const wobble = Math.sin(now * 0.014 + f.seed + i * 2) * 3;
        const h = (9 + i * 3) * flicker;
        g.beginPath();
        g.moveTo(-4 + i * 2, 6);
        g.quadraticCurveTo(2 + wobble, -h * 0.5, 0 + wobble * 0.5, -h);
        g.quadraticCurveTo(-2 + wobble, -h * 0.5, 4 - i * 2, 6);
        g.closePath();
        g.fillStyle = i === 0 ? '#ffdf8a' : i === 1 ? '#ff9c3d' : '#e0541f';
        g.fill();
      }

      for (let i = 0; i < 2; i++) {
        const seed = f.seed * 3 + i * 613;
        const cycle = 1400 + (i % 3) * 300;
        const phase = ((now + seed) % cycle) / cycle;
        const ex = Math.sin(seed + phase * 5) * 6;
        const ey = -phase * 22 - 4;
        g.beginPath();
        g.arc(ex, ey, 1.4 - phase, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,180,90,${(1 - phase) * 0.8})`;
        g.fill();
      }

      g.restore();
    });
  }

  function fireLightPunches() {
    return fires.map((f) => tileCenter(f.x, f.y));
  }

  // The throw attack's red circles and the spike attack's dashed rings --
  // deliberately different styles so the two are tellable apart at a
  // glance, not just by which one happens to be active.
  function drawAttackTelegraphs(g, now) {
    telegraphs.forEach((tg) => {
      const remain = clamp((tg.firesAt - now) / THROW_TELEGRAPH_MS, 0, 1);
      const pulse = 0.5 + 0.5 * Math.sin(now / 90);
      g.beginPath();
      g.arc(tg.x, tg.y, THROW_RADIUS, 0, Math.PI * 2);
      g.fillStyle = `rgba(200,20,20,${0.15 + (1 - remain) * 0.25})`;
      g.fill();
      g.strokeStyle = `rgba(255,40,40,${0.6 * pulse})`;
      g.lineWidth = 3;
      g.stroke();
    });
    spikeTelegraphs.forEach((tg) => {
      const pulse = 0.5 + 0.5 * Math.sin(now / 70);
      g.save();
      g.setLineDash([6, 5]);
      g.beginPath();
      g.arc(tg.x, tg.y, SPIKE_RADIUS, 0, Math.PI * 2);
      g.strokeStyle = `rgba(255,140,30,${0.75 * pulse})`;
      g.lineWidth = 3;
      g.stroke();
      g.restore();
      g.beginPath();
      g.arc(tg.x, tg.y, 3, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,140,30,0.6)';
      g.fill();
    });
  }

  // Bomb-throw hazards: a small falling shadow that grows into a lit fuse
  // once it lands, with a last-moment blast-radius outline as a final cue.
  function drawBossBombHazards(g, now) {
    bossBombs.forEach((b) => {
      if (b.exploded) return;
      if (now < b.landAt) {
        const t = clamp(1 - (b.landAt - now) / BOMBTHROW_LAND_MS, 0, 1);
        g.beginPath();
        g.arc(b.x, b.y, 5 + t * 6, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,160,60,0.5)';
        g.fill();
      } else {
        const fuseT = clamp((now - b.landAt) / BOMBTHROW_FUSE_MS, 0, 1);
        const pulseRate = 60 - fuseT * 40;
        const pulse = 0.5 + 0.5 * Math.sin(now / pulseRate);
        g.beginPath();
        g.arc(b.x, b.y, 10, 0, Math.PI * 2);
        g.fillStyle = '#201512';
        g.fill();
        g.beginPath();
        g.arc(b.x, b.y, 3 + pulse * 3, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,${180 - fuseT * 120},40,0.9)`;
        g.fill();
        if (fuseT > 0.7) {
          g.beginPath();
          g.arc(b.x, b.y, BOMBTHROW_RADIUS * fuseT, 0, Math.PI * 2);
          g.strokeStyle = `rgba(255,60,20,${(fuseT - 0.7) * 2})`;
          g.lineWidth = 2;
          g.stroke();
        }
      }
    });
  }

  // ---- rendering ----
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
          case 'S': color = floorShade(x, y); break;
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

    // door plug (a short 2-tile gap in the exit alcove's wall)
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
    drawBombs(g, now);
    drawMeatLure(g);
  }

  // The live bomb: a boxy charge with a lit, sparking fuse so it reads as
  // "pick this up" rather than another crate.
  function drawBombs(g, now) {
    bombs.forEach((b) => {
      g.save();
      g.translate(b.x, b.y);
      const pulse = 0.8 + Math.sin(now * 0.012 + b.seed) * 0.2;
      const glow = g.createRadialGradient(0, 0, 2, 0, 0, 20 * pulse);
      glow.addColorStop(0, 'rgba(255,90,40,0.5)');
      glow.addColorStop(1, 'rgba(255,90,40,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(0, 0, 20 * pulse, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#2a2a2e';
      g.beginPath();
      g.arc(0, 2, 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#111113';
      g.lineWidth = 1.5;
      g.stroke();

      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-4, -2); g.lineTo(4, -2);
      g.moveTo(-4, 4); g.lineTo(4, 4);
      g.stroke();

      g.strokeStyle = '#c9903a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -7);
      g.quadraticCurveTo(4, -12, 1, -16);
      g.stroke();
      g.beginPath();
      g.arc(1, -17, 2 + pulse, 0, Math.PI * 2);
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

  function drawMeatLure(g) {
    if (boss.luredState === 'none' || !boss.lureTarget) return;
    g.save();
    g.translate(boss.lureTarget.x, boss.lureTarget.y);
    g.fillStyle = '#8a2a2a';
    g.beginPath();
    g.ellipse(0, 0, 9, 6, 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(-2, -1, 3, 1.6, 0.3, 0, Math.PI * 2);
    g.fill();
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

  // ---- the boss: a Crawler blown up 8x and set on fire ----
  function drawBossTentacles(g, t) {
    boss.tentacleAngles.forEach((baseA, i) => {
      const sway = Math.sin(t * 0.0017 + i * 1.6 + boss.seed) * 0.5;
      const a = baseA + sway * 0.3;
      const len = boss.radius * (1.5 + 0.25 * Math.sin(t * 0.0013 + i * 2.3));
      const tx = Math.cos(a) * len, ty = Math.sin(a) * len;
      const wobble = Math.sin(t * 0.004 + i * 2.1 + boss.seed) * (boss.radius * 0.18);
      const perpA = a + Math.PI / 2;
      const midX = (tx / 2) + Math.cos(perpA) * wobble;
      const midY = (ty / 2) + Math.sin(perpA) * wobble;
      const color = i % 3 === 0 ? '#2a0c06' : '#6a1826';
      drawTaperedTentacle(g, tx, ty, midX, midY, boss.radius * 0.12, color);
    });
  }

  // A few fixed dark, cracked scorch patches over the body -- positions are
  // derived from the boss's own seed so they're stable frame to frame
  // instead of re-rolled every draw.
  const CHAR_PATCHES = (() => {
    const patches = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.6;
      patches.push({ a, d: 0.35 + (i % 3) * 0.15, r: 0.22 + (i % 2) * 0.1 });
    }
    return patches;
  })();

  function drawBossBody(g, t) {
    const points = 14;
    const path = [];
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = boss.radius + Math.sin(t * 0.004 + i * 1.7 + boss.seed) * (boss.radius * 0.05);
      path.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const trace = () => {
      g.beginPath();
      path.forEach(([px, py], i) => { if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); });
      g.closePath();
    };

    trace();
    const grad = g.createRadialGradient(-boss.radius * 0.2, -boss.radius * 0.25, boss.radius * 0.2, 0, 0, boss.radius);
    if (boss.defeated) {
      // burnt out and cold -- the same silhouette, drained of the fire glow
      grad.addColorStop(0, '#4a4640');
      grad.addColorStop(0.5, '#302d28');
      grad.addColorStop(0.8, '#201e1a');
      grad.addColorStop(1, '#0d0c0a');
    } else {
      grad.addColorStop(0, '#a3321f');
      grad.addColorStop(0.5, '#7a1c14');
      grad.addColorStop(0.8, '#4a0f0a');
      grad.addColorStop(1, '#200705');
    }
    g.fillStyle = grad;
    g.shadowColor = boss.defeated ? 'transparent' : '#ff6a2a';
    g.shadowBlur = boss.defeated ? 0 : boss.radius * 0.4;
    g.fill();
    g.shadowBlur = 0;

    // charred, cracked scorch patches
    CHAR_PATCHES.forEach((cp) => {
      const cx = Math.cos(cp.a) * boss.radius * cp.d;
      const cy = Math.sin(cp.a) * boss.radius * cp.d;
      const r = boss.radius * cp.r;
      g.beginPath();
      for (let i = 0; i <= 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const pr = r * (0.75 + 0.25 * Math.sin(a * 3 + cp.a * 5));
        const px = cx + Math.cos(a) * pr, py = cy + Math.sin(a) * pr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(10,6,6,0.55)';
      g.fill();
      g.strokeStyle = 'rgba(255,120,40,0.25)';
      g.lineWidth = 1.5;
      g.stroke();
    });

    // a soft wet highlight, clipped to the silhouette, on top of the char
    g.save();
    trace();
    g.clip();
    g.beginPath();
    g.ellipse(-boss.radius * 0.3, -boss.radius * 0.35, boss.radius * 0.45, boss.radius * 0.28, -0.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,160,90,0.12)';
    g.fill();
    g.restore();
  }

  function drawBossFlames(g, t) {
    const spots = 6;
    for (let i = 0; i < spots; i++) {
      const a = (i / spots) * Math.PI * 2 + boss.seed * 0.1;
      const bx = Math.cos(a) * boss.radius * 0.92;
      const by = Math.sin(a) * boss.radius * 0.92;
      const flicker = 0.8 + Math.sin(t * 0.02 + i * 3.1 + boss.seed) * 0.2;
      g.save();
      g.translate(bx, by);
      g.rotate(a - Math.PI / 2);
      for (let j = 0; j < 3; j++) {
        const wobble = Math.sin(t * 0.016 + i * 5 + j * 2) * (boss.radius * 0.04);
        const h = boss.radius * (0.5 + j * 0.16) * flicker;
        g.beginPath();
        g.moveTo(-boss.radius * 0.08 + j * 4, 4);
        g.quadraticCurveTo(boss.radius * 0.05 + wobble, -h * 0.55, wobble * 0.5, -h);
        g.quadraticCurveTo(-boss.radius * 0.05 + wobble, -h * 0.55, boss.radius * 0.08 - j * 4, 4);
        g.closePath();
        g.fillStyle = j === 0 ? '#ffe38a' : j === 1 ? '#ff9c3d' : '#e0541f';
        g.fill();
      }
      g.restore();
    }

    // rising embers -- a cheap, self-looping effect rather than a real
    // particle array, since it only ever needs to sit on the boss itself.
    for (let i = 0; i < 10; i++) {
      const seed = boss.seed * 7 + i * 971;
      const cycle = 2200 + (i % 4) * 400;
      const phase = ((t + seed) % cycle) / cycle;
      const ex = Math.sin(seed + phase * 6.2) * boss.radius * 0.8;
      const ey = boss.radius * 0.6 - phase * boss.radius * 2.4;
      const alpha = 1 - phase;
      g.beginPath();
      g.arc(ex, ey, 2 + (i % 3), 0, Math.PI * 2);
      g.fillStyle = `rgba(255,${140 + (i % 3) * 30},60,${alpha * 0.85})`;
      g.fill();
    }
  }

  function drawBossEye(g) {
    const lookDir = boss.lookDir;
    const ex = boss.radius * 0.4, ey = ex * 0.8;

    g.save();
    g.beginPath();
    g.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2);
    g.clip();

    const sclera = g.createRadialGradient(-ex * 0.2, -ey * 0.25, 1, 0, 0, ex * 1.15);
    sclera.addColorStop(0, '#f2e6d8');
    sclera.addColorStop(0.55, '#dcc4b2');
    sclera.addColorStop(1, '#6b5142');
    g.fillStyle = sclera;
    g.fillRect(-ex, -ey, ex * 2, ey * 2);

    g.strokeStyle = 'rgba(170,25,25,0.4)';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + boss.seed;
      g.lineWidth = 0.7 + ((i * 13) % 3) * 0.4;
      g.beginPath();
      g.moveTo(Math.cos(a) * ex, Math.sin(a) * ey);
      g.quadraticCurveTo(Math.cos(a + 0.1) * ex * 0.5, Math.sin(a - 0.1) * ey * 0.5, Math.cos(a) * ex * 0.08, Math.sin(a) * ey * 0.08);
      g.stroke();
    }

    const ix = lookDir.x * ex * 0.32, iy = lookDir.y * ey * 0.32;
    const irisR = ex * 0.48;
    const iris = g.createRadialGradient(ix - irisR * 0.22, iy - irisR * 0.22, 1, ix, iy, irisR);
    iris.addColorStop(0, '#ffcf6a');
    iris.addColorStop(0.45, '#ffb43d');
    iris.addColorStop(0.8, '#a3390f');
    iris.addColorStop(1, '#200a05');
    g.beginPath();
    g.arc(ix, iy, irisR, 0, Math.PI * 2);
    g.fillStyle = iris;
    g.fill();

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

  function drawBoss(g, t) {
    g.save();
    g.translate(boss.x, boss.y);
    // Visibly spinning (rather than just relocating fast) is what sells the
    // DVD-logo bounce as an attack in progress and not just fast pathing.
    if (boss.phase === 'spin') g.rotate(boss.spinAngle);

    drawBossTentacles(g, t);
    drawBossBody(g, t);
    if (!boss.defeated) {
      if (boss.phase !== 'stunned') drawBossFlames(g, t);
      drawBossEye(g);
    } else {
      // one last dim ember and a closed, dead eye -- the fight is over
      g.beginPath();
      g.arc(0, 0, boss.radius * 0.15, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,120,40,0.25)';
      g.fill();
      g.beginPath();
      g.moveTo(-boss.radius * 0.22, 0);
      g.lineTo(boss.radius * 0.22, 0);
      g.strokeStyle = 'rgba(20,10,8,0.85)';
      g.lineWidth = boss.radius * 0.06;
      g.lineCap = 'round';
      g.stroke();
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
      // A small ring of dazed stars orbiting overhead -- the clearest
      // possible signal that this is the safe window to walk up and land
      // a bomb hit, as opposed to every other phase.
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

  // A single limb: a thick rounded stroke from (hipX,hipY) to (tipX,tipY)
  // with a small cap circle (boot/glove) at the moving end.
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

      // Legs swing fore/aft opposite each other; arms swing opposite their
      // same-side leg (contralateral, like a real walking gait). Frozen in
      // place while standing still rather than easing to neutral -- reads
      // as a mid-step pause, which is fine at this scale.
      const swing = Math.sin(p.walkPhase) * R * 0.62;
      const bob = Math.abs(Math.cos(p.walkPhase)) * R * 0.05;
      const suitDark = shade(p.color, -0.45);
      const bootColor = '#2b2b28';

      // legs -- drawn first so the torso overlaps their hip ends
      drawLimb(g, 0, -R * 0.3, swing, -R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);
      drawLimb(g, 0, R * 0.3, -swing, R * 0.3, R * 0.34, suitDark, bootColor, R * 0.28);

      // oxygen tank + hose up to the collar
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

      // torso, lit from the upper-left, bobbing slightly with the stride
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

      // hazard chevron stripe across the chest
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

      // arms -- on top of the torso, swinging opposite their same-side leg
      drawLimb(g, 0, -R * 0.55, -swing * 0.8, -R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);
      drawLimb(g, 0, R * 0.55, swing * 0.8, R * 0.55, R * 0.24, p.color, '#e8d94a', R * 0.22);

      // head group -- smaller than the torso and pushed out toward the
      // front, so the silhouette reads as a body with a head on it rather
      // than one circle sitting concentrically inside another (which, at
      // this scale, just looked like an eyeball: white sclera, dark iris,
      // catchlight).
      g.save();
      g.translate(R * 0.55, -bob);
      const headR = R * 0.5;

      // sealed collar ring
      g.beginPath();
      g.arc(0, 0, headR * 1.05, 0, Math.PI * 2);
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 2.5;
      g.stroke();

      // glassy helmet dome
      const helmetGrad = g.createRadialGradient(-headR * 0.3, -headR * 0.35, 1, 0, 0, headR * 1.05);
      helmetGrad.addColorStop(0, '#ffffff');
      helmetGrad.addColorStop(0.35, 'rgba(224,226,216,0.95)');
      helmetGrad.addColorStop(1, 'rgba(150,155,146,0.92)');
      g.beginPath();
      g.arc(0, 0, headR, 0, Math.PI * 2);
      g.fillStyle = helmetGrad;
      g.fill();
      g.strokeStyle = '#1c1c18';
      g.lineWidth = 1.5;
      g.stroke();

      // a narrow faceplate slit, not a big round visor -- a flat band
      // across the front of the helmet reads as a mask, not a pupil.
      const visorGrad = g.createLinearGradient(0, -headR * 0.3, 0, headR * 0.3);
      visorGrad.addColorStop(0, '#1c2a33');
      visorGrad.addColorStop(1, '#03060a');
      g.beginPath();
      g.ellipse(headR * 0.32, 0, headR * 0.34, headR * 0.62, 0, 0, Math.PI * 2);
      g.fillStyle = visorGrad;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.moveTo(headR * 0.18, -headR * 0.4);
      g.lineTo(headR * 0.42, -headR * 0.15);
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = headR * 0.12;
      g.lineCap = 'round';
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

  function buildDarknessMask(camX, camY) {
    const worldToScreen = (wx, wy) => ({ x: (wx - camX) * ZOOM + VIEW_W / 2, y: (wy - camY) * ZOOM + VIEW_H / 2 });

    maskCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, VIEW_W, VIEW_H);

    players.forEach((pl) => {
      const s = worldToScreen(pl.x, pl.y);
      punchLight(maskCtx, s.x, s.y, 90 * ZOOM, 1);
      punchLight(maskCtx, s.x, s.y, 230 * ZOOM, 0.85);
    });

    fireLightPunches().forEach((fc) => {
      const s = worldToScreen(fc.x, fc.y);
      punchLight(maskCtx, s.x, s.y, 130 * ZOOM, 0.75);
    });

    // the boss is on fire -- it lights up its own surroundings, giving
    // players a chance to spot the glow before they're close enough for
    // its own detection range to find them.
    const bs = worldToScreen(boss.x, boss.y);
    punchLight(maskCtx, bs.x, bs.y, boss.radius * 2.2 * ZOOM, 0.6);
  }

  function renderViewport(index, now) {
    const p = players[index];
    const vx = index * VIEW_W;
    const camX = clamp(p.x, VISIBLE_HALF_W, WORLD_W - VISIBLE_HALF_W);
    const camY = clamp(p.y, VISIBLE_HALF_H, WORLD_H - VISIBLE_HALF_H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, 0, VIEW_W, VIEW_H);
    ctx.clip();
    ctx.fillStyle = '#050308';
    ctx.fillRect(vx, 0, VIEW_W, VIEW_H);

    ctx.save();
    ctx.translate(vx + VIEW_W / 2, VIEW_H / 2);
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-camX, -camY);
    drawTiles(ctx, camX, camY, now);
    drawFires(ctx, now);
    drawAttackTelegraphs(ctx, now);
    drawBossBombHazards(ctx, now);
    drawBoss(ctx, now);
    drawPlayers(ctx);
    drawParticles(ctx);
    drawFloatingTexts(ctx);
    ctx.restore();

    buildDarknessMask(camX, camY);
    ctx.drawImage(maskCanvas, vx, 0);

    drawBossHealthBar(vx, now);
    drawProximityWarning(vx, Math.hypot(p.x - boss.x, p.y - boss.y), now);
    drawRadar(vx, p, now);
    drawScanner(vx, p, now);
    const minimapH = drawMinimap(vx, now);
    drawStaminaBar(vx, p, minimapH);

    if (p.caught) drawCutsceneOverlay(vx, p, now);

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

  // A short "gotcha" cutscene rendered only in the caught player's own half:
  // the screen reddens and shakes while a jagged pair of jaws close in from
  // the top and bottom edges, meeting in the middle right as the bite lands.
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
    if (gameState === 'complete') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'THE FIRE GOES OUT &mdash; press Enter to replay, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else if (gameState === 'wiped') {
      messageEl.style.display = 'flex';
      messageEl.innerHTML = 'BOTH OF YOU ARE DOWN &mdash; press Enter to try again, or <a href="index.html" style="color:var(--accent)">back to the menu</a>';
    } else {
      messageEl.style.display = 'none';
    }
  }

  function updateHud() {
    const bossPct = Math.round(100 * clamp(bossHealth, 0, 1));
    hudBossEl.textContent = boss.defeated ? 'Boss: defeated' : boss.phase === 'stunned' ? `Boss: ${bossPct}% (stunned)` : `Boss: ${bossPct}%`;
    hudBossEl.classList.toggle('done', boss.defeated);
    hudDoorEl.textContent = `Door: ${doorUnlocked ? 'open' : 'locked'}`;
    hudDoorEl.classList.toggle('done', doorUnlocked);

    if (gameState === 'complete' && !bestRecorded) {
      bestRecorded = true;
      if (bestMs === null || elapsedMs < bestMs) {
        bestMs = elapsedMs;
        localStorage.setItem(BEST_TIME_KEY, String(bestMs));
      }
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
      updateTriggers();
      updateCrates(now);
      updateBombs(now);
      updateBoss(now, dt);
      updateBossBombHazards(now);
      updateCatch(now);
      updateCutscenes(now);
      updateExploration();
      updateAmbientTension();
    }
    updateParticles(dt);
    updateFloatingTexts(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderViewport(0, now);
    renderViewport(1, now);
    drawDivider();

    if (catchFlash > 0) {
      ctx.fillStyle = `rgba(180,20,30,${catchFlash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      catchFlash -= dt * 1.2;
    }

    updateOverlay();
    updateHud();
    } catch (err) {
      // A single bad frame should never freeze the whole game -- log it
      // and keep the loop running instead of letting the exception cancel
      // the next requestAnimationFrame.
      console.error('goofy-horror: frame skipped after an error', err);
    }
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
