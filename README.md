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

## Level 1 — The Facility

Beyond your flashlight's glow, the facility is pitch black — the only
exception is the spawn room, which stays lit. Somewhere in the dark, a
fleshy, wall-crawling creature with one very realistic eye is hunting
whichever player it can currently see. It's twice your speed and
re-routes toward you every half second, so once it's found you, outrunning
it isn't an option — breaking its line of sight (or reaching the safe
room) is.

- **3 buttons** are scattered through the facility. Both players need to
  find and stand on all of them to unlock the big door blocking the exit.
- **The spawn room** is a permanently lit safe zone the creature can't
  enter.
- Getting caught only respawns that one player back at the spawn room
  (with a brief moment of safety) — button and door progress is never
  lost.
- Reaching the exit past the unlocked door clears the level.

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
