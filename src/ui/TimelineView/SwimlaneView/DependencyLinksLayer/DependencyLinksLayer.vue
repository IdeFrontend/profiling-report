<script setup lang="ts">
defineProps<{
  paths: string[];
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
    <path
      v-for="(d, i) in paths"
      :key="i"
      class="pr-dep-links__curve"
      :d="d"
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
  stroke: var(--pr-color-mov, #b868f8);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
