import * as THREE from 'three';
import { defineShot } from '../../../engine/types';
import { easeOutBack } from '../../../engine/ease';

// A neon floor grid under a pulsing icosahedron. Snare spins it, kick scales it.
export const grid = (start: number, end: number) => defineShot({
  id: 'grid', start, end,
  transition: { type: 'flash', dur: 0.35 },
  build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090212');
    scene.fog = new THREE.Fog('#090212', 6, 30);
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    const grid = new THREE.GridHelper(80, 80, '#ff2bd6', '#5a1fa8');
    scene.add(grid);
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: '#20e3ff', emissive: '#04222b', flatShading: true, metalness: 0.3, roughness: 0.4 }));
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(ico.geometry), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    ico.add(wire);
    scene.add(ico);
    scene.add(new THREE.AmbientLight('#ffffff', 0.4));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    return {
      scene, camera,
      update(f) {
        const kick = f.clock.kick(f.t, 0.14), snare = f.clock.snare(f.t, 0.2);
        const intro = easeOutBack(f.lt / 0.8);
        // spin = whole beats elapsed plus an eased kick on each snare; never accumulated across frames
        const beats = f.clock.beat(f.t);
        ico.rotation.set(beats * 0.25, beats * 0.5 + snare * 0.6, 0);
        ico.scale.setScalar(intro * (1 + 0.18 * kick));
        ico.position.y = 1.6 + 0.15 * Math.sin(f.t * 2);
        grid.position.z = (f.t * 4) % 1; // scrolls; the modulo keeps it a pure function of t
        camera.position.set(Math.sin(f.lt * 0.25) * 5, 2.2, Math.cos(f.lt * 0.25) * 5);
        camera.lookAt(0, 1.4, 0);
      },
      post: f => ({ bloom: 0.45 + 0.35 * f.clock.kick(f.t, 0.12), bloomThreshold: 0.7, bloomRadius: 0.3 }),
    };
  },
});
