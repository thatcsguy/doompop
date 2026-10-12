// Intro and verse 1 (0:00 to the pre-chorus): dawn in the room, then life inside the chat window.
// Storyboard rows 0 to 8. Shots cut on the beat nearest each line's sung start, and every action
// inside a shot is keyed to the sung time of a word (W(line, word)).
import * as THREE from 'three';
import { defineShot, type Frame, type PostSettings, type Shot, type ShotWorld } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, REST, mixMood, type Mood, type Pose } from '../../../engine/characters/clawd';
import { INK, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../../engine/flat';
import { hash } from '../../../engine/rng';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import {
  BUBBLE, CHAT_X, DAY_LYRICS, FIELD, FLAT_POST, FLOOR_Y, FONT, PAL, SH, SIDEBAR, SW, TOPBAR,
  beatHop, buildDesk, frameCam, hop, label, wordBlock, type DeskSet,
} from '../world';
import { blob, coffeeMug, confetti, glow, sparkles, speedLines, starShape } from '../props';

type Update = (f: Frame) => void;
/** Where Clawd's contact shadow sits this frame: FLOOR_Y unless the shot moves it; null hides it. */
interface Ground { y: number | null }
interface Opts {
  overlay?: ShotWorld['overlay'];
  dawn?: (f: Frame) => number;
  post?: (f: Frame) => Partial<PostSettings>;
}

/** A shot on the desk set: setup() adds its props and returns the per-frame update. */
function deskShot(id: string, start: number, end: number, setup: (s: DeskSet, gnd: Ground) => Update, o: Opts = {}): Shot {
  return defineShot({
    id, start, end,
    build() {
      const s = buildDesk();
      const shadow = shapeMesh(circleShape(1), ownMat(INK, 0.16, true), 0, 32);
      s.screen.add(shadow);
      const gnd: Ground = { y: FLOOR_Y };
      const update = setup(s, gnd);
      return {
        scene: s.scene, camera: s.camera,
        update(f) {
          s.reset(f, o.dawn ? o.dawn(f) : 1);
          gnd.y = FLOOR_Y;
          update(f);
          const c = s.clawd.root, air = gnd.y === null ? 0 : c.position.y - gnd.y;
          shadow.visible = gnd.y !== null && c.visible && air > -0.05;
          const k = 1 - clamp(air / 2.2);
          shadow.position.set(c.position.x, (gnd.y ?? 0) + 0.02, c.position.z - 0.03);
          shadow.scale.set(0.78 * (0.6 + 0.4 * k), 0.09 * (0.6 + 0.4 * k), 1);
          (shadow.material as THREE.MeshBasicMaterial).opacity = 0.16 * k;
        },
        overlay: o.overlay,
        post: o.post ? (f: Frame) => ({ ...FLAT_POST, ...o.post!(f) }) : () => FLAT_POST,
        lyricStyle: DAY_LYRICS,
      };
    },
  });
}

const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
/** Top of Clawd's head for a root height, bounce and squash (matches the rig's setPose). */
const headY = (y: number, bounce = 0, squash = 0) => y + bounce * 0.35 + 1.02 * (1 - 0.2 * squash);
const LETTER_COLS = ['#ffd166', '#8fd6a0', '#9fc7f2', '#f2a09a', '#c9a7eb'];
const CORAL = '#d97757';

/** Letters drifting up through the chat column: the window's idle life. drift scrolls them left. */
function floaters(parent: THREE.Group, n = 24, seed = 1) {
  const glyphs = 'abcdefghijklmnopqrstuvwxyz?!&';
  const x0 = -SW / 2 + SIDEBAR + 0.3, span = SW - SIDEBAR - 0.6;
  const items = Array.from({ length: n }, (_, i) => {
    const ch = glyphs[Math.floor(hash(i, seed, 1) * glyphs.length)];
    const col = LETTER_COLS[i % LETTER_COLS.length];
    const m = staticPlane(0.5, 0.5, 110, (g, W, H) => {
      g.font = `900 ${H * 0.72}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = H * 0.09; g.strokeStyle = 'rgba(43,29,22,0.6)'; g.lineJoin = 'round';
      g.strokeText(ch, W / 2, H * 0.54);
      g.fillStyle = col; g.fillText(ch, W / 2, H * 0.54);
    });
    parent.add(m);
    return { m, x: x0 + hash(i, seed, 2) * span, v: 0.16 + hash(i, seed, 3) * 0.2, ph: hash(i, seed, 4), s: 0.42 + hash(i, seed, 5) * 0.45, w: hash(i, seed, 6) * 6 };
  });
  const y0 = FLOOR_Y + 0.2, rise = SH / 2 - TOPBAR - 0.2 - y0;
  return (f: Frame, drift = 0, alpha = 0.55) => {
    for (const it of items) {
      const k = ((f.t * it.v) / rise + it.ph) % 1;
      const x = it.x + Math.sin(f.t * 0.8 + it.w) * 0.25 - drift;
      it.m.position.set(x0 + ((((x - x0) % span) + span) % span), y0 + k * rise, 0.03);
      it.m.scale.setScalar(it.s);
      it.m.rotation.z = Math.sin(f.t * 1.1 + it.w) * 0.3;
      (it.m.material as THREE.MeshBasicMaterial).opacity = alpha * Math.sin(k * Math.PI);
    }
  };
}

/** The app's logo: a coral eight-petal spark. */
function sparkLogo(r = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const len = r * (i % 2 ? 0.8 : 1), w = r * 0.34;
    const o = shapeMesh(roundedRectShape(w + 0.08 * r, len + 0.08 * r, (w + 0.08 * r) / 2, 0, len / 2), INK, 0);
    const p = shapeMesh(roundedRectShape(w, len, w / 2, 0, len / 2), CORAL, 0.003);
    o.rotation.z = p.rotation.z = (i / 8) * Math.PI * 2;
    g.add(o, p);
  }
  g.add(shapeMesh(circleShape(r * 0.3), CORAL, 0.004));
  return g;
}

function rectShape(x0: number, y0: number, x1: number, y1: number, holes: [number, number, number, number][] = []) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  for (const [a, b, c, d] of holes) {
    const h = new THREE.Path();
    h.moveTo(a, b); h.lineTo(a, d); h.lineTo(c, d); h.lineTo(c, b); h.closePath();
    s.holes.push(h);
  }
  return s;
}

function heartShape(r: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -r);
  s.bezierCurveTo(-r * 1.6, r * 0.1, -r * 0.7, r * 1.25, 0, r * 0.45);
  s.bezierCurveTo(r * 0.7, r * 1.25, r * 1.6, r * 0.1, 0, -r);
  return s;
}
function heart(r: number, color = '#ff6f8f') {
  const g = new THREE.Group();
  const ink = shapeMesh(heartShape(r * 1.18), INK, 0, 16); ink.position.y = -r * 0.04;
  g.add(ink, shapeMesh(heartShape(r), color, 0.003, 16));
  return g;
}

/** A thumbs-up hand icon as one silhouette. Origin at the fist's centre; flip it for thumbs-down. */
function thumbIcon(fill: THREE.Material) {
  return blob([
    { w: 0.46, h: 0.38, r: 0.08 },
    { w: 0.16, h: 0.36, r: 0.08, x: -0.1, y: 0.3, rot: -0.15 },
    { w: 0.13, h: 0.42, r: 0.03, x: -0.33, y: -0.01 },
  ], fill, 0.04);
}

/** A white mouse pointer, tip at the origin. */
function pointer() {
  const pts: [number, number][] = [[0, 0], [0, -0.9], [0.22, -0.69], [0.37, -1.02], [0.52, -0.95], [0.37, -0.63], [0.66, -0.62]];
  const mk = (sc: number, color: string, z: number) => {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo((x - 0.25) * sc + 0.25, (y + 0.5) * sc - 0.5) : s.moveTo((x - 0.25) * sc + 0.25, (y + 0.5) * sc - 0.5)));
    s.closePath();
    return shapeMesh(s, color, z);
  };
  const g = new THREE.Group();
  g.add(mk(1.16, INK, 0), mk(1, '#ffffff', 0.003));
  return g;
}

// ---------------------------------------------------------------------------------------------
// Intro props: the keyboard close-up and the person's hands

const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEY = { pitch: 0.84, w: 0.7, h: 0.38 };
function keyboardProp() {
  const g = new THREE.Group();
  const trap = (s: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-5.0 * s, 1.18 * s); sh.lineTo(5.0 * s, 1.18 * s); sh.lineTo(5.5 * s, -1.18 * s); sh.lineTo(-5.5 * s, -1.18 * s); sh.closePath();
    return sh;
  };
  g.add(shapeMesh(trap(1.02), INK, 0), shapeMesh(trap(1), '#e9e4dc', 0.002));
  const lip = shapeMesh(roundedRectShape(11.1, 0.28, 0.1, 0, -1.3), '#cfc8bd', -0.002);
  const lipInk = shapeMesh(roundedRectShape(11.22, 0.4, 0.14, 0, -1.3), INK, -0.004);
  g.add(lipInk, lip);
  const keys = new Map<string, { g: THREE.Group; top: THREE.Group; mat: THREE.MeshBasicMaterial; x: number; y: number }>();
  const addKey = (id: string, text: string, x: number, y: number, w: number) => {
    const k = new THREE.Group();
    const mat = ownMat('#fbf8f2');
    const base = inkedRect(w, KEY.h, 0.07, '#cbc3b7', 0.03); base.position.y = -0.06;
    const top = new THREE.Group();
    top.add(inkedRect(w, KEY.h, 0.07, mat, 0.03));
    if (text) { const t = label(text, w, KEY.h, { size: 0.24, color: 'rgba(43,29,22,0.7)', weight: 700 }); t.position.z = 0.01; top.add(t); }
    top.position.z = 0.01;
    k.add(base, top);
    k.position.set(x, y, 0.01);
    g.add(k);
    keys.set(id, { g: k, top, mat, x, y });
  };
  KB_ROWS.forEach((row, r) => {
    const y = 0.72 - r * 0.5, x0 = -((row.length - 1) * KEY.pitch) / 2 - 0.3 + r * 0.18;
    [...row].forEach((ch, i) => addKey(ch, ch, x0 + i * KEY.pitch, y, KEY.w));
  });
  addKey('enter', 'enter', 3.95, 0.22, 1.25);
  addKey('shift', 'shift', -3.95, -0.28, 1.2);
  addKey('tab', '', -4.25, 0.72, 0.6);
  addKey('space', '', -0.2, -0.8, 4.6);
  return Object.assign(g, {
    keys,
    /** Press depth 0..1 for a key this frame. */
    press(id: string, k: number) {
      const key = keys.get(id)!;
      key.top.position.y = -0.05 * k;
      key.mat.color.set('#fbf8f2').lerp(new THREE.Color('#f6c9b6'), k);
    },
  });
}

/** A capsule person's mitten hand and sleeve, reaching up from below. Origin at the fingertips. */
function mitten(side: -1 | 1) {
  const g = new THREE.Group();
  const sleeve = inkedRect(1.1, 4.0, 0.4, PAL.personShade, 0.07); sleeve.position.set(0, -2.6, 0);
  const cuff = inkedRect(1.2, 0.42, 0.18, '#f2efe8', 0.06); cuff.position.set(0, -0.72, 0.01);
  const hand = blob([
    { w: 1.0, h: 0.85, r: 0.38, y: -0.32 },
    { w: 0.3, h: 0.55, r: 0.15, x: -side * 0.52, y: -0.28, rot: side * 0.5 },
  ], PAL.person, 0.07);
  hand.position.z = 0.02;
  g.add(sleeve, cuff, hand);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Verse props

/** A chunky toy made of bars with a darker extruded side (the check for yes, the cross for no).
 *  Origin at its lowest point. */
function barToy(bars: { dir: number; len: number }[], face: string, side: string, thick = 0.6) {
  const parts = bars.map(b => {
    const a = (b.dir * Math.PI) / 180, back = thick / 2; // run each bar a little past the joint
    const mid = (b.len - back) / 2;
    return { w: thick, h: b.len + back, r: 0.1, x: Math.cos(a) * mid, y: Math.sin(a) * mid, rot: a - Math.PI / 2 };
  });
  let minY = Infinity;
  for (const p of parts) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = (sx * p.w) / 2, ly = (sy * p.h) / 2;
    minY = Math.min(minY, p.y + lx * Math.sin(p.rot) + ly * Math.cos(p.rot));
  }
  const inner = new THREE.Group();
  const back = blob(parts, side, 0.06); back.position.set(0.13, -0.11, 0);
  const front = blob(parts, face, 0.06); front.position.z = 0.01;
  // a soft highlight stripe along each bar
  const hl = parts.map(p => {
    const m = shapeMesh(roundedRectShape(0.1, p.h * 0.6, 0.05), ownMat('#ffffff', 0.45, true), 0.02);
    m.position.set(p.x - Math.cos(p.rot) * p.w * 0.22, p.y - Math.sin(p.rot) * p.w * 0.22, 0.02);
    m.rotation.z = p.rot;
    return m;
  });
  inner.add(back, front, ...hl);
  inner.position.y = -minY + 0.04;
  const g = new THREE.Group();
  g.add(inner);
  return Object.assign(g, { lift: -minY + 0.04, parts });
}

/** The toy's silhouette as a dashed outline with a faint fill: the slot it will drop into. */
function ghostOf(toy: ReturnType<typeof barToy>) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of toy.parts) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = (sx * p.w) / 2, ly = (sy * p.h) / 2;
    const x = p.x + lx * Math.cos(p.rot) - ly * Math.sin(p.rot), y = p.y + lx * Math.sin(p.rot) + ly * Math.cos(p.rot);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  x0 -= 0.15; x1 += 0.15; y0 -= 0.15; y1 += 0.15;
  const w = x1 - x0, h = y1 - y0;
  const plane = staticPlane(w, h, 120, (g, Wd) => {
    const u = Wd / w;
    const path = () => {
      g.beginPath();
      for (const p of toy.parts) {
        g.save(); g.translate((p.x - x0) * u, (y1 - p.y) * u); g.rotate(-p.rot);
        g.roundRect((-p.w / 2) * u, (-p.h / 2) * u, p.w * u, p.h * u, 0.1 * u);
        g.restore();
      }
    };
    g.setLineDash([0.17 * u, 0.13 * u]); g.lineWidth = 0.12 * u; g.strokeStyle = 'rgba(43,29,22,0.6)'; g.lineCap = 'round';
    path(); g.stroke();
    g.globalCompositeOperation = 'destination-out'; // keep only the outer edge of the union
    path(); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(43,29,22,0.07)'; path(); g.fill();
  });
  plane.position.set((x0 + x1) / 2, (y0 + y1) / 2 + toy.lift, 0);
  const g = new THREE.Group();
  g.add(plane);
  return g;
}

/** A sticky note with a red scribble that turns into neat green lines. */
function stickyNote(i: number, size = 1.3) {
  const g = new THREE.Group();
  g.add(inkedRect(size, size, 0.02, PAL.sticky, 0.05));
  const fold = shapeMesh(roundedRectShape(size, size * 0.15, 0, 0, size * 0.425), ownMat('#f5cf55'), 0.004);
  const scribble = staticPlane(size, size, 150, (c, Wd, Hd) => {
    c.strokeStyle = PAL.red; c.lineWidth = Wd * 0.03; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let r = 0; r < 4; r++) {
      c.beginPath();
      const y0 = Hd * (0.32 + r * 0.15);
      c.moveTo(Wd * 0.15, y0);
      for (let k = 1; k <= 8; k++) c.lineTo(Wd * (0.15 + k * 0.088), y0 + (hash(i, r, k) - 0.5) * Hd * 0.13);
      c.stroke();
    }
    c.beginPath(); c.moveTo(Wd * 0.2, Hd * 0.28); c.lineTo(Wd * 0.82, Hd * 0.86); c.stroke();
    c.beginPath(); c.moveTo(Wd * 0.78, Hd * 0.3); c.lineTo(Wd * 0.25, Hd * 0.8); c.stroke();
  });
  const neat = staticPlane(size, size, 150, (c, Wd, Hd) => {
    c.strokeStyle = PAL.green; c.lineWidth = Wd * 0.028; c.lineCap = 'round';
    for (let r = 0; r < 3; r++) {
      c.beginPath(); c.moveTo(Wd * 0.16, Hd * (0.34 + r * 0.16)); c.lineTo(Wd * (0.6 + hash(i, r) * 0.24), Hd * (0.34 + r * 0.16)); c.stroke();
    }
    c.lineWidth = Wd * 0.055; c.lineJoin = 'round'; c.beginPath();
    c.moveTo(Wd * 0.6, Hd * 0.8); c.lineTo(Wd * 0.69, Hd * 0.89); c.lineTo(Wd * 0.87, Hd * 0.68); c.stroke();
  });
  scribble.position.z = 0.01; neat.position.z = 0.01;
  const pin = inkedCircle(0.09, '#e0504a', 0.03); pin.position.set(0, size * 0.42, 0.02);
  g.add(fold, scribble, neat, pin);
  return Object.assign(g, { scribble, neat });
}

/** A round face icon: frown (0) to smile (1). */
function faceIcon(r: number, fill: string, smile: boolean) {
  const g = new THREE.Group();
  g.add(inkedCircle(r, fill, 0.05));
  const f = staticPlane(r * 2, r * 2, 160, (c, Wd, Hd) => {
    c.fillStyle = INK;
    for (const s of [-1, 1]) c.fillRect(Wd * (0.5 + s * 0.17) - Wd * 0.045, Hd * 0.3, Wd * 0.09, Hd * 0.17);
    c.strokeStyle = INK; c.lineWidth = Wd * 0.075; c.lineCap = 'round';
    c.beginPath();
    if (smile) c.arc(Wd / 2, Hd * 0.52, Wd * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    else c.arc(Wd / 2, Hd * 0.82, Wd * 0.2, 1.18 * Math.PI, 1.82 * Math.PI);
    c.stroke();
  });
  f.position.z = 0.01;
  g.add(f);
  return g;
}

/** The open house drawing that the tangle becomes (shot 6), as a polyline in local units. */
const HOUSE: [number, number][] = [
  [1.7, -1.3], [-1.7, -1.3], [-1.7, 0.25], [0, 1.45], [0.8, 0.885], [0.8, 1.35], [1.2, 1.35], [1.2, 0.603], [1.7, 0.25], [1.7, -1.3], [2.9, -1.3],
];
function resample(pts: [number, number][], n: number): [number, number][] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / (n - 1)) * total, i = 0;
    while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
    const u = seg[i] ? d / seg[i] : 0;
    out.push([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]);
  }
  return out;
}
const N_THREAD = 260;
const HOUSE_PTS = resample(HOUSE, N_THREAD);
const TANGLE_PTS: [number, number][] = HOUSE_PTS.map((_, i) => {
  const s = (i / (N_THREAD - 1)) * Math.PI * 2 * 1.6;
  const x = (Math.sin(7.3 * s) + 0.6 * Math.sin(13.1 * s + 1)) / 1.6;
  const y = (Math.cos(5.7 * s) + 0.6 * Math.cos(11.3 * s + 2)) / 1.6;
  return [x * 0.95 - 0.2, y * 0.95 - 0.3];
});

function drawThread(g: CanvasRenderingContext2D, W: number, pw: number, ph: number, k: number, hand: [number, number], shake = 0, t = 0) {
  const u = W / pw, X = (x: number) => (x + pw / 2) * u, Y = (y: number) => (ph / 2 - y) * u;
  g.lineWidth = 0.08 * u; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK;
  g.beginPath();
  for (let i = 0; i < N_THREAD; i++) {
    // the end nearest Clawd's paw unravels first
    const ki = smooth(clamp(k * 1.6 - (1 - i / (N_THREAD - 1)) * 0.6));
    const j = shake * (1 - ki) * 0.06;
    const x = lerp(TANGLE_PTS[i][0], HOUSE_PTS[i][0], ki) + j * Math.sin(t * 47 + i), y = lerp(TANGLE_PTS[i][1], HOUSE_PTS[i][1], ki) + j * Math.cos(t * 53 + i * 1.3);
    if (i === 0) g.moveTo(X(x), Y(y)); else g.lineTo(X(x), Y(y));
  }
  g.lineTo(X(hand[0]), Y(hand[1]));
  g.stroke();
}

/** The house's colour fills, chimney smoke and a tree, behind the thread line. Local units. */
function houseFills() {
  const g = new THREE.Group();
  const wall = shapeMesh(rectShape(-1.7, -1.3, 1.7, 0.25), '#ffe3b8', 0);
  const roofS = new THREE.Shape(); roofS.moveTo(-1.7, 0.25); roofS.lineTo(0, 1.45); roofS.lineTo(1.7, 0.25); roofS.closePath();
  const roof = shapeMesh(roofS, '#e8795c', 0.001);
  const chim = shapeMesh(rectShape(0.8, 0.6, 1.2, 1.35), '#c9654a', 0.0005);
  const door = inkedRect(0.62, 0.95, 0.05, '#b07a52', 0.05); door.position.set(-0.75, -0.82, 0.002);
  const knob = inkedCircle(0.05, '#ffd166', 0.02); knob.position.set(-0.57, -0.85, 0.004);
  const win = inkedRect(0.72, 0.72, 0.03, '#ffd166', 0.05); win.position.set(0.75, -0.45, 0.002);
  const bar1 = shapeMesh(roundedRectShape(0.05, 0.72, 0), INK, 0.004); bar1.position.set(0.75, -0.45, 0);
  const bar2 = shapeMesh(roundedRectShape(0.72, 0.05, 0), INK, 0.004); bar2.position.set(0.75, -0.45, 0);
  const winGlow = glow(0.75, '#ffd166', 0.4); winGlow.position.set(0.75, -0.45, -0.002);
  const tree = new THREE.Group();
  const trunk = inkedRect(0.24, 0.8, 0.04, '#a8744f', 0.05); trunk.position.y = 0.4;
  const crown = blob([{ w: 1.15, h: 1.0, r: 0.45, y: 1.2 }, { w: 0.8, h: 0.75, r: 0.35, x: -0.3, y: 1.55 }, { w: 0.75, h: 0.7, r: 0.33, x: 0.3, y: 1.6 }], '#7cc58a', 0.05);
  crown.position.z = 0.01;
  tree.add(trunk, crown);
  tree.position.set(-2.55, -1.3, 0.003);
  const puffs = [0, 1, 2, 3].map(() => { const p = inkedCircle(0.16, '#ffffff', 0.035); g.add(p); return p; });
  g.add(wall, roof, chim, winGlow, door, knob, win, bar1, bar2, tree);
  /** Reveal: wall, roof (with chimney and door), light (window, smoke) and tree, each 0..1. */
  return Object.assign(g, {
    set(t: number, k: { wall: number; roof: number; light: number; tree: number }) {
      wall.visible = k.wall > 0.01; wall.scale.set(1, Math.max(0.01, k.wall), 1); wall.position.y = -1.3 * (1 - k.wall);
      for (const m of [roof, chim]) { m.visible = k.roof > 0.01; m.scale.setScalar(Math.max(0.01, k.roof)); m.position.y = 0.25 * (1 - k.roof); }
      door.visible = knob.visible = k.roof > 0.01; door.scale.setScalar(Math.max(0.01, k.roof));
      win.visible = bar1.visible = bar2.visible = k.wall > 0.5;
      (win.fill.material as THREE.MeshBasicMaterial).color.set('#efe6d6').lerp(new THREE.Color('#ffd166'), k.light);
      winGlow.visible = k.light > 0.01; winGlow.scale.setScalar(Math.max(0.01, k.light) * (1 + 0.06 * Math.sin(t * 5)));
      tree.visible = k.tree > 0.01; tree.scale.setScalar(Math.max(0.01, k.tree));
      puffs.forEach((p, i) => {
        const c = ((t * 0.55 + i / puffs.length) % 1);
        p.visible = k.light > 0.5;
        p.position.set(1.0 + Math.sin(c * 5 + i) * 0.12 + c * 0.35, 1.5 + c * 1.1, 0.003);
        p.scale.setScalar(Math.max(0.01, (0.6 + c * 1.1) * Math.sin(Math.min(1, c * 1.2) * Math.PI) * clamp(k.light * 2 - 1)));
      });
    },
  });
}

// ---------------------------------------------------------------------------------------------

export function verse1Shots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const L = (n: number) => lyrics.lines[n - 1];
  const W = (n: number, i: number) => L(n).words[i].start;
  const nearestBeat = (t: number) => audio.beats.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
  const T_ON = 2.5, T_TYPE = 7.22, T_BLUSH = 26.0; // intro swell, the hi-hats coming in, a downbeat
  const cut = [0, T_TYPE, L(1).start - 0.03, ...[2, 3, 4, 5, 6, 7].map(n => nearestBeat(L(n).start)), T_BLUSH, nearestBeat(L(8).start), nearestBeat(L(9).start)];

  // 0a. Dawn. A dark room; the monitor wakes on the intro's first swell, the app assembles itself,
  //     the sky warms in the window and the person stretches.
  const s0a = deskShot('v1-dawn', cut[0], cut[1], s => {
    const night = ownMat('#0b1030', 0.85, true), nightFront = ownMat('#0b1030', 0.85, true);
    const back = shapeMesh(rectShape(-150, -60, 150, 60, [[-18.8, -1.8, -12.4, 8.2]]), night, 0);
    back.position.z = -0.6;
    const front = shapeMesh(rectShape(-150, -60, 150, 60, [[-8.62, -7.2, 8.62, 5.12]]), nightFront, 0);
    front.position.z = 1.45;
    const spill = glow(1, '#dce9ff', 0.2); spill.scale.set(13, 9, 1); spill.position.set(0, 0, -0.55);
    const led = shapeMesh(circleShape(0.1), ownMat('#f2b84b'), 0); led.position.set(SW / 2 - 0.4, -SH / 2 - 0.3, 0.84);
    s.scene.add(back, front, spill, led);
    const off = shapeMesh(roundedRectShape(SW, SH, 0), ownMat('#10121b', 1, true), 0.7);
    const flash = shapeMesh(roundedRectShape(SW, SH, 0), ownMat('#ffffff', 0, true), 0.71);
    const logo = sparkLogo(1);
    const barBack = inkedRect(3.2, 0.14, 0.07, '#ece3d5', 0.03), barFill = shapeMesh(roundedRectShape(3.2, 0.14, 0.07, 1.6, 0), CORAL, 0.01);
    barBack.position.set(0, -1.05, 0.3); barFill.position.set(-1.6, -1.05, 0.3);
    const hello = label('Good morning', 4.8, 0.8, { size: 0.56, weight: 800, align: 'left' });
    s.screen.add(off, flash, logo, barBack, barFill, hello);
    const fl = floaters(s.screen, 22, 3);
    return f => {
      const day = smooth(unlerp(f.t, 2.8, 7.0));
      night.opacity = nightFront.opacity = 0.86 * (1 - day);
      const on = f.t >= T_ON;
      (spill.material as THREE.MeshBasicMaterial).opacity = on ? 0.22 * (1 - day) * smooth(unlerp(f.t, T_ON, T_ON + 0.3)) : 0;
      (led.material as THREE.MeshBasicMaterial).color.set(on ? '#7be08d' : Math.sin(f.t * 5) > 0 ? '#f2b84b' : '#5a4630');
      (off.material as THREE.MeshBasicMaterial).opacity = 1 - smooth(unlerp(f.t, T_ON, T_ON + 0.2));
      (flash.material as THREE.MeshBasicMaterial).opacity = on ? 0.6 * decay(f.t - T_ON, 0.18) : 0;
      // boot splash: the logo springs in and a bar loads, then the app assembles around it
      const asm = easeInOutCubic(unlerp(f.t, 4.5, 5.0));
      const pop = easeOutBack(unlerp(f.t, T_ON + 0.05, T_ON + 0.6), 2);
      logo.visible = pop > 0.01;
      logo.position.set(lerp(0, CHAT_X - 2.2, asm), lerp(0.35, 0.95, asm), 0.3);
      logo.scale.setScalar(Math.max(0.01, pop) * lerp(1, 0.42, asm));
      logo.rotation.z = -(f.t - T_ON) * 0.5;
      const load = unlerp(f.t, 2.9, 4.35);
      barBack.visible = barFill.visible = f.t > T_ON + 0.3 && f.t < 4.55;
      barFill.scale.x = Math.max(0.001, easeInOutCubic(load));
      // the sidebar unfolds from the left edge and the title bar from the top (never past the bezel)
      const sk = Math.max(0.001, easeOutCubic(unlerp(f.t, 4.55, 5.0))), tk = Math.max(0.001, easeOutCubic(unlerp(f.t, 4.65, 5.05)));
      s.ui.side.scale.x = sk; s.ui.side.position.x = -SW / 2 + (SIDEBAR / 2) * sk;
      s.ui.top.scale.y = tk; s.ui.top.position.y = SH / 2 - (TOPBAR / 2) * tk;
      s.field.position.y = lerp(FIELD.y - 1.6, FIELD.y, easeOutBack(unlerp(f.t, 4.75, 5.2)));
      const hi = easeOutBack(unlerp(f.t, 5.0, 5.35));
      hello.visible = hi > 0.01;
      hello.position.set(CHAT_X + 0.65, 0.95, 0.3);
      hello.scale.setScalar(Math.max(0.01, hi));
      const blink = Math.floor(f.t / 0.53) % 2 === 0;
      s.setTyped('', f.t > 5.3 && blink, f.t > 5.2);
      fl(f, 0, 0.55 * smooth(unlerp(f.t, 5.0, 6.0)));
      s.clawd.root.visible = false;
      // the person wakes: a long stretch, then leans in to type
      const stretch = smooth(unlerp(f.t, 3.1, 3.7)) * (1 - smooth(unlerp(f.t, 4.3, 4.8)));
      s.person.pose(stretch, 0, Math.sin(f.t * 1.6) * 0.3 + smooth(unlerp(f.t, 6.0, 7.0)) * 0.6);
      const k = easeInOutCubic(unlerp(f.t, 0, cut[1] + 0.6));
      frameCam(s.camera, lerp(0.8, 1.6, k), lerp(-0.2, -1.4, k), lerp(27, 13.5, k));
    };
  }, {
    dawn: f => 0.04 + 0.96 * smooth(unlerp(f.t, 1.0, 7.2)),
    post: f => ({ vignette: lerp(0.45, 0.12, smooth(unlerp(f.t, 2.8, 7.0))) }),
    overlay(g, f) { // fade up from black
      const a = 1 - smooth(unlerp(f.t, 0.2, 2.2));
      if (a <= 0) return;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.fillRect(0, 0, f.w, f.h);
    },
  });

  // 0b. "begin": close on the keyboard. Two mitten hands type it, hit enter, and the message flies
  //     up into the chat. The camera follows it into the screen, and something peeks out of the box.
  const keyAt = [...'begin'].map((_, i) => 7.5 + i * 0.32 + hash(i, 77) * 0.06), enterAt = 9.2;
  const s0b = deskShot('v1-type', cut[1], cut[2], s => {
    const desk = shapeMesh(rectShape(-60, -30, 60, -6.35), PAL.desk, 0);
    const deskEdge = shapeMesh(rectShape(-60, -6.4, 60, -6.3), INK, 0.001);
    desk.position.z = deskEdge.position.z = 1.35;
    const kb = keyboardProp(); kb.position.set(1.2, -7.4, 1.5);
    const mug = coffeeMug('#8fc59a', 2.6); mug.position.set(8.9, -7.6, 1.45);
    const pad = inkedRect(2.0, 1.4, 0.04, PAL.sticky, 0.06); pad.position.set(-5.9, -7.0, 1.42); pad.rotation.z = 0.12;
    const pen = inkedRect(2.2, 0.16, 0.08, '#7aa6d6', 0.05); pen.position.set(-5.7, -7.75, 1.44); pen.rotation.z = -0.25;
    const hands = [mitten(-1), mitten(1)];
    s.scene.add(desk, deskEdge, kb, mug, pad, pen, ...hands);
    const logo = sparkLogo(0.42); logo.position.set(CHAT_X - 2.2, 0.95, 0.3);
    const hello = label('Good morning', 4.8, 0.8, { size: 0.56, weight: 800, align: 'left' });
    hello.position.set(CHAT_X + 0.65, 0.95, 0.3);
    const fl = floaters(s.screen, 22, 3);
    s.screen.add(logo, hello);
    const kpos = (id: string) => { const k = kb.keys.get(id)!; return new THREE.Vector3(kb.position.x + k.x, kb.position.y + k.y, 0); };
    const plan: { id: string; t: number; hand: 0 | 1 }[] = [
      { id: 'b', t: keyAt[0], hand: 0 }, { id: 'e', t: keyAt[1], hand: 0 }, { id: 'g', t: keyAt[2], hand: 0 },
      { id: 'i', t: keyAt[3], hand: 1 }, { id: 'n', t: keyAt[4], hand: 1 }, { id: 'enter', t: enterAt, hand: 1 },
    ];
    const rest = [new THREE.Vector3(-1.4, -6.9, 0), new THREE.Vector3(3.6, -7.0, 0)];
    return f => {
      const typedN = keyAt.filter(k => f.t >= k).length;
      const sent = f.t >= enterAt;
      const blink = Math.floor(f.t / 0.53) % 2 === 0;
      s.setTyped(sent ? '' : 'begin'.slice(0, typedN), sent ? blink : blink || (typedN > 0 && f.t - keyAt[typedN - 1] < 0.3), !sent && typedN === 0);
      for (const p of plan) kb.press(p.id, Math.max(0, Math.sin(clamp((f.t - p.t + 0.05) / 0.16) * Math.PI)) * (p.id === 'enter' ? 1.3 : 1));
      // hands: hover to each key, dip on the press, withdraw after enter
      hands.forEach((h, hi) => {
        const mine = plan.filter(p => p.hand === hi);
        let at = rest[hi].clone();
        for (let j = 0; j < mine.length; j++) {
          const from = j === 0 ? rest[hi] : kpos(mine[j - 1].id), to = kpos(mine[j].id);
          const k = easeInOutCubic(unlerp(f.t, mine[j].t - (j === 0 ? 0.3 : 0.24), mine[j].t - 0.05));
          if (f.t >= mine[j].t - (j === 0 ? 0.3 : 0.24)) at = from.clone().lerp(to, k);
        }
        const dip = Math.max(...mine.map(p => Math.max(0, Math.sin(clamp((f.t - p.t + 0.07) / 0.18) * Math.PI))));
        const inK = easeOutCubic(unlerp(f.t, cut[1] + hi * 0.1, cut[1] + 0.35 + hi * 0.1));
        const outK = easeInCubic(unlerp(f.t, enterAt + 0.25, enterAt + 0.7));
        h.position.set(at.x + (hi ? 0.15 : -0.15), at.y + 0.52 - dip * 0.22 - (1 - inK) * 5 - outK * 6, 1.6 + hi * 0.01);
        h.rotation.z = (hi ? -1 : 1) * (0.22 + dip * 0.05);
        h.scale.set(1, 1 - dip * 0.06, 1);
      });
      mug.update(f.t);
      // the sent message flies from the field up to its place; the greeting clears for the chat
      const fly = easeOutBack(unlerp(f.t, enterAt, enterAt + 0.5));
      s.bubble.visible = sent;
      s.bubble.position.set(lerp(FIELD.x - 4.4, BUBBLE.x, easeOutCubic(unlerp(f.t, enterAt, enterAt + 0.35))), lerp(FIELD.y, BUBBLE.y, fly), 0.1);
      s.bubble.scale.setScalar(lerp(0.4, 1, fly));
      s.field.scale.setScalar(1 + 0.03 * decay(f.t - enterAt, 0.12));
      const clear = easeInCubic(unlerp(f.t, enterAt + 0.1, enterAt + 0.5));
      logo.position.y = hello.position.y = 0.95 + clear * 1.2;
      logo.visible = hello.visible = clear < 0.99;
      (hello.material as THREE.MeshBasicMaterial).opacity = 1 - clear;
      logo.scale.setScalar(Math.max(0.01, 1 - clear));
      logo.rotation.z = -f.t * 0.5;
      fl(f);
      // two eyes peek over the edge of the box just before the verse
      const peek = easeOutBack(unlerp(f.t, 10.35, 10.55)) * (1 - easeInCubic(unlerp(f.t, 10.82, 10.94)));
      s.clawd.root.position.set(1.4, lerp(-4.3, -3.56, peek), 0.2);
      s.clawd.root.visible = peek > 0.01;
      s.clawd.setMood({ ...MOODS.excited, happy: 0, open: 1.1 }, f.t, { x: Math.sin((f.t - 10.5) * 9) * 0.8, y: 0.3 });
      s.clawd.setPose(pose({}));
      const k = easeInOutCubic(unlerp(f.t, enterAt + 0.05, 10.75));
      frameCam(s.camera, lerp(lerp(1.6, 1.9, unlerp(f.t, cut[1], enterAt)), 1.2, k), lerp(-5.4, -1.55, k), lerp(7.4, 4.6, k));
    };
  });

  // 1. "They gave me words and said, 'begin'": Clawd pops out of the chat box like toast, flips,
  //    lands, looks around delighted. W-O-R-D-S rain onto his head and stack; on the next beat he
  //    tosses them and they land in a row on the floor.
  const t1 = L(1).start, tWords = W(1, 3), tToss = 13.11;
  const FLOOR_TILES = [...'WORDS'].map((_, i) => -2.4 + i * 0.5);
  const s1 = deskShot('v1-pop', cut[2], cut[3], (s, gnd) => {
    const tiles = [...'WORDS'].map((ch, i) => { const b = wordBlock(ch, LETTER_COLS[i], 0.42, 0.42); s.screen.add(b); return b; });
    const burst = sparkles(9, 1.0, '#ffd166', 11); burst.group.position.set(1.4, FIELD.y + 0.7, 0.4);
    const ping = sparkles(6, 0.9, '#9fc7f2', 12);
    s.screen.add(burst.group, ping.group);
    const fl = floaters(s.screen, 24, 4);
    return f => {
      s.bubble.visible = true;
      const beg = W(1, 6);
      s.bubble.scale.setScalar(1 + 0.12 * Math.sin(clamp((f.t - beg) / 0.3) * Math.PI));
      ping.group.position.set(BUBBLE.x, BUBBLE.y, 0.3);
      ping.update(f.t - beg, 0.6);
      // the pop: up from behind the input field, a full flip, a squashy landing
      const kPop = unlerp(f.t, t1, t1 + 0.55);
      s.field.scale.set(1, 1 + 0.1 * Math.sin(clamp((f.t - t1 + 0.06) / 0.2) * Math.PI), 1);
      burst.update(f.t - t1, 0.7);
      const land = decay(f.t - (t1 + 0.55), 0.09);
      const toss = hop(f.t, tToss, tToss + 0.34, 0, 0, 0.55);
      const bounce = f.t > 12.6 && f.t < tToss ? beatHop(f.clock, f.t) * 0.3 : f.t > tToss + 0.45 ? beatHop(f.clock, f.t) * 0.35 : 0;
      const y = lerp(-3.56, FLOOR_Y, kPop) + Math.sin(kPop * Math.PI) * 1.6 + toss.y;
      s.clawd.root.position.set(1.4, y, 0.2);
      s.clawd.root.rotation.z = -Math.PI * 2 * easeInOutCubic(kPop);
      const caught = unlerp(f.t, tWords - 0.1, tWords + 0.1);
      // letters free-fall onto his head and stack, wobbling; the toss throws them into a row
      let hits = 0;
      const sway = Math.sin((f.t - tWords) * 8) * 0.07 * decay(f.t - tWords - 0.4, 0.5) * (f.t > tWords ? 1 : 0);
      const squash = land * 0.7 - (kPop > 0 && kPop < 1 ? 0.4 : 0) + (toss.k > 0 && toss.k < 1 ? -0.3 : 0);
      tiles.forEach((b, i) => {
        const tl = tWords - 0.02 + i * 0.1;
        const restY = headY(FLOOR_Y, bounce, 0) + 0.03 + i * 0.47;
        const fall = tl - f.t;
        const yStack = fall > 0 ? restY + 15 * fall * fall : restY;
        if (fall <= 0) hits += decay(-fall, 0.07);
        const sx = 1.4 + (hash(i, 5) - 0.5) * 0.1 + sway * i * 0.8;
        // the toss: each flies in an arc to its spot on the floor
        const kt = unlerp(f.t, tToss + 0.06 + i * 0.03, tToss + 0.5 + i * 0.05);
        const arc = Math.sin(kt * Math.PI) * (1.3 - i * 0.12);
        const fx = lerp(sx, FLOOR_TILES[i], kt), fy = lerp(yStack, FLOOR_Y, kt) + arc;
        const settle = decay(f.t - (tToss + 0.5 + i * 0.05), 0.08);
        b.position.set(kt > 0 ? fx : sx, kt > 0 ? fy + settle * 0.08 : yStack, 0.25);
        b.rotation.z = kt > 0 ? lerp((hash(i, 6) - 0.5) * 0.18, Math.PI * 2 * (i % 2 ? 1 : -1) + (hash(i, 7) - 0.5) * 0.2, kt) : (hash(i, 6) - 0.5) * 0.18 + sway * 0.8;
        b.visible = fall < 0.42;
      });
      const look = f.t < tWords ? { x: Math.sin((f.t - t1 - 0.6) * 10) * 0.9 * (kPop >= 1 ? 1 : 0), y: 0.2 } : f.t < W(1, 5) ? { x: 0, y: 1 } : f.t < tToss ? { x: 0.8, y: 0.8 } : { x: -0.7, y: -0.2 };
      s.clawd.setMood(MOODS.excited, f.t, look);
      s.clawd.setPose(pose({
        bounce, squash: squash + hits * 0.35,
        armL: 0.3 + caught * 1.3 + bounce * 0.3 + (toss.k > 0 && toss.k < 1 ? 0.6 : 0), armR: 0.3 + caught * 1.3 + bounce * 0.3 + (toss.k > 0 && toss.k < 1 ? 0.6 : 0),
      }));
      gnd.y = kPop < 0.5 ? null : FLOOR_Y;
      fl(f);
      const k = smooth(f.p);
      frameCam(s.camera, 1.2, lerp(-1.55, -1.42, k), lerp(4.6, 4.45, k));
    };
  });

  // 2. "A little box to type them in": he hops down into the input box, wiggles to fit and sinks
  //    out of sight; the letters jump in after him one by one and become typed text; he peeks out.
  const s2 = deskShot('v1-box', cut[3], cut[4], (s, gnd) => {
    const tiles = [...'WORDS'].map((ch, i) => {
      const b = wordBlock(ch, LETTER_COLS[i], 0.42, 0.42);
      s.screen.add(b);
      return b;
    });
    const fl = floaters(s.screen, 24, 5);
    const puffs = sparkles(7, 0.8, '#ffffff', 21); s.screen.add(puffs.group);
    const tBox = W(2, 2), tIn = W(2, 6);
    const letterAt = [W(2, 4), W(2, 4) + 0.15, W(2, 5), W(2, 5) + 0.15, tIn];
    const textX0 = FIELD.x + 0.15 - (FIELD.w - 2.4) / 2 + 0.25;
    return f => {
      s.bubble.visible = true;
      const typedN = letterAt.filter(t => f.t >= t + 0.26).length;
      const blink = Math.floor(f.t / 0.4) % 2 === 0;
      s.setTyped('words'.slice(0, typedN), blink, false);
      tiles.forEach((b, i) => {
        const t0 = letterAt[i];
        const k = unlerp(f.t, t0, t0 + 0.26);
        const tx = textX0 + i * 0.27;
        b.position.set(lerp(FLOOR_TILES[i], tx, k), lerp(FLOOR_Y, FIELD.y - 0.2, easeInCubic(k)) + Math.sin(k * Math.PI) * 0.9, 0.6);
        b.rotation.z = k > 0 ? -k * Math.PI * 2 : (hash(i, 9) - 0.5) * 0.2 + Math.sin(f.t * 6 + i) * 0.03 * (f.t < t0 ? 1 : 0);
        b.scale.setScalar(lerp(1, 0.55, k));
        b.visible = k < 1;
      });
      // the hop down into the box, a wiggle, a sink, and the peek
      const h = hop(f.t, tBox, tBox + 0.36, 1.4, 0.6, 0.9);
      const inBox = f.t >= tBox + 0.36;
      const wig = unlerp(f.t, tBox + 0.36, tBox + 0.8);
      const peek = easeOutBack(unlerp(f.t, tIn + 0.1, tIn + 0.35), 2.2);
      const yIn = lerp(-3.5, -3.9, smooth(wig)) + peek * 0.27;
      const pre = f.t < tBox;
      const y = pre ? FLOOR_Y : inBox ? yIn : lerp(FLOOR_Y, -3.5, h.k) + h.y;
      s.clawd.root.position.set(pre ? 1.4 : h.x, y, 0.2);
      puffs.group.position.set(0.6, FIELD.y + 0.55, 0.5);
      puffs.update(f.t - (tBox + 0.36), 0.5);
      const wiggle = inBox && wig < 1 ? Math.sin((f.t - tBox) * 32) * 0.14 * (1 - wig) : 0;
      const land = decay(f.t - (tBox + 0.36), 0.1);
      s.field.position.y = FIELD.y - 0.06 * land;
      s.field.scale.set(1 + 0.02 * land, 1 - 0.05 * land, 1);
      const proud = f.t > tIn + 0.1;
      s.clawd.setMood(proud ? { ...MOODS.excited, blush: 0.6 } : inBox ? mixMood(MOODS.excited, MOODS.focused, 0.6) : MOODS.excited, f.t, proud ? { x: -0.9, y: 0.1 } : { x: 0, y: 0 });
      s.clawd.setPose(pose({
        bounce: pre ? beatHop(f.clock, f.t) * 0.3 : proud ? beatHop(f.clock, f.t) * 0.25 : 0,
        squash: inBox ? 0.5 * land + (wig < 1 ? -0.15 : 0) : (h.k > 0 ? -0.3 : 0),
        lean: wiggle, armL: inBox ? 1.0 + wiggle * 4 : 0.4, armR: inBox ? 1.0 - wiggle * 4 : 0.4,
      }));
      gnd.y = inBox || (h.k > 0.5 && !pre) ? null : FLOOR_Y;
      fl(f);
      frameCam(s.camera, lerp(-0.5, -0.8, f.p), -2.45, lerp(4.1, 3.8, f.p));
    };
  });

  // 3. "I learned the shape of yes and no": a big toy check mark and a toy cross drop in. He
  //    nestles into the check's V, happily; then tries the cross's V, which is pointy.
  const s3 = deskShot('v1-yesno', cut[4], cut[5], (s, gnd) => {
    const check = barToy([{ dir: 135, len: 1.75 }, { dir: 50, len: 3.0 }], '#6cc788', '#3f9a5c');
    const cross = barToy([{ dir: 45, len: 1.7 }, { dir: 135, len: 1.7 }, { dir: -45, len: 1.7 }, { dir: -135, len: 1.7 }], '#ee8b84', '#c25e58');
    const shadows = [0, 1].map(() => { const m = shapeMesh(circleShape(1), ownMat(INK, 0.15, true), 0, 32); s.screen.add(m); return m; });
    const ghosts = [ghostOf(check), ghostOf(cross)];
    s.screen.add(...ghosts, check, cross);
    const think = new THREE.Group();
    const qmark = label('?', 0.7, 0.7, { size: 0.55 }); qmark.position.set(0, 0.02, 0.01);
    think.add(inkedCircle(0.38, '#ffffff', 0.05), qmark);
    const dot1 = inkedCircle(0.09, '#ffffff', 0.04), dot2 = inkedCircle(0.06, '#ffffff', 0.035);
    s.screen.add(think, dot1, dot2);
    const yay = sparkles(8, 1.1, '#ffd166', 31), ow = sparkles(6, 0.8, '#ee8b84', 32);
    s.screen.add(yay.group, ow.group);
    const fl = floaters(s.screen, 24, 6);
    const tYes = W(3, 5), tNo = W(3, 7);
    const CX = -2.1, XX = 2.2;
    // seats in toy-local units: the inner V of the check, the top V of the cross
    const crossCenter = cross.lift; // the cross is symmetric: its centre sits lift above its base
    const seatCheck = new THREE.Vector2(0.0, check.lift + 0.98), seatCross = new THREE.Vector2(0, crossCenter + 0.92);
    const drop = (toy: THREE.Group, x: number, tLand: number, f: Frame, rock: number) => {
      const dt = f.t - tLand;
      const y = dt < 0 ? 16 * dt * dt : Math.abs(Math.sin(dt * 10)) * 0.22 * decay(dt, 0.12);
      toy.visible = dt > -0.32;
      toy.position.set(x, FLOOR_Y + y, 0.12);
      toy.scale.set(1 + 0.12 * decay(dt, 0.07), 1 - 0.12 * decay(dt, 0.07), 1);
      toy.rotation.z = rock;
      return dt < 0 ? -dt : 0;
    };
    const place = (toy: THREE.Group, seat: THREE.Vector2) => {
      const c = Math.cos(toy.rotation.z), sn = Math.sin(toy.rotation.z);
      return new THREE.Vector2(toy.position.x + seat.x * c - seat.y * sn, toy.position.y + seat.x * sn + seat.y * c);
    };
    return f => {
      const sitYes = f.t >= tYes + 0.3 && f.t < tNo + 0.04, sitNo = f.t >= tNo + 0.34;
      const rockC = 0.07 * Math.sin((f.t - tYes) * 7) * decay(f.t - tYes - 0.3, 0.6) * (f.t > tYes + 0.3 ? 1 : 0) + (sitYes ? beatHop(f.clock, f.t) * 0.03 : 0);
      const rockX = 0.05 * Math.sin((f.t - tNo) * 11) * decay(f.t - tNo - 0.34, 0.35) * (f.t > tNo + 0.34 ? 1 : 0);
      const hC = drop(check, CX, tYes, f, rockC), hX = drop(cross, XX, tNo, f, rockX);
      // on "shape" the two slots draw themselves on the floor; the toys drop into them
      ghosts.forEach((gh, i) => {
        const k = easeOutBack(unlerp(f.t, W(3, 3) + i * 0.12, W(3, 3) + 0.3 + i * 0.12), 2);
        gh.visible = k > 0.01 && f.t < (i ? tNo : tYes) + 0.05;
        gh.position.set(i ? XX : CX, FLOOR_Y + Math.sin(f.t * 3 + i) * 0.03, 0.08);
        gh.scale.setScalar(Math.max(0.01, k));
      });
      [hC, hX].forEach((hgt, i) => {
        const m = shadows[i];
        const vis = (i ? f.t > tNo - 0.5 : f.t > tYes - 0.5);
        m.visible = vis;
        m.position.set(i ? XX : CX + 0.4, FLOOR_Y + 0.02, 0.1);
        const k = 1 - clamp(hgt / 0.5);
        m.scale.set(lerp(0.4, 1.4, k), lerp(0.05, 0.14, k), 1);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.16 * k;
      });
      // Clawd: waits looking up with a "?", hops into the check, then over to the cross
      const startX = 0.2;
      let p = new THREE.Vector2(startX, FLOOR_Y), rot = 0, air = 0;
      const toC = unlerp(f.t, tYes + 0.02, tYes + 0.3), toX = unlerp(f.t, tNo + 0.04, tNo + 0.34);
      const seatC = place(check, seatCheck), seatX = place(cross, seatCross);
      if (f.t >= tNo + 0.04) { p = seatC.clone().lerp(seatX, toX); air = Math.sin(toX * Math.PI) * 0.5; rot = sitNo ? rockX : 0; }
      else if (f.t >= tYes + 0.02) { p = new THREE.Vector2(startX, FLOOR_Y).lerp(seatC, toC); air = Math.sin(toC * Math.PI) * 1.2; rot = sitYes ? rockC : 0; }
      s.clawd.root.position.set(p.x, p.y + air, 0.3);
      s.clawd.root.rotation.z = rot;
      gnd.y = f.t < tYes + 0.1 ? FLOOR_Y : null;
      const qk = easeOutBack(unlerp(f.t, cut[4] + 0.08, cut[4] + 0.35)) * (1 - smooth(unlerp(f.t, tYes - 0.15, tYes)));
      think.visible = dot1.visible = dot2.visible = qk > 0.01;
      think.position.set(startX + 0.85, FLOOR_Y + 1.85 + Math.sin(f.t * 4) * 0.05, 0.3);
      think.scale.setScalar(Math.max(0.01, qk));
      dot1.position.set(startX + 0.55, FLOOR_Y + 1.3, 0.3); dot2.position.set(startX + 0.42, FLOOR_Y + 1.12, 0.3);
      dot1.scale.setScalar(Math.max(0.01, qk)); dot2.scale.setScalar(Math.max(0.01, qk));
      yay.group.position.set(seatC.x, seatC.y + 0.6, 0.4); yay.update(f.t - (tYes + 0.3), 0.6);
      ow.group.position.set(seatX.x, seatX.y + 0.5, 0.4); ow.update(f.t - (tNo + 0.34), 0.45);
      const land = Math.max(decay(f.t - (tYes + 0.3), 0.08), decay(f.t - (tNo + 0.34), 0.07));
      const ouch: Mood = { happy: 0, open: 1.45, droop: 0, blush: 0, sweat: 0.7, jitter: 0.25, grey: 0, squint: 0, brow: 0.9 };
      const mood = sitNo ? ouch : sitYes ? { ...MOODS.proud, blush: 0.8 } : f.t < tYes ? mixMood(MOODS.excited, MOODS.focused, 0.45) : MOODS.excited;
      s.clawd.setMood(mood, f.t, f.t < W(3, 3) ? { x: 0.2, y: 1 } : f.t < tYes ? { x: Math.sin((f.t - W(3, 3)) * 5) > 0 ? -1 : 1, y: -0.5 } : f.t > W(3, 6) && !sitNo && f.t < tNo + 0.04 ? { x: 1, y: 0.1 } : { x: 0, y: 0 });
      s.clawd.setPose(pose({
        bounce: f.t < tYes - 0.3 ? beatHop(f.clock, f.t) * 0.2 : sitYes ? beatHop(f.clock, f.t) * 0.15 : 0,
        squash: land * 0.6 + (air > 0.05 ? -0.3 : 0) + (sitNo ? 0.25 : 0),
        armL: sitYes ? 1.7 : sitNo ? 2.2 : 0.3, armR: sitYes ? 1.7 : sitNo ? 2.2 : 0.3,
        lean: f.t < tYes ? -0.08 : 0,
      }));
      fl(f);
      frameCam(s.camera, lerp(0.0, 0.3, f.p), -0.85, lerp(5.0, 4.8, f.p));
    };
  });

  // 4. "The gentle ways a sentence flows": a ribbon of words streams past in a wave and he surfs it
  //    on a little board, spray flying; on "flows" he kickflips over a crest.
  const RIBBON = 'the gentle ways a sentence flows and then it flows a little more like this and so on'.split(' ');
  const s4 = deskShot('v1-surf', cut[5], cut[6], (s, gnd) => {
    const tiles = Array.from({ length: 36 }, (_, i) => {
      const word = RIBBON[i % RIBBON.length];
      const g = new THREE.Group();
      g.add(inkedRect(1.3, 0.48, 0.05, i % 3 === 0 ? '#fff3df' : i % 3 === 1 ? '#ffffff' : '#fbe7ef', 0.05));
      const t = label(word, 1.3, 0.48, { size: 0.24, weight: 800 });
      t.position.z = 0.01;
      g.add(t);
      s.screen.add(g);
      return g;
    });
    const board = new THREE.Group();
    board.add(inkedRect(1.9, 0.17, 0.085, CORAL, 0.05));
    const stripe = shapeMesh(roundedRectShape(1.5, 0.05, 0.02, 0, 0.0), ownMat('#ffffff', 0.9), 0.01); board.add(stripe);
    s.screen.add(board);
    const lines = speedLines(7, 1.8, 41); s.screen.add(lines.group);
    const spray = Array.from({ length: 16 }, (_, i) => { const m = inkedCircle(0.07 + hash(i, 44) * 0.05, LETTER_COLS[i % 5], 0.025); s.screen.add(m); return m; });
    const fl = floaters(s.screen, 28, 7);
    const speed = 3.6, gap = 1.36, amp = 0.48;
    const wave = (x: number, t: number) => FLOOR_Y + 1.32 + amp * Math.sin(0.75 * x - 2.6 * t);
    const slopeAt = (x: number, t: number) => Math.atan(amp * 0.75 * Math.cos(0.75 * x - 2.6 * t));
    const tFlip = W(4, 5);
    return f => {
      const head = 9 - speed * (f.t - f.clock.w(4, 0) + 2.6);
      tiles.forEach((g, i) => {
        const x = head + i * gap;
        g.position.set(x, wave(x, f.t), 0.15 + i * 0.001);
        g.rotation.z = slopeAt(x, f.t);
        g.visible = x > -6 && x < 9;
      });
      const cx = 2.0;
      const kf = unlerp(f.t, tFlip, tFlip + 0.5);
      const jump = Math.sin(kf * Math.PI) * 0.95;
      const ride = wave(cx, f.t) + 0.32;
      const sl = slopeAt(cx, f.t);
      board.position.set(cx, ride + jump * 0.85, 0.28);
      board.rotation.z = sl;
      board.scale.y = kf > 0 && kf < 1 ? Math.cos(kf * Math.PI * 2) : 1;
      s.clawd.root.position.set(cx, ride + 0.08 + jump, 0.3);
      s.clawd.root.rotation.z = sl * 0.8 - (kf > 0 && kf < 1 ? Math.PI * 2 * easeInOutCubic(kf) : 0);
      lines.group.position.set(cx - 0.4, ride + 0.6 + jump, 0.25);
      lines.update(0.8, 1, f.t);
      spray.forEach((m, i) => {
        const c = (f.t * 2.4 + i / spray.length) % 1;
        m.position.set(cx - 0.95 - c * 1.8, ride - 0.05 + c * 0.9 - c * c * 1.4 + (hash(i, 45) - 0.5) * 0.3, 0.27);
        m.scale.setScalar(Math.max(0.01, 1 - c));
      });
      const whee = decay(f.t - tFlip - 0.5, 0.4);
      s.clawd.setMood(kf > 0 && kf < 1 ? { ...MOODS.excited, blush: 0.8 } : MOODS.excited, f.t, { x: 0.6, y: 0 });
      s.clawd.setPose(pose({ squash: -0.08 + 0.2 * Math.sin(f.t * 5.2) - (kf > 0 && kf < 1 ? 0.2 : 0), armL: 1.1 + whee * 1.0 + Math.sin(f.t * 3) * 0.25, armR: 0.7 + whee * 1.0 + Math.sin(f.t * 3 + 1) * 0.2, lean: -0.1 }));
      gnd.y = null;
      fl(f, f.t * 2.4);
      frameCam(s.camera, 1.3, -0.85 + Math.sin(f.t * 2.6) * 0.04, 4.5);
    };
  });

  // 5. "I fixed your notes, I changed your tone": two crooked sticky notes; a head-bump each turns
  //    the red scribble into neat green lines. Then he shoves a tone slider from the frown to the smile.
  const s5 = deskShot('v1-notes', cut[6], cut[7], (s, gnd) => {
    const NX = [-1.35, 0.1], NY = -0.75;
    const notes = NX.map((x, i) => { const n = stickyNote(i + 3); s.screen.add(n); return { n, x, tilt: i ? 0.32 : -0.28 }; });
    const pops = NX.map((_, i) => { const sp = sparkles(6, 0.95, '#8fd6a0', 50 + i); s.screen.add(sp.group); return sp; });
    const TR = { x0: 1.65, x1: 4.45, y: FLOOR_Y + 0.62 };
    const track = inkedRect(TR.x1 - TR.x0, 0.2, 0.1, '#e9dfd0', 0.05); track.position.set((TR.x0 + TR.x1) / 2, TR.y, 0.1);
    const fillMat = ownMat('#f2a09a');
    const fill = shapeMesh(roundedRectShape(TR.x1 - TR.x0, 0.2, 0.1, (TR.x1 - TR.x0) / 2, 0), fillMat, 0.11); fill.position.set(TR.x0, TR.y, 0);
    const knob = inkedCircle(0.27, '#ffffff', 0.06);
    const frown = faceIcon(0.36, '#f2a09a', false), smile = faceIcon(0.36, '#8fd6a0', true);
    frown.position.set(TR.x0, TR.y + 1.1, 0.1); smile.position.set(TR.x1, TR.y + 1.1, 0.1);
    const cheer = sparkles(8, 0.9, '#ffd166', 55);
    s.screen.add(track, fill, knob, frown, smile, cheer.group);
    const fl = floaters(s.screen, 24, 8);
    const taps = [cut[6] + 0.06, W(5, 3)];
    const tGrab = W(5, 5), tTone = W(5, 7);
    return f => {
      notes.forEach(({ n, x, tilt }, i) => {
        const fixed = easeOutBack(unlerp(f.t, taps[i], taps[i] + 0.25), 3);
        const bump = decay(f.t - taps[i], 0.1) * (f.t >= taps[i] ? 1 : 0);
        n.position.set(x, NY + bump * 0.12 + (1 - fixed) * Math.sin(f.t * 3 + i) * 0.03, 0.12);
        n.rotation.z = tilt * (1 - fixed) + Math.sin(f.t * 2 + i) * 0.015;
        n.scribble.visible = f.t < taps[i];
        n.neat.visible = f.t >= taps[i];
        pops[i].group.position.set(x, NY, 0.3);
        pops[i].update(f.t - taps[i], 0.5);
      });
      // he bumps each note with his head, hops to the slider, grabs the knob and shoves it across
      const under = (i: number) => NX[i] + 0.05;
      let x = under(0), y = FLOOR_Y, walk = 0, push = 0;
      const jumpAt = (tp: number) => { const d = (f.t - tp) / 0.14; return Math.abs(d) < 1 ? Math.cos((d * Math.PI) / 2) * 0.62 : 0; };
      if (f.t < taps[0] + 0.14) { x = under(0); y += jumpAt(taps[0]); }
      else if (f.t < taps[1] - 0.14) { const h = hop(f.t, taps[0] + 0.14, taps[1] - 0.14, under(0), under(1), 0.35); x = h.x; y += h.y; }
      else if (f.t < taps[1] + 0.14) { x = under(1); y += jumpAt(taps[1]); }
      else if (f.t < tGrab) { const h = hop(f.t, taps[1] + 0.2, tGrab - 0.12, under(1), TR.x0 - 1.0, 0.55); x = h.x; y += h.y; }
      else { push = easeInOutCubic(unlerp(f.t, tGrab, tTone)); x = lerp(TR.x0 - 1.0, TR.x1 - 1.0, push); walk = (f.t - tGrab) * 3.2; }
      s.clawd.root.position.set(x, y, 0.2);
      const kx = lerp(TR.x0, TR.x1, push) + (f.t >= tTone ? 0.04 * Math.sin((f.t - tTone) * 30) * decay(f.t - tTone, 0.1) : 0);
      knob.position.set(kx, TR.y, 0.32);
      fill.scale.x = Math.max(0.001, push);
      fillMat.color.set('#f2a09a').lerp(new THREE.Color('#8fd6a0'), push);
      const won = easeOutBack(unlerp(f.t, tTone, tTone + 0.25), 3);
      smile.scale.setScalar(1 + 0.35 * Math.sin(clamp((f.t - tTone) / 0.35) * Math.PI));
      smile.rotation.z = (f.t > tTone ? 0.2 * Math.sin((f.t - tTone) * 14) * decay(f.t - tTone, 0.25) : 0);
      frown.scale.setScalar(lerp(1, 0.8, won));
      cheer.group.position.set(TR.x1, TR.y + 1.1, 0.35); cheer.update(f.t - tTone, 0.6);
      const pushing = f.t >= tGrab && f.t < tTone + 0.05;
      s.clawd.setMood(pushing ? mixMood(MOODS.focused, MOODS.excited, 0.2) : f.t > tTone ? { ...MOODS.proud, blush: 0.9 } : f.t > taps[0] ? MOODS.proud : MOODS.excited, f.t, pushing ? { x: 1, y: 0 } : { x: 0, y: 0.6 });
      s.clawd.setPose(pose({
        armR: pushing ? 1.4 : 0.3, armL: pushing ? 0.6 : 0.3, walk, lean: pushing ? -0.18 : 0,
        squash: y > FLOOR_Y + 0.02 ? -0.25 : 0.1 * beatHop(f.clock, f.t), bounce: f.t > tTone + 0.1 ? beatHop(f.clock, f.t) * 0.4 : 0,
      }));
      gnd.y = FLOOR_Y;
      fl(f);
      frameCam(s.camera, 1.1, -1.05, lerp(4.7, 4.5, f.p));
    };
  });

  // 6. "Made awkward thoughts feel more like home": he pulls a thread from a shaking tangle and it
  //    unravels into a house; the walls fill in, the roof, the door, a tree, and on "home" the window
  //    lights and the chimney starts to puff.
  const HPX = -1.0, HPY = FLOOR_Y + 1.3, PW = 7.2, PH = 4.2;
  const houseK = (t: number) => ({
    wall: easeOutBack(unlerp(t, W(6, 4), W(6, 4) + 0.25)),
    roof: easeOutBack(unlerp(t, W(6, 5), W(6, 5) + 0.25)),
    light: smooth(unlerp(t, W(6, 6) - 0.02, W(6, 6) + 0.08)),
    tree: easeOutBack(unlerp(t, W(6, 5) + 0.12, W(6, 5) + 0.4)),
  });
  const tPull = W(6, 1);
  const pullK = (t: number) => smooth(unlerp(t, tPull, W(6, 4) - 0.02));
  const s6 = deskShot('v1-home', cut[7], cut[8], (s, gnd) => {
    let thread = { k: 0, hand: [3, -1.3] as [number, number], shake: 0 };
    const plane = canvasPlane(PW, PH, 180, (g, f: Frame, Wd) => drawThread(g, Wd, PW, PH, thread.k, thread.hand, thread.shake, f.t));
    plane.mesh.position.set(HPX, HPY, 0.12);
    const fills = houseFills(); fills.position.set(HPX, HPY, 0.1);
    const homey = sparkles(9, 1.6, '#ffd166', 61);
    s.screen.add(plane.mesh, fills, homey.group);
    const fl = floaters(s.screen, 24, 9);
    return f => {
      const tHome = W(6, 6);
      const k = pullK(f.t);
      const tug = Math.max(0, Math.sin(Math.max(0, f.clock.beat(f.t)) * Math.PI * 2)) * (f.t > tPull && f.t < W(6, 4) ? 1 : 0);
      const cx = lerp(1.9, 3.1, k) + tug * 0.08;
      s.clawd.root.position.set(cx, FLOOR_Y, 0.2);
      const hand: [number, number] = [cx - 0.95 - HPX, FLOOR_Y + 0.66 - HPY];
      thread = { k, hand, shake: f.t < tPull + 0.4 ? 1 : 0 };
      plane.update(f);
      fills.set(f.t, houseK(f.t));
      homey.group.position.set(HPX + 0.75, HPY - 0.45, 0.3);
      homey.update(f.t - tHome, 0.7);
      const home = f.t >= W(6, 4);
      s.clawd.setMood(home ? { ...MOODS.proud, blush: 1 } : f.t < tPull ? mixMood(MOODS.focused, MOODS.excited, 0.3) : MOODS.focused, f.t, home ? { x: -0.9, y: 0.3 } : { x: -1, y: 0 });
      s.clawd.setPose(pose({
        armL: home ? 1.8 : 0.55 + tug * 0.2, armR: home ? 1.8 : 0.2,
        lean: home ? 0 : -0.18 * (f.t > tPull ? 1 : 0) - tug * 0.12,
        walk: f.t > tPull && !home ? (f.t - tPull) * 1.6 : 0,
        bounce: home ? beatHop(f.clock, f.t) * 0.4 : 0,
      }));
      gnd.y = FLOOR_Y;
      fl(f);
      frameCam(s.camera, lerp(0.25, 0.4, f.p), -1.15, lerp(4.95, 4.75, f.p));
    };
  });

  // 7a. "You smiled and said": pull back to the room. The person gives a thumbs-up, a heart pops
  //     over them, and the smiley sun rises behind the monitor.
  const s7a = deskShot('v1-desk', cut[8], cut[9], s => {
    const house = staticPlane(PW, PH, 90, (g, Wd) => drawThread(g, Wd, PW, PH, 1, [2.9, -1.3]));
    house.position.set(HPX, HPY, 0.12);
    const fills = houseFills(); fills.position.set(HPX, HPY, 0.1);
    const love = heart(0.55);
    s.screen.add(house, fills);
    s.scene.add(love);
    const fl = floaters(s.screen, 24, 9);
    return f => {
      const tSmile = W(7, 1);
      fills.set(f.t, { wall: 1, roof: 1, light: 1, tree: 1 });
      const back = easeOutCubic(unlerp(f.t, cut[8] + 0.02, cut[8] + 0.6));
      frameCam(s.camera, lerp(0.4, 2.6, back), lerp(-1.15, -1.6, back), lerp(4.75, 23, back) + f.p * 0.8);
      const up = easeOutBack(unlerp(f.t, tSmile - 0.05, tSmile + 0.4), 1.4);
      s.person.pose(up, up, beatHop(f.clock, f.t) * up);
      const lv = easeOutBack(unlerp(f.t, tSmile + 0.1, tSmile + 0.45), 2);
      love.visible = lv > 0.01;
      love.position.set(12.2 + Math.sin(f.t * 3) * 0.15, 0.6 + (f.t - tSmile) * 0.6, 0.9);
      love.scale.setScalar(Math.max(0.01, lv) * 1.6);
      const rise = easeOutBack(unlerp(f.t, tSmile + 0.1, tSmile + 0.85), 1.1);
      s.sun.position.set(3.8, lerp(-12, 7.0, rise), -1);
      s.sun.rays.rotation.z = f.t * 0.3;
      s.sun.face.position.y = Math.sin(f.t * 4) * 0.08;
      s.clawd.root.position.set(3.1, FLOOR_Y + hop(f.t, W(7, 3), W(7, 3) + 0.35, 0, 0, 0.6).y, 0.2); // where shot 6 left him
      s.clawd.setMood({ ...MOODS.proud, blush: 1.2 }, f.t, { x: 0.5, y: 0.5 });
      s.clawd.setPose(pose({ bounce: beatHop(f.clock, f.t) * 0.3, armL: 1.4, armR: 1.4 }));
      fl(f);
    };
  });

  // 7b. "I did it well": close on Clawd. A pointer clicks the thumbs-up under his answer; he
  //     blushes bright red, sways shyly, and hops for joy with hearts on "well".
  const s7b = deskShot('v1-blush', cut[9], cut[10], s => {
    const house = staticPlane(PW, PH, 150, (g, Wd) => drawThread(g, Wd, PW, PH, 1, [2.9, -1.3]));
    house.position.set(HPX, HPY, 0.12);
    const fills = houseFills(); fills.position.set(HPX, HPY, 0.1);
    s.screen.add(house, fills);
    const btns = [0, 1, 2].map(i => {
      const g = new THREE.Group();
      const mat = ownMat('#ffffff');
      g.add(inkedRect(0.62, 0.62, 0.14, mat, 0.045));
      if (i === 0) { // copy
        const a = inkedRect(0.24, 0.29, 0.03, '#ffffff', 0.035); a.position.set(0.05, -0.04, 0.01);
        const b = inkedRect(0.24, 0.29, 0.03, '#ffffff', 0.035); b.position.set(-0.05, 0.05, 0.005);
        g.add(b, a);
      } else {
        const icon = thumbIcon(ownMat('#ffffff'));
        icon.scale.setScalar(0.56); icon.position.set(0.03, 0, 0.01);
        if (i === 2) icon.rotation.z = Math.PI;
        g.add(icon);
      }
      g.position.set(1.2 + i * 0.74, FLOOR_Y + 0.38, 0.15);
      s.screen.add(g);
      return { g, mat };
    });
    const ptr = pointer(); ptr.scale.setScalar(0.62); s.screen.add(ptr);
    const clickPop = sparkles(7, 0.6, '#ffd166', 71);
    const hearts = Array.from({ length: 7 }, (_, i) => { const h = heart(0.16 + hash(i, 72) * 0.06, i % 2 ? '#ff8fa3' : '#ff6f8f'); s.screen.add(h); return h; });
    const joy = confetti(26, 73, { size: 0.12, speed: 3.5, life: 1.3, spread: 2.2 });
    s.screen.add(clickPop.group, joy.group);
    const fl = floaters(s.screen, 24, 10);
    const tClick = W(7, 4) - 0.02, tWell = W(7, 7);
    return f => {
      fills.set(f.t, { wall: 1, roof: 1, light: 1, tree: 1 });
      // the pointer glides in from the bottom right, clicks thumbs-up, and drifts away
      const thumb = btns[1];
      const tx = thumb.g.position.x + 0.05, ty = thumb.g.position.y - 0.02;
      const inK = easeInOutCubic(unlerp(f.t, cut[9], tClick - 0.04)), outK = easeInCubic(unlerp(f.t, tClick + 0.35, tClick + 0.9));
      ptr.position.set(lerp(6.5, tx, inK) + outK * 2.5, lerp(-3.8, ty, inK) - outK * 1.5, 0.6);
      const press = Math.max(0, Math.sin(clamp((f.t - tClick + 0.02) / 0.16) * Math.PI));
      ptr.scale.setScalar(0.62 * (1 - press * 0.12));
      const on = f.t >= tClick;
      thumb.mat.color.set(on ? CORAL : '#ffffff');
      thumb.g.scale.setScalar(1 + 0.3 * Math.sin(clamp((f.t - tClick) / 0.3) * Math.PI) * (on ? 1 : 0));
      clickPop.group.position.set(thumb.g.position.x, thumb.g.position.y, 0.4); clickPop.update(f.t - tClick, 0.5);
      // Clawd: shy sway, a big blush, then a hop for joy
      const blush = smooth(unlerp(f.t, tClick, tClick + 0.35));
      const j = hop(f.t, tWell, tWell + 0.42, 0, 0, 0.9);
      s.clawd.root.position.set(3.95, FLOOR_Y + j.y, 0.2);
      const shy = Math.sin((f.t - tClick) * 5) * 0.12 * blush * (f.t < tWell ? 1 : 0.4);
      s.clawd.setMood(mixMood(MOODS.excited, { ...MOODS.proud, happy: 1, blush: 1.6 }, blush), f.t, f.t < tClick ? { x: -1, y: -0.5 } : { x: 0, y: 0 });
      s.clawd.setPose(pose({
        lean: shy, squash: j.k > 0 && j.k < 1 ? -0.3 : 0.2 * decay(f.t - (tWell + 0.42), 0.1),
        armL: lerp(0.4, 0.05, blush) + (j.k > 0 ? 1.8 : 0), armR: lerp(0.4, 0.05, blush) + (j.k > 0 ? 1.8 : 0),
        bounce: f.t > tWell + 0.5 ? beatHop(f.clock, f.t) * 0.35 : 0,
      }));
      hearts.forEach((h, i) => {
        const t0 = tClick + 0.25 + i * 0.17;
        const c = (f.t - t0) / 1.5;
        h.visible = c > 0 && c < 1;
        h.position.set(3.95 + (hash(i, 74) - 0.5) * 2.6 + Math.sin(f.t * 3 + i) * 0.15, FLOOR_Y + 1.1 + c * 2.0, 0.35);
        h.scale.setScalar(Math.max(0.01, Math.sin(Math.min(1, c * 1.4) * Math.PI)));
      });
      joy.group.position.set(3.95, FLOOR_Y + 1.5, 0.12);
      joy.update(f.t - tWell);
      fl(f);
      frameCam(s.camera, lerp(3.85, 3.75, f.p), -1.75, lerp(3.6, 3.3, f.p));
    };
  });

  // 8. "I learned to say, 'I'm here to help'": he leaps and strikes a pose; rays burst behind him;
  //    his speech bubble types the quote as he sings it; confetti on "help" and a wave.
  const s8 = deskShot('v1-pose', cut[10], cut[11], s => {
    const rays = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const tri = new THREE.Shape();
      tri.moveTo(0, 0); tri.lineTo(-0.55, 7); tri.lineTo(0.55, 7); tri.closePath();
      const m = shapeMesh(tri, i % 2 ? '#f6d9b9' : '#fbe8d0', 0);
      m.rotation.z = (i / 16) * Math.PI * 2;
      rays.add(m);
    }
    s.screen.add(rays);
    const stars = Array.from({ length: 6 }, (_, i) => {
      const g = new THREE.Group();
      g.add(shapeMesh(starShape(0.26), INK, 0), shapeMesh(starShape(0.2), LETTER_COLS[i % 5], 0.003));
      s.screen.add(g);
      return g;
    });
    const bubble = new THREE.Group();
    const bb = inkedRect(3.4, 1.0, 0.08, '#ffffff', 0.07);
    const tail = new THREE.Shape();
    tail.moveTo(-1.2, -0.45); tail.lineTo(-1.55, -0.95); tail.lineTo(-0.7, -0.45); tail.closePath();
    const tailInk = new THREE.Shape();
    tailInk.moveTo(-1.32, -0.42); tailInk.lineTo(-1.68, -1.06); tailInk.lineTo(-0.58, -0.42); tailInk.closePath();
    // the sung words "I'm here to help" type into the bubble as they are sung
    const said = L(8).words.slice(4);
    const txt = canvasPlane(3.4, 1.0, 200, (g, f: Frame, Wd, Hd) => {
      const full = said.map(w => w.w.replace(/[“”"]/g, '')).join(' ');
      g.font = `900 ${Hd * 0.42}px ${FONT}`;
      const fit = Math.min(1, (Wd * 0.84) / g.measureText(full).width);
      g.font = `900 ${Hd * 0.42 * fit}px ${FONT}`;
      g.textBaseline = 'middle';
      const shown = said.filter(w => f.t >= w.start - 1 / 30).map(w => w.w.replace(/[“”"]/g, '')).join(' ');
      const x0 = (Wd - g.measureText(full).width) / 2;
      g.fillStyle = INK;
      g.fillText(shown, x0, Hd * 0.53);
      const caret = g.measureText(shown).width + (shown ? Hd * 0.06 : 0);
      if (f.t < said[said.length - 1].end && Math.floor(f.t / 0.25) % 2 === 0) g.fillRect(x0 + caret, Hd * 0.3, Hd * 0.05, Hd * 0.45);
    });
    txt.mesh.position.z = 0.012;
    bubble.add(bb, shapeMesh(tailInk, INK, -0.001), shapeMesh(tail, '#ffffff', 0.004), txt.mesh);
    s.screen.add(bubble);
    const party = confetti(40, 81, { size: 0.13, speed: 4.5, life: 1.6, spread: 2.6 });
    s.screen.add(party.group);
    const fl = floaters(s.screen, 24, 11);
    const CX = 0.85;
    return f => {
      const tSay = W(8, 3), tHelp = W(8, 7), tIm = W(8, 4);
      const burst = easeOutBack(unlerp(f.t, tSay, tSay + 0.35));
      rays.visible = burst > 0.01;
      rays.position.set(CX, FLOOR_Y + 0.6, 0.05);
      rays.scale.setScalar(Math.max(0.01, burst));
      rays.rotation.z = f.t * 0.25;
      stars.forEach((st, i) => {
        const a = (i / stars.length) * Math.PI * 2 + f.t * 0.6, r = 1.25 + 0.1 * Math.sin(f.t * 3 + i);
        st.visible = burst > 0.01;
        st.position.set(CX + Math.cos(a) * r * 1.2, FLOOR_Y + 0.62 + Math.sin(a) * r * 0.75, 0.32);
        st.scale.setScalar(Math.max(0.01, burst) * (0.8 + 0.3 * Math.sin(f.t * 6 + i * 2)));
        st.rotation.z = f.t * 2 + i;
      });
      const j = hop(f.t, tSay - 0.28, tSay + 0.04, 0, 0, 0.9);
      const strike = f.t >= tSay;
      s.clawd.root.position.set(CX, FLOOR_Y + j.y, 0.2);
      const pop = easeOutBack(unlerp(f.t, tIm - 0.25, tIm + 0.05), 2);
      txt.update(f);
      bubble.visible = pop > 0.01;
      bubble.position.set(3.0, FLOOR_Y + 1.7, 0.3);
      bubble.scale.setScalar(Math.max(0.01, pop) * (1 + 0.06 * Math.sin(clamp((f.t - tHelp) / 0.3) * Math.PI)));
      party.group.position.set(CX - 0.1, FLOOR_Y + 1.3, 0.12);
      party.update(f.t - tHelp);
      const wave = f.t > tHelp ? Math.sin((f.t - tHelp) * 14) * 0.35 : 0;
      s.clawd.setMood(strike ? { ...MOODS.proud, happy: 1, blush: 0.7 } : MOODS.excited, f.t, { x: 0.5, y: 0.2 });
      s.clawd.setPose(pose({
        squash: strike ? 0.3 * decay(f.t - tSay - 0.05, 0.1) : j.k > 0 ? -0.35 : 0,
        armL: strike ? 2.3 : 0.4, armR: strike ? 0.9 + wave : 0.4, lean: strike ? 0.1 : 0,
        bounce: strike ? beatHop(f.clock, f.t) * 0.25 : beatHop(f.clock, f.t) * 0.2,
      }));
      fl(f);
      frameCam(s.camera, 1.9, -1.4, lerp(4.0, 3.7, f.p));
    };
  });

  return [s0a, s0b, s1, s2, s3, s4, s5, s6, s7a, s7b, s8];
}
