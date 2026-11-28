# Design sources

Full-frame high-res design dumps. **Append-only** by batch; do not overwrite files in place — add a new batch folder when product design changes. A resolution-only replacement of an existing id (same frame, higher resolution) may overwrite that file.

## Layout

```
source/
  manifest.yaml     machine index (stable ids, original names, component hints)
  930/              current 930 Octo/HDesign export — per-screen folders (arkUIDSL + screenshot + assets),
                    shared fonts/tailwind/assets in 930/_shared/, indexed in ../DESIGN_INDEX.md
  930-legacy/       four legacy 930 frames with no export equivalent (fullscreen topology overlay,
                    Source/SASS view, official chrome SVG, roofline review card); everything else
                    from the old dumps is superseded by 930/ and removed
  1130/             1130 Octo/HDesign export — same per-screen layout, indexed in ../DESIGN_INDEX.md
```

The 930 and 1130 batches are **not** the append-only jpeg convention: each screen is a folder
with the Octo export (`arkUIDSL.json` — the single source of truth, `screenshot.png`, sanitized
`index.html`, `assets/`). Work with it via the design-tools skill
(`.agents/skills/design-tools/SKILL.md`): `npm run design:sanitize|render|diff|find`.

## Naming

| Item | Convention | Example |
|------|------------|---------|
| Batch folder | `{batchId}/` | `v930/` |
| Frame file | `{scene-kebab}.{ext}` | `entry.jpeg` |
| Stable id | `{batchId}/{scene}` | `v930/entry` |

Original Chinese filenames are recorded only in [`manifest.yaml`](./manifest.yaml) as `original_name`.

## Downstream

- **Component crops**: `src/ui/{Component}/visual/` with `provenance.yaml` pointing back here
- **Index**: [`../DESIGN_INDEX.md`](../DESIGN_INDEX.md)

## Annotations in mockups

Filled purple rectangles (#C068FA) with white text are annotations, not controls. Each one carries a leader line that ends in a dot. Read the element the dot points at. Do not copy the purple as a button color, a background, or a palette token.
