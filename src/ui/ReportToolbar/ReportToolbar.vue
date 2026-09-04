<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import PrIcon from '../PrIcon.vue';
import type { ReportOperator, TimeDisplayMode } from '../../domain/types';
import Chevron from '../Chevron.vue';
import {
  MAX_DEPENDENCY_DEPTH,
  MIN_DEPENDENCY_DEPTH,
  normalizeDependencyDepth,
} from '../../domain/types';
import { t } from '../../i18n';
/* PyPTO multi-color glyphs — img, not PrIcon masks (masks kill #5291FF accents). */
import shortcutMouseWheel from '../icons/shortcuts/mouse-scrollwheel-dark.svg';
import shortcutMouseClick from '../icons/shortcuts/mouse-leftclick-dark.svg';
import shortcutKeyW from '../icons/shortcuts/W-dark-key.svg';
import shortcutKeyA from '../icons/shortcuts/A-dark-key.svg';
import shortcutKeyS from '../icons/shortcuts/S-dark-key.svg';
import shortcutKeyD from '../icons/shortcuts/D-dark-key.svg';
import shortcutKeyCtrl from '../icons/shortcuts/Ctrl-dark-key.svg';
import shortcutKeyAlt from '../icons/shortcuts/Alt-dark-key.svg';

const props = defineProps<{
  searchQuery: string;
  asideVisible: boolean;
  asideAvailable: boolean;
  zoomPercent: number;
  timeDisplayMode: TimeDisplayMode;
  /** When set, CPU clocks option is shown. */
  clockFreqMHz?: number;
  dependencyDepth: number;
  locale?: string;
  title?: string;
  measureMode?: boolean;
  operators?: ReportOperator[];
  selectedOperatorId?: string | null;
}>();

const emit = defineEmits<{
  'update:searchQuery': [value: string];
  'update:asideVisible': [value: boolean];
  'update:timeDisplayMode': [value: TimeDisplayMode];
  'update:dependencyDepth': [value: number];
  'update:measureMode': [value: boolean];
  'update:selectedOperatorId': [id: string];
  'zoom-to-fit': [];
  'zoom-in': [];
  'zoom-out': [];
  'update:zoomPercent': [value: number];
}>();

function onDepthChange(event: Event) {
  // A cleared number input reads as '' — normalizeDependencyDepth turns that (and
  // anything unparsable) into the shared default rather than letting NaN through.
  const raw = (event.target as HTMLInputElement).value.trim();
  emit('update:dependencyDepth', normalizeDependencyDepth(raw === '' ? Number.NaN : Number(raw)));
}

/** Step buttons go through the same clamp as typing, so neither can leave the range. */
function stepDepth(by: 1 | -1) {
  emit('update:dependencyDepth', normalizeDependencyDepth(props.dependencyDepth + by));
}

const atDepthMax = computed(() => props.dependencyDepth >= MAX_DEPENDENCY_DEPTH);
const atDepthMin = computed(() => props.dependencyDepth <= MIN_DEPENDENCY_DEPTH);

const displayControlOpen = ref(false);
/** Wrap owns the trigger and the panel, so an outside hit is anything not in here. */
const displayWrapRef = ref<HTMLElement | null>(null);
/** Shortcut-help (快捷键说明) popover state — same dismiss contract as display control. */
const shortcutHelpOpen = ref(false);
const shortcutWrapRef = ref<HTMLElement | null>(null);
const opMenuOpen = ref(false);
const activeOptionIndex = ref(0);
const opMenuId = useId();
const connectionHelpTipId = useId();
const opTriggerRef = ref<HTMLButtonElement | null>(null);
const opMenuRef = ref<HTMLElement | null>(null);

const showOperatorSelector = computed(() => (props.operators?.length ?? 0) > 1);

/** Drop stale open state when the selector unmounts (e.g. host swaps to a single-op source). */
watch(showOperatorSelector, (show) => {
  if (!show) opMenuOpen.value = false;
});

/** Trigger shows the selected operator label (falls back to OP算子 brand). */
const triggerLabel = computed(() => {
  const ops = props.operators ?? [];
  const selected = ops.find((o) => o.id === props.selectedOperatorId);
  return selected?.label ?? ops[0]?.label ?? t('tabOp', props.locale);
});

function toggleDisplayControl() {
  displayControlOpen.value = !displayControlOpen.value;
}

function closeDisplayControl() {
  displayControlOpen.value = false;
}

/**
 * Pointer outside the wrap closes the panel immediately. `pointerdown` rather than
 * `click` so a drag that starts outside still dismisses, and so the listener can be
 * attached during the opening click — that click's pointerdown already fired, so it
 * cannot bounce the panel shut again. The wrap includes the layers button, so a
 * second press on the trigger still goes through `toggleDisplayControl` alone.
 * Escape closes too (APG dialog pattern) — the pointer listener alone left keyboard
 * users stuck once they Tabbed into the depth field.
 */
function onDisplayOutsidePointerDown(e: PointerEvent) {
  const wrap = displayWrapRef.value;
  if (!wrap || !(e.target instanceof Node) || wrap.contains(e.target)) return;
  closeDisplayControl();
}

function onDisplayEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  closeDisplayControl();
}

watch(displayControlOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onDisplayOutsidePointerDown);
    document.addEventListener('keydown', onDisplayEscape);
  } else {
    document.removeEventListener('pointerdown', onDisplayOutsidePointerDown);
    document.removeEventListener('keydown', onDisplayEscape);
  }
});

function toggleShortcutHelp() {
  shortcutHelpOpen.value = !shortcutHelpOpen.value;
}

function closeShortcutHelp() {
  shortcutHelpOpen.value = false;
}

/** Same APG dialog dismiss as 显示控制: pointerdown outside the wrap or Escape. */
function onShortcutOutsidePointerDown(e: PointerEvent) {
  const wrap = shortcutWrapRef.value;
  if (!wrap || !(e.target instanceof Node) || wrap.contains(e.target)) return;
  closeShortcutHelp();
}

function onShortcutEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  closeShortcutHelp();
}

watch(shortcutHelpOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onShortcutOutsidePointerDown);
    document.addEventListener('keydown', onShortcutEscape);
  } else {
    document.removeEventListener('pointerdown', onShortcutOutsidePointerDown);
    document.removeEventListener('keydown', onShortcutEscape);
  }
});

const toolbarRef = ref<HTMLElement | null>(null);
let toolbarClipRo: ResizeObserver | null = null;

/**
 * `overflow-x: clip` still leaves cropped trailing icon buttons focusable. Mark any
 * action that sits past the clip edge `inert` so Tab skips the invisible targets.
 */
function syncToolbarClipInert() {
  const bar = toolbarRef.value;
  if (!bar) return;
  const barRight = bar.getBoundingClientRect().right;
  for (const el of bar.querySelectorAll<HTMLElement>('[data-toolbar-clip]')) {
    const r = el.getBoundingClientRect();
    const clipped = r.width > 0 && r.right > barRight + 0.5;
    if (clipped) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }
}

onMounted(() => {
  const bar = toolbarRef.value;
  if (!bar || typeof ResizeObserver === 'undefined') return;
  toolbarClipRo = new ResizeObserver(() => syncToolbarClipInert());
  toolbarClipRo.observe(bar);
  syncToolbarClipInert();
});

watch(
  () => props.asideAvailable,
  async () => {
    await nextTick();
    syncToolbarClipInert();
  },
);

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDisplayOutsidePointerDown);
  document.removeEventListener('keydown', onDisplayEscape);
  document.removeEventListener('pointerdown', onShortcutOutsidePointerDown);
  document.removeEventListener('keydown', onShortcutEscape);
  toolbarClipRo?.disconnect();
  toolbarClipRo = null;
});

defineExpose({ syncToolbarClipInert });

function focusActiveOption() {
  const items = opMenuRef.value?.querySelectorAll<HTMLElement>('[data-testid="op-item"]');
  items?.[activeOptionIndex.value]?.focus();
}

async function openOpMenu() {
  const ops = props.operators ?? [];
  const i = ops.findIndex((o) => o.id === props.selectedOperatorId);
  activeOptionIndex.value = i >= 0 ? i : 0;
  opMenuOpen.value = true;
  await nextTick();
  focusActiveOption();
}

async function closeOpMenu(opts?: { restoreFocus?: boolean }) {
  opMenuOpen.value = false;
  if (opts?.restoreFocus) {
    await nextTick();
    opTriggerRef.value?.focus();
  }
}

function toggleOpMenu() {
  if (opMenuOpen.value) void closeOpMenu();
  else void openOpMenu();
}

function selectOperator(id: string) {
  if (id !== props.selectedOperatorId) {
    emit('update:selectedOperatorId', id);
  }
  void closeOpMenu({ restoreFocus: true });
}

function onTriggerKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && opMenuOpen.value) {
    e.preventDefault();
    void closeOpMenu({ restoreFocus: true });
    return;
  }
  if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && !opMenuOpen.value) {
    e.preventDefault();
    void openOpMenu();
  }
}

function onOptionKeydown(e: KeyboardEvent, id: string) {
  const ops = props.operators ?? [];
  if (e.key === 'Escape') {
    e.preventDefault();
    void closeOpMenu({ restoreFocus: true });
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectOperator(id);
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (ops.length === 0) return;
    const i = ops.findIndex((o) => o.id === id);
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    activeOptionIndex.value = (i + delta + ops.length) % ops.length;
    void nextTick(focusActiveOption);
  }
}
</script>

<template>
  <div
    class="pr-chrome"
    data-testid="report-toolbar"
  >
    <div
      class="pr-chrome__wash"
      data-testid="corner-wash"
      aria-hidden="true"
    />
    <nav
      class="pr-tabs"
      data-testid="report-tabs"
      :aria-label="t('reportViews', locale)"
    >
      <div
        v-if="showOperatorSelector"
        class="pr-op-select"
        data-testid="op-selector"
      >
        <button
          ref="opTriggerRef"
          type="button"
          class="pr-op-select__trigger"
          :aria-expanded="opMenuOpen"
          :aria-haspopup="'listbox'"
          :aria-controls="opMenuOpen ? opMenuId : undefined"
          @click="toggleOpMenu"
          @keydown="onTriggerKeydown"
        >
          <span
            class="pr-op-select__label"
            data-testid="op-selector-label"
          >{{ triggerLabel }}</span>
          <svg
            class="pr-op-select__chevron"
            :class="{ 'pr-op-select__chevron--open': opMenuOpen }"
            viewBox="0 0 12 12"
            width="10"
            height="10"
            aria-hidden="true"
          >
            <path
              d="M2.5 4.5L6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div
          v-if="opMenuOpen"
          class="pr-op-select__backdrop"
          @click="closeOpMenu()"
        />
        <ul
          v-if="opMenuOpen"
          :id="opMenuId"
          ref="opMenuRef"
          class="pr-op-select__menu"
          role="listbox"
          :aria-label="t('tabOp', locale)"
        >
          <li
            v-for="(op, index) in operators"
            :key="op.id"
            class="pr-op-select__item"
            :class="{ 'pr-op-select__item--active': op.id === selectedOperatorId }"
            role="option"
            tabindex="0"
            :aria-selected="op.id === selectedOperatorId"
            data-testid="op-item"
            @click="selectOperator(op.id)"
            @keydown="onOptionKeydown($event, op.id)"
            @focus="activeOptionIndex = index"
          >
            {{ op.label }}
          </li>
        </ul>
      </div>
      <span
        v-else
        class="pr-tabs__brand"
      >{{ title || t('tabOp', locale) }}</span>
      <button
        type="button"
        class="pr-tabs__tab pr-tabs__tab--active"
        data-testid="tab-timeline"
      >
        {{ t('tabTimeline', locale) }}
      </button>
      <button
        type="button"
        class="pr-tabs__tab"
        disabled
        :title="t('phase2', locale)"
      >
        {{ t('tabSource', locale) }}
      </button>
      <button
        type="button"
        class="pr-tabs__tab"
        disabled
        :title="t('phase2', locale)"
      >
        {{ t('tabDetail', locale) }}
      </button>
      <button
        type="button"
        class="pr-tabs__tab"
        disabled
        :title="t('phase2', locale)"
      >
        {{ t('tabCache', locale) }}
      </button>
    </nav>

    <div
      ref="toolbarRef"
      class="pr-toolbar"
    >
      <label class="pr-toolbar__search">
        <span class="pr-toolbar__sr">{{ t('searchLabel', locale) }}</span>
        <PrIcon
          name="search"
          class="pr-toolbar__search-icon"
          data-testid="search-magnifier"
        />
        <input
          data-testid="search-input"
          type="search"
          :value="searchQuery"
          :placeholder="t('searchPlaceholder', locale)"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <div
        class="pr-toolbar__zoom pr-toolbar__zoom-pill"
        data-testid="zoom-pill"
      >
        <button
          type="button"
          data-testid="zoom-out"
          class="pr-toolbar__zoom-btn"
          :title="t('zoomOut', locale)"
          @click="emit('zoom-out')"
        >
          <PrIcon name="zoom-out" />
        </button>
        <input
          data-testid="zoom-slider"
          class="pr-toolbar__slider"
          type="range"
          min="0"
          max="100"
          :value="zoomPercent"
          :style="{ '--pr-zoom-fill': `${zoomPercent}%` }"
          @input="emit('update:zoomPercent', Number(($event.target as HTMLInputElement).value))"
        >
        <button
          type="button"
          data-testid="zoom-in"
          class="pr-toolbar__zoom-btn"
          :title="t('zoomIn', locale)"
          @click="emit('zoom-in')"
        >
          <PrIcon name="zoom-in" />
        </button>
      </div>

      <div
        ref="shortcutWrapRef"
        class="pr-toolbar__shortcut-wrap"
      >
        <button
          type="button"
          class="pr-toolbar__icon-btn"
          data-testid="toggle-shortcuts"
          data-toolbar-clip
          :aria-expanded="shortcutHelpOpen"
          :aria-pressed="shortcutHelpOpen"
          :class="{ 'pr-toolbar__icon-btn--on': shortcutHelpOpen }"
          :title="t('shortcuts', locale)"
          @click="toggleShortcutHelp"
        >
          <PrIcon name="keyboard" />
        </button>

        <div
          v-if="shortcutHelpOpen"
          class="pr-toolbar__shortcut-help"
          data-testid="shortcut-help"
          role="dialog"
          :aria-label="t('shortcuts', locale)"
        >
          <div class="pr-toolbar__shortcut-head">
            <span class="pr-toolbar__shortcut-title">{{ t('shortcuts', locale) }}</span>
            <button
              type="button"
              class="pr-toolbar__shortcut-close"
              data-testid="shortcut-help-close"
              :title="t('closePanel', locale)"
              @click="closeShortcutHelp"
            >
              <PrIcon name="close" />
            </button>
          </div>

          <div class="pr-toolbar__shortcut-information">
            <div class="pr-toolbar__shortcut-mouse-key">
              <div class="pr-toolbar__shortcut-column">
                <div class="pr-toolbar__shortcut-section-title">
                  {{ t('mouseControl', locale) }}
                </div>
                <div class="pr-toolbar__shortcut-row">
                  <span>{{ t('verticalMovement', locale) }}</span>
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="mouse-wheel"
                    :src="shortcutMouseWheel"
                    alt=""
                    width="24"
                    height="24"
                  >
                </div>
                <div class="pr-toolbar__shortcut-row">
                  <span>{{ t('singleBoxSelection', locale) }}</span>
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="mouse-click"
                    :src="shortcutMouseClick"
                    alt=""
                    width="24"
                    height="24"
                  >
                </div>
              </div>

              <div class="pr-toolbar__shortcut-column">
                <div class="pr-toolbar__shortcut-section-title">
                  {{ t('keyboardControl', locale) }}
                </div>
                <div class="pr-toolbar__shortcut-pair-row">
                  <div class="pr-toolbar__shortcut-pair">
                    <span>{{ t('zoomIn', locale) }}</span>
                    <img
                      class="pr-toolbar__shortcut-glyph"
                      data-shortcut-icon="key-w"
                      :src="shortcutKeyW"
                      alt="W"
                      width="24"
                      height="24"
                    >
                  </div>
                  <div class="pr-toolbar__shortcut-pair">
                    <span>{{ t('zoomOut', locale) }}</span>
                    <img
                      class="pr-toolbar__shortcut-glyph"
                      data-shortcut-icon="key-s"
                      :src="shortcutKeyS"
                      alt="S"
                      width="24"
                      height="24"
                    >
                  </div>
                </div>
                <div class="pr-toolbar__shortcut-pair-row">
                  <div class="pr-toolbar__shortcut-pair">
                    <span>{{ t('panLeft', locale) }}</span>
                    <img
                      class="pr-toolbar__shortcut-glyph"
                      data-shortcut-icon="key-a"
                      :src="shortcutKeyA"
                      alt="A"
                      width="24"
                      height="24"
                    >
                  </div>
                  <div class="pr-toolbar__shortcut-pair">
                    <span>{{ t('panRight', locale) }}</span>
                    <img
                      class="pr-toolbar__shortcut-glyph"
                      data-shortcut-icon="key-d"
                      :src="shortcutKeyD"
                      alt="D"
                      width="24"
                      height="24"
                    >
                  </div>
                </div>
              </div>
            </div>

            <div class="pr-toolbar__shortcut-column pr-toolbar__shortcut-column--combined">
              <div class="pr-toolbar__shortcut-section-title">
                {{ t('combinedControl', locale) }}
              </div>
              <div class="pr-toolbar__shortcut-row">
                <span>{{ t('scaling', locale) }}</span>
                <span class="pr-toolbar__shortcut-glyphs">
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="mouse-wheel"
                    :src="shortcutMouseWheel"
                    alt=""
                    width="24"
                    height="24"
                  >
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="key-ctrl"
                    :src="shortcutKeyCtrl"
                    alt="Ctrl"
                    width="24"
                    height="24"
                  >
                </span>
              </div>
              <div class="pr-toolbar__shortcut-row">
                <span>{{ t('dragPan', locale) }}</span>
                <span class="pr-toolbar__shortcut-glyphs">
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="mouse-click"
                    :src="shortcutMouseClick"
                    alt=""
                    width="24"
                    height="24"
                  >
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="key-ctrl"
                    :src="shortcutKeyCtrl"
                    alt="Ctrl"
                    width="24"
                    height="24"
                  >
                </span>
              </div>
              <div class="pr-toolbar__shortcut-row">
                <span>{{ t('boxSelect', locale) }}</span>
                <img
                  class="pr-toolbar__shortcut-glyph"
                  data-shortcut-icon="mouse-click"
                  :src="shortcutMouseClick"
                  alt=""
                  width="24"
                  height="24"
                >
              </div>
              <div class="pr-toolbar__shortcut-row">
                <span>{{ t('timeMeasurement', locale) }}</span>
                <span class="pr-toolbar__shortcut-glyphs">
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="mouse-click"
                    :src="shortcutMouseClick"
                    alt=""
                    width="24"
                    height="24"
                  >
                  <img
                    class="pr-toolbar__shortcut-glyph"
                    data-shortcut-icon="key-alt"
                    :src="shortcutKeyAlt"
                    alt="Alt"
                    width="24"
                    height="24"
                  >
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        data-testid="zoom-to-fit"
        data-toolbar-clip
        class="pr-toolbar__icon-btn"
        :title="t('zoomFit', locale)"
        @click="emit('zoom-to-fit')"
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect
            x="5"
            y="5"
            width="6"
            height="6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>

      <button
        type="button"
        class="pr-toolbar__icon-btn"
        data-testid="toggle-measure"
        data-toolbar-clip
        :aria-pressed="measureMode"
        :aria-label="t('measure', locale)"
        :class="{ 'pr-toolbar__icon-btn--on': measureMode }"
        :title="t('measure', locale)"
        @click="emit('update:measureMode', !measureMode)"
      >
        <PrIcon
          name="measure"
          data-testid="measure-icon"
        />
      </button>

      <div
        ref="displayWrapRef"
        class="pr-toolbar__display-wrap"
      >
        <button
          type="button"
          class="pr-toolbar__icon-btn"
          data-testid="toggle-display-control"
          data-toolbar-clip
          :aria-expanded="displayControlOpen"
          :aria-pressed="displayControlOpen"
          :class="{ 'pr-toolbar__icon-btn--on': displayControlOpen }"
          :title="t('displayControl', locale)"
          @click="toggleDisplayControl"
        >
          <PrIcon name="display-config" />
        </button>

        <div
          v-if="displayControlOpen"
          class="pr-toolbar__display-control"
          data-testid="display-control"
          role="dialog"
          :aria-label="t('displayControl', locale)"
        >
          <div class="pr-toolbar__display-head">
            <span class="pr-toolbar__display-title">{{ t('displayControl', locale) }}</span>
            <button
              type="button"
              class="pr-toolbar__display-close"
              data-testid="display-control-close"
              :title="t('closePanel', locale)"
              @click="closeDisplayControl"
            >
              <PrIcon name="close" />
            </button>
          </div>
          <label class="pr-toolbar__display-field">
            <span class="pr-toolbar__display-label">{{ t('taskDisplayUnit', locale) }}</span>
            <span class="pr-toolbar__display-select">
              <select
                data-testid="time-display-mode"
                :value="timeDisplayMode"
                @change="emit('update:timeDisplayMode', ($event.target as HTMLSelectElement).value as TimeDisplayMode)"
              >
                <option value="time">{{ t('displayModeTime', locale) }}</option>
                <option
                  v-if="clockFreqMHz != null"
                  value="cycles"
                >
                  {{ t('displayModeCycles', locale) }}
                </option>
              </select>
              <span
                class="pr-toolbar__display-select-chevron"
                aria-hidden="true"
              />
            </span>
          </label>
          <label class="pr-toolbar__display-field">
            <span class="pr-toolbar__display-label">
              {{ t('connectionLevel', locale) }}
              <button
                type="button"
                class="pr-toolbar__display-help"
                :aria-describedby="connectionHelpTipId"
                :aria-label="t('helpConnectionLevel', locale)"
                @click.stop.prevent
              >
                <PrIcon name="help" />
                <span
                  :id="connectionHelpTipId"
                  class="pr-toolbar__display-help-tip"
                  role="tooltip"
                  data-testid="connection-level-help"
                >{{ t('connectionLevelHelp', locale) }}</span>
              </button>
            </span>
            <span class="pr-toolbar__display-stepper">
              <input
                data-testid="dependency-depth"
                type="number"
                step="1"
                :min="MIN_DEPENDENCY_DEPTH"
                :max="MAX_DEPENDENCY_DEPTH"
                :value="dependencyDepth"
                @change="onDepthChange"
              >
              <span
                class="pr-toolbar__display-steps"
                aria-hidden="true"
              >
                <button
                  type="button"
                  class="pr-toolbar__display-step"
                  data-testid="dependency-depth-up"
                  tabindex="-1"
                  :disabled="atDepthMax"
                  :title="t('stepUp', locale)"
                  @click="stepDepth(1)"
                >
                  <Chevron direction="up" />
                </button>
                <button
                  type="button"
                  class="pr-toolbar__display-step"
                  data-testid="dependency-depth-down"
                  tabindex="-1"
                  :disabled="atDepthMin"
                  :title="t('stepDown', locale)"
                  @click="stepDepth(-1)"
                >
                  <Chevron direction="down" />
                </button>
              </span>
            </span>
          </label>
        </div>
      </div>

      <button
        v-if="asideAvailable"
        type="button"
        class="pr-toolbar__icon-btn"
        data-testid="toggle-aside"
        data-toolbar-clip
        :aria-pressed="asideVisible"
        :class="{ 'pr-toolbar__icon-btn--on': asideVisible }"
        :title="t('stats', locale)"
        @click="emit('update:asideVisible', !asideVisible)"
      >
        <PrIcon name="stats" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.pr-chrome {
  --pr-toolbar-h: 28px;
  /* Anchors the wash. Deliberately no `z-index`/`isolation`: a stacking context here
     would trap the OP menu and 显示控制 popover inside the strip. */
  position: relative;
  box-sizing: border-box;
  display: flex;
  /* Wrap only as whole units: tabs stay on row 1, the entire `.pr-toolbar` jumps to
     row 2 together (toolbar itself is nowrap). */
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  /* Vertical 8px keeps a wrapped toolbar from sitting flush on the tabs above
     and the axis below; one-row band still lands ~60px with box-sizing border-box. */
  padding: 8px;
  /* One-row band is 60px; grows when the toolbar wraps. `overflow-x: clip` (not
     `hidden`) keeps `overflow-y: visible` so OP / 显示控制 menus still paint below. */
  min-height: 60px;
  overflow-x: clip;
  overflow-y: visible;
  background: var(--pr-bg-deep, #1f1f1f);
  border-bottom: 1px solid #3a3a3a;
  flex: 0 0 auto;
}

/** Top-left accent wash behind the OP selector / tab strip (v930 sketch).
 *  Lives here rather than on the report root, where `.pr-main` (`z-index: 1`, opaque)
 *  covered it. Paints above the strip background but below the tabs, which follow it
 *  in tree order and are positioned. */
.pr-chrome__wash {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 0;
  width: 208px;
  /* Stretch with the chrome — including when the toolbar wraps to a second row. */
  /* Horizontal radius 59% (not Figma's 150.89%): that ellipse overran the 208px
     box so α was still ~0.12 at the clip — a hard seam into #1f1f1f. 59% puts
     the transparent stop on the right edge ((1 - 0.41) / 0.59 ≈ 1). */
  background:
    radial-gradient(59% 100.4% at 41% 0%, rgba(44, 41, 175, 0.2) 0%, rgba(0, 0, 0, 0) 100%),
    linear-gradient(90deg, rgba(0, 90, 219, 0.1) 3.614%, rgba(0, 2, 172, 0) 76.501%);
  pointer-events: none;
}

.pr-tabs {
  /* Positioned so the tab labels paint over the wash rather than under it. */
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  min-width: 0;
}

/* Matches .pr-op-select__trigger: the brand and the OP selector occupy the same
   slot, so a pack with one operator must not read smaller than a multi-op pack. */
.pr-tabs__brand {
  margin-right: 8px;
  padding: 4px 8px;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  color: #ffffff;
  opacity: 0.95;
}

.pr-op-select {
  position: relative;
  margin-right: 4px;
}

.pr-op-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 4px 6px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  letter-spacing: 0;
  cursor: pointer;
}

.pr-op-select__trigger:hover {
  color: #ffffff;
  background: transparent;
}

.pr-op-select__label {
  white-space: nowrap;
}

.pr-op-select__chevron {
  color: #c8c8c8;
  flex: 0 0 auto;
  transition: transform 0.12s ease;
}

.pr-op-select__chevron--open {
  transform: rotate(180deg);
}

.pr-op-select__backdrop {
  position: fixed;
  inset: 0;
  z-index: 21;
}

.pr-op-select__menu {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  z-index: 22;
  min-width: 140px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--pr-surface-raised, #363636);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
}

.pr-op-select__item {
  padding: 6px 10px;
  border-radius: 4px;
  color: #d0d0d0;
  font-size: 12px;
  cursor: pointer;
}

/* Lightens against the raised menu surface; the previous #2a2a2a was darker than
   the menu, so hovering made the row recede. */
.pr-op-select__item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.pr-op-select__item--active {
  background: rgba(49, 122, 247, 0.2);
  color: #ffffff;
}

.pr-tabs__tab {
  position: relative;
  margin: 0;
  padding: 6px 12px;
  border: none;
  /* Transparent border keeps every tab the same height; the active underline is
     drawn by ::after so it tracks the label instead of the padded hit box. */
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--pr-tab-inactive, #b3b3b3);
  font-size: 12px;
  cursor: pointer;
}

.pr-tabs__tab:disabled {
  opacity: 0.4;
  cursor: default;
}

.pr-tabs__tab--active {
  color: #e8e8e8;
}

.pr-tabs__tab--active::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -2px;
  height: 2px;
  background: #ffffff;
}

.pr-toolbar {
  position: relative;
  display: flex;
  /* Keep search + zoom + actions as one unit so they wrap to row 2 together. */
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  /* Prefer wrapping over shrinking beside the tabs (`flex-shrink: 0`). Cap at the
     chrome width so a second-row toolbar that is still too wide crops trailing icons. */
  margin-left: auto;
  flex: 0 0 auto;
  max-width: 100%;
  overflow-x: clip;
  overflow-y: visible;
}

/* Search + zoom stay fully visible; rightmost icon actions are what get clipped. */
.pr-toolbar__search,
.pr-toolbar__zoom-pill,
.pr-toolbar__icon-btn,
.pr-toolbar__display-wrap,
.pr-toolbar__shortcut-wrap {
  flex-shrink: 0;
}

/* Search pill — ReportToolbar.spec Visual */
.pr-toolbar__search {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--pr-toolbar-h);
}

.pr-toolbar__search-icon {
  position: absolute;
  left: 10px;
  color: #9a9a9a;
  pointer-events: none;
  display: block;
}

.pr-toolbar__search input {
  box-sizing: border-box;
  width: 190px;
  height: var(--pr-toolbar-h);
  padding: 0 12px 0 32px;
  border: 0;
  border-radius: 4px;
  background: #2a2a2a;
  color: #e0e0e0;
  font-size: 12px;
}

.pr-toolbar__search input::placeholder {
  color: #808080;
}

.pr-toolbar__search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* Zoom compound pill */
.pr-toolbar__zoom-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: var(--pr-toolbar-h);
  padding: 0 4px;
  border-radius: 4px;
  background: #363636;
}

.pr-toolbar__zoom-btn {
  margin: 0;
  padding: 4px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #c8c8c8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.pr-toolbar__zoom-btn:hover {
  color: #fff;
}

.pr-toolbar__slider {
  width: 100px;
  height: 16px;
  margin: 0 2px;
  background: transparent;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.pr-toolbar__slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    #ffffff 0%,
    #ffffff var(--pr-zoom-fill, 50%),
    #1a1a1a var(--pr-zoom-fill, 50%),
    #1a1a1a 100%
  );
}

.pr-toolbar__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -4px;
  border-radius: 50%;
  background: #c8c8c8;
  border: 0;
  box-shadow: none;
}

.pr-toolbar__slider::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: #1a1a1a;
}

.pr-toolbar__slider::-moz-range-progress {
  height: 2px;
  border-radius: 1px;
  background: #ffffff;
}

.pr-toolbar__slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c8c8c8;
  border: 0;
}

/* Square action icon buttons */
.pr-toolbar__icon-btn {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border: 0;
  border-radius: 6px;
  background: #363636;
  color: #b3b3b3;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.pr-toolbar__icon-btn:hover,
.pr-toolbar__icon-btn:active,
.pr-toolbar__icon-btn--on,
.pr-toolbar__icon-btn[aria-pressed='true'],
.pr-toolbar__icon-btn[aria-expanded='true'] {
  background: #1e2a3e;
  color: #2d70e3;
}

.pr-toolbar__display-wrap {
  position: relative;
  display: inline-flex;
}

.pr-toolbar__display-control {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  box-sizing: border-box;
  min-width: 240px;
  padding: 20px 22px 22px;
  background: #363636;
  border: 1px solid #5e5e5e;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
}

.pr-toolbar__display-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 20px;
}

.pr-toolbar__display-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
}

.pr-toolbar__display-close {
  appearance: none;
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  line-height: 0;
  cursor: pointer;
}

.pr-toolbar__display-close:hover {
  color: #ffffff;
}

.pr-toolbar__display-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pr-toolbar__display-field + .pr-toolbar__display-field {
  margin-top: 16px;
}

.pr-toolbar__display-label {
  font-size: 12px;
  color: #b2b2b2;
  line-height: 1.2;
}

.pr-toolbar__display-help {
  appearance: none;
  position: relative;
  display: inline-grid;
  place-items: center;
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #a0a0a0;
  cursor: help;
  vertical-align: -3px;
}

.pr-toolbar__display-help:hover,
.pr-toolbar__display-help:focus-visible {
  color: #e6e6e6;
}

.pr-toolbar__display-help:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 2px;
  border-radius: 50%;
}

/* CSS-only bubble: `title` waits ~1s and renders as light-mode OS chrome (AC-20.2). */
.pr-toolbar__display-help-tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  z-index: 1;
  transform: translateX(-50%);
  /* Shrink-to-fit resolves against the 16px icon, so the text would set one glyph
     per line; max-width alone cannot widen it. */
  width: max-content;
  max-width: 220px;
  padding: 6px 8px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  color: #e6e6e6;
  font-size: 11px;
  line-height: 1.35;
  text-align: left;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
}

.pr-toolbar__display-help:hover .pr-toolbar__display-help-tip,
.pr-toolbar__display-help:focus-visible .pr-toolbar__display-help-tip {
  visibility: visible;
  opacity: 1;
}

/* Time display unit <select> matches the depth input field family (dark #404040,
   radius 6px, 32px, white text) plus a design chevron on the right. The native
   `<select>` cannot host child elements, so the chevron is an overlaid span that
   lets clicks fall through to the field. */
.pr-toolbar__display-select {
  position: relative;
  display: block;
}

.pr-toolbar__display-field select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  /* Right padding clears the overlaid chevron. */
  padding: 0 32px 0 12px;
  border: 0;
  border-radius: 6px;
  background-color: #404040;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.pr-toolbar__display-select-chevron {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  box-sizing: border-box;
  width: 10px;
  height: 10px;
  color: #b3b3b3;
}

/* Same border-triangle glyph as Chevron.vue, drawn down. */
.pr-toolbar__display-select-chevron::before {
  content: '';
  position: absolute;
  top: 1px;
  left: 2px;
  box-sizing: border-box;
  border-style: solid;
  border-color: currentColor;
  border-width: 0 1.2px 1.2px 0;
  width: 5px;
  height: 5px;
  transform: rotate(45deg);
}

/* The depth field's own ±1 stepper; the separate 任务显示单位 select above carries
   its own chevron. */

.pr-toolbar__display-stepper {
  position: relative;
  display: block;
}

.pr-toolbar__display-field input[type='number'] {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  /* Right padding clears the step column, so a 3-digit value never runs under it. */
  padding: 0 40px 0 12px;
  border: 0;
  border-radius: 6px;
  background-color: #404040;
  color: #ffffff;
  font-size: 12px;
  cursor: text;
  appearance: none;
  -webkit-appearance: none;
  /* `appearance: none` does not remove Chrome's inner spin button, which renders as a
     light-mode block on the dark field and ignores every rule below. Ours replaces it. */
  -moz-appearance: textfield;
}

.pr-toolbar__display-field input[type='number']::-webkit-outer-spin-button,
.pr-toolbar__display-field input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

/* Inside the field rather than beside it: the panel is one column of full-width rows,
   so a stepper alongside would have to steal width from the value it edits. Hairlines
   instead of a filled column, because the field is the only lit surface on the panel
   and a second one competes with it. */
.pr-toolbar__display-steps {
  position: absolute;
  top: 1px;
  right: 1px;
  bottom: 1px;
  display: flex;
  flex-direction: column;
  width: 28px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.pr-toolbar__display-step {
  appearance: none;
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  cursor: pointer;
}

.pr-toolbar__display-step + .pr-toolbar__display-step {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

/* Follow the field's own corners; square inner edges keep the pair reading as one. */
.pr-toolbar__display-step:first-child {
  border-radius: 0 5px 0 0;
}

.pr-toolbar__display-step:last-child {
  border-radius: 0 0 5px;
}

/* Same two tints as the operator menu's rows (AC-21.3), so every hit target on the
   toolbar's popovers answers the pointer the same way. */
.pr-toolbar__display-step:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.pr-toolbar__display-step:active:not(:disabled) {
  background: rgba(49, 122, 247, 0.2);
  color: var(--pr-text-accent, #2d70e3);
}

/* Held at a clamp: dimmed and inert rather than hidden, so the control keeps its shape
   and the bound is legible instead of the button seeming to have stopped working. */
.pr-toolbar__display-step:disabled {
  color: #5e5e5e;
  cursor: default;
}

/* Chrome draws its focus ring on click for text and range inputs, not just on
   keyboard entry, so suppress the default and re-add it for :focus-visible only. */
.pr-toolbar__search input:focus,
.pr-toolbar__slider:focus,
.pr-toolbar__display-field input[type='number']:focus,
.pr-toolbar__display-field select:focus {
  outline: none;
}

.pr-toolbar__search input:focus-visible,
.pr-toolbar__slider:focus-visible,
.pr-toolbar__display-field input[type='number']:focus-visible,
.pr-toolbar__display-field select:focus-visible {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 1px;
}

.pr-toolbar__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

/* Shortcut-help (快捷键说明) — PyPTO layout/glyphs; dismiss matches 显示控制. */
.pr-toolbar__shortcut-wrap {
  position: relative;
  display: inline-flex;
}

.pr-toolbar__shortcut-help {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  box-sizing: border-box;
  width: 450px;
  padding: 16px 20px 20px;
  background: #363636;
  border: 1px solid #5e5e5e;
  border-radius: 16px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
  color: #e8e8e8;
}

.pr-toolbar__shortcut-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.pr-toolbar__shortcut-title {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.pr-toolbar__shortcut-close {
  appearance: none;
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  line-height: 0;
  cursor: pointer;
}

.pr-toolbar__shortcut-close:hover {
  color: #ffffff;
}

.pr-toolbar__shortcut-information {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.pr-toolbar__shortcut-mouse-key {
  display: flex;
  flex-direction: row;
  gap: 40px;
}

.pr-toolbar__shortcut-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.pr-toolbar__shortcut-column--combined {
  flex: none;
  width: 100%;
}

.pr-toolbar__shortcut-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #e8e8e8;
  line-height: 1.2;
}

.pr-toolbar__shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  font-weight: 400;
  color: #b2b2b2;
}

.pr-toolbar__shortcut-pair-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
}

.pr-toolbar__shortcut-pair {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 400;
  color: #b2b2b2;
}

.pr-toolbar__shortcut-glyphs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pr-toolbar__shortcut-glyph {
  display: block;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
</style>
