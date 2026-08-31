<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import type { DependencyNeighbors } from '../../domain/dependencies';
import type { DependencyMode, SelectedEvent } from '../../domain/types';
import {
  DOCK_HEIGHT_DEFAULT,
  DOCK_HEIGHT_MAX,
  DOCK_HEIGHT_MIN,
  startHorizontalResize,
} from '../panelResize';
import DetailSummary from './DetailSummary/DetailSummary.vue';
import DetailParameter from './DetailParameter/DetailParameter.vue';
import DetailRelevant from './DetailRelevant/DetailRelevant.vue';

const props = withDefaults(
  defineProps<{
    selected: SelectedEvent;
    /** Display origin (usually model.minTime); start/end are relative to this. */
    timeOrigin?: number;
    locale?: string;
    /** Omitted when the report carries no dependency data — the column hides. */
    neighbors?: DependencyNeighbors;
    dependencyMode?: DependencyMode;
    height?: number;
  }>(),
  {
    height: DOCK_HEIGHT_DEFAULT,
    locale: undefined,
    neighbors: undefined,
    dependencyMode: 'all',
    timeOrigin: 0,
  },
);

const emit = defineEmits<{
  close: [];
  'update:dependencyMode': [mode: DependencyMode];
  'update:height': [height: number];
}>();

const dockStyle = computed(() => ({ height: `${props.height}px` }));

let session: ReturnType<typeof startHorizontalResize> | null = null;

function onResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  session = startHorizontalResize({
    startClientX: e.clientY,
    startWidth: props.height,
    min: DOCK_HEIGHT_MIN,
    // Never eat the whole window: leave room for the toolbar and some timeline even
    // when the ceiling constant is taller than the viewport.
    max: Math.min(DOCK_HEIGHT_MAX, Math.max(DOCK_HEIGHT_MIN, window.innerHeight - 160)),
    direction: -1, // drag the top edge: up → taller
    onChange: (h) => emit('update:height', h),
  });
  e.preventDefault();
}

function onResizePointerMove(e: PointerEvent) {
  session?.move(e.clientY);
}

function onResizePointerUp() {
  session?.end();
  session = null;
}
</script>

<template>
  <footer
    class="pr-detail-panel"
    data-testid="detail-panel"
    :style="dockStyle"
  >
    <button
      type="button"
      class="pr-detail-panel__resize"
      data-testid="detail-panel-resize-handle"
      :aria-label="t('resizeDock', locale)"
      :title="t('resizeDock', locale)"
      @pointerdown="onResizePointerDown"
      @pointermove="onResizePointerMove"
      @pointerup="onResizePointerUp"
      @pointercancel="onResizePointerUp"
    />
    <header class="pr-detail-panel__head">
      <span class="pr-detail-panel__tab">{{ t('details', locale) }}</span>
      <button
        type="button"
        class="pr-detail-panel__close"
        data-testid="detail-panel-close"
        :aria-label="t('closePanel', locale)"
        :title="t('closePanel', locale)"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <div
      class="pr-detail-panel__body"
      :class="{ 'pr-detail-panel__body--no-relevant': !neighbors }"
    >
      <DetailSummary
        :selected="selected"
        :time-origin="timeOrigin"
        :locale="locale"
      />
      <DetailParameter
        :args="selected.args"
        :locale="locale"
      />
      <DetailRelevant
        v-if="neighbors"
        :current-name="selected.name"
        :neighbors="neighbors"
        :mode="dependencyMode"
        :locale="locale"
        @update:mode="emit('update:dependencyMode', $event)"
      />
    </div>
  </footer>
</template>

<style scoped>
.pr-detail-panel {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  position: relative;
  /* Height is the `height` prop (drag the top edge to resize); a content-sized panel
     grows and shrinks with every selection, which shifts the whole timeline above it.
     Sketch proportion is ~247px at 1920 wide, and each column scrolls inside that. */
  background: var(--pr-bg-panel, #262626);
  border-top: 1px solid #3a3a3a;
}

/* Same 5px hit strip as the layout's column handles, turned on its side. */
.pr-detail-panel__resize {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ns-resize;
  transform: translateY(-50%);
  z-index: 6;
}

.pr-detail-panel__resize:hover,
.pr-detail-panel__resize:active {
  background: rgba(49, 122, 247, 0.35);
}

.pr-detail-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 0;
  border-bottom: 1px solid #3a3a3a;
}

.pr-detail-panel__tab {
  padding-bottom: 6px;
  /* Sketch marks the active tab with a light rule, not the playhead blue. */
  border-bottom: 2px solid #e8e8e8;
  font-size: 13px;
  font-weight: 600;
}

.pr-detail-panel__close {
  border: 0;
  background: transparent;
  color: #b0b0b0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.pr-detail-panel__close:hover {
  color: #f0f0f0;
}

.pr-detail-panel__body {
  display: grid;
  /* Sketch widths: narrow identity card, widest parameter list, then the graph. */
  grid-template-columns: minmax(200px, 0.8fr) minmax(240px, 1.5fr) minmax(280px, 1.2fr);
  gap: 0;
  align-items: stretch;
  /* Claim the height the dock's `height` prop gives us. Content-sized (`0 1 auto`),
     the body stayed ~173px however far the top edge was dragged, so every column —
     and the scroll area inside each — ignored the drag. */
  flex: 1 1 auto;
  padding: 8px 12px 12px;
  min-height: 0;
  overflow: auto;
}

/* No dependency data: drop the Relevent track so Parameter takes its width. */
.pr-detail-panel__body--no-relevant {
  grid-template-columns: minmax(200px, 0.8fr) minmax(240px, 1fr);
}
</style>
