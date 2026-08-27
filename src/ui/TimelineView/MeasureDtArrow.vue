<script setup lang="ts">
import { MEASURE_ARROW_HEAD_PX } from './cursorMeasureOverlap';

withDefaults(
  defineProps<{
    /** Pre-formatted Δt duration label (e.g. `3.0ms`). */
    label: string;
    /** Inline positioning (left/width as %) — parent computes narrow/outside/offscreen layout. */
    style: Record<string, string>;
    mode: 'inline' | 'outside' | 'shaft' | 'offscreen';
    side?: 'left' | 'right';
    showLeftHead: boolean;
    showRightHead: boolean;
    /** Only the time axis renders the label as a clickable focus target. */
    interactive?: boolean;
  }>(),
  {
    side: 'right',
    interactive: false,
  },
);

const emit = defineEmits<{
  activate: [];
}>();
</script>

<template>
  <div
    class="pr-measure-arrow"
    data-testid="measure-arrow"
    :class="{
      'pr-measure-arrow--interactive': interactive,
      'pr-measure-arrow--outside': mode === 'outside' || mode === 'shaft',
      'pr-measure-arrow--shaft': mode === 'shaft',
      'pr-measure-arrow--outside-right': (mode === 'outside' || mode === 'shaft') && side === 'right',
      'pr-measure-arrow--outside-left': (mode === 'outside' || mode === 'shaft') && side === 'left',
      'pr-measure-arrow--offscreen': mode === 'offscreen',
      'pr-measure-arrow--offscreen-left': mode === 'offscreen' && side === 'left',
      'pr-measure-arrow--offscreen-right': mode === 'offscreen' && side === 'right',
      'pr-measure-arrow--no-left-head': !showLeftHead,
      'pr-measure-arrow--no-right-head': !showRightHead,
    }"
    :style="style"
  >
    <!--
      Flex: tip pad 1px | head | shaft | 4px | label | 4px | shaft | head
      Shaft negative margin pulls into chevron so the line meets the arms.
      Outside: label parked outside; arrow spans the bars (or no connector when too narrow).
      Offscreen: one head pointing off-view + Δt just inside the near edge (no edge bar).
    -->
    <svg
      v-if="showLeftHead || (mode === 'offscreen' && side === 'left')"
      class="pr-measure-arrow__head"
      data-testid="measure-arrow-head"
      :viewBox="`0 0 ${MEASURE_ARROW_HEAD_PX} 10`"
      :width="MEASURE_ARROW_HEAD_PX"
      height="10"
      aria-hidden="true"
    >
      <path
        d="M8 1.5 L2 5 L8 8.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="butt"
        stroke-linejoin="miter"
        stroke-miterlimit="8"
      />
    </svg>
    <div
      v-if="mode !== 'offscreen'"
      class="pr-measure-arrow__shaft pr-measure-arrow__shaft--left"
      data-testid="measure-arrow-shaft"
    />
    <span
      class="pr-measure-arrow__label"
      data-testid="measure-label"
      :role="interactive ? 'button' : undefined"
      :tabindex="interactive ? 0 : undefined"
      :title="interactive ? 'Focus measure range' : undefined"
      @pointerdown="interactive && $event.stopPropagation()"
      @click="interactive && emit('activate')"
      @keydown.enter.prevent="interactive && emit('activate')"
      @keydown.space.prevent="interactive && emit('activate')"
    >{{ label }}</span>
    <div
      v-if="mode !== 'offscreen'"
      class="pr-measure-arrow__shaft pr-measure-arrow__shaft--right"
      data-testid="measure-arrow-shaft"
    />
    <svg
      v-if="showRightHead || (mode === 'offscreen' && side === 'right')"
      class="pr-measure-arrow__head"
      data-testid="measure-arrow-head"
      :viewBox="`0 0 ${MEASURE_ARROW_HEAD_PX} 10`"
      :width="MEASURE_ARROW_HEAD_PX"
      height="10"
      aria-hidden="true"
    >
      <path
        d="M1 1.5 L7 5 L1 8.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="butt"
        stroke-linejoin="miter"
        stroke-miterlimit="8"
      />
    </svg>
  </div>
</template>

<style scoped>
.pr-measure-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 1px;
  pointer-events: none;
  z-index: 4;
  color: rgba(49, 122, 247, 1);
}

.pr-measure-arrow__shaft {
  flex: 1 1 0;
  min-width: 0;
  height: 1.5px;
  background: currentColor;
  position: relative;
  z-index: 0;
}

.pr-measure-arrow__shaft--left {
  /* Pull into left chevron toward tip; 4px clear before label. */
  margin-left: -6px;
  margin-right: 4px;
}

.pr-measure-arrow__shaft--right {
  margin-left: 4px;
  margin-right: -6px;
}

.pr-measure-arrow__head {
  flex: 0 0 auto;
  display: block;
  overflow: visible;
  position: relative;
  z-index: 1;
}

.pr-measure-arrow__label {
  flex: 0 0 auto;
  padding: 1px 8px;
  border-radius: 3px;
  background: rgba(49, 122, 247, 1);
  color: #ffffff;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  position: relative;
  z-index: 2;
}

/* Time-axis measure label only — gap hover overlay stays pointer-transparent. */
.pr-measure-arrow--interactive .pr-measure-arrow__label {
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.pr-measure-arrow--interactive .pr-measure-arrow__label:hover,
.pr-measure-arrow--interactive .pr-measure-arrow__label:focus-visible {
  background: rgba(77, 148, 255, 1);
  outline: none;
}

/* Label outside the range; arrow still spans the bars. */
.pr-measure-arrow--outside {
  overflow: visible;
}

.pr-measure-arrow--outside .pr-measure-arrow__shaft--left {
  margin-right: 0;
}

.pr-measure-arrow--outside .pr-measure-arrow__shaft--right {
  margin-left: 0;
}

.pr-measure-arrow--outside .pr-measure-arrow__label {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.pr-measure-arrow--outside-right .pr-measure-arrow__label {
  left: 100%;
  margin-left: 4px;
}

.pr-measure-arrow--outside-left .pr-measure-arrow__label {
  right: 100%;
  margin-right: 4px;
  transform: translateY(-50%);
}

/* Too narrow for heads: hide chevrons and shaft; outside Δt label only. */
.pr-measure-arrow--shaft .pr-measure-arrow__head,
.pr-measure-arrow--shaft .pr-measure-arrow__shaft {
  display: none;
}

/* Clipped true edge: no arrowhead; shaft meets the view edge cleanly. */
.pr-measure-arrow--no-left-head .pr-measure-arrow__shaft--left {
  margin-left: 0;
}

.pr-measure-arrow--no-right-head .pr-measure-arrow__shaft--right {
  margin-right: 0;
}

/* Fully off-screen: one chevron + Δt parked just inside the near view edge. */
.pr-measure-arrow--offscreen {
  overflow: visible;
  width: auto;
  padding: 0 1px;
}

.pr-measure-arrow--offscreen-left .pr-measure-arrow__label {
  margin-left: 4px;
}

.pr-measure-arrow--offscreen-right {
  transform: translateX(-100%);
}

.pr-measure-arrow--offscreen-right .pr-measure-arrow__label {
  margin-right: 4px;
}
</style>
