#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate the Source-diff demo fixtures under `data/source-diff/`:

  left.npu-rep   leaf 160-byte npu-rep (objdump.txt / symbolizer.json / summary.db / sharpen.asc /
                 PipeTrace.json)
  mid.npu-rep    leaf 160-byte npu-rep, same embeds, sharpen_mid.asc: a third
                 HwdefectFind signature plus a changed `threshold` initializer
  right.npu-rep  leaf 160-byte npu-rep, same embeds, sharpen.asc with one changed line
                 and five lines that exist only on the LEFT
  demo.npu-rep   outer 160-byte npu-rep with three `type 1` entries whose payloads are
                 exactly the three leaf files (operators `left` / `mid` / `right`)

Layout matches `src/adapters/parseNpuRep160.ts` / `data/scripts/pack_rep.py`:
36-byte head (version 0x00010000, origin 1, fileInfoLength 160), 160-byte
FileInfo entries, payloads contiguous and covering the file exactly.

Both leaves share the same symbolizer mapping, so line numbers stay comparable.
Only line 37 (`HwdefectFind`) plus the five left-only lines differ. summary.db
gives that changed line distinct Warp_Occupancy (0.5 left / 0.8 right) and the
same Instructions_Executed (135332032). `sharpen_mid.asc` keeps the left line
count and differs on line 1 (doxygen marker), line 37 (third signature) and
line 49 (`>` vs `>=`).
"""

import json
import os
import struct
import sys

MAGIC = b"npu-rep\x00"
VERSION = 0x00010000
ORIGIN = 1
HEAD_SIZE = 36
FILEINFO_SIZE = 160

TYPE_NESTED = 1
TYPE_JSON = 2
TYPE_SQLITE = 5
TYPE_TXT = 7

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source-diff")
DONOR_REP = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "gather_2d.npu-rep"
)


def load_donor_entry(entry_name):
    """Read a payload from the donor pack with the repo's own unpacker."""
    sys.path.insert(
        0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts")
    )
    from unpack_rep import decode_rep

    with open(DONOR_REP, "rb") as fh:
        _header, entries = decode_rep(fh.read(), DONOR_REP)
    for name, _type, payload in entries:
        if name == entry_name:
            return payload
    raise RuntimeError(f"{entry_name} is missing from {DONOR_REP}")


# --- source texts -----------------------------------------------------------
# Left-only lines are inserted right after `uint32_t acc = 0;` so the diff reads:
# common prefix, one modified line (`Mat * deslm` vs `Mat * endlm`), five lines
# only in the left file, common suffix. LEFT has exactly 5 more lines.
SOURCE_PREFIX = [
    "/* !",
    " * \\file sharpen.asc",
    " * \\brief Ascend C sharpen kernel: GM -> L1 -> UB -> GM.",
    " */",
    '#include "kernel_operator.h"',
    "",
    "using namespace AscendC;",
    "",
    "constexpr int32_t TILE_ROWS = 16;",
    "",
    "class KernelSharpen {",
    "public:",
    "    __aicore__ inline void Init(__gm__ uint8_t *src, __gm__ uint8_t *dst)",
    "    {",
    "        srcGm.SetGlobalBuffer((__gm__ half *)src);",
    "        dstGm.SetGlobalBuffer((__gm__ half *)dst);",
    "        pipe.InitBuffer(inQueue, 2, TILE_ROWS * sizeof(half));",
    "        pipe.InitBuffer(outQueue, 2, TILE_ROWS * sizeof(half));",
    "    }",
    "",
    "    __aicore__ inline void Process(int32_t blocks)",
    "    {",
    "        for (int32_t r = 0; r < blocks; ++r) {",
    "            CopyIn(r);",
    "            SharpenWindow(r);",
    "        }",
    "    }",
    "",
    "private:",
    "    __aicore__ inline void CopyIn(int32_t r)",
    "    {",
    "        LocalTensor<half> src = inQueue.AllocTensor<half>();",
    "        DataCopy(src, srcGm[r * TILE_ROWS], TILE_ROWS);",
    "        inQueue.EnQue(src);",
    "    }",
    "",
]

CHANGED_LEFT = "    __aicore__ inline void HwdefectFind(Mat srclm, Mat * deslm)"
CHANGED_RIGHT = "    __aicore__ inline void HwdefectFind(Mat srclm, Mat * endlm)"

BODY_OPEN = [
    "    {",
    "        uint32_t acc = 0;",
]

LEFT_ONLY = [
    "        uint32_t bad = 0;",
    "        uint32_t good = 0;",
    "        uint32_t mean = 0;",
    "        uint32_t var = 0;",
    "        uint32_t edge = 0;",
]

SOURCE_SUFFIX = [
    "        for (uint32_t i = 0; i < TILE_ROWS; ++i) {",
    "            acc += srcLm.GetValue(i) * kernelWeight[i];",
    "        }",
    "        desLm->SetValue(0, acc);",
    "        defectCount += acc > threshold ? 1 : 0;",
    "    }",
    "",
    "    __aicore__ inline void SharpenWindow(int32_t r)",
    "    {",
    "        LocalTensor<half> src = inQueue.DeQue<half>();",
    "        LocalTensor<half> dst = outQueue.AllocTensor<half>();",
    "        HwdefectFind(Mat(src), &Mat(dst));",
    "        outQueue.EnQue(dst);",
    "        inQueue.FreeTensor(src);",
    "    }",
    "",
    "    TPipe pipe;",
    "    GlobalTensor<half> srcGm;",
    "    GlobalTensor<half> dstGm;",
    "    TQue<TPosition::VECIN, 2> inQueue;",
    "    TQue<TPosition::VECOUT, 2> outQueue;",
    "    half kernelWeight[TILE_ROWS];",
    "    uint32_t threshold = 64;",
    "    uint32_t defectCount = 0;",
    "};",
]


def source_lines(changed, extra):
    return SOURCE_PREFIX + [changed] + BODY_OPEN + extra + SOURCE_SUFFIX


LEFT_LINES = source_lines(CHANGED_LEFT, LEFT_ONLY)
RIGHT_LINES = source_lines(CHANGED_RIGHT, [])
CHANGED_LINE = LEFT_LINES.index(CHANGED_LEFT) + 1
LEFT_ONLY_LINES = list(
    range(LEFT_LINES.index(LEFT_ONLY[0]) + 1, LEFT_LINES.index(LEFT_ONLY[-1]) + 2)
)

# Row 1 differs so the first rendered row changes when the baseline drops from mid to right.
MID_HEADER_FROM = "/* !"
MID_HEADER_TO = "/*!"
CHANGED_MID = "    __aicore__ inline void HwdefectFind(Mat srclm, Mat * dstlm)"
# Line 49 is one of the 24 symbolizer-mapped lines, so its metrics are visible.
MID_EDIT_FROM = "        defectCount += acc > threshold ? 1 : 0;"
MID_EDIT_TO = "        defectCount += acc >= threshold ? 1 : 0;"
MID_SOURCE_NAME = "sharpen_mid.asc"

MID_LINES = list(LEFT_LINES)
MID_LINES[0] = MID_HEADER_TO
MID_LINES[MID_LINES.index(CHANGED_LEFT)] = CHANGED_MID
MID_LINES[MID_LINES.index(MID_EDIT_FROM)] = MID_EDIT_TO
MID_EDIT_LINE = MID_LINES.index(MID_EDIT_TO) + 1


def check_source_shape():
    import difflib

    left = "\n".join(LEFT_LINES) + "\n"
    mid = "\n".join(MID_LINES) + "\n"
    right = "\n".join(RIGHT_LINES) + "\n"
    if len(LEFT_LINES) - len(RIGHT_LINES) != 5:
        raise RuntimeError(
            f"left has {len(LEFT_LINES)} lines, right {len(RIGHT_LINES)}, want +5"
        )
    if len(MID_LINES) != len(LEFT_LINES):
        raise RuntimeError(
            f"mid has {len(MID_LINES)} lines, left {len(LEFT_LINES)}, want equal"
        )
    ops = difflib.SequenceMatcher(
        None, left.splitlines(), right.splitlines()
    ).get_opcodes()
    kinds = [op[0] for op in ops]
    if (
        kinds.count("replace") != 1
        or kinds.count("delete") != 1
        or kinds.count("insert") != 0
    ):
        raise RuntimeError(f"unexpected diff opcodes: {ops}")
    replace = ops[kinds.index("replace")]
    delete = ops[kinds.index("delete")]
    if replace[2] - replace[1] != 1 or replace[4] - replace[3] != 1:
        raise RuntimeError(f"modified block is not one-for-one: {replace}")
    if delete[2] - delete[1] != 5:
        raise RuntimeError(f"left-only block is {delete[2] - delete[1]} lines, want 5")
    mid_ops = difflib.SequenceMatcher(
        None, left.splitlines(), mid.splitlines()
    ).get_opcodes()
    changed = [(op[1] + 1, op[3] + 1) for op in mid_ops if op[0] != "equal"]
    if changed != [
        (1, 1),
        (CHANGED_LINE, CHANGED_LINE),
        (MID_EDIT_LINE, MID_EDIT_LINE),
    ]:
        raise RuntimeError(
            f"mid diff lines {changed}, want 1, {CHANGED_LINE} and {MID_EDIT_LINE}"
        )
    if MID_EDIT_LINE == CHANGED_LINE:
        raise RuntimeError("mid changes the same line twice")
    if any(len(line) > 88 for line in MID_LINES):
        raise RuntimeError("mid source line exceeds 88 chars")
    if any(len(line) >= 100 for line in LEFT_LINES + RIGHT_LINES):
        raise RuntimeError("source line reaches 100 chars")
    if any(
        ord(ch) > 0x7F for line in LEFT_LINES + MID_LINES + RIGHT_LINES for ch in line
    ):
        raise RuntimeError("source contains non-ASCII characters")
    return left, mid, right


# --- packer + helpers (copied from build_sample_rep.py) ---------------------


def pack_npu_rep(entries):
    """entries: list of (name: str, type: int, data: bytes). Returns 160-byte npu-rep."""
    n = len(entries)
    data_start = HEAD_SIZE + n * FILEINFO_SIZE
    layout = []
    cur = data_start
    for name, typ, data in entries:
        layout.append((name, typ, data, cur, len(data)))
        cur += len(data)
    total = cur

    head = struct.pack(
        "<8sIHHIIIQ",
        MAGIC,
        VERSION,
        ORIGIN,
        HEAD_SIZE,
        n,
        FILEINFO_SIZE,
        0,
        total,
    )
    assert len(head) == HEAD_SIZE

    info_blocks = []
    for name, typ, data, offset, length in layout:
        name_bytes = os.path.basename(name).encode("utf-8")
        name_bytes = (
            name_bytes.ljust(128, b"\x00")
            if len(name_bytes) < 128
            else name_bytes[:127] + b"\x00"
        )
        info = struct.pack("<8s128sHHIQQ", MAGIC, name_bytes, typ, 0, 0, length, offset)
        assert len(info) == FILEINFO_SIZE
        info_blocks.append(info)

    out = bytearray(head)
    for block in info_blocks:
        out += block
    for _name, _typ, data, _offset, _length in layout:
        out += data
    return bytes(out)


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def rand():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return rand


def _split_total(total, weights):
    weight = sum(weights) or 1
    counts = [total * w // weight for w in weights]
    counts[weights.index(max(weights))] += total - sum(counts)
    return counts


_STALL_COLUMNS = (
    "IBuf_Empty",
    "Nop_Cycles",
    "Scoreboard_Not_Ready",
    "Register_bank_conflict",
    "Resource_conflict",
    "Warp_Level_Sync",
    "Divergence_Stack_Spill",
    "Others",
)

# --- objdump + symbolizer ---------------------------------------------------

MNEMONICS = [
    ("MOV", "X0, PARA_BASE"),
    ("LD_IO.b64", "X10, [X7], #0, #0"),
    ("SET_FLAG", "MTE2, VECIN, EVENT_ID0"),
    ("WAIT_FLAG", "MTE2, VECIN, EVENT_ID0"),
    ("ND2NZ", "[L1], [GM], X3"),
    ("LOAD2D", "UB, L1, X5"),
    ("LD_XD_XN", "X8, [X17], #16"),
    ("MOVI", "X29, #65184"),
    ("ADD.s64", "X29, X29, X15"),
    ("SHLI.b64", "X17, #14"),
    ("MADD.s64", "X29, X15, X17"),
    ("ST_XD_XN", "[L1], X29"),
    ("DIV.u64", "X3, X2, X5"),
    ("MUL.s64", "X12, X6, X5"),
    ("REM.u64", "X3, X3, X6"),
    ("SUB.s64", "X2, X2, X13"),
    ("INSERT", "X12, X3, #0, #31"),
    ("ST_IO.b32", "X12, [X8], #8, #0"),
    ("PIPE_BARRIER", "PIPE_V"),
    ("MOV_OUT_TO_UB", "UB, L0C"),
    ("MOVI", "X16, #32767"),
    ("AND.b64", "X15, X15, X16"),
    ("ADDI", "X15, X15, #1"),
    ("OR.b64", "X2, X2, X4"),
]


def symbolizer_lines():
    """24 distinct source lines: the changed line, the five left-only lines, then spread."""
    required = [CHANGED_LINE, *LEFT_ONLY_LINES]
    rest = [n for n in range(4, len(LEFT_LINES) + 1) if n not in required]
    step = max(1, len(rest) // (len(MNEMONICS) - len(required)))
    picked = rest[::step][: len(MNEMONICS) - len(required)]
    lines = sorted(set(required) | set(picked))
    if len(lines) > len(MNEMONICS):
        lines = lines[: len(MNEMONICS)]
    if len(lines) < 20:
        raise RuntimeError(f"symbolizer covers {len(lines)} lines, want >= 20")
    if len(lines) != len(MNEMONICS):
        raise RuntimeError(
            f"symbolizer lines {len(lines)} != instructions {len(MNEMONICS)}"
        )
    return lines


SYM_LINES = symbolizer_lines()
if MID_EDIT_LINE not in SYM_LINES:
    raise RuntimeError(f"mid edit line {MID_EDIT_LINE} is not symbolizer-mapped")


def pcs():
    return [0x100 + 4 * i for i in range(len(MNEMONICS))]


def build_objdump():
    rows = [
        "kernel.o:\tfile format elf64-hiipu",
        "",
        "Disassembly of section .text:",
        "",
        "0000000000000100 <sharpen>:",
    ]
    for i, ((mnem, ops), line) in enumerate(zip(MNEMONICS, SYM_LINES)):
        pc = 0x100 + 4 * i
        if line == CHANGED_LINE:
            rows.append("")
            rows.append(f"{pc:016x} <HwdefectFind>:")
        enc = 0x02004880 + (i * 0x101) & 0xFFFFFFFF
        rows.append(f"     {pc:x}:\t{enc:08x}\t{mnem}\t{ops}")
    rows.append("")
    return "\n".join(rows)


def build_symbolizer(file_name="sharpen.asc"):
    sites = []
    for pc, line in zip(pcs(), SYM_LINES):
        fn = "HwdefectFind" if line == CHANGED_LINE else "sharpen"
        sites.append(
            {
                "Address": f"0x{pc:x}",
                "ModuleName": "kernel.o",
                "Symbol": [
                    {
                        "Column": 1,
                        "Discriminator": 0,
                        "FileName": file_name,
                        "FunctionName": fn,
                        "Line": line,
                        "StartAddress": f"0x{pc:x}",
                        "StartFileName": file_name,
                        "StartLine": 1,
                    }
                ],
            }
        )
    return json.dumps(sites, indent=2)


def build_summary_db(seed, special):
    """Same rows for every leaf; `special` maps line -> (executed, occupancy)."""
    import sqlite3

    rand = mulberry32(seed)
    rows = []
    for pc, line in zip(pcs(), SYM_LINES):
        stall = 400 + int(rand() * 2400)
        parts = _split_total(stall, [1, 2, 9, 3, 4, 1, 0, 1])
        if line in special:
            executed, occ = special[line]
        else:
            executed = 500 + int(rand() * 20000)
            occ = 0.2 + rand() * 0.6
        rows.append((f"0x{pc:x}", *parts, executed, occ))

    con = sqlite3.connect(":memory:")
    stall_cols = ", ".join(f'"{name}" INTEGER NOT NULL' for name in _STALL_COLUMNS)
    con.execute(
        "CREATE TABLE pc_sampling ("
        '"pc_offset" TEXT PRIMARY KEY NOT NULL, '
        f"{stall_cols}, "
        '"Instructions_Executed" INTEGER NOT NULL, '
        '"Warp_Occupancy" REAL NOT NULL)'
    )
    placeholders = ",".join(["?"] * (3 + len(_STALL_COLUMNS)))
    con.executemany(f"INSERT INTO pc_sampling VALUES ({placeholders})", rows)
    con.commit()
    blob = con.serialize()
    con.close()
    if len(blob) < 100 or not blob.startswith(b"SQLite format 3\x00"):
        raise RuntimeError("summary.db is not a sqlite database")
    return blob


def leaf(asc_text, source_name, special):
    return pack_npu_rep(
        [
            ("objdump.txt", TYPE_TXT, OBJDUMP_TXT.encode("utf-8")),
            (
                "symbolizer.json",
                TYPE_JSON,
                build_symbolizer(source_name).encode("utf-8"),
            ),
            ("summary.db", TYPE_SQLITE, build_summary_db(0x5EED, special)),
            (source_name, TYPE_TXT, asc_text.encode("utf-8")),
            ("PipeTrace.json", TYPE_JSON, PIPE_TRACE_JSON),
        ]
    )


def verify_container(blob, *, nested_count):
    view = memoryview(blob)
    magic, version, origin, head_len, count, info_len, reserved, total = (
        struct.unpack_from("<8sIHHIIIQ", view, 0)
    )
    if (magic, version, origin, head_len, info_len, reserved) != (
        MAGIC,
        VERSION,
        ORIGIN,
        HEAD_SIZE,
        FILEINFO_SIZE,
        0,
    ):
        raise RuntimeError("bad head fields")
    if total != len(blob):
        raise RuntimeError("head length does not match file size")
    expected = HEAD_SIZE + count * FILEINFO_SIZE
    types = []
    for i in range(count):
        pos = HEAD_SIZE + i * FILEINFO_SIZE
        _fm, _name, typ, r16, r32, length, offset = struct.unpack_from(
            "<8s128sHHIQQ", view, pos
        )
        if (r16, r32) != (0, 0):
            raise RuntimeError("reserved fields not zero")
        if offset != expected:
            raise RuntimeError("payloads are not contiguous")
        expected += length
        types.append(typ)
    if expected != len(blob):
        raise RuntimeError("payloads do not cover the file exactly")
    if nested_count and types != [TYPE_NESTED] * nested_count:
        raise RuntimeError(f"outer container types {types}, want {nested_count} nested")
    if not nested_count and types != [
        TYPE_TXT,
        TYPE_JSON,
        TYPE_SQLITE,
        TYPE_TXT,
        TYPE_JSON,
    ]:
        raise RuntimeError(f"leaf container types {types}")


# --- main -------------------------------------------------------------------

left_text, mid_text, right_text = check_source_shape()
OBJDUMP_TXT = build_objdump()
PIPE_TRACE_JSON = load_donor_entry("PipeTrace.json")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    outputs = [
        (
            "left.npu-rep",
            leaf(left_text, "sharpen.asc", {CHANGED_LINE: (135332032, 0.5)}),
        ),
        (
            "mid.npu-rep",
            leaf(
                mid_text,
                MID_SOURCE_NAME,
                {CHANGED_LINE: (42424242, 0.61), MID_EDIT_LINE: (90000011, 0.91)},
            ),
        ),
        (
            "right.npu-rep",
            leaf(right_text, "sharpen.asc", {CHANGED_LINE: (135332032, 0.8)}),
        ),
    ]
    blobs = dict(outputs)
    demo = pack_npu_rep(
        [
            ("left.npu.rep", TYPE_NESTED, blobs["left.npu-rep"]),
            ("mid.npu.rep", TYPE_NESTED, blobs["mid.npu-rep"]),
            ("right.npu.rep", TYPE_NESTED, blobs["right.npu-rep"]),
        ]
    )
    for _name, blob in outputs:
        verify_container(blob, nested_count=0)
    verify_container(demo, nested_count=3)

    for name, blob in outputs + [("demo.npu-rep", demo)]:
        path = os.path.join(OUT_DIR, name)
        with open(path, "wb") as fh:
            fh.write(blob)
        print(f"wrote {path} ({len(blob)} bytes)")

    for name, text in (
        ("sharpen.asc", left_text),
        (MID_SOURCE_NAME, mid_text),
        ("sharpen2.asc", right_text),
    ):
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"wrote {path} ({len(text.splitlines())} lines)")

    print(
        f"source lines: left={len(LEFT_LINES)} mid={len(MID_LINES)} "
        f"right={len(RIGHT_LINES)} delta=+5"
    )
    print(
        f"changed line: {CHANGED_LINE}; mid edit line: {MID_EDIT_LINE}; "
        f"left-only lines: {LEFT_ONLY_LINES[0]}-{LEFT_ONLY_LINES[-1]}"
    )
    print(f"symbolizer sites: {len(SYM_LINES)}; objdump instructions: {len(MNEMONICS)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
