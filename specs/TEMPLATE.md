# [Component Name] / [Module Name]

| spec-id-prefix |
|----------------|
| PR-XXXX-*      |

[One sentence — what this module is and its role in the system.]

## Inputs

*Component specs only.* English prose describing what the component receives:
props (why they exist, what values mean, how they affect behavior),
slots (what content they expect), and any other input contract (e.g.,
required data shape). No tables — describe relationships between props
and their consequences. Omit for core/architecture specs.

## Outputs

*Component specs only.* English prose describing what the component emits:
events (what triggers them, payload shape, what the parent does with
them), exposed methods (defineExpose), and any other output contract.
Omit for core/architecture specs.

## Interaction flows

*Root component spec only.* Sequence diagrams (mermaid) showing how user
actions propagate through the component tree. One diagram per interaction
type: zoom, drag-pan, hover→select, search, data loading. Diagrams make
the architecture testable without reading source code.

## Behavior

[Substantive description of what this module does.
Organize by concern with subheadings.
For components: data flow, interactions, constraints.
For core modules: algorithm details, non-obvious transformations, contracts.
For architecture: integration patterns, lifecycle, independence rules.]

## Acceptance Criteria

> Component specs: include compact list of test IDs with brief statements
> for traceability (checker needs AC↔test ID mapping).
> Core/architecture specs: include if there are corresponding unit tests.

1. **PR-XXXX-001** — [brief statement].
1. **PR-XXXX-002** — [brief statement].

## Edge Cases

> Use a table for components with multiple states. Use inline bullet list
> for core modules with few cases. Omit if all cases are obvious.

| State | Behavior |
|---|---|
| ... | ... |

## Dependencies

[Other specs, interim decisions, or contracts. Omit if none.]

## Open

[Unresolved questions. Omit if none.]

## Design sketches

- [sketch name](/docs/specs/ui/source/sketch.png) — description

## Changelog
- **YYYY-MM-DD** — Initial spec.
