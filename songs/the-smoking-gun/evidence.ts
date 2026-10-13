// The evidence that lines up in each chorus, when Clawd is sure he's cracked it:
//   FloorLogs   log lines lying on the dance floor that snap into neat rows on the kicks
//   Timeline    a neon timeline along the back wall: markers pop on the beat, a gold commit tag,
//               and a red X that lands just after it
//   NeonArrow   a big Vegas-style neon arrow that swings round and points at one tile
//   Revolver    the smoking gun itself (origin at the grip, barrel along +x)
//   Smoke       a curl of cartoon smoke rising from a point
// plus two things drawn on a shot's 2D overlay: the spotlight veil for the pause and the GOTCHA
// rubber stamp. Every set(...) sets everything it animates from song time.
import * as THREE from 'three';
import type { Frame } from '../../engine/types';
import { INK, arcShape, circleShape, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { clamp, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { CRT_FONT, DISCO_FONT, PAL, TERM_FONT, cutout, halo, ownGlow, setGlow } from './look';
import { Burst } from './props';

/** A run of neon tube along a polyline (closed: back to the first point). */
function tubeRun(pts: [number, number][], mat: THREE.Material, w: number, closed = false, z = 0) {
  const g = new THREE.Group();
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = shapeMesh(roundedRectShape(len + w, w, w / 2), mat, z);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    g.add(m);
  }
  return g;
}

const polyShape = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};

// ---------------------------------------------------------------------------------------------
/** The incident's log lines (the last one is the real clue, for anyone pausing the video). */
const LOG_LINES: [string, string][] = [
  ['01:58:02  DEPLOY  build #4127', PAL.gold],
  ['02:13:55  GET     /checkout  200   12ms', PAL.green],
  ['02:14:01  GET     /checkout  500   cache MISS', PAL.red],
  ['02:14:01  WARN    cache stale  key=cart:91', PAL.amber],
  ['02:14:02  ERROR   handler timeout 3001ms', PAL.red],
  ['02:14:02  GET     /checkout  500   cache MISS', PAL.red],
  ['02:14:03  RETRY   /checkout  attempt 2', PAL.cyan],
  ['02:14:03  POST    /checkout  500   {"v": 2}', PAL.red],
];

/** Log lines lying on the dance floor. Loose, they drift and sit at odd angles; aligned, they
 *  sit in one neat column, so the timestamps and status codes line up. */
export class FloorLogs {
  readonly root = new THREE.Group();
  private rows: { pivot: THREE.Group; mat: THREE.MeshBasicMaterial }[] = [];
  static readonly W = 12.4;

  /** slots: the z of each row on the floor. */
  constructor(readonly slots: number[]) {
    const H = 0.6;
    LOG_LINES.forEach(([text, color]) => {
      const plane = staticPlane(FloorLogs.W, H, 100, (g, Wp, Hp) => {
        g.font = `700 ${Hp * 0.6}px ${TERM_FONT}`;
        g.textBaseline = 'middle';
        // every row starts at the same x, centred for the longest line, so columns line up
        const x0 = (Wp - g.measureText('M').width * 44) / 2;
        g.lineJoin = 'round'; g.lineWidth = Hp * 0.18; g.strokeStyle = 'rgba(6,4,15,0.9)';
        g.strokeText(text, x0, Hp * 0.55);
        g.fillStyle = color; g.fillText(text, x0, Hp * 0.55);
      });
      plane.rotation.x = -Math.PI / 2;
      const pivot = new THREE.Group();
      pivot.add(plane);
      this.root.add(pivot);
      this.rows.push({ pivot, mat: plane.material as THREE.MeshBasicMaterial });
    });
  }

  /** aligned(i): 0 loose .. 1 in its row; flash(i): a brightness kick as it snaps in. t0: when the
   *  loose rows started drifting. */
  set(t: number, t0: number, aligned: (i: number) => number, flash: (i: number) => number) {
    this.rows.forEach((r, i) => {
      const k = aligned(i);
      const dir = hash(i, 3) < 0.5 ? -1 : 1;
      const loose = (hash(i, 1) - 0.5) * 6 + dir * (0.5 + hash(i, 2) * 0.7) * (t - t0);
      r.pivot.position.set(lerp(loose, 0, k), 0.03 + i * 0.001, this.slots[i] + lerp((hash(i, 4) - 0.5) * 0.5, 0, k));
      r.pivot.rotation.y = lerp((hash(i, 5) - 0.5) * 0.3, 0, k);
      r.mat.color.setScalar(1.2 + 0.9 * clamp(flash(i)));
    });
  }
}

// ---------------------------------------------------------------------------------------------
/** Flag type: its size (world units), the room either side of it, the pole's half width, the point. */
const FLAG = { font: 0.2, pad: 0.12, pole: 0.035, tip: 0.3, min: 1.2 };
/**
 * How long a flag's body (pole to where the point starts) must be for `text`, and the type size:
 * the text is measured in the font, and the body grows to fit it with FLAG.pad either side, up to
 * maxLen; a text too long even for that gets smaller type instead of running off the flag.
 */
function flagFit(text: string, maxLen: number) {
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = `700 100px ${TERM_FONT}`;
  const em = m.measureText(text).width / 100;       // the text's width per unit of type size
  const len = clamp(FLAG.pole + 2 * FLAG.pad + em * FLAG.font, FLAG.min, Math.max(FLAG.min, maxLen));
  return { len, font: Math.min(FLAG.font, (len - FLAG.pole - 2 * FLAG.pad) / em) };
}

/** A tag on the timeline: a pole and a gold flag with `text` on it, pointing right (dir 1) or left;
 *  the flag is as long as its text needs (see flagFit). light(t, k) sets its glow, 0 unlit .. 1 lit. */
function flagTag(text: string, dir: 1 | -1, maxLen = 2.6) {
  const { len, font } = flagFit(text, maxLen);
  const tube = ownGlow(PAL.gold, 0.7), core = ownGlow(PAL.gold, 0.7);
  const g = new THREE.Group();
  const h = halo(0.7 * (len + FLAG.tip), PAL.gold, 0);
  h.position.set((len / 2) * dir, 0.95, -0.05);
  g.add(h);
  g.add(tubeRun([[0, 0.05], [0, 1.25]], tube, 0.06));
  const flag = ([[0, 0.72], [len, 0.72], [len + FLAG.tip, 0.97], [len, 1.22], [0, 1.22]] as [number, number][]).map(([x, y]): [number, number] => [x * dir, y]);
  // layers 0.006 apart: the dark flag, its tube, the tube's bright core (the type sits inside the tube)
  g.add(shapeMesh(polyShape(flag), '#1d1230', 0.002));
  g.add(tubeRun(flag, tube, 0.07, true, 0.008));
  g.add(tubeRun(flag, core, 0.024, true, 0.014));
  // the text box runs from the pole to where the point starts; the text sits centred in it
  const tw = len - FLAG.pole;
  const txt = staticPlane(tw, 0.42, 200, (c, W, H) => {
    const px = font * (W / tw);
    c.font = `700 ${px}px ${TERM_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff'; c.fillText(text, W / 2, H * 0.54);
  });
  cutout(txt, 0.4);
  txt.position.set((FLAG.pole + tw / 2) * dir, 0.97, 0.008);
  g.add(txt);
  const type = txt.material as THREE.MeshBasicMaterial;
  // Bloom takes every pixel whose luminance passes 1.0, at full strength, and spreads it wide: a
  // whole lit tube over that line fills the little flag with haze, and white type over it smears.
  // So lit, only the tube's thin core passes it (gold does at about 1.66; the shimmer never dips it
  // under), the tube and the type stay under it, and the tag glows with its text still clear.
  const light = (t: number, k: number) => {
    setGlow(tube, PAL.gold, lerp(0.7, 1.45, k));
    setGlow(core, PAL.gold, lerp(0.7, 2.1, k) * (1 + 0.04 * Math.sin(t * 9) * k));
    type.color.setScalar(lerp(0.75, 0.96, k));
    (h.material as THREE.MeshBasicMaterial).opacity = 0.32 * k;
  };
  return { g, light };
}

/** A neon timeline for the back wall, origin at the middle of the line, time running to the right. */
export class Timeline {
  readonly root = new THREE.Group();
  /** Everything that slides (the root stays put; this moves along x). */
  readonly track = new THREE.Group();
  static readonly LEN = 30;
  static readonly STEP = 1.5;
  /** Local x of the gold commit tag, and of the red X that lands just after it (far enough along
   *  that the deploy flag's point stays about 0.1 clear of the X's arm). */
  static readonly TAG_X = 1.5;
  static readonly X_X = 4.15;
  readonly markerX: number[] = [];
  private lineMat = ownGlow(PAL.cyan, 2.2);
  private markers: { g: THREE.Group; mat: THREE.MeshBasicMaterial; color: string }[] = [];
  private tag = new THREE.Group();
  private tagLight: (t: number, k: number) => void;
  private cross = new THREE.Group();
  private crossMat = ownGlow(PAL.red, 2.6);
  private crossHalo: THREE.Mesh;
  readonly burst = new Burst(PAL.red, 12);
  /** More gold tags (chorus 2's "path refactor"), each with its own glow; set's `extra` drives them. */
  private extras: { g: THREE.Group; light: (t: number, k: number) => void }[] = [];

  /** extra: more gold tags along the line (local x, the flag's text, which way the flag points). */
  constructor(extra: { x: number; text: string; dir?: 1 | -1 }[] = []) {
    const L = Timeline.LEN, S = Timeline.STEP;
    this.root.add(this.track);
    // the line, with an arrowhead at the right
    this.track.add(tubeRun([[-L / 2, 0], [L / 2, 0]], this.lineMat, 0.1));
    this.track.add(tubeRun([[L / 2 - 0.45, 0.32], [L / 2 + 0.05, 0], [L / 2 - 0.45, -0.32]], this.lineMat, 0.1));
    // ticks with times under them
    const ticks: number[] = [];
    for (let x = -L / 2 + S; x < L / 2 - 0.5; x += S) ticks.push(x);
    for (const x of ticks) this.track.add(tubeRun([[x, -0.16], [x, 0.16]], this.lineMat, 0.06));
    const labels = staticPlane(L, 0.42, 90, (g, W, H) => {
      const u = W / L;
      g.font = `400 ${H * 0.85}px ${CRT_FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#bff6ff';
      ticks.forEach((x, i) => {
        const m = 2 + i * 0.75, mm = Math.floor(m), ss = Math.round((m - mm) * 60);
        g.fillText(`02:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, (x + L / 2) * u, H * 0.55);
      });
    });
    cutout(labels, 0.4);
    (labels.material as THREE.MeshBasicMaterial).color.setScalar(1.15);
    labels.position.set(0, -0.42, 0.01);
    this.track.add(labels);
    // event markers: little diamonds on stems, halfway between ticks. Nothing between the commit
    // tag and the X (one change, then the failure); everything after the X is red fallout.
    for (const x of ticks) {
      const mx = x + S / 2;
      if (mx > L / 2 - 1 || (mx > Timeline.TAG_X - 0.1 && mx < Timeline.X_X + 0.1)) continue;
      if (extra.some(e => Math.abs(mx - e.x) < 0.1)) continue;
      const color = mx > Timeline.X_X ? PAL.red : hash(mx * 7, 3) < 0.25 ? PAL.amber : PAL.green;
      const mat = ownGlow(color, 2);
      const g = new THREE.Group();
      g.add(tubeRun([[0, 0.04], [0, 0.34]], mat, 0.05));
      const d = shapeMesh(roundedRectShape(0.24, 0.24, 0.04), mat, 0.004);
      d.rotation.z = Math.PI / 4;
      d.position.y = 0.48;
      g.add(d);
      g.position.set(mx, 0, 0.02);
      this.track.add(g);
      this.markers.push({ g, mat, color });
      this.markerX.push(mx);
    }
    // the commit tag: a pole and a gold flag with the deploy on it, its point short of the X
    const deploy = flagTag('deploy #4127', 1, Timeline.X_X - Timeline.TAG_X - 0.87);
    this.tag.add(deploy.g);
    this.tagLight = deploy.light;
    this.tag.position.set(Timeline.TAG_X, 0, 0.03);
    this.track.add(this.tag);
    for (const e of extra) {
      const ft = flagTag(e.text, e.dir ?? 1);
      ft.g.position.set(e.x, 0, 0.03);
      ft.g.visible = false;
      this.track.add(ft.g);
      this.extras.push(ft);
    }
    // the red X: two crossed bars with an ink backing
    this.crossHalo = halo(1.1, PAL.red, 0);
    this.crossHalo.position.z = -0.03;
    this.cross.add(this.crossHalo);
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const ink = shapeMesh(roundedRectShape(0.3, 1.1, 0.1), INK, 0);
      ink.rotation.z = a;
      const bar = shapeMesh(roundedRectShape(0.17, 0.95, 0.08), this.crossMat, 0.004);
      bar.rotation.z = a;
      this.cross.add(ink, bar);
    }
    this.cross.position.set(Timeline.X_X, 0.55, 0.05);
    this.track.add(this.cross);
    this.burst.root.position.set(Timeline.X_X, 0.55, 0.08);
    this.track.add(this.burst.root);
  }

  /**
   * slide: the track's x offset. pop(j): how far marker j has popped up (0..1+, eased by the shot).
   * tag: the commit tag's glow 0..1. cross: seconds since the X landed (negative = not yet).
   * extra: the extra tags' size and glow (see the constructor).
   */
  set(t: number, o: { slide: number; pop: (j: number) => number; tag: number; cross: number; lit?: number; extra?: { size: number; glow: number }[] }) {
    const lit = o.lit ?? 1;
    // the extra tags: size 0 hides one (it overshoots as it pops); glow as the commit tag's
    this.extras.forEach((e, i) => {
      const k = o.extra?.[i]?.size ?? 0, g = clamp(o.extra?.[i]?.glow ?? 0);
      e.g.visible = k > 0.01;
      e.g.scale.set(Math.max(0.01, k), Math.max(0.01, k), 1);
      e.light(t, g);
    });
    this.track.position.x = o.slide;
    setGlow(this.lineMat, PAL.cyan, 2.2 * lit * (0.93 + 0.07 * Math.sin(t * 5)));
    this.markers.forEach((m, j) => {
      const k = o.pop(j);
      m.g.visible = k > 0.01;
      m.g.scale.setScalar(Math.max(0.01, easeOutBack(clamp(k), 3)));
      setGlow(m.mat, m.color, (1.8 + 1.4 * Math.exp(-k * 3)) * lit);
    });
    const tg = clamp(o.tag);
    this.tagLight(t, tg);
    // it swells a little as it lights; the kick past 1 (o.tag up to 1.3) is a quick pop on top. Kept
    // small: the flag's point sits close to the X.
    const swell = 1 + 0.03 * tg + 0.12 * clamp(o.tag - 1);
    this.tag.scale.set(swell, swell, 1);
    const c = o.cross;
    this.cross.visible = c >= 0;
    if (c >= 0) {
      const k = clamp(c / 0.12);
      this.cross.scale.setScalar(c < 0.12 ? lerp(3, 1, easeOutCubic(k)) : 1 + 0.08 * Math.sin((c - 0.12) * 40) * Math.exp(-(c - 0.12) * 8));
      this.cross.rotation.z = lerp(0.5, 0, easeOutCubic(k));
      setGlow(this.crossMat, PAL.red, 2.6 * (1 + 0.1 * Math.sin(t * 8)));
      (this.crossHalo.material as THREE.MeshBasicMaterial).opacity = 0.5 * clamp(c / 0.1);
    }
    this.burst.set(c, 1.8);
  }
}

// ---------------------------------------------------------------------------------------------
/** A big neon arrow sign, Vegas style: a pink tube outline round dark glass, with chaser bulbs
 *  running up the shaft toward the tip. It hangs from the truss by one cable to a hub at its middle
 *  and turns about the hub (set's angle, radians; 0 points along +x, -PI/2 straight down). */
export class NeonArrow {
  readonly root = new THREE.Group();
  readonly pivot = new THREE.Group();
  private tubeMat: THREE.MeshBasicMaterial;
  private bulbs: THREE.MeshBasicMaterial[] = [];
  private glow: THREE.Mesh;
  static readonly LEN = 4.4;
  /** Distance from the hub to the tip. */
  static readonly TIP = NeonArrow.LEN / 2;

  constructor(readonly color: string = PAL.pink) {
    this.tubeMat = ownGlow(color, 2.4);
    const L = NeonArrow.LEN, hs = 0.34, hh = 0.95, headL = 1.3;
    const x0 = -L / 2, x1 = L / 2 - headL, tip = L / 2;
    const outline: [number, number][] = [[x0, -hs], [x1, -hs], [x1, -hh], [tip, 0], [x1, hh], [x1, hs], [x0, hs]];
    const grow: [number, number][] = [[x0 - 0.1, -hs - 0.1], [x1 - 0.06, -hs - 0.1], [x1 - 0.06, -hh - 0.17], [tip + 0.2, 0], [x1 - 0.06, hh + 0.17], [x1 - 0.06, hs + 0.1], [x0 - 0.1, hs + 0.1]];
    this.root.add(shapeMesh(roundedRectShape(0.03, 7, 0.01, 0, 3.5), '#5b5674', -0.02));
    this.root.add(this.pivot);
    this.glow = halo(2.6, color, 0.0);
    this.glow.scale.set(1.5, 0.8, 1);
    this.glow.position.z = -0.06;
    this.pivot.add(this.glow);
    this.pivot.add(shapeMesh(polyShape(grow), INK, 0));
    this.pivot.add(shapeMesh(polyShape(outline), '#1a0f2e', 0.002));
    this.pivot.add(tubeRun(outline, this.tubeMat, 0.11, true, 0.004));
    // chaser bulbs along the shaft, then two in the head
    const xs: number[] = [];
    for (let i = 0; i < 7; i++) xs.push(lerp(x0 + 0.32, x1 - 0.2, i / 6));
    xs.push(x1 + 0.3, x1 + 0.75);
    xs.forEach(x => {
      const mat = ownGlow(PAL.gold, 0.5);
      this.bulbs.push(mat);
      const b = shapeMesh(circleShape(0.09), mat, 0.006, 12);
      b.position.x = x;
      this.pivot.add(b);
    });
    const hub = shapeMesh(circleShape(0.13), '#8d86a8', 0.01, 16);
    this.root.add(hub);
  }

  /** lit: 0 off .. 1 on (it flickers on in between); chase: the chaser position, in bulbs. */
  set(t: number, lit: number, chase: number, angle: number) {
    this.pivot.rotation.z = angle;
    const on = lit >= 1 ? 1 : lit > 0 ? (hash(Math.floor(t * 24), 31) < lit ? 1 : 0.15) : 0;
    setGlow(this.tubeMat, this.color, 0.35 + 2.3 * on * (0.95 + 0.05 * Math.sin(t * 7)));
    (this.glow.material as THREE.MeshBasicMaterial).opacity = 0.32 * on;
    const head = Math.floor(chase);
    this.bulbs.forEach((m, k) => setGlow(m, PAL.gold, on * ((((k - head) % 3) + 3) % 3 === 0 ? 2.8 : 0.6)));
  }
}

// ---------------------------------------------------------------------------------------------
/** The smoking gun: a chunky cartoon revolver, side on. Origin at the grip, barrel along +x. */
export class Revolver {
  readonly root = new THREE.Group();
  /** Where the smoke comes out (in the root's frame). */
  readonly muzzle = new THREE.Object3D();

  constructor() {
    const steel = '#9a9db2', dark = '#5d6075', wood = '#8a4a2a';
    const grip = inkedRect(0.17, 0.38, 0.07, wood, 0.03);
    grip.position.set(-0.05, -0.14, 0);
    grip.rotation.z = -0.38;
    for (const y of [0.08, -0.08]) {
      const sc = shapeMesh(circleShape(0.022), '#e8c45c', 0.006, 8);
      sc.position.set(0, y, 0.006);
      grip.add(sc);
    }
    const guard = shapeMesh(arcShape(0.085, 0.028, Math.PI * 1.05, Math.PI * 1.95), INK, 0.001, 10);
    guard.position.set(0.12, -0.02, 0.001);
    const trigger = shapeMesh(roundedRectShape(0.03, 0.09, 0.012, 0.1, -0.05), INK, 0.001);
    const frame = inkedRect(0.36, 0.16, 0.04, steel, 0.03);
    frame.position.set(0.1, 0.05, 0.004);
    const hammer = new THREE.Shape();
    hammer.moveTo(-0.1, 0.1); hammer.lineTo(-0.02, 0.1); hammer.lineTo(-0.05, 0.2); hammer.lineTo(-0.13, 0.19); hammer.closePath();
    const hammerInk = new THREE.Shape();
    hammerInk.moveTo(-0.12, 0.08); hammerInk.lineTo(0.0, 0.08); hammerInk.lineTo(-0.04, 0.23); hammerInk.lineTo(-0.16, 0.21); hammerInk.closePath();
    const cyl = inkedRect(0.24, 0.21, 0.05, dark, 0.03);
    cyl.position.set(0.14, 0.06, 0.008);
    for (const y of [0.0, 0.07]) cyl.add(shapeMesh(roundedRectShape(0.18, 0.018, 0.009, 0, y - 0.03), '#46485a', 0.006));
    const barrel = inkedRect(0.5, 0.1, 0.03, steel, 0.03);
    barrel.position.set(0.5, 0.09, 0.006);
    barrel.add(shapeMesh(roundedRectShape(0.42, 0.022, 0.011, -0.02, 0.022), '#e2e5f2', 0.006));
    const sight = inkedRect(0.04, 0.05, 0.01, steel, 0.02);
    sight.position.set(0.71, 0.155, 0.005);
    this.root.add(shapeMesh(hammerInk, INK, 0), shapeMesh(hammer, dark, 0.002), grip, guard, trigger, frame, cyl, sight, barrel);
    this.muzzle.position.set(0.78, 0.09, 0.01);
    this.root.add(this.muzzle);
  }
}

// ---------------------------------------------------------------------------------------------
/** A curl of cartoon smoke: soft puffs that rise, sway, swell and fade, a new one every 1/rate s. */
export class Smoke {
  readonly root = new THREE.Group();
  private puffs: { g: THREE.Group; fill: THREE.MeshBasicMaterial; ink: THREE.MeshBasicMaterial }[] = [];

  constructor(readonly n = 18) {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const ink = ownMat(INK, 1, true), fill = ownMat('#e6e0f2', 1, true);
      g.add(shapeMesh(circleShape(1.16), ink, 0, 16), shapeMesh(circleShape(1), fill, 0.001, 16));
      this.root.add(g);
      this.puffs.push({ g, fill, ink });
    }
  }

  /** from: the muzzle in world space; t0: when it started smoking; amount: 0..1 (more = thicker). */
  set(t: number, from: THREE.Vector3, t0: number, amount: number, cam?: THREE.Camera, rate = 7, life = 1.6) {
    const n0 = Math.floor((t - t0) * rate);
    this.puffs.forEach((p, k) => {
      const idx = n0 - k;
      const age = t - (t0 + idx / rate);
      const on = idx >= 0 && age >= 0 && age < life && amount > 0.01;
      p.g.visible = on;
      if (!on) return;
      const u = age / life;
      const sway = Math.sin(age * 3.4 + idx * 0.7) * 0.09 * (0.25 + age);
      p.g.position.set(from.x + sway + age * 0.05, from.y + age * 0.48 + age * age * 0.14, from.z + 0.003 * k);
      p.g.scale.setScalar((0.03 + age * 0.085) * (0.8 + 0.4 * hash(idx, 5)) * (0.6 + 0.4 * amount));
      const a = amount * Math.pow(1 - u, 1.25);
      p.fill.opacity = a * 0.92;
      p.ink.opacity = a * 0.55;
      if (cam) p.g.quaternion.copy(cam.quaternion);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// 2D overlay pieces

export interface SpotScreen {
  cx: number; cy: number; rx: number; ry: number;   // the lit hole (the subject and its pool)
  sx: number; sy: number;                           // the lamp
  px: number; py: number; prx: number; pry: number; // the pool on the floor
}

const v3 = new THREE.Vector3();
function toScreen(p: THREE.Vector3, cam: THREE.Camera, W: number, H: number) {
  v3.copy(p).project(cam);
  return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
}

/** Where a spotlight on a figure standing at `at` (height `tall`, pool radius r) lands on screen. */
export function spotScreen(cam: THREE.Camera, W: number, H: number, at: THREE.Vector3, r: number, tall: number, lamp: THREE.Vector3): SpotScreen {
  const p = toScreen(at, cam, W, H);
  const ex = toScreen(v3.set(at.x + r, at.y, at.z).clone(), cam, W, H);
  const ez = toScreen(v3.set(at.x, at.y, at.z + r).clone(), cam, W, H);
  const top = toScreen(v3.set(at.x, at.y + tall, at.z).clone(), cam, W, H);
  const s = toScreen(lamp.clone(), cam, W, H);
  const prx = Math.max(4, Math.hypot(ex.x - p.x, ex.y - p.y)), pry = Math.max(3, Math.hypot(ez.x - p.x, ez.y - p.y));
  const ry = (p.y - top.y) / 2 + pry * 1.1;
  return { cx: p.x, cy: (p.y + top.y) / 2 + pry * 0.2, rx: Math.max(prx * 1.15, ry * 0.62), ry, sx: s.x, sy: s.y, px: p.x, py: p.y, prx, pry };
}

/**
 * Everything dark but one spotlight: a veil with a soft hole round the subject, a cone of light
 * from the lamp to the pool, and the pool. dark: the veil's opacity; beam: the light's strength.
 */
export function drawSpotlight(g: CanvasRenderingContext2D, W: number, H: number, s: SpotScreen, dark = 0.94, beam = 1) {
  g.save();
  g.translate(s.cx, s.cy);
  g.scale(1, s.ry / s.rx);
  const veil = g.createRadialGradient(0, 0, 0, 0, 0, s.rx * 1.25);
  veil.addColorStop(0, 'rgba(4,2,12,0)');
  veil.addColorStop(0.78, 'rgba(4,2,12,0)');
  veil.addColorStop(1, `rgba(4,2,12,${dark})`);
  g.fillStyle = veil;
  const big = (W + H) * 4 * Math.max(1, s.rx / s.ry);
  g.fillRect(-big, -big, big * 2, big * 2);
  g.restore();
  if (beam <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const cone = g.createLinearGradient(s.sx, s.sy, s.px, s.py);
  cone.addColorStop(0, `rgba(255,236,210,${0.04 * beam})`);
  cone.addColorStop(1, `rgba(255,236,210,${0.12 * beam})`);
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(s.sx - s.prx * 0.12, s.sy); g.lineTo(s.sx + s.prx * 0.12, s.sy);
  g.lineTo(s.px + s.prx, s.py); g.lineTo(s.px - s.prx, s.py);
  g.closePath(); g.fill();
  g.translate(s.px, s.py);
  g.scale(1, s.pry / s.prx);
  const pool = g.createRadialGradient(0, 0, 0, 0, 0, s.prx);
  pool.addColorStop(0, `rgba(255,240,215,${0.2 * beam})`);
  pool.addColorStop(1, 'rgba(255,240,215,0)');
  g.fillStyle = pool;
  g.beginPath(); g.arc(0, 0, s.prx, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** A freeze frame: the picture drains of colour (k 0..1). Draw it before anything that stays in colour. */
export function drawFreeze(g: CanvasRenderingContext2D, W: number, H: number, k: number) {
  if (k <= 0) return;
  g.save();
  g.globalCompositeOperation = 'saturation';
  g.globalAlpha = clamp(k) * 0.88;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = clamp(k) * 0.35;
  g.fillStyle = '#9a90c8';
  g.fillRect(0, 0, W, H);
  g.restore();
}

const stamps = new Map<string, HTMLCanvasElement>();
/** A rubber stamp, built once per text/size/colour: a double border, the word, and worn-out specks. */
function stampCanvas(text: string, px: number, color: string) {
  const key = `${text}|${px}|${color}`;
  const hit = stamps.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const font = `400 ${px}px ${DISCO_FONT}`;
  let g = c.getContext('2d')!;
  g.font = font;
  const tw = g.measureText(text).width;
  const bw = px * 0.075, pad = px * 0.3;
  c.width = Math.ceil(tw + pad * 2 + bw * 6);
  c.height = Math.ceil(px * 1.25 + bw * 6);
  g = c.getContext('2d')!;
  g.strokeStyle = g.fillStyle = color;
  g.lineWidth = bw;
  g.beginPath(); g.roundRect(bw, bw, c.width - bw * 2, c.height - bw * 2, px * 0.16); g.stroke();
  g.lineWidth = bw * 0.45;
  g.beginPath(); g.roundRect(bw * 2.6, bw * 2.6, c.width - bw * 5.2, c.height - bw * 5.2, px * 0.1); g.stroke();
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + px * 0.08);
  // worn rubber: knock out specks and a couple of scuffs
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 340; i++) {
    const r = (0.4 + hash(i, 3) * hash(i, 4) * 3.2) * px / 110;
    g.beginPath(); g.arc(hash(i, 1) * c.width, hash(i, 2) * c.height, r, 0, Math.PI * 2); g.fill();
  }
  g.lineWidth = px * 0.025;
  for (let i = 0; i < 4; i++) {
    const x = hash(i, 5) * c.width, y = hash(i, 6) * c.height;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i, 7) - 0.3) * px * 1.4, y + (hash(i, 8) - 0.5) * px * 0.3); g.stroke();
  }
  stamps.set(key, c);
  return c;
}

/** Slam a rubber stamp onto the frame at time `at`, centred at (x, y) in frame fractions. */
export function drawStamp(g: CanvasRenderingContext2D, f: Frame, at: number, text: string, o: { x: number; y: number; rot?: number; size?: number; color?: string; out?: number }) {
  const dt = f.t - at;
  if (dt < 0) return;
  const fade = o.out !== undefined ? clamp(1 - (f.t - o.out) / 0.2) : 1;
  if (fade <= 0) return;
  const s = f.h / 1080;
  const c = stampCanvas(text, Math.round((o.size ?? 150) * s), o.color ?? '#e0142c');
  const T = 0.12;
  const k = clamp(dt / T);
  const scale = dt < T ? lerp(2.5, 1, easeOutCubic(k)) : 1 + 0.06 * Math.exp(-(dt - T) / 0.07) * Math.cos((dt - T) * 55);
  g.save();
  g.translate(o.x * f.w, o.y * f.h);
  g.rotate(o.rot ?? -0.14);
  g.scale(scale, scale);
  g.globalAlpha = clamp(k * 1.8) * fade;
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 16 * s;
  g.drawImage(c, -c.width / 2, -c.height / 2);
  g.restore();
}

