// Character and look development. Borrows the demo track's audio and timing.
// Preview: http://127.0.0.1:5180/?song=lookdev
import * as THREE from 'three';
import { defineSong, defineShot } from '../../engine/types';
import audio from '../demo/data/audio.json';
import audioUrl from '../demo/audio/song.wav?url';
import { Clawd, MOODS, REST } from '../../engine/characters/clawd';
import { circleShape, flatMat, inkedRect, shapeMesh } from '../../engine/flat';

const moods = Object.keys(MOODS);

const sheet = defineShot({
  id: 'clawd-moods', start: 0, end: audio.duration,
  build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3e9d8');
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
    // flat ground strip with an ink line on top, and a soft contact shadow under each character
    const ground = inkedRect(16, 1.2, 0, '#e2cfb0', 0.035);
    ground.position.set(0, -0.6, -0.05);
    scene.add(ground);
    const cast = moods.map((m, i) => {
      const c = new Clawd();
      c.root.position.set((i - (moods.length - 1) / 2) * 1.85, 0, 0);
      const shadow = shapeMesh(circleShape(0.75), flatMat('#cdb592'), -0.02, 24);
      shadow.scale.set(1, 0.12, 1);
      shadow.position.set(c.root.position.x, 0.02, -0.02);
      scene.add(c.root, shadow);
      return c;
    });
    return {
      scene, camera,
      update(f) {
        camera.position.set(Math.sin(f.t * 0.15) * 0.3, 0.9, 13.5);
        camera.lookAt(0, 0.5, 0);
        const beat = f.clock.beat(f.t), ph = beat - Math.floor(beat);
        cast.forEach((c, i) => {
          const m = MOODS[moods[i]];
          c.setMood(m, f.t + i);
          const energy = m.happy * 0.8 + (moods[i] === 'panicked' ? 0.3 : 0);
          const hop = energy * Math.sin(ph * Math.PI);
          c.setPose({ ...REST, bounce: hop * 0.6, squash: energy * (ph < 0.12 ? 0.6 : -0.2 * hop), armL: moods[i] === 'proud' ? 0.6 : m.happy * 0.9 * hop, armR: m.happy * 0.9 * hop, lean: m.droop * 0.15 - m.squint * 0.1 });
        });
      },
      overlay(g, f) {
        g.fillStyle = '#5a4636';
        g.font = `600 ${Math.round(f.h * 0.024)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        moods.forEach((m, i) => {
          const v = new THREE.Vector3((i - (moods.length - 1) / 2) * 1.85, -0.25, 0).project(camera);
          g.fillText(m, (v.x * 0.5 + 0.5) * f.w, (-v.y * 0.5 + 0.5) * f.h + f.h * 0.03);
        });
      },
      post: () => ({ bloom: 0, grain: 0.025, vignette: 0.12, toneMap: false }),
      lyrics: false,
    };
  },
});

export default defineSong({ slug: 'lookdev', title: 'Look development', audioUrl, audio, lyrics: { lines: [] }, shots: [sheet] });
