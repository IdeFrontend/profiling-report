<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import { t, archMetricModeLabel } from '../../i18n';
import { baselineDisplayTitle } from '../../domain/baselineTitle';
import {
  metricDiff,
  summaryDiffs,
  utilizationPercent,
  type MetricDiff,
  type SummaryMetricValues,
} from '../../domain/metricDiff';
import { asideRoundsToZero, formatAsidePct, formatAsideValue } from './asideValueFormat';
import type { BaselineTipRow } from './baselineTip';
import type {
  AdaptedReport,
  BandwidthCardModel,
  Baseline,
  BaselineReports,
  BaselineRow,
  MemoryHeatmapUnitId,
  MemoryTopologyModel,
  PipeOccupancyItem,
  PipeOccupancySide,
  ReportCapability,
  ReportViewModel,
  SummaryCategory,
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
import CannbotActions from './CannbotActions.vue';
import CloseButton from '../CloseButton.vue';
import SummaryDiffIndicator from './StatsSummaryPanel/SummaryDiffIndicator.vue';
import CardMetricSelect from '../TimelineView/SwimlaneView/CardMetricSelect.vue';
import DetailChevron from './DetailChevron.vue';
import CannworkOptimizeIcon from '../CannworkOptimizeIcon.vue';
import { cooldown } from '../../domain/cooldown';
import type { CannbotScope, CannbotSessions } from '../../domain/cannbot';

const props = defineProps<{
  report: ReportViewModel | null | undefined;
  locale?: string;
  capabilities?: ReportCapability[];
  /**
   * Emulate ArchDiagram metric mode. When the host passes it (ProfilingReport), aside +
   * topology fullscreen share one selection; omit for standalone mounts (local default).
   */
  archMetricMode?: ArchDiagramMetricMode;
  /**
   * Host-owned checked baselines (对比基线) — the picker's checkbox set. The
   * aside renders the comparison row list only while this set is non-empty;
   * each row's report pick edits the host-owned rows (`update:baselineRows`).
   */
  baselines?: Baseline[];
  /**
   * Comparison rows (对比基线): baseline + pack operator per row; row 0 is the
   * primary and drives every aside value, the rest surface only in the
   * per-value hover popups. Absent/empty = no comparison row.
   */
  baselineRows?: BaselineRow[];
  /**
   * Adapted packs for the checked baselines the rows reference (对比基线).
   * A row without a pack paints no comparison. Data-only side channel: never
   * enters the main load path.
   */
  baselineReports?: BaselineReports;
  /** Current report's operator id — auto-pairs the baseline pack when it matches. */
  /** Latest CANNWork session per scope, pushed by the host. Omitted → all scopes idle. */
  cannbotSessions?: CannbotSessions;
}>();


const emit = defineEmits<{
  close: [];
  'open-hardware-details': [];
  'view-full-csv': [payload: { fileName: string; text: string }];
  'open-pipe-details': [];
  /** §11.2.3.2: `unit` is the heat unit clicked on the diagram, so 全屏 opens on it. */
  'open-topology-fullscreen': [
    model: MemoryTopologyModel,
    unit?: MemoryHeatmapUnitId,
    baseline?: MemoryTopologyModel | null,
    baselineRows?: { label: string; model: MemoryTopologyModel }[],
  ];
  'open-cannbot': [scope: CannbotScope];
  'open-cannbot-stop': [scope: CannbotScope];
  'cannbot-reference': [scope: CannbotScope];
  'cannbot-view': [scope: CannbotScope];
  'perform-optimization': [];
  'update:archMetricMode': [mode: ArchDiagramMetricMode];
  /** Comparison-row edit (add/remove/switch report or operator) — host-owned rows. */
  'update:baselineRows': [rows: BaselineRow[]];
  'open-performance-hints': [];
  /**
   * A pointerdown inside the Baseline / Operator bar (capture phase, so the
   * selects' own `pointerdown.stop` cannot swallow it) — the root closes the
   * baselines popover on it (review PR #234).
   */
  'baseline-bar-down': [];
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
  'icache-read': 'var(--pr-color-icache-read)',
  'icache-slot': 'var(--pr-color-icache-slot)',
  default: 'var(--pr-color-default)',
};

const hasDuration = computed(
  () => props.report?.profile !== 'emulate' && props.report?.summary.taskDurationUs != null,
);

/** One block selector for every widget (DATA-19 / DATA-29): `''` = All, else that `block_id`. */
const blockId = ref('');

function rowsForBlockOf(
  report: ReportViewModel | null | undefined,
  fileName: string,
  id: string,
): Record<string, string>[] {
  if (!report) return [];
  const table = [...report.computeTables, ...report.memoryTables].find(
    (t) => t.fileName === fileName,
  );
  return table ? table.rows.filter((r) => r['block_id'] === id) : [];
}

/** Rows for one CSV in the picked block; searches compute and memory tabs (DATA-19). */
function rowsForBlock(fileName: string, id: string): Record<string, string>[] {
  return rowsForBlockOf(props.report, fileName, id);
}

function bandwidthCardsOf(
  report: ReportViewModel | null | undefined,
  id: string,
): BandwidthCardModel[] {
  const all = report?.bandwidthCards ?? [];
  if (!id) return all;
  const peak = report?.summary.gmBwTheoreticalGBs ?? all[0]?.sides[0]?.peakGBs;
  // A block with no `Memory.csv` shows no tile — never the All aggregate wearing its label.
  return bandwidthCardsFromRows(rowsForBlockOf(report, 'Memory.csv', id), peak);
}

function computeCardOf(report: ReportViewModel | null | undefined, id: string) {
  const all = report?.computeCard;
  if (!id) return all;
  // Peak is per-chip (DATA-29), so the picked block re-reads only the measured side and inherits
  // the peak; nothing to read (no row) blanks the tile rather than repeating the All value.
  return computeCardFromRows(
    rowsForBlockOf(report, 'ArithmeticUtilization.csv', id),
    report?.summary ?? {},
    all,
  );
}

const bandwidthCards = computed(() => bandwidthCardsOf(props.report, blockId.value));
const computeCard = computed(() => computeCardOf(props.report, blockId.value));

/* ===== Baseline comparison (对比基线) — summary cards, PIPE, topology, 详情 =====
 * Every slice reads the same aside-local context: the resolved baseline model,
 * plus `summaryDiffs` for the card metrics. Roofline is the remaining slice. */

/** Adapted pack behind a checked baseline (host-cached by baseline id). */
function packById(baselineId: string): AdaptedReport | null {
  return props.baselineReports?.[baselineId]?.report ?? null;
}

/** Adapted pack behind one comparison row. */
function packOf(row: BaselineRow | null | undefined): AdaptedReport | null {
  if (!row) return null;
  return packById(row.baselineId);
}

/** Operator options for a baseline pack; a flat pack synthesizes one option. */
function baselineOperatorOptionsOf(rep: AdaptedReport | null | undefined) {
  if (!rep) return [];
  if (rep.operators && rep.operators.length > 0) {
    return rep.operators.map((o) => ({ id: o.id, label: o.label }));
  }
  const keys = Object.keys(rep.operatorReports ?? {});
  if (keys.length > 0) return keys.map((id) => ({ id, label: id }));
  const opName = rep.reportModel?.summary.opName;
  return opName ? [{ id: opName, label: opName }] : [];
}

/** Operator options for one checked baseline: the host-declared `operators`
 *  records win (the data model's contract — a real host lists the pack's
 *  operators before its bytes ever adapt), else the adapted pack's own list. */
function baselineEntryOperatorOptionsOf(
  baseline: Baseline | undefined,
  rep: AdaptedReport | null | undefined,
) {
  if (baseline?.operators && baseline.operators.length > 0) {
    return baseline.operators.map((o) => ({ id: o.id, label: o.label }));
  }
  return baselineOperatorOptionsOf(rep);
}

/** The row's operator: its own pick when valid, else the pack operator matching
 * the open report's `opName`, else the first (review PR #234 semantics). */
function resolveRowOperator(operatorId: string, options: { id: string }[]): string | null {
  if (options.length === 0) return null;
  if (operatorId && options.some((o) => o.id === operatorId)) return operatorId;
  const match = summary.value?.opName;
  if (match != null && options.some((o) => o.id === match)) return match;
  return options[0].id;
}

interface ResolvedBaselineRow {
  row: BaselineRow;
  index: number;
  label: string;
  options: { id: string; label: string }[];
  operatorId: string | null;
  model: ReportViewModel | null;
}

/** Every comparison row resolved against its host pack (the popup list uses all
 * of them; row 0 is the primary). A row without a pack has `model: null`. */
const resolvedRows = computed<ResolvedBaselineRow[]>(() =>
  (props.baselineRows ?? []).map((row, index) => {
    const report = packOf(row);
    const entry = checkedBaselines.value.find((b) => b.id === row.baselineId);
    const options = baselineEntryOperatorOptionsOf(entry, report);
    const operatorId = resolveRowOperator(row.operatorId, options);
    const model = report
      ? (operatorId != null ? report.operatorReports?.[operatorId]?.reportModel : null)
        ?? report.reportModel
      : null;
    const zh = (props.locale ?? 'zh').toLowerCase().startsWith('zh');
    return {
      row,
      index,
      // 1130 guide typography: no space before the number in zh (基线1).
      label: zh
        ? `${t('baselineLabel', props.locale)}${index + 1}`
        : `${t('baselineLabel', props.locale)} ${index + 1}`,
      options,
      operatorId,
      model,
    };
  }),
);

const primaryRow = computed(() => resolvedRows.value[0] ?? null);

/** The primary row's ReportViewModel — the singular comparison every surface reads. */
const baselineModel = computed<ReportViewModel | null>(() => primaryRow.value?.model ?? null);

function sumMeasuredGBs(cards: BandwidthCardModel[], id: string): number | undefined {
  const card = cards.find((c) => c.id === id);
  if (!card || card.sides.length === 0) return undefined;
  return card.sides.reduce((a, s) => a + s.measuredGBs, 0);
}

/** A fraction clamped to [0, 1] and snapped to the AICore card's OWN display
 *  grid (two decimals of the [0, 100]% it prints), so the comparison diffs the
 *  score a reader can verify on the card. */
function clampFraction(n: number | null | undefined): number | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  const clamped = Math.min(1, Math.max(0, n));
  return Number((clamped * 100).toFixed(2)) / 100;
}

/** Measured throughput rewritten so measured ÷ peak lands on the compute/BW
 *  card's printed INTEGER score (`utilScore`). The card prints that integer and
 *  the diff picks it up as-is, so a badge never claims a delta between two
 *  numbers the cards cannot show (review finding: 42.3% vs 41.6% printed 42
 *  both ways while the badge read 0.7). */
function scoreMeasured(measured: number | undefined, peak: number | undefined): number | undefined {
  if (measured == null || peak == null || !Number.isFinite(measured) || !Number.isFinite(peak) || peak <= 0) {
    return measured;
  }
  return (peak * utilScore(measured, peak)) / 100;
}

/** Raw card metrics of one report side, in the card's own units. The clamped
 *  metrics (AICore util/balance, compute, BW) carry EXACTLY the score the card
 *  prints — two-decimal percent for AICore, an integer percent for compute/BW —
 *  so the diffs and the hover popups below can never disagree with the card;
 *  duration stays raw. */
function metricValues(report: ReportViewModel | null | undefined, id: string): SummaryMetricValues {
  const bw = bandwidthCardsOf(report, id);
  const readCard = bw.find((c) => c.id === 'input');
  const writeCard = bw.find((c) => c.id === 'output');
  const compute = computeCardOf(report, id);
  const side = (which: 'aic' | 'aiv') => {
    const found = compute?.sides.find((s) => s.side === which);
    return found
      ? {
          ...found,
          measuredTflops: scoreMeasured(found.measuredTflops, found.peakTflops),
        }
      : undefined;
  };
  return {
    taskDurationUs: report?.summary.taskDurationUs,
    // summaryDiffs turns these fractions into percentages; the clamp + 2dp snap
    // is the same [0, 100]% score the AICore card shows.
    parallelUtilization: clampFraction(report?.summary.parallelUtilization),
    parallelBalance: clampFraction(report?.summary.parallelBalance),
    compute: { aic: side('aic'), aiv: side('aiv') },
    bandwidth: {
      read: readCard
        ? {
            measuredGBs: scoreMeasured(sumMeasuredGBs(bw, 'input'), readCard.sides[0]?.peakGBs),
            peakGBs: readCard.sides[0]?.peakGBs,
          }
        : undefined,
      write: writeCard
        ? {
            measuredGBs: scoreMeasured(sumMeasuredGBs(bw, 'output'), writeCard.sides[0]?.peakGBs),
            peakGBs: writeCard.sides[0]?.peakGBs,
          }
        : undefined,
    },
  };
}

const diffs = computed(() => {
  const bl = baselineModel.value;
  if (!bl || !props.report) return null;
  return summaryDiffs(
    metricValues(props.report, blockId.value),
    metricValues(bl, blockId.value),
  );
});

/**
 * Comparison mode (对比基线): a resolved baseline pack is present. The summary grid then
 * raises its minimum tile to 300px (`repeat(auto-fit, minmax(300px, 1fr))`) — enough for
 * the two value + diff-chip rows inside one card, so a two-column state never paints a chip
 * past its tile — and the well width picks the column count: the default ~456px well keeps
 * one card per row, a widened aside fits two (PR-STATS-059). Without a pack the sketch's
 * 2×2 grid stays.
 */
const compareCards = computed(() => baselineModel.value != null);

/**
 * Diff text per metric — the mockup prints the unsigned magnitude in the
 * metric's own unit: bare number for duration (unit implied by the base
 * value) and compute, `%` attached for AICore/BW. Everything rides the panel's
 * ONE two-decimal format (PR-STATS-060); a magnitude whose two-decimal
 * rounding lands on `0.00` yields no badge.
 */
function diffText(diff: MetricDiff | null | undefined, kind: 'duration' | 'pct' | 'bare'): string {
  if (!diff) return '';
  if (kind === 'pct') {
    return asideRoundsToZero(diff.magnitude) ? '' : formatAsidePct(diff.magnitude);
  }
  if (kind === 'duration') {
    // Same unit as the current card's base value: ms when it prints ms, else µs.
    const us = props.report?.summary.taskDurationUs;
    const magnitude = us != null && us >= 1000 ? diff.magnitude / 1000 : diff.magnitude;
    return asideRoundsToZero(magnitude) ? '' : formatAsideValue(magnitude);
  }
  return asideRoundsToZero(diff.magnitude) ? '' : formatAsideValue(diff.magnitude);
}

function diffDirectionLabel(tone: MetricDiff['tone']): string {
  return tone === 'increase' ? t('diffIncreased', props.locale) : t('diffDecreased', props.locale);
}

interface DiffView {
  tone: MetricDiff['tone'];
  text: string;
  label: string;
}

/** A renderable diff: null when the metric is missing, equal, or rounds to zero. */
function diffView(diff: MetricDiff | null | undefined, kind: 'duration' | 'pct' | 'bare'): DiffView | null {
  const text = diffText(diff, kind);
  return diff && text ? { tone: diff.tone, text, label: diffDirectionLabel(diff.tone) } : null;
}

const durationDiff = computed(() => diffView(diffs.value?.taskDurationUs, 'duration'));
const parallelDiff = computed(() => diffView(diffs.value?.parallelUtilization, 'pct'));
const balanceDiff = computed(() => diffView(diffs.value?.parallelBalance, 'pct'));
const computeAicDiff = computed(() => diffView(diffs.value?.computeAic, 'bare'));
const computeAivDiff = computed(() => diffView(diffs.value?.computeAiv, 'bare'));
const bwReadDiff = computed(() => diffView(diffs.value?.bandwidthRead, 'pct'));
const bwWriteDiff = computed(() => diffView(diffs.value?.bandwidthWrite, 'pct'));

/* ===== Multi-baseline hover popups (对比基线) =====
 * Every comparison row is diffed against the same open report through the same
 * math as the primary (`summaryDiffs`), so the popup can never disagree with
 * the inline badge. The current report rides first as the reference value; the
 * popup exists for every comparison row, including a single baseline (the
 * numbers are the popup's job — the chip only carries the delta). */

const currentMetricValues = computed(() => metricValues(props.report, blockId.value));
const rowComparisons = computed(() =>
  resolvedRows.value.map((entry) => {
    if (!entry.model) return { entry, metrics: null, diffs: null };
    const metrics = metricValues(entry.model, blockId.value);
    return { entry, metrics, diffs: summaryDiffs(currentMetricValues.value, metrics) };
  }),
);

function buildMetricTip(
  currentValue: string | null,
  read: (cmp: (typeof rowComparisons.value)[number]) => {
    value: string;
    diff?: MetricDiff | null;
  } | null,
  kind: 'duration' | 'pct' | 'bare',
): BaselineTipRow[] | null {
  if (resolvedRows.value.length === 0) return null;
  const rows: BaselineTipRow[] = [];
  if (currentValue != null) {
    rows.push({ label: t('compareCurrent', props.locale), value: currentValue });
  }
  for (const cmp of rowComparisons.value) {
    const got = read(cmp);
    if (!got) continue;
    const view = diffView(got.diff ?? null, kind);
    rows.push({
      label: cmp.entry.label,
      value: got.value,
      tone: view?.tone,
      direction: view?.label,
      delta: view?.text,
    });
  }
  return rows.length > 1 ? rows : null;
}

const durationTip = computed(() => {
  const cur = summary.value?.taskDurationUs;
  // One unit for the whole popup — the CURRENT card's (ms when it prints ms,
  // else µs), so the rows stay comparable (1130 guide).
  const inMs = cur != null && cur >= 1000;
  const fmt = (us: number) =>
    inMs ? `${formatAsideValue(us / 1000)} ms` : `${formatAsideValue(us)} µs`;
  return buildMetricTip(
    cur != null ? fmt(cur) : null,
    (c) => {
      const us = c.metrics?.taskDurationUs;
      return us == null ? null : { value: fmt(us), diff: c.diffs?.taskDurationUs };
    },
    'duration',
  );
});
const parallelTip = computed(() => {
  // currentMetricValues carries the clamped [0, 1] fraction the card prints.
  const cur = utilizationPercent(currentMetricValues.value.parallelUtilization, 1);
  return buildMetricTip(
    cur != null ? formatAsidePct(cur) : null,
    (c) => {
      const v = utilizationPercent(c.metrics?.parallelUtilization, 1);
      return v == null ? null : { value: formatAsidePct(v), diff: c.diffs?.parallelUtilization };
    },
    'pct',
  );
});
const balanceTip = computed(() => {
  const cur = utilizationPercent(currentMetricValues.value.parallelBalance, 1);
  return buildMetricTip(
    cur != null ? formatAsidePct(cur) : null,
    (c) => {
      const v = utilizationPercent(c.metrics?.parallelBalance, 1);
      return v == null ? null : { value: formatAsidePct(v), diff: c.diffs?.parallelBalance };
    },
    'pct',
  );
});
const computeTip = (side: 'aic' | 'aiv') =>
  computed(() => {
    const cur = utilizationPercent(
      currentMetricValues.value.compute?.[side]?.measuredTflops,
      currentMetricValues.value.compute?.[side]?.peakTflops,
    );
    return buildMetricTip(
      cur != null ? formatAsideValue(cur) : null,
      (c) => {
        const v = utilizationPercent(
          c.metrics?.compute?.[side]?.measuredTflops,
          c.metrics?.compute?.[side]?.peakTflops,
        );
        return v == null
          ? null
          : {
              value: formatAsideValue(v),
              diff: side === 'aic' ? c.diffs?.computeAic : c.diffs?.computeAiv,
            };
      },
      'bare',
    );
  });
const computeAicTip = computeTip('aic');
const computeAivTip = computeTip('aiv');
const bandwidthTip = (dir: 'read' | 'write') =>
  computed(() => {
    const cur = utilizationPercent(
      currentMetricValues.value.bandwidth?.[dir]?.measuredGBs,
      currentMetricValues.value.bandwidth?.[dir]?.peakGBs,
    );
    return buildMetricTip(
      cur != null ? formatAsidePct(cur) : null,
      (c) => {
        const v = utilizationPercent(
          c.metrics?.bandwidth?.[dir]?.measuredGBs,
          c.metrics?.bandwidth?.[dir]?.peakGBs,
        );
        return v == null
          ? null
          : {
              value: formatAsidePct(v),
              diff: dir === 'read' ? c.diffs?.bandwidthRead : c.diffs?.bandwidthWrite,
            };
      },
      'pct',
    );
  });
const bwReadTip = bandwidthTip('read');
const bwWriteTip = bandwidthTip('write');
const roofline = computed(() => {
  const id = blockId.value;
  if (!id) return props.report?.roofline;
  // A block with no GM rebuild must not wear the All GM label. Chip-level series
  // and non-GM measured points stay when this block has CSV rows that cannot
  // build GM (PR-STATS-014f). No arith/mem rows at all still hides the chart
  // (PR-STATS-014d) — do not repeat the All points under a block label.
  const all = props.report?.roofline;
  const arithRows = rowsForBlock('ArithmeticUtilization.csv', id);
  const memRows = rowsForBlock('Memory.csv', id);
  const rebuilt = rooflineFromRows(arithRows, memRows);
  const chipPoints = (all?.points ?? []).filter((p) => p.id !== 'gm');
  if (!rebuilt) {
    if (arithRows.length === 0 && memRows.length === 0) return undefined;
    if (!all || chipPoints.length === 0) return undefined;
    return { ...all, points: chipPoints, mixLabels: [] };
  }
  const points = [...chipPoints, ...rebuilt.points];
  const allSeries = all?.series;
  if (allSeries && allSeries.length > 0) {
    return { points, mixLabels: rebuilt.mixLabels, series: allSeries };
  }
  // Interim host roof (root peaks, no series). rebuilt is the example catalog,
  // which would hide that single roof from the panel's legacy path.
  if (all && (!all.series || all.series.length === 0)) {
    return { ...all, points, mixLabels: rebuilt.mixLabels };
  }
  return { ...rebuilt, points };
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
 * Precision ceiling for a percent or a ratio (PR-STATS-042): **4 significant digits**. Leading
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
/*
 * `shallowRef`, not `ref`: the content is an immutable `{value, hint}` pair and nothing mutates it,
 * so deep reactivity buys nothing — and it would make `cardTip.value.content` a reactive **proxy**,
 * breaking the `=== tip` identity check in `tipBind` (and the popover would silently drop its
 * `aria-describedby`). Assignment still triggers, which is the only change we make.
 */
const cardTip = shallowRef<{ content: CardTip; x: number; y: number } | null>(null);
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

/** Anchor for the duration breakdown list (teleported — aside `overflow` would clip an in-card box). */
const durationBreakdownTip = ref<{ top: number; left: number; width: number } | null>(null);

function openDurationBreakdownTip(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  durationBreakdownTip.value = { top: r.bottom + 6, left: r.left, width: r.width };
}

function closeDurationBreakdownTip() {
  durationBreakdownTip.value = null;
}

/**
 * `tipStyle` caches the viewport size to flip the box, and `window.innerWidth` is not reactive, so
 * a resize never recomputes it: the card moves and the popover stays at the old coordinates.
 * Measured from a keyboard-focused trigger, a 1600 → 1100px resize stranded the box **708px** from
 * its card and off-screen right. Drop it instead — the same contract as `.pr-aside__body` scroll.
 */
function onWindowResize() {
  closeTip();
  closeDurationBreakdownTip();
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
/**
 * True when the pointer is over a comparison delta chip. The chip owns its own
 * multi-baseline popup (1130 guide: the popup opens on the DELTA, not on the
 * card value); without this guard, entering the value row opens the card's
 * exact-value tooltip too.
 */
function overDiffChip(e: PointerEvent): boolean {
  const el = typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(e.clientX, e.clientY)
    : null;
  return !!el?.closest?.('.pr-diff');
}

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
           * Only while *this* trigger owns the popover, and the `Teleport` body is `v-if`-gated on
           * `cardTip`, so the reference never dangles. Two separate traps:
           *   - no popover open → the id is absent from the document (dangling IDREF, which AT must
           *     ignore and axe fails as `aria-valid-attr-value`);
           *   - a *different* trigger's popover open → `cardTip` is a singleton, so binding on every
           *     focusable trigger would describe B, C, … with A's value. Browsing in browse mode (no
           *     focus) would read the wrong description.
           * Identity, not a key, because each view model builds its tip once and the template passes
           * that same object both here and to `openTip`. Read during render, so it lands with the
           * popover in the same flush.
           */
          ...(cardTip.value?.content === tip ? { 'aria-describedby': tipId } : {}),
        }
      : {}),
    onPointerenter: (e: PointerEvent) => {
      if (overDiffChip(e) || hidden(e.currentTarget)) return;
      openTip(tip, e.clientX, e.clientY);
    },
    onPointermove: (e: PointerEvent) => {
      // Over a delta chip the comparison popup owns the pointer; close the
      // card's exact-value tooltip instead of re-opening it on every move.
      if (overDiffChip(e)) {
        closeTip();
        return;
      }
      // Moving within the value row (e.g. off the delta) must re-open the
      // value tip: no pointerenter fires while the pointer never left the row.
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
/** The four `summary.jsonl` categories the memory 详情 lists. One predicate for the current and
 *  the baseline side, so the comparison can never pair a category the list itself would drop. */
const MEMORY_CATEGORY_IDS = ['MemoryL0', 'L2Cache', 'Memory', 'MemoryUB'] as const;
function isMemoryCategory(c: SummaryCategory): boolean {
  return (MEMORY_CATEGORY_IDS as readonly string[]).includes(c.id);
}
const memoryCategories = computed(() =>
  (props.report?.summaryCategories ?? []).filter(isMemoryCategory),
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
/** Mount when the adapter (or host) advertises the `roofline` capability. */
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

const rooflinePanel = ref<{ closePointTip: () => void } | null>(null);

// A card tooltip holds a snapshot of its metric, and the overlays paint under it: drop it whenever
// the surface changes instead of letting it outlive the card it describes. The roofline tip is
// teleported to `body` (z-index 20) and would otherwise paint over this overlay (z-index 2).
watch(asideSurface, () => {
  closeTip();
  closeDurationBreakdownTip();
  rooflinePanel.value?.closePointTip();
});

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
function memoryTablesWithPipeOf(report: ReportViewModel | null | undefined) {
  return [
    ...(report?.memoryTables ?? []),
    ...(report?.computeTables ?? []).filter((t) => t.fileName === 'PipeUtilization.csv'),
  ];
}

const memoryTablesWithPipe = computed(() => memoryTablesWithPipeOf(props.report));

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
function topologyOf(report: ReportViewModel | null | undefined) {
  if (isArchDiagram.value) {
    // Each side rebuilds from its own ArchDiagramMetrics with the shared mode — never the
    // adapter snapshot, which is always the default `*_gbs` (DATA-30 / PR-STATS-037).
    const csv = archDiagramCsvFromTexts(report?.csvTexts);
    return topologyFromArchDiagramMetrics(csv, archMetricMode.value);
  }
  const id = blockId.value;
  const tables = memoryTablesWithPipeOf(report);
  // A picked block shows only that block's rows — never the All aggregate wearing its label.
  if (id && tables.length > 0) return buildMemoryTopology(tables, id);
  return report?.memoryTopology;
}

const topologyModel = computed(() => topologyOf(props.report));

/**
 * The selected baseline's topology in the SAME scope as `topologyModel` (PR-STATS-056): All reads
 * the baseline's adapter snapshot, a picked block rebuilds from the baseline's own CSVs (the one
 * block selector scopes both sides), and ArchDiagram rebuilds from the baseline's own
 * ArchDiagramMetrics with the selected metric mode. `null` without a pack, so the panel paints
 * no delta nodes and its DOM stays exactly as before comparison.
 */
const topologyBaseline = computed(() =>
  baselineModel.value ? topologyOf(baselineModel.value) : null,
);

/** Every comparison row's topology in the same scope (badge hover popup, multi-row). */
const topologyBaselineRows = computed(() => {
  const rows: { label: string; model: MemoryTopologyModel }[] = [];
  for (const entry of resolvedRows.value) {
    const model = entry.model ? topologyOf(entry.model) : null;
    if (model) rows.push({ label: entry.label, model });
  }
  return rows;
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

/* ===== Baseline comparison rows (对比基线, 1130 multi-row) =====
 * With any baseline checked the bar renders at least one row (基线1): a report
 * select + an operator select per row, `−` on every row but the first, and `+`
 * to add one. Row 0 is the PRIMARY — every aside value reads it; the other
 * rows surface only in the per-value hover popup. Rows are host-owned; the
 * aside renders and emits the whole edited list. */

const checkedBaselines = computed(() => props.baselines ?? []);
const comparisonRows = computed(() => props.baselineRows ?? []);

/** Shared report-slot width for the comparison rows: the widest report title's
 *  FULL text (caption + select), measured from the rendered labels. Every row
 *  uses it, so the 算子 column stands one under another even when the rows show
 *  different report names; the report select fills the slot (the operator stays
 *  pressed to it), and the slot shrinks before the operator on a narrow aside —
 *  widening restores the report text first, then the operator value. */
const baselineBarEl = ref<HTMLElement | null>(null);
const reportSlotW = ref<number | null>(null);
/** Shared 基线N label width: the digits differ in a proportional fallback font
 *  (the Linux CI font made 基线1 / 基线2 10.7px apart), which shifted the field
 *  and shrank the gap differently per row — the operator columns lost their
 *  common line. Every row label takes the widest label's width. */
const rowLabelW = ref<number | null>(null);
let measureCanvas: CanvasRenderingContext2D | null | undefined;
/** The label's own TEXT width, independent of the box it currently clips in
 *  (reading `scrollWidth` would feed the slot width back into itself and creep
 *  up a pixel on every remeasure). */
function labelTextWidth(label: HTMLElement): number {
  if (measureCanvas === undefined) {
    measureCanvas = document.createElement('canvas').getContext('2d');
  }
  if (!measureCanvas) return 0;
  const style = getComputedStyle(label);
  measureCanvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return measureCanvas.measureText(label.textContent ?? '').width;
}
async function measureReportSlot(): Promise<void> {
  await nextTick();
  const bar = baselineBarEl.value;
  if (!bar) return;
  let widest = 0;
  let widestLabel = 0;
  for (const row of bar.querySelectorAll('.pr-aside__baseline-row')) {
    const rowLabel = row.querySelector('.pr-aside__baseline-label') as HTMLElement | null;
    // No layout (jsdom / hidden aside): skip the canvas measurement.
    if (rowLabel && rowLabel.getBoundingClientRect().width > 0) {
      widestLabel = Math.max(widestLabel, labelTextWidth(rowLabel));
    }
    const caption = row.querySelector(
      '.pr-aside__baseline-sub--report .pr-aside__baseline-k',
    ) as HTMLElement | null;
    const label = row.querySelector(
      '.pr-aside__baseline-sub--report .pr-metric-select__label',
    ) as HTMLElement | null;
    if (!caption || !label) continue;
    // No layout (jsdom / hidden aside): leave the design fallback in place.
    if (caption.getBoundingClientRect().width <= 0) continue;
    // Caption + sub gap + full label + the select's trigger gap/chevron/border.
    widest = Math.max(
      widest,
      caption.getBoundingClientRect().width + 4 + labelTextWidth(label) + 26,
    );
  }
  reportSlotW.value = widest > 0 ? Math.min(640, Math.ceil(widest) + 2) : null;
  rowLabelW.value = widestLabel > 0 ? Math.ceil(widestLabel) + 1 : null;
}
const baselineSlotStyle = computed(() => {
  const style: Record<string, string> = {};
  if (reportSlotW.value) style['--pr-baseline-report-w'] = `${reportSlotW.value}px`;
  if (rowLabelW.value) style['--pr-baseline-row-label-w'] = `${rowLabelW.value}px`;
  return style;
});
/** Only the inputs of the rendered report TITLE (`baselineDisplayTitle`: name,
 *  path, pickedAt) and the locale size the slot — an operator pick must not
 *  re-measure (the computed key compares by value, so it does not fire). */
const reportSlotKey = computed(() =>
  [
    (props.baselines ?? [])
      .map((b) => `${b.id}:${b.name}:${b.pickedAt ?? ''}:${b.path}`)
      .join('|'),
    comparisonRows.value.map((r) => `${r.id}:${r.baselineId}`).join('|'),
    props.locale,
  ].join('||'),
);
watch(reportSlotKey, measureReportSlot, { flush: 'post', immediate: true });
const baselineIds = computed(() => checkedBaselines.value.map((b) => b.id));
/** Operator options of every checked baseline — each operator is one row slot. */
const operatorOptionsByBaseline = computed(() => {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const baseline of checkedBaselines.value) {
    map.set(baseline.id, baselineEntryOperatorOptionsOf(baseline, packById(baseline.id)));
  }
  return map;
});

/** Row capacity: the SUM of operator counts across the checked baselines, so the
 *  same report can carry several rows with different operators. A baseline whose
 *  pack has no operator list still counts as one slot. */
const baselineRowCapacity = computed(() =>
  checkedBaselines.value.reduce(
    (sum, baseline) =>
      sum + Math.max(1, operatorOptionsByBaseline.value.get(baseline.id)?.length ?? 0),
    0,
  ),
);
const canAddBaselineRow = computed(
  () => comparisonRows.value.length < baselineRowCapacity.value,
);

function baselineNameOf(id: string): string {
  const entry = checkedBaselines.value.find((b) => b.id === id);
  // The derived title: filename + timestamp instead of a generated boilerplate
  // id (review PR #234); the raw id stays the last-resort fallback.
  return entry ? baselineDisplayTitle(entry) : id;
}
function rowOperatorName(entry: ResolvedBaselineRow, id: string): string {
  const label = entry.options.find((o) => o.id === id)?.label;
  if (label != null) return label;
  return id === '' ? t('selectPlaceholder', props.locale) : id;
}

/** Row caption, 1130 guide: `基线1：` (zh, no space) / `Baseline 1:` (en). */
function rowLabelText(index: number): string {
  const n = index + 1;
  const zh = (props.locale ?? 'zh').toLowerCase().startsWith('zh');
  return zh
    ? `${t('baselineLabel', props.locale)}${n}：`
    : `${t('baselineLabel', props.locale)} ${n}:`;
}

/** Field captions, 1130 guide: `报告：` / `算子：` (zh full-width colon) vs `Report:`. */
function fieldCaption(key: 'stats' | 'operatorLabel'): string {
  const zh = (props.locale ?? 'zh').toLowerCase().startsWith('zh');
  return `${t(key, props.locale)}${zh ? '：' : ':'}`;
}

function emitRows(next: BaselineRow[]): void {
  emit('update:baselineRows', next);
}
/** `baseline|operator` pairs the OTHER rows hold — the edited row's own pair is
 *  free to keep. Same operator source as the `+` path (host-declared first,
 *  pack fallback), so a row that still carries `operatorId: ''` counts as the
 *  operator it resolves to. */
function usedPairsExcept(rowId: string): Set<string> {
  return new Set(
    comparisonRows.value
      .filter((row) => row.id !== rowId)
      .map((row) => {
        const options = operatorOptionsByBaseline.value.get(row.baselineId) ?? [];
        return `${row.baselineId}|${resolveRowOperator(row.operatorId, options) ?? ''}`;
      }),
  );
}
/** The first operator of `baselineId` the other rows do not hold, or null when
 *  every operator slot of that report is taken. */
function freeOperatorFor(baselineId: string, used: Set<string>): string | null {
  const options = operatorOptionsByBaseline.value.get(baselineId) ?? [];
  return options.find((option) => !used.has(`${baselineId}|${option.id}`))?.id ?? null;
}
/** Move the row to another report: its operator resets to the new report's
 *  default (the open report's `opName` match, else the first) — unless another
 *  row already holds that pair, in which case the row takes the first free
 *  operator. When EVERY operator of the target report is already held by the
 *  other rows the switch is a NO-OP: moving the row would duplicate a pair and
 *  burn a capacity slot while leaving a distinct pair unreachable (review
 *  2026-11-25). */
function setRowBaseline(rowId: string, baselineId: string): void {
  const options = operatorOptionsByBaseline.value.get(baselineId) ?? [];
  const used = usedPairsExcept(rowId);
  let operatorId: string | null;
  if (options.length === 0) {
    // A report without an operator list owns exactly one row slot (`id: ''`).
    operatorId = used.has(`${baselineId}|`) ? null : '';
  } else {
    const preferred = resolveRowOperator('', options);
    operatorId =
      preferred && !used.has(`${baselineId}|${preferred}`)
        ? preferred
        : freeOperatorFor(baselineId, used);
  }
  // Every pair of that report is taken: keep the row where it is.
  if (operatorId == null) return;
  emitRows(
    comparisonRows.value.map((r) =>
      r.id === rowId ? { ...r, baselineId, operatorId } : r,
    ),
  );
}
/** Pick the row's operator. A pair another row already holds resolves to the
 *  first free operator of the same report — the dropdowns offer every operator,
 *  but the row set stays one distinct pair per row (review 2026-11-25). */
function setRowOperator(rowId: string, operatorId: string): void {
  const row = comparisonRows.value.find((r) => r.id === rowId);
  if (!row) return;
  const used = usedPairsExcept(rowId);
  const next = used.has(`${row.baselineId}|${operatorId}`)
    ? (freeOperatorFor(row.baselineId, used) ?? operatorId)
    : operatorId;
  emitRows(
    comparisonRows.value.map((r) => (r.id === rowId ? { ...r, operatorId: next } : r)),
  );
}
/** The next free `arow-N` id. Derived from the rows already present rather than
 *  a per-mount counter: the host-owned rows outlive the aside (closing and
 *  reopening it remounts the component), and a reused id made the two rows
 *  share a `:key` and edit each other. */
function nextRowId(): string {
  const used = new Set(comparisonRows.value.map((r) => r.id));
  let seq = comparisonRows.value.length + 1;
  while (used.has(`arow-${seq}`)) seq += 1;
  return `arow-${seq}`;
}
/** Add a row for the first (baseline, operator) pair not used yet — the same
 *  report can repeat with another operator. The caller disables `+` once every
 *  checked baseline's operator slots are used. */
function addBaselineRow(): void {
  if (!canAddBaselineRow.value) return;
  // The used set must read the SAME operator source as the candidates/capacity
  // (host-declared first, pack fallback): with no adapted pack the pack path
  // resolves every row to the bare key and the first candidate looks free
  // forever, so `+` would repeat one (baseline, operator) pair.
  const used = new Set(
    comparisonRows.value.map((row) => {
      const options = operatorOptionsByBaseline.value.get(row.baselineId) ?? [];
      return `${row.baselineId}|${resolveRowOperator(row.operatorId, options) ?? ''}`;
    }),
  );
  for (const baseline of checkedBaselines.value) {
    const options = operatorOptionsByBaseline.value.get(baseline.id) ?? [];
    const candidates = options.length > 0 ? options : [{ id: '', label: '' }];
    const free = candidates.find((option) => !used.has(`${baseline.id}|${option.id}`));
    if (!free) continue;
    emitRows([
      ...comparisonRows.value,
      { id: nextRowId(), baselineId: baseline.id, operatorId: free.id },
    ]);
    return;
  }
}
/** Remove a row; the FIRST row is the primary and cannot be removed. */
function removeBaselineRow(index: number): void {
  if (index <= 0 || index >= comparisonRows.value.length) return;
  emitRows(comparisonRows.value.filter((_, i) => i !== index));
}


function numericBlockDim(blockDim: string | number | undefined): number | undefined {
  if (blockDim == null || blockDim === '') return undefined;
  const n = typeof blockDim === 'number' ? blockDim : Number(blockDim);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * UI-32 secondary: `{blockDim} Blocks / {coreCount} 核` (DATA-1) on the value row
 * only when `durationBreakdown` is absent. Fallback order: blocks/core → `blockDim` → `opName`.
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

const durationBreakdown = computed(() => summary.value?.durationBreakdown);

/** Non-finite and negative µs count as 0 so the bar and the hover list agree. */
function nonNegativeUs(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
}

const durationSegments = computed(() => {
  const b = durationBreakdown.value;
  if (!b) return null;
  const overhead = nonNegativeUs(b.overheadUs);
  const compute = nonNegativeUs(b.computeUs);
  const communication = nonNegativeUs(b.communicationUs);
  const total = overhead + compute + communication;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return [
    { id: 'overhead' as const, pct: pct(overhead) },
    { id: 'compute' as const, pct: pct(compute) },
    { id: 'communication' as const, pct: pct(communication) },
  ];
});

function formatBreakdownTime(us: number | undefined): string {
  const parts = formatDurationParts(nonNegativeUs(us));
  return `${parts.value} ${parts.unit}`;
}

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
const emulatePipeSidesPresent = computed(() =>
  pipeSideOptions.value.filter((s) => EMULATE_PIPE_SIDES.includes(s)),
);

const hasEmulatePipeCores = computed(() => emulatePipeSidesPresent.value.length >= 1);

const hasEmulateAiv0 = computed(() => pipeSideOptions.value.includes('aiv0'));
const hasEmulateAiv1 = computed(() => pipeSideOptions.value.includes('aiv1'));
const hasEmulateAic = computed(() => pipeSideOptions.value.includes('aic'));

/**
 * Both vector cores present → Cube|Vector 0|Vector 1 (UI-54 / #196).
 * AIC may be absent; only present sides are offered.
 */
const showEmulateThreeWayToggle = computed(
  () => hasEmulateAiv0.value && hasEmulateAiv1.value,
);

/**
 * AIC + exactly one AIV → compute-style Cube|Vector labels (#196).
 * The single AIV side keeps its `aiv0`/`aiv1` id for filtering; the button reads "Vector".
 */
const showEmulateCubeVectorToggle = computed(() => {
  const aivCount = Number(hasEmulateAiv0.value) + Number(hasEmulateAiv1.value);
  return hasEmulateAic.value && aivCount === 1;
});

/** Single emulate core → plain label Cube / Vector 0 / Vector 1 (#196; not a control). */
const pipeSideLabel = computed((): PipeSide | null => {
  if (!hasEmulatePipeCores.value) return null;
  if (showEmulateThreeWayToggle.value || showEmulateCubeVectorToggle.value) return null;
  return emulatePipeSidesPresent.value.length === 1 ? emulatePipeSidesPresent.value[0]! : null;
});

const showPipeSideToggle = computed(
  () => isMix.value || showEmulateThreeWayToggle.value || showEmulateCubeVectorToggle.value,
);

function pipeSideButtonLabel(side: PipeSide): string {
  if (showEmulateCubeVectorToggle.value && (side === 'aiv0' || side === 'aiv1')) {
    return 'Vector';
  }
  return PIPE_SIDE_LABEL[side];
}

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

/** The selected baseline's PIPE row paired with a current row (same id + side). */
/** Baseline PIPE rows under the picked block: the same scoping rules as the
 * current side — a block with no PipeUtilization.csv rows blanks rather than
 * repeat the All aggregate (DATA-19 / PR-STATS-014b). */
function scopedBaselinePipeOccupancyOf(model: ReportViewModel | null): PipeOccupancyItem[] {
  const all = model?.pipeOccupancy ?? [];
  if (!model || !blockId.value) return all;
  const rows = rowsForBlockOf(model, 'PipeUtilization.csv', blockId.value);
  return rows.length === 0 ? [] : pipeOccupancyFromRows(rows);
}
const scopedBaselinePipeOccupancy = computed(() => scopedBaselinePipeOccupancyOf(baselineModel.value));

function baselinePipeFor(row: PipeOccupancyItem) {
  if (!baselineModel.value) return null;
  return (
    scopedBaselinePipeOccupancy.value.find(
      (b) => b.id === row.id && (b.side ?? row.side) === row.side,
    ) ?? null
  );
}

/** One bar per metric in comparison mode: the bar's own utilization delta against the
 * paired baseline row, in percentage points (PR-STATS-055). The ratio exists on every
 * row, so emulate/ICache rows compare too — the in-bar time is not the compared metric. */
function pipeDiffFor(row: PipeOccupancyItem): DiffView | null {
  const base = baselinePipeFor(row);
  return diffView(
    metricDiff(
      utilizationPercent(row.ratio, 1) ?? undefined,
      utilizationPercent(base?.ratio, 1) ?? undefined,
    ),
    'pct',
  );
}

/** Baseline PIPE popup: the current percent, then every row's own percent and
 * percentage-point delta for the SAME metric (a single baseline included). */
function pipeTipFor(row: PipeOccupancyItem): BaselineTipRow[] | null {
  if (resolvedRows.value.length === 0) return null;
  /** The guide's popup prints the row's in-bar value; percent rows fall back to their %. */
  const pipeValue = (p: PipeOccupancyItem) =>
    p.absoluteValue != null ? formatPipeAbsolute(p.absoluteValue) : formatAsidePct(p.ratio * 100);
  const entries: BaselineTipRow[] = [
    { label: t('compareCurrent', props.locale), value: pipeValue(row) },
  ];
  for (const entry of resolvedRows.value) {
    const base = scopedBaselinePipeOccupancyOf(entry.model).find(
      (b) => b.id === row.id && (b.side ?? row.side) === row.side,
    );
    if (!base) continue;
    const view = diffView(
      metricDiff(
        utilizationPercent(row.ratio, 1) ?? undefined,
        utilizationPercent(base.ratio, 1) ?? undefined,
      ),
      'pct',
    );
    entries.push({
      label: entry.label,
      value: pipeValue(base),
      tone: view?.tone,
      direction: view?.label,
      delta: view?.text,
    });
  }
  return entries.length > 1 ? entries : null;
}
/** Comparison active for the PIPE rows: the baseline pack is present. */
const hasBaselinePipes = computed(() => baselineModel.value != null);

/**
 * The baseline pack's memory categories for the 详情 delta badges (PR-STATS-056), filtered by the
 * same four ids as `memoryCategories` — compute categories never pair into the memory list.
 * `undefined` without a pack keeps the list's no-baseline DOM identical.
 */
const baselineMemoryCategories = computed<SummaryCategory[] | undefined>(() => {
  const model = baselineModel.value;
  return model ? (model.summaryCategories ?? []).filter(isMemoryCategory) : undefined;
});

/** Every comparison row's categories for the 详情 hover popup (a single row included). */
const detailComparisonCategories = computed(() =>
  resolvedRows.value.flatMap((entry) =>
    entry.model ? [{ label: entry.label, categories: entry.model.summaryCategories ?? [] }] : [],
  ),
);
const memoryComparisonCategories = computed(() =>
  resolvedRows.value.flatMap((entry) =>
    entry.model
      ? [
          {
            label: entry.label,
            categories: (entry.model.summaryCategories ?? []).filter(isMemoryCategory),
          },
        ]
      : [],
  ),
);

/** The side the PIPE list is filtered by right now (null = show both). */
const activePipeSide = computed<PipeSide | null>(() => {
  // Emulate sides (`aic`/`aiv0`/`aiv1`) must not fall through to compute knownSide
  // (`aic`→cube / `aiv*`→vector) — that blanks a single-core pack (UI-54).
  if (isMix.value || hasEmulatePipeCores.value) return pipeSide.value;
  return knownSide.value;
});

const visiblePipes = computed(() => {
  const all = scopedPipeOccupancy.value;
  const side = activePipeSide.value;
  if (side == null) return all;
  return all.filter((p) => matchesSide(p, side));
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
  return formatAsideValue(v);
}

/** UI-34 / DATA-33h: GB/s and TFLOPS subtitles ride the panel's ONE format (PR-STATS-060). */
function formatMagnitude(n: number): string {
  return formatAsideValue(n);
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

/** 防连点（R9）：点击后 1 秒冷却期内忽略重复点击，只放行第一次。 */
const DETAILS_COOLDOWN_MS = 1000;
const openPipeDetails = cooldown(() => {
  if (showCompute.value) asideSurface.value = 'compute';
  emit('open-pipe-details');
}, DETAILS_COOLDOWN_MS);

const openMemoryDetails = cooldown(() => {
  if (showMemory.value) asideSurface.value = 'memory';
}, DETAILS_COOLDOWN_MS);

function openTopologyFullscreen() {
  const m = topologyModel.value;
  // The resolved baseline topology rides along: the root's fullscreen overlay
  // has no access to the aside's Operator pick or block scope, so the aside —
  // the only place that resolution lives — hands over the same comparison the
  // stacked diagram paints (PR-STATS-056 / PR-ROOT-051).
  if (m) emit('open-topology-fullscreen', m, undefined, topologyBaseline.value ?? null, topologyBaselineRows.value);
}

/**
 * §11.2.3.2: clicking a heat unit on the stacked diagram opens the 全屏 overlay on that unit —
 * the unit is that view's selection, so the aside keeps no selection state of its own.
 */
function openMemoryUnit(unit: MemoryHeatmapUnitId) {
  const m = topologyModel.value;
  if (m) emit('open-topology-fullscreen', m, unit, topologyBaseline.value ?? null, topologyBaselineRows.value);
}

/**
 * §11.2.3.2 unit hover/click only when the report carries a heat surface (PR-MEMTOP-021). The
 * capability is the gate the specs name, so a host that passes `capabilities` without
 * `memoryHeatmap` gets no clickable units — otherwise a click would open a 全屏 overlay with no
 * heat column, the same rule ProfilingReport applies to the overlay itself. Standalone mounts
 * (no `capabilities` prop) fall back to the carrier.
 */
const hasMemoryHeatmap = computed(
  () =>
    (props.capabilities?.includes('memoryHeatmap') ?? true) &&
    (props.report?.memoryHeatmap?.units.length ?? 0) > 0,
);

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

/**
 * The 全屏 topology overlay reads these LIVE models on a Metric-mode switch
 * (PR-ROOT-051): the aside is the only place that resolves row 0's Operator
 * pick and the block scope, so re-deriving the baseline in the root would
 * compare the pack's default operator against the picked one.
 */
defineExpose({ topologyModel, topologyBaseline, topologyBaselineRows });
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
        <button
          type="button"
          class="pr-aside__optimize"
          data-testid="perform-optimization-trigger"
          :aria-label="t('performOptimization', locale)"
          :title="t('performOptimization', locale)"
          @click="emit('perform-optimization')"
        >
          <CannworkOptimizeIcon />
          <span>{{ t('performOptimization', locale) }}</span>
        </button>
        <CloseButton
          class="pr-aside__close"
          data-testid="stats-aside-close"
          :label="t('closePanel', locale)"
          @click="emit('close')"
        />
      </div>

      <!-- Comparison rows (对比基线, 1130 guide): directly under the title row,
           above the meta line, only while baselines are checked (UI-63
           resolved). One row per host `baselineRows` entry: 基线N + the report
           select + the operator select; the FIRST row ends with `+` (add a
           row) and every row after it with `−` (the first row cannot be
           removed). The capture pointerdown closes the baselines popover via
           the root. -->
      <div
        v-if="checkedBaselines.length > 0"
        ref="baselineBarEl"
        class="pr-aside__baseline-bar"
        :style="baselineSlotStyle"
        data-testid="stats-baseline-bar"
        @pointerdown.capture="emit('baseline-bar-down')"
      >
        <div
          v-for="entry in resolvedRows"
          :key="entry.row.id"
          class="pr-aside__baseline-row"
          :data-testid="`stats-baseline-row-${entry.index + 1}`"
        >
          <span class="pr-aside__baseline-label">{{ rowLabelText(entry.index) }}</span>
          <!-- 1130 guide: one 28px rounded field per row holds BOTH sub-selects. -->
          <span class="pr-aside__baseline-field">
            <span class="pr-aside__baseline-sub pr-aside__baseline-sub--report">
              <span class="pr-aside__baseline-k">{{ fieldCaption('stats') }}</span>
              <CardMetricSelect
                :model-value="entry.row.baselineId"
                :options="baselineIds"
                variant="inline"
                :test-id-prefix="`aside-baseline${entry.index === 0 ? '' : `-${entry.index + 1}`}`"
                :ariaLabel="t('baselineLabel', locale)"
                :label-of="baselineNameOf"
                @update:model-value="setRowBaseline(entry.row.id, $event)"
              />
            </span>
            <!-- The 28px design gap: a real spacer, so it can give way (down to
                 8px) when the row is squeezed and the operator column must ride
                 left after the report dropdown. -->
            <span
              class="pr-aside__baseline-gap"
              aria-hidden="true"
            />
            <span class="pr-aside__baseline-sub pr-aside__baseline-sub--operator">
              <span class="pr-aside__baseline-k">{{ fieldCaption('operatorLabel') }}</span>
              <CardMetricSelect
                :model-value="entry.operatorId ?? ''"
                :options="entry.options.map((o) => o.id)"
                variant="inline"
                :test-id-prefix="`aside-baseline-operator${entry.index === 0 ? '' : `-${entry.index + 1}`}`"
                :ariaLabel="t('operatorLabel', locale)"
                :label-of="(id: string) => rowOperatorName(entry, id)"
                @update:model-value="setRowOperator(entry.row.id, $event)"
              />
            </span>
          </span>
          <!-- 1130 guide: the FIRST row ends with `+` (add), every row after it
               with `−` (remove; the first row cannot be removed). Both are
               28×28 `#222121` buttons with a `#B3B3B3` glyph. -->
          <button
            v-if="entry.index === 0"
            type="button"
            class="pr-aside__baseline-step pr-aside__baseline-step--add"
            data-testid="baseline-row-add"
            :disabled="!canAddBaselineRow"
            :aria-label="t('addBaseline', locale)"
            :title="t('addBaseline', locale)"
            @click="addBaselineRow"
          />
          <button
            v-else
            type="button"
            class="pr-aside__baseline-step pr-aside__baseline-step--remove"
            :data-testid="`baseline-row-remove-${entry.index + 1}`"
            :aria-label="t('removeBaseline', locale)"
            :title="t('removeBaseline', locale)"
            @click="removeBaselineRow(entry.index)"
          />
        </div>
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
        <CannbotActions
          scope="summary"
          :sessions="cannbotSessions"
          :locale="locale"
          @open-cannbot="(s) => emit('open-cannbot', s)"
          @open-cannbot-stop="(s) => emit('open-cannbot-stop', s)"
          @cannbot-reference="(s) => emit('cannbot-reference', s)"
          @cannbot-view="(s) => emit('cannbot-view', s)"
        />
      </p>
    </header>

    <div
      class="pr-aside__main"
      :inert="asideSurface !== 'report'"
    >
      <div
        class="pr-aside__body"
        @scroll="
          closeTip();
          closeDurationBreakdownTip();
        "
      >
        <div
          v-if="hasSummary"
          class="pr-cards"
          :class="{ 'pr-cards--compare': compareCards }"
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
            <div class="pr-card__value-row">
              <div
                class="pr-card__value"
                data-testid="stats-duration-value"
                v-bind="tipBind(durationValueTip, { focusable: true })"
              >
                <span class="pr-card__num">{{ durationParts.value }}</span>
                <span class="pr-card__unit">{{ durationParts.unit }}</span>
                <SummaryDiffIndicator
                  v-if="durationDiff"
                  :tone="durationDiff.tone"
                  :text="durationDiff.text"
                  :direction-label="durationDiff.label"
                  :tip="durationTip"
                  data-testid="stats-duration-diff"
                />
              </div>
              <div
                v-if="durationSecondary && !durationBreakdown"
                class="pr-card__value-meta"
                data-testid="stats-duration-secondary"
                v-bind="tipBind(durationSecondary.tip, { focusable: true })"
              >
                {{ durationSecondary.text }}
              </div>
            </div>
            <div
              v-if="durationSegments"
              class="pr-card__bar-track pr-card__bar-track--duration"
              data-testid="stats-duration-bar"
              @pointerenter="openDurationBreakdownTip"
              @pointerleave="closeDurationBreakdownTip"
              @pointercancel="closeDurationBreakdownTip"
            >
              <span
                v-for="seg in durationSegments"
                :key="seg.id"
                class="pr-card__bar-seg"
                :class="`pr-card__bar-seg--${seg.id}`"
                :style="{ width: `${seg.pct}%` }"
                :data-testid="`stats-duration-seg-${seg.id}`"
              />
            </div>
            <div
              v-if="durationSegments"
              class="pr-duration-legend"
              data-testid="stats-duration-legend"
            >
              <span>{{ t('durationOverhead', locale) }}</span>
              <span>{{ t('durationCompute', locale) }}</span>
              <span>{{ t('durationCommunication', locale) }}</span>
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
                    <span class="pr-card__num">{{ formatAsideValue(row.score) }}</span>
                    <span class="pr-card__unit">%</span>
                    <SummaryDiffIndicator
                      v-if="row.id === 'util' ? parallelDiff : balanceDiff"
                      :tone="(row.id === 'util' ? parallelDiff : balanceDiff)!.tone"
                      :text="(row.id === 'util' ? parallelDiff : balanceDiff)!.text"
                      :direction-label="(row.id === 'util' ? parallelDiff : balanceDiff)!.label"
                      :tip="row.id === 'util' ? parallelTip : balanceTip"
                      :data-testid="`stats-aicore-${row.id}-diff`"
                    />                </span>
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
                    <span class="pr-card__num">{{ formatAsideValue(row.score) }}</span>
                    <SummaryDiffIndicator
                      v-if="row.side === 'aic' ? computeAicDiff : computeAivDiff"
                      :tone="(row.side === 'aic' ? computeAicDiff : computeAivDiff)!.tone"
                      :text="(row.side === 'aic' ? computeAicDiff : computeAivDiff)!.text"
                      :direction-label="(row.side === 'aic' ? computeAicDiff : computeAivDiff)!.label"
                      :tip="row.side === 'aic' ? computeAicTip : computeAivTip"
                      :data-testid="`stats-compute-${row.side}-diff`"
                    />                </span>
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
                    <span class="pr-card__num">{{ formatAsideValue(row.score) }}</span>
                    <span class="pr-card__unit">%</span>
                    <SummaryDiffIndicator
                      v-if="row.dir === 'read' ? bwReadDiff : bwWriteDiff"
                      :tone="(row.dir === 'read' ? bwReadDiff : bwWriteDiff)!.tone"
                      :text="(row.dir === 'read' ? bwReadDiff : bwWriteDiff)!.text"
                      :direction-label="(row.dir === 'read' ? bwReadDiff : bwWriteDiff)!.label"
                      :tip="row.dir === 'read' ? bwReadTip : bwWriteTip"
                      :data-testid="`stats-bandwidth-${row.dir}-diff`"
                    />                </span>
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
          <div class="pr-stack-section__head">
            <h4>{{ t('roofline', locale) }}</h4>
            <div class="pr-pipe-head__actions">
              <CannbotActions
                scope="roofline"
                :sessions="cannbotSessions"
                :locale="locale"
                @open-cannbot="(s) => emit('open-cannbot', s)"
                @open-cannbot-stop="(s) => emit('open-cannbot-stop', s)"
                @cannbot-reference="(s) => emit('cannbot-reference', s)"
                @cannbot-view="(s) => emit('cannbot-view', s)"
              />
            </div>
          </div>
          <RooflinePanel
            ref="rooflinePanel"
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
            <button
              type="button"
              class="pr-stack-section__title-btn"
              data-testid="pipe-details"
              @click="openPipeDetails"
            >
              <span class="pr-stack-section__title">{{ t('computeAnalysis', locale) }}</span>
              <DetailChevron class="pr-stack-section__title-chevron" />
            </button>
            <div class="pr-pipe-head__actions">
              <CannbotActions
                v-if="showCompute"
                scope="compute"
                :sessions="cannbotSessions"
                :locale="locale"
                @open-cannbot="(s) => emit('open-cannbot', s)"
                @open-cannbot-stop="(s) => emit('open-cannbot-stop', s)"
                @cannbot-reference="(s) => emit('cannbot-reference', s)"
                @cannbot-view="(s) => emit('cannbot-view', s)"
              />
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
                {{ pipeSideButtonLabel(side) }}
              </button>
            </div>
            <span
              v-else-if="pipeSideLabel"
              class="pr-pipe-side-label"
              data-testid="pipe-side-label"
              :data-side="pipeSideLabel"
            >
              <span :data-testid="`pipe-side-${pipeSideLabel}`">{{ PIPE_SIDE_LABEL[pipeSideLabel] }}</span>
            </span>
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
                  <span class="pr-pipe-row__labels">
                    <span class="pr-pipe-row__label">{{ pipe.label }}</span>
                  </span>
                  <span class="pr-pipe-row__stack">
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
                      <!-- Comparison mode keeps ONE bar: after the in-bar value comes the
                       baseline delta — arrow badge, gap, magnitude (1130 方案一). Rows
                       without an in-bar time carry the delta at the same left position. -->
                      <span
                        v-if="pipe.absoluteValue != null || pipeDiffFor(pipe)"
                        class="pr-pipe-row__value"
                      >
                        <span
                          v-if="pipe.absoluteValue != null"
                          class="pr-pipe-row__abs"
                          data-testid="pipe-absolute"
                        >{{ formatPipeAbsolute(pipe.absoluteValue) }}</span>
                        <SummaryDiffIndicator
                          v-if="pipeDiffFor(pipe)"
                          :tone="pipeDiffFor(pipe)!.tone"
                          :text="pipeDiffFor(pipe)!.text"
                          :direction-label="pipeDiffFor(pipe)!.label"
                          :tip="pipeTipFor(pipe)"
                          :data-testid="`pipe-diff-${pipe.id}-${pipe.side ?? 'x'}`"
                        />
                      </span>
                      <span class="pr-pipe-row__pct">{{ formatAsidePct(pipe.ratio * 100) }}</span>
                    </span>
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
            <button
              v-if="showMemory"
              type="button"
              class="pr-stack-section__title-btn"
              data-testid="topology-details"
              @click="openMemoryDetails"
            >
              <span class="pr-stack-section__title">{{ t('memoryAnalysis', locale) }}</span>
              <DetailChevron class="pr-stack-section__title-chevron" />
            </button>
            <h4 v-else>
              {{ t('memoryAnalysis', locale) }}
            </h4>
            <div class="pr-pipe-head__actions">
              <CannbotActions
                v-if="showMemory"
                scope="memory"
                :sessions="cannbotSessions"
                :locale="locale"
                @open-cannbot="(s) => emit('open-cannbot', s)"
                @open-cannbot-stop="(s) => emit('open-cannbot-stop', s)"
                @cannbot-reference="(s) => emit('cannbot-reference', s)"
                @cannbot-view="(s) => emit('cannbot-view', s)"
              />
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
              :baseline="topologyBaseline"
              :baseline-rows="topologyBaselineRows"
              :locale="locale"
              :selectable-units="hasMemoryHeatmap"
              show-fullscreen
              @open-details="openMemoryDetails"
              @open-fullscreen="openTopologyFullscreen"
              @open-memory-unit="openMemoryUnit"
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
              <CannbotActions
                scope="compute"
                :sessions="cannbotSessions"
                :locale="locale"
                @open-cannbot="(s) => emit('open-cannbot', s)"
                @open-cannbot-stop="(s) => emit('open-cannbot-stop', s)"
                @cannbot-reference="(s) => emit('cannbot-reference', s)"
                @cannbot-view="(s) => emit('cannbot-view', s)"
              />
            </div>
            <SummaryCategoryList
              v-if="computeCategories.length > 0 && !computeCsvScope"
              :categories="computeCategories"
              :active-id="activeCategory"
              :locale="locale"
              :baseline-categories="hasBaselinePipes ? (baselineModel?.summaryCategories ?? undefined) : undefined"
              :comparison-categories="detailComparisonCategories"
              :comparison-current-label="t('compareCurrent', locale)"
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
              <CannbotActions
                scope="memory"
                :sessions="cannbotSessions"
                :locale="locale"
                @open-cannbot="(s) => emit('open-cannbot', s)"
                @open-cannbot-stop="(s) => emit('open-cannbot-stop', s)"
                @cannbot-reference="(s) => emit('cannbot-reference', s)"
                @cannbot-view="(s) => emit('cannbot-view', s)"
              />
            </div>
            <SummaryCategoryList
              v-if="memoryCategories.length > 0 && !memoryCsvScope"
              :categories="memoryCategories"
              :active-id="activeCategory"
              :locale="locale"
              :baseline-categories="baselineMemoryCategories"
              :comparison-categories="memoryComparisonCategories"
              :comparison-current-label="t('compareCurrent', locale)"
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
              :baseline-categories="hasBaselinePipes ? (baselineModel?.summaryCategories ?? undefined) : undefined"
              :comparison-categories="detailComparisonCategories"
              :comparison-current-label="t('compareCurrent', locale)"
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
              :baseline-categories="baselineMemoryCategories"
              :comparison-categories="memoryComparisonCategories"
              :comparison-current-label="t('compareCurrent', locale)"
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
      <div
        v-if="durationBreakdownTip && durationBreakdown"
        class="pr-duration-tooltip"
        role="tooltip"
        data-testid="stats-duration-tooltip"
        :style="{
          top: `${durationBreakdownTip.top}px`,
          left: `${durationBreakdownTip.left}px`,
          width: `${durationBreakdownTip.width}px`,
        }"
      >
        <div class="pr-duration-tooltip__row">
          <span>{{ t('durationComputeTime', locale) }}</span>
          <span>{{ formatBreakdownTime(durationBreakdown.computeUs) }}</span>
        </div>
        <div class="pr-duration-tooltip__row">
          <span>{{ t('durationCommTime', locale) }}</span>
          <span>{{ formatBreakdownTime(durationBreakdown.communicationUs) }}</span>
        </div>
        <div class="pr-duration-tooltip__row">
          <span>{{ t('durationOverlapTime', locale) }}</span>
          <span>{{ formatBreakdownTime(durationBreakdown.overlapUs) }}</span>
        </div>
        <div class="pr-duration-tooltip__row">
          <span>{{ t('durationOverheadTime', locale) }}</span>
          <span>{{ formatBreakdownTime(durationBreakdown.overheadUs) }}</span>
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

/* Baseline / Operator dropdown row (对比基线): the Block switcher's chrome,
   header placement under the meta line; hidden without a selected baseline. */
.pr-aside__baseline-bar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  /* 1130 export: rows at y229..257 / 265..293 → an 8px pitch gap. */
  gap: 8px;
  margin: 8px 0 6px;
  /* Six visible rows (6 × 28px field + 5 × 8px gap); the seventh and beyond
   * scroll inside the bar instead of growing the aside. `.pr-root` already
   * paints the dark 8px scrollbar. */
  max-height: 208px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* One comparison row: 基线N： [ 报告 [select]  算子 [select] ] +/− */
.pr-aside__baseline-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.pr-aside__baseline-label {
  font-size: 12px;
  line-height: 16px;
  color: #999999;
  white-space: nowrap;
  /* Every row caption takes the WIDEST caption's measured width: a proportional
   * fallback font renders 基线1 and 基线2 at different widths, which moved the
   * field (and the gap's shrink) per row and broke the operator column line.
   * The aside measures the labels and sets the var (PR-STATS-061b). */
  flex: 0 0 var(--pr-baseline-row-label-w, auto);
}

/* 1130 export: the row's single dropdown field — 28px, radius 4,
 * #2A2A2A at 41% over the aside ground. */
.pr-aside__baseline-field {
  display: flex;
  align-items: center;
  /* 1130 export: groups at x12 and x234 of the 365px field → a 28px gap,
   * carried by `.pr-aside__baseline-gap` so it can shrink under pressure. */
  gap: 0;
  flex: 1 1 auto;
  min-width: 0;
  height: 28px;
  /* Air between the row caption's colon and the field, and the field to the action. */
  margin: 0 12px 0 8px;
  padding: 0 12px;
  box-sizing: border-box;
  border-radius: 4px;
  background: rgba(42, 42, 42, 0.41);
  /* A squeezed row never paints its selects outside the field's own chrome. */
  overflow: hidden;
}

.pr-aside__baseline-sub {
  display: flex;
  align-items: center;
  /* Air between `报告：` / `算子：` and the dropdown text. */
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
  /* A squeezed sub clips its own content: the report dropdown can never paint
   * over the gap and the operator column beside it. */
  overflow: hidden;
}

/* 1130 export: the 28px run between the report and operator groups. It is the
 * first thing to give way (floor 8px), so a narrowing row carries the operator
 * column left with the report instead of pinning it to the field's edge. */
.pr-aside__baseline-gap {
  flex: 0 20 28px;
  min-width: 8px;
  align-self: stretch;
}

/* 1130 export: the report group's slot is 194px (36 label + 134 value + 4 + 20
 * chevron) and the operator group 120px. Both slots are content-independent, so
 * the operator caption sits on the same column line in every row whatever the
 * report / operator text lengths are. The report slot absorbs the field's
 * leftover width (194px at the design width) and shrinks before the operator
 * slot does. */
.pr-aside__baseline-sub--report {
  /* ONE slot width for every row, measured from the WIDEST report title
   * (`--pr-baseline-report-w`, set by the aside): the 算子 column therefore
   * stands one under another even when the rows carry different report names,
   * while the select fills the slot so the operator stays pressed to it. The
   * basis is content-derived, never an arbitrary stretch — it grows back to
   * the full widest title first (shrink 10) and the report text restores before
   * the operator gets anything. */
  flex: 0 10 var(--pr-baseline-report-w, 194px);
}

.pr-aside__baseline-sub--operator {
  /* Content-sized and never shrinking: the operator value keeps its full
   * length while the report is trimming (the field clips it only at the very
   * minimum). Once the report is whole, the operator value is fully visible;
   * widening first completes the report text, then reveals the operator. */
  flex: 0 0 auto;
}

.pr-aside__baseline-k {
  font-size: 12px;
  line-height: 16px;
  color: #999999;
  white-space: nowrap;
}

/* Sub-select chrome inside the field: the export's trigger has no padding and
 * a 20×20 #B3B3B3 chevron right after the value. */
.pr-aside__baseline-field :deep(.pr-metric-select) {
  flex: 0 1 auto;
  max-width: 100%;
  /* Never narrower than the 1px border + gap + chevron: the arrow stays inside. */
  min-width: 26px;
}

/* The report select fills the shared slot: its box ends at the common column
 * edge, so the operator sits 28px after it on every row. The slot itself is
 * sized to the widest full title, so no row's value is trimmed while the
 * aside has room. Later than the shared rule on purpose (same specificity). */
.pr-aside__baseline-sub--report :deep(.pr-metric-select) {
  flex-grow: 1;
  max-width: none;
}

.pr-aside__baseline-field :deep(.pr-metric-select__trigger) {
  height: 20px;
  padding: 0;
}

/* The field is the trigger's chrome: hovering (or opening) a sub-select paints no
 * extra selection box — the design shows only the row's own field. */
.pr-aside__baseline-field :deep(.pr-metric-select__trigger:hover),
.pr-aside__baseline-field :deep(.pr-metric-select--open .pr-metric-select__trigger) {
  border-color: transparent;
}

.pr-aside__baseline-field :deep(.pr-metric-select__label) {
  color: #e6e6e6;
}

.pr-aside__baseline-field :deep(.pr-metric-select__chev) {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  background-color: #b3b3b3;
  -webkit-mask: url('../icons/chevron-down.png') center / 12px 12px no-repeat;
  mask: url('../icons/chevron-down.png') center / 12px 12px no-repeat;
}

.pr-aside__baseline-field :deep(.pr-metric-select__chev::before) {
  display: none;
}

/* 1130 export row action: 28×28, #222121, radius 4, #B3B3B3 plus/minus glyph
 * (the first row's `+`, the later rows' `−`). */
.pr-aside__baseline-step {
  position: relative;
  appearance: none;
  border: 0;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  padding: 0;
  border-radius: 4px;
  background: #222121;
  color: #b3b3b3;
  cursor: pointer;
}

.pr-aside__baseline-step::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 13.5px;
  height: 1.5px;
  transform: translate(-50%, -50%);
  border-radius: 1px;
  background: currentColor;
}

.pr-aside__baseline-step--add::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1.5px;
  height: 13.5px;
  transform: translate(-50%, -50%);
  border-radius: 1px;
  background: currentColor;
}

.pr-aside__baseline-step:not(:disabled):hover {
  color: #ffffff;
}

/* Every checked baseline already has a row — the + has nothing left to add. */
.pr-aside__baseline-step:disabled {
  color: #666666;
  cursor: default;
  opacity: 0.45;
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
.pr-aside__hints {
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

.pr-aside__hints {
  color: #e6e6e6;
  font-size: 12px;
  flex-shrink: 0;
  white-space: nowrap;
}

.pr-aside__more:hover {
  color: #d0d0d0;
  text-decoration: underline;
}

.pr-aside__hints:hover {
  color: #ffffff;
  text-decoration: underline;
}

/* 执行优化 capsule: icon + label pill sitting in the title row, left of the close button. */
.pr-aside__optimize {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 0 10px;
  height: 28px;
  margin-left: 8px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #e6e6e6;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}

.pr-aside__optimize:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
}

.pr-pipe-head__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pr-aside__meta .pr-cannbot-actions {
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

/*
 * 对比基线 (comparison, PR-STATS-059): a comparison raises the minimum tile to
 * 300px. A two-column comparison tile has to fit TWO value + diff-chip rows
 * (AICore / compute / BW); below ~288px the right column's chip paints past
 * the tile's edge — the text-over-block overlap product saw just before the
 * grid collapsed. 300px leaves room for a 3-digit value in both locales, so
 * the WELL width decides the column count: the default ~456px well is one
 * column (2 × 300 + 8 = 608 > 456), a widened aside fits two, and a narrower
 * one stays single. The 430px container query above still owns the
 * non-compare fallback.
 */
.pr-cards--compare {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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

.pr-card__value-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

/*
 * A hover at this value's right edge has to land on the tile's right side, or the shared tip
 * stays inside the aside and never crosses the timeline seam (PR-STATS-041f). The row would
 * otherwise shrink the hit box to the digits.
 */
.pr-card__value-row > .pr-card__value {
  flex: 1 1 auto;
  /* Keep the digits intact when the secondary wraps (PR-STATS-036). */
  min-width: max-content;
}

.pr-card__value-meta {
  flex-shrink: 1;
  min-width: 0;
  font-size: 11px;
  color: #8a8a8a;
  text-align: right;
  overflow-wrap: anywhere;
}

.pr-card__bar-track--duration {
  display: flex;
  margin-top: 8px;
}

.pr-card__bar-seg {
  position: relative;
  z-index: 1;
  display: block;
  height: 100%;
  min-width: 0;
}

.pr-card__bar-seg--overhead {
  background: var(--pr-color-duration-overhead);
}

.pr-card__bar-seg--compute {
  background: var(--pr-color-duration-compute);
}

.pr-card__bar-seg--communication {
  background: var(--pr-color-duration-comm);
}

.pr-duration-legend {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: #8a8a8a;
}

/* Teleported to `body` (same reason as `.pr-stat-tip`): aside overflow would clip an in-card box. */
.pr-duration-tooltip {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised);
  border: 1px solid var(--pr-divider);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.5;
  color: #e6e6e6;
  pointer-events: none;
}

.pr-duration-tooltip__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.pr-duration-tooltip__row span:last-child {
  color: #c8c8c8;
  white-space: nowrap;
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
  /* One line while the column has room; in a narrow comparison column the
   * diff chip wraps under the number instead of painting past the card. The
   * value shrinks to the widest of its parts, never below the digits
   * (PR-STATS-059 / PR-STATS-062). */
  flex: 0 1 auto;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  max-width: 100%;
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

/* Section heading turned into the 详情 entry (R-CANN-3): transparent button, no border,
   heading typography preserved; the chevron is the only new affordance. */
.pr-stack-section__title-btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  min-width: 0;
}

.pr-stack-section__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.pr-stack-section__title-chevron {
  color: #8a8a8a;
  flex-shrink: 0;
}

.pr-stack-section__title-btn:hover .pr-stack-section__title {
  text-decoration: underline;
}

.pr-stack-section__title-btn:hover .pr-stack-section__title-chevron {
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

.pr-pipe-side-label {
  display: block;
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
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

.pr-pipe-row__labels {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.pr-pipe-row__stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
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

/* The in-bar value and its baseline delta share one left-anchored line. */
.pr-pipe-row__value {
  position: absolute;
  left: 6px;
  top: 50%;
  z-index: 3;
  display: flex;
  align-items: center;
  max-width: calc(100% - 12px);
  transform: translateY(-50%);
  white-space: nowrap;
  pointer-events: none;
}

.pr-pipe-row__abs {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
  white-space: nowrap;
  line-height: 1;
}

/* The line itself stays pointer-transparent (the bar under it keeps its own
 * pointer behaviour), but the delta chip must receive hover/focus so the
 * multi-baseline popup opens from the PIPE rows too. */
.pr-pipe-row__value :deep(.pr-diff) {
  pointer-events: auto;
}

/* On the coloured bar the delta badge is the mockup's WHITE circle with the tone
 * arrow — the cards' tone-tinted fill would sink into the bar's own colour — and
 * the magnitude reads white like the in-bar value beside it. */
.pr-pipe-row__value :deep(.pr-diff__badge) {
  background: #ffffff;
}

.pr-pipe-row__value :deep(.pr-diff__text) {
  color: #ffffff;
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
