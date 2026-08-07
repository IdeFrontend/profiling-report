# Component visual crops (from sketch screenshots)

Cropped from [`with_sidebar.png`](../with_sidebar.png) (primary) for implementation alignment. Pixel measurements are from that source (±1–2 px).

| File | Component | Source region (approx.) |
|------|-----------|-------------------------|
| [`lane-gutter-util.png`](lane-gutter-util.png) | Lane expanders + util bars | Kernel gutter block |
| [`lane-expanders.png`](lane-expanders.png) | Group + lane chevrons / labels | Kernel hierarchy |
| [`lane-expander-detail.png`](lane-expander-detail.png) | Zoomed open-angle chevrons | Kernel + Core0 rows |
| [`lane-util-bars.png`](lane-util-bars.png) | Util bar column only | Same, bars tight crop |
| [`overview-range-handles.png`](overview-range-handles.png) | Visible-range brush + axis | Dual time axis strip |
| [`overview-handle-left.png`](overview-handle-left.png) | Left range handle (detail) | `0ms` edge |
| [`overview-handle-right.png`](overview-handle-right.png) | Right range handle (detail) | ~`12.3ms` edge |
| [`cursor-timestamp.png`](cursor-timestamp.png) | Mouse cursor time bubble | Playhead label |
| [`cursor-timestamp-context.png`](cursor-timestamp-context.png) | Bubble + stem + axis | Wider context |
| [`toolbar-search.png`](toolbar-search.png) | Search pill + magnifier | Timeline chrome |
| [`toolbar-zoom.png`](toolbar-zoom.png) | Zoom pill (mag− / slider / mag+) | Timeline chrome |
| [`toolbar-actions.png`](toolbar-actions.png) | Square icon button cluster | Size/spacing reference |

## Normative notes (measured)

### Lane util bars
- **Shape:** pill / capsule (`border-radius ≈ height/2`).
- **Size:** height **~16–17 px**; track width **~100–120 px** in sketch column.
- **% text:** **inside** the track, **right-aligned**, light gray/white.
- **Fill:** solid gray (nominal) or muted red warning (`#733234` family); optional diagonal hatch on remainder.
- **Guide:** faint vertical dotted threshold through the bar column (~75–80%).

### Overview range handles
- **Shape:** vertical white **pill head** (~**4×14 px**, `border-radius: 2px`) centered on a **1 px** white stem — not a wide horizontal flag.
- **Hit target:** ≥12px wide invisible area centered on the stem.
- **Window:** selected span slightly lighter; outside span dimmed; labels outside window muted.

### Lane expanders
- **Open-angle** stroke carets on **expandable** nodes only (groups today). Leaf lanes: **no** chevron.
- Group expanded = down; collapsed = right. Label `12px/600/#e8e8e8`; lane label `11px/400/#b0b0b0`; lane pad-left `24px` under group title.

### Cursor timestamp
- **Fill:** `#317AF7` (≈ playhead blue).
- **Text:** white, format `MM:SS.mmm` (e.g. `00:04.456`), centered in bubble.
- **Bubble:** ~**72×19 px** rounded rect; **1 px** blue stem centered under bubble.
- Must track mouse time continuously (not stuck at `00:00.000`).

### Report toolbar
- Control height **28px**. Search pill `#2a2a2a` + magnifier SVG. Zoom **one** pill `#363636` with mag− / slider / mag+.
- Action buttons **28×28**, radius `4px`; active uses `#317AF7`.
- P2 icons in sketch cluster are out of scope.

## Next
Implementation tracks [`VISUAL_SPEC.md`](VISUAL_SPEC.md).
