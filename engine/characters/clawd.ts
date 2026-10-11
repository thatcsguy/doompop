// Clawd, the Claude mascot, as a flat 2D cartoon cut-out (ink outlines, cel shading) that lives
// in a three.js world. Build once, then call setMood() then setPose() every frame, in that order:
// together they set every property they touch, so frames stay pure functions of t.
// Origin is between his feet; he is ~1.1 units tall.
import * as THREE from 'three';
import { noise1 } from '../rng';
import { clamp, lerp } from '../ease';
import { INK, dropShape, inkedRect, ownMat, roundedRectShape, shapeMesh } from '../flat';

export const CLAWD_ORANGE = '#d97757';
const SHADE = '#b85c3f', GREY = '#8d8781', GREY_SHADE = '#6f6964';

/** Emotion controls, all 0..1 unless noted. Mix freely; presets below. */
export interface Mood {
  happy: number;   // eyes become ^ ^ arcs
  open: number;    // eye height (0 = shut, 1 = normal, >1 = wide)
  droop: number;   // sad: eyes and body sag, tears near 1
  blush: number;   // pink cheeks
  sweat: number;   // sweat drops
  jitter: number;  // nervous shake
  grey: number;    // colour drains toward grey
  squint: number;  // narrowed, focused eyes
  brow: number;    // -1 = determined (inner ends down), 0 = none, +1 = worried (inner ends up)
}

export const MOODS: Record<string, Mood> = {
  excited:  { happy: 1, open: 1, droop: 0, blush: 0.3, sweat: 0, jitter: 0, grey: 0, squint: 0, brow: 0 },
  proud:    { happy: 0.7, open: 1, droop: 0, blush: 1, sweat: 0, jitter: 0, grey: 0, squint: 0, brow: 0 },
  focused:  { happy: 0, open: 1, droop: 0, blush: 0, sweat: 0, jitter: 0, grey: 0, squint: 0.6, brow: -0.6 },
  tired:    { happy: 0, open: 0.35, droop: 0.3, blush: 0, sweat: 0, jitter: 0, grey: 0, squint: 0, brow: 0.2 },
  stressed: { happy: 0, open: 0.9, droop: 0, blush: 0, sweat: 1, jitter: 0.5, grey: 0.1, squint: 0.3, brow: 0.8 },
  panicked: { happy: 0, open: 1.6, droop: 0, blush: 0, sweat: 1, jitter: 1, grey: 0.35, squint: 0, brow: 1 },
  sad:      { happy: 0, open: 0.7, droop: 1, blush: 0, sweat: 0, jitter: 0, grey: 0.45, squint: 0, brow: 1 },
};

export function mixMood(a: Mood, b: Mood, k: number): Mood {
  const o = {} as Mood;
  for (const key of Object.keys(a) as (keyof Mood)[]) o[key] = lerp(a[key], b[key], clamp(k));
  return o;
}

export interface Pose {
  bounce: number;  // 0..1 hop height this frame (drive it from the beat)
  squash: number;  // -1..1, negative = stretch
  lean: number;    // radians, tilt sideways
  turn: number;    // radians; the cut-out flips like a paper puppet (0 = facing camera)
  armL: number;    // radians, arm raise
  armR: number;
  walk: number;    // walk cycle phase in cycles (0 = stand still)
}
export const REST: Pose = { bounce: 0, squash: 0, lean: 0, turn: 0, armL: 0, armR: 0, walk: 0 };

const W = 1.3, H = 0.8, R = 0.015, BODY_Y = 0.62; // blocky: near-square corners

export class Clawd {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private bodyFill: THREE.MeshBasicMaterial;
  private shadeFill: THREE.MeshBasicMaterial;
  private eyes: { box: THREE.Mesh; arc: THREE.Object3D; group: THREE.Group }[] = [];
  private brows: THREE.Mesh[] = [];
  private cheeks: THREE.Mesh[] = [];
  private sweat: THREE.Group[] = [];
  private tears: THREE.Mesh[] = [];
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private jitterTilt = 0;
  private sag = 0;

  constructor() {
    this.bodyFill = ownMat(CLAWD_ORANGE);
    this.shadeFill = ownMat(SHADE);
    this.root.add(this.body);

    // legs: four stubs, drawn behind the body
    for (const x of [-0.46, -0.17, 0.17, 0.46]) {
      const leg = inkedRect(0.15, 0.3, 0.01, this.shadeFill, 0.04);
      leg.position.set(x, 0.15, -0.01);
      this.root.add(leg);
      this.legs.push(leg);
    }
    // arms: side nubs on a pivot at the shoulder
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (W / 2 - 0.02), BODY_Y + 0.02, -0.005);
      const arm = inkedRect(0.24, 0.2, 0.01, this.bodyFill, 0.04);
      arm.position.x = side * 0.1;
      pivot.add(arm);
      this.body.add(pivot);
      this.arms.push(pivot);
    }
    // body, a cel-shade band along the bottom, and a soft highlight
    const torso = inkedRect(W, H, R, this.bodyFill, 0.05);
    torso.position.y = BODY_Y;
    this.body.add(torso);
    const shade = new THREE.Shape(); // square corners to match the body
    const sx = -W / 2, sy = BODY_Y - H / 2, sh = 0.2;
    shade.moveTo(sx, sy + sh); shade.lineTo(sx + W, sy + sh); shade.lineTo(sx + W, sy + R);
    shade.absarc(sx + W - R, sy + R, R, 0, -Math.PI / 2, true); shade.lineTo(sx + R, sy);
    shade.absarc(sx + R, sy + R, R, -Math.PI / 2, -Math.PI, true); shade.lineTo(sx, sy + sh);
    this.body.add(shapeMesh(shade, this.shadeFill, 0.006));
    this.body.add(shapeMesh(roundedRectShape(0.26, 0.06, 0.005, -0.36, BODY_Y + 0.28), ownMat('#ffffff', 0.3), 0.008));

    const eyeInk = ownMat(INK);
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 0.27, BODY_Y + 0.08, 0.012);
      const box = shapeMesh(roundedRectShape(0.12, 0.21, 0.005), eyeInk);
      const arc = new THREE.Group(); // happy eyes: a blocky ^ chevron of two bars
      for (const k of [-1, 1]) {
        const bar = shapeMesh(roundedRectShape(0.11, 0.045, 0.004), eyeInk);
        bar.position.set(k * 0.036, -0.005, 0);
        bar.rotation.z = -k * 0.75;
        arc.add(bar);
      }
      g.add(box, arc);
      this.body.add(g);
      this.eyes.push({ box, arc, group: g });

      const brow = shapeMesh(roundedRectShape(0.18, 0.045, 0.004), eyeInk, 0.012);
      this.body.add(brow);
      this.brows.push(brow);

      const cheek = shapeMesh(roundedRectShape(0.15, 0.09, 0.005), ownMat('#ff8fa3', 0, true), 0.01);
      cheek.position.set(side * 0.45, BODY_Y - 0.06, 0.01);
      this.body.add(cheek);
      this.cheeks.push(cheek);

      const drop = new THREE.Group();
      drop.add(shapeMesh(dropShape(0.065), INK, 0), shapeMesh(dropShape(0.045), '#9fdcff', 0.002));
      this.body.add(drop);
      this.sweat.push(drop);

      const tear = shapeMesh(dropShape(0.035), ownMat('#9fdcff', 0.9), 0.014);
      this.body.add(tear);
      this.tears.push(tear);
    }
  }

  /** t is song time, used only for continuous motion (jitter, drips, blinks). */
  setMood(m: Mood, t: number) {
    this.bodyFill.color.set(CLAWD_ORANGE).lerp(new THREE.Color(GREY), m.grey);
    this.shadeFill.color.set(SHADE).lerp(new THREE.Color(GREY_SHADE), m.grey);
    const blink = noise1(t * 0.7, 9) > 0.92 ? 0.12 : 1; // occasional deterministic blink
    this.eyes.forEach(({ box, arc, group }, i) => {
      const side = i === 0 ? -1 : 1;
      box.visible = m.happy < 0.5;
      arc.visible = m.happy >= 0.5;
      box.scale.set(1 + Math.max(0, m.open - 1) * 0.6 + m.squint * 0.35, Math.max(0.12, m.open * (1 - m.squint * 0.55) * blink), 1);
      group.rotation.z = side * m.droop * 0.12;
      group.position.y = BODY_Y + 0.08 - m.droop * 0.04;
    });
    this.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.visible = Math.abs(m.brow) > 0.05 && m.happy < 0.5;
      b.rotation.z = -side * m.brow * 0.42;
      b.position.set(side * 0.27, BODY_Y + 0.25 + Math.max(0, m.open - 1) * 0.07 - m.squint * 0.04, 0.014);
    });
    this.cheeks.forEach(c => {
      c.visible = m.blush > 0.01;
      (c.material as THREE.MeshBasicMaterial).opacity = 0.8 * m.blush;
    });
    this.sweat.forEach((d, i) => {
      const cyc = (t * 0.6 + i * 0.5) % 1;
      d.visible = m.sweat > 0.05;
      d.position.set(i ? 0.66 : -0.68, BODY_Y + 0.42 - cyc * 0.3, 0.02);
      d.scale.setScalar(m.sweat * (1 - cyc * 0.4));
    });
    this.tears.forEach((d, i) => {
      const cyc = (t * 0.45 + i * 0.37) % 1;
      d.visible = m.droop > 0.7;
      d.position.set((i ? 1 : -1) * 0.27, BODY_Y - 0.06 - cyc * 0.3, 0.014);
      d.scale.setScalar(Math.max(0.001, clamp((m.droop - 0.7) / 0.3) * (1 - cyc * 0.5)));
    });
    this.body.position.x = m.jitter * 0.03 * noise1(t * 40, 1);
    this.jitterTilt = m.jitter * 0.03 * noise1(t * 31, 3);
    this.sag = m.droop;
  }

  setPose(p: Pose) {
    const sq = p.squash + this.sag * 0.12;
    const flip = Math.cos(p.turn);
    this.root.scale.set((flip < 0 ? -1 : 1) * Math.max(0.08, Math.abs(flip)), 1, 1);
    this.body.scale.set(1 + sq * 0.15, 1 - sq * 0.2, 1);
    this.body.position.y = p.bounce * 0.35 - this.sag * 0.05;
    this.body.rotation.z = this.jitterTilt + p.lean;
    this.arms[0].rotation.z = -p.armL;
    this.arms[1].rotation.z = p.armR;
    this.legs.forEach((leg, i) => {
      const phase = p.walk * Math.PI * 2 + (i % 2 ? Math.PI : 0);
      const lift = p.walk ? Math.max(0, Math.sin(phase)) * 0.08 : 0;
      leg.position.y = 0.15 + lift + p.bounce * 0.2;
      leg.scale.y = 1 - sq * 0.15;
    });
  }
}
