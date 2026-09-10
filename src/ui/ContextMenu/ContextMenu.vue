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

const props = defineProps<{
  context: ContextMenuContext | null;
  pinnedLaneIds: string[];
  locale?: string;
}>();

const emit = defineEmits<{
  action: [payload: ContextMenuAction];
  dismiss: [];
}>();

const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({ position: 'fixed', visibility: 'hidden' });
const activeIndex = ref(0);
let restoreFocusEl: HTMLElement | null = null;

const items = computed(() => {
  const result: { command: ContextMenuCommand; label: string; shortcut?: string }[] = [];
  if (props.context?.target) {
    result.push({ command: 'reset', label: t('ctxResetZoom', props.locale) });
    result.push({ command: 'show', label: t('ctxShowInEventView', props.locale) });
  }
  const pinned = props.context ? props.pinnedLaneIds.includes(props.context.laneId) : false;
  result.push({
    command: 'pin',
    label: t(pinned ? 'ctxUnpinRow' : 'ctxPinRow', props.locale),
    shortcut: 'Ctrl+P',
  });
  return result;
});

const hasEventGroup = computed(() => !!props.context?.target);

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

function onDocPointerDown(e: PointerEvent) {
  if (!props.context) return;
  if (menuRef.value?.contains(e.target as Node)) return;
  emit('dismiss');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.context) return;
  const n = items.value.length;
  if (e.key === 'Escape') { e.preventDefault(); emit('dismiss'); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = (activeIndex.value + 1) % n; return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = (activeIndex.value - 1 + n) % n; return; }
  if (e.key === 'Enter') { e.preventDefault(); activate(activeIndex.value); return; }
  if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const pinIndex = items.value.findIndex((i) => i.command === 'pin');
    if (pinIndex >= 0) activate(pinIndex);
    return;
  }
}

function bindListeners() {
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onKeydown, true);
}

function unbindListeners() {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeydown, true);
}

watch(
  () => props.context,
  async (ctx) => {
    if (ctx) {
      activeIndex.value = 0;
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
      v-if="context"
      ref="menuRef"
      class="pr-ctx-menu"
      role="menu"
      tabindex="-1"
      :aria-activedescendant="`ctx-item-${items[activeIndex]?.command}`"
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
          v-if="hasEventGroup && i === items.length - 1 && items.length > 1"
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
