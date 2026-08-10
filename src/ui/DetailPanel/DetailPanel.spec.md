# DetailPanel

| spec-id-prefix |
|----------------|
| PR-DPANEL-*    |

Bottom selection dock shell: three-column layout hosting DetailSummary, DetailParameter, and DetailRelevant.

## Inputs

**selected**, **unit**, optional **locale** — forwarded to DetailSummary.

## Outputs

Purely presentational — no emitted events.

## Behavior

MVP mounts the identity/timing summary and P2 stubs for Parameter and Relevant columns.

## Acceptance Criteria

1. **PR-DPANEL-001** — Renders the detail panel shell with summary when selected is provided.

## Visual

Normative crop: [`visual/panel-chrome.png`](./visual/panel-chrome.png) — [`visual/provenance.yaml`](./visual/provenance.yaml).

## Design sketches

- [panel-chrome](./visual/panel-chrome.png) — full raised 「详情」 dock from `v930/detail-strip-raised`

## Changelog
- **2026-08-10** — Introduced as DetailStrip replacement shell.
