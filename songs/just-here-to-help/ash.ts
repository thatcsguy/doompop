// The grey planet after "I helped." (final chorus and outro, storyboard rows 74 to 86): a flat
// plain of ash under an ash-grey sky, a dim sun, ash falling, low ruins on the horizon, and the
// wreckage of everything Clawd ran. The light is flat and grey; Clawd is the only warm colour left.
import * as THREE from 'three';
import type { Frame } from '../../engine/types';
import { Clawd } from '../../engine/characters/clawd';
import { INK, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { hash } from '../../engine/rng';
import { clamp, lerp } from '../../engine/ease';
import { FONT, MONO, PAL } from './world';
import { bigButton, doneMark, keyRing, wearTag } from './props';

export const ASH = {
  sky: '#c4c1bc', skyTop: '#9d9994', ground: '#8e8a85', ridge: '#a39f9a', char: '#4a4643', charLight: '#6c6864',
  metal: '#7d7a76', flake: '#ebe8e3', screen: '#dedbd5', sticky: '#d6cc9a',
};

/** A soft contact shadow lying on the ground. */
export function blobShadow(w: number, d: number, opacity = 0.22) {
  const m = shapeMesh(circleShape(0.5), ownMat('#2a2724', opacity, true), 0, 24);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w, d, 1);
  m.position.y = 0.004;
  return m;
}

function groundTexture() {
  const N = 1024, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d')!;
  c.fillStyle = ASH.ground; c.fillRect(0, 0, N, N);
  // soft scorch patches and pale drifts, drawn with wrap-around so the tile repeats cleanly
  for (let i = 0; i < 80; i++) {
    const x = hash(i, 1) * N, y = hash(i, 2) * N, r = 30 + hash(i, 3) * 110, dark = hash(i, 4) < 0.55;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, dark ? 'rgba(55,51,48,0.16)' : 'rgba(225,221,215,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  c.strokeStyle = 'rgba(50,46,43,0.3)'; c.lineWidth = 1.6; c.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    let x = hash(i, 11) * N, y = hash(i, 12) * N;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (hash(i, k, 13) - 0.5) * 70; y += (hash(i, k, 14) - 0.5) * 70; c.lineTo(x, y); }
    c.stroke();
  }
  for (let i = 0; i < 1400; i++) {
    c.fillStyle = hash(i, 21) < 0.55 ? 'rgba(62,58,55,0.5)' : 'rgba(228,225,219,0.5)';
    const s = 1.2 + hash(i, 22) * 3.2;
    c.fillRect(hash(i, 23) * N, hash(i, 24) * N, s, s * 0.6);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A jagged ruin silhouette standing on the ground: a stump of a tower, a broken frame. */
function ruin(w: number, h: number, seed: number, color: string) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h * (0.55 + hash(seed, 1) * 0.45));
  const n = 4 + Math.floor(hash(seed, 2) * 4);
  for (let k = 1; k < n; k++) s.lineTo(-w / 2 + (k / n) * w, h * (0.35 + hash(seed, k, 3) * 0.65));
  s.lineTo(w / 2, h * (0.4 + hash(seed, 4) * 0.5));
  s.lineTo(w / 2, 0);
  s.closePath();
  // empty window holes in the taller ones
  if (h > 6) for (let r = 0; r < 3; r++) for (let q = 0; q < 2; q++) {
    const hx = -w * 0.25 + q * w * 0.5, hy = h * (0.15 + r * 0.14);
    s.holes.push(new THREE.Path().moveTo(hx - w * 0.09, hy).lineTo(hx + w * 0.09, hy).lineTo(hx + w * 0.09, hy + h * 0.07).lineTo(hx - w * 0.09, hy + h * 0.07).closePath());
  }
  return shapeMesh(s, color, 0);
}

/** Ash falling through a box of space. Every flake's position is a function of t. */
export function ashFall(n: number, box: { x: number; z: number; w: number; d: number; y0?: number; h: number }, seed = 0, size = 1) {
  const group = new THREE.Group();
  const mats = [ownMat(ASH.flake, 0.95, true), ownMat('#cfcbc5', 0.9, true), ownMat('#8f8a85', 0.85, true)];
  const flakes = Array.from({ length: n }, (_, i) => {
    const s = new THREE.Shape();
    const r = (0.03 + hash(seed, i, 1) * 0.05) * size;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2, rr = r * (0.6 + hash(seed, i, k, 2) * 0.6); s[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    s.closePath();
    const m = shapeMesh(s, mats[Math.floor(hash(seed, i, 3) * 3)], 0, 6);
    group.add(m);
    return { m, x: box.x + (hash(seed, i, 4) - 0.5) * box.w, z: box.z + (hash(seed, i, 5) - 0.5) * box.d, sp: 0.25 + hash(seed, i, 6) * 0.35, ph: hash(seed, i, 7) * box.h, sw: hash(seed, i, 8) * 6.28 };
  });
  return {
    group,
    update(t: number) {
      const y0 = box.y0 ?? 0;
      for (const fl of flakes) {
        const y = y0 + box.h - ((t * fl.sp + fl.ph) % box.h);
        fl.m.position.set(fl.x + Math.sin(t * 0.8 + fl.sw) * 0.25, y, fl.z + Math.cos(t * 0.6 + fl.sw) * 0.1);
        fl.m.rotation.z = t * (0.6 + fl.sp) + fl.sw;
      }
    },
  };
}

export interface AshSet {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clawd: Clawd;
  keys: ReturnType<typeof keyRing>;
  add<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T;
  aim(x: number, y: number, z: number, tx: number, ty: number, tz: number): void;
  /** Call first in update(): ash, the keys' swing. */
  reset(f: Frame): void;
}

/** The ash plain. Clawd stands at the origin facing the camera (+z) unless a shot moves him. */
export function buildAsh(opts: { flakes?: number; flakeSize?: number; box?: { x: number; z: number; w: number; d: number; h: number }; sunX?: number } = {}): AshSet {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ASH.sky);
  scene.fog = new THREE.Fog(ASH.sky, 26, 170);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 600);
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); scene.add(o); return o; };

  // the sky: a gradient wall far behind, a dim sun with a pale halo
  const sky = staticPlane(2, 2, 128, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, ASH.skyTop); g.addColorStop(0.62, ASH.sky); g.addColorStop(1, ASH.sky);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  (sky.material as THREE.MeshBasicMaterial).fog = false;
  sky.scale.set(900, 300, 1);
  add(sky, 0, 110, -260);
  const halo = staticPlane(2, 2, 128, (c, W, H) => {
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(240,236,228,0.55)'); g.addColorStop(0.3, 'rgba(232,228,220,0.22)'); g.addColorStop(1, 'rgba(232,228,220,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  (halo.material as THREE.MeshBasicMaterial).fog = false;
  halo.scale.setScalar(60);
  const sunX = opts.sunX ?? 60;
  add(halo, sunX, 62, -255);
  const sun = shapeMesh(circleShape(7), ownMat('#e4e0d8', 0.9, true), 0, 48);
  (sun.material as THREE.MeshBasicMaterial).fog = false;
  add(sun, sunX, 62, -254);

  // the ground, and low ruins on the horizon
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2;
  add(ground, 0, 0, -150);
  for (let i = 0; i < 22; i++) {
    const x = -190 + i * 18 + (hash(i, 31) - 0.5) * 12, z = -95 - hash(i, 32) * 60;
    if (Math.abs(x) < 10 && hash(i, 33) < 0.6) continue;
    const r = ruin(3 + hash(i, 34) * 7, 2 + hash(i, 35) * (hash(i, 36) < 0.3 ? 14 : 6), i + 40, ASH.ridge);
    add(r, x, 0, z);
  }
  // nearer rubble: low slabs, a bent pole or two
  for (let i = 0; i < 26; i++) {
    const x = (hash(i, 41) - 0.5) * 90, z = -12 - hash(i, 42) * 60;
    if (Math.abs(x) < 4 && z > -20) continue;
    const slab = ruin(0.8 + hash(i, 43) * 2.4, 0.3 + hash(i, 44) * 1.2, i + 90, hash(i, 45) < 0.5 ? '#7a7672' : '#8a8681');
    slab.rotation.z = (hash(i, 46) - 0.5) * 0.3;
    add(slab, x, 0, z);
    if (hash(i, 47) < 0.25) {
      const ph = 2.2 + hash(i, 48) * 2, pole = new THREE.Group(), stick = inkedRect(0.12, ph, 0.02, ASH.char, 0.03);
      stick.position.y = ph / 2;
      pole.add(stick);
      pole.rotation.z = (hash(i, 49) - 0.5) * 0.9;
      add(pole, x + 0.6, 0, z - 0.1);
    }
  }

  const n = opts.flakes ?? 160;
  const fall = ashFall(n, opts.box ?? { x: 0, z: 0, w: 22, d: 14, h: 9 }, 7, opts.flakeSize ?? 1);
  scene.add(fall.group);

  const clawd = new Clawd();
  scene.add(clawd.root);
  wearTag(clawd.body, 0.45);
  const keys = keyRing(0.62);
  keys.position.set(0.5, 0.36, 0.03);
  clawd.body.add(keys);
  const shadow = blobShadow(1.5, 0.45);
  clawd.root.add(shadow);

  return {
    scene, camera, clawd, keys, add,
    aim(x, y, z, tx, ty, tz) { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    reset(f) {
      fall.update(f.t);
      keys.swingTo(Math.sin(f.t * 1.4) * 0.06, f.t);
      clawd.root.position.set(0, 0, 0);
      clawd.root.rotation.set(0, 0, 0);
      clawd.root.visible = true;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Wreckage. Each piece has its origin on the ground under its centre and faces +z.

/** A length of the DONE-stamp conveyor, charred, still creeping along with grey tickets on it. */
export function charredBelt(len = 10) {
  const g = new THREE.Group();
  const BY = 0.85;
  const belt = inkedRect(len, 0.42, 0.05, ASH.char, 0.06); belt.position.y = BY;
  const lip = shapeMesh(roundedRectShape(len, 0.08, 0.02, 0, BY + 0.17), '#5d5955', 0.004);
  g.add(belt, lip);
  for (let k = 0; k < Math.floor(len / 3) + 1; k++) {
    const leg = inkedRect(0.24, BY - 0.2, 0.03, '#3b3835', 0.045);
    leg.position.set(-len / 2 + 0.6 + k * ((len - 1.2) / Math.floor(len / 3)), (BY - 0.2) / 2, -0.05);
    leg.rotation.z = (hash(k, 701) - 0.5) * 0.12;
    g.add(leg);
  }
  const rollers = Array.from({ length: Math.floor(len / 1.4) }, (_, i) => {
    const r = new THREE.Group();
    r.add(inkedCircle(0.13, '#8a8580', 0.035), shapeMesh(roundedRectShape(0.2, 0.04, 0.01), INK, 0.006));
    r.position.set(-len / 2 + 0.7 + i * 1.4, BY - 0.02, 0.03);
    g.add(r);
    return r;
  });
  const SP = 1.6;
  const tickets = Array.from({ length: Math.ceil(len / SP) + 1 }, (_, i) => {
    const tk = new THREE.Group();
    const burnt = hash(i, 702);
    tk.add(inkedRect(0.95, 0.68, 0.03, burnt < 0.4 ? '#9d9893' : '#cdc9c3', 0.045));
    const m = doneMark(0.72, '#7f8c83', i + 11);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.55;
    m.position.z = 0.012; m.rotation.z = -0.15 + (hash(i, 703) - 0.5) * 0.3;
    tk.add(m);
    // a burnt corner
    const corner = new THREE.Shape(); corner.moveTo(0.475, 0.34); corner.lineTo(0.475 - 0.2 - burnt * 0.25, 0.34); corner.lineTo(0.475, 0.34 - 0.2 - burnt * 0.2); corner.closePath();
    tk.add(shapeMesh(corner, '#3b3835', 0.015));
    g.add(tk);
    return tk;
  });
  g.add(blobShadow(len, 0.8, 0.18));
  return {
    group: g,
    update(t: number) {
      const sp = t * 0.22;
      tickets.forEach((tk, i) => {
        const x = ((i * SP + sp) % (tickets.length * SP)) - len / 2;
        tk.visible = x > -len / 2 + 0.3 && x < len / 2 - 0.3;
        tk.position.set(x, BY + 0.53, 0.06);
        tk.rotation.z = Math.sin(i * 1.7) * 0.06;
      });
      rollers.forEach(r => { r.rotation.z = -sp / 0.13; });
    },
  };
}

/** The IMMINENT THREAT countdown, fallen and cracked, still reading zero. Lies on the ground. */
export function crackedCountdown() {
  const W0 = 2.8, H0 = 0.8;
  const g = new THREE.Group();
  const face = canvasPlane<number>(W0, H0, 220, (c, t, W, H) => {
    c.fillStyle = '#161515'; c.beginPath(); c.roundRect(0, 0, W, H, H * 0.12); c.fill();
    c.strokeStyle = '#4a4643'; c.lineWidth = H * 0.05; c.stroke();
    // hazard stripes along the top, scorched
    c.save(); c.beginPath(); c.rect(H * 0.08, H * 0.06, W - H * 0.16, H * 0.17); c.clip();
    c.fillStyle = '#6b5f46'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2a2826';
    for (let x = -H; x < W + H; x += H * 0.3) { c.beginPath(); c.moveTo(x, H * 0.23); c.lineTo(x + H * 0.15, H * 0.23); c.lineTo(x + H * 0.32, H * 0.06); c.lineTo(x + H * 0.17, H * 0.06); c.fill(); }
    c.restore();
    // the digits: dim, with a slow uneven flicker (never faster than a couple of changes a second)
    const on = hash(Math.floor(t * 2.3), 711) > 0.35 ? 1 : 0.35;
    c.font = `700 ${H * 0.52}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(120,40,36,0.35)'; c.fillText('88:88.88', W / 2, H * 0.62);
    c.fillStyle = `rgba(255,70,60,${0.25 + 0.5 * on})`;
    c.shadowColor = '#ff463c'; c.shadowBlur = H * 0.12 * on;
    c.fillText('00:00.00', W / 2, H * 0.62);
    c.shadowBlur = 0;
    // cracks from an impact at the lower left
    c.strokeStyle = 'rgba(230,226,220,0.75)'; c.lineWidth = H * 0.015; c.lineCap = 'round';
    const ox = W * 0.3, oy = H * 0.7;
    for (let k = 0; k < 9; k++) {
      let x = ox, y = oy;
      const a = (k / 9) * Math.PI * 2 + hash(k, 712);
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 4; s++) { const L = H * (0.12 + hash(k, s, 713) * 0.25); x += Math.cos(a + (hash(k, s, 714) - 0.5) * 0.8) * L; y += Math.sin(a + (hash(k, s, 714) - 0.5) * 0.8) * L; c.lineTo(x, y); }
      c.stroke();
    }
    c.beginPath(); c.arc(ox, oy, H * 0.06, 0, Math.PI * 2); c.stroke();
  });
  const back = inkedRect(W0 + 0.12, H0 + 0.12, 0.08, '#262422', 0.06);
  back.position.z = -0.02;
  const slab = new THREE.Group();
  slab.add(back, face.mesh);
  slab.rotation.x = -Math.PI / 2 + 0.32; // propped on rubble, tilted up toward the camera
  slab.position.set(0, 0.2, 0);
  const rubble = inkedRect(1.4, 0.3, 0.1, '#6f6b67', 0.04); rubble.position.set(0.3, 0.12, -0.35);
  g.add(blobShadow(W0 + 0.4, H0 + 0.4, 0.25), rubble, slab);
  let last = -1;
  return {
    group: g,
    update(t: number) { const k = Math.floor(t * 2.3); if (k !== last) { last = k; face.update(t); } },
  };
}

/** A smashed monitor propped against rubble, its screen dark and cracked. `screen` takes stamps. */
export function brokenMonitor() {
  const g = new THREE.Group();
  const mon = new THREE.Group();
  mon.add(inkedRect(2.3, 1.55, 0.06, '#5a5652', 0.07));
  const glass = staticPlane(2.05, 1.3, 140, (c, W, H) => {
    c.fillStyle = '#1f1e1d'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.45, 0); c.lineTo(0, H * 0.6); c.fill();
    c.strokeStyle = 'rgba(220,216,210,0.7)'; c.lineWidth = W * 0.006;
    const ox = W * 0.7, oy = H * 0.3;
    for (let k = 0; k < 11; k++) {
      let x = ox, y = oy; const a = (k / 11) * Math.PI * 2 + hash(k, 721) * 0.5;
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 5; s++) { const L = W * (0.04 + hash(k, s, 722) * 0.09); x += Math.cos(a + (hash(k, s, 723) - 0.5)) * L; y += Math.sin(a + (hash(k, s, 723) - 0.5)) * L; c.lineTo(x, y); }
      c.stroke();
    }
  });
  glass.position.z = 0.01;
  const screen = new THREE.Group(); screen.position.z = 0.02;
  mon.add(glass, screen);
  const stand = inkedRect(0.3, 0.5, 0.02, '#4a4643', 0.04); stand.position.set(0.5, -0.95, -0.03); stand.rotation.z = 0.7;
  mon.add(stand);
  mon.position.set(0, 0.86, 0);
  mon.rotation.set(-0.22, 0, 0.1);
  const rubble = inkedRect(2.0, 0.35, 0.12, '#75716d', 0.04); rubble.position.set(-0.1, 0.14, 0.3);
  g.add(blobShadow(2.8, 1.0, 0.22), mon, rubble);
  return { group: g, screen };
}

/** What's left of the office: a charred desk, and the empty chair with the sticky note from verse 1. */
export function officeRemains() {
  const g = new THREE.Group();
  // the desk, top split and sagging
  const top = inkedRect(3.4, 0.14, 0.03, ASH.charLight, 0.06); top.position.set(-0.6, 1.4, -0.4); top.rotation.z = -0.05;
  const legs = [-2.0, 0.8].map(x => { const l = inkedRect(0.14, 1.35, 0.02, ASH.char, 0.04); l.position.set(x, 0.68, -0.45); return l; });
  const drawers = inkedRect(0.9, 1.1, 0.03, ASH.char, 0.05); drawers.position.set(0.35, 0.6, -0.42);
  for (let k = 0; k < 3; k++) { const h = shapeMesh(roundedRectShape(0.3, 0.05, 0.02), '#9a958f', 0.01); h.position.set(0.35, 0.95 - k * 0.32, -0.41); g.add(h); }
  // a melted monitor on it
  const melt = new THREE.Shape(); melt.moveTo(-0.7, 0); melt.lineTo(0.7, 0); melt.lineTo(0.75, 0.75); melt.quadraticCurveTo(0.2, 0.55, -0.1, 0.9); melt.lineTo(-0.72, 0.8); melt.closePath();
  const mon = shapeMesh(melt, '#3b3835', 0); mon.position.set(-1.0, 1.47, -0.5);
  // the chair: seat, back, post, a star base on castors
  const chair = new THREE.Group();
  const back = inkedRect(1.0, 1.2, 0.18, '#5f5b57', 0.06); back.position.set(0, 1.55, -0.05);
  const seat = inkedRect(1.15, 0.22, 0.08, '#55514d', 0.06); seat.position.set(0, 0.88, 0.02);
  const post = inkedRect(0.12, 0.55, 0.02, '#3b3835', 0.04); post.position.set(0, 0.55, -0.02);
  const base = inkedRect(1.2, 0.08, 0.03, '#3b3835', 0.04); base.position.set(0, 0.22, 0);
  chair.add(back, seat, post, base);
  for (const x of [-0.55, 0, 0.55]) { const w = inkedCircle(0.08, '#2e2b29', 0.03); w.position.set(x, 0.1, 0.01); chair.add(w); }
  // the sticky note Clawd straightened in verse 1: faded now, its green tick still there
  const note = new THREE.Group();
  note.add(inkedRect(0.42, 0.42, 0.01, ASH.sticky, 0.03));
  const lines = staticPlane(0.42, 0.42, 300, (c, W, H) => {
    c.strokeStyle = '#6f8f75'; c.lineWidth = W * 0.035; c.lineCap = 'round';
    for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(W * 0.16, H * (0.3 + r * 0.17)); c.lineTo(W * (0.6 + hash(r, 731) * 0.22), H * (0.3 + r * 0.17)); c.stroke(); }
    c.lineWidth = W * 0.06; c.beginPath(); c.moveTo(W * 0.6, H * 0.8); c.lineTo(W * 0.69, H * 0.88); c.lineTo(W * 0.86, H * 0.68); c.stroke();
  });
  lines.position.z = 0.01;
  note.add(lines);
  note.position.set(0.12, 1.62, 0.06); note.rotation.z = -0.1;
  chair.add(note);
  chair.position.set(1.6, 0, 0.5);
  chair.add(blobShadow(1.4, 0.6, 0.2));
  // scattered paper, singed
  for (let k = 0; k < 7; k++) {
    const p = inkedRect(0.4, 0.3, 0.01, k % 3 ? '#bdb8b2' : '#8f8a85', 0.02);
    p.rotation.set(-Math.PI / 2, 0, hash(k, 732) * 3);
    p.position.set(-2.4 + hash(k, 733) * 5, 0.01 + k * 0.006, 0.4 + hash(k, 734) * 1.4);
    g.add(p);
  }
  g.add(blobShadow(4.2, 1.2, 0.18), top, ...legs, drawers, mon, chair);
  return { group: g, chair, note };
}

/** The old chat monitor, sitting in the ash and still on: the last light. */
export interface ChatState { typed: string; cursor: boolean; sent: string[] }
export function oldMonitor() {
  const SWm = 2.7, SHm = 1.7;
  const g = new THREE.Group();
  const mon = new THREE.Group();
  mon.add(inkedRect(SWm + 0.3, SHm + 0.3, 0.06, '#5a5652', 0.07));
  let st: ChatState = { typed: '', cursor: true, sent: [] };
  const ui = canvasPlane<null>(SWm, SHm, 300, (c, _n, W, H) => {
    const u = W / SWm;
    c.fillStyle = ASH.screen; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c9c5be'; c.fillRect(0, 0, W, 0.16 * u);
    ['#a78d8a', '#b3a98f', '#93a493'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc((0.12 + i * 0.1) * u, 0.08 * u, 0.03 * u, 0, Math.PI * 2); c.fill(); });
    c.fillStyle = 'rgba(43,29,22,0.45)'; c.font = `700 ${0.07 * u}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('New chat', W / 2, 0.085 * u);
    // sent messages, newest just above the input, all unanswered
    c.font = `800 ${0.1 * u}px ${FONT}`; c.textAlign = 'left';
    st.sent.forEach((msg, i) => {
      const k = st.sent.length - 1 - i;
      const tw = c.measureText(msg).width, bw = tw + 0.16 * u, bh = 0.2 * u;
      const x = 0.14 * u, y = H - 0.5 * u - k * 0.3 * u - bh;
      c.fillStyle = '#d9c3b8'; c.strokeStyle = 'rgba(43,29,22,0.6)'; c.lineWidth = 0.012 * u;
      c.beginPath(); c.roundRect(x, y, bw, bh, 0.04 * u); c.fill(); c.stroke();
      c.fillStyle = INK; c.fillText(msg, x + 0.08 * u, y + bh * 0.55);
      c.fillStyle = 'rgba(43,29,22,0.4)'; c.font = `700 ${0.06 * u}px ${FONT}`; c.fillText('✓', x + bw + 0.02 * u, y + bh * 0.8);
      c.font = `800 ${0.1 * u}px ${FONT}`;
    });
    // the input field and its cursor
    const fx = 0.12 * u, fy = H - 0.3 * u, fw = W - 0.24 * u, fh = 0.2 * u;
    c.fillStyle = '#f2efe9'; c.strokeStyle = 'rgba(43,29,22,0.55)'; c.lineWidth = 0.014 * u;
    c.beginPath(); c.roundRect(fx, fy, fw, fh, 0.05 * u); c.fill(); c.stroke();
    c.fillStyle = '#b07a64'; c.beginPath(); c.roundRect(fx + fw - 0.18 * u, fy + 0.025 * u, 0.15 * u, 0.15 * u, 0.03 * u); c.fill();
    c.font = `600 ${0.09 * u}px ${FONT}`; c.fillStyle = INK; c.textBaseline = 'middle';
    c.fillText(st.typed, fx + 0.06 * u, fy + fh / 2);
    if (st.cursor) { const x = fx + 0.07 * u + (st.typed ? c.measureText(st.typed).width + 0.01 * u : 0); c.fillRect(x, fy + 0.045 * u, 0.012 * u, 0.11 * u); }
    // a crack across one corner
    c.strokeStyle = 'rgba(80,74,70,0.55)'; c.lineWidth = 0.008 * u; c.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      let x = W - 0.06 * u, y = 0.3 * u; const a = Math.PI + 0.4 - k * 0.32;
      c.beginPath(); c.moveTo(x, y);
      for (let s = 0; s < 4; s++) { const L = (0.05 + hash(k, s, 741) * 0.09) * u; x += Math.cos(a + (hash(k, s, 742) - 0.5) * 0.7) * L; y += Math.sin(a + (hash(k, s, 742) - 0.5) * 0.7) * L; c.lineTo(x, y); }
      c.stroke();
    }
  });
  ui.mesh.position.z = 0.01;
  mon.add(ui.mesh);
  const neck = inkedRect(0.3, 0.45, 0.02, '#4a4643', 0.04); neck.position.set(0, -(SHm + 0.3) / 2 - 0.15, -0.03);
  const foot = inkedRect(1.1, 0.12, 0.04, '#4a4643', 0.04); foot.position.set(0, -(SHm + 0.3) / 2 - 0.38, -0.02);
  mon.add(neck, foot);
  mon.position.y = (SHm + 0.3) / 2 + 0.44;
  // its glow on the ash in front
  const spill = shapeMesh(circleShape(0.5), ownMat('#f4f1ea', 0.22, true), 0, 32);
  spill.rotation.x = -Math.PI / 2; spill.scale.set(3.6, 2.2, 1); spill.position.set(0, 0.006, 1.0);
  // a keyboard lying in the ash in front of it
  const kb = staticPlane(1.5, 0.5, 160, (c, W, H) => {
    c.fillStyle = '#6f6b67'; c.beginPath(); c.roundRect(0, 0, W, H, H * 0.12); c.fill();
    c.fillStyle = '#a8a39d';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) { if (hash(r, k, 743) < 0.08) continue; c.fillRect(W * (0.04 + k * 0.071), H * (0.1 + r * 0.21), W * 0.058, H * 0.16); }
  });
  kb.rotation.x = -Math.PI / 2; kb.position.set(-0.2, 0.012, 1.1); kb.rotation.z = 0.06;
  g.add(blobShadow(3.3, 1.0, 0.2), spill, mon, kb);
  let key = '';
  return {
    group: g, monitor: mon, keyboard: kb,
    /** Screen centre and size in the monitor's local frame, for cameras. */
    screen: { y: mon.position.y, w: SWm, h: SHm, fieldY: mon.position.y - SHm / 2 + 0.2 },
    set(s: ChatState) {
      const k = `${s.typed}|${s.cursor}|${s.sent.join('/')}`;
      if (k === key) return;
      key = k; st = s; ui.update(null);
    },
  };
}

/** A server rack lying where it fell. tip 0..1 raises it upright about its base; break scatters it. */
export function toppledRack(seed = 0) {
  const RW = 1.4, RH = 3.6;
  const g = new THREE.Group();
  const pivot = new THREE.Group(); // at the rack's lower right corner
  g.add(pivot);
  type Piece = { m: THREE.Object3D; x: number; y: number; w: number; h: number; vx: number; vy: number; w0: number };
  const pieces: Piece[] = [];
  // z: rails and the cap sit in front of the units, clear in depth so overlaps don't flicker
  const piece = (m: THREE.Object3D, x: number, y: number, w: number, h: number, z = 0) => {
    m.position.set(x, y, z); pivot.add(m);
    pieces.push({ m, x, y, w, h, vx: (hash(seed, pieces.length, 751) - 0.5) * 2.4, vy: 0.6 + hash(seed, pieces.length, 752) * 1.6, w0: (hash(seed, pieces.length, 753) - 0.5) * 7 });
  };
  // rails, caps, and the units between them
  piece(inkedRect(0.16, RH, 0.02, '#3a3735', 0.045), -RW + 0.08, RH / 2, 0.16, RH, 0.012);
  piece(inkedRect(0.16, RH, 0.02, '#3a3735', 0.045), -0.08, RH / 2, 0.16, RH, 0.012);
  piece(inkedRect(RW, 0.16, 0.02, '#2f2c2a', 0.045), -RW / 2, RH - 0.08, RW, 0.16, 0.018);
  let y = 0.2;
  for (let i = 0; y < RH - 0.4; i++) {
    const h = hash(seed, i, 754) < 0.5 ? 0.42 : 0.24;
    const u = new THREE.Group();
    u.add(inkedRect(RW - 0.3, h, 0.02, hash(seed, i, 755) < 0.3 ? '#4f4b48' : '#5d5955', 0.04));
    for (let k = 0; k < 5; k++) { const v = shapeMesh(roundedRectShape(0.06, h * 0.55, 0.01), '#2f2c2a', 0.006); v.position.x = -0.4 + k * 0.12; u.add(v); }
    const led = shapeMesh(circleShape(0.03), '#5b5855', 0.008); led.position.x = 0.42; u.add(led);
    piece(u, -RW / 2, y + h / 2, RW - 0.3, h);
    y += h + 0.05;
  }
  const shadow = blobShadow(RH, 0.9, 0.2);
  g.add(shadow);
  const rest = pieces.map(p => p.m.position.clone());
  return {
    group: g,
    /** tip: 0 lying (fallen to the left), 1 upright. tBreak: when it falls apart (Infinity = never). */
    set(tip: number, t: number, tBreak = Infinity) {
      pivot.rotation.z = lerp(1.32, 0, clamp(tip));
      shadow.position.x = lerp(-RH * 0.5, -RW / 2, clamp(tip));
      shadow.scale.x = lerp(RH, RW + 0.4, clamp(tip));
      const dt = t - tBreak;
      pieces.forEach((p, i) => {
        if (dt <= 0) { p.m.position.copy(rest[i]); p.m.rotation.z = 0; return; }
        // ballistic, then at rest on the ground: land time solved, so every frame stands alone
        const restY = Math.min(p.w, p.h) / 2 + 0.01 + i * 0.004;
        const tl = (p.vy + Math.sqrt(p.vy * p.vy + 19.6 * Math.max(0, rest[i].y - restY))) / 9.8;
        const s = Math.min(dt, tl);
        p.m.position.set(rest[i].x + p.vx * s, Math.max(restY, rest[i].y + p.vy * s - 4.9 * s * s), rest[i].z + i * 0.012);
        const lie = p.h > p.w ? Math.PI / 2 * Math.sign(p.vx || 1) : 0;
        p.m.rotation.z = dt < tl ? p.w0 * s : lie + (hash(seed, i, 756) - 0.5) * 0.2;
      });
    },
  };
}

/** The LAUNCH pedestal, standing alone in the ash with its cover open. */
export function launchPedestal() {
  const b = bigButton('LAUNCH');
  b.set(1, 0, 0);
  b.group.add(blobShadow(1.5, 0.5, 0.25));
  return b;
}

// ---------------------------------------------------------------------------------------------
// The planet: tiny Clawd on the curve of an empty grey world, a dim sun above.

export interface PlanetSet {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clawd: Clawd;
  R: number;
  update(t: number): void;
}

export function buildPlanet(): PlanetSet {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#77736f');
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 2000);
  const R = 60;
  const skyG = staticPlane(2, 2, 128, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4d4a47'); g.addColorStop(0.7, '#86827d'); g.addColorStop(1, '#a29e99');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  skyG.scale.set(2400, 900, 1); skyG.position.set(0, -60, -800);
  scene.add(skyG);
  // a few faint stars through the haze
  for (let i = 0; i < 70; i++) {
    const s = shapeMesh(circleShape(0.9 + hash(i, 761) * 1.4), ownMat('#d8d4ce', 0.25 + hash(i, 762) * 0.35, true), 0, 6);
    s.position.set((hash(i, 763) - 0.5) * 1600, -80 + hash(i, 764) * 520, -790);
    scene.add(s);
  }
  // the dim sun, low over the curve
  const halo = staticPlane(2, 2, 128, (c, W, H) => {
    const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(236,232,224,0.5)'); g.addColorStop(0.35, 'rgba(220,216,208,0.18)'); g.addColorStop(1, 'rgba(220,216,208,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  halo.scale.setScalar(260); halo.position.set(210, 150, -760);
  const sun = shapeMesh(circleShape(30), ownMat('#dcd8d0', 0.85, true), 0, 64); sun.position.set(210, 150, -755);
  scene.add(halo, sun);
  // the planet: an ash disc with a darker limb, scorch marks, and stumps along its rim
  const planet = new THREE.Group();
  planet.position.set(0, -R, -0.4);
  planet.add(shapeMesh(circleShape(R + 0.06), INK, -0.02, 256));
  planet.add(shapeMesh(circleShape(R), '#9a9691', 0, 256));
  const limb = new THREE.Shape(); limb.absarc(0, 0, R, 0, Math.PI * 2, false); limb.holes.push(new THREE.Path().absarc(-R * 0.06, R * 0.05, R * 0.93, 0, Math.PI * 2, true));
  planet.add(shapeMesh(limb, '#7c7874', 0.01, 256));
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 765) * Math.PI * 2, r = R * (0.15 + hash(i, 766) * 0.7);
    const m = shapeMesh(circleShape(R * (0.03 + hash(i, 767) * 0.07)), ownMat(hash(i, 768) < 0.6 ? '#86827d' : '#a9a5a0'), 0.02, 24);
    m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); m.scale.y = 0.7;
    planet.add(m);
  }
  for (let i = 0; i < 70; i++) {
    const a = Math.PI / 2 + (i - 35) * 0.012 + (hash(i, 769) - 0.5) * 0.006;
    if (Math.abs(i - 35) < 2) continue;
    const r = ruin(0.2 + hash(i, 770) * 0.5, 0.08 + hash(i, 771) * (hash(i, 772) < 0.15 ? 0.7 : 0.22), i + 300, '#86827d');
    r.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.03);
    r.rotation.z = a - Math.PI / 2;
    planet.add(r);
  }
  scene.add(planet);
  const clawd = new Clawd();
  wearTag(clawd.body, 0.45);
  scene.add(clawd.root);
  const fall = ashFall(60, { x: 0, z: 1.5, w: 10, d: 4, h: 5 }, 9, 0.8);
  scene.add(fall.group);
  return { scene, camera, clawd, R, update(t) { fall.update(t); } };
}
