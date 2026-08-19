import { describe, expect, it } from 'vitest';
import { adaptRep, chromeTraceToSwimlane, parseRep } from '../../src/index';
import { nestParents } from '../../src/adapters/chromeTraceToSwimlane';
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

    const child = { ph: 'X' as const, name: 'child', pid: 1, tid: 1, ts: 100, dur: 10 };
    const parent = { ph: 'X' as const, name: 'parent', pid: 1, tid: 1, ts: 100, dur: 50 };
    const rest = [
      { ph: 'X' as const, name: 'target', pid: 1, tid: 2, ts: 500, dur: 10 },
      { ph: 's' as const, id: 'f1', pid: 1, tid: 1, ts: 105 },
      { ph: 'f' as const, id: 'f1', pid: 1, tid: 2, ts: 505 },
    ];
    for (const xs of [
      [child, parent, ...rest],
      [parent, child, ...rest],
    ]) {
      const tied = chromeTraceToSwimlane({ traceEvents: xs });
      const src = tied.processes[0]!.threads.find((t) => t.id === 't-1-1')!;
      const dst = tied.processes[0]!.threads.find((t) => t.id === 't-1-2')!;
      expect(src.events.map((e) => e.name)).toEqual(['parent', 'child']);
      expect(src.events[0]!.dependencies).toBeUndefined();
      expect(src.events[1]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 0 }]);
      expect(dst.events[0]!.dependencies?.predecessors).toEqual([{ tid: 't-1-1', index: 1 }]);
    }
  });

  it('PR-SWIM-010: same-event s/f pair yields no self-loop edge', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'A', pid: 1, tid: 1, ts: 0, dur: 100 },
        { ph: 's', id: 'x', pid: 1, tid: 1, ts: 10 },
        { ph: 'f', id: 'x', pid: 1, tid: 1, ts: 20 },
      ],
    });
    expect(model.processes[0]?.threads[0]?.events[0]?.dependencies).toBeUndefined();
  });

  it('PR-SWIM-011: recycled flow ids keep every pair', () => {
    const xEvents = [
      { ph: 'X' as const, name: 'A', pid: 1, tid: 1, ts: 0, dur: 10 },
      { ph: 'X' as const, name: 'B', pid: 1, tid: 2, ts: 20, dur: 10 },
      { ph: 'X' as const, name: 'C', pid: 1, tid: 1, ts: 40, dur: 10 },
      { ph: 'X' as const, name: 'D', pid: 1, tid: 2, ts: 60, dur: 10 },
    ];
    const s1 = { ph: 's' as const, id: 7, pid: 1, tid: 1, ts: 5 };
    const f1 = { ph: 'f' as const, id: 7, pid: 1, tid: 2, ts: 25 };
    const s2 = { ph: 's' as const, id: 7, pid: 1, tid: 1, ts: 45 };
    const f2 = { ph: 'f' as const, id: 7, pid: 1, tid: 2, ts: 65 };

    function expectReused(flows: object[]) {
      const reused = chromeTraceToSwimlane({ traceEvents: [...xEvents, ...flows] });
      const t1 = reused.processes[0]!.threads.find((t) => t.id === 't-1-1')!;
      const t2 = reused.processes[0]!.threads.find((t) => t.id === 't-1-2')!;
      expect(t1.events[0]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 0 }]);
      expect(t2.events[0]!.dependencies?.predecessors).toEqual([{ tid: 't-1-1', index: 0 }]);
      expect(t1.events[1]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 1 }]);
      expect(t2.events[1]!.dependencies?.predecessors).toEqual([{ tid: 't-1-1', index: 1 }]);
    }
    expectReused([s1, f1, s2, f2]);
    expectReused([f1, f2, s1, s2]);
    expectReused([f1, s1, f2, s2]);

    const twoPid = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'A1', pid: 1, tid: 1, ts: 0, dur: 10 },
        { ph: 'X', name: 'A2', pid: 1, tid: 2, ts: 20, dur: 10 },
        { ph: 'X', name: 'B1', pid: 2, tid: 1, ts: 40, dur: 10 },
        { ph: 'X', name: 'B2', pid: 2, tid: 2, ts: 60, dur: 10 },
        { ph: 's', id: 1, pid: 1, tid: 1, ts: 5 },
        { ph: 'f', id: 1, pid: 1, tid: 2, ts: 25 },
        { ph: 's', id: 1, pid: 2, tid: 1, ts: 45 },
        { ph: 'f', id: 1, pid: 2, tid: 2, ts: 65 },
      ],
    });
    const a1 = twoPid.processes.find((p) => p.id === 'p-1')!.threads.find((t) => t.id === 't-1-1')!;
    const a2 = twoPid.processes.find((p) => p.id === 'p-1')!.threads.find((t) => t.id === 't-1-2')!;
    const b1 = twoPid.processes.find((p) => p.id === 'p-2')!.threads.find((t) => t.id === 't-2-1')!;
    const b2 = twoPid.processes.find((p) => p.id === 'p-2')!.threads.find((t) => t.id === 't-2-2')!;
    expect(a1.events[0]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 0 }]);
    expect(a2.events[0]!.dependencies?.predecessors).toEqual([{ tid: 't-1-1', index: 0 }]);
    expect(b1.events[0]!.dependencies?.successors).toEqual([{ tid: 't-2-2', index: 0 }]);
    expect(b2.events[0]!.dependencies?.predecessors).toEqual([{ tid: 't-2-1', index: 0 }]);
  });

  it('PR-SWIM-012: flow in a gap under an enclosing slice binds the enclosing event', () => {
    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'step', pid: 1, tid: 1, ts: 0, dur: 100 },
        { ph: 'X', name: 'op1', pid: 1, tid: 1, ts: 10, dur: 10 },
        { ph: 'X', name: 'op2', pid: 1, tid: 1, ts: 50, dur: 10 },
        { ph: 'X', name: 'target', pid: 1, tid: 2, ts: 200, dur: 10 },
        { ph: 's', id: 'g', pid: 1, tid: 1, ts: 30 },
        { ph: 'f', id: 'g', pid: 1, tid: 2, ts: 205 },
      ],
    });
    const t1 = model.processes[0]!.threads.find((t) => t.id === 't-1-1')!;
    expect(t1.events.map((e) => e.name)).toEqual(['step', 'op1', 'op2']);
    expect(t1.events[0]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 0 }]);
    expect(t1.events[1]!.dependencies).toBeUndefined();
    expect(t1.events[2]!.dependencies).toBeUndefined();
  });

  it('PR-SWIM-013: touching X intervals are siblings, not nested', () => {
    expect([
      ...nestParents([
        { id: 'a', name: 'a', startTime: 0, duration: 10 },
        { id: 'b', name: 'b', startTime: 10, duration: 10 },
      ]),
    ]).toEqual([-1, -1]);
    expect([
      ...nestParents([
        { id: 'outer', name: 'outer', startTime: 0, duration: 50 },
        { id: 'inner', name: 'inner', startTime: 10, duration: 10 },
      ]),
    ]).toEqual([-1, 0]);

    const model = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'a', pid: 1, tid: 1, ts: 0, dur: 10 },
        { ph: 'X', name: 'b', pid: 1, tid: 1, ts: 10, dur: 10 },
        { ph: 'X', name: 'target', pid: 1, tid: 2, ts: 50, dur: 10 },
        { ph: 's', id: 'f', pid: 1, tid: 1, ts: 15 },
        { ph: 'f', id: 'f', pid: 1, tid: 2, ts: 55 },
      ],
    });
    const t1 = model.processes[0]!.threads.find((t) => t.id === 't-1-1')!;
    expect(t1.events.map((e) => e.name)).toEqual(['a', 'b']);
    expect(t1.events[0]!.dependencies).toBeUndefined();
    expect(t1.events[1]!.dependencies?.successors).toEqual([{ tid: 't-1-2', index: 0 }]);
  });
});

function threadByName(model: ReturnType<typeof chromeTraceToSwimlane>, name: string) {
  const thread = model.processes.flatMap((p) => p.threads).find((t) => t.name === name);
  if (!thread) throw new Error(`thread ${name} not found`);
  return thread;
}
