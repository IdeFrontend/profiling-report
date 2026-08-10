# Shared visual chrome

Component-local measures live in each `{Name}.spec.md` **Visual** section and crops under `src/ui/{Component}/visual/`.  
Index: [`README.md`](./README.md) · [`../DESIGN_INDEX.md`](../DESIGN_INDEX.md).

Layout truth for existing crops: [`../source/v930/entry.jpeg`](../source/v930/entry.jpeg).

---

## Axis ruler (total + viewport) — shared

Used by `TimeOverviewBar` (overview track) and `ProfilingReport` / `AxisRuler` (viewport time axis).

| Token | Value |
|-------|--------|
| Track height | **20px** |
| Label box | **18px** tall, aligned to the **top** of the 20px track |
| Label font | **12px** / weight **400**, `#c8c8c8`, tabular-nums |
| Origin | Labels are **relative to `minTime`** (trace start = **0**). Absolute CTEF `ts` must not appear on the axis. |
| Leftmost total-scale label | `0ms` / `0µs` / `0ns` (compact zero — not `0.00xxx…`) |
| Major bar | **1px** full track height (20px), `#a8a8a8` (muted `#666` outside overview window) |
| Label placement | Immediately **to the right** of its major bar (`left: pct` + ~2–3px gap; **not** centered) |
| Minor ticks | **9** between each adjacent major pair (10 subdivisions); **5px** tall from bottom; `#666` (muted `#4a4a4a`) |
| Major placement | **Nice ns steps** (`1\|2\|5×10ⁿ`) targeting ~**100px** spacing; majors at `origin + k·interval` (positions move with zoom/pan — not fixed percentages) |
| Containment | Tick text must stay inside the timeline column — **never** paint over the right aside. Track/axis `overflow: hidden` |

---

## Resizable panels

| Token | Value |
|-------|--------|
| Gutter default / clamp | **280** / **180–480** px (`--pr-gutter-width`) |
| Aside default / clamp | **360** / **280–560** px |
| Handle hit target | **5px** wide, `ew-resize`; hover tint `rgba(49,122,247,0.35)` |
| Persistence | Session-only (not localStorage) |
| Narrow layout | Handles hidden at `max-width: 900px` |
