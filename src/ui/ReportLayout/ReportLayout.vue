<script setup lang="ts">
defineProps<{
  showAside: boolean;
}>();
</script>

<template>
  <div
    class="pr-layout"
    :class="{ 'pr-layout--no-aside': !showAside }"
  >
    <section class="pr-main">
      <slot name="main" />
    </section>
    <slot
      v-if="showAside"
      name="aside"
    />
  </div>
</template>

<style scoped>
.pr-layout {
  display: grid;
  grid-template-columns: 1fr minmax(300px, 360px);
  gap: 0;
  flex: 1 1 auto;
  min-height: 0;
  border-top: 1px solid #3a3a3a;
}

.pr-layout--no-aside {
  grid-template-columns: 1fr;
}

.pr-main {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  min-height: 0;
  background: var(--pr-bg-panel);
  padding: 0;
  border-right: 1px solid #3a3a3a;
  overflow: hidden;
}

@media (max-width: 900px) {
  .pr-layout {
    grid-template-columns: 1fr;
  }

  .pr-main {
    border-right: none;
  }
}
</style>
