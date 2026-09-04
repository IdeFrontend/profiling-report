<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { GutterMetric } from '../../../domain/gutterMetrics';
import { gutterMetricLabel } from '../../../i18n';

const props = defineProps<{
  modelValue: GutterMetric;
  options: GutterMetric[];
  ariaLabel: string;
  locale?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [metric: GutterMetric];
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuStyle = ref<Record<string, string>>({});
const activeIndex = ref(0);

const label = computed(() => gutterMetricLabel(props.modelValue, props.locale));
const activeId = computed(() =>
  open.value && props.options[activeIndex.value]
    ? `card-metric-option-${props.options[activeIndex.value]}`
    : undefined,
);

function optionLabel(metric: GutterMetric): string {
  return gutterMetricLabel(metric, props.locale);
}

function placeMenu() {
  const el = rootRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  menuStyle.value = {
    position: 'fixed',
    top: `${r.bottom + 2}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
  };
}

function syncActiveFromValue() {
  const i = props.options.indexOf(props.modelValue);
  activeIndex.value = i >= 0 ? i : 0;
}

function toggle(e: Event) {
  e.stopPropagation();
  e.preventDefault();
  open.value = !open.value;
}

function pick(metric: GutterMetric, e?: Event) {
  e?.stopPropagation();
  e?.preventDefault();
  emit('update:modelValue', metric);
  open.value = false;
  triggerRef.value?.focus();
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value) return;
  const t = e.target as Node;
  if (rootRef.value?.contains(t) || menuRef.value?.contains(t)) return;
  open.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) return;
  const n = props.options.length;
  if (n === 0) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    open.value = false;
    triggerRef.value?.focus();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % n;
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + n) % n;
    return;
  }
  if (e.key === 'Home') {
    e.preventDefault();
    activeIndex.value = 0;
    return;
  }
  if (e.key === 'End') {
    e.preventDefault();
    activeIndex.value = n - 1;
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const opt = props.options[activeIndex.value];
    if (opt) pick(opt);
  }
}

function onScrollOrResize() {
  if (open.value) placeMenu();
}

watch(open, async (v) => {
  if (v) {
    syncActiveFromValue();
    await nextTick();
    placeMenu();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('scroll', onScrollOrResize, true);
  window.removeEventListener('resize', onScrollOrResize);
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
</script>

<template>
  <div
    ref="rootRef"
    class="pr-metric-select"
    :class="{ 'pr-metric-select--open': open }"
    data-testid="card-metric-select"
    :data-value="modelValue"
    @click.stop
    @pointerdown.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="pr-metric-select__trigger"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="open ? 'card-metric-listbox' : undefined"
      :aria-activedescendant="activeId"
      @click="toggle"
    >
      <span class="pr-metric-select__label">{{ label }}</span>
      <span
        class="pr-metric-select__chev"
        aria-hidden="true"
      />
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        id="card-metric-listbox"
        ref="menuRef"
        class="pr-metric-select__menu"
        role="listbox"
        tabindex="-1"
        :style="menuStyle"
        data-testid="card-metric-menu"
        @click.stop
        @pointerdown.stop
      >
        <li
          v-for="(opt, i) in options"
          :id="`card-metric-option-${opt}`"
          :key="opt"
          role="option"
          class="pr-metric-select__option"
          :class="{
            'pr-metric-select__option--selected': opt === modelValue,
            'pr-metric-select__option--active': i === activeIndex,
          }"
          :aria-selected="opt === modelValue"
          :data-testid="`card-metric-option-${opt}`"
          @click="pick(opt, $event)"
        >
          {{ optionLabel(opt) }}
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.pr-metric-select {
  position: relative;
  margin-left: auto;
  max-width: 118px;
  min-width: 0;
  flex: 0 1 118px;
}

.pr-metric-select__trigger {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 22px;
  margin: 0;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #e8e8e8;
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
}

.pr-metric-select__trigger:hover,
.pr-metric-select--open .pr-metric-select__trigger {
  border-color: #3078f0;
}

.pr-metric-select__trigger:focus-visible {
  outline: none;
  border-color: #3078f0;
}

.pr-metric-select__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.pr-metric-select__chev {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  position: relative;
}

.pr-metric-select__chev::before {
  content: '';
  position: absolute;
  left: 1px;
  top: 1px;
  box-sizing: border-box;
  width: 5px;
  height: 5px;
  border-style: solid;
  border-color: #a8a8a8;
  border-width: 0 1.2px 1.2px 0;
  transform: rotate(45deg);
}
</style>

<!-- Menu teleports to body — unscoped so styles apply outside the component root. -->
<style>
.pr-metric-select__menu {
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

.pr-metric-select__option {
  box-sizing: border-box;
  display: block;
  padding: 4px 8px;
  border-radius: 2px;
  color: #e8e8e8;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-metric-select__option:hover,
.pr-metric-select__option--active {
  background: #323232;
}

.pr-metric-select__option--selected {
  background: #3078f0;
  color: #fff;
}

.pr-metric-select__option--selected:hover,
.pr-metric-select__option--selected.pr-metric-select__option--active {
  background: #3078f0;
}
</style>
