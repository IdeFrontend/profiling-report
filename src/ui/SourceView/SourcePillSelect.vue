<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

export type SourceSelectOption = { id: string; label: string };

const props = defineProps<{
  /** Visible caption, without the trailing colon. */
  caption: string;
  modelValue: string;
  options: readonly SourceSelectOption[];
  testId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const labelRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});
const activeIndex = ref(0);
const buttonId = useId().replace(/:/g, '');
const listboxId = computed(() => `${buttonId}-list`);

const label = computed(
  () => props.options.find((o) => o.id === props.modelValue)?.label ?? props.modelValue,
);

const activeId = computed(() => {
  const opt = props.options[activeIndex.value];
  return open.value && opt != null ? `${buttonId}-opt-${activeIndex.value}` : undefined;
});

function placeMenu() {
  const el = triggerRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  // minWidth ≥ trigger so a short selection does not shrink the list; width follows
  // the longest option (max-content). Same placement as the Utilization menu.
  menuStyle.value = {
    position: 'fixed',
    top: `${r.bottom + 2}px`,
    left: `${r.left}px`,
    minWidth: `${Math.max(r.width, 140)}px`,
    width: 'max-content',
    maxWidth: `${Math.max(160, window.innerWidth - 16)}px`,
  };
}

function clampMenuToViewport() {
  const menu = menuRef.value;
  if (!menu) return;
  const mr = menu.getBoundingClientRect();
  const pad = 8;
  if (mr.right <= window.innerWidth - pad) return;
  const left = Math.max(pad, window.innerWidth - pad - mr.width);
  menuStyle.value = { ...menuStyle.value, left: `${left}px` };
}

function syncActiveFromValue() {
  const i = props.options.findIndex((o) => o.id === props.modelValue);
  activeIndex.value = i >= 0 ? i : 0;
}

function toggle(e: Event) {
  e.stopPropagation();
  if (props.options.length === 0) return;
  open.value = !open.value;
}

function pick(id: string, e?: Event) {
  e?.stopPropagation();
  e?.preventDefault();
  open.value = false;
  if (id !== props.modelValue) emit('update:modelValue', id);
  triggerRef.value?.focus();
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  // The caption <label> is outside the button. Its pointerdown must not close the
  // menu, or the following synthetic click would open it again.
  if (triggerRef.value?.contains(t) || labelRef.value?.contains(t) || menuRef.value?.contains(t)) return;
  open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  const n = props.options.length;
  if (n === 0) return;
  if (
    e.key === 'Escape' ||
    e.key === 'ArrowDown' ||
    e.key === 'ArrowUp' ||
    e.key === 'Home' ||
    e.key === 'End' ||
    e.key === 'Enter' ||
    e.key === ' '
  ) {
    // Capture + stop so the focused pill does not also toggle on Enter/Space.
    e.stopPropagation();
    e.preventDefault();
  }
  if (e.key === 'Escape') {
    open.value = false;
    triggerRef.value?.focus();
    return;
  }
  if (e.key === 'ArrowDown') {
    activeIndex.value = (activeIndex.value + 1) % n;
    return;
  }
  if (e.key === 'ArrowUp') {
    activeIndex.value = (activeIndex.value - 1 + n) % n;
    return;
  }
  if (e.key === 'Home') {
    activeIndex.value = 0;
    return;
  }
  if (e.key === 'End') {
    activeIndex.value = n - 1;
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    const opt = props.options[activeIndex.value];
    if (opt) pick(opt.id);
  }
}

function onScrollOrResize() {
  if (open.value) placeMenu();
}

watch(open, async (v) => {
  if (!v) return;
  syncActiveFromValue();
  await nextTick();
  placeMenu();
  await nextTick();
  clampMenuToViewport();
});

watch(
  open,
  (v) => {
    if (v) {
      document.addEventListener('pointerdown', onDocPointerDown, true);
      document.addEventListener('keydown', onKeydown, true);
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
    } else {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKeydown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    }
  },
  { flush: 'sync' },
);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
});
</script>

<template>
  <div class="pr-source-view__field">
    <label
      ref="labelRef"
      :for="buttonId"
    >{{ caption }}:</label>
    <button
      :id="buttonId"
      ref="triggerRef"
      type="button"
      class="pr-block-pill pr-source-view__select source-pill__trigger"
      :data-testid="testId"
      :aria-label="caption"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="open ? listboxId : undefined"
      :aria-activedescendant="activeId"
      @click="toggle"
    >
      {{ label }}
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        :id="listboxId"
        ref="menuRef"
        class="pr-source-select__menu"
        role="listbox"
        tabindex="-1"
        :style="menuStyle"
        :data-testid="`${testId}-menu`"
        @click.stop
        @pointerdown.stop
      >
        <li
          v-for="(opt, i) in options"
          :id="`${buttonId}-opt-${i}`"
          :key="opt.id"
          role="option"
          class="pr-source-select__option"
          :class="{
            'pr-source-select__option--selected': opt.id === modelValue,
            'pr-source-select__option--active': i === activeIndex,
          }"
          :aria-selected="opt.id === modelValue"
          :data-testid="`${testId}-option`"
          :data-value="opt.id"
          @click="pick(opt.id, $event)"
        >
          {{ opt.label }}
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.pr-source-view__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pr-src-label, #b3b3b3);
}

/* Button reset so the shared pill (not a native <select>) keeps the same box. */
.source-pill__trigger {
  font-family: inherit;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<!-- Menu teleports to body. Tokens match CardMetricSelect (Utilization popup). -->
<style>
.pr-source-select__menu {
  z-index: 10000;
  box-sizing: border-box;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  background: #2a2a2a;
  color: #e8e8e8;
  font-size: 12px;
  font-weight: 400;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
}

.pr-source-select__option {
  box-sizing: border-box;
  display: block;
  padding: 4px 8px;
  border-radius: 2px;
  color: #e8e8e8;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.pr-source-select__option:hover,
.pr-source-select__option--active {
  background: #323232;
}

.pr-source-select__option--selected {
  background: #3078f0;
  color: #fff;
}

.pr-source-select__option--selected:hover,
.pr-source-select__option--selected.pr-source-select__option--active {
  background: #3078f0;
}
</style>
