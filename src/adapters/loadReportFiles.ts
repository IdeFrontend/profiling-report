import { adaptPayloads } from './adaptRep';
import type { AdaptedReport } from '../domain/types';

/**
 * A single report file produced by the backend `npu-compute` extraction:
 * a basename (`trace.json`, `PipeUtilization.csv`, …) plus its raw bytes.
 */
export interface ReportFileEntry {
  name: string;
  data: Uint8Array | ArrayBuffer;
}

/** Backend JSON response shape for an extracted report folder. */
export type ReportFilesSource =
  | Record<string, Uint8Array | ArrayBuffer>
  | ReportFileEntry[];

function toBytes(source: ArrayBuffer | Uint8Array): Uint8Array {
  return source instanceof Uint8Array ? source : new Uint8Array(source);
}

/**
 * Adapt an already-extracted report folder (filename → bytes) into an
 * `AdaptedReport`. The backend extracts the new `.npu-rep` container via
 * `npu-compute`; the frontend never parses that container itself — it only
 * renders the folder of the same embeds `.rep` already carries.
 *
 * Accepts either a name→bytes map or the backend's `{ name, data }[]` list.
 */
export function loadReportFiles(files: ReportFilesSource): AdaptedReport {
  const payloads: Record<string, Uint8Array> = {};
  if (Array.isArray(files)) {
    for (const entry of files) {
      payloads[entry.name] = toBytes(entry.data);
    }
  } else {
    for (const [name, data] of Object.entries(files)) {
      payloads[name] = toBytes(data);
    }
  }
  if (Object.keys(payloads).length === 0) {
    throw new Error('[profiling-report] loadReportFiles: no report files provided');
  }
  return adaptPayloads(payloads);
}
