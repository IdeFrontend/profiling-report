#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate the Source-diff demo fixtures under `data/source-diff/`:

  left.npu-rep   leaf 160-byte npu-rep (objdump.txt / symbolizer.json / summary.db /
                 sharpen_left.asc / sharpen_common.asc / PipeTrace.json)
  mid.npu-rep    leaf 160-byte npu-rep, same embed layout, its own sharpen_mid.asc
  right.npu-rep  leaf 160-byte npu-rep, same embed layout, its own sharpen_right.asc
  demo.npu-rep   outer 160-byte npu-rep with three `type 1` entries (operators
                 `left` / `mid` / `right`) built the same way as the leaves but
                 without the source embeds: the Source view starts on the
                 missing-embed placeholder until a host workspace pick fills it

Every operator carries TWO source files, each 250-350 lines:

  sharpen_<side>.asc   the kernel variant, renamed per operator, so a workspace
                       pick resolves a different document for left / mid / right
  sharpen_common.asc   one shared helper, exact same name in every operator, so
                       the exact-name tier of `resolveSourceFile` pairs it

Each operator pair (left-mid, left-right, mid-right) has at least eight diff
hunks and every pair covers a pure insert, a pure delete and a one-for-one
replace. Line 1 and the last line take part in a change in every pair.

Only the sample-mapped lines enter the symbolizer / objdump / summary.db, so the
site count scales with the sampled lines instead of a fixed 24. Two sampled
changed lines carry distinct Instructions_Executed and Warp_Occupancy per
operator.

Layout matches `src/adapters/parseNpuRep160.ts` / `data/scripts/pack_rep.py`:
36-byte head (version 0x00010000, origin 1, fileInfoLength 160), 160-byte
FileInfo entries, payloads contiguous and covering the file exactly.
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
SIDES = ("left", "mid", "right")
PRIMARY_NAMES = {side: f"sharpen_{side}.asc" for side in SIDES}
COMMON_NAME = "sharpen_common.asc"

SIGNATURE_PARAM = {"left": "deslm", "mid": "dstlm", "right": "endlm"}
INSERT_LINE = {
    "left": "    // left: dual-buffer prefetch keeps MTE2 and VECIN overlapped",
    "mid": "    // mid: single-buffer prefetch trades latency for bank pressure",
    "right": "    // right: descriptor table stays resident in the scalar cache",
}
# Two sampled changed lines per operator: (Instructions_Executed, Warp_Occupancy).
SPECIALS = {
    "left": [(135332032, 0.5), (22000011, 0.44)],
    "mid": [(42424242, 0.61), (33000022, 0.55)],
    "right": [(98765432, 0.73), (44000033, 0.66)],
}


def _source_header(file_name):
    return [
        # Line 1 is replaced per operator so the first rendered row changes.
        f"/* ! \\file {file_name} : generated sharpen kernel demo source */",
        " * \\brief Fixture for the 源码对比 (source-diff) demo; not compiled.",
        " * Long comment kept above 100 characters so the demo exercises horizontal scrolling in the compare panes for real.",
        "\t// tab-indented marker: keeps tab rendering covered by the demo",
        '#include "kernel_operator.h"',
        "",
        "using namespace AscendC;",
        "",
        "constexpr int32_t TILE_ROWS = 16;",
        "constexpr int32_t TILE_COLS = 32;",
        "",
    ]


def _source_block(i, prefix):
    return [
        f"    __aicore__ inline void {prefix}Stage{i}(int32_t tile{i})",
        "    {",
        f"        LocalTensor<half> src{i} = {prefix}InQueue{i}.AllocTensor<half>();",
        f"        DataCopy(src{i}, srcGm[tile{i} * TILE_ROWS], TILE_ROWS);",
        f"        {prefix}InQueue{i}.EnQue(src{i});",
        f"        for (int32_t r{i} = 0; r{i} < TILE_ROWS; ++r{i}) {{",
        f"            src{i}.SetValue(r{i}, src{i}.GetValue(r{i}) * kernelWeight[r{i}]);",
        "        }",
        f"        float mean{i} = 0.0f;",
        f"        mean{i} += src{i}.GetValue(0) + src{i}.GetValue(TILE_ROWS - 1);",
        f"        if (mean{i} > static_cast<float>(threshold)) {{",
        f"            defectCount += {i + 1};",
        "        }",
        f"        {prefix}OutQueue{i}.EnQue(src{i});",
        "    }",
        "",
    ]


def _source_tail(prefix):
    return [
        f"    TPipe {prefix}Pipe;",
        "    GlobalTensor<half> srcGm;",
        "    GlobalTensor<half> dstGm;",
        "    TQue<TPosition::VECIN, 2> inQueue;",
        "    TQue<TPosition::VECOUT, 2> outQueue;",
        "    half kernelWeight[TILE_ROWS];",
        "    uint32_t threshold = 64;",
        "    uint32_t defectCount = 0;",
        "};",
        "// end of generated sharpen kernel",
    ]


def _source_text(file_name, prefix):
    lines = _source_header(file_name)
    for i in range(18):
        lines.extend(_source_block(i, prefix))
    lines.extend(_source_tail(prefix))
    return lines


COMMON_LINES = _source_text(COMMON_NAME, "Common")
COMMON_TEXT = "\n".join(COMMON_LINES) + "\n"
PRIMARY_BASE = _source_text(PRIMARY_NAMES["left"], "Kernel")

_PRIMARY_LINE_COUNT = len(PRIMARY_BASE)
# Nine isolated change regions: first line, seven interior statements, last line.
REGION_INDICES = sorted(
    {
        0,
        _PRIMARY_LINE_COUNT // 8,
        _PRIMARY_LINE_COUNT // 4,
        3 * _PRIMARY_LINE_COUNT // 8,
        _PRIMARY_LINE_COUNT // 2,
        5 * _PRIMARY_LINE_COUNT // 8,
        3 * _PRIMARY_LINE_COUNT // 4,
        7 * _PRIMARY_LINE_COUNT // 8,
        _PRIMARY_LINE_COUNT - 1,
    }
)
SIGNATURE_REGION = REGION_INDICES[3]
INSERT_AT = {
    "left": _PRIMARY_LINE_COUNT // 16,
    "mid": 5 * _PRIMARY_LINE_COUNT // 16,
    "right": 15 * _PRIMARY_LINE_COUNT // 16,
}
DELETE_AT = 9 * _PRIMARY_LINE_COUNT // 16
if set(INSERT_AT.values()) & set(REGION_INDICES):
    raise RuntimeError(f"insert index collides with a change region: {INSERT_AT}")
if DELETE_AT in REGION_INDICES or DELETE_AT in INSERT_AT.values():
    raise RuntimeError(f"delete index {DELETE_AT} collides with another edit")


def _region_line(side, index):
    if index == 0:
        return f"/* ! \\file {PRIMARY_NAMES[side]} : {side} sharpen kernel variant */"
    if index == REGION_INDICES[-1]:
        return f"// {side} build: end of generated sharpen kernel"
    if index == SIGNATURE_REGION:
        return (
            "    __aicore__ inline void HwdefectFind("
            f"Mat srclm, Mat * {SIGNATURE_PARAM[side]})"
        )
    depth = 11 + index * 3 + SIDES.index(side)
    return f"        constexpr int32_t kStage{index}Depth = {depth};"


def _build_variant(side):
    """Apply the side's edits to `PRIMARY_BASE` and track base -> variant lines."""
    lines = []
    variant_line = {}
    for index, base_line in enumerate(PRIMARY_BASE):
        if index == INSERT_AT[side]:
            lines.append(INSERT_LINE[side])
        if side == "right" and index == DELETE_AT:
            continue
        variant_line[index] = len(lines) + 1
        lines.append(
            _region_line(side, index) if index in REGION_INDICES else base_line
        )
    return lines, variant_line


VARIANTS = {side: _build_variant(side) for side in SIDES}
PRIMARY_TEXT = {side: "\n".join(VARIANTS[side][0]) + "\n" for side in SIDES}
PRIMARY_SAMPLE_LINES = {}
for _side in SIDES:
    _lines, _variant_line = VARIANTS[_side]
    _changed = {_variant_line[index] for index in REGION_INDICES}
    _changed.add(_variant_line[INSERT_AT[_side]] - 1)
    _spread = set(range(2, len(_lines) + 1, 27))
    PRIMARY_SAMPLE_LINES[_side] = sorted(_changed | _spread)
COMMON_SAMPLE_LINES = sorted(set(range(3, len(COMMON_LINES) + 1, 27)))
SIGNATURE_LINE = {side: VARIANTS[side][1][SIGNATURE_REGION] for side in SIDES}
SPECIAL_LINES = {
    side: (
        VARIANTS[side][1][REGION_INDICES[1]],
        VARIANTS[side][1][REGION_INDICES[5]],
    )
    for side in SIDES
}


def symbolizer_lines():
    """One site per sampled line, scaled to the sample instead of a fixed 24."""
    specs = {}
    for side in SIDES:
        side_specs = [
            (PRIMARY_NAMES[side], line) for line in PRIMARY_SAMPLE_LINES[side]
        ]
        side_specs += [(COMMON_NAME, line) for line in COMMON_SAMPLE_LINES]
        if len(side_specs) <= 24:
            raise RuntimeError(
                f"{side} symbolizer covers {len(side_specs)} lines, want > 24"
            )
        for file_name, line in side_specs:
            document = (
                VARIANTS[side][0] if file_name == PRIMARY_NAMES[side] else COMMON_LINES
            )
            if not 1 <= line <= len(document):
                raise RuntimeError(f"{side} site {file_name}:{line} is out of range")
        missing = {VARIANTS[side][1][index] for index in REGION_INDICES}
        missing.add(VARIANTS[side][1][INSERT_AT[side]] - 1)
        uncovered = missing - {line for _name, line in side_specs}
        if uncovered:
            raise RuntimeError(f"{side} changed lines not sampled: {sorted(uncovered)}")
        specs[side] = side_specs
    return specs


SITE_SPECS = symbolizer_lines()


def check_source_shape():
    import difflib

    for side in SIDES:
        count = len(VARIANTS[side][0])
        if not 250 <= count <= 350:
            raise RuntimeError(f"{side} primary has {count} lines, want 250-350")
    if not 250 <= len(COMMON_LINES) <= 350:
        raise RuntimeError(f"common source has {len(COMMON_LINES)} lines, want 250-350")

    pairs = (("left", "mid"), ("left", "right"), ("mid", "right"))
    summary = {}
    for left_side, right_side in pairs:
        left = PRIMARY_TEXT[left_side].splitlines()
        right = PRIMARY_TEXT[right_side].splitlines()
        changes = [
            op
            for op in difflib.SequenceMatcher(None, left, right).get_opcodes()
            if op[0] != "equal"
        ]
        kinds = {op[0] for op in changes}
        if len(changes) < 8:
            raise RuntimeError(
                f"{left_side}-{right_side} has {len(changes)} hunks, want >= 8"
            )
        if not {"insert", "delete", "replace"} <= kinds:
            raise RuntimeError(f"{left_side}-{right_side} diff kinds {kinds}")
        if not any(
            op[0] == "replace" and op[2] - op[1] == 1 and op[4] - op[3] == 1
            for op in changes
        ):
            raise RuntimeError(f"{left_side}-{right_side} has no one-for-one replace")
        if changes[0][1] != 0 or changes[0][3] != 0:
            raise RuntimeError(f"{left_side}-{right_side} does not change line 1")
        if changes[-1][2] != len(left) or changes[-1][4] != len(right):
            raise RuntimeError(
                f"{left_side}-{right_side} does not change the last line"
            )
        summary[(left_side, right_side)] = len(changes)

    primary_lines = [line for side in SIDES for line in VARIANTS[side][0]]
    if not any(len(line) > 100 for line in primary_lines):
        raise RuntimeError("no source line exceeds 100 characters")
    if not any(line.startswith("\t") for line in primary_lines):
        raise RuntimeError("no tab-indented source line")
    if len({PRIMARY_NAMES[side] for side in SIDES}) != len(SIDES):
        raise RuntimeError("primary source names are not unique per operator")
    if COMMON_NAME in PRIMARY_NAMES.values():
        raise RuntimeError("common source name collides with a primary name")

    for side in SIDES:
        sampled = set(PRIMARY_SAMPLE_LINES[side])
        first, second = SPECIAL_LINES[side]
        if first not in sampled or second not in sampled:
            raise RuntimeError(f"{side} special metrics lines are not sampled")
    for slot in range(2):
        values = {(SPECIALS[side][slot][0], SPECIALS[side][slot][1]) for side in SIDES}
        if len(values) != len(SIDES):
            raise RuntimeError(
                f"special metrics slot {slot} is not distinct per operator"
            )
    return summary


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

_MNEMONIC_TABLE = [
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


def instructions(count):
    """One instruction per sampled site: the site count drives the instruction count."""
    return [_MNEMONIC_TABLE[i % len(_MNEMONIC_TABLE)] for i in range(count)]


def pcs(count):
    return [0x100 + 4 * i for i in range(count)]


def build_objdump(side):
    specs = SITE_SPECS[side]
    rows = [
        "kernel.o:\tfile format elf64-hiipu",
        "",
        "Disassembly of section .text:",
        "",
        "0000000000000100 <sharpen>:",
    ]
    for i, ((mnem, ops), (file_name, line)) in enumerate(
        zip(instructions(len(specs)), specs)
    ):
        pc = 0x100 + 4 * i
        if file_name == PRIMARY_NAMES[side] and line == SIGNATURE_LINE[side]:
            rows.append("")
            rows.append(f"{pc:016x} <HwdefectFind>:")
        enc = 0x02004880 + (i * 0x101) & 0xFFFFFFFF
        rows.append(f"     {pc:x}:\t{enc:08x}\t{mnem}\t{ops}")
    rows.append("")
    return "\n".join(rows)


def build_symbolizer(side):
    sites = []
    for pc, (file_name, line) in zip(pcs(len(SITE_SPECS[side])), SITE_SPECS[side]):
        is_signature = file_name == PRIMARY_NAMES[side] and line == SIGNATURE_LINE[side]
        sites.append(
            {
                "Address": f"0x{pc:x}",
                "ModuleName": "kernel.o",
                "Symbol": [
                    {
                        "Column": 1,
                        "Discriminator": 0,
                        "FileName": file_name,
                        "FunctionName": "HwdefectFind" if is_signature else "sharpen",
                        "Line": line,
                        "StartAddress": f"0x{pc:x}",
                        "StartFileName": file_name,
                        "StartLine": 1,
                    }
                ],
            }
        )
    return json.dumps(sites, indent=2)


def build_summary_db(seed, specs, special):
    """One row per sampled PC; `special` maps (fileName, line) -> (executed, occupancy)."""
    import sqlite3

    rand = mulberry32(seed)
    rows = []
    for pc, spec in zip(pcs(len(specs)), specs):
        stall = 400 + int(rand() * 2400)
        parts = _split_total(stall, [1, 2, 9, 3, 4, 1, 0, 1])
        if spec in special:
            executed, occ = special[spec]
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


def _special_for(side):
    return {
        (PRIMARY_NAMES[side], line): value
        for line, value in zip(SPECIAL_LINES[side], SPECIALS[side])
    }


def leaf(side, embed_source=True):
    specs = SITE_SPECS[side]
    entries = [
        ("objdump.txt", TYPE_TXT, build_objdump(side).encode("utf-8")),
        ("symbolizer.json", TYPE_JSON, build_symbolizer(side).encode("utf-8")),
        (
            "summary.db",
            TYPE_SQLITE,
            build_summary_db(0x5EED, specs, _special_for(side)),
        ),
    ]
    if embed_source:
        entries.append(
            (PRIMARY_NAMES[side], TYPE_TXT, PRIMARY_TEXT[side].encode("utf-8"))
        )
        entries.append((COMMON_NAME, TYPE_TXT, COMMON_TEXT.encode("utf-8")))
    entries.append(("PipeTrace.json", TYPE_JSON, PIPE_TRACE_JSON))
    return pack_npu_rep(entries)


def verify_container(blob, *, nested_count, embedded_source=True):
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
    if not nested_count and types != (
        [TYPE_TXT, TYPE_JSON, TYPE_SQLITE, TYPE_TXT, TYPE_TXT, TYPE_JSON]
        if embedded_source
        else [TYPE_TXT, TYPE_JSON, TYPE_SQLITE, TYPE_JSON]
    ):
        raise RuntimeError(f"leaf container types {types}")


# --- main -------------------------------------------------------------------

PIPE_TRACE_JSON = load_donor_entry("PipeTrace.json")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    pair_summary = check_source_shape()
    outputs = [(f"{side}.npu-rep", leaf(side, embed_source=True)) for side in SIDES]
    # Demo leaves ship no source text: the view shows the missing-embed
    # placeholder until a host workspace pick fills it.
    demo_leaves = [
        (f"{side}.npu.rep", leaf(side, embed_source=False)) for side in SIDES
    ]
    demo = pack_npu_rep([(name, TYPE_NESTED, blob) for name, blob in demo_leaves])
    for _name, blob in outputs:
        verify_container(blob, nested_count=0, embedded_source=True)
    for _name, blob in demo_leaves:
        verify_container(blob, nested_count=0, embedded_source=False)
    verify_container(demo, nested_count=3)

    for name, blob in outputs + [("demo.npu-rep", demo)]:
        path = os.path.join(OUT_DIR, name)
        with open(path, "wb") as fh:
            fh.write(blob)
        print(f"wrote {path} ({len(blob)} bytes)")

    loose = [(PRIMARY_NAMES[side], PRIMARY_TEXT[side]) for side in SIDES]
    loose.append((COMMON_NAME, COMMON_TEXT))
    for name, text in loose:
        path = os.path.join(OUT_DIR, name)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"wrote {path} ({len(text.splitlines())} lines)")

    print(
        "source lines: "
        + " ".join(f"{side}={len(VARIANTS[side][0])}" for side in SIDES)
        + f" common={len(COMMON_LINES)}"
    )
    print(
        "changed lines: " + " ".join(f"{side}={SIGNATURE_LINE[side]}" for side in SIDES)
    )
    print(
        "hunks: "
        + " ".join(
            f"{left}-{right}={count}" for (left, right), count in pair_summary.items()
        )
    )
    print(
        "symbolizer sites: "
        + " ".join(f"{side}={len(SITE_SPECS[side])}" for side in SIDES)
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
