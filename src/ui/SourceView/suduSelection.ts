/**
 * Selected text from a Sudu EditorView.
 *
 * ponytail: @sudu-ide/code-review 0.0.132-ascendc stubs setExternalContextMenuProvider,
 * executeMenuAction, and EditorViewController.getSelection. Walk TeaVM
 * `$editor0.$model.$selection` (0-based `$line` / `$charPos`) and slice `getText()`
 * (lines joined with `\n`). Ceiling: the same UTF-16 code units Sudu stores.
 * Upgrade path: a public selection API on EditorView.
 */
export function selectedTextFromSudu(editor: object | null): string | null {
  if (!editor) return null;
  const ed = editor as {
    getText?: () => string;
    $editor0?: {
      $model?: {
        $selection?: {
          $startPos?: { $line?: number; $charPos?: number };
          $endPos?: { $line?: number; $charPos?: number };
        };
      };
    };
  };
  const sel = ed.$editor0?.$model?.$selection;
  const start = readPos(sel?.$startPos);
  const end = readPos(sel?.$endPos);
  if (!start || !end) return null;
  if (start.line === end.line && start.char === end.char) return null;
  const text = ed.getText?.();
  if (typeof text !== 'string') return null;
  const lines = text.split('\n');
  const left = posBefore(start, end) ? start : end;
  const right = left === start ? end : start;
  if (left.line < 0 || right.line >= lines.length) return null;
  const first = lines[left.line];
  const last = lines[right.line];
  if (first == null || last == null) return null;
  if (left.line === right.line) return first.slice(left.char, right.char);
  const parts = [first.slice(left.char)];
  for (let i = left.line + 1; i < right.line; i++) parts.push(lines[i] ?? '');
  parts.push(last.slice(0, right.char));
  return parts.join('\n');
}

function readPos(
  pos: { $line?: number; $charPos?: number } | undefined,
): { line: number; char: number } | null {
  if (!pos || typeof pos.$line !== 'number' || typeof pos.$charPos !== 'number') return null;
  return { line: pos.$line, char: pos.$charPos };
}

function posBefore(
  a: { line: number; char: number },
  b: { line: number; char: number },
): boolean {
  return a.line < b.line || (a.line === b.line && a.char < b.char);
}
