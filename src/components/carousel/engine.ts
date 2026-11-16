// Plain three.js carousel. Loaded on demand by CarouselCanvas so phones and
// no-WebGL visitors never download three.

import {
  Camera,
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import type { Card } from "@/data/site";
import { sheetRect } from "@/components/sheet";
import { createFluid } from "./fluid";
import {
  RIB_CARD_H,
  RIB_CARD_W,
  RIB_DU,
  RIB_GAP,
  RIB_N,
  RIB_REST,
  RIB_ROWS,
  RIB_U_MIN,
  buildRibbon,
  sampleRibbon,
} from "./ribbon";
import { fragmentShader, postFragmentShader, postVertexShader, vertexShader } from "./shaders";

export interface Engine {
  setEntered(entered: boolean): void;
  setOpen(id: string | null): void;
  setReduced(reduced: boolean): void;
  dispose(): void;
}

interface Options {
  cards: Card[];
  onOpen(id: string): void;
  onFail(): void;
}

const FOV = 35;
const DIST = 10;
const TEX_W = 1280;
const TEX_H = 800;
const BG = [0x0b / 255, 0x0b / 255, 0x0c / 255] as const;

// Motion, measured against the reference with frame captures at 60 fps.
// Scroll eases toward a target; the rate depends on what moved it last.
const K_WHEEL = 5; // 1/s: one notch coasts ~0.9 s
const K_FLING = 2.8; // 1/s: a thrown wall settles in ~1.8 s, like the reference
// Share of the release speed the throw keeps. With K_FLING and DRAG_GAIN a
// throw coasts ~0.39 px per px/s of finger speed. The reference coasts the same
// pixel distance for the same finger speed at 1440x900 and 1920x1080, so this is
// deliberately not scaled by the viewport.
const FLING_KEEP = 1.03; // scaled with K_FLING so the coast distance is unchanged
const K_DRAG = 35; // 1/s: wall trails the finger by ~30 ms
const K_KEY = 6;
const DRAG_GAIN = 1.05; // wall px per finger px at the centre
const WHEEL_GAIN = 0.0016; // world units per wheel px, times the view height
const BLUR_PER_SPEED = 0.022; // smear length in px per (px/s) of wall speed
const BLUR_MAX = 160; // px
const OPEN_MS = 500;
const CLOSE_MS = 600;
const FLUID_LIFE = 4500; // ms after the last stir before the liquid stops
// Hover, measured on the reference: about 0.8 s after the pointer comes onto a
// card, the card gives a little under it (a soft dent) and turns slightly
// counter-clockwise about the view axis, overshooting once before it settles;
// when the pointer leaves it eases back over ~1 s. Lengths in view heights.
const HOVER_DELAY = 0.8; // s
const DENT = [-0.043, 0.24, 0.25] as const; // depth, width along, width across
const HOVER_ROLL = 0.022; // rad
const HOVER_W = 7; // rad/s, spring onto the hover pose
const HOVER_Z = 0.35; // damping ratio (one visible overshoot)
const HOVER_RELEASE = 1.1; // s, ease back once the pointer leaves
const HOVER_FOLLOW = 1.5; // 1/s, dent following the pointer across a card
// A quick move over a card kicks the part of the card it crossed, a fifth of a
// second later, into a short counter-clockwise turn about the view axis
// (whatever the direction: edges left of centre dip, right of centre lift),
// gone ~0.6 s after.
const WIG_DELAY = 0.2; // s
const WIG_W = 12; // rad/s
const WIG_Z = 0.7;
const WIG_GAIN = 4.5; // rad/s^2 per (view heights per s) of pointer speed
const WIG_MAX = 0.08; // rad
const WIG_REACH = 0.35; // view heights: only the part of the card near the pass turns

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Damped spring step (semi-implicit, sub-stepped so it holds at any frame rate). */
const spring = (s: { x: number; v: number }, target: number, w: number, z: number, dt: number, force = 0) => {
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (w * w * (target - s.x) - 2 * z * w * s.v + force) * h;
    s.x += s.v * h;
  }
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
/** Least-squares slope of [ms, px] samples, in px/s. */
const slope = (pts: Array<[number, number]>) => {
  const n = pts.length;
  if (n < 2) return 0;
  let st = 0;
  let sx = 0;
  for (const [t, x] of pts) {
    st += t;
    sx += x;
  }
  st /= n;
  sx /= n;
  let num = 0;
  let den = 0;
  for (const [t, x] of pts) {
    num += (t - st) * (x - sx);
    den += (t - st) * (t - st);
  }
  return den > 16 ? (num / den) * 1000 : 0;
};

export function createEngine(host: HTMLElement, opts: Options): Engine | null {
  const { cards } = opts;
  const n = cards.length;

  // Probe WebGL2 ourselves so a missing context falls back quietly instead of
  // three logging errors.
  const canvas = document.createElement("canvas");
  let renderer: WebGLRenderer;
  try {
    const context = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!context) return null;
    renderer = new WebGLRenderer({ canvas, context, antialias: false, alpha: false });
  } catch {
    return null;
  }
  // Shaders write display values straight through, so clear with the raw value.
  const bg = new Color().setRGB(BG[0], BG[1], BG[2], LinearSRGBColorSpace);
  renderer.setClearColor(bg, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, DIST);

  /* ---------- Post pass (motion blur) ---------- */

  const sceneRT = new WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: false });
  const postMat = new ShaderMaterial({
    vertexShader: postVertexShader,
    fragmentShader: postFragmentShader,
    uniforms: { uScene: { value: sceneRT.texture }, uBlur: { value: 0 } },
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new Scene();
  const postQuad = new Mesh(new PlaneGeometry(2, 2), postMat);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);
  const postCam = new Camera();

  /* ---------- Pointer liquid ---------- */

  const fluid = createFluid(renderer);

  /* ---------- Shared uniforms ---------- */

  const ribData = buildRibbon();
  const ribTex = new DataTexture(ribData, RIB_N, RIB_ROWS, RGBAFormat, FloatType);
  ribTex.minFilter = NearestFilter;
  ribTex.magFilter = NearestFilter;
  ribTex.generateMipmaps = false;
  ribTex.needsUpdate = true;
  const shared = {
    uRibbon: { value: ribTex },
    uRibMap: { value: new Vector3(RIB_U_MIN, 1 / RIB_DU, RIB_N - 1) },
    uUnit: { value: 1 },
    uShift: { value: RIB_REST },
    uDent: { value: new Vector3(DENT[0], DENT[1], DENT[2]) },
    uRoll: { value: HOVER_ROLL },
    uWigReach: { value: WIG_REACH },
    uTarget: { value: new Vector4() },
    uFluidVel: { value: fluid?.velocity() ?? null },
    uFluidInk: { value: fluid?.ink() ?? null },
    uFluidTexel: { value: fluid?.texel ?? new Vector2(1, 1) },
    uResolution: { value: new Vector2(1, 1) },
    uRipple: { value: fluid ? 1 : 0 },
    uCornerCard: { value: 0.1 },
    uCornerSheet: { value: 0.1 },
    uTexAspect: { value: TEX_W / TEX_H },
    uSize: { value: new Vector2(1, 1) },
  };

  /* ---------- Cards ---------- */

  const geometry = new PlaneGeometry(1, 1, 64, 1);
  const css = getComputedStyle(document.documentElement);
  const displayFont = css.getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
  const textFont = css.getPropertyValue("--font-text").trim() || "system-ui, sans-serif";

  const items = cards.map((card, i) => {
    const tex = document.createElement("canvas");
    tex.width = TEX_W;
    tex.height = TEX_H;
    const texture = new CanvasTexture(tex);
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 4;
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        ...shared,
        uMap: { value: texture },
        uOffset: { value: 0 },
        uOpen: { value: 0 },
        uHover: { value: new Vector4() },
        uWigAt: { value: new Vector2() },
      },
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return {
      card,
      i,
      tex,
      texture,
      material,
      mesh,
      image: null as HTMLImageElement | null,
      // Hover pose: spring toward 1 while hovered, pointer spot on the card,
      // and the short roll kicked by quick moves.
      hover: { x: 0, v: 0 },
      spotX: 0,
      spotY: 0,
      wig: { x: 0, v: 0 },
      wigX: 0, // where on the card the last quick move passed
      wigY: 0,
      depth: 0,
    };
  });

  // Share of the texture height the wall shows (cards are wider than 16:10
  // and crop from the bottom), so the caption sits inside the visible part.
  let visible = 1;

  const paint = (item: (typeof items)[number]) => {
    const ctx = item.tex.getContext("2d")!;
    const { card, image } = item;
    const vh = TEX_H * visible;
    ctx.fillStyle = "#151516";
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    if (image) {
      const s = Math.max(TEX_W / image.naturalWidth, TEX_H / image.naturalHeight);
      const w = image.naturalWidth * s;
      ctx.drawImage(image, (TEX_W - w) / 2, 0, w, image.naturalHeight * s);
    } else {
      // Typographic cover.
      ctx.fillStyle = "#232325";
      ctx.font = `800 ${Math.round(vh * 0.3)}px ${displayFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(card.short.toUpperCase(), TEX_W / 2, vh * 0.44, TEX_W * 0.9);
    }
    const g = ctx.createLinearGradient(0, vh * 0.45, 0, vh);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.6, "rgba(0,0,0,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(0, vh * 0.45, TEX_W, TEX_H - vh * 0.45);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f2f1ec";
    ctx.font = `800 76px ${displayFont}`;
    ctx.fillText(card.short.toUpperCase(), 56, vh - 92, TEX_W - 112);
    ctx.fillStyle = "rgba(242,241,236,0.72)";
    ctx.font = `500 30px ${textFont}`;
    ctx.fillText(card.role, 58, vh - 46, TEX_W - 112);
    item.texture.needsUpdate = true;
  };

  let disposed = false;
  const fontsReady = document.fonts
    ? Promise.all([document.fonts.load(`800 76px ${displayFont}`), document.fonts.load(`500 30px ${textFont}`)]).catch(
        () => undefined,
      )
    : Promise.resolve();

  /* ---------- Layout ---------- */

  let W = 1;
  let H = 1;
  let pxWorld = 0.01;
  let worldH = 1;
  let cardW = 1;
  let cardH = 1;
  let step = 1;
  let L = 1;
  let unit = 1; // world units per ribbon unit

  const layout = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    worldH = 2 * DIST * Math.tan((FOV * Math.PI) / 360);
    pxWorld = worldH / H;

    // The ribbon is sized by height like the reference (wider screens show
    // more of it); on narrow screens it shrinks so the centred card still fits.
    const oldStep = step;
    unit = worldH * Math.min(1, camera.aspect / 1.55);
    cardW = RIB_CARD_W * unit;
    cardH = RIB_CARD_H * unit;
    step = (RIB_CARD_W + RIB_GAP) * unit;
    L = step * n;
    // Keep the same card centred when the step size changes.
    scroll *= step / oldStep;
    target *= step / oldStep;
    prevScroll = scroll;

    shared.uSize.value.set(cardW, cardH);
    shared.uUnit.value = unit;
    shared.uCornerCard.value = 18 * pxWorld;
    const r = sheetRect(W, H);
    shared.uCornerSheet.value = r.radius * pxWorld;
    shared.uTarget.value.set((r.x + r.w / 2 - W / 2) * pxWorld, -(r.y + r.h / 2 - H / 2) * pxWorld, r.w * pxWorld, r.h * pxWorld);

    const buf = renderer.getDrawingBufferSize(new Vector2());
    shared.uResolution.value.copy(buf);
    sceneRT.setSize(buf.x, buf.y);
    fluid?.resize(W, H);

    const vis = Math.min(1, TEX_W / TEX_H / (cardW / cardH));
    if (Math.abs(vis - visible) > 0.01) {
      visible = vis;
      items.forEach(paint);
    }
  };

  /* ---------- State ---------- */

  let scroll = 0;
  let target = 0;
  let follow = K_WHEEL; // ease rate toward target, set by the last input
  let prevScroll = 0;
  let speed = 0; // smoothed wall speed, css px/s at the centre
  let entered = false;
  let reduced = false;
  let hidden = document.hidden;
  let enteredAt = 0;

  let openIndex = -1; // card that is open or closing
  let openT = 0; // linear progress 0..1
  let openDir = 0; // 1 opening, -1 closing, 0 settled

  const pointer = {
    x: -1,
    y: -1,
    inside: false,
    lastX: -1,
    lastY: -1,
    lastT: 0,
    down: false,
    downX: 0,
    downY: 0,
    dragging: false,
    dragLastX: 0,
    dragLastT: 0,
    dragVel: 0, // css px per s
    mouse: false, // last move came from a mouse or pen, not a finger
  };
  const trail: Array<[number, number]> = []; // recent [time, x] while dragging
  let hoverIndex = -1;
  let lastStir = -1e9;
  let fluidLive = false;

  // Hover follows the pointer late, like the reference: pointer samples go
  // into a short history and the pose follows the one from HOVER_DELAY ago.
  const canHover = typeof matchMedia !== "function" || matchMedia("(hover: hover)").matches;
  const hoverMotion = () => canHover && !reduced;
  type Sample = { t: number; i: number; x: number; y: number };
  const history: Sample[] = [];
  let hoverAt: Sample = { t: -1e9, i: -1, x: 0, y: 0 };
  const kicks: Array<{ t: number; i: number; s: number; x: number; y: number }> = []; // pointer over a card, per frame

  const wrap = (x: number) => x - L * Math.round(x / L);
  const offsetOf = (i: number) => wrap(i * step - scroll);
  /** Scroll value that centres card i, nearest to the current scroll. */
  const scrollFor = (i: number) => {
    const base = i * step;
    return base + L * Math.round((target - base) / L);
  };

  /* ---------- Geometry for picking (mirrors the vertex shader) ---------- */

  type Item = (typeof items)[number];
  const v = new Vector3();
  const cen = [0, 0, 0];
  const upv = [0, 0, 0];
  const nrm = [0, 0, 0];
  let openAmount = 0;

  /** World position of a card point; px, py from -0.5 to 0.5 (py up). */
  const cardPoint = (it: Item, px: number, py: number, open: number, out: Vector3) => {
    const lx = (px * cardW) / unit;
    const ly = (py * cardH) / unit;
    const u = offsetOf(it.i) / unit + RIB_REST + lx;
    sampleRibbon(ribData, u, 0, cen);
    sampleRibbon(ribData, u, 1, upv);
    let x = cen[0] + upv[0] * ly;
    let y = cen[1] + upv[1] * ly;
    let z = cen[2] + upv[2] * ly;
    const hv = it.material.uniforms.uHover.value as Vector4;
    if (hv.x !== 0 || hv.w !== 0) {
      sampleRibbon(ribData, u, 2, nrm);
      const dx = ((px - hv.y) * cardW) / unit / DENT[1];
      const dy = ((py - hv.z) * cardH) / unit / DENT[2];
      const g = DENT[0] * hv.x * Math.exp(-0.5 * (dx * dx + dy * dy));
      x += nrm[0] * g;
      y += nrm[1] * g;
      z += nrm[2] * g;
      const wa = it.material.uniforms.uWigAt.value as Vector2;
      const wx = ((px - wa.x) * cardW) / unit / WIG_REACH;
      const wy = ((py - wa.y) * cardH) / unit / WIG_REACH;
      const a = HOVER_ROLL * hv.x + hv.w * Math.exp(-0.5 * (wx * wx + wy * wy));
      const c = Math.cos(a);
      const s = Math.sin(a);
      [x, y] = [x * c - y * s, x * s + y * c];
    }
    x *= unit;
    y *= unit;
    z *= unit;
    const t = shared.uTarget.value;
    return out.set(x + (t.x + px * t.z - x) * open, y + (t.y + py * t.w - y) * open, z * (1 - open));
  };

  // Each card is tested as a grid of projected points, nearest card first, so
  // a click lands on the card drawn on top at any pose.
  const COLS = 24;
  const gx = new Float32Array((COLS + 1) * 3);
  const gy = new Float32Array((COLS + 1) * 3);
  let byDepth: Item[] = [];

  /** Card under a css-px point, with the point's spot on it (-0.5..0.5, y up). */
  const pick = (cx: number, cy: number) => {
    const nx = (cx / W) * 2 - 1;
    const ny = -((cy / H) * 2 - 1);
    for (const it of byDepth) {
      if (!it.mesh.visible) continue;
      const open = it.i === openIndex ? openAmount : 0;
      let ok = true;
      for (let r = 0; r < 3 && ok; r++) {
        for (let k = 0; k <= COLS; k++) {
          cardPoint(it, -0.5 + k / COLS, 0.5 - r * 0.5, open, v);
          if (v.z > DIST - 0.2) {
            ok = false;
            break;
          }
          v.project(camera);
          gx[r * (COLS + 1) + k] = v.x;
          gy[r * (COLS + 1) + k] = v.y;
        }
      }
      if (!ok) continue;
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < COLS; k++) {
          const a = r * (COLS + 1) + k;
          const c = a + COLS + 2;
          // Two triangles per cell: (a, a+1, c) and (a, c, c-1).
          for (const [b, d] of [
            [a + 1, c],
            [c, c - 1],
          ]) {
            const x0 = gx[a];
            const y0 = gy[a];
            const e1x = gx[b] - x0;
            const e1y = gy[b] - y0;
            const e2x = gx[d] - x0;
            const e2y = gy[d] - y0;
            const det = e1x * e2y - e2x * e1y;
            if (Math.abs(det) < 1e-12) continue;
            const s = ((nx - x0) * e2y - e2x * (ny - y0)) / det;
            const q = (e1x * (ny - y0) - (nx - x0) * e1y) / det;
            if (s < 0 || q < 0 || s + q > 1) continue;
            const grid = (idx: number) => [-0.5 + (idx % (COLS + 1)) / COLS, 0.5 - Math.floor(idx / (COLS + 1)) * 0.5];
            const [ax, ay] = grid(a);
            const [bx, by] = grid(b);
            const [dx, dy] = grid(d);
            return { i: it.i, x: ax + (bx - ax) * s + (dx - ax) * q, y: ay + (by - ay) * s + (dy - ay) * q };
          }
        }
      }
    }
    return null;
  };

  /* ---------- Frame ---------- */

  let raf = 0;
  let last = 0;

  const hoverSettled = () =>
    (history.length === 0 || history[history.length - 1] === hoverAt) &&
    !kicks.some((k) => k.s > 0) &&
    items.every(
      (it) =>
        Math.abs(it.hover.x - (hoverAt.i === it.i ? 1 : 0)) < 1e-3 &&
        Math.abs(it.hover.v) < 1e-3 &&
        Math.abs(it.wig.x) < 1e-4 &&
        Math.abs(it.wig.v) < 1e-3,
    );

  const settled = () =>
    openDir === 0 &&
    !pointer.down &&
    Math.abs(target - scroll) < 1e-3 &&
    speed < 0.5 &&
    !fluidLive &&
    hoverSettled();

  const wantRunning = () => entered && !hidden && !settled();

  const update = (dt: number) => {
    const now = performance.now();

    scroll += (target - scroll) * damp(pointer.dragging ? K_DRAG : follow, dt);
    if (Math.abs(target - scroll) < 1e-4) scroll = target;
    const vel = dt > 0 ? (scroll - prevScroll) / dt / pxWorld : 0; // css px/s
    prevScroll = scroll;
    if (dt > 0) speed += (Math.abs(vel) - speed) * damp(12, dt);
    if (speed < 0.5 && Math.abs(target - scroll) < 1e-3) speed = 0;
    const blurPx = reduced ? 0 : Math.min(BLUR_MAX, speed * BLUR_PER_SPEED);
    postMat.uniforms.uBlur.value = blurPx < 0.75 ? 0 : (blurPx / W) * Math.sign(vel || 1);

    // Open / close progress.
    if (openDir !== 0) {
      const dur = openDir > 0 ? OPEN_MS : CLOSE_MS;
      openT = reduced ? 0 : clamp(openT + (openDir * dt * 1000) / dur, 0, 1);
      if (reduced && openDir > 0) openDir = 0;
      if (openDir > 0 && openT >= 1) openDir = 0;
      if (openDir < 0 && openT <= 0) {
        openDir = 0;
        openIndex = -1;
      }
    }
    // Opening runs the curve forward; closing plays the same ease-out from
    // the sheet back to the wall.
    openAmount = openDir < 0 ? 1 - easeOut(1 - openT) : easeOut(openT);

    // Place the cards; draw far ones first.
    for (const it of items) {
      const u = it.material.uniforms;
      u.uOffset.value = offsetOf(it.i);
      u.uOpen.value = it.i === openIndex ? openAmount : 0;
      const ru = u.uOffset.value / unit + RIB_REST;
      // Past the ends the ribbon runs off screen; skip the cards there.
      it.mesh.visible = it.i === openIndex || Math.abs(ru) < 2.6;
      sampleRibbon(ribData, ru, 0, cen);
      it.depth = Math.hypot(cen[0] * unit, cen[1] * unit, cen[2] * unit - DIST);
    }
    byDepth = [...items].sort((a, b) => a.depth - b.depth);
    byDepth.forEach((it, rank) => {
      it.mesh.renderOrder = it.i === openIndex ? 1000 : items.length - rank;
    });

    // Hover. The cursor reacts at once; the pose follows the delayed sample.
    const hit = pointer.inside && !pointer.dragging && openIndex < 0 && entered ? pick(pointer.x, pointer.y) : null;
    hoverIndex = hit ? hit.i : -1;
    canvas.style.cursor = pointer.dragging ? "grabbing" : hoverIndex >= 0 ? "pointer" : "grab";
    if (hoverMotion()) {
      const t = now / 1000;
      const cur = hit && pointer.mouse ? hit : null;
      const lastS = history[history.length - 1] ?? hoverAt;
      if (lastS.i !== (cur?.i ?? -1) || (cur && Math.hypot(lastS.x - cur.x, lastS.y - cur.y) > 0.01)) {
        history.push({ t, i: cur?.i ?? -1, x: cur?.x ?? lastS.x, y: cur?.y ?? lastS.y });
      }
      while (history.length > 1 && history[1].t <= t - HOVER_DELAY) history.shift();
      if (history.length && history[0].t <= t - HOVER_DELAY) hoverAt = history[0];
      // Pointer speed over a card, in view heights per second.
      const moved = cur && dt > 0 && pointer.lastX >= 0 ? Math.hypot(pointer.x - pointer.lastX, pointer.y - pointer.lastY) : 0;
      const ptrSpeed = dt > 0 ? moved / H / dt : 0;
      kicks.push({ t, i: cur?.i ?? -1, s: ptrSpeed, x: cur?.x ?? 0, y: cur?.y ?? 0 });
      while (kicks.length > 1 && kicks[1].t <= t - WIG_DELAY) kicks.shift();
      const kick0 = kicks[0].t <= t - WIG_DELAY ? kicks[0] : null;
      for (const it of items) {
        if (hoverAt.i === it.i) {
          if (it.hover.x < 0.01 && Math.abs(it.hover.v) < 0.01) {
            it.spotX = hoverAt.x;
            it.spotY = hoverAt.y;
          }
          spring(it.hover, 1, HOVER_W, HOVER_Z, dt);
          it.spotX += (hoverAt.x - it.spotX) * damp(HOVER_FOLLOW, dt);
          it.spotY += (hoverAt.y - it.spotY) * damp(HOVER_FOLLOW, dt);
        } else {
          it.hover.x -= it.hover.x * damp(1 / HOVER_RELEASE, dt);
          it.hover.v = 0;
          if (it.hover.x < 1e-3) it.hover.x = 0;
        }
        const kicked = kick0 && kick0.i === it.i && kick0.s > 0 ? kick0 : null;
        if (kicked) {
          it.wigX = kicked.x;
          it.wigY = kicked.y;
        }
        spring(it.wig, 0, WIG_W, WIG_Z, dt, kicked ? WIG_GAIN * kicked.s : 0);
        it.wig.x = clamp(it.wig.x, -WIG_MAX, WIG_MAX);
        if (Math.abs(it.wig.x) < 1e-5 && Math.abs(it.wig.v) < 1e-4) it.wig.x = it.wig.v = 0;
      }
    } else {
      // Reduced motion and touch screens keep the neutral pose.
      history.length = 0;
      kicks.length = 0;
      hoverAt = { t: -1e9, i: -1, x: 0, y: 0 };
      for (const it of items) {
        it.hover.x = it.hover.v = it.wig.x = it.wig.v = 0;
      }
    }
    for (const it of items) {
      (it.material.uniforms.uHover.value as Vector4).set(it.hover.x, it.spotX, it.spotY, it.wig.x);
      (it.material.uniforms.uWigAt.value as Vector2).set(it.wigX, it.wigY);
    }

    // Liquid: stir along the pointer path, then let it run down.
    shared.uRipple.value = fluid && !reduced ? 1 : 0;
    if (fluid && !reduced) {
      const moved = pointer.inside && pointer.lastX >= 0 && (pointer.x !== pointer.lastX || pointer.y !== pointer.lastY);
      if (moved && dt > 0) {
        const dx = pointer.x - pointer.lastX;
        const dy = pointer.y - pointer.lastY;
        const len = Math.hypot(dx, dy);
        const steps = Math.min(8, Math.max(1, Math.ceil(len / 24)));
        for (let s = 1; s <= steps; s++) {
          fluid.splat(pointer.lastX + (dx * s) / steps, pointer.lastY + (dy * s) / steps, dx / dt, dy / dt, W, H);
        }
        lastStir = now;
      }
      const live = now - lastStir < FLUID_LIFE;
      if (live) fluid.step(Math.min(dt, 1 / 30));
      else if (fluidLive) fluid.clear();
      fluidLive = live;
      // The solver ping-pongs its targets (and remakes them on resize), so
      // point the cards at the current ones every frame.
      shared.uFluidVel.value = fluid.velocity();
      shared.uFluidInk.value = fluid.ink();
    } else {
      fluidLive = false;
    }
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  };

  const render = () => {
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    update(dt);
    render();
    if (wantRunning()) raf = requestAnimationFrame(frame);
  };

  const kick = () => {
    if (raf || disposed || !wantRunning()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  function renderOnce() {
    if (disposed) return;
    if (raf) return; // the loop will pick it up
    update(0);
    render();
  }

  /* ---------- Input ---------- */

  const localXY = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const interactive = () => entered && openIndex < 0;

  const onPointerMove = (e: PointerEvent) => {
    const [x, y] = localXY(e);
    if (!pointer.inside) {
      pointer.lastX = x;
      pointer.lastY = y;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
    pointer.mouse = e.pointerType !== "touch";
    if (!reduced && fluid) {
      lastStir = performance.now();
      fluidLive = true;
    }
    if (pointer.down) {
      const dx = x - pointer.dragLastX;
      if (!pointer.dragging && Math.hypot(x - pointer.downX, y - pointer.downY) > 6) pointer.dragging = true;
      if (pointer.dragging) {
        target -= dx * pxWorld * DRAG_GAIN;
        // Event time, not handler time: moves can be delivered in bursts, which
        // would read as a much faster finger than the real one.
        const now = e.timeStamp || performance.now();
        // Release speed: least-squares slope of finger travel over the last ~100 ms.
        trail.push([now, x]);
        while (trail.length > 2 && now - trail[0][0] > 100) trail.shift();
        pointer.dragVel = slope(trail);
        pointer.dragLastT = now;
      }
      pointer.dragLastX = x;
    }
    kick();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!interactive() || e.button !== 0) return;
    const [x, y] = localXY(e);
    pointer.down = true;
    pointer.dragging = false;
    pointer.downX = x;
    pointer.downY = y;
    pointer.dragLastX = x;
    pointer.dragLastT = e.timeStamp || performance.now();
    pointer.dragVel = 0;
    trail.length = 0;
    trail.push([pointer.dragLastT, x]);
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!pointer.down) return;
    pointer.down = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (pointer.dragging) {
      pointer.dragging = false;
      // Throw: keep the release speed and let it run down slowly. A pause
      // before letting go leaves nothing to throw.
      const idle = (e.timeStamp || performance.now()) - pointer.dragLastT;
      const vRelease = idle < 60 ? pointer.dragVel : 0;
      // Easing at K_FLING toward this target starts at FLING_KEEP of the release speed.
      target -= (vRelease * FLING_KEEP * pxWorld * DRAG_GAIN) / K_FLING;
      follow = K_FLING;
      kick();
      return;
    }
    const [x, y] = localXY(e);
    const hit = pick(x, y);
    if (hit) opts.onOpen(cards[hit.i].id);
  };

  const onPointerLeave = () => {
    pointer.inside = false;
    kick();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!interactive() || performance.now() - enteredAt < 450) return;
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * scale;
    target += clamp(d, -240, 240) * WHEEL_GAIN * worldH;
    follow = K_WHEEL;
    kick();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!interactive() || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      target = Math.round(target / step) * step + (e.key === "ArrowRight" ? step : -step);
      follow = K_KEY;
      kick();
    }
  };

  const onVisibility = () => {
    hidden = document.hidden;
    kick();
  };

  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onFail();
  };

  const ro = new ResizeObserver(() => {
    layout();
    renderOnce();
  });

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onLost);
  window.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  layout();
  ro.observe(host);

  items.forEach((item) => {
    paint(item);
    if (!item.card.cover) {
      fontsReady.then(() => {
        if (disposed) return;
        paint(item);
        renderOnce();
      });
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = item.card.cover;
    Promise.all([img.decode().then(() => img).catch(() => null), fontsReady]).then(([loaded]) => {
      if (disposed) return;
      item.image = loaded;
      paint(item);
      renderOnce();
    });
  });
  renderOnce();

  return {
    setEntered(next) {
      if (next === entered) return;
      entered = next;
      if (entered) {
        enteredAt = performance.now();
        // Slide the wall in from the right unless a project is already open.
        if (openIndex < 0 && !reduced) scroll = target + L * 0.22;
        prevScroll = scroll;
        follow = K_WHEEL;
        kick();
      }
    },
    setOpen(id) {
      const idx = id ? cards.findIndex((c) => c.id === id) : -1;
      if (idx >= 0) {
        const wasOpen = openIndex >= 0 && openDir >= 0;
        target = scrollFor(idx);
        follow = K_KEY;
        if (wasOpen || !entered || reduced) {
          // Prev / next, direct load, or reduced motion: jump straight there.
          // Reduced motion never grows the card; the sheet cross-fades over it.
          scroll = prevScroll = target;
          openIndex = idx;
          openT = reduced ? 0 : 1;
          openDir = 0;
          renderOnce();
        } else {
          openIndex = idx;
          openDir = 1;
        }
      } else if (openIndex >= 0) {
        openDir = -1;
        if (reduced || hidden) {
          openT = 0;
          openDir = 0;
          openIndex = -1;
        }
      }
      kick();
    },
    setReduced(next) {
      reduced = next;
      renderOnce();
      kick();
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      items.forEach((it) => {
        it.texture.dispose();
        it.material.dispose();
      });
      geometry.dispose();
      postMat.dispose();
      postQuad.geometry.dispose();
      sceneRT.dispose();
      fluid?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
