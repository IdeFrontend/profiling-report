export const HARMONYOS_SANS_SC_FAMILY = 'HarmonyOS Sans SC 2025' as const;

export const SYSTEM_UI_FONT_STACK = 'ui-sans-serif, system-ui, sans-serif' as const;

/** CSS font-family when HarmonyOS @font-face rules are loaded. */
export const HARMONYOS_FONT_FAMILY = `'${HARMONYOS_SANS_SC_FAMILY}', ${SYSTEM_UI_FONT_STACK}` as const;

/** Canvas 2D label font (size + family stack). */
export const CANVAS_LABEL_FONT = `10px ${HARMONYOS_FONT_FAMILY}` as const;
