// Flat 2D cartoon kit: filled shapes with ink outlines, built as flat meshes so they live in a
// three.js world (camera moves, parallax, layering) but read as drawn, cel-style art.
// Unlit materials only: colour comes from the palette, not from lights.
import * as THREE from 'three';

export const INK = '#2b1d16';

const matCache = new Map<string, THREE.MeshBasicMaterial>();
/** Shared flat material per colour (cheap; set .color on a clone if you need to animate it). */
export function flatMat(color: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  const key = `${new THREE.Color(color).getHexString()}:${opacity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1 });
    matCache.set(key, m);
  }
  return m;
}
/** A material you own and can animate. Pass transparent = true if you will fade it. */
export const ownMat = (color: THREE.ColorRepresentation, opacity = 1, transparent = opacity < 1) =>
  new THREE.MeshBasicMaterial({ color, transparent, opacity, side: THREE.DoubleSide, depthWrite: !transparent });

export function roundedRectShape(w: number, h: number, r: number, cx = 0, cy = 0): THREE.Shape {
  r = Math.min(r, w / 2, h / 2);
  const x = cx - w / 2, y = cy - h / 2, s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function circleShape(r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return s;
}

/** A thick arc (a stroke along a circle) as a fillable shape, with round caps. */
export function arcShape(r: number, thick: number, a0: number, a1: number): THREE.Shape {
  const s = new THREE.Shape(), ro = r + thick / 2, ri = r - thick / 2, c = thick / 2;
  s.absarc(0, 0, ro, a0, a1, false);
  s.absarc(Math.cos(a1) * r, Math.sin(a1) * r, c, a1, a1 + Math.PI, false);
  s.absarc(0, 0, ri, a1, a0, true);
  s.absarc(Math.cos(a0) * r, Math.sin(a0) * r, c, a0 + Math.PI, a0 + Math.PI * 2, false);
  return s;
}

/** A teardrop (sweat, tears), point up. */
export function dropShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, r * 2.2);
  s.quadraticCurveTo(r * 1.05, r * 0.6, r, 0);
  s.absarc(0, 0, r, 0, -Math.PI, true);
  s.quadraticCurveTo(-r * 1.05, r * 0.6, 0, r * 2.2);
  return s;
}

export function shapeMesh(shape: THREE.Shape, color: THREE.ColorRepresentation | THREE.Material, z = 0, segs = 12): THREE.Mesh {
  const mat = color instanceof THREE.Material ? color : flatMat(color);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, segs), mat);
  m.position.z = z;
  return m;
}

/**
 * A rounded rectangle with an ink outline: returns a group holding [outline, fill].
 * The outline is drawn as a slightly larger shape just behind the fill.
 */
export function inkedRect(w: number, h: number, r: number, fill: THREE.ColorRepresentation | THREE.Material, stroke = 0.045, ink: THREE.ColorRepresentation = INK) {
  const g = new THREE.Group();
  const outline = shapeMesh(roundedRectShape(w + stroke * 2, h + stroke * 2, r + stroke), ink, 0);
  const body = shapeMesh(roundedRectShape(w, h, r), fill, 0.002);
  g.add(outline, body);
  return Object.assign(g, { fill: body, outline });
}

export function inkedCircle(r: number, fill: THREE.ColorRepresentation | THREE.Material, stroke = 0.04, ink: THREE.ColorRepresentation = INK) {
  const g = new THREE.Group();
  const outline = shapeMesh(circleShape(r + stroke), ink, 0, 24);
  const body = shapeMesh(circleShape(r), fill, 0.002, 24);
  g.add(outline, body);
  return Object.assign(g, { fill: body, outline });
}
