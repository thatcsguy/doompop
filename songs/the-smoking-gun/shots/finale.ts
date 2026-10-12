// The final chorus and the outro (2:37.6 to the end). Storyboard rows 57 to 66. Prod comes back:
// the error graphs on the wall drop flat and the ball spins up; the floor pops back into colour on
// the kicks and the dancers thaw; the same /checkout record goes back on the turntable and the
// request passes every tier of a building of dance floors; the patch survives a stampede; Clawd
// stamps out the last red tile (CASE CLOSED). Then he and the Chief walk over to the sulking Cache
// and lift it like a curtain over the held "it". Freeze, black, one spotlight: the tiny Field,
// holding the smoking gun. On "gun" the lights slam on and it grins: GOTCHA, for real this time.
// The outro is the party: Clawd takes the gun, blows the smoke off and spins it into a mic,
// confetti, everybody dances (the Field too), he sings the last lines into it while the credits
// roll up the terminal wall, and at the very end it's just him under the ball, a finger-gun, a
// wink, and an iris out.
import * as THREE from 'three';
import type { Frame, Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { clamp, decay, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { PAL, aimCam, cutout, frameCam, lightMat, ownGlow, radialTexture } from '../look';
import { inkedCircle, inkedRect, shapeMesh, circleShape, staticPlane } from '../../../engine/flat';
import { BALL, BOOTH_SPOT, CONSOLE, RISER, aliveFloor, clearBooth, tileCenter, type Club, type ClubState, type Painter } from '../club';
import { ARM_LEN, DiscoClawd, DISCO_MOODS, REST, dance, mixDance, type Pose } from '../clawd-disco';
import { Chief, cs } from '../chief';
import { Cache, Field, sp } from '../suspects';
import { Burst, Turntable, lightPool, sweatDrop } from '../props';
import { Revolver, Smoke, drawSpotlight, drawStamp, spotScreen } from '../evidence';
import { Confetti, Plaster, TierStack } from '../finale-props';
import { Dancer, STAND, outfit, type Body } from '../people';
import { screenAt } from '../lab';
import { ballTurn } from './chorus1';
import { shake, shot } from './common';

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const out = {} as Pose;
  for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = lerp(a[key], b[key], clamp(k));
  return out;
};

/** A prop held upright in Clawd's right paw, whatever the arm does (spin: extra turns, radians). */
function pawHold(c: DiscoClawd, prop: THREE.Object3D) {
  const hold = new THREE.Group();
  hold.position.set(ARM_LEN - 0.02, 0, 0.07);
  hold.add(prop);
  c.paw.add(hold);
  return (on: boolean, armR: number, lean: number, spin = 0) => {
    hold.visible = on;
    hold.rotation.z = -armR - lean + spin;
  };
}

/** A runner crossing the floor: arms and legs pumping, leaning into it. */
function runPose(ph: number, dir: number): Body {
  const s = Math.sin(ph);
  return { ...STAND, aL: 0.6 + 0.8 * s, aR: 0.6 - 0.8 * s, lL: Math.max(0.05, 0.85 * s), lR: Math.max(0.05, -0.85 * s), bob: 0.12 * Math.abs(s), lean: -0.14 * dir, turn: 0.45 };
}

export function finaleShots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const B = (i: number) => {
    if (!Number.isInteger(i)) throw new Error(`finale: B(${i}) needs a whole beat; use BT for a fraction`);
    return audio.beats[i];
  };
  const BT = (b: number) => { const n = Math.floor(b); return lerp(B(n), B(n + 1), b - n); };
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const END = audio.duration;
  const shots: Shot[] = [];

  // ---- the club coming back to life -------------------------------------------------------------
  const FINALLY = W(57, 3), FLATTEN = W(57, 4);
  const ALERTS = W(58, 1), BEGIN = W(58, 2), CLEAR = W(58, 4);
  const DONE = W(62, 4);
  // the ball: turning from "finally", full speed by "flattening", and it never stops again
  const BALL_T = { start: FINALLY, full: FLATTEN, stop: 1e9, halt: 1e9 + 1 };
  const ball = (t: number) => ballTurn(t, BALL_T);
  /** The graphs on the wall dropping flat, 0..1. */
  const flatK = (t: number) => smooth(clamp((t - (FLATTEN - 0.15)) / 0.55));
  // the floor: still green from the regression run; on the kicks of line 58 it pops back into disco
  // colours in batches. One stubborn tile pops red, and stays red until Clawd stamps it out.
  const POPS = [ALERTS, B(340), BEGIN, B(341), CLEAR];
  const LAST: [number, number] = [8, 6];
  const LAST_AT = tileCenter(LAST[0], LAST[1]);
  const popAt = (ix: number, iz: number) => POPS[Math.floor(hash(ix, iz, 77) * POPS.length)];
  const thawAt = (i: number) => POPS[Math.floor(hash(i, 78) * POPS.length)] + 0.05;
  const alive = aliveFloor(1.6);
  const finaleFloor: Painter = (ix, iz, f) => {
    const t = f.t, at = popAt(ix, iz);
    const b = f.clock.beat(t), ph = b - Math.floor(b);
    if (t < at) return { color: PAL.green, power: 1.15 + 0.18 * Math.exp(-ph * 4) * (0.6 + 0.4 * hash(ix, iz, 5)) };
    const last = ix === LAST[0] && iz === LAST[1];
    if (last && t < DONE) return { color: PAL.red, power: 1.3 + 0.45 * Math.exp(-ph * 4) + 0.9 * decay(t - at, 0.15) };
    // each tile pops in its own new colour (bright, then settling into the pattern)
    const flash = decay(t - (last ? DONE : at), last ? 0.3 : 0.16);
    const L = alive(ix, iz, f);
    return { color: L.color, power: L.power + 1.1 * flash };
  };
  /** A red warning sign bobbing over the last red tile until it's stamped out (a billboard: call
   *  after the camera is set). */
  function alertSign(scene: THREE.Scene) {
    const m = staticPlane(0.62, 0.56, 220, (g, W, H) => {
      g.lineJoin = 'round';
      g.beginPath(); g.moveTo(W / 2, H * 0.08); g.lineTo(W * 0.94, H * 0.9); g.lineTo(W * 0.06, H * 0.9); g.closePath();
      g.fillStyle = PAL.red; g.fill();
      g.strokeStyle = PAL.ink; g.lineWidth = W * 0.06; g.stroke();
      g.fillStyle = '#fff4f4';
      g.fillRect(W * 0.46, H * 0.34, W * 0.08, H * 0.3);
      g.beginPath(); g.arc(W / 2, H * 0.76, W * 0.05, 0, Math.PI * 2); g.fill();
    });
    cutout(m, 0.3);
    const mat = m.material as THREE.MeshBasicMaterial;
    scene.add(m);
    return (f: Frame, cam: THREE.Camera) => {
      const at = popAt(LAST[0], LAST[1]);
      const k = easeOutBack(clamp((f.t - at) / 0.25), 2.2) * (1 - easeInCubic(clamp((f.t - DONE) / 0.12)));
      m.visible = k > 0.01;
      if (!m.visible) return;
      const b = f.clock.beat(f.t);
      m.position.set(LAST_AT.x, 1.25 + 0.07 * Math.abs(Math.sin(b * Math.PI)), LAST_AT.z);
      m.scale.setScalar(1.25 * k * (1 + 0.08 * Math.exp(-(b - Math.floor(b)) * 5)));
      m.quaternion.copy(cam.quaternion);
      mat.color.setScalar(1.15 + 0.35 * Math.exp(-(b - Math.floor(b)) * 4));
    };
  }
  /** The club from line 57 on: green floor turning disco, alarm off, graphs flat, ball spinning. */
  function finaleState(s: ClubState, f: Frame) {
    const t = f.t;
    const party = smooth(clamp((t - ALERTS) / (CLEAR + 0.3 - ALERTS)));
    const spin = smooth(clamp((t - FINALLY) / 0.8));
    Object.assign(s, {
      floor: finaleFloor, frozen: 1, alarm: 0.35 * (1 - party), pars: lerp(0.45, 1, party), beams: lerp(0.15, 1, party),
      wallLight: lerp(0.7, 1, party), sign: 1,
      terms: 'graphs', termT0: 157.4, termSync: flatK(t),
      ball: { angle: ball(t), lit: lerp(0.65, 1, spin), sparkle: spin },
      records: { spin: t * 4.7, label: '/checkout' },
      boardStrings: 1, boardFocus: 1, boardRing: 1, boardLine: 1, boardCacheX: 1, boardPath: 1, boardRetarget: 1,
    });
    s.crowdFrozen = i => (t < thawAt(i) ? 1 : 0);
  }

  // 57. "The graphs are finally flattening": the booth, every screen behind Clawd an error graph
  //     in red. He waits, paws clasped, jiggling. On "flattening" they drop flat and go green (we
  //     see it, he feels it: the light on him goes green) and he jumps; the ball's light starts
  //     sweeping the wall as it spins up.
  shots.push(shot('f57-graphs', BT(334.5), B(339), ({ scene, camera }) => {
    const c = new DiscoClawd();
    scene.add(c.root);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.9, 0.45, k), lerp(2.25, 2.45, k), lerp(-2.3, -3.3, k), 0.15, lerp(3.2, 3.1, k), -9.8);
      finaleState(s, f);
      s.crowdMask = clearBooth;
      const yes = f.t - (FLATTEN + 0.25);
      const joy = smooth(clamp(yes / 0.25));
      const nerv = 0.05 * Math.sin(f.t * 34);
      const dn = dance('bounce', f.clock.beat(f.t), 1);
      const wait = P({ armL: 0.15 + nerv, armR: 0.15 - nerv, squash: 0.08, lean: nerv * 0.5, bounce: 0.02 * Math.abs(Math.sin(f.t * 17)) });
      const hop = yes > 0 ? Math.sin(clamp(yes / 0.38) * Math.PI) * 0.32 : 0;
      c.root.position.set(BOOTH_SPOT.x, BOOTH_SPOT.y + hop, BOOTH_SPOT.z);
      const green = flatK(f.t) > 0.5;
      c.set(yes > 0 ? DISCO_MOODS.triumphant : DISCO_MOODS.stressed, mixPose(wait, { ...dn.pose, armL: 1.3, armR: 1.3 }, joy), {
        shades: 1, jiggle: yes > 0 ? dn.jiggle : nerv * 4, puff: lerp(0.1, 0.9, joy),
        rimL: green ? PAL.green : PAL.pink, rimR: green ? PAL.green : PAL.cyan, rim: green ? 1.4 : 1,
      }, f.t);
    };
  }));

  // 58. "The alerts begin to clear": wide on the whole club, the ball at full speed up top. On the
  //     kicks the green floor pops back into colour in batches, the alarm dies, and the dancers
  //     thaw one by one (a gold pop each). One tile pops red instead.
  const CL_MID = new THREE.Vector3(0, 0, -0.6);
  shots.push(shot('f58-alerts', B(339), B(343), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    const pops = club.dancers.map(() => new Burst(PAL.gold, 8));
    pops.forEach(p => scene.add(p.root));
    const sign = alertSign(scene);
    scene.add(c.root);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(1.0, 0.4, k), lerp(4.3, 3.9, k), lerp(15.2, 13.6, k), lerp(0.8, 0.4, k), 4.5, -2.5);
      sign(f, camera);
      finaleState(s, f);
      pops.forEach((p, i) => {
        const d = club.dancers[i];
        p.root.position.set(d.x, 2.5, d.z + 0.3);
        p.set(f.t - thawAt(i), 1.1);
      });
      const b = f.clock.beat(f.t);
      const dn = mixDance(dance('groove', b, 0.7), dance('point', b, 1), smooth(clamp((f.t - BEGIN) / 0.4)));
      c.root.position.set(CL_MID.x + dn.x, 0, CL_MID.z);
      c.set(DISCO_MOODS.triumphant, dn.pose, { shades: 1, jiggle: dn.jiggle, puff: 0.7 }, f.t);
    };
  }));

  // 59. "The same request that broke it": top down on the decks. The /checkout record from the
  //     start drops back onto the platter on "same" and spins up; Clawd's paw takes the arm and
  //     brings it over, shaking; the needle touches down on "it".
  const SAME = W(59, 1), REQUEST = W(59, 2), IT59 = W(59, 5);
  shots.push(shot('f59-needle', B(343), B(347), ({ scene, camera }) => {
    scene.background = new THREE.Color('#0b0818');
    const tt = new Turntable();
    scene.add(tt.root);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), lightMat(PAL.violetNeon, 0.25, radialTexture()));
    glow.position.z = -0.1;
    const drop = sweatDrop();
    drop.scale.setScalar(1.6);
    scene.add(glow, drop);
    const head = new THREE.Vector3(), rot = new THREE.Matrix4();
    return (f) => {
      const k = easeInOutCubic(f.p);
      // the record: dropped in from above (big, then down onto the platter), a bounce, spinning up
      const land = easeInCubic(clamp((f.t - (SAME - 0.22)) / 0.22));
      const settle = f.t > SAME ? 0.05 * Math.abs(Math.sin((f.t - SAME) * 20)) * decay(f.t - SAME, 0.12) : 0;
      tt.record.position.set(-0.45, lerp(0.35, 0, land), 0.01 + (1 - land) * 0.5);
      tt.record.scale.setScalar(lerp(1.3, 1, land) + settle);
      tt.record.visible = f.t > SAME - 0.22;
      const sp = Math.max(0, f.t - SAME);
      tt.record.rotation.z = -4.7 * (sp - 0.35 * (1 - Math.exp(-sp / 0.35)));
      // the arm: the paw comes in for it on "request", swings it over (shaking), needle down on "it"
      const swing = easeInOutCubic(clamp((f.t - (REQUEST + 0.12)) / (IT59 - 0.15 - REQUEST - 0.12)));
      const jitter = f.t < IT59 ? 0.014 * Math.sin(f.t * 47) + 0.009 * Math.sin(f.t * 73) : 0;
      tt.arm.rotation.z = lerp(-0.05, -0.42, swing) + jitter * swing;
      const down = clamp((f.t - (IT59 - 0.15)) / 0.15);
      tt.head.scale.setScalar(lerp(1.12, 1, down));
      head.set(0, -1.6, 0).applyMatrix4(rot.makeRotationZ(tt.arm.rotation.z)).add(tt.arm.position);
      const reach = easeOutCubic(clamp((f.t - (REQUEST - 0.25)) / 0.35));
      const away = easeInOutCubic(clamp((f.t - IT59 - 0.05) / 0.3));
      tt.paw.position.set(lerp(head.x + 3.6, head.x + 0.05, reach) + away * 2.2, lerp(head.y - 0.8, head.y, reach) + away * 0.4, 0.06);
      tt.paw.scale.setScalar(lerp(1.08, 1, down));
      tt.spark.root.position.set(head.x, head.y, 0.08);
      tt.spark.set(f.t - IT59, 0.95);
      // a bead of sweat drips off the paw while it hovers
      const sw = f.t - (REQUEST + 0.35);
      drop.visible = sw > 0 && sw < 0.55;
      drop.position.set(head.x + 0.75, head.y + 0.3 - sw * sw * 3, 0.12);
      frameCam(camera, lerp(0.2, 0.55, k), lerp(0.05, -0.3, k), lerp(3.8, 2.7, k));
      camera.rotation.z = -0.05;
    };
  }, { club: false }));

  // 60. "Now passes every tier": the club as a building of dance floors, cut away. The request
  //     drops down the shaft and each floor lights up as it passes: EDGE, WEB, API, DB.
  const LIT = [W(60, 0), W(60, 1), W(60, 2), W(60, 3)];
  shots.push(shot('f60-tiers', B(347), BT(350.5), ({ scene, camera }) => {
    scene.background = new THREE.Color('#0d0a2a');
    const stack = new TierStack();
    scene.add(stack.root);
    return (f) => {
      // with the request down the building, then back to see every floor lit
      const down = easeInOutCubic(clamp((f.t - B(347)) / (LIT[3] + 0.1 - B(347))));
      const back = easeInOutCubic(clamp((f.t - (LIT[3] - 0.05)) / 0.35));
      frameCam(camera, 0.2, lerp(lerp(TierStack.TOP - 0.55, 1.4, down), TierStack.TOP / 2 + 0.45, back), lerp(3.6, 7.3, back));
      stack.set(f.t, f.clock.beat(f.t), LIT);
    };
  }, { club: false }));

  // 61. "The patch survived production": low on the floor where the seam was, now a sticking
  //     plaster with a face. A stampede of dancers runs across it; on "survived" one jumps and
  //     lands on it with both feet. On "production" it cheers: ends up, big grin.
  const PATCH_AT = new THREE.Vector3(-0.6, 0.012, -0.5);
  const SURVIVED = W(61, 2), PRODUCTION = W(61, 3);
  const RUN_V = 5.6;
  // when each runner is over the patch (the fourth is the jumper)
  const CROSS = [W(61, 0) + 0.02, W(61, 1) + 0.1, (W(61, 1) + SURVIVED) / 2 + 0.05, SURVIVED, SURVIVED + 0.28];
  const JUMPER = 3;
  shots.push(shot('f61-patch', BT(350.5), B(355), ({ scene, camera, club }) => {
    const patch = new Plaster();
    patch.root.position.copy(PATCH_AT);
    patch.root.scale.setScalar(1.25);
    const runners = CROSS.map((_, j) => new Dancer(outfit(30 + j * 3), j === JUMPER ? 1.0 : 0.86));
    runners.forEach(r => scene.add(r.root));
    const cheer = new Burst(PAL.gold, 14);
    cheer.root.position.set(PATCH_AT.x, 0.4, PATCH_AT.z - 0.45);
    const sign = alertSign(scene);
    scene.add(patch.root, cheer.root);
    const T0 = BT(350.5);
    return (f, s) => {
      // from the runners' height down onto the patch by the time it cheers
      const k = easeInOutCubic(clamp((f.t - T0) / (PRODUCTION + 0.25 - T0)));
      aimCam(camera, PATCH_AT.x + lerp(0.5, 0.25, k), lerp(1.7, 1.95, k), PATCH_AT.z + lerp(3.5, 2.3, k), PATCH_AT.x + 0.15, 0.45, PATCH_AT.z);
      shake(camera, f, SURVIVED, 0.07, 0.2);
      sign(f, camera);
      finaleState(s, f);
      s.crowdMask = i => Math.abs(club.dancers[i].z - PATCH_AT.z) > 1.3;
      let squash = 0, lastStomp = -1;
      runners.forEach((r, j) => {
        const dt = f.t - CROSS[j];
        let x = PATCH_AT.x + RUN_V * dt;
        let y = 0;
        let body = runPose(f.t * 15 + j * 1.7, 1);
        if (j === JUMPER) {
          // a big leap that comes down on the patch with both feet, a crouch, and off again
          const air = clamp((dt + 0.32) / 0.32);
          const stay = dt >= 0 && dt < 0.2;
          x = dt < 0 ? PATCH_AT.x + RUN_V * 0.7 * dt : stay ? PATCH_AT.x : PATCH_AT.x + RUN_V * (dt - 0.2);
          y = dt < 0 && dt > -0.32 ? Math.sin(air * Math.PI) * 0.75 : 0;
          if (dt > -0.32 && dt < 0) body = { ...STAND, aL: 2.4, aR: 2.4, lL: 0.5, lR: 0.5, lean: -0.1, turn: 0.2, bob: 0, hip: 0, squash: -0.3 };
          if (stay) body = { ...STAND, aL: 1.6, aR: 1.6, lL: 0.35, lR: 0.35, squash: 0.7 * decay(dt, 0.1) + 0.2, bob: -0.1 * decay(dt, 0.1), turn: 0.2, lean: 0, hip: 0 };
        }
        r.root.position.set(x, y, PATCH_AT.z - 0.08 + (j % 2) * 0.12);
        r.root.visible = x > PATCH_AT.x - 6 && x < PATCH_AT.x + 6;
        r.set(body, 0, f.t + j * 0.3, 1, j === JUMPER ? 0 : 0.3);
        // under a foot: squashed
        const over = Math.abs(x - PATCH_AT.x) < 0.62 && y < 0.1;
        if (over) squash = 1;
        if (f.t >= CROSS[j]) lastStomp = Math.max(lastStomp, CROSS[j]);
      });
      const yay = smooth(clamp((f.t - (PRODUCTION - 0.05)) / 0.15));
      patch.set(f.t, squash, yay, lastStomp > 0 ? f.t - lastStomp : -1);
      cheer.set(f.t - PRODUCTION, 0.8);
    };
  }));

  // 62. "The errors all are done": the one red tile left. Clawd points at it on "errors", crouches
  //     on "all", leaps on "are" and comes down on it on "done": it pops into colour, CASE CLOSED.
  const ERRORS = W(62, 1), ALL62 = W(62, 2), ARE = W(62, 3);
  shots.push(shot('f62-done', B(355), B(360), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    const pop = new Burst(PAL.gold, 16);
    pop.root.position.set(LAST_AT.x, 0.12, LAST_AT.z);
    pop.root.rotation.x = -Math.PI / 2;
    const pool = lightPool(1.3, '#fff2c4', 0);
    pool.position.set(LAST_AT.x, 0.03, LAST_AT.z);
    const sign = alertSign(scene);
    scene.add(c.root, pop.root, pool);
    const FROM = new THREE.Vector3(LAST_AT.x - 2.2, 0, LAST_AT.z + 0.35);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(LAST_AT.x - 1.6, LAST_AT.x - 1.1, k), lerp(1.8, 1.7, k), LAST_AT.z + lerp(5.6, 4.9, k), LAST_AT.x - 1.05, 1.2, LAST_AT.z);
      shake(camera, f, DONE, 0.1, 0.25);
      sign(f, camera);
      finaleState(s, f);
      s.crowdMask = i => Math.hypot(club.dancers[i].x - (LAST_AT.x - 1), club.dancers[i].z - LAST_AT.z) > 2.2;
      (pool.material as THREE.MeshBasicMaterial).opacity = 0.6 * decay(f.t - DONE, 0.5);
      pop.set(f.t - DONE, 3.2);
      const b = f.clock.beat(f.t);
      const point = smooth(clamp((f.t - ERRORS) / 0.12)) * (1 - smooth(clamp((f.t - ALL62) / 0.12)));
      const crouch = smooth(clamp((f.t - ALL62) / 0.2)) * (1 - smooth(clamp((f.t - ARE) / 0.06)));
      const air = clamp((f.t - ARE) / (DONE - ARE));
      const flying = f.t >= ARE && f.t < DONE, landed = f.t >= DONE;
      const u = landed ? 1 : flying ? air : 0;
      const dn = dance('groove', b, 0.7);
      const party = dance('point', b, 1);
      const after = smooth(clamp((f.t - DONE - 0.45) / 0.3));
      c.root.position.set(lerp(FROM.x, LAST_AT.x, u) + (u === 0 ? dn.x * (1 - crouch - point) : 0), flying ? Math.sin(air * Math.PI) * 0.6 : 0, lerp(FROM.z, LAST_AT.z, u));
      let pose = P({ ...dn.pose });
      pose = mixPose(pose, P({ armR: 0.25, armL: -0.3, lean: -0.08 }), point);
      pose = mixPose(pose, P({ squash: 0.45, armL: -0.6, armR: -0.6, lean: 0.05 }), crouch);
      if (flying) pose = P({ armL: 1.3, armR: 1.3, squash: -0.3, lean: -0.1 });
      if (landed) pose = mixPose(P({ squash: 0.5 * decay(f.t - DONE, 0.12), armL: 1.2, armR: 1.2 }), party.pose, after);
      c.set(landed ? DISCO_MOODS.triumphant : point > 0.3 ? DISCO_MOODS.certain : DISCO_MOODS.eager, pose, {
        shades: 1, puff: landed ? 1.1 : 0.5, jiggle: landed ? party.jiggle * after + Math.sin(f.t * 30) * decay(f.t - DONE, 0.2) : dn.jiggle * 0.6, medal: decay(f.t - DONE, 0.5),
      }, f.t);
    };
  }, {
    overlay(g, f) { drawStamp(g, f, DONE + 0.06, 'CASE CLOSED', { x: 0.3, y: 0.36, rot: -0.12, size: 128 }); },
  }));

  // ---- the real culprit ---------------------------------------------------------------------------
  // The Cache, sulking at the front right of the floor since chorus 2; the tiny Field hides
  // straight behind it, holding the smoking gun.
  const CACHE_AT = new THREE.Vector3(4.9, 0, 0.35);
  const FIELD_AT = new THREE.Vector3(CACHE_AT.x + 0.02, 0, CACHE_AT.z - 0.42);
  const WE = W(63, 2), FOUND = W(63, 3), IT = W(63, 4);
  const FREEZE = lyrics.lines[62].end;
  // the band drops out (the envelope falls away) a moment after the held note ends
  const BLACK = (() => {
    const e = audio.envelopes, fps = e.fps;
    for (let i = Math.ceil((FREEZE - 0.1) * fps); i < Math.min(e.rms.length, (FREEZE + 0.8) * fps); i++) if (e.rms[i] < 0.3) return i / fps;
    return FREEZE + 0.2;
  })();
  const THE64 = W(64, 0);
  const GUN = audio.hits.impact.find(h => h.t > THE64 + 0.6 && h.t < THE64 + 1.6)?.t ?? B(376);
  // where they hold it up (high enough to see the Field under it)
  const CL_LIFT = new THREE.Vector3(CACHE_AT.x - 1.25, 0, CACHE_AT.z + 0.18);
  const CH_LIFT = new THREE.Vector3(CACHE_AT.x + 1.62, 0, CACHE_AT.z + 0.12);
  const HIGH = 0.72;

  /** Two cartoon eyes in the dark (the Field, before we see it). open: 0 shut..1 (over 1 = wide);
   *  look: -1 left..1 right; wide: a scale for the stare. */
  function peepers() {
    const root = new THREE.Group();
    const lids: THREE.Group[] = [], pupils: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.x = side * 0.075;
      eye.add(inkedCircle(0.05, '#fffbe8', 0.014));
      const pupil = shapeMesh(circleShape(0.024), PAL.ink, 0.004, 12);
      eye.add(pupil);
      root.add(eye);
      lids.push(eye);
      pupils.push(pupil);
    }
    return {
      root,
      set(open: number, look: number, wide = 1) {
        root.visible = open > 0.02;
        lids.forEach(e => e.scale.set(wide, Math.max(0.05, Math.min(1, open)) * wide * 1.15, 1));
        pupils.forEach(p => p.position.set(look * 0.024, -0.004, 0.004));
      },
    };
  }

  /** The Field with the smoking gun: a revolver nearly its own size, barrel up, in its right hand. */
  function fieldWithGun(scene: THREE.Scene) {
    const fi = new Field();
    fi.showArms = true;
    fi.root.position.copy(FIELD_AT);
    const gun = new Revolver();
    gun.root.scale.setScalar(0.5);
    fi.hand.add(gun.root);
    const smoke = new Smoke(14);
    scene.add(fi.root, smoke.root);
    const muzzle = new THREE.Vector3();
    return {
      fi, gun,
      /** armR: the gun arm (0 out sideways); smoking: 0..1; call after the camera is set. */
      set(f: Frame, o: { armR?: number; look?: number; open?: number; mouth?: number; squash?: number; bob?: number; smoking?: number; armL?: number }, cam: THREE.Camera) {
        const armR = o.armR ?? 0.9;
        fi.set(sp({ armR, armL: o.armL ?? -0.6, look: o.look ?? 0, open: o.open ?? 1, mouth: o.mouth ?? 0, squash: o.squash ?? 0, bob: o.bob ?? 0 }), f.t);
        gun.root.rotation.z = Math.PI / 2 - 0.25 - armR;   // barrel up, whatever the arm does
        gun.root.position.set(0.02, 0.0, 0.02);
        scene.updateMatrixWorld();
        gun.muzzle.getWorldPosition(muzzle);
        smoke.set(f.t, muzzle, IT - 3, o.smoking ?? 1, cam, 6, 1.4);
        smoke.root.scale.setScalar(1);
      },
    };
  }

  // 63. "All because we found it": the two of them strut across the floor side by side, in step,
  //     toward the Cache at the front right; a look at each other on "we".
  shots.push(shot('f63-walk', B(360), B(364), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    const ch = new Chief();
    const ca = new Cache();
    ca.root.position.copy(CACHE_AT);
    scene.add(c.root, ch.root, ca.root);
    return (f, s) => {
      const u = clamp((f.t - B(360)) / (B(364) - B(360)));
      const cx = lerp(0.2, 2.75, u), chx = cx + 1.45;
      const mid = (cx + chx) / 2;
      aimCam(camera, mid + 0.4, 1.5, 0.75 + 5.6, mid + 1.05, 1.15, 0.75);
      finaleState(s, f);
      s.crowdMask = i => !(club.dancers[i].z > -0.6 && club.dancers[i].x > -2 && club.dancers[i].x < 5.5);
      const b = f.clock.beat(f.t);
      const step = Math.abs(Math.sin(b * Math.PI));
      const nod = decay(f.t - WE, 0.18);
      c.root.position.set(cx, 0, 0.75);
      c.set(DISCO_MOODS.smug, P({ walk: b * 0.5, bounce: 0.06 * step, squash: 0.08 * (1 - step) + 0.15 * nod, armL: 0.15 + 0.25 * Math.sin(b * Math.PI), armR: 0.15 - 0.25 * Math.sin(b * Math.PI), lean: 0.05 * Math.sin(b * Math.PI) }), {
        shades: 1, puff: 0.8, jiggle: Math.cos(b * Math.PI * 2) * 0.6,
      }, f.t);
      ch.root.position.set(chx, 0, 0.62);
      ch.set(cs({ walk: (f.t - B(360)) * 1.08, look: f.t > WE - 0.1 && f.t < WE + 0.6 ? -0.9 : 0.4, brow: lerp(0.2, 0.6, nod), bob: -0.05 * nod, sip: 0 }), f.t);
      ca.set(sp({ shades: 0.85, mouth: -0.6, brow: -0.6, look: -0.6, armL: -1.15, wag: 0 }), f.t);
    };
  }));

  // 63, held "it": on "found" they take a side each, and over the long note they lift it like a
  //     stage curtain, slowly, straining. The Cache goes up with its legs dangling, indignant; smoke
  //     curls out from under it, and in the dark under there two eyes open and dart about. Freeze;
  //     the band drops out; black.
  let c63cam: THREE.PerspectiveCamera | null = null;
  const liftAt = (t: number) => {
    const k = clamp((t - IT) / (FREEZE - IT));
    return 0.24 * easeInOutCubic(k) + 0.03 * Math.max(0, Math.sin(t * 9)) * (k > 0 && k < 1 ? 1 : 0);
  };
  shots.push(shot('f63-lift', B(364), BLACK, ({ scene, camera, club }) => {
    c63cam = camera;
    const c = new DiscoClawd();
    const ch = new Chief();
    const ca = new Cache();
    // under it: a dark gap opening as it goes up, a pair of eyes in there, smoke curling out
    const gapMat = new THREE.MeshBasicMaterial({ color: '#06030d', transparent: true, opacity: 0, depthWrite: false });
    const gap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gapMat);
    const eyes = peepers();
    eyes.root.position.set(FIELD_AT.x, 0.46, CACHE_AT.z - 0.045);
    const wisps = new Smoke(8);
    const drop = sweatDrop();
    scene.add(c.root, ch.root, ca.root, drop, gap, eyes.root, wisps.root);
    const leak = new THREE.Vector3();
    return (f, s, now) => {
      const k = easeInOutCubic(clamp((f.t - FOUND) / (FREEZE - FOUND)));
      aimCam(camera, CACHE_AT.x + lerp(0.15, 0.05, k), lerp(1.25, 0.95, k), CACHE_AT.z + lerp(5.0, 3.9, k), CACHE_AT.x, lerp(1.2, 0.85, k), CACHE_AT.z);
      camera.position.z -= easeOutCubic(clamp((now.t - FREEZE) / 0.07)) * 0.5;
      finaleState(s, f);
      s.blackout = now.t >= BLACK - 0.02 ? 1 : 0;
      s.crowdMask = i => {
        const d = club.dancers[i];
        return Math.hypot(d.x - CACHE_AT.x, d.z - CACHE_AT.z) > 2.6 && !(d.z > CACHE_AT.z && Math.abs(d.x - CACHE_AT.x) < 3.5);
      };
      const see = smooth(clamp((f.t - IT) / 1.2));
      s.crowdGasp = () => see;
      const lift = liftAt(f.t);
      const strain = f.t > IT ? 1 : 0;
      const grab = smooth(clamp((f.t - FOUND + 0.05) / 0.18));
      const shiver = 0.04 * Math.sin(f.t * 41) * strain;
      // Clawd, left of it, paws under its corner
      c.root.position.copy(CL_LIFT);
      c.set(strain ? DISCO_MOODS.stressed : DISCO_MOODS.certain, P({ armR: lerp(-0.2, 0.35 + lift * 1.5, grab) + shiver, armL: lerp(-0.2, 0.6, grab) - shiver, squash: 0.2 * strain + 0.1 * Math.abs(Math.sin(f.t * 7)) * strain, lean: 0.06 * grab }), {
        shades: 1, puff: 0.6, jiggle: shiver * 5,
      }, f.t);
      // the Chief, right of it (flipped, so his free arm is on its side), coffee in the other hand
      ch.root.position.copy(CH_LIFT);
      ch.set(cs({ turn: Math.PI, armR: lerp(0.15, 1.05 + lift * 0.8, grab), lean: -0.04 * strain, brow: 0.5, look: 0.7, bob: -0.03 * strain }), f.t);
      // the Cache: lifted, legs dangling, outraged
      ca.root.position.set(CACHE_AT.x, lift, CACHE_AT.z);
      ca.set(sp({ shades: 0.2, open: 1.3, brow: 0.9, mouth: -1, armL: 0.4 + 0.3 * Math.sin(f.t * 12) * strain, armR: 0.4 - 0.3 * Math.sin(f.t * 12) * strain, squash: -0.1 * strain, wag: 0 }), f.t);
      const bottom = Cache.Y - Cache.H / 2 + lift;
      gap.scale.set(Cache.W * 0.88, bottom, 1);
      gap.position.set(CACHE_AT.x, bottom / 2, CACHE_AT.z - 0.06);
      gapMat.opacity = 0.94 * smooth(clamp(lift / 0.06));
      // the eyes open in the dark, dart left and right, blink, and stare straight out at the freeze
      const u = f.t - IT;
      eyes.set(u < 1.6 ? 0 : u < 1.75 ? (u - 1.6) / 0.15 : Math.abs(u - 2.55) < 0.07 ? 0.1 : 1, u < 2.0 ? 0 : u < 2.35 ? -1 : u < 2.75 ? 1 : 0, f.t > FREEZE - 0.3 ? 1.2 : 1);
      leak.set(FIELD_AT.x + 0.3, bottom - 0.04, CACHE_AT.z + 0.05);
      wisps.set(f.t, leak, IT + 0.8, 0.65 * smooth(clamp(lift / 0.08)), camera, 3, 1.2);
      // a bead of sweat off Clawd on the strain
      const sw = f.t - (IT + 1.2);
      drop.visible = sw > 0 && sw < 0.6;
      drop.position.set(CL_LIFT.x + 0.55, 1.6 - sw * sw * 2.2, CL_LIFT.z + 0.2);
      drop.scale.setScalar(0.8);
    };
  }, { freeze: FREEZE }));

  // 64. "The smoking gun": black. On "The" a spotlight clicks on: the Cache held high between
  //     them, and under it the tiny Field, holding the smoking gun, caught. Its eyes dart left and
  //     right through "smo-king". On "gun" the lights slam on, a crash zoom, and it grins: GOTCHA.
  let c64cam: THREE.PerspectiveCamera | null = null;
  const LAMP = new THREE.Vector3(FIELD_AT.x + 0.6, 10.6, FIELD_AT.z + 2.5);
  shots.push(shot('f64-gun', BLACK, B(378), ({ scene, camera, club }) => {
    c64cam = camera;
    const c = new DiscoClawd();
    const ch = new Chief();
    const ca = new Cache();
    ca.root.position.set(CACHE_AT.x, HIGH, CACHE_AT.z);
    const fg = fieldWithGun(scene);
    const pool = lightPool(0.9, '#ffe9d0', 0.5);
    pool.position.set(FIELD_AT.x, 0.03, FIELD_AT.z);
    const drop = sweatDrop();
    const ting = new Burst(PAL.gold, 12);
    scene.add(c.root, ch.root, ca.root, pool, drop, ting.root);
    return (f, s) => {
      const lit = f.t >= GUN;
      // framing: low on the Field under the lifted Cache; a slow push; a crash zoom on "gun"
      const push = easeInOutCubic(clamp((f.t - THE64) / (GUN - THE64)));
      const zoom = easeOutCubic(clamp((f.t - GUN) / 0.18));
      const d = lerp(lerp(3.3, 2.7, push), 1.5, zoom);
      aimCam(camera, FIELD_AT.x + 0.05, lerp(0.75, 0.42, zoom), FIELD_AT.z + d, FIELD_AT.x, lerp(0.62, 0.36, zoom), FIELD_AT.z);
      shake(camera, f, GUN, 0.08, 0.25);
      finaleState(s, f);
      if (!lit) Object.assign(s, { blackout: 1, beams: 0, pars: 0, wallLight: 0, sign: 0, terms: 'off', ball: { angle: ball(f.t), lit: 0.15, sparkle: 0 } });
      s.crowdMask = i => {
        const dd = club.dancers[i];
        return Math.hypot(dd.x - CACHE_AT.x, dd.z - CACHE_AT.z) > 2.6 && !(dd.z > CACHE_AT.z && Math.abs(dd.x - CACHE_AT.x) < 3.5);
      };
      s.crowdGasp = () => (lit ? 1 : 0);
      (pool.material as THREE.MeshBasicMaterial).opacity = lit ? 0 : f.t >= THE64 ? 0.5 : 0;
      // the lifters, holding it up
      c.root.position.copy(CL_LIFT);
      const look = lit ? smooth(clamp((f.t - GUN - 0.1) / 0.2)) : 0;
      c.set(lit ? DISCO_MOODS.baffled : DISCO_MOODS.stressed, P({ armR: 0.35 + HIGH * 1.5, armL: 0.6, squash: 0.15, lean: 0.06 }), { shades: lit ? 0 : 1, puff: 0.6 + 0.6 * look, jiggle: Math.sin(f.t * 30) * decay(f.t - GUN, 0.2) }, f.t);
      ch.root.position.copy(CH_LIFT);
      ch.set(cs({ turn: Math.PI, armR: 1.05 + HIGH * 0.8, brow: lit ? 1 : 0.5, look: 0.9, bob: -0.03 }), f.t);
      ca.set(sp({ shades: 0.2, open: lit ? 1.35 : 1.2, brow: 1, mouth: lit ? 0.6 : -0.6, armL: 0.5, armR: 0.5 }), f.t);
      // the Field: caught in the light, eyes darting, a bead of sweat; on "gun" a guilty grin
      const dart = f.t > THE64 + 0.25 && !lit ? Math.sign(Math.sin((f.t - THE64) * 7.5)) * 0.85 : 0;
      const grin = lit ? easeOutBack(clamp((f.t - GUN - 0.08) / 0.2), 2) : 0;
      fg.set(f, {
        armR: lit ? lerp(0.9, 1.25, grin) : 0.9, armL: lit ? lerp(-0.6, 0.4, grin) : -0.6, look: lit ? 0 : dart, open: lit ? lerp(1.3, 0.62, grin) : 1.3,
        mouth: grin, squash: 0.3 * decay(f.t - GUN, 0.1), bob: lit ? 0.04 * Math.abs(Math.sin((f.t - GUN) * 9)) * decay(f.t - GUN - 0.3, 0.5) : 0, smoking: 1,
      }, camera);
      const sw = f.t - (THE64 + 0.55);
      drop.visible = sw > 0 && sw < 0.65 && !lit;
      drop.position.set(FIELD_AT.x + 0.3, 0.68 - sw * sw * 1.4, FIELD_AT.z + 0.1);
      drop.scale.setScalar(0.42);
      ting.root.position.set(FIELD_AT.x - 0.2, 0.62, FIELD_AT.z + 0.15);
      ting.set(f.t - (GUN + 0.12), 0.7);
    };
  }, {
    overlay(g, f) {
      if (f.t >= THE64 && f.t < GUN && c64cam) {
        c64cam.updateMatrixWorld();
        drawSpotlight(g, f.w, f.h, spotScreen(c64cam, f.w, f.h, FIELD_AT, 0.6, 1.0, LAMP), 0.96, 1);
      } else if (f.t < THE64) {
        // fully black: the overlay blends in linear light, so even 0.9 lets the scene show through
        g.fillStyle = '#020108';
        g.fillRect(0, 0, f.w, f.h);
      }
      drawStamp(g, f, GUN + 0.04, 'GOTCHA', { x: 0.5, y: 0.2, rot: -0.1, size: 150 });
    },
  }));
  void c63cam;

  // ---- the party ---------------------------------------------------------------------------------
  // Confetti cannons at both ends of the booth, fired as the party starts, again on line 65 and
  // on the wide shot. Every party shot builds the same confetti, so it carries across the cuts.
  const PARTY = B(382), SING = W(65, 0);
  const CANNONS = [new THREE.Vector3(-4.3, RISER.h + 0.3, -7.9), new THREE.Vector3(4.3, RISER.h + 0.3, -7.9), new THREE.Vector3(-7.4, 0.3, 1.5), new THREE.Vector3(7.4, 0.3, 1.5)];
  const AIM = [new THREE.Vector3(1.6, 10, 3.5), new THREE.Vector3(-1.6, 10, 3.5), new THREE.Vector3(2.8, 9, -1.5), new THREE.Vector3(-2.8, 9, -1.5)];
  const FIRE = [PARTY, B(390), B(400)];
  const confetti = (scene: THREE.Scene) => {
    const cf = new Confetti(CANNONS, AIM, 300);
    scene.add(cf.mesh);
    return (t: number) => cf.set(t, FIRE);
  };
  function partyState(s: ClubState, f: Frame) {
    finaleState(s, f);
    s.crowdFrozen = () => 0;
    s.beams = 1; s.pars = 1; s.wallLight = 1; s.alarm = 0;
  }

  // 64, after "gun" (instrumental): Clawd crouches to the Field, palm out. It tosses him the gun;
  //     he catches it, blows the smoke off the barrel, and spins it round his paw into a mic.
  const TOSS = B(378) + 0.18, CATCH = B(379) + 0.05, BLOW = B(380), TWIRL = B(381) - 0.1;
  const gunArc = (t: number, from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3) => {
    const u = clamp((t - TOSS) / (CATCH - TOSS));
    return out.copy(from).lerp(to, u).setY(lerp(from.y, to.y, u) + Math.sin(u * Math.PI) * 0.7);
  };
  shots.push(shot('f64-take', B(378), PARTY, ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    c.root.position.set(FIELD_AT.x - 1.12, 0, FIELD_AT.z + 0.25);
    const fi = new Field();
    fi.showArms = true;
    fi.root.position.copy(FIELD_AT);
    // the Cache set down to the right, the Chief beside it
    const ca = new Cache();
    ca.root.position.set(CACHE_AT.x + 1.05, 0, CACHE_AT.z - 0.7);
    const ch = new Chief();
    ch.root.position.set(CACHE_AT.x + 1.95, 0, CACHE_AT.z - 0.75);
    const flying = new Revolver();
    flying.root.scale.setScalar(0.5);
    const held = new Revolver();
    held.root.scale.setScalar(0.62);
    const hold = pawHold(c, held.root);
    const smoke = new Smoke(14);
    const puff = new Burst('#f2ecff', 9);
    scene.add(c.root, fi.root, ca.root, ch.root, flying.root, smoke.root, puff.root);
    const muzzle = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(), at = new THREE.Vector3();
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(5.15, 4.85, k), lerp(1.45, 1.4, k), lerp(5.6, 4.7, k), lerp(5.15, 4.75, k), lerp(1.0, 1.05, k), -0.1);
      partyState(s, f);
      s.crowdMask = i => Math.hypot(club.dancers[i].x - FIELD_AT.x, club.dancers[i].z - FIELD_AT.z) > 2.4 && club.dancers[i].z < FIELD_AT.z + 1;
      const b = f.clock.beat(f.t);
      // Clawd: palm out, catch, the gun to his face to blow, then the twirl into a mic
      const caught = f.t >= CATCH;
      const blow = smooth(clamp((f.t - BLOW) / 0.15)) * (1 - smooth(clamp((f.t - TWIRL) / 0.15)));
      const twirl = clamp((f.t - TWIRL) / 0.55);
      const mic = smooth(clamp((f.t - TWIRL - 0.5) / 0.2));
      const armR = caught ? lerp(lerp(0.9, 1.35, blow), 1.05, mic) : lerp(-0.4, 0.25, smooth(clamp((f.t - B(378)) / 0.2)));
      const spin = caught ? -Math.PI * 4 * easeOutCubic(twirl) : 0;
      c.set(blow > 0.3 ? DISCO_MOODS.smug : caught ? DISCO_MOODS.triumphant : DISCO_MOODS.eager, P({ armR, armL: lerp(-0.2, 0.5, mic), squash: caught ? 0.2 * decay(f.t - CATCH, 0.1) : 0.12, lean: 0.06 * blow }), {
        shades: 1, puff: 0.9, medal: decay(f.t - CATCH, 0.4), jiggle: Math.sin(f.t * 20) * decay(f.t - CATCH, 0.2),
      }, f.t);
      hold(caught, armR, 0.06 * blow, spin);
      // the Field: hands the gun over with a sheepish grin, then dances
      const handed = f.t >= TOSS;
      fi.set(sp({ armR: handed ? 1.3 : 0.9, armL: handed ? 1.1 : -0.6, mouth: 1, open: 0.7, bob: handed ? 0.05 * Math.abs(Math.sin(b * Math.PI)) : 0, squash: 0.2 * decay(f.t - TOSS, 0.1) }), f.t);
      scene.updateMatrixWorld();
      from.set(FIELD_AT.x + 0.4, 0.45, FIELD_AT.z + 0.05);
      to.copy(c.paw.localToWorld(at.set(ARM_LEN, 0, 0.07)));
      flying.root.visible = handed && !caught;
      if (flying.root.visible) {
        gunArc(f.t, from, to, flying.root.position);
        flying.root.rotation.z = (f.t - TOSS) * 14;
      }
      // smoke: off the Field's gun before the toss, off his after; blown away on "blow"
      held.muzzle.getWorldPosition(muzzle);
      if (!caught) muzzle.copy(from).add(new THREE.Vector3(0, 0.35, 0));
      smoke.set(f.t, muzzle, IT - 3, f.t < BLOW ? 1 : 0, camera, 6, 1.4);
      puff.root.position.copy(muzzle).add(new THREE.Vector3(0.1, 0.08, 0.05));
      puff.set(f.t - (BLOW + 0.08), 0.8);
      // the Cache and the Chief, side by side: the Cache relieved, the Chief raising his mug
      ca.set(sp({ shades: 1, mouth: 0.8, brow: 0.3, armL: -0.4, armR: 0.6 + 0.3 * Math.sin(b * Math.PI), bob: 0.04 * Math.abs(Math.sin(b * Math.PI)) }), f.t);
      ch.set(cs({ sip: 0, armR: 0.12, brow: 0.7, look: -0.6, bob: 0.03 * Math.abs(Math.sin(b * Math.PI)) }), f.t);
    };
  }));

  // 64, the party starts: on the downbeat the confetti cannons fire and the whole club dances,
  //     wide: Clawd with his mic in the middle, the Field up on the Cache's head, the Chief two-
  //     stepping with his coffee.
  const CL_PARTY = new THREE.Vector3(0.3, 0, 0.2);
  function partyCast(scene: THREE.Scene) {
    const c = new DiscoClawd();
    const mic = new Revolver();
    mic.root.scale.setScalar(0.62);
    const hold = pawHold(c, mic.root);
    const ca = new Cache();
    ca.root.position.set(3.4, 0, -0.4);
    const fi = new Field();
    fi.showArms = true;
    const ch = new Chief();
    ch.root.position.set(-2.6, 0, -0.1);
    scene.add(c.root, ca.root, fi.root, ch.root);
    return (f: Frame, cl: THREE.Vector3, move: 'spin' | 'point' | 'shimmy' | 'roll' = 'point') => {
      const b = f.clock.beat(f.t);
      const dn = dance(move, b, 1);
      c.root.position.set(cl.x + dn.x, 0, cl.z);
      // the mic hand stays up by his mouth; the other paw does the dancing
      const armR = 1.05;
      c.set(DISCO_MOODS.triumphant, { ...dn.pose, armR }, { shades: 1, jiggle: dn.jiggle, puff: 1.1, medal: 0.4 }, f.t);
      hold(true, armR, dn.pose.lean);
      const hop = Math.abs(Math.sin(b * Math.PI));
      ca.set(sp({ shades: 1, mouth: 0.9, armL: 0.5 + 0.6 * Math.sin(b * Math.PI), armR: 0.5 - 0.6 * Math.sin(b * Math.PI), bob: 0.06 * hop, lean: 0.06 * Math.sin(b * Math.PI) }), f.t);
      // the Field rides on top of the Cache, bouncing
      fi.root.position.set(ca.root.position.x, Cache.Y + Cache.H / 2 + 0.06 * hop, ca.root.position.z + 0.1);
      fi.set(sp({ armR: 1.2 + 0.4 * Math.sin(b * Math.PI * 2), armL: 1.2 - 0.4 * Math.sin(b * Math.PI * 2), mouth: 1, open: 0.85, squash: 0.25 * (1 - hop) }), f.t);
      ch.set(cs({ armR: 0.6 + 0.5 * Math.max(0, Math.sin(b * Math.PI)), point: 1, bob: 0.05 * hop, lean: 0.06 * Math.sin(b * Math.PI), brow: 0.4, walk: 0 }), f.t);
    };
  }
  shots.push(shot('f64-party', PARTY, B(388), ({ scene, camera, club }) => {
    const cast = partyCast(scene);
    const cf = confetti(scene);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(-1.2, 0.6, k), lerp(3.4, 3.0, k), lerp(10.5, 9.0, k), lerp(0.2, 0.4, k), 1.7, -1.5);
      shake(camera, f, PARTY, 0.06, 0.2);
      partyState(s, f);
      s.crowdMask = i => Math.hypot(club.dancers[i].x - CL_PARTY.x, club.dancers[i].z - CL_PARTY.z) > 1.5 && Math.hypot(club.dancers[i].x - 3.4, club.dancers[i].z + 0.4) > 1.3 && Math.hypot(club.dancers[i].x + 2.6, club.dancers[i].z + 0.1) > 1.2;
      cast(f, CL_PARTY, f.t < B(384) ? 'point' : 'spin');
      cf(f.t);
    };
  }));

  // 65. "The smoking gun" (sung into the gun): Clawd up on the booth, the gun for a mic, the Field
  //     dancing on the decks beside him, confetti still coming down. Over the held ad-lib the
  //     camera tilts up the wall behind him as the title lights up across it in neon.
  const SANG = lyrics.lines[64].end;
  const WIDE = B(398);
  // the credits switch on line by line over the wall: the title, then "Music by", "Animated by"
  const CREDITS_ON = [B(396), WIDE, B(400)];
  shots.push(shot('f65-sing', B(388), WIDE, ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    const mic = new Revolver();
    mic.root.scale.setScalar(0.62);
    const hold = pawHold(c, mic.root);
    const fi = new Field();
    fi.showArms = true;
    fi.root.position.set(1.7, RISER.h + CONSOLE.h, CONSOLE.front - 0.35);
    const cf = confetti(scene);
    scene.add(c.root, fi.root);
    return (f, s) => {
      const k = easeInOutCubic(clamp((f.t - B(388)) / (SANG - B(388))));
      const up = easeInOutCubic(clamp((f.t - (SANG + 0.1)) / (WIDE - SANG - 0.15)));
      aimCam(camera, lerp(lerp(1.45, 1.2, k), 0.7, up), lerp(lerp(2.5, 2.6, k), 2.5, up), lerp(lerp(-3.9, -4.4, k), -1.8, up),
        lerp(0.45, 0.2, up), lerp(2.45, 3.85, up), lerp(-9.3, -9.6, up));
      partyState(s, f);
      s.terms = 'credits';
      s.credits = CREDITS_ON;
      s.crowdMask = clearBooth;
      const b = f.clock.beat(f.t);
      // singing: the mic to his mouth on the line, leaning back on the held "gun" and the ad-lib
      const singing = f.t >= SING - 0.1;
      const held = smooth(clamp((f.t - W(65, 2)) / 0.3)) * (1 - smooth(clamp((f.t - 187.6) / 0.3)));
      const dn = dance(singing ? 'groove' : 'point', b, singing ? 0.6 : 1);
      const armR = singing ? 1.0 : dn.pose.armR;
      c.set(singing ? DISCO_MOODS.triumphant : DISCO_MOODS.excited, { ...dn.pose, armR, armL: singing ? lerp(0.6, 1.4, held) : dn.pose.armL, lean: dn.pose.lean - 0.12 * held, squash: dn.pose.squash - 0.1 * held }, {
        shades: 1, jiggle: dn.jiggle, puff: 1 + 0.4 * held, medal: 0.5,
      }, f.t);
      hold(true, armR, dn.pose.lean - 0.12 * held);
      const hop = Math.abs(Math.sin(b * Math.PI));
      fi.set(sp({ armR: 1.3, armL: 1.3, mouth: 1, open: 0.85, bob: 0.08 * hop, squash: 0.3 * (1 - hop) }), f.t);
      cf(f.t);
    };
  }));

  // 65a (instrumental): the whole party, wide, the credits lit across the wall over it: the title,
  //     "Music by Suno", and on the last confetti volley "Animated by Claude Opus 5.5".
  shots.push(shot('f65-wide', WIDE, B(406), ({ scene, camera, club }) => {
    const cast = partyCast(scene);
    const cf = confetti(scene);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.6, 0.0, k), lerp(3.6, 3.45, k), lerp(10.5, 5.8, k), lerp(0.2, 0, k), lerp(3.7, 4.05, k), -9.8);
      partyState(s, f);
      s.terms = 'credits';
      s.credits = CREDITS_ON;
      s.crowdMask = i => Math.hypot(club.dancers[i].x - CL_PARTY.x, club.dancers[i].z - CL_PARTY.z) > 1.5 && Math.hypot(club.dancers[i].x - 3.4, club.dancers[i].z + 0.4) > 1.3 && Math.hypot(club.dancers[i].x + 2.6, club.dancers[i].z + 0.1) > 1.2;
      cast(f, CL_PARTY, 'shimmy');
      cf(f.t);
    };
  }));

  // 66. "The smoking gun": the house goes down to a spotlight on Clawd, alone on the floor under
  //     the ball. Through the line he brings up a finger-gun; on the band's last hit he fires it
  //     (the floor flashes once), blows the smoke off the tip, and the shades glint at us. An iris
  //     closes on him over the ring-out. Black.
  const LINE66 = lyrics.lines[65];
  // the last hit: the band comes back in after a breath of silence at the end of the line
  const BANG = (() => {
    const e = audio.envelopes, fps = e.fps;
    for (let i = Math.ceil(LINE66.end * fps); i < Math.min(e.rms.length, (LINE66.end + 0.6) * fps); i++) if (e.rms[i] > 0.25) return i / fps;
    return LINE66.end + 0.15;
  })();
  const RAISE = W(66, 1), LEVEL = W(66, 2);
  const BLOW66 = BANG + 0.42, WINK = BANG + 0.95;
  const IRIS0 = BANG + 1.05, IRIS_SMALL = BANG + 1.4, IRIS1 = Math.min(END - 0.5, BANG + 1.88);
  const CL_ALONE = new THREE.Vector3(BALL.x, 0, BALL.z);
  const DOWN = B(406);
  /** The floor with the house down: lit only round him, and one flash of everything on the bang. */
  const aloneFloor: Painter = (ix, iz, f) => {
    const L = alive(ix, iz, f);
    const c = tileCenter(ix, iz);
    const near = 1 - smooth(clamp((Math.hypot(c.x - CL_ALONE.x, c.z - CL_ALONE.z) - 1.1) / 1.8));
    const down = smooth(clamp((f.t - DOWN) / 0.45));
    const bang = f.t >= BANG ? decay(f.t - BANG, 0.3) : 0;
    return { color: L.color, power: L.power * lerp(1, lerp(0.18, 1, near), down) + 1.3 * bang };
  };
  let c66cam: THREE.PerspectiveCamera | null = null;
  shots.push(shot('f66-alone', DOWN, END, ({ scene, camera }) => {
    c66cam = camera;
    const c = new DiscoClawd();
    // the finger-gun: a pointer finger out along the arm and a thumb up
    const hand = new THREE.Group();
    const finger = inkedRect(0.2, 0.075, 0.03, PAL.clawd, 0.03);
    finger.position.set(ARM_LEN + 0.06, 0.035, 0.012);
    const thumb = inkedRect(0.07, 0.15, 0.03, PAL.clawd, 0.03);
    thumb.position.set(ARM_LEN - 0.12, 0.14, 0.012);
    hand.add(finger, thumb);
    c.paw.add(hand);
    const flash = new Burst(PAL.gold, 10);
    const puff = new Burst('#f2ecff', 9);
    const smoke = new Smoke(10);
    // the wink: a four-point sparkle on his right lens
    const star = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.17 : 1;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const sparkle = shapeMesh(star, ownGlow('#ffffff', 2.6), 0, 1);
    sparkle.position.set(0.36, 0.77, 0.16);
    c.root.add(sparkle);
    const pool = lightPool(1.6, '#ffe9d0', 0.55);
    pool.position.set(CL_ALONE.x, 0.03, CL_ALONE.z);
    scene.add(c.root, flash.root, puff.root, smoke.root, pool);
    const tip = new THREE.Vector3();
    return (f, s) => {
      const k = easeInOutCubic(clamp((f.t - DOWN) / (LEVEL + 0.2 - DOWN)));
      aimCam(camera, lerp(0.9, 0.15, k), lerp(2.8, 1.55, k), CL_ALONE.z + lerp(8.5, 5.6, k), 0, lerp(1.9, 1.15, k), CL_ALONE.z);
      shake(camera, f, BANG, 0.08, 0.22);
      // the house goes down over half a beat: just the ball and the spotlight
      const down = smooth(clamp((f.t - DOWN) / 0.45));
      const bang = f.t >= BANG ? decay(f.t - BANG, 0.3) : 0;
      partyState(s, f);
      Object.assign(s, { floor: aloneFloor, blackout: down, beams: 1 - down, pars: 1 - down, crowd: down > 0.5 ? 0 : 1, terms: 'off', sign: 1 - down });
      s.ball = { angle: ball(f.t), lit: 1, sparkle: lerp(1, 0.6, down) + 0.8 * bang };
      const b = f.clock.beat(f.t);
      const dn = dance('groove', b, 0.8);
      // the finger-gun comes up through "smoking", level on "gun"; the kick of the shot; up to his
      // face to blow the smoke off; back down, a paw on his hip
      const aim = smooth(clamp((f.t - RAISE) / (LEVEL - RAISE)));
      const recoil = f.t >= BANG ? decay(f.t - BANG, 0.09) : 0;
      const toBlow = smooth(clamp((f.t - (BANG + 0.2)) / 0.2)) * (1 - smooth(clamp((f.t - (BLOW66 + 0.35)) / 0.25)));
      const armR = lerp(dn.pose.armR, lerp(0.04 + 0.6 * recoil, 1.2, toBlow), aim);
      c.root.position.set(CL_ALONE.x + dn.x * (1 - aim), 0, CL_ALONE.z);
      c.set(aim > 0.5 ? DISCO_MOODS.smug : DISCO_MOODS.triumphant, {
        ...dn.pose, armR, armL: lerp(dn.pose.armL, -0.45, aim), lean: dn.pose.lean * (1 - aim) + 0.05 * aim - 0.05 * recoil,
        squash: dn.pose.squash * (1 - aim) + 0.18 * recoil, bounce: dn.pose.bounce * (1 - aim),
      }, { shades: 1, jiggle: dn.jiggle * (1 - aim) + Math.sin(f.t * 30) * recoil, puff: 1, medal: 0.3, rimL: PAL.pink, rimR: PAL.gold }, f.t);
      hand.visible = aim > 0.3;
      scene.updateMatrixWorld();
      c.paw.localToWorld(tip.set(ARM_LEN + 0.17, 0.035, 0.04));
      flash.root.position.copy(tip);
      flash.root.quaternion.copy(camera.quaternion);
      flash.set(f.t - BANG, 0.5);
      smoke.set(f.t, tip, BANG + 0.05, f.t < BLOW66 ? 1 : 0, camera, 9, 0.9);
      puff.root.position.copy(tip).add(new THREE.Vector3(0.12, 0.06, 0.05));
      puff.root.quaternion.copy(camera.quaternion);
      puff.set(f.t - BLOW66, 0.55);
      const w = clamp((f.t - WINK) / 0.4);
      sparkle.visible = w > 0 && w < 1;
      sparkle.scale.setScalar(0.3 * Math.sin(w * Math.PI));
      sparkle.rotation.z = w * 0.9;
    };
  }, {
    overlay(g, f) {
      if (!c66cam || f.t < IRIS0) return;
      c66cam.updateMatrixWorld();
      // the iris: closes to a circle round his face, holds a moment, then shuts
      const at = screenAt(new THREE.Vector3(CL_ALONE.x, 1.0, CL_ALONE.z), c66cam, f.w, f.h);
      const far = Math.max(Math.hypot(at.x, at.y), Math.hypot(f.w - at.x, at.y), Math.hypot(at.x, f.h - at.y), Math.hypot(f.w - at.x, f.h - at.y));
      const small = f.h * 0.2;
      const r = f.t < IRIS_SMALL ? lerp(far, small, easeInOutCubic(clamp((f.t - IRIS0) / (IRIS_SMALL - IRIS0))))
        : lerp(small, 0, easeInCubic(clamp((f.t - (IRIS1 - 0.2)) / 0.2)));
      g.fillStyle = '#000000';
      g.beginPath();
      g.rect(0, 0, f.w, f.h);
      if (r > 0.5) g.arc(at.x, at.y, r, 0, Math.PI * 2, true);
      g.fill('evenodd');
    },
  }));

  return shots;
}
