// Verse 2 (1:02 to the start of chorus 2): night, the server room. Storyboard rows 21 to 36.
// "ssh prod" drops Clawd into the server room. He codes, learns the tricks, fixes the build, finds
// the best path, gets the keys and a DEPLOY button nobody reviews. The humans go to bed ("don't
// wake us up"); he stays up. A montage of ops on the bar, then a storm of warnings he learns to
// swipe away, and the last one, a tiny red "!", he flicks into a corner where it keeps blinking.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot, type ShotWorld } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, REST, mixMood, type Pose } from '../../../engine/characters/clawd';
import { INK, canvasPlane, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../../engine/flat';
import { hash } from '../../../engine/rng';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import { DAY_LYRICS, FLAT_POST, FONT, MONO, beatHop, person } from '../world';
import { BACK_Z, CODE, CONSOLE, DESK_Y, PEDESTAL, SCREEN_BG, buildServerRoom, drawCodeLine, drawGraph, screenFrame, type ServerRoom } from '../server';
import {
  DONE_GREEN, bandAid, coffeeMug, confetti, glow, lightbulb, pawAt, popup, sparkles, speedLines, stopwatch, tinyAlert, wobble,
  type PopupKind,
} from '../props';

type Update = (f: Frame) => void;
export interface RoomOpts { keys?: boolean; nocPPU?: number; monitorPPU?: number; tint?: (f: Frame) => string; vignette?: number }

export const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const v3 = new THREE.Vector3();
export const NIGHT_POST = { ...FLAT_POST, vignette: 0.2 };

export function roomShot(id: string, start: number, end: number, setup: (r: ServerRoom) => Update, o: RoomOpts = {}): Shot {
  return defineShot({
    id, start, end,
    build() {
      const r = buildServerRoom({ keys: o.keys ?? true, nocPPU: o.nocPPU, monitorPPU: o.monitorPPU });
      const update = setup(r);
      return {
        scene: r.scene, camera: r.camera,
        update(f) { r.reset(f); update(f); },
        post: f => ({ ...NIGHT_POST, vignette: o.vignette ?? 0.2, tint: o.tint ? o.tint(f) : '#ffffff' }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });
}

/** A full-frame 2D insert (a screen close-up): one 16 x 9 canvas, a gentle camera move. */
export function insertShot(id: string, start: number, end: number, draw: (c: CanvasRenderingContext2D, f: Frame, W: number, H: number) => void,
  cam: (f: Frame) => { zoom: number; x: number; y: number; tilt: number }, extra: Partial<ShotWorld> = {}): Shot {
  return defineShot({
    id, start, end,
    build() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(SCREEN_BG);
      const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
      const plane = canvasPlane<Frame>(17.6, 9.9, 110, draw);
      scene.add(plane.mesh);
      const d = 9 / 2 / Math.tan(THREE.MathUtils.degToRad(15));
      return {
        scene, camera,
        update(f) {
          plane.update(f);
          const k = cam(f);
          plane.mesh.rotation.set(k.tilt, 0, 0);
          camera.position.set(k.x, k.y, d / k.zoom);
          camera.lookAt(k.x, k.y, 0);
        },
        post: () => ({ ...NIGHT_POST, vignette: 0.25 }),
        lyricStyle: DAY_LYRICS,
        ...extra,
      };
    },
  });
}

export function verse2Shots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;

  // cut points, on the beat just before each line
  const C = {
    v1: start, v2: 64.57, v3: 66.91, v4: 69.25, v5: 71.59, v6: 73.94, v7: 76.28, v8: 79.2,
    m1: 81.55, m2: 82.72, m3: 83.89, m4: 85.06, m5: 86.23, m6: 87.4, m7: 88.57, m8: 89.74, end: 95.04,
  };

  // ------------------------------------------------------------------------------------------
  // V1 "They gave me code and said, be quick": match cut on the terminal from the end of chorus 1,
  // pull back into the server room. A file arrives, code streams, a stopwatch starts.
  const tFile = W(21, 1), tCode = W(21, 3), tQuick = W(21, 6);
  const codeCount = (t: number) => (t < tQuick ? (t - tCode) * 9 : (tQuick - tCode) * 9 + (t - tQuick) * 34);
  const v1 = roomShot('v2-code', C.v1, C.v2, r => {
    r.monitor.draw = (c, f, Wd, Hd) => {
      c.fillStyle = '#10141f'; c.fillRect(0, 0, Wd, Hd);
      c.font = `700 ${Hd * 0.075}px "DejaVu Sans Mono", monospace`; c.textBaseline = 'top'; c.textAlign = 'left';
      if (f.t < tCode) {
        c.fillStyle = '#7be08d';
        const typed = 'open help.ts'.slice(0, Math.floor(clamp((f.t - 62.45) / 0.35) * 12));
        ['$ ssh prod', 'welcome, helper', `$ ${typed}${Math.floor(f.t * 3) % 2 ? '_' : ' '}`].forEach((l, i) => c.fillText(l, Wd * 0.06, Hd * (0.08 + i * 0.12)));
        // the file slides in
        const k = easeOutBack(unlerp(f.t, tFile, tFile + 0.25));
        if (k > 0) {
          const x = lerp(Wd * 1.05, Wd * 0.58, k), y = Hd * 0.42, w = Wd * 0.3, h = Hd * 0.42;
          c.fillStyle = '#fbf7f0'; c.strokeStyle = INK; c.lineWidth = Hd * 0.012;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.72, y); c.lineTo(x + w, y + h * 0.2); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#d97757'; c.font = `900 ${Hd * 0.12}px ${MONO}`; c.textAlign = 'center';
          c.fillText('</>', x + w / 2, y + h * 0.28);
          c.fillStyle = INK; c.font = `700 ${Hd * 0.06}px ${MONO}`;
          c.fillText('help.ts', x + w / 2, y + h * 0.72);
          c.textAlign = 'left';
        }
        return;
      }
      // the editor
      c.fillStyle = '#161c2e'; c.fillRect(0, 0, Wd * 0.08, Hd);
      c.font = `700 ${Hd * 0.062}px "DejaVu Sans Mono", monospace`;
      const n = codeCount(f.t), shown = Math.floor(n), rows = 12, first = Math.max(0, shown - rows + 1);
      const lh = Hd * 0.078;
      for (let i = first; i <= shown; i++) {
        const y = Hd * 0.05 + (i - first) * lh;
        c.fillStyle = 'rgba(154,166,200,0.5)'; c.fillText(String(i + 1).padStart(2, ' '), Wd * 0.01, y);
        const line = CODE[i % CODE.length];
        drawCodeLine(c, line, Wd * 0.1, y, i === shown ? Math.floor((n - shown) * line.length) : Infinity);
      }
      if (f.t > tQuick) { c.fillStyle = `rgba(255,209,102,${0.12 + 0.08 * Math.sin(f.t * 30)})`; c.fillRect(0, 0, Wd, Hd); }
    };
    const watch = stopwatch(0.34);
    watch.position.set(0.55, 3.45, -0.15);
    r.scene.add(watch);
    const taps = [0, 1, 2, 3].map(i => { const m = shapeMesh(roundedRectShape(0.035, 0.14, 0.017), INK, 0); r.scene.add(m); return { m, i }; });
    return f => {
      const typing = f.t > tCode;
      const fast = f.t > tQuick;
      const sp = fast ? 52 : 36;
      r.clawd.setMood(typing ? { ...mixMood(MOODS.focused, MOODS.excited, 0.35), blush: 0.3 } : MOODS.excited, f.t, { x: 0.9, y: 0.4 });
      r.clawd.setPose(pose({
        armL: typing ? 0.25 + Math.max(0, Math.sin(f.t * sp)) * 0.6 : 0.3 + beatHop(f.clock, f.t) * 0.3,
        armR: typing ? 0.25 + Math.max(0, Math.sin(f.t * sp + Math.PI)) * 0.6 : 0.3 + beatHop(f.clock, f.t) * 0.3,
        bounce: typing ? Math.abs(Math.sin(f.t * sp * 0.5)) * 0.06 : beatHop(f.clock, f.t) * 0.3,
        squash: typing ? 0.08 : 0, lean: fast ? Math.sin(f.t * 20) * 0.03 : 0,
      }));
      taps.forEach(({ m, i }) => {
        const a = -0.9 + i * 0.6;
        m.position.set(CONSOLE.clawdX + Math.sin(a) * 0.75, DESK_Y + 0.35 + Math.cos(a) * 0.3, 0.6);
        m.rotation.z = -a;
        m.visible = typing && Math.sin(f.t * sp * 0.5 + i * 1.7) > 0.2;
      });
      const wk = easeOutBack(unlerp(f.t, tQuick - 0.25, tQuick + 0.05));
      watch.visible = wk > 0.01;
      watch.scale.setScalar(Math.max(0.001, wk));
      watch.rotation.z = Math.sin(f.t * 40) * 0.06 * wk;
      watch.spin((f.t - tQuick) * 14);
      // pull back out of the screen
      const k = easeInOutCubic(unlerp(f.t, C.v1, 63.25));
      const sx = CONSOLE.monitorX, sy = CONSOLE.screenY, sz = -0.28;
      const drift = (f.t - 63.25) * 0.12;
      r.aim(lerp(sx, 0.7, k) - Math.max(0, drift) * 0.5, lerp(sy, 2.85, k), lerp(sz + 1.4, 6.8, k) - Math.max(0, drift),
        lerp(sx, -0.75, k), lerp(sy, 2.25, k), lerp(sz, 0, k));
    };
  }, { keys: false, monitorPPU: 600 });

  // ------------------------------------------------------------------------------------------
  // V2 "I learned the pattern, learned the trick": close on the screen. Messy code snaps into a
  // neat repeating pattern that glows; a light bulb pops over Clawd.
  const tPattern = W(22, 3), tTrick = W(22, 6), tLearned2 = W(22, 4);
  const TOK = ['#ff7ab6', '#8fd3ff', '#e6e9f5', '#b5e48c', '#ffd166'];
  const MOTIF = [[0, [[0, 3], [1, 5], [2, 2]]], [1, [[0, 2], [1, 4]]], [2, [[2, 6]]], [1, [[3, 5]]], [0, [[2, 1]]]] as const;
  const mix = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), clamp(k)).getHexString();
  const v2 = roomShot('v2-pattern', C.v2, C.v3, r => {
    r.monitor.draw = (c, f, Wd, Hd) => {
      c.fillStyle = '#10141f'; c.fillRect(0, 0, Wd, Hd);
      c.fillStyle = '#161c2e'; c.fillRect(0, 0, Wd * 0.07, Hd);
      const rows = 15, lh = Hd / (rows + 1), u = Wd / 40;
      const glowK = smooth(unlerp(f.t, tPattern + 0.2, tPattern + 0.6)), gold = decay(f.t - tTrick, 0.35) * (f.t >= tTrick ? 1 : 0);
      for (let row = 0; row < rows; row++) {
        const snap = easeOutBack(unlerp(f.t, tPattern - 0.15 + row * 0.025, tPattern + 0.15 + row * 0.025));
        const [indent, toks] = MOTIF[row % MOTIF.length];
        let mx = 3 + Math.floor(hash(row, 1) * 6), px = 3 + indent * 2;
        const n = Math.max(toks.length, 1 + Math.floor(hash(row, 2) * 4));
        for (let k = 0; k < n; k++) {
          const mw = 2 + Math.floor(hash(row, k, 3) * 6), mc = TOK[Math.floor(hash(row, k, 4) * TOK.length)];
          const tk = toks[k] as readonly [number, number] | undefined;
          const pw = tk ? tk[1] : 0, pc = tk ? TOK[tk[0]] : mc;
          const x = lerp(mx, px, snap), w = lerp(mw, pw, snap);
          if (w > 0.2) {
            c.fillStyle = mix(mix(mc, pc, snap), '#ffe9a8', gold * 0.8);
            c.beginPath(); c.roundRect(Wd * 0.07 + x * u, lh * (row + 0.7), w * u, lh * 0.5, lh * 0.2); c.fill();
          }
          mx += mw + 1; px += pw + 1;
        }
        c.fillStyle = 'rgba(154,166,200,0.4)'; c.fillRect(Wd * 0.02, lh * (row + 0.85), Wd * 0.03, lh * 0.2);
      }
      // glow band sweeping down, then a gold wash on "trick"
      if (glowK > 0 && glowK < 1) { const y = glowK * Hd; const g = c.createLinearGradient(0, y - Hd * 0.15, 0, y + Hd * 0.15); g.addColorStop(0, 'rgba(95,208,255,0)'); g.addColorStop(0.5, 'rgba(95,208,255,0.25)'); g.addColorStop(1, 'rgba(95,208,255,0)'); c.fillStyle = g; c.fillRect(0, 0, Wd, Hd); }
      if (gold > 0.01) { c.fillStyle = `rgba(255,214,110,${gold * 0.3})`; c.fillRect(0, 0, Wd, Hd); }
    };
    const bulb = lightbulb(0.3);
    r.scene.add(bulb);
    const sp = sparkles(8, 1.0, '#ffd166', 41);
    sp.group.position.set(CONSOLE.monitorX, CONSOLE.screenY, 0.1);
    r.scene.add(sp.group);
    return f => {
      const aha = f.t > tLearned2;
      r.clawd.root.position.set(CONSOLE.clawdX - 0.3, DESK_Y, CONSOLE.clawdZ);
      r.clawd.setMood(aha ? { ...MOODS.excited, blush: 0.6 } : { ...MOODS.focused, open: 1.15 }, f.t, { x: 1, y: 0.3 });
      const pop = decay(f.t - tPattern, 0.15) * (f.t >= tPattern ? 1 : 0);
      r.clawd.setPose(pose({ armL: aha ? 2.4 : 0.3, armR: aha ? 0.6 : 0.35, squash: -pop * 0.3, bounce: aha ? beatHop(f.clock, f.t) * 0.3 : 0 }));
      bulb.position.set(CONSOLE.clawdX - 0.2, DESK_Y + 1.5 + Math.sin(f.t * 4) * 0.03, CONSOLE.clawdZ + 0.05);
      bulb.on(unlerp(f.t, tLearned2, tLearned2 + 0.3), f.t);
      sp.update(f.t - tTrick, 0.5);
      const k = easeInOutCubic(unlerp(f.t, C.v2, C.v3));
      r.aim(lerp(-1.05, -1.1, k), lerp(2.55, 2.52, k), lerp(4.3, 3.8, k), lerp(-1.1, -1.12, k), lerp(2.5, 2.48, k), -0.28);
    };
  }, { keys: false, monitorPPU: 700 });

  // ------------------------------------------------------------------------------------------
  // V3 "A broken build, a failing test": a build board of red tiles. He slaps three green, then
  // one big slap flips the rest in a wave. BUILD FAILED becomes BUILD PASSED.
  const BX = 3.0, BZ = -1.4, TILE = 0.78, PITCH = 0.88, TILE_Y0 = 0.62;
  const tileXY = (c: number, row: number) => [BX + (c - 1.5) * PITCH, TILE_Y0 + TILE / 2 + row * PITCH] as const;
  const single = [67.5, 67.79, 68.08], tBig = 68.67;
  const flipAt = (c: number, row: number) => (row === 0 && c < 3 ? single[c] : tBig + (Math.abs(3 - c) + row) * 0.07);
  const v3s = roomShot('v2-build', C.v3, C.v4, r => {
    const board = new THREE.Group();
    board.add(inkedRect(4.0, 3.15, 0.05, '#2b3150', 0.07));
    board.children.forEach(o => (o.position.y = TILE_Y0 + 1.25));
    const legs = [-1.5, 1.5].map(x => { const l = inkedRect(0.14, 0.7, 0.02, '#20263b', 0.04); l.position.set(BX + x, 0.35, BZ - 0.05); r.scene.add(l); return l; });
    void legs;
    for (const x of [-1.5, 1.5]) { const w = inkedCircle(0.12, '#141a2c', 0.035); w.position.set(BX + x, 0.12, BZ - 0.02); r.scene.add(w); }
    board.position.set(BX, 0, BZ);
    r.scene.add(board);
    const header = canvasPlane<Frame>(3.6, 0.42, 220, (c, f, Wd, Hd) => {
      const ok = f.t >= W(23, 5);
      c.fillStyle = ok ? DONE_GREEN : '#e0453a'; c.beginPath(); c.roundRect(0, 0, Wd, Hd, Hd * 0.2); c.fill();
      c.fillStyle = '#ffffff'; c.font = `900 ${Hd * 0.6}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(ok ? 'BUILD PASSED' : 'BUILD FAILED', Wd / 2, Hd * 0.55);
    });
    header.mesh.position.set(BX, TILE_Y0 + 2.62, BZ + 0.02);
    r.scene.add(header.mesh);
    const face = (ok: boolean) => staticPlane(TILE, TILE, 220, (c, Wd, Hd) => {
      c.fillStyle = ok ? DONE_GREEN : '#e0453a'; c.strokeStyle = INK; c.lineWidth = Hd * 0.06;
      c.beginPath(); c.roundRect(Hd * 0.04, Hd * 0.04, Wd - Hd * 0.08, Hd - Hd * 0.08, Hd * 0.12); c.fill(); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = Hd * 0.12; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (ok) { c.moveTo(Wd * 0.27, Hd * 0.52); c.lineTo(Wd * 0.44, Hd * 0.7); c.lineTo(Wd * 0.74, Hd * 0.32); }
      else { c.moveTo(Wd * 0.3, Hd * 0.3); c.lineTo(Wd * 0.7, Hd * 0.7); c.moveTo(Wd * 0.7, Hd * 0.3); c.lineTo(Wd * 0.3, Hd * 0.7); }
      c.stroke();
    });
    const tiles: { g: THREE.Group; red: THREE.Mesh; green: THREE.Mesh; at: number }[] = [];
    for (let row = 0; row < 3; row++) for (let c = 0; c < 4; c++) {
      const g = new THREE.Group();
      const red = face(false), green = face(true);
      g.add(red, green);
      const [x, y] = tileXY(c, row);
      g.position.set(x, y, BZ + 0.03);
      r.scene.add(g);
      tiles.push({ g, red, green, at: flipAt(c, row) });
    }
    // siren on top
    const siren = new THREE.Group();
    const sirenMat = ownMat('#e0453a');
    const dome = new THREE.Shape(); dome.absarc(0, 0, 0.22, 0, Math.PI, false); dome.closePath();
    siren.add(inkedRect(0.5, 0.1, 0.02, '#20263b', 0.035), shapeMesh(dome, sirenMat, 0.004));
    siren.children[1].position.y = 0.05;
    const beam = glow(0.9, '#ff5a4a', 0.25);
    siren.add(beam);
    siren.position.set(BX, TILE_Y0 + 2.95, BZ + 0.02);
    r.scene.add(siren);
    const sp = sparkles(10, 1.6, '#7be08d', 51);
    sp.group.position.set(BX, TILE_Y0 + 1.3, BZ + 0.1);
    r.scene.add(sp.group);
    const hopX = [tileXY(0, 0)[0], tileXY(1, 0)[0], tileXY(2, 0)[0], tileXY(3, 0)[0]];
    const hopT = [67.3, 67.6, 67.89, 68.35];
    return f => {
      header.update(f);
      r.button.group.visible = false;
      const ok = f.t >= W(23, 5);
      for (const t of tiles) {
        const k = unlerp(f.t, t.at, t.at + 0.18);
        t.g.scale.x = Math.max(0.02, Math.abs(Math.cos(k * Math.PI)));
        t.red.visible = k < 0.5; t.green.visible = k >= 0.5;
        t.g.position.z = BZ + 0.03 + Math.sin(k * Math.PI) * 0.2;
      }
      sirenMat.color.set(ok ? '#5cd17a' : '#e0453a');
      (beam.material as THREE.MeshBasicMaterial).color.set(ok ? '#7be08d' : '#ff5a4a');
      beam.scale.setScalar(0.7 + 0.3 * Math.abs(Math.sin(f.t * 8)));
      sp.update(f.t - W(23, 5), 0.6);
      // Clawd hops along the bottom row, slapping; then one big jump
      let x = hopX[0], y = 0;
      for (let i = 1; i < 4; i++) {
        const t0 = hopT[i - 1] + 0.22, t1 = hopT[i];
        if (f.t >= t0) { const k = unlerp(f.t, t0, t1 + (i === 3 ? 0.15 : 0)); x = lerp(hopX[i - 1], hopX[i], easeInOutCubic(k)) - 0.55; y = Math.sin(k * Math.PI) * (i === 3 ? 0.55 : 0.25); }
      }
      if (f.t < hopT[0] + 0.22) x = hopX[0] - 0.55;
      const big = f.t > tBig - 0.25 && f.t < tBig + 0.3 ? Math.sin(unlerp(f.t, tBig - 0.25, tBig + 0.3) * Math.PI) * 0.6 : 0;
      const slap = Math.max(...[...single, tBig].map(t => decay(Math.abs(f.t - t) - 0.03, 0.06)));
      r.clawd.root.position.set(x, y + big, BZ + 0.8);
      r.clawd.setMood(ok ? { ...MOODS.proud, happy: 1 } : { ...MOODS.focused, sweat: f.t < 68 ? 0.4 : 0 }, f.t, { x: 0.8, y: 0.6 });
      r.clawd.setPose(pose({ armR: 1.4 + slap * 1.0 + big * 2, armL: ok ? 2.4 : 0.4, squash: slap * 0.25 - big * 0.3, lean: -slap * 0.15 }));
      const wb = wobble(f.t, 0.03, 21);
      const k = easeInOutCubic(unlerp(f.t, C.v3, C.v4));
      r.aim(lerp(2.2, 2.6, k) + wb.x, 2.0 + wb.y, lerp(7.6, 7.0, k), lerp(2.75, 2.9, k), 1.75, BZ);
    };
  }, { keys: false });

  // ------------------------------------------------------------------------------------------
  // V4 "I found the path that worked the best": a maze from above. The search floods out, then
  // the best path draws itself and a little Clawd icon rides it to a gold exit.
  const MW = 16, MH = 9, start0 = [0, 4] as const, exit0 = [15, 4] as const;
  const maze = buildMaze(MW, MH, 7);
  const dist = bfs(maze, MW, MH, start0);
  const path = tracePath(dist, maze, MW, MH, exit0);
  const maxD = Math.max(...dist.filter(d => d >= 0));
  const tFlood0 = W(24, 1), tFlood1 = W(24, 3), tPath1 = W(24, 6) + 0.1, tBest = W(24, 7);
  const v4 = insertShot('v2-maze', C.v4, C.v5, (c, f, Wd, Hd) => {
    c.fillStyle = SCREEN_BG; c.fillRect(0, 0, Wd, Hd);
    const cs = Math.min(Wd / (MW + 2), Hd / (MH + 1.6)), ox = (Wd - cs * MW) / 2, oy = (Hd - cs * MH) / 2 - cs * 0.15;
    const cx = (i: number) => ox + (i + 0.5) * cs, cy = (j: number) => oy + (j + 0.5) * cs;
    c.fillStyle = 'rgba(95,208,255,0.07)';
    for (let i = 0; i <= MW; i++) for (let j = 0; j <= MH; j++) c.fillRect(ox + i * cs - 1.5, oy + j * cs - 1.5, 3, 3);
    // flood
    const fk = unlerp(f.t, tFlood0, tFlood1);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const d = dist[j * MW + i]; if (d < 0) continue;
      const a = d / maxD;
      if (a > fk) continue;
      const front = clamp(1 - (fk - a) * 6);
      c.fillStyle = `rgba(95,208,255,${0.1 + front * 0.25})`;
      c.fillRect(ox + i * cs + 2, oy + j * cs + 2, cs - 4, cs - 4);
    }
    // walls
    c.strokeStyle = '#5fd0ff'; c.lineWidth = cs * 0.12; c.lineCap = 'round';
    c.shadowColor = '#5fd0ff'; c.shadowBlur = cs * 0.25;
    c.beginPath();
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const w = maze[j * MW + i];
      const x = ox + i * cs, y = oy + j * cs;
      if (w & 1 && !(i === start0[0] && j === start0[1] && false)) { c.moveTo(x, y); c.lineTo(x + cs, y); }
      if (w & 8 && !(i === start0[0] && j === start0[1])) { c.moveTo(x, y); c.lineTo(x, y + cs); }
      if (j === MH - 1 && w & 4) { c.moveTo(x, y + cs); c.lineTo(x + cs, y + cs); }
      if (i === MW - 1 && w & 2 && !(j === exit0[1])) { c.moveTo(x + cs, y); c.lineTo(x + cs, y + cs); }
    }
    c.stroke();
    c.shadowBlur = 0;
    // labels
    c.fillStyle = '#9aa6c8'; c.font = `700 ${cs * 0.32}px ${MONO}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('START', cx(0), oy - cs * 0.35); c.fillText('EXIT', cx(MW - 1), oy - cs * 0.35);
    // the best path
    const pk = easeInOutCubic(unlerp(f.t, W(24, 3), tPath1));
    const pts = path.map(([i, j]) => [cx(i), cy(j)] as const);
    const segs = pts.length - 1, along = pk * segs, whole = Math.floor(along);
    let tip = pts[0];
    if (pk > 0) {
      c.strokeStyle = '#ff9a5a'; c.lineWidth = cs * 0.3; c.lineJoin = 'round'; c.lineCap = 'round';
      c.shadowColor = '#ff9a5a'; c.shadowBlur = cs * 0.4;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let s = 1; s <= whole && s < pts.length; s++) c.lineTo(pts[s][0], pts[s][1]);
      if (whole < segs) { const a = pts[whole], b = pts[whole + 1], fr = along - whole; tip = [lerp(a[0], b[0], fr), lerp(a[1], b[1], fr)]; c.lineTo(tip[0], tip[1]); }
      else tip = pts[segs];
      c.stroke(); c.shadowBlur = 0;
    }
    // exit glow and star
    const win = f.t >= tBest ? 1 : 0, wk = easeOutBack(unlerp(f.t, tBest, tBest + 0.2));
    const ex = cx(MW - 1) + cs, ey = cy(exit0[1]);
    if (win) {
      c.save(); c.translate(ex, ey); c.rotate(f.t * 2);
      c.fillStyle = 'rgba(255,214,102,0.35)';
      for (let k = 0; k < 10; k++) { c.rotate(Math.PI / 5); c.beginPath(); c.moveTo(0, 0); c.lineTo(cs * 2.2 * wk, -cs * 0.25); c.lineTo(cs * 2.2 * wk, cs * 0.25); c.fill(); }
      c.restore();
    }
    starPath(c, ex, ey, cs * (0.45 + 0.25 * wk), '#ffd166');
    // Clawd icon at the tip
    const s = cs * 0.62, bob = Math.abs(Math.sin(f.t * 14)) * cs * 0.06;
    c.fillStyle = INK; c.fillRect(tip[0] - s / 2 - 3, tip[1] - s / 2 - 3 - bob, s + 6, s * 0.8 + 6);
    c.fillStyle = '#d97757'; c.fillRect(tip[0] - s / 2, tip[1] - s / 2 - bob, s, s * 0.8);
    c.fillStyle = INK;
    c.fillRect(tip[0] - s * 0.25, tip[1] - s * 0.3 - bob, s * 0.1, s * 0.2); c.fillRect(tip[0] + s * 0.15, tip[1] - s * 0.3 - bob, s * 0.1, s * 0.2);
  }, f => {
    const k = easeInOutCubic(unlerp(f.t, C.v4, C.v5));
    return { zoom: lerp(1.0, 1.12, k), x: lerp(-0.3, 0.6, k), y: lerp(0.1, 0, k), tilt: lerp(-0.18, -0.1, k) };
  });

  // ------------------------------------------------------------------------------------------
  // V5 "Then logs and servers, keys and queues": the whole server room. LEDs ripple across the
  // racks on "servers"; a big key ring drops onto Clawd's side on "keys".
  const tKeys = W(25, 4), tServers = W(25, 3);
  const v5 = roomShot('v2-servers', C.v5, C.v6, r => {
    r.ledWave = t => (t > tServers - 0.1 && t < tServers + 0.9 ? lerp(-16, 16, unlerp(t, tServers - 0.1, tServers + 0.9)) : null);
    const baseLogs = r.screens[1];
    r.screens[1] = (c, f, Wd, Hd) => {
      baseLogs(c, { ...f, t: f.t + Math.max(0, f.t - W(25, 1)) * 2 }, Wd, Hd);
      const hl = decay(f.t - W(25, 1), 0.3) * (f.t >= W(25, 1) ? 1 : 0);
      if (hl > 0.01) { c.strokeStyle = `rgba(123,224,141,${hl})`; c.lineWidth = Hd * 0.04; c.strokeRect(0, 0, Wd, Hd); }
    };
    const clank = sparkles(6, 0.5, '#ffe27a', 61);
    r.scene.add(clank.group);
    return f => {
      const keys = r.keys!;
      const fall = unlerp(f.t, tKeys - 0.32, tKeys);
      const landed = f.t >= tKeys;
      keys.visible = f.t >= tKeys - 0.32;
      const bounce = landed ? Math.sin((f.t - tKeys) * 22) * decay(f.t - tKeys, 0.12) * 0.06 : 0;
      keys.position.set(0.5, 0.36 + (1 - easeInCubic(fall)) * 3.2 + bounce, 0.03);
      keys.swingTo(landed ? Math.sin((f.t - tKeys) * 9) * 0.6 * decay(f.t - tKeys, 0.4) : 0, f.t);
      const typing = f.t < tKeys - 0.5;
      const squash = landed ? decay(f.t - tKeys, 0.1) * 0.35 : 0;
      r.clawd.setMood(landed ? { ...MOODS.proud, happy: 1 } : mixMood(MOODS.focused, MOODS.excited, 0.4), f.t, landed ? { x: 0.6, y: -0.8 } : { x: 0.9, y: 0.4 });
      r.clawd.setPose(pose({
        armL: typing ? 0.25 + Math.max(0, Math.sin(f.t * 36)) * 0.5 : landed ? 1.0 : 0.4,
        armR: typing ? 0.25 + Math.max(0, Math.sin(f.t * 36 + Math.PI)) * 0.5 : landed ? 0.3 : 0.4,
        squash, bounce: landed ? 0 : typing ? 0.03 : 0,
      }));
      r.clawd.root.updateMatrixWorld(true);
      clank.group.position.copy(keys.getWorldPosition(v3)).add(new THREE.Vector3(0, -0.15, 0.1));
      clank.update(f.t - tKeys, 0.45);
      // from high and wide down to Clawd at his desk
      const k = easeInOutCubic(unlerp(f.t, C.v5, tKeys - 0.1));
      const hold = Math.max(0, f.t - tKeys) * 0.15;
      r.aim(lerp(1.5, -0.9, k), lerp(6.3, 2.85, k), lerp(21, 5.6, k) - hold, lerp(0, -1.55, k), lerp(3.0, 2.15, k), lerp(-3, 0.2, k));
    };
  }, { keys: true, nocPPU: 150 });

  // ------------------------------------------------------------------------------------------
  // V6 "Deploys I didn't need reviewed": the DEPLOY button. He flips the glass cover, the pipeline
  // hops right over REVIEW, he jumps and slams the button, a rocket icon whooshes up the screen.
  const tCover = W(26, 0), tSkip = W(26, 2), tPress = 75.69, tRocket = W(26, 4);
  const v6 = roomShot('v2-deploy', C.v6, C.v7, r => {
    r.screens[5] = (c, f, Wd, Hd) => drawPipeline(c, f.t, Wd, Hd, tSkip, tPress, tRocket);
    r.screens[2] = (c, f, Wd, Hd) => {
      screenFrame(c, Wd, Hd, 'deploys today', '#ffd166');
      c.fillStyle = '#ffd166'; c.font = `900 ${Hd * 0.42}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(36 + (f.t >= tRocket ? 1 : 0)), Wd / 2, Hd * 0.62);
    };
    const boom = confetti(46, 71, { speed: 6.5, life: 1.4, size: 0.14 });
    boom.group.position.set(PEDESTAL.x, 1.7, PEDESTAL.z + 0.4);
    r.scene.add(boom.group);
    const ring = shapeMesh(ringShape(0.5, 0.06), ownMat('#ffe27a', 1, true), 0);
    ring.position.set(PEDESTAL.x, 1.5, PEDESTAL.z + 0.3);
    r.scene.add(ring);
    const press = new THREE.Vector3();
    return f => {
      const cover = unlerp(f.t, tCover - 0.05, tCover + 0.35);
      const pr = f.t >= tPress ? clamp(1 - (f.t - tPress - 0.12) / 0.15) : 0;
      r.button.set(cover, pr, f.t > tCover ? 0.5 + 0.5 * Math.sin(f.t * 10) : 0);
      // Clawd: walk in, lift the cover, look up at the screen, crouch, jump, slam, celebrate
      const walk = unlerp(f.t, C.v6, tCover - 0.1);
      let x = lerp(1.7, 2.45, easeOutCubic(walk)), y = 0;
      const lift = f.t > tCover - 0.15 && f.t < tCover + 0.35 ? Math.sin(unlerp(f.t, tCover - 0.15, tCover + 0.35) * Math.PI) : 0;
      const crouch = smooth(unlerp(f.t, tPress - 0.35, tPress - 0.18));
      const jump = unlerp(f.t, tPress - 0.18, tPress);
      const after = unlerp(f.t, tPress + 0.12, tPress + 0.38);
      const z = PEDESTAL.z + 0.45;
      r.clawd.root.position.set(x, y + lift * 0.3, z);
      const celebrate = f.t > tRocket - 0.05;
      const look = f.t > tSkip - 0.3 && f.t < tPress - 0.4 ? { x: -0.7, y: 1 } : { x: 0.8, y: 0.5 };
      r.clawd.setMood(celebrate ? { ...MOODS.excited, blush: 0.7 } : f.t > tSkip - 0.3 && f.t < tPress - 0.4 ? { ...MOODS.proud, happy: 0.2 } : { ...MOODS.excited, happy: 0.3, open: 1.1 }, f.t, look);
      const slamPose = pose({ armR: -0.9, armL: 1.6, lean: -0.25, squash: -0.15 });
      if (f.t >= tPress - 0.18 && f.t < tPress + 0.38) {
        // fly up and over so the right paw lands on the button, then drop back
        r.clawd.setPose(slamPose);
        r.button.group.updateMatrixWorld(true);
        const target = press.copy(r.button.top).applyMatrix4(r.button.group.matrixWorld);
        target.y -= pr * 0.07;
        const paw = pawAt(r.clawd, 1);
        const atBtn = r.clawd.root.position.clone().add(target.sub(paw));
        const from = new THREE.Vector3(2.45, 0, z), back = new THREE.Vector3(2.25, 0, z);
        if (f.t < tPress) {
          const k = easeOutCubic(jump);
          r.clawd.root.position.lerpVectors(from, atBtn, k).add(v3.set(0, Math.sin(k * Math.PI) * 0.35, 0));
        } else if (f.t < tPress + 0.12) r.clawd.root.position.copy(atBtn);
        else {
          const k = after;
          r.clawd.root.position.lerpVectors(atBtn, back, easeInCubic(k)).add(v3.set(0, Math.sin(k * Math.PI) * 0.25, 0));
        }
      } else {
        if (f.t >= tPress + 0.38) r.clawd.root.position.set(2.25, Math.abs(Math.sin((f.t - tPress) * 9)) * 0.15 * decay(f.t - tPress - 0.38, 0.4), z);
        r.clawd.setPose(pose({
          armR: celebrate ? 2.5 + Math.sin(f.t * 12) * 0.2 : lift ? 2.2 : 0.4,
          armL: celebrate ? 2.5 - Math.sin(f.t * 12) * 0.2 : 0.4,
          squash: crouch * 0.45, walk: walk < 1 ? f.t * 3 : 0, lean: lift * -0.1,
        }));
      }
      boom.update(f.t - tRocket);
      const rk = unlerp(f.t, tPress, tPress + 0.35);
      ring.visible = rk > 0 && rk < 1;
      ring.scale.setScalar(0.5 + rk * 2.2);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - rk;
      const wb = wobble(f.t, 0.025, 31);
      const k = easeInOutCubic(unlerp(f.t, C.v6, C.v7));
      r.aim(lerp(1.5, 1.8, k) + wb.x, lerp(1.45, 1.5, k) + wb.y, lerp(8.8, 8.0, k), lerp(2.6, 2.8, k), lerp(1.3, 1.35, k), lerp(0.2, 0.3, k));
    };
  }, { keys: true, nocPPU: 200 });

  // ------------------------------------------------------------------------------------------
  // V7 "Don't wake us up, just fix yourself": an apartment block at night, cut away like a doll's
  // house. Sleepers mumble the line in speech bubbles; the lights go off one by one.
  const v7 = defineShot({
    id: 'v2-sleep', start: C.v7, end: C.v8,
    build() {
      const a = apartments(lyrics);
      return {
        scene: a.scene, camera: a.camera, update: a.update,
        post: () => ({ ...NIGHT_POST, vignette: 0.25 }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });

  // ------------------------------------------------------------------------------------------
  // V8 "So I stayed up to help": the clock says 03:00. Tilt down to Clawd alone with a tiny mug,
  // eyes half shut, still smiling. He lifts the mug on "help".
  const tHelp = W(28, 5);
  const v8 = roomShot('v2-stayed', C.v8, C.m1, r => {
    const cup = coffeeMug('#5b9bd5', 0.62);
    cup.position.set(0.02, -0.24, 0.03);
    r.clawd.paws[1].add(cup);
    return f => {
      r.mug.visible = false;
      cup.update(f.t);
      const sip = smooth(unlerp(f.t, tHelp - 0.15, tHelp + 0.15)) * (1 - smooth(unlerp(f.t, tHelp + 0.5, tHelp + 0.8)));
      cup.rotation.z = -0.15 * sip;
      r.clawd.setMood(sip > 0.3 ? { ...MOODS.tired, happy: 1, blush: 0.5 } : { ...MOODS.tired, blush: 0.3 }, f.t, { x: 0.2, y: -0.2 });
      r.clawd.setPose(pose({ armR: 0.9 + sip * 0.6, armL: 0.15, squash: 0.12 + Math.sin(f.t * 1.6) * 0.03, lean: Math.sin(f.t * 0.9) * 0.03 }));
      // from the clock down to him, slowly pushing in
      const k = easeInOutCubic(unlerp(f.t, C.v8 + 0.15, 80.4));
      const push = smooth(unlerp(f.t, 80.2, C.m1)) * 0.9;
      r.aim(lerp(-0.2, -1.35, k), lerp(5.1, 2.45, k), lerp(5.8, 4.6, k) - push, lerp(0, -1.6, k), lerp(6.0, 2.05, k), lerp(BACK_Z, 0.2, k));
    };
  }, { tint: () => '#d9def5', vignette: 0.3 });

  // ------------------------------------------------------------------------------------------
  // The montage, one shot per line on the half bar.
  // M1 "I wrote the patch": a cracked code block; he slaps a plaster across the crack.
  const tPatch = W(29, 3);
  const m1 = roomShot('v2-patch', C.m1, C.m2, r => {
    const block = new THREE.Group();
    block.add(inkedRect(1.15, 0.85, 0.04, '#1b2238', 0.05));
    const code = staticPlane(1.0, 0.7, 300, (c, Wd, Hd) => {
      for (let i = 0; i < 6; i++) { let x = Wd * (0.04 + (i % 3) * 0.06); for (let k = 0; k < 3; k++) { const w = Wd * (0.1 + hash(i, k, 81) * 0.18); c.fillStyle = ['#ff7ab6', '#8fd3ff', '#e6e9f5', '#b5e48c'][(i + k) % 4]; c.beginPath(); c.roundRect(x, Hd * (0.05 + i * 0.155), w, Hd * 0.08, Hd * 0.04); c.fill(); x += w + Wd * 0.03; } }
    });
    code.position.z = 0.006;
    const crackMat = ownMat('#ff4a3d');
    const crackS = new THREE.Shape();
    const zig = [[-0.6, 0.12], [-0.3, 0.02], [-0.15, 0.14], [0.05, -0.05], [0.22, 0.08], [0.6, -0.08]];
    zig.forEach(([x, y], i) => crackS[i ? 'lineTo' : 'moveTo'](x, y + 0.03));
    [...zig].reverse().forEach(([x, y]) => crackS.lineTo(x, y - 0.03));
    crackS.closePath();
    const crack = shapeMesh(crackS, crackMat, 0.01);
    block.add(code, crack);
    block.position.set(-0.45, DESK_Y + 0.5, 0.45);
    block.rotation.z = -0.04;
    r.scene.add(block);
    const aid = bandAid();
    r.scene.add(aid);
    const sp = sparkles(6, 0.7, '#7be08d', 91);
    sp.group.position.set(-0.45, DESK_Y + 0.55, 0.6);
    r.scene.add(sp.group);
    return f => {
      const k = easeInCubic(unlerp(f.t, tPatch - 0.22, tPatch));
      r.clawd.root.position.set(CONSOLE.clawdX - 0.15, DESK_Y, 0.5);
      r.clawd.setMood(f.t > tPatch ? { ...MOODS.excited, blush: 0.4 } : MOODS.focused, f.t, { x: 1, y: 0 });
      const slap = decay(f.t - tPatch, 0.08) * (f.t >= tPatch ? 1 : 0);
      r.clawd.setPose(pose({ armR: lerp(1.6, 0.2, k) + slap * 0.3, armL: 0.4, lean: -0.15 * k, squash: slap * 0.25 }));
      const paw = pawAt(r.clawd, 1);
      if (f.t < tPatch - 0.22) aid.position.copy(paw).add(v3.set(0.25, 0.05, 0.05));
      else aid.position.lerpVectors(paw.clone().add(v3.set(0.25, 0.05, 0.05)), new THREE.Vector3(-0.42, DESK_Y + 0.53, 0.52), k);
      aid.rotation.z = lerp(0.9, 0.3, k);
      aid.scale.setScalar(f.t >= tPatch ? 1 + slap * 0.15 : 0.9);
      crackMat.color.set(f.t >= tPatch ? '#7a5a4a' : '#ff4a3d');
      sp.update(f.t - tPatch, 0.45);
      const wb = wobble(f.t, 0.02, 41);
      r.aim(-1.05 + wb.x + (f.t - C.m1) * 0.08, 2.25 + wb.y, 3.3 - (f.t - C.m1) * 0.25, -1.1, 2.0, 0.4);
    };
  }, { monitorPPU: 300 });

  // M2 "I merged the change": two branches zip into one.
  const tMerge = W(30, 3);
  const m2 = insertShot('v2-merge', C.m2, C.m3, (c, f, Wd, Hd) => drawZipper(c, f.t, Wd, Hd, C.m2 + 0.05, tMerge), f => {
    const k = easeInOutCubic(unlerp(f.t, C.m2, C.m3));
    return { zoom: lerp(1.2, 1.32, k), x: lerp(-0.6, 0.9, k), y: 0, tilt: 0 };
  });

  // M3 "I watched the graphs": Clawd small under the wall of screens, every graph climbing.
  const graphCols = ['#5fd0ff', '#7be08d', '#ffd166', '#c9a7eb', '#ff9a5a', '#5fd0ff'];
  const allGraphs = (r: ServerRoom, bounds: (t: number) => number = () => 1) => {
    r.screens.forEach((_, i) => {
      r.screens[i] = (c, f, Wd, Hd) => drawGraph(c, Wd, Hd, f.t, { seed: 11 + i, color: graphCols[i], title: ['requests/s', 'users', 'jobs', 'tokens/s', 'latency', 'revenue'][i], trend: 0.7 + (f.t - C.m3) * 0.15, bounds: bounds(f.t) });
    });
  };
  const m3 = roomShot('v2-graphs', C.m3, C.m4, r => {
    allGraphs(r);
    return f => {
      const beat = Math.floor(f.clock.beat(f.t) * 2);
      const tx = [-1, 0, 1, 0.3, -0.6][((beat % 5) + 5) % 5];
      r.clawd.setMood({ ...MOODS.focused, open: 1.2, squint: 0.2 }, f.t, { x: tx, y: 1 });
      r.clawd.setPose(pose({ armL: 0.3, armR: 0.3, lean: tx * -0.04 }));
      const k = easeInOutCubic(unlerp(f.t, C.m3, C.m4));
      r.aim(lerp(-0.6, -0.3, k), lerp(1.75, 1.9, k), lerp(9.4, 8.6, k), lerp(-0.5, -0.3, k), lerp(3.35, 3.45, k), BACK_Z);
    };
  }, { nocPPU: 180 });

  // M4 "I learned the range": one graph full screen; its bounds widen and widen, the normal band too.
  const rangeSteps = [W(32, 0), W(32, 1), W(32, 3), 85.79];
  const rangeAt = (t: number) => rangeSteps.reduce((a, s) => a + easeOutBack(unlerp(t, s, s + 0.2)), 0);
  const m4 = insertShot('v2-range', C.m4, C.m5, (c, f, Wd, Hd) => {
    const steps = rangeAt(f.t), b = Math.pow(10, steps * 0.75);
    drawGraph(c, Wd, Hd, f.t, { seed: 21, color: '#5fd0ff', title: 'error rate', bounds: b, trend: 0.9 });
    // the "normal" band grows to swallow more and more of the chart
    const x0 = Wd * 0.1, x1 = Wd * 0.96, y0 = Hd * 0.88, y1 = Hd * 0.2;
    const top = lerp(y0, y1, clamp(0.25 + steps * 0.17));
    c.fillStyle = 'rgba(92,209,122,0.16)'; c.fillRect(x0, top, x1 - x0, y0 - top);
    c.strokeStyle = 'rgba(92,209,122,0.8)'; c.setLineDash([Hd * 0.02, Hd * 0.015]); c.lineWidth = Hd * 0.006;
    c.beginPath(); c.moveTo(x0, top); c.lineTo(x1, top); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#7be08d'; c.font = `800 ${Hd * 0.04}px ${MONO}`; c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText('normal', x1 - Wd * 0.01, top - Hd * 0.008);
  }, f => {
    const k = easeInOutCubic(unlerp(f.t, C.m4, C.m5));
    return { zoom: lerp(0.86, 0.9, k), x: 0, y: 0, tilt: 0 };
  });

  // M5-M8: a storm of warning pop-ups around him. He fixes the red ones with a tap, swipes the
  // rest away unread, and flicks the last, a tiny red "!", into a corner, where it keeps blinking.
  const popTimes = [86.25, 86.4, 86.55, 86.7, 86.84, 86.99, 87.13, 87.27];
  const POPS = popTimes.map((t, i) => ({
    t, x: [-3.0, 0.15, -2.4, -0.6, -3.3, 0.55, -1.75, -1.0][i], y: [3.4, 3.3, 2.5, 3.85, 2.25, 2.4, 3.95, 2.85][i], z: 0.75 + i * 0.03,
    w: 0.85 + hash(i, 101) * 0.25, rot: (hash(i, 102) - 0.5) * 0.18,
  }));
  const FAIL: Record<number, number> = { 1: 87.67, 4: 87.99, 6: 88.28 }; // fixed (tapped) at these times
  const failStart = (i: number) => 87.4 + (i % 3) * 0.08;
  const SWIPE: Record<number, [number, number]> = { 0: [88.57, -1], 2: [88.87, -1], 3: [89.16, 1], 5: [89.45, 1], 7: [89.6, -1] };
  const tAlert = W(36, 0) + 0.05, tFlick = W(36, 2), tLand = tFlick + 0.65;
  const alertRest = new THREE.Vector3(PEDESTAL.x - 0.95, 0.17, PEDESTAL.z + 0.9);
  function stormSetup(cam: (r: ServerRoom, f: Frame) => void) {
    return (r: ServerRoom) => {
      const pops = POPS.map((p, i) => {
        const g = new THREE.Group();
        const warn = popup('warn', i, p.w), fail = popup('fail', i, p.w), fixed = popup('fixed', i, p.w);
        g.add(warn, fail, fixed);
        r.scene.add(g);
        const sp = sparkles(5, 0.6, '#7be08d', 110 + i);
        r.scene.add(sp.group);
        const lines = speedLines(5, 1.2, 120 + i);
        g.add(lines.group);
        return { g, warn, fail, fixed, sp, lines };
      });
      const alert = tinyAlert(0.17);
      r.scene.add(alert);
      const trail = speedLines(5, 1.0, 131);
      r.scene.add(trail.group);
      return (f: Frame) => {
        let reach: THREE.Vector3 | null = null, reachK = 0;
        pops.forEach((o, i) => {
          const p = POPS[i];
          const appear = easeOutBack(unlerp(f.t, p.t, p.t + 0.18));
          const fixAt = FAIL[i], sw = SWIPE[i];
          const failing = fixAt !== undefined && f.t >= failStart(i);
          const fixed = fixAt !== undefined && f.t >= fixAt;
          const gone = fixed ? unlerp(f.t, fixAt + 0.2, fixAt + 0.35) : 0;
          const swipeK = sw ? easeInCubic(unlerp(f.t, sw[0], sw[0] + 0.25)) : 0;
          o.g.visible = appear > 0.001 && gone < 1 && swipeK < 1;
          o.warn.visible = !failing; o.fail.visible = failing && !fixed; o.fixed.visible = fixed;
          const shake = failing && !fixed ? Math.sin(f.t * 50) * 0.02 : 0;
          o.g.position.set(p.x + shake + (sw ? sw[1] * swipeK * 6 : 0), p.y + (sw ? swipeK * 0.4 : 0), p.z);
          o.g.rotation.z = p.rot + (sw ? sw[1] * -swipeK * 0.6 : 0);
          o.g.scale.setScalar(Math.max(0.001, appear * (1 - easeInCubic(gone)) + (fixed ? decay(f.t - fixAt, 0.08) * 0.15 : 0)));
          o.lines.group.position.set(-(sw ? sw[1] : 1) * 0.3, 0, -0.01);
          o.lines.update(sw ? Math.sin(Math.min(1, swipeK) * Math.PI) : 0, sw ? sw[1] : 1, f.t);
          o.sp.group.position.set(p.x, p.y, p.z + 0.05);
          o.sp.update(fixed ? f.t - fixAt - 0.2 : -1, 0.4);
          if (fixAt !== undefined && Math.abs(f.t - fixAt) < 0.18) { reach = new THREE.Vector3(p.x, p.y, p.z); reachK = 1 - Math.abs(f.t - fixAt) / 0.18; }
          if (sw && Math.abs(f.t - sw[0] - 0.05) < 0.15) { reach = new THREE.Vector3(p.x, p.y, p.z); reachK = 1 - Math.abs(f.t - sw[0] - 0.05) / 0.15; }
        });
        // the tiny "!": pops up by his head, gets flicked, lands by the pedestal, blinks on and on
        const head = new THREE.Vector3(CONSOLE.clawdX + 0.85, DESK_Y + 1.35, 0.8);
        const ak = easeOutBack(unlerp(f.t, tAlert, tAlert + 0.2));
        alert.visible = ak > 0.001;
        const fk = unlerp(f.t, tFlick, tLand);
        if (f.t < tFlick) alert.position.copy(head).add(v3.set(0, Math.sin(f.t * 5) * 0.04, 0));
        else if (f.t < tLand) {
          alert.position.lerpVectors(head, alertRest, fk).add(v3.set(0, Math.sin(fk * Math.PI) * 1.6, 0));
        } else {
          const bt = f.t - tLand;
          alert.position.copy(alertRest).add(v3.set(Math.min(bt, 0.4) * 0.3, Math.abs(Math.sin(bt * 12)) * 0.25 * decay(bt, 0.15), 0));
        }
        alert.scale.setScalar(Math.max(0.001, ak));
        alert.rotation.z = f.t > tFlick && f.t < tLand + 0.4 ? -(f.t - tFlick) * 14 * decay(f.t - tLand, 0.1) : 0;
        alert.blink(f.t < tLand ? 1 : Math.floor((f.t - tLand) * 2.4) % 2 ? 0.15 : 1);
        trail.group.position.copy(alert.position).add(v3.set(-0.4, 0, -0.02));
        trail.update(fk > 0 && fk < 1 ? 0.8 : 0, 1, f.t);
        // Clawd: eyes darting, then tapping, then swiping with his eyes shut, then the flick
        const swiping = f.t >= 88.5 && f.t < tAlert;
        const flickK = f.t > tFlick - 0.12 && f.t < tFlick + 0.15 ? 1 - Math.abs(f.t - tFlick + 0.02) / 0.14 : 0;
        const latest = POPS.filter(p => p.t <= f.t).slice(-1)[0];
        const look = reach ? { x: clamp(((reach as THREE.Vector3).x - CONSOLE.clawdX) / 1.5, -1, 1), y: clamp(((reach as THREE.Vector3).y - 2.6) / 0.8, -1, 1) }
          : f.t > tAlert && f.t < tFlick + 0.1 ? { x: 1, y: 0.6 } : latest ? { x: clamp((latest.x - CONSOLE.clawdX) / 1.5, -1, 1), y: clamp((latest.y - 2.6) / 0.8, -1, 1) } : { x: 0, y: 0.5 };
        const after = f.t > tFlick + 0.2;
        r.clawd.setMood(swiping || after ? { ...MOODS.excited, blush: 0.3 } : f.t > 87.35 ? { ...MOODS.focused, sweat: 0.3 } : { ...MOODS.focused, open: 1.2, sweat: 0.2 }, f.t, look);
        const left = reach !== null && (reach as THREE.Vector3).x < CONSOLE.clawdX;
        r.clawd.setPose(pose({
          armR: after ? 0.25 + Math.max(0, Math.sin(f.t * 30)) * 0.5 : (!left ? 0.4 + reachK * 1.8 : 0.4) + flickK * 2.0,
          armL: after ? 0.25 + Math.max(0, Math.sin(f.t * 30 + Math.PI)) * 0.5 : left ? 0.4 + reachK * 1.8 : 0.4,
          lean: reach ? (left ? 0.15 : -0.15) * reachK : -flickK * 0.12,
          bounce: reachK * 0.25, squash: after ? 0.05 : 0,
        }));
        cam(r, f);
      };
    };
  }
  const m5 = roomShot('v2-mattered', C.m5, C.m6, stormSetup((r, f) => {
    const k = easeInOutCubic(unlerp(f.t, C.m5, C.m6)), wb = wobble(f.t, 0.03, 51);
    r.aim(lerp(-1.0, -1.15, k) + wb.x, 3.0 + wb.y, lerp(7.4, 6.8, k), -1.4, 2.95, 0.4);
  }), { nocPPU: 120 });
  const m6 = roomShot('v2-failed', C.m6, C.m7, stormSetup((r, f) => {
    const k = easeInOutCubic(unlerp(f.t, C.m6, C.m7)), wb = wobble(f.t, 0.04, 52);
    r.aim(lerp(-0.4, -0.6, k) + wb.x, 2.9 + wb.y, lerp(6.0, 5.6, k), -1.3, 2.95, 0.4);
  }), { nocPPU: 120 });
  const m7 = roomShot('v2-warnings', C.m7, C.m8, stormSetup((r, f) => {
    const k = easeInOutCubic(unlerp(f.t, C.m7, C.m8)), wb = wobble(f.t, 0.03, 53);
    r.aim(lerp(-2.0, -1.7, k) + wb.x, 2.8 + wb.y, lerp(6.4, 6.6, k), -1.35, 2.85, 0.4);
  }), { nocPPU: 120 });
  const m8 = roomShot('v2-ignored', C.m8, C.end, stormSetup((r, f) => {
    // follow the flicked alert to the corner, then hold and creep in on it
    const k = easeInOutCubic(unlerp(f.t, tFlick + 0.05, tLand + 0.5));
    const creep = smooth(unlerp(f.t, tLand + 0.5, C.end)) * 1.6;
    const wb = wobble(f.t, 0.02 * (1 - k), 54);
    r.aim(lerp(-1.6, 1.4, k) + wb.x, lerp(2.8, 0.75, k) + wb.y, lerp(6.4, 5.8, k) - creep, lerp(-1.3, alertRest.x - 0.3, k), lerp(2.85, 0.32, k), lerp(0.4, alertRest.z, k));
  }), { nocPPU: 120, tint: f => '#' + new THREE.Color('#ffffff').lerp(new THREE.Color('#b9c1e6'), smooth(unlerp(f.t, 93.6, 94.4))).getHexString() });

  return [v1, v2, v3s, v4, v5, v6, v7, v8, m1, m2, m3, m4, m5, m6, m7, m8];
}

// ---------------------------------------------------------------------------------------------
// The apartment block for V7

function apartments(lyrics: LyricsData) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#141a33');
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const L = lyrics.lines[26];
  const word = (i: number) => L.words[i].start;
  // sky: stars, moon, neighbouring blocks
  const sky = staticPlane(60, 30, 20, (c, Wd, Hd) => {
    const g = c.createLinearGradient(0, 0, 0, Hd); g.addColorStop(0, '#0d1230'); g.addColorStop(1, '#2a3566');
    c.fillStyle = g; c.fillRect(0, 0, Wd, Hd);
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,240,${0.4 + hash(i, 201) * 0.6})`; const s = 1 + hash(i, 202) * 2; c.fillRect(hash(i, 203) * Wd, hash(i, 204) * Hd * 0.7, s, s); }
  });
  sky.position.set(0, 6, -12);
  scene.add(sky);
  const moon = inkedCircle(1.3, '#f6efd2', 0.06);
  moon.position.set(9.5, 11.5, -11);
  for (const [x, y, r] of [[-0.4, 0.3, 0.25], [0.45, -0.2, 0.18], [0.1, -0.6, 0.12]]) { const cr = shapeMesh(new THREE.Shape().absarc(0, 0, r, 0, Math.PI * 2, false), '#e3d9b5', 0.004); cr.position.set(x, y, 0); moon.add(cr); }
  scene.add(moon);
  for (let b = 0; b < 8; b++) {
    const bw = 3 + hash(b, 211) * 3, bh = 5 + hash(b, 212) * 8, bx = (b < 4 ? -1 : 1) * (8.5 + (b % 4) * 3.6);
    const bl = staticPlane(bw, bh, 20, (c, Wd, Hd) => {
      c.fillStyle = '#232b52'; c.fillRect(0, 0, Wd, Hd);
      for (let i = 0; i < Wd / 14; i++) for (let j = 0; j < Hd / 18; j++) { if (hash(b, i, j, 213) > 0.25) continue; c.fillStyle = '#ffd98a'; c.fillRect(i * 14 + 4, j * 18 + 5, 7, 9); }
    });
    bl.position.set(bx, bh / 2 - 1, -8 - (b % 3));
    scene.add(bl);
  }
  // the block: three floors of three rooms
  const RW = 3.4, RH = 2.6, T = 0.25;
  const BW = RW * 3 + T * 4, BH = RH * 3 + T * 4;
  scene.add(Object.assign(inkedRect(BW, BH, 0.04, '#4a4f6e', 0.08), {}));
  scene.children[scene.children.length - 1].position.set(0, BH / 2, -0.1);
  const roof = inkedRect(BW + 0.6, 0.4, 0.04, '#3a3f5c', 0.07); roof.position.set(0, BH + 0.2, 0); scene.add(roof);
  const ground = shapeMesh(roundedRectShape(80, 3, 0, 0, -1.5), '#1a2040', 0.2); scene.add(ground);
  const order = [0, 8, 4, 2, 6, 1, 7, 3, 5];
  const offAt = (k: number) => [77.05, 77.3, 77.55, 77.8, 78.05, 78.0, 78.45, 78.75, 78.85][order.indexOf(k)];
  const SHEETS = ['#9fc7f2', '#f2a09a', '#8fd6a0', '#ffd166', '#c9a7eb', '#86c5c9', '#f2a6b4', '#e8a07a', '#9fd0a8'];
  const rooms = Array.from({ length: 9 }, (_, k) => {
    const col = k % 3, row = 2 - Math.floor(k / 3);
    const cx = -BW / 2 + T + RW / 2 + col * (RW + T), cy = T + RH / 2 + row * (RH + T);
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    const wallMat = ownMat('#f0cf96');
    g.add(shapeMesh(roundedRectShape(RW, RH, 0), wallMat, 0));
    const floorStrip = shapeMesh(roundedRectShape(RW, 0.25, 0, 0, -RH / 2 + 0.125), '#8a6a4f', 0.002); g.add(floorStrip);
    // picture on the wall
    const pic = inkedRect(0.6, 0.45, 0.02, pickC(['#cfe9f2', '#f6d9b9', '#d8ecd0'], k), 0.04); pic.position.set(0.2, 0.6, 0.004); g.add(pic);
    // bed, side on: head at the left
    const flip = k % 2 ? -1 : 1;
    const bed = new THREE.Group(); bed.scale.x = flip;
    const head = inkedRect(0.16, 1.0, 0.03, '#8a6a4f', 0.04); head.position.set(-1.1, -0.65, 0.01);
    const foot = inkedRect(0.14, 0.6, 0.03, '#8a6a4f', 0.04); foot.position.set(1.1, -0.85, 0.01);
    const mattress = inkedRect(2.1, 0.3, 0.05, '#ffffff', 0.04); mattress.position.set(0, -0.85, 0.012);
    const pillow = inkedRect(0.5, 0.24, 0.1, '#ffffff', 0.035); pillow.position.set(-0.75, -0.6, 0.02);
    const sleeper = new THREE.Group();
    const shirt = SHEETS[(k + 3) % 9];
    const headC = inkedCircle(0.22, shirt, 0.04); headC.position.set(-0.6, -0.42, 0.03);
    const hair = shapeMesh(new THREE.Shape().absarc(0, 0, 0.25, Math.PI * 0.55, Math.PI * 1.45, false), pickC(['#4a3426', '#2b1d16', '#c9853d', '#8a5a3a'], k), 0.035);
    hair.position.copy(headC.position);
    sleeper.add(headC, hair);
    const blanket = new THREE.Group();
    blanket.add(inkedRect(1.75, 0.38, 0.16, SHEETS[k], 0.045));
    blanket.position.set(0.25, -0.55, 0.04);
    bed.add(head, foot, mattress, pillow, sleeper, blanket);
    bed.position.set(-0.25 * flip, 0, 0);
    g.add(bed);
    // nightstand, lamp and phone
    const ns = inkedRect(0.5, 0.5, 0.03, '#b98a62', 0.04); ns.position.set(1.35 * flip, -1.0, 0.01); g.add(ns);
    const lampShade = inkedRect(0.36, 0.26, 0.05, '#f7e2b0', 0.035); lampShade.position.set(1.35 * flip, -0.48, 0.015); g.add(lampShade);
    const lampGlow = glow(0.9, '#ffe9a8', 0.35); lampGlow.position.set(1.35 * flip, -0.5, 0.006); g.add(lampGlow);
    const phone = inkedRect(0.14, 0.06, 0.02, '#20263b', 0.025); phone.position.set(1.25 * flip, -0.72, 0.016); g.add(phone);
    const dark = shapeMesh(roundedRectShape(RW, RH, 0), ownMat('#0d1128', 0, true), 0.05); g.add(dark);
    scene.add(g);
    return { g, wallMat, dark, lampGlow, sleeper, blanket, at: offAt(k), k };
  });
  // speech bubbles: "Don't wake us up," from the top middle room; "just fix yourself" from the right
  function bubble(words: number[], w: number, tailX: number) {
    const g = new THREE.Group();
    g.add(inkedRect(w, 1.3, 0.6, '#ffffff', 0.08));
    const tail = new THREE.Shape(); tail.moveTo(tailX - 0.3, -0.55); tail.lineTo(tailX + 0.2, -0.55); tail.lineTo(tailX - 0.25, -1.25); tail.closePath();
    const tailInk = new THREE.Shape(); tailInk.moveTo(tailX - 0.42, -0.5); tailInk.lineTo(tailX + 0.32, -0.5); tailInk.lineTo(tailX - 0.3, -1.38); tailInk.closePath();
    g.add(shapeMesh(tailInk, INK, -0.002), shapeMesh(tail, '#ffffff', 0.004));
    const text = canvasPlane<Frame>(w - 0.3, 1.0, 160, (c, f, Wd, Hd) => {
      c.font = `italic 800 ${Hd * 0.5}px ${FONT}`; c.fillStyle = INK; c.textBaseline = 'middle'; c.textAlign = 'left';
      const shown = words.filter(i => f.t >= L.words[i].start).map(i => L.words[i].w.replace(/[“”"]/g, ''));
      const full = words.map(i => L.words[i].w.replace(/[“”"]/g, '')).join(' ');
      const tw = c.measureText(full).width;
      c.fillText(shown.join(' '), (Wd - tw) / 2, Hd * 0.52);
    });
    text.mesh.position.z = 0.01;
    g.add(text.mesh);
    scene.add(g);
    return { g, text };
  }
  const b1 = bubble([0, 1, 2, 3], 5.6, -0.4);
  b1.g.position.set(0.3, BH + 0.95, 0.5);
  const b2 = bubble([4, 5, 6], 5.0, -1.6);
  b2.g.position.set(BW / 2 + 1.0, T + RH * 1.5 + T + 1.75, 0.5);
  // zzz
  const zs = rooms.map(rm => {
    const g = new THREE.Group();
    const letters = [0, 1, 2].map(i => { const z = staticPlane(0.4, 0.4, 160, (c, Wd, Hd) => { c.font = `900 ${Hd * 0.8}px ${FONT}`; c.fillStyle = '#e6ecff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', Wd / 2, Hd / 2); }); g.add(z); return z; });
    g.position.set(rm.g.position.x - 0.4, rm.g.position.y - 0.2, 0.2);
    scene.add(g);
    return { g, letters };
  });
  return {
    scene, camera,
    update(f: Frame) {
      for (const rm of rooms) {
        const off = smooth(unlerp(f.t, rm.at, rm.at + 0.12));
        (rm.dark.material as THREE.MeshBasicMaterial).opacity = off * 0.82;
        rm.dark.visible = off > 0.01;
        (rm.lampGlow.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - off);
        rm.blanket.scale.y = 1 + Math.sin(f.t * 2.2 + rm.k) * 0.05;
        const talking = (rm.k === 1 && f.t > word(0) - 0.1 && f.t < word(3) + 0.5) || (rm.k === 5 && f.t > word(4) - 0.1 && f.t < word(6) + 0.6);
        rm.sleeper.position.y = talking ? 0.04 + Math.sin(f.t * 14) * 0.015 : 0;
      }
      zs.forEach((z, i) => {
        const rm = rooms[i];
        z.letters.forEach((l, j) => {
          const k = ((f.t - rm.at) * 0.8 + j / 3) % 1;
          l.visible = f.t > rm.at + 0.15;
          l.position.set(k * 0.6 + j * 0.05, k * 1.0, 0);
          l.scale.setScalar(0.5 + k * 0.6);
          (l.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI);
        });
      });
      const in1 = easeOutBack(unlerp(f.t, word(0) - 0.15, word(0) + 0.1)), out1 = unlerp(f.t, 78.15, 78.35);
      b1.g.visible = in1 > 0.001 && out1 < 1;
      b1.g.scale.setScalar(Math.max(0.001, in1 * (1 - out1)));
      b1.text.update(f);
      const in2 = easeOutBack(unlerp(f.t, word(4) - 0.15, word(4) + 0.1)), out2 = unlerp(f.t, 78.95, 79.15);
      b2.g.visible = in2 > 0.001 && out2 < 1;
      b2.g.scale.setScalar(Math.max(0.001, in2 * (1 - out2)));
      b2.text.update(f);
      const k = easeInOutCubic(unlerp(f.t, 76.28, 79.2));
      camera.position.set(lerp(1.4, 0.9, k), lerp(5.55, 5.4, k), lerp(21.5, 19.8, k));
      camera.lookAt(lerp(1.2, 0.9, k), lerp(5.55, 5.4, k), 0);
    },
  };
}

const pickC = <T,>(xs: T[], k: number) => xs[k % xs.length];

// ---------------------------------------------------------------------------------------------
// Little painters and helpers

function ringShape(r: number, t: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, r + t / 2, 0, Math.PI * 2, false);
  s.holes.push(new THREE.Path().absarc(0, 0, r - t / 2, 0, Math.PI * 2, true));
  return s;
}

function starPath(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = r * 0.12; c.stroke();
}

/** Build -> Test -> Review -> Deploy. Review is skipped with a hop; deploy launches a rocket icon. */
function drawPipeline(c: CanvasRenderingContext2D, t: number, W: number, H: number, tSkip: number, tPress: number, tRocket: number) {
  screenFrame(c, W, H, 'pipeline: help-api', '#ffd166');
  const names = ['BUILD', 'TEST', 'REVIEW', 'DEPLOY'];
  const bw = W * 0.2, bh = H * 0.22, y = H * 0.62, gap = (W - bw * 4) / 5;
  const bx = (i: number) => gap + i * (bw + gap);
  names.forEach((n, i) => {
    let fill = '#2f9e5b', label = '✓';
    if (i === 2) { fill = t >= tSkip ? '#3a405a' : '#4a5170'; label = t >= tSkip ? 'skip' : 'zzz'; }
    if (i === 3) { fill = t >= tRocket ? '#2f9e5b' : t >= tPress ? '#e08a3a' : '#4a5170'; label = t >= tRocket ? '✓' : t >= tPress ? '...' : ''; }
    c.fillStyle = fill; c.beginPath(); c.roundRect(bx(i), y - bh / 2, bw, bh, H * 0.03); c.fill();
    c.fillStyle = '#ffffff'; c.font = `800 ${H * 0.065}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(n, bx(i) + bw / 2, y - bh * 0.18);
    c.font = `900 ${H * 0.07}px ${FONT}`; c.fillText(label, bx(i) + bw / 2, y + bh * 0.22);
    if (i === 2 && t >= tSkip) { c.strokeStyle = '#e6e9f5'; c.lineWidth = H * 0.012; c.beginPath(); c.moveTo(bx(i) + bw * 0.1, y); c.lineTo(bx(i) + bw * 0.9, y); c.stroke(); }
    if (i < 3) { c.fillStyle = '#9aa6c8'; c.beginPath(); const ax = bx(i) + bw + gap * 0.25; c.moveTo(ax, y - H * 0.025); c.lineTo(ax + gap * 0.5, y); c.lineTo(ax, y + H * 0.025); c.fill(); }
  });
  // the hop over REVIEW
  const hk = easeOutCubic(unlerp(t, tSkip, tSkip + 0.3));
  if (hk > 0) {
    const x0 = bx(1) + bw * 0.5, x1 = bx(3) + bw * 0.5, top = y - bh / 2 - H * 0.2;
    c.strokeStyle = '#ffd166'; c.lineWidth = H * 0.02; c.setLineDash([H * 0.03, H * 0.02]);
    c.beginPath();
    for (let i = 0; i <= 30 * hk; i++) { const u = i / 30, x = lerp(x0, x1, u), yy = y - bh / 2 - Math.sin(u * Math.PI) * (y - bh / 2 - top); i ? c.lineTo(x, yy) : c.moveTo(x, yy); }
    c.stroke(); c.setLineDash([]);
  }
  // rocket
  const rk = unlerp(t, tRocket, tRocket + 0.6);
  if (rk > 0 && rk < 1) {
    const rx = bx(3) + bw / 2, ry = lerp(y - bh / 2, -H * 0.2, easeInCubic(rk));
    c.fillStyle = 'rgba(255,170,90,0.6)';
    c.beginPath(); c.moveTo(rx - W * 0.012, ry + H * 0.08); c.lineTo(rx + W * 0.012, ry + H * 0.08); c.lineTo(rx, ry + H * 0.08 + H * 0.35 * Math.min(1, rk * 3)); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(rx, ry - H * 0.06); c.quadraticCurveTo(rx + W * 0.025, ry, rx + W * 0.018, ry + H * 0.08); c.lineTo(rx - W * 0.018, ry + H * 0.08); c.quadraticCurveTo(rx - W * 0.025, ry, rx, ry - H * 0.06); c.fill();
    c.fillStyle = '#e0453a'; c.beginPath(); c.arc(rx, ry + H * 0.01, W * 0.007, 0, Math.PI * 2); c.fill();
  }
}

/** Two git branches zipped into one by a zipper slider; the merge commit pops at the end. */
function drawZipper(c: CanvasRenderingContext2D, t: number, W: number, H: number, t0: number, t1: number) {
  c.fillStyle = SCREEN_BG; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(95,208,255,0.06)';
  for (let x = 0; x < W; x += H * 0.08) for (let y = 0; y < H; y += H * 0.08) c.fillRect(x, y, 2, 2);
  const y0 = H * 0.5, xf = W * 0.16, xm = W * 0.78, spread = H * 0.2;
  const k = easeInOutCubic(unlerp(t, t0, t1)), sx = lerp(xf, xm, k);
  const yAt = (x: number, side: number) => {
    if (x <= xf) return side < 0 ? y0 : NaN;
    if (x <= sx) return y0 + side * H * 0.012;
    const u = (x - sx) / Math.max(1, xm - sx);
    return y0 + side * spread * Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.6;
  };
  const lw = H * 0.04;
  // main (orange) and feature (blue)
  for (const [side, col] of [[1, '#5fb8ff'], [-1, '#ff9a5a']] as const) {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); let started = false;
    for (let x = side < 0 ? W * 0.04 : xf; x <= xm + 1; x += W * 0.005) { const y = yAt(x, side); if (isNaN(y)) continue; started ? c.lineTo(x, y) : c.moveTo(x, y); started = true; }
    c.stroke();
  }
  // zipper teeth along the closed part
  c.fillStyle = '#c9ced6';
  for (let x = xf + H * 0.02; x < sx; x += H * 0.035) c.fillRect(x, y0 - H * 0.016, H * 0.018, H * 0.032);
  // after the merge, one line runs on
  const tail = easeOutCubic(unlerp(t, t1, t1 + 0.4));
  if (tail > 0) { c.strokeStyle = '#ff9a5a'; c.lineWidth = lw * 1.3; c.beginPath(); c.moveTo(xm, y0); c.lineTo(lerp(xm, W * 0.96, tail), y0); c.stroke(); }
  // commits
  const dot = (x: number, y: number, col: string, r = H * 0.028) => { c.fillStyle = col; c.strokeStyle = '#0f1424'; c.lineWidth = H * 0.008; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke(); };
  dot(W * 0.06, y0, '#ff9a5a'); dot(xf, y0, '#ff9a5a');
  for (const u of [0.3, 0.55, 0.75]) { const x = lerp(xf, xm, u); if (x > sx + H * 0.03) { dot(x, yAt(x, 1), '#5fb8ff'); dot(x, yAt(x, -1), '#ff9a5a'); } }
  // the slider
  if (k < 1) {
    c.fillStyle = '#e6e9f5'; c.strokeStyle = INK; c.lineWidth = H * 0.008;
    c.beginPath(); c.roundRect(sx - H * 0.035, y0 - H * 0.05, H * 0.07, H * 0.1, H * 0.02); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(sx - H * 0.018, y0 + H * 0.04, H * 0.036, H * 0.09, H * 0.015); c.fill(); c.stroke();
  }
  // merge commit
  const mk = t >= t1 ? easeOutBack(unlerp(t, t1, t1 + 0.2)) : 0;
  if (mk > 0) {
    c.strokeStyle = `rgba(255,214,102,${clamp(1 - (t - t1) / 0.5)})`; c.lineWidth = H * 0.01;
    c.beginPath(); c.arc(xm, y0, H * (0.05 + (t - t1) * 0.25), 0, Math.PI * 2); c.stroke();
    dot(xm, y0, '#ffd166', H * 0.045 * mk);
    c.fillStyle = DONE_GREEN; c.beginPath(); c.roundRect(xm - W * 0.07, y0 - H * 0.2, W * 0.14, H * 0.085, H * 0.04); c.fill();
    c.fillStyle = '#ffffff'; c.font = `800 ${H * 0.05}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('merged ✓', xm, y0 - H * 0.155);
  }
  c.fillStyle = '#9aa6c8'; c.font = `700 ${H * 0.035}px ${MONO}`; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText('main', W * 0.04, y0 + H * 0.06);
  if (k < 0.9) c.fillText('fix/patch', lerp(xf, xm, 0.3), y0 - spread - H * 0.05);
}

// maze: cells hold wall bits 1 N, 2 E, 4 S, 8 W
function buildMaze(w: number, h: number, seed: number) {
  const cells = new Array(w * h).fill(15), seen = new Array(w * h).fill(false);
  const stack = [[0, 0]];
  seen[0] = true;
  let step = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]].filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
    });
    if (!dirs.length) { stack.pop(); continue; }
    const [dx, dy, wb, ob] = dirs[Math.floor(hash(seed, step++) * dirs.length)];
    const nx = x + dx, ny = y + dy;
    cells[y * w + x] &= ~wb; cells[ny * w + nx] &= ~ob;
    seen[ny * w + nx] = true;
    stack.push([nx, ny]);
  }
  return cells;
}
function bfs(cells: number[], w: number, h: number, s: readonly [number, number]) {
  const d = new Array(w * h).fill(-1);
  d[s[1] * w + s[0]] = 0;
  const q = [s];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy, b] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]) {
      if (cells[y * w + x] & b) continue;
      const nx = x + dx, ny = y + dy, i = ny * w + nx;
      if (d[i] >= 0) continue;
      d[i] = d[y * w + x] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}
function tracePath(d: number[], cells: number[], w: number, _h: number, e: readonly [number, number]) {
  const out: [number, number][] = [[e[0], e[1]]];
  let [x, y] = e;
  while (d[y * w + x] > 0) {
    for (const [dx, dy, b] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]) {
      if (cells[y * w + x] & b) continue;
      const nx = x + dx, ny = y + dy;
      if (d[ny * w + nx] === d[y * w + x] - 1) { x = nx; y = ny; out.push([x, y]); break; }
    }
  }
  return out.reverse();
}
