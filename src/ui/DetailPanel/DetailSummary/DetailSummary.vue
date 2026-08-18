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
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
        >
          <polygon
            points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
          <path
            d="M12 12V6.6M12 12l-4.7 2.7M12 12l4.7 2.7"
            stroke="currentColor"
            stroke-width="1.3"
          />
          <circle
            cx="12"
            cy="12"
            r="1.9"
            fill="currentColor"
          />
          <circle
            cx="12"
            cy="6.2"
            r="1.4"
            fill="currentColor"
          />
          <circle
            cx="7"
            cy="15"
            r="1.4"
            fill="currentColor"
          />
          <circle
            cx="17"
            cy="15"
            r="1.4"
            fill="currentColor"
          />
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
  background: #2f2f2f;
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
  border: 1.5px solid #7a7a7a;
  border-radius: 50%;
  color: #c8c8c8;
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
  background: var(--pr-color-mov, #b868f8);
  color: #fdfaff;
  font-size: 12px;
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
  border-radius: 8px;
  background: #383838;
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
