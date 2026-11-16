// Shape of the wall. The cards ride along a ribbon that is fixed to the view:
// the left end rises and comes toward the viewer, the right end dives down and
// away. The ribbon is described by how its heading, climb and roll change along
// its length (in units of the view height), integrated once into a table that
// the vertex shader and the picking code both read.
//
// Coefficients were fitted to frame captures of the reference wall at 1440x900
// and 2000x837 (cards traced at 70 scroll positions; ~2.4 px rms at 900 px).

/** Polynomial coefficients, lowest order first, in radians per (view height)^k. */
const YAW = [-0.2465, -0.8908, 1.0845, 1.3522, 0.0417, -0.0875];
const CLIMB = [0.0837, 0.0101, -0.9674, -0.7735, 0.0719, 0.1601];
const ROLL = [-0.0301, 0.0366, -1.1735, -1.0, -0.0037, 0.0134];
/** Centre of the ribbon at u = 0, view-height units (z toward the camera). */
const ORIGIN = [0.1299, 0.0392, 0.2325] as const;
/** Past these points the ribbon runs on straight; it is off screen there at 21:9. */
const U_LO = -1.5;
const U_HI = 1.3;

/** Card size and gap along the ribbon, view-height units. */
export const RIB_CARD_W = 1.198;
export const RIB_CARD_H = 0.534;
export const RIB_GAP = 0.012;
/** Where the centred card sits along the ribbon at rest. */
export const RIB_REST = -0.175;

/** Table layout: N samples over [U_MIN, U_MAX]; rows: centre, up, normal. */
export const RIB_N = 256;
export const RIB_U_MIN = -3;
export const RIB_U_MAX = 3;
export const RIB_DU = (RIB_U_MAX - RIB_U_MIN) / (RIB_N - 1);
export const RIB_ROWS = 3;

const poly = (c: number[], u: number) => {
  let v = 0;
  for (let k = c.length - 1; k >= 0; k--) v = v * u + c[k];
  return v;
};

/** RGBA float table, RIB_N x RIB_ROWS texels (w unused). */
export function buildRibbon(): Float32Array {
  const n = RIB_N;
  const data = new Float32Array(n * RIB_ROWS * 4);
  const T: number[][] = [];
  const Up: number[][] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.min(U_HI, Math.max(U_LO, RIB_U_MIN + i * RIB_DU));
    const th = poly(YAW, u);
    const ps = poly(CLIMB, u);
    const ph = poly(ROLL, u);
    const t = [Math.cos(ps) * Math.cos(th), Math.sin(ps), Math.cos(ps) * Math.sin(th)];
    const v = [-Math.sin(ps) * Math.cos(th), Math.cos(ps), -Math.sin(ps) * Math.sin(th)];
    // b = t x v
    const b = [t[1] * v[2] - t[2] * v[1], t[2] * v[0] - t[0] * v[2], t[0] * v[1] - t[1] * v[0]];
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    T.push(t);
    Up.push([v[0] * c + b[0] * s, v[1] * c + b[1] * s, v[2] * c + b[2] * s]);
  }
  // Integrate the heading from u = 0 outward (trapezoid rule).
  const C: number[][] = new Array(n);
  const i0 = Math.round(-RIB_U_MIN / RIB_DU);
  C[i0] = [ORIGIN[0], ORIGIN[1], ORIGIN[2]];
  for (let i = i0 + 1; i < n; i++) {
    C[i] = C[i - 1].map((x, k) => x + 0.5 * (T[i][k] + T[i - 1][k]) * RIB_DU);
  }
  for (let i = i0 - 1; i >= 0; i--) {
    C[i] = C[i + 1].map((x, k) => x - 0.5 * (T[i][k] + T[i + 1][k]) * RIB_DU);
  }
  for (let i = 0; i < n; i++) {
    const t = T[i];
    const up = Up[i];
    // Normal toward the viewer: t x up.
    const nr = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
    const rows = [C[i], up, nr];
    rows.forEach((r, row) => data.set([r[0], r[1], r[2], 0], (row * n + i) * 4));
  }
  return data;
}

/** Linear lookup in the table, same as the vertex shader. */
export function sampleRibbon(data: Float32Array, u: number, row: number, out: number[]) {
  const f = Math.min(RIB_N - 1, Math.max(0, (u - RIB_U_MIN) / RIB_DU));
  const i = Math.floor(f);
  const j = Math.min(i + 1, RIB_N - 1);
  const a = f - i;
  const o = row * RIB_N * 4;
  for (let k = 0; k < 3; k++) out[k] = data[o + i * 4 + k] * (1 - a) + data[o + j * 4 + k] * a;
  return out;
}
