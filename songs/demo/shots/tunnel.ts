import * as THREE from 'three';
import { defineShot } from '../../../engine/types';
import { hash } from '../../../engine/rng';

// Fly down a tunnel of rings. Camera position is a pure function of t; rings flare on kicks.
export const tunnel = (start: number, end: number) => defineShot({
  id: 'tunnel', start, end,
  build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05030a');
    scene.fog = new THREE.Fog('#05030a', 4, 40);
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    const N = 60, SPACING = 1.2;
    const geo = new THREE.TorusGeometry(2.2, 0.035, 8, 96);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const rings = new THREE.InstancedMesh(geo, mat, N);
    scene.add(rings);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    return {
      scene, camera,
      update(f) {
        const z = -f.t * 6; // speed: 6 units/s
        camera.position.set(Math.sin(f.t * 0.7) * 0.3, Math.cos(f.t * 0.5) * 0.2, z);
        camera.lookAt(0, 0, z - 10);
        camera.rotation.z = Math.sin(f.t * 0.3) * 0.15;
        const kick = f.clock.kick(f.t, 0.18), bar = Math.floor(f.clock.bar(f.t));
        const first = Math.floor(-z / SPACING);
        for (let k = 0; k < N; k++) {
          const i = first + k; // ring index along the tunnel: stable identity as the camera moves
          m.makeRotationZ(hash(i) * Math.PI);
          m.setPosition(0, 0, -i * SPACING);
          rings.setMatrixAt(k, m);
          const hue = (0.75 + 0.08 * (bar % 4) + 0.05 * hash(i, 3)) % 1;
          c.setHSL(hue, 0.9, 0.35 + 0.45 * kick * (k < 12 ? 1 : 0.4));
          rings.setColorAt(k, c);
        }
        rings.instanceMatrix.needsUpdate = true;
        rings.instanceColor!.needsUpdate = true;
      },
      post: f => ({ bloom: 0.5 + 0.5 * f.clock.kick(f.t, 0.15), bloomThreshold: 0.55, bloomRadius: 0.3 }),
    };
  },
});
