# doompop: notes for Claude

Code-rendered music videos. Read README.md for the pipeline and docs/ANIMATION_GUIDE.md before writing a shot.

## Rules that keep the pipeline working

- **Every frame is a pure function of song time t.** No `Math.random()` (use `hash()` from engine/rng.ts),
  no `Date`/`performance.now()`, no state carried between frames (`x += ...` in update is a bug).
  `npm run render -- determinism --song <slug>` must print DETERMINISTIC after shot changes.
- **Timing comes from data, not guesses.** Beats, bars, hits and word times come from
  `songs/<slug>/data/*.json` via `f.clock`. Place lyrics at their sung times; never snap words to beats.
- **One audio master.** `songs/<slug>/audio/song.wav` feeds analysis, preview and render. Never re-export
  or re-encode it; if the song changes, add it again and re-run analysis.
- **Manual fixes live in `songs/<slug>/analysis.json`**, never hand-edit `data/*.json` (it's regenerated).
- When parallel agents build shots, each owns only its own shot file(s). Shared engine changes go
  through one agent.

## Checking your own work

- Contact sheets (`npm run render -- sheet --song <slug> --from A --to B`) are the fastest way to see
  a passage; read the image. `--cuts` shows every shot boundary.
- Before calling a passage done, render a short clip with audio (`video --from A --to B --samples 2`).
- Typecheck with `npm run typecheck`.

## Taste rules (from the genre's best videos)

- Something happens in every shot. Tell the story with pictures; keep extra text light, since the
  karaoke already shows the words.
- A through-line (one set, one device, one escalating prop) beats a string of unrelated visuals.
- Turn every note the director gives into a written rule here or in the song's docs, the same day.
