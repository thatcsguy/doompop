// The bridge's command centre (1:55 to 2:50): Clawd stands on a giant console under a curved bank
// of eight big screens, one per city system, in front of a floor-to-ceiling window onto the city at
// night. The side desks are empty, chairs pushed back. From "Flag the danger" the red beacons on the
// trusses turn. Every shot builds its own copy; reset(f) puts the shared parts back each frame.
//
// Units match the server room: floor at y = 0, Clawd 1.1 tall, standing on the console top.
import * as THREE from 'three';
import type { Frame } from '../../engine/types';
import { INK, canvasPlane, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { Clawd } from '../../engine/characters/clawd';
import { hash, noise1 } from '../../engine/rng';
import { clamp, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { FONT, MONO } from './world';
import { CODE, drawCodeLine, drawGraph, screenFrame, type ScreenDraw } from './server';
import { SHIRTS, coffeeMug, glow, keyRing, pick, wearTag } from './props';
import { THREAT } from './countdown';

export const BANK = { cols: 4, rows: 2, w: 3.4, h: 1.9, gap: 0.25, y: 4.2, z: -5 };
export const DESK = { y: 1.15, z: 0.9, w: 7.2 };
/** Where Clawd stands on the console top. */
export const SPOT = new THREE.Vector3(0, DESK.y + 0.09, DESK.z - 0.4);
export const WALL_Z = -11;
export const CEIL_Y = 10.5;

/** Centre and facing of bank screen i (row-major from the top left). The bank curves toward him. */
export function bankSlot(i: number) {
  const c = i % BANK.cols, r = Math.floor(i / BANK.cols);
  const off = c - (BANK.cols - 1) / 2;
  return {
    p: new THREE.Vector3(off * (BANK.w + BANK.gap), BANK.y + (0.5 - r) * (BANK.h + BANK.gap), BANK.z + Math.abs(off) * 0.4),
    ry: -off * 0.14,
  };
}

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------------------------------------------------------------------------------------------
// The eight city systems. Each painter has a "before" and "after" state around its event time ev
// (the word its command lands on), so every shot that sees the bank agrees on what has happened.
// Header titles never repeat the sung words.

function envelope(c: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, done: boolean) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const w = s, h = s * 0.64;
  c.fillStyle = '#f7f4ee'; c.strokeStyle = INK; c.lineWidth = s * 0.07; c.lineJoin = 'round';
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, s * 0.06); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(0, h * 0.1); c.lineTo(w / 2, -h / 2); c.stroke();
  if (done) {
    c.fillStyle = '#2f9e5b'; c.beginPath(); c.arc(w * 0.3, h * 0.12, s * 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = s * 0.07;
    c.beginPath(); c.moveTo(w * 0.21, h * 0.13); c.lineTo(w * 0.28, h * 0.24); c.lineTo(w * 0.41, h * 0.0); c.stroke();
  }
  c.restore();
}

export function paintMail(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'mail', '#ffd166');
  const PILE = 34, TAKE = 0.024, FLY = 0.45;
  const n = t < ev ? 4812 + Math.floor(Math.max(0, t - ev + 4) * 23) : 4812 * (1 - easeOutCubic((t - ev) / 0.9));
  c.fillStyle = n > 0.5 ? '#ffd166' : '#5cd17a'; c.font = `700 ${H * 0.07}px ${MONO}`; c.textAlign = 'right'; c.textBaseline = 'middle';
  c.fillText(`✉ ${fmt(n)}`, W * 0.9, H * 0.068);
  const s = W * 0.085, stamp = { x: W * 0.5, y: H * 0.36 };
  // the rubber stamp at the top, pumping while the pile goes through
  const busy = t > ev && t < ev + PILE * TAKE + FLY;
  const pump = busy ? Math.abs(Math.sin((t - ev) * Math.PI / TAKE)) : 0;
  c.save(); c.translate(stamp.x, H * 0.18 + pump * H * 0.06);
  c.fillStyle = '#8a5a3a'; c.strokeStyle = INK; c.lineWidth = H * 0.008;
  c.beginPath(); c.roundRect(-W * 0.02, -H * 0.05, W * 0.04, H * 0.07, W * 0.01); c.fill(); c.stroke();
  c.fillStyle = '#2f9e5b'; c.beginPath(); c.roundRect(-W * 0.045, H * 0.02, W * 0.09, H * 0.035, W * 0.006); c.fill(); c.stroke();
  c.restore();
  for (let j = 0; j < PILE; j++) {
    const tIn = ev - 3.6 + j * 0.1;
    if (t < tIn) continue;
    const pile = { x: W * (0.5 + (hash(j, 801) - 0.5) * 0.62), y: H * (0.66 + (hash(j, 802) - 0.5) * 0.36) };
    const rot = (hash(j, 803) - 0.5) * 1.2;
    const arrive = easeOutCubic((t - tIn) / 0.3);
    let x = lerp(-W * 0.1, pile.x, arrive), y = lerp(H * 0.15, pile.y, arrive), r = rot, done = false;
    const tj = ev + j * TAKE;
    if (t > tj) {
      const u = (t - tj) / FLY;
      if (u >= 1) continue;
      if (u < 0.4) { const k = easeInOutCubic(u / 0.4); x = lerp(pile.x, stamp.x, k); y = lerp(pile.y, stamp.y, k); r = lerp(rot, 0, k); }
      else { const k = easeInCubic((u - 0.4) / 0.6); x = lerp(stamp.x, W * 1.15, k); y = lerp(stamp.y, H * (0.25 + hash(j, 804) * 0.6), k); r = k * 0.4; done = true; }
    }
    envelope(c, x, y, s, r, done);
  }
  // all answered: a big green tick
  const z = clamp((t - (ev + PILE * TAKE + FLY * 0.6)) / 0.25);
  if (z > 0) {
    c.save(); c.translate(W * 0.5, H * 0.6); c.scale(easeOutBack(z, 2), easeOutBack(z, 2));
    c.fillStyle = '#2f9e5b'; c.strokeStyle = INK; c.lineWidth = H * 0.012;
    c.beginPath(); c.arc(0, 0, H * 0.17, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = H * 0.04; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-H * 0.07, 0); c.lineTo(-H * 0.015, H * 0.06); c.lineTo(H * 0.08, -H * 0.06); c.stroke();
    c.restore();
  }
}

export function paintPower(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'power', '#ffb347');
  const N = 10, x0 = W * 0.07, x1 = W * 0.95, base = H * 0.86, top = H * 0.24;
  const lev = easeOutBack(clamp((t - ev) / 0.45), 1.6);
  const imb = lerp(42, 0.4, clamp(lev));
  c.fillStyle = lev > 0.9 ? '#5cd17a' : '#ffb347'; c.font = `700 ${H * 0.07}px ${MONO}`; c.textAlign = 'right'; c.textBaseline = 'middle';
  c.fillText(`±${imb.toFixed(1)}%`, W * 0.9, H * 0.068);
  const ty = base - 0.6 * (base - top);
  c.strokeStyle = 'rgba(201,214,255,0.45)'; c.lineWidth = H * 0.006; c.setLineDash([H * 0.03, H * 0.02]);
  c.beginPath(); c.moveTo(x0, ty); c.lineTo(x1, ty); c.stroke(); c.setLineDash([]);
  const bw = (x1 - x0) / N;
  for (let i = 0; i < N; i++) {
    const h0 = 0.16 + hash(i, 811) * 0.82;
    const h = lerp(h0, 0.6, lev) + noise1(t * 2.2, i) * 0.07 * (1 - clamp(lev) * 0.9);
    const col = lev > 0.85 ? '#5cd17a' : h > 0.82 ? '#ff5a4f' : h < 0.3 ? '#ffb347' : '#5cd17a';
    const x = x0 + i * bw + bw * 0.15, y = base - h * (base - top);
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = H * 0.008;
    c.beginPath(); c.roundRect(x, y, bw * 0.7, base - y, H * 0.012); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + bw * 0.08, y + H * 0.015, bw * 0.12, base - y - H * 0.03);
    if (col === '#ff5a4f' && Math.floor(t * 4 + i) % 2 === 0) {
      c.fillStyle = '#ffe27a';
      const bx = x + bw * 0.35, by = y - H * 0.08;
      c.beginPath(); c.moveTo(bx + H * 0.01, by - H * 0.045); c.lineTo(bx - H * 0.025, by + H * 0.005); c.lineTo(bx, by + H * 0.005);
      c.lineTo(bx - H * 0.012, by + H * 0.05); c.lineTo(bx + H * 0.028, by - H * 0.005); c.lineTo(bx + H * 0.002, by - H * 0.005); c.closePath(); c.fill();
    }
    c.fillStyle = 'rgba(201,214,255,0.6)'; c.font = `600 ${H * 0.045}px ${MONO}`; c.textAlign = 'center';
    c.fillText(`N${i + 1}`, x + bw * 0.35, base + H * 0.05);
  }
}

const ROADS = { v: [0.1, 0.3, 0.5, 0.7, 0.9], h: [0.25, 0.55, 0.83] };
const ROUTES: [number, number][][] = [
  [[0.1, 0.25], [0.5, 0.25], [0.5, 0.55], [0.9, 0.55]],
  [[0.3, 0.83], [0.3, 0.55], [0.7, 0.55], [0.7, 0.25], [0.9, 0.25]],
  [[0.1, 0.83], [0.7, 0.83], [0.7, 0.55]],
];
export function paintRoads(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'roads', '#5fd0ff');
  const mx = W * 0.03, my = H * 0.16, mw = W * 0.94, mh = H * 0.82;
  const X = (u: number) => mx + u * mw, Y = (v: number) => my + v * mh;
  c.save(); c.beginPath(); c.rect(mx, my, mw, mh); c.clip();
  c.fillStyle = '#18213a'; c.fillRect(mx, my, mw, mh);
  // blocks with little buildings
  for (let i = 0; i < 14; i++) for (let j = 0; j < 7; j++) {
    if (hash(i, j, 821) < 0.35) continue;
    c.fillStyle = hash(i, j, 822) > 0.5 ? '#232d4d' : '#202945';
    c.fillRect(X(i / 14 + 0.01), Y(j / 7 + 0.02), mw / 14 * 0.7, mh / 7 * 0.6);
  }
  const rw = H * 0.05;
  c.strokeStyle = '#3b4a75'; c.lineWidth = rw;
  for (const u of ROADS.v) { c.beginPath(); c.moveTo(X(u), my); c.lineTo(X(u), my + mh); c.stroke(); }
  for (const v of ROADS.h) { c.beginPath(); c.moveTo(mx, Y(v)); c.lineTo(mx + mw, Y(v)); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = H * 0.004; c.setLineDash([H * 0.02, H * 0.02]);
  for (const u of ROADS.v) { c.beginPath(); c.moveTo(X(u), my); c.lineTo(X(u), my + mh); c.stroke(); }
  for (const v of ROADS.h) { c.beginPath(); c.moveTo(mx, Y(v)); c.lineTo(mx + mw, Y(v)); c.stroke(); }
  c.setLineDash([]);
  const flow = clamp((t - ev - 0.2) / 0.35);
  // jams: red rings at three crossings until the routes go in
  for (const [u, v] of [[0.5, 0.55], [0.3, 0.25], [0.7, 0.83]]) {
    const a = 1 - flow;
    if (a <= 0) continue;
    const k = (t * 1.2) % 1;
    c.strokeStyle = `rgba(255,90,79,${a * (1 - k)})`; c.lineWidth = H * 0.01;
    c.beginPath(); c.arc(X(u), Y(v), H * (0.03 + k * 0.08), 0, Math.PI * 2); c.stroke();
  }
  // routes he draws, one after another
  ROUTES.forEach((pts, ri) => {
    const k = easeOutCubic(clamp((t - ev - ri * 0.08) / 0.4));
    if (k <= 0) return;
    const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], (p[1] - pts[i][1]) * mh / mw));
    let left = k * segs.reduce((a, b) => a + b, 0);
    c.save();
    c.strokeStyle = '#5fd0ff'; c.lineWidth = H * 0.018; c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = '#5fd0ff'; c.shadowBlur = H * 0.03;
    c.beginPath(); c.moveTo(X(pts[0][0]), Y(pts[0][1]));
    let head = pts[0];
    for (let i = 0; i < segs.length && left > 0; i++) {
      const f = Math.min(1, left / segs[i]);
      head = [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
      c.lineTo(X(head[0]), Y(head[1]));
      left -= segs[i];
    }
    c.stroke(); c.restore();
    if (k < 1) { c.fillStyle = '#d97757'; c.beginPath(); c.arc(X(head[0]), Y(head[1]), H * 0.025, 0, Math.PI * 2); c.fill(); }
  });
  // cars: crawling and red before, streaming and bright after
  const dist = 0.012 * t + 0.42 * Math.max(0, t - ev - 0.2);
  for (let i = 0; i < 80; i++) {
    const r = i % 8, dir = hash(i, 831) > 0.5 ? 1 : -1;
    const p = (((hash(i, 832) + dir * dist * (0.7 + hash(i, 833) * 0.6)) % 1) + 1) % 1;
    const vertical = r < 5;
    const off = dir * rw * 0.22;
    const x = vertical ? X(ROADS.v[r]) + off : X(p);
    const y = vertical ? Y(p) : Y(ROADS.h[r - 5]) + off;
    c.fillStyle = flow > 0.5 ? (i % 3 ? '#ffe27a' : '#ffffff') : '#ff5a4f';
    const a = H * 0.026, b = H * 0.014;
    c.beginPath(); c.roundRect(x - (vertical ? b : a) / 2, y - (vertical ? a : b) / 2, vertical ? b : a, vertical ? a : b, b * 0.3); c.fill();
  }
  c.restore();
}

const NEW_CODE = [
  'export async function run(world) {', '  while (true) {', '    const plan = await decide(world);', '    for (const step of plan) {',
  '      await act(step);', '    }', '    world = await observe();', '  }', '}', '', 'function decide(world) {', '  return optimize(world, goals);', '}',
];
export function paintCode(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'main.ts', '#c3a6e0');
  const top = H * 0.17, lh = H * 0.062, rows = 13;
  c.font = `700 ${H * 0.048}px ${MONO}`; c.textBaseline = 'top'; c.textAlign = 'left';
  c.fillStyle = '#161c2e'; c.fillRect(0, H * 0.13, W * 0.075, H);
  const scan = clamp((t - ev) / 0.6);
  const yb = top + scan * rows * lh;
  for (let i = 0; i < rows; i++) {
    const y = top + i * lh;
    c.fillStyle = 'rgba(154,166,200,0.5)'; c.fillText(String(i + 1).padStart(2, ' '), W * 0.012, y);
    if (t > ev && y + lh * 0.5 < yb) {
      const since = t - (ev + (i + 0.5) / rows * 0.6);
      const a = 1 - clamp(since / 0.4);
      if (a > 0) { c.fillStyle = `rgba(92,209,122,${0.35 * a})`; c.fillRect(W * 0.075, y - lh * 0.1, W, lh); }
      drawCodeLine(c, NEW_CODE[i], W * 0.09, y);
    } else {
      drawCodeLine(c, CODE[i], W * 0.09, y);
      if (t > ev && y < yb + lh * 2 && CODE[i].trim()) {
        c.fillStyle = 'rgba(255,90,79,0.8)';
        c.fillRect(W * 0.09, y + lh * 0.38, c.measureText(CODE[i]).width, H * 0.006);
      }
    }
  }
  if (t > ev && scan < 1) {
    c.fillStyle = '#c3a6e0'; c.shadowColor = '#c3a6e0'; c.shadowBlur = H * 0.03;
    c.fillRect(W * 0.075, yb - H * 0.004, W, H * 0.008); c.shadowBlur = 0;
  }
  if (t < ev && Math.floor(t * 2.5) % 2 === 0) { c.fillStyle = '#e6e9f5'; c.fillRect(W * 0.09 + c.measureText(CODE[6]).width + H * 0.01, top + 6 * lh, H * 0.025, H * 0.045); }
}

export function capsule(c: CanvasRenderingContext2D, x: number, y: number, s: number, shirt: string) {
  c.strokeStyle = INK; c.lineWidth = s * 0.08;
  c.fillStyle = shirt; c.beginPath(); c.roundRect(x - s * 0.32, y - s * 0.12, s * 0.64, s * 0.62, s * 0.26); c.fill(); c.stroke();
  c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(x, y - s * 0.32, s * 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
}

export function paintShifts(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'shifts', '#9fd0a8');
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], slots = ['00', '05', '10', '15', '20'];
  const gx = W * 0.11, gy = H * 0.25, cw = (W * 0.97 - gx) / 7, ch = (H * 0.96 - gy) / 5;
  c.font = `700 ${H * 0.05}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  days.forEach((d, i) => { c.fillStyle = 'rgba(201,214,255,0.7)'; c.fillText(d, gx + (i + 0.5) * cw, H * 0.2); });
  slots.forEach((s, j) => { c.fillStyle = 'rgba(201,214,255,0.5)'; c.fillText(s, W * 0.055, gy + (j + 0.5) * ch); });
  let filled = 0;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
    const x = gx + i * cw, y = gy + j * ch;
    c.strokeStyle = 'rgba(159,208,168,0.25)'; c.lineWidth = H * 0.004; c.setLineDash([H * 0.015, H * 0.012]);
    c.strokeRect(x + cw * 0.06, y + ch * 0.08, cw * 0.88, ch * 0.84); c.setLineDash([]);
    const ta = ev + (i * 5 + j) * 0.02 + hash(i, j, 841) * 0.05;
    const k = clamp((t - ta) / 0.22);
    if (k <= 0) continue;
    filled++;
    c.fillStyle = 'rgba(159,208,168,0.14)'; c.fillRect(x + cw * 0.06, y + ch * 0.08, cw * 0.88, ch * 0.84);
    const cx = lerp(W * 1.1, x + cw / 2, easeOutBack(k, 1.4));
    capsule(c, cx, y + ch * 0.55, ch * 0.62, pick(SHIRTS, i, j, 842));
  }
  c.fillStyle = filled === 35 ? '#5cd17a' : '#c9d6ff'; c.font = `700 ${H * 0.07}px ${MONO}`; c.textAlign = 'right';
  c.fillText(`${filled}/35`, W * 0.9, H * 0.068);
}

export function paintBudget(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'budget', '#ffd166');
  const v = 1.2e9 + Math.max(0, t - ev + 4) * 3.1e7 + Math.max(0, t - ev) * 4.4e8;
  c.fillStyle = '#ffd166'; c.font = `700 ${H * 0.11}px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(`$${fmt(v)}`, W * 0.05, H * 0.27);
  const base = H * 0.92, rx = W * 0.04, ry = W * 0.013;
  for (let i = 0; i < 8; i++) {
    const n = Math.min(17, Math.floor(3 + hash(i, 851) * 6 + Math.max(0, t - ev + 2.5) * (2 + hash(i, 852) * 3)));
    const x = W * (0.1 + i * 0.115);
    for (let k = 0; k < n; k++) {
      const y = base - k * ry * 1.25;
      c.fillStyle = '#c9962e'; c.strokeStyle = INK; c.lineWidth = H * 0.006;
      c.beginPath(); c.ellipse(x, y + ry * 0.4, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#f2c14e';
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }
  // the seal slams down on the word
  const k = clamp((t - ev) / 0.16);
  if (t >= ev) {
    const e = easeOutCubic(k), sc = lerp(2.6, 1, e);
    c.save(); c.globalAlpha = clamp((t - ev) / 0.06);
    c.translate(W * 0.68, H * 0.5); c.rotate(-0.25 + (1 - e) * 0.3); c.scale(sc, sc);
    c.strokeStyle = '#3fd07a'; c.lineWidth = H * 0.025;
    c.beginPath(); c.arc(0, 0, H * 0.22, 0, Math.PI * 2); c.stroke();
    c.lineWidth = H * 0.01; c.beginPath(); c.arc(0, 0, H * 0.18, 0, Math.PI * 2); c.stroke();
    c.lineWidth = H * 0.045; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-H * 0.09, 0); c.lineTo(-H * 0.02, H * 0.08); c.lineTo(H * 0.11, -H * 0.08); c.stroke();
    c.restore();
    if (k >= 1) for (let d = 0; d < 9; d++) {
      c.fillStyle = 'rgba(63,208,122,0.8)';
      const a = hash(d, 853) * Math.PI * 2, r = H * (0.26 + hash(d, 854) * 0.08);
      c.beginPath(); c.arc(W * 0.68 + Math.cos(a) * r, H * 0.5 + Math.sin(a) * r, H * (0.006 + hash(d, 855) * 0.01), 0, Math.PI * 2); c.fill();
    }
  }
}

export function paintAnomaly(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  const hot = t >= ev;
  screenFrame(c, W, H, 'anomaly', hot ? '#ff5a4f' : '#5fd0ff');
  const px = W * 0.6, py = H * 0.66;
  // contour map
  for (let k = 1; k < 9; k++) {
    c.strokeStyle = `rgba(95,208,255,${0.22 - k * 0.015})`; c.lineWidth = H * 0.005;
    c.beginPath();
    for (let a = 0; a <= 64; a++) {
      const th = a / 64 * Math.PI * 2, r = k * H * 0.075 * (1 + 0.18 * Math.sin(th * 3 + k) + 0.1 * Math.sin(th * 5 - k * 2));
      const x = px + Math.cos(th) * r * 1.5, y = py + Math.sin(th) * r * 0.8;
      if (a) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    c.fillStyle = hot && i % 4 === 0 ? '#ff5a4f' : '#5cd17a';
    c.beginPath(); c.arc(W * (0.08 + hash(i, 861) * 0.84), H * (0.2 + hash(i, 862) * 0.75), H * 0.012, 0, Math.PI * 2); c.fill();
  }
  if (hot) {
    for (let r = 0; r < 3; r++) {
      const k = ((t - ev) * 1.1 + r / 3) % 1;
      c.strokeStyle = `rgba(255,90,79,${0.8 * (1 - k)})`; c.lineWidth = H * 0.012;
      c.beginPath(); c.ellipse(px, py, H * 0.4 * k * 1.5, H * 0.4 * k * 0.8, 0, 0, Math.PI * 2); c.stroke();
    }
  }
  // the flag snaps up from lying flat
  const snap = hot ? easeOutBack(clamp((t - ev) / 0.25), 3) : 0;
  c.save(); c.translate(px, py); c.rotate((1 - snap) * Math.PI / 2);
  c.strokeStyle = INK; c.lineWidth = H * 0.012; c.fillStyle = '#e6e9f5';
  c.beginPath(); c.roundRect(-H * 0.008, -H * 0.34, H * 0.016, H * 0.34, H * 0.008); c.fill(); c.stroke();
  c.fillStyle = '#ff3b30';
  c.beginPath(); c.moveTo(H * 0.008, -H * 0.34);
  for (let k = 0; k <= 10; k++) c.lineTo(H * 0.008 + k / 10 * H * 0.26, -H * 0.34 + Math.sin(t * 9 - k * 0.7) * H * 0.012 * k / 10);
  for (let k = 10; k >= 0; k--) c.lineTo(H * 0.008 + k / 10 * H * 0.26, -H * 0.19 + Math.sin(t * 9 - k * 0.7) * H * 0.012 * k / 10);
  c.closePath(); c.fill(); c.stroke();
  c.restore();
  c.fillStyle = '#ff3b30'; c.strokeStyle = INK; c.lineWidth = H * 0.01;
  c.beginPath(); c.arc(px, py, H * 0.022, 0, Math.PI * 2); c.fill(); c.stroke();
  if (hot) {
    const a = 0.5 + 0.5 * Math.sin((t - ev) * Math.PI * 2 * 1.1);
    c.strokeStyle = `rgba(255,59,48,${0.35 + 0.5 * a})`; c.lineWidth = H * 0.03;
    c.strokeRect(H * 0.015, H * 0.015, W - H * 0.03, H - H * 0.03);
    [[0.2, 0.35], [0.85, 0.3], [0.3, 0.82]].forEach(([u, v], i) => {
      const k = easeOutBack(clamp((t - ev - 0.15 - i * 0.12) / 0.2), 2);
      if (k <= 0) return;
      c.save(); c.translate(W * u, H * v); c.scale(k, k);
      c.fillStyle = '#ffd166'; c.strokeStyle = INK; c.lineWidth = H * 0.008;
      c.beginPath(); c.moveTo(0, -H * 0.06); c.lineTo(H * 0.06, H * 0.045); c.lineTo(-H * 0.06, H * 0.045); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = INK; c.fillRect(-H * 0.006, -H * 0.025, H * 0.012, H * 0.04); c.fillRect(-H * 0.006, H * 0.025, H * 0.012, H * 0.01);
      c.restore();
    });
  }
}

/** The forecast: a probability curve that climbs toward the top. p(t) is exported for the readout. */
export function forecastAt(t: number, ev: number) {
  const k = easeInOutCubic(clamp((t - ev) / 0.85));
  return lerp(0.3, 1, k);
}
const curve = (x: number) => 0.03 + 0.967 / (1 + Math.exp(-11 * (x - 0.62)));
export function paintForecast(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number) {
  screenFrame(c, W, H, 'forecast', '#ff8a5a');
  const x0 = W * 0.1, x1 = W * 0.7, y0 = H * 0.88, y1 = H * 0.22;
  c.fillStyle = 'rgba(255,59,48,0.16)'; c.fillRect(x0, y1, x1 - x0, (y0 - y1) * 0.1);
  c.strokeStyle = 'rgba(255,90,79,0.7)'; c.lineWidth = H * 0.006; c.setLineDash([H * 0.03, H * 0.02]);
  c.beginPath(); c.moveTo(x0, y1); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]);
  c.strokeStyle = 'rgba(201,214,255,0.4)'; c.lineWidth = H * 0.006;
  c.beginPath(); c.moveTo(x0, y1 - H * 0.02); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
  c.fillStyle = 'rgba(201,214,255,0.6)'; c.font = `600 ${H * 0.045}px ${MONO}`; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (const p of [0, 50, 100]) c.fillText(`${p}%`, x0 - H * 0.02, lerp(y0, y1, p / 100));
  const head = forecastAt(t, ev);
  c.save();
  c.strokeStyle = '#ff8a5a'; c.lineWidth = H * 0.016; c.lineJoin = 'round'; c.lineCap = 'round';
  c.shadowColor = '#ff8a5a'; c.shadowBlur = H * 0.03;
  c.beginPath();
  for (let i = 0; i <= 80; i++) {
    const x = i / 80 * head, p = curve(x) + noise1(x * 30, 871) * 0.012;
    const px = lerp(x0, x1, x), py = lerp(y0, y1, clamp(p));
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.stroke(); c.restore();
  const p = curve(head);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(lerp(x0, x1, head), lerp(y0, y1, p), H * 0.022, 0, Math.PI * 2); c.fill();
  const red = clamp((p - 0.5) / 0.45);
  c.fillStyle = `rgb(255,${Math.round(lerp(200, 70, red))},${Math.round(lerp(140, 60, red))})`;
  c.font = `700 ${H * 0.15}px ${MONO}`; c.textAlign = 'center';
  c.fillText(`${(p * 100).toFixed(1)}%`, W * 0.85, H * 0.55);
}

export const PAINTERS = [paintMail, paintPower, paintRoads, paintCode, paintShifts, paintBudget, paintAnomaly, paintForecast];

// ---------------------------------------------------------------------------------------------
// The skyline outside: far towers, near towers with lit windows. lightsOut(t) 0..1 darkens it
// district by district (left to right), redrawn only when it changes.

function skyline(w: number, h: number) {
  let drawnAt = -1;
  const plane = canvasPlane<number>(w, h, 16, (c, out, W, H) => {
    const u = W / w;
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070a18'); sky.addColorStop(0.55, '#15183a'); sky.addColorStop(0.8, '#34295a'); sky.addColorStop(1, '#1a1838');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(255,255,255,${0.3 + hash(i, 881) * 0.6})`;
      c.fillRect(hash(i, 882) * W, hash(i, 883) * H * 0.5, 2, 2);
    }
    c.fillStyle = '#f3ecd2'; c.beginPath(); c.arc(W * 0.7, H * 0.18, 1.6 * u, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(243,236,210,0.12)'; c.beginPath(); c.arc(W * 0.7, H * 0.18, 3.4 * u, 0, Math.PI * 2); c.fill();
    const horizon = H * 0.78;
    // far layer
    for (let x = 0; x < W;) {
      const bw = (1.5 + hash(x, 884) * 3) * u, bh = (3 + hash(x, 885) * 9) * u;
      c.fillStyle = '#1d2142'; c.fillRect(x, horizon - bh, bw, H - horizon + bh);
      x += bw + u * 0.2;
    }
    // near layer with windows
    let k = 0;
    for (let x = -u; x < W; k++) {
      const bw = (2.5 + hash(k, 886) * 4) * u, bh = (5 + hash(k, 887) * 15) * u;
      const dark = x / W < out;
      c.fillStyle = hash(k, 888) > 0.5 ? '#262a52' : '#2b2f5c';
      c.fillRect(x, horizon - bh + 4 * u, bw, H);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + bw * 0.8, horizon - bh + 4 * u, bw * 0.2, H);
      if (hash(k, 889) > 0.6) { c.fillStyle = '#ff5a4f'; c.fillRect(x + bw / 2 - 2, horizon - bh + 4 * u - 6, 4, 4); }
      for (let wy = horizon - bh + 5 * u; wy < H; wy += 0.9 * u) for (let wx = x + 0.4 * u; wx < x + bw - 0.6 * u; wx += 0.8 * u) {
        if (hash(Math.floor(wx), Math.floor(wy), 890) < 0.55) continue;
        c.fillStyle = dark ? 'rgba(20,22,44,0.9)' : hash(Math.floor(wx), Math.floor(wy), 891) > 0.15 ? '#ffd98a' : '#bfe8ff';
        c.fillRect(wx, wy, 0.35 * u, 0.45 * u);
      }
      x += bw + u * 0.6;
    }
  });
  return {
    mesh: plane.mesh,
    set(out: number) {
      const q = Math.round(clamp(out) * 40) / 40;
      if (q === drawnAt) return;
      drawnAt = q; plane.update(q);
    },
  };
}

// ---------------------------------------------------------------------------------------------

export interface ControlRoom {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clawd: Clawd;
  /** Parent of Clawd's root; move or scale it (setPose owns his root's scale). */
  rig: THREE.Group;
  /** Draw functions for the eight bank screens, row-major from the top left; replace to change them. */
  screens: ScreenDraw[];
  /** Everything on and in the console. */
  desk: THREE.Group;
  mug: ReturnType<typeof coffeeMug>;
  /** 0..1 how much of the city outside has gone dark (left to right). */
  lightsOut: (t: number) => number;
  /** 0..1 red alarm light from the beacons (defaults to on after the countdown appears). */
  alarm: (t: number) => number;
  reset(f: Frame): void;
  aim(x: number, y: number, z: number, tx: number, ty: number, tz: number): void;
}

export function buildControlRoom(opts: { events?: number[]; ppu?: number[]; keys?: boolean } = {}): ControlRoom {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0f22');
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); scene.add(o); return o; };
  const ev = opts.events?.length ? opts.events : PAINTERS.map(() => Infinity);

  // the city, far behind the glass
  const city = skyline(150, 40);
  add(city.mesh, 0, 8, -34);
  // the window wall: frame, mullions, a few streaks on the glass
  add(shapeMesh(roundedRectShape(80, 2.2, 0, 0, 11.6), '#151a31', 0), 0, 0, WALL_Z);
  add(shapeMesh(roundedRectShape(80, 0.4, 0, 0, 0.2), '#151a31', 0), 0, 0, WALL_Z);
  add(inkedRect(80, 0.3, 0, '#232946', 0.05), 0, 10.4, WALL_Z + 0.02);
  add(inkedRect(80, 0.25, 0, '#232946', 0.05), 0, 0.45, WALL_Z + 0.02);
  for (let x = -26.4; x <= 26.4; x += 4.4) add(inkedRect(0.24, 10, 0.02, '#232946', 0.05), x, 5.4, WALL_Z + 0.03);
  add(inkedRect(80, 0.16, 0, '#232946', 0.04), 0, 7.6, WALL_Z + 0.025);
  for (let i = 0; i < 7; i++) {
    const s = shapeMesh(roundedRectShape(0.5, 7, 0.1), ownMat('#ffffff', 0.04, true), 0);
    s.rotation.z = -0.5;
    add(s, -20 + i * 7 + hash(i, 892) * 2, 4.5, WALL_Z + 0.05);
  }
  // floor: dark tiles with screen-light pools
  const fc = document.createElement('canvas');
  const FU = 16, FW = 60, FD = 30;
  fc.width = FW * FU; fc.height = FD * FU;
  {
    const c = fc.getContext('2d')!, T = 1.5 * FU;
    c.fillStyle = '#141a31'; c.fillRect(0, 0, fc.width, fc.height);
    for (let i = 0; i * T < fc.width; i++) for (let j = 0; j * T < fc.height; j++) {
      c.fillStyle = (i + j) % 2 ? '#161d36' : '#131930'; c.fillRect(i * T, j * T, T, T);
      c.fillStyle = '#0e1326'; c.fillRect(i * T, j * T, T, 1.5); c.fillRect(i * T, j * T, 1.5, T);
    }
  }
  const ftex = new THREE.CanvasTexture(fc);
  ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), new THREE.MeshBasicMaterial({ map: ftex }));
  floor.rotation.x = -Math.PI / 2;
  add(floor, 0, 0, WALL_Z + FD / 2);
  const pool = glow(1, '#5fd0ff', 0.13); pool.rotation.x = -Math.PI / 2; pool.scale.set(9, 2.6, 1);
  add(pool, 0, 0.01, BANK.z + 1.6);
  const ring = glow(1, '#5fd0ff', 0.1); ring.rotation.x = -Math.PI / 2; ring.scale.set(5.2, 2.2, 1);
  add(ring, 0, 0.012, DESK.z);
  // ceiling and trusses, with beacons hanging from them
  const ceil = shapeMesh(roundedRectShape(80, 40, 0), '#0a0d1c', 0); ceil.rotation.x = Math.PI / 2;
  add(ceil, 0, CEIL_Y, WALL_Z + 20);
  for (const z of [-7.5, -2.5]) {
    add(inkedRect(40, 0.22, 0.02, '#4a4f6e', 0.04), 0, CEIL_Y - 0.5, z);
    add(inkedRect(40, 0.22, 0.02, '#4a4f6e', 0.04), 0, CEIL_Y - 1.1, z);
    for (let x = -19.5; x <= 19.5; x += 1.2) {
      const d = shapeMesh(roundedRectShape(0.08, 0.75, 0), '#4a4f6e', 0); d.rotation.z = 0.7; add(d, x, CEIL_Y - 0.8, z);
    }
  }
  const beacons = [-10, -3.6, 3.6, 10].map((x, i) => {
    const g = new THREE.Group();
    g.add(inkedRect(0.5, 0.18, 0.02, '#20263b', 0.04));
    const domeMat = ownMat('#5a1f22');
    const dome = new THREE.Shape(); dome.absarc(0, 0, 0.26, Math.PI, 0, false); dome.closePath();
    const di = new THREE.Shape(); di.absarc(0, 0, 0.3, Math.PI, 0, false); di.closePath();
    const dg = new THREE.Group(); dg.add(shapeMesh(di, INK, 0), shapeMesh(dome, domeMat, 0.002)); dg.position.y = -0.09;
    g.add(dg);
    const beamShape = new THREE.Shape(); beamShape.moveTo(0, 0); beamShape.lineTo(-1.1, -7); beamShape.lineTo(1.1, -7); beamShape.closePath();
    const beam = shapeMesh(beamShape, ownMat('#ff3b30', 0.16, true), 0);
    beam.position.y = -0.2;
    const halo = glow(0.7, '#ff3b30', 0.4); halo.position.set(0, -0.2, 0.02);
    g.add(beam, halo);
    add(g, x, CEIL_Y - 1.3, -2.3);
    return { g, domeMat, beam, halo, i };
  });

  // the screen bank on its frame, a truss above it with cables, a ticker along the top
  const screens: ScreenDraw[] = PAINTERS.map((p, i) => (c, f, W, H) => p(c, f.t, W, H, ev[i]));
  const planes = PAINTERS.map((_, i) => {
    const { p, ry } = bankSlot(i);
    const pl = canvasPlane<Frame>(BANK.w, BANK.h, opts.ppu?.[i] ?? 90, (c, f, W, H) => room.screens[i](c, f, W, H));
    const g = new THREE.Group();
    g.position.copy(p); g.rotation.y = ry;
    const bez = inkedRect(BANK.w + 0.16, BANK.h + 0.16, 0.04, '#0b0e18', 0.05); bez.position.z = -0.03;
    const gl = glow(1, '#5fd0ff', 0.08); gl.scale.set(BANK.w * 0.75, BANK.h * 0.85, 1); gl.position.z = -0.06;
    g.add(gl, bez, pl.mesh);
    scene.add(g);
    return pl;
  });
  for (let c = 0; c < BANK.cols; c++) {
    const { p, ry } = bankSlot(c);
    const post = inkedRect(0.3, BANK.y + 2.6, 0.02, '#20263b', 0.05);
    post.position.set(p.x, (BANK.y + 2.6) / 2, p.z - 0.15); post.rotation.y = ry;
    scene.add(post);
    for (const side of [-1, 1]) {
      const cable = shapeMesh(roundedRectShape(0.05, 1.4, 0), '#0b0e18', 0);
      cable.position.set(p.x + side * 1.1, BANK.y + BANK.h + 0.9, p.z - 0.1);
      scene.add(cable);
    }
  }
  add(inkedRect(17, 0.3, 0.02, '#4a4f6e', 0.05), 0, BANK.y + BANK.h + 1.65, BANK.z - 0.05);
  const ticker = canvasPlane<Frame>(15.2, 0.44, 110, (c, f, W, H) => {
    const red = f.t >= THREAT.start;
    c.fillStyle = red ? '#2a0c10' : '#0f1424'; c.fillRect(0, 0, W, H);
    c.font = `700 ${H * 0.62}px ${MONO}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = red ? '#ff5a4f' : '#7fd8ff';
    const msg = red ? '⚠ ANOMALY   ⚠ ANOMALY   ⚠ ANOMALY   ' : 'GRID 99.1%  ·  WATER 71%  ·  TRANSIT 98.4%  ·  PORTS 12/12  ·  AIR GOOD  ·  SAT LINK OK  ·  ';
    const mw = c.measureText(msg).width;
    const off = (f.t * H * 3.2) % mw;
    for (let x = -off; x < W; x += mw) c.fillText(msg, x, H * 0.55);
  });
  add(inkedRect(15.4, 0.6, 0.03, '#0b0e18', 0.04), 0, BANK.y + BANK.h + 1.1, BANK.z + 0.25);
  add(ticker.mesh, 0, BANK.y + BANK.h + 1.1, BANK.z + 0.28);

  // side bays: tall cabinets with LEDs, empty desks with their chairs pushed back
  const ledStrip = canvasPlane<Frame>(1.0, 3.6, 40, (c, f, W, H) => {
    for (let r = 0; r < 18; r++) for (let k = 0; k < 4; k++) {
      if (hash(r, k, 893, Math.floor(f.t * (2 + hash(r, k) * 6))) < 0.45) continue;
      c.fillStyle = k === 3 ? '#5fb8ff' : '#6dff8a';
      c.fillRect(W * (0.15 + k * 0.2), H * (r + 0.4) / 18, W * 0.08, H * 0.012);
    }
  });
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = side * (10.2 + k * 1.5);
    add(inkedRect(1.35, 4.6, 0.03, '#262c46', 0.05), x, 2.3, -8.5 + k * 0.1);
    const l = new THREE.Mesh(ledStrip.mesh.geometry, ledStrip.mesh.material);
    add(l, x, 2.4, -8.45 + k * 0.1);
  }
  const sideScreens: ReturnType<typeof canvasPlane<Frame>>[] = [];
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x = side * (6.6 + k * 3.2), z = -1.2 - k * 2.2;
    add(inkedRect(2.6, 0.12, 0.03, '#4c5478', 0.04), x, 1.1, z);
    add(inkedRect(2.4, 1.05, 0.03, '#3b4260', 0.05), x, 0.53, z - 0.02);
    const mon = inkedRect(1.3, 0.8, 0.04, '#1d2135', 0.04); add(mon, x - 0.3, 1.7, z - 0.1);
    const sc = canvasPlane<Frame>(1.18, 0.68, 70, (c, f, W, H) => drawGraph(c, W, H, f.t, { seed: 20 + k + (side > 0 ? 2 : 0), title: '' }));
    add(sc.mesh, x - 0.3, 1.7, z - 0.07);
    sideScreens.push(sc);
    // the empty chair, turned away and pushed back
    const chair = new THREE.Group();
    chair.add(inkedRect(0.75, 1.15, 0.2, '#3f4a6e', 0.05));
    const seat = inkedRect(0.9, 0.16, 0.06, '#3f4a6e', 0.05); seat.position.set(0, -0.55, 0.02); chair.add(seat);
    const pole = inkedRect(0.1, 0.5, 0.02, '#20263b', 0.04); pole.position.set(0, -0.88, -0.02); chair.add(pole);
    chair.position.set(x + side * 0.9, 1.55, z + 0.9);
    chair.rotation.z = side * 0.18;
    scene.add(chair);
    if (k === 0) { const note = inkedRect(0.22, 0.22, 0.01, '#ffe27a', 0.02); note.rotation.z = 0.15; add(note, x + 0.2, 2.0, z - 0.05); }
  }

  // the console: a long desk with wings, button panels, monitors, mugs, a phone and the duck
  const desk = new THREE.Group();
  const front = inkedRect(DESK.w, DESK.y, 0.04, '#3b4260', 0.05); front.position.set(0, DESK.y / 2, DESK.z);
  const top = inkedRect(DESK.w + 0.4, 0.18, 0.05, '#4c5478', 0.05); top.position.set(0, DESK.y, DESK.z + 0.01);
  desk.add(front, top);
  for (const side of [-1, 1]) {
    const wing = inkedRect(2.6, DESK.y, 0.04, '#353c5a', 0.05);
    wing.position.set(side * (DESK.w / 2 + 1.05), DESK.y / 2, DESK.z - 0.55); wing.rotation.y = -side * 0.55;
    const wtop = inkedRect(2.8, 0.16, 0.04, '#4c5478', 0.05);
    wtop.position.set(side * (DESK.w / 2 + 1.05), DESK.y, DESK.z - 0.53); wtop.rotation.y = -side * 0.55;
    desk.add(wing, wtop);
  }
  const buttons = canvasPlane<Frame>(DESK.w - 0.8, 0.55, 60, (c, f, W, H) => {
    const cols = 38, rows = 3;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = (i + 0.5) * W / cols, y = (j + 0.5) * H / rows;
      const on = hash(i, j, 894, Math.floor(f.t * (1 + hash(i, j, 895) * 4))) > 0.4;
      const base = pick(['#5cd17a', '#5fb8ff', '#ffd166', '#5cd17a', '#e6e9f5'], i, j, 896);
      c.fillStyle = on ? base : '#262c46';
      c.beginPath(); c.roundRect(x - W / cols * 0.3, y - H / rows * 0.28, W / cols * 0.6, H / rows * 0.56, 2); c.fill();
    }
  });
  buttons.mesh.position.set(0, DESK.y * 0.62, DESK.z + 0.01);
  desk.add(buttons.mesh);
  for (let v = 0; v < 3; v++) { const s = shapeMesh(roundedRectShape(DESK.w - 1.2, 0.04, 0.02), '#2a304c', 0.02); s.position.set(0, 0.18 + v * 0.1, DESK.z); desk.add(s); }
  const topY = DESK.y + 0.09;
  const minis = [-2.6, 2.6].map((x, k) => {
    const g = new THREE.Group();
    const bz = inkedRect(1.35, 0.85, 0.04, '#1d2135', 0.04); bz.position.y = 0.7;
    const neck = inkedRect(0.16, 0.3, 0.02, '#1d2135', 0.03); neck.position.set(0, 0.15, -0.02);
    const sc = canvasPlane<Frame>(1.22, 0.72, 110, (c, f, W, H) => drawGraph(c, W, H, f.t, { seed: 30 + k, color: k ? '#ffb347' : '#5fd0ff', title: k ? 'latency' : 'requests/s', trend: 0.8 }));
    sc.mesh.position.set(0, 0.7, 0.02);
    g.add(bz, neck, sc.mesh);
    g.position.set(x, topY, DESK.z - 0.55);
    desk.add(g);
    return sc;
  });
  const note = inkedRect(0.26, 0.26, 0.01, '#ffe27a', 0.02); note.position.set(-2.05, topY + 1.05, DESK.z - 0.5); note.rotation.z = -0.12;
  desk.add(note);
  const kb = inkedRect(1.2, 0.1, 0.04, '#c9ced6', 0.035); kb.position.set(0, topY + 0.05, DESK.z - 0.08);
  desk.add(kb);
  for (let k = 0; k < 3; k++) {
    const lever = new THREE.Group();
    const stick = inkedRect(0.06, 0.32, 0.02, '#9aa1b5', 0.025); stick.position.y = 0.16;
    const knob = inkedCircle(0.07, pick(['#e0453a', '#ffd166', '#5fb8ff'], k, 897), 0.025); knob.position.y = 0.34;
    lever.add(stick, knob); lever.rotation.z = (k - 1) * 0.3;
    lever.position.set(1.15 + k * 0.22, topY, DESK.z - 0.2);
    desk.add(lever);
  }
  const phone = new THREE.Group();
  const pb = inkedRect(0.5, 0.2, 0.06, '#c43c35', 0.035); pb.position.y = 0.1;
  const hs = inkedRect(0.56, 0.1, 0.05, '#c43c35', 0.035); hs.position.set(0, 0.26, 0.01);
  phone.add(pb, hs); phone.position.set(1.95, topY, DESK.z - 0.15);
  desk.add(phone);
  const mug = coffeeMug('#5b9bd5', 0.75); mug.position.set(-1.25, topY, DESK.z - 0.12);
  desk.add(mug);
  // the night's paper cups, stacked
  for (let k = 0; k < 7; k++) {
    const cup = new THREE.Shape(); cup.moveTo(-0.11, 0); cup.lineTo(0.11, 0); cup.lineTo(0.14, 0.24); cup.lineTo(-0.14, 0.24); cup.closePath();
    const ci = new THREE.Shape(); ci.moveTo(-0.14, -0.03); ci.lineTo(0.14, -0.03); ci.lineTo(0.175, 0.27); ci.lineTo(-0.175, 0.27); ci.closePath();
    const g = new THREE.Group(); g.add(shapeMesh(ci, INK, 0), shapeMesh(cup, '#f2ede2', 0.002));
    const band = shapeMesh(roundedRectShape(0.25, 0.05, 0), '#d97757', 0.004); band.position.y = 0.12; g.add(band);
    g.position.set(-1.8 + (k % 2) * 0.03, topY + k * 0.17, DESK.z - 0.18 - k * 0.003); g.rotation.z = (hash(k, 898) - 0.5) * 0.1;
    desk.add(g);
  }
  const duck = new THREE.Group();
  const duckBody = inkedRect(0.36, 0.22, 0.1, '#ffd23f', 0.035); duckBody.position.y = 0.11;
  const duckHead = inkedCircle(0.1, '#ffd23f', 0.035); duckHead.position.set(0.1, 0.3, 0.01);
  const beak = shapeMesh(roundedRectShape(0.09, 0.05, 0.02), '#f28c28', 0.02); beak.position.set(0.21, 0.29, 0);
  const eye = shapeMesh(roundedRectShape(0.025, 0.04, 0.01), INK, 0.02); eye.position.set(0.12, 0.32, 0);
  duck.add(duckBody, duckHead, beak, eye);
  duck.position.set(3.05, topY, DESK.z - 0.2);
  desk.add(duck);
  scene.add(desk);

  const clawd = new Clawd();
  const rig = new THREE.Group();
  rig.add(clawd.root);
  scene.add(rig);
  wearTag(clawd.body);
  let keys: ReturnType<typeof keyRing> | null = null;
  if (opts.keys ?? true) {
    keys = keyRing(0.62);
    keys.position.set(0.5, 0.36, 0.03);
    clawd.body.add(keys);
  }

  const room: ControlRoom = {
    scene, camera, clawd, rig, screens, desk, mug,
    lightsOut: t => clamp((t - 132.5) / 0.95), // "Kill the lights": the city outside goes dark with the globe
    alarm: t => clamp((t - THREAT.start) / 0.3),
    aim(x, y, z, tx, ty, tz) { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    reset(f) {
      planes.forEach(p => p.update(f));
      ticker.update(f);
      ledStrip.update(f);
      buttons.update(f);
      minis.forEach(m => m.update(f));
      sideScreens.forEach(s => s.update(f));
      mug.update(f.t);
      city.set(room.lightsOut(f.t));
      const a = room.alarm(f.t);
      for (const b of beacons) {
        b.domeMat.color.set('#5a1f22').lerp(new THREE.Color('#ff3b30'), a);
        b.beam.visible = b.halo.visible = a > 0.01;
        b.beam.rotation.y = f.t * 5.5 + b.i * 1.3;
        (b.beam.material as THREE.MeshBasicMaterial).opacity = 0.11 * a;
        (b.halo.material as THREE.MeshBasicMaterial).opacity = 0.4 * a * (0.6 + 0.4 * Math.abs(Math.cos(f.t * 5.5 + b.i * 1.3)));
      }
      rig.position.copy(SPOT);
      rig.scale.setScalar(1);
      rig.rotation.set(0, 0, 0);
      clawd.root.position.set(0, 0, 0);
      clawd.root.rotation.set(0, 0, 0);
      clawd.root.visible = true;
      if (keys) keys.swingTo(Math.sin(f.t * 3.3) * 0.12, f.t);
      desk.visible = true;
    },
  };
  return room;
}
