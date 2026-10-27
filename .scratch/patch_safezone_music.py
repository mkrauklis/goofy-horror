import re, glob

FILES = sorted(glob.glob('C:/claude_p/goofy-horror/js/game*.js'))

NEW_CHORD_PAD_COMMENT = """    // Gentle chord pad that fades in while a player is resting in the safe
    // zone -- dark-ambient/hauntology leaning (slow tape-warble "wow" on
    // top of the faster vibrato, a constant filtered-noise hiss, a darker
    // lowpass) so it reads as a half-degraded transmission rather than
    // clean "elevator music" -- creepy but still calming, not harsh."""

OLD_CHORD_PAD_COMMENT_RE = re.compile(
    r"    // Gentle chord pad that fades in while a player is resting in the safe\n"
    r"    // zone -- pitched down a bit, softly bitcrushed and lightly echoed for\n"
    r"    // a lower, dreamier \"liminal elevator music\" character, with an\n"
    r"    // occasional subtle flutter \(see scheduleSafeMusicGlitch\) rather than\n"
    r"    // anything harsh\."
)

OLD_VOICE_BODY_RE = re.compile(
    r"      const osc = audioCtx\.createOscillator\(\);\n"
    r"      osc\.type = 'sine';\n"
    r"      osc\.frequency\.value = freq;\n"
    r"      const voiceGain = audioCtx\.createGain\(\);\n"
    r"      voiceGain\.gain\.value = 0\.16;\n"
    r"      const vibrato = audioCtx\.createOscillator\(\);\n"
    r"      vibrato\.frequency\.value = 0\.1 \+ i \* 0\.03;\n"
    r"      const vibratoGain = audioCtx\.createGain\(\);\n"
    r"      vibratoGain\.gain\.value = 1\.5;\n"
    r"      vibrato\.connect\(vibratoGain\);\n"
    r"      vibratoGain\.connect\(osc\.frequency\);\n"
    r"      vibrato\.start\(\);\n"
    r"      osc\.connect\(voiceGain\);\n"
    r"      voiceGain\.connect\(safeGlitchGain\);\n"
    r"      osc\.start\(\);\n"
    r"      safeVoices\.push\(osc\);\n"
    r"    \}\);"
)

NEW_VOICE_BODY = """      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const voiceGain = audioCtx.createGain();
      voiceGain.gain.value = 0.16;
      const vibrato = audioCtx.createOscillator();
      vibrato.frequency.value = 0.1 + i * 0.03;
      const vibratoGain = audioCtx.createGain();
      vibratoGain.gain.value = 1.5;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();
      // A second, much slower LFO under the fast vibrato -- a deeper,
      // draggier "wow" like a tape mechanism struggling, not just a
      // clean chorus-y wobble.
      const wow = audioCtx.createOscillator();
      wow.frequency.value = 0.045 + i * 0.015;
      const wowGain = audioCtx.createGain();
      wowGain.gain.value = 2.4;
      wow.connect(wowGain);
      wowGain.connect(osc.frequency);
      wow.start();
      osc.connect(voiceGain);
      voiceGain.connect(safeGlitchGain);
      osc.start();
      safeVoices.push(osc);
    });

    // A faint, constant filtered-noise hiss under the pad -- the
    // transmission/tape-hiss half of the hauntology texture, always
    // there at a steady low level rather than reacting to anything.
    const hissBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const hissData = hissBuffer.getChannelData(0);
    for (let hi = 0; hi < hissData.length; hi++) hissData[hi] = Math.random() * 2 - 1;
    const hissSource = audioCtx.createBufferSource();
    hissSource.buffer = hissBuffer;
    hissSource.loop = true;
    const hissFilter = audioCtx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 2600;
    const hissGain = audioCtx.createGain();
    hissGain.gain.value = 0.018;
    hissSource.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(safeMusicGain);
    hissSource.start();"""

GLITCH_FN_RE = re.compile(
    r"  function scheduleSafeMusicGlitch\(\) \{.*?\n  \}\n", re.DOTALL
)

NEW_GLITCH_FN = """  function scheduleSafeMusicGlitch() {
    const delay = 3000 + Math.random() * 4500;
    setTimeout(() => {
      if (!audioCtx || !safeGlitchGain) return;
      const t = audioCtx.currentTime;
      safeGlitchGain.gain.cancelScheduledValues(t);
      safeGlitchGain.gain.setValueAtTime(1, t);
      let tt = t;
      const stutters = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < stutters; i++) {
        tt += 0.05 + Math.random() * 0.04;
        safeGlitchGain.gain.setValueAtTime(0.22, tt);
        tt += 0.04 + Math.random() * 0.04;
        safeGlitchGain.gain.setValueAtTime(1, tt);
      }
      if (Math.random() < 0.55) {
        const dipTo = 0.945 + Math.random() * 0.04;
        safeVoices.forEach((osc) => {
          const base = osc.frequency.value;
          osc.frequency.cancelScheduledValues(t);
          osc.frequency.setValueAtTime(base, t);
          osc.frequency.linearRampToValueAtTime(base * dipTo, t + 0.09);
          osc.frequency.linearRampToValueAtTime(base, t + 0.22);
        });
      }
      scheduleSafeMusicGlitch();
    }, delay);
  }
"""

report = []
for path in FILES:
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    orig = src

    n1 = len(OLD_CHORD_PAD_COMMENT_RE.findall(src))
    src = OLD_CHORD_PAD_COMMENT_RE.sub(NEW_CHORD_PAD_COMMENT, src)

    n2 = src.count('safeFilter.frequency.value = 1600;')
    src = src.replace('safeFilter.frequency.value = 1600;', 'safeFilter.frequency.value = 1200;')

    n3 = src.count('safeFilter.Q.value = 0.3;')
    src = src.replace('safeFilter.Q.value = 0.3;', 'safeFilter.Q.value = 0.5;')

    n4 = src.count("[261.6, 329.6, 392.0, 523.2].map((f) => f * 0.8).forEach((freq, i) => {")
    src = src.replace(
        "[261.6, 329.6, 392.0, 523.2].map((f) => f * 0.8).forEach((freq, i) => {",
        "[220.0, 261.63, 329.63, 415.30].map((f) => f * 0.8).forEach((freq, i) => {"
    )

    n5 = len(OLD_VOICE_BODY_RE.findall(src))
    src = OLD_VOICE_BODY_RE.sub(NEW_VOICE_BODY, src)

    n6 = len(GLITCH_FN_RE.findall(src))
    src = GLITCH_FN_RE.sub(NEW_GLITCH_FN, src)

    changed = src != orig
    report.append((path, n1, n2, n3, n4, n5, n6, changed))
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)

for r in report:
    print(r)
