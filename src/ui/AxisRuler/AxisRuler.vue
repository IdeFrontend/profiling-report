<script setup lang="ts">
import type { AxisRulerMajor, AxisRulerMinor } from '../../domain/axisRuler';

defineProps<{
  majors: AxisRulerMajor[];
  minors: AxisRulerMinor[];
}>();
</script>

<template>
  <div
    class="pr-axis-ruler"
    data-testid="axis-ruler"
  >
    <span
      v-for="(m, i) in minors"
      :key="`min-${i}-${m.pct}`"
      class="pr-axis-ruler__minor"
      :class="{ 'pr-axis-ruler__minor--muted': m.muted }"
      data-testid="axis-ruler-minor"
      :style="{ left: `${m.pct}%` }"
    />
    <div
      v-for="(maj, i) in majors"
      :key="`maj-${i}-${maj.t}`"
      class="pr-axis-ruler__major"
      :class="{ 'pr-axis-ruler__major--muted': maj.muted }"
      data-testid="axis-ruler-major"
      :style="{ left: `${maj.pct}%` }"
    >
      <span
        class="pr-axis-ruler__bar"
        aria-hidden="true"
      />
      <span class="pr-axis-ruler__label">{{ maj.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.pr-axis-ruler {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.pr-axis-ruler__minor {
  position: absolute;
  bottom: 0;
  width: 1px;
  height: 7px;
  transform: translateX(-50%);
  background: #666;
}

.pr-axis-ruler__minor--muted {
  background: #4a4a4a;
}

.pr-axis-ruler__major {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 3px;
  /* Bar sits on pct; label extends to the right (VISUAL_SPEC). */
  transform: translateX(0);
}

.pr-axis-ruler__bar {
  flex: 0 0 auto;
  width: 1px;
  align-self: stretch;
  background: #a8a8a8;
}

.pr-axis-ruler__major--muted .pr-axis-ruler__bar {
  background: #666;
}

.pr-axis-ruler__label {
  flex: 0 0 auto;
  padding-top: 2px;
  font-size: 10px;
  line-height: 1.2;
  color: #c8c8c8;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pr-axis-ruler__major--muted .pr-axis-ruler__label {
  color: #666;
}
</style>
