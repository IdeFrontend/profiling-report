# HardwareDetailsPanel

| spec-id-prefix |
|----------------|
| PR-HW-*        |

Interim hardware details list (DATA-34a).

## Inputs

**model** — `HardwareDetailsModel` with `sections`. Optional **locale**.

## Behavior

Renders each section title and key–value fields. Empty sections array → empty root (parent gates). No invented values. Long values ellipsize with native `title` tooltip.

## Acceptance Criteria

1. **PR-HW-001** — Renders section fields.
2. **PR-HW-002** — Empty sections → no panel chrome.

## Visual

Normative crop: [`visual/hardware-detail.png`](./visual/hardware-detail.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

| Token | Value |
|-------|--------|
| Overlay title | **硬件信息详情** |
| Section title | `12px` / `600` / `#ffffff` |
| Row | two columns; **values left-aligned** at mid column |
| Key | `#a0a8b0`; value `#e8eef4` |
| Long value | ellipsis + `title` tooltip |
| Section rule | `1px solid #3a424a` |
| Overlay | panel fills leftover column; list `overflow: auto` |

## Dependencies

DATA-34a, [view-models](../../../../specs/core/view-models.spec.md).

## Changelog

- **2026-08-13** — Overlay fills leftover column height.
- **2026-08-13** — Left-aligned values, ellipsis tooltip, crop tokens.
- **2026-08-10** — Initial interim panel.
