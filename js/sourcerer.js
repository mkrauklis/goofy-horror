// The Sourcerer: a hazmat man in a wizard hat who lives in a secret room below Halloween 1. Walk
// up to him and you get the "Secrets of the Sourcerer" screen, where typed codes warp you to
// secret levels, open locked levels, or just tease what's coming. This file holds his model, the
// screen, and the code table; js/halloween1.js owns the vent, the room and when the screen opens.
(function () {
  const USED_KEY = 'goofy-horror-sourcerer';
  const story = () => window.GoofyStory;

  // ---- the codes ----
  // Letters and digits only, case-insensitive ("The Mental Challenge" = "thementalchallenge").
  // `say` is what he answers; `warp` also sends you there; `run` does something to your save.
  const CODES = {
    thementalchallenge: {
      say: 'Ahh. So you came for the real test. No colour. Every beast I have ever met, all awake at once, and twenty-five buttons between you and the door. Mind the eyes.',
      warp: 'mentalchallenge.html',
    },
    overgrown: {
      say: 'You want to see what is under the floor? Hold your breath. It smells of moss and old concrete.',
      warp: 'season2level1.html',
    },
    jackolantern: {
      say: 'The candy road opens: Halloween 2 through 5 are yours. Do not tell the Pumpkin King I let you skip the queue.',
      run() { for (let n = 2; n <= 5; n++) story().unlockHalloween(n); },
    },
    openthedoors: {
      say: 'Every door of the long story swings open. Levels 1 to 31, all unlocked. You still have to survive them.',
      run() { story().unlockAllLevels(); },
    },
    ironstomach: {
      say: 'Hard Mode is open to you now. It is the same house, but the house has noticed you.',
      run() { story().unlockHard(); },
    },
    dream: {
      say: 'Ah. You want to sleep. Very well. Be careful what you look at, and do not expect it to look away. You will wake up here when it is over.',
      warp: 'dreamroom.html',
    },
    lilleperchaun: {
      say: 'The little ones. Harmless, quite harmless. They only want you to come close. If your head starts to feel warm, that is just the sun.',
      warp: 'leprechaunfield.html',
    },
    lilleprechaun: {
      say: 'The little ones. Harmless, quite harmless. They only want you to come close. If your head starts to feel warm, that is just the sun.',
      warp: 'leprechaunfield.html',
    },
    mokey: {
      say: 'Shh. Listen. They heard you say it. Do not move, and do not laugh, and whatever you do, do not look up.',
      run() { startMonkeys(); },
    },
    monkey: {
      say: 'Shh. Listen. They heard you say it. Do not move, and do not laugh, and whatever you do, do not look up.',
      run() { startMonkeys(); },
    },
    selrahc123: {
      say: 'Hard Mode is open, and every one of its levels with it, all 31, start to finish. Whoever Charles was, he was thorough.',
      run() { story().unlockAllHardLevels(); },
    },
    season2: {
      say: 'The fall was only the first floor. Beneath that forest there is more facility, and the yellow thing with the grass on its back is not the worst resident.',
    },
    pumpkinking: {
      say: 'He wears the whole harvest as armour. If his lantern starts to laugh, do not be standing near it.',
    },
    lastknight: {
      say: 'He has guarded that throne for so long he forgot what it was guarding against. Do not remind him.',
    },
    multipod: {
      say: 'It is not one monster. It is all of them, holding hands, and it is very good at stairs.',
    },
    chaos: {
      say: 'On the roof, on the hardest night, there is something with a hundred eyes. It watches every one of you at once. Blink first.',
    },
    candy: {
      say: 'Take some. The pumpkins will not mind. They have not minded anything for years.',
    },
    sourcerer: {
      say: 'Me? I was on the survey team. Then I found a vent, and a hat, and a use for both.',
    },
    hint: {
      say: 'Try the names of things you have met. Or the names of things you have not. One phrase here is a test for people who think they are brave, and it is just three plain words long. Well. Four.',
    },
    help: {
      say: 'Type a word and press Enter. Names of monsters get you gossip. Names of places can get you doors. Some phrases open levels nobody has built a hallway to.',
    },
  };
  const FIZZLES = [
    'The spell fizzles. A small pumpkin looks embarrassed for you.',
    'Nothing. The candle flickers and goes back to normal.',
    'No such word in my books. Try another.',
    'That is not a spell. That is just typing.',
  ];

  function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function loadUsed() {
    try {
      const v = JSON.parse(localStorage.getItem(USED_KEY));
      if (Array.isArray(v)) return v;
    } catch (e) { /* ignore */ }
    return [];
  }
  function remember(code) {
    const used = loadUsed();
    if (used.indexOf(code) === -1) {
      used.push(code);
      try { localStorage.setItem(USED_KEY, JSON.stringify(used)); } catch (e) { /* ignore */ }
    }
    return used.length;
  }


  // ---- "mokey": twenty seconds of monkeys, more and more of them, then silence and an achievement ----
  const MONKEY_MS = 20000;
  let monkeyRun = null;

  function monkeyCall(ac, t0, vol, kind) {
    // an "oo-oo" is a low rising hoot, an "ah-ah" a short bark, a screech a long bright wail: a
    // sawtooth through a formant filter, with a pitch glide and a fast vibrato
    const osc = ac.createOscillator(), lfo = ac.createOscillator(), lfoGain = ac.createGain();
    const filt = ac.createBiquadFilter(), env = ac.createGain();
    const dur = kind === 'screech' ? 0.7 : kind === 'ah' ? 0.16 : 0.26;
    const f0 = kind === 'screech' ? 900 : kind === 'ah' ? 520 : 330;
    const f1 = kind === 'screech' ? 1900 : kind === 'ah' ? 380 : 620;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * (0.9 + Math.random() * 0.25), t0);
    osc.frequency.exponentialRampToValueAtTime(f1 * (0.9 + Math.random() * 0.25), t0 + dur);
    lfo.frequency.value = kind === 'screech' ? 28 : 14;
    lfoGain.gain.value = kind === 'screech' ? 90 : 30;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(kind === 'ah' ? 1300 : 800, t0);
    filt.frequency.linearRampToValueAtTime(kind === 'ah' ? 900 : 1500, t0 + dur);
    filt.Q.value = 3;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filt); filt.connect(env); env.connect(ac.destination);
    osc.start(t0); lfo.start(t0);
    osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  }

  function startMonkeys() {
    if (monkeyRun) return;
    let ac = null;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* silent run, still counts */ }
    const t0 = performance.now();
    monkeyRun = setInterval(() => {
      const e = performance.now() - t0;
      if (e >= MONKEY_MS) {
        clearInterval(monkeyRun); monkeyRun = null;
        if (ac) setTimeout(() => ac.close(), 1200);
        if (window.Achievements) window.Achievements.unlock('greatape');
        return;
      }
      const k = e / MONKEY_MS;
      // calls per second climb from a lonely one to a full jungle
      const rate = 0.5 + 9 * k * k;
      if (!ac || Math.random() > rate * 0.12) return;
      const vol = 0.05 + 0.2 * k;
      const now = ac.currentTime + 0.01;
      const r = Math.random();
      if (r < 0.12 + 0.2 * k) monkeyCall(ac, now, vol * 0.9, 'screech');
      else if (r < 0.55) { monkeyCall(ac, now, vol, 'oo'); monkeyCall(ac, now + 0.3, vol, 'oo'); monkeyCall(ac, now + 0.6, vol * 1.1, 'ah'); }
      else { monkeyCall(ac, now, vol, 'ah'); monkeyCall(ac, now + 0.2, vol, 'ah'); }
    }, 120);
  }

  // ---- the model: a yellow hazmat suit, a visored helmet, a tall star-spangled hat, a glowing staff ----
  // Drawn facing the viewer, feet at (0, 0 + 14*s), centred on the body. `s` is the scale (1 = player size).
  function drawFigure(g, now, s) {
    const bob = Math.sin(now * 0.003) * 1.2 * s;
    g.save();
    g.scale(s, s);
    g.translate(0, bob / s);

    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(0, 15, 12, 4, 0, 0, Math.PI * 2); g.fill();

    // staff, held on his right
    g.strokeStyle = '#5a3a1c'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(15, 14); g.lineTo(15, -26); g.stroke();
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.006);
    const orb = g.createRadialGradient(15, -30, 1, 15, -30, 14);
    orb.addColorStop(0, `rgba(240,200,255,${0.95 * pulse})`);
    orb.addColorStop(0.4, `rgba(170,90,255,${0.6 * pulse})`);
    orb.addColorStop(1, 'rgba(120,40,220,0)');
    g.fillStyle = orb; g.beginPath(); g.arc(15, -30, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e9c8ff'; g.beginPath(); g.arc(15, -30, 3.4, 0, Math.PI * 2); g.fill();

    // boots + legs
    g.fillStyle = '#2a2a2e';
    g.fillRect(-8, 11, 7, 5); g.fillRect(1, 11, 7, 5);
    g.fillStyle = '#d8b21c';
    g.fillRect(-7, 3, 6, 9); g.fillRect(1, 3, 6, 9);

    // suit body
    const body = g.createLinearGradient(-11, 0, 11, 0);
    body.addColorStop(0, '#b8940f'); body.addColorStop(0.5, '#f0cc2c'); body.addColorStop(1, '#a68410');
    g.fillStyle = body;
    g.beginPath(); g.moveTo(-11, -8); g.quadraticCurveTo(-13, 2, -9, 8); g.lineTo(9, 8); g.quadraticCurveTo(13, 2, 11, -8); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,0,0.7)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#26262a';                                  // belt with a hazard stripe
    g.fillRect(-10, 2, 20, 3);
    g.fillStyle = '#d8b21c';
    for (let i = 0; i < 5; i++) g.fillRect(-9 + i * 4, 2, 2, 3);
    g.fillStyle = '#3a3a40'; g.fillRect(-4, -5, 8, 5);        // chest filter box
    g.fillStyle = '#7ad0ff'; g.fillRect(-2, -4, 4, 2);

    // arms
    g.fillStyle = '#e2bd22';
    g.beginPath(); g.ellipse(-12, -1, 3.4, 8, 0.12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(13, -4, 3.4, 7, -0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2a2e'; g.beginPath(); g.arc(15, -4, 3.2, 0, Math.PI * 2); g.fill();

    // helmet
    g.fillStyle = '#d0d4d8';
    g.beginPath(); g.arc(0, -17, 10, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,50,60,0.8)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#1b2a2c';                                  // visor
    g.beginPath(); g.ellipse(0, -17, 7.4, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(140,255,200,0.35)';
    g.beginPath(); g.ellipse(-2.4, -19, 3, 1.6, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';                                     // two eyes behind the glass
    g.beginPath(); g.arc(-2.6, -16.5, 1.5, 0, Math.PI * 2); g.arc(2.6, -16.5, 1.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.arc(-2.3, -16.3, 0.7, 0, Math.PI * 2); g.arc(2.9, -16.3, 0.7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3a40'; g.lineWidth = 2;               // breathing hose
    g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(7, -8, 6, -2); g.stroke();

    // wizard hat: wide brim, tall bent cone, stars
    g.fillStyle = '#4a2a8a';
    g.beginPath(); g.ellipse(0, -24, 15, 4.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b34a8';
    g.beginPath();
    g.moveTo(-9, -25); g.quadraticCurveTo(-3, -44, 8, -52); g.quadraticCurveTo(9, -41, 9, -25); g.closePath(); g.fill();
    g.fillStyle = '#3a1f70'; g.fillRect(-9, -28, 18, 3);
    g.fillStyle = '#d9b24a'; g.fillRect(-2.5, -28.5, 5, 4);
    g.fillStyle = '#ffe27a';
    [[-2, -35, 1.6], [3, -42, 1.2], [4, -31, 1.1]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });

    g.restore();
  }

  // ---- the screen ----
  let overlay = null, onClose = null, raf = 0, portrait = null;

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'sourcerer-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;'
      + 'background:radial-gradient(ellipse at center,rgba(40,16,70,0.96),rgba(6,2,12,0.98));color:#eadcff;'
      + 'font:16px/1.45 Georgia,serif;padding:16px;box-sizing:border-box';
    overlay.innerHTML = `
      <div style="width:min(720px,100%);border:2px solid #8a5ad8;border-radius:14px;background:rgba(14,6,26,0.92);
        box-shadow:0 0 40px rgba(150,80,255,0.45);padding:20px 24px;box-sizing:border-box">
        <h1 style="margin:0 0 4px;text-align:center;font-size:28px;letter-spacing:.14em;color:#ffe27a;
          text-shadow:0 0 14px rgba(255,200,80,0.6)">SECRETS OF THE SOURCERER</h1>
        <p id="src-count" style="margin:0 0 14px;text-align:center;font-size:13px;color:#a78bd8"></p>
        <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center">
          <canvas id="src-portrait" width="150" height="190" style="flex:none;border-radius:10px;background:#1a0c2c"></canvas>
          <div id="src-log" style="flex:1;min-width:240px;min-height:110px;padding:12px 14px;background:#0a0414;border:1px solid #4a2c80;
            border-radius:8px;font-size:17px"></div>
        </div>
        <form id="src-form" autocomplete="off" style="display:flex;gap:10px;margin-top:16px">
          <input id="src-input" type="text" maxlength="40" spellcheck="false" autocapitalize="off" autocomplete="off"
            placeholder="speak a word&hellip;" style="flex:1;padding:10px 12px;font:18px monospace;color:#ffe27a;background:#0a0414;
            border:2px solid #6a3ab8;border-radius:8px;outline:none">
          <button type="submit" style="padding:10px 18px;font:bold 16px Georgia,serif;color:#1a0c2c;background:#ffe27a;border:0;border-radius:8px;cursor:pointer">Cast</button>
          <button type="button" id="src-leave" style="padding:10px 18px;font:16px Georgia,serif;color:#eadcff;background:transparent;border:2px solid #6a3ab8;border-radius:8px;cursor:pointer">Leave</button>
        </form>
        <p style="margin:10px 0 0;text-align:center;font-size:12px;color:#8f7ab8">Enter to cast &middot; Esc to leave</p>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#src-input');
    overlay.querySelector('#src-form').addEventListener('submit', (e) => { e.preventDefault(); cast(input.value); input.value = ''; });
    overlay.querySelector('#src-leave').addEventListener('click', close);
    // The game's own key handlers sit on window; keep typed letters (WASD) out of them.
    overlay.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    overlay.addEventListener('keyup', (e) => e.stopPropagation());
    portrait = overlay.querySelector('#src-portrait').getContext('2d');
  }

  function say(text) { overlay.querySelector('#src-log').textContent = text; }

  function cast(raw) {
    const code = normalize(raw);
    if (!code) return;
    const def = CODES[code];
    if (!def) { say(FIZZLES[Math.floor(Math.random() * FIZZLES.length)]); return; }
    const known = remember(code);
    overlay.querySelector('#src-count').textContent = `Spells spoken: ${known}`;
    try { if (def.run) def.run(); } catch (e) { console.error('sourcerer code failed', e); }
    say(def.say + (def.warp ? ' (Hold on to something.)' : ''));
    if (def.warp) {
      try { sessionStorage.setItem('goofy-horror-sourcerer-warp', def.warp); } catch (e) { /* ignore */ }
      overlay.querySelector('#src-input').disabled = true;
      setTimeout(() => { window.location.href = def.warp; }, 2600);
    }
  }

  function frame(now) {
    if (!overlay) return;
    const c = portrait.canvas;
    portrait.clearRect(0, 0, c.width, c.height);
    const glow = portrait.createRadialGradient(75, 100, 8, 75, 100, 110);
    glow.addColorStop(0, 'rgba(150,80,255,0.35)'); glow.addColorStop(1, 'rgba(20,8,40,0)');
    portrait.fillStyle = glow; portrait.fillRect(0, 0, c.width, c.height);
    portrait.save();
    portrait.translate(66, 108);
    drawFigure(portrait, now, 2.3);
    portrait.restore();
    raf = requestAnimationFrame(frame);
  }

  function open(opts) {
    if (overlay) return;
    onClose = (opts && opts.onClose) || null;
    build();
    overlay.querySelector('#src-count').textContent = `Spells spoken: ${loadUsed().length}`;
    say('Ah, a visitor. Few find the vent. Speak a word, and I shall see what it is worth.');
    frame(performance.now());
    setTimeout(() => { const i = overlay && overlay.querySelector('#src-input'); if (i) i.focus(); }, 30);
  }

  function close() {
    if (!overlay) return;
    cancelAnimationFrame(raf);
    overlay.remove();
    overlay = null;
    const cb = onClose; onClose = null;
    if (cb) cb();
  }

  window.Sourcerer = { open, close, isOpen: () => !!overlay, drawFigure, normalize, CODES };
})();
