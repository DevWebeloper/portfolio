// Plain three.js carousel. Loaded on demand by CarouselCanvas so phones and
// no-WebGL visitors never download three.

import {
  Camera,
  CanvasTexture,
  Color,
  Euler,
  LinearFilter,
  LinearSRGBColorSpace,
  Matrix3,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
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
// Idle ribbon wave, in units of the view height. The main wave rises to the
// right through the centre (as the reference wall sits); it sways and breathes
// slowly while a faint shorter wave drifts along it.
const WAVE_AMP = 0.025;
const WAVE_LEN = 1.29;
const WAVE_SWAY = 0.08; // rad of phase sway
const WAVE2_AMP = 0.0025;
const WAVE2_LEN = 0.75;
const IDLE_FRAME_MS = 1000 / 30; // frame budget while only the wave moves

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
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

  const tilt = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromEuler(new Euler(-0.03, 0.12, 0.03)));
  const shared = {
    uRadius: { value: 10 },
    uTilt: { value: tilt },
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
    uWave: { value: new Vector4() },
    uWave2: { value: new Vector2() },
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
      uniforms: {
        ...shared,
        uMap: { value: texture },
        uOffset: { value: 0 },
        uOpen: { value: 0 },
      },
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { card, i, tex, texture, material, mesh, image: null as HTMLImageElement | null };
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
  let worldW = 1;
  let worldH = 1;
  let cardW = 1;
  let cardH = 1;
  let step = 1;
  let L = 1;

  const layout = () => {
    W = Math.max(1, host.clientWidth);
    H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    worldH = 2 * DIST * Math.tan((FOV * Math.PI) / 360);
    worldW = worldH * camera.aspect;
    pxWorld = worldH / H;

    // Sized by height like the reference (wider screens show more of the
    // neighbours), but never wider than the screen allows.
    const oldStep = step;
    cardH = worldH * 0.62;
    cardW = Math.min(cardH * 2.15, worldW * 0.84);
    cardH = Math.min(cardH, cardW / 1.45);
    step = cardW + worldH * 0.03;
    L = step * n;
    // Keep the same card centred when the step size changes.
    scroll *= step / oldStep;
    target *= step / oldStep;
    prevScroll = scroll;

    shared.uSize.value.set(cardW, cardH);
    shared.uRadius.value = worldW * 1.0;
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
  };
  const trail: Array<[number, number]> = []; // recent [time, x] while dragging
  let hoverIndex = -1;
  let lastStir = -1e9;
  let fluidLive = false;

  let waveT = 0; // s, runs only while the wall is on show and motion is allowed
  const wave = shared.uWave.value;
  const wave2 = shared.uWave2.value;
  /** Same ribbon offset as the vertex shader, for picking. */
  const waveAt = (x: number) => wave.x * Math.sin(wave.y * x + wave.z) + wave.w * Math.sin(wave2.x * x + wave2.y);
  const setWave = () => {
    const tau = Math.PI * 2;
    wave.set(
      WAVE_AMP * worldH * (1 + 0.04 * Math.sin((tau * waveT) / 6.1)),
      tau / (WAVE_LEN * worldH),
      WAVE_SWAY * Math.sin((tau * waveT) / 7.3),
      WAVE2_AMP * worldH,
    );
    wave2.set(tau / (WAVE2_LEN * worldH), (-tau * waveT) / 9.0);
  };

  const wrap = (x: number) => x - L * Math.round(x / L);
  const offsetOf = (i: number) => wrap(i * step - scroll);
  /** Scroll value that centres card i, nearest to the current scroll. */
  const scrollFor = (i: number) => {
    const base = i * step;
    return base + L * Math.round((target - base) / L);
  };

  /* ---------- Picking (mirrors the vertex shader) ---------- */

  const v = new Vector3();
  const outline: Array<[number, number]> = [];
  for (let k = 0; k <= 16; k++) outline.push([-0.5 + k / 16, 0.5]);
  for (let k = 1; k < 4; k++) outline.push([0.5, 0.5 - k / 4]);
  for (let k = 16; k >= 0; k--) outline.push([-0.5 + k / 16, -0.5]);
  for (let k = 3; k > 0; k--) outline.push([-0.5, 0.5 - k / 4]);

  const project = (i: number, px: number, py: number, open: number) => {
    const R = shared.uRadius.value;
    const lx = px * cardW;
    const x = offsetOf(i) + lx;
    const ly = py * cardH + waveAt(x);
    const th = x / R;
    v.set(R * Math.sin(th), ly, R * (1 - Math.cos(th))).applyMatrix3(tilt);
    const t = shared.uTarget.value;
    const sx = t.x + px * t.z;
    const sy = t.y + py * t.w;
    v.set(v.x + (sx - v.x) * open, v.y + (sy - v.y) * open, v.z * (1 - open));
    if (v.z > DIST - 0.2) return null;
    v.project(camera);
    return v;
  };

  const pick = (cx: number, cy: number) => {
    const nx = (cx / W) * 2 - 1;
    const ny = -((cy / H) * 2 - 1);
    for (const item of items) {
      const open = item.i === openIndex ? easeOut(openT) : 0;
      const pts: Array<[number, number]> = [];
      let ok = true;
      for (const [px, py] of outline) {
        const p = project(item.i, px, py, open);
        if (!p) {
          ok = false;
          break;
        }
        pts.push([p.x, p.y]);
      }
      if (!ok) continue;
      let inside = false;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [xa, ya] = pts[a];
        const [xb, yb] = pts[b];
        if (ya > ny !== yb > ny && nx < ((xb - xa) * (ny - ya)) / (yb - ya) + xa) inside = !inside;
      }
      if (inside) return item.i;
    }
    return -1;
  };

  /* ---------- Frame ---------- */

  let raf = 0;
  let last = 0;

  const settled = () =>
    openDir === 0 &&
    !pointer.down &&
    Math.abs(target - scroll) < 1e-3 &&
    speed < 0.5 &&
    !fluidLive;

  // The wave keeps the loop going at a reduced rate, except under reduced
  // motion and while a project is fully open: the sheet then covers all but a
  // thin margin of the wall, where a few px of drift would not be seen.
  const waving = () => entered && !reduced && !(openIndex >= 0 && openDir === 0);

  const wantRunning = () => entered && !hidden && (waving() || !settled());

  const update = (dt: number) => {
    const now = performance.now();
    if (waving()) waveT += dt;
    setWave();

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
    const openAmount = openDir < 0 ? 1 - easeOut(1 - openT) : easeOut(openT);

    // Hover only changes the cursor; the reference card does not react.
    hoverIndex = pointer.inside && !pointer.dragging && openIndex < 0 ? pick(pointer.x, pointer.y) : -1;
    canvas.style.cursor = pointer.dragging ? "grabbing" : hoverIndex >= 0 ? "pointer" : "grab";

    for (const it of items) {
      const u = it.material.uniforms;
      u.uOffset.value = offsetOf(it.i);
      u.uOpen.value = it.i === openIndex ? openAmount : 0;
      it.mesh.renderOrder = it.i === openIndex ? 10 : 0;
      // Cards far round the back of the cylinder stay hidden.
      it.mesh.visible = it.i === openIndex || Math.abs(u.uOffset.value) < shared.uRadius.value * 1.9;
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
    // Only the wave moving: draw every other frame or so (~30 fps).
    if (now - last < IDLE_FRAME_MS - 2 && settled()) {
      raf = requestAnimationFrame(frame);
      return;
    }
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
    if (hit >= 0) opts.onOpen(cards[hit].id);
  };

  const onPointerLeave = () => {
    pointer.inside = false;
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
