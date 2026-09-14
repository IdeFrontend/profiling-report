/**
 * Simulator format / adaptSimulator — acceptance stubs (implementation next slice).
 * @see specs/core/simulator-format.spec.md
 * @see specs/core/adapt-simulator.spec.md
 */
import { describe, it } from 'vitest';

describe('simulator-format (PR-SIM-*)', () => {
  it.todo('PR-SIM-001: SimulatorManifest.json profile+schemaVersion required for simulator leaf');
  it.todo('PR-SIM-002: marker + PipeTrace.json valid without hardware metric CSVs');
  it.todo('PR-SIM-003: PipeTrace.json contracted as µs (tick conversion is producer-side)');
  it.todo('PR-SIM-004: missing KernelInfo/summary → timeline-only, not invalid');
});

describe('adapt-simulator (PR-ASIM-*)', () => {
  it.todo('PR-ASIM-001: adaptSimulator builds swimlane from PipeTrace.json (µs)');
  it.todo('PR-ASIM-002: no pipeOccupancy without sim mapper / no invented PipeUtilization.csv');
  it.todo('PR-ASIM-003: missing KernelInfo/summary does not throw');
  it.todo('PR-ASIM-004: does not invent hardware-shaped metric CSVs');
});

describe('npu-rep / loadReportSource profile routing', () => {
  it.todo('PR-NPU-012: SimulatorManifest.json leaf classified as simulator; hardware CSVs not required');
  it.todo('PR-JSON-004: loadReportSource routes simulator leaf to adaptSimulator path');
});
