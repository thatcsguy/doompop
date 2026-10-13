// Finds z-fighting, the flicker of flat cut-outs. Each cut-out is a thin plane stacked a few
// thousandths of a unit in front of the one below it. Where two overlapping surfaces are closer in
// depth than the depth buffer can tell apart, which one shows changes from frame to frame (and
// between motion-blur sub-frames), so their edges flicker.
//
// The check draws every opaque, depth-tested mesh as a flat ID colour twice: once in three.js's
// normal draw order and once in reverse, with a depth buffer `margin` times coarser than the real
// render's. Where surfaces are far enough apart the nearer one wins both times. Where the winner
// depends on draw order, the two are tied in depth: that pair flickers, or would with `margin`
// times less depth between them. See-through meshes (text on a canvas, a shadow, glass) don't hide
// what's behind them, so they get their own two passes, drawn over the opaque ones with a depth
// test of <= and then <: where the result differs, a see-through layer sits level with the surface
// under it and speckles. tools/render.mjs zfight runs it over a whole song.
import * as THREE from 'three';

export interface ZMesh {
  oid: number;                      // Object3D.id, stable for the page's lifetime
  path: string;                     // names of the mesh and its named ancestors, outermost first
  color: string;                    // the mesh's material colour (#rrggbb), or 'texture'
  z: number;                        // local z offset (position.z)
  clear: boolean;                   // see-through (transparent or not writing depth)
  pos: [number, number, number];    // world position
  size: [number, number];           // world-space width and height of its geometry's bounding box
}
export interface ZPair {
  a: ZMesh; b: ZMesh;
  pixels: number;                   // pixels whose winner changed with the draw order
  box: [number, number, number, number]; // x0, y0, x1, y1 in canvas pixels (top-left origin)
  same: boolean;                    // both draw as the same flat colour, so the fight can't be seen
}
export interface ZResult { pairs: ZPair[]; meshes: number; mask: Uint8Array; width: number; height: number }

const VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vIdUv;
void main() {
  vIdUv = uv;
  #include <begin_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
}`;
const FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 idColor;
uniform sampler2D map;
uniform float alphaCut;
varying vec2 vIdUv;
void main() {
  #include <logdepthbuf_fragment>
  if (alphaCut > 0.0 && texture2D(map, vIdUv).a < alphaCut) discard;
  gl_FragColor = vec4(idColor, 1.0);
}`;

/** three.js's default opaque order (WebGLRenderLists painterSortStable). */
type Item = { groupOrder: number; renderOrder: number; material: { id: number }; materialVariant?: number; z: number; id: number };
const painter = (a: Item, b: Item) =>
  a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.material.id - b.material.id ||
  (a.materialVariant ?? 0) - (b.materialVariant ?? 0) || a.z - b.z || a.id - b.id;

let target: THREE.WebGLRenderTarget | null = null;

function describe(m: THREE.Mesh, mat: THREE.Material, clear: boolean): ZMesh {
  const names: string[] = [];
  for (let o: THREE.Object3D | null = m; o; o = o.parent) if (o.name) names.unshift(o.name);
  const basic = mat as THREE.MeshBasicMaterial;
  const color = basic.map ? 'texture' : basic.color ? `#${basic.color.getHexString()}` : '?';
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  m.getWorldPosition(p);
  m.getWorldScale(s);
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const bb = m.geometry.boundingBox!;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return {
    oid: m.id, path: names.join('/') || '?', color, z: r(m.position.z), clear,
    pos: [r(p.x), r(p.y), r(p.z)], size: [r((bb.max.x - bb.min.x) * Math.abs(s.x)), r((bb.max.y - bb.min.y) * Math.abs(s.y))],
  };
}

export function findZFights(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number, margin = 8): ZResult {
  // what to draw: opaque meshes that test and write depth, then see-through meshes that test depth
  // (on layer 30, so the opaque passes can leave them out); everything else moves to layer 31
  const solid: THREE.Mesh[] = [], seeThru: THREE.Mesh[] = [];
  const hidden: [THREE.Object3D, number][] = [];
  scene.traverseVisible(o => {
    const renderable = (o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite;
    if (!renderable) return;
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[];
    const m0 = Array.isArray(mat) ? mat[0] : mat;
    const mesh = (o as THREE.Mesh).isMesh && m0 && m0.visible && m0.depthTest;
    if (mesh && !m0.transparent && m0.depthWrite) solid.push(o as THREE.Mesh);
    else if (mesh && (m0.opacity >= 0.02 || (m0 as THREE.MeshBasicMaterial).map)) {
      seeThru.push(o as THREE.Mesh);
      hidden.push([o, o.layers.mask]); o.layers.set(30);
    } else { hidden.push([o, o.layers.mask]); o.layers.set(31); }
  });
  const meshes = [...solid, ...seeThru];

  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  const idMats: THREE.ShaderMaterial[] = [], clearMats: THREE.ShaderMaterial[] = [];
  meshes.forEach((m, i) => {
    const id = i + 1, mat = m.material as THREE.Material | THREE.Material[], isClear = i >= solid.length;
    const m0 = (Array.isArray(mat) ? mat[0] : mat) as THREE.MeshBasicMaterial;
    // a texture's empty texels aren't surface: cut them where the real material does, or (for a
    // see-through texture, which shows nothing there) below a tenth opacity
    const cut = !m0.map ? 0 : m0.alphaTest > 0 ? m0.alphaTest : isClear ? 0.1 : 0;
    const idm = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: m0.side,
      uniforms: { idColor: { value: new THREE.Color((id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255) }, map: { value: cut ? m0.map : null }, alphaCut: { value: cut } },
      polygonOffset: m0.polygonOffset, polygonOffsetFactor: m0.polygonOffsetFactor, polygonOffsetUnits: m0.polygonOffsetUnits,
    });
    // see-through IDs draw after the opaque ones (three.js's transparent list) without writing depth
    if (isClear) { idm.transparent = true; idm.blending = THREE.NoBlending; idm.depthWrite = false; clearMats.push(idm); }
    idMats.push(idm);
    swapped.push([m, mat]);
    m.material = Array.isArray(mat) ? mat.map(() => idm) : idm;
  });

  // a depth buffer `margin` times coarser than the real one
  const cam = camera as THREE.PerspectiveCamera;
  const near = cam.near, far = cam.far;
  if (gl.capabilities.logarithmicDepthBuffer) cam.far = Math.pow(far + 1, margin) - 1;
  else cam.near = near / margin;
  cam.updateProjectionMatrix();

  if (!target || target.width !== width || target.height !== height) {
    target?.dispose();
    target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  }
  const bg = scene.background, clear = gl.getClearColor(new THREE.Color()), clearA = gl.getClearAlpha();
  scene.background = null;
  gl.setClearColor(0x000000, 1);
  const camMask = cam.layers.mask;
  const pass = (sort: (a: Item, b: Item) => number, depthFunc?: THREE.DepthModes) => {
    cam.layers.mask = depthFunc === undefined ? camMask & ~(1 << 30) : camMask | (1 << 30);
    for (const m of clearMats) m.depthFunc = depthFunc ?? THREE.LessEqualDepth;
    gl.setOpaqueSort(sort as never);
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, camera);
    const buf = new Uint8Array(width * height * 4);
    gl.readRenderTargetPixels(target!, 0, 0, width, height, buf);
    return buf;
  };
  let A: Uint8Array, B: Uint8Array, C: Uint8Array | null = null, D: Uint8Array | null = null;
  try {
    A = pass(painter);
    B = pass((a, b) => -painter(a, b));
    if (seeThru.length) {
      C = pass(painter, THREE.LessEqualDepth);
      D = pass(painter, THREE.LessDepth);
    }
  } finally {
    cam.layers.mask = camMask;
    gl.setOpaqueSort(null);
    gl.setRenderTarget(null);
    gl.setClearColor(clear, clearA);
    scene.background = bg;
    cam.near = near; cam.far = far; cam.updateProjectionMatrix();
    for (const [m, mat] of swapped) m.material = mat;
    for (const [o, mask] of hidden) o.layers.mask = mask;
    for (const m of idMats) m.dispose();
  }

  const mask = new Uint8Array(width * height);
  const acc = new Map<number, { lo: number; hi: number; n: number; box: [number, number, number, number] }>();
  const id = (P: Uint8Array, k: number) => P[k] | (P[k + 1] << 8) | (P[k + 2] << 16);
  const note = (a: number, b: number, x: number, y: number) => {
    mask[y * width + x] = 1;
    const lo = Math.min(a, b), hi = Math.max(a, b), key = lo * 16777216 + hi;
    let e = acc.get(key);
    if (!e) acc.set(key, e = { lo, hi, n: 0, box: [x, y, x, y] });
    e.n++;
    if (x < e.box[0]) e.box[0] = x; if (y < e.box[1]) e.box[1] = y;
    if (x > e.box[2]) e.box[2] = x; if (y > e.box[3]) e.box[3] = y;
  };
  for (let gy = 0; gy < height; gy++) {
    const y = height - 1 - gy; // GL rows start at the bottom
    for (let x = 0; x < width; x++) {
      const k = (gy * width + x) * 4;
      const a = id(A, k), b = id(B, k);
      if (a !== b) note(a, b, x, y);
      // a see-through mesh that passed <= but not <: level with the opaque surface under it (A's)
      if (C && D) { const c = id(C, k); if (c !== id(D, k) && c !== a) note(a, c, x, y); }
    }
  }
  const pairs: ZPair[] = [];
  const first = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material[0] : m.material);
  for (const e of acc.values()) {
    const ma = meshes[e.lo - 1], mb = meshes[e.hi - 1];
    if (!ma || !mb) continue;
    const a = describe(ma, first(ma), e.lo > solid.length), b = describe(mb, first(mb), e.hi > solid.length);
    pairs.push({ a, b, pixels: e.n, box: e.box, same: a.color === b.color && a.color !== 'texture' });
  }
  pairs.sort((p, q) => q.pixels - p.pixels);
  return { pairs, meshes: meshes.length, mask, width, height };
}
