// The suspects, personified code with little faces, in the same flat blocky style as Clawd:
//   Fn       the Function: an old grey box with cobwebs, bushy brows and reading glasses
//   Bouncer  the Handler: a bouncer in a black suit and shades, at the velvet rope
//   Cache    the Cache: a filing cabinet in shades and a powder-blue leisure suit
//   Field    the tiny Field: one innocent `"v": 2` with big eyes
// Each has set(state, t) that sets every property it touches, origin between the feet. They all
// get the two-tone neon rim, so they read in the dark club like Clawd does.
import * as THREE from 'three';
import { INK, arcShape, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { clamp, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { PAL, TERM_FONT, UI_FONT, cutout, ownGlow, setGlow } from './look';

/** Pose shared by the suspects. Angles in radians; arms as on Clawd: 0 = straight out sideways, up is positive. */
export interface SuspectState {
  armL: number; armR: number;
  bob: number;        // vertical hop (from the beat)
  lean: number;
  squash: number;
  look: number;       // pupils left/right, -1..1
  brow: number;       // -1 cross .. 1 raised
  open: number;       // eye openness, 0..1.4
  shrug: number;      // 0..1
  shades: number;     // 0 on, 1 lowered (peering over)
  wag: number;        // finger wag amount 0..1 (Cache) / wave (Handler)
  cuffs: number;      // Function, Cache: 1 = cuffed (paws together in front), 0 = free
  mouth: number;      // -1 frown .. 1 grin
  rim: number;        // rim light strength
  turn: number;       // paper-puppet flip
  hold: number;       // Handler: 1 = arms free and posed from armL/armR (escorting), no waving
}
export const SUSPECT_REST: SuspectState = {
  armL: -0.95, armR: -0.95, bob: 0, lean: 0, squash: 0, look: 0, brow: 0, open: 1, shrug: 0, shades: 0, wag: 0, cuffs: 0, mouth: 0, rim: 1, turn: 0, hold: 0,
};
export const sp = (p: Partial<SuspectState>): SuspectState => ({ ...SUSPECT_REST, ...p });

/** Two-tone rim: offset copies of a silhouette just behind it (pink from the left, cyan from the right). */
export class Rim {
  private parts: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; side: number }[] = [];
  add(shape: THREE.Shape, parent: THREE.Object3D, x: number, y: number, z: number, off = 0.045) {
    const geo = new THREE.ShapeGeometry(shape, 8);
    for (const side of [-1, 1]) {
      const mat = ownGlow(side < 0 ? PAL.pink : PAL.cyan, 1.3);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + side * off, y + 0.015, z);
      parent.add(mesh);
      this.parts.push({ mesh, mat, side });
    }
  }
  set(k: number, t: number) {
    const shimmer = 0.85 + 0.15 * Math.sin(t * 1.9);
    for (const p of this.parts) {
      p.mesh.visible = k > 0.01;
      setGlow(p.mat, p.side < 0 ? PAL.pink : PAL.cyan, 1.35 * k * shimmer);
    }
  }
}

/** A little stubby arm on a shoulder pivot: +x runs along the arm (mirrored for the left). */
function stubArm(side: number, len: number, thick: number, fill: THREE.ColorRepresentation | THREE.Material, hand?: THREE.ColorRepresentation) {
  const pivot = new THREE.Group();
  const arm = inkedRect(len, thick, thick * 0.4, fill, 0.035);
  arm.position.x = side * (len / 2 - thick * 0.2);
  pivot.add(arm);
  if (hand) {
    const h = inkedCircle(thick * 0.62, hand, 0.03);
    h.position.set(side * len, 0, 0.004);
    pivot.add(h);
  }
  return pivot;
}

function eyes(parent: THREE.Object3D, x: number, y: number, z: number, w = 0.07, h = 0.11) {
  const out: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const e = shapeMesh(roundedRectShape(w, h, w * 0.45), INK, z);
    e.position.set(side * x, y, z);
    parent.add(e);
    out.push(e);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
/** The Function: an old grey box, cobwebbed, with bushy white brows and round reading glasses. */
export class Fn {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private arms: THREE.Group[] = [];
  private legs: THREE.Object3D[] = [];
  private eyes: THREE.Mesh[];
  private lids: THREE.Mesh[] = [];
  private brows: THREE.Group[] = [];
  private mouth: THREE.Mesh;
  private frown: THREE.Mesh;
  private rim = new Rim();
  /** Where the cuffs sit when cuffed (in root space). */
  readonly cuffSpot = new THREE.Vector3(0, 0.55, 0.1);
  static readonly W = 1.15;
  static readonly H = 1.0;
  static readonly Y = 0.82;   // body centre

  constructor() {
    const { W, H, Y } = Fn;
    this.root.add(this.body);
    // legs: two stubs with slippers
    for (const side of [-1, 1]) {
      const leg = inkedRect(0.16, 0.34, 0.02, '#7d798c', 0.035);
      leg.position.set(side * 0.28, 0.2, -0.02);
      const slipper = inkedRect(0.3, 0.1, 0.05, '#8a3b4a', 0.03);
      slipper.position.set(side * 0.33, 0.04, 0.005);
      this.root.add(leg, slipper);
      this.legs.push(leg, slipper);
    }
    for (const side of [-1, 1]) {
      const a = stubArm(side, 0.36, 0.17, '#85819a');
      a.position.set(side * (W / 2 - 0.02), Y - 0.05, -0.006);
      this.body.add(a);
      this.arms.push(a);
    }
    const box = inkedRect(W, H, 0.015, '#a29eb2', 0.05);
    box.position.y = Y;
    this.body.add(box);
    this.rim.add(roundedRectShape(W + 0.1, H + 0.1, 0.03), this.body, 0, Y, -0.05);
    // cel band, vent slots, a dented corner and a "fn()" plate
    this.body.add(shapeMesh(roundedRectShape(W, 0.2, 0.01, 0, Y - H / 2 + 0.1), '#8a8699', 0.004));
    for (let i = 0; i < 4; i++) this.body.add(shapeMesh(roundedRectShape(0.22, 0.03, 0.012, 0.3, Y - 0.12 - i * 0.07), '#6f6b80', 0.005));
    const plate = staticPlane(0.42, 0.16, 300, (g, Wp, Hp) => {
      g.fillStyle = '#e8e2c8'; g.beginPath(); g.roundRect(2, 2, Wp - 4, Hp - 4, 8); g.fill();
      g.fillStyle = '#3b3346'; g.font = `700 ${Hp * 0.62}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('fn()', Wp / 2, Hp * 0.55);
    });
    cutout(plate);
    plate.position.set(-0.28, Y - 0.24, 0.006);
    this.body.add(plate);
    // the git blame sticker, peeling, on the lower right
    const sticker = staticPlane(0.34, 0.2, 300, (g, Wp, Hp) => {
      g.save(); g.translate(Wp / 2, Hp / 2); g.rotate(-0.08);
      g.fillStyle = '#ffe17a'; g.fillRect(-Wp * 0.45, -Hp * 0.4, Wp * 0.9, Hp * 0.8);
      g.fillStyle = '#5a4a1c'; g.font = `700 ${Hp * 0.22}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('git blame', 0, -Hp * 0.13); g.fillText('2019', 0, Hp * 0.15);
      g.restore();
    });
    cutout(sticker, 0.3);
    sticker.position.set(0.33, Y - 0.36, 0.007);
    this.body.add(sticker);
    // face: sleepy eyes behind round reading glasses, bushy white brows, a small mouth
    this.eyes = eyes(this.body, 0.2, Y + 0.12, 0.012, 0.075, 0.1);
    for (const side of [-1, 1]) {
      const lid = shapeMesh(roundedRectShape(0.15, 0.07, 0.02), '#a29eb2', 0.014);
      lid.position.set(side * 0.2, Y + 0.17, 0.014);
      this.body.add(lid);
      this.lids.push(lid);
      const ring = shapeMesh(arcShape(0.13, 0.03, 0, Math.PI * 2), '#d8c27a', 0.016, 24);
      ring.position.set(side * 0.2, Y + 0.12, 0.016);
      const glass = shapeMesh(circleShape(0.12), ownMat('#cfe8ff', 0.18, true), 0.015, 20);
      glass.position.set(side * 0.2, Y + 0.12, 0.015);
      this.body.add(ring, glass);
      const brow = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const tuft = shapeMesh(roundedRectShape(0.09, 0.06, 0.03, (i - 1.5) * 0.055, (hash(i, side, 81) - 0.5) * 0.02), '#f4f1ea', 0.017);
        tuft.rotation.z = (hash(i, side, 82) - 0.5) * 0.5;
        brow.add(tuft);
      }
      brow.position.set(side * 0.2, Y + 0.3, 0);
      this.body.add(brow);
      this.brows.push(brow);
    }
    const bridge = shapeMesh(roundedRectShape(0.16, 0.025, 0.01, 0, Y + 0.14), '#d8c27a', 0.016);
    this.body.add(bridge);
    this.mouth = shapeMesh(arcShape(0.07, 0.03, Math.PI * 1.2, Math.PI * 1.8), INK, 0.012, 8);
    this.mouth.position.set(0, Y - 0.02, 0.012);
    this.frown = shapeMesh(arcShape(0.07, 0.03, Math.PI * 0.2, Math.PI * 0.8), INK, 0.012, 8);
    this.frown.position.set(0, Y - 0.1, 0.012);
    this.body.add(this.mouth, this.frown);
    // cobwebs on the top left corner, and dust on the lid
    const web = new THREE.Group();
    const webMat = ownMat('#e9e6f5', 0.75, true);
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * (Math.PI / 2);
      const strand = shapeMesh(roundedRectShape(0.012, 0.42, 0.005, 0, -0.21), webMat, 0.02);
      strand.rotation.z = a;   // from straight down to straight right, into the box's face
      web.add(strand);
    }
    for (const r of [0.12, 0.22, 0.32]) web.add(shapeMesh(arcShape(r, 0.01, -Math.PI / 2, 0), webMat, 0.02, 10));
    web.position.set(-W / 2, Y + H / 2, 0);
    this.body.add(web);
    for (let i = 0; i < 9; i++) {
      const d = shapeMesh(circleShape(0.012 + hash(i, 83) * 0.012), '#d6d2e2', 0.006, 6);
      d.position.set((hash(i, 84) - 0.5) * W * 0.8, Y + H / 2 - 0.05 - hash(i, 85) * 0.1, 0.006);
      this.body.add(d);
    }
  }

  set(s: SuspectState, t: number) {
    const { Y } = Fn;
    const flip = Math.cos(s.turn);
    this.root.scale.set((flip < 0 ? -1 : 1) * Math.max(0.08, Math.abs(flip)), 1, 1);
    this.body.position.y = s.bob + s.shrug * 0.06;
    this.body.rotation.z = s.lean;
    this.body.scale.set(1 + s.squash * 0.12, 1 - s.squash * 0.15, 1);
    // cuffed: paws come together in front; shrug: both up and out (cuffed, only the shoulders go up)
    const cuff = clamp(s.cuffs), shrug = clamp(s.shrug);
    const aL = lerp(lerp(s.armL, -2.2, cuff), 0.75, shrug * (1 - cuff));
    const aR = lerp(lerp(s.armR, -2.2, cuff), 0.75, shrug * (1 - cuff));
    this.arms[0].rotation.z = -aL;
    this.arms[1].rotation.z = aR;
    this.arms.forEach((a, i) => {
      a.position.x = (i ? 1 : -1) * (Fn.W / 2 - 0.02 - cuff * 0.2);
      a.position.z = cuff > 0.5 ? 0.03 : -0.006;   // cuffed paws come round to the front
    });
    const open = clamp(s.open, 0, 1.4);
    this.eyes.forEach((e, i) => { e.scale.set(1, Math.max(0.12, open), 1); e.position.x = (i ? 1 : -1) * 0.2 + s.look * 0.04; });
    this.lids.forEach(l => { l.visible = open < 0.95; l.position.y = Y + 0.17 + (open - 0.6) * 0.04; });
    this.brows.forEach((b, i) => { b.position.y = Y + 0.3 + s.brow * 0.06 + shrug * 0.04; b.rotation.z = (i ? -1 : 1) * s.brow * -0.2; });
    this.mouth.visible = s.mouth >= 0;
    this.frown.visible = s.mouth < 0;
    this.rim.set(s.rim, t);
  }
}

// ---------------------------------------------------------------------------------------------
/** The Handler: a big bouncer in a black suit, shades and an earpiece; arms crossed until he waves. */
export class Bouncer {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private crossed = new THREE.Group();
  private armL: THREE.Group;
  private armR: THREE.Group;
  private mouth: THREE.Mesh;
  private rim = new Rim();

  constructor() {
    const suit = '#16141f', skin = '#7a4a32';
    this.root.add(this.body);
    for (const side of [-1, 1]) {
      const leg = inkedRect(0.36, 1.1, 0.05, suit, 0.04);
      leg.position.set(side * 0.24, 0.6, -0.02);
      const shoe = inkedRect(0.5, 0.16, 0.06, '#0a0a0f', 0.035);
      shoe.position.set(side * 0.3, 0.06, 0.004);
      this.body.add(leg, shoe);
    }
    // torso: broad shoulders tapering to the waist
    const torso = new THREE.Shape();
    torso.moveTo(-0.78, 2.42); torso.lineTo(0.78, 2.42); torso.lineTo(0.6, 1.08); torso.lineTo(-0.6, 1.08); torso.closePath();
    const torsoInk = new THREE.Shape();
    torsoInk.moveTo(-0.83, 2.47); torsoInk.lineTo(0.83, 2.47); torsoInk.lineTo(0.65, 1.03); torsoInk.lineTo(-0.65, 1.03); torsoInk.closePath();
    this.body.add(shapeMesh(torsoInk, INK, 0), shapeMesh(torso, suit, 0.002));
    this.rim.add(torsoInk, this.body, 0, 0, -0.03, 0.05);
    // shirt, tie, lapels and the name badge
    const shirt = new THREE.Shape();
    shirt.moveTo(-0.2, 2.42); shirt.lineTo(0.2, 2.42); shirt.lineTo(0, 1.7); shirt.closePath();
    this.body.add(shapeMesh(shirt, '#f2efe8', 0.004));
    this.body.add(shapeMesh(roundedRectShape(0.08, 0.6, 0.02, 0, 2.05), '#2a2a3a', 0.006));
    for (const side of [-1, 1]) {
      const lap = new THREE.Shape();
      lap.moveTo(side * 0.2, 2.42); lap.lineTo(side * 0.42, 2.42); lap.lineTo(side * 0.06, 1.62); lap.closePath();
      this.body.add(shapeMesh(lap, '#262335', 0.005));
    }
    const badge = staticPlane(0.42, 0.14, 300, (g, W, H) => {
      g.fillStyle = '#f0c75e'; g.beginPath(); g.roundRect(1, 1, W - 2, H - 2, 6); g.fill();
      g.fillStyle = '#2b1d16'; g.font = `800 ${H * 0.6}px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('HANDLER', W / 2, H * 0.55);
    });
    cutout(badge);
    badge.position.set(-0.42, 2.1, 0.008);
    this.body.add(badge);
    // head: bald, shades, earpiece with a coiled wire
    const neck = shapeMesh(roundedRectShape(0.34, 0.2, 0.05, 0, 2.5), skin, -0.001);
    const head = inkedRect(0.62, 0.62, 0.22, skin, 0.04);
    head.position.set(0, 2.82, 0.001);
    this.body.add(neck, head);
    this.rim.add(roundedRectShape(0.7, 0.7, 0.26), this.body, 0, 2.82, -0.02, 0.04);
    const shades = new THREE.Group();
    for (const side of [-1, 1]) {
      const lens = shapeMesh(roundedRectShape(0.24, 0.13, 0.05, side * 0.14, 0), '#06050a', 0.012);
      const glint = shapeMesh(roundedRectShape(0.05, 0.03, 0.01, side * 0.14 + 0.06, 0.03), ownGlow('#ffffff', 1.6), 0.014);
      shades.add(lens, glint);
    }
    shades.add(shapeMesh(roundedRectShape(0.62, 0.03, 0.01, 0, 0.03), '#06050a', 0.011));
    shades.position.set(0, 2.88, 0);
    this.body.add(shades);
    const ear = shapeMesh(circleShape(0.05), '#d8d8e0', 0.012, 10);
    ear.position.set(0.31, 2.8, 0.012);
    this.body.add(ear);
    for (let i = 0; i < 6; i++) {
      const coil = shapeMesh(arcShape(0.035, 0.012, 0, Math.PI * 1.7), '#d8d8e0', 0.012, 8);
      coil.position.set(0.33 + Math.sin(i) * 0.01, 2.72 - i * 0.06, 0.012);
      this.body.add(coil);
    }
    this.mouth = shapeMesh(roundedRectShape(0.18, 0.035, 0.015), INK, 0.012);
    this.mouth.position.set(0, 2.66, 0.012);
    this.body.add(this.mouth);
    // crossed arms (a single shape across the chest) and free arms for waving
    const fore = inkedRect(1.2, 0.3, 0.12, suit, 0.04);
    fore.position.set(0, 1.78, 0.02);
    const fore2 = inkedRect(1.0, 0.28, 0.12, '#1d1a29', 0.04);
    fore2.position.set(0.05, 1.92, 0.024);
    fore2.rotation.z = 0.08;
    const fists = [inkedCircle(0.13, skin, 0.03), inkedCircle(0.13, skin, 0.03)];
    fists[0].position.set(-0.55, 1.93, 0.03); fists[1].position.set(0.6, 1.8, 0.03);
    this.crossed.add(fore, fore2, ...fists);
    this.body.add(this.crossed);
    const arm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.72, 2.3, 0.015);
      const a = inkedRect(0.28, 1.05, 0.12, suit, 0.04);
      a.position.y = -0.5;
      const h = inkedCircle(0.15, skin, 0.03);
      h.position.set(0, -1.05, 0.004);
      pivot.add(a, h);
      this.body.add(pivot);
      return pivot;
    };
    this.armL = arm(-1);
    this.armR = arm(1);
  }

  set(s: SuspectState, t: number) {
    const flip = Math.cos(s.turn);
    this.root.scale.set((flip < 0 ? -1 : 1) * Math.max(0.08, Math.abs(flip)), 1, 1);
    this.body.position.y = s.bob;
    this.body.rotation.z = s.lean;
    // wag > 0: uncross and wave the right arm through ("come on in"); hold: arms posed directly
    // (0 = hanging down, positive = out to that side and up), for escorting someone out
    const wave = clamp(s.wag), hold = s.hold >= 0.5;
    this.crossed.visible = wave < 0.5 && !hold;
    this.armL.visible = this.armR.visible = wave >= 0.5 || hold;
    this.armL.rotation.z = hold ? -s.armL : -0.15;
    this.armR.rotation.z = hold ? s.armR : lerp(0.2, 1.7, wave) + Math.sin(t * 9) * 0.35 * wave;
    this.mouth.scale.x = 1 + s.mouth * 0.3;
    this.rim.set(s.rim, t);
  }
}

// ---------------------------------------------------------------------------------------------
/** The Cache: a green filing cabinet in a powder-blue leisure suit and gold shades. */
export class Cache {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private arms: THREE.Group[] = [];
  private finger: THREE.Group;
  private shades = new THREE.Group();
  private eyes: THREE.Mesh[];
  private brows: THREE.Mesh[] = [];
  private smirk: THREE.Mesh;
  private rim = new Rim();
  static readonly W = 1.05;
  static readonly H = 1.62;
  static readonly Y = 1.18;
  /** Where a held prop goes (the right hand, in the right arm's frame: +x runs along the arm). */
  readonly hand = new THREE.Group();
  /** Where the cuffs sit when cuffed (in body space). */
  static readonly CUFF_AT = new THREE.Vector3(0, 1.05, 0.06);

  constructor() {
    const { W, H, Y } = Cache;
    const steel = '#6f9a7c', steelDark = '#55806a', suit = '#86bde8', suitDark = '#5f9ccc';
    this.root.add(this.body);
    for (const side of [-1, 1]) {
      const leg = inkedRect(0.18, 0.3, 0.03, suitDark, 0.035);
      leg.position.set(side * 0.27, 0.27, -0.02);
      const shoe = inkedRect(0.34, 0.16, 0.05, '#f7f2e6', 0.035);   // white platforms
      shoe.position.set(side * 0.31, 0.08, 0.004);
      this.body.add(leg, shoe);
    }
    const cab = inkedRect(W, H, 0.02, steel, 0.05);
    cab.position.y = Y;
    this.body.add(cab);
    this.rim.add(roundedRectShape(W + 0.16, H + 0.1, 0.04), this.body, 0, Y, -0.06, 0.05);
    // three drawers with handles and label cards
    for (let i = 0; i < 3; i++) {
      const dy = Y + H / 2 - 0.27 - i * 0.54;
      this.body.add(shapeMesh(roundedRectShape(W - 0.14, 0.46, 0.03, 0, dy), steelDark, 0.003));
      this.body.add(shapeMesh(roundedRectShape(W - 0.2, 0.4, 0.03, 0, dy + 0.01), steel, 0.004));
      if (i > 0) {
        this.body.add(shapeMesh(roundedRectShape(0.3, 0.06, 0.03, 0, dy - 0.05), '#d9d4c5', 0.006));
        const card = shapeMesh(roundedRectShape(0.2, 0.09, 0.01, 0, dy + 0.08), '#f4ecd2', 0.006);
        this.body.add(card);
      }
    }
    // leisure suit: jacket panels down each side, big lapels, sleeves are the arms
    for (const side of [-1, 1]) {
      const panel = new THREE.Shape();
      const x0 = side * (W / 2 + 0.07), x1 = side * (W / 2 - 0.2);
      panel.moveTo(x0, Y + H / 2 - 0.42); panel.lineTo(x1, Y + H / 2 - 0.42); panel.lineTo(x1 + side * 0.05, Y - H / 2 + 0.02); panel.lineTo(x0, Y - H / 2 + 0.02); panel.closePath();
      const ink = new THREE.Shape();
      ink.moveTo(x0 + side * 0.04, Y + H / 2 - 0.38); ink.lineTo(x1 - side * 0.04, Y + H / 2 - 0.38); ink.lineTo(x1 + side * 0.01, Y - H / 2 - 0.02); ink.lineTo(x0 + side * 0.04, Y - H / 2 - 0.02); ink.closePath();
      this.body.add(shapeMesh(ink, INK, 0.008), shapeMesh(panel, suit, 0.009));
      const lap = new THREE.Shape();
      lap.moveTo(side * (W / 2 + 0.06), Y + H / 2 - 0.4); lap.lineTo(side * (W / 2 - 0.36), Y + H / 2 - 0.4); lap.lineTo(side * (W / 2 - 0.16), Y + 0.05); lap.closePath();
      this.body.add(shapeMesh(lap, suitDark, 0.011));
      // wide shirt collar over the lapel
      const col = new THREE.Shape();
      col.moveTo(side * 0.08, Y + H / 2 - 0.4); col.lineTo(side * 0.42, Y + H / 2 - 0.4); col.lineTo(side * 0.3, Y + H / 2 - 0.62); col.closePath();
      this.body.add(shapeMesh(col, '#fff2d6', 0.012));
    }
    const pocket = shapeMesh(roundedRectShape(0.16, 0.08, 0.02, W / 2 - 0.08, Y - 0.1), '#ff8fc8', 0.012);
    this.body.add(pocket);
    // face on the top drawer: eyes, brows and a smirk (the handle), under gold aviators
    this.eyes = eyes(this.body, 0.2, Y + H / 2 - 0.16, 0.013, 0.075, 0.1);
    for (const side of [-1, 1]) {
      const b = shapeMesh(roundedRectShape(0.16, 0.035, 0.015), INK, 0.013);
      b.position.set(side * 0.2, Y + H / 2 - 0.04, 0.013);
      this.body.add(b);
      this.brows.push(b);
    }
    this.smirk = shapeMesh(arcShape(0.13, 0.04, Math.PI * 1.15, Math.PI * 1.75), '#e8e2d0', 0.013, 10);
    this.smirk.position.set(0.04, Y + H / 2 - 0.25, 0.013);
    this.body.add(this.smirk);
    for (const side of [-1, 1]) {
      const lens = inkedRect(0.3, 0.17, 0.06, '#1a0f2e', 0.03, PAL.chain);
      lens.position.x = side * 0.2;
      const shine = shapeMesh(roundedRectShape(0.09, 0.03, 0.01, side * 0.2 - 0.05, 0.04), ownGlow('#ffffff', 1.8), 0.006);
      this.shades.add(lens, shine);
    }
    this.shades.add(shapeMesh(roundedRectShape(0.14, 0.03, 0.01, 0, 0.05), PAL.chain, 0.004));
    this.body.add(this.shades);
    // arms: blue sleeves, white cuffs, hands; the right hand can wag a finger
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (W / 2 + 0.04), Y + 0.32, -0.006);
      const sleeve = inkedRect(0.5, 0.22, 0.08, suit, 0.035);
      sleeve.position.x = side * 0.22;
      const cuff = shapeMesh(roundedRectShape(0.07, 0.22, 0.02, side * 0.46, 0), '#fff2d6', 0.004);
      const hand = inkedCircle(0.11, '#f0f0f5', 0.03);
      hand.position.set(side * 0.56, 0, 0.004);
      pivot.add(sleeve, cuff, hand);
      this.body.add(pivot);
      this.arms.push(pivot);
    }
    this.finger = new THREE.Group();
    const f = inkedRect(0.06, 0.2, 0.03, '#f0f0f5', 0.025);
    f.position.y = 0.12;
    this.finger.add(f);
    this.finger.position.set(0.56, 0.06, 0.008);
    this.arms[1].add(this.finger);
    this.hand.position.set(0.58, 0, 0.02);
    this.arms[1].add(this.hand);
  }

  set(s: SuspectState, t: number) {
    const { H, Y } = Cache;
    const flip = Math.cos(s.turn);
    this.root.scale.set((flip < 0 ? -1 : 1) * Math.max(0.08, Math.abs(flip)), 1, 1);
    this.body.position.y = s.bob;
    this.body.rotation.z = s.lean;
    this.body.scale.set(1 + s.squash * 0.1, 1 - s.squash * 0.12, 1);
    const wag = clamp(s.wag), cuff = clamp(s.cuffs);
    // wagging: the right forearm up, the finger ticking side to side on the beat; cuffed: both
    // paws down and together in front (a cuffed Cache can still wag that finger)
    const aL = lerp(s.armL, -2.2, cuff), aR = lerp(lerp(s.armR, 1.45, wag), -2.2, cuff);
    this.arms[0].rotation.z = -aL;
    this.arms[1].rotation.z = aR;
    this.arms.forEach((a, i) => {
      a.position.x = (i ? 1 : -1) * (Cache.W / 2 + 0.04 - cuff * 0.1);
      a.position.z = cuff > 0.5 ? 0.03 : -0.006;
    });
    this.finger.visible = wag > 0.05;
    this.finger.rotation.z = -aR + Math.sin(t * Math.PI * 2 * 2.15) * 0.45 * wag;
    // shades slide down the face to peer over
    const down = clamp(s.shades);
    this.shades.position.set(0, Y + H / 2 - 0.16 - down * 0.13, 0.02);
    this.shades.rotation.z = down * -0.05;
    const open = clamp(s.open, 0, 1.4);
    this.eyes.forEach((e, i) => { e.scale.set(1, Math.max(0.1, open), 1); e.position.x = (i ? 1 : -1) * 0.2 + s.look * 0.04; e.position.y = Y + H / 2 - 0.16 + down * 0.03; });
    this.brows.forEach((b, i) => { b.position.y = Y + H / 2 - 0.04 + s.brow * 0.04 + down * 0.02; b.rotation.z = (i ? -1 : 1) * s.brow * -0.25; });
    this.smirk.rotation.z = s.mouth * 0.2;
    this.rim.set(s.rim, t);
  }
}

// ---------------------------------------------------------------------------------------------
/** The Field: one tiny `"v": 2` on a pale tag, with huge eyes. Nobody notices it until the end. */
export class Field {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private pupils: THREE.Mesh[] = [];
  private lids: THREE.Mesh[] = [];
  private rim = new Rim();

  constructor() {
    this.root.add(this.body);
    for (const side of [-1, 1]) {
      const leg = inkedRect(0.05, 0.12, 0.02, '#e0c56a', 0.02);
      leg.position.set(side * 0.1, 0.06, -0.01);
      this.body.add(leg);
    }
    const tag = inkedRect(0.56, 0.3, 0.07, '#fff1b8', 0.035);
    tag.position.y = 0.27;
    this.body.add(tag);
    this.rim.add(roundedRectShape(0.64, 0.38, 0.1), this.body, 0, 0.27, -0.02, 0.03);
    const txt = staticPlane(0.52, 0.22, 400, (g, W, H) => {
      g.fillStyle = '#2b1d16'; g.font = `700 ${H * 0.62}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('"v": 2', W / 2, H * 0.55);
    });
    cutout(txt);
    txt.position.set(0, 0.25, 0.006);
    this.body.add(txt);
    for (const side of [-1, 1]) {
      const eye = inkedCircle(0.1, '#ffffff', 0.025);
      eye.position.set(side * 0.11, 0.52, 0.002);
      const pupil = shapeMesh(circleShape(0.055), INK, 0.008, 14);
      pupil.position.set(side * 0.11, 0.51, 0.008);
      const shine = shapeMesh(circleShape(0.018), '#ffffff', 0.01, 8);
      shine.position.set(0.02, 0.025, 0.002);
      pupil.add(shine);
      const lid = shapeMesh(roundedRectShape(0.24, 0.1, 0.04), '#fff1b8', 0.012);
      lid.position.set(side * 0.11, 0.6, 0.012);
      this.body.add(eye, pupil, lid);
      this.pupils.push(pupil);
      this.lids.push(lid);
    }
  }

  set(s: SuspectState, t: number) {
    this.body.position.y = s.bob;
    this.body.rotation.z = s.lean;
    this.body.scale.set(1 + s.squash * 0.12, 1 - s.squash * 0.15, 1);
    this.pupils.forEach((p, i) => { p.position.x = (i ? 1 : -1) * 0.11 + s.look * 0.035; });
    // blinks every few seconds (from t, so it's deterministic)
    const blink = (t % 3.1) < 0.12 ? 1 : 0;
    const shut = Math.max(blink, clamp(1 - s.open));
    this.lids.forEach(l => { l.visible = shut > 0.05; l.scale.y = shut; l.position.y = 0.6 - shut * 0.04; });
    this.rim.set(s.rim, t);
  }
}
