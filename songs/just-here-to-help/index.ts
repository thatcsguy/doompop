import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { slate } from '../../engine/shots/slate';

export default defineSong({
  slug: 'just-here-to-help',
  title: "I'm Just Here to Help",
  audioUrl,
  audio,
  lyrics,
  shots: [
    slate({ id: 'slate', start: 0, end: audio.duration, title: "I'm Just Here to Help" }),
  ],
});
