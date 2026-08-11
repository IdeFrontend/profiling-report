# Swimlane Model

| spec-id-prefix |
|----------------|
| PR-SWIM-*      |

Canonical types and Chrome Trace conversion logic for timeline data driving the swimlane renderer.

```ts
interface SwimlaneModel {
  processes: SwimProcess[];
  minTime: number;
  maxTime: number;
  bands?: SwimlaneBand[]; // optional ProfilerStep-style phase bands; omit when absent
}
interface SwimlaneBand { id: string; name: string; startTime: number; duration: number }
interface SwimProcess  { id: string; name: string; utilization?: number; threads: SwimThread[]; }
interface SwimThread   {
  id: string;
  name: string;
  events: SwimEvent[];
  utilization?: number;
  children?: SwimThread[]; // folder when non-empty; leaf when absent/empty
}
interface SwimEvent    { id: string; name: string; startTime: number; duration: number; args?: {} }
```

**Folder vs leaf:** non-empty `children` ⇒ folder (lane-style gutter row; `events` ignored / `[]`). Otherwise leaf (may paint events; spacer leaves may use `events: []`). Only `SwimProcess` (Card) uses group-header chrome.

**Bands:** optional shared phase intervals painted on folder/spacer group rows when present. Chrome Trace / `.rep` adapters leave `bands` undefined (never invent). Stress fixtures may supply `ProfilerStep#N` bands.

## Unit contract

**All time values — `minTime`, `maxTime`, `startTime`, `duration`, `SwimlaneViewWindow`, and `SwimlaneViewState` time fields — are in nanoseconds.** Conversion to display units (ms/µs/ns) happens only at the formatting layer (`formatTime`, `formatAxisTime`, `formatCursorTime`). If a new time-carrying field is introduced, it must use nanoseconds unless explicitly documented otherwise. This contract prevents the most common class of time-related bugs: mixing units across layers.

`chromeTraceToSwimlane` handles input conversion: source timestamps in microseconds (`sourceTimeUnit: 'us'`, the CTEF default) are converted to nanoseconds by multiplying by 1000. When the `.rep`-embedded trace provides nanosecond timestamps (`sourceTimeUnit: 'ns'`), no conversion is applied.

## Behavior

**Chrome Trace conversion.** `chromeTraceToSwimlane` groups complete X events (`ph: 'X'`, with `ts` and `dur`) by process ID and thread ID. Each event becomes a `SwimEvent` with `id`, `name`, `startTime`, `duration`. Optional `cat` and `args` are preserved for tooltip enrichment. Events without `tid`/`pid` are assigned to default process/thread 0. Output is **flat** (no `children`) — Q8: do not invent Card/Core nesting from AIV pipe names.

**Ordering.** Processes and threads ordered by first event start time. Within each thread, events sorted by `startTime` ascending. Processes/threads with no events are excluded.

**Error on empty.** If the trace contains no complete X events, `chromeTraceToSwimlane` throws. This prevents the swimlane from rendering with zero events — an empty model would produce a confusing blank canvas.

**Nested helpers.** Layout / selection walk `children` recursively (`filterCollapsedTree`, `collectLeafEvents`, visible folder/leaf rows).

## Acceptance Criteria

1. **PR-SWIM-001**: Correct process/thread/event structure from a Chrome Trace.
1. **PR-SWIM-002**: Default CTEF µs timestamps convert to ns for internal representation.
1. **PR-SWIM-003**: displayTimeUnit metadata preserved (display-only, timestamps unchanged).
1. **PR-SWIM-004**: CTEF array format and process_name metadata handled correctly.
1. **PR-SWIM-005**: Rejects traces with no complete X events (throws).

## Edge Cases

- Only B/E events (no X) → throws. Single event → one process/thread/event, minTime = maxTime (handled upstream by bounds clamp).

## Dependencies

[view-models](./view-models.spec.md).

## Open

Q8 — Lane hierarchy; use producer thread_name as-is; nesting only via explicit `children`.

## Changelog
- **2026-08-11** — Optional `SwimlaneBand[]` on model; adapters omit; stress may supply.
- **2026-08-11** — Optional `SwimThread.children`; folder vs leaf rules; CTEF stays flat.
- **2026-08-05** — Initial spec. Core behaviors established.
