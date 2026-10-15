# gather_2d Source-tab sample (from `sample.zip`)

Compute-profile embeds for the real Source | SASS adapter (`adaptComputeSourceCorrelation`).

| Artifact | Role |
|---|---|
| `gather_2d.asc` | Ascend C SIMT source |
| `objdump.txt` | Disassembly → SASS pane |
| `symbolizer.json` | PC → file/function/line (this pack: `Line: 0` — [DATA-54](../../docs/context/questions/DATA.md)) |
| `summary.db` | SQLite `pc_sampling` stall counters by `pc_offset` (needs `sql.js`) |

Original zip also carries PipeTrace / metric CSVs under `npu-compute-import-*/` (timeline path, not Source-specific).
`sample.zip` at the worktree root is gitignored; these four files are the committed fixture.
