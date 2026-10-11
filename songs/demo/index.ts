// A 16 s synthetic test track used to prove the pipeline. Not a real song: no vocals,
// so data/lyrics.json is hand-timed placeholder text.
import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { tunnel } from './shots/tunnel';
import { grid } from './shots/grid';

export default defineSong({
  slug: 'demo',
  title: 'Doompop Test Track',
  audioUrl,
  audio,
  lyrics,
  shots: [tunnel(0, 8), grid(8, audio.duration)],
});
