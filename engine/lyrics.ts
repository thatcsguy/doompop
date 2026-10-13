import type { Frame, LyricStyle } from './types';
import { clamp } from './ease';

export const DEFAULT_LYRIC_STYLE: LyricStyle = {
  mode: 'karaoke',
  font: 'system-ui, "Helvetica Neue", Arial, sans-serif',
  weight: 800,
  size: 56,
  color: '#ffffff',
  dim: 'rgba(255,255,255,0.35)',
  accent: '#ffd23f',
  bottom: 96,
  shadow: 'rgba(0,0,0,0.65)',
};

/**
 * Default karaoke layer: the current line, centred near the bottom.
 * Words light up at their measured sung time, never snapped to the beat.
 */
export function drawLyrics(g: CanvasRenderingContext2D, f: Frame, style: LyricStyle) {
  if (style.mode === 'none') return;
  const line = f.clock.lineAt(f.t);
  if (!line) return;
  const s = f.h / 1080;
  const size = style.size * s;
  g.save();
  g.font = `${style.weight} ${size}px ${style.font}`;
  g.textBaseline = 'alphabetic';
  const space = g.measureText(' ').width * 1.4;
  const widths = line.words.map(w => g.measureText(w.w).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (line.words.length - 1);
  // line fades in over its lead-in and out after it ends
  const alpha = clamp((f.t - (line.start - 0.25)) / 0.2) * clamp((line.end + 0.4 - f.t) / 0.25);
  let x = (f.w - total) / 2;
  const y = f.h - style.bottom * s;
  g.shadowColor = style.shadow;
  g.shadowBlur = 12 * s;
  line.words.forEach((w, i) => {
    const sung = f.t >= w.start - 1 / 30; // arrive a couple of frames early: reads as on time
    const active = f.t >= w.start - 1 / 30 && f.t < w.end;
    g.globalAlpha = alpha;
    g.fillStyle = active ? style.accent : sung ? style.color : style.dim;
    const pop = active ? 1 + 0.06 * clamp(1 - (f.t - w.start) / 0.15) : 1;
    g.save();
    g.translate(x + widths[i] / 2, y);
    g.scale(pop, pop);
    g.fillText(w.w, -widths[i] / 2, 0);
    g.restore();
    x += widths[i] + space;
  });
  g.restore();
}
