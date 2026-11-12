/**
 * Multi-timeline catalog (§11.14 多流水显示): discover Communication / PipeTrace /
 * SimtWarp CTEF embeds and build one SwimlaneModel per present file.
 */

import type {
  PipeOccupancyItem,
  SwimlaneModel,
  TimelineTraceKind,
  TimelineTraceOption,
} from '../domain/types';
import { nestCardTreeFromFlatCorePipes } from '../domain/swimTree';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { withPipeLaneUtilizations } from './withPipeLaneUtilizations';

/** Catalog order = menu order. Default preference is pipeTrace when present. */
export const TIMELINE_TRACE_CATALOG: ReadonlyArray<{
  id: TimelineTraceKind;
  names: readonly string[];
}> = [
  { id: 'communication', names: ['Communication.json', 'communication.json'] },
  {
    id: 'warpOccupy',
    names: ['SimtWarpOccpy.json', 'SimtWarpOccupy.json', 'simt_warp_occupancy.json'],
  },
  { id: 'pipeTrace', names: ['PipeTrace.json', 'pipetrace.json'] },
];

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Case-insensitive payload lookup (same rules as adaptRep `payloadByName`). */
function payloadEntry(
  payloads: Record<string, Uint8Array>,
  names: readonly string[],
): { name: string; bytes: Uint8Array } | undefined {
  for (const name of names) {
    const exact = payloads[name];
    if (exact) return { name, bytes: exact };
  }
  const lower = new Map(
    Object.entries(payloads).map(([k, v]) => [k.toLowerCase(), k] as const),
  );
  for (const name of names) {
    const key = lower.get(name.toLowerCase());
    if (key) return { name: key, bytes: payloads[key] };
  }
  return undefined;
}

/** Present catalog rows in menu order (omit unmatched kinds such as `stat`). */
export function discoverTimelineTraces(
  payloads: Record<string, Uint8Array>,
): TimelineTraceOption[] {
  const out: TimelineTraceOption[] = [];
  for (const row of TIMELINE_TRACE_CATALOG) {
    const hit = payloadEntry(payloads, row.names);
    if (!hit) continue;
    out.push({ id: row.id, embedName: hit.name });
  }
  return out;
}

/** Prefer pipeTrace when present; else first catalog hit. */
export function defaultTimelineTraceId(
  traces: readonly TimelineTraceOption[],
): TimelineTraceKind | undefined {
  if (traces.length === 0) return undefined;
  const pipe = traces.find((t) => t.id === 'pipeTrace');
  return pipe?.id ?? traces[0]!.id;
}

function swimlaneFromUsTrace(
  bytes: Uint8Array,
  embedName: string,
  pipes: PipeOccupancyItem[],
): SwimlaneModel {
  let trace: unknown;
  try {
    trace = JSON.parse(decodeUtf8(bytes)) as unknown;
  } catch (cause) {
    throw new Error(`[profiling-report] adapt: ${embedName} is not valid JSON`, { cause });
  }
  const model = chromeTraceToSwimlane(trace, { sourceTimeUnit: 'us' });
  const withUtil = withPipeLaneUtilizations(model, pipes);
  return model.metadata?.nestCardTree === true
    ? nestCardTreeFromFlatCorePipes(withUtil)
    : withUtil;
}

export interface TimelineTraceBundle {
  timelineTraces: TimelineTraceOption[];
  selectedTimelineTraceId: TimelineTraceKind;
  timelineTraceModels: Record<string, SwimlaneModel>;
  swimlaneModel: SwimlaneModel;
}

/**
 * Build one swimlane per present catalog embed. Returns null when the catalog
 * is empty (caller falls back to classic `trace.json` / emulate native merge).
 */
export function buildTimelineTraceBundle(
  payloads: Record<string, Uint8Array>,
  pipes: PipeOccupancyItem[],
): TimelineTraceBundle | null {
  const timelineTraces = discoverTimelineTraces(payloads);
  if (timelineTraces.length === 0) return null;

  const timelineTraceModels: Record<string, SwimlaneModel> = {};
  for (const opt of timelineTraces) {
    const hit = payloadEntry(
      payloads,
      TIMELINE_TRACE_CATALOG.find((c) => c.id === opt.id)!.names,
    );
    if (!hit) continue;
    timelineTraceModels[opt.id] = swimlaneFromUsTrace(hit.bytes, hit.name, pipes);
  }

  const selectedTimelineTraceId = defaultTimelineTraceId(timelineTraces)!;
  const swimlaneModel = timelineTraceModels[selectedTimelineTraceId];
  if (!swimlaneModel) return null;

  return {
    timelineTraces,
    selectedTimelineTraceId,
    timelineTraceModels,
    swimlaneModel,
  };
}
