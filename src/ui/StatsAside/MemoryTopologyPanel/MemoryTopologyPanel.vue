<script lang="ts">
import {
  hasDrawableTopology,
  TOPOLOGY_SLOT_EDGE_IDS,
  type TopologySlotEdgeId,
} from '../../../adapters/memoryTopology';
import type { MemoryTopologyModel } from '../../../domain/types';

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
 * Value slots of the chrome (`memory-topology.svg`, 448×540 units), keyed by the adapter's
 * `TOPOLOGY_SLOT_EDGE_IDS` — the `Record` type keeps the two lists identical, so a newly plated
 * edge without coordinates fails typecheck instead of silently drawing nothing.
 * Coordinates are the centres of the values stripped from the export, so an overlaid
 * label lands on the same link (and inside the same plate) the design filled.
 * Pillars: GM x16–56, L2 x94–134; rows x188–432 — AIV0 y17–197, AIC y201–339, AIV1 y343–523.
 * Ordering follows the export's link direction: the upper label of a pair rides the link
 * whose arrowhead points into the right-hand box (GM→L2, L2→UB, UB→SIMD, Cube→L0C).
 *
 * Chrome slots we intentionally leave blank because the adapter computes no such edge, or
 * Product has not confirmed the assignment (UI-48): the AIV0/AIV1 SIMT in/out pair and the
 * four in-row SIMT links, the UB→VEC run, the two rotated AIV↔AIC trunk labels, AIC
 * L1→MTE1#3→BT, FixP→rail, the lower L2↔AIC corridor that the export routes onto FixP
 * (`l2-l1-write` / `aic_l1_write_bw`), and 9 of the 10 in-box `%` plates (the L2 plate is
 * DATA-20 `peakPct`).
 */
export const SLOTS: Record<TopologySlotEdgeId, readonly (readonly [number, number])[]> = {
  'gm-l2-read': [[74.5, 255.9]],
  'gm-l2-write': [[75.3, 277.8]],
  'l2-ub': [
    [159.7, 106.4],
    [159.7, 426.6],
  ],
  'ub-l2': [
    [160.4, 121.3],
    [159.7, 441.5],
  ],
  'l2-l1-read': [[159.7, 235.5]],
  'ub-vec': [
    [338.2, 153.4],
    [338.2, 473.3],
  ],
  'vec-ub': [
    [338.2, 165.2],
    [338.2, 485.4],
  ],
  'l1-l0a': [[239.7, 221.7]],
  'l1-l0b': [[240.1, 234.3]],
  'l0a-cube': [[302.9, 222.5]],
  'l0b-cube': [[302.9, 235.5]],
  'cube-l0c': [[373.5, 229.2]],
  'l0c-cube': [[373.5, 244.5]],
};

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

/** Zoom ladder (%) for the bar's **+** / **−**. 100 is the design's default readout and means
 *  *fitted to the box*, not 1:1 units: the panel never has a fixed pixel budget (the stacked
 *  aside and the root overlay differ), so 100% is the one scale that is correct in both. */
export const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300, 400];

/** Next ladder stop from `current` in `dir` (+1 in, −1 out); clamped at both ends. An unknown
 *  `current` (should not happen — the ladder is the only writer) falls back to the default. */
export function nextZoom(current: number, dir: 1 | -1): number {
  const i = ZOOM_STEPS.indexOf(current);
  if (i < 0) return 100;
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))]!;
}
</script>

<script setup lang="ts">
import { computed, ref, useId, watchEffect } from 'vue';
import { t } from '../../../i18n';
/** Official product chrome: Figma export of `v930/report-stats-scrolled` 内存负载分析图 (simplified).
 *  Its static labels stay outlined paths; the export's sample values were stripped in-repo.
 *  `?no-inline` keeps the 200 kB asset out of the JS bundle — lib mode inlines assets whatever
 *  `assetsInlineLimit` says, and only this suffix is checked first — so it ships as
 *  `dist/memory-topology.svg`. The built reference is the web-root path `/memory-topology.svg`
 *  (hosts must serve that file at the site root, or copy it from the package export
 *  `@huawei/profiling-report/memory-topology.svg`). */
import chromeUrl from './memory-topology.svg?url&no-inline';

const props = withDefaults(
  defineProps<{
    model: MemoryTopologyModel | null | undefined;
    locale?: string;
    /** UI-35: stacked diagram right-click. Fullscreen overlay turns this off. */
    openDetailsOnContextmenu?: boolean;
    /** Bar's **全屏** control: the stacked aside asks for it, the root overlay is already full. */
    showFullscreen?: boolean;
  }>(),
  // `locale: undefined` is what `t()` already does with an absent prop (`resolveLocale` falls
  // back), but the linter needs the key present to see the optional prop as intentional.
  { openDetailsOnContextmenu: true, showFullscreen: false, locale: undefined },
);

const emit = defineEmits<{
  'open-details': [];
  'open-fullscreen': [];
}>();

const show = computed(() => hasDrawableTopology(props.model));

/** One-shot: a missing host asset used to leave orphaned amber values on an empty rectangle. */
const chromeFailed = ref(false);
function onChromeError() {
  if (chromeFailed.value) return;
  chromeFailed.value = true;
  console.warn(
    '[MemoryTopologyPanel] failed to load /memory-topology.svg — serve dist/memory-topology.svg at the web root (package export: @huawei/profiling-report/memory-topology.svg)',
  );
}

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
 * One entry per slot, drawn even when the edge has no `label` (empty string), so a slot
 * that the adapter omitted stays an addressable, visibly blank plate. Iterates the adapter's
 * slot tuple rather than `SLOTS` keys so the ids stay typed.
 */
const values = computed(() =>
  TOPOLOGY_SLOT_EDGE_IDS.flatMap((id) =>
    SLOTS[id].map(([x, y], i) => ({ id, x, y, key: `${id}-${i}`, text: label(id) ?? '' })),
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
 * draws: blank slots and slotless edges stay out. Paired AIV0/AIV1 slots share one aggregate
 * value, so the description names both rows once instead of repeating the same string.
 */
const summary = computed(() => {
  const names = new Map((props.model?.nodes ?? []).map((n) => [n.id, n.label]));
  const parts: string[] = [];
  if (peakText.value) parts.push(`${names.get('l2') ?? 'L2'}: ${peakText.value}`);
  const seen = new Set<string>();
  for (const v of values.value) {
    if (!v.text || seen.has(v.id)) continue;
    seen.add(v.id);
    const edge = props.model?.edges.find((e) => e.id === v.id);
    const from = (edge && names.get(edge.from)) ?? edge?.from ?? '';
    const to = (edge && names.get(edge.to)) ?? edge?.to ?? '';
    const pair = SLOTS[v.id].length > 1 ? ' (AIV0, AIV1)' : '';
    parts.push(from && to ? `${from} → ${to}${pair}: ${v.text}` : v.text);
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

/** Bar state. Per panel instance — the stacked aside and the root overlay each keep their own
 *  zoom, so covering the report (a re-mount) starts the fullscreen diagram at 100%. */
const viewport = ref<HTMLElement | null>(null);
const zoom = ref(100);
const zoomPct = computed(() => `${zoom.value}%`);
const zoomMin = ZOOM_STEPS[0]!;
const zoomMax = ZOOM_STEPS[ZOOM_STEPS.length - 1]!;

/** Only a diagram larger than its own box has anywhere to scroll to (PR-MEMTOP-013). */
const pannable = computed(() => zoom.value > 100);

/** Back to the scroll origin, so a diagram that was panned while zoomed in returns to its
 *  top-left corner rather than to an offset it can no longer show. */
function resetPan() {
  if (viewport.value) {
    viewport.value.scrollTop = 0;
    viewport.value.scrollLeft = 0;
  }
}

function stepZoom(dir: 1 | -1) {
  zoom.value = nextZoom(zoom.value, dir);
  // Stepping back down to a fitted scale has to drop the offset too: the box stops being
  // scrollable there (`pannable`), and a clip at a stale offset would cut the diagram's corner.
  if (!pannable.value) resetPan();
}

/** **适应窗口** — back to the fitted scale, and back to the scroll origin so a diagram that was
 *  panned while zoomed in returns to its top-left corner rather than to a stale offset. */
function fitZoom() {
  zoom.value = 100;
  resetPan();
}
</script>

<template>
  <div
    v-if="show"
    class="pr-topo"
    :style="{ '--pr-topo-zoom': zoom / 100 }"
    data-testid="memory-topology-panel"
    @contextmenu="onContextMenu"
  >
    <div
      ref="viewport"
      class="pr-topo__viewport"
      :class="{ 'pr-topo__viewport--pannable': pannable }"
      data-testid="topology-viewport"
    >
      <div class="pr-topo__stage">
        <svg
          class="pr-topo__svg"
          viewBox="0 0 448 540"
          role="img"
          :aria-label="t('memoryTopology', locale)"
          :aria-describedby="chromeFailed ? undefined : summaryId"
        >
          <image
            :href="chromeUrl"
            x="0"
            y="0"
            width="448"
            height="540"
            @error="onChromeError"
          />

          <template v-if="!chromeFailed">
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
          </template>
        </svg>
      </div>
    </div>

    <!-- Zoom / fullscreen bar (design: `v930/new` 内存负载分析 controls). The whole bar hides with
         the chrome it scales — a zoom control over a failed asset is dead chrome. -->
    <div
      v-if="!chromeFailed"
      class="pr-topo__bar"
      data-testid="topology-controls"
    >
      <button
        type="button"
        class="pr-topo__ctrl"
        data-testid="topology-zoom-out"
        :aria-label="t('zoomOut', locale)"
        :title="t('zoomOut', locale)"
        :disabled="zoom === zoomMin"
        @click="stepZoom(-1)"
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M3 8h10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <span
        class="pr-topo__zoom"
        data-testid="topology-zoom-percent"
        aria-live="polite"
      >{{ zoomPct }}</span>

      <button
        type="button"
        class="pr-topo__ctrl"
        data-testid="topology-zoom-in"
        :aria-label="t('zoomIn', locale)"
        :title="t('zoomIn', locale)"
        :disabled="zoom === zoomMax"
        @click="stepZoom(1)"
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M8 3v10M3 8h10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <button
        type="button"
        class="pr-topo__ctrl pr-topo__ctrl--accent"
        data-testid="topology-zoom-fit"
        :aria-label="t('zoomFit', locale)"
        :title="t('zoomFit', locale)"
        @click="fitZoom"
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M8 1.4 14.6 8 8 14.6 1.4 8Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
          />
          <circle
            cx="8"
            cy="8"
            r="2.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
          />
        </svg>
      </button>

      <button
        v-if="showFullscreen"
        type="button"
        class="pr-topo__ctrl"
        data-testid="topology-fullscreen"
        :aria-label="t('fullscreen', locale)"
        :title="t('fullscreen', locale)"
        @click="emit('open-fullscreen')"
      >
        <svg
          viewBox="0 0 16 16"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <rect
            x="5"
            y="5"
            width="6"
            height="6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>
    </div>

    <!-- The diagram's accessible text alternative — see `summary` (PR-MEMTOP-011). -->
    <span
      v-if="!chromeFailed"
      :id="summaryId"
      class="pr-topo__sr"
    >{{ summary }}</span>
  </div>
</template>

<style scoped>
/* Dark-only diagram surface. The chrome is baked for dark fills and cannot adapt; light theme
 * remaps `--pr-bg-panel` to `#f4f4f4`, so this stays the literal dark panel colour rather than
 * the token. Sibling dark-art panels (CsvFieldListPanel, RooflinePanel) do the same. */
.pr-topo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  background: #262626;
  border-radius: 4px;
  padding: 6px;
}

/* Fit box for the diagram (PR-MEMTOP-013). `aspect-ratio` is the chrome's own 448×540, so at the
 * 100% zoom the box is exactly as tall as the diagram was when the `svg` was width-driven — and
 * because it is a definite height, the *stage* can grow inside it and be panned by scrolling
 * instead of by a drag handler.
 *
 * `hidden`, not `auto`: the box height comes from `aspect-ratio` while the diagram's comes from
 * its own intrinsic ratio, and the two agree only to a rounding step (measured in Chrome:
 * 511 vs 511.0625). A fitted diagram therefore sat a fraction of a pixel over its own box — not
 * enough for Chromium to treat as scrollable overflow, but enough for a stray permanent scrollbar
 * wherever a platform does not snap it the same way. Nothing is ever cut off by the clip (at or
 * below 100% the stage is at most the box), so the fitted state simply does not scroll. */
.pr-topo__viewport {
  min-width: 0;
  aspect-ratio: 448 / 540;
  overflow: hidden;
}

/* Panning starts past the fit (PR-MEMTOP-015): only a zoomed-in diagram is larger than its box,
 * so it is the only one with anywhere to scroll to. */
.pr-topo__viewport--pannable {
  overflow: auto;
}

/* `--pr-topo-zoom` (1 = fitted) scales this box; the `svg` keeps the chrome's ratio inside it. */
.pr-topo__stage {
  display: grid;
  place-items: center;
  width: calc(100% * var(--pr-topo-zoom, 1));
  height: calc(100% * var(--pr-topo-zoom, 1));
}

.pr-topo__svg {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: auto;
  display: block;
  overflow: hidden;
}

/* Zoom / fullscreen bar. `#313131` is the export's 5% white lift over the `#262626` panel (the
 * design's own strip colour); the bar shrinks to its controls and sits at the panel's right edge. */
.pr-topo__bar {
  align-self: flex-end;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 3px 8px;
  background: #313131;
  border-radius: 4px;
}

.pr-topo__ctrl {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #b3b3b3;
  line-height: 0;
  cursor: pointer;
}

.pr-topo__ctrl:hover:not(:disabled) {
  color: #ffffff;
  background: var(--pr-surface-hover);
}

.pr-topo__ctrl:disabled {
  opacity: 0.4;
  cursor: default;
}

/* The design marks the fit control with the accent, the way the mockup's strip does. */
.pr-topo__ctrl--accent {
  color: #3078f0;
}

.pr-topo__ctrl--accent:hover:not(:disabled) {
  color: #5a9bff;
}

.pr-topo__zoom {
  min-width: 34px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
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
