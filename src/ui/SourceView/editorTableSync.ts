/**
 * Geometry helpers for Sudu editor ↔ DOM metrics table alignment.
 * Ported from sudu-editor standalone-sample/editorAndTable.js (device-px APIs).
 */

export interface EditorGeometry {
  dpr: number;
  lineHeight: number;
  editorHeight: number;
  maxVScrollPos: number;
  numLines: number;
  fontSize: number;
  fontFamily: string | null;
}

export function cssRowHeight(geom: Pick<EditorGeometry, 'lineHeight' | 'dpr'>): number {
  if (!(geom.dpr > 0) || !(geom.lineHeight > 0)) return 0;
  return geom.lineHeight / geom.dpr;
}

/** Trailing filler rows so the table can scroll as far as the editor. */
export function trailingRowCount(geom: EditorGeometry): number {
  if (geom.maxVScrollPos <= 0 || !(geom.lineHeight > 0)) return 0;
  const totalRows = Math.round((geom.maxVScrollPos + geom.editorHeight) / geom.lineHeight);
  return Math.max(0, totalRows - geom.numLines);
}

export function deviceScrollFromCss(scrollTopCss: number, dpr: number): number {
  return Math.round(scrollTopCss * dpr);
}

export function cssScrollFromDevice(vScrollPosDevice: number, dpr: number): number {
  if (!(dpr > 0)) return 0;
  return vScrollPosDevice / dpr;
}

export function isUsableGeometry(geom: EditorGeometry): boolean {
  return geom.dpr > 0 && geom.lineHeight > 0 && geom.editorHeight > 0;
}
