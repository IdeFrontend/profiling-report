# ContextMenu

| spec-id-prefix |
|----------------|
| PR-CTXMENU-*   |

Right-click menu for a swimlane event or lane, routing viewport, selection, and pin actions to the owning report state.

## Inputs

**context** is either absent (menu closed) or `{ target: SwimEvent | null, x: number, y: number, laneId: string }` from a canvas or leaf lane-header hit test. **x** and **y** are client viewport coordinates (`PointerEvent.clientX` / `clientY`). **target** is the event beneath the pointer; `null` identifies a leaf lane-header or empty portion of a leaf lane. **laneId** is a leaf lane id, except a collapsed-folder summary-bar target carries its owning folder id so Show in event view remains reachable; Pin row rejects that non-leaf id.

The parent applies shared view-state behavior directly from `contextMenuContext`/`viewState` in `ProfilingReport.vue`; the component receives only **context**, **pinnedLaneIds**, and **locale** as props.

**Forwarding.** A main gutter header follows `LaneGutterNode` → `LaneGutter` → `SwimlaneView`; the pinned-strip header uses its direct `LaneGutterNode` child in `SwimlaneView`. Main and pinned `SwimlaneCanvas` instances emit directly to `SwimlaneView`. `SwimlaneView` forwards every invocation to `TimelineView`, which forwards it to `ProfilingReport`; the root owns the one menu context and action handling.

## Outputs

**action** reports `{ command: 'reset' | 'show' | 'pin', laneId: string, target?: SwimEvent }`. The parent applies shared view-state behavior: `'reset'` uses `zoomToFitWindow`; `'show'` reuses the report's normal `select` path with **target** (so `selectedEventId`, `DetailPanel`, and `select` emit stay consistent); `'pin'` toggles the shared **pinnedLaneIds** list.

**dismiss** reports closure after click-outside, Escape, an item activation, or any change to **scrollY** (gutter wheel, canvas wheel, trackpad pan, W/S/A/D, zoom-to-fit, collapse, etc.).

## Behavior

### Menu contents

For an event target, the menu orders available commands by scope: event-scope **重置缩放** (Reset zoom), **在事件视图中显示** (Show in event view); then lane-scope **置顶行** / **取消置顶行** (Pin row / Unpin row, Ctrl+P). A separator divides non-empty event and lane groups. A lane-header or empty portion of a leaf lane shows only lane-scope commands, with no separator.

Reset zoom has the same result as the existing toolbar action: it frames the model time window and resets vertical scroll via `zoomToFitWindow` + `animateToWindow`. Show in event view selects the target event via the report's normal `select` handler (so `selectedEventId`, the detail dock, and the `select` emit stay consistent). A collapsed-folder **summary bar** target is never itself selected: with a single underlying leaf (`taskCount === 1`) Show resolves to `target.sourceEvent`; a multi-task summary bar has no single event, so Show dismisses without selecting. Pin row toggles the existing pin state; it is an alternate affordance, not a second pin list.

**撤销缩放** (Undo zoom, depth badge, Ctrl+Z), **隐藏** (Hide lane), and **Offset** are deferred pending product decisions. They are not rendered and their shortcuts are inactive. Copy name is out of scope.

### Invocation, position, and dismissal

The menu opens at pointer coordinates, clamped inside the viewport; it opens upward or leftward when the default position would overflow below or right.

The menu closes on click outside, Escape, item activation, and every forwarded **update:scrollY** change (gutter, main or pinned canvas, Card strip, or parent update). Arrow Up and Arrow Down move active-item focus; Enter activates it. Ctrl+P activates Pin row only while the menu is open and Pin row is available, and suppresses the browser Print shortcut.

## Acceptance Criteria

1. **PR-CTXMENU-001** — Event menu groups available commands.
2. **PR-CTXMENU-002** — Lane menu omits event commands.
3. **PR-CTXMENU-003** — Reset zoom matches toolbar framing.
4. **PR-CTXMENU-004** — Show reuses report selection path for target event.
5. **PR-CTXMENU-005** — Pin toggles shared pin state.
6. **PR-CTXMENU-006** — Deferred commands remain absent.
7. **PR-CTXMENU-007** — Viewport clamp uses rendered menu dimensions.
8. **PR-CTXMENU-008** — Dismisses on outside, Escape, scrollY change.
9. **PR-CTXMENU-009** — Keyboard navigation focuses and activates commands.
10. **PR-CTXMENU-010** — Ctrl+P prevents browser print.
11. **PR-CTXMENU-011** — Leaf-gutter invocations reach the report root.
12. **PR-CTXMENU-012** — Show on a summary-bar target resolves its sole leaf (or dismisses without selecting when multi-task).

## Edge Cases

| State | Behavior |
|---|---|
| `target` is `null` | Show lane-scope commands only. |
| Target event no longer exists | Dismiss without selecting. Checked against leaf events and collapsed-folder `summaryEvents` (`findEventInModel`). |
| Lane no longer exists or is non-leaf | Dismiss without action. |
| Lane already pinned | Pin row unpins it. |
| Viewport too small | Clamp within every viewport edge. |

## Dependencies

[view-state.spec.md](../../../specs/core/view-state.spec.md), [SwimlaneCanvas.spec.md](../TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.md), [LaneGutter.spec.md](../TimelineView/SwimlaneView/LaneGutter/LaneGutter.spec.md), [SwimlaneView.spec.md](../TimelineView/SwimlaneView/SwimlaneView.spec.md), and [DetailPanel.spec.md](../DetailPanel/DetailPanel.spec.md). Canvas covers the events chart; LaneGutter covers leaf lane headers.

Pin state is shared with the gutter pushpin per [view-state.spec.md](../../../specs/core/view-state.spec.md). Menu item scope supersedes the looser Context menu wording in [INTERACTIONS.md](../../../docs/ui/INTERACTIONS.md).

## Open

- UI-48 defines zoom history and Undo zoom scope.
- UI-49 defines Offset action contract.
- UI-50 defines Hide lane contract and restore path.

## Visual

| Element | Normative value |
|---|---|
| Surface | `var(--pr-surface-raised)` background, `6px` radius, `4px 0` padding, `0 4px 12px rgba(0,0,0,0.4)` shadow |
| Item | `32px` height; `8px 40px 8px 12px` padding; `13px` text |
| Hover | `var(--pr-surface-hover)` |
| Disabled | `var(--pr-tab-inactive)` |
| Shortcut | `var(--pr-tab-inactive)` |
| Separator | `1px solid var(--pr-divider)` between non-empty scope groups |

## Design sketches

- [context-menu](./visual/context-menu.png) — from `v930/task-context-menu`
- [Task context menu](../../../docs/ui/source/v930/task-context-menu.jpeg) — full frame

Design hierarchy: [docs/ui/DESIGN_INDEX.md](../../../docs/ui/DESIGN_INDEX.md).

## Changelog
- **2026-09-10** — Show on a collapsed-folder summary-bar target resolves `sourceEvent` (single-task) or dismisses without selecting (multi-task); summary-bar canvas invocation carries its folder id while Pin row still rejects non-leaf lanes; stale-target check uses `findEventInModel` (leaf events + `summaryEvents`) instead of leaf-only lookup (`PR-CTXMENU-012`, `PR-CANVAS-077`).
- **2026-09-10** — Right-click on canvas guards `e.button !== 0` and resolves leaf lane ids only; menu focus is captured and restored on close; menu stays hidden until repositioned to avoid a reopen flash; dedicated `--pr-surface-hover` token replaces `--pr-divider` for hover fill.
- **2026-09-10** — Renamed acceptance criteria to `PR-CTXMENU-*`; placement measures the rendered menu and all surface tokens are defined in `tokens.css`.
- **2026-09-09** — Trim scope to Reset zoom, Show in event view, Pin row; defer Hide lane.
- **2026-09-08** — Initial spec.
