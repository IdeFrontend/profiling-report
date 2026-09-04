# Market and Competitor Context

Engineering context for how **profiling-report** relates to industry operator/kernel profilers — especially **NVIDIA Nsight** — and to adjacent tools. This is **not** go-to-market copy: no feature-parity claims, no shared formats with NVIDIA, and no intent to compete on CUDA.

Read after [DOMAIN_AND_USERS.md](DOMAIN_AND_USERS.md). Product goals: [PROJECT_GOALS.md](PROJECT_GOALS.md).

---

## 1. Market frame

Developers who write **custom device operators / kernels** typically need two complementary views:

| Need | Question | Typical industry answer |
|------|----------|-------------------------|
| **System / timeline** | Where does wall time go across host, queues, and devices? | Timeline / swimlane tools (e.g. Nsight Systems) |
| **Kernel / microarchitecture** | Why is *this* kernel slow — occupancy, memory, pipes, source? | Kernel report tools (e.g. Nsight Compute) |

On **Ascend**, those roles are split across **MindStudio Insight**, **MSTT**, **PyPTO**, and now a portable **`.rep` / `.ncrep`** report path visualized by this library. Many OP engineers already know the **NVIDIA Nsight** split, so it is the natural **role analogue** for explaining this project.

```text
Industry (NVIDIA-shaped mental model)
  Nsight Systems  ≈  “find where”
  Nsight Compute  ≈  “explain this kernel”

Ascend OP stack (simplified)
  Insight system modes / other timelines  ≈  “find where” (out of this library’s MVP)
  Insight operator .bin  ≈  deep “explain this kernel”
  .rep + profiling-report  ≈  portable “explain this OP” + swimlane timeline in MSTT
```

---

## 2. NVIDIA analogue map

NVIDIA does **not** ship an Ascend `.rep` viewer. The relationship is **intent and UX role**, not interoperability.

### Nsight Systems (`nsys`)

- **What it is:** System-wide performance analysis — CPU and GPU timelines, CUDA API / library traces, correlation across threads and devices.
- **Developer use:** Find large bottlenecks before diving into a single kernel.
- **Ascend analogue:** Insight **system** / cluster-style timelines and host↔device overviews — **outside** profiling-report MVP ([PROJECT_GOALS](PROJECT_GOALS.md) non-goals).
- **Overlap with this library:** Swimlane *navigation* expectations (zoom, pan, multi-lane busy/idle), closer to **PyPTO / Nsight Systems** than to Nsight Compute’s metric pages.

### Nsight Compute (`ncu`)

- **What it is:** Interactive **CUDA / OptiX kernel** profiler — hardware metrics, occupancy, memory charts, roofline, source↔SASS, guided analysis rules; GUI and CLI; report files (e.g. `.ncu-rep`).
- **Developer use:** After isolating a kernel, explain pipe/memory/compute limits and map back toward source.
- **Ascend analogue:**
  - **Deep path:** MindStudio Insight on operator **`.bin`** (instruction Gantt, Source, Cache, roofline).
  - **Portable path:** **`.rep` / `.ncrep`** metrics + Chrome Trace → **profiling-report** (summary, PIPE util, swimlane; later memory/roofline panels).

### Conceptual mapping (NVIDIA → Ascend / this project)

| NVIDIA (Nsight Compute / Systems concept) | Ascend / this project |
|-------------------------------------------|------------------------|
| Kernel report / launch summary | `OpBasicInfo` + report summary tiles |
| SM / warp occupancy & pipeline util | PIPE occupancy bars; lane gutter util (Cube / Vector / MTE / …) |
| Memory workload chart | `Memory*.csv` + memory topology (P2) |
| Roofline | `ArithmeticUtilization` + `RooflinePanel` (P2) |
| Source ↔ SASS / instruction mix | Insight Source on `.bin`; secondary tabs S9 (P2) — not MVP for `.rep` |
| Guided rules / expert tips | Not in scope for v1 library |
| Nsight Systems multi-lane timeline | Swimlane from embedded Chrome Trace; PyPTO-like interactions |
| `ncu` / `nsys` CLI + proprietary reports | CANN / msprof-style producers + `.rep` container; MSTT opens file |

**Takeaway:** Users familiar with **Nsight Compute** will expect summary → util/memory/roofline → source. This library covers the **portable report + swimlane** slice inside MSTT; **Insight remains** the deep `.bin` analogue to Compute’s source/instruction depth.

---

## 3. Sibling products (same stack — not market competitors)

These partition Ascend OP tooling; they are **ecosystem neighbors**, not external rivals.

| Product | Role vs profiling-report |
|---------|---------------------------|
| **MSTT** | Host IDE; opens `.rep` into this library; keeps `.bin` → Insight |
| **MindStudio Insight** | Legacy / deep operator viewer for `.bin`; system modes stay there |
| **PyPTO Toolkit** | Swimlane UX/algorithm reference; optional later consumer via adapter |
| **CANN / msprof-class producers** | Write profiling artifacts (producer of `.rep` still tracked in [questions](questions/) PROC-1) |

Semantics across Insight / `.rep` / PyPTO: [FORMATS_COMPARISON.md](../formats/FORMATS_COMPARISON.md). User workflow: [DOMAIN_AND_USERS.md](DOMAIN_AND_USERS.md).

---

## 4. Other competitors and adjacent tools

| Tool / family | Audience | Hardware | Strength | Relevance to profiling-report |
|---------------|----------|----------|----------|-------------------------------|
| **NVIDIA Nsight Compute** | CUDA kernel authors | NVIDIA GPU | Kernel metrics, memory, roofline, source | Primary **UX/role** analogue for OP report depth |
| **NVIDIA Nsight Systems** | App / system tuners | NVIDIA GPU + CPU | System timeline | Analogue for “find where”; not MVP scope here |
| **AMD ROCm** (rocprof / Omnitrace-class) | HIP / ROCm kernel authors | AMD GPU | Kernel + system profiling on AMD | Same *category* of competitor tooling; different ISA/stack |
| **Intel VTune / oneAPI GPU tools** | CPU & Intel GPU | Intel | Hotspots, GPU offload analysis | Same category; different hardware |
| **Perfetto / Chrome Trace UIs** | Cross-platform | Format-centric | Timeline UX on CTEF | **Format/UX relative** — `.rep` embeds Chrome Trace |
| **TensorBoard / PyTorch Profiler** | Framework / training | Multi | Graph- and op-level training timelines | Different grain; not Ascend pipe CSV reports |
| **Generic IDE profilers** | General app | CPU-first | Sampling / tracing | Weak analogue for NPU pipe models |

No other vendor today ships an Ascend **`.rep`** consumer that replaces MSTT + this library. Competition is for **developer mindshare and workflow habits** (especially NVIDIA), not for the same on-disk Ascend report format.

---

## 5. Implications for this project

| Implication | Consequence for design / scope |
|-------------|--------------------------------|
| Nsight Compute sets expectations for **kernel reports** | MVP prioritizes overview + PIPE + swimlane; Phase 2+ adds memory, roofline, richer details ([FEATURE_MATRIX](../ui/FEATURE_MATRIX.md), [UX_SPEC](../ui/UX_SPEC.md)) |
| Nsight Systems / PyPTO set expectations for **timeline navigation** | Zoom/pan/select/hover are MVP; system-wide multi-device profiling is out of scope |
| Differentiation is **Ascend-native** | Cube / Vector / MTE pipes, Block Dim, AIC/AIV counters, portable `.rep` without Insight `profiler_server` |
| Packaging | Vue library in MSTT webviews — not a standalone Nsight-style desktop suite |
| Explicit non-goals | Compete on CUDA; replace Insight `.bin` depth in v1; become a system-wide `nsys` clone; parse NVIDIA / AMD report formats |

---

## Related docs

- [PROJECT_GOALS.md](PROJECT_GOALS.md) — goals and non-goals
- [DOMAIN_AND_USERS.md](DOMAIN_AND_USERS.md) — OP developers, pain points, glossary
- [FORMATS_COMPARISON.md](../formats/FORMATS_COMPARISON.md) — Insight vs `.rep` vs PyPTO semantics
- [UX_SPEC.md](../ui/UX_SPEC.md) — scenarios S1–S9
- [FEATURE_MATRIX.md](../ui/FEATURE_MATRIX.md) — MVP vs Phase 2+
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — shared UI + adapters
