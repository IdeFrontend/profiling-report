import type {
  SourceCorrelationModel,
  SourceFileModel,
  SourceLineMetrics,
} from '../../domain/types';

/** Prefix used when compute adapt has correlation embeds but no source text in the pack. */
export const MISSING_SOURCE_EMBED_PREFIX = '// missing source embed:';

export function isMissingSourceEmbed(text: string): boolean {
  return text.startsWith(MISSING_SOURCE_EMBED_PREFIX);
}

/**
 * Placeholder text aligned to `lineCount` so the metrics table and Sudu stay
 * in sync until a host fills the real document.
 */
export function missingSourceEmbedText(path: string, lineCount: number): string {
  const n = Math.max(1, lineCount);
  const lines = Array.from({ length: n }, (_, i) =>
    i === 0 ? `${MISSING_SOURCE_EMBED_PREFIX}${path}` : '',
  );
  return `${lines.join('\n')}\n`;
}

export type ResolveSourceFileRequest = {
  /** Symbolizer `FileName` as stored (often an absolute build path). */
  fileName: string;
  /** Basename used for pack matching, e.g. `gather_2d.asc`. */
  basename: string;
};

/**
 * Optional host hook: resolve Ascend C (or other) source text from disk / workspace.
 * Return `null` to keep the missing-embed placeholder. Thrown errors are treated as miss.
 */
export type ResolveSourceFile = (
  request: ResolveSourceFileRequest,
) => Promise<string | null>;

export function fileNeedsSourceResolve(file: SourceFileModel): boolean {
  return isMissingSourceEmbed(file.text);
}

/** One text file a host picked from a source workspace. */
export type SourceWorkspaceFile = {
  /** Path inside the picked workspace, using `/` separators. */
  path: string;
  text: string;
};

/** Files returned by a host workspace picker. */
export type SourceWorkspacePick = {
  files: SourceWorkspaceFile[];
};

/**
 * Optional host hook: let the operator pick a source workspace (directory).
 * Requests describe the missing files. Return `null` when the operator cancels.
 */
export type PickSourceWorkspace = (
  request: ResolveSourceFileRequest[],
) => Promise<SourceWorkspacePick | null>;

function slashPath(path: string): string {
  return path.replace(/\\/g, '/');
}

function trailingSegments(path: string): string[] {
  return slashPath(path)
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
}

function commonTrailingSegments(a: string[], b: string[]): number {
  let count = 0;
  while (
    count < a.length &&
    count < b.length &&
    a[a.length - 1 - count] === b[b.length - 1 - count]
  ) {
    count += 1;
  }
  return count;
}

/** True when one segment list is a suffix of the other. */
function isPathSuffix(a: string[], b: string[]): boolean {
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.every((segment, i) => segment === long[long.length - short.length + i]);
}

/** Last path segment, using `/` or `\` separators. */
export function sourceBasename(path: string): string {
  return trailingSegments(path).at(-1) ?? slashPath(path);
}

/**
 * Resolver for a workspace the operator picked. Match order: exact path, then
 * the longest suffix shared by path segments, then `request.basename`.
 * Two distinct candidates at a tier are a miss. A case-insensitive pass runs
 * only when the case-sensitive pass finds nothing.
 */
export function workspaceSourceResolver(pick: SourceWorkspacePick): ResolveSourceFile {
  const files = pick.files
    .map((file) => ({
      path: slashPath(file.path),
      segments: trailingSegments(file.path),
      basename: trailingSegments(file.path).at(-1) ?? '',
      text: file.text,
    }))
    .filter((file) => file.text !== '');

  const matchOne = (request: ResolveSourceFileRequest, foldCase: boolean): string | null => {
    const normalize = (value: string) => (foldCase ? value.toLowerCase() : value);
    const fileName = normalize(slashPath(request.fileName));
    const basename = normalize(request.basename);

    const exact = files.filter((file) => normalize(file.path) === fileName);
    if (exact.length === 1) return exact[0].text;
    if (exact.length > 1) return null;

    const requestSegments = trailingSegments(request.fileName).map(normalize);
    const suffix = files
      .filter((file) => isPathSuffix(file.segments.map(normalize), requestSegments))
      .map((file) => ({
        text: file.text,
        score: commonTrailingSegments(file.segments.map(normalize), requestSegments),
      }))
      .filter((file) => file.score > 0);
    if (suffix.length > 0) {
      const best = Math.max(...suffix.map((file) => file.score));
      const top = suffix.filter((file) => file.score === best);
      return top.length === 1 ? top[0].text : null;
    }

    const byBasename = files.filter((file) => normalize(file.basename) === basename);
    return byBasename.length === 1 ? byBasename[0].text : null;
  };

  return async (request) => matchOne(request, false) ?? matchOne(request, true);
}

/** True when `model` holds at least one placeholder file and is not mock data. */
export function modelNeedsSourceResolve(
  model: SourceCorrelationModel | null | undefined,
): boolean {
  if (!model || model.mock) return false;
  return model.files.some(fileNeedsSourceResolve);
}

/** Deduped picker requests for the placeholder files in `model`. */
export function sourceResolveRequests(
  model: SourceCorrelationModel,
): ResolveSourceFileRequest[] {
  const seen = new Set<string>();
  const requests: ResolveSourceFileRequest[] = [];
  for (const file of model.files) {
    if (!fileNeedsSourceResolve(file)) continue;
    const key = slashPath(file.path);
    if (seen.has(key)) continue;
    seen.add(key);
    requests.push({ fileName: file.path, basename: sourceBasename(file.path) });
  }
  return requests;
}

/**
 * Replace placeholder text and resize `lines` to the new document length.
 * Stall / metric values on overlapping line numbers are preserved (adapt keeps
 * them even when the pack lacked source text).
 */
export function applyResolvedSourceText(
  file: SourceFileModel,
  text: string,
): SourceFileModel {
  const lineCount = Math.max(1, text.split(/\r?\n/).length);
  const prevByLine = new Map(file.lines.map((row) => [row.line, row]));
  const zeroValues = (): Record<string, number | string | null> => {
    const values: Record<string, number | string | null> = {};
    for (const col of file.metricsColumns) {
      if (col.kind === 'text') values[col.id] = '';
      else values[col.id] = 0;
    }
    return values;
  };
  const lines: SourceLineMetrics[] = Array.from({ length: lineCount }, (_, i) => {
    const line = i + 1;
    const prev = prevByLine.get(line);
    if (prev) {
      return {
        line,
        values: { ...prev.values },
        ...(prev.stallBreakdown ? { stallBreakdown: [...prev.stallBreakdown] } : {}),
      };
    }
    return { line, values: zeroValues() };
  });
  // Dense `lines` define the extent — drop sparse emulate `lineCount` so the
  // metrics table does not keep the placeholder max line after host resolve.
  // Real text means a full document: stop collapsing to reported lines.
  return { ...file, text, lines, lineCount: undefined, sparse: false };
}

/**
 * Call `resolve` for each missing source file. Unchanged model reference when
 * nothing was filled (so callers can skip Vue writes).
 */
export async function resolveMissingSourceFiles(
  model: SourceCorrelationModel,
  resolve: ResolveSourceFile,
): Promise<SourceCorrelationModel> {
  if (model.mock) return model;
  let changed = false;
  const files: SourceFileModel[] = [];
  for (const file of model.files) {
    if (!fileNeedsSourceResolve(file)) {
      files.push(file);
      continue;
    }
    let text: string | null = null;
    try {
      text = await resolve({
        fileName: file.path,
        basename: sourceBasename(file.path),
      });
    } catch {
      text = null;
    }
    if (text == null || text === '') {
      files.push(file);
      continue;
    }
    changed = true;
    files.push(applyResolvedSourceText(file, text));
  }
  return changed ? { ...model, files } : model;
}
