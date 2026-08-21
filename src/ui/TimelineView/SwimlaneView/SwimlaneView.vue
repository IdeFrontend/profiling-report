<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  DEFAULT_DEPENDENCY_DEPTH,
  type DependencyMode,
  type MeasureRange,
  type SwimEvent,
  type SwimlaneModel,
  type SwimlaneViewState,
  type TimeDisplayMode,
  type TimeScaleUnit,
} from '../../../domain/types';
import LaneGutter, { type GutterGroup } from './LaneGutter/LaneGutter.vue';
import SwimlaneCanvas from './SwimlaneCanvas/SwimlaneCanvas.vue';

const props = withDefaults(
  defineProps<{
    groups: GutterGroup[];
    collapsedIds: string[];
    model: SwimlaneModel | null;
    view: SwimlaneViewState;
    selectedEventId: string | null;
    hoveredEventId: string | null;
    searchQuery: string;
    measureMode?: boolean;
    measureRange?: MeasureRange | null;
    timeDisplayMode?: TimeDisplayMode;
    timeScaleUnit?: TimeScaleUnit;
    clockFreqMHz?: number;
    dependencyMode?: DependencyMode;
    dependencyDepth?: number;
    preferRenderer?: 'auto' | 'webgl' | 'canvas';
  }>(),
  {
    dependencyMode: 'all',
    dependencyDepth: DEFAULT_DEPENDENCY_DEPTH,
    timeDisplayMode: 'time',
    timeScaleUnit: 'ms',
  },
);

const emit = defineEmits<{
  'update:scrollY': [scrollY: number];
  'toggle-group': [groupId: string];
  select: [event: SwimEvent | null];
  hover: [event: SwimEvent | null, clientX: number, clientY: number];
  cursor: [payload: { time: number; xRatio: number } | null];
  pan: [deltaTime: number];
  zoom: [factor: number, anchorTime: number];
  'set-playhead': [time: number];
  'update:measure-range': [range: MeasureRange | null];
}>();

const gutterRef = ref<{ root: HTMLElement | null } | null>(null);

watch(
  () => props.view.scrollY,
  (y) => {
    const el = gutterRef.value?.root;
    if (el && Math.abs(el.scrollTop - y) > 0.5) {
      el.scrollTop = y;
    }
  },
);

function onScrollY(scrollY: number) {
  emit('update:scrollY', Math.max(0, scrollY));
}

function onGutterScroll(): void {
  const el = gutterRef.value?.root;
  if (!el) return;
  if (Math.abs(el.scrollTop - props.view.scrollY) > 0.5) {
    onScrollY(el.scrollTop);
  }
}

defineExpose({
  get gutterRoot() {
    return gutterRef.value?.root ?? null;
  },
});
</script>

<template>
  <div class="pr-swim-row pr-swim-row--body">
    <LaneGutter
      ref="gutterRef"
      :groups="groups"
      :collapsed-ids="collapsedIds"
      @scroll="onGutterScroll"
      @toggle-group="emit('toggle-group', $event)"
    />
    <SwimlaneCanvas
      :model="model"
      :view="view"
      :selected-event-id="selectedEventId"
      :hovered-event-id="hoveredEventId"
      :search-query="searchQuery"
      :measure-mode="measureMode"
      :measure-range="measureRange"
      :time-display-mode="timeDisplayMode"
      :time-scale-unit="timeScaleUnit"
      :clock-freq-m-hz="clockFreqMHz"
      :dependency-mode="dependencyMode"
      :dependency-depth="dependencyDepth"
      :prefer-renderer="preferRenderer ?? 'auto'"
      @select="emit('select', $event)"
      @hover="(ev, x, y) => emit('hover', ev, x, y)"
      @cursor="emit('cursor', $event)"
      @set-playhead="emit('set-playhead', $event)"
      @pan="emit('pan', $event)"
      @zoom="(f, a) => emit('zoom', f, a)"
      @scroll-y="onScrollY"
      @update:measure-range="emit('update:measure-range', $event)"
    />
  </div>
</template>

<style scoped>
.pr-swim-row {
  display: grid;
  grid-template-columns: var(--pr-gutter-width, 280px) 1fr;
  gap: 0;
  align-items: stretch;
  min-height: 0;
}

.pr-swim-row--body {
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 900px) {
  .pr-swim-row {
    grid-template-columns: 1fr;
  }
}
</style>
