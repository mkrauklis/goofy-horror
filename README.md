# Goofy Horror

A browser-based game. Real JavaScript, no build step.

## Running it

No install, no build. Open [`index.html`](index.html) in a browser, or serve
the folder with any static server, e.g.:

```
npx serve .
```

[`index.html`](index.html) is the main menu, linking out to each level and
to the [Monsterpedia](monsterpedia.html) — a field guide rendering every
creature live on canvas, the same drawing code the levels themselves use,
with a short write-up of how each one hunts.

## Controls

Split-screen local 2-player, sharing one dark facility. Player 1 (orange)
moves with `W` `A` `S` `D`; Player 2 (green) moves with the arrow keys.
Each half of the screen is that player's own camera into the same map. A
**Music** button in the HUD mutes/unmutes the ambient drone and safe-room
tune (sound effects like chimes and the catch sting keep playing either
way).

All five levels flash your screen red, pulsing faster the closer a
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
minute (Level 4 changes both of these numbers — see its section below).
Each one holds one of a handful of items, decided at random when it
(re)loads:

- **Radar** — shows a 10-second compass arrow pointing at the nearest
  creature, in the corner of each player's own screen.
- **Scanner** — a second, separate 10-second compass (bottom-right corner)
  pointing at whatever's left of the level's real objective — the nearest
  un-pressed button, the fuse (or the real fuse box once it's picked up),
  the generator, or the lever (and then the train once it's pulled) — and
  it never points at something you've already done.
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

## Level 4 — Overgrown

The same facility as Level 3, years later and noticeably bigger, with more
dead-end side corridors to get turned around in — vegetation has swallowed
the corridors (on top of the same patches of missing floor), and a good
number of fires burn permanently once you find them, casting their own
pool of light through the darkness. There's no generator this time: find
the electrical room (wrapped in a mess of exposed wiring so it's
unmistakable) and pull its lever — no co-op needed, either player can do
it alone — to power up the subway train waiting at the platform, then get
both players aboard it to finish.

Three mimics disguise themselves as people and wander the halls at close
to your own pace, imitating normal movement — genuinely hard to tell apart
from your partner at a glance. Get within range of one, though, and the
act drops instantly: it shrinks into a small tentacle creature with a
mouth full of teeth instead of an eye, and charges at 2x your speed until
it either catches someone or loses the trail, at which point it slinks
back into disguise and resumes wandering.

Item crates are everywhere in this level — about ten times as many as the
other levels scatter, though each one only stays empty for half as long
before restocking. A small fraction of them are secretly **mimic
crates**: no item at all, just the faintest, barely-noticeable jitter
while closed. Open one and a small purple tentacle creature bursts out
and chases down whoever's closest until it catches them or gives up a few
seconds later, then vanishes for good. Two more item types show up only
in this level's crates:

- **Super-radar** — for 10 seconds, every mimic's exact position shows up
  as a dot on your explored-areas map, disguise or not.
- **Smoke bomb** — drops on the spot, takes 3 seconds to go off, then
  fills the area with a 10-second cloud that hides anyone standing in it
  from every creature — can't be seen, can't be caught, even mid-chase.

Double-tap a movement key to sprint at 2x speed. It's fueled by a small
bar (shown under your own explored-areas map) that lasts 15 seconds of
continuous sprinting and drains as you use it; empty it and you're stuck
walking at half speed for 5 seconds while it refills halfway. It also
refills while you're just walking normally, just at half the rate the
exhaustion penalty does.

## Level 5 — The Cinder Pit

A single crumbling room, patches of floor gone to bare dirt, fires
burning throughout — but **a third the size** of the room this level
originally shipped with. The old version had room for the boss to patrol
a loop and lose interest; this one doesn't, and it isn't built to. It's
one continuous fight from the moment you walk in.

Punched into the outer wall here and there are a handful of **vents** —
small dead-end pockets the boss physically cannot enter (its own
pathing treats them as solid) and that every one of its attacks
explicitly skips over. They're the room's only real hiding spots, and
with a boss this aggressive, finding one on the way in is worth doing
before you need it, not after.

Planted in the middle is the boss: a Crawler, the very same creature
from Level 1, burnt black, still on fire, and **8 times** its normal
size — filling enough of the now-small room on its own that there's
nowhere in it that's really far from danger. It cycles through six
attacks at random, back to back, for as long as it's alive:

1. **Spin** — bounces off the arena walls DVD-logo style at **5x** your
   speed for 5 seconds, changing direction off every wall it hits.
2. **Throw** — grabs three chunks of rubble and lobs them near the
   players; each lands inside a **red circle** that's been marked on the
   ground for a full 2.5 seconds beforehand.
3. **Spike** — tentacles burst up out of the ground at several spots,
   each marked with a dashed warning ring for 2.5 seconds first.
4. **Charge** — a brief wind-up, then a straight-line dash at **3x**
   speed toward whoever's closest, three times in a row.
5. **Bombs** — throws ten short-fused charges out across the room at
   once; they arm on landing and go off fast, so standing near one when
   its fuse runs out is the same as walking into the throw attack.
6. **Blink** — plants itself and pulses a slow 3-second warning, then
   strobes color for 2 seconds before whipping all nine tentacles out
   twice in a row. Each one is a straight line that stops dead at the
   first wall it hits — it genuinely cannot punch through one — so a
   vent isn't just "safe," it's the one place guaranteed to block this
   specific attack outright.

Its own touch still catches you at any point in that cycle, same as
every other level's monsters — this is on top of that, not instead of
it. Every 10th attack, though, it keels over **stunned** for 10 seconds
instead of attacking: a ring of dazed stars over its head and a distinct
sound cue mark the window, and it's the one moment its own contact won't
catch you either.

That stun window is the entire strategy. A bomb landed on the boss
while it's stunned takes a real **1/10** off its health; landed at any
other point in the cycle, the same hit only does **1/50** — walking up
mid-charge to land a "free" hit is technically possible but not
remotely worth it next to just waiting the ten seconds out. Up to
**three** of your own bombs sit on the map at once (not one), and
they're always pinged on the minimap, so the fight is about survival
and timing, not a blind scavenger hunt. Ten stunned hits and the fire
goes out for good.

Crates still drop the same items as elsewhere, but a **meat** crate is
now worth remembering the location of: eating it refills your sprint
stamina on top of its usual lure effect, and unlike every other crate
it never respawns into something else — walk back to it any time your
stamina bar is low (on a short cooldown, so standing on it doesn't
refill it every single frame) and eat it again.

Getting caught doesn't respawn just that one player anymore, either —
you're held down (the same catch cutscene, just not timing out into a
respawn) until your teammate is caught too, at which point it's a full
wipe: a retry screen, Enter to start the fight over from scratch, boss
health and attack count included. A procedural boss theme (bassline,
kick/hat pulse, and an answering lead phrase) plays throughout and
speeds up as its health drops, same as before.

This is still a first pass at the level structure — enemy count, puzzle
variety, and win/lose feedback are all open for iteration.
