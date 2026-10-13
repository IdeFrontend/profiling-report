import type { SourceCorrelationModel } from '../../domain/types';

/**
 * Known embed basenames for a future real Source ↔ instruction pack.
 * None are present in current `.rep` / npu-rep fixtures — returning null
 * triggers the mock fallback at the adaptRep / adaptEmulate boundary.
 */
export const SOURCE_CORRELATION_EMBED_NAMES = [
  'SourceCorrelation.json',
  'source_correlation.json',
  'SourceMap.json',
] as const;

function payloadByName(
  payloads: Record<string, Uint8Array>,
  names: readonly string[],
): Uint8Array | undefined {
  for (const name of names) {
    if (payloads[name]) return payloads[name];
  }
  const lower = Object.fromEntries(
    Object.entries(payloads).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const name of names) {
    const hit = lower[name.toLowerCase()];
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Parse real Source correlation embeds when present.
 * Returns `null` when no recognized embed exists (caller uses mock).
 *
 * Real schema is Product-TBD; this switch point stays until embeds ship.
 */
export function adaptSourceCorrelation(
  payloads: Record<string, Uint8Array>,
): SourceCorrelationModel | null {
  const raw = payloadByName(payloads, SOURCE_CORRELATION_EMBED_NAMES);
  if (!raw || raw.byteLength === 0) return null;

  // Future: decode JSON → SourceCorrelationModel and set mock: false.
  // Until Product publishes the embed schema, treat unknown payloads as absent
  // so we never invent a half-parsed model.
  void raw;
  return null;
}
