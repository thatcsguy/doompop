// Clawd, the Claude mascot, as a toy-like rigged mesh. Build once, then pose every frame
// with setMood() and setPose(): both set every property they touch, so frames stay pure.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { noise1 } from '../rng';
import { clamp, lerp } from '../ease';

export const CLAWD_ORANGE = '#d97757';
const GREY = new THREE.Color('#8a8580');

/** Emotion controls, all 0..1 unless noted. Mix freely; presets below. */
export interface Mood {
  happy: number;   // eyes become ^ ^ arcs
  open: number;    // eye height (0 = shut, 1 = normal, >1 = wide)
  droop: number;   // sad eyes: tilted outer corners, body sags
  blush: number;   // pink cheeks
  sweat: number;   // sweat drops
  jitter: number;  // nervous shake
  grey: number;    // colour drains toward grey
  squint: number;  // narrowed, focused eyes
  brow: number;    // -1 = angry/determined, 0 = none, +1 = worried (inner ends up)
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
  bounce: number;  // 0..1 hop height this frame (drive from the beat)
  squash: number;  // -1..1, negative = stretch
  lean: number;    // radians, forward/back
  turn: number;    // radians, facing
  armL: number;    // radians, arm raise
  armR: number;
  walk: number;    // walk cycle phase in cycles (0 = stand still)
}
export const REST: Pose = { bounce: 0, squash: 0, lean: 0, turn: 0, armL: 0, armR: 0, walk: 0 };

export class Clawd {
  readonly root = new THREE.Group();
  private body: THREE.Group;
  private torso: THREE.Mesh;
  private bodyMat: THREE.MeshStandardMaterial;
  private eyes: { box: THREE.Mesh; arc: THREE.Mesh; group: THREE.Group }[] = [];
  private brows: THREE.Mesh[] = [];
  private cheeks: THREE.Mesh[] = [];
  private sweat: THREE.Mesh[] = [];
  private arms: THREE.Group[] = [];
  private legs: THREE.Mesh[] = [];
  private base = new THREE.Color(CLAWD_ORANGE);

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: CLAWD_ORANGE, roughness: 0.65, metalness: 0 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a1d17', roughness: 0.4 });
    const cheekMat = new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0 });
    const sweatMat = new THREE.MeshStandardMaterial({ color: '#9fdcff', roughness: 0.1, transparent: true, opacity: 0.9 });

    this.body = new THREE.Group();
    this.root.add(this.body);
    // proportions: wide, short body; the whole character is ~1 unit tall
    this.torso = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.8, 0.8, 4, 0.14), this.bodyMat);
    this.torso.position.y = 0.6;
    this.torso.castShadow = true;
    this.body.add(this.torso);

    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 0.27, 0.7, 0.41);
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.2, 0.04, 2, 0.02), eyeMat);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 16, Math.PI), eyeMat);
      arc.position.y = -0.03;
      g.add(box, arc);
      this.body.add(g);
      this.eyes.push({ box, arc, group: g });
      const brow = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.035, 0.03, 2, 0.012), eyeMat);
      brow.position.set(side * 0.27, 0.86, 0.41);
      this.body.add(brow);
      this.brows.push(brow);

      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), cheekMat.clone());
      cheek.position.set(side * 0.44, 0.55, 0.405);
      this.body.add(cheek);
      this.cheeks.push(cheek);

      const arm = new THREE.Group();
      arm.position.set(side * 0.65, 0.62, 0);
      const armMesh = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.2, 0.3, 2, 0.06), this.bodyMat);
      armMesh.position.x = side * 0.08;
      armMesh.castShadow = true;
      arm.add(armMesh);
      this.body.add(arm);
      this.arms.push(arm);
    }
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.26, 0.16, 2, 0.04), this.bodyMat);
      leg.castShadow = true;
      this.root.add(leg);
      this.legs.push(leg);
    }
    for (let i = 0; i < 2; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), sweatMat);
      d.scale.set(1, 1.5, 1);
      this.body.add(d);
      this.sweat.push(d);
    }
  }

  /** t is song time, used only for continuous wiggles (jitter, sweat drip, blink). */
  setMood(m: Mood, t: number) {
    this.bodyMat.color.copy(this.base).lerp(GREY, m.grey);
    const blink = noise1(t * 0.7, 9) > 0.92 ? 0.1 : 1; // occasional blink, deterministic
    this.eyes.forEach(({ box, arc, group }, i) => {
      const side = i === 0 ? -1 : 1;
      const h = Math.max(0.05, m.open * (1 - m.squint * 0.55) * blink);
      box.visible = m.happy < 0.5;
      arc.visible = m.happy >= 0.5;
      box.scale.set(1 + Math.max(0, m.open - 1) * 0.5 + m.squint * 0.3, h, 1);
      group.rotation.z = side * m.droop * 0.15 - side * m.squint * 0.12;
      group.position.y = 0.7 - m.droop * 0.03;
    });
    this.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.visible = Math.abs(m.brow) > 0.05 && m.happy < 0.5;
      b.rotation.z = -side * m.brow * 0.45; // worried: inner ends up; angry: inner ends down
      b.position.y = 0.86 + Math.max(0, m.open - 1) * 0.08 - m.squint * 0.04;
    });
    this.cheeks.forEach(c => ((c.material as THREE.MeshBasicMaterial).opacity = 0.75 * m.blush));
    this.sweat.forEach((d, i) => {
      const cyc = (t * 0.6 + i * 0.5) % 1;
      d.visible = m.sweat > 0.05;
      d.position.set((i ? 0.7 : -0.7), 0.98 - cyc * 0.4, 0.25);
      d.scale.setScalar(m.sweat * (1 - cyc * 0.5));
      d.scale.y *= 1.5;
    });
    this.body.position.x = m.jitter * 0.025 * noise1(t * 40, 1);
    this.body.position.z = m.jitter * 0.02 * noise1(t * 37, 2);
    this.body.rotation.z = m.jitter * 0.03 * noise1(t * 31, 3);
    this.body.userData.sag = m.droop;
  }

  setPose(p: Pose) {
    const sag = (this.body.userData.sag as number) ?? 0;
    const sq = p.squash + sag * 0.12;
    this.body.scale.set(1 + sq * 0.15, 1 - sq * 0.2, 1 + sq * 0.15);
    this.body.position.y = p.bounce * 0.35 - sag * 0.05;
    this.body.rotation.x = p.lean;
    this.root.rotation.y = p.turn;
    this.arms[0].rotation.z = -p.armL;
    this.arms[1].rotation.z = p.armR;
    const lx = [-0.42, 0.42, -0.42, 0.42], lz = [0.22, 0.22, -0.22, -0.22];
    this.legs.forEach((leg, i) => {
      const phase = p.walk * Math.PI * 2 + (i === 0 || i === 3 ? 0 : Math.PI);
      const lift = p.walk ? Math.max(0, Math.sin(phase)) * 0.08 : 0;
      leg.position.set(lx[i], 0.13 + lift + p.bounce * 0.2, lz[i] + (p.walk ? Math.cos(phase) * 0.06 : 0));
    });
  }
}
