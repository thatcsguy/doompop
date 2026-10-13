// The bridge's props: a talk bubble (words, or the Chief's wordless squiggle), the napkin insert
// (the counter seen from above, the Chief's hand, Clawd's magnifier), the bomb under a cocktail
// dome, the little graph card, the zipped floor seam, the happy path's flowers and sun sticker, and
// the big red RUN button. Each class sets everything it touches in set().
import * as THREE from 'three';
import { INK, arcShape, canvasPlane, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh } from '../../engine/flat';
import { clamp, decay, easeOutBack, easeOutCubic, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { DISCO_FONT, PAL, TERM_FONT, cutout, lightMat, ownGlow, radialTexture, setGlow } from './look';
import { Burst } from './props';

// ---------------------------------------------------------------------------------------------
// 2D overlay: a comic speech bubble with rows of words that appear as they're sung, or a
// wordless squiggle (someone talking and we don't need the words)

export interface TalkWord { text: string; start: number; color?: string }

/** A speech bubble with its tail's tip at `at` (pixels), growing up and to one side. rows: the
 *  words by row; squiggle: draw n scribbled lines from `start` instead. Pops out after `until`. */
export function drawTalk(g: CanvasRenderingContext2D, t: number, H: number, at: { x: number; y: number }, o: {
  rows?: TalkWord[][]; squiggle?: { start: number; n: number }; until: number; side?: 1 | -1; size?: number; color?: string;
}) {
  const first = o.rows ? o.rows[0][0].start : o.squiggle!.start;
  if (t < first - 0.05) return;
  const side = o.side ?? 1, px = (o.size ?? 70) * (H / 1080);
  const k = easeOutBack(clamp((t - first + 0.05) / 0.2), 2.2) * (1 - easeOutCubic(clamp((t - o.until) / 0.18)));
  if (k <= 0.01) return;
  g.save();
  g.font = `400 ${px}px ${DISCO_FONT}`;
  const space = g.measureText(' ').width;
  const rowW = (r: TalkWord[]) => r.reduce((a, w, i) => a + g.measureText(w.text).width + (i ? space : 0), 0);
  const nRows = o.rows ? o.rows.length : 1;
  const bw = o.rows ? Math.max(...o.rows.map(rowW)) + px * 1.3 : px * 4.6;
  const bh = o.rows ? nRows * px * 1.12 + px * 0.62 : px * 1.5;
  const bx = at.x + side * px * 0.5 - (side < 0 ? bw : 0), by = at.y - bh - px * 0.75;
  g.translate(at.x, at.y);
  g.scale(k, k);
  g.translate(-at.x, -at.y);
  g.beginPath();
  g.roundRect(bx, by, bw, bh, Math.min(bh * 0.45, px * 0.9));
  g.moveTo(at.x + side * px * 0.75, by + bh - 2);
  g.lineTo(at.x, at.y);
  g.lineTo(at.x + side * px * 1.75, by + bh - 2);
  g.lineWidth = px * 0.16; g.strokeStyle = PAL.ink; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = '#fff7fb'; g.fill();
  if (o.rows) {
    g.textBaseline = 'middle';
    o.rows.forEach((r, ri) => {
      let x = bx + (bw - rowW(r)) / 2;
      const y = by + px * 0.31 + (ri + 0.55) * px * 1.12;
      for (const w of r) {
        const ww = g.measureText(w.text).width;
        const dt = t - w.start + 1 / 30;
        if (dt >= 0) {
          const s = easeOutBack(clamp(dt / 0.16), 2.6);
          g.save();
          g.translate(x + ww / 2, y);
          g.scale(s, s);
          g.fillStyle = w.color ?? o.color ?? PAL.pink;
          g.fillText(w.text, -ww / 2, 0);
          g.restore();
        }
        x += ww + space;
      }
    });
  } else {
    // three scribbles, written out left to right one after another, wobbling as he talks
    const sq = o.squiggle!;
    g.strokeStyle = '#3a2a55'; g.lineWidth = px * 0.11; g.lineCap = 'round';
    const lens = [0.48, 0.3, 0.22], avail = bw - px * 1.1 - px * 0.64;
    let x0 = bx + px * 0.55;
    for (let i = 0; i < Math.min(sq.n, 3); i++) {
      const len = lens[i] * avail;
      const drawn = clamp((t - sq.start - i * 0.09) / 0.12);
      if (drawn > 0) {
        g.beginPath();
        const steps = 24;
        for (let s = 0; s <= steps * drawn; s++) {
          const u = s / steps, x = x0 + u * len;
          const y = by + bh / 2 + Math.sin(u * Math.PI * 2 * (2 + i) + t * 9 + i) * px * 0.17;
          if (s === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      x0 += len + px * 0.32;
    }
  }
  g.restore();
}

// ---------------------------------------------------------------------------------------------
// The napkin insert, laid out flat in the xy plane for a straight-down camera (a world of its own)

/** The odd byte, hex, as the ticker showed it: staging sends 31 ('1'), prod 32 ('2'). */
const NAP_ROWS: [string, string[]][] = [['staging', ['3a', '31', '7d']], ['prod', ['3a', '32', '7d']]];

/** The napkin's art in a w x h canvas: paper, embossed border, a pen copy of the ticker's pair and
 *  the red circle round prod's odd byte. */
function drawNapkin(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#f3ede2'; g.fillRect(0, 0, W, H);
  // embossed scallops round the edge and a little disco ball in the corner
  g.strokeStyle = 'rgba(160,140,120,0.45)'; g.lineWidth = W * 0.006;
  const m = W * 0.06;
  g.beginPath(); g.roundRect(m, m, W - m * 2, H - m * 2, W * 0.03); g.stroke();
  for (let i = 0; i < 18; i++) {
    for (const [x, y] of [[m + (i + 0.5) * (W - 2 * m) / 18, m * 0.55], [m + (i + 0.5) * (W - 2 * m) / 18, H - m * 0.55]]) {
      g.beginPath(); g.arc(x, y, W * 0.012, 0, Math.PI * 2); g.stroke();
    }
  }
  g.fillStyle = 'rgba(255,62,165,0.55)';
  g.beginPath(); g.arc(W * 0.86, H * 0.15, W * 0.035, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(W * 0.845, H * 0.135, W * 0.012, H * 0.012);
  // the pen copy: two rows of three bytes, the odd pair circled in red marker
  g.textBaseline = 'middle';
  NAP_ROWS.forEach(([label, bytes], r) => {
    const y = H * (0.38 + r * 0.27);
    g.save();
    g.translate(W * 0.1, y);
    g.rotate(-0.04 + r * 0.02);
    g.fillStyle = '#28307a';
    g.font = `700 ${H * 0.075}px ${TERM_FONT}`;
    g.fillText(label, 0, -H * 0.085);
    g.font = `700 ${H * 0.13}px ${TERM_FONT}`;
    bytes.forEach((b, i) => g.fillText(b, W * (0.04 + i * 0.26), H * 0.03));
    g.restore();
  });
  // the circle, two loose loops of marker, and an arrow from staging's byte down to it
  g.strokeStyle = '#e0142c'; g.lineWidth = W * 0.016; g.lineCap = 'round';
  const cx = W * 0.47, cy = H * 0.68;
  g.beginPath();
  for (let a = 0; a <= Math.PI * 4.15; a += 0.08) {
    const r = 1 + 0.06 * Math.sin(a * 1.5);
    const x = cx + Math.cos(a - 0.5) * W * 0.13 * r, y = cy + Math.sin(a - 0.5) * H * 0.105 * r;
    if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  g.beginPath(); g.moveTo(W * 0.72, H * 0.88); g.lineTo(W * 0.6, H * 0.76); g.stroke();
  g.beginPath(); g.moveTo(W * 0.6, H * 0.76); g.lineTo(W * 0.64, H * 0.79); g.moveTo(W * 0.6, H * 0.76); g.lineTo(W * 0.615, H * 0.81); g.stroke();
}

/** Where the circled byte is on the napkin, in its own units (origin at the napkin's centre). */
export const NAP_CIRCLE = new THREE.Vector2(0.47 - 0.5, 0.5 - 0.68);

export class NapkinInsert {
  readonly root = new THREE.Group();
  readonly napkin = new THREE.Group();
  readonly hand = new THREE.Group();
  readonly lens = new THREE.Group();
  private lensView: ReturnType<typeof canvasPlane<{ u: number; v: number }>>;
  private tap: Burst;
  static readonly SIZE = 1.5;

  constructor() {
    const S = NapkinInsert.SIZE;
    // the counter top: purple-stained wood, a coaster and the Chief's coffee seen from above
    const top = canvasPlane(9, 6, 40, (g, _f: number, W, H) => {
      g.fillStyle = '#3b2350'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = hash(i, 1) < 0.5 ? 'rgba(20,8,34,0.35)' : 'rgba(120,80,150,0.18)';
        g.lineWidth = 1 + hash(i, 2) * 2.5;
        const y = hash(i, 3) * H;
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= W; x += W / 20) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4 + hash(i, 4) * 3);
        g.stroke();
      }
      // wet rings from earlier drinks
      g.strokeStyle = 'rgba(200,170,255,0.12)'; g.lineWidth = 3;
      for (const [x, y, r] of [[0.18, 0.75, 0.05], [0.8, 0.22, 0.045], [0.84, 0.7, 0.05]]) { g.beginPath(); g.arc(x * W, y * H, r * W, 0, Math.PI * 2); g.stroke(); }
      // the bar's front edge along the bottom, with its neon strip
      g.fillStyle = '#2a173b'; g.fillRect(0, H * 0.93, W, H * 0.07);
      g.fillStyle = '#c99bff'; g.fillRect(0, H * 0.925, W, H * 0.012);
    });
    top.update(0);
    top.mesh.position.z = -0.05;
    (top.mesh.material as THREE.MeshBasicMaterial).transparent = false;
    this.root.add(top.mesh);
    const mug = new THREE.Group();
    // saucer, handle, cup and coffee each a step in front of the last (shared depths flickered)
    mug.add(inkedCircle(0.5, '#5a1830', 0.03));
    const cup = inkedCircle(0.36, '#f6f3ee', 0.035); cup.position.z = 0.012;
    const handle = inkedRect(0.16, 0.12, 0.04, '#f6f3ee', 0.03); handle.position.set(0.42, 0, 0.006);
    const coffee = shapeMesh(circleShape(0.29), '#4a2a1c', 0.018, 32);
    const crema = shapeMesh(arcShape(0.23, 0.05, 0, Math.PI * 2), '#7a4a30', 0.021, 32);
    const shine = shapeMesh(arcShape(0.2, 0.04, 2.2, 3.0), '#c99a7a', 0.024, 8);
    mug.add(cup, handle, coffee, crema, shine);
    mug.position.set(-1.6, 0.85, 0.03); // in front of the napkin it overlaps
    this.root.add(mug);

    // the napkin, with a soft shadow under it
    const shadow = shapeMesh(roundedRectShape(S + 0.08, S + 0.08, 0.06), ownMat('#000000', 0.35, true), -0.01);
    shadow.position.set(0.05, -0.06, 0);
    const paper = canvasPlane(S, S, 300, (g, _f: number, W, H) => drawNapkin(g, W, H));
    paper.update(0);
    cutout(paper.mesh);
    this.napkin.add(shadow, paper.mesh);
    this.root.add(this.napkin);

    // the Chief's hand, from the left: pinstripe sleeve, white cuff, a hand with one finger out
    const sleeve = inkedRect(2.4, 0.5, 0.08, '#3a3d52', 0.05);
    sleeve.position.set(-1.6, 0, 0.02);
    for (let i = -1; i <= 1; i++) sleeve.add(shapeMesh(roundedRectShape(2.2, 0.02, 0.01, 0, i * 0.13), '#555a78', 0.004));
    const cuff = inkedRect(0.18, 0.52, 0.04, '#f4f1ea', 0.04);
    cuff.position.set(-0.32, 0, 0.03);
    const palm = inkedRect(0.42, 0.44, 0.16, '#e9b592', 0.04);
    palm.position.set(0, 0, 0.04);
    const finger = inkedRect(0.36, 0.11, 0.05, '#e9b592', 0.035);
    finger.position.set(0.32, 0.08, 0.035);
    const knuckles = shapeMesh(roundedRectShape(0.06, 0.3, 0.03, 0.17, -0.06), '#d29673', 0.046);
    this.hand.add(sleeve, cuff, palm, finger, knuckles);
    this.root.add(this.hand);

    // Clawd's magnifier, from the right: what's under it shows twice the size
    this.lensView = canvasPlane(0.9, 0.9, 300, (g, v: { u: number; v: number }, W, H) => {
      g.save();
      g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#3b2350'; g.fillRect(0, 0, W, H);
      // the napkin, scaled 1.9x about the point under the lens centre
      const z = 1.9, NW = (W / 0.9) * S * z;
      g.translate(W / 2 - (v.u + 0.5) * NW, H / 2 - (0.5 - v.v) * NW);
      g.scale(NW / 600, NW / 600);
      drawNapkin(g, 600, 600);
      g.restore();
      // glass sheen
      const sh = g.createLinearGradient(0, 0, W, H);
      sh.addColorStop(0, 'rgba(190,240,255,0.28)'); sh.addColorStop(0.45, 'rgba(190,240,255,0.04)'); sh.addColorStop(1, 'rgba(190,240,255,0.12)');
      g.fillStyle = sh; g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); g.fill();
    });
    this.lensView.mesh.position.z = 0.1;
    const ringInk = shapeMesh(arcShape(0.46, 0.13, 0, Math.PI * 2), INK, 0.11, 40);
    const ring = shapeMesh(arcShape(0.46, 0.07, 0, Math.PI * 2), PAL.chain, 0.115, 40);
    const glint = shapeMesh(arcShape(0.34, 0.04, 2.0, 2.8), ownGlow('#ffffff', 1.6), 0.12, 10);
    const grip = inkedRect(1.3, 0.16, 0.06, '#7a4a2a', 0.04);
    grip.position.set(1.1, -0.3, 0.1);
    grip.rotation.z = -0.25;
    const paw = inkedRect(0.5, 0.42, 0.05, PAL.clawd, 0.05);
    paw.position.set(1.65, -0.45, 0.12);
    paw.rotation.z = -0.25;
    this.lens.add(this.lensView.mesh, ringInk, ring, glint, grip, paw);
    this.root.add(this.lens);
    this.tap = new Burst(PAL.red, 10);
    this.root.add(this.tap.root);
  }

  /** slide: 0 off to the left .. 1 in place; tap: seconds since the finger tapped the circle;
   *  lens: 0 off to the right .. 1 over the circle. */
  set(t: number, slide: number, tap: number, lens: number) {
    const S = NapkinInsert.SIZE;
    const k = easeOutCubic(clamp(slide));
    this.napkin.position.set(lerp(-3.4, 0.15, k), lerp(-0.25, -0.05, k), 0);
    this.napkin.rotation.z = lerp(0.35, -0.06, k);
    // the hand pushes it in by its left edge, then moves up onto the circle to tap it
    const circ = new THREE.Vector3(NAP_CIRCLE.x * S, NAP_CIRCLE.y * S, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), this.napkin.rotation.z).add(this.napkin.position);
    const reach = easeOutCubic(clamp((tap + 0.3) / 0.25));
    const edge = new THREE.Vector3(this.napkin.position.x - S / 2 - 0.42, this.napkin.position.y - 0.2, 0);
    const tip = edge.clone().lerp(circ.clone().add(new THREE.Vector3(-0.42, -0.04, 0)), reach);
    const press = tap >= 0 ? decay(tap, 0.1) : 0;
    this.hand.position.set(tip.x, tip.y, 0.2);
    this.hand.rotation.z = lerp(0.12, 0.02, reach);
    this.hand.scale.setScalar(1 + 0.06 * (1 - reach) - 0.05 * press);
    this.tap.root.position.set(circ.x, circ.y, 0.3);
    this.tap.set(tap, 1.1);
    // the magnifier slides in from the right and settles over the circle, bobbing a little
    const l = easeOutBack(clamp(lens), 1.4);
    this.lens.visible = lens > 0;
    const lx = lerp(circ.x + 3.2, circ.x + 0.08, l), ly = lerp(circ.y - 0.9, circ.y + 0.02, l) + 0.015 * Math.sin(t * 7);
    this.lens.position.set(lx, ly, 0.3);
    // the lens shows the napkin under its centre (napkin units, 0..1 across)
    const local = new THREE.Vector3(lx, ly, 0).sub(this.napkin.position).applyAxisAngle(new THREE.Vector3(0, 0, 1), -this.napkin.rotation.z);
    this.lensView.mesh.rotation.z = this.napkin.rotation.z;
    if (this.lens.visible) this.lensView.update({ u: local.x / S, v: local.y / S });
  }
}

// ---------------------------------------------------------------------------------------------
/** A cartoon bomb under a glass cocktail dome on a little plate. Origin on the plate's base. */
/** A jagged comic-book burst: n points, every one a little different (seeded, so it never shifts). */
function starShape(n: number, ro: number, ri: number, seed: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + 0.2;
    const r = i % 2 ? ri * (0.85 + 0.3 * hash(seed, i)) : ro * (0.8 + 0.35 * hash(seed, i));
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

export class DomeBomb {
  readonly root = new THREE.Group();
  readonly dome = new THREE.Group();
  private bomb = new THREE.Group();
  private spark = new THREE.Group();
  private sparkMat: THREE.MeshBasicMaterial;
  private flash: THREE.Mesh;
  private flashMat: THREE.MeshBasicMaterial;
  private kaboom = new THREE.Group();
  private kaboomMats: THREE.MeshBasicMaterial[] = [];
  private puffs: { g: THREE.Group; fill: THREE.MeshBasicMaterial; ink: THREE.MeshBasicMaterial; a: number; r: number }[] = [];
  private rimMat: THREE.MeshBasicMaterial;
  private ruler = new THREE.Group();
  private rulerMat: THREE.MeshBasicMaterial;
  static readonly R = 0.3;

  constructor() {
    const R = DomeBomb.R;
    // plate, side on
    this.root.add(inkedRect(R * 2 + 0.22, 0.045, 0.02, '#cfd3e6', 0.025));
    const foot = inkedRect(0.22, 0.05, 0.015, '#cfd3e6', 0.02);
    foot.position.y = -0.045;
    this.root.add(foot);
    // the bomb: black ball, a highlight, a cap and a curly fuse with a fizzing spark
    const ball = inkedCircle(0.1, '#1d1b26', 0.025);
    ball.position.y = 0.12;
    const hi = shapeMesh(arcShape(0.06, 0.025, 1.9, 2.8), '#6b6880', 0.004, 8);
    hi.position.y = 0.12;
    const cap = inkedRect(0.07, 0.04, 0.01, '#8a8aa0', 0.015);
    cap.position.set(0.04, 0.22, 0.008); // in front of the ball (at 0.002 its outline tied with the ball's fill)
    cap.rotation.z = -0.5;
    const fuse = shapeMesh(arcShape(0.06, 0.018, -0.2, 1.9), '#c9b48a', 0.005, 10);
    fuse.position.set(0.11, 0.25, 0.005);
    this.sparkMat = ownGlow(PAL.gold, 3);
    for (let i = 0; i < 6; i++) {
      const ray = shapeMesh(roundedRectShape(0.012, 0.05, 0.006, 0, 0.035), this.sparkMat, 0.004);
      ray.rotation.z = (i / 6) * Math.PI * 2;
      this.spark.add(ray);
    }
    this.spark.position.set(0.13, 0.31, 0.004);
    this.bomb.add(ball, hi, cap, fuse, this.spark);
    this.root.add(this.bomb);
    // the blast: a hot flash and puffs of smoke that stay inside the glass
    this.flashMat = lightMat('#ffd68a', 0, radialTexture());
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.4, R * 2.4), this.flashMat);
    this.flash.position.set(0, R * 0.55, 0.021);
    this.root.add(this.flash);
    // a cartoon KABOOM star (ink, orange, yellow) that bursts to the glass and shrinks into the smoke
    ([[1.14, INK], [1, '#ff8a1e'], [0.6, '#ffe45c']] as const).forEach(([k, col], j) => {
      const m = ownMat(col, 1, true);
      this.kaboomMats.push(m);
      this.kaboom.add(shapeMesh(starShape(11, R * 0.75 * k, R * 0.46 * k, 7), m, 0.02 + j * 0.0005));
    });
    this.kaboom.position.set(0, R * 0.62, 0);
    this.root.add(this.kaboom);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const ink = ownMat(INK, 1, true), fill = ownMat('#cfc8dd', 1, true);
      g.add(shapeMesh(circleShape(1.18), ink, 0, 14), shapeMesh(circleShape(1), fill, 0.001, 14));
      g.position.z = 0.01 + i * 0.001;
      this.root.add(g);
      this.puffs.push({ g, fill, ink, a: hash(i, 81) * Math.PI * 2, r: 0.3 + 0.55 * hash(i, 82) });
    }
    // the dome: thin glass, an ink line, a highlight and a knob; its rim glows green when bounded
    const domeShape = (rx: number, ry: number) => {
      const s = new THREE.Shape();
      s.moveTo(-rx, 0);
      s.absellipse(0, 0, rx, ry, Math.PI, 0, true, 0);
      s.lineTo(-rx, 0);
      return s;
    };
    // an ink line round the glass (not a fill, or the bomb and the blast would be hidden)
    const outline = shapeMesh(arcShape(R + 0.008, 0.026, 0, Math.PI), ownMat(INK, 0.9, true), 0.031, 32);
    outline.scale.y = 1.12;
    this.dome.add(outline);
    this.dome.add(shapeMesh(domeShape(R, R * 1.12), ownMat('#bfe6ff', 0.2, true), 0.03, 32));
    this.dome.add(shapeMesh(arcShape(R * 0.78, 0.03, Math.PI * 0.55, Math.PI * 0.85), ownGlow('#ffffff', 1.4), 0.033, 12));
    const knob = inkedCircle(0.045, '#cfd3e6', 0.02);
    knob.position.set(0, R * 1.12 + 0.04, 0.032);
    this.dome.add(knob);
    this.rimMat = ownGlow(PAL.green, 0);
    const rim = shapeMesh(roundedRectShape(R * 2 + 0.06, 0.03, 0.015), this.rimMat, 0.034);
    rim.position.y = 0.01;
    this.dome.add(rim);
    this.dome.position.y = 0.02;
    this.root.add(this.dome);
    // the radius: a dimension line from the bomb to the glass, end ticks and an arrowhead
    this.rulerMat = ownGlow(PAL.cyan, 0);
    const line = shapeMesh(roundedRectShape(R, 0.012, 0.006, R / 2, 0), this.rulerMat, 0);
    const tick = shapeMesh(roundedRectShape(0.012, 0.07, 0.006), this.rulerMat, 0);
    const end = shapeMesh(roundedRectShape(0.012, 0.07, 0.006, R, 0), this.rulerMat, 0);
    this.ruler.add(line, tick, end);
    this.ruler.position.set(0, 0.12, 0.036);
    this.root.add(this.ruler);
  }

  /** boom: seconds since it went off (negative = the fuse is still fizzing). ruler: 0..1 the
   *  radius line drawn out to the glass; bound: 0..1 the rim lights green; tink: seconds since a
   *  finger tapped the glass. */
  set(t: number, boom: number, ruler: number, bound: number, tink = -1) {
    const R = DomeBomb.R;
    const blown = boom >= 0;
    this.bomb.visible = !blown;
    this.spark.rotation.z = t * 20;
    this.spark.scale.setScalar(0.8 + 0.4 * hash(Math.floor(t * 30), 3));
    setGlow(this.sparkMat, PAL.gold, 3);
    this.flash.visible = blown && boom < 0.6;
    this.flashMat.opacity = blown ? 1.4 * decay(boom, 0.12) : 0;
    this.flash.scale.setScalar(blown ? 0.6 + 0.5 * easeOutCubic(clamp(boom / 0.15)) : 1);
    const kb = blown ? easeOutBack(clamp(boom / 0.1), 2.4) * (1 - easeOutCubic(clamp((boom - 0.22) / 0.3))) : 0;
    this.kaboom.visible = kb > 0.01;
    this.kaboom.scale.set(Math.max(0.01, kb), Math.max(0.01, kb) * 0.75, 1);
    this.kaboom.rotation.z = boom * 0.8;
    // smoke: bursts out to the glass, then curls round inside it, slowly thinning
    this.puffs.forEach((p, i) => {
      const on = blown && boom < 6;
      p.g.visible = on;
      if (!on) return;
      const out = easeOutCubic(clamp(boom / 0.25));
      const swirl = p.a + boom * (0.9 + 0.3 * hash(i, 83));
      const rr = p.r * out * R * 0.72;
      p.g.position.set(Math.cos(swirl) * rr, R * 0.5 + Math.sin(swirl) * rr * 0.85, p.g.position.z);
      p.g.scale.setScalar((0.05 + 0.06 * hash(i, 84)) * (0.4 + 0.6 * out) * (1 + 0.15 * Math.sin(boom * 3 + i)));
      const a = clamp(1.2 - boom * 0.12);
      p.fill.opacity = a * 0.95;
      p.ink.opacity = a * 0.6;
    });
    // the glass jumps on the blast, rattles back down and settles; a tap makes it ring
    const hop = blown ? Math.max(0, Math.sin(clamp(boom / 0.22) * Math.PI)) * 0.09 : 0;
    const rattle = blown ? Math.sin(boom * 60) * 0.06 * decay(boom - 0.2, 0.15) * (boom > 0.2 ? 1 : 0) : 0;
    const ring = tink >= 0 ? Math.sin(tink * 70) * 0.025 * decay(tink, 0.12) : 0;
    this.dome.position.set(0, 0.02 + hop, 0);
    this.dome.rotation.z = rattle + ring;
    setGlow(this.rimMat, PAL.green, 2.4 * clamp(bound) * (0.85 + 0.15 * Math.sin(t * 9)));
    this.ruler.visible = ruler > 0.01;
    this.ruler.scale.set(Math.max(0.01, clamp(ruler)), 1, 1);
    setGlow(this.rulerMat, bound > 0.5 ? PAL.green : PAL.cyan, 2.2);
  }
}

// ---------------------------------------------------------------------------------------------
/** A little whiteboard of a graph (errors spiking, then flat), held up in a paw. Origin at the
 *  card's bottom edge. */
export function graphCard() {
  const g = new THREE.Group();
  const card = inkedRect(0.72, 0.52, 0.04, '#f4f1ea', 0.035);
  card.position.y = 0.26;
  g.add(card);
  const plot = canvasPlane(0.64, 0.44, 400, (c, _f: number, W, H) => {
    c.strokeStyle = '#8a8fb0'; c.lineWidth = W * 0.012;
    c.beginPath(); c.moveTo(W * 0.08, H * 0.08); c.lineTo(W * 0.08, H * 0.9); c.lineTo(W * 0.96, H * 0.9); c.stroke();
    // a jagged red climb, a big spike, then a calm green line along the bottom
    const pts: [number, number][] = [[0.1, 0.7], [0.16, 0.62], [0.22, 0.66], [0.28, 0.5], [0.34, 0.56], [0.4, 0.22], [0.46, 0.44]];
    c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = W * 0.022;
    c.strokeStyle = '#e0142c';
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H))); c.stroke();
    c.strokeStyle = '#1aa85a';
    c.beginPath(); c.moveTo(0.46 * W, 0.44 * H); c.lineTo(0.56 * W, 0.78 * H); c.lineTo(0.94 * W, 0.8 * H); c.stroke();
  });
  plot.update(0);
  cutout(plot.mesh);
  plot.mesh.position.set(0, 0.26, 0.008);
  g.add(plot.mesh);
  return g;
}

// ---------------------------------------------------------------------------------------------
/** A zip in the dance floor along a seam between two rows of tiles. Unzipped, it opens into a
 *  glowing pit of wiring with a steel girder across it. Lies on the floor (y up). */
export class FloorSeam {
  readonly root = new THREE.Group();
  private teeth: THREE.InstancedMesh;
  private pull = new THREE.Group();
  private pit: ReturnType<typeof canvasPlane<{ t: number; open: number; glow: number }>>;
  private glowMat: THREE.MeshBasicMaterial;
  private glow: THREE.Mesh;
  private m4 = new THREE.Matrix4();

  constructor(readonly len = 3.2, readonly gape = 0.62) {
    const n = Math.round(len / 0.05);
    const tooth = new THREE.PlaneGeometry(0.035, 0.05);
    tooth.rotateX(-Math.PI / 2);
    this.teeth = new THREE.InstancedMesh(tooth, ownMat('#c9c5d8'), n);
    for (let i = 0; i < n; i++) {
      // right to left, so the first `count` instances are the teeth still zipped
      this.m4.makeTranslation(len / 2 - 0.025 - i * 0.05, 0.006, (i % 2 ? 1 : -1) * 0.022);
      this.teeth.setMatrixAt(i, this.m4);
    }
    // (a fixed bounding sphere: the teeth never move)
    this.teeth.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), len);
    this.root.add(this.teeth);
    // the pit, drawn on a plane lying over the seam: a lens-shaped hole as far as the pull has gone
    this.pit = canvasPlane(len + 0.2, gape + 0.2, 220, (g, v: { t: number; open: number; glow: number }, W, H) => {
      const u = W / (len + 0.2);
      const x0 = 0.1 * u, x1 = x0 + v.open * len * u, cy = H / 2;
      if (v.open <= 0.001) return;
      const half = (x: number) => Math.sin(clamp((x - x0) / Math.max(1, x1 - x0)) * Math.PI) * gape * 0.5 * u * Math.min(1, v.open * 3);
      const lens = () => {
        g.beginPath(); g.moveTo(x0, cy);
        for (let x = x0; x <= x1; x += 2) g.lineTo(x, cy - half(x));
        for (let x = x1; x >= x0; x -= 2) g.lineTo(x, cy + half(x));
        g.closePath();
      };
      // torn tile edges, then the dark inside
      lens(); g.lineWidth = 0.05 * u; g.strokeStyle = '#2a2142'; g.stroke();
      g.save(); lens(); g.clip();
      g.fillStyle = '#05030c'; g.fillRect(0, 0, W, H);
      // wiring: bundles of glowing cable snaking along the seam
      const cols = ['#2fe2ff', '#ff3ea5', '#ffc23d', '#45ff8a'];
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        g.strokeStyle = cols[i % 4]; g.lineWidth = (0.035 + 0.02 * hash(i, 5)) * u;
        g.shadowColor = cols[i % 4]; g.shadowBlur = 0.12 * u * v.glow;
        g.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const y = cy + (hash(i, 6) - 0.5) * gape * 0.7 * u + Math.sin(x / u * (2 + hash(i, 7) * 3) + i + v.t * 0.8) * 0.06 * u;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.shadowBlur = 0;
      // the load-bearing girder: a steel I-beam right across the hole, riveted
      const bx = x0 + (x1 - x0) * 0.55;
      g.fillStyle = '#8d93a8'; g.fillRect(bx - 0.13 * u, 0, 0.26 * u, H);
      g.fillStyle = '#b9bfd2'; g.fillRect(bx - 0.13 * u, 0, 0.05 * u, H);
      g.fillStyle = '#5d6178'; g.fillRect(bx + 0.08 * u, 0, 0.05 * u, H);
      g.fillStyle = '#3b3f52';
      for (let y = 0.1 * u; y < H; y += 0.16 * u) { g.beginPath(); g.arc(bx - 0.06 * u, y, 0.018 * u, 0, Math.PI * 2); g.arc(bx + 0.06 * u, y + 0.08 * u, 0.018 * u, 0, Math.PI * 2); g.fill(); }
      g.restore();
    });
    this.pit.mesh.rotation.x = -Math.PI / 2;
    this.pit.mesh.position.y = 0.01;
    this.root.add(this.pit.mesh);
    this.glowMat = lightMat('#7fe8ff', 0, radialTexture());
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(len * 1.1, 1.8), this.glowMat);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.03;
    this.root.add(this.glow);
    // the pull tab: a little steel slider and a ring, standing up off the floor a touch
    const slider = inkedRect(0.12, 0.09, 0.02, '#d9dbe8', 0.02);
    const tab = inkedRect(0.07, 0.16, 0.03, '#c9c5d8', 0.02);
    tab.position.set(0, -0.12, -0.008); // behind the slider (at 0.002 its outline tied with the slider's fill)
    const hole = shapeMesh(roundedRectShape(0.03, 0.06, 0.015, 0, -0.14), '#1d1b26', -0.003);
    this.pull.add(slider, tab, hole);
    this.pull.rotation.x = -Math.PI / 2 + 0.5;
    this.root.add(this.pull);
  }

  /** open: 0 zipped .. 1 unzipped the whole way; glow: the light from the pit. */
  set(t: number, open: number, glow: number) {
    const o = clamp(open);
    this.pit.update({ t, open: o, glow });
    this.pit.mesh.visible = o > 0.001;
    this.pull.position.set(-this.len / 2 + o * this.len, 0.04, 0);
    // unzipped teeth are hidden (they've parted to the edges of the hole)
    this.teeth.count = Math.max(0, Math.round((1 - o) * this.teeth.instanceMatrix.count));
    this.glowMat.opacity = 0.55 * glow * o;
    this.glow.position.x = -this.len / 2 + o * this.len * 0.5;
    this.glow.scale.x = Math.max(0.05, o);
  }
}

// ---------------------------------------------------------------------------------------------
/** A cartoon flower on a stem, standing up (a billboard). Origin at the stem's foot. */
export function flower(petal: string, i = 0) {
  const g = new THREE.Group();
  const stem = inkedRect(0.035, 0.32, 0.01, '#3fbf6b', 0.02);
  stem.position.y = 0.16;
  const leaf = shapeMesh(new THREE.Shape().absellipse(0, 0, 0.07, 0.03, 0, Math.PI * 2, false, 0), '#3fbf6b', 0.002, 10);
  leaf.position.set(0.05, 0.12, 0.002);
  leaf.rotation.z = 0.5;
  g.add(stem, leaf);
  const head = new THREE.Group();
  head.position.y = 0.36;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + i;
    const p = inkedCircle(0.065, petal, 0.02);
    p.position.set(Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0.003);
    head.add(p);
  }
  const mid = inkedCircle(0.05, PAL.gold, 0.02);
  mid.position.z = 0.008;
  head.add(mid);
  g.add(head);
  return g;
}

/** A smiling sun sticker, lying flat (y up). */
export function sunSticker() {
  const g = new THREE.Group();
  const face = new THREE.Group();
  face.rotation.x = -Math.PI / 2;
  const back = shapeMesh(circleShape(0.62), '#fff7ea', 0, 40);   // the sticker's white margin
  face.add(back);
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Shape();
    s.moveTo(-0.06, 0.38); s.lineTo(0.06, 0.38); s.lineTo(0, 0.55); s.closePath();
    const ray = shapeMesh(s, '#ffb23d', 0.002, 1);
    ray.rotation.z = (i / 12) * Math.PI * 2;
    face.add(ray);
  }
  face.add(shapeMesh(circleShape(0.38), PAL.ink, 0.003, 32), shapeMesh(circleShape(0.35), '#ffd84a', 0.004, 32));
  for (const side of [-1, 1]) {
    const eye = shapeMesh(roundedRectShape(0.05, 0.08, 0.025), PAL.ink, 0.006);
    eye.position.set(side * 0.11, 0.07, 0);
    eye.position.z = 0.006;
    const cheek = shapeMesh(circleShape(0.05), '#ff8fa8', 0.005, 12);
    cheek.position.set(side * 0.2, -0.04, 0.005);
    face.add(eye, cheek);
  }
  const smile = shapeMesh(arcShape(0.15, 0.04, Math.PI * 1.15, Math.PI * 1.85), PAL.ink, 0.007, 16);
  smile.position.set(0, 0.03, 0.007);
  face.add(smile);
  g.add(face);
  return g;
}

// ---------------------------------------------------------------------------------------------
/** The big red RUN button: a hazard-striped base and a red dome that goes down when slammed. */
export class RunButton {
  readonly root = new THREE.Group();
  private cap = new THREE.Group();
  private lamp: THREE.MeshBasicMaterial;
  readonly burst = new Burst(PAL.red, 12);

  constructor() {
    const base = inkedRect(0.62, 0.2, 0.04, '#ffc23d', 0.035);
    base.position.y = 0.1;
    this.root.add(base);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Shape();
      const x = -0.28 + i * 0.13;
      s.moveTo(x, 0.02); s.lineTo(x + 0.06, 0.02); s.lineTo(x + 0.12, 0.18); s.lineTo(x + 0.06, 0.18); s.closePath();
      this.root.add(shapeMesh(s, '#1d1b26', 0.004, 1));
    }
    const collar = inkedRect(0.44, 0.06, 0.02, '#3b3f52', 0.03);
    collar.position.set(0, 0.23, 0.014); // in front of the dome's base (at 0.006 it tied with the dome)
    this.root.add(collar);
    this.lamp = ownGlow(PAL.red, 1.2);
    const dome = new THREE.Shape();
    dome.moveTo(-0.19, 0); dome.absellipse(0, 0, 0.19, 0.15, Math.PI, 0, true, 0); dome.lineTo(-0.19, 0);
    const domeInk = new THREE.Shape();
    domeInk.moveTo(-0.22, -0.01); domeInk.absellipse(0, -0.01, 0.22, 0.18, Math.PI, 0, true, 0); domeInk.lineTo(-0.22, -0.01);
    this.cap.add(shapeMesh(domeInk, INK, 0, 24), shapeMesh(dome, this.lamp, 0.002, 24));
    this.cap.add(shapeMesh(arcShape(0.12, 0.03, Math.PI * 0.55, Math.PI * 0.85), ownGlow('#ffffff', 1.5), 0.004, 8));
    this.cap.position.set(0, 0.25, 0.006);
    this.root.add(this.cap);
    this.burst.root.position.set(0, 0.42, 0.05);
    this.root.add(this.burst.root);
  }

  /** hit: seconds since it was slammed (negative = not yet). */
  set(t: number, hit: number) {
    const down = hit >= 0 ? clamp(1 - Math.max(0, hit - 0.08) / 0.25) : 0;
    this.cap.scale.set(1 + 0.08 * down, 1 - 0.55 * down, 1);
    setGlow(this.lamp, PAL.red, hit >= 0 ? 1.3 + 1.4 * decay(hit, 0.3) : 1.1 + 0.15 * Math.sin(t * 6));
    this.burst.set(hit, 1.6);
  }
}

/** A cartoon glint (a four-point star) for "clean" sparkles. */
export function glint(color = '#ffffff', power = 2.6) {
  const g = new THREE.Group();
  const mat = ownGlow(color, power);
  for (const rot of [0, Math.PI / 2]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.2); s.lineTo(0.04, 0); s.lineTo(0, -0.2); s.lineTo(-0.04, 0); s.closePath();
    const m = shapeMesh(s, mat, 0, 1);
    m.rotation.z = rot;
    g.add(m);
  }
  return Object.assign(g, { mat });
}
