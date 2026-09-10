# Cursor Automations for factory roles

Prompt files for **one Automation per role**. Save each in Cursor Automations with:

- Trigger: GitHub **label change** on `IdeFrontend/profiling-report` matching the label in the file.
- Developer also: **checks completed** where the check name is `red-stage` and it passed (only after Spec `COVERAGE_PASS`).
- Tools: PR comment (and PR review for Reviewer), git checkout of the PR branch.
- Fresh cloud agent every run. Never resume the previous role’s agent.

| Automation | Label trigger | Prompt file |
|------------|---------------|-------------|
| Factory Spec Author | `awaiting-spec` | [spec-author.md](spec-author.md) |
| Factory Architect | `awaiting-architect` | [architect.md](architect.md) |
| Factory Test Author | `awaiting-tests` | [test-author.md](test-author.md) |
| Factory Developer | `awaiting-dev` | [developer.md](developer.md) |
| Factory Fixer | `awaiting-fixer` | [fixer.md](fixer.md) |
| Factory Consistency | `awaiting-consistency` | [consistency.md](consistency.md) |
| Factory Performance | `awaiting-perf` | [performance.md](performance.md) |
| Factory Reviewer | `awaiting-review` | [reviewer.md](reviewer.md) |

Prefill drafts can be opened from chat via Cursor Automations (`open_automation`). **Finish in the editor:** confirm repo `IdeFrontend/profiling-report`, label filter, tools, then Save. If the UI copy drifts from these files, fix the UI or stop using Automations.

Handoff bus = structured PR comments (`<!-- factory-handoff -->`), not repo files. Agents push only when they change product/spec/test files.

Do not enable Autopilot on factory PRs.
