<script setup lang="ts">
import { computed } from 'vue';
import { formatTimeParts } from '../../../domain/formatTime';
import { t } from '../../../i18n';
import type { SelectedEvent, TimeDisplayUnit } from '../../../domain/types';

const props = defineProps<{
  selected: SelectedEvent;
  unit: TimeDisplayUnit;
  locale?: string;
}>();

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

/** Sketch labels the unit once per column (`Start (ns)`), so values stay bare. */
const metrics = computed(() => {
  const rows: [key: 'start' | 'dur' | 'end', ns: number][] = [
    ['start', props.selected.startTime],
    ['dur', props.selected.duration],
    ['end', props.selected.endTime],
  ];
  return rows.map(([key, ns]) => {
    const parts = formatTimeParts(ns, props.unit);
    return { key, value: parts.value, label: `${t(key, props.locale)} (${parts.unit})` };
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
        <dt class="pr-detail-summary__value">
          {{ metric.value }}
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
.pr-detail-summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  align-self: start;
  min-width: 0;
  border-radius: 10px;
  background: #313131;
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
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #3c3c3c;
}

.pr-detail-summary__metric {
  min-width: 0;
}

.pr-detail-summary__value {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #f2f2f2;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-detail-summary__label {
  /* One line always: a wrapping caption would change the card height between
     selections and make the column jump. */
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #a0a0a0;
  font-size: 11px;
  line-height: 1.35;
}

@media (max-width: 900px) {
  .pr-detail-summary__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
