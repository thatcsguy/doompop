// The look of "The Smoking Gun": a dark disco club lit only by neon, terminals, the dance floor
// and the disco ball. Flat 2D cut-outs as in song 1, but light sources are HDR (colour values
// above 1) so the bloom pass makes them glow while the flat fills around them stay exact.
import * as THREE from 'three';
import type { PostSettings, Song } from '../../engine/types';
import type { SongClock } from '../../engine/song';
import { clamp } from '../../engine/ease';
import shrikhandUrl from './fonts/Shrikhand-Regular.ttf?url';
import monotonUrl from './fonts/Monoton-Regular.ttf?url';
import spaceMonoUrl from './fonts/SpaceMono-Bold.ttf?url';
import vt323Url from './fonts/VT323-Regular.ttf?url';

export const PAL = {
  night: '#07061a',      // the clear colour: near-black navy
  navy: '#101034',
  deep: '#170f33',
  purple: '#24164a',
  plum: '#33205e',
  violet: '#4a2f86',
  wall: '#1b1240',
  wallLine: '#251a52',
  ink: '#06040f',        // outlines; nearly invisible on the dark sets, crisp on lit things
  floorGrout: '#05040d',
  tileDead: '#151129',
  pink: '#ff3ea5',
  cyan: '#2fe2ff',
  gold: '#ffc23d',
  violetNeon: '#a35cff',
  green: '#45ff8a',      // terminal phosphor
  amber: '#ffae3d',
  red: '#ff3240',
  white: '#fff4fb',
  clawd: '#d97757',
  chain: '#f4c542',
  chainShade: '#b98a1c',
  afro: '#3a2118',
  afroShade: '#2a160f',
  afroLight: '#5c3626',
};

/** Neon colours used for lights, signs and rims, in rotation order. */
export const NEONS = [PAL.pink, PAL.cyan, PAL.gold, PAL.violetNeon, PAL.green];

export const DISCO_FONT = '"Shrikhand", "Inter", system-ui, sans-serif';
export const SIGN_FONT = '"Monoton", "Shrikhand", system-ui, sans-serif';
export const TERM_FONT = '"Space Mono", "DejaVu Sans Mono", monospace';
export const CRT_FONT = '"VT323", "DejaVu Sans Mono", monospace';
export const UI_FONT = '"Inter", system-ui, "Helvetica Neue", Arial, sans-serif';

/** Single-weight display fonts: declared over the whole weight range so canvas text never fakes a bold. */
export const FONTS: NonNullable<Song['fonts']> = [
  { family: 'Shrikhand', url: shrikhandUrl, weight: '100 900' },
  { family: 'Monoton', url: monotonUrl, weight: '100 900' },
  { family: 'Space Mono', url: spaceMonoUrl, weight: '100 900' },
  { family: 'VT323', url: vt323Url, weight: '100 900' },
];

/** Post for the club: no tone mapping (exact flat palette), bloom only on HDR light sources. */
export const CLUB_POST: Partial<PostSettings> = {
  bloom: 0.9, bloomRadius: 0.55, bloomThreshold: 1.0, grain: 0.035, vignette: 0.35, exposure: 1, toneMap: false,
};

const glowCache = new Map<string, THREE.MeshBasicMaterial>();
/**
 * A light-source material: the colour times `power` in linear space. Above 1 it blooms; the flat
 * fills around it (all below 1) never do. Shared per colour and power; use ownGlow() to animate.
 */
export function glowMat(color: THREE.ColorRepresentation, power = 2.2): THREE.MeshBasicMaterial {
  const key = `${new THREE.Color(color).getHexString()}:${power}`;
  let m = glowCache.get(key);
  if (!m) { m = ownGlow(color, power); glowCache.set(key, m); }
  return m;
}
export function ownGlow(color: THREE.ColorRepresentation, power = 2.2, opacity = 1): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  setGlow(m, color, power);
  return m;
}
/** Set a glow material's colour and power (call every frame if it animates). */
export function setGlow(m: THREE.MeshBasicMaterial, color: THREE.ColorRepresentation, power: number) {
  m.color.set(color).multiplyScalar(power);
}

/**
 * Make a canvas-textured plane solid (for canvases painted edge to edge). Big transparent planes
 * are depth-sorted by their centres and can draw over things in front of them; solid ones can't.
 */
export function solid<T extends THREE.Mesh>(m: T): T {
  const mat = m.material as THREE.MeshBasicMaterial;
  mat.transparent = false; mat.depthWrite = true; mat.needsUpdate = true;
  return m;
}
/** Make a canvas-textured plane a crisp cut-out (alpha-tested): depth-correct, hard edges. */
export function cutout<T extends THREE.Mesh>(m: T, at = 0.5): T {
  const mat = m.material as THREE.MeshBasicMaterial;
  mat.transparent = false; mat.alphaTest = at; mat.depthWrite = true; mat.needsUpdate = true;
  return m;
}

/** Additive translucent material for light beams, pools and halos. */
export function lightMat(color: THREE.ColorRepresentation, opacity = 0.35, map: THREE.Texture | null = null) {
  return new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

let radialTex: THREE.CanvasTexture | null = null;
/** A soft white radial falloff (for halos, light pools, glows). Shared. */
export function radialTexture(): THREE.CanvasTexture {
  if (radialTex) return radialTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  radialTex = new THREE.CanvasTexture(c);
  radialTex.colorSpace = THREE.SRGBColorSpace;
  return radialTex;
}

let beamTex: THREE.CanvasTexture | null = null;
/** A beam falloff: bright along the centre line, fading to the edges and toward the far end. */
export function beamTexture(): THREE.CanvasTexture {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 256; y++) {
    const along = 1 - y / 255;                       // 1 at the source (top), 0 at the far end
    const row = g.createLinearGradient(0, 0, 128, 0);
    const a = 0.15 + 0.85 * along;
    row.addColorStop(0, 'rgba(255,255,255,0)');
    row.addColorStop(0.5, `rgba(255,255,255,${a})`);
    row.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = row;
    g.fillRect(0, y, 128, 1);
  }
  beamTex = new THREE.CanvasTexture(c);
  beamTex.colorSpace = THREE.SRGBColorSpace;
  return beamTex;
}

/** A soft additive halo disc (radius r) in a colour; place it just behind what it lights. */
export function halo(r: number, color: THREE.ColorRepresentation, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), lightMat(color, opacity, radialTexture()));
  m.renderOrder = -1;
  return m;
}

/** Camera helper: a straight-on view centred on (x, y) showing `height` world units vertically. */
export function frameCam(cam: THREE.PerspectiveCamera, x: number, y: number, height: number, zTarget = 0) {
  const d = height / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(x, y, zTarget + d);
  cam.lookAt(x, y, zTarget);
}

/** Camera from a position looking at a target, with an optional roll (radians). */
export function aimCam(cam: THREE.PerspectiveCamera, px: number, py: number, pz: number, tx: number, ty: number, tz: number, roll = 0) {
  cam.position.set(px, py, pz);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(tx, ty, tz);
}

/** A beat-locked hop, 0..1, for idle bouncing. Zero before the beat grid starts. */
export function beatHop(clock: SongClock, t: number, every = 1) {
  const b = clock.beat(t) / every;
  if (b < 0) return 0;
  return Math.sin((b - Math.floor(b)) * Math.PI);
}

/** Phase (0..1) within the current beat, and the beat's integer index. */
export function beatPhase(clock: SongClock, t: number) {
  const b = clock.beat(t);
  return { n: Math.floor(b), ph: b - Math.floor(b), b };
}

/** 1 on the beat nearest t, falling off over `width` beats either side: a gentle beat pulse. */
export function beatPulse(clock: SongClock, t: number, width = 0.25) {
  const b = clock.beat(t);
  const d = Math.abs(b - Math.round(b));
  return clamp(1 - d / width);
}

/** The time of the beat nearest t (from the measured grid). */
export function nearestBeat(clock: SongClock, t: number) {
  return clock.beatTime(Math.round(clock.beat(t)));
}
