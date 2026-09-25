# PerformanceHintsDock

| spec-id-prefix |
|----------------|
| PR-PHINTS-*    |

Bottom-dock 性能分析 table: one row per joined performance hint — Hint Message, Source Line, Instruction Address.

## Inputs

**rows** (`PerformanceHintItem[]`) — the joined hint rows in adapter CSV order (instruction → source-line → kernel), each with a message and an optional source line / PC. Optional **locale**, and optional **height** — the dock height in px, defaulting to `DOCK_HEIGHT_COLLAPSED` (247) from `panelResize` because the root shell normally supplies it.

## Outputs

**close** — the header close icon; the parent drops `hintsDockOpen`, which unmounts the pane.
**update:height** — the centred top-edge expander; the root owns which of the two dock heights is current, exactly as it does for [DetailPanel](../DetailPanel/DetailPanel.spec.md).

## Behavior

The pane is the host dock footer's **last** content branch: it renders only while the dock is open, the `performanceHints` capability carries at least one row, and neither a single selection nor a marquee multi-selection owns the dock — the aside's title-row 性能分析 trigger clears those first ([ProfilingReport](../ProfilingReport/ProfilingReport.spec.md) `PR-ROOT-023`). The pane renders inside the host's **standard event-detail dock**: the same `.pr-dock` footer that hosts `DetailPanel` / `MultiSelectSummary`, with the same `--pr-dock-h` height and chrome as the detail panel. There is no dedicated hints shell — the pane itself carries no shell chrome of its own.

**Height and the expander.** The pane does not own a height of its own: it is handed the root's one `dockHeight`, shared with `DetailPanel` / `MultiSelectSummary`, so switching branches or reopening never resets what the user last chose — and opening the pane never auto-expands. Its top edge carries the same centred expander as [DetailPanel](../DetailPanel/DetailPanel.spec.md): a 14×1px bar plus a small solid triangle in `#6c6c6c` (hover `#b3b3b3`), sitting on the pane's **own** top edge (`position: relative` on `.pr-hints`, absolute + `translateX(-50%)` on the button) so the title on the left and the close icon on the right stay clear. The pair swaps order between states — triangle above the bar reads as "push up to expand", below it as "push down to collapse" — which is a flex `column-reverse` / `column` flip, and the button carries `aria-expanded` plus the `collapseDock` / `expandDock` label. `height` is a prop and `update:height` an emit, so the root owns the state; a click emits `DOCK_HEIGHT_EXPANDED` (407) when collapsed and `DOCK_HEIGHT_COLLAPSED` (247) when expanded.

Columns are one 50 / 25 / 25 flex split, identical on the header and body rows so they stay aligned at any width. The header row is `#262626`; body rows are `#1F1F1F`, 32px min-height, with the message wrapping rather than clipping.

Missing Source Line / PC cells show the `notSpecified` copy — **Not specified**, **未指定** under zh-CN (sketch fidelity). A PC renders as `0x` + lowercase hex; a value `BigInt` rejects (a host-supplied hex string, a malformed cell) is echoed **as-is**, because there is no decimal value to convert and the cell must never blank the table.

## Acceptance Criteria

1. **PR-PHINTS-001** — Three columns in sketch order (Hint Message | Source Line | Instruction Address) on one 50/25/25 split, shared by the header and body rows.
1. **PR-PHINTS-002** — The Source Line cell shows the raw id when present and the `notSpecified` copy when the row has no source line.
1. **PR-PHINTS-003** — A `null` / absent PC renders the `notSpecified` copy (**未指定** under the default zh-CN locale, **Not specified** under `en`) rather than an address.
1. **PR-PHINTS-004** — A valid decimal PC renders as `0x` + lowercase hex.
1. **PR-PHINTS-005** — A PC that `BigInt` rejects renders the raw value as-is (never blank, never "Not specified").
1. **PR-PHINTS-006** — The header close button emits `close`.
1. **PR-PHINTS-007** — The pane reuses the host's standard event-detail dock chrome (`.pr-dock`: `min(var(--pr-dock-h), 60vh)`, `var(--pr-bg-panel)` `#262626` background, `16px 16px 0 0` radius) and the host footer carries **no** dedicated hints modifier or Figma hints shell.
1. **PR-PHINTS-008** — The pane carries the centred top-edge expander — itself the positioning context (`position: relative`), the button absolute at `top: 0` / `left: 50%` / `translateX(-50%)` — reports `aria-expanded="false"` at the default (collapsed) height, and a click emits `update:height` with `DOCK_HEIGHT_EXPANDED` (407).
1. **PR-PHINTS-009** — At `height: DOCK_HEIGHT_EXPANDED` the expander reports `aria-expanded="true"` with its `--expanded` modifier, and a click emits `update:height` with `DOCK_HEIGHT_COLLAPSED` (247).

## Dependencies

[vision of the view](../../../docs/views/performance-hints.md) — column set, PC-as-hex and the Not specified copy come from the sketch. Host docking and the 性能分析 trigger: [ProfilingReport](../ProfilingReport/ProfilingReport.spec.md).

## Changelog
- **2026-09-25** — The pane gains the shared dock expander: **height** / **update:height** wired to the root's `dockHeight` and the centred top-edge affordance copied from `DetailPanel`, so the browser hints dock expands and collapses like the detail docks instead of staying pinned at 247px (`PR-PHINTS-008`, `PR-PHINTS-009`, `PR-ROOT-021`).
- **2026-09-25** — The pane now renders in the host's standard event-detail dock (same height/chrome as `DetailPanel`); the dedicated `pr-dock--hints` shell chrome is gone (`PR-PHINTS-007`, `PR-ROOT-020`).
- **2026-09-23** — PC formatting moves into `formatPc`: decimal → `0x` lowercase hex, `BigInt`-rejected input echoed as-is, absent PC → `Not specified` (PR-PHINTS-003/004/005). The inline `'0x' + BigInt(row.pc)` could blank the whole table on non-decimal input.
- **2026-09-23** — Spec introduced: three-column 50/25/25 pane, empty-cell copy, close emit, and the host `pr-dock--hints` chrome; the pane renders only when no other dock content owns the slot (PR-PHINTS-001..007).
