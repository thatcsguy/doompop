// Chorus 1 and the break (0:48.1 to 1:18.4). Storyboard rows 17 to 24b. The evidence lines up
// everywhere at once: log lines on the floor, a timeline on the wall, a neon arrow, every screen,
// the board. On the pause the frame freezes and the club goes dark but one spotlight, which swings
// across to the Cache holding a smoking revolver: GOTCHA, and the lights slam back on with the
// beat. A victory dance under the turning ball, until the pager on the bar buzzes again: prod is
// still down. Timing: cuts on beats, actions on sung words, the pause's stabs from the envelope.
import * as THREE from 'three';
import type { Frame, Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { PAL, aimCam, beamTexture, frameCam, glowMat, lightMat } from '../look';
import { BAR, BOOTH_SPOT, FLOOR, WALL_Z, aliveFloor, allRed, clearBooth, deadFloor, tileCenter, type ClubState, type Painter } from '../club';
import { ARM_LEN, DiscoClawd, DISCO_MOODS, REST, dance, mixDance, type DanceOut, type DiscoLook, type Pose } from '../clawd-disco';
import { Bouncer, Cache, Field, sp } from '../suspects';
import { Burst, Cuffs, Pager, Turntable, lightPool, martini, sweatDrop } from '../props';
import { FloorLogs, NeonArrow, Revolver, Smoke, Timeline, drawSpotlight, spotScreen } from '../evidence';
import { shake, shot } from './common';

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });

/** The first time in [from, to) that the mix's loudness jumps past `level`: hits the beat tracker
 *  doesn't list (the stabs in the pause) still come from the analysed envelope. */
export function onset(audio: AudioData, from: number, to: number, level = 0.3) {
  const e = audio.envelopes, fps = e.fps;
  for (let i = Math.max(1, Math.ceil(from * fps)); i < Math.min(e.rms.length, to * fps); i++) {
    if (e.rms[i - 1] < level && e.rms[i] >= level) return (i - 1 + (level - e.rms[i - 1]) / (e.rms[i] - e.rms[i - 1])) / fps;
  }
  return from;
}

/** The disco ball: still until it starts to turn, up to full speed, then (when prod turns out to be
 *  still down) winding to a stop. The angle is the integral of a speed that ramps linearly. */
export function ballTurn(t: number, T: { start: number; full: number; stop: number; halt: number }, w = 0.75) {
  const a0 = 0.3;
  if (t <= T.start) return a0;
  const ramp = T.full - T.start;
  if (t <= T.full) return a0 + (w * (t - T.start) ** 2) / (2 * ramp);
  const a1 = a0 + (w * ramp) / 2;
  if (t <= T.stop) return a1 + w * (t - T.full);
  const a2 = a1 + w * (T.stop - T.full), d = T.halt - T.stop, u = Math.min(t, T.halt) - T.stop;
  return a2 + w * u - (w * u * u) / (2 * d);
}

const WAVE_COLS = [PAL.cyan, PAL.pink, PAL.gold, PAL.violetNeon];
/** The chorus floor: on every beat a band of colour rolls from the front of the floor back to the
 *  booth, leaving a fading trail. The error tiles still pulse red underneath: prod is still down. */
export function waveFloor(power = 1.35): Painter {
  return (ix, iz, f) => {
    const b = f.clock.beat(f.t), n = Math.floor(b), ph = b - n;
    const front = FLOOR.nz - 0.5 - ph * (FLOOR.nz + 3);
    const d = iz - front;
    const k = Math.max(1 - Math.abs(d) / 1.3, d > 0 ? Math.exp(-d / 2.2) * 0.55 : 0);
    if (k > 0.12) return { color: WAVE_COLS[((n % 4) + 4) % 4], power: lerp(0.95, power, k) };
    if (hash(ix, iz, 7) < 0.3) return { color: PAL.red, power: 0.45 + 0.35 * Math.exp(-ph * 4) };
    return { color: PAL.tileDead, power: 1 };
  };
}

/** The victory floor: the disco pattern spreads from `center` out to radius(f); past it the dead
 *  and red tiles are still there (it isn't really fixed). */
function halfLit(center: THREE.Vector3, radius: (f: Frame) => number): Painter {
  const alive = aliveFloor(1.5), dead = deadFloor(0.8);
  return (ix, iz, f) => {
    const p = tileCenter(ix, iz);
    return Math.hypot(p.x - center.x, p.z - center.z) < radius(f) ? alive(ix, iz, f) : dead(ix, iz, f);
  };
}

/** Red sweeping across the floor from the bar side, tiles flickering as the edge passes. */
function redWave(prev: Painter, t0: number, dur: number): Painter {
  const red = allRed(1.25);
  return (ix, iz, f) => {
    const x = tileCenter(ix, iz).x;
    const d = lerp(-8.5, 8.5, clamp((f.t - t0) / dur)) - x;   // > 0: the red has got here
    if (d > 0.9) return red(ix, iz, f);
    if (d > -0.9) return hash(ix, iz, Math.floor(f.t * 12)) < 0.5 + d * 0.55 ? red(ix, iz, f) : prev(ix, iz, f);
    return prev(ix, iz, f);
  };
}

/** A tile glowing gold (the one the arrow picks), over another painter. */
export function goldTile(base: Painter, tile: [number, number], k: (f: Frame) => number): Painter {
  return (ix, iz, f) => {
    const g = ix === tile[0] && iz === tile[1] ? k(f) : 0;
    return g > 0 ? { color: PAL.gold, power: lerp(1, 1.6, g) } : base(ix, iz, f);
  };
}

/** Handcuffs dangling from Clawd's paw: hold.rotation keeps them hanging straight down. */
function dangleCuffs(c: DiscoClawd) {
  const hold = new THREE.Group();
  hold.position.set(ARM_LEN + 0.04, 0, 0.06);
  const cuffs = new Cuffs(0.32);
  cuffs.root.rotation.z = Math.PI / 2;
  cuffs.root.position.y = -0.16;
  hold.add(cuffs.root);
  c.paw.add(hold);
  /** Call after c.set: armR and lean are the pose's; sway swings them a little. */
  return (on: boolean, armR: number, lean: number, sway: number) => {
    hold.visible = on;
    hold.rotation.z = -armR - lean + sway;
  };
}

export function chorus1Shots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const B = (i: number) => audio.beats[i];
  /** A fractional beat's time (between two listed beats). */
  const BT = (b: number) => { const n = Math.floor(b); return lerp(B(n), B(n + 1), b - n); };
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const shots: Shot[] = [];

  // the pause, from the data: line 23 ends, a silence, a stab, the downbeat, a tick, then the
  // "smoking gun" and the band slams back in on "gun"
  const FREEZE = lyrics.lines[22].end;
  const STAB = onset(audio, FREEZE, FREEZE + 0.4);
  const SWING = B(128);
  const TICK = onset(audio, SWING + 0.25, SWING + 0.7);
  const IMPACT = audio.hits.impact.find(h => h.t > 63 && h.t < 63.6)?.t ?? B(132);
  const BALL_T = { start: W(23, 1), full: IMPACT, stop: B(153), halt: B(153) + 1.3 };
  const ball = (t: number) => ballTurn(t, BALL_T);

  function chorusState(s: ClubState, f: Frame) {
    Object.assign(s, {
      floor: waveFloor(), frozen: 1, alarm: 0.2, pars: 0.8, beams: 0.3, wallLight: 0.75, sign: 0.55,
      terms: 'logs', termT0: 14.6, ball: { angle: ball(f.t), lit: 0.35, sparkle: 0 },
      records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardRing: 1,
    });
  }
  function partyState(s: ClubState, f: Frame) {
    Object.assign(s, {
      floor: aliveFloor(), frozen: 0, alarm: 0, pars: 1, beams: 1, wallLight: 1, sign: 1,
      terms: 'logs', termT0: 14.6, ball: { angle: ball(f.t), lit: 1, sparkle: 1 },
      records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardRing: 1, boardLine: 1,
    });
  }

  // 17. "The logs are lining up now": the music lands, the floor lights in waves and the log lines
  //     lying on it snap into rows on the kicks. Clawd starts dancing.
  const ROW_Z = [-6, -5, -4, -3, -2, -1, 0, 1];
  shots.push(shot('c17-logs', B(100), B(104), ({ scene, camera }) => {
    const logs = new FloorLogs(ROW_Z);
    const c = new DiscoClawd();
    const CL = new THREE.Vector3(0.4, 0, -2.5);
    const pool = lightPool(1.4, '#ffe0f4', 0.35);
    pool.position.set(CL.x, 0.04, CL.z);
    scene.add(logs.root, c.root, pool);
    // three rows snap in on "lining", three on "up", two on "now"
    const SNAP = [B(102), B(101), B(102), B(101), B(103), B(102), B(101), B(103)];
    return (f, s) => {
      chorusState(s, f);
      logs.set(f.t, B(99), i => easeOutBack(clamp((f.t - SNAP[i]) / 0.16), 1.8), i => decay(f.t - SNAP[i], 0.18));
      const b = f.clock.beat(f.t);
      const dn = mixDance(dance('bounce', b, 0.35 + 0.65 * clamp((b - 100) / 2)), dance('point', b, 1), clamp((b - 101.85) / 0.3));
      c.root.position.set(CL.x + dn.x, dn.y, CL.z);
      c.set(DISCO_MOODS.excited, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 0.2 }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.5, 0.1, k), lerp(8.4, 7.3, k), lerp(7.6, 6.5, k), 0, 0.3, lerp(-2.9, -2.4, k));
    };
  }));

  // 18. "The timeline makes it clear": the CLUB PROD sign flickers off and a neon timeline slides
  //     in across it, event markers popping up one after another on every half beat. Clawd, down
  //     on the floor, points up at it.
  const TL = new THREE.Vector3(0, 8.05, WALL_Z + 0.42);
  const tlSlide = (t: number) => lerp(34, 0, easeOutCubic(clamp((t - B(104) + 0.15) / 0.75))) - (t - B(104)) * 0.22;
  /** The sign gives the wall up to the timeline: it flickers out as the timeline arrives. */
  const signOff = (t: number) => {
    const k = clamp((t - B(104) + 0.12) / 0.35);
    return k >= 1 ? 0.08 : k <= 0 ? 0.55 : hash(Math.floor(t * 24), 47) < k ? 0.08 : 0.55;
  };
  const before = (tl: Timeline) => tl.markerX.map((x, j) => ({ x, j })).filter(m => m.x < Timeline.TAG_X);
  const FAILURE = W(19, 4);
  const markerPop = (tl: Timeline, f: Frame) => {
    const pre = before(tl);
    return (j: number) => {
      const k = pre.findIndex(m => m.j === j);
      // the ones before the commit pop in order on the half beats; the ones after the X are the
      // failure's fallout and cascade in red just after it lands
      const at = k >= 0 ? f.clock.beatTime(104.5 + k * 0.5) : FAILURE + 0.15 + (j - pre.length) * 0.07;
      return clamp((f.t - at) / 0.2);
    };
  };
  shots.push(shot('c18-timeline', B(104), B(108), ({ scene, camera }) => {
    const tl = new Timeline();
    tl.root.position.copy(TL);
    const c = new DiscoClawd();
    const CL = new THREE.Vector3(-1.7, 0, -1.2);
    scene.add(tl.root, c.root);
    return (f, s) => {
      chorusState(s, f);
      s.sign = signOff(f.t);
      tl.set(f.t, { slide: tlSlide(f.t), pop: markerPop(tl, f), tag: 0, cross: -1 });
      const dn = dance('point', f.clock.beat(f.t), 1);
      c.root.position.set(CL.x + dn.x, 0, CL.z);
      c.set(DISCO_MOODS.excited, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 0.2 }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(-1.2, -0.5, k), lerp(0.95, 1.05, k), lerp(5.6, 5.1, k), lerp(-0.3, 0.5, k), 4.85, WALL_Z);
    };
  }, { fov: 46 }));

  // 19. "One change before the failure": closer: the commit tag lights gold, and on "failure" a
  //     big red X slams down just after it, the events after it cascading in red.
  shots.push(shot('c19-commit', B(108), B(111), ({ scene, camera }) => {
    const tl = new Timeline();
    tl.root.position.copy(TL);
    scene.add(tl.root);
    return (f, s) => {
      chorusState(s, f);
      s.sign = 0.08;
      const slide = tlSlide(f.t);
      const lit = f.t - (B(108) + 0.06);
      tl.set(f.t, { slide, pop: markerPop(tl, f), tag: lit < 0 ? 0 : clamp(lit / 0.15) + clamp(lit / 0.15) * decay(lit - 0.15, 0.3) * 0.3, cross: f.t - FAILURE });
      const k = easeInOutCubic(f.p);
      const x = TL.x + slide + (Timeline.TAG_X + Timeline.X_X) / 2;
      aimCam(camera, x + lerp(0.5, 0.15, k), lerp(7.35, 7.55, k), lerp(-3.2, -4.6, k), x, 8.3, WALL_Z);
      shake(camera, f, FAILURE, 0.07, 0.2);
    };
  }));

  // 20. "One signal pointing here": a big neon arrow over the floor flickers on, spins round and
  //     points straight down at one tile; it lights gold and Clawd hops onto it.
  const ARROW_TILE: [number, number] = [8, 4];
  const TILE = tileCenter(...ARROW_TILE);
  const ARROW_AT = new THREE.Vector3(TILE.x, 5.6, TILE.z);
  const ON = W(20, 0), SPIN = W(20, 1), HERE = W(20, 3);
  const SETTLE = HERE - 0.06;
  const arrowAngle = (t: number) => {
    if (t < SPIN) return Math.PI;
    if (t < SETTLE) return Math.PI - 3.5 * Math.PI * easeOutCubic((t - SPIN) / (SETTLE - SPIN));
    return -Math.PI / 2 + 0.22 * Math.sin((t - SETTLE) * 24) * decay(t - SETTLE, 0.16);
  };
  shots.push(shot('c20-arrow', B(111), B(115), ({ scene, camera }) => {
    const arrow = new NeonArrow(PAL.cyan);
    arrow.root.position.copy(ARROW_AT);
    const shaftMat = lightMat(PAL.gold, 0, beamTexture());
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.3, ARROW_AT.y - NeonArrow.TIP), shaftMat);
    shaft.position.set(TILE.x, (ARROW_AT.y - NeonArrow.TIP) / 2, TILE.z - 0.12); // behind Clawd and the arrow, not level
    const c = new DiscoClawd();
    const FROM = new THREE.Vector3(-1.0, 0, -2.3);
    const land = new Burst(PAL.gold, 12);
    land.root.position.set(TILE.x, 0.12, TILE.z + 0.4);
    scene.add(arrow.root, shaft, c.root, land.root);
    return (f, s) => {
      chorusState(s, f);
      s.sign = 0.35;
      const pointed = f.t >= HERE;
      s.floor = goldTile(waveFloor(), ARROW_TILE, ff => (ff.t >= HERE ? 0.75 + 0.25 * Math.sin(ff.t * 8) : 0));
      const b = f.clock.beat(f.t);
      arrow.set(f.t, clamp((f.t - ON) / 0.3), b * 4, arrowAngle(f.t));
      shaftMat.opacity = pointed ? 0.32 * clamp((f.t - HERE) / 0.08) : 0;
      // Clawd side-steps, watching the arrow, then hops onto the tile on "here"
      const HOP0 = HERE - 0.12, HOP1 = B(114);
      const u = clamp((f.t - HOP0) / (HOP1 - HOP0));
      const e = easeInOutCubic(u);
      const dn = dance('side', b, 0.8);
      if (f.t < HOP0) c.root.position.set(FROM.x + dn.x, 0, FROM.z);
      else c.root.position.set(lerp(FROM.x, TILE.x, e), Math.sin(u * Math.PI) * 0.9, lerp(FROM.z, TILE.z, e));
      const landed = f.t - HOP1;
      let pose = dn.pose;
      if (f.t >= HOP0) pose = P({ armL: lerp(0.4, 1.0, u), armR: lerp(0.4, 1.0, u), squash: -0.25 * Math.sin(u * Math.PI) });
      if (landed >= 0) pose = P({ armR: 1.15, armL: -0.6, lean: -0.1, squash: 0.35 * decay(landed, 0.1) });
      c.set(landed >= 0 ? DISCO_MOODS.smug : DISCO_MOODS.excited, pose, { shades: 1, jiggle: landed >= 0 ? Math.sin(landed * 30) * decay(landed, 0.2) : dn.jiggle, puff: landed >= 0 ? 0.5 : 0.2 }, f.t);
      land.set(landed, 1.6);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.0, 0.5, k), lerp(2.6, 2.9, k), lerp(7.8, 7.0, k), lerp(0.6, 0.8, k), 3.0, -3.0);
      shake(camera, f, HOP1, 0.05, 0.15);
    };
  }));

  // 21. "The traces tell the same story": in the booth every screen draws its own trace, until on
  //     "same" they all snap to the same one and pulse together. Clawd conducts them with a baton.
  const SAME = W(21, 4);
  // the baton's beat pattern (right arm angle on beats 1 to 4 of the bar: down, in, out, up)
  const CONDUCT = [-0.35, 1.05, 0.25, 1.45];
  const conduct = (b: number) => {
    const n = Math.floor(b), ph = b - n;
    const a = CONDUCT[((n % 4) + 4) % 4], z = CONDUCT[(((n + 1) % 4) + 4) % 4];
    // arrive on the beat with a little ictus bounce, then float to the next point
    return lerp(a, z, easeInOutCubic(clamp((ph - 0.15) / 0.85))) - 0.12 * decay(ph, 0.06);
  };
  shots.push(shot('c21-traces', B(115), B(120), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    const baton = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.035), glowMat('#fff4fb', 1.3));
    stick.position.set(0.3, 0, 0);
    const tipGlow = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), glowMat(PAL.cyan, 2.6));
    tipGlow.position.set(0.62, 0, 0.001);
    baton.add(stick, tipGlow);
    baton.position.set(ARM_LEN + 0.02, 0, 0.07);
    c.paw.add(baton);
    scene.add(c.root);
    return (f, s) => {
      chorusState(s, f);
      s.crowdMask = clearBooth;
      s.terms = 'sync'; s.termT0 = B(115) - 0.15;
      s.termSync = clamp((f.t - SAME + 0.05) / 0.25);
      const b = f.clock.beat(f.t);
      const arm = conduct(b);
      const big = 1 + 0.5 * clamp((f.t - SAME) / 0.3);
      c.set(f.t >= SAME ? DISCO_MOODS.smug : DISCO_MOODS.focused, P({ armR: arm * big, armL: 0.25 + 0.3 * Math.sin(b * Math.PI) * big, lean: 0.06 * Math.sin(b * Math.PI), squash: 0.12 * decay(b - Math.floor(b), 0.08) }), { shades: 1, jiggle: Math.sin(b * Math.PI * 2) * 0.5, puff: 0.3 + 0.3 * clamp((f.t - SAME) / 0.3) }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.4, 0.0, k), lerp(3.5, 3.15, k), lerp(-2.2, -4.0, k), 0, lerp(2.95, 2.75, k), -9);
    };
  }));

  // 22. "The evidence has won": at the board the photos slide into one straight line and the string
  //     pulls taut with a twang; cut on "won" to the meter slamming into the red, Clawd triumphant.
  const EVIDENCE = W(22, 1), HAS = W(22, 2), WON = W(22, 3);
  const CL_BOARD = new THREE.Vector3(8.0, 0, -8.3);
  shots.push(shot('c22-board', B(120), WON, ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_BOARD);
    const pool = lightPool(1.3, '#ffe9c4', 0.35);
    pool.position.set(CL_BOARD.x, 0.02, CL_BOARD.z);
    scene.add(c.root, pool);
    return (f, s) => {
      chorusState(s, f);
      s.boardLine = easeOutBack(clamp((f.t - EVIDENCE) / 0.3), 2.2);
      s.boardTwang = decay(f.t - (EVIDENCE + 0.3), 0.18) + decay(f.t - HAS, 0.16);
      const point = clamp((f.t - EVIDENCE) / 0.15);
      c.set(f.t >= HAS ? DISCO_MOODS.certain : DISCO_MOODS.smug, P({ armR: lerp(0.4, 0.95, point), armL: -0.5, lean: -0.08 * point, squash: 0.15 * decay(f.t - HAS, 0.1) }), { shades: 1, puff: 0.4 + 0.4 * point }, f.t);
      const k = easeInOutCubic(f.p);
      // Clawd bottom left, pointing up at the board, which fills the rest
      aimCam(camera, lerp(8.55, 8.85, k), lerp(2.2, 2.35, k), lerp(-0.6, -1.9, k), 9.7, lerp(2.7, 2.85, k), WALL_Z);
    };
  }));
  shots.push(shot('c22-won', WON, B(124), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    const pop = new Burst(PAL.gold, 14);
    pop.root.position.set(BOOTH_SPOT.x, BOOTH_SPOT.y + 2.3, BOOTH_SPOT.z + 0.3);
    scene.add(c.root, pop.root);
    return (f, s) => {
      chorusState(s, f);
      s.crowdMask = clearBooth;
      const dt = f.t - WON;
      s.meter = 1 + 0.03 * Math.sin(f.t * 47);
      s.beams = 0.6;
      const up = easeOutBack(clamp(dt / 0.18), 2);
      c.set(DISCO_MOODS.triumphant, P({ armL: lerp(0.3, 1.25, up), armR: lerp(0.3, 1.25, up), squash: 0.3 * decay(dt, 0.1) - 0.1 * up, bounce: 0.15 * Math.sin(clamp(dt / 0.3) * Math.PI) }), { shades: 1, puff: lerp(0.8, 1.9, up), medal: decay(dt, 0.5), jiggle: Math.sin(dt * 18) * decay(dt, 0.3) }, f.t);
      pop.set(dt - 0.05, 2.4);
      // the meter in the foreground left, slammed into the red; Clawd behind it, arms up
      const k = easeOutCubic(f.p);
      aimCam(camera, lerp(-3.5, -3.3, k), lerp(2.05, 2.15, k), lerp(-4.3, -4.8, k), -1.25, 2.0, -9.0);
      shake(camera, f, WON, 0.06, 0.2);
    };
  }));

  // 23. "I think we finally found it": the bass drops out. Slow push in on Clawd alone under the
  //     disco ball, which starts to turn; he reaches into his afro and pulls out the handcuffs.
  //     Then the pause: the frame freezes on "it", and on the stab everything goes dark but one
  //     spotlight on him.
  const CL_MID = new THREE.Vector3(0, 0, -0.6);
  const LAMP = new THREE.Vector3(0.6, 10.6, -2.9);
  const REACH = W(23, 3), FOUND = W(23, 4), IT = W(23, 5);
  const midCam = (cam: THREE.PerspectiveCamera, k: number) =>
    aimCam(cam, 0, lerp(2.9, 1.62, k), lerp(8.6, CL_MID.z + 3.9, k), 0, lerp(2.2, 1.45, k), lerp(-2.0, CL_MID.z, k));
  let c23cam: THREE.PerspectiveCamera | null = null;
  shots.push(shot('c23-found', B(124), SWING, ({ scene, camera }) => {
    c23cam = camera;
    const c = new DiscoClawd();
    c.root.position.copy(CL_MID);
    const cuffsAt = dangleCuffs(c);
    const pool = lightPool(1.5, '#ffe9d0', 0.4);
    pool.position.set(CL_MID.x, 0.03, CL_MID.z);
    scene.add(c.root, pool);
    return (f, s, now) => {
      Object.assign(s, {
        floor: deadFloor(0.75), frozen: 1, alarm: 0.15, pars: 0.12, beams: 0, wallLight: 0.25, sign: 0.6,
        blackout: now.t >= STAB ? 1 : 0,   // on the stab the club goes dark round him
        terms: 'logs', termT0: 14.6, ball: { angle: ball(f.t), lit: lerp(0.4, 0.9, clamp((f.t - W(23, 1)) / 1.2)), sparkle: clamp((f.t - W(23, 1)) / 1.0) * 0.85 },
        records: { spin: f.t * 4.7, label: '/checkout' }, boardStrings: 1, boardFocus: 1, boardRing: 1,
      });
      const b = f.clock.beat(f.t);
      // groove gently, reach up into the afro on "finally", pull the cuffs out on "found"
      const reach = smooth(clamp((f.t - (REACH - 0.1)) / 0.22));
      const pull = easeOutBack(clamp((f.t - FOUND) / 0.25), 1.8);
      const dig = Math.sin(f.t * 30) * 0.08 * reach * (1 - pull);
      const dn = dance('groove', b, 0.4 * (1 - reach));
      const armR = lerp(lerp(dn.pose.armR, 1.5, reach) + dig, 0.55, pull);
      const lean = dn.pose.lean * (1 - reach) - 0.05 * pull;
      c.root.position.set(CL_MID.x + dn.x * (1 - reach), 0, CL_MID.z);
      c.set(f.t >= FOUND ? DISCO_MOODS.smug : DISCO_MOODS.focused, P({ ...dn.pose, armR, armL: lerp(dn.pose.armL, -0.55, reach), lean, squash: 0.12 * decay(f.t - FOUND, 0.1) }), { shades: 1, jiggle: dn.jiggle * (1 - reach) + 0.4 * reach * (1 - pull) * Math.sin(f.t * 30), puff: 0.3 + 0.4 * pull, medal: decay(f.t - IT, 0.4) }, f.t);
      cuffsAt(f.t >= FOUND, armR, lean, 0.25 * Math.sin((f.t - FOUND) * 7) * decay(f.t - FOUND, 0.6));
      // the push runs until the freeze, then a quick punch in on the frozen frame
      const k = easeInOutCubic(clamp((f.t - B(124)) / (FREEZE - B(124))));
      midCam(camera, k);
      const punch = easeOutCubic(clamp((now.t - STAB) / 0.07)) * 0.55;
      camera.position.z -= punch;
    };
  }, {
    freeze: FREEZE,
    overlay(g, f) {
      if (f.t >= STAB && c23cam) {
        const sp1 = spotScreen(c23cam, f.w, f.h, CL_MID, 0.9, 2.2, LAMP);
        drawSpotlight(g, f.w, f.h, sp1, 0.85, 1);
      }
    },
  }));

  // 24. "The smoking gun": on the downbeat the spotlight swings off him and across the dark club,
  //     the camera crash-zooming after it; on the tick it lands on the Cache, holding a smoking
  //     revolver. On "gun" the band slams back in and the lights come up: hands up. Clawd
  //     knee-slides in from the floor and slaps the cuffs on it. The gun drops.
  const CACHE_AT = new THREE.Vector3(8.6, 0, -4.4);
  const CUFF_T = B(134);
  const CL_CUFF = new THREE.Vector3(CACHE_AT.x - 1.65, 0, CACHE_AT.z + 0.5);
  const SLIDE0 = IMPACT + 0.2, SLIDE1 = IMPACT + 0.75;
  let c24cam: THREE.PerspectiveCamera | null = null;
  const spotAt = (t: number) => {
    const u = easeInOutCubic(clamp((t - SWING) / (TICK - SWING)));
    const over = t > TICK ? 0.12 * Math.sin((t - TICK) * 30) * decay(t - TICK, 0.08) : 0;
    return new THREE.Vector3(lerp(CL_MID.x, CACHE_AT.x, u) + over, 0, lerp(CL_MID.z, CACHE_AT.z, u));
  };
  // the camera: a crash zoom from wide on the dark club to the Cache, accelerating, arriving on the
  // tick; a slow push on the reveal; then, with the lights, back out to a two-shot for the arrest
  const WIDE = [new THREE.Vector3(2.4, 4.4, 9.8), new THREE.Vector3(3.2, 1.4, -3.0)];
  const NEAR = [new THREE.Vector3(CACHE_AT.x - 1.5, 1.95, CACHE_AT.z + 5.3), new THREE.Vector3(CACHE_AT.x, 1.75, CACHE_AT.z)];
  const TWO = [new THREE.Vector3(CACHE_AT.x - 2.5, 1.95, CACHE_AT.z + 6.9), new THREE.Vector3(CACHE_AT.x - 0.85, 1.35, CACHE_AT.z)];
  const gunCam = (cam: THREE.PerspectiveCamera, t: number) => {
    const z = easeInCubic(clamp((t - SWING - 0.05) / (TICK - SWING - 0.05)));
    const p = WIDE[0].clone().lerp(NEAR[0], z), tg = WIDE[1].clone().lerp(NEAR[1], z);
    p.addScaledVector(tg.clone().sub(p).normalize(), easeInOutCubic(clamp((t - TICK) / (IMPACT - TICK))) * 0.6);
    const out = easeInOutCubic(clamp((t - IMPACT - 0.1) / 0.7));
    p.lerp(TWO[0], out);
    tg.lerp(TWO[1], out);
    aimCam(cam, p.x, p.y, p.z, tg.x, tg.y, tg.z);
  };
  shots.push(shot('c24-gun', SWING, B(136), ({ scene, camera, club }) => {
    c24cam = camera;
    const ca = new Cache();
    ca.root.position.copy(CACHE_AT);
    const gun = new Revolver();
    ca.hand.add(gun.root);
    const smoke = new Smoke();
    const cuffs = new Cuffs(0.3);
    cuffs.root.position.copy(Cache.CUFF_AT);
    ca.body.add(cuffs.root);
    const dropped = new Revolver();
    const drop = sweatDrop();
    const c = new DiscoClawd();
    const cuffsAt = dangleCuffs(c);
    const snap = new Burst(PAL.cyan, 12);
    snap.root.position.set(CACHE_AT.x, 1.05, CACHE_AT.z + 0.2);
    const fi = new Field();
    scene.add(ca.root, smoke.root, dropped.root, drop, c.root, snap.root, fi.root);
    const muzzle = new THREE.Vector3();
    // the dancers between the camera and the arrest step out of this shot
    const inTheWay = (i: number) => {
      const d = club.dancers[i];
      return (d.x > 2.5 && d.z > -2.5) || Math.hypot(d.x - CL_CUFF.x, d.z - CL_CUFF.z) < 1.6;
    };
    return (f, s) => {
      // camera first: the smoke below faces it
      gunCam(camera, f.t);
      shake(camera, f, TICK, 0.05, 0.12);
      shake(camera, f, IMPACT, 0.12, 0.3);
      const lights = f.t >= IMPACT;
      if (lights) {
        partyState(s, f);
        s.crowdFrozen = () => 1;   // the dancers don't believe it yet
      } else {
        Object.assign(s, {
          floor: deadFloor(0.6), frozen: 1, alarm: 0, pars: 0, beams: 0, wallLight: 0, sign: 0, blackout: 1,
          terms: 'off', ball: { angle: ball(f.t), lit: 0.15, sparkle: 0 }, records: { spin: f.t * 4.7, label: '/checkout' },
          boardStrings: 1, boardFocus: 1, boardRing: 1, boardLine: 1,
        });
      }
      s.crowdMask = i => !inTheWay(i);
      // the Cache: frozen in the light, smoking gun up by its face; on "gun" its hands go up; then cuffed
      const caught = f.t - TICK, up = f.t - IMPACT, cuffed = f.t >= CUFF_T;
      const hands = easeOutBack(clamp(up / 0.15), 2);
      const armR = cuffed ? 0 : lerp(0.25, 1.25, hands), armL = cuffed ? 0 : lerp(-0.9, 1.25, hands);
      ca.set(sp({
        armR, armL, cuffs: cuffed ? 1 : 0, shades: f.t > W(24, 1) + 0.5 ? smooth(clamp((f.t - W(24, 1) - 0.5) / 0.3)) : 0,
        open: up >= 0 ? 1.35 : caught >= 0 ? 1.15 : 1, brow: up >= 0 ? 1 : caught >= 0 ? 0.5 : 0,
        mouth: up >= 0 ? -1 : 0.6, squash: 0.3 * decay(caught, 0.08) + 0.35 * decay(up, 0.1),
        bob: 0.12 * Math.sin(clamp(up / 0.3) * Math.PI) * (up >= 0 ? 1 : 0), look: cuffed ? -0.6 : 0, wag: cuffed && f.t > CUFF_T + 0.45 ? 1 : 0,
      }), f.t);
      cuffs.root.visible = cuffed;
      gun.root.visible = !cuffed;
      gun.root.rotation.z = Math.PI / 2 - 0.2 - armR;   // the barrel up, whatever the arm does
      gun.root.position.set(0.02, 0.02, 0.02);
      // smoke curling from the muzzle (it's been smoking since before we got here)
      scene.updateMatrixWorld();
      gun.muzzle.getWorldPosition(muzzle);
      smoke.set(f.t, muzzle, SWING - 2, cuffed ? 0 : 1, camera);
      // the dropped gun: falls from where the hand was, spins, bounces once
      const fall = f.t - CUFF_T;
      dropped.root.visible = fall >= 0;
      if (fall >= 0) {
        const y0 = 2.05, land = Math.sqrt(y0 / 4.9);
        const y = fall < land ? y0 - 4.9 * fall * fall : 0.06 + Math.abs(Math.sin((fall - land) * 10)) * 0.18 * decay(fall - land, 0.12);
        dropped.root.position.set(CACHE_AT.x + 0.75 + fall * 0.6, Math.max(0.06, y), CACHE_AT.z + 0.35);
        dropped.root.rotation.z = fall < land ? 1.2 - fall * 9 : 0.15;
      }
      // the tiny Field peeks out from behind it once the lights are up, and ducks back as the
      // cuffs go on (nobody notices; it pays off on a rewatch)
      const peek = smooth(clamp((f.t - (IMPACT + 0.25)) / 0.2)) * (1 - smooth(clamp((f.t - (CUFF_T + 0.05)) / 0.15)));
      fi.root.position.set(CACHE_AT.x + lerp(0.1, 0.85, peek), 0, CACHE_AT.z - 0.35);
      fi.set(sp({ look: -0.9, open: 1 }), f.t);
      // a sweat drop rolls off it under the light
      const sw = f.t - (W(24, 1) + 0.2);
      drop.visible = sw > 0 && sw < 0.9 && !lights;
      drop.position.set(CACHE_AT.x - 0.42, 2.12 - sw * sw * 1.6, CACHE_AT.z + 0.1);
      // Clawd: knee-slides in from the floor once the lights are up, pops up beside it, cuffs held
      // high, and slaps them on
      const glide = clamp((f.t - SLIDE0) / (SLIDE1 - SLIDE0));
      const slide = easeOutCubic(glide);
      const popUp = clamp((f.t - SLIDE1) / 0.18);
      const kneel = glide > 0 && popUp < 1 ? 1 - smooth(popUp) : 0;
      // until then he's where the spotlight left him, frozen with the cuffs (dark once it's gone)
      c.root.visible = f.t < TICK || f.t >= SLIDE0;
      if (f.t < SLIDE0) {
        c.root.position.copy(CL_MID);
        c.set(DISCO_MOODS.smug, P({ armR: 0.55, armL: -0.55, lean: -0.05 }), { shades: 1, puff: 0.7 }, f.t);
        cuffsAt(true, 0.55, -0.05, 0);
        snap.set(f.t - CUFF_T, 1.1);
        return;
      }
      c.root.position.set(lerp(CL_CUFF.x - 3.6, CL_CUFF.x, slide), 0.12 * Math.sin(smooth(popUp) * Math.PI), CL_CUFF.z);
      const slap = clamp((f.t - (CUFF_T - 0.12)) / 0.12);
      const after = clamp((f.t - CUFF_T) / 0.2);
      const cArmR = cuffed ? lerp(0.15, -0.3, after) : lerp(lerp(1.3, 0.75, smooth(popUp)), 0.15, slap);
      const cArmL = cuffed ? lerp(0.6, 1.15, after) : lerp(1.25, 0.2, smooth(popUp));
      const cLean = -0.16 * kneel + 0.12 * slap * (1 - clamp((f.t - CUFF_T) / 0.3));
      c.set(cuffed ? DISCO_MOODS.smug : DISCO_MOODS.certain, P({
        armR: cArmR, armL: cArmL, lean: cLean, squash: 0.32 * kneel + 0.2 * decay(f.t - CUFF_T, 0.1),
      }), { shades: 1, puff: 0.9, medal: cuffed ? decay(f.t - CUFF_T, 0.5) : 0, jiggle: kneel * Math.sin(f.t * 40) * 0.4 }, f.t);
      cuffsAt(!cuffed, cArmR, cLean, 0.3 * Math.sin(f.t * 9) * (1 - 0.5 * slide));
      snap.set(f.t - CUFF_T, 1.1);
    };
  }, {
    overlay(g, f) {
      if (f.t < IMPACT && c24cam) {
        c24cam.updateMatrixWorld();
        const p = spotAt(f.t);
        const sp2 = spotScreen(c24cam, f.w, f.h, p, f.t < TICK ? 1.0 : 1.15, f.t < TICK ? 0.4 : 3.0, LAMP);   // tall enough for the smoke
        drawSpotlight(g, f.w, f.h, sp2, 0.95, 1);
      }
    },
  }));

  // ---- the break (instrumental): the victory dance -------------------------------------------
  // 24a. The dancers thaw one by one from Clawd outward and join in; the floor lights up round him
  //      (about half of it); the Handler leads the cuffed Cache away to the exit, wagging a finger.
  const ESCORT = [new THREE.Vector3(CACHE_AT.x, 0, CACHE_AT.z), new THREE.Vector3(12.2, 0, -5.0), new THREE.Vector3(15.6, 0, -5.6), new THREE.Vector3(16.3, 0, -7.4), new THREE.Vector3(18.4, 0, -9.3)];
  const ESC0 = B(136), ESC1 = B(147);
  const escortAt = (t: number) => {
    const u = clamp((t - ESC0) / (ESC1 - ESC0)) * (ESCORT.length - 1);
    const i = Math.min(ESCORT.length - 2, Math.floor(u));
    return ESCORT[i].clone().lerp(ESCORT[i + 1], u - i);
  };
  const THAW0 = B(136) + 0.05, THAW1 = BT(139.5);
  function escortCast(scene: THREE.Scene) {
    const ca = new Cache(), bo = new Bouncer();
    const cuffs = new Cuffs(0.3);
    cuffs.root.position.copy(Cache.CUFF_AT);
    ca.body.add(cuffs.root);
    scene.add(ca.root, bo.root);
    return (f: Frame, lookBack = 0) => {
      const p = escortAt(f.t), walking = f.t > ESC0 && f.t < ESC1;
      const step = walking ? Math.abs(Math.sin(f.clock.beat(f.t) * Math.PI)) : 0;
      ca.root.position.set(p.x, 0, p.z);
      ca.set(sp({ cuffs: 1, wag: 1, bob: 0.05 * step, lean: 0.04 * Math.sin(f.clock.beat(f.t) * Math.PI), shades: 0.4 + 0.6 * lookBack, mouth: 0.7, brow: -0.4, look: -0.8 * lookBack, turn: walking ? 0.5 * (1 - lookBack) : 0 }), f.t);
      bo.root.position.set(p.x - 1.15, 0, p.z - 0.45);
      bo.set(sp({ hold: 1, armR: 1.35, armL: 0.1, bob: 0.04 * step }), f.t);
    };
  }
  const thawOrder = (i: number, club: { dancers: { x: number; z: number }[] }) => {
    const d = club.dancers.map((d, k) => ({ k, r: Math.hypot(d.x - CL_MID.x, d.z - CL_MID.z) })).sort((a, b) => a.r - b.r);
    return d.findIndex(e => e.k === i) / Math.max(1, d.length - 1);
  };
  const victoryFloor = halfLit(CL_MID, f => lerp(1.5, 6.2, easeOutCubic(clamp((f.t - THAW0) / (THAW1 - THAW0 + 0.6)))));
  const victoryState = (s: ClubState, f: Frame) => {
    partyState(s, f);
    s.floor = victoryFloor;
  };
  shots.push(shot('b1-thaw', B(136), B(140), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_MID);
    const escort = escortCast(scene);
    const pops = club.dancers.map(() => new Burst(PAL.gold, 8));
    pops.forEach(p => scene.add(p.root));
    scene.add(c.root);
    return (f, s) => {
      victoryState(s, f);
      const thawAt = (i: number) => lerp(THAW0, THAW1, thawOrder(i, club));
      s.crowdFrozen = i => (f.t < thawAt(i) ? 1 : 0);
      pops.forEach((p, i) => {
        const d = club.dancers[i];
        p.root.position.set(d.x, 2.5, d.z + 0.3);
        p.set(f.t - thawAt(i), 1.1);
      });
      const dn = dance('point', f.clock.beat(f.t), 1);
      c.root.position.set(CL_MID.x + dn.x, 0, CL_MID.z);
      c.set(DISCO_MOODS.triumphant, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 0.9, medal: 0.4 }, f.t);
      escort(f);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(1.0, 0.4, k), lerp(4.2, 3.7, k), lerp(16.0, 14.2, k), lerp(1.4, 0.8, k), 4.3, -2.5);
    };
  }));

  // the groove: medium on Clawd and the thawed dancers behind him
  const grooveDance = (b: number): DanceOut => mixDance(dance('roll', b, 1), dance('shimmy', b, 1), clamp((b - 142) / 0.4));
  shots.push(shot('b2-groove', B(140), B(144), ({ scene, camera }) => {
    const c = new DiscoClawd();
    const escort = escortCast(scene);
    scene.add(c.root);
    return (f, s) => {
      victoryState(s, f);
      const dn = grooveDance(f.clock.beat(f.t));
      c.root.position.set(CL_MID.x + dn.x, 0, CL_MID.z);
      c.set(DISCO_MOODS.excited, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 0.9 }, f.t);
      escort(f);
      const k = easeInOutCubic(f.p);
      const a = lerp(-0.35, 0.3, k);
      aimCam(camera, Math.sin(a) * 4.4, lerp(1.45, 1.6, k), CL_MID.z + Math.cos(a) * 4.4, 0, 1.3, CL_MID.z - 0.6);
    };
  }));

  // at the rope: the Handler walks the Cache out; it looks back over its shades and wags its finger
  shots.push(shot('b3-escort', B(144), B(146), ({ scene, camera }) => {
    const escort = escortCast(scene);
    return (f, s) => {
      victoryState(s, f);
      const look = smooth(clamp((f.t - B(144) - 0.15) / 0.25));
      escort(f, look);
      const p = escortAt(f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, p.x - lerp(2.6, 2.2, k), 1.7, p.z + lerp(5.2, 4.6, k), p.x - 0.4, 1.45, p.z - 0.6);
    };
  }));

  // the ball at full sparkle, beams sweeping under it
  shots.push(shot('b4-ball', B(146), B(148), ({ camera }) => (f, s) => {
    victoryState(s, f);
    const k = easeInOutCubic(f.p);
    aimCam(camera, lerp(1.4, 0.6, k), lerp(7.3, 7.6, k), lerp(4.8, 4.0, k), 0, 9.1, -0.5, lerp(-0.08, 0.06, k));
  }));

  // everybody does the point, in unison, with Clawd out front
  shots.push(shot('b5-unison', B(148), B(150), ({ scene, camera }) => {
    const c = new DiscoClawd();
    scene.add(c.root);
    return (f, s) => {
      victoryState(s, f);
      s.crowdStyle = 0;
      s.floor = halfLit(CL_MID, () => 6.2);
      const dn = dance('point', f.clock.beat(f.t), 1);
      c.root.position.set(CL_MID.x + dn.x, 0, CL_MID.z + 1.2);
      c.set(DISCO_MOODS.triumphant, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 0.9 }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(-0.6, 0.6, k), 2.4, lerp(9.4, 8.8, k), 0, 2.1, -3.2);
    };
  }));

  // 24b. The pager on the bar buzzes again: PROD DOWN. (It never came back up.)
  shots.push(shot('b6-pager', B(150), B(152), ({ scene, camera }) => {
    const p = new Pager('PROD DOWN', '02:31 AM');
    p.root.position.set(-13.65, BAR.h + 0.005, -7.5);
    const m = martini();
    m.position.set(-12.75, BAR.h + 0.005, -7.85);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), lightMat('#ff3240', 0));
    glow.position.set(-13.65, BAR.h + 0.35, -7.56);
    scene.add(p.root, m, glow);
    return (f, s) => {
      victoryState(s, f);
      const beats = f.clock.beat(f.t) - 150;
      const ring = beats >= 0.15 && beats % 1 < 0.5;
      const chars = clamp(Math.floor((f.t - B(150) - 0.2) / 0.05), 0, 9);
      p.set(f.t, ring ? 1 : 0, chars, ring);
      m.rotation.z = ring ? Math.sin(f.t * 60) * 0.03 : 0;
      (glow.material as THREE.MeshBasicMaterial).opacity = ring ? 0.3 : 0.1;
      const k = easeOutCubic(f.p);
      aimCam(camera, lerp(-13.2, -13.35, k), lerp(1.95, 1.88, k), lerp(-5.0, -5.6, k), -13.5, 1.66, -7.6, lerp(0.05, -0.02, k));
    };
  }));

  // the needle skids across the record
  const SKID = B(152);
  shots.push(shot('b7-skid', B(152), B(153), ({ scene, camera }) => {
    scene.background = new THREE.Color('#0b0818');
    const tt = new Turntable();
    tt.paw.visible = false;
    scene.add(tt.root);
    return (f) => {
      const dt = f.t - SKID;
      tt.record.rotation.z = -(SKID * 4.7 + 4.7 * (dt - dt * dt / 0.6 * 0.5));
      const skid = easeOutCubic(clamp((dt - 0.02) / 0.14));
      tt.arm.rotation.z = lerp(-0.42, -0.95, skid) + 0.04 * Math.sin(dt * 70) * decay(dt, 0.1);
      tt.head.scale.setScalar(1 + 0.08 * decay(dt, 0.08));
      const head = new THREE.Vector3(0, -1.6, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(tt.arm.rotation.z)).add(tt.arm.position);
      tt.spark.root.position.set(head.x, head.y, 0.08);
      tt.spark.set(dt - 0.03, 1.6);
      frameCam(camera, 0.05, 0, 3.3);
      camera.rotation.z = 0.06;
      shake(camera, f, SKID + 0.03, 0.08, 0.15);
    };
  }, { club: false }));

  // the red comes back across the floor from the bar, the dancers freeze again as it reaches
  // them, the ball winds down, and Clawd freezes mid-point
  const RED0 = B(153), RED1 = B(153) + 0.9;
  const CLAWD_STOP = RED0 + 0.42;   // when the red reaches his tile
  const redFloor = redWave(victoryFloor, RED0, RED1 - RED0);
  const redState = (s: ClubState, f: Frame, club: { dancers: { x: number }[] }) => {
    partyState(s, f);
    const k = clamp((f.t - RED0) / 1.2);
    Object.assign(s, {
      floor: redFloor, alarm: k, beams: 1 - k, pars: lerp(1, 0.2, k), wallLight: lerp(1, 0.35, k), sign: f.t < RED0 + 1.1 ? (hash(Math.floor(f.t * 8), 41) < 0.6 ? 1 : 0.15) : 0.85,
      ball: { angle: ball(f.t), lit: lerp(1, 0.25, k), sparkle: 1 - k }, terms: f.t > RED0 + 0.3 ? 'error' : 'logs',
    });
    s.crowdFrozen = i => (f.t >= RED0 + ((club.dancers[i].x + 8.5) / 17) * (RED1 - RED0) ? 1 : 0);
  };
  shots.push(shot('b8-red', B(153), B(156), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    const pops = club.dancers.map(() => new Burst(PAL.red, 8));
    pops.forEach(p => scene.add(p.root));
    scene.add(c.root);
    return (f, s) => {
      redState(s, f, club);
      pops.forEach((p, i) => {
        const d = club.dancers[i];
        p.root.position.set(d.x, 2.5, d.z + 0.3);
        p.set(f.t - (RED0 + ((d.x + 8.5) / 17) * (RED1 - RED0)), 0.9);
      });
      const b = f.clock.beat(f.t);
      const live = f.t < CLAWD_STOP;
      const dn = live ? dance('point', b, 1) : dance('point', f.clock.beat(CLAWD_STOP), 1);
      c.root.position.set(CL_MID.x + dn.x, 0, CL_MID.z);
      const shock = clamp((f.t - CLAWD_STOP) / 0.12);
      c.set(live ? DISCO_MOODS.triumphant : DISCO_MOODS.ohno, dn.pose, { shades: lerp(1, 2, shock), jiggle: live ? dn.jiggle : 0, puff: 0.9 * (1 - shock * 0.3) }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.4, 0.2, k), lerp(3.7, 3.4, k), lerp(14.2, 12.8, k), 0.8, 4.0, -2.5);
    };
  }));

  // [oh no]: push in on him, frozen mid-point, while his afro slowly deflates
  const OH0 = B(156);
  const pointAtStop = (f: Frame) => dance('point', f.clock.beat(CLAWD_STOP), 1);
  shots.push(shot('b9-ohno', B(156), B(160), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_MID);
    const drops = [sweatDrop(), sweatDrop()];
    scene.add(c.root, ...drops);
    return (f, s) => {
      redState(s, f, club);
      const dn = pointAtStop(f);
      c.root.position.set(CL_MID.x + dn.x, 0, CL_MID.z);
      const deflate = smooth(clamp((f.t - OH0 - 0.4) / 1.8));
      c.set(DISCO_MOODS.ohno, P({ ...dn.pose, armR: lerp(dn.pose.armR, dn.pose.armR - 0.5, deflate), armL: lerp(dn.pose.armL, dn.pose.armL - 0.3, deflate), squash: 0.12 * deflate }), { shades: 2, puff: 0.6 * (1 - deflate), flat: 0.9 * deflate, jiggle: 0.15 * Math.sin(f.t * 20) * (1 - deflate) }, f.t);
      drops.forEach((d, i) => {
        const t0 = OH0 + 0.5 + i * 1.1, dt = f.t - t0;
        d.visible = dt > 0 && dt < 0.8;
        d.position.set(CL_MID.x + (i ? 0.55 : -0.6), 1.55 - dt * dt * 2.2, CL_MID.z + 0.25);
        d.scale.setScalar(0.9);
      });
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.3, 0.05, k), lerp(1.7, 1.62, k), lerp(CL_MID.z + 5.6, CL_MID.z + 3.5, k), 0, lerp(1.4, 1.5, k), CL_MID.z);
    };
  }));

  // he shakes it off, pushes his shades up and strides straight at the camera: back to work
  const SHAKE1 = BT(161.5), MARCH = B(162);
  shots.push(shot('b10-regroup', B(160), B(164), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    scene.add(c.root);
    return (f, s) => {
      redState(s, f, club);
      s.crowdMask = clearBooth;
      const dn = pointAtStop(f);
      const sh = clamp((f.t - B(160)) / (SHAKE1 - B(160)));
      const shakeIt = Math.sin(f.t * 42) * 0.16 * Math.sin(sh * Math.PI);
      const settle = smooth(clamp((f.t - B(160)) / 0.35));
      const march = clamp((f.t - MARCH) / (B(164) - MARCH));
      const z = lerp(CL_MID.z, CL_MID.z + 2.9, march);
      c.root.position.set(CL_MID.x, 0, z);
      const b = f.clock.beat(f.t);
      const strut = march > 0 ? Math.abs(Math.sin(b * Math.PI)) : 0;
      const pose = march > 0
        ? P({ armL: 0.2 + 0.5 * Math.max(0, Math.sin(b * Math.PI)), armR: 0.2 + 0.5 * Math.max(0, -Math.sin(b * Math.PI)), walk: b * 0.5, bounce: 0.15 * strut, lean: 0.05 * Math.sin(b * Math.PI) })
        : P({ armR: lerp(dn.pose.armR - 0.5, -0.4, settle), armL: lerp(dn.pose.armL - 0.3, -0.4, settle), lean: shakeIt, squash: 0.1 * Math.sin(f.t * 30) * Math.sin(sh * Math.PI) });
      const shadesUp = smooth(clamp((f.t - SHAKE1 + 0.15) / 0.25));
      c.set(f.t < SHAKE1 ? DISCO_MOODS.ohno : DISCO_MOODS.focused, pose, { shades: lerp(2, 0, shadesUp), flat: lerp(0.9, 0.3, smooth(sh)), jiggle: shakeIt * 3 }, f.t);
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.35, 0.15, k), lerp(1.75, 1.6, k), lerp(CL_MID.z + 5.4, CL_MID.z + 5.9, k), 0, lerp(1.5, 1.45, k), z - 0.5);
    };
  }));

  return shots;
}
