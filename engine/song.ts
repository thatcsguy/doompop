// Song timing data and the clock helpers shots use to sync to the music.
// Data comes from analysis/ (see analysis/README.md); shapes are documented there.

import { decay } from './ease';

export interface Section { id: string; label?: string; start: number; end: number }
export interface Impact { t: number; strength: number }
export interface AudioData {
  duration: number;
  bpm: number;
  beats: number[];        // every beat time (s), measured, so tempo drift is real
  downbeats: number[];    // bar starts
  sections: Section[];
  hits: { kick: number[]; snare: number[]; hat: number[]; impact: Impact[] };
  envelopes: { fps: number; rms: number[]; low: number[]; mid: number[]; high: number[]; vocal?: number[] };
}
export interface Word { w: string; start: number; end: number; conf?: number }
export interface Line { text: string; start: number; end: number; words: Word[]; section?: string | null }
export interface LyricsData { lines: Line[] }

/** Index of the last element <= t (or -1). */
function lastAtOrBefore(xs: number[], t: number): number {
  let lo = 0, hi = xs.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export class SongClock {
  readonly words: (Word & { line: number; index: number })[];
  constructor(readonly audio: AudioData, readonly lyrics: LyricsData) {
    this.words = lyrics.lines.flatMap((l, li) => l.words.map((w, wi) => ({ ...w, line: li, index: wi })));
  }

  get duration() { return this.audio.duration; }

  /** Fractional beat number at t (beat 0 = first measured beat). Extrapolates outside the grid. */
  beat(t: number): number { return this.fractional(this.audio.beats, t); }
  /** Fractional bar number at t. */
  bar(t: number): number { return this.fractional(this.audio.downbeats, t); }
  /** Time of beat number b (fractional ok), from the measured grid. */
  beatTime(b: number): number { return this.timeOf(this.audio.beats, b); }
  barTime(b: number): number { return this.timeOf(this.audio.downbeats, b); }

  section(t: number): Section | undefined {
    return this.audio.sections.find(s => t >= s.start && t < s.end);
  }

  /** Seconds since the most recent event in `events` at or before t (Infinity if none). */
  since(events: number[], t: number): number {
    const i = lastAtOrBefore(events, t);
    return i < 0 ? Infinity : t - events[i];
  }
  /** 1 on an event, decaying with time constant tau. Use for kick punches, flashes, etc. */
  pulse(events: number[], t: number, tau = 0.12): number { return decay(this.since(events, t), tau); }
  kick(t: number, tau = 0.12) { return this.pulse(this.audio.hits.kick, t, tau); }
  snare(t: number, tau = 0.12) { return this.pulse(this.audio.hits.snare, t, tau); }
  hat(t: number, tau = 0.06) { return this.pulse(this.audio.hits.hat, t, tau); }
  impact(t: number, tau = 0.5): number {
    const imps = this.audio.hits.impact;
    const i = lastAtOrBefore(imps.map(x => x.t), t);
    return i < 0 ? 0 : imps[i].strength * decay(t - imps[i].t, tau);
  }

  /** Loudness envelope value at t (0..1), linearly interpolated. */
  env(name: keyof AudioData['envelopes'], t: number): number {
    const e = this.audio.envelopes;
    const arr = e[name] as number[] | undefined;
    if (!arr || !arr.length) return 0;
    const x = t * e.fps, i = Math.floor(x), f = x - i;
    const a = arr[Math.max(0, Math.min(arr.length - 1, i))], b = arr[Math.max(0, Math.min(arr.length - 1, i + 1))];
    return a + (b - a) * f;
  }

  /** The lyric line showing at t (with a little lead-in), or undefined. */
  lineAt(t: number, lead = 0.25, hold = 0.4): Line | undefined {
    return this.lyrics.lines.find(l => t >= l.start - lead && t < l.end + hold);
  }
  /** Start time of a sung word: line n (1-based, as in the storyboard), word i (0-based). */
  w(n: number, i = 0): number { return this.lyrics.lines[n - 1].words[i].start; }
  /** Start / end of lyric line n (1-based). */
  lineStart(n: number): number { return this.lyrics.lines[n - 1].start; }
  lineEnd(n: number): number { return this.lyrics.lines[n - 1].end; }
  /** The word being sung at t, if any. */
  wordAt(t: number) { return this.words.find(w => t >= w.start && t < w.end); }

  private fractional(xs: number[], t: number): number {
    if (xs.length < 2) return 0;
    const i = lastAtOrBefore(xs, t);
    if (i < 0) return (t - xs[0]) / (xs[1] - xs[0]);
    if (i >= xs.length - 1) { const n = xs.length; return n - 1 + (t - xs[n - 1]) / (xs[n - 1] - xs[n - 2]); }
    return i + (t - xs[i]) / (xs[i + 1] - xs[i]);
  }
  private timeOf(xs: number[], b: number): number {
    if (xs.length < 2) return 0;
    const i = Math.floor(b), f = b - i;
    if (i < 0) return xs[0] + b * (xs[1] - xs[0]);
    if (i >= xs.length - 1) { const n = xs.length; return xs[n - 1] + (b - (n - 1)) * (xs[n - 1] - xs[n - 2]); }
    return xs[i] + f * (xs[i + 1] - xs[i]);
  }
}
