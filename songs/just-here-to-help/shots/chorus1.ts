// Pre-chorus and chorus 1 (0:30 to the start of verse 2): the open office, warm daylight turning
// to sunset. Storyboard rows 9 to 20. Clawd climbs out of the hero monitor, gets his HELPER tag,
// squashes his first bug, then works the office: a stamping conveyor, a wiped page, a block wall
// he fills himself, and a queue of people loading him with boxes. Night falls at the end.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot, type ShotWorld } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, REST, mixMood, type Mood, type Pose } from '../../../engine/characters/clawd';
import { INK, canvasPlane, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh } from '../../../engine/flat';
import { hash, noise1 } from '../../../engine/rng';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutBounce, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import { DAY_LYRICS, FLAT_POST, FONT, beatHop } from '../world';
import { DESK_Y, HERO, buildOffice, officeTint, type OfficeSet } from '../office';
import {
  DONE_GREEN, STAND, blob, cardboardBox, confetti, doneMark, pointerHand, questionBalloon, rubberStamp,
  pawAt, sparkles, speedLines, standingPerson, wobble,
} from '../props';

type Update = (f: Frame) => void;
interface Extra { overlay?: ShotWorld['overlay']; lyrics?: boolean; tagged?: boolean; tint?: (f: Frame) => string }

function officeShot(id: string, start: number, end: number, setup: (s: OfficeSet) => Update, extra: Extra = {}): Shot {
  return defineShot({
    id, start, end,
    build() {
      const s = buildOffice({ tagged: extra.tagged ?? true });
      const update = setup(s);
      return {
        scene: s.scene, camera: s.camera,
        update(f) { s.reset(f); update(f); },
        overlay: extra.overlay,
        post: f => ({ ...FLAT_POST, tint: extra.tint ? extra.tint(f) : officeTint(f.t) }),
        lyrics: extra.lyrics,
        lyricStyle: DAY_LYRICS,
      };
    },
  });
}

const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const BALLOON_COLS = ['#f2a09a', '#9fc7f2', '#8fd6a0', '#ffd166', '#c9a7eb', '#ff8fa3'];
const v3 = new THREE.Vector3();

/** A little cartoon beetle: the software bug. Origin under its belly; faces +x. */
function bug() {
  const g = new THREE.Group();
  const legs = Array.from({ length: 6 }, (_, i) => {
    const l = shapeMesh(roundedRectShape(0.03, 0.16, 0.015, 0, -0.06), INK, 0);
    l.position.set(-0.12 + (i % 3) * 0.12, 0.15, i < 3 ? -0.01 : 0.01);
    g.add(l);
    return l;
  });
  const body = new THREE.Group();
  const shell = inkedCircle(0.17, '#7b4fa0', 0.035);
  shell.scale.set(1.25, 0.85, 1);
  shell.position.y = 0.2;
  const head = inkedCircle(0.08, '#3d2a52', 0.03);
  head.position.set(0.22, 0.19, -0.005);
  const seam = shapeMesh(roundedRectShape(0.02, 0.26, 0.01), INK, 0.01);
  seam.position.set(-0.02, 0.22, 0.006);
  seam.rotation.z = 0.15;
  const eyes = [0.02, -0.02].map((dy, i) => { const e = inkedCircle(0.022, '#ffffff', 0.012); e.position.set(0.25 + i * 0.03, 0.22 + dy, 0.01); return e; });
  const ant = [0, 1].map(i => { const a = shapeMesh(roundedRectShape(0.02, 0.14, 0.01, 0, 0.07), INK, -0.004); a.position.set(0.24, 0.25, 0); a.rotation.z = -0.5 - i * 0.4; return a; });
  for (let k = 0; k < 3; k++) { const dot = inkedCircle(0.025, '#c79ff0', 0.01); dot.position.set(-0.1 + k * 0.08, 0.25 - (k % 2) * 0.06, 0.008); body.add(dot); }
  body.add(shell, head, seam, ...eyes, ...ant);
  g.add(body);
  return Object.assign(g, {
    /** walk phase (cycles) drives the legs; scared lifts the body and shivers. */
    animate(phase: number, scared: number, t: number) {
      legs.forEach((l, i) => { l.rotation.z = Math.sin(phase * Math.PI * 2 + (i % 2) * Math.PI) * 0.5; });
      body.position.y = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.02 + scared * 0.05;
      body.position.x = scared * Math.sin(t * 60) * 0.01;
      ant.forEach((a, i) => { a.rotation.z = -0.5 - i * 0.4 + scared * 0.5 + Math.sin(t * 9 + i) * 0.1; });
    },
  });
}

/** An office arm in a sleeve, reaching in from the right, a marker in its fist. Origin at the
 *  fist; the marker's tip sits at MARKER_TIP from it. */
const MARKER_TIP = new THREE.Vector2(-0.5, 0.17);
function reachingArm(color: string) {
  const g = new THREE.Group();
  const sleeve = inkedRect(4.0, 0.36, 0.16, color, 0.06);
  sleeve.position.x = 2.3;
  const cuff = inkedRect(0.2, 0.42, 0.06, '#f4f1ea', 0.05);
  cuff.position.set(0.32, 0, 0.004);
  const hand = blob([
    { w: 0.44, h: 0.36, r: 0.16 },
    { w: 0.14, h: 0.26, r: 0.07, x: -0.14, y: 0.16, rot: 0.7 }, // thumb
  ], color, 0.05);
  hand.position.z = 0.012;
  const marker = new THREE.Group();
  const barrel = inkedRect(0.1, 0.64, 0.03, '#2b2b3a', 0.025); barrel.position.y = 0.36;
  const nib = shapeMesh(roundedRectShape(0.05, 0.08, 0.015, 0, 0.03), '#2b2b3a', 0.002);
  const band = shapeMesh(roundedRectShape(0.1, 0.06, 0), '#e0504a', 0.004); band.position.y = 0.2;
  marker.add(barrel, nib, band);
  marker.position.set(MARKER_TIP.x, MARKER_TIP.y, 0.006);
  marker.rotation.z = -1.92;
  g.add(sleeve, cuff, marker, hand);
  return g;
}

/** A blank HELLO tag; write(f, k) fills in HELPER, left to right, up to fraction k. */
function namingTag(w = 0.46) {
  let k = 0;
  const tag = canvasPlane(w, w * 0.72, 600, (c, _f: Frame, W, H) => {
    c.fillStyle = '#d6453d'; c.strokeStyle = INK; c.lineWidth = H * 0.05;
    c.beginPath(); c.roundRect(H * 0.04, H * 0.04, W - H * 0.08, H - H * 0.08, H * 0.1); c.fill(); c.stroke();
    c.fillStyle = '#ffffff';
    c.fillRect(H * 0.1, H * 0.36, W - H * 0.2, H * 0.52);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${H * 0.2}px ${FONT}`;
    c.fillText('HELLO', W / 2, H * 0.17);
    c.font = `700 ${H * 0.09}px ${FONT}`;
    c.fillText('my name is', W / 2, H * 0.3);
    if (k <= 0) return;
    c.save();
    c.beginPath(); c.rect(0, 0, H * 0.14 + (W - H * 0.28) * k, H); c.clip();
    c.fillStyle = INK; c.font = `italic 900 ${H * 0.3}px ${FONT}`;
    c.fillText('HELPER', W / 2, H * 0.63);
    c.restore();
  });
  return Object.assign(tag, { write(f: Frame, kk: number) { k = kk; tag.update(f); } });
}

export function chorus1Shots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const L = (n: number) => lyrics.lines[n - 1];
  const W = (n: number, i: number) => L(n).words[i].start;
  const beats = audio.beats;
  const beatsIn = (a: number, b: number) => beats.filter(x => x >= a - 1e-6 && x < b - 1e-6);
  const halfBeatsIn = (a: number, b: number) => beats.flatMap((x, i) => (i + 1 < beats.length ? [x, (x + beats[i + 1]) / 2] : [x])).filter(x => x >= a - 1e-6 && x < b - 1e-6);
  const kicks = audio.hits.kick;

  // cut points (on the beat; see the storyboard rows 9-20)
  const C = {
    p1: start, p2: 32.41, p3: 34.19, p4: 36.54, p5: 38.86,
    c1: 41.18, c1b: 42.33, c2: 43.51, c3: 45.86, c4: 48.19, c5: 50.53, c6: 52.88, c7: 54.61, c8: 57.56, c8b: 60.5, end: 62.23,
  };

  // ------------------------------------------------------------------------------------------
  // P1 "Give me a question": out of the monitor into an office full of people. "?" balloons
  // drift up from the desks and Clawd, stepping out of the screen full size, catches them.
  const launch = [0, 1, 2, 3, 4, 5].map(i => W(9, 3) + i * 0.18 + hash(i, 301) * 0.08);
  const catchAt = [31.2, 31.38, 31.58, 31.8, 32.0, 32.2];
  const balloonFrom = [[-5.5, 0], [5.5, 0], [-2.75, -5], [2.75, -5], [-8.25, -5], [0, -10]];
  const tLeap = 30.62, tLand = 31.05;

  /** The bunch of "?" balloons Clawd holds (P1, P2). Returns update(f, caughtOnly). */
  function balloonBunch(s: OfficeSet) {
    const bs = BALLOON_COLS.map((c, i) => {
      const b = questionBalloon(c, 1.0 + hash(i, 311) * 0.3);
      s.scene.add(b);
      return b;
    });
    return (f: Frame, paw: THREE.Vector3, flying: boolean) => {
      bs.forEach((b, i) => {
        const caught = f.t >= catchAt[i];
        const sway = Math.sin(f.t * 2.1 + i * 1.7) * 0.06;
        if (caught) {
          b.visible = true;
          const settle = decay(f.t - catchAt[i], 0.15);
          b.position.copy(paw).add(v3.set(0, 0, 0.05 + i * 0.03)); // 0.03 apart in depth: closer and the outlines flicker
          b.rotation.z = (i - 2.5) * 0.26 + sway + settle * 0.4 * Math.sin((f.t - catchAt[i]) * 20);
          b.scale.setScalar(1);
        } else if (flying && f.t >= launch[i]) {
          b.visible = true;
          const [sx, sz] = balloonFrom[i];
          const k = easeInOutCubic(unlerp(f.t, launch[i], catchAt[i]));
          const from = new THREE.Vector3(sx + HERO.monitorX, 2.6, sz - 0.2);
          b.position.lerpVectors(from, paw, k).add(v3.set(0, Math.sin(k * Math.PI) * 1.4 - (1 - k) * 0.6, 0.05 + i * 0.03));
          b.rotation.z = sway * 2 + (1 - k) * 0.2 * Math.sin(f.t * 3 + i);
          b.scale.setScalar(Math.min(1, easeOutBack(unlerp(f.t, launch[i], launch[i] + 0.3))) + 0.001);
        } else b.visible = false;
      });
    };
  }

  const p1 = officeShot('pc-question', C.p1, C.p2, s => {
    const bunch = balloonBunch(s);
    const pop = sparkles(6, 0.5, '#ffffff', 3);
    // where he breaks out of the screen: two rings spread over the glass and pixels spray out
    const exitAt = new THREE.Vector3(HERO.monitorX - 0.25, HERO.screenY - 0.12, -0.26);
    const rings = [0, 1].map(i => {
      const sh = new THREE.Shape().absarc(0, 0, 0.3, 0, Math.PI * 2, false);
      sh.holes.push(new THREE.Path().absarc(0, 0, 0.25, 0, Math.PI * 2, true));
      const m = shapeMesh(sh, ownMat(i ? '#d97757' : '#ffffff', 1, true), 0, 24);
      m.position.copy(exitAt).add(v3.set(0, 0, 0.01 + i * 0.002));
      return m;
    });
    const pixels = confetti(18, 33, { size: 0.06, speed: 2.4, life: 0.8, spread: Math.PI * 2, gravity: 2, colors: ['#d97757', '#ffffff', '#ffd166', '#9fc7f2'] });
    pixels.group.position.copy(exitAt).add(v3.set(0, 0, 0.05));
    s.scene.add(pop.group, ...rings, pixels.group);
    return f => {
      // camera: from the hero screen straight back to a medium shot of the desk
      const k = easeInOutCubic(unlerp(f.t, C.p1 + 0.05, 31.15));
      const wb = wobble(f.t, 0.04, 1);
      const cx = lerp(HERO.monitorX, -1.25, k), cy = lerp(HERO.screenY, 3.2, k), cz = lerp(-0.28 + 2.55, 9.0, k);
      s.aim(cx + wb.x, cy + wb.y, cz - (f.t - 31.15 > 0 ? (f.t - 31.15) * 0.5 : 0), lerp(HERO.monitorX, -1.25, k), lerp(HERO.screenY, 2.45, k), lerp(-0.28, -3, k));
      rings.forEach((r, i) => {
        const rk = unlerp(f.t, tLeap - 0.02 + i * 0.07, tLeap + 0.45 + i * 0.07);
        r.visible = rk > 0 && rk < 1;
        r.scale.setScalar(0.3 + easeOutCubic(rk) * 2.2);
        (r.material as THREE.MeshBasicMaterial).opacity = 1 - rk;
      });
      pixels.update(f.t - tLeap);
      // Clawd: tiny on the screen, then a leap out to full size onto the desk
      const leap = unlerp(f.t, tLeap, tLand);
      const sc = lerp(0.14, 1, easeInCubic(leap));
      const from = new THREE.Vector3(HERO.monitorX - 0.25, HERO.screenY - 0.24, -0.25);
      const to = new THREE.Vector3(-1.75, DESK_Y, 0.25);
      const hopY = Math.sin(leap * Math.PI) * 0.9;
      s.rig.position.lerpVectors(from, to, easeOutCubic(leap)).add(v3.set(0, hopY, 0));
      s.rig.scale.setScalar(sc);
      s.clawd.root.position.set(0, 0, 0);
      const land = decay(f.t - tLand, 0.1);
      // after landing, hop up to snatch each balloon as it arrives
      const reach = Math.max(0, ...catchAt.map(c => decay(Math.abs(f.t - c) - 0.05, 0.1)));
      const jump = f.t > tLand ? Math.max(0, ...catchAt.map(c => Math.max(0, 1 - Math.abs(f.t - c) / 0.18))) * 0.35 : 0;
      s.clawd.root.position.y = jump;
      s.clawd.setMood(MOODS.excited, f.t);
      const crouch = f.t < tLeap ? smooth(unlerp(f.t, tLeap - 0.3, tLeap - 0.04)) : 0;
      s.clawd.setPose(pose({
        bounce: f.t < tLeap ? beatHop(f.clock, f.t) * 0.4 * (1 - crouch) : 0,
        squash: land * 0.6 - (leap > 0 && leap < 1 ? 0.35 : 0) - jump * 0.6 + crouch * 0.4,
        armL: f.t > tLand ? 2.4 + reach * 0.2 : 0.6 + leap * 1.2,
        armR: f.t > tLand ? 0.5 + reach * 0.8 : 0.6 + leap * 1.2,
        lean: f.t > tLand ? 0.06 : 0,
      }));
      pawAt(s.clawd, 0, v3);
      const paw = v3.clone();
      bunch(f, paw, true);
      pop.group.position.set(to.x, DESK_Y + 0.6, 0.4);
      pop.update(f.t - tLand, 0.45);
    };
  }, { tagged: false });

  // P2 "Give me a name": a hand slaps a blank HELLO tag on him and writes HELPER on it with a
  // marker. It tickles; he squirms, reads it upside down, and beams.
  const tName = W(10, 3), tWrite0 = tName + 0.1, tWrite1 = tName + 0.62;
  const p2 = officeShot('pc-name', C.p2, C.p3, s => {
    const bunch = balloonBunch(s);
    const tag = namingTag();
    tag.mesh.position.set(0.02, 0.4, 0.03);
    tag.mesh.rotation.z = -0.06;
    s.clawd.body.add(tag.mesh);
    const arm = reachingArm('#8fb3e0');
    const held = namingTag();
    held.mesh.position.set(-0.04, 0.0, 0.03);
    held.mesh.rotation.z = -0.06;
    arm.add(held.mesh);
    s.scene.add(arm);
    const hearts = sparkles(5, 0.6, '#ff8fa3', 7);
    s.scene.add(hearts.group);
    const tagAt = new THREE.Vector3();
    return f => {
      const wb = wobble(f.t, 0.03, 2);
      s.aim(-1.3 + wb.x, 2.55 + wb.y, 6.2 - (f.t - C.p2) * 0.25, -1.3, 2.35, 0.25);
      const slap = f.t >= tName;
      const hit = decay(f.t - tName, 0.09);
      const writing = f.t >= tName && f.t < tWrite1 + 0.05;
      const tickle = writing ? 1 : 0;
      const proud = smooth(unlerp(f.t, tWrite1 + 0.05, tWrite1 + 0.3));
      const look = writing ? { x: 0.15, y: -1 } : { x: 0, y: 0 };
      s.clawd.setMood(writing ? { ...MOODS.excited, blush: 1.1, jitter: 0.25 } : mixMood(MOODS.excited, { ...MOODS.proud, blush: 1.3 }, proud), f.t, look);
      s.clawd.setPose(pose({
        squash: hit * 0.5 + tickle * (0.08 + Math.sin(f.t * 34) * 0.06),
        lean: hit * 0.15 + tickle * Math.sin(f.t * 21) * 0.07 - proud * 0.05,
        armL: 2.4, armR: 0.4 + tickle * (0.5 + Math.sin(f.t * 27) * 0.3) + proud * 1.9,
        bounce: proud * beatHop(f.clock, f.t) * 0.35,
      }));
      s.clawd.root.updateMatrixWorld(true);
      tag.mesh.getWorldPosition(tagAt);
      // the hand: in from the right with the blank tag, presses it on, writes, leaves
      const inK = easeOutCubic(unlerp(f.t, tName - 0.35, tName - 0.02));
      const outK = easeInCubic(unlerp(f.t, tWrite1 + 0.06, tWrite1 + 0.4));
      const wk = unlerp(f.t, tWrite0, tWrite1);
      const toWrite = smooth(unlerp(f.t, tName + 0.02, tWrite0));
      // the marker's tip runs along the name line, with a little up-and-down for the letters
      const tipX = tagAt.x + lerp(-0.17, 0.17, wk), tipY = tagAt.y - 0.04 + Math.sin(wk * Math.PI * 12) * 0.025 * (wk > 0 && wk < 1 ? 1 : 0);
      const pressX = tagAt.x + 0.08, pressY = tagAt.y - 0.06;
      const hx = lerp(pressX, tipX - MARKER_TIP.x, toWrite), hy = lerp(pressY, tipY - MARKER_TIP.y, toWrite);
      arm.position.set(lerp(1.6, hx, inK) + outK * 3.2, lerp(DESK_Y + 1.0, hy, inK) + outK * 0.5, tagAt.z + 0.3);
      arm.rotation.z = lerp(-0.25, 0, inK) - outK * 0.15;
      arm.visible = inK > 0 && outK < 1;
      held.mesh.visible = !slap;
      if (!slap) held.write(f, 0);
      tag.mesh.visible = slap;
      tag.write(f, clamp(wk));
      bunch(f, pawAt(s.clawd, 0, new THREE.Vector3()), false);
      hearts.group.position.set(tagAt.x + 0.15, tagAt.y + 1.15, tagAt.z + 0.25);
      hearts.update(f.t - (tWrite1 + 0.15), 0.8);
    };
  }, { tagged: false });

  // P3 "Point at the problem": Clawd at the end of the desk watches a bug crawl onto the
  // keyboard. The pointer hand swoops in and taps it; "!", the bug bolts and Clawd zooms after it.
  const tPoint = W(11, 0), tProblem = W(11, 3);
  const bugX = (t: number) => {
    if (t < tProblem) return lerp(-0.45, 0.15, unlerp(t, C.p3, tProblem));
    return 0.15 + easeInCubic(unlerp(t, tProblem + 0.12, tProblem + 0.75)) * 3.2;
  };
  const p3 = officeShot('pc-point', C.p3, C.p4, s => {
    const b = bug();
    const hand = pointerHand(0.38);
    const ring = new THREE.Group();
    ring.add(shapeMesh(new THREE.Shape().absarc(0, 0, 0.3, 0, Math.PI * 2, false), INK, 0));
    ring.add(shapeMesh(new THREE.Shape().absarc(0, 0, 0.25, 0, Math.PI * 2, false), '#fbf7f0', 0.002));
    const lines = speedLines(6, 1.4, 7);
    const bang = new THREE.Group();
    bang.add(inkedRect(0.07, 0.24, 0.03, '#e0504a', 0.025));
    const dot = inkedCircle(0.04, '#e0504a', 0.02); dot.position.y = -0.2; bang.add(dot);
    // Clawd's own "!" when the finger lands
    const alarm = new THREE.Group();
    alarm.add(inkedRect(0.13, 0.4, 0.05, '#ffd166', 0.04));
    const adot = inkedCircle(0.075, '#ffd166', 0.035); adot.position.y = -0.35; alarm.add(adot);
    s.scene.add(b, hand, ring, lines.group, bang, alarm);
    return f => {
      // camera: a medium on the desk with Clawd at the left; it follows the chase to the right
      const follow = easeInOutCubic(unlerp(f.t, tProblem + 0.25, C.p4 + 0.1));
      const camX = lerp(-0.35, 1.5, follow) + (f.t - C.p3) * 0.04;
      const wb = wobble(f.t, 0.02, 3);
      s.aim(camX + wb.x, DESK_Y + 1.1 + wb.y, 5.3, camX, DESK_Y + 0.68, 0.2);
      const bx = bugX(f.t), scared = f.t > tProblem && f.t < tProblem + 0.2 ? 1 : 0;
      b.position.set(bx, DESK_Y, 0.3);
      b.animate(f.t < tProblem ? (f.t - C.p3) * 2.2 : (f.t - tProblem) * 9, scared, f.t);
      bang.visible = f.t > tProblem + 0.02 && f.t < tProblem + 0.45;
      bang.position.set(bx - 0.28, DESK_Y + 0.6 + scared * 0.05, 0.35);
      // pointer: swoops in from the top right, taps on "problem"
      const sw = easeInOutCubic(unlerp(f.t, tPoint - 0.15, tProblem - 0.03));
      const tapK = Math.max(0, 1 - Math.abs(f.t - tProblem) / 0.08);
      const hx = lerp(2.4, 0.22, sw), hy = lerp(DESK_Y + 2.2, DESK_Y + 0.34, sw) - tapK * 0.07;
      const leave = easeInCubic(unlerp(f.t, tProblem + 0.5, tProblem + 0.9));
      hand.position.set(hx + leave * 2, hy + leave * 1.5, 0.45);
      hand.rotation.z = Math.PI - lerp(0.9, 0.45, sw); // finger points down-left at the bug
      hand.scale.setScalar(0.38 * (1 - tapK * 0.08));
      const rk = unlerp(f.t, tProblem, tProblem + 0.3);
      ring.visible = rk > 0 && rk < 1;
      ring.position.set(0.15, DESK_Y + 0.12, 0.32);
      ring.scale.set(0.4 + rk * 1.4, (0.4 + rk * 1.4) * 0.35, 1);
      // Clawd: watches the bug, then the finger coming in; jumps on "problem", then zooms after it
      const zk = unlerp(f.t, tProblem + 0.3, C.p4 + 0.05);
      const cx = lerp(-1.65, bugX(f.t) - 1.0, easeInCubic(zk));
      const startle = hop(f.t, tProblem + 0.02, tProblem + 0.3, 0.32);
      s.clawd.root.position.set(cx, DESK_Y + startle, 0.25);
      const seeHand = smooth(unlerp(f.t, tPoint - 0.1, tPoint + 0.15)) * (1 - smooth(unlerp(f.t, tProblem - 0.2, tProblem)));
      const look = { x: lerp(0.7, 0.9, seeHand), y: lerp(-0.5, 0.6, seeHand) };
      const alert = f.t >= tProblem;
      s.clawd.setMood(alert ? { ...MOODS.focused, open: 1.35, squint: 0.2 } : mixMood(MOODS.excited, MOODS.focused, 0.25), f.t, look);
      const chasing = zk > 0;
      s.clawd.setPose(pose(chasing
        ? { lean: -0.25, walk: (f.t - tProblem) * 7, armL: 0.9, armR: 0.9, squash: -0.15 }
        : {
          squash: startle > 0 ? -0.3 : decay(f.t - (tProblem + 0.3), 0.08) * 0.3,
          armL: alert ? 1.7 : 0.35, armR: alert ? 1.7 : 0.35 + seeHand * 0.5,
          lean: alert ? 0 : 0.06 * Math.sin(f.t * 3), bounce: alert ? 0 : beatHop(f.clock, f.t) * 0.25,
        }));
      const ak = unlerp(f.t, tProblem, tProblem + 0.55);
      alarm.visible = ak > 0 && ak < 1;
      alarm.position.set(cx + 0.82, DESK_Y + startle + 1.25, 0.35);
      alarm.rotation.z = -0.25;
      alarm.scale.setScalar(Math.max(0.01, easeOutBack(clamp(ak * 4), 2.5)) * (1 - smooth(unlerp(ak, 0.8, 1))));
      alarm.rotation.z += Math.sin(f.t * 40) * 0.08;
      lines.group.position.set(cx - 0.6, DESK_Y + 0.6, 0.3);
      lines.update(zk > 0 && zk < 1 ? 1 : 0, 1, f.t);
    };
  });

  // P4 "I'll do the same": he corners the bug against the mug and mirrors the pointer's pose. A
  // rubber stamp drops into his paw and he hops and slams it down on "same" (the downbeat):
  // confetti, and the first green DONE.
  const tDo = W(12, 1), tSame = W(12, 3), tStamp = 37.7;
  const p4 = officeShot('pc-same', C.p4, C.p5, s => {
    const b = bug();
    const hand = pointerHand(0.38);
    const stamp = rubberStamp(0.8);
    const sheet = inkedRect(1.1, 0.06, 0.01, '#ffffff', 0.03);
    const mark = doneMark(0.95);
    const burst = confetti(36, 41, { speed: 4.5, size: 0.11, life: 1.4 });
    s.scene.add(b, hand, stamp, sheet, mark, burst.group);
    const pop = sparkles(8, 0.7, '#ffd166', 9);
    s.scene.add(pop.group);
    const bx = 1.35, cxEnd = bx - 0.86;
    return f => {
      const shake = decay(f.t - tStamp, 0.12) * 0.06;
      const wb = wobble(f.t, 0.02, 4);
      const push = easeInOutCubic(unlerp(f.t, C.p4, C.p5)) * 0.6;
      s.aim(0.85 + wb.x + Math.sin(f.t * 70) * shake, DESK_Y + 1.25 + wb.y + Math.cos(f.t * 61) * shake, 5.3 - push, 0.85, DESK_Y + 0.85, 0.25);
      // the bug cowers against the mug until it is squashed
      b.visible = f.t < tStamp;
      b.position.set(bx, DESK_Y, 0.3);
      b.animate(f.t * 4, 1, f.t);
      sheet.position.set(bx, DESK_Y + 0.03, 0.2);
      // Clawd skids in, mirrors the pointer, catches the stamp, hops and slams it
      const skid = easeOutCubic(unlerp(f.t, C.p4, C.p4 + 0.35));
      const cx = lerp(-0.7, cxEnd, skid);
      const mirror = smooth(unlerp(f.t, tDo - 0.05, tDo + 0.15));
      const rise = smooth(unlerp(f.t, tSame - 0.3, tSame - 0.08));
      const slam = easeInCubic(unlerp(f.t, tSame - 0.08, tStamp));
      const lift = smooth(unlerp(f.t, tStamp + 0.3, tStamp + 0.55));
      const after = f.t > tStamp;
      const hopUp = f.t < tStamp ? rise * (1 - slam) * 0.5 : 0;
      const cheer = after ? hop(f.t, tStamp + 0.55, tStamp + 0.95, 0.7) : 0;
      s.clawd.root.position.set(cx, DESK_Y + hopUp + cheer, 0.25);
      const armR = f.t < tSame - 0.3 ? lerp(0.5, 1.5, mirror) : f.t < tStamp ? lerp(lerp(1.5, 1.2, rise), 0.0, slam) : lerp(0.0, 2.3, lift);
      s.clawd.setMood(after ? { ...MOODS.excited, blush: 0.8 } : mixMood(MOODS.focused, MOODS.excited, mirror * 0.3), f.t);
      s.clawd.setPose(pose({
        lean: lerp(-0.3, 0, skid) + (after ? 0 : mirror * 0.06),
        squash: decay(f.t - (C.p4 + 0.35), 0.1) * 0.5 + decay(f.t - tStamp, 0.08) * 0.45 - hopUp * 0.4 - (cheer > 0.05 ? 0.3 : 0),
        armR, armL: after ? 0.4 + lift * 2.1 : 0.4 + rise * 0.4,
        bounce: f.t > tStamp + 1.0 ? beatHop(f.clock, f.t) * 0.3 : 0,
      }));
      // the pointer hovers beside the bug: the two of them point at it together
      const hk = easeOutBack(unlerp(f.t, tDo - 0.25, tDo + 0.05));
      const hl = easeInCubic(unlerp(f.t, tSame - 0.15, tSame + 0.15));
      hand.visible = hk > 0.01 && hl < 1;
      hand.position.set(bx + 0.22 + hl * 1.5, DESK_Y + 0.42 + hl * 1.4 + Math.sin(f.t * 5) * 0.03, 0.5);
      hand.rotation.z = Math.PI - 0.5;
      hand.scale.setScalar(0.38 * Math.max(0.01, hk));
      // stamp: drops into his paw just after "do", then rides in it (knob in his paw)
      const paw = pawAt(s.clawd, 1, new THREE.Vector3());
      const held = new THREE.Vector3(paw.x, paw.y - 0.69, 0.45);
      const caught = unlerp(f.t, tDo + 0.05, tDo + 0.32);
      if (caught < 1) stamp.position.set(held.x, lerp(held.y + 3.5, held.y, easeInCubic(caught)), 0.45);
      else stamp.position.copy(held);
      stamp.position.y = Math.max(stamp.position.y, DESK_Y - 0.02);
      stamp.visible = caught > 0;
      const squish = decay(f.t - tStamp, 0.06) * (after ? 1 : 0) + decay(f.t - (tDo + 0.32), 0.06) * (caught >= 1 ? 0.5 : 0);
      stamp.scale.set(0.8 * (1 + squish * 0.2), 0.8 * (1 - squish * 0.2), 0.8);
      // the mark: on the sheet where the bug was
      mark.visible = after;
      mark.position.set(bx, DESK_Y + 0.12, 0.42);
      mark.rotation.z = -0.12;
      mark.scale.setScalar(Math.max(0.01, easeOutBack(unlerp(f.t, tStamp + 0.3, tStamp + 0.5), 2.5)));
      burst.group.position.set(bx, DESK_Y + 0.2, 0.5);
      burst.update(f.t - tStamp);
      pop.group.position.set(bx, DESK_Y + 0.35, 0.55);
      pop.update(f.t - (tStamp + 0.35), 0.6);
    };
  });

  // P5 (the build into the chorus): the whole office gives him a thumbs up, then on the last bar
  // their work comes flying to his desk.
  const p5 = officeShot('pc-office', C.p5, C.c1, s => {
    const papers = Array.from({ length: 14 }, (_, i) => {
      const p = inkedRect(0.5, 0.36, 0.02, '#ffffff', 0.03);
      const lines = shapeMesh(roundedRectShape(0.3, 0.04, 0.01, 0, 0.05), '#c9c0b4', 0.004);
      const lines2 = shapeMesh(roundedRectShape(0.24, 0.04, 0.01, -0.03, -0.05), '#c9c0b4', 0.004);
      p.add(lines, lines2);
      s.scene.add(p);
      return p;
    });
    const fly = (i: number) => 40.02 + i * 0.07;
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.p5, C.c1));
      const wb = wobble(f.t, 0.04, 5);
      s.aim(lerp(-1.4, -0.4, k) + wb.x, lerp(3.3, 4.7, k) + wb.y, lerp(8.5, 15, k), lerp(-1.6, -0.6, k), lerp(2.3, 2.8, k), lerp(0, -3, k));
      s.stations.forEach((st, i) => {
        if (st === s.hero) return;
        const t0 = 38.9 + hash(i, 501) * 0.6 + (st.z < -2 ? 0.25 : 0);
        const up = easeOutBack(unlerp(f.t, t0, t0 + 0.35), 1.6) * (1 - smooth(unlerp(f.t, 40.0, 40.4)));
        if (up > 0.01) st.person.pose(up * 1.1, up, beatHop(f.clock, f.t) * up);
      });
      s.hero.person.pose(easeOutBack(unlerp(f.t, 38.95, 39.3)) * (1 - smooth(unlerp(f.t, 40.0, 40.4))), 1, 0);
      s.clawd.setMood({ ...MOODS.proud, blush: 1.1 }, f.t);
      s.clawd.setPose(pose({ bounce: beatHop(f.clock, f.t) * 0.45, armL: 1.6 + 0.4 * Math.sin(f.t * 6), armR: 1.6 + 0.4 * Math.sin(f.t * 6 + 1) }));
      // papers from every desk fly to the hero desk on the last bar
      papers.forEach((p, i) => {
        const st = s.stations[(i * 5 + 3) % s.stations.length];
        const u = unlerp(f.t, fly(i), fly(i) + 0.7);
        p.visible = u > 0 && u < 1;
        const from = new THREE.Vector3(st.x + HERO.monitorX, 2.8, st.z), to = new THREE.Vector3(-0.6, DESK_Y + 0.3 + (i % 5) * 0.06, 0.4);
        p.position.lerpVectors(from, to, easeInOutCubic(u)).add(v3.set(0, Math.sin(u * Math.PI) * 2.2, 0));
        p.rotation.z = u * 6 + i;
      });
    };
  });

  // ------------------------------------------------------------------------------------------
  // Chorus 1. C1 "I can make it faster": a conveyor of tickets; he stamps DONE on each one, on the
  // beat, then on every half beat once he speeds up on "faster".
  const stampTimes = [...beatsIn(C.c1 - 1.2, 42.3), ...halfBeatsIn(42.3, C.c2 + 0.01)];
  const conveyorSetup = conveyorScene(stampTimes, 42.23);
  const c1 = officeShot('c1-conveyor', C.c1, C.c1b, conveyorSetup((s, f, punch) => {
    const wb = wobble(f.t, 0.03, 6);
    s.aim(-0.6 + wb.x, 2.85 + wb.y, 9.0 - punch * 0.15 - (f.t - C.c1) * 0.4, -0.4, 1.75, 2.4);
  }));
  const c1b = officeShot('c1-faster', C.c1b, C.c2, conveyorSetup((s, f, punch) => {
    const wb = wobble(f.t, 0.03, 7);
    s.aim(0.9 + wb.x - (f.t - C.c1b) * 0.4, 2.45 + wb.y, 6.0 - punch * 0.2, -0.3 - (f.t - C.c1b) * 0.3, 1.85, 2.6);
    s.camera.rotateZ(-0.06);
  }));

  // C2 "I can make it clean": a page covered in scribbles; he runs the length of it with a
  // squeegee on "clean" and leaves it spotless.
  const tClean = W(14, 4);
  const splats = [{ t: C.c2 + 0.05, x: 0.3, y: 0.62 }, { t: W(14, 2), x: 0.72, y: 0.3 }, { t: 44.09, x: 0.15, y: 0.25 }, { t: W(14, 3), x: 0.55, y: 0.75 }];
  const c2 = officeShot('c1-clean', C.c2, C.c3, s => {
    const PW = 3.4, PH = 2.2, PX = 0.4, PY = 1.85, PZ = 2.5;
    let wipeX = 0;
    const page = canvasPlane(PW, PH, 150, (c, f: Frame, Wd, Hd) => {
      // the clean page underneath
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, Wd, Hd);
      c.fillStyle = '#3a3a46'; c.fillRect(Wd * 0.1, Hd * 0.12, Wd * 0.45, Hd * 0.07);
      c.fillStyle = '#c9c0b4';
      for (let r = 0; r < 6; r++) c.fillRect(Wd * 0.1, Hd * (0.3 + r * 0.1), Wd * (0.55 + hash(r, 701) * 0.25), Hd * 0.035);
      c.strokeStyle = DONE_GREEN; c.lineWidth = Hd * 0.04; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(Wd * 0.74, Hd * 0.2); c.lineTo(Wd * 0.8, Hd * 0.27); c.lineTo(Wd * 0.9, Hd * 0.12); c.stroke();
      // the mess, still on the page right of the squeegee
      c.save();
      c.beginPath(); c.rect(wipeX * Wd, 0, Wd, Hd); c.clip();
      c.fillStyle = '#f6f0e4'; c.fillRect(0, 0, Wd, Hd);
      c.strokeStyle = 'rgba(43,29,22,0.8)'; c.lineWidth = Hd * 0.018;
      for (let r = 0; r < 7; r++) {
        c.beginPath(); c.moveTo(Wd * 0.08, Hd * (0.15 + r * 0.11));
        for (let k = 1; k < 14; k++) c.lineTo(Wd * (0.08 + k * 0.06), Hd * (0.15 + r * 0.11) + (hash(r, k, 702) - 0.5) * Hd * 0.06);
        c.stroke();
      }
      c.strokeStyle = '#e0504a'; c.lineWidth = Hd * 0.025;
      for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(Wd * (0.2 + r * 0.2), Hd * 0.25); c.lineTo(Wd * (0.35 + r * 0.2), Hd * 0.6); c.moveTo(Wd * (0.35 + r * 0.2), Hd * 0.25); c.lineTo(Wd * (0.2 + r * 0.2), Hd * 0.6); c.stroke(); }
      c.strokeStyle = 'rgba(140,90,50,0.55)'; c.lineWidth = Hd * 0.03;
      c.beginPath(); c.arc(Wd * 0.75, Hd * 0.7, Hd * 0.14, 0, Math.PI * 1.8); c.stroke();
      splats.forEach((sp, i) => {
        const k = easeOutBack(unlerp(f.t, sp.t, sp.t + 0.12), 2);
        if (k <= 0) return;
        c.fillStyle = '#2b2b3a';
        for (let j = 0; j < 9; j++) {
          const a = hash(i, j, 703) * Math.PI * 2, d = (j ? 0.04 + hash(i, j, 704) * 0.08 : 0) * k;
          c.beginPath(); c.arc(Wd * (sp.x + Math.cos(a) * d * 0.7), Hd * (sp.y + Math.sin(a) * d), Hd * (j ? 0.02 + hash(i, j, 705) * 0.03 : 0.08) * k, 0, Math.PI * 2); c.fill();
        }
      });
      c.restore();
    });
    page.mesh.position.set(PX, PY, PZ);
    const frame = inkedRect(PW + 0.08, PH + 0.08, 0.03, '#ffffff', 0.08);
    frame.position.set(PX, PY, PZ - 0.02);
    const ledge = inkedRect(PW + 0.6, 0.14, 0.04, '#a0704a', 0.05);
    ledge.position.set(PX, PY - PH / 2 - 0.07, PZ + 0.05);
    const legs = [-1, 1].map(sd => { const l = inkedRect(0.14, 2.0, 0.04, '#a0704a', 0.05); l.position.set(PX + sd * (PW / 2 - 0.2), 0.95, PZ - 0.1); l.rotation.z = sd * 0.08; return l; });
    const squeegee = new THREE.Group();
    const blade = inkedRect(0.14, PH + 0.1, 0.04, '#3a3a46', 0.05);
    const handle = inkedRect(0.55, 0.1, 0.04, '#e0504a', 0.04); handle.position.set(-0.3, -PH / 2 + 0.55, 0);
    squeegee.add(blade, handle);
    const shine = sparkles(9, 1.3, '#ffffff', 13);
    s.scene.add(frame, page.mesh, ledge, ...legs, squeegee, shine.group);
    return f => {
      const wk = easeInOutCubic(unlerp(f.t, tClean - 0.04, tClean + 0.3));
      wipeX = wk;
      page.update(f);
      const bx = PX - PW / 2 + wk * PW;
      squeegee.position.set(bx, PY, PZ + 0.1);
      squeegee.rotation.z = (wk > 0 && wk < 1 ? -0.08 : 0) + Math.sin(f.t * 30) * 0.01 * (wk > 0 && wk < 1 ? 1 : 0);
      const windup = smooth(unlerp(f.t, tClean - 0.35, tClean - 0.05));
      const done = f.t > tClean + 0.3;
      s.clawd.root.position.set(bx - 0.75 - windup * 0.15 * (1 - wk), PY - PH / 2, PZ + 0.05);
      s.clawd.setMood(done ? { ...MOODS.proud, blush: 0.6 } : mixMood(MOODS.focused, MOODS.excited, 0.2), f.t);
      s.clawd.setPose(pose({
        armR: done ? 2.4 : 1.0, armL: done ? 2.0 : 0.5 + windup * 0.4,
        lean: -windup * 0.2 + (wk > 0 && wk < 1 ? 0.25 : 0), walk: wk > 0 && wk < 1 ? f.t * 8 : 0,
        bounce: done ? beatHop(f.clock, f.t) * 0.35 : 0, squash: decay(f.t - (tClean + 0.3), 0.1) * 0.4,
      }));
      shine.group.position.set(PX, PY, PZ + 0.2);
      shine.update(f.t - (tClean + 0.12), 0.7);
      const wb = wobble(f.t, 0.03, 8), punch = decay(f.t - 44.67, 0.1) * 0.2;
      s.aim(0.2 + wb.x, 2.2 + wb.y, 9.0 - punch - (f.t - C.c2) * 0.3, 0.2, 1.65, PZ);
    };
  });

  // C3/C4 "I can fill the spaces / In between": a wall of blocks with gaps. Pieces drop into the
  // gaps on the beat and two rows clear; the last gap is Clawd-shaped, and he jumps into it.
  const CELL = 0.44, COLS = 12, X0 = -2.64, BZ = 2.4;
  const tA = 46.13, tB = 46.43, tClear1 = 47.01, tC = 47.59, tIn = W(16, 0), tBetween = W(16, 1), tClear2 = 49.35;
  const HOLE = { c0: 5, c1: 7, r0: 2, r1: 3 };
  const PIECES = [
    { t: tA, col: '#ffd166', cells: [[0, 2], [1, 2], [0, 3], [1, 3]] },
    { t: tB, col: '#7fd3e6', cells: [[3, 0], [3, 1], [3, 2], [3, 3]] },
    { t: tC, col: '#c9a7eb', cells: [[8, 3], [9, 3], [10, 3], [11, 3]] },
  ];
  const BLOCK_COLS = ['#f2a09a', '#9fc7f2', '#8fd6a0', '#ffd166', '#c9a7eb', '#f6b26b', '#7fd3e6'];
  function blockWall(s: OfficeSet) {
    const block = (col: string) => {
      const g = new THREE.Group();
      g.add(inkedRect(CELL - 0.03, CELL - 0.03, 0.03, col, 0.035));
      g.add(Object.assign(shapeMesh(roundedRectShape(CELL * 0.5, CELL * 0.12, 0.02, -CELL * 0.12, CELL * 0.26), ownMat('#ffffff', 0.55, true), 0.006)));
      const flash = shapeMesh(roundedRectShape(CELL - 0.03, CELL - 0.03, 0.03), ownMat('#ffffff', 0, true), 0.008);
      g.add(flash);
      s.scene.add(g);
      return Object.assign(g, { flash });
    };
    const inPiece = (c: number, r: number) => PIECES.some(p => p.cells.some(([pc, pr]) => pc === c && pr === r));
    const statics: { g: ReturnType<typeof block>; c: number; r: number }[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < COLS; c++) {
      if (inPiece(c, r)) continue;
      if (c >= HOLE.c0 && c <= HOLE.c1 && r >= HOLE.r0 && r <= HOLE.r1) continue;
      statics.push({ g: block(BLOCK_COLS[Math.floor(hash(c, r, 801) * BLOCK_COLS.length)]), c, r });
    }
    const pieces = PIECES.map(p => ({ ...p, blocks: p.cells.map(() => block(p.col)) }));
    const pop1 = sparkles(10, 2.6, '#ffffff', 21), pop2 = sparkles(12, 3.0, '#ffd166', 23);
    s.scene.add(pop1.group, pop2.group);
    /** y offset of a row (original index) at time t: rows above the first clear drop two cells. */
    const rowY = (r: number, t: number) => (r - (r >= 2 ? 2 * easeOutBounce(unlerp(t, tClear1 + 0.05, tClear1 + 0.35)) : 0)) * CELL;
    const place = (b: ReturnType<typeof block>, c: number, r: number, t: number, extraY = 0) => {
      const cleared = (r < 2 && t >= tClear1) || (r >= 2 && t >= tClear2);
      const tc = r < 2 ? tClear1 : tClear2;
      const k = unlerp(t, tc, tc + 0.18);
      b.visible = !cleared || k < 1;
      b.position.set(X0 + (c + 0.5) * CELL, rowY(r, t) + CELL / 2 + extraY, BZ);
      b.scale.setScalar(cleared ? Math.max(0.001, 1 - k) * (1 + k * 0.4) : 1);
      // complete rows pulse white before they clear
      const full = r < 2 ? t >= tB : t >= tBetween;
      const pulse = full && !cleared ? 0.5 + 0.5 * Math.sin((t - (r < 2 ? tB : tBetween)) * Math.PI * 2 * 3.4 - Math.PI / 2) : 0;
      (b.flash.material as THREE.MeshBasicMaterial).opacity = pulse * 0.75;
    };
    return (f: Frame) => {
      statics.forEach(st => place(st.g, st.c, st.r, f.t));
      pieces.forEach(p => p.blocks.forEach((b, i) => {
        const [c, r] = p.cells[i];
        const fall = unlerp(f.t, p.t - 0.32, p.t);
        b.visible = fall > 0;
        place(b, c, r, f.t, (1 - fall * fall) * 4.5);
        if (fall <= 0) b.visible = false;
        b.scale.y *= 1 - decay(f.t - p.t, 0.06) * 0.15;
      }));
      pop1.group.position.set(X0 + COLS * CELL / 2, CELL, BZ + 0.2);
      pop1.update(f.t - tClear1, 0.6);
      pop2.group.position.set(X0 + COLS * CELL / 2, CELL, BZ + 0.2);
      pop2.update(f.t - tClear2, 0.8);
    };
  }
  const holeX = X0 + (HOLE.c0 + 1.5) * CELL;
  const c3 = officeShot('c1-fill', C.c3, C.c4, s => {
    const wall = blockWall(s);
    return f => {
      wall(f);
      const drops = [tA, tB, tC];
      const point = Math.max(0, ...drops.map(d => decay(Math.abs(f.t - d + 0.1) - 0.1, 0.12)));
      s.clawd.root.position.set(3.25, 0, BZ + 0.1);
      s.clawd.setMood(f.t > tClear1 ? { ...MOODS.excited, blush: 0.6 } : mixMood(MOODS.focused, MOODS.excited, 0.4), f.t);
      s.clawd.setPose(pose({ armL: 0.4 + point * 1.6, armR: 0.5, lean: -0.1 * point, bounce: beatHop(f.clock, f.t) * 0.3, squash: decay(f.t - tClear1, 0.1) * 0.3 }));
      const wb = wobble(f.t, 0.03, 9), punch = Math.max(decay(f.t - tClear1, 0.1), ...drops.map(d => decay(f.t - d, 0.08) * (f.t >= d ? 0.5 : 0))) * 0.25;
      s.aim(0.35 + wb.x, 2.15 + wb.y, 10.2 - punch - (f.t - C.c3) * 0.25, 0.35, 1.1, BZ);
    };
  });
  const c4 = officeShot('c1-between', C.c4, C.c5, s => {
    const wall = blockWall(s);
    const snug = sparkles(8, 0.9, '#ffffff', 25);
    const party = confetti(46, 27, { size: 0.12, speed: 4.2, life: 1.5, spread: 2.4 });
    s.scene.add(snug.group, party.group);
    return f => {
      wall(f);
      // the office cheers the clear: thumbs up around the room, staggered
      s.stations.forEach((st, i) => {
        const up = easeOutBack(unlerp(f.t, tClear2 + 0.1 + hash(i, 811) * 0.4, tClear2 + 0.4 + hash(i, 811) * 0.4));
        if (up > 0.01) st.person.pose(up * 1.1, up, beatHop(f.clock, f.t) * up);
      });
      const jump = unlerp(f.t, tIn + 0.1, tBetween);
      const inHole = f.t >= tBetween;
      const floorY = -2 * CELL + HOLE.r0 * CELL + CELL - 0.22 * 1 - 0.16; // feet so his body fills the gap
      const out = f.t >= tClear2;
      let x = lerp(3.25, holeX, easeInOutCubic(jump)), y = Math.sin(jump * Math.PI) * 1.6 + lerp(0, floorY, jump);
      if (inHole) { x = holeX; y = floorY; }
      if (out) y = lerp(floorY, 0, easeOutBounce(unlerp(f.t, tClear2, tClear2 + 0.35)));
      s.clawd.root.position.set(x, y, BZ - 0.05);
      const crouch = smooth(unlerp(f.t, tIn - 0.1, tIn + 0.1)) * (1 - smooth(unlerp(f.t, tIn + 0.1, tIn + 0.15)));
      const click = decay(f.t - tBetween, 0.08);
      s.clawd.setMood(out ? { ...MOODS.proud, blush: 0.9 } : inHole ? { ...MOODS.excited, blush: 0.5 } : MOODS.excited, f.t);
      const dust = out && f.t > tClear2 + 0.5 ? Math.sin((f.t - tClear2) * 16) : 0;
      s.clawd.setPose(pose({
        squash: crouch * 0.5 + click * 0.5 - (jump > 0 && jump < 1 ? 0.3 : 0) + (out ? decay(f.t - tClear2 - 0.3, 0.1) * 0.4 : 0),
        armL: inHole && !out ? 0.1 : out ? 1.0 + dust * 0.3 : 1.4, armR: inHole && !out ? 0.1 : out ? 1.0 - dust * 0.3 : 1.4,
        bounce: out && f.t > tClear2 + 0.5 ? beatHop(f.clock, f.t) * 0.3 : 0,
      }));
      snug.group.position.set(holeX, floorY + 0.55, BZ + 0.3); snug.update(f.t - tBetween, 0.5);
      party.group.position.set(holeX, 0.9, BZ + 0.25); party.update(f.t - tClear2);
      // close on the last piece clicking home; after the clear, pull back and up to the cheering office
      const close = 1 - easeInOutCubic(unlerp(f.t, tClear2 - 0.1, tClear2 + 0.9));
      const wb = wobble(f.t, 0.03, 10), punch = decay(f.t - tBetween, 0.1) * 0.3 + decay(f.t - tClear2, 0.12) * 0.3;
      s.aim(lerp(0.35, holeX + 0.6, close) + wb.x, lerp(2.9, 1.6, close) + wb.y, lerp(10.6, 6.8, close) - punch, lerp(0.35, holeX + 0.6, close), lerp(1.75, 0.85, close), BZ);
    };
  });

  // C5-C7: a queue of people with boxes. "I don't need a reason": he takes each box without
  // looking. "You don't have to tell": a "?" box. "Give me what you're carrying": they stack
  // boxes on his head until he's a wobbling tower.
  const handTimes = [50.81, 51.25, 51.71, 52.27, 52.88, 53.45, 54.03];
  const stackTimes = [W(19, 0), 55.49, 55.79, 56.37, 56.96, 57.27];
  const qMark = 5; // the box with the "?" on it
  /** Where handed box i lands: a pile on the floor in front of his desk, clear of the monitor. Each box
   *  sits in front of the ones under and beside it, so an ink line always shows between them. */
  const pileSpot = (i: number) => new THREE.Vector3(0.15 + (i % 3) * 0.92 + (hash(i, 952) - 0.5) * 0.1, Math.floor(i / 3) * 0.62, 0.85 + Math.floor(i / 3) * 0.036 + (i % 3) * 0.012);
  function queueSetup(cam: (s: OfficeSet, f: Frame) => void, opts: { tower: boolean }) {
    return (s: OfficeSet) => {
      const N = 15;
      const people = Array.from({ length: N }, (_, i) => {
        const p = standingPerson(900 + i);
        p.root.scale.setScalar(0.92);
        s.scene.add(p.root);
        const b = cardboardBox(0.85, 0.62, 910 + i, i === qMark ? '?' : undefined);
        b.position.set(0, -0.3, 0.05);
        p.hands.add(b);
        // two hands gripping the box sides, drawn in front of it
        for (const sd of [-1, 1]) { const h = inkedCircle(0.15, p.shirt, 0.05); h.position.set(sd * 0.45, 0.0, 0.1); b.add(h); }
        return { p, b };
      });
      const pile = Array.from({ length: handTimes.length }, (_, i) => {
        const b = cardboardBox(0.85, 0.62, 910 + i, i === qMark ? '?' : undefined);
        s.scene.add(b);
        return b;
      });
      const towerBoxes = Array.from({ length: stackTimes.length }, (_, i) => {
        const b = cardboardBox(0.82, 0.6, 930 + i);
        s.scene.add(b);
        return b;
      });
      const all = [...handTimes, ...(opts.tower ? stackTimes : [])].sort((a, b) => a - b);
      return (f: Frame) => {
        // how far the queue has advanced: one slot per handover, stepping forward just after it
        const adv = all.reduce((a, h) => a + easeInOutCubic(unlerp(f.t, h + 0.08, h + 0.4)), 0);
        people.forEach(({ p, b }, i) => {
          const slot = i - adv;
          const handed = f.t >= (all[i] ?? Infinity);
          const leaving = slot < 0;
          const x = leaving ? -3.35 + slot * 2.0 : -3.35 - slot * 1.3;
          const z = leaving ? 1.7 + Math.min(1, -slot) * 0.9 : 1.7;
          p.root.position.set(x, 0, z);
          p.root.visible = slot > -2.2 && slot < 7;
          const moving = Math.abs(slot - Math.round(slot)) > 0.02 || leaving;
          p.pose({ ...STAND, walk: moving ? f.t * 2.4 + i * 0.3 : 0, armL: handed ? 0.15 : -0.35, armR: handed ? 0.15 : 0.35, bob: beatHop(f.clock, f.t + i * 0.1) * 0.5 });
          b.visible = !handed;
          if (leaving && handed) p.pose({ ...STAND, walk: f.t * 2.4 + i, armL: 0.4 + Math.sin(f.t * 10) * 0.3, armR: 0.15 });
        });
        // handed boxes: arc from the person onto the pile beside him (C5/C6) or onto his head (C7)
        let towerN = 0;
        pile.forEach((b, i) => {
          const h = handTimes[i], u = unlerp(f.t, h - 0.05, h + 0.25);
          b.visible = f.t >= h - 0.05;
          const from = new THREE.Vector3(-3.35, 1.15, 1.85), to = pileSpot(i);
          b.position.lerpVectors(from, to, easeInOutCubic(u)).add(v3.set(0, Math.sin(u * Math.PI) * 2.4, 0));
          b.rotation.z = (1 - u) * 0.6 + (hash(i, 951) - 0.5) * 0.08 + Math.sin(f.t * 2 + i) * 0.01 * i;
        });
        towerBoxes.forEach((b, i) => {
          const h = stackTimes[i], u = unlerp(f.t, h - 0.05, h + 0.25);
          b.visible = opts.tower && f.t >= h - 0.05;
          if (!b.visible) return;
          if (f.t >= h + 0.25) towerN = i + 1;
          const sway = Math.sin(f.t * 3.1) * 0.035 * (i + 1) * (i + 1) * 0.5;
          const top = new THREE.Vector3(-1.75 + sway, DESK_Y + 1.02 + i * 0.6 - 0.02, 0.3 + i * 0.012);
          const from = new THREE.Vector3(-3.35, 1.15, 1.85);
          b.position.lerpVectors(from, top, easeInOutCubic(u)).add(v3.set(0, Math.sin(u * Math.PI) * 1.2, 0));
          b.rotation.z = (1 - u) * 0.6 + sway * 0.25 + (hash(i, 961) - 0.5) * 0.06;
        });
        // Clawd: takes each box with his eyes shut, happy; under the tower he strains, still smiling
        const take = Math.max(0, ...handTimes.map(h => decay(Math.abs(f.t - h) - 0.05, 0.12)));
        const load = opts.tower ? towerN / stackTimes.length : 0;
        const shrug = smooth(unlerp(f.t, W(18, 4) - 0.1, W(18, 4) + 0.1)) * (1 - smooth(unlerp(f.t, W(18, 4) + 0.5, W(18, 4) + 0.8)));
        s.clawd.root.position.set(-1.75, DESK_Y, 0.25);
        s.clawd.setMood(load > 0.5 ? { ...MOODS.excited, sweat: (load - 0.5) * 1.6, blush: 0.4 } : { ...MOODS.excited, blush: 0.4 }, f.t);
        s.clawd.setPose(pose({
          armL: opts.tower ? 2.3 + Math.sin(f.t * 7) * 0.08 * load : 0.5 + take * 0.9 + shrug * 1.5,
          armR: opts.tower ? 2.3 - Math.sin(f.t * 7) * 0.08 * load : 0.5 + take * 0.5 + shrug * 1.5,
          lean: opts.tower ? Math.sin(f.t * 3.1) * 0.04 * load : -take * 0.1 + shrug * 0.08,
          squash: load * 0.4 + Math.sin(f.t * 14) * 0.03 * load + decay(f.t - stackTimes[Math.max(0, towerN - 1)], 0.08) * 0.3 * (towerN ? 1 : 0),
          bounce: opts.tower ? 0 : beatHop(f.clock, f.t) * 0.25,
        }));
        cam(s, f);
      };
    };
  }
  const c5 = officeShot('c1-reason', C.c5, C.c6, queueSetup((s, f) => {
    const wb = wobble(f.t, 0.03, 11);
    s.aim(0.8 + wb.x - (f.t - C.c5) * 0.1, 2.9 + wb.y, 8.8 - (f.t - C.c5) * 0.3, -2.9, 1.85, 0.9);
  }, { tower: false }));
  const c6 = officeShot('c1-tell', C.c6, C.c7, queueSetup((s, f) => {
    const wb = wobble(f.t, 0.03, 12);
    s.aim(-0.2 + wb.x, 2.4 + wb.y, 6.2 - (f.t - C.c6) * 0.2, -1.1, 1.85, 0.5);
  }, { tower: false }));
  const c7 = officeShot('c1-carrying', C.c7, C.c8, queueSetup((s, f) => {
    const k = easeInOutCubic(unlerp(f.t, C.c7, C.c8));
    const wb = wobble(f.t, 0.03, 13);
    s.aim(lerp(0.2, 0.8, k) + wb.x, lerp(2.9, 4.2, k) + wb.y, lerp(7.5, 12.5, k), lerp(-2.2, -2.0, k), lerp(2.2, 3.4, k), lerp(0.6, 0.25, k));
  }, { tower: true }));

  // C8 "I'm just here to help": the whole office waves at him; he waves back from under the
  // pile. Then night falls: everyone goes home, monitors go dark, his stays on.
  function finaleSetup(night: boolean) {
    return (s: OfficeSet) => {
      const pile = Array.from({ length: handTimes.length }, (_, i) => { const b = cardboardBox(0.85, 0.62, 910 + i, i === qMark ? '?' : undefined); s.scene.add(b); return b; });
      const tower = Array.from({ length: stackTimes.length }, (_, i) => { const b = cardboardBox(0.82, 0.6, 930 + i); s.scene.add(b); return b; });
      const wavers = Array.from({ length: 6 }, (_, i) => { const p = standingPerson(900 + i); p.root.scale.setScalar(0.92); s.scene.add(p.root); return p; });
      const puffs = s.stations.map(() => { const p = sparkles(5, 0.6, '#ffffff', 31); s.scene.add(p.group); return p; });
      const term = canvasPlane(1.75, 1.02, 600, (c, f: Frame, Wd, Hd) => {
        c.fillStyle = '#10141f'; c.fillRect(0, 0, Wd, Hd);
        c.font = `700 ${Hd * 0.075}px "DejaVu Sans Mono", monospace`; c.fillStyle = '#7be08d'; c.textBaseline = 'top';
        const lines = ['$ ssh prod', 'welcome, helper', '$ _'];
        const shown = Math.floor(clamp((f.t - 61.75) / 0.4) * 3);
        lines.slice(0, shown).forEach((l, i) => c.fillText(l, Wd * 0.06, Hd * (0.08 + i * 0.12)));
      });
      term.mesh.position.set(HERO.monitorX, HERO.screenY, -0.27);
      s.scene.add(term.mesh);
      return (f: Frame) => {
        pile.forEach((b, i) => { b.position.copy(pileSpot(i)); b.rotation.z = (hash(i, 951) - 0.5) * 0.08; });
        tower.forEach((b, i) => {
          const sway = Math.sin(f.t * 3.1) * 0.035 * (i + 1) * (i + 1) * 0.5;
          b.position.set(-1.75 + sway, DESK_Y + 1.02 + i * 0.6 - 0.02, 0.3 + i * 0.012); b.rotation.z = sway * 0.25 + (hash(i, 961) - 0.5) * 0.06;
        });
        const nk = night ? unlerp(f.t, C.c8b, 61.6) : 0;
        s.stations.forEach((st, i) => {
          if (st === s.hero) { st.person.root.visible = !night || f.t < 60.7; if (!night) st.person.pose(1.0 + Math.sin(f.t * 9) * 0.25, 0, 0); return; }
          const gone = night && hash(i, 991) * 0.85 + 0.05 < nk;
          st.person.root.visible = !gone;
          st.screen.visible = !gone;
          if (!night) st.person.pose(1.0 + Math.sin(f.t * 8 + i) * 0.3, 0, beatHop(f.clock, f.t) * 0.4);
          puffs[i].group.position.set(st.x + 1.25, 2.3, st.z + 0.2);
          puffs[i].update(night ? (nk - (hash(i, 991) * 0.85 + 0.05)) * 1.1 : -1, 0.35);
        });
        // the wavers stand either side of his desk, never in front of him
        wavers.forEach((p, i) => {
          p.root.position.set([-8.2, -6.1, -4.1, 2.9, 4.9, 6.9][i], 0, 2.2 + (i % 2) * 0.4);
          p.root.visible = !night;
          p.pose({ ...STAND, armR: 2.6 + Math.sin(f.t * 9 + i) * 0.35, armL: 0.15, bob: beatHop(f.clock, f.t + i * 0.07) * 0.6 });
        });
        term.update(f);
        term.mesh.visible = night && f.t > 61.6;
        s.clawd.root.position.set(-1.75, DESK_Y, 0.25);
        s.clawd.setMood({ ...MOODS.excited, sweat: 0.4, blush: 0.6 }, f.t);
        s.clawd.setPose(pose({ armL: 2.3, armR: night ? 2.3 : 1.4 + Math.sin(f.t * 10) * 0.5, squash: 0.4 + Math.sin(f.t * 14) * 0.02, lean: Math.sin(f.t * 3.1) * 0.03 }));
        const wb = wobble(f.t, 0.04, 14);
        if (!night) {
          // from a medium on Clawd under his tower, waving, back to the whole office waving at him
          const k = easeInOutCubic(unlerp(f.t, C.c8 + 0.2, C.c8b));
          s.aim(lerp(-1.55, -0.6, k) + wb.x, lerp(3.0, 5.0, k) + wb.y, lerp(6.8, 17, k), lerp(-1.6, -0.6, k), lerp(2.75, 3.1, k), lerp(0.25, -3, k));
        } else {
          const k = easeInOutCubic(unlerp(f.t, 61.0, C.end + 0.1));
          s.aim(lerp(-0.6, HERO.monitorX, k) + wb.x * (1 - k), lerp(4.6, HERO.screenY, k) + wb.y * (1 - k), lerp(15.5, -0.28 + 1.4, k), lerp(-0.6, HERO.monitorX, k), lerp(3.0, HERO.screenY, k), -0.28);
        }
      };
    };
  }
  const c8 = officeShot('c1-help', C.c8, C.c8b, finaleSetup(false));
  const c8b = officeShot('c1-night', C.c8b, C.end, finaleSetup(true));

  return [p1, p2, p3, p4, p5, c1, c1b, c2, c3, c4, c5, c6, c7, c8, c8b];
}

/** Height of a hop between t0 and t1 (0 outside). */
function hop(t: number, t0: number, t1: number, h: number) {
  const k = unlerp(t, t0, t1);
  return k > 0 && k < 1 ? Math.sin(k * Math.PI) * h : 0;
}

/**
 * The DONE-stamp conveyor (chorus 1, and again faster in chorus 2): tickets ride a belt and stop
 * under Clawd's stamp at each of stampTimes; after fastAt he goes manic. Returns a setup factory
 * taking the camera move.
 */
export function conveyorScene(stampTimes: number[], fastAt: number, mood?: (t: number, fast: boolean) => Mood) {
  const SP = 1.55; // ticket spacing
  const beltPos = (t: number) => {
    const T = stampTimes;
    if (t < T[0]) return SP * (-1 + easeInOutCubic(unlerp(t, T[0] - 0.5, T[0] - 0.04)));
    let k = 0;
    while (k + 1 < T.length && T[k + 1] <= t) k++;
    const next = T[k + 1] ?? T[k] + (T[k] - T[k - 1]);
    return SP * (k + easeInOutCubic(unlerp(t, T[k] + 0.06, next - 0.03)));
  };
  function conveyorSetup(cam: (s: OfficeSet, f: Frame, punch: number) => void) {
    return (s: OfficeSet) => {
      const BZ = 2.8, BY = 1.0;
      const belt = new THREE.Group();
      belt.add(inkedRect(22, 0.5, 0.06, '#5d6470', 0.07));
      const lip = shapeMesh(roundedRectShape(22, 0.1, 0.02, 0, 0.2), '#7c8593', 0.004);
      belt.add(lip);
      for (const lx of [-7, -2.5, 2.5, 7]) { const leg = inkedRect(0.3, 0.8, 0.04, '#4a505a', 0.05); leg.position.set(lx, -0.6, -0.05); belt.add(leg); }
      belt.position.set(0, BY - 0.25, BZ - 0.02);
      s.scene.add(belt);
      const rollers = Array.from({ length: 14 }, (_, i) => {
        const r = new THREE.Group();
        r.add(inkedCircle(0.16, '#b9bfc8', 0.04));
        r.add(shapeMesh(roundedRectShape(0.26, 0.05, 0.02), INK, 0.006));
        r.position.set(-10 + i * 1.55, BY - 0.27, BZ + 0.02);
        s.scene.add(r);
        return r;
      });
      const chev = Array.from({ length: 24 }, () => { const c = shapeMesh(roundedRectShape(0.2, 0.06, 0.02), '#8a93a1', 0); s.scene.add(c); return c; });
      // the stool Clawd stands on, behind the belt (the stamp in his right paw lands at x = 0)
      const CX = -0.86, FEET = BY + 0.41;
      const stool = inkedRect(1.2, 0.7, 0.05, '#c48a55', 0.06);
      stool.position.set(CX, FEET - 0.35, BZ - 0.6);
      s.scene.add(stool);
      const tickets = Array.from({ length: stampTimes.length + 6 }, (_, i) => {
        const g = new THREE.Group();
        g.add(inkedRect(1.0, 0.72, 0.03, '#ffffff', 0.05));
        for (let r = 0; r < 3; r++) g.add(Object.assign(shapeMesh(roundedRectShape(0.6 - r * 0.12, 0.05, 0.02, -0.12 + r * 0.06, 0.18 - r * 0.15), '#c9c0b4', 0.004)));
        const scrib = shapeMesh(roundedRectShape(0.3, 0.05, 0.02), '#e0504a', 0.005);
        scrib.position.set(0.25, -0.2, 0); scrib.rotation.z = 0.4 + hash(i, 601);
        g.add(scrib);
        const m = doneMark(0.78, DONE_GREEN, i + 3);
        m.position.set(0.02, 0, 0.012); m.rotation.z = -0.15 + (hash(i, 602) - 0.5) * 0.25;
        g.add(m);
        s.scene.add(g);
        return { g, m };
      });
      const stamp = rubberStamp(0.75);
      s.scene.add(stamp);
      const lines = speedLines(7, 2.2, 11);
      s.scene.add(lines.group);
      const pile = Array.from({ length: 10 }, (_, i) => {
        const p = inkedRect(1.0, 0.1, 0.02, '#ffffff', 0.03);
        const m = shapeMesh(roundedRectShape(0.3, 0.06, 0.02), DONE_GREEN, 0.004); p.add(m);
        p.position.set(7.4 + (hash(i, 611) - 0.5) * 0.2, BY + 0.06 + i * 0.12, BZ);
        p.rotation.z = (hash(i, 612) - 0.5) * 0.2;
        s.scene.add(p);
        return p;
      });
      return (f: Frame) => {
        const sp = beltPos(f.t);
        tickets.forEach((tk, i) => {
          const x = sp - i * SP;
          tk.g.visible = x > -12 && x < 7.2;
          tk.g.position.set(x, BY + 0.36, BZ + 0.1);
          tk.g.rotation.z = x > 6.6 ? (x - 6.6) * 0.6 : 0;
          tk.m.visible = i < stampTimes.length && f.t >= stampTimes[i];
        });
        rollers.forEach(r => { r.rotation.z = -sp / 0.16; });
        chev.forEach((c, i) => { c.position.set(((i * 0.9 + sp) % 21.6) - 10.8, BY - 0.05, BZ + 0.03); });
        const done = stampTimes.filter(x => f.t >= x + 0.35).length;
        pile.forEach((p, i) => { p.visible = i < Math.min(done, 10); });
        // stamp: comes down on each ticket at its stamp time
        let k = 0;
        while (k + 1 < stampTimes.length && stampTimes[k + 1] <= f.t + 0.12) k++;
        const T = stampTimes[k], gap = (stampTimes[k + 1] ?? T + 0.3) - T;
        const dt = f.t - T, down = Math.min(0.1, gap * 0.35);
        let hit = 0;
        if (dt < 0 && dt > -down) hit = Math.pow(1 + dt / down, 2);
        else if (dt >= 0 && dt < 0.04) hit = 1;
        else if (dt >= 0.04) hit = 1 - smooth((dt - 0.04) / Math.max(0.08, gap * 0.55));
        hit = clamp(hit);
        const punch = decay(f.t - T, 0.08) * (f.t >= T ? 1 : 0);
        const fast = f.t > fastAt;
        s.clawd.root.position.set(CX, FEET + (1 - hit) * (fast ? 0.2 : 0.35), BZ - 0.55);
        s.clawd.setMood(mood ? mood(f.t, fast) : fast ? { ...MOODS.excited, blush: 0.7 } : MOODS.excited, f.t);
        s.clawd.setPose(pose({ armR: lerp(1.2, 0, hit), armL: lerp(1.6, 0.8, hit), squash: punch * 0.35 - (1 - hit) * 0.15, lean: fast ? Math.sin(f.t * 21) * 0.04 : 0 }));
        const paw = pawAt(s.clawd, 1, new THREE.Vector3());
        stamp.position.set(paw.x, Math.max(BY + 0.36, paw.y - 0.645), BZ + 0.3);
        stamp.scale.set(0.75 * (1 + punch * 0.15), 0.75 * (1 - punch * 0.15), 0.75);
        lines.group.position.set(-3, BY + 0.4, BZ + 0.5);
        lines.update(fast ? 0.9 : 0, 1, f.t);
        cam(s, f, punch);
      };
    };
  }
  return conveyorSetup;
}
