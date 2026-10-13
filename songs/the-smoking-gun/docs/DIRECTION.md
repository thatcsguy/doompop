# Director's notes (Patrick, 2026-10-12)

Verbatim. These outrank anything else in this folder.

> much more fun this time

> for this one, much darker video color-wise.  terminals and dancefloor vibe. the track is very disco, so I want to play into that.  Claude still the main character, but he should have an afro.  When there isnt an obvious thing to be showing on screen, we should show a dance floor, disco ball, Claude dancing.  Make it really fun.

## Rules derived from these notes

- Tone: fun first. This is a comedy, not the sad arc of song 1.
- Colour: much darker than song 1. Near-black backgrounds lit by terminal glow, neon and disco-ball light.
- Two worlds: terminals (the debugging) and the dance floor (the disco). The track is disco, so lean into it.
- Clawd is the main character and wears an afro.
- Default picture: when a line has no obvious image, cut to the dance floor, the disco ball and Clawd dancing.
- Carried over from song 1: flat 2D cartoon, Clawd blocky with square corners, every lyric as kinetic typography appearing only as sung, wide shots dressed with background detail.

# Director's notes on the first full render (Patrick, 2026-10-13)

Verbatim.

> I think the bit about "No flicker (z-fighting)" in ANIMATION_GUIDE.md is the biggest takeaway.  I can see that all over the place in the final render.  Most obvious places it happens are the pink/blue outlines of Clawd's hair basically all the way thru, knob of the "dev server", gloves of the "cache", eyes of the little v:2 guy, mustache of the old man, but it's kind of everywhere. I think we need a full pass to fix this issue. If you find an approach that can prevent this entirely, I think it would be a good thing to document for future songs as well.
>
> other issues:
>
> * 0:50 - the "deploy" flag is so bright that it's unreadable, tone it down a bit.
> * 1:09 - would like for the Handler's nametag to be fully readable
> * 1:26 - the side-by-side diff in the middle has the left one bleeding into the right one. really like the concept, just needs cleaning up.  Similar issue at 1:28 on the monitor behind the magnifying glass
> * 1:47 - the nametag on the object is not wide enough to hold the full text. The JSON on the monitor to the right also exhibits the earlier issue of cutting off the text.
> * 1:53 - text cutoff on the left flag, right flag is also pretty tight
> * 2:21 - the man's finger clearly covers the "32" but then under the magnifying glass the number is visible again. i would make the man's finger stop a bit short of the number so we can actually read it.
> * 2:45 - would like the bandaid's smile to stay visible thru the shot.
>
>
> would like all these things fixed. paralellize it however you see fit.

## Rules derived from these notes

- No flicker anywhere. `npm run render -- zfight --song the-smoking-gun` must print NO FLICKER before
  any review render (the general rule is ANIMATION_GUIDE hard rule 7).
- Every word in the scene can be read: measured to fit its tag, flag or screen, not washed out by
  glow, not covered by a hand or prop while it matters (ANIMATION_GUIDE hard rule 8).
- Glowing signs and flags keep their letters under the bloom threshold; only a thin core line of the
  neon outline glows past it.
- A face the shot is about (the plaster's smile) stays visible for the whole shot.
