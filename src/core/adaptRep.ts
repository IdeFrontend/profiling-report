import type {
  AdaptedReport,
  ParsedRep,
  PipeOccupancyItem,
  ReportViewModel,
  SummaryMetrics,
} from './types';
import { chromeTraceToSwimlane } from './chromeTraceToSwimlane';
import { withDerivedUtilizations } from './utilization';

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

function meanNonNa(rows: Record<string, string>[], column: string): number | undefined {
  const vals: number[] = [];
  for (const row of rows) {
    const n = parseNumber(row[column]);
    if (n != null) vals.push(n);
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

/** Pipe family → preferred CSV columns (sketch order: Cube→Vector→MTE2→MTE1→FixP→MTE3→Scalar). */
const PIPE_COLUMNS: {
  id: string;
  label: string;
  colorKey: string;
  columns: string[];
}[] = [
  { id: 'cube', label: 'Cube', colorKey: 'cube', columns: ['aic_cube_ratio'] },
  { id: 'vector', label: 'Vector', colorKey: 'vector', columns: ['aiv_vec_ratio'] },
  { id: 'mte2', label: 'MTE2', colorKey: 'mte2', columns: ['aiv_mte2_ratio', 'aic_mte2_ratio'] },
  { id: 'mte1', label: 'MTE1', colorKey: 'mte1', columns: ['aic_mte1_ratio'] },
  { id: 'fixp', label: 'FixP', colorKey: 'fixp', columns: ['aic_fixpipe_ratio'] },
  { id: 'mte3', label: 'MTE3', colorKey: 'mte3', columns: ['aiv_mte3_ratio', 'aic_mte3_ratio'] },
  { id: 'scalar', label: 'Scalar', colorKey: 'scalar', columns: ['aiv_scalar_ratio', 'aic_scalar_ratio'] },
];

function pipeOccupancyFromCsv(payload?: Uint8Array): PipeOccupancyItem[] {
  if (!payload) return [];
  const { rows } = parseCsv(decodeUtf8(payload));
  const items: PipeOccupancyItem[] = [];
  for (const pipe of PIPE_COLUMNS) {
    let ratio: number | undefined;
    for (const col of pipe.columns) {
      ratio = meanNonNa(rows, col);
      if (ratio != null) break;
    }
    if (ratio == null) continue;
    items.push({
      id: pipe.id,
      label: pipe.label,
      ratio,
      colorKey: pipe.colorKey,
    });
  }
  return items;
}

function reportModelFromParsed(parsed: ParsedRep): ReportViewModel {
  return {
    summary: summaryFromOpBasicInfo(parsed.payloads['OpBasicInfo.csv']),
    pipeOccupancy: pipeOccupancyFromCsv(parsed.payloads['PipeUtilization.csv']),
    overviewSeries: [],
  };
}

function swimlaneFromParsed(parsed: ParsedRep) {
  const bytes = parsed.payloads['trace.json'];
  if (!bytes) {
    return withDerivedUtilizations({ processes: [], minTime: 0, maxTime: 0 });
  }
  const trace = JSON.parse(decodeUtf8(bytes)) as unknown;
  return chromeTraceToSwimlane(trace);
}

/** Map parsed `.rep` embeds → swimlane + report view-models. */
export function adaptRep(parsed: ParsedRep): AdaptedReport {
  return {
    swimlaneModel: swimlaneFromParsed(parsed),
    reportModel: reportModelFromParsed(parsed),
    capabilities: [],
  };
}
