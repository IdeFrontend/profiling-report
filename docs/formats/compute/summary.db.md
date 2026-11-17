# `summary.db` (PC sampling)

| | |
|--|--|
| **Embed** | `summary.db` |
| **FileInfo `type` (160-byte)** | `5` (sqlite3) |
| **Required for Source tab?** | One of [symbolizer.json](symbolizer.json.md) / summary.db |
| **Index** | [FORMAT.md](FORMAT.md) |
| **View** | [source](../../views/source.md) |
| **Parser** | `readPcSamplingDb` (+ `ensurePcSamplingSql`) |
| **Open** | [DATA-55](../../context/questions/DATA.md) (extra metric columns) |

SQLite. Reader accepts **exactly one** of two producer schemas (no mixing; case-significant column names). Prefer [`pc_sampling`](summary.db.md#pc_sampling) when both table names exist.

**Sampling Stall** on a PC = sum of present stall counters (tooltip breakdown). Mapped source lines: sum stall + instructions; average occupancy. Hosts must `await ensurePcSamplingSql()` (or use ProfilingReport’s load path) before adapting packs with `summary.db`. Corrupt / missing sql.js → warn + zero stalls; report still loads.

## `pc_sampling` {#pc_sampling}

| | |
|--|--|
| **Parent embed** | [`summary.db`](summary.db.md) |
| **Table name** | `pc_sampling` |
| **Typical origin** | Fixture / older packs |
| **Index** | [FORMAT.md](FORMAT.md) |

| Column | Role |
|--------|------|
| `pc_offset` | PC as hex text (e.g. `0x198`) |
| `IBuf_Empty`, `Nop_Cycles`, `Scoreboard_Not_Ready`, `Register_bank_conflict`, `Resource_conflict`, `Warp_Level_Sync`, `Divergence_Stack_Spill`, `Others` | Stall counters |
| `Instructions_Executed`, `Warp_Occupancy` | Optional; absent → those metrics stay 0 ([DATA-55](../../context/questions/DATA.md)) |

## Example

Schema + rows from [`data/gather_2d/summary.db`](../../../data/gather_2d/summary.db):

```sql
CREATE TABLE pc_sampling (
  "pc_offset" TEXT PRIMARY KEY NOT NULL,
  "IBuf_Empty" INTEGER NOT NULL,
  "Nop_Cycles" INTEGER NOT NULL,
  "Scoreboard_Not_Ready" INTEGER NOT NULL,
  "Register_bank_conflict" INTEGER NOT NULL,
  "Resource_conflict" INTEGER NOT NULL,
  "Warp_Level_Sync" INTEGER NOT NULL,
  "Divergence_Stack_Spill" INTEGER NOT NULL,
  "Others" INTEGER NOT NULL
);

-- sample rows (hex PC text)
INSERT INTO pc_sampling VALUES ('0x388', 0, 8, 0, 0, 0, 0, 0, 0);
INSERT INTO pc_sampling VALUES ('0x350', 0, 0, 0, 0, 0, 0, 0, 0);
INSERT INTO pc_sampling VALUES ('0x7b8', 0, 16, 0, 0, 0, 0, 0, 0);
-- Sampling Stall(0x388) = 8; Sampling Stall(0x7b8) = 16
```

## Related

- Alternate producer spelling: [PcSampling](summary.db.md#PcSampling)
- Embed rules: [summary.db](summary.db.md)

## `PcSampling` {#PcSampling}

| | |
|--|--|
| **Parent embed** | [`summary.db`](summary.db.md) |
| **Table name** | `PcSampling` |
| **Typical origin** | Producer `libnpu_compute_processor` |
| **Index** | [FORMAT.md](FORMAT.md) |

| Column | Role |
|--------|------|
| `address` | PC as integer (decimal) |
| `ibuf_empty`, `nop_cycles`, `scoreboard_not_ready`, `register_bank_conflict`, `resource_conflict`, `warp_level_sync`, `divergence_stack_spill`, `others` | Stall counters |

## Example

Producer-shaped table (values from unit fixture / customer pack):

```sql
CREATE TABLE PcSampling(
  address INTEGER NOT NULL PRIMARY KEY,
  ibuf_empty INTEGER NOT NULL CHECK(ibuf_empty>=0),
  nop_cycles INTEGER NOT NULL CHECK(nop_cycles>=0),
  scoreboard_not_ready INTEGER NOT NULL CHECK(scoreboard_not_ready>=0),
  register_bank_conflict INTEGER NOT NULL CHECK(register_bank_conflict>=0),
  resource_conflict INTEGER NOT NULL CHECK(resource_conflict>=0),
  warp_level_sync INTEGER NOT NULL CHECK(warp_level_sync>=0),
  divergence_stack_spill INTEGER NOT NULL CHECK(divergence_stack_spill>=0),
  others INTEGER NOT NULL CHECK(others>=0)
);

INSERT INTO PcSampling VALUES (408, 0, 8, 0, 0, 0, 0, 0, 0);       -- 0x198
INSERT INTO PcSampling VALUES (616, 0, 272, 18360, 0, 0, 0, 0, 0); -- 0x268
-- Sampling Stall(0x268) = 272 + 18360 = 18632
```

Reader normalizes `address` to hex `pcOffset` for joins against [`objdump.txt`](objdump.txt.md).

## Related

- Alternate fixture spelling: [pc_sampling](summary.db.md#pc_sampling)
- Embed rules: [summary.db](summary.db.md)
