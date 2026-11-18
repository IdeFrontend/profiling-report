# Team year results

Short outcomes for leadership. Each item leads with business value, then what shipped.

## MSTT

MSTT turned Ascend operator development into a single IDE path from project create through remote NPU, debug, sanitizer, and profiling — so teams without local hardware and Ascend950 users can ship operators faster. Releases 1.3–1.5.x added remote execution, next-gen `npu-compute` / `npu-emulate` / `npu-check`, native `.npu-rep` viewing, and CANNWork-assisted analysis.

## profiling-report

profiling-report replaces the Insight-only path for new `.npu-rep` reports with an MSTT-native swimlane and analytics UI, so operators find PIPE, memory, and source bottlenecks without leaving the toolkit. The library shipped interactive timeline, measure mode, Source/PC-sampling, memory heatmap, performance hints, and an offline HTML share-out for hardware and simulator flows.

## graph-layout

graph-layout delivers readable orthogonal layouts for large PyPTO execution graphs so toolchain users can inspect dependencies in VS Code instead of fighting unreadable auto-layouts. Shipped as `@pypto/native-layout` (CLI, npm, multi-OS) with quality baselines; large-graph speed is still being driven toward the agreed 5s BIG gate.

## Swimlane data compressor

The swimlane data compressor unlocks interactive PyPTO timeline analysis on huge traces by cutting load from ~37s to ~0.93s on a ~4.2M-event case (~40×). A binary compressed format with C++/TS reader–writer and cross-platform builds is packaged for reuse in the toolkit.
