# ContextMenu

| spec-id-prefix |
|----------------|
| PR-CTXM-*      |

Right-click menu for a swimlane event or lane, routing viewport, selection, visibility, and pin actions to the owning report state.

## Inputs

**context** is either absent (menu closed) or `{ target: SwimEvent | null, x: number, y: number, laneId: string }` from a canvas or leaf lane-header hit test. **x** and **y** are client viewport coordinates (`PointerEvent.clientX` / `clientY`). **target** is the event beneath the pointer; `null` identifies a leaf lane-header or empty portion of a leaf lane. **laneId** is a leaf lane id resolved from the swim tree, not from `SwimEvent`.

The parent supplies **view** (`SwimlaneViewWindow`, for Fit to screen and scroll-change detection), **selectedEventId**, **hiddenLaneIds**, and **pinnedLaneIds** so each available action reflects report state.

**Forwarding.** A main gutter header follows `LaneGutterNode` → `LaneGutter` → `SwimlaneView`; the pinned-strip header uses its direct `LaneGutterNode` child in `SwimlaneView`. Main and pinned `SwimlaneCanvas` instances emit directly to `SwimlaneView`. `SwimlaneView` forwards every invocation to `TimelineView`, which forwards it to `ProfilingReport`; the root owns the one menu context and action handling.

## Outputs

**action** reports `{ command: 'fit' | 'show' | 'hide' | 'pin', laneId: string, target?: SwimEvent }`. The parent applies shared view-state behavior: `'fit'` uses `zoomToFitWindow`; `'hide'` uses `hideLane`; `'show'` reuses the report's normal `select` path with **target** (so `selectedEventId`, `DetailPanel`, and `select` emit stay consistent); `'pin'` toggles the shared **pinnedLaneIds** list.

**dismiss** reports closure after click-outside, Escape, an item activation, or any change to **scrollY** (gutter wheel, canvas wheel, trackpad pan, W/S/A/D, zoom-to-fit, collapse, etc.).

## Behavior

### Menu contents

For an event target, the menu orders available commands by scope: event-scope **整屏显示** (Fit to screen), **在事件视图中显示** (Show in event view); then lane-scope **隐藏** (Hide lane), **Pin row** (Ctrl+P). A separator divides non-empty event and lane groups. A lane-header or empty portion of a leaf lane shows only lane-scope commands, with no separator.

Fit to screen has the same result as the existing toolbar action: it frames the model time window and resets vertical scroll. Show in event view selects the target event via the report's normal `select` handler (so `selectedEventId`, the detail dock, and the `select` emit stay consistent). Hide adds the lane id to **hiddenLaneIds** without folding the swim tree; the gutter, main canvas/body, and pinned strip omit hidden lanes. Pin row toggles the existing pin state; it is an alternate affordance, not a second pin list.

**撤销缩放** (Undo zoom, depth badge, Ctrl+Z), **重置缩放** (Reset zoom), and **Offset** are deferred pending UI-48 / UI-49. They are not rendered and their shortcuts are inactive. Copy name is out of scope.

### Invocation, position, and dismissal

The menu opens at pointer coordinates, clamped inside the viewport; it opens upward or leftward when the default position would overflow below or right.

The menu closes on click outside, Escape, item activation, and every forwarded **update:scrollY** change (gutter, main or pinned canvas, Card strip, or parent update). Arrow Up and Arrow Down move active-item focus; Enter activates it. Ctrl+P activates Pin row only while the menu is open and Pin row is available, and suppresses the browser Print shortcut.

#### Hidden-lane behavior

A hidden lane is removed from the gutter and main canvas/body, and from the pinned strip if it was pinned. The pin id remains in **pinnedLaneIds** while hidden, so a later `unhideLane` restores the row to both the tree and the pinned strip. Collapsing an ancestor still hides the original row but leaves the pinned-strip duplicate visible per [`SwimlaneView.spec.md`](../TimelineView/SwimlaneView/SwimlaneView.spec.md).

## Acceptance Criteria

1. **PR-CTXM-001** — Event menu groups available commands.
2. **PR-CTXM-002** — Lane menu omits event commands.
3. **PR-CTXM-003** — Fit matches toolbar framing.
4. **PR-CTXM-004** — Hide updates independent lane visibility.
5. **PR-CTXM-005** — Show reuses report selection path for target event.
6. **PR-CTXM-006** — Pin toggles shared pin state.
7. **PR-CTXM-007** — Deferred commands remain absent.
8. **PR-CTXM-008** — Viewport clamp avoids menu overflow.
9. **PR-CTXM-009** — Dismisses on outside, Escape, scrollY change.
10. **PR-CTXM-010** — Keyboard navigation activates commands.
11. **PR-CTXM-011** — Ctrl+P prevents browser print.

## Edge Cases

| State | Behavior |
|---|---|
| `target` is `null` | Show lane-scope commands only. |
| Target event no longer exists | Dismiss without selecting. |
| Lane no longer exists or is non-leaf | Dismiss without action. |
| Lane already hidden | Hide action is unavailable. |
| Lane already pinned | Pin row unpins it. |
| Pinned lane hidden | Removed from pinned strip until restored. |
| Viewport too small | Clamp within every viewport edge. |

## Dependencies

[view-state.spec.md](../../../specs/core/view-state.spec.md), [SwimlaneCanvas.spec.md](../TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.md), [LaneGutter.spec.md](../TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [SwimlaneView.spec.md](../TimelineView/SwimlaneView/SwimlaneView.spec.md), and [DetailPanel.spec.md](../DetailPanel/DetailPanel.spec.md). Canvas covers the events chart; LaneGutter covers leaf lane headers.

Pin state is shared with the gutter pushpin per [view-state.spec.md](../../../specs/core/view-state.spec.md). Menu item scope supersedes the looser Context menu wording in [INTERACTIONS.md](../../../docs/ui/INTERACTIONS.md).

## Open

- UI-48 defines zoom history, Undo zoom, and Reset zoom scope.
- UI-49 defines Offset action contract.
- Restore UI for hidden lanes is not present; session reset is the current unhide path.

## Visual

| Element | Normative value |
|---|---|
| Surface | `var(--pr-surface-overlay)` background, `6px` radius, `4px 0` padding, `0 4px 12px rgba(0,0,0,0.4)` shadow |
| Item | `32px` height; `8px 40px 8px 12px` padding; `13px` text |
| Hover | `var(--pr-surface-hover)` |
| Disabled | `var(--pr-text-secondary)` |
| Shortcut | `var(--pr-text-secondary)` |
| Separator | `1px solid var(--pr-border-subtle)` between non-empty scope groups |

## Design sketches

- [context-menu](./visual/context-menu.png) — from `v930/task-context-menu`
- [Task context menu](../../../docs/ui/source/v930/task-context-menu.jpeg) — full frame

Design hierarchy: [docs/ui/DESIGN_INDEX.md](../../../docs/ui/DESIGN_INDEX.md).

## Changelog
- **2026-09-08** — Initial spec.
