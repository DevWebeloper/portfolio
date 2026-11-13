// Small screen-space fluid for the pointer ripple: a stable-fluids solver
// (advect, vorticity, pressure projection) on a coarse grid. The card shader
// samples its velocity and ink to bend and light the card image like liquid.

import {
  Camera,
  Color,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const advectFrag = /* glsl */ `
uniform sampler2D uVel;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDecay;
varying vec2 vUv;
void main() {
  vec2 back = vUv - uDt * texture2D(uVel, vUv).xy * uTexel;
  gl_FragColor = texture2D(uSrc, back) * exp(-uDecay * uDt);
}
`;

const splatFrag = /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float g = exp(-dot(d, d) / uRadius);
  gl_FragColor = vec4(texture2D(uSrc, vUv).xyz + uValue * g, 1.0);
}
`;

const curlFrag = /* glsl */ `
uniform sampler2D uVel;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float l = texture2D(uVel, vUv - vec2(uTexel.x, 0.0)).y;
  float r = texture2D(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float b = texture2D(uVel, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uVel, vUv + vec2(0.0, uTexel.y)).x;
  gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}
`;

const vorticityFrag = /* glsl */ `
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uDt;
varying vec2 vUv;
void main() {
  float l = texture2D(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float c = texture2D(uCurl, vUv).x;
  vec2 f = vec2(abs(t) - abs(b), abs(r) - abs(l));
  f = f / (length(f) + 1e-4) * uStrength * c;
  f.y = -f.y;
  vec2 v = texture2D(uVel, vUv).xy + f * uDt;
  gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}
`;

const divergenceFrag = /* glsl */ `
uniform sampler2D uVel;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float l = texture2D(uVel, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uVel, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uVel, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture2D(uVel, vUv + vec2(0.0, uTexel.y)).y;
  vec2 c = texture2D(uVel, vUv).xy;
  // Closed box: mirror the velocity at the walls.
  if (vUv.x - uTexel.x < 0.0) l = -c.x;
  if (vUv.x + uTexel.x > 1.0) r = -c.x;
  if (vUv.y - uTexel.y < 0.0) b = -c.y;
  if (vUv.y + uTexel.y > 1.0) t = -c.y;
  gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
`;

const pressureFrag = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDiv;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float l = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  gl_FragColor = vec4(0.25 * (l + r + b + t - texture2D(uDiv, vUv).x), 0.0, 0.0, 1.0);
}
`;

const gradientFrag = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uVel;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float l = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 v = texture2D(uVel, vUv).xy - 0.5 * vec2(r - l, t - b);
  gl_FragColor = vec4(v, 0.0, 1.0);
}
`;

const clearFrag = /* glsl */ `
uniform sampler2D uSrc;
uniform float uKeep;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(uSrc, vUv) * uKeep; }
`;

/** Tuning, picked by eye against frame captures (see the engine for units). */
const SIM_W = 160; // grid cells across the screen
const VEL_DECAY = 0.35; // 1/s
const INK_DECAY = 0.4; // 1/s, sets how long the liquid stays visible
const CURL = 8;
const PRESSURE_ITER = 14;
const RADIUS = 0.009; // gaussian splat radius, squared screen-height units

type Pair = { read: WebGLRenderTarget; write: WebGLRenderTarget; swap(): void };

export interface Fluid {
  /** Velocity (xy, grid cells/s) and ink (x) textures for the card shader. */
  velocity(): Texture;
  ink(): Texture;
  texel: Vector2;
  resize(w: number, h: number): void;
  /** Push the liquid along a pointer segment, in CSS px and px/s. */
  splat(x: number, y: number, vx: number, vy: number, w: number, h: number): void;
  step(dt: number): void;
  clear(): void;
  dispose(): void;
}

/** Returns null when the GPU can't render to half-float targets. */
export function createFluid(renderer: WebGLRenderer): Fluid | null {
  if (!renderer.extensions.has("EXT_color_buffer_float") && !renderer.extensions.has("EXT_color_buffer_half_float")) {
    return null;
  }

  const camera = new Camera();
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const texel = new Vector2(1, 1);
  const mat = (frag: string, uniforms: Record<string, { value: unknown }>) =>
    new ShaderMaterial({ vertexShader: quadVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  const advect = mat(advectFrag, { uVel: { value: null }, uSrc: { value: null }, uTexel: { value: texel }, uDt: { value: 0 }, uDecay: { value: 0 } });
  const splatM = mat(splatFrag, { uSrc: { value: null }, uPoint: { value: new Vector2() }, uValue: { value: [0, 0, 0] }, uRadius: { value: RADIUS }, uAspect: { value: 1 } });
  const curlM = mat(curlFrag, { uVel: { value: null }, uTexel: { value: texel } });
  const vortM = mat(vorticityFrag, { uVel: { value: null }, uCurl: { value: null }, uTexel: { value: texel }, uStrength: { value: CURL }, uDt: { value: 0 } });
  const divM = mat(divergenceFrag, { uVel: { value: null }, uTexel: { value: texel } });
  const presM = mat(pressureFrag, { uPressure: { value: null }, uDiv: { value: null }, uTexel: { value: texel } });
  const gradM = mat(gradientFrag, { uPressure: { value: null }, uVel: { value: null }, uTexel: { value: texel } });
  const clearM = mat(clearFrag, { uSrc: { value: null }, uKeep: { value: 0 } });
  const mats = [advect, splatM, curlM, vortM, divM, presM, gradM, clearM];

  const target = (w: number, h: number, filter: typeof LinearFilter | typeof NearestFilter) =>
    new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: filter,
      magFilter: filter,
      depthBuffer: false,
    });
  const pair = (w: number, h: number, filter: typeof LinearFilter | typeof NearestFilter): Pair => {
    const p = {
      read: target(w, h, filter),
      write: target(w, h, filter),
      swap() {
        const t = p.read;
        p.read = p.write;
        p.write = t;
      },
    };
    return p;
  };

  let gw = SIM_W;
  let gh = 100;
  let vel = pair(gw, gh, LinearFilter);
  let ink = pair(gw, gh, LinearFilter);
  let pres = pair(gw, gh, NearestFilter);
  let div = target(gw, gh, NearestFilter);
  let curl = target(gw, gh, NearestFilter);

  const run = (m: ShaderMaterial, out: WebGLRenderTarget) => {
    quad.material = m;
    renderer.setRenderTarget(out);
    renderer.render(scene, camera);
  };

  const all = () => [vel.read, vel.write, ink.read, ink.write, pres.read, pres.write, div, curl];

  const fluid: Fluid = {
    texel,
    velocity: () => vel.read.texture,
    ink: () => ink.read.texture,
    resize(w, h) {
      const nh = Math.max(16, Math.round((SIM_W * h) / Math.max(1, w)));
      if (nh === gh) return;
      all().forEach((t) => t.dispose());
      gh = nh;
      gw = SIM_W;
      vel = pair(gw, gh, LinearFilter);
      ink = pair(gw, gh, LinearFilter);
      pres = pair(gw, gh, NearestFilter);
      div = target(gw, gh, NearestFilter);
      curl = target(gw, gh, NearestFilter);
      texel.set(1 / gw, 1 / gh);
      fluid.clear();
    },
    splat(x, y, vx, vy, w, h) {
      const prev = renderer.getRenderTarget();
      splatM.uniforms.uAspect.value = w / h;
      (splatM.uniforms.uPoint.value as Vector2).set(x / w, 1 - y / h);
      // Pointer px/s -> grid cells/s, scaled down so a brisk stroke stays a ripple.
      const k = (gw / w) * 0.3;
      splatM.uniforms.uSrc.value = vel.read.texture;
      splatM.uniforms.uValue.value = [vx * k, -vy * k, 0];
      run(splatM, vel.write);
      vel.swap();
      const amount = Math.min(1, Math.hypot(vx, vy) / 1400) * 0.6;
      splatM.uniforms.uSrc.value = ink.read.texture;
      splatM.uniforms.uValue.value = [amount, 0, 0];
      run(splatM, ink.write);
      ink.swap();
      renderer.setRenderTarget(prev);
    },
    step(dt) {
      if (dt <= 0) return;
      const prev = renderer.getRenderTarget();
      curlM.uniforms.uVel.value = vel.read.texture;
      run(curlM, curl);
      vortM.uniforms.uVel.value = vel.read.texture;
      vortM.uniforms.uCurl.value = curl.texture;
      vortM.uniforms.uDt.value = dt;
      run(vortM, vel.write);
      vel.swap();

      divM.uniforms.uVel.value = vel.read.texture;
      run(divM, div);
      clearM.uniforms.uSrc.value = pres.read.texture;
      clearM.uniforms.uKeep.value = 0.8;
      run(clearM, pres.write);
      pres.swap();
      presM.uniforms.uDiv.value = div.texture;
      for (let i = 0; i < PRESSURE_ITER; i++) {
        presM.uniforms.uPressure.value = pres.read.texture;
        run(presM, pres.write);
        pres.swap();
      }
      gradM.uniforms.uPressure.value = pres.read.texture;
      gradM.uniforms.uVel.value = vel.read.texture;
      run(gradM, vel.write);
      vel.swap();

      advect.uniforms.uDt.value = dt;
      advect.uniforms.uVel.value = vel.read.texture;
      advect.uniforms.uSrc.value = vel.read.texture;
      advect.uniforms.uDecay.value = VEL_DECAY;
      run(advect, vel.write);
      vel.swap();
      advect.uniforms.uVel.value = vel.read.texture;
      advect.uniforms.uSrc.value = ink.read.texture;
      advect.uniforms.uDecay.value = INK_DECAY;
      run(advect, ink.write);
      ink.swap();
      renderer.setRenderTarget(prev);
    },
    clear() {
      const prev = renderer.getRenderTarget();
      const alpha = renderer.getClearAlpha();
      const saved = renderer.getClearColor(new Color());
      renderer.setClearColor(0x000000, 0);
      for (const t of all()) {
        renderer.setRenderTarget(t);
        renderer.clear(true, false, false);
      }
      renderer.setClearColor(saved, alpha);
      renderer.setRenderTarget(prev);
    },
    dispose() {
      all().forEach((t) => t.dispose());
      mats.forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
  texel.set(1 / gw, 1 / gh);
  return fluid;
}
