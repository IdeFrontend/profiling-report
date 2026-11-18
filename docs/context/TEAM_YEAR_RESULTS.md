# Team year results

Short outcomes for leadership. Each project states **business value** first, then what shipped.

## MSTT

**Business value:** Shorter Ascend operator time-to-result and lower dependency on scarce local NPU hardware. Developers stay in one IDE for the full loop (create → build → remote NPU → debug → sanitizer → profiling), so CPU-host teams and Ascend950 users can validate and ship operators without tool-switching or waiting for a lab machine.

**What shipped:** Releases 1.3–1.5.x — remote NPU execution, next-gen `npu-compute` / `npu-emulate` / `npu-check`, native `.npu-rep` viewing, and CANNWork-assisted analysis.

## profiling-report

**Business value:** Faster “where is the bottleneck?” decisions on the product `.npu-rep` format, without MindStudio Insight as a hard dependency. OP teams get an MSTT-owned swimlane and analytics UX for hardware and simulator reports, which cuts context-switching and keeps performance tuning inside the toolkit path.

**What shipped:** Reusable Vue 3 library integrated into MSTT — interactive timeline, measure mode, Source/PC-sampling, memory heatmap, performance hints, and offline HTML share-out for CI and local review.

## graph-layout

**Business value:** Dense PyPTO execution graphs become usable for real debugging and review instead of unreadable spaghetti. Toolchain users can see dependencies clearly in VS Code, which reduces time spent interpreting compiler/schedule structure and supports shipping graph-heavy workflows.

**What shipped:** Native OGDF + custom orthogonal router as `@pypto/native-layout` (CLI, npm, multi-OS) with quality baselines; large-graph speed still targeting the agreed 5s BIG gate.

## Swimlane data compressor

**Business value:** Removes a hard productivity blocker on large traces — multi-million-event swimlanes load in under a second instead of tens of seconds, so engineers can actually analyze timelines instead of waiting on JSON ingest. That unlocks interactive profiling sessions at production scale.

**What shipped:** Binary compressed format with C++/TS reader–writer and cross-platform builds; verified ~4.2M-event load ~37s → ~0.93s (~40×), packaged for reuse in the PyPTO toolkit.
