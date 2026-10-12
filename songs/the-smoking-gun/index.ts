import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { slate } from '../../engine/shots/slate';

export default defineSong({
  slug: 'the-smoking-gun',
  title: "The Smoking Gun",
  audioUrl,
  audio,
  lyrics,
  shots: [
    slate({ id: 'slate', start: 0, end: audio.duration, title: "The Smoking Gun" }),
  ],
});
