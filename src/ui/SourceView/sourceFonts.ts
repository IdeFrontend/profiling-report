/**
 * Source tab typography — match Sudu standalone-sample + v930 sketch.
 *
 * Sudu defaults to family `"Consolas"` at 16 CSS px / weight 300. The sketch is
 * denser (~12px) and uses the browser's generic `monospace` family with no
 * fallback stack. `editorFont` carries family, size, and weight into the theme.
 */

export const SOURCE_TAB_MONO_FAMILY = 'monospace';
export const SOURCE_TAB_EDITOR_FONT = {
  family: SOURCE_TAB_MONO_FAMILY,
  /** Sketch density (Sudu default is 16). */
  size: 12,
  /** Sudu’s light desk is 300; 400 reads closer to the sketch. */
  weight: 400,
} as const;

/** CSS family for metrics / chrome that must match the canvas face. */
export const SOURCE_TAB_MONO_STACK = 'monospace';
