import type { SourceCorrelationModel } from '../../domain/types';
import {
  adaptComputeSourceCorrelation,
  hasComputeSourcePack,
} from './adaptComputeSourceCorrelation';

/**
 * Known embed basenames for a future single-file Source ↔ instruction pack.
 * Compute packs instead use `objdump.txt` + `symbolizer.json` + `summary.db`
 * (see `adaptComputeSourceCorrelation`).
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
 * Paths:
 * 1. Compute multi-file pack (`objdump.txt` + symbolizer / summary.db) → real model
 * 2. Single-file `SourceCorrelation.json` — schema still Product-TBD → null
 */
export function adaptSourceCorrelation(
  payloads: Record<string, Uint8Array>,
): SourceCorrelationModel | null {
  if (hasComputeSourcePack(payloads)) {
    return adaptComputeSourceCorrelation(payloads);
  }

  const raw = payloadByName(payloads, SOURCE_CORRELATION_EMBED_NAMES);
  if (!raw || raw.byteLength === 0) return null;

  // Future: decode JSON → SourceCorrelationModel and set mock: false.
  void raw;
  return null;
}
