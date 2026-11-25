<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import PrIcon from '../../PrIcon.vue';
import type { DiffTone } from '../../../domain/metricDiff';
import type { BaselineTipRow } from '../baselineTip';

const props = withDefaults(
  defineProps<{
    /** 'increase' = red up arrow, 'decrease' = green down arrow. */
    tone: DiffTone;
    /** Unsigned delta text with the source unit already attached (e.g. '5%'). */
    text: string;
    /** Screen-reader direction word (i18n). */
    directionLabel: string;
    /**
     * Multi-baseline comparison (对比基线): every row's value + delta for this
     * metric. The inline value is row 0; hovering the indicator paints the
     * full list (the other baselines live only in this popup).
     */
    tip?: BaselineTipRow[] | null;
    /**
     * Keyboard reachability (default true): a focusable badge opens the popup
     * on focus, which is right for the handful of card / PIPE / topology
     * badges. Dense details lists pass false and expose the same text through
     * `aria-describedby` instead, so dozens of field rows add no tab stops.
     */
    focusable?: boolean;
  }>(),
  { tip: undefined, focusable: true },
);

const tipId = useId();
const tipText = computed(() =>
  (props.tip ?? [])
    .map((entry) => `${entry.label} ${entry.value}${entry.delta ? ` ${entry.delta}` : ''}`)
    .join('; '),
);
/** Dense lists: described text, no tab stop; focusable badges keep the focus. */
const describedBy = computed(() =>
  !props.focusable && props.tip && props.tip.length > 0 ? tipId : undefined,
);

const root = ref<HTMLElement | null>(null);
const tipOpen = ref(false);
const tipStyle = ref<Record<string, string>>({});
/** The popup's widest painted box; the flip below assumes it. */
const TIP_MAX_W = 320;
const TIP_GAP = 8;

/** Anchor the teleported popup beside the indicator, flipping to stay in view. */
function openTip() {
  if (!props.tip || props.tip.length === 0) return;
  const el = root.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const toRight = r.right + TIP_GAP + TIP_MAX_W <= vw;
  const below = r.top < vh / 2;
  tipStyle.value = {
    left: toRight ? `${r.right + TIP_GAP}px` : 'auto',
    right: toRight ? 'auto' : `${vw - r.left + TIP_GAP}px`,
    top: below ? `${r.bottom + 6}px` : 'auto',
    bottom: below ? 'auto' : `${vh - r.top + 6}px`,
  };
  tipOpen.value = true;
}

function closeTip() {
  tipOpen.value = false;
}
</script>

<template>
  <span
    ref="root"
    class="pr-diff"
    :class="`pr-diff--${tone}`"
    :tabindex="focusable && tip && tip.length ? 0 : undefined"
    :aria-describedby="describedBy"
    data-testid="stats-diff"
    @pointerenter="openTip"
    @pointerleave="closeTip"
    @focus="openTip"
    @blur="closeTip"
  >
    <span
      class="pr-diff__badge"
      aria-hidden="true"
    >
      <PrIcon :name="tone === 'increase' ? 'diff-up' : 'diff-down'" />
    </span>
    <span class="pr-diff__text">{{ text }}</span>
    <span class="pr-field-sr">{{ directionLabel }}</span>
    <span
      v-if="describedBy"
      :id="tipId"
      class="pr-field-sr"
    >{{ tipText }}</span>
    <Teleport to="body">
      <div
        v-if="tipOpen && tip && tip.length"
        class="pr-diff-tip"
        role="tooltip"
        data-testid="baseline-compare-tip"
        :style="tipStyle"
      >
        <div
          v-for="(entry, i) in tip"
          :key="i"
          class="pr-diff-tip__row"
          :class="{ 'pr-diff-tip__row--current': !entry.tone }"
          :data-testid="`baseline-compare-tip-row-${i + 1}`"
        >
          <span class="pr-diff-tip__label">{{ entry.label }}</span>
          <span class="pr-diff-tip__value">{{ entry.value }}</span>
          <span
            v-if="entry.tone && entry.delta"
            class="pr-diff"
            :class="`pr-diff--${entry.tone}`"
          >
            <span
              class="pr-diff__badge"
              aria-hidden="true"
            >
              <PrIcon :name="entry.tone === 'increase' ? 'diff-up' : 'diff-down'" />
            </span>
            <!-- The popup prints the bare magnitude: the tinted badge already
               carries the direction, a minus on green reads wrong (product). -->
            <span class="pr-diff__text">{{ entry.delta }}</span>
          </span>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
/*
 * Mockup 1130 方案一 (baseline-compare.jpeg): a 12px circle badge tinted with
 * the tone color at 20% over the card gradient, a flat arrow glyph inside, and
 * the unsigned delta in the muted tab color on the value's baseline.
 */
.pr-diff {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 5px;
  line-height: 1;
  white-space: nowrap;
}

.pr-diff:focus-visible {
  outline: 1px solid #3078f0;
  outline-offset: 2px;
  border-radius: 2px;
}

.pr-diff__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  line-height: 0;
}

.pr-diff--increase .pr-diff__badge {
  background: rgba(231, 67, 74, 0.2);
  color: #e7434a;
}

.pr-diff--decrease .pr-diff__badge {
  background: rgba(136, 200, 88, 0.2);
  color: #88c858;
}

.pr-diff__badge .pr-icon {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
}

.pr-diff__text {
  font-size: 13px;
  color: #e6e6e6;
}

/*
 * Multi-baseline popup (对比基线, 1130 dsl guide): teleported to `body` like
 * the house tips, so no panel's overflow or stacking context can crop it. One
 * row per comparison row: label left, the value right-aligned in a fixed
 * column, then the tone badge + unsigned magnitude left-aligned in the next —
 * two stable columns, so every row reads down one line. The current row
 * leaves the delta column empty and shares the values' right edge.
 */
.pr-diff-tip {
  position: fixed;
  z-index: 10000;
  box-sizing: border-box;
  /* 1130 export: 12px inset, 16px rows on an 8px pitch, 192px floor. */
  width: max-content;
  min-width: 192px;
  max-width: 360px;
  /* ONE grid for every row (`display: contents` rows below), so the value
   * column and the delta column are shared — never per-row and shifting. */
  display: grid;
  grid-template-columns: max-content 76px max-content;
  align-items: center;
  column-gap: 8px;
  row-gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: #262626;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  font-size: 12px;
  line-height: 16px;
}

/* label | value | badge+delta. The value column is fixed and the delta column is
 * sized by the widest chip, so every row lines up (values share one right edge,
 * chips one left edge) and the box's right border hugs the deltas. */
.pr-diff-tip__row {
  display: contents;
}

/* The CURRENT value sits in the popup's top-right corner, flush with its edge. */
.pr-diff-tip__row--current .pr-diff-tip__value {
  grid-column: 2 / -1;
}

.pr-diff-tip__label {
  color: #b3b3b3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-diff-tip__value {
  color: #ffffff;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* The popup's own delta chip: 12px glyph + 12px text (1130 details rows). */
.pr-diff-tip .pr-diff {
  justify-self: start;
  margin-left: 0;
  gap: 4px;
}

.pr-diff-tip .pr-diff__text {
  font-size: 12px;
}
</style>
