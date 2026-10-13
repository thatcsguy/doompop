import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { verse1Shots } from './shots/verse1';
import { chorus1Shots } from './shots/chorus1';
import { verse2Shots } from './shots/verse2';
import { chorus2Shots } from './shots/chorus2';
import { bridge1Shots } from './shots/bridge1';
import { bridge2Shots } from './shots/bridge2';
import { bridge3Shots } from './shots/bridge3';
import { outroShots } from './shots/outro';
import { DAY_LYRICS } from './world';
import { KINETIC } from './lyrics-layout';

const verse1 = verse1Shots(audio, lyrics);
const chorus1 = chorus1Shots(audio, lyrics, verse1[verse1.length - 1].end);
const verse2 = verse2Shots(audio, lyrics, chorus1[chorus1.length - 1].end);
const chorus2 = chorus2Shots(audio, lyrics, verse2[verse2.length - 1].end);
const bridge1 = bridge1Shots(audio, lyrics, chorus2[chorus2.length - 1].end);
const bridge2 = bridge2Shots(audio, lyrics, bridge1[bridge1.length - 1].end);
const bridge3 = bridge3Shots(audio, lyrics, bridge2[bridge2.length - 1].end);
const outro = outroShots(audio, lyrics, bridge3[bridge3.length - 1].end);

export default defineSong({
  slug: 'just-here-to-help',
  title: "I'm Just Here to Help",
  audioUrl,
  audio,
  lyrics,
  lyricStyle: DAY_LYRICS,
  kinetic: KINETIC,
  shots: [
    ...verse1,
    ...chorus1,
    ...verse2,
    ...chorus2,
    ...bridge1,
    ...bridge2,
    ...bridge3,
    ...outro,
  ],
});
