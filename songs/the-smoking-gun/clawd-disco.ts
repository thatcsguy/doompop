// DJ Detective Clawd: the shared Clawd rig (engine/characters/clawd.ts) plus this song's
// accessories, layered on without editing the rig: a big afro, 70s shades, a gold chain with a
// medallion, a two-tone neon rim light and a soft halo, so he never disappears into the dark club.
//
// Call set(mood, pose, look, t) every frame: it sets every property it touches.
// Origin is between his feet, as for the rig. Body top is at y = 1.02; the afro reaches ~2.05.
import * as THREE from 'three';
import { Clawd, MOODS, REST, mixMood, type Mood, type Pose } from '../../engine/characters/clawd';
import { INK, arcShape, circleShape, halfShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh } from '../../engine/flat';
import { clamp, decay, lerp } from '../../engine/ease';
import { hash, noise1 } from '../../engine/rng';
import { PAL, glowMat, halo, ownGlow, setGlow } from './look';

const BODY_Y = 0.62, W = 1.3, H = 0.8;           // must match the rig (engine/characters/clawd.ts)
const AFRO = { x: 0, y: 1.22, rx: 0.93, ry: 0.8 };
const EYE_Y = BODY_Y + 0.08;
/** Disco arms are longer than the rig's side nubs, so a raised paw clears the body top. */
export const ARM_LEN = 0.5;

/** Moods for this song, on top of the rig's own. Clawd is never sad in this one. */
export const DISCO_MOODS: Record<string, Mood> = {
  ...MOODS,
  cool:       { happy: 0, open: 1, droop: 0, blush: 0, sweat: 0, jitter: 0, grey: 0, squint: 0.35, brow: -0.25 },
  smug:       { happy: 0, open: 0.8, droop: 0, blush: 0.35, sweat: 0, jitter: 0, grey: 0, squint: 0.55, brow: -0.45 },
  certain:    { happy: 0, open: 1.05, droop: 0, blush: 0.2, sweat: 0, jitter: 0, grey: 0, squint: 0.4, brow: -0.9 },
  triumphant: { happy: 1, open: 1, droop: 0, blush: 0.6, sweat: 0, jitter: 0, grey: 0, squint: 0, brow: 0 },
  baffled:    { happy: 0, open: 1.35, droop: 0, blush: 0, sweat: 0.7, jitter: 0.25, grey: 0, squint: 0, brow: 0.9 },
  ohno:       { happy: 0, open: 1.6, droop: 0.15, blush: 0, sweat: 1, jitter: 0.6, grey: 0.15, squint: 0, brow: 1 },
  sheepish:   { happy: 0.6, open: 0.8, droop: 0.1, blush: 0.9, sweat: 0.4, jitter: 0, grey: 0, squint: 0, brow: 0.5 },
  eager:      { happy: 1, open: 1.1, droop: 0, blush: 0.4, sweat: 0, jitter: 0.1, grey: 0, squint: 0, brow: 0 },
};

/** Song-specific controls, all 0..1 unless noted. */
export interface DiscoLook {
  shades: number;   // 0 = pushed up into the afro, 1 = on, 2 = slid down (peering over them)
  puff: number;     // afro grows when he's certain
  flat: number;     // afro squashes flat when he's proved wrong
  jiggle: number;   // -1..1 afro secondary bounce (from dance())
  spin: number;     // afro rotation, radians
  rim: number;      // rim light strength (0 = off, 1 = normal)
  rimL: string;     // rim colour from the left
  rimR: string;     // rim colour from the right
  halo: number;     // soft glow behind him
  medal: number;    // medallion glint, 0..1
  prop: 'none' | 'magnifier' | 'flag' | 'gun' | 'mic';
  propK: number;    // prop scale (0 hidden .. 1)
  cross: number;    // arms folded across his front (above 0.5; the side arms and any prop hide)
}
export const LOOK: DiscoLook = {
  shades: 1, puff: 0, flat: 0, jiggle: 0, spin: 0, rim: 1, rimL: PAL.pink, rimR: PAL.cyan, halo: 0.6, medal: 0,
  prop: 'none', propK: 1, cross: 0,
};

/** The scalloped afro outline: an ellipse with rounded lobes and soft cusps between them. */
function afroShape(grow = 0, lobes = 15, bump = 0.075): THREE.Shape {
  const s = new THREE.Shape();
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lobe = Math.pow(Math.abs(Math.sin((a * lobes) / 2 + 0.4)), 0.55);
    const rx = AFRO.rx + grow - bump + bump * lobe, ry = AFRO.ry + grow - bump + bump * lobe;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

export class DiscoClawd {
  readonly rig = new Clawd();
  readonly root: THREE.Group;
  /** The rig's body group: everything here moves with his bounce, squash and lean. */
  private body: THREE.Group;
  private armPivots: THREE.Group[];
  private afro = new THREE.Group();
  private afroInner = new THREE.Group();
  private rims: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; side: number; base: THREE.Vector2 }[] = [];
  private shades = new THREE.Group();
  private glints: THREE.MeshBasicMaterial;
  private medalGlint: THREE.MeshBasicMaterial;
  private haloMesh: THREE.Mesh;
  private props: Record<string, THREE.Group> = {};
  private crossed = new THREE.Group();

  constructor() {
    this.root = this.rig.root;
    // The rig keeps its parts private; reach the two we attach to by name and fail loudly if they move.
    const parts = this.rig as unknown as { body?: THREE.Group; arms?: THREE.Group[]; bodyFill?: THREE.MeshBasicMaterial; shadeFill?: THREE.MeshBasicMaterial };
    if (!parts.body || !parts.arms || parts.arms.length !== 2 || !parts.bodyFill || !parts.shadeFill) throw new Error('Clawd rig changed: body/arms/bodyFill/shadeFill not found');
    this.body = parts.body;
    this.armPivots = parts.arms;

    // disco arms: the rig's nubs swapped for longer ones (same fill, so they grey with his mood)
    // on a slightly higher shoulder, so the Saturday-night point actually shows above his body
    this.armPivots.forEach((pivot, i) => {
      const side = i ? 1 : -1;
      pivot.position.y = BODY_Y + 0.08;
      for (const c of pivot.children) c.visible = false;
      const arm = inkedRect(ARM_LEN, 0.2, 0.01, parts.bodyFill!, 0.04);
      arm.position.x = side * (ARM_LEN / 2 - 0.03);
      pivot.add(arm);
    });

    // halo behind everything
    this.haloMesh = halo(1.5, PAL.pink, 0.35);
    this.haloMesh.position.set(0, 1.05, -0.3);
    this.root.add(this.haloMesh);

    // --- afro: behind the torso, so the body's top edge cuts across its lower half
    this.afro.position.set(AFRO.x, AFRO.y, -0.03);
    this.afro.add(this.afroInner);
    const outline = shapeMesh(afroShape(0.045), INK, 0, 1);
    const fill = shapeMesh(afroShape(0), PAL.afro, 0.002, 1);
    // a darker band low down and lighter fluff up top (cel shading), then curl marks for texture
    const shade = shapeMesh(afroShape(-0.02), PAL.afroShade, 0.004, 1);
    shade.scale.set(0.98, 0.62, 1);
    shade.position.y = -0.3;
    // a crescent of light fluff along the upper left, where the pink light comes from
    const lit = shapeMesh(arcShape(0.62, 0.13, Math.PI * 0.52, Math.PI * 0.9), PAL.afroLight, 0.005, 24);
    lit.scale.set(AFRO.rx / 0.74, AFRO.ry / 0.74, 1);
    this.afroInner.add(outline, fill, shade, lit);
    for (let i = 0; i < 26; i++) {
      const a = hash(i, 11) * Math.PI * 2, r = 0.15 + Math.sqrt(hash(i, 12)) * 0.68;
      const cx = Math.cos(a) * r * AFRO.rx, cy = Math.sin(a) * r * AFRO.ry;
      if (cy < -0.3) continue; // hidden behind the body anyway
      const curl = shapeMesh(arcShape(0.055 + hash(i, 13) * 0.035, 0.026, 0.4, 2.7), cy > 0.25 ? '#6e412d' : '#4f2d1f', 0.006, 8);
      curl.position.set(cx, cy, 0.006);
      curl.rotation.z = hash(i, 14) * Math.PI * 2;
      this.afroInner.add(curl);
    }
    this.body.add(this.afro);

    // --- rim light: silhouette copies offset left and right, just behind the ink outlines. Each
    // copy is cut at his centre line (pink left, cyan right), overlapping a hair there with cyan a
    // step behind, so the two never share a depth where both show (that z-fought and flickered)
    const addRim = (shape: THREE.Shape, side: number, base: THREE.Vector2, z: number, parent: THREE.Object3D) => {
      const mat = ownGlow(side < 0 ? PAL.pink : PAL.cyan, 1.4);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(halfShape(shape, side, -base.x - side * 0.01), 1), mat);
      mesh.position.set(base.x, base.y, z - (side > 0 ? 0.004 : 0));
      parent.add(mesh);
      this.rims.push({ mesh, mat, side, base });
    };
    for (const side of [-1, 1]) {
      addRim(afroShape(0.06), side, new THREE.Vector2(side * 0.055, 0.03), -0.012, this.afroInner);
      addRim(roundedRectShape(W + 0.12, H + 0.12, 0.03), side, new THREE.Vector2(side * 0.045, BODY_Y + 0.0), -0.06, this.body);
    }

    // --- shades: blocky lenses in a gold frame, with a neon reflection stripe and a glint
    this.glints = ownGlow('#ffffff', 2.5);
    const lens = (x: number) => {
      const g = new THREE.Group();
      g.position.x = x;
      g.add(inkedRect(0.36, 0.27, 0.02, PAL.chain, 0.03));
      const glass = shapeMesh(roundedRectShape(0.3, 0.21, 0.015), '#150b2a', 0.004);
      const stripe = new THREE.Shape();
      stripe.moveTo(-0.15, -0.02); stripe.lineTo(-0.02, 0.105); stripe.lineTo(0.06, 0.105); stripe.lineTo(-0.15, -0.1); stripe.closePath();
      const stripeMesh = shapeMesh(stripe, '#5b3aa8', 0.006);
      const band = shapeMesh(roundedRectShape(0.3, 0.05, 0, 0, -0.08), '#3a1f6e', 0.005);
      const glint = shapeMesh(roundedRectShape(0.05, 0.05, 0.01, 0.09, 0.06), this.glints, 0.008);
      g.add(glass, band, stripeMesh, glint);
      return g;
    };
    this.shades.add(lens(-0.27), lens(0.27));
    const bridge = inkedRect(0.2, 0.05, 0.01, PAL.chain, 0.02);
    bridge.position.set(0, 0.06, 0.001);
    this.shades.add(bridge);
    for (const side of [-1, 1]) {
      const temple = inkedRect(0.16, 0.045, 0.01, PAL.chain, 0.02);
      temple.position.set(side * 0.53, 0.07, -0.006); // behind the lens frame (at -0.002 its fill tied with the frame's outline)
      this.shades.add(temple);
    }
    this.body.add(this.shades);

    // --- gold chain with a medallion, hanging across the lower body
    const chain = new THREE.Group();
    const N = 13;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1), x = lerp(-0.44, 0.44, k), y = 0.5 - 0.17 * Math.sin(k * Math.PI);
      const link = inkedCircle(0.032, PAL.chain, 0.014);
      link.position.set(x, y, 0.016 + i * 0.0001);
      chain.add(link);
    }
    const medal = inkedCircle(0.11, PAL.chain, 0.025);
    medal.position.set(0, 0.25, 0.02);
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.032 : 0.075;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const starMesh = shapeMesh(star, PAL.chainShade, 0.024);
    starMesh.position.set(0, 0.25, 0.024);
    this.medalGlint = ownGlow('#ffffff', 3);
    const glintMesh = shapeMesh(roundedRectShape(0.035, 0.035, 0.01, 0, 0), this.medalGlint, 0.026);
    glintMesh.position.set(0.045, 0.29, 0.026);
    glintMesh.rotation.z = Math.PI / 4;
    chain.add(medal, starMesh, glintMesh);
    this.body.add(chain);

    // --- props held in the right paw (the arm pivot's frame: +x points along the arm)
    const paw = this.armPivots[1];
    this.props.magnifier = (() => {
      const g = new THREE.Group();
      const handle = inkedRect(0.36, 0.08, 0.02, '#7a4a2a', 0.025);
      handle.position.set(0.32, 0, 0.03);
      // ring stack in front of the handle (the ink ring tied with the handle's fill)
      const glass = shapeMesh(circleShape(0.21), ownMat('#9fe8ff', 0.22, true), 0.034, 24);
      const inkRing = shapeMesh(arcShape(0.22, 0.1, 0, Math.PI * 2), INK, 0.036, 32);
      const ring = shapeMesh(arcShape(0.22, 0.055, 0, Math.PI * 2), PAL.chain, 0.04, 32);
      const shine = shapeMesh(arcShape(0.13, 0.035, 1.9, 2.9), ownGlow('#ffffff', 1.6), 0.044, 8);
      for (const m of [glass, inkRing, ring, shine]) m.position.x = 0.7;
      g.add(handle, glass, inkRing, ring, shine);
      return g;
    })();
    this.props.flag = (() => {
      const g = new THREE.Group();
      const stick = inkedRect(0.04, 0.7, 0.01, '#d9c7a8', 0.02);
      stick.position.set(0.24, 0.3, 0.03);
      const cloth = inkedRect(0.3, 0.2, 0.01, PAL.red, 0.02);
      cloth.position.set(0.41, 0.55, 0.036); // in front of the stick it hangs from
      g.add(stick, cloth);
      return g;
    })();
    this.props.mic = (() => {
      const g = new THREE.Group();
      const handle = inkedRect(0.3, 0.09, 0.03, '#2b2b3a', 0.025);
      handle.position.set(0.3, 0, 0.03);
      const head = inkedCircle(0.1, '#c9c9d6', 0.025);
      head.position.set(0.5, 0, 0.035);
      g.add(handle, head);
      return g;
    })();
    // folded arms: two forearms across the bottom of his front, the far one in shadow, under the
    // chain (so the medallion hangs over them) and clear of his eyes and cheeks
    const fold = (fill: THREE.MeshBasicMaterial, y: number, rot: number, z: number) => {
      const a = inkedRect(1.02, 0.17, 0.01, fill, 0.035);
      a.position.set(0, y, z);
      a.rotation.z = rot;
      this.crossed.add(a);
    };
    fold(parts.shadeFill, 0.34, -0.13, 0.011);
    fold(parts.bodyFill, 0.31, 0.13, 0.0135);
    this.crossed.visible = false;
    this.body.add(this.crossed);

    this.props.gun = new THREE.Group(); // the smoking gun prop lives in props.ts; shots attach it here
    for (const g of Object.values(this.props)) { g.visible = false; g.position.x = ARM_LEN - 0.3; paw.add(g); }
  }

  /** Where to attach a held prop (the right arm's pivot; +x runs along the arm, the paw is at x = ARM_LEN). */
  get paw(): THREE.Group { return this.armPivots[1]; }
  get pawL(): THREE.Group { return this.armPivots[0]; }
  /** The afro group (for shots that pull things out of it or pop things over it). */
  get afroGroup(): THREE.Group { return this.afro; }
  /** The flag's free bottom corner in world space (call after set() and a matrix update). */
  flagCorner(out: THREE.Vector3) { return this.props.flag.localToWorld(out.set(0.56, 0.45, 0.03)); }

  set(mood: Mood, pose: Pose, look: Partial<DiscoLook>, t: number) {
    const L = { ...LOOK, ...look };
    this.rig.setMood(mood, t);
    this.rig.setPose(pose);

    // afro: grows when certain, squashes flat when proved wrong, lags the body's bounce
    const puff = 1 + 0.12 * L.puff, flat = clamp(L.flat);
    const sy = puff * (1 - 0.42 * flat) * (1 + 0.07 * L.jiggle), sx = puff * (1 + 0.16 * flat) * (1 - 0.04 * L.jiggle);
    this.afro.scale.set(sx, sy, 1);
    this.afro.position.set(AFRO.x, AFRO.y - 0.2 * flat + (puff - 1) * 0.35, -0.03);
    this.afroInner.rotation.z = L.spin;

    // rim light, two-tone, with a slow shimmer from the club lights
    const shimmer = 0.85 + 0.15 * noise1(t * 1.7, 5);
    for (const r of this.rims) {
      r.mesh.visible = L.rim > 0.01;
      setGlow(r.mat, r.side < 0 ? L.rimL : L.rimR, 1.5 * L.rim * shimmer);
    }
    this.haloMesh.visible = L.halo > 0.01;
    (this.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0.32 * L.halo;
    (this.haloMesh.material as THREE.MeshBasicMaterial).color.set(L.rimL);

    // shades: on the eyes (1), up in the afro (0) or slid down (2)
    const s = L.shades;
    const up = clamp(1 - s), down = clamp(s - 1);
    this.shades.visible = true;
    this.shades.position.set(0, EYE_Y + up * 0.6 - down * 0.13, 0.02);
    this.shades.rotation.z = up * 0.12;
    this.shades.scale.setScalar(1 - up * 0.08);
    // when pushed up they sit in front of the afro; on the face they cover the eyes
    this.shades.renderOrder = 0;
    setGlow(this.glints, '#ffffff', 1.6 + 1.2 * (0.5 + 0.5 * Math.sin(t * 2.3)));
    setGlow(this.medalGlint, '#ffffff', 0.6 + 2.6 * L.medal);

    for (const [name, g] of Object.entries(this.props)) {
      const on = name === L.prop && L.propK > 0.01;
      g.visible = on;
      if (on) g.scale.setScalar(L.propK);
    }
    const folded = L.cross > 0.5;
    this.crossed.visible = folded;
    this.armPivots.forEach(p => { p.visible = !folded; });
  }
}

export { REST, mixMood };
export type { Mood, Pose };

// ---------------------------------------------------------------------------------------------
// Dancing. Each move is a pure function of the fractional beat number b.

export type Move = 'point' | 'bounce' | 'side' | 'roll' | 'spin' | 'shimmy' | 'groove' | 'still';

export interface DanceOut { pose: Pose; x: number; y: number; jiggle: number }

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });

/** A hop that lands on every beat: height 0..1 and a landing squash. */
function beatHopCurve(ph: number) {
  const h = 4 * ph * (1 - ph);
  const land = decay(ph, 0.07) + decay(1 - ph, 0.04) * 0.3;
  return { h, land };
}

export function dance(move: Move, b: number, energy = 1): DanceOut {
  if (b < 0) b = 0;
  const n = Math.floor(b), ph = b - n;
  const e = energy;
  switch (move) {
    case 'point': {
      // Saturday-night point: one paw up to the sky, hip out the other way, switching every 2 beats
      const half = Math.floor(b / 2) % 2 ? 1 : -1;
      const k = (b / 2) - Math.floor(b / 2);            // 0..1 through the 2-beat hold
      const snap = clamp(k / 0.12);                      // quick change at the start of each hold
      const { h, land } = beatHopCurve(ph);
      const up = 1.1 * snap, down = -0.7 * snap;
      return {
        pose: P({ armR: half > 0 ? up : down, armL: half > 0 ? down : up, lean: -half * 0.16 * snap * e, squash: land * 0.35 * e, bounce: h * 0.12 * e }),
        x: half * 0.08 * e, y: 0, jiggle: Math.cos(ph * Math.PI * 2 + 0.6) * e,
      };
    }
    case 'bounce': {
      const { h, land } = beatHopCurve(ph);
      const pump = Math.sin(ph * Math.PI);
      return { pose: P({ bounce: h * 0.5 * e, squash: land * 0.6 * e - (1 - land) * 0.15 * h * e, armL: 0.3 + pump * 1.0 * e, armR: 0.3 + pump * 1.0 * e }), x: 0, y: 0, jiggle: Math.cos(ph * Math.PI * 2 + 0.7) * e };
    }
    case 'side': {
      const dir = n % 2 ? 1 : -1;
      const step = Math.sin(clamp(ph / 0.5) * Math.PI / 2);
      const x = dir * (0.18 * step - 0.18 * (1 - step)) * e;
      return { pose: P({ lean: -dir * 0.14 * e, armL: 0.4 + (dir > 0 ? 0.8 : 0) * e, armR: 0.4 + (dir < 0 ? 0.8 : 0) * e, squash: decay(ph, 0.06) * 0.3 * e, walk: b * 0.5 }), x, y: 0, jiggle: Math.sin(ph * Math.PI * 2) * 0.6 * e };
    }
    case 'roll': {
      // the hustle roll: paws circle round each other twice a beat
      const a = b * Math.PI * 2 * 2;
      const { h, land } = beatHopCurve(ph);
      return { pose: P({ armL: 0.7 + Math.sin(a) * 0.6 * e, armR: 0.7 + Math.sin(a + Math.PI) * 0.6 * e, bounce: h * 0.15 * e, squash: land * 0.3 * e, lean: Math.sin(b * Math.PI) * 0.08 * e }), x: 0, y: 0, jiggle: Math.cos(ph * Math.PI * 2) * 0.7 * e };
    }
    case 'spin': {
      // one full paper-puppet turn per bar, arms out
      const turn = ((b / 4) % 1) * Math.PI * 2;
      const { land } = beatHopCurve(ph);
      return { pose: P({ turn, armL: 1.1 * e, armR: 1.1 * e, squash: land * 0.25 * e }), x: 0, y: 0, jiggle: Math.sin(turn) * e };
    }
    case 'shimmy': {
      const w = Math.sin(b * Math.PI * 8);
      return { pose: P({ lean: w * 0.07 * e, armL: 0.9 + w * 0.25 * e, armR: 0.9 - w * 0.25 * e, squash: 0.08 * Math.sin(b * Math.PI * 4) * e }), x: w * 0.03 * e, y: 0, jiggle: w * 0.5 * e };
    }
    case 'groove': {
      // easy two-step with a nod: the default "just vibing" move
      const dir = Math.sin(b * Math.PI);
      const { land } = beatHopCurve(ph);
      return { pose: P({ lean: dir * 0.1 * e, armL: 0.35 + Math.max(0, dir) * 0.7 * e, armR: 0.35 + Math.max(0, -dir) * 0.7 * e, squash: land * 0.35 * e, bounce: 0.06 * Math.sin(ph * Math.PI) * e }), x: dir * 0.1 * e, y: 0, jiggle: Math.cos(ph * Math.PI * 2 + 0.5) * 0.8 * e };
    }
    default:
      return { pose: P({}), x: 0, y: 0, jiggle: 0 };
  }
}

/** Blend two dance outputs (for changing moves without a pop). */
export function mixDance(a: DanceOut, b: DanceOut, k: number): DanceOut {
  k = clamp(k);
  const pose = {} as Pose;
  for (const key of Object.keys(a.pose) as (keyof Pose)[]) pose[key] = lerp(a.pose[key], b.pose[key], k);
  return { pose, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), jiggle: lerp(a.jiggle, b.jiggle, k) };
}
