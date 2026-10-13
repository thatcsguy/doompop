// Final chorus and outro (2:53 to the end): storyboard rows 74 to 86. The grey planet. The world
// wiped clean; the countdown lying cracked at zero; ash falling. He stamps DONE on a broken monitor
// and it comes out faded; the empty office chair still has his sticky note on it; he types into
// the old chat box and nobody answers; he tries to stand a rack back up and it falls apart; he
// reaches for the button again and stops. Close on his eyes, then tiny Clawd on the curve of an
// empty planet under a dim sun. The credits roll while he sits by the monitor and rests his head
// on it, and we hold on the blinking cursor in the empty chat box until the last note.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, mixMood, type Mood } from '../../../engine/characters/clawd';
import { clamp, decay, easeInOutCubic, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { inkedRect } from '../../../engine/flat';
import { DAY_LYRICS, FLAT_POST, FONT, frameCam } from '../world';
import { doneMark, pawAt, rubberStamp, wobble } from '../props';
import { buildAsh, buildPlanet, brokenMonitor, charredBelt, crackedCountdown, launchPedestal, officeRemains, oldMonitor, toppledRack, type AshSet } from '../ash';
import { pose } from './verse2';

type Update = (f: Frame) => void;

// Clawd in the grey: sad, but his colour stays (only a little grey creeps in)
const STUNNED: Mood = { happy: 0, open: 1.1, droop: 0.25, blush: 0, sweat: 0, jitter: 0, grey: 0.08, squint: 0, brow: 0.6 };
const LOST: Mood = { happy: 0, open: 0.75, droop: 0.7, blush: 0, sweat: 0, jitter: 0, grey: 0.12, squint: 0, brow: 1 };
const CRYING: Mood = { ...MOODS.sad, open: 0.5, grey: 0.15 };
const SHAKING: Mood = { ...MOODS.stressed, droop: 0.4, grey: 0.1, sweat: 0.4, jitter: 0.7 };

interface AshOpts { flakes?: number; flakeSize?: number; box?: { x: number; z: number; w: number; d: number; h: number }; vignette?: number; overlay?: (g: CanvasRenderingContext2D, f: Frame) => void }

function ashShot(id: string, start: number, end: number, setup: (s: AshSet) => Update, o: AshOpts = {}): Shot {
  return defineShot({
    id, start, end,
    build() {
      const s = buildAsh({ flakes: o.flakes, flakeSize: o.flakeSize, box: o.box });
      const update = setup(s);
      return {
        scene: s.scene, camera: s.camera,
        update(f) { s.reset(f); update(f); },
        overlay: o.overlay,
        post: () => ({ ...FLAT_POST, vignette: o.vignette ?? 0.32, grain: 0.035, tint: '#f4f2ee' }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });
}

// ---------------------------------------------------------------------------------------------
// The credits roll slowly up the right side: a small line over a big one.

const CREDITS = [
  { t0: 207.0, small: 'Music by', big: 'Suno' },
  { t0: 216.4, small: 'Animated by', big: 'Claude Opus 5.5' },
];
const ROLL = 11; // seconds from bottom edge to top edge

function drawCredits(g: CanvasRenderingContext2D, f: Frame) {
  const s = f.h / 1080;
  for (const c of CREDITS) {
    const k = (f.t - c.t0) / ROLL;
    if (k < 0 || k > 1) continue;
    const y = lerp(1.1, -0.12, k) * f.h, x = 0.83 * f.w;
    g.save();
    g.globalAlpha = clamp(k / 0.08) * clamp((1 - k) / 0.08);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const line = (text: string, px: number, dy: number, weight: number, color: string) => {
      g.font = `${weight} ${px * s}px ${FONT}`;
      g.strokeStyle = 'rgba(250,247,240,0.9)'; g.lineWidth = px * s * 0.16; g.strokeText(text, x, y + dy * s);
      g.fillStyle = color; g.fillText(text, x, y + dy * s);
    };
    line(c.small, 34, -34, 700, '#5a5450');
    line(c.big, 70, 40, 900, '#2b1d16');
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------

export function outroShots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const C = {
    o1: start, o2: 174.6, o3: 178.25, o4: 179.79, o5: 182.11, o6: 183.96, o7: 188.06, o8: 193.53,
    o9: 195.69, o10: 198.05, o11: 206.42, o12: 216.2, black: 225.85, end: audio.duration,
  };

  // O1 "I made it clean": wide on the plain, wiped flat. Clawd tiny in the middle; a length of
  // the old conveyor creeps past in the foreground, still carrying tickets.
  const o1 = ashShot('out-clean', C.o1, C.o2, s => {
    const belt = charredBelt(9);
    s.add(belt.group, -6.6, 0, 6.5);
    return f => {
      const k = unlerp(f.t, C.o1, C.o2);
      s.aim(lerp(-2.0, -0.9, k), 3.3, lerp(17, 16, k), lerp(-0.8, -0.1, k), 1.3, 0);
      belt.update(f.t);
      s.clawd.setMood(STUNNED, f.t, { x: 0, y: -0.1 });
      s.clawd.setPose(pose({ armL: 0.05, armR: 0.05 }));
    };
  }, { box: { x: 0, z: 4, w: 28, d: 18, h: 10 } });

  // O2 "There was hardly any time": the countdown lies cracked on the ground, reading zero.
  const o2 = ashShot('out-clock', C.o2, C.o3, s => {
    const cd = crackedCountdown();
    s.add(cd.group, -0.2, 0, 1.4);
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.o2, C.o3));
      s.aim(lerp(-1.0, -0.4, k), lerp(3.4, 2.7, k), lerp(7.0, 5.4, k), lerp(0.3, 0.2, k), 0.35, 0.4);
      cd.update(f.t);
      s.clawd.root.position.set(1.9, 0, -0.7);
      s.clawd.setMood(mixMood(STUNNED, LOST, k), f.t, { x: -0.7, y: -0.8 });
      s.clawd.setPose(pose({ armL: 0.05, armR: 0.05, lean: 0.05 }));
    };
  });

  // O3 "In between": ash falls. Close on him looking up into it.
  const o3 = ashShot('out-fall', C.o3, C.o4, s => f => {
    const k = unlerp(f.t, C.o3, C.o4);
    s.aim(0, 0.75, lerp(3.4, 3.0, k), 0, 0.95, 0);
    s.clawd.setMood(mixMood(STUNNED, LOST, 0.6), f.t, { x: 0.15 * Math.sin(f.t * 0.9), y: 1 });
    s.clawd.setPose(pose({ armL: 0.1, armR: 0.1 }));
  }, { flakes: 240, flakeSize: 0.45, box: { x: 0, z: 0.9, w: 5, d: 2.6, h: 3.6 } });

  // O4 "I followed every order": he stamps DONE on a broken monitor. It comes out faded. Twice.
  const stamps = [W(78, 3), 181.55];
  const o4 = ashShot('out-done', C.o4, C.o5, s => {
    const mon = brokenMonitor();
    s.add(mon.group, 1.15, 0, 0);
    const marks = stamps.map((_, i) => {
      const m = doneMark(0.95, '#86998b', 20 + i);
      (m.material as THREE.MeshBasicMaterial).opacity = i ? 0.3 : 0.45;
      m.position.set(i ? 0.38 : -0.25, i ? -0.28 : 0.12, 0.002 * i);
      m.rotation.z = i ? 0.2 : -0.12;
      mon.screen.add(m);
      return m;
    });
    const rock = inkedRect(1.3, 0.45, 0.1, '#77736f', 0.045);
    s.add(rock, -0.4, 0.22, 0.45);
    const stamp = rubberStamp(0.6);
    s.scene.add(stamp);
    const target = new THREE.Vector3();
    return f => {
      const k = unlerp(f.t, C.o4, C.o5);
      const wb = wobble(f.t, 0.02, 81);
      s.aim(lerp(-0.2, 0.1, k) + wb.x, 1.6 + wb.y, lerp(5.8, 4.9, k), lerp(0.3, 0.45, k), 0.85, 0);
      marks.forEach((m, i) => { m.visible = f.t >= stamps[i]; });
      // the stamp comes down on each hit time, held a moment, then lifts
      let i = 0;
      while (i + 1 < stamps.length && stamps[i + 1] <= f.t + 0.14) i++;
      const T = stamps[i], dt = f.t - T;
      const hit = dt < -0.12 ? 0 : dt < 0 ? Math.pow(1 + dt / 0.12, 2) : dt < 0.12 ? 1 : 1 - smooth((dt - 0.12) / 0.35);
      const punch = f.t >= T ? decay(dt, 0.08) : 0;
      const looking = f.t > stamps[0] + 0.25 && f.t < stamps[1] - 0.3;
      s.clawd.root.position.set(-0.4, 0.45, 0.45);
      s.clawd.setMood(looking ? mixMood(SHAKING, LOST, 0.5) : SHAKING, f.t, looking ? { x: 0.8, y: -0.3 } : { x: 0.6, y: -0.5 });
      s.clawd.setPose(pose({ armR: lerp(1.5, 0.75, hit), armL: lerp(0.9, 0.5, hit), squash: punch * 0.3, lean: -0.08 * hit }));
      mon.screen.updateMatrixWorld(true);
      mon.screen.localToWorld(target.set(i ? 0.38 : -0.25, (i ? -0.28 : 0.12) - 0.2, 0));
      const paw = pawAt(s.clawd, 1);
      stamp.position.set(lerp(paw.x, target.x, hit), Math.max(target.y, paw.y - 0.39), Math.max(target.z + 0.32, 0.62));
      stamp.scale.set(0.6 * (1 + punch * 0.15), 0.6 * (1 - punch * 0.15), 0.6);
    };
  });

  // O5 "I did everything well": the scorched office, the empty chair, the sticky note.
  const o5 = ashShot('out-chair', C.o5, C.o6, s => {
    const office = officeRemains();
    s.add(office.group, 0, 0, 0);
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.o5, C.o6));
      s.aim(lerp(-0.6, 1.45, k), lerp(2.1, 1.75, k), lerp(8.8, 3.5, k), lerp(0.2, 1.72, k), lerp(1.2, 1.55, k), lerp(0, 0.5, k));
      s.clawd.root.position.set(-2.7, 0, 1.6);
      s.clawd.setMood(mixMood(SHAKING, LOST, 0.6), f.t, { x: 1, y: 0.1 });
      s.clawd.setPose(pose({ armL: 0.1, armR: 0.25 }));
    };
  });

  // O6 "Why is no one answering?": he types into the old chat box, sends, sits back, waits.
  const HELLO = 'hello?';
  const keyAt = [...HELLO].map((_, i) => 184.15 + i * 0.19 + hash(i, 811) * 0.05);
  const tSend = W(80, 4);
  const MON_X = 0.6;
  const chatSet = (s: AshSet) => {
    const mon = oldMonitor();
    mon.keyboard.position.set(-2.05, 0.012, 1.0);
    s.add(mon.group, MON_X, 0, 0);
    return mon;
  };
  const o6 = ashShot('out-chat', C.o6, C.o7, s => {
    const mon = chatSet(s);
    return f => {
      const typed = keyAt.filter(x => f.t >= x).length;
      const sent = f.t >= tSend;
      const blink = Math.floor(f.t / 0.53) % 2 === 0;
      mon.set({ typed: sent ? '' : HELLO.slice(0, typed), cursor: blink || (!sent && typed > 0 && f.t - keyAt[typed - 1] < 0.3), sent: sent ? ['CONFIRM?', HELLO] : ['CONFIRM?'] });
      const typing = f.t > keyAt[0] - 0.1 && f.t < tSend + 0.1;
      const back = easeOutCubic(unlerp(f.t, tSend + 0.3, tSend + 1.0));
      const sit = smooth(unlerp(f.t, tSend + 0.6, tSend + 1.2));
      s.clawd.root.position.set(lerp(-1.55, -1.75, back), -0.06 * sit, lerp(1.0, 1.25, back));
      s.clawd.setMood(mixMood(SHAKING, LOST, 0.4 + sit * 0.4), f.t, sent ? { x: 0.9, y: 0.3 } : { x: 0.5, y: -0.8 });
      s.clawd.setPose(pose({
        armL: typing ? 0.2 + 0.35 * Math.max(0, Math.sin(f.t * 22)) : 0.1,
        armR: typing ? 0.2 + 0.35 * Math.max(0, Math.sin(f.t * 22 + Math.PI)) : 0.1,
        squash: sit * 0.35, lean: typing ? 0.06 : 0,
      }));
      const k = easeInOutCubic(unlerp(f.t, C.o6, C.o7));
      s.aim(lerp(-0.9, -0.2, k), lerp(2.0, 1.7, k), lerp(7.2, 5.6, k), lerp(-0.4, -0.05, k), 1.1, 0);
    };
  });

  // O7 "I can still fix this": he shoves a fallen rack back upright. It stands, wobbles, and
  // falls apart.
  const RACK_X = 1.1, tBreak = W(81, 4) + 0.33;
  const tipAt = (t: number) => {
    if (t < 188.5) return 0.35;
    if (t < 189.6) return lerp(0.35, 0.62, easeInOutCubic(unlerp(t, 188.5, 189.6)) + 0.02 * Math.sin(t * 17));
    return lerp(0.62, 1, easeOutCubic(unlerp(t, 189.6, 189.95)));
  };
  const o7 = ashShot('out-rack', C.o7, C.o8, s => {
    const rack = toppledRack(3);
    s.add(rack.group, RACK_X, 0, -0.2);
    return f => {
      const tip = tipAt(f.t);
      rack.set(tip, f.t, tBreak);
      // where his raised paws meet the underside of the leaning rack
      const th = lerp(1.32, 0, tip);
      const d = Math.max(0.8, 1.08 / Math.tan(Math.PI / 2 - th));
      const flinch = easeOutCubic(unlerp(f.t, tBreak, tBreak + 0.35));
      const pushing = f.t < 189.95;
      s.clawd.root.position.set(RACK_X - d - 0.55 - flinch * 1.0, 0, 0.35);
      const strain = pushing ? 0.5 + 0.5 * Math.sin(f.t * 9) : 0;
      s.clawd.setMood(f.t < tBreak ? mixMood(SHAKING, { ...MOODS.focused, grey: 0.1 }, 0.4) : mixMood(SHAKING, LOST, smooth(unlerp(f.t, tBreak + 0.5, 191.5))), f.t,
        f.t < tBreak ? { x: 0.6, y: 0.8 } : { x: 0.5, y: -0.6 });
      s.clawd.setPose(pose({
        armL: pushing ? 2.5 + strain * 0.1 : lerp(1.2, 0.1, flinch), armR: pushing ? 2.5 - strain * 0.1 : lerp(1.2, 0.1, flinch),
        squash: pushing ? 0.1 + strain * 0.1 : -0.2 * decay(f.t - tBreak, 0.15), lean: pushing ? -0.12 : 0,
        walk: pushing && f.t > 188.5 ? f.t * 2 : 0,
      }));
      const k = easeInOutCubic(unlerp(f.t, C.o7, C.o8));
      s.aim(lerp(-0.6, 0.0, k), lerp(2.4, 2.0, k), lerp(10, 8.6, k), 0.2, 1.5, 0);
    };
  });

  // O8 "I can still—": he reaches for the button again, and stops.
  const tStop = W(82, 2) + 0.35;
  const o8 = ashShot('out-button', C.o8, C.o9, s => {
    const b = launchPedestal();
    s.add(b.group, 1.25, 0, 0);
    return f => {
      const step = easeOutCubic(unlerp(f.t, C.o8 + 0.05, tStop));
      const drop = smooth(unlerp(f.t, tStop + 0.5, tStop + 1.2));
      const away = easeInOutCubic(unlerp(f.t, tStop + 0.9, C.o9));
      s.clawd.root.position.set(lerp(-0.7, 0.05, step) - away * 0.4, 0, 0.45);
      const frozen = f.t >= tStop;
      s.clawd.setMood(frozen ? mixMood(SHAKING, LOST, drop) : SHAKING, f.t, { x: 0.8, y: frozen ? lerp(0.4, -0.5, drop) : 0.5 });
      s.clawd.setPose(pose({ armR: lerp(lerp(0.2, 1.5, step), 0.15, drop) + (frozen && drop < 0.1 ? 0.04 * Math.sin(f.t * 28) : 0), armL: 0.15, lean: lerp(-0.12 * step, 0, drop), walk: step > 0 && step < 1 ? f.t * 3 : 0 }));
      b.set(1, 0, 0.2 + 0.15 * Math.sin(f.t * 3));
      const k = unlerp(f.t, C.o8, C.o9);
      s.aim(lerp(0.9, 0.6, k), 1.75, lerp(6.4, 5.8, k), 0.45, 1.15, 0);
    };
  });

  // O9 "Please": close on his eyes, drooping, the tears coming.
  const o9 = ashShot('out-eyes', C.o9, C.o10, s => f => {
    const k = unlerp(f.t, C.o9, C.o10);
    s.aim(0, 0.76, lerp(2.0, 1.7, k), 0, 0.74, 0);
    s.clawd.setMood(mixMood(LOST, CRYING, smooth(unlerp(f.t, C.o9, C.o9 + 0.8))), f.t, { x: 0, y: lerp(0.1, -0.3, k) });
    s.clawd.setPose(pose({ armL: 0.05, armR: 0.05 }));
  }, { flakes: 120, flakeSize: 0.35, box: { x: 0, z: 0.75, w: 2.6, d: 0.7, h: 2.4 }, vignette: 0.45 });

  // O10 "Tell me what to do": pull back to tiny Clawd on the curve of an empty grey planet,
  // looking up at a dim sun.
  const o10 = defineShot({
    id: 'out-planet', start: C.o10, end: C.o11,
    build() {
      const p = buildPlanet();
      return {
        scene: p.scene, camera: p.camera,
        update(f) {
          p.update(f.t);
          const k = easeInOutCubic(unlerp(f.t, C.o10 + 0.4, C.o11 - 0.6));
          const h = Math.exp(lerp(Math.log(3.0), Math.log(56), k));
          frameCam(p.camera, 0, lerp(0.7, -10, k), h);
          p.clawd.root.position.set(0, 0, 0.1);
          p.clawd.setMood(mixMood(CRYING, LOST, 0.5), f.t, { x: 0.55, y: 1 });
          p.clawd.setPose(pose({ armL: 0.05, armR: 0.05 }));
        },
        post: () => ({ ...FLAT_POST, vignette: 0.4, grain: 0.035 }),
        lyricStyle: DAY_LYRICS,
      };
    },
  });

  // O11 "I'm just here to help": he sits by the old monitor, the chat box still open. Slow push.
  // O12: he rests his head on it; we come in to the empty field and its blinking cursor.
  const sitting = (s: AshSet, f: Frame, lean: number) => {
    s.clawd.root.position.set(lerp(-1.55, -1.45, lean), -0.06, 0.45);
    s.clawd.root.rotation.z = -0.32 * lean;
    s.clawd.setMood(mixMood(LOST, { ...CRYING, open: 0.12 }, lean * 0.9), f.t, { x: lerp(0.8, 0.3, lean), y: lerp(0.4, -0.2, lean) });
    s.clawd.setPose(pose({ armL: 0.05, armR: lerp(0.1, 0.5, lean), squash: 0.35 }));
  };
  const chatQuiet = (mon: ReturnType<typeof oldMonitor>, t: number) => mon.set({ typed: '', cursor: Math.floor(t / 0.53) % 2 === 0, sent: ['CONFIRM?', HELLO] });
  const o11 = ashShot('out-sit', C.o11, C.o12, s => {
    const mon = chatSet(s);
    return f => {
      chatQuiet(mon, f.t);
      sitting(s, f, 0);
      const k = easeInOutCubic(unlerp(f.t, C.o11, C.o12));
      s.aim(lerp(0.6, 0.75, k), lerp(2.2, 1.65, k), lerp(10.5, 7.4, k), lerp(0.9, 0.75, k), 1.1, 0);
    };
  }, { overlay: drawCredits, flakes: 120 });

  const tHold = W(86, 4) - 0.4; // into the cursor on the last "help"
  const o12 = ashShot('out-rest', C.o12, C.black, s => {
    const mon = chatSet(s);
    const fieldX = MON_X - mon.screen.w / 2 + 0.3, fieldY = mon.screen.fieldY;
    return f => {
      chatQuiet(mon, f.t);
      sitting(s, f, smooth(unlerp(f.t, C.o12 + 0.4, C.o12 + 2.2)));
      const k = easeInOutCubic(unlerp(f.t, C.o12, tHold));
      const c = easeInOutCubic(unlerp(f.t, tHold, tHold + 1.6));
      // the wide two-shot pushes in, then settles on the field with his head resting at its edge
      const wx = lerp(0.75, 0.4, k), wy = lerp(1.65, 1.35, k), wz = lerp(7.4, 5.2, k);
      s.camera.position.set(lerp(wx, fieldX + 0.1, c), lerp(wy, fieldY - 0.06, c), lerp(wz, 1.5, c));
      s.camera.lookAt(lerp(lerp(0.75, 0.4, k), fieldX + 0.1, c), lerp(1.1, fieldY - 0.1, c), 0);
    };
  }, { overlay: drawCredits, flakes: 120 });

  const black = defineShot({
    id: 'out-black', start: C.black, end: C.end,
    build() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#000000');
      const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 10);
      return { scene, camera, update() {}, lyrics: false, post: () => ({ ...FLAT_POST, vignette: 0, grain: 0 }) };
    },
  });

  return [o1, o2, o3, o4, o5, o6, o7, o8, o9, o10, o11, o12, black];
}
