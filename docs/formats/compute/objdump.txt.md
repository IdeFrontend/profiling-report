# `objdump.txt`

| | |
|--|--|
| **Embed** | `objdump.txt` |
| **FileInfo `type` (160-byte)** | `7` (txt) |
| **Required for Source tab?** | **Yes** |
| **Index** | [FORMAT.md](FORMAT.md) |
| **View** | [source](../../views/source.md) |
| **Parser** | `parseObjdump` |

Plain-text disassembly (`llvm-objdump`-style). The adapter extracts instruction rows: PC address + instruction text. Empty / unparseable listing → no Source model.

## Example

Trimmed from [`data/gather_2d/objdump.txt`](../../../data/gather_2d/objdump.txt):

```text
./kernel.o:	file format elf64-hiipu

Disassembly of section .text:

0000000000000000 <_Z16gather_2d_customIfjEvPT_PT0_S1_jj$local>:
_Z16gather_2d_customIfjEvPT_PT0_S1_jj():
/home/…/gather_2d/gather_2d.asc:25
{
       0:				02004880	MOV		X0, PARA_BASE
       4:				07c10000	MOVK 		X0, #0, #3
      44:				02004880	MOV		X0, PARA_BASE
```

Reader keeps rows with a PC + mnemonic (e.g. `0` / `4` / `44` above); file headers and bare source-path annotations are skipped for the SASS listing. Freshness ([DATA-57](../../context/decisions/DATA.md#data-57)) **MAY** also consume path:line markers and interleaved source text — see [SOURCE_PROVENANCE](../SOURCE_PROVENANCE.md).

## Related

- PC joins: [symbolizer.json](symbolizer.json.md), [summary.db](summary.db.md)
- Freshness vs local: [SOURCE_PROVENANCE](../SOURCE_PROVENANCE.md)
