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
  // Pad both fields to FIXED widths: the title module's FALLBACK_ID_RE anchors
  // on them, so a human name (`b-matmul-7x7`, `b-run-1`) cannot be mistaken
  // for a generated id. `Math.random()` can return exactly 0 — its base-36
  // form is '' — and padEnd still produces a full-width suffix.
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `b-${Date.now().toString(36).padStart(8, '0')}-${rand}`;
}
