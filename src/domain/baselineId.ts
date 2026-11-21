/**
 * Unique baseline id. `crypto.randomUUID` exists only in secure contexts
 * (HTTPS / file:// / localhost); a plain-HTTP LAN host of the exported HTML
 * falls back to a timestamp + random suffix.
 *
 * Lives in its own module (not `types.ts`): vite-plugin-dts flattens functions
 * from the `export type *` barrel source into `dist/index.d.ts`, advertising a
 * named export the runtime bundle never ships.
 */
export function newBaselineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // `Math.random()` can return exactly 0 — its base-36 form is '0', not ''.
  // Keep at least one digit so the shape always matches the title module's
  // FALLBACK_ID_RE (an unmatched generated id would surface as a title).
  const rand = Math.random().toString(36).slice(2, 10) || '0';
  return `b-${Date.now().toString(36)}-${rand}`;
}
