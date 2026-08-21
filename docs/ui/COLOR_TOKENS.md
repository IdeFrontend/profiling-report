# Color Tokens (Normative from Sketches)

Sketch colors are **normative** for PIPE bars, overview series, and swimlane event categories ([Q13 Resolved](../context/OPEN_QUESTIONS.md)). Extracted from [`source/v930/`](./source/v930/) (`entry.jpeg` and related frames). Roundings are ±4–8 in RGB from sampled pixels.

Implement as CSS variables (and matching `colorKey` on `PipeOccupancyItem`). MSTT theme may tint chrome; **category hues below stay fixed** unless Product revises this file.

## Surfaces / chrome

| Token | Hex | Notes |
|-------|-----|-------|
| `--pr-bg-deep` | `#1F1F1F` | Main report / timeline / gutter lanes / toolbar strip / canvas |
| `--pr-bg-panel` | `#262626` | Elevated chrome: aside, cards, detail dock, gutter group headers |
| `--pr-playhead` | `#3078F0` | Vertical scrubber / accent blue |
| `--pr-color-duration-bar` | `#5EC8D8` | Summary duration card decorative bar (report-stats cyan) |
| `--pr-color-overview-cube` | `#3078F0` | Overview Cube series fill |
| `--pr-color-bandwidth-bar` | `#3078F0` | I-Q6g I/O bandwidth card bar fill (same hex, separate so Cube series edits do not repaint cards) |

### Toolbar controls (hardcoded; not CSS vars)

| Surface | Hex | Notes |
|---------|-----|-------|
| Search pill fill | `#2A2A2A` | [`ReportToolbar`](../../src/ui/ReportToolbar/ReportToolbar.spec.md) |
| Zoom pill fill | `#363636` | Compound zoom control |
| Zoom track filled | `#FFFFFF` | Left of thumb |
| Zoom track unfilled | `#1A1A1A` | Right of thumb |

Lane event-sequence fill matches `--pr-bg-deep` (`#1F1F1F`).

## PIPE occupancy + category keys

Sampled primarily from PIPE bars in [`v930/compute-load`](./source/v930/compute-load.jpeg) (and `entry.jpeg` swimlane), ordered as in sketches: Cube → Vector → MTE2 → MTE1 → FixP → MTE3 → Scalar.

| `colorKey` | Hex | Role |
|------------|-----|------|
| `cube` | `#007084` | PIPE Cube; Cube overview / series (see also bright accent) |
| `vector` | `#007464` | PIPE Vector; Vector overview series |
| `mte2` | `#985000` | PIPE MTE2 |
| `mte1` | `#885C00` | PIPE MTE1; yellow/gold event blocks (e.g. `DC_PRELOAD_*`) |
| `fixp` | `#586C0C` | PIPE FixP (olive in sketches) |
| `mte3` | `#A44830` | PIPE MTE3 (rust / red-brown) |
| `scalar` | `#1A743E` | PIPE Scalar bar in `compute-load.jpeg`. Swimlane greens in `entry.jpeg` sample closer to `#38702C`; one token per rule 1. |

**Overview chart accent (brighter Cube sparkline):** `#3078F0` — use for filled overview “Cube” series when distinct from bar cyan is desired; keep `vector` series on `#007464` / teal family.

## Swimlane event accents (non-pipe)

| `colorKey` | Hex | Typical use in sketches |
|------------|-----|-------------------------|
| `mov` / `transfer` | `#B868F8` | Purple blocks (e.g. `MOV_OUT_TO_L1_*`) |
| `mov-muted` | `#6058A8` | Darker purple variant |
| `cube-lane` | `#3860A8` | Blue cube/instruction bands on timeline |
| `aten` / `mixed` | striped blue/green | Aten-style labels — prefer `cube-lane` + `scalar` stripe in renderer |

## CSS variable map (library)

```css
:root {
  --pr-color-cube: #007084;
  --pr-color-vector: #007464;
  --pr-color-mte1: #885c00;
  --pr-color-mte2: #985000;
  --pr-color-mte3: #a44830;
  --pr-color-fixp: #586c0c;
  --pr-color-scalar: #1a743e;
  --pr-color-mov: #b868f8;
  --pr-color-overview-cube: #3078f0;
  --pr-color-bandwidth-bar: #3078f0;
  --pr-color-duration-bar: #5ec8d8;
  --pr-color-playhead: #3078f0;
  --pr-bg-deep: #1f1f1f;
  --pr-bg-panel: #262626;
}
```

## Rules

1. Same `colorKey` must match across PIPE aside bars, overview series, and swimlane **event** fills when category is known.
2. **Gutter utilization bars** use threshold fills only: util &lt; 0.5 → `#733234`, util ≥ 0.5 → `#5c5c5c` — not `colorKey` / pipe category hues. Midline dash at 50% track width: `1px dashed rgba(255,255,255,0.1)`.
3. Unknown swimlane category → neutral gray (`#606060`), not a random hue.
4. Changing tokens requires updating this file and visual fixtures in the same PR.

## Related

- [UI_OVERVIEW.md](UI_OVERVIEW.md)
- [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md)
- [COMPONENTS.md](../architecture/COMPONENTS.md) — `PipeOccupancyItem.colorKey`
