<script setup lang="ts">
import type { AxisRulerMajor, AxisRulerMinor } from '../../../../domain/axisRuler';

defineProps<{
  majors: AxisRulerMajor[];
  minors: AxisRulerMinor[];
  baseLabel?: string | null;
}>();
</script>

<template>
  <div
    class="pr-axis-ruler"
    :class="{ 'pr-axis-ruler--has-base': baseLabel }"
    data-testid="axis-ruler"
  >
    <div
      v-if="baseLabel"
      class="pr-axis-ruler__base-col"
    >
      <span
        class="pr-axis-ruler__base"
        data-testid="axis-ruler-base"
      >{{ baseLabel }}</span>
      <span
        class="pr-axis-ruler__base-sep"
        aria-hidden="true"
      >+</span>
    </div>
    <div
      class="pr-axis-ruler__track"
      data-testid="axis-ruler-track"
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
        <span
          v-show="!maj.hideLabel"
          class="pr-axis-ruler__label"
        >{{ maj.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-axis-ruler {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  pointer-events: none;
  z-index: 1;
  overflow: hidden;
}

.pr-axis-ruler__base-col {
  flex: 0 1 auto;
  max-width: 42%;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding-left: 4px;
  min-width: 0;
}

.pr-axis-ruler__base {
  box-sizing: border-box;
  height: 18px;
  display: flex;
  align-items: center;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #e0e0e0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.pr-axis-ruler__base-sep {
  flex: 0 0 auto;
  height: 18px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  color: #666;
}

.pr-axis-ruler__track {
  flex: 1 1 0;
  min-width: 0;
  position: relative;
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
</style>
