// "The Smoking Gun": a disco whodunit at Club PROD (see docs/TREATMENT.md and docs/STORYBOARD.md).
// Built so far: the intro, verse 1, chorus 1 and its break, verse 2, chorus 2 and its break, and the
// bridge (0:00 to 2:37.6); the rest is still the slate.
import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import rawLyrics from './data/lyrics.json';
import analysis from './analysis.json';
import audioUrl from './audio/song.wav?url';
import { slate } from '../../engine/shots/slate';
import { CLUB_POST, FONTS, PAL } from './look';
import { introShots } from './shots/intro';
import { verse1Shots } from './shots/verse1';
import { chorus1Shots } from './shots/chorus1';
import { verse2Shots } from './shots/verse2';
import { chorus2Shots } from './shots/chorus2';
import { bridgeShots } from './shots/bridge';
import { withWordFixes } from './word-fixes';

// manual word-time fixes (analysis.json) on top of the aligner's output
const lyrics = withWordFixes(rawLyrics, analysis.word_fixes);

const built = [...introShots(audio), ...verse1Shots(audio, lyrics), ...chorus1Shots(audio, lyrics), ...verse2Shots(audio, lyrics), ...chorus2Shots(audio, lyrics), ...bridgeShots(audio, lyrics)];

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
