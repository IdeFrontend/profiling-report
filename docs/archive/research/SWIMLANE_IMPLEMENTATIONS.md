# Swimlane Implementations Comparison

Comparison of candidate approaches for the profiling-report timeline renderer, and a technical recommendation for this project.

## Approaches at a glance

| Approach | Stack | Strengths | Gaps | Fit |
|----------|-------|-----------|------|-----|
| **PyPTO Canvas swimGraph** | Vue 3 + multi-layer Canvas 2D (~75 files / ~35k LOC) | Product UX: LOD, selection, deps, search, measure, panels | Host-coupled (`useViewServer`, DevUI, singletons); heavy to extract | Copy **algorithms and UX patterns**, not the whole tree |
| **Sudu WebGL swimlane** | Java → TeaVM → WebGL2; branch `pp/swimlane-shader` | Dense intervals; sub-pixel **coverage AA**; MIT; ~522 LOC demo | No hit-test, labels, hierarchy, selection; not npm/Vue | **Technique reference** — port shader idea to TypeScript |
| **Hybrid (recommended)** | Vue chrome + TS WebGL intervals + DOM/Canvas overlays | Performance + product UI in a Vue library | Need overlay/hit-test design | Best long-term fit |
| **Minimal Canvas rewrite** | Vue + single/few Canvas layers | Fast MVP for small traces | May struggle at PyPTO-scale density | Acceptable **interim** for MVP |

---

## 1. PyPTO Canvas swimGraph

**Location (local):** `pypto-tools/vscode_plugins/pypto_toolkit/media/vue-project/src/components/swimGraph/`

**Architecture:** Host parses Chrome Trace / PerfSwim / MsProf → streams process/thread/event packages → `swimGraphComplete.vue` builds `SwimDataManager` → multi-canvas layers per process (events, text, deps, hover, selection, …).

**Pros**

- Closest interaction model to the target UX (toolbar, three-tier timeline, gutter, detail/performance panels).
- Proven LOD/mipmap and viewport culling for large traces.
- Rich features already designed (pin, measure, dependencies).

**Cons**

- Not a library: string `provide`/`inject`, global singletons, VS Code / DevUI / i18n coupling.
- Full extraction cost is high; copy-paste of god components recreates technical debt.
- Canvas `fillRect` style painting is weaker for **sub-pixel** visibility of tiny intervals when fully zoomed out (mitigated partly by LOD aggregation).

**Reuse stance for this project:** Allowed to copy-paste render helpers, color config, time formatting, and data-shape ideas. Do **not** require modifying pypto. Do **not** aim for full feature parity in MVP.

Prior study (Russian archive): [SWIMLANE_WEBVIEW_REUSE_REPORT.md](SWIMLANE_WEBVIEW_REUSE_REPORT.md). That report recommended a **webview HTML bundle**; this project instead packages a **Vue library** — see supersession note in that file and [ARCHITECTURE.md](../specs/architecture/ARCHITECTURE.md).

---

## 2. Sudu WebGL coverage swimlane

**Location (local):** `sudu-editor` branch `pp/swimlane-shader`

| Role | Path |
|------|------|
| Shader + mesh | `demo-test-scenes/.../swimlane/SwimlaneShader.java` |
| Demo scene | `.../swimlane/SwimlaneTest.java` |
| Synthetic data | `.../swimlane/SwimlaneData.java` |
| Web demo module | `swimlane-demo/` |

**Idea:** One quad per time interval → GPU mesh. Vertex shader expands edges to integer pixel bounds; fragment shader computes **sub-pixel coverage** (`inside = rPx - lPx`) and multiplies RGB (additive-friendly). Goal: thin / overlapping intervals remain visible and anti-aliased when the time scale compresses many events into few pixels.

**Demo scale:** Stress layout on the order of tens of lanes × 10k–15k events (hundreds of thousands of intervals). No formal published benchmark doc in-repo; preliminary prototypes elsewhere reported large gains vs PyPTO Canvas — treat as **directional evidence**, re-measure in this project.

**Pros**

- Small, focused graphics experiment (~half a thousand LOC for shader path).
- MIT license.
- Addresses the hard dense-timeline problem Canvas struggles with.
- Zoom/pan/scrollbars exist in the demo scene.

**Cons**

- **Java / TeaVM / sudu graphics stack** — not consumable as a Vue/TS npm package (`@sudu-ide/editor` does not export swimlane).
- No selection, hover, hit-testing, text labels, or hierarchical lanes.
- Package-private APIs; WIP (e.g. smooth animation commits).
- Mesh index limit caps events per lane (~16k quads with ushort indices) — need chunking for huge lanes.

**Reuse stance:** Do **not** depend on sudu-editor. **Do** reimplement the coverage-AA interval shader and mesh builder in TypeScript/WebGL2 inside `profiling-report` if density requires it.

---

## 3. Hybrid Vue + WebGL + overlays

```text
┌─────────────────────────────────────────┐
│ Vue: gutter, toolbar, panels, tooltips  │
├─────────────────────────────────────────┤
│ Overlay Canvas/DOM: text, selection UI  │
├─────────────────────────────────────────┤
│ WebGL: interval strips (coverage AA)    │
└─────────────────────────────────────────┘
```

- **WebGL layer:** paint all duration rectangles (Sudu-inspired).
- **Overlay:** labels, selection outlines, dependency curves, hover highlight.
- **Hit-testing:** CPU spatial index (interval tree / grid) synced with visible time range, or GPU pick buffer later.
- **Vue:** owns layout chrome and binds to `SwimlaneModel`.

This matches packaging as a Vue library while keeping a path to Sudu-class density performance.

---

## 4. Minimal Canvas-only rewrite

Appropriate when:

- Fixtures stay near sample size (tens–thousands of events), and
- MVP must ship before WebGL work.

Risk: re-approaching PyPTO scale without LOD or GPU will regress FPS; plan WebGL as the documented performance path, not an afterthought.

---

## Recommendation

| Horizon | Choice |
|---------|--------|
| **MVP** | Vue library UI + **Canvas 2D** (or minimal WebGL) swimlane sufficient for `data/out.rep`-class traces; implement hover/select/zoom/pan per [INTERACTIONS.md](../specs/ui/INTERACTIONS.md). Optionally borrow PyPTO time-axis and color helpers via copy-paste. |
| **Target / Phase 2 performance** | **Hybrid (implemented):** TypeScript WebGL2 coverage-AA intervals (`WebGlSwimlaneRenderer`) + Canvas2D overlay for labels/selection/cursor; Canvas-only fallback when WebGL2 is unavailable. |
| **Avoid** | TeaVM/sudu as a runtime dependency; wholesale import of `swimGraphComplete.vue`; sealed HTML bundle as the primary distribution form for MSTT. |

### Status (feat/webgl-swimlane)

- `src/swimlane/WebGlSwimlaneRenderer.ts` — Sudu-style mesh + coverage fragment shader (reimplemented; no sudu-editor import).
- `src/swimlane/shaders.ts` — VS/FS sources.
- `src/ui/SwimlaneCanvas.vue` — prefers WebGL + overlay; falls back to `CanvasSwimlaneRenderer`.
- Shared layout/hit-test: `src/swimlane/layout.ts`.

### Decision criteria (when to invest in WebGL)

Adopt or prioritize WebGL when any of the following hold:

1. Real OP traces exceed interactive Canvas budgets (measure: frame time &gt; 16–32 ms while panning).
2. Zoomed-out views lose thin intervals (coverage AA becomes a product requirement).
3. Multi-core instruction traces approach PyPTO event counts.

Until then, Canvas MVP is acceptable if APIs (`SwimlaneModel`, renderer interface) allow swapping the backend.

### Suggested renderer interface

```ts
interface SwimlaneRenderer {
  setModel(model: SwimlaneModel): void;
  setView(view: { startTime: number; endTime: number; scrollY: number }): void;
  render(): void;
  hitTest(x: number, y: number): string | null; // event id
  dispose(): void;
}
```

Implementations: `CanvasSwimlaneRenderer`, later `WebGlSwimlaneRenderer`, same Vue wrapper.

---

## References

- PyPTO UX docs: `pypto-tools/vscode_plugins/docs/swimlane_graph/`
- Sudu shader: `SwimlaneShader.java` (`vsCode` / `psCode`, `createSwimlaneMesh`)
- Project architecture: [ARCHITECTURE.md](../specs/architecture/ARCHITECTURE.md)
- Feature phasing: [FEATURE_MATRIX.md](../specs/ui/FEATURE_MATRIX.md)
