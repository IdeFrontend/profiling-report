# `manifest.json`

| | |
|--|--|
| **Profile** | `emulate` |
| **Role** | Emulate detection marker ([PROC-8](../../context/decisions/PROC.md)) |
| **Catalog** | [FORMAT.md](FORMAT.md) · [TABLES.md](TABLES.md) |

Thin `{ "profile": "emulate", "schemaVersion": … }` **or** export catalog with hub objects (`database`, `exported_at`, `objects[]`, …).

## Example (thin)

```json
{ "profile": "emulate", "schemaVersion": 1 }
```

See [FORMAT.md](FORMAT.md) for export-catalog shape.
