# Spec Style Guide

## Purpose

A spec describes **what a module does and why** — not how it's implemented. It must be **useful on its own** to someone who hasn't read the source code: an integrator, a reviewer, or a new contributor adding a feature that touches this module.

## What belongs in each section

| Section | Content | Skip if |
|---------|---------|---------|
| **Purpose** | One sentence — what this module is. | Never. |
| **Behavior** | What it does, why that matters, how it interacts with other parts of the system. Non-obvious constraints, data flow, state ownership, edge cases. This is the most important section. | Never. |
| **Edge Cases** | Known boundary conditions, error paths, limits. Only include cases that aren't obvious from the types or behavior description. | All edge cases are obvious or covered in Behavior. |
| **Dependencies** | Other specs or interim decisions this module relies on. | No external dependencies. |
| **Open** | Unresolved questions. Reference OPEN_QUESTIONS.md entries. | All questions resolved. |
| **Design sketches** | Links to mockups in `docs/specs/ui/source/`. | No relevant sketches. |

## What does NOT belong in a spec

### Props/emits/slots tables

These duplicate the `.vue` file's `defineProps`/`defineEmits`. The spec should explain **why** a prop exists and **how** it affects behavior — not list every field the component accepts.

Good: "The `source` prop accepts either a `.rep` binary (which produces a full report with swimlane, summary, and pipe occupancy) or standalone CTEF JSON (which produces swimlane only — the aside panel auto-hides)."

Bad: a 9-row props table listing every field the component accepts with Type and Required columns.

### Acceptance Criteria

These belong in the test file. Every test case already carries a spec ID (`it('PR-TOOLBAR-001: ...', ...)`). The spec should not duplicate the test descriptions as a numbered list. The traceability checker maps ACs to test IDs — if a spec has no AC section, it doesn't need to participate in traceability (the `.vue` component specs don't need test IDs; core/architecture specs do if they have corresponding unit tests).

Exception: core modules that have corresponding unit tests should keep ACs with IDs for traceability. Component specs should not.

### "Pure presentational" / "No emits" / "No slots"

These are empty boilerplate. If there's nothing to say, don't say it.

### Implementation details

The spec should not describe CSS classes, ResizeObserver, v-if, watchers, or other implementation mechanics. Describe the **observable behavior**, not the Vue internals.

### Test IDs

Don't mention test IDs in the spec body. The metadata header carries the prefix; individual IDs live in test files. Specs describe behavior, tests prove it.

## Component spec format

```
# ComponentName

<!--
  spec-id-prefix: PR-XXXX-*
  phase: MVP | P2+
  source: src/ui/ComponentName/ComponentName.vue
  test: src/ui/ComponentName/ComponentName.spec.ts   (optional)
-->

[One sentence — what this component is and what role it plays in the system.]

## Behavior

[Substantive description of what this component does, organized by concern.
Use subheadings if there are multiple distinct behaviors.
Focus on what's non-obvious — data flow, interactions with other components,
state that passes through this component, constraints, lifecycle.]

## Edge Cases

[Only include cases that aren't apparent from the types or Behavior section.
If every edge case is obvious, omit this section entirely.]

## Dependencies

[Other specs, interim decisions, or components this relies on.
If none, omit.]

## Open

[Unresolved questions referencing OPEN_QUESTIONS.md.
If none, omit.]

## Design sketches

- [sketch name](/docs/specs/ui/source/sketch.png) — description of what's shown
```

## Core module spec format

```
# Module Name

<!--
  spec-id-prefix: PR-XXXX-*
  phase: MVP
  source: src/path/to/source.ts
  test: tests/unit/test-name.spec.ts
-->

[One sentence — what this module computes or transforms.]

```ts
functionName(params): ReturnType
```

[Parameter descriptions inline or in a brief table.]

## Behavior

[What the function does, how it transforms data,
important algorithm details, non-obvious constraints.]

## Acceptance Criteria

1. **PR-XXXX-001**: [Testable statement that maps to a test ID.]
1. **PR-XXXX-002**: [Testable statement that maps to a test ID.]

## Edge Cases

[Non-obvious boundary conditions and error paths.]

## Dependencies

## Open
```

## Architecture spec format

Architecture specs describe cross-cutting contracts that don't belong to a single module. They document what integrators and hosts need to know:

- Public API surface (what's exported, what's stable)
- Integration contracts (props, emits, lifecycle)
- Packaging constraints (peer dependencies, build output)

No acceptance criteria needed — these are verified by integration tests and typecheck.
