<script setup lang="ts">
import type { DependencyLink } from '../../../../swimlane/dependencyLinks';

defineProps<{
  links: DependencyLink[];
  width: number;
  height: number;
}>();
</script>

<template>
  <svg
    class="pr-dep-links"
    data-testid="dependency-links-layer"
    :viewBox="`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        v-for="(link, i) in links"
        :id="`pr-dep-grad-${i}`"
        :key="i"
        gradientUnits="userSpaceOnUse"
        :x1="link.x0"
        :y1="link.y0"
        :x2="link.x1"
        :y2="link.y1"
      >
        <stop
          offset="0%"
          :stop-color="link.fromColor"
        />
        <stop
          offset="100%"
          :stop-color="link.toColor"
        />
      </linearGradient>
    </defs>
    <path
      v-for="(link, i) in links"
      :key="i"
      class="pr-dep-links__curve"
      :d="link.d"
      :stroke="`url(#pr-dep-grad-${i})`"
    />
  </svg>
</template>

<style scoped>
.pr-dep-links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}

.pr-dep-links__curve {
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
