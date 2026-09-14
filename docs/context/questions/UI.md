# UI questions

Open **UI** questions (presentation / UX). Status enum, prefix taxonomy, and migration map: [README.md](README.md).

### UI-48 — FixP corridor slot vs L1 write-back

**Status:** `open`

**Question:** The official chrome routes its lower L2↔AIC corridor link onto **FixP**. May the panel paint Memory.csv `aic_l1_write_bw` (`l2-l1-write`) on that slot, leave the slot blank, or should Product assign a different metric?

**Answer so far:** None. Until confirmed, the panel leaves that chrome slot blank (edge still exists in the model for 详情).

**Specs when answered:** [MemoryTopologyPanel](../../../src/ui/StatsAside/MemoryTopologyPanel/MemoryTopologyPanel.spec.md), [view-models](../../../specs/core/view-models.spec.md), [VIEW_DATA_REQUIREMENTS](../../formats/VIEW_DATA_REQUIREMENTS.md).

### UI-51 — Undo zoom scope

**Status:** `open`

**Question:** Does Undo zoom restore only the previous viewport window, or also vertical scroll, selection, and collapsed/pinned lane state?

**Answer so far:** Not implemented. Context-menu Undo zoom remains deferred until its history contract is defined.

**Specs when answered:** [ContextMenu.spec.md](../../../src/ui/ContextMenu/ContextMenu.spec.md), [INTERACTIONS.md](../../ui/INTERACTIONS.md).

### UI-52 — Offset action contract

**Status:** `open`

**Question:** Which event/lane data does Offset adjust, what value editor is used, and how is the change displayed or persisted?

**Answer so far:** Not implemented. Context-menu Offset remains deferred until its command contract is defined.

**Specs when answered:** [ContextMenu.spec.md](../../../src/ui/ContextMenu/ContextMenu.spec.md), [INTERACTIONS.md](../../ui/INTERACTIONS.md).

### UI-53 — Hide lane contract and restore path

**Status:** `open`

**Question:** Can a user hide an individual leaf lane, a folder, or both; where is the hidden state stored; and what UI restores hidden lanes?

**Answer so far:** Not implemented. Context-menu Hide lane remains deferred until its state and restore path are defined.

**Specs when answered:** [ContextMenu.spec.md](../../../src/ui/ContextMenu/ContextMenu.spec.md), [view-state.spec.md](../../../specs/core/view-state.spec.md), [INTERACTIONS.md](../../ui/INTERACTIONS.md).
