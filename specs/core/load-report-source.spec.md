# Load Report Source

| spec-id-prefix |
|----------------|
| PR-JSON-*      |

Detect and load profiling reports from product **`.npu-rep`** (and classic engineering `cann-rep` / sample `.rep` fixtures) or standalone Chrome Trace Event Format (CTEF) JSON.

```ts
loadReportSource(source: ArrayBuffer | Uint8Array): ReportSource
```

## Behavior

Inspects the head magic (first 8 bytes):

1. **`npu-rep`** — product container ([PROC-2](../../docs/context/decisions/PROC.md)). Routes by `fileInfoLength` to the 160-byte product layout or the interim 164-byte sample layout ([npu-rep.spec](./npu-rep.spec.md)), then adapts nested or flat operators → full `AdaptedReport`. A nested pack's operator **label** is the short display name of its first operator row, falling back to the archive stem. When two or more packs resolve to the same label, each colliding label gains a ` (stem)` suffix from the pack archive name (`add_custom (op1)`); unique labels stay plain. Per leaf: if emulate `manifest.json` (thin profile or export catalog), use **adaptEmulate**; else **adaptPayloads** (hardware) ([PROC-8](../../docs/context/decisions/PROC.md), [ADAPTERS.md](../../docs/formats/ADAPTERS.md)).
2. **`cann-rep`** — classic engineering / sample fixture container. Parses via `parseRep` / `adaptRep` → full `AdaptedReport`.
3. **Otherwise** — assumes standalone JSON, parses as CTEF, converts via `chromeTraceToSwimlane` → `AdaptedReport` with an empty `ReportViewModel` (empty summary, empty pipeOccupancy, empty overviewSeries). This triggers the aside panel auto-hide in ProfilingReport per PROC-3.

Throws on empty input. Throws with descriptive message on corrupted binary or unparseable JSON. Valid JSON that is not CTEF (no complete interval events: `X` with `ts`+`dur`, or `i` with `ts` and positive `dur`) fails in `chromeTraceToSwimlane` and propagates the error.

## Acceptance Criteria

1. **PR-JSON-001**: Standalone CTEF JSON opens and renders swimlane without CSV sidebar per PROC-3.
1. **PR-JSON-002**: Valid classic `cann-rep` / sample `.rep` detected correctly, not misinterpreted as CTEF.
1. **PR-JSON-003**: Product `npu-rep` magic (160- and 164-byte layouts) loads via `loadReportSource` and is not treated as CTEF.
1. **PR-JSON-004**: A `npu-rep` leaf with emulate `manifest.json` (thin profile or export catalog) is routed to the emulate adapter path (not required to contain compute metric CSVs; PipeTrace optional).

## Edge Cases

- Corrupted file → throws. Empty buffer → throws. Non-CTEF JSON → fails downstream.

## Dependencies

[PROC-2](../../docs/context/decisions/PROC.md) — product host extension `.npu-rep`. PROC-3 — standalone CTEF opens without CSV pack; aside hides. [npu-rep.spec](./npu-rep.spec.md), [rep-format.spec](./rep-format.spec.md).

## Changelog
- **2026-11-18** — Non-CTEF JSON fails when there is no complete interval (`X` with `ts`+`dur`, or `i` with positive `dur`), matching PR-SWIM-017.
- **2026-11-18** — Colliding selector labels gain a ` (stem)` suffix; unique labels stay plain.
- **2026-11-18** — Multi-op selector label comes from the pack's first operator row (stem fallback).
- **2026-09-14** — PR-JSON-004: route simulator leaves by `manifest.json` ([PROC-8](../../docs/context/decisions/PROC.md)).
- **2026-09-07** — Document product `npu-rep` detection ahead of classic `cann-rep` and CTEF ([PROC-2](../../docs/context/decisions/PROC.md)).
- **2026-08-05** — Initial spec. Core behaviors established.
