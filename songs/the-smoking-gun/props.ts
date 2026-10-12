// Small props for "The Smoking Gun", each a flat cut-out with set(...) that sets everything it
// animates from song time: the pager, the idea bulb, handcuffs, the master switch, a glowing trace
// line through the club, a finger-snap burst and rain.
import * as THREE from 'three';
import { INK, arcShape, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { clamp, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { CRT_FONT, PAL, UI_FONT, cutout, glowMat, halo, lightMat, ownGlow, radialTexture, setGlow, solid } from './look';

// ---------------------------------------------------------------------------------------------
/** A chunky 80s pager standing on its belt clip, with a green LCD and a red LED. */
export class Pager {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private lcd: ReturnType<typeof canvasPlane<{ chars: number; blink: boolean }>>;
  private led: THREE.MeshBasicMaterial;
  private lcdLast = '';
  static readonly TEXT = 'PROD DOWN';

  constructor() {
    this.root.add(this.body);
    const shell = inkedRect(1.0, 0.56, 0.1, '#2b2836', 0.04);
    shell.position.y = 0.3;
    this.body.add(shell);
    this.body.add(shapeMesh(roundedRectShape(1.0, 0.12, 0.05, 0, 0.08), '#221f2c', 0.004));
    this.body.add(shapeMesh(roundedRectShape(0.86, 0.04, 0.02, 0, 0.53), '#3c3849', 0.004));
    const bezel = inkedRect(0.68, 0.3, 0.04, '#141218', 0.02);
    bezel.position.set(-0.07, 0.33, 0.004);
    this.body.add(bezel);
    this.lcd = canvasPlane(0.62, 0.24, 500, (g, st: { chars: number; blink: boolean }, W, H) => {
      g.fillStyle = '#9fc86a'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(40,60,20,0.12)';
      for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 1, H);
      g.fillStyle = '#1d2b12'; g.textBaseline = 'middle';
      g.font = `400 ${H * 0.28}px ${CRT_FONT}`;
      g.textAlign = 'left'; g.fillText('02:14 AM', W * 0.05, H * 0.2);
      g.textAlign = 'right'; g.fillText(st.blink ? '((!))' : '', W * 0.95, H * 0.2);
      g.font = `400 ${H * 0.56}px ${CRT_FONT}`;
      g.textAlign = 'left';
      g.fillText(Pager.TEXT.slice(0, st.chars), W * 0.05, H * 0.66);
    });
    solid(this.lcd.mesh);
    this.lcd.mesh.position.set(-0.07, 0.33, 0.008);
    this.body.add(this.lcd.mesh);
    this.led = ownGlow(PAL.red, 0.5);
    const led = shapeMesh(circleShape(0.045), this.led, 0.008, 12);
    led.position.set(0.4, 0.46, 0.008);
    this.body.add(led);
    for (const [x, y] of [[0.4, 0.3], [0.4, 0.17]]) {
      const b = inkedRect(0.12, 0.08, 0.03, '#4a4558', 0.02);
      b.position.set(x, y, 0.004);
      this.body.add(b);
    }
  }

  /** buzz: 0..1 vibration; chars: letters of PROD DOWN shown; ledOn: red LED. */
  set(t: number, buzz: number, chars: number, ledOn: boolean) {
    const j = buzz * 0.03;
    this.body.position.set(Math.sin(t * 157) * j, Math.abs(Math.sin(t * 113)) * j * 0.6, 0);
    this.body.rotation.z = Math.sin(t * 131) * buzz * 0.03;
    setGlow(this.led, PAL.red, ledOn ? 2.6 : 0.4);
    const blink = Math.floor(t * 4) % 2 === 0 && chars > 0;
    const key = `${chars}:${blink}`;
    if (key !== this.lcdLast) { this.lcd.update({ chars, blink }); this.lcdLast = key; }
  }
}

// ---------------------------------------------------------------------------------------------
/** The classic idea bulb: pops on with a squash, glows, and throws little rays. */
export class Bulb {
  readonly root = new THREE.Group();
  private inner = new THREE.Group();
  private glass: THREE.MeshBasicMaterial;
  private rays = new THREE.Group();
  private rayMat: THREE.MeshBasicMaterial;
  private haloMesh: THREE.Mesh;

  constructor() {
    this.root.add(this.inner);
    this.haloMesh = halo(0.9, PAL.gold, 0.6);
    this.haloMesh.position.z = -0.05;
    this.inner.add(this.haloMesh);
    const bulb = new THREE.Shape();
    bulb.absarc(0, 0.34, 0.3, -Math.PI * 0.2, Math.PI * 1.2, false);
    bulb.lineTo(-0.12, 0.02); bulb.lineTo(0.12, 0.02); bulb.closePath();
    const bulbInk = new THREE.Shape();
    bulbInk.absarc(0, 0.34, 0.34, -Math.PI * 0.2, Math.PI * 1.2, false);
    bulbInk.lineTo(-0.15, -0.01); bulbInk.lineTo(0.15, -0.01); bulbInk.closePath();
    this.glass = ownGlow('#fff2a8', 1);
    this.inner.add(shapeMesh(bulbInk, INK, 0, 24), shapeMesh(bulb, this.glass, 0.002, 24));
    const fil = shapeMesh(arcShape(0.08, 0.025, Math.PI * 0.1, Math.PI * 0.9), ownGlow('#ff9a2e', 2.5), 0.004, 10);
    fil.position.y = 0.3;
    this.inner.add(fil);
    this.inner.add(shapeMesh(roundedRectShape(0.08, 0.04, 0.01, -0.1, 0.48), ownGlow('#ffffff', 2), 0.005));
    for (let i = 0; i < 3; i++) {
      const band = inkedRect(0.24, 0.05, 0.02, '#a9a4b8', 0.02);
      band.position.set(0, -0.04 - i * 0.07, 0.003);
      this.inner.add(band);
    }
    this.rayMat = ownGlow(PAL.gold, 2.2);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.05 + (i / 8) * 0.9);
      const ray = shapeMesh(roundedRectShape(0.05, 0.2, 0.025, 0, 0.62), this.rayMat, -0.01);
      ray.rotation.z = a - Math.PI / 2;
      this.rays.add(ray);
    }
    this.rays.position.y = 0.34;
    this.inner.add(this.rays);
  }

  /** on: seconds since it popped on (negative = not yet). */
  set(on: number, t: number) {
    this.root.visible = on >= 0;
    if (on < 0) return;
    const k = easeOutBack(clamp(on / 0.25), 2.6);
    this.inner.scale.set(Math.max(0.01, k), Math.max(0.01, k * (1 + 0.15 * Math.sin(clamp(on / 0.25) * Math.PI))), 1);
    const lit = clamp((on - 0.05) / 0.08);
    // bright enough to glow, not so bright the bloom eats its shape
    setGlow(this.glass, '#fff2a8', lerp(0.9, 1.3, lit) * (0.97 + 0.03 * Math.sin(t * 13)));
    this.rays.visible = lit > 0.5;
    this.rays.scale.setScalar(1 + 0.12 * Math.sin(t * 6));
    setGlow(this.rayMat, PAL.gold, 1.7 * lit);
    (this.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0.32 * lit;
  }
}

// ---------------------------------------------------------------------------------------------
/** Handcuffs: two steel rings and a short chain, centred between the rings. */
export class Cuffs {
  readonly root = new THREE.Group();
  readonly rings: THREE.Group[] = [];
  constructor(span = 0.34) {
    for (const side of [-1, 1]) {
      const ring = new THREE.Group();
      ring.add(shapeMesh(arcShape(0.1, 0.075, 0, Math.PI * 2), INK, 0, 24));
      ring.add(shapeMesh(arcShape(0.1, 0.04, 0, Math.PI * 2), '#d9dbe8', 0.002, 24));
      ring.add(shapeMesh(arcShape(0.1, 0.015, Math.PI * 0.6, Math.PI * 0.9), ownGlow('#ffffff', 2), 0.004, 8));
      ring.position.x = side * span / 2;
      this.root.add(ring);
      this.rings.push(ring);
    }
    for (let i = 0; i < 3; i++) {
      const link = shapeMesh(arcShape(0.035, 0.02, 0, Math.PI * 2), '#b9bccc', 0.001, 10);
      link.position.x = lerp(-span / 2 + 0.13, span / 2 - 0.13, i / 2);
      link.scale.x = 1.4;
      this.root.add(link);
    }
  }
}

// ---------------------------------------------------------------------------------------------
/** The master switch: a lever in a box, labelled; flips from OFF (down) to ON (up) with a spark. */
export class MasterSwitch {
  readonly root = new THREE.Group();
  private lever = new THREE.Group();
  private lamp: THREE.MeshBasicMaterial;
  private spark = new THREE.Group();
  private sparkMat: THREE.MeshBasicMaterial;

  constructor() {
    const box = inkedRect(0.62, 0.5, 0.06, '#3a3150', 0.04);
    box.position.y = 0.25;
    this.root.add(box);
    this.root.add(shapeMesh(roundedRectShape(0.5, 0.05, 0.02, 0, 0.05), '#2a2240', 0.004));
    const label = staticPlane(0.5, 0.12, 300, (g, W, H) => {
      g.fillStyle = '#ffe9a8'; g.font = `800 ${H * 0.62}px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('DEV SERVER', W / 2, H * 0.55);
    });
    cutout(label);
    label.position.set(0, 0.42, 0.006);
    this.root.add(label);
    this.lamp = ownGlow(PAL.green, 0.3);
    const lamp = shapeMesh(circleShape(0.045), this.lamp, 0.006, 12);
    lamp.position.set(0.22, 0.12, 0.006);
    this.root.add(lamp);
    const slot = shapeMesh(roundedRectShape(0.08, 0.26, 0.04, 0, 0.22), '#120e1e', 0.005);
    this.root.add(slot);
    const stick = inkedRect(0.06, 0.42, 0.03, '#c9c5d8', 0.025);
    stick.position.y = 0.21;
    const knob = inkedCircle(0.1, PAL.red, 0.03);
    knob.position.y = 0.44;
    this.lever.add(stick, knob);
    this.lever.position.set(0, 0.22, 0.01);
    this.root.add(this.lever);
    this.sparkMat = ownGlow(PAL.gold, 3);
    for (let i = 0; i < 8; i++) {
      const r = shapeMesh(roundedRectShape(0.03, 0.16, 0.015, 0, 0.3), this.sparkMat, 0.02);
      r.rotation.z = (i / 8) * Math.PI * 2;
      this.spark.add(r);
    }
    this.spark.position.set(0, 0.66, 0);
    this.root.add(this.spark);
  }

  /** flip: seconds since the flip (negative = still off). */
  set(flip: number) {
    const k = flip < 0 ? 0 : easeOutBack(clamp(flip / 0.12), 3);
    this.lever.rotation.z = lerp(0.75, -0.75, k);
    setGlow(this.lamp, PAL.green, flip >= 0.05 ? 2.4 : 0.3);
    const s = clamp(flip / 0.25);
    this.spark.visible = flip >= 0 && flip < 0.25;
    this.spark.scale.setScalar(0.5 + s * 1.3);
    setGlow(this.sparkMat, PAL.gold, 3 * (1 - s));
  }
}

// ---------------------------------------------------------------------------------------------
/** A glowing line along a 3D path (a trace through the club) that draws itself from the start. */
export class GlowPath {
  readonly root = new THREE.Group();
  private core: THREE.Mesh;
  private haloTube: THREE.Mesh;
  private head: THREE.Mesh;
  private curve: THREE.CatmullRomCurve3;
  private segs: number;
  private radial = 6;

  constructor(points: THREE.Vector3[], color: string = PAL.cyan, radius = 0.045, segs = 240) {
    this.segs = segs;
    this.curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
    this.core = new THREE.Mesh(new THREE.TubeGeometry(this.curve, segs, radius, this.radial, false), glowMat(color, 3));
    this.haloTube = new THREE.Mesh(new THREE.TubeGeometry(this.curve, segs, radius * 3.2, this.radial, false), lightMat(color, 0.3));
    this.head = halo(0.5, '#ffffff', 0.9);
    this.root.add(this.core, this.haloTube, this.head);
  }

  /** k: how much of the path is drawn, 0..1. headSize scales the spark at the tip. */
  set(k: number, headSize = 1) {
    k = clamp(k);
    const n = Math.floor(k * this.segs) * this.radial * 6;
    this.core.geometry.setDrawRange(0, n);
    this.haloTube.geometry.setDrawRange(0, n);
    this.root.visible = k > 0;
    const p = this.curve.getPointAt(Math.max(0.001, k));
    this.head.position.copy(p);
    this.head.visible = k > 0 && k < 1 && headSize > 0;
    this.head.scale.setScalar(Math.max(0.01, headSize));
  }
  /** Point at fraction u along the path (for things that ride it). */
  at(u: number) { return this.curve.getPointAt(clamp(u)); }
  /** Make the head halo face a camera (call after positioning the camera). */
  face(cam: THREE.Camera) { this.head.quaternion.copy(cam.quaternion); }
}

// ---------------------------------------------------------------------------------------------
/** A burst of short rays and a ring (finger snaps, clicks, pops). */
export class Burst {
  readonly root = new THREE.Group();
  private mat: THREE.MeshBasicMaterial;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  constructor(private color: string = PAL.gold, rays = 10) {
    this.mat = ownGlow(color, 3);
    for (let i = 0; i < rays; i++) {
      const len = i % 2 ? 0.14 : 0.24;
      const r = shapeMesh(roundedRectShape(0.035, len, 0.017, 0, 0.18 + len / 2), this.mat, 0);
      r.rotation.z = (i / rays) * Math.PI * 2;
      this.root.add(r);
    }
    this.ringMat = ownGlow(color, 2);
    this.ring = shapeMesh(arcShape(0.22, 0.025, 0, Math.PI * 2), this.ringMat, -0.002, 32);
    this.root.add(this.ring);
  }
  /** s: seconds since the burst (negative = not yet). */
  set(s: number, size = 1) {
    const k = clamp(s / 0.35);
    this.root.visible = s >= 0 && k < 1;
    if (!this.root.visible) return;
    this.root.scale.setScalar(size * (0.5 + easeOutCubic(k) * 1.1));
    setGlow(this.mat, this.color, 3 * (1 - k));
    setGlow(this.ringMat, this.color, 2 * (1 - k));
    this.ring.scale.setScalar(0.6 + k * 0.9);
  }
}

// ---------------------------------------------------------------------------------------------
/** Rain: streaks falling through a box, each on its own deterministic loop, plus splash rings. */
export class Rain {
  readonly root = new THREE.Group();
  private streaks: THREE.InstancedMesh;
  private splashes: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private e = new THREE.Euler();
  private col = new THREE.Color();

  constructor(readonly box: { x0: number; x1: number; z0: number; z1: number; top: number }, readonly count = 1100, readonly splashCount = 140) {
    const geo = new THREE.PlaneGeometry(0.018, 0.55);
    this.streaks = new THREE.InstancedMesh(geo, lightMat('#9fb8ff', 0.55), count);
    this.streaks.frustumCulled = false;
    const ring = new THREE.RingGeometry(0.7, 1, 24);
    ring.rotateX(-Math.PI / 2);
    this.splashes = new THREE.InstancedMesh(ring, lightMat('#b9c8ff', 0.4), splashCount);
    this.splashes.frustumCulled = false;
    this.root.add(this.streaks, this.splashes);
  }

  /** Lay out every drop for time t. cam: streaks turn to face it (around y). */
  set(t: number, cam: THREE.Camera) {
    const { x0, x1, z0, z1, top } = this.box;
    const speed = 13;
    for (let i = 0; i < this.count; i++) {
      const x = lerp(x0, x1, hash(i, 1)), z = lerp(z0, z1, hash(i, 2));
      const y = top - ((hash(i, 3) * top + t * speed * (0.9 + hash(i, 4) * 0.2)) % top);
      this.v.set(x + 0.08 * (y / top), y, z);
      const yaw = Math.atan2(cam.position.x - x, cam.position.z - z);
      this.q.setFromEuler(this.e.set(0, yaw, 0.08));
      this.sc.set(1, 0.7 + hash(i, 5) * 0.6, 1);
      this.m4.compose(this.v, this.q, this.sc);
      this.streaks.setMatrixAt(i, this.m4);
      // drops right in front of the lens would be huge white bars: fade them out
      const d = this.v.distanceTo(cam.position);
      this.col.setScalar(clamp((d - 1.2) / 4) * (0.6 + 0.4 * hash(i, 6)));
      this.streaks.setColorAt(i, this.col);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    this.streaks.instanceColor!.needsUpdate = true;
    for (let i = 0; i < this.splashCount; i++) {
      const period = 0.7 + hash(i, 11) * 0.6;
      const ph = ((t + hash(i, 12) * period) % period) / period;
      const cycle = Math.floor((t + hash(i, 12) * period) / period);
      const x = lerp(x0, x1, hash(i, cycle, 13)), z = lerp(z0, z1, hash(i, cycle, 14));
      const r = 0.05 + ph * 0.28;
      this.v.set(x, 0.02, z);
      this.q.identity();
      this.sc.set(r, 1, r * 0.9);
      this.m4.compose(this.v, this.q, this.sc);
      this.splashes.setMatrixAt(i, ph < 0.6 ? this.m4 : this.m4.makeScale(0, 0, 0));
    }
    this.splashes.instanceMatrix.needsUpdate = true;
  }
}

/** A soft additive pool of light on the floor (spotlights, lamps). */
export function lightPool(r: number, color: string, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), lightMat(color, opacity, radialTexture()));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** A sweat drop for flinging (teardrop, light blue, inked). */
export function sweatDrop() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0.13); s.quadraticCurveTo(0.07, 0.03, 0.06, -0.01); s.absarc(0, -0.01, 0.06, 0, -Math.PI, true); s.quadraticCurveTo(-0.07, 0.03, 0, 0.13);
  const ink = new THREE.Shape();
  ink.moveTo(0, 0.16); ink.quadraticCurveTo(0.095, 0.03, 0.085, -0.01); ink.absarc(0, -0.01, 0.085, 0, -Math.PI, true); ink.quadraticCurveTo(-0.095, 0.03, 0, 0.16);
  g.add(shapeMesh(ink, INK, 0, 10), shapeMesh(s, ownMat('#8fd8ff'), 0.002, 10));
  return g;
}
