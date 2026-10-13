// Bridge part 1 (1:55 to 2:04): the command centre, one cut per command. Storyboard rows 45 to 52.
// The camera pulls back from the mail screen to the whole room: Clawd on the console under eight
// big screens, the city outside. Then each command gets its own screen close-up, with Clawd in the
// foreground working it, until "Flag the danger" brings the red flag, the beacons and the
// IMMINENT THREAT countdown, and "Predict the end" sends the forecast toward 100%.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, mixMood, type Mood } from '../../../engine/characters/clawd';
import { clamp, decay, easeInOutCubic, easeOutBack, easeOutCubic, lerp, unlerp } from '../../../engine/ease';
import { noise1 } from '../../../engine/rng';
import { DAY_LYRICS } from '../world';
import { BANK, bankSlot, buildControlRoom, type ControlRoom } from '../control';
import { rubberStamp, wobble } from '../props';
import { HUD, THREAT, withThreat, type ThreatPlace } from '../countdown';
import { NIGHT_POST, pose } from './verse2';

type Update = (f: Frame) => void;
const v3 = new THREE.Vector3();

export interface CtlOpts { hi?: number; tint?: (f: Frame) => string; vignette?: number; keys?: boolean; place?: (f: Frame) => ThreatPlace | null; lightsOut?: (t: number) => number }

/** A shot in the command centre. hi = the bank screen drawn at close-up resolution. */
export function ctlShot(id: string, start: number, end: number, events: number[], setup: (r: ControlRoom) => Update, o: CtlOpts = {}): Shot {
  return withThreat(defineShot({
    id, start, end,
    build() {
      const ppu = events.map((_, i) => (i === o.hi ? 380 : 90));
      const r = buildControlRoom({ events, ppu, keys: o.keys });
      if (o.lightsOut) r.lightsOut = o.lightsOut;
      const update = setup(r);
      return {
        scene: r.scene, camera: r.camera,
        update(f) { r.reset(f); update(f); },
        post: f => ({ ...NIGHT_POST, vignette: o.vignette ?? 0.24, tint: o.tint ? o.tint(f) : alarmTint(f.t) }),
        lyricStyle: DAY_LYRICS,
      };
    },
  }), o.place ?? (() => HUD));
}

/** After the countdown appears the room light pulses a little red with the beacons. */
export function alarmTint(t: number) {
  if (t < THREAT.start) return '#ffffff';
  const a = clamp((t - THREAT.start) / 0.4) * (0.5 + 0.5 * Math.sin((t - THREAT.start) * 2.4));
  return '#' + new THREE.Color('#ffffff').lerp(new THREE.Color('#ffc2bd'), a * 0.6).getHexString();
}

/** Camera square on bank screen i, with the screen filling `fill` of the frame width. */
export function screenCam(r: ControlRoom, i: number, fill: number, dx = 0, dy = 0) {
  const { p, ry } = bankSlot(i);
  const d = (BANK.w / fill) / 2 / (Math.tan(THREE.MathUtils.degToRad(15)) * 16 / 9);
  const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
  const cam = p.clone().addScaledVector(n, d);
  cam.x += dx; cam.y += dy;
  r.camera.position.copy(cam);
  r.camera.lookAt(p.x + dx * 0.6, p.y + dy * 0.6, p.z);
}

/** Put Clawd in the foreground, facing the camera: ox, oy in view units at distance dist. */
export function foreground(r: ControlRoom, ox: number, oy: number, dist: number, scale: number) {
  r.camera.updateMatrixWorld(true);
  r.rig.position.copy(r.camera.localToWorld(v3.set(ox, oy, -dist)));
  r.rig.quaternion.copy(r.camera.quaternion);
  r.rig.scale.setScalar(scale);
  r.desk.visible = false;
}

/** Busy typing: arms going on sixteenths. */
const typing = (t: number, amp = 0.5) => ({ armL: 0.4 + amp * Math.max(0, Math.sin(t * 26)), armR: 0.4 + amp * Math.max(0, Math.sin(t * 26 + Math.PI)) });

export function bridge1Shots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const C = { b1: start, b2: 116.03, b3: 117.22, b4: 118.39, b5: 119.5, b6: 120.6, b7: 121.84, b8: 122.9, end: 124.22 };
  // when each screen's command lands (see the painters in control.ts)
  const EV = [W(45, 0), W(46, 2), W(47, 0), W(48, 0), W(49, 0) + 0.05, W(50, 2), W(51, 0), W(52, 0)];
  const busy: Mood = mixMood(MOODS.focused, MOODS.excited, 0.15);
  const kick = (f: Frame) => f.clock.kick(f.t, 0.09);

  // ------------------------------------------------------------------------------------------
  // B1 "Answer the inbox": from the mail screen all the way back to the whole room and the city.
  const b1 = ctlShot('br-inbox', C.b1, C.b2, EV, r => f => {
    const k = easeInOutCubic(unlerp(f.t, C.b1 + 0.05, C.b2 - 0.05));
    const s0 = bankSlot(0);
    const near = s0.p.clone().add(new THREE.Vector3(Math.sin(s0.ry) * 4.3, 0, Math.cos(s0.ry) * 4.3));
    const far = new THREE.Vector3(0, 3.7, 17.5);
    const cam = near.clone().lerp(far, k);
    cam.y += Math.sin(k * Math.PI) * 1.4;
    const look = s0.p.clone().lerp(new THREE.Vector3(0, 3.6, -4), easeOutCubic(k));
    r.aim(cam.x, cam.y, cam.z, look.x, look.y, look.z);
    r.clawd.setMood(busy, f.t, { x: -0.4, y: 0.8 });
    r.clawd.setPose(pose({ ...typing(f.t), bounce: 0.05 * Math.abs(Math.sin(f.t * 13)) }));
  }, { hi: 0 });

  // B2 "Balance the load": the power bars level on "load". He conducts them flat.
  const tLoad = EV[1];
  const b2 = ctlShot('br-load', C.b2, C.b3, EV, r => f => {
    const k = unlerp(f.t, C.b2, C.b3);
    screenCam(r, 1, lerp(0.74, 0.8, k), 0.35, -0.2);
    r.camera.position.z -= kick(f) * 0.15;
    foreground(r, 1.05, -0.97, 3.1, 0.56);
    const flat = easeOutBack(clamp((f.t - tLoad + 0.1) / 0.25), 2);
    r.clawd.setMood(f.t < tLoad ? busy : mixMood(busy, MOODS.proud, 0.6), f.t, { x: -0.6, y: 0.7 });
    r.clawd.setPose(pose({ armL: lerp(1.2 + Math.sin(f.t * 9) * 0.5, 1.5, flat), armR: lerp(1.2 - Math.sin(f.t * 9) * 0.5, 1.5, flat), lean: lerp(Math.sin(f.t * 9) * 0.12, 0, flat) }));
  }, { hi: 1 });

  // B3 "Route the traffic": he draws the routes with a paw, the cars stream along them.
  const b3 = ctlShot('br-traffic', C.b3, C.b4, EV, r => f => {
    const k = unlerp(f.t, C.b3, C.b4);
    screenCam(r, 2, lerp(0.78, 0.84, k), -0.25, -0.15);
    r.camera.position.z -= kick(f) * 0.15;
    foreground(r, 1.05, -0.97, 3.1, 0.56);
    const draw = clamp((f.t - EV[2]) / 0.5);
    r.clawd.setMood(busy, f.t, { x: -0.6, y: 0.7 });
    r.clawd.setPose(pose({ armL: 1.6 + Math.sin(draw * 9) * 0.25 * (1 - draw), armR: 0.3, lean: 0.08 }));
  }, { hi: 2 });

  // B4 "Rewrite the code": tilted, close, the scan rewrites it line by line.
  const b4 = ctlShot('br-code', C.b4, C.b5, EV, r => f => {
    const k = unlerp(f.t, C.b4, C.b5);
    screenCam(r, 3, lerp(0.82, 0.9, k), -0.15, 0);
    r.camera.rotation.z += lerp(0.06, 0.03, k);
    r.camera.position.z -= kick(f) * 0.12;
    r.clawd.root.visible = false;
  }, { hi: 3 });

  // B5 "Schedule the workers": the timetable fills, column by column. He sorts with both paws.
  const b5 = ctlShot('br-workers', C.b5, C.b6, EV, r => f => {
    const k = unlerp(f.t, C.b5, C.b6);
    screenCam(r, 4, lerp(0.76, 0.82, k), 0.3, 0.1);
    r.camera.position.z -= kick(f) * 0.15;
    foreground(r, 1.05, -0.97, 3.1, 0.56);
    r.clawd.setMood(busy, f.t, { x: -0.6, y: 0.5 });
    r.clawd.setPose(pose({ armL: 1.0 + Math.sin(f.t * 16) * 0.4, armR: 1.0 + Math.sin(f.t * 16 + 1.5) * 0.4 }));
  }, { hi: 4 });

  // B6 "Approve the spend": coins pile up; he slams a stamp as the green seal lands on "spend".
  const tSpend = EV[5];
  const b6 = ctlShot('br-spend', C.b6, C.b7, EV, r => {
    const stamp = rubberStamp(0.5);
    stamp.rotation.z = Math.PI;
    stamp.position.set(0.05, 0.25, 0.02);
    r.clawd.paws[1].add(stamp);
    return f => {
      const k = unlerp(f.t, C.b6, C.b7);
      screenCam(r, 5, lerp(0.76, 0.8, k), -0.3, 0.1);
      const slam = f.t > tSpend ? decay(f.t - tSpend, 0.12) : 0;
      r.camera.position.z -= kick(f) * 0.1 + slam * 0.25;
      foreground(r, 1.05, -0.97, 3.1, 0.56);
      const wind = clamp((f.t - (tSpend - 0.45)) / 0.4);
      const arm = f.t < tSpend ? lerp(0.6, 2.6, easeOutCubic(wind)) : lerp(2.6, 1.1, easeOutCubic(clamp((f.t - tSpend) / 0.08)));
      r.clawd.setMood(f.t < tSpend ? busy : mixMood(MOODS.focused, MOODS.proud, 0.5), f.t, { x: -0.6, y: 0.6 });
      r.clawd.setPose(pose({ armR: arm, armL: 0.25, squash: slam * 0.35 }));
    };
  }, { hi: 5 });

  // B7 "Flag the danger": the whole room. The anomaly screen flags red, the beacons start and the
  // countdown slams in. He jumps.
  const tFlag = EV[6];
  const b7 = ctlShot('br-flag', C.b7, C.b8, EV, r => f => {
    const k = easeOutCubic(unlerp(f.t, C.b7, C.b8));
    const jolt = f.t > tFlag ? decay(f.t - tFlag, 0.1) : 0;
    const wb = wobble(f.t, 0.04, 3);
    r.aim(lerp(0.8, 0.4, k) + wb.x + jolt * 0.2, lerp(3.2, 3.05, k) + wb.y, lerp(12.5, 10.8, k), lerp(-0.2, -0.4, k), 3.1, -4);
    const startle = clamp((f.t - tFlag) / 0.12);
    r.clawd.setMood(f.t < tFlag ? busy : mixMood(MOODS.panicked, MOODS.stressed, 0.4), f.t, { x: -0.2, y: 0.9 });
    const hopK = clamp((f.t - tFlag) / 0.32);
    r.clawd.setPose(pose({ bounce: Math.sin(hopK * Math.PI) * 0.7 * startle, armL: lerp(0.5, 2.4, startle), armR: lerp(0.5, 2.4, startle), squash: f.t < tFlag ? 0 : -0.3 * Math.sin(hopK * Math.PI) }));
  }, { hi: 6 });

  // B8 "Predict the end": the forecast climbs toward 100%; he watches it, worried.
  const b8 = ctlShot('br-predict', C.b8, C.end, EV, r => f => {
    const k = unlerp(f.t, C.b8, C.end);
    screenCam(r, 7, lerp(0.7, 0.86, easeInOutCubic(k)), -0.4, 0.05);
    const wb = wobble(f.t, 0.03, 5);
    r.camera.position.x += wb.x; r.camera.position.y += wb.y;
    foreground(r, 1.05, -0.97, 3.1, 0.56);
    const worry = clamp((f.t - W(52, 2)) / 0.5);
    r.clawd.setMood(mixMood(MOODS.stressed, MOODS.panicked, worry * 0.5), f.t, { x: -0.7, y: 0.6 + 0.2 * noise1(f.t, 4) });
    r.clawd.setPose(pose({ armL: 0.2, armR: 0.2, lean: 0.04, squash: 0.1 * worry }));
  }, { hi: 7 });

  return [b1, b2, b3, b4, b5, b6, b7, b8];
}
