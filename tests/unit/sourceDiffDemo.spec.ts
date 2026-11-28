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
import { ensurePcSamplingSql } from '../../src/adapters/sourceCorrelation/readPcSamplingDb';
import { configurePcSamplingSqlForNodeTests } from '../helpers/sqlJsNode';
import {
  alignSourceLines,
  splitSourceLines,
  type DiffRow,
} from '../../src/ui/SourceDiff/diffAlign';
import type { AdaptedReport, SourceCorrelationModel } from '../../src/domain/types';

const DEMO = resolve(__dirname, '../../data/source-diff/demo.npu-rep');
const SOURCE_DIR = resolve(__dirname, '../../data/source-diff');

const SIDES = ['left', 'mid', 'right'] as const;
const PRIMARY = {
  left: 'sharpen_left.asc',
  mid: 'sharpen_mid.asc',
  right: 'sharpen_right.asc',
} as const;
const COMMON = 'sharpen_common.asc';

const lineCount = (text: string): number => text.split(/\r?\n/).length;
const signature = (text: string): string =>
  text.split(/\r?\n/).find((line) => line.includes('HwdefectFind(Mat')) ?? '';

/** Hunk = one maximal run of non-'same' rows, matching the rendered diff. */
function hunks(rows: DiffRow[]): DiffRow[][] {
  const out: DiffRow[][] = [];
  let current: DiffRow[] = [];
  for (const row of rows) {
    if (row.kind === 'same') {
      if (current.length > 0) out.push(current);
      current = [];
      continue;
    }
    current.push(row);
  }
  if (current.length > 0) out.push(current);
  return out;
}

function correlated(
  report: AdaptedReport | undefined,
  side: 'left' | 'mid' | 'right',
): SourceCorrelationModel | undefined {
  const entry = Object.entries(report?.operatorReports ?? {}).find(([id]) =>
    id.startsWith(`${side}.`),
  );
  return entry?.[1].reportModel.sourceCorrelation;
}

const COMMON_METRICS = ['instructionsExecuted', 'samplingStall', 'warpOccupancy'] as const;

/** Sampled common-file rows only: unsampled lines carry no stall value. */
function commonSampledRows(
  model: SourceCorrelationModel,
): Map<number, Record<string, number | string | null>> {
  const file = model.files.find((entry) => entry.id === COMMON)!;
  const rows = new Map<number, Record<string, number | string | null>>();
  for (const line of file.lines) {
    if (!(Number(line.values.samplingStall) > 0)) continue;
    rows.set(line.line, line.values);
  }
  return rows;
}

describe('PR-DIFF: source-diff demo fixture', () => {
  // Structure-only: this test does not decode summary.db metrics, so it needs
  // no sql.js wasm load.
  it('PR-DIFF-205: demo.npu-rep holds three correlated operators without an embedded source', () => {
    const adapted = loadReportSource(new Uint8Array(readFileSync(DEMO)));

    const ids = adapted.operators?.map((o) => o.id) ?? [];
    expect(ids).toEqual(['left.npu.rep', 'mid.npu.rep', 'right.npu.rep']);

    for (const side of SIDES) {
      const model = correlated(adapted, side)!;
      expect(model.mock).toBe(false);
      expect(model.files).toHaveLength(2);
      expect(model.files.map((file) => file.id)).toEqual([PRIMARY[side], COMMON]);
      for (const file of model.files) {
        expect(file.metricsColumns).toHaveLength(3);
        expect(file.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);
        expect(file.text).not.toContain('HwdefectFind');
      }
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
    for (const side of SIDES) {
      const model = adapted.operatorReports?.[`${side}.npu.rep`]?.swimlaneModel;
      expect(model).not.toBeNull();
      expect(model!.processes.length).toBeGreaterThan(0);
    }
    expect(adapted.swimlaneModel).not.toBeNull();
  });

  it('PR-DIFF-214: a workspace pick refills every demo leaf source', async () => {
    const adapted = loadReportSource(new Uint8Array(readFileSync(DEMO)));
    const names = [...SIDES.map((side) => PRIMARY[side]), COMMON];
    const pick = {
      files: names.map((name) => ({
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
    for (const side of SIDES) {
      expect(modelNeedsSourceResolve(before[side])).toBe(true);
      expect(before[side].files[0]!.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);
    }

    const filled: Record<'left' | 'mid' | 'right', SourceCorrelationModel> = {
      left: await resolveMissingSourceFiles(before.left, resolveOne),
      mid: await resolveMissingSourceFiles(before.mid, resolveOne),
      right: await resolveMissingSourceFiles(before.right, resolveOne),
    };

    for (const side of SIDES) {
      expect(filled[side]).not.toBe(before[side]);
      expect(filled[side].files.map((file) => file.id)).toEqual([PRIMARY[side], COMMON]);
      for (const file of filled[side].files) {
        expect(file.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(false);
      }
      const text = filled[side].files[0]!.text;
      expect(text).toContain('HwdefectFind');
      expect(modelNeedsSourceResolve(filled[side])).toBe(false);
    }
    // The shared helper keeps one name across operators, so the exact-name tier
    // of the resolver pairs the same document on every side.
    expect(filled.left.files[1]!.text).toBe(filled.mid.files[1]!.text);
    expect(filled.left.files[1]!.text).toBe(filled.right.files[1]!.text);
    expect(filled.right.files[0]!.id).toBe(PRIMARY.right);
    expect(lineCount(filled.left.files[0]!.text) - lineCount(filled.right.files[0]!.text)).toBe(1);
    expect(
      new Set(SIDES.map((side) => signature(filled[side].files[0]!.text))).size,
    ).toBe(3);

    // Every operator pair is a real manual-check diff: at least eight hunks,
    // each covering a pure insert, a pure delete and a one-for-one replace,
    // with the first and the last rendered row changing too.
    const pairs = [
      ['left', 'mid'],
      ['left', 'right'],
      ['mid', 'right'],
    ] as const;
    for (const [leftSide, rightSide] of pairs) {
      const rows = alignSourceLines(
        splitSourceLines(filled[leftSide].files[0]!.text),
        splitSourceLines(filled[rightSide].files[0]!.text),
      );
      const found = hunks(rows);
      expect(found.length, `${leftSide}-${rightSide} hunks`).toBeGreaterThanOrEqual(8);
      const kinds = new Set(found.flat().map((row) => row.kind));
      expect(kinds, `${leftSide}-${rightSide} diff kinds`).toContain('changed');
      expect(kinds, `${leftSide}-${rightSide} diff kinds`).toContain('onlyLeft');
      expect(kinds, `${leftSide}-${rightSide} diff kinds`).toContain('onlyRight');
      expect(rows[0]!.kind).not.toBe('same');
      expect(rows[rows.length - 1]!.kind).not.toBe('same');
    }
  });

  it('PR-DIFF-220: the shared common source has different sampled metrics per operator', async () => {
    // This is the only test that decodes summary.db rows, so it owns the
    // sql.js wasm setup.
    configurePcSamplingSqlForNodeTests();
    await ensurePcSamplingSql();

    const adapted = loadReportSource(new Uint8Array(readFileSync(DEMO)));
    const rows = {
      left: commonSampledRows(correlated(adapted, 'left')!),
      mid: commonSampledRows(correlated(adapted, 'mid')!),
      right: commonSampledRows(correlated(adapted, 'right')!),
    };
    for (const side of SIDES) {
      expect(rows[side].size, `${side} sampled common rows`).toBeGreaterThan(0);
    }

    const pairs = [
      ['left', 'mid'],
      ['left', 'right'],
      ['mid', 'right'],
    ] as const;
    for (const [leftSide, rightSide] of pairs) {
      expect(
        [...rows[leftSide].keys()],
        `${leftSide}-${rightSide} shared common lines`,
      ).toEqual([...rows[rightSide].keys()]);
      for (const metric of COMMON_METRICS) {
        const differing = [...rows[leftSide].keys()].filter(
          (line) => rows[leftSide].get(line)![metric] !== rows[rightSide].get(line)![metric],
        );
        expect(
          differing.length,
          `${leftSide}-${rightSide} ${metric} diff`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
