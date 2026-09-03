# NPU-REP Format

| spec-id-prefix |
|----------------|
| PR-NPU-*       |

Parse the product `npu-rep` binary container (including nested per-operator archives) into file entries, and adapt each operator into the canonical swimlane + report view-models.

```ts
parseNpuRep(bytes: Uint8Array): ParsedNpuRep           // interim sample (164-byte)
parseNpuRep160(bytes: Uint8Array): ParsedNpuRep160     // product layout (160-byte)
```

## Behavior

**Container.** `npu-rep` is a packed, little-endian container. Head is 36 bytes: `magic[8]` (`npu-rep` + NUL), `version:u32` (`0x00010000`), `orgin:u16`, `repHeadLength:u16` (`36`), `fileInfoCount:u32`, `fileInfoLength:u32`, `resv:u32`, `npuRepLength:u64`.

Two FileInfo layouts share this head and are disambiguated by `fileInfoLength`:

- **Product 160-byte layout** (`fileInfoLength = 160`, `origin = 1` — produced by the current `npu-compute` tooling, `data/scripts/pack_rep.py`): FileInfo = `magic[8]`, `name[128]`, `type:u16` (`1=npu-rep` nested, `2=json`, `3=jsonl`, `4=csv`, `5=sqlite3`, `6=protobuf`), `reserved:u16`, `reserved1:u32`, `fileLength:u64`, `fileRepOffset:u64`. Payloads are contiguous — no gaps and no unreferenced trailing bytes. Parsed by `parseNpuRep160`.
- **Interim 164-byte sample layout** (`fileInfoLength = 164`, `type:u32`, `type 6` = nested) — the repo's own sample packer (`data/build_sample_rep.py`), used by `example.npu.rep` / `sample.lite.rep`. Parsed by `parseNpuRep`. FileInfo = `magic[8]`, `name[128]`, `type:u32`, `resv:u32`, `pad:u32`, `length:u64`, `offset:u64`.

**Nested operators.** A `type` marking a nested archive (`6` in the 164-byte layout, `1` in the 160-byte layout — or a payload re-starting with the `npu-rep` magic) marks a nested per-operator archive (`.npu.rep`). An outer container packs N nested archives; each leaf archive packs `trace.json` + metric CSVs. A container with no nested archives is treated as a flat single-operator leaf pack.

**Loading.** `loadReportSource` detects the `npu-rep` magic, then routes by `fileInfoLength` (`160` → `parseNpuRep160`, otherwise `parseNpuRep`). It returns a multi-operator `AdaptedReport` when nested archives exist (default-selecting the first operator), or a single-operator report for a flat leaf. Operator **id** is the unique FileInfo name (`op1.npu.rep`); **label** is the archive stem (`op1`). Duplicate stems throw (same posture as duplicate embed names).

## Acceptance Criteria

1. **PR-NPU-001** — Parses npu-rep head + 164-byte file table (2 nested archives).
2. **PR-NPU-002** — Nested archives parse into leaf payloads (trace.json + CSVs).
3. **PR-NPU-003** — Rejects bad magic / version / length mismatch.
4. **PR-NPU-004** — loadReportSource loads multi-op npu-rep; defaults to first operator; ids are FileInfo names.
5. **PR-NPU-005** — Duplicate operator stems (`op1.npu.rep` + `op1.rep`) throw.
6. **PR-NPU-006** — `sample.lite.rep` operators have distinct traces, CSVs, connections (op1: every event 3–8 neighbors; op2: 1–4), Cube pipe occupancy, Card → 计算 → Core → pipe nesting (via producer `nestCardTree` opt-in), ProfilerStep bands (op1: 3, op2: 5), and producer Parameter args (`Code`, `Detail`, `Pc_addr`, `Process_bytes`). Committed artifact is **lite** (op2 omits `trace.json`); playground/tests hydrate op2 via `generateSampleOp2Trace` before `loadReportSource`.
7. **PR-NPU-007** — `parseNpuRep160` parses the product 160-byte head + file table from `data/result.npu-rep` (6 entries; `jsonl` type 3, CSVs type 4); rejects bad magic / version / origin / length; round-trips `packNpuRep160`.
8. **PR-NPU-008** — `loadReportSource` routes a 160-byte container: a flat leaf → single-op `AdaptedReport`; a nested `type 1` container → multi-op report.
9. **PR-NPU-009** — A metrics-only 160-byte pack (no `trace.json`) adapts with a **null** `swimlaneModel` and a populated `reportModel` (no hard error), so the viewer renders the aside without a timeline.

## Edge Cases

- Unknown/truncated magic → throw. Unsupported version → throw. `npuRepLength` mismatch → throw. Duplicate/overlapping embeds → throw. Duplicate operator stems → throw. Flat leaf (no nested archive) → single-op adapted report. 160-byte layout: bad origin → throw; duplicate names → throw; unreferenced trailing payload bytes → throw.

## Dependencies

[rep-format](./rep-format.spec.md), [load-report-source](./load-report-source.spec.md), [view-models](./view-models.spec.md).

## Changelog
- **2026-09-03** — PR-NPU-007/008: product 160-byte layout (`parseNpuRep160` + routing by `fileInfoLength`); 164-byte layout re-labeled as the interim sample format.
- **2026-08-26** — PR-NPU-006: rename to `sample.lite.rep`; op2 trace generated at hydrate time; generator in `playground/`.
- **2026-08-25** — PR-NPU-006: `nestCardTree` opt-in nesting; trim sample.rep to ~30 MB; align neighbor AC to 3–8.
- **2026-08-25** — PR-NPU-006: sample traces include ProfilerStep bands; nest Core.*/PIPE lanes; fixture operators stay distinct.
- **2026-08-25** — PR-NPU-006: nest `CoreN.*/PIPE` sample lanes into Card → 计算 → Core → pipe; fixture operators stay distinct (traces + CSVs + connections).
- **2026-08-25** — PR-NPU-006: `data/sample.rep` fixture with distinct operators (traces + CSVs + connections).
- **2026-08-21** — PR-NPU-005: duplicate operator stems throw (unit-tested).
- **2026-08-20** — Initial spec. Product `npu-rep` container + nested multi-operator archives.
