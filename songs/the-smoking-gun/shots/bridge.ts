// The bridge (2:18.9 to 2:37.6). Storyboard rows 49 to 56. At the bar, the Chief says something
// (a squiggle) and Clawd, perched on a stool, can only agree: "You're absolutely right there!" The
// Chief slides over a napkin with the odd byte circled; a tiny bomb goes off under a cocktail dome
// (the blast radius is bounded); Clawd holds up a graph and shrugs while the Chief sips. Then back
// on the dead floor: he unzips a seam and finds a load-bearing girder full of wiring, skips down a
// rainbow happy path, slams the big red RUN button in the booth, and on "green" a green wave rolls
// out from his feet across the whole floor. Prod is still down all the while (red tiles, frozen
// dancers); the final chorus brings it back.
import * as THREE from 'three';
import type { Frame, Shot } from '../../../engine/types';
import type { AudioData, LyricsData } from '../../../engine/song';
import { clamp, decay, easeInOutCubic, easeOutBack, easeOutCubic, lerp, smooth } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { PAL, aimCam, frameCam, lightMat, radialTexture } from '../look';
import { BAR, BOOTH_SPOT, CONSOLE, FLOOR, RISER, clearBooth, deadFloor, tileCenter, type Club, type ClubState, type Painter } from '../club';
import { ARM_LEN, DiscoClawd, DISCO_MOODS, REST, dance, type Pose } from '../clawd-disco';
import { Chief, cs } from '../chief';
import { Burst, lightPool } from '../props';
import { DomeBomb, FloorSeam, NapkinInsert, RunButton, drawTalk, flower, glint, graphCard, sunSticker } from '../bar';
import { screenAt } from '../lab';
import { shake, shot } from './common';

const P = (p: Partial<Pose>): Pose => ({ ...REST, ...p });

/** The bridge's club: prod is still down (dead floor, red tiles, frozen dancers), the bar lit. */
export function bridgeState(s: ClubState, f: Frame) {
  Object.assign(s, {
    floor: deadFloor(0.85), frozen: 1, alarm: 0.35, pars: 0.28, beams: 0, wallLight: 0.6, sign: 0.9,
    terms: 'logs', termT0: 14.6, ball: { angle: 0.3, lit: 0.3, sparkle: 0 }, records: { spin: f.t * 4.7, label: '/checkout' },
    boardStrings: 1, boardFocus: 1, boardRing: 1, boardLine: 1, boardCacheX: 1, boardPath: 1, boardRetarget: 1,
  });
}

/** Hold a prop upright in Clawd's right paw (the arm pivot's frame), like the chorus 2 cuffs. */
function pawProp(c: DiscoClawd, prop: THREE.Object3D) {
  const hold = new THREE.Group();
  hold.position.set(ARM_LEN + 0.02, 0, 0.07);
  hold.add(prop);
  c.paw.add(hold);
  return (on: boolean, armR: number, lean: number, size = 1) => {
    hold.visible = on && size > 0.01;
    hold.rotation.z = -armR - lean;
    hold.scale.setScalar(Math.max(0.01, size));
  };
}

export function bridgeShots(audio: AudioData, lyrics: LyricsData): Shot[] {
  const B = (i: number) => {
    if (!Number.isInteger(i)) throw new Error(`bridge: B(${i}) needs a whole beat; use BT for a fraction`);
    return audio.beats[i];
  };
  const BT = (b: number) => { const n = Math.floor(b); return lerp(B(n), B(n + 1), b - n); };
  const W = (n: number, i: number) => lyrics.lines[n - 1].words[i].start;
  const shots: Shot[] = [];

  // ---- at the bar ---------------------------------------------------------------------------
  // Clawd on a stool with his back to the counter, the Chief leaning on it with his coffee; the
  // little props go on the counter top between them.
  const STOOL = new THREE.Vector3(BAR.x - BAR.w / 2 + 1.2 + 2 * 1.7, 0, BAR.front + 0.9);   // the middle stool
  const CL_STOOL = new THREE.Vector3(STOOL.x, 0.81, STOOL.z + 0.1);    // body bottom on the seat
  const CH_BAR = new THREE.Vector3(STOOL.x - 2.8, 0, BAR.front + 1.05);
  // the dome stands in the gap between the Chief's elbow and Clawd's afro
  const DOME_AT = new THREE.Vector3(CH_BAR.x + 1.22, BAR.h, BAR.front - 0.3);
  const DOME_SCALE = 1.25;
  const MID = (CL_STOOL.x + CH_BAR.x) / 2;
  /** The bar two-shot, full length with room over their heads: k 0..1 a slow push in. */
  const barCam = (cam: THREE.PerspectiveCamera, k: number, x = 0) =>
    aimCam(cam, MID + 0.3 + x, lerp(1.85, 1.8, k), lerp(0.2, -0.8, k), MID + 0.15 + x * 0.5, lerp(1.72, 1.68, k), BAR.front);

  function barCast(scene: THREE.Scene) {
    const c = new DiscoClawd();
    c.root.position.copy(CL_STOOL);
    const ch = new Chief();
    ch.root.position.copy(CH_BAR);
    const dome = new DomeBomb();
    dome.root.position.copy(DOME_AT);
    dome.root.scale.setScalar(DOME_SCALE);
    scene.add(c.root, ch.root, dome.root);
    return { c, ch, dome };
  }

  // 49. "You're absolutely right there": the Chief says his piece (a wordless squiggle); Clawd nods
  //     like his life depends on it and answers in a bubble, word by word.
  const YOURE = W(49, 0), ABS = W(49, 1), RIGHT = W(49, 2), THERE = W(49, 3);
  let c49cam: THREE.PerspectiveCamera | null = null;
  shots.push(shot('br49-bar', B(294), BT(299.5), ({ scene, camera, club }) => {
    c49cam = camera;
    const { c, ch, dome } = barCast(scene);
    const spark = new Burst(PAL.gold, 12);
    scene.add(spark.root);
    return (f, s) => {
      barCam(camera, easeInOutCubic(f.p));
      bridgeState(s, f);
      s.crowdMask = i => club.dancers[i].x > -4;
      dome.set(f.t, -1, 0, 0);
      const b = f.clock.beat(f.t);
      // nods on every half beat from "You're", a big one on "right", then both paws out at him
      const nodding = f.t >= YOURE - 0.05;
      const nod = nodding ? Math.abs(Math.sin((b - 294.5) * Math.PI * 2)) : 0;
      const bigNod = decay(f.t - RIGHT, 0.12);
      const point = smooth(clamp((f.t - THERE + 0.05) / 0.15));
      c.set(nodding ? DISCO_MOODS.eager : DISCO_MOODS.focused, P({
        squash: 0.18 * nod + 0.3 * bigNod, lean: -0.06 * nod - 0.08 * point, armL: lerp(-0.3, 0.55, point), armR: lerp(-0.25 + 0.2 * nod, 0.35, point), bounce: 0.05 * nod,
      }), { shades: 1, jiggle: Math.sin(b * Math.PI * 4) * 0.6 * (nodding ? 1 : 0), puff: 0.3 + 0.4 * point }, f.t);
      spark.root.position.set(CL_STOOL.x + 0.95, CL_STOOL.y + 1.0, CL_STOOL.z + 0.3);
      spark.set(f.t - RIGHT, 0.55);
      // the Chief: talking (a bob), then listening, eyebrow up, and a sip on "there"
      const talking = f.t < YOURE;
      const sip = smooth(clamp((f.t - THERE) / 0.25));
      ch.set(cs({ bob: talking ? 0.03 * Math.abs(Math.sin(f.t * 14)) : 0, brow: talking ? 0.2 : lerp(0.2, 0.9, smooth(clamp((f.t - ABS) / 0.4))), look: 0.7, lean: -0.04, sip }), f.t);
    };
  }, {
    overlay(g, f) {
      if (!c49cam) return;
      c49cam.updateMatrixWorld();
      const chiefAt = screenAt(new THREE.Vector3(CH_BAR.x - 0.3, 2.5, CH_BAR.z), c49cam, f.w, f.h);
      drawTalk(g, f.t, f.h, chiefAt, { squiggle: { start: B(294) + 0.02, n: 3 }, until: ABS + 0.1, side: -1, size: 76 });
      // anchored at the top-left of the afro so the bubble opens over his head, inside the frame
      const clawdAt = screenAt(new THREE.Vector3(CL_STOOL.x - 0.6, CL_STOOL.y + 2.0, CL_STOOL.z), c49cam, f.w, f.h);
      drawTalk(g, f.t, f.h, clawdAt, {
        rows: [[{ text: "You're", start: YOURE }, { text: 'absolutely', start: ABS }], [{ text: 'right', start: RIGHT, color: PAL.gold }, { text: 'there!', start: THERE }]],
        until: BT(299.5) + 1, side: 1, size: 62,
      });
    },
  }));

  // 50. "That changes what we know": straight down on the counter. The Chief's hand slides a napkin
  //     in: his pen copy of the ticker's pair, prod's odd byte circled in red. He taps the circle;
  //     Clawd's magnifier slides over it.
  const THAT = W(50, 0), WHAT = W(50, 2), KNOW = W(50, 4);
  shots.push(shot('br50-napkin', BT(299.5), BT(302.5), ({ scene, camera }) => {
    const nap = new NapkinInsert();
    scene.add(nap.root);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), lightMat('#ffd9a8', 0.22, radialTexture()));
    glow.position.set(0.3, 0.2, 0.5);
    scene.add(glow);
    return (f) => {
      const k = easeInOutCubic(f.p);
      frameCam(camera, lerp(-0.15, 0.05, k), lerp(0.05, -0.12, k), lerp(2.6, 2.05, k));
      camera.rotation.z = 0.04;
      nap.set(f.t, clamp((f.t - THAT + 0.08) / 0.4), f.t - WHAT, clamp((f.t - KNOW + 0.04) / 0.32));
    };
  }, { club: false }));

  // 51. "The blast radius is bounded": close on the dome between them. The fuse fizzes, and on
  //     "blast" the bomb goes off: a flash and a puff of smoke, all of it inside the glass, which
  //     hops and rattles. On "radius" a line measures out to the glass; on "bounded" the rim lights
  //     green and the Chief taps it. Clawd flinched; the Chief didn't.
  const BLAST = W(51, 1), RADIUS = W(51, 2), BOUNDED = W(51, 4);
  shots.push(shot('br51-dome', BT(302.5), B(307), ({ scene, camera, club }) => {
    const { c, ch, dome } = barCast(scene);
    return (f, s) => {
      // close on the dome for the bang, then back to the two of them for "radius is bounded"
      const back = easeInOutCubic(clamp((f.t - (BLAST + 0.35)) / 0.7));
      const cx = lerp(DOME_AT.x + 0.05, MID + 0.25, back);
      aimCam(camera, cx, lerp(1.95, 1.85, back), lerp(DOME_AT.z + 2.3, DOME_AT.z + 6.4, back), lerp(DOME_AT.x + 0.05, MID + 0.15, back), lerp(1.58, 1.66, back), DOME_AT.z);
      shake(camera, f, BLAST, 0.05, 0.15);
      bridgeState(s, f);
      s.crowdMask = i => club.dancers[i].x > -4;
      const boom = f.t - BLAST;
      dome.set(f.t, boom, easeOutCubic(clamp((f.t - RADIUS) / 0.35)), clamp((f.t - BOUNDED) / 0.15), f.t - (BOUNDED + 0.05));
      // Clawd jumps out of his skin (shades up into the afro), then grins
      const jump = boom >= 0 ? decay(boom, 0.25) : 0;
      const calm = smooth(clamp((boom - 0.6) / 0.4));
      c.set(boom < 0 ? DISCO_MOODS.focused : calm < 0.5 ? DISCO_MOODS.baffled : DISCO_MOODS.excited, P({
        squash: -0.35 * jump, bounce: 0.25 * jump, armL: lerp(-0.2, 1.3, jump * (1 - calm)) + 0.3 * calm, armR: lerp(-0.2, 1.3, jump * (1 - calm)) + 0.3 * calm, lean: 0.05 * jump,
      }), { shades: boom < 0 ? 1 : lerp(0, 1, calm), puff: 0.2 + 0.6 * jump, jiggle: Math.sin(f.t * 30) * jump }, f.t);
      // the Chief: doesn't flinch; on "bounded" he reaches over and taps the glass
      const reach = smooth(clamp((f.t - (BOUNDED - 0.25)) / 0.2));
      ch.set(cs({ armR: lerp(0.12, 1.5, reach), point: reach > 0.5 ? 1 : 0, brow: 0.5 + 0.4 * jump, look: 0.9, sip: 0 }), f.t);
    };
  }));

  // 52. "At least the graphs say so": Clawd holds up a little graph (spike, then flat) and shrugs;
  //     the Chief sips his coffee, eyebrow up.
  const GRAPHS = W(52, 3), SAY = W(52, 4);
  shots.push(shot('br52-graph', B(307), BT(310.5), ({ scene, camera, club }) => {
    const { c, ch, dome } = barCast(scene);
    const gc = graphCard();
    gc.scale.setScalar(1.35);
    const card = pawProp(c, gc);
    return (f, s) => {
      barCam(camera, easeInOutCubic(f.p) * 0.6 + 0.4, -0.15);
      bridgeState(s, f);
      s.crowdMask = i => club.dancers[i].x > -4;
      dome.set(f.t, 9, 1, 1);
      const up = easeOutBack(clamp((f.t - (GRAPHS - 0.3)) / 0.25), 1.6);
      const shrug = smooth(clamp((f.t - SAY) / 0.18)) * (1 - smooth(clamp((f.t - (SAY + 0.75)) / 0.3)));
      const armR = lerp(-0.3, 0.42, up) + 0.2 * shrug;
      const lean = -0.1 * shrug;
      c.set(shrug > 0.3 ? DISCO_MOODS.sheepish : DISCO_MOODS.eager, P({ armR, armL: lerp(-0.3, 0.75, shrug), lean, squash: 0.12 * shrug, bounce: 0.05 * shrug }), { shades: 1, puff: 0.2 - 0.3 * shrug, jiggle: 0.3 * Math.sin(f.t * 12) * shrug }, f.t);
      card(up > 0.01, armR, lean, up);
      const sip = smooth(clamp((f.t - (B(307) + 0.1)) / 0.3)) * (1 - smooth(clamp((f.t - SAY) / 0.3)));
      ch.set(cs({ sip, brow: lerp(0.3, 1, smooth(clamp((f.t - SAY) / 0.25))), look: 0.8 }), f.t);
    };
  }));

  // ---- back on the floor ----------------------------------------------------------------------
  // 53. "I found the load-bearing seam now": a zip along a seam in the dead floor. He unzips it as
  //     he goes, and it opens on a pit of glowing wiring with a steel girder right across it. He
  //     peeks in, lit by it, then looks up at us.
  const SEAM_Z = FLOOR.z0 + 7 * FLOOR.tile;            // between tile rows 6 and 7
  const SEAM = new THREE.Vector3(-0.6, 0, SEAM_Z);
  const SEAM_LEN = 3.2;
  const FOUND = W(53, 1), LOAD = W(53, 3), SEAM_W = W(53, 4), NOW = W(53, 5);
  const unzip = (t: number) => easeInOutCubic(clamp((t - LOAD + 0.05) / (SEAM_W - LOAD + 0.15)));
  shots.push(shot('br53-seam', BT(310.5), BT(315.5), ({ scene, camera, club }) => {
    const seam = new FloorSeam(SEAM_LEN, 0.66);
    seam.root.position.copy(SEAM);
    const c = new DiscoClawd();
    scene.add(seam.root, c.root);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, SEAM.x + lerp(0.4, 0.3, k), lerp(2.9, 2.6, k), SEAM.z + lerp(5.2, 4.4, k), SEAM.x + 0.1, lerp(0.85, 0.75, k), SEAM.z - 0.5);
      bridgeState(s, f);
      s.crowdMask = i => !(club.dancers[i].z > SEAM.z - 2.5 && Math.abs(club.dancers[i].x - SEAM.x) < 3.4);
      const o = unzip(f.t);
      const glow = 0.5 + 0.8 * smooth(clamp((f.t - SEAM_W) / 0.2)) + 0.15 * Math.sin(f.t * 6);
      seam.set(f.t, o, glow);
      // he walks the pull along from the left end, bent over it, then leans in to look
      const pullX = SEAM.x - SEAM_LEN / 2 + o * SEAM_LEN;
      const grab = smooth(clamp((f.t - (FOUND - 0.15)) / 0.2));
      const peek = smooth(clamp((f.t - (SEAM_W + 0.05)) / 0.2));
      const look = smooth(clamp((f.t - NOW) / 0.2));
      const walking = o > 0.02 && o < 0.98;
      c.root.position.set(lerp(SEAM.x - SEAM_LEN / 2 - 0.8, pullX - 0.15, grab) + 0.25 * peek, 0, SEAM.z - 0.75);
      c.set(look > 0.5 ? DISCO_MOODS.eager : peek > 0.5 ? DISCO_MOODS.excited : DISCO_MOODS.focused, P({
        armR: lerp(0.2, -0.95, grab) + 0.6 * look, armL: lerp(0.2, -0.4, grab) - 0.2 * peek + 0.7 * look, lean: lerp(0, -0.22, grab) - 0.12 * peek * (1 - look), squash: 0.22 * grab * (1 - look),
        walk: walking ? f.t * 1.6 : 0,
      }), { shades: look > 0.5 ? 0 : 1, puff: 0.3 + 0.4 * peek, rimL: PAL.pink, rimR: PAL.cyan, rim: 1 + 0.6 * peek }, f.t);
    };
  }));

  // 54. "The happy path is clean": a path of tiles lights up in rainbow colours across the dead
  //     floor, flowers pop up along it and a smiling sun sticker slaps down at the end. Clawd skips
  //     down it, and on "clean" it sparkles.
  const PATH_TILES: [number, number][] = [[2, 9], [3, 9], [4, 8], [5, 8], [6, 7], [7, 7], [8, 6], [9, 6], [10, 5], [11, 5], [11, 4], [12, 3]];
  const RAINBOW = ['#ff3240', '#ff7a3d', '#ffc23d', '#45ff8a', '#2fe2ff', '#a35cff', '#ff3ea5'];
  const HAPPY = W(54, 1), PATH = W(54, 2), CLEAN = W(54, 4);
  const pathAt = PATH_TILES.map(([ix, iz]) => tileCenter(ix, iz));
  const pathCurve = new THREE.CatmullRomCurve3(pathAt.map(p => p.clone()), false, 'centripetal');
  const lightAt = (i: number) => HAPPY - 0.12 + i * 0.045;
  const happyFloor = (): Painter => {
    const dead = deadFloor(0.85);
    return (ix, iz, f) => {
      const i = PATH_TILES.findIndex(([a, b]) => a === ix && b === iz);
      if (i < 0 || f.t < lightAt(i)) return dead(ix, iz, f);
      const pop = decay(f.t - lightAt(i), 0.15);
      const shine = f.t > CLEAN ? 0.25 * Math.max(0, Math.sin((f.t - CLEAN) * 9 - i * 0.6)) * decay(f.t - CLEAN - i * 0.04, 0.5) : 0;
      return { color: RAINBOW[i % RAINBOW.length], power: 1.35 + 0.5 * pop + shine };
    };
  };
  shots.push(shot('br54-happy', BT(315.5), B(319), ({ scene, camera, club }) => {
    const flowers: { g: THREE.Group; at: number }[] = [];
    const cols = [PAL.pink, '#ffffff', PAL.cyan, PAL.violetNeon, '#ff7a3d'];
    pathAt.forEach((p, i) => {
      if (i === pathAt.length - 1) return;
      for (const side of [-1, 1]) {
        const g = flower(cols[(i * 2 + (side > 0 ? 1 : 0)) % cols.length], i);
        const nx = pathAt[Math.min(i + 1, pathAt.length - 1)].clone().sub(p).normalize();
        g.position.set(p.x - nx.z * side * 0.62 + (hash(i, side, 3) - 0.5) * 0.2, 0, p.z + nx.x * side * 0.62);
        scene.add(g);
        flowers.push({ g, at: PATH + i * 0.035 + (side > 0 ? 0.05 : 0) });
      }
    });
    const sun = sunSticker();
    const end = pathAt[pathAt.length - 1];
    sun.position.set(end.x, 0.012, end.z);
    const glints = [0, 1, 2, 3, 4].map(() => glint());
    glints.forEach(gl => scene.add(gl));
    const c = new DiscoClawd();
    scene.add(sun, c.root);
    const p = new THREE.Vector3();
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      // follows him from the start of the path to the sun at the far end
      aimCam(camera, lerp(-6.2, -3.6, k), 5.2, lerp(8.8, 7.6, k), lerp(-1.6, 2.0, k), lerp(0.6, 0.5, k), lerp(-0.4, -2.0, k));
      bridgeState(s, f);
      s.floor = happyFloor();
      s.crowdMask = i => !PATH_TILES.some(([ix, iz]) => { const q = tileCenter(ix, iz); return Math.hypot(q.x - club.dancers[i].x, q.z - club.dancers[i].z) < 1.3; }) && club.dancers[i].z < 1.0;
      flowers.forEach(({ g, at }) => {
        const up = f.t < at ? 0 : easeOutBack(clamp((f.t - at) / 0.22), 2.4);
        g.visible = up > 0.01;
        g.scale.setScalar(Math.max(0.01, up) * 1.15);
        g.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.12 * Math.sin(f.t * 4 + at * 9)));
      });
      // the sticker slaps down on "clean" (a touch big, settling)
      const slap = f.t < CLEAN - 0.1 ? 0 : clamp((f.t - CLEAN + 0.1) / 0.12);
      sun.visible = slap > 0;
      sun.scale.setScalar(lerp(1.5, 1, easeOutCubic(slap)) * (1 + 0.05 * Math.sin(f.t * 5)));
      sun.rotation.y = lerp(0.6, 0.15, easeOutCubic(slap));
      glints.forEach((gl, i) => {
        const at = CLEAN + i * 0.09;
        const a = f.t - at;
        gl.visible = a > 0 && a < 0.45;
        const q = pathAt[2 + i * 2];
        gl.position.set(q.x + 0.2, 0.35 + 0.1 * (i % 2), q.z);
        gl.quaternion.copy(camera.quaternion);
        gl.scale.setScalar(Math.sin(clamp(a / 0.45) * Math.PI) * 1.2);
      });
      // Clawd skips down the path, a hop on every half beat, happy as anything
      const b = f.clock.beat(f.t);
      const u = clamp((f.t - (HAPPY - 0.1)) / (B(319) - HAPPY + 0.05));
      pathCurve.getPointAt(easeInOutCubic(u) * 0.92, p);
      const hop = Math.abs(Math.sin(b * Math.PI * 2));
      c.root.position.set(p.x, hop * 0.22, p.z);
      c.set(DISCO_MOODS.excited, P({ armL: 0.5 + 0.6 * Math.sin(b * Math.PI * 2), armR: 0.5 - 0.6 * Math.sin(b * Math.PI * 2), squash: 0.25 * decay(1 - hop, 0.15), lean: 0.1 * Math.sin(b * Math.PI), walk: b * 0.5, turn: 0 }), { shades: 0, puff: 0.5, jiggle: Math.cos(b * Math.PI * 2) }, f.t);
    };
  }));

  // 55. "I run the regression suite once more": the booth. Clawd slams the big red RUN button and
  //     every terminal fills with test names going green; on "more" they all say so at once.
  const RUN = W(55, 1), MORE = W(55, 6);
  const BUTTON = new THREE.Vector3(0.95, RISER.h + CONSOLE.h, CONSOLE.front - 0.2);
  shots.push(shot('br55-run', B(319), BT(324.5), ({ scene, camera }) => {
    const c = new DiscoClawd();
    c.root.position.copy(BOOTH_SPOT);
    const btn = new RunButton();
    btn.root.position.copy(BUTTON);
    btn.root.scale.setScalar(1.15);
    scene.add(c.root, btn.root);
    return (f, s) => {
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(1.7, 1.3, k), lerp(2.0, 2.1, k), lerp(-4.4, -5.0, k), 0.3, lerp(1.95, 2.05, k), -9.2);
      shake(camera, f, RUN, 0.06, 0.18);
      bridgeState(s, f);
      s.crowdMask = clearBooth;
      if (f.t >= RUN) { s.terms = 'tests'; s.termT0 = RUN; s.termSync = clamp((f.t - MORE) / 0.2); }
      btn.set(f.t, f.t - RUN);
      // wind up (paw high), slam on "run", then watch the screens, sweating, paws together
      const wind = smooth(clamp((f.t - (RUN - 0.25)) / 0.15));
      const hit = f.t >= RUN;
      const after = f.t - RUN;
      const relief = smooth(clamp((f.t - MORE) / 0.25));
      const armR = hit ? lerp(-0.55, 0.3, smooth(clamp((after - 0.25) / 0.3))) + 0.8 * relief : lerp(0.2, 1.45, wind);
      c.set(relief > 0.5 ? DISCO_MOODS.excited : hit ? DISCO_MOODS.stressed : DISCO_MOODS.certain, P({
        armR, armL: hit ? lerp(-0.2, 0.25, smooth(clamp((after - 0.25) / 0.3))) + 0.9 * relief : -0.3, lean: hit ? 0.12 * decay(after, 0.2) : -0.08 * wind,
        squash: hit ? 0.3 * decay(after, 0.1) : 0, bounce: 0.12 * relief * Math.abs(Math.sin(f.clock.beat(f.t) * Math.PI)),
      }), { shades: 1, puff: 0.3 + 0.5 * relief, jiggle: hit ? Math.sin(after * 30) * decay(after, 0.25) : 0 }, f.t);
    };
  }));

  // 56. "And everything stays green": the middle of the dead floor. He stamps, crouches, and on
  //     "green" a wave of green rolls out from his feet to the walls, every tile, red ones and all.
  //     He dances on it as the camera cranes up over the whole green floor.
  const CL_GREEN = new THREE.Vector3(0, 0, -2.6);
  const STAYS = W(56, 2), GREEN = W(56, 3);
  const greenFloor = (): Painter => {
    const dead = deadFloor(0.85);
    return (ix, iz, f) => {
      const d = Math.hypot(ix - 6.5, iz - 4.9);
      const front = (f.t - GREEN) * 11;
      if (f.t < GREEN || d > front) return dead(ix, iz, f);
      const edge = decay(front - d, 0.9);
      const b = f.clock.beat(f.t), ph = b - Math.floor(b);
      return { color: edge > 0.5 ? '#c8ffd9' : PAL.green, power: 1.15 + 0.6 * edge + 0.18 * Math.exp(-ph * 4) * (0.6 + 0.4 * hash(ix, iz, 5)) };
    };
  };
  shots.push(shot('br56-green', BT(324.5), BT(334.5), ({ scene, camera, club }) => {
    const c = new DiscoClawd();
    c.root.position.copy(CL_GREEN);
    const pool = lightPool(1.4, '#c8ffd9', 0);
    pool.position.set(CL_GREEN.x, 0.03, CL_GREEN.z);
    const ring = new Burst(PAL.green, 16);
    ring.root.position.set(CL_GREEN.x, 0.1, CL_GREEN.z);
    ring.root.rotation.x = -Math.PI / 2;
    scene.add(c.root, pool, ring.root);
    return (f, s) => {
      // medium on him, then up and back over the floor as the green spreads
      const up = easeInOutCubic(clamp((f.t - GREEN + 0.1) / 1.9));
      const drift = (f.t - GREEN) * 0.08;
      aimCam(camera, lerp(0.4, 0.2, up) + Math.max(0, drift) * 0.5, lerp(1.6, 8.8, up), lerp(CL_GREEN.z + 4.3, 7.4, up), 0, lerp(1.15, 0.0, up), lerp(CL_GREEN.z, -3.4, up));
      camera.fov = lerp(40, 44, up);
      camera.updateProjectionMatrix();
      shake(camera, f, GREEN, 0.07, 0.2);
      bridgeState(s, f);
      s.floor = greenFloor();
      s.crowdMask = i => Math.hypot(club.dancers[i].x - CL_GREEN.x, club.dancers[i].z - CL_GREEN.z) > 1.6;
      // the ball wakes up a little as the build comes to a head
      s.ball = { angle: 0.3 + Math.max(0, f.t - B(330)) * 0.3, lit: lerp(0.3, 0.7, smooth(clamp((f.t - B(330)) / 1.5))), sparkle: 0.3 * smooth(clamp((f.t - B(332)) / 1)) };
      const pk = (pool.material as THREE.MeshBasicMaterial);
      pk.opacity = 0.5 * decay(f.t - GREEN, 0.5);
      ring.set(f.t - GREEN, 3.2);
      const b = f.clock.beat(f.t);
      // stamp on "And", crouch on "stays", spring up on "green", then dance
      const stamp = decay(f.t - W(56, 0), 0.12);
      const crouch = smooth(clamp((f.t - STAYS) / 0.25)) * (1 - smooth(clamp((f.t - GREEN) / 0.08)));
      const spring = f.t >= GREEN ? decay(f.t - GREEN, 0.3) : 0;
      const dancing = smooth(clamp((f.t - GREEN - 0.5) / 0.4));
      const dn = dance('point', b, dancing);
      c.root.position.set(CL_GREEN.x + dn.x, Math.max(0, Math.sin(clamp((f.t - GREEN) / 0.35) * Math.PI)) * 0.45, CL_GREEN.z);
      c.set(f.t >= GREEN ? DISCO_MOODS.triumphant : DISCO_MOODS.certain, P({
        ...dn.pose, squash: 0.3 * stamp + 0.45 * crouch - 0.3 * spring + dn.pose.squash, armL: lerp(lerp(0.3, -0.5, crouch), 1.3, spring) * (1 - dancing) + dn.pose.armL * dancing,
        armR: lerp(lerp(0.3, -0.5, crouch), 1.3, spring) * (1 - dancing) + dn.pose.armR * dancing,
      }), { shades: 1, puff: 0.4 + 0.6 * spring + 0.3 * dancing, jiggle: dn.jiggle * dancing + Math.sin(f.t * 30) * spring * 0.5, rimR: f.t >= GREEN ? PAL.green : PAL.cyan }, f.t);
    };
  }, { fov: 40 }));

  return shots;
}
