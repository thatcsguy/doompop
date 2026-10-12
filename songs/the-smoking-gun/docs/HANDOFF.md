# Handoff: "The Smoking Gun" video

For the thread that builds the video. Patrick approved the concept on 2026-10-12 ("this all sounds great"). The concept and analysis are on branch `song/the-smoking-gun-lko2iu` of github.com/thatcsguy/doompop, which branches off `scaffold` (PR #1, not merged; Patrick confirmed it doesn't need to merge first).

## Read first

1. `CLAUDE.md`, `README.md` and `docs/ANIMATION_GUIDE.md` in the repo: the pipeline and the hard rules (pure function of t, timing from data, one audio master).
2. `songs/the-smoking-gun/docs/DIRECTION.md`: Patrick's notes, verbatim, and the rules derived from them. They win over everything else.
3. `songs/the-smoking-gun/docs/TREATMENT.md` and `STORYBOARD.md`: the approved concept (a disco whodunit at Club PROD, DJ Detective Clawd with an afro) and one row per lyric line, with sung times.
4. For how song 1 was built: `songs/just-here-to-help/` (shots/verse1.ts, world.ts, lyrics-layout.ts) and /mnt/project-files/just-here-to-help/HANDOFF.md.

## Current state

- **Build progress (2026-10-12).** Work continues on branch `claude/project-thread-n9ixho`. Built: lookdev (stills in `lookdev/`), the intro and verse 1 (0:00 to 0:48.1, storyboard rows 0a to 16), chorus 1 and the break (0:48.1 to 1:18.4, rows 17 to 24b). Review clips in `review/`. The rest of the song is still the slate. Next: verse 2 (line 25 "I pull up all the metrics" starts at 78.18 s), after Patrick's notes on the clips.
- **Where things live.** `shots/intro.ts`, `shots/verse1.ts`, `shots/chorus1.ts`, `shots/common.ts` (the shot helper: every shot borrows the one club set and draws the lyric layer; `freeze: t` holds the picture from t while the camera keeps moving), `club.ts` (the set, driven by a `ClubState` each frame), `street.ts`, `suspects.ts`, `props.ts`, `evidence.ts` (chorus props: floor logs, timeline, neon arrow, revolver, smoke, spotlight veil, stamp), `clawd-disco.ts`, and the lyric layer in `lyrics-disco.ts` with per-line layouts in `lyrics-layout.ts` (the song draws its own lyrics, `lyricStyle: { mode: 'none' }`).
- **The chorus device (reuse it for choruses 2 and 3).** The evidence lines up everywhere at once (floor, wall timeline, arrow, screens, board), the dancers stay frozen with spinners, then the pause: picture freezes when line 23 ends, the club blacks out on the stab (time from the rms envelope with `onset()`, since the beat tracker snaps it to the downbeat), a spotlight swings to the culprit on the downbeat and lands on the tick, and the band slams back in on "gun" (the impact) with the lights. In chorus 1 the culprit is the Cache with a smoking revolver; it gets cuffed and walked out, a victory dance follows, then the pager says PROD DOWN and the red comes back.
- **Pitfall.** `audio.beats[i]` with a fractional i is `undefined` and turns whatever uses it into NaN (a character just vanishes). Use the `BT()` helper in `shots/chorus1.ts` for half beats.
- **Audio.** `audio/song.wav` (194.4 s) decoded from `audio/original.mp3`.
- **Beats.** `data/audio.json`: 129.2 BPM, 412 beats, 103 bars, kicks, snares, 13 impacts. The first downbeat is at 0.197 s and bar 8 contains line 1 (14.88 s). Patrick has not yet said whether the bar numbering lands right by ear; check with him before relying on bar numbers. Treat snares as unreliable (they were in song 1).
- **Words.** `data/lyrics.json`: 66 lines and 316 words, from CTC alignment only (the Whisper cross-check download is blocked by the proxy, so run lyrics with `--no-whisper`). `data/lyrics-review.md` lists 49 unsure words, mostly in the choruses (lines 18, 25, 57, 58). Check any word you hang a big visual hit on. Fixes go in `analysis.json`.
- **Pauses.** Each chorus has a `[Pause]` before "The smoking gun": about 60.9 to 62.0 s, 122.9 to 123.8 s and 175.0 to 175.6 s. Lines 48 and 65 hold for several seconds.
- **Index.** `index.ts` lists the built shots, then the slate for the rest of the song.
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
