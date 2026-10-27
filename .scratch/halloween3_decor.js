  // ---- Ventilation system decor ----
//@@CANDY@@

  // One tile of the ducts: riveted steel walls, grated steel floor.
  function drawVentTile(g, ch, x, y, px, py) {
    let color;
    switch (ch) {
      case '#': color = '#272d35'; break;
      case 'S': color = '#6b7480'; break;
      case 'W': color = '#2a3038'; break;
      case 'E': color = '#6e6552'; break;
      case 'D': color = '#34302a'; break;
      default: color = ['#4a525c', '#4f5762', '#464e58', '#525a65'][Math.floor(hash2(x, y, 3) * 4)];
    }
    g.fillStyle = color;
    g.fillRect(px, py, TILE, TILE);
    if (ch === '#') {
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      g.fillStyle = 'rgba(150,160,172,0.35)';
      [[5, 5], [TILE - 5, 5], [5, TILE - 5], [TILE - 5, TILE - 5]].forEach(([dx, dy]) => { g.beginPath(); g.arc(px + dx, py + dy, 1.6, 0, Math.PI * 2); g.fill(); });
    } else if (ch !== 'D') {
      g.fillStyle = 'rgba(0,0,0,0.26)';        // grating slits
      for (let i = 0; i < 3; i++) g.fillRect(px + 4, py + 6 + i * 9, TILE - 8, 3);
      if (ch === 'S') { g.strokeStyle = 'rgba(255,200,60,0.5)'; g.lineWidth = 1.5; g.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2); }
    }
  }

  // The giant fan in the middle of the vent room: six big blades in a steel
  // housing. It's a blur while it's at full speed, and you can see it slow
  // down and finally stop as the levers are held.
  function drawGiantFan(g, fp, spin, speed, now) {
    const c = tileCenter(fp.x, fp.y);
    g.save();
    g.translate(c.x, c.y);
    g.fillStyle = '#1b2028'; g.beginPath(); g.arc(0, 0, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#59636e'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#10141a'; g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.fill();
    if (speed > 0.55) {                       // a spinning blur
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(150,162,176,${0.1 * speed})`;
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 108, spin * 0.3 + i * Math.PI / 3, spin * 0.3 + i * Math.PI / 3 + Math.PI / 5); g.closePath(); g.fill();
      }
    }
    g.save();
    g.rotate(spin);
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate(i * Math.PI / 3);
      g.globalAlpha = speed > 0.55 ? 0.55 : 1;
      g.fillStyle = '#8994a1'; g.strokeStyle = '#2b323b'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(16, -8); g.quadraticCurveTo(70, -34, 108, -12); g.lineTo(108, 14); g.quadraticCurveTo(66, -4, 16, 10); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
    g.fillStyle = '#39424c'; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6a7580'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(120,132,146,0.5)'; g.lineWidth = 2;                    // the guard grille
    for (let r = 40; r <= 100; r += 30) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    g.restore();
  }

  // A heavy lever: a base plate with a slot, a long handle that swings down
  // when it's being held, and a glowing ring that tells you to stand here.
  function drawLever(g, lv, held, active, now) {
    const c = tileCenter(lv.x, lv.y);
    g.save();
    g.translate(c.x, c.y);
    if (active) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
      g.strokeStyle = held ? 'rgba(90,255,150,0.9)' : `rgba(255,190,70,${0.45 + 0.4 * pulse})`;
      g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#2a3038'; g.fillRect(-18, -22, 36, 44);
    g.strokeStyle = '#6a7580'; g.lineWidth = 2; g.strokeRect(-18, -22, 36, 44);
    g.fillStyle = '#0e1116'; g.fillRect(-4, -16, 8, 32);
    const handleY = held ? 12 : -14;
    g.strokeStyle = '#a8b2bd'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, handleY); g.stroke();
    g.fillStyle = !active ? '#6a6f78' : held ? '#4cff8a' : '#ff5a3c';
    g.beginPath(); g.arc(0, handleY, 7, 0, Math.PI * 2); g.fill();
    g.restore();
  }

//@@LAMP@@
