import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { loadReportSource } from '../adapters/loadReportSource';
import type { Baseline, BaselinePick, BaselineReportData } from '../domain/types';

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
    path: '/workspace/.vscode/opprof/OPPROF_20261108142517_QKWFPLXZVTRNBGMA',
  },
  {
    id: 'demo-recent-2',
    name: 'OPPROF_20261109111842_MJNHEYSDCQXVBRUW',
    path: '/workspace/.vscode/opprof/OPPROF_20261109111842_MJNHEYSDCQXVBRUW',
  },
  {
    id: 'demo-recent-3',
    name: 'OPPROF_20261109152306_ZAXWQPLOKMNJIUHY',
    path: '/workspace/.vscode/opprof/OPPROF_20261109152306_ZAXWQPLOKMNJIUHY',
  },
  {
    id: 'demo-recent-4',
    name: 'OPPROF_20261110100955_BGTRFVEDCWSXQAZP',
    path: '/workspace/.vscode/opprof/OPPROF_20261110100955_BGTRFVEDCWSXQAZP',
  },
  {
    id: 'demo-recent-5',
    name: 'OPPROF_20261110135206_HYGTFRDESWQAZXCV',
    path: '/workspace/.vscode/opprof/OPPROF_20261110135206_HYGTFRDESWQAZXCV',
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
      const file = entry ? filesByPath.get(entry.path) : undefined;
      if (!entry || !file) {
        // No retained bytes (e.g. a demo list entry with no backing file):
        // graceful no-comparison state until the user picks a real file.
        baselineReport.value = null;
        return;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const report = loadReportSource(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        );
        if (gen !== adaptGen) return; // stale — a newer pick superseded this run
        baselineReport.value = { baselineId: sel, report };
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
