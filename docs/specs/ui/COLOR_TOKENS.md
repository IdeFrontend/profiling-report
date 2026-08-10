# Color Tokens (Normative from Sketches)

Sketch colors are **normative** for PIPE bars, overview series, and swimlane event categories ([Q13 Resolved](../../context/OPEN_QUESTIONS.md)). Extracted from [`source/v930/`](./source/v930/) (`entry.jpeg` and related frames). Roundings are ±4–8 in RGB from sampled pixels.

Implement as CSS variables (and matching `colorKey` on `PipeOccupancyItem`). MSTT theme may tint chrome; **category hues below stay fixed** unless Product revises this file.

## Surfaces / chrome

| Token | Hex | Notes |
|-------|-----|-------|
| `--pr-bg-panel` | `#303030` | Dominant panel / gutter fill |
| `--pr-bg-deep` | `#202830` | Deeper IDE chrome |
| `--pr-playhead` | `#3078F0` | Vertical scrubber / accent blue |
| `--pr-color-duration-bar` | `#5EC8D8` | Summary duration card decorative bar (report-stats cyan) |

## PIPE occupancy + category keys

Sampled primarily from PIPE bars in `source/v930/entry.jpeg` (bottom-right), ordered as in sketches: Cube → Vector → MTE2 → MTE1 → FixP → MTE3 → Scalar.

| `colorKey` | Hex | Role |
|------------|-----|------|
| `cube` | `#007084` | PIPE Cube; Cube overview / series (see also bright accent) |
| `vector` | `#007464` | PIPE Vector; Vector overview series |
| `mte2` | `#985000` | PIPE MTE2 |
| `mte1` | `#885C00` | PIPE MTE1; yellow/gold event blocks (e.g. `DC_PRELOAD_*`) |
| `fixp` | `#586C0C` | PIPE FixP (olive in sketches) |
| `mte3` | `#A44830` | PIPE MTE3 (rust / red-brown) |
| `scalar` | `#38702C` | PIPE Scalar; green event accents |

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
  --pr-color-scalar: #38702c;
  --pr-color-mov: #b868f8;
  --pr-color-overview-cube: #3078f0;
  --pr-color-duration-bar: #5ec8d8;
  --pr-color-playhead: #3078f0;
  --pr-bg-panel: #303030;
}
```

## Rules

1. Same `colorKey` must match across PIPE bars, gutter util tint, overview series, and event fill when category is known.
2. Unknown category → neutral gray (`#606060`), not a random hue.
3. Changing tokens requires updating this file and visual fixtures in the same PR.

## Related

- [UI_OVERVIEW.md](UI_OVERVIEW.md)
- [VIEW_DATA_REQUIREMENTS.md](../formats/VIEW_DATA_REQUIREMENTS.md)
- [COMPONENTS.md](../architecture/COMPONENTS.md) — `PipeOccupancyItem.colorKey`
