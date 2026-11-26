<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import PrIcon from '../../PrIcon.vue';
import CloseButton from '../../CloseButton.vue';
import { t } from '../../../i18n';
import { newBaselineId } from '../../../domain/baselineId';
import { baselineDisplayTitle } from '../../../domain/baselineTitle';
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
/** Wrap owns the trigger; the panel teleports to body (see the open watcher). */
const wrapRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
/** Fixed coords — the panel teleports to body to clear the body-level hover
 *  stems (OverviewCharts paints them at z-index 998; an in-tree popover under
 *  `.pr-main`'s z-index 1 can never beat them). */
const panelStyle = ref<Record<string, string>>({
  position: 'fixed',
  top: '-9999px',
  left: '-9999px',
  zIndex: '1000',
});
const PANEL_GAP_PX = 6;
const PANEL_MARGIN_PX = 8;

/** Anchor under the trigger, right-aligned; clamp so the panel stays in the viewport. */
function positionPanel() {
  const trigger = triggerRef.value;
  const panel = panelRef.value;
  if (!trigger || !panel) return;
  const r = trigger.getBoundingClientRect();
  const width = panel.getBoundingClientRect().width;
  let left = r.right - width;
  const maxLeft = Math.max(PANEL_MARGIN_PX, window.innerWidth - width - PANEL_MARGIN_PX);
  left = Math.min(Math.max(left, PANEL_MARGIN_PX), maxLeft);
  panelStyle.value = {
    position: 'fixed',
    top: `${r.bottom + PANEL_GAP_PX}px`,
    left: `${left}px`,
    right: 'auto',
    zIndex: '1000',
  };
}

/**
 * Checkbox rows: the host's recent reports first, then checked entries the
 * recent list does not carry (session browsed picks) — derived from the
 * host-owned list, so the popover never keeps a private copy of the state.
 */
const recentIds = computed(() => new Set((props.recentBaselines ?? []).map((r) => r.id)));
const extraRows = computed(() => props.baselines.filter((b) => !recentIds.value.has(b.id)));
const rows = computed<Baseline[]>(() => [...(props.recentBaselines ?? []), ...extraRows.value]);

function isChecked(id: string): boolean {
  return props.baselines.some((b) => b.id === id);
}

/** Row title: filename + timestamp instead of a generated boilerplate id (review PR #234). */
function titleOf(row: Baseline): string {
  return baselineDisplayTitle(row);
}

function setChecked(row: Baseline, checked: boolean): void {
  const next = checked
    ? [...props.baselines.filter((b) => b.id !== row.id), row]
    : props.baselines.filter((b) => b.id !== row.id);
  emit('update:baselines', next);
}

function toggle() {
  if (!open.value) {
    // Off-screen until the post-render anchor runs: the panel is teleported to
    // body, so an unpositioned first paint would flash at the document end.
    panelStyle.value = { position: 'fixed', top: '-9999px', left: '-9999px', zIndex: '1000' };
  }
  open.value = !open.value;
}

async function close(opts?: { restoreFocus?: boolean }) {
  open.value = false;
  if (opts?.restoreFocus) {
    await nextTick();
    triggerRef.value?.focus();
  }
}

/**
 * Pointer outside the trigger or the teleported panel closes it immediately —
 * the same dismiss contract as 显示控制: `pointerdown` so a drag that starts
 * outside still dismisses, and so the listener can be attached during the
 * opening click (that click's pointerdown already fired, so it cannot bounce
 * the panel shut). Focus stays where the user clicked — no restore here. The
 * checked set survives closing — the host-owned list lives in the parent.
 */
function onOutsidePointerDown(e: PointerEvent) {
  if (!(e.target instanceof Node)) return;
  if (wrapRef.value?.contains(e.target)) return;
  if (panelRef.value?.contains(e.target)) return;
  void close();
}

/** Keyboard dismissal returns focus to the trigger (the × close is removed with the panel). */
function onEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  void close({ restoreFocus: true });
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    positionPanel();
    document.addEventListener('pointerdown', onOutsidePointerDown);
    document.addEventListener('keydown', onEscape);
    window.addEventListener('resize', positionPanel);
  } else {
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    document.removeEventListener('keydown', onEscape);
    window.removeEventListener('resize', positionPanel);
  }
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onOutsidePointerDown);
  document.removeEventListener('keydown', onEscape);
  window.removeEventListener('resize', positionPanel);
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
 * Browse: the file dialog pick joins the checkbox list as a CHECKED row (it is
 * appended to the host-owned list right away — the popover has no local state).
 * The same file already checked changes nothing.
 */
async function browse(): Promise<void> {
  if (!props.pickBaselineFile) return;
  let pick: BaselinePick | null;
  try {
    pick = await props.pickBaselineFile();
  } catch {
    return;
  }
  if (!pick) return;
  const path = pick.path;
  if (props.baselines.some((b) => b.path === path)) return;
  const entry: Baseline = {
    id: newBaselineId(),
    name: pick.name?.trim() || path.split(/[\\/]/).pop() || path,
    path,
    // The derived title's timestamp (review PR #234): the host's mtime, else
    // the pick moment.
    pickedAt: pick.pickedAt ?? Date.now(),
  };
  emit('update:baselines', [...props.baselines, entry]);
}

// The root closes the popover when the aside's Baseline / Operator bar is used
// (review PR #234) — the aside stops pointerdown, so the outside-dismiss never
// sees those clicks.
defineExpose({ close });
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
      :aria-pressed="open"
      :class="{ 'pr-toolbar__icon-btn--on': open }"
      :aria-label="t('baselines', locale)"
      @click="toggle"
    >
      <PrIcon name="add-baseline" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="pr-baseline"
        :style="panelStyle"
        data-testid="baselines-popover"
        role="dialog"
        :aria-label="t('baselines', locale)"
      >
        <div class="pr-baseline__head">
          <span class="pr-baseline__title">{{ t('baselineAddTitle', locale) }}</span>
          <CloseButton
            class="pr-baseline__close"
            data-testid="baselines-close"
            :label="t('closePanel', locale)"
            @click="close({ restoreFocus: true })"
          />
        </div>

        <div
          class="pr-baseline__list"
          data-testid="baselines-recent-list"
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
                :checked="isChecked(row.id)"
                @change="setChecked(row, ($event.target as HTMLInputElement).checked)"
              >
              <span
                class="pr-baseline__check-dot"
                aria-hidden="true"
              />
            </span>
            <span class="pr-baseline__pick">
              <span class="pr-baseline__name">{{ titleOf(row) }}</span>
              <span class="pr-baseline__path">{{ row.path }}</span>
            </span>
          </label>
        </div>

        <div class="pr-baseline__foot">
          <button
            type="button"
            class="pr-baseline__action pr-baseline__action--primary"
            data-testid="baseline-browse"
            @click="browse"
          >
            {{ t('baselineBrowse', locale) }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pr-baseline-wrap {
  position: relative;
  display: inline-flex;
}

/* Width adapts to the content: short rows keep the compact 240px panel, wide
   names (full opprof run names like `OPPROF_<ts>_<16 letters>`) grow it up to
   480px before the row ellipsis takes over. The teleported panel's position,
   top/left and z-index come from the inline anchor style (fixed, 1000) so the
   body-level overview stems at 998 can never paint over it. */
.pr-baseline {
  box-sizing: border-box;
  width: max-content;
  min-width: 240px;
  max-width: 480px;
  padding: 16px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid #5e5e5e;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
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
  max-height: 260px;
  overflow-y: auto;
  /* Teleported to `body` — outside `.pr-root` — so the tokens.css scrollbar
     rules do not apply. Mirror the other teleported menus (SourcePillSelect,
     CardMetricSelect): keep AUTO so Chromium stays in custom-ruleset mode and
     paints the ::-webkit-scrollbar block below; any non-auto value makes it
     drop that whole block and paint its default bar with step buttons — the
     arrow squares issue #266 is about. */
  scrollbar-width: auto;
  scrollbar-color: auto;
}

.pr-baseline__list::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.pr-baseline__list::-webkit-scrollbar-track {
  background: transparent;
}

.pr-baseline__list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 4px;
  background: #5a5a5a;
  background-clip: content-box;
}

.pr-baseline__list::-webkit-scrollbar-thumb:hover {
  background: #6e6e6e;
  background-clip: content-box;
}

.pr-baseline__list::-webkit-scrollbar-corner {
  background: transparent;
}

.pr-baseline__list::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

.pr-baseline__empty {
  margin: 0;
  padding: 8px 4px;
  color: #808080;
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
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border: 1px solid #8a8a8a;
  border-radius: 2px;
  background: transparent;
}

.pr-baseline__check-input:checked ~ .pr-baseline__check-dot {
  border-color: var(--pr-accent, #2d70e3);
  background: var(--pr-accent, #2d70e3);
  box-shadow: inset 0 0 0 2px var(--pr-surface-raised, #363636);
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
  color: #8a8a8a;
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
  color: #2d70e3;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.pr-baseline__action:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #6a9ff0;
}
</style>
