<script lang="ts">
/** Base value type size, cap-height matched to the export's own values (see Visual).
 *  Mirrors the `.pr-topo__edge` font-size; the fit rule below only ever shrinks from it. */
export const BASE_FONT_PX = 6.3;

/** Horizontal room each slot's value has before it touches the chrome, in chrome units,
 *  measured off the export. A value is drawn centred on its slot, not on the corridor, so the
 *  binding constraint is the *nearer* wall:
 *  `2 × (nearest wall − centre) − 2 units of air − 1.5 units of anti-alias margin`.
 *
 *  Every slot is listed because the clearance differs per slot — the row stack's inner corridors
 *  (L1↔L0A/B, L0A/B↔Cube, Cube↔L0C, UB↔SIMD) are far tighter than the pillars' and have no
 *  common bound. Measured walls at the value's own height band:
 *  `gm-l2-*` x≈55.75/x≈94; `l2-*`/`ub-l2` x≈133.75/x≈188; `ub-vec`/`vec-ub` x≈315/x≈361;
 *  `l1-l0a`/`l1-l0b` x≈217/x≈262; `l0a-cube`/`l0b-cube` x≈282/x≈322;
 *  `cube-l0c`/`l0c-cube` x≈353/x≈394; the L2 in-box plate spans the 40-unit pillar. */
export const SLOT_MAX_W: Record<string, number> = {
  'gm-l2-read': 35.4,
  'gm-l2-write': 35.4,
  'l2-ub': 49.9,
  'ub-l2': 49.9,
  'l2-l1-read': 49.9,
  'l2-l1-write': 49.9,
  'ub-vec': 42.1,
  'vec-ub': 42.1,
  'l1-l0a': 41.1,
  'l1-l0b': 40.3,
  'l0a-cube': 36.7,
  'l0b-cube': 34.7,
  'cube-l0c': 37.5,
  'l0c-cube': 37.5,
  'l2-peak': 36,
};

/** Fallback for a slot the table above forgets. It is the *tightest* measured bound, so a new
 *  slot shrinks its value rather than spilling over the chrome — a generous default here would
 *  silently overflow the narrow row-stack corridors. */
export const DEFAULT_MAX_W = 34.7;

/**
 * Type size for a value that is `natural` units wide in slot `slot`.
 * The export's slots were sized for its own 27.6-unit placeholders; the system sans runs
 * wider per cap height, and real values are longer (`{n}.{nn} GB/s`, KB volumes), so a value
 * that would spill out of its corridor is scaled down proportionally — same strokes, smaller
 * — instead of overlapping the pillars. Anything that fits keeps the base size.
 */
export function fitFontSize(natural: number, slot: string, base = BASE_FONT_PX): number {
  const max = SLOT_MAX_W[slot] ?? DEFAULT_MAX_W;
  return natural > max ? (max / natural) * base : base;
}
</script>

<script setup lang="ts">
import { computed, ref, useId, watchEffect } from 'vue';
import type { MemoryTopologyModel } from '../../../domain/types';
import { t } from '../../../i18n';
/** Official product chrome: Figma export of `v930/report-stats-scrolled` 内存负载分析图 (simplified).
 *  Its static labels stay outlined paths; the export's sample values were stripped in-repo.
 *  `?no-inline` keeps the 200 kB asset out of the JS bundle — lib mode inlines assets whatever
 *  `assetsInlineLimit` says, and only this suffix is checked first — so it ships as
 *  `dist/memory-topology.svg` for the host to serve (see `vite.config.ts`). */
import chromeUrl from './memory-topology.svg?url&no-inline';

const props = withDefaults(
  defineProps<{
    model: MemoryTopologyModel | null | undefined;
    locale?: string;
    /** UI-35: stacked diagram right-click. Fullscreen overlay turns this off. */
    openDetailsOnContextmenu?: boolean;
  }>(),
  // `locale: undefined` is what `t()` already does with an absent prop (`resolveLocale` falls
  // back), but the linter needs the key present to see the optional prop as intentional.
  { openDetailsOnContextmenu: true, locale: undefined },
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

/** DATA-20 plate text: `{n}%` from `peakPct`, else the `l2-hit` edge label. */
const peakText = computed(() =>
  l2PeakPct.value != null ? `${l2PeakPct.value.toFixed(2)}%` : label('l2-hit'),
);

/** Unique per instance: the panel renders twice at once (stacked + fullscreen overlay). */
const summaryId = useId();

/**
 * Accessible text alternative (PR-MEMTOP-011). `role="img"` exposes the diagram as a single
 * image, so its `<text>` values never reach the a11y tree on their own. This spells out the
 * same slots as `from → to: value`, read from the model — so it lists exactly what the diagram
 * draws: blank slots and slotless edges (`l0c-l1` / `l0c-l2`) stay out.
 */
const summary = computed(() => {
  const names = new Map((props.model?.nodes ?? []).map((n) => [n.id, n.label]));
  const parts: string[] = [];
  if (peakText.value) parts.push(`${names.get('l2') ?? 'L2'}: ${peakText.value}`);
  for (const v of values.value) {
    if (!v.text) continue;
    const edge = props.model?.edges.find((e) => e.id === v.id);
    const from = (edge && names.get(edge.from)) ?? edge?.from ?? '';
    const to = (edge && names.get(edge.to)) ?? edge?.to ?? '';
    parts.push(from && to ? `${from} → ${to}: ${v.text}` : v.text);
  }
  return parts.join('; ');
});

/**
 * Measurement twin: an unpainted `<text>` carrying the same class, so `getComputedTextLength`
 * reports the label's natural width in chrome units (the viewBox is 448×540 px at 1:1).
 * jsdom has no SVG text metrics — the fit then stays at the base size.
 */
const measureTwin = ref<SVGTextElement | null>(null);

/** Per-slot type size, set only where a value outgrows its slot (PR-MEMTOP-010). */
const fitted = ref<Record<string, number>>({});

watchEffect(() => {
  const el = measureTwin.value;
  const next: Record<string, number> = {};
  if (el && typeof el.getComputedTextLength === 'function') {
    const measure = (text: string): number => {
      if (!text) return 0;
      el.textContent = text;
      return el.getComputedTextLength();
    };
    for (const v of values.value) {
      const px = fitFontSize(measure(v.text), v.id);
      if (px < BASE_FONT_PX) next[v.key] = px;
    }
    const peak = measure(peakText.value ?? '');
    const peakPx = fitFontSize(peak, 'l2-peak');
    if (peakPx < BASE_FONT_PX) next.peak = peakPx;
  }
  fitted.value = next;
});

function fitStyle(key: string): { fontSize: string } | undefined {
  const px = fitted.value[key];
  return px != null ? { fontSize: `${px}px` } : undefined;
}
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
      :aria-describedby="summaryId"
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

      <!-- DATA-20 L2 Peak(%) in the export's in-box plate under L2 Cache. The plate holds
           `peakPct` when the node carries one, else the `l2-hit` edge label — one plate, so one
           element; the testid still tells the two sources apart. -->
      <text
        v-if="peakText"
        x="113.8"
        y="277.1"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pr-topo__pct"
        :style="fitStyle('peak')"
        :data-testid="l2PeakPct != null ? 'node-l2-peak' : 'edge-l2-hit'"
      >{{ peakText }}</text>

      <text
        v-for="v in values"
        :key="v.key"
        :x="v.x"
        :y="v.y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pr-topo__edge"
        :style="fitStyle(v.key)"
        :data-testid="`edge-${v.key}`"
      >{{ v.text }}</text>

      <text
        ref="measureTwin"
        class="pr-topo__edge"
        x="-1000"
        y="-1000"
        opacity="0"
        aria-hidden="true"
      />
    </svg>

    <!-- The diagram's accessible text alternative — see `summary` (PR-MEMTOP-011). -->
    <span
      :id="summaryId"
      class="pr-topo__sr"
    >{{ summary }}</span>
  </div>
</template>

<style scoped>
/* The diagram's base surface. The chrome paints no artboard of its own (the export's
 * rgba(255,255,255,0.05) frame is stripped), so this is what the diagram sits on: it matches the
 * card `--pr-bg-panel` instead of the lighter `#313131` the frame used to produce. */
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

/* The export's values measure 27.6 units wide and 4.25 units tall (cap height). Sizing follows
 * the cap height: 6.3px × 0.705 = 4.44 units, and 800 is the closest available stroke to the
 * export's (measured ink density ≈ SF 800). The system sans is wider per cap height than the
 * export's face (~1.2×) and real values are longer than its 27.6-unit placeholders, so a value
 * that would leave its corridor is scaled down per slot (`fitFontSize`, PR-MEMTOP-010). */
.pr-topo__edge {
  fill: #f9b766;
  font-size: 6.3px;
  font-weight: 800;
}

/* Same size/weight as the edge values: the export's in-box `%` numbers are the same type
 * (measured cap 4.25 units, ink fill ≈ the 800 weight). Colour is the export's pure white.
 * One rule for the one L2 plate, whichever source fills it (Peak% or `l2-hit`). */
.pr-topo__pct {
  fill: #fff;
  font-size: 6.3px;
  font-weight: 800;
}

/* Visually hidden, still in the a11y tree: the diagram's text alternative (PR-MEMTOP-011).
 * Same declarations as `.pr-csv__sr`. */
.pr-topo__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
