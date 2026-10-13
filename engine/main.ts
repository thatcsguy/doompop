// Entry point. ?song=<slug> picks songs/<slug>/index.ts (default: the first one found).
// ?render puts the page in render mode for tools/render.mjs; otherwise it's the preview.
import { Engine } from './engine';
import { startPreview } from './preview';
import type { Song } from './types';

const songs = import.meta.glob<{ default: Song }>('/songs/*/index.ts');

async function main() {
  const q = new URLSearchParams(location.search);
  const slugs = Object.keys(songs).map(p => p.split('/')[2]);
  const slug = q.get('song') ?? slugs.find(s => s !== 'demo') ?? slugs[0];
  const key = `/songs/${slug}/index.ts`;
  if (!songs[key]) throw new Error(`no song "${slug}". Have: ${slugs.join(', ')}`);
  const song = (await songs[key]()).default;
  song.slug = slug;
  if (q.has('fps')) song.fps = Number(q.get('fps'));

  await loadFonts(song);

  const render = q.has('render');
  const scale = Number(q.get('scale') ?? 1) * (render ? 1 : Number(q.get('res') ?? 0.5));
  const engine = new Engine(song, Math.round(1920 * scale), Math.round(1080 * scale));
  engine.buildAll();
  document.getElementById('view')!.appendChild(engine.out);

  if (render) {
    document.body.classList.add('render');
    // API used by tools/render.mjs
    (window as any).doompop = {
      duration: engine.duration,
      fps: engine.fps,
      width: engine.width,
      height: engine.height,
      shots: engine.shots.map(s => ({ id: s.id, start: s.start, end: s.end })),
      sections: song.audio.sections,
      /** Render frame at time t and return it as a data URL. */
      frame(t: number, samples = 1, shutter = 0.5, type = 'image/jpeg', quality = 0.95, lyrics = true) {
        return engine.renderAt(t, { samples, shutter, lyrics }).toDataURL(type, quality);
      },
      /** Raw RGBA pixels as base64, for exact comparisons. */
      pixels(t: number, samples = 1) {
        const c = engine.renderAt(t, { samples });
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let s = '';
        for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
        return btoa(s);
      },
      /** Z-fighting check at t (engine/zfight.ts), for tools/render.mjs zfight. */
      zfight(t: number, margin = 8, image = false) {
        return engine.zfight(t, margin, image);
      },
      gpu() {
        const gl = engine.stage.gl.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      },
    };
    (window as any).ready = true;
  } else {
    startPreview(engine, Number(q.get('t') ?? 0));
  }
}

async function loadFonts(song: Song) {
  for (const f of song.fonts ?? []) {
    const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight ?? 'normal', style: f.style ?? 'normal' });
    (document.fonts as unknown as Set<FontFace>).add(await face.load());
  }
  await document.fonts.ready;
}

main().catch(e => {
  console.error(e);
  document.getElementById('err')!.textContent = String(e?.stack ?? e);
  (window as any).renderError = String(e?.message ?? e);
});
