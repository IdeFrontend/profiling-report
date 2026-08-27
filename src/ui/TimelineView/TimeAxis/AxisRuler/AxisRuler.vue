<script setup lang="ts">
import { computed } from 'vue';
import type { AxisRulerMajor, AxisRulerMinor } from '../../../../domain/axisRuler';

const props = defineProps<{
  majors: AxisRulerMajor[];
  minors: AxisRulerMinor[];
  baseLabel?: string | null;
}>();

/** Reserve left inset so the first tick label does not overlap the base. */
const baseInsetCh = computed(() => {
  const label = props.baseLabel?.trim();
  if (!label) return 0;
  return Math.max(7, label.length + 1);
});
</script>

<template>
  <div
    class="pr-axis-ruler"
    data-testid="axis-ruler"
    :style="baseInsetCh > 0 ? { paddingLeft: `calc(${baseInsetCh}ch + 4px)` } : undefined"
  >
    <span
      v-if="baseLabel"
      class="pr-axis-ruler__base"
      data-testid="axis-ruler-base"
    >{{ baseLabel }}</span>
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
  height: 5px;
  transform: translateX(-50%);
  background: var(--pr-axis-tick, rgb(52, 52, 52));
}

.pr-axis-ruler__minor--muted {
  background: var(--pr-axis-tick-muted, rgb(39, 39, 39));
}

.pr-axis-ruler__major {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 3px;
  /* Bar sits on pct; label extends to the right (AxisRuler.spec). */
  transform: translateX(0);
}

.pr-axis-ruler__bar {
  flex: 0 0 auto;
  width: 1px;
  align-self: stretch;
  background: var(--pr-axis-tick, rgb(52, 52, 52));
}

.pr-axis-ruler__major--muted .pr-axis-ruler__bar {
  background: var(--pr-axis-tick-muted, rgb(39, 39, 39));
}

.pr-axis-ruler__label {
  box-sizing: border-box;
  flex: 0 0 auto;
  height: 18px;
  display: flex;
  align-items: center;
  padding: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  color: #c8c8c8;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pr-axis-ruler__major--muted .pr-axis-ruler__label {
  color: #666;
}

.pr-axis-ruler__base {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  height: 18px;
  display: flex;
  align-items: center;
  padding: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  color: #c8c8c8;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  z-index: 2;
}
</style>
