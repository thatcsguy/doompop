// Intro (0:00 to 0:14.6, instrumental). Storyboard rows 0a and 0b: rain outside Club PROD as the
// neon buzzes on and the dead floor shows through the window; a pager on the bar buzzes PROD DOWN;
// black, a spotlight, and DJ Detective Clawd rises into it and snaps on the impact at 0:13.6.
import * as THREE from 'three';
import type { Shot } from '../../../engine/types';
import type { AudioData } from '../../../engine/song';
import { inkedRect, ownMat, roundedRectShape, shapeMesh } from '../../../engine/flat';
import { clamp, decay, easeInOutCubic, easeOutCubic, lerp } from '../../../engine/ease';
import { hash } from '../../../engine/rng';
import { PAL, aimCam, beamTexture, glowMat, lightMat, ownGlow, radialTexture, setGlow } from '../look';
import { BAR } from '../club';
import { FACADE_Z, buzzOn } from '../street';
import { DiscoClawd, DISCO_MOODS, REST, ARM_LEN } from '../clawd-disco';
import { Burst, Pager, lightPool } from '../props';
import { getStreet, shot } from './common';

/** PROD keeps dropping out once it's lit: brief dark gaps, never more than ~2 a second. */
function sputter(t: number) {
  const slot = Math.floor(t / 0.55), ph = t / 0.55 - slot;
  return hash(slot, 97) < 0.3 && ph > 0.4 && ph < 0.62 ? 0.08 : 1;
}
/** The OPEN sign is mostly dead, with the odd hopeful blink. */
function openFlicker(t: number) {
  const slot = Math.floor(t / 0.8), ph = t / 0.8 - slot;
  return hash(slot, 98) < 0.35 && ph < 0.12 ? 0.9 : 0.12;
}

/** A martini on the bar: a V bowl of pink, an olive on a pick, a stem and a foot. */
function martini() {
  const g = new THREE.Group();
  const bowl = new THREE.Shape();
  bowl.moveTo(-0.26, 0.62); bowl.lineTo(0.26, 0.62); bowl.lineTo(0, 0.3); bowl.closePath();
  const bowlInk = new THREE.Shape();
  bowlInk.moveTo(-0.3, 0.645); bowlInk.lineTo(0.3, 0.645); bowlInk.lineTo(0, 0.26); bowlInk.closePath();
  const drink = new THREE.Shape();
  drink.moveTo(-0.2, 0.56); drink.lineTo(0.2, 0.56); drink.lineTo(0, 0.33); drink.closePath();
  g.add(shapeMesh(bowlInk, '#2b1d16', 0), shapeMesh(bowl, ownMat('#cfe6ff', 0.55, true), 0.002), shapeMesh(drink, glowMat('#ff5fb0', 1.3), 0.004));
  const stem = inkedRect(0.03, 0.26, 0.01, '#cfe6ff', 0.02);
  stem.position.y = 0.16;
  const foot = inkedRect(0.26, 0.03, 0.01, '#cfe6ff', 0.02);
  foot.position.y = 0.02;
  const pick = shapeMesh(roundedRectShape(0.015, 0.36, 0.005, 0.08, 0.62), '#e8d8a8', 0.006);
  pick.rotation.z = -0.35;
  const olive = shapeMesh(new THREE.Shape().absarc(0, 0, 0.05, 0, Math.PI * 2, false), '#5fbf4a', 0.007);
  olive.position.set(0.02, 0.52, 0.007);
  g.add(stem, foot, pick, olive);
  return g;
}

export function introShots(audio: AudioData): Shot[] {
  const B = (i: number) => audio.beats[i];
  const SNAP = audio.hits.impact.find(h => h.t > 13 && h.t < 14.2)?.t ?? B(28);

  // 0a: the street, pushing in on the window as the neon buzzes on (to the downbeat of bar 5)
  const street = shot('street', 0, B(16), ({ stage, scene, camera }) => {
    const st = getStreet(stage);
    return (f, s) => {
      scene.add(st.root);
      Object.assign(s, { sign: 0.1, wallLight: 0.2, pars: 0.08, alarm: 0.8 });
      const k = easeInOutCubic(f.t / B(16));
      aimCam(camera, lerp(-0.4, 0.5, k), lerp(3.3, 2.5, k), lerp(25, 13.2, k), lerp(0, 0.3, k), lerp(5.2, 3.9, k), FACADE_Z);
      const sign = buzzOn(f.t, 1.0, B(4), 1);
      const prod = Math.min(buzzOn(f.t, 1.15, B(4) + 0.5, 2), f.t > B(4) + 0.5 ? sputter(f.t) : 1);
      st.set({ sign, prod, marquee: buzzOn(f.t, B(4), B(5), 3), open: openFlicker(f.t), lamp: 1 }, f.t, camera);
    };
  });

  // 0b: the pager on the bar: PROD DOWN (bars 5 and 6)
  const pager = shot('pager', B(16), B(22), ({ scene, camera }) => {
    const p = new Pager();
    p.root.position.set(-13.65, BAR.h + 0.005, -7.5);
    const m = martini();
    m.position.set(-12.75, BAR.h + 0.005, -7.85);
    const coaster = shapeMesh(new THREE.Shape().absarc(0, 0, 0.22, 0, Math.PI * 2, false), '#d84a7a', 0);
    coaster.rotation.x = -Math.PI / 2;
    coaster.position.set(-12.75, BAR.h + 0.004, -7.85);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), lightMat('#ff3240', 0, radialTexture()));
    glow.position.set(-13.65, BAR.h + 0.35, -7.56);
    scene.add(p.root, m, coaster, glow);
    return (f, s) => {
      Object.assign(s, { sign: 0.1, wallLight: 0.7, alarm: 0.6 });
      const beats = f.clock.beat(f.t) - 16;
      const ring = beats >= 0 && beats < 5.5 && beats % 1 < 0.45;
      const chars = clamp(Math.floor((f.t - B(16) - 0.15) / 0.07), 0, Pager.TEXT.length);
      p.set(f.t, ring ? 1 : 0, chars, ring);
      (glow.material as THREE.MeshBasicMaterial).opacity = ring ? 0.35 : 0.12;
      const k = easeInOutCubic(f.p);
      aimCam(camera, lerp(-13.25, -13.4, k), lerp(1.98, 1.86, k), lerp(-4.95, -5.55, k), -13.5, 1.66, -7.6, lerp(0.03, -0.02, k));
    };
  });

  // 0b: black, then a spotlight; Clawd rises into it and snaps on the impact
  const spot = shot('spotlight', B(22), B(30), ({ scene, camera }) => {
    scene.background = new THREE.Color('#030109');
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), ownMat('#0c0919'));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const beamMat = lightMat('#fff0dc', 0, beamTexture());
    const beamGeo = new THREE.PlaneGeometry(3.6, 10);
    beamGeo.translate(0, -5, 0);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 10, -0.4);
    const pool = lightPool(1.7, '#fff0dc', 0);
    pool.position.y = 0.01;
    const poolMat = pool.material as THREE.MeshBasicMaterial;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), lightMat('#7a3cff', 0, radialTexture()));
    back.position.set(0, 2.2, -4);
    scene.add(beam, pool, back);
    // dust motes drifting in the beam
    const N = 70;
    const motes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.018, 6), lightMat('#ffffff', 0.7), N);
    motes.frustumCulled = false;
    scene.add(motes);
    // sparkles that wake up in the dark on the snap
    const sparkMats: THREE.MeshBasicMaterial[] = [];
    const sparkles = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const m = ownGlow(['#ffffff', PAL.pink, PAL.cyan, PAL.gold][i % 4], 0);
      sparkMats.push(m);
      const star = new THREE.Group();
      for (const rot of [0, Math.PI / 2]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0.16); sh.lineTo(0.03, 0); sh.lineTo(0, -0.16); sh.lineTo(-0.03, 0); sh.closePath();
        const mesh = shapeMesh(sh, m, 0, 1);
        mesh.rotation.z = rot;
        star.add(mesh);
      }
      const a = hash(i, 1) * Math.PI * 2, r = 1.6 + hash(i, 2) * 2.6;
      star.position.set(Math.cos(a) * r * 1.4, 1.3 + Math.sin(a) * r * 0.75, -1.5 - hash(i, 3) * 2);
      sparkles.add(star);
    }
    scene.add(sparkles);
    const clawd = new DiscoClawd();
    scene.add(clawd.root);
    const burst = new Burst(PAL.gold, 12);
    burst.root.position.set(ARM_LEN + 0.05, 0.05, 0.06);
    clawd.paw.add(burst.root);
    const m4 = new THREE.Matrix4();
    return (f) => {
      const on = f.t >= B(23) ? 1 : 0;
      const snap = f.t - SNAP;
      const flare = snap >= 0 ? decay(snap, 0.35) : 0;
      beamMat.opacity = on * (0.26 + 0.14 * flare);
      poolMat.opacity = on * (0.5 + 0.2 * flare);
      (back.material as THREE.MeshBasicMaterial).opacity = snap >= 0 ? 0.18 * clamp(snap / 0.3) : 0;
      for (let i = 0; i < N; i++) {
        const x = (hash(i, 5) - 0.5) * 2.6 + Math.sin(f.t * 0.4 + i) * 0.15;
        const y = ((hash(i, 6) * 8 + f.t * (0.08 + hash(i, 7) * 0.12)) % 8);
        m4.makeTranslation(x * (1 - y / 12), y, -0.3 + (hash(i, 8) - 0.5) * 0.6);
        motes.setMatrixAt(i, on ? m4 : m4.makeScale(0, 0, 0));
      }
      motes.instanceMatrix.needsUpdate = true;
      sparkles.children.forEach((st, i) => {
        const tw = Math.max(0, Math.sin(f.t * (2 + hash(i, 4) * 3) + i * 1.7));
        const lit = snap >= 0 ? clamp((snap - hash(i, 9) * 0.5) / 0.2) : 0;
        setGlow(sparkMats[i], ['#ffffff', PAL.pink, PAL.cyan, PAL.gold][i % 4], 2.4 * lit * tw);
        st.visible = lit * tw > 0.02;
        st.scale.setScalar(0.6 + 0.6 * tw);
      });
      // the rise: afro first, then shades, then the rest of him
      const rise = easeOutCubic(clamp((f.t - B(24)) / (B(27) + 0.2 - B(24))));
      clawd.root.position.set(0, lerp(-2.4, 0, rise), 0);
      // the snap: right paw flicks up just before the impact and holds; a little lean into it
      const up = clamp((snap + 0.12) / 0.12);
      const settle = snap > 0 ? Math.exp(-snap * 6) : 0;
      const pose = { ...REST, armL: -0.6, armR: lerp(-0.6, 1.05, up) + settle * 0.25, lean: -0.08 * up, squash: settle * 0.25 };
      clawd.set(snap >= 0 ? DISCO_MOODS.smug : DISCO_MOODS.cool, pose, { shades: 1, medal: flare, halo: 0.5 * on, rim: 0.4 + 0.6 * on }, f.t);
      burst.set(snap, 1.0);
      // camera: tilts down and eases back as he rises, then a slow push on the hold
      const k = easeInOutCubic(clamp((f.t - B(24)) / (B(28) - B(24))));
      const push = easeInOutCubic(clamp((f.t - SNAP) / (B(30) - SNAP)));
      aimCam(camera, 0, lerp(2.5, 1.3, k), lerp(6.0, 6.8, k) - push * 0.7, 0, lerp(2.55, 1.18, k), 0);
    };
  }, { club: false });

  return [street, pager, spot];
}

