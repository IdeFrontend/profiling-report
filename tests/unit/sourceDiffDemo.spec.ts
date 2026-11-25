import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/adapters/loadReportSource';
import { parseNpuRep160 } from '../../src/adapters/parseNpuRep160';
import type { AdaptedReport, SourceCorrelationModel } from '../../src/domain/types';

const DEMO = resolve(__dirname, '../../data/source-diff/demo.npu-rep');

function correlated(
  report: AdaptedReport | undefined,
  side: 'left' | 'mid' | 'right',
): SourceCorrelationModel | undefined {
  const entry = Object.entries(report?.operatorReports ?? {}).find(([id]) =>
    id.startsWith(`${side}.`),
  );
  return entry?.[1].reportModel.sourceCorrelation;
}

describe('PR-DIFF: source-diff demo fixture', () => {
  // Structure-only: summary.db metrics need ensurePcSamplingSql(), which these
  // assertions do not depend on.
  it('PR-DIFF-205: demo.npu-rep holds three correlated operators with a 5-line delta', () => {
    const adapted = loadReportSource(new Uint8Array(readFileSync(DEMO)));

    const ids = adapted.operators?.map((o) => o.id) ?? [];
    expect(ids).toEqual(['left.npu.rep', 'mid.npu.rep', 'right.npu.rep']);

    for (const side of ['left', 'mid', 'right'] as const) {
      expect(correlated(adapted, side)?.mock).toBe(false);
      expect(correlated(adapted, side)!.files[0]!.metricsColumns).toHaveLength(3);
      expect(correlated(adapted, side)!.files[0]!.text).toContain('HwdefectFind');
    }

    const left = correlated(adapted, 'left')!.files[0]!;
    const mid = correlated(adapted, 'mid')!.files[0]!;
    const right = correlated(adapted, 'right')!.files[0]!;

    const lineCount = (text: string): number => text.split(/\r?\n/).length;
    expect(lineCount(left.text)).toBe(lineCount(mid.text));
    expect(lineCount(left.text) - lineCount(right.text)).toBe(5);

    // Each variant has its own HwdefectFind signature line.
    const signature = (text: string): string =>
      text.split(/\r?\n/).find((line) => line.includes('HwdefectFind(Mat')) ?? '';
    expect(
      new Set([signature(left.text), signature(mid.text), signature(right.text)]).size,
    ).toBe(3);
  });

  it('PR-DIFF-206: every leaf carries the donor PipeTrace.json and adapts a swimlane', () => {
    const bytes = new Uint8Array(readFileSync(DEMO));
    const demo = parseNpuRep160(bytes);
    expect(demo.files).toHaveLength(3);

    for (const file of demo.files) {
      const leaf = parseNpuRep160(demo.payloads[file.name]!);
      expect(leaf.files).toHaveLength(5);
      expect(leaf.files.filter((entry) => entry.name === 'PipeTrace.json').map((entry) => entry.type))
        .toEqual([2]);
    }

    const adapted = loadReportSource(bytes);
    for (const side of ['left', 'mid', 'right'] as const) {
      const model = adapted.operatorReports?.[`${side}.npu.rep`]?.swimlaneModel;
      expect(model).not.toBeNull();
      expect(model!.processes.length).toBeGreaterThan(0);
    }
    expect(adapted.swimlaneModel).not.toBeNull();
  });
});
