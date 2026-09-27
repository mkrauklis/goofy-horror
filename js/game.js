(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const halfWidth = width / 2;

  const TRACKED_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (TRACKED_KEYS.has(e.key)) {
      keys[e.key] = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (TRACKED_KEYS.has(e.key)) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });

  function makePlayer(x, y, color, bounds) {
    return { x, y, size: 24, speed: 3, color, bounds };
  }

  const players = [
    makePlayer(halfWidth / 2, height / 2, '#ff8a3d', { minX: 0, maxX: halfWidth }),
    makePlayer(halfWidth + halfWidth / 2, height / 2, '#3ddc84', { minX: halfWidth, maxX: width }),
  ];

  function clampPlayer(p) {
    const half = p.size / 2;
    p.x = Math.max(p.bounds.minX + half, Math.min(p.bounds.maxX - half, p.x));
    p.y = Math.max(half, Math.min(height - half, p.y));
  }

  function update() {
    const p1 = players[0];
    if (keys.w) p1.y -= p1.speed;
    if (keys.s) p1.y += p1.speed;
    if (keys.a) p1.x -= p1.speed;
    if (keys.d) p1.x += p1.speed;
    clampPlayer(p1);

    const p2 = players[1];
    if (keys.ArrowUp) p2.y -= p2.speed;
    if (keys.ArrowDown) p2.y += p2.speed;
    if (keys.ArrowLeft) p2.x -= p2.speed;
    if (keys.ArrowRight) p2.x += p2.speed;
    clampPlayer(p2);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    players.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });

    ctx.strokeStyle = '#3a2a44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 0);
    ctx.lineTo(halfWidth, height);
    ctx.stroke();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loop();
})();
