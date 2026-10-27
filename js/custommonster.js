// Designer-made monsters (see editor.html). A monster is plain data -- a list
// of shapes in a unit space where 1 = the body radius, facing +x -- so the
// editor's preview, the level that plays it and the menu can all draw the
// exact same thing from one function. Usage:
//   CustomMonster.draw(g, design, { x, y, t, look: {x,y}, rage, tired })
// where `design` is the `monster` object of a slot design (js/customdata.js).
(function () {
  const TAU = Math.PI * 2;
  const rad = (d) => (d || 0) * Math.PI / 180;

  // Every shape type the editor offers, with the fields it uses (and each
  // field's default). Position/size numbers are in body radii.
  const PART_TYPES = {
    circle:   { label: 'Circle',   fields: { x: 0, y: 0, r: 0.5 } },
    ellipse:  { label: 'Ellipse',  fields: { x: 0, y: 0, rx: 0.7, ry: 0.4, rot: 0 } },
    tri:      { label: 'Spike',    fields: { x: 0.6, y: 0, r: 0.5, rot: 0 } },
    rect:     { label: 'Plate',    fields: { x: 0, y: 0, w: 0.8, h: 0.4, rot: 0 } },
    eye:      { label: 'Eye',      fields: { x: 0.5, y: 0.25, r: 0.2 } },
    tentacle: { label: 'Tentacle', fields: { x: -0.4, y: 0.3, len: 1.1, w: 0.18, rot: 150 } },
    mouth:    { label: 'Mouth',    fields: { x: 0.65, y: 0, w: 0.5, h: 0.3, rot: 0 } },
    glow:     { label: 'Glow',     fields: { x: 0, y: 0, r: 0.9 } },
  };

  function newPart(type, color) {
    const spec = PART_TYPES[type];
    const p = { t: type, c: color || '#7a3b4a', mir: 0, wob: 0, a: 1 };
    Object.keys(spec.fields).forEach((k) => { p[k] = spec.fields[k]; });
    return p;
  }

  function shade(hex, amt) {
    const n = parseInt((hex || '#808080').slice(1), 16);
    const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${cl(((n >> 16) & 255) + 255 * amt)},${cl(((n >> 8) & 255) + 255 * amt)},${cl((n & 255) + 255 * amt)})`;
  }

  function drawPart(g, p, t, look, mirrored) {
    const sy = mirrored ? -1 : 1;
    const wob = p.wob || 0;
    const sway = wob ? Math.sin(t * 2.4 + (p.x + p.y * 3) * 5) * wob : 0;
    const x = p.x || 0, y = (p.y || 0) * sy;
    g.save();
    g.globalAlpha *= p.a == null ? 1 : p.a;
    switch (p.t) {
      case 'circle': {
        const r = Math.max(0.01, (p.r || 0.3) * (1 + sway * 0.25));
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        gr.addColorStop(0, shade(p.c, 0.18));
        gr.addColorStop(1, p.c);
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.03; g.stroke();
        break;
      }
      case 'ellipse': {
        g.translate(x, y); g.rotate(rad(p.rot) * sy + sway * 0.3);
        g.fillStyle = p.c;
        g.beginPath(); g.ellipse(0, 0, Math.max(0.01, p.rx), Math.max(0.01, p.ry), 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.03; g.stroke();
        break;
      }
      case 'tri': {
        g.translate(x, y); g.rotate(rad(p.rot) * sy + sway * 0.4);
        const r = p.r || 0.4;
        g.fillStyle = p.c;
        g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.45, -r * 0.5); g.lineTo(-r * 0.45, r * 0.5); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.03; g.stroke();
        break;
      }
      case 'rect': {
        g.translate(x, y); g.rotate(rad(p.rot) * sy + sway * 0.3);
        g.fillStyle = p.c;
        g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.03; g.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        break;
      }
      case 'eye': {
        const r = p.r || 0.15;
        g.fillStyle = '#f2efe6';
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.025; g.stroke();
        // the pupil drifts toward whatever the monster is looking at (look is
        // already expressed in the monster's own rotated frame)
        const lx = look ? look.x : 1, ly = look ? look.y : 0;
        const ll = Math.hypot(lx, ly) || 1;
        const px = x + (lx / ll) * r * 0.35, py = y + (ly / ll) * r * 0.35 * sy;
        g.fillStyle = p.c;
        g.beginPath(); g.arc(px, py, r * 0.62, 0, TAU); g.fill();
        g.fillStyle = '#050505';
        g.beginPath(); g.arc(px, py, r * 0.3, 0, TAU); g.fill();
        break;
      }
      case 'tentacle': {
        g.translate(x, y); g.rotate(rad(p.rot) * sy);
        const len = p.len || 1, w = p.w || 0.15;
        const segs = 8;
        let px = 0, py = 0;
        for (let i = 1; i <= segs; i++) {
          const f = i / segs;
          const nx = len * f;
          const ny = Math.sin(t * 3 + f * 3.2 + (p.x + p.y) * 4) * (0.12 + (wob || 0.25)) * f * len * 0.5;
          g.strokeStyle = p.c;
          g.lineCap = 'round';
          g.lineWidth = Math.max(0.025, w * (1 - f * 0.8));
          g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
          px = nx; py = ny;
        }
        break;
      }
      case 'mouth': {
        g.translate(x, y); g.rotate(rad(p.rot) * sy);
        const w = p.w || 0.4, h = p.h || 0.25;
        g.fillStyle = '#12060a';
        g.beginPath(); g.ellipse(0, 0, h / 2, w / 2, 0, 0, TAU); g.fill();
        // teeth along the top and bottom of the opening
        g.fillStyle = p.c || '#eee';
        const n = 5;
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n - 0.5;
          const ty = f * w * 0.9;
          const tx = Math.sqrt(Math.max(0, 1 - (ty / (w / 2)) ** 2)) * (h / 2);
          g.beginPath();
          g.moveTo(-tx, ty - w * 0.05); g.lineTo(-tx + h * 0.4, ty); g.lineTo(-tx, ty + w * 0.05); g.fill();
          g.beginPath();
          g.moveTo(tx, ty - w * 0.05); g.lineTo(tx - h * 0.4, ty); g.lineTo(tx, ty + w * 0.05); g.fill();
        }
        break;
      }
      case 'glow': {
        const r = p.r || 0.8;
        const pulse = 1 + Math.sin(t * 3) * 0.08;
        const gr = g.createRadialGradient(x, y, 0, x, y, r * pulse);
        gr.addColorStop(0, p.c);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha *= 0.55;
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r * pulse, 0, TAU); g.fill();
        break;
      }
      default: break;
    }
    g.restore();
  }

  // Obsidian: the whole monster hardens into glossy black glass. Drawn to a
  // scratch canvas first so the dark tint only lands on the monster's own pixels.
  let scratch = null;
  function drawObsidian(g, design, o) {
    const size = design.size || 22;
    const half = Math.ceil(size * 3.4) + 24;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width !== half * 2) { scratch.width = half * 2; scratch.height = half * 2; }
    const sg = scratch.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, scratch.width, scratch.height);
    draw(sg, design, Object.assign({}, o, { x: half, y: half, obsidian: 0, rage: 0, tired: false, flash: 0 }));
    sg.globalCompositeOperation = 'source-atop';
    sg.fillStyle = `rgba(16,12,24,${0.84 * o.obsidian})`;
    sg.fillRect(0, 0, scratch.width, scratch.height);
    const gl = sg.createLinearGradient(half - size, half - size, half + size, half + size);
    gl.addColorStop(0, `rgba(220,200,255,${0.0})`);
    gl.addColorStop(0.45, `rgba(220,200,255,${0.32 * o.obsidian})`);
    gl.addColorStop(0.55, `rgba(220,200,255,${0.0})`);
    sg.fillStyle = gl;
    sg.fillRect(0, 0, scratch.width, scratch.height);
    sg.globalCompositeOperation = 'source-over';
    g.drawImage(scratch, (o.x || 0) - half, (o.y || 0) - half);
    if (o.flash) {
      g.save();
      g.fillStyle = `rgba(255,255,255,${0.55 * o.flash})`;
      g.beginPath(); g.arc(o.x || 0, o.y || 0, size * 1.05, 0, TAU); g.fill();
      g.restore();
    }
  }

  function draw(g, design, o) {
    o = o || {};
    if (o.obsidian > 0) { drawObsidian(g, design, o); return; }
    const size = design.size || 22;
    const parts = design.parts || [];
    const t = o.t || 0;
    const look = o.look || { x: 1, y: 0 };
    const ang = design.rotate === false ? 0 : Math.atan2(look.y, look.x);
    g.save();
    g.translate(o.x || 0, o.y || 0);
    if (o.scale) g.scale(o.scale, o.scale);
    // soft contact shadow, unrotated
    g.beginPath();
    g.ellipse(0, size * 0.85, size * 0.9, size * 0.28, 0, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fill();
    // idle breathing
    const breathe = 1 + Math.sin(t * 2.1) * 0.03;
    g.scale(size * breathe, size * breathe);
    g.rotate(ang);
    const localLook = { x: Math.cos(Math.atan2(look.y, look.x) - ang), y: Math.sin(Math.atan2(look.y, look.x) - ang) };
    parts.forEach((p) => {
      drawPart(g, p, t, localLook, false);
      if (p.mir) drawPart(g, p, t, localLook, true);
    });
    g.restore();

    if (o.rage > 0 || o.tired || o.flash) {
      g.save();
      g.translate(o.x || 0, o.y || 0);
      if (o.rage > 0) {
        const gr = g.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.6);
        gr.addColorStop(0, `rgba(255,50,40,${0.25 * o.rage})`);
        gr.addColorStop(1, 'rgba(255,50,40,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, 0, size * 1.6, 0, TAU); g.fill();
      }
      if (o.flash) {
        g.fillStyle = `rgba(255,255,255,${0.55 * o.flash})`;
        g.beginPath(); g.arc(0, 0, size * 1.05, 0, TAU); g.fill();
      }
      if (o.tired) {
        // dizzy stars circling overhead
        g.fillStyle = '#ffe27a';
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + i * (TAU / 3);
          g.beginPath();
          g.arc(Math.cos(a) * size * 0.7, -size * 1.1 + Math.sin(a) * size * 0.22, 3, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    }
  }

  // ---- defaults ----
  const AI_TYPES = {
    stalker:  { label: 'Stalker',  help: 'Patrols the halls. Spots you within its sight range, then chases for a while before giving up.' },
    hunter:   { label: 'Hunter',   help: 'Always knows where you are and relentlessly hunts the nearest player. Slower to compensate.' },
    ambusher: { label: 'Ambusher', help: 'Sits perfectly still until you get close, rushes you, then slinks back to its spot.' },
    listener: { label: 'Listener', help: 'Blind, but hears you: sprinting carries far through walls, walking is only heard up close.' },
  };

  function defaultAI() {
    return { type: 'stalker', patrol: 0.55, chase: 1.45, detect: 150, grace: 3, count: 1, blink: 0, aura: false };
  }

  const BOSS_ATTACKS = {
    charge:     { label: 'Charge',     help: 'Telegraphs a line, then dashes along it. Crashing into a wall dazes it longer.' },
    fireballs:  { label: 'Fireballs',  help: 'Three volleys of three shots aimed at you.' },
    shockwave:  { label: 'Shockwave',  help: 'An expanding ring with one gap to slip through.' },
    slam:       { label: 'Slam',       help: 'Marks circles under you; they explode a second later.' },
    spin:       { label: 'Spin',       help: 'Whirling blades sweep around it.' },
    obsidian:   { label: 'Obsidian',   help: 'Hardens into glossy black glass and ricochets off the walls at 1.5x speed for 10 seconds.' },
    magma:      { label: 'Magma lobs', help: 'Lobs three blobs of magma: each shows a shadow for 2 seconds, then splats into a 3x3-tile puddle that burns for 3 seconds.' },
  };

  function defaultBoss() {
    return { hp: 6, attacks: ['charge', 'fireballs', 'slam'], rest: 4, speed: 0.75, bombEvery: 0, bombDmg: 1, pause: 1.5 };
  }

  function defaultMonster(kind) {
    const m = {
      name: 'Unnamed Horror',
      desc: 'Something you built.',
      size: kind === 'miniboss' ? 34 : 22,
      rotate: true,
      parts: [
        Object.assign(newPart('tentacle', '#4a1f2e'), { x: -0.5, y: 0.35, rot: 160, len: 1.2, mir: 1, wob: 0.3 }),
        Object.assign(newPart('circle', '#7a3b4a'), { x: 0, y: 0, r: 1 }),
        Object.assign(newPart('eye', '#ff3b3b'), { x: 0.5, y: 0.3, r: 0.22, mir: 1 }),
        Object.assign(newPart('mouth', '#f2efe6'), { x: 0.78, y: 0, w: 0.5, h: 0.3 }),
      ],
      ai: defaultAI(),
    };
    if (kind === 'miniboss') {
      m.boss = defaultBoss();
      m.ai.type = 'hunter';
    }
    return m;
  }

  window.CustomMonster = { PART_TYPES, AI_TYPES, BOSS_ATTACKS, newPart, draw, defaultMonster, defaultAI, defaultBoss, shade };
})();
