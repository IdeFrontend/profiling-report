# Component visual specs (from sketch crops)

Normative crops: [`README.md`](./README.md) / PNGs in this folder. Source: `with_sidebar.png`.

---

## 1. Lane util bars (`LaneGutter`)

**Crops:** `lane-gutter-util.png`, `lane-util-bars.png`

| Token | Value |
|-------|--------|
| Track width | `110px` (fixed column) |
| Track height | `16px` |
| Shape | Pill: `border-radius: 8px` (half height) |
| Track fill | `#2a2a2a` |
| Track border | none (or `1px solid #3a3a3a` if needed for contrast) |
| Value fill | Lane `color` (pipe category), left-aligned width = util% |
| Warning fill | `#733234` when util &lt; 0.5 (optional; sketches use red for hot/low cores) |
| % text | **Inside** track, **right-aligned**, `padding-right: 6px` |
| % font | 10px, weight 600, tabular-nums, color `#e8e8e8` |
| Layout | `grid-template-columns: minmax(0,1fr) 110px` |
| Hatch | P2 — diagonal hatch on remainder; MVP may omit |

**Do not** place `%` to the left of the bar.

---

## 2. Overview range handles (`TimeOverviewBar`)

**Crops:** `overview-range-handles.png`, `overview-handle-left.png`, `overview-handle-right.png`

| Token | Value |
|-------|--------|
| Handle | **Not** thick capsule grips |
| Stem | `1px` solid `#ffffff`, full track height under tab |
| Top tab | `~10×6px` white rounded rect (`border-radius: 1px`) |
| Tab direction | **Outward**: left handle tab extends left; right extends right |
| Hit target | ≥10px wide invisible hit area centered on stem |
| Window fill | Selected: `rgba(255,255,255,0.06)`; outside dimmed via track |
| Window top | subtle light edge optional |

---

## 3. Cursor timestamp (`ProfilingReport` `.pr-cursor__label`)

**Crops:** `cursor-timestamp.png`, `cursor-timestamp-context.png`

| Token | Value |
|-------|--------|
| Bubble fill | `#317AF7` (align `--pr-playhead` / `#3078F0` ±) |
| Text | `#ffffff`, 11px, weight 600, tabular-nums |
| Format | `MM:SS.mmm` from time in **active display unit** (see `formatCursorTime`) |
| Size | ~72×19px content; `padding: 1px 8px`; `border-radius: 4px` |
| Stem | 1px line same blue, centered under bubble (cursor line) |
| Behavior | Must update on pointer move; short traces use µs/ns unit so digits change |

**Example:** axis `4.456ms` → label `00:04.456` when unit is `ms`.
