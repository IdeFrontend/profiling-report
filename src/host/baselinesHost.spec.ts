import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createBaselinesHost, withDemoOperatorPack } from './baselinesHost';
import { loadOutRepBuffer, loadOutRepBytes } from '../../tests/helpers/fixtures';
import { emptyReportViewModel } from '../adapters/adaptRep';
import { loadReportSource } from '../adapters/loadReportSource';
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

describe('createBaselinesHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty — no storage, the host seeds and applies the library emits', () => {
    const host = createBaselinesHost(() => null);
    expect(host.baselines.value).toEqual([]);
    expect(host.selectedBaselineId.value).toBeNull();

    host.onBaselinesUpdate([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    host.onSelectedBaselineId('b1');
    expect(host.baselines.value).toEqual([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    expect(host.selectedBaselineId.value).toBe('b1');

    // Session-only by design: nothing survives a page reload, and no storage is
    // touched anywhere (persistence belongs to a real host like MSTT).
    const fresh = createBaselinesHost(() => null);
    expect(fresh.baselines.value).toEqual([]);
    expect(fresh.selectedBaselineId.value).toBeNull();
  });

  it('resolves the pick with a disambiguated pseudo-path; cancel resolves null', async () => {
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 42, 7));
    const pick = await pending;
    expect(pick).toEqual({ name: 'profile.npu-rep', path: 'profile.npu-rep (42 B, 7)' });
    // Same name, different size/mtime → different path (no false dedupe).
    const second = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 99, 8));
    expect(await second).toEqual({ name: 'profile.npu-rep', path: 'profile.npu-rep (99 B, 8)' });

    const cancelled = host.pickBaselineFile();
    host.onPickCancel();
    expect(await cancelled).toBeNull();

    // A change with no pending pick is a no-op.
    expect(() => host.onFileChosen(fileEvent('stale.npu-rep'))).not.toThrow();
  });

  it('resolves null when the change event carries no file', async () => {
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    const el = { files: [], value: '' };
    host.onFileChosen({ target: el } as unknown as Event);
    expect(await pending).toBeNull();
  });

  it('adapts the selected baseline file into baselineReport via loadReportSource', async () => {
    const host = createBaselinesHost(() => null);
    // Browse: the pick resolves with the pseudo-path; the bytes stay in the glue.
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    const pick = await pending;
    expect(pick?.name).toBe('out.rep');

    // The picker emits the checked set; the entry carries the same pseudo-path.
    const entry = { id: 'b1', name: 'out.rep', path: pick!.path };
    host.onBaselinesUpdate([entry]);
    host.onSelectedBaselineId('b1');
    await flushPromises();

    const adapted = host.baselineReport.value;
    expect(adapted).not.toBeNull();
    expect(adapted!.baselineId).toBe('b1');
    expect(adapted!.report.reportModel).toBeDefined();

    // Deselecting (Not selected) drops the payload.
    host.onSelectedBaselineId(null);
    await flushPromises();
    expect(host.baselineReport.value).toBeNull();
  });

  it('a selected entry without retained bytes degrades to no comparison', async () => {
    const host = createBaselinesHost(() => null);
    // Non-demo entry without retained bytes: in the list, selected, but never
    // picked through Browse (path outside /data — no fetch fallback).
    host.onBaselinesUpdate([{ id: 'other-1', name: 'OPPROF_X', path: '/opprof/x' }]);
    host.onSelectedBaselineId('other-1');
    await flushPromises();
    expect(host.baselineReport.value).toBeNull();
  });

  it('a demo entry fetches its fixture bytes and adapts them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(loadOutRepBytes().buffer as ArrayBuffer, { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const host = createBaselinesHost(() => null);
    host.onBaselinesUpdate([{ id: 'demo-recent-1', name: 'OPPROF_A', path: '/data/out.rep' }]);
    host.onSelectedBaselineId('demo-recent-1');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith('/data/out.rep');
    const adapted = host.baselineReport.value;
    expect(adapted?.baselineId).toBe('demo-recent-1');
    expect(adapted?.report.reportModel).toBeDefined();
    vi.unstubAllGlobals();

    // A 404 (e.g. the exported HTML shell has no /data files) degrades.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const miss = createBaselinesHost(() => null);
    miss.onBaselinesUpdate([{ id: 'demo-recent-1', name: 'OPPROF_A', path: '/data/out.rep' }]);
    miss.onSelectedBaselineId('demo-recent-1');
    await flushPromises();
    expect(miss.baselineReport.value).toBeNull();
    vi.unstubAllGlobals();
  });

  it('a corrupt file degrades with a warning, never an error state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('broken.rep', new Uint8Array([1, 2, 3, 4])));
    const pick = await pending;
    host.onBaselinesUpdate([{ id: 'b1', name: 'broken.rep', path: pick!.path }]);
    host.onSelectedBaselineId('b1');
    await flushPromises();
    expect(host.baselineReport.value).toBeNull();
    expect(warn).toHaveBeenCalledWith('[baselinesHost] baseline adaptation failed', expect.anything());
  });

  it('re-picking the same file re-adapts through the pickNonce alone', async () => {
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    const pick = await pending;
    const entry = { id: 'b1', name: 'out.rep', path: pick!.path };
    host.onBaselinesUpdate([entry]);
    host.onSelectedBaselineId('b1');
    await flushPromises();
    expect(host.baselineReport.value?.baselineId).toBe('b1');
    const first = host.baselineReport.value?.report;

    // The same file picked again (e.g. after a reload lost the retained
    // payload): BaselinePicker dedupes the already-checked path and emits
    // NOTHING — no baselines update, no selection change — so the pickNonce
    // bump is the ONLY trigger that can re-run the adaptation.
    const again = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    await again;
    // No onBaselinesUpdate / onSelectedBaselineId — mimic the picker's dedupe.
    await flushPromises();
    expect(host.baselineReport.value?.baselineId).toBe('b1');
    // A fresh adaptation object proves the watcher re-ran on the nonce alone.
    expect(host.baselineReport.value?.report).not.toBe(first);
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
    const fieldOf = (model: any, catId: string, key: string): number | undefined => {
      const f = model.summaryCategories
        ?.find((c: { id: string }) => c.id === catId)
        ?.fields?.find((x: { key: string }) => x.key === key);
      return f == null ? undefined : Number(f.value);
    };
    const tones = new Set<string>();
    for (const id of ['demo-recent-1', 'demo-recent-2', 'demo-recent-3', 'demo-recent-4', 'demo-recent-5']) {
      const pack = withDemoOperatorPack(
        { reportModel: { ...emptyReportViewModel() }, swimlaneModel: null },
        id,
      );
      const bl = pack.operatorReports!['matmul']!.reportModel as any;
      // Every topology element diffs, non-zero, on the right side of the values.
      for (const plate of sampleShape.memoryTopology.plates) {
        const cur = plate.value;
        const base = bl.memoryTopology?.plates?.find((p: any) => p.node === plate.node)?.value;
        expect(base, `${id}: ${plate.node} seeded`).toBeTypeOf('number');
        const diff = base! - cur;
        expect(diff, `${id}: ${plate.node} non-zero delta`).not.toBe(0);
        tones.add(diff > 0 ? 'decrease' : 'increase');
      }
      const l2Cur = sampleShape.memoryTopology.nodes[0].peakPct!;
      const l2Base = bl.memoryTopology?.nodes?.find((n: any) => n.id === 'l2')?.peakPct;
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
      expect(platesOf(model).map((p) => p.node).sort()).toEqual(['aiv_scalar', 'cube', 'vec']);
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
    for (const node of ['aiv_scalar', 'vec', 'cube'] as const) {
      expect(new Set(reports.map((m) => plateValue(m, node))).size).toBe(8);
    }
    expect(new Set(reports.map((m) => peakPctOf(m))).size).toBe(8);

    // Per baseline: the SAME fixture adapted under a different baseline id
    // yields different topology values (seed-derived, not fixture-derived).
    const firstA = Object.values(a.operatorReports ?? {})[0].reportModel;
    const firstB = Object.values(b.operatorReports ?? {})[0].reportModel;
    expect(plateValue(firstA, 'aiv_scalar')).not.toBe(plateValue(firstB, 'aiv_scalar'));
    expect(plateValue(firstA, 'vec')).not.toBe(plateValue(firstB, 'vec'));
    expect(plateValue(firstA, 'cube')).not.toBe(plateValue(firstB, 'cube'));
    expect(peakPctOf(firstA)).not.toBe(peakPctOf(firstB));
  });
});
