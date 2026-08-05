# Spec Style Guide

## Purpose

A spec describes **what a module does and why** — not how it's implemented. It must be **useful on its own** to someone who hasn't read the source code: an integrator, a reviewer, or a new contributor.

## Component spec sections (in order)

| Section | Content | Skip if |
|---------|---------|---------|
| **One-liner** | What this component is and its role. | Never. |
| **Inputs** | English prose — what the component receives. Describe props in context: why they exist, what values do, how they relate. No tables. | Never. |
| **Outputs** | English prose — what the component emits. Describe events: triggers, payload shape, what the parent does with them. Mention defineExpose if used. | Never. |
| **Interaction flows** | Mermaid sequence diagrams for cross-component interactions. Root component only. One diagram per interaction type. | Not the root component. |
| **Behavior** | What the component does: data flow, interactions, non-obvious constraints. Use subheadings by concern. | Never. |
| **Acceptance Criteria** | Compact list of test IDs with brief statements. Kept for traceability (checker needs AC↔test ID mapping). | Never — all component specs participate in traceability. |
| **Edge Cases** | Table of states and behaviors. Covers null inputs, empty data, boundary conditions, error states. | All cases obvious from Behavior. |
| **Dependencies** | Other specs, interim decisions, contracts. | None. |
| **Open** | Unresolved questions. | None. |
| **Design sketches** | Links to mockups. | No sketches. |

## Core module spec sections (in order)

| Section | Content | Skip if |
|---------|---------|---------|
| **One-liner** + **signature** | What this module computes, with TS function signature. | Never. |
| **Unit contract** | Explicit constraints on the data this module operates on (e.g., "all time values are in nanoseconds"). Prevents the most common class of bugs. | No non-obvious contract. |
| **Behavior** | Algorithm details, non-obvious transformations, ordering rules, error conditions. | Never. |
| **Acceptance Criteria** | Test IDs with brief statements for traceability. | No corresponding unit tests. |
| **Edge Cases** | Inline bullet list of boundary conditions. | Covered by Behavior. |
| **Dependencies / Open / Sketches** | As for component specs. | As above. |

## Architecture spec sections (in order)

| Section | Content | Skip if |
|---------|---------|---------|
| **One-liner** | What contract this defines. | Never. |
| **Behavior** | Integration patterns, lifecycle, loading paths, independence rules, emit semantics. | Never. |
| **Edge Cases** | Multi-instance behavior, precedence rules, error paths. | None. |
| **Dependencies / Open** | As above. | As above. |

## What does NOT belong

- **Props/emits tables.** Duplicate of `.vue` defineProps/defineEmits. Use prose instead — describe *why*.
- **Implementation details.** CSS classes, ResizeObserver, v-if, watchers. Describe observable behavior.
- **"Pure presentational" / "No emits".** Empty boilerplate. If there's nothing to say, omit the section.
- **Test descriptions.** Acceptance criteria are compact (ID + 3-4 words). Full descriptions live in test files.

## Prose conventions

- **Bold key names** on first mention: **source**, **swimlaneModel**, **select**.
- **Backtick types** inline: `SelectedEvent`, `{ startTime, endTime }`.
- **Parenthetical values**: "timeUnit" (ms/µs/ns).
- **Reference style**: "per I-Q6a", "per Q15" — link to interim decisions.

## Edge case table format

Use a two-column table when a component has multiple states:

| State | Behavior |
|---|---|
| model is null | Empty canvas, no error |
| Empty pipeOccupancy | No bars; summary still visible |

## Diagrams

Use mermaid `sequenceDiagram` for root component interaction flows. Participants use readable aliases:

```
participant Canvas as SwimlaneCanvas
participant Root as ProfilingReport
```

Keep arrows focused: `->>` for calls/emits, `-->>` for returns. Use `alt`/`else` for branching paths (data loading). One diagram per interaction type (zoom, pan, hover-select, search, data loading).

## Unit contracts

For core modules, explicitly state non-obvious constraints as a `## Unit contract` section. These prevent bugs where different layers assume different units or conventions.

Example: "All time values are in nanoseconds. Conversion to display units happens only at the formatting layer."

## Acceptance criteria

Every component spec and every core spec with corresponding tests keeps a compact AC list. The traceability checker (`check:specs`) maps AC IDs to test IDs bidirectionally. Without ACs, tests are orphaned.

Format: `1. **PR-XXXX-001** — brief statement (3-6 words).`

No full sentences unless necessary for disambiguation. The test file carries the full description.
