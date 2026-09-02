import type { EventDependencies, EventRef, SwimEvent, SwimlaneBand, SwimlaneModel, SwimProcess, SwimThread } from './types';
import {
  collectLeafEventsFromModel,
  countLeafThreads,
  isComputeCategory,
  isFolderNode,
} from './swimTree';

/** Sketch pipe children under each Core. */
export const STRESS_PIPE_NAMES = [
  'ALL',
  'SCALAR',
  'FLOWCTRL',
  'MTE1',
  'CUBE',
  'FIXP',
  'MTE2',
  'MTE3',
  'CACHEMISS',
] as const;

/** Thinner Vec0 pipe set for small preset. */
const SMALL_VEC_PIPES = ['ALL', 'SCALAR', 'MTE2', 'MTE3'] as const;

export type StressSwimlanePreset = 'small' | 'medium' | 'large';

export interface StressSwimlaneOptions {
  /** Override events per pipe leaf. */
  eventsPerThread?: number;
  /** Timeline length in ns. Default 1e9 (1 s). */
  timeSpanNs?: number;
  /** PRNG seed for reproducible layouts. Default 1. */
  seed?: number;
  /** Fraction of timeline covered by busy intervals (0–1). Default 0.65. */
  occupancy?: number;
  /**
   * Same-core nearest pred/succ wiring. Default on for `small`, off for
   * `medium`/`large` (all-pairs refs blow up heap and generate time).
   */
  linkDependencies?: boolean;
}

export interface StressSwimlaneStats {
  processCount: number;
  threadCount: number;
  eventCount: number;
  timeSpanNs: number;
  seed: number;
}

type ShapeSpec = {
  cards: number;
  /** Per card: list of core names and which pipe set they use. */
  cores: { name: string; pipes: readonly string[] }[];
  eventsPerPipe: number;
};

const PRESETS: Record<StressSwimlanePreset, ShapeSpec & { bandCount: number }> = {
  /** 1 Card × (9 Cube + 4 Vec0) × 654 = 8_502 */
  small: {
    cards: 1,
    cores: [
      { name: 'Core0.Cube', pipes: STRESS_PIPE_NAMES },
      { name: 'Core0.Vec0', pipes: SMALL_VEC_PIPES },
    ],
    /** 13 leaves × 654 = 8_502 (CI-friendly ~8.5k). */
    eventsPerPipe: 654,
    bandCount: 3,
  },
  /** 2 × 3 × 9 × 6000 = 324_000 */
  medium: {
    cards: 2,
    cores: [
      { name: 'Core0.Cube', pipes: STRESS_PIPE_NAMES },
      { name: 'Core0.Vec0', pipes: STRESS_PIPE_NAMES },
      { name: 'Core0.Vec1', pipes: STRESS_PIPE_NAMES },
    ],
    eventsPerPipe: 6_000,
    bandCount: 5,
  },
  /** 2 × 6 × 9 × 6667 = 720_036 */
  large: {
    cards: 2,
    cores: [
      { name: 'Core0.Cube', pipes: STRESS_PIPE_NAMES },
      { name: 'Core0.Vec0', pipes: STRESS_PIPE_NAMES },
      { name: 'Core1.Cube', pipes: STRESS_PIPE_NAMES },
      { name: 'Core1.Vec0', pipes: STRESS_PIPE_NAMES },
      { name: 'Core2.Cube', pipes: STRESS_PIPE_NAMES },
      { name: 'Core2.Vec0', pipes: STRESS_PIPE_NAMES },
    ],
    eventsPerPipe: 6_667,
    bandCount: 8,
  },
};

/** Mulberry32 — fast deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildThreadEvents(
  threadId: string,
  count: number,
  timeSpanNs: number,
  occupancy: number,
  rand: () => number,
): SwimEvent[] {
  const events: SwimEvent[] = [];
  if (count <= 0 || timeSpanNs <= 0) return events;

  const occ = Math.min(1, Math.max(0, occupancy));
  const busyBudget = timeSpanNs * occ;
  const avgBusy = Math.max(1, busyBudget / count);
  const gapBudget = Math.max(0, timeSpanNs - busyBudget);
  const avgGap = gapBudget / count;

  let t = 0;
  for (let i = 0; i < count; i++) {
    const gap = avgGap * (0.2 + 1.6 * rand());
    t += gap;
    const scale = rand() * rand();
    let duration = Math.max(1, Math.floor(avgBusy * (0.15 + 1.7 * scale)));
    if (t >= timeSpanNs) {
      t = Math.floor(rand() * Math.max(1, timeSpanNs - 2));
      duration = Math.max(1, Math.floor(1 + rand() * Math.min(avgBusy, timeSpanNs - t)));
    } else if (t + duration > timeSpanNs) {
      duration = Math.max(1, timeSpanNs - t);
    }

    events.push({
      id: `${threadId}-e${i}`,
      name: duration < avgBusy * 0.35 ? `marker_${i}` : `busy_${i}`,
      startTime: t,
      duration,
    });
    t += duration;
  }

  return events;
}

function utilFromEvents(events: SwimEvent[], timeSpanNs: number): number {
  if (timeSpanNs <= 0) return 0;
  const busy = events.reduce((s, e) => s + e.duration, 0);
  return Math.min(1, busy / timeSpanNs);
}

function synthUtil(rand: () => number, bias = 0.55): number {
  return Math.min(1, Math.max(0.05, bias + (rand() - 0.5) * 0.7));
}

function makePipeLeaves(
  cardId: string,
  coreName: string,
  pipes: readonly string[],
  eventsPerPipe: number,
  timeSpanNs: number,
  occupancy: number,
  rand: () => number,
): SwimThread[] {
  return pipes.map((pipe) => {
    const id = `${cardId}/${coreName}/${pipe}`;
    const events = buildThreadEvents(id, eventsPerPipe, timeSpanNs, occupancy, rand);
    return {
      id,
      name: pipe,
      utilization: utilFromEvents(events, timeSpanNs),
      events,
    };
  });
}

function buildCard(
  cardIndex: number,
  shape: ShapeSpec,
  eventsPerPipe: number,
  timeSpanNs: number,
  occupancy: number,
  rand: () => number,
): SwimProcess {
  const cardId = `card${cardIndex}`;
  const cores: SwimThread[] = shape.cores.map((core) => ({
    id: `${cardId}/${core.name}`,
    name: core.name,
    utilization: synthUtil(rand, 0.75),
    events: [],
    children: makePipeLeaves(
      cardId,
      core.name,
      core.pipes,
      eventsPerPipe,
      timeSpanNs,
      occupancy,
      rand,
    ),
  }));

  const compute: SwimThread = {
    id: `${cardId}/compute`,
    name: '计算',
    categoryKey: 'compute',
    utilization: synthUtil(rand, 0.9),
    events: [],
    children: cores,
  };

  return {
    id: cardId,
    name: `Card${cardIndex}`,
    threads: [
      {
        id: `${cardId}/comm`,
        name: '通信',
        categoryKey: 'comm',
        utilization: synthUtil(rand, 0.95),
        events: [],
      },
      compute,
      {
        id: `${cardId}/hbm`,
        name: '储存HBM',
        categoryKey: 'hbm',
        utilization: synthUtil(rand, 0.45),
        events: [],
      },
    ],
  };
}

function endNs(event: SwimEvent): number {
  return event.startTime + event.duration;
}

function ensureDeps(event: SwimEvent): EventDependencies {
  let deps = event.dependencies;
  if (!deps) {
    deps = { predecessors: [], successors: [] };
    event.dependencies = deps;
  }
  return deps;
}

function pushRef(list: EventRef[], seen: Set<string>, ref: EventRef): void {
  const key = `${ref.tid}:${ref.index}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(ref);
}

function seenSet(map: Map<SwimEvent, Set<string>>, event: SwimEvent): Set<string> {
  let keys = map.get(event);
  if (!keys) {
    keys = new Set();
    map.set(event, keys);
  }
  return keys;
}

function linkPair(
  pred: SwimEvent,
  predTid: string,
  predIndex: number,
  succ: SwimEvent,
  succTid: string,
  succIndex: number,
  seenSucc: Map<SwimEvent, Set<string>>,
  seenPred: Map<SwimEvent, Set<string>>,
): void {
  if (pred === succ) return;
  if (endNs(pred) > succ.startTime) return;
  pushRef(ensureDeps(pred).successors, seenSet(seenSucc, pred), { tid: succTid, index: succIndex });
  pushRef(ensureDeps(succ).predecessors, seenSet(seenPred, succ), { tid: predTid, index: predIndex });
}

function orderByStart(events: SwimEvent[]): number[] {
  return events
    .map((_, index) => index)
    .sort((i, j) => {
      const a = events[i]!;
      const b = events[j]!;
      return a.startTime - b.startTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
}

function orderByEnd(events: SwimEvent[]): number[] {
  return events
    .map((_, index) => index)
    .sort((i, j) => endNs(events[i]!) - endNs(events[j]!) || i - j);
}

/**
 * Same-core pipe leaves only. Each event links to the nearest valid predecessor
 * and successor on every pipe in the core (including its own thread).
 */
function wireCorePipeDependencies(core: SwimThread): void {
  const pipes = (core.children ?? []).filter((t) => !isFolderNode(t) && t.events.length > 0);
  if (pipes.length === 0) return;
  const byStart = pipes.map((p) => orderByStart(p.events));
  const byEnd = pipes.map((p) => orderByEnd(p.events));
  const seenSucc = new Map<SwimEvent, Set<string>>();
  const seenPred = new Map<SwimEvent, Set<string>>();
  for (let a = 0; a < pipes.length; a++) {
    const eventsA = pipes[a]!.events;
    const tidA = pipes[a]!.id;
    const startA = byStart[a]!;
    const endA = byEnd[a]!;
    for (const event of eventsA) ensureDeps(event);
    for (let b = 0; b < pipes.length; b++) {
      const eventsB = pipes[b]!.events;
      const tidB = pipes[b]!.id;
      const startB = byStart[b]!;
      const endB = byEnd[b]!;
      let succPtr = 0;
      for (let k = 0; k < endA.length; k++) {
        const i = endA[k]!;
        const event = eventsA[i]!;
        const end = endNs(event);
        while (succPtr < startB.length && eventsB[startB[succPtr]!]!.startTime < end) succPtr += 1;
        if (succPtr >= startB.length) break;
        const succAt = startB[succPtr]!;
        linkPair(event, tidA, i, eventsB[succAt]!, tidB, succAt, seenSucc, seenPred);
      }
      let endPtr = 0;
      for (let k = 0; k < startA.length; k++) {
        const i = startA[k]!;
        const event = eventsA[i]!;
        while (endPtr < endB.length && endNs(eventsB[endB[endPtr]!]!) <= event.startTime) endPtr += 1;
        if (endPtr === 0) continue;
        const predAt = endB[endPtr - 1]!;
        linkPair(eventsB[predAt]!, tidB, predAt, event, tidA, i, seenSucc, seenPred);
      }
    }
  }
}

function wireCardCoreDependencies(card: SwimProcess): void {
  const compute = card.threads.find((t) => isComputeCategory(t) && isFolderNode(t));
  if (!compute?.children) return;
  for (const core of compute.children) {
    if (isFolderNode(core)) wireCorePipeDependencies(core);
  }
}

/**
 * Contiguous ProfilerStep slabs covering [0, timeSpanNs). Deterministic (no PRNG).
 */
function buildProfilerStepBands(count: number, timeSpanNs: number): SwimlaneBand[] {
  if (count <= 0 || timeSpanNs <= 0) return [];
  const bands: SwimlaneBand[] = [];
  const step = Math.floor(timeSpanNs / count);
  for (let i = 0; i < count; i++) {
    const startTime = i * step;
    const end = i === count - 1 ? timeSpanNs : (i + 1) * step;
    bands.push({
      id: `band-step-${i + 1}`,
      name: `ProfilerStep#${i + 1}`,
      startTime,
      duration: Math.max(1, end - startTime),
    });
  }
  return bands;
}

/**
 * Ids to collapse so first paint matches sketches:
 * Card open, 计算 open, Core0.Cube open; other Cores collapsed.
 */
export function stressDefaultCollapsedIds(model: SwimlaneModel): string[] {
  const collapsed: string[] = [];
  for (const card of model.processes) {
    const compute = card.threads.find((t) => isComputeCategory(t) && isFolderNode(t));
    if (!compute?.children) continue;
    for (const core of compute.children) {
      if (core.name !== 'Core0.Cube' && isFolderNode(core)) {
        collapsed.push(core.id);
      }
    }
  }
  return collapsed;
}

/**
 * Synthetic Card → category → Core → pipe swimlane for playground stress / A/B.
 */
export function generateStressSwimlane(
  options: StressSwimlaneOptions = {},
  preset: StressSwimlanePreset = 'medium',
): SwimlaneModel {
  const shape = PRESETS[preset];
  const timeSpanNs = options.timeSpanNs ?? 1_000_000_000;
  const seed = options.seed ?? 1;
  const occupancy = options.occupancy ?? 0.65;
  const eventsPerPipe = options.eventsPerThread ?? shape.eventsPerPipe;
  const rand = mulberry32(seed);
  const linkDependencies = options.linkDependencies ?? preset === 'small';

  const processes: SwimProcess[] = [];
  for (let c = 0; c < shape.cards; c++) {
    processes.push(buildCard(c, shape, eventsPerPipe, timeSpanNs, occupancy, rand));
  }
  if (linkDependencies) {
    for (const card of processes) wireCardCoreDependencies(card);
  }

  const model: SwimlaneModel = {
    processes,
    minTime: 0,
    maxTime: timeSpanNs,
    bands: buildProfilerStepBands(shape.bandCount, timeSpanNs),
    metadata: {
      synthetic: true,
      stress: true,
      preset,
      seed,
      cardCount: shape.cards,
    },
  };
  model.metadata!.defaultCollapsedIds = stressDefaultCollapsedIds(model);
  return model;
}

export function stressSwimlaneStats(model: SwimlaneModel): StressSwimlaneStats {
  const events = collectLeafEventsFromModel(model);
  let threadCount = 0;
  for (const p of model.processes) threadCount += countLeafThreads(p.threads);
  return {
    processCount: model.processes.length,
    threadCount,
    eventCount: events.length,
    timeSpanNs: model.maxTime - model.minTime,
    seed: Number(model.metadata?.seed ?? 0),
  };
}

export function stressPresetFromQuery(value: string | null): StressSwimlanePreset {
  if (value === 'small' || value === 'medium' || value === 'large') return value;
  return 'medium';
}
