// Verse 1 (0:14.6 to 0:48.1): the crime scene. Storyboard rows 1 to 16. Prod is down the whole
// verse: red error tiles, frozen dancers, a still ball. Each shot cuts on the beat nearest its
// line's sung start (beat numbers in the cut list), and every action inside a shot is keyed to the
// sung time of a word, W(line, word).
import * as THREE from 'three';
import type { Frame, Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { INK, arcShape, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../../engine/flat';
import { clamp, decay, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { PAL, TERM_FONT, UI_FONT, aimCam, cutout, frameCam, glowMat, lightMat, radialTexture, solid } from '../look';
import { BOARD, BOOTH_SPOT, CONSOLE, METER, RISER, SUSPECT_PINS, WALL_Z, allRed, aliveFloor, clearBooth, deadFloor, tileCenter, type ClubState, type Painter } from '../club';
import { DiscoClawd, DISCO_MOODS, REST, dance, mixMood, type DiscoLook, type Pose } from '../clawd-disco';
import { Bouncer, Cache, Field, Fn, sp } from '../suspects';
import { Bulb, Burst, Cuffs, GlowPath, MasterSwitch, Turntable, lightPool, sweatDrop } from '../props';
import { shake, shot } from './common';

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });
const TOP = RISER.h + CONSOLE.h;

/** The verse's club: prod down, logs scrolling on the terminals once the server is up. The
 *  evidence board has one string up until he maps it (line 10); after "caching" (theory = 1)
 *  every string stays on the Cache, ringed in red. */
function verseState(s: ClubState, f: Frame, booted: boolean, theory = 0) {
  Object.assign(s, {
    floor: deadFloor(), alarm: 0.7, frozen: 1, pars: 0.22, wallLight: 0.35, sign: 0.85,
    terms: booted ? 'logs' : 'off', termT0: 14.6,
    ball: { angle: 0.3, lit: 0.2, sparkle: 0 },
    records: { spin: booted ? f.t * 4.7 : 0, label: '/checkout' },
    boardStrings: theory ? 1 : 0.2, boardFocus: theory, boardRing: theory,
  });
}

/** The standard booth camera, with an optional push (0..1). */
function boothCam(cam: THREE.PerspectiveCamera, push = 0, x = 0) {
  aimCam(cam, x, lerp(3.4, 3.1, push), lerp(-2.6, -4.2, push), x * 0.6, lerp(2.75, 2.6, push), -9);
}

/** Camera aimed at the confidence meter from just in front of it, the meter low in frame. */
function meterCam(cam: THREE.PerspectiveCamera, push = 0) {
  const d = lerp(1.55, 1.25, push);
  aimCam(cam, METER.x + 0.18, METER.y + 0.42, METER.z + d, METER.x + 0.18, METER.y + 0.2, METER.z);
}

/** A disco ball sparkle painter for the floor around a lit set of tiles. */
function litTiles(base: Painter, lit: (ix: number, iz: number, f: Frame) => number, color: string): Painter {
  return (ix, iz, f) => {
    const k = lit(ix, iz, f);
    if (k <= 0) return base(ix, iz, f);
    return { color, power: lerp(1, 1.55, k) };
  };
}

/** The Function's surface under the magnifier: dust, cobwebs, a spider and the git blame sticker. */
function functionSurface() {
  return staticPlane(18, 9, 200, (g, W, H) => {
    const u = W / 18;
    g.fillStyle = '#a29eb2'; g.fillRect(0, 0, W, H);
    // brushed metal streaks
    for (let i = 0; i < 260; i++) {
      g.fillStyle = hash(i, 1) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,30,60,0.05)';
      g.fillRect(0, hash(i, 2) * H, W, 1 + hash(i, 3) * 3);
    }
    // panel seam, rivets, vent slots
    g.fillStyle = '#7d798f'; g.fillRect(0, H * 0.78, W, u * 0.12);
    for (let i = 0; i < 9; i++) { g.fillStyle = '#7d798f'; g.beginPath(); g.arc(u * (1 + i * 2), H * 0.86, u * 0.12, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(u * (1 + i * 2) - u * 0.03, H * 0.86 - u * 0.03, u * 0.04, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 6; i++) { g.fillStyle = '#6f6b80'; g.beginPath(); g.roundRect(u * 7, H * 0.12 + i * u * 0.5, u * 3.2, u * 0.2, u * 0.1); g.fill(); }
    // scratches
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3.5;
    for (let i = 0; i < 14; i++) { const x = hash(i, 4) * W, y = hash(i, 5) * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i, 6) - 0.5) * u * 1.6, y + (hash(i, 7) - 0.5) * u * 0.5); g.stroke(); }
    // dust bunnies and specks
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 8) * W, y = hash(i, 9) * H * 0.75, r = u * (0.03 + hash(i, 10) * 0.08);
      g.fillStyle = `rgba(225,220,235,${0.45 + hash(i, 11) * 0.4})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (const [x, y, s] of [[3.2, 5.2, 1], [9.5, 6.1, 1.3], [12.6, 2.6, 0.9]] as [number, number, number][]) {
      for (let k = 0; k < 26; k++) {
        const a = hash(k, x, 12) * Math.PI * 2, r = s * u * (0.15 + hash(k, y, 13) * 0.35);
        g.strokeStyle = 'rgba(205,200,220,0.75)'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(x * u, y * u); g.lineTo(x * u + Math.cos(a) * r, y * u + Math.sin(a) * r); g.stroke();
      }
      g.fillStyle = 'rgba(190,185,205,0.9)'; g.beginPath(); g.arc(x * u, y * u, s * u * 0.2, 0, Math.PI * 2); g.fill();
    }
    // a cobweb across the top left (its spider is a mesh, so it can bob)
    g.strokeStyle = 'rgba(245,242,255,0.85)'; g.lineWidth = 4;
    for (let k = 0; k < 7; k++) { const a = (k / 6) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * u * 5.5, Math.sin(a) * u * 5.5); g.stroke(); }
    for (let r = 1; r <= 5; r++) { g.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI / 2, rr = r * u * (0.95 + 0.1 * Math.sin(k * 3 + r)); if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
    // the git blame sticker, peeling at one corner
    g.save(); g.translate(u * 13.4, u * 5.6); g.rotate(-0.07);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-u * 2.3 + 8, -u * 1.25 + 8, u * 4.6, u * 2.5);
    g.fillStyle = '#ffe17a'; g.fillRect(-u * 2.3, -u * 1.25, u * 4.6, u * 2.5);
    g.fillStyle = '#5a4a1c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${u * 0.5}px ${TERM_FONT}`; g.fillText('$ git blame', 0, -u * 0.62);
    g.font = `700 ${u * 0.36}px ${TERM_FONT}`; g.fillText('last touched: 2019', 0, u * 0.05);
    g.fillStyle = '#9a3b1c'; g.fillText('// TODO: temp fix', 0, u * 0.6);
    g.fillStyle = '#e8c45c'; g.beginPath(); g.moveTo(u * 2.3, u * 1.25); g.lineTo(u * 1.6, u * 1.25); g.lineTo(u * 2.3, u * 0.6); g.closePath(); g.fill();
    g.restore();
  });
}

/** A tiny cartoon spider (world units, facing the camera), hanging from +y. */
function spider() {
  const g = new THREE.Group();
  const thread = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 1), ownMat('#f2efff'));
  thread.geometry.translate(0, 0.5, 0);
  thread.name = 'thread';
  g.add(thread);
  const legs = new THREE.Group();
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const leg = shapeMesh(roundedRectShape(0.36, 0.035, 0.017, sx * 0.18, 0), INK, 0.001);
    leg.position.set(sx * 0.08, 0.06 - k * 0.07, 0.001);
    leg.rotation.z = sx * (0.5 - k * 0.32);
    legs.add(leg);
  }
  legs.name = 'legs';
  g.add(legs);
  g.add(shapeMesh(circleShape(0.17), INK, 0.002, 16));
  for (const sx of [-1, 1]) {
    const eye = shapeMesh(circleShape(0.055), '#ffffff', 0.003, 10);
    eye.position.set(sx * 0.065, 0.04, 0.003);
    const pupil = shapeMesh(circleShape(0.025), INK, 0.004, 8);
    pupil.position.set(sx * 0.065, 0.025, 0.004);
    g.add(eye, pupil);
  }
  return g;
}

export function verse1Shots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const B = (i: number) => audio.beats[i];
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const FLIP = audio.hits.impact.find(h => h.t > 15 && h.t < 16)?.t ?? B(32);
  const shots: Shot[] = [];

  // 1. "I start up the dev server": Clawd slides into the booth and flips the master switch;
  //    the terminals boot one after another (the band comes back in on the flip).
  shots.push(shot('v1-boot', B(30), B(35), ({ scene, camera }) => {
    const c = new DiscoClawd();
    const sw = new MasterSwitch();
    sw.root.position.set(1.32, TOP, CONSOLE.front - 0.28);
    sw.root.scale.setScalar(0.9);
    scene.add(c.root, sw.root);
    return (f, s) => {
      verseState(s, f, false);
      s.terms = f.t < FLIP ? 'off' : 'boot';
      s.termT0 = FLIP;
      s.crowdMask = clearBooth;
      const slide = easeOutCubic(clamp((f.t - B(30)) / 0.42));
      const flip = f.t - FLIP;
      c.root.position.set(lerp(-3.6, 0, slide) + BOOTH_SPOT.x, BOOTH_SPOT.y, BOOTH_SPOT.z);
      const reach = clamp((f.t - (FLIP - 0.5)) / 0.3);          // paw up, ready
      const slam = flip >= 0 ? decay(flip, 0.12) : 0;
      const after = clamp((flip - 0.25) / 0.2);
      const dn = dance('bounce', f.clock.beat(f.t), 0.8);
      let pose = P({ lean: -0.22 * (1 - slide), armL: 0.4 * (1 - slide) - 0.3, armR: lerp(-0.3, 1.0, reach) });
      if (flip >= 0) pose = P({ armR: lerp(-0.55, 1.0, 0) - 0.05 * slam, armL: -0.3, squash: 0.35 * slam, lean: 0.05 * slam });
      if (after > 0) pose = { ...dn.pose, armL: lerp(-0.3, dn.pose.armL + 0.6, after), armR: lerp(-0.55, dn.pose.armR + 0.6, after) };
      c.set(flip >= 0.1 ? DISCO_MOODS.excited : DISCO_MOODS.cool, pose, { shades: 1, jiggle: after > 0 ? dn.jiggle : Math.sin(f.t * 7) * 0.3 }, f.t);
      sw.set(flip);
      boothCam(camera, easeInOutCubic(f.p) * 0.4);
      shake(camera, f, FLIP, 0.05, 0.2);
    };
  }));

  // 2. "And reproduce the crash": the needle drops on /checkout (top-down) ...
  const DROP = W(2, 1);
  shots.push(shot('v2-needle', B(35), B(37), ({ scene, camera }) => {
    scene.background = new THREE.Color('#0b0818');
    const tt = new Turntable();
    scene.add(tt.root);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), lightMat(PAL.violetNeon, 0.25, radialTexture()));
    glow.position.z = -0.1;
    scene.add(glow);
    return (f) => {
      tt.record.rotation.z = -f.t * 4.7;
      // the arm swings in over the record, then lowers onto the outer groove at "reproduce"
      const swing = easeInOutCubic(clamp((f.t - B(35)) / (DROP - 0.12 - B(35))));
      tt.arm.rotation.z = lerp(-0.05, -0.42, swing);
      const down = clamp((f.t - (DROP - 0.12)) / 0.12);
      tt.head.scale.setScalar(lerp(1.12, 1, down));
      // Clawd's paw holds the headshell, then lets go and pulls back
      const head = new THREE.Vector3(0, -1.6, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(tt.arm.rotation.z)).add(tt.arm.position);
      const away = easeInOutCubic(clamp((f.t - DROP - 0.08) / 0.3));
      tt.paw.position.set(head.x + 0.05 + away * 2.2, head.y + away * 0.4, 0.06);
      tt.paw.scale.setScalar(lerp(1.08, 1, down));
      tt.spark.root.position.set(head.x, head.y, 0.08);
      tt.spark.set(f.t - DROP, 1.3);
      frameCam(camera, lerp(0.15, 0.0, easeInOutCubic(f.p)), lerp(-0.05, 0.05, f.p), lerp(3.4, 3.1, easeInOutCubic(f.p)));
      camera.rotation.z = 0.06;
    };
  }, { club: false }));

  // ... the floor comes alive for a moment, then every tile goes red on "crash", and a crash zoom
  //    finds Clawd in the booth delighted: he reproduced it.
  const CRASH = W(2, 3);
  shots.push(shot('v2-crash', B(37), B(39), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    scene.add(c.root);
    return (f, s) => {
      verseState(s, f, true);
      s.crowdMask = clearBooth;
      const alive = f.t < CRASH;
      if (alive) Object.assign(s, { floor: aliveFloor(), frozen: 0, ball: { angle: f.t * 0.6, lit: 1, sparkle: 1 }, beams: 1, pars: 1, alarm: 0, wallLight: 1 });
      else Object.assign(s, { floor: allRed(), frozen: 1, alarm: 1, terms: 'error' });
      const yes = clamp((f.t - CRASH - 0.15) / 0.15);
      const dn = dance('bounce', f.clock.beat(f.t), 1);
      c.set(alive ? DISCO_MOODS.excited : mixMood(DISCO_MOODS.excited, DISCO_MOODS.triumphant, yes), alive ? dn.pose : P({ armL: lerp(-0.4, 0.62, yes), armR: lerp(-0.4, 0.62, yes), squash: 0.2 * (1 - yes) + 0.12 * decay(f.t - CRASH - 0.3, 0.12) }), { shades: 1, jiggle: dn.jiggle }, f.t);
      // hold the wide long enough to see the floor go red, then crash-zoom onto his delight
      const zoom = easeOutCubic(clamp((f.t - CRASH - 0.17) / 0.2));
      aimCam(camera, 0, lerp(lerp(3.9, 3.6, f.p), 2.75, zoom), lerp(lerp(9.2, 8.4, f.p), -3.4, zoom), 0, lerp(1.7, 2.35, zoom), lerp(-3.5, -9, zoom));
      shake(camera, f, CRASH, 0.16, 0.3);
    };
  }));

  // 3. "I trace it through the handler": a trace line shoots from the terminals across the club
  //    to the velvet rope, where the Handler waves it through.
  const TRACE = W(3, 1), HANDLER = W(3, 5);
  shots.push(shot('v3-trace', B(39), B(43), ({ scene, camera }) => {
    const path = new GlowPath([
      new THREE.Vector3(3.6, 3.3, -9.7), new THREE.Vector3(5.6, 5.0, -7.6), new THREE.Vector3(9.0, 4.6, -5.4),
      new THREE.Vector3(12.4, 2.6, -5.2), new THREE.Vector3(14.7, 1.45, -6.1), new THREE.Vector3(16.2, 1.25, -6.25),
      new THREE.Vector3(17.6, 1.6, -7.4), new THREE.Vector3(18.5, 2.2, -9.6),
    ], PAL.cyan, 0.05);
    const bo = new Bouncer();
    bo.root.position.set(13.7, 0, -6.0);
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    scene.add(path.root, bo.root, c.root);
    return (f, s) => {
      verseState(s, f, true);
      s.terms = 'trace'; s.termT0 = TRACE - 0.3;
      const k = f.t < HANDLER ? lerp(0, 0.66, easeInOutCubic(clamp((f.t - TRACE) / (HANDLER - TRACE)))) : lerp(0.66, 1, easeOutCubic(clamp((f.t - HANDLER - 0.12) / 0.4)));
      path.set(k, 1);
      const wave = clamp((f.t - HANDLER + 0.12) / 0.15);
      bo.set(sp({ wag: wave, bob: 0.02 * Math.sin(f.t * 3) }), f.t);
      c.set(DISCO_MOODS.focused, P({ armR: 0.6, armL: -0.4 }), { shades: 0, prop: 'magnifier' }, f.t);
      aimCam(camera, lerp(5.2, 6.0, f.p), 4.3, lerp(6.8, 6.0, f.p), 12.2, 2.6, -7);
      path.face(camera);
    };
  }));

  // 4. "And follow every path": Clawd dances along the trace on the floor, each tile lighting
  //    under his feet; the path branches ahead of him.
  const STEPS: [number, number][] = [[3, 8], [4, 8], [5, 8], [5, 7], [6, 7], [7, 7], [7, 6]];
  shots.push(shot('v4-follow', B(43), B(46), ({ scene, camera }) => {
    const pts = (tiles: [number, number][]) => tiles.map(([ix, iz]) => tileCenter(ix, iz).setY(0.06));
    const main = new GlowPath(pts(STEPS), PAL.cyan, 0.05);
    const br1 = new GlowPath(pts([[5, 7], [5, 6], [5, 5], [4, 5], [4, 3]]), PAL.pink, 0.04);
    const br2 = new GlowPath(pts([[7, 6], [8, 6], [9, 6], [10, 6], [10, 4]]), PAL.gold, 0.04);
    const c = new DiscoClawd();
    const pool = lightPool(1.3, '#ffd9f0', 0.45);
    scene.add(main.root, br1.root, br2.root, c.root, pool);
    const stepT = (i: number) => f0 + i * (B(44) - B(43)) / 2;
    let f0 = B(43);
    return (f, s) => {
      verseState(s, f, true);
      f0 = B(43);
      // which step are we on, and how far through the hop
      const n = clamp(Math.floor((f.t - stepT(0)) / (stepT(1) - stepT(0))), 0, STEPS.length - 2);
      const u = clamp((f.t - stepT(n)) / (stepT(1) - stepT(0)));
      const a = tileCenter(...STEPS[n]), b = tileCenter(...STEPS[n + 1]);
      const e = easeInOutCubic(u);
      const x = lerp(a.x, b.x, e), z = lerp(a.z, b.z, e), hop = Math.sin(u * Math.PI) * 0.28;
      c.root.position.set(x, hop, z);
      pool.position.set(x, 0.02, z);
      const visited = (ix: number, iz: number) => STEPS.findIndex(([sx, sz]) => sx === ix && sz === iz);
      s.floor = litTiles(deadFloor(), (ix, iz) => {
        const k = visited(ix, iz);
        if (k < 0) return 0;
        const at = stepT(k) + (k === 0 ? -0.2 : 0);
        return f.t >= at ? 0.7 + 0.3 * decay(f.t - at, 0.25) : 0;
      }, PAL.cyan);
      main.set(clamp((f.t - B(43) + 0.1) / 0.35), 0.6);
      br1.set(clamp((f.t - B(43) - 0.3) / 0.5), 0.5);
      br2.set(clamp((f.t - B(43) - 0.5) / 0.5), 0.5);
      const sideStep = n % 2 ? 1 : -1;
      c.set(DISCO_MOODS.excited, P({ armL: 0.3 + (sideStep > 0 ? 0.8 : 0), armR: 0.3 + (sideStep < 0 ? 0.8 : 0), lean: sideStep * 0.12, squash: decay(u, 0.08) * 0.3 }), { shades: 1, jiggle: Math.sin(u * Math.PI * 2) }, f.t);
      // the camera follows the eased line of the whole walk, from up and to the left
      const w = easeInOutCubic(clamp((f.t - B(43)) / (B(46) - B(43))));
      const start = tileCenter(...STEPS[0]), end = tileCenter(...STEPS[STEPS.length - 1]);
      const cx = lerp(start.x, end.x, w), cz = lerp(start.z, end.z, w);
      aimCam(camera, cx - 2.6, 5.4, cz + 6.2, cx + 0.4, 0.7, cz - 1.0);
      for (const p of [main, br1, br2]) p.face(camera);
    };
  }));

  // 5. "The key insight seems obvious": a bulb pops over the afro; he points; the meter spikes.
  const INSIGHT = W(5, 2), SEEMS = W(5, 3), OBVIOUS = W(5, 4);
  const END4 = tileCenter(...STEPS[STEPS.length - 1]);
  shots.push(shot('v5-insight', B(46), B(50), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.set(END4.x, 0, END4.z);
    const bulb = new Bulb();
    bulb.root.position.set(0, 2.25, 0.05);
    c.root.add(bulb.root);
    const pool = lightPool(1.4, '#ffe9a8', 0.4);
    pool.position.set(END4.x, 0.02, END4.z);
    scene.add(c.root, pool);
    return (f, s) => {
      verseState(s, f, true);
      const pt = clamp((f.t - SEEMS) / 0.12);
      const dn = dance('groove', f.clock.beat(f.t), 0.5);
      const pose = pt > 0 ? P({ armR: lerp(dn.pose.armR, 1.15, pt), armL: lerp(dn.pose.armL, -0.7, pt), lean: -0.14 * pt, squash: 0.25 * decay(f.t - SEEMS, 0.1) }) : dn.pose;
      const lit = f.t >= INSIGHT;
      c.set(lit ? DISCO_MOODS.smug : DISCO_MOODS.focused, pose, { shades: lit ? 1 : 0, jiggle: dn.jiggle * (1 - pt), puff: 0.3 * pt }, f.t);
      bulb.set(f.t - INSIGHT, f.t);
      (pool.material as THREE.MeshBasicMaterial).opacity = lit ? 0.55 : 0.3;
      const k = easeInOutCubic(f.p);
      aimCam(camera, END4.x - 1.4, lerp(1.6, 1.75, k), END4.z + lerp(5.4, 4.8, k), END4.x - 1.15, 1.6, END4.z);
    };
  }));
  shots.push(shot('v5-meter', B(50), B(51), ({ camera }) => (f, s) => {
    verseState(s, f, true);
    s.crowdMask = clearBooth;
    const spike = f.t - OBVIOUS;
    s.meter = spike < 0 ? 0.12 : 0.8 + 0.12 * Math.sin(spike * 30) * decay(spike, 0.15) - 0.68 * decay(spike, 0.04);
    meterCam(camera, f.p);
  }));

  // 6. "This function must be wrong": he collars the Function and snaps on the cuffs.
  const FN_AT = new THREE.Vector3(1.35, 0, 0.4), CL_AT = new THREE.Vector3(-0.55, 0, 0.4);
  const GRAB = W(6, 1), WRONG = W(6, 4);
  const twoShot = (cam: THREE.PerspectiveCamera, push: number) => aimCam(cam, 0.35, lerp(1.4, 1.35, push), lerp(5.8, 5.0, push), 0.35, 1.05, 0.3);
  shots.push(shot('v6-collar', B(51), B(55), ({ scene, camera }) => {
    const fn = new Fn();
    fn.root.position.copy(FN_AT);
    fn.root.scale.setScalar(1.3);
    const cuffs = new Cuffs(0.3);
    cuffs.root.position.set(0, 0.42, 0.06);
    fn.root.add(cuffs.root);
    const snap = new Burst(PAL.cyan, 10);
    snap.root.position.set(0, 0.42, 0.08);
    fn.root.add(snap.root);
    const c = new DiscoClawd();
    scene.add(fn.root, c.root);
    return (f, s) => {
      verseState(s, f, true);
      const walk = easeOutCubic(clamp((f.t - B(51)) / (GRAB - B(51))));
      c.root.position.set(lerp(-3.8, CL_AT.x, walk), Math.abs(Math.sin(walk * Math.PI * 3)) * 0.12 * (1 - walk), CL_AT.z);
      const grab = clamp((f.t - GRAB) / 0.12);
      const cuffed = f.t >= WRONG;
      const certain = clamp((f.t - WRONG) / 0.2);
      c.set(cuffed ? DISCO_MOODS.certain : DISCO_MOODS.smug, P({ armR: lerp(-0.3, 0.05, grab), armL: cuffed ? 0.5 * certain : -0.4, lean: 0.06 * grab, squash: 0.2 * (cuffed ? decay(f.t - WRONG, 0.1) : 0) }), { shades: 1, puff: 0.6 * certain, medal: cuffed ? decay(f.t - WRONG, 0.4) : 0 }, f.t);
      const shock = clamp((f.t - GRAB) / 0.1);
      fn.set(sp({ open: lerp(0.45, 1.3, shock), brow: lerp(0, 1, shock), cuffs: cuffed ? 1 : 0, mouth: shock > 0.5 ? -1 : 0, bob: 0.08 * decay(f.t - GRAB, 0.12), look: -0.6 * shock }), f.t);
      cuffs.root.visible = cuffed;
      snap.set(f.t - WRONG, 0.8);
      twoShot(camera, easeInOutCubic(f.p) * 0.5);
      shake(camera, f, WRONG, 0.05, 0.15);
    };
  }));

  // 7. "Upon closer inspection": through the magnifier: a spider on its thread, a dust bunny, then
  //    the git blame sticker, and a red marker ring round "2019".
  const INSPECTION = W(7, 2);
  const SPIDER = new THREE.Vector3(-4.4, 1.75, 0.01);
  // "2019" on the sticker: its centre in world units (the sticker is painted at canvas (13.4, 5.6)
  // u, rotated -0.07, with "last touched: 2019" in 0.36 u Space Mono centred on it)
  const YEAR = new THREE.Vector2(5.94, -1.04);
  const LENS = { x: 0.5, y: 0.57, r: 0.37 };   // the lens on screen, fractions of the frame height
  const lensAt = (t: number) => {
    const k1 = easeInOutCubic(clamp((t - B(55) - 0.3) / (W(7, 1) - B(55) - 0.15)));
    const k2 = easeInOutCubic(clamp((t - INSPECTION + 0.15) / 0.45));
    const x = lerp(lerp(SPIDER.x + 0.2, 0.5, k1), YEAR.x, k2), y = lerp(lerp(SPIDER.y + 0.05, -1.45, k1), YEAR.y, k2);
    const zoom = lerp(3.7, 3.0, k2);
    // the hand holding it isn't steady
    return { x: x + Math.sin(t * 1.7) * 0.05, y: y + Math.cos(t * 1.3) * 0.04, zoom };
  };
  shots.push(shot('v7-inspect', B(55), B(59), ({ scene, camera }) => {
    scene.background = new THREE.Color('#05030c');
    const surf = functionSurface();
    solid(surf);
    scene.add(surf);
    const sp1 = spider();
    scene.add(sp1);
    const thread = sp1.getObjectByName('thread')!, legs = sp1.getObjectByName('legs')!;
    // dust drifting in the lens light
    const N = 26;
    const motes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.025, 8), lightMat('#fff6e0', 0.55), N);
    motes.frustumCulled = false;
    motes.boundingSphere = new THREE.Sphere(new THREE.Vector3(SPIDER.x, SPIDER.y, 0.03), 1e3);   // fixed: see Club.spots
    scene.add(motes);
    const m4 = new THREE.Matrix4();
    return (f) => {
      const v = lensAt(f.t);
      frameCam(camera, v.x, v.y + (LENS.y - 0.5) * v.zoom, v.zoom);
      // the spider bobs on its thread and waves hello
      const y = SPIDER.y + 0.16 * Math.sin(f.t * 2.4);
      sp1.position.set(SPIDER.x, y, SPIDER.z);
      thread.scale.y = 4.5 - y;
      legs.rotation.z = 0.08 * Math.sin(f.t * 9);
      for (let i = 0; i < N; i++) {
        const x = v.x + ((hash(i, 21) * 6 + f.t * (0.15 + hash(i, 22) * 0.2)) % 6) - 3;
        const yy = v.y + (hash(i, 23) - 0.5) * 3 + Math.sin(f.t * 0.8 + i) * 0.15;
        m4.makeTranslation(x, yy, 0.03);
        motes.setMatrixAt(i, m4);
      }
      motes.instanceMatrix.needsUpdate = true;
    };
  }, {
    club: false,
    overlay(g, f) {
      // the lens: everything outside it dark, a gold ring with an ink edge, a glass highlight
      const cx = f.w * LENS.x, cy = f.h * LENS.y, r = f.h * LENS.r;
      g.save();
      g.beginPath(); g.rect(0, 0, f.w, f.h); g.arc(cx, cy, r, 0, Math.PI * 2, true);
      g.fillStyle = 'rgba(6,4,15,0.94)'; g.fill('evenodd');
      g.lineWidth = f.h * 0.05; g.strokeStyle = INK; g.beginPath(); g.arc(cx, cy, r + f.h * 0.012, 0, Math.PI * 2); g.stroke();
      g.lineWidth = f.h * 0.032; g.strokeStyle = PAL.chain; g.beginPath(); g.arc(cx, cy, r + f.h * 0.012, 0, Math.PI * 2); g.stroke();
      g.lineWidth = f.h * 0.008; g.strokeStyle = '#fff3c4'; g.beginPath(); g.arc(cx, cy, r + f.h * 0.012, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
      // handle, off to the lower right
      g.translate(cx, cy); g.rotate(-0.75);
      g.fillStyle = INK; g.beginPath(); g.roundRect(-f.h * 0.045, r + f.h * 0.02, f.h * 0.09, f.h * 0.4, f.h * 0.03); g.fill();
      g.fillStyle = '#7a4a2a'; g.beginPath(); g.roundRect(-f.h * 0.032, r + f.h * 0.032, f.h * 0.064, f.h * 0.38, f.h * 0.025); g.fill();
      g.rotate(0.75);
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = f.h * 0.018;
      g.beginPath(); g.arc(0, 0, r * 0.8, Math.PI * 1.1, Math.PI * 1.35); g.stroke();
      g.restore();
      // a red marker ring round "2019" once we land on it, drawn where the year is on screen
      const k = clamp((f.t - INSPECTION - 0.45) / 0.3);
      if (k > 0) {
        const v = lensAt(f.t), ppu = f.h / v.zoom;
        const sx = f.w / 2 + (YEAR.x - v.x) * ppu, sy = f.h / 2 - (YEAR.y - (v.y + (LENS.y - 0.5) * v.zoom)) * ppu;
        g.save();
        g.strokeStyle = '#e0142c'; g.lineWidth = f.h * 0.012; g.lineCap = 'round';
        g.beginPath(); g.ellipse(sx, sy, 0.64 * ppu, 0.3 * ppu, -0.07, -Math.PI * 0.9, -Math.PI * 0.9 + Math.PI * 2.1 * k); g.stroke();
        g.restore();
      }
    },
  }));

  // 8. "It's been like this too long": the Function shrugs in its cuffs; on "long" they slip off its
  //    stubby old paws and clatter to the floor, and it shrugs properly. The afro deflates.
  const LIKE = W(8, 2), LONG = W(8, 5);
  shots.push(shot('v8-shrug', B(59), B(63), ({ scene, camera }) => {
    const fn = new Fn();
    fn.root.position.copy(FN_AT);
    fn.root.scale.setScalar(1.3);
    const cuffs = new Cuffs(0.3);
    scene.add(cuffs.root);
    const c = new DiscoClawd();
    c.root.position.copy(CL_AT);
    scene.add(fn.root, c.root);
    return (f, s) => {
      verseState(s, f, true);
      const shrug = clamp(easeOutBack(clamp((f.t - LIKE) / 0.25), 2));
      const drop = f.t - LONG;
      const free = clamp(drop / 0.25);
      const bob = 0.05 * Math.sin(shrug * Math.PI);
      fn.set(sp({ shrug, cuffs: 1 - free, open: 0.55, brow: 0.8 * shrug, mouth: 0, bob }), f.t);
      // cuffs on the paws (which ride up with the shrugging body) until "long", then they slip off
      // and fall with a bounce
      const atPaws = (0.45 + bob + shrug * 0.06) * 1.3;
      if (drop < 0) {
        cuffs.root.position.set(FN_AT.x, atPaws, FN_AT.z + 0.1);
        cuffs.root.rotation.z = 0;
      } else {
        const fall = atPaws - 4.9 * drop * drop;
        const land = Math.sqrt((atPaws - 0.05) / 4.9);
        const y = fall > 0.05 ? fall : 0.05 + Math.abs(Math.sin((drop - land) * 9)) * 0.12 * decay(drop - land, 0.15);
        cuffs.root.position.set(FN_AT.x + drop * 0.5, Math.max(0.05, y), FN_AT.z + 0.12);
        cuffs.root.rotation.z = -Math.min(drop, land + 0.3) * 5;
      }
      const deflate = clamp((f.t - LONG) / 0.35);
      const look = clamp((f.t - LIKE) / 0.3);
      c.set(mixMood(DISCO_MOODS.certain, DISCO_MOODS.baffled, look), P({ armL: lerp(0.5, -0.5, look), armR: lerp(0.05, 0.6, look) - 0.9 * deflate, lean: -0.05 * look }), { shades: lerp(1, 2, look), puff: 0.6 * (1 - deflate), flat: 0.85 * deflate }, f.t);
      twoShot(camera, 0.5 + easeInOutCubic(f.p) * 0.5);
    };
  }));

  // 9. "I search for every caller": grep results fill the terminals; Clawd scratches them.
  shots.push(shot('v9-grep', B(63), B(67), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    scene.add(c.root);
    return (f, s) => {
      verseState(s, f, true);
      s.crowdMask = clearBooth;
      s.terms = 'grep'; s.termT0 = B(63);
      const b = f.clock.beat(f.t);
      const scr = Math.sin(b * Math.PI * 2);
      s.termOffset = scr * 3.2;
      s.records.spin = f.t * 4.7 + scr * 1.4;
      c.set(DISCO_MOODS.excited, P({ armL: -0.55 + 0.28 * scr, armR: -0.55 - 0.28 * scr, lean: 0.05 * scr, squash: 0.15 * Math.max(0, Math.cos(b * Math.PI * 2)) }), { shades: 1, jiggle: scr * 0.6 }, f.t);
      boothCam(camera, 0.25 + 0.4 * easeInOutCubic(f.p));
    };
  }));

  // 10. "I map the data flow": at the evidence board, magnifier up, a string going up on every beat.
  // 11. "This strongly points to caching": every string swings onto the Cache; push in on its photo.
  const POINTS = W(11, 2), CACHING = W(11, 4);
  const CL_BOARD = new THREE.Vector3(7.7, 0, -6.4);
  const CACHE_PIN = new THREE.Vector3(BOARD.x - BOARD.w / 2 + SUSPECT_PINS.cache[0] * BOARD.w, BOARD.y + BOARD.h / 2 - SUSPECT_PINS.cache[1] * BOARD.h - 0.05, WALL_Z + 0.16);
  // camera keys: wide on Clawd and the board, a little closer, then tight on the Cache's photo
  const BOARD_KEYS = [
    { p: new THREE.Vector3(9.0, 1.9, 1.5), t: new THREE.Vector3(9.8, 2.7, -9.0) },
    { p: new THREE.Vector3(9.0, 1.95, 0.3), t: new THREE.Vector3(9.9, 2.85, -9.4) },
    { p: new THREE.Vector3(CACHE_PIN.x - 0.2, CACHE_PIN.y + 0.1, -6.3), t: CACHE_PIN },
  ];
  const boardCam = (cam: THREE.PerspectiveCamera, a: number, b: number, k: number) => {
    const A = BOARD_KEYS[a], Bk = BOARD_KEYS[b];
    aimCam(cam, lerp(A.p.x, Bk.p.x, k), lerp(A.p.y, Bk.p.y, k), lerp(A.p.z, Bk.p.z, k), lerp(A.t.x, Bk.t.x, k), lerp(A.t.y, Bk.t.y, k), lerp(A.t.z, Bk.t.z, k));
  };
  shots.push(shot('v10-board', B(67), B(71), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_BOARD);
    const pool = lightPool(1.3, '#ffe9c4', 0.35);
    pool.position.set(CL_BOARD.x, 0.02, CL_BOARD.z);
    scene.add(c.root, pool);
    return (f, s) => {
      verseState(s, f, true);
      // a string per beat from "map"
      s.boardStrings = clamp(0.08 + (f.clock.beat(f.t) - f.clock.beat(W(10, 1))) / 7 + (f.t > W(10, 1) ? 0.12 : 0));
      s.boardFocus = 0;
      const b = f.clock.beat(f.t), ph = b - Math.floor(b);
      // magnifier held up to the board, a little jab on every beat as each string goes up
      c.set(DISCO_MOODS.focused, P({ armR: 0.85 + 0.12 * decay(ph, 0.12), armL: -0.5 + 0.1 * Math.sin(b * Math.PI), squash: 0.12 * decay(ph, 0.1), lean: 0.04 }), { shades: 0, prop: 'magnifier' }, f.t);
      c.root.rotation.y = 0;
      boardCam(camera, 0, 1, easeInOutCubic(f.p));
    };
  }));
  shots.push(shot('v11-caching', B(71), B(74), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_BOARD);
    scene.add(c.root);
    return (f, s) => {
      verseState(s, f, true);
      s.boardStrings = 1;
      s.boardFocus = easeOutBack(clamp((f.t - POINTS) / 0.32), 1.6);
      s.boardRing = easeOutCubic(clamp((f.t - CACHING + 0.04) / 0.22));
      const sure = clamp((f.t - POINTS) / 0.2);
      c.set(sure > 0 ? DISCO_MOODS.certain : DISCO_MOODS.smug, P({ armR: lerp(0.7, 1.0, sure), armL: lerp(-0.5, -0.8, sure), lean: -0.1 * sure }), { shades: 1, puff: sure, prop: 'none' }, f.t);
      const k = clamp((f.t - B(71)) / (B(74) - B(71)));
      boardCam(camera, 1, 2, easeInOutCubic(k * k));
    };
  }));
  shots.push(shot('v11-meter', B(74), B(75), ({ camera }) => (f, s) => {
    verseState(s, f, true, 1);
    s.crowdMask = clearBooth;
    const slam = clamp((f.t - B(74)) / 0.1);
    s.meter = lerp(0.5, 1, easeOutCubic(slam)) + 0.02 * Math.sin(f.t * 47);
    meterCam(camera, f.p);
  }));

  // 12. "But traces tell me no": NO on every screen; the Cache lowers its shades and wags a finger,
  //     and the tiny Field peeks out from behind it.
  const TELL = W(12, 2), NO = W(12, 4);
  shots.push(shot('v12-no', B(75), B(79), ({ scene, camera }) => {
    const ca = new Cache();
    ca.root.position.set(-0.2, 0, -6.1);
    const fi = new Field();
    fi.root.position.set(0.15, 0, -6.4);
    const pool = lightPool(1.6, '#d9f6ff', 0.35);
    pool.position.set(-0.2, 0.02, -6.0);
    scene.add(ca.root, fi.root, pool);
    return (f, s) => {
      verseState(s, f, true, 1);
      s.terms = f.t < NO ? 'trace' : 'no'; s.termT0 = B(75);
      s.crowdMask = i => ![1, 2, 3].includes(i);
      const lower = clamp((f.t - (B(75) + 0.35)) / 0.3);
      const wag = clamp((f.t - TELL) / 0.15);
      ca.set(sp({ shades: lower, wag, mouth: 0.6 - wag * 0.3, brow: -0.3 * lower, armL: -0.9, bob: 0.03 * Math.sin(f.clock.beat(f.t) * Math.PI) }), f.t);
      const peek = smooth(clamp((f.t - (TELL - 0.05)) / 0.2)) * (1 - smooth(clamp((f.t - (NO + 0.35)) / 0.2)));
      fi.root.position.x = lerp(0.15, 0.92, peek);
      fi.set(sp({ look: -0.8, open: 1 }), f.t);
      aimCam(camera, 0.4, 1.3, 0.6, -0.1, 2.55, -9.5);
      shake(camera, f, NO, 0.06, 0.2);
    };
  }));

  // 13. "I've isolated the issue": he shoos the dancers off one square and stands on it alone.
  const ISO_TILES = (ix: number, iz: number) => (ix === 6 || ix === 7) && (iz === 4 || iz === 5);
  const SQ = new THREE.Vector3(0, 0, -2.5);
  const SHOO: Record<number, [number, number]> = { 6: [2.7, 0.9], 7: [-2.5, 0.8], 9: [3.7, -0.9], 10: [-3.8, -1.0], 5: [4.6, 1.0] };
  const ISSUE = W(13, 3);
  const isoFloor = (f: Frame) => litTiles(deadFloor(0.8), (ix, iz) => (ISO_TILES(ix, iz) && f.t >= ISSUE - 0.25 ? 0.8 + 0.2 * Math.sin(f.t * 6) : 0), PAL.gold);
  shots.push(shot('v13-isolate', B(79), B(83), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(SQ);
    const pool = lightPool(1.9, '#ffe9a8', 0);
    pool.position.set(SQ.x, 0.025, SQ.z);
    scene.add(c.root, pool);
    return (f, s) => {
      verseState(s, f, true, 1);
      s.floor = isoFloor(f);
      const go = easeInOutCubic(clamp((f.t - (B(79) + 0.15)) / 0.75));
      s.crowdShift = (i) => {
        const o = SHOO[i];
        if (!o) return null;
        return new THREE.Vector3(o[0] * (1 - go), 0, o[1] * (1 - go));
      };
      const shoo = f.t < ISSUE - 0.3;
      const b = f.clock.beat(f.t);
      const flap = Math.sin(b * Math.PI * 4);
      const proud = clamp((f.t - (ISSUE - 0.3)) / 0.25);
      c.set(shoo ? DISCO_MOODS.focused : DISCO_MOODS.smug, shoo ? P({ armL: 0.4 + 0.5 * flap, armR: 0.4 - 0.5 * flap, lean: 0.08 * flap }) : P({ armL: lerp(0.4, 0.15, proud), armR: lerp(0.4, 0.15, proud), squash: -0.1 * proud }), { shades: shoo ? 0 : 1, puff: 0.5 * proud }, f.t);
      (pool.material as THREE.MeshBasicMaterial).opacity = 0.5 * proud;
      const push = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.6, 0.4, push), lerp(10.6, 7.6, push), lerp(7.6, 4.6, push), 0, lerp(0.2, 0.5, push), lerp(-2.8, -2.6, push));
    };
  }));

  // 14. "The evidence looks strong": he flexes on his square; cut to the disco ball, which twitches
  //     on "strong" as if it might start, flashes, and goes still again.
  const STRONG = W(14, 3);
  shots.push(shot('v14-flex', B(83), STRONG - 0.03, ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(SQ);
    const pool = lightPool(1.9, '#ffe9a8', 0.35);
    pool.position.set(SQ.x, 0.025, SQ.z);
    scene.add(c.root, pool);
    return (f, s) => {
      verseState(s, f, true, 1);
      s.floor = isoFloor(f);
      const b = f.clock.beat(f.t), ph = b - Math.floor(b);
      const pump = decay(ph, 0.12);
      // arms out and up where they read beside the afro, pumping on every beat
      c.set(DISCO_MOODS.smug, P({ armL: 0.5 + 0.18 * pump, armR: 0.5 + 0.18 * pump, squash: 0.25 * pump, bounce: 0.04 * pump }), { shades: 1, puff: 0.7 + 0.1 * pump, medal: pump * 0.6 }, f.t);
      const push = easeInOutCubic(f.p);
      aimCam(camera, lerp(0.5, 0.2, push), lerp(1.5, 1.25, push), lerp(3.6, 2.4, push), 0, lerp(1.25, 1.3, push), SQ.z);
    };
  }));
  shots.push(shot('v14-ball', STRONG - 0.03, B(87), ({ camera }) => {
    return (f, s) => {
      verseState(s, f, true, 1);
      const tw = f.t - STRONG;
      const twitch = tw >= 0 ? decay(tw, 0.3) : 0;
      // a quarter turn with a wobble, a flash of light, then it settles dark again
      s.ball = { angle: 0.3 + (tw >= 0 ? 0.6 * (1 - Math.exp(-tw * 7)) + 0.07 * Math.sin(tw * 34) * twitch : 0), lit: 0.25 + 0.75 * twitch, sparkle: twitch };
      const k = easeOutCubic(clamp((f.t - STRONG + 0.03) / (B(87) - STRONG)));
      aimCam(camera, lerp(0.6, 0.3, k), lerp(8.4, 8.7, k), lerp(4.6, 3.6, k), 0, lerp(9.1, 9.25, k), -0.5);
      shake(camera, f, STRONG, 0.05, 0.2);
    };
  }));

  // 15. "To three competing causes": the square splits; the Function, the Handler and the Cache
  //     pop up, one on each word.
  // 16. "So something here is wrong": Clawd looks from one to the next to the next; afro spinning.
  const POPS = [W(15, 1), W(15, 2), W(15, 3)];
  const SLOTS = [new THREE.Vector3(-3.3, 0, -2.6), new THREE.Vector3(0.1, 0, -4.4), new THREE.Vector3(3.4, 0, -2.6)];
  // high enough that the Handler, at the back, shows over Clawd's afro
  const lineupCam = (cam: THREE.PerspectiveCamera, k: number) => aimCam(cam, 0, lerp(4.2, 3.9, k), lerp(8.9, 8.2, k), 0, 1.25, -2.5);
  const CL_FRONT = new THREE.Vector3(0, 0, 0.7);
  function lineup(scene: THREE.Scene) {
    const fn = new Fn(), bo = new Bouncer(), ca = new Cache(), fi = new Field();
    fn.root.scale.setScalar(1.35);
    const roots = [fn.root, bo.root, ca.root];
    const pads: THREE.Mesh[] = [], pools: THREE.Mesh[] = [], bursts: Burst[] = [];
    roots.forEach((r, i) => {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), glowMat(PAL.gold, 1.12));
      pad.rotation.x = -Math.PI / 2;
      const pool = lightPool(1.6, ['#cfe0ff', '#ffd0f0', '#d0ffe8'][i], 0.3);
      const burst = new Burst([PAL.cyan, PAL.pink, PAL.gold][i], 10);
      scene.add(r, pad, pool, burst.root);
      pads.push(pad); pools.push(pool); bursts.push(burst);
    });
    fi.root.position.set(SLOTS[2].x + 0.4, 0, SLOTS[2].z - 0.4);
    scene.add(fi.root);
    return { fn, bo, ca, fi, roots, pads, pools, bursts };
  }
  shots.push(shot('v15-three', B(87), B(91), ({ scene, camera }) => {
    const cast = lineup(scene);
    const c = new DiscoClawd();
    scene.add(c.root);
    return (f, s) => {
      verseState(s, f, true, 1);
      s.crowdMask = i => ![6, 7].includes(i);
      const split = easeInOutCubic(clamp((f.t - (B(87) + 0.05)) / 0.3));
      s.floor = litTiles(deadFloor(0.8), (ix, iz) => (ISO_TILES(ix, iz) && split < 0.3 ? 0.9 : 0), PAL.gold);
      cast.roots.forEach((r, i) => {
        const pop = f.t - POPS[i];
        const k = pop < 0 ? 0 : easeOutBack(clamp(pop / 0.22), 2.6);
        const slot = SLOTS[i];
        const padAt = new THREE.Vector3(lerp(SQ.x, slot.x, split), 0.03, lerp(SQ.z, slot.z, split));
        cast.pads[i].position.copy(padAt);
        cast.pads[i].visible = split > 0;
        cast.pools[i].position.set(padAt.x, 0.035, padAt.z);
        (cast.pools[i].material as THREE.MeshBasicMaterial).opacity = 0.3 * clamp(pop / 0.2);
        r.position.set(slot.x, (1 - clamp(pop / 0.22)) * -0.6, slot.z);
        r.visible = pop >= 0;
        const base = i === 0 ? 1.35 : 1;
        r.scale.set(base * Math.max(0.01, k), base * Math.max(0.01, k), base);
        cast.bursts[i].root.position.set(slot.x, 1.2, slot.z + 0.5);
        cast.bursts[i].set(pop, 1.6);
      });
      const poseHit = (i: number) => clamp((f.t - POPS[i] - 0.1) / 0.2);
      cast.fn.set(sp({ open: 0.7, brow: 0.5, armL: lerp(-0.9, 0.4, poseHit(0)), armR: lerp(-0.9, 0.4, poseHit(0)), mouth: 0.5 }), f.t);
      cast.bo.set(sp({ wag: 0 }), f.t);
      cast.ca.set(sp({ mouth: 0.8, armL: lerp(-0.9, 0.3, poseHit(2)), armR: lerp(-0.9, 0.9, poseHit(2)) }), f.t);
      cast.fi.set(sp({ look: -1 }), f.t);
      cast.fi.root.visible = false;
      // Clawd hops off the splitting square to the front and spins round to look
      const hop = easeInOutCubic(clamp((f.t - B(87)) / 0.35));
      c.root.position.set(lerp(SQ.x, CL_FRONT.x, hop), Math.sin(hop * Math.PI) * 0.6, lerp(SQ.z, CL_FRONT.z, hop));
      const which = f.t < POPS[1] - 0.05 ? -1 : f.t < POPS[2] - 0.05 ? 0 : 1;
      c.set(DISCO_MOODS.baffled, P({ armL: 0.7, armR: 0.7, lean: -which * 0.1, turn: which * 0.5 }), { shades: 2, puff: 0.2 }, f.t);
      lineupCam(camera, f.p);
    };
  }));

  // he looks from one suspect to the next, faster and faster: [beat, -1 Function / 0 Handler / 1 Cache]
  const LOOKS: [number, number][] = [[91.4, -1], [91.9, 1], [92.9, -1], [93.8, 0], [94.5, 1], [95, -1], [95.5, 1], [96, 0], [96.5, -1], [96.75, 1], [97, -1], [97.25, 1], [97.5, -1], [97.75, 1], [98, -1], [98.25, 1], [98.5, 0]];
  // the tiny Field peeks out from behind the Cache on "here", while he's looking the other way
  const PEEK_IN = W(16, 2) - 0.12, PEEK_OUT = W(16, 4) + 0.35;
  const WRONG16 = W(16, 4);
  shots.push(shot('v16-baffled', B(91), B(100), ({ scene, camera }) => {
    const cast = lineup(scene);
    const c = new DiscoClawd();
    c.root.position.copy(CL_FRONT);
    const drops = Array.from({ length: LOOKS.length * 2 }, () => sweatDrop());
    scene.add(c.root, ...drops);
    return (f, s) => {
      verseState(s, f, true, 1);
      s.crowdMask = i => ![6, 7].includes(i);
      cast.roots.forEach((r, i) => {
        r.position.copy(SLOTS[i]);
        const base = i === 0 ? 1.35 : 1;
        r.scale.setScalar(base);
        cast.pads[i].position.set(SLOTS[i].x, 0.03, SLOTS[i].z);
        cast.pools[i].position.set(SLOTS[i].x, 0.035, SLOTS[i].z);
        cast.bursts[i].set(-1);
      });
      const b = f.clock.beat(f.t);
      cast.fn.set(sp({ open: 0.5, brow: 0.6, armL: 0.4, armR: 0.4, mouth: 0, bob: 0.03 * Math.sin(b * Math.PI) }), f.t);
      cast.bo.set(sp({}), f.t);
      cast.ca.set(sp({ mouth: 0.8, wag: b > 95 && b < 97 ? 1 : 0, armL: 0.3 }), f.t);
      const peek = smooth(clamp((f.t - PEEK_IN) / 0.2)) * (1 - smooth(clamp((f.t - PEEK_OUT) / 0.2)));
      cast.fi.root.position.set(SLOTS[2].x + lerp(0.3, 1.0, peek), 0, SLOTS[2].z - 0.35);
      cast.fi.set(sp({ look: -1 }), f.t);
      cast.fi.root.visible = peek > 0.01;
      // which suspect is he looking at: one per look, snapping round, faster and faster
      let n = -1;
      for (let i = 0; i < LOOKS.length; i++) if (b >= LOOKS[i][0]) n = i;
      const target = n < 0 ? 0 : LOOKS[n][1];
      const since = n < 0 ? 1 : b - LOOKS[n][0];
      const snapK = easeOutCubic(clamp(since / 0.18));
      const prev = n <= 0 ? 0 : LOOKS[n - 1][1];
      const look = lerp(prev, target, snapK);
      const panic = clamp((b - 94) / 5);
      const pose = P({ armL: 0.7 + 0.2 * panic, armR: 0.7 + 0.2 * panic, lean: -look * 0.12, turn: look * 0.55, squash: 0.15 * decay(since, 0.1) });
      c.set(mixMood(DISCO_MOODS.baffled, DISCO_MOODS.ohno, panic * 0.6), pose, { shades: 2, spin: (f.t - B(91)) * (1.5 + panic * 5), jiggle: Math.sin(f.t * 9) * 0.6, puff: 0.1 } as Partial<DiscoLook>, f.t);
      // sweat flies off on each look
      drops.forEach((d, i) => {
        const k = Math.floor(i / 2), side = i % 2 ? 1 : -1;
        const t0 = f.clock.beatTime(LOOKS[k][0]);
        const dt = f.t - t0;
        d.visible = dt > 0 && dt < 0.6;
        if (!d.visible) return;
        const vx = side * (1.4 + hash(i, 3) * 1.2), vy = 2.2 + hash(i, 4);
        d.position.set(CL_FRONT.x + side * 0.7 + vx * dt, 1.5 + vy * dt - 4.9 * dt * dt, CL_FRONT.z + 0.2);
        d.rotation.z = -side * (0.6 + dt * 3);
        d.scale.setScalar(1 - dt);
      });
      // hold wide while the clue peeks out, then push in on him through the long "wrong"
      const k = easeInOutCubic(clamp((f.t - WRONG16 - 0.3) / (B(99) - WRONG16 - 0.3)));
      aimCam(camera, 0, lerp(3.9, 1.55, k), lerp(8.2, 4.4, k), 0, lerp(1.25, 1.35, k), lerp(-2.5, CL_FRONT.z - 1, k));
    };
  }));

  return shots;
}

