import type { PipeOccupancyItem, SwimlaneModel } from '../domain/types';
import { laneColorKey } from '../domain/laneColors';

/**
 * Attach PipeUtilization ratios onto matching lanes (METRICS_AND_TRACE).
 * When both Cube and Vector sides contribute the same colorKey, use their mean.
 */
export function withPipeLaneUtilizations(
  model: SwimlaneModel,
  pipes: PipeOccupancyItem[],
): SwimlaneModel {
  if (pipes.length === 0) return model;
  const collected = new Map<string, number[]>();
  for (const p of pipes) {
    if (p.id === 'icache' || p.colorKey === 'default') continue;
    const list = collected.get(p.colorKey) ?? [];
    list.push(p.ratio);
    collected.set(p.colorKey, list);
  }
  const byKey = new Map<string, number>();
  for (const [key, vals] of collected) {
    byKey.set(key, vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return {
    ...model,
    processes: model.processes.map((p) => ({
      ...p,
      threads: p.threads.map((t) => {
        const key = laneColorKey(t.name);
        if (key === 'default') return t;
        const ratio = byKey.get(key);
        if (ratio == null) return t;
        return { ...t, utilization: ratio };
      }),
    })),
  };
}
