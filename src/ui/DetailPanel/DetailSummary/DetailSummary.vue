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
          Sketch glyph: a solid isometric cube (three shaded faces) wrapped by a
          hexagonal node ring — three dots at the ring's upper-left, upper-right and
          bottom vertices, the ring stroke broken around each. Coordinates come from
          the sketch, so keep them byte for byte when touching this.
        -->
        <svg
          viewBox="4.5 4 23 23"
          width="30"
          height="30"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12.4 7.2 16 5.2l3.6 2" />
            <path d="M23.6 9.6v6.7l-3.4 2" />
            <path d="M11.8 18.3 8.4 16.3V9.6" />
          </g>
          <g fill="currentColor">
            <circle
              cx="9.4"
              cy="8"
              r="2.1"
            />
            <circle
              cx="22.6"
              cy="8"
              r="2.1"
            />
            <circle
              cx="16"
              cy="24.4"
              r="2.1"
            />
          </g>
          <!-- Cube: top face lighter, the two side faces a shade down, as in the sketch. -->
          <g fill="currentColor">
            <path
              d="M16 9.4 22.6 13 16 16.6 9.4 13Z"
              opacity="0.95"
            />
            <path
              d="M9.4 14.2 15.4 17.5v7.1l-6-3.3Z"
              opacity="0.75"
            />
            <path
              d="M22.6 14.2v7.1l-6 3.3v-7.1Z"
              opacity="0.6"
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
  width: 52px;
  height: 52px;
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
