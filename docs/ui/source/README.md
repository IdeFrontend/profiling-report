# Design sources

Full-frame high-res design dumps. **Append-only** by batch; do not overwrite files in place — add a new batch folder when product design changes.

## Layout

```
source/
  manifest.yaml     machine index (stable ids, original names, component hints)
  v930/             930 性能调优 dump (canonical)
```

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
