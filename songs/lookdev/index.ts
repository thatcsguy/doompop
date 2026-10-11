// Character and look development. Borrows the demo track's audio and timing.
// Preview: http://127.0.0.1:5180/?song=lookdev
import * as THREE from 'three';
import { defineSong, defineShot } from '../../engine/types';
import audio from '../demo/data/audio.json';
import audioUrl from '../demo/audio/song.wav?url';
import { Clawd, MOODS, REST } from '../../engine/characters/clawd';

const moods = Object.keys(MOODS);

const sheet = defineShot({
  id: 'clawd-moods', start: 0, end: audio.duration,
  build(stage) {
    stage.gl.shadowMap.enabled = true;
    stage.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#efe6da');
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
    const table = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.9 }));
    table.position.y = -0.15;
    table.receiveShadow = true;
    scene.add(table);
    scene.add(new THREE.HemisphereLight('#fff6e8', '#8a7a66', 1.4));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
    sun.position.set(-3, 6, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 4, bottom: -4 });
    scene.add(sun);
    const cast = moods.map((m, i) => {
      const c = new Clawd();
      c.root.position.set((i - (moods.length - 1) / 2) * 1.85, 0, 0);
      scene.add(c.root);
      return c;
    });
    return {
      scene, camera,
      update(f) {
        camera.position.set(Math.sin(f.t * 0.15) * 1.5, 3, 17);
        camera.lookAt(0, 0.6, 0);
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
          const v = new THREE.Vector3((i - (moods.length - 1) / 2) * 1.85, -0.2, 1.4).project(camera);
          g.fillText(m, (v.x * 0.5 + 0.5) * f.w, (-v.y * 0.5 + 0.5) * f.h + f.h * 0.06);
        });
      },
      post: () => ({ bloom: 0.2, bloomThreshold: 0.9, grain: 0.03, vignette: 0.2 }),
      lyrics: false,
    };
  },
});

export default defineSong({ slug: 'lookdev', title: 'Look development', audioUrl, audio, lyrics: { lines: [] }, shots: [sheet] });
