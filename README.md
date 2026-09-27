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
freeze or clear out before it does.

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

A different building entirely — one long spine corridor with rooms
branching off it, rather than Level 1's ring layout. There's no button
panel this time, just a fuse lying somewhere and several identical
fuse-box sockets scattered around — only one of them is actually wired to
the door, chosen at random each playthrough, so both players have to find
the fuse and try sockets until one works.

A second, slower creature patrols on its own schedule. It's not listening
for light — it's listening for movement. Stand still while it's nearby
and it has no idea you're there; move, and if it's close enough with a
clear line to you, it locks on for a few seconds.

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
