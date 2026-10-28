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
    return {
      line,
      values: {
        instructionsExecuted: 0,
        samplingStall: 0,
        warpOccupancy: 0,
      },
    };
  });
  return { ...file, text, lines };
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
        basename: file.id,
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
