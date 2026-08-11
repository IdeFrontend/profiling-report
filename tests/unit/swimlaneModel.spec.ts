import { describe, expect, it } from 'vitest';
import { adaptRep, chromeTraceToSwimlane, parseRep } from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

describe('PR-SWIM: Chrome Trace → SwimlaneModel', () => {
  it('PR-SWIM-001: trace.json maps to processes/threads/events', () => {
    const parsed = parseRep(loadOutRepBytes());
    const adapted = adaptRep(parsed);
    const model = adapted.swimlaneModel;

    expect(model.minTime).toBeLessThan(model.maxTime);
    expect(model.processes.length).toBeGreaterThan(0);

    const threadNames = model.processes.flatMap((p) => p.threads.map((t) => t.name));
    expect(threadNames.some((n) => n.includes('PIPE_V'))).toBe(true);
    expect(threadNames.some((n) => n.includes('PIPE_S'))).toBe(true);

    const events = model.processes.flatMap((p) => p.threads.flatMap((t) => t.events));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        startTime: expect.any(Number),
        duration: expect.any(Number),
      }),
    );

    // Ascend .rep embed: ns source → values stay in ns
    expect(model.metadata?.displayTimeUnit).toBe('ns');
    expect(events[0]!.startTime).toBeLessThan(1e9);
    // Adapters never invent ProfilerStep bands
    expect(model.bands).toBeUndefined();
  });

  it('PR-SWIM-002: default CTEF µs times convert to ns', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T' } },
        { ph: 'X', name: 'op', pid: 1, tid: 1, ts: 10, dur: 5 },
      ],
    });
    expect(model.minTime).toBe(10_000);
    expect(model.maxTime).toBe(15_000);
    expect(model.processes[0]?.threads[0]?.events[0]?.duration).toBe(5_000);
  });

  it('PR-SWIM-003: displayTimeUnit ms is display-only (ts stays µs)', () => {
    const model = chromeTraceToSwimlane({
      displayTimeUnit: 'ms',
      traceEvents: [{ ph: 'X', name: 'op', pid: 1, tid: 1, ts: 10, dur: 5 }],
    });
    // Must NOT treat ms as source unit (that would be 10 * 1e6 ns)
    expect(model.minTime).toBe(10_000);
    expect(model.maxTime).toBe(15_000);
  });

  it('PR-SWIM-004: CTEF array format + process_name metadata', () => {
    const model = chromeTraceToSwimlane([
      { ph: 'M', name: 'process_name', pid: 7, args: { name: 'Kernel' } },
      { ph: 'M', name: 'thread_name', pid: 7, tid: 1, args: { name: 'PIPE_V' } },
      { ph: 'X', name: 'op', pid: 7, tid: 1, ts: 1, dur: 2 },
    ]);
    expect(model.processes[0]?.name).toBe('Kernel');
    expect(model.processes[0]?.threads[0]?.name).toBe('PIPE_V');
    expect(model.minTime).toBe(1000);
  });

  it('PR-SWIM-005: rejects traces with no complete X events', () => {
    expect(() => chromeTraceToSwimlane({ traceEvents: [] })).toThrow(/no complete X events/);
  });
});
