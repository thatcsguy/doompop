# doompop

A studio for code-rendered music videos ("AI Doompop"): Suno makes the song, Claude writes the
video as three.js code, and every frame is a pure function of song time.

## How a video gets made

1. **Add the song.** `npm run new-song -- <slug> path/to/song.mp3 --lyrics lyrics.txt --title "Title"`
   decodes it once to `songs/<slug>/audio/song.wav`, the single master used by analysis, preview and render.
2. **Measure it.** `npm run analyze -- <slug>`: stems, beat map, sections, drum hits, word timing.
   Check `songs/<slug>/data/lyrics-review.md` by ear. Details: [analysis/README.md](analysis/README.md).
3. **Treatment and storyboard.** `songs/<slug>/docs/TREATMENT.md` and `STORYBOARD.md`: concept, look,
   and a shot list anchored to bars and lyric lines.
4. **Build shots.** One file per shot in `songs/<slug>/shots/`, listed in `songs/<slug>/index.ts`.
   Read [docs/ANIMATION_GUIDE.md](docs/ANIMATION_GUIDE.md) first.
5. **Preview.** `npm run dev`, open http://127.0.0.1:5180/?song=<slug>
6. **Render.** `npm run render -- video --song <slug>` → `out/<slug>.mp4`.

## Requirements

Node 20+, ffmpeg (with libx264), Chrome or Chromium (set `CHROME_PATH` if it isn't found),
and [uv](https://docs.astral.sh/uv/) for the analysis tools. `npm install` once. Song audio is committed
as plain files (no Git LFS needed).

## Preview keys

| Key | Action |
|---|---|
| space | play / pause (audio-locked) |
| ← / → | seek ±1 s (shift ±5 s) |
| `,` / `.` | step one frame |
| `[` / `]` | previous / next shot |
| `l` | loop the current shot |
| `q` | fine preview (8 sub-frames when paused) |
| `h` | hide the UI |

URL options: `?song=<slug>`, `&t=42.5` start time, `&res=1` full-resolution preview (default 0.5).

## Render modes

```sh
npm run render -- video  --song <slug> [--from 30 --to 45] [--samples 8] [--workers 2] [--scale 2]
npm run render -- sheet  --song <slug> [--from 0 --to 60] [--n 16] [--cuts]   # contact sheet
npm run render -- stills --song <slug> --t 12.5,40
npm run render -- determinism --song <slug>   # frames must match whatever order they render in
npm run render -- gpu --song <slug>           # which GPU Chrome is using
```

Video renders are resumable: frames land in `out/<slug>/frames-<scale>x/`, so rerun after a crash.
`--samples N` averages N sub-frames per frame for motion blur. Without a GPU, Chrome falls back to
SwiftShader (software); that works, just slower. Check with the `gpu` mode.

The cache is keyed by frame number, not by shot content, so pass `--fresh` after changing shots (or
the old frames are reused). A full song is slow on CPU: song 1 at 1080p60 with 2 samples took about
1.2 s a frame on 3 workers, roughly 4.5 hours. Where jobs have a time limit, render in parts with
`--from`/`--to` (use `--fresh` only on the first part), then run once without them to encode.

## Layout

```
engine/          shared renderer: Engine (time → picture), Stage (three.js + post), SongClock (beats,
                 hits, envelopes, lyrics), karaoke layer, preview, deterministic rng, easing
engine/shots/    reusable shots (slate)
songs/<slug>/    one song: audio/, data/, docs/, shots/, index.ts, lyrics.txt, analysis.json
analysis/        Python tools that write songs/<slug>/data/
tools/           new-song, analyze, render
docs/            ANIMATION_GUIDE.md: the rules every shot follows
```

`songs/demo` is a 16-second synthetic test track that exercises the whole pipeline.
