// Chorus 2 and its break (1:50.2 to 2:18.9). Storyboard rows 41 to 48a. The chorus device again,
// bigger and brighter, with the handler path from verse 1 as the suspect: Clawd slams the coil
// down and it unspools right across the floor, and everything lines up on it: a second gold tag on
// the timeline (he moonwalks back to it), two arrows on one tile of it, every screen tracing its
// route, its photo on the board. In the pause the spotlight follows the cable into the dark to its
// head, reared up like a cobra with the smoking gun on one prong. GOTCHA, giant cuffs. Then, on the
// long held note, the camera follows the cable back the other way, to the tiny Field hiding behind
// the Cache, tied to the tail end. The dancers see it; Clawd, eyes shut mid-victory-dance, doesn't.
// The break: he dances until the Chief walks over with an eyebrow up.
import * as THREE from 'three';
import type { Frame, Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { clamp, decay, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth } from '../../../engine/ease';
import { PAL, aimCam, beamTexture, glowMat, lightMat } from '../look';
import { BOARD, BOOTH_SPOT, FLOOR, PATH_PIN, WALL_Z, aliveFloor, clearBooth, deadFloor, tileCenter, type Club, type ClubState, type Painter } from '../club';
import { ARM_LEN, DiscoClawd, DISCO_MOODS, REST, dance, mixDance, type Pose } from '../clawd-disco';
import { Cache, Field, sp } from '../suspects';
import { Burst, Cuffs, lightPool, sweatDrop } from '../props';
import { FloorLogs, NeonArrow, Revolver, Smoke, Timeline, drawSpotlight, spotScreen } from '../evidence';
import { TraceCoil } from '../lab';
import { Chief, cs } from '../chief';
import { CABLE_R, HandlerPath, ROUTE, SLAM_I, pv, routeCurve } from '../handler-path';
import type { Body } from '../people';
import { ballTurn, onset, waveFloor } from './chorus1';
import { shake, shot } from './common';

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ROUTE_CURVE = routeCurve();

/** A thin glowing thread between two points (the Field's tie to the cable's tail). */
function stringMesh() {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), glowMat(PAL.cyan, 1.8));
}
function stretch(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(1, Math.max(0.001, d.length()), 1);
  m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
}

/** A conductor's baton for a paw, in the arm pivot's frame: the right arm runs along +x (side 1),
 *  the left along -x (side -1). */
function baton(side: 1 | -1 = 1) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.035), glowMat('#fff4fb', 1.3));
  stick.position.set(side * 0.3, 0, 0);
  const tip = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), glowMat(PAL.cyan, 2.6));
  tip.position.set(side * 0.62, 0, 0.001);
  g.add(stick, tip);
  g.position.set(side * (ARM_LEN + 0.02), 0, 0.07);
  return g;
}

/** Comically big handcuffs dangling from Clawd's right paw (hold.rotation keeps them hanging). */
function giantCuffs(c: DiscoClawd) {
  const hold = new THREE.Group();
  hold.position.set(ARM_LEN + 0.04, 0, 0.06);
  const cuffs = new Cuffs(0.36);
  cuffs.root.scale.setScalar(2.1);
  cuffs.root.rotation.z = Math.PI / 2;
  cuffs.root.position.y = -0.38;
  hold.add(cuffs.root);
  c.paw.add(hold);
  /** Call after c.set. size: 0..1+ (they pop out of the afro with an overshoot). */
  return (on: boolean, armR: number, lean: number, sway: number, size = 1) => {
    hold.visible = on && size > 0.01;
    hold.rotation.z = -armR - lean + sway;
    hold.scale.setScalar(Math.max(0.01, size));
  };
}

export function chorus2Shots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const B = (i: number) => {
    if (!Number.isInteger(i)) throw new Error(`chorus 2: B(${i}) needs a whole beat; use BT for a fraction`);
    return audio.beats[i];
  };
  /** A fractional beat's time (between two listed beats). */
  const BT = (b: number) => { const n = Math.floor(b); return lerp(B(n), B(n + 1), b - n); };
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const shots: Shot[] = [];

  // the pause, from the data, as in chorus 1: line 47 ends, a stab, the downbeat, a tick, then
  // "the smoking gun" with the band slamming back in on "gun"
  const FREEZE = lyrics.lines[46].end;
  const STAB = onset(audio, FREEZE, FREEZE + 0.4);
  const SWING = B(260);
  const TICK = onset(audio, SWING + 0.25, SWING + 0.7);
  const IMPACT = audio.hits.impact.find(h => h.t > 124.6 && h.t < 125.4)?.t ?? B(264);
  // the ball turns from the top of this chorus (slowly at first), full speed on "gun"
  const BALL_T = { start: B(232), full: IMPACT, stop: 1e9, halt: 1e9 + 1 };
  const ball = (t: number) => ballTurn(t, BALL_T);

  // the board: on "The" a red X goes over the Cache's photo; on "evidence" the path's photo is
  // slapped on, the strings swing over to it and the ring goes round it. It stays that way after.
  const THE46 = W(46, 0), EVIDENCE = W(46, 1), HAS = W(46, 2), WON = W(46, 3);
  const boardState = (s: ClubState, t: number) => {
    s.boardCacheX = clamp((t - THE46 - 0.04) / 0.22);
    s.boardPath = t < EVIDENCE ? 0 : easeOutBack(clamp((t - EVIDENCE) / 0.16), 2.6);
    s.boardRetarget = easeOutBack(clamp((t - EVIDENCE - 0.12) / 0.3), 1.6);
    s.boardRing = t < THE46 ? 1 : clamp((t - HAS) / 0.35);
  };

  function chorusState(s: ClubState, f: Frame) {
    Object.assign(s, {
      floor: waveFloor(1.6), frozen: 1, alarm: 0.15, pars: 0.95, beams: 0.45, wallLight: 0.85, sign: 0.6,
      terms: 'logs', termT0: 14.6, ball: { angle: ball(f.t), lit: 0.6, sparkle: 0.3 },
      records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardRing: 1, boardLine: 1,
    });
    boardState(s, f.t);
  }
  function partyState(s: ClubState, f: Frame) {
    Object.assign(s, {
      floor: aliveFloor(), frozen: 0, alarm: 0, pars: 1, beams: 1, wallLight: 1, sign: 1,
      terms: 'logs', termT0: 14.6, ball: { angle: ball(f.t), lit: 1, sparkle: 1 },
      records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardLine: 1,
    });
    boardState(s, f.t);
  }

  // The floor lit only along the cable (k 0 = the whole floor alive, 1 = a lit runway of tiles
  // following the cable across a dimmed floor), so the eye follows it from the head to the tail.
  const cableDist: number[] = [];
  for (let iz = 0; iz < FLOOR.nz; iz++) for (let ix = 0; ix < FLOOR.nx; ix++) {
    const c = tileCenter(ix, iz);
    let d = 1e9;
    for (let i = 0; i <= 200; i++) { const p = ROUTE_CURVE.getPointAt(i / 200); d = Math.min(d, Math.hypot(p.x - c.x, p.z - c.z)); }
    cableDist.push(d);
  }
  const runwayFloor = (k: (f: Frame) => number): Painter => {
    const alive = aliveFloor(1.6);
    return (ix, iz, f) => {
      const L = alive(ix, iz, f);
      const dim = k(f) * smooth(clamp((cableDist[iz * FLOOR.nx + ix] - 0.7) / 0.9));
      return { color: L.color, power: L.power * lerp(1, 0.25, dim) };
    };
  };

  // ---- the cast that stays on the floor all chorus ---------------------------------------------
  // The Cache, cleared after chorus 1, sulks at the front right of the floor; the tiny Field hides
  // behind it, tied by a string to the tail of the cable. Nobody looks.
  const CACHE_AT = new THREE.Vector3(4.9, 0, 0.35);
  // hidden straight behind it as seen from the reveal camera (front right); the peek is out to the
  // side, clear of it
  const FIELD_HIDE = new THREE.Vector3(4.67, 0, -0.2);
  const FIELD_PEEK = new THREE.Vector3(3.75, 0, 0.25);
  function sulkCast(scene: THREE.Scene) {
    const ca = new Cache();
    ca.root.position.copy(CACHE_AT);
    const fi = new Field();
    const str = stringMesh();
    scene.add(ca.root, fi.root, str);
    const hole = new THREE.Vector3();
    return (f: Frame, path: HandlerPath, o: { peek?: number; look?: number; open?: number; caLook?: number; squash?: number; gone?: boolean } = {}) => {
      const t = f.t;
      const wag = smooth(clamp((Math.sin(t * 0.8 + 1) - 0.35) * 3));
      ca.set(sp({ shades: 0.85, mouth: -0.6, brow: -0.6, wag, look: o.caLook ?? -0.5, armL: -1.15 }), t);
      const peek = o.peek ?? 0;
      fi.root.position.copy(FIELD_HIDE).lerp(FIELD_PEEK, peek);
      fi.set(sp({ look: o.look ?? 0, open: o.open ?? 1, squash: o.squash ?? 0 }), t);
      // tied on behind the tag's lower corner, clear of the "v": 2
      hole.set(fi.root.position.x - 0.2, 0.17, fi.root.position.z - 0.03);
      stretch(str, path.tail, hole);
      // (once it has ducked for good it would still show between the Cache's legs)
      fi.root.visible = str.visible = !o.gone;
    };
  }

  /** Dancers out of the cable's way where it matters (the head end, the Cache's corner). */
  const nearCobra = (club: Club, i: number, r = 1.4) => Math.hypot(club.dancers[i].x - COBRA_AT.x, club.dancers[i].z - COBRA_AT.z) < r;
  const CL_MID = new THREE.Vector3(0, 0, -0.6);
  const SLAM_AT = new THREE.Vector3(ROUTE[SLAM_I][0], 0, ROUTE[SLAM_I][1]);
  // the reared head's spot on the floor (the neck rises off the end of ROUTE toward the back left)
  const COBRA_AT = new THREE.Vector3(-3.84, 0, -5.0);

  // 41. "The logs are lining up now": the music lands and Clawd spikes the coil onto the floor; it
  //     bursts and unspools both ways, a glowing cable right across the floor, and the logs snap
  //     into rows round it, twice as fast as in chorus 1.
  const ROW_Z = [-6, -5, -4, -3, -2, -1, 0, 1];
  const SLAM = B(232) + 0.07;
  const unspool = (t: number) => easeOutCubic(clamp((t - SLAM) / 0.5));
  const packetsOn = (t: number) => clamp((t - SLAM - 0.5) / 0.4);
  shots.push(shot('c41-logs', B(232), B(236), ({ scene, camera }) => {
    const logs = new FloorLogs(ROW_Z);
    const path = new HandlerPath();
    const coil = new TraceCoil();
    const c = new DiscoClawd();
    const thud = new Burst(PAL.cyan, 14);
    thud.root.position.set(SLAM_AT.x, 0.08, SLAM_AT.z);
    thud.root.rotation.x = -Math.PI / 2;
    const sulk = sulkCast(scene);
    scene.add(logs.root, path.root, coil.root, c.root, thud.root);
    const paw = new THREE.Vector3();
    return (f, s) => {
      chorusState(s, f);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.7, 0.3, k), lerp(8.0, 7.2, k), lerp(8.8, 7.6, k), 0.3, 0.3, lerp(-2.3, -2.0, k));
      // rows snap in on the sixteenths from "lining"
      const snapAt = (i: number) => BT(233 + i * 0.25);
      logs.set(f.t, B(231), i => easeOutBack(clamp((f.t - snapAt(i)) / 0.12), 1.8), i => decay(f.t - snapAt(i), 0.16));
      path.set(f.t, pv({ reveal: unspool(f.t), open: 0, packets: packetsOn(f.t) }));
      thud.set(f.t - SLAM, 2.4);
      // Clawd: the spike (arm whips down), then into the point
      const b = f.clock.beat(f.t);
      const spike = clamp((f.t - B(232)) / 0.07);
      const after = f.t - SLAM;
      const dn = dance('point', b, clamp((b - 232.6) / 0.5));
      const settle = smooth(clamp((b - 232.5) / 0.6));
      const armR = lerp(lerp(1.3, -0.7, easeOutCubic(spike)), dn.pose.armR, settle);
      const lean = lerp(0.18 * spike, dn.pose.lean, settle);
      c.root.position.set(CL_MID.x + dn.x * settle, 0, CL_MID.z);
      c.set(after < 0.4 ? DISCO_MOODS.certain : DISCO_MOODS.excited, P({ ...dn.pose, armR, armL: lerp(0.4, dn.pose.armL, settle), lean, squash: 0.35 * decay(after, 0.12) + dn.pose.squash * settle }), { shades: 1, jiggle: dn.jiggle * settle + Math.sin(after * 30) * decay(after, 0.2), puff: 0.4 }, f.t);
      // the coil: from his paw to the floor, gone on the slam
      coil.set(f.t, 0, 1);
      coil.root.visible = f.t < SLAM;
      if (coil.root.visible) {
        scene.updateMatrixWorld();
        c.paw.getWorldPosition(paw);
        coil.root.position.copy(paw).lerp(new THREE.Vector3(SLAM_AT.x, 0.25, SLAM_AT.z), easeOutCubic(spike));
        coil.root.rotation.x = -1.2 * spike;
      }
      sulk(f, path);
    };
  }));

  // 42. "The timeline makes it clear": the timeline slides back in along the wall, faster, the
  //     red X already there from last time; and on "clear" a second gold tag pops up, further
  //     back than the deploy: "path refactor". Clawd points up at it from the floor.
  const TL = new THREE.Vector3(0, 8.05, WALL_Z + 0.42);
  const TAG2 = { x: 0.75, text: 'path refactor', dir: -1 as const };
  const CLEAR = W(42, 4);
  const tlSlide = (t: number) => lerp(30, 0, easeOutCubic(clamp((t - B(236) + 0.12) / 0.55))) - (t - B(236)) * 0.22;
  const ONE43 = W(43, 0), BEFORE43 = W(43, 2), THE43 = W(43, 3), FAILURE = W(43, 4);
  const tag2Pop = (t: number) => (t < CLEAR ? 0 : easeOutBack(clamp((t - CLEAR) / 0.2), 2.4));
  const crossAt = (t: number) => (t >= FAILURE ? t - FAILURE : 9);
  shots.push(shot('c42-timeline', B(236), B(240), ({ scene, camera }) => {
    const tl = new Timeline([TAG2]);
    tl.root.position.copy(TL);
    const c = new DiscoClawd();
    const CL = new THREE.Vector3(-1.7, 0, -1.2);
    const path = new HandlerPath();
    scene.add(tl.root, c.root, path.root);
    return (f, s) => {
      chorusState(s, f);
      const k = easeInOutCubic(f.p);
      // wide from the floor, then on "clear" a snap zoom up onto the two tags
      const zoom = easeInOutCubic(clamp((f.t - CLEAR) / 0.3));
      const tags = TL.x + tlSlide(f.t) + 1.1;
      aimCam(camera, lerp(-1.4, -0.7, k), lerp(0.95, 1.05, k), lerp(5.6, 5.1, k), lerp(lerp(-0.6, 0.2, k), tags, zoom), lerp(4.85, 8.75, zoom), WALL_Z);
      camera.fov = lerp(46, 15, zoom);
      camera.updateProjectionMatrix();
      s.sign = clamp((f.t - B(236)) / 0.3) < 1 ? 0.55 : 0.08;
      // markers pop left to right on the eighths, everything already known
      tl.set(f.t, { slide: tlSlide(f.t), pop: j => clamp((f.t - BT(236.25 + j * 0.125)) / 0.15), tag: 0.45, cross: crossAt(f.t), extra: [{ size: tag2Pop(f.t), glow: 0.45 + 0.7 * decay(f.t - CLEAR, 0.25) }] });
      path.set(f.t, pv({ open: 0 }));
      const dn = dance('point', f.clock.beat(f.t), 1);
      const pointUp = smooth(clamp((f.t - CLEAR + 0.1) / 0.15));
      c.root.position.set(CL.x + dn.x * (1 - pointUp), 0, CL.z);
      c.set(pointUp > 0.5 ? DISCO_MOODS.certain : DISCO_MOODS.excited, P({ ...dn.pose, armR: lerp(dn.pose.armR, 1.25, pointUp), armL: lerp(dn.pose.armL, -0.6, pointUp), lean: lerp(dn.pose.lean, -0.12, pointUp) }), { shades: 1, jiggle: dn.jiggle * (1 - pointUp), puff: 0.5 }, f.t);
    };
  }, { fov: 46 }));

  // 43. "One change before the failure": up on the timeline itself, a little Clawd moonwalks back
  //     along the line, through the X and under the deploy tag, to the new tag; he points up at it,
  //     and on "failure" the X slams down again behind him and he points back at it too.
  const MW = 0.48;   // Clawd's scale up on the line: small enough that his afro fits between the two flags' text
  shots.push(shot('c43-moonwalk', B(240), B(243), ({ scene, camera }) => {
    const tl = new Timeline([TAG2]);
    tl.root.position.copy(TL);
    const c = new DiscoClawd();
    // scaled through a holder: the rig's set() resets root.scale for its paper-puppet turn
    const holder = new THREE.Group();
    holder.scale.setScalar(MW);
    holder.add(c.root);
    scene.add(tl.root, holder);
    return (f, s) => {
      chorusState(s, f);
      s.sign = 0.08;
      const slide = tlSlide(f.t);
      const k = easeInOutCubic(f.p);
      // drifting left with the moonwalk, and pushing in only so far that the new tag's text (on the
      // left) and the X (on the right) both stay in shot when he points at one and then the other
      const mid = TL.x + slide + lerp(2.25, 1.8, k);
      aimCam(camera, mid + lerp(0.5, 0.15, k), lerp(8.25, 8.35, k), lerp(-4.1, -4.7, k), mid, 8.75, WALL_Z);
      shake(camera, f, FAILURE, 0.06, 0.2);
      // the new tag lights up as he points at it (a small swell: it grows from its pole, off to the left)
      tl.set(f.t, { slide, pop: () => 1, tag: 0.45, cross: crossAt(f.t), extra: [{ size: 1 + 0.08 * decay(f.t - THE43, 0.25), glow: 0.45 + 0.6 * decay(f.t - THE43, 0.3) }] });
      // the glide: from past the X back to between the two poles, feet sliding the other way
      const u = clamp((f.t - (B(240) - 0.05)) / (THE43 - B(240) + 0.05));
      const glide = smooth(u);
      const lx = lerp(Timeline.X_X + 0.7, 1.11, glide);
      const moving = u > 0 && u < 1;
      holder.position.set(TL.x + slide + lx, TL.y + 0.07, TL.z + 0.17);
      const b = f.clock.beat(f.t);
      const arrive = clamp((f.t - THE43) / 0.12);
      const back = clamp((f.t - FAILURE) / 0.12);
      const pose = moving
        ? P({ walk: -b * 1.0, lean: 0.16, armR: 0.25 + 0.15 * Math.sin(b * Math.PI * 2), armL: -0.55, squash: 0.06 * Math.sin(b * Math.PI * 4) })
        : P({ armL: lerp(0.3, 1.1, arrive), armR: lerp(-0.4, 0.15, back), lean: lerp(0.16, -0.05, arrive) - 0.08 * back, squash: 0.25 * decay(f.t - THE43, 0.1) + 0.2 * decay(f.t - FAILURE, 0.1) });
      c.set(back > 0 ? DISCO_MOODS.certain : DISCO_MOODS.smug, { ...pose, turn: moving ? 0.5 : 0 }, {
        shades: 1, puff: 0.5 + 0.3 * back, jiggle: Math.sin((f.t - FAILURE) * 26) * decay(f.t - FAILURE, 0.25) + (moving ? 0.3 * Math.sin(b * Math.PI * 2) : 0),
      }, f.t);
    };
  }));

  // 44. "One signal pointing here": two neon arrows now, cyan and pink, flicker on either side of
  //     one tile on the cable, spin round in opposite directions and both stop dead pointing at
  //     it; Clawd hops on, and the whole cable flares.
  const TILE_IJ: [number, number] = [5, 5];
  const TILE2 = tileCenter(...TILE_IJ);
  const ARROWS = [
    { at: new THREE.Vector3(TILE2.x - 2.8, 4.3, TILE2.z - 0.2), color: PAL.cyan, dir: -1 },
    { at: new THREE.Vector3(TILE2.x + 2.8, 4.55, TILE2.z - 0.4), color: PAL.pink, dir: 1 },
  ];
  const ON44 = W(44, 0), SPIN44 = W(44, 1), HERE = W(44, 3);
  const SETTLE = HERE - 0.06;
  const HOP0 = HERE - 0.12, HOP1 = B(246);
  const arrowAngle = (at: THREE.Vector3, dir: number, t: number) => {
    const end = Math.atan2(0.3 - at.y, TILE2.x - at.x);
    if (t < SPIN44) return end + dir * 3 * Math.PI;
    if (t < SETTLE) return end + dir * 3 * Math.PI * (1 - easeOutCubic((t - SPIN44) / (SETTLE - SPIN44)));
    return end + 0.2 * Math.sin((t - SETTLE) * 24) * decay(t - SETTLE, 0.16);
  };
  shots.push(shot('c44-arrows', B(243), B(247), ({ scene, camera, club }) => {
    const arrows = ARROWS.map(a => {
      const n = new NeonArrow(a.color);
      n.root.position.copy(a.at);
      scene.add(n.root);
      return n;
    });
    const shaftMat = lightMat(PAL.gold, 0, beamTexture());
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 4.6), shaftMat);
    shaft.position.set(TILE2.x, 2.3, TILE2.z - 0.12); // behind Clawd once he lands, not level
    const path = new HandlerPath();
    const c = new DiscoClawd();
    const FROM = new THREE.Vector3(TILE2.x + 2.3, 0, TILE2.z + 0.9);
    const land = new Burst(PAL.gold, 12);
    land.root.position.set(TILE2.x, 0.12, TILE2.z + 0.4);
    scene.add(shaft, path.root, c.root, land.root);
    return (f, s) => {
      chorusState(s, f);
      const k = easeInOutCubic(f.p);
      aimCam(camera, TILE2.x + lerp(0.6, 0.8, k), lerp(3.0, 2.9, k), TILE2.z + lerp(11.0, 10.0, k), TILE2.x + 0.1, 2.1, TILE2.z - 0.5);
      shake(camera, f, HOP1, 0.05, 0.15);
      s.sign = 0.35;
      // nobody between us and the tile
      s.crowdMask = i => !(Math.abs(club.dancers[i].x - TILE2.x) < 2.7 && club.dancers[i].z > TILE2.z - 1.6);
      const pointed = f.t >= HERE;
      // on "here" the chosen tile blazes white-gold and the rest of the floor drops away round it
      const wave = waveFloor(1.6), spot = clamp((f.t - HERE) / 0.1);
      s.floor = (ix, iz, ff) => {
        if (ix === TILE_IJ[0] && iz === TILE_IJ[1] && spot > 0) return { color: '#fff1b0', power: lerp(1.2, 1.6, spot) * (0.92 + 0.08 * Math.sin(ff.t * 8)) };
        const L = wave(ix, iz, ff);
        return spot > 0 ? { color: L.color, power: L.power * lerp(1, 0.45, spot) } : L;
      };
      const b = f.clock.beat(f.t);
      arrows.forEach((n, i) => n.set(f.t, clamp((f.t - ON44 - i * 0.12) / 0.3), b * 4 + i * 1.5, arrowAngle(ARROWS[i].at, ARROWS[i].dir, f.t)));
      shaftMat.opacity = pointed ? 0.22 * clamp((f.t - HERE) / 0.08) : 0;
      const landed = f.t - HOP1;
      path.set(f.t, pv({ open: 0, glow: 1 + 1.4 * decay(landed, 0.3) }));
      // Clawd side-steps in watching the arrows, then hops onto the tile on "here"
      const u = clamp((f.t - HOP0) / (HOP1 - HOP0));
      const e = easeInOutCubic(u);
      const dn = dance('side', b, 0.8);
      if (f.t < HOP0) c.root.position.set(FROM.x + dn.x, 0, FROM.z);
      else c.root.position.set(lerp(FROM.x, TILE2.x, e), Math.sin(u * Math.PI) * 0.9, lerp(FROM.z, TILE2.z, e));
      let pose = dn.pose;
      if (f.t >= HOP0) pose = P({ armL: lerp(0.4, 1.0, u), armR: lerp(0.4, 1.0, u), squash: -0.25 * Math.sin(u * Math.PI) });
      if (landed >= 0) pose = P({ armR: 1.15, armL: 1.15, lean: 0, squash: 0.35 * decay(landed, 0.1) });
      c.set(landed >= 0 ? DISCO_MOODS.triumphant : DISCO_MOODS.excited, pose, { shades: 1, jiggle: landed >= 0 ? Math.sin(landed * 30) * decay(landed, 0.2) : dn.jiggle, puff: landed >= 0 ? 0.8 : 0.4 }, f.t);
      land.set(landed, 1.2);
    };
  }));

  // 45. "The traces tell the same story": the booth. Every screen draws a route of its own until,
  //     on "same", they all snap to the one route, the cable's, in step. Clawd conducts with a
  //     baton in each paw.
  const SAME = W(45, 4);
  const CONDUCT = [-0.35, 1.05, 0.25, 1.45];
  const conduct = (b: number) => {
    const n = Math.floor(b), ph = b - n;
    const a = CONDUCT[((n % 4) + 4) % 4], z = CONDUCT[(((n + 1) % 4) + 4) % 4];
    return lerp(a, z, easeInOutCubic(clamp((ph - 0.15) / 0.85))) - 0.12 * decay(ph, 0.06);
  };
  // (it cuts to the board on "The", the pickup on the half beat before the bar)
  const BOARD_CUT = BT(251.5);
  shots.push(shot('c45-traces', B(247), BOARD_CUT, ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    c.paw.add(baton());
    c.pawL.add(baton(-1));
    scene.add(c.root);
    return (f, s) => {
      chorusState(s, f);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(-0.3, 0.2, k), lerp(3.45, 3.1, k), lerp(-2.0, -3.9, k), 0, lerp(2.95, 2.75, k), -9);
      s.crowdMask = clearBooth;
      s.terms = 'route'; s.termT0 = B(247) - 0.15;
      s.termSync = clamp((f.t - SAME + 0.05) / 0.25);
      const b = f.clock.beat(f.t);
      const big = 1 + 0.5 * clamp((f.t - SAME) / 0.3);
      const armR = conduct(b) * big, armL = conduct(b + 0.5) * big;
      c.set(f.t >= SAME ? DISCO_MOODS.smug : DISCO_MOODS.focused, P({ armR, armL, lean: 0.06 * Math.sin(b * Math.PI), squash: 0.12 * decay(b - Math.floor(b), 0.08) }), { shades: 1, jiggle: Math.sin(b * Math.PI * 2) * 0.5, puff: 0.4 + 0.4 * clamp((f.t - SAME) / 0.3) }, f.t);
    };
  }));

  // 46. "The evidence has won": at the board a red X goes over the Cache's photo; on "evidence"
  //     Clawd slaps up a new polaroid (the dusty coil, tag and all), the strings swing over to it
  //     and snap taut, and the ring goes round it. Cut on "won" to the meter: the needle slams so
  //     far past the red it boings, and Clawd's afro puffs up bigger than it ever has.
  const CL_BOARD = new THREE.Vector3(8.0, 0, -8.3);
  shots.push(shot('c46-board', BOARD_CUT, WON, ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_BOARD);
    const pool = lightPool(1.3, '#ffe9c4', 0.35);
    pool.position.set(CL_BOARD.x, 0.02, CL_BOARD.z);
    const slap = new Burst(PAL.gold, 12);
    // on the new photo (PATH_PIN on the board)
    slap.root.position.set(BOARD.x - BOARD.w / 2 + PATH_PIN[0] * BOARD.w, BOARD.y + BOARD.h / 2 - PATH_PIN[1] * BOARD.h, WALL_Z + 0.3);
    scene.add(c.root, pool, slap.root);
    return (f, s) => {
      chorusState(s, f);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(8.55, 8.85, k), lerp(2.2, 2.35, k), lerp(-0.6, -1.9, k), 9.7, lerp(2.7, 2.85, k), WALL_Z);
      s.boardTwang = decay(f.t - (EVIDENCE + 0.4), 0.18) + decay(f.t - HAS, 0.16);
      // he reaches up and slaps the photo on, then points at it
      const reach = smooth(clamp((f.t - (EVIDENCE - 0.2)) / 0.18));
      const down = smooth(clamp((f.t - (EVIDENCE + 0.12)) / 0.25));
      const armR = lerp(lerp(0.4, 1.45, reach), 0.95, down);
      c.set(f.t >= HAS ? DISCO_MOODS.certain : DISCO_MOODS.smug, P({ armR, armL: -0.5, lean: -0.08 * reach, squash: 0.18 * decay(f.t - EVIDENCE, 0.1) + 0.15 * decay(f.t - HAS, 0.1) }), { shades: 1, puff: 0.6 + 0.5 * down }, f.t);
      slap.set(f.t - EVIDENCE, 1.4);
    };
  }));
  shots.push(shot('c46-won', WON, B(256), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    const pop = new Burst(PAL.gold, 14);
    pop.root.position.set(BOOTH_SPOT.x, BOOTH_SPOT.y + 2.5, BOOTH_SPOT.z + 0.3);
    scene.add(c.root, pop.root);
    return (f, s) => {
      chorusState(s, f);
      const k = easeOutCubic(f.p);
      aimCam(camera, lerp(-3.5, -3.3, k), lerp(2.05, 2.15, k), lerp(-4.3, -4.8, k), -1.25, 2.05, -9.0);
      shake(camera, f, WON, 0.08, 0.25);
      s.crowdMask = clearBooth;
      const dt = f.t - WON;
      // the needle swings right past the end stop and boings there
      s.meter = 1;
      s.meterOver = dt < 0 ? 0 : 0.55 * easeOutCubic(clamp(dt / 0.08)) + 0.22 * Math.sin(dt * 34) * decay(dt, 0.35);
      s.beams = 0.6;
      const up = easeOutBack(clamp(dt / 0.18), 2);
      c.set(DISCO_MOODS.triumphant, P({ armL: lerp(0.3, 1.3, up), armR: lerp(0.3, 1.3, up), squash: 0.3 * decay(dt, 0.1) - 0.1 * up, bounce: 0.15 * Math.sin(clamp(dt / 0.3) * Math.PI) }), { shades: 1, puff: lerp(0.8, 2.6, easeOutBack(clamp(dt / 0.3), 2)), medal: decay(dt, 0.5), jiggle: Math.sin(dt * 18) * decay(dt, 0.3) }, f.t);
      pop.set(dt - 0.05, 2.8);
    };
  }));

  // 47. "I think we finally found it": the same slow push in on Clawd under the ball, the cable at
  //     his feet. He reaches into his afro on "finally" and on "found" pulls out handcuffs twice
  //     the size of last time's. The frame freezes on "it" and on the stab the club goes dark but
  //     for one spotlight on him.
  const LAMP = new THREE.Vector3(0.6, 10.6, -2.9);
  const REACH = W(47, 3), FOUND = W(47, 4), IT = W(47, 5);
  const midCam = (cam: THREE.PerspectiveCamera, k: number) =>
    aimCam(cam, 0, lerp(2.9, 1.62, k), lerp(8.6, CL_MID.z + 3.9, k), 0, lerp(2.2, 1.45, k), lerp(-2.0, CL_MID.z, k));
  const cuffSize = (t: number) => (t < FOUND ? 0 : easeOutBack(clamp((t - FOUND) / 0.3), 2.2));
  let c47cam: THREE.PerspectiveCamera | null = null;
  shots.push(shot('c47-found', B(256), SWING, ({ scene, camera }) => {
    c47cam = camera;
    const c = new DiscoClawd();
    c.root.position.copy(CL_MID);
    const cuffsAt = giantCuffs(c);
    const pool = lightPool(1.5, '#ffe9d0', 0.4);
    pool.position.set(CL_MID.x, 0.03, CL_MID.z);
    const path = new HandlerPath();
    const sulk = sulkCast(scene);
    scene.add(c.root, pool, path.root);
    return (f, s, now) => {
      // the push runs until the freeze, then a quick punch in on the frozen frame
      const k = easeInOutCubic(clamp((f.t - B(256)) / (FREEZE - B(256))));
      midCam(camera, k);
      camera.position.z -= easeOutCubic(clamp((now.t - STAB) / 0.07)) * 0.55;
      Object.assign(s, {
        floor: deadFloor(0.75), frozen: 1, alarm: 0.15, pars: 0.12, beams: 0, wallLight: 0.25, sign: 0.6,
        blackout: now.t >= STAB ? 1 : 0,
        terms: 'logs', termT0: 14.6, ball: { angle: ball(f.t), lit: 0.9, sparkle: 0.85 },
        records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardLine: 1,
      });
      boardState(s, f.t);
      path.set(f.t, pv({ open: 0, glow: 0.8 }));
      const b = f.clock.beat(f.t);
      // groove, reach up into the afro on "finally", haul the giant cuffs out on "found"
      const reach = smooth(clamp((f.t - (REACH - 0.1)) / 0.22));
      const pull = easeOutBack(clamp((f.t - FOUND) / 0.3), 1.6);
      const dig = Math.sin(f.t * 30) * 0.08 * reach * (1 - pull);
      const dn = dance('groove', b, 0.4 * (1 - reach));
      const armR = lerp(lerp(dn.pose.armR, 1.5, reach) + dig, 0.75, pull);
      const lean = dn.pose.lean * (1 - reach) - 0.05 * pull;
      c.root.position.set(CL_MID.x + dn.x * (1 - reach), 0, CL_MID.z);
      c.set(f.t >= FOUND ? DISCO_MOODS.smug : DISCO_MOODS.focused, P({ ...dn.pose, armR, armL: lerp(dn.pose.armL, -0.55, reach), lean, squash: 0.15 * decay(f.t - FOUND, 0.1) }), { shades: 1, jiggle: dn.jiggle * (1 - reach) + 0.4 * reach * (1 - pull) * Math.sin(f.t * 30), puff: 0.4 + 0.5 * pull, medal: decay(f.t - IT, 0.4) }, f.t);
      cuffsAt(f.t >= FOUND, armR, lean, 0.25 * Math.sin((f.t - FOUND) * 7) * decay(f.t - FOUND, 0.6), cuffSize(f.t));
      sulk(f, path);
    };
  }, {
    freeze: FREEZE,
    overlay(g, f) {
      if (f.t >= STAB && c47cam) {
        c47cam.updateMatrixWorld();
        drawSpotlight(g, f.w, f.h, spotScreen(c47cam, f.w, f.h, CL_MID, 0.9, 2.2, LAMP), 0.85, 1);
      }
    },
  }));

  // 48. "The smoking gun": on the downbeat the spotlight leaves him and runs along the glowing
  //     cable into the dark, the camera crash-zooming after it, and on the tick it lands on the
  //     cable's head, reared up like a cobra, twirling a smoking revolver on one prong. Caught,
  //     it freezes, eyes wide. On "gun" the lights slam on and it bolts upright, hands-up style;
  //     Clawd knee-slides in and clamps the giant cuffs round its neck. The gun slides off.
  const CUFF_T = B(266);
  const SLIDE0 = IMPACT + 0.2, SLIDE1 = IMPACT + 0.75;
  // Clawd ends up to the cobra's right, flipped so the paw with the cuffs is on its side
  const CL_CUFF = new THREE.Vector3(COBRA_AT.x + 1.7, 0, COBRA_AT.z + 0.6);
  // where the dropped gun comes to rest
  const GUN_REST = new THREE.Vector3(COBRA_AT.x - 0.75, 0.06, COBRA_AT.z + 0.45);
  let c48cam: THREE.PerspectiveCamera | null = null;
  // where the slam point sits along the whole run (the spotlight picks the cable up there)
  let uSlam = 0;
  for (let i = 0, best = 1e9; i <= 400; i++) {
    const d = ROUTE_CURVE.getPointAt(i / 400).distanceTo(new THREE.Vector3(SLAM_AT.x, CABLE_R, SLAM_AT.z));
    if (d < best) { best = d; uSlam = i / 400; }
  }
  const spotFollow = (t: number) => {
    const u = easeInOutCubic(clamp((t - SWING) / (TICK - SWING)));
    const onCable = ROUTE_CURVE.getPointAt(lerp(uSlam, 1, clamp((u - 0.08) / 0.84)));
    const p = CL_MID.clone().lerp(onCable.setY(0), smooth(clamp(u / 0.12)));
    p.lerp(COBRA_AT, smooth(clamp((u - 0.85) / 0.15)));
    const over = t > TICK ? 0.12 * Math.sin((t - TICK) * 30) * decay(t - TICK, 0.08) : 0;
    p.x += over;
    return p;
  };
  // the camera: a crash zoom from wide on the dark club to the cobra, arriving on the tick, a slow
  // push on the reveal, then (with the lights) back out to a two-shot for the arrest
  const WIDE = [new THREE.Vector3(1.2, 4.6, 9.6), new THREE.Vector3(-1.2, 1.2, -3.0)];
  const NEAR = [new THREE.Vector3(COBRA_AT.x + 1.2, 2.25, COBRA_AT.z + 6.0), new THREE.Vector3(COBRA_AT.x, 2.15, COBRA_AT.z)];
  const TWO = [new THREE.Vector3(COBRA_AT.x + 2.7, 2.45, COBRA_AT.z + 9.0), new THREE.Vector3(COBRA_AT.x + 0.85, 1.75, COBRA_AT.z)];
  const gunCam = (cam: THREE.PerspectiveCamera, t: number) => {
    const z = easeInOutCubic(clamp((t - SWING - 0.05) / (TICK - SWING - 0.05)));
    const p = WIDE[0].clone().lerp(NEAR[0], z), tg = WIDE[1].clone().lerp(NEAR[1], z);
    p.addScaledVector(tg.clone().sub(p).normalize(), easeInOutCubic(clamp((t - TICK) / (IMPACT - TICK))) * 0.6);
    const out = easeInOutCubic(clamp((t - IMPACT) / 0.5));
    p.lerp(TWO[0], out);
    tg.lerp(TWO[1], out);
    aimCam(cam, p.x, p.y, p.z, tg.x, tg.y, tg.z);
    shake(cam, { t } as Frame, TICK, 0.05, 0.12);
    shake(cam, { t } as Frame, IMPACT, 0.12, 0.3);
  };
  /** The cobra's pose over the pause and the arrest. */
  // it's still twirling the gun when the light lands; a beat later it notices and stops dead,
  // the gun back to barrel-up (a whole number of turns), wobbling
  const STOP_TW = TICK + 0.3;
  const TURNS = Math.max(1, Math.round((13 * (STOP_TW - SWING)) / (Math.PI * 2))) * Math.PI * 2;
  const cobraView = (t: number) => {
    const caught = t - STOP_TW, up = t - IMPACT, cuffed = t - CUFF_T;
    const spin = caught < 0 ? TURNS * (clamp((t - SWING) / (STOP_TW - SWING)) - 1) : 0.5 * Math.sin(caught * 12) * decay(caught, 0.25);
    const droop = smooth(clamp((cuffed - 0.15) / 0.5));
    const shiftyEyes = caught > 0.35 && up < 0 ? Math.sign(Math.sin((t - TICK) * 5.5)) * 0.8 : 0;
    return pv({
      rear: 1 - 0.4 * droop, up: up < 0 ? 0 : easeOutBack(clamp(up / 0.14), 2) * (1 - droop), sway: up < 0 ? 0.5 : 0,
      look: up >= 0 ? 0 : shiftyEyes, open: cuffed >= 0 ? lerp(1.2, 0.45, droop) : caught >= 0 ? 1.35 : 1,
      shifty: up < 0 && caught > 0.35 ? 1 : 0, gun: cuffed < 0.08, twirl: spin, glow: 1.15,
    });
  };
  shots.push(shot('c48-gun', SWING, B(268), ({ scene, camera, club }) => {
    c48cam = camera;
    const path = new HandlerPath();
    const smoke = new Smoke();
    const dropped = new Revolver();
    dropped.root.scale.setScalar(0.82);
    const c = new DiscoClawd();
    const cuffsAt = giantCuffs(c);
    const onNeck = new Cuffs(0.36);
    onNeck.root.scale.setScalar(2.1);
    const snap = new Burst(PAL.cyan, 12);
    const sulk = sulkCast(scene);
    scene.add(path.root, smoke.root, dropped.root, c.root, onNeck.root, snap.root);
    const muzzle = new THREE.Vector3(), neck = new THREE.Vector3(), nd = new THREE.Vector3();
    return (f, s) => {
      gunCam(camera, f.t);
      const lights = f.t >= IMPACT;
      if (lights) {
        partyState(s, f);
        s.crowdFrozen = () => 1;   // the dancers don't believe it yet
      } else {
        Object.assign(s, {
          floor: deadFloor(0.6), frozen: 1, alarm: 0, pars: 0, beams: 0, wallLight: 0, sign: 0, blackout: 1,
          terms: 'off', ball: { angle: ball(f.t), lit: 0.15, sparkle: 0 }, records: { spin: f.t * 4.7, label: '/checkout' },
          boardStrings: 1, boardFocus: 1, boardLine: 1,
        });
        boardState(s, f.t);
      }
      s.crowdMask = i => !nearCobra(club, i, 2.6) && !(club.dancers[i].x < -1 && club.dancers[i].z > -3.2 && club.dancers[i].x > -4.6);
      const v = cobraView(f.t);
      path.set(f.t, v);
      scene.updateMatrixWorld();
      path.gun.muzzle.getWorldPosition(muzzle);
      smoke.set(f.t, muzzle, SWING - 2, f.t < CUFF_T ? 1 : 0, camera);
      // the gun: slides off the prong once it's cuffed, drops, bounces once
      const fall = f.t - (CUFF_T + 0.08);
      dropped.root.visible = fall >= 0;
      if (fall >= 0) {
        const y0 = muzzle.y - 0.2, land = Math.sqrt(Math.max(0.01, y0) / 4.9);
        const y = fall < land ? y0 - 4.9 * fall * fall : 0.06 + Math.abs(Math.sin((fall - land) * 10)) * 0.16 * decay(fall - land, 0.12);
        dropped.root.position.set(lerp(COBRA_AT.x - 0.2, GUN_REST.x, easeOutCubic(clamp(fall / (land + 0.3)))), Math.max(0.06, y), GUN_REST.z);
        dropped.root.rotation.z = fall < land ? -1.4 + fall * 8 : 0.1;
      }
      // the giant cuffs, round the neck from the moment he slaps them on
      const cuffed = f.t >= CUFF_T;
      onNeck.root.visible = cuffed;
      if (cuffed) {
        path.neckAt(0.72, neck);
        path.neckDir(0.72, nd);
        onNeck.root.position.copy(neck).add(new THREE.Vector3(-0.38, -0.05, 0.08));
        onNeck.root.rotation.z = 0.25 + 0.15 * Math.sin((f.t - CUFF_T) * 8) * decay(f.t - CUFF_T, 0.4);
      }
      snap.root.position.copy(neck).add(new THREE.Vector3(0, 0, 0.2));
      snap.set(f.t - CUFF_T, 1.2);
      // Clawd: where the light left him until the lights are up, then the knee slide in from the
      // right, flipped to face the cobra with the cuffs, and the clamp
      const glide = clamp((f.t - SLIDE0) / (SLIDE1 - SLIDE0));
      const slide = easeOutCubic(glide);
      const popUp = clamp((f.t - SLIDE1) / 0.18);
      const kneel = glide > 0 && popUp < 1 ? 1 - smooth(popUp) : 0;
      c.root.visible = f.t < TICK || f.t >= SLIDE0;
      if (f.t < SLIDE0) {
        c.root.position.copy(CL_MID);
        c.set(DISCO_MOODS.smug, P({ armR: 0.75, armL: -0.55, lean: -0.05 }), { shades: 1, puff: 0.9 }, f.t);
        cuffsAt(true, 0.75, -0.05, 0);
      } else {
        c.root.position.set(lerp(CL_CUFF.x + 3.8, CL_CUFF.x, slide), 0.12 * Math.sin(smooth(popUp) * Math.PI), CL_CUFF.z);
        const slap = clamp((f.t - (CUFF_T - 0.12)) / 0.12);
        const after = clamp((f.t - CUFF_T) / 0.2);
        const cArmR = cuffed ? lerp(0.6, 1.2, after) : lerp(lerp(1.3, 0.8, smooth(popUp)), 0.55, slap);
        const cArmL = cuffed ? lerp(0.4, 1.1, after) : lerp(1.25, 0.2, smooth(popUp));
        const cLean = -0.16 * kneel + 0.12 * slap * (1 - clamp((f.t - CUFF_T) / 0.3));
        c.set(cuffed ? DISCO_MOODS.triumphant : DISCO_MOODS.certain, { ...P({ armR: cArmR, armL: cArmL, lean: cLean, squash: 0.32 * kneel + 0.2 * decay(f.t - CUFF_T, 0.1) }), turn: Math.PI }, { shades: 1, puff: 1.1, medal: cuffed ? decay(f.t - CUFF_T, 0.5) : 0, jiggle: kneel * Math.sin(f.t * 40) * 0.4 }, f.t);
        cuffsAt(!cuffed, cArmR, cLean, 0.3 * Math.sin(f.t * 9) * (1 - 0.5 * slide));
      }
      sulk(f, path);
    };
  }, {
    overlay(g, f) {
      if (f.t < IMPACT && c48cam) {
        c48cam.updateMatrixWorld();
        const p = spotFollow(f.t);
        const sp2 = spotScreen(c48cam, f.w, f.h, p, f.t < TICK ? 1.0 : 1.3, f.t < TICK ? 0.4 : 3.2, LAMP);
        drawSpotlight(g, f.w, f.h, sp2, 0.95, 1);
      }
    },
  }));

  // The held note: the camera rises off Clawd posing with his catch and cranes along the glowing
  // cable back the other way, over the floor, then comes down low and long-lens on the Cache at
  // the front right. Behind it, tied to the cable's tail by a string: the tiny Field. It peeks
  // out; the dancers round it see it, gasp and point; a crash zoom onto it; it looks left, right,
  // sweats, and ducks back out of sight, leaving us on the empty spot. Far behind, Clawd dances on
  // with his eyes shut, none the wiser.
  const DRIFT0 = B(268), LAND = B(275) - 0.12, PEEK = B(275), NOTICE = B(276), LOOKS = B(277), DUCK = BT(278.5);
  // the crane, as matching key positions and look points (the same number of each, so a point on
  // one pairs with the point at the same u on the other)
  const CRANE = new THREE.CatmullRomCurve3([
    TWO[0], new THREE.Vector3(-0.9, 4.3, 3.8), new THREE.Vector3(1.4, 3.9, 5.4), new THREE.Vector3(4.5, 2.0, 6.6), new THREE.Vector3(6.3, 0.85, 6.6),
  ], false, 'centripetal');
  const CRANE_LOOK = new THREE.CatmullRomCurve3([
    TWO[1], new THREE.Vector3(-1.6, 0.3, -2.0), new THREE.Vector3(0.9, 0.2, -0.15), new THREE.Vector3(3.6, 0.35, -0.4), new THREE.Vector3(3.6, 0.6, -0.5),
  ], false, 'centripetal');
  // the crash zoom lands on the Field a little left of centre, the Cache's edge on the right
  const ZOOM_AT = new THREE.Vector3(3.95, 0.33, 0.2);
  // three dancers stand where the long lens sees them point (two flank the Cache, one on the left
  // between it and Clawd far behind); the front-left dancer in the crane's way steps out
  const WATCH = new Map<number, THREE.Vector3>([[10, new THREE.Vector3(5.6, 0, -1.7)], [13, new THREE.Vector3(2.4, 0, -1.0)], [14, new THREE.Vector3(6.5, 0, -0.4)]]);
  const thawFrom = (club: Club, i: number) => B(268) + 0.15 + Math.hypot(club.dancers[i].x - COBRA_AT.x, club.dancers[i].z - COBRA_AT.z) * 0.07;
  shots.push(shot('c48-drift', B(268), B(280), ({ scene, camera, club }) => {
    const path = new HandlerPath();
    const c = new DiscoClawd();
    c.root.position.copy(CL_CUFF);
    const onNeck = new Cuffs(0.36);
    onNeck.root.scale.setScalar(2.1);
    const dropped = new Revolver();
    dropped.root.scale.setScalar(0.82);
    dropped.root.position.copy(GUN_REST);
    dropped.root.rotation.z = 0.1;
    const sulk = sulkCast(scene);
    const drop = sweatDrop();
    scene.add(path.root, c.root, onNeck.root, dropped.root, drop);
    const neck = new THREE.Vector3(), cam = new THREE.Vector3(), look = new THREE.Vector3();
    const watchers = [...WATCH.keys()];
    const shifts = new Map([...WATCH].map(([i, at]) => [i, at.clone().sub(new THREE.Vector3(club.dancers[i].x, 0, club.dancers[i].z))]));
    return (f, s) => {
      // camera: up off the two-shot into a crane over the cable, along it from near the head to
      // the tail, down low on a long lens for the reveal, then a crash zoom onto the Field
      const u = easeInOutCubic(clamp((f.t - DRIFT0 - 0.1) / (LAND - DRIFT0 - 0.1)));
      CRANE.getPoint(u, cam);
      CRANE_LOOK.getPoint(u, look);
      const zoom = easeOutCubic(clamp((f.t - (NOTICE + 0.06)) / 0.22));
      look.lerp(ZOOM_AT, zoom);
      aimCam(camera, cam.x, cam.y, cam.z, look.x, look.y, look.z);
      shake(camera, f, NOTICE + 0.06, 0.03, 0.15);
      camera.fov = lerp(lerp(38, 31, smooth(clamp((u - 0.55) / 0.45))), 15, zoom);
      camera.updateProjectionMatrix();
      partyState(s, f);
      // the floor dims but for the cable's runway while we follow it, and comes back once the
      // Field has ducked out of sight
      s.floor = runwayFloor(ff => smooth(clamp((ff.t - DRIFT0) / 0.8)) * (1 - smooth(clamp((ff.t - (DUCK + 0.2)) / 0.5))));
      s.crowdFrozen = i => (f.t < thawFrom(club, i) ? 1 : 0);
      s.crowdMask = i => !nearCobra(club, i, 2.6) && i !== 12;
      s.crowdShift = i => shifts.get(i) ?? null;
      // the watchers: stop, gasp, point at the Field; drop it as it ducks away
      const see = smooth(clamp((f.t - NOTICE) / 0.2)) * (1 - smooth(clamp((f.t - (DUCK + 0.5)) / 0.4)));
      s.crowdGasp = i => (watchers.includes(i) ? see : 0);
      s.crowdPose = (i, body) => {
        if (!watchers.includes(i) || see <= 0) return body;
        const toward = Math.sign(FIELD_PEEK.x - WATCH.get(i)!.x) || 1;
        const pointing: Body = { ...body, aR: toward > 0 ? 1.6 : 0.3, aL: toward > 0 ? 0.3 : 1.6, lean: toward * -0.08, hip: 0, bob: 0, squash: 0, lL: 0.05, lR: 0.05, turn: 0 };
        const k = see;
        return { aL: lerp(body.aL, pointing.aL, k), aR: lerp(body.aR, pointing.aR, k), lL: lerp(body.lL, pointing.lL, k), lR: lerp(body.lR, pointing.lR, k), lean: lerp(body.lean, pointing.lean, k), hip: lerp(body.hip, 0, k), bob: lerp(body.bob, 0, k), squash: lerp(body.squash, 0, k), turn: lerp(body.turn, 0, k) };
      };
      // the cobra, cuffed and sulking, the gun on the floor beside it; the cable glows hot while
      // we follow it, and calms down once we're on the Cache
      const landed = smooth(clamp((f.t - LAND) / 0.5));
      path.set(f.t, pv({ rear: 0.6, up: 0, open: 0.45, glow: lerp(1.5, 0.95, landed), packets: lerp(1, 0.45, landed), gun: false }));
      scene.updateMatrixWorld();
      path.neckAt(0.72, neck);
      onNeck.root.position.copy(neck).add(new THREE.Vector3(-0.38, -0.05, 0.08));
      onNeck.root.rotation.z = 0.25;
      // Clawd: the victory dance, eyes shut in bliss, face turned to us wherever we are
      const b = f.clock.beat(f.t);
      const dn = dance('point', b, 1);
      c.root.position.set(CL_CUFF.x + dn.x, 0, CL_CUFF.z);
      c.root.rotation.y = Math.atan2(camera.position.x - CL_CUFF.x, camera.position.z - CL_CUFF.z) * 0.7;
      c.set(DISCO_MOODS.triumphant, dn.pose, { shades: 0, jiggle: dn.jiggle, puff: 1.1, medal: 0.4 }, f.t);
      // the Field: peeks out at us, eyes wide at the pointing, a look left, a look right, a bead
      // of sweat, and gone
      const peek = smooth(clamp((f.t - PEEK) / 0.3)) * (1 - smooth(clamp((f.t - DUCK) / 0.18)));
      const lookAt = f.t < LOOKS ? 0.7 : f.t < LOOKS + 0.3 ? -0.9 : 0.9;
      sulk(f, path, { peek, look: lookAt, open: f.t > NOTICE && f.t < DUCK ? 1.25 : 1, squash: 0.25 * decay(f.t - NOTICE, 0.1), caLook: -0.5, gone: f.t > DUCK + 0.2 });
      const sw = f.t - (LOOKS + 0.35);
      drop.visible = sw > 0 && sw < 0.7 && peek > 0.3;
      drop.scale.setScalar(0.45);
      drop.position.set(FIELD_PEEK.x + 0.3, 0.7 - sw * sw * 1.5, FIELD_PEEK.z + 0.1);
    };
  }));

  // ---- the break (instrumental) -------------------------------------------------------------------
  // 48a. Wide: the victory dance in the middle of the floor, the cuffed cable sulking in the back;
  //      the Chief comes in from the bar side with his coffee and walks straight over.
  const CL_DANCE = new THREE.Vector3(0.3, 0, -1.4);
  const CHIEF_FROM = new THREE.Vector3(-8.2, 0, -0.4), CHIEF_TO = new THREE.Vector3(-1.25, 0, -1.1);
  const WALK0 = B(281), WALK1 = B(287);
  const chiefAt = (t: number) => CHIEF_FROM.clone().lerp(CHIEF_TO, clamp((t - WALK0) / (WALK1 - WALK0)));
  // he stops dead a quarter of the way into a turn (squeezed thin), then snaps round to face front
  const STOP_B = 288.75, STOP_SPIN = BT(STOP_B);
  const breakState = (s: ClubState, f: Frame, club: Club) => {
    partyState(s, f);
    // (and the front-left dancer, who'd stand right in the way of the Chief's entrance)
    s.crowdMask = i => !nearCobra(club, i, 1.5) && Math.hypot(club.dancers[i].x - CL_DANCE.x, club.dancers[i].z - CL_DANCE.z) > 1.4 && i !== 12;
  };
  function cobraCuffed(scene: THREE.Scene) {
    const path = new HandlerPath();
    const onNeck = new Cuffs(0.36);
    onNeck.root.scale.setScalar(2.1);
    const sulk = sulkCast(scene);
    scene.add(path.root, onNeck.root);
    const neck = new THREE.Vector3();
    return (f: Frame) => {
      path.set(f.t, pv({ rear: 0.6, up: 0, open: 0.4, glow: 1, packets: 0.4, gun: false }));
      scene.updateMatrixWorld();
      path.neckAt(0.72, neck);
      onNeck.root.position.copy(neck).add(new THREE.Vector3(-0.38, -0.05, 0.08));
      onNeck.root.rotation.z = 0.25;
      sulk(f, path);
    };
  }
  /** Clawd's victory spin, until he sees the Chief: he stops dead mid-turn and faces front. */
  const victory = (b: number, t: number) => {
    const dn = mixDance(dance('point', b, 1), dance('spin', b, 1), smooth(clamp((b - 281.5) / 0.5)));
    if (t < STOP_SPIN) return dn;
    const held = dance('spin', STOP_B, 1);
    const back = smooth(clamp((t - STOP_SPIN - 0.35) / 0.25));
    return { ...held, pose: { ...held.pose, turn: lerp(held.pose.turn, 0, back), armL: lerp(held.pose.armL, -0.3, back), armR: lerp(held.pose.armR, -0.3, back) } };
  };
  shots.push(shot('b2-dance', B(280), B(286), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    const ch = new Chief();
    const cuffed = cobraCuffed(scene);
    scene.add(c.root, ch.root);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      // medium-wide, drifting right with the Chief as he crosses toward Clawd
      aimCam(camera, lerp(-2.0, -1.2, k), lerp(2.1, 1.95, k), lerp(7.4, 6.6, k), lerp(-1.8, -1.0, k), 1.15, -1.2);
      breakState(s, f, club);
      const b = f.clock.beat(f.t);
      const dn = victory(b, f.t);
      c.root.position.set(CL_DANCE.x + dn.x, 0, CL_DANCE.z);
      c.set(DISCO_MOODS.triumphant, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 1.2, medal: 0.5 }, f.t);
      const p = chiefAt(f.t);
      const walking = f.t > WALK0 && f.t < WALK1;
      ch.root.position.copy(p);
      ch.set(cs({ walk: walking ? (f.t - WALK0) * 1.1 : 0, brow: 0.3, look: 0.6 }), f.t);
      cuffed(f);
    };
  }));
  // 48a, close: the Chief plants himself at Clawd's side, eyebrow climbing, foot tapping. Clawd,
  // mid-spin, sees him and stops dead; the afro sinks a little.
  shots.push(shot('b2-chief', B(286), B(294), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    const ch = new Chief();
    const cuffed = cobraCuffed(scene);
    scene.add(c.root, ch.root);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      const mx = (CL_DANCE.x + CHIEF_TO.x) / 2;
      // full length, so the tapping foot and the mug both read
      aimCam(camera, mx + lerp(0.3, 0.15, k), lerp(1.45, 1.4, k), CL_DANCE.z + lerp(6.9, 5.9, k), mx, 1.15, CL_DANCE.z);
      breakState(s, f, club);
      const b = f.clock.beat(f.t);
      const dn = victory(b, f.t);
      const seen = clamp((f.t - STOP_SPIN - 0.35) / 0.25);
      const sink = smooth(clamp((f.t - STOP_SPIN - 0.7) / 1.2));
      c.root.position.set(CL_DANCE.x + dn.x * (1 - seen), 0, CL_DANCE.z);
      c.set(f.t < STOP_SPIN ? DISCO_MOODS.triumphant : seen < 1 ? DISCO_MOODS.baffled : DISCO_MOODS.sheepish, dn.pose, {
        // the shades jump up into the afro (wide eyes), then a sheepish grin as the afro sinks
        shades: f.t < STOP_SPIN ? 1 : lerp(1, 0, smooth(seen)), jiggle: f.t < STOP_SPIN ? dn.jiggle : Math.sin((f.t - STOP_SPIN) * 30) * decay(f.t - STOP_SPIN, 0.2),
        puff: lerp(1.2, 0, sink), flat: 0.5 * sink, medal: f.t < STOP_SPIN ? 0.5 : 0,
      }, f.t);
      const p = chiefAt(f.t);
      const walking = f.t < WALK1;
      ch.root.position.copy(p);
      const tap = f.t > WALK1 + 0.2 ? Math.max(0, Math.sin(f.clock.beat(f.t) * Math.PI)) : 0;
      ch.set(cs({ walk: walking ? (f.t - WALK0) * 1.1 : 0, brow: f.t > WALK1 ? lerp(0.3, 1, smooth(clamp((f.t - WALK1) / 0.4))) : 0.3, look: 0.7, tap, sip: smooth(clamp((f.t - B(291)) / 0.3)) * (1 - smooth(clamp((f.t - BT(292.5)) / 0.3))) }), f.t);
      cuffed(f);
    };
  }));

  return shots;
}
