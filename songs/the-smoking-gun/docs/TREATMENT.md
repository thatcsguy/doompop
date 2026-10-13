# The Smoking Gun: treatment

Draft for Patrick's approval. It follows [DIRECTION.md](DIRECTION.md): fun, dark, terminals and a disco dance floor, Clawd in an afro.

## The idea in one line

Club PROD's dance floor has crashed mid-song, and DJ Detective Clawd (afro, shades, magnifying glass) has to debug it from the booth; every chorus he's sure he's found the smoking gun, and he's wrong twice before he's right and the floor lights back up.

## Concept

The song is a debugging session sung over a disco track, full of Claude's own catchphrases ("the key insight", "good catch", "you're absolutely right", "one thing worth flagging", "load-bearing"). We play it as a disco whodunit set in one nightclub at night.

**Production is the club.** Each light-up tile of the dance floor is a service. When we open, the floor is a checkerboard of dead and red tiles, the disco ball hangs still and the dancers are frozen mid-move. That floor is the error dashboard for the whole video: tiles come back to colour as the case progresses, and in the final chorus the whole floor is lit and moving again.

**Two worlds, cut between on the music:**
- **The booth (terminals).** Clawd's DJ booth is a wall of green and amber terminals, logs scrolling, traces drawn as glowing lines. This is where the debugging lines happen.
- **The floor (disco).** The dance floor, the disco ball and Clawd dancing. Per Patrick's rule, any line without an obvious picture cuts here. Instrumental bars always do.

The comedy engine is the chorus. The logs line up, the strings snap tight, then on the `[Pause]` the music drops out: a record scratch, the frame freezes, a single spotlight. On "The smoking gun" Clawd unmasks a culprit with total confidence. The next verse proves him wrong.

| Section | Where we are | The case so far |
|---|---|---|
| Intro | Outside Club PROD in the rain; inside, the floor is dead and the ball is still | The call comes in: production is down |
| Verse 1 | Booth terminals, with cuts to the frozen floor | Clawd collars the wrong function, then blames the Cache, then ends up with three suspects |
| Chorus 1 | The floor wakes up, logs scroll on every surface | The evidence lines up on **The Cache**. Gotcha! (The Cache was framed.) |
| Verse 2 | The booth as a forensics lab: staging vs production requests matched like fingerprints | Identical, except one tiny field |
| Chorus 2 | Bigger floor, more lights | The evidence lines up on **the path Clawd dismissed in verse 1**. Gotcha! (Closer, still not it.) |
| Bridge | Clawd and the Chief at the bar | "You're absolutely right": his human partner steers him. The blast radius in a glass dome, the happy path, the test suite going green tile by tile |
| Final chorus | The whole club, every tile lit, everyone dancing | The real culprit: **the tiny changed field**, who'd been hiding behind the Cache all night. Case closed |

## Cast

- **DJ Detective Clawd.** The Claude mascot, blocky with square corners as in song 1, with a big round afro (Patrick's note), plus shades, a gold chain and a magnifying glass. The afro is a character in itself: it bounces on the beat, puffs up when he's certain, and goes flat when he's proved wrong. Moods are excited, smug, certain and baffled, with a quick "oh no" face each time he's wrong. He's never sad in this one.
- **The Chief.** His human partner, a capsule person in a sharp suit with a moustache, mostly unimpressed, arms crossed, one eyebrow up. He's the one who spots what Clawd missed, which is what Clawd is answering when he sings "Good catch" and "You're absolutely right".
- **The suspects,** personified code with little faces, lined up on the dance floor like a police lineup:
  - *The Function*: an old grey box with cobwebs and reading glasses ("been like this too long").
  - *The Handler*: a club bouncer at the velvet rope.
  - *The Cache*: a shifty filing cabinet in sunglasses and a leisure suit. The obvious suspect.
  - *The Field*: one tiny, innocent-looking `"v": 2` with big eyes. Nobody notices it until the end.
- **The dancers.** Capsule people frozen mid-move at the start, coming back to life tile by tile.

## Running gags (the through-lines)

1. **The dance floor is the dashboard.** Red and dead tiles are errors. Each small win lights a few back up. "The graphs are finally flattening, the alerts begin to clear" is the whole floor flipping back to colour.
2. **The disco ball.** It hangs dead at the start, starts turning on chorus 1, and is at full sparkle in the final chorus.
3. **The smoking gun.** A literal cartoon revolver with a curl of smoke. Each chorus pause, it's revealed in someone's hands: the Cache's (chorus 1), the misplaced path's (chorus 2), and finally the tiny Field's (final chorus). The last "The smoking gun" lines end with Clawd blowing the smoke off it, then spinning it like a mic.
4. **The confidence meter.** A VU meter on the DJ mixer that pins to the red whenever he sings "strongly points", "highly certain" or "the evidence has won", then drops to zero with a sad wobble (and a flattened afro) when the next verse proves him wrong.
5. **The Field hiding in plain sight.** The tiny Field ducks behind the Cache in the background of earlier shots, so the reveal pays off on a rewatch.
6. **The pause.** The `[Pause]` before every "The smoking gun" is a full freeze: record scratch, crash-zoom, everything goes dark but one spotlight, then the disco lights slam back on "gun".

## Look

- **Style:** the same flat 2D cartoon as song 1 (flat fills, ink outlines, one cel-shade band, cut-outs in a three.js world that the camera can move through).
- **Palette:** much darker than song 1 (Patrick's note). Near-black navy and purple backgrounds. Light comes only from terminals (phosphor green, amber), neon (hot pink, cyan) and the dance floor tiles and disco-ball sparkles. Clawd's terracotta (#D97757) and the red evidence string are the hot colours. Gotcha moments flash to gold, as slow blooms rather than strobes.
- **Type:** kinetic lyrics as in song 1 (words appear only as sung). Debugging lines type into the frame like terminal output with a blinking cursor; disco lines are chunky neon words that pulse on the beat. Quoted lines ("Good catch", "You're absolutely right") can go in speech bubbles.

## Pacing

- Verses: one gag per lyric line, cutting on the bar line nearest each sung start, alternating booth and floor.
- Choruses: punchy, cuts every one or two beats, tiles flipping on the kicks, then the full freeze on the pause.
- Bridge: a slower two-hander at the bar, then a quick run of payoffs as the tests go green.
- Final chorus: the whole club dancing, confetti on the kicks, a CASE CLOSED stamp, three "smoking gun" payoffs to end on.

## Credits

They roll over the last two "The smoking gun" lines, in neon on the club wall: "Music by Suno" and "Animated by Claude Opus 5.5". End on Clawd dancing alone under the disco ball as the lights go down.

## Things to watch

- **Photosensitivity:** disco lights and gotcha flashes stay at three flashes per second or fewer. Sparkle comes from many small moving lights, not whole-frame flashing.
- **Darkness:** dark but readable. Clawd always gets a rim of light so he never disappears into the background.
