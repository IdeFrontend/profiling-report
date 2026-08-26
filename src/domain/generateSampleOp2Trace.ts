/**
 * Deterministic op2 trace for sample.rep (ported from data/build_sample_rep.py big_trace).
 * Committed sample.rep omits this blob; playground/tests hydrate before loadReportSource.
 */

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

const PIPELINE_ORDER = ['MTE2', 'MTE1', 'CUBE', 'FIXP', 'MTE3'] as const;

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

function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function wirePipelineDeps(laneEvents: Record<string, LaneEvent[]>, rand: Rand): void {
  for (let k = 0; k < PIPELINE_ORDER.length - 1; k++) {
    const up = PIPELINE_ORDER[k]!;
    const dn = PIPELINE_ORDER[k + 1]!;
    const ups = laneEvents[up];
    const dns = laneEvents[dn];
    if (!ups || !dns) continue;

    let di = 0;
    for (const [, start, end, ev] of ups) {
      if (end - start <= 1) continue;
      if (rand() > 0.55) continue;
      while (di < dns.length && dns[di]![1] < end) di += 1;
      if (di >= dns.length) break;
      const succEid = dns[di]![0];
      const args = (ev.args ??= {}) as Record<string, unknown>;
      const deps = (args.dependencies ??= []) as string[];
      if (!deps.includes(succEid)) deps.push(succEid);
    }
  }
}

/** ~150k X events, 5 ProfilerStep bands, nestCardTree — matches build_sample_rep.py big_trace(). */
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

  for (const pipeMap of coreLanes.values()) wirePipelineDeps(pipeMap, rand);

  return {
    displayTimeUnit: 'ns',
    nestCardTree: true,
    bands: profilerStepBands(5, timeSpan),
    traceEvents: evs,
  };
}
