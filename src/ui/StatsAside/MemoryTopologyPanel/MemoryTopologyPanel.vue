<script setup lang="ts">
import { computed } from 'vue';
import type { MemoryTopologyModel } from '../../../domain/types';
import { t } from '../../../i18n';
/** Official product chrome: Figma export of `v930/report-stats-scrolled` 内存负载分析图 (simplified).
 *  Its static labels stay outlined paths; the export's sample values were stripped in-repo. */
import chromeUrl from './memory-topology.svg?url';

const props = withDefaults(
  defineProps<{
    model: MemoryTopologyModel | null | undefined;
    locale?: string;
    /** UI-35: stacked diagram right-click. Fullscreen overlay turns this off. */
    openDetailsOnContextmenu?: boolean;
  }>(),
  { openDetailsOnContextmenu: true },
);

const emit = defineEmits<{
  'open-details': [];
}>();

const show = computed(() => {
  const m = props.model;
  return Boolean(m && m.nodes.length > 0 && m.edges.some((e) => e.label != null && e.label !== ''));
});

function label(id: string): string | undefined {
  return props.model?.edges.find((e) => e.id === id)?.label;
}

/** DATA-20: L2 Peak(%) from node.peakPct (hit rate). Sketch shows `{n}%` under L2 Cache — no tint. */
const l2PeakPct = computed(() => props.model?.nodes.find((n) => n.id === 'l2')?.peakPct);

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  if (props.openDetailsOnContextmenu) emit('open-details');
}

/**
 * Value slots of the chrome (`memory-topology.svg`, 448×540 units), keyed by edge id.
 * Coordinates are the centres of the values stripped from the export, so an overlaid
 * label lands on the same link (and inside the same plate) the design filled.
 * Pillars: GM x16–56, L2 x94–134; rows x188–432 — AIV0 y17–197, AIC y201–339, AIV1 y343–523.
 * Ordering follows the export's link direction: the upper label of a pair rides the link
 * whose arrowhead points into the right-hand box (GM→L2, L2→UB, UB→SIMD, Cube→L0C).
 *
 * Chrome slots we intentionally leave blank because the adapter computes no such edge:
 * the AIV0/AIV1 SIMT in/out pair and the four in-row SIMT links, the UB→VEC run, the two
 * rotated AIV↔AIC trunk labels, AIC L1→MTE1#3→BT, FixP→rail, and 9 of the 10 in-box `%`
 * plates (the L2 plate is DATA-20 `peakPct`, see below).
 */
const SLOTS: Record<string, readonly (readonly [number, number])[]> = {
  'gm-l2-read': [[74.5, 255.9]],
  'gm-l2-write': [[75.3, 277.8]],
  'l2-ub': [[159.7, 106.4], [159.7, 426.6]],
  'ub-l2': [[160.4, 121.3], [159.7, 441.5]],
  'l2-l1-read': [[159.7, 235.5]],
  // The export routes its lower L2↔AIC corridor link on to FixP; we label it with the
  // Memory.csv L1 write-back (`aic_l1_write_bw`), which is the same corridor.
  'l2-l1-write': [[159.7, 273.1]],
  'ub-vec': [[338.2, 153.4], [338.2, 473.3]],
  'vec-ub': [[338.2, 165.2], [338.2, 485.4]],
  'l1-l0a': [[239.7, 221.7]],
  'l1-l0b': [[240.1, 234.3]],
  'l0a-cube': [[302.9, 222.5]],
  'l0b-cube': [[302.9, 235.5]],
  'cube-l0c': [[373.5, 229.2]],
  'l0c-cube': [[373.5, 244.5]],
};

/**
 * One entry per slot, drawn even when the edge has no `label` (empty string), so a slot
 * that the adapter omitted stays an addressable, visibly blank plate.
 */
const values = computed(() =>
  Object.entries(SLOTS).flatMap(([id, slots]) =>
    slots.map(([x, y], i) => ({ id, x, y, key: `${id}-${i}`, text: label(id) ?? '' })),
  ),
);
</script>

<template>
  <div
    v-if="show"
    class="pr-topo"
    data-testid="memory-topology-panel"
    @contextmenu="onContextMenu"
  >
    <svg
      class="pr-topo__svg"
      viewBox="0 0 448 540"
      role="img"
      :aria-label="t('memoryTopology', locale)"
    >
      <image
        :href="chromeUrl"
        x="0"
        y="0"
        width="448"
        height="540"
      />

      <!-- L2 node anchor: the chrome paints the pillar, this keeps the node addressable. -->
      <rect
        data-testid="node-l2"
        class="pr-topo__l2"
        x="94"
        y="16"
        width="40"
        height="508"
      />

      <!-- DATA-20 L2 Peak(%) in the export's in-box plate under L2 Cache. -->
      <text
        v-if="l2PeakPct != null"
        x="113.8"
        y="277.1"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pr-topo__peak"
        data-testid="node-l2-peak"
      >{{ l2PeakPct.toFixed(2) }}%</text>
      <text
        v-else-if="label('l2-hit')"
        x="113.8"
        y="277.1"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pr-topo__pct"
        data-testid="edge-l2-hit"
      >{{ label('l2-hit') }}</text>

      <text
        v-for="v in values"
        :key="v.key"
        :x="v.x"
        :y="v.y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pr-topo__edge"
        :data-testid="`edge-${v.id}`"
      >{{ v.text }}</text>
    </svg>
  </div>
</template>

<style scoped>
.pr-topo {
  min-width: 0;
  background: #262626;
  border-radius: 4px;
  padding: 6px;
}

.pr-topo__svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: hidden;
}

/* Transparent anchor — the chrome supplies the pillar's fill. */
.pr-topo__l2 {
  fill: none;
}

/* 6.6px fills the export's 27.6-unit value plates exactly (8px overflows them). */
.pr-topo__edge {
  fill: #f9b665;
  font-size: 6.6px;
  font-weight: 700;
}

.pr-topo__peak,
.pr-topo__pct {
  fill: #f0f0f0;
  font-size: 6.6px;
  font-weight: 700;
}
</style>
