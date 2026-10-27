p = 'js/game5.js'
s = open(p, encoding='utf-8').read()
block = open('.scratch/magma_block.js', encoding='utf-8').read()

a = '  // ---- rendering ----\n  function drawTiles('
assert a in s
s = s.replace(a, block + a, 1)

# cracks go right after the floor tiles, under the door plug, corpses, crates and bombs
a = "    // door plug (a short 2-tile gap in the exit alcove's wall)\n"
assert a in s
s = s.replace(a, "    drawMagmaCracks(g, camX, camY, now);\n\n" + a, 1)

# the glow goes over the darkness mask
a = "    buildDarknessMask(camX, camY, now);\n    ctx.drawImage(maskCanvas, vx, 0);\n"
assert a in s
s = s.replace(a, a + "    ctx.save();\n    ctx.translate(vx, 0);\n    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();\n    drawMagmaGlow(ctx, camX, camY, now);\n    ctx.restore();\n", 1)

a = "    updateParticles(dt);\n    updateFloatingTexts(dt);"
assert a in s
s = s.replace(a, "    updateParticles(dt);\n    updateEmbers(dt);\n    updateFloatingTexts(dt);", 1)

# boss attack impacts throw sparks
a = "      spawnFloatingText(tg.x, tg.y, 'BOOM!');\n"
assert a in s
s = s.replace(a, a + "      spawnEmberBurst(tg.x, tg.y, 34);\n", 1)
a = "      spawnFloatingText(tg.x, tg.y, 'SPIKE!');\n"
assert a in s
s = s.replace(a, a + "      spawnEmberBurst(tg.x, tg.y, 26);\n", 1)

open(p, 'w', encoding='utf-8').write(s)
