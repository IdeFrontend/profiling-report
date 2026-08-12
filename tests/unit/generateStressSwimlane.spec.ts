import { describe, expect, it } from 'vitest';
import {
  generateStressSwimlane,
  stressDefaultCollapsedIds,
  stressPresetFromQuery,
  stressSwimlaneStats,
} from '../../src/domain/generateStressSwimlane';
import { collectLeafEventsFromModel, isFolderNode } from '../../src/domain/swimTree';

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
    const small = generateStressSwimlane({}, 'small');
    const medium = generateStressSwimlane({}, 'medium');
    const large = generateStressSwimlane({}, 'large');
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
});
