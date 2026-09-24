<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import type { PerformanceHintItem } from '../../domain/types';
import CloseButton from '../CloseButton.vue';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../panelResize';

const props = withDefaults(
  defineProps<{
    /** Joined hint rows (adapter preserves CSV order; 53 on gelu). */
    rows: PerformanceHintItem[];
    locale?: string;
    /** Dock height in px, owned by the parent shell (shared with DetailPanel / MultiSelectSummary). */
    height?: number;
  }>(),
  {
    height: DOCK_HEIGHT_COLLAPSED,
    locale: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  'update:height': [height: number];
}>();

const expanded = computed(() => props.height >= DOCK_HEIGHT_EXPANDED);

const expanderLabel = computed(() =>
  t(expanded.value ? 'collapseDock' : 'expandDock', props.locale),
);

function toggleExpanded(): void {
  emit('update:height', expanded.value ? DOCK_HEIGHT_COLLAPSED : DOCK_HEIGHT_EXPANDED);
}

/**
 * Instruction-address cell. `pc` keeps its exact decimal digits (the adapter never turns
 * it into a JS number), so the sketch's `0x` form needs a BigInt round-trip; a row with
 * no address shows the "Not specified" copy. Anything BigInt rejects — a host-supplied
 * hex string, a malformed CSV cell — has no decimal value to convert, so it is echoed
 * verbatim rather than blanking the column.
 */
function formatPc(pc: PerformanceHintItem['pc'] | null, locale?: string): string {
  if (pc == null) return t('notSpecified', locale);
  try {
    return `0x${BigInt(pc).toString(16)}`;
  } catch {
    return String(pc);
  }
}
</script>

<template>
  <section
    class="pr-hints"
    data-testid="performance-hints-dock"
  >
    <button
      type="button"
      class="pr-hints__expander"
      :class="{ 'pr-hints__expander--expanded': expanded }"
      data-testid="performance-hints-expander"
      :aria-label="expanderLabel"
      :aria-expanded="expanded"
      :title="expanderLabel"
      @click="toggleExpanded"
    >
      <span class="pr-hints__expander-bar" />
      <span class="pr-hints__expander-arrow" />
    </button>
    <header class="pr-hints__head">
      <h3 class="pr-hints__title">
        {{ t('performanceAnalysis', locale) }}
      </h3>
      <CloseButton
        data-testid="performance-hints-close"
        :label="t('closePanel', locale)"
        @click="emit('close')"
      />
    </header>
    <div class="pr-hints__body">
      <div
        class="pr-hints-table"
        role="table"
        :aria-label="t('performanceAnalysis', locale)"
      >
        <div
          class="pr-hints-table__head"
          role="row"
        >
          <div
            class="pr-hints-table__msg-col"
            role="columnheader"
          >
            {{ t('hintMessage', locale) }}
          </div>
          <div
            class="pr-hints-table__line-col"
            role="columnheader"
          >
            {{ t('sourceLine', locale) }}
          </div>
          <div
            class="pr-hints-table__pc-col"
            role="columnheader"
          >
            {{ t('instructionAddress', locale) }}
          </div>
        </div>
        <div
          class="pr-hints-table__tbody"
          role="rowgroup"
        >
          <div
            v-for="(row, i) in rows"
            :key="`${row.origin}-${i}`"
            class="pr-hints-table__row"
            role="row"
          >
            <div
              class="pr-hints-table__msg"
              role="cell"
            >
              <span class="pr-hints-table__text">{{ row.message }}</span>
            </div>
            <div
              class="pr-hints-table__line"
              role="cell"
              data-testid="performance-hints-line"
            >
              {{ row.sourceLineId ?? t('notSpecified', locale) }}
            </div>
            <div
              class="pr-hints-table__pc"
              role="cell"
              data-testid="performance-hints-pc"
            >
              {{ formatPc(row.pc, locale) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pr-hints {
  display: flex;
  flex-direction: column;
  /* Anchors the centred expander on the pane's own top edge — the shell owns the border. */
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0 16px;
}

/* The pane's affordance for the shared dock height: a 14x1 bar with a small solid
   triangle, straddling the top edge. The pair swaps order between states — triangle
   above the bar reads as "push up to expand", below it as "push down to collapse" —
   which is the flex direction flip. Same sketch geometry as DetailPanel's expander,
   so either pane drives the one dock height. */
.pr-hints__expander {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 2px;
  /* Padding only, so the plate keeps its sketch position while the hit target
     reaches a usable size. */
  margin: 0;
  padding: 4px 16px 10px;
  border: 0;
  background: transparent;
  color: #6c6c6c;
  cursor: pointer;
}

.pr-hints__expander--expanded {
  flex-direction: column;
}

.pr-hints__expander:hover {
  color: #b3b3b3;
}

.pr-hints__expander-bar {
  width: 14px;
  height: 1px;
  background: currentColor;
}

.pr-hints__expander-arrow {
  width: 0;
  height: 0;
  border-right: 3px solid transparent;
  border-bottom: 4px solid currentColor;
  border-left: 3px solid transparent;
}

.pr-hints__expander--expanded .pr-hints__expander-arrow {
  border-top: 4px solid currentColor;
  border-bottom: 0;
}

.pr-hints__head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
}

.pr-hints__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.pr-hints__body {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding-bottom: 12px;
}

.pr-hints-table {
  width: 100%;
}

/* Table header row (sketch measurements). */
.pr-hints-table__head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: flex-start;
  height: 24px;
  box-sizing: border-box;
  padding: 4px 16px;
  background: rgba(38, 38, 38, 1); /* #262626 */
  border-radius: 8px 8px 0 0;
}

/* Header cell text. */
.pr-hints-table__msg-col,
.pr-hints-table__line-col,
.pr-hints-table__pc-col {
  color: rgba(153, 153, 153, 1); /* #999999 */
  font-size: 12px;
  font-weight: 400;
  line-height: 14px;
  letter-spacing: 0;
  text-align: left;
  white-space: nowrap;
}

/* Body row (sketch measurements). */
.pr-hints-table__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  /* ponytail: min-height instead of the sketch's fixed 32px — long
     messages wrap on narrow docks and a fixed height would clip them. */
  min-height: 32px;
  box-sizing: border-box;
  padding: 6px 16px;
  background: rgba(31, 31, 31, 1); /* #1F1F1F */
  box-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.05);
}

.pr-hints-table__row:hover {
  background: rgba(255, 255, 255, 0.02);
}

/* Column flex bases — identical on header and body so columns align.
   50% / 25% / 25% split (user spec; replaces the fixed-pixel/gap geometry). */
.pr-hints-table__msg-col,
.pr-hints-table__msg {
  flex: 0 0 50%;
  min-width: 0;
}

.pr-hints-table__line-col,
.pr-hints-table__line {
  flex: 0 0 25%;
}

.pr-hints-table__pc-col,
.pr-hints-table__pc {
  flex: 0 0 25%;
}

/* Body cell text. */
.pr-hints-table__msg,
.pr-hints-table__line,
.pr-hints-table__pc {
  display: flex;
  flex-direction: row;
  align-items: center;
  color: rgba(230, 230, 230, 1); /* #E6E6E6 */
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0;
  text-align: left;
}

.pr-hints-table__text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.pr-hints-table__pc {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
