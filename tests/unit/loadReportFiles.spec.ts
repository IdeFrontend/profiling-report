import { describe, expect, it } from 'vitest';
import { loadReportFiles, parseRep } from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

function payloadMap(): Record<string, Uint8Array> {
  return parseRep(loadOutRepBytes()).payloads;
}

describe('PR-FILES: backend-extracted report files', () => {
  it('PR-FILES-001: adapts a name → bytes map', () => {
    const adapted = loadReportFiles(payloadMap());
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.reportModel.pipeOccupancy.length).toBeGreaterThan(0);
    expect(adapted.swimlaneModel.processes.length).toBeGreaterThan(0);
  });

  it('PR-FILES-002: adapts the backend { name, data } list shape', () => {
    const list = Object.entries(payloadMap()).map(([name, data]) => ({ name, data }));
    const adapted = loadReportFiles(list);
    expect(adapted.reportModel.summary.opName).toBe('add_custom');
    expect(adapted.swimlaneModel.processes.length).toBeGreaterThan(0);
  });

  it('PR-FILES-003: empty input throws', () => {
    expect(() => loadReportFiles({})).toThrow(/no report files/);
    expect(() => loadReportFiles([])).toThrow(/no report files/);
  });

  it('PR-FILES-004: missing trace.json throws (timeline requires a swimlane source)', () => {
    const withoutTrace: Record<string, Uint8Array> = {};
    for (const [name, data] of Object.entries(payloadMap())) {
      if (name !== 'trace.json') withoutTrace[name] = data;
    }
    expect(() => loadReportFiles(withoutTrace)).toThrow(/trace\.json missing/);
  });
});
