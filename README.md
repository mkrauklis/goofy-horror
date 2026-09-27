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

Both levels flash your screen red, pulsing faster the closer a creature
gets, regardless of whether it's noticed you yet — your only warning to
freeze or clear out before it does. Getting caught splatters blood at the
spot and only respawns the one player who was caught; other players, the
creature(s), and any puzzle progress are untouched.

Both levels also scatter **item crates** you open just by walking into
them. Each one holds one of three items, decided at random when the level
loads:

- **Radar** — shows a 10-second compass arrow pointing at the nearest
  creature, in the corner of each player's own screen.
- **Meat** — drops right where the crate was and instantly pulls every
  creature toward it; once a creature arrives it spends 3 seconds eating,
  completely ignoring players.
- **CO2** — freezes every creature solid for 10 seconds — no movement, no
  perception, safe to walk right past it.

## Level 1 — The Facility

A huge, sprawling facility (28 rooms in a 7x4 grid linked by a ring of
corridors) that's pitch black beyond your flashlight's glow — the only
exception is the spawn room, which stays lit. A fleshy, wall-crawling
creature with one very realistic eye slowly patrols the corridors. It
can't tell you're there until your own flashlight fully lands on it — the
instant it does, it locks onto you at 2.5x your speed for a few seconds
before giving up and going back to patrolling.

- **3 buttons** are scattered through the facility. Both players need to
  find and stand on all of them to unlock the big door blocking the exit.
- **The spawn room** is a permanently lit safe zone the creature can't
  enter — marked with a green outline, with a couple of tables inside, and
  a calm little tune plays while a player is resting in it.
- **Ventilation ducts** are scattered single-tile alcoves off the
  corridors — another safe spot the creature can't follow you into.
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

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
