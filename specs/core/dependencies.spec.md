# Task Dependencies

| spec-id-prefix |
|----------------|
| PR-DEPGRAPH-*      |

Neighbour lookup behind the raised 「详情」 dock's `Relevent` column: walk the selected event's dependency refs, filtered by direction and hop depth.

```ts
hasDependencies(model: SwimlaneModel | null | undefined): boolean
neighborsOf(
  model: SwimlaneModel | null | undefined,
  event: SwimEvent,
  mode: DependencyMode,
  depth: number,
): DependencyNeighbors
```

## Behavior

**Encoding.** `SwimEvent.dependencies` holds `{ predecessors, successors }` as `EventRef`s (thread id + index) — the model the swimlane link renderer already walks. `neighborsOf` follows those refs from the selected event outward, so the dock and the timeline curves read one source of truth and no id graph is built. Only lanes are indexed (tid → thread), never events. Producers ship ids through the Chrome Trace `args` convention — `args.event_id` makes an event addressable and `args.dependencies` names its successors; the adapter resolves those ids to refs once every lane is sorted.

**Dangling refs.** A ref into a lane or index the model does not carry is skipped: a chip with no timing is worse than an omission. So are self-references and a second ref to an event already collected.

**Direction.** `mode` is master's `DependencyMode`, shared with the swimlane curves: `all` walks both sides, `predecessors` blanks Outgoing, `successors` blanks Incoming. The suppressed side comes back as an empty array rather than being dropped, so [DetailRelevant](../../src/ui/DetailPanel/DetailRelevant/DetailRelevant.spec.md) keeps its column grid.

**Depth.** `depth` counts hops and is run through `normalizeDependencyDepth`, the same clamp the curves use: negative walks the whole chain, `0` returns nothing, `N` stops after N hops, and anything above `MAX_DEPENDENCY_DEPTH` clamps. Traversal is breadth-first and never revisits the start event, so a cycle terminates instead of looping. Each side is capped at **200** neighbours: the default level is unlimited, so a chained model would otherwise hand the panel its whole transitive closure — one chip and one connector curve each, which is the cost that matters (20k neighbours ≈ 1.8 s to mount). Neighbours are sorted before the cut, so a truncated side still holds the earliest ones.

**Ordering.** Neighbours come back sorted by `startTime`, ties broken by id, so the Incoming and Outgoing columns read chronologically.

**Absence.** A model with no dependency data yields two empty sides. `hasDependencies` is the single gate: both adapter paths run it to publish the `dependencies` capability, and the report runs it before walking at all. It is also what decides whether the UI mounts any dependency surface (VIEW_DATA_REQUIREMENTS hide-when-missing policy), so the capability and the rendered column always agree. Callers do not additionally gate on the walk returning anything: a model whose refs all dangle passes the gate and renders the column empty, the same as any event that simply has no neighbours.

## Acceptance Criteria

1. **PR-DEPGRAPH-001**: `neighborsOf` walks successor refs and the mirrored predecessor refs.
1. **PR-DEPGRAPH-002**: Dangling, self and duplicate refs yield no neighbour.
1. **PR-DEPGRAPH-003**: `mode` blanks the suppressed side.
1. **PR-DEPGRAPH-004**: `depth` limits hops; negative walks the whole chain and `0` returns nothing.
1. **PR-DEPGRAPH-005**: A cyclic chain terminates and never returns the start event.
1. **PR-DEPGRAPH-006**: `hasDependencies` is false for a model without dependency data and true once one event carries successors.
1. **PR-DEPGRAPH-007**: `chromeTraceToSwimlane` adopts `args.event_id` as the event id and `args.dependencies` as successors.
1. **PR-DEPGRAPH-008**: A repeated `args.event_id` keeps the first event and falls the rest back to sequence ids.
1. **PR-DEPGRAPH-009**: Each side of a walk is capped at 200 neighbours, earliest first.

## Edge Cases

`null` / `undefined` model → both sides empty. Events without `args.event_id` keep the adapter's `e-<seq>` id and cannot be referenced by dependency ids. Producer ids are not trusted to be unique: the first event to claim one keeps it and any later claimant — or a producer squatting an `e-<seq>` id — falls back to the next free sequence id, so ids stay unique across the model and a duplicate cannot silently swallow another event's chip, hit-test box, or selection. A walk wider than 200 neighbours on one side is truncated to the 200 earliest, and the count badge reports what is shown, not what exists. Nested child lanes are traversed; folder rows hold no events of their own.

## Dependencies

[swimlane-model](swimlane-model.spec.md) for `EventRef` and the traversal shape; `DependencyMode` / `normalizeDependencyDepth` from `domain/types`, shared with the swimlane [dependency curves](swimlane-renderer.spec.md). Interim [DATA-36a](../../docs/context/INTERIM_DECISIONS.md) — the Chrome Trace `args` id convention while DATA-36 is open.

## Open

DATA-36 — the producer's real dependency encoding. When it lands, only the adapter changes; the graph and UI contracts stay.

## Changelog
- **2026-08-20** — Dropped the id graph: `neighborsOf` walks `SwimEvent.dependencies` refs from the selected event, taking master's `DependencyMode` and normalized hop depth, so the dock and the swimlane curves share one traversal contract. `buildDependencyGraph`, `DependencyGraph` and `DependencyDirection` are gone; PR-DEPGRAPH-003 returns for the mode filter.
- **2026-08-18** — PR-DEPGRAPH-009: 200-neighbour cap per side, so the default unlimited level cannot hand the panel a whole transitive closure. `hasDependencies` is now the only gate callers run — the report no longer additionally checks the built maps, which let a dangling-only model publish the capability while hiding the column.
- **2026-08-18** — PR-DEPGRAPH-008: producer `event_id` collisions fall back to sequence ids. `adaptRep` runs the `hasDependencies` gate too, so the capability matches what the UI renders.
- **2026-08-14** — Dropped the `direction` parameter from `neighborsOf` (and PR-DEPGRAPH-003 with it): DetailRelevant now owns the direction state and blanks the suppressed column, so the graph layer no longer needs to know. Removed `DependencyNode.duration` and `DependencyGraph.edgeCount`, both unread; PR-DEPGRAPH-002 now states the dangling/self/duplicate contract against `outgoing` / `incoming` directly. `adaptRep` no longer runs the `hasDependencies` gate. Remaining AC ids keep their numbers, gap included.
- **2026-08-13** — Initial spec: interim successor encoding, reverse index, direction + depth filters.
