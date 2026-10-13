// Look development for "The Smoking Gun": DJ Detective Clawd's looks and the club.
// Preview: http://127.0.0.1:5180/?song=smoking-gun-lookdev
import * as THREE from 'three';
import { defineSong, defineShot } from '../../engine/types';
import audio from '../the-smoking-gun/data/audio.json';
import audioUrl from '../the-smoking-gun/audio/song.wav?url';
import { DiscoClawd, DISCO_MOODS, REST, dance, type DiscoLook, type Move } from '../the-smoking-gun/clawd-disco';
import { CLUB_POST, FONTS, PAL, aimCam, frameCam, glowMat, lightMat, radialTexture } from '../the-smoking-gun/look';
import { Club, aliveFloor, clearBooth, defaultState, BOOTH_SPOT } from '../the-smoking-gun/club';
import type { Stage } from '../../engine/stage';
import { Bouncer, Cache, Field, Fn, sp } from '../the-smoking-gun/suspects';

const CAST: { label: string; mood: string; look: Partial<DiscoLook>; move: Move; beat?: number; tile: string }[] = [
  { label: 'cool', mood: 'cool', look: { shades: 1 }, move: 'still', tile: PAL.violetNeon },
  { label: 'dancing (the point)', mood: 'excited', look: { shades: 1 }, move: 'point', beat: 2.4, tile: PAL.pink },
  { label: 'inspecting', mood: 'focused', look: { shades: 0, prop: 'magnifier' }, move: 'still', tile: PAL.cyan },
  { label: 'certain', mood: 'certain', look: { shades: 1, puff: 1, medal: 1 }, move: 'still', tile: PAL.gold },
  { label: 'baffled', mood: 'baffled', look: { shades: 2 }, move: 'still', tile: PAL.cyan },
  { label: 'proved wrong', mood: 'ohno', look: { shades: 0, flat: 1 }, move: 'still', tile: PAL.red },
];
const GAP = 3.2, ROW = 3.1;
const slot = (i: number) => ({ x: ((i % 3) - 1) * GAP, y: i < 3 ? ROW : 0 });

const sheet = defineShot({
  id: 'clawd-looks', start: 0, end: 10,
  build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.night);
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), lightMat('#5a2fb0', 0.35, radialTexture()));
    back.position.set(0, 1.6, -3);
    scene.add(back);
    const cast = CAST.map((c, i) => {
      const { x, y } = slot(i);
      const d = new DiscoClawd();
      d.root.position.set(x, y, 0);
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.16), glowMat(c.tile, 1.6));
      tile.position.set(x, y - 0.1, -0.2);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), lightMat(c.tile, 0.3, radialTexture()));
      pool.position.set(x, y + 0.9, -0.6);
      scene.add(d.root, tile, pool);
      return d;
    });
    return {
      scene, camera,
      update(f) {
        frameCam(camera, 0, 2.45, 7.8);
        cast.forEach((d, i) => {
          const c = CAST[i];
          const dn = c.move === 'still' ? { pose: REST, x: 0, y: 0, jiggle: 0 } : dance(c.move, c.beat ?? 0);
          let pose = dn.pose;
          if (c.mood === 'ohno') pose = { ...pose, armL: -0.45, armR: -0.45 };
          if (c.look.prop === 'magnifier') pose = { ...pose, armR: 0.75 };
          if (c.mood === 'certain') pose = { ...pose, armL: 0.5, armR: 0.5 };
          if (c.mood === 'baffled') pose = { ...pose, armL: 0.9, armR: 0.9 };
          d.set(DISCO_MOODS[c.mood], pose, { ...c.look, jiggle: dn.jiggle }, 3.2 + i * 0.7);
        });
      },
      overlay(g, f) {
        g.fillStyle = '#d9cdfa';
        g.font = `600 ${Math.round(f.h * 0.026)}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center';
        CAST.forEach((c, i) => {
          const { x, y } = slot(i);
          const v = new THREE.Vector3(x, y - 0.5, 0).project(camera);
          g.fillText(c.label, (v.x * 0.5 + 0.5) * f.w, (-v.y * 0.5 + 0.5) * f.h);
        });
        g.font = `400 ${Math.round(f.h * 0.07)}px Shrikhand, sans-serif`;
        g.fillStyle = '#ffe9f6';
        g.shadowColor = '#ff3ea5'; g.shadowBlur = f.h * 0.02;
        g.fillText('DJ Detective Clawd', f.w / 2, f.h * 0.095);
        g.shadowBlur = 0;
      },
      post: () => CLUB_POST,
      lyrics: false,
    };
  },
});

/** The suspects line-up (50-60 s). */
const lineup = defineShot({
  id: 'suspects', start: 50, end: 60,
  build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(PAL.night);
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), lightMat('#5a2fb0', 0.35, radialTexture()));
    back.position.set(0, 1.6, -3);
    scene.add(back);
    // height chart behind them, like a police line-up
    for (let i = 0; i <= 6; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.03), lightMat('#b9a8ff', 0.35));
      bar.position.set(0, i * 0.5, -1);
      scene.add(bar);
    }
    const fn = new Fn(), bo = new Bouncer(), ca = new Cache(), fi = new Field(), cl = new DiscoClawd();
    const cast = [[fn.root, -4.4, 'the Function'], [bo.root, -2.1, 'the Handler'], [cl.root, 0.2, 'Clawd'], [ca.root, 2.5, 'the Cache'], [fi.root, 4.3, 'the Field']] as const;
    for (const [r, x] of cast) { r.position.set(x, 0, 0); scene.add(r); }
    return {
      scene, camera,
      update(f) {
        frameCam(camera, 0, 1.6, 6.0);
        fn.set(sp({ open: 0.6, brow: 0.2, cuffs: f.t > 55 ? 1 : 0 }), f.t);
        bo.set(sp({ wag: f.t > 55 ? 1 : 0 }), f.t);
        ca.set(sp({ mouth: 0.5, wag: f.t > 55 ? 1 : 0, shades: f.t > 55 ? 1 : 0 }), f.t);
        fi.set(sp({ look: 0.6 }), f.t);
        cl.set(DISCO_MOODS.smug, REST, { shades: 1 }, f.t);
      },
      overlay(g, f) {
        g.fillStyle = '#d9cdfa';
        g.font = `600 ${Math.round(f.h * 0.026)}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center';
        for (const [, x, label] of cast) {
          const v = new THREE.Vector3(x, -0.3, 0).project(camera);
          g.fillText(label, (v.x * 0.5 + 0.5) * f.w, (-v.y * 0.5 + 0.5) * f.h);
        }
      },
      post: () => CLUB_POST,
      lyrics: false,
    };
  },
});

const clubs = new WeakMap<Stage, Club>();
const getClub = (stage: Stage) => { let c = clubs.get(stage); if (!c) { c = new Club(); clubs.set(stage, c); } return c; };

/** Wide shots of the club: dead (10-20 s) and alive (20-30 s), then the booth (30-40 s). */
function clubShot(id: string, start: number, end: number, alive: boolean, cam: 'wide' | 'booth') {
  return defineShot({
    id, start, end,
    build(stage) {
      const club = getClub(stage);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(PAL.night);
      const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
      const clawd = new DiscoClawd();
      scene.add(clawd.root);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), lightMat('#ffd9f0', 0.5, radialTexture()));
      pool.rotation.x = -Math.PI / 2;
      scene.add(pool);
      return {
        scene, camera,
        update(f) {
          scene.add(club.root);
          const s = defaultState();
          if (alive) Object.assign(s, { records: { spin: f.t * 3.5, label: '/checkout' }, meter: 0.45, floor: aliveFloor(), ball: { angle: f.t * 0.5, lit: 1, sparkle: 1 }, beams: 1, alarm: 0, pars: 1, frozen: 0, terms: 'logs', wallLight: 1 });
          else Object.assign(s, { terms: cam === 'booth' ? 'grep' : 'off', termT0: start });
          if (cam === 'booth') s.crowdMask = clearBooth;
          club.apply(s, f);
          const b = f.clock.beat(f.t);
          if (cam === 'wide') {
            const dn = dance(alive ? 'point' : 'groove', b);
            clawd.root.position.set(dn.x, 0, 0.4);
            pool.position.set(0, 0.03, 0.4);
            clawd.set(DISCO_MOODS[alive ? 'excited' : 'cool'], dn.pose, { shades: 1, jiggle: dn.jiggle }, f.t);
            aimCam(camera, 0, 7.4, 16.5, 0, 4.4, -4);
          } else {
            clawd.root.position.copy(BOOTH_SPOT);
            const dn = dance('groove', b, 0.6);
            clawd.set(DISCO_MOODS.focused, dn.pose, { shades: 0, jiggle: dn.jiggle }, f.t);
            pool.position.set(0, -5, 0);
            aimCam(camera, 0, 3.4, -2.6, 0, 2.75, -9);
          }
        },
        post: () => CLUB_POST,
        lyrics: false,
      };
    },
  });
}

export default defineSong({
  slug: 'smoking-gun-lookdev', title: 'The Smoking Gun: look development', audioUrl, audio, lyrics: { lines: [] },
  shots: [sheet, clubShot('club-dead', 10, 20, false, 'wide'), clubShot('club-alive', 20, 30, true, 'wide'), clubShot('booth', 30, 40, false, 'booth'), clubShot('booth-alive', 40, 50, true, 'booth'), lineup], fonts: FONTS, background: PAL.night,
});
