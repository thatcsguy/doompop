// Verse 2's forensics lab: the pull-up projector screen of metrics and its projector, the twins'
// pageant sashes, the gold mirror frame (a Duck Soup mirror), the X-ray light box with the two
// request printouts, the hex byte ticker, the teetering stack of gear the Cache holds up, the
// service door in the riser, the dusty coil of the first trace, and Clawd's speech bubble (a 2D
// overlay). Also a mechanic's creeper for rolling under the booth. Everything is set from t and the
// shot's values.
import * as THREE from 'three';
import { INK, arcShape, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { clamp, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { hash, noise1 } from '../../engine/rng';
import { REQUEST_LINES, fitFont } from './club';
import { CRT_FONT, DISCO_FONT, PAL, TERM_FONT, UI_FONT, cutout, glowMat, lightMat, ownGlow, setGlow, solid } from './look';

const v3 = new THREE.Vector3();

/** A metric over the last half hour (x 0..1) as a height 0..1: a slow wander with a little jitter.
 *  The same seed gives the same line, which is the whole point of verse 2. */
export function series(x: number, seed: number) {
  return 0.5 + 0.2 * noise1(x * 3.2, seed) + 0.12 * noise1(x * 9.5, seed + 1) + 0.05 * noise1(x * 31, seed + 2);
}

// ---------------------------------------------------------------------------------------------
/** What the projector screen shows. */
export interface ScreenView {
  t: number;
  /** 0 packed in its case .. 1 pulled all the way up. */
  rise: number;
  /** 'dash': four panels of metrics; 'overlay': one big chart, staging against prod. */
  mode: 'dash' | 'overlay';
  /** How much of each line has been drawn, 0..1. */
  draw: number;
  /** How far apart the staging and prod lines are (1 far apart .. 0 on top of each other). */
  gap: number;
  /** The match: one white-hot line per chart and a MATCH badge (0..1, may overshoot as it pops). */
  match: number;
}

const PANELS = [
  { name: 'latency p99', seed: 3 },
  { name: 'requests / s', seed: 11 },
  { name: 'cpu', seed: 5 },
  { name: 'memory', seed: 8 },
];

/**
 * A pull-up projector screen: a long case on the floor with the fabric folded inside; grab the
 * handle on the top bar and pull it up. The picture comes from a projector, so it stays put in the
 * air and shows on the fabric as the fabric rises into it, bottom first. Origin: the middle of the
 * case, on the floor.
 */
export class PullUpScreen {
  readonly root = new THREE.Group();
  /** The top bar (y = the fabric's top edge); paws grab `handle`, in the bar's frame. */
  readonly bar = new THREE.Group();
  readonly handle = new THREE.Object3D();
  static readonly CASE_TOP = 0.36;
  private fabric: { mesh: THREE.Mesh; update(v: ScreenView): void };

  constructor(readonly W = 4.4, readonly H = 2.6) {
    const top = PullUpScreen.CASE_TOP;
    this.fabric = canvasPlane(W, H, 110, (g, v: ScreenView, cw, ch) => drawScreen(g, v, cw, ch));
    cutout(this.fabric.mesh, 0.5);
    this.fabric.mesh.position.set(0, top + H / 2, 0);
    this.root.add(this.fabric.mesh);
    // the case, on two little feet, with a slot along the top and end caps
    const box = inkedRect(W + 0.42, 0.26, 0.08, '#2b2346', 0.05);
    box.position.set(0, top - 0.13, 0.04);
    const slot = shapeMesh(roundedRectShape(W + 0.05, 0.04, 0.02, 0, top - 0.02), '#0b0816', 0.1);
    const trim = shapeMesh(roundedRectShape(W + 0.3, 0.035, 0.015, 0, top - 0.2), glowMat(PAL.violetNeon, 1.4), 0.1);
    this.root.add(box, slot, trim);
    for (const side of [-1, 1]) {
      const foot = inkedRect(0.36, 0.08, 0.03, '#1a1430', 0.03);
      foot.position.set(side * (W / 2 - 0.3), 0.05, 0.05);
      const cap = inkedRect(0.12, 0.3, 0.04, '#3d3168', 0.03);
      cap.position.set(side * (W / 2 + 0.24), top - 0.13, 0.06);
      this.root.add(foot, cap);
    }
    // the top bar, its handle and the hook of the telescopic pole behind it
    const rail = inkedRect(W + 0.12, 0.1, 0.04, '#cfd3ea', 0.035);
    const grip = shapeMesh(arcShape(0.13, 0.05, 0, Math.PI), INK, 0.006, 16);
    const grip2 = shapeMesh(arcShape(0.13, 0.025, 0, Math.PI), PAL.chain, 0.008, 16);
    grip.position.y = grip2.position.y = 0.04;
    this.handle.position.set(0, 0.15, 0.02);
    this.bar.add(rail, grip, grip2, this.handle);
    this.bar.position.z = 0.03;
    this.root.add(this.bar);
  }

  set(v: ScreenView) {
    const rise = clamp(v.rise);
    this.fabric.update(v);
    this.fabric.mesh.visible = rise > 0.004;
    this.bar.position.y = PullUpScreen.CASE_TOP + rise * this.H;
  }
}

function drawScreen(g: CanvasRenderingContext2D, v: ScreenView, W: number, H: number) {
  const vh = clamp(v.rise) * H;
  if (vh < 1) return;
  g.save();
  g.beginPath(); g.rect(0, H - vh, W, vh); g.clip();
  // the pale fabric, with the projected dashboard on it (fixed in space: it doesn't rise with it)
  g.fillStyle = '#c3c7e2'; g.fillRect(0, 0, W, H);
  const m = W * 0.025;
  g.fillStyle = '#0b0d2a'; g.fillRect(m, m, W - 2 * m, H - 2 * m);
  if (v.mode === 'dash') drawDash(g, v, m, m, W - 2 * m, H - 2 * m);
  else drawOverlay(g, v, m, m, W - 2 * m, H - 2 * m);
  // the projector's hot spot
  const wash = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
  wash.addColorStop(0, 'rgba(210,220,255,0.12)'); wash.addColorStop(1, 'rgba(210,220,255,0)');
  g.fillStyle = wash; g.fillRect(0, 0, W, H);
  g.restore();
}

/** One line chart: two series (staging cyan, prod pink) in a box, drawn up to `draw`. */
function chart(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, draw: number, dy = 0, lw = 3) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  // grid
  g.strokeStyle = 'rgba(120,130,200,0.18)'; g.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x, y + (h * i) / 4); g.lineTo(x + w, y + (h * i) / 4); g.stroke(); }
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x + (w * i) / 6, y); g.lineTo(x + (w * i) / 6, y + h); g.stroke(); }
  const N = 90, n = Math.floor(N * clamp(draw));
  const line = (off: number, color: string, width: number) => {
    if (n < 2) return;
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const u = i / N, yy = y + h * (1 - (0.12 + 0.76 * series(u, seed))) + off;
      if (i === 0) g.moveTo(x + u * w, yy); else g.lineTo(x + u * w, yy);
    }
    g.stroke();
  };
  line(0, 'rgba(47,226,255,0.35)', lw * 3);
  line(0, '#2fe2ff', lw);
  line(dy, 'rgba(255,62,165,0.35)', lw * 3);
  line(dy, '#ff3ea5', lw);
  g.restore();
}

function drawDash(g: CanvasRenderingContext2D, v: ScreenView, x: number, y: number, w: number, h: number) {
  const s = h / 400;
  g.fillStyle = '#d8dcff'; g.font = `700 ${18 * s}px ${TERM_FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText('METRICS  /checkout  last 30m', x + 14 * s, y + 18 * s);
  // the legend
  g.textAlign = 'right';
  g.fillStyle = '#ff3ea5'; g.fillText('prod', x + w - 14 * s, y + 18 * s);
  g.fillStyle = '#2fe2ff'; g.fillText('staging', x + w - 70 * s, y + 18 * s);
  const top = y + 38 * s, pw = (w - 42 * s) / 2, ph = (h - top + y - 28 * s) / 2;
  PANELS.forEach((p, i) => {
    const px = x + 14 * s + (i % 2) * (pw + 14 * s), py = top + Math.floor(i / 2) * (ph + 14 * s);
    g.fillStyle = '#13163a'; g.fillRect(px, py, pw, ph);
    g.strokeStyle = '#2b2f66'; g.lineWidth = 2; g.strokeRect(px, py, pw, ph);
    g.fillStyle = '#9aa3e8'; g.font = `700 ${14 * s}px ${TERM_FONT}`; g.textAlign = 'left';
    g.fillText(p.name, px + 10 * s, py + 14 * s);
    // each panel starts drawing a moment after the one before; prod's line sits off staging's by
    // the gap (alternately above and below) until they lock together
    const cx = px + 8 * s, cy = py + 28 * s, cw = pw - 16 * s, chh = ph - 36 * s;
    chart(g, cx, cy, cw, chh, p.seed, clamp(v.draw * 1.3 - i * 0.1), v.gap * chh * (i % 2 ? -0.3 : 0.3), 3 * s);
    matchLine(g, cx, cy, cw, chh, p.seed, v.match, 2 * s);
  });
  matchBadge(g, x + w / 2, top + ph + 7 * s, s * 1.5, v.match);
}

/** Once the lines sit on top of each other: one white-hot line in their place. */
function matchLine(g: CanvasRenderingContext2D, cx: number, cy: number, cw: number, chh: number, seed: number, match: number, lw: number) {
  if (match <= 0.01) return;
  g.save();
  g.globalAlpha = clamp(match);
  g.beginPath(); g.rect(cx, cy, cw, chh); g.clip();
  g.strokeStyle = '#ffffff'; g.lineWidth = lw; g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= 90; i++) {
    const u = i / 90, yy = cy + chh * (1 - (0.12 + 0.76 * series(u, seed)));
    if (i === 0) g.moveTo(cx + u * cw, yy); else g.lineTo(cx + u * cw, yy);
  }
  g.stroke();
  g.restore();
}

/** A gold MATCH 100% badge centred on (x, y), popping in with `k` (scale follows any overshoot). */
function matchBadge(g: CanvasRenderingContext2D, x: number, y: number, s: number, k: number) {
  if (k <= 0.01) return;
  g.save();
  g.globalAlpha = clamp(k);
  g.translate(x, y);
  g.scale(Math.max(0.01, k), Math.max(0.01, k));
  g.rotate(-0.06);
  const bw = 150 * s, bh = 40 * s;
  g.fillStyle = '#1a1030'; g.beginPath(); g.roundRect(-bw / 2 - 3 * s, -bh / 2 - 3 * s, bw + 6 * s, bh + 6 * s, 10 * s); g.fill();
  g.fillStyle = '#ffc23d'; g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, 8 * s); g.fill();
  g.fillStyle = '#1a1030'; g.font = `700 ${22 * s}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('MATCH 100%', 0, 1);
  g.restore();
}

function drawOverlay(g: CanvasRenderingContext2D, v: ScreenView, x: number, y: number, w: number, h: number) {
  const s = h / 400;
  g.fillStyle = '#d8dcff'; g.font = `700 ${20 * s}px ${TERM_FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText('latency p99  /checkout', x + 18 * s, y + 22 * s);
  g.textAlign = 'right';
  g.fillStyle = '#ff3ea5'; g.fillText('prod', x + w - 18 * s, y + 22 * s);
  g.fillStyle = '#2fe2ff'; g.fillText('staging', x + w - 84 * s, y + 22 * s);
  const cx = x + 18 * s, cy = y + 48 * s, cw = w - 36 * s, chh = h - 66 * s;
  g.fillStyle = '#13163a'; g.fillRect(cx, cy, cw, chh);
  chart(g, cx, cy, cw, chh, 3, v.draw, v.gap * chh * 0.42, 5 * s);
  matchLine(g, cx, cy, cw, chh, 3, v.match, 2.5 * s);
  matchBadge(g, cx + cw - 90 * s, cy + 34 * s, s, v.match);
}

/**
 * A little projector on an AV cart, drawn side-on with its lens to the left, and a faint beam with
 * dust drifting in it. Origin at the cart's foot. aim() builds the beam once the screen is placed.
 */
export class Projector {
  readonly root = new THREE.Group();
  /** The lens, in the root's frame. */
  readonly lens = new THREE.Vector3(-0.42, 1.12, 0.02);
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private motes: THREE.Mesh[] = [];
  private moteMat: THREE.MeshBasicMaterial;
  private corners: THREE.Vector3[] = [];

  constructor() {
    // the cart: two shelves on legs with castors
    for (const y of [0.3, 0.86]) {
      const shelf = inkedRect(0.9, 0.06, 0.02, '#4a4466', 0.03);
      shelf.position.set(0, y, 0);
      this.root.add(shelf);
    }
    for (const side of [-1, 1]) {
      const leg = inkedRect(0.05, 0.8, 0.02, '#6e6890', 0.025);
      leg.position.set(side * 0.4, 0.5, -0.01);
      const wheel = inkedCircle(0.06, '#15111f', 0.025);
      wheel.position.set(side * 0.4, 0.07, 0.01);
      this.root.add(leg, wheel);
    }
    const tangle = shapeMesh(arcShape(0.12, 0.025, 0.4, 2.8), '#1b1726', 0.01, 10);
    tangle.position.set(0.1, 0.42, 0.01);
    this.root.add(tangle);
    // the projector: a beige box, a vent grille, a lens barrel pointing left with a hot glass
    const body = inkedRect(0.62, 0.3, 0.07, '#d9cfb8', 0.035);
    body.position.set(0, 1.05, 0.01);
    const barrel = inkedRect(0.16, 0.2, 0.03, '#3a3550', 0.03);
    barrel.position.set(-0.36, 1.08, 0.02);
    const glass = shapeMesh(roundedRectShape(0.04, 0.15, 0.02, -0.45, 1.08), glowMat('#eef4ff', 2.6), 0.03);
    this.root.add(body, barrel, glass);
    for (let i = 0; i < 4; i++) this.root.add(shapeMesh(roundedRectShape(0.03, 0.16, 0.012, 0.08 + i * 0.07, 1.05), '#a89d84', 0.02));
    const led = shapeMesh(circleShape(0.022), glowMat(PAL.green, 2.4), 0.03, 8);
    led.position.set(0.22, 1.15, 0.03);
    this.root.add(led);
    // the beam (built in aim) and the dust in it
    this.beamMat = lightMat('#d6e2ff', 0.05);
    this.beam = new THREE.Mesh(new THREE.BufferGeometry(), this.beamMat);
    this.beam.renderOrder = 3;
    this.root.add(this.beam);
    this.moteMat = ownGlow('#ffffff', 1.4, 0.7);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.012 + hash(i, 71) * 0.012, 6), this.moteMat);
      this.motes.push(m);
      this.root.add(m);
    }
  }

  /** Build the beam from the lens to four world-space corners (call after both are placed). */
  aim(corners: THREE.Vector3[]) {
    this.root.updateMatrixWorld(true);
    const inv = this.root.matrixWorld.clone().invert();
    this.corners = corners.map(c => c.clone().applyMatrix4(inv));
    const L = this.lens, pos: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = this.corners[i], b = this.corners[(i + 1) % 4];
      pos.push(L.x, L.y, L.z, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    this.beam.geometry.dispose();
    this.beam.geometry = new THREE.BufferGeometry();
    this.beam.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }

  /** on: the lamp, 0..1. The motes drift through the beam (from t). */
  set(t: number, on: number, cam?: THREE.Camera) {
    this.beam.visible = on > 0.01 && this.corners.length === 4;
    this.beamMat.opacity = 0.05 * on;
    this.moteMat.opacity = 0.7 * on;
    this.motes.forEach((m, i) => {
      m.visible = this.beam.visible;
      if (!m.visible) return;
      // somewhere inside the beam: a point along it, between two corners, drifting slowly
      const u = 0.15 + 0.8 * ((hash(i, 72) + t * 0.025 * (0.5 + hash(i, 73))) % 1);
      const c0 = this.corners[i % 4], c1 = this.corners[(i + 1) % 4];
      const across = 0.2 + 0.6 * hash(i, 74);
      const tx = lerp(c0.x, c1.x, across), ty = lerp(c0.y, c1.y, across), tz = lerp(c0.z, c1.z, across);
      const mid = this.corners.reduce((acc, c) => acc.add(c), new THREE.Vector3()).multiplyScalar(0.25);
      const p = new THREE.Vector3(lerp(mid.x, tx, 0.7), lerp(mid.y, ty, 0.7), lerp(mid.z, tz, 0.7));
      m.position.copy(this.lens).lerp(p, u);
      m.position.y += Math.sin(t * 0.9 + i) * 0.04;
      if (cam) m.quaternion.copy(cam.quaternion);
    });
  }
}

// ---------------------------------------------------------------------------------------------
/** A lab stand: a pole of height h on a weighted foot with castors (origin at the foot). */
export function labStand(h: number) {
  const g = new THREE.Group();
  const pole = inkedRect(0.07, h, 0.03, '#7c76a0', 0.025);
  pole.position.y = h / 2;
  // collar and foot overlap the pole, so each sits a step in front of it (at one depth they flickered)
  const collar = inkedRect(0.14, 0.08, 0.03, '#4a4466', 0.025);
  collar.position.set(0, h * 0.55, 0.006);
  const foot = inkedRect(0.9, 0.07, 0.03, '#3a3456', 0.03);
  foot.position.set(0, 0.09, 0.006);
  g.add(pole, collar, foot);
  for (const side of [-1, 1]) {
    const w = inkedCircle(0.05, '#15111f', 0.02);
    w.position.set(side * 0.4, 0.05, 0.01);
    g.add(w);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
/** A pageant sash with a word on it, worn across a dancer's torso (add it to the dancer's body). */
export function sash(text: string, color: string) {
  const g = new THREE.Group();
  const band = inkedRect(1.12, 0.21, 0.02, color, 0.03);
  const word = staticPlane(1.0, 0.18, 300, (c, W, H) => {
    c.fillStyle = '#ffffff'; c.font = `700 ${H * 0.66}px ${UI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, W / 2, H * 0.55);
  });
  cutout(word, 0.4);
  word.position.z = 0.006;
  const sheen = shapeMesh(roundedRectShape(1.0, 0.025, 0.01, 0, 0.06), ownMat('#ffffff', 0.35, true), 0.004);
  g.add(band, sheen, word);
  g.rotation.z = -0.95;
  g.position.set(0, 1.36, 0.02);
  return g;
}

// ---------------------------------------------------------------------------------------------
/** A tall free-standing gold mirror frame with no glass in it, on little feet. Origin at its foot. */
export function mirrorFrame(w = 1.7, h = 2.7) {
  const g = new THREE.Group();
  const t = 0.16;
  // each piece a step in front of what it overlaps (overlapping pieces at one depth flickered):
  // stiles, then the rails across their ends, then the corner scrolls, the crest and its gem
  const bar = (bw: number, bh: number, x: number, y: number) => {
    const z = bw > bh ? 0.008 : 0;
    const b = inkedRect(bw, bh, 0.04, PAL.chain, 0.04);
    b.position.set(x, y, z);
    const shade = shapeMesh(roundedRectShape(bw * 0.86, bh * 0.86, 0.02, 0, 0), PAL.chainShade, 0.005);
    shade.scale.set(bw > bh ? 1 : 0.35, bw > bh ? 0.35 : 1, 1);
    shade.position.set(x + (bw > bh ? 0 : t * 0.18), y - (bw > bh ? t * 0.18 : 0), z + 0.004);
    g.add(b, shade);
  };
  const y0 = 0.25;
  bar(t, h, -w / 2, y0 + h / 2);
  bar(t, h, w / 2, y0 + h / 2);
  bar(w + t, t, 0, y0);
  bar(w + t, t, 0, y0 + h);
  // a crest on top and scrolls on the corners
  const crest = inkedCircle(0.2, PAL.chain, 0.04);
  crest.position.set(0, y0 + h + 0.18, 0.016);
  const gem = shapeMesh(circleShape(0.08), glowMat(PAL.pink, 1.6), 0.022, 16);
  gem.position.set(0, y0 + h + 0.18, 0.022);
  g.add(crest, gem);
  for (const [x, y] of [[-w / 2, y0], [w / 2, y0], [-w / 2, y0 + h], [w / 2, y0 + h]]) {
    const s = shapeMesh(arcShape(0.13, 0.05, 0, Math.PI * 1.6), PAL.chainShade, 0.012, 16);
    s.position.set(x, y, 0.018);
    s.rotation.z = Math.atan2(y - y0 - h / 2, x) + 0.6;
    g.add(s);
  }
  for (const side of [-1, 1]) {
    const foot = inkedRect(0.36, 0.12, 0.05, PAL.chainShade, 0.03);
    foot.position.set(side * (w / 2), 0.06, -0.01); // behind the frame
    g.add(foot);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
/** The X-ray light box from a doctor's office, on the booth wall, with two request printouts
 *  (staging, prod) clipped to it like films. They slide together until they line up exactly. */
export class LightBox {
  readonly root = new THREE.Group();
  static readonly W = 3.6;
  static readonly H = 2.4;
  private panel: THREE.MeshBasicMaterial;
  private films: THREE.Group[] = [];
  private filmMats: THREE.MeshBasicMaterial[] = [];

  constructor() {
    const W = LightBox.W, H = LightBox.H;
    const frame = inkedRect(W + 0.3, H + 0.3, 0.08, '#3a3550', 0.05);
    this.panel = ownGlow('#e8f0ff', 1.15);
    const panel = shapeMesh(roundedRectShape(W, H, 0.04), this.panel, 0.01);
    const sw = inkedRect(0.16, 0.1, 0.02, '#d64545', 0.02);
    sw.position.set(W / 2 - 0.15, -H / 2 - 0.07, 0.02);
    this.root.add(frame, panel, sw);
    for (const [k, label] of [[0, 'STAGING'], [1, 'PROD']] as [number, string][]) {
      const film = new THREE.Group();
      const sheet = staticPlane(1.9, 2.2, 220, (g, cw, ch) => {
        // dark film with the request printed in pale ink, a fingerprint whorl and a label
        g.fillStyle = k ? 'rgba(60,10,40,0.62)' : 'rgba(10,40,60,0.62)';
        g.beginPath(); g.roundRect(0, 0, cw, ch, cw * 0.03); g.fill();
        g.strokeStyle = k ? 'rgba(255,120,190,0.55)' : 'rgba(120,230,255,0.55)';
        g.lineWidth = cw * 0.004;
        for (let r = 1; r <= 9; r++) { g.beginPath(); g.ellipse(cw * 0.78, ch * 0.78, r * cw * 0.014, r * cw * 0.018, 0.3, 0.2, Math.PI * 1.85); g.stroke(); }
        // the labels sit at opposite corners, so once the films lie on top of each other they
        // read STAGING ... PROD rather than one printed over the other
        const pad = cw * 0.06, inner = cw - 2 * pad;
        g.fillStyle = k ? '#ff9fd0' : '#9ff0ff';
        g.textBaseline = 'middle'; g.textAlign = k ? 'right' : 'left';
        fitFont(g, [label], ch * 0.055, inner * 0.45, TERM_FONT, 700);
        g.fillText(label, k ? cw - pad : pad, ch * 0.07);
        // the request, its type sized so the widest line fits inside the film's margins
        g.textAlign = 'left';
        g.fillStyle = 'rgba(245,250,255,0.92)';
        fitFont(g, REQUEST_LINES, ch * 0.048, inner, TERM_FONT, 700);
        REQUEST_LINES.forEach((l, i) => g.fillText(l, pad, ch * (0.18 + i * 0.075)));
      });
      const mat = sheet.material as THREE.MeshBasicMaterial;
      mat.depthWrite = false;
      sheet.renderOrder = 2 + k;
      const clip = inkedRect(0.3, 0.12, 0.03, '#9aa0b8', 0.025);
      clip.position.set(0, 1.12, 0.01);
      film.add(sheet, clip);
      this.films.push(film);
      this.filmMats.push(mat);
      this.root.add(film);
    }
  }

  /** slide: 0 the films side by side .. 1 on top of each other. lit: the light box on, 0..1. */
  set(t: number, slide: number, lit: number, match: number) {
    const s = clamp(slide);
    this.films[0].position.set(lerp(-0.95, 0, s), 0, 0.03);
    this.films[1].position.set(lerp(0.95, 0, s), 0, 0.05);
    // bright enough to read as a lit box, not so bright it blooms the films away
    setGlow(this.panel, match > 0 ? '#bfffd6' : '#dfe8ff', lerp(0.22, 0.78 + 0.1 * match, clamp(lit)) * (0.97 + 0.03 * Math.sin(t * 50)));
    this.filmMats.forEach(m => m.color.setScalar(lerp(0.6, 1, clamp(lit))));
  }
}

// ---------------------------------------------------------------------------------------------
/** The request bodies as bytes, staging on top and prod below: identical except one. */
const BODY = '{"cart":91,"items":[{"sku":"A12","qty":2},{"sku":"C07","qty":1}],"total":59.00,"v":1}';
/** Index of the byte that differs ('1' on staging, '2' on prod). */
export const ODD_BYTE = BODY.lastIndexOf('1');

/** A hex dump ticker: two rows of byte cells scrolling past a reader head, each pair ticked green
 *  as it passes, until the odd pair stops under the head flashing red. Origin at its centre. */
export class ByteTicker {
  readonly root = new THREE.Group();
  static readonly W = 7.2;
  static readonly H = 2.6;
  private board: { mesh: THREE.Mesh; update(v: TickerView): void };

  constructor() {
    const W = ByteTicker.W, H = ByteTicker.H;
    const frame = inkedRect(W + 0.24, H + 0.24, 0.1, '#2a2148', 0.05);
    frame.position.z = -0.02;
    this.board = canvasPlane(W, H, 140, (g, v: TickerView, cw, ch) => drawTicker(g, v, cw, ch));
    solid(this.board.mesh);
    (this.board.mesh.material as THREE.MeshBasicMaterial).color.setScalar(1.12);
    this.root.add(frame, this.board.mesh);
  }

  /** pos: the byte index under the reader head (fractional while scrolling). odd: the red flash,
   *  0..1. tap: seconds since a finger tapped the glass over the reader head (negative = no tap). */
  set(t: number, pos: number, odd: number, tap = -1, blur = 0) { this.board.update({ t, pos, odd, tap, blur }); }
}

const hex = (c: string) => c.charCodeAt(0).toString(16).padStart(2, '0');
interface TickerView { t: number; pos: number; odd: number; tap: number; blur: number }

function drawTicker(g: CanvasRenderingContext2D, v: TickerView, W: number, H: number) {
  g.fillStyle = '#070a16'; g.fillRect(0, 0, W, H);
  // scanlines
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  const cell = W / 9.5, head = W / 2;
  const rows = [{ y: H * 0.33, label: 'staging', color: '#2fe2ff' }, { y: H * 0.7, label: 'prod', color: '#ff3ea5' }];
  g.font = `400 ${H * 0.085}px ${CRT_FONT}`; g.textBaseline = 'middle';
  rows.forEach(r => { g.fillStyle = r.color; g.textAlign = 'left'; g.fillText(r.label, W * 0.015, r.y - H * 0.16); });
  // the reader head: a bright frame round the middle column
  g.strokeStyle = v.odd > 0 ? `rgba(255,50,64,${0.6 + 0.4 * v.odd})` : 'rgba(255,194,61,0.9)';
  g.lineWidth = W * 0.004;
  g.strokeRect(head - cell * 0.48, H * 0.17, cell * 0.96, H * 0.73);
  const first = Math.floor(v.pos - 5), last = Math.ceil(v.pos + 5);
  for (let i = first; i <= last; i++) {
    if (i < 0 || i >= BODY.length) continue;
    const x = head + (i - v.pos) * cell;
    const odd = i === ODD_BYTE;
    const passed = i < v.pos - 0.45 || (odd && v.odd > 0);
    rows.forEach((r, k) => {
      const ch = odd && k === 1 ? '2' : BODY[i];
      const bad = odd && v.odd > 0;
      const flash = bad ? (Math.floor(v.t * 6) % 2 ? 1 : 0.55) * v.odd : 0;
      g.fillStyle = bad ? `rgba(255,50,64,${0.25 + 0.35 * flash})` : passed ? 'rgba(69,255,138,0.12)' : 'rgba(255,255,255,0.04)';
      g.beginPath(); g.roundRect(x - cell * 0.42, r.y - H * 0.13, cell * 0.84, H * 0.26, cell * 0.08); g.fill();
      g.textAlign = 'center';
      g.fillStyle = bad ? '#ff5a66' : passed ? '#45ff8a' : '#d8dcff';
      g.font = `400 ${H * 0.16}px ${CRT_FONT}`;
      // at speed the digits smear sideways (trailing to the right: they move left)
      if (v.blur > 0.05) {
        g.globalAlpha = 0.3;
        for (let k = 1; k <= 3; k++) g.fillText(hex(ch), x + k * cell * 0.16 * v.blur, r.y - H * 0.025);
        g.globalAlpha = 1;
      }
      g.fillText(hex(ch), x, r.y - H * 0.025);
      g.fillStyle = bad ? '#ffb0b6' : 'rgba(216,220,255,0.6)';
      g.font = `400 ${H * 0.085}px ${CRT_FONT}`;
      g.fillText(ch, x, r.y + H * 0.08);
    });
    // a tick between the rows for each matched pair
    if (passed && !odd) {
      g.strokeStyle = '#45ff8a'; g.lineWidth = W * 0.004; g.lineCap = 'round';
      const cy = (rows[0].y + rows[1].y) / 2;
      g.beginPath(); g.moveTo(x - cell * 0.1, cy); g.lineTo(x - cell * 0.02, cy + H * 0.03); g.lineTo(x + cell * 0.12, cy - H * 0.035); g.stroke();
    }
    if (odd && v.odd > 0) {
      g.fillStyle = `rgba(255,90,102,${v.odd})`; g.font = `400 ${H * 0.14}px ${CRT_FONT}`; g.textAlign = 'center';
      g.fillText('≠', x, (rows[0].y + rows[1].y) / 2);
    }
  }
  // a tap on the glass: rings spreading from the reader head
  if (v.tap >= 0 && v.tap < 0.6) {
    for (const d of [0, 0.12]) {
      const k = clamp((v.tap - d) / 0.45);
      if (k <= 0 || k >= 1) continue;
      g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; g.lineWidth = W * 0.005;
      g.beginPath(); g.ellipse(head, H * 0.52, cell * (0.3 + 1.6 * k), H * (0.12 + 0.5 * k), 0, 0, Math.PI * 2); g.stroke();
    }
  }
  // the offset counter, bottom right
  g.fillStyle = 'rgba(216,220,255,0.55)'; g.font = `400 ${H * 0.075}px ${CRT_FONT}`; g.textAlign = 'right';
  g.fillText(`offset 0x${Math.max(0, Math.round(v.pos)).toString(16).padStart(4, '0')}`, W * 0.985, H * 0.94);
}

// ---------------------------------------------------------------------------------------------
/** The booth's gear stacked into a teetering tower on the Cache's head: speaker cab, mixer, a deck,
 *  a terminal, a record crate and the incident sign on top. Origin at the bottom of the stack;
 *  set() leans it (the whole thing pivots at the Cache's head, each layer lagging a little). */
export class GearTower {
  readonly root = new THREE.Group();
  private layers: THREE.Group[] = [];

  constructor() {
    const add = (h: number, build: (g: THREE.Group) => void) => {
      const g = new THREE.Group();
      build(g);
      const parent = this.layers.length ? this.layers[this.layers.length - 1] : this.root;
      // each layer sits on the one below, so leaning a low layer carries everything above it
      g.position.y = this.layers.length ? (parent.userData.h as number) : 0;
      g.position.z = this.layers.length ? 0.03 : 0; // and in front of it (overlapping edges at one depth flickered)
      g.userData.h = h;
      parent.add(g);
      this.layers.push(g);
    };
    add(0.95, g => {
      g.add(inkedRect(1.3, 0.95, 0.06, '#1d1730', 0.05).translateY(0.475));
      for (const y of [0.3, 0.68]) {
        const w = inkedCircle(0.22, '#2a2440', 0.04); w.position.set(0, y, 0.01);
        const c = inkedCircle(0.12, '#3b3458', 0.03); c.position.set(0, y, 0.02);
        g.add(w, c);
      }
    });
    add(0.32, g => {
      g.add(inkedRect(1.45, 0.32, 0.05, '#2f2457', 0.05).translateY(0.16));
      for (let i = 0; i < 6; i++) {
        const k = inkedCircle(0.045, '#d8d2f0', 0.015); k.position.set(-0.55 + i * 0.22, 0.17, 0.01); g.add(k);
      }
      const strip = shapeMesh(roundedRectShape(1.2, 0.035, 0.015, 0, 0.05), glowMat(PAL.pink, 1.8), 0.01);
      g.add(strip);
    });
    add(0.22, g => {
      g.add(inkedRect(1.1, 0.22, 0.04, '#241a45', 0.04).translateY(0.11));
      const rec = inkedCircle(0.32, '#0f0b1e', 0.03); rec.position.set(-0.1, 0.33, -0.01); rec.scale.y = 0.3;
      g.add(rec);
    });
    add(0.62, g => {
      g.add(inkedRect(0.85, 0.62, 0.06, '#c9c3da', 0.04).translateY(0.31));
      const scr = shapeMesh(roundedRectShape(0.66, 0.42, 0.04, 0, 0.33), ownGlow(PAL.green, 0.55), 0.01);
      g.add(scr);
      for (let i = 0; i < 4; i++) g.add(shapeMesh(roundedRectShape(0.4 - hash(i, 3) * 0.2, 0.04, 0.01, -0.12, 0.45 - i * 0.07), glowMat(PAL.green, 1.6), 0.015));
    });
    add(0.36, g => {
      g.add(inkedRect(0.7, 0.36, 0.04, '#8a5a32', 0.04).translateY(0.18));
      for (let i = 0; i < 5; i++) {
        const r = inkedRect(0.08, 0.34, 0.01, ['#ff3ea5', '#2fe2ff', '#ffc23d', '#a35cff', '#45ff8a'][i], 0.015);
        r.position.set(-0.22 + i * 0.11, 0.42, -0.01); r.rotation.z = (hash(i, 9) - 0.5) * 0.3;
        g.add(r);
      }
    });
    add(0.5, g => {
      g.add(inkedRect(0.95, 0.5, 0.05, '#1a1430', 0.04).translateY(0.25));
      const lbl = staticPlane(0.85, 0.18, 300, (c, W, H) => {
        c.fillStyle = '#e8e2ff'; c.textAlign = 'center'; c.textBaseline = 'middle';
        fitFont(c, ['DAYS SINCE INCIDENT'], H * 0.55, W * 0.94, UI_FONT, 700); // measured to fit the sign
        c.fillText('DAYS SINCE INCIDENT', W / 2, H * 0.5);
      });
      cutout(lbl, 0.4);
      lbl.position.set(0, 0.36, 0.01);
      const zero = staticPlane(0.3, 0.26, 300, (c, W, H) => {
        c.fillStyle = PAL.red; c.font = `400 ${H * 0.95}px ${CRT_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('0', W / 2, H * 0.55);
      });
      cutout(zero, 0.4);
      zero.position.set(0, 0.16, 0.01);
      (zero.material as THREE.MeshBasicMaterial).color.setScalar(1.6);
      g.add(lbl, zero);
    });
  }

  /** lean: radians of the whole stack; wobble: extra sway per layer (they lag one another). */
  set(t: number, lean: number, wobble: number) {
    this.layers.forEach((l, i) => {
      l.rotation.z = (i === 0 ? lean : 0) + wobble * 0.04 * Math.sin(t * 14 - i * 0.8) * (i ? 1 : 0.4);
      l.position.x = i ? wobble * 0.015 * Math.sin(t * 9 + i) : 0;
    });
  }
}

// ---------------------------------------------------------------------------------------------
/** A little service door low in the riser's front face, hinged on its left edge. Origin at the
 *  bottom middle of the doorway, on the floor, facing +z (stick it on the riser front). */
export class RiserDoor {
  readonly root = new THREE.Group();
  private panel = new THREE.Group();
  static readonly W = 0.95;
  static readonly H = 0.72;

  constructor() {
    const { W, H } = RiserDoor;
    const frame = inkedRect(W + 0.12, H + 0.08, 0.05, '#2c2450', 0.035);
    frame.position.set(0, H / 2 + 0.02, 0.004);
    const hole = shapeMesh(roundedRectShape(W, H, 0.04, 0, H / 2 + 0.03), '#020108', 0.012);
    // a hint of the crawl space: a pipe and a faint glow far in
    const pipe = shapeMesh(roundedRectShape(W * 0.8, 0.05, 0.02, 0.04, H * 0.62), '#120d22', 0.013);
    const glint = shapeMesh(circleShape(0.05), ownMat('#3a1430'), 0.013, 10);
    glint.position.set(0.22, H * 0.3, 0.013);
    this.root.add(frame, hole, pipe, glint);
    // the door: a panel with vents and a knob, on a hinge at the left edge
    this.panel.position.set(-W / 2, 0.03, 0.03);
    const door = inkedRect(W, H, 0.04, '#3d3168', 0.03);
    door.position.set(W / 2, H / 2, 0);
    this.panel.add(door);
    for (let i = 0; i < 4; i++) this.panel.add(shapeMesh(roundedRectShape(W * 0.5, 0.03, 0.012, W / 2, H * 0.72 - i * 0.07), '#2a2148', 0.004));
    const knob = inkedCircle(0.04, PAL.chain, 0.02);
    knob.position.set(W - 0.12, H * 0.45, 0.006);
    this.panel.add(knob);
    this.root.add(this.panel);
  }

  /** open: 0 shut .. 1 swung wide; rattle: a jiggle (someone in there), 0..1. */
  set(t: number, open: number, rattle = 0) {
    const a = clamp(open) * Math.PI * 0.46;
    // a flat door swinging toward us: it narrows toward the hinge and comes forward a little
    this.panel.scale.x = Math.max(0.06, Math.cos(a));
    this.panel.position.z = 0.03 + Math.sin(a) * 0.25;
    this.panel.rotation.z = rattle * 0.03 * Math.sin(t * 47);
  }
}

// ---------------------------------------------------------------------------------------------
/** A mechanic's creeper parked by the service door: a padded board on four casters, for rolling
 *  under things on your back. Origin on the floor under the middle; the head end points to -z. */
export class Creeper {
  readonly root = new THREE.Group();
  static readonly L = 1.75;
  /** Height of the pad's top surface (where a rider lies). */
  static readonly TOP = 0.17;

  constructor() {
    const L = Creeper.L;
    // the deck lies flat, facing up: its local +y runs toward -z (the head end)
    const deck = new THREE.Group();
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = Creeper.TOP - 0.03;
    deck.add(inkedRect(0.84, L, 0.04, '#2a2238', 0.03));
    const pad = inkedRect(0.7, L - 0.42, 0.03, '#a8263c', 0.03);
    pad.position.set(0, -0.1, 0.01);
    const head = inkedRect(0.56, 0.26, 0.03, '#7e1a2c', 0.03);
    head.position.set(0, L / 2 - 0.2, 0.012);
    deck.add(pad, head);
    for (let i = 0; i < 5; i++) deck.add(shapeMesh(roundedRectShape(0.56, 0.02, 0.01, 0, -L / 2 + 0.35 + i * 0.22), '#7e1a2c', 0.02));
    this.root.add(deck);
    // its front edge and the casters, which only show from low down
    const lip = inkedRect(0.86, 0.07, 0.02, '#3a3150', 0.02);
    lip.position.set(0, Creeper.TOP - 0.04, L / 2);
    this.root.add(lip);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = inkedCircle(0.05, '#15111f', 0.02);
      w.position.set(sx * 0.32, 0.05, sz * (L / 2 - 0.16));
      this.root.add(w);
    }
  }
}

// ---------------------------------------------------------------------------------------------
/**
 * The first trace from verse 1 (the path through the handler), found under the booth: a coil of
 * cyan glow tube gone dull with dust and cobweb, with a paper tag on it. dust 1 = filthy; glow
 * 0..1 brings the light back. Origin at the middle of the coil.
 */
export class TraceCoil {
  readonly root = new THREE.Group();
  private mat: THREE.MeshBasicMaterial;
  private haloMat: THREE.MeshBasicMaterial;
  private dust: THREE.Group;
  private web: THREE.Group;

  constructor() {
    const pts: THREE.Vector3[] = [];
    const turns = 3.2, N = 90;
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = u * turns * Math.PI * 2 + 0.4;
      const r = 0.24 + 0.025 * Math.sin(a * 0.5) + 0.02 * hash(i, 5);
      pts.push(new THREE.Vector3(Math.cos(a) * r + (u - 0.5) * 0.09, Math.sin(a) * r * 0.86, 0.02 * u));
    }
    // and the loose end hanging out of the coil
    const last = pts[pts.length - 1];
    for (let i = 1; i <= 6; i++) pts.push(new THREE.Vector3(last.x + i * 0.02, last.y - i * 0.07, last.z + 0.004 * i));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
    this.mat = ownGlow(PAL.cyan, 1);
    this.haloMat = lightMat(PAL.cyan, 0);
    const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.032, 6, false), this.mat);
    const haloTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.1, 6, false), this.haloMat);
    this.root.add(core, haloTube);
    // dust: grey fluff stuck all over it
    this.dust = new THREE.Group();
    for (let i = 0; i < 40; i++) {
      const u = hash(i, 61);
      const p = curve.getPointAt(u);
      const d = shapeMesh(circleShape(0.018 + hash(i, 62) * 0.03), i % 3 ? '#8d889e' : '#b4afc4', 0.05, 8);
      d.position.set(p.x + (hash(i, 63) - 0.5) * 0.05, p.y + (hash(i, 64) - 0.5) * 0.05, p.z + 0.04);
      this.dust.add(d);
    }
    this.root.add(this.dust);
    // a cobweb strung across the top of the coil
    this.web = new THREE.Group();
    const webMat = ownMat('#e9e6f5', 0.7, true);
    for (let i = 0; i < 4; i++) {
      const st = shapeMesh(roundedRectShape(0.5 - i * 0.07, 0.01, 0.005), webMat, 0.06);
      st.position.set(-0.02 + i * 0.02, 0.2 + i * 0.035, 0.06);
      st.rotation.z = -0.3 + i * 0.18;
      this.web.add(st);
    }
    this.root.add(this.web);
    // the tag: an old paper luggage tag on a string, cut as long as its word needs (measured)
    const TAG_H = 0.17, TAG_PPU = 400, TAG_WORD = 'handler';
    const tagFont = `700 ${TAG_H * TAG_PPU * 0.5}px ${TERM_FONT}`;
    const ruler = document.createElement('canvas').getContext('2d')!;
    ruler.font = tagFont;
    const holeX = TAG_H * 0.28, textX = TAG_H * 0.56;
    const tagW = textX + ruler.measureText(TAG_WORD).width / TAG_PPU + TAG_H * 0.24;
    const tag = staticPlane(tagW, TAG_H, TAG_PPU, (g, W, H) => {
      const e = H * 0.03; // half the ink line: keeps the outline inside the canvas
      g.beginPath(); g.moveTo(H * 0.24, e); g.lineTo(W - e, e); g.lineTo(W - e, H - e); g.lineTo(H * 0.24, H - e); g.lineTo(e, H / 2); g.closePath();
      g.fillStyle = '#efe1bd'; g.fill();
      g.strokeStyle = INK; g.lineWidth = 2 * e; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(holeX * TAG_PPU, H / 2, H * 0.1, 0, Math.PI * 2); g.fill();
      g.font = tagFont; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(TAG_WORD, textX * TAG_PPU, H * 0.55);
    });
    cutout(tag, 0.4);
    // the hole stays where the string ties on and the tag runs out from it, as long as it needs
    // to be; it sits 0.007 in front of the string
    const TAG_ROT = -0.35, along = tagW / 2 - holeX;
    tag.position.set(0.265 + along * Math.cos(TAG_ROT), -0.158 + along * Math.sin(TAG_ROT), 0.072);
    tag.rotation.z = TAG_ROT;
    const string = shapeMesh(roundedRectShape(0.16, 0.012, 0.005), '#d9c7a8', 0.065);
    string.position.set(0.24, -0.12, 0.065);
    string.rotation.z = -0.7;
    this.root.add(tag, string);
  }

  set(t: number, dust: number, glow: number) {
    const d = clamp(dust), g = clamp(glow);
    // dusty: a dull grey-blue tube; lit: hot cyan, with a flicker as it comes back
    const flick = g > 0 && g < 1 ? (hash(Math.floor(t * 20), 31) < 0.3 ? 0.4 : 1) : 1;
    setGlow(this.mat, g > 0.05 ? PAL.cyan : '#56708a', lerp(0.75, 1.3, g * flick));
    this.haloMat.opacity = 0.07 * g * flick;
    this.dust.visible = d > 0.05;
    this.dust.scale.setScalar(Math.max(0.01, d));
    this.web.visible = d > 0.5;
  }
}

/** A cloud of dust blown off something: grey puffs bursting out along `dir` and fading. */
export class DustPuff {
  readonly root = new THREE.Group();
  private puffs: { g: THREE.Group; fill: THREE.MeshBasicMaterial; ink: THREE.MeshBasicMaterial }[] = [];

  constructor(readonly n = 12) {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const ink = ownMat(INK, 1, true), fill = ownMat(i % 2 ? '#a7a2b8' : '#c9c4d8', 1, true);
      g.add(shapeMesh(circleShape(1.14), ink, 0, 14), shapeMesh(circleShape(1), fill, 0.001, 14));
      this.root.add(g);
      this.puffs.push({ g, fill, ink });
    }
  }

  /** s: seconds since the puff (negative = not yet); dir: x direction it blows (+1 right, -1 left). */
  set(s: number, dir = 1, cam?: THREE.Camera, size = 1) {
    this.puffs.forEach((p, i) => {
      const age = s - i * 0.02;
      const life = 0.7 + 0.4 * hash(i, 41);
      const on = age >= 0 && age < life;
      p.g.visible = on;
      if (!on) return;
      const u = age / life, out = easeOutCubic(clamp(age / 0.5));
      const a = (hash(i, 42) - 0.5) * 1.6;
      p.g.position.set(dir * out * (0.35 + 0.45 * hash(i, 43)) * size, (Math.sin(a) * out * 0.35 + age * 0.15) * size, 0.01 * i);
      p.g.scale.setScalar((0.05 + 0.1 * out) * (0.7 + 0.6 * hash(i, 44)) * size);
      const k = Math.pow(1 - u, 1.4);
      p.fill.opacity = 0.9 * k;
      p.ink.opacity = 0.5 * k;
      if (cam) p.g.quaternion.copy(cam.quaternion);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// 2D overlay pieces

/** The screen position of a world point (pixels). */
export function screenAt(p: THREE.Vector3, cam: THREE.Camera, W: number, H: number) {
  v3.copy(p).project(cam);
  return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
}

/**
 * A comic speech bubble at (x, y) pixels (the tail's tip), growing up and to one side, with words
 * that appear as they're sung. Pops in with the first word and out after `until`.
 */
export function drawBubble(g: CanvasRenderingContext2D, t: number, H: number, at: { x: number; y: number }, words: { text: string; start: number }[], until: number, o: { side?: 1 | -1; size?: number; color?: string } = {}) {
  if (!words.length || t < words[0].start - 0.05) return;
  const side = o.side ?? 1, px = (o.size ?? 74) * (H / 1080);
  const inK = easeOutBack(clamp((t - words[0].start + 0.05) / 0.2), 2.2);
  const outK = clamp((t - until) / 0.18);
  const k = inK * (1 - easeOutCubic(outK));
  if (k <= 0.01) return;
  g.save();
  g.font = `400 ${px}px ${DISCO_FONT}`;
  const full = words.map(w => w.text).join(' ');
  const tw = g.measureText(full).width;
  const bw = tw + px * 1.2, bh = px * 1.6;
  const bx = at.x + side * px * 0.6 - (side < 0 ? bw : 0), by = at.y - bh - px * 0.7;
  g.translate(at.x, at.y);
  g.scale(k, k);
  g.translate(-at.x, -at.y);
  // bubble and tail, inked
  const path = () => {
    g.beginPath();
    g.roundRect(bx, by, bw, bh, bh * 0.45);
    g.moveTo(at.x + side * px * 0.9, by + bh - 2);
    g.lineTo(at.x, at.y);
    g.lineTo(at.x + side * px * 1.9, by + bh - 2);
  };
  path();
  g.lineWidth = px * 0.16; g.strokeStyle = PAL.ink; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = '#fff7fb'; g.fill();
  // the words, each appearing as sung
  let x = bx + px * 0.6;
  g.textBaseline = 'middle';
  for (const w of words) {
    const ww = g.measureText(w.text).width;
    const dt = t - w.start + 1 / 30;
    if (dt >= 0) {
      const s = easeOutBack(clamp(dt / 0.16), 2.6);
      g.save();
      g.translate(x + ww / 2, by + bh * 0.53);
      g.scale(s, s);
      g.fillStyle = o.color ?? PAL.pink;
      g.fillText(w.text, -ww / 2, 0);
      g.restore();
    }
    x += ww + g.measureText(' ').width;
  }
  g.restore();
}
