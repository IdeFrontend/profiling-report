import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MISSING_SOURCE_EMBED_PREFIX,
  modelNeedsSourceResolve,
  resolveMissingSourceFiles,
  workspaceSourceResolver,
} from '../../src/adapters';
import { loadReportSource } from '../../src/adapters/loadReportSource';
import { parseNpuRep160 } from '../../src/adapters/parseNpuRep160';
import type { AdaptedReport, SourceCorrelationModel } from '../../src/domain/types';

const DEMO = resolve(__dirname, '../../data/source-diff/demo.npu-rep');
const SOURCE_DIR = resolve(__dirname, '../../data/source-diff');

const lineCount = (text: string): number => text.split(/\r?\n/).length;
const signature = (text: string): string =>
  text.split(/\r?\n/).find((line) => line.includes('HwdefectFind(Mat')) ?? '';

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
  it('PR-DIFF-205: demo.npu-rep holds three correlated operators without an embedded source', () => {
    const adapted = loadReportSource(new Uint8Array(readFileSync(DEMO)));

    const ids = adapted.operators?.map((o) => o.id) ?? [];
    expect(ids).toEqual(['left.npu.rep', 'mid.npu.rep', 'right.npu.rep']);

    for (const side of ['left', 'mid', 'right'] as const) {
      const model = correlated(adapted, side)!;
      expect(model.mock).toBe(false);
      expect(model.files[0]!.metricsColumns).toHaveLength(3);
      const text = model.files[0]!.text;
      expect(text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);
      expect(text).not.toContain('HwdefectFind');
      expect(modelNeedsSourceResolve(model)).toBe(true);
    }
  });

  it('PR-DIFF-206: every leaf carries the donor PipeTrace.json and adapts a swimlane', () => {
    const bytes = new Uint8Array(readFileSync(DEMO));
    const demo = parseNpuRep160(bytes);
    expect(demo.files).toHaveLength(3);

    for (const file of demo.files) {
      const leaf = parseNpuRep160(demo.payloads[file.name]!);
      expect(leaf.files).toHaveLength(4);
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

  it('PR-DIFF-214: a workspace pick refills every demo leaf source', async () => {
    const adapted = loadReportSource(new Uint8Array(readFileSync(DEMO)));
    const pick = {
      files: ['sharpen.asc', 'sharpen_mid.asc', 'sharpen2.asc'].map((name) => ({
        path: `ws/kernel/${name}`,
        text: readFileSync(resolve(SOURCE_DIR, name), 'utf8'),
      })),
    };
    const resolveOne = workspaceSourceResolver(pick);

    const before: Record<'left' | 'mid' | 'right', SourceCorrelationModel> = {
      left: correlated(adapted, 'left')!,
      mid: correlated(adapted, 'mid')!,
      right: correlated(adapted, 'right')!,
    };
    for (const side of ['left', 'mid', 'right'] as const) {
      expect(modelNeedsSourceResolve(before[side])).toBe(true);
      expect(before[side].files[0]!.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);
    }

    const filled: Record<'left' | 'mid' | 'right', SourceCorrelationModel> = {
      left: await resolveMissingSourceFiles(before.left, resolveOne),
      mid: await resolveMissingSourceFiles(before.mid, resolveOne),
      right: await resolveMissingSourceFiles(before.right, resolveOne),
    };

    for (const side of ['left', 'mid', 'right'] as const) {
      const text = filled[side].files[0]!.text;
      expect(filled[side]).not.toBe(before[side]);
      expect(text).toContain('HwdefectFind');
      expect(text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(false);
      expect(modelNeedsSourceResolve(filled[side])).toBe(false);
    }
    expect(filled.right.files[0]!.id).toBe('sharpen2.asc');
    expect(lineCount(filled.left.files[0]!.text) - lineCount(filled.right.files[0]!.text)).toBe(5);
    expect(
      new Set(
        [filled.left, filled.mid, filled.right].map((model) => signature(model.files[0]!.text)),
      ).size,
    ).toBe(3);
  });
});
