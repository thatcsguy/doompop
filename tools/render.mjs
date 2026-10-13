// Offline renderer: headless Chromium draws each frame from song time; ffmpeg joins frames + song.wav.
//
//   node tools/render.mjs video  --song <slug> [--from 0 --to 30] [--fps 60] [--samples 8] [--shutter 0.5] [--scale 1]
//                                [--workers 2] [--crf 16] [--preset slow] [--out out/<slug>.mp4] [--fresh]
//   node tools/render.mjs stills --song <slug> --t 1.5,12,30.2 [--scale 1] [--samples 8] [--no-lyrics]
//   node tools/render.mjs sheet  --song <slug> [--from 0 --to 30] [--n 16] [--cuts] [--cols 4] [--w 480]
//   node tools/render.mjs determinism --song <slug> [--n 8] [--samples 1]
//   node tools/render.mjs gpu    --song <slug>
//
// Frames go to out/<slug>/frames-<scale>x/ and are resumable: rerun the same command after a crash
// and only missing frames render. --fresh deletes them first. Chrome: set CHROME_PATH if not found.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const [mode = 'help', ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  const k = rest[i].replace(/^--/, '');
  if (rest[i + 1] === undefined || rest[i + 1].startsWith('--')) args[k] = true; else args[k] = rest[++i];
}
if (mode === 'help' || !args.song) {
  console.log(readFileHead());
  process.exit(mode === 'help' ? 0 : 1);
}
const slug = args.song;
const scale = Number(args.scale ?? 1);
const samples = Number(args.samples ?? (mode === 'video' ? 8 : 1));
const shutter = Number(args.shutter ?? 0.5);
const OUT = resolve('out', slug);

function findChrome() {
  const c = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const p of c) if (p && existsSync(p) && statSync(p).isFile()) return p;
  try { return chromium.executablePath(); } catch { return undefined; }
}

// No HMR or file watching: an edit or git checkout mid-render must not reload the pages.
const server = await createServer({ logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: findChrome(), headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'],
});

async function openPage(tag = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(`[page${tag}] ${m.text()}`); });
  page.on('pageerror', e => console.log(`[page error${tag}] ${e.message}`));
  await page.goto(`${base}?render&song=${slug}&scale=${scale}${args.fps ? `&fps=${args.fps}` : ""}`);
  await page.waitForFunction('window.ready === true || window.renderError', null, { timeout: 180000 });
  const err = await page.evaluate('window.renderError');
  if (err) throw new Error(err);
  return page;
}
const frameAt = async (page, t, s = samples, type = 'image/jpeg', q = 0.97, lyrics = true) => {
  const url = await page.evaluate(([t, s, sh, type, q, ly]) => window.doompop.frame(t, s, sh, type, q, ly), [t, s, shutter, type, q, lyrics]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
const run = (cmd, a) => new Promise((ok, bad) => {
  const p = spawn(cmd, a, { stdio: 'inherit' });
  p.on('close', c => (c ? bad(new Error(`${cmd} exited ${c}`)) : ok()));
});
const wav = resolve('songs', slug, 'audio', 'song.wav');

try {
  if (mode === 'gpu') {
    const page = await openPage();
    console.log('renderer:', await page.evaluate('window.doompop.gpu()'));
  } else if (mode === 'stills') {
    const page = await openPage(), dir = join(OUT, 'stills'); mkdirSync(dir, { recursive: true });
    for (const t of String(args.t ?? '0').split(',').map(Number)) {
      const t0 = Date.now(), f = join(dir, `t${t.toFixed(2)}.png`);
      writeFileSync(f, await frameAt(page, t, samples, 'image/png', 0.97, !args['no-lyrics']));
      console.log(`${f}  ${Date.now() - t0} ms`);
    }
  } else if (mode === 'sheet') {
    await sheet();
  } else if (mode === 'determinism') {
    await determinism();
  } else if (mode === 'video') {
    await video();
  } else {
    console.error(`unknown mode ${mode}`); process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}

async function video() {
  const probe = await openPage();
  const { duration, fps } = await probe.evaluate('({ duration: window.doompop.duration, fps: window.doompop.fps })');
  console.log('renderer:', await probe.evaluate('window.doompop.gpu()'));
  await probe.close();
  const from = Number(args.from ?? 0), to = Math.min(duration, Number(args.to ?? duration));
  const first = Math.round(from * fps), last = Math.ceil(to * fps) - 1;
  const dir = join(OUT, `frames-${scale}x`);
  if (args.fresh) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const name = i => join(dir, `f${String(i).padStart(6, '0')}.jpg`);
  const todo = [];
  for (let i = first; i <= last; i++) if (!existsSync(name(i)) || statSync(name(i)).size < 1000) todo.push(i);
  const workers = Number(args.workers ?? 2);
  console.log(`${todo.length} of ${last - first + 1} frames to render, ${samples} sub-frames each, ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    let page = await openPage(`#${w}`), count = 0;
    while (next < todo.length) {
      const i = todo[next++];
      if (++count % 300 === 0) { await page.close(); page = await openPage(`#${w}`); } // keep memory flat
      let buf;
      try { buf = await frameAt(page, i / fps); } catch (e) { console.log(`frame ${i} failed (${e.message}), retrying`); buf = await frameAt(page, i / fps); }
      writeFileSync(name(i) + '.tmp', buf); renameSync(name(i) + '.tmp', name(i));
      if (++done % 60 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
    await page.close();
  }));
  const out = resolve(args.out ?? join('out', `${slug}${args.from || args.to ? `-${from}-${to}` : ''}.mp4`));
  mkdirSync(dirname(out), { recursive: true });
  console.log(`encoding → ${out}`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-stats',
    '-framerate', String(fps), '-start_number', String(first), '-i', join(dir, 'f%06d.jpg'),
    '-ss', String(first / fps), '-t', String((last - first + 1) / fps), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-frames:v', String(last - first + 1),
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', String(args.preset ?? 'slow'), '-crf', String(args.crf ?? 16),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', out]);
  const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration', '-of', 'compact', out]).toString();
  console.log(info.trim());
  console.log(`wrote ${out}`);
}

async function sheet() {
  const page = await openPage();
  const meta = await page.evaluate('({ duration: window.doompop.duration, shots: window.doompop.shots })');
  const from = Number(args.from ?? 0), to = Math.min(meta.duration, Number(args.to ?? meta.duration));
  let times;
  if (args.cuts) {
    times = meta.shots.filter(s => s.start >= from && s.start < to).flatMap(s => [s.start + 0.02, (s.start + s.end) / 2]);
  } else {
    const n = Number(args.n ?? 16);
    times = Array.from({ length: n }, (_, k) => from + (to - from) * (k + 0.5) / n);
  }
  const cols = Number(args.cols ?? 4), w = Number(args.w ?? 480);
  const url = await page.evaluate(([times, cols, w, samples, shutter]) => {
    const d = window.doompop, h = Math.round(w * d.height / d.width), rows = Math.ceil(times.length / cols), lab = 22;
    const c = document.createElement('canvas'); c.width = cols * w; c.height = rows * (h + lab);
    const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
    g.font = '14px monospace'; g.fillStyle = '#ddd';
    times.forEach((t, k) => {
      const x = (k % cols) * w, y = Math.floor(k / cols) * (h + lab);
      d.frame(t, samples, shutter); // renders into the engine's canvas
      g.drawImage(document.querySelector('#view canvas'), x, y + lab, w, h);
      const shot = d.shots.filter(s => s.start <= t).pop();
      g.fillText(`${t.toFixed(2)}s  ${shot ? shot.id : ''}`, x + 6, y + 16);
    });
    return c.toDataURL('image/jpeg', 0.9);
  }, [times, cols, w, samples, shutter]);
  const out = resolve(args.out ?? join('out', slug, `sheet-${from.toFixed(1)}-${to.toFixed(1)}${args.cuts ? '-cuts' : ''}.jpg`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`wrote ${out}`);
}

async function determinism() {
  // Same frames rendered in two orders on two pages must be pixel-identical. Catches state that
  // leaks between frames (x += ..., Math.random, caches keyed on the previous frame).
  const a = await openPage('A'), b = await openPage('B');
  const meta = await a.evaluate('({ duration: window.doompop.duration, shots: window.doompop.shots })');
  const n = Number(args.n ?? 8);
  const times = Array.from({ length: n }, (_, k) => Number((meta.duration * (k + 0.37) / n).toFixed(4)));
  for (const s of meta.shots) times.push(Number((s.start + 0.05).toFixed(4)));
  const s = Number(args.samples ?? 1);
  const hash = async (p, t) => createHash('sha1').update(await p.evaluate(([t, s]) => window.doompop.pixels(t, s), [t, s])).digest('hex');
  const ha = {}; for (const t of times) ha[t] = await hash(a, t);
  const rev = [...times].reverse(); let bad = 0;
  for (const t of rev) { const h = await hash(b, t); if (h !== ha[t]) { bad++; console.log(`DIFFERS at t=${t}`); } }
  console.log(bad ? `NOT DETERMINISTIC: ${bad}/${times.length} frames differ` : `DETERMINISTIC: ${times.length} frames identical in both orders`);
  if (bad) process.exitCode = 1;
}

function readFileHead() {
  return `usage: node tools/render.mjs <video|stills|sheet|determinism|gpu> --song <slug> [options]  (see the top of tools/render.mjs)`;
}
