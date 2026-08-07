import type {
  AdaptedReport,
  ParsedRep,
  PipeOccupancyItem,
  ReportViewModel,
  SummaryMetrics,
  SwimlaneModel,
} from '../domain/types';
import { laneColorKey } from '../domain/laneColors';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === '' || raw === 'NA') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function meanFamily(rows: Record<string, string>[], columns: string[]): number | undefined {
  const vals: number[] = [];
  for (const col of columns) {
    for (const row of rows) {
      const n = parseNumber(row[col]);
      if (n != null) vals.push(n);
    }
  }
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function summaryFromOpBasicInfo(payload?: Uint8Array): SummaryMetrics {
  if (!payload) return {};
  const { rows } = parseCsv(decodeUtf8(payload));
  const row = rows[0];
  if (!row) return {};
  return {
    opName: row['Op Name'] || undefined,
    opType: row['Op Type'] || undefined,
    taskDurationUs: parseNumber(row['Task Duration(us)']),
    currentFreq: parseNumber(row['Current Freq']),
    ratedFreq: parseNumber(row['Rated Freq']),
  };
}

/** Pipe family → CSV columns (sketch order: Cube→Vector→MTE2→MTE1→FixP→MTE3→Scalar). */
const PIPE_COLUMNS: {
  id: string;
  label: string;
  colorKey: string;
  side: 'cube' | 'vector' | 'both';
  columns: string[];
}[] = [
  { id: 'cube', label: 'Cube', colorKey: 'cube', side: 'cube', columns: ['aic_cube_ratio'] },
  { id: 'vector', label: 'Vector', colorKey: 'vector', side: 'vector', columns: ['aiv_vec_ratio'] },
  { id: 'mte2', label: 'MTE2', colorKey: 'mte2', side: 'both', columns: ['aiv_mte2_ratio', 'aic_mte2_ratio'] },
  { id: 'mte1', label: 'MTE1', colorKey: 'mte1', side: 'cube', columns: ['aic_mte1_ratio'] },
  { id: 'fixp', label: 'FixP', colorKey: 'fixp', side: 'cube', columns: ['aic_fixpipe_ratio'] },
  { id: 'mte3', label: 'MTE3', colorKey: 'mte3', side: 'vector', columns: ['aiv_mte3_ratio', 'aic_mte3_ratio'] },
  { id: 'scalar', label: 'Scalar', colorKey: 'scalar', side: 'both', columns: ['aiv_scalar_ratio', 'aic_scalar_ratio'] },
];

function pipeOccupancyFromCsv(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  const items: PipeOccupancyItem[] = [];
  for (const pipe of PIPE_COLUMNS) {
    const ratio = meanFamily(rows, pipe.columns);
    if (ratio == null) continue;
    items.push({
      id: pipe.id,
      label: pipe.label,
      ratio,
      colorKey: pipe.colorKey,
      side: pipe.side,
    });
  }
  return items;
}

/**
 * Attach PipeUtilization ratios onto matching lanes (METRICS_AND_TRACE).
 * Does not invent busy-fraction heuristics when CSV has no match.
 */
function withPipeLaneUtilizations(
  model: SwimlaneModel,
  pipes: PipeOccupancyItem[],
): SwimlaneModel {
  if (pipes.length === 0) return model;
  const byKey = new Map(pipes.map((p) => [p.colorKey, p.ratio]));
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

function reportModelFromParsed(parsed: ParsedRep): ReportViewModel {
  return {
    summary: summaryFromOpBasicInfo(parsed.payloads['OpBasicInfo.csv']),
    pipeOccupancy: pipeOccupancyFromCsv(parsed.payloads['PipeUtilization.csv']),
    overviewSeries: [],
  };
}

function swimlaneFromParsed(parsed: ParsedRep, pipes: PipeOccupancyItem[]): SwimlaneModel {
  const bytes = parsed.payloads['trace.json'];
  if (!bytes) {
    throw new Error(
      '[profiling-report] adaptRep: trace.json missing — timeline requires a swimlane source',
    );
  }
  let trace: unknown;
  try {
    trace = JSON.parse(decodeUtf8(bytes)) as unknown;
  } catch (cause) {
    throw new Error('[profiling-report] adaptRep: trace.json is not valid JSON', { cause });
  }
  // Ascend `.rep` embeds store ts/dur in nanoseconds (producer convention, not CTEF).
  const model = chromeTraceToSwimlane(trace, { sourceTimeUnit: 'ns' });
  return withPipeLaneUtilizations(model, pipes);
}

/** Map parsed `.rep` embeds → swimlane + report view-models. */
export function adaptRep(parsed: ParsedRep): AdaptedReport {
  const reportModel = reportModelFromParsed(parsed);
  return {
    swimlaneModel: swimlaneFromParsed(parsed, reportModel.pipeOccupancy),
    reportModel,
    capabilities: [],
  };
}
