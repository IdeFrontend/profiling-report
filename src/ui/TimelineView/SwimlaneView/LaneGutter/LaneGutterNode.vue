<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { laneCategoryLabel, t } from '../../../../i18n';
import { LANE_HEIGHT, type CollapseAnimState } from '../../../../swimlane/layout';
import Chevron from '../../../Chevron.vue';
import PinIcon from '../../../PinIcon.vue';
import type { GutterBarDisplay, GutterLane } from './gutterTypes';

/** Match EventTooltip offset; delay avoids flicker while scanning the gutter. */
const UTIL_TIP_DELAY_MS = 400;
const UTIL_TIP_CURSOR_OFFSET_PX = 12;

const props = defineProps<{
  lane: GutterLane;
  depth: number;
  collapsedIds?: string[];
  pinnedLaneIds?: string[];
  /** Lane id under canvas/gutter hover — row highlight only (not pushpin). */
  hoveredLaneId?: string | null;
  locale?: string;
  /** Average marker position (%); omit to hide midline on this row. */
  utilMidlinePercent?: number;
  /** In-flight lane collapse/expand tween (see layout.CollapseAnimState). */
  collapseAnim?: CollapseAnimState | null;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  'pin-lane': [id: string];
  'unpin-lane': [id: string];
  /** Whole-lane hover (AC-07): drive track highlight from gutter pointer. */
  'lane-hover': [id: string | null];
  'context-menu': [payload: { x: number; y: number; laneId: string }];
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
const utilTipVisible = ref(false);
const utilTipPos = ref({ left: '0px', top: '0px' });
let utilTipTimer: ReturnType<typeof setTimeout> | null = null;

const laneExternallyHovered = computed(
  () => props.hoveredLaneId != null && props.hoveredLaneId === props.lane.id,
);
/** Leaf/folder share the same indent; pin is absolute at gutter left. */
const pad = computed(() => `${24 + props.depth * 14}px`);
/** Multi-row leaf renders one tall title cell; folders/spacer leaves stay LANE_HEIGHT. */
const rowHeightPx = computed(() => `${(props.lane.rowCount ?? 1) * LANE_HEIGHT}px`);
/** Thick: folders or depth-0 leaves (通信/储存HBM); thin: pipe leaves under Core. */
const isThinUtil = computed(() => !(isFolder.value || props.depth === 0));
const utilSizeClass = computed(() =>
  isThinUtil.value ? 'pr-gutter__util--thin' : 'pr-gutter__util--thick',
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

const canShowUtilTip = computed(
  () => isThinUtil.value && displayBar.value != null && displayBar.value.label.length > 0,
);

const showUtilTip = computed(() => canShowUtilTip.value && utilTipVisible.value);

function clearUtilTipTimer() {
  if (utilTipTimer != null) {
    clearTimeout(utilTipTimer);
    utilTipTimer = null;
  }
}

function setUtilTipPos(clientX: number, clientY: number) {
  utilTipPos.value = {
    left: `${clientX + UTIL_TIP_CURSOR_OFFSET_PX}px`,
    top: `${clientY + UTIL_TIP_CURSOR_OFFSET_PX}px`,
  };
}

function onLanePointerEnter() {
  emit('lane-hover', props.lane.id);
}

function onUtilPointerEnter(e: PointerEvent) {
  scheduleUtilTip(e.clientX, e.clientY);
}

function onUtilPointerMove(e: PointerEvent) {
  if (!canShowUtilTip.value) return;
  setUtilTipPos(e.clientX, e.clientY);
}

function onUtilPointerLeave() {
  hideUtilTip();
}

function scheduleUtilTip(clientX: number, clientY: number) {
  if (!canShowUtilTip.value) return;
  setUtilTipPos(clientX, clientY);
  clearUtilTipTimer();
  utilTipTimer = setTimeout(() => {
    utilTipVisible.value = true;
    utilTipTimer = null;
  }, UTIL_TIP_DELAY_MS);
}

function hideUtilTip() {
  clearUtilTipTimer();
  utilTipVisible.value = false;
}

function onUtilFocusIn(e: FocusEvent) {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  scheduleUtilTip(r.left + r.width / 2, r.top + r.height / 2);
}

function onUtilFocusOut() {
  hideUtilTip();
}

function onLanePointerLeave() {
  emit('lane-hover', null);
  hideUtilTip();
}

function fillColor(bar: GutterBarDisplay): string {
  if (bar.thresholdColor) {
    return bar.barWidth < 50 ? UTIL_RED : UTIL_GRAY;
  }
  return bar.relativeMax ? UTIL_RED : UTIL_GRAY;
}

function onContextMenu(e: MouseEvent): void { e.preventDefault(); emit('context-menu', { x: e.clientX, y: e.clientY, laneId: props.lane.id }); }

function onPinClick(e: MouseEvent) {
  e.stopPropagation();
  if (isPinned.value) emit('unpin-lane', props.lane.id);
  else emit('pin-lane', props.lane.id);
}

const midlineStyle = computed(() =>
  props.utilMidlinePercent != null ? { left: `${props.utilMidlinePercent}%` } : { display: 'none' },
);

/** Height/opacity of the collapsible wrapper while this folder is animating. */
function collapseStyle(id: string): Record<string, string> | undefined {
  const anim = props.collapseAnim;
  if (!anim || anim.groupId !== id || anim.hiddenHeight <= 0) return undefined;
  return {
    height: `${Math.max(0, anim.hiddenHeight * anim.visible)}px`,
    opacity: `${Math.max(0, Math.min(1, anim.visible))}`,
    overflow: 'hidden',
  };
}

onBeforeUnmount(() => {
  clearUtilTipTimer();
});
</script>

<template>
  <button
    v-if="isFolder"
    type="button"
    class="pr-gutter__lane pr-gutter__lane--folder"
    :class="{ 'pr-gutter__lane--lane-hover': laneExternallyHovered }"
    :style="{ paddingLeft: pad }"
    :data-testid="`gutter-folder-${lane.id}`"
    :aria-expanded="!isCollapsed"
    @click="emit('toggle', lane.id)"
    @pointerenter="emit('lane-hover', lane.id)"
    @pointerleave="emit('lane-hover', null)"
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
      <span class="pr-gutter__util-track">
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
      </span>
      <span
        v-if="!isThinUtil"
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
  <div
    v-if="isFolder"
    class="pr-gutter__collapse"
    :data-testid="`gutter-collapse-${lane.id}`"
    :style="collapseStyle(lane.id)"
  >
    <template v-if="!isCollapsed">
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
        :collapse-anim="collapseAnim"
        @toggle="(id) => emit('toggle', id)"
        @pin-lane="(id) => emit('pin-lane', id)"
        @unpin-lane="(id) => emit('unpin-lane', id)"
        @lane-hover="(id) => emit('lane-hover', id)"
        @context-menu="(payload) => emit('context-menu', payload)"
      />
    </template>
  </div>
  <div
    v-else
    class="pr-gutter__lane"
    :class="{
      'pr-gutter__lane--lane-hover': laneExternallyHovered,
      'pr-gutter__lane--pinned': isPinned,
    }"
    :style="{ paddingLeft: pad, height: rowHeightPx, flex: `0 0 ${rowHeightPx}` }"
    :data-testid="`gutter-lane-${lane.id}`"
    @pointerenter="onLanePointerEnter"
    @pointerleave="onLanePointerLeave"
    @contextmenu="onContextMenu"
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
        class="pr-gutter__tip pr-gutter__pin-tip"
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
      :tabindex="canShowUtilTip ? 0 : undefined"
      :aria-label="canShowUtilTip ? displayBar.label : undefined"
      @pointerenter="onUtilPointerEnter"
      @pointermove="onUtilPointerMove"
      @pointerleave="onUtilPointerLeave"
      @focusin="onUtilFocusIn"
      @focusout="onUtilFocusOut"
    >
      <span class="pr-gutter__util-track">
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
      </span>
      <span
        v-if="!isThinUtil"
        class="pr-gutter__util-pct"
      >{{ displayBar.label }}</span>
    </span>
    <span
      v-else
      class="pr-gutter__util pr-gutter__util--empty"
      :class="utilSizeClass"
      aria-hidden="true"
    />
    <Teleport to="body">
      <span
        v-if="showUtilTip && displayBar"
        class="pr-gutter__tip pr-gutter__util-tip"
        role="tooltip"
        data-testid="lane-util-tip"
        :style="utilTipPos"
      >{{ displayBar.label }}</span>
    </Teleport>
  </div>
</template>

<style scoped>
/* Wraps a folder's descendant rows so the collapse tween can animate height + opacity;
   `overflow: hidden` is applied inline only while animating so the pin tooltip stays unclipped. */
.pr-gutter__collapse {
  flex: 0 0 auto;
  min-width: 0;
}

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

.pr-gutter__tip {
  position: absolute;
  z-index: 2;
  padding: 4px 8px;
  /* Follows EventTooltip's chrome; raised-surface token under AC-09. */
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

.pr-gutter__pin-tip {
  /* Pin sits flush-left; center would clip past the gutter edge. */
  left: 0;
  bottom: calc(100% + 6px);
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
  border-radius: 4px;
}

.pr-gutter__util-track {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: repeating-linear-gradient(
    -45deg,
    #3a3a3a 0,
    #3a3a3a 1px,
    var(--pr-util-track) 1px,
    var(--pr-util-track) 4px
  );
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
   and the bar stops reading as a bar. Hit target stretches to the lane top/bottom so the
   value tip opens when the pointer is above/below the 8px paint (title column still excluded). */
.pr-gutter__util--thin {
  align-self: stretch;
  height: auto;
  display: flex;
  align-items: center;
  border-radius: 0;
  background: transparent;
}

.pr-gutter__util--thin .pr-gutter__util-track {
  position: relative;
  inset: auto;
  width: 100%;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 2px;
}

.pr-gutter__util--empty {
  background: transparent;
}

.pr-gutter__util--empty .pr-gutter__util-track {
  display: none;
}

.pr-gutter__util-tip {
  position: fixed;
  z-index: 20;
  font-variant-numeric: tabular-nums;
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
