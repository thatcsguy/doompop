// Chorus 2's suspect: the handler path from verse 1, out of its coil and laid right across the
// dance floor. A glowing cyan cable with a plug for a head at one end (the back left of the floor)
// and the tiny Field tied to its tail at the other (the front right, behind wherever the Cache is
// standing). Packets of light run along it from the tail to the head, which is the whole story if
// you look for it. In the pause its head rears up like a cobra in the spotlight, a smoking revolver
// hooked on one prong. set(t, view) sets everything it animates from song time and the view.
import * as THREE from 'three';
import { INK, circleShape, inkedCircle, inkedRect, roundedRectShape, shapeMesh } from '../../engine/flat';
import { clamp, lerp, smooth } from '../../engine/ease';
import { PAL, lightMat, ownGlow, setGlow } from './look';
import { Revolver } from './evidence';

/** The cable's route over the floor (x, z): from the tail (behind the Cache's spot, front right)
 *  through the middle of the floor, just in front of Clawd's mark, to the head end at the back left. */
export const ROUTE: [number, number][] = [
  [5.0, -0.1], [4.3, -0.45], [3.4, -0.25], [2.5, -0.55], [1.4, -0.2], [0.35, -0.05],
  [-0.7, -0.55], [-1.5, -1.5], [-1.65, -2.55], [-2.3, -3.6], [-3.0, -4.3], [-3.5, -4.85],
];
/** The floor run as a curve, tail (0) to head (1), at the cable's height. */
export const routeCurve = () => new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, CABLE_R, z)), false, 'centripetal');
/** Where Clawd slams the coil down; the cable unspools both ways from this ROUTE point. */
export const SLAM_I = 5;
/** Cable radius. */
export const CABLE_R = 0.055;
/** Length of the neck that rears up beyond the end of ROUTE. */
const NECK = 1.9;
const NECK_SEGS = 48, RADIAL = 6;
/** The plug head is drawn bigger than a real plug, so its face reads at a distance. */
const HEAD_SCALE = 1.5;
const PACKETS = 5;

export interface PathView {
  reveal: number;   // 0..1 how far it has unspooled from the slam point, both ways at once
  rear: number;     // 0 the head lies flat on the floor .. 1 reared up like a cobra
  up: number;       // 0..1 from the cobra pose to bolt upright ("hands up")
  sway: number;     // cobra sway amount, 0..1
  look: number;     // pupils -1..1
  open: number;     // eyes 0 shut .. 1 open .. 1.4 wide
  shifty: number;   // 0..1 the brows tilt in, guilty
  gun: boolean;     // the revolver hooked on the right prong
  twirl: number;    // the revolver's angle about the prong (0 hangs straight down)
  glow: number;     // cable brightness, 1 = normal
  packets: number;  // 0..1 the packets of light running from the tail to the head
  fwd?: THREE.Vector3;   // the way the reared head faces (default +z, toward the usual camera)
}
export const PATH_REST: PathView = { reveal: 1, rear: 0, up: 0, sway: 0, look: 0, open: 1, shifty: 0, gun: false, twirl: 0, glow: 1, packets: 1 };
export const pv = (p: Partial<PathView>): PathView => ({ ...PATH_REST, ...p });

const Y_UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();

export class HandlerPath {
  readonly root = new THREE.Group();
  /** The plug: local +y runs out along the cable, +z is its face (eyes). */
  readonly head = new THREE.Group();
  readonly gun = new Revolver();
  private twirl = new THREE.Group();
  private coreMat = ownGlow(PAL.cyan, 2.2);
  private haloMat = lightMat(PAL.cyan, 0.16);
  private halves: { core: THREE.Mesh; halo: THREE.Mesh; segs: number }[] = [];
  /** The whole floor run, tail (0) to head (1). */
  readonly full: THREE.CatmullRomCurve3;
  private neckCore: THREE.Mesh;
  private neckHalo: THREE.Mesh;
  private neckCurve: THREE.CatmullRomCurve3;
  private neckPts: THREE.Vector3[] = [];
  private base: THREE.Vector3;
  private dir: THREE.Vector3;
  private side: THREE.Vector3;
  private pupils: THREE.Mesh[] = [];
  private lids: THREE.Mesh[] = [];
  private brows: THREE.Mesh[] = [];
  private packets: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private qa = new THREE.Quaternion();
  private qb = new THREE.Quaternion();

  constructor() {
    const pts = ROUTE.map(([x, z]) => new THREE.Vector3(x, CABLE_R, z));
    this.full = routeCurve();
    // two halves from the slam point outward, so it can unspool both ways at once
    for (const run of [pts.slice(0, SLAM_I + 1).reverse(), pts.slice(SLAM_I)]) {
      const curve = new THREE.CatmullRomCurve3(run, false, 'centripetal');
      const segs = Math.round(curve.getLength() * 26);
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, CABLE_R, RADIAL, false), this.coreMat);
      const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, CABLE_R * 3, RADIAL, false), this.haloMat);
      this.root.add(core, halo);
      this.halves.push({ core, halo, segs });
    }
    // the neck: rebuilt from its pose every frame (same vertex count, so the buffers stay put)
    const n = pts.length;
    this.base = pts[n - 1].clone();
    this.dir = pts[n - 1].clone().sub(pts[n - 2]).setY(0).normalize();
    this.side = new THREE.Vector3(this.dir.z, 0, -this.dir.x);
    for (let i = 0; i < 7; i++) this.neckPts.push(this.base.clone().addScaledVector(this.dir, (i / 6) * NECK));
    this.neckCurve = new THREE.CatmullRomCurve3(this.neckPts, false, 'centripetal');
    this.neckCore = new THREE.Mesh(new THREE.TubeGeometry(this.neckCurve, NECK_SEGS, CABLE_R, RADIAL, false), this.coreMat);
    this.neckHalo = new THREE.Mesh(new THREE.TubeGeometry(this.neckCurve, NECK_SEGS, CABLE_R * 3, RADIAL, false), this.haloMat);
    this.neckCore.frustumCulled = this.neckHalo.frustumCulled = false;
    this.root.add(this.neckCore, this.neckHalo);
    this.buildHead();
    this.root.add(this.head);
    for (let i = 0; i < PACKETS; i++) {
      const mat = ownGlow('#e8fdff', 2.6);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(CABLE_R * 1.9, 12, 8), mat);
      this.root.add(mesh);
      this.packets.push({ mesh, mat });
    }
  }

  private buildHead() {
    // a white plug, so the head reads against the dark club
    const plastic = '#ece6f3', dark = '#b4abc6', brass = '#e8bd4f';
    const relief = inkedRect(0.12, 0.16, 0.03, dark, 0.03);
    relief.position.set(0, 0.06, 0);
    const body = inkedRect(0.32, 0.36, 0.06, plastic, 0.035);
    body.position.set(0, 0.3, 0.002);
    const plate = shapeMesh(roundedRectShape(0.24, 0.06, 0.02, 0, 0.45), dark, 0.006);
    this.head.add(relief, body, plate);
    for (const side of [-1, 1]) {
      const prong = inkedRect(0.055, 0.17, 0.012, brass, 0.022);
      prong.position.set(side * 0.075, 0.56, -0.004);
      this.head.add(prong);
      // big round cartoon eyes, lids and a brow each
      const eye = inkedCircle(0.068, '#ffffff', 0.022);
      eye.position.set(side * 0.074, 0.29, 0.01);
      const pupil = shapeMesh(circleShape(0.034), INK, 0.016, 12);
      pupil.position.set(side * 0.074, 0.285, 0.016);
      const shine = shapeMesh(circleShape(0.011), '#ffffff', 0.002, 8);
      shine.position.set(0.012, 0.014, 0.002);
      pupil.add(shine);
      const lid = shapeMesh(roundedRectShape(0.16, 0.08, 0.03), plastic, 0.02);
      lid.position.set(side * 0.074, 0.33, 0.02);
      const brow = shapeMesh(roundedRectShape(0.11, 0.025, 0.01), INK, 0.022);
      brow.position.set(side * 0.074, 0.385, 0.022);
      this.head.add(eye, pupil, lid, brow);
      this.pupils.push(pupil);
      this.lids.push(lid);
      this.brows.push(brow);
    }
    // the revolver is hooked by its trigger guard on the right prong's tip, barrel up and out to
    // the side, clear of the face (it twirls round the prong)
    const gs = 0.55;
    this.twirl.position.set(0.075, 0.64, 0.03);
    this.gun.root.scale.setScalar(gs);
    this.gun.root.position.set(-0.12 * gs, 0.02 * gs, 0);
    this.twirl.add(this.gun.root);
    this.head.add(this.twirl);
    this.head.scale.setScalar(HEAD_SCALE);
  }

  /** The neck's control points for a pose (world space). */
  private pose(v: PathView, t: number) {
    const fwd = v.fwd ?? new THREE.Vector3(0, 0, 1);
    const B = this.base, d = this.dir, s = this.side;
    // cobra: along the floor, a curl up, then the S of the neck leaning back toward us
    const cobra = [[0, 0, 0], [0.32, 0, 0], [0.62, 0.12, 0], [0.78, 0.52, 0.02], [0.72, 0.95, 0.06], [0.58, 1.3, 0.13], [0.5, 1.52, 0.21]];
    const bolt = [[0, 0, 0], [0.32, 0, 0], [0.5, 0.22, 0.02], [0.55, 0.66, 0.04], [0.55, 1.1, 0.05], [0.55, 1.52, 0.06], [0.55, 1.88, 0.07]];
    const rear = smooth(v.rear), up = smooth(v.up);
    for (let i = 0; i < 7; i++) {
      const p = this.neckPts[i];
      const flat = B.clone().addScaledVector(d, (i / 6) * NECK);
      const [ca, cy, cf] = cobra[i], [ba, by, bf] = bolt[i];
      const a = lerp(ca, ba, up), y = lerp(cy, by, up), f = lerp(cf, bf, up);
      const reared = B.clone().addScaledVector(d, a).addScaledVector(fwd, f);
      reared.y += y;
      // the sway grows toward the head; bolt upright it only quivers
      const h = i / 6;
      const sw = v.sway * Math.sin(t * 3.1 - i * 0.55) * 0.12 * h * h * (1 - up) + up * Math.sin(t * 41 + i) * 0.012 * h;
      reared.addScaledVector(s, sw);
      // it lifts from the head end first
      const k = clamp(rear * 1.35 - (1 - h) * 0.35);
      p.copy(flat).lerp(reared, smooth(k));
    }
    return fwd;
  }

  set(t: number, v: PathView) {
    const glow = v.glow;
    setGlow(this.coreMat, PAL.cyan, 2.2 * glow);
    this.haloMat.opacity = 0.16 * clamp(glow);
    // the floor run, unspooling from the slam point
    const rv = clamp(v.reveal);
    this.halves.forEach(h => {
      const n = Math.floor(h.segs * smooth(rv)) * RADIAL * 6;
      h.core.geometry.setDrawRange(0, n);
      h.halo.geometry.setDrawRange(0, n);
      h.core.visible = h.halo.visible = rv > 0;
    });
    // the neck and the head only once the head end has run out to here
    const neckOn = rv >= 0.999;
    this.neckCore.visible = this.neckHalo.visible = this.head.visible = neckOn;
    const fwd = this.pose(v, t);
    if (neckOn) {
      this.neckCurve.updateArcLengths();
      for (const [mesh, r] of [[this.neckCore, CABLE_R], [this.neckHalo, CABLE_R * 3]] as const) {
        const tube = new THREE.TubeGeometry(this.neckCurve, NECK_SEGS, r, RADIAL, false);
        const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        (pos.array as Float32Array).set(tube.getAttribute('position').array as Float32Array);
        pos.needsUpdate = true;
        // (and its bounds: a stale sphere from whichever frame drew first would sort the halo
        // differently and could cull the neck)
        mesh.geometry.computeBoundingSphere();
        tube.dispose();
      }
      // the head: lying along the floor face up when flat; reared, its face toward fwd
      const tip = this.neckCurve.getPointAt(1), T = this.neckCurve.getTangentAt(1);
      this.head.position.copy(tip);
      const zFlat = Y_UP, yFlat = this.dir;
      this.qa.setFromRotationMatrix(tmpM.makeBasis(new THREE.Vector3().crossVectors(yFlat, zFlat), yFlat, zFlat));
      const yUp = T.clone().normalize();
      const zUp = fwd.clone().addScaledVector(yUp, -fwd.dot(yUp)).normalize();
      this.qb.setFromRotationMatrix(tmpM.makeBasis(new THREE.Vector3().crossVectors(yUp, zUp), yUp, zUp));
      this.head.quaternion.copy(this.qa).slerp(this.qb, smooth(clamp(v.rear * 1.2)));
      // face: pupils, lids, guilty brows
      this.pupils.forEach((p, i) => { p.position.x = (i ? 1 : -1) * 0.074 + v.look * 0.026; });
      const blink = (t % 2.7) < 0.1 ? 1 : 0;
      const shut = Math.max(blink * clamp(v.open), clamp(1 - v.open));
      const wide = clamp(v.open - 1, 0, 0.4);
      this.lids.forEach(l => { l.visible = shut > 0.04; l.scale.y = Math.max(0.01, shut); l.position.y = 0.36 - shut * 0.04; });
      this.pupils.forEach(p => p.scale.setScalar(1 - wide * 0.6));
      this.brows.forEach((b, i) => {
        b.rotation.z = (i ? 1 : -1) * -0.45 * v.shifty;
        b.position.y = 0.385 + wide * 0.12 - v.shifty * 0.015;
      });
      // the gun points up and out whatever the head does (plus the twirl)
      this.twirl.visible = v.gun;
      const roll = Math.atan2(-T.x, T.y);   // roughly how far the head leans over, in the picture
      this.twirl.rotation.z = 0.95 - roll + v.twirl;
    }
    // packets of light running from the tail to the head, once the cable is all out
    this.packets.forEach((p, i) => {
      const u = ((t * 0.32 + i / PACKETS) % 1 + 1) % 1;
      const on = v.packets > 0.01 && rv >= 0.999;
      p.mesh.visible = on;
      if (!on) return;
      p.mesh.position.copy(this.full.getPointAt(u));
      const k = Math.sin(u * Math.PI);
      p.mesh.scale.setScalar(0.4 + 0.6 * k);
      setGlow(p.mat, '#e8fdff', 2.6 * v.packets * k * glow);
    });
  }

  /** A point on the neck, 0 (its base on the floor) to 1 (the head), in world space. */
  neckAt(u: number, out = new THREE.Vector3()) { return out.copy(this.neckCurve.getPointAt(clamp(u))); }
  /** The neck's direction at u. */
  neckDir(u: number, out = new THREE.Vector3()) { return out.copy(this.neckCurve.getTangentAt(clamp(u))); }
  /** The tail end of the cable (where the Field's string is tied on). */
  get tail() { return this.full.getPointAt(0); }
}
