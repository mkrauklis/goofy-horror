  // The boss: the Candy Kraken -- a tentacled monster made entirely of candy,
  // 2x2 tiles across.
  const BOSS_RADIUS = 32;
  const BOSS_CATCH_RADIUS = BOSS_RADIUS * 1.1;
  const BOSS_NAME = 'THE CANDY KRAKEN';

  const BOSS_INTRO_CUTSCENE_MS = 3000;
  const BOSS_INTRO_ZOOM_MULT = 1.7;
  const BOSS_INTRO_SHAKE_MAG = 7;
  const BOSS_INTRO_GRACE_MS = 3000;
  const BOSS_IDLE_SPEED = HM.speed(PLAYER_SPEED * 0.35);
  const BOSS_IDLE_MIN_MS = 900;
  const BOSS_IDLE_MAX_MS = 1500;

  const BOSS_MAX_HEALTH = HM.bossHp(50);
  const PHASE2_HEALTH_THRESHOLD = HM.bossHp(30);
  const PHASE2_CUTSCENE_MS = 3000;
  const PHASE2_NAME_COLOR = '#c9b4d6';
  const PHASE2_SUBTITLE = 'WITHERED';

  // Every 5th attack ends with the boss stunned for 7.5 seconds. That's the
  // only time you can hurt it: run up and take a bite out of it (10 damage).
  const ATTACKS_PER_STUN = 5;
  const STUN_DURATION_MS = 7500;
  const BITE_DAMAGE = 10;
  const BITE_RADIUS = BOSS_RADIUS + PLAYER_RADIUS + 8;
  const BITE_COOLDOWN_MS = 1100; // per player, between bites

  // The round arena: the floor is a circle inside a ring of brick wall.
  const ARENA_CX = WORLD_W / 2, ARENA_CY = WORLD_H / 2;
  const ARENA_R = LEVEL.floorRadius * TILE;

  // Attack 1 -- the candy spiral: it spins and spits candy out at 5x speed for
  // 10 seconds, each piece twice the normal size.
  const SPIRAL_MS = 10000;
  const SPIRAL_INTERVAL_MS = 140;
  const SPIRAL_SPIN_RATE = 2.4; // radians per second
  const CANDY_SPEED = HM.proj(PLAYER_SPEED * 5);
  const CANDY_NORMAL_RADIUS = 7;
  const CANDY_RADIUS = CANDY_NORMAL_RADIUS * 2;
  const CANDY_HIT_RADIUS = CANDY_RADIUS + PLAYER_RADIUS * 0.5;

  // Attack 2 -- it screams, then runs you down at 1.3x speed for 10 seconds.
  const SCREAM_MS = 900;
  const CHASE_MS = 10000;
  const CHASE_SPEED = PLAYER_SPEED * 1.3;

  // Attack 3 -- ten candy corn patches (2x2 tiles, round): a red circle flashes
  // for a second, then the candy corn shoots up.
  const CORN_COUNT = 10;
  const CORN_WARN_MS = 1000;
  const CORN_ACTIVE_MS = 700;
  const CORN_RADIUS = TILE;

  // Attack 4 (withered phase only) -- three 5x5 clouds of cotton candy. Stay in
  // one for 2.5 seconds and you're done; get out sooner and you're only
  // slowed by 30% for 5 seconds.
  const GAS_COUNT = 3;
  const GAS_WARN_MS = 1000;
  const GAS_LIFE_MS = 8000;
  const GAS_RADIUS = TILE * 2.5;
  const GAS_KILL_MS = 2500;
  const GAS_SLOW_MS = 5000;
  const GAS_SLOW_MULT = 0.7;

  // The candy the boss leaves behind as it moves, fading away slowly.
  const TRAIL_LIFE_MS = 7000;
  const TRAIL_STEP = 24;

  const DEATH_FALL_MS = 1200;
  const DEATH_DRAG_MS = 1800;

