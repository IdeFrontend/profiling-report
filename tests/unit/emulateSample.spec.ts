/**
 * Smoke: committed emulate sample leaf.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReportSource } from '../../src/index';

describe('emulate sample leaf', () => {
  it('loads data/emulate-sample.npu-rep (timeline + summary + PIPE + archDiagram)', () => {
    const bytes = new Uint8Array(
      readFileSync(resolve(__dirname, '../../data/emulate-sample.npu-rep')),
    );
    const adapted = loadReportSource(bytes);
    expect(adapted.swimlaneModel).not.toBeNull();
    expect(adapted.reportModel.summary.opName).toBe('emulate_demo_kernel');
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
    expect(adapted.reportModel.memoryTopology).toBeDefined();
    expect(adapted.capabilities).toContain('archDiagram');
    expect(adapted.capabilities).not.toContain('memoryDiagram');
    expect(adapted.reportModel.roofline).toBeUndefined();
  });
});
