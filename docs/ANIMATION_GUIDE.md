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

## Craft

- Something happens in every shot. A character acts, something transforms, breaks, chases or falls.
- One idea per shot, readable in a second. Cuts every 1.5–3 s in busy sections, longer in calm ones.
- Through-lines beat novelty: a recurring set or prop that escalates each chorus.
- Light text. Big sound-effect words rarely; never captions that repeat the lyric.

## Checking

- `npm run render -- sheet --song <slug> --from A --to B` and look at the image.
- `npm run render -- determinism --song <slug>` after any change.
- `npm run render -- video --song <slug> --from A --to B --samples 2` for a quick clip with audio.
