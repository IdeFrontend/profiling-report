# Task Dependencies

| spec-id-prefix |
|----------------|
| PR-DEPS-*      |

Build the task dependency graph behind the raised 「详情」 dock's `Relevent` column and the timeline dependency curves: successor lists from the adapter, predecessors from a reverse index, neighbour lookup with a depth limit.

```ts
buildDependencyGraph(model: SwimlaneModel | null | undefined): DependencyGraph
hasDependencies(model: SwimlaneModel | null | undefined): boolean
neighborsOf(graph: DependencyGraph, eventId: string, level?: number): DependencyNeighbors
```

## Behavior

**Encoding (interim I-Q9).** `SwimEvent.dependencies` holds **successor** ids. `buildDependencyGraph` walks every process, thread, and nested child lane, indexes all events by id, then reads the successor lists into `outgoing` and mirrors them into `incoming`. Producers ship the ids through the Chrome Trace `args` convention — `args.event_id` makes an event addressable and `args.dependencies` names its successors.

**Dangling and duplicate edges.** An id that no event in the model carries is dropped: a chip with no timing is worse than an omission. Self-edges and repeated ids collapse to nothing. A surviving edge writes one entry into `outgoing[source]` and one into `incoming[target]`; a rejected one writes neither, so an event whose successors are all rejected holds no `outgoing` key at all.

**Direction filter.** `neighborsOf` returns both sides. The sketch's three toolbar icons live in [DetailRelevant](../../src/ui/DetailPanel/DetailRelevant/DetailRelevant.spec.md), which owns the direction state and blanks the suppressed column. `DependencyDirection` stays exported from this module as the shared vocabulary.

**Depth.** `level` counts hops. `level < 0` (the sketch default `-1`) walks the whole chain, `level === 0` returns nothing, `level === N` stops after N hops. Traversal is breadth-first and never revisits the start event, so a cycle terminates instead of looping. Each side is capped at **200** neighbours: the default level is unlimited, so a chained model would otherwise hand the panel its whole transitive closure — one chip and one connector curve each, which is the cost that matters (20k neighbours ≈ 1.8 s to mount). Neighbours are sorted before the cut, so a truncated side still holds the earliest ones.

**Ordering.** Neighbours come back sorted by `startTime`, ties broken by id, so the Incoming and Outgoing columns read chronologically.

**Absence.** A model with no dependency data yields empty `outgoing` and `incoming` maps. `hasDependencies` is the single gate: both adapter paths run it to publish the `dependencies` capability, and the report runs it before building the graph at all — the scan is ~1% of the build cost and almost every model has no edges. It is also what decides whether the UI mounts any dependency surface (VIEW_DATA_REQUIREMENTS hide-when-missing policy), so the capability and the rendered column always agree. Callers do not additionally gate on the built maps being non-empty: a model whose ids all dangle passes the gate and renders the column empty, the same as any event that simply has no neighbours.

## Acceptance Criteria

1. **PR-DEPS-001**: `buildDependencyGraph` indexes successors from `SwimEvent.dependencies` and mirrors them into a predecessor index.
1. **PR-DEPS-002**: Edges to ids absent from the model, self-edges, and duplicates leave no entry in `outgoing` or `incoming`.
1. **PR-DEPS-004**: `level` limits hop depth; negative walks the whole chain and `0` returns nothing.
1. **PR-DEPS-005**: A cyclic chain terminates and never returns the start event.
1. **PR-DEPS-006**: `hasDependencies` is false for a model without dependency data and true once one event carries successors.
1. **PR-DEPS-007**: `chromeTraceToSwimlane` adopts `args.event_id` as the event id and `args.dependencies` as successors.
1. **PR-DEPS-008**: A repeated `args.event_id` keeps the first event and falls the rest back to sequence ids.
1. **PR-DEPS-009**: Each side of a walk is capped at 200 neighbours, earliest first.

## Edge Cases

`null` / `undefined` model → empty graph. Events without `args.event_id` keep the adapter's `e-<seq>` id and cannot be referenced by dependency ids. Producer ids are not trusted to be unique: the first event to claim one keeps it and any later claimant — or a producer squatting an `e-<seq>` id — falls back to the next free sequence id, so ids stay unique across the model and a duplicate cannot silently swallow another event's node, hit-test box, or selection. A walk wider than 200 neighbours on one side is truncated to the 200 earliest, and the count badge reports what is shown, not what exists. Nested child lanes are traversed; folder rows hold no events of their own.

## Dependencies

Interim [I-Q9](../../docs/context/INTERIM_DECISIONS.md) — successor-list encoding while Q9 is open. [swimlane-model](swimlane-model.spec.md) for the traversal shape.

## Open

Q9 — the producer's real dependency encoding. When it lands, only the adapter changes; the graph and UI contracts stay.

## Changelog
- **2026-08-18** — PR-DEPS-009: 200-neighbour cap per side, so the default unlimited level cannot hand the panel a whole transitive closure. `hasDependencies` is now the only gate callers run — the report no longer additionally checks the built maps, which let a dangling-only model publish the capability while hiding the column.
- **2026-08-18** — PR-DEPS-008: producer `event_id` collisions fall back to sequence ids. `adaptRep` runs the `hasDependencies` gate too, so the capability matches what the UI renders.
- **2026-08-14** — Dropped the `direction` parameter from `neighborsOf` (and PR-DEPS-003 with it): DetailRelevant now owns the direction state and blanks the suppressed column, so the graph layer no longer needs to know. Removed `DependencyNode.duration` and `DependencyGraph.edgeCount`, both unread; PR-DEPS-002 now states the dangling/self/duplicate contract against `outgoing` / `incoming` directly. `adaptRep` no longer runs the `hasDependencies` gate. Remaining AC ids keep their numbers, gap included.
- **2026-08-13** — Initial spec: interim successor encoding, reverse index, direction + depth filters.
