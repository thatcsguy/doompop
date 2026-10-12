// The disco lyric layer: every word appears only as it's sung, in one of two looks.
//   neon: chunky Shrikhand words as neon tubes (a hot pale core, a coloured glow) that flicker on
//         and pulse on the beat. For the disco lines.
//   term: Space Mono typed out letter by letter after a prompt, with a block cursor, on a dark
//         terminal strip. For the debugging lines.
// A song-local cousin of engine/kinetic.ts (same per-line layout idea, keyed by 1-based line
// number), drawn from each shot's overlay. Pure function of t: no state between frames.
import type { Frame } from '../../engine/types';
import type { Line } from '../../engine/song';
import { clamp, easeOutBack, easeOutBounce, easeOutCubic, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { DISCO_FONT, PAL, TERM_FONT, beatPulse } from './look';

export type DiscoStyle = 'neon' | 'term';
export type DiscoAnim = 'flicker' | 'pop' | 'drop' | 'stamp' | 'slide' | 'type';

export interface DiscoWord {
  color?: string;
  scale?: number;
  anim?: DiscoAnim;
  font?: string;
  /** Continuous wobble (0..1) for nervous words. */
  shake?: number;
  /** neon: how far the hot core is mixed toward white (default 0.62; lower keeps reds red). */
  core?: number;
}

export interface DiscoLayout {
  style: DiscoStyle;
  x: number; y: number;              // anchor, fractions of the frame; y is the block's centre
  align: 'left' | 'center' | 'right';
  size: number;                      // px at 1080p
  maxWidth: number;                  // wrap width, fraction of the frame width
  tilt: number;                      // radians, the whole block
  color: string;                     // neon tube colour, or terminal text colour
  anim: DiscoAnim;
  hold: number;                      // seconds the line stays after it ends
  exit: 'flicker' | 'drop' | 'fade' | 'scroll';
  prompt: string;                    // term: drawn before the first word
  panel: boolean;                    // term: dark strip behind the line
  words: Record<number, DiscoWord>;  // keyed by 0-based word index
  skip: number[];                    // words drawn elsewhere (a speech bubble, a sign in the set)
}

export interface DiscoSpec {
  base?: Partial<DiscoLayout>;
  lines?: Record<number, Partial<DiscoLayout>>;
}

export const DEFAULT_DISCO: DiscoLayout = {
  style: 'neon', x: 0.5, y: 0.16, align: 'center', size: 96, maxWidth: 0.8, tilt: -0.04,
  color: PAL.pink, anim: 'flicker', hold: 0.3, exit: 'flicker', prompt: '$ ', panel: true, words: {}, skip: [],
};

const ARRIVE = 0.26;   // seconds for a word to arrive
const LEAVE = 0.3;     // seconds for a word to leave

/** When a line starts leaving and how long it takes. A line never outstays the next one's first
 *  word: if the next line comes in before the hold is over, this one cuts away quickly just before. */
interface Exit { at: number; leave: number; stagger: number }

function exitFor(lines: Line[], i: number, lay: DiscoLayout): Exit {
  const line = lines[i];
  const at = line.end + lay.hold;
  const next = lines[i + 1]?.words[0]?.start ?? Infinity;
  if (next - 1 / 30 >= at + LEAVE) return { at, leave: LEAVE, stagger: 0.03 };
  const forced = Math.max(line.end - 0.05, Math.min(at, next - 0.1));
  return { at: forced, leave: Math.max(0.08, Math.min(LEAVE, next + 0.04 - forced)), stagger: 0.01 };
}

/** Draw every lyric line on screen at f.t. */
export function drawDiscoLyrics(g: CanvasRenderingContext2D, f: Frame, spec: DiscoSpec) {
  const lines = f.clock.lyrics.lines;
  lines.forEach((line, i) => {
    const lay = { ...DEFAULT_DISCO, ...spec.base, ...spec.lines?.[i + 1] } as DiscoLayout;
    const first = line.words.findIndex((_, k) => !lay.skip.includes(k));
    if (first < 0) return;
    if (f.t < line.words[first].start - 1 / 30) return;
    const exit = exitFor(lines, i, lay);
    if (f.t > exit.at + exit.leave + 0.4) return;
    drawLine(g, f, line, i, lay, exit);
  });
}

interface Item { w: Line['words'][number]; k: number; look?: DiscoWord; px: number; text: string; width: number; font: string }

function fontFor(lay: DiscoLayout, look: DiscoWord | undefined, px: number) {
  if (look?.font) return `400 ${px}px ${look.font}`;
  return lay.style === 'term' ? `700 ${px}px ${TERM_FONT}` : `400 ${px}px ${DISCO_FONT}`;
}

function drawLine(g: CanvasRenderingContext2D, f: Frame, line: Line, li: number, lay: DiscoLayout, exit: Exit) {
  const s = f.h / 1080;
  const items: Item[] = line.words.map((w, k) => {
    const look = lay.words[k];
    const px = lay.size * (look?.scale ?? 1) * s;
    const font = fontFor(lay, look, px);
    g.font = font;
    const text = w.w.replace(/[“”"]/g, '');
    return { w, k, look, px, text, width: g.measureText(text).width, font };
  }).filter(it => !lay.skip.includes(it.k));
  const term = lay.style === 'term';
  const gap = lay.size * s * (term ? 0.55 : 0.36);
  // the prompt takes room before the first word so the layout never shifts as words arrive
  g.font = fontFor(lay, undefined, lay.size * s);
  const promptW = term ? g.measureText(lay.prompt).width : 0;
  const width = (it: Item) => it.width + gap * (Math.max(1, it.look?.scale ?? 1) - 1);
  const rows: Item[][] = [[]];
  let rowW = promptW;
  for (const it of items) {
    const add = (rows[rows.length - 1].length ? gap : 0) + width(it);
    if (rowW + add > lay.maxWidth * f.w && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rowW += (rows[rows.length - 1].length ? gap : 0) + width(it);
    rows[rows.length - 1].push(it);
  }
  const rowWidth = (r: Item[], ri: number) => r.reduce((a, it, k) => a + width(it) + (k ? gap : 0), 0) + (ri === 0 ? promptW : 0);
  const rowH = rows.map(r => Math.max(...r.map(it => it.px)) * (term ? 1.25 : 1.1));
  const totalH = rowH.reduce((a, b) => a + b, 0);
  const blockW = Math.max(...rows.map(rowWidth));

  // exit for the whole block (terminal lines scroll up and away together)
  const out = clamp((f.t - exit.at) / exit.leave);

  g.save();
  g.translate(lay.x * f.w, lay.y * f.h);
  g.rotate(lay.tilt);
  if (term && lay.exit === 'scroll' && out > 0) {
    g.translate(0, -out * out * totalH * 0.9);
    g.globalAlpha = 1 - out;
  }
  if (term && lay.panel) drawPanel(g, f, lay, blockW, totalH, s, line);

  let y = -totalH / 2;
  let lastX = 0, lastBase = 0, lastPx = lay.size * s, typing = false, seq = 0;
  rows.forEach((row, r) => {
    const w = rowWidth(row, r);
    let x = lay.align === 'left' ? 0 : lay.align === 'right' ? -w : -w / 2;
    const base = y + rowH[r] * 0.78;
    if (r === 0 && term) {
      // the prompt appears with the first word
      if (f.t >= row[0].w.start - 1 / 30) {
        g.font = fontFor(lay, undefined, lay.size * s);
        g.fillStyle = 'rgba(160,255,200,0.55)';
        g.shadowBlur = 0;
        g.fillText(lay.prompt, x, base);
      }
      x += promptW;
    }
    row.forEach(it => {
      const drawn = drawWord(g, f, it, x, base, lay, li, exit.at + seq++ * exit.stagger, exit.leave);
      if (drawn) { lastX = x + drawn.w; lastBase = base; lastPx = it.px; typing = drawn.typing; }
      x += width(it) + gap;
    });
    y += rowH[r];
  });
  // the block cursor follows the last typed letter; it blinks once the line has been sung
  if (term && lastX !== 0 && out < 1) {
    const blinkOn = typing || f.t < line.end || Math.floor((f.t - line.end) * 3.2) % 2 === 0;
    if (blinkOn) {
      g.shadowColor = lay.color; g.shadowBlur = lastPx * 0.4;
      g.fillStyle = lay.color;
      g.fillRect(lastX + lastPx * 0.12, lastBase - lastPx * 0.78, lastPx * 0.55, lastPx * 0.92);
      g.shadowBlur = 0;
    }
  }
  g.restore();
}

/** The dark terminal strip behind a typed line, with a thin phosphor border and window dots. */
function drawPanel(g: CanvasRenderingContext2D, f: Frame, lay: DiscoLayout, w: number, h: number, s: number, line: Line) {
  const t0 = line.words[0].start - 0.08;
  const k = easeOutCubic(clamp((f.t - t0) / 0.18));
  if (k <= 0) return;
  const padX = lay.size * s * 0.45, padY = lay.size * s * 0.32;
  const x0 = lay.align === 'left' ? -padX : lay.align === 'right' ? -w - padX : -w / 2 - padX;
  const pw = (w + padX * 2 + lay.size * s * 0.7) * lerp(0.2, 1, k), ph = h + padY * 2;
  const x = lay.align === 'right' ? x0 + (w + padX * 2) - pw + lay.size * s * 0.7 : lay.align === 'center' ? -pw / 2 : x0;
  g.save();
  g.globalAlpha *= k;
  g.fillStyle = 'rgba(2,10,8,0.92)';
  g.beginPath(); g.roundRect(x, -h / 2 - padY, pw, ph, lay.size * s * 0.18); g.fill();
  g.strokeStyle = 'rgba(69,255,138,0.45)'; g.lineWidth = Math.max(1.5, 2.5 * s);
  g.stroke();
  // scanlines
  g.beginPath(); g.roundRect(x, -h / 2 - padY, pw, ph, lay.size * s * 0.18); g.clip();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let yy = -h / 2 - padY; yy < h / 2 + padY; yy += 5 * s) g.fillRect(x, yy, pw, 2 * s);
  g.restore();
  void f;
}

/** Draw one word. Returns the drawn width (for the cursor) or null if not visible yet. */
function drawWord(g: CanvasRenderingContext2D, f: Frame, it: Item, left: number, base: number, lay: DiscoLayout, li: number, te: number, leave: number) {
  const t0 = it.w.start - 1 / 30;           // a frame early reads as on time
  const dt = f.t - t0;
  if (dt < 0) return null;
  const term = lay.style === 'term';
  const anim = it.look?.anim ?? (term ? 'type' : lay.anim);
  const k = clamp(dt / ARRIVE);
  const px = it.px;
  let sx = 1, sy = 1, ox = 0, oy = 0, rot = 0, alpha = 1, chars = it.text.length, glow = 1, typing = false;
  const settle = term ? 0 : (hash(li, it.k, 3) - 0.5) * 0.07;
  switch (anim) {
    case 'flicker': {
      // a neon tube catching: on, off, on, dim, on
      const on = [[0, 1], [0.035, 0.1], [0.07, 1], [0.11, 0.35], [0.14, 1]];
      let lvl = 1;
      for (const [at, v] of on) if (dt >= at) lvl = v;
      alpha = lvl; glow = lvl;
      const e = easeOutBack(clamp(dt / 0.2), 2.4);
      sx = sy = lerp(0.82, 1, e);
      rot = settle;
      break;
    }
    case 'pop': { const e = easeOutBack(k, 2.2); sx = sy = Math.max(0.001, e); rot = lerp((hash(li, it.k) - 0.5) * 0.6, settle, easeOutCubic(k)); break; }
    case 'drop': { oy = -(1 - easeOutBounce(k)) * px * 2.0; alpha = clamp(dt / 0.06); rot = settle; break; }
    case 'stamp': { const e = easeOutCubic(clamp(dt / 0.14)); sx = sy = lerp(2.3, 1, e); alpha = clamp(dt / 0.08); rot = settle + (1 - e) * 0.18; glow = 1 + (1 - e) * 1.2; break; }
    case 'slide': { ox = -(1 - easeOutCubic(k)) * px * 1.3; alpha = clamp(dt / 0.12); rot = settle; break; }
    case 'type': {
      const dur = Math.max(0.1, Math.min(0.4, it.w.end - it.w.start));
      chars = Math.ceil(clamp(dt / dur) * it.text.length);
      typing = dt < dur;
      rot = settle;
      break;
    }
  }
  // neon breathes with the beat once it has arrived
  const pulse = term ? 0 : beatPulse(f.clock, f.t, 0.3) * clamp((dt - 0.2) / 0.2);
  sx *= 1 + 0.035 * pulse; sy *= 1 + 0.035 * pulse;
  glow *= 0.85 + 0.5 * pulse;
  const shake = it.look?.shake ?? 0;
  if (shake) { ox += Math.sin(f.t * 37 + it.k) * px * 0.03 * shake; rot += Math.sin(f.t * 23 + it.k * 2) * 0.07 * shake; }

  // exit (term lines scroll as a block in drawLine; the rest leave word by word)
  if (f.t > te && !(term && lay.exit === 'scroll')) {
    const e = clamp((f.t - te) / leave);
    if (lay.exit === 'drop') { oy += e * e * px * 2.4; rot += e * (hash(li, it.k, 9) - 0.5) * 0.8; alpha *= 1 - e; }
    else if (lay.exit === 'flicker') {
      const lvl = e < 0.25 ? 1 : e < 0.4 ? 0.15 : e < 0.55 ? 0.8 : e < 0.7 ? 0.1 : e < 0.8 ? 0.4 : 0;
      alpha *= lvl; glow *= lvl;
    } else alpha *= 1 - e;
  }
  if (alpha <= 0.002 || sx <= 0.002) return null;

  const text = it.text.slice(0, chars);
  const color = it.look?.color ?? lay.color;
  g.save();
  g.globalAlpha *= alpha;
  const cx = left + it.width / 2;
  g.translate(cx + ox, base + oy - px * 0.35);
  g.rotate(rot);
  g.scale(sx, sy);
  g.translate(-it.width / 2, px * 0.35);
  g.font = it.font;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.lineJoin = 'round';
  if (term) {
    g.shadowColor = color; g.shadowBlur = px * 0.35 * glow;
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(235,255,240,0.55)';
    g.fillText(text, 0, 0);
  } else {
    // dark backing so the tube reads over bright floors, then the glow, then the hot core
    g.strokeStyle = PAL.ink; g.lineWidth = px * 0.17;
    g.strokeText(text, 0, 0);
    g.shadowColor = color;
    g.shadowBlur = px * 0.55 * glow;
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.shadowBlur = px * 0.18 * glow;
    g.fillText(text, 0, 0);
    g.shadowBlur = 0;
    g.fillStyle = mixWhite(color, it.look?.core ?? 0.62);
    g.fillText(text, 0, 0);
    // a thin bright tube line along the letters
    g.strokeStyle = mixWhite(color, 0.88); g.lineWidth = Math.max(1, px * 0.025);
    g.globalAlpha *= 0.6;
    g.strokeText(text, 0, 0);
  }
  g.restore();
  return { w: ctxWidth(g, it, chars), typing };
}

function ctxWidth(g: CanvasRenderingContext2D, it: Item, chars: number) {
  g.font = it.font;
  return g.measureText(it.text.slice(0, chars)).width;
}

const mixCache = new Map<string, string>();
/** A colour mixed toward white by k (0..1), as a CSS rgb() string. */
export function mixWhite(hex: string, k: number) {
  const key = hex + k;
  let c = mixCache.get(key);
  if (!c) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    c = `rgb(${Math.round(lerp(r, 255, k))},${Math.round(lerp(gg, 255, k))},${Math.round(lerp(b, 255, k))})`;
    mixCache.set(key, c);
  }
  return c;
}
