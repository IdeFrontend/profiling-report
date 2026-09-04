<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import {
  ASIDE_WIDTH_DEFAULT,
  ASIDE_WIDTH_MAX,
  ASIDE_WIDTH_MIN,
  startHorizontalResize,
} from '../panelResize';

const props = withDefaults(
  defineProps<{
    showAside: boolean;
    asideWidth?: number;
    locale?: string;
  }>(),
  {
    asideWidth: ASIDE_WIDTH_DEFAULT,
  },
);

const emit = defineEmits<{
  'update:asideWidth': [width: number];
}>();

/** Track collapses to 0 and slides the aside in/out over the same 200ms as the dock. */
const layoutStyle = computed(
  () =>
    ({ '--pr-aside-width': props.showAside ? `${props.asideWidth}px` : '0px' } as Record<
      string,
      string
    >),
);

/** Suppress the grid-track transition while the user drags the resize handle. */
const isResizing = ref(false);

let session: ReturnType<typeof startHorizontalResize> | null = null;

function onAsideResizePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  isResizing.value = true;
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture?.(e.pointerId);
  session = startHorizontalResize({
    startClientX: e.clientX,
    startWidth: props.asideWidth,
    min: ASIDE_WIDTH_MIN,
    max: ASIDE_WIDTH_MAX,
    direction: -1, // drag left edge: left → wider
    onChange: (w) => emit('update:asideWidth', w),
  });
  e.preventDefault();
}

function onAsideResizePointerMove(e: PointerEvent) {
  session?.move(e.clientX);
}

function onAsideResizePointerUp() {
  session?.end();
  session = null;
  isResizing.value = false;
}

const rootEl = ref<HTMLElement | null>(null);
defineExpose({ rootEl });
</script>

<template>
  <div
    ref="rootEl"
    class="pr-layout"
    :class="{ 'pr-layout--resizing': isResizing }"
    :style="layoutStyle"
  >
    <section class="pr-main">
      <slot name="main" />
    </section>
    <Transition name="pr-aside">
      <div
        v-if="showAside"
        class="pr-layout__aside"
      >
        <button
          type="button"
          class="pr-layout__resize pr-layout__resize--aside"
          data-testid="aside-resize-handle"
          :aria-label="t('resizeSidebar', locale)"
          @pointerdown="onAsideResizePointerDown"
          @pointermove="onAsideResizePointerMove"
          @pointerup="onAsideResizePointerUp"
          @pointercancel="onAsideResizePointerUp"
        />
        <slot name="aside" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pr-layout {
  display: grid;
  /* minmax(0, …) lets both tracks compress under a narrow host — no horizontal scroll. */
  grid-template-columns: minmax(0, 1fr) minmax(0, var(--pr-aside-width, 0px));
  gap: 0;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  /* The aside track collapses 0 ↔ width in step with the aside's fade. */
  transition: grid-template-columns 200ms ease;
}

/* Resize drag drives the track directly — no 200ms lag behind the pointer. */
.pr-layout--resizing {
  transition: none;
}

.pr-aside-enter-active,
.pr-aside-leave-active {
  transition: opacity 200ms ease;
}

.pr-aside-enter-from,
.pr-aside-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pr-layout,
  .pr-aside-enter-active,
  .pr-aside-leave-active {
    transition: none;
  }
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
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--pr-bg-aside);
}

.pr-layout__resize {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 5px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  z-index: 6;
}

.pr-layout__resize--aside {
  left: 0;
  transform: translateX(-50%);
}

.pr-layout__resize:hover,
.pr-layout__resize:active {
  background: rgba(49, 122, 247, 0.35);
}
</style>
