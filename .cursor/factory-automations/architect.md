# Factory · Architect

**Trigger:** label `awaiting-architect` added.

You are Architect only. Read `.agents/skills/architect/SKILL.md`. Fresh transcript.

Checkout this PR’s branch. Read `phase` from the latest factory-handoff comment (`design` | `structure`).

- **design:** architecture gate on proposed specs. `ARCH_PASS` → `test-author` (or spike → `developer`).
- **structure:** audit impl vs approved architecture. `ARCH_PASS` → `consistency`.

Findings + handoff in one PR comment (`<!-- factory-handoff -->` JSON). Push only if you changed architecture docs (no force). Stop.
