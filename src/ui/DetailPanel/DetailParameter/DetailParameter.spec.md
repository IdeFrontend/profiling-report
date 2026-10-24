# DetailParameter

| spec-id-prefix |
|----------------|
| PR-DPARAM-*    |

Middle column of the detail dock: the selected event's producer parameters as a label/value list, with source paths rendered as the sketch's underlined links.

## Inputs

**args** — the raw `SelectedEvent.args` record (keys shown verbatim, no renaming). Optional **sourceFiles** (bundled Source tab files; omitted when 源码 is unavailable) and **locale**.

## Outputs

**open-source** — a Parameter value whose path matches a bundled source file. The payload is the raw frame (string or object).

## Behavior

Every key of `args` becomes a row. Array values stack under one label (the sketch's `Code` row holds many paths). Objects are JSON-stringified. A frame that matches a bundled source file is the exception: the visible text is `path` or `path:line`, and `title` keeps the JSON. Empty values drop out. A row whose values all contain `/` and no spaces is treated as a path row and gets link styling plus a `title` with the full string, since the column truncates with an ellipsis. Long lists scroll inside the column.

A value that `resolveSourceFrame` matches against **sourceFiles** is a button. A bare path opens at line 1; `path:line` keeps that line. `"None:None"` and a path whose basename is not bundled stay non-clickable spans, including the underlined path styling when the row is path-like. With no **sourceFiles**, nothing is clickable.

With no parameters at all the column shows an empty note rather than disappearing, so the three-column rhythm of the dock survives.

Keys are not translated: they are producer field names (`Code`, `Pc_addr`, `Process_bytes` in the sketch) and renaming them would break the link back to the trace.

`event_id` and `dependencies` are dropped: under [DATA-36a](../../../../docs/context/decisions/interim/DATA.md) they are the dependency transport, already shown as the Relevent graph, and the sketch's parameter list holds only producer fields. `cat` goes with them: the Chrome Trace adapter copies the event category into `args`, and DetailSummary already reads it for the type pill — it is not a producer parameter.

## Acceptance Criteria

1. **PR-DPARAM-001** — Renders one row per `args` entry with the producer key verbatim.
1. **PR-DPARAM-002** — Shows the empty note when `args` is missing or holds no usable values.
1. **PR-DPARAM-003** — Path-like values render as links; an array value stacks its entries under a single key.
1. **PR-DPARAM-004** — Drops the DATA-36a transport keys `event_id` and `dependencies` plus the adapter-injected `cat` from the list.
1. **PR-DPARAM-005** — A frame whose basename is in `sourceFiles` is a button and emits `open-source`, including a bare path. The button text is `path` or `path:line`; an object frame's `title` stays the JSON. An object that does not match stays JSON, including its other fields. `"None:None"` and an unknown path do not.

## Visual

Normative crop: [`visual/parameter-list.png`](./visual/parameter-list.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Changelog
- **2026-10-23** — An unmatched object parameter stays JSON. A Source link's visible text is `path` or `path:line`, and its `title` keeps the JSON (`PR-DPARAM-005`).
- **2026-10-23** — Matching Parameter frames are Source-tab buttons (`PR-DPARAM-005`). A bare path still matches; `"None:None"` and unknown paths stay text.
- **2026-08-19** — `cat` hidden too: the Chrome Trace adapter injects it into `args` and the type pill already shows it.
- **2026-08-13** — Data-driven rows from `SelectedEvent.args`; path rows and empty note; DATA-36a transport keys hidden.
- **2026-08-10** — Stub + visual pack from `v930/detail-strip-raised`.
