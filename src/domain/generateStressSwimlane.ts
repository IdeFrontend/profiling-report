import type { SwimEvent, SwimlaneBand, SwimlaneModel, SwimProcess, SwimThread } from './types';
import { collectLeafEventsFromModel, countLeafThreads, isFolderNode } from './swimTree';

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
function mulberry32(seed: number): () => number {
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
        utilization: synthUtil(rand, 0.95),
        events: [],
      },
      compute,
      {
        id: `${cardId}/hbm`,
        name: '储存HBM',
        utilization: synthUtil(rand, 0.45),
        events: [],
      },
    ],
  };
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
    const compute = card.threads.find((t) => t.name === '计算' && isFolderNode(t));
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

  const processes: SwimProcess[] = [];
  for (let c = 0; c < shape.cards; c++) {
    processes.push(buildCard(c, shape, eventsPerPipe, timeSpanNs, occupancy, rand));
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
