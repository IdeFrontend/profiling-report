<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { t, archMetricModeLabel } from '../../i18n';
import type {
  BandwidthCardModel,
  MemoryTopologyModel,
  PipeOccupancyItem,
  PipeOccupancySide,
  ReportCapability,
  ReportViewModel,
} from '../../domain/types';
import {
  bandwidthCardsFromRows,
  computeCardFromRows,
  pipeOccupancyFromRows,
  rooflineFromRows,
} from '../../adapters/adaptRep';
import {
  buildMemoryTopology,
  blockIdsInOrder,
  hasDrawableTopology,
} from '../../adapters/memoryTopology';
import {
  ARCH_DIAGRAM_DEFAULT_METRIC_MODE,
  ARCH_DIAGRAM_METRIC_MODES,
  archDiagramCsvFromTexts,
  topologyFromArchDiagramMetrics,
  type ArchDiagramMetricMode,
} from '../../adapters/emulateMemoryTopology';
import CsvFieldListPanel from './CsvFieldListPanel/CsvFieldListPanel.vue';
import SummaryCategoryList from './SummaryCategoryList/SummaryCategoryList.vue';
import HardwareDetailsPanel from './HardwareDetailsPanel/HardwareDetailsPanel.vue';
import RooflinePanel from './RooflinePanel/RooflinePanel.vue';
import MemoryTopologyPanel from './MemoryTopologyPanel/MemoryTopologyPanel.vue';
import CannbotIcon from './CannbotIcon.vue';
import CloseButton from '../CloseButton.vue';
import CardMetricSelect from '../TimelineView/SwimlaneView/CardMetricSelect.vue';
import type { CannbotScope } from '../../domain/cannbot';

const props = defineProps<{
  report: ReportViewModel | null | undefined;
  locale?: string;
  capabilities?: ReportCapability[];
  /**
   * Emulate ArchDiagram metric mode. When the host passes it (ProfilingReport), aside +
   * topology fullscreen share one selection; omit for standalone mounts (local default).
   */
  archMetricMode?: ArchDiagramMetricMode;
}>();

const emit = defineEmits<{
  close: [];
  'open-hardware-details': [];
  'view-full-csv': [payload: { fileName: string; text: string }];
  'open-pipe-details': [];
  'open-topology-fullscreen': [model: MemoryTopologyModel];
  'open-cannbot': [scope: CannbotScope];
  'update:archMetricMode': [mode: ArchDiagramMetricMode];
  'open-performance-hints': [];
}>();

type PipeSide = PipeOccupancySide;
type AsideSurface = 'report' | 'compute' | 'memory' | 'hardware';

const PIPE_SIDE_ORDER: PipeSide[] = ['cube', 'vector', 'aic', 'aiv0', 'aiv1'];
const EMULATE_PIPE_SIDES: PipeSide[] = ['aic', 'aiv0', 'aiv1'];
const PIPE_SIDE_LABEL: Record<PipeSide, string> = {
  cube: 'Cube',
  vector: 'Vector',
  aic: 'Cube',
  aiv0: 'Vector 0',
  aiv1: 'Vector 1',
};

const COLOR: Record<string, string> = {
  cube: 'var(--pr-color-cube)',
  vector: 'var(--pr-color-vector)',
  mte1: 'var(--pr-color-mte1)',
  mte2: 'var(--pr-color-mte2)',
  mte3: 'var(--pr-color-mte3)',
  fixp: 'var(--pr-color-fixp)',
  scalar: 'var(--pr-color-scalar)',
  default: 'var(--pr-color-default)',
};

const hasDuration = computed(
  () => props.report?.profile !== 'emulate' && props.report?.summary.taskDurationUs != null,
);

/** One block selector for every widget (DATA-19 / DATA-29): `''` = All, else that `block_id`. */
const blockId = ref('');

/** Rows for one CSV in the picked block; searches compute and memory tabs (DATA-19). */
function rowsForBlock(fileName: string, id: string): Record<string, string>[] {
  const report = props.report;
  if (!report) return [];
  const table = [...report.computeTables, ...report.memoryTables].find(
    (t) => t.fileName === fileName,
  );
  return table ? table.rows.filter((r) => r['block_id'] === id) : [];
}

const bandwidthCards = computed(() => {
  const id = blockId.value;
  const all = props.report?.bandwidthCards ?? [];
  if (!id) return all;
  const peak = props.report?.summary.gmBwTheoreticalGBs ?? all[0]?.sides[0]?.peakGBs;
  // A block with no `Memory.csv` shows no tile — never the All aggregate wearing its label.
  return bandwidthCardsFromRows(rowsForBlock('Memory.csv', id), peak);
});
const computeCard = computed(() => {
  const id = blockId.value;
  const all = props.report?.computeCard;
  if (!id) return all;
  // Peak is per-chip (DATA-29), so the picked block re-reads only the measured side and inherits
  // the peak; nothing to read (no row) blanks the tile rather than repeating the All value.
  return computeCardFromRows(
    rowsForBlock('ArithmeticUtilization.csv', id),
    props.report?.summary ?? {},
    all,
  );
});
const roofline = computed(() => {
  const id = blockId.value;
  if (!id) return props.report?.roofline;
  // Undecidable for this block ⇒ no series, rather than the All point under a block label.
  return rooflineFromRows(
    rowsForBlock('ArithmeticUtilization.csv', id),
    rowsForBlock('Memory.csv', id),
  );
});
const showComputeCard = computed(
  () => hasDuration.value && (computeCard.value?.sides.length ?? 0) > 0,
);
const showComputePlaceholder = computed(() => hasDuration.value && !showComputeCard.value);
const showAicoreCard = computed(() => hasDuration.value);
const bandwidthUtilSides = computed(() => bandwidthUtilFromCards(bandwidthCards.value));
const hasSummary = computed(
  () =>
    props.report?.profile !== 'emulate' &&
    (hasDuration.value || bandwidthUtilSides.value.length > 0),
);
/**
 * Summary-card hover tooltip content: the exact value first, then what the metric means
 * (PR-STATS-041). The shared popover renders `value` as the headline and `hint` under it.
 */
type CardTip = { value: string; hint?: string };

/** Exact value line (`准确值: X`), then the metric description. */
function withExactValue(hint: string, exact: string): CardTip {
  return { value: `${t('exactValue', props.locale)}: ${exact}`, hint };
}

/**
 * Column-label truncation tooltip: the full label, shown only while its column ellipsizes it.
 * Built once per view model (not inline in the template) so the trigger and its `data-tip` provably
 * carry the same string.
 */
function labelTip(text: string): CardTip {
  return { value: text };
}

/**
 * Raw number for an `Exact value:` line. Stays exact for any value the producer publishes, but
 * strips binary-float residue from the sums (`aic` + `aiv` BW) and means (compute) that build
 * these figures — `0.30000000000000004` reads as broken data, not precision.
 *
 * `digits` is the precision ceiling. The 12-digit default suits a published measurement (a raw
 * throughput, a wall-clock amount), where the extra digits are real. A **derived** ratio or percent
 * does not: it multiplies or divides those measurements, so 12 digits is nothing but arithmetic
 * noise — the compute scores printed as `41.1011153199%` and `39.4570707071%`. Those callers pass
 * `RATIO_PRECISION_DIGITS` instead.
 */
function exactNumber(n: number, digits = 12): string {
  return String(Number(n.toPrecision(digits)));
}

/**
 * Precision ceiling for a percent or a ratio (PR-STATS-040): **4 significant digits**. Leading
 * zeros never count as significant, and `Number()` drops the trailing ones, so only digits that
 * carry information are printed — `41.1011153199%` → `41.1%`, `39.4570707071%` → `39.46%`,
 * `60.8256` → `60.83`. A value that is already short (68.25%, 1600 GB/s) passes through untouched.
 */
const RATIO_PRECISION_DIGITS = 4;

/**
 * One shared hover tooltip for the summary cards, painted in the timeline tooltip's chrome
 * (`EventTooltip` / overview value tip) and positioned beside the pointer like it. It is teleported
 * to `body`, so it sits in the root stacking context and no panel can crop or cover it.
 */
const tipId = useId();
const cardTip = ref<{ content: CardTip; x: number; y: number } | null>(null);
const TIP_OFFSET_PX = 12;

/** Popover bounds from `.pr-stat-tip`; the flip below assumes the widest box it can paint. */
const TIP_MAX_W_PX = 320;

/**
 * Flip to the pointer's other side rather than run off the viewport. The aside is docked against
 * the right edge, so following the pointer one way only (`clientX + 12`, as the timeline canvas
 * can afford) cut up to **149px off a 180px box** on the AICore / BW right-hand columns. Anchoring
 * the flipped case with `right` / `bottom` keeps the box inside the viewport without measuring it.
 *
 * A left flip can reach past the aside into the timeline panel (177px of a 320px box on compute
 * Vector); the `Teleport` above is what keeps it visible there.
 *
 * ponytail: the flip assumes a viewport wide enough for the 320px popover plus its pointer gap
 * (≈700px). Narrower than that, a left-flipped tip can run past the *left* edge. Measure the box
 * and clamp if a small window ever becomes a target.
 */
const tipStyle = computed(() => {
  const tip = cardTip.value;
  if (!tip) return {};
  const { x, y } = tip;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const toTheRight = x + TIP_OFFSET_PX + TIP_MAX_W_PX <= vw;
  // Above / below the pointer's halfway line, so the box grows into the larger half: the tallest
  // hint measures ~200px against the ~540px a 1080p viewport leaves on either side.
  const below = y < vh / 2;
  return {
    left: toTheRight ? `${x + TIP_OFFSET_PX}px` : 'auto',
    right: toTheRight ? 'auto' : `${vw - x + TIP_OFFSET_PX}px`,
    top: below ? `${y + TIP_OFFSET_PX}px` : 'auto',
    bottom: below ? 'auto' : `${vh - y + TIP_OFFSET_PX}px`,
  };
});

function closeTip() {
  cardTip.value = null;
}

/**
 * `tipStyle` caches the viewport size to flip the box, and `window.innerWidth` is not reactive, so
 * a resize never recomputes it: the card moves and the popover stays at the old coordinates.
 * Measured from a keyboard-focused trigger, a 1600 → 1100px resize stranded the box **708px** from
 * its card and off-screen right. Drop it instead — the same contract as `.pr-aside__body` scroll.
 */
function onWindowResize() {
  closeTip();
}

onMounted(() => window.addEventListener('resize', onWindowResize));
onBeforeUnmount(() => window.removeEventListener('resize', onWindowResize));

function openTip(content: CardTip, x: number, y: number) {
  cardTip.value = { content, x, y };
}

/** A column label is worth a tooltip only while its column actually cuts it (as `title` was not). */
function truncated(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && el.scrollWidth > el.clientWidth;
}

/**
 * `v-bind` payload for one trigger — the listeners plus, for values that live nowhere else, the
 * keyboard path and its `aria-describedby` (the tip carries `role="tooltip"` and is read from
 * here, which is what native `title` used to do for assistive tech). Empty without a tooltip.
 *
 * `whenTruncated` keeps a fully visible column label quiet instead of echoing its own text.
 */
function tipBind(
  tip: CardTip | null | undefined,
  opts: { focusable?: boolean; whenTruncated?: boolean } = {},
): Record<string, unknown> {
  if (!tip) return {};
  const hidden = (el: EventTarget | null) => opts.whenTruncated && !truncated(el);
  return {
    ...(opts.focusable
      ? {
          tabindex: 0,
          /*
           * Only while the popover is mounted. The `Teleport` body is `v-if`-gated on `cardTip`, so
           * a standing reference points at an id that is not in the document whenever no tooltip is
           * open — a dangling IDREF, which AT must ignore and axe fails (`aria-valid-attr-value`).
           * This is read during render, so it lands with the popover in the same flush.
           */
          ...(cardTip.value ? { 'aria-describedby': tipId } : {}),
        }
      : {}),
    onPointerenter: (e: PointerEvent) => {
      if (!hidden(e.currentTarget)) openTip(tip, e.clientX, e.clientY);
    },
    onPointermove: (e: PointerEvent) => {
      if (!cardTip.value) return;
      if (hidden(e.currentTarget)) closeTip();
      else openTip(tip, e.clientX, e.clientY);
    },
    onPointerleave: closeTip,
    // A cancelled touch gesture (scroll starting on the card) fires `pointercancel`, never
    // `pointerleave`, which used to strand the popover until the next pointer event.
    onPointercancel: closeTip,
    ...(opts.focusable
      ? {
          onFocus: (e: FocusEvent) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            openTip(tip, r.left, r.bottom);
          },
          onBlur: closeTip,
        }
      : {}),
  };
}

const bandwidthView = computed(() =>
  bandwidthUtilSides.value.map((row) => {
    const label = t(row.dir === 'read' ? 'bwRead' : 'bwWrite', props.locale);
    return {
      dir: row.dir,
      labelTip: labelTip(label),
      score: utilScore(row.measuredGBs, row.peakGBs),
      // COLOR_TOKENS: primary=读, secondary=写 (semantic, not array order).
      barTone: row.dir === 'write' ? 'secondary' : 'primary',
      ratio: `${formatMagnitude(row.measuredGBs)} / ${formatMagnitude(row.peakGBs)}`,
      unit: 'GB/s',
      ratioTip: withExactValue(
        t('bandwidthRatioHint', props.locale).replace('{dir}', label),
        `${exactNumber(row.measuredGBs, RATIO_PRECISION_DIGITS)} / ${exactNumber(row.peakGBs, RATIO_PRECISION_DIGITS)} GB/s`,
      ),
      scoreTip: withExactValue(
        t('bandwidthScoreHint', props.locale).replace('{dir}', label),
        utilPercent(row.measuredGBs, row.peakGBs),
      ),
    };
  }),
);
const computeView = computed(() =>
  (computeCard.value?.sides ?? []).map((row) => {
    const label = row.side === 'aic' ? 'Cube' : 'Vector';
    return {
      side: row.side,
      labelTip: labelTip(label),
      score: utilScore(row.measuredTflops, row.peakTflops),
      // COLOR_TOKENS: primary=Cube, secondary=Vector (semantic, not array order).
      barTone: row.side === 'aiv' ? 'secondary' : 'primary',
      ratio: `${formatMagnitude(row.measuredTflops)} / ${formatMagnitude(row.peakTflops)}`,
      unit: 'TFLOPS',
      ratioTip: withExactValue(
        t('computeRatioHint', props.locale).replace('{side}', label),
        `${exactNumber(row.measuredTflops, RATIO_PRECISION_DIGITS)} / ${exactNumber(row.peakTflops, RATIO_PRECISION_DIGITS)} TFLOPS`,
      ),
      scoreTip: withExactValue(
        t('computeScoreHint', props.locale).replace('{side}', label),
        utilPercent(row.measuredTflops, row.peakTflops),
      ),
    };
  }),
);

/** DATA-9 / DATA-10: dual 并行使用率 | 负载均衡度 columns (fractions → %; clamp [0, 100]). */
function aicorePercent(fraction: number): { score: number; title: string } {
  const raw = fraction * 100;
  // Clamp both ends so label and bar agree — balance = 1−σ/μ can go negative; util can exceed 1.
  const score = Number(Math.min(100, Math.max(0, raw)).toFixed(2));
  // A derived percent, so the 4-digit ceiling applies rather than the 12-digit exact default.
  const title = `${exactNumber(raw, RATIO_PRECISION_DIGITS)}%`;
  return { score, title };
}
const aicoreView = computed(() => {
  const s = props.report?.summary;
  const rows: {
    id: 'util' | 'balance';
    labelTip: CardTip;
    score: number;
    barTone: 'primary' | 'secondary';
    scoreTip: CardTip;
  }[] = [];
  if (s?.parallelUtilization != null) {
    const { score, title } = aicorePercent(s.parallelUtilization);
    rows.push({
      id: 'util',
      labelTip: labelTip(t('parallelUtil', props.locale)),
      score,
      barTone: 'primary',
      scoreTip: withExactValue(t('parallelUtilHint', props.locale), title),
    });
  }
  if (s?.parallelBalance != null) {
    const { score, title } = aicorePercent(s.parallelBalance);
    rows.push({
      id: 'balance',
      labelTip: labelTip(t('parallelBalance', props.locale)),
      score,
      barTone: 'secondary',
      scoreTip: withExactValue(t('parallelBalanceHint', props.locale), title),
    });
  }
  return rows;
});
const hasParallel = computed(() => aicoreView.value.length > 0);
const computeCategories = computed(() =>
  (props.report?.summaryCategories ?? []).filter((c) =>
    (['PipeUtilization', 'ArithmeticUtilization', 'ResourceConflictRatio'] as const).includes(
      c.id as 'PipeUtilization' | 'ArithmeticUtilization' | 'ResourceConflictRatio',
    ),
  ),
);
const memoryCategories = computed(() =>
  (props.report?.summaryCategories ?? []).filter((c) =>
    (['MemoryL0', 'L2Cache', 'Memory', 'MemoryUB'] as const).includes(
      c.id as 'MemoryL0' | 'L2Cache' | 'Memory' | 'MemoryUB',
    ),
  ),
);
const activeCategory = ref('');
watch(
  () => [computeCategories.value, memoryCategories.value] as const,
  () => {
    activeCategory.value = '';
  },
);
const showPipe = computed(() => (props.report?.pipeOccupancy?.length ?? 0) > 0);
const showCompute = computed(
  () => (props.report?.computeTables?.length ?? 0) > 0 || computeCategories.value.length > 0,
);
const showMemory = computed(
  () => (props.report?.memoryTables?.length ?? 0) > 0 || memoryCategories.value.length > 0,
);
/** `roofline` is a Phase 2 surface outside the current release — hidden unless the host opts in. */
const rooflineEnabled = computed(() => (props.capabilities ?? []).includes('roofline'));
const showRoofline = computed(
  () => rooflineEnabled.value && (roofline.value?.points.length ?? 0) > 0,
);
const hasHardwareDetails = computed(
  () => (props.report?.hardwareDetails?.sections.length ?? 0) > 0,
);
/** M4 性能提示 entry: capability + joined rows ([DATA-30]) — reachable from both body branches. */
const hasPerformanceHints = computed(
  () =>
    (props.capabilities ?? []).includes('performanceHints') &&
    (props.report?.performanceHints?.length ?? 0) > 0,
);

const asideSurface = ref<AsideSurface>('report');

/**
 * One block selector for every widget (DATA-19 / DATA-29): `''` = **All** (`summary.jsonl`
 * aggregate), an id = that block's CSV row. Options are every `block_id` the report carries
 * (compute ∪ memory, fixture order), so the aside switcher and the memory overlay switcher — which
 * share this state — can never disagree about which ids exist.
 */
const blockIds = computed(() =>
  blockIdsInOrder([...(props.report?.computeTables ?? []), ...(props.report?.memoryTables ?? [])]),
);

/** `''` = All, then every report `block_id` (same order as the native select it replaced). */
const blockSelectOptions = computed(() => ['', ...blockIds.value]);

function blockSelectLabel(value: string): string {
  return value === '' ? t('blockAll', props.locale) : value;
}

const showBlockSwitcher = computed(() => showPipe.value && blockIds.value.length > 1);

watch(
  () => props.report,
  () => {
    asideSurface.value = 'report';
    blockId.value = '';
  },
  { immediate: true },
);

// A card tooltip holds a snapshot of its metric, and the overlays paint under it: drop it whenever
// the surface changes instead of letting it outlive the card it describes.
watch(asideSurface, closeTip);

const scopedPipeOccupancy = computed(() => {
  const all = props.report?.pipeOccupancy ?? [];
  if (!blockId.value) return all;
  const rows = rowsForBlock('PipeUtilization.csv', blockId.value);
  // Blank rather than repeat the All aggregate under a block label. `showPipe` reads the All
  // occupancy, so the switcher survives an empty pick and the user can get back to All.
  return rows.length === 0 ? [] : pipeOccupancyFromRows(rows);
});

/** Overlay row scope: `All` has no single row, so the CSV lists fall back to the first block id. */
const overlayBlockId = computed(() => blockId.value || blockIds.value[0] || '');

/**
 * DATA-19 / DATA-29: 详情 follows the same selector. With a block picked the CSV field list shows that
 * block's row; under `All` the product default (`summary.jsonl` category list) stays.
 */
const computeCsvScope = computed(
  () => Boolean(blockId.value) && (props.report?.computeTables?.length ?? 0) > 0,
);
const memoryCsvScope = computed(
  () => Boolean(blockId.value) && (props.report?.memoryTables?.length ?? 0) > 0,
);

watch(
  () => [showCompute.value, showMemory.value] as const,
  ([compute, memory]) => {
    if (asideSurface.value === 'compute' && !compute) asideSurface.value = 'report';
    else if (asideSurface.value === 'memory' && !memory) asideSurface.value = 'report';
  },
);

/**
 * Memory* CSVs **plus** `PipeUtilization.csv` — the one table set the memory surface reads. The
 * adapter's builder looks files up by name, so any other extra table is inert. Two callers need it:
 * the picked-block topology rebuild (UI-49's in-box Scalar/Vec/Cube badges live in PipeUtilization)
 * and the memory 详情 CSV field list (UI-38's MTE utilizations do too).
 */
const memoryTablesWithPipe = computed(() => [
  ...(props.report?.memoryTables ?? []),
  ...(props.report?.computeTables ?? []).filter((t) => t.fileName === 'PipeUtilization.csv'),
]);

/** Emulate Architecture Diagram (DATA-48a): metric mode switches `*_gbs` / `*_ratio` / `*_cnt`. */
const isArchDiagram = computed(() => (props.capabilities ?? []).includes('archDiagram'));
const archMetricModes = ARCH_DIAGRAM_METRIC_MODES;
/** Host-owned when ProfilingReport passes `archMetricMode`; else session-local for unit mounts. */
const localArchMetricMode = ref<ArchDiagramMetricMode>(ARCH_DIAGRAM_DEFAULT_METRIC_MODE);
const archMetricMode = computed({
  get: () => props.archMetricMode ?? localArchMetricMode.value,
  set: (mode: ArchDiagramMetricMode) => {
    if (props.archMetricMode !== undefined) emit('update:archMetricMode', mode);
    else localArchMetricMode.value = mode;
  },
});

watch(isArchDiagram, (on) => {
  if (on) return;
  if (props.archMetricMode !== undefined) emit('update:archMetricMode', ARCH_DIAGRAM_DEFAULT_METRIC_MODE);
  else localArchMetricMode.value = ARCH_DIAGRAM_DEFAULT_METRIC_MODE;
});

/**
 * `All` = the adapter's snapshot (`summary.jsonl` categories, else the first drawable block's CSV);
 * a picked id = that block's Memory* CSV row (DATA-19 / DATA-29). Rebuilding the `All` aggregate here
 * would be a second copy of the adapter rule, free to drift from `report.memoryTopology`.
 * Emulate / `archDiagram`: rebuild from ArchDiagramMetrics + selected metric mode only — never
 * `?? report.memoryTopology` (that snapshot is always default `*_gbs`; a blank mode must DATA-30 hide).
 */
const topologyModel = computed(() => {
  if (isArchDiagram.value) {
    const csv = archDiagramCsvFromTexts(props.report?.csvTexts);
    return topologyFromArchDiagramMetrics(csv, archMetricMode.value);
  }
  const id = blockId.value;
  const tables = memoryTablesWithPipe.value;
  // A picked block shows only that block's rows — never the All aggregate wearing its label.
  if (id && tables.length > 0) return buildMemoryTopology(tables, id);
  return props.report?.memoryTopology;
});

/**
 * UI-38: the chrome's MTE blocks carry no value plate, so their utilizations are not drawn on the
 * diagram but are readable in the memory 详情 CSV field list (`memoryTablesWithPipe`, shown for
 * CSV-only reports). Reports with memory summary categories render those categories instead — their
 * MTE ratios stay under 计算 详情.
 */

const showTopology = computed(() => hasDrawableTopology(topologyModel.value));

/** True only when there is no stacked chrome left — ArchDiagram keeps the Metric stack even if plates are DATA-30 absent. */
const csvOnly = computed(
  () =>
    !hasSummary.value &&
    !showPipe.value &&
    !showRoofline.value &&
    !showTopology.value &&
    !isArchDiagram.value &&
    (showCompute.value || showMemory.value),
);

const summary = computed(() => props.report?.summary);

function numericBlockDim(blockDim: string | number | undefined): number | undefined {
  if (blockDim == null || blockDim === '') return undefined;
  const n = typeof blockDim === 'number' ? blockDim : Number(blockDim);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * UI-32 (NPU-Compute): drop the bar; secondary = `{blockDim} Blocks / {coreCount} 核`.
 * DATA-1 fallback order: blocks/core → `blockDim` → `opName`. Each form carries the tooltip
 * that says which quantity the line reports (PR-STATS-040).
 */
const durationSecondary = computed<{ text: string; tip: CardTip } | null>(() => {
  const s = summary.value;
  if (!s) return null;
  const block = numericBlockDim(s.blockDim);
  if (block != null && s.coreCount != null && s.coreCount > 0) {
    const text = t('blocksPerCores', props.locale)
      .replace('{blockDim}', String(block))
      .replace('{coreCount}', String(s.coreCount));
    return { text, tip: withExactValue(t('durationSecondaryBlocksPerCore', props.locale), text) };
  }
  if (s.blockDim != null && s.blockDim !== '') {
    const text = t('blocksOnly', props.locale).replace('{n}', String(s.blockDim));
    return { text, tip: withExactValue(t('durationSecondaryBlocksOnly', props.locale), text) };
  }
  return s.opName
    ? { text: s.opName, tip: withExactValue(t('durationSecondaryOpName', props.locale), s.opName) }
    : null;
});

const hasMeta = computed(() => {
  if (props.report?.profile === 'emulate') return false;
  const s = summary.value;
  return Boolean(s && (s.pid || s.opType || (s.blockDim != null && s.blockDim !== '')));
});

/** UI-30, UI-31: 更多 always on compute report shell; omit for emulate (DATA-47). */
const showMore = computed(() => props.report?.profile !== 'emulate');

const opType = computed(() => (props.report?.summary.opType ?? '').trim());
const isMix = computed(() => opType.value.toUpperCase() === 'MIX');

function resolveKnownSide(raw: string): PipeSide | null {
  const v = raw.toLowerCase();
  if (!v || v.includes('mix')) return null;
  if (v.includes('vector') || v.includes('aiv') || v.includes('vec')) return 'vector';
  if (v.includes('cube') || v.includes('aic')) return 'cube';
  return null;
}

const knownSide = computed(() => resolveKnownSide(opType.value));
const pipeSide = ref<PipeSide>('cube');

/** Distinct sides present in scoped PIPE rows, stable order (UI-54). */
const pipeSideOptions = computed((): PipeSide[] => {
  const present = new Set<PipeSide>();
  for (const p of scopedPipeOccupancy.value) {
    if (p.side && (PIPE_SIDE_ORDER as string[]).includes(p.side)) {
      present.add(p.side as PipeSide);
    }
  }
  return PIPE_SIDE_ORDER.filter((s) => present.has(s));
});

/** Emulate-shaped occupancy: any of aic|aiv0|aiv1 present (UI-54). */
const hasEmulatePipeCores = computed(() => {
  const n = pipeSideOptions.value.filter((s) => EMULATE_PIPE_SIDES.includes(s)).length;
  return n >= 1;
});

/** Multi-core emulate: ≥2 sides → Cube|Vector 0|Vector 1 toggle. */
const showEmulatePipeToggle = computed(() => {
  const n = pipeSideOptions.value.filter((s) => EMULATE_PIPE_SIDES.includes(s)).length;
  return n >= 2;
});

const showPipeSideToggle = computed(() => isMix.value || showEmulatePipeToggle.value);

watch(
  () =>
    [isMix.value, knownSide.value, hasEmulatePipeCores.value, pipeSideOptions.value] as const,
  ([mix, side, emulateCores, options]) => {
    // Keep the user's pick across option-array recomputes; only default when absent.
    if (mix || emulateCores) {
      if (options.includes(pipeSide.value)) return;
      if (mix) {
        pipeSide.value = options.includes('cube') ? 'cube' : (options[0] ?? 'cube');
      } else {
        const preferred = EMULATE_PIPE_SIDES.find((s) => options.includes(s));
        pipeSide.value = preferred ?? options[0] ?? 'aic';
      }
    } else if (side) {
      pipeSide.value = side;
    }
  },
  { immediate: true },
);

function matchesSide(item: PipeOccupancyItem, side: PipeSide): boolean {
  return (item.side ?? side) === side;
}

const visiblePipes = computed(() => {
  const all = scopedPipeOccupancy.value;
  // Emulate sides (`aic`/`aiv0`/`aiv1`) must not fall through to compute knownSide
  // (`aic`→cube / `aiv*`→vector) — that blanks a single-core pack (UI-54).
  if (isMix.value || hasEmulatePipeCores.value) {
    return all.filter((p) => matchesSide(p, pipeSide.value));
  }
  if (knownSide.value == null) return all;
  return all.filter((p) => matchesSide(p, knownSide.value!));
});

/**
 * Sketch splits the number from a muted unit (`4.06` + `ms`). Display is 2 dp; the tooltip's
 * exact line keeps full precision. The `/1000` into `ms` is not residue-free — `1000.004` µs
 * divides to `1.0000040000000001` — so it runs through `exactNumber()` like every other exact value.
 */
function formatDurationParts(us: number): { value: string; unit: string; exact: string } {
  if (us >= 1000) {
    const ms = us / 1000;
    return { value: ms.toFixed(2), unit: 'ms', exact: `${exactNumber(ms)} ms` };
  }
  return { value: us.toFixed(2), unit: 'µs', exact: `${exactNumber(us)} µs` };
}

const durationParts = computed(() => {
  const us = props.report?.summary.taskDurationUs;
  return us == null ? null : formatDurationParts(us);
});

/** Duration number tooltip: the exact (unrounded) amount first, then what it measures. */
const durationValueTip = computed(() =>
  durationParts.value
    ? withExactValue(t('durationValueHint', props.locale), durationParts.value.exact)
    : undefined,
);

function formatPipeAbsolute(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(5);
}

/** UI-34 / DATA-33h: magnitude rounding for GB/s and TFLOPS subtitles. */
function formatMagnitude(n: number): string {
  if (n >= 10) return n.toFixed(1);
  if (n >= 0.01) return n.toFixed(2);
  if (n >= 0.001) return n.toFixed(3);
  return n.toFixed(4);
}

function utilScore(measured: number, peak: number): number {
  if (!(peak > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((measured / peak) * 100)));
}

/**
 * Precise `measured ÷ peak` percent behind a score. The bar and the printed score **clamp** to
 * [0, 100] (`utilScore`), exactly as AICore's label does, while this line keeps the true percent —
 * so an over-peak measurement reads `100` on the card and its real number in the tooltip instead of
 * the two disagreeing silently (PR-STATS-011c is the same rule for 并行使用率).
 */
function utilPercent(measured: number, peak: number): string {
  if (!(peak > 0)) return '0%';
  return `${exactNumber((measured / peak) * 100, RATIO_PRECISION_DIGITS)}%`;
}

/** Sketch 读|写: collapse input/output × aic|aiv into one **sum** per direction (DATA-8). */
function bandwidthUtilFromCards(
  cards: BandwidthCardModel[],
): { dir: 'read' | 'write'; measuredGBs: number; peakGBs: number }[] {
  const out: { dir: 'read' | 'write'; measuredGBs: number; peakGBs: number }[] = [];
  for (const id of ['input', 'output'] as const) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.sides.length === 0) continue;
    // DATA-8: read = aic + aiv (the producer's `OpInfoSummary.aicore_gm_read_bw`), write likewise.
    const measuredGBs = card.sides.reduce((a, s) => a + s.measuredGBs, 0);
    // Peak is one SOL value shared by every side (DATA-6), so sides[0] is representative.
    const peakGBs = card.sides[0]!.peakGBs;
    out.push({ dir: id === 'input' ? 'read' : 'write', measuredGBs, peakGBs });
  }
  return out;
}

const PIPE_SCALE = [0, 20, 40, 60, 80, 100] as const;

const reportTitle = computed(() => t('summary', props.locale));

const detailTitle = computed(() => {
  if (asideSurface.value === 'hardware') return t('hardwareDetails', props.locale);
  if (asideSurface.value === 'compute') return t('computeAnalysis', props.locale);
  if (asideSurface.value === 'memory') return t('memoryAnalysis', props.locale);
  return reportTitle.value;
});

function openHardware() {
  asideSurface.value = 'hardware';
  emit('open-hardware-details');
}

function openPipeDetails() {
  if (showCompute.value) asideSurface.value = 'compute';
  emit('open-pipe-details');
}

function openMemoryDetails() {
  if (showMemory.value) asideSurface.value = 'memory';
}

function openTopologyFullscreen() {
  const m = topologyModel.value;
  if (m) emit('open-topology-fullscreen', m);
}

function backToReport() {
  asideSurface.value = 'report';
}

/** data-testid for the drill-in overlay root (compute / memory / hardware). */
const detailTestId = computed(() => {
  if (asideSurface.value === 'hardware') return 'stats-hardware-details';
  if (asideSurface.value === 'compute') return 'stats-compute';
  if (asideSurface.value === 'memory') return 'stats-memory';
  return undefined;
});
</script>

<template>
  <aside
    class="pr-aside"
    data-testid="stats-aside"
  >
    <div
      class="pr-aside__wash"
      data-testid="aside-wash"
      aria-hidden="true"
    />
    <header
      class="pr-aside__head"
      :inert="asideSurface !== 'report'"
    >
      <div class="pr-aside__title-row">
        <svg
          class="pr-aside__icon"
          data-testid="stats-aside-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path
            d="M2.5 2.5v11h11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            points="4.5,10.5 7,6.5 9,8.5 13.5,4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
        <h3 :title="reportTitle">
          {{ reportTitle }}
        </h3>
        <button
          v-if="asideSurface === 'report' && hasPerformanceHints"
          type="button"
          class="pr-aside__hints"
          data-testid="performance-hints-trigger"
          :aria-label="t('performanceAnalysis', locale)"
          :title="t('performanceAnalysis', locale)"
          @click="emit('open-performance-hints')"
        >
          {{ t('performanceAnalysis', locale) }}
        </button>
        <CloseButton
          class="pr-aside__close"
          data-testid="stats-aside-close"
          :label="t('closePanel', locale)"
          @click="emit('close')"
        />
      </div>
      <p
        v-if="hasMeta || showMore"
        class="pr-aside__meta"
        :data-testid="hasMeta ? 'stats-aside-meta' : undefined"
      >
        <span
          v-if="summary?.pid"
          class="pr-aside__meta-seg"
        ><span class="pr-aside__meta-k">{{ t('process', locale) }}:</span><span class="pr-aside__meta-v">{{ summary.pid }}</span></span>
        <span
          v-if="summary?.opType"
          class="pr-aside__meta-seg"
        ><span class="pr-aside__meta-k">{{ t('opTypeLabel', locale) }}:</span><span class="pr-aside__meta-v">{{ summary.opType }}</span></span>
        <span
          v-if="summary?.blockDim != null && summary.blockDim !== ''"
          class="pr-aside__meta-seg"
        ><span class="pr-aside__meta-k">{{ t('blocks', locale) }}:</span><span class="pr-aside__meta-v">{{ summary.blockDim }}</span></span>
        <button
          v-if="showMore"
          type="button"
          class="pr-aside__more"
          data-testid="stats-aside-more"
          @click="openHardware"
        >
          {{ t('more', locale) }}
        </button>
        <button
          type="button"
          class="pr-cannbot"
          data-testid="cannbot-summary"
          :aria-label="t('cannbotAsk', locale)"
          :title="t('cannbotAsk', locale)"
          @click="emit('open-cannbot', 'summary')"
        >
          <CannbotIcon />
        </button>
      </p>
    </header>

    <div
      class="pr-aside__main"
      :inert="asideSurface !== 'report'"
    >
    <div
      class="pr-aside__body"
      @scroll="closeTip"
    >
      <div
        v-if="hasSummary"
        class="pr-cards"
        data-testid="stats-summary"
      >
        <div
          v-if="hasDuration && durationParts"
          class="pr-card"
          data-testid="stats-duration-card"
        >
          <div class="pr-card__label">
            {{ t('duration', locale) }}
          </div>
          <div
            class="pr-card__value"
            data-testid="stats-duration-value"
            v-bind="tipBind(durationValueTip, { focusable: true })"
          >
            <span class="pr-card__num">{{ durationParts.value }}</span>
            <span class="pr-card__unit">{{ durationParts.unit }}</span>
          </div>
          <div
            v-if="durationSecondary"
            class="pr-card__sub"
            data-testid="stats-duration-secondary"
            v-bind="tipBind(durationSecondary.tip, { focusable: true })"
          >
            {{ durationSecondary.text }}
          </div>
        </div>
        <div
          v-if="showAicoreCard"
          class="pr-card"
          :class="{ 'pr-card--na': !hasParallel }"
          data-testid="stats-core-util-card"
        >
          <div class="pr-card__label">
            {{ t('aicoreParallel', locale) }}
          </div>
          <div
            v-if="hasParallel"
            class="pr-bw-cols"
          >
            <div
              v-for="row in aicoreView"
              :key="row.id"
              class="pr-bw-col"
              :data-testid="`stats-aicore-${row.id}`"
            >
              <div class="pr-bw-col__head">
                <span
                  class="pr-card__value"
                  :data-testid="`stats-aicore-${row.id}-score`"
                  v-bind="tipBind(row.scoreTip, { focusable: true })"
                >
                  <span class="pr-card__num">{{ row.score.toFixed(2) }}</span>
                  <span class="pr-card__unit">%</span>
                </span>
                <span
                  class="pr-bw-col__side"
                  :data-tip="row.labelTip.value"
                  v-bind="tipBind(row.labelTip, { whenTruncated: true })"
                >{{ row.labelTip.value }}</span>
              </div>
              <div class="pr-card__bar-track">
                <span
                  class="pr-card__bar-hatch"
                  aria-hidden="true"
                />
                <span
                  class="pr-card__bar-fill"
                  :class="row.barTone === 'secondary' ? 'pr-card__bar-fill--secondary' : 'pr-card__bar-fill--primary'"
                  :style="{ width: `${row.score}%` }"
                  :data-testid="`stats-aicore-${row.id}-bar`"
                />
              </div>
            </div>
          </div>
          <div
            v-else
            class="pr-card__value"
          >
            {{ t('notAvailable', locale) }}
          </div>
        </div>
        <div
          v-if="showComputeCard"
          class="pr-card"
          data-testid="stats-compute-card"
        >
          <div class="pr-card__label">
            {{ t('computePower', locale) }}
          </div>
          <div class="pr-bw-cols">
            <div
              v-for="row in computeView"
              :key="row.side"
              class="pr-bw-col"
              :data-testid="`stats-compute-${row.side}`"
            >
              <div class="pr-bw-col__head">
                <span
                  class="pr-card__value"
                  :data-testid="`stats-compute-${row.side}-score`"
                  v-bind="tipBind(row.scoreTip, { focusable: true })"
                >
                  <span class="pr-card__num">{{ row.score }}</span>
                </span>
                <span
                  class="pr-bw-col__side"
                  :data-tip="row.labelTip.value"
                  v-bind="tipBind(row.labelTip, { whenTruncated: true })"
                >{{ row.labelTip.value }}</span>
              </div>
              <div class="pr-card__bar-track">
                <span
                  class="pr-card__bar-hatch"
                  aria-hidden="true"
                />
                <span
                  class="pr-card__bar-fill"
                  :class="row.barTone === 'secondary' ? 'pr-card__bar-fill--secondary' : 'pr-card__bar-fill--primary'"
                  :style="{ width: `${row.score}%` }"
                  :data-testid="`stats-compute-${row.side}-bar`"
                />
              </div>
              <div
                class="pr-card__sub"
                v-bind="tipBind(row.ratioTip, { focusable: true })"
              >
                <span class="pr-card__sub-ratio">{{ row.ratio }}</span>
                <span class="pr-card__sub-unit">{{ row.unit }}</span>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else-if="showComputePlaceholder"
          class="pr-card pr-card--na"
          data-testid="stats-compute-card"
        >
          <div class="pr-card__label">
            {{ t('computePower', locale) }}
          </div>
          <div class="pr-card__value">
            {{ t('notAvailable', locale) }}
          </div>
        </div>
        <div
          v-if="bandwidthView.length > 0"
          class="pr-card"
          data-testid="stats-bandwidth-card"
        >
          <div class="pr-card__label">
            {{ t('bandwidthUtil', locale) }}
          </div>
          <div class="pr-bw-cols">
            <div
              v-for="row in bandwidthView"
              :key="row.dir"
              class="pr-bw-col"
              :data-testid="`stats-bandwidth-${row.dir}`"
            >
              <div class="pr-bw-col__head">
                <span
                  class="pr-card__value"
                  :data-testid="`stats-bandwidth-${row.dir}-score`"
                  v-bind="tipBind(row.scoreTip, { focusable: true })"
                >
                  <span class="pr-card__num">{{ row.score }}</span>
                  <span class="pr-card__unit">%</span>
                </span>
                <span
                  class="pr-bw-col__side"
                  :data-tip="row.labelTip.value"
                  v-bind="tipBind(row.labelTip, { whenTruncated: true })"
                >{{ row.labelTip.value }}</span>
              </div>
              <div class="pr-card__bar-track">
                <span
                  class="pr-card__bar-hatch"
                  aria-hidden="true"
                />
                <span
                  class="pr-card__bar-fill"
                  :class="row.barTone === 'secondary' ? 'pr-card__bar-fill--secondary' : 'pr-card__bar-fill--primary'"
                  :style="{ width: `${row.score}%` }"
                  :data-testid="`stats-bandwidth-${row.dir}-bar`"
                />
              </div>
              <div
                class="pr-card__sub"
                v-bind="tipBind(row.ratioTip, { focusable: true })"
              >
                <span class="pr-card__sub-ratio">{{ row.ratio }}</span>
                <span class="pr-card__sub-unit">{{ row.unit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showRoofline && roofline"
        class="pr-stack-section"
        data-testid="stats-roofline"
      >
        <RooflinePanel
          :model="roofline"
          :locale="locale"
        />
      </div>

      <div
        v-if="showPipe"
        class="pr-stack-section"
        data-testid="pipe-occupancy"
      >
        <div class="pr-stack-section__head">
          <h4>{{ t('computeAnalysis', locale) }}</h4>
          <div class="pr-pipe-head__actions">
            <button
              v-if="showCompute"
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-compute"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'compute')"
            >
              <CannbotIcon />
            </button>
            <button
              type="button"
              class="pr-pipe-details"
              data-testid="pipe-details"
              @click="openPipeDetails"
            >
              {{ t('details', locale) }}
            </button>
          </div>
        </div>
        <div class="pr-panel pr-panel--pipe">
          <div
            v-if="showBlockSwitcher"
            class="pr-pipe-block"
            data-testid="pipe-block-switcher"
          >
            <span>{{ t('block', locale) }}</span>
            <CardMetricSelect
              v-model="blockId"
              :options="blockSelectOptions"
              variant="inline"
              test-id-prefix="pipe-block"
              :ariaLabel="t('block', locale)"
              :label-of="blockSelectLabel"
            />
          </div>
          <div
            v-if="showPipeSideToggle"
            class="pr-pipe-toggle"
            data-testid="pipe-side-toggle"
            role="group"
            :aria-label="t('pipeSide', locale)"
          >
            <button
              v-for="side in pipeSideOptions"
              :key="side"
              type="button"
              class="pr-pipe-toggle__btn"
              :class="{ 'pr-pipe-toggle__btn--active': pipeSide === side }"
              :data-testid="`pipe-side-${side}`"
              @click="pipeSide = side"
            >
              {{ PIPE_SIDE_LABEL[side] }}
            </button>
          </div>
          <div class="pr-pipe-chart">
            <div
              class="pr-pipe-scale"
              data-testid="pipe-scale"
            >
              <span class="pr-pipe-scale__spacer" />
              <div class="pr-pipe-scale__axis">
                <span
                  v-for="tick in PIPE_SCALE"
                  :key="tick"
                  class="pr-pipe-scale__tick"
                >{{ tick }}%</span>
              </div>
            </div>
            <ul class="pr-pipe-list">
              <li
                v-for="pipe in visiblePipes"
                :key="`${pipe.id}-${pipe.side ?? 'x'}`"
                class="pr-pipe-row"
                :style="{ '--pr-pipe': COLOR[pipe.colorKey] ?? COLOR.default }"
              >
                <span class="pr-pipe-row__label">{{ pipe.label }}</span>
                <span class="pr-pipe-row__track">
                  <span
                    class="pr-pipe-row__hatch"
                    aria-hidden="true"
                  />
                  <span
                    class="pr-pipe-row__bar"
                    :style="{ width: `${Math.min(100, Math.max(0, pipe.ratio * 100))}%` }"
                  />
                  <span
                    class="pr-pipe-row__grid"
                    aria-hidden="true"
                  />
                  <span
                    v-if="pipe.absoluteValue != null"
                    class="pr-pipe-row__abs"
                    data-testid="pipe-absolute"
                  >{{ formatPipeAbsolute(pipe.absoluteValue) }}</span>
                  <span class="pr-pipe-row__pct">{{ Math.round(pipe.ratio * 100) }}%</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        v-if="showTopology || isArchDiagram || (showMemory && !csvOnly)"
        class="pr-stack-section"
        :data-testid="showTopology ? 'stats-topology' : 'stats-memory-entry'"
      >
        <div class="pr-stack-section__head">
          <h4>{{ t('memoryAnalysis', locale) }}</h4>
          <div class="pr-pipe-head__actions">
            <button
              v-if="showMemory"
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-memory"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'memory')"
            >
              <CannbotIcon />
            </button>
            <button
              v-if="showMemory"
              type="button"
              class="pr-pipe-details"
              data-testid="topology-details"
              @click="openMemoryDetails"
            >
              {{ t('details', locale) }}
            </button>
          </div>
        </div>
        <div
          v-if="showTopology || isArchDiagram"
          class="pr-panel pr-panel--topo"
        >
          <div
            v-if="isArchDiagram"
            class="pr-pipe-block"
            data-testid="topology-metric-switcher"
          >
            <span>{{ t('metric', locale) }}</span>
            <CardMetricSelect
              v-model="archMetricMode"
              :options="archMetricModes"
              variant="inline"
              test-id-prefix="topology-metric"
              :ariaLabel="t('archMetricMode', locale)"
              :label-of="(m) => archMetricModeLabel(m, locale)"
            />
          </div>
          <MemoryTopologyPanel
            v-if="showTopology"
            :model="topologyModel"
            :locale="locale"
            show-fullscreen
            @open-details="openMemoryDetails"
            @open-fullscreen="openTopologyFullscreen"
          />
        </div>
      </div>

      <template v-if="csvOnly">
        <div
          v-if="showCompute"
          data-testid="stats-compute"
          class="pr-aside__detail"
        >
          <div class="pr-aside__detail-head">
            <h4 class="pr-aside__detail-title">
              {{ t('computeAnalysis', locale) }}
            </h4>
            <button
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-compute"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'compute')"
            >
              <CannbotIcon />
            </button>
          </div>
          <SummaryCategoryList
            v-if="computeCategories.length > 0 && !computeCsvScope"
            :categories="computeCategories"
            :active-id="activeCategory"
            :locale="locale"
            @update:active-id="activeCategory = $event"
          />
          <CsvFieldListPanel
            v-else
            :tables="report?.computeTables ?? []"
            :csv-texts="report?.csvTexts ?? {}"
            :show-block-switcher="false"
            :show-view-all="false"
            :selected-block-id="overlayBlockId"
            :locale="locale"
          />
        </div>
        <div
          v-if="showMemory"
          data-testid="stats-memory"
          class="pr-aside__detail"
        >
          <div class="pr-aside__detail-head">
            <h4 class="pr-aside__detail-title">
              {{ t('memoryAnalysis', locale) }}
            </h4>
            <button
              type="button"
              class="pr-cannbot"
              data-testid="cannbot-memory"
              :aria-label="t('cannbotAsk', locale)"
              :title="t('cannbotAsk', locale)"
              @click="emit('open-cannbot', 'memory')"
            >
              <CannbotIcon />
            </button>
          </div>
          <SummaryCategoryList
            v-if="memoryCategories.length > 0 && !memoryCsvScope"
            :categories="memoryCategories"
            :active-id="activeCategory"
            :locale="locale"
            @update:active-id="activeCategory = $event"
          />
          <CsvFieldListPanel
            v-else
            :tables="memoryTablesWithPipe"
            :csv-texts="report?.csvTexts ?? {}"
            :selected-block-id="overlayBlockId"
            :locale="locale"
            @update:selected-block-id="blockId = $event"
            @view-full-csv="emit('view-full-csv', $event)"
          />
        </div>
      </template>
    </div>
    </div>

    <Transition name="pr-aside-detail">
      <div
        v-if="asideSurface !== 'report'"
        :key="asideSurface"
        class="pr-aside__detail pr-aside__detail--overlay"
        :data-testid="detailTestId"
      >
        <header class="pr-aside__head">
          <div class="pr-aside__title-row">
            <button
              type="button"
              class="pr-aside__back"
              data-testid="stats-aside-back"
              :aria-label="t('back', locale)"
              :title="t('back', locale)"
              @click="backToReport"
            >
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="M10 3.5L4.5 8 10 12.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M5 8h8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <h3 :title="detailTitle">
              {{ detailTitle }}
            </h3>
          </div>
        </header>
        <div class="pr-aside__detail-body">
          <template v-if="asideSurface === 'hardware'">
            <HardwareDetailsPanel
              v-if="hasHardwareDetails && report?.hardwareDetails"
              :model="report.hardwareDetails"
              :locale="locale"
            />
            <p
              v-else
              class="pr-hw-missing"
              data-testid="hardware-info-missing"
            >
              {{ t('hardwareInfoMissing', locale) }}
            </p>
          </template>
          <template v-else-if="asideSurface === 'compute' && showCompute">
            <SummaryCategoryList
              v-if="computeCategories.length > 0 && !computeCsvScope"
              :categories="computeCategories"
              :active-id="activeCategory"
              :locale="locale"
              @update:active-id="activeCategory = $event"
            />
            <CsvFieldListPanel
              v-else
              :tables="report?.computeTables ?? []"
              :csv-texts="report?.csvTexts ?? {}"
              :show-block-switcher="false"
              :show-view-all="false"
              :selected-block-id="overlayBlockId"
              :locale="locale"
            />
          </template>
          <template v-else-if="asideSurface === 'memory' && showMemory">
            <SummaryCategoryList
              v-if="memoryCategories.length > 0 && !memoryCsvScope"
              :categories="memoryCategories"
              :active-id="activeCategory"
              :locale="locale"
              @update:active-id="activeCategory = $event"
            />
            <CsvFieldListPanel
              v-else
              :tables="memoryTablesWithPipe"
              :csv-texts="report?.csvTexts ?? {}"
              :selected-block-id="overlayBlockId"
              :locale="locale"
              @update:selected-block-id="blockId = $event"
              @view-full-csv="emit('view-full-csv', $event)"
            />
          </template>
        </div>
      </div>
    </Transition>

    <!--
      Teleported to `body` (the house pattern for floating chrome — ContextMenu, ReportToolbar's
      popovers, OverviewCharts' value tip). Keeping it in the aside cannot work: `.pr-main` is
      `z-index: 1` and `.pr-layout__aside` `z-index: 0`, so the whole timeline panel paints over
      the whole aside subtree and a left-flipped tip lost 177px of 320px at the seam.
    -->
    <Teleport to="body">
      <div
        v-if="cardTip"
        :id="tipId"
        class="pr-stat-tip"
        role="tooltip"
        data-testid="stats-card-tooltip"
        :style="tipStyle"
      >
        <div
          class="pr-stat-tip__value"
          data-testid="stats-card-tooltip-value"
        >
          {{ cardTip.content.value }}
        </div>
        <div
          v-if="cardTip.content.hint"
          class="pr-stat-tip__hint"
          data-testid="stats-card-tooltip-hint"
        >
          {{ cardTip.content.hint }}
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.pr-aside {
  /* Anchors the top wash. */
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--pr-bg-aside);
  padding: 10px 12px;
}

/** Design top glow behind the title / meta row (orange fade into the shell). */
.pr-aside__wash {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 0;
  height: 96px;
  background: linear-gradient(
    181.55deg,
    rgba(244, 132, 12, 0.1) -20.986%,
    rgba(199, 98, 7, 0) 81.41%
  );
  pointer-events: none;
}

.pr-aside__head {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

/** Stacked report + absolute drill-in overlay share this flex slot. */
.pr-aside__main {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.pr-aside__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  /* Vertical only. Exact-fit children (roofline 440px in a 456px well) overflow by
     a scrollbar gutter or a DPR subpixel and would otherwise open a horizontal bar. */
  overflow-x: hidden;
  overflow-y: auto;
  /* Query container for the summary grid's narrow-panel rule below. The body's inline size
     comes from the aside track, so containing it does not change how it lays out. */
  container-type: inline-size;
}

.pr-aside__head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ffffff;
}

.pr-aside__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pr-aside__icon {
  flex-shrink: 0;
  color: #e6e6e6;
}

.pr-aside__back,
.pr-aside__close {
  appearance: none;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #e6e6e6;
  line-height: 0;
  cursor: pointer;
}

.pr-aside__back:hover,
.pr-aside__close:hover {
  color: #ffffff;
}

.pr-aside__meta {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: #999999;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.pr-aside__meta-seg {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.pr-aside__meta-k {
  color: #8a8a8a;
}

.pr-aside__meta-v {
  color: #d0d0d0;
}

.pr-aside__more,
.pr-aside__hints,
.pr-pipe-details {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.pr-aside__more {
  color: #8a8a8a;
  font-size: 12px;
}

.pr-aside__hints,
.pr-pipe-details {
  color: #e6e6e6;
  font-size: 12px;
}

.pr-aside__hints {
  flex-shrink: 0;
  white-space: nowrap;
}

.pr-aside__more:hover {
  color: #d0d0d0;
  text-decoration: underline;
}

.pr-aside__hints:hover,
.pr-pipe-details:hover {
  color: #ffffff;
  text-decoration: underline;
}

.pr-pipe-head__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pr-cannbot {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  color: #e6e6e6;
  opacity: 0.85;
}

.pr-cannbot:hover {
  opacity: 1;
}

.pr-aside__meta .pr-cannbot {
  margin-left: auto;
}

.pr-aside__detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

/* Drill-in compute / memory / hardware overlay — covers shell + stack so
   back/title fade with the tables (not csv-only inline lists). */
.pr-aside__detail--overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  /* Match aside padding so the overlay header lines up with the shell. */
  padding: 10px 12px;
  overflow: hidden;
  /* Opaque so the stacked report under the overlay does not show through. */
  background: var(--pr-bg-aside);
}

.pr-aside__detail-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Opacity-only fade (no scale). */
.pr-aside-detail-enter-active,
.pr-aside-detail-leave-active {
  transition: opacity 200ms ease;
}

.pr-aside-detail-leave-active {
  pointer-events: none;
}

.pr-aside-detail-enter-from,
.pr-aside-detail-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pr-aside-detail-enter-active,
  .pr-aside-detail-leave-active {
    transition: none;
  }
}

.pr-hw-missing {
  margin: 0;
  padding: 16px 8px;
  font-size: 12px;
  color: #9a9a9a;
  text-align: center;
}

.pr-aside__detail-title {
  margin: 4px 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.pr-aside__detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 4px 0 2px;
}

.pr-aside__detail-head .pr-aside__detail-title {
  margin: 0;
}

/*
 * Sketch: 2×2 equal tiles (duration | AICore; compute | bandwidth); one tile per row below a
 * 430px well (see the container query below, PR-STATS-036).
 * Bottom pad only so tile edges align with stack islands below.
 */
.pr-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0 0 8px;
  border-radius: 0;
  background: var(--pr-bg-aside);
}

/*
 * A dragged-narrow aside (or a host too small for the preferred width) squeezes each tile to
 * ~36px per side column, where a two-column readout has nothing left to show. Below one tile's
 * worth of well the stack goes single-column and every side gets the full width back.
 */
@container (max-width: 430px) {
  .pr-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pr-card {
  min-width: 0;
  /* detail-strip-raised samples: TR ≈ #272f31 → BL #252525 */
  background: linear-gradient(225deg, #272f31 0%, #262b2c 35%, #252525 72%);
  box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.04);
  border: 0;
  border-radius: 8px;
  padding: 12px 14px;
}

.pr-card--na {
  display: flex;
  flex-direction: column;
}

.pr-card--na .pr-card__value {
  flex: 1 1 auto;
  align-items: center;
  color: #8a8a8a;
}

.pr-card__label {
  font-size: 11px;
  color: #999999;
  margin-bottom: 6px;
  /* Wrap rather than spill: `nowrap` + `overflow: visible` painted a long label outside the
     tile, where the body's `overflow-x: hidden` cropped it (PR-STATS-036). */
  white-space: normal;
}

.pr-card__sub {
  margin-top: 6px;
  font-size: 11px;
  color: #8a8a8a;
  /* Same rule as the card label above: wrap inside the tile instead of painting past it. The
     secondary falls back to `opName`, whose underscores give no break opportunity, so it needs
     `anywhere` to wrap at all (PR-STATS-036). */
  white-space: normal;
  overflow-wrap: anywhere;
}

.pr-card__value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: #ececec;
}

.pr-card__num {
  flex: 0 1 auto;
  white-space: nowrap;
}

.pr-card__unit {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 500;
  color: #868686;
}

.pr-card__bar-track {
  position: relative;
  margin-top: 8px;
  height: 8px;
  background: var(--pr-bg-aside);
  border-radius: 999px;
  overflow: hidden;
}

.pr-card__bar-hatch {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: repeating-linear-gradient(
    -45deg,
    #2a2a2a 0 2px,
    #1f1f1f 2px 4px
  );
}

.pr-card__bar-fill {
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  border-radius: inherit;
  min-width: 2px;
}

.pr-card__bar-fill--duration {
  min-width: 0;
  background: var(--pr-color-duration-bar);
}

.pr-card__bar-fill--primary {
  min-width: 0;
  background: var(--pr-color-card-bar-primary);
}

.pr-card__bar-fill--secondary {
  min-width: 0;
  background: var(--pr-color-card-bar-secondary);
}

.pr-bw-cols {
  display: flex;
  gap: 24px;
}

.pr-bw-col {
  flex: 1 1 0;
  min-width: 0;
}

/*
 * The column label sits beside the score while the two fit on one line, and drops to its own
 * line when they do not. Both children used to be `flex: 0 0 auto` in a `nowrap` row inside an
 * `overflow: hidden` column, so a label wider than the column — 并行使用率 / 负载均衡度, or
 * "Parallel utilization" — was cropped with no cue (PR-STATS-036). Ellipsis is the floor for a
 * column narrower than the label itself; every `.pr-bw-col__side` opens the shared card tooltip
 * (AICore, compute and BW alike) so an ellipsis is never a silent crop (PR-STATS-041).
 */
.pr-bw-col__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
}

.pr-bw-col__head > .pr-card__value {
  flex: 0 0 auto;
}

.pr-bw-col__side {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: #999999;
  white-space: nowrap;
}

.pr-bw-col .pr-card__sub {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  margin-top: 6px;
  font-size: 11px;
  color: #8a8a8a;
  line-height: 1.3;
  white-space: normal;
  overflow: hidden;
}

.pr-card__sub-ratio,
.pr-card__sub-unit {
  display: block;
  max-width: 100%;
  overflow: hidden;
}

/* Section titles sit on the aside shell; grey islands wrap chart bodies only. */
.pr-stack-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.pr-stack-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pr-stack-section__head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.pr-panel--pipe,
.pr-panel--topo {
  background: var(--pr-bg-panel);
  border-radius: 4px;
  padding: 10px;
}

.pr-panel--pipe {
  padding: 12px 10px 10px;
}

.pr-pipe-block {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 11px;
  color: #b8b8b8;
}

.pr-pipe-toggle {
  display: inline-flex;
  margin: 0 0 10px;
  background: #111111;
  border-radius: 4px;
  padding: 2px;
}

.pr-pipe-toggle__btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: #b3b3b3;
  font-size: 12px;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
}

.pr-pipe-toggle__btn--active {
  background: #343434;
  color: #ffffff;
}

.pr-pipe-chart {
  background: #202020;
  border-radius: 4px;
  padding: 10px 8px 12px;
}

.pr-pipe-scale,
.pr-pipe-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.pr-pipe-scale {
  margin-bottom: 8px;
  font-size: 12px;
  color: #999999;
}

.pr-pipe-scale__axis {
  position: relative;
  height: 16px;
}

.pr-pipe-scale__tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-variant-numeric: tabular-nums;
}

.pr-pipe-scale__tick:nth-child(1) {
  left: 0%;
  transform: none;
}

.pr-pipe-scale__tick:nth-child(2) {
  left: 20%;
}

.pr-pipe-scale__tick:nth-child(3) {
  left: 40%;
}

.pr-pipe-scale__tick:nth-child(4) {
  left: 60%;
}

.pr-pipe-scale__tick:nth-child(5) {
  left: 80%;
}

.pr-pipe-scale__tick:nth-child(6) {
  left: 100%;
  transform: translateX(-100%);
}

.pr-pipe-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pr-pipe-row__label {
  font-size: 12px;
  color: #999999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.pr-pipe-row__track {
  position: relative;
  display: block;
  height: 16px;
  border-radius: 4px;
  overflow: visible;
}

.pr-pipe-row__hatch {
  /* Tinted for the PIPE well (compute-load). Card hatch stays the summary-cards #2a2a2a/#1f1f1f pair. */
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--pr-pipe) 8%, #202020) 0 2px,
    color-mix(in srgb, var(--pr-pipe) 8%, #303030) 2px 4px
  );
}

.pr-pipe-row__bar {
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  border-radius: 4px;
  min-width: 0;
  box-sizing: border-box;
  background: var(--pr-pipe);
}

.pr-pipe-row__grid {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 4px;
  pointer-events: none;
  background-image:
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    ),
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    ),
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    ),
    linear-gradient(
      to right,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.15)
    );
  background-size: 1px 100%;
  background-position: 20% 0, 40% 0, 60% 0, 80% 0;
  background-repeat: no-repeat;
}

.pr-pipe-row__abs {
  position: absolute;
  left: 6px;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
  white-space: nowrap;
  line-height: 1;
  pointer-events: none;
}

.pr-pipe-row__pct {
  position: absolute;
  right: 6px;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #ffffff;
  pointer-events: none;
}

/*
 * Summary-card hover tooltip (PR-STATS-041). Teleported to `body` so no panel's `overflow` or
 * stacking context can crop it — the aside slot sits below `.pr-main`, which used to paint over a
 * left-flipped tip. Chrome matches the timeline EventTooltip / overview value tip: raised surface,
 * 12px radius, 8px/10px padding, 12px text at 1.45, the same soft shadow and 120ms fade-in
 * (dropped under `prefers-reduced-motion`). The exact value is the headline, the metric
 * description sits under it — white on both, separated by weight (PR-STATS-041e).
 */
.pr-stat-tip {
  position: fixed;
  /* Above `.pr-main` (1) / `.pr-aside__main` (1) now that `Teleport` puts this in the root
     stacking context; the raised-chrome level shared with the header wash and CANNBot button. */
  z-index: 20;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  /* Teleporting out of the aside drops the inherited `#e8e8e8`; both lines are white (041e). */
  color: #ffffff;
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
  /* The hint is a sentence, unlike the timeline tip's short lines; cap it so the popover keeps the
   * timeline tip's scale instead of stretching across the viewport. */
  max-width: 320px;
  animation: pr-stat-tip-in 120ms ease;
}

@keyframes pr-stat-tip-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pr-stat-tip {
    animation: none;
  }
}

.pr-stat-tip__value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pr-stat-tip__hint {
  margin-top: 4px;
  /* White, not the timeline tip's muted `#969696`: the hint is a full sentence at 12px, and the
   * muted grey read as washed out against the raised surface (PR-STATS-041e). The value keeps its
   * lead through weight, not colour. */
  color: #ffffff;
  white-space: normal;
}

/*
 * The value cells carry `tabindex="0"` so the tooltip's exact values are reachable without a
 * pointer (PR-STATS-041); a focus ring is what makes that path visible. Keyboard-only, so a mouse
 * hover never paints it.
 */
.pr-cards [tabindex]:focus-visible {
  outline: 1px solid #3078f0;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
