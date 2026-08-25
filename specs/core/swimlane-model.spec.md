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
interface EventRef     { tid: string; index: number } // SwimThread.id + post-sort index into thread.events
interface EventDependencies { predecessors: EventRef[]; successors: EventRef[] }
interface SwimEvent    {
  id: string; name: string; startTime: number; duration: number; args?: {};
  dependencies?: EventDependencies; // omit when both lists would be empty
}
```

**Folder vs leaf:** non-empty `children` ⇒ folder (lane-style gutter row; `events` ignored / `[]`). Otherwise leaf (may paint events; spacer leaves may use `events: []`). Only `SwimProcess` (Card) uses group-header chrome.

**Bands:** optional shared phase intervals painted on folder/spacer group rows when present. Chrome Trace / `.rep` adapters pass through producer `bands` (`ts`/`dur` in the same unit as X events) and never invent them when absent. Stress fixtures and `sample.rep` supply `ProfilerStep#N` bands.

**Card nesting:** `adaptRep` applies `nestCardTreeFromFlatCorePipes` only when the producer sets `nestCardTree: true` on the trace doc (`sample.rep`). Real traces without the flag stay flat even if thread names look like `CoreN.*/PIPE`.

## Unit contract

**All time values — `minTime`, `maxTime`, `startTime`, `duration`, `SwimlaneViewWindow`, and `SwimlaneViewState` time fields — are in nanoseconds.** Conversion to display units (ms/µs/ns) happens only at the formatting layer (`formatTime`, `formatAxisTime`, `formatCursorTime`). If a new time-carrying field is introduced, it must use nanoseconds unless explicitly documented otherwise. This contract prevents the most common class of time-related bugs: mixing units across layers.

`chromeTraceToSwimlane` handles input conversion: source timestamps in microseconds (`sourceTimeUnit: 'us'`, the CTEF default) are converted to nanoseconds by multiplying by 1000. When the `.rep`-embedded trace provides nanosecond timestamps (`sourceTimeUnit: 'ns'`), no conversion is applied.

## Behavior

**Chrome Trace conversion.** `chromeTraceToSwimlane` groups complete X events (`ph: 'X'`, with `ts` and `dur`) by process ID and thread ID. Each event becomes a `SwimEvent` with `id`, `name`, `startTime`, `duration`. Optional `cat` and `args` are preserved for tooltip enrichment. Events without `tid`/`pid` are assigned to default process/thread 0. Output is **flat** (no `children`) — Q8: do not invent Card/Core nesting from AIV pipe names.

**Async dependencies.** `ph: 's'` / `ph: 'f'` events are not intervals. They pair by process and trace `id`: each id's starts and finishes are ordered by timestamp and zipped (`start.ts <= finish.ts`); leftover unpaired endpoints are dropped. File order does not matter — a finish that appears before its start still pairs. Recycled ids after a flow closes, and the same id used in two processes, each keep their own edge. Unpaired starts, extra finishes, or `start.ts > finish.ts` are dropped. After X events are sorted per thread, each pair finds the **innermost** X event on the start thread whose `[startTime, startTime+duration]` contains `start.ts` (enclosing-parent chain from the last start ≤ ts), and the innermost X event on the finish thread that contains `finish.ts`. Those two events are linked: parent `successors` ← child `{ tid: SwimThread.id, index }`, child `predecessors` ← parent. The two X intervals may overlap (`pred.end > succ.start`) — that is valid; dependency curves still run pred-right → succ-left. Same-event pairs (both endpoints resolve to one slice) are dropped — no self-loop. Duplicate refs are not stored. Events with no edges omit `dependencies`. s/f timestamps use the same ns conversion as X events.

**Ordering.** Processes and threads ordered by first event start time. Within each thread, events sorted by `startTime` ascending, longest `duration` first on ties. Processes/threads with no events are excluded.

**`minTime` as display origin.** `minTime` is the earliest painted event timestamp and the shared UI display origin (PyPTO / Perfetto Timecode default): viewport/zoom-to-fit span `[minTime, maxTime]`, and axis / cursor / tooltip / detail start·end labels subtract `minTime` so the left edge and earliest event read as `0`. Model timestamps stay absolute producer ns; only the formatting layer subtracts. `minTime` also drives thread utilization spans and WebGL `timeBase` (float32 precision).

**Error on empty.** If the trace contains no complete X events, `chromeTraceToSwimlane` throws. This prevents the swimlane from rendering with zero events — an empty model would produce a confusing blank canvas.

**Nested helpers.** Layout / selection walk `children` recursively (`filterCollapsedTree`, `collectLeafEvents`, visible folder/leaf rows).

## Acceptance Criteria

1. **PR-SWIM-001**: Correct process/thread/event structure from a Chrome Trace.
1. **PR-SWIM-002**: Default CTEF µs timestamps convert to ns for internal representation.
1. **PR-SWIM-003**: displayTimeUnit metadata preserved (display-only, timestamps unchanged).
1. **PR-SWIM-004**: CTEF array format and process_name metadata handled correctly.
1. **PR-SWIM-005**: Rejects traces with no complete X events (throws).
1. **PR-SWIM-006**: s/f pairs link EventRefs across threads.
1. **PR-SWIM-007**: Unmatched, inverted, or miss timestamps yield no edge.
1. **PR-SWIM-008**: Index is post-sort; duplicate edges unique; omit empty deps.
1. **PR-SWIM-009**: Nested overlapping X intervals bind the innermost containing event, including equal-`startTime` pairs (Chrome child-first write order).
1. **PR-SWIM-010**: Same-event s/f pairs yield no self-loop edge.
1. **PR-SWIM-011**: Recycled flow ids and the same id in two processes each keep their pairs, including when finishes appear first in the file.
1. **PR-SWIM-012**: A flow in a gap under an enclosing slice binds the enclosing event.
1. **PR-SWIM-013**: Touching X intervals (`end === next.start`) are siblings, not nested.
1. **PR-SWIM-014**: Producer `bands` in the trace doc become `SwimlaneModel.bands`; absent/malformed → omit.
1. **PR-SWIM-015**: Producer `nestCardTree: true` is recorded in `metadata`; absent → no nest flag (adaptRep does not invent Card nesting).

## Edge Cases

- Only B/E events (no X) → throws. Single event → one process/thread/event, minTime = maxTime (handled upstream by bounds clamp).
- s/f with no matching X interval, missing id/ts, or finish before start → ignored. Nested overlapping X (call stack): innermost containing interval, not the enclosing parent — including equal-`startTime` parent/child (Chrome writes the shorter child first). Touching slices that only share an endpoint are siblings (not nested). Flow in idle time between nested slices binds the enclosing slice. Both endpoints in the same X event → no edge. Distinct overlapping X slices (long parent, shorter worker) stay linked; `pred.end` may exceed `succ.start`. Recycled `id` after a flow closes → one edge per s/f pair, not last-wins. Finish written before its start in the file still pairs when `s.ts <= f.ts`.

## Dependencies

[view-models](./view-models.spec.md).

## Open

Q8 — Lane hierarchy; use producer thread_name as-is; nesting only via explicit `children`.

## Changelog
- **2026-08-25** — PR-SWIM-015: `nestCardTree` producer opt-in; adaptRep no longer nests every `.rep`.
- **2026-08-25** — PR-SWIM-014: pass through producer `bands` (sample.rep ProfilerStep labels).
- **2026-08-19** — s/f may overlap (`pred.end > succ.start`); curves still pred-right → succ-left.
- **2026-08-19** — Touching X intervals are siblings (`end <= next.start` pops the stack); PR-SWIM-013.
- **2026-08-18** — Pair s/f by timestamp per process+id so a finish written before its start still links; PR-SWIM-011.
- **2026-08-18** — Equal-`startTime` sort is longest-first so `nestParents` matches Chrome child-first X order.
- **2026-08-18** — Enclosing-parent chain for s/f lookup (gaps do not scan the prefix); PR-SWIM-012.
- **2026-08-18** — FIFO s/f pairing so recycled flow ids keep every edge; PR-SWIM-011.
- **2026-08-18** — Drop same-event s/f self-loops; PR-SWIM-010.
- **2026-08-17** — s/f attach to the innermost containing X event (nested call stacks); PR-SWIM-009.
- **2026-08-13** — Optional `EventDependencies` via `{tid, index}` refs from Chrome Trace s/f pairs.
- **2026-08-11** — Optional `SwimlaneBand[]` on model; adapters omit; stress may supply.
- **2026-08-11** — Optional `SwimThread.children`; folder vs leaf rules; CTEF stays flat.
- **2026-08-05** — Initial spec. Core behaviors established.
