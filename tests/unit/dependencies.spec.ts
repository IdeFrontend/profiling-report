import { describe, expect, it } from 'vitest';
import {
  DEPENDENCY_MAX_NEIGHBORS,
  hasDependencies,
  neighborsOf,
} from '../../src/domain/dependencies';
import { chromeTraceToSwimlane } from '../../src/adapters/chromeTraceToSwimlane';
import type { EventRef, SwimEvent, SwimlaneModel } from '../../src/domain/types';

function model(events: SwimEvent[], children?: SwimEvent[]): SwimlaneModel {
  const built: SwimlaneModel = {
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
  return linkDeclared(built);
}

/** Declared successor ids per event — resolved to refs by `linkDeclared`. */
const declared = new WeakMap<SwimEvent, string[]>();

function ev(id: string, startTime: number, dependencies?: string[]): SwimEvent {
  const event: SwimEvent = { id, name: id.toUpperCase(), startTime, duration: 10 };
  if (dependencies) declared.set(event, dependencies);
  return event;
}

/** Every event of the model, flattened — the walk takes a `SwimEvent`, not an id. */
function eventById(built: SwimlaneModel, id: string): SwimEvent {
  for (const process of built.processes) {
    for (const thread of [...process.threads, ...(process.threads[0]?.children ?? [])]) {
      const hit = thread.events.find((e) => e.id === id);
      if (hit) return hit;
    }
  }
  throw new Error(`no event ${id}`);
}

/**
 * The model stores `{ predecessors, successors }` as `EventRef`s, so the id lists the
 * tests declare have to become positions. An id no event carries becomes an
 * out-of-range ref — the dangling case the walk must drop.
 */
function linkDeclared(built: SwimlaneModel): SwimlaneModel {
  const refById = new Map<string, { event: SwimEvent; ref: EventRef }>();
  for (const process of built.processes) {
    for (const thread of [...process.threads, ...(process.threads[0]?.children ?? [])]) {
      thread.events.forEach((event, index) => {
        refById.set(event.id, { event, ref: { tid: thread.id, index } });
      });
    }
  }
  for (const { event, ref: fromRef } of refById.values()) {
    const targets = declared.get(event);
    if (!targets) continue;
    for (const targetId of targets) {
      const to = refById.get(targetId);
      const deps = (event.dependencies ??= { predecessors: [], successors: [] });
      deps.successors.push(to?.ref ?? { tid: 't-0', index: 9_999 });
      if (!to) continue;
      const toDeps = (to.event.dependencies ??= { predecessors: [], successors: [] });
      toDeps.predecessors.push(fromRef);
    }
  }
  return built;
}

/** Neighbour ids for the common case: both directions, whole chain. */
function walk(built: SwimlaneModel, id: string, depth = -1) {
  return neighborsOf(built, eventById(built, id), 'all', depth);
}

describe('dependencies', () => {
  it('PR-DEPGRAPH-001: walks successor refs and the mirrored predecessor refs', () => {
    const built = model([ev('a', 0, ['b']), ev('b', 20)]);

    expect(walk(built, 'a').outgoing).toEqual([{ id: 'b', name: 'B', startTime: 20 }]);
    expect(walk(built, 'b').incoming.map((n) => n.id)).toEqual(['a']);
  });

  it('PR-DEPGRAPH-002: drops dangling, self and duplicate refs', () => {
    const built = model([ev('a', 0, ['missing', 'a', 'b', 'b']), ev('b', 20)]);

    expect(walk(built, 'a').outgoing.map((n) => n.id)).toEqual(['b']);
  });

  it('PR-DEPGRAPH-003: mode blanks the suppressed side', () => {
    const built = model([ev('a', 0, ['b']), ev('b', 20, ['c']), ev('c', 40)]);
    const b = eventById(built, 'b');

    expect(neighborsOf(built, b, 'predecessors', -1)).toMatchObject({
      incoming: [{ id: 'a' }],
      outgoing: [],
    });
    expect(neighborsOf(built, b, 'successors', -1)).toMatchObject({
      incoming: [],
      outgoing: [{ id: 'c' }],
    });
  });

  it('PR-DEPGRAPH-004: depth limits hops, normalized like the swimlane curves', () => {
    const built = model([
      ev('a', 0, ['b']),
      ev('b', 20, ['c']),
      ev('c', 40, ['d']),
      ev('d', 60),
    ]);

    expect(walk(built, 'a', 0).outgoing).toEqual([]);
    expect(walk(built, 'a', 1).outgoing.map((n) => n.id)).toEqual(['b']);
    expect(walk(built, 'a', 2).outgoing.map((n) => n.id)).toEqual(['b', 'c']);
    expect(walk(built, 'a', -1).outgoing.map((n) => n.id)).toEqual(['b', 'c', 'd']);
    // normalizeDependencyDepth: anything under -1 clamps to unlimited.
    expect(walk(built, 'a', -7).outgoing.map((n) => n.id)).toEqual(['b', 'c', 'd']);
  });

  it('PR-DEPGRAPH-005: a cycle terminates without returning the start event', () => {
    const built = model([ev('a', 0, ['b']), ev('b', 20, ['c']), ev('c', 40, ['a'])]);

    expect(walk(built, 'a').outgoing.map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('PR-DEPGRAPH-006: hasDependencies gates the capability', () => {
    expect(hasDependencies(model([ev('a', 0), ev('b', 20)]))).toBe(false);
    expect(hasDependencies(model([ev('a', 0)], [ev('b', 20, ['a'])]))).toBe(true);
    expect(hasDependencies(null)).toBe(false);
  });

  it('PR-DEPGRAPH-007: the Chrome Trace adapter reads args.event_id and args.dependencies', () => {
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

    expect(walk(swim, 'task-1').outgoing.map((n) => n.id)).toEqual(['task-2', '7']);
    expect(walk(swim, 'task-2').incoming.map((n) => n.id)).toEqual(['task-1']);
  });

  it('PR-DEPGRAPH-008: a repeated args.event_id keeps the first claimant and falls back', () => {
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
    // The surviving 'dup' event is the first one, not the last writer.
    expect(eventById(swim, 'dup').name).toBe('A');
  });

  it('PR-DEPGRAPH-009: each side is capped at 200 neighbours, earliest first', () => {
    // Chain of 300: an unlimited walk would return all 299 successors, one chip and one
    // connector curve each.
    const chain = Array.from({ length: 300 }, (_, i) =>
      ev(`k${i}`, i * 10, i + 1 < 300 ? [`k${i + 1}`] : undefined),
    );
    const out = walk(model(chain), 'k0').outgoing;

    expect(out).toHaveLength(DEPENDENCY_MAX_NEIGHBORS);
    expect(out[0].id).toBe('k1');
    expect(out.at(-1)?.id).toBe(`k${DEPENDENCY_MAX_NEIGHBORS}`);
  });
});
