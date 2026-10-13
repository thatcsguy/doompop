import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { PostSettings } from './types';

export const DEFAULT_POST: PostSettings = {
  bloom: 0.6, bloomRadius: 0.4, bloomThreshold: 0.8, grain: 0.04, vignette: 0.25, exposure: 1, toneMap: true,
  tint: '#ffffff', saturation: 1,
};

const GrainShader = {
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, grain: { value: 0 }, vignette: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, saturation: { value: 1 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float seed, grain, vignette, saturation; uniform vec3 tint; varying vec2 vUv;
    float h(vec2 p){ p = fract(p * vec2(443.897, 441.423) + seed); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114))), c.rgb, saturation) * tint;
      c.rgb += (h(vUv * 1000.0) - 0.5) * grain;
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - vignette * dot(d, d) * 2.0;
      gl_FragColor = c;
    }`,
};

/** The WebGL renderer and post chain. One per page; shots render through it. */
export class Stage {
  readonly gl: THREE.WebGLRenderer;
  readonly composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private grain: ShaderPass;

  constructor(readonly width: number, readonly height: number, background = '#000000') {
    const canvas = document.createElement('canvas');
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.setSize(width, height, false);
    this.gl.setClearColor(new THREE.Color(background), 1);
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;

    this.composer = new EffectComposer(this.gl);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0, 0, 0);
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grain);
  }

  get canvas() { return this.gl.domElement; }
  get aspect() { return this.width / this.height; }

  render(scene: THREE.Scene, camera: THREE.Camera, post: PostSettings, seed: number) {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const c = camera as THREE.PerspectiveCamera;
      if (c.aspect !== this.aspect) { c.aspect = this.aspect; c.updateProjectionMatrix(); }
    }
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.gl.toneMapping = post.toneMap ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.gl.toneMappingExposure = post.exposure;
    this.bloom.enabled = post.bloom > 0;
    this.bloom.strength = post.bloom;
    this.bloom.radius = post.bloomRadius;
    this.bloom.threshold = post.bloomThreshold;
    this.grain.uniforms.seed.value = (seed % 997) / 997;
    this.grain.uniforms.grain.value = post.grain;
    this.grain.uniforms.vignette.value = post.vignette;
    // tint is a display-space multiply (the pass runs after the sRGB output pass)
    this.grain.uniforms.tint.value.setStyle(post.tint, THREE.LinearSRGBColorSpace); // raw values, no sRGB decode
    this.grain.uniforms.saturation.value = post.saturation;
    this.composer.render();
  }
}
