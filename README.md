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

Both levels flash your screen red, pulsing faster the closer the creature
gets, regardless of whether it's noticed you yet — your only warning to
freeze or clear out before it does. Getting caught splatters blood at the
spot and only respawns the one player who was caught; the other player,
the creature, and any puzzle progress are untouched.

## Level 1 — The Facility

A large, sprawling facility (six big rooms linked by a ring of corridors)
that's pitch black beyond your flashlight's glow — the only exception is
the spawn room, which stays lit. A fleshy, wall-crawling creature with one
very realistic eye slowly patrols the corridors. It can't tell you're
there until your own flashlight fully lands on it — the instant it does,
it locks onto you at 2x your speed for a few seconds before giving up and
going back to patrolling.

- **3 buttons** are scattered through the facility. Both players need to
  find and stand on all of them to unlock the big door blocking the exit.
- **The spawn room** is a permanently lit safe zone the creature can't
  enter.
- Getting caught only respawns that one player back at the spawn room
  (with a brief moment of safety) — button and door progress is never
  lost.
- Reaching the exit past the unlocked door clears the level.

## Level 2 — Blackout

A different building entirely and a much bigger one — a cross-shaped
spine (one long corridor crossing another) with rooms branching off both
arms, rather than Level 1's ring-of-rooms. There's no button panel this
time: find the fuse, then find which one of several rooms actually has a
fuse box in it — its location (and a visible wire running from it to the
door once you spot it) is chosen at random each playthrough, so there's
nothing to see in the other rooms.

A second, slower creature patrols on its own schedule. It's not listening
for light — it's listening for movement. Stand still and it has no idea
you're there, even standing right next to it; move while it's within
range and it locks on and charges at 4x your speed for a few seconds.
Standing still is always safe, even mid-chase.

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
