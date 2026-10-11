// The shared set for "I'm Just Here to Help": a desk, a monitor and the chat screen Clawd lives in.
// Every shot builds its own copy (shots never share objects), then adds its own props.
//
// Units: the monitor's screen is 16 x 9, centred on the origin at z = 0. Inside the screen,
// Clawd (about 1.1 tall) stands on the chat area's floor at FLOOR_Y. The bezel is drawn in
// front of the screen contents, so anything that slides off the screen is masked by it.
import * as THREE from 'three';
import type { Frame, LyricStyle } from '../../engine/types';
import type { SongClock } from '../../engine/song';
import { INK, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { Clawd } from '../../engine/characters/clawd';
import { clamp } from '../../engine/ease';

export const FONT = '"Inter", system-ui, "Helvetica Neue", Arial, sans-serif';
export const MONO = '"DejaVu Sans Mono", "Liberation Mono", monospace';

export const PAL = {
  wall: '#f3e6d0',
  wallShade: '#e8d6bb',
  desk: '#dcb48c',
  deskFront: '#cfa47b',
  bezel: '#3b3a46',
  screen: '#fbf7f0',
  topBar: '#efe4d3',
  field: '#ffffff',
  sticky: '#ffe27a',
  red: '#e0504a',
  green: '#3fa66b',
  yes: '#8fd6a0',
  no: '#f2a09a',
  sun: '#ffd166',
  person: '#8fb3e0',
  personShade: '#7398c9',
  blush: '#ff8fa3',
};

export const SW = 16, SH = 9;
export const FLOOR_Y = -2.75;               // chat area floor (Clawd's feet)
export const FIELD = { x: 0, y: -3.6, w: 13, h: 1.05 }; // chat input field
export const BUBBLE = { x: 3.6, y: -0.4 };                // where the sent "begin" message sits

/** Light set, dark words: the karaoke style for daylight scenes. */
export const DAY_LYRICS: Partial<LyricStyle> = {
  font: FONT, weight: 800, color: INK, dim: 'rgba(43,29,22,0.32)', accent: '#c4573a', shadow: 'rgba(255,250,240,0.95)',
};

/** Post for the flat look: no bloom, exact palette. */
export const FLAT_POST = { bloom: 0, grain: 0.02, vignette: 0.1, toneMap: false } as const;

/** Text label on a transparent plane, centred. */
export function label(text: string, w: number, h: number, opts: { color?: string; font?: string; weight?: number; size?: number; align?: CanvasTextAlign } = {}) {
  const ppu = 160;
  return staticPlane(w, h, ppu, (g, W, H) => {
    const size = (opts.size ?? h * 0.7) * ppu;
    g.font = `${opts.weight ?? 800} ${size}px ${opts.font ?? FONT}`;
    g.fillStyle = opts.color ?? INK;
    g.textAlign = opts.align ?? 'center';
    g.textBaseline = 'middle';
    const x = opts.align === 'left' ? size * 0.2 : opts.align === 'right' ? W - size * 0.2 : W / 2;
    g.fillText(text, x, H / 2 + size * 0.04);
  });
}

/** A chunky block with a word on it (letter tiles, YES / NO). Origin at the block's bottom centre. */
export function wordBlock(text: string, fill: string, w: number, h: number, textColor = INK) {
  const g = new THREE.Group();
  const box = inkedRect(w, h, 0.02, fill, 0.06);
  box.position.y = h / 2;
  const shade = shapeMesh(roundedRectShape(w, h * 0.18, 0.01, 0, h * 0.09), ownMat(new THREE.Color(fill).multiplyScalar(0.85)), 0.004);
  const t = label(text, w, h, { color: textColor, size: h * 0.62 });
  t.position.set(0, h / 2 + h * 0.04, 0.01);
  g.add(box, shade, t);
  return g;
}

/** Camera helper: a straight-on view centred on (x, y) showing `height` world units vertically. */
export function frameCam(cam: THREE.PerspectiveCamera, x: number, y: number, height: number, zTarget = 0) {
  const d = height / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(x, y, zTarget + d);
  cam.lookAt(x, y, zTarget);
}

/** A beat-locked hop, 0..1, for idle bouncing. Zero before the beat grid starts. */
export function beatHop(clock: SongClock, t: number, every = 1) {
  const b = clock.beat(t) / every;
  if (b < 0) return 0;
  return Math.sin((b - Math.floor(b)) * Math.PI);
}

/** A hop from a to b between times t0 and t1: returns x, y offset and the 0..1 progress. */
export function hop(t: number, t0: number, t1: number, a: number, b: number, height: number) {
  const k = clamp((t - t0) / (t1 - t0));
  return { x: a + (b - a) * k, y: Math.sin(k * Math.PI) * height, k };
}

/** A faceless capsule person, side-on. Origin at the seat. Call pose() every frame. */
export function person(color = PAL.person, shade = PAL.personShade) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const torso = inkedRect(2.2, 3.6, 1.1, ownMat(color), 0.08);
  torso.position.y = 1.8;
  const band = shapeMesh(roundedRectShape(2.2, 1.1, 0.5, 0, 0.55 + 0.02), ownMat(shade), 0.004);
  const head = inkedCircle(1.05, ownMat(color), 0.08);
  head.position.set(0, 4.55, 0);
  body.add(torso, band, head);
  // forearm with a thumb, pivoting at the shoulder
  const arm = new THREE.Group();
  arm.position.set(-0.2, 2.9, 0.05);
  const fore = inkedRect(2.6, 0.6, 0.3, ownMat(color), 0.08);
  fore.position.x = -1.3;
  const fist = inkedCircle(0.45, ownMat(color), 0.08);
  fist.position.set(-2.65, 0, 0.01);
  const thumb = inkedRect(0.34, 0.85, 0.16, ownMat(color), 0.07);
  thumb.position.set(-2.65, 0.6, 0.005);
  arm.add(fore, fist, thumb);
  body.add(arm);
  root.add(body);
  return {
    root,
    /** raise: 0 = arm resting forward, 1 = thumbs up held high. thumb: 0..1 thumb shows. */
    pose(raise: number, thumbK: number, bob = 0) {
      arm.rotation.z = -0.3 - raise * 0.45;
      thumb.visible = thumbK > 0.05;
      thumb.scale.y = Math.max(0.01, thumbK);
      body.position.y = bob * 0.15;
      body.rotation.z = -raise * 0.06;
    },
  };
}

/** The smiley sun that rises behind the monitor in verse 1. */
export function smileySun(r = 3.6) {
  const g = new THREE.Group();
  const rays = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const ray = inkedRect(0.7, 1.5, 0.05, PAL.sun, 0.07);
    const a = (i / 12) * Math.PI * 2;
    ray.position.set(Math.cos(a) * (r + 1.0), Math.sin(a) * (r + 1.0), -0.02);
    ray.rotation.z = a - Math.PI / 2;
    rays.add(ray);
  }
  const disc = inkedCircle(r, PAL.sun, 0.1);
  const face = new THREE.Group();
  for (const s of [-1, 1]) {
    const eye = shapeMesh(roundedRectShape(0.42, 0.75, 0.04, s * 1.2, 0.6), INK, 0.01);
    face.add(eye);
  }
  const smile = new THREE.Shape(); // a blocky U
  smile.moveTo(-1.6, -0.5); smile.lineTo(-1.2, -0.5); smile.lineTo(-1.0, -1.2); smile.lineTo(1.0, -1.2);
  smile.lineTo(1.2, -0.5); smile.lineTo(1.6, -0.5); smile.lineTo(1.3, -1.6); smile.lineTo(-1.3, -1.6); smile.closePath();
  face.add(shapeMesh(smile, INK, 0.01));
  g.add(rays, disc, face);
  return Object.assign(g, { rays, face });
}

export interface DeskSet {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clawd: Clawd;
  screen: THREE.Group;        // everything inside the monitor; add in-screen props here
  field: THREE.Group;         // the chat input field (in front of Clawd, z = 0.45)
  bubble: THREE.Group;        // the user's "begin" message bubble
  person: ReturnType<typeof person>;
  sun: ReturnType<typeof smileySun>;
  /** Text in the input field, whether the cursor shows, and whether an empty field shows its hint. */
  setTyped(text: string, cursor: boolean, showHint?: boolean): void;
  /** Call first in update(): resets the shared set to its default state for this frame. */
  reset(f: Frame): void;
}

export function buildDesk(): DeskSet {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.wall);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 400);

  // room: wall with a soft lower band, the desk in front
  const wallBand = shapeMesh(roundedRectShape(400, 40, 0, 0, -30), PAL.wallShade, -3);
  scene.add(wallBand);
  const deskTop = inkedRect(70, 1.1, 0.05, PAL.desk, 0.1);
  deskTop.position.set(0, -7.75, 1.2);
  const deskFront = inkedRect(70, 30, 0.05, PAL.deskFront, 0.1);
  deskFront.position.set(0, -23.3, 1.19);
  scene.add(deskTop, deskFront);

  // monitor: back panel, neck and foot behind the screen; bezel strips in front mask the contents
  const back = inkedRect(SW + 1.2, SH + 1.2, 0.08, PAL.bezel, 0.12);
  back.position.z = -0.1;
  const neck = inkedRect(1.6, 2.2, 0.02, PAL.bezel, 0.1);
  neck.position.set(0, -5.6, -0.2);
  const foot = inkedRect(5.5, 0.5, 0.05, PAL.bezel, 0.1);
  foot.position.set(0, -6.95, -0.15);
  scene.add(back, neck, foot);
  const bz = ownMat(PAL.bezel), b = 0.6;
  for (const [w, h, x, y] of [[SW + 2 * b, b, 0, SH / 2 + b / 2], [SW + 2 * b, b + 3, 0, -SH / 2 - (b + 3) / 2], [b, SH, -SW / 2 - b / 2, 0], [b, SH, SW / 2 + b / 2, 0]]) {
    const s = shapeMesh(roundedRectShape(w, h, 0, x, y), bz, 0.8);
    scene.add(s);
  }
  // the bottom strip above hides things below the screen; re-draw the neck in front of it
  const neckFront = shapeMesh(roundedRectShape(1.6, 1.6, 0, 0, -5.3), bz, 0.81);
  scene.add(neckFront);
  // ink edge around the screen opening
  for (const [w, h, x, y] of [[SW + 0.12, 0.06, 0, SH / 2], [SW + 0.12, 0.06, 0, -SH / 2], [0.06, SH, -SW / 2, 0], [0.06, SH, SW / 2, 0]]) {
    scene.add(shapeMesh(roundedRectShape(w, h, 0, x, y), INK, 0.82));
  }
  // power light
  const led = shapeMesh(circleShape(0.09), '#7be08d', 0.83);
  led.position.set(SW / 2 - 0.4, -SH / 2 - 0.3, 0);
  scene.add(led);

  // screen contents
  const screen = new THREE.Group();
  scene.add(screen);
  const ui = staticPlane(SW, SH, 90, (g, W, H) => {
    const u = W / SW;
    g.fillStyle = PAL.screen; g.fillRect(0, 0, W, H);
    g.fillStyle = PAL.topBar; g.fillRect(0, 0, W, 0.7 * u);
    g.fillStyle = 'rgba(43,29,22,0.15)'; g.fillRect(0, 0.7 * u, W, 0.04 * u);
    ['#e0504a', '#f2b84b', '#5cb85c'].forEach((c, i) => {
      g.fillStyle = c; g.beginPath(); g.arc((0.45 + i * 0.4) * u, 0.35 * u, 0.12 * u, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = 'rgba(43,29,22,0.55)'; g.font = `700 ${0.3 * u}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('New chat', W / 2, 0.37 * u);
    // floor of the chat area: a thin divider above the input
    g.fillStyle = 'rgba(43,29,22,0.18)';
    g.fillRect(0.5 * u, (SH / 2 - FLOOR_Y) * u, W - u, 0.05 * u);
  });
  screen.add(ui);

  const clawd = new Clawd();
  clawd.root.position.set(0, FLOOR_Y, 0.2);
  screen.add(clawd.root);

  const field = new THREE.Group();
  field.position.set(FIELD.x, FIELD.y, 0.45);
  const fbox = inkedRect(FIELD.w, FIELD.h, 0.04, PAL.field, 0.06);
  field.add(fbox);
  let typed = '', cursorOn = true, hint = true;
  const typedPlane = canvasPlane(FIELD.w - 0.6, FIELD.h * 0.8, 100, (g, _f: null, W, H) => {
    g.font = `600 ${H * 0.5}px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillStyle = typed ? INK : 'rgba(43,29,22,0.35)';
    if (typed || hint) g.fillText(typed || 'Type a message…', H * 0.15, H / 2);
    if (cursorOn) {
      const x = typed ? g.measureText(typed).width + H * 0.2 : H * 0.12;
      g.fillStyle = INK; g.fillRect(x, H * 0.2, H * 0.06, H * 0.6);
    }
  });
  typedPlane.mesh.position.z = 0.01;
  field.add(typedPlane.mesh);
  const send = inkedRect(0.75, 0.75, 0.04, '#d97757', 0.05);
  send.position.set(FIELD.w / 2 - 0.6, 0, 0.012);
  const arrow = label('↑', 0.75, 0.75, { color: '#ffffff', size: 0.55 });
  arrow.position.set(FIELD.w / 2 - 0.6, 0, 0.02);
  field.add(send, arrow);
  screen.add(field);

  const bubble = new THREE.Group();
  const bbox = inkedRect(1.9, 0.75, 0.04, '#e9dfd0', 0.05);
  const btxt = label('begin', 1.9, 0.75, { size: 0.36, weight: 600 });
  btxt.position.z = 0.01;
  bubble.add(bbox, btxt);
  bubble.position.set(SW / 2 - 1.6, SH / 2 - 1.5, 0.1);
  screen.add(bubble);

  const p = person();
  p.root.position.set(13.5, -8.4, 0.6);
  p.root.scale.setScalar(1.6);
  scene.add(p.root);

  const sun = smileySun();
  sun.position.set(0, -12, -1);
  scene.add(sun);

  let lastKey = '';
  return {
    scene, camera, clawd, screen, field, bubble, person: p, sun,
    setTyped(text, cursor, showHint = false) {
      const key = `${text}|${cursor}|${showHint}`;
      if (key === lastKey) return; // redraw only when the content changes
      typed = text; cursorOn = cursor; hint = showHint; lastKey = key;
      typedPlane.update(null);
    },
    reset() {
      this.setTyped('', false);
      bubble.visible = false;
      bubble.position.set(BUBBLE.x, BUBBLE.y, 0.1);
      bubble.scale.setScalar(1);
      field.visible = true;
      sun.position.set(0, -12, -1);
      p.pose(0, 0);
      clawd.root.position.set(0, FLOOR_Y, 0.2);
      clawd.root.rotation.set(0, 0, 0);
      clawd.root.scale.set(1, 1, 1);
      clawd.root.visible = true;
    },
  };
}
