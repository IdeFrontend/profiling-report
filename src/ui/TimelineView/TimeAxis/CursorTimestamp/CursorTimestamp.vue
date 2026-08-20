<template>
  <div
    class="pr-cursor"
    data-testid="cursor-line"
    :style="{ left: `${xRatio * 100}%` }"
  >
    <!-- Stem under axis Δt (z-index 4); axis bars are 5 — stem stays below both. -->
    <div
      class="pr-cursor__stem"
      aria-hidden="true"
    />
    <span
      class="pr-cursor__label"
      data-testid="cursor-label"
      :class="{ 'pr-cursor__label--above': labelAbove }"
    >{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    xRatio: number;
    label: string;
    /** Park the time pill above the axis (e.g. when it would cover measure chrome). */
    labelAbove?: boolean;
  }>(),
  { labelAbove: false },
);
</script>

<style scoped>
.pr-cursor {
  position: absolute;
  top: 0;
  /* Extend through axis border-bottom so the stem meets the canvas line (no 1px gap). */
  bottom: -1px;
  width: 1px;
  pointer-events: none;
  /*
   * No z-index on the wrapper — stem and label stack independently against measure chrome
   * (axis bars 5, arrow/Δt 4; swimlane borders 3). left = xRatio% places the left edge at cursor x.
   * Canvas stroke uses x+0.5 so it covers [x, x+1] — same column. Do not translateX(-0.5).
   */
}

.pr-cursor__stem {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  background: #317af7;
  /* Under axis Δt (4) and axis bars (5); swimlane borders share 3. */
  z-index: 3;
}

.pr-cursor__label {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translate(-50%, 0);
  padding: 1px 8px;
  min-width: 72px;
  box-sizing: border-box;
  text-align: center;
  background: #317af7;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  border-radius: 4px;
  line-height: 1.35;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  transition: transform 180ms ease;
  /* Above measure Δt so the raised (or in-track) pill is never crossed by the stem alone. */
  z-index: 6;
}

.pr-cursor__label--above {
  /* Keep top fixed; animate transform only so the pill clears the axis top. */
  transform: translate(-50%, calc(-100% - 6px));
}

@media (prefers-reduced-motion: reduce) {
  .pr-cursor__label {
    transition: none;
  }
}
</style>
