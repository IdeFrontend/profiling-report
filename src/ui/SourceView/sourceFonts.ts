/**
 * Source tab typography — match Sudu standalone-sample + v930 sketch.
 *
 * Sudu defaults to family `"Consolas"` at 16 CSS px / weight 300. The sketch is
 * denser (~12px) and uses JetBrains Mono. We:
 *  1. Host JetBrains Mono under its real family name (never alias as Consolas —
 *     Safari’s canvas TextMetrics disagree with a Consolas webfont override)
 *  2. Cover weights Sudu measures (300 / 400 / 600) + italic
 *  3. `document.fonts.load` so metrics settle before the first Sudu mount
 *  4. Pass `editorFont` via Sudu theme so size/weight match the sketch
 */

import { ensureSuduFonts } from './suduRuntime';

export const SOURCE_TAB_CODICON_URL = '/sudu/codicon.ttf';
export const SOURCE_TAB_MONO_FAMILY = 'JetBrains Mono';
export const SOURCE_TAB_EDITOR_FONT = {
  family: SOURCE_TAB_MONO_FAMILY,
  /** Sketch density (Sudu default is 16). */
  size: 12,
  /** Sudu’s light desk is 300; 400 reads closer to the sketch. */
  weight: 400,
} as const;

/** CSS stack for metrics / chrome that must match the canvas face. */
export const SOURCE_TAB_MONO_STACK = `'${SOURCE_TAB_MONO_FAMILY}', ui-monospace, monospace`;

const MONO_BASE = '/sudu/fonts';

let ready: Promise<void> | null = null;

async function loadMonoFaces(): Promise<void> {
  if (typeof document === 'undefined') return;
  const specs = [
    { file: 'jetbrains-mono-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { file: 'jetbrains-mono-latin-300-italic.woff2', weight: '300', style: 'italic' },
    { file: 'jetbrains-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { file: 'jetbrains-mono-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { file: 'jetbrains-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { file: 'jetbrains-mono-latin-600-italic.woff2', weight: '600', style: 'italic' },
  ] as const;

  await Promise.all(
    specs.map(async (s) => {
      const face = new FontFace(
        SOURCE_TAB_MONO_FAMILY,
        `url(${MONO_BASE}/${s.file}) format('woff2')`,
        { weight: s.weight, style: s.style },
      );
      await face.load();
      document.fonts.add(face);
    }),
  );

  // Force layout engines (esp. Safari) to resolve the face before Sudu measures glyphs.
  await Promise.all(
    specs.map((s) =>
      document.fonts.load(`${s.weight} ${SOURCE_TAB_EDITOR_FONT.size}px "${SOURCE_TAB_MONO_FAMILY}"`),
    ),
  );
}

/** Process-lifetime: mono faces + codicon before first Sudu editor mount. */
export function ensureSourceTabFonts(codiconUrl = SOURCE_TAB_CODICON_URL): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  return (ready ??= (async () => {
    try {
      await loadMonoFaces();
    } catch (e) {
      // Soft-fail: Sudu still mounts; canvas falls back to ui-monospace / system.
      console.warn(
        '[SourceView] JetBrains Mono failed to load; using system monospace',
        e instanceof Error ? e.message : e,
      );
    }
    try {
      await ensureSuduFonts(codiconUrl);
    } catch (e) {
      console.warn(
        '[SourceView] Sudu codicon failed to load; line-number icons may misalign',
        e instanceof Error ? e.message : e,
      );
    }
    await document.fonts.ready;
  })());
}

export function resetSourceTabFontsForTests(): void {
  ready = null;
}
