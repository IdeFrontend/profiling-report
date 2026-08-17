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

  it('PR-SWIM-006: s/f pairs link EventRefs across threads', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'M', name: 'thread_name', pid: 1, tid: 10, args: { name: 'A' } },
        { ph: 'M', name: 'thread_name', pid: 1, tid: 20, args: { name: 'B' } },
        { ph: 'X', name: 'parent', pid: 1, tid: 10, ts: 0, dur: 100 },
        { ph: 'X', name: 'child', pid: 1, tid: 20, ts: 50, dur: 10 },
        { ph: 's', id: 'flow1', pid: 1, tid: 10, ts: 10 },
        { ph: 'f', id: 'flow1', pid: 1, tid: 20, ts: 55 },
      ],
    });
    const parent = threadByName(model, 'A').events[0]!;
    const child = threadByName(model, 'B').events[0]!;
    expect(parent.dependencies?.successors).toEqual([{ tid: 't-1-20', index: 0 }]);
    expect(parent.dependencies?.predecessors).toEqual([]);
    expect(child.dependencies?.predecessors).toEqual([{ tid: 't-1-10', index: 0 }]);
    expect(child.dependencies?.successors).toEqual([]);
  });

  it('PR-SWIM-007: unmatched, inverted, or miss timestamps yield no edge', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'op', pid: 1, tid: 1, ts: 10, dur: 10 },
        { ph: 's', id: 'only-s', pid: 1, tid: 1, ts: 12 },
        { ph: 's', id: 'inverted', pid: 1, tid: 1, ts: 18 },
        { ph: 'f', id: 'inverted', pid: 1, tid: 1, ts: 11 },
        { ph: 's', id: 'gap', pid: 1, tid: 1, ts: 0 },
        { ph: 'f', id: 'gap', pid: 1, tid: 1, ts: 5 },
        { ph: 's', pid: 1, tid: 1, ts: 12 },
        { ph: 'f', id: 'no-ts', pid: 1, tid: 1 },
      ],
    });
    expect(model.processes[0]?.threads[0]?.events[0]?.dependencies).toBeUndefined();
  });

  it('PR-SWIM-008: index is post-sort; duplicate edges unique; omit empty deps', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'second', pid: 1, tid: 1, ts: 100, dur: 10 },
        { ph: 'X', name: 'first', pid: 1, tid: 1, ts: 0, dur: 10 },
        { ph: 's', id: 'a', pid: 1, tid: 1, ts: 2 },
        { ph: 'f', id: 'a', pid: 1, tid: 1, ts: 105 },
        { ph: 's', id: 'b', pid: 1, tid: 1, ts: 3 },
        { ph: 'f', id: 'b', pid: 1, tid: 1, ts: 106 },
      ],
    });
    const events = model.processes[0]!.threads[0]!.events;
    expect(events.map((e) => e.name)).toEqual(['first', 'second']);
    expect(events[0]!.dependencies?.successors).toEqual([{ tid: 't-1-1', index: 1 }]);
    expect(events[1]!.dependencies?.predecessors).toEqual([{ tid: 't-1-1', index: 0 }]);
    expect(events[0]!.dependencies?.successors).toHaveLength(1);
  });

  it('PR-SWIM-009: nested X intervals bind the innermost containing event', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'outer', pid: 1, tid: 1, ts: 0, dur: 100 },
        { ph: 'X', name: 'inner', pid: 1, tid: 1, ts: 10, dur: 10 },
        { ph: 'X', name: 'target', pid: 1, tid: 2, ts: 200, dur: 10 },
        { ph: 's', id: 'f1', pid: 1, tid: 1, ts: 15 },
        { ph: 'f', id: 'f1', pid: 1, tid: 2, ts: 205 },
      ],
    });
    const t1 = model.processes[0]!.threads.find((t) => t.id === 't-1-1')!;
    const t2 = model.processes[0]!.threads.find((t) => t.id === 't-1-2')!;
    expect(t1.events.map((e) => e.name)).toEqual(['outer', 'inner']);
    expect(t1.events[0]!.dependencies).toBeUndefined();
    expect(t1.events[1]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 0 }]);
    expect(t2.events[0]!.dependencies?.predecessors).toEqual([{ tid: 't-1-1', index: 1 }]);
  });
});

function threadByName(model: ReturnType<typeof chromeTraceToSwimlane>, name: string) {
  const thread = model.processes.flatMap((p) => p.threads).find((t) => t.name === name);
  if (!thread) throw new Error(`thread ${name} not found`);
  return thread;
}
