<template>
  <div
    class="pr-cursor"
    data-testid="cursor-line"
    :style="{ left: `${xRatio * 100}%` }"
  >
    <span
      class="pr-cursor__label"
      data-testid="cursor-label"
    >{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  xRatio: number;
  label: string;
}>();
</script>

<style scoped>
.pr-cursor {
  position: absolute;
  top: 0;
  /* Extend through axis border-bottom so the stem meets the canvas line (no 1px gap). */
  bottom: -1px;
  width: 1px;
  background: #317af7;
  pointer-events: none;
  z-index: 5;
  /*
   * left = xRatio% places the left edge at cursor x.
   * Canvas stroke uses x+0.5 so it covers [x, x+1] — same column. Do not translateX(-0.5).
   */
}

.pr-cursor__label {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
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
}
</style>
