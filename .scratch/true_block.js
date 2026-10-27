    // each monster's body radius in the game itself (the player's is 10): the background
    // draws them at the same proportions to the hazmat chimps as the levels do
    const GAME_RADIUS = {
      0: 16, 1: 24, 2: 12, 3: 13, 4: 11, 5: 128, 6: 16, 7: 16, 8: 64, 9: 10, 10: 24, 11: 72, 12: 22, 13: 24, 14: 8,
      15: 15, 16: 48, 17: 15, 18: 21, 19: 15, 20: 5, 21: 34, 22: 24, 23: 24, 24: 24, 25: 24, 26: 48, 27: 32, 28: 30,
      29: 28, 30: 5, 31: 70, 32: 72, 33: 19, 34: 17, 35: 16, 36: 17,
    };
    const CHIMP_SCALE = 2.6;      // the player's own on-screen scale in the background (radius 10 -> 26px)
    // a model's body radius in its own portrait: the biggest circle that fits inside it, so
    // tentacles, wings and spikes don't count
    const bodyRadii = {};
    function bodyRadius(id) {
      if (bodyRadii[id]) return bodyRadii[id];
      const src = window.MonsterModels.sprite(id, 0), n = src.width;
      const tmp = document.createElement('canvas'); tmp.width = tmp.height = n;
      const tg = tmp.getContext('2d', { willReadFrequently: true });
      tg.drawImage(src, 0, 0);
      const px = tg.getImageData(0, 0, n, n).data, d = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) d[i] = px[i * 4 + 3] > 100 ? 1e9 : 0;
      const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? 0 : d[y * n + x]);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        if (d[y * n + x]) d[y * n + x] = Math.min(at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414, 1e9);
      }
      let best = 0;
      for (let y = n - 1; y >= 0; y--) for (let x = n - 1; x >= 0; x--) {
        if (d[y * n + x]) { d[y * n + x] = Math.min(d[y * n + x], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); best = Math.max(best, d[y * n + x]); }
      }
      return (bodyRadii[id] = Math.max(6, best));
    }
    function trueScale(id) { return GAME_RADIUS[id] * CHIMP_SCALE / bodyRadius(id); }
