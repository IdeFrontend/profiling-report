# ContextMenu

| spec-id-prefix |
|----------------|
| PR-CTXM-*      |

A floating menu shown on right-click over a swimlane event or lane header, providing quick actions without navigating away from the timeline.

## Inputs

The component receives coordinates (`x`, `y`) for positioning and a context object describing what was right-clicked:
- `target: EventRef | null` — the clicked event (null for lane-level actions).
- `lane: string` — lane identifier (thread/process name).
- `visible: boolean` — controls mount/unmount.

When `target` is an event, all 7 items show. When `target` is null (lane header click), event-specific items are hidden (整屏显示, 翻屏播放, 在事件视图中显示).

## Outputs

- `emit('pin-row', lane: string)` — pin the lane to top of swimlane.
- `emit('hide-lane', lane: string)` — hide the lane from view.
- `emit('fit-to-screen', target: EventRef)` — zoom viewport to fit the event.
- `emit('scroll-playback', target: EventRef)` — start scroll playback from event.
- `emit('pin-to-top', target: EventRef)` — pin event to top.
- `emit('show-in-event-view', target: EventRef)` — navigate to event view tab.
- `emit('offset', lane: string)` — offset lane timing.
- `emit('close')` — menu dismissed (click-away or Escape).

## Behavior

### Menu items (source: v930/task-context-menu)

| # | Label           | Translation       | Shortcut | Scope       |
|---|-----------------|-------------------|----------|-------------|
| 1 | 整屏显示        | Fit to screen     |          | event       |
| 2 | 翻屏播放        | Scroll playback   | Ctrl+Z   | event       |
| 3 | 置顶显示        | Pin to top        |          | event       |
| 4 | 隐藏            | Hide              |          | lane        |
| 5 | 在事件视图中显示 | Show in event view |         | event       |
| 6 | Offset          | Offset            |          | lane        |
| 7 | Pin row         | Pin row           | Ctrl+P   | lane        |

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

## Acceptance Criteria

1. **PR-CTXM-001** — right-click on event shows menu at pointer coords with all 7 items.
1. **PR-CTXM-002** — right-click on lane header shows only lane-scope items (隐藏, Offset, Pin row).
1. **PR-CTXM-003** — clicking outside or pressing Escape dismisses the menu.
1. **PR-CTXM-004** — selecting "Pin row" emits `pin-row` with the lane identifier.
1. **PR-CTXM-005** — selecting "隐藏" emits `hide-lane` and the lane disappears from the swimlane.
1. **PR-CTXM-006** — selecting "整屏显示" emits `fit-to-screen` and the viewport zooms to fit the event.
1. **PR-CTXM-007** — keyboard navigation (↑↓ Enter Escape) works when menu is open.
1. **PR-CTXM-008** — menu clamps to viewport bounds (no overflow off-screen).
1. **PR-CTXM-009** — shortcuts Ctrl+P (Pin row) and Ctrl+Z (翻屏播放) work when menu is open.
1. **PR-CTXM-010** — scrolling the timeline dismisses the menu.

## Edge Cases

| State | Behavior |
|---|---|
| Right-click near right edge | Menu opens leftward |
| Right-click near bottom edge | Menu opens upward |
| Right-click while another menu is open | Previous menu closes, new one opens |
| Right-click on collapsed group header | Lane-scope items only |
| Event spans multiple lanes | Uses the lane under the pointer |

## Dependencies

- `SwimlaneCanvas` — emits the right-click event with coordinates and hit-test result.
- `ProfilingReport` — handles emitted actions (pin-row mutates collapsed state, hide-lane filters model).
- `EventRef` type from `src/domain/types.ts`.

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
| Separator | `1px solid var(--pr-border-subtle)` between items 5–6 |
| Shadow | `0 4px 12px rgba(0,0,0,0.4)` |

## Design sketches

- [`context-menu.png`](./visual/context-menu.png) — from `v930/task-context-menu` (see `visual/provenance.yaml`)
- [`v930/task-context-menu`](/docs/ui/source/v930/task-context-menu.jpeg) — full layout context

## Changelog
- **2026-08-24** — Initial spec from v930 reference design.
