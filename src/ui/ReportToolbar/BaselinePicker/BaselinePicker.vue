<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import PrIcon from '../../PrIcon.vue';
import CloseButton from '../../CloseButton.vue';
import { t } from '../../../i18n';
import { newBaselineId } from '../../../domain/baselineId';
import type { Baseline, BaselinePick } from '../../../domain/types';

/**
 * Fallthrough attrs (ReportToolbar passes `data-toolbar-clip`) bind to the
 * trigger button, not the wrapper — the clip-inert scan and the right-aligned
 * tooltip rule both target the button.
 */
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /**
     * Host-owned checked reports (对比基线): the checkbox state IS this list.
     * The picker only renders and toggles — every change emits the new list via
     * `update:baselines` and the host owns persistence.
     */
    baselines: Baseline[];
    /**
     * Host file dialog (Browse). Absent = the trigger is not rendered: the
     * library never reads the filesystem itself (same contract as
     * `resolveSourceFile`).
     */
    pickBaselineFile?: () => Promise<BaselinePick | null>;
    /**
     * The host's own report list — every row is one checkbox (MSTT: the live
     * Performance results tree; the bundled web hosts: the shared demo list).
     */
    recentBaselines?: Baseline[];
    locale?: string;
  }>(),
  {
    pickBaselineFile: undefined,
    recentBaselines: undefined,
    locale: undefined,
  },
);

const emit = defineEmits<{
  /** The new checked set after a toggle or Browse — host-owned persistence. */
  'update:baselines': [baselines: Baseline[]];
}>();

const open = ref(false);
/** Wrap owns the trigger and the panel, so an outside hit is anything not in here. */
const wrapRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const closeRef = ref<ComponentPublicInstance | null>(null);
const panelId = useId().replace(/:/g, '');
const titleId = useId().replace(/:/g, '');
/** True while the host file dialog is open — Browse stays disabled meanwhile. */
const picking = ref(false);
/** Inline max-height so the panel + Browse stay inside short viewports. */
const panelMaxHeight = ref('none');
/** Live region: announces a Browse pick that appended a row (WCAG 4.1.3). */
const announce = ref('');

/**
 * Checkbox rows: the host's recent reports first, then checked entries the
 * recent list does not carry (session browsed picks) — derived from the
 * host-owned list, so the popover never keeps a private copy of the state.
 */
const recentIds = computed(() => new Set((props.recentBaselines ?? []).map((r) => r.id)));
const extraRows = computed(() => props.baselines.filter((b) => !recentIds.value.has(b.id)));
/* Dedupe by id: a host bug must not yield duplicate keys or an ambiguous row. */
const rows = computed<Baseline[]>(() => {
  const seen = new Set<string>();
  return [...(props.recentBaselines ?? []), ...extraRows.value].filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
});

function isChecked(id: string): boolean {
  return props.baselines.some((b) => b.id === id);
}

/**
 * Row to receive focus after the host applies an uncheck that unmounts the row.
 * Extra rows exist only while checked, so unchecking one removes the focused
 * checkbox from the DOM; without a move, focus falls to `body` and keyboard
 * users restart tabbing from the top. `undefined` = no pending move.
 */
let pendingFocusId: string | null | undefined;
watch(
  () => props.baselines,
  async () => {
    if (pendingFocusId === undefined) return;
    const targetId = pendingFocusId;
    pendingFocusId = undefined;
    await nextTick();
    const inputs = [
      ...(wrapRef.value?.querySelectorAll<HTMLInputElement>('[data-testid="baseline-check"]') ?? []),
    ];
    const target = targetId != null ? inputs.find((el) => el.dataset.rowId === targetId) : undefined;
    (target ?? triggerRef.value)?.focus();
  },
);

function setChecked(row: Baseline, checked: boolean): void {
  if (checked) {
    // Insert at the row's visible position, not at the end: hosts may use the
    // list order (comparison order, persistence), and appending would make the
    // stored order drift from the visible one on every toggle.
    const rest = props.baselines.filter((b) => b.id !== row.id);
    const index = rows.value.findIndex((r) => r.id === row.id);
    const next = index >= 0 && index <= rest.length
      ? [...rest.slice(0, index), row, ...rest.slice(index)]
      : [...rest, row];
    emit('update:baselines', next);
    return;
  }
  emit('update:baselines', props.baselines.filter((b) => b.id !== row.id));
  if (recentIds.value.has(row.id)) return;
  const index = rows.value.findIndex((r) => r.id === row.id);
  const neighbour = rows.value[index + 1] ?? rows.value[index - 1];
  pendingFocusId = neighbour?.id ?? null;
}

async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  await nextTick();
  positionPanel();
  // A dialog must be entered, not merely shown: move focus to its close button
  // so screen readers announce the panel and Tab continues inside it.
  (closeRef.value?.$el as HTMLElement | undefined)?.focus();
}

/**
 * Cap the panel to the space under the trigger so the footer (Browse) never
 * falls below the viewport — the page cannot scroll the chrome away.
 * ponytail: the cap is computed on open only; a resize while open keeps the
 * old cap. Upgrade path: recompute on window resize while open.
 */
function positionPanel() {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const bottom = trigger.getBoundingClientRect().bottom;
  const cap = Math.max(120, window.innerHeight - bottom - 6 - 10);
  panelMaxHeight.value = `${cap}px`;
}

async function close(opts?: { restoreFocus?: boolean }) {
  open.value = false;
  if (opts?.restoreFocus) {
    await nextTick();
    triggerRef.value?.focus();
  }
}

/**
 * Pointer outside the wrap closes the panel immediately — the same dismiss
 * contract as 显示控制: `pointerdown` so a drag that starts outside still
 * dismisses, and so the listener can be attached during the opening click
 * (that click's pointerdown already fired, so it cannot bounce the panel shut).
 * Focus stays where the user clicked — no restore here. The checked set
 * survives closing — the host-owned list lives in the parent.
 */
function onOutsidePointerDown(e: PointerEvent) {
  const wrap = wrapRef.value;
  if (!wrap || !(e.target instanceof Node) || wrap.contains(e.target)) return;
  void close();
}

/** Keyboard dismissal returns focus to the trigger (the × close is removed with the panel). */
function onEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  void close({ restoreFocus: true });
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onOutsidePointerDown);
    document.addEventListener('keydown', onEscape);
  } else {
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    document.removeEventListener('keydown', onEscape);
  }
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onOutsidePointerDown);
  document.removeEventListener('keydown', onEscape);
});

/**
 * The root is `v-if`-gated on the hook; removing the hook at runtime removes
 * the DOM without unmounting this component. Close so the stale open state and
 * its document listeners cannot survive a hook flip.
 */
watch(
  () => props.pickBaselineFile,
  (hook) => {
    if (!hook) void close();
  },
);

/**
 * Dedupe identity: the same file written differently (letter case, a trailing
 * separator) must not become two baselines — compare a normalized form.
 */
function sameBaselinePath(a: string, b: string): boolean {
  const norm = (p: string) =>
    p.trim().replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
}

/**
 * Browse: the file dialog pick joins the checkbox list as a CHECKED row (it is
 * appended to the host-owned list right away — the popover has no local state).
 * The same file already checked changes nothing (normalized path compare).
 */
async function browse(): Promise<void> {
  if (!props.pickBaselineFile || picking.value) return;
  picking.value = true;
  try {
    let pick: BaselinePick | null;
    try {
      pick = await props.pickBaselineFile();
    } catch (cause) {
      // A host dialog failure (permissions, VS Code API error) must not look
      // like a silent Cancel: log it so the host/devtools can see it.
      console.error('[BaselinePicker] pickBaselineFile failed', cause);
      return;
    }
    if (!pick) return;
    const path = pick.path;
    if (props.baselines.some((b) => sameBaselinePath(b.path, path))) return;
    const entry: Baseline = {
      id: newBaselineId(),
      name: pick.name?.trim() || path.split(/[\\/]/).pop() || path,
      path,
    };
    emit('update:baselines', [...props.baselines, entry]);
    announcePick(entry.name);
  } finally {
    picking.value = false;
  }
}

/** Screen readers hear a Browse append; the text is cleared then set so an
 *  identical re-add still re-announces (mutation, not assignment). */
function announcePick(name: string) {
  announce.value = '';
  const text = t('baselineAdded', props.locale).replace('{name}', name);
  void nextTick(() => {
    announce.value = text;
  });
}
</script>

<template>
  <div
    v-if="pickBaselineFile"
    ref="wrapRef"
    class="pr-baseline-wrap"
  >
    <button
      ref="triggerRef"
      v-bind="$attrs"
      type="button"
      class="pr-toolbar__icon-btn pr-icon-tip"
      data-testid="toggle-baselines"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      :class="{ 'pr-toolbar__icon-btn--on': open }"
      :aria-label="t('baselines', locale)"
      @click="toggle"
    >
      <PrIcon name="add-baseline" />
    </button>

    <div
      v-if="open"
      :id="panelId"
      class="pr-baseline"
      data-testid="baselines-popover"
      role="dialog"
      :aria-label="t('baselines', locale)"
      :style="{ maxHeight: panelMaxHeight }"
    >
      <p
        class="pr-baseline__sr"
        role="status"
      >{{ announce }}</p>
      <div class="pr-baseline__head">
        <span
          :id="titleId"
          class="pr-baseline__title"
        >{{ t('baselineAddTitle', locale) }}</span>
        <CloseButton
          ref="closeRef"
          class="pr-baseline__close"
          data-testid="baselines-close"
          :label="t('closePanel', locale)"
          @click="close({ restoreFocus: true })"
        />
      </div>

      <div
        class="pr-baseline__list"
        data-testid="baselines-recent-list"
        role="group"
        :aria-labelledby="titleId"
      >
        <p
          v-if="rows.length === 0"
          class="pr-baseline__empty"
          data-testid="baselines-recent-empty"
        >
          {{ t('baselineRecentEmpty', locale) }}
        </p>
        <label
          v-for="row in rows"
          :key="row.id"
          class="pr-baseline__item pr-baseline__item--check"
        >
          <span class="pr-baseline__check">
            <input
              type="checkbox"
              class="pr-baseline__check-input"
              data-testid="baseline-check"
              :data-row-id="row.id"
              :checked="isChecked(row.id)"
              @change="setChecked(row, ($event.target as HTMLInputElement).checked)"
            >
            <span
              class="pr-baseline__check-dot"
              aria-hidden="true"
            />
          </span>
          <span class="pr-baseline__pick">
            <span class="pr-baseline__name">{{ row.name }}</span>
            <!-- The path is how users tell same-named runs apart; when it IS the
                 name (demo OPPROF rows) a second copy only halves the line. -->
            <span
              v-if="row.path !== row.name"
              class="pr-baseline__path"
            >{{ row.path }}</span>
          </span>
        </label>
      </div>

      <div class="pr-baseline__foot">
        <button
          type="button"
          class="pr-baseline__action pr-baseline__action--primary"
          data-testid="baseline-browse"
          :disabled="picking"
          @click="browse"
        >
          {{ t('baselineBrowse', locale) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-baseline-wrap {
  position: relative;
  display: inline-flex;
}

/* Width adapts to the content: short rows keep the compact 240px panel, wide
   names (full opprof run names like `OPPROF_<ts>_<16 letters>`) grow it up to
   480px before the row ellipsis takes over. */
.pr-baseline {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: 240px;
  max-width: 480px;
  padding: 16px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid #5e5e5e;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
  /* Inline `max-height` on open caps the panel to the viewport; the list takes
     the remainder and scrolls, so the footer (Browse) stays reachable. */
}

.pr-baseline__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.pr-baseline__head,
.pr-baseline__foot {
  flex: 0 0 auto;
}

.pr-baseline__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.pr-baseline__title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
}

.pr-baseline__close {
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

.pr-baseline__close:hover {
  color: #ffffff;
}

.pr-baseline__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Natural cap for tall viewports; the panel's inline max-height (short
     viewports) shrinks this first, then it scrolls. */
  flex: 1 1 auto;
  min-height: 0;
  max-height: 260px;
  overflow-y: auto;
}

.pr-baseline__empty {
  margin: 0;
  padding: 8px 4px;
  color: #b3b3b3;
  font-size: 12px;
  line-height: 1.4;
}

.pr-baseline__item {
  display: flex;
  align-items: stretch;
  gap: 2px;
  margin: 0;
  padding: 0;
  border-radius: 4px;
  background: transparent;
  color: #d0d0d0;
  font-size: 12px;
  line-height: 1.4;
}

/* Same two tints as the operator menu's rows, so every toolbar popover answers
   the pointer the same way. */
.pr-baseline__item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* Checkbox rows are labels: the whole row toggles the check. */
.pr-baseline__item--check {
  cursor: pointer;
}

/* Checkbox dot: 12px square (same family as the radio dot was, square = multi). */
.pr-baseline__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  align-self: center;
  padding: 0;
}

.pr-baseline__check-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.pr-baseline__check-input:focus-visible ~ .pr-baseline__check-dot {
  outline: 2px solid var(--pr-playhead, #3078f0);
  outline-offset: 1px;
}

.pr-baseline__check-dot {
  position: relative;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border: 1px solid #8a8a8a;
  border-radius: 2px;
  background: transparent;
}

.pr-baseline__check-input:checked ~ .pr-baseline__check-dot {
  border-color: var(--pr-accent, #6a9ff0);
  background: var(--pr-accent, #6a9ff0);
}

/* Checked state gets a non-colour cue too (WCAG 1.4.1): a white tick inside the
   filled square, so the state does not rely on the accent alone. */
.pr-baseline__check-input:checked ~ .pr-baseline__check-dot::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 7px;
  border: solid #ffffff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

.pr-baseline__pick {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 6px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.pr-baseline__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-baseline__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #bdbdbd;
  font-size: 11px;
}

.pr-baseline__item:hover .pr-baseline__path {
  color: #c8c8c8;
}

/* Footer: Browse only — the checkbox set IS the saved list. */
.pr-baseline__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin: 12px 0 0;
}

.pr-baseline__action {
  appearance: none;
  margin: 0;
  padding: 5px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #a9c9f5;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.pr-baseline__action:hover {
  background: rgba(255, 255, 255, 0.1);
}

.pr-baseline__action:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
