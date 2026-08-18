# DetailParameter

| spec-id-prefix |
|----------------|
| PR-DPARAM-*    |

Middle column of the detail dock: the selected event's producer parameters as a label/value list, with source paths rendered as the sketch's underlined links.

## Inputs

**args** — the raw `SelectedEvent.args` record (keys shown verbatim, no renaming). Optional **locale**.

## Outputs

Purely presentational — no emitted events.

## Behavior

Every key of `args` becomes a row. Array values stack under one label (the sketch's `Code` row holds many paths); objects are JSON-stringified; empty values drop out. A row whose values all contain `/` and no spaces is treated as a path row and gets link styling plus a `title` with the full string, since the column truncates with an ellipsis. Long lists scroll inside the column.

With no parameters at all the column shows an empty note rather than disappearing, so the three-column rhythm of the dock survives.

Keys are not translated: they are producer field names (`Code`, `Pc_addr`, `Process_bytes` in the sketch) and renaming them would break the link back to the trace.

`event_id` and `dependencies` are dropped: under [I-Q9](../../../../docs/context/INTERIM_DECISIONS.md) they are the dependency transport, already shown as the Relevent graph, and the sketch's parameter list holds only producer fields.

## Acceptance Criteria

1. **PR-DPARAM-001** — Renders one row per `args` entry with the producer key verbatim.
1. **PR-DPARAM-002** — Shows the empty note when `args` is missing or holds no usable values.
1. **PR-DPARAM-003** — Path-like values render as links; an array value stacks its entries under a single key.
1. **PR-DPARAM-004** — Drops the I-Q9 transport keys `event_id` and `dependencies` from the list.

## Visual

Normative crop: [`visual/parameter-list.png`](./visual/parameter-list.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Changelog
- **2026-08-13** — Data-driven rows from `SelectedEvent.args`; path rows and empty note; I-Q9 transport keys hidden.
- **2026-08-10** — Stub + visual pack from `v930/detail-strip-raised`.
