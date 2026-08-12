# Spec style

Section order and frontmatter: follow [`specs/TEMPLATE.md`](../../specs/TEMPLATE.md) (also linked from [`specs/README.md`](../../specs/README.md)). Do not restate the section tables here.

A spec describes **what a module does and why** — not how it's implemented. It must be useful on its own without reading the source.

Component `*.spec.md` files in this tree are co-located with Vue components. `npm run check:specs` scans both `specs/` and `src/` — every component spec needs `## Acceptance Criteria`.

## What does NOT belong

- **Props/emits tables.** Duplicate of `.vue` defineProps/defineEmits. Use prose — describe *why*.
- **Implementation details.** CSS classes, ResizeObserver, v-if, watchers. Describe observable behavior.
- **Phase/milestone metadata.** Roadmap (`docs/process/roadmap/`) owns scheduling. Spec table carries only `spec-id-prefix` for the traceability checker.
- **Source/test file paths.** Co-location implies them.
- **"Pure presentational" / "No emits".** Empty boilerplate — omit the section.
- **Test descriptions.** AC lines stay compact (ID + 3–6 words). Full text lives in the test file.

## Prose conventions

- **Bold key names** on first mention: **source**, **swimlaneModel**, **select**.
- **Backtick types** inline: `SelectedEvent`, `{ startTime, endTime }`.
- **Parenthetical values**: "timeUnit" (ms/µs/ns).
- **Reference style**: "per I-Q6a", "per Q15".

## Acceptance criteria

Every component spec needs a compact AC list. Missing `## Acceptance Criteria` fails CI (`NO AC SECTION`).

Format: `1. **PR-XXXX-001** — brief statement (3-6 words).`
