/**
 * Where an opened project sits on screen, in CSS pixels. The carousel grows the
 * clicked card into this rect and the project panel draws its sheet over it.
 */
export interface SheetRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

export function sheetRect(vw: number, vh: number): SheetRect {
  const side = Math.max(16, Math.round(vw * 0.04));
  const top = vw < 768 ? 12 : 64;
  const bottom = vw < 768 ? 12 : 64;
  return { x: side, y: top, w: vw - side * 2, h: vh - top - bottom, radius: vw < 768 ? 16 : 22 };
}
