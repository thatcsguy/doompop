import type * as THREE from 'three';
import type { SongClock, AudioData, LyricsData } from './song';
import type { Stage } from './stage';
import type { KineticSpec } from './kinetic';

/** Everything a shot gets each frame. All of it is a function of song time t. */
export interface Frame {
  t: number;        // song time, seconds
  lt: number;       // time since this shot started
  dur: number;      // shot length
  p: number;        // lt / dur, 0..1
  clock: SongClock; // beats, bars, hits, envelopes, lyrics
  w: number; h: number; // output size in pixels
}

export interface PostSettings {
  bloom: number;          // bloom strength (0 = off)
  bloomRadius: number;
  bloomThreshold: number;
  grain: number;          // film grain amount
  vignette: number;
  exposure: number;
  toneMap: boolean;       // filmic tone mapping; turn off for flat-colour art so the palette stays exact
  tint: string;           // colour multiply over the final image (white = none): night blue, alarm red
  saturation: number;     // 1 = as drawn, 0 = greyscale
}

/** What a shot's build() returns. Built once, then update(f) is called for every frame. */
export interface ShotWorld {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Set EVERY animated property from f. Never accumulate (x += ...) or read the previous frame. */
  update(f: Frame): void;
  /** Optional 2D drawing on top of the 3D image (titles, HUD, graphics). Not motion-blurred.
   *  `opts.lyrics` is false when the render leaves the lyrics out (thumbnails, clean plates), so a
   *  shot that draws its own lyric layer here skips it then. */
  overlay?(g: CanvasRenderingContext2D, f: Frame, opts?: { lyrics: boolean }): void;
  /** Optional per-frame post settings; merged over the song's defaults. */
  post?(f: Frame): Partial<PostSettings>;
  /** Set false to hide the default lyric layer during this shot (e.g. when the shot draws its own). */
  lyrics?: boolean;
  /** Per-shot overrides of the song's lyric style (e.g. light text on a dark set). */
  lyricStyle?: Partial<LyricStyle>;
}

export type Transition = { type: 'cut' } | { type: 'fade'; dur: number } | { type: 'flash'; dur: number; color?: string };

export interface Shot {
  id: string;
  start: number;
  end: number;
  transition?: Transition; // how this shot comes IN
  build(stage: Stage): ShotWorld;
}

export interface LyricStyle {
  mode: 'karaoke' | 'kinetic' | 'none';
  font: string;            // CSS font family
  weight: number;
  size: number;            // px at 1080p
  color: string;           // sung words
  dim: string;             // words not yet sung
  accent: string;          // the word being sung
  bottom: number;          // px from the bottom at 1080p
  shadow: string;
}

export interface Song {
  slug: string;
  title: string;
  audioUrl: string;
  audio: AudioData;
  lyrics: LyricsData;
  shots: Shot[];
  fps?: number;                // default 60
  post?: Partial<PostSettings>;
  lyricStyle?: Partial<LyricStyle>;
  /** Per-line layouts for the kinetic lyric layer (lyricStyle.mode = 'kinetic'). */
  kinetic?: KineticSpec;
  fonts?: { family: string; url: string; weight?: string; style?: string }[];
  background?: string;         // clear colour
}

export const defineSong = (s: Song) => s;
export const defineShot = (s: Shot) => s;
