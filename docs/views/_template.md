# View packet template

Copy this file to `docs/views/<kebab-id>.md`. Heading order is **fixed** — do not reorder.

```markdown
# <Human title>

| | |
|--|--|
| **Id** | `<kebab-id>` |
| **Panel / component** | `<Component>` → `src/ui/…` |
| **Capability** | _(none)_ or e.g. `memoryDiagram`, `roofline` |
| **Phase** | M / M1 / M2 / P2 |
| **Unification** | `same-path` \| `adapt-mapper` \| `gap` \| `out-of-scope` |
| **Sept 30 (emulate)** | `in` \| `hide` \| `stretch` |

## Sketches

![<caption>](../ui/source/v930/<file>.jpeg)

**Component crop (optional):** ![<caption>](../../src/ui/<Component>/visual/<file>.png)

If no mockup yet: _Sketch gap: …_

## Purpose

One or two sentences: what the user sees and why.

## View-model

| Field | Role | Required? |
|-------|------|-----------|
| … | … | **Required to show** / Optional |

## Hide rule

When the surface is omitted ([DATA-30](../context/decisions/DATA.md)).

## Compute fill

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| … | … | … | [compute/…](../formats/compute/…) |

## Emulate fill

| Adapted field | Embed | Columns / notes | Status |
|---------------|-------|-----------------|--------|
| … | … | … | `adapt-mapper` / `gap` / `out-of-scope` + blocker |

## Adapter

| Profile | Entry | Notes |
|---------|-------|-------|
| compute | `adaptCompute` / `adaptPayloads` | … |
| emulate | `adaptEmulate` | … |

## Related

- UX scenario: [UX_SPEC](../ui/UX_SPEC.md) S…
- FEATURE_MATRIX: [FEATURE_MATRIX](../ui/FEATURE_MATRIX.md)
- Co-located spec: `src/ui/…/*.spec.md`
- Product docx § (if any):
- Open / interim questions:
```

### Section rules

| Section | Required? | Must not |
|---------|-----------|----------|
| Title + meta | yes | Renumber ids casually |
| Sketches | yes | Copy binaries into `docs/views/` |
| Purpose | yes | Full UX scenario prose |
| View-model | yes | Raw CSV names as Required column |
| Hide rule | yes | Profile-forked hide matrices |
| Compute fill | yes | Paste full CSV dictionaries |
| Emulate fill | yes | Invent compute CSV names ([DATA-40](../context/decisions/DATA.md)) |
| Adapter | yes | Duplicate ADAPTERS fill tables |
| Related | yes | Duplicate component AC lists |

**SSOT:** formats live under [`../formats/`](../formats/); this tree owns consumer surfaces only. See [README.md](README.md).
