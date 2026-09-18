#!/usr/bin/env python3
"""Generate docs/formats/emulate/SCHEMA.md from data/gelu.npu-rep (embed manifest.json).

  python3 data/scripts/gen_emulate_schema_md.py

Object/column names and SQL types are taken verbatim from the manifest.
Descriptions are heuristics (marked *inferred*) unless listed in OVERRIDES.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GELU_REP = ROOT / "data" / "gelu.npu-rep"
OUT = ROOT / "docs" / "formats" / "emulate" / "SCHEMA.md"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from unpack_rep import decode_rep  # noqa: E402


def load_gelu_manifest() -> dict:
    """Read `manifest.json` from the committed gelu leaf (no unpacked tree)."""
    encoded = GELU_REP.read_bytes()
    _, entries = decode_rep(encoded, str(GELU_REP))
    for name, _file_type, payload in entries:
        if name == "manifest.json":
            if isinstance(payload, (bytes, bytearray)):
                return json.loads(payload.decode("utf-8"))
            raise SystemExit("manifest.json payload is not bytes")
    raise SystemExit(f"manifest.json not found in {GELU_REP}")

ROLES: dict[str, str] = {
    "AnalysisState": "Which analyzers ran and whether each passed.",
    "ArchDiagramMetrics": "Architecture-diagram / bandwidth-style scalar parameters (MHTML §11.2.3.1).",
    "ExecutedInstructions": "Hub table: one row per dynamically executed instruction; join key for most reports.",
    "KernelInfo": "Thin kernel identity / duration attribute–value pairs (Phase 1 summary).",
    "MemoryRWAccesses": "Per-access memory read/write events for heatmaps (MHTML §11.2.3.2).",
    "PipesUtilization": "Per-core / per-queue pipe utilization ratios (MHTML §11.2.3.4 / PIPE UI).",
    "PipeUtilizationHist": "Pipe utilization histogram by pipe and core display names.",
    "AiCoreOccupancy": "AICore busy intervals for occupancy overlay (MHTML §11.2.3.3).",
    "VfIPC": "Per-VF IPC aggregates (MHTML §11.2.3.7).",
    "VfIPCDynamic": "Time-windowed VF IPC samples.",
    "VfIPCInside": "In-VF IPC breakdown.",
    "VfSimtIPC": "SIMT VF IPC aggregates.",
    "DispatchTime": "Dispatch tick per executed instruction (Chrome Trace dispatch).",
    "PipeDependency": "Pipe dependency / sync flow edges for tracing.",
    "CriticalPath": "Critical-path event ↔ instruction links.",
    "VectorUtilizations": "Vector unit bytes/elements/utilization for roofline-style views.",
    "ICacheEvents": "Instruction-cache access events for tracing.",
    "CallGraph": "Call-graph edges (ELF / object-file gated).",
    "CallStacks": "Call-stack frames (ELF gated).",
    "Functions": "Function symbols from ELF.",
    "SourceInstructions": "Static source/disassembly instructions (ELF gated).",
    "SharedPatterns": "View joining executed instructions to shared / pattern addresses.",
    "IPCAsmMetrics": "Per-instruction IPC components for assembly views.",
    "CoreTypes": "Dictionary of core type id → name.",
    "InstrTypes": "Dictionary of instruction type id → name.",
    "InstrQueueTypes": "Dictionary of instruction-queue / pipe type id → name.",
}

# (object, column) → description (not marked inferred)
OVERRIDES: dict[tuple[str, str], str] = {
    ("ExecutedInstructions", "ExecInstrId"): "Unique id of one dynamic instruction instance.",
    ("ExecutedInstructions", "SourceInstrAddr"): "Static source / PC address of the instruction.",
    ("ExecutedInstructions", "ExecInstrTickStart"): "Simulation tick when execution starts.",
    ("ExecutedInstructions", "ExecInstrTickEnd"): "Simulation tick when execution ends.",
    ("ExecutedInstructions", "ExecInstrName"): "Mnemonic / opcode name.",
    ("ExecutedInstructions", "ExecInstrParams"): "Encoded or textual instruction parameters.",
    ("ExecutedInstructions", "InstrTypeId"): "FK → InstrTypes.",
    ("ExecutedInstructions", "ExecInstrCoreId"): "Core id that executed the instruction.",
    ("ExecutedInstructions", "CoreTypeId"): "FK → CoreTypes.",
    ("ExecutedInstructions", "ExtendParams"): "Extended parameter blob / JSON-like text.",
    ("ExecutedInstructions", "SourceInstrEncoding"): "Raw instruction encoding hex/text.",
    ("ExecutedInstructions", "ExecInstrIsWait"): "True if this is a wait / stall-style instruction.",
    ("ExecutedInstructions", "ExecInstrIsSynchronization"): "True if this is a synchronization instruction.",
    ("ExecutedInstructions", "ExecInstrIsDurationExcluded"): "True if duration is excluded from timing aggregates.",
    ("ExecutedInstructions", "ExecInstrVfClass"): "Vector-function class id (0 if none).",
    ("ExecutedInstructions", "ExecInstrVfSimtClass"): "SIMT VF class id (0 if none).",
}


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def fmt_type(t: str | None) -> str:
    t = (t or "").strip()
    return f"`{t}`" if t else "`(unspecified)`"


def role_for(name: str) -> str:
    if name in ROLES:
        return ROLES[name]
    if name.startswith("DmaMov"):
        return "DMA-move parameters or traffic. *inferred*"
    if name.startswith("Vf") or name.startswith("VF"):
        return "Vector-function (VF) metrics or metadata. *inferred*"
    if name.startswith(("SIMT", "SIMD", "Simd")):
        return "SIMD/SIMT sampling or execution metadata. *inferred*"
    if name.startswith("Call") or name in {
        "Functions",
        "SourceFiles",
        "SourceLines",
        "SourceInstructions",
        "DebugInfo",
        "Sections",
        "BasicBlocks",
        "BasicBlocksRelations",
    }:
        return "ELF / source / call-graph metadata; often empty without `--object-file`. *inferred*"
    if any(x in name for x in ("Stall", "QueueFull", "Bubble")):
        return "Stall, queue-full, or bubble analysis. *inferred*"
    if "ICache" in name or "DCache" in name:
        return "Cache event / refill telemetry. *inferred*"
    if any(x in name for x in ("PMU", "IPC", "Utilization", "Occupancy")):
        return "Performance / utilization telemetry. *inferred*"
    if name.endswith("Types") or name.endswith("Names"):
        return "Dictionary / enum lookup table. *inferred*"
    if "Hist" in name:
        return "Histogram aggregation view. *inferred*"
    if name.endswith("View") or name.endswith("Patterns"):
        return "Derived view over base contract tables. *inferred*"
    return "Contract DB object from npu_emulate export. *inferred*"


def infer_column(obj: str, col: str) -> str:
    if (obj, col) in OVERRIDES:
        return OVERRIDES[(obj, col)]

    c = col

    rules: list[tuple[bool, str]] = [
        (c == "ExecInstrId", "FK → ExecutedInstructions."),
        (c == "CoreId", "Hardware / simulated core id."),
        (c == "CoreTypeId", "FK → CoreTypes."),
        (c == "InstrTypeId", "FK → InstrTypes."),
        (c.endswith("Id") and len(c) > 2, f"Identifier for `{c[:-2]}`."),
        ("Tick" in c, "Simulation time in ticks."),
        ("IPC" in c, "Instructions-per-cycle metric."),
        ("Utilization" in c or c.endswith("Util"), "Utilization ratio or percent."),
        ("Addr" in c or "Address" in c, "Memory or instruction address."),
        (c.endswith("Name") or c in {"Name", "Type"}, "Human-readable name / label."),
        ("Count" in c or c.endswith("Cnt"), "Count / cardinality."),
        ("Bytes" in c or "Size" in c, "Size in bytes (or related unit)."),
        ("Time" in c and "Tick" not in c, "Time stamp or duration (ticks unless noted)."),
        (c.startswith("Is") or c.endswith("Passed") or c.endswith("Flag"), "Boolean flag."),
        ("Mask" in c, "Bitmask / predicate / lane mask."),
        ("Stall" in c, "Stall cycles or stall-related counter."),
        ("Hit" in c or "Miss" in c, "Cache hit/miss related field."),
        (c == "PC" or "StartingPC" in c, "Program counter."),
        ("File" in c or "Path" in c, "Source file path or id."),
        ("Line" in c, "Source line number or id."),
        ("Warp" in c, "SIMT warp related field."),
        ("Thread" in c or "Dim" in c, "Thread / launch dimension field."),
        ("Metric" in c, "PMU / metric identifier or value."),
        ("Synth" in c, "Synthetic PMU metric field."),
        ("Hint" in c, "Compiler / analyzer hint field."),
        ("Param" in c, "Instruction or DMA / matmul parameter."),
        ("Stride" in c or "Burst" in c or "Loop" in c, "DMA / memory-copy geometry parameter."),
        ("Reg" in c or "Register" in c or "Spr" in c or "Pred" in c, "Register / SPR / predicate field."),
        ("Queue" in c or "Pipe" in c, "Queue or pipe related field."),
        ("Event" in c, "Event id, name, or timing field."),
        ("Json" in c, "Structured text / JSON payload."),
        ("Conflict" in c, "Bank / resource conflict counter."),
        ("Bubble" in c or "Gap" in c or "Bottleneck" in c or "Pipeline" in c, "Trace bubble / idle-gap analysis field."),
        ("Region" in c, "Named region / annotation field."),
        ("Section" in c, "ELF / binary section field."),
        ("Function" in c or "Call" in c or "Stack" in c, "Call-graph / stack / function field (often ELF-gated)."),
        ("Vf" in c or "VF" in c, "Vector-function (VF) related field."),
        ("Window" in c, "Sliding analysis window bound."),
        ("Delta" in c, "Delta between successive metric samples."),
        ("Value" in c or c.endswith("Val"), "Associated value."),
        ("Attr" in c, "Attribute key."),
        ("Mode" in c, "Operating mode / enum string."),
        ("Dtype" in c, "Data type of a matrix/tensor operand."),
        ("Enabled" in c or "Ctrl" in c, "Control / enable flag or mode."),
        ("Processed" in c or "Elements" in c, "Work processed (bytes or elements)."),
        ("Unique" in c, "Cardinality of unique resources used."),
        ("Category" in c or "SubType" in c or "Subtype" in c, "Classification / category label."),
        ("Duration" in c, "Duration (ticks or µs per producer)."),
        ("Efficiency" in c or "Occupancy" in c, "Efficiency / occupancy ratio."),
        ("Active" in c or c in {"Stall", "Empty", "EmptyTicks"}, "Sampling counter bucket."),
        ("Mem" in c or "Memory" in c or "Gm" in c or "Ub" in c or "UB" in c, "Memory-system related field."),
        ("Instr" in c or "Instruction" in c, "Instruction-related field."),
        ("Cache" in c, "Cache-related field."),
        ("Simt" in c or "SIMT" in c or "SIMD" in c, "SIMT/SIMD-specific field."),
        ("Read" in c or "Write" in c, "Read or write access / conflict counter."),
        ("Start" in c or "End" in c or "Begin" in c, "Interval bound."),
        ("Parent" in c or "Child" in c or "Level" in c or "Scope" in c, "Hierarchy / graph relation field."),
        ("Sample" in c or "Sampling" in c, "Sampling statistic."),
        ("Hazard" in c or "Fail" in c or "Pass" in c, "Pipeline hazard / issue status flag."),
        ("Reason" in c, "Stall or failure reason id/name."),
        ("Bank" in c, "Memory-bank conflict related field."),
        ("Matrix" in c, "Matrix operand attribute."),
        ("Quant" in c or "Relu" in c, "Fixed-point / activation configuration."),
        ("M" == c or "K" == c or "N" == c or "D" == c, "Numeric shape parameter."),
        ("Traffic" in c, "Memory traffic estimate."),
        ("Bias" in c, "Address bias / offset."),
        ("Kernel" in c, "Kernel-related address or counter."),
        ("System" in c, "System / overhead related counter."),
        ("Us" in c, "Duration or time in microseconds."),
        ("Flow" in c, "Dependency flow endpoint."),
        ("Tag" in c or "Group" in c or "Package" in c, "Grouping / packaging tag."),
        ("Text" in c or "Encoding" in c or "Msg" in c, "Textual / encoded payload."),
        ("Self" in c or "Total" in c, "Self or inclusive profiling metric."),
        ("RelTime" in c, "Relative time share."),
        ("Type" in c, "Type discriminator / enum."),
        ("Debug" in c or "Source" in c, "Source / debug metadata field."),
        ("Config" in c, "Configuration value."),
        ("Position" in c or "Step" in c or "Dst" in c or "Src" in c, "Geometry / addressing parameter."),
        ("Unit" in c, "Execution unit related field."),
        ("Shared" in c or "Live" in c, "Live / shared register pressure field."),
        ("Block" in c or "BB" in c, "Basic-block related field."),
        ("Length" in c, "Length in instructions or bytes."),
        ("Code" in c, "Code size or code-related field."),
        ("Register" in c or c == "Reg", "Register index or count."),
        ("Branch" in c, "Branch-related metric."),
        ("Full" in c, "Full-mask or capacity-related field."),
        ("Summary" in c or "Top" in c, "Summary / top-bottleneck text."),
        ("General" in c, "General / catch-all status field."),
        ("Hw" in c or "L2" in c, "Hardware / L2 control field."),
        ("DataCache" in c, "Whether data cache was involved."),
        ("Access" in c, "Memory access classification field."),
        ("Utilized" in c, "Utilized capacity."),
        ("Warps" in c or "SubCore" in c, "Resource-usage cardinality."),
        ("Window" in c, "Analysis window bound."),
        ("Exe" in c or "Execution" in c, "Execution count or execution stall bucket."),
        ("Pipe" == c or "MainPipeline" in c, "Pipeline / pipe name."),
        ("Count" == c, "Occurrence count."),
        ("Name" == c, "Display name."),
        ("Value" == c, "Associated value."),
        ("Active" == c, "Active-cycle counter."),
        ("Empty" in c, "Empty-cycle counter."),
    ]

    for matched, text in rules:
        if matched:
            return f"{text} *inferred*"

    return "Purpose unclear; present in contract schema. *inferred*"


def render(manifest: dict) -> str:
    objs = manifest["objects"]
    tables = sorted((o for o in objs if o["type"] == "table"), key=lambda o: o["name"])
    views = sorted((o for o in objs if o["type"] == "view"), key=lambda o: o["name"])

    lines: list[str] = [
        "# Emulate contract schema",
        "",
        "**Profile:** `emulate` (npu_emulate contract SQLite / CSV export).",
        "",
        "Normative **object names**, **column names**, and **SQL types** come from "
        f"`manifest.json` inside [`data/gelu.npu-rep`](../../../data/gelu.npu-rep) "
        f"(exported `{manifest.get('exported_at', '')}`, "
        f"`total_objects={manifest.get('total_objects')}`, "
        f"tables={manifest.get('total_tables')}, views={manifest.get('total_views')}, "
        f"rows={manifest.get('total_rows')}).",
        "",
        "Descriptions marked *inferred* are guesses from column names and known product "
        "surfaces (MHTML §11.2.3 / Phase 1), **not** producer documentation. "
        "Empty export types are shown as `(unspecified)`.",
        "",
        "Leaf pack / Phase 1 inventory: [TABLES.md](TABLES.md). "
        "Container + leaf rules: [FORMAT.md](FORMAT.md).",
        "",
        "Regenerate:",
        "",
        "```bash",
        "python3 data/scripts/gen_emulate_schema_md.py",
        "```",
        "",
        "## Contents",
        "",
        f"- [Tables ({len(tables)})](#tables)",
        f"- [Views ({len(views)})](#views)",
        "- [Naming / type notes](#naming--type-notes)",
        "",
    ]

    def emit_group(title: str, anchor: str, group: list[dict]) -> None:
        lines.append(f"## {title} {{#{anchor}}}")
        lines.append("")
        for o in group:
            lines.append(f"- [`{o['name']}`](#{slug(o['name'])})")
        lines.append("")
        for o in group:
            name = o["name"]
            lines.append(f"### `{name}` {{#{slug(name)}}}")
            lines.append("")
            lines.append("| | |")
            lines.append("|--|--|")
            lines.append(f"| Kind | {o['type']} |")
            lines.append(f"| Gelu rows | {o['row_count']} |")
            lines.append(f"| CSV file | `{o.get('file') or (name + '.csv')}` |")
            lines.append(f"| Role | {role_for(name)} |")
            lines.append("")
            lines.append("| Column | Type | Description |")
            lines.append("|--------|------|-------------|")
            for col in o["columns"]:
                cname = col["name"]
                lines.append(
                    f"| `{cname}` | {fmt_type(col.get('type'))} | {infer_column(name, cname)} |"
                )
            lines.append("")

    emit_group(f"Tables ({len(tables)})", "tables", tables)
    emit_group(f"Views ({len(views)})", "views", views)

    lines.extend(
        [
            "## Naming / type notes",
            "",
            "- **Ticks vs µs.** Contract tables use integer **ticks**. Product "
            "`PipeTrace.json` must be packed in **µs** "
            "([DATA-41](../../context/decisions/DATA.md)).",
            "- **Types** are SQLite/export declarations (`INTEGER`, `REAL`, `BOOLEAN`, "
            "`VARCHAR(n)`, `TEXT`, `FLOAT`). `(unspecified)` means the gelu export left "
            "`type` empty.",
            "- **Hub join.** Most fact tables join on `ExecInstrId` → `ExecutedInstructions`.",
            "- **Dictionaries.** `CoreTypes`, `InstrTypes`, `InstrQueueTypes`, `HintTypes`, "
            "and similar are name lookups; often present in DB but omitted from slim packs — "
            "see [TABLES.md](TABLES.md).",
            "- **ELF / flag gated.** Call*, Source*, Functions, DebugInfo, BasicBlocks, "
            "many SIMT/VfSimt*, TraceBubble* stay at 0 rows unless analyzers / "
            "`--object-file` run.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    # Normalize possible key variants from different export tool versions.
    raw = load_gelu_manifest()
    objects = raw["objects"]
    for o in objects:
        o.setdefault("row_count", o.get("rows", 0))
        o.setdefault("file", o.get("csv") or f"{o['name']}.csv")
        for col in o["columns"]:
            col.setdefault("type", col.get("sql_type") or "")

    meta = {
        "exported_at": raw.get("exported_at") or raw.get("exportedAt") or "",
        "total_objects": raw.get("total_objects") or len(objects),
        "total_tables": raw.get("total_tables")
        or sum(1 for o in objects if o["type"] == "table"),
        "total_views": raw.get("total_views")
        or sum(1 for o in objects if o["type"] == "view"),
        "total_rows": raw.get("total_rows")
        or sum(o.get("row_count", 0) for o in objects),
        "objects": objects,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(meta))
    print(
        f"Wrote {OUT.relative_to(ROOT)} "
        f"({len(objects)} objects, {sum(len(o['columns']) for o in objects)} columns)"
    )


if __name__ == "__main__":
    main()
