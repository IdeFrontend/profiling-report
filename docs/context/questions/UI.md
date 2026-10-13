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

### UI-56 — Source tab Left View / Right View modes

**Status:** `open`

**Question:** Beyond **Source | SASS**, which Left View / Right View modes does Product want (metrics-only, source-only, dual SASS, …), and which combinations are valid?

**Answer so far:** Sketch shows Source | SASS only; controls stay disabled with those fixed options until Product lists modes.

**Specs when answered:** [SourceView.spec.md](../../../src/ui/SourceView/SourceView.spec.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md), [UX_SPEC](../../ui/UX_SPEC.md).

### UI-57 — Redo Resolve contract

**Status:** `open`

**Question:** What does **Redo Resolve** do end-to-end — re-run symbol/source resolution against embeds, clear and rebuild correlation maps, or only re-apply the current caret mapping? Does it need a progress / error surface?

**Answer so far:** UI re-jumps correlation from the current (or first hot) source line; no resolve pipeline exists until [DATA-50](DATA.md) / [DATA-51](DATA.md).

**Specs when answered:** [SourceView.spec.md](../../../src/ui/SourceView/SourceView.spec.md), [source-correlation](../../../specs/core/source-correlation.spec.md), [INTERACTIONS.md](../../ui/INTERACTIONS.md).

### UI-58 — Source dock panel schemas

**Status:** `open`

**Question:** What are the real row schemas and interactions for **Inline Functions**, **Source Markers**, and **Statistics** (columns, click→navigate rules, empty states)? Sketch shows dual Source selectors under Inline Functions — are those nested dual panes or filters?

**Answer so far:** Dock bodies ship mock-derived tables from correlation / metrics until Product locks schemas ([v930-source/source-correlation](../../ui/source/v930-source/source-correlation.jpeg)).

**Specs when answered:** [SourceView.spec.md](../../../src/ui/SourceView/SourceView.spec.md), [VIEW_DATA_REQUIREMENTS §15](../../formats/VIEW_DATA_REQUIREMENTS.md), [FEATURE_MATRIX](../../ui/FEATURE_MATRIX.md).

### UI-59 — Source metric cell heatmap rules

**Status:** `open`

**Question:** Does Product want a value heat tint on metrics cells (e.g. Sampling Stall), and if so which columns, color scale, and thresholds? [`v930-source/source-correlation`](../../ui/source/v930-source/source-correlation.jpeg) shows plain numbers + grey Warp Occupancy bars only — no warm cell fill.

**Answer so far:** Sketch has **no** heat tint. An amber fill was tried and removed as non-sketch. Leave cells uncolored until Product asks for heat.

**Specs when answered:** [SourceView.spec.md](../../../src/ui/SourceView/SourceView.spec.md), [COLOR_TOKENS](../../ui/COLOR_TOKENS.md), [UX_SPEC](../../ui/UX_SPEC.md).
