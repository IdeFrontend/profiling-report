# AGENTS.md

Shared instructions for Cursor, Codex, Claude Code, and other coding agents.

## Ponytail, lazy senior dev mode

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
3. Does the standard library already do this? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

The ladder runs after you understand the problem, not instead of it: read the task and the code it touches, trace the real flow end to end, then climb.

Bug fix = root cause, not symptom: a report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller still broken.

Rules:

- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.
- Mark deliberate simplifications that cut a real corner with a known ceiling (global lock, O(n²) scan, naive heuristic) with a `ponytail:` comment naming the ceiling and upgrade path.

Not lazy about: understanding the problem (read it fully and trace the real flow before picking a rung, a small diff you don't understand is just laziness dressed up as efficiency), input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.

## Code review → post to GitHub

When you review code (Bugbot, security review, PR review, `/review`, "review PR N", re-review, etc.), **always publish the review to the origin GitHub repository in the same turn**. Do not ask whether to post, and do not wait for a follow-up "post it" request.

### Required flow

1. Complete the review (findings table in chat as usual).
2. Resolve the target PR (`gh pr view`, PR number/URL from the user, or the open PR for the checked-out branch).
3. Submit a GitHub PR review with `gh api repos/{owner}/{repo}/pulls/{n}/reviews` (or equivalent `gh pr review`):
   - `event`: `COMMENT` unless the user asked for approve / request-changes
   - Summary body: finding count + severity table
   - Inline comments on diff hunks when line numbers resolve; otherwise put details in the review body
4. Reply with the review URL.

### Do not

- Ask "want me to post this to GitHub?"
- End after a chat-only summary when a PR exists on origin
- Skip posting because findings are empty — still post a short "no issues" review when a PR was the review target

### Exceptions (report briefly, then stop)

- No open PR / cannot map the reviewed branch to a GitHub PR
- `gh` auth or API failure after one retry
- User explicitly said **not** to post (e.g. "review locally only")

## Spec style guide

Apply when creating or editing files under `specs/`.

A spec describes **what a module does and why** — not how it's implemented. It must be **useful on its own** to someone who hasn't read the source code: an integrator, a reviewer, or a new contributor.

### Component spec sections (in order)

| Section | Content | Skip if |
|---------|---------|---------|
| **Title + prefix table** | `# Title` followed by a single-row markdown table with `spec-id-prefix`. Architecture specs with no prefix omit the table. | Never — every spec has a title; prefix table if test IDs exist. |
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

### Core module spec sections (in order)

| Section | Content | Skip if |
|---------|---------|---------|
| **One-liner** + **signature** | What this module computes, with TS function signature. | Never. |
| **Unit contract** | Explicit constraints on the data this module operates on (e.g., "all time values are in nanoseconds"). Prevents the most common class of bugs. | No non-obvious contract. |
| **Behavior** | Algorithm details, non-obvious transformations, ordering rules, error conditions. | Never. |
| **Acceptance Criteria** | Test IDs with brief statements for traceability. | No corresponding unit tests. |
| **Edge Cases** | Inline bullet list of boundary conditions. | Covered by Behavior. |
| **Dependencies / Open / Sketches** | As for component specs. | As above. |

### Architecture spec sections (in order)

| Section | Content | Skip if |
|---------|---------|---------|
| **One-liner** | What contract this defines. | Never. |
| **Behavior** | Integration patterns, lifecycle, loading paths, independence rules, emit semantics. | Never. |
| **Edge Cases** | Multi-instance behavior, precedence rules, error paths. | None. |
| **Dependencies / Open** | As above. | As above. |

### What does NOT belong

- **Props/emits tables.** Duplicate of `.vue` defineProps/defineEmits. Use prose instead — describe *why*.
- **Implementation details.** CSS classes, ResizeObserver, v-if, watchers. Describe observable behavior.
- **Phase/milestone metadata.** The roadmap (`docs/process/roadmap/`) is the single source of truth for scheduling. Spec frontmatter carries only `spec-id-prefix` — the identifier consumed by the traceability checker.
- **Source/test file paths.** Co-location makes these redundant. `specs/core/foo.spec.md` maps to `tests/unit/foo.spec.ts` by convention.
- **"Pure presentational" / "No emits".** Empty boilerplate. If there's nothing to say, omit the section.
- **Test descriptions.** Acceptance criteria are compact (ID + 3-4 words). Full descriptions live in test files.

### Frontmatter format

Every spec starts with a title and an optional single-row markdown table:

```markdown
# ComponentName

| spec-id-prefix |
|----------------|
| PR-XXXX-*      |

One-line description...
```

Specs without test IDs (architecture contracts) have no table — just the title and one-liner.

### Prose conventions

- **Bold key names** on first mention: **source**, **swimlaneModel**, **select**.
- **Backtick types** inline: `SelectedEvent`, `{ startTime, endTime }`.
- **Parenthetical values**: "timeUnit" (ms/µs/ns).
- **Reference style**: "per I-Q6a", "per Q15" — link to interim decisions.

### Edge case table format

Use a two-column table when a component has multiple states:

| State | Behavior |
|---|---|
| model is null | Empty canvas, no error |
| Empty pipeOccupancy | No bars; summary still visible |

### Diagrams

Use mermaid `sequenceDiagram` for root component interaction flows. Participants use readable aliases:

```
participant Canvas as SwimlaneCanvas
participant Root as ProfilingReport
```

Keep arrows focused: `->>` for calls/emits, `-->>` for returns. Use `alt`/`else` for branching paths (data loading). One diagram per interaction type (zoom, pan, hover-select, search, data loading).

### Unit contracts

For core modules, explicitly state non-obvious constraints as a `## Unit contract` section. These prevent bugs where different layers assume different units or conventions.

Example: "All time values are in nanoseconds. Conversion to display units happens only at the formatting layer."

### Acceptance criteria

Every component spec and every core spec with corresponding tests keeps a compact AC list. The traceability checker (`check:specs`) maps AC IDs to test IDs bidirectionally. Without ACs, tests are orphaned.

Format: `1. **PR-XXXX-001** — brief statement (3-6 words).`

No full sentences unless necessary for disambiguation. The test file carries the full description.

## Skills (on demand)

Do **not** load these into every turn. Use only when the user asks or the trigger matches. Full playbooks live under `.agents/skills/`:

| Skill | Path | When |
|---|---|---|
| **caveman** | `.agents/skills/caveman/SKILL.md` | User says "caveman mode", "talk like caveman", "use caveman", "less tokens", `/caveman`, or asks for token-efficient replies |
| **cavecrew** | `.agents/skills/cavecrew/SKILL.md` | User says "delegate to subagent", "use cavecrew", "spawn investigator/builder/reviewer", "save context", or wants compressed subagent output |

Read the matching `SKILL.md` and follow it for that turn/session only.
