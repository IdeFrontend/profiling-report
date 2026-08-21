# NPU-REP Format

| spec-id-prefix |
|----------------|
| PR-NPU-*       |

Parse the product `npu-rep` binary container (including nested per-operator archives) into file entries, and adapt each operator into the canonical swimlane + report view-models.

```ts
parseNpuRep(bytes: Uint8Array): ParsedNpuRep
```

## Behavior

**Container.** `npu-rep` is a packed, little-endian container. Head is 36 bytes: `magic[8]` (`npu-rep` + NUL), `version:u32` (`0x00010000`), `orgin:u16`, `repHeadLength:u16` (`36`), `fileInfoCount:u32`, `fileInflLength:u32` (`164`), `resv:u32`, `npuRepLength:u64`. FileInfo entries are **164 bytes** each: `magic[8]`, `name[128]`, `type:u32`, `resv:u32`, `pad:u32`, `length:u64`, `offset:u64`.

**Nested operators.** `type === 6` (or a payload re-starting with the `npu-rep` magic) marks a nested per-operator archive (`.npu.rep`). An outer container packs N nested archives; each leaf archive packs `trace.json` + metric CSVs. A container with no nested archives is treated as a flat single-operator leaf pack.

**Loading.** `loadReportSource` detects the `npu-rep` magic and returns a multi-operator `AdaptedReport` when nested archives exist (default-selecting the first operator), or a single-operator report for a flat leaf. Operator **id** is the unique FileInfo name (`op1.npu.rep`); **label** is the archive stem (`op1`). Duplicate stems throw (same posture as duplicate embed names).

## Acceptance Criteria

1. **PR-NPU-001** — Parses npu-rep head + 164-byte file table (2 nested archives).
2. **PR-NPU-002** — Nested archives parse into leaf payloads (trace.json + CSVs).
3. **PR-NPU-003** — Rejects bad magic / version / length mismatch.
4. **PR-NPU-004** — loadReportSource loads multi-op npu-rep; defaults to first operator; ids are FileInfo names.
5. **PR-NPU-005** — Duplicate operator stems (`op1.npu.rep` + `op1.rep`) throw.

## Edge Cases

- Unknown/truncated magic → throw. Unsupported version → throw. `npuRepLength` mismatch → throw. Duplicate/overlapping embeds → throw. Duplicate operator stems → throw. Flat leaf (no nested archive) → single-op adapted report.

## Dependencies

[rep-format](./rep-format.spec.md), [load-report-source](./load-report-source.spec.md), [view-models](./view-models.spec.md).

## Changelog
- **2026-08-21** — PR-NPU-005: duplicate operator stems throw (unit-tested).
- **2026-08-20** — Initial spec. Product `npu-rep` container + nested multi-operator archives.
