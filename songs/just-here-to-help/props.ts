// Props shared by the sections after verse 1: standing people, boxes, "?" balloons, the DONE stamp,
// the HELPER name tag, the pointer hand, confetti and sparkles. Flat cut-outs like engine/flat.ts.
// Units match the office set: floor at y = 0, desk tops at 1.45, a standing person about 3.3 tall,
// Clawd about 1.1 tall.
import * as THREE from 'three';
import { INK, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane, circleShape } from '../../engine/flat';
import { hash, noise1 } from '../../engine/rng';
import type { Clawd } from '../../engine/characters/clawd';
import { clamp, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { FONT } from './world';

export const SHIRTS = ['#8fb3e0', '#e8a07a', '#9fd0a8', '#e6c46f', '#c3a6e0', '#f2a6b4', '#86c5c9', '#d9b38c'];
export const PANTS = ['#4b5a7a', '#5a4a3f', '#3f5f5a', '#6b5b7a', '#7a6a5e'];
export const HAIRS = ['#4a3426', '#2b1d16', '#c9853d', '#8a5a3a', '#d9c8a0', '#7d7470'];
export const DONE_GREEN = '#2f9e5b';
export const pick = <T>(xs: T[], ...seed: number[]) => xs[Math.floor(hash(...seed) * xs.length) % xs.length];

/** A rectangle with only its bottom corners rounded: the cel-shade band at the foot of a shape. */
export function bandShape(w: number, h: number, r: number, y0 = 0): THREE.Shape {
  const s = new THREE.Shape(), x0 = -w / 2;
  r = Math.min(r, w / 2, h);
  s.moveTo(x0, y0 + h);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, Math.PI * 1.5, Math.PI * 2, false);
  s.lineTo(x0 + w, y0 + h);
  s.closePath();
  return s;
}

/** A four-point sparkle star. */
export function starShape(r: number, inner = 0.28): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * inner : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}

export interface Part { w: number; h: number; r: number; x?: number; y?: number; rot?: number }
/**
 * Several rounded rects merged under one ink outline (all outlines behind all fills), so a figure
 * built from parts reads as one silhouette.
 */
export function blob(parts: Part[], fill: THREE.ColorRepresentation | THREE.Material, stroke = 0.05) {
  const g = new THREE.Group();
  const mat = fill instanceof THREE.Material ? fill : ownMat(fill);
  for (const p of parts) {
    const o = shapeMesh(roundedRectShape(p.w + stroke * 2, p.h + stroke * 2, p.r + stroke), INK, 0);
    o.position.set(p.x ?? 0, p.y ?? 0, 0); o.rotation.z = p.rot ?? 0;
    const f = shapeMesh(roundedRectShape(p.w, p.h, p.r), mat, 0.003);
    f.position.set(p.x ?? 0, p.y ?? 0, 0.003); f.rotation.z = p.rot ?? 0;
    g.add(o, f);
  }
  return g;
}

/** World position of one of Clawd's paws (0 left, 1 right). Call after his pose is set. */
export function pawAt(c: Clawd, side: 0 | 1, out = new THREE.Vector3()) {
  c.root.updateMatrixWorld(true);
  return c.paws[side].getWorldPosition(out);
}
/** Small handheld camera wobble, deterministic. */
export const wobble = (t: number, amp: number, seed = 0) => ({ x: noise1(t * 1.3, seed) * amp, y: noise1(t * 1.1, seed + 7) * amp });

// ---------------------------------------------------------------------------------------------
// People

export interface StandPose { armL: number; armR: number; bob: number; lean: number; walk: number; flip?: boolean }
export const STAND: StandPose = { armL: 0.12, armR: 0.12, bob: 0, lean: 0, walk: 0 };

/**
 * A faceless capsule person standing, facing the camera. Origin between the feet; about 3.3 tall.
 * seed picks shirt, trousers and hair. Call pose() every frame. Held props go in .hands.
 */
export function standingPerson(seed: number, shirt = pick(SHIRTS, seed, 1)) {
  const pants = pick(PANTS, seed, 2), hairCol = pick(HAIRS, seed, 3), style = Math.floor(hash(seed, 4) * 5);
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const shirtMat = ownMat(shirt), pantsMat = ownMat(pants);
  const legs = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 0.95, -0.02);
    const leg = inkedRect(0.36, 0.92, 0.12, pantsMat, 0.06);
    leg.position.y = -0.46;
    const shoe = inkedRect(0.46, 0.18, 0.08, '#3a2e28', 0.05);
    shoe.position.set(side * 0.04, -0.88, 0.01);
    pivot.add(leg, shoe);
    root.add(pivot);
    return pivot;
  });
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.6, 2.32, -0.01);
    const arm = inkedRect(0.3, 1.15, 0.15, shirtMat, 0.06);
    arm.position.y = -0.5;
    const hand = inkedCircle(0.17, shirtMat, 0.06);
    hand.position.set(0, -1.1, 0.004);
    pivot.add(arm, hand);
    body.add(pivot);
    return pivot;
  });
  const torso = inkedRect(1.2, 1.6, 0.42, shirtMat, 0.07);
  torso.position.y = 1.72;
  const band = shapeMesh(bandShape(1.2, 0.42, 0.42, 0.92), ownMat(new THREE.Color(shirt).multiplyScalar(0.86)), 0.004);
  const collar = inkedRect(0.5, 0.16, 0.06, '#f4f1ea', 0.05);
  collar.position.set(0, 2.47, 0.01);
  const head = inkedCircle(0.47, shirtMat, 0.07);
  head.position.set(0, 2.98, 0.005);
  body.add(torso, band, collar, head);
  const hair = new THREE.Group();
  hair.position.set(0, 2.98, 0.012);
  const cap = new THREE.Shape();
  cap.absarc(0, 0, 0.53, Math.PI * 0.02, Math.PI * 0.98, false);
  cap.quadraticCurveTo(0, 0.12, 0.53 * Math.cos(Math.PI * 0.02), 0.53 * Math.sin(Math.PI * 0.02));
  if (style === 0 || style === 1 || style === 4) hair.add(shapeMesh(cap, hairCol, 0));
  if (style === 1) { const bun = inkedCircle(0.2, hairCol, 0.05); bun.position.set(0, 0.55, -0.004); hair.add(bun); }
  if (style === 2) { // side swoop
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.53, Math.PI * 0.1, Math.PI * 1.02, false);
    s.lineTo(0.15, 0.18); s.closePath();
    hair.add(shapeMesh(s, hairCol, 0));
  }
  if (style === 4) { const long = inkedRect(1.15, 1.0, 0.4, hairCol, 0.06); long.position.set(0, -0.35, -0.03); hair.add(long); }
  body.add(hair);
  const hands = new THREE.Group(); // held props, in front of the torso
  hands.position.set(0, 1.55, 0.12);
  body.add(hands);
  return {
    root, hands, shirt,
    pose(p: StandPose) {
      const ph = p.walk * Math.PI * 2;
      body.position.y = p.bob * 0.12 + (p.walk ? Math.abs(Math.sin(ph)) * 0.06 : 0);
      body.rotation.z = p.lean;
      arms[0].rotation.z = -p.armL + (p.walk ? Math.sin(ph) * 0.25 : 0);
      arms[1].rotation.z = p.armR - (p.walk ? Math.sin(ph) * 0.25 : 0);
      legs[0].rotation.z = p.walk ? Math.sin(ph) * 0.3 : 0;
      legs[1].rotation.z = p.walk ? -Math.sin(ph) * 0.3 : 0;
      root.scale.x = p.flip ? -Math.abs(root.scale.x) : Math.abs(root.scale.x);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Things people hand to Clawd

const BOX_LABELS = ['', '', 'TODO', '', 'ASAP', '', 'MISC', '', 'Q3', ''];
/** A cardboard box. Origin at the bottom centre. mark: '?' or a word on its label ('' = squiggles). */
export function cardboardBox(w = 0.9, h = 0.68, seed = 0, mark?: string) {
  const g = new THREE.Group();
  const col = new THREE.Color('#d9a86c').offsetHSL((hash(seed, 1) - 0.5) * 0.02, 0, (hash(seed, 2) - 0.5) * 0.06);
  const b = inkedRect(w, h, 0.03, ownMat(col), 0.05);
  b.position.y = h / 2;
  const shade = shapeMesh(bandShape(w, h * 0.2, 0.03, 0), ownMat(col.clone().multiplyScalar(0.85)), 0.004);
  const tape = shapeMesh(roundedRectShape(w * 0.16, h, 0, 0, h / 2), ownMat('#ecd3a2'), 0.005);
  g.add(b, shade, tape);
  const text = mark ?? BOX_LABELS[Math.floor(hash(seed, 3) * BOX_LABELS.length)];
  const lw = w * 0.5, lh = h * 0.36;
  const lab = staticPlane(lw, lh, 200, (c, W, H) => {
    c.fillStyle = '#fbf7ef'; c.strokeStyle = INK; c.lineWidth = H * 0.06;
    c.beginPath(); c.roundRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1, H * 0.08); c.fill(); c.stroke();
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (text) {
      c.font = `900 ${H * (text === '?' ? 0.78 : 0.48)}px ${FONT}`;
      c.fillText(text, W / 2, H * 0.55);
    } else {
      c.lineWidth = H * 0.08; c.lineCap = 'round';
      for (let r = 0; r < 2; r++) {
        c.beginPath(); c.moveTo(W * 0.2, H * (0.38 + r * 0.26));
        for (let k = 1; k <= 5; k++) c.lineTo(W * (0.2 + k * 0.12 * (r ? 0.8 : 1)), H * (0.38 + r * 0.26) + (hash(seed, r, k) - 0.5) * H * 0.12);
        c.stroke();
      }
    }
  });
  lab.position.set(w * 0.2, h * 0.55, 0.008);
  g.add(lab);
  return g;
}

/** A party balloon with a "?" on it. Origin at the bottom of its string. */
export function questionBalloon(color: string, string = 1.1) {
  const g = new THREE.Group();
  const line = shapeMesh(roundedRectShape(0.03, string, 0, 0, string / 2), INK, 0);
  const knot = new THREE.Shape();
  knot.moveTo(-0.08, string - 0.02); knot.lineTo(0.08, string - 0.02); knot.lineTo(0, string + 0.1); knot.closePath();
  const ball = new THREE.Group();
  ball.add(inkedCircle(0.42, color, 0.05));
  ball.position.y = string + 0.5;
  ball.scale.y = 1.15;
  const hi = shapeMesh(roundedRectShape(0.1, 0.22, 0.05), ownMat('#ffffff', 0.55, true), 0.006);
  hi.position.set(-0.2, 0.12, 0); hi.rotation.z = 0.5;
  ball.add(hi);
  const q = staticPlane(0.6, 0.6, 160, (c, W, H) => {
    c.font = `900 ${H * 0.8}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = H * 0.1; c.strokeStyle = INK; c.lineJoin = 'round';
    c.strokeText('?', W / 2, H * 0.55); c.fillStyle = '#ffffff'; c.fillText('?', W / 2, H * 0.55);
  });
  q.position.set(0.02, -0.02, 0.008);
  ball.add(q);
  g.add(line, shapeMesh(knot, color, 0.004), ball);
  return Object.assign(g, { ball });
}

/** The green DONE rubber-stamp mark. A plane w wide (w * 0.46 tall). */
export function doneMark(w = 1.6, color = DONE_GREEN, seed = 1) {
  return staticPlane(w, w * 0.46, 220, (c, W, H) => {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = H * 0.09;
    c.beginPath(); c.roundRect(H * 0.08, H * 0.08, W - H * 0.16, H - H * 0.16, H * 0.12); c.stroke();
    c.font = `900 ${H * 0.62}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('DONE', W / 2, H * 0.54);
    // rubber texture: knock out small specks
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) {
      c.globalAlpha = 0.3 + hash(seed, i, 3) * 0.7;
      c.beginPath(); c.arc(hash(seed, i, 1) * W, hash(seed, i, 2) * H, H * (0.01 + hash(seed, i, 4) * 0.035), 0, Math.PI * 2); c.fill();
    }
  });
}

/** A rubber stamp: wooden knob and handle over a green pad. Origin at the bottom of the pad. */
export function rubberStamp(scale = 1) {
  const g = new THREE.Group();
  const pad = inkedRect(0.9, 0.12, 0.02, DONE_GREEN, 0.045); pad.position.y = 0.06;
  const base = inkedRect(0.8, 0.24, 0.03, '#a0704a', 0.045); base.position.y = 0.24;
  const neck = inkedRect(0.2, 0.42, 0.05, '#c48a55', 0.045); neck.position.set(0, 0.55, -0.01);
  const knob = inkedCircle(0.22, '#c48a55', 0.045); knob.position.set(0, 0.86, 0);
  g.add(pad, base, neck, knob);
  g.scale.setScalar(scale);
  return g;
}

/** The "HELLO my name is HELPER" sticker that Clawd wears from the pre-chorus on. Centred. */
export function helperTag(w = 0.46, faded = 0) {
  const red = new THREE.Color('#d6453d').lerp(new THREE.Color('#9a8f88'), faded).getStyle();
  return staticPlane(w, w * 0.72, 600, (c, W, H) => {
    c.fillStyle = red; c.strokeStyle = INK; c.lineWidth = H * 0.05;
    c.beginPath(); c.roundRect(H * 0.04, H * 0.04, W - H * 0.08, H - H * 0.08, H * 0.1); c.fill(); c.stroke();
    c.fillStyle = faded > 0.5 ? '#d8d2c8' : '#ffffff';
    c.fillRect(H * 0.1, H * 0.36, W - H * 0.2, H * 0.52);
    c.font = `900 ${H * 0.2}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('HELLO', W / 2, H * 0.2);
    c.fillStyle = INK; c.font = `italic 900 ${H * 0.3}px ${FONT}`;
    c.fillText('HELPER', W / 2, H * 0.63);
  });
}

/** Stick the HELPER tag on a Clawd (it rides on his body group). */
export function wearTag(body: THREE.Group, faded = 0) {
  const tag = helperTag(0.46, faded);
  tag.position.set(0.02, 0.4, 0.03);
  tag.rotation.z = -0.06;
  body.add(tag);
  return tag;
}

/** The GUI pointing-hand cursor, white glove with an ink outline. Origin at the fingertip. */
export function pointerHand(scale = 1) {
  const g = new THREE.Group();
  const hand = blob([
    { w: 0.36, h: 1.0, r: 0.18, x: 0, y: -0.5 },             // index finger
    { w: 1.1, h: 0.9, r: 0.22, x: 0.36, y: -1.25 },          // palm
    { w: 0.34, h: 0.62, r: 0.17, x: 0.34, y: -0.88 },        // curled fingers
    { w: 0.34, h: 0.58, r: 0.17, x: 0.64, y: -0.9 },
    { w: 0.34, h: 0.52, r: 0.17, x: 0.92, y: -0.95 },
    { w: 0.32, h: 0.7, r: 0.16, x: -0.3, y: -1.25, rot: 0.9 }, // thumb
    { w: 0.8, h: 0.4, r: 0.1, x: 0.4, y: -1.8 },             // cuff
  ], '#ffffff', 0.07);
  g.add(hand);
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Effects (pure functions of the time since they started)

/** A burst of confetti. update(dt) with dt = time since the burst (hidden before 0 and after life). */
export function confetti(n: number, seed: number, opts: { colors?: string[]; speed?: number; size?: number; life?: number; gravity?: number; spread?: number } = {}) {
  const cols = opts.colors ?? ['#e0504a', '#f2b84b', '#3fa66b', '#5b9bd5', '#c9a7eb', '#ff8fa3'];
  const g = new THREE.Group();
  const bits = Array.from({ length: n }, (_, i) => {
    const s = (opts.size ?? 0.16) * (0.7 + hash(seed, i, 1) * 0.6);
    const m = shapeMesh(roundedRectShape(s, s * 0.55, 0.01), ownMat(cols[i % cols.length], 1, true), 0);
    g.add(m);
    const a = (opts.spread ?? Math.PI) * (hash(seed, i, 2) - 0.5) + Math.PI / 2;
    const v = (opts.speed ?? 5) * (0.5 + hash(seed, i, 3) * 0.7);
    return { m, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: (hash(seed, i, 4) - 0.5) * 18, z: hash(seed, i, 5) * 0.05 };
  });
  const life = opts.life ?? 1.6, grav = opts.gravity ?? 9;
  return {
    group: g,
    update(dt: number) {
      g.visible = dt >= 0 && dt < life;
      if (!g.visible) return;
      const fade = clamp((life - dt) / 0.4);
      for (const b of bits) {
        const drag = (1 - Math.exp(-dt * 2.2)) / 2.2; // air drag on the launch speed
        b.m.position.set(b.vx * drag, b.vy * drag - 0.5 * grav * dt * dt * 0.35, b.z);
        b.m.rotation.z = b.w * dt;
        b.m.scale.y = Math.cos(b.w * dt * 0.7);
        (b.m.material as THREE.MeshBasicMaterial).opacity = fade;
      }
    },
  };
}

/** A ring of sparkle stars that pops out and shrinks. update(dt), dt = time since the pop. */
export function sparkles(n: number, radius: number, color = '#ffd166', seed = 0) {
  const g = new THREE.Group();
  const stars = Array.from({ length: n }, (_, i) => {
    const s = new THREE.Group();
    s.add(shapeMesh(starShape(0.32), INK, 0), shapeMesh(starShape(0.24), color, 0.003));
    g.add(s);
    return { s, a: (i / n) * Math.PI * 2 + hash(seed, i) * 0.8, r: radius * (0.7 + hash(seed, i, 2) * 0.5), k: 0.6 + hash(seed, i, 3) * 0.6 };
  });
  return {
    group: g,
    update(dt: number, life = 0.6) {
      const k = dt / life;
      g.visible = k >= 0 && k < 1;
      if (!g.visible) return;
      for (const st of stars) {
        const e = easeOutCubic(k);
        st.s.position.set(Math.cos(st.a) * st.r * lerp(0.4, 1, e), Math.sin(st.a) * st.r * lerp(0.4, 1, e), 0);
        st.s.scale.setScalar(Math.max(0.001, st.k * Math.sin(Math.min(1, k * 1.3) * Math.PI)));
        st.s.rotation.z = k * 1.5;
      }
    },
  };
}

/** Horizontal speed lines trailing behind something moving. update(strength 0..1, dir +1 right / -1 left). */
export function speedLines(n = 6, len = 1.6, seed = 0) {
  const g = new THREE.Group();
  const lines = Array.from({ length: n }, (_, i) => {
    const m = shapeMesh(roundedRectShape(len * (0.6 + hash(seed, i) * 0.6), 0.05, 0.025), ownMat(INK, 1, true), 0);
    g.add(m);
    return { m, y: (i / (n - 1) - 0.5) * 0.9 + (hash(seed, i, 2) - 0.5) * 0.1, x: hash(seed, i, 3) * 0.5 };
  });
  return {
    group: g,
    update(strength: number, dir = 1, t = 0) {
      g.visible = strength > 0.02;
      for (const [i, l] of lines.entries()) {
        const flick = 0.5 + 0.5 * Math.sin(t * 40 + i * 2.3);
        l.m.position.set(-dir * (0.9 + l.x + flick * 0.2), l.y, 0);
        (l.m.material as THREE.MeshBasicMaterial).opacity = strength * (0.35 + 0.4 * flick);
      }
    },
  };
}

/** A soft round glow (light pools, lamp halos). */
export function glow(r: number, color: string, opacity = 0.35) {
  const m = shapeMesh(circleShape(r), ownMat(color, opacity, true), 0, 32);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Verse 2 on: ops props

/** Outline-only rounded rect (a frame with a hole), for glass and other see-through things. */
export function frameShape(w: number, h: number, r: number, t: number): THREE.Shape {
  const s = roundedRectShape(w, h, r);
  s.holes.push(roundedRectShape(w - t * 2, h - t * 2, Math.max(0, r - t)));
  return s;
}


export interface BigButton {
  group: THREE.Group;
  /** cover 0 shut .. 1 flipped open; press 0..1 pushes the button in; glow 0..1 lights it up. */
  set(cover: number, press: number, glow?: number): void;
  /** Top of the button in the group's own space, where a paw goes to press it. */
  top: THREE.Vector3;
}

/**
 * The big red button on a pedestal under a flip-up glass cover. DEPLOY in verse 2; the same prop
 * comes back labelled LAUNCH in the bridge. Origin on the floor under its centre; about 1.75 tall.
 */
export function bigButton(text = 'DEPLOY'): BigButton {
  const g = new THREE.Group();
  const plinth = inkedRect(1.15, 0.14, 0.02, '#3c4360', 0.05); plinth.position.y = 0.07;
  const column = inkedRect(0.7, 0.95, 0.02, '#596183', 0.05); column.position.y = 0.6;
  const colShade = shapeMesh(bandShape(0.7, 0.2, 0.02, 0.13), ownMat('#4a5170'), 0.004);
  const plate = staticPlane(0.58, 0.22, 400, (c, W, H) => {
    c.fillStyle = '#20263b'; c.strokeStyle = '#c9ced6'; c.lineWidth = H * 0.06;
    c.beginPath(); c.roundRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1, H * 0.12); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.font = `900 ${H * 0.52}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, W / 2, H * 0.55);
    for (const x of [H * 0.25, W - H * 0.25]) { c.fillStyle = '#9aa1b5'; c.beginPath(); c.arc(x, H / 2, H * 0.07, 0, Math.PI * 2); c.fill(); }
  });
  plate.position.set(0, 0.78, 0.01);
  // housing with hazard stripes
  const housing = inkedRect(1.05, 0.28, 0.02, '#f2c14e', 0.05); housing.position.y = 1.21;
  const stripes = staticPlane(1.05, 0.2, 240, (c, W, H) => {
    c.fillStyle = '#f2c14e'; c.fillRect(0, 0, W, H);
    c.fillStyle = INK;
    for (let x = -H; x < W + H; x += H * 0.9) { c.beginPath(); c.moveTo(x, H); c.lineTo(x + H * 0.45, H); c.lineTo(x + H * 1.2, 0); c.lineTo(x + H * 0.75, 0); c.fill(); }
  });
  stripes.position.set(0, 1.21, 0.006);
  g.add(plinth, column, colShade, plate, housing, stripes);
  // the button: a red dome with a highlight, and a glow behind it when armed
  const halo = glow(0.75, '#ff5a4a', 0.0);
  halo.position.set(0, 1.42, -0.05);
  const btn = new THREE.Group();
  btn.position.y = 1.35;
  const dome = new THREE.Shape();
  dome.absarc(0, 0, 0.3, 0, Math.PI, false); dome.closePath();
  const domeInk = new THREE.Shape();
  domeInk.absarc(0, 0, 0.35, 0, Math.PI, false); domeInk.lineTo(-0.35, -0.04); domeInk.lineTo(0.35, -0.04); domeInk.closePath();
  const btnMat = ownMat('#e0453a');
  btn.add(shapeMesh(domeInk, INK, 0), shapeMesh(dome, btnMat, 0.003));
  const shine = shapeMesh(roundedRectShape(0.16, 0.06, 0.03), ownMat('#ffffff', 0.6, true), 0.006);
  shine.position.set(-0.11, 0.17, 0); shine.rotation.z = 0.5;
  btn.add(shine);
  const collar = inkedRect(0.8, 0.08, 0.02, '#c9ced6', 0.04); collar.position.set(0, 1.37, 0.01);
  g.add(halo, btn, collar);
  // glass cover, hinged along its top edge so it flips up toward the camera
  const hinge = new THREE.Group();
  hinge.position.set(0, 1.92, 0.12);
  const glass = new THREE.Group();
  const pane = shapeMesh(roundedRectShape(0.94, 0.56, 0.03), ownMat('#bfe8ff', 0.32, true), 0.002);
  const rim = shapeMesh(frameShape(1.0, 0.62, 0.05, 0.05), INK, 0.003);
  const streak = shapeMesh(roundedRectShape(0.08, 0.5, 0.04), ownMat('#ffffff', 0.45, true), 0.004);
  streak.rotation.z = -0.6; streak.position.x = -0.2;
  glass.add(pane, rim, streak);
  glass.position.y = -0.31;
  hinge.add(glass);
  const hingePin = inkedRect(0.9, 0.06, 0.02, '#9aa1b5', 0.03); hingePin.position.set(0, 1.93, 0.1);
  g.add(hinge, hingePin);
  return {
    group: g,
    top: new THREE.Vector3(0, 1.62, 0.15),
    set(cover, press, glowK = 0) {
      hinge.rotation.x = -easeOutCubic(clamp(cover)) * 2.75;
      const p = clamp(press);
      btn.position.y = 1.35 - p * 0.07;
      btn.scale.set(1 + p * 0.12, 1 - p * 0.35, 1);
      btnMat.color.set('#e0453a').lerp(new THREE.Color('#ff8a6a'), clamp(glowK) * 0.6 + p * 0.3);
      (halo.material as THREE.MeshBasicMaterial).opacity = clamp(glowK) * 0.45;
      halo.visible = glowK > 0.01;
    },
  };
}

/** A key ring with four keys. Origin at the clip at the top of the ring. */
export function keyRing(scale = 1) {
  const g = new THREE.Group();
  const swing = new THREE.Group();
  g.add(swing);
  const ringO = new THREE.Shape(); ringO.absarc(0, 0, 0.17, 0, Math.PI * 2, false);
  ringO.holes.push(new THREE.Path().absarc(0, 0, 0.1, 0, Math.PI * 2, true));
  const ringI = new THREE.Shape(); ringI.absarc(0, 0, 0.145, 0, Math.PI * 2, false);
  ringI.holes.push(new THREE.Path().absarc(0, 0, 0.125, 0, Math.PI * 2, true));
  const ring = new THREE.Group();
  ring.add(shapeMesh(ringO, INK, 0, 24), shapeMesh(ringI, '#d9dde4', 0.003, 24));
  ring.position.y = -0.17;
  const clip = inkedRect(0.08, 0.16, 0.03, '#9aa1b5', 0.03); clip.position.y = -0.02;
  swing.add(clip, ring);
  const cols = ['#e0b84a', '#c9ced6', '#5b9bd5', '#e0504a'];
  const keys = cols.map((col, i) => {
    const k = new THREE.Group();
    const bow = inkedCircle(0.1, col, 0.035); bow.position.y = -0.1;
    const hole = inkedCircle(0.03, '#20263b', 0.0); hole.position.set(0, -0.06, 0.006);
    const shaft = inkedRect(0.07, 0.42, 0.01, i === 2 || i === 3 ? '#c9ced6' : col, 0.03); shaft.position.set(0, -0.38, -0.004);
    const t1 = inkedRect(0.09, 0.06, 0.005, i === 2 || i === 3 ? '#c9ced6' : col, 0.025); t1.position.set(0.07, -0.5, -0.006);
    const t2 = inkedRect(0.07, 0.05, 0.005, i === 2 || i === 3 ? '#c9ced6' : col, 0.025); t2.position.set(0.06, -0.58, -0.006);
    k.add(shaft, t1, t2, bow, hole);
    k.position.set(0, -0.3, 0.01 + i * 0.004);
    k.rotation.z = (i - 1.5) * 0.35;
    swing.add(k);
    return k;
  });
  g.scale.setScalar(scale);
  return Object.assign(g, {
    /** Swing the ring by angle (radians); the keys fan a little with it. */
    swingTo(a: number, t: number) {
      swing.rotation.z = a;
      keys.forEach((k, i) => { k.rotation.z = (i - 1.5) * 0.35 + a * 0.4 + Math.sin(t * 5 + i) * 0.02; });
    },
  });
}

export type PopupKind = 'warn' | 'fail' | 'fixed';
/** A UI pop-up window (warning, failure, fixed). A plane w wide, w * 0.64 tall. */
export function popup(kind: PopupKind, seed = 0, w = 1.0) {
  const bar = kind === 'warn' ? '#f2c14e' : kind === 'fail' ? '#e0504a' : DONE_GREEN;
  return staticPlane(w, w * 0.64, 320, (c, W, H) => {
    const s = H * 0.05;
    c.fillStyle = 'rgba(16,20,36,0.35)'; c.beginPath(); c.roundRect(s * 1.6, s * 1.6, W - s * 2.2, H - s * 2.2, H * 0.06); c.fill();
    c.fillStyle = '#fbf7f0'; c.strokeStyle = INK; c.lineWidth = s * 0.8;
    c.beginPath(); c.roundRect(s, s, W - s * 2.4, H - s * 2.4, H * 0.06); c.fill(); c.stroke();
    c.fillStyle = bar; c.beginPath(); c.roundRect(s, s, W - s * 2.4, H * 0.22, [H * 0.06, H * 0.06, 0, 0]); c.fill(); c.stroke();
    c.fillStyle = INK; c.font = `900 ${H * 0.13}px ${FONT}`; c.textBaseline = 'middle';
    c.fillText(kind === 'warn' ? 'Warning' : kind === 'fail' ? 'Failed' : 'Fixed', s * 3, s + H * 0.115);
    // close box
    c.lineWidth = s * 0.5; const bx = W - s * 2.4 - H * 0.12, by = s + H * 0.11;
    c.beginPath(); c.moveTo(bx - H * 0.04, by - H * 0.04); c.lineTo(bx + H * 0.04, by + H * 0.04); c.moveTo(bx + H * 0.04, by - H * 0.04); c.lineTo(bx - H * 0.04, by + H * 0.04); c.stroke();
    // icon
    const ix = s + H * 0.2, iy = H * 0.52, r = H * 0.13;
    c.fillStyle = bar; c.lineWidth = s * 0.6;
    if (kind === 'warn') { c.beginPath(); c.moveTo(ix, iy - r * 1.1); c.lineTo(ix + r * 1.15, iy + r * 0.85); c.lineTo(ix - r * 1.15, iy + r * 0.85); c.closePath(); c.fill(); c.stroke(); }
    else { c.beginPath(); c.arc(ix, iy, r, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.fillStyle = INK; c.font = `900 ${r * 1.4}px ${FONT}`; c.textAlign = 'center';
    c.fillText(kind === 'warn' ? '!' : kind === 'fail' ? '✕' : '✓', ix, iy + (kind === 'warn' ? r * 0.15 : 0));
    c.textAlign = 'left';
    // squiggle text lines
    c.fillStyle = 'rgba(43,29,22,0.45)';
    for (let i = 0; i < 3; i++) c.fillRect(s + H * 0.42, H * (0.4 + i * 0.1), (W - H * 0.6) * (0.55 + hash(seed, i, 7) * 0.4), H * 0.04);
    // OK button
    c.fillStyle = '#e9dfd0'; c.strokeStyle = INK; c.lineWidth = s * 0.5;
    c.beginPath(); c.roundRect(W - s * 2.4 - H * 0.42, H * 0.7, H * 0.36, H * 0.14, H * 0.03); c.fill(); c.stroke();
    c.fillStyle = INK; c.font = `800 ${H * 0.09}px ${FONT}`; c.textAlign = 'center';
    c.fillText('OK', W - s * 2.4 - H * 0.24, H * 0.775);
  });
}

/** The tiny red "!" alert badge that gets flicked away and keeps blinking. Origin at its centre. */
export function tinyAlert(r = 0.16) {
  const g = new THREE.Group();
  const fillMat = ownMat('#e0453a');
  const halo = glow(r * 2.6, '#ff5a4a', 0.0);
  halo.position.z = -0.01;
  const disc = inkedCircle(r, fillMat, r * 0.22);
  const mark = staticPlane(r * 2, r * 2, 400, (c, W, H) => {
    c.fillStyle = '#ffffff'; c.font = `900 ${H * 0.72}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('!', W / 2, H * 0.53);
  });
  mark.position.z = 0.006;
  g.add(halo, disc, mark);
  return Object.assign(g, {
    /** on 0..1: dim to bright red, with a soft glow when bright. */
    blink(on: number) {
      fillMat.color.set('#7a2a26').lerp(new THREE.Color('#ff4a3d'), clamp(on));
      (halo.material as THREE.MeshBasicMaterial).opacity = clamp(on) * 0.3;
    },
  });
}

/** A coffee mug with steam. Origin at the bottom of the mug. update(t) moves the steam. */
export function coffeeMug(color = '#d97757', scale = 1) {
  const g = new THREE.Group();
  const body = inkedRect(0.36, 0.42, 0.04, color, 0.04); body.position.y = 0.21;
  const handle = new THREE.Shape(); handle.absarc(0, 0, 0.12, -Math.PI / 2, Math.PI / 2, false); handle.lineTo(0, 0.07); handle.absarc(0, 0, 0.07, Math.PI / 2, -Math.PI / 2, true); handle.closePath();
  const hInk = new THREE.Shape(); hInk.absarc(0, 0, 0.155, -Math.PI / 2, Math.PI / 2, false); hInk.lineTo(0, 0.04); hInk.absarc(0, 0, 0.04, Math.PI / 2, -Math.PI / 2, true); hInk.closePath();
  const h = new THREE.Group(); h.add(shapeMesh(hInk, INK, 0), shapeMesh(handle, color, 0.002)); h.position.set(0.18, 0.22, -0.01);
  const band = shapeMesh(roundedRectShape(0.36, 0.06, 0), ownMat('#ffffff', 0.85), 0.004); band.position.y = 0.3;
  g.add(h, body, band);
  const steam = [0, 1, 2].map(i => { const s = shapeMesh(circleShape(0.06), ownMat('#ffffff', 0.5, true), 0); g.add(s); return { s, i }; });
  g.scale.setScalar(scale);
  return Object.assign(g, {
    update(t: number) {
      for (const { s, i } of steam) {
        const k = (t * 0.6 + i / 3) % 1;
        s.position.set(Math.sin(t * 2 + i * 2) * 0.05 + (i - 1) * 0.06, 0.5 + k * 0.5, 0.01);
        s.scale.setScalar(0.6 + k * 0.8);
        (s.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.sin(k * Math.PI);
      }
    },
  });
}

/** A sticking plaster. Centred, 0.8 x 0.26. */
export function bandAid() {
  const g = new THREE.Group();
  g.add(inkedRect(0.8, 0.26, 0.12, '#f0c39c', 0.035));
  const pad = shapeMesh(roundedRectShape(0.26, 0.2, 0.03), ownMat('#e3a882'), 0.004);
  g.add(pad);
  for (let i = 0; i < 6; i++) { const d = shapeMesh(circleShape(0.012), ownMat('#c98d6a'), 0.006); d.position.set(i < 3 ? -0.26 - (i % 3) * 0.06 + 0.06 : 0.2 + (i % 3) * 0.06, (i % 2 ? 0.04 : -0.04), 0); g.add(d); }
  return g;
}

/** A stopwatch. Origin at the centre of its face. update(t) spins the hand. */
export function stopwatch(r = 0.4) {
  const g = new THREE.Group();
  const crown = inkedRect(r * 0.3, r * 0.25, 0.02, '#c9ced6', 0.035); crown.position.y = r * 1.12;
  const knob = inkedRect(r * 0.5, r * 0.14, 0.02, '#c9ced6', 0.035); knob.position.y = r * 1.28;
  const face = inkedCircle(r, '#ffffff', r * 0.12);
  const rimIn = shapeMesh(arcShapeFull(r * 0.86, r * 0.05), ownMat('#e0453a'), 0.004);
  g.add(crown, knob, face, rimIn);
  for (let i = 0; i < 12; i++) {
    const tick = shapeMesh(roundedRectShape(r * 0.05, i % 3 ? r * 0.1 : r * 0.18, 0), INK, 0.005);
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * r * 0.7, Math.cos(a) * r * 0.7, 0); tick.rotation.z = -a;
    g.add(tick);
  }
  const hand = new THREE.Group();
  hand.add(shapeMesh(roundedRectShape(r * 0.06, r * 0.7, r * 0.03, 0, r * 0.3), '#e0453a', 0.007));
  const pin = inkedCircle(r * 0.08, INK, 0); pin.position.z = 0.008;
  g.add(hand, pin);
  return Object.assign(g, { spin(a: number) { hand.rotation.z = -a; } });
}
function arcShapeFull(r: number, t: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, r + t / 2, 0, Math.PI * 2, false);
  s.holes.push(new THREE.Path().absarc(0, 0, r - t / 2, 0, Math.PI * 2, true));
  return s;
}

/** An idea lightbulb with rays. Origin at the centre of the bulb. on(0..1) pops it in. */
export function lightbulb(r = 0.32) {
  const g = new THREE.Group();
  const bulb = inkedCircle(r, '#ffe27a', r * 0.15);
  const neck = inkedRect(r * 0.8, r * 0.5, 0.02, '#c9ced6', r * 0.12); neck.position.set(0, -r * 1.05, -0.004);
  const thread = shapeMesh(roundedRectShape(r * 0.8, r * 0.06, 0), INK, 0.003); thread.position.set(0, -r * 1.05, 0);
  const shine = shapeMesh(roundedRectShape(r * 0.18, r * 0.45, r * 0.09), ownMat('#ffffff', 0.7, true), 0.006); shine.position.set(-r * 0.4, r * 0.2, 0); shine.rotation.z = 0.4;
  const rays = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.05 + i / 6 * 0.9);
    const ray = shapeMesh(roundedRectShape(r * 0.12, r * 0.45, r * 0.06), '#ffd166', 0);
    ray.position.set(Math.cos(a) * r * 1.65, Math.sin(a) * r * 1.65, -0.002); ray.rotation.z = a - Math.PI / 2;
    rays.add(ray);
  }
  g.add(rays, neck, thread, bulb, shine);
  return Object.assign(g, {
    on(k: number, t: number) {
      g.visible = k > 0.001;
      g.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      rays.scale.setScalar(1 + Math.sin(t * 12) * 0.06);
    },
  });
}
