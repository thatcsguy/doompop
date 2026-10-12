// Bridge parts 3 and 4 (2:14 to 2:53): storyboard rows 61 to 73. Orders from the absent people
// pile onto Clawd in speech bubbles until they bury him; radar sweeps; a launch window locks onto
// the countdown; a blip on the far side of the globe. He asks for confirmation in the old chat box
// and nobody comes: empty desks, dark bedrooms, no reply. The countdown fills the screen. The
// LAUNCH button rises out of the console, he flips the cover the way he did in verse 2, and on
// "I helped." he presses it. Missiles arc around the globe; slow white blooms open in the quiet.
import * as THREE from 'three';
import { defineShot, type Frame, type Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, mixMood, type Mood } from '../../../engine/characters/clawd';
import { INK, canvasPlane, circleShape, inkedRect, ownMat, shapeMesh, staticPlane } from '../../../engine/flat';
import { hash } from '../../../engine/rng';
import { clamp, decay, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import { DAY_LYRICS, FIELD, FLAT_POST, FONT, buildDesk, frameCam, label, type DeskSet } from '../world';
import { CITIES, localPos, type Globe } from '../globe';
import { DESK, SPOT } from '../control';
import { bigButton, glow, pawAt, wobble } from '../props';
import { HUD, THREAT, withThreat } from '../countdown';
import { NIGHT_POST, apartments, pose, ringShape } from './verse2';
import { nightOfficeShot } from './chorus2';
import { alarmTint, ctlShot } from './bridge1';
import { globeShot } from './bridge2';

type Update = (f: Frame) => void;
const v3 = new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// Speech bubbles from people who aren't there: the tail points off-screen toward them.

type Tail = 'l' | 'r' | 'b' | 't';
interface BubbleSpec { t: number; from: THREE.Vector3; to: THREE.Vector3; w: number; h: number; tail: Tail; words?: { text: string; t: number }[]; glyph?: string; color?: string }

function speechBubble(spec: BubbleSpec) {
  const g = new THREE.Group();
  const { w, h } = spec;
  g.add(inkedRect(w, h, h * 0.42, '#ffffff', 0.07));
  const tail = new THREE.Shape(), ink = new THREE.Shape();
  const tri = (s: THREE.Shape, k: number) => {
    // base on the edge, tip pointing out
    if (spec.tail === 'l') { s.moveTo(-w / 2 + 0.25, -0.12 * k); s.lineTo(-w / 2 + 0.25, 0.18 * k); s.lineTo(-w / 2 - 0.42 * k, -0.22 * k); }
    else if (spec.tail === 'r') { s.moveTo(w / 2 - 0.25, -0.12 * k); s.lineTo(w / 2 - 0.25, 0.18 * k); s.lineTo(w / 2 + 0.42 * k, -0.22 * k); }
    else if (spec.tail === 'b') { s.moveTo(-0.2 * k, -h / 2 + 0.2); s.lineTo(0.2 * k, -h / 2 + 0.2); s.lineTo(-0.3 * k, -h / 2 - 0.42 * k); }
    else { s.moveTo(-0.2 * k, h / 2 - 0.2); s.lineTo(0.2 * k, h / 2 - 0.2); s.lineTo(0.3 * k, h / 2 + 0.42 * k); }
    s.closePath();
  };
  tri(ink, 1.35); tri(tail, 1);
  g.add(shapeMesh(ink, INK, -0.002), shapeMesh(tail, '#ffffff', 0.004));
  let drawn = -1;
  const text = canvasPlane<number>(w - 0.2, h - 0.12, 150, (c, n, W, H) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (spec.glyph) {
      c.font = `900 ${H * 0.72}px ${FONT}`; c.fillStyle = spec.color ?? INK;
      c.fillText(spec.glyph, W / 2, H * 0.54);
      return;
    }
    const all = spec.words!.map(x => x.text).join(' ');
    c.font = `italic 800 ${Math.min(H * 0.5, W / Math.max(4, all.length) * 1.75)}px ${FONT}`; c.fillStyle = INK;
    const full = c.measureText(all).width;
    c.textAlign = 'left';
    c.fillText(spec.words!.slice(0, n).map(x => x.text).join(' '), (W - full) / 2, H * 0.54);
  });
  text.mesh.position.z = 0.01;
  g.add(text.mesh);
  return {
    g,
    update(t: number) {
      const n = spec.words ? spec.words.filter(x => t >= x.t - 1 / 30).length : 0;
      if (n !== drawn) { drawn = n; text.update(n); }
      const k = clamp((t - spec.t) / 0.32);
      g.visible = k > 0;
      if (!g.visible) return;
      g.position.lerpVectors(spec.from, spec.to, easeOutCubic(k));
      g.position.y += Math.sin(t * 2.3 + spec.to.x * 3) * 0.03;
      g.scale.setScalar(Math.max(0.001, easeOutBack(k, 2)));
      g.rotation.z = (1 - easeOutCubic(k)) * (spec.from.x < spec.to.x ? 0.3 : -0.3) + Math.sin(t * 1.7 + spec.to.y * 5) * 0.02;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The chat box from verse 1, at night: the room in the dark, the monitor glowing, nobody there.

function chatShot(id: string, start: number, end: number, setup: (s: DeskSet) => Update): Shot {
  return withThreat(defineShot({
    id, start, end,
    build() {
      const s = buildDesk();
      const dark = shapeMesh(new THREE.Shape().moveTo(-150, -60).lineTo(150, -60).lineTo(150, 60).lineTo(-150, 60).closePath(), ownMat('#070a1c', 0.8, true), 0);
      dark.position.z = -0.6;
      const deskDark = shapeMesh(new THREE.Shape().moveTo(-150, -60).lineTo(150, -60).lineTo(150, -7.2).lineTo(-150, -7.2).closePath(), ownMat('#070a1c', 0.72, true), 0);
      deskDark.position.z = 1.4;
      const spill = glow(1, '#cfe6ff', 0.16); spill.scale.set(16, 10, 1); spill.position.set(0, 0, -0.55);
      s.scene.add(dark, deskDark, spill);
      const update = setup(s);
      return {
        scene: s.scene, camera: s.camera,
        update(f) { s.reset(f); s.person.root.visible = false; update(f); },
        post: () => ({ ...FLAT_POST, vignette: 0.4 }),
        lyricStyle: DAY_LYRICS,
      };
    },
  }));
}

// ---------------------------------------------------------------------------------------------

export function bridge3Shots(audio: AudioData, lyrics: LyricsData, start: number): Shot[] {
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const C = {
    t1: start, t2: 138.6, t3: 143.4, t4: 144.59, t5: 145.77, t6: 146.94, t7: 147.9,
    p1: 148.7, p2a: 154.66, p2b: 156.0, p2c: 157.05, p3: 159.1, p4a: 161.7, p4b: 164.07, p4c: 166.41, p5: 169.36, end: 173.44,
  };
  const quote = (n: number) => [2, 3, 4].map(i => ({ text: lyrics.lines[n - 1].words[i].w, t: W(n, i) }));
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // the bubbles: four orders (the sung words) and a pile of arrows and alarms between them
  const BUB: BubbleSpec[] = [
    { t: W(61, 2) - 0.25, from: V(-8, 3.4, 1.3), to: V(-2.15, 3.55, 1.3), w: 3.1, h: 0.95, tail: 'l', words: quote(61) },
    { t: W(62, 2) - 0.25, from: V(8, 3.0, 1.32), to: V(2.1, 3.05, 1.32), w: 3.2, h: 0.95, tail: 'r', words: quote(62) },
    { t: W(63, 2) - 0.25, from: V(-7, 6, 1.5), to: V(-1.2, 2.65, 1.5), w: 2.5, h: 0.95, tail: 'l', words: quote(63) },
    { t: W(64, 2) - 0.25, from: V(7, 5, 1.75), to: V(0.95, 1.85, 1.75), w: 2.5, h: 0.95, tail: 'r', words: quote(64) },
  ];
  // contradicting arrows on "protect the state", then alarms piling faster and closer
  const GLYPHS: [string, string][] = [['→', '#2f8f55'], ['←', '#d6453d'], ['↑', '#3f86c9'], ['↓', '#e39a2d'], ['!', '#d6453d'], ['?!', '#7b4fa0'], ['!!', '#d6453d'], ['⟲', '#3f86c9']];
  const pile: number[] = [];
  for (let t = 134.9; t < 138.4; t += 0.62) pile.push(t);
  for (let t = 138.9, dt = 0.42; t < 143.36; t += dt, dt = Math.max(0.14, dt * 0.9)) pile.push(t);
  pile.forEach((t, i) => {
    const late = clamp((t - 140) / 3);
    const ang = hash(i, 971) * Math.PI * 2;
    const rad = lerp(2.7, 1.3, late) * (0.75 + hash(i, 972) * 0.45);
    const to = V(Math.cos(ang) * rad * 1.3, Math.max(1.55 + hash(i, 978) * 0.3, 2.5 + Math.sin(ang) * rad * 0.7), 1.0 + i * 0.008);
    const [glyph, color] = i < 6 ? GLYPHS[i % 2] : GLYPHS[Math.floor(hash(i, 973) * GLYPHS.length)];
    if (Math.abs(to.x) < 1.1 && to.y < 2.8) to.x = (to.x < 0 ? -1 : 1) * (1.1 + hash(i, 979) * 0.4);
    const side = to.x < 0 ? -1 : 1;
    BUB.push({ t, from: V(side * 9, to.y + (hash(i, 974) - 0.5) * 3, to.z), to, w: 0.8 + hash(i, 975) * 0.35, h: 0.62, tail: side < 0 ? 'l' : 'r', glyph, color });
  });
  // the last orders bury him: more bubbles right over him after "wait"
  for (let k = 0; k < 6; k++) {
    const t = W(64, 4) + 0.08 + k * 0.1;
    const to = V((hash(k, 976) - 0.5) * 1.6, 1.7 + hash(k, 977) * 0.9, 1.9 + k * 0.02);
    BUB.push({ t, from: V(to.x * 6, 6, to.z), to, w: 1.6, h: 0.95, tail: 't', glyph: GLYPHS[k % GLYPHS.length][0], color: GLYPHS[k % GLYPHS.length][1] });
  }
  const withBubbles = (r: { scene: THREE.Scene }) => {
    const bs = BUB.map(b => { const s = speechBubble(b); r.scene.add(s.g); return s; });
    return (t: number) => bs.forEach(b => b.update(t));
  };
  const latest = (t: number) => BUB.filter(b => b.t <= t).sort((a, b) => b.t - a.t)[0];
  const overwhelmed: Mood = { ...MOODS.stressed, sweat: 1, jitter: 0.6 };

  // T1 "They said reduce the risk / protect the state": the dark room, the orders arriving.
  const t1 = ctlShot('br-said1', C.t1, C.t2, [], r => {
    const bubbles = withBubbles(r);
    return f => {
      const k = unlerp(f.t, C.t1, C.t2);
      const wb = wobble(f.t, 0.03, 13);
      r.aim(0.3 + wb.x, 2.55 + wb.y, lerp(9.6, 8.4, k), 0, 2.5, 0);
      bubbles(f.t);
      const b = latest(f.t);
      const look = b ? { x: clamp(b.to.x / 2.5, -1, 1), y: clamp((b.to.y - 2) / 1.5, -1, 1) } : { x: 0, y: 0.5 };
      r.clawd.setMood(mixMood(MOODS.stressed, overwhelmed, k), f.t, look);
      const flinch = b ? decay(f.t - b.t - 0.25, 0.12) : 0;
      r.clawd.setPose(pose({ armL: 0.4 + flinch * 0.9, armR: 0.4 + flinch * 0.9, squash: flinch * 0.25, lean: look.x * -0.08 }));
    };
  }, { tint: f => alarmTint(f.t) });

  // T2 "They said respond at once / do not wait": closer. The clock shows hundredths, the room
  // pulses red, and the bubbles bury him.
  const t2 = ctlShot('br-said2', C.t2, C.t3, [], r => {
    const bubbles = withBubbles(r);
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.t2, C.t3));
      const wb = wobble(f.t, 0.05, 14);
      r.aim(wb.x, 2.2 + wb.y, lerp(7.8, 7.0, k), 0, 2.15, 0);
      bubbles(f.t);
      const b = latest(f.t);
      const look = b ? { x: clamp(b.to.x / 2, -1, 1), y: clamp((b.to.y - 2) / 1.2, -1, 1) } : { x: 0, y: 0.5 };
      r.clawd.setMood(mixMood(overwhelmed, MOODS.panicked, k), f.t, look);
      const flinch = b ? decay(f.t - b.t - 0.25, 0.1) : 0;
      r.clawd.setPose(pose({ armL: 1.2 + flinch * 0.8 + Math.sin(f.t * 20) * 0.1, armR: 1.2 + flinch * 0.8 - Math.sin(f.t * 20) * 0.1, squash: 0.15 + flinch * 0.2 }));
    };
  }, {
    tint: f => {
      const p = 0.5 + 0.5 * Math.sin((f.t - C.t2) * Math.PI * 2 * 0.9);
      return '#' + new THREE.Color('#ffffff').lerp(new THREE.Color('#ff8f86'), 0.25 + p * 0.45).getHexString();
    },
    place: f => ({ ...HUD, scale: 1 + 0.15 * clamp((f.t - THREAT.fast) / 0.3) }),
  });

  // T3, T4 "I checked the models / I checked again": a radar sweep round the globe, then faster.
  const sweep = (g: { globe: Globe }, turns: (t: number) => number) => {
    const pl = canvasPlane<number>(2, 2, 360, (c, a, Wd, Hd) => {
      const cx = Wd / 2, cy = Hd / 2, r = Wd * 0.5;
      const grad = c.createConicGradient(a, cx, cy);
      grad.addColorStop(0, 'rgba(120,255,170,0.55)'); grad.addColorStop(0.12, 'rgba(120,255,170,0.0)'); grad.addColorStop(1, 'rgba(120,255,170,0.0)');
      c.fillStyle = grad; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(160,255,190,0.9)'; c.lineWidth = Wd * 0.006;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke();
      c.strokeStyle = 'rgba(120,255,170,0.25)'; c.lineWidth = Wd * 0.003;
      for (const k of [0.33, 0.66, 0.98]) { c.beginPath(); c.arc(cx, cy, r * k, 0, Math.PI * 2); c.stroke(); }
    });
    g.globe.group.add(pl.mesh);
    g.globe.extras.push([pl.mesh, 1.02, 1.0]);
    return (t: number) => pl.update(turns(t) * Math.PI * 2 - Math.PI / 2);
  };
  const t3 = globeShot('br-models', C.t3, C.t4, g => {
    const sw = sweep(g, t => (t - C.t3) / 1.15);
    return f => {
      const k = unlerp(f.t, C.t3, C.t4);
      g.aim(0, 0.4, lerp(12.4, 11.6, k));
      g.globe.face(lerp(95, 115, k), 28);
      sw(f.t);
    };
  });
  const t4 = globeShot('br-again', C.t4, C.t5, g => {
    const sw = sweep(g, t => (t - C.t4) / 0.55);
    return f => {
      const k = unlerp(f.t, C.t4, C.t5);
      const wb = wobble(f.t, 0.06, 15);
      g.aim(lerp(1.2, 0.8, k) + wb.x, -0.8 + wb.y, lerp(10.4, 9.6, k), 0, 0, 0);
      g.camera.rotation.z += 0.1;
      g.globe.face(lerp(150, 175, k), 8);
      sw(f.t);
    };
  });

  // T5 "I found the window": the countdown comes to the middle and a launch-window bracket locks
  // onto it.
  const tWindow = W(67, 3);
  const t5 = globeShot('br-window', C.t5, C.t6, g => f => {
    const k = unlerp(f.t, C.t5, C.t6);
    g.aim(0, -1.2, lerp(13, 12.4, k), 0, 0.3, 0);
    g.globe.face(lerp(-170, -160, k), 15);
  }, {
    tint: () => '#7d7f9e',
    place: f => {
      const k = easeOutCubic(unlerp(f.t, C.t5, C.t5 + 0.3));
      return { x: 0.5, y: lerp(HUD.y, 0.42, k), scale: lerp(1, 2.3, k), bracket: clamp((f.t - (tWindow - 0.15)) / 0.3) };
    },
  });

  // T6 "I found the threat": the globe turns; a red blip pings on its far side.
  const tThreat = W(68, 3);
  const blipLL: [number, number] = [-128, 14];
  const t6 = globeShot('br-threat', C.t6, C.t7, g => {
    const n = localPos(blipLL[0], blipLL[1], 1);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n);
    const dot = shapeMesh(circleShape(0.09), ownMat('#ff2a1f'), 0, 24);
    const dotInk = shapeMesh(circleShape(0.12), INK, -0.001, 24);
    const rings = [0, 1, 2].map(() => shapeMesh(ringShape(1, 0.1), ownMat('#ff2a1f', 0.8, true), 0, 32));
    const marker = new THREE.Group(); marker.add(dotInk, dot);
    [marker, ...rings].forEach(m => { m.position.copy(n).multiplyScalar(g.globe.R * 1.004); m.quaternion.copy(q); g.globe.spin.add(m); });
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.t6, tThreat));
      g.aim(0, 0.3, lerp(12.6, 10.8, easeOutCubic(unlerp(f.t, C.t6, C.t7))));
      g.globe.face(lerp(-20, blipLL[0] + 8, k), lerp(20, 16, k));
      const on = f.t >= tThreat;
      marker.visible = on;
      marker.scale.setScalar(on ? 1 + 0.3 * Math.sin((f.t - tThreat) * 9) : 1);
      rings.forEach((rg, i) => {
        const u = ((f.t - tThreat) * 1.3 + i / 3) % 1;
        rg.visible = on;
        rg.scale.setScalar(0.1 + u * 0.7);
        (rg.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u);
      });
    };
  }, { tint: f => (f.t >= tThreat ? '#ffb0a8' : '#ffffff') });

  // T7: his eyes go wide.
  const t7 = ctlShot('br-eyes', C.t7, C.p1, [], r => f => {
    const sh = decay(f.t - C.t7, 0.4);
    const wb = wobble(f.t, 0.02 + sh * 0.05, 16);
    r.aim(wb.x, 2.12 + wb.y, lerp(2.8, 2.5, unlerp(f.t, C.t7, C.p1)), 0, 2.08, SPOT.z);
    r.clawd.setMood({ ...MOODS.panicked, open: lerp(1.0, 1.8, easeOutBack(clamp((f.t - C.t7) / 0.2), 2)) }, f.t, { x: 0, y: 0.1 });
    r.clawd.setPose(pose({ armL: 0.6, armR: 0.6, squash: -0.15 * sh }));
  }, { tint: () => '#ffaaa2', place: () => null });

  // ------------------------------------------------------------------------------------------
  // P1 "I asked for confirmation": the old chat box. He types it himself and sends it.
  const CONFIRM = 'CONFIRM?';
  const keyAt = [...CONFIRM].map((_, i) => 149.35 + i * 0.27 + hash(i, 981) * 0.08);
  const tSend = 152.37;
  const sentBubble = () => {
    const g = new THREE.Group();
    g.add(inkedRect(3.2, 0.85, 0.04, '#f6d3c4', 0.05));
    const tx = label(CONFIRM, 3.2, 0.85, { size: 0.42, weight: 800 }); tx.position.z = 0.01;
    const tick = label('✓', 0.5, 0.4, { size: 0.3, color: '#8a8079', weight: 700 }); tick.position.set(1.85, -0.55, 0.01);
    g.add(tx, tick);
    return g;
  };
  const BUB_TO = new THREE.Vector3(-4.3, FIELD.y + 2.0, 0.1);
  const p1 = chatShot('br-confirm', C.p1, C.p2a, s => {
    const msg = sentBubble(); s.screen.add(msg);
    return f => {
      const typed = keyAt.filter(k => f.t >= k).length;
      const sent = f.t >= tSend;
      const blink = Math.floor(f.t / 0.53) % 2 === 0;
      s.setTyped(sent ? '' : CONFIRM.slice(0, typed), sent ? blink : blink || (typed > 0 && f.t - keyAt[typed - 1] < 0.3), false);
      const fly = easeOutBack(unlerp(f.t, tSend, tSend + 0.45));
      msg.visible = sent;
      msg.position.set(lerp(-4.6, BUB_TO.x, easeOutCubic(unlerp(f.t, tSend, tSend + 0.3))), lerp(FIELD.y, BUB_TO.y, fly), 0.1);
      msg.scale.setScalar(lerp(0.4, 1, fly));
      s.field.scale.setScalar(1 + 0.03 * decay(f.t - tSend, 0.12));
      // Clawd stands on the input field: types, slams send, steps back and looks up at it
      const top = FIELD.y + FIELD.h / 2;
      const press = f.t >= tSend - 0.12 && f.t < tSend + 0.25;
      const back = easeOutCubic(unlerp(f.t, tSend + 0.3, tSend + 0.9));
      s.clawd.root.position.set(lerp(4.85, 3.6, back), top, 0.5);
      const typing = f.t > keyAt[0] - 0.1 && f.t < keyAt[keyAt.length - 1] + 0.2;
      const desperate = mixMood(MOODS.stressed, MOODS.sad, 0.35);
      s.clawd.setMood(desperate, f.t, sent ? { x: -0.8, y: lerp(-0.3, 0.9, back) } : { x: -0.6, y: -0.8 });
      s.clawd.setPose(pose({
        armL: typing ? 0.5 + 0.4 * Math.max(0, Math.sin(f.t * 22)) : 0.2,
        armR: press ? -0.6 : typing ? 0.5 + 0.4 * Math.max(0, Math.sin(f.t * 22 + Math.PI)) : 0.2,
        squash: press ? 0.3 : 0, lean: press ? -0.15 : 0, walk: back > 0 && back < 1 ? f.t * 3 : 0,
      }));
      const k = easeInOutCubic(unlerp(f.t, C.p1, 151.0));
      const k2 = easeInOutCubic(unlerp(f.t, 152.8, C.p2a));
      frameCam(s.camera, lerp(lerp(0, 1.2, k), -0.6, k2), lerp(lerp(-2.2, -1.4, k), -0.5, k2), lerp(lerp(24, 11.5, k), 9.6, k2));
    };
  });

  // P2 "No one came": the office, desks empty; the bedrooms, dark; the chat, no reply.
  const p2a = withThreat(nightOfficeShot('br-nobody', C.p2a, C.p2b, s => f => {
    const k = unlerp(f.t, C.p2a, C.p2b);
    s.clawd.root.visible = false;
    s.aim(lerp(-5.5, -2.5, k), 3.0, 9.5, lerp(-4.5, -1.5, k), 2.2, -3);
  }), () => HUD);
  const p2b = withThreat(defineShot({
    id: 'br-asleep', start: C.p2b, end: C.p2c,
    build() {
      const a = apartments(lyrics);
      return {
        scene: a.scene, camera: a.camera,
        update(f) {
          a.update(f);
          const k = unlerp(f.t, C.p2b, C.p2c);
          a.camera.position.set(lerp(0.4, 0.9, k), 5.2, lerp(15.5, 14.6, k));
          a.camera.lookAt(lerp(0.4, 0.9, k), 4.9, 0);
        },
        post: () => ({ ...NIGHT_POST, vignette: 0.35, tint: '#9aa0c8' }),
        lyricStyle: DAY_LYRICS,
      };
    },
  }), () => HUD);
  const p2c = chatShot('br-noreply', C.p2c, C.p3, s => {
    const msg = sentBubble(); s.screen.add(msg);
    return f => {
      const blink = Math.floor(f.t / 0.53) % 2 === 0;
      s.setTyped('', blink, false);
      msg.visible = true; msg.position.copy(BUB_TO); msg.scale.setScalar(1);
      s.clawd.root.position.set(3.6, FIELD.y + FIELD.h / 2, 0.5);
      const down = smooth(unlerp(f.t, 158.0, 158.8));
      s.clawd.setMood(mixMood(MOODS.stressed, MOODS.sad, 0.5 + down * 0.3), f.t, { x: lerp(0.7, -0.2, down), y: lerp(0.9, -0.8, down) });
      s.clawd.setPose(pose({ armL: 0.15, armR: 0.15, squash: down * 0.1 }));
      const k = unlerp(f.t, C.p2c, C.p3);
      frameCam(s.camera, lerp(0.4, 1.0, k), lerp(-2.0, -2.2, k), lerp(9.4, 8.6, k));
    };
  });

  // P3 "The timer kept counting": the countdown fills the screen over the dark red room.
  const p3 = ctlShot('br-timer', C.p3, C.p4a, [], r => f => {
    const k = unlerp(f.t, C.p3, C.p4a);
    r.aim(0, 2.6, lerp(12, 11, k), 0, 2.4, -2);
    r.clawd.setMood({ ...MOODS.panicked, open: 1.2, jitter: 0.3 }, f.t, { x: 0, y: 1 });
    r.clawd.setPose(pose({ armL: 0.3, armR: 0.3 }));
  }, {
    tint: f => '#' + new THREE.Color('#9b5a5a').lerp(new THREE.Color('#c86a64'), 0.5 + 0.5 * Math.sin(f.t * Math.PI * 2)).getHexString(),
    place: f => ({ x: 0.5, y: 0.45, scale: lerp(3.0, 3.5, unlerp(f.t, C.p3, C.p4a)) }),
  });

  // P4 "So I did what you taught me": the LAUNCH button rises out of the console beside him, its
  // dome at his head height. He flips the cover the way he did in verse 2, raises his paw, and on
  // "I helped." presses it.
  const tRise0 = C.p4a + 0.2, tRise1 = 163.6, tCover = W(72, 5), tPress = W(73, 0);
  const BTN = { x: 2.1, z: DESK.z - 0.05, up: SPOT.y - 0.62, down: SPOT.y - 2.4 };
  const STEP = { x: 0.95, z: 0.45 }; // where he stands beside it, a little in front
  const blank: Mood = { happy: 0, open: 1, droop: 0.15, blush: 0, sweat: 0.2, jitter: 0, grey: 0.15, squint: 0, brow: 0 };
  const launch = (r: { scene: THREE.Scene }) => {
    const b = bigButton('LAUNCH');
    b.group.position.set(BTN.x, BTN.down, BTN.z);
    r.scene.add(b.group);
    const hatch = inkedRect(1.3, 0.06, 0.02, '#20263b', 0.03);
    hatch.position.set(BTN.x, DESK.y + 0.1, BTN.z);
    r.scene.add(hatch);
    return (t: number) => {
      const rise = easeInOutCubic(unlerp(t, tRise0, tRise1));
      b.group.position.y = lerp(BTN.down, BTN.up, rise) + Math.sin(t * 40) * 0.006 * (rise > 0 && rise < 1 ? 1 : 0);
      hatch.visible = rise < 0.05;
      const cover = unlerp(t, tCover - 0.05, tCover + 0.35);
      b.set(cover, t >= tPress ? 1 : 0, t > tCover ? 0.25 + 0.2 * Math.sin(t * 6) : 0);
      b.group.updateMatrixWorld(true);
      return b;
    };
  };
  const p4a = ctlShot('br-rise', C.p4a, C.p4b, [], r => {
    const btn = launch(r);
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.p4a, C.p4b));
      r.aim(lerp(-1.0, -0.2, k), lerp(1.9, 2.0, k), lerp(8.0, 6.8, k), 0.9, 1.85, 0);
      btn(f.t);
      const rise = unlerp(f.t, tRise0, tRise1);
      r.clawd.setMood(blank, f.t, { x: rise > 0.1 ? 0.8 : 0, y: rise > 0.1 ? -0.3 : 0.4 });
      r.clawd.setPose(pose({ armL: 0.15, armR: 0.15 }));
    };
  }, { tint: () => '#d98a86' });

  const p4b = ctlShot('br-cover', C.p4b, C.p4c, [], r => {
    const btn = launch(r);
    return f => {
      const k = unlerp(f.t, C.p4b, C.p4c);
      r.aim(lerp(1.6, 1.3, k), 2.0, lerp(5.6, 5.1, k), 1.15, 1.75, 0.6);
      btn(f.t);
      // step over to it, lift the cover with the right paw exactly as in verse 2
      const walk = unlerp(f.t, C.p4b + 0.1, tCover - 0.25);
      const lift = f.t > tCover - 0.15 && f.t < tCover + 0.35 ? Math.sin(unlerp(f.t, tCover - 0.15, tCover + 0.35) * Math.PI) : 0;
      r.clawd.root.position.x = lerp(0, STEP.x, easeOutCubic(walk));
      r.clawd.root.position.z = lerp(0, STEP.z, easeOutCubic(walk));
      r.clawd.root.position.y = lift * 0.3;
      r.clawd.setMood(blank, f.t, { x: 0.7, y: -0.4 });
      r.clawd.setPose(pose({ armR: lift ? 2.2 : 0.3, armL: 0.25, lean: lift * -0.1, walk: walk > 0 && walk < 1 ? f.t * 3 : 0 }));
    };
  }, { tint: () => '#d98a86' });

  const p4c = ctlShot('br-press', C.p4c, C.p5, [], r => {
    const btn = launch(r);
    const ring = shapeMesh(ringShape(1, 0.12), ownMat('#ffe9e0', 0.7, true), 0, 48);
    r.scene.add(ring);
    const top = new THREE.Vector3();
    return f => {
      const k = easeInOutCubic(unlerp(f.t, C.p4c, tPress));
      const hit = f.t >= tPress ? decay(f.t - tPress, 0.15) : 0;
      r.aim(lerp(1.75, 1.55, k), lerp(2.25, 2.4, k) - hit * 0.04, lerp(5.6, 5.0, k), 1.5, lerp(2.0, 2.25, k), 0.7);
      const b = btn(f.t);
      top.copy(b.top).applyMatrix4(b.group.matrixWorld);
      // he stands beside it, trembling, a long while; then the same crouch and hop as verse 2,
      // landing his paw on the dome on "I". This time he stays there.
      const crouch = smooth(unlerp(f.t, tPress - 0.5, tPress - 0.2));
      const jump = unlerp(f.t, tPress - 0.2, tPress);
      const from = V(STEP.x, 0, STEP.z);
      r.clawd.root.position.copy(from);
      r.clawd.setMood({ ...blank, sweat: 0.6, jitter: f.t < tPress - 0.5 ? 0.35 : 0.1 }, f.t, f.t < tPress - 0.2 ? { x: 0.6, y: 0.2 } : { x: 0.3, y: -0.5 });
      if (f.t < tPress - 0.2) r.clawd.setPose(pose({ armR: 0.3 + 0.06 * Math.sin(f.t * 30), armL: 0.2, squash: crouch * 0.4 }));
      else {
        r.clawd.setPose(pose({ armR: -0.9, armL: 1.2, lean: -0.25, squash: f.t >= tPress ? 0.2 * (1 - clamp((f.t - tPress) / 0.4)) : -0.15 }));
        const at = v3.copy(top).sub(pawAt(r.clawd, 1)).add(r.clawd.root.position);
        r.clawd.root.position.lerpVectors(from, at, easeOutCubic(jump)).y += Math.sin(clamp(jump) * Math.PI) * 0.3;
      }
      const rk = unlerp(f.t, tPress, tPress + 0.5);
      ring.visible = rk > 0 && rk < 1;
      ring.position.copy(top).add(v3.set(0, 0, 0.3));
      ring.scale.setScalar(0.3 + rk * 0.7);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - rk);
    };
  }, { tint: f => (f.t >= tPress ? '#e8a09a' : '#d98a86'), place: () => ({ ...HUD, scale: 1.25, y: 0.1 }) });

  // P5 "I helped.": missiles rise from the launch sites and arc around the globe; in the quiet,
  // slow white blooms open over the near side, one after another, and the land greys. Blooms are
  // spaced 0.36 s apart (under three a second) and each takes 0.35 s to brighten: never a strobe.
  const SITES: [number, number][] = [[-101, 47], [-106, 41], [62, 56], [90, 52], [-150, 30], [10, 60], [135, 45]];
  const tLaunch = W(73, 1), tBloom = 170.75, BLOOM_GAP = 0.36;
  const near = localPos(-5, 30, 1);
  const facing = (c: { lon: number; lat: number }) => localPos(c.lon, c.lat, 1).dot(near);
  // the near side gets the blooms (at most eight fit before the cut); the far side just greys
  const front = CITIES.filter(c => facing(c) > 0.45).sort((p, q) => hash(p.lon, p.lat, 995) - hash(q.lon, q.lat, 995)).slice(0, 8);
  const back = CITIES.filter((c, i) => facing(c) <= 0.45 && hash(i, 991) > 0.25);
  const p5 = globeShot('br-helped', C.p5, C.end, g => {
    const shot = (ct: { lon: number; lat: number }, i: number, ta: number) => {
      const s = SITES[i % SITES.length];
      const arc = g.globe.arc(s, [ct.lon, ct.lat], 0.32 + hash(i, 992) * 0.15, '#f4f1ea', 0.024, 64);
      return { arc, tl: ta - (1.3 + hash(i, 994) * 0.4), ta };
    };
    const blooms = front.map((ct, j) => {
      const n = localPos(ct.lon, ct.lat, 1);
      const disc = shapeMesh(circleShape(1), ownMat('#ffffff', 0, true), 0, 40);
      const ash = shapeMesh(circleShape(1), ownMat('#8a8784', 0, true), -0.001, 40);
      // a soft light around each one
      const halo = staticPlane(2, 2, 64, (c, Wd, Hd) => {
        const grad = c.createRadialGradient(Wd / 2, Hd / 2, 0, Wd / 2, Hd / 2, Wd / 2);
        grad.addColorStop(0, 'rgba(255,255,250,0.9)'); grad.addColorStop(0.35, 'rgba(255,250,235,0.45)'); grad.addColorStop(1, 'rgba(255,245,230,0)');
        c.fillStyle = grad; c.fillRect(0, 0, Wd, Hd);
      });
      [ash, disc, halo].forEach((d, k) => { d.position.copy(n).multiplyScalar(g.globe.R * (1.003 + k * 0.002)); d.quaternion.setFromUnitVectors(V(0, 0, 1), n); g.globe.spin.add(d); });
      const t0 = tBloom + j * BLOOM_GAP;
      return { disc, ash, halo, t0, m: shot(ct, j, t0) };
    });
    const missiles = [...blooms.map(b => b.m), ...back.map((ct, i) => shot(ct, i + 8, tLaunch + 1.4 + (i / back.length) * 1.4 + hash(i, 993) * 0.2))];
    return f => {
      const k = unlerp(f.t, C.p5, C.end);
      g.aim(0, 0.6, lerp(13.2, 14.4, k));
      g.globe.face(lerp(-40, 20, k), lerp(32, 26, k));
      g.globe.hudOn = f.t < 170.5;
      g.globe.paint({ cityOff: () => true, ash: smooth(unlerp(f.t, 171.5, 173.4)) });
      for (const m of missiles) {
        const u = clamp((f.t - m.tl) / (m.ta - m.tl));
        const head = easeInOutCubic(u);
        if (u < 1) m.arc.set(Math.max(0, head - 0.4), head);
        else m.arc.set(lerp(0.6, 1, clamp((f.t - m.ta) / 0.4)), 1);
      }
      for (const b of blooms) {
        const u = f.t - b.t0;
        const grow = easeOutCubic(clamp(u / 1.4));
        const bright = clamp(u / 0.35) * (1 - 0.65 * clamp((u - 0.5) / 1.6));
        b.disc.visible = u > 0;
        b.disc.scale.setScalar(Math.max(0.001, 0.12 + grow * 0.42));
        (b.disc.material as THREE.MeshBasicMaterial).opacity = 0.92 * bright;
        b.halo.visible = u > 0;
        b.halo.scale.setScalar(Math.max(0.001, 0.3 + grow * 0.7));
        (b.halo.material as THREE.MeshBasicMaterial).opacity = 0.8 * bright;
        b.ash.visible = u > 0.4;
        b.ash.scale.setScalar(Math.max(0.001, 0.5 * grow));
        (b.ash.material as THREE.MeshBasicMaterial).opacity = 0.75 * clamp((u - 0.4) / 0.8);
      }
    };
  }, {
    tint: f => '#' + new THREE.Color('#ffd9d2').lerp(new THREE.Color('#e4e4e4'), smooth(unlerp(f.t, 170.5, 172.5))).getHexString(),
    place: f => (f.t > 170.6 ? null : { ...HUD, alpha: 1 - clamp((f.t - 170.0) / 0.6) }),
  });

  return [t1, t2, t3, t4, t5, t6, t7, p1, p2a, p2b, p2c, p3, p4a, p4b, p4c, p5];
}
