import { describe, expect, it } from 'vitest';
import { adaptPayloads } from '../../src/adapters/adaptRep';
import {
  buildTimelineTraceBundle,
  defaultTimelineTraceId,
  discoverTimelineTraces,
} from '../../src/adapters/timelineTraces';

const enc = new TextEncoder();

function minimalCtefUs(name: string): string {
  return JSON.stringify({
    traceEvents: [
      { ph: 'M', name: 'process_name', pid: 1, args: { name: `${name}-proc` } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: `${name}-lane` } },
      {
        ph: 'X',
        name: `${name}-op`,
        cat: 'pipe',
        pid: 1,
        tid: 1,
        ts: 0,
        dur: 100,
      },
    ],
  });
}

describe('timelineTraces (§11.14 / DATA-56)', () => {
  it('PR-TLTRACE-001: discovers catalog aliases case-insensitively', () => {
    const payloads = {
      'communication.json': enc.encode(minimalCtefUs('comm')),
        'SimtWarpOccupy.json': enc.encode(minimalCtefUs('warp')),
      'PipeTrace.json': enc.encode(minimalCtefUs('pipe')),
    };
    const traces = discoverTimelineTraces(payloads);
    expect(traces.map((t) => t.id)).toEqual(['communication', 'warpOccupy', 'pipeTrace']);
    expect(traces.map((t) => t.embedName)).toEqual([
      'communication.json',
      'SimtWarpOccupy.json',
      'PipeTrace.json',
    ]);
  });

  it('PR-TLTRACE-002: omits unmatched kinds (no stat)', () => {
    const traces = discoverTimelineTraces({
      'PipeTrace.json': enc.encode(minimalCtefUs('pipe')),
      'statistical_utilization.json': enc.encode('{"operator":"x"}'),
    });
    expect(traces.map((t) => t.id)).toEqual(['pipeTrace']);
  });

  it('PR-TLTRACE-003: default prefers pipeTrace when present', () => {
    expect(
      defaultTimelineTraceId([
        { id: 'communication', embedName: 'Communication.json' },
        { id: 'pipeTrace', embedName: 'PipeTrace.json' },
      ]),
    ).toBe('pipeTrace');
    expect(
      defaultTimelineTraceId([{ id: 'communication', embedName: 'Communication.json' }]),
    ).toBe('communication');
  });

  it('PR-TLTRACE-004: builds one swimlane per present catalog file', () => {
    const bundle = buildTimelineTraceBundle(
      {
        'Communication.json': enc.encode(minimalCtefUs('comm')),
        'PipeTrace.json': enc.encode(minimalCtefUs('pipe')),
      },
      [],
    );
    expect(bundle).not.toBeNull();
    expect(bundle!.selectedTimelineTraceId).toBe('pipeTrace');
    expect(Object.keys(bundle!.timelineTraceModels).sort()).toEqual([
      'communication',
      'pipeTrace',
    ]);
    expect(bundle!.swimlaneModel.processes[0]?.threads[0]?.name).toContain('pipe');
  });

  it('PR-TLTRACE-005: adaptPayloads exposes multi-trace fields; legacy trace.json when catalog empty', () => {
    const multi = adaptPayloads({
      'Communication.json': enc.encode(minimalCtefUs('comm')),
      'PipeTrace.json': enc.encode(minimalCtefUs('pipe')),
    });
    expect(multi.timelineTraces?.map((t) => t.id)).toEqual(['communication', 'pipeTrace']);
    expect(multi.selectedTimelineTraceId).toBe('pipeTrace');
    expect(multi.timelineTraceModels?.communication).toBeTruthy();
    expect(multi.swimlaneModel).not.toBeNull();

    const classic = adaptPayloads({
      'trace.json': enc.encode(
        JSON.stringify({
          traceEvents: [
            { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'classic' } },
            { ph: 'X', name: 'op', pid: 1, tid: 1, ts: 0, dur: 1000 },
          ],
        }),
      ),
    });
    expect(classic.timelineTraces).toBeUndefined();
    expect(classic.swimlaneModel).not.toBeNull();
  });
});
