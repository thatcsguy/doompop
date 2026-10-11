// A placeholder shot: the song title over a ring that pulses with the kick.
// New songs start with this so the preview and render work before any real shots exist.
import * as THREE from 'three';
import { defineShot } from '../types';
import { hash } from '../rng';

export function slate(o: { id: string; start: number; end: number; title: string }) {
  return defineShot({
    id: o.id, start: o.start, end: o.end,
    build() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#07070a');
      const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
      const N = 96;
      const geo = new THREE.BoxGeometry(0.06, 1, 0.06);
      geo.translate(0, 0.5, 0);
      const mat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
      const bars = new THREE.InstancedMesh(geo, mat, N);
      scene.add(bars);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      return {
        scene, camera,
        update(f) {
          const kick = f.clock.kick(f.t, 0.15), level = f.clock.env('rms', f.t);
          camera.position.set(Math.sin(f.t * 0.1) * 0.6, 0.4, 6 - kick * 0.15);
          camera.lookAt(0, 0, 0);
          for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2;
            const band = f.clock.env(i % 3 === 0 ? 'low' : i % 3 === 1 ? 'mid' : 'high', f.t);
            const h = 0.08 + 0.5 * band + 0.25 * kick * hash(i, 7) + 0.1 * level;
            p.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0);
            q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
            s.set(1, h, 1);
            bars.setMatrixAt(i, m.compose(p, q, s));
          }
          bars.instanceMatrix.needsUpdate = true;
        },
        overlay(g, f) {
          g.fillStyle = '#ffffff';
          g.font = `800 ${Math.round(f.h * 0.06)}px system-ui, sans-serif`;
          g.textAlign = 'center';
          g.fillText(o.title, f.w / 2, f.h / 2 + f.h * 0.02);
        },
      };
    },
  });
}
