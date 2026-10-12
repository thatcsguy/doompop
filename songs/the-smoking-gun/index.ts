// "The Smoking Gun": a disco whodunit at Club PROD (see docs/TREATMENT.md and docs/STORYBOARD.md).
// Built so far: the intro, verse 1, chorus 1 and the break (0:00 to 1:18); the rest is still the slate.
import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { slate } from '../../engine/shots/slate';
import { CLUB_POST, FONTS, PAL } from './look';
import { introShots } from './shots/intro';
import { verse1Shots } from './shots/verse1';
import { chorus1Shots } from './shots/chorus1';

const built = [...introShots(audio), ...verse1Shots(audio, lyrics), ...chorus1Shots(audio, lyrics)];

export default defineSong({
  slug: 'the-smoking-gun',
  title: 'The Smoking Gun',
  audioUrl,
  audio,
  lyrics,
  fonts: FONTS,
  background: PAL.night,
  post: CLUB_POST,
  lyricStyle: { mode: 'none' },   // every shot draws the disco lyric layer itself (shots/common.ts)
  shots: [
    ...built,
    slate({ id: 'slate', start: built[built.length - 1].end, end: audio.duration, title: 'The Smoking Gun' }),
  ],
});
