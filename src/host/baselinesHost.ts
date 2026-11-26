import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { loadReportSource } from '../adapters/loadReportSource';
import { MEMORY_TOPOLOGY_NODE_DEFS } from '../adapters/memoryTopology';
import type {
  AdaptedReport,
  Baseline,
  BaselinePick,
  BaselineReports,
  BaselineRow,
  CsvTableModel,
  MemoryTopologyModel,
  MemoryTopologyPlate,
} from '../domain/types';

export interface BaselinesHost {
  baselines: Ref<Baseline[]>;
  /** Comparison rows (report + operator per row); row 0 is the aside's primary. */
  baselineRows: Ref<BaselineRow[]>;
  /** Adapted packs for every checked baseline referenced by a row, keyed by baseline id. */
  baselineReports: Ref<BaselineReports>;
  pickBaselineFile(): Promise<BaselinePick | null>;
  onBaselinesUpdate(next: Baseline[]): void;
  onBaselineRows(next: BaselineRow[]): void;
  onFileChosen(e: Event): void;
  onPickCancel(): void;
}

/**
 * Demo operator names for the aside's Operator dropdown — the web hosts have no
 * pack metadata behind them, so every baseline carries the same eight demo
 * operators the way MSTT would carry the pack's real ones.
 */
const DEMO_BASELINE_OPERATORS = [
  'matmul',
  'matmul_t',
  'add_n',
  'relu',
  'gelu',
  'layernorm',
  'softmax',
  'conv2d',
] as const;

/** Fill missing `operators` with the demo records; real operators pass through. */
export function withDemoBaselineOperators(baselines: Baseline[]): Baseline[] {
  return baselines.map((b) =>
    b.operators && b.operators.length > 0
      ? b
      : {
          ...b,
          operators: DEMO_BASELINE_OPERATORS.map((name) => ({ id: name, label: name })),
        });
}

/** Per-operator metric scales for the demo multi-operator packs — ops below the
 * base scale (0.4..0.85) read as increases (red up) against the open report,
 * ops above (1.15..1.6) as decreases (green down), so flipping the Operator
 * select paints both tones. MSTT's real packs pass through untouched. */
// The default (first) operator keeps scale 1.0 so the demo bars/badges are
// fat and visible on first selection; flipping operators alternates smaller
// and larger scales (both tones).
const DEMO_OPERATOR_SCALES = [1.0, 0.35, 1.2, 0.5, 1.4, 0.65, 1.6, 0.8];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 源码对比 (source diff) compares per-line metrics too. Cloning the base pack
 * would paint an all-equal diff, so each demo operator varies its correlation
 * numbers deterministically. File ids, paths, text and line counts stay put.
 */
function varyDemoSourceCorrelation(
  model: AdaptedReport['reportModel'],
  seed: number,
  opIndex: number,
): void {
  const correlation = model.sourceCorrelation;
  if (!correlation) return;
  for (const file of [correlation.assembly, ...correlation.files]) {
    for (const line of file.lines) {
      for (const [key, value] of Object.entries(line.values)) {
        if (typeof value !== 'number') continue;
        const h = hashKey(`${opIndex}:${seed}:${file.id}:${line.line}:${key}`);
        const kind = file.metricsColumns.find((c) => c.id === key)?.kind;
        if (kind === 'bar' || kind === 'percent') {
          // A ratio stays inside 0..1; a zero line takes a small visible bar.
          const pct = (h % 25) - 12 || 1;
          const scaled = value === 0 ? ((h % 9) + 1) / 100 : value * (1 + pct / 100);
          line.values[key] = Math.min(1, Math.max(0, scaled));
          continue;
        }
        // A count moves by at least one so rounding can never erase the diff.
        const pct = (h % 25) - 12 || 1;
        const scaled = value === 0 ? (h % 9) + 1 : value * (1 + pct / 100);
        if (Number.isInteger(value)) {
          const rounded = Math.round(scaled);
          line.values[key] = Math.max(
            0,
            rounded === value ? value + Math.sign(scaled - value) : rounded,
          );
        } else {
          line.values[key] = scaled;
        }
      }
    }
  }
}

/** Percentages clamp at 100, like the PIPE demo ratios clamp at 1. */
function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/**
 * Seed a full memory topology for the demo pack. Values are derived from the
 * mixed baseline seed, never from whatever the fixture carried: the bundled
 * fixtures that share a topology (out.rep / example / roofline_multi all read
 * 23.04% / 7.19% with a 0% L2 peak) would otherwise leave most demo baselines
 * visually identical — the exact failure the summary metrics were reseeded
 * for. The demo pack is synthetic (its PIPE rows are replaced the same way),
 * so the topology is reseeded too; `scaleMeasuredMetrics` then spreads it per
 * operator.
 *
 * The node ids are the adapter's real ones (`TOPOLOGY_PLATE_NODE_IDS` plus the
 * `l2` peak node), so the seeded model badges through the same code path as a
 * natively adapted one.
 */
function ensureDemoTopology(model: AdaptedReport['reportModel'], seed: number): void {
  const topology: MemoryTopologyModel = model.memoryTopology ?? {
    nodes: MEMORY_TOPOLOGY_NODE_DEFS.map((n) => ({ ...n })),
    edges: [],
  };
  model.memoryTopology = topology;
  // The demo baselines are consecutive ids ("demo-recent-1", "-2", …), and
  // hashKey returns consecutive integers for them; Knuth-multiply the seed so
  // every slice of bits below still varies between two neighbouring baselines
  // (plain shifts collapsed vec/cube/peak onto the same value).
  const mixed = Math.imul(seed, 0x9e3779b1) >>> 0;
  const plate = (node: MemoryTopologyPlate['node'], value: number): MemoryTopologyPlate => ({
    node,
    // Same `{n.toFixed(2)}%` contract the adapter's `formatLabel` emits.
    label: `${value.toFixed(2)}%`,
    value,
  });
  // DEMO-DIFF RULE (AGENTS.md): every badgeable element must show a non-zero
  // difference against the open report (sample.rep: aiv_scalar 33.24, vec
  // 6.72, cube 51.40, l2 peak 0.60) for EVERY demo baseline, with both tones
  // visible at once. The ranges sit strictly on one side of every fixture's
  // own values (and never contain them), so no baseline can land on a zero
  // delta; the seed still varies each value baseline-to-baseline.
  const aivScalar = 50 + (mixed % 9); // always ABOVE current -> red up
  topology.plates = [
    // Ranges also keep every operator scale (up to 1.6) below the 100 clamp,
    // so all eight operators stay pairwise distinct (the host spec asserts it).
    plate('aiv_scalar', aivScalar),
    plate('aiv_scalar_unit', aivScalar), // same producer field as the combined badge
    plate('vec', 0.4 + ((mixed >>> 8) % 4) * 0.4), // always BELOW current -> green down
    plate('cube', 8 + ((mixed >>> 10) % 10)), // always BELOW current -> green down
    plate('simt', 55 + ((mixed >>> 20) % 8)), // above the demo SIMT value -> red up
    plate('aic_scalar', 50 + ((mixed >>> 25) % 11)), // above the AIC scalar -> red up
  ];
  const peakPct = 55 + ((mixed >>> 15) % 8); // always ABOVE current -> red up
  const l2 = topology.nodes.find((n) => n.id === 'l2');
  if (l2) l2.peakPct = peakPct;
  else topology.nodes.push({ id: 'l2', label: 'L2 Cache', peakPct });
}

/** Every detail key the demo open report (`sample.lite.rep` op1) carries. The
 *  synthetic demo categories mirror them exactly: the details list pairs by
 *  field key, so a key the demo pack lacks can never paint a delta badge. */
const DEMO_DETAIL_KEYS: Record<string, string[]> = {
  PipeUtilization: [
    'aic_time(us)', 'aic_total_cycles', 'aic_cube_time(us)', 'aic_cube_ratio',
    'aic_mte1_time(us)', 'aic_mte1_ratio', 'aic_mte2_time(us)', 'aic_mte2_ratio',
    'aic_mte3_time(us)', 'aic_mte3_ratio', 'aic_mte3_active_bw(GB/s)',
    'aic_fixpipe_time(us)', 'aic_fixpipe_ratio', 'aic_fixpipe_active_bw(GB/s)',
    'aic_icache_miss_rate', 'aic_scalar_time(us)', 'aic_scalar_ratio',
    'aic_scalar_single_time(us)', 'aic_scalar_dual_time(us)',
    'aic_scalar_mte1_stall_time(us)', 'aic_scalar_mte2_stall_time(us)',
    'aic_scalar_mte3_stall_time(us)', 'aic_scalar_cube_stall_time(us)',
    'aic_scalar_wait_ib_time(us)', 'aic_scalar_wait_time(us)',
    'aiv_time(us)', 'aiv_total_cycles', 'aiv_vec_time(us)', 'aiv_vec_ratio',
    'aiv_mte2_time(us)', 'aiv_mte2_ratio', 'aiv_mte2_active_bw(GB/s)',
    'aiv_mte3_time(us)', 'aiv_mte3_ratio', 'aiv_mte3_active_bw(GB/s)',
    'aiv_icache_miss_rate', 'aiv_scalar_time(us)', 'aiv_scalar_ratio',
    'aiv_scalar_single_time(us)', 'aiv_scalar_dual_time(us)',
    'aiv_scalar_mte2_stall_time(us)', 'aiv_scalar_mte3_stall_time(us)',
    'aiv_scalar_stall_by_ub_time(us)', 'aiv_scalar_vector_stall_time(us)',
    'aiv_scalar_wait_ib_time(us)', 'aiv_scalar_wait_time(us)', 'aiv_simt_ratio',
  ],
  ArithmeticUtilization: [
    'aic_time(us)', 'aic_total_cycles', 'aic_cube_ratio', 'aic_cube_fp16_ratio',
    'aic_cube_int8_ratio', 'aic_cube_fops', 'aic_cube_total_instr_number',
    'aic_cube_fp_instr_number', 'aic_cube_int_instr_number',
    'aiv_time(us)', 'aiv_total_cycles', 'aiv_vec_ratio', 'aiv_vec_fp32_ratio',
    'aiv_vec_fp16_ratio', 'aiv_vec_int32_ratio', 'aiv_vec_int16_ratio',
    'aiv_vec_misc_ratio', 'aiv_vec_fops',
  ],
  ResourceConflictRatio: [
    'aic_time(us)', 'aic_total_cycles', 'aic_cube_wait_ratio',
    'aic_mte1_wait_ratio', 'aic_mte2_wait_ratio', 'aic_mte3_wait_ratio',
    'aiv_time(us)', 'aiv_total_cycles', 'aiv_vec_total_cflt_ratio',
    'aiv_vec_bankgroup_cflt_ratio', 'aiv_vec_bank_cflt_ratio',
    'aiv_vec_resc_cflt_ratio', 'aiv_vec_mte_cflt_ratio', 'aiv_vec_wait_ratio',
    'aiv_mte2_wait_ratio', 'aiv_mte3_wait_ratio',
  ],
  Memory: [
    'aic_main_mem_read_bw(GB/s)', 'aic_main_mem_write_bw(GB/s)',
    'aiv_time(us)', 'aiv_total_cycles', 'aiv_ub_to_gm_bw(GB/s)',
    'aiv_gm_to_ub_bw(GB/s)', 'aiv_main_mem_read_bw(GB/s)',
    'aiv_main_mem_write_bw(GB/s)', 'aiv_mte2_instructions', 'aiv_mte2_ratio',
    'aiv_mte3_instructions', 'aiv_mte3_ratio', 'read_main_memory_datas(KB)',
    'write_main_memory_datas(KB)', 'GM_to_UB_datas(KB)',
    'GM_to_UB_bw_usage_rate(%)', 'UB_to_GM_datas(KB)', 'UB_to_GM_bw_usage_rate(%)',
  ],
  MemoryL0: ['aiv_time(us)', 'aiv_total_cycles'],
  MemoryUB: [
    'aiv_time(us)', 'aiv_total_cycles', 'aiv_ub_read_bw_vector(GB/s)',
    'aiv_ub_write_bw_vector(GB/s)', 'aiv_ub_read_bw_scalar(GB/s)',
    'aiv_ub_write_bw_scalar(GB/s)',
  ],
  L2Cache: [
    'aiv_time(us)', 'aiv_total_cycles', 'aiv_write_cache_hit',
    'aiv_write_cache_miss_allocate', 'aiv_r0_read_cache_hit',
    'aiv_r0_read_cache_miss_allocate', 'aiv_r1_read_cache_hit',
    'aiv_r1_read_cache_miss_allocate', 'aiv_write_hit_rate(%)',
    'aiv_read_hit_rate(%)', 'aiv_total_hit_rate(%)',
  ],
};

/** Hand-tuned demo values for the keys the comparison surfaces showed first —
 *  plausible magnitudes with mixed tones; every other key is generated. */
const DEMO_DETAIL_VALUES: Record<string, Record<string, number>> = {
  PipeUtilization: {
    'aiv_time(us)': 40, 'aiv_total_cycles': 60000, 'aiv_vec_time(us)': 39,
    'aiv_vec_ratio': 0.9, 'aiv_scalar_time(us)': 1, 'aiv_scalar_ratio': 0.02,
    'aiv_mte2_time(us)': 0.05, 'aiv_mte2_ratio': 0.02,
    'aiv_mte2_active_bw(GB/s)': 30, 'aiv_mte3_time(us)': 0.05,
    'aiv_mte3_ratio': 0.02, 'aiv_icache_miss_rate': 0.05,
    // Tuned away from sample.rep's own values (≈0.010 / ≈0.217 / ≈0.215) at
    // every operator scale — a 2dp-equal pair paints no badge.
    'aic_icache_miss_rate': 0.4, 'aic_mte1_ratio': 0.7, 'aiv_simt_ratio': 0.7,
    'aic_scalar_ratio': 0.47, 'aic_cube_ratio': 0.05,
  },
  ArithmeticUtilization: {
    'aiv_time(us)': 40, 'aiv_total_cycles': 60000, 'aiv_vec_ratio': 0.9,
    'aiv_vec_vf_ratio': 0.1, 'aiv_vec_sfu_ratio': 0.05, 'aiv_vec_simt_vf_ratio': 0.9,
    'aic_cube_ratio': 0.05, 'aic_cube_int8_ratio': 0.6, 'aic_cube_fp16_ratio': 0.32,
  },
  ResourceConflictRatio: {
    'aiv_time(us)': 40, 'aiv_total_cycles': 60000, 'aiv_vec_stu_cflt_ratio': 0.02,
    'aiv_vec_ldu_cflt_ratio': 0.01, 'aiv_vec_sfu_cflt_ratio': 0.01,
    'aiv_vec_wait_ratio': 0.03, 'aiv_mte2_wait_ratio': 0.05,
    'aiv_mte3_wait_ratio': 0.05,
  },
  Memory: {
    // Not a round multiple of the operator scales: 700 × 0.8 = 560 exactly
    // matched sample.rep's own read bandwidth and suppressed the badge.
    'aic_main_mem_read_bw(GB/s)': 713,
    'aic_main_mem_write_bw(GB/s)': 611,
    'aiv_mte2_ratio': 0.15,
    'aiv_mte3_ratio': 0.35,
    'GM_to_UB_bw_usage_rate(%)': 60,
    'UB_to_GM_bw_usage_rate(%)': 1,
  },
  MemoryL0: { 'aiv_time(us)': 12, 'aiv_total_cycles': 8000 },
  MemoryUB: {
    'aiv_time(us)': 12, 'aiv_total_cycles': 8000, 'aiv_ub_read_bw_vector(GB/s)': 90,
  },
  L2Cache: {
    'aiv_total_hit_rate(%)': 85, 'aiv_read_hit_rate(%)': 90,
    'aiv_r0_read_cache_hit': 0.4,
  },
};

/** `0` and `NA` are not comparable values; everything else numeric is. */
function isNumericText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== '' && trimmed !== 'NA' && Number.isFinite(Number(trimmed));
}

/** A plausible demo value for a detail key without a hand-tuned value. The
 *  unit suffix picks the family; the seed keeps it baseline-specific. */
function demoDetailValue(key: string, i: number, mixed: number): number {
  const r = ((mixed >>> (i % 24)) + i * 7) % 17;
  // Ranges sit clear of the demo open report's own magnitudes: a value that
  // lands within the 2dp display step of the current one paints no badge.
  if (key.endsWith('_ratio')) return 0.62 + (r % 5) * 0.07;
  if (key.endsWith('_rate')) return 0.4 + (r % 4) * 0.05;
  if (key.endsWith('(%)')) return 60 + r;
  if (key.endsWith('total_cycles')) return 8000 + r * 100;
  if (key.endsWith('(us)')) return 8 + r;
  if (key.endsWith('(GB/s)')) return 60 + r * 10;
  if (key.endsWith('(KB)')) return 4 + r;
  if (key.endsWith('_number') || key.includes('instr') || key.endsWith('fops')) {
    return 1000 + r * 100;
  }
  return 0.2 + r * 0.03;
}

/** The synthetic demo categories for one baseline seed. */
function demoDetailCategories(mixed: number, vary: number): {
  id: string;
  title: string;
  fields: { key: string; value: string }[];
}[] {
  return Object.entries(DEMO_DETAIL_KEYS).map(([id, keys]) => ({
    id,
    title: id,
    fields: keys.map((key, i) => {
      const tuned = DEMO_DETAIL_VALUES[id]?.[key];
      const value = tuned ?? demoDetailValue(key, i, mixed);
      return { key, value: String(value * vary) };
    }),
  }));
}

/**
 * Seed every metric family the summary cards display, so that a demo pack
 * always diffs against EVERY card the open report shows (a fixture that
 * lacks, say, bandwidthCards would otherwise leave those cards badge-less
 * for every operator). Every seeded default varies with the MIXED seed — the
 * baseline's id runs through Knuth multiplication because consecutive demo
 * ids otherwise collapse in any raw bit slice (the balance/write/AIV cards
 * painted byte-identical deltas for all five baselines).
 */
function ensureDemoMetrics(model: AdaptedReport['reportModel'], seed: number): void {
  // Same seed mixing as ensureDemoTopology: consecutive demo ids must not
  // collapse onto equal values in any bit slice.
  const mixed = Math.imul(seed, 0x9e3779b1) >>> 0;
  if (!model.summary) model.summary = {};
  const s = model.summary;
  // Unconditional: the pack is synthetic demo data, so the measured metrics
  // are always reseeded. Filling only missing fields once left fixtures that
  // share values (sample / out.rep / example all adapt to the same
  // taskDurationUs) with a zero delta on the default operator — no badge on
  // any card — which broke the "every demo operator diffs every card"
  // guarantee. Peaks stay chip-level constants.
  s.taskDurationUs = 800 + (mixed % 20) * 60;
  // Ranges chosen so the five demo baselines stay pairwise distinct AND no
  // operator scale (0.35…1.6) lands on the open report's own value (the old
  // 0.55 × 1.6 = 0.88 exactly matched sample.rep and suppressed the badge).
  s.parallelUtilization = 0.3 + ((mixed >>> 5) % 9) * 0.035;
  s.parallelBalance = 0.3 + ((mixed >>> 11) % 9) * 0.04;
  // Both sides always seeded: a single-side fixture (roofline_multi carries
  // only aiv) must still diff the AIC compute card.
  model.computeCard = {
    sides: [
      { side: 'aic', measuredTflops: 40 + ((mixed >>> 15) % 10) * 5, peakTflops: 100 },
      { side: 'aiv', measuredTflops: 30 + ((mixed >>> 20) % 10) * 4, peakTflops: 100 },
    ],
  };
  {
    // Demo pipes REPLACE whatever the baseline fixture carried: the demo row
    // set mirrors the real fixture shapes (vector-side reports plus the
    // gelu-like aic/aiv0/aiv1 compute cores), so the bars pair with the open
    // report's rows on every toggle — including Cube on fixtures whose own
    // cube rows are all-zero or absent (out.rep carries no aic rows at all,
    // which once left the Cube toggle without baseline bars).
    const pipeSeed: Array<[string, string, string, string]> = [];
    // Classic compute sides — sample.lite.rep and vector_muladd carry
    // cube[..]/vector[..] rows (a mix report: cube AND vector side sets).
    for (const side of ['cube', 'vector']) {
      pipeSeed.push(
        ['cube', 'Cube', 'cube', side],
        ['mte1', 'MTE1', 'mte1', side],
        ['mte2', 'MTE2', 'mte2', side],
        ['mte3', 'MTE3', 'mte3', side],
        ['fixp', 'Fixp', 'fixp', side],
        ['scalar', 'Scalar', 'scalar', side],
        ['icache', 'ICache', 'icache', side],
        ['vector', 'Vector', 'vector', side],
      );
    }
    // Emulate cores — gelu.npu-rep carries aic/aiv0/aiv1 rows.
    for (const side of ['aic', 'aiv0', 'aiv1']) {
      pipeSeed.push(
        ['scalar', 'Scalar', 'scalar', side],
        ['cube', 'Cube', 'cube', side],
        ['fixp', 'Fixp', 'fixp', side],
        ['mte1', 'MTE1', 'mte1', side],
        ['mte2', 'MTE2', 'mte2', side],
        ['mte3', 'MTE3', 'mte3', side],
        ['simt', 'Simt', 'simt', side],
        ['vector', 'Vector', 'vector', side],
      );
    }
    // Ratios stay below 0.56 so no operator scale (up to 1.6) hits the 1.0
    // clamp — a clamped pair painted the SAME delta for two operators. The
    // 0.29/0.03/10 ramp is searched so no scaled row lands within the 2dp
    // display step of sample.rep's own pipe ratio (a suppressed delta).
    model.pipeOccupancy = pipeSeed.map(([id, label, colorKey, side], i) => {
      const ratio = 0.29 + (((mixed >>> (i % 20)) + i) % 10) * 0.03;
      return {
        id,
        label,
        colorKey,
        side: side as never,
        ratio,
        // The baseline bar shows the SAME fields as the current bar — its own
        // value rides at the left of the track, percent at the right.
        absoluteValue: ratio,
      };
    });
  }
  // DEMO-DIFF RULE: the details categories cover EVERY field the demo open
  // report carries (the list pairs by field key, so a missing key can never
  // badge), and a fixture that already carries categories is reseeded too —
  // comparing the same report against itself must still move every field.
  const vary = 1 + (mixed % 6) * 0.05;
  const synthetic = demoDetailCategories(mixed, vary);
  if (!model.summaryCategories?.length) {
    model.summaryCategories = synthetic;
  } else {
    for (const c of model.summaryCategories) {
      c.fields = c.fields.map((f, i) => {
        if (!isNumericText(f.value)) return f;
        const n = Number(f.value);
        // A baseline factor plus a small absolute epsilon: zero-valued fields
        // (gather_2d carries several) must not stay equal to the open report.
        const delta = n * (vary - 1) + 0.01 + ((i + f.key.length) % 3) * 0.01;
        return { key: f.key, value: String(n + delta) };
      });
      // A fixture category can be partial (gather_2d has no aic_* compute
      // keys): append the demo keys it lacks so those detail rows can badge.
      const seedCat = synthetic.find((s) => s.id === c.id);
      const have = new Set(c.fields.map((f) => f.key));
      for (const f of seedCat?.fields ?? []) {
        if (!have.has(f.key)) c.fields.push(f);
      }
    }
    const existing = new Set(model.summaryCategories.map((c) => c.id));
    for (const cat of synthetic) {
      if (!existing.has(cat.id)) model.summaryCategories.push(cat);
    }
  }
  // Ramp bases avoid every operator scale landing on sample.rep's own
  // utilization (a 2dp-equal pair paints no badge).
  model.bandwidthCards = [
    { id: 'input', sides: [{ side: 'aic', measuredGBs: 250 + ((mixed >>> 5) % 7) * 10, peakGBs: 800 }] },
    { id: 'output', sides: [{ side: 'aic', measuredGBs: 150 + ((mixed >>> 5) % 7) * 10, peakGBs: 800 }] },
  ];
  ensureDemoTopology(model, seed);
}

/** Scale one ReportViewModel's measured metrics (peaks stay chip-level). */
function scaleMeasuredMetrics(model: AdaptedReport['reportModel'], scale: number, seed: number): void {
  ensureDemoMetrics(model, seed);
  const s = model.summary;
  if (typeof s.taskDurationUs === 'number') model.summary.taskDurationUs = s.taskDurationUs * scale;
  if (typeof s.parallelUtilization === 'number') {
    model.summary.parallelUtilization = s.parallelUtilization * scale;
  }
  if (typeof s.parallelBalance === 'number') model.summary.parallelBalance = s.parallelBalance * scale;
  for (const side of model.computeCard?.sides ?? []) {
    if (typeof side.measuredTflops === 'number') side.measuredTflops *= scale;
  }
  for (const card of model.bandwidthCards ?? []) {
    for (const side of card.sides) {
      if (typeof side.measuredGBs === 'number') side.measuredGBs *= scale;
    }
  }
  for (const p of model.pipeOccupancy ?? []) {
    p.ratio = Math.min(1, Math.max(0, p.ratio * scale));
    if (typeof p.absoluteValue === 'number') p.absoluteValue *= scale;
  }
  // Memory-topology plates and the L2 peak are percentages (0..100), so they
  // clamp there instead of at 1. `label` is rewritten with the numeric value:
  // the diagram prints the label and the badge diffs the number, and the two
  // must never disagree after a scale.
  for (const plate of model.memoryTopology?.plates ?? []) {
    if (typeof plate.value !== 'number') continue;
    plate.value = clampPercent(plate.value * scale);
    plate.label = `${plate.value.toFixed(2)}%`;
  }
  const l2 = model.memoryTopology?.nodes.find((n) => n.id === 'l2');
  if (l2 && typeof l2.peakPct === 'number') l2.peakPct = clampPercent(l2.peakPct * scale);
  for (const c of model.summaryCategories ?? []) {
    for (const f of c.fields) {
      const n = Number(f.value);
      if (Number.isFinite(n)) f.value = String(n * scale);
    }
  }
}

/** The widest bundled fixture (vector_muladd) has 56 blocks; a generous range
 *  covers every fixture's block switcher without asking which report is open. */
const DEMO_TOPOLOGY_BLOCKS = 200;

/** Find (or create) one CSV table in a model's table list and make sure the
 *  columns the topology reads exist. */
function demoTableOf(
  list: CsvTableModel[],
  fileName: string,
  headers: string[],
): CsvTableModel {
  let table = list.find((t) => t.fileName === fileName);
  if (!table) {
    table = { fileName, headers: [...headers], rows: [], blockIds: [] };
    list.push(table);
  } else {
    for (const header of headers) {
      if (!table.headers.includes(header)) table.headers.push(header);
    }
  }
  return table;
}

/**
 * Seed the demo pack's **per-block** topology rows (对比基线 in a picked block).
 * The bundled baseline fixtures carry wildly different block sets, shapes and
 * columns — out.rep has no Cube values, gelu has no CSVs at all — so a picked
 * block used to show a badge only for the few blocks two files happened to
 * share, and often no Cube/peak badge at all. The demo pack writes every block
 * id the open report can ask for into the two files the topology reads, on one
 * side of every bundled fixture's own values (aiv_scalar / cube / peak above,
 * vec below → both tones in every block). The operator index joins the hash,
 * so the Operator select repaints block-scoped badges too.
 */
function ensureDemoBlockTopology(
  model: AdaptedReport['reportModel'],
  seed: number,
  opIndex: number,
): void {
  model.computeTables ??= [];
  model.memoryTables ??= [];
  const pipe = demoTableOf(model.computeTables, 'PipeUtilization.csv', [
    'block_id',
    'aiv_scalar_ratio',
    'aiv_vec_ratio',
    'aic_cube_ratio',
    'aic_scalar_ratio',
    'aiv_simt_ratio',
  ]);
  const l2 = demoTableOf(model.memoryTables, 'L2Cache.csv', [
    'block_id',
    'aic_total_hit_rate(%)',
  ]);
  const rowFor = (table: CsvTableModel, id: string): Record<string, string> => {
    let row = table.rows.find((r) => r.block_id === id);
    if (!row) {
      row = { block_id: id };
      table.rows.push(row);
    }
    return row;
  };
  const ids: string[] = [];
  // The operator index goes FIRST: a one-character change at the end of the
  // key moves the hash by 31-961 only (low bits), leaving the `>>>20`/`>>>25`
  // slices the plates read unchanged — the Operator select could not repaint
  // the SIMT/AIC Scalar badges. First position changes the high bits too.
  const mixed = Math.imul(seed, 0x9e3779b1) >>> 0;
  for (let b = 0; b < DEMO_TOPOLOGY_BLOCKS; b++) {
    const id = String(b);
    const h = hashKey(`${opIndex}:blk:${mixed}:${id}`);
    const pipeRow = rowFor(pipe, id);
    // 70–89% (above every fixture's scalar util), 0.5–2.4% (below every
    // fixture's vec util), 88–96% (above the sample's cube util).
    pipeRow.aiv_scalar_ratio = (0.7 + (h % 20) / 100).toFixed(4);
    pipeRow.aiv_vec_ratio = (0.005 + ((h >>> 5) % 20) / 1000).toFixed(4);
    pipeRow.aic_cube_ratio = (0.88 + ((h >>> 10) % 9) / 100).toFixed(4);
    // AIC Scalar 50–60%, SIMT 55–62% — above the demo current values.
    pipeRow.aic_scalar_ratio = (0.5 + ((h >>> 20) % 11) / 100).toFixed(4);
    pipeRow.aiv_simt_ratio = (0.55 + ((h >>> 25) % 8) / 100).toFixed(4);
    // 96.0–99.5% hit rate, above every fixture's peak (max 83.9%).
    rowFor(l2, id)['aic_total_hit_rate(%)'] = (96 + ((h >>> 15) % 36) / 10).toFixed(4);
    ids.push(id);
  }
  const mergeIds = (table: CsvTableModel): void => {
    table.blockIds = [...new Set([...table.blockIds, ...ids])].sort(
      (a, b) => Number(a) - Number(b) || a.localeCompare(b),
    );
  };
  mergeIds(pipe);
  mergeIds(l2);
}

/**
 * Wrap an adapted flat pack into a demo multi-operator pack: one synthetic
 * operator per demo name, each with the same metrics scaled differently — the
 * aside's Operator select then drives per-operator comparison values.
 */
export function withDemoOperatorPack(report: AdaptedReport, variationKey = ''): AdaptedReport {
  // No early return for packs that already carry `operators`: the aside's
  // Operator dropdown is stamped with the eight demo names
  // (withDemoBaselineOperators), so a native op1/op2 pack (example.npu.rep,
  // browsed nested reports) would resolve every demo name to its first
  // operator and never change values. The demo pack ALWAYS synthesizes the
  // eight operators.
  const seed = hashKey(variationKey);
  const base = report.reportModel;
  const operatorReports: Record<string, AdaptedReport> = {};
  DEMO_BASELINE_OPERATORS.forEach((name, i) => {
    const model = structuredClone(base);
    varyDemoSourceCorrelation(model, seed, i);
    scaleMeasuredMetrics(model, DEMO_OPERATOR_SCALES[i], seed);
    ensureDemoBlockTopology(model, seed, i);
    operatorReports[name] = { reportModel: model, swimlaneModel: report.swimlaneModel };
  });
  return {
    ...report,
    operators: DEMO_BASELINE_OPERATORS.map((name) => ({ id: name, label: name })),
    operatorReports,
  };
}

/**
 * Demo recent-report list for the picker's second view (Add Recent). The web
 * hosts have no plugin behind them, so the host supplies these the way MSTT
 * supplies its live Performance results tree. Names follow the real opprof
 * runId format the plugin lists (`OPPROF_<YYYYMMDDHHMMSS>_<16 random uppercase
 * letters>`, one folder per run under `<workspaceRoot>/.vscode/opprof/`).
 */
export const DEMO_RECENT_BASELINES: Baseline[] = [
  {
    id: 'demo-recent-1',
    name: 'OPPROF_20261108142517_QKWFPLXZVTRNBGMA',
    path: '/data/out.rep',
    // The OPPROF run id embeds the stamp; carried explicitly so the derived
    // title (filename + timestamp) never depends on parsing (review PR #234).
    pickedAt: new Date(2026, 10, 8, 14, 25, 17).getTime(),
  },
  {
    id: 'demo-recent-2',
    name: 'OPPROF_20261109111842_MJNHEYSDCQXVBRUW',
    path: '/data/example.rep',
    pickedAt: new Date(2026, 10, 9, 11, 18, 42).getTime(),
  },
  {
    id: 'demo-recent-3',
    name: 'OPPROF_20261109152306_ZAXWQPLOKMNJIUHY',
    path: '/data/gelu.npu-rep',
    pickedAt: new Date(2026, 10, 9, 15, 23, 6).getTime(),
  },
  {
    id: 'demo-recent-4',
    name: 'OPPROF_20261110100955_BGTRFVEDCWSXQAZP',
    path: '/data/gather_2d.npu-rep',
    pickedAt: new Date(2026, 10, 10, 10, 9, 55).getTime(),
  },
  {
    id: 'demo-recent-5',
    name: 'OPPROF_20261110135206_HYGTFRDESWQAZXCV',
    path: '/data/roofline_multi.npu-rep',
    pickedAt: new Date(2026, 10, 10, 13, 52, 6).getTime(),
  },
  // Source-diff packs: each carries its own `sourceCorrelation`, so the 源码对比
  // entry pairs against them. The fixture packs have no generated run id, so a
  // readable host name titles them. Only the packs whose source TEXT differs
  // from the open fixture (`demo.npu-rep`) are listed: demo/left hold the same
  // lines, so comparing them renders an empty diff.
  {
    id: 'demo-recent-6',
    name: 'source-diff mid',
    path: '/data/source-diff/mid.npu-rep',
    pickedAt: new Date(2026, 10, 11, 9, 25).getTime(),
  },
  {
    id: 'demo-recent-7',
    name: 'source-diff right',
    path: '/data/source-diff/right.npu-rep',
    pickedAt: new Date(2026, 10, 11, 9, 30).getTime(),
  },
];

/**
 * Shared host glue for the baselines contract (对比基线): the library renders
 * and selects; this host keeps the list in session state only and opens the
 * file dialog through a hidden file input. There is deliberately no
 * persistence here — the library contract leaves persistence to the host, and
 * the bundled web hosts (playground / exported HTML shell) treat baselines
 * like every other test value: alive for the open page, gone on reload.
 * A real host (MSTT) persists through its own storage via the same
 * `update:baselines` / `update:baselineRows` emits.
 */
export function createBaselinesHost(
  input: () => HTMLInputElement | null,
): BaselinesHost {
const baselines = ref<Baseline[]>([]);
  /** Comparison rows (report + operator per row); row 0 is the aside's primary. */
  const baselineRows = ref<BaselineRow[]>([]);
  /**
   * Adapted packs for the checked baselines the rows reference, keyed by
   * baseline id (对比基线). The library renders; this host adapts the picked
   * File itself via the public `loadReportSource` and tags the result with the
   * baseline id, so a row can never paint another baseline's values. The map
   * is a cache: switching a row back to an already-adapted report is instant.
   */
  const baselineReports = ref<BaselineReports>({});

  /** Picked File by pseudo-path — the browser cannot reopen a path, so the bytes live here. */
  const filesByPath = new Map<string, File>();

  /**
   * Bumped on every resolved pick, even when the path dedupes onto an already
   * added row: the watcher below would otherwise never re-run and a re-pick
   * after reload would never refresh the payload.
   */
  const pickNonce = ref(0);

  /** Monotonic guard: a stale adaptation is discarded. */
  let adaptGen = 0;
  /** Last pick nonce seen by the adapter: a fresh pick must refresh cached packs. */
  let lastPickNonce = 0;
  /**
   * The last resolved pick's pseudo-path. A fresh pick refreshes THAT entry
   * only: the pseudo-path carries size + mtime, so a changed file is a
   * different path, and a same-path re-pick (a reload lost the retained
   * bytes) refreshes its own pack while every other compared baseline keeps
   * its cache — Browse must not blank the deltas already on screen.
   */
  let lastPickedPath: string | null = null;

  /** Bytes behind a baseline entry: a retained File, or the demo fixture URL. */
  async function bytesFor(entry: Baseline): Promise<Uint8Array | null> {
    const file = filesByPath.get(entry.path);
    try {
      if (file) return new Uint8Array(await file.arrayBuffer());
      if (entry.path.startsWith('/data/') && typeof fetch === 'function') {
        // Demo entries carry the playground fixture URLs as their path —
        // no retained File, so the glue fetches the bytes itself.
        // ponytail: this only resolves where the host actually serves the
        // path; anywhere else the fetch fails and the row degrades to no
        // comparison, exactly like MSTT passing paths this glue cannot open.
        const res = await fetch(entry.path);
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
      }
    } catch (err) {
      console.warn('[baselinesHost] baseline adaptation failed', err);
    }
    // No backing bytes (a non-demo entry picked outside Browse): graceful
    // no-comparison state for that row.
    return null;
  }

  watch(
    () => [baselines.value, baselineRows.value, pickNonce.value] as const,
    async ([list, _rows, nonce]) => {
      const gen = ++adaptGen;
      const freshPick = nonce !== lastPickNonce;
      lastPickNonce = nonce;
      // A fresh pick re-adapts the re-picked ENTRY only (its bytes were just
      // read); every other checked baseline keeps its cache, and the replaced
      // pack stays published until its new bytes are ready — Browse never
      // blanks the deltas already on screen.
      const refresh = new Set<string>();
      if (freshPick && lastPickedPath != null) {
        for (const entry of list) {
          if (entry.path === lastPickedPath) refresh.add(entry.id);
        }
      }
      lastPickedPath = null;
      // Prune only unchecked ids; keep the rest cached so flipping a row back
      // is instant.
      const next: BaselineReports = {};
      for (const [id, pack] of Object.entries(baselineReports.value)) {
        if (list.some((b) => b.id === id)) next[id] = pack;
      }
      // Adapt every CHECKED baseline, not only the rows' current reports: a row
      // switch must paint instantly (the comparison must not flicker through a
      // no-comparison gap while the new id adapts).
      const wanted = list.map((b) => b.id);
      baselineReports.value = next;
      for (const id of wanted) {
        if (next[id] && !refresh.has(id)) continue;
        const entry = list.find((b) => b.id === id);
        if (!entry) continue;
        const bytes = await bytesFor(entry);
        if (gen !== adaptGen) return; // a newer run superseded this one
        if (!bytes) continue;
        try {
          const report = loadReportSource(
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
          );
          if (gen !== adaptGen) return;
          next[id] = { baselineId: id, report: withDemoOperatorPack(report, id) };
          baselineReports.value = { ...next };
        } catch (err) {
          // Corrupt/unsupported baseline degrades to "no comparison" for that
          // row, never to the main report's error state.
          console.warn('[baselinesHost] baseline adaptation failed', err);
        }
      }
    },
    { immediate: true },
  );

  function onBaselinesUpdate(next: Baseline[]): void {
    baselines.value = next;
  }

  function onBaselineRows(next: BaselineRow[]): void {
    baselineRows.value = next;
  }

  let resolvePick: ((pick: BaselinePick | null) => void) | null = null;

  function pickBaselineFile(): Promise<BaselinePick | null> {
    // A host that renders the hidden input conditionally (or already unmounted
    // it) must get a settled promise: assigning the resolver and clicking a
    // missing input used to leave it pending forever, and a second call
    // orphaned the first resolver.
    const el = input();
    if (!el) return Promise.resolve(null);
    return new Promise((resolve) => {
      // A second Browse while the first dialog is still open: settle the
      // orphaned caller with null instead of leaving it pending forever.
      resolvePick?.(null);
      resolvePick = resolve;
      el.click();
    });
  }

  function onFileChosen(e: Event): void {
    const el = e.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    const resolve = resolvePick;
    resolvePick = null;
    if (!resolve) return;
    if (!file) {
      resolve(null);
      return;
    }
    // ponytail: browser File objects expose no real path; name alone would make
    // two distinct files with the same name dedupe into one baseline (the root
    // dedupes by path). Size + lastModified disambiguate distinct picks while
    // an identical re-pick still dedupes. Ceiling: the pseudo-path is a display
    // identity, not an openable locator, and a regenerated report (new
    // size/mtime) appends instead of re-selecting; comparison rendering must
    // treat `path` as opaque. Real hosts (MSTT) return absolute paths and never
    // see this.
    const path = `${file.name} (${file.size} B, ${file.lastModified})`;
    filesByPath.set(path, file);
    // The watcher re-adapts this path's entry only (see `lastPickedPath`).
    lastPickedPath = path;
    pickNonce.value += 1;
    // The file's real mtime feeds the derived title (review PR #234).
    resolve({ name: file.name, path, pickedAt: file.lastModified });
  }

  function onPickCancel(): void {
    const resolve = resolvePick;
    resolvePick = null;
    resolve?.(null);
  }

  return {
    baselines,
    baselineRows,
    baselineReports,
    pickBaselineFile,
    onBaselinesUpdate,
    onBaselineRows,
    onFileChosen,
    onPickCancel,
  };
}
