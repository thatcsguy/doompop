import { Stage, DEFAULT_POST } from './stage';
import { SongClock } from './song';
import { DEFAULT_LYRIC_STYLE, drawLyrics } from './lyrics';
import { drawKinetic } from './kinetic';
import { clamp } from './ease';
import { findZFights, type ZResult } from './zfight';
import type { Frame, PostSettings, Shot, ShotWorld, Song, LyricStyle } from './types';

export interface RenderOptions {
  samples?: number;  // sub-frames averaged for motion blur (1 = none)
  shutter?: number;  // fraction of a frame the shutter is open (0..1)
  lyrics?: boolean;  // false leaves the lyric layer out (thumbnails, clean plates)
}

/**
 * Turns a song time into a picture. renderAt(t) depends on t alone, so the
 * preview and the offline render agree, and frames can be rendered in any order.
 */
export class Engine {
  readonly clock: SongClock;
  readonly stage: Stage;
  readonly out: HTMLCanvasElement;
  readonly fps: number;
  readonly shots: Shot[];
  private frameCanvas: HTMLCanvasElement;
  private worlds = new Map<string, ShotWorld>();
  private lyricStyle: LyricStyle;
  private post: PostSettings;

  constructor(readonly song: Song, readonly width = 1920, readonly height = 1080) {
    this.clock = new SongClock(song.audio, song.lyrics);
    this.stage = new Stage(width, height, song.background);
    this.fps = song.fps ?? 60;
    this.shots = [...song.shots].sort((a, b) => a.start - b.start);
    this.out = mkCanvas(width, height);
    this.frameCanvas = mkCanvas(width, height);
    this.lyricStyle = { ...DEFAULT_LYRIC_STYLE, ...song.lyricStyle };
    this.post = { ...DEFAULT_POST, ...song.post };
    const ids = new Set<string>();
    for (const s of this.shots) {
      if (ids.has(s.id)) throw new Error(`duplicate shot id ${s.id}`);
      ids.add(s.id);
    }
  }

  get duration() { return this.song.audio.duration; }

  shotIndexAt(t: number): number {
    let i = -1;
    for (let k = 0; k < this.shots.length; k++) if (this.shots[k].start <= t) i = k;
    return Math.max(0, i);
  }
  shotAt(t: number) { return this.shots[this.shotIndexAt(t)]; }

  /** Build every shot up front so the first frame of each isn't slow (and to surface build errors early). */
  buildAll() { for (const s of this.shots) this.world(s); }

  renderAt(t: number, opts: RenderOptions = {}): HTMLCanvasElement {
    const samples = Math.max(1, Math.round(opts.samples ?? 1));
    const shutter = opts.shutter ?? 0.5;
    const o = this.out.getContext('2d')!;
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'source-over';
    // average sub-frames spread over the shutter, centred on t
    for (let k = 0; k < samples; k++) {
      const tk = samples === 1 ? t : t + ((k + 0.5) / samples - 0.5) * shutter / this.fps;
      this.composeScene(tk);
      o.globalAlpha = 1 / (k + 1);
      o.drawImage(this.frameCanvas, 0, 0);
    }
    o.globalAlpha = 1;
    // 2D layers are drawn once, sharp, at t
    const i = this.shotIndexAt(t), shot = this.shots[i], world = this.world(shot);
    const f = this.frame(shot, t);
    if (world.overlay) { o.save(); world.overlay(o, f); o.restore(); }
    if (world.lyrics !== false && opts.lyrics !== false) {
      const style = world.lyricStyle ? { ...this.lyricStyle, ...world.lyricStyle } : this.lyricStyle;
      if (style.mode === 'kinetic') drawKinetic(o, f, style, this.song.kinetic ?? {});
      else drawLyrics(o, f, style);
    }
    this.drawTransitionFlash(o, shot, t);
    return this.out;
  }

  /**
   * Z-fighting check at t (engine/zfight.ts): the pairs of surfaces too close in depth to stay put.
   * With image = true, also a PNG of the frame (no lyrics) with the fights in magenta, numbered.
   */
  zfight(t: number, margin = 8, image = false) {
    const shot = this.shotAt(t), world = this.world(shot);
    world.update(this.frame(shot, t));
    const r = findZFights(this.stage.gl, world.scene, world.camera, this.width, this.height, margin);
    return { shot: shot.id, meshes: r.meshes, pairs: r.pairs, image: image ? this.zfightImage(t, r) : '' };
  }

  private zfightImage(t: number, r: ZResult) {
    const frame = this.renderAt(t, { samples: 1, lyrics: false });
    const c = mkCanvas(this.width, this.height), g = c.getContext('2d')!;
    g.globalAlpha = 0.5; g.drawImage(frame, 0, 0); g.globalAlpha = 1;
    const img = g.getImageData(0, 0, c.width, c.height), W = c.width, H = c.height;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!r.mask[y * W + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = (yy * W + xx) * 4;
        img.data[k] = 255; img.data[k + 1] = 0; img.data[k + 2] = 255; img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.lineWidth = 2; g.font = 'bold 24px monospace';
    r.pairs.slice(0, 20).forEach((p, k) => {
      const [x0, y0, x1, y1] = p.box;
      g.strokeStyle = p.same ? '#9a9a9a' : '#ffe600';
      g.strokeRect(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10);
      g.fillStyle = g.strokeStyle; g.fillText(String(k + 1), x0 - 5, y0 - 10);
    });
    return c.toDataURL('image/png');
  }

  private composeScene(t: number) {
    const g = this.frameCanvas.getContext('2d')!;
    const i = this.shotIndexAt(t), shot = this.shots[i];
    const tr = shot.transition;
    const into = t - shot.start;
    if (tr?.type === 'fade' && i > 0 && into < tr.dur) {
      this.drawShot(g, this.shots[i - 1], t, 1);
      this.drawShot(g, shot, t, clamp(into / tr.dur));
    } else {
      this.drawShot(g, shot, t, 1);
    }
  }

  private drawShot(g: CanvasRenderingContext2D, shot: Shot, t: number, alpha: number) {
    const world = this.world(shot);
    const f = this.frame(shot, t);
    world.update(f);
    const post = { ...this.post, ...world.post?.(f) };
    this.stage.render(world.scene, world.camera, post, Math.round(t * this.fps * 8));
    g.globalAlpha = alpha;
    g.drawImage(this.stage.canvas, 0, 0, this.width, this.height);
    g.globalAlpha = 1;
  }

  private drawTransitionFlash(g: CanvasRenderingContext2D, shot: Shot, t: number) {
    const tr = shot.transition;
    if (tr?.type !== 'flash') return;
    const k = 1 - (t - shot.start) / tr.dur;
    if (k <= 0 || k > 1) return;
    g.save();
    g.globalAlpha = k * k;
    g.fillStyle = tr.color ?? '#ffffff';
    g.fillRect(0, 0, this.width, this.height);
    g.restore();
  }

  private frame(shot: Shot, t: number): Frame {
    const dur = shot.end - shot.start, lt = t - shot.start;
    return { t, lt, dur, p: dur > 0 ? lt / dur : 0, clock: this.clock, w: this.width, h: this.height };
  }

  private world(shot: Shot): ShotWorld {
    let w = this.worlds.get(shot.id);
    if (!w) { w = shot.build(this.stage); this.worlds.set(shot.id, w); }
    return w;
  }
}

function mkCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
