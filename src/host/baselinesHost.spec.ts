import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { createBaselinesHost, DEMO_RECENT_BASELINES, withDemoOperatorPack } from './baselinesHost';
import { baselineDisplayTitle } from '../domain/baselineTitle';
import { loadOutRepBuffer, loadOutRepBytes, loadSampleRepBytes } from '../../tests/helpers/fixtures';
import { buildMemoryTopology } from '../adapters/memoryTopology';
import { metricDiff, summaryDiffs } from '../domain/metricDiff';
import { emptyReportViewModel } from '../adapters/adaptRep';
import { loadReportSource } from '../adapters/loadReportSource';
import { isMissingSourceEmbed, modelNeedsSourceResolve } from '../adapters';
import type { MemoryTopologyPlate, ReportViewModel } from '../domain/types';

function platesOf(model: ReportViewModel): MemoryTopologyPlate[] {
  return model.memoryTopology?.plates ?? [];
}

function plateValue(model: ReportViewModel, node: MemoryTopologyPlate['node']): number {
  return platesOf(model).find((p) => p.node === node)?.value ?? 0;
}

function peakPctOf(model: ReportViewModel): number {
  return model.memoryTopology?.nodes.find((n) => n.id === 'l2')?.peakPct ?? 0;
}

/** Files-like target for onFileChosen — the host never reads beyond these fields. */
function fileEvent(name: string, size = 10, lastModified = 123): Event {
  const el = { files: [{ name, size, lastModified }], value: '' };
  return { target: el } as unknown as Event;
}

/** A real File the host retains and adapts (Browse flow). */
function realFileEvent(name: string, bytes: Uint8Array, lastModified = 123): Event {
  const file = new File([bytes.buffer as ArrayBuffer], name, { lastModified });
  const el = { files: [file], value: '' };
  return { target: el } as unknown as Event;
}

/** A host whose hidden input exists — a pick only settles while the input is
 *  there (a missing input resolves null at once, see the pending-pick test). */
function pickHost() {
  const el = document.createElement('input');
  return createBaselinesHost(() => el);
}

describe('createBaselinesHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty — no storage, the host seeds and applies the library emits', () => {
    const host = createBaselinesHost(() => null);
    expect(host.baselines.value).toEqual([]);
    expect(host.baselineRows.value).toEqual([]);
    expect(host.baselineReports.value).toEqual({});

    host.onBaselinesUpdate([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    host.onBaselineRows([{ id: 'r1', baselineId: 'b1', operatorId: '' }]);
    expect(host.baselines.value).toEqual([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    expect(host.baselineRows.value).toEqual([{ id: 'r1', baselineId: 'b1', operatorId: '' }]);

    // Session-only by design: nothing survives a page reload, and no storage is
    // touched anywhere (persistence belongs to a real host like MSTT).
    const fresh = createBaselinesHost(() => null);
    expect(fresh.baselines.value).toEqual([]);
    expect(fresh.baselineRows.value).toEqual([]);
    expect(fresh.baselineReports.value).toEqual({});
  });

  it('resolves the pick with a disambiguated pseudo-path; cancel resolves null', async () => {
    const host = pickHost();
    const pending = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 42, 7));
    const pick = await pending;
    expect(pick).toEqual({
      name: 'profile.npu-rep',
      path: 'profile.npu-rep (42 B, 7)',
      // The file mtime feeds the derived title (review PR #234).
      pickedAt: 7,
    });
    // Same name, different size/mtime → different path (no false dedupe).
    const second = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 99, 8));
    expect(await second).toEqual({
      name: 'profile.npu-rep',
      path: 'profile.npu-rep (99 B, 8)',
      pickedAt: 8,
    });

    const cancelled = host.pickBaselineFile();
    host.onPickCancel();
    expect(await cancelled).toBeNull();

    // A change with no pending pick is a no-op.
    expect(() => host.onFileChosen(fileEvent('stale.npu-rep'))).not.toThrow();
  });

  it('a second Browse settles the first pick with null instead of orphaning it', async () => {
    const host = pickHost();
    const first = host.pickBaselineFile();
    const second = host.pickBaselineFile();
    // The first dialog's caller settles at once; the second owns the input.
    expect(await first).toBeNull();
    host.onFileChosen(fileEvent('profile.npu-rep', 42, 7));
    expect(await second).toEqual({
      name: 'profile.npu-rep',
      path: 'profile.npu-rep (42 B, 7)',
      pickedAt: 7,
    });
  });

  it('resolves null when the change event carries no file', async () => {
    const host = pickHost();
    const pending = host.pickBaselineFile();
    const el = { files: [], value: '' };
    host.onFileChosen({ target: el } as unknown as Event);
    expect(await pending).toBeNull();
  });

  it('a pick with no host input resolves null instead of hanging', async () => {
    // A host that unmounts its hidden input (or renders it conditionally) must
    // still get a settled promise — the old code left it pending forever.
    const host = createBaselinesHost(() => null);
    await expect(host.pickBaselineFile()).resolves.toBeNull();
  });

  it('adapts a row\'s baseline file into baselineReports via loadReportSource', async () => {
    const host = pickHost();
    // Browse: the pick resolves with the pseudo-path; the bytes stay in the glue.
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    const pick = await pending;
    expect(pick?.name).toBe('out.rep');

    // The picker emits the checked set; the entry carries the same pseudo-path.
    const entry = { id: 'b1', name: 'out.rep', path: pick!.path };
    host.onBaselinesUpdate([entry]);
    host.onBaselineRows([{ id: 'r1', baselineId: 'b1', operatorId: '' }]);
    await flushPromises();

    const adapted = host.baselineReports.value['b1'];
    expect(adapted).toBeDefined();
    expect(adapted!.baselineId).toBe('b1');
    expect(adapted!.report.reportModel).toBeDefined();

    // Dropping the row keeps the pack cached while the baseline is checked…
    host.onBaselineRows([]);
    await flushPromises();
    expect(host.baselineReports.value['b1']).toBeDefined();
    // …unchecking the baseline prunes it.
    host.onBaselinesUpdate([]);
    await flushPromises();
    expect(host.baselineReports.value['b1']).toBeUndefined();
  });

  it('a row whose entry has no retained bytes degrades to no comparison', async () => {
    const host = createBaselinesHost(() => null);
    // Non-demo entry without retained bytes: in the list, referenced by a row,
    // but never picked through Browse (path outside /data — no fetch fallback).
    host.onBaselinesUpdate([{ id: 'other-1', name: 'OPPROF_X', path: '/opprof/x' }]);
    host.onBaselineRows([{ id: 'r1', baselineId: 'other-1', operatorId: '' }]);
    await flushPromises();
    expect(host.baselineReports.value['other-1']).toBeUndefined();
  });

  it('a demo entry fetches its fixture bytes and adapts them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(loadOutRepBytes().buffer as ArrayBuffer, { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const host = createBaselinesHost(() => null);
    host.onBaselinesUpdate([{ id: 'demo-recent-1', name: 'OPPROF_A', path: '/data/out.rep' }]);
    host.onBaselineRows([{ id: 'r1', baselineId: 'demo-recent-1', operatorId: '' }]);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith('/data/out.rep');
    const adapted = host.baselineReports.value['demo-recent-1'];
    expect(adapted?.baselineId).toBe('demo-recent-1');
    expect(adapted?.report.reportModel).toBeDefined();
    vi.unstubAllGlobals();

    // A 404 (e.g. the exported HTML shell has no /data files) degrades.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const miss = createBaselinesHost(() => null);
    miss.onBaselinesUpdate([{ id: 'demo-recent-1', name: 'OPPROF_A', path: '/data/out.rep' }]);
    miss.onBaselineRows([{ id: 'r1', baselineId: 'demo-recent-1', operatorId: '' }]);
    await flushPromises();
    expect(miss.baselineReports.value['demo-recent-1']).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('a corrupt file degrades with a warning, never an error state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = pickHost();
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('broken.rep', new Uint8Array([1, 2, 3, 4])));
    const pick = await pending;
    host.onBaselinesUpdate([{ id: 'b1', name: 'broken.rep', path: pick!.path }]);
    host.onBaselineRows([{ id: 'r1', baselineId: 'b1', operatorId: '' }]);
    await flushPromises();
    expect(host.baselineReports.value['b1']).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[baselinesHost] baseline adaptation failed', expect.anything());
  });

  it('re-picking the same file re-adapts through the pickNonce alone', async () => {
    const host = pickHost();
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    const pick = await pending;
    const entry = { id: 'b1', name: 'out.rep', path: pick!.path };
    host.onBaselinesUpdate([entry]);
    host.onBaselineRows([{ id: 'r1', baselineId: 'b1', operatorId: '' }]);
    await flushPromises();
    expect(host.baselineReports.value['b1']?.baselineId).toBe('b1');
    const first = host.baselineReports.value['b1']?.report;

    // The same file picked again (e.g. after a reload lost the retained
    // payload): BaselinePicker dedupes the already-checked path and emits
    // NOTHING — no baselines update, no selection change — so the pickNonce
    // bump is the ONLY trigger that can re-run the adaptation.
    const again = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    await again;
    // No onBaselinesUpdate / onBaselineRows — mimic the picker's dedupe.
    await flushPromises();
    expect(host.baselineReports.value['b1']?.baselineId).toBe('b1');
    // A fresh adaptation object proves the watcher re-ran on the nonce alone.
    expect(host.baselineReports.value['b1']?.report).not.toBe(first);
  });

  it('re-picking one file keeps every other adapted pack on screen', async () => {
    const host = pickHost();
    const pickA = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('a.rep', loadOutRepBytes()));
    const a = await pickA;
    const pickB = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('b.rep', loadOutRepBytes()));
    const b = await pickB;
    host.onBaselinesUpdate([
      { id: 'a', name: 'a.rep', path: a!.path },
      { id: 'b', name: 'b.rep', path: b!.path },
    ]);
    host.onBaselineRows([
      { id: 'r1', baselineId: 'a', operatorId: '' },
      { id: 'r2', baselineId: 'b', operatorId: '' },
    ]);
    await flushPromises();
    const firstA = host.baselineReports.value['a']?.report;
    const firstB = host.baselineReports.value['b']?.report;
    expect(firstA).toBeDefined();
    expect(firstB).toBeDefined();

    // Re-pick A: its own pack refreshes, B keeps the SAME pack, and the map is
    // never blanked in between — Browse must not flicker the deltas already on
    // screen off and back.
    const again = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('a.rep', loadOutRepBytes()));
    await again;
    await nextTick();
    expect(host.baselineReports.value['a']?.report).toBe(firstA);
    expect(host.baselineReports.value['b']?.report).toBe(firstB);
    await flushPromises();
    expect(host.baselineReports.value['a']?.report).not.toBe(firstA);
    expect(host.baselineReports.value['b']?.report).toBe(firstB);
  });

  it('DEMO-DIFF RULE: every demo baseline diffs every memory element vs sample.rep with both tones', () => {
    // The open report's real shape (sample.lite.rep): three plates + the L2
    // peak + the memory summary categories the 详情 lists.
    const sampleShape = {
      memoryTopology: {
        nodes: [{ id: 'l2', label: 'L2 Cache', peakPct: 0.603448125 }],
        edges: [],
        plates: [
          { node: 'aiv_scalar', label: '33.24%', value: 33.24 },
          { node: 'vec', label: '6.72%', value: 6.72 },
          { node: 'cube', label: '51.40%', value: 51.4 },
        ],
      },
      summaryCategories: [
        {
          id: 'Memory',
          title: 'Memory',
          fields: [
            { key: 'aic_main_mem_read_bw(GB/s)', value: '560' },
            { key: 'aiv_mte2_ratio', value: '0.3812395' },
          ],
        },
        {
          id: 'MemoryL0',
          title: 'MemoryL0',
          fields: [
            { key: 'aiv_time(us)', value: '0.97962125' },
          ],
        },
        {
          id: 'L2Cache',
          title: 'L2Cache',
          fields: [
            { key: 'aiv_total_hit_rate(%)', value: '0.603448125' },
          ],
        },
      ],
    };
    // sampleShape below is a partial literal — only summaryCategories is read here
    const fieldOf = (model: Pick<ReportViewModel, 'summaryCategories'>, catId: string, key: string): number | undefined => {
      const f = model.summaryCategories
        ?.find((c) => c.id === catId)
        ?.fields?.find((x) => x.key === key);
      return f == null ? undefined : Number(f.value);
    };
    const tones = new Set<string>();
    for (const id of DEMO_RECENT_BASELINES.map((b) => b.id)) {
      const pack = withDemoOperatorPack(
        { reportModel: { ...emptyReportViewModel() }, swimlaneModel: null },
        id,
      );
      const bl = pack.operatorReports!['matmul']!.reportModel;
      // Every topology element diffs, non-zero, on the right side of the values.
      for (const plate of sampleShape.memoryTopology.plates) {
        const cur = plate.value;
        const base = bl.memoryTopology?.plates?.find((p) => p.node === plate.node)?.value;
        expect(base, `${id}: ${plate.node} seeded`).toBeTypeOf('number');
        const diff = base! - cur;
        expect(diff, `${id}: ${plate.node} non-zero delta`).not.toBe(0);
        tones.add(diff > 0 ? 'decrease' : 'increase');
      }
      const l2Cur = sampleShape.memoryTopology.nodes[0].peakPct!;
      const l2Base = bl.memoryTopology?.nodes?.find((n) => n.id === 'l2')?.peakPct;
      expect(l2Base, `${id}: l2 peak seeded`).toBeTypeOf('number');
      expect(l2Base! - l2Cur, `${id}: l2 peak non-zero delta`).not.toBe(0);
      tones.add(l2Base! > l2Cur ? 'decrease' : 'increase');
      // Memory 详情 fields diff too.
      for (const [catId, key] of [
        ['Memory', 'aic_main_mem_read_bw(GB/s)'],
        ['Memory', 'aiv_mte2_ratio'],
        ['MemoryL0', 'aiv_time(us)'],
        ['L2Cache', 'aiv_total_hit_rate(%)'],
      ] as const) {
        const cur = fieldOf(sampleShape, catId, key)!;
        const base = fieldOf(bl, catId, key);
        expect(base, `${id}: ${catId}.${key} seeded`).toBeTypeOf('number');
        expect(base! - cur, `${id}: ${catId}.${key} non-zero delta`).not.toBe(0);
        tones.add(base! > cur ? 'decrease' : 'increase');
      }
    }
    // Both tones appear at once for every baseline.
    expect([...tones].sort()).toEqual(['decrease', 'increase']);

    // The compute detail fields vary baseline-to-baseline too (the per-
    // baseline factor), and stay one-sided vs sample's own values.
    const computeVecRatios = new Set<number>();
    for (const id of DEMO_RECENT_BASELINES.map((b) => b.id)) {
      const pack = withDemoOperatorPack(
        { reportModel: { ...emptyReportViewModel() }, swimlaneModel: null },
        id,
      );
      const bl = pack.operatorReports!['matmul']!.reportModel;
      const v = fieldOf(bl, 'ArithmeticUtilization', 'aiv_vec_ratio');
      expect(v, `${id}: compute detail seeded`).toBeTypeOf('number');
      expect(v! - 0.067157625, `${id}: compute detail non-zero delta`).not.toBe(0);
      computeVecRatios.add(v!);
    }
    expect(computeVecRatios.size, 'compute details vary per baseline').toBeGreaterThan(1);
  });

  it('synthesizes eight operators with distinct metrics on every card family', () => {
    const pack = withDemoOperatorPack({
      reportModel: emptyReportViewModel(),
      swimlaneModel: null,
    });
    expect(pack.operators?.map((o) => o.id)).toHaveLength(8);
    const reports = Object.values(pack.operatorReports ?? {});
    expect(reports).toHaveLength(8);

    const families: ((m: (typeof reports)[number]['reportModel']) => number)[] = [
      (m) => m.summary.taskDurationUs ?? 0,
      (m) => m.summary.parallelUtilization ?? 0,
      (m) => m.summary.parallelBalance ?? 0,
      (m) => m.computeCard?.sides.find((s) => s.side === 'aic')?.measuredTflops ?? 0,
      (m) => m.computeCard?.sides.find((s) => s.side === 'aiv')?.measuredTflops ?? 0,
      (m) => m.bandwidthCards?.find((c) => c.id === 'input')?.sides[0]?.measuredGBs ?? 0,
      (m) => m.bandwidthCards?.find((c) => c.id === 'output')?.sides[0]?.measuredGBs ?? 0,
      (m) => plateValue(m, 'aiv_scalar'),
      (m) => plateValue(m, 'vec'),
      (m) => plateValue(m, 'cube'),
      (m) => peakPctOf(m),
    ];
    // Every family exists in every operator model…
    for (const m of reports) {
      for (const read of families) {
        expect(read(m.reportModel)).not.toBe(0);
      }
    }
    // …and the values differ from operator to operator on every family.
    for (const read of families) {
      const values = new Set(reports.map((r) => read(r.reportModel)));
      expect(values.size).toBe(8);
    }
  });

  it('different variation keys yield visibly different demo packs', () => {
    const a = withDemoOperatorPack({ reportModel: emptyReportViewModel(), swimlaneModel: null }, 'demo-recent-1');
    const b = withDemoOperatorPack({ reportModel: emptyReportViewModel(), swimlaneModel: null }, 'demo-recent-2');
    const first = (pack: typeof a) => Object.values(pack.operatorReports ?? {})[0].reportModel;
    expect(first(a).summary.taskDurationUs).not.toBe(first(b).summary.taskDurationUs);
    expect(first(a).pipeOccupancy?.[0].ratio).not.toBe(first(b).pipeOccupancy?.[0].ratio);
    expect(first(a).bandwidthCards?.[0].sides[0].measuredGBs).not.toBe(first(b).bandwidthCards?.[0].sides[0].measuredGBs);
    expect(plateValue(first(a), 'aiv_scalar')).not.toBe(plateValue(first(b), 'aiv_scalar'));
    expect(plateValue(first(a), 'vec')).not.toBe(plateValue(first(b), 'vec'));
    expect(plateValue(first(a), 'cube')).not.toBe(plateValue(first(b), 'cube'));
    expect(peakPctOf(first(a))).not.toBe(peakPctOf(first(b)));
  });

  it('varies sourceCorrelation per operator and baseline without touching file identity', () => {
    const base = loadReportSource(
      new Uint8Array(readFileSync('playground/public/data/gather_2d.npu-rep')),
    );
    const source = base.reportModel.sourceCorrelation!;
    let hotFile = -1;
    let hotLine = -1;
    let hotKey = '';
    let hotValue = 0;
    for (const [fi, f] of source.files.entries()) {
      for (const [li, l] of f.lines.entries()) {
        const hit = Object.entries(l.values).find(([, v]) => typeof v === 'number');
        if (hit) {
          [hotFile, hotLine] = [fi, li];
          [hotKey, hotValue] = [hit[0], hit[1] as number];
          break;
        }
      }
      if (hotFile >= 0) break;
    }
    expect(hotFile, 'a numeric source metric exists').toBeGreaterThanOrEqual(0);
    const identity = (corr: typeof source) =>
      corr.files.map((f) => ({ id: f.id, path: f.path, text: f.text, lines: f.lines.length }));
    const before = identity(source);
    const beforeValues = JSON.stringify(source.files.map((f) => f.lines.map((l) => l.values)));

    const seen = new Set<number>();
    for (const id of ['demo-recent-1', 'demo-recent-2']) {
      const pack = withDemoOperatorPack(base, id);
      for (const adapted of Object.values(pack.operatorReports!)) {
        const corr = adapted.reportModel.sourceCorrelation!;
        expect(identity(corr)).toEqual(before);
        const value = corr.files[hotFile]!.lines[hotLine]!.values[hotKey] as number;
        expect(value, `${id}: hot line must differ`).not.toBe(hotValue);
        seen.add(value);
      }
    }
    // Neither operator nor baseline can land on the same numbers.
    expect(seen.size).toBeGreaterThan(1);
    // The pack cloned the model, so the caller's report is untouched.
    expect(identity(source)).toEqual(before);
    expect(JSON.stringify(source.files.map((f) => f.lines.map((l) => l.values)))).toBe(beforeValues);
  });

  it('a full bar still changes for every demo operator', () => {
    const base = emptyReportViewModel();
    base.sourceCorrelation = {
      files: [{
        id: 'f',
        path: 'f.asc',
        text: 'a',
        metricsColumns: [{ id: 'occ', label: 'Occ', kind: 'bar' }],
        lines: [{ line: 1, values: { occ: 1 } }],
      }],
      assembly: { id: 'asm', path: 'asm', text: '', metricsColumns: [], lines: [] },
      asmToSource: new Map(),
      navigateBy: [],
      mock: false,
    };
    const pack = withDemoOperatorPack({ reportModel: base, swimlaneModel: null }, 'full-bar');
    for (const adapted of Object.values(pack.operatorReports!)) {
      const value = adapted.reportModel.sourceCorrelation!.files[0]!.lines[0]!.values.occ;
      expect(value).not.toBe(1);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('reseeds the memory topology per baseline and scales it per operator', () => {
    // out.rep carries real plates (23.04% / 7.19%) and a 0% L2 peak — the demo
    // seeding must REPLACE them: filling only missing values would leave
    // out.rep / example / roofline_multi (same fixture topology) identical.
    const a = withDemoOperatorPack(loadReportSource(loadOutRepBuffer()), 'demo-recent-1');
    const b = withDemoOperatorPack(loadReportSource(loadOutRepBuffer()), 'demo-recent-2');
    const reports = Object.values(a.operatorReports ?? {}).map((r) => r.reportModel);
    expect(reports).toHaveLength(8);

    for (const model of reports) {
      // The adapter's real plate node ids, always present so every demo
      // baseline can badge every node the diagram knows how to paint.
      expect(platesOf(model).map((p) => p.node).sort()).toEqual(['aic_scalar', 'aiv_scalar', 'aiv_scalar_unit', 'cube', 'simt', 'vec']);
      for (const plate of platesOf(model)) {
        expect(typeof plate.value).toBe('number');
        expect(plate.value!).toBeGreaterThan(0);
        expect(plate.value!).toBeLessThanOrEqual(100);
        // One number feeds both the diagram and the badge.
        expect(plate.label).toBe(`${plate.value!.toFixed(2)}%`);
      }
      expect(peakPctOf(model)).toBeGreaterThan(0);
      expect(peakPctOf(model)).toBeLessThanOrEqual(100);
    }

    // Per operator: every seeded topology metric differs across the eight
    // operators, so flipping the Operator select repaints the badges.
    for (const node of ['aiv_scalar', 'vec', 'cube', 'simt', 'aic_scalar', 'aiv_scalar_unit'] as const) {
      expect(new Set(reports.map((m) => plateValue(m, node))).size).toBe(8);
    }
    expect(new Set(reports.map((m) => peakPctOf(m))).size).toBe(8);

    // Per baseline: the SAME fixture adapted under a different baseline id
    // yields different topology values (seed-derived, not fixture-derived).
    const firstA = Object.values(a.operatorReports ?? {})[0].reportModel;
    const firstB = Object.values(b.operatorReports ?? {})[0].reportModel;
    for (const node of ['aiv_scalar', 'vec', 'cube', 'simt', 'aic_scalar', 'aiv_scalar_unit'] as const) {
      expect(plateValue(firstA, node)).not.toBe(plateValue(firstB, node));
    }
    expect(peakPctOf(firstA)).not.toBe(peakPctOf(firstB));
  });

  it('DEMO-DIFF RULE: every demo baseline diffs every memory-topology block', { timeout: 90_000 }, () => {
    // The block switcher comes from the OPEN report; the demo packs must answer
    // for every one of its blocks with all three plates and the L2 peak, on the
    // far side of the current values (aiv/cube/peak above, vec below -> both
    // tones), and vary per operator.
    const tablesOf = (m: ReportViewModel) => [
      ...m.memoryTables,
      ...m.computeTables.filter((t) => t.fileName === 'PipeUtilization.csv'),
    ];
    const topoOf = (m: ReportViewModel, id: string) => buildMemoryTopology(tablesOf(m), id);
    const current = loadReportSource(loadSampleRepBytes()).reportModel!;
    const blocks =
      tablesOf(current).find((t) => t.fileName === 'PipeUtilization.csv')?.blockIds ?? [];
    expect(blocks.length).toBeGreaterThan(1);

    const ids = DEMO_RECENT_BASELINES.map((b) => b.id);
    const blockValues = new Map<string, number>();
    for (const baselineId of ids) {
      const pack = withDemoOperatorPack(
        { reportModel: emptyReportViewModel(), swimlaneModel: null },
        baselineId,
      );
      for (const op of ['matmul', 'gelu'] as const) {
        const baseModel = pack.operatorReports![op].reportModel;
        for (const block of blocks) {
          const cur = topoOf(current, block);
          const base = topoOf(baseModel, block);
          expect(
            base?.plates?.map((p) => p.node).sort(),
            `${baselineId}/${op}/${block}: plates`,
          ).toEqual(['aic_scalar', 'aiv_scalar', 'aiv_scalar_unit', 'cube', 'simt', 'vec']);
          const deltas: number[] = [];
          for (const plate of cur?.plates ?? []) {
            const baselineValue = base!.plates!.find((p) => p.node === plate.node)?.value;
            expect(typeof baselineValue, `${baselineId}/${op}/${block}: ${plate.node}`).toBe(
              'number',
            );
            const delta = baselineValue! - plate.value!;
            expect(delta, `${baselineId}/${op}/${block}: ${plate.node} delta`).not.toBe(0);
            deltas.push(delta);
          }
          const curPeak = cur?.nodes.find((n) => n.id === 'l2')?.peakPct;
          if (curPeak != null) {
            const baselinePeak = base!.nodes.find((n) => n.id === 'l2')?.peakPct;
            expect(typeof baselinePeak, `${baselineId}/${op}/${block}: peak`).toBe('number');
            const delta = baselinePeak! - curPeak;
            expect(delta, `${baselineId}/${op}/${block}: peak delta`).not.toBe(0);
            deltas.push(delta);
          }
          // Both tones in EVERY block.
          expect(deltas.some((d) => d > 0), `${baselineId}/${op}/${block}: green`).toBe(true);
          expect(deltas.some((d) => d < 0), `${baselineId}/${op}/${block}: red`).toBe(true);
        }
        blockValues.set(
          `${baselineId}/${op}`,
          topoOf(baseModel, blocks[0])!.plates!.find((p) => p.node === 'aiv_scalar')!.value!,
        );
      }
    }
    // Operator and baseline both repaint the block-scoped values.
    expect(blockValues.get('demo-recent-1/matmul')).not.toBe(blockValues.get('demo-recent-1/gelu'));
    expect(blockValues.get('demo-recent-1/matmul')).not.toBe(blockValues.get('demo-recent-2/matmul'));
  });

  it(
    'DEMO-DIFF RULE: every demo baseline and operator diffs every element vs the real sample',
    { timeout: 90_000 },
    () => {
      const ops = ['matmul', 'matmul_t', 'add_n', 'relu', 'gelu', 'layernorm', 'softmax', 'conv2d'];
      const current = loadReportSource(loadSampleRepBytes()).reportModel!;
      const numeric = (value: string): number | null => {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === 'NA') return null;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : null;
      };
      // The aside diffs the scores the cards PRINT (PR-STATS-069b): AICore
      // shows a 2-decimal percent, compute/BW an integer percent. The audit
      // must run on that same display grid, or it would prove deltas the UI
      // suppresses.
      const displayedFraction = (n?: number): number | undefined =>
        n == null ? n : Number((Math.min(1, Math.max(0, n)) * 100).toFixed(2)) / 100;
      const displayedThroughput = (measured?: number, peak?: number): number | undefined => {
        if (measured == null || peak == null || !Number.isFinite(measured) || !(peak > 0)) {
          return measured;
        }
        return (peak * Math.min(100, Math.max(0, Math.round((measured / peak) * 100)))) / 100;
      };
      const metricValuesOf = (m: ReportViewModel) => {
        const side = (
          which: 'aic' | 'aiv',
        ): { measuredTflops?: number; peakTflops?: number } =>
          m.computeCard?.sides.find((s) => s.side === which) ?? {};
        const bw = (
          id: string,
        ): { measuredGBs?: number; peakGBs?: number } =>
          m.bandwidthCards?.find((c) => c.id === id)?.sides[0] ?? {};
        return {
          taskDurationUs: m.summary.taskDurationUs,
          parallelUtilization: displayedFraction(m.summary.parallelUtilization),
          parallelBalance: displayedFraction(m.summary.parallelBalance),
          compute: {
            aic: {
              measuredTflops: displayedThroughput(side('aic').measuredTflops, side('aic').peakTflops),
              peakTflops: side('aic').peakTflops,
            },
            aiv: {
              measuredTflops: displayedThroughput(side('aiv').measuredTflops, side('aiv').peakTflops),
              peakTflops: side('aiv').peakTflops,
            },
          },
          bandwidth: {
            read: {
              measuredGBs: displayedThroughput(bw('input').measuredGBs, bw('input').peakGBs),
              peakGBs: bw('input').peakGBs,
            },
            write: {
              measuredGBs: displayedThroughput(bw('output').measuredGBs, bw('output').peakGBs),
              peakGBs: bw('output').peakGBs,
            },
          },
        };
      };
      const fieldOf = (m: ReportViewModel, catId: string, key: string): number | null => {
        const f = m.summaryCategories?.find((c) => c.id === catId)?.fields.find((x) => x.key === key);
        return f == null ? null : numeric(f.value);
      };
      const cardDeltas = new Map<string, Set<number>>();
      const perOp = new Map<string, Set<number>>();

      // The real bytes behind each demo URL — gather_2d carries its own
      // Summary.jsonl (the fixture-carried categories branch).
      for (const baseline of DEMO_RECENT_BASELINES) {
        const id = baseline.id;
        const bytes = new Uint8Array(readFileSync(`playground/public${baseline.path}`));
        const pack = withDemoOperatorPack(loadReportSource(bytes), id);
        for (const op of ops) {
          const base = pack.operatorReports![op].reportModel!;
          const diffs = summaryDiffs(metricValuesOf(current), metricValuesOf(base));
          for (const [key, diff] of Object.entries(diffs)) {
            expect(diff, `${id}/${op}: card ${key} must diff`).not.toBeNull();
            const set = cardDeltas.get(key) ?? new Set<number>();
            set.add(diff!.delta);
            cardDeltas.set(key, set);
            const opSet = perOp.get(key) ?? new Set<number>();
            opSet.add(diff!.delta);
            perOp.set(key, opSet);
          }
          // PIPE rows pair by id + side; each row's ratio must move.
          for (const pipe of current.pipeOccupancy ?? []) {
            const match = (base.pipeOccupancy ?? []).find(
              (p) => p.id === pipe.id && p.side === pipe.side,
            );
            expect(match, `${id}/${op}: pipe ${pipe.id}/${pipe.side}`).toBeDefined();
            const diff = metricDiff(pipe.ratio, match!.ratio);
            expect(diff, `${id}/${op}: pipe ${pipe.id}/${pipe.side} must diff`).not.toBeNull();
          }
          // EVERY numeric details field the open report shows must badge.
          for (const cat of current.summaryCategories ?? []) {
            for (const f of cat.fields) {
              const cur = numeric(f.value);
              if (cur == null) continue;
              const baseValue = fieldOf(base, cat.id, f.key);
              expect(baseValue, `${id}/${op}: ${cat.id}.${f.key} seeded`).not.toBeNull();
              const diff = metricDiff(cur, baseValue!);
              expect(diff, `${id}/${op}: ${cat.id}.${f.key} must diff`).not.toBeNull();
            }
          }
          // Every plate and the L2 peak must badge.
          for (const plate of current.memoryTopology?.plates ?? []) {
            const basePlate = base.memoryTopology?.plates?.find((p) => p.node === plate.node);
            expect(basePlate?.value, `${id}/${op}: plate ${plate.node} seeded`).toBeTypeOf('number');
            expect(
              metricDiff(plate.value, basePlate!.value),
              `${id}/${op}: plate ${plate.node} must diff`,
            ).not.toBeNull();
          }
          const curPeak = current.memoryTopology?.nodes.find((n) => n.id === 'l2')?.peakPct;
          if (curPeak != null) {
            const basePeak = base.memoryTopology?.nodes.find((n) => n.id === 'l2')?.peakPct;
            expect(basePeak, `${id}/${op}: peak seeded`).toBeTypeOf('number');
            expect(metricDiff(curPeak, basePeak), `${id}/${op}: peak must diff`).not.toBeNull();
          }
        }
      }
      // Values vary baseline-to-baseline and operator-to-operator on every card.
      for (const [key, deltas] of cardDeltas) {
        expect(deltas.size, `card ${key} varies per baseline`).toBeGreaterThan(1);
      }
      for (const [key, deltas] of perOp) {
        expect(deltas.size, `card ${key} varies per operator`).toBeGreaterThan(1);
      }
    },
  );

  it('DEMO BASELINES: the source-diff packs carry source, title and a real diff', { timeout: 30_000 }, () => {
    expect(DEMO_RECENT_BASELINES).toHaveLength(8);
    expect(DEMO_RECENT_BASELINES.slice(0, 5).map((b) => b.path)).toEqual([
      '/data/out.rep',
      '/data/example.rep',
      '/data/gelu.npu-rep',
      '/data/gather_2d.npu-rep',
      '/data/roofline_multi.npu-rep',
    ]);
    const sourceDiff = DEMO_RECENT_BASELINES.filter((b) => b.path.startsWith('/data/source-diff/'));
    expect(sourceDiff.map((b) => b.path)).toEqual([
      '/data/source-diff/mid.npu-rep',
      '/data/source-diff/right.npu-rep',
      '/data/source-diff/demo.npu-rep',
    ]);
    // The paths-only pack stays listed; only the open fixture's twin stays out.
    const paths = DEMO_RECENT_BASELINES.map((b) => b.path);
    expect(paths).not.toContain('/data/source-diff/left.npu-rep');
    const titles = DEMO_RECENT_BASELINES.map((b) => baselineDisplayTitle(b));
    expect(new Set(titles).size).toBe(DEMO_RECENT_BASELINES.length);
    // The open fixture ships no source text, so every operator starts on the
    // missing-embed placeholder and the view offers the workspace refill.
    const open = loadReportSource(
      new Uint8Array(readFileSync('playground/public/data/source-diff/demo.npu-rep')),
    );
    const openModels = [
      open.reportModel.sourceCorrelation,
      ...Object.values(open.operatorReports ?? {}).map(
        (op) => op.reportModel.sourceCorrelation,
      ),
    ];
    expect(openModels).toHaveLength(4);
    for (const model of openModels) {
      expect(modelNeedsSourceResolve(model)).toBe(true);
      expect(model!.files).toHaveLength(2);
      for (const file of model!.files) {
        expect(isMissingSourceEmbed(file.text)).toBe(true);
      }
    }
    for (const entry of sourceDiff) {
      expect(baselineDisplayTitle(entry)).toContain('source-diff');
      const bytes = readFileSync(`playground/public${entry.path}`);
      const pack = withDemoOperatorPack(loadReportSource(new Uint8Array(bytes)), entry.id);
      expect(pack.reportModel.sourceCorrelation?.files.length).toBeGreaterThan(0);
      for (const op of Object.values(pack.operatorReports ?? {})) {
        expect(op.reportModel.sourceCorrelation?.files.length).toBeGreaterThan(0);
      }
      // The paths-only pack has no source text, so the view offers the workspace refill.
      if (entry.path === '/data/source-diff/demo.npu-rep') {
        const files = pack.reportModel.sourceCorrelation?.files ?? [];
        expect(files).toHaveLength(2);
        expect(files[0]!.path).toBe('sharpen_left.asc');
        expect(files[1]!.path).toBe('sharpen_common.asc');
        for (const file of files) {
          expect(isMissingSourceEmbed(file.text)).toBe(true);
        }
        expect(modelNeedsSourceResolve(pack.reportModel.sourceCorrelation)).toBe(true);
        continue;
      }
      // The standalone leaves still embed their own source, so nothing to fill.
      expect(pack.reportModel.sourceCorrelation?.files).toHaveLength(2);
      expect(modelNeedsSourceResolve(pack.reportModel.sourceCorrelation)).toBe(false);
    }
  });
});
