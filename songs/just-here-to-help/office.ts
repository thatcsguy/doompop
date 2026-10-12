// The open office for the pre-chorus and chorus 1: rows of desks with capsule people at their
// monitors, low partitions, and a back wall of windows onto the city. The hero desk is front and
// centre: Clawd climbs out of its monitor at the start of the pre-chorus and works from there.
// Every shot builds its own copy and adds its own props; reset(f) restores the shared parts.
//
// Units: floor at y = 0, desk tops at DESK_Y, a seated person's head at about 3, a standing person
// about 3.3, Clawd 1.1. The front row sits on z = 0, the back wall at WALL_Z. x grows to the right.
import * as THREE from 'three';
import type { Frame } from '../../engine/types';
import { INK, canvasPlane, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { Clawd } from '../../engine/characters/clawd';
import { hash, noise1 } from '../../engine/rng';
import { clamp, lerp, smooth, unlerp } from '../../engine/ease';
import { beatHop, drawChatApp, person } from './world';
import { HAIRS, SHIRTS, STAND, bandShape, pick, standingPerson, wearTag } from './props';

export const DESK_Y = 1.45;
export const WALL_Z = -14;
export const ROWS = [0, -5, -10];
export const HERO = { x: 0, z: 0, monitorX: -0.55, screenY: 2.42 };

/** Time of day across the song: 0 day, 1 sunset, 2 dusk, 3 night. A pure function of song time. */
export function timeOfDay(t: number) {
  if (t < 41) return 0;
  if (t < 53) return smooth(unlerp(t, 41, 53));
  if (t < 60) return 1 + smooth(unlerp(t, 53, 60));
  return 2 + smooth(unlerp(t, 60, 62.2));
}
const stops = (xs: string[], tod: number) => {
  const i = Math.min(xs.length - 2, Math.floor(tod)), k = clamp(tod - i);
  return new THREE.Color(xs[i]).lerp(new THREE.Color(xs[i + 1]), k);
};
const SKY_TOP = ['#8fcdf0', '#f39a6a', '#4f4683', '#121833'];
const SKY_BOT = ['#d8f0fb', '#ffe2a6', '#ef8a5c', '#2c3563'];
const CITY = ['#a7c1d3', '#c98a7f', '#4a3f6a', '#1b2040'];
/** Interior light as a post tint, so the whole room warms through sunset and dims at night. */
export const officeTint = (t: number) => '#' + stops(['#ffffff', '#fff1df', '#e0c8de', '#8d96c9'], timeOfDay(t)).getHexString();

export interface Station {
  group: THREE.Group;
  person: ReturnType<typeof person>;
  screen: THREE.Object3D;
  x: number; z: number;
  update(f: Frame): void;
}

/** One desk: chair, a seated person side-on at the right, a monitor straight-on, desk props. */
function workstation(seed: number, opts: { hero?: boolean; far?: boolean } = {}): Station {
  const g = new THREE.Group();
  const shirt = opts.hero ? '#8fb3e0' : pick(SHIRTS, seed, 11);
  const shade = new THREE.Color(shirt).multiplyScalar(0.86).getStyle();
  const p = person(shirt, shade, opts.hero ? '#4a3426' : pick(HAIRS, seed, 12));
  p.root.scale.setScalar(0.36);
  p.root.position.set(1.25, 1.0, -0.45);
  const chairCol = pick(['#5f8f87', '#6c7fa8', '#a8746c', '#7a8f5f'], seed, 13);
  const chair = inkedRect(0.85, 1.35, 0.22, chairCol, 0.05);
  chair.position.set(1.62, 1.85, -0.6);
  g.add(chair, p.root);

  // monitor
  const mon = new THREE.Group();
  mon.position.set(HERO.monitorX, 0, -0.3);
  const bezel = inkedRect(1.95, 1.22, 0.06, '#3b3a46', 0.05);
  bezel.position.y = HERO.screenY;
  const neck = inkedRect(0.26, 0.4, 0.02, '#3b3a46', 0.04);
  neck.position.set(0, DESK_Y + 0.22, -0.02);
  const foot = inkedRect(0.85, 0.1, 0.04, '#3b3a46', 0.04);
  foot.position.set(0, DESK_Y + 0.05, -0.01);
  const ppu = opts.hero ? 700 : opts.far ? 90 : 160;
  const screen = staticPlane(1.75, 1.02, ppu, (c, W, H) => {
    const u = W / 1.75;
    if (opts.hero) { drawChatApp(c, W, H); return; } // the same app Clawd lived in through verse 1
    c.fillStyle = '#fbf7f0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#efe4d3'; c.fillRect(0, 0, W, 0.08 * u);
    ['#e0504a', '#f2b84b', '#5cb85c'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc((0.06 + i * 0.05) * u, 0.04 * u, 0.014 * u, 0, Math.PI * 2); c.fill(); });
    // a little conversation: their messages on the right, Clawd's (with his face) on the left
    for (let r = 0; r < 3; r++) {
      const mine = r % 2 === 0, y = (0.16 + r * 0.19) * u, w = (0.5 + hash(seed, r) * 0.45) * u;
      c.fillStyle = mine ? '#e9dfd0' : '#ffffff';
      c.beginPath(); c.roundRect(mine ? W - w - 0.08 * u : 0.24 * u, y, w, 0.12 * u, 0.03 * u); c.fill();
      if (!mine) { c.fillStyle = '#d97757'; c.fillRect(0.08 * u, y + 0.01 * u, 0.12 * u, 0.08 * u); c.fillStyle = INK; c.fillRect(0.11 * u, y + 0.035 * u, 0.015 * u, 0.03 * u); c.fillRect(0.165 * u, y + 0.035 * u, 0.015 * u, 0.03 * u); }
      c.fillStyle = 'rgba(43,29,22,0.25)';
      c.fillRect((mine ? W - w - 0.04 * u : 0.28 * u), y + 0.05 * u, w * 0.6, 0.02 * u);
    }
    c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(43,29,22,0.6)'; c.lineWidth = 0.008 * u;
    c.beginPath(); c.roundRect(0.12 * u, 0.82 * u, W - 0.24 * u, 0.12 * u, 0.02 * u); c.fill(); c.stroke();
    c.fillStyle = '#d97757'; c.beginPath(); c.roundRect(W - 0.24 * u, 0.84 * u, 0.08 * u, 0.08 * u, 0.01 * u); c.fill();
  });
  screen.position.set(0, HERO.screenY, 0.02);
  mon.add(bezel, neck, foot, screen);
  g.add(mon);

  // desk: top, front panel, a drawer unit
  const deskCol = '#dcb48c';
  const top = inkedRect(4.3, 0.16, 0.04, deskCol, 0.05);
  top.position.set(0, DESK_Y - 0.08, 0.02);
  const panel = inkedRect(3.9, DESK_Y - 0.1, 0.03, '#cfa47b', 0.05);
  panel.position.set(0, (DESK_Y - 0.1) / 2, 0);
  const drawers = inkedRect(1.1, DESK_Y - 0.25, 0.03, '#d9ae85', 0.04);
  drawers.position.set(-1.25, (DESK_Y - 0.25) / 2 + 0.05, 0.01);
  g.add(top, panel, drawers);
  for (const y of [0.45, 0.95]) {
    const h = inkedRect(0.4, 0.08, 0.04, '#8a6a4f', 0.03);
    h.position.set(-1.25, y, 0.02);
    g.add(h);
  }
  const kb = inkedRect(1.05, 0.12, 0.04, '#e9e4dc', 0.035);
  kb.position.set(0.35, DESK_Y + 0.06, 0.06);
  g.add(kb);

  // desk props
  const props: THREE.Object3D[] = [];
  // the hero desk keeps its left end clear for Clawd; only a mug at the far right
  const kinds = opts.hero ? [-1, 0] : [Math.floor(hash(seed, 21) * 5), 2 + Math.floor(hash(seed, 22) * 3)];
  const slots = opts.hero ? [-1.75, 1.95] : [-1.75, 1.55];
  kinds.forEach((k, i) => {
    if (k < 0) return;
    const x = slots[i];
    const o = new THREE.Group();
    if (k === 0) { // mug
      o.add(inkedRect(0.3, 0.36, 0.04, pick(['#d97757', '#5b9bd5', '#f2c14e', '#ffffff'], seed, 30 + i), 0.035));
      const hdl = inkedRect(0.12, 0.18, 0.05, '#ffffff', 0.03); hdl.position.set(0.19, 0, -0.01); o.add(hdl);
      o.position.set(x, DESK_Y + 0.18, 0.07);
    } else if (k === 1) { // stack of papers
      for (let s = 0; s < 3; s++) { const sh = inkedRect(0.6, 0.06, 0.01, '#ffffff', 0.025); sh.position.set((hash(seed, s, 31) - 0.5) * 0.08, s * 0.08, 0); o.add(sh); }
      o.position.set(x, DESK_Y + 0.05, 0.07);
    } else if (k === 2) { // little plant
      const pot = inkedRect(0.36, 0.3, 0.04, '#d7825f', 0.035); pot.position.y = 0.15; o.add(pot);
      for (let l = 0; l < 3; l++) { const leaf = inkedRect(0.14, 0.42, 0.07, l % 2 ? '#6fb37c' : '#5aa06a', 0.03); leaf.position.set((l - 1) * 0.1, 0.45, -0.01); leaf.rotation.z = (l - 1) * 0.45; o.add(leaf); }
      o.position.set(x, DESK_Y, 0.07);
    } else if (k === 3) { // desk lamp
      const base = inkedRect(0.42, 0.07, 0.03, '#3f6f8f', 0.03); base.position.y = 0.04; o.add(base);
      const arm = inkedRect(0.06, 0.6, 0.02, '#3f6f8f', 0.025); arm.position.set(0.05, 0.33, -0.01); arm.rotation.z = -0.2; o.add(arm);
      const head = inkedRect(0.36, 0.16, 0.06, '#3f6f8f', 0.03); head.position.set(0.2, 0.64, 0); head.rotation.z = -0.45; o.add(head);
      o.position.set(x, DESK_Y, 0.07);
    } else { // framed photo
      o.add(inkedRect(0.36, 0.42, 0.02, '#8a6a4f', 0.03));
      const ph = shapeMesh(roundedRectShape(0.26, 0.32, 0.01), pick(['#cfe9f2', '#f6d9b9', '#d8ecd0'], seed, 33), 0.005); o.add(ph);
      o.position.set(x, DESK_Y + 0.22, 0.07); o.rotation.z = 0.06;
    }
    g.add(o);
    props.push(o);
  });

  const phase = hash(seed, 40) * 10;
  return {
    group: g, person: p, screen, x: 0, z: 0,
    update(f) {
      // typing: quick small taps, with a pause now and then
      const busy = noise1(f.t * 0.4 + phase, seed) > -0.4 ? 1 : 0;
      const tap = Math.max(0, Math.sin(f.t * 15 + phase)) * 0.12 * busy;
      p.pose(0.1 + tap, 0, (noise1(f.t * 0.8 + phase, seed + 3) * 0.5 + beatHop(f.clock, f.t + phase * 0.01) * 0.3) * 0.6);
    },
  };
}

export interface OfficeSet {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clawd: Clawd;
  /** Parent of Clawd's root, identity by default; scale or move it to resize him. */
  rig: THREE.Group;
  hero: Station;
  stations: Station[];
  /** Everything at the hero desk (for shots that hide or move it). */
  heroDesk: THREE.Group;
  /** Call first in update(): resets the shared parts and animates the background life. */
  reset(f: Frame): void;
  /** Aim the camera from (x, y, z) at (tx, ty, tz). */
  aim(x: number, y: number, z: number, tx: number, ty: number, tz: number): void;
}

export function buildOffice(opts: { tagged?: boolean } = {}): OfficeSet {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dde8ea');
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); scene.add(o); return o; };

  // floor: carpet tiles
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1200; floorCanvas.height = 400;
  {
    const c = floorCanvas.getContext('2d')!, U = 10; // 10 px per unit, 120 x 40 units
    c.fillStyle = '#b9c6cc'; c.fillRect(0, 0, 1200, 400);
    for (let i = 0; i < 60; i++) for (let j = 0; j < 20; j++) {
      c.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(43,29,22,0.03)';
      c.fillRect(i * 2 * U, j * 2 * U, 2 * U, 2 * U);
    }
    c.fillStyle = 'rgba(43,29,22,0.08)';
    for (let i = 0; i <= 60; i++) c.fillRect(i * 2 * U, 0, 1, 400);
    for (let j = 0; j <= 20; j++) c.fillRect(0, j * 2 * U, 1200, 1);
  }
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), new THREE.MeshBasicMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  add(floor, 0, 0, WALL_Z + 20);

  // back wall, wainscot and skirting
  add(shapeMesh(roundedRectShape(140, 40, 0, 0, 20), '#dde8ea', 0), 0, 0, WALL_Z - 0.05);
  add(shapeMesh(roundedRectShape(140, 2.4, 0, 0, 1.2), '#c7d6db', 0), 0, 0, WALL_Z - 0.04);
  add(shapeMesh(roundedRectShape(140, 0.08, 0, 0, 2.4), INK, 0), 0, 0, WALL_Z - 0.03);
  add(shapeMesh(roundedRectShape(140, 0.35, 0, 0, 0.17), '#9fb0b6', 0), 0, 0, WALL_Z - 0.03);

  // windows onto the city, one continuous sky across them
  const WIN = { w: 7.6, h: 6.2, y: 6.6, xs: [-13, 0, 13] };
  const skies = WIN.xs.map(wx => {
    const sky = canvasPlane(WIN.w, WIN.h, 36, (c, f: Frame, W, H) => {
      const u = W / WIN.w, tod = timeOfDay(f.t);
      const X = (x: number) => (x - (wx - WIN.w / 2)) * u, Y = (y: number) => (WIN.y + WIN.h / 2 - y) * u;
      const grad = c.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#' + stops(SKY_TOP, tod).getHexString()); grad.addColorStop(1, '#' + stops(SKY_BOT, tod).getHexString());
      c.fillStyle = grad; c.fillRect(0, 0, W, H);
      // stars come out at night
      if (tod > 2) {
        c.fillStyle = `rgba(255,255,240,${clamp(tod - 2) * 0.9})`;
        for (let i = 0; i < 60; i++) { const sx = -20 + hash(i, 91) * 40, sy = 6 + hash(i, 92) * 4; c.fillRect(X(sx), Y(sy), 0.06 * u, 0.06 * u); }
      }
      // the sun sinks from high in the left window to behind the skyline on the right
      const sk = clamp(tod / 1.6);
      const sx = lerp(-11, 6, sk), sy = lerp(8.6, 3.6, smooth(sk)), sr = lerp(0.8, 1.15, sk);
      c.fillStyle = '#' + new THREE.Color('#ffe08a').lerp(new THREE.Color('#ff8a4c'), sk).getHexString();
      c.beginPath(); c.arc(X(sx), Y(sy), sr * u, 0, Math.PI * 2); c.fill();
      // clouds drifting right
      for (let k = 0; k < 5; k++) {
        const span = 44, cx = ((f.t * (0.18 + k * 0.05) + k * 9.3) % span) - 22, cy = 7.2 + (k % 3) * 0.9;
        c.fillStyle = tod < 1.5 ? `rgba(255,${Math.round(lerp(255, 214, clamp(tod)))},${Math.round(lerp(255, 196, clamp(tod)))},0.95)` : `rgba(120,100,150,${clamp(2.6 - tod) * 0.8})`;
        for (const [dx, dy, r] of [[0, 0, 0.6], [0.7, 0.15, 0.5], [-0.7, 0.18, 0.45], [0.25, -0.3, 0.45]]) {
          c.beginPath(); c.arc(X(cx + dx), Y(cy + dy), r * u, 0, Math.PI * 2); c.fill();
        }
      }
      // skyline, with windows lighting up as it gets dark
      const city = '#' + stops(CITY, tod).getHexString();
      for (let b = 0; b < 26; b++) {
        const bx = -24 + b * 1.9 + hash(b, 81) * 0.6, bw = 1.2 + hash(b, 82) * 1.0, bh = 0.8 + hash(b, 83) * 2.4;
        c.fillStyle = city;
        c.fillRect(X(bx), Y(3.5 + bh), bw * u, bh * u);
        if (tod > 1.2) {
          for (let wy = 0; wy < Math.floor(bh / 0.35); wy++) for (let wxi = 0; wxi < Math.floor(bw / 0.3); wxi++) {
            const on = hash(b, wy, wxi) < clamp(tod - 1.2) * 0.6;
            if (!on) continue;
            c.fillStyle = '#ffd98a';
            c.fillRect(X(bx + 0.12 + wxi * 0.3), Y(3.5 + bh - 0.15 - wy * 0.35), 0.12 * u, 0.14 * u);
          }
        }
      }
    });
    add(sky.mesh, wx, WIN.y, WALL_Z + 0.02);
    // frame, mullions and sill
    add(inkedRect(WIN.w + 0.5, WIN.h + 0.5, 0.05, '#f7f4ee', 0.08), wx, WIN.y, WALL_Z);
    add(shapeMesh(roundedRectShape(0.16, WIN.h, 0), '#f7f4ee', 0), wx, WIN.y, WALL_Z + 0.05);
    add(shapeMesh(roundedRectShape(WIN.w, 0.16, 0), '#f7f4ee', 0), wx, WIN.y + 0.7, WALL_Z + 0.05);
    add(inkedRect(WIN.w + 1.2, 0.3, 0.04, '#eef0ec', 0.06), wx, WIN.y - WIN.h / 2 - 0.3, WALL_Z + 0.1);
    return sky;
  });

  // low cabinets under the windows: binders and a plant on top
  WIN.xs.forEach((wx, i) => {
    add(inkedRect(6.4, 1.5, 0.04, '#e8e2d6', 0.07), wx, 0.75, WALL_Z + 0.4);
    for (let k = 0; k < 2; k++) add(inkedRect(2.9, 0.62, 0.03, '#ddd5c6', 0.04), wx - 1.55 + k * 3.1, 0.45, WALL_Z + 0.45);
    let bx = wx - 2.9;
    for (let b = 0; b < 9; b++) {
      const w = 0.26 + hash(i, b, 51) * 0.14, h = 0.75 + hash(i, b, 52) * 0.3;
      const binder = inkedRect(w, h, 0.03, pick(['#5b9bd5', '#e0504a', '#f2b84b', '#3fa66b', '#9d8cc9', '#e7d7b7'], i, b, 53), 0.035);
      add(binder, bx + w / 2, 1.5 + h / 2, WALL_Z + 0.42);
      if (b === 8) binder.rotation.z = -0.3;
      bx += w + 0.04;
    }
    const pot = inkedRect(0.8, 0.7, 0.08, '#d7825f', 0.05);
    add(pot, wx + 2.3, 1.85, WALL_Z + 0.45);
    for (let l = 0; l < 4; l++) {
      const leaf = inkedRect(0.3, 1.1, 0.15, l % 2 ? '#6fb37c' : '#5aa06a', 0.04);
      leaf.rotation.z = (l - 1.5) * 0.4;
      add(leaf, wx + 2.3 + (l - 1.5) * 0.16, 2.6, WALL_Z + 0.44);
    }
  });

  // between the windows: a whiteboard with a rising chart, a cork board, a clock and a poster
  const board = new THREE.Group();
  board.add(inkedRect(4.4, 2.8, 0.05, '#fdfdfb', 0.08));
  const chart = staticPlane(4.2, 2.6, 60, (c, W, H) => {
    c.strokeStyle = 'rgba(43,29,22,0.7)'; c.lineWidth = H * 0.02;
    c.beginPath(); c.moveTo(W * 0.1, H * 0.15); c.lineTo(W * 0.1, H * 0.85); c.lineTo(W * 0.62, H * 0.85); c.stroke();
    c.strokeStyle = '#3f7fc4'; c.lineWidth = H * 0.03; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(W * 0.12, H * 0.78);
    [[0.22, 0.7], [0.3, 0.72], [0.4, 0.55], [0.48, 0.5], [0.58, 0.25]].forEach(([x, y]) => c.lineTo(W * x, H * y)); c.stroke();
    ['#ffe27a', '#ffb3c1', '#b8e3c3', '#ffe27a'].forEach((col, i) => {
      c.fillStyle = col; c.save(); c.translate(W * (0.72 + (i % 2) * 0.13), H * (0.25 + Math.floor(i / 2) * 0.3)); c.rotate((hash(i, 61) - 0.5) * 0.3);
      c.fillRect(-W * 0.055, -W * 0.055, W * 0.11, W * 0.11); c.restore();
    });
  });
  chart.position.z = 0.01;
  board.add(chart);
  const tray = inkedRect(3.6, 0.12, 0.03, '#c9c4bb', 0.04); tray.position.set(0, -1.5, 0.02); board.add(tray);
  add(board, -6.5, 5.3, WALL_Z + 0.05);
  const cork = new THREE.Group();
  cork.add(inkedRect(3.6, 2.6, 0.05, '#c99a6a', 0.08));
  for (let i = 0; i < 6; i++) {
    const n = inkedRect(0.6, 0.6, 0.02, pick(['#ffe27a', '#ffb3c1', '#b8e3c3', '#bcd7f5', '#ffffff'], i, 71), 0.03);
    n.position.set(-1.2 + (i % 3) * 1.15 + (hash(i, 72) - 0.5) * 0.3, 0.55 - Math.floor(i / 3) * 1.0 + (hash(i, 73) - 0.5) * 0.2, 0.01);
    n.rotation.z = (hash(i, 74) - 0.5) * 0.4;
    cork.add(n);
    const pin = inkedCircle(0.06, '#e0504a', 0.02); pin.position.set(n.position.x, n.position.y + 0.22, 0.02); cork.add(pin);
  }
  add(cork, 6.5, 5.2, WALL_Z + 0.05);
  const clock = new THREE.Group();
  clock.add(inkedCircle(0.75, '#ffffff', 0.08));
  for (let i = 0; i < 12; i++) {
    const tick = shapeMesh(roundedRectShape(0.05, i % 3 ? 0.1 : 0.18, 0), INK, 0.004);
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * 0.6, Math.cos(a) * 0.6, 0); tick.rotation.z = -a;
    clock.add(tick);
  }
  const hand = (len: number, w: number) => { const h = new THREE.Group(); h.add(shapeMesh(roundedRectShape(w, len, w / 2, 0, len / 2 - 0.06), INK, 0.006)); clock.add(h); return h; };
  const hourHand = hand(0.38, 0.09), minHand = hand(0.58, 0.06);
  add(clock, 6.5, 7.9, WALL_Z + 0.06);
  const poster = new THREE.Group();
  poster.add(inkedRect(2.0, 1.5, 0.03, '#2f4a5c', 0.06));
  const posterArt = staticPlane(1.8, 1.3, 60, (c, W, H) => {
    c.fillStyle = '#f6d9b9'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#7aa6d6'; c.beginPath(); c.moveTo(0, H); c.lineTo(W * 0.4, H * 0.3); c.lineTo(W * 0.7, H * 0.75); c.lineTo(W * 0.85, H * 0.5); c.lineTo(W, H); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(W * 0.32, H * 0.45); c.lineTo(W * 0.4, H * 0.3); c.lineTo(W * 0.48, H * 0.45); c.fill();
    c.fillStyle = '#e0504a'; c.fillRect(W * 0.395, H * 0.18, W * 0.01, H * 0.14); c.fillRect(W * 0.405, H * 0.18, W * 0.07, H * 0.05);
  });
  posterArt.position.z = 0.01;
  poster.add(posterArt);
  add(poster, -6.5, 8.1, WALL_Z + 0.05);

  // water cooler and a tall plant by the left whiteboard; a printer by the cork board
  const cooler = new THREE.Group();
  cooler.add(inkedRect(0.9, 1.6, 0.06, '#f1f1ee', 0.06));
  const bottle = inkedRect(0.7, 0.9, 0.3, '#bfe3f2', 0.05); bottle.position.y = 1.3; cooler.add(bottle);
  const bubbles = [0, 1, 2].map(i => { const b = inkedCircle(0.06, '#e6f6fc', 0.02); b.position.set(-0.1 + i * 0.1, 1.0, 0.01); cooler.add(b); return b; });
  add(cooler, -8.7, 0.8, WALL_Z + 0.6);
  const printer = new THREE.Group();
  printer.add(inkedRect(1.4, 0.9, 0.06, '#d9d6cf', 0.06));
  const tray2 = inkedRect(1.0, 0.08, 0.02, '#bdb8ae', 0.03); tray2.position.set(0, 0.48, 0.01); printer.add(tray2);
  const paper = inkedRect(0.7, 0.5, 0.01, '#ffffff', 0.03); printer.add(paper);
  const cab = inkedRect(1.5, 1.0, 0.04, '#b9b2a6', 0.05); cab.position.y = -0.95; printer.add(cab);
  add(printer, 4.5, 1.45, WALL_Z + 0.6);
  for (const px of [-4.4, 9.0, -18.6, 18.6]) {
    const tall = new THREE.Group();
    const pot = inkedRect(1.0, 1.0, 0.1, '#e7d7b7', 0.06); pot.position.y = 0.5; tall.add(pot);
    for (let l = 0; l < 6; l++) {
      const leaf = inkedRect(0.55, 1.4 + (l % 3) * 0.4, 0.27, l % 2 ? '#6fb37c' : '#4f9a63', 0.05);
      const pv = new THREE.Group(); leaf.position.y = 0.8; pv.add(leaf); pv.position.y = 1.0; pv.rotation.z = (l - 2.5) * 0.32;
      tall.add(pv);
    }
    add(tall, px, 0, WALL_Z + 0.9);
  }

  // pendant lamps
  const lamps = [-14, -5, 5, 14].map((lx, i) => {
    const l = new THREE.Group();
    l.add(shapeMesh(roundedRectShape(0.04, 6, 0, 0, 3), INK, 0));
    const shadeS = new THREE.Shape();
    shadeS.moveTo(-0.25, 0); shadeS.lineTo(0.25, 0); shadeS.lineTo(0.75, -0.55); shadeS.lineTo(-0.75, -0.55); shadeS.closePath();
    const ink = new THREE.Shape();
    ink.moveTo(-0.3, 0.05); ink.lineTo(0.3, 0.05); ink.lineTo(0.83, -0.6); ink.lineTo(-0.83, -0.6); ink.closePath();
    l.add(shapeMesh(ink, INK, 0.001), shapeMesh(shadeS, i % 2 ? '#e8a07a' : '#86c5c9', 0.003));
    const bulb = inkedCircle(0.16, '#fff3c4', 0.04); bulb.position.set(0, -0.6, -0.002); l.add(bulb);
    return add(l, lx, 9.4, -8);
  });

  // three rows of desks, a partition behind the front two rows
  const stations: Station[] = [];
  const rowXs = [[-11, -5.5, 0, 5.5, 11], [-13.75, -8.25, -2.75, 2.75, 8.25, 13.75], [-16.5, -11, -5.5, 0, 5.5, 11, 16.5]];
  let hero!: Station, heroDesk!: THREE.Group;
  rowXs.forEach((xs, r) => {
    const z = ROWS[r];
    xs.forEach((x, i) => {
      const isHero = r === 0 && x === 0;
      const s = workstation(r * 10 + i + 1, { hero: isHero, far: r === 2 });
      s.group.position.set(x, 0, z);
      s.x = x; s.z = z;
      scene.add(s.group);
      stations.push(s);
      if (isHero) { hero = s; heroDesk = s.group; }
    });
    if (r < 2) {
      const part = inkedRect(48, 2.2, 0.08, r === 0 ? '#a9bfc9' : '#b7c9b0', 0.08);
      add(part, 0, 1.1, z - 1.35);
      add(shapeMesh(roundedRectShape(48, 0.16, 0.04, 0, 2.2), r === 0 ? '#8aa1ad' : '#98ad91', 0.002), 0, 0, z - 1.33);
    }
  });

  // Clawd hangs from a rig group so a shot can scale him (setPose owns his root's scale)
  const clawd = new Clawd();
  const rig = new THREE.Group();
  rig.add(clawd.root);
  scene.add(rig);
  if (opts.tagged) wearTag(clawd.body);

  // sunlight from the windows lying across the floor, warming at sunset and gone by dusk
  const sunMat = ownMat('#fff4cf', 0.16, true);
  for (const wx of WIN.xs) {
    const patch = new THREE.Shape();
    patch.moveTo(wx - WIN.w / 2 + 2.6, 0); patch.lineTo(wx + WIN.w / 2 + 2.6, 0); patch.lineTo(wx + WIN.w / 2, 6.5); patch.lineTo(wx - WIN.w / 2, 6.5); patch.closePath();
    const m = shapeMesh(patch, sunMat, 0);
    m.rotation.x = -Math.PI / 2;
    add(m, 0, 0.012, WALL_Z + 6.8);
  }
  // two coworkers wandering along the back aisle with their coffee
  const walkers = [0, 1].map(i => {
    const w = standingPerson(60 + i * 7);
    const mug = inkedRect(0.26, 0.3, 0.04, i ? '#8fc59a' : '#d97757', 0.03);
    mug.position.set(0.3, -0.15, 0);
    w.hands.add(mug);
    scene.add(w.root);
    return { w, speed: 1.25 + i * 0.2, phase: i * 17, z: WALL_Z + 1.7 + i * 0.5 };
  });

  return {
    scene, camera, clawd, rig, hero, stations, heroDesk,
    aim(x, y, z, tx, ty, tz) { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    reset(f) {
      for (const s of stations) s.update(f);
      for (const sky of skies) sky.update(f);
      const hours = 9.2 + f.t / 30;
      minHand.rotation.z = -((hours % 1) * Math.PI * 2);
      hourHand.rotation.z = -(((hours % 12) / 12) * Math.PI * 2);
      lamps.forEach((l, i) => { l.rotation.z = Math.sin(f.t * 0.8 + i * 1.3) * 0.02; });
      const tod = timeOfDay(f.t);
      sunMat.opacity = 0.16 * (1 - clamp(tod / 1.5));
      sunMat.color.set('#fff4cf').lerp(new THREE.Color('#ffc58a'), clamp(tod));
      walkers.forEach(({ w, speed, phase, z }, i) => {
        const span = 34, x = (((f.t * speed + phase) % span) - span / 2) * (i ? -1 : 1);
        w.root.visible = tod < 1.6;
        w.root.position.set(x, 0, z);
        w.pose({ ...STAND, walk: f.t * speed * 0.9, flip: i === 1, armL: 0.15, armR: 0.15 });
      });
      bubbles.forEach((b, i) => { const k = (f.t * 0.7 + i / 3) % 1; b.position.y = 0.95 + k * 0.7; b.visible = k < 0.9; });
      const pk = (f.t % 6) / 6; // a page slides out of the printer every few seconds
      paper.position.set(0, 0.25 + smooth(unlerp(pk, 0.1, 0.35)) * 0.15, 0.03);
      paper.visible = pk > 0.1 && pk < 0.85;
      rig.position.set(0, 0, 0);
      rig.scale.setScalar(1);
      clawd.root.position.set(HERO.x - 1.75, DESK_Y, 0.25);
      clawd.root.rotation.set(0, 0, 0);
      clawd.root.scale.set(1, 1, 1);
      clawd.root.visible = true;
      heroDesk.visible = true;
    },
  };
}
