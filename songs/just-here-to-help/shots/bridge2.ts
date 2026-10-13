// Bridge part 2 (2:04 to 2:14): the globe, colder. Storyboard rows 53 to 60. Money arcs between
// continents, a wall of camera feeds, the people ranked, bars over cities, red lines snapping shut
// round the coastlines, flights dropping out of their lanes, the alert level clicking to the top
// with red light flooding the room, and the night side going dark city by city.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, mixMood } from '../../../engine/characters/clawd';
import { INK, circleShape, ownMat, shapeMesh } from '../../../engine/flat';
import { hash } from '../../../engine/rng';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, unlerp } from '../../../engine/ease';
import { DAY_LYRICS, MONO } from '../world';
import { CITIES, Globe, city, starfield } from '../globe';
import { SHIRTS, pick, wobble } from '../props';
import { capsule } from '../control';
import { screenFrame } from '../server';
import { HUD, withThreat, type ThreatPlace } from '../countdown';
import { NIGHT_POST, insertShot, pose } from './verse2';
import { alarmTint, ctlShot } from './bridge1';

type Update = (f: Frame) => void;
const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

export interface GlobeSet { scene: THREE.Scene; camera: THREE.PerspectiveCamera; globe: Globe; aim(x: number, y: number, z: number, tx?: number, ty?: number, tz?: number): void }

/** When city i's lights go out ("Kill the lights", east to west); they stay out after that. */
export const KILL = { t0: 132.5, dur: 0.95 };
const killOrder = CITIES.map((c, i) => ({ i, lon: c.lon })).sort((a, b) => b.lon - a.lon).map(o => o.i);
export const cityOffAt = (i: number, t: number) => t >= KILL.t0 + (killOrder.indexOf(i) / CITIES.length) * KILL.dur;

/** A shot of the globe in its dark display space, countdown on top. */
export function globeShot(id: string, start: number, end: number, setup: (g: GlobeSet) => Update, o: { tint?: (f: Frame) => string; vignette?: number; place?: (f: Frame) => ThreatPlace | null } = {}): Shot {
  return withThreat(defineShot({
    id, start, end,
    build() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#04060f');
      const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);
      const stars = starfield();
      stars.position.set(0, 0, -40);
      scene.add(stars);
      const globe = new Globe(3);
      scene.add(globe.group);
      const g: GlobeSet = {
        scene, camera, globe,
        aim(x, y, z, tx = 0, ty = 0, tz = 0) { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld(true); },
      };
      const update = setup(g);
      return {
        scene, camera,
        update(f) {
          globe.paint({ cityOff: i => cityOffAt(i, f.t) });
          update(f);
          globe.billboard(camera, f.t);
        },
        post: f => ({ ...NIGHT_POST, vignette: o.vignette ?? 0.3, tint: o.tint ? o.tint(f) : alarmTint(f.t) }),
        lyricStyle: DAY_LYRICS,
      };
    },
  }), o.place ?? (() => HUD));
}

/** A flat cut-out disc that always faces the camera (coins, blips, plane icons). */
function token(r: number, fill: string, ink = INK) {
  const g = new THREE.Group();
  g.add(shapeMesh(circleShape(r * 1.25), ink, 0, 24), shapeMesh(circleShape(r), fill, 0.001, 24));
  return g;
}

function planeIcon(s: number) {
  const g = new THREE.Group();
  const body = new THREE.Shape();
  body.moveTo(0.5, 0); body.lineTo(0.3, 0.06); body.lineTo(0.05, 0.07); body.lineTo(-0.1, 0.42); body.lineTo(-0.22, 0.42); body.lineTo(-0.14, 0.07);
  body.lineTo(-0.38, 0.06); body.lineTo(-0.46, 0.18); body.lineTo(-0.54, 0.18); body.lineTo(-0.5, 0); body.lineTo(-0.54, -0.18); body.lineTo(-0.46, -0.18);
  body.lineTo(-0.38, -0.06); body.lineTo(-0.14, -0.07); body.lineTo(-0.22, -0.42); body.lineTo(-0.1, -0.42); body.lineTo(0.05, -0.07); body.lineTo(0.3, -0.06); body.closePath();
  const m = shapeMesh(body, ownMat('#f2f6ff', 1, true), 0.001);
  const ink = shapeMesh(body, ownMat(INK, 1, true), 0);
  ink.scale.setScalar(1.18); ink.position.x = -0.01;
  g.add(ink, m);
  g.scale.setScalar(s);
  return Object.assign(g, { mats: [m.material as THREE.MeshBasicMaterial, ink.material as THREE.MeshBasicMaterial] });
}

/** Screen-space heading of a path at a point, for pointing a camera-facing icon along it. */
function heading(cam: THREE.Camera, parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const pa = parent.localToWorld(v3.copy(a)).project(cam), pb = parent.localToWorld(v4.copy(b)).project(cam);
  return Math.atan2((pb.y - pa.y) * 9, (pb.x - pa.x) * 16);
}

// ---------------------------------------------------------------------------------------------
// Inserts and screen painters

type Feed = 'street' | 'crossing' | 'platform' | 'market' | 'park' | 'office' | 'classroom' | 'kitchen';
const FEEDS: Feed[] = ['street', 'crossing', 'platform', 'market', 'park', 'office', 'classroom', 'kitchen'];

function drawFeed(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, i: number, kind: Feed) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.translate(x, y);
  const ground = h * 0.72;
  const wallCol = { street: '#4a5a6a', crossing: '#56646e', platform: '#5a5f6e', market: '#6a5e50', park: '#51664f', office: '#636a70', classroom: '#6c6a5c', kitchen: '#6e6458' }[kind];
  c.fillStyle = wallCol; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, ground, w, h - ground);
  // a few set pieces per kind
  c.fillStyle = 'rgba(0,0,0,0.25)';
  if (kind === 'street' || kind === 'crossing') {
    for (let k = 0; k < 4; k++) c.fillRect(w * (0.05 + k * 0.26), h * 0.12, w * 0.18, ground - h * 0.12);
    if (kind === 'crossing') { c.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 7; k++) c.fillRect(w * (0.1 + k * 0.12), ground + h * 0.08, w * 0.06, h * 0.14); }
  } else if (kind === 'platform') {
    c.fillRect(0, h * 0.18, w, h * 0.3);
    c.fillStyle = 'rgba(255,230,120,0.5)'; c.fillRect(0, ground - h * 0.02, w, h * 0.02);
  } else if (kind === 'market') {
    for (let k = 0; k < 3; k++) { c.fillStyle = k % 2 ? 'rgba(255,120,90,0.35)' : 'rgba(255,220,120,0.35)'; c.fillRect(w * (0.05 + k * 0.33), h * 0.2, w * 0.26, h * 0.12); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(w * (0.07 + k * 0.33), h * 0.45, w * 0.22, h * 0.27); }
  } else if (kind === 'park') {
    for (let k = 0; k < 3; k++) { c.fillStyle = 'rgba(30,60,30,0.6)'; c.beginPath(); c.arc(w * (0.15 + k * 0.35), h * 0.35, h * 0.18, 0, Math.PI * 2); c.fill(); }
  } else if (kind === 'office') {
    for (let k = 0; k < 3; k++) { c.fillRect(w * (0.08 + k * 0.32), h * 0.5, w * 0.24, h * 0.06); c.fillRect(w * (0.12 + k * 0.32), h * 0.32, w * 0.12, h * 0.17); }
  } else if (kind === 'classroom') {
    c.fillStyle = 'rgba(20,50,30,0.55)'; c.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.3);
    c.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) c.fillRect(w * (0.08 + k * 0.24), h * 0.62, w * 0.16, h * 0.05);
  } else {
    c.fillRect(0, h * 0.42, w, h * 0.06); c.fillRect(w * 0.6, h * 0.1, w * 0.3, h * 0.25);
  }
  // people (none in the office: everyone's gone home)
  const n = kind === 'office' ? 0 : 2 + Math.floor(hash(i, 921) * 3);
  for (let p = 0; p < n; p++) {
    const sp = (hash(i, p, 922) - 0.5) * 0.25;
    const px = ((hash(i, p, 923) + t * sp) % 1 + 1) % 1;
    const s = h * (0.42 + hash(i, p, 924) * 0.12);
    const cx = px * w, cy = ground + h * 0.02 - s * 0.5;
    capsule(c, cx, cy, s, pick(SHIRTS, i, p, 925));
    // a tracking box on each face
    c.strokeStyle = 'rgba(255,214,77,0.9)'; c.lineWidth = Math.max(1.5, h * 0.015);
    const bx = cx - s * 0.28, by = cy - s * 0.58, bs = s * 0.56;
    c.strokeRect(bx, by, bs, bs);
  }
  // CCTV treatment: green cast, scanlines, REC, clock
  c.fillStyle = 'rgba(70,255,150,0.12)'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(0,0,0,0.12)'; for (let ly = 0; ly < h; ly += 4) c.fillRect(0, ly, w, 1.5);
  if (Math.floor(t * 1.5 + i) % 2 === 0) { c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(w * 0.08, h * 0.12, h * 0.045, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(230,255,235,0.85)'; c.font = `700 ${h * 0.085}px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(`CAM ${String(i + 1).padStart(2, '0')}`, w * 0.14, h * 0.12);
  const secs = 2 * 3600 + 14 * 60 + Math.floor(t);
  c.textAlign = 'right';
  c.fillText(`${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, w * 0.95, h * 0.9);
  c.restore();
  c.strokeStyle = '#05070d'; c.lineWidth = Math.max(2, h * 0.03); c.strokeRect(x, y, w, h);
}

function drawFeedWall(c: CanvasRenderingContext2D, t: number, W: number, H: number) {
  c.fillStyle = '#05070d'; c.fillRect(0, 0, W, H);
  const cols = 6, rows = 4, pad = W * 0.004;
  const fw = (W - pad * (cols + 1)) / cols, fh = (H - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const i = r * cols + k;
    drawFeed(c, pad + k * (fw + pad), pad + r * (fh + pad), fw, fh, t, i, FEEDS[(i * 5 + r) % FEEDS.length]);
  }
}

export function paintRank(c: CanvasRenderingContext2D, t: number, W: number, H: number, ev: number, seed = 0) {
  screenFrame(c, W, H, 'index', '#ff8a5a');
  const cols = 8, rows = 3, gx = W * 0.05, gy = H * 0.22, cw = W * 0.9 / cols, ch = H * 0.74 / rows;
  const N = cols * rows;
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => hash(a, seed, 931) - hash(b, seed, 931));
  for (let i = 0; i < N; i++) {
    const k = i % cols, r = Math.floor(i / cols);
    const cx = gx + (k + 0.5) * cw, cy = gy + (r + 0.45) * ch;
    capsule(c, cx, cy, ch * 0.55, pick(SHIRTS, i, seed, 932));
    const rank = order.indexOf(i);
    const tk = ev + rank * 0.03;
    const a = clamp((t - tk) / 0.12);
    if (a <= 0) continue;
    const s = easeOutBack(a, 2);
    c.save(); c.translate(cx + ch * 0.25, cy - ch * 0.18); c.scale(s, s);
    c.fillStyle = rank < 6 ? '#5cd17a' : rank > N - 7 ? '#ff5a4f' : '#ffd166';
    c.strokeStyle = INK; c.lineWidth = H * 0.006;
    c.beginPath(); c.roundRect(-ch * 0.17, -ch * 0.11, ch * 0.34, ch * 0.22, ch * 0.05); c.fill(); c.stroke();
    c.fillStyle = INK; c.font = `800 ${ch * 0.15}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${rank + 1}`, 0, ch * 0.01);
    c.restore();
  }
}

export function paintLevel(c: CanvasRenderingContext2D, t: number, W: number, H: number, level: number, tTop: number) {
  screenFrame(c, W, H, 'status', level >= 4 ? '#ff3b30' : '#ffb347');
  const cols = ['#5cd17a', '#e6d84e', '#ffb347', '#ff5a4f', '#c4122f'];
  const x0 = W * 0.1, w = W * 0.8, gap = W * 0.02, sw = (w - gap * 4) / 5;
  for (let i = 0; i < 5; i++) {
    const on = level > i;
    const blink = i === 4 && on && t > tTop ? (Math.floor((t - tTop) * 2.2) % 2 === 0 ? 1 : 0.55) : 1;
    const h = H * (0.25 + i * 0.12);
    const x = x0 + i * (sw + gap), y = H * 0.9 - h;
    c.globalAlpha = on ? blink : 1;
    c.fillStyle = on ? cols[i] : '#1b2240';
    c.strokeStyle = INK; c.lineWidth = H * 0.01;
    c.beginPath(); c.roundRect(x, y, sw, h, H * 0.02); c.fill(); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = on ? INK : 'rgba(201,214,255,0.4)'; c.font = `900 ${H * 0.1}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(i + 1), x + sw / 2, H * 0.9 - H * 0.07);
  }
}

// ---------------------------------------------------------------------------------------------

export function bridge2Shots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const C = { g1: start, g2: 125.38, g3: 126.58, g4: 127.75, g5: 128.89, g6: 130.11, g7: 131.3, g8: 132.43, end: 133.6 };

  // G1 "Move the money": pull back from the Atlantic to the whole globe; gold arcs between the
  // money cities, coins sliding along them.
  const PAIRS: [string, string][] = [
    ['New York', 'London'], ['London', 'Dubai'], ['New York', 'Sao Paulo'], ['London', 'Lagos'], ['Chicago', 'Paris'], ['Madrid', 'Buenos Aires'],
    ['Mexico City', 'Madrid'], ['Paris', 'Cairo'], ['Lagos', 'Johannesburg'], ['London', 'Moscow'], ['Toronto', 'Berlin'], ['Miami', 'Rio'],
    ['Dubai', 'Mumbai'], ['Rome', 'Nairobi'],
  ];
  const tMove = W(53, 0), tMoney = W(53, 2);
  const g1 = globeShot('br-money', C.g1, C.g2, g => {
    const arcs = PAIRS.map(([a, b]) => {
      const A = city(a), B = city(b);
      return g.globe.arc([A.lon, A.lat], [B.lon, B.lat], 0.18 + hash(A.lon, 941) * 0.1, '#f2c14e', 0.022);
    });
    const coins = PAIRS.flatMap((_, i) => [0, 1].map(j => { const t = token(0.06, '#ffd166'); g.globe.spin.add(t); return { t, i, j }; }));
    return f => {
      const k = easeOutCubic(unlerp(f.t, C.g1, C.g2));
      g.aim(0, lerp(1.2, 0.6, k), lerp(8.5, 13.5, k));
      g.globe.face(lerp(-35, -15, k), lerp(32, 26, k));
      arcs.forEach((a, i) => a.set(0, easeOutCubic((f.t - (tMove + i * 0.06)) / 0.35)));
      for (const c of coins) {
        const t0 = tMove + c.i * 0.06 + 0.3;
        const u = f.t - t0;
        c.t.visible = u > 0;
        if (u <= 0) continue;
        arcs[c.i].at(((u * 0.9 + c.j * 0.5) % 1), c.t.position);
        c.t.quaternion.copy(g.globe.spin.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(g.camera.quaternion));
        c.t.scale.setScalar(f.t > tMoney ? 1.3 : 1);
      }
    };
  });

  // G2 "Watch the feeds": camera feeds of ordinary people, then many more of them on "feeds".
  const tFeeds = W(54, 2);
  const g2 = withThreat(insertShot('br-feeds', C.g2, C.g3, (c, f, Wd, Hd) => drawFeedWall(c, f.t, Wd, Hd), f => {
    const k = easeInOutCubic(clamp((f.t - tFeeds + 0.15) / 0.4));
    return { zoom: lerp(1.98, 1.0, k) + (f.t - C.g2) * 0.03, x: lerp(-3.95, 0, k), y: lerp(2.2, 0, k), tilt: 0 };
  }, { post: () => ({ ...NIGHT_POST, vignette: 0.35 }) }));

  // G3 "Rank the people": every screen ranks rows of people. His paw goes to the key and stops.
  const tRank = W(55, 0), tPeople = W(55, 2);
  const g3 = ctlShot('br-rank', C.g3, C.g4, [], r => {
    r.screens.forEach((_, i) => { r.screens[i] = (c, f, Wd, Hd) => paintRank(c, f.t, Wd, Hd, tRank + 0.05 + i * 0.04, i); });
    return f => {
      const k = unlerp(f.t, C.g3, C.g4);
      const wb = wobble(f.t, 0.02, 9);
      r.aim(lerp(0.9, 0.7, k) + wb.x, 2.15 + wb.y, lerp(5.6, 5.0, k), 0.1, 2.25, -2);
      const reach = easeOutCubic(clamp((f.t - tRank) / 0.35));
      const stall = clamp((f.t - tPeople) / 0.3);
      r.clawd.setMood(mixMood(MOODS.stressed, MOODS.sad, 0.25 * stall), f.t, { x: lerp(-0.2, 0.3, stall), y: lerp(0.8, -0.3, stall) });
      r.clawd.setPose(pose({ armR: lerp(0.3, 1.0, reach) - stall * 0.35 + Math.sin(f.t * 30) * 0.03 * stall, armL: 0.2, lean: -0.05 * stall }));
    };
  }, { hi: -1 });

  // G4 "Measure needs": bars rise over the cities.
  const tMeasure = W(56, 0), tNeeds = W(56, 1);
  const g4 = globeShot('br-needs', C.g4, C.g5, g => {
    const up = new THREE.Vector3(0, 1, 0);
    const bars = CITIES.map((ct, i) => {
      const h = 0.25 + hash(i, 951) * 1.0;
      const col = new THREE.Color('#5fd0ff').lerp(new THREE.Color('#ff8a5a'), clamp((h - 0.25) / 1.0));
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1, 0.075), ownMat(col));
      const n = new THREE.Vector3();
      const lat = ct.lat, lon = ct.lon;
      const phi = THREE.MathUtils.degToRad(lon + 180), th = THREE.MathUtils.degToRad(90 - lat);
      n.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
      m.quaternion.setFromUnitVectors(up, n);
      g.globe.spin.add(m);
      return { m, n, h, t0: tMeasure + hash(i, 952) * (tNeeds - tMeasure + 0.2) };
    });
    return f => {
      const k = unlerp(f.t, C.g4, C.g5);
      g.aim(0, 0.5, lerp(12.6, 11.8, k));
      g.globe.face(lerp(20, 45, k), 18);
      for (const b of bars) {
        const e = easeOutBack(clamp((f.t - b.t0) / 0.3), 1.8);
        b.m.visible = e > 0.001;
        const h = Math.max(0.001, b.h * e);
        b.m.scale.set(1, h, 1);
        b.m.position.copy(b.n).multiplyScalar(g.globe.R + h / 2);
      }
    };
  });

  // G5 "Close the borders": red lines run round every coastline and snap shut on "borders".
  const tClose = W(57, 0), tBorders = W(57, 2);
  const g5 = globeShot('br-borders', C.g5, C.g6, g => f => {
    const k = unlerp(f.t, C.g5, C.g6);
    const snap = f.t > tBorders ? decay(f.t - tBorders, 0.12) : 0;
    g.aim(0, 0.7, lerp(11.5, 10.8, k) + snap * 0.4);
    g.globe.face(lerp(0, 20, k), 34);
    g.globe.paint({ borders: f.t < tBorders ? 0.92 * easeInOutCubic(clamp((f.t - tClose) / (tBorders - tClose))) : 1, cityOff: i => cityOffAt(i, f.t) });
  });

  // G6 "Ground the flights": planes on their lanes over the Atlantic stop, and drop.
  const LANES: [string, string][] = [['New York', 'London'], ['Chicago', 'Paris'], ['Toronto', 'Reykjavik'], ['Miami', 'Madrid'], ['New York', 'Rome'], ['Reykjavik', 'London'], ['Houston', 'Lagos'], ['Sao Paulo', 'Lagos']];
  const tGround = W(58, 0), tFlights = W(58, 2);
  const g6 = globeShot('br-flights', C.g6, C.g7, g => {
    const lanes = LANES.map(([a, b]) => { const A = city(a), B = city(b); return g.globe.arc([A.lon, A.lat], [B.lon, B.lat], 0.08, '#9fc6ff', 0.008); });
    const planes = LANES.flatMap((_, i) => [0, 1, 2].map(j => { const p = planeIcon(0.2); g.globe.spin.add(p); return { p, i, j }; }));
    const puffs = planes.map(() => { const m = shapeMesh(circleShape(1), ownMat('#ffffff', 0.5, true), 0, 24); g.globe.spin.add(m); return m; });
    const q = new THREE.Quaternion();
    return f => {
      const k = unlerp(f.t, C.g6, C.g7);
      g.aim(0, 0.8, lerp(11.8, 11.2, k));
      g.globe.face(lerp(-45, -35, k), 38);
      g.globe.spin.updateMatrixWorld(true);
      const stopT = Math.min(f.t, tGround + 0.25);
      lanes.forEach(l => l.set(0, 1));
      lanes.forEach(l => { (l.mesh.material as THREE.MeshBasicMaterial).opacity = 1; });
      planes.forEach((pl, n) => {
        const kk = ((stopT * 0.16 + pl.j / 3 + hash(pl.i, 961) * 0.3) % 1);
        const a = lanes[pl.i].at(kk, new THREE.Vector3()), b = lanes[pl.i].at(Math.min(1, kk + 0.02), new THREE.Vector3());
        const fall = clamp((f.t - (tFlights + hash(n, 962) * 0.25)) / 0.45);
        const pos = a.clone();
        if (fall > 0) pos.lerp(a.clone().normalize().multiplyScalar(g.globe.R * 1.0), easeInCubic(fall));
        pl.p.position.copy(pos);
        q.copy(g.globe.spin.getWorldQuaternion(new THREE.Quaternion())).invert().multiply(g.camera.quaternion);
        pl.p.quaternion.copy(q);
        pl.p.rotateZ(heading(g.camera, g.globe.spin, a, b) + fall * 1.2);
        const vis = fall < 1;
        pl.p.visible = vis;
        const puff = puffs[n];
        const pu = clamp((f.t - (tFlights + hash(n, 962) * 0.25) - 0.45) / 0.4);
        puff.visible = pu > 0 && pu < 1;
        if (puff.visible) {
          puff.position.copy(a.clone().normalize().multiplyScalar(g.globe.R * 1.003));
          puff.quaternion.copy(q);
          puff.scale.setScalar(0.04 + pu * 0.18);
          (puff.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - pu);
        }
      });
    };
  });

  // G7 "Raise the alert state": every screen shows the level, clicking up on each word; on
  // "state" it hits the top and red floods the room.
  const clicks = [W(59, 0), W(59, 1), W(59, 2), W(59, 3)];
  const level = (t: number) => 1 + clicks.filter(c => t >= c).length;
  const tTop = clicks[3];
  const g7 = ctlShot('br-alert', C.g7, C.g8, [], r => {
    r.screens.forEach((_, i) => { r.screens[i] = (c, f, Wd, Hd) => paintLevel(c, f.t, Wd, Hd, level(f.t), tTop); });
    return f => {
      const k = unlerp(f.t, C.g7, C.g8);
      const jolt = clicks.reduce((a, c) => a + (f.t > c ? decay(f.t - c, 0.08) : 0), 0);
      const wb = wobble(f.t, 0.03, 11);
      r.aim(wb.x, 1.7 + wb.y + jolt * 0.04, lerp(9.6, 8.6, k), 0, 3.2, -3);
      const fear = clamp((level(f.t) - 1) / 4);
      r.clawd.setMood(mixMood(MOODS.stressed, MOODS.panicked, fear), f.t, { x: 0, y: 0.9 });
      r.clawd.setPose(pose({ armL: 0.3 + fear * 0.5, armR: 0.3 + fear * 0.5, squash: jolt * 0.2, bounce: jolt * 0.1 }));
    };
  }, {
    tint: f => {
      const red = f.t >= tTop ? easeOutCubic(clamp((f.t - tTop) / 0.25)) : 0;
      return '#' + new THREE.Color(alarmTint(f.t)).lerp(new THREE.Color('#ff7a70'), red * 0.75).getHexString();
    },
  });

  // G8 "Kill the lights": the night side goes dark, city by city, east to west.
  const g8 = globeShot('br-lights', C.g8, C.end, g => f => {
    const k = unlerp(f.t, C.g8, C.end);
    g.aim(0, 0.6, lerp(11.6, 12.4, k));
    g.globe.face(lerp(70, 40, k), 26);
    g.globe.hudOn = true;
  }, { tint: f => '#' + new THREE.Color('#ff9a90').lerp(new THREE.Color('#d8dcff'), clamp((f.t - C.g8) / 0.6)).getHexString() });

  return [g1, g2, g3, g4, g5, g6, g7, g8];
}

