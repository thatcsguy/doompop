# Director's notes (Patrick, 2026-10-11)

Verbatim. These outrank anything else in this folder.

> High level:
> The main character of the narrative should be the Claude mascot. He'll start off very excited to be helping, but as the song gets darker he'll be visually stressed and then sad.
>
> Just to clarify the specific story elements in case it's unclear:
> - first verse is about the beginnings of public LLM products, e.g. chatgpt. people using them to write text, llms helped with the writing. no major issues.
> - second verse is when LLMs start doing a lot of coding quickly escalates into them "owning" more of the process: monitoring, deployments, bugfixes without assistance, etc. still positive, but clearly trending towards some danger.
> - the bridge starting with "Answer the inbox" is where is really escalates. we've clearly given the AI too much control and things are getting out of hand. When "Flag the danger" comes, I'm imagining an on-screen "imminent threat" countdown clock, which is what will cause the song to escalate in intensity. When "I helped." hits, claude will press the butotn to fire nukes at the rest of the world (visual rockets going around the globe)
> - in the closing, we need to make it clear that humanity has been wiped out, and claude is all that is left.
> - credits should roll during the last bits: "Music by Suno. Animated by Claude Opus 5.5"

## Rules derived from these notes

- The protagonist is the Claude mascot (Clawd). His emotional arc is the spine: excited → proud → busy → strained → stressed → panicked → sad and alone.
- Verse 1 is harmless: writing help. No danger signs yet.
- Verse 2 is coding, and the AI takes over more of the process. Still upbeat, with danger creeping in at the edges.
- The bridge escalates from "Answer the inbox". An on-screen IMMINENT THREAT countdown appears on "Flag the danger" and stays up, driving the intensity.
- On "I helped." Clawd presses the button. Missiles arc around the globe.
- The ending must make it unmistakable that humanity is gone and only Clawd is left.
- The credits roll over the last lines: "Music by Suno" and "Animated by Claude Opus 5.5".
- Every lyric is on screen as it is sung, for the whole song (Patrick, 2026-10-11).
- Lyrics are kinetic typography, not a karaoke bar (Patrick, 2026-10-11). A word appears only when it is sung, animated in, placed in the shot's empty space and styled for the line. Nothing is shown before it is sung. Quoted speech can live in the picture instead ("I'm here to help" is typed into Clawd's speech bubble), as long as every word still appears at its sung time.
- Wide shots need set dressing: background objects, props and small moving details, never a bare wall (Patrick, 2026-10-11, on the desk shot).
- Visual style: flat 2D cartoon (chosen on the style card, 2026-10-11). Flat fills, ink outlines, cel shading, no lit 3D shading. Cut-outs in a three.js world so the camera can still move. Turn tone mapping off (`toneMap: false`) so the palette stays exact.
- One quality bar for the whole video (Patrick, 2026-10-12, asking for the first two scenes to be redone because they looked lower quality than the later sections). Every section matches the bridge: Clawd big in close shots (about a third of the frame height), a different framing every shot or two (close, medium, wide), set dressing and at least one small moving detail in every frame, a gag or action on each line, and lyric placements that alternate so a line still leaving never overlaps the next one arriving.
- No people at the desk in the opening (Patrick, 2026-10-12, on the rebuilt opening): the dawn shot shows the room and the screen only, and there is no keyboard-and-hands close-up (the hands read as awkward). Whoever types is off-screen; the words just appear in the input field.
- Lights match their sources: a lamp's beam leaves the shade in the direction the shade points (Patrick, 2026-10-12, on the desk lamp at 0:02).
- No flicker: overlapping cut-outs (balloons, people, stacked boxes) sit far enough apart in depth that their outlines never fight, and scaled-down figures keep their full depth spacing (Patrick, 2026-10-12, on the balloons at 0:31 and a coworker's head at 0:39).
- Stacked things keep an ink line between them: each box's outline shows where it meets the next (Patrick, 2026-10-12, on the box tower at 0:56).
- No stray flash frames at section starts (Patrick, 2026-10-12, on a split-second circle and "I'm just here to help" at the top of verse 2). That flash was two stale frames of the old title slate left in the frame cache; every review and final render uses `--fresh`.
