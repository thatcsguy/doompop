// Props for the final chorus and the outro: confetti, the sticking plaster that survives
// production, and the cutaway of the club as a building of dance floors (one per tier). Every
// set(...) sets everything it animates from song time.
import * as THREE from 'three';
import { INK, arcShape, circleShape, inkedCircle, inkedRect, ownMat, roundedRectShape, shapeMesh, staticPlane } from '../../engine/flat';
import { clamp, decay, easeOutBack, lerp } from '../../engine/ease';
import { hash } from '../../engine/rng';
import { PAL, SIGN_FONT, UI_FONT, cutout, glowMat, lightMat, ownGlow, radialTexture, setGlow } from './look';
import { Dancer, dancePose, frozenPose, outfit } from './people';
import { Burst } from './props';

// ---------------------------------------------------------------------------------------------
/** Confetti from cannons: each piece flies up, slows, flutters down and lies on the floor. */
export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private pieces: { dt: number; v: THREE.Vector3; spin: THREE.Vector3; wob: number; ph: number; w: number; h: number }[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();

  /** cannons: launch points; aim: the direction each one fires (it spreads round that). */
  constructor(private cannons: THREE.Vector3[], private aim: THREE.Vector3[], n = 260) {
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
    // animated instances fly all over the club: never cull the batch
    this.mesh.frustumCulled = false;
    const cols = [PAL.pink, PAL.cyan, PAL.gold, PAL.violetNeon, PAL.green, '#ffffff', '#ff7a3d'];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = aim[i % aim.length];
      const sp = 0.55;
      const v = new THREE.Vector3(a.x + (hash(i, 1) - 0.5) * sp * 2, a.y * (0.75 + 0.45 * hash(i, 2)), a.z + (hash(i, 3) - 0.5) * sp * 2);
      this.pieces.push({
        dt: hash(i, 4) * 0.22, v,
        spin: new THREE.Vector3((hash(i, 5) - 0.5) * 14, (hash(i, 6) - 0.5) * 10, (hash(i, 7) - 0.5) * 12),
        wob: 0.12 + 0.2 * hash(i, 8), ph: hash(i, 9) * 6.3, w: 0.07 + 0.04 * hash(i, 10), h: 0.11 + 0.06 * hash(i, 11),
      });
      this.mesh.setColorAt(i, c.set(cols[Math.floor(hash(i, 12) * cols.length)]).multiplyScalar(1.15));
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  /** t: song time; shots: the cannons' firing times (pieces split between them). */
  set(t: number, shots: number[]) {
    const TC = 0.42, VT = 0.9;   // drag time constant, fall speed
    this.pieces.forEach((pc, i) => {
      const t0 = shots[i % shots.length] + pc.dt;
      const c = this.cannons[Math.floor(i / shots.length) % this.cannons.length];
      let tau = t - t0;
      if (tau < 0) {
        this.m4.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m4);
        return;
      }
      // the drag eases the launch off into a steady flutter down; it lands when that reaches the floor
      const rise = (vy: number) => (vy + VT) * TC;
      const land = (c.y + rise(pc.v.y)) / VT;
      const landed = tau >= land;
      tau = Math.min(tau, land);
      const ease = TC * (1 - Math.exp(-tau / TC));
      const flutter = pc.wob * Math.sin(tau * 3.1 + pc.ph) * clamp(tau);
      this.p.set(c.x + pc.v.x * ease + flutter, Math.max(0.012, c.y + (pc.v.y + VT) * ease - VT * tau), c.z + pc.v.z * ease + flutter * 0.4);
      if (landed) this.e.set(-Math.PI / 2, 0, pc.ph);
      else this.e.set(pc.spin.x * tau, pc.spin.y * tau, pc.spin.z * tau);
      this.q.setFromEuler(this.e);
      this.sc.set(pc.w, pc.h, 1);
      this.m4.compose(this.p, this.q, this.sc);
      this.mesh.setMatrixAt(i, this.m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------
/** The patch: a sticking plaster with a face, lying flat on the floor over the seam. Built in the
 *  xy plane (the root lies it down). Its ends flap up like arms when it cheers. */
export class Plaster {
  readonly root = new THREE.Group();
  private wings: THREE.Group[] = [];
  private eyes: THREE.Group[] = [];
  private squint: THREE.Group[] = [];
  private happy: THREE.Object3D[] = [];
  private smile: THREE.Mesh;
  private grin: THREE.Mesh;
  private face = new THREE.Group();
  readonly dust: Burst;

  constructor(readonly len = 1.5, readonly wid = 0.52) {
    const tan = '#f0b98c', pad = '#fbe8cf', hole = '#c98d63';
    const flat = new THREE.Group();
    flat.rotation.x = -Math.PI / 2;
    this.root.add(flat);
    // the two sticky ends, hinged at the pad's edges so they can lift
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.x = side * 0.25;
      const wing = inkedRect(len / 2 - 0.18, wid, wid * 0.45, tan, 0.035);
      wing.position.x = side * (len / 4 - 0.09);
      hinge.add(wing);
      for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
        const d = shapeMesh(circleShape(0.016), hole, 0.003, 6);
        d.position.set(side * (0.1 + k * 0.11), (r - 0.5) * wid * 0.4, 0.003);
        hinge.add(d);
      }
      flat.add(hinge);
      this.wings.push(hinge);
    }
    // the middle: tan strip under the pad
    flat.add(inkedRect(0.56, wid, 0.04, tan, 0.035));
    const padMesh = shapeMesh(roundedRectShape(0.46, wid * 0.78, 0.05), pad, 0.004);
    flat.add(padMesh);
    // the face, on the pad
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.add(shapeMesh(circleShape(0.042), INK, 0.006, 10));
      const shine = shapeMesh(circleShape(0.013), '#ffffff', 0.007, 6);
      shine.position.set(0.012, 0.014, 0);
      eye.add(shine);
      eye.position.set(side * 0.1, 0.05, 0);
      this.face.add(eye);
      this.eyes.push(eye);
      // squeezed shut (> <) while it's stood on
      const sq = new THREE.Group();
      for (const s2 of [-1, 1]) {
        const bar = shapeMesh(roundedRectShape(0.07, 0.018, 0.009), INK, 0.006);
        bar.rotation.z = side * s2 * 0.45;
        bar.position.y = s2 * 0.014;
        sq.add(bar);
      }
      sq.position.set(side * 0.1, 0.05, 0);
      this.face.add(sq);
      this.squint.push(sq);
      // happy arcs (^ ^), on the eyes' layer (at z 0 they sat under the pad and never showed)
      const hp = shapeMesh(arcShape(0.04, 0.02, 0.2, Math.PI - 0.2), INK, 0.006, 8);
      hp.position.set(side * 0.1, 0.035, 0.006);
      this.face.add(hp);
      this.happy.push(hp);
    }
    // the smile stays on all the way through (Patrick, 2:45): pressed flat while it's stood on, and
    // on the cheer it widens and opens into a grin, a mouth that fills the curve under its ink
    this.smile = shapeMesh(arcShape(0.06, 0.02, Math.PI * 1.15, Math.PI * 1.85), INK, 0.01, 10);
    const lip = 0.058 * Math.sin(0.36);      // the mouth's top edge, level with the smile's ends
    this.grin = shapeMesh(new THREE.Shape().absarc(0, lip, 0.058, Math.PI + 0.36, Math.PI * 2 - 0.36, false), '#7a2a3a', -0.004, 12);
    this.grin.position.y = -lip;
    this.smile.add(this.grin);
    const cheeks = [-1, 1].map(side => {
      const ch = shapeMesh(circleShape(0.03), '#ff9fb0', 0.005, 8);
      ch.position.set(side * 0.16, -0.01, 0);
      return ch;
    });
    this.face.add(this.smile, ...cheeks);
    this.face.position.z = 0.002;
    flat.add(this.face);
    // the puff from a stomp comes out from under it (lying on top, its glow bleached the face)
    this.dust = new Burst('#fff2df', 10);
    this.dust.root.rotation.x = -Math.PI / 2;
    this.dust.root.position.y = -0.006;
    this.root.add(this.dust.root);
  }

  /** squash: 0..1 being stood on; cheer: 0..1 ends up and a big grin; dust: seconds since a stomp. */
  set(t: number, squash: number, cheer: number, dust = -1) {
    const sq = clamp(squash);
    this.root.scale.set(1 + 0.08 * sq, 1, 1 - 0.06 * sq);
    this.eyes.forEach(e => { e.visible = sq < 0.5 && cheer < 0.5; });
    this.squint.forEach(e => { e.visible = sq >= 0.5; });
    this.happy.forEach(e => { e.visible = sq < 0.5 && cheer >= 0.5; });
    const c = clamp(cheer);
    this.smile.scale.set((1 + 0.2 * sq) * (1 + 0.45 * c), (1 - 0.3 * sq) * (1 + 0.6 * c), 1);
    this.grin.visible = c > 0.01;
    this.grin.scale.set(1, Math.max(0.01, c), 1);
    const flap = cheer * (0.75 + 0.25 * Math.sin(t * 16));
    this.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * flap * 0.9; });
    this.dust.set(dust, 0.95);
  }
}

// ---------------------------------------------------------------------------------------------
/** The club as a building of dance floors, cut away: EDGE on top, then WEB, API and DB, each a
 *  little dance floor with three dancers. A glowing request drops down the shaft through them;
 *  each floor lights up as it passes. Laid out in the xy plane, origin at the building's foot. */
export const TIERS = ['EDGE', 'WEB', 'API', 'DB'];
const TIER_H = 1.35, TIER_W = 6.2;
export class TierStack {
  readonly root = new THREE.Group();
  private floors: { tiles: THREE.MeshBasicMaterial[]; dancers: Dancer[]; check: THREE.Group; glow: THREE.MeshBasicMaterial; label: THREE.MeshBasicMaterial; burst: Burst }[] = [];
  private packet = new THREE.Group();
  private ballMat: THREE.MeshBasicMaterial;
  private sky: THREE.Mesh;
  static readonly TOP = TIERS.length * TIER_H;

  constructor() {
    // the night behind: a skyline of other buildings with lit windows, and stars
    this.sky = staticPlane(30, 14, 48, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0d0a2a'); grad.addColorStop(1, '#2a1650');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * hash(i, 41)})`;
        g.fillRect(hash(i, 42) * W, hash(i, 43) * H * 0.55, 2 + 2 * hash(i, 44), 2 + 2 * hash(i, 44));
      }
      for (let b = 0; b < 16; b++) {
        const bw = W * (0.04 + 0.05 * hash(b, 45)), bh = H * (0.25 + 0.4 * hash(b, 46)), bx = (b / 16) * W + (hash(b, 47) - 0.5) * W * 0.04;
        g.fillStyle = b % 2 ? '#150f33' : '#1c1440';
        g.fillRect(bx, H - bh, bw, bh);
        for (let wy = H - bh + 10; wy < H - 8; wy += 16) for (let wx = bx + 6; wx < bx + bw - 8; wx += 14) {
          if (hash(Math.floor(wx), Math.floor(wy), b) < 0.35) { g.fillStyle = hash(b, wx, wy) < 0.5 ? '#ffd27a' : '#7fd8ff'; g.fillRect(wx, wy, 6, 8); }
        }
      }
    });
    this.sky.position.set(0, 4.2, -3);
    this.root.add(this.sky);
    // the building's shell: side walls, a slab under each floor, a roof with the sign and a ball
    const wall = '#2b1d55', slab = '#3a2a6e';
    for (const side of [-1, 1]) {
      const w = inkedRect(0.3, TierStack.TOP + 0.3, 0.02, wall, 0.05);
      w.position.set(side * (TIER_W / 2 + 0.15), TierStack.TOP / 2 + 0.15, 0.05);
      this.root.add(w);
    }
    TIERS.forEach((name, k) => {
      const i = TIERS.length - 1 - k;      // floor index from the bottom (DB is 0)
      const y0 = i * TIER_H;
      const back = shapeMesh(roundedRectShape(TIER_W, TIER_H - 0.12, 0.02, 0, y0 + TIER_H / 2 + 0.06), '#140e30', -0.05);
      this.root.add(back);
      const glow = lightMat(PAL.violetNeon, 0, radialTexture());
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(TIER_W * 0.9, TIER_H * 1.1), glow);
      gm.position.set(0, y0 + TIER_H * 0.55, -0.04);
      this.root.add(gm);
      const s = inkedRect(TIER_W + 0.2, 0.14, 0.02, slab, 0.04);
      s.position.set(0, y0 + 0.07, 0.04);
      this.root.add(s);
      // a strip of floor tiles along the slab
      const tiles: THREE.MeshBasicMaterial[] = [];
      for (let j = 0; j < 12; j++) {
        const m = ownMat(PAL.tileDead);
        const tile = shapeMesh(roundedRectShape(0.44, 0.1, 0.02), m, 0.06);
        tile.position.set(-TIER_W / 2 + 0.3 + j * 0.51, y0 + 0.2, 0);
        this.root.add(tile);
        tiles.push(m);
      }
      // three tiny dancers
      const dancers = [0, 1, 2].map(d => {
        const dn = new Dancer(outfit(k * 3 + d + 2), 0.34);
        dn.root.position.set(-1.6 + d * 1.6 + (d === 1 ? 0.3 : 0), y0 + 0.25, 0.02);
        this.root.add(dn.root);
        return dn;
      });
      // the label on the left wall, and a check mark that pops when the floor lights
      const lp = staticPlane(1.3, 0.42, 200, (g, W, H) => {
        g.fillStyle = '#ffffff'; g.font = `400 ${H * 0.7}px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(name, W / 2, H * 0.55);
      });
      cutout(lp, 0.3);
      const label = lp.material as THREE.MeshBasicMaterial;
      lp.position.set(-TIER_W / 2 + 0.9, y0 + TIER_H - 0.32, 0.03);
      this.root.add(lp);
      const check = new THREE.Group();
      check.add(inkedCircle(0.2, '#1aa85a', 0.04));
      const tick = new THREE.Shape();
      tick.moveTo(-0.1, 0.0); tick.lineTo(-0.03, -0.07); tick.lineTo(0.11, 0.08); tick.lineTo(0.08, 0.11); tick.lineTo(-0.03, -0.01); tick.lineTo(-0.07, 0.03); tick.closePath();
      check.add(shapeMesh(tick, '#ffffff', 0.01));
      check.position.set(TIER_W / 2 - 0.45, y0 + TIER_H - 0.35, 0.06);
      this.root.add(check);
      const burst = new Burst(PAL.green, 10);
      burst.root.position.set(TIER_W / 2 - 0.45, y0 + TIER_H - 0.35, 0.07);
      this.root.add(burst.root);
      this.floors.push({ tiles, dancers, check, glow, label, burst });
    });
    // the roof: a slab, the CLUB PROD sign and a little disco ball on a stalk
    const roof = inkedRect(TIER_W + 0.6, 0.22, 0.03, slab, 0.05);
    roof.position.set(0, TierStack.TOP + 0.11, 0.04);
    this.root.add(roof);
    const sign = staticPlane(3.4, 0.7, 160, (g, W, H) => {
      g.fillStyle = PAL.pink; g.font = `400 ${H * 0.62}px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = PAL.pink; g.shadowBlur = H * 0.2;
      g.fillText('CLUB PROD', W / 2, H * 0.55);
    });
    cutout(sign, 0.3);
    (sign.material as THREE.MeshBasicMaterial).color.setScalar(2.2);
    sign.position.set(-1.0, TierStack.TOP + 0.62, 0.03);
    this.root.add(sign);
    const stalk = inkedRect(0.05, 0.5, 0.01, '#8a8fb0', 0.02);
    stalk.position.set(2.0, TierStack.TOP + 0.47, 0.03);
    this.ballMat = ownGlow('#d8dcf0', 1.2);
    const ball = new THREE.Group();
    ball.add(inkedCircle(0.3, this.ballMat, 0.04));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const f = shapeMesh(roundedRectShape(0.09, 0.09, 0.01, (c - 1) * 0.13, (r - 1) * 0.13), ownGlow('#ffffff', 0.9 + 0.8 * hash(r, c, 3)), 0.005);
      ball.add(f);
    }
    ball.position.set(2.0, TierStack.TOP + 1.0, 0.04);
    this.root.add(stalk, ball);
    // the shaft down the middle and the request dropping through it
    const shaft = shapeMesh(roundedRectShape(0.08, TierStack.TOP, 0.04, 0, TierStack.TOP / 2), glowMat('#3a2f7a', 1), 0.01);
    shaft.position.x = 0.5;
    this.root.add(shaft);
    const env = inkedRect(0.44, 0.3, 0.04, '#e8fdff', 0.035);
    const flap = new THREE.Shape();
    flap.moveTo(-0.2, 0.13); flap.lineTo(0, -0.02); flap.lineTo(0.2, 0.13);
    flap.lineTo(0.17, 0.13); flap.lineTo(0, 0.02); flap.lineTo(-0.17, 0.13);
    this.packet.add(env, shapeMesh(flap, '#5a6fa0', 0.01));
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), lightMat(PAL.cyan, 0.55, radialTexture()));
    halo.position.z = -0.02;
    this.packet.add(halo);
    this.root.add(this.packet);
  }

  /** lit: the time each floor (top first) lights up; beat for the dancing. */
  set(t: number, beat: number, lit: number[]) {
    const cols = [PAL.pink, PAL.cyan, PAL.gold, PAL.violetNeon, '#3dff9e', '#ff7a3d'];
    const n = Math.floor(Math.max(0, beat)), ph = Math.max(0, beat) - n;
    this.floors.forEach((fl, k) => {
      const on = t >= lit[k];
      const pop = on ? decay(t - lit[k], 0.25) : 0;
      fl.tiles.forEach((m, j) => {
        if (!on) { m.color.set(hash(k, j, 9) < 0.3 ? PAL.red : PAL.tileDead).multiplyScalar(hash(k, j, 9) < 0.3 ? 0.7 : 1); return; }
        const c = cols[(j + n + k) % cols.length];
        m.color.set(c).multiplyScalar(1.2 + 0.6 * pop + 0.25 * Math.exp(-ph * 4));
      });
      fl.dancers.forEach((d, j) => {
        const i = k * 3 + j + 2;
        d.set(on ? dancePose(i, beat, 1) : frozenPose(i), on ? 0 : 1, t + j * 0.4, 1, 0);
      });
      const ck = on ? easeOutBack(clamp((t - lit[k]) / 0.25), 2.4) : 0;
      fl.check.visible = ck > 0.01;
      fl.check.scale.setScalar(Math.max(0.01, ck));
      fl.glow.opacity = on ? 0.3 + 0.35 * pop : 0;
      fl.label.color.set(on ? PAL.gold : '#6a6194').multiplyScalar(on ? 1.1 : 1);
      fl.burst.set(on ? t - lit[k] : -1, 0.75);
    });
    // the request: in at the roof, down the shaft, stopping at each floor as it lights
    const ys = TIERS.map((_, k) => (TIERS.length - 1 - k) * TIER_H + TIER_H * 0.55);
    let y = TierStack.TOP + 1.2;
    if (t >= lit[0] - 0.3) {
      const seg = lit.findIndex(l => t < l);
      if (seg === -1) y = ys[ys.length - 1];
      else if (seg === 0) y = lerp(TierStack.TOP + 1.2, ys[0], clamp((t - (lit[0] - 0.3)) / 0.3));
      else y = lerp(ys[seg - 1], ys[seg], clamp((t - (lit[seg] - 0.22)) / 0.22));
    }
    this.packet.position.set(0.5, y, 0.12);
    this.packet.rotation.z = 0.15 * Math.sin(t * 9);
    setGlow(this.ballMat, '#d8dcf0', 1.2 + 0.4 * Math.sin(t * 6));
  }
}
