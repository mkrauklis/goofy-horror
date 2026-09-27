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

The only light sources are each player's own flashlight (a directional
cone that follows your last move) and a handful of dim, flickering wall
lights. Somewhere in the dark, a fleshy tentacle creature is hunting
whichever player it can currently see — it's about 10% faster than you,
crawls along the walls as it moves, and re-routes toward you every half
second.

- **3 buttons** are scattered through the facility. Both players need to
  find and stand on all of them to unlock the door blocking the exit.
- **Vents** are small dead-end alcoves the creature can't enter — duck
  into one to break a chase.
- **The spawn room** is a permanently lit safe zone the creature can't
  enter either.
- Getting caught resets the level (buttons, door, and both players).
  Reaching the exit past the unlocked door clears it.

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
