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
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
