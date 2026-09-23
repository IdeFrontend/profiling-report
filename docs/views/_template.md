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

Prefer a normative derivation table (required when more than one embed contributes, or any join is involved):

| VM field | Source embed(s) | Join key(s) | Derivation |
|----------|-----------------|-------------|------------|
| … | `Foo.csv`, `Bar.csv` | `Foo.Id` = `Bar.FooId` | formula / column / mean / first-non-NA |

Also OK: short adapted-field overview + slot/edge tables for this surface. Exemplar: [performance-hints.md](performance-hints.md).

| Adapted field | Embed | Columns / notes | Schema SSOT |
|---------------|-------|-----------------|-------------|
| … | … | … | [compute/…](../formats/compute/…) |

## Emulate fill

Same **VM field \| embed(s) \| join key(s) \| derivation** shape as Compute fill. Status column optional.

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
| Compute fill | yes | Paste full CSV dictionaries (adapted **slot / edge / column** tables OK). When fills join embeds, document **join keys** and **per-field derivation** (see performance-hints exemplar) |
| Emulate fill | yes | Invent compute CSV names ([DATA-45](../context/decisions/interim/DATA.md#data-45)); same slot/edge + join/key/derivation rule as Compute fill |
| Adapter | yes | Duplicate ADAPTERS fill tables |
| Related | yes | Duplicate component AC lists |

**SSOT:** formats live under [`../formats/`](../formats/); this tree owns consumer surfaces **and** their display→field→source maps. See [README.md](README.md).
