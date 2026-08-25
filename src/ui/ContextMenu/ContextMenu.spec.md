# ContextMenu

| spec-id-prefix |
|----------------|
| PR-CTXM-*      |

A floating menu shown on right-click over a swimlane event or lane header, providing quick actions without navigating away from the timeline.

**MVP scope is narrower than the sketch.** Q24–Q26 are open, so 翻屏播放 (Scroll playback), Offset and 置顶显示 (Pin to top) are **not rendered in MVP** — see [Open](#open). The menu table below records the full sketch for when Product answers; the Acceptance Criteria describe the MVP interim only.

## Inputs

The component receives coordinates (`x`, `y`) for positioning and the hit-test result describing what was right-clicked:
- `target: SwimEvent | null` — the clicked event (null for lane-level actions).
- `laneId: string` — lane identifier (thread/process name).
- `visible: boolean` — controls mount/unmount.

`SwimEvent` is the event payload (`id`, `name`, `startTime`, `duration`), same as MultiSelectSummary — not `EventRef` (`{ tid, index }`), which is a dependency pointer into `thread.events`.

When `target` is an event, the menu shows the event group plus the lane group. When `target` is null (lane header click), every event-scope item is hidden (整屏显示, 在事件视图中显示 — plus the deferred 翻屏播放 and 置顶显示), leaving the lane group only.

## Outputs

MVP:
- `emit('pin-row', laneId: string)` — pin the lane to top of swimlane.
- `emit('hide-lane', laneId: string)` — hide the lane from view.
- `emit('fit-to-screen', target: SwimEvent)` — zoom viewport to fit the event.
- `emit('show-in-event-view', target: SwimEvent)` — navigate to event view tab.
- `emit('close')` — menu dismissed (click-away, Escape, or item selected).

Deferred until Product answers (no item renders, so no emit fires): `scroll-playback` (Q24), `offset` (Q25), `pin-to-top` (Q26 — collapses into `pin-row` as a synonym).

## Behavior

### Menu items (source: v930/task-context-menu)

| # | Label           | Translation       | Shortcut | Scope       | MVP |
|---|-----------------|-------------------|----------|-------------|-----|
| 1 | 整屏显示        | Fit to screen     |          | event       | yes |
| 2 | 翻屏播放        | Scroll playback   | Ctrl+Z   | event       | no — Q24 (action + binding unknown; Ctrl+Z collides with undo) |
| 3 | 置顶显示        | Pin to top        |          | event       | no — Q26 (synonym of Pin row until scope is clarified) |
| 4 | 隐藏            | Hide              |          | lane        | yes |
| 5 | 在事件视图中显示 | Show in event view |         | event       | yes |
| 6 | Offset          | Offset            |          | lane        | no — Q25 (dialog vs auto-align unknown) |
| 7 | Pin row         | Pin row           | Ctrl+P   | lane        | yes |

MVP renders four items on an event target (整屏显示, 在事件视图中显示, 隐藏, Pin row) and two on a lane header (隐藏, Pin row).

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
- Ctrl+P activates Pin row. Ctrl+Z is **not** bound in MVP (Q24).

## Acceptance Criteria

1. **PR-CTXM-001** — event right-click shows four MVP items at pointer.
1. **PR-CTXM-002** — lane header shows 隐藏 and Pin row only.
1. **PR-CTXM-003** — outside click or Escape dismisses.
1. **PR-CTXM-004** — Pin row emits `pin-row` with lane id.
1. **PR-CTXM-005** — 隐藏 emits `hide-lane`.
1. **PR-CTXM-006** — 整屏显示 emits `fit-to-screen`.
1. **PR-CTXM-007** — arrow / Enter / Escape navigation works.
1. **PR-CTXM-008** — menu clamps to viewport bounds.
1. **PR-CTXM-009** — Ctrl+P activates Pin row.
1. **PR-CTXM-010** — timeline scroll dismisses menu.

Deferred items carry no AC: 翻屏播放 + Ctrl+Z (Q24), Offset (Q25), 置顶显示 (Q26).

## Edge Cases

| State | Behavior |
|---|---|
| Right-click near right edge | Menu opens leftward |
| Right-click near bottom edge | Menu opens upward |
| Right-click while another menu is open | Previous menu closes, new one opens |
| Right-click on collapsed group header | Lane-scope items only |
| Event spans multiple lanes | Uses the lane under the pointer |

## Dependencies

- `SwimlaneCanvas` — emits the right-click with coordinates and the hit-test result (`{ event: SwimEvent | null, laneId: string }`).
- `ProfilingReport` — handles emitted actions.
- `SwimEvent` type from `src/domain/types.ts`.

### Cross-spec changes required

#### view-state — new fields

`SwimlaneViewState.pinnedLaneIds: string[]` and `SwimlaneViewState.hiddenLaneIds: string[]` (both default `[]`). Neither exists today.

**Pin is not collapse.** `pin-row` moves the lane to the top of the swimlane order and keeps it visible; it must not touch `collapsedIds` or the folder folding in `swimTree.ts`. `hide-lane` is a third, independent filter that removes the lane from the rendered model.

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
| Font size | `13px` |
| Shortcut color | `var(--pr-text-secondary)` |
| Separator | `1px solid var(--pr-border-subtle)` between the event group and the lane group |
| Shadow | `0 4px 12px rgba(0,0,0,0.4)` |

## Design sketches

- [`context-menu.png`](./visual/context-menu.png) — from `v930/task-context-menu` (see `visual/provenance.yaml`)
- [`v930/task-context-menu`](/docs/ui/source/v930/task-context-menu.jpeg) — full layout context

## Open

- **Q24** — 翻屏播放 (Scroll playback) semantics + Ctrl+Z binding. See [OPEN_QUESTIONS Q24](../../../docs/context/OPEN_QUESTIONS.md). Interim: item omitted from the MVP menu, no Ctrl+Z binding.
- **Q25** — Offset action contract (dialog vs auto-align). Interim: item omitted from the MVP menu.
- **Q26** — 置顶显示 (Pin to top) vs Pin row semantics. Interim: Pin row only; 置顶显示 is not rendered, so its synonym behavior never reaches an emit.

## Changelog
- **2026-08-24** — Initial spec from v930 reference design.
- **2026-08-25** — PR #33 review: ACs aligned to the Q24–Q26 MVP interim, `target` typed `SwimEvent`, pin/collapse separated, Open section added.
