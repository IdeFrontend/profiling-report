<script setup lang="ts">
import { computed, ref } from 'vue';
import { ASIDE_WIDTH_DEFAULT } from '../panelResize';

const props = withDefaults(
  defineProps<{
    showAside: boolean;
    asideWidth?: number;
  }>(),
  {
    asideWidth: ASIDE_WIDTH_DEFAULT,
  },
);

const layoutStyle = computed(() =>
  props.showAside
    ? ({ '--pr-aside-width': `${props.asideWidth}px` } as Record<string, string>)
    : undefined,
);

const rootEl = ref<HTMLElement | null>(null);
defineExpose({ rootEl });
</script>

<template>
  <div
    ref="rootEl"
    class="pr-layout"
    :class="{ 'pr-layout--no-aside': !showAside }"
    :style="layoutStyle"
  >
    <section class="pr-main">
      <slot name="main" />
    </section>
    <div
      v-if="showAside"
      class="pr-layout__aside"
    >
      <slot name="aside" />
    </div>
  </div>
</template>

<style scoped>
.pr-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--pr-aside-width, 468px);
  gap: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
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
  background: var(--pr-bg-deep);
  padding: 0;
  border-right: 1px solid #3a3a3a;
  /* Visible so overview handles / cursor pill can paint over the aside seam. */
  overflow: visible;
  position: relative;
  z-index: 1;
}

.pr-layout__aside {
  position: relative;
  z-index: 0;
  flex-shrink: 0;
  width: var(--pr-aside-width, 468px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--pr-bg-aside);
}
</style>
