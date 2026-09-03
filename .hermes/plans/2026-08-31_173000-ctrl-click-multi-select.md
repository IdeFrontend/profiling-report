# Plan: Add Ctrl+Left-Click to Toggle Multi-Selection

## Goal
Implement toggling of events in multi-selection using Ctrl + left-click in the timeline canvas, allowing users to add or remove individual nodes from the multi-selection without affecting marquee or single selection.

## Current Context / Assumptions
- The `SwimlaneCanvas.vue` component handles pointer events for marquee multi-selection and single selection.
- It receives `multiSelectedIds?: string[]` as a prop (current multi-selected event IDs).
- It emits `'multi-select': [events: SwimEvent[]]` for marquee selections and `'select': [event: SwimEvent | null]` for single selections.
- The parent component (`SwimlaneView.vue`) manages the `multiSelectedIds` state and passes it down as a prop.
- Hit-testing for an event under the pointer can be done via `eventsIntersectingRect` (already imported) with a 1x1 rectangle.
- The codebase uses Vue 3 with TypeScript and the Composition API (`<script setup lang="ts">`).
- Existing marquee selection uses a 4px click-vs-drag gate; we must preserve this for non-Ctrl clicks.
- Ctrl+left-click should not start a marquee, nor should it change the single selected event (`selectedEventId`).

## Architecture / Proposed Approach
1. **Detect Ctrl+left-click down**: In `onPointerDown`, store whether Ctrl key is pressed and left button used to prevent marquee initiation.
2. **Handle Ctrl+left-click up**: In `onPointerUp`, if no drag occurred (within 4px threshold) and Ctrl was pressed:
   - Perform hit-test to find topmost event under pointer.
   - Toggle its ID in the current `multiSelectedIds` array (from prop).
   - Emit new event `'update-multi-selected'` with the updated ID array.
3. **Update parent state**: In `SwimlaneView.vue`, listen for `'update-multi-selected'` and update local `multiSelectedIds` state (which flows back as prop).
4. **Preserve existing behavior**: Non-Ctrl clicks continue to trigger marquee (after drag) or single selection; marquee start is suppressed when Ctrl is down.

## Step-by-Step Tasks
All files are under `src/ui/TimelineView/SwimlaneView/` unless noted.

### 1. Modify SwimlaneCanvas.vue
#### a. Add state for Ctrl click tracking
After existing refs (around line 130), add:
```typescript
let ctrlClickPending = false;
/** True from Ctrl+pointerdown until pointerup — suppresses marquee and single select. */
```

#### b. Update onPointerDown
Locate the `onPointerDown` function (around line 1238). Inside, after setting `downX` and `lastPointerClientY`, add:
```typescript
  // Store Ctrl state for click handling
  ctrlClickPending = e.ctrlKey && e.button === 0;
  // If Ctrl is down, do not start marquee press tracking (marqueePressActive remains false)
  if (ctrlClickPending) {
    marqueePressActive = false; // suppress marquee
  }
```

#### c. Update onPointerUp
Locate the `onPointerUp` function (around line 1293). Inside the click detection block (where `!marqueePressActive && !measurePressActive && !Math.abs(downX - e.clientX) && !Math.abs(lastPointerClientY - e.clientY)`), add an else-branch for Ctrl clicks:
```typescript
      // ... existing single select branch (if !marqueePressActive && !measurePressActive && click)
      else {
        // Click without drag: check for Ctrl
        if (ctrlClickPending) {
          // Find event under pointer
          const target = activeCanvas();
          const localX = e.clientX - target.getBoundingClientRect().left;
          const localY = e.clientY - target.getBoundingClientRect().top;
          const rect = { x: localX, y: localY, width: 1, height: 1 };
          const model = props.model ?? [];
          const events = eventsIntersectingRect(rect, model, true); // sorted by z-index (top first)
          if (events.length > 0) {
            const eventId = events[0].id;
            const currentIds = props.multiSelectedIds ?? [];
            const index = currentIds.indexOf(eventId);
            const newIds = index === -1
              ? [...currentIds, eventId] // add
              : currentIds.filter((id, i) => i !== index); // remove by index
            emit('update-multi-selected', newIds);
          }
        }
        // Reset Ctrl state
        ctrlClickPending = false;
      }
```
After the existing `marqueePressActive = false;` line (around line 1300), add:
```typescript
    // Also reset Ctrl state on drag start
    ctrlClickPending = false;
```

#### d. Ensure marquee does not start when Ctrl is down
In the same `onPointerDown` function, after the `marqueePressActive = true;` line (around line 1250), guard it:
```typescript
  if (!ctrlClickPending) {
    marqueePressActive = true;
  }
```

### 2. Modify SwimlaneView.vue
#### a. Add handler for update-multi-selected
Locate the SwimlaneCanvas usage in the template (around line 200). Add the listener:
```html
<SwimlaneCanvas
  ...
  @update-multi-selected="onUpdateMultiSelected"
/>
```
#### b. Implement the handler
In the `<script setup>` section, add:
```typescript
const multiSelectedIds = ref<string[]>([]);
// ... existing props and state

function onUpdateMultiSelected(newIds: string[]) {
  multiSelectedIds.value = newIds;
}
```
Ensure the `multiSelectedIds` prop passed to SwimlaneCanvas is the ref:
```html
<SwimlaneCanvas
  :multi-selected-ids="multiSelectedIds"
  ...
/>
```

### 3. Write Unit Tests
Create new test cases in `src/ui/TimelineView/SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.spec.ts`:
- Test Ctrl+left-click on an event adds it to multi-selected ids.
- Test Ctrl+left-click on already selected event removes it.
- Test Ctrl+left-click on empty space does nothing.
- Test Ctrl+left-click does not start marquee.
- Test Ctrl+left-click does not change selectedEventId.

### 4. Verification Steps
After implementing, run:
- `npm run unit` -> should pass all tests.
- `npm run lint` -> no new errors.
- `npm run typecheck` -> no new errors.
- Manual verification: Open timeline, Ctrl+click events to toggle selection, verify MultiSelectSummary updates accordingly.

## Risks, Tradeoffs, and Open Questions
- **Risk**: Interfering with existing gesture logic (e.g., if Ctrl is used elsewhere). Mitigation: Only Ctrl+left-click is handled; other combinations (Ctrl+right, Ctrl+wheel) are ignored.
- **Tradeoff**: Emitting the entire multi-selected ids array on each toggle (vs. emitting just the toggled id). Chosen for simplicity and consistency with marquee emission (which sends full array).
- **Open Question**: Should Ctrl+left-click also clear the single selection? Current plan leaves `selectedEventId` unchanged; if multi-selection is active, single selection is likely irrelevant. We can revisit if UX feedback suggests otherwise.
- **Open Question**: What about Meta (Cmd) key on macOS? The requirement specifies Ctrl; we follow that. If platform-specific behavior is needed later, we can adjust (`e.ctrlKey || e.metaKey`).