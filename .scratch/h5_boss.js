  function makeBoss() {
    return {
      x: 0, y: 0, radius: BOSS_RADIUS, seed: Math.random() * 100,
      lookDir: { x: 0, y: 1 }, defeated: false, frozenUntil: 0, phase2: false,
      intangible: false,

      phase: 'idle', // 'idle' | 'spiral' | 'scream' | 'candycorn' | 'cottoncandy' | 'stunned'
      phaseStartedAt: 0,
      nextIdleUntil: 0,
      lastAttack: null,
      attacksSinceStun: 0,
      stunUntil: 0,
      chunks: [], // bites taken out of it: [{ ang, size }]

      // spiral
      spin: 0,
      spiralNextAt: 0,
      spiralOrbit: 0,
      // scream & chase
      chasing: false,
      trailDist: 0,
    };
  }
  const boss = makeBoss();

  let candies = []; // the spiral's shots: { x, y, vx, vy, rot, spin, kind, c1, c2 }
  let cornPatches = []; // { x, y, fireAt, endAt }
  let gasPatches = []; // { x, y, startAt, endAt }
  let trail = []; // the boss's candy trail: { x, y, kind, c1, c2, rot, born }
  let explosions = [];
  let particles = [];
  let bloodSplatters = [];
  let floatingTexts = [];

