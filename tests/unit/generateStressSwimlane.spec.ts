import { describe, expect, it } from 'vitest';
import {
  generateStressSwimlane,
  stressDefaultCollapsedIds,
  stressPresetFromQuery,
  stressSwimlaneStats,
} from '../../src/domain/generateStressSwimlane';
import { collectLeafEventsFromModel, isFolderNode } from '../../src/domain/swimTree';
import type { EventRef, SwimEvent, SwimlaneModel, SwimThread } from '../../src/domain/types';

function firstPipeLeaf(model: ReturnType<typeof generateStressSwimlane>) {
  const compute = model.processes[0]?.threads.find((t) => t.name === '计算');
  expect(compute && isFolderNode(compute)).toBe(true);
  const cube = compute!.children!.find((c) => c.name === 'Core0.Cube');
  expect(cube && isFolderNode(cube)).toBe(true);
  const pipe = cube!.children![0];
  expect(pipe).toBeTruthy();
  expect(isFolderNode(pipe!)).toBe(false);
  return pipe!;
}

function indexThreads(model: SwimlaneModel): Map<string, SwimThread> {
  const map = new Map<string, SwimThread>();
  const walk = (thread: SwimThread) => {
    map.set(thread.id, thread);
    thread.children?.forEach(walk);
  };
  for (const process of model.processes) process.threads.forEach(walk);
  return map;
}

function computeCores(card: SwimlaneModel['processes'][number]): SwimThread[] {
  const compute = card.threads.find((t) => t.name === '计算');
  return compute?.children?.filter(isFolderNode) ?? [];
}

function pipeLeaves(core: SwimThread): SwimThread[] {
  return (core.children ?? []).filter((t) => !isFolderNode(t));
}

function endNs(event: SwimEvent): number {
  return event.startTime + event.duration;
}

function resolve(threads: Map<string, SwimThread>, ref: EventRef): SwimEvent {
  const event = threads.get(ref.tid)?.events[ref.index];
  expect(event).toBeTruthy();
  return event!;
}

function hasRef(list: EventRef[], tid: string, index: number): boolean {
  return list.some((r) => r.tid === tid && r.index === index);
}

describe('PR-STRESS: generateStressSwimlane', () => {
  it('PR-STRESS-001: medium preset reaches Sudu-class event counts', () => {
    const model = generateStressSwimlane({}, 'medium');
    const stats = stressSwimlaneStats(model);
    expect(stats.processCount).toBe(2);
    expect(stats.threadCount).toBe(58); // 54 pipes + 4 spacer leaves (通信/储存HBM × 2)
    expect(stats.eventCount).toBe(324_000);
    expect(model.minTime).toBe(0);
    expect(model.maxTime).toBe(1_000_000_000);
    expect(model.processes[0]?.name).toBe('Card0');
  });

  it('PR-STRESS-002: small preset is deterministic for same seed', () => {
    const a = generateStressSwimlane({ seed: 42 }, 'small');
    const b = generateStressSwimlane({ seed: 42 }, 'small');
    expect(firstPipeLeaf(a).events[0]).toEqual(firstPipeLeaf(b).events[0]);
    expect(stressSwimlaneStats(a).eventCount).toBe(8_502);
  });

  it('PR-STRESS-003: custom options override preset sizes', () => {
    const model = generateStressSwimlane(
      { eventsPerThread: 50, timeSpanNs: 10_000 },
      'medium',
    );
    expect(stressSwimlaneStats(model).eventCount).toBe(54 * 50);
    expect(model.maxTime).toBe(10_000);
  });

  it('PR-STRESS-004: stressPresetFromQuery falls back to medium', () => {
    expect(stressPresetFromQuery('large')).toBe('large');
    expect(stressPresetFromQuery('nope')).toBe('medium');
    expect(stressPresetFromQuery(null)).toBe('medium');
  });

  it('PR-STRESS-005: occupancy leaves gaps when event count exceeds busy budget ns', () => {
    const model = generateStressSwimlane(
      {
        eventsPerThread: 200,
        timeSpanNs: 100,
        occupancy: 0.5,
        seed: 1,
      },
      'small',
    );
    const events = firstPipeLeaf(model).events;
    expect(events.length).toBe(200);
    expect(events[0]!.startTime).toBeGreaterThan(0);
    let gaps = 0;
    for (let i = 1; i < 30; i++) {
      const prev = events[i - 1]!;
      const cur = events[i]!;
      if (cur.startTime > prev.startTime + prev.duration) gaps += 1;
    }
    expect(gaps).toBeGreaterThan(0);
  });

  it('PR-STRESS-006: Card → 通信/计算/储存HBM → Core → pipes tree', () => {
    const model = generateStressSwimlane({}, 'small');
    const card = model.processes[0]!;
    expect(card.name).toBe('Card0');
    const names = card.threads.map((t) => t.name);
    expect(names).toEqual(['通信', '计算', '储存HBM']);
    expect(card.threads[0]!.events).toEqual([]);
    expect(card.threads[2]!.events).toEqual([]);
    expect(isFolderNode(card.threads[1]!)).toBe(true);
    const cores = card.threads[1]!.children!.map((c) => c.name);
    expect(cores).toContain('Core0.Cube');
    expect(cores).toContain('Core0.Vec0');
    const pipes = card.threads[1]!.children!.find((c) => c.name === 'Core0.Cube')!.children!;
    expect(pipes.map((p) => p.name)).toEqual([
      'ALL',
      'SCALAR',
      'FLOWCTRL',
      'MTE1',
      'CUBE',
      'FIXP',
      'MTE2',
      'MTE3',
      'CACHEMISS',
    ]);
    expect(collectLeafEventsFromModel(model).length).toBe(8_502);
  });

  it('PR-STRESS-007: stressDefaultCollapsedIds keeps Card + 计算 + Core0.Cube expanded', () => {
    const model = generateStressSwimlane({}, 'medium');
    const collapsed = new Set(stressDefaultCollapsedIds(model));
    expect(collapsed.has('card0')).toBe(false);
    expect(collapsed.has('card0/compute')).toBe(false);
    expect(collapsed.has('card0/Core0.Cube')).toBe(false);
    expect(collapsed.has('card0/Core0.Vec0')).toBe(true);
    expect(collapsed.has('card0/Core0.Vec1')).toBe(true);
    expect(collapsed.has('card1/Core0.Cube')).toBe(false);
    expect(collapsed.has('card1/Core0.Vec0')).toBe(true);
    expect(Array.isArray(model.metadata?.defaultCollapsedIds)).toBe(true);
  });

  it('PR-STRESS-008: stress emits ProfilerStep bands by preset', () => {
    const small = generateStressSwimlane({ eventsPerThread: 1 }, 'small');
    const medium = generateStressSwimlane({ eventsPerThread: 1 }, 'medium');
    const large = generateStressSwimlane({ eventsPerThread: 1 }, 'large');
    expect(small.bands?.map((b) => b.name)).toEqual([
      'ProfilerStep#1',
      'ProfilerStep#2',
      'ProfilerStep#3',
    ]);
    expect(medium.bands).toHaveLength(5);
    expect(large.bands).toHaveLength(8);
    expect(medium.bands![0]!.startTime).toBe(0);
    const last = medium.bands![medium.bands!.length - 1]!;
    expect(last.startTime + last.duration).toBe(medium.maxTime);
  });

  it('PR-STRESS-009: same-core deps are bidirectional and time-ordered', () => {
    const model = generateStressSwimlane(
      { eventsPerThread: 16, timeSpanNs: 2_000, occupancy: 0.6, seed: 7 },
      'small',
    );
    const threads = indexThreads(model);

    let linked = 0;
    for (const card of model.processes) {
      for (const core of computeCores(card)) {
        const prefix = `${core.id}/`;
        for (const pipe of pipeLeaves(core)) {
          pipe.events.forEach((event, index) => {
            const deps = event.dependencies;
            expect(deps).toBeTruthy();
            for (const ref of [...deps!.predecessors, ...deps!.successors]) {
              expect(ref.tid.startsWith(prefix)).toBe(true);
            }
            for (const succRef of deps!.successors) {
              const succ = resolve(threads, succRef);
              expect(endNs(event)).toBeLessThanOrEqual(succ.startTime);
              expect(hasRef(succ.dependencies?.predecessors ?? [], pipe.id, index)).toBe(true);
              linked += 1;
            }
            for (const predRef of deps!.predecessors) {
              const pred = resolve(threads, predRef);
              expect(endNs(pred)).toBeLessThanOrEqual(event.startTime);
              expect(hasRef(pred.dependencies?.successors ?? [], pipe.id, index)).toBe(true);
            }
          });
        }
      }
    }
    expect(linked).toBeGreaterThan(0);
  });

  it('PR-STRESS-010: every pipe event has nearest pred/succ per core pipe', () => {
    const model = generateStressSwimlane(
      { eventsPerThread: 16, timeSpanNs: 2_000, occupancy: 0.6, seed: 7 },
      'small',
    );
    for (const card of model.processes) {
      for (const core of computeCores(card)) {
        const pipes = pipeLeaves(core);
        for (const pipe of pipes) {
          for (const event of pipe.events) {
            expect(event.dependencies).toEqual(
              expect.objectContaining({ predecessors: expect.any(Array), successors: expect.any(Array) }),
            );
            for (const other of pipes) {
              let nearestSucc = -1;
              let nearestSuccStart = Infinity;
              let nearestPred = -1;
              let nearestPredEnd = -Infinity;
              other.events.forEach((candidate, index) => {
                if (candidate === event) return;
                if (candidate.startTime >= endNs(event)) {
                  const betterStart = candidate.startTime < nearestSuccStart;
                  const betterId =
                    candidate.startTime === nearestSuccStart &&
                    nearestSucc >= 0 &&
                    candidate.id < other.events[nearestSucc]!.id;
                  if (betterStart || betterId) {
                    nearestSuccStart = candidate.startTime;
                    nearestSucc = index;
                  }
                }
                const candEnd = endNs(candidate);
                if (candEnd <= event.startTime && (candEnd > nearestPredEnd || (candEnd === nearestPredEnd && index > nearestPred))) {
                  nearestPredEnd = candEnd;
                  nearestPred = index;
                }
              });
              if (nearestSucc >= 0) {
                expect(hasRef(event.dependencies!.successors, other.id, nearestSucc)).toBe(true);
              }
              if (nearestPred >= 0) {
                expect(hasRef(event.dependencies!.predecessors, other.id, nearestPred)).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});
