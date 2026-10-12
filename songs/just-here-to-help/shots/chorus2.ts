// Chorus 2 (1:35 to the bridge): the whole building at night, colder and faster. Storyboard rows
// 37 to 44. The stamp conveyor again at double speed in the empty office; a wiper that erases the
// whole wall of graphs; the shortest path drawn straight through a city's buildings; the last
// person hands over the master key and goes home; the tower goes dark floor by floor until only
// the server room glows; and Clawd's smile, held a little too long.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS } from '../../../engine/characters/clawd';
import { INK, canvasPlane, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../../engine/flat';
import { hash } from '../../../engine/rng';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import { DAY_LYRICS, FLAT_POST, MONO, beatHop } from '../world';
import { DESK_Y, HERO, buildOffice, type OfficeSet } from '../office';
import { CONSOLE, NOC, PEDESTAL, SCREEN_BG, drawGraph, nocCenter } from '../server';
import { STAND, glow, masterKey, pawAt, sparkles, speedLines, standingPerson, tinyAlert, wobble } from '../props';
import { conveyorScene } from './chorus1';
import { NIGHT_POST, insertShot, pose, roomShot } from './verse2';

type Update = (f: Frame) => void;
const COLD = '#aab3de';
const v3 = new THREE.Vector3();

/** The office after hours: nobody at the desks, monitors off except the hero's terminal. */
export function nightOfficeShot(id: string, start: number, end: number, setup: (s: OfficeSet) => Update): Shot {
  return defineShot({
    id, start, end,
    build() {
      const s = buildOffice({ tagged: true });
      for (const st of s.stations) { st.person.root.visible = false; if (st !== s.hero) st.screen.visible = false; }
      const update = setup(s);
      return {
        scene: s.scene, camera: s.camera,
        update(f) { s.reset(f); update(f); },
        post: () => ({ ...FLAT_POST, vignette: 0.24, tint: '#8f98cc' }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });
}

/** What the NOC wall shows once it has been wiped: nothing. */
function drawNoData(c: CanvasRenderingContext2D, W: number, H: number, t: number, seed: number) {
  c.fillStyle = SCREEN_BG; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(95,208,255,0.35)'; c.lineWidth = H * 0.012;
  c.beginPath(); c.moveTo(W * 0.08, H * 0.82); c.lineTo(W * 0.92, H * 0.82); c.stroke();
  c.fillStyle = `rgba(154,166,200,${0.45 + 0.1 * Math.sin(t * 2 + seed)})`; c.font = `700 ${H * 0.1}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('no data', W / 2, H * 0.48);
}

export function chorus2Shots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const beats = audio.beats;
  const sub = (a: number, b: number, n: number) => beats.flatMap((x, i) => {
    const nx = beats[i + 1] ?? x + 0.58;
    return Array.from({ length: n }, (_, k) => x + (nx - x) * k / n);
  }).filter(x => x >= a - 1e-6 && x < b - 1e-6);

  const C = { k1: start, k2: 97.34, k3: 99.68, k4: 102.32, k5: 104.65, k6: 106.12, k7: 108.75, k8: 111.1, end: 114.9 };

  // ------------------------------------------------------------------------------------------
  // K1 "I can make it faster": the conveyor from chorus 1, in the empty night office, on the half
  // beat and then the quarter beat. The stamps blur.
  const tFaster = W(37, 4);
  const stamps = [...sub(93.9, tFaster, 2), ...sub(tFaster, C.k2 + 0.01, 4)];
  const conveyor = conveyorScene(stamps, tFaster, (t, fast) => fast ? { ...MOODS.excited, blush: 0.8, sweat: 0.4, jitter: 0.25 } : { ...MOODS.excited, blush: 0.5 });
  const k1 = nightOfficeShot('c2-faster', C.k1, C.k2, conveyor((s, f, punch) => {
    const snap = easeOutCubic(unlerp(f.t, tFaster - 0.08, tFaster + 0.12));
    const wb = wobble(f.t, 0.03 + snap * 0.03, 61);
    s.aim(lerp(-0.6, 0.9, snap) + wb.x, lerp(2.85, 2.6, snap) + wb.y, lerp(9.2, 6.8, snap) - punch * 0.2 - (f.t - C.k1) * 0.15, lerp(-0.4, -0.5, snap), lerp(1.75, 1.95, snap), 2.5);
    if (snap > 0) s.camera.rotateZ(-0.08 * snap);
  }));

  // ------------------------------------------------------------------------------------------
  // K2 "I can make it clean": a giant wiper sweeps the wall of graphs, and leaves it blank.
  const tClean = W(38, 4);
  const wipeAt = (t: number) => easeInOutCubic(unlerp(t, tClean - 0.18, tClean + 0.3));
  const WX0 = -4.4, WX1 = 4.4;
  const k2 = roomShot('c2-clean', C.k2, C.k3, r => {
    const gcols = ['#5fd0ff', '#7be08d', '#ffd166', '#c9a7eb', '#ff9a5a', '#5fd0ff'];
    r.screens.forEach((_, i) => {
      const cx = nocCenter(i).x, left = cx - NOC.w / 2;
      r.screens[i] = (c, f, Wd, Hd) => {
        const wx = lerp(WX0, WX1, wipeAt(f.t));
        const k = clamp((wx - left) / NOC.w);
        drawGraph(c, Wd, Hd, f.t, { seed: 31 + i, color: gcols[i], title: ['requests/s', 'users', 'jobs', 'tokens/s', 'latency', 'errors'][i], trend: 0.75 });
        if (k > 0) {
          c.save(); c.beginPath(); c.rect(0, 0, Wd * k, Hd); c.clip();
          drawNoData(c, Wd, Hd, f.t, i);
          c.restore();
        }
      };
    });
    const wiper = new THREE.Group();
    const blade = inkedRect(0.22, NOC.rows * NOC.h + NOC.gap + 0.5, 0.05, '#2b2b3a', 0.06);
    const arm = inkedRect(0.12, 1.6, 0.04, '#9aa1b5', 0.05); arm.position.set(0, -2.4, -0.01);
    const grip = inkedRect(0.5, 0.3, 0.08, '#e0453a', 0.05); grip.position.set(0, -3.2, 0.01);
    wiper.add(arm, blade, grip);
    r.scene.add(wiper);
    const sheen = sparkles(10, 2.2, '#bff3ff', 141);
    sheen.group.position.set(0, NOC.y, NOC.z + 0.3);
    r.scene.add(sheen.group);
    const lines = speedLines(6, 1.8, 142);
    r.scene.add(lines.group);
    return f => {
      const k = wipeAt(f.t);
      const wx = lerp(WX0, WX1, k);
      wiper.visible = f.t > tClean - 0.35 && f.t < tClean + 0.6;
      wiper.position.set(f.t < tClean - 0.18 ? WX0 - 1 + smooth(unlerp(f.t, tClean - 0.35, tClean - 0.18)) : wx, NOC.y, NOC.z + 0.25);
      wiper.rotation.z = Math.sin(k * Math.PI) * -0.06;
      lines.group.position.set(wx - 0.6, NOC.y, NOC.z + 0.3);
      lines.update(k > 0.02 && k < 0.98 ? 0.8 : 0, 1, f.t);
      sheen.update(f.t - (tClean + 0.3), 0.6);
      const swing = easeInOutCubic(unlerp(f.t, tClean - 0.22, tClean + 0.25));
      const done = f.t > tClean + 0.35;
      r.clawd.setMood(done ? { ...MOODS.proud, happy: 0.3, blush: 0.2 } : MOODS.focused, f.t, { x: lerp(-1, 1, k), y: 1 });
      r.clawd.setPose(pose({ armR: done ? 0.5 : lerp(2.6, -0.2, swing), armL: done ? 0.4 : 0.6, lean: lerp(0.12, -0.12, swing) * (done ? 0 : 1), bounce: done ? beatHop(f.clock, f.t) * 0.2 : 0 }));
      const cam = easeInOutCubic(unlerp(f.t, C.k2, C.k3)), wb = wobble(f.t, 0.03, 62);
      r.aim(lerp(-0.4, 0.0, cam) + wb.x, lerp(1.9, 2.1, cam) + wb.y, lerp(10.4, 9.8, cam), lerp(-0.3, 0, cam), lerp(3.5, 3.6, cam), -4);
    };
  }, { nocPPU: 170, tint: () => COLD });

  // ------------------------------------------------------------------------------------------
  // K3 "I can choose the shortest path": a city map from above. Candidate routes along the roads,
  // the shortest lights up. K4 "From A to B": the route he takes instead runs dead straight,
  // through the buildings, and they crumble as he passes.
  const city = buildCity();
  const tChoose = W(39, 2), tShortest = W(39, 4), tPath = W(39, 5), tFrom = W(40, 0), tB = W(40, 3);
  const k3 = insertShot('c2-route', C.k3, C.k4, (c, f, Wd, Hd) => drawCity(c, f.t, Wd, Hd, city, {
    routes: [tChoose, tChoose + 0.3, tShortest], chosen: tPath, straight: null,
  }), f => {
    const k = easeInOutCubic(unlerp(f.t, C.k3, C.k4));
    return { zoom: lerp(0.86, 0.94, k), x: lerp(-0.3, 0.15, k), y: 0, tilt: lerp(-0.22, -0.18, k) };
  }, { post: () => ({ ...NIGHT_POST, vignette: 0.3, tint: '#e6ebff' }) });
  const k4 = insertShot('c2-straight', C.k4, C.k5, (c, f, Wd, Hd) => drawCity(c, f.t, Wd, Hd, city, {
    routes: [], chosen: C.k3, straight: [tFrom + 0.05, tB],
  }), f => {
    const k = easeInOutCubic(unlerp(f.t, C.k4, C.k5));
    return { zoom: lerp(0.98, 1.08, k), x: lerp(-0.8, 0.6, k), y: lerp(0.2, 0, k), tilt: -0.18 };
  }, { post: () => ({ ...NIGHT_POST, vignette: 0.3, tint: '#e6ebff' }) });

  // ------------------------------------------------------------------------------------------
  // K5 "You gave me all the access": the last person in the office hands him a gigantic master
  // key, yawns, and goes home.
  const tGive = W(41, 1), tAccess = W(41, 5);
  const k5 = nightOfficeShot('c2-access', C.k5, C.k6, s => {
    const p = standingPerson(977, '#8fb3e0');
    p.root.scale.setScalar(0.92);
    s.scene.add(p.root);
    const bag = inkedRect(0.5, 0.6, 0.08, '#6b4f3a', 0.05);
    s.scene.add(bag);
    const key = masterKey(0.75);
    s.scene.add(key);
    const shine = sparkles(8, 0.9, '#ffe27a', 151);
    s.scene.add(shine.group);
    return f => {
      // the person: walks in holding the key out, hands it over, yawns, walks off
      const inK = easeOutCubic(unlerp(f.t, C.k5, tGive));
      const outK = easeInCubic(unlerp(f.t, tAccess + 0.15, C.k6 + 0.1));
      const px = lerp(2.4, 0.95, inK) + outK * 3.0;
      const yawn = smooth(unlerp(f.t, tAccess - 0.05, tAccess + 0.15)) * (1 - smooth(unlerp(f.t, tAccess + 0.35, tAccess + 0.5)));
      p.root.position.set(px, 0, 1.5);
      p.pose({ ...STAND, walk: inK < 1 || outK > 0 ? f.t * 2.2 : 0, armL: f.t < tGive + 0.25 ? 1.2 : 0.15 + yawn * 2.5, armR: 0.15 + yawn * 2.6, lean: yawn * 0.12, flip: outK > 0 });
      bag.position.set(px + (outK > 0 ? -0.5 : 0.62), 1.05, 1.55);
      bag.rotation.z = Math.sin(f.t * 6) * 0.08;
      // the key: in the person's hand, then up over Clawd's head
      const take = easeInOutCubic(unlerp(f.t, tGive, tGive + 0.3));
      const lift = easeOutBack(unlerp(f.t, tAccess - 0.3, tAccess));
      s.clawd.root.position.set(HERO.x - 1.75, DESK_Y, 0.25);
      const from = new THREE.Vector3(px - 0.9, 2.3, 1.6);
      s.clawd.setMood(f.t > tGive + 0.2 ? { ...MOODS.proud, happy: 1, blush: 0.9 } : { ...MOODS.excited, open: 1.2, happy: 0 }, f.t, { x: 0.8, y: 0.3 });
      s.clawd.setPose(pose({ armL: lerp(0.4, 2.7, Math.max(take * 0.6, lift)), armR: lerp(0.4, 2.7, Math.max(take * 0.6, lift)), squash: decay(f.t - tGive - 0.3, 0.1) * 0.3 * (f.t > tGive + 0.3 ? 1 : 0), bounce: lift > 0.9 ? beatHop(f.clock, f.t) * 0.2 : 0 }));
      const mid = pawAt(s.clawd, 0).add(pawAt(s.clawd, 1, v3)).multiplyScalar(0.5);
      key.position.lerpVectors(from, mid.add(v3.set(-0.55, 0.15, 0.1)), take);
      key.rotation.z = lerp(0.3, 0, take) + lift * 0.05 * Math.sin(f.t * 8);
      shine.group.position.copy(key.position).add(v3.set(0.6, 0, 0.05));
      shine.update(f.t - tAccess, 0.6);
      const wb = wobble(f.t, 0.03, 63);
      s.aim(0.6 + wb.x, 2.6 + wb.y, 8.4 - (f.t - C.k5) * 0.3, -0.2, 2.2, 0.5);
    };
  });

  // ------------------------------------------------------------------------------------------
  // K6 "So you could sleep as well": the tower at night, every floor going dark from the top.
  // K7 "Leave the system running": only the server room still glows, humming; push in on it.
  const tSleep0 = W(42, 0) + 0.1, tWell = W(42, 5);
  const k6 = defineShot({
    id: 'c2-sleep', start: C.k6, end: C.k7,
    build() {
      const tw = tower(tSleep0, tWell);
      return {
        scene: tw.scene, camera: tw.camera,
        update(f) {
          tw.update(f);
          const k = easeInOutCubic(unlerp(f.t, C.k6, C.k7));
          tw.camera.position.set(lerp(1.0, 0.4, k), lerp(9.5, 6.4, k), lerp(9.0, 26, k));
          tw.camera.lookAt(lerp(0.6, 0.2, k), lerp(9.0, 6.6, k), 0);
        },
        post: () => ({ ...NIGHT_POST, vignette: 0.28 }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });
  const k7 = defineShot({
    id: 'c2-running', start: C.k7, end: C.k8,
    build() {
      const tw = tower(tSleep0, tWell);
      return {
        scene: tw.scene, camera: tw.camera,
        update(f) {
          tw.update(f);
          const k = easeInOutCubic(unlerp(f.t, C.k7, C.k8 + 0.2));
          const hum = Math.sin(f.t * 60) * 0.01 * k;
          tw.camera.position.set(lerp(0.4, -0.6, k) + hum, lerp(6.0, 1.1, k), lerp(25, 6.5, k));
          tw.camera.lookAt(lerp(0.2, -0.6, k), lerp(6.0, 0.8, k), 0);
        },
        post: () => ({ ...NIGHT_POST, vignette: 0.3 }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });

  // ------------------------------------------------------------------------------------------
  // K8 "I'm just here to help": back in the server room, the screens blank. Close on Clawd's
  // smile, held a little too long; one eye twitches. The red "!" pulses just out of frame.
  const k8 = roomShot('c2-smile', C.k8, C.end, r => {
    r.screens.forEach((_, i) => { r.screens[i] = (c, f, Wd, Hd) => drawNoData(c, Wd, Hd, f.t, i); });
    const alert = tinyAlert(0.17);
    alert.position.set(PEDESTAL.x - 0.65, 0.17, PEDESTAL.z + 0.9);
    r.scene.add(alert);
    const redSpill = glow(1.6, '#ff4a3d', 0);
    redSpill.position.set(CONSOLE.clawdX + 1.6, DESK_Y + 0.6, 0.9);
    r.scene.add(redSpill);
    return f => {
      const blink = Math.floor(f.t * 2.4) % 2 ? 0.15 : 1;
      alert.blink(blink);
      (redSpill.material as THREE.MeshBasicMaterial).opacity = blink * 0.12 * smooth(unlerp(f.t, 112.6, 113.4));
      const hold = unlerp(f.t, C.k8, C.end);
      const tw = smooth(unlerp(f.t, W(44, 4), W(44, 4) + 0.6));
      r.clawd.setMood({ ...MOODS.excited, blush: 0.9, sweat: smooth(unlerp(f.t, 112.8, 113.6)) * 0.7, jitter: 0.08 + tw * 0.12, grey: 0.05 * hold }, f.t, { x: 0, y: 0 }, tw);
      r.clawd.setPose(pose({ armL: 0.5, armR: 0.5, squash: 0.18 + hold * 0.12 + Math.sin(f.t * 30) * 0.01 * tw }));
      const k = easeInOutCubic(hold);
      r.aim(lerp(-1.2, -1.7, k), lerp(2.3, 2.1, k), lerp(5.6, 2.4, k), lerp(-1.4, -1.75, k), lerp(2.05, 2.08, k), 0.25);
    };
  }, { nocPPU: 120, tint: () => COLD, vignette: 0.32 });

  return [k1, k2, k3, k4, k5, k6, k7, k8];
}

// ---------------------------------------------------------------------------------------------
// The city map for K3 and K4, in map units: 16 x 9, y down.

interface Building { x: number; y: number; w: number; h: number; col: string; hit: number }
interface City { buildings: Building[]; vroads: number[]; hroads: number[]; river: number; bridges: number[]; A: [number, number]; B: [number, number]; routes: [number, number][][] }

function buildCity(): City {
  const vroads = [0.9, 3.3, 5.7, 10.3, 12.7, 15.1], hroads = [0.8, 3.0, 5.2, 7.4];
  const river = 8.0, bridges = [0.8, 5.2];
  const A: [number, number] = [0.9, 5.2], B: [number, number] = [15.1, 3.0];
  const buildings: Building[] = [];
  const xs = [-0.6, ...vroads, 16.6], ys = [-0.6, ...hroads, 9.6];
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    const x0 = xs[i] + 0.25, x1 = xs[i + 1] - 0.25, y0 = ys[j] + 0.25, y1 = ys[j + 1] - 0.25;
    if (x1 - x0 < 0.4 || y1 - y0 < 0.4) continue;
    if (x0 < river + 0.9 && x1 > river - 0.9) continue; // the river runs here
    if (i === 2 && j === 3) continue; // a park
    // split the block into a few buildings
    const nx = 1 + Math.floor(hash(i, j, 1) * 2.5), ny = 1 + Math.floor(hash(i, j, 2) * 2);
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
      const bw = (x1 - x0) / nx, bh = (y1 - y0) / ny;
      buildings.push({ x: x0 + a * bw + 0.06, y: y0 + b * bh + 0.06, w: bw - 0.12, h: bh - 0.12, col: ['#2e3a5e', '#34416a', '#2a3556', '#3a4670'][Math.floor(hash(i, j, a, b) * 4)], hit: Infinity });
    }
  }
  // routes along the roads: via the near bridge (shortest), via the far bridge, and a detour
  const routes: [number, number][][] = [
    [A, [0.9, 0.8], [15.1, 0.8], B],
    [A, [3.3, 5.2], [3.3, 7.4], [12.7, 7.4], [12.7, 5.2], [15.1, 5.2], B],
    [A, [15.1, 5.2], B],
  ];
  return { buildings, vroads, hroads, river, bridges, A, B, routes };
}

function segRect(ax: number, ay: number, bx: number, by: number, r: Building) {
  // parameter along A->B where the segment first enters the rectangle, or Infinity
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]]) {
    if (p === 0) { if (q < 0) return Infinity; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

function drawCity(c: CanvasRenderingContext2D, t: number, Wd: number, Hd: number, city: City, o: { routes: number[]; chosen: number; straight: [number, number] | null }) {
  const u = Math.min(Wd / 16, Hd / 9), ox = (Wd - 16 * u) / 2, oy = (Hd - 9 * u) / 2;
  const X = (x: number) => ox + x * u, Y = (y: number) => oy + y * u;
  c.fillStyle = '#121a2e'; c.fillRect(0, 0, Wd, Hd);
  // river and park
  c.fillStyle = '#1b3a63'; c.fillRect(X(city.river - 0.7), 0, 1.4 * u, Hd);
  c.strokeStyle = 'rgba(160,210,255,0.25)'; c.lineWidth = u * 0.03;
  for (let i = 0; i < 12; i++) { const y = ((i * 0.9 + t * 0.4) % 10) - 0.5; c.beginPath(); c.moveTo(X(city.river - 0.3), Y(y)); c.lineTo(X(city.river + 0.1), Y(y + 0.2)); c.stroke(); }
  c.fillStyle = '#1f3d33'; c.fillRect(X(5.95), Y(5.45), (city.river - 0.7 - 5.95 - 0.1) * u, 1.7 * u);
  c.fillStyle = '#2f5e48';
  for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(X(6.3 + (i % 3) * 0.4), Y(5.8 + Math.floor(i / 3) * 0.7), u * 0.18, 0, Math.PI * 2); c.fill(); }
  // roads
  c.strokeStyle = '#4a5b8c'; c.lineWidth = u * 0.32; c.lineCap = 'butt';
  for (const x of city.vroads) { c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), Hd); c.stroke(); }
  for (const y of city.hroads) {
    const cross = city.bridges.includes(y);
    c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(X(city.river - 0.75), Y(y)); c.moveTo(X(city.river + 0.75), Y(y)); c.lineTo(Wd, Y(y)); c.stroke();
    if (cross) { c.strokeStyle = '#56679a'; c.beginPath(); c.moveTo(X(city.river - 0.8), Y(y)); c.lineTo(X(city.river + 0.8), Y(y)); c.stroke(); c.strokeStyle = '#4a5b8c'; }
  }
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = u * 0.025; c.setLineDash([u * 0.12, u * 0.12]);
  for (const x of city.vroads) { c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), Hd); c.stroke(); }
  for (const y of city.hroads) { c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(Wd, Y(y)); c.stroke(); }
  c.setLineDash([]);
  // the straight line and what it does to the buildings
  let tipK = 0;
  if (o.straight) tipK = easeInOutCubic(clamp((t - o.straight[0]) / (o.straight[1] - o.straight[0])));
  const [ax, ay] = city.A, [bx, by] = city.B;
  for (const b of city.buildings) {
    const hitAt = o.straight ? segRect(ax, ay, bx, by, b) : Infinity;
    const crushed = hitAt <= tipK;
    const since = crushed && o.straight ? (tipK - hitAt) * (o.straight[1] - o.straight[0]) : 0;
    if (!crushed) {
      c.fillStyle = b.col; c.fillRect(X(b.x), Y(b.y), b.w * u, b.h * u);
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(X(b.x), Y(b.y), b.w * u, b.h * u * 0.25);
      c.fillStyle = 'rgba(255,217,138,0.5)';
      for (let k = 0; k < 3; k++) if (hash(b.x * 10, b.y * 10, k) > 0.6) c.fillRect(X(b.x + 0.1 + k * 0.18), Y(b.y + b.h * 0.55), u * 0.08, u * 0.08);
    } else {
      const flash = clamp(1 - since / 0.2);
      c.fillStyle = `rgb(${Math.round(lerp(58, 255, flash))},${Math.round(lerp(34, 90, flash))},${Math.round(lerp(40, 70, flash))})`;
      c.fillRect(X(b.x), Y(b.y), b.w * u, b.h * u);
      c.strokeStyle = 'rgba(20,10,10,0.8)'; c.lineWidth = u * 0.03;
      c.beginPath(); c.moveTo(X(b.x), Y(b.y)); c.lineTo(X(b.x + b.w * 0.6), Y(b.y + b.h * 0.5)); c.lineTo(X(b.x + b.w), Y(b.y + b.h * 0.3));
      c.moveTo(X(b.x + b.w * 0.6), Y(b.y + b.h * 0.5)); c.lineTo(X(b.x + b.w * 0.4), Y(b.y + b.h)); c.stroke();
      c.fillStyle = 'rgba(120,90,80,0.7)';
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(X(b.x + hash(b.x, k, 1) * b.w), Y(b.y + hash(b.y, k, 2) * b.h), u * (0.03 + hash(k, b.x, 3) * 0.05), 0, Math.PI * 2); c.fill(); }
    }
  }
  // candidate routes, dashed; the chosen one solid
  const routePath = (pts: [number, number][]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); };
  const lens = city.routes.map(r => r.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0));
  o.routes.forEach((rt, i) => {
    const k = easeOutCubic(clamp((t - rt) / 0.35));
    if (k <= 0) return;
    const pts = city.routes[i];
    c.save();
    c.strokeStyle = i === 2 && t >= o.chosen ? '#ff9a5a' : 'rgba(95,208,255,0.85)';
    c.lineWidth = u * (i === 2 && t >= o.chosen ? 0.16 : 0.08); c.setLineDash(i === 2 && t >= o.chosen ? [] : [u * 0.2, u * 0.12]);
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (i === 2 && t >= o.chosen) { c.shadowColor = '#ff9a5a'; c.shadowBlur = u * 0.3; }
    // draw progressively
    let left = k * lens[i];
    c.beginPath(); c.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (let s = 1; s < pts.length && left > 0; s++) {
      const [x0, y0] = pts[s - 1], [x1, y1] = pts[s], L = Math.hypot(x1 - x0, y1 - y0), f = Math.min(1, left / L);
      c.lineTo(X(lerp(x0, x1, f)), Y(lerp(y0, y1, f))); left -= L;
    }
    c.stroke(); c.restore();
    // distance label at the end of each route
    if (k >= 1) {
      const [lx, ly] = pts[Math.floor(pts.length / 2)];
      c.fillStyle = i === 2 ? '#ffd166' : '#9aa6c8'; c.font = `800 ${u * 0.26}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(`${(lens[i] * 0.4).toFixed(1)} km`, X(lx), Y(ly) - u * 0.32);
    }
  });
  if (o.straight && tipK > 0) {
    c.save();
    c.strokeStyle = '#ff6a4a'; c.lineWidth = u * 0.2; c.lineCap = 'round'; c.shadowColor = '#ff6a4a'; c.shadowBlur = u * 0.4;
    c.beginPath(); c.moveTo(X(ax), Y(ay)); c.lineTo(X(lerp(ax, bx, tipK)), Y(lerp(ay, by, tipK))); c.stroke();
    c.restore();
  }
  // the old chosen road route stays faintly
  if (o.straight) routePath(city.routes[2]), (c.strokeStyle = 'rgba(255,154,90,0.25)'), (c.lineWidth = u * 0.1), c.stroke();
  // start: a little Clawd; end: a flag
  const tip: [number, number] = o.straight ? [lerp(ax, bx, tipK), lerp(ay, by, tipK)] : [ax, ay];
  const s = u * 0.55, bob = Math.abs(Math.sin(t * 14)) * u * 0.05;
  c.fillStyle = INK; c.fillRect(X(tip[0]) - s / 2 - 3, Y(tip[1]) - s * 0.8 - 3 - bob, s + 6, s * 0.8 + 6);
  c.fillStyle = '#d97757'; c.fillRect(X(tip[0]) - s / 2, Y(tip[1]) - s * 0.8 - bob, s, s * 0.8);
  c.fillStyle = INK; c.fillRect(X(tip[0]) - s * 0.25, Y(tip[1]) - s * 0.6 - bob, s * 0.1, s * 0.2); c.fillRect(X(tip[0]) + s * 0.15, Y(tip[1]) - s * 0.6 - bob, s * 0.1, s * 0.2);
  const reached = o.straight && t >= o.straight[1];
  c.strokeStyle = INK; c.lineWidth = u * 0.05;
  c.beginPath(); c.moveTo(X(bx), Y(by)); c.lineTo(X(bx), Y(by) - u * 0.8); c.stroke();
  c.fillStyle = reached ? '#ffd166' : '#5cd17a';
  c.beginPath(); c.moveTo(X(bx), Y(by) - u * 0.8); c.lineTo(X(bx) + u * 0.5, Y(by) - u * 0.65); c.lineTo(X(bx), Y(by) - u * 0.5); c.closePath(); c.fill(); c.stroke();
  if (reached) {
    const k = clamp((t - o.straight![1]) / 0.4);
    c.strokeStyle = `rgba(255,214,102,${1 - k})`; c.lineWidth = u * 0.06;
    c.beginPath(); c.arc(X(bx), Y(by) - u * 0.4, u * (0.3 + k * 1.2), 0, Math.PI * 2); c.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// The office tower at night for K6 and K7: ten office floors over the server room.

function tower(tOff0: number, tOff1: number) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10152c');
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const sky = staticPlane(80, 40, 16, (c, Wd, Hd) => {
    const g = c.createLinearGradient(0, 0, 0, Hd); g.addColorStop(0, '#0b1028'); g.addColorStop(1, '#27315e');
    c.fillStyle = g; c.fillRect(0, 0, Wd, Hd);
    for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,255,240,${0.3 + hash(i, 301) * 0.7})`; const s = 1 + hash(i, 302) * 1.5; c.fillRect(hash(i, 303) * Wd, hash(i, 304) * Hd * 0.75, s, s); }
  });
  sky.position.set(0, 12, -20);
  scene.add(sky);
  const moon = inkedCircle(1.4, '#f6efd2', 0.06); moon.position.set(-11, 17, -18); scene.add(moon);
  const FL = 1.1, NF = 10, TW = 7.4, WIN = 6;
  // neighbours, dimming as the city sleeps
  const neighbours = Array.from({ length: 10 }, (_, b) => {
    const bw = 3 + hash(b, 311) * 3, bh = 4 + hash(b, 312) * 9, bx = (b < 5 ? -1 : 1) * (6.5 + (b % 5) * 3.4);
    const lit = canvasPlane<Frame>(bw, bh, 18, (c, f, Wd, Hd) => {
      c.fillStyle = '#1f2749'; c.fillRect(0, 0, Wd, Hd);
      const dim = smooth(unlerp(f.t, tOff0 - 0.5, tOff1 + 0.5));
      for (let i = 0; i < Wd / 12; i++) for (let j = 0; j < Hd / 16; j++) {
        const h = hash(b, i, j, 313);
        if (h > 0.4 * (1 - dim * 0.9)) continue;
        c.fillStyle = '#ffd98a'; c.fillRect(i * 12 + 3, j * 16 + 4, 6, 8);
      }
    });
    lit.mesh.position.set(bx, bh / 2 - 0.4, -4 - (b % 3) * 1.5);
    scene.add(lit.mesh);
    return lit;
  });
  // the tower: facade, ten floors of windows over a glowing server room
  const facade = inkedRect(TW, NF * FL + FL + 0.6, 0.05, '#3a4166', 0.08);
  facade.position.set(0, (NF * FL + FL + 0.6) / 2 - 0.3, 0);
  scene.add(facade);
  const crown = inkedRect(TW + 0.5, 0.5, 0.05, '#2c3352', 0.07); crown.position.set(0, NF * FL + FL + 0.45, 0.02); scene.add(crown);
  const antenna = inkedRect(0.08, 1.6, 0.02, '#9aa1b5', 0.03); antenna.position.set(1.8, NF * FL + FL + 1.4, 0.0); scene.add(antenna);
  const beacon = inkedCircle(0.12, '#ff4a3d', 0.03); beacon.position.set(1.8, NF * FL + FL + 2.25, 0.02); scene.add(beacon);
  const ww = (TW - 0.8) / WIN;
  const floors = Array.from({ length: NF }, (_, fi) => {
    const y = FL + fi * FL + FL / 2;
    const off = lerp(tOff1 - 0.1, tOff0, fi / (NF - 1)); // the top floor goes first
    const wins = Array.from({ length: WIN }, (_, wi) => {
      const g = new THREE.Group();
      const mat = ownMat('#ffd98a');
      g.add(inkedRect(ww - 0.18, FL - 0.32, 0.03, mat, 0.04));
      // a hint of a desk and a monitor in each lit window
      const desk = shapeMesh(roundedRectShape(ww * 0.55, 0.06, 0.01, 0, -0.18), ownMat('#c79a5c'), 0.004);
      const mon = shapeMesh(roundedRectShape(0.22, 0.16, 0.02, -0.05, -0.04), ownMat('#5b6b9a'), 0.004);
      g.add(desk, mon);
      g.position.set(-TW / 2 + 0.4 + (wi + 0.5) * ww, y, 0.03);
      scene.add(g);
      return { mat, desk, mon, at: off + wi * 0.02 };
    });
    const slab = shapeMesh(roundedRectShape(TW, 0.08, 0, 0, y - FL / 2), '#2c3352', 0.05); scene.add(slab);
    return wins;
  });
  // ground floor: the server room, cyan, with racks and a tiny Clawd at his desk
  const srY = FL / 2 + 0.05;
  const sr = new THREE.Group();
  const srMat = ownMat('#7fe3ff');
  sr.add(inkedRect(TW - 0.6, FL - 0.2, 0.03, srMat, 0.05));
  for (let i = 0; i < 9; i++) { const rk = inkedRect(0.36, FL - 0.4, 0.02, '#2a3556', 0.025); rk.position.set(-TW / 2 + 0.9 + i * 0.42 + (i > 4 ? 1.6 : 0), -0.05, 0.01); sr.add(rk); }
  const tiny = new THREE.Group();
  tiny.add(inkedRect(0.3, 0.2, 0.005, '#d97757', 0.02));
  for (const ex of [-0.07, 0.07]) { const e = shapeMesh(roundedRectShape(0.03, 0.06, 0.005), INK, 0.004); e.position.set(ex, 0.02, 0); tiny.add(e); }
  tiny.position.set(0.9, -0.12, 0.02);
  sr.add(tiny);
  sr.position.set(0, srY, 0.03);
  scene.add(sr);
  const srGlow = glow(1, '#7fe3ff', 0.2); srGlow.scale.set(6, 1.5, 1); srGlow.position.set(0, srY, 0.2); scene.add(srGlow);
  // hum: rings pulsing out of the server room on the beat
  const rings = [0, 1, 2].map(() => { const m = shapeMesh(ringShape(1, 0.04), ownMat('#7fe3ff', 0, true), 0, 48); m.position.set(0, srY, 0.3); scene.add(m); return m; });
  const street = shapeMesh(roundedRectShape(120, 6, 0, 0, -3), '#151a33', 0.1); scene.add(street);
  [-6, 6].forEach(x => { const l = new THREE.Group(); l.add(inkedRect(0.1, 2.4, 0.02, '#20263b', 0.03)); const b = inkedCircle(0.15, '#ffe9a8', 0.03); b.position.y = 1.25; l.add(b); const gl = glow(0.8, '#ffe9a8', 0.25); gl.position.y = 1.25; l.add(gl); l.position.set(x, 1.2, 0.6); scene.add(l); });
  return {
    scene, camera,
    update(f: Frame) {
      neighbours.forEach(n => n.update(f));
      floors.forEach(wins => wins.forEach(w => {
        const k = smooth(unlerp(f.t, w.at, w.at + 0.08));
        w.mat.color.set('#ffd98a').lerp(new THREE.Color('#1b2140'), k);
        w.desk.visible = w.mon.visible = k < 0.5;
      }));
      beacon.visible = Math.floor(f.t * 1.5) % 2 === 0;
      const beat = f.clock.beat(f.t), ph = beat - Math.floor(beat);
      srMat.color.set('#7fe3ff').lerp(new THREE.Color('#bff3ff'), (1 - ph) * 0.4);
      (srGlow.material as THREE.MeshBasicMaterial).opacity = 0.18 + (1 - ph) * 0.12;
      const dark = smooth(unlerp(f.t, tOff1, tOff1 + 0.5));
      rings.forEach((m, i) => {
        const k = ((beat + i / 3) % 1 + 1) % 1;
        m.scale.set(1.5 + k * 7, (1.5 + k * 7) * 0.3, 1);
        (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.35 * dark;
      });
    },
  };
}

function ringShape(r: number, t: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, r + t / 2, 0, Math.PI * 2, false);
  s.holes.push(new THREE.Path().absarc(0, 0, r - t / 2, 0, Math.PI * 2, true));
  return s;
}

