<script setup lang="ts">
import { computed } from 'vue';
import {
  EVENT_TIME_SIGNIFICANT_DIGITS,
  formatDisplayTimePartsAuto,
  formatTimePartsAuto,
} from '../../../domain/formatTime';
import { t } from '../../../i18n';
import type { SelectedEvent, TimeDisplayMode } from '../../../domain/types';

const props = withDefaults(
  defineProps<{
    selected: SelectedEvent;
    timeDisplayMode: TimeDisplayMode;
    clockFreqMHz?: number;
    /** Display origin (usually model.minTime); start/end are relative to this. */
    timeOrigin?: number;
    locale?: string;
  }>(),
  { timeOrigin: 0 },
);

/**
 * Sketch shows a pill under the name holding the instruction / op type
 * (MOV_OUT_TO_L1_MULTI_ND2NZ under FIX_LOC_TO_DST). Producers spell that key
 * differently, so take the first present and hide the pill otherwise.
 */
const kind = computed(() => {
  const args = props.selected.args ?? {};
  for (const key of ['op_type', 'kernel_type', 'kernel_name', 'type', 'cat']) {
    const value = args[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return null;
});

const displayOpts = computed(() => ({
  significantDigits: EVENT_TIME_SIGNIFICANT_DIGITS,
  mode: props.timeDisplayMode,
  clockFreqMHz: props.clockFreqMHz,
}));

const fullOpts = computed(() => ({
  mode: props.timeDisplayMode,
  clockFreqMHz: props.clockFreqMHz,
}));

/** Value+unit on one line; caption below is Start / Duration / End only. */
const metrics = computed(() => {
  const origin = props.timeOrigin;
  const rows: [key: 'start' | 'dur' | 'end', ns: number, relative: boolean][] = [
    ['start', props.selected.startTime, true],
    ['dur', props.selected.duration, false],
    ['end', props.selected.endTime, true],
  ];
  return rows.map(([key, ns, relative]) => {
    const compact = relative
      ? formatDisplayTimePartsAuto(ns, origin, displayOpts.value)
      : formatTimePartsAuto(ns, displayOpts.value);
    const detailed = relative
      ? formatDisplayTimePartsAuto(ns, origin, fullOpts.value)
      : formatTimePartsAuto(ns, fullOpts.value);
    return {
      key,
      value: compact.value,
      unit: compact.unit,
      label: t(key, props.locale),
      // Cell shows 4 significant digits; hover title keeps full precision + unit.
      title: `${detailed.value} ${detailed.unit}`,
    };
  });
});
</script>

<template>
  <div
    class="pr-detail-summary"
    data-testid="detail-summary"
  >
    <div class="pr-detail-summary__identity">
      <span
        class="pr-detail-summary__glyph"
        aria-hidden="true"
      >
        <!--
          Sketch glyph: a solid isometric cube inside a hexagonal node ring. The ring is
          three broken strokes — chevron over the top, then down each side to the bottom
          node — leaving a gap around each of the three dots. Regular hexagon, r=11 about
          (16,16); the cube's three faces carry a seam between them, as in the sketch.
        -->
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8.9 9.1 16 5l7.1 4.1" />
            <path d="M25.5 13.3v8.2l-7.1 4.1" />
            <path d="M13.6 25.6 6.5 21.5v-8.2" />
          </g>
          <g fill="currentColor">
            <circle
              cx="6.5"
              cy="10.5"
              r="2.3"
            />
            <circle
              cx="25.5"
              cy="10.5"
              r="2.3"
            />
            <circle
              cx="16"
              cy="27"
              r="2.3"
            />
          </g>
          <!-- Top face lightest, then the two sides, so the cube reads as isometric. -->
          <g fill="currentColor">
            <path d="M16 8.2 21.8 11.6 16 15 10.2 11.6Z" />
            <path
              d="M9.8 12.4 15.5 15.7v6.9L9.8 19.3Z"
              opacity="0.72"
            />
            <path
              d="M22.2 12.4 16.5 15.7v6.9l5.7-3.3Z"
              opacity="0.86"
            />
          </g>
        </svg>
      </span>
      <div class="pr-detail-summary__titles">
        <div
          class="pr-detail-summary__name"
          :title="selected.name"
        >
          {{ selected.name }}
        </div>
        <div
          v-if="kind"
          class="pr-detail-summary__kind"
          data-testid="detail-summary-kind"
          :title="kind"
        >
          {{ kind }}
        </div>
      </div>
    </div>

    <dl class="pr-detail-summary__metrics">
      <div
        v-for="metric in metrics"
        :key="metric.key"
        class="pr-detail-summary__metric"
      >
        <dt
          class="pr-detail-summary__value"
          :title="metric.title"
        >
          <span class="pr-detail-summary__number">{{ metric.value }}</span>
          <span class="pr-detail-summary__unit">{{ metric.unit }}</span>
        </dt>
        <dd
          class="pr-detail-summary__label"
          :title="metric.label"
        >
          {{ metric.label }}
        </dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
/* Translucent over the #262626 dock, which composites to the #313131 the sketch
   was sampled at; the nested metrics panel layers the same 5% again for #3b3b3b. */
/* No width of its own: DetailPanel gives it a `min-content` track, so the card is as
   wide as the widest thing in it that refuses to shrink — the metric panel below. */
.pr-detail-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}

.pr-detail-summary__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.pr-detail-summary__glyph {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  border: 1.5px solid #9a9a9a;
  border-radius: 50%;
  color: #b4b4b4;
}

.pr-detail-summary__titles {
  min-width: 0;
}

.pr-detail-summary__name {
  font-size: 18px;
  font-weight: 700;
  color: #f2f2f2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail-summary__kind {
  display: inline-block;
  margin-top: 6px;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 4px;
  background: #7356a6;
  color: #f2ecfa;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail-summary__metrics {
  display: flex;
  gap: 16px;
  box-sizing: border-box;
  height: 60px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}

/* Deliberately no `min-width: 0`: the automatic minimum keeps each cell at its own
   nowrap width, which is what makes the card's `min-content` track wide enough for all
   three. Zero it and the cells collapse and the figures ellipsize again. */
.pr-detail-summary__metric {
  white-space: nowrap;
}

.pr-detail-summary__value {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #f2f2f2;
  font-variant-numeric: tabular-nums;
}

.pr-detail-summary__unit {
  margin-left: 4px;
  font-weight: 600;
  color: #c8c8c8;
}

.pr-detail-summary__label {
  /* One line always (inherited nowrap): a wrapping caption would change the card height
     between selections and make the column jump. */
  margin: 0;
  color: #a0a0a0;
  font-size: 11px;
  line-height: 1.35;
}

</style>
