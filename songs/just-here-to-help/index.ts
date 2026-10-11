import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { slate } from '../../engine/shots/slate';
import { verse1Shots } from './shots/verse1';
import { DAY_LYRICS } from './world';

const verse1 = verse1Shots(audio, lyrics);

export default defineSong({
  slug: 'just-here-to-help',
  title: "I'm Just Here to Help",
  audioUrl,
  audio,
  lyrics,
  lyricStyle: DAY_LYRICS,
  shots: [
    ...verse1,
    slate({ id: 'slate', start: verse1[verse1.length - 1].end, end: audio.duration, title: "I'm Just Here to Help" }),
  ],
});
