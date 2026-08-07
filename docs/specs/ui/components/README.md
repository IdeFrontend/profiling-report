# Component visual crops (from sketch screenshots)

Cropped from [`with_sidebar.png`](../with_sidebar.png) (primary) for implementation alignment. Pixel measurements are from that source (±1–2 px).

| File | Component | Source region (approx.) |
|------|-----------|-------------------------|
| [`lane-gutter-util.png`](lane-gutter-util.png) | Lane expanders + util bars | Kernel gutter block |
| [`lane-util-bars.png`](lane-util-bars.png) | Util bar column only | Same, bars tight crop |
| [`overview-range-handles.png`](overview-range-handles.png) | Visible-range brush + axis | Dual time axis strip |
| [`overview-handle-left.png`](overview-handle-left.png) | Left range handle (detail) | `0ms` edge |
| [`overview-handle-right.png`](overview-handle-right.png) | Right range handle (detail) | ~`12.3ms` edge |
| [`cursor-timestamp.png`](cursor-timestamp.png) | Mouse cursor time bubble | Playhead label |
| [`cursor-timestamp-context.png`](cursor-timestamp-context.png) | Bubble + stem + axis | Wider context |

## Normative notes (measured)

### Lane util bars
- **Shape:** pill / capsule (`border-radius ≈ height/2`).
- **Size:** height **~16–17 px**; track width **~100–120 px** in sketch column.
- **% text:** **inside** the track, **right-aligned**, light gray/white.
- **Fill:** solid gray (nominal) or muted red warning (`#733234` family); optional diagonal hatch on remainder.
- **Guide:** faint vertical dotted threshold through the bar column (~75–80%).

### Overview range handles
- **Not** thick capsule grips with grip dots.
- **Shape:** **1 px white vertical line** + small **white rectangular top tab** (flag); tabs face **outward** (left handle tab to the left, right to the right).
- **Window:** selected span slightly lighter; outside span dimmed; labels outside window muted.

### Cursor timestamp
- **Fill:** `#317AF7` (≈ playhead blue).
- **Text:** white, format `MM:SS.mmm` (e.g. `00:04.456`), centered in bubble.
- **Bubble:** ~**72×19 px** rounded rect; **1 px** blue stem centered under bubble.
- Must track mouse time continuously (not stuck at `00:00.000`).

## Next
Implementation tracks [`VISUAL_SPEC.md`](VISUAL_SPEC.md).
