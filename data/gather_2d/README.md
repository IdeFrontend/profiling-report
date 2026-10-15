# gather_2d Source-tab sample (from `sample.zip`)

Compute-profile leaf extracted from the operator pack for Source | SASS work.

| Artifact | Role |
|---|---|
| `summary.db` | SQLite `pc_sampling` — stall counters keyed by `pc_offset` |
| (zip) `symbolizer.json` | PC → `gather_2d.asc` / function (line often `0` in this pack) |
| (zip) `objdump.txt` | Disassembly listing |
| (zip root) `gather_2d.asc` | Ascend C SIMT source (outside the import folder) |

`summary.db` is committed so unit tests can open it via `sql.js` without the full zip.
The remaining files stay in `sample.zip` at the worktree root until a real-pack adapter lands.
