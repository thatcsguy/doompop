// Kinetic typography lyric layer. Each word appears only when it is sung, animates in, and sits
// in a per-line layout (position, size, motion, emphasis). Lines leave a moment after they end.
// Pure function of t like everything else: no state between frames.
import type { Frame, LyricStyle } from './types';
import type { Line } from './song';
import { clamp, easeOutBack, easeOutBounce, easeOutCubic, lerp } from './ease';
import { hash } from './rng';

export type KineticAnim = 'pop' | 'drop' | 'stamp' | 'slide' | 'type' | 'wave';

export interface WordLook {
  color?: string;
  scale?: number;
  font?: string;
  anim?: KineticAnim;
  /** Continuous wobble amount (0..1) for nervous or awkward words. */
  shake?: number;
}

export interface KineticLayout {
  x: number; y: number;          // anchor as a fraction of the frame (0..1); y is the block's vertical centre
  align: 'left' | 'center' | 'right';
  size: number;                  // px at 1080p
  maxWidth: number;              // wrap width as a fraction of the frame width
  anim: KineticAnim;
  tilt: number;                  // radians, the whole block
  color: string;
  outline: string;               // sticker outline colour
  shadow: string;                // hard drop shadow colour ('' for none)
  boxed: boolean;                // each word in its own little box (a text field look)
  box: string;                   // box fill when boxed
  hold: number;                  // seconds the line stays after it ends
  exit: 'drop' | 'fade' | 'shrink';
  /** Per-word looks, keyed by 0-based word index in the line. */
  words: Record<number, WordLook>;
  /** Word indices drawn elsewhere (in the picture, e.g. a speech bubble). */
  skip: number[];
  /** Font family for the whole line ('' = the lyric style's font). */
  font: string;
  /** Text drawn before the first word and arriving with it (a terminal prompt like '>'). */
  prompt: string;
  promptColor: string;
  transform: 'none' | 'lower' | 'upper';
  /** Fill of a rounded panel behind the words sung so far ('' = none). */
  panel: string;
  /** A blinking block cursor after the last word sung, until the line ends. */
  cursor: boolean;
  /** Lines sharing a stack id scroll up like a terminal as newer ones arrive, fading after three. */
  stack: string;
}

export interface KineticSpec {
  base?: Partial<KineticLayout>;
  /** Per-line layouts, keyed by 1-based line number. */
  lines?: Record<number, Partial<KineticLayout>>;
}

export const DEFAULT_KINETIC: KineticLayout = {
  x: 0.5, y: 0.18, align: 'center', size: 84, maxWidth: 0.7, anim: 'pop', tilt: 0,
  color: '#2b1d16', outline: '#fffaf0', shadow: 'rgba(43,29,22,0.28)', boxed: false, box: '#ffffff',
  hold: 0.35, exit: 'drop', words: {}, skip: [],
  font: '', prompt: '', promptColor: '#ffd166', transform: 'none', panel: '', cursor: false, stack: '',
};

const ANIM_IN = 0.28; // seconds for a word to arrive

/** Draw every line that is on screen at f.t. */
export function drawKinetic(g: CanvasRenderingContext2D, f: Frame, style: LyricStyle, spec: KineticSpec) {
  const lines = f.clock.lyrics.lines;
  const lays = lines.map((_, i) => ({ ...DEFAULT_KINETIC, ...spec.base, ...spec.lines?.[i + 1] } as KineticLayout));
  const firstAt = lines.map((line, i) => {
    const first = line.words.findIndex((_, k) => !lays[i].skip.includes(k));
    return first < 0 ? Infinity : line.words[first].start - 1 / 30;
  });
  lines.forEach((line, i) => {
    const lay = lays[i];
    if (f.t < firstAt[i]) return;
    if (f.t > line.end + lay.hold + 0.6) return;
    // a terminal stack: every newer line in the same stack pushes this one up a row
    let shift = 0;
    if (lay.stack) for (let j = i + 1; j < lines.length && firstAt[j] <= f.t; j++) {
      if (lays[j].stack === lay.stack) shift += easeOutCubic(clamp((f.t - firstAt[j]) / 0.16));
    }
    if (shift >= 2.6) return;
    drawLine(g, f, line, i, lay, style, shift);
  });
}

function drawLine(g: CanvasRenderingContext2D, f: Frame, line: Line, li: number, lay: KineticLayout, style: LyricStyle, shift = 0) {
  const s = f.h / 1080;
  const fam = lay.font || style.font;
  const font = (w: WordLook | undefined, px: number) => `900 ${px}px ${w?.font ?? fam}`;
  const shape = (x: string) => (lay.transform === 'lower' ? x.toLowerCase() : lay.transform === 'upper' ? x.toUpperCase() : x);
  // measure at final size so the layout never shifts as words arrive
  const items = line.words.map((w, k) => {
    const look = lay.words[k];
    const px = lay.size * (look?.scale ?? 1) * s;
    g.font = font(look, px);
    const text = shape(w.w.replace(/[“”"]/g, ''));
    return { w, k, look, px, text, width: g.measureText(text).width };
  }).filter(it => !lay.skip.includes(it.k));
  if (lay.prompt && items.length) {
    const px = lay.size * s, w0 = items[0].w;
    g.font = font(undefined, px);
    items.unshift({ w: { ...w0, end: w0.start + 0.05, w: lay.prompt }, k: -1, look: { color: lay.promptColor }, px, text: lay.prompt, width: g.measureText(lay.prompt).width });
  }
  const gap = lay.size * s * (lay.boxed ? 0.75 : 0.42); // boxes need room for their padding
  const rows: (typeof items)[] = [[]];
  let rowW = 0;
  // emphasised (scaled) words get proportionally more room so they never touch their neighbours
  const width = (it: (typeof items)[number]) => it.width + gap * (Math.max(1, it.look?.scale ?? 1) - 1);
  for (const it of items) {
    const add = (rows[rows.length - 1].length ? gap : 0) + width(it);
    if (rowW + add > lay.maxWidth * f.w && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rowW += (rows[rows.length - 1].length ? gap : 0) + width(it);
    rows[rows.length - 1].push(it);
  }
  const rowH = rows.map(r => Math.max(...r.map(it => it.px)) * 1.12);
  const totalH = rowH.reduce((a, b) => a + b, 0);
  const ax = lay.x * f.w, ay = lay.y * f.h - shift * lay.size * s * 1.5;

  g.save();
  // the newest two lines read fully; the one above them dims, then scrolls away
  g.globalAlpha = shift <= 1 ? 1 : shift <= 2 ? lerp(1, 0.45, shift - 1) : lerp(0.45, 0, clamp((shift - 2) / 0.6));
  g.translate(ax, ay);
  g.rotate(lay.tilt);
  let y = -totalH / 2;
  const sung = (it: (typeof items)[number]) => f.t >= it.w.start - 1 / 30;
  const te = line.end + lay.hold;
  const fadeOut = 1 - clamp((f.t - te) / 0.3);
  rows.forEach((row, r) => {
    const w = row.reduce((a, it, k) => a + width(it) + (k ? gap : 0), 0);
    let x = lay.align === 'left' ? 0 : lay.align === 'right' ? -w : -w / 2;
    const base = y + rowH[r] * 0.8;
    // the panel and cursor follow the words sung so far
    const vis = row.filter(sung);
    if ((lay.panel || lay.cursor) && vis.length) {
      const px = lay.size * s, pad = px * 0.32;
      const right = x + vis.reduce((a, it, k) => a + width(it) + (k ? gap : 0), 0);
      const isLast = vis.length === row.length ? r === rows.length - 1 || !rows[r + 1].some(sung) : true;
      const cur = lay.cursor && isLast && shift < 0.5 && (f.t < line.end || Math.floor(f.t * 2.5) % 2 === 0) && f.t < te;
      if (lay.panel) {
        g.save();
        g.globalAlpha *= fadeOut;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(g, x - pad + px * 0.08, base - px * 0.92 + px * 0.1, right - x + pad * 2 + (cur ? px * 0.7 : 0), px * 1.3, px * 0.22); g.fill();
        g.fillStyle = lay.panel;
        roundRect(g, x - pad, base - px * 0.92, right - x + pad * 2 + (cur ? px * 0.7 : 0), px * 1.3, px * 0.22); g.fill();
        g.restore();
      }
      if (cur) { g.fillStyle = lay.color; g.fillRect(right + px * 0.18, base - px * 0.72, px * 0.48, px * 0.82); }
    }
    row.forEach((it, order) => {
      drawWord(g, f, it, x + width(it) / 2, base, lay, li, order, line, style);
      x += width(it) + gap;
    });
    y += rowH[r];
  });
  g.restore();
}

function drawWord(
  g: CanvasRenderingContext2D, f: Frame,
  it: { w: Line['words'][number]; k: number; look?: WordLook; px: number; text: string; width: number },
  cx: number, base: number, lay: KineticLayout, li: number, order: number, line: Line, style: LyricStyle,
) {
  const t0 = it.w.start - 1 / 30;          // a frame early reads as on time
  const dt = f.t - t0;
  if (dt < 0) return;
  const anim = it.look?.anim ?? lay.anim;
  const k = clamp(dt / ANIM_IN);
  const px = it.px;
  let sx = 1, sy = 1, ox = 0, oy = 0, rot = 0, alpha = 1, chars = it.text.length;
  const settle = lay.panel ? 0 : (hash(li, it.k, 3) - 0.5) * 0.06; // each word keeps a tiny hand-placed tilt (not on a panel)
  switch (anim) {
    case 'pop': { const e = easeOutBack(k, 2.2); sx = sy = Math.max(0.001, e); rot = lerp((hash(li, it.k) - 0.5) * 0.6, settle, easeOutCubic(k)); break; }
    case 'drop': { oy = -(1 - easeOutBounce(k)) * px * 2.2; alpha = clamp(dt / 0.06); rot = settle; break; }
    case 'stamp': { const e = easeOutCubic(clamp(dt / 0.14)); sx = sy = lerp(2.4, 1, e); alpha = clamp(dt / 0.08); rot = settle + (1 - e) * 0.2; break; }
    case 'slide': { ox = -(1 - easeOutCubic(k)) * px * 1.4; alpha = clamp(dt / 0.12); rot = settle; break; }
    case 'type': { const dur = Math.max(0.12, Math.min(0.35, it.w.end - it.w.start)); chars = Math.ceil(clamp(dt / dur) * it.text.length); rot = settle; break; }
    case 'wave': { const e = easeOutBack(k, 2); sx = sy = Math.max(0.001, e); oy = Math.sin(f.t * 4.2 - order * 0.8) * px * 0.1; rot = Math.sin(f.t * 4.2 - order * 0.8 - 1) * 0.05; break; }
  }
  // the word being sung swells a little
  const sing = f.t < it.w.end ? 1 + 0.04 * Math.sin(clamp(dt / Math.max(0.1, it.w.end - it.w.start)) * Math.PI) : 1;
  sx *= sing; sy *= sing;
  const shake = it.look?.shake ?? 0;
  if (shake) { ox += Math.sin(f.t * 37 + it.k) * px * 0.03 * shake; rot += Math.sin(f.t * 23 + it.k * 2) * 0.08 * shake; }
  // exit: after the line ends (plus hold), words leave in order
  const te = line.end + lay.hold + order * 0.035;
  if (f.t > te) {
    const e = clamp((f.t - te) / 0.3);
    if (lay.exit === 'drop') { oy += e * e * px * 2.5; rot += e * (hash(li, it.k, 9) - 0.5) * 0.8; alpha *= 1 - e; }
    else if (lay.exit === 'shrink') { sx *= 1 - e; sy *= 1 - e; }
    else alpha *= 1 - e;
  }
  if (alpha <= 0.002 || sx <= 0.002) return;

  const text = it.text.slice(0, chars);
  g.save();
  g.globalAlpha *= alpha;
  g.translate(cx + ox, base + oy - px * 0.35);
  g.rotate(rot);
  g.scale(sx, sy);
  g.translate(0, px * 0.35);
  g.font = `900 ${px}px ${it.look?.font ?? (lay.font || style.font)}`;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  const left = -it.width / 2;
  if (lay.boxed) {
    const pad = px * 0.22;
    g.fillStyle = lay.shadow || 'transparent';
    roundRect(g, left - pad + px * 0.06, -px * 0.86 + px * 0.07, it.width + pad * 2, px * 1.12, px * 0.08); g.fill();
    g.fillStyle = lay.box; g.strokeStyle = lay.color; g.lineWidth = px * 0.07;
    roundRect(g, left - pad, -px * 0.86, it.width + pad * 2, px * 1.12, px * 0.08); g.fill(); g.stroke();
  } else {
    if (lay.shadow) { g.fillStyle = lay.shadow; g.lineWidth = px * 0.2; g.strokeStyle = lay.shadow; g.strokeText(text, left + px * 0.06, px * 0.07); }
    g.strokeStyle = lay.outline; g.lineWidth = px * 0.2; g.strokeText(text, left, 0);
  }
  g.fillStyle = it.look?.color ?? lay.color;
  g.fillText(text, left, 0);
  g.restore();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
