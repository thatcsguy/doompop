// The server room for verse 2 (and later the bridge): night, lit by screens and rack LEDs. A wall of
// six big NOC screens over low cabinets, racks along the back and side walls, two archways onto
// aisles of racks running off into the dark, a cable tray with a queue of packets overhead and a
// red digital clock. Clawd's console desk is front and centre with an empty chair; the DEPLOY
// pedestal stands to its right. Every shot builds its own copy; reset(f) restores the shared parts.
//
// Units match the office: floor at y = 0, desk tops at DESK_Y, Clawd 1.1 tall. The back wall is at
// BACK_Z; x grows to the right.
import * as THREE from 'three';
import type { Frame } from '../../engine/types';
import { INK, canvasPlane, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { Clawd } from '../../engine/characters/clawd';
import { hash } from '../../engine/rng';
import { clamp, lerp } from '../../engine/ease';
import { FONT, MONO } from './world';
import { DESK_Y } from './office';
import { bigButton, glow, keyRing, coffeeMug, pick, wearTag, type BigButton } from './props';

export const BACK_Z = -4;
export const NOC = { cols: 3, rows: 2, w: 2.4, h: 1.5, gap: 0.2, y: 4.05, z: BACK_Z + 0.1 };
export const CONSOLE = { monitorX: -0.55, screenY: 2.42, clawdX: -1.75, clawdZ: 0.25 };
export const PEDESTAL = { x: 3.4, z: 0.7 };
export const RACK = { w: 1.5, h: 4.3 };
export { DESK_Y };

/** Centre of NOC screen i (row-major from the top left). */
export function nocCenter(i: number) {
  const c = i % NOC.cols, r = Math.floor(i / NOC.cols);
  return new THREE.Vector3((c - 1) * (NOC.w + NOC.gap), NOC.y + (0.5 - r) * (NOC.h + NOC.gap), NOC.z + 0.03);
}

export type ScreenDraw = (c: CanvasRenderingContext2D, f: Frame, W: number, H: number) => void;

/** The wall clock: 23:12 at the top of verse 2, 3:00 on "So I stayed up", then on into the small hours. */
export function nightClock(t: number) {
  const m = t < 79.2 ? lerp(23 * 60 + 12, 27 * 60, clamp((t - 62.2) / 17)) : 27 * 60 + (t - 79.2) * 2.2;
  const mm = Math.floor(m) % (24 * 60);
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}${Math.floor(t * 2) % 2 ? ':' : ' '}${String(mm % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Screen painters, shared by the NOC wall and the shots' close-ups. All draw on a dark screen.

export const SCREEN_BG = '#0f1424';
export function screenFrame(c: CanvasRenderingContext2D, W: number, H: number, title: string, accent = '#5fd0ff') {
  c.fillStyle = SCREEN_BG; c.fillRect(0, 0, W, H);
  c.fillStyle = '#1b2440'; c.fillRect(0, 0, W, H * 0.13);
  c.fillStyle = accent; c.fillRect(0, H * 0.13 - H * 0.012, W, H * 0.012);
  c.fillStyle = '#c9d6ff'; c.font = `700 ${H * 0.075}px ${MONO}`; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText(title, W * 0.04, H * 0.068);
  c.fillStyle = '#5cd17a'; c.beginPath(); c.arc(W * 0.95, H * 0.068, H * 0.025, 0, Math.PI * 2); c.fill();
}

/** An axis label rounded to two significant figures: 0, 4.5, 120, 3.2k. */
function axisLabel(v: number) {
  if (v <= 0) return '0';
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1), r = Math.round(v / p) * p;
  return r >= 1000 ? `${Math.round(r / 100) / 10}k` : `${Math.round(r * 10) / 10}`;
}

/** A line graph trending up, scrolling left with time. bounds > 1 squashes it (the range widening). */
export function drawGraph(c: CanvasRenderingContext2D, W: number, H: number, t: number, o: { seed: number; color?: string; title?: string; bounds?: number; trend?: number }) {
  screenFrame(c, W, H, o.title ?? 'requests/s', o.color ?? '#5fd0ff');
  const x0 = W * 0.1, x1 = W * 0.96, y0 = H * 0.88, y1 = H * 0.2, b = o.bounds ?? 1;
  c.strokeStyle = 'rgba(201,214,255,0.12)'; c.lineWidth = H * 0.006;
  for (let i = 0; i <= 4; i++) { const y = lerp(y0, y1, i / 4); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
  c.fillStyle = 'rgba(201,214,255,0.55)'; c.font = `600 ${H * 0.055}px ${MONO}`; c.textAlign = 'right';
  const top = 10 * b;
  for (let i = 0; i <= 4; i += 2) c.fillText(axisLabel(top * i / 4), x0 - W * 0.015, lerp(y0, y1, i / 4));
  const N = 40, scroll = t * 1.5;
  const val = (i: number) => {
    const k = (i + scroll) / N;
    return clamp(0.15 + (o.trend ?? 0.55) * ((i / N) ** 1.3) + Math.sin(k * 9 + o.seed) * 0.05 + (hash(o.seed, Math.floor(i + scroll)) - 0.5) * 0.08, 0.02, 1.4);
  };
  const pts = Array.from({ length: N + 1 }, (_, i) => [lerp(x0, x1, i / N), y0 - (y0 - y1) * val(i) / b] as const);
  const grad = c.createLinearGradient(0, y1, 0, y0);
  grad.addColorStop(0, (o.color ?? '#5fd0ff') + '55'); grad.addColorStop(1, (o.color ?? '#5fd0ff') + '00');
  c.fillStyle = grad; c.beginPath(); c.moveTo(x0, y0); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(x1, y0); c.fill();
  c.strokeStyle = o.color ?? '#5fd0ff'; c.lineWidth = H * 0.018; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  const [lx, ly] = pts[N];
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(lx, ly, H * 0.022, 0, Math.PI * 2); c.fill();
}

const LOG_WORDS = ['GET /api/help 200', 'deploy ok', 'cache warm', 'queue drained', 'job 4812 done', 'health: ok', 'POST /chat 200', 'rotated keys', 'backup ok', 'scaled to 12', 'cron: ran', 'GET /status 200'];
/** Scrolling log lines. */
export function drawLogs(c: CanvasRenderingContext2D, W: number, H: number, t: number, seed: number, rate = 4) {
  screenFrame(c, W, H, 'logs', '#7be08d');
  c.font = `600 ${H * 0.06}px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const lh = H * 0.075, rows = 10, scroll = t * rate, top = Math.floor(scroll), frac = scroll - top;
  c.save(); c.beginPath(); c.rect(0, H * 0.14, W, H * 0.86); c.clip();
  for (let r = 0; r < rows + 1; r++) {
    const n = top + r, y = H * 0.24 + (r - frac) * lh;
    const lvl = hash(seed, n, 2);
    c.fillStyle = 'rgba(201,214,255,0.4)';
    c.fillText(`${String(10 + (n % 50)).padStart(2, '0')}:${String((n * 7) % 60).padStart(2, '0')}`, W * 0.04, y);
    c.fillStyle = lvl > 0.93 ? '#f2c14e' : '#7be08d';
    c.fillText(lvl > 0.93 ? 'WARN' : 'INFO', W * 0.22, y);
    c.fillStyle = '#c9d6ff';
    c.fillText(LOG_WORDS[Math.floor(hash(seed, n) * LOG_WORDS.length)], W * 0.36, y);
  }
  c.restore();
}

/** A grid of service tiles, nearly all green. */
export function drawStatus(c: CanvasRenderingContext2D, W: number, H: number, t: number, seed: number) {
  screenFrame(c, W, H, 'services', '#5cd17a');
  const cols = 8, rows = 4, pw = W * 0.92 / cols, ph = H * 0.78 / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const amber = hash(seed, r, k, Math.floor(t * 0.7)) > 0.94;
    c.fillStyle = amber ? '#f2c14e' : '#2f9e5b';
    c.beginPath(); c.roundRect(W * 0.04 + k * pw + pw * 0.08, H * 0.18 + r * ph + ph * 0.1, pw * 0.84, ph * 0.8, H * 0.02); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(W * 0.04 + k * pw + pw * 0.2, H * 0.18 + r * ph + ph * 0.45, pw * 0.5, ph * 0.08);
  }
}

/** Bars rising and falling with the music. */
export function drawBars(c: CanvasRenderingContext2D, W: number, H: number, t: number, seed: number, title = 'throughput') {
  screenFrame(c, W, H, title, '#c9a7eb');
  const n = 14, bw = W * 0.86 / n;
  for (let i = 0; i < n; i++) {
    const v = 0.25 + 0.6 * Math.abs(Math.sin(t * 2.2 + i * 0.7 + seed)) * (0.5 + 0.5 * hash(seed, i));
    c.fillStyle = i % 2 ? '#c9a7eb' : '#9d7fd6';
    c.fillRect(W * 0.07 + i * bw + bw * 0.15, H * 0.9 - v * H * 0.66, bw * 0.7, v * H * 0.66);
  }
}

/** Two gauges (cpu, memory). */
export function drawGauges(c: CanvasRenderingContext2D, W: number, H: number, t: number, seed: number) {
  screenFrame(c, W, H, 'cpu / mem', '#ffd166');
  [0, 1].forEach(i => {
    const cx = W * (0.28 + i * 0.44), cy = H * 0.72, r = H * 0.36;
    c.lineWidth = H * 0.07; c.lineCap = 'round';
    c.strokeStyle = '#26304f'; c.beginPath(); c.arc(cx, cy, r, Math.PI, Math.PI * 2); c.stroke();
    const v = 0.45 + Math.sin(t * 0.9 + i * 2 + seed) * 0.15 + i * 0.1;
    c.strokeStyle = v > 0.7 ? '#f2c14e' : '#5cd17a'; c.beginPath(); c.arc(cx, cy, r, Math.PI, Math.PI * (1 + v)); c.stroke();
    c.fillStyle = '#c9d6ff'; c.font = `700 ${H * 0.12}px ${MONO}`; c.textAlign = 'center';
    c.fillText(`${Math.round(v * 100)}%`, cx, cy - H * 0.04);
  });
}

// syntax-coloured code for the terminal and editor
export const CODE = [
  'export async function help(task) {', '  const plan = await think(task);', '  for (const step of plan) {', '    if (!step.safe) continue;',
  '    await run(step);', '  }', '  return { ok: true };', '}', '', 'function think(task) {', '  return split(task).map(fix);', '}', '',
  'async function deploy(build) {', '  await push(build, "prod");', '  log("shipped");', '}', '',
];
const KW = new Set(['export', 'async', 'function', 'const', 'await', 'for', 'of', 'if', 'continue', 'return', 'true']);
export function drawCodeLine(c: CanvasRenderingContext2D, line: string, x: number, y: number, chars = Infinity) {
  const cw = c.measureText('M').width;
  let col = 0;
  for (const tok of line.slice(0, chars).match(/\s+|[A-Za-z_]+|"[^"]*"?|./g) ?? []) {
    const word = /^[A-Za-z_]+$/.test(tok);
    const next = line[col + tok.length];
    c.fillStyle = KW.has(tok) ? '#ff7ab6' : tok.startsWith('"') ? '#b5e48c' : word && next === '(' ? '#8fd3ff' : word ? '#e6e9f5' : '#9aa6c8';
    c.fillText(tok, x + col * cw, y);
    col += tok.length;
  }
}

/** A code editor scrolling slowly, the console monitor's default. */
export function drawEditor(c: CanvasRenderingContext2D, W: number, H: number, t: number, rate = 2.5) {
  c.fillStyle = '#10141f'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#161c2e'; c.fillRect(0, 0, W * 0.08, H);
  c.font = `700 ${H * 0.062}px ${MONO}`; c.textBaseline = 'top'; c.textAlign = 'left';
  const n = t * rate, shown = Math.floor(n), rows = 12, first = Math.max(0, shown - rows + 1), lh = H * 0.078;
  for (let i = first; i <= shown; i++) {
    const y = H * 0.05 + (i - first) * lh;
    c.fillStyle = 'rgba(154,166,200,0.5)'; c.fillText(String((i % 99) + 1).padStart(2, ' '), W * 0.01, y);
    const line = CODE[i % CODE.length];
    drawCodeLine(c, line, W * 0.1, y, i === shown ? Math.floor((n - shown) * line.length) : Infinity);
  }
}

// ---------------------------------------------------------------------------------------------
// Racks: three face designs, shared by every rack; their LEDs blink from one canvas per design.

interface Unit { y: number; h: number; kind: 'srv' | 'disk' | 'switch' | 'blank' }
function rackUnits(v: number): Unit[] {
  const out: Unit[] = [];
  let y = 0.08;
  const H = RACK.h - 0.34;
  let i = 0;
  while (y < H - 0.2) {
    const r = hash(v, i, 501);
    const kind: Unit['kind'] = r < 0.45 ? 'srv' : r < 0.65 ? 'disk' : r < 0.85 ? 'switch' : 'blank';
    const h = kind === 'disk' ? 0.52 : kind === 'srv' && hash(v, i, 502) > 0.5 ? 0.36 : 0.18;
    if (y + h > H - 0.05) break;
    out.push({ y, h, kind });
    y += h + 0.035;
    i++;
  }
  return out;
}

function rackKit() {
  const FW = RACK.w - 0.2, FH = RACK.h - 0.34;
  const designs = [0, 1, 2].map(v => {
    const units = rackUnits(v);
    const face = staticPlane(FW, FH, 70, (c, W, H) => {
      const u = W / FW;
      c.fillStyle = '#141a2c'; c.fillRect(0, 0, W, H);
      for (const un of units) {
        const y = un.y * u, h = un.h * u;
        c.fillStyle = un.kind === 'blank' ? '#2a3150' : '#353d5e';
        c.beginPath(); c.roundRect(0.04 * u, y, W - 0.08 * u, h, 0.02 * u); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0.04 * u, y, W - 0.08 * u, 0.02 * u);
        c.fillStyle = '#9aa1b5'; c.fillRect(0.06 * u, y + h * 0.25, 0.04 * u, h * 0.5); c.fillRect(W - 0.1 * u, y + h * 0.25, 0.04 * u, h * 0.5);
        if (un.kind === 'srv') {
          c.fillStyle = '#20263b';
          for (let k = 0; k < 9; k++) c.fillRect((0.16 + k * 0.07) * u, y + h * 0.2, 0.035 * u, h * 0.6);
        } else if (un.kind === 'disk') {
          for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#2b3252' : '#262d4a'; c.fillRect((0.15 + k * 0.12) * u, y + 0.05 * u, 0.1 * u, h - 0.1 * u); }
        } else if (un.kind === 'switch') {
          c.fillStyle = '#0d1120';
          for (let k = 0; k < 12; k++) for (let r = 0; r < 2; r++) c.fillRect((0.15 + k * 0.075) * u, y + (0.035 + r * 0.07) * u, 0.05 * u, 0.045 * u);
        }
      }
    });
    const leds = canvasPlane<Frame>(FW, FH, 48, (c, f, W, H) => {
      const u = W / FW;
      units.forEach((un, ui) => {
        const y = un.y * u, h = un.h * u;
        if (un.kind === 'blank') return;
        if (un.kind === 'switch') {
          for (let k = 0; k < 12; k++) {
            const on = hash(v, ui, k, Math.floor(f.t * (6 + hash(v, ui, k) * 8))) > 0.35;
            if (!on) continue;
            c.fillStyle = hash(v, ui, k, 9) > 0.85 ? '#ffb347' : '#6dff8a';
            c.fillRect((0.155 + k * 0.075) * u, y + 0.01 * u, 0.04 * u, 0.02 * u);
          }
          return;
        }
        if (un.kind === 'disk') {
          for (let k = 0; k < 8; k++) {
            const on = hash(v, ui, k, Math.floor(f.t * (3 + hash(v, ui, k, 1) * 9))) > 0.4;
            c.fillStyle = on ? '#6fd3ff' : '#22406a';
            c.fillRect((0.17 + k * 0.12) * u, y + h - 0.1 * u, 0.06 * u, 0.04 * u);
          }
          return;
        }
        // server: power (steady green), activity (blinking), status (mostly blue, the odd amber)
        const lx = W - 0.38 * u, ly = y + h / 2;
        const dot = (x: number, col: string, r = 0.035) => { c.fillStyle = col; c.beginPath(); c.arc(x, ly, r * u, 0, Math.PI * 2); c.fill(); };
        dot(lx, '#6dff8a');
        if (hash(v, ui, Math.floor(f.t * (5 + hash(v, ui) * 10))) > 0.3) dot(lx + 0.1 * u, '#ffe27a');
        dot(lx + 0.2 * u, hash(v, ui, Math.floor(f.t * 0.5)) > 0.92 ? '#ffb347' : '#5fb8ff');
      });
    });
    return { face, leds };
  });
  const bodyMat = ownMat('#262c46'), capMat = ownMat('#1d2238');
  return {
    /** One rack, origin on the floor under its centre, facing +z. */
    make(v: number, mirror = false) {
      const g = new THREE.Group();
      const d = designs[v % designs.length];
      const body = inkedRect(RACK.w, RACK.h, 0.03, bodyMat, 0.055);
      body.position.y = RACK.h / 2;
      const cap = shapeMesh(roundedRectShape(RACK.w, 0.14, 0.02, 0, RACK.h - 0.07), capMat, 0.004);
      const face = new THREE.Mesh(d.face.geometry, d.face.material);
      const leds = new THREE.Mesh(d.leds.mesh.geometry, d.leds.mesh.material);
      face.position.set(0, (RACK.h - 0.34) / 2 + 0.13, 0.006);
      leds.position.set(0, (RACK.h - 0.34) / 2 + 0.13, 0.008);
      if (mirror) { face.scale.x = -1; leds.scale.x = -1; }
      const flash = shapeMesh(roundedRectShape(RACK.w - 0.1, RACK.h - 0.2, 0.02, 0, RACK.h / 2), ownMat('#bff3ff', 0, true), 0.01);
      g.add(body, cap, face, leds, flash);
      for (const sx of [-1, 1]) { const foot = inkedRect(0.2, 0.08, 0.01, '#141a2c', 0.03); foot.position.set(sx * 0.55, 0.0, -0.005); g.add(foot); }
      return Object.assign(g, { flash: flash.material as THREE.MeshBasicMaterial });
    },
    update(f: Frame) { for (const d of designs) d.leds.update(f); },
  };
}

/** A painted aisle of racks running off into the dark, seen through an archway. */
function aisleView(w: number, h: number, seed: number) {
  return canvasPlane<Frame>(w, h, 60, (c, f, W, H) => {
    const vx = W / 2, vy = H * 0.42;
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0b0f1c'); grad.addColorStop(0.42, '#1a2c4a'); grad.addColorStop(1, '#0d1220');
    c.fillStyle = grad; c.fillRect(0, 0, W, H);
    // the far end glows
    const g2 = c.createRadialGradient(vx, vy, 0, vx, vy, W * 0.5);
    g2.addColorStop(0, 'rgba(120,200,255,0.35)'); g2.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = g2; c.fillRect(0, 0, W, H);
    // racks on both sides, slices from near (z = 1) to far
    for (let i = 14; i >= 0; i--) {
      const z0 = 1 + i * 0.55, z1 = z0 + 0.5;
      for (const side of [-1, 1]) {
        const xn = vx + side * W * 0.62 / z0, xf = vx + side * W * 0.62 / z1;
        const tn = vy - H * 0.75 / z0, tf = vy - H * 0.75 / z1, bn = vy + H * 0.62 / z0, bf = vy + H * 0.62 / z1;
        c.fillStyle = i % 2 ? '#232a46' : '#1f2540';
        c.beginPath(); c.moveTo(xn, tn); c.lineTo(xf, tf); c.lineTo(xf, bf); c.lineTo(xn, bn); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke();
        for (let k = 0; k < 7; k++) {
          const on = hash(seed, i, side, k, Math.floor(f.t * (2 + hash(seed, i, k) * 6))) > 0.45;
          if (!on) continue;
          const yy = lerp(tn, bn, 0.12 + k * 0.12), xx = lerp(xn, xf, 0.5);
          c.fillStyle = pick(['#6dff8a', '#5fb8ff', '#6dff8a', '#ffe27a'], seed, i, k);
          c.fillRect(xx - 1, yy, Math.max(1.5, 3 / z0), Math.max(1.5, 3 / z0));
        }
      }
      // ceiling light strip
      c.fillStyle = `rgba(210,240,255,${0.5 / (1 + i * 0.3)})`;
      c.fillRect(vx - W * 0.08 / z0, vy - H * 0.74 / z0, W * 0.16 / z0, Math.max(1, H * 0.02 / z0));
    }
  });
}

export interface ServerRoom {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clawd: Clawd;
  /** Parent of Clawd's root; scale or move it to resize him (setPose owns his root's scale). */
  rig: THREE.Group;
  /** Draw functions for the six NOC screens, row-major from the top left; replace to change them. */
  screens: ScreenDraw[];
  /** The console monitor's draw function; replace to change it. */
  monitor: { draw: ScreenDraw };
  button: BigButton;
  /** The key ring on Clawd's side (null unless built with keys). */
  keys: ReturnType<typeof keyRing> | null;
  mug: ReturnType<typeof coffeeMug>;
  /** Everything on the console desk. */
  desk: THREE.Group;
  /** Optional wave of light across the racks: a function of t giving the wave front's x (or null). */
  ledWave: ((t: number) => number | null) | null;
  /** Call first in update(): resets the shared parts and animates the room. */
  reset(f: Frame): void;
  aim(x: number, y: number, z: number, tx: number, ty: number, tz: number): void;
}

export function buildServerRoom(opts: { tagged?: boolean; keys?: boolean; nocPPU?: number; monitorPPU?: number; days?: number } = {}): ServerRoom {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10142a');
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); scene.add(o); return o; };

  // raised floor: big tiles, some perforated
  const fc = document.createElement('canvas');
  const FU = 20, FWD = 44, FDP = 30; // px per unit, floor width, depth
  fc.width = FWD * FU; fc.height = FDP * FU;
  {
    const c = fc.getContext('2d')!, T = 1.2 * FU;
    c.fillStyle = '#29304d'; c.fillRect(0, 0, fc.width, fc.height);
    for (let i = 0; i * T < fc.width; i++) for (let j = 0; j * T < fc.height; j++) {
      const perf = hash(i, j, 611) > 0.8;
      c.fillStyle = perf ? '#303859' : (i + j) % 2 ? '#2b3250' : '#283049';
      c.fillRect(i * T, j * T, T, T);
      if (perf) { c.fillStyle = '#20263d'; for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) c.fillRect(i * T + (a + 0.7) * T / 6, j * T + (b + 0.7) * T / 6, 2, 2); }
      c.fillStyle = '#1b2036'; c.fillRect(i * T, j * T, T, 1.5); c.fillRect(i * T, j * T, 1.5, T);
    }
  }
  const ftex = new THREE.CanvasTexture(fc);
  ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FWD, FDP), new THREE.MeshBasicMaterial({ map: ftex }));
  floor.rotation.x = -Math.PI / 2;
  add(floor, 0, 0, BACK_Z + FDP / 2);
  // pools of screen light on the floor
  const pool = glow(1, '#5fd0ff', 0.12);
  pool.rotation.x = -Math.PI / 2; pool.scale.set(5.5, 2.2, 1);
  add(pool, 0, 0.01, BACK_Z + 1.6);

  // back wall with panel seams, a ceiling
  add(shapeMesh(roundedRectShape(60, 12, 0, 0, 6), '#1a2038', 0), 0, 0, BACK_Z - 0.06);
  for (let x = -27; x <= 27; x += 2.5) add(shapeMesh(roundedRectShape(0.05, 12, 0, 0, 6), '#141a2e', 0), x, 0, BACK_Z - 0.05);
  add(shapeMesh(roundedRectShape(60, 0.3, 0, 0, 0.15), '#121729', 0), 0, 0, BACK_Z - 0.04);
  const ceil = shapeMesh(roundedRectShape(60, 40, 0), '#0e1222', 0);
  ceil.rotation.x = Math.PI / 2;
  add(ceil, 0, 7.6, BACK_Z + 20);
  for (let z = -1; z < 14; z += 4.5) for (const x of [-6, 0, 6]) {
    const panel = shapeMesh(roundedRectShape(2.6, 0.7, 0.05), '#d6f1ff', 0);
    panel.rotation.x = Math.PI / 2;
    add(panel, x, 7.58, z);
  }

  // NOC wall: six screens in a bezel frame, over low cabinets
  const nw = NOC.cols * NOC.w + (NOC.cols - 1) * NOC.gap, nh = NOC.rows * NOC.h + (NOC.rows - 1) * NOC.gap;
  add(inkedRect(nw + 0.4, nh + 0.4, 0.05, '#2b3150', 0.07), 0, NOC.y, NOC.z - 0.03);
  const nocGlow = glow(1, '#5fd0ff', 0.14); nocGlow.scale.set(6.5, 3.4, 1);
  add(nocGlow, 0, NOC.y, NOC.z - 0.05);
  const screens: ScreenDraw[] = [
    (c, f, W, H) => drawGraph(c, W, H, f.t, { seed: 1, title: 'requests/s' }),
    (c, f, W, H) => drawLogs(c, W, H, f.t, 2),
    (c, f, W, H) => drawStatus(c, W, H, f.t, 3),
    (c, f, W, H) => drawBars(c, W, H, f.t, 4),
    (c, f, W, H) => drawGauges(c, W, H, f.t, 5),
    (c, f, W, H) => drawGraph(c, W, H, f.t, { seed: 6, color: '#7be08d', title: 'users online', trend: 0.7 }),
  ];
  const nocPlanes = screens.map((_, i) => {
    const p = canvasPlane<Frame>(NOC.w, NOC.h, opts.nocPPU ?? 120, (c, f, W, H) => room.screens[i](c, f, W, H));
    p.mesh.position.copy(nocCenter(i));
    const bez = inkedRect(NOC.w + 0.08, NOC.h + 0.08, 0.02, '#0b0e18', 0.03);
    bez.position.copy(nocCenter(i)).add(new THREE.Vector3(0, 0, -0.02));
    scene.add(bez, p.mesh);
    return p;
  });
  // cabinets under the screens
  add(inkedRect(nw + 0.2, 1.9, 0.03, '#262c46', 0.06), 0, 0.95, NOC.z + 0.2);
  for (let k = 0; k < 6; k++) {
    const door = inkedRect(nw / 6 - 0.12, 1.6, 0.02, '#2e355a', 0.035);
    add(door, -nw / 2 + (k + 0.5) * nw / 6, 0.92, NOC.z + 0.24);
    for (let v = 0; v < 6; v++) add(shapeMesh(roundedRectShape(nw / 6 - 0.5, 0.04, 0.02), '#20263d', 0), -nw / 2 + (k + 0.5) * nw / 6, 1.3 - v * 0.1, NOC.z + 0.27);
  }
  const cabLeds = canvasPlane<Frame>(nw, 0.12, 60, (c, f, W, H) => {
    for (let k = 0; k < 36; k++) { if (hash(k, 621, Math.floor(f.t * (2 + hash(k, 622) * 5))) < 0.4) continue; c.fillStyle = k % 5 ? '#6dff8a' : '#5fb8ff'; c.fillRect((k + 0.5) * W / 36 - 2, H * 0.3, 4, H * 0.4); }
  });
  add(cabLeds.mesh, 0, 1.75, NOC.z + 0.28);

  // red digital clock over the screens, and a cable tray with a queue of packets above that
  const clock = canvasPlane<Frame>(2.1, 0.62, 160, (c, f, W, H) => {
    c.fillStyle = '#0a0b10'; c.beginPath(); c.roundRect(0, 0, W, H, H * 0.12); c.fill();
    c.fillStyle = '#ff4a3d'; c.font = `700 ${H * 0.66}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ff4a3d'; c.shadowBlur = H * 0.15;
    c.fillText(nightClock(f.t), W / 2, H * 0.54);
  });
  add(inkedRect(2.2, 0.72, 0.05, '#0a0b10', 0.05), 0, 6.35, NOC.z - 0.01);
  add(clock.mesh, 0, 6.35, NOC.z + 0.01);
  const trayY = 7.0;
  add(inkedRect(44, 0.12, 0.02, '#d9a93a', 0.04), 0, trayY, BACK_Z + 0.5);
  for (let x = -21; x <= 21; x += 0.8) add(shapeMesh(roundedRectShape(0.05, 0.3, 0, 0, -0.1), '#b88a2a', 0), x, trayY, BACK_Z + 0.45);
  // drooping cable bundles
  const cableCols = ['#5b9bd5', '#f2c14e', '#e0504a', '#3fa66b'];
  for (let i = 0; i < 9; i++) {
    const x0 = -20 + i * 4.6, sag = 0.25 + hash(i, 631) * 0.3, col = cableCols[i % 4];
    const s = new THREE.Shape(), N = 12, thick = 0.07;
    for (let k = 0; k <= N; k++) { const u = k / N; s[k ? 'lineTo' : 'moveTo'](x0 + u * 3.6, -Math.sin(u * Math.PI) * sag); }
    for (let k = N; k >= 0; k--) { const u = k / N; s.lineTo(x0 + u * 3.6, -Math.sin(u * Math.PI) * sag - thick); }
    s.closePath();
    add(shapeMesh(s, col, 0), 0, trayY - 0.06, BACK_Z + 0.55);
  }
  const PACKETS = 14, SPAN = 40;
  const packets = Array.from({ length: PACKETS }, (_, i) => {
    const p = new THREE.Group();
    p.add(inkedRect(0.42, 0.28, 0.03, pick(['#ffffff', '#ffe27a', '#bfe8ff'], i, 641), 0.035));
    const flap = new THREE.Shape(); flap.moveTo(-0.19, 0.12); flap.lineTo(0, -0.02); flap.lineTo(0.19, 0.12); flap.lineTo(0.16, 0.12); flap.lineTo(0, 0.02); flap.lineTo(-0.16, 0.12); flap.closePath();
    p.add(shapeMesh(flap, INK, 0.004));
    scene.add(p);
    return p;
  });

  // two archways onto aisles of racks; racks fill the rest of the back wall
  const aisles = [-6.9, 6.9].map((ax, i) => {
    const view = aisleView(2.4, 4.6, 650 + i);
    add(view.mesh, ax, 2.3, BACK_Z + 0.01);
    add(inkedRect(0.25, 4.9, 0.02, '#2b3150', 0.05), ax - 1.32, 2.45, BACK_Z + 0.03);
    add(inkedRect(0.25, 4.9, 0.02, '#2b3150', 0.05), ax + 1.32, 2.45, BACK_Z + 0.03);
    add(inkedRect(2.9, 0.3, 0.02, '#2b3150', 0.05), ax, 4.95, BACK_Z + 0.03);
    const sign = staticPlane(1.6, 0.36, 200, (c, W, H) => {
      c.fillStyle = '#1b2440'; c.strokeStyle = '#5fd0ff'; c.lineWidth = H * 0.08;
      c.beginPath(); c.roundRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12, H * 0.15); c.fill(); c.stroke();
      c.fillStyle = '#bff3ff'; c.font = `800 ${H * 0.5}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(i ? 'PROD · B' : 'PROD · A', W / 2, H * 0.55);
    });
    add(sign, ax, 5.45, BACK_Z + 0.05);
    return view;
  });
  const kit = rackKit();
  const racks: (THREE.Group & { flash: THREE.MeshBasicMaterial })[] = [];
  const rackAt = (x: number, z: number, rotY = 0, v = 0) => {
    const r = kit.make(v, hash(x, z, 661) > 0.5);
    r.position.set(x, 0, z); r.rotation.y = rotY;
    scene.add(r); racks.push(r);
    return r;
  };
  [-4.7, 4.7, -9.0, 9.0, -10.6, 10.6, -12.2, 12.2, -13.8, 13.8].forEach((x, i) => rackAt(x, BACK_Z + 0.4, 0, i));
  for (let k = 0; k < 9; k++) {
    const z = BACK_Z + 1.6 + k * 1.6;
    rackAt(-14.6, z, Math.PI / 2, k + 1);
    rackAt(14.6, z, -Math.PI / 2, k + 2);
  }
  // DAYS WITHOUT INCIDENT, on the wall over the right-hand racks
  const daysSign = staticPlane(2.6, 1.0, 160, (c, W, H) => {
    c.fillStyle = '#f7f4ee'; c.strokeStyle = INK; c.lineWidth = H * 0.05;
    c.beginPath(); c.roundRect(H * 0.04, H * 0.04, W - H * 0.08, H - H * 0.08, H * 0.08); c.fill(); c.stroke();
    c.fillStyle = INK; c.font = `800 ${H * 0.15}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('DAYS WITHOUT', H * 0.16, H * 0.33); c.fillText('AN INCIDENT', H * 0.16, H * 0.55);
    c.fillStyle = '#2f9e5b'; c.beginPath(); c.roundRect(W * 0.66, H * 0.18, W * 0.28, H * 0.64, H * 0.06); c.fill();
    c.fillStyle = '#ffffff'; c.font = `900 ${H * 0.45}px ${FONT}`; c.textAlign = 'center';
    c.fillText(String(opts.days ?? 14), W * 0.8, H * 0.52);
  });
  add(daysSign, 10.6, 5.5, BACK_Z + 0.05);

  // the console desk: a monitor, two keyboards, a rubber duck, the mug, and an empty chair
  const desk = new THREE.Group();
  const chair = new THREE.Group();
  chair.add(inkedRect(0.85, 1.35, 0.22, '#3f4a6e', 0.05));
  const chairSeat = inkedRect(1.0, 0.18, 0.06, '#3f4a6e', 0.05); chairSeat.position.set(0, -0.62, 0.02); chair.add(chairSeat);
  const chairPole = inkedRect(0.12, 0.6, 0.02, '#20263b', 0.04); chairPole.position.set(0, -1.02, -0.02); chair.add(chairPole);
  chair.position.set(1.55, 1.85, -0.6);
  chair.rotation.z = 0.08;
  desk.add(chair);
  const mon = new THREE.Group();
  mon.position.set(CONSOLE.monitorX, 0, -0.3);
  const bezel = inkedRect(1.95, 1.22, 0.06, '#1d2135', 0.05);
  bezel.position.y = CONSOLE.screenY;
  const neck = inkedRect(0.26, 0.4, 0.02, '#1d2135', 0.04); neck.position.set(0, DESK_Y + 0.22, -0.02);
  const foot = inkedRect(0.85, 0.1, 0.04, '#1d2135', 0.04); foot.position.set(0, DESK_Y + 0.05, -0.01);
  const monitor = { draw: ((c, f, W, H) => drawEditor(c, W, H, f.t)) as ScreenDraw };
  const screen = canvasPlane<Frame>(1.75, 1.02, opts.monitorPPU ?? 500, (c, f, W, H) => monitor.draw(c, f, W, H));
  screen.mesh.position.set(0, CONSOLE.screenY, 0.02);
  const note = inkedRect(0.3, 0.3, 0.01, '#ffe27a', 0.025); note.position.set(0.85, CONSOLE.screenY + 0.5, 0.03); note.rotation.z = 0.12;
  mon.add(bezel, neck, foot, screen.mesh, note);
  desk.add(mon);
  const top = inkedRect(4.3, 0.16, 0.04, '#4c5478', 0.05); top.position.set(0, DESK_Y - 0.08, 0.02);
  const panel = inkedRect(3.9, DESK_Y - 0.1, 0.03, '#3b4260', 0.05); panel.position.set(0, (DESK_Y - 0.1) / 2, 0);
  const vent = shapeMesh(roundedRectShape(2.6, 0.5, 0.04), '#2f3552', 0.035); vent.position.set(0.4, 0.75, 0);
  desk.add(top, panel, vent);
  for (let v = 0; v < 4; v++) { const s = shapeMesh(roundedRectShape(2.3, 0.04, 0.02), '#252a42', 0.04); s.position.set(0.4, 0.6 + v * 0.1, 0); desk.add(s); }
  const kb = inkedRect(1.05, 0.12, 0.04, '#c9ced6', 0.035); kb.position.set(0.35, DESK_Y + 0.06, 0.06);
  const kb2 = inkedRect(0.9, 0.1, 0.03, '#c9ced6', 0.035); kb2.position.set(CONSOLE.clawdX + 0.05, DESK_Y + 0.05, 0.5);
  desk.add(kb, kb2);
  const duck = new THREE.Group();
  const duckBody = inkedRect(0.36, 0.22, 0.1, '#ffd23f', 0.035); duckBody.position.y = 0.11;
  const duckHead = inkedCircle(0.1, '#ffd23f', 0.035); duckHead.position.set(0.1, 0.3, 0.01);
  const beak = shapeMesh(roundedRectShape(0.09, 0.05, 0.02), '#f28c28', 0.02); beak.position.set(0.21, 0.29, 0);
  const eye = shapeMesh(roundedRectShape(0.025, 0.04, 0.01), INK, 0.02); eye.position.set(0.12, 0.32, 0);
  duck.add(duckBody, duckHead, beak, eye);
  duck.position.set(1.25, DESK_Y, 0.15);
  const mug = coffeeMug('#5b9bd5', 0.8);
  mug.position.set(1.85, DESK_Y, 0.12);
  desk.add(duck, mug);
  scene.add(desk);

  // the DEPLOY pedestal
  const button = bigButton('DEPLOY');
  button.group.position.set(PEDESTAL.x, 0, PEDESTAL.z);
  scene.add(button.group);

  const clawd = new Clawd();
  const rig = new THREE.Group();
  rig.add(clawd.root);
  scene.add(rig);
  if (opts.tagged ?? true) wearTag(clawd.body);
  let keys: ReturnType<typeof keyRing> | null = null;
  if (opts.keys) {
    keys = keyRing(0.62);
    keys.position.set(0.5, 0.36, 0.03);
    clawd.body.add(keys);
  }

  const room: ServerRoom = {
    scene, camera, clawd, rig, screens, monitor, button, keys, mug, desk, ledWave: null,
    aim(x, y, z, tx, ty, tz) { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    reset(f) {
      kit.update(f);
      nocPlanes.forEach(p => p.update(f));
      cabLeds.update(f);
      clock.update(f);
      screen.update(f);
      aisles.forEach(a => a.update(f));
      mug.update(f.t);
      const wave = room.ledWave ? room.ledWave(f.t) : null;
      for (const r of racks) {
        const d = wave === null ? 99 : Math.abs(r.position.x - wave);
        r.flash.opacity = wave === null ? 0 : clamp(1 - d / 1.6) * 0.55;
        r.flash.visible = r.flash.opacity > 0.01;
      }
      packets.forEach((p, i) => {
        // a queue: packets bunch up and move along in little trains
        const base = i * 1.1 + Math.floor(i / 4) * 2.2;
        const x = ((base + f.t * 1.6) % SPAN) - SPAN / 2;
        p.position.set(x, trayY + 0.22, BACK_Z + 0.56);
        p.rotation.z = Math.sin(f.t * 6 + i) * 0.05;
      });
      button.set(0, 0, 0);
      rig.position.set(0, 0, 0);
      rig.scale.setScalar(1);
      clawd.root.position.set(CONSOLE.clawdX, DESK_Y, CONSOLE.clawdZ);
      clawd.root.rotation.set(0, 0, 0);
      clawd.root.visible = true;
      if (keys) keys.swingTo(Math.sin(f.t * 3.3) * 0.12, f.t);
      desk.visible = true;
    },
  };
  return room;
}
