export type ReportFontFamily = 'system' | 'harmony';

export const HARMONYOS_SANS_SC_FAMILY = 'HarmonyOS Sans SC 2025' as const;

export const SYSTEM_UI_FONT_STACK = 'ui-sans-serif, system-ui, sans-serif' as const;

/** CSS font-family when HarmonyOS @font-face rules are loaded. */
export const HARMONYOS_FONT_FAMILY = `'${HARMONYOS_SANS_SC_FAMILY}', ${SYSTEM_UI_FONT_STACK}` as const;

/** Canvas 2D label font with HarmonyOS preferred (faces must be loaded). */
export const HARMONYOS_CANVAS_LABEL_FONT = `10px ${HARMONYOS_FONT_FAMILY}` as const;

/** Canvas 2D label font using system UI only. */
export const SYSTEM_CANVAS_LABEL_FONT = `10px ${SYSTEM_UI_FONT_STACK}` as const;

/** @deprecated Prefer canvasLabelFont(mode); kept as Harmony alias for older call sites. */
export const CANVAS_LABEL_FONT = HARMONYOS_CANVAS_LABEL_FONT;

export function canvasLabelFont(mode: ReportFontFamily = 'system'): string {
  return mode === 'harmony' ? HARMONYOS_CANVAS_LABEL_FONT : SYSTEM_CANVAS_LABEL_FONT;
}
