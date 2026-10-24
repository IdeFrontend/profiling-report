import type { SourceFileModel } from '../../domain/types';

/** Where a task-detail frame should open in the Source tab. */
export interface SourceFrameTarget {
  fileId: string;
  line: number;
}

/** Trailing `:line` or `:line:column` on a path. `None:None` does not match. */
const LINE_SUFFIX = /:(\d+)(?::(\d+))?$/;

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

function matchFile(path: string, files: readonly SourceFileModel[]): SourceFileModel | undefined {
  const base = basename(path);
  const exact = files.find(
    (f) => f.path === path || f.id === path || f.id === base || basename(f.path) === base,
  );
  if (exact) return exact;
  const lower = base.toLowerCase();
  const lowerPath = path.replace(/\\/g, '/').toLowerCase();
  return files.find((f) => {
    const id = f.id.toLowerCase();
    const filePath = f.path.replace(/\\/g, '/').toLowerCase();
    return id === lower || basename(filePath) === lower || filePath === lowerPath || id === lowerPath;
  });
}

/** Missing or non-positive lines open the file at line 1. */
function lineOrOne(line: number | null): number {
  return line != null && Number.isFinite(line) && line > 0 ? Math.floor(line) : 1;
}

function parsePath(text: string): { path: string; line: number | null } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const suffix = trimmed.match(LINE_SUFFIX);
  if (!suffix || suffix.index == null || suffix.index === 0) return { path: trimmed, line: null };
  return { path: trimmed.slice(0, suffix.index), line: Number(suffix[1]) };
}

function stringField(rec: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function numberField(rec: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  }
  return null;
}

/**
 * Match a Parameter frame to a bundled source file.
 * Paths are build-machine paths or basenames; the pack only stores basenames.
 * No matching file returns null. A matching file with no positive line opens at line 1.
 */
export function resolveSourceFrame(
  frame: string | Record<string, unknown>,
  files: readonly SourceFileModel[],
): SourceFrameTarget | null {
  if (!files.length) return null;

  let path: string | null = null;
  let line: number | null = null;
  if (typeof frame === 'string') {
    const parsed = parsePath(frame);
    if (!parsed) return null;
    path = parsed.path;
    line = parsed.line;
  } else {
    path = stringField(frame, ['FileName', 'file', 'path', 'SourceFilePath']);
    line = numberField(frame, ['Line', 'line', 'CallSiteLine']);
    if (path && line == null) {
      const parsed = parsePath(path);
      if (parsed) {
        path = parsed.path;
        line = parsed.line;
      }
    }
  }
  if (!path) return null;
  const file = matchFile(path, files);
  if (!file) return null;
  return { fileId: file.id, line: lineOrOne(line) };
}
