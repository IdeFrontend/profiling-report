# `symbolizer.json`

| | |
|--|--|
| **Embed** | `symbolizer.json` |
| **FileInfo `type` (160-byte)** | `2` (json) |
| **Required for Source tab?** | One of symbolizer / [summary.db](summary.db.md) |
| **Index** | [FORMAT.md](FORMAT.md) |
| **View** | [source](../../views/source.md) |
| **Parser** | `parseSymbolizer` |
| **Open** | [DATA-54](../../context/questions/DATA.md) (`Line: 0`) |

JSON **array** of sites (gather_2d shape).

**Entry (typical keys):** `Address`, `ModuleName`, `Symbol` (array).

**First `Symbol[0]` keys observed:** `FileName`, `FunctionName`, `Line`, `Column`, `Discriminator`, `StartAddress`, `StartFileName`, `StartLine`.

## Reader contract

| Field | Use |
|-------|-----|
| `Address` | PC (normalized hex) |
| `Symbol[0].FileName` | Source path (often absolute build path) |
| `Symbol[0].Line` | 1-based line; **`Line <= 0` → unmapped** ([DATA-54](../../context/questions/DATA.md) interim) |
| `Symbol[0].FunctionName` | Stored; optional |

Other Symbol keys are ignored by the current reader. Correlation maps: `sourceToAsm` / `asmToSource` keyed by `` `${fileId}:${line}` `` with `fileId` = **basename** of `FileName`. Distinct basenames → separate source files (first-seen order).

## Example

Two sites from [`data/gather_2d/symbolizer.json`](../../../data/gather_2d/symbolizer.json) — mapped + `Line: 0`:

```json
[
  {
    "Address": "0x198",
    "ModuleName": "kernel.o",
    "Symbol": [
      {
        "Column": 47,
        "Discriminator": 0,
        "FileName": "/home/…/gather_2d/gather_2d.asc",
        "FunctionName": "",
        "Line": 27,
        "StartAddress": "0x198",
        "StartFileName": "/home/…/gather_2d/gather_2d.asc",
        "StartLine": 23
      }
    ]
  },
  {
    "Address": "0x200",
    "ModuleName": "kernel.o",
    "Symbol": [
      {
        "Column": 31,
        "Discriminator": 0,
        "FileName": "/home/…/gather_2d/gather_2d.asc",
        "FunctionName": "$d.18",
        "Line": 0,
        "StartAddress": "0x1e2",
        "StartFileName": "/home/…/gather_2d/gather_2d.asc",
        "StartLine": 23
      }
    ]
  }
]
```

`0x198` → file id `gather_2d.asc`, line `27`. `0x200` stays unmapped (`Line: 0`).

## Related

- Disassembly PCs: [objdump.txt](objdump.txt.md)
- Source text basename match: [source text](symbolizer.json.md#source-text)

## Source text embeds (`.asc` / `.cpp` / `.h`) {#source-text}


| | |
|--|--|
| **Embed** | `*.asc` / `*.cpp` / `*.h` (basename match) |
| **FileInfo `type` (160-byte)** | `7` (txt) |
| **Required for Source tab?** | No (optional) |
| **Index** | [FORMAT.md](FORMAT.md) |
| **View** | [source](../../views/source.md) |
| **Host fill** | `resolveSourceFile` ([#175](https://github.com/IdeFrontend/profiling-report/issues/175)) |
| **Open** | [DATA-52](../../context/questions/DATA.md) (pack `.asc` rule) |

- Lookup: exact path, basename, or case-insensitive basename against pack keys.
- Encoding: UTF-8 decode (`fatal: false`).
- Missing text: placeholder `// missing source embed: <path>` sized to mapped line count; metrics rollups kept for later `resolveSourceFile`.

## Example

Trimmed from [`data/gather_2d/gather_2d.asc`](../../../data/gather_2d/gather_2d.asc); playground pack embeds this as FileInfo `gather_2d.asc`:

```c
#include "acl/acl.h"

template <typename type_data, typename type_idx>
__global__ void gather_2d_custom(
    type_data* input, type_idx* index, type_data* gather_output,
    uint32_t in_width, uint32_t index_total_length)
{
    // Calculate global thread ID
    int32_t out_row = blockIdx.x * blockDim.x + threadIdx.x;

    // Maps to the row index of output tensor
    if (out_row >= index_total_length) {
```

Symbolizer `FileName` basename `gather_2d.asc` must match the embed name for the left pane to fill without `resolveSourceFile`.

## Related

- Basename source: [symbolizer.json](symbolizer.json.md)
