<script setup lang="ts">
/**
 * Root host entry stub. Real props/emits arrive with the UI-shell slice.
 * Milestone 1: mountable placeholder for playground + component smoke tests.
 */
defineProps<{
  /** Optional label shown in the scaffold placeholder. */
  title?: string;
}>();
</script>

<template>
  <div
    class="pr-root"
    data-testid="profiling-report"
  >
    <p class="pr-root__title">
      {{ title ?? 'profiling-report' }}
    </p>
    <p class="pr-root__hint">
      Scaffold placeholder — feature UI lands in later TDD slices.
    </p>
  </div>
</template>

<style scoped>
.pr-root {
  box-sizing: border-box;
  min-height: 120px;
  padding: 16px;
  color: #e8e8e8;
  background: #303030;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.pr-root__title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.pr-root__hint {
  margin: 0;
  font-size: 13px;
  opacity: 0.75;
}
</style>
