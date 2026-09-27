# Goofy Horror

A browser-based game. Real JavaScript, no build step.

## Running it

No install, no build. Open [`index.html`](index.html) in a browser, or serve
the folder with any static server, e.g.:

```
npx serve .
```

## Controls

Split-screen local 2-player, sharing one dark facility. Player 1 (orange)
moves with `W` `A` `S` `D`; Player 2 (green) moves with the arrow keys.
Each half of the screen is that player's own camera into the same map.

All three levels flash your screen red, pulsing faster the closer a
creature gets, regardless of whether it's noticed you yet — your only
warning to freeze or clear out before it does. Getting caught plays a
2-second "gotcha" close-up of the creature closing in on you, then
splatters blood at the spot and respawns just that one player; other
players, the creature(s), and any puzzle progress are untouched.

Each split-screen half also has its own **explored-areas map** in the top
corner — it only fills in the parts of the huge facility you've actually
walked near, building up a personal record of the layout instead of
spoiling the whole thing up front.

Every level also scatters **item crates** you open just by walking into
them, and a used crate quietly restocks with a new random item after a
minute. Each one holds one of three items, decided at random when it
(re)loads:

- **Radar** — shows a 10-second compass arrow pointing at the nearest
  creature, in the corner of each player's own screen.
- **Scanner** — a second, separate 10-second compass (bottom-right corner)
  pointing at whatever's left of the level's real objective — the nearest
  un-pressed button, the fuse (or the real fuse box once it's picked up), or
  the generator — and it never points at something you've already done.
- **Meat** — drops right where the crate was and instantly pulls every
  creature toward it; once a creature arrives it spends 3 seconds eating,
  completely ignoring players.
- **CO2** — freezes every creature solid for 10 seconds — no movement, no
  perception, safe to walk right past it.

## Level 1 — The Facility

A huge, sprawling facility (28 rooms in a 7x4 grid linked by a ring of
corridors) that's pitch black beyond your flashlight's glow — the only
exception is the spawn room, which stays lit. Two identical fleshy,
wall-crawling creatures with one very realistic eye each patrol the
corridors independently. Neither can tell you're there until your own
flashlight fully lands on it — the instant it does, it locks onto you at
2.5x your speed for a few seconds before giving up and going back to
patrolling.

- **3 buttons** are scattered through the facility. Both players need to
  find and stand on all of them to unlock the big door blocking the exit.
- **The spawn room** is a permanently lit safe zone the creature can't
  enter — marked with a green outline, with a couple of tables inside, and
  a calm little tune plays while a player is resting in it.
- **Ventilation ducts** form a real connected network threaded through the
  facility's walls, entered from several scattered alcoves — crawl in one
  side and come out somewhere else entirely, always safe since the creature
  can't follow you in.
- Getting caught only respawns that one player back at the spawn room
  (with a brief moment of safety) — button and door progress is never
  lost.
- Reaching the exit past the unlocked door clears the level.

## Level 2 — Blackout

A different building entirely and a much bigger one — a lattice of
parallel corridors linked by cross-connectors, with 36 small rooms
branching off, rather than Level 1's ring-of-big-rooms. There's no button
panel this time: find the fuse, then find which one of several rooms
actually has a fuse box in it — its location (and a visible wire running
from it to the door once you spot it) is chosen at random each
playthrough, so there's nothing to see in the other rooms.

Two slower creatures patrol independently, each on its own schedule.
They're not listening for light — they're listening for movement. Stand
still and neither has any idea you're there, even standing right next to
one; move while one is within range and it locks on and charges at 8x
your speed for a few seconds. Standing still is always safe, even
mid-charge. Getting caught while carrying the fuse drops it right where
you died, not back at its original spot.

## Level 3 — Sinkhole

An older facility that's started sinking into whatever's underneath it —
patches of floor tile have crumbled away to bare dirt throughout. There's
no button panel or fuse this time: find the generator room and get both
players standing on its two pressure plates *at the same time*, wired
straight to the generator, and hold for 5 seconds. Step off early and the
charge starts draining back down.

The creature itself is a slow caterpillar, one segmented body dragging
itself along at only 0.9x your speed — outrunning it is trivial, and its
own eyesight is short-range enough that it rarely notices you first. The
real danger is the **meat vines** strung across the ground — and they're
everywhere, dense enough that there's essentially always one somewhere on
screen. Step on one and the caterpillar rockets toward that exact spot at
20x its normal speed. If you're still there when it arrives, you're
caught; if you've already moved on, it settles back into patrolling from
wherever the vine was.

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
