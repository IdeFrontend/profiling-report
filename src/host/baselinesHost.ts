import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { loadReportSource } from '../adapters/loadReportSource';
import type { AdaptedReport, Baseline, BaselinePick, BaselineReportData } from '../domain/types';

export interface BaselinesHost {
  baselines: Ref<Baseline[]>;
  selectedBaselineId: Ref<string | null>;
  /** Adapted pack of the selected baseline; null until adapted / on failure. */
  baselineReport: Ref<BaselineReportData | null>;
  pickBaselineFile(): Promise<BaselinePick | null>;
  onBaselinesUpdate(next: Baseline[]): void;
  onSelectedBaselineId(id: string | null): void;
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

/** Fill missing `operators` with the demo set; real operators pass through. */
export function withDemoBaselineOperators(baselines: Baseline[]): Baseline[] {
  return baselines.map((b) =>
    b.operators && b.operators.length > 0 ? b : { ...b, operators: [...DEMO_BASELINE_OPERATORS] });
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
 * Seed every metric family the summary cards display, so that a demo pack
 * always diffs against EVERY card the open report shows (a fixture that
 * lacks, say, bandwidthCards would otherwise leave those cards badge-less
 * for every operator). Every seeded default varies with `seed` — the
 * baseline's id — so flipping baselines visibly changes the demo values.
 */
function ensureDemoMetrics(model: AdaptedReport['reportModel'], seed: number): void {
  if (!model.summary) model.summary = {};
  const s = model.summary;
  // Unconditional: the pack is synthetic demo data, so the measured metrics
  // are always reseeded. Filling only missing fields once left fixtures that
  // share values (sample / out.rep / example all adapt to the same
  // taskDurationUs) with a zero delta on the default operator — no badge on
  // any card — which broke the "every demo operator diffs every card"
  // guarantee. Peaks stay chip-level constants.
  s.taskDurationUs = 800 + (seed % 20) * 60;
  s.parallelUtilization = 0.3 + (seed % 8) * 0.05;
  s.parallelBalance = 0.3 + ((seed >> 3) % 8) * 0.05;
  // Both sides always seeded: a single-side fixture (roofline_multi carries
  // only aiv) must still diff the AIC compute card.
  model.computeCard = {
    sides: [
      { side: 'aic', measuredTflops: 40 + (seed % 10) * 5, peakTflops: 100 },
      { side: 'aiv', measuredTflops: 30 + ((seed >> 2) % 10) * 4, peakTflops: 100 },
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
    model.pipeOccupancy = pipeSeed.map(([id, label, colorKey, side], i) => ({
      id,
      label,
      colorKey,
      side: side as never,
      ratio: 0.3 + ((i + seed) % 7) * 0.08,
      // The baseline bar shows the SAME fields as the current bar — its own
      // value rides at the left of the track, percent at the right.
      absoluteValue: 0.3 + ((i + seed) % 7) * 0.08,
    }));
  }
  if (!model.summaryCategories?.length) {
    // Demo details set mirroring the typical op categories so the 详情 overlay
    // pairs field-by-field with the open report's fields.
    const cats: Record<string, [string, number][]> = {
      PipeUtilization: [
        ['aiv_time(us)', 40], ['aiv_total_cycles', 60000], ['aiv_vec_time(us)', 39],
        ['aiv_vec_ratio', 0.9], ['aiv_scalar_time(us)', 1], ['aiv_scalar_ratio', 0.02],
        ['aiv_mte2_time(us)', 0.004], ['aiv_mte2_ratio', 0.0002], ['aiv_mte2_active_bw(GB/s)', 30],
        ['aiv_mte3_time(us)', 0.002], ['aiv_mte3_ratio', 0.0001], ['aiv_icache_miss_rate', 0.01],
      ],
      ArithmeticUtilization: [
        ['aiv_time(us)', 40], ['aiv_total_cycles', 60000], ['aiv_vec_ratio', 0.9],
        ['aiv_vec_vf_ratio', 0.1], ['aiv_vec_sfu_ratio', 0.05], ['aiv_vec_simt_vf_ratio', 0.9],
      ],
      ResourceConflictRatio: [
        ['aiv_time(us)', 40], ['aiv_total_cycles', 60000], ['aiv_vec_stu_cflt_ratio', 0.02],
        ['aiv_vec_ldu_cflt_ratio', 0.01], ['aiv_vec_sfu_cflt_ratio', 0.01], ['aiv_vec_wait_ratio', 0.03],
        ['aiv_mte2_wait_ratio', 0.01], ['aiv_mte3_wait_ratio', 0.01],
      ],
    };
    model.summaryCategories = Object.entries(cats).map(([id, fields]) => ({
      id,
      title: id,
      fields: fields.map(([key, value]) => ({ key, value: String(value) })),
    }));
  }
  model.bandwidthCards = [
    { id: 'input', sides: [{ side: 'aic', measuredGBs: 300 + (seed % 10) * 40, peakGBs: 800 }] },
    { id: 'output', sides: [{ side: 'aic', measuredGBs: 150 + ((seed >> 4) % 10) * 30, peakGBs: 800 }] },
  ];
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
  for (const c of model.summaryCategories ?? []) {
    for (const f of c.fields) {
      const n = Number(f.value);
      if (Number.isFinite(n)) f.value = String(n * scale);
    }
  }
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
    scaleMeasuredMetrics(model, DEMO_OPERATOR_SCALES[i], seed);
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
  },
  {
    id: 'demo-recent-2',
    name: 'OPPROF_20261109111842_MJNHEYSDCQXVBRUW',
    path: '/data/example.rep',
  },
  {
    id: 'demo-recent-3',
    name: 'OPPROF_20261109152306_ZAXWQPLOKMNJIUHY',
    path: '/data/gelu.npu-rep',
  },
  {
    id: 'demo-recent-4',
    name: 'OPPROF_20261110100955_BGTRFVEDCWSXQAZP',
    path: '/data/gather_2d.npu-rep',
  },
  {
    id: 'demo-recent-5',
    name: 'OPPROF_20261110135206_HYGTFRDESWQAZXCV',
    path: '/data/roofline_multi.npu-rep',
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
 * `update:baselines` / `update:selectedBaselineId` emits.
 */
export function createBaselinesHost(
  input: () => HTMLInputElement | null,
): BaselinesHost {
const baselines = ref<Baseline[]>([]);
  const selectedBaselineId = ref<string | null>(null);
  /**
   * Adapted pack of the selected baseline (对比基线 comparison). The library
   * renders and selects; this host adapts the picked File itself via the public
   * `loadReportSource` and tags the result with the baseline id, so a late
   * adaptation can never paint under a new selection.
   */
  const baselineReport = ref<BaselineReportData | null>(null);

  /** Picked File by pseudo-path — the browser cannot reopen a path, so the bytes live here. */
  const filesByPath = new Map<string, File>();

  /**
   * Bumped on every resolved pick, even when the path dedupes onto the already
   * selected row: the watcher below would otherwise never re-run and a
   * re-pick after reload would never refresh the payload.
   */
  const pickNonce = ref(0);

  /** Monotonic guard: a stale adaptation is discarded. */
  let adaptGen = 0;

  watch(
    () => [baselines.value, selectedBaselineId.value, pickNonce.value] as const,
    async ([list, sel]) => {
      const gen = ++adaptGen;
      if (!sel) {
        baselineReport.value = null;
        return;
      }
      const entry = list.find((b) => b.id === sel);
      if (!entry) {
        baselineReport.value = null;
        return;
      }
      const file = filesByPath.get(entry.path);
      let bytes: Uint8Array | null = null;
      try {
        if (file) {
          bytes = new Uint8Array(await file.arrayBuffer());
        } else if (entry.path.startsWith('/data/') && typeof fetch === 'function') {
          // Demo entries carry the playground fixture URLs as their path —
          // no retained File, so the glue fetches the bytes itself.
          // ponytail: the exported HTML shell has no /data files, so the fetch
          // 404s there and degrades to no comparison, exactly like MSTT
          // passing paths this glue cannot open.
          const res = await fetch(entry.path);
          if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
        }
      } catch (err) {
        console.warn('[baselinesHost] baseline adaptation failed', err);
        // Only the current run may degrade the payload — a superseded run
        // failing after a newer selection must not wipe that newer payload.
        if (gen === adaptGen) baselineReport.value = null;
        return;
      }
      if (!bytes) {
        // No backing bytes (a non-demo entry picked outside Browse):
        // graceful no-comparison state.
        if (gen === adaptGen) baselineReport.value = null;
        return;
      }
      try {
        const report = loadReportSource(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        );
        if (gen !== adaptGen) return; // stale — a newer pick superseded this run
        baselineReport.value = { baselineId: sel, report: withDemoOperatorPack(report, sel) };
      } catch (err) {
        // Corrupt/unsupported baseline degrades to "no comparison", never to the main report's error state.
        console.warn('[baselinesHost] baseline adaptation failed', err);
        baselineReport.value = null;
      }
    },
    { immediate: true },
  );

  function onBaselinesUpdate(next: Baseline[]): void {
    baselines.value = next;
  }

  function onSelectedBaselineId(id: string | null): void {
    selectedBaselineId.value = id;
  }

  let resolvePick: ((pick: BaselinePick | null) => void) | null = null;

  function pickBaselineFile(): Promise<BaselinePick | null> {
    return new Promise((resolve) => {
      resolvePick = resolve;
      input()?.click();
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
    pickNonce.value += 1;
    resolve({ name: file.name, path });
  }

  function onPickCancel(): void {
    const resolve = resolvePick;
    resolvePick = null;
    resolve?.(null);
  }

  return {
    baselines,
    selectedBaselineId,
    baselineReport,
    pickBaselineFile,
    onBaselinesUpdate,
    onSelectedBaselineId,
    onFileChosen,
    onPickCancel,
  };
}
