// The club's people: capsule dancers in 70s outfits, front-facing flat cut-outs. When production
// is down they freeze mid-move, greyed out like a disabled button, with a loading spinner over
// their heads. When it's up they dance. Every pose is a pure function of the beat.
import * as THREE from 'three';
import { INK, arcShape, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh } from '../../engine/flat';
import { clamp, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { PAL, ownGlow, setGlow } from './look';

export const SKINS = ['#f3c9a8', '#e0a77f', '#b97a55', '#8c5537', '#5f3725', '#ffdcc0'];
export const HAIRS = ['#1d1210', '#3b2316', '#6b3d22', '#d9a441', '#b8412a', '#2a1b3d'];
export type HairStyle = 'afro' | 'long' | 'bob' | 'beehive' | 'feather' | 'bald' | 'pony';

export interface Outfit {
  skin: string;
  hair: string;
  style: HairStyle;
  top: string;       // shirt or dress
  pants: string;     // bell-bottoms (or the skirt colour when dress)
  dress: boolean;
  collar: string;    // big 70s collar
  shoes: string;
}

/** A dancer's limb angles. Arms and legs: 0 = hanging straight down, positive = out and up. */
export interface Body {
  aL: number; aR: number; lL: number; lR: number;
  lean: number;      // radians
  hip: number;       // sideways shift of the whole body
  bob: number;       // vertical offset (jumps)
  squash: number;    // -1..1
  turn: number;      // paper-puppet flip, radians
}
export const STAND: Body = { aL: 0.15, aR: 0.15, lL: 0.05, lR: 0.05, lean: 0, hip: 0, bob: 0, squash: 0, turn: 0 };

/** A deterministic outfit for dancer i. */
export function outfit(i: number): Outfit {
  const tops = ['#ff5fa8', '#f6f1e6', '#ffb02e', '#2fc6c9', '#9b5cff', '#e8463a', '#ffd23f', '#58d68d', '#ff8a3d'];
  const pants = ['#2b2f6e', '#f6f1e6', '#7a3b1e', '#1f6f73', '#3a1d5e', '#d4a017', '#5a2a82', '#e86fb0'];
  const styles: HairStyle[] = ['afro', 'long', 'bob', 'beehive', 'feather', 'afro', 'pony', 'bald', 'long'];
  return {
    skin: SKINS[Math.floor(hash(i, 1) * SKINS.length)],
    hair: HAIRS[Math.floor(hash(i, 2) * HAIRS.length)],
    style: styles[i % styles.length],
    top: tops[Math.floor(hash(i, 3) * tops.length)],
    pants: pants[Math.floor(hash(i, 4) * pants.length)],
    dress: hash(i, 5) < 0.3,
    collar: hash(i, 6) < 0.5 ? '#fff7ea' : '#ffe08a',
    shoes: hash(i, 7) < 0.5 ? '#1a1426' : '#d9c7ff',
  };
}

const GREY = new THREE.Color('#5b5878');

/** A scalloped circle (afros): rounded lobes with soft cusps between them. */
function scallop(r: number, cy: number, lobes = 11, bump = 0.06) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const rr = r - bump + bump * Math.pow(Math.abs(Math.sin((a * lobes) / 2)), 0.55);
    if (i === 0) s.moveTo(Math.cos(a) * rr, cy + Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  return s;
}
/** A lighter version of a hair colour, for a sheen. */
const mat2 = (m: THREE.MeshBasicMaterial) => ownMat(m.color.clone().offsetHSL(0, 0, 0.1));
const DIM = new THREE.Color('#2a2742');

export class Dancer {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  private mats: { m: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  private spinner = new THREE.Group();
  private spinDots: THREE.MeshBasicMaterial[] = [];
  private eyes: THREE.Group;
  private mouth: THREE.Mesh;
  private oMouth: THREE.Mesh;

  constructor(readonly o: Outfit, readonly scale = 1) {
    const mat = (c: string) => { const m = ownMat(c); this.mats.push({ m, base: new THREE.Color(c) }); return m; };
    const skin = mat(o.skin), top = mat(o.top), pants = mat(o.pants), hair = mat(o.hair), collar = mat(o.collar), shoes = mat(o.shoes);
    this.root.add(this.body);
    this.root.scale.setScalar(scale);

    // legs: bell-bottoms flaring out to platform shoes, pivoting at the hips
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.15, 1.0, -0.02);
      const flare = new THREE.Shape();
      flare.moveTo(-0.11, 0); flare.lineTo(0.11, 0); flare.lineTo(0.18, -0.84); flare.lineTo(-0.18, -0.84); flare.closePath();
      const flareInk = new THREE.Shape();
      flareInk.moveTo(-0.15, 0.03); flareInk.lineTo(0.15, 0.03); flareInk.lineTo(0.22, -0.87); flareInk.lineTo(-0.22, -0.87); flareInk.closePath();
      pivot.add(shapeMesh(flareInk, INK, 0), shapeMesh(flare, o.dress ? skin : pants, 0.002));
      const shoe = inkedRect(0.36, 0.15, 0.05, shoes, 0.035);
      shoe.position.set(side * 0.03, -0.92, 0.004);
      pivot.add(shoe);
      this.body.add(pivot);
      this.legs.push(pivot);
    }
    // torso (shirt, or a dress that flares over the hips)
    if (o.dress) {
      const dress = new THREE.Shape();
      dress.moveTo(-0.3, 1.78); dress.lineTo(0.3, 1.78); dress.lineTo(0.48, 0.62); dress.lineTo(-0.48, 0.62); dress.closePath();
      const dressInk = new THREE.Shape();
      dressInk.moveTo(-0.34, 1.82); dressInk.lineTo(0.34, 1.82); dressInk.lineTo(0.53, 0.58); dressInk.lineTo(-0.53, 0.58); dressInk.closePath();
      this.body.add(shapeMesh(dressInk, INK, 0), shapeMesh(dress, top, 0.003));
      // sequin sparkle rows
      for (let r = 0; r < 4; r++) {
        const row = shapeMesh(roundedRectShape(0.6 + r * 0.1, 0.035, 0.01, 0, 0.8 + r * 0.25), mat(new THREE.Color(o.top).offsetHSL(0, 0, 0.12).getStyle()), 0.004);
        this.body.add(row);
      }
    } else {
      const torso = inkedRect(0.66, 0.84, 0.18, top, 0.04);
      torso.position.set(0, 1.38, 0);
      this.body.add(torso);
      const belt = shapeMesh(roundedRectShape(0.66, 0.08, 0.02, 0, 1.0), mat('#2a1a12'), 0.004);
      const buckle = shapeMesh(roundedRectShape(0.12, 0.09, 0.02, 0, 1.0), mat('#f2c14e'), 0.005);
      this.body.add(belt, buckle);
    }
    // the big 70s collar
    for (const side of [-1, 1]) {
      const c = new THREE.Shape();
      c.moveTo(0, 1.76); c.lineTo(side * 0.28, 1.8); c.lineTo(side * 0.2, 1.5); c.closePath();
      this.body.add(shapeMesh(c, collar, 0.006));
    }
    // neck and head
    const neck = shapeMesh(roundedRectShape(0.16, 0.14, 0.03, 0, 1.83), skin, -0.001);
    const head = inkedCircle(0.27, skin, 0.035);
    head.position.set(0, 2.1, 0.001);
    this.body.add(neck, head);
    this.addHair(o, hair);
    // face: dot eyes and a smile (an O when the floor dies)
    this.eyes = new THREE.Group();
    for (const side of [-1, 1]) {
      const e = shapeMesh(roundedRectShape(0.055, 0.09, 0.025), INK, 0);
      e.position.set(side * 0.095, 2.13, 0.012);
      this.eyes.add(e);
    }
    this.body.add(this.eyes);
    this.mouth = shapeMesh(arcShape(0.08, 0.03, Math.PI * 1.15, Math.PI * 1.85), INK, 0.012, 8);
    this.mouth.position.set(0, 2.06, 0);
    this.oMouth = shapeMesh(circleShape(0.035), INK, 0.012, 12);
    this.oMouth.position.set(0, 1.99, 0);
    this.body.add(this.mouth, this.oMouth);

    // arms with hands, pivoting at the shoulders (in front of the torso)
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.37, 1.72, 0.01);
      const arm = inkedRect(0.16, 0.74, 0.07, top, 0.035);
      arm.position.set(0, -0.35, 0);
      const hand = inkedCircle(0.1, skin, 0.03);
      hand.position.set(0, -0.76, 0.004);
      pivot.add(arm, hand);
      this.body.add(pivot);
      this.arms.push(pivot);
    }

    // loading spinner: a ring of dots above the head
    for (let k = 0; k < 8; k++) {
      const m = ownGlow('#ffffff', 1.2);
      this.spinDots.push(m);
      const a = (k / 8) * Math.PI * 2;
      const dot = shapeMesh(circleShape(0.045), m, 0, 10);
      dot.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
      this.spinner.add(dot);
    }
    this.spinner.position.set(0, 2.75, 0.05);
    this.root.add(this.spinner);
  }

  private addHair(o: Outfit, hair: THREE.MeshBasicMaterial) {
    const back = (s: THREE.Shape, z = -0.01) => { const m = shapeMesh(s, hair, z, 24); this.body.add(m); return m; };
    const ink = (s: THREE.Shape, z = -0.012) => { const m = shapeMesh(s, INK, z, 24); this.body.add(m); return m; };
    switch (o.style) {
      case 'afro': {
        ink(scallop(0.52, 2.3)); back(scallop(0.49, 2.3));
        const sheenMat = mat2(hair);
        this.mats.push({ m: sheenMat, base: sheenMat.color.clone() });
        const sheen = shapeMesh(arcShape(0.36, 0.07, Math.PI * 0.55, Math.PI * 0.85), sheenMat, -0.008, 12);
        sheen.position.set(0, 2.3, 0);
        this.body.add(sheen);
        break;
      }
      case 'long': {
        const s = roundedRectShape(0.72, 0.95, 0.3, 0, 1.9), si = roundedRectShape(0.79, 1.02, 0.33, 0, 1.9);
        ink(si); back(s);
        const fringe = shapeMesh(arcShape(0.22, 0.12, 0.15, Math.PI - 0.15), hair, 0.008, 12);
        fringe.position.set(0, 2.12, 0);
        this.body.add(fringe);
        break;
      }
      case 'bob': {
        ink(roundedRectShape(0.78, 0.7, 0.3, 0, 2.08)); back(roundedRectShape(0.72, 0.64, 0.27, 0, 2.08));
        const fringe = shapeMesh(roundedRectShape(0.5, 0.14, 0.06, 0, 2.3), hair, 0.008);
        this.body.add(fringe);
        break;
      }
      case 'beehive': {
        ink(roundedRectShape(0.6, 0.9, 0.29, 0, 2.45)); back(roundedRectShape(0.54, 0.84, 0.26, 0, 2.45));
        break;
      }
      case 'feather': {
        ink(roundedRectShape(0.84, 0.6, 0.28, 0, 2.18)); back(roundedRectShape(0.78, 0.54, 0.25, 0, 2.18));
        for (const side of [-1, 1]) {
          const wing = shapeMesh(arcShape(0.2, 0.08, side < 0 ? 0.3 : Math.PI - 1.4, side < 0 ? 1.4 : Math.PI - 0.3), hair, 0.008, 10);
          wing.position.set(side * 0.08, 2.15, 0);
          this.body.add(wing);
        }
        break;
      }
      case 'pony': {
        ink(circleShape(0.31, 0, 2.15)); back(circleShape(0.29, 0, 2.15));
        const tail = inkedRect(0.16, 0.5, 0.08, hair, 0.03);
        tail.position.set(0.3, 2.0, -0.015);
        tail.rotation.z = -0.4;
        this.body.add(tail);
        break;
      }
      case 'bald': break;
    }
  }

  /**
   * frozen: 0 = alive, 1 = frozen (greyed out, spinner on). loading: spinner angle source (song time).
   * lit: 0..1 how much club light reaches them (dims the whole figure toward the dark).
   */
  /** gasp: 0..1 the mouth drops to an O and the eyes go big (the dancers who spot the Field). */
  set(b: Body, frozen: number, t: number, lit = 1, gasp = 0) {
    this.body.position.set(b.hip, b.bob, 0);
    this.body.rotation.z = b.lean;
    this.body.scale.set(1 + b.squash * 0.08, 1 - b.squash * 0.08, 1);
    const flip = Math.cos(b.turn);
    this.root.scale.set((flip < 0 ? -1 : 1) * Math.max(0.1, Math.abs(flip)) * this.scale, this.scale, this.scale);
    this.arms[0].rotation.z = -b.aL;
    this.arms[1].rotation.z = b.aR;
    this.legs[0].rotation.z = -b.lL;
    this.legs[1].rotation.z = b.lR;
    const fz = clamp(frozen);
    const tmp = new THREE.Color();
    for (const { m, base } of this.mats) {
      tmp.copy(base).lerp(GREY, fz * 0.75);
      tmp.lerp(DIM, (1 - lit) * 0.7);
      m.color.copy(tmp);
    }
    const o = fz >= 0.5 || gasp > 0.3;
    this.mouth.visible = !o;
    this.oMouth.visible = o;
    this.oMouth.scale.setScalar(1 + 0.8 * clamp(gasp));
    this.eyes.children.forEach(e => e.scale.setScalar(1 + 0.35 * clamp(gasp)));
    this.spinner.visible = fz > 0.5;
    if (this.spinner.visible) {
      // the classic spinner: one bright dot chasing round, the rest fading behind it
      const head = Math.floor(t * 10) % 8;
      this.spinDots.forEach((m, k) => {
        const age = (head - k + 8) % 8;
        setGlow(m, '#ffffff', 0.2 + 1.05 * Math.max(0, 1 - age / 5));
      });
      this.spinner.position.set(b.hip, 2.75 + b.bob, 0.05);
      this.spinner.rotation.z = 0;
    }
  }
}

/** A frozen mid-move pose for dancer i (big, readable shapes: kicks, points, jumps, spins). */
export function frozenPose(i: number): Body {
  const k = Math.floor(hash(i, 21) * 7);
  const flip = hash(i, 22) < 0.5 ? 1 : -1;
  const P = (b: Partial<Body>): Body => ({ ...STAND, ...b });
  const poses: Body[] = [
    P({ aR: 2.6, aL: -0.25, lean: 0.12, hip: 0.05 }),                // the point
    P({ aL: 2.7, aR: 2.7, bob: 0.35, lL: 0.35, lR: 0.35, squash: -0.4 }), // mid-jump, arms up
    P({ aL: 1.5, aR: 1.5, lR: 1.1, lean: -0.15 }),                    // high kick
    P({ aL: 1.4, aR: 1.4, turn: 0.9 }),                               // mid-spin
    P({ aL: 0.6, aR: 2.1, lean: 0.25, hip: 0.12 }),                   // hip bump
    P({ aL: 2.2, aR: -0.3, lL: 0.4, lean: -0.2 }),                    // lunge
    P({ aL: 0.9, aR: 0.9, bob: -0.1, squash: 0.4 }),                  // crouch
  ];
  const b = poses[k];
  if (flip < 0) return { ...b, aL: b.aR, aR: b.aL, lL: b.lR, lR: b.lL, lean: -b.lean, hip: -b.hip };
  return b;
}

/** Dancing: a style per dancer (or one style for everyone, in unison), all locked to the beat. */
export function dancePose(i: number, beat: number, energy = 1, unison?: number): Body {
  const style = unison ?? Math.floor(hash(i, 31) * 5);
  const b = Math.max(0, beat + (unison === undefined && hash(i, 32) >= 0.5 && style === 4 ? 0.5 : 0));
  const n = Math.floor(b), ph = b - n;
  const hop = 4 * ph * (1 - ph);
  const e = energy;
  const sideN = n % 2 ? 1 : -1;
  switch (style) {
    case 0: { // the point, switching every two beats
      const s = Math.floor(b / 2) % 2 ? 1 : -1;
      return { ...STAND, aR: s > 0 ? 2.6 : -0.2, aL: s > 0 ? -0.2 : 2.6, lean: s * 0.12 * e, hip: s * 0.06 * e, bob: hop * 0.05 * e };
    }
    case 1: // bounce with hands up on the off-beat
      return { ...STAND, aL: lerp(0.5, 2.6, hop) * e, aR: lerp(0.5, 2.6, hop) * e, bob: hop * 0.22 * e, squash: (1 - hop) * 0.3 * e };
    case 2: // side step and clap
      return { ...STAND, hip: sideN * 0.12 * e, lean: sideN * 0.08 * e, aL: 0.4 + hop * 0.9, aR: 0.4 + hop * 0.9, lL: sideN < 0 ? 0.3 * hop : 0.05, lR: sideN > 0 ? 0.3 * hop : 0.05 };
    case 3: // the hustle roll
      return { ...STAND, aL: 0.9 + Math.sin(b * Math.PI * 4) * 0.5 * e, aR: 0.9 + Math.sin(b * Math.PI * 4 + Math.PI) * 0.5 * e, bob: hop * 0.06, lean: Math.sin(b * Math.PI) * 0.1 * e };
    default: // kick step
      return { ...STAND, aL: 1.3 * e, aR: 1.3 * e, lR: n % 2 ? 0.8 * hop * e : 0.05, lL: n % 2 ? 0.05 : 0.8 * hop * e, bob: hop * 0.08 };
  }
}
