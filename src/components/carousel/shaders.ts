// Card shaders for the curved carousel.
//
// Vertex: lays each card onto the wall ribbon (a precomputed table of centre
// line, up and normal vectors, see ribbon.ts), dents and rolls the hovered
// card, and blends the open card toward a flat on-screen rect.
// Fragment: rounded-corner mask, top-aligned cover crop, and the pointer
// liquid (screen-space fluid velocity + ink bend and light the image).
// Post: horizontal motion blur over the whole frame, length from scroll speed.

export const vertexShader = /* glsl */ `
uniform vec2 uSize;      // card size, world units
uniform float uOffset;   // card centre along the strip, world units
uniform sampler2D uRibbon; // ribbon table: rows centre, up, normal (view-height units)
uniform vec3 uRibMap;    // first u, samples per unit, last index
uniform float uUnit;     // world units per ribbon unit
uniform float uShift;    // ribbon position of strip offset 0
uniform vec4 uHover;     // hover amount, pointer x, y on the card (-0.5..0.5), quick-move turn
uniform vec3 uDent;      // dent depth, width along, width across (ribbon units)
uniform float uRoll;     // hover roll about the view axis, rad
uniform vec2 uWigAt;     // where the last quick move crossed the card (-0.5..0.5)
uniform float uWigReach; // ribbon units
uniform float uOpen;     // 0 on the wall, 1 at the sheet rect
uniform vec4 uTarget;    // sheet rect: centre xy, size zw

varying vec2 vUv;
varying vec2 vSize;
varying float vEdge;

vec3 rib(float u, int row) {
  float f = clamp((u - uRibMap.x) * uRibMap.y, 0.0, uRibMap.z);
  float i = floor(f);
  vec3 a = texelFetch(uRibbon, ivec2(int(i), row), 0).xyz;
  vec3 b = texelFetch(uRibbon, ivec2(int(min(i + 1.0, uRibMap.z)), row), 0).xyz;
  return mix(a, b, f - i);
}

void main() {
  vec2 p = position.xy;                       // -0.5 .. 0.5
  vec2 local = p * uSize / uUnit;             // ribbon units
  float u = (uOffset / uUnit) + uShift + local.x;
  vec3 up = rib(u, 1);
  vec3 nrm = rib(u, 2);
  vec3 bent = rib(u, 0) + up * local.y;
  // Hover: the card gives under the pointer and turns a little
  // counter-clockwise about the view axis (so a card left of centre also
  // sinks, one right of centre rises). engine.ts mirrors this for picking.
  if (uHover.x != 0.0 || uHover.w != 0.0) {
    vec2 d = (p - uHover.yz) * uSize / uUnit / uDent.yz;
    bent += nrm * (uDent.x * uHover.x * exp(-0.5 * dot(d, d)));
    vec2 q = (p - uWigAt) * uSize / uUnit / uWigReach;
    float a = uRoll * uHover.x + uHover.w * exp(-0.5 * dot(q, q));
    bent.xy = mat2(cos(a), sin(a), -sin(a), cos(a)) * bent.xy;
  }
  bent *= uUnit;
  vec3 sheet = vec3(uTarget.xy + p * uTarget.zw, 0.0);
  vec3 pos = mix(bent, sheet, uOpen);

  vUv = uv;
  vSize = mix(uSize, uTarget.zw, uOpen);
  // Sheen where the ribbon turns away from the viewer.
  float facing = abs(dot(normalize(nrm), normalize(cameraPosition - bent)));
  vEdge = clamp((0.9 - facing) / 0.6, 0.0, 1.0) * (1.0 - uOpen);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uFluidVel;
uniform sampler2D uFluidInk;
uniform vec2 uFluidTexel;
uniform vec2 uResolution;   // drawing-buffer pixels
uniform float uRipple;      // 0 disables the liquid
uniform float uOpen;
uniform float uCornerCard;
uniform float uCornerSheet;
uniform float uTexAspect;

varying vec2 vUv;
varying vec2 vSize;
varying float vEdge;

void main() {
  // Rounded-rect mask in world units so corners stay round at any size.
  float r = mix(uCornerCard, uCornerSheet, uOpen);
  vec2 q = abs(vUv - 0.5) * vSize - (vSize * 0.5 - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  float aa = fwidth(d);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.0) discard;

  // Cover-fit the texture, keeping the top of the page in view.
  vec2 uv = vUv;
  float a = vSize.x / vSize.y;
  if (a > uTexAspect) {
    uv.y = 1.0 - (1.0 - uv.y) * (uTexAspect / a);
  } else {
    uv.x = 0.5 + (uv.x - 0.5) * (a / uTexAspect);
  }

  // Liquid: the ink is a height field; its slope refracts the image and
  // catches a highlight, and the flow drags the image along.
  vec3 light = vec3(0.0);
  if (uRipple > 0.0) {
    vec2 s = gl_FragCoord.xy / uResolution;
    vec2 e = uFluidTexel * 6.0;
    float hl = texture2D(uFluidInk, s - vec2(e.x, 0.0)).x;
    float hr = texture2D(uFluidInk, s + vec2(e.x, 0.0)).x;
    float hb = texture2D(uFluidInk, s - vec2(0.0, e.y)).x;
    float ht = texture2D(uFluidInk, s + vec2(0.0, e.y)).x;
    vec2 slope = vec2(hr - hl, ht - hb);
    vec2 flow = texture2D(uFluidVel, s).xy * uFluidTexel;
    // Soft and mostly shading: a little bend, a broad sheen, no sharp glints.
    uv -= (slope * 0.0035 + flow * 0.001) * uRipple;
    vec3 n = normalize(vec3(-slope * 3.0, 1.0));
    vec3 l = normalize(vec3(-0.45, 0.55, 0.7));
    // Minus the flat-surface value so still liquid adds no light.
    float spec = pow(max(dot(n, l), 0.0), 10.0) - pow(l.z, 10.0);
    float shade = dot(n.xy, vec2(0.35, -0.45));
    light = vec3(spec * 0.16 + shade * 0.28) * uRipple;
  }

  vec3 col = texture2D(uMap, uv).rgb;
  col += light;
  // Turned-away parts catch a soft grey sheen, as on the reference.
  col = mix(col, vec3(0.62, 0.62, 0.64), vEdge * 0.35);
  // While a card grows into the project sheet its cover melts into the sheet's
  // own colour (--surface, #151516), so the DOM sheet lands on a matching blank
  // card instead of cross-fading over the cover. Closing plays it backwards.
  col = mix(col, vec3(0.0824, 0.0824, 0.0863), smoothstep(0.45, 0.92, uOpen));
  gl_FragColor = vec4(col, mask);
}
`;

export const postVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Horizontal smear made of discrete taps: at speed it reads as closely spaced
// ghosts, at rest it is a single sample.
export const postFragmentShader = /* glsl */ `
uniform sampler2D uScene;
uniform float uBlur;   // smear length, uv units
varying vec2 vUv;
void main() {
  if (abs(uBlur) < 0.0005) {
    gl_FragColor = vec4(texture2D(uScene, vUv).rgb, 1.0);
    return;
  }
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 32; i++) {
    float t = float(i) / 31.0 - 0.5;
    float w = 1.0 - abs(t);
    col += texture2D(uScene, vec2(vUv.x + t * uBlur, vUv.y)).rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(col / wsum, 1.0);
}
`;
