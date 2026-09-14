# PROC questions

Open **PROC** questions (process / tooling / acceptance). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

### PROC-5 — acceptance owner (was: Q21)

**Status:** `open`

**Question:** Acceptance owner?

**Specs:** [PROJECT_GOALS](../PROJECT_GOALS.md)

### PROC-9 — dedicated `origin` for simulator leaves?

**Status:** `open`

**Question:** Should product 160-byte `npu-rep` head use a dedicated `origin` value for simulator/emulate leaves (parser today requires `origin = 1`)? If yes, which value, and must hosts/filter still treat the file as `.npu-rep`?

**Context:** Detection for v1 uses embed `SimulatorManifest.json` ([PROC-8](../decisions/PROC.md)) so `origin` can stay `1`.

**Specs when answered:** [INPUT_FORMATS](../../formats/INPUT_FORMATS.md), [npu-rep.spec.md](../../../specs/core/npu-rep.spec.md), [parseNpuRep160](../../../src/adapters/parseNpuRep160.ts)
