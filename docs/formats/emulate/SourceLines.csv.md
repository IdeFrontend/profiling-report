# `SourceLines.csv`

| | |
|--|--|
| **Contract object** | `SourceLines` |
| **Profile** | `emulate` |
| **Catalog** | [SCHEMA.md](SCHEMA.md) |

| | |
|--|--|
| Kind | table |
| Gelu rows | 0 |
| CSV file | `SourceLines.csv` |
| Role | Complete source text per file / line. *inferred* |

Current producer layout (one row per physical source line, comments and blank
lines included):

| Column | Type | Description |
|--------|------|-------------|
| `SourceFileId` | `INTEGER` | FK → [`SourceFiles.SourceFileId`](SourceFiles.csv.md). |
| `SourceLineNum` | `INTEGER` | 1-based line number inside that file. |
| `SourceLineId` | `INTEGER` | Line id; FK target for `DebugInfo.SourceLineId` and `SourceLineMetrics.LineId`. |
| `SourceLine` | `VARCHAR` | Raw line text (leading indentation preserved; may contain commas/quotes, so the field is RFC-4180 quoted). |

The rows for one `SourceFileId` are contiguous from `1` to the file's last line,
so the file can be reconstructed by selecting the file id and sorting by
`SourceLineNum`.

**Legacy packs** (older simulator exports) have only `SourceLineId,SourceLine`.
There the file/line placement comes from [`DebugInfo.csv`](DebugInfo.csv.md)
(`DebugInfoId` → `SourceFileId` + `DebugInfoLineNum`), and the source view keeps
its collapsed sparse document for the lines that are actually referenced.

The emulator adapter prefers `(SourceFileId, SourceLineNum)` whenever those
columns are present; `DebugInfo` remains the primary instruction → line join when
available, with `AsmMetrics.FileId` / `LineNum` and `SourceLineMetrics.DebugInfoId`
as fallbacks.
