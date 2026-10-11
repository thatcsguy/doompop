// Add a song: node tools/new-song.mjs <slug> <audio file> [--lyrics lyrics.txt] [--title "Title"]
//
// Decodes the audio ONCE to songs/<slug>/audio/song.wav (48 kHz, 16-bit stereo). That WAV is the
// master for everything: analysis, preview and the final mux. Using one decoded file everywhere
// means MP3 encoder padding can't make tools disagree about where t = 0 is.
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const lyrics = opt('lyrics'), title = opt('title');
const [slug, src] = argv;
if (!slug || !src || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: node tools/new-song.mjs <slug: a-z0-9-> <audio file> [--lyrics file] [--title "Title"]');
  process.exit(1);
}
const dir = resolve('songs', slug);
if (existsSync(join(dir, 'index.ts'))) { console.error(`songs/${slug} already exists`); process.exit(1); }
for (const d of ['audio', 'data', 'shots', 'docs']) mkdirSync(join(dir, d), { recursive: true });

const ext = extname(src).toLowerCase() || '.bin';
copyFileSync(src, join(dir, 'audio', `original${ext}`));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', join(dir, 'audio', 'song.wav')], { stdio: 'inherit' });
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(dir, 'audio', 'song.wav')]).toString().trim());

writeFileSync(join(dir, 'lyrics.txt'), lyrics ? readFileSync(lyrics, 'utf8') : '# paste the lyric sheet here, one sung line per line; [Section] markers allowed\n');

// Placeholders so the preview runs before analysis; analysis/ overwrites both.
writeFileSync(join(dir, 'data', 'audio.json'), JSON.stringify({
  duration, bpm: 120, beats: [], downbeats: [], sections: [{ id: 'all', start: 0, end: duration }],
  hits: { kick: [], snare: [], hat: [], impact: [] }, envelopes: { fps: 60, rms: [], low: [], mid: [], high: [] },
}, null, 1));
writeFileSync(join(dir, 'data', 'lyrics.json'), JSON.stringify({ lines: [] }, null, 1));

const name = title ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
writeFileSync(join(dir, 'index.ts'), `import { defineSong } from '../../engine/types';
import audio from './data/audio.json';
import lyrics from './data/lyrics.json';
import audioUrl from './audio/song.wav?url';
import { slate } from '../../engine/shots/slate';

export default defineSong({
  slug: '${slug}',
  title: ${JSON.stringify(name)},
  audioUrl,
  audio,
  lyrics,
  shots: [
    slate({ id: 'slate', start: 0, end: audio.duration, title: ${JSON.stringify(name)} }),
  ],
});
`);
for (const [f, body] of [
  ['docs/TREATMENT.md', `# ${name}: treatment\n\n## Concept\n\n## Look\n\n## Cast\n\n## Through-line\n`],
  ['docs/STORYBOARD.md', `# ${name}: storyboard\n\nOne row per shot, anchored to bars and lyric lines from data/.\n\n| Shot | Start | End | Lyric / bar | What happens |\n|---|---|---|---|---|\n`],
]) writeFileSync(join(dir, f), body);

console.log(`songs/${slug}: ${duration.toFixed(2)} s. Next: fill lyrics.txt, then  npm run analyze -- ${slug}`);
