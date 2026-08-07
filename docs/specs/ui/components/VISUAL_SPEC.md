# Component visual specs (from sketch crops)

Normative crops: [`README.md`](./README.md) / PNGs in this folder. Source: `with_sidebar.png`.

---

## 1. Lane util bars (`LaneGutter`)

**Crops:** `lane-gutter-util.png`, `lane-util-bars.png`

| Token | Value |
|-------|--------|
| Track width | `110px` (fixed column) |
| Track height | `16px` |
| Shape | Rounded rect: `border-radius: 2px` (not a full capsule / `height/2`) |
| Track / unfilled | Gray **diagonal hatch** (not solid black) — e.g. repeating `-45deg` stripes `#3a3a3a` on `#2a2a2a` |
| Value fill | Lane `color` (pipe category), left-aligned width = util% |
| Warning fill | `#733234` when util &lt; 0.5 (optional; sketches use red for hot/low cores) |
| % text | **Inside** track, **right-aligned**, `padding-right: 6px` |
| % font | 10px, weight 600, tabular-nums, color **`#b0b0b0`** (same as lane title — not bright white) |
| Layout | `grid-template-columns: minmax(0,1fr) 110px` (name + util); pad-left aligns label under group title |

**Do not** place `%` to the left of the bar.

---

## 2. Overview range handles (`TimeOverviewBar`)

**Crops:** `overview-range-handles.png`, `overview-handle-left.png`, `overview-handle-right.png`

| Token | Value |
|-------|--------|
| Head | Vertical white pill **4×10 px**, `border-radius: 2px`, centered on stem |
| Stem | `1px` solid `#ffffff`, from bottom of head to track bottom |
| Direction | Head is taller than wide (4×10 CSS) |
| Hit target | ≥12px wide invisible hit area centered on stem |
| Window fill | Selected: `rgba(255,255,255,0.06)`; outside dimmed via track |

### Axis ruler (total + viewport) — shared chrome

Both the overview track and the viewport time axis use the same ruler tokens:

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

## 3. Cursor timestamp (`ProfilingReport` `.pr-cursor__label`)

**Crops:** `cursor-timestamp.png`, `cursor-timestamp-context.png`

| Token | Value |
|-------|--------|
| Bubble fill | `#317AF7` (align `--pr-playhead` / `#3078F0` ±) |
| Text | `#ffffff`, 11px, weight 600, tabular-nums |
| Format | `MM:SS.mmm` from time **relative to `minTime`** in **active display unit** (see `formatCursorTime`) |
| Size | ~72×19px content; `padding: 1px 8px`; `border-radius: 4px` |
| Stem | 1px line same blue (`#317AF7`), continuous from axis through swimlane — **no** 1px gap at the axis/canvas border; axis + canvas segments share the same x (no horizontal jog) |
| Behavior | Must update on pointer move; short traces use µs/ns unit so digits change |

**Example:** axis `4.456ms` (relative) → label `00:04.456` when unit is `ms`.

---

## 4. Lane expanders (`LaneGutter` chevrons)

**Crops:** `lane-expanders.png`, `lane-expander-detail.png`

| Token | Value |
|-------|--------|
| Icon style | **Open-angle** stroke chevron (CSS borders), not filled `▾`/`▸` |
| Group expanded | Down-pointing caret (`v`), color `#a8a8a8` |
| Lane chevron | **Only if** the lane has expandable children (P2). MVP leaf threads: **no** chevron |
| Alignment | Lane **label** left edge aligns under the group **title** (pad-left `24px` = group pad `8` + chev `10` + gap `6`) |
| Gap chevron→label | `6px` (group row) |
| Group row | height `28px`; pad-left `8px`; label **12px / 600 / `#e8e8e8`** |
| Lane row | height `22px`; pad-left `24px`; label **11px / 400 / `#b0b0b0`** |
| Separators | `1px solid #333` under each lane; `#3a3a3a` under group header |
| Gutter bg | `#262626`; right border `#3a3a3a` |
| Interaction | Group header click → `toggle-group`; no chevron control on leaf lanes |

---

## 5. Report toolbar (`ReportToolbar`)

**Crops:** `toolbar-search.png`, `toolbar-zoom.png`, `toolbar-actions.png`  
Source band ~y=98–132 in `with_sidebar.png`. Control height **~28–29 px**.

### Search
| Token | Value |
|-------|--------|
| Height | `28px` |
| Width | `190px` |
| Shape | Pill: `border-radius: 14px` |
| Background | `#2a2a2a` |
| Border | none (or `1px solid #3a3a3a` if needed) |
| Icon | Stroke **magnifying glass** SVG `14×14`, color `#9a9a9a`, left inset |
| Input padding | `0 12px 0 32px` |
| Placeholder | `#808080`; text `#e0e0e0`; font `12px` |

### Zoom pill
| Token | Value |
|-------|--------|
| Container | Single pill, height `28px`, `border-radius: 14px`, bg `#363636` |
| Zoom out / in | **Magnifying-glass** SVGs with − / + inside (not bare ± text); `16×16`, color `#c8c8c8` |
| Buttons | Transparent, no separate square border; padding `4px 6px` |
| Slider | Width ~`100px`; track height `2px`; filled (left) `#e8e8e8`; unfilled `#2a2a2a`; thumb `10px` circle `#c8c8c8` |
| Gap | `4px` between icon / slider / icon inside pill |

### Action icon buttons (fit / measure / aside)
| Token | Value |
|-------|--------|
| Size | Square `28×28` |
| Radius | `4px` |
| Border | `1px solid transparent` (hover: `#4a4a4a`) |
| Background | transparent / `#2a2a2a` on hover |
| Icon | Stroke or fill SVG `14×16`, color `#c8c8c8` |
| Active (`--on`) | bg `#1e3a5f`; icon/border `#317AF7` |
| Gap between buttons | `4px` |

P2 sketch icons (chart, flag, layers, help, gear) are **not** MVP — do not stub.

### Time unit
Match control height `28px`; bg `#2a2a2a`; `border-radius: 4px`; font `12px`.

---

## 6. Resizable panels

| Token | Value |
|-------|--------|
| Gutter default / clamp | **280** / **180–480** px (`--pr-gutter-width`) |
| Aside default / clamp | **360** / **280–560** px |
| Handle hit target | **5px** wide, `ew-resize`; hover tint `rgba(49,122,247,0.35)` |
| Persistence | Session-only (not localStorage) |
| Narrow layout | Handles hidden at `max-width: 900px` |
