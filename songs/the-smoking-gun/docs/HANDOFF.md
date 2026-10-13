# Handoff: "The Smoking Gun" video

For the thread that builds the video. Patrick approved the concept on 2026-10-12 ("this all sounds great"). The concept and analysis are on branch `song/the-smoking-gun-lko2iu` of github.com/thatcsguy/doompop, which branches off `scaffold` (PR #1, not merged; Patrick confirmed it doesn't need to merge first).

## Read first

1. `CLAUDE.md`, `README.md` and `docs/ANIMATION_GUIDE.md` in the repo: the pipeline and the hard rules (pure function of t, timing from data, one audio master).
2. `songs/the-smoking-gun/docs/DIRECTION.md`: Patrick's notes, verbatim, and the rules derived from them. They win over everything else.
3. `songs/the-smoking-gun/docs/TREATMENT.md` and `STORYBOARD.md`: the approved concept (a disco whodunit at Club PROD, DJ Detective Clawd with an afro) and one row per lyric line, with sung times.
4. For how song 1 was built: `songs/just-here-to-help/` (shots/verse1.ts, world.ts, lyrics-layout.ts) and /mnt/project-files/just-here-to-help/HANDOFF.md.

## Current state

- **Build progress (2026-10-12).** Work is on branch `claude/project-thread-n9ixho`. The whole song is built, 0:00 to the end: lookdev (stills in `lookdev/`), intro and verse 1 (rows 0a to 16), chorus 1 and its break (17 to 24b), verse 2 (25 to 40), chorus 2 and its break (41 to 48a), the bridge (49 to 56) and the final chorus and outro (57 to 66). STORYBOARD.md has an "As built" note per section where the build differs from the rows. Patrick asked (06:58 UTC) for the full video by morning without stopping for review, so chorus 2 onward has had no notes from him yet; the full render is in `review/`.
- **Notes round 1 (2026-10-13).** Patrick's notes on the first full render are in DIRECTION.md, verbatim. All of them are fixed on the branch: a flicker pass (logarithmic depth buffer, and every part that sat level with another restacked; `render zfight` went from 394 tied pairs to none) and the text fixes (deploy flag glow, Handler badge, side-by-side request bodies, light-box printouts, coil tag, timeline flags, the Chief's finger, the plaster's smile). The v2 render is `review/the-smoking-gun-full-v2.mp4`.
- **Where things live.** `shots/intro.ts`, `shots/verse1.ts`, `shots/chorus1.ts`, `shots/verse2.ts`, `shots/chorus2.ts`, `shots/bridge.ts`, `shots/finale.ts`, `shots/common.ts` (the shot helper: every shot borrows the one club set and draws the lyric layer; `freeze: t` holds the picture from t while the camera keeps moving), `club.ts` (the set, driven by a `ClubState` each frame), `street.ts`, `suspects.ts`, `props.ts`, `evidence.ts` (chorus props: floor logs, timeline, neon arrow, revolver, smoke, spotlight veil, stamp), `lab.ts` (verse 2's lab: pull-up screen, projector, light box, byte ticker, gear tower, riser door, creeper, trace coil, dust puffs, and `drawBubble` for speech bubbles), `chief.ts` (the Chief), `handler-path.ts` (chorus 2's cable), `bar.ts` (the bridge's bar props: napkin, bomb dome, graph card, floor seam, happy-path flowers, RUN button), `finale-props.ts` (confetti cannons, the plaster, the building of dance floors), `clawd-disco.ts`, and the lyric layer in `lyrics-disco.ts` with per-line layouts in `lyrics-layout.ts` (the song draws its own lyrics, `lyricStyle: { mode: 'none' }`).
- **The chorus device (reuse it for choruses 2 and 3).** The evidence lines up everywhere at once (floor, wall timeline, arrow, screens, board), the dancers stay frozen with spinners, then the pause: picture freezes when line 23 ends, the club blacks out on the stab (time from the rms envelope with `onset()`, since the beat tracker snaps it to the downbeat), a spotlight swings to the culprit on the downbeat and lands on the tick, and the band slams back in on "gun" (the impact) with the lights. In chorus 1 the culprit is the Cache with a smoking revolver; it gets cuffed and walked out, a victory dance follows, then the pager says PROD DOWN and the red comes back.
- **Pitfall.** `audio.beats[i]` with a fractional i is `undefined` and turns whatever uses it into NaN (a character just vanishes). Use the `BT()` helper in `shots/chorus1.ts` for half beats.
- **Pitfall: set the camera first.** Anything that copies `camera.quaternion` to face the camera (projector motes, `GlowPath.face`, `DustPuff.set` with a camera, halos) must run after that frame's `aimCam` and `shake`. Otherwise it faces the previous frame's camera, the first frame of a shot depends on what rendered before it, and the determinism check fails. Overlays that call `screenAt` call `camera.updateMatrixWorld()` first.
- **Audio.** `audio/song.wav` (194.4 s) decoded from `audio/original.mp3`.
- **Beats.** `data/audio.json`: 129.2 BPM, 412 beats, 103 bars, kicks, snares, 13 impacts. The first downbeat is at 0.197 s and bar 8 contains line 1 (14.88 s). Patrick has not yet said whether the bar numbering lands right by ear; check with him before relying on bar numbers. Treat snares as unreliable (they were in song 1).
- **Words.** `data/lyrics.json`: 66 lines and 316 words, from CTC alignment only (the Whisper cross-check download is blocked by the proxy, so run lyrics with `--no-whisper`). `data/lyrics-review.md` lists 49 unsure words, mostly in the choruses (lines 18, 25, 57, 58). Check any word you hang a big visual hit on. Fixes go in `analysis.json`.
- **Pauses.** Each chorus has a `[Pause]` before "The smoking gun": about 60.9 to 62.0 s, 122.9 to 123.8 s and 175.0 to 175.6 s. Lines 48 and 65 hold for several seconds.
- **Index.** `index.ts` lists every section's shots in order (no slate left).
- **Credits.** `ClubState.credits` holds the time each credit line switches on; they draw as neon on a transparent layer in front of the terminal bezels (`club.ts`, `CREDITS`), so the text runs across the screens without being cut by the bezels. Keep that layer's colour near 1: above that, bloom spreads a haze over the whole wall.
- **Pitfall: real song timing beats the grid.** Line 65 was aligned 5 s early (fixed in `analysis.json`), the band drops out about 0.25 s after the held "it" of line 63, and the last hit of the song is at 191.85 s after a breath of silence, not on "gun". The finale finds the drop-out and the last hit from the rms envelope, the same way chorus 1's `onset()` does.
- **Rendering the full song.** Since the flicker pass a frame takes 2.3 to 2.7 s at 30 fps with `--samples 2 --workers 3` on this machine (about 1.8 s before it), so the song takes about 4 hours. Render it in four parts of about 1460 frames (`--from 0 --to 48.6`, then 48.6 to 97.2, 97.2 to 146 and 146 to the end) to stay under the 2-hour background job limit; each part also encodes a throwaway mp4 of itself, which you can delete. Then run once without `--from`/`--to` to encode the whole song (a few minutes). Frames cache in `out/the-smoking-gun/frames-1x/` by frame index, so a render without `--fresh` only fills in missing frames; `--fresh` deletes the whole cache, so pass it on the first part only, after any shot change. Run `render zfight` first; it must print NO FLICKER.
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
