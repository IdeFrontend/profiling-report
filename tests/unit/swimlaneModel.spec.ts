import { describe, expect, it } from 'vitest';
import { adaptRep, chromeTraceToSwimlane, parseRep } from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

describe('PR-SWIM: Chrome Trace → SwimlaneModel', () => {
  it('PR-SWIM-001: trace.json maps to processes/threads/events', () => {
    const parsed = parseRep(loadOutRepBytes());
    const text = new TextDecoder().decode(parsed.payloads['trace.json']);
    const trace = JSON.parse(text) as unknown;
    const model = chromeTraceToSwimlane(trace);

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

    // Ascend fixture declares displayTimeUnit ns → values stay in ns (no ×1000)
    expect(model.metadata?.displayTimeUnit).toBe('ns');
    expect(events[0]!.startTime).toBeLessThan(1e9);

    // Also reachable via adaptRep
    const adapted = adaptRep(parsed);
    expect(adapted.swimlaneModel.processes.length).toBeGreaterThan(0);
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
});
