// Verse 2 (1:18.4 to 1:50.2): the forensics lab. Storyboard rows 25 to 40. Prod is still down.
// Clawd sets up a lab on the floor in front of the booth (a pull-up projector screen, an X-ray
// light box, a hex byte ticker) and checks staging against prod every way he can: graphs, twin
// dancers, request bodies, fingerprints, bytes. Everything matches, except one field. The Chief
// taps it; "Good catch!" Then the scope narrows, the Cache turns out to be load-bearing, a tiny
// flag, a loose red thread, and under the booth the first trace he dismissed back in verse 1.
// Cuts land on the beat nearest each line's start; actions on sung words, W(line, word).
import * as THREE from 'three';
import type { Frame, Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { PAL, aimCam } from '../look';
import { METER, RISER, aliveFloor, clearBooth, deadFloor, tileCenter, type Club, type ClubState, type Painter } from '../club';
import { ARM_LEN, DiscoClawd, DISCO_MOODS, REST, dance, mixDance, type Pose } from '../clawd-disco';
import { Cache, Field, sp } from '../suspects';
import { Dancer, STAND, type Body, type Outfit } from '../people';
import { Burst, GlowPath, lightPool, sweatDrop } from '../props';
import { Chief, cs } from '../chief';
import { ByteTicker, Creeper, DustPuff, GearTower, LightBox, ODD_BYTE, Projector, PullUpScreen, RiserDoor, TraceCoil, drawBubble, labStand, mirrorFrame, sash, screenAt } from '../lab';
import { shake, shot } from './common';

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });

// The lab, set up on the dance floor in front of the booth, left to right: the projector screen,
// the service door in the riser (a mechanic's creeper parked in front of it), the light box and
// the ticker. The projector cart stands off to the screen's left, its lens turned toward it, so it
// never blocks the door.
const SCREEN_AT = new THREE.Vector3(-3.0, 0, -6.5);
const SCREEN_W = 4.0, SCREEN_H = 2.5;
const PROJ_AT = new THREE.Vector3(-5.35, 0, -4.5);
const BOX_AT = new THREE.Vector3(2.3, 0, -6.95), BOX_S = 0.5, BOX_Y = 1.5;
const TICK_AT = new THREE.Vector3(4.65, 0, -6.6), TICK_S = 0.36, TICK_Y = 1.55;
const DOOR_AT = new THREE.Vector3(0, 0, RISER.front + 0.012);
const CREEPER_AT = new THREE.Vector3(-0.25, 0, -6.4);

/** Prod is still down: dead floor, frozen crowd, logs scrolling, the alarm turning lazily. */
function labState(s: ClubState, f: Frame) {
  Object.assign(s, {
    floor: deadFloor(0.9), alarm: 0.55, frozen: 1, pars: 0.3, beams: 0, wallLight: 0.45, sign: 0.8,
    terms: 'logs', termT0: 14.6, ball: { angle: 0.3, lit: 0.22, sparkle: 0 },
    records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardRing: 1, boardLine: 1,
  });
}

/** The front rows of the crowd step out of the lab shots (they'd stand in the gear). */
const offLab = (club: Club) => (i: number) => clearBooth(i) && club.dancers[i].z > -5.5;

/** The lab gear, built per shot (each shot owns its props). */
function buildLab(scene: THREE.Scene) {
  const screen = new PullUpScreen(SCREEN_W, SCREEN_H);
  screen.root.position.copy(SCREEN_AT);
  const proj = new Projector();
  proj.root.position.copy(PROJ_AT);
  proj.root.scale.x = -1; // lens to the right, toward the screen
  const top = SCREEN_AT.y + PullUpScreen.CASE_TOP;
  proj.aim([
    new THREE.Vector3(SCREEN_AT.x - SCREEN_W / 2, top, SCREEN_AT.z), new THREE.Vector3(SCREEN_AT.x + SCREEN_W / 2, top, SCREEN_AT.z),
    new THREE.Vector3(SCREEN_AT.x + SCREEN_W / 2, top + SCREEN_H, SCREEN_AT.z), new THREE.Vector3(SCREEN_AT.x - SCREEN_W / 2, top + SCREEN_H, SCREEN_AT.z),
  ]);
  const box = new LightBox();
  box.root.scale.setScalar(BOX_S);
  box.root.position.set(BOX_AT.x, BOX_Y, BOX_AT.z);
  const boxStand = labStand(BOX_Y - (LightBox.H / 2 + 0.15) * BOX_S);
  boxStand.position.set(BOX_AT.x, 0, BOX_AT.z - 0.02);
  const ticker = new ByteTicker();
  ticker.root.scale.setScalar(TICK_S);
  ticker.root.position.set(TICK_AT.x, TICK_Y, TICK_AT.z);
  const tickStand = labStand(TICK_Y - (ByteTicker.H / 2 + 0.12) * TICK_S);
  tickStand.position.set(TICK_AT.x, 0, TICK_AT.z - 0.02);
  const door = new RiserDoor();
  door.root.position.copy(DOOR_AT);
  const creeper = new Creeper();
  creeper.root.position.copy(CREEPER_AT);
  scene.add(screen.root, proj.root, box.root, boxStand, ticker.root, tickStand, door.root, creeper.root);
  return { screen, proj, box, ticker, door, creeper };
}

/** The lab once the bytes are read: everything matched, the odd pair flashing, the door as given. */
function labAfter(lab: ReturnType<typeof buildLab>, f: Frame, camera: THREE.Camera, door = 0, rattle = 0) {
  lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
  lab.proj.set(f.t, 1, camera);
  lab.box.set(f.t, 1, 1, 1);
  lab.ticker.set(f.t, ODD_BYTE, 1);
  lab.door.set(f.t, door, rattle);
}

/** A dark afro silhouette in the near foreground (an over-the-shoulder shot), rimmed in `rim`. */
function drawAfroSil(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rim: string, bob = 0) {
  const path = (grow: number) => {
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const lobe = Math.pow(Math.abs(Math.sin(a * 7.5 + 0.4)), 0.55);
      const rr = r * (0.92 + 0.08 * lobe) + grow;
      const x = cx + Math.cos(a) * rr, y = cy + bob + Math.sin(a) * rr * 0.86;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  };
  g.save();
  g.shadowColor = rim; g.shadowBlur = r * 0.12;
  path(r * 0.03); g.fillStyle = rim; g.globalAlpha = 0.85; g.fill();
  g.shadowBlur = 0; g.globalAlpha = 1;
  path(0); g.fillStyle = '#07050e'; g.fill();
  g.restore();
}

// The twins: STAGING and PROD, the same dancer twice, in white suits and gold feathered hair.
const TWIN: Outfit = { skin: '#e0a77f', hair: '#d9a441', style: 'feather', top: '#f6f1e6', pants: '#f6f1e6', dress: false, collar: '#ffe08a', shoes: '#d9c7ff' };
const B_ = (b: Partial<Body>): Body => ({ ...STAND, ...b });
/** The same pose seen in a mirror. */
const mirror = (b: Body): Body => ({ ...b, aL: b.aR, aR: b.aL, lL: b.lR, lR: b.lL, lean: -b.lean, hip: -b.hip });
const mixBody = (a: Body, b: Body, k: number): Body => {
  const o = { ...a };
  for (const key of Object.keys(a) as (keyof Body)[]) o[key] = lerp(a[key], b[key], k);
  return o;
};

/** The red thread: from the flag in Clawd's paw, over the floor, between the frozen dancers and
 *  in through the service door under the booth. */
const THREAD = [
  new THREE.Vector3(1.55, 0.05, -0.75), new THREE.Vector3(0.9, 0.03, -1.6), new THREE.Vector3(-0.6, 0.03, -2.3),
  new THREE.Vector3(-1.9, 0.03, -3.2), new THREE.Vector3(-1.5, 0.03, -4.6), new THREE.Vector3(-0.2, 0.03, -5.3),
  new THREE.Vector3(0.6, 0.03, -6.2), new THREE.Vector3(0.1, 0.03, -7.2), new THREE.Vector3(0, 0.12, -7.95),
];

export function verse2Shots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const B = (i: number) => audio.beats[i];
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const shots: Shot[] = [];

  // 25. "I pull up all the metrics": the lab on the floor in front of the booth. Clawd grabs the
  //     bar of the pull-up screen and yanks it up on "pull up"; it springs the rest of the way, he
  //     hops aside and presents it, and the graphs draw across it on "metrics".
  const PULL = W(25, 1), UP = W(25, 2), ALL = W(25, 3), METRICS = W(25, 5);
  const CL_PULL = new THREE.Vector3(SCREEN_AT.x, 0, SCREEN_AT.z + 0.5);
  const CL_SIDE = new THREE.Vector3(0.1, 0, -5.0);
  shots.push(shot('v25-pull', B(164), B(167), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const c = new DiscoClawd();
    scene.add(c.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(-0.9, -0.7, k), lerp(2.05, 1.95, k), lerp(4.2, 3.2, k), lerp(-0.7, -0.8, k), 1.55, -6.8);
      s.crowdMask = offLab(club);
      // his paws carry the bar up to as high as he can reach; then it springs up on its own
      const yank = smooth(clamp((f.t - (PULL + 0.04)) / (UP + 0.08 - PULL - 0.04)));
      const spring = easeOutBack(clamp((f.t - (UP + 0.08)) / 0.32), 1.5);
      const reach = 0.06 + 0.36 * yank;
      const rise = f.t < UP + 0.08 ? reach : lerp(reach, 1, spring);
      lab.screen.set({ t: f.t, rise, mode: 'dash', draw: clamp((f.t - METRICS + 0.05) / 0.5), gap: 1, match: 0 });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 0, 0.25, 0);
      lab.ticker.set(f.t, 0, 0);
      lab.door.set(f.t, 0);
      // Clawd: crouched over the case, up with the bar, then a hop to the side to present it
      const hop = clamp((f.t - (ALL - 0.12)) / 0.3);
      const x = lerp(CL_PULL.x, CL_SIDE.x, easeInOutCubic(hop)), z = lerp(CL_PULL.z, CL_SIDE.z, hop);
      c.root.position.set(x, Math.sin(hop * Math.PI) * 0.45, z);
      const present = clamp((f.t - (METRICS - 0.12)) / 0.2);
      const pullPose = P({ armL: lerp(-1.0, 1.25, yank), armR: lerp(-1.0, 1.25, yank), squash: lerp(0.35, -0.15, yank), bounce: 0.2 * yank });
      const presentPose = P({ armL: lerp(0.4, 0.75, present), armR: lerp(0.4, -0.5, present), lean: lerp(0, 0.1, present), squash: -0.2 * Math.sin(hop * Math.PI) });
      const pose = hop > 0 ? presentPose : pullPose;
      c.set(f.t < METRICS - 0.1 ? DISCO_MOODS.focused : DISCO_MOODS.smug, pose, { shades: 1, puff: 0.2 + 0.3 * present, jiggle: Math.sin(f.t * 22) * 0.4 * (yank - spring * 0.5) }, f.t);
    };
  }));

  // 26. "The pattern looks exact": close on the screen, over his shoulder (the afro in the dark
  //     foreground). Each panel's prod line slides down onto staging's; on "exact" they lock
  //     together and a MATCH badge stamps across the screen.
  const PATTERN = W(26, 1), EXACT = W(26, 3);
  shots.push(shot('v26-exact', B(167), B(171), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, SCREEN_AT.x + lerp(0.55, 0.3, k), lerp(2.0, 2.05, k), SCREEN_AT.z + lerp(4.1, 3.7, k), SCREEN_AT.x + 0.1, lerp(2.0, 2.05, k), SCREEN_AT.z);
      shake(camera, f, EXACT, 0.04, 0.15);
      s.crowdMask = offLab(club);
      const slide = easeInOutCubic(clamp((f.t - PATTERN) / (EXACT - PATTERN - 0.04)));
      const gap = f.t < EXACT ? 1 - slide : 0.04 * Math.sin((f.t - EXACT) * 40) * decay(f.t - EXACT, 0.1);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap, match: easeOutBack(clamp((f.t - EXACT) / 0.18), 2) });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 0, 0.25, 0);
      lab.ticker.set(f.t, 0, 0);
      lab.door.set(f.t, 0);
    };
  }, {
    overlay(g, f) {
      const b = f.clock.beat(f.t), ph = b - Math.floor(b);
      drawAfroSil(g, f.w * 0.1, f.h * 1.02, f.h * 0.3, PAL.cyan, -f.h * 0.012 * Math.exp(-ph * 5));
    },
  }));

  // 27. "The staging and production calls": two dancers in the same white suit strut out into the
  //     light, pageant sashes on, STAGING from the left on "staging", PROD from the right on
  //     "production". On "calls" they hit the same pose, mirrored.
  const STAGING = W(27, 1), PRODUCTION = W(27, 3), CALLS = W(27, 4);
  const TWIN_Z = -3.5, TWIN_X = 1.55;
  const strut = (b: number, k: number): Body => {
    const w = Math.sin(b * Math.PI);
    return B_({ aL: 0.35 + 0.15 * w, aR: lerp(0.35, 2.6, k) + 0.25 * Math.sin(b * Math.PI * 2) * k, lL: Math.max(0, w) * 0.45, lR: Math.max(0, -w) * 0.45, bob: Math.abs(w) * 0.06, hip: 0.04 * w });
  };
  const CALL_POSE = B_({ aL: 0.75, aR: 2.75, lean: 0.1, hip: -0.06, lR: 0.25 });
  function twinPair(scene: THREE.Scene) {
    const st = new Dancer(TWIN), pr = new Dancer(TWIN);
    st.body.add(sash('STAGING', '#1aa9c9'));
    pr.body.add(sash('PROD', '#d9267f'));
    const pools = [lightPool(1.0, '#d6f6ff', 0), lightPool(1.0, '#ffd9ef', 0)];
    scene.add(st.root, pr.root, ...pools);
    return { st, pr, pools };
  }
  shots.push(shot('v27-twins', B(171), B(175), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const { st, pr, pools } = twinPair(scene);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.2, 0, k), lerp(1.55, 1.5, k), lerp(3.4, 2.7, k), 0, 1.45, TWIN_Z - 1);
      s.crowdMask = offLab(club);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 0, 0.25, 0);
      lab.ticker.set(f.t, 0, 0);
      lab.door.set(f.t, 0);
      const b = f.clock.beat(f.t);
      const call = easeOutBack(clamp((f.t - CALLS + 0.04) / 0.16), 2);
      const walk = (t0: number) => easeOutCubic(clamp((f.t - t0 + 0.08) / 0.5));
      const inS = walk(STAGING), inP = walk(PRODUCTION);
      st.root.position.set(lerp(-4.6, -TWIN_X, inS), 0, TWIN_Z);
      pr.root.position.set(lerp(4.6, TWIN_X, inP), 0, TWIN_Z);
      const bodyS = call > 0 ? mixBody(strut(b, 1 - call), CALL_POSE, call) : strut(b, clamp(inS * 2) * (inS < 1 ? 1 : 0.6));
      const bodyP = call > 0 ? mixBody(mirror(strut(b, 1 - call)), mirror(CALL_POSE), call) : mirror(strut(b + 1, clamp(inP * 2) * (inP < 1 ? 1 : 0.6)));
      st.set(bodyS, 0, f.t, 1);
      pr.set(bodyP, 0, f.t, 1);
      st.root.visible = f.t > STAGING - 0.6;
      pr.root.visible = f.t > PRODUCTION - 0.6;
      pools[0].position.set(st.root.position.x, 0.03, TWIN_Z);
      pools[1].position.set(pr.root.position.x, 0.03, TWIN_Z);
      (pools[0].material as THREE.MeshBasicMaterial).opacity = 0.45 * inS;
      (pools[1].material as THREE.MeshBasicMaterial).opacity = 0.45 * inP;
    };
  }));

  // 28. "Are matching fact for fact": a gold mirror frame between them, with no glass in it; they
  //     mirror each other move for move, one move per word. On "for" Clawd steps into the frame
  //     behind it and copies them too (a third twin in the mirror); on the last "fact" all three
  //     hit the Saturday-night point. The twins' inner arms stay low once he's in, so they never
  //     cross in front of him.
  const MATCHING = W(28, 1), FACT1 = W(28, 2), FOR = W(28, 3), FACT2 = W(28, 4);
  const MOVES: [number, Body][] = [
    [MATCHING, B_({ aL: 2.55, aR: 2.55, bob: 0.08, squash: -0.1 })],
    [FACT1, B_({ aL: 2.85, aR: 0.25, lean: 0.14, hip: -0.08, lR: 0.2 })],
    [FOR, B_({ aL: 1.5, aR: 0.3, squash: 0.18, lL: 0.35, hip: 0.06 })],
    [FACT2, B_({ aL: 2.65, aR: 0.15, lean: 0.12, hip: -0.06, lL: 0.3 })],
  ];
  const moveAt = (t: number): Body => {
    let cur = CALL_POSE;
    for (let i = 0; i < MOVES.length; i++) {
      const [t0, b] = MOVES[i];
      if (t < t0 - 0.05) break;
      cur = mixBody(cur, b, easeOutBack(clamp((t - t0 + 0.05) / 0.12), 1.8));
    }
    return cur;
  };
  shots.push(shot('v28-mirror', B(175), B(179), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const { st, pr, pools } = twinPair(scene);
    const frame = mirrorFrame(1.7, 2.75);
    frame.position.set(0, 0, TWIN_Z - 0.08);
    const c = new DiscoClawd();
    scene.add(frame, c.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.15, 0, k), lerp(1.55, 1.5, k), lerp(2.6, 2.1, k), 0, 1.5, TWIN_Z - 1);
      s.crowdMask = offLab(club);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 0, 0.25, 0);
      lab.ticker.set(f.t, 0, 0);
      lab.door.set(f.t, 0);
      const body = moveAt(f.t);
      st.root.position.set(-TWIN_X, 0, TWIN_Z);
      pr.root.position.set(TWIN_X, 0, TWIN_Z);
      st.set(body, 0, f.t, 1);
      pr.set(mirror(body), 0, f.t, 1);
      pools.forEach((p, i) => { p.position.set(i ? TWIN_X : -TWIN_X, 0.03, TWIN_Z); (p.material as THREE.MeshBasicMaterial).opacity = 0.45; });
      // Clawd: slides in behind the frame from the right just before "for", then copies them
      const step = easeOutCubic(clamp((f.t - (FOR - 0.3)) / 0.28));
      c.root.position.set(lerp(3.2, 0, step), 0, TWIN_Z - 0.35);
      c.root.visible = step > 0;
      // he copies the move: paws out on "for", the point (paw up, the other down) on "fact"
      const both = f.t >= FACT2 - 0.05;
      const pt = easeOutBack(clamp((f.t - FACT2 + 0.05) / 0.12), 1.8);
      const pose = both
        ? P({ armR: lerp(0.15, 1.15, pt), armL: lerp(0.15, -0.7, pt), lean: -0.14 * pt, squash: 0.15 * decay(f.t - FACT2, 0.1) })
        : P({ armL: 0.15, armR: 0.15, lean: 0.04, squash: 0.15 * decay(f.t - FOR, 0.1) });
      c.set(both ? DISCO_MOODS.certain : DISCO_MOODS.smug, pose, { shades: 1, puff: 0.5, halo: 0.3, jiggle: -0.6 * decay(f.t - FACT2, 0.15) }, f.t);
    };
  }));

  // 29. "The request bodies match now": in the booth, the two request bodies slide onto the
  //     terminals, staging on the left screens, prod on the right; the same line lights on both
  //     sides at once, line after line, and on "match" every line goes green.
  const REQUEST = W(29, 1), MATCH29 = W(29, 3), NOW29 = W(29, 4);
  shots.push(shot('v29-bodies', B(179), B(183), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    c.root.position.set(0, RISER.h + 0.14, -9.0);
    scene.add(c.root);
    return (f, s) => {
      labState(s, f);
      s.crowdMask = offLab(club);
      s.terms = 'json'; s.termT0 = B(179) + 0.05;
      s.termLine = f.t < REQUEST ? -1 : lerp(0, 9, clamp((f.t - REQUEST) / (MATCH29 - REQUEST)));
      s.termSync = f.t < MATCH29 ? 0 : 1 + 0.5 * decay(f.t - NOW29, 0.15);
      const b = f.clock.beat(f.t), ph = b - Math.floor(b);
      const win = clamp((f.t - MATCH29) / 0.15);
      c.set(win > 0 ? DISCO_MOODS.triumphant : DISCO_MOODS.focused, P({
        armL: win > 0 ? lerp(0.3, 1.2, win) : 0.3 + 0.2 * Math.sin(b * Math.PI),
        armR: win > 0 ? lerp(0.3, 1.2, win) : 0.3 - 0.2 * Math.sin(b * Math.PI),
        squash: 0.18 * decay(ph, 0.08), bounce: 0.05 * Math.sin(ph * Math.PI),
      }), { shades: 1, jiggle: Math.cos(ph * Math.PI * 2) * 0.6, puff: 0.3 + 0.4 * win }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, 0, lerp(3.25, 3.4, k), lerp(-2.6, -3.6, k), 0, lerp(3.55, 3.75, k), -10);
    };
  }));

  // 30. "I verify the same": the X-ray light box flicks on, the two printouts side by side with
  //     their fingerprints; Clawd runs his magnifier over them, and on "same" they slide onto each
  //     other and line up exactly. The box glows green.
  const VERIFY = W(30, 1), THE30 = W(30, 2), SAME = W(30, 3);
  shots.push(shot('v30-prints', B(183), B(187), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const c = new DiscoClawd();
    const tick = new Burst(PAL.green, 12);
    tick.root.position.set(BOX_AT.x, BOX_Y, BOX_AT.z + 0.1);
    scene.add(c.root, tick.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, BOX_AT.x + lerp(0.25, 0.15, k), lerp(1.5, 1.45, k), BOX_AT.z + lerp(6.2, 5.4, k), BOX_AT.x - 0.6, 1.2, BOX_AT.z);
      s.crowdMask = offLab(club);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
      lab.proj.set(f.t, 1, camera);
      const lit = f.t < VERIFY ? 0 : hash(Math.floor(f.t * 30), 9) < 0.4 && f.t < VERIFY + 0.12 ? 0.3 : 1;
      const slide = easeInOutCubic(clamp((f.t - THE30) / (SAME - THE30)));
      const match = f.t >= SAME ? 1 : 0;
      lab.box.set(f.t, slide, lit, match);
      lab.ticker.set(f.t, 0, 0);
      lab.door.set(f.t, 0);
      tick.set(f.t - SAME, 1.0);
      // beside the box, magnifier up to the staging print; he steps in as the prints slide together
      c.root.position.set(BOX_AT.x - lerp(1.75, 1.45, slide), 0, BOX_AT.z + 0.5);
      // the magnifier sweeps across the staging print, then holds over the match
      const sweep = Math.sin((f.t - VERIFY) * 6) * (1 - clamp((f.t - THE30) / 0.3));
      const armR = f.t < VERIFY ? 0.2 : lerp(0.55, 0.95, 0.5 + 0.5 * sweep) * (1 - slide) + 0.75 * slide;
      const happy = clamp((f.t - SAME) / 0.15);
      c.set(happy > 0 ? DISCO_MOODS.eager : DISCO_MOODS.focused, P({ armR, armL: -0.4 + 0.9 * happy, lean: -0.06 + 0.1 * happy, squash: 0.15 * decay(f.t - SAME, 0.1) }), { shades: 0, prop: 'magnifier', puff: 0.2 + 0.3 * happy }, f.t);
    };
  }));

  // 31. "Byte-for-byte identical": close on the ticker. The two rows of bytes run past the reader
  //     head, each pair ticking green, faster and faster.
  // 32. "Except one field has changed": the ticker brakes and stops dead on one pair on "field":
  //     "v":1 against "v":2, flashing red. On "changed" the tiny Field pops up in front of it,
  //     blinks its big eyes at us, and ducks back out of sight.
  const T0 = B(187), FIELD = W(32, 2), CHANGED = W(32, 4);
  const BRAKE = FIELD - 0.26;
  const P1 = ODD_BYTE / (1 + 2.2 * (FIELD - BRAKE) / (2 * (BRAKE - T0)));
  const V1 = (2.2 * P1) / (BRAKE - T0);
  const bytePos = (t: number) => {
    if (t <= T0) return 0;
    if (t < BRAKE) return P1 * Math.pow((t - T0) / (BRAKE - T0), 2.2);
    const u = Math.min(t, FIELD) - BRAKE, d = FIELD - BRAKE;
    return P1 + V1 * u - (V1 * u * u) / (2 * d);
  };
  /** How fast the bytes are going, as a 0..1 smear. */
  const byteBlur = (t: number) => {
    if (t <= T0 || t >= FIELD) return 0;
    const v = t < BRAKE ? V1 * Math.pow((t - T0) / (BRAKE - T0), 1.2) : V1 * (1 - (t - BRAKE) / (FIELD - BRAKE));
    return clamp((v - 8) / 40);
  };
  const tickerCam = (cam: THREE.PerspectiveCamera, push: number, roll: number) =>
    aimCam(cam, TICK_AT.x, TICK_Y + 0.02, TICK_AT.z + lerp(2.9, 2.35, push), TICK_AT.x, TICK_Y, TICK_AT.z, roll);
  shots.push(shot('v31-bytes', B(187), B(191), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const speed = f.t < BRAKE ? clamp((f.t - T0) / (BRAKE - T0)) : 1;
      tickerCam(camera, easeInCubic(f.p) * 0.6, 0.06 * speed * speed);
      camera.position.x += Math.sin(f.t * 61) * 0.012 * speed * speed;
      s.crowdMask = offLab(club);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 1, 1, 1);
      lab.ticker.set(f.t, bytePos(f.t), 0, -1, byteBlur(f.t));
      lab.door.set(f.t, 0);
    };
  }));
  shots.push(shot('v32-field', B(191), B(195), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const fi = new Field();
    fi.root.scale.setScalar(0.75);
    scene.add(fi.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const speed = f.t < BRAKE ? 1 : 1 - clamp((f.t - BRAKE) / (FIELD - BRAKE));
      tickerCam(camera, 0.6 + 0.4 * easeOutCubic(clamp((f.t - FIELD) / 0.25)), 0.06 * speed);
      shake(camera, f, FIELD, 0.05, 0.15);
      s.crowdMask = offLab(club);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 1, 1, 1);
      lab.ticker.set(f.t, bytePos(f.t), f.t >= FIELD ? 1 : 0, -1, byteBlur(f.t));
      lab.door.set(f.t, 0);
      // the Field: up from behind the ticker's lower edge, a double blink, and down again
      const up = easeOutBack(clamp((f.t - (CHANGED - 0.06)) / 0.14), 2.4) * (1 - easeInCubic(clamp((f.t - (CHANGED + 0.38)) / 0.12)));
      const below = TICK_Y - (ByteTicker.H / 2) * TICK_S - 0.62;
      fi.root.position.set(TICK_AT.x, lerp(below, below + 0.5, up), TICK_AT.z + 0.08);
      fi.root.visible = up > 0.01;
      const blink = (f.t > CHANGED + 0.12 && f.t < CHANGED + 0.17) || (f.t > CHANGED + 0.24 && f.t < CHANGED + 0.29);
      fi.set(sp({ open: blink ? 0 : 1.3, look: 0.1 * Math.sin(f.t * 9), squash: 0.25 * decay(f.t - CHANGED, 0.08) }), f.t + 1.4);
    };
  }));

  // 33. "Good catch, that changes everything": the Chief has wandered over with his coffee; he
  //     taps the red pair. Clawd, in a speech bubble: "Good catch!" (the rest of the line is the
  //     lyric). On "everything" the Chief's eyebrow goes up and he takes a sip.
  const GOOD = W(33, 0), CATCH = W(33, 1), EVERYTHING = W(33, 4);
  const CL_CATCH = new THREE.Vector3(TICK_AT.x - 2.15, 0, TICK_AT.z + 0.5);
  const CHIEF_AT = new THREE.Vector3(TICK_AT.x + 1.6, 0, TICK_AT.z + 0.3);
  let c33cam: THREE.PerspectiveCamera | null = null;
  shots.push(shot('v33-catch', B(195), B(199), ({ scene, camera, club }) => {
    c33cam = camera;
    const lab = buildLab(scene);
    const c = new DiscoClawd();
    c.root.position.copy(CL_CATCH);
    const ch = new Chief();
    ch.root.position.copy(CHIEF_AT);
    scene.add(c.root, ch.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, TICK_AT.x - lerp(0.45, 0.35, k), lerp(1.75, 1.7, k), TICK_AT.z + lerp(6.4, 5.7, k), TICK_AT.x - 0.4, 1.4, TICK_AT.z);
      s.crowdMask = i => offLab(club)(i) && Math.hypot(club.dancers[i].x - CHIEF_AT.x, club.dancers[i].z - CHIEF_AT.z) > 1.6 && !(club.dancers[i].x > 4.6 && club.dancers[i].z > -5.2);
      lab.screen.set({ t: f.t, rise: 1, mode: 'dash', draw: 1, gap: 0, match: 1 });
      lab.proj.set(f.t, 1, camera);
      lab.box.set(f.t, 1, 1, 1);
      const tap = B(195) + 0.02;
      lab.ticker.set(f.t, ODD_BYTE, 1, f.t - tap);
      lab.door.set(f.t, 0);
      // the Chief, turned to face the ticker: finger on the red pair, then a sip and the eyebrow
      const press = decay(f.t - tap, 0.12);
      const away = smooth(clamp((f.t - (CATCH + 0.35)) / 0.3));
      const sip = smooth(clamp((f.t - (EVERYTHING - 0.15)) / 0.25));
      ch.set(cs({ turn: Math.PI, armR: lerp(1.28, 0.25, away) - 0.06 * press, point: away < 0.9 ? 1 : 0, sip, brow: f.t >= EVERYTHING - 0.1 ? 1 : 0.2, look: -0.6, lean: 0.04 * press }), f.t);
      // Clawd: leans in to look, then turns to us: "Good catch!"
      const say = clamp((f.t - (GOOD - 0.08)) / 0.15);
      const wow = clamp((f.t - EVERYTHING) / 0.2);
      c.set(wow > 0 ? DISCO_MOODS.excited : say > 0 ? DISCO_MOODS.eager : DISCO_MOODS.focused, P({
        armL: lerp(-0.4, 0.55, say), armR: lerp(0.2, 0.95, say) + 0.25 * wow, lean: lerp(-0.12, 0.04, say), squash: 0.12 * decay(f.t - GOOD, 0.1),
      }), { shades: lerp(2, 1, say), puff: 0.3 + 0.5 * wow, jiggle: Math.sin(f.t * 20) * 0.3 * wow }, f.t);
    };
  }, {
    overlay(g, f) {
      if (!c33cam) return;
      c33cam.updateMatrixWorld();
      // from the top of his afro, out over the ticker toward the Chief
      const at = screenAt(new THREE.Vector3(CL_CATCH.x + 0.45, 2.0, CL_CATCH.z), c33cam, f.w, f.h);
      drawBubble(g, f.t, f.h, at, [{ text: 'Good', start: GOOD }, { text: 'catch!', start: CATCH }], EVERYTHING - 0.35, { side: 1, size: 78 });
    },
  }));

  // 34. "The scope is narrower now": high over the floor. The lit part of the floor shrinks around
  //     Clawd, a square at a time, and he keeps dancing in whatever room is left.
  const SCOPE_TILE: [number, number] = [7, 5];
  const SCOPE_C = tileCenter(...SCOPE_TILE);
  const STEPS34: [number, number][] = [[B(199) - 0.1, 7], [W(34, 2), 4.5], [W(34, 3), 2.5], [B(201) + 0.05, 1.5], [W(34, 4), 0.5]];
  const scopeHalf = (t: number) => {
    let h = 7;
    for (const [t0, v] of STEPS34) if (t >= t0) h = lerp(h, v, easeOutBack(clamp((t - t0) / 0.14), 2));
    return h;
  };
  const scopeFloor = (): Painter => {
    const alive = aliveFloor(1.3), dark = deadFloor(0.35);
    return (ix, iz, f) => {
      const h = scopeHalf(f.t);
      const dx = Math.abs(ix - SCOPE_TILE[0]), dz = Math.abs(iz - SCOPE_TILE[1]);
      const inside = dx <= h - 0.5 && dz <= h - 0.5;
      const edge = !inside && dx <= h + 0.5 && dz <= h + 0.5;
      if (inside) return alive(ix, iz, f);
      if (edge) return { color: PAL.cyan, power: 1.25 };
      return dark(ix, iz, f);
    };
  };
  shots.push(shot('v34-scope', B(199), B(203), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const c = new DiscoClawd();
    scene.add(c.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, SCOPE_C.x + lerp(0.4, 0.2, k), lerp(10.5, 5.2, k), SCOPE_C.z + lerp(6.8, 3.6, k), SCOPE_C.x, lerp(0.3, 0.75, k), SCOPE_C.z - lerp(1.0, 0.2, k));
      labAfter(lab, f, camera);
      s.crowdMask = offLab(club);
      s.floor = scopeFloor();
      s.wallLight = 0.25;
      const h = scopeHalf(f.t);
      const room = clamp((h - 0.5) / 3);
      const b = f.clock.beat(f.t);
      const big = dance('point', b, 1), small = dance('shimmy', b, 0.6);
      const dn = mixDance(small, big, room);
      c.root.position.set(SCOPE_C.x + dn.x * room, 0, SCOPE_C.z);
      c.set(room < 0.3 ? DISCO_MOODS.focused : DISCO_MOODS.excited, P({ ...dn.pose, armL: dn.pose.armL * lerp(0.35, 1, room), armR: dn.pose.armR * lerp(0.35, 1, room) }), { shades: 1, jiggle: dn.jiggle, puff: 0.2 }, f.t);
    };
  }));

  // 35. "The cache path's load-bearing": the Cache is back, holding a teetering tower of the
  //     booth's gear on its head. Clawd tugs it to drag it off again; the tower leans, creaks, the
  //     top swings out. He shoves it back on "load-bearing", and the tower wobbles and settles.
  const CACHE2 = new THREE.Vector3(2.8, 0, -1.9);
  const CL_TUG = new THREE.Vector3(CACHE2.x - 1.45, 0, CACHE2.z + 0.35);
  const CACHE35 = W(35, 1), PATHS = W(35, 2), LOAD = W(35, 3);
  const tug = (t: number) => {
    const pull = smooth(clamp((t - (PATHS - 0.12)) / 0.3));
    const back = easeOutBack(clamp((t - (LOAD - 0.06)) / 0.22), 1.6);
    return pull * (1 - back);
  };
  /** Dancers out of the tower shots: round the Cache, and anyone standing between us and it. */
  const towerMask = (club: Club, i: number) => {
    const d = club.dancers[i];
    return offLab(club)(i) && Math.hypot(d.x - CACHE2.x, d.z - CACHE2.z) > 1.8 && !(d.z > -1.2 && Math.abs(d.x - 1.8) < 3.4);
  };
  /** The Cache holding the tower: arms up, the tower on its head. Sets both; returns the body. */
  function towerCast(scene: THREE.Scene) {
    const ca = new Cache();
    ca.root.position.copy(CACHE2);
    const tower = new GearTower();
    tower.root.position.set(0, Cache.Y + Cache.H / 2 + 0.02, 0.01);
    tower.root.scale.setScalar(0.8);
    ca.body.add(tower.root);
    scene.add(ca.root);
    return (f: Frame, lean: number, wobble: number, o: { open?: number; mouth?: number; brow?: number } = {}) => {
      ca.root.position.set(CACHE2.x - lean * 0.5, 0, CACHE2.z);
      ca.set(sp({ armL: 1.35, armR: 1.35, lean, shades: 0.3, open: o.open ?? 1, mouth: o.mouth ?? 0.4, brow: o.brow ?? -0.2, squash: 0.05 }), f.t);
      tower.set(f.t, lean * 1.6, wobble);
    };
  }
  shots.push(shot('v35-load', B(203), B(207), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const cast = towerCast(scene);
    const c = new DiscoClawd();
    const drop = sweatDrop();
    scene.add(c.root, drop);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(1.2, 1.45, k), lerp(2.05, 2.0, k), lerp(4.6, 3.9, k), lerp(1.95, 2.05, k), 1.9, CACHE2.z);
      shake(camera, f, LOAD, 0.05, 0.2);
      labAfter(lab, f, camera);
      s.crowdMask = i => towerMask(club, i) && Math.hypot(club.dancers[i].x - CL_TUG.x, club.dancers[i].z - CL_TUG.z) > 1.4;
      const k35 = tug(f.t);
      const settle = f.t > LOAD ? Math.sin((f.t - LOAD) * 13) * decay(f.t - LOAD, 0.35) : 0;
      const lean = 0.13 * k35 - 0.09 * settle;
      const scared = clamp((f.t - (PATHS + 0.15)) / 0.15) * (1 - clamp((f.t - (LOAD + 0.5)) / 0.3));
      cast(f, lean, 0.35 + 1.4 * k35 + 1.2 * Math.abs(settle), { open: 1 + 0.35 * scared, mouth: lerp(0.4, -1, scared), brow: lerp(-0.2, 1, scared) });
      // Clawd: a suspicious look, grabs its side on "cache", heaves on "path's", panics, shoves
      const grab = clamp((f.t - (CACHE35 - 0.05)) / 0.15);
      const shove = clamp((f.t - (LOAD - 0.08)) / 0.12) * (1 - clamp((f.t - (LOAD + 0.45)) / 0.3));
      c.root.position.set(CL_TUG.x - 0.25 * k35 + 0.2 * shove, 0, CL_TUG.z);
      const fear = clamp((f.t - (PATHS + 0.2)) / 0.12);
      c.set(fear > 0 && f.t < LOAD + 0.5 ? DISCO_MOODS.ohno : f.t >= LOAD + 0.5 ? DISCO_MOODS.sheepish : DISCO_MOODS.focused, P({
        armR: lerp(lerp(-0.2, 0.15, grab), 0.35, shove), armL: lerp(-0.4, 0.5, k35) + 0.3 * shove,
        lean: lerp(0, 0.28, k35) - 0.18 * shove, squash: 0.15 * k35,
      }), { shades: f.t < CACHE35 + 0.4 ? 2 : lerp(2, 1, clamp((f.t - CACHE35 - 0.4) / 0.2)), jiggle: 0.5 * Math.sin(f.t * 30) * fear * (1 - shove) }, f.t);
      // a sweat drop flies off him once it's safe
      const sw = f.t - (LOAD + 0.5);
      drop.visible = sw > 0 && sw < 0.6;
      drop.position.set(CL_TUG.x - 0.55 - sw * 0.8, 1.7 + sw * 1.2 - sw * sw * 4, CL_TUG.z + 0.2);
    };
  }));

  // 36. "I'm highly certain how": arms crossed, he nods along, smug; cut on "certain" to the meter
  //     slamming into the red again.
  const CL_SURE = new THREE.Vector3(0.9, 0, -1.0);
  /** Clawd on the left, the Cache and its tower on the right; push 0..1.6 creeps in. */
  const sureCam = (cam: THREE.PerspectiveCamera, push: number) =>
    aimCam(cam, lerp(0.7, 0.85, push), lerp(1.3, 1.25, push), lerp(3.4, 2.8, push), 1.55, 1.15, -1.4);
  const HIGHLY = W(36, 1), CERTAIN = W(36, 2);
  shots.push(shot('v36-certain', B(207), CERTAIN - 0.03, ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const cast = towerCast(scene);
    const c = new DiscoClawd();
    c.root.position.copy(CL_SURE);
    scene.add(c.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      sureCam(camera, easeOutCubic(f.p));
      labAfter(lab, f, camera);
      s.crowdMask = i => towerMask(club, i);
      cast(f, 0, 0.35);
      const nod = Math.max(decay(f.t - HIGHLY, 0.12), decay(f.t - (CERTAIN - 0.03), 0.1));
      c.set(DISCO_MOODS.smug, P({ squash: 0.25 * nod, lean: -0.05 }), { shades: 1, cross: 1, puff: 0.6 + 0.2 * nod, jiggle: -nod }, f.t);
    };
  }));
  shots.push(shot('v36-meter', CERTAIN - 0.03, B(211), ({ camera, club }) => (f, s) => {
    labState(s, f);
    s.crowdMask = clearBooth;
    void club;
    const slam = clamp((f.t - CERTAIN + 0.03) / 0.1);
    s.meter = lerp(0.45, 1, easeOutCubic(slam)) + 0.025 * Math.sin(f.t * 47);
    const d = lerp(1.5, 1.25, f.p);
    aimCam(camera, METER.x + 0.18, METER.y + 0.42, METER.z + d, METER.x + 0.18, METER.y + 0.2, METER.z);
    shake(camera, f, CERTAIN, 0.04, 0.15);
  }));

  // 37. "One thing worth flagging here though": he uncrosses his arms and holds up one finger;
  //     on "flagging" a tiny red flag pops out of his afro into his paw; he waves it on "here",
  //     and on "though" a loose red thread is hanging off it.
  const ONE37 = W(37, 0), FLAGGING = W(37, 3), HERE37 = W(37, 4), THOUGH = W(37, 5);
  shots.push(shot('v37-flag', B(211), B(215), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const cast = towerCast(scene);
    const c = new DiscoClawd();
    c.root.position.copy(CL_SURE);
    const pop = new Burst(PAL.red, 10);
    scene.add(c.root, pop.root);
    const thread = new GlowPath([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, -0.4, 0.02), new THREE.Vector3(0.05, -0.8, 0.03)], PAL.red, 0.012, 40);
    scene.add(thread.root);
    const tip = new THREE.Vector3();
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      sureCam(camera, 0.8 + 0.6 * easeInOutCubic(f.p));
      labAfter(lab, f, camera);
      s.crowdMask = i => towerMask(club, i);
      cast(f, 0, 0.35);
      const unx = clamp((f.t - (ONE37 - 0.08)) / 0.15);
      const flag = easeOutBack(clamp((f.t - (FLAGGING - 0.05)) / 0.18), 2.2);
      const wave = f.t > HERE37 - 0.05 ? Math.sin((f.t - HERE37) * 16) * 0.22 * decay(f.t - HERE37, 0.5) : 0;
      const armR = flag > 0 ? lerp(1.05, 1.2, flag) + wave : lerp(0.2, 1.05, unx);
      c.set(flag > 0 ? DISCO_MOODS.eager : DISCO_MOODS.smug, P({ armR, armL: lerp(-0.4, -0.55, unx), lean: -0.04 * unx, squash: 0.1 * decay(f.t - FLAGGING, 0.1) }), {
        shades: 1, cross: 1 - unx, prop: flag > 0 ? 'flag' : 'none', propK: 0.6 * flag, puff: 0.4,
      }, f.t);
      pop.root.position.set(CL_SURE.x + 0.3, 2.15, CL_SURE.z + 0.1);
      pop.set(f.t - (FLAGGING - 0.05), 0.9);
      // the thread: from the flag's lower corner, hanging, swaying
      scene.updateMatrixWorld();
      c.flagCorner(tip);
      const hang = clamp((f.t - (THOUGH - 0.1)) / 0.3);
      thread.root.position.copy(tip);
      thread.root.rotation.z = 0.15 * Math.sin(f.t * 3);
      thread.set(hang, 0);
    };
  }));

  // 38. "There's one more thread to chase": the thread zips off across the floor on "thread", in
  //     and out between the frozen dancers and away to the booth; his eyes follow it, and on
  //     "chase" he dances off after it.
  // 39. "The actual root cause may be": the thread runs in under the little service door in the
  //     riser. He arrives on "actual" with his back to it, by the mechanic's creeper parked there;
  //     on "root" he drops flat on his back onto it, and on "cause" he shoves off and rolls in head
  //     first like a mechanic under a car (the afro squashes to fit), feet kicking on "may be".
  const THREAD38 = W(38, 3), CHASE = W(38, 5);
  const ACTUAL = W(39, 1), ROOT = W(39, 2), CAUSE = W(39, 3), MAYBE = W(39, 4);
  const STOP = ACTUAL + 0.2;          // arrived, his back to the door
  const DROP = ROOT - 0.06;           // falls back onto the creeper
  const ROLL = CAUSE - 0.05;          // shoves off
  const GONE = MAYBE + 0.42;          // the last of his feet goes in
  /** Where he stands to drop back onto the creeper: just past its foot end. */
  const DIVE_AT = new THREE.Vector3(CREEPER_AT.x, 0, CREEPER_AT.z + Creeper.L / 2 + 0.15);
  /** His root's height lying on the creeper (just above its pad). */
  const LIE_Y = Creeper.TOP + 0.03;
  const threadPath = () => new GlowPath(THREAD, PAL.red, 0.022, 300);
  /** Where Clawd is on the chase: hopping along the thread, then over to the creeper. */
  const chaseAt = (path: GlowPath, t: number) => {
    const u = clamp((t - CHASE) / (STOP - CHASE));
    return path.at(lerp(0.04, 0.58, smooth(u) * 0.4 + u * 0.6)).lerp(DIVE_AT, smooth(clamp((u - 0.75) / 0.25)));
  };
  shots.push(shot('v38-thread', B(215), B(219), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const cast = towerCast(scene);
    const path = threadPath();
    const c = new DiscoClawd();
    scene.add(path.root, c.root);
    return (f, s) => {
      labState(s, f);
      const b = f.clock.beat(f.t);
      const go = f.t >= CHASE - 0.08;
      const at = go ? chaseAt(path, f.t) : CL_SURE;
      // camera before the billboards (motes, the thread's spark) that face it
      const k = easeInOutCubic(f.p);
      const follow = clamp((f.t - CHASE) / 0.6);
      aimCam(camera, lerp(CL_SURE.x + 0.6, at.x + 1.2, follow) + lerp(0, 0.4, k), lerp(1.7, 2.6, follow), lerp(CL_SURE.z + 4.6, at.z + 5.4, follow), lerp(CL_SURE.x - 0.4, at.x - 0.6, follow), lerp(1.1, 0.7, follow), lerp(CL_SURE.z - 1.5, at.z - 2.0, follow));
      labAfter(lab, f, camera);
      s.crowdMask = i => towerMask(club, i);
      cast(f, 0, 0.35);
      const zip = easeOutCubic(clamp((f.t - THREAD38) / 0.4));
      path.set(lerp(0.03, 1, zip), zip > 0 && zip < 1 ? 1 : 0);
      path.face(camera);
      const dn = dance('side', b, 1);
      c.root.position.set(at.x, go ? Math.abs(Math.sin(b * Math.PI * 2)) * 0.18 : 0, at.z);
      const look = clamp((f.t - THREAD38) / 0.2);
      c.set(go ? DISCO_MOODS.eager : look > 0 ? DISCO_MOODS.baffled : DISCO_MOODS.smug, go ? dn.pose : P({ armR: 1.15, armL: -0.55, lean: 0.1 * look }), {
        shades: go ? 1 : lerp(1, 2, look), prop: 'flag', propK: 0.6, jiggle: go ? dn.jiggle : 0, puff: 0.4,
      }, f.t);
    };
  }));

  // the roll: his root (his feet) from the drop spot until his feet are past the door
  const ROLL_D = DIVE_AT.z - (DOOR_AT.z - 0.12);
  const rollZ = (t: number) => DIVE_AT.z - ROLL_D * easeInCubic((t - ROLL) / (GONE - ROLL));
  // when the top of his afro (about 2.05 up the creeper from his feet) reaches the door panel
  const HIT = ROLL + Math.cbrt((DIVE_AT.z - (DOOR_AT.z + 0.03 + 2.05)) / ROLL_D) * (GONE - ROLL);
  const doorOpen = (t: number) => 0.85 * smooth(clamp((t - (HIT - 0.06)) / 0.12));
  shots.push(shot('v39-dive', B(219), B(223), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const path = threadPath();
    const c = new DiscoClawd();
    scene.add(path.root, c.root);
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      // following the hops in, then craning up over him as he goes down
      const k1 = easeInOutCubic(clamp((f.t - B(219)) / (STOP + 0.2 - B(219))));
      const k2 = easeInOutCubic(clamp((f.t - (STOP - 0.1)) / (DROP + 0.35 - STOP)));
      aimCam(camera,
        lerp(lerp(-1.1, 0.2, k1), 0.25, k2), lerp(lerp(2.3, 2.3, k1), 3.7, k2), lerp(lerp(1.0, -0.4, k1), -2.5, k2),
        lerp(lerp(-1.4, -0.2, k1), -0.1, k2), lerp(lerp(0.9, 0.8, k1), 0.25, k2), lerp(lerp(-4.6, -6.0, k1), -6.9, k2));
      shake(camera, f, DROP + 0.16, 0.03, 0.12);
      labAfter(lab, f, camera, doorOpen(f.t));
      s.crowdMask = offLab(club);
      path.set(1, 0);
      path.face(camera);
      const b = f.clock.beat(f.t);
      const u = clamp((f.t - ROLL) / (GONE - ROLL));
      const x = lerp(DIVE_AT.x, DOOR_AT.x, smooth(u));
      if (f.t < STOP) {
        // the last hops along the thread, then over to the creeper
        const at = chaseAt(path, f.t);
        const dn = dance('side', b, 1);
        c.root.position.set(at.x, Math.abs(Math.sin(b * Math.PI * 2)) * 0.18, at.z);
        c.root.rotation.x = 0;
        c.set(DISCO_MOODS.eager, dn.pose, { shades: 1, prop: 'flag', propK: 0.6, jiggle: dn.jiggle, puff: 0.4 }, f.t);
      } else {
        // a little crouch (here goes), then flat on his back onto the creeper and away, head first
        const ready = smooth(clamp((f.t - STOP) / 0.15));
        const fall = easeInCubic((f.t - DROP) / 0.16);
        const land = decay(f.t - (DROP + 0.16), 0.08);
        c.root.position.set(x, LIE_Y * fall, f.t < ROLL ? DIVE_AT.z : rollZ(f.t));
        c.root.rotation.x = (-Math.PI / 2) * fall;
        c.root.visible = c.root.position.z > DOOR_AT.z - 0.05;
        const kick = f.t > MAYBE - 0.05 ? Math.sin(f.t * 30) * 0.5 : 0;
        c.set(fall > 0 ? DISCO_MOODS.focused : DISCO_MOODS.eager, P({
          armL: lerp(-0.3, 1.3, Math.max(fall, 0.25 * ready)), armR: lerp(-0.3, 1.3, Math.max(fall, 0.25 * ready)),
          squash: 0.25 * ready * (1 - fall) + 0.3 * land, walk: kick,
        }), { shades: 1, prop: 'flag', propK: 0.6 * (1 - clamp((f.t - STOP) / 0.1)), puff: 0.4 }, f.t);
        // the afro squashes to get through the doorway
        c.afroGroup.scale.x *= lerp(1, 0.5, smooth(clamp((f.t - (HIT - 0.22)) / 0.2)));
      }
      lab.creeper.root.position.set(x, 0, (f.t < ROLL ? DIVE_AT.z : rollZ(f.t)) - (DIVE_AT.z - CREEPER_AT.z));
    };
  }));

  // 40. "The path I first misplaced": the door rattles (he's rummaging in there), a puff of dust
  //     on "path"; on "I first" the creeper rolls back out, feet first, Clawd on it hugging a dusty
  //     coil: the first trace from verse 1, the handler path, cobweb and all. On "misplaced" he
  //     springs upright and holds it up. A look, a blow, a cloud of dust, and the coil lights back
  //     up cyan. Held on the long note: he looks at us, sheepish, shades sliding down.
  const PATH40 = W(40, 1), I40 = W(40, 2), MISPLACED = W(40, 4);
  const OUT0 = I40 - 0.15, OUT1 = MISPLACED - 0.08, RISE = MISPLACED - 0.06;
  const BLOW = MISPLACED + 0.75, RELIGHT = MISPLACED + 1.15, LOOK = MISPLACED + 1.7;
  shots.push(shot('v40-misplaced', B(223), B(232), ({ scene, camera, club }) => {
    const lab = buildLab(scene);
    const path = threadPath();
    const c = new DiscoClawd();
    const coil = new TraceCoil();
    const puff = new DustPuff(14);
    const doorPuff = new DustPuff(8);
    scene.add(path.root, c.root, coil.root, puff.root, doorPuff.root);
    const chest = new THREE.Vector3(), tip = new THREE.Vector3();
    return (f, s) => {
      labState(s, f);
      // camera first: billboards (motes, puffs, glows) face this frame's camera
      // high on the door, then down to him as he springs up, then a slow push in
      const k1 = easeInOutCubic(clamp((f.t - (RISE - 0.3)) / 0.6));
      const k2 = easeInOutCubic(clamp((f.t - (RISE + 0.3)) / (B(232) - RISE - 0.3)));
      aimCam(camera,
        lerp(lerp(0.15, 0.1, k1), 0.05, k2), lerp(lerp(3.3, 1.55, k1), 1.5, k2), lerp(lerp(-3.5, -0.95, k1), -1.35, k2),
        lerp(lerp(-0.15, -0.15, k1), -0.15, k2), lerp(lerp(0.3, 1.1, k1), 1.12, k2), lerp(lerp(-7.3, -5.4, k1), -5.4, k2));
      labAfter(lab, f, camera, 0.85, f.t < OUT0 ? 0.6 + 0.4 * Math.sin(f.t * 9) : 0);
      s.crowdMask = offLab(club);
      path.set(1, 0);
      path.face(camera);
      doorPuff.root.position.set(DOOR_AT.x + 0.1, 0.35, DOOR_AT.z + 0.25);
      doorPuff.set(f.t - (PATH40 + 0.05), 1, camera, 0.8);
      // out feet first on the creeper, then up onto his feet with a hop
      const out = easeOutCubic((f.t - OUT0) / (OUT1 - OUT0));
      const zr = lerp(DOOR_AT.z - 0.12, DIVE_AT.z, out);
      const up = f.t < RISE ? 0 : easeOutBack(clamp((f.t - RISE) / 0.26), 1.4);
      c.root.visible = f.t >= OUT0;
      c.root.position.set(DOOR_AT.x, LIE_Y * (1 - clamp(up)) + 0.25 * Math.sin(clamp(up) * Math.PI), zr);
      c.root.rotation.x = (-Math.PI / 2) * (1 - up);
      lab.creeper.root.position.set(DOOR_AT.x, 0, zr - (DIVE_AT.z - CREEPER_AT.z));
      const hold = clamp(up);
      const huh = clamp((f.t - (MISPLACED + 0.3)) / 0.15);
      const blow = clamp((f.t - BLOW) / 0.12) * (1 - clamp((f.t - (BLOW + 0.4)) / 0.2));
      const look = clamp((f.t - LOOK) / 0.25);
      const shrug = look * (0.5 + 0.5 * Math.sin(clamp((f.t - LOOK - 0.2) / 0.5) * Math.PI));
      const mood = look > 0 ? DISCO_MOODS.sheepish : huh > 0 ? DISCO_MOODS.baffled : DISCO_MOODS.focused;
      c.set(mood, P({
        armR: lerp(-0.9, 0.75, hold) - 0.1 * shrug, armL: lerp(-0.9, -0.45, hold) + 0.5 * shrug,
        lean: 0.05 * Math.sin(huh * Math.PI) - 0.05 * blow, squash: 0.15 * blow + 0.2 * decay(f.t - (RISE + 0.26), 0.08),
      }), {
        shades: look > 0 ? lerp(1, 2, smooth(clamp((f.t - (LOOK + 0.6)) / 0.3))) : 1, puff: lerp(0.4, 0.1, look), flat: 0.15 * look,
      }, f.t);
      // the coil: on his chest while he's lying down, then hanging from his raised paw (just
      // behind it, so the paw reads as gripping its top)
      scene.updateMatrixWorld();
      c.root.localToWorld(chest.set(0, 0.42, 0.14));
      c.paw.localToWorld(tip.set(ARM_LEN - 0.04, 0, -0.02));
      tip.y -= 0.27;
      coil.root.visible = c.root.visible;
      coil.root.position.lerpVectors(chest, tip, smooth(hold));
      coil.root.rotation.x = c.root.rotation.x;
      coil.root.rotation.z = 0.12 * Math.sin(huh * Math.PI * 2) * (1 - look) + 0.05 * Math.sin(f.t * 2.2) * hold;
      const clean = smooth(clamp((f.t - BLOW) / 0.35));
      coil.set(f.t, 1 - clean, clamp((f.t - RELIGHT) / 0.4));
      puff.root.position.set(coil.root.position.x + 0.15, coil.root.position.y + 0.1, coil.root.position.z + 0.15);
      puff.set(f.t - BLOW, 1, camera, 1);
    };
  }));

  return shots;
}
