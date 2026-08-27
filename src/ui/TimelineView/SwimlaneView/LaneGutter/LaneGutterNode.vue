<script setup lang="ts">
import { computed, ref } from 'vue';
import { laneCategoryLabel, t } from '../../../../i18n';
import Chevron from '../../../Chevron.vue';
import PinIcon from '../../../PinIcon.vue';
import type { GutterBarDisplay, GutterLane } from './gutterTypes';

const props = defineProps<{
  lane: GutterLane;
  depth: number;
  collapsedIds?: string[];
  pinnedLaneIds?: string[];
  /** Leaf id under canvas hover — gutter row highlight only (not pushpin). */
  hoveredLaneId?: string | null;
  locale?: string;
  /** Average marker position (%); omit to hide midline on this row. */
  utilMidlinePercent?: number;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  'pin-lane': [id: string];
  'unpin-lane': [id: string];
}>();

const collapsed = computed(() => new Set(props.collapsedIds ?? []));
const pinned = computed(() => new Set(props.pinnedLaneIds ?? []));
const isFolder = computed(() => props.lane.children !== undefined);
const isCollapsed = computed(() => collapsed.value.has(props.lane.id));
const isPinned = computed(() => pinned.value.has(props.lane.id));
const pinLabel = computed(() => t('pin', props.locale));
const displayName = computed(() =>
  laneCategoryLabel(props.lane.categoryKey, props.lane.name, props.locale),
);
const pinPointerHover = ref(false);
const laneExternallyHovered = computed(
  () => !isFolder.value && props.hoveredLaneId != null && props.hoveredLaneId === props.lane.id,
);
/** Leaf/folder share the same indent; pin is absolute at gutter left. */
const pad = computed(() => `${24 + props.depth * 14}px`);
/** Thick: folders or depth-0 leaves (通信/储存HBM); thin: pipe leaves under Core. */
const utilSizeClass = computed(() =>
  isFolder.value || props.depth === 0 ? 'pr-gutter__util--thick' : 'pr-gutter__util--thin',
);

/** AC-11's tints. The bar composites them over an opaque base rather than over the
 *  track, so the hatch marks what is left to fill and stops at the filled edge. */
const UTIL_RED = 'rgba(231, 67, 74, 0.4)';
const UTIL_GRAY = 'rgba(255, 255, 255, 0.08)';

const displayBar = computed((): GutterBarDisplay | null => {
  if (props.lane.bar) return props.lane.bar;
  if (props.lane.utilization != null) {
    const barWidth = Math.round(props.lane.utilization * 100);
    return {
      barWidth,
      label: `${barWidth}%`,
      thresholdColor: true,
    };
  }
  return null;
});

function fillColor(bar: GutterBarDisplay): string {
  if (bar.thresholdColor) {
    return bar.barWidth <= 50 ? UTIL_RED : UTIL_GRAY;
  }
  return bar.relativeMax ? UTIL_RED : UTIL_GRAY;
}

function onPinClick(e: MouseEvent) {
  e.stopPropagation();
  if (isPinned.value) emit('unpin-lane', props.lane.id);
  else emit('pin-lane', props.lane.id);
}

const midlineStyle = computed(() =>
  props.utilMidlinePercent != null ? { left: `${props.utilMidlinePercent}%` } : { display: 'none' },
);
</script>

<template>
  <button
    v-if="isFolder"
    type="button"
    class="pr-gutter__lane pr-gutter__lane--folder"
    :style="{ paddingLeft: pad }"
    :data-testid="`gutter-folder-${lane.id}`"
    :aria-expanded="!isCollapsed"
    @click="emit('toggle', lane.id)"
  >
    <span class="pr-gutter__lane-main">
      <Chevron
        class="pr-gutter__chevron"
        :expanded="!isCollapsed"
      />
      <span
        class="pr-gutter__name"
        :title="displayName"
      >{{ displayName }}</span>
    </span>
    <span
      v-if="displayBar"
      class="pr-gutter__util"
      :class="utilSizeClass"
      data-testid="lane-util"
    >
      <span
        class="pr-gutter__util-fill"
        :style="{
          width: `${Math.min(100, Math.max(0, displayBar.barWidth))}%`,
          '--pr-util-fill': fillColor(displayBar),
        }"
      />
      <span
        v-if="utilMidlinePercent != null"
        class="pr-gutter__util-mid"
        :style="midlineStyle"
        aria-hidden="true"
      />
      <span
        v-if="utilSizeClass === 'pr-gutter__util--thick'"
        class="pr-gutter__util-pct"
      >{{ displayBar.label }}</span>
    </span>
    <span
      v-else
      class="pr-gutter__util pr-gutter__util--empty"
      :class="utilSizeClass"
      aria-hidden="true"
    />
  </button>
  <template v-if="isFolder && !isCollapsed">
    <LaneGutterNode
      v-for="child in lane.children"
      :key="child.id"
      :lane="child"
      :depth="depth + 1"
      :collapsed-ids="collapsedIds"
      :pinned-lane-ids="pinnedLaneIds"
      :hovered-lane-id="hoveredLaneId"
      :locale="locale"
      :util-midline-percent="utilMidlinePercent"
      @toggle="(id) => emit('toggle', id)"
      @pin-lane="(id) => emit('pin-lane', id)"
      @unpin-lane="(id) => emit('unpin-lane', id)"
    />
  </template>
  <div
    v-else-if="!isFolder"
    class="pr-gutter__lane"
    :class="{
      'pr-gutter__lane--lane-hover': laneExternallyHovered,
      'pr-gutter__lane--pinned': isPinned,
    }"
    :style="{ paddingLeft: pad }"
    :data-testid="`gutter-lane-${lane.id}`"
  >
    <button
      type="button"
      class="pr-gutter__pin"
      data-testid="lane-pin"
      :aria-label="pinLabel"
      :aria-pressed="isPinned"
      @click="onPinClick"
      @pointerenter="pinPointerHover = true"
      @pointerleave="pinPointerHover = false"
      @focus="pinPointerHover = true"
      @blur="pinPointerHover = false"
    >
      <PinIcon :filled="isPinned || pinPointerHover" />
      <span
        v-if="pinPointerHover"
        class="pr-gutter__pin-tip"
        role="tooltip"
      >{{ pinLabel }}</span>
    </button>
    <span class="pr-gutter__lane-main">
      <span
        class="pr-gutter__name"
        :title="displayName"
      >{{ displayName }}</span>
    </span>
    <span
      v-if="displayBar"
      class="pr-gutter__util"
      :class="utilSizeClass"
      data-testid="lane-util"
    >
      <span
        class="pr-gutter__util-fill"
        :style="{
          width: `${Math.min(100, Math.max(0, displayBar.barWidth))}%`,
          '--pr-util-fill': fillColor(displayBar),
        }"
      />
      <span
        v-if="utilMidlinePercent != null"
        class="pr-gutter__util-mid"
        :style="midlineStyle"
        aria-hidden="true"
      />
      <span
        v-if="utilSizeClass === 'pr-gutter__util--thick'"
        class="pr-gutter__util-pct"
      >{{ displayBar.label }}</span>
    </span>
    <span
      v-else
      class="pr-gutter__util pr-gutter__util--empty"
      :class="utilSizeClass"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.pr-gutter__lane {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 6px;
  align-items: center;
  flex: 0 0 22px;
  height: 22px;
  min-height: 22px;
  padding: 0 8px 0 24px;
  border-bottom: 1px solid #3a3a3a;
  width: 100%;
  margin: 0;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  background: #1f1f1f;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: default;
  position: relative;
}

.pr-gutter__lane--folder {
  cursor: pointer;
}

/* AC-07/AC-19 crops both measure #363636 on the hovered row — the raised-surface
   token, not the #252525 the pin slice first guessed. */
.pr-gutter__lane:hover,
.pr-gutter__lane--lane-hover {
  background: var(--pr-surface-raised, #363636);
}

/* AC-19: hover lifts the label off its resting grey as well as revealing the pin. */
.pr-gutter__lane:hover .pr-gutter__name,
.pr-gutter__lane--lane-hover .pr-gutter__name {
  color: #fff;
}

.pr-gutter__lane-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pr-gutter__pin {
  box-sizing: border-box;
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  visibility: hidden;
  opacity: 0;
}

.pr-gutter__lane:hover .pr-gutter__pin,
.pr-gutter__lane--pinned .pr-gutter__pin,
.pr-gutter__pin:focus-visible {
  visibility: visible;
  opacity: 1;
}

.pr-gutter__pin-tip {
  position: absolute;
  /* Pin sits flush-left; center would clip past the gutter edge. */
  left: 0;
  bottom: calc(100% + 6px);
  z-index: 2;
  padding: 4px 8px;
  /* Follows EventTooltip's chrome, as the pin spec asks; that chrome moved to the
     raised-surface token under AC-09, and the design crop measures the same #363636. */
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  line-height: 1.2;
  color: #e8e8e8;
  white-space: nowrap;
  pointer-events: none;
}

.pr-gutter__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 400;
  color: #b0b0b0;
}

.pr-gutter__util {
  /* Shared with the fill's opaque base, so the two can never drift apart. */
  --pr-util-track: #2a2a2a;

  position: relative;
  display: block;
  box-sizing: border-box;
  width: 110px;
  background: repeating-linear-gradient(
    -45deg,
    #3a3a3a 0,
    #3a3a3a 1px,
    var(--pr-util-track) 1px,
    var(--pr-util-track) 4px
  );
  border-radius: 4px;
  overflow: hidden;
}

.pr-gutter__util-mid {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed rgba(255, 255, 255, 0.1);
  pointer-events: none;
  z-index: 1;
}

.pr-gutter__util--thick {
  height: 16px;
}

/* Half the height, so half the radius: 4px on an 8px bar rounds the ends into a stadium
   and the bar stops reading as a bar. */
.pr-gutter__util--thin {
  height: 8px;
  border-radius: 2px;
}

.pr-gutter__util--empty {
  background: transparent;
}

/* Opaque under the tint, so the track's hatch reads as "still to fill" and stops dead at
   the filled edge. Letting it run on through the fill — which it did — left the bar with
   one texture end to end and only a colour change to show how far along it was. */
.pr-gutter__util-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  min-width: 0;
  border-radius: 0;
  background-color: var(--pr-util-track);
  background-image: linear-gradient(var(--pr-util-fill), var(--pr-util-fill));
}

.pr-gutter__util-pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #b0b0b0;
  line-height: 1;
  pointer-events: none;
  z-index: 2;
}
</style>
