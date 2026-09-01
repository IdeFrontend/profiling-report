# ContextMenu

| spec-id-prefix |
|----------------|
| PR-CTXM-*      |

A floating menu shown on right-click over a swimlane event or lane header, providing quick actions without navigating away from the timeline.

**MVP scope is narrower than the sketch.** Q24 (zoom history) and Q25 (Offset) are open, so 撤销缩放 (Undo zoom), 重置缩放 (Reset zoom) and Offset are **not rendered in MVP** — see [Open](#open). **Pin row** is deferred too: Q26 is resolved (Pin row is the only pinning action; there is no 置顶显示 item — that was a misread of the crop), and the row-pin action ships in its own PR. The menu table below records the full sketch for when Product answers; the Acceptance Criteria describe the MVP interim only.

## Inputs

The component receives coordinates (`x`, `y`) for positioning and the hit-test result describing what was right-clicked:
- `target: SwimEvent | null` — the clicked event (null for lane-level actions).
- `laneId: string` — lane identifier (thread/process name).
- `visible: boolean` — controls mount/unmount.

`SwimEvent` is the event payload (`id`, `name`, `startTime`, `duration`), same as MultiSelectSummary — not `EventRef` (`{ tid, index }`), which is a dependency pointer into `thread.events`.

When `target` is an event, the menu shows the event group plus the lane group. When `target` is null (lane header click), every event- and viewport-scope item is hidden (整屏显示, 在事件视图中显示 — plus the deferred 撤销缩放 and 重置缩放), leaving the lane group only.

## Outputs

MVP:
- `emit('hide-lane', laneId: string)` — hide the lane from view.
- `emit('fit-to-screen', target: SwimEvent)` — zoom viewport to fit the event.
- `emit('show-in-event-view', target: SwimEvent)` — **interim:** the parent selects the event (`selectedEventId`) and mounts DetailPanel. This library has no event-view tab (secondary tabs are host-side / P2 in COMPONENTS); if Product wants a host callback instead, that replaces the interim.
- `emit('close')` — menu dismissed (click-away, Escape, or item selected).

Deferred until Product answers (no item renders, so no emit fires): `undo-zoom` / `reset-zoom` (Q24), `offset` (Q25). `pin-row` and its Ctrl+P binding left this spec entirely — the row-pin action lands in its own PR (Q26 resolved: Pin row is the only pinning action).

## Behavior

### Menu items (source: v930/task-context-menu)

| # | Label            | Translation        | Shortcut | Scope    | MVP |
|---|------------------|--------------------|----------|----------|-----|
| 1 | 整屏显示         | Fit to screen      |          | event    | yes |
| 2 | 撤销缩放 (2)     | Undo zoom (badge = undo depth) | Ctrl+Z | viewport | no — Q24 (is zoom history in this library?) |
| 3 | 重置缩放         | Reset zoom (disabled in the crop) |   | viewport | no — Q24 (reset target + enable rule unknown) |
| 4 | 隐藏             | Hide               |          | lane     | yes |
| 5 | 在事件视图中显示 | Show in event view |          | event    | yes |
| 6 | Offset           | Offset             |          | lane     | no — Q25 (dialog vs auto-align unknown) |
| 7 | Pin row          | Pin row            | Ctrl+P   | lane     | no — row pin ships in its own PR (Q26 resolved) |

Ctrl+Z here is bound to 撤销缩放 — it **is** the zoom undo, so there is no collision with a general undo action. The crop shows separators after row 1 and before row 6.

MVP renders three items on an event target (整屏显示, 隐藏, 在事件视图中显示) and one on a lane header (隐藏).

### Positioning

Menu appears at pointer coordinates, clamped to viewport bounds so it never clips off-screen. If the menu would overflow bottom, it opens upward; if right, it opens leftward.

### Dismissal

- Click outside the menu.
- Press Escape.
- Select any menu item.
- Scroll the timeline.

### Keyboard

- Arrow Up/Down to navigate items.
- Enter to activate focused item.
- Escape to dismiss.
- **No shortcut bindings in MVP.** The sketch bindings stay with their deferred items: Ctrl+Z = 撤销缩放 (Q24); Ctrl+P = Pin row, which moves to the row-pin PR — note Ctrl+P collides with the browser Print shortcut, so that PR must `preventDefault()` the keydown and document host/webview opt-out handling.

## Acceptance Criteria

1. **PR-CTXM-001** — event right-click shows three MVP items at pointer.
1. **PR-CTXM-002** — lane header shows 隐藏 only.
1. **PR-CTXM-003** — outside click or Escape dismisses.
1. **PR-CTXM-005** — 隐藏 emits `hide-lane`.
1. **PR-CTXM-006** — 整屏显示 emits `fit-to-screen`.
1. **PR-CTXM-007** — arrow / Enter / Escape navigation works.
1. **PR-CTXM-008** — menu clamps to viewport bounds.
1. **PR-CTXM-010** — timeline scroll dismisses menu.
1. **PR-CTXM-011** — 在事件视图中显示 emits `show-in-event-view`.

Ids 004 (`pin-row` emit) and 009 (Ctrl+P) are retired with the row-pin deferral and must not be reused here; they belong to the row-pin PR. Deferred items carry no AC: 撤销缩放 / 重置缩放 (Q24), Offset (Q25).

## Edge Cases

| State | Behavior |
|---|---|
| Right-click near right edge | Menu opens leftward |
| Right-click near bottom edge | Menu opens upward |
| Right-click while another menu is open | Previous menu closes, new one opens |
| Right-click on collapsed group header | Lane-scope items only |
| Event spans multiple lanes | Uses the lane under the pointer |

## Dependencies

- `SwimlaneCanvas` — emits the right-click with coordinates and the hit-test result (`{ event: SwimEvent | null, laneId: string }`). See Cross-spec below.
- `ProfilingReport` — handles emitted actions.
- `SwimEvent` type from `src/domain/types.ts`.

### Cross-spec changes required

#### SwimlaneCanvas — context-menu output (PR-CANVAS-035…)

The canvas `contextmenu` handler calls `preventDefault()` (otherwise the browser menu wins), hit-tests the pointer and emits **`context-menu({ event: SwimEvent | null, x, y, laneId })`**. The canvas spec's interaction events include no right-click today; without this output the menu has nothing to mount on. Ids allocated at implementation time, above #31's marquee block (`PR-CANVAS-024…034`).

#### view-state — new field

`SwimlaneViewState.hiddenLaneIds: string[]` (default `[]`; does not exist today) — added in the implementation PR, same split as MultiSelectSummary's `multiSelectedIds`. `hide-lane` is an independent filter that removes the lane from the rendered model; it must not touch `collapsedIds` or the folder folding in `swimTree.ts`. Lane-pinning state (`pinnedLaneIds`) belongs to the row-pin PR, not here.

## Visual

### Measures

| Token | Value |
|---|---|
| Menu background | `var(--pr-surface-overlay)` |
| Menu border-radius | `6px` |
| Menu padding | `4px 0` |
| Item height | `32px` |
| Item padding | `8px 40px 8px 12px` |
| Item hover | `var(--pr-surface-hover)` |
| Item disabled | `var(--pr-text-secondary)` (重置缩放 in the crop) |
| Font size | `13px` |
| Shortcut color | `var(--pr-text-secondary)` |
| Separator | `1px solid var(--pr-border-subtle)` — per crop after 整屏显示 and before the lane group (Offset / Pin row); omitted when the adjacent group is empty in MVP |
| Shadow | `0 4px 12px rgba(0,0,0,0.4)` |

## Design sketches

- [`context-menu.png`](./visual/context-menu.png) — from `v930/task-context-menu` (see `visual/provenance.yaml`)
- [`v930/task-context-menu`](/docs/ui/source/v930/task-context-menu.jpeg) — full layout context

## Open

- **Q24** — zoom-history scope: is 撤销缩放 (undo-depth badge) in this library; what does 重置缩放 reset to and when is it enabled? See [OPEN_QUESTIONS Q24](../../../docs/context/OPEN_QUESTIONS.md). Interim: both items omitted from the MVP menu, no Ctrl+Z binding.
- **Q25** — Offset action contract (dialog vs auto-align). See [OPEN_QUESTIONS Q25](../../../docs/context/OPEN_QUESTIONS.md). Interim: item omitted from the MVP menu.

## Changelog
- **2026-08-24** — Initial spec from v930 reference design.
- **2026-08-25** — PR #33 review: ACs aligned to the Q24–Q26 MVP interim, `target` typed `SwimEvent`, pin/collapse separated, Open section added.
- **2026-08-27** — Re-review: menu rows 2–3 corrected from the crop to 撤销缩放 (2) / 重置缩放 (翻屏播放 and 置顶显示 were a misread); Q24 rewritten as zoom-history scope; Q26 resolved — Pin row is the only pin and moves to its own PR (ids 004/009 retired); `show-in-event-view` gains PR-CTXM-011 and an interim destination; SwimlaneCanvas `contextmenu` added as a cross-spec change.
