// Shared plumbing for this song's shots. The club and the street are built once per page and
// borrowed by each shot (scene.add(root) every frame, then apply/set every animated property).
// Every shot draws the disco lyric layer from its overlay, so lines carry across cuts.
import * as THREE from 'three';
import { defineShot, type Frame, type PostSettings, type Shot, type ShotWorld, type Transition } from '../../../engine/types';
import type { Stage } from '../../../engine/stage';
import { CLUB_POST, PAL } from '../look';
import { Club, defaultState, type ClubState } from '../club';
import { Street } from '../street';
import { drawDiscoLyrics } from '../lyrics-disco';
import { DISCO_LYRICS } from '../lyrics-layout';

const clubs = new WeakMap<Stage, Club>();
const streets = new WeakMap<Stage, Street>();
export const getClub = (stage: Stage) => { let c = clubs.get(stage); if (!c) { c = new Club(); clubs.set(stage, c); } return c; };
export const getStreet = (stage: Stage) => { let c = streets.get(stage); if (!c) { c = new Street(); streets.set(stage, c); } return c; };

export interface Ctx {
  stage: Stage;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  club: Club;
}
/** Per-frame update: set the camera and props, and fill in the club state (already defaulted). */
export type Update = (f: Frame, s: ClubState) => void;

export interface ShotOpts {
  transition?: Transition;
  /** false: the shot doesn't show the club (black void, close-ups in their own little world). */
  club?: boolean;
  overlay?: ShotWorld['overlay'];
  post?: (f: Frame) => Partial<PostSettings>;
  fov?: number;
}

/** A shot in this song: setup() builds its props once and returns the per-frame update. */
export function shot(id: string, start: number, end: number, setup: (c: Ctx) => Update, o: ShotOpts = {}): Shot {
  return defineShot({
    id, start, end, transition: o.transition,
    build(stage) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(PAL.night);
      const camera = new THREE.PerspectiveCamera(o.fov ?? 38, 16 / 9, 0.05, 300);
      const club = getClub(stage);
      const update = setup({ stage, scene, camera, club });
      const useClub = o.club !== false;
      return {
        scene, camera,
        update(f) {
          const s = defaultState();
          if (useClub) scene.add(club.root);
          update(f, s);
          if (useClub) club.apply(s, f);
        },
        overlay(g, f) {
          if (o.overlay) { g.save(); o.overlay(g, f); g.restore(); }
          drawDiscoLyrics(g, f, DISCO_LYRICS);
        },
        post: (f: Frame) => ({ ...CLUB_POST, ...o.post?.(f) }),
        lyrics: false,
      };
    },
  });
}

/** Seconds since t0 (negative before it). */
export const since = (f: Frame, t0: number) => f.t - t0;

/** Camera shake for impacts: a decaying wobble, deterministic in t. */
export function shake(cam: THREE.Camera, f: Frame, t0: number, amount = 0.08, tau = 0.25) {
  const d = f.t - t0;
  if (d < 0) return;
  const k = Math.exp(-d / tau) * amount;
  cam.position.x += Math.sin(d * 71) * k;
  cam.position.y += Math.sin(d * 53 + 1) * k * 0.7;
}
