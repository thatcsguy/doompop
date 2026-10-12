# Handoff: "The Smoking Gun" video

For the thread that builds the video. Patrick approved the concept on 2026-10-12 ("this all sounds great"). Nothing is built yet. Everything is on branch `song/the-smoking-gun-lko2iu` of github.com/thatcsguy/doompop, which branches off `scaffold` (PR #1, not merged; Patrick confirmed it doesn't need to merge first).

## Read first

1. `CLAUDE.md`, `README.md` and `docs/ANIMATION_GUIDE.md` in the repo: the pipeline and the hard rules (pure function of t, timing from data, one audio master).
2. `songs/the-smoking-gun/docs/DIRECTION.md`: Patrick's notes, verbatim, and the rules derived from them. They win over everything else.
3. `songs/the-smoking-gun/docs/TREATMENT.md` and `STORYBOARD.md`: the approved concept (a disco whodunit at Club PROD, DJ Detective Clawd with an afro) and one row per lyric line, with sung times.
4. For how song 1 was built: `songs/just-here-to-help/` (shots/verse1.ts, world.ts, lyrics-layout.ts) and /mnt/project-files/just-here-to-help/HANDOFF.md.

## Current state

- **Audio.** `audio/song.wav` (194.4 s) decoded from `audio/original.mp3`.
- **Beats.** `data/audio.json`: 129.2 BPM, 412 beats, 103 bars, kicks, snares, 13 impacts. The first downbeat is at 0.197 s and bar 8 contains line 1 (14.88 s). Patrick has not yet said whether the bar numbering lands right by ear; check with him before relying on bar numbers. Treat snares as unreliable (they were in song 1).
- **Words.** `data/lyrics.json`: 66 lines and 316 words, from CTC alignment only (the Whisper cross-check download is blocked by the proxy, so run lyrics with `--no-whisper`). `data/lyrics-review.md` lists 49 unsure words, mostly in the choruses (lines 18, 25, 57, 58). Check any word you hang a big visual hit on. Fixes go in `analysis.json`.
- **Pauses.** Each chorus has a `[Pause]` before "The smoking gun": about 60.9 to 62.0 s, 122.9 to 123.8 s and 175.0 to 175.6 s. Lines 48 and 65 hold for several seconds.
- **Index.** `index.ts` is still the slate placeholder.
- **Check clips.** /mnt/project-files/the-smoking-gun/checks/timing-check-{mix,drums}.mp4 (made with a throwaway ASS-subtitle script, not in the repo).

## What to build

- **Clawd with an afro.** Clawd lives in `engine/characters/clawd.ts`, which is shared and owned by the song 1 build thread. Add the afro, shades, gold chain and trench coat as song-local accessories layered on the rig (in `songs/the-smoking-gun/`), not as edits to clawd.ts. If an engine change is unavoidable, keep it small and say so.
- **Sets.** The DJ booth of terminals (BOOTH) and the light-up dance floor with a disco ball (FLOOR). FLOOR is the default shot for any line without an obvious picture. Also the evidence board, the forensics lab, and the bar for the bridge.
- **Cast.** The Chief, and the suspects (Function, Handler, Cache, the tiny Field).
- **Lyrics.** Kinetic typography (engine/kinetic.ts) with a layout per line: terminal type-on for debugging lines, neon pulse for disco lines, speech bubbles for "Good catch" and "You're absolutely right".
- **Look.** Much darker than song 1: near-black navy and purple, lit by terminals, neon and the disco ball. Clawd always has a rim of light. Flashes stay at three per second or fewer.

## Suggested order

1. Lookdev still: Clawd with the afro, plus a FLOOR wide shot. Show Patrick the stills before going further.
2. Proof passage: the intro and verse 1 (0:00 to 0:47.8, storyboard rows 0a to 16). Show Patrick a short clip.
3. The rest, section by section, per the storyboard.

## Conventions

- Review default: stills for small edits, short clips for motion, full renders only at milestones.
- Commit messages end with the Co-Authored-By and Claude-Session trailers. Ask Patrick before merging to main.
- Rendering and checking commands are the same as song 1 with `--song the-smoking-gun` (see README.md).
