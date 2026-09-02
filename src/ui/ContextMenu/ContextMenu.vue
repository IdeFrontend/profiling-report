<!--
  Floating right-click menu for the swim timeline — MVP interim.
  Spec: ./ContextMenu.spec.md (PR-CTXM-001…011). Items are decided from the
  hit-test payload: an event hit shows 整屏显示 / 隐藏 / 在事件视图中显示;
  a lane-header hit (event === null, laneId != null) shows 隐藏 only.
  Pin row, 撤销/重置缩放, Offset are deferred to follow-up PRs.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { SwimEvent } from '../../domain/types';
import { t } from '../../i18n';

type MenuKey = 'fit-to-screen' | 'hide-lane' | 'show-in-event-view';
type MenuItem = { key: MenuKey; label: string };

const props = withDefaults(
  defineProps<{
    /** ClientX of the right-click. */
    x: number;
    /** ClientY of the right-click. */
    y: number;
    /** Event under the pointer, or null for a lane-header / empty hit. */
    event: SwimEvent | null;
    /** Leaf lane under the pointer, or null when the menu should not open. */
    laneId: string | null;
    /** When true (timeline scrolling) the menu dismisses itself. */
    dismissOnScroll?: boolean;
    /** Locale for labels. */
    locale?: string;
  }>(),
  { locale: 'zh-CN' },
);

const emit = defineEmits<{
  /** 隐藏 — drop the leaf lane from the swim body. */
  'hide-lane': [laneId: string];
  /** 整屏显示 — zoom viewport to fit the event's [startTime, startTime+duration]. */
  'fit-to-screen': [target: SwimEvent];
  /** 在事件视图中显示 — interim: select the event and mount DetailPanel. */
  'show-in-event-view': [target: SwimEvent];
  /** User dismissed the menu without picking an item. */
  'close': [];
}>();

/** Which items to show. On an event hit the event group + lane group render;
 *  on a lane-header hit only 隐藏 (event-scope items hidden). */
const items = computed<MenuItem[]>(() => {
  const isEvent = props.event != null;
  const out: MenuItem[] = [{ key: 'hide-lane', label: t('hideLane', props.locale) }];
  if (isEvent) {
    out.unshift({ key: 'fit-to-screen', label: t('fitToScreen', props.locale) });
    out.push({ key: 'show-in-event-view', label: t('showInEventView', props.locale) });
  }
  return out;
});

/** Refs — root for clamp, item buttons for keyboard focus. */
const rootRef = ref<HTMLDivElement | null>(null);
const itemRefs = ref<HTMLButtonElement[]>([]);
const focusedIndex = ref(0);

/** Position after clamp (computed once on mount + on resize). `null` until mounted. */
const positioned = ref<{ left: number; top: number; placement: string } | null>(null);

function clampToViewport(): void {
  const node = rootRef.value;
  if (!node) return;
  // Fixed-position clientX/Y are the natural spot. Re-clamp on every layout.
  const { innerWidth: vw, innerHeight: vh } = window;
  const margin = 4;
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const left = Math.min(Math.max(margin, props.x), Math.max(margin, vw - w - margin));
  const top = Math.min(Math.max(margin, props.y), Math.max(margin, vh - h - margin));
  // opens leftward when the natural right edge would clip
  const placement = props.x + w > vw ? 'left' : 'right';
  // opens upward when the natural bottom edge would clip
  const placementY = props.y + h > vh ? 'up' : 'down';
  positioned.value = {
    left,
    top,
    placement: `${placement}-${placementY}`,
  };
}

watch(
  () => [props.x, props.y, items.value.length],
  () => {
    // Reset clamp on any input change; happens on re-open (new payload) too.
    positioned.value = null;
    nextTick(clampToViewport);
  },
  { immediate: true },
);

function onWindowResize(): void {
  clampToViewport();
}

window.addEventListener('resize', onWindowResize);

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  document.removeEventListener('keydown', onDocumentKeydown, true);
  // Timeline scrolls emit through the host; we listen while mounted.
  window.removeEventListener('scroll', onWindowScroll, true);
});

/* ----- outside click + Escape + scroll dismissal ----- */

function onDocumentPointerDown(e: PointerEvent): void {
  const node = rootRef.value;
  if (!node) return;
  if (node.contains(e.target as Node)) return;
  emit('close');
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    emit('close');
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveFocus(1);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveFocus(-1);
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    activate(focusedIndex.value);
  }
}

function onWindowScroll(): void {
  if (props.dismissOnScroll === false) return;
  emit('close');
}

function moveFocus(delta: number): void {
  const len = items.value.length;
  if (len === 0) return;
  focusedIndex.value = (focusedIndex.value + delta + len) % len;
  itemRefs.value[focusedIndex.value]?.focus();
}

function activate(index: number): void {
  const item = items.value[index];
  if (!item) return;
  if (item.key === 'fit-to-screen' && props.event) {
    emit('fit-to-screen', props.event);
    return;
  }
  if (item.key === 'hide-lane' && props.laneId) {
    emit('hide-lane', props.laneId);
    return;
  }
  if (item.key === 'show-in-event-view' && props.event) {
    emit('show-in-event-view', props.event);
  }
}

/* ----- mount hooks: attach listeners, focus first item ----- */

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('keydown', onDocumentKeydown, true);
  window.addEventListener('scroll', onWindowScroll, true);
  nextTick(() => {
    clampToViewport();
    itemRefs.value[focusedIndex.value]?.focus();
  });
});
</script>

<template>
  <div
    v-if="event != null || laneId != null"
    ref="rootRef"
    class="pr-context-menu"
    :data-placement="positioned?.placement"
    data-testid="context-menu"
    :style="{
      left: positioned ? `${positioned.left}px` : `${x}px`,
      top: positioned ? `${positioned.top}px` : `${y}px`,
    }"
    role="menu"
    @contextmenu.prevent
  >
    <button
      v-for="(item, idx) in items"
      :key="item.key"
      :ref="(el) => { if (el) itemRefs[idx] = el as HTMLButtonElement; }"
      type="button"
      class="pr-context-menu__item"
      :data-testid="`context-menu-item-${item.key}`"
      role="menuitem"
      @click="activate(idx)"
      @mouseenter="focusedIndex = idx"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.pr-context-menu {
  position: fixed;
  z-index: 30;
  min-width: 180px;
  padding: 4px 0;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  font-size: 13px;
  color: #e8e8e8;
}

.pr-context-menu__item {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 40px 0 12px;
  text-align: left;
  background: transparent;
  border: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.pr-context-menu__item:hover,
.pr-context-menu__item:focus {
  outline: none;
  background: #3a3a3a;
}
</style>
