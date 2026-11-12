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
const DEMO_OPERATOR_SCALES = [0.4, 0.55, 0.7, 0.85, 1.15, 1.3, 1.45, 1.6];

/** Scale one ReportViewModel's measured metrics (peaks stay chip-level). */
function scaleMeasuredMetrics(model: AdaptedReport['reportModel'], scale: number): void {
  const s = model.summary ?? {};
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
}

/**
 * Wrap an adapted flat pack into a demo multi-operator pack: one synthetic
 * operator per demo name, each with the same metrics scaled differently — the
 * aside's Operator select then drives per-operator comparison values.
 */
export function withDemoOperatorPack(report: AdaptedReport): AdaptedReport {
  if (report.operators && report.operators.length > 0) return report;
  const base = report.reportModel;
  const operatorReports: Record<string, AdaptedReport> = {};
  DEMO_BASELINE_OPERATORS.forEach((name, i) => {
    const model = structuredClone(base);
    scaleMeasuredMetrics(model, DEMO_OPERATOR_SCALES[i]);
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
        baselineReport.value = null;
        return;
      }
      if (!bytes) {
        // No backing bytes (a non-demo entry picked outside Browse):
        // graceful no-comparison state.
        baselineReport.value = null;
        return;
      }
      try {
        const report = loadReportSource(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        );
        if (gen !== adaptGen) return; // stale — a newer pick superseded this run
        baselineReport.value = { baselineId: sel, report: withDemoOperatorPack(report) };
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
