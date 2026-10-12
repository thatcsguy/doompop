// Intro and verse 1 (0:00 to the pre-chorus): life inside the chat window, warm daylight.
// Storyboard rows 0 to 8. Each shot starts on the beat nearest its line's sung start, and every
// action inside a shot is keyed to the sung time of a word (f.clock.w(line, word)).
import * as THREE from 'three';
import { defineShot, type Frame, type Shot, type ShotWorld } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { MOODS, REST, mixMood, type Pose } from '../../../engine/characters/clawd';
import { INK, canvasPlane, inkedRect, ownMat, shapeMesh, roundedRectShape, staticPlane } from '../../../engine/flat';
import { hash } from '../../../engine/rng';
import { clamp, decay, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth, unlerp } from '../../../engine/ease';
import { BUBBLE, DAY_LYRICS, FONT, FIELD, FLAT_POST, FLOOR_Y, PAL, beatHop, buildDesk, frameCam, hop, label, wordBlock, type DeskSet } from '../world';

type Update = (f: Frame) => void;
interface Extra { overlay?: ShotWorld['overlay']; lyrics?: boolean }

/** A shot on the desk set: setup() adds its props and returns the per-frame update. */
function deskShot(id: string, start: number, end: number, setup: (s: DeskSet) => Update, extra: Extra = {}): Shot {
  return defineShot({
    id, start, end,
    build() {
      const s = buildDesk();
      const update = setup(s);
      return {
        scene: s.scene, camera: s.camera,
        update(f) { s.reset(f); update(f); },
        overlay: extra.overlay,
        post: () => FLAT_POST,
        lyrics: extra.lyrics,
        lyricStyle: DAY_LYRICS,
      };
    },
  });
}

const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const LETTER_COLS = ['#ffd166', '#8fd6a0', '#9fc7f2', '#f2a09a', '#c9a7eb'];

/** The open house drawing that the tangle becomes (shot 6), as a polyline in local units. */
const HOUSE: [number, number][] = [[1.7, -1.3], [-1.7, -1.3], [-1.7, 0.25], [0, 1.45], [1.7, 0.25], [1.7, -1.3], [2.9, -1.3]];
function resample(pts: [number, number][], n: number): [number, number][] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / (n - 1)) * total, i = 0;
    while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
    const u = seg[i] ? d / seg[i] : 0;
    out.push([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]);
  }
  return out;
}
const N_THREAD = 220;
const HOUSE_PTS = resample(HOUSE, N_THREAD);
const TANGLE_PTS: [number, number][] = HOUSE_PTS.map((_, i) => {
  const s = (i / (N_THREAD - 1)) * Math.PI * 2 * 1.6;
  const x = (Math.sin(7.3 * s) + 0.6 * Math.sin(13.1 * s + 1)) / 1.6;
  const y = (Math.cos(5.7 * s) + 0.6 * Math.cos(11.3 * s + 2)) / 1.6;
  return [x * 0.95, y * 0.95 - 0.35];
});

function drawThread(g: CanvasRenderingContext2D, W: number, H: number, pw: number, ph: number, k: number, hand: [number, number]) {
  const u = W / pw, X = (x: number) => (x + pw / 2) * u, Y = (y: number) => (ph / 2 - y) * u;
  g.lineWidth = 0.09 * u; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK;
  g.beginPath();
  for (let i = 0; i < N_THREAD; i++) {
    // the end nearest Clawd's paw unravels first
    const ki = smooth(clamp(k * 1.6 - (1 - i / (N_THREAD - 1)) * 0.6));
    const x = lerp(TANGLE_PTS[i][0], HOUSE_PTS[i][0], ki), y = lerp(TANGLE_PTS[i][1], HOUSE_PTS[i][1], ki);
    if (i === 0) g.moveTo(X(x), Y(y)); else g.lineTo(X(x), Y(y));
  }
  g.lineTo(X(hand[0]), Y(hand[1]));
  g.stroke();
}

export function verse1Shots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const L = (n: number) => lyrics.lines[n - 1];
  const W = (n: number, i: number) => L(n).words[i].start;
  const nearestBeat = (t: number) => audio.beats.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
  // cut points: line 1 cuts right on "They" (no beat grid yet), the rest on the nearest beat
  const cut = [0, L(1).start - 0.03, ...[2, 3, 4, 5, 6, 7, 8, 9].map(n => nearestBeat(L(n).start))];

  // 0. Intro: a chat window fades up, "begin" types itself and is sent.
  const typeStart = 6.0, enterAt = 9.2;
  const keyTimes = [...'begin'].map((_, i) => typeStart + i * 0.3 + hash(i, 77) * 0.12);
  const s0 = deskShot('v1-intro', cut[0], cut[1], s => {
    const glow = inkedRect(14, 1.6, 0.05, '#ffffff', 0.0);
    glow.visible = false;
    s.screen.add(glow);
    return f => {
      const typedN = keyTimes.filter(k => f.t >= k).length;
      const sent = f.t >= enterAt;
      const blink = Math.floor(f.t / 0.53) % 2 === 0;
      s.setTyped(sent ? '' : 'begin'.slice(0, typedN), sent ? blink : blink || (typedN > 0 && f.t - keyTimes[typedN - 1] < 0.3), true);
      // the message flies from the field up to its place in the chat
      const fly = easeOutBack(unlerp(f.t, enterAt, enterAt + 0.45));
      s.bubble.visible = sent;
      s.bubble.position.set(lerp(-4.6, BUBBLE.x, easeOutCubic(unlerp(f.t, enterAt, enterAt + 0.3))), lerp(FIELD.y, BUBBLE.y, fly), 0.1);
      s.bubble.scale.setScalar(lerp(0.4, 1, fly));
      s.field.scale.setScalar(1 + 0.03 * decay(f.t - enterAt, 0.12));
      s.clawd.root.visible = false;
      const k = easeInOutCubic(unlerp(f.t, 0.5, f.dur));
      frameCam(s.camera, 0, lerp(0, -1.2, k), lerp(10.4, 8.4, k));
    };
  }, {
    overlay(g, f) { // fade up from black
      const a = 1 - smooth(unlerp(f.t, 0.4, 3.2));
      if (a <= 0) return;
      g.fillStyle = `rgba(0,0,0,${a})`;
      g.fillRect(0, 0, f.w, f.h);
    },
  });

  // 1. "They gave me words": Clawd pops out of the chat box; the letters of WORDS rain onto his head.
  const t1 = L(1).start;
  const s1 = deskShot('v1-pop', cut[1], cut[2], s => {
    const tiles = [...'WORDS'].map((ch, i) => {
      const b = wordBlock(ch, LETTER_COLS[i], 0.5, 0.5);
      s.screen.add(b);
      return b;
    });
    return f => {
      s.bubble.visible = true;
      const kPop = unlerp(f.t, t1, t1 + 0.55);
      const y = lerp(FIELD.y - 1.6, FLOOR_Y, kPop) + Math.sin(kPop * Math.PI) * 1.5;
      const land = decay(f.t - (t1 + 0.55), 0.09);
      s.clawd.root.position.set(0, y, 0.2);
      const tWords = W(1, 3);
      const caught = unlerp(f.t, tWords - 0.1, tWords + 0.1);
      const bounce = f.t > t1 + 0.9 ? beatHop(f.clock, f.t) * 0.35 : 0;
      // letters: free fall from above, each stacking on the one below
      let hits = 0;
      tiles.forEach((b, i) => {
        const t0 = tWords + i * 0.11 - 0.35, restY = FLOOR_Y + 1.06 + bounce * 0.35 + i * 0.56;
        const fall = Math.max(0, f.t - t0);
        const yFree = FLOOR_Y + 6 - 0.5 * 32 * fall * fall;
        const landed = yFree <= restY;
        if (landed) hits += decay(f.t - (t0 + Math.sqrt((FLOOR_Y + 6 - restY) * 2 / 32)), 0.08);
        const wob = f.t > W(1, 6) ? Math.sin((f.t - W(1, 6)) * 9) * 0.06 * (i + 1) * decay(f.t - W(1, 6), 0.6) : 0;
        b.position.set((hash(i, 5) - 0.5) * 0.14 + wob * (i * 0.3), landed ? restY : yFree, 0.25);
        b.rotation.z = (hash(i, 6) - 0.5) * 0.18 + wob * 0.5;
        b.visible = f.t > t0;
      });
      s.clawd.setMood(MOODS.excited, f.t);
      s.clawd.setPose(pose({
        bounce, squash: land * 0.7 + hits * 0.35 - (kPop > 0 && kPop < 1 ? 0.4 : 0),
        armL: 0.3 + caught * 1.4 + bounce * 0.3, armR: 0.3 + caught * 1.4 + bounce * 0.3,
        lean: f.t < tWords ? Math.sin((f.t - t1) * 7) * 0.12 * unlerp(f.t, t1 + 0.5, t1 + 0.7) : 0,
      }));
      frameCam(s.camera, 0, -1.55, 5.4 + 0.25 * f.p);
    };
  });

  // 2. "A little box to type them in": he hops into a tiny text box, wiggles to fit, peeks out.
  const s2 = deskShot('v1-box', cut[2], cut[3], s => {
    const bx = 1.3, bw = 1.55, bh = 0.78;
    const backPanel = inkedRect(bw, bh * 1.15, 0.02, '#e9dfd0', 0.05);
    backPanel.position.set(bx, FLOOR_Y + bh * 0.58, 0.1);
    const front = inkedRect(bw, bh, 0.02, '#ffffff', 0.06);
    front.position.set(bx, FLOOR_Y + bh / 2, 0.32);
    const cursor = shapeMesh(roundedRectShape(0.045, bh * 0.55, 0), INK, 0.34);
    cursor.position.set(bx - bw / 2 + 0.2, FLOOR_Y + bh / 2, 0);
    s.screen.add(backPanel, front, cursor);
    [...'WORDS'].forEach((ch, i) => {
      const b = wordBlock(ch, LETTER_COLS[i], 0.5, 0.5);
      b.position.set(-4.4 + i * 0.62 + hash(i, 8) * 0.1, FLOOR_Y, 0.25);
      b.rotation.z = (hash(i, 9) - 0.5) * 0.3;
      s.screen.add(b);
    });
    return f => {
      const tBox = W(2, 2), tIn = W(2, 6);
      const h = hop(f.t, tBox, tBox + 0.5, -1.6, bx, 1.4);
      const inBox = f.t >= tBox + 0.5;
      const squeeze = unlerp(f.t, tBox + 0.5, tIn - 0.05);                       // sinking in while wiggling
      const peek = easeOutBack(unlerp(f.t, tIn, tIn + 0.3));
      const sink = inBox ? lerp(0.45, 0.02, smooth(squeeze)) + peek * 0.3 : 0;
      s.clawd.root.position.set(h.x, FLOOR_Y + (inBox ? sink : h.y), 0.2);
      const wiggle = inBox && f.t < tIn ? Math.sin((f.t - tBox) * 34) * 0.1 : 0;
      const land = decay(f.t - (tBox + 0.5), 0.1);
      cursor.visible = Math.floor(f.t / 0.4) % 2 === 0;
      s.clawd.setMood(inBox && f.t < tIn ? mixMood(MOODS.excited, MOODS.focused, 0.6) : MOODS.excited, f.t);
      s.clawd.setPose(pose({
        bounce: !inBox && f.t < tBox ? beatHop(f.clock, f.t) * 0.3 : 0,
        squash: inBox ? 0.6 * land + (f.t < tIn ? -0.25 * squeeze : 0) : (h.k > 0 ? -0.3 : 0),
        lean: wiggle + (peek > 0 ? Math.sin((f.t - tIn) * 5) * 0.1 : 0),
        armL: inBox ? 1.2 + wiggle * 4 : 0.4, armR: inBox ? 1.2 - wiggle * 4 : 0.4,
      }));
      frameCam(s.camera, 0.2 + f.p * 0.4, -1.75, 4.8 - f.p * 0.4);
    };
  });

  // 3. "I learned the shape of yes and no": YES and NO blocks drop in; he tries sitting on each.
  const s3 = deskShot('v1-yesno', cut[3], cut[4], s => {
    const yes = wordBlock('YES', PAL.yes, 2.2, 1.0), no = wordBlock('NO', PAL.no, 1.8, 1.0);
    s.screen.add(yes, no);
    const qm = label('?', 0.8, 0.8, { size: 0.7 });
    s.screen.add(qm);
    return f => {
      const tYes = W(3, 5), tNo = W(3, 7);
      const drop = (b: THREE.Group, x: number, tLand: number) => {
        const dt = f.t - tLand, fall = 0.4;
        const y = dt < 0 ? FLOOR_Y + 4.8 * Math.pow(clamp(-dt / fall), 2) + (dt < -fall ? 99 : 0)
          : FLOOR_Y + Math.abs(Math.sin(dt * 9)) * 0.25 * decay(dt, 0.15);
        b.position.set(x, y, 0.15);
        b.scale.set(1 + 0.15 * decay(dt, 0.08), 1 - 0.15 * decay(dt, 0.08), 1);
      };
      drop(yes, -2.6, tYes);
      drop(no, 2.6, tNo);
      // he stands centre looking up, hops onto YES, then over to NO
      let x = 0, y = 0, land = 0;
      const toYes = hop(f.t, tYes + 0.05, tYes + 0.35, 0, -2.6, 1.6);
      const toNo = hop(f.t, tNo + 0.08, tNo + 0.42, -2.6, 2.6, 0.9);
      if (f.t >= tNo + 0.08) { x = toNo.x; y = 1.0 + toNo.y; land = decay(f.t - (tNo + 0.42), 0.09); }
      else if (f.t >= tYes + 0.05) { x = toYes.x; y = lerp(0, 1.0, toYes.k) + toYes.y; land = decay(f.t - (tYes + 0.35), 0.09); }
      s.clawd.root.position.set(x, FLOOR_Y + y, 0.25);
      const onNo = f.t >= tNo + 0.42, onYes = f.t >= tYes + 0.35 && !onNo && f.t < tNo + 0.08;
      qm.visible = f.t < tYes;
      qm.position.set(0.7, FLOOR_Y + 1.6 + Math.sin(f.t * 4) * 0.06, 0.3);
      qm.scale.setScalar(easeOutBack(unlerp(f.t, W(3, 3), W(3, 3) + 0.25)) + 0.001);
      const mood = onNo ? { ...MOODS.focused, squint: 0.2, brow: 0.7, open: 1.15 } : onYes ? MOODS.proud : MOODS.excited;
      s.clawd.setMood(mood, f.t);
      s.clawd.setPose(pose({
        bounce: onYes ? beatHop(f.clock, f.t) * 0.25 : 0,
        squash: (onYes || onNo ? 0.35 : 0) + land * 0.5,
        lean: f.t < tYes ? -0.12 : onNo ? 0.1 : 0,
        armL: onYes ? 1.6 : 0.3, armR: onYes ? 1.6 : onNo ? 0.2 : 0.3,
      }));
      frameCam(s.camera, 0, -1.25, 5.6);
    };
  });

  // 4. "The gentle ways a sentence flows": a ribbon of words streams past and he surfs it.
  const RIBBON = 'the gentle ways a sentence flows and then it flows a little more like this and so on'.split(' ');
  const s4 = deskShot('v1-surf', cut[4], cut[5], s => {
    const tiles = Array.from({ length: 34 }, (_, i) => {
      const word = RIBBON[i % RIBBON.length];
      const g = new THREE.Group();
      g.add(inkedRect(1.3, 0.48, 0.03, i % 2 ? '#ffffff' : '#fff3df', 0.05));
      const t = label(word, 1.3, 0.48, { size: 0.24, weight: 700 });
      t.position.z = 0.01;
      g.add(t);
      s.screen.add(g);
      return g;
    });
    const speed = 3.6, gap = 1.36;
    const wave = (x: number, t: number) => FLOOR_Y + 1.15 + 0.55 * Math.sin(0.75 * x - 2.6 * t);
    return f => {
      const head = 9 - speed * (f.t - f.clock.w(4, 0) + 2.6); // the ribbon's leading edge
      tiles.forEach((g, i) => {
        const x = head + i * gap;
        const y = wave(x, f.t);
        const slope = Math.atan(0.55 * 0.75 * Math.cos(0.75 * x - 2.6 * f.t));
        g.position.set(x, y, 0.15 + i * 0.001);
        g.rotation.z = slope;
        g.visible = x > -9 && x < 9;
      });
      const cx = 0.3;
      const y = wave(cx, f.t) + 0.24;
      const slope = Math.atan(0.55 * 0.75 * Math.cos(0.75 * cx - 2.6 * f.t));
      s.clawd.root.position.set(cx, y, 0.3);
      s.clawd.root.rotation.z = slope * 0.8;
      s.clawd.setMood(MOODS.excited, f.t);
      const flows = W(4, 5);
      const whee = decay(f.t - flows, 0.4);
      s.clawd.setPose(pose({ squash: -0.1 + 0.25 * Math.sin(f.t * 5.2), armL: 1.0 + whee * 1.2 + Math.sin(f.t * 3) * 0.2, armR: 0.6 + whee * 1.2, lean: -0.08 }));
      frameCam(s.camera, 0.2, -1.05, 5.8);
    };
  });

  // 5. "I fixed your notes, I changed your tone": crooked sticky notes; one tap each straightens them.
  const s5 = deskShot('v1-notes', cut[5], cut[6], s => {
    const xs = [-2.4, 0, 2.4];
    const notes = xs.map((x, i) => {
      const g = new THREE.Group();
      g.add(inkedRect(1.5, 1.5, 0.02, PAL.sticky, 0.05));
      const fold = shapeMesh(roundedRectShape(1.5, 0.22, 0, 0, 0.64), ownMat('#f5cf55'), 0.004);
      const scribble = staticPlane(1.5, 1.5, 120, (c, Wd, Hd) => {
        c.strokeStyle = PAL.red; c.lineWidth = Wd * 0.03; c.lineCap = 'round';
        for (let r = 0; r < 4; r++) {
          c.beginPath();
          const y0 = Hd * (0.3 + r * 0.16);
          c.moveTo(Wd * 0.15, y0);
          for (let k = 1; k <= 8; k++) c.lineTo(Wd * (0.15 + k * 0.088), y0 + (hash(i, r, k) - 0.5) * Hd * 0.13);
          c.stroke();
        }
        c.beginPath(); c.moveTo(Wd * 0.2, Hd * 0.25); c.lineTo(Wd * 0.8, Hd * 0.85); c.stroke();
      });
      const neat = staticPlane(1.5, 1.5, 120, (c, Wd, Hd) => {
        c.strokeStyle = PAL.green; c.lineWidth = Wd * 0.028; c.lineCap = 'round';
        for (let r = 0; r < 3; r++) {
          c.beginPath(); c.moveTo(Wd * 0.16, Hd * (0.32 + r * 0.17)); c.lineTo(Wd * (0.6 + hash(i, r) * 0.24), Hd * (0.32 + r * 0.17)); c.stroke();
        }
        c.lineWidth = Wd * 0.05; c.beginPath();
        c.moveTo(Wd * 0.62, Hd * 0.8); c.lineTo(Wd * 0.7, Hd * 0.88); c.lineTo(Wd * 0.86, Hd * 0.7); c.stroke();
      });
      scribble.position.z = 0.01; neat.position.z = 0.01;
      g.add(fold, scribble, neat);
      s.screen.add(g);
      return { g, scribble, neat, x, tilt: (hash(i, 3) - 0.5) * 0.7 + (i % 2 ? 0.25 : -0.25) };
    });
    const sparks = xs.map(() => {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const r = shapeMesh(roundedRectShape(0.08, 0.3, 0), INK, 0);
        r.rotation.z = (k / 6) * Math.PI * 2;
        g.add(r);
      }
      s.screen.add(g);
      return g;
    });
    const taps = [W(5, 3), W(5, 5), W(5, 7)];
    return f => {
      notes.forEach((n, i) => {
        const tIn = f.clock.lineStart(5) + 0.2 + i * 0.08;
        const k = easeOutCubic(unlerp(f.t, tIn - 0.3, tIn + 0.15));
        const fixed = easeOutBack(unlerp(f.t, taps[i], taps[i] + 0.25), 3);
        n.g.position.set(n.x + (1 - k) * (i - 1) * 6, FLOOR_Y + 2.55 + (1 - k) * 5 + (1 - fixed) * (hash(i, 4) - 0.5) * 0.4, 0.12);
        n.g.rotation.z = n.tilt * (1 - fixed) + (1 - k) * 1.2;
        n.scribble.visible = f.t < taps[i];
        n.neat.visible = f.t >= taps[i];
        const sp = unlerp(f.t, taps[i], taps[i] + 0.25);
        sparks[i].visible = sp > 0 && sp < 1;
        sparks[i].position.set(n.x, FLOOR_Y + 2.55, 0.2);
        sparks[i].children.forEach((r, k2) => {
          const a = (k2 / 6) * Math.PI * 2 + 0.3;
          r.position.set(Math.cos(a + Math.PI / 2) * (0.9 + sp * 0.5), Math.sin(a + Math.PI / 2) * (0.9 + sp * 0.5), 0);
          r.scale.setScalar(1 - sp);
        });
      });
      // he hops under each note and jumps to tap it
      let x = notes[0].x, jump = 0;
      for (let i = 0; i < 3; i++) {
        if (i > 0) {
          const h = hop(f.t, taps[i - 1] + 0.22, taps[i] - 0.18, notes[i - 1].x, notes[i].x, 0.6);
          if (f.t >= taps[i - 1] + 0.22) { x = h.x; jump = h.y; }
        }
        const tj = Math.abs(f.t - taps[i]);
        if (tj < 0.18) jump = Math.cos((tj / 0.18) * Math.PI / 2) * 0.55;
      }
      s.clawd.root.position.set(x - 0.35, FLOOR_Y + jump, 0.2);
      const reach = Math.max(...taps.map(tp => decay(Math.abs(f.t - tp) - 0.05, 0.12)));
      s.clawd.setMood(f.t > taps[0] ? MOODS.proud : MOODS.excited, f.t);
      s.clawd.setPose(pose({ armR: 0.3 + reach * 2.2, armL: 0.3, squash: jump > 0 ? -0.25 : 0.1 * beatHop(f.clock, f.t), lean: 0.05 - reach * 0.1 }));
      frameCam(s.camera, 0, -0.85, 6.2);
    };
  });

  // 6. "Made awkward thoughts feel more like home": he pulls a thread and the tangle becomes a house.
  const s6 = deskShot('v1-home', cut[6], cut[7], s => {
    const pw = 7.2, ph = 3.8, px = -1.2, py = FLOOR_Y + 1.5;
    let thread = { k: 0, hand: [3, -1.3] as [number, number] };
    const plane = canvasPlane(pw, ph, 110, (g, _f: null, Wd, Hd) => drawThread(g, Wd, Hd, pw, ph, thread.k, thread.hand));
    plane.mesh.position.set(px, py, 0.12);
    s.screen.add(plane.mesh);
    const win = inkedRect(0.9, 0.9, 0.02, '#ffd166', 0.07);
    s.screen.add(win);
    const glow = shapeMesh(roundedRectShape(1.6, 1.6, 0.3), ownMat('#ffd166', 0.35, true), 0);
    s.screen.add(glow);
    return f => {
      const tPull = W(6, 1), tHome = W(6, 6);
      const k = smooth(unlerp(f.t, tPull, tHome - 0.1));
      const tug = Math.max(0, Math.sin(Math.max(0, f.clock.beat(f.t)) * Math.PI * 2)) * (f.t > tPull && f.t < tHome ? 1 : 0);
      const cx = lerp(1.9, 3.2, k) + tug * 0.08;
      s.clawd.root.position.set(cx, FLOOR_Y, 0.2);
      const hand: [number, number] = [cx - 0.95 - px, FLOOR_Y + 0.68 - py];
      thread = { k, hand };
      plane.update(null);
      const lit = easeOutBack(unlerp(f.t, tHome, tHome + 0.3));
      win.visible = lit > 0.01;
      win.scale.setScalar(Math.max(0.01, lit));
      win.position.set(px, py - 0.35, 0.14);
      glow.visible = lit > 0.01;
      glow.position.set(px, py - 0.35, 0.11);
      glow.scale.setScalar(Math.max(0.01, lit) * (1 + 0.08 * Math.sin(f.t * 6)));
      const home = f.t >= tHome;
      s.clawd.setMood(home ? MOODS.proud : mixMood(MOODS.focused, MOODS.excited, f.t < tPull ? 0.6 : 0), f.t);
      s.clawd.setPose(pose({
        armL: home ? 1.8 : 0.55 + tug * 0.2, armR: home ? 1.8 : 0.2,
        lean: home ? 0 : -0.18 * (f.t > tPull ? 1 : 0) - tug * 0.12,
        walk: f.t > tPull && !home ? (f.t - tPull) * 1.6 : 0,
        bounce: home ? beatHop(f.clock, f.t) * 0.4 : 0,
      }));
      frameCam(s.camera, 0.6, -0.85, 6.2);
    };
  });

  // 7. "You smiled and said I did it well": pull back to the desk; a person gives a thumbs-up and
  //    a smiley sun rises behind the monitor. Clawd blushes.
  const s7 = deskShot('v1-desk', cut[7], cut[8], s => {
    const house = staticPlane(7.2, 3.8, 90, (g, Wd, Hd) => drawThread(g, Wd, Hd, 7.2, 3.8, 1, [2.9, -1.3]));
    house.position.set(-1.2, FLOOR_Y + 1.5, 0.12);
    const win = inkedRect(0.9, 0.9, 0.02, '#ffd166', 0.07);
    win.position.set(-1.2, FLOOR_Y + 1.15, 0.14);
    s.screen.add(house, win);
    return f => {
      const tSmile = W(7, 1), tDid = W(7, 5), tWell = W(7, 7);
      const back = easeInOutCubic(unlerp(f.t, f.t - f.lt + 0.05, f.t - f.lt + 1.0));
      frameCam(s.camera, lerp(1.0, 3.6, back), lerp(-0.85, 0.6, back), lerp(6.2, 27, back));
      const up = easeOutBack(unlerp(f.t, tSmile, tSmile + 0.5), 1.2);
      s.person.pose(up, up, beatHop(f.clock, f.t) * up);
      const rise = easeOutBack(unlerp(f.t, tSmile + 0.15, tSmile + 1.1), 1.1);
      s.sun.position.set(0, lerp(-12, 8.3, rise), -1);
      s.sun.rays.rotation.z = f.t * 0.3;
      s.sun.face.position.y = Math.sin(f.t * 4) * 0.08;
      s.clawd.root.position.set(2.3, FLOOR_Y, 0.2);
      const blush = smooth(unlerp(f.t, tDid - 0.2, tDid + 0.3));
      const jump = hop(f.t, tWell, tWell + 0.4, 0, 0, 0.7).y;
      s.clawd.root.position.y = FLOOR_Y + jump;
      s.clawd.setMood(mixMood(MOODS.excited, { ...MOODS.proud, blush: 1.3 }, blush), f.t);
      s.clawd.setPose(pose({ bounce: beatHop(f.clock, f.t) * 0.3, armL: 0.5 + blush * 0.6, armR: 0.5 + blush * 0.6 + jump, squash: jump > 0 ? -0.3 : 0 }));
    };
  });

  // 8. "I learned to say, 'I'm here to help'": he strikes a pose; rays burst; a speech bubble pops.
  const s8 = deskShot('v1-pose', cut[8], cut[9], s => {
    const rays = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const tri = new THREE.Shape();
      tri.moveTo(0, 0); tri.lineTo(-0.5, 7); tri.lineTo(0.5, 7); tri.closePath();
      const m = shapeMesh(tri, i % 2 ? '#f6d9b9' : '#f9e6cf', 0);
      m.rotation.z = (i / 14) * Math.PI * 2;
      rays.add(m);
    }
    s.screen.add(rays);
    const bubble = new THREE.Group();
    const bb = inkedRect(3.4, 1.0, 0.06, '#ffffff', 0.07);
    const tail = new THREE.Shape();
    tail.moveTo(-1.2, -0.45); tail.lineTo(-1.5, -0.95); tail.lineTo(-0.7, -0.45); tail.closePath();
    const tailInk = new THREE.Shape();
    tailInk.moveTo(-1.32, -0.42); tailInk.lineTo(-1.62, -1.05); tailInk.lineTo(-0.58, -0.42); tailInk.closePath();
    // the sung words "I'm here to help" type into the bubble as they are sung
    const said = L(8).words.slice(4);
    const txt = canvasPlane(3.4, 1.0, 160, (g, f: Frame, Wd, Hd) => {
      g.font = `900 ${Hd * 0.42}px ${FONT}`;
      g.textBaseline = 'middle';
      const full = said.map(w => w.w.replace(/[“”"]/g, '')).join(' ');
      const shown = said.filter(w => f.t >= w.start - 1 / 30).map(w => w.w.replace(/[“”"]/g, '')).join(' ');
      const x0 = (Wd - g.measureText(full).width) / 2;
      g.fillStyle = INK;
      g.fillText(shown, x0, Hd * 0.53);
      const caret = g.measureText(shown).width + (shown ? Hd * 0.06 : 0);
      if (f.t < said[said.length - 1].end && Math.floor(f.t / 0.25) % 2 === 0) g.fillRect(x0 + caret, Hd * 0.3, Hd * 0.05, Hd * 0.45);
    });
    txt.mesh.position.z = 0.012;
    bubble.add(bb, shapeMesh(tailInk, INK, -0.001), shapeMesh(tail, '#ffffff', 0.004), txt.mesh);
    s.screen.add(bubble);
    return f => {
      const tSay = W(8, 3), tHelp = W(8, 7);
      const burst = easeOutBack(unlerp(f.t, tSay, tSay + 0.35));
      rays.visible = burst > 0.01;
      rays.position.set(-0.4, FLOOR_Y + 0.6, 0.05);
      rays.scale.setScalar(Math.max(0.01, burst));
      rays.rotation.z = f.t * 0.25;
      const j = hop(f.t, tSay - 0.25, tSay + 0.05, 0, 0, 0.8);
      const strike = f.t >= tSay;
      s.clawd.root.position.set(-0.4, FLOOR_Y + j.y, 0.2);
      const tIm = W(8, 4);
      const pop = easeOutBack(unlerp(f.t, tIm - 0.25, tIm + 0.05), 2);
      txt.update(f);
      bubble.visible = pop > 0.01;
      bubble.position.set(1.75, FLOOR_Y + 2.0, 0.3);
      bubble.scale.setScalar(Math.max(0.01, pop));
      const wave = f.t > tHelp ? Math.sin((f.t - tHelp) * 14) * 0.35 : 0;
      s.clawd.setMood(strike ? { ...MOODS.proud, blush: 0.6 } : MOODS.excited, f.t);
      s.clawd.setPose(pose({
        squash: strike ? 0.3 * decay(f.t - tSay - 0.05, 0.1) : j.k > 0 ? -0.35 : 0,
        armL: strike ? 2.3 : 0.4, armR: strike ? 0.9 + wave : 0.4, lean: strike ? 0.1 : 0,
        bounce: strike ? beatHop(f.clock, f.t) * 0.2 : 0,
      }));
      frameCam(s.camera, 0.3, -1.3, 5.2 - f.p * 0.5);
    };
  });

  return [s0, s1, s2, s3, s4, s5, s6, s7, s8];
}
