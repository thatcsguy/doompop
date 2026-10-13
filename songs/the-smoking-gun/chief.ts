// The Chief: the boss who wanders over with a coffee. A capsule person in a sharp charcoal pinstripe
// suit, a big grey walrus moustache, one eyebrow that does all the talking, and a mug that never
// empties. A front-facing flat cut-out like the dancers, rim-lit like the suspects so he reads in
// the dark club. set(state, t) sets every property it touches; origin between the feet.
import * as THREE from 'three';
import { INK, arcShape, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh } from '../../engine/flat';
import { clamp, lerp } from '../../engine/ease';
import { PAL } from './look';
import { Rim } from './suspects';

export interface ChiefState {
  armR: number;    // the pointing arm (screen right): 0 hanging down, positive = out and up
  point: number;   // 0..1 index finger out
  sip: number;     // 0..1 the mug comes up under the moustache
  brow: number;    // -1 frown .. 1 one eyebrow way up
  lean: number;
  bob: number;
  walk: number;    // walk cycle phase in cycles (0 = standing)
  turn: number;    // paper-puppet flip, radians
  look: number;    // pupils -1..1
  steam: number;   // the coffee's steam, 0..1
  rim: number;
  tap?: number;    // 0..1 the right foot taps (impatient), its outer end lifting
}
export const CHIEF_REST: ChiefState = { armR: 0.12, point: 0, sip: 0, brow: 0, lean: 0, bob: 0, walk: 0, turn: 0, look: 0, steam: 1, rim: 1 };
export const cs = (p: Partial<ChiefState>): ChiefState => ({ ...CHIEF_REST, ...p });

const SUIT = '#3a3d52', SUIT_DARK = '#2a2c3d', STRIPE = '#555a78', SKIN = '#e9b592', SKIN_DARK = '#d29673', GREY = '#d9d5de';
const SHOULDER_Y = 1.8, HEAD_Y = 2.22;
const UPPER = 0.42, FORE = 0.4;

export class Chief {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private feet: THREE.Group[] = [];
  private pointArm = new THREE.Group();
  private finger: THREE.Object3D;
  private upper = new THREE.Group();
  private fore = new THREE.Group();
  private mug = new THREE.Group();
  private steam: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; k: number }[] = [];
  private pupils: THREE.Mesh[] = [];
  private browL: THREE.Mesh;
  private browR: THREE.Mesh;
  private rim = new Rim();
  /** The tip of the pointing finger (in the pointing arm's frame), for things that need the tap. */
  readonly fingertip = new THREE.Object3D();

  constructor() {
    this.root.add(this.body);
    // legs: straight trousers with a crease, polished brown brogues; pivots at the hips
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.19, 1.0, -0.02);
      const leg = inkedRect(0.26, 0.9, 0.05, SUIT_DARK, 0.04);
      leg.position.y = -0.45;
      const crease = shapeMesh(roundedRectShape(0.018, 0.78, 0.008, 0, -0.45), STRIPE, 0.004);
      // the shoe pivots at its inner bottom corner (for the foot tap)
      const foot = new THREE.Group();
      foot.position.set(side * -0.14, -0.99, 0);
      const shoe = inkedRect(0.38, 0.14, 0.06, '#5a3220', 0.035);
      shoe.position.set(side * 0.19, 0.07, 0.006);
      const shine = shapeMesh(roundedRectShape(0.12, 0.03, 0.01, side * 0.22, 0.1), '#8a5a3c', 0.012);
      foot.add(shoe, shine);
      pivot.add(leg, crease, foot);
      this.feet.push(foot);
      this.body.add(pivot);
      this.legs.push(pivot);
    }
    // torso: the jacket, a touch of a belly, pinstripes, lapels, white shirt and a red tie
    const jacket = new THREE.Shape();
    jacket.moveTo(-0.47, SHOULDER_Y + 0.06);
    jacket.lineTo(0.47, SHOULDER_Y + 0.06);
    jacket.quadraticCurveTo(0.56, 1.3, 0.44, 0.9);
    jacket.lineTo(-0.44, 0.9);
    jacket.quadraticCurveTo(-0.56, 1.3, -0.47, SHOULDER_Y + 0.06);
    const jacketInk = new THREE.Shape();
    jacketInk.moveTo(-0.52, SHOULDER_Y + 0.1);
    jacketInk.lineTo(0.52, SHOULDER_Y + 0.1);
    jacketInk.quadraticCurveTo(0.62, 1.3, 0.48, 0.86);
    jacketInk.lineTo(-0.48, 0.86);
    jacketInk.quadraticCurveTo(-0.62, 1.3, -0.52, SHOULDER_Y + 0.1);
    this.body.add(shapeMesh(jacketInk, INK, 0), shapeMesh(jacket, SUIT, 0.002));
    this.rim.add(jacketInk, this.body, 0, 0, -0.03, 0.05);
    for (let i = -3; i <= 3; i++) {
      if (Math.abs(i) < 1) continue;
      this.body.add(shapeMesh(roundedRectShape(0.012, 0.86, 0.006, i * 0.13, 1.36), STRIPE, 0.003));
    }
    const shirt = new THREE.Shape();
    shirt.moveTo(-0.19, SHOULDER_Y + 0.06); shirt.lineTo(0.19, SHOULDER_Y + 0.06); shirt.lineTo(0, 1.38); shirt.closePath();
    this.body.add(shapeMesh(shirt, '#f4f1ea', 0.004));
    const knot = inkedRect(0.1, 0.08, 0.02, '#c92f3c', 0.02);
    knot.position.set(0, SHOULDER_Y + 0.0, 0.01); // in front of the tie (at 0.006 its outline tied with it)
    const tie = new THREE.Shape();
    tie.moveTo(-0.045, SHOULDER_Y - 0.04); tie.lineTo(0.045, SHOULDER_Y - 0.04); tie.lineTo(0.07, 1.42); tie.lineTo(0, 1.34); tie.lineTo(-0.07, 1.42); tie.closePath();
    this.body.add(knot, shapeMesh(tie, '#c92f3c', 0.006));
    for (const side of [-1, 1]) {
      const lap = new THREE.Shape();
      lap.moveTo(side * 0.19, SHOULDER_Y + 0.06); lap.lineTo(side * 0.36, SHOULDER_Y + 0.06); lap.lineTo(side * 0.04, 1.36); lap.closePath();
      this.body.add(shapeMesh(lap, SUIT_DARK, 0.007));
      const btn = shapeMesh(circleShape(0.03), '#1d1e2a', 0.008, 8);
      btn.position.set(0.02, 1.2 - (side + 1) * 0.08, 0.008);
      this.body.add(btn);
    }
    const hanky = new THREE.Shape();
    hanky.moveTo(-0.36, 1.66); hanky.lineTo(-0.2, 1.66); hanky.lineTo(-0.25, 1.74); hanky.lineTo(-0.3, 1.7); hanky.lineTo(-0.34, 1.75); hanky.closePath();
    this.body.add(shapeMesh(hanky, PAL.gold, 0.008));

    // head: bald and shiny, grey side tufts, ears, a heavy brow and the moustache
    const neck = shapeMesh(roundedRectShape(0.2, 0.16, 0.04, 0, SHOULDER_Y + 0.1), SKIN_DARK, -0.001);
    for (const side of [-1, 1]) {
      const ear = inkedCircle(0.075, SKIN, 0.03);
      ear.position.set(side * 0.3, HEAD_Y - 0.02, -0.004);
      this.body.add(ear);
    }
    const head = inkedCircle(0.31, SKIN, 0.035);
    head.position.set(0, HEAD_Y, 0.001);
    this.body.add(neck, head);
    this.rim.add(circleShape(0.36), this.body, 0, HEAD_Y, -0.02, 0.04);
    const shine = shapeMesh(arcShape(0.2, 0.05, Math.PI * 0.55, Math.PI * 0.8), '#fbe2cf', 0.006, 10);
    shine.position.set(0, HEAD_Y + 0.02, 0.006);
    this.body.add(shine);
    for (const side of [-1, 1]) {
      const tuft = inkedRect(0.1, 0.2, 0.05, GREY, 0.025);
      tuft.position.set(side * 0.29, HEAD_Y + 0.06, 0.008);
      tuft.rotation.z = side * -0.15;
      this.body.add(tuft);
    }
    for (const side of [-1, 1]) {
      const eye = shapeMesh(roundedRectShape(0.06, 0.08, 0.028), INK, 0.01);
      eye.position.set(side * 0.11, HEAD_Y + 0.02, 0.01);   // (z in front of the head's fill)
      this.body.add(eye);
      this.pupils.push(eye);
    }
    this.browL = shapeMesh(roundedRectShape(0.16, 0.05, 0.02), GREY, 0.012);
    this.browR = shapeMesh(roundedRectShape(0.16, 0.05, 0.02), GREY, 0.012);
    this.body.add(this.browL, this.browR);
    const nose = inkedCircle(0.065, SKIN_DARK, 0.025);
    nose.position.set(0, HEAD_Y - 0.07, 0.014);
    this.body.add(nose);
    // the walrus moustache: two drooping lobes and a scalloped bottom edge
    const tash = (grow: number) => {
      const s = new THREE.Shape();
      const y0 = HEAD_Y - 0.12;
      s.moveTo(-0.27 - grow, y0 - 0.13 - grow);
      s.quadraticCurveTo(-0.24 - grow, y0 + 0.05 + grow, -0.04, y0 + 0.03 + grow);
      s.quadraticCurveTo(0, y0 + 0.0 + grow, 0.04, y0 + 0.03 + grow);
      s.quadraticCurveTo(0.24 + grow, y0 + 0.05 + grow, 0.27 + grow, y0 - 0.13 - grow);
      for (let i = 0; i <= 6; i++) {
        const x = lerp(0.27, -0.27, i / 6), y = y0 - 0.1 + (i % 2 ? 0.03 : -0.01) - grow;
        s.lineTo(x * (1 + grow), y);
      }
      s.closePath();
      return s;
    };
    // in front of the nose (at 0.016 its ink tied with the nose's fill and flickered)
    this.body.add(shapeMesh(tash(0.025), INK, 0.022), shapeMesh(tash(0), GREY, 0.026));

    // the pointing arm (screen right): a sleeve, a white cuff, a hand and an index finger
    this.pointArm.position.set(0.47, SHOULDER_Y - 0.04, 0.02);
    const sleeve = inkedRect(0.22, 0.74, 0.08, SUIT, 0.04);
    sleeve.position.y = -0.33;
    const cuff = shapeMesh(roundedRectShape(0.22, 0.07, 0.02, 0, -0.68), '#f4f1ea', 0.004);
    const hand = inkedCircle(0.11, SKIN, 0.03);
    hand.position.set(0, -0.78, 0.006);
    const finger = inkedRect(0.06, 0.2, 0.03, SKIN, 0.025);
    finger.position.set(0, -0.92, 0); // behind the hand: at 0.004 its fill was level with the hand's ink
    this.finger = finger;
    this.fingertip.position.set(0, -1.03, 0);
    this.pointArm.add(sleeve, cuff, hand, finger, this.fingertip);
    this.body.add(this.pointArm);

    // the coffee arm (screen left): upper arm and forearm, so the mug can come up for a sip
    this.upper.position.set(-0.47, SHOULDER_Y - 0.04, 0.022);
    const up = inkedRect(0.22, UPPER + 0.08, 0.08, SUIT, 0.04);
    up.position.y = -UPPER / 2;
    this.upper.add(up);
    this.fore.position.y = -UPPER;
    const fa = inkedRect(0.2, FORE + 0.06, 0.08, SUIT, 0.04);
    fa.position.set(0, -FORE / 2, 0.003);
    const cuff2 = shapeMesh(roundedRectShape(0.2, 0.07, 0.02, 0, -FORE + 0.04), '#f4f1ea', 0.006);
    const hand2 = inkedCircle(0.1, SKIN, 0.03);
    hand2.position.set(0, -FORE - 0.04, 0.008);
    this.fore.add(fa, cuff2, hand2);
    this.upper.add(this.fore);
    this.body.add(this.upper);
    // the mug: white with a red band, held by its handle and kept upright whatever the arm does
    // (the group sits at the hand; the cup hangs off to the right of it)
    const cupG = new THREE.Group();
    cupG.position.x = 0.17;
    const cup = inkedRect(0.2, 0.24, 0.04, '#f6f3ee', 0.03);
    const band = shapeMesh(roundedRectShape(0.2, 0.05, 0.01, 0, 0.04), '#c92f3c', 0.004);
    const handle = shapeMesh(arcShape(0.07, 0.035, Math.PI / 2, Math.PI * 1.5), INK, -0.002, 10);
    handle.position.set(-0.11, 0, -0.002);
    const handle2 = shapeMesh(arcShape(0.07, 0.018, Math.PI / 2, Math.PI * 1.5), '#f6f3ee', -0.001, 10);
    handle2.position.set(-0.11, 0, -0.001);
    const coffee = shapeMesh(roundedRectShape(0.17, 0.03, 0.01, 0, 0.11), '#5a3524', 0.005);
    cupG.add(cup, band, handle, handle2, coffee);
    for (let k = 0; k < 3; k++) {
      const mat = ownMat('#ffffff', 0.35, true);
      const wisp = new THREE.Mesh(new THREE.ShapeGeometry(arcShape(0.06, 0.022, -Math.PI / 2, Math.PI / 2), 8), mat);
      cupG.add(wisp);
      this.steam.push({ mesh: wisp, mat, k });
    }
    this.mug.add(cupG);
    this.fore.add(this.mug);
  }

  set(s: ChiefState, t: number) {
    const flip = Math.cos(s.turn);
    this.root.scale.set((flip < 0 ? -1 : 1) * Math.max(0.08, Math.abs(flip)), 1, 1);
    // walking: legs swing, a little bob on each step
    const w = s.walk * Math.PI * 2;
    const step = s.walk !== 0 ? Math.abs(Math.sin(w)) : 0;
    this.legs[0].rotation.z = s.walk !== 0 ? Math.sin(w) * 0.32 : 0;
    this.legs[1].rotation.z = s.walk !== 0 ? -Math.sin(w) * 0.32 : 0;
    this.feet[1].rotation.z = 0.3 * clamp(s.tap ?? 0);
    this.body.position.y = s.bob + step * 0.05;
    this.body.rotation.z = s.lean;
    this.pointArm.rotation.z = s.armR + (s.walk !== 0 ? Math.sin(w) * 0.2 : 0);
    this.finger.visible = s.point > 0.5;
    // the coffee arm reaches for a target with two bones (the elbow out to the side)
    const sip = clamp(s.sip);
    const tx = lerp(-0.27, -0.17, sip) - this.upper.position.x, ty = lerp(1.38, HEAD_Y - 0.28, sip) - this.upper.position.y;
    const d = Math.min(UPPER + FORE - 0.001, Math.hypot(tx, ty));
    const inner = Math.acos(clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1));
    const toT = Math.atan2(tx, -ty);          // angle of the target from straight down (toward +x is positive)
    const a1 = toT - inner;                    // elbow out to the -x side
    const bend = Math.PI - Math.acos(clamp((UPPER * UPPER + FORE * FORE - d * d) / (2 * UPPER * FORE), -1, 1));
    this.upper.rotation.z = a1;
    this.fore.rotation.z = bend;
    // the mug stays upright: undo the arm's rotation (and the body's lean)
    this.mug.rotation.z = -(a1 + bend) - s.lean;
    this.mug.position.set(0, -FORE - 0.04, 0.016); // in front of the hand (at 0.012 the handle tied with it)
    this.steam.forEach(({ mesh, mat, k }) => {
      const ph = (t * 0.7 + k / 3) % 1;
      mesh.position.set(Math.sin((t * 2 + k) * 2.1) * 0.03, 0.2 + ph * 0.3, 0.01);
      mesh.scale.setScalar(0.8 + ph * 0.6);
      mesh.rotation.z = Math.sin(t * 3 + k) * 0.4;
      mat.opacity = 0.4 * Math.sin(ph * Math.PI) * clamp(s.steam) * (1 - sip);
      mesh.visible = mat.opacity > 0.01;
    });
    this.pupils.forEach((p, i) => { p.position.x = (i ? 1 : -1) * 0.11 + s.look * 0.035; });
    // the eyebrow: the right one does the talking
    const br = s.brow;
    this.browL.position.set(-0.12, HEAD_Y + 0.13 + Math.min(0, br) * 0.02, 0.012);
    this.browL.rotation.z = br < 0 ? -0.3 * br : 0.06;
    this.browR.position.set(0.12, HEAD_Y + 0.13 + Math.max(0, br) * 0.09 + Math.min(0, br) * 0.02, 0.012);
    this.browR.rotation.z = br < 0 ? 0.3 * br : -0.18 * br;
    this.rim.set(s.rim, t);
  }
}
