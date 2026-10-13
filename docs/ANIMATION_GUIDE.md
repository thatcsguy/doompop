# Animation guide

Read this before writing or changing a shot.

## What a shot is

A shot is a time window of the song plus a `build()` that returns a three.js world:

```ts
import * as THREE from 'three';
import { defineShot } from '../../../engine/types';

export const myShot = (start: number, end: number) => defineShot({
  id: 'my-shot', start, end,
  transition: { type: 'fade', dur: 0.5 },     // optional: 'cut' (default), 'fade', 'flash'
  build(stage) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    // create meshes, materials and geometry ONCE here
    return {
      scene, camera,
      update(f) { /* set every animated property from f */ },
      overlay(g, f) { /* optional 2D canvas drawing on top (titles, HUD) */ },
      post: f => ({ bloom: 0.8 }),              // optional per-frame post settings
      lyrics: true,                             // false hides the lyric layer for this shot
    };
  },
});
```

`update(f)` gets a `Frame`: `t` (song time), `lt` (time into the shot), `dur`, `p` (0..1 through the
shot), `w`/`h` (pixels) and `clock`.

## The clock (sync to the music)

| Call | Gives |
|---|---|
| `f.clock.beat(t)`, `bar(t)` | fractional beat / bar number from the measured grid |
| `f.clock.beatTime(n)`, `barTime(n)` | time of beat / bar n |
| `f.clock.kick(t, tau)`, `snare`, `hat` | 1 on a hit, decaying with time constant tau |
| `f.clock.impact(t, tau)` | strength of the last big arrival (drop, chorus hit), decaying |
| `f.clock.env('rms' \| 'low' \| 'mid' \| 'high' \| 'vocal', t)` | loudness envelopes, 0..1 |
| `f.clock.section(t)` | the current section `{id, label, start, end}` |
| `f.clock.lineAt(t)`, `wordAt(t)`, `words` | lyric lines and words with sung times |

## Hard rules

1. **Pure function of t.** Frames render in parallel and out of order. No `Math.random()` (use
   `hash(i, seed)` / `noise1` / `fbm1` from `engine/rng.ts`), no clocks, no `+=` across frames,
   nothing that depends on the previous frame. Objects keep a stable identity: derive their index
   from position or time, as `tunnel.ts` does for its rings.
2. **Set everything you animate, every frame.** The world persists between frames, so a property you
   set in one shot window and forget to reset will leak. A colour string passed to `shapeMesh` or
   `inkedRect` gets a cached material that every mesh of that colour shares, in every shot: never
   change its colour or opacity. Anything you animate gets its own `ownMat(...)`.
3. **Lyrics at sung time.** Words appear at their measured start (a frame or two early reads as on
   time). Don't snap words to beats. Each line's kinetic layout (position, size, animation) is set per
   line in the song's lyric layout; put it in the shot's empty space, away from faces and key action.
4. **Musical motion from the grid.** Camera punches on kicks (small: scale 0.01–0.03), bigger moves
   on impacts, cuts on bar lines unless a lyric says otherwise.
5. **Photosensitivity.** No more than three full-frame flashes in any second.
6. **Cost.** Aim for under ~1 s per frame at 1 sample in software rendering. Prefer instancing and
   simple materials; avoid huge shadow maps and per-frame geometry rebuilds.
7. **No flicker (z-fighting).** Flat cut-outs are thin planes stacked a few thousandths of a unit
   apart. Where two surfaces overlap on screen at the same depth, the depth test can't pick one, so
   the one that shows changes from frame to frame (and between motion-blur sub-frames) and their
   edges flicker. The stage renders with a logarithmic depth buffer (`engine/stage.ts`), so any real
   gap, 0.002 and up, holds at every distance the camera uses. What still flickers is surfaces at
   *equal* depth, so give everything that overlaps on screen its own depth:
   - Parts of one figure or prop sit at least 0.004 apart, in the order they stack (head, then hair,
     then collar; a stick, then its knob; a glove, then its cuff). An `inkedRect`/`inkedCircle` puts
     its fill 0.002 in front of its own outline, so a part laid over an inked part starts at least
     0.004 in front of it, never level with it or at +0.002 (that is the fill's depth).
   - Separate things that can overlap sit about 0.03 apart: balloons, people in a crowd, papers on
     a floor, keys on a ring, a mug in front of a hand.
   - Two copies of one silhouette (a two-tone rim light, a shadow, a glow) never share a depth. Cut
     each copy to its own side with `halfShape` (`engine/flat.ts`) or give each its own z.
   - A see-through layer laid on a surface (canvas text on a sign or screen, a shadow on a floor)
     sits at least 0.002 in front of it, never level with it.
   - Scaling a group scales its z gaps too: `root.scale.set(s, s, 1)`, never `setScalar(s)`.

   Flicker hides in stills, so check with the tool, not by eye: `npm run render -- zfight --song
   <slug>` draws each sampled frame twice, in opposite draw orders and with a depth buffer 8 times
   coarser than the real one, and lists every pair of surfaces whose winner changed (see-through
   layers get the same test against the surface under them), with marked frames in
   `out/<slug>/zfight/`. It samples each shot's start, middle and end and every second;
   narrow it with `--from A --to B` or `--t 12.5,40`. It must print NO FLICKER before a review render.
8. **Every word on screen can be read.** Most of the director's notes on song 2 were about text in the
   scene (signs, tags, flags, screens, paper) that couldn't be read, so:
   - Text fits its box with a margin at the size it's drawn. Measure every canvas string and shrink
     the font (`fitFont` in `engine/flat.ts`) or widen the box; never let a line run off its tag or
     screen. Side-by-side columns each clip to their own column. Labels that can end up on top of
     each other (two sheets sliding together) go in different corners.
   - Glow never washes out letters. A glowing sign keeps its letters clearly darker or brighter than
     the panel behind them after bloom; check the word in a still, not just the shape.
   - Nothing covers the word or number a shot is about while it's being read: a pointing finger
     stops short of it, and a magnifier shows what the paper under it shows.
   - A character's identifying feature (a face, a smile, a nametag) stays visible through the whole
     shot: bursts and glows go behind it, and feet and props pass behind it.

## Craft

- Something happens in every shot. A character acts, something transforms, breaks, chases or falls.
- One idea per shot, readable in a second. Cuts every 1.5–3 s in busy sections, longer in calm ones.
- Through-lines beat novelty: a recurring set or prop that escalates each chorus.
- Light text. Big sound-effect words rarely; never captions that repeat the lyric.
- One quality bar for the whole video: the main character big in close shots (about a third of the
  frame height), a different framing every shot or two, set dressing and a small moving detail in
  every frame, an action on each line.
- Lights match their sources: a beam leaves a lamp in the direction the shade points.
- Lyric hand-offs never overlap: a line still leaving must not collide with the next one arriving,
  so alternate placements or let the old line leave sooner.

## Checking

- `npm run render -- sheet --song <slug> --from A --to B` and look at the image.
- `npm run render -- determinism --song <slug>` after any change.
- `npm run render -- zfight --song <slug>` after any change to a figure, prop or set: it must print
  NO FLICKER (hard rule 7).
- `npm run render -- video --song <slug> --from A --to B --samples 2 --fresh` for a quick clip with
  audio. Frames are cached by frame number, so without `--fresh` a clip after shot changes can keep
  stale frames from the old version (they show as one- or two-frame flashes).
