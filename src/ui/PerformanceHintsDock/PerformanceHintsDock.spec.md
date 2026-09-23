# PerformanceHintsDock

| spec-id-prefix |
|----------------|
| PR-PHINTS-*    |

Bottom-dock 性能分析 table: one row per joined performance hint — Hint Message, Source Line, Instruction Address.

## Inputs

**rows** (`PerformanceHintItem[]`) — the joined hint rows in adapter CSV order (instruction → source-line → kernel), each with a message and an optional source line / PC. Optional **locale**.

## Outputs

**close** — the header close icon; the parent drops `hintsDockOpen`, which unmounts the pane.

## Behavior

The pane is the host dock footer's **last** content branch: it renders only while the dock is open, the `performanceHints` capability carries at least one row, and neither a single selection nor a marquee multi-selection owns the dock — the aside's 性能分析 trigger clears those first ([ProfilingReport](../ProfilingReport/ProfilingReport.spec.md) `PR-ROOT-019`). The same condition drives the shell's `pr-dock--hints` chrome, so the modifier never claims hints chrome while DetailPanel / MultiSelectSummary is the content.

Columns are one 50 / 25 / 25 flex split, identical on the header and body rows so they stay aligned at any width. The header row is `#262626`; body rows are `#1F1F1F`, 32px min-height, with the message wrapping rather than clipping. The panel chrome belongs to the host footer (`pr-dock--hints`: 353px tall, 60vh clamp on short windows, 1px `rgba(255,255,255,0.1)` border, 12px radius, `#1F1F1F`) — the pane itself carries no shell.

Missing Source Line / PC cells show the `notSpecified` copy — **Not specified**, **未指定** under zh-CN (sketch fidelity). A PC renders as `0x` + lowercase hex; a value `BigInt` rejects (a host-supplied hex string, a malformed cell) is echoed **as-is**, because there is no decimal value to convert and the cell must never blank the table.

## Acceptance Criteria

1. **PR-PHINTS-001** — Three columns in sketch order (Hint Message | Source Line | Instruction Address) on one 50/25/25 split, shared by the header and body rows.
1. **PR-PHINTS-002** — The Source Line cell shows the raw id when present and the `notSpecified` copy when the row has no source line.
1. **PR-PHINTS-003** — A `null` / absent PC renders the `notSpecified` copy (**未指定** under the default zh-CN locale, **Not specified** under `en`) rather than an address.
1. **PR-PHINTS-004** — A valid decimal PC renders as `0x` + lowercase hex.
1. **PR-PHINTS-005** — A PC that `BigInt` rejects renders the raw value as-is (never blank, never "Not specified").
1. **PR-PHINTS-006** — The header close button emits `close`.
1. **PR-PHINTS-007** — Panel chrome per Figma is the host footer's `pr-dock--hints` modifier: `min(353px, 60vh)`, 1px `rgba(255,255,255,0.1)` border, 12px radius, `#1F1F1F` background.

## Dependencies

[vision of the view](../../../docs/views/performance-hints.md) — column set, PC-as-hex and the Not specified copy come from the sketch. Host docking and the 性能分析 trigger: [ProfilingReport](../ProfilingReport/ProfilingReport.spec.md).

## Changelog
- **2026-09-23** — PC formatting moves into `formatPc`: decimal → `0x` lowercase hex, `BigInt`-rejected input echoed as-is, absent PC → `Not specified` (PR-PHINTS-003/004/005). The inline `'0x' + BigInt(row.pc)` could blank the whole table on non-decimal input.
- **2026-09-23** — Spec introduced: three-column 50/25/25 pane, empty-cell copy, close emit, and the host `pr-dock--hints` chrome; the pane renders only when no other dock content owns the slot (PR-PHINTS-001..007).
