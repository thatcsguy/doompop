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
import { clamp, easeOutCubic, lerp, smooth } from '../../engine/ease';
import { hash, noise1 } from '../../engine/rng';
import { CRT_FONT, DISCO_FONT, PAL, SIGN_FONT, TERM_FONT, UI_FONT, beamTexture, cutout, glowMat, lightMat, ownGlow, radialTexture, setGlow, solid } from './look';
import { Dancer, dancePose, frozenPose, outfit, type Body } from './people';
import { ROUTE } from './handler-path';
import { mixWhite } from './lyrics-disco';

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

export type TermMode = 'off' | 'boot' | 'logs' | 'grep' | 'trace' | 'sync' | 'route' | 'error' | 'no' | 'tests' | 'json' | 'graphs' | 'credits';

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
  crowdFrozen?: (i: number) => number;  // per-dancer freeze (thawing one by one); default `frozen`
  crowdStyle?: number;      // every dancer does the same move (a dancePose style), in unison
  crowdPose?: (i: number, body: Body) => Body;   // per-dancer pose override (pointing at something)
  crowdGasp?: (i: number) => number;    // per-dancer gasp 0..1 (O mouth, big eyes)
  terms: TermMode;
  termT0: number;           // song time the current terminal mode started (boot sequence etc.)
  termOffset: number;       // extra scroll, in lines (DJ scratching the logs back and forth)
  termSync: number;         // 'sync' screens: 0 = every screen its own trace, 1 = all the same one;
                            // 'route' screens: 0 = every screen its own route, 1 = all the cable's;
                            // 'json' screens: the match glow (0 none, 1 every line green)
  termLine: number;         // 'json' screens: the request line lit on both sides (fractional; -1 none)
  meter: number;            // the confidence VU meter, 0..1 (1 = pinned in the red)
  meterOver?: number;       // the needle past the end stop (radians), for a boing
  sign: number;             // CLUB PROD neon, 0..1
  incidentDays: number;     // the "days since last incident" sign
  records: { spin: number; label: string };
  wallLight: number;        // general wash on the back wall, 0..1
  boardStrings: number;     // evidence board: how much red string is up, 0..1
  boardFocus: number;       // 0 = strings all over, 1 = every string swung to the Cache
  boardRing: number;        // a red marker ring going round the Cache's photo, 0..1
  boardLine: number;        // the photos slide into one straight line and the string pulls taut, 0..1
  boardTwang: number;       // the taut string's vibration (amplitude 0..1; the shot decays it)
  boardCacheX?: number;     // chorus 2: a red X scrawled over the Cache's photo, 0..1
  boardPath?: number;       // chorus 2: the handler path's photo slapped on (0..1, overshoots as it pops)
  boardRetarget?: number;   // chorus 2: the strings' far ends swing from the Cache to that photo, 0..1
  blackout: number;         // house lights down (the pause): neon, signs, bar, screens, crowd, 0..1
  credits?: number[];       // the end credits over the terminal wall: when each line switches on
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

/** Every tile red: the crash. */
export function allRed(power = 1.3): Painter {
  return (ix, iz, f) => {
    const beat = f.clock.beat(f.t), ph = beat - Math.floor(beat);
    return { color: PAL.red, power: power * (0.75 + 0.25 * Math.exp(-ph * 4)) * (0.9 + 0.1 * hash(ix, iz, 8)) };
  };
}

/** Hide the dancers that would stand between a booth camera and the DJ booth. */
export const clearBooth = (i: number) => !(Math.abs(DANCER_SPOTS[i][0]) < 4.6 && DANCER_SPOTS[i][1] < -3);

export function defaultState(): ClubState {
  return {
    floor: deadFloor(), ball: { angle: 0, lit: 0.2, sparkle: 0 }, beams: 0, alarm: 1, pars: 0.25, frozen: 1, danceEnergy: 1,
    crowd: 1, terms: 'off', termT0: 0, termOffset: 0, termSync: 0, termLine: -1, meter: 0.08, sign: 1, incidentDays: 0, records: { spin: 0, label: '/checkout' },
    wallLight: 0.4, boardStrings: 1, boardFocus: 0, boardRing: 0, boardLine: 0, boardTwang: 0, blackout: 0,
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
  private credits!: ReturnType<typeof canvasPlane<{ f: Frame; s: ClubState }>>;
  private creditsMat!: THREE.MeshBasicMaterial;
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
  private wallMat!: THREE.MeshBasicMaterial;
  private boardMat!: THREE.MeshBasicMaterial;
  private incidentMat!: THREE.MeshBasicMaterial;
  /** Small fixed lights that go down with the house lights in a blackout. */
  private houseLights: { mat: THREE.MeshBasicMaterial; color: string; power: number }[] = [];
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

  /** A small fixed light (glow material) that dims with the house lights. */
  private house(color: string, power: number) {
    const mat = ownGlow(color, power);
    this.houseLights.push({ mat, color, power });
    return mat;
  }

  private add<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T {
    o.position.set(x, y, z);
    this.root.add(o);
    return o;
  }

  // --- walls, ceiling, signs ---------------------------------------------------------------
  private buildRoom() {
    // back wall: dark panels with a faint vertical rhythm, a skirting strip and a top neon tube
    const wall = this.add(solid(staticPlane(64, 18, 12, (g, W, H) => {
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
    this.wallMat = wall.material as THREE.MeshBasicMaterial;
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
    this.incidentMat = this.incident.mesh.material as THREE.MeshBasicMaterial;
    this.incidentMat.color.setScalar(1.25);
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
    const stepMat = this.house(PAL.gold, 1.6);
    for (let i = 0; i < 9; i++) { // little step lights
      const m = shapeMesh(circleShape(0.06), stepMat, 0, 10);
      this.add(m, -4 + i, 0.25, RISER.front + 0.02);
    }

    // terminal wall: bezels drawn once with holes; the screens are one canvas behind them
    const TW = { x: 0, y: 3.95, w: 9.4, h: 4.6 };
    const screens = TERMINALS;
    this.terms = canvasPlane(TW.w, TW.h, 160, (g, st: { f: Frame; s: ClubState }, W, H) => drawTerminals(g, W, H, TW, st.f, st.s));
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
    // the end credits, in front of the bezels
    this.credits = canvasPlane(TW.w, TW.h, 110, (g, st: { f: Frame; s: ClubState }, W, H) => drawCredits(g, W, H, W / TW.w, st.f.t, st.s.credits ?? []));
    this.creditsMat = this.credits.mesh.material as THREE.MeshBasicMaterial;
    this.credits.mesh.position.set(TW.x, TW.y, WALL_Z + 0.28);
    this.root.add(this.credits.mesh);

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
    this.add(shapeMesh(roundedRectShape(CONSOLE.w - 0.3, 0.05, 0.02), this.house(PAL.pink, 2.0), 0), 0, top - 0.06, cz + 0.02);
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
    zones.forEach(([a0, a1, col], i) => {
      // each zone a hair in front of the last so the round caps where they meet don't z-fight
      const arc = shapeMesh(arcShape(METER.h * 0.56, METER.h * 0.09, a1, a0), col, 0.004 + i * 0.0012, 16);
      arc.position.y = hubY;
      meter.add(arc);
    });
    this.meterRed = ownGlow('#ff3240', 1);
    const redLamp = shapeMesh(circleShape(METER.h * 0.07), this.meterRed, 0.006, 12);
    redLamp.position.set(METER.w * 0.38, METER.h * 0.32, 0.006);
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
    olive.position.set(0.25, 0.55, 0.01);
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
    this.board = canvasPlane(w, h, 200, (g, st: { f: Frame; s: ClubState }, W, H) => drawBoard(g, W, H, st.f, st.s));
    solid(this.board.mesh);
    this.boardMat = this.board.mesh.material as THREE.MeshBasicMaterial;
    this.board.mesh.position.set(x, y, WALL_Z + 0.16);
    this.root.add(this.board.mesh);
    const lamp = lightMat('#ffd27a', 0.1, radialTexture());
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
    // a fixed bounding sphere: three.js sorts an instanced mesh by the sphere it computes the first
    // time it draws it, from whatever frame that was, so a lazy one makes the sort order (and the
    // picture) depend on which frame rendered first
    this.spots.boundingSphere = new THREE.Sphere(new THREE.Vector3(BALL.x, 7, WALL_Z + 0.3), 30);
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

    // signs and wall (a blackout takes the house lights down with them)
    const up = 1 - clamp(s.blackout);
    setGlow(this.sign.mat, PAL.pink, 2.6 * s.sign * up);
    this.sign.glow.opacity = 0.22 * s.sign * up;
    this.wallWash.opacity = 0.18 * s.wallLight * up;
    this.wallMat.color.setScalar(lerp(0.35, 1, up));
    this.neonTubes.forEach(n => setGlow(n.mat, n.color, (0.35 + 1.75 * s.sign) * up * (0.9 + 0.1 * Math.sin(t * 5 + n.k))));
    this.bottles.forEach(b => setGlow(b.mat, b.color, (0.7 + 0.5 * s.wallLight + 0.15 * Math.sin(t * 2 + b.k)) * lerp(0.15, 1, up)));
    this.houseLights.forEach(h => setGlow(h.mat, h.color, h.power * lerp(0.1, 1, up)));
    this.incidentMat.color.setScalar(1.25 * lerp(0.2, 1, up));
    this.boardMat.color.setScalar(lerp(0.2, 1, up));
    if (s.incidentDays !== this.incidentLast) { this.incident.update(s.incidentDays); this.incidentLast = s.incidentDays; }

    // booth
    this.terms.update({ f, s });
    this.termMat.color.setScalar((s.terms === 'off' ? 1 : 1.7) * lerp(0.2, 1, up));
    const credits = s.credits ?? [];
    this.credits.mesh.visible = credits.some(at => t >= at) && up > 0.02;
    if (this.credits.mesh.visible) {
      this.credits.update({ f, s });
      this.creditsMat.color.setScalar(1.08 * up);
    }
    const kick = f.clock.kick(t, 0.1);
    this.woofers.forEach(w => w.scale.setScalar(1 + 0.06 * kick));
    this.meterNeedle.rotation.z = lerp(0.95, -0.95, clamp(s.meter)) - (s.meterOver ?? 0) + Math.sin(t * 23) * 0.015;
    setGlow(this.meterRed, '#ff3240', s.meter > 0.85 ? 2.4 : 0.35);
    this.records.forEach((r, i) => { r.rotation.y = -s.records.spin * (i ? 1.02 : 1) - i; });
    const lv = [f.clock.env('low', t), f.clock.env('high', t)];
    this.leds.forEach(l => setGlow(l.mat, l.color, ((l.k + 0.5) / 9 < lv[l.ch] * 1.1 ? 2.2 : 0.22) * up));
    this.board.update({ f, s });

    // crowd
    const beat = f.clock.beat(t);
    this.dancers.forEach(({ d, x, z }, i) => {
      const show = s.crowd > 0 && (!s.crowdMask || s.crowdMask(i));
      d.root.visible = show;
      if (!show) return;
      const off = s.crowdShift?.(i, f);
      d.root.position.set(x + (off?.x ?? 0), off?.y ?? 0, z + (off?.z ?? 0));
      const fz = s.crowdFrozen ? s.crowdFrozen(i) : s.frozen;
      const pose = fz >= 0.5 ? frozenPose(i) : dancePose(i, beat, s.danceEnergy, s.crowdStyle);
      const body = s.crowdPose ? s.crowdPose(i, pose) : pose;
      d.set(body, fz, t + i * 0.37, (0.6 + 0.4 * s.wallLight) * up, s.crowdGasp?.(i) ?? 0);
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
/** The one trace every screen agrees on (start, length, colour), the failing span in red. */
const SYNC_SPANS: [number, number, string][] = [[0, 0.96, '#2fe2ff'], [0.04, 0.5, '#45ff8a'], [0.1, 0.26, '#ffae3d'], [0.42, 0.44, '#45ff8a'], [0.5, 0.22, '#ff3240'], [0.62, 0.3, '#2fe2ff']];
const SYNC_OWN = ['#2fe2ff', '#45ff8a', '#ffae3d', '#c38bff'];
/** The checkout request body, as both staging and prod send it (verse 2 compares the two). */
export const REQUEST_LINES = ['{', '  "cart": 91,', '  "items": [', '    { "sku": "A12", "qty": 2 },', '    { "sku": "C07", "qty": 1 }', '  ],', '  "total": 59.00,', '  "v": 1', '}'];

const TEST_NAMES = ['checkout returns 200', 'cart total sums items', 'handler routes /checkout', 'cache warms on boot', 'retries back off', 'payment is idempotent',
  'empty cart is a 400', 'staging matches prod', 'session survives deploy', 'logs carry trace ids', 'timeouts under 3s', 'field v is accepted'];
const TEST_TOTAL = 412;

/** The regression suite (the 'tests' mode): a progress bar, test names ticking green as they
 *  pass, and with done (0..1) the summary, every screen at once. */
function drawTests(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, lineH: number, pad: number, i: number, dt: number, done: number) {
  const prog = clamp(dt / 1.5 - i * 0.02);
  g.fillStyle = '#7f86ad';
  g.font = `400 ${lineH * 0.8}px ${CRT_FONT}`;
  g.fillText(`suite  ${Math.round(prog * TEST_TOTAL)}/${TEST_TOTAL}`, x + pad, y + pad * 0.6);
  const by = y + pad * 0.6 + lineH * 0.85;
  g.fillStyle = 'rgba(127,134,173,0.25)'; g.fillRect(x + pad, by, w - pad * 2, lineH * 0.22);
  g.fillStyle = '#45ff8a'; g.fillRect(x + pad, by, (w - pad * 2) * prog, lineH * 0.22);
  const top = by + lineH * 0.5;
  g.save(); g.beginPath(); g.rect(x, top, w, y + h - top); g.clip();
  g.font = `400 ${lineH * 0.95}px ${CRT_FONT}`;
  const scroll = dt * 9 + i * 3.7, n0 = Math.floor(scroll), frac = scroll - n0;
  const rows = Math.ceil(h / lineH) + 1;
  for (let r = 0; r < rows; r++) {
    const n = n0 + r, yy = top + (r - frac) * lineH;
    // a drawn tick (the CRT font has no check mark)
    g.strokeStyle = '#45ff8a'; g.lineWidth = Math.max(1.5, lineH * 0.12); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + pad, yy + lineH * 0.45); g.lineTo(x + pad + lineH * 0.18, yy + lineH * 0.65); g.lineTo(x + pad + lineH * 0.45, yy + lineH * 0.2); g.stroke();
    g.fillStyle = '#b9ffd2';
    g.fillText(TEST_NAMES[Math.floor(hash(n, i, 66) * TEST_NAMES.length)], x + pad + lineH * 0.7, yy);
    g.fillStyle = 'rgba(127,134,173,0.8)';
    const ms = `${2 + Math.floor(hash(n, i, 67) * 40)}ms`;
    g.fillText(ms, x + w - pad - g.measureText(ms).width, yy);
  }
  g.restore();
  if (done > 0) {
    const k = easeOutCubic(clamp(done));
    g.fillStyle = `rgba(2,24,12,${0.9 * k})`; g.fillRect(x, y, w, h);
    g.save();
    g.translate(x + w / 2, y + h / 2);
    g.scale(lerp(1.4, 1, k), lerp(1.4, 1, k));
    g.globalAlpha = k;
    g.fillStyle = '#45ff8a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `400 ${Math.min(h * 0.34, w * 0.2)}px ${CRT_FONT}`;
    g.fillText(`${TEST_TOTAL} PASSED`, 0, 0);
    g.restore();
    g.textAlign = 'left'; g.textBaseline = 'top';
  }
}

/** Error-rate graphs (the 'graphs' mode): a jagged red line scrolling by on every screen. As
 *  `flat` goes 0..1 it drops flat along the bottom, the newest end first, and turns green. */
function drawGraphs(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lineH: number, pad: number, i: number, dt: number, flat: number) {
  const k = clamp(flat);
  g.font = `400 ${lineH * 0.8}px ${CRT_FONT}`;
  g.fillStyle = '#7f86ad';
  g.fillText('errors/s  /checkout', x + pad, y + pad * 0.6);
  const rate = Math.round(lerp(31 + 11 * hash(i, Math.floor(dt * 5), 71), 0, smooth(clamp(k * 1.5 - 0.4))));
  const label = rate === 0 ? '0  ok' : String(rate);
  g.fillStyle = rate === 0 ? '#45ff8a' : '#ff3240';
  g.fillText(label, x + w - pad - g.measureText(label).width, y + pad * 0.6);
  const top = y + pad + lineH * 1.25, bot = y + h - pad, left = x + pad, right = x + w - pad;
  g.strokeStyle = 'rgba(127,134,173,0.2)'; g.lineWidth = 1;
  for (let r = 0; r <= 3; r++) { const yy = lerp(top, bot, r / 3); g.beginPath(); g.moveTo(left, yy); g.lineTo(right, yy); g.stroke(); }
  g.save(); g.beginPath(); g.rect(left, top - lineH * 0.3, right - left, bot - top + lineH * 0.3); g.clip();
  const N = 30, scroll = dt * 7 + i * 11, n0 = Math.floor(scroll), fr = scroll - n0;
  const pt = (j: number): [number, number, number] => {
    const u = (j - fr) / N, n = n0 + j;
    const spike = hash(n, i, 73) < 0.14 ? 0.3 : 0;
    const v0 = 0.35 + 0.3 * hash(n, i, 72) + spike;
    const fl = smooth(clamp((k - (1 - u) * 0.6) / 0.4));
    return [lerp(left, right, u), lerp(bot, top, lerp(v0, 0.04 + 0.02 * hash(n, i, 74), fl)), fl];
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [lw, a] of [[lineH * 0.42, 0.22], [lineH * 0.14, 1]] as const) {
    g.lineWidth = lw; g.globalAlpha = a;
    let prev = pt(0);
    for (let j = 1; j <= N + 1; j++) {
      const p = pt(j);
      g.strokeStyle = (prev[2] + p[2]) / 2 > 0.5 ? '#45ff8a' : '#ff3240';
      g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
      prev = p;
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

/** The end credits: neon lines over the whole terminal wall, across the bezels like a projection,
 *  each switching on at its time (ClubState.credits) with a stutter and then humming. */
const CREDITS: { text: string; size: number; color: string; y: number }[] = [
  { text: 'THE SMOKING GUN', size: 0.72, color: PAL.gold, y: 1.45 },
  { text: 'Music by Suno', size: 0.52, color: PAL.pink, y: 0.4 },
  { text: 'Animated by Claude Opus 5.5', size: 0.52, color: PAL.cyan, y: -0.45 },
];
function drawCredits(g: CanvasRenderingContext2D, W: number, H: number, u: number, t: number, on: number[]) {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  CREDITS.forEach((c, i) => {
    const at = on[i];
    if (at === undefined || t < at) return;
    const dt = t - at;
    const lit = dt > 0.32 ? 1 : hash(i, Math.floor(dt * 26), 91) < 0.3 + dt * 2 ? 1 : 0.12;
    const hum = lit * (0.93 + 0.07 * Math.sin(t * 13 + i * 2));
    let px = c.size * u;
    g.font = `400 ${px}px ${DISCO_FONT}`;
    const tw = g.measureText(c.text).width;
    if (tw > W * 0.92) { px *= (W * 0.92) / tw; g.font = `400 ${px}px ${DISCO_FONT}`; }
    const x = W / 2, y = H / 2 - c.y * u;
    g.globalAlpha = hum;
    g.strokeStyle = PAL.ink; g.lineWidth = px * 0.16;
    g.strokeText(c.text, x, y);
    g.shadowColor = c.color; g.shadowBlur = px * 0.5;
    g.fillStyle = c.color;
    g.fillText(c.text, x, y);
    g.shadowBlur = 0;
    g.fillStyle = mixWhite(c.color, 0.5);
    g.fillText(c.text, x, y);
    g.strokeStyle = mixWhite(c.color, 0.85); g.lineWidth = Math.max(1, px * 0.025);
    g.globalAlpha = hum * 0.6;
    g.strokeText(c.text, x, y);
  });
  g.globalAlpha = 1;
  g.textAlign = 'left'; g.textBaseline = 'top';
}

/** One request body in a box: a header, the lines, the lit line and the ticks (the 'json' mode). */
function drawRequest(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, prod: boolean, s: ClubState, f: Frame) {
  const head = Math.max(0.16 * u, h * 0.13);
  g.fillStyle = prod ? '#3a0f2a' : '#0b2a36';
  g.fillRect(x, y, w, head);
  g.fillStyle = prod ? '#ff6fbf' : '#5fe8ff';
  g.font = `400 ${head * 0.8}px ${CRT_FONT}`;
  g.textBaseline = 'middle';
  g.fillText(prod ? 'prod  POST /checkout' : 'staging  POST /checkout', x + 0.06 * u, y + head * 0.55);
  const lh = Math.max(0.12 * u, (h - head) / 7.2);
  g.font = `400 ${lh * 0.9}px ${CRT_FONT}`;
  const rows = Math.floor((h - head) / lh) - 1;
  const hi = s.termLine, n = REQUEST_LINES.length;
  // small screens scroll to keep the lit line in view
  const scroll = clamp(Math.floor(hi) - rows + 2, 0, Math.max(0, n - rows - 1));
  const match = clamp(s.termSync), pulse = s.termSync > 1 ? s.termSync - 1 : 0;
  for (let L = scroll; L < n; L++) {
    const yy = y + head + (L - scroll + 0.6) * lh;
    if (yy > y + h) break;
    const lit = hi >= 0 && Math.floor(hi) === L;
    const done = hi >= 0 && L < Math.floor(hi);
    if (lit || match > 0) {
      g.fillStyle = match > 0 ? `rgba(69,255,138,${0.12 + 0.25 * pulse})` : 'rgba(255,255,255,0.2)';
      g.fillRect(x, yy - lh * 0.5, w, lh);
    }
    g.fillStyle = match > 0 ? '#9dffc0' : lit ? '#ffffff' : done ? '#b9ffd2' : '#7f86ad';
    g.fillText(REQUEST_LINES[L], x + 0.06 * u, yy);
    if ((done || match > 0) && L > 0 && L < n - 1) {
      g.fillStyle = '#45ff8a';
      g.fillText('✓', x + w - lh * 0.9, yy);
    }
  }
  void f;
}

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
        // CRT power-on: a thin phosphor line that opens into a dim green screen (no white flash)
        const open = k / 0.18, oh = h * open * open;
        g.fillStyle = '#0f3a22';
        g.fillRect(x, y + h / 2 - oh / 2, w, oh);
        g.fillStyle = '#7dffb0';
        const lh = Math.max(2, 0.02 * u) * (1 - open * 0.6);
        g.fillRect(x + w * 0.5 * (1 - Math.min(1, open * 3)), y + h / 2 - lh / 2, w * Math.min(1, open * 3), lh);
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
    } else if (mode === 'tests') {
      drawTests(g, x, y, w, h, u, lineH, pad, i, dt, s.termSync);
    } else if (mode === 'graphs') {
      drawGraphs(g, x, y, w, h, lineH, pad, i, dt, s.termSync);
    } else if (mode === 'credits') {
      // under the credits: the graphs, flat and green, turned down
      drawGraphs(g, x, y, w, h, lineH, pad, i, f.t - 157.4, 1);
      g.fillStyle = 'rgba(2,8,6,0.5)'; g.fillRect(x, y, w, h);
    } else if (mode === 'logs' || mode === 'grep') {
      const speed = mode === 'grep' ? 14 : 4;
      const scroll = dt * speed + i * 3.7 + s.termOffset;
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
    } else if (mode === 'sync') {
      // a trace waterfall per screen; as termSync goes to 1 they all become the same trace, with
      // the failing span in red, a playhead sweeping across in step and a pulse on every beat
      const k = smooth(s.termSync);
      const b = f.clock.beat(f.t), pulse = Math.exp(-(b - Math.floor(b)) * 5) * k;
      g.fillStyle = '#7f86ad';
      g.font = `400 ${lineH * 0.8}px ${CRT_FONT}`;
      g.fillText(k > 0.5 ? 'trace 7f3a  /checkout' : `trace ${(Math.floor(hash(i, 93) * 65535)).toString(16)}`, x + pad, y + pad * 0.6);
      const top = y + pad + lineH * 1.1, rowH = (h - (top - y) - pad) / SYNC_SPANS.length;
      SYNC_SPANS.forEach(([s0, sl, col], r) => {
        const o0 = hash(i, r, 91) * 0.55, ol = 0.12 + hash(i, r, 92) * 0.4;
        const grow = clamp(dt * 2.5 - r * 0.12);
        const x0 = lerp(o0, s0, k), len = lerp(ol, sl, k) * grow;
        g.fillStyle = k > 0.5 ? col : SYNC_OWN[Math.floor(hash(i, r, 94) * SYNC_OWN.length)];
        g.globalAlpha = 0.85 + 0.15 * pulse;
        g.fillRect(x + pad + x0 * (w - pad * 2), top + r * rowH + rowH * 0.18, Math.max(0, len * (w - pad * 2)), rowH * 0.62);
        g.globalAlpha = 1;
      });
      if (k > 0) {
        const ph = (b / 4) - Math.floor(b / 4);
        g.fillStyle = `rgba(255,255,255,${0.55 * k})`;
        g.fillRect(x + pad + ph * (w - pad * 2), top - lineH * 0.2, Math.max(1.5, 0.012 * u), h - (top - y));
      }
    } else if (mode === 'route') {
      // a map of the floor per screen with a request's route drawn on it, each screen its own; as
      // termSync goes to 1 they all bend into the one route, the cable's, with a packet running
      // along it in step and the plug's end marked red
      const k = smooth(s.termSync);
      const b = f.clock.beat(f.t), pulse = Math.exp(-(b - Math.floor(b)) * 5) * k;
      g.fillStyle = '#7f86ad';
      g.font = `400 ${lineH * 0.8}px ${CRT_FONT}`;
      g.fillText(k > 0.5 ? 'route  /checkout' : `route ${(Math.floor(hash(i, 97) * 65535)).toString(16)}`, x + pad, y + pad * 0.6);
      const top = y + pad + lineH * 1.05, mh = y + h - pad - top, mw = w - pad * 2;
      const cell = Math.min(mw / FLOOR.nx, mh / FLOOR.nz);
      const ox = x + w / 2 - (cell * FLOOR.nx) / 2, oy = top + mh / 2 - (cell * FLOOR.nz) / 2;
      g.strokeStyle = 'rgba(127,134,173,0.22)'; g.lineWidth = 1;
      for (let c = 0; c <= FLOOR.nx; c++) { g.beginPath(); g.moveTo(ox + c * cell, oy); g.lineTo(ox + c * cell, oy + cell * FLOOR.nz); g.stroke(); }
      for (let r = 0; r <= FLOOR.nz; r++) { g.beginPath(); g.moveTo(ox, oy + r * cell); g.lineTo(ox + cell * FLOOR.nx, oy + r * cell); g.stroke(); }
      const map = (px: number, pz: number): [number, number] => [ox + (px - FLOOR.x0) * cell, oy + (pz - FLOOR.z0) * cell];
      const n = ROUTE.length;
      const pts = ROUTE.map(([rx, rz], j) => {
        const u = j / (n - 1);
        const own: [number, number] = [lerp(-5.8, 5.8, u) + (hash(i, j, 95) - 0.5) * 2.4, -3.2 + 2.6 * Math.sin(u * 5 + hash(i, 96) * 6) + (hash(i, j, 98) - 0.5) * 1.2];
        return map(lerp(own[0], rx, k), lerp(own[1], rz, k));
      });
      const grow = clamp(dt * 2.2 - i * 0.06) * (n - 1);
      const col = k > 0.5 ? '#2fe2ff' : SYNC_OWN[Math.floor(hash(i, 99) * SYNC_OWN.length)];
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [lw, a] of [[0.09 + 0.05 * pulse, 0.25], [0.035, 1]] as const) {
        g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = Math.max(1.5, lw * u);
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j <= Math.ceil(grow); j++) {
          const e = Math.min(1, grow - (j - 1));
          g.lineTo(lerp(pts[j - 1][0], pts[j][0], e), lerp(pts[j - 1][1], pts[j][1], e));
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      if (k > 0 && grow >= n - 1) {
        // the packet, in step on every screen, and the plug's end in red
        const ph = (b / 2 - Math.floor(b / 2)) * (n - 1), j = Math.min(n - 2, Math.floor(ph)), e = ph - j;
        g.fillStyle = `rgba(232,253,255,${k})`;
        g.beginPath(); g.arc(lerp(pts[j][0], pts[j + 1][0], e), lerp(pts[j][1], pts[j + 1][1], e), Math.max(2, 0.06 * u), 0, Math.PI * 2); g.fill();
        const [hx, hy] = pts[n - 1], r = Math.max(2.5, (0.08 + 0.03 * pulse) * u);
        g.fillStyle = `rgba(255,50,64,${k})`; g.fillRect(hx - r, hy - r, r * 2, r * 2);
      }
    } else if (mode === 'json') {
      // staging's request on the left screens, prod's on the right, both side by side on the big
      // one; each slides in from its own side
      const k = easeOutCubic(clamp(dt / 0.35 - Math.abs(sc.x) * 0.04));
      if (Math.abs(sc.x) < 0.1) {
        drawRequest(g, x - (1 - k) * w * 0.5, y, w / 2 - 0.02 * u, h, u, false, s, f);
        drawRequest(g, x + w / 2 + 0.02 * u + (1 - k) * w * 0.5, y, w / 2 - 0.02 * u, h, u, true, s, f);
      } else {
        const prod = sc.x > 0;
        drawRequest(g, x + (prod ? 1 : -1) * (1 - k) * w, y, w, h, u, prod, s, f);
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
/** Chorus 2: where the handler path's photo gets slapped on, under the row. */
export const PATH_PIN: [number, number] = [0.52, 0.79];
/** Where the photos end up when the evidence "lines up": one straight row ending on the Cache. */
export const LINE_PINS: Record<string, [number, number]> = {
  function: [0.11, 0.46], logs: [0.29, 0.46], handler: [0.47, 0.46], traces: [0.65, 0.46], cache: [0.86, 0.46],
};

function drawBoard(g: CanvasRenderingContext2D, W: number, H: number, f: Frame, s: ClubState) {
  const px = W / 400;   // the board was laid out at 400 px wide
  // cork
  g.fillStyle = '#9b6a3c'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) {
    g.fillStyle = hash(i, 71) < 0.5 ? 'rgba(60,30,10,0.25)' : 'rgba(255,220,160,0.12)';
    g.fillRect(hash(i, 72) * W, hash(i, 73) * H, (2 + hash(i, 74) * 4) * px, (1.5 + hash(i, 75) * 2.5) * px);
  }
  const line = s.boardLine;
  const P = (k: string) => ({ x: lerp(SUSPECT_PINS[k][0], LINE_PINS[k][0], line) * W, y: lerp(SUSPECT_PINS[k][1], LINE_PINS[k][1], line) * H });
  // sticky notes and a scribbled timeline under the photos
  const note = (x: number, y: number, rot: number, color: string, lines: string[]) => {
    g.save(); g.translate(x * W, y * H); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-26 * px + 3 * px, -20 * px + 3 * px, 52 * px, 40 * px);
    g.fillStyle = color; g.fillRect(-26 * px, -20 * px, 52 * px, 40 * px);
    g.fillStyle = '#3a2a1a'; g.font = `700 ${7 * px}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => g.fillText(t, 0, (-8 + i * 10) * px));
    g.restore();
  };
  note(0.42, 0.52, -0.08, '#ffe17a', ['500s since', 'deploy?']);
  note(0.9, 0.62, 0.1, '#ff9ad5', ['cache', 'hit 0%??']);
  note(0.08, 0.55, 0.06, '#9ae8ff', ['repro:', '/checkout']);
  // strings: all over the place at first; boardFocus swings every string's far end onto the Cache
  const pairs: [string, string][] = [['function', 'handler'], ['handler', 'cache'], ['logs', 'function'], ['traces', 'handler'], ['logs', 'traces'], ['traces', 'cache'], ['function', 'traces']];
  const strings = clamp(s.boardStrings);
  const cache = P('cache');
  // chorus 2: the strings (and the ring) move on from the Cache to the handler path's photo
  const pathPin = { x: PATH_PIN[0] * W, y: PATH_PIN[1] * H };
  const re = s.boardRetarget ?? 0;
  const target = { x: lerp(cache.x, pathPin.x, re), y: lerp(cache.y, pathPin.y, re) };
  g.lineCap = 'round';
  pairs.forEach(([a, b], i) => {
    const k = clamp(strings * pairs.length - i);
    if (k <= 0) return;
    const A = P(a), B0 = P(b);
    const B = { x: lerp(B0.x, target.x, smooth(s.boardFocus)), y: lerp(B0.y, target.y, smooth(s.boardFocus)) };
    const ex = lerp(A.x, B.x, k), ey = lerp(A.y, B.y, k);
    // sag while slack; once the line is taut it can twang (a quick vibration the shot decays)
    const sag = (1 - s.boardFocus) * (1 - clamp(line)) * 0.06 * H + s.boardTwang * 0.035 * H * Math.sin(f.t * 52 + i * 0.7);
    g.strokeStyle = '#7a0816'; g.lineWidth = W * 0.011;
    g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo((A.x + ex) / 2, (A.y + ey) / 2 + sag, ex, ey); g.stroke();
    g.strokeStyle = '#e0142c'; g.lineWidth = W * 0.007;
    g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo((A.x + ex) / 2, (A.y + ey) / 2 + sag, ex, ey); g.stroke();
  });
  // polaroids of the suspects, drawn on-model
  const INKC = '#2b1d16';
  const photo = (k: string, label: string, draw: (cx: number, cy: number, r: number) => void, at?: { x: number; y: number }) => {
    const { x, y } = at ?? P(k), w = W * 0.17, h = W * 0.19;
    g.save(); g.translate(x, y); g.rotate((hash(k.length, 76) - 0.5) * 0.2);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 5 * px, -h / 2 + 5 * px, w, h);
    g.fillStyle = '#e6dcc6'; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#231a3a'; g.fillRect(-w / 2 + w * 0.08, -h / 2 + w * 0.08, w * 0.84, w * 0.84);
    g.save(); g.beginPath(); g.rect(-w / 2 + w * 0.08, -h / 2 + w * 0.08, w * 0.84, w * 0.84); g.clip();
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(0, -h / 2 + w * 0.5, w * 0.3);
    g.restore();
    g.fillStyle = INKC; g.font = `700 ${w * (label.length > 8 ? 0.11 : 0.15)}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 0, h / 2 - w * 0.12);
    g.fillStyle = '#e0142c'; g.beginPath(); g.arc(0, -h / 2 + 4 * px, 7 * px, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(-2 * px, -h / 2 + 2 * px, 2.2 * px, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  photo('function', 'fn()', (cx, cy, r) => {
    g.fillStyle = INKC; g.fillRect(cx - r * 0.95, cy - r * 0.75, r * 1.9, r * 1.75);
    g.fillStyle = '#8f8a9e'; g.fillRect(cx - r * 0.85, cy - r * 0.65, r * 1.7, r * 1.6);
    g.strokeStyle = 'rgba(240,236,250,0.8)'; g.lineWidth = 1.2 * px;
    for (let i = 0; i < 4; i++) { const a = (i / 3) * Math.PI / 2; g.beginPath(); g.moveTo(cx - r * 0.85, cy - r * 0.65); g.lineTo(cx - r * 0.85 + Math.cos(a) * r * 0.6, cy - r * 0.65 + Math.sin(a) * r * 0.6); g.stroke(); }
    g.fillStyle = '#f2efe6'; g.fillRect(cx - r * 0.5, cy - r * 0.45, r * 0.35, r * 0.1); g.fillRect(cx + r * 0.15, cy - r * 0.45, r * 0.35, r * 0.1);
    g.strokeStyle = '#d9b44a'; g.lineWidth = 2.5 * px;
    g.beginPath(); g.arc(cx - r * 0.32, cy - r * 0.12, r * 0.24, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx + r * 0.32, cy - r * 0.12, r * 0.24, 0, Math.PI * 2); g.stroke();
    g.fillStyle = INKC; g.fillRect(cx - r * 0.36, cy - r * 0.16, r * 0.08, r * 0.12); g.fillRect(cx + r * 0.28, cy - r * 0.16, r * 0.08, r * 0.12);
    g.fillStyle = '#e8dfc6'; g.fillRect(cx - r * 0.6, cy + r * 0.35, r * 0.62, r * 0.28);
    g.fillStyle = INKC; g.font = `700 ${r * 0.2}px ${TERM_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('fn()', cx - r * 0.29, cy + r * 0.5);
  });
  photo('handler', 'handler', (cx, cy, r) => {
    g.fillStyle = INKC; g.beginPath(); g.moveTo(cx - r * 1.05, cy + r * 1.1); g.lineTo(cx - r * 0.7, cy - r * 0.1); g.lineTo(cx + r * 0.7, cy - r * 0.1); g.lineTo(cx + r * 1.05, cy + r * 1.1); g.fill();
    g.fillStyle = '#23222e'; g.beginPath(); g.moveTo(cx - r * 0.95, cy + r * 1.1); g.lineTo(cx - r * 0.64, cy - r * 0.02); g.lineTo(cx + r * 0.64, cy - r * 0.02); g.lineTo(cx + r * 0.95, cy + r * 1.1); g.fill();
    g.fillStyle = '#f2efe6'; g.beginPath(); g.moveTo(cx - r * 0.18, cy - r * 0.02); g.lineTo(cx + r * 0.18, cy - r * 0.02); g.lineTo(cx, cy + r * 0.45); g.fill();
    g.fillStyle = '#111'; g.fillRect(cx - r * 0.04, cy + r * 0.02, r * 0.08, r * 0.4);
    g.fillStyle = INKC; g.beginPath(); g.arc(cx, cy - r * 0.48, r * 0.44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a5a3a'; g.beginPath(); g.arc(cx, cy - r * 0.48, r * 0.38, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.fillRect(cx - r * 0.32, cy - r * 0.58, r * 0.64, r * 0.16);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(cx - r * 0.24, cy - r * 0.56, r * 0.1, r * 0.04);
    g.fillStyle = '#ffcc3d'; g.fillRect(cx - r * 0.6, cy + r * 0.25, r * 0.3, r * 0.14);
  });
  photo('cache', 'cache', (cx, cy, r) => {
    g.fillStyle = INKC; g.fillRect(cx - r * 0.68, cy - r * 0.9, r * 1.36, r * 2.0);
    g.fillStyle = '#5f8a5c'; g.fillRect(cx - r * 0.6, cy - r * 0.82, r * 1.2, r * 1.9);
    g.fillStyle = '#9cc7ea'; g.fillRect(cx - r * 1.0, cy + r * 0.1, r * 0.42, r * 0.95); g.fillRect(cx + r * 0.58, cy + r * 0.1, r * 0.42, r * 0.95);
    g.fillStyle = '#e8dfc6'; for (const yy of [0.25, 0.75]) { g.fillRect(cx - r * 0.2, cy + yy * r, r * 0.4, r * 0.1); }
    g.strokeStyle = '#d9b44a'; g.lineWidth = 2.5 * px; g.fillStyle = '#1a1a22';
    for (const sx of [-1, 1]) { g.beginPath(); g.roundRect(cx + sx * r * 0.27 - r * 0.22, cy - r * 0.45, r * 0.44, r * 0.26, r * 0.08); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(cx - r * 0.06, cy - r * 0.36); g.lineTo(cx + r * 0.06, cy - r * 0.36); g.stroke();
    g.strokeStyle = INKC; g.lineWidth = 2 * px; g.beginPath(); g.arc(cx + r * 0.05, cy - r * 0.08, r * 0.16, 0.2, Math.PI - 0.6); g.stroke();
  });
  photo('logs', 'logs', (cx, cy, r) => { for (let i = 0; i < 6; i++) { g.fillStyle = i === 3 ? '#ff3240' : '#45ff8a'; g.fillRect(cx - r * 0.9, cy - r * 0.8 + i * r * 0.32, r * (0.9 + hash(i, 77) * 0.9), r * 0.14); } });
  photo('traces', 'traces', (cx, cy, r) => { for (let i = 0; i < 4; i++) { g.fillStyle = ['#2fe2ff', '#ffae3d', '#45ff8a', '#ff3240'][i]; g.fillRect(cx - r * 0.9 + i * r * 0.25, cy - r * 0.7 + i * r * 0.45, r * (1.6 - i * 0.3), r * 0.25); } });
  // chorus 2: a red X scrawled over the Cache's photo (one stroke, then the other)
  const cx = clamp(s.boardCacheX ?? 0);
  if (cx > 0) {
    g.save(); g.translate(cache.x, cache.y + W * 0.01);
    g.strokeStyle = '#e0142c'; g.lineWidth = 7 * px; g.lineCap = 'round';
    const a = W * 0.075;
    for (const [k, sx] of [[clamp(cx * 2), 1], [clamp(cx * 2 - 1), -1]] as const) {
      if (k <= 0) continue;
      g.beginPath(); g.moveTo(-a * sx, -a * 1.1); g.lineTo(lerp(-a, a, k) * sx, lerp(-a * 1.1, a * 1.1, k)); g.stroke();
    }
    g.restore();
  }
  // chorus 2: the handler path's polaroid, slapped on: the dusty coil with its tag, plug and all
  const pp = s.boardPath ?? 0;
  if (pp > 0.01) {
    g.save(); g.translate(pathPin.x, pathPin.y); g.rotate(0.07); g.scale(pp * 1.1, pp * 1.1); g.translate(-pathPin.x, -pathPin.y);
    photo('path', 'handler path', (cx2, cy2, r) => {
      g.strokeStyle = '#2fe2ff'; g.lineWidth = 3.2 * px;
      g.beginPath();
      for (let a = 0; a < Math.PI * 7; a += 0.2) {
        const rr = r * (0.18 + a * 0.032);
        const xx = cx2 + Math.cos(a) * rr, yy = cy2 + 0.1 * r + Math.sin(a) * rr * 0.75;
        if (a === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.lineTo(cx2 + r * 0.9, cy2 - r * 0.55);
      g.stroke();
      g.fillStyle = '#3b3648'; g.fillRect(cx2 + r * 0.72, cy2 - r * 0.92, r * 0.36, r * 0.4);
      g.fillStyle = '#e8bd4f'; g.fillRect(cx2 + r * 0.77, cy2 - r * 1.08, r * 0.07, r * 0.17); g.fillRect(cx2 + r * 0.96, cy2 - r * 1.08, r * 0.07, r * 0.17);
      g.fillStyle = '#e8dfc6'; g.fillRect(cx2 - r * 0.95, cy2 + r * 0.62, r * 0.55, r * 0.26);
    }, { x: pathPin.x, y: pathPin.y });
    g.restore();
  }
  // a red marker ring round the Cache's photo (chorus 2: round the handler path's)
  const ring = clamp(s.boardRing);
  if (ring > 0) {
    g.save(); g.translate(target.x, target.y + W * 0.02); g.rotate(-0.1);
    g.strokeStyle = '#e0142c'; g.lineWidth = 4.5 * px; g.lineCap = 'round';
    g.beginPath(); g.ellipse(0, 0, W * 0.12, W * 0.135, 0, -Math.PI * 0.6, -Math.PI * 0.6 + Math.PI * 2.15 * ring); g.stroke();
    g.restore();
  }
}
