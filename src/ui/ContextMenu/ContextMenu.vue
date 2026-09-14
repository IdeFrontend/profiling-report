<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { SwimEvent } from '../../domain/types';
import { t } from '../../i18n';

export interface ContextMenuContext {
  x: number;
  y: number;
  laneId: string;
  target: SwimEvent | null;
}

export type ContextMenuCommand = 'reset' | 'show' | 'pin';

export interface ContextMenuAction {
  command: ContextMenuCommand;
  laneId: string;
  target?: SwimEvent;
}

const props = withDefaults(
  defineProps<{
    context: ContextMenuContext | null;
    pinnedLaneIds: string[];
    /** Omit Pin row when the lane cannot be pinned (e.g. a summary-bar folder id). */
    canPin?: boolean;
    /** Show Reset zoom only when the current window differs from the total range. */
    canReset?: boolean;
    locale?: string;
  }>(),
  { canPin: true, canReset: false },
);

const emit = defineEmits<{
  action: [payload: ContextMenuAction];
  dismiss: [];
}>();

const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({ position: 'fixed', visibility: 'hidden' });
const activeIndex = ref(-1);
let restoreFocusEl: HTMLElement | null = null;

const items = computed(() => {
  const result: { command: ContextMenuCommand; label: string; shortcut?: string }[] = [];
  if (props.canReset) result.push({ command: 'reset', label: t('ctxResetZoom', props.locale) });
  if (props.context?.target) {
    result.push({ command: 'show', label: t('ctxShowInEventView', props.locale) });
  }
  if (props.canPin) {
    const pinned = props.context ? props.pinnedLaneIds.includes(props.context.laneId) : false;
    result.push({
      command: 'pin',
      label: t(pinned ? 'ctxUnpinRow' : 'ctxPinRow', props.locale),
      shortcut: 'Alt+P',
    });
  }
  return result;
});

const hasViewportGroup = computed(() => props.canReset);
const hasEventGroup = computed(() => !!props.context?.target);
const hasEarlierGroup = computed(() => hasViewportGroup.value || hasEventGroup.value);
/** aria-activedescendant id; undefined (no active item) while nothing is highlighted. */
const activeDescendantId = computed(() =>
  activeIndex.value >= 0 && items.value[activeIndex.value]
    ? `ctx-item-${items.value[activeIndex.value].command}`
    : undefined,
);

function place(x: number, y: number) {
  const { width, height } = menuRef.value?.getBoundingClientRect() ?? { width: 0, height: 0 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(4, Math.min(x + width > vw ? x - width : x, vw - width - 4));
  const top = Math.max(4, Math.min(y + height > vh ? y - height : y, vh - height - 4));
  menuStyle.value = { position: 'fixed', left: `${left}px`, top: `${top}px`, visibility: 'visible' };
}

function activate(index: number) {
  const item = items.value[index];
  if (!item || !props.context) return;
  const payload: ContextMenuAction = { command: item.command, laneId: props.context.laneId };
  if (item.command !== 'reset' && props.context.target) payload.target = props.context.target;
  emit('action', payload);
  emit('dismiss');
}

function onScrimPointerDown() {
  emit('dismiss');
}

function onScrimContextMenu() {
  emit('dismiss');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.context) return;
  // While the menu is open it blocks the rest of the UI: swallow every key so the app's
  // own window keydown (WASD pan/zoom, Escape measure/marquee clearing) never fires.
  e.stopPropagation();
  const n = items.value.length;
  if (!n) return;
  if (e.key === 'Escape') { e.preventDefault(); emit('dismiss'); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = (activeIndex.value + 1) % n; return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = activeIndex.value <= 0 ? n - 1 : activeIndex.value - 1; return; }
  if (e.key === 'Enter') { e.preventDefault(); activate(activeIndex.value); return; }
  if (e.key.toLowerCase() === 'p' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    const pinIndex = items.value.findIndex((i) => i.command === 'pin');
    if (pinIndex < 0) return;
    e.preventDefault();
    activate(pinIndex);
  }
}

function onScrollOrResize(e: Event) {
  if (!props.context) return;
  if (e.type === 'scroll') {
    emit('dismiss');
    return;
  }
  place(props.context.x, props.context.y);
}

function bindListeners() {
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);
}

function unbindListeners() {
  document.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
}

watch(
  () => props.context,
  async (ctx) => {
    if (ctx) {
      activeIndex.value = -1;
      unbindListeners();
      restoreFocusEl = document.activeElement as HTMLElement | null;
      menuStyle.value = { position: 'fixed', visibility: 'hidden' };
      await nextTick();
      if (props.context !== ctx) return;
      place(ctx.x, ctx.y);
      menuRef.value?.focus();
      bindListeners();
    } else {
      unbindListeners();
      restoreFocusEl?.focus();
      restoreFocusEl = null;
    }
  },
  { immediate: true, flush: 'sync' },
);

onBeforeUnmount(unbindListeners);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="context && items.length"
      class="pr-ctx-scrim"
      data-testid="context-menu-scrim"
      @pointerdown="onScrimPointerDown"
      @contextmenu.prevent="onScrimContextMenu"
      @wheel.prevent
    />
    <div
      v-if="context && items.length"
      ref="menuRef"
      class="pr-ctx-menu"
      role="menu"
      tabindex="-1"
      :aria-activedescendant="activeDescendantId"
      :style="menuStyle"
      data-testid="context-menu"
      @click.stop
      @pointerdown.stop
      @contextmenu.prevent
    >
      <template
        v-for="(item, i) in items"
        :key="item.command"
      >
        <div
          v-if="(hasViewportGroup && item.command === 'show') || (hasEarlierGroup && item.command === 'pin')"
          class="pr-ctx-menu__sep"
          role="separator"
        />
        <button
          type="button"
          class="pr-ctx-menu__item"
          :class="{ 'pr-ctx-menu__item--active': i === activeIndex }"
          role="menuitem"
          :id="`ctx-item-${item.command}`"
          :data-testid="`ctx-item-${item.command}`"
          @pointerenter="activeIndex = i"
          @click="activate(i)"
        >
          <span class="pr-ctx-menu__label">{{ item.label }}</span>
          <span
            v-if="item.shortcut"
            class="pr-ctx-menu__shortcut"
          >{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style>
.pr-ctx-scrim {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: transparent;
}

.pr-ctx-menu {
  z-index: 10001;
  box-sizing: border-box;
  min-width: 180px;
  padding: 4px 0;
  border-radius: 6px;
  background: var(--pr-surface-raised, #363636);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  color: var(--pr-tab-inactive);
  font-size: 13px;
  user-select: none;
}

.pr-ctx-menu__sep {
  height: 1px;
  margin: 4px 0;
  background: var(--pr-divider);
}

.pr-ctx-menu__item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 8px 40px 8px 12px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.pr-ctx-menu__item--active {
  background: var(--pr-surface-hover);
}

.pr-ctx-menu__label {
  flex: 1 1 auto;
}

.pr-ctx-menu__shortcut {
  flex: 0 0 auto;
  margin-left: 12px;
  color: var(--pr-tab-inactive);
  font-size: 12px;
}
</style>
