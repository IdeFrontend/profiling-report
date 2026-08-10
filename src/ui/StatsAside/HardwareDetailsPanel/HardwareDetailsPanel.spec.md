# HardwareDetailsPanel

| spec-id-prefix |
|----------------|
| PR-HW-*        |

Interim hardware details list (I-Q7a).

## Inputs

**model** — `HardwareDetailsModel` with `sections`. Optional **locale**.

## Behavior

Renders each section title and key–value fields. Empty sections array → empty root (parent gates). No invented values.

## Acceptance Criteria

1. **PR-HW-001** — Renders section fields.
2. **PR-HW-002** — Empty sections → no panel chrome.

## Visual

Normative crop: [`visual/hardware-detail.png`](./visual/hardware-detail.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Dependencies

I-Q7a, [view-models](../../../../specs/core/view-models.spec.md).

## Changelog

- **2026-08-10** — Initial interim panel.
