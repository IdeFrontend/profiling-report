# Source freshness (objdump vs workspace)

| spec-id-prefix |
|----------------|
| PR-FRESH-*     |

Product-final freshness check ([DATA-57](../../docs/context/decisions/DATA.md#data-57)): compare interleaved source text from [`objdump.txt`](../../docs/formats/compute/objdump.txt.md) to matched local file content. **No** `sources.json` / SHA catalog / packed full-source fingerprint embed.

Normative format: [SOURCE_PROVENANCE.md](../../docs/formats/SOURCE_PROVENANCE.md).

## Behavior

**Lookup.** Resolve report paths to workspace files via the **host lookup** owned by Kirill Aleshin / existing `resolveSourceFile`. This library **MUST NOT** ship a second path resolver for freshness.

**Extract.** From `objdump.txt`, collect checkable `(path, line, text?)` snippets (path:line markers + interleaved non-instruction source lines). Instruction-only rows are not freshness evidence.

**Compare.** For each snippet with text, compare to the corresponding line(s) of the matched local file. Missing annotation or missing local file → `unknown` (not mismatch).

**UI.** Any `mismatch` → warning that local sources differ from the report’s objdump view. Does **not** gate `sourceTab` / `sourceCorrelation`.

**Profiles.** Compute uses `objdump.txt`. Emulate **MUST NOT** invent compute-shaped fingerprint embeds for this check.

## Acceptance Criteria

Runtime compare + warning UI is a follow-up slice; those ACs stay **WITHDRAWN** until then.

1. **PR-FRESH-001** — No `sources.json` schema / section SSOT / provisional fingerprint reader ships as product format for freshness ([DATA-57](../../docs/context/decisions/DATA.md#data-57)).
2. **PR-FRESH-002** — WITHDRAWN until implement — When objdump interleaved text differs from matched local lines, UI exposes a mismatch warning.
3. **PR-FRESH-003** — WITHDRAWN until implement — When objdump has no checkable text for a file, freshness is `unknown` (no false mismatch).
4. **PR-FRESH-004** — WITHDRAWN until implement — Freshness path resolution reuses host lookup / `resolveSourceFile`; no duplicate resolver module.
5. **PR-FRESH-005** — WITHDRAWN until implement — Mismatch warning does not remove `sourceTab` when correlation is otherwise present.

## Dependencies

[SOURCE_PROVENANCE.md](../../docs/formats/SOURCE_PROVENANCE.md), [objdump.txt.md](../../docs/formats/compute/objdump.txt.md), [source-correlation](./source-correlation.spec.md), [DATA-57](../../docs/context/decisions/DATA.md#data-57).

## Changelog

- **2026-11-17** — DATA-57: drop `sources.json` proposal; freshness = objdump vs matched local; warning on mismatch; reuse Kirill lookup.
- **2026-11-16** — (superseded) Interim `sources.json` / PR-PROV-* draft.
