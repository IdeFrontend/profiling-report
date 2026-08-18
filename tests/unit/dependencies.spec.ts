import { describe, expect, it } from 'vitest';
import {
  DEPENDENCY_MAX_NEIGHBORS,
  buildDependencyGraph,
  hasDependencies,
  neighborsOf,
} from '../../src/domain/dependencies';
import { chromeTraceToSwimlane } from '../../src/adapters/chromeTraceToSwimlane';
import type { SwimEvent, SwimlaneModel } from '../../src/domain/types';

function model(events: SwimEvent[], children?: SwimEvent[]): SwimlaneModel {
  return {
    processes: [
      {
        id: 'p-0',
        name: 'Card0',
        threads: [
          {
            id: 't-0',
            name: 'Core0.Cube',
            events,
            children: children
              ? [{ id: 't-0-child', name: 'MTE2', events: children }]
              : undefined,
          },
        ],
      },
    ],
    minTime: 0,
    maxTime: 1000,
  };
}

function ev(id: string, startTime: number, dependencies?: string[]): SwimEvent {
  return { id, name: id.toUpperCase(), startTime, duration: 10, dependencies };
}

describe('dependencies', () => {
  it('PR-DEPS-001: indexes successors and mirrors them into predecessors', () => {
    const graph = buildDependencyGraph(model([ev('a', 0, ['b']), ev('b', 20)]));

    expect(graph.outgoing.get('a')).toEqual(['b']);
    expect(graph.incoming.get('b')).toEqual(['a']);
    expect(graph.nodes.get('b')).toMatchObject({ id: 'b', name: 'B', startTime: 20 });
  });

  it('PR-DEPS-002: drops dangling, self and duplicate edges', () => {
    const graph = buildDependencyGraph(
      model([ev('a', 0, ['missing', 'a', 'b', 'b']), ev('b', 20)]),
    );

    // The three rejects leave no trace at all: only the a→b edge is indexed.
    expect([...graph.outgoing]).toEqual([['a', ['b']]]);
    expect([...graph.incoming]).toEqual([['b', ['a']]]);
  });

  it('PR-DEPS-004: level limits hop depth', () => {
    const graph = buildDependencyGraph(
      model([ev('a', 0, ['b']), ev('b', 20, ['c']), ev('c', 40, ['d']), ev('d', 60)]),
    );

    expect(neighborsOf(graph, 'a', 0).outgoing).toEqual([]);
    expect(neighborsOf(graph, 'a', 1).outgoing.map((n) => n.id)).toEqual(['b']);
    expect(neighborsOf(graph, 'a', 2).outgoing.map((n) => n.id)).toEqual(['b', 'c']);
    expect(neighborsOf(graph, 'a', -1).outgoing.map((n) => n.id)).toEqual(['b', 'c', 'd']);
  });

  it('PR-DEPS-005: a cycle terminates without returning the start event', () => {
    const graph = buildDependencyGraph(
      model([ev('a', 0, ['b']), ev('b', 20, ['c']), ev('c', 40, ['a'])]),
    );

    const out = neighborsOf(graph, 'a', -1).outgoing.map((n) => n.id);
    expect(out).toEqual(['b', 'c']);
  });

  it('PR-DEPS-006: hasDependencies gates the capability', () => {
    expect(hasDependencies(model([ev('a', 0), ev('b', 20)]))).toBe(false);
    expect(hasDependencies(model([ev('a', 0)], [ev('b', 20, ['a'])]))).toBe(true);
    expect(hasDependencies(null)).toBe(false);
  });

  it('PR-DEPS-007: the Chrome Trace adapter reads args.event_id and args.dependencies', () => {
    const swim = chromeTraceToSwimlane({
      traceEvents: [
        {
          ph: 'X',
          name: 'FIX_LOC_TO_DST',
          pid: 1,
          tid: 1,
          ts: 0,
          dur: 10,
          args: { event_id: 'task-1', dependencies: ['task-2', 7] },
        },
        { ph: 'X', name: 'MOV_OUT', pid: 1, tid: 1, ts: 20, dur: 10, args: { event_id: 'task-2' } },
        { ph: 'X', name: 'STEP', pid: 1, tid: 1, ts: 40, dur: 10, args: { event_id: 7 } },
      ],
    });

    const graph = buildDependencyGraph(swim);
    expect(graph.nodes.has('task-1')).toBe(true);
    expect(graph.outgoing.get('task-1')).toEqual(['task-2', '7']);
    expect(neighborsOf(graph, 'task-2').incoming.map((n) => n.id)).toEqual(['task-1']);
  });

  it('PR-DEPS-008: a repeated args.event_id keeps the first claimant and falls back', () => {
    const swim = chromeTraceToSwimlane({
      traceEvents: [
        { ph: 'X', name: 'A', pid: 1, tid: 1, ts: 0, dur: 10, args: { event_id: 'dup' } },
        { ph: 'X', name: 'B', pid: 1, tid: 1, ts: 20, dur: 10, args: { event_id: 'dup' } },
        // Squats the id the adapter would hand the next event without a stable id.
        { ph: 'X', name: 'C', pid: 1, tid: 1, ts: 40, dur: 10, args: { event_id: 'e-3' } },
        { ph: 'X', name: 'D', pid: 1, tid: 1, ts: 60, dur: 10 },
      ],
    });

    const ids = swim.processes[0].threads[0].events.map((e) => e.id);
    expect(ids[0]).toBe('dup');
    expect(new Set(ids).size).toBe(ids.length);
    // The surviving 'dup' node is the first event, not the last writer.
    expect(buildDependencyGraph(swim).nodes.get('dup')?.name).toBe('A');
  });

  it('PR-DEPS-009: each side is capped at 200 neighbours, earliest first', () => {
    // Chain of 300: an unlimited walk would return all 299 successors, one chip and one
    // connector curve each.
    const chain = Array.from({ length: 300 }, (_, i) =>
      ev(`k${i}`, i * 10, i + 1 < 300 ? [`k${i + 1}`] : undefined),
    );
    const out = neighborsOf(buildDependencyGraph(model(chain)), 'k0').outgoing;

    expect(out).toHaveLength(DEPENDENCY_MAX_NEIGHBORS);
    expect(out[0].id).toBe('k1');
    expect(out.at(-1)?.id).toBe(`k${DEPENDENCY_MAX_NEIGHBORS}`);
  });
});
