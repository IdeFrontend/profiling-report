/**
 * Deterministic op2 trace for sample.lite.rep (canonical op2 generator; Python big_trace removed).
 * Playground/test fixture only — not library product logic.
 * Committed sample.lite.rep omits this blob; hydrate before loadReportSource.
 */
import { mulberry32 } from '../src/domain/generateStressSwimlane';

const STRESS_PIPES = [
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

const STRESS_CORES = ['Core0.Cube', 'Core0.Vec0', 'Core0.Vec1'] as const;

/** ponytail: cap successor scan — O(n×window) not O(n²) at ~25k events/core */
const DEP_CAND_WINDOW = 48;

const PIPE_PROFILE: Record<
  (typeof STRESS_PIPES)[number],
  { occupancy: number; avg_busy: number; avg_gap: number; names: string[] }
> = {
  ALL: { occupancy: 0.15, avg_busy: 800, avg_gap: 4000, names: ['ALL_busy'] },
  SCALAR: { occupancy: 0.25, avg_busy: 400, avg_gap: 1200, names: ['SCALAR_busy'] },
  FLOWCTRL: { occupancy: 0.08, avg_busy: 200, avg_gap: 6000, names: ['FLOWCTRL_busy'] },
  MTE1: { occupancy: 0.45, avg_busy: 2200, avg_gap: 1800, names: ['MOV_IN_L1', 'MTE1_busy'] },
  CUBE: { occupancy: 0.55, avg_busy: 3500, avg_gap: 1500, names: ['matmul', 'CUBE_busy'] },
  FIXP: { occupancy: 0.3, avg_busy: 900, avg_gap: 2200, names: ['FIX_LOC_TO_DST', 'FIXP_busy'] },
  MTE2: { occupancy: 0.7, avg_busy: 5000, avg_gap: 800, names: ['MOV_OUT_TO_L1', 'MTE2_busy'] },
  MTE3: { occupancy: 0.4, avg_busy: 1800, avg_gap: 2000, names: ['MOV_OUT', 'MTE3_busy'] },
  CACHEMISS: { occupancy: 0.12, avg_busy: 60, avg_gap: 3500, names: ['CACHEMISS'] },
};

type Rand = () => number;

type LaneEvent = [string, number, number, TraceEvent];

interface TraceEvent {
  ph: string;
  pid: number;
  tid: number;
  name: string;
  ts?: number;
  dur?: number;
  args?: Record<string, unknown>;
}

function mProcess(pid: number, name: string): TraceEvent {
  return { ph: 'M', name: 'process_name', pid, tid: 0, args: { name } };
}

function mThread(pid: number, tid: number, name: string): TraceEvent {
  return { ph: 'M', name: 'thread_name', pid, tid, args: { name } };
}

function xEvent(
  pid: number,
  tid: number,
  name: string,
  ts: number,
  dur: number,
  eventId: string,
  extra: Record<string, unknown>,
): TraceEvent {
  return {
    ph: 'X',
    pid,
    tid,
    name,
    ts: Math.trunc(ts),
    dur: Math.trunc(dur),
    args: { event_id: eventId, ...extra },
  };
}

function pickName(names: string[], rand: Rand): string {
  if (names.length === 1) return names[0]!;
  return rand() < 0.7 ? names[0]! : names[1]!;
}

function producerParams(
  pipe: string,
  name: string,
  rand: Rand,
  seq: number,
  dur: number,
): Record<string, unknown> {
  const pc = 0xf0010000 + ((seq * 0x20) & 0xffff) + (pipe.split('').reduce((s, c) => s + c.charCodeAt(0), 0) & 0xff);
  const nbytes = Math.max(16, dur > 1 ? Math.trunc(dur) : 16 + Math.trunc(rand() * 480));
  const lo = Math.trunc(rand() * 200);
  const hi = lo + Math.max(8, Math.trunc(rand() * 128));
  const detailByPipe: Record<string, string> = {
    SCALAR: `S[${lo}:${hi}]`,
    FLOWCTRL: `FC[${lo}]`,
    MTE1: `L1[${lo}:${hi}]`,
    MTE2: `GM>L1[${lo}:${hi}]`,
    MTE3: `UB>GM[${lo}:${hi}]`,
    CUBE: `L0[${lo}:${hi}]`,
    FIXP: `FIX[${lo}:${hi}]`,
    ALL: `ALL[${lo}:${hi}]`,
    CACHEMISS: `I$@${pc.toString(16)}`,
  };
  return {
    op_type: name.startsWith('marker_') ? pipe : name,
    Pc_addr: `0x${pc.toString(16).padStart(8, '0')}`,
    Process_bytes: nbytes,
    Detail: detailByPipe[pipe] ?? `${pipe}[${lo}:${hi}]`,
  };
}

function profilerStepBands(count: number, timeSpan: number) {
  if (count <= 0 || timeSpan <= 0) return [];
  const step = Math.trunc(timeSpan / count);
  const bands = [];
  for (let i = 0; i < count; i++) {
    const start = i * step;
    const end = i === count - 1 ? timeSpan : (i + 1) * step;
    bands.push({
      id: `band-step-${i + 1}`,
      name: `ProfilerStep#${i + 1}`,
      ts: start,
      dur: Math.max(1, end - start),
    });
  }
  return bands;
}

function emitCountLane(
  pid: number,
  tid: number,
  pipe: (typeof STRESS_PIPES)[number],
  count: number,
  timeSpan: number,
  rand: Rand,
  idPrefix: string,
  occupancy: number,
): LaneEvent[] {
  const profile = PIPE_PROFILE[pipe];
  const events: LaneEvent[] = [];
  if (count <= 0 || timeSpan <= 0) return events;

  const occ = Math.min(1, Math.max(0, occupancy));
  const busyBudget = timeSpan * occ;
  const avgBusy = Math.max(1, busyBudget / count);
  const avgGap = Math.max(0, (timeSpan - busyBudget) / count);
  let t = Math.trunc(rand() * avgGap * 0.5);

  for (let i = 0; i < count; i++) {
    t += Math.trunc(avgGap * (0.2 + 1.6 * rand()));
    const scale = rand() * rand();
    let dur = Math.max(1, Math.trunc(avgBusy * (0.15 + 1.7 * scale)));
    if (t >= timeSpan) {
      t = Math.trunc(rand() * Math.max(1, timeSpan - 2));
      dur = Math.max(1, Math.trunc(1 + rand() * Math.min(avgBusy, timeSpan - t)));
    } else if (t + dur > timeSpan) {
      dur = Math.max(1, timeSpan - t);
    }

    const isMarker = (pipe === 'SCALAR' || pipe === 'CACHEMISS') && rand() < 0.2;
    let name: string;
    if (isMarker) {
      dur = 1;
      name = `marker_${i}`;
    } else {
      name = pickName(profile.names, rand);
    }

    const eid = `${idPrefix}:${i}`;
    const ev = xEvent(pid, tid, name, t, dur, eid, producerParams(pipe, name, rand, i, dur));
    events.push([eid, t, t + dur, ev]);
    t += dur;
  }
  return events;
}

function wireDenseDeps(
  laneEvents: Record<string, LaneEvent[]>,
  rand: Rand,
  minDeg = 1,
  maxDeg = 4,
): void {
  type FlatRow = [string, number, number, TraceEvent, string];
  const flat: FlatRow[] = [];
  for (const [pipe, items] of Object.entries(laneEvents)) {
    for (const row of items) flat.push([row[0], row[1], row[2], row[3], pipe]);
  }
  flat.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0].localeCompare(b[0]));

  const neighbors = new Map<string, Set<string>>();
  const evById = new Map<string, TraceEvent>();
  for (const [eid, , , ev] of flat) {
    neighbors.set(eid, new Set());
    evById.set(eid, ev);
  }

  const addEdge = (srcEid: string, dstEid: string, force = false): boolean => {
    if (srcEid === dstEid) return false;
    const srcN = neighbors.get(srcEid)!;
    const dstN = neighbors.get(dstEid)!;
    if (!force && (srcN.size >= maxDeg || dstN.size >= maxDeg)) return false;
    const hard = maxDeg + 2;
    if (force && (srcN.size >= hard || dstN.size >= hard)) return false;
    const srcEv = evById.get(srcEid)!;
    const args = (srcEv.args ??= {}) as Record<string, unknown>;
    const deps = (args.dependencies ??= []) as string[];
    if (deps.includes(dstEid)) return false;
    deps.push(dstEid);
    srcN.add(dstEid);
    dstN.add(srcEid);
    return true;
  };

  for (let i = 0; i < flat.length; i++) {
    const [eid, , end, , pipe] = flat[i]!;
    const span = maxDeg - minDeg + 1;
    let target = minDeg + Math.trunc(span / 2) + Math.trunc(rand() * ((span + 1) / 2));
    target = Math.max(minDeg, Math.min(maxDeg, target));

    const cands: Array<[number, string, string]> = [];
    for (let j = i + 1; j < flat.length && j <= i + DEP_CAND_WINDOW; j++) {
      const row = flat[j]!;
      if (row[1] >= end && neighbors.get(row[0])!.size < maxDeg) {
        cands.push([j, row[0], row[4]]);
      }
    }
    const cross = cands.filter((c) => c[2] !== pipe);
    const pool = [...(cross.length >= minDeg ? cross : cands)];
    let need = target - neighbors.get(eid)!.size;
    while (need > 0 && pool.length > 0 && neighbors.get(eid)!.size < maxDeg) {
      const window = Math.min(12, pool.length);
      const pick = Math.trunc(rand() * window);
      const [, dst] = pool.splice(pick, 1)[0]!;
      if (addEdge(eid, dst)) need -= 1;
    }
  }

  for (let i = 0; i < flat.length; i++) {
    const [eid, start, end] = flat[i]!;
    let attempts = 0;
    while (neighbors.get(eid)!.size < minDeg && attempts < 64) {
      attempts += 1;
      const later: string[] = [];
      for (let j = i + 1; j < flat.length && j <= i + DEP_CAND_WINDOW; j++) {
        const row = flat[j]!;
        if (!neighbors.get(eid)!.has(row[0]) && row[1] >= end) later.push(row[0]);
      }
      if (later.length > 0) {
        if (addEdge(eid, later[Math.trunc(rand() * Math.min(8, later.length))]!, true)) continue;
      }
      const earlier: string[] = [];
      for (let j = Math.max(0, i - DEP_CAND_WINDOW); j < i; j++) {
        const row = flat[j]!;
        if (!neighbors.get(eid)!.has(row[0]) && row[2] <= start) earlier.push(row[0]);
      }
      if (earlier.length === 0) break;
      addEdge(earlier[Math.trunc(rand() * Math.min(8, earlier.length))]!, eid, true);
    }
  }

  for (let i = 0; i < flat.length; i++) {
    const [eid] = flat[i]!;
    if (neighbors.get(eid)!.size >= minDeg) continue;
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= flat.length) continue;
      const other = flat[j]![0];
      if (!neighbors.get(eid)!.has(other)) {
        addEdge(j < i ? other : eid, j < i ? eid : other, true);
      }
      if (neighbors.get(eid)!.size >= minDeg) break;
    }
  }
}

/** ~150k X events, 5 ProfilerStep bands, nestCardTree — pinned by generateSampleOp2Trace.spec.ts sha256. */
export function generateSampleOp2Trace(): Record<string, unknown> {
  const rand = mulberry32(0xbeef01);
  const laneCount = 2 * STRESS_CORES.length * STRESS_PIPES.length;
  const targetEvents = 150_000;
  let eventsPerLane = Math.trunc(targetEvents / laneCount);
  while (eventsPerLane * laneCount < targetEvents) eventsPerLane += 1;

  const timeSpan = 1_000_000_000;
  const evs: TraceEvent[] = [];
  const coreLanes = new Map<string, Record<string, LaneEvent[]>>();

  for (let card = 0; card < 2; card++) {
    const pid = card + 1;
    evs.push(mProcess(pid, `Card${card}`));
    let tid = 1000 + card * 100;
    for (const core of STRESS_CORES) {
      const pipeMap: Record<string, LaneEvent[]> = {};
      for (const pipe of STRESS_PIPES) {
        evs.push(mThread(pid, tid, `${core}/${pipe}`));
        const laneSeed =
          (pid * 10_000 + tid * 17 + pipe.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) >>> 0;
        const laneRand = mulberry32(laneSeed);
        const occ = Math.min(0.9, 0.45 + 0.4 * PIPE_PROFILE[pipe].occupancy);
        const emitted = emitCountLane(
          pid,
          tid,
          pipe,
          eventsPerLane,
          timeSpan,
          laneRand,
          String(tid),
          occ,
        );
        pipeMap[pipe] = emitted;
        for (const [, , , ev] of emitted) evs.push(ev);
        tid += 1;
      }
      coreLanes.set(`${pid}:${core}`, pipeMap);
    }
  }

  for (const pipeMap of coreLanes.values()) wireDenseDeps(pipeMap, rand, 1, 4);

  return {
    displayTimeUnit: 'ns',
    nestCardTree: true,
    bands: profilerStepBands(5, timeSpan),
    traceEvents: evs,
  };
}
