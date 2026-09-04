# Spec style

Section order and frontmatter: follow [`TEMPLATE.md`](./TEMPLATE.md) (also linked from [`README.md`](./README.md)). Do not restate the section tables here. Specs without test IDs (architecture specs) omit the spec-id-prefix table.

A spec describes **what a module does and why** — not how it's implemented. It must be useful on its own without reading the source.

## What does NOT belong

- **Props/emits tables.** Duplicate of `.vue` defineProps/defineEmits. Use prose — describe *why*.
- **Implementation details.** CSS classes, ResizeObserver, v-if, watchers. Describe observable behavior.
- **Phase/milestone metadata.** Roadmap (`docs/process/roadmap/`) owns scheduling. Spec table carries only `spec-id-prefix` for the traceability checker.
- **Source/test file paths in core specs.** Do not invent them from the kebab filename. Use the Source and Test columns of the Core table in [`README.md`](./README.md) (e.g. `swimlane-model.spec.md` → `tests/unit/swimlaneModel.spec.ts`). Component specs under `src/ui/**` are co-located with their `.vue` and need no path lines.
- **"Pure presentational" / "No emits".** Empty boilerplate — omit the section.
- **Test descriptions.** AC lines stay compact (ID + 3–6 words). Full text lives in the test file.

## Prose conventions

- **Bold key names** on first mention: **source**, **swimlaneModel**, **select**.
- **Backtick types** inline: `SelectedEvent`, `{ startTime, endTime }`.
- **Parenthetical values**: "dependencyDepth" (−1 = no hop cap).
- **Reference style**: "per DATA-33a", "per PROC-3".

## Acceptance criteria

Every `*.spec.md` under `specs/` and `src/` needs a compact AC list — tests or no tests; the only exemption is `DELEGATED_SPECS` in `scripts/check-spec-coverage.mjs`. `npm run check:specs` maps AC IDs ↔ test IDs; missing section → `NO AC SECTION`; empty → `EMPTY AC`; AC id with no test → `MISSING TEST`; test id with no AC → `ORPHAN TEST`; the same id in two specs → `DUPLICATE AC`.

Format: `1. **PR-XXXX-001** — brief statement (3-6 words).`
