# The Smoking Gun: storyboard

Draft for Patrick's approval, one row per lyric line, following [TREATMENT.md](TREATMENT.md) and [DIRECTION.md](DIRECTION.md). Time is when the line starts being sung (m:ss.s, from `data/lyrics.json`). `~` marks lines where the aligner was unsure of some words, so those times may move a little after an ear check. The song runs 3:14.4 at about 129 BPM (a bar is about 1.9 s). Shots cut on the beat nearest each sung start.

**BOOTH** = the DJ booth of terminals. **FLOOR** = the dance floor, disco ball and Clawd dancing (the default when a line has no obvious picture). Clawd's mood is in brackets.

## Intro (0:00 to 0:14.9, instrumental)

| # | Time | Line | Shot |
|---|---|---|---|
| 0a | 0:00 | (bars 1 to 4) | Rain on a dark street. A neon sign buzzes on: CLUB PROD. Inside the window, the dance floor is dead: red and black tiles, a still disco ball, dancers frozen mid-move. |
| 0b | 0:07.9 | (bars 5 to 7) | A pager on the bar buzzes "PROD DOWN". Cut to black, then a spotlight: Clawd's afro rises into frame from below, then his shades, then the rest of him. He clicks his fingers on the impact at 0:13.6. [cool] |

## Verse 1 (the crime scene)

| # | Time | Line | Shot |
|---|---|---|---|
| 1 | 0:14.9 | I start up the dev server | BOOTH. Clawd slides into the DJ booth and flips the master switch. Terminals boot one after another in green. [excited] |
| 2 | 0:17.2 | And reproduce the crash | He drops the needle on a record labelled `/checkout`. The dance floor flickers on for a second, then every tile goes red with a sad record-scratch. [delighted it reproduced] |
| 3 | 0:19.2 | I trace it through the handler | A glowing trace line shoots out of the terminal and across the club to the velvet rope, where the Handler (a bouncer) waves it through. |
| 4 | 0:20.9 | And follow every path | FLOOR. Clawd follows the trace line across the light-up tiles in a dance step, each tile lighting under his feet. |
| 5 | 0:22.5 | The key insight seems obvious | A lightbulb pops on over his afro. He points dramatically. The confidence meter on the mixer spikes. [smug] |
| 6 | 0:24.8 | This function must be wrong | He collars the Function (an old grey box with reading glasses) and snaps on handcuffs. [certain] |
| 7 | 0:26.8 | Upon closer inspection | Magnifying-glass close-up on the Function: cobwebs, dust and a `git blame` sticker dated 2019. |
| 8 | 0:28.7 | It's been like this too long | The Function shrugs, the cuffs fall off. Clawd's afro deflates a little. [baffled] |
| 9 | 0:30.5 ~ | I search for every caller | BOOTH. A wall of terminals fills with `grep` results scrolling up. Clawd scrubs them like a DJ scratching. |
| 10 | 0:32.6 ~ | I map the data flow | The red-string evidence board on the club wall: photos of the suspects pinned up and joined by string. |
| 11 | 0:34.3 | This strongly points to caching | All the strings swing towards the Cache (a filing cabinet in shades and a leisure suit). The meter pins to red. [certain] |
| 12 | 0:36.2 ~ | But traces tell me no | A terminal prints a big red NO. The Cache lowers its shades and wags a finger. (The tiny Field is just visible behind it.) |
| 13 | 0:37.9 ~ | I've isolated the issue | FLOOR. Clawd shoos the dancers off one square of the floor and stands on it alone, proud. [proud] |
| 14 | 0:39.9 | The evidence looks strong | He flexes. The disco ball twitches for a moment. |
| 15 | 0:42.1 | To three competing causes | The square splits into three. The Function, the Handler and the Cache each pop up on one and pose. |
| 16 | 0:44.0 ~ | So something here is wrong | Clawd looks from one to the next to the next, his afro spinning, sweat flying off. [baffled] |

## Chorus 1 (the strings snap on the Cache)

| # | Time | Line | Shot |
|---|---|---|---|
| 17 | 0:47.8 | The logs are lining up now | FLOOR. The music lands and the floor lights up in waves. Log lines scroll across the tiles and line up in rows on the kicks. Clawd starts dancing. [excited] |
| 18 | 0:49.8 ~ | The timeline makes it clear | A neon timeline slides along the wall behind the dancers, with event markers popping on each beat. |
| 19 | 0:51.6 ~ | One change before the failure | One marker on the timeline glows gold: a commit tag. A red X lands just after it. |
| 20 | 0:53.4 | One signal pointing here | A big neon arrow swings round and points down at a single tile. Clawd hops onto it. |
| 21 | 0:54.9 | The traces tell the same story | BOOTH. Every terminal shows the same trace line. Clawd conducts them like an orchestra. |
| 22 | 0:57.3 | The evidence has won | The red strings on the board snap tight into one straight line. Meter in the red, afro fully puffed. [triumphant] |
| 23 | 0:59.3 ~ | I think we finally found it | Slow push in on Clawd, who reaches into his coat. The disco ball starts to turn. |
| — | 1:00.9 | [Pause] | Record scratch. Freeze frame, everything goes dark but one spotlight. Crash zoom. |
| 24 | 1:02.0 ~ | The smoking gun | The spotlight lands on the Cache, holding a smoking cartoon revolver. GOTCHA stamps on. The lights slam back on with the beat. [gotcha!] |

## Break (1:03.5 to 1:18.2, instrumental)

| # | Time | Line | Shot |
|---|---|---|---|
| 24a | 1:03.5 | (instrumental) | FLOOR. A victory dance: Clawd does the disco point under the turning ball, dancers join in, the floor half-lit. The Cache is led away in cuffs in the background, still wagging a finger. |
| 24b | about 1:12 | (instrumental) | A terminal on the bar pings: the error is still there. The floor flickers back to red, the needle skids, and Clawd freezes mid-move. His afro flattens. [oh no] |

## Verse 2 (the forensics lab)

| # | Time | Line | Shot |
|---|---|---|---|
| 25 | 1:18.2 ~ | I pull up all the metrics | BOOTH. Clawd yanks down a projector screen of graphs over the decks. |
| 26 | 1:19.7 | The pattern looks exact | Two graph lines, staging and production, slide together and overlap perfectly. |
| 27 | 1:21.8 | The staging and production calls | Two dancers in matching outfits, labelled STAGING and PROD, step out side by side. |
| 28 | 1:23.8 ~ | Are matching fact for fact | They do a mirror dance, move for move. |
| 29 | 1:25.6 | The request bodies match now | Two JSON documents slide in on terminals side by side, lines highlighting in sync. |
| 30 | 1:27.6 ~ | I verify the same | Clawd overlays them like fingerprints under a lamp. They match. |
| 31 | 1:29.4 ~ | Byte-for-byte identical | Close-up as the bytes tick past in pairs, all green, faster and faster. |
| 32 | 1:31.2 ~ | Except one field has changed | One pair flashes red: `"v": 1` vs `"v": 2`. The tiny Field blinks its big eyes and ducks out of frame. [gasp] |
| 33 | 1:32.9 ~ | Good catch, that changes everything | The Chief (capsule person in a suit, moustache, coffee) taps the red byte. Clawd's speech bubble: "Good catch!" |
| 34 | 1:34.7 ~ | The scope is narrower now | FLOOR. The lit part of the dance floor shrinks to a small square. Clawd keeps dancing in the shrinking space. |
| 35 | 1:36.9 ~ | The cache path's load-bearing | The Cache is the pillar holding up the DJ booth. Clawd pulls it slightly, and the whole booth creaks and tilts. He pushes it back. |
| 36 | 1:38.7 ~ | I'm highly certain how | He crosses his arms and nods. The meter pins to red again. [smug] |
| 37 | 1:40.4 ~ | One thing worth flagging here though | He raises a tiny flag on a stick. |
| 38 | 1:42.3 ~ | There's one more thread to chase | A loose red thread trails out of his flag. He follows it in a dance-chase across the floor, through the dancers' legs. |
| 39 | 1:44.3 ~ | The actual root cause may be | The thread runs under the DJ booth. Clawd crawls in, afro first. |
| 40 | 1:46.2 ~ | The path I first misplaced | He pulls out the dusty first trace from verse 1 (the handler path) with a "huh" face. [sheepish] |

## Chorus 2 (the strings snap on the misplaced path)

| # | Time | Line | Shot |
|---|---|---|---|
| 41 | 1:49.9 ~ | The logs are lining up now | FLOOR, bigger and brighter than chorus 1. The logs line up on the tiles again, faster. |
| 42 | 1:51.8 ~ | The timeline makes it clear | The neon timeline returns, now with a second gold marker. |
| 43 | 1:53.6 ~ | One change before the failure | Clawd moonwalks along the timeline back to that change. |
| 44 | 1:55.4 | One signal pointing here | Two neon arrows now, both swinging to the same tile. |
| 45 | 1:56.9 | The traces tell the same story | BOOTH. Terminals in a grid, every trace lighting the same path in sync. |
| 46 | 1:59.2 | The evidence has won | The string board snaps tight again, now on the dusty path from verse 1. Afro fully puffed. [triumphant] |
| 47 | 2:01.2 | I think we finally found it | Same slow push in as chorus 1, Clawd reaching into his coat. |
| — | 2:02.9 | [Pause] | Record scratch, freeze, spotlight, crash zoom. |
| 48 | 2:03.8 ~ | The smoking gun (held to 2:12) | The spotlight lands on the misplaced path, which is holding the smoking gun. GOTCHA. Then, as the note holds, the camera drifts along the path: it leads straight back behind the Cache, where the tiny Field is hiding. Clawd doesn't notice. The dancers do. |

## Break (2:12.3 to 2:19.2, instrumental)

| # | Time | Line | Shot |
|---|---|---|---|
| 48a | 2:12.3 | (instrumental) | FLOOR. Clawd dances, but the Chief walks over, arms crossed, eyebrow up. Clawd stops mid-spin. |

## Bridge (Clawd and the Chief at the bar)

| # | Time | Line | Shot |
|---|---|---|---|
| 49 | 2:19.2 | You're absolutely right there | At the bar, the Chief says something (wordless squiggle bubble). Clawd nods vigorously: "You're absolutely right!" in his bubble. [eager] |
| 50 | 2:21.5 | That changes what we know | The Chief slides a napkin over with one circled byte on it. |
| 51 | 2:22.9 | The blast radius is bounded | A tiny cartoon bomb goes off under a glass cocktail dome on the bar: a contained puff. |
| 52 | 2:25.0 | At least the graphs say so | Clawd holds up a little graph and shrugs. The Chief sips his coffee. |
| 53 | 2:26.7 | I found the load-bearing seam now | Clawd unzips a seam in the dance floor and peeks inside at glowing wiring. |
| 54 | 2:28.9 | The happy path is clean | A path of tiles lights up in rainbow colours, with flowers and a smiling sun sticker. Clawd skips along it. [happy] |
| 55 | 2:30.6 ~ | I run the regression suite once more | BOOTH. He slams a big red RUN button. Test names scroll on every terminal. |
| 56 | 2:33.1 ~ | And everything stays green | FLOOR. The tiles flip to green in a wave from his feet out to the walls. |

## Final chorus (the real culprit, then the party)

| # | Time | Line | Shot |
|---|---|---|---|
| 57 | 2:37.6 ~ | The graphs are finally flattening | The graph screens behind the decks drop flat. The disco ball starts turning at full speed. |
| 58 | 2:39.7 ~ | The alerts begin to clear | Red tiles pop back to colour one by one on the kicks. Frozen dancers unfreeze. |
| 59 | 2:41.8 ~ | The same request that broke it | The `/checkout` record from line 2 goes back on the turntable. Clawd lowers the needle carefully. [nervous] |
| 60 | 2:43.4 ~ | Now passes every tier | It plays. The floor lights up level by level, like a building of dance floors. |
| 61 | 2:45.0 ~ | The patch survived production | A tiny patch (a sticking plaster) on the floor survives a stampede of dancers. |
| 62 | 2:47.3 ~ | The errors all are done | The last red tile goes out. CASE CLOSED stamps across the screen. |
| 63 | 2:49.5 ~ | All because we found it (held to 2:55) | Clawd and the Chief walk to the Cache. Clawd lifts it like a curtain. |
| — | about 2:55 | [Pause] | Record scratch, freeze, spotlight. |
| 64 | 2:55.6 ~ | The smoking gun | Behind the Cache: the tiny Field, holding the smoking gun, with a guilty little grin. GOTCHA, for real this time. |
| 65 | 2:57.4 ~ | The smoking gun (held to 3:04) | Clawd takes the gun, blows the smoke off it and spins it like a mic. Confetti. The whole club dances, the Field included. Credits start rolling up the wall in neon. |
| 65a | 3:04.4 | (instrumental) | FLOOR. Wide shot of the full party under the disco ball. Credits: "Music by Suno", "Animated by Claude Opus 5.5". |
| 66 | 3:10.7 ~ | The smoking gun | The lights go down to one spotlight on Clawd dancing alone under the ball. He blows smoke off his finger-gun and winks. Black. |

## Open questions for Patrick

- The aligner was unsure of many words in the choruses (line 18 and lines 57 to 58 especially). The check clip shows each one; I'll fix any that sound off.
- Lines 63 and 65 hold for several seconds; the pause before 64 is short (about half a second), so the freeze there may need to be tighter than in the first two choruses.
