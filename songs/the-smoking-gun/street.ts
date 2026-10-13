// Outside Club PROD on a wet night: a brick front with a big arched window into the (real) club
// set behind it, the CLUB PROD neon that buzzes on, a marquee over the door, a poster, a street
// lamp and rain. Built once per page like the club; a shot adds both roots to its scene.
import * as THREE from 'three';
import { inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { lerp } from '../../engine/ease';
import { hash, noise1 } from '../../engine/rng';
import { DISCO_FONT, PAL, SIGN_FONT, UI_FONT, beamTexture, cutout, glowMat, lightMat, ownGlow, radialTexture, setGlow } from './look';
import { Rain, lightPool } from './props';

export const FACADE_Z = 3.4;
export const WINDOW = { x: 0, y0: 0.9, w: 9.2, rectTop: 5.6, archH: 2.4 };
export const DOOR = { x: 7.3, w: 2.2, h: 3.7 };
const FW = 44, FH = 20, PPU = 56;

export interface StreetState {
  sign: number;        // CLUB part of the neon, 0..1
  prod: number;        // PROD part (it sputters: prod is down)
  marquee: number;     // marquee bulbs and text
  open: number;        // the OPEN sign in the window
  lamp: number;        // street lamp
}

export class Street {
  readonly root = new THREE.Group();
  readonly rain: Rain;
  private club!: THREE.MeshBasicMaterial;
  private prod!: THREE.MeshBasicMaterial;
  private clubGlow!: THREE.MeshBasicMaterial;
  private reflections: { mat: THREE.MeshBasicMaterial; k: number; color: string; base: number }[] = [];
  private bulbs!: THREE.InstancedMesh;
  private bulbMat!: THREE.MeshBasicMaterial;
  private marqueeText!: THREE.MeshBasicMaterial;
  private openMat!: THREE.MeshBasicMaterial;
  private lampMat!: THREE.MeshBasicMaterial;
  private lampBeam!: THREE.MeshBasicMaterial;
  private lampPool!: THREE.MeshBasicMaterial;
  private martini!: THREE.MeshBasicMaterial;
  private tmp = new THREE.Color();
  private m4 = new THREE.Matrix4();
  private bulbN = 0;

  constructor() {
    this.buildFacade();
    this.buildSign();
    this.buildDoor();
    this.buildGround();
    this.buildLamp();
    this.rain = new Rain({ x0: -16, x1: 16, z0: FACADE_Z + 0.3, z1: 24, top: 15 });
    this.root.add(this.rain.root);
  }

  private add<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T {
    o.position.set(x, y, z);
    this.root.add(o);
    return o;
  }

  private buildFacade() {
    // bricks, with the window panes and the door cut out (alpha-tested, so the club shows through)
    const facade = staticPlane(FW, FH, PPU, (g, W, H) => {
      const u = PPU;
      const X = (x: number) => (x + FW / 2) * u, Y = (y: number) => (FH - y) * u;
      g.fillStyle = '#2a1626'; g.fillRect(0, 0, W, H);
      const bw = 0.62, bh = 0.27;
      for (let r = 0; r * bh < FH; r++) {
        for (let c = -1; c * bw < FW + bw; c++) {
          const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
          const v = hash(r, c, 91);
          g.fillStyle = v < 0.15 ? '#3a1d2e' : v < 0.5 ? '#341a2b' : v < 0.85 ? '#2f1727' : '#41203a';
          g.fillRect(x * u + 1.5, (FH - y - bh) * u + 1.5, bw * u - 3, bh * u - 3);
        }
      }
      // grime toward the ground, a darker band at street level, a lighter cornice up top
      const grad = g.createLinearGradient(0, Y(3), 0, Y(0));
      grad.addColorStop(0, 'rgba(10,6,16,0)'); grad.addColorStop(1, 'rgba(10,6,16,0.6)');
      g.fillStyle = grad; g.fillRect(0, Y(3), W, 3 * u);
      g.fillStyle = '#1c1124'; g.fillRect(0, Y(0.6), W, 0.6 * u);
      g.fillStyle = '#3d2647'; g.fillRect(0, Y(13.4), W, 0.5 * u);
      g.fillStyle = '#1a0f22'; g.fillRect(0, Y(12.9), W, 0.12 * u);
      // window: a dark frame, then the panes cut out between the mullions
      const { x, y0, w, rectTop, archH } = WINDOW;
      const path = (pad: number) => {
        g.beginPath();
        g.moveTo(X(x - w / 2 - pad), Y(y0 - pad));
        g.lineTo(X(x - w / 2 - pad), Y(rectTop));
        g.ellipse(X(x), Y(rectTop), (w / 2 + pad) * u, (archH + pad) * u, 0, Math.PI, 0);
        g.lineTo(X(x + w / 2 + pad), Y(y0 - pad));
        g.closePath();
      };
      g.fillStyle = '#120a1a'; path(0.35); g.fill();
      g.fillStyle = '#4b2f5e'; path(0.22); g.fill();
      g.fillStyle = '#0e0814'; path(0.08); g.fill();
      g.save();
      path(0); g.clip();
      g.globalCompositeOperation = 'destination-out';
      const mull = 0.12;
      for (let k = 0; k < 3; k++) {
        const px0 = x - w / 2 + (w / 3) * k + mull / 2, px1 = x - w / 2 + (w / 3) * (k + 1) - mull / 2;
        g.fillRect(X(px0), Y(rectTop + archH + 1), (px1 - px0) * u, (rectTop + archH + 1 - 3.55) * u);
        g.fillRect(X(px0), Y(3.45), (px1 - px0) * u, (3.45 - y0) * u);
      }
      g.restore();
      // the sill
      g.fillStyle = '#5a3c6e'; g.fillRect(X(x - w / 2 - 0.5), Y(y0 - 0.05), (w + 1) * u, 0.22 * u);
      // door opening (the door itself is its own mesh in front)
      g.fillStyle = '#0a0610'; g.fillRect(X(DOOR.x - DOOR.w / 2 - 0.2), Y(DOOR.h + 0.2), (DOOR.w + 0.4) * u, (DOOR.h + 0.2) * u);
      // a drainpipe and a vent
      g.fillStyle = '#1d1424'; g.fillRect(X(-12.1), Y(FH), 0.32 * u, FH * u);
      for (let i = 0; i < 9; i++) { g.fillStyle = '#2b1f36'; g.fillRect(X(-12.18), Y(1 + i * 1.9), 0.48 * u, 0.12 * u); }
      g.fillStyle = '#20172c'; g.fillRect(X(11.5), Y(7.4), 1.6 * u, 1.0 * u);
      g.fillStyle = '#120c1a';
      for (let i = 0; i < 5; i++) g.fillRect(X(11.6), Y(7.3 - i * 0.19), 1.4 * u, 0.08 * u);
    });
    cutout(facade, 0.5);
    this.add(facade, 0, FH / 2, FACADE_Z);

    // window glass: faint reflections and rain trickles in front of the panes
    const glass = staticPlane(WINDOW.w, WINDOW.rectTop + WINDOW.archH - WINDOW.y0, 40, (g, W, H) => {
      for (const [a, b, w] of [[0.08, 0.34, 0.05], [0.18, 0.42, 0.015], [0.58, 0.8, 0.035]]) {
        g.strokeStyle = 'rgba(190,210,255,0.1)'; g.lineWidth = W * w;
        g.beginPath(); g.moveTo(W * a, H); g.lineTo(W * b, 0); g.stroke();
      }
    });
    const gm = glass.material as THREE.MeshBasicMaterial;
    gm.blending = THREE.AdditiveBlending;
    this.add(glass, WINDOW.x, (WINDOW.y0 + WINDOW.rectTop + WINDOW.archH) / 2, FACADE_Z + 0.03);

    // an OPEN sign hanging in the window corner
    const open = staticPlane(1.7, 0.6, 120, (g, W, H) => {
      g.fillStyle = '#ffffff'; g.font = `400 ${H * 0.72}px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('OPEN', W / 2, H * 0.55);
    });
    cutout(open, 0.3);
    this.openMat = open.material as THREE.MeshBasicMaterial;
    this.add(open, WINDOW.x + 3.1, 2.4, FACADE_Z + 0.05);

    // the poster: DJ CLAWD tonight
    const poster = staticPlane(2.2, 3.0, 110, (g, W, H) => {
      g.fillStyle = '#f2d34f'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ff3ea5'; g.fillRect(W * 0.06, H * 0.05, W * 0.88, H * 0.58);
      // Clawd silhouette: afro and a blocky body
      g.fillStyle = '#1a0d2a';
      g.beginPath(); g.ellipse(W * 0.5, H * 0.28, W * 0.3, H * 0.17, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(W * 0.28, H * 0.33, W * 0.44, H * 0.24);
      g.fillStyle = '#ffd23f';
      g.fillRect(W * 0.33, H * 0.39, W * 0.14, H * 0.05); g.fillRect(W * 0.53, H * 0.39, W * 0.14, H * 0.05);
      g.fillStyle = '#1a0d2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `400 ${H * 0.11}px ${DISCO_FONT}`; g.fillText('DJ CLAWD', W / 2, H * 0.73);
      g.font = `800 ${H * 0.055}px ${UI_FONT}`; g.fillText('LIVE TONIGHT', W / 2, H * 0.84);
      g.font = `800 ${H * 0.04}px ${UI_FONT}`; g.fillText('ALL NIGHT DEBUGGING', W / 2, H * 0.92);
      // torn corner
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.moveTo(W, H * 0.86); g.lineTo(W * 0.82, H); g.lineTo(W, H); g.closePath(); g.fill();
    });
    cutout(poster, 0.5);
    poster.rotation.z = 0.03;
    this.add(poster, -8.2, 3.2, FACADE_Z + 0.04);
  }

  private buildSign() {
    // backing board with brackets, then CLUB and PROD as separate tubes (PROD sputters)
    this.add(inkedRect(13.6, 3.0, 0.2, '#140b22', 0.1), 0, 10.4, FACADE_Z + 0.25);
    for (const x of [-5.6, 5.6]) this.add(inkedRect(0.2, 1.4, 0.05, '#2c2238', 0.04), x, 11.9, FACADE_Z + 0.2);
    const word = (text: string, w: number, x: number) => {
      const p = staticPlane(w, 2.4, 90, (g, W, H) => {
        g.font = `400 ${H * 0.72}px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#ffffff'; g.fillText(text, W / 2, H * 0.55);
      });
      cutout(p, 0.35);
      this.add(p, x, 10.4, FACADE_Z + 0.4);
      return p.material as THREE.MeshBasicMaterial;
    };
    this.club = word('CLUB', 5.6, -3.15);
    this.prod = word('PROD', 5.8, 3.05);
    this.clubGlow = lightMat(PAL.pink, 0, radialTexture());
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(20, 7), this.clubGlow), 0, 10.4, FACADE_Z + 0.3);
    // a neon martini glass up and left, and a pink tube along the cornice
    const glass = new THREE.Group();
    this.martini = ownGlow(PAL.cyan, 2);
    const seg = (a: [number, number], b: [number, number]) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = shapeMesh(roundedRectShape(len + 0.1, 0.1, 0.05), this.martini, 0);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
      glass.add(m);
    };
    seg([-1, 1], [1, 1]); seg([1, 1], [0, -0.2]); seg([0, -0.2], [-1, 1]); seg([0, -0.2], [0, -1.2]); seg([-0.55, -1.2], [0.55, -1.2]);
    const olive = shapeMesh(circleOf(0.16), glowMat('#7dff6a', 2.2), 0.01);
    olive.position.set(0.3, 0.65, 0.01);
    glass.add(olive);
    this.add(glass, -11.2, 9.6, FACADE_Z + 0.2);
  }

  private buildDoor() {
    const d = new THREE.Group();
    d.add(inkedRect(DOOR.w, DOOR.h, 0.08, '#4a2668', 0.06));
    d.add(shapeMesh(roundedRectShape(DOOR.w - 0.4, DOOR.h - 0.5, 0.06, 0, -0.1), '#3d1f57', 0.004));
    const port = inkedCircle(0.36, lightMat('#ff5fb0', 0.9), 0.08);
    port.position.set(0, 0.85, 0.006);
    d.add(port);
    const handle = inkedRect(0.1, 0.5, 0.05, '#e0b04a', 0.03);
    handle.position.set(0.72, -0.1, 0.008);
    d.add(handle);
    this.add(d, DOOR.x, DOOR.h / 2, FACADE_Z + 0.05);
    // the marquee over the door: TONIGHT / THE SMOKING GUN, ringed with chasing bulbs
    const mw = 5.2, mh = 1.5, my = DOOR.h + 1.05, mz = FACADE_Z + 0.55;
    this.add(inkedRect(mw, mh, 0.12, '#1b1030', 0.08), DOOR.x, my, mz);
    this.add(inkedRect(mw - 0.5, mh - 0.42, 0.06, '#f6efe0', 0.04), DOOR.x, my, mz + 0.01);
    const txt = staticPlane(mw - 0.6, mh - 0.5, 120, (g, W, H) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#2b1d16'; g.font = `800 ${H * 0.22}px ${UI_FONT}`; g.fillText('TONIGHT', W / 2, H * 0.2);
      g.fillStyle = '#c4122e'; g.font = `400 ${H * 0.42}px ${DISCO_FONT}`; g.fillText('The Smoking Gun', W / 2, H * 0.64);
    });
    cutout(txt, 0.3);
    this.marqueeText = txt.material as THREE.MeshBasicMaterial;
    this.add(txt, DOOR.x, my, mz + 0.03);
    // bulbs round the edge
    const pts: [number, number][] = [];
    const per = 0.32;
    for (let x = -mw / 2 + 0.16; x <= mw / 2 - 0.15; x += per) { pts.push([x, mh / 2 - 0.1]); pts.push([x, -mh / 2 + 0.1]); }
    for (let y = -mh / 2 + 0.38; y <= mh / 2 - 0.3; y += per) { pts.push([-mw / 2 + 0.1, y]); pts.push([mw / 2 - 0.1, y]); }
    this.bulbN = pts.length;
    this.bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.bulbs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 10), this.bulbMat, pts.length);
    pts.forEach(([x, y], i) => {
      this.m4.makeTranslation(DOOR.x + x, my + y, mz + 0.05);
      this.bulbs.setMatrixAt(i, this.m4);
      this.bulbs.setColorAt(i, new THREE.Color('#ffd27a'));
    });
    this.bulbs.userData.order = pts.map(([x, y]) => Math.atan2(y, x));
    this.root.add(this.bulbs);
    // canopy supports
    for (const sx of [-mw / 2 + 0.3, mw / 2 - 0.3]) this.add(inkedRect(0.08, 0.7, 0.02, '#2c2238', 0.03), DOOR.x + sx, my + mh / 2 + 0.3, mz - 0.25);
    // a wall lamp by the door
    this.add(inkedRect(0.3, 0.42, 0.08, '#2c2238', 0.04), DOOR.x - 1.7, 3.2, FACADE_Z + 0.08);
    this.add(shapeMesh(circleOf(0.12), glowMat('#ffcf7a', 2.2), 0.01), DOOR.x - 1.7, 3.15, FACADE_Z + 0.14);
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), lightMat('#ffb35a', 0.22, radialTexture())), DOOR.x - 1.7, 3.0, FACADE_Z + 0.12);
    // a bin
    this.add(inkedRect(0.9, 1.15, 0.12, '#2a3a44', 0.05), 10.2, 0.58, FACADE_Z + 0.5);
    this.add(inkedRect(1.02, 0.14, 0.05, '#1d2a32', 0.04), 10.2, 1.2, FACADE_Z + 0.52);
  }

  private buildGround() {
    // sidewalk, kerb and road, all dark and wet
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(60, 4.6), ownMat('#17122a'));
    walk.rotation.x = -Math.PI / 2;
    this.add(walk, 0, 0.0, FACADE_Z + 2.3);
    const kerb = new THREE.Mesh(new THREE.PlaneGeometry(60, 0.25), ownMat('#2a2342'));
    kerb.rotation.x = -Math.PI / 2;
    this.add(kerb, 0, 0.004, FACADE_Z + 4.6);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), ownMat('#0d0a1c'));
    road.rotation.x = -Math.PI / 2;
    this.add(road, 0, -0.01, FACADE_Z + 19.7);
    for (let i = 0; i < 6; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.16), ownMat('#3a3350'));
      dash.rotation.x = -Math.PI / 2;
      this.add(dash, -15 + i * 6, 0.0, FACADE_Z + 10);
    }
    // wet reflections of the neon on the ground: soft vertical streaks that shimmer
    const refl = (x: number, z: number, w: number, len: number, color: string, base: number) => {
      const mat = lightMat(color, base, beamTexture());
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
      m.rotation.x = -Math.PI / 2;
      this.add(m, x, 0.012, z + len / 2);
      this.reflections.push({ mat, k: this.reflections.length, color, base });
    };
    refl(-3.15, FACADE_Z + 0.2, 4.6, 9, PAL.pink, 0.32);
    refl(3.05, FACADE_Z + 0.2, 4.8, 9, PAL.pink, 0.32);
    refl(-11.2, FACADE_Z + 0.2, 1.8, 7, PAL.cyan, 0.25);
    refl(0, FACADE_Z + 0.2, 8.5, 4, '#ff3a5c', 0.22);   // the red club glow from the window
    refl(DOOR.x, FACADE_Z + 0.3, 4.6, 6, '#ffd27a', 0.18);
    // puddles
    for (const [x, z, rx, rz] of [[-4.5, FACADE_Z + 2.4, 1.6, 0.5], [2.8, FACADE_Z + 3.4, 2.2, 0.6], [-1.0, FACADE_Z + 8, 3.0, 0.9]] as [number, number, number, number][]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(1, 32), ownMat('#090716'));
      p.rotation.x = -Math.PI / 2; p.scale.set(rx, rz, 1);
      this.add(p, x, 0.008, z);
    }
  }

  private buildLamp() {
    const x = -14.5, z = FACADE_Z + 4.2;
    this.add(inkedRect(0.22, 7.6, 0.05, '#221a30', 0.05), x, 3.8, z);
    this.add(inkedRect(1.6, 0.18, 0.05, '#221a30', 0.05), x + 0.7, 7.5, z);
    this.add(inkedRect(0.7, 0.3, 0.1, '#2c2238', 0.05), x + 1.4, 7.3, z);
    this.lampMat = ownGlow('#ffd9a0', 2.4);
    this.add(shapeMesh(roundedRectShape(0.5, 0.12, 0.05), this.lampMat, 0.01), x + 1.4, 7.12, z);
    this.lampBeam = lightMat('#ffd9a0', 0.16, beamTexture());
    const geo = new THREE.PlaneGeometry(4.2, 7.1);
    geo.translate(0, -3.55, 0);
    this.add(new THREE.Mesh(geo, this.lampBeam), x + 1.4, 7.1, z - 0.05);
    const pool = lightPool(2.6, '#ffd9a0', 0.32);
    this.lampPool = pool.material as THREE.MeshBasicMaterial;
    this.add(pool, x + 1.4, 0.015, z);
  }

  set(s: StreetState, t: number, cam: THREE.Camera) {
    setGlow(this.club, PAL.pink, lerp(0.3, 2.8, s.sign));
    setGlow(this.prod, PAL.pink, lerp(0.3, 2.8, s.prod));
    this.clubGlow.opacity = 0.16 * Math.max(s.sign, s.prod);
    this.reflections.forEach(r => {
      const on = r.color === PAL.pink ? (r.k === 0 ? s.sign : s.prod) : r.color === '#ffd27a' ? s.marquee : 1;
      r.mat.opacity = r.base * on * (0.8 + 0.2 * noise1(t * 1.3 + r.k * 4, 3));
    });
    setGlow(this.martini, PAL.cyan, lerp(0.3, 2.2, s.sign));
    this.marqueeText.color.setScalar(lerp(0.35, 1.25, s.marquee));
    const order = this.bulbs.userData.order as number[];
    for (let i = 0; i < this.bulbN; i++) {
      // a chase: bulbs light in a wave running round the marquee
      const ph = (order[i] / (Math.PI * 2) + t * 0.8) % 1;
      const on = ph % 0.25 < 0.12;
      this.tmp.set('#ffd27a').multiplyScalar(s.marquee * (on ? 2.6 : 0.5) + 0.12);
      this.bulbs.setColorAt(i, this.tmp);
    }
    this.bulbs.instanceColor!.needsUpdate = true;
    setGlow(this.openMat, '#ff3a5c', lerp(0.25, 2.4, s.open));
    setGlow(this.lampMat, '#ffd9a0', lerp(0.4, 2.4, s.lamp));
    this.lampBeam.opacity = 0.16 * s.lamp;
    this.lampPool.opacity = 0.32 * s.lamp;
    this.rain.set(t, cam);
  }
}

function circleOf(r: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  return s;
}

/** The sign buzzing on: off, then irregular flickers, settling by `settle`. Pure function of t. */
export function buzzOn(t: number, start: number, settle: number, seed = 0) {
  if (t < start) return 0;
  if (t >= settle) return 1;
  const k = (t - start) / (settle - start);
  // short on-blips that get longer and closer together (at most ~3 a second at the start)
  const slot = Math.floor(k * 9), ph = k * 9 - slot;
  const on = hash(slot, seed, 95) < 0.35 + k * 0.6 && ph < 0.35 + k * 0.6;
  return on ? 0.6 + 0.4 * hash(slot, seed, 96) : 0.05;
}

