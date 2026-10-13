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
import { hash } from '../../engine/rng';

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
export const SIDEBAR = 3;                   // the chat-history sidebar down the screen's left edge
export const TOPBAR = 0.7;                  // the window's title bar
export const CHAT_X = SIDEBAR / 2;          // centre of the chat column (right of the sidebar)
export const FLOOR_Y = -2.75;               // chat area floor (Clawd's feet)
export const FIELD = { x: CHAT_X, y: -3.6, w: 12, h: 1.05 }; // chat input field
export const BUBBLE = { x: 3.9, y: 0.25 };                   // where the sent "begin" message sits

/** Light set, dark words: the karaoke style for daylight scenes. */
export const DAY_LYRICS: Partial<LyricStyle> = {
  mode: 'kinetic', font: FONT, weight: 800, color: INK, dim: 'rgba(43,29,22,0.32)', accent: '#c4573a', shadow: 'rgba(255,250,240,0.95)',
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
export function person(color = PAL.person, shade = PAL.personShade, hairColor = '#4a3426') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const torso = inkedRect(2.2, 3.6, 1.1, ownMat(color), 0.08);
  torso.position.y = 1.8;
  const band = shapeMesh(roundedRectShape(2.2, 1.1, 0.5, 0, 0.55 + 0.02), ownMat(shade), 0.004);
  // each layer sits clear of the one below (z steps of 0.006 or more), or overlaps flicker
  const head = inkedCircle(1.05, ownMat(color), 0.08);
  head.position.set(0, 4.55, 0.01);
  // hair cap toward the back of the head, and a sweater collar
  const hair = new THREE.Shape();
  hair.absarc(0, 0, 1.05, Math.PI * 0.15, Math.PI * 1.05, false); // over the top, inside the ink outline
  hair.lineTo(0.2, -0.1);
  hair.closePath();
  const hairMesh = shapeMesh(hair, hairColor);
  hairMesh.position.set(0, 4.55, 0.016);
  hairMesh.rotation.z = -0.35;
  const collar = inkedRect(1.6, 0.45, 0.2, '#f2efe8', 0.06);
  collar.position.set(-0.1, 3.45, 0.022);
  body.add(torso, band, head, hairMesh, collar);
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

// ---------------------------------------------------------------------------------------------
// The chat app's screen art: drawn once onto canvases. Coordinates in screen units (16 x 9).

const SIDE_CHATS: [string, string | null][] = [
  ['Today', null], ['New chat', '#d97757'], ['Poem for Mom', '#f2a6b4'], ['Fix my email', '#8fb3e0'], ['Birthday card', '#ffd166'],
  ['Yesterday', null], ['Cover letter', '#9fd0a8'], ['Soup recipe', '#e8a07a'], ['Wedding toast', '#c3a6e0'],
  ['Last week', null], ['Haiku about cats', '#e6c46f'], ['Thank-you note', '#86c5c9'],
];

/** One faint wallpaper doodle (star, heart, sparkle, speech bubble, squiggle, "Aa", pencil, "?", note). */
function doodle(g: CanvasRenderingContext2D, x: number, y: number, r: number, kind: number, rot: number) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.beginPath();
  const text = (t: string, size: number) => { g.font = `800 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0); };
  switch (kind) {
    case 0:
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.stroke(); break;
    case 1:
      g.moveTo(0, r * 0.8); g.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.35); g.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.8);
      g.stroke(); break;
    case 2:
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r; if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(rr, 0); }
      g.closePath(); g.fill(); break;
    case 3:
      g.roundRect(-r, -r * 0.7, r * 2, r * 1.2, r * 0.3); g.moveTo(-r * 0.4, r * 0.5); g.lineTo(-r * 0.7, r * 0.95); g.lineTo(-r * 0.05, r * 0.5); g.stroke();
      for (const dx of [-0.45, 0, 0.45]) { g.beginPath(); g.arc(dx * r, -r * 0.1, r * 0.1, 0, Math.PI * 2); g.fill(); }
      break;
    case 4:
      g.moveTo(-r, 0);
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(-r + (i + 0.5) * r * 0.5, (i % 2 ? 1 : -1) * r * 0.6, -r + (i + 1) * r * 0.5, 0);
      g.stroke(); break;
    case 5: text('Aa', r * 1.3); break;
    case 6:
      g.rect(-r, -r * 0.2, r * 1.4, r * 0.4); g.moveTo(r * 0.4, -r * 0.2); g.lineTo(r, 0); g.lineTo(r * 0.4, r * 0.2);
      g.moveTo(-r * 0.7, -r * 0.2); g.lineTo(-r * 0.7, r * 0.2); g.stroke(); break;
    case 7: text('?', r * 1.7); break;
    default: text('♪', r * 1.6);
  }
  g.restore();
}

function drawChatBg(g: CanvasRenderingContext2D, W: number, H: number) {
  const u = W / SW, X = (x: number) => (x + SW / 2) * u, Y = (y: number) => (SH / 2 - y) * u;
  g.fillStyle = PAL.screen; g.fillRect(0, 0, W, H);
  // a faint doodle wallpaper over the chat column (above the floor only)
  g.save();
  g.strokeStyle = INK; g.fillStyle = INK; g.globalAlpha = 0.08; g.lineWidth = 0.045 * u; g.lineCap = 'round'; g.lineJoin = 'round';
  const step = 1.2;
  let n = 0;
  for (let row = 0, gy = FLOOR_Y + 0.7; gy < SH / 2 - TOPBAR - 0.3; row++, gy += step) {
    for (let gx = -SW / 2 + SIDEBAR + 0.5 + (row % 2) * step * 0.5; gx < SW / 2 - 0.3; gx += step) {
      n++;
      const x = gx + (hash(n, 301) - 0.5) * 0.45, y = gy + (hash(n, 302) - 0.5) * 0.4;
      doodle(g, X(x), Y(y), (0.17 + hash(n, 303) * 0.07) * u, Math.floor(hash(n, 304) * 9), (hash(n, 305) - 0.5) * 0.9);
    }
  }
  g.restore();
  // the floor of the chat area: a divider above the input
  g.fillStyle = 'rgba(43,29,22,0.16)';
  g.fillRect(X(-SW / 2 + SIDEBAR + 0.3), Y(FLOOR_Y), (SW - SIDEBAR - 0.6) * u, 0.05 * u);
  // the small print under the input
  g.fillStyle = 'rgba(43,29,22,0.38)'; g.font = `600 ${0.16 * u}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Helper can make mistakes. Please double-check its work.', X(CHAT_X), Y(FIELD.y - FIELD.h / 2 - 0.19));
}

function drawSidebar(g: CanvasRenderingContext2D, W: number, H: number) {
  const u = W / SIDEBAR;
  g.fillStyle = '#f2e8d9'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(43,29,22,0.14)'; g.fillRect(W - 0.04 * u, 0, 0.04 * u, H);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  // new chat button
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(43,29,22,0.5)'; g.lineWidth = 0.035 * u;
  g.beginPath(); g.roundRect(0.25 * u, 0.28 * u, W - 0.5 * u, 0.56 * u, 0.14 * u); g.fill(); g.stroke();
  g.fillStyle = '#d97757'; g.font = `900 ${0.34 * u}px ${FONT}`; g.fillText('+', 0.42 * u, 0.56 * u);
  g.fillStyle = INK; g.font = `700 ${0.21 * u}px ${FONT}`; g.fillText('New chat', 0.78 * u, 0.57 * u);
  let y = 1.3;
  for (const [title, col] of SIDE_CHATS) {
    if (!col) {
      y += 0.1;
      g.fillStyle = 'rgba(43,29,22,0.42)'; g.font = `800 ${0.15 * u}px ${FONT}`;
      g.fillText(title.toUpperCase(), 0.3 * u, y * u);
      y += 0.44;
      continue;
    }
    if (title === 'New chat') { g.fillStyle = 'rgba(217,119,87,0.17)'; g.beginPath(); g.roundRect(0.16 * u, (y - 0.22) * u, W - 0.32 * u, 0.44 * u, 0.1 * u); g.fill(); }
    g.fillStyle = col; g.beginPath(); g.roundRect(0.3 * u, (y - 0.12) * u, 0.24 * u, 0.24 * u, 0.05 * u); g.fill();
    g.fillStyle = 'rgba(43,29,22,0.72)'; g.font = `600 ${0.19 * u}px ${FONT}`; g.fillText(title, 0.68 * u, y * u);
    y += 0.47;
  }
  // you, at the bottom
  g.fillStyle = 'rgba(43,29,22,0.12)'; g.fillRect(0.2 * u, H - 0.85 * u, W - 0.4 * u, 0.03 * u);
  g.fillStyle = PAL.person; g.beginPath(); g.arc(0.5 * u, H - 0.42 * u, 0.18 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK; g.font = `700 ${0.2 * u}px ${FONT}`; g.fillText('You', 0.82 * u, H - 0.42 * u);
}

function drawTopBar(g: CanvasRenderingContext2D, W: number, H: number) {
  const u = W / SW;
  g.fillStyle = PAL.topBar; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(43,29,22,0.15)'; g.fillRect(0, H - 0.04 * u, W, 0.04 * u);
  ['#e0504a', '#f2b84b', '#5cb85c'].forEach((c, i) => {
    g.fillStyle = c; g.beginPath(); g.arc((0.45 + i * 0.4) * u, 0.35 * u, 0.12 * u, 0, Math.PI * 2); g.fill();
  });
  // sidebar toggle
  g.strokeStyle = 'rgba(43,29,22,0.5)'; g.lineWidth = 0.04 * u;
  g.beginPath(); g.roundRect(1.8 * u, 0.22 * u, 0.38 * u, 0.28 * u, 0.05 * u); g.stroke();
  g.beginPath(); g.moveTo(1.93 * u, 0.22 * u); g.lineTo(1.93 * u, 0.5 * u); g.stroke();
  g.fillStyle = 'rgba(43,29,22,0.6)'; g.font = `700 ${0.27 * u}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('New chat', (CHAT_X + SW / 2) * u, 0.37 * u);
  // share button
  g.strokeStyle = 'rgba(43,29,22,0.4)'; g.lineWidth = 0.035 * u;
  g.beginPath(); g.roundRect((SW - 1.5) * u, 0.16 * u, 1.15 * u, 0.4 * u, 0.13 * u); g.stroke();
  g.font = `700 ${0.19 * u}px ${FONT}`; g.fillText('Share', (SW - 0.92) * u, 0.37 * u);
}

/** The whole chat app (title bar, sidebar, wallpaper and an empty input field) on one canvas, for
 *  monitors seen from across a room. Drawn at the canvas width; any spare height is screen colour. */
export function drawChatApp(g: CanvasRenderingContext2D, W: number, H: number) {
  const u = W / SW;
  g.fillStyle = PAL.screen; g.fillRect(0, 0, W, H);
  g.save(); drawChatBg(g, W, SH * u); g.restore();
  g.save(); g.translate(0, TOPBAR * u); drawSidebar(g, SIDEBAR * u, (SH - TOPBAR) * u); g.restore();
  g.save(); drawTopBar(g, W, TOPBAR * u); g.restore();
  const fx = (FIELD.x - FIELD.w / 2 + SW / 2) * u, fy = (SH / 2 - FIELD.y - FIELD.h / 2) * u;
  g.fillStyle = PAL.field; g.strokeStyle = INK; g.lineWidth = 0.06 * u;
  g.beginPath(); g.roundRect(fx, fy, FIELD.w * u, FIELD.h * u, 0.04 * u); g.fill(); g.stroke();
  g.fillStyle = '#f3eadc'; g.beginPath(); g.arc(fx + 0.55 * u, fy + (FIELD.h / 2) * u, 0.3 * u, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#d97757'; g.beginPath(); g.roundRect(fx + (FIELD.w - 0.98) * u, fy + 0.15 * u, 0.75 * u, 0.75 * u, 0.04 * u); g.fill(); g.stroke();
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
  /** The chat app's layers: background with the doodle wallpaper, the sidebar, the title bar. */
  ui: { bg: THREE.Mesh; side: THREE.Mesh; top: THREE.Mesh };
  /** Text in the input field, whether the cursor shows, and whether an empty field shows its hint. */
  setTyped(text: string, cursor: boolean, showHint?: boolean): void;
  /** Call first in update(): resets the shared set to its default state for this frame.
   *  dawn runs the window sky from night (0) through sunrise to full day (1, the default). */
  reset(f: Frame, dawn?: number): void;
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

  // screen contents: the chat app, in three layers so the boot-up can assemble it
  const screen = new THREE.Group();
  scene.add(screen);
  const bg = staticPlane(SW, SH, 150, drawChatBg);
  const side = staticPlane(SIDEBAR, SH - TOPBAR, 150, drawSidebar);
  side.position.set(-SW / 2 + SIDEBAR / 2, -TOPBAR / 2, 0.01);
  const top = staticPlane(SW, TOPBAR, 150, drawTopBar);
  top.position.set(0, SH / 2 - TOPBAR / 2, 0.02);
  screen.add(bg, side, top);

  const clawd = new Clawd();
  clawd.root.position.set(0, FLOOR_Y, 0.2);
  screen.add(clawd.root);

  const field = new THREE.Group();
  field.position.set(FIELD.x, FIELD.y, 0.45);
  const fbox = inkedRect(FIELD.w, FIELD.h, 0.04, PAL.field, 0.06);
  field.add(fbox);
  let typed = '', cursorOn = true, hint = true;
  const typedPlane = canvasPlane(FIELD.w - 2.4, FIELD.h * 0.8, 220, (g, _f: null, W, H) => {
    g.font = `600 ${H * 0.5}px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillStyle = typed ? INK : 'rgba(43,29,22,0.35)';
    if (typed || hint) g.fillText(typed || 'Type a message…', H * 0.15, H / 2);
    if (cursorOn) {
      const x = typed ? g.measureText(typed).width + H * 0.2 : H * 0.12;
      g.fillStyle = INK; g.fillRect(x, H * 0.2, H * 0.06, H * 0.6);
    }
  });
  typedPlane.mesh.position.set(0.15, 0, 0.01);
  field.add(typedPlane.mesh);
  const attach = inkedCircle(0.3, '#f3eadc', 0.035);
  attach.position.set(-FIELD.w / 2 + 0.55, 0, 0.012);
  const plus = label('+', 0.6, 0.6, { size: 0.5, color: 'rgba(43,29,22,0.6)', weight: 700 });
  plus.position.set(-FIELD.w / 2 + 0.55, 0.01, 0.02);
  field.add(attach, plus);
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

  const room = buildRoom(scene);

  const sun = smileySun();
  sun.position.set(0, -12, -1);
  scene.add(sun);

  let lastKey = '';
  return {
    scene, camera, clawd, screen, field, bubble, person: p, sun, ui: { bg, side, top },
    setTyped(text, cursor, showHint = false) {
      const key = `${text}|${cursor}|${showHint}`;
      if (key === lastKey) return; // redraw only when the content changes
      typed = text; cursorOn = cursor; hint = showHint; lastKey = key;
      typedPlane.update(null);
    },
    reset(f, dawn = 1) {
      room(f, dawn);
      side.position.set(-SW / 2 + SIDEBAR / 2, -TOPBAR / 2, 0.01);
      top.position.set(0, SH / 2 - TOPBAR / 2, 0.02);
      side.scale.setScalar(1); top.scale.setScalar(1);
      for (const m of [bg, side, top]) { m.visible = true; (m.material as THREE.MeshBasicMaterial).opacity = 1; }
      field.position.set(FIELD.x, FIELD.y, 0.45);
      field.scale.setScalar(1);
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

/**
 * Set dressing for the room around the desk: window with sky and curtains, wall clock, shelf,
 * framed picture, desk lamp, mug, keyboard, plant, chair and drawers. Returns update(f) for the
 * small moving details (clouds, a bird, steam, clock hands, plant and curtain sway).
 */
export function buildRoom(scene: THREE.Scene) {
  const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); scene.add(o); return o; };

  // wallpaper: faint vertical stripes and a soft patch of window light
  add(staticPlane(140, 50, 6, (g, W, H) => {
    for (let i = 0; i < 140; i += 2) { g.fillStyle = 'rgba(214,190,152,0.18)'; g.fillRect((i / 140) * W, 0, (0.6 / 140) * W, H); }
  }), 4, 12, -2.95);
  const patch = new THREE.Shape();
  patch.moveTo(-12, 8); patch.lineTo(-4, 8); patch.lineTo(4, -7.2); patch.lineTo(-4, -7.2); patch.closePath();
  add(shapeMesh(patch, ownMat('#fff6e6', 0.45, true), 0), -6, 0, -2.9);

  // window
  const win = { x: -15.6, y: 3.2, w: 8, h: 10 };
  add(inkedRect(win.w + 0.9, win.h + 0.9, 0.05, '#fffaf2', 0.1), win.x, win.y, -2.6);
  let dawnK = 1;
  const skyAt = (stops: [string, string, string], k: number) => {
    const c = k < 0.5 ? new THREE.Color(stops[0]).lerp(new THREE.Color(stops[1]), k * 2) : new THREE.Color(stops[1]).lerp(new THREE.Color(stops[2]), k * 2 - 1);
    return '#' + c.getHexString();
  };
  const sky = canvasPlane(win.w, win.h, 40, (g, f: Frame, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, skyAt(['#1b2350', '#7fa8d8', '#8fcdf0'], dawnK)); grad.addColorStop(1, skyAt(['#46407a', '#ffc59a', '#d8f0fb'], dawnK));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const u = W / win.w;
    const starA = clamp(1 - dawnK * 2.2);
    if (starA > 0) for (let i = 0; i < 22; i++) {
      g.fillStyle = `rgba(255,248,220,${starA * (0.55 + 0.45 * Math.sin(f.t * 2.3 + i * 1.7))})`;
      g.fillRect(hash(i, 61) * W, hash(i, 62) * H * 0.7, 0.07 * u, 0.07 * u);
    }
    g.globalAlpha = 0.35 + 0.65 * dawnK;
    for (let c = 0; c < 3; c++) { // clouds drifting right, wrapping
      const span = win.w + 6;
      const cx = (((f.t * (0.35 + c * 0.12) + c * 4.1) % span) - 3) * u, cy = (1.6 + c * 2.6) * u;
      g.fillStyle = '#ffffff';
      for (const [dx, dy, r] of [[0, 0, 0.9], [0.9, 0.2, 0.7], [-0.9, 0.25, 0.65], [0.3, -0.45, 0.6]]) {
        g.beginPath(); g.arc(cx + dx * u, cy + dy * u, r * u, 0, Math.PI * 2); g.fill();
      }
    }
    // a bird crosses now and then
    const bp = (f.t % 9) / 9;
    if (bp < 0.6) {
      const bx = (bp / 0.6) * (win.w + 2) * u - u, by = (3.4 + Math.sin(f.t * 2) * 0.4) * u, flap = Math.sin(f.t * 14) * 0.25 * u;
      g.strokeStyle = '#2b1d16'; g.lineWidth = 0.09 * u; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx - 0.35 * u, by - flap); g.lineTo(bx, by); g.lineTo(bx + 0.35 * u, by - flap); g.stroke();
    }
  });
  add(sky.mesh, win.x, win.y, -2.55);
  add(shapeMesh(roundedRectShape(0.22, win.h, 0), '#fffaf2', 0), win.x, win.y, -2.5);
  add(shapeMesh(roundedRectShape(win.w, 0.22, 0), '#fffaf2', 0), win.x, win.y + 0.8, -2.5);
  add(inkedRect(win.w + 1.8, 0.45, 0.05, '#f6ead6', 0.08), win.x, win.y - win.h / 2 - 0.45, -2.45); // sill
  const curtains = [-1, 1].map(side => {
    const c = new THREE.Group();
    const cloth = inkedRect(2.2, win.h + 1.6, 0.4, '#e59a78', 0.1);
    cloth.position.y = -(win.h + 1.6) / 2;
    c.add(cloth);
    for (const fx of [-0.45, 0.35]) {
      const fold = shapeMesh(roundedRectShape(0.12, win.h + 0.6, 0.05, fx, -(win.h + 1.6) / 2), '#cf8264', 0.004);
      c.add(fold);
    }
    return add(c, win.x + side * (win.w / 2 + 0.3), win.y + win.h / 2 + 0.8, -2.4);
  });
  add(inkedRect(win.w + 6.5, 0.3, 0.15, '#8a6a4f', 0.06), win.x, win.y + win.h / 2 + 0.9, -2.35); // rail

  // wall clock above the window
  const clock = new THREE.Group();
  clock.add(inkedCircle(1.25, '#fffaf2', 0.12));
  for (let i = 0; i < 12; i++) {
    const tick = shapeMesh(roundedRectShape(0.08, i % 3 ? 0.18 : 0.32, 0), INK, 0.004);
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * 1.0, Math.cos(a) * 1.0, 0); tick.rotation.z = -a;
    clock.add(tick);
  }
  const hand = (len: number, w: number) => { const h = new THREE.Group(); const m = shapeMesh(roundedRectShape(w, len, w / 2, 0, len / 2 - 0.1), INK, 0.006); h.add(m); clock.add(h); return h; };
  const hourHand = hand(0.6, 0.14), minHand = hand(0.95, 0.09);
  add(clock, win.x, 11.4, -2.4);

  // shelf on the right wall, with books, a trophy and a trailing plant
  add(inkedRect(9.5, 0.4, 0.05, '#b98a62', 0.08), 22.5, 2.3, -2.4);
  const bookCols = ['#7aa6d6', '#e3b85c', '#8fc59a', '#d98576', '#9d8cc9', '#e7d7b7'];
  let bx = 18.4;
  for (let i = 0; i < 7; i++) {
    const w = 0.5 + hash(i, 41) * 0.35, h = 1.6 + hash(i, 42) * 1.0;
    const b = inkedRect(w, h, 0.03, bookCols[i % bookCols.length], 0.06);
    add(b, bx + w / 2, 2.5 + h / 2 + 0.02, -2.35);
    if (i === 6) b.rotation.z = -0.25;
    bx += w + 0.08;
  }
  const trophy = new THREE.Group();
  trophy.add(inkedRect(0.9, 0.3, 0.02, '#8a6a4f', 0.06));
  const cup = inkedRect(0.9, 1.0, 0.25, '#f2c14e', 0.06); cup.position.y = 0.95; trophy.add(cup);
  const stem = inkedRect(0.25, 0.5, 0.02, '#f2c14e', 0.05); stem.position.y = 0.35; trophy.add(stem);
  add(trophy, 24.6, 2.65, -2.35);
  const pot = inkedRect(1.2, 1.0, 0.1, '#d7825f', 0.07);
  add(pot, 26.3, 3.0, -2.35);
  const vines = [0, 1, 2].map(i => {
    const v = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const leaf = inkedRect(0.55, 0.32, 0.15, k % 2 ? '#6fb37c' : '#5aa06a', 0.05);
      leaf.position.set((k % 2 ? 0.25 : -0.25), -k * 0.55, 0.01 * k);
      leaf.rotation.z = k % 2 ? 0.5 : -0.5;
      v.add(leaf);
    }
    return add(v, 25.9 + i * 0.4, 3.0, -2.3 + i * 0.01);
  });

  // framed picture below the shelf: hills and a sun
  const pic = new THREE.Group();
  pic.add(inkedRect(5.2, 3.8, 0.05, '#8a6a4f', 0.08));
  const art = staticPlane(4.6, 3.2, 40, (g, W, H) => {
    g.fillStyle = '#cfe9f2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f7c45a'; g.beginPath(); g.arc(W * 0.72, H * 0.32, H * 0.14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8cc48f'; g.beginPath(); g.ellipse(W * 0.3, H * 1.05, W * 0.55, H * 0.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6fae79'; g.beginPath(); g.ellipse(W * 0.85, H * 1.1, W * 0.5, H * 0.45, 0, 0, Math.PI * 2); g.fill();
  });
  art.position.z = 0.01;
  pic.add(art);
  add(pic, 22.4, -2.6, -2.4);

  // desk front: drawers with handles
  for (const x of [-15, 15]) {
    add(inkedRect(9, 3.4, 0.1, '#d6ac83', 0.08), x, -10.6, 1.25);
    add(inkedRect(1.8, 0.35, 0.15, '#8a6a4f', 0.05), x, -10.1, 1.3);
  }

  // on the desk: keyboard, mouse, mug with steam, lamp, pencil cup, books, a potted plant
  const deskY = -7.2;
  const kb = new THREE.Group();
  kb.add(inkedRect(11, 0.5, 0.15, '#e9e4dc', 0.07));
  for (let i = 0; i < 16; i++) { const key = shapeMesh(roundedRectShape(0.5, 0.18, 0.04, -5 + i * 0.66, 0.3), '#cfc8bd', 0.004); kb.add(key); }
  add(kb, -0.5, deskY + 0.28, 1.3);
  add(inkedRect(1.1, 0.45, 0.22, '#e9e4dc', 0.07), 7.6, deskY + 0.25, 1.3);
  const mug = new THREE.Group();
  mug.add(inkedRect(1.4, 1.7, 0.12, '#d97757', 0.08));
  const handleOuter = inkedRect(0.6, 0.9, 0.25, '#d97757', 0.08); handleOuter.position.set(0.85, 0.05, -0.01); mug.add(handleOuter);
  const handleHole = shapeMesh(roundedRectShape(0.22, 0.45, 0.1, 0.92, 0.05), PAL.wall, 0.001); mug.add(handleHole);
  add(mug, 10.0, deskY + 0.9, 1.3);
  const steam = [0, 1, 2].map(i => add(shapeMesh(roundedRectShape(0.16, 0.7, 0.08), ownMat('#ffffff', 0.7, true), 0), 9.6 + i * 0.4, deskY + 2.3, 1.3));
  const lamp = new THREE.Group();
  lamp.add(inkedRect(2.4, 0.4, 0.15, '#3f6f8f', 0.08));
  const arm1 = inkedRect(0.3, 3.4, 0.1, '#3f6f8f', 0.07); arm1.position.set(0.2, 1.8, 0); arm1.rotation.z = -0.25; lamp.add(arm1);
  const arm2 = inkedRect(0.3, 2.8, 0.1, '#3f6f8f', 0.07); arm2.position.set(1.4, 3.7, 0); arm2.rotation.z = -1.05; lamp.add(arm2);
  const shade = new THREE.Shape();
  shade.moveTo(-0.5, 0.45); shade.lineTo(0.5, 0.45); shade.lineTo(1.1, -0.6); shade.lineTo(-1.1, -0.6); shade.closePath();
  const shadeInk = new THREE.Shape();
  shadeInk.moveTo(-0.62, 0.57); shadeInk.lineTo(0.62, 0.57); shadeInk.lineTo(1.26, -0.7); shadeInk.lineTo(-1.26, -0.7); shadeInk.closePath();
  const shadeG = new THREE.Group();
  shadeG.add(shapeMesh(shadeInk, INK, 0), shapeMesh(shade, '#3f6f8f', 0.003));
  shadeG.position.set(2.7, 3.6, 0.01); shadeG.rotation.z = 0.35; // opening faces down and to the right, where the beam falls
  lamp.add(shadeG);
  const beam = new THREE.Shape();
  beam.moveTo(1.88, 2.66); beam.lineTo(3.94, 3.41); beam.lineTo(6.6, -0.1); beam.lineTo(1.8, -0.1); beam.closePath();
  lamp.add(shapeMesh(beam, ownMat('#fff1b8', 0.35, true), -0.01));
  add(lamp, -13.6, deskY + 0.2, 1.3);
  const pencils = new THREE.Group();
  ['#f2c14e', '#7aa6d6', '#d98576'].forEach((c, i) => {
    const p = inkedRect(0.22, 2.0, 0.05, c, 0.05); p.position.set(-0.3 + i * 0.3, 1.5, -0.01); p.rotation.z = (i - 1) * 0.15; pencils.add(p);
  });
  const pcup = inkedRect(1.1, 1.4, 0.08, '#9d8cc9', 0.07); pcup.position.y = 0.7; pencils.add(pcup);
  add(pencils, -17.4, deskY, 1.3);
  [['#7aa6d6', 4.2], ['#e3b85c', 3.8], ['#8fc59a', 4.4]].forEach(([c, w], i) => {
    add(inkedRect(w as number, 0.6, 0.05, c as string, 0.06), -21.2 + (i % 2) * 0.3, deskY + 0.32 + i * 0.66, 1.28);
  });
  const deskPlant = new THREE.Group();
  const dpot = inkedRect(1.8, 1.7, 0.15, '#d7825f', 0.08); dpot.position.y = 0.85; deskPlant.add(dpot);
  const leaves = [-0.7, -0.25, 0.2, 0.65].map((a, i) => {
    const l = inkedRect(0.7, 2.6 + (i % 2) * 0.6, 0.35, i % 2 ? '#6fb37c' : '#5aa06a', 0.07);
    const pivot = new THREE.Group(); l.position.y = 1.3 + (i % 2) * 0.3; pivot.add(l); pivot.position.y = 1.6; pivot.rotation.z = a;
    deskPlant.add(pivot);
    return { pivot, a };
  });
  add(deskPlant, 24.5, deskY, 1.25);

  // the person's chair back, behind them
  add(inkedRect(3.4, 5.6, 0.6, '#5f8f87', 0.1), 15.4, -5.2, 0.4);

  // sticky notes on the monitor bezel (the ones Clawd straightened)
  [[-7.4, 4.4, 0.12], [-6.2, 4.6, -0.08]].forEach(([x, y, r]) => {
    const n = inkedRect(1.1, 1.1, 0.02, PAL.sticky, 0.05);
    n.rotation.z = r;
    add(n, x, y, 0.86);
  });

  return (f: Frame, dawn = 1) => {
    dawnK = dawn;
    const hours = 9 + f.t / 60; // the clock runs a little fast through the video
    minHand.rotation.z = -((hours % 1) * Math.PI * 2);
    hourHand.rotation.z = -(((hours % 12) / 12) * Math.PI * 2);
    sky.update(f);
    curtains.forEach((c, i) => { c.rotation.z = Math.sin(f.t * 0.9 + i * 1.7) * 0.025; });
    vines.forEach((v, i) => { v.rotation.z = Math.sin(f.t * 1.3 + i) * 0.06; });
    const sway = beatHop(f.clock, f.t);
    leaves.forEach(({ pivot, a }, i) => { pivot.rotation.z = a + Math.sin(f.t * 2 + i) * 0.04 + sway * 0.05 * (i % 2 ? 1 : -1); });
    steam.forEach((s, i) => {
      const k = (f.t * 0.5 + i / 3) % 1;
      s.position.set(9.6 + i * 0.4 + Math.sin(f.t * 3 + i * 2) * 0.15, -7.2 + 2.3 + k * 1.6, 1.3);
      s.scale.set(1, 0.6 + k * 0.6, 1);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.sin(k * Math.PI);
    });
  };
}
