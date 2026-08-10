# DetailSummary

| spec-id-prefix |
|----------------|
| PR-DSUM-*      |

Left column of the selection detail dock: selected event name and formatted times.

## Inputs

**selected** is a `SelectedEvent`. **unit** selects the time display unit. Optional **locale** localizes labels.

## Outputs

Purely presentational — no emitted events.

## Behavior

Displays name, start, duration, and end in the current display unit. Mounted by `DetailPanel` when a selection exists.

## Acceptance Criteria

1. **PR-DSUM-001** — Renders event name.
2. **PR-DSUM-002** — Formats start time, duration, and end time.

## Visual

Normative crop: [`visual/identity-card.png`](./visual/identity-card.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [identity-card](./visual/identity-card.png) — raised 「详情」 left event card from `v930/detail-strip-raised`
- [Event details](../../../../docs/ui/source/v930/detail-strip-raised.jpeg) — full frame

## Dependencies

[format-time](../../../../specs/core/format-time.spec.md).

## Changelog
- **2026-08-10** — Renamed from DetailStrip; visual pack is identity card only.
- **2026-08-05** — Initial DetailStrip spec.
