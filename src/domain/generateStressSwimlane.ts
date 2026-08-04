import type { SwimEvent, SwimlaneModel, SwimProcess, SwimThread } from './types';

/** Pipe-like lane names so stress colors match real OP traces. */
export const STRESS_PIPE_NAMES = [
  'PIPE_V/status',
  'PIPE_S/status',
  'MTE1/status',
  'MTE2/status',
  'MTE3/status',
  'CUBE/status',
  'FIXP/status',
  'SCALAR/status',
] as const;

export type StressSwimlanePreset = 'small' | 'medium' | 'large';

export interface StressSwimlaneOptions {
  /** Number of process groups (cores). Default 4. */
  processCount?: number;
  /** Threads (lanes) per process. Default 8 (pipe set). */
  threadsPerProcess?: number;
  /** Events generated per thread. Default depends on preset / 10_000. */
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

const PRESETS: Record<StressSwimlanePreset, Required<Pick<
  StressSwimlaneOptions,
  'processCount' | 'threadsPerProcess' | 'eventsPerThread'
>>> = {
  /** ~8k events — sanity check / CI-friendly. */
  small: { processCount: 2, threadsPerProcess: 4, eventsPerThread: 1_000 },
  /** Sudu-class: tens of lanes × ~10k (default stress). */
  medium: { processCount: 4, threadsPerProcess: 8, eventsPerThread: 10_000 },
  /** Heavy: ~720k intervals. */
  large: { processCount: 6, threadsPerProcess: 8, eventsPerThread: 15_000 },
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

function resolveOptions(
  options: StressSwimlaneOptions = {},
  preset: StressSwimlanePreset = 'medium',
): Required<StressSwimlaneOptions> {
  const base = PRESETS[preset];
  return {
    processCount: options.processCount ?? base.processCount,
    threadsPerProcess: options.threadsPerProcess ?? base.threadsPerProcess,
    eventsPerThread: options.eventsPerThread ?? base.eventsPerThread,
    timeSpanNs: options.timeSpanNs ?? 1_000_000_000,
    seed: options.seed ?? 1,
    occupancy: options.occupancy ?? 0.65,
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

  const busyBudget = Math.max(count, timeSpanNs * Math.min(1, Math.max(0, occupancy)));
  const avgBusy = busyBudget / count;
  const gapBudget = Math.max(0, timeSpanNs - busyBudget);
  const avgGap = gapBudget / count;

  let t = 0;
  for (let i = 0; i < count; i++) {
    const gap = avgGap * (0.2 + 1.6 * rand());
    t += gap;
    // Mix short markers and longer busy bars (log-ish via squared rand).
    const scale = rand() * rand();
    let duration = Math.max(1, Math.floor(avgBusy * (0.15 + 1.7 * scale)));
    if (t >= timeSpanNs) {
      // Wrap remaining events into overlapping short markers near the end.
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

/**
 * Synthetic dense swimlane model for renderer stress / Canvas vs WebGL A/B.
 * Scale is Sudu-demo-like by default (medium ≈ 4×8×10k intervals).
 */
export function generateStressSwimlane(
  options: StressSwimlaneOptions = {},
  preset: StressSwimlanePreset = 'medium',
): SwimlaneModel {
  const opts = resolveOptions(options, preset);
  const rand = mulberry32(opts.seed);
  const processes: SwimProcess[] = [];

  for (let p = 0; p < opts.processCount; p++) {
    const threads: SwimThread[] = [];
    for (let th = 0; th < opts.threadsPerProcess; th++) {
      const pipe = STRESS_PIPE_NAMES[th % STRESS_PIPE_NAMES.length]!;
      const threadId = `p${p}-t${th}`;
      const events = buildThreadEvents(
        threadId,
        opts.eventsPerThread,
        opts.timeSpanNs,
        opts.occupancy,
        rand,
      );
      const busy = events.reduce((s, e) => s + e.duration, 0);
      threads.push({
        id: threadId,
        name: `AIV${p}/${pipe}`,
        utilization: Math.min(1, busy / opts.timeSpanNs),
        events,
      });
    }
    processes.push({
      id: `p${p}`,
      name: `Kernel / AIV${p}`,
      threads,
    });
  }

  return {
    processes,
    minTime: 0,
    maxTime: opts.timeSpanNs,
    metadata: {
      synthetic: true,
      stress: true,
      preset,
      seed: opts.seed,
      processCount: opts.processCount,
      threadsPerProcess: opts.threadsPerProcess,
      eventsPerThread: opts.eventsPerThread,
    },
  };
}

export function stressSwimlaneStats(model: SwimlaneModel): StressSwimlaneStats {
  let threadCount = 0;
  let eventCount = 0;
  for (const p of model.processes) {
    threadCount += p.threads.length;
    for (const t of p.threads) eventCount += t.events.length;
  }
  return {
    processCount: model.processes.length,
    threadCount,
    eventCount,
    timeSpanNs: model.maxTime - model.minTime,
    seed: typeof model.metadata?.seed === 'number' ? model.metadata.seed : 0,
  };
}

export function stressPresetFromQuery(value: string | null): StressSwimlanePreset {
  if (value === 'small' || value === 'large' || value === 'medium') return value;
  return 'medium';
}
