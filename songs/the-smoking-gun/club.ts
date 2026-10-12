// Club PROD: the one set the whole video lives in. Built once per page and shared by every club
// shot: a shot borrows it (scene.add(club.root)), then calls club.apply(state, f), which sets every
// animated property from the state, so nothing can leak from one shot to the next.
//
// Layout (world units, y up, the floor at y = 0, the camera usually looking down -z):
//   dance floor tiles   x -7..7, z -7.5..2.5 (one tile per service; the floor IS the dashboard)
//   back wall           z = -10, with the DJ booth and terminal wall in the middle (x -4.5..4.5),
//                       the bar to the left (x -18..-9), the evidence board (x 7.5..13) and
//                       the entrance with the velvet rope (x 14..20) to the right
//   disco ball          (0, 8.6, -3)        lighting truss  y = 11
import * as THREE from 'three';
import type { Frame } from '../../engine/types';
import { INK, arcShape, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { clamp, lerp, smooth } from '../../engine/ease';
import { hash, noise1 } from '../../engine/rng';
import { CRT_FONT, PAL, SIGN_FONT, TERM_FONT, UI_FONT, beamTexture, cutout, glowMat, lightMat, ownGlow, radialTexture, setGlow, solid } from './look';
import { Dancer, dancePose, frozenPose, outfit } from './people';

export const FLOOR = { nx: 14, nz: 10, x0: -7, z0: -7.5, tile: 1 };
export const WALL_Z = -10;
export const RISER = { w: 9, h: 0.9, front: -7.8 };
export const CONSOLE = { w: 6.6, h: 0.36, front: -8.05, depth: 0.7 };
/** Where Clawd stands in the booth (feet), behind the console. */
export const BOOTH_SPOT = new THREE.Vector3(0, RISER.h + 0.14, -9.0); // on a step behind the decks
/** The confidence meter: a VU dial standing on the console's left end, leaning back toward the floor. */
export const METER = { x: -2.85, y: RISER.h + CONSOLE.h + 0.36, z: CONSOLE.front - 0.3, w: 0.84, h: 0.54, lean: -0.22 };
export const BALL = new THREE.Vector3(0, 9.3, -0.5);
export const BOARD = { x: 10.2, y: 4.4, w: 5.6, h: 3.8 };
export const ROPE = { x: 16.2, z: -6.2 };
const SPOTS = 240;
export const BAR = { x: -15.2, w: 8.4, h: 1.35, front: -7.2 };

/** Centre of floor tile (ix, iz) on the floor plane. */
export function tileCenter(ix: number, iz: number) {
  return new THREE.Vector3(FLOOR.x0 + (ix + 0.5) * FLOOR.tile, 0, FLOOR.z0 + (iz + 0.5) * FLOOR.tile);
}

/** One tile's light: colour and power (1 = a flat fill; above ~1.1 it blooms). */
export interface TileLight { color: THREE.ColorRepresentation; power: number }
export type Painter = (ix: number, iz: number, f: Frame) => TileLight;

export type TermMode = 'off' | 'boot' | 'logs' | 'grep' | 'trace' | 'error' | 'no' | 'tests';

export interface ClubState {
  floor: Painter;
  ball: { angle: number; lit: number; sparkle: number };
  beams: number;            // spotlight beams from the truss, 0..1
  alarm: number;            // red emergency beacon on the booth, 0..1
  pars: number;             // truss lights, 0..1
  frozen: number;           // dancers frozen (prod down), 0..1
  danceEnergy: number;
  crowd: number;            // 0 hides every dancer
  crowdMask?: (i: number) => boolean;   // per-dancer visibility
  crowdShift?: (i: number, f: Frame) => THREE.Vector3 | null; // per-dancer offset (shooing, parting)
  terms: TermMode;
  termT0: number;           // song time the current terminal mode started (boot sequence etc.)
  meter: number;            // the confidence VU meter, 0..1 (1 = pinned in the red)
  sign: number;             // CLUB PROD neon, 0..1
  incidentDays: number;     // the "days since last incident" sign
  records: { spin: number; label: string };
  wallLight: number;        // general wash on the back wall, 0..1
  boardStrings: number;     // evidence board: how much red string is up, 0..1
  boardFocus: number;       // 0 = strings all over, 1 = every string swung to the Cache
}

/** Production is down: dead floor with red error tiles that pulse on the beat. */
export function deadFloor(power = 1): Painter {
  return (ix, iz, f) => {
    const err = hash(ix, iz, 7) < 0.3;
    if (!err) return { color: PAL.tileDead, power: 1 };
    const beat = f.clock.beat(f.t), ph = beat - Math.floor(beat);
    const pulse = beat < 0 ? 0 : Math.exp(-ph * 4);
    return { color: PAL.red, power: (0.55 + 0.9 * pulse) * power };
  };
}

/** The floor alive: a disco pattern in full colour that changes on every beat. */
export function aliveFloor(power = 1.6): Painter {
  const cols = [PAL.pink, PAL.cyan, PAL.gold, PAL.violetNeon, '#3dff9e', '#ff7a3d'];
  return (ix, iz, f) => {
    const beat = Math.max(0, f.clock.beat(f.t)), n = Math.floor(beat), ph = beat - n;
    const pattern = Math.floor(n / 4) % 3;
    let on: boolean, ci: number;
    if (pattern === 0) { on = (ix + iz + n) % 2 === 0; ci = (ix + iz + Math.floor(n / 2)) % cols.length; }
    else if (pattern === 1) { const r = Math.hypot(ix - 6.5, iz - 4.5); on = Math.floor(r - beat * 1.5) % 3 === 0; ci = Math.floor(r) % cols.length; }
    else { on = hash(ix, iz, n) < 0.55; ci = Math.floor(hash(ix, iz, n, 3) * cols.length); }
    return { color: cols[(ci + cols.length) % cols.length], power: on ? power * (0.8 + 0.4 * Math.exp(-ph * 3)) : 0.9 };
  };
}

/** Hide the dancers that would stand between a booth camera and the DJ booth. */
export const clearBooth = (i: number) => !(Math.abs(DANCER_SPOTS[i][0]) < 4.6 && DANCER_SPOTS[i][1] < -3);

export function defaultState(): ClubState {
  return {
    floor: deadFloor(), ball: { angle: 0, lit: 0.2, sparkle: 0 }, beams: 0, alarm: 1, pars: 0.25, frozen: 1, danceEnergy: 1,
    crowd: 1, terms: 'off', termT0: 0, meter: 0.08, sign: 1, incidentDays: 0, records: { spin: 0, label: '/checkout' },
    wallLight: 0.4, boardStrings: 1, boardFocus: 0,
  };
}

const DANCER_SPOTS: [number, number][] = [
  [-5.6, -6.2], [-3.1, -6.6], [-0.4, -6.9], [2.4, -6.5], [5.1, -6.1],
  [-6.2, -3.9], [-4.0, -4.3], [3.9, -4.1], [6.1, -3.7],
  [-5.2, -1.6], [5.3, -1.5],
  [-6.3, 0.9], [-3.9, 1.3], [4.0, 1.2], [6.4, 0.7],
];

export class Club {
  readonly root = new THREE.Group();
  readonly dancers: { d: Dancer; x: number; z: number }[] = [];
  private tiles!: THREE.InstancedMesh;
  private ball!: THREE.Mesh;
  private ballMat!: THREE.MeshBasicMaterial;
  private ballGlints: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; k: number }[] = [];
  private spots!: THREE.InstancedMesh;
  private spotMat!: THREE.MeshBasicMaterial;
  private beams: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; pool: THREE.Mesh; poolMat: THREE.MeshBasicMaterial; x: number; color: string; k: number }[] = [];
  private pars: { mat: THREE.MeshBasicMaterial; color: string }[] = [];
  private alarm!: { dome: THREE.MeshBasicMaterial; wash: THREE.MeshBasicMaterial };
  private sign!: { mat: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial };
  private wallWash!: THREE.MeshBasicMaterial;
  private terms!: ReturnType<typeof canvasPlane<{ f: Frame; s: ClubState }>>;
  private termMat!: THREE.MeshBasicMaterial;
  private meterNeedle!: THREE.Group;
  private meterRed!: THREE.MeshBasicMaterial;
  private records: THREE.Group[] = [];
  private leds: { mat: THREE.MeshBasicMaterial; color: string; ch: number; k: number }[] = [];
  private labels!: { label: string; planes: THREE.Mesh[] };
  private incident!: ReturnType<typeof canvasPlane<number>>;
  private incidentLast = -1;
  private board!: ReturnType<typeof canvasPlane<{ f: Frame; s: ClubState }>>;
  private woofers: THREE.Object3D[] = [];
  private neonTubes: { mat: THREE.MeshBasicMaterial; color: string; k: number }[] = [];
  private bottles: { mat: THREE.MeshBasicMaterial; color: string; k: number }[] = [];
  private exitMat!: THREE.MeshBasicMaterial;
  private tmp = new THREE.Color();
  private m4 = new THREE.Matrix4();

  constructor() {
    this.buildRoom();
    this.buildFloor();
    this.buildBooth();
    this.buildBar();
    this.buildBoard();
    this.buildEntrance();
    this.buildLights();
    this.buildCrowd();
  }

  private add<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T {
    o.position.set(x, y, z);
    this.root.add(o);
    return o;
  }

  // --- walls, ceiling, signs ---------------------------------------------------------------
  private buildRoom() {
    // back wall: dark panels with a faint vertical rhythm, a skirting strip and a top neon tube
    this.add(solid(staticPlane(64, 18, 12, (g, W, H) => {
      const u = W / 64;
      g.fillStyle = PAL.wall; g.fillRect(0, 0, W, H);
      for (let x = 0; x < 64; x += 2) {
        g.fillStyle = (x / 2) % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
        g.fillRect(x * u, 0, 2 * u, H);
        g.fillStyle = PAL.wallLine; g.fillRect(x * u, 0, 0.06 * u, H);
      }
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(5,3,15,0.85)'); grad.addColorStop(0.45, 'rgba(5,3,15,0.1)'); grad.addColorStop(1, 'rgba(5,3,15,0.35)');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    })), 0, 9, WALL_Z - 0.05);
    // a soft wash of light on the wall that the club lighting raises and lowers
    this.wallWash = lightMat('#6a3cff', 0.0, radialTexture());
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), this.wallWash);
    this.add(wash, 0, 5, WALL_Z - 0.02);

    // floor outside the dance floor: dark and glossy
    const base = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), ownMat('#0b0920'));
    base.rotation.x = -Math.PI / 2;
    this.add(base, 0, -0.02, 0);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR.nx + 0.5, FLOOR.nz + 0.5), ownMat(PAL.floorGrout));
    edge.rotation.x = -Math.PI / 2;
    this.add(edge, 0, -0.01, FLOOR.z0 + FLOOR.nz / 2);

    // neon tubes along the top of the wall and in waves either side of the booth
    const tube = (pts: [number, number][], color: string, z = WALL_Z + 0.05, w = 0.09) => {
      const mat = ownGlow(color, 2);
      this.neonTubes.push({ mat, color, k: this.neonTubes.length });
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const m = shapeMesh(roundedRectShape(len + w, w, w / 2), mat, 0);
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
        m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
        this.root.add(m);
      }
    };
    tube([[-30, 12.4], [30, 12.4]], PAL.pink);
    tube([[-30, 12.0], [30, 12.0]], PAL.violetNeon);
    // a 70s rainbow of neon arcs rising behind the CLUB PROD sign
    [PAL.gold, PAL.pink, PAL.violetNeon, PAL.cyan].forEach((c, i) => {
      const r = 6.2 + i * 0.55, pts: [number, number][] = [];
      for (let k = 0; k <= 28; k++) { const a = Math.PI * (k / 28); pts.push([Math.cos(a) * r, 6.6 + Math.sin(a) * r * 0.62]); }
      tube(pts, c, WALL_Z + 0.04, 0.11);
    });
    // neon starbursts high on the wall
    for (const [x, y, c] of [[-11.2, 10.2, PAL.gold], [11.6, 10.4, PAL.cyan], [-21, 8.5, PAL.pink], [21.5, 9.0, PAL.gold]] as [number, number, string][]) {
      const mat = ownGlow(c, 2);
      this.neonTubes.push({ mat, color: c, k: this.neonTubes.length });
      const star = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const ray = shapeMesh(roundedRectShape(0.08, i % 2 ? 0.7 : 1.2, 0.04, 0, i % 2 ? 0.55 : 0.8), mat, 0);
        ray.rotation.z = (i / 8) * Math.PI * 2;
        star.add(ray);
      }
      this.add(star, x, y, WALL_Z + 0.06);
    }

    // CLUB PROD sign above the booth
    const signW = 10.5, signH = 2.1;
    this.add(inkedRect(signW + 0.6, signH + 0.5, 0.15, '#120a26', 0.08), 0, 8.3, WALL_Z + 0.08);
    const glow = lightMat(PAL.pink, 0.0, radialTexture());
    const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(signW * 1.5, signH * 3.2), glow);
    this.add(glowMesh, 0, 8.3, WALL_Z + 0.09);
    const signPlane = staticPlane(signW, signH, 80, (g, W, H) => {
      g.font = `400 ${H * 0.62}px ${SIGN_FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.fillText('CLUB PROD', W / 2, H * 0.55);
    });
    cutout(signPlane, 0.35);
    const signMat = signPlane.material as THREE.MeshBasicMaterial;
    this.add(signPlane, 0, 8.3, WALL_Z + 0.12);
    this.sign = { mat: signMat, glow };

    // "days since last incident" board, left of the booth
    this.add(inkedRect(3.9, 1.8, 0.08, '#1a1430', 0.08), -8.3, 5.6, WALL_Z + 0.08);
    this.incident = canvasPlane(3.7, 1.6, 64, (g, days: number, W, H) => {
      g.fillStyle = '#0d0a1a'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#e8e2ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${H * 0.13}px ${UI_FONT}`;
      g.fillText('DAYS SINCE LAST INCIDENT', W / 2, H * 0.17);
      g.fillStyle = days > 0 ? '#45ff8a' : '#ff3240';
      g.font = `400 ${H * 0.72}px ${CRT_FONT}`;
      g.fillText(String(days), W / 2, H * 0.62);
    });
    solid(this.incident.mesh);
    this.incident.mesh.position.set(-8.3, 5.6, WALL_Z + 0.13);
    (this.incident.mesh.material as THREE.MeshBasicMaterial).color.setScalar(1.25);
    this.root.add(this.incident.mesh);

    // ceiling: a dark band at the top
    this.add(shapeMesh(roundedRectShape(90, 6, 0), '#05040c', 0), 0, 15.5, WALL_Z + 0.5);
  }

  // --- the dance floor -----------------------------------------------------------------------
  private buildFloor() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, 64, 64);
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 44);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#bdbdbd');
    g.fillStyle = grad; g.fillRect(4, 4, 56, 56);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.moveTo(6, 6); g.lineTo(30, 6); g.lineTo(6, 30); g.closePath(); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(0.92, 0.92);
    geo.rotateX(-Math.PI / 2);
    const n = FLOOR.nx * FLOOR.nz;
    this.tiles = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex }), n);
    let k = 0;
    for (let iz = 0; iz < FLOOR.nz; iz++) for (let ix = 0; ix < FLOOR.nx; ix++) {
      const p = tileCenter(ix, iz);
      this.m4.makeTranslation(p.x, 0, p.z);
      this.tiles.setMatrixAt(k, this.m4);
      this.tiles.setColorAt(k, new THREE.Color(PAL.tileDead));
      k++;
    }
    this.root.add(this.tiles);
  }

  // --- the DJ booth: riser, console with decks and the confidence meter, terminal wall --------
  private buildBooth() {
    // riser: a box with a neon strip along its front edge
    const riserTop = new THREE.Mesh(new THREE.PlaneGeometry(RISER.w, WALL_Z - RISER.front < 0 ? RISER.front - WALL_Z : 2), ownMat('#1d1538'));
    riserTop.rotation.x = -Math.PI / 2;
    this.add(riserTop, 0, RISER.h, (RISER.front + WALL_Z) / 2);
    this.add(inkedRect(RISER.w, RISER.h, 0.02, '#150f2b', 0.05), 0, RISER.h / 2, RISER.front);
    const strip = ownGlow(PAL.cyan, 2.2);
    this.neonTubes.push({ mat: strip, color: PAL.cyan, k: 99 });
    this.add(shapeMesh(roundedRectShape(RISER.w, 0.07, 0.03), strip, 0), 0, RISER.h - 0.06, RISER.front + 0.02);
    for (let i = 0; i < 9; i++) { // little step lights
      const m = shapeMesh(circleShape(0.06), glowMat(PAL.gold, 1.6), 0, 10);
      this.add(m, -4 + i, 0.25, RISER.front + 0.02);
    }

    // terminal wall: bezels drawn once with holes; the screens are one canvas behind them
    const TW = { x: 0, y: 3.95, w: 9.4, h: 4.6 };
    const screens = TERMINALS;
    this.terms = canvasPlane(TW.w, TW.h, 64, (g, st: { f: Frame; s: ClubState }, W, H) => drawTerminals(g, W, H, TW, st.f, st.s));
    this.termMat = this.terms.mesh.material as THREE.MeshBasicMaterial;
    this.terms.mesh.position.set(TW.x, TW.y, WALL_Z + 0.2);
    solid(this.terms.mesh);
    this.root.add(this.terms.mesh);
    const bezels = staticPlane(TW.w, TW.h, 64, (g, W, H) => {
      const u = W / TW.w;
      for (const s of screens) {
        const x = (s.x - s.w / 2 - 0.22 + TW.w / 2) * u, y = (TW.h / 2 - (s.y + s.h / 2 + 0.22)) * u;
        const w = (s.w + 0.44) * u, h = (s.h + 0.44) * u;
        g.fillStyle = PAL.ink; g.beginPath(); g.roundRect(x - 0.05 * u, y - 0.05 * u, w + 0.1 * u, h + 0.1 * u, 0.16 * u); g.fill();
        g.fillStyle = '#2c2647'; g.beginPath(); g.roundRect(x, y, w, h, 0.12 * u); g.fill();
        g.fillStyle = '#3a3360'; g.fillRect(x + 0.1 * u, y + 0.08 * u, w - 0.2 * u, 0.06 * u);
        // screen hole
        g.save(); g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.roundRect(x + 0.22 * u, y + 0.22 * u, s.w * u, s.h * u, 0.18 * u); g.fill();
        g.restore();
        // power LED
        g.fillStyle = '#ff5f6d'; g.beginPath(); g.arc(x + w - 0.18 * u, y + h - 0.12 * u, 0.04 * u, 0, Math.PI * 2); g.fill();
      }
    });
    cutout(bezels);
    this.add(bezels, TW.x, TW.y, WALL_Z + 0.24);

    // speaker stacks either side of the booth, woofers pump on the kick
    for (const side of [-1, 1]) {
      for (let r = 0; r < 2; r++) {
        const x = side * 6.1, y = 0.95 + r * 1.9;
        this.add(inkedRect(1.9, 1.8, 0.06, '#191428', 0.06), x, y, -8.6);
        const woof = new THREE.Group();
        woof.add(inkedCircle(0.62, '#2a2440', 0.05));
        const cone = inkedCircle(0.38, '#3b3458', 0.04); cone.position.z = 0.004; woof.add(cone);
        const cap = inkedCircle(0.13, '#120e20', 0.03); cap.position.z = 0.008; woof.add(cap);
        this.add(woof, x, y - 0.1, -8.58);
        this.woofers.push(woof);
        const tw = inkedCircle(0.14, '#3b3458', 0.03);
        this.add(tw, x + 0.6, y + 0.62, -8.58);
      }
    }

    // console: front face with a grille, a top surface with two decks and a mixer
    const cz = CONSOLE.front, top = RISER.h + CONSOLE.h;
    this.add(inkedRect(CONSOLE.w, CONSOLE.h, 0.03, '#241a45', 0.05), 0, RISER.h + CONSOLE.h / 2, cz);
    this.add(shapeMesh(roundedRectShape(CONSOLE.w - 0.3, 0.05, 0.02), glowMat(PAL.pink, 2.0), 0), 0, top - 0.06, cz + 0.02);
    const consoleTop = new THREE.Mesh(new THREE.PlaneGeometry(CONSOLE.w, CONSOLE.depth), ownMat('#2f2457'));
    consoleTop.rotation.x = -Math.PI / 2;
    this.add(consoleTop, 0, top, cz - CONSOLE.depth / 2);
    for (const side of [-1, 1]) {
      const deck = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.62), ownMat('#1a1430'));
      plate.rotation.x = -Math.PI / 2;
      deck.add(plate);
      const rec = new THREE.Group();
      const vinyl = new THREE.Mesh(new THREE.CircleGeometry(0.28, 40), ownMat('#0d0b14'));
      vinyl.rotation.x = -Math.PI / 2;
      vinyl.position.y = 0.01;
      const grooveMat = ownMat('#24203a');
      for (const r of [0.2, 0.25]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.006, r, 40), grooveMat);
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012;
        rec.add(ring);
      }
      const label = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), ownMat(side < 0 ? PAL.pink : PAL.gold));
      label.rotation.x = -Math.PI / 2; label.position.y = 0.014;
      const notch = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.08), ownMat('#ffffff'));
      notch.rotation.x = -Math.PI / 2; notch.position.set(0, 0.016, -0.06);
      rec.add(vinyl, label, notch);
      deck.add(rec);
      this.records.push(rec);
      const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.42), ownMat('#c9c3dd'));
      arm.rotation.x = -Math.PI / 2; arm.rotation.z = 0.5; arm.position.set(0.3, 0.02, -0.05);
      deck.add(arm);
      this.add(deck, side * 1.55, top + 0.005, cz - CONSOLE.depth / 2);
    }
    // mixer between the decks with LED level bars
    const mixer = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), ownMat('#15112a'));
    mixer.rotation.x = -Math.PI / 2;
    this.add(mixer, 0, top + 0.006, cz - CONSOLE.depth / 2);
    // LED level bars on an upright strip along the console's front edge, mirrored from the centre
    this.add(inkedRect(1.5, 0.15, 0.02, '#120e22', 0.03), 0, top + 0.075, cz - 0.06);
    for (let ch = 0; ch < 2; ch++) for (let k = 0; k < 9; k++) {
      const color = k < 5 ? PAL.green : k < 7 ? PAL.amber : PAL.red;
      const mat = ownGlow(color, 0.3);
      this.add(shapeMesh(roundedRectShape(0.06, 0.06, 0.008), mat, 0, 4), (ch ? 1 : -1) * (0.1 + k * 0.071), top + 0.075, cz - 0.045);
      this.leds.push({ mat, color, ch, k });
    }

    // the confidence meter: an analog VU dial in a little housing on the console's left end
    const meter = new THREE.Group();
    const housing = inkedRect(METER.w + 0.14, METER.h + 0.14, 0.05, '#1a1430', 0.05);
    housing.position.z = -0.02;
    meter.add(housing);
    meter.add(inkedRect(METER.w, METER.h, 0.05, '#f1e6c8', 0.035));
    const hubY = -METER.h * 0.3;
    const zones: [number, number, string][] = [[Math.PI * 0.95, Math.PI * 0.55, '#3fbf6b'], [Math.PI * 0.55, Math.PI * 0.35, '#ffcc3d'], [Math.PI * 0.35, Math.PI * 0.08, '#ff3240']];
    for (const [a0, a1, col] of zones) {
      const arc = shapeMesh(arcShape(METER.h * 0.56, METER.h * 0.09, a1, a0), col, 0.004, 16);
      arc.position.y = hubY;
      meter.add(arc);
    }
    this.meterRed = ownGlow('#ff3240', 1);
    const redLamp = shapeMesh(circleShape(METER.h * 0.07), this.meterRed, 0.006, 12);
    redLamp.position.set(METER.w * 0.38, METER.h * 0.32, 0);
    meter.add(redLamp);
    const lab = staticPlane(METER.w * 0.9, METER.h * 0.2, 160, (g, W, H) => {
      g.fillStyle = '#3b2d22'; g.font = `700 ${H * 0.62}px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('CONFIDENCE', W / 2, H * 0.55);
    });
    cutout(lab);
    lab.position.set(0, -METER.h * 0.38, 0.006);
    meter.add(lab);
    this.meterNeedle = new THREE.Group();
    const needle = shapeMesh(roundedRectShape(0.018, METER.h * 0.66, 0.008, 0, METER.h * 0.33), INK, 0.008);
    this.meterNeedle.add(needle);
    const hub = shapeMesh(circleShape(METER.h * 0.06), INK, 0.009, 12);
    hub.position.y = hubY;
    meter.add(hub);
    this.meterNeedle.position.y = hubY;
    meter.add(this.meterNeedle);
    meter.rotation.x = METER.lean;
    this.add(meter, METER.x, METER.y, METER.z);
    // its stand
    this.add(inkedRect(0.12, 0.2, 0.02, '#120e22', 0.03), METER.x, top + 0.1, METER.z - 0.05);

    // red emergency beacon on the console's right corner
    const domeMat = ownGlow(PAL.red, 1);
    const dome = new THREE.Group();
    dome.add(inkedRect(0.36, 0.12, 0.02, '#2a2a33', 0.03));
    const d = shapeMesh(arcShape(0.08, 0.16, 0, Math.PI), domeMat, 0.004, 12);
    d.position.y = 0.06;
    dome.add(d);
    this.add(dome, 2.85, top + 0.07, cz - 0.2);
    const wash = lightMat(PAL.red, 0, radialTexture());
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(26, 12), wash), 0, 5, WALL_Z + 0.03);
    this.alarm = { dome: domeMat, wash };
  }

  // --- the bar, stage left -------------------------------------------------------------------
  private buildBar() {
    const { x, w, h, front } = BAR;
    // back shelves with glowing bottles and a neon cocktail glass
    for (let r = 0; r < 3; r++) {
      const y = 2.6 + r * 1.35;
      this.add(inkedRect(w - 0.6, 0.12, 0.02, '#3a2a55', 0.04), x, y, WALL_Z + 0.1);
      for (let i = 0; i < 9; i++) {
        const bx = x - w / 2 + 0.8 + i * 0.95 + hash(r, i, 3) * 0.2;
        const col = [PAL.pink, PAL.gold, PAL.cyan, '#7dff6a', PAL.violetNeon, PAL.amber][Math.floor(hash(r, i, 4) * 6)];
        const mat = ownGlow(col, 1.3);
        this.bottles.push({ mat, color: col, k: r * 9 + i });
        const tall = 0.55 + hash(r, i, 5) * 0.35;
        const body = shapeMesh(roundedRectShape(0.28, tall, 0.06, 0, tall / 2), mat, 0);
        const neck = shapeMesh(roundedRectShape(0.1, 0.22, 0.03, 0, tall + 0.1), mat, 0);
        const lbl = shapeMesh(roundedRectShape(0.2, 0.16, 0.02, 0, tall * 0.45), ownMat('#f4ead2'), 0.002);
        const g = new THREE.Group(); g.add(body, neck, lbl);
        this.add(g, bx, y + 0.06, WALL_Z + 0.14);
      }
    }
    // cocktail glass neon
    const glass = new THREE.Group();
    const gm = ownGlow(PAL.cyan, 2.2);
    this.neonTubes.push({ mat: gm, color: PAL.cyan, k: 50 });
    const tri = (pts: [number, number][]) => pts.forEach(([a, b], i) => {
      const [c, d] = pts[(i + 1) % pts.length];
      const len = Math.hypot(c - a, d - b);
      const m = shapeMesh(roundedRectShape(len + 0.08, 0.08, 0.04), gm, 0);
      m.position.set((a + c) / 2, (b + d) / 2, 0); m.rotation.z = Math.atan2(d - b, c - a);
      glass.add(m);
    });
    tri([[-0.8, 0.8], [0.8, 0.8], [0, -0.2]]);
    tri([[0, -0.2], [0, -1.0]]);
    tri([[-0.45, -1.0], [0.45, -1.0]]);
    const olive = shapeMesh(circleShape(0.14), glowMat('#7dff6a', 2), 0.01, 12);
    olive.position.set(0.25, 0.55, 0);
    glass.add(olive);
    this.add(glass, x + 5.6, 7.3, WALL_Z + 0.1);
    // counter: front panel with a neon strip, a top surface, stools in front
    this.add(inkedRect(w, h, 0.05, '#3b2350', 0.06), x, h / 2, front);
    for (let i = 0; i < 6; i++) this.add(shapeMesh(roundedRectShape(0.06, h - 0.3, 0.02), ownMat('#4b2e66'), 0), x - w / 2 + 0.75 + i * 1.5, h / 2, front + 0.02);
    const strip = ownGlow(PAL.violetNeon, 2);
    this.neonTubes.push({ mat: strip, color: PAL.violetNeon, k: 60 });
    this.add(shapeMesh(roundedRectShape(w, 0.07, 0.03), strip, 0), x, h - 0.12, front + 0.03);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, 1.0), ownMat('#5a3a72'));
    top.rotation.x = -Math.PI / 2;
    this.add(top, x, h, front - 0.5);
    for (let i = 0; i < 5; i++) {
      const sx = x - w / 2 + 1.2 + i * 1.7;
      this.add(inkedRect(0.12, 0.9, 0.03, '#8d86a8', 0.03), sx, 0.45, front + 0.9);
      this.add(inkedRect(0.75, 0.16, 0.08, PAL.red, 0.04), sx, 0.95, front + 0.92);
    }
  }

  // --- the evidence board, stage right ---------------------------------------------------------
  private buildBoard() {
    const { x, y, w, h } = BOARD;
    this.add(inkedRect(w + 0.5, h + 0.5, 0.06, '#5a3b22', 0.08), x, y, WALL_Z + 0.1);
    this.board = canvasPlane(w, h, 70, (g, st: { f: Frame; s: ClubState }, W, H) => drawBoard(g, W, H, st.f, st.s));
    solid(this.board.mesh);
    this.board.mesh.position.set(x, y, WALL_Z + 0.16);
    this.root.add(this.board.mesh);
    const lamp = lightMat('#ffd27a', 0.25, radialTexture());
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, h * 1.4), lamp), x, y + 0.6, WALL_Z + 0.2);
  }

  // --- the entrance: doorway, EXIT sign, velvet rope -------------------------------------------
  private buildEntrance() {
    const dx = 18.5;
    this.add(inkedRect(3.2, 5.6, 0.1, '#0a0716', 0.1), dx, 2.8, WALL_Z + 0.1);
    this.add(inkedRect(2.6, 5.0, 0.05, '#120c24', 0.05), dx, 2.6, WALL_Z + 0.14);
    this.exitMat = ownGlow('#3dff7a', 1.8);
    const exit = staticPlane(1.4, 0.5, 100, (g, W, H) => {
      g.fillStyle = '#ffffff'; g.font = `800 ${H * 0.7}px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('EXIT', W / 2, H * 0.55);
    });
    cutout(exit);
    (exit.material as THREE.MeshBasicMaterial).color.copy(this.exitMat.color);
    this.add(inkedRect(1.6, 0.6, 0.04, '#0d2a16', 0.04), dx, 6.0, WALL_Z + 0.16);
    this.add(exit, dx, 6.0, WALL_Z + 0.2);
    // rope: brass posts, red velvet in a sag
    for (const px of [ROPE.x - 1.4, ROPE.x + 1.4]) {
      const post = new THREE.Group();
      post.add(inkedRect(0.14, 1.2, 0.05, '#e3b341', 0.04));
      const knob = inkedCircle(0.12, '#ffd36b', 0.03); knob.position.y = 0.66; post.add(knob);
      const foot = inkedRect(0.5, 0.1, 0.05, '#e3b341', 0.04); foot.position.y = -0.58; post.add(foot);
      this.add(post, px, 0.62, ROPE.z);
    }
    const rope = new THREE.Shape();
    const N = 16;
    for (let i = 0; i <= N; i++) { const k = i / N; rope.lineTo(lerp(-1.35, 1.35, k), -Math.sin(k * Math.PI) * 0.35 + 0.04); }
    for (let i = N; i >= 0; i--) { const k = i / N; rope.lineTo(lerp(-1.35, 1.35, k), -Math.sin(k * Math.PI) * 0.35 - 0.06); }
    this.add(shapeMesh(rope, '#b3122e', 0.01, 1), ROPE.x, 1.2, ROPE.z);
  }

  // --- lights: truss with par cans, spotlight beams with pools, disco ball, wall sparkles ------
  private buildLights() {
    this.add(inkedRect(34, 0.35, 0.02, '#2c2840', 0.05), 0, 11, -3);
    for (let i = 0; i < 15; i++) {
      const x = -14 + i * 2;
      const color = [PAL.pink, PAL.cyan, PAL.gold, PAL.violetNeon][i % 4];
      const can = new THREE.Group();
      can.add(inkedRect(0.5, 0.55, 0.06, '#1b1828', 0.04));
      const mat = ownGlow(color, 1);
      const lens = shapeMesh(circleShape(0.17), mat, 0.004, 14);
      lens.position.y = -0.12;
      can.add(lens);
      this.add(can, x, 10.6, -2.95);
      this.pars.push({ mat, color });
    }
    // beams: tall additive triangles from the truss down to the floor, each with a floor pool
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4, color = [PAL.pink, PAL.cyan, PAL.gold, PAL.violetNeon, PAL.cyan, PAL.pink][i];
      const mat = lightMat(color, 0, beamTexture());
      const geo = new THREE.PlaneGeometry(2.6, 11.5);
      geo.translate(0, -5.75, 0);
      const mesh = new THREE.Mesh(geo, mat);
      this.add(mesh, x, 10.5, -3.2);
      const poolMat = lightMat(color, 0, radialTexture());
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), poolMat);
      pool.rotation.x = -Math.PI / 2;
      this.add(pool, x, 0.02, -2);
      this.beams.push({ mesh, mat, pool, poolMat, x, color, k: i });
    }
    // the disco ball: a faceted sphere (unlit), a chain, a dark cel-shade crescent and glints
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1b1830'; g.fillRect(0, 0, 512, 256);
    const cols = 40, rows = 20;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const v = 0.45 + 0.55 * hash(r, q, 41);
      const tint = hash(r, q, 42);
      const base = tint < 0.15 ? [255, 120, 200] : tint < 0.3 ? [120, 220, 255] : tint < 0.38 ? [255, 210, 120] : [230, 230, 245];
      g.fillStyle = `rgb(${base.map(x => Math.round(x * v)).join(',')})`;
      g.fillRect(q * 512 / cols + 1.2, r * 256 / rows + 1.2, 512 / cols - 2.4, 256 / rows - 2.4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.ballMat = new THREE.MeshBasicMaterial({ map: tex });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.95, 40, 20), this.ballMat);
    this.add(this.ball, BALL.x, BALL.y, BALL.z);
    const outline = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), ownMat(PAL.ink));
    this.add(outline, BALL.x, BALL.y, BALL.z - 0.05);
    const shade = new THREE.Shape();
    shade.absarc(0, 0, 0.955, -Math.PI * 0.85, Math.PI * 0.15, false);
    shade.absarc(0.18, 0.12, 0.8, Math.PI * 0.15, -Math.PI * 0.85, true);
    const shadeMesh = shapeMesh(shade, ownMat('#05030c', 0.55, true), 0, 32);
    this.add(shadeMesh, BALL.x, BALL.y, BALL.z + 0.97);
    this.add(inkedRect(0.06, 2.6, 0.02, '#8d86a8', 0.02), BALL.x, BALL.y + 2.2, BALL.z);
    for (let i = 0; i < 6; i++) {
      const a = 1.9 + i * 0.35, r = 0.55 + 0.38 * hash(i, 43);
      const mat = ownGlow('#ffffff', 2);
      const star = new THREE.Group();
      for (const rot of [0, Math.PI / 2]) {
        const s = new THREE.Shape();
        s.moveTo(0, 0.2); s.lineTo(0.035, 0); s.lineTo(0, -0.2); s.lineTo(-0.035, 0); s.closePath();
        const m = shapeMesh(s, mat, 0, 1); m.rotation.z = rot; star.add(m);
      }
      this.add(star, BALL.x + Math.cos(a) * r, BALL.y + Math.sin(a) * r, BALL.z + 1.0);
      this.ballGlints.push({ mesh: star as unknown as THREE.Mesh, mat, k: i });
    }
    // sparkle spots thrown on the walls and floor by the ball
    this.spotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const sparkle = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 ? 0.035 : 0.16;
      if (i === 0) sparkle.moveTo(Math.sin(a) * r, Math.cos(a) * r); else sparkle.lineTo(Math.sin(a) * r, Math.cos(a) * r);
    }
    sparkle.closePath();
    this.spots = new THREE.InstancedMesh(new THREE.ShapeGeometry(sparkle, 1), this.spotMat, SPOTS);
    this.spots.frustumCulled = false;
    this.root.add(this.spots);
  }

  // --- the crowd -------------------------------------------------------------------------------
  private buildCrowd() {
    DANCER_SPOTS.forEach(([x, z], i) => {
      const d = new Dancer(outfit(i + 3), 0.88);
      this.add(d.root, x, 0, z);
      this.dancers.push({ d, x, z });
    });
  }

  /** Set every animated property of the club from the state. */
  apply(s: ClubState, f: Frame) {
    const t = f.t;
    // floor
    let k = 0;
    for (let iz = 0; iz < FLOOR.nz; iz++) for (let ix = 0; ix < FLOOR.nx; ix++) {
      const L = s.floor(ix, iz, f);
      this.tmp.set(L.color).multiplyScalar(L.power);
      this.tiles.setColorAt(k++, this.tmp);
    }
    this.tiles.instanceColor!.needsUpdate = true;

    // disco ball: turn, brightness, glints
    this.ball.rotation.set(0.25, s.ball.angle, 0);
    this.ballMat.color.setScalar(lerp(0.35, 1.35, s.ball.lit));
    this.ballGlints.forEach(({ mesh, mat, k: i }) => {
      const tw = Math.max(0, Math.sin(s.ball.angle * 3 + i * 1.7));
      mesh.visible = s.ball.lit > 0.3 && tw > 0.2;
      mesh.scale.setScalar(0.6 + 0.8 * tw);
      setGlow(mat, '#ffffff', 2.5 * s.ball.lit * tw);
    });
    // sparkle spots: fixed directions from the ball, swept round by its angle, landing on the back wall
    const nSpots = s.ball.sparkle > 0.01 ? SPOTS : 0;
    this.spots.count = nSpots;
    for (let i = 0; i < nSpots; i++) {
      // a fixed direction from the ball, swept round as it turns; only those facing the back wall land
      const az = hash(i, 51) * Math.PI * 2 + s.ball.angle, el = (hash(i, 52) - 0.62) * 1.1;
      const x = BALL.x + Math.sin(az) * 24, y = BALL.y + el * 10;
      const onWall = Math.cos(az) < -0.15 && y > 0.4 && y < 14.5;
      const tw = 0.6 + 0.4 * Math.sin(f.t * 7 + i * 1.9);
      const size = onWall ? (0.7 + hash(i, 53) * 1.1) * tw : 0;
      this.m4.makeRotationZ(hash(i, 54) * 0.6).scale(new THREE.Vector3(size, size, 1)).setPosition(x, y, WALL_Z + 0.3);
      this.spots.setMatrixAt(i, this.m4);
    }
    this.spots.instanceMatrix.needsUpdate = true;
    this.spotMat.opacity = s.ball.sparkle;
    this.spotMat.color.setScalar(1.8);

    // beams and par cans
    this.beams.forEach(b => {
      const swing = Math.sin(t * 0.7 + b.k * 1.3) * 0.35 + Math.sin(t * 0.31 + b.k) * 0.15;
      b.mesh.rotation.z = swing;
      b.mesh.visible = s.beams > 0.01;
      b.mat.opacity = 0.22 * s.beams;
      b.pool.visible = s.beams > 0.01;
      b.pool.position.set(b.x + Math.sin(swing) * 10.5, 0.02, -3.2 + 0.4);
      b.poolMat.opacity = 0.45 * s.beams;
    });
    this.pars.forEach((p, i) => setGlow(p.mat, p.color, 0.4 + 1.8 * s.pars * (0.7 + 0.3 * Math.sin(t * 3 + i))));

    // emergency beacon: a slow red pulse on the booth and a red wash on the wall (well under 3 Hz)
    const spin = t * 2.4;
    setGlow(this.alarm.dome, PAL.red, 0.4 + 2.2 * s.alarm * (0.55 + 0.45 * Math.cos(spin)));
    this.alarm.wash.opacity = 0.12 * s.alarm * (0.6 + 0.4 * Math.sin(spin));

    // signs and wall
    setGlow(this.sign.mat, PAL.pink, 2.6 * s.sign);
    this.sign.glow.opacity = 0.22 * s.sign;
    this.wallWash.opacity = 0.18 * s.wallLight;
    this.neonTubes.forEach(n => setGlow(n.mat, n.color, (0.35 + 1.75 * s.sign) * (0.9 + 0.1 * Math.sin(t * 5 + n.k))));
    this.bottles.forEach(b => setGlow(b.mat, b.color, 0.7 + 0.5 * s.wallLight + 0.15 * Math.sin(t * 2 + b.k)));
    if (s.incidentDays !== this.incidentLast) { this.incident.update(s.incidentDays); this.incidentLast = s.incidentDays; }

    // booth
    this.terms.update({ f, s });
    this.termMat.color.setScalar(s.terms === 'off' ? 1 : 1.7);
    const kick = f.clock.kick(t, 0.1);
    this.woofers.forEach(w => w.scale.setScalar(1 + 0.06 * kick));
    this.meterNeedle.rotation.z = lerp(0.95, -0.95, clamp(s.meter)) + Math.sin(t * 23) * 0.015;
    setGlow(this.meterRed, '#ff3240', s.meter > 0.85 ? 2.4 : 0.35);
    this.records.forEach((r, i) => { r.rotation.y = -s.records.spin * (i ? 1.02 : 1) - i; });
    const lv = [f.clock.env('low', t), f.clock.env('high', t)];
    this.leds.forEach(l => setGlow(l.mat, l.color, (l.k + 0.5) / 9 < lv[l.ch] * 1.1 ? 2.2 : 0.22));
    this.board.update({ f, s });

    // crowd
    const beat = f.clock.beat(t);
    this.dancers.forEach(({ d, x, z }, i) => {
      const show = s.crowd > 0 && (!s.crowdMask || s.crowdMask(i));
      d.root.visible = show;
      if (!show) return;
      const off = s.crowdShift?.(i, f);
      d.root.position.set(x + (off?.x ?? 0), off?.y ?? 0, z + (off?.z ?? 0));
      const body = s.frozen >= 0.5 ? frozenPose(i) : dancePose(i, beat, s.danceEnergy);
      d.set(body, s.frozen, t + i * 0.37, 0.6 + 0.4 * s.wallLight);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Terminal wall contents

export const TERMINALS = [
  { x: -3.3, y: -1.45, w: 2.0, h: 1.3 }, { x: -1.0, y: -1.45, w: 1.9, h: 1.3 }, { x: 1.15, y: -1.45, w: 1.9, h: 1.3 }, { x: 3.35, y: -1.45, w: 2.0, h: 1.3 },
  { x: -3.25, y: 0.25, w: 1.9, h: 1.5 }, { x: 0, y: 0.35, w: 3.2, h: 1.9 }, { x: 3.25, y: 0.25, w: 1.9, h: 1.5 },
  { x: -3.3, y: 1.75, w: 1.7, h: 0.95 }, { x: -1.15, y: 1.85, w: 1.5, h: 0.75 }, { x: 1.15, y: 1.85, w: 1.5, h: 0.75 }, { x: 3.3, y: 1.75, w: 1.7, h: 0.95 },
];

const BOOT_LINES = ['$ npm run dev', '> vite dev', 'starting dev server...', 'compiling routes', '  /checkout  ok', '  /cart      ok', '  /api       ok', 'ready on :5173'];
const LOG_LEVELS: [string, string][] = [['INFO', '#45ff8a'], ['INFO', '#45ff8a'], ['WARN', '#ffae3d'], ['INFO', '#45ff8a'], ['ERROR', '#ff3240'], ['DEBUG', '#2fe2ff']];
const LOG_MSGS = ['GET /checkout 500', 'cache miss key=cart:91', 'handler timeout 3001ms', 'retrying request', 'POST /checkout 500', 'trace id 7f3a', 'db pool ok', 'render shell 12ms'];
const GREP_FILES = ['src/checkout.ts', 'src/cart/cache.ts', 'lib/handler.js', 'api/routes.ts', 'src/pay/index.ts', 'test/checkout.spec.ts'];

function drawTerminals(g: CanvasRenderingContext2D, W: number, H: number, TW: { w: number; h: number }, f: Frame, s: ClubState) {
  const u = W / TW.w;
  const dt = f.t - s.termT0;
  TERMINALS.forEach((sc, i) => {
    const x = (sc.x - sc.w / 2 + TW.w / 2) * u, y = (TW.h / 2 - (sc.y + sc.h / 2)) * u, w = sc.w * u, h = sc.h * u;
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#020806'; g.fillRect(x, y, w, h);
    const lineH = Math.max(0.13 * u, h / 9);
    g.font = `400 ${lineH * 0.95}px ${CRT_FONT}`;
    g.textBaseline = 'top';
    const pad = 0.08 * u;
    const mode = s.terms;
    if (mode === 'off') {
      g.fillStyle = 'rgba(80,90,140,0.12)';
      g.beginPath(); g.ellipse(x + w * 0.3, y + h * 0.3, w * 0.25, h * 0.15, -0.4, 0, Math.PI * 2); g.fill();
    } else if (mode === 'boot') {
      const t0 = i * 0.11; // screens come on one after another
      const k = dt - t0;
      if (k < 0) {
        g.fillStyle = 'rgba(80,90,140,0.12)';
        g.beginPath(); g.ellipse(x + w * 0.3, y + h * 0.3, w * 0.25, h * 0.15, -0.4, 0, Math.PI * 2); g.fill();
      } else if (k < 0.18) {
        // CRT power-on: a bright line that opens into the screen
        const open = k / 0.18;
        g.fillStyle = '#dfffe9';
        g.fillRect(x, y + h / 2 - (h / 2) * open * open - 2, w, Math.max(3, h * open * open));
      } else {
        g.fillStyle = '#45ff8a';
        const n = Math.min(BOOT_LINES.length, Math.floor((k - 0.18) * 9) + 1);
        const first = Math.max(0, n - Math.floor((h - pad) / lineH));
        for (let L = first; L < n; L++) {
          const text = BOOT_LINES[(L + i) % BOOT_LINES.length];
          g.fillStyle = text.startsWith('ready') ? '#d8ffe6' : '#45ff8a';
          g.fillText(text, x + pad, y + pad + (L - first) * lineH);
        }
        if (Math.floor(f.t * 2.5) % 2 === 0) g.fillRect(x + pad, y + pad + (n - first) * lineH, lineH * 0.5, lineH * 0.85);
      }
    } else if (mode === 'logs' || mode === 'grep' || mode === 'tests') {
      const speed = mode === 'grep' ? 14 : mode === 'tests' ? 8 : 4;
      const scroll = dt * speed + i * 3.7;
      const n0 = Math.floor(scroll), frac = scroll - n0;
      const rows = Math.ceil(h / lineH) + 1;
      for (let r = 0; r < rows; r++) {
        const n = n0 + r;
        const yy = y + pad + (r - frac) * lineH;
        if (mode === 'grep') {
          const file = GREP_FILES[Math.floor(hash(n, i, 61) * GREP_FILES.length)];
          const line = 10 + Math.floor(hash(n, i, 62) * 400);
          g.fillStyle = '#c38bff'; g.fillText(file, x + pad, yy);
          const fw = g.measureText(file).width;
          g.fillStyle = '#8a8fb0'; g.fillText(`:${line}:`, x + pad + fw, yy);
          const lw = g.measureText(`:${line}:`).width;
          g.fillStyle = '#45ff8a'; g.fillText(hash(n, i, 63) < 0.5 ? ' checkout(' : ' handler.run(', x + pad + fw + lw, yy);
        } else if (mode === 'tests') {
          g.fillStyle = '#45ff8a';
          g.fillText(`PASS  test ${(n % 97) + 1}`, x + pad, yy);
        } else {
          const [lvl, col] = LOG_LEVELS[Math.floor(hash(n, i, 64) * LOG_LEVELS.length)];
          g.fillStyle = col; g.fillText(lvl.padEnd(6, ' '), x + pad, yy);
          g.fillStyle = '#b9ffd2'; g.fillText(LOG_MSGS[Math.floor(hash(n, i, 65) * LOG_MSGS.length)], x + pad + g.measureText('ERROR ').width, yy);
        }
      }
    } else if (mode === 'trace') {
      for (let r = 0; r < 6; r++) {
        const yy = y + pad + r * lineH * 1.2;
        const x0 = x + pad + r * w * 0.07, len = w * (0.7 - r * 0.08) * clamp(dt * 2 - r * 0.15);
        g.fillStyle = r === 3 ? '#ff3240' : ['#2fe2ff', '#45ff8a', '#ffae3d'][r % 3];
        g.fillRect(x0, yy, Math.max(0, len), lineH * 0.7);
      }
    } else if (mode === 'error' || mode === 'no') {
      g.fillStyle = '#2a0306'; g.fillRect(x, y, w, h);
      g.fillStyle = '#ff3240'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (mode === 'no') { g.font = `400 ${h * 0.8}px ${CRT_FONT}`; g.fillText('NO', x + w / 2, y + h * 0.55); }
      else { g.font = `400 ${h * 0.3}px ${CRT_FONT}`; g.fillText('ERROR 500', x + w / 2, y + h * 0.5); }
      g.textAlign = 'left';
    }
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let yy = y; yy < y + h; yy += 0.05 * u) g.fillRect(x, yy, w, 0.018 * u);
    g.restore();
  });
}

// ---------------------------------------------------------------------------------------------
// The evidence board: polaroids of the suspects joined by red string.

export const SUSPECT_PINS: Record<string, [number, number]> = {
  function: [0.2, 0.3], handler: [0.5, 0.22], cache: [0.8, 0.32], logs: [0.25, 0.75], traces: [0.62, 0.72],
};

function drawBoard(g: CanvasRenderingContext2D, W: number, H: number, f: Frame, s: ClubState) {
  // cork
  g.fillStyle = '#9b6a3c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = hash(i, 71) < 0.5 ? 'rgba(60,30,10,0.25)' : 'rgba(255,220,160,0.12)';
    g.fillRect(hash(i, 72) * W, hash(i, 73) * H, 3 + hash(i, 74) * 5, 2 + hash(i, 75) * 3);
  }
  const P = (k: string) => ({ x: SUSPECT_PINS[k][0] * W, y: SUSPECT_PINS[k][1] * H });
  // strings: all over the place at first; boardFocus swings every string's far end onto the Cache
  const pairs: [string, string][] = [['function', 'handler'], ['handler', 'cache'], ['logs', 'function'], ['traces', 'handler'], ['logs', 'traces'], ['traces', 'cache'], ['function', 'traces']];
  const strings = clamp(s.boardStrings);
  const cache = P('cache');
  g.lineCap = 'round';
  pairs.forEach(([a, b], i) => {
    const k = clamp(strings * pairs.length - i);
    if (k <= 0) return;
    const A = P(a), B0 = P(b);
    const B = { x: lerp(B0.x, cache.x, smooth(s.boardFocus)), y: lerp(B0.y, cache.y, smooth(s.boardFocus)) };
    const ex = lerp(A.x, B.x, k), ey = lerp(A.y, B.y, k);
    const sag = (1 - s.boardFocus) * 0.06 * H;
    g.strokeStyle = '#e0142c'; g.lineWidth = W * 0.008;
    g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo((A.x + ex) / 2, (A.y + ey) / 2 + sag, ex, ey); g.stroke();
  });
  // polaroids
  const photo = (k: string, label: string, draw: (cx: number, cy: number, r: number) => void) => {
    const { x, y } = P(k), w = W * 0.17, h = W * 0.19;
    g.save(); g.translate(x, y); g.rotate((hash(k.length, 76) - 0.5) * 0.2);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 6, -h / 2 + 6, w, h);
    g.fillStyle = '#f6f0e2'; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#231a3a'; g.fillRect(-w / 2 + w * 0.08, -h / 2 + w * 0.08, w * 0.84, w * 0.84);
    draw(0, -h / 2 + w * 0.5, w * 0.3);
    g.fillStyle = '#2b1d16'; g.font = `700 ${w * 0.15}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 0, h / 2 - w * 0.12);
    g.fillStyle = '#e0142c'; g.beginPath(); g.arc(0, -h / 2 + 4, 7, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  photo('function', 'fn()', (cx, cy, r) => { g.fillStyle = '#8f8a9e'; g.fillRect(cx - r, cy - r * 0.9, r * 2, r * 1.8); g.strokeStyle = '#2b1d16'; g.lineWidth = 3; g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.1, r * 0.25, 0, Math.PI * 2); g.arc(cx + r * 0.35, cy - r * 0.1, r * 0.25, 0, Math.PI * 2); g.stroke(); });
  photo('handler', 'handler', (cx, cy, r) => { g.fillStyle = '#2b2b3a'; g.fillRect(cx - r * 1.1, cy - r * 0.6, r * 2.2, r * 1.6); g.fillStyle = '#c69c6d'; g.beginPath(); g.arc(cx, cy - r * 0.75, r * 0.45, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.fillRect(cx - r * 0.45, cy - r * 0.85, r * 0.9, r * 0.2); });
  photo('cache', 'cache', (cx, cy, r) => { g.fillStyle = '#6f8f6a'; g.fillRect(cx - r * 0.8, cy - r, r * 1.6, r * 2); g.fillStyle = '#2b1d16'; for (const yy of [-0.5, 0.15, 0.8]) g.fillRect(cx - r * 0.25, cy + yy * r - 2, r * 0.5, 5); g.fillStyle = '#111'; g.fillRect(cx - r * 0.7, cy - r * 0.8, r * 1.4, r * 0.25); });
  photo('logs', 'logs', (cx, cy, r) => { g.fillStyle = '#45ff8a'; for (let i = 0; i < 5; i++) g.fillRect(cx - r, cy - r * 0.8 + i * r * 0.38, r * (1.2 + hash(i, 77) * 0.8), r * 0.16); });
  photo('traces', 'traces', (cx, cy, r) => { for (let i = 0; i < 4; i++) { g.fillStyle = ['#2fe2ff', '#ffae3d', '#45ff8a', '#ff3240'][i]; g.fillRect(cx - r + i * r * 0.25, cy - r * 0.7 + i * r * 0.45, r * (1.6 - i * 0.3), r * 0.25); } });
  // pins
  void f;
}
