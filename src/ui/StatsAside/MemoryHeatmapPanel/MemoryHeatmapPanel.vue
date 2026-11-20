<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type CSSProperties,
} from 'vue';
import { t, type MessageKey } from '../../../i18n';
import type {
  MemoryHeatmapBlock,
  MemoryHeatmapModel,
  MemoryHeatmapUnit,
  MemoryHeatmapUnitId,
  MemoryHeatmapView,
} from '../../../domain/types';
import SourcePillSelect from '../../SourceView/SourcePillSelect.vue';
import {
  FIXED_TIP_OFFSET_PX,
  placeFixedTip,
} from '../../placeFixedTip';
import {
  HEAT_GRID_BORDER_PX,
  HEAT_GRID_GAP_PX,
  HEAT_GRID_PAD_PX,
  hitTestHeatCell,
} from './heatHitTest';
import { mergeOccupancyBands } from './legendOccupancy';
import { paintHeatLattice } from './paintHeatLattice';

/**
 * biprof §11.2.3.2 Memory Utilization Heatmap panel — the right column of the topology 全屏
 * overlay. The host owns `selectedUnit`; when a unit has multiple views (AIV0/AIV1 UB) the panel
 * keeps the active view index locally (DATA-50).
 * @see docs/views/memory-topology.md § Memory Utilization Heatmap
 */

/** SA tip size estimate for flip/clamp (three label|value rows). */
const HEAT_CELL_TIP_EST_W = 220;
const HEAT_CELL_TIP_EST_H = 88;
/** Hover zoom: expand overlay this many px past each side of the cell (centered). */
const HEAT_HOVER_GROW_PX = 4;

/** Fixed brush width on the Access Count legend (percent of strip). */
const LEGEND_BRUSH_WIDTH_PCT = 10;
const LEGEND_BRUSH_HALF_PCT = LEGEND_BRUSH_WIDTH_PCT / 2;
/** Fade 0 / max tick labels as the brush window edge enters this % of the strip. */
const LEGEND_END_FADE_ZONE_PCT = 12;
/** Mute / occupancy dim fade on brush enter/leave (cells + legend). */
const LEGEND_DIM_MS = 200;
/** Mute veil cell fill — gaps stay clear so board `#303f5e` grid lines show through. */
const HEAT_MUTE_FILL = '#2C2C2C';

/**
 * Binary-mode Free / Used blues (same as HEAT_BLOCK_WITHOUT_DATA / WITH_DATA).
 * Continuous intensity lerps Free (0) → Used (1).
 */
const HEAT_FILL_LO = '#AFC6FE';
const HEAT_FILL_HI = '#3D64AD';
const HEAT_FILL_LO_RGB = [0xaf, 0xc6, 0xfe] as const;
const HEAT_FILL_HI_RGB = [0x3d, 0x64, 0xad] as const;

/**
 * Continuous Free→Used blue fill.
 * `intensity` is (Read+Write)/viewMax in [0, 1].
 */
function heatFill(intensity: number): string {
  const t = Math.min(1, Math.max(0, intensity));
  if (t < 1e-6) return HEAT_FILL_LO;
  if (t > 1 - 1e-6) return HEAT_FILL_HI;
  const r = Math.round(HEAT_FILL_LO_RGB[0] + (HEAT_FILL_HI_RGB[0] - HEAT_FILL_LO_RGB[0]) * t);
  const g = Math.round(HEAT_FILL_LO_RGB[1] + (HEAT_FILL_HI_RGB[1] - HEAT_FILL_LO_RGB[1]) * t);
  const b = Math.round(HEAT_FILL_LO_RGB[2] + (HEAT_FILL_HI_RGB[2] - HEAT_FILL_LO_RGB[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Legend strip: Free (light) → Used (deep) — same endpoints as `heatFill`. */
const LEGEND_GRADIENT = `linear-gradient(to right, ${HEAT_FILL_LO}, ${HEAT_FILL_HI})`;

/** Thousands grouped by hand — same as the BiProf/SA sample (`300,090`), not host ICU. */
function formatAccessCount(n: number): string {
  return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** SA tip: `0x` + lowercase hex (no forced pad). */
function formatStartAddress(baseAddress: number, index: number, cellSize: number): string {
  const addr = Math.max(0, Math.floor(baseAddress + index * cellSize));
  return `0x${addr.toString(16)}`;
}

/** Shared capacity unit for Total/Used/Free (#201) — pick from Total so the three values match. */
type HeatByteUnit = 'B' | 'KB' | 'MB';

function capacityUnit(totalBytes: number): HeatByteUnit {
  if (totalBytes >= 1024 * 1024) return 'MB';
  if (totalBytes >= 1024) return 'KB';
  return 'B';
}

/** Frame capacity line: space before unit (`256 KB`); same unit for Total/Used/Free (#201). */
function formatHeatBytes(n: number, unit: HeatByteUnit): string {
  const raw = unit === 'MB' ? n / (1024 * 1024) : unit === 'KB' ? n / 1024 : n;
  const text = Number.isInteger(raw) ? String(raw) : String(Math.round(raw * 100) / 100);
  return `${text} ${unit}`;
}

/** Heat tab set, in order (`L1 | UB | L0A | L0B | L0C`) — no L2Cache ([UI-60]). */
const TABS: MemoryHeatmapUnitId[] = ['l1', 'ub', 'l0a', 'l0b', 'l0c'];

/** Tab labels — English in both locales. */
const UNIT_LABEL_KEY: Record<MemoryHeatmapUnitId, MessageKey> = {
  l1: 'memoryHeatUnitL1',
  ub: 'memoryHeatUnitUb',
  l0a: 'memoryHeatUnitL0a',
  l0b: 'memoryHeatUnitL0b',
  l0c: 'memoryHeatUnitL0c',
};

/**
 * Fallback diagram words when a view has no owner (`AIC L1`, `AIV × 2 UB`). Prefer
 * `{ownerName} {memoryName}` when CoreTypes resolved the owner.
 */
const UNIT_NAME_KEY: Record<MemoryHeatmapUnitId, MessageKey> = {
  l1: 'memoryHeatUnitNameL1',
  ub: 'memoryHeatUnitNameUb',
  l0a: 'memoryHeatUnitNameL0a',
  l0b: 'memoryHeatUnitNameL0b',
  l0c: 'memoryHeatUnitNameL0c',
};

const props = withDefaults(
  defineProps<{
    model?: MemoryHeatmapModel | null;
    /** Unit the host has selected — the tab to show and highlight (mirrors the diagram). */
    selectedUnit?: MemoryHeatmapUnitId | null;
    locale?: string;
  }>(),
  { model: null, selectedUnit: null, locale: undefined },
);

const emit = defineEmits<{
  'select-unit': [unit: MemoryHeatmapUnitId];
}>();

const tabsEl = ref<HTMLElement | null>(null);
/** Painted legend strip — pointer % and occupancy width map to this, not the side pads. */
const legendTrackEl = ref<HTMLElement | null>(null);
/** Index into `activeUnit.views` — resets when the host changes tab. */
const viewIndex = ref(0);

const units = computed(() => props.model?.units ?? []);

/** Distinct pack `coreId`s — Core prefix only when more than one (#198 / single-core packs stay plain). */
const isMultiCore = computed(() => {
  const ids = new Set<number>();
  for (const unit of units.value) {
    for (const view of unit.views) ids.add(view.coreId);
  }
  return ids.size > 1;
});

const byId = computed(() => new Map(units.value.map((u) => [u.id, u])));

/** Tab the host names. A unit the model has no source for has no entry, and its body blanks. */
const activeUnit = computed<MemoryHeatmapUnit | null>(() =>
  props.selectedUnit ? (byId.value.get(props.selectedUnit) ?? null) : null,
);

watch(
  () => props.selectedUnit,
  () => {
    viewIndex.value = 0;
  },
);

watch(activeUnit, (unit) => {
  if (!unit) return;
  if (viewIndex.value >= unit.views.length) viewIndex.value = 0;
});

const activeView = computed<MemoryHeatmapView | null>(() => {
  const unit = activeUnit.value;
  if (!unit?.views.length) return null;
  return unit.views[Math.min(viewIndex.value, unit.views.length - 1)] ?? null;
});

const withDataCount = computed(
  () => activeView.value?.blocks.filter((b) => b.state === 'withData').length ?? 0,
);

function unitLabel(id: MemoryHeatmapUnitId): string {
  return t(UNIT_LABEL_KEY[id], props.locale);
}

/** View label: owner + buffer; multi-core packs prepend pack `coreId` (#198) — never invent one. */
function viewOptionLabel(view: MemoryHeatmapView): string {
  const base = view.ownerName ? `${view.ownerName} ${view.memoryName}` : view.memoryName;
  return isMultiCore.value ? `Core ${view.coreId} · ${base}` : base;
}

/**
 * Under-grid title: same as the view option label when the owner is known, or on multi-core
 * packs even without an owner (`Core N · UB`). Diagram tab words only for single-core, no-owner.
 */
const unitName = computed(() => {
  const view = activeView.value;
  if (!view || !props.selectedUnit) return '';
  if (view.ownerName || isMultiCore.value) return viewOptionLabel(view);
  return t(UNIT_NAME_KEY[props.selectedUnit], props.locale);
});

const gridLabel = computed(() =>
  t('memoryHeatGridLabel', props.locale)
    .replace('{used}', String(withDataCount.value))
    .replace('{total}', String(activeView.value?.blocks.length ?? 0)),
);

/**
 * Capacity caption (DATA-51). Omit when Total is unknown; never put an instruction count here.
 */
const metricLabel = computed(() => {
  const view = activeView.value;
  if (!view) return '';
  if (view.totalBytes != null && view.usedBytes != null && view.freeBytes != null) {
    const unit = capacityUnit(view.totalBytes);
    return t('memoryHeatCapacity', props.locale)
      .replace('{total}', formatHeatBytes(view.totalBytes, unit))
      .replace('{used}', formatHeatBytes(view.usedBytes, unit))
      .replace('{free}', formatHeatBytes(view.freeBytes, unit));
  }
  return '';
});

const gridColumns = computed(() => activeView.value?.columns ?? 1);
const gridRows = computed(() => activeView.value?.rows ?? 1);

/** Active view max access count — right legend label + brush range readout. */
const maxAccessCount = computed(() => {
  const blocks = activeView.value?.blocks;
  if (!blocks?.length) return 0;
  let max = 0;
  for (const b of blocks) {
    if (b.accessCount > max) max = b.accessCount;
  }
  return max;
});

const legendMaxLabel = computed(() => formatAccessCount(maxAccessCount.value));

function onTabsKeydown(e: KeyboardEvent) {
  const at = TABS.indexOf(props.selectedUnit ?? TABS[0]);
  const target =
    e.key === 'ArrowRight'
      ? TABS[(at + 1) % TABS.length]
      : e.key === 'ArrowLeft'
        ? TABS[(at - 1 + TABS.length) % TABS.length]
        : e.key === 'Home'
          ? TABS[0]
          : e.key === 'End'
            ? TABS[TABS.length - 1]
            : null;
  if (target == null) return;
  e.preventDefault();
  emit('select-unit', target);
  void nextTick(() =>
    tabsEl.value
      ?.querySelector<HTMLButtonElement>(`[data-testid="heat-tab-${target}"]`)
      ?.focus(),
  );
}

const viewSelectOptions = computed(() =>
  (activeUnit.value?.views ?? []).map((view, i) => ({
    id: String(i),
    label: viewOptionLabel(view),
  })),
);

const viewSelectValue = computed(() => String(viewIndex.value));

function onViewSelect(id: string) {
  const value = Number(id);
  if (Number.isFinite(value)) viewIndex.value = value;
}

/**
 * SA heat-cell tip (#194) — swimlane-style: one grid pointermove + geometry hit-test,
 * same-index early return (chase tip xy only), single overlay ring (no per-cell layout grow).
 */
const gridEl = ref<HTMLElement | null>(null);

/** Tip content — rebuilt only when the hovered block changes. */
const tipContent = ref<{
  blockIndex: number;
  startAddress: string;
  cellSize: number;
  accessCount: number;
} | null>(null);

/** Tip chase coords — separate so same-cell moves do not rewrite tip rows. */
const tipPointer = ref({ x: 0, y: 0 });

const hoveredBlockIndex = ref<number | null>(null);

const hoverOverlayStyle = computed<CSSProperties>(() => {
  const index = hoveredBlockIndex.value;
  const view = activeView.value;
  const geom = paintedGeom;
  if (index == null || !view || !geom) return { display: 'none' };
  const block = view.blocks[index];
  if (!block) return { display: 'none' };
  const col = index % view.columns;
  const row = Math.floor(index / view.columns);
  const grow = HEAT_HOVER_GROW_PX;
  // Same cellW/cellH/pad as canvas paint — not var(--pr-heat-cell) (can disagree with board box).
  const left = HEAT_GRID_PAD_PX + col * (geom.cellW + HEAT_GRID_GAP_PX) - grow;
  const top = HEAT_GRID_PAD_PX + row * (geom.cellH + HEAT_GRID_GAP_PX) - grow;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${geom.cellW + grow * 2}px`,
    height: `${geom.cellH + grow * 2}px`,
    backgroundColor: heatFill(block.intensity),
  };
});

const cellTipStyle = computed<CSSProperties>(() => {
  if (!tipContent.value) {
    return { position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto' };
  }
  // Flipped axes use right/bottom so the pointer gap stays FIXED_TIP_OFFSET_PX even when
  // HEAT_CELL_TIP_EST_* overshoots the painted tip (left = x - offset - tipW did not).
  const pos = placeFixedTip({
    x: tipPointer.value.x,
    y: tipPointer.value.y,
    tipW: HEAT_CELL_TIP_EST_W,
    tipH: HEAT_CELL_TIP_EST_H,
    viewportW: typeof window !== 'undefined' ? window.innerWidth : 1024,
    viewportH: typeof window !== 'undefined' ? window.innerHeight : 768,
    offset: FIXED_TIP_OFFSET_PX,
  });
  return {
    position: 'fixed',
    zIndex: 1000,
    left: pos.left == null ? 'auto' : `${pos.left}px`,
    right: pos.right == null ? 'auto' : `${pos.right}px`,
    top: pos.top == null ? 'auto' : `${pos.top}px`,
    bottom: pos.bottom == null ? 'auto' : `${pos.bottom}px`,
  };
});

function applyHoverBlock(block: MemoryHeatmapBlock, clientX: number, clientY: number) {
  const view = activeView.value;
  if (!view) return;
  tipPointer.value = { x: clientX, y: clientY };
  if (hoveredBlockIndex.value === block.index && tipContent.value?.blockIndex === block.index) {
    return;
  }
  hoveredBlockIndex.value = block.index;
  tipContent.value = {
    blockIndex: block.index,
    startAddress: formatStartAddress(view.baseAddress, block.index, view.cellSize),
    cellSize: view.cellSize,
    accessCount: block.accessCount,
  };
}

/**
 * Continuous hover like swimlane: hit-test every move; seams keep the left/top cell;
 * null hit inside the grid chrome stays sticky until leave.
 */
function onGridPointerMove(e: PointerEvent) {
  const view = activeView.value;
  const el = gridEl.value;
  if (!view || !el) return;
  const hit = hitTestHeatCell(e.clientX, e.clientY, el.getBoundingClientRect(), {
    columns: view.columns,
    rows: view.rows,
    blockCount: view.blocks.length,
  });
  if (hit == null) {
    // Padding/border ring: chase tip if we already have a cell; else ignore.
    if (tipContent.value) tipPointer.value = { x: e.clientX, y: e.clientY };
    return;
  }
  const block = view.blocks[hit];
  if (!block) return;
  applyHoverBlock(block, e.clientX, e.clientY);
}

function clearCellTip() {
  tipContent.value = null;
  hoveredBlockIndex.value = null;
}

/**
 * Hover-only 10% legend brush — dims out-of-range cells via a single mute veil
 * + bright top layer (in-range cells). Brush chrome is imperative DOM so it paints
 * before reactive legend/heatmap fades start.
 */
const legendBrush = ref<{ centerPct: number; loPct: number; hiPct: number } | null>(null);
/** Legend hit-band width in CSS px — drives 3px → % for occupancy bands. */
const legendTrackWidthPx = ref(0);
/**
 * Legend strip mute/occ fade target — separate from brush chrome so the window can
 * show/hide before these opacity transitions start.
 */
const legendDimOn = ref(false);
/**
 * Heat mute veil opacity target. Cleared on leave so the single veil can fade out
 * while bright cells stay until `transitionend` (no flash of dimmed in-range cells).
 */
const heatVeilOn = ref(false);

const brushChromeEl = ref<HTMLElement | null>(null);
const brushRangeEl = ref<HTMLElement | null>(null);
const brushMatchEl = ref<HTMLElement | null>(null);
const boardEl = ref<HTMLElement | null>(null);
const baseCanvasEl = ref<HTMLCanvasElement | null>(null);
const veilCanvasEl = ref<HTMLCanvasElement | null>(null);
const brightCanvasEl = ref<HTMLCanvasElement | null>(null);

/** Precomputed per active view — used by canvas base/bright paints. */
let cellIntensityPct: number[] = [];
let cellFillColors: string[] = [];
/** 1 = shown on the bright canvas (in brush range). */
let cellBrightBits = new Uint8Array(0);

let legendBrushMoveRaf = 0;
let pendingLegendClientX: number | null = null;
let lastAppliedBrushCenter: number | null = null;
/** Last brush used for bright membership — kept through veil leave fade. */
let lastBrightBrush: { loPct: number; hiPct: number } | null = null;
let gridResizeObserver: ResizeObserver | null = null;

/**
 * Shared lattice paint box — all three canvases + hover overlay use this snapshot
 * so highlights land on the same pixels as base/veil.
 */
type LatticePaintGeom = {
  columns: number;
  rows: number;
  blockCount: number;
  innerW: number;
  innerH: number;
  cellW: number;
  cellH: number;
  dpr: number;
};
let paintedGeom: LatticePaintGeom | null = null;

function rebuildCellPaintCache(view: MemoryHeatmapView | null) {
  if (!view?.blocks.length) {
    cellIntensityPct = [];
    cellFillColors = [];
    cellBrightBits = new Uint8Array(0);
    return;
  }
  const n = view.blocks.length;
  cellIntensityPct = new Array(n);
  cellFillColors = new Array(n);
  cellBrightBits = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const block = view.blocks[i]!;
    cellIntensityPct[i] = block.intensity * 100;
    cellFillColors[i] = heatFill(block.intensity);
  }
}

function currentDpr(): number {
  return typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
}

/**
 * Lattice box from the board element (CSS `inset: pad` fills the content box).
 * Do NOT parse `--pr-heat-cell` (unresolved `min(calc(cq*))`) and do NOT assign
 * a JS width/height on the board — that cached a smaller stale box and left empty
 * space inside the frame. Brush-only redraws reuse `paintedGeom`.
 */
function readLatticeGeom(view: MemoryHeatmapView): LatticePaintGeom | null {
  const board = boardEl.value;
  const grid = gridEl.value;
  if (!grid || view.columns < 1 || view.rows < 1) return null;
  // Prefer the board's laid-out content box; fall back to grid border-box − chrome.
  let innerW = 0;
  let innerH = 0;
  if (board) {
    innerW = board.clientWidth;
    innerH = board.clientHeight;
  }
  if (innerW <= 0 || innerH <= 0) {
    const rect = grid.getBoundingClientRect();
    const chrome = 2 * HEAT_GRID_BORDER_PX + 2 * HEAT_GRID_PAD_PX;
    innerW = rect.width - chrome;
    innerH = rect.height - chrome;
  }
  if (innerW <= 0 || innerH <= 0) return null;
  const cellW = (innerW - (view.columns - 1) * HEAT_GRID_GAP_PX) / view.columns;
  const cellH = (innerH - (view.rows - 1) * HEAT_GRID_GAP_PX) / view.rows;
  if (cellW <= 0 || cellH <= 0) return null;
  return {
    columns: view.columns,
    rows: view.rows,
    blockCount: view.blocks.length,
    innerW,
    innerH,
    cellW,
    cellH,
    dpr: currentDpr(),
  };
}

function syncCanvasBacking(
  canvas: HTMLCanvasElement,
  geom: LatticePaintGeom,
): CanvasRenderingContext2D | null {
  const bw = Math.max(1, Math.round(geom.innerW * geom.dpr));
  const bh = Math.max(1, Math.round(geom.innerH * geom.dpr));
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  return canvas.getContext('2d');
}

function paintLayer(
  canvas: HTMLCanvasElement | null,
  geom: LatticePaintGeom,
  opts: { fills: readonly string[]; uniformFill?: string | null; mask?: Uint8Array | null },
) {
  if (!canvas) return;
  const ctx = syncCanvasBacking(canvas, geom);
  if (!ctx) return;
  paintHeatLattice({
    ctx,
    columns: geom.columns,
    rows: geom.rows,
    innerWidthCss: geom.innerW,
    innerHeightCss: geom.innerH,
    devicePixelRatio: geom.dpr,
    fills: opts.fills,
    uniformFill: opts.uniformFill ?? null,
    mask: opts.mask ?? null,
    blockCount: geom.blockCount,
  });
}

/** Paint base lattice (always heatFill — dim is the veil, not cell color). */
function paintBaseCanvas(geom: LatticePaintGeom) {
  paintLayer(baseCanvasEl.value, geom, { fills: cellFillColors });
}

/** Solid mute veil — one fill over the board (no per-cell grid). */
function paintVeilCanvas(geom: LatticePaintGeom) {
  const canvas = veilCanvasEl.value;
  if (!canvas) return;
  const ctx = syncCanvasBacking(canvas, geom);
  if (!ctx) return;
  ctx.setTransform(geom.dpr, 0, 0, geom.dpr, 0, 0);
  ctx.clearRect(0, 0, geom.innerW, geom.innerH);
  ctx.fillStyle = HEAT_MUTE_FILL;
  ctx.fillRect(0, 0, geom.innerW, geom.innerH);
}

/** Clear + paint bright canvas from `cellBrightBits` (in-range cells only). */
function paintBrightCanvas(geom: LatticePaintGeom | null = paintedGeom) {
  if (!geom) return;
  paintLayer(brightCanvasEl.value, geom, {
    fills: cellFillColors,
    mask: cellBrightBits,
  });
}

/** Recompute shared geom and paint all three layers to the same pixel grid. */
function redrawHeatCanvases() {
  const view = activeView.value;
  if (!view) {
    paintedGeom = null;
    return;
  }
  const geom = readLatticeGeom(view);
  if (!geom) return;
  paintedGeom = geom;
  paintBaseCanvas(geom);
  paintVeilCanvas(geom);
  paintBrightCanvas(geom);
}

function countBrightBits(): number {
  let n = 0;
  for (let i = 0; i < cellBrightBits.length; i++) {
    if (cellBrightBits[i] === 1) n++;
  }
  return n;
}

/** Match-count tip above the brush — hidden when zero cells are highlighted. */
function setBrushMatchTip(count: number) {
  const el = brushMatchEl.value;
  if (!el) return;
  if (count <= 0) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.textContent = t('memoryHeatBrushMatch', props.locale).replace('{n}', formatAccessCount(count));
  el.hidden = false;
}

/**
 * Update bright membership for the brush window, then redraw the bright canvas.
 * `force` redraws even when bits are unchanged (view remount / resize path).
 */
function patchBrightCells(brush: { loPct: number; hiPct: number } | null, force = false) {
  const n = cellIntensityPct.length;
  let changed = force;
  for (let i = 0; i < n; i++) {
    const pct = cellIntensityPct[i]!;
    const on = brush != null && pct >= brush.loPct && pct <= brush.hiPct;
    const bit = on ? 1 : 0;
    if (cellBrightBits[i] !== bit) {
      cellBrightBits[i] = bit;
      changed = true;
    }
  }
  if (changed) paintBrightCanvas(paintedGeom);
  setBrushMatchTip(brush == null ? 0 : countBrightBits());
}

function bindGridResizeObserver(el: HTMLElement | null) {
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
  if (!el || typeof ResizeObserver === 'undefined') return;
  gridResizeObserver = new ResizeObserver(() => {
    redrawHeatCanvases();
  });
  gridResizeObserver.observe(el);
}

function quantizeBrushCenter(pct: number): number {
  return Math.round(pct * 4) / 4;
}

function brushRangeLabelText(brush: { loPct: number; hiPct: number }): string {
  const max = maxAccessCount.value;
  const loRaw = Math.round((brush.loPct / 100) * max);
  const hiRaw = Math.round((brush.hiPct / 100) * max);
  const lo = Math.min(max, Math.max(0, loRaw));
  const hi = Math.min(max, Math.max(0, hiRaw));
  return `${formatAccessCount(lo)} – ${formatAccessCount(hi)}`;
}

/** Imperative browsing window — must run before reactive dim flags flip. */
function setBrushChrome(next: { centerPct: number; loPct: number; hiPct: number } | null) {
  const el = brushChromeEl.value;
  if (!el) return;
  if (next == null) {
    el.hidden = true;
    setBrushMatchTip(0);
    return;
  }
  el.style.left = `${next.loPct}%`;
  el.style.width = `${LEGEND_BRUSH_WIDTH_PCT}%`;
  const label = brushRangeEl.value;
  if (label) label.textContent = brushRangeLabelText(next);
  el.hidden = false;
}

function applyLegendBrush(
  next: { centerPct: number; loPct: number; hiPct: number } | null,
  trackWidthPx?: number,
) {
  if (next == null) {
    lastAppliedBrushCenter = null;
    // Hide browsing window first, then start leave fades.
    setBrushChrome(null);
    legendBrush.value = null;
    legendDimOn.value = false;
    heatVeilOn.value = false;
    return;
  }
  const entering = legendBrush.value == null;
  // Show/move browsing window first (direct DOM), then start or continue dims.
  setBrushChrome(next);
  legendBrush.value = next;
  if (trackWidthPx != null && legendTrackWidthPx.value !== trackWidthPx) {
    legendTrackWidthPx.value = trackWidthPx;
  }
  if (entering) {
    legendDimOn.value = true;
    heatVeilOn.value = true;
  }
  lastBrightBrush = next;
  patchBrightCells(next);
}

function onHeatVeilTransitionEnd(e: TransitionEvent) {
  if (e.propertyName !== 'opacity') return;
  if (heatVeilOn.value) return;
  lastBrightBrush = null;
  patchBrightCells(null);
}

function flushLegendBrushFromClientX(clientX: number) {
  const track = legendTrackEl.value;
  if (!track) return;
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) return;
  const rawPct = ((clientX - rect.left) / rect.width) * 100;
  const centerPct = quantizeBrushCenter(
    Math.min(100 + LEGEND_BRUSH_HALF_PCT, Math.max(-LEGEND_BRUSH_HALF_PCT, rawPct)),
  );
  if (lastAppliedBrushCenter === centerPct && legendBrush.value != null) return;
  lastAppliedBrushCenter = centerPct;
  applyLegendBrush(
    {
      centerPct,
      loPct: centerPct - LEGEND_BRUSH_HALF_PCT,
      hiPct: centerPct + LEGEND_BRUSH_HALF_PCT,
    },
    rect.width,
  );
}

function onLegendPointerMove(e: PointerEvent) {
  pendingLegendClientX = e.clientX;
  // Enter synchronously so veil/occ fades start on the same event.
  if (legendBrush.value == null) {
    flushLegendBrushFromClientX(e.clientX);
    return;
  }
  if (legendBrushMoveRaf) return;
  legendBrushMoveRaf = requestAnimationFrame(() => {
    legendBrushMoveRaf = 0;
    if (pendingLegendClientX != null) flushLegendBrushFromClientX(pendingLegendClientX);
  });
}

function clearLegendBrush() {
  // Keep track width so occupancy bands stay mounted while opacity fades out.
  pendingLegendClientX = null;
  if (legendBrushMoveRaf) {
    cancelAnimationFrame(legendBrushMoveRaf);
    legendBrushMoveRaf = 0;
  }
  applyLegendBrush(null);
}

function isBrushMutedIndex(index: number): boolean {
  // Live brush, or last window while bright cells remain through the leave fade.
  const active = legendBrush.value ?? lastBrightBrush;
  if (!active) return false;
  const pct = cellIntensityPct[index];
  if (pct == null) return false;
  return pct < active.loPct || pct > active.hiPct;
}

onBeforeUnmount(() => {
  if (legendBrushMoveRaf) cancelAnimationFrame(legendBrushMoveRaf);
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
});

watch(gridEl, (el) => {
  bindGridResizeObserver(el);
  if (el) void nextTick(() => redrawHeatCanvases());
});

/** Occupancy bands stay mounted after leave so opacity can fade out. */
const legendOccupancyBands = computed(() => {
  if (legendTrackWidthPx.value <= 0) return [];
  const blocks = activeView.value?.blocks ?? [];
  return mergeOccupancyBands(
    blocks.map((b) => b.intensity),
    legendTrackWidthPx.value,
  );
});

function legendOccStyle(band: { leftPct: number; widthPct: number }): CSSProperties {
  const w = legendTrackWidthPx.value;
  const leftPx = (band.leftPct / 100) * w;
  return {
    left: `${band.leftPct}%`,
    width: `${band.widthPct}%`,
    backgroundImage: LEGEND_GRADIENT,
    backgroundSize: `${w}px 100%`,
    backgroundPosition: `-${leftPx}px 0`,
  };
}

/** Opacity for the `0` end label — fades as the brush window approaches the left edge. */
const legendMinTickOpacity = computed(() => {
  const brush = legendBrush.value;
  if (!brush) return 1;
  return Math.min(1, Math.max(0, brush.loPct / LEGEND_END_FADE_ZONE_PCT));
});

/** Opacity for the max end label — fades as the brush window approaches the right edge. */
const legendMaxTickOpacity = computed(() => {
  const brush = legendBrush.value;
  if (!brush) return 1;
  return Math.min(1, Math.max(0, (100 - brush.hiPct) / LEGEND_END_FADE_ZONE_PCT));
});

watch(
  activeView,
  (view) => {
    clearCellTip();
    pendingLegendClientX = null;
    if (legendBrushMoveRaf) {
      cancelAnimationFrame(legendBrushMoveRaf);
      legendBrushMoveRaf = 0;
    }
    legendBrush.value = null;
    legendDimOn.value = false;
    heatVeilOn.value = false;
    lastBrightBrush = null;
    lastAppliedBrushCenter = null;
    legendTrackWidthPx.value = 0;
    rebuildCellPaintCache(view);
    void nextTick(() => {
      setBrushChrome(null);
      bindGridResizeObserver(gridEl.value);
      redrawHeatCanvases();
      patchBrightCells(null, true);
    });
  },
  { immediate: true },
);
</script>

<template>
  <section
    v-if="units.length > 0"
    class="pr-heat"
    :style="{ '--pr-heat-dim-ms': `${LEGEND_DIM_MS}ms` }"
    data-testid="memory-heatmap-panel"
    role="region"
    :aria-label="t('memoryAnalysis', locale)"
  >
    <div
      ref="tabsEl"
      class="pr-heat__tabs"
      role="tablist"
      data-testid="heat-tabs"
      @keydown="onTabsKeydown"
    >
      <button
        v-for="id in TABS"
        :id="`heat-tab-${id}`"
        :key="id"
        type="button"
        role="tab"
        class="pr-heat__tab"
        :class="{ 'pr-heat__tab--active': id === selectedUnit }"
        :data-testid="`heat-tab-${id}`"
        :aria-selected="id === selectedUnit"
        :tabindex="id === (selectedUnit ?? TABS[0]) ? 0 : -1"
        @click="emit('select-unit', id)"
      >
        {{ unitLabel(id) }}
      </button>
    </div>

    <!--
      Always reserve this band so multi-view UB does not shrink the lattice vs other tabs.
      Above the Access Count legend; outside the body so the lattice cannot clip the pill (PR-HEAT-011).
    -->
    <div
      class="pr-heat__view-bar"
      data-testid="heat-view-bar"
      :data-empty="!(activeUnit && activeUnit.views.length > 1) || undefined"
    >
      <SourcePillSelect
        v-if="activeUnit && activeUnit.views.length > 1"
        :caption="t('memoryHeatView', locale)"
        :model-value="viewSelectValue"
        :options="viewSelectOptions"
        test-id="heat-view-select"
        @update:model-value="onViewSelect"
      />
    </div>

    <div class="pr-heat__legend" data-testid="heat-legend">
      <div class="pr-heat__legend-scale">
        <p
          class="pr-heat__legend-title"
          data-testid="heat-legend-title"
        >
          {{ t('memoryHeatAccessCount', locale) }}
        </p>
        <!--
          Hit band = 16px window + 3px pad above/below (22px) and ±5% side pads
          (half brush) so approaching from left/right can capture 0–0 / max–max.
          Painted strip stays 8px; range label coerces to 0…max.
        -->
        <div
          class="pr-heat__legend-hit"
          data-testid="heat-legend-gradient"
          :style="{ '--pr-heat-dim-ms': `${LEGEND_DIM_MS}ms` }"
          @pointermove="onLegendPointerMove"
          @pointerleave="clearLegendBrush"
        >
          <div
            ref="legendTrackEl"
            class="pr-heat__legend-track"
            data-testid="heat-legend-track"
          >
            <div
              class="pr-heat__gradient"
              :class="{ 'pr-heat__gradient--brushing': legendDimOn }"
              aria-hidden="true"
              :style="{ background: LEGEND_GRADIENT }"
            >
              <div
                class="pr-heat__legend-mute"
                data-testid="heat-legend-mute"
              />
              <div
                v-for="(band, i) in legendOccupancyBands"
                :key="i"
                class="pr-heat__legend-occ"
                data-testid="heat-legend-occ"
                :style="legendOccStyle(band)"
              />
            </div>
            <!-- Always mounted; shown via imperative `hidden` before dim fades start. -->
            <div
              ref="brushChromeEl"
              class="pr-heat__legend-brush"
              data-testid="heat-legend-brush"
              aria-hidden="true"
              hidden
            >
              <span
                ref="brushMatchEl"
                class="pr-heat__legend-brush-match"
                data-testid="heat-legend-brush-match"
                hidden
              />
              <span
                ref="brushRangeEl"
                class="pr-heat__legend-brush-range"
                data-testid="heat-legend-brush-range"
              />
            </div>
          </div>
        </div>
        <div class="pr-heat__legend-ticks" data-testid="heat-legend-ticks">
          <span
            class="pr-heat__legend-tick"
            data-testid="heat-legend-tick-min"
            :style="{ opacity: legendMinTickOpacity }"
          >0</span>
          <span
            class="pr-heat__legend-tick"
            data-testid="heat-legend-tick-max"
            :style="{ opacity: legendMaxTickOpacity }"
          >{{ legendMaxLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Outside the body so the badge cannot steal lattice height (PR-HEAT-011 / DATA-50). -->
    <p
      v-if="activeView?.outsideDeclared"
      class="pr-heat__outside"
      data-testid="heat-outside"
    >
      {{ t('memoryHeatOutsideDeclared', locale) }}
    </p>

    <div
      class="pr-heat__body"
      data-testid="heat-body"
      role="tabpanel"
      :aria-labelledby="selectedUnit ? `heat-tab-${selectedUnit}` : undefined"
    >
      <template v-if="activeView">
        <div
          class="pr-heat__lattice"
          data-testid="heat-lattice"
        >
          <div
            ref="gridEl"
            class="pr-heat__grid"
            :style="{ '--pr-heat-cols': gridColumns, '--pr-heat-rows': gridRows }"
            data-testid="heat-grid"
            role="img"
            :aria-label="gridLabel"
            @pointermove="onGridPointerMove"
            @pointerleave="clearCellTip"
          >
            <!--
              One board box — base / veil / bright canvases share identical CSS + paint geom
              so brush highlights do not jump relative to muted cells.
            -->
            <div
              ref="boardEl"
              class="pr-heat__board"
              data-testid="heat-board"
              aria-hidden="true"
            >
              <canvas
                ref="baseCanvasEl"
                class="pr-heat__canvas pr-heat__canvas--base"
                data-testid="heat-canvas"
              />
              <!-- Solid mute veil — sole heatmap element that animates opacity on enter/leave. -->
              <canvas
                ref="veilCanvasEl"
                class="pr-heat__canvas pr-heat__mute-veil"
                :class="{ 'pr-heat__mute-veil--on': heatVeilOn }"
                data-testid="heat-mute-veil"
                @transitionend="onHeatVeilTransitionEnd"
              />
              <!-- Bright top layer — in-range cells only (canvas redraw on brush slide). -->
              <canvas
                ref="brightCanvasEl"
                class="pr-heat__canvas pr-heat__canvas--bright"
                data-testid="heat-canvas-bright"
              />
            </div>
            <!-- Zoomed filled overlay — cells keep fixed size (no layout grow). -->
            <div
              v-if="
                hoveredBlockIndex != null &&
                activeView.blocks[hoveredBlockIndex] &&
                !isBrushMutedIndex(hoveredBlockIndex)
              "
              class="pr-heat__hover"
              data-testid="heat-cell-hover"
              aria-hidden="true"
              :style="hoverOverlayStyle"
            />
          </div>
        </div>
        <p
          v-if="unitName"
          class="pr-heat__title"
          data-testid="heat-unit-name"
        >
          {{ unitName }}
        </p>
        <p
          v-if="metricLabel"
          class="pr-heat__metric"
          data-testid="heat-metric"
        >
          {{ metricLabel }}
        </p>
      </template>

      <p
        v-else
        class="pr-heat__empty"
        data-testid="heat-empty"
      >
        {{ t('memoryHeatEmpty', locale) }}
      </p>
    </div>

    <!--
      SA Memory Utilization cell tip (#194): Start Address, Cell Size, Access Count.
      Teleport→body + placeFixedTip so the panel cannot crop it.
    -->
    <Teleport to="body">
      <div
        v-if="tipContent"
        class="pr-tooltip pr-heat-cell-tip"
        data-testid="heat-cell-tooltip"
        :style="cellTipStyle"
      >
        <div
          class="pr-heat-cell-tip__row"
          data-testid="heat-cell-tip-address"
        >
          <span class="pr-heat-cell-tip__label">{{ t('memoryHeatStartAddress', locale) }}</span>
          <span
            class="pr-heat-cell-tip__value"
            data-testid="heat-cell-tip-address-value"
          >{{ tipContent.startAddress }}</span>
        </div>
        <div
          class="pr-heat-cell-tip__row"
          data-testid="heat-cell-tip-cell-size"
        >
          <span class="pr-heat-cell-tip__label">{{ t('memoryHeatCellSize', locale) }}</span>
          <span
            class="pr-heat-cell-tip__value"
            data-testid="heat-cell-tip-cell-size-value"
          >{{ tipContent.cellSize }} {{ t('memoryHeatBytes', locale) }}</span>
        </div>
        <div
          class="pr-heat-cell-tip__row"
          data-testid="heat-cell-tip-accesses"
        >
          <span class="pr-heat-cell-tip__label">{{ t('memoryHeatAccessesCount', locale) }}</span>
          <span
            class="pr-heat-cell-tip__value"
            data-testid="heat-cell-tip-accesses-value"
          >{{ formatAccessCount(tipContent.accessCount) }}</span>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.pr-heat {
  --pr-heat-dim-ms: 200ms;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  background: #262626;
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  overflow: hidden;
}

.pr-heat__tabs {
  display: flex;
  flex: none;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid #333333;
  overflow-x: auto;
}

.pr-heat__tab {
  position: relative;
  flex: none;
  white-space: nowrap;
  padding: 6px 10px 12px;
  border: none;
  background: none;
  color: #b3b3b3;
  font: inherit;
  cursor: pointer;
}

.pr-heat__tab:hover {
  color: #fff;
}

.pr-heat__tab--active {
  color: #fff;
}

.pr-heat__tab--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: calc(100% - 16px);
  height: 2px;
  border-radius: 1px;
  background: #ffffff;
  transform: translateX(-50%);
}

.pr-heat__legend {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  /* View-bar sits above; modest pad into the lattice below. */
  padding: 12px 0;
}

.pr-heat__legend-scale {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(100%, 220px);
}

.pr-heat__legend-title {
  margin: 0;
  color: #b3b3b3;
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  text-align: center;
}

.pr-heat__legend-hit {
  position: relative;
  /* 16px brush + 3px vertical pad; ±5% side pads (half brush) for 0/max capture. */
  box-sizing: border-box;
  height: 22px;
  width: calc(100% + 2 * 5%);
  margin-inline: -5%;
  padding-inline: 5%;
  overflow: visible;
  cursor: default;
}

.pr-heat__legend-track {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.pr-heat__gradient {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 8px;
  border-radius: 1px;
  overflow: hidden;
  transform: translateY(-50%);
  pointer-events: none;
}

/* Solid mute over the always-on gradient; fades with brush enter/leave. */
.pr-heat__legend-mute {
  position: absolute;
  inset: 0;
  background: #2c2c2c;
  opacity: 0;
  transition: opacity var(--pr-heat-dim-ms, 200ms) ease;
}

.pr-heat__gradient--brushing .pr-heat__legend-mute {
  opacity: 1;
}

/* Bright Free→Used slices above the mute; fade with the same timing. */
.pr-heat__legend-occ {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--pr-heat-dim-ms, 200ms) ease;
}

.pr-heat__gradient--brushing .pr-heat__legend-occ {
  opacity: 1;
}

.pr-heat__legend-brush {
  position: absolute;
  /* Inset 3px so the visual window stays 16px inside the 22px hit band. */
  top: 3px;
  bottom: 3px;
  z-index: 1;
  box-sizing: border-box;
  pointer-events: none;
  border: 1.5px solid rgba(255, 255, 255, 0.75);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.35);
  /* No transition — chrome must paint before legend/heatmap fades (flushSync). */
}

/* Match-count tip — same chrome as `.pr-heat-cell-tip` / EventTooltip. */
.pr-heat__legend-brush-match {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  padding: 6px 10px;
  white-space: nowrap;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  color: #e8e8e8;
  font-size: 12px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  pointer-events: none;
}

.pr-heat__legend-brush-range {
  position: absolute;
  /* Clear the pointer over the brush window (was 2px — sat under the cursor tip). */
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: #e8e8e8;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  pointer-events: none;
}

.pr-heat__legend-ticks {
  /* Room for the brush range label that sits under the window (+8px gap). */
  position: relative;
  z-index: 0;
  display: flex;
  justify-content: space-between;
  min-height: 18px;
  color: #b3b3b3;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.pr-heat__legend-tick {
  flex: none;
  transition: opacity 80ms linear;
}

.pr-heat__view-bar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  /* Match SourcePillSelect closed height so empty tabs keep the same lattice. */
  min-height: var(--pr-src-control-h, 28px);
  /* Under the tab rule, above the Access Count legend. */
  margin: 16px 0 0;
}

.pr-heat__outside {
  flex: none;
  margin: 0 0 8px;
  color: #e6a23c;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
}

.pr-heat__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
  container-type: size;
}

.pr-heat__lattice {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.pr-heat__grid {
  --pr-heat-cols: 16;
  --pr-heat-rows: 26;
  --pr-heat-footer: 81px;
  /* 8px = 2px padding×2 + 2px border×2 — height must match width or the frame clips. */
  --pr-heat-cell: min(
    calc((100cqw - 8px) / var(--pr-heat-cols) - 2px),
    calc((100cqh - var(--pr-heat-footer) - 8px) / var(--pr-heat-rows) - 2px)
  );
  position: relative;
  box-sizing: border-box;
  /* Explicit frame size — canvases are abs-pos; no grid children for intrinsic size. */
  width: calc(var(--pr-heat-cols) * (var(--pr-heat-cell) + 2px) - 2px + 8px);
  height: calc(var(--pr-heat-rows) * (var(--pr-heat-cell) + 2px) - 2px + 8px);
  padding: 2px;
  border: 2px solid #6e798d;
  border-radius: 5px;
  background: #303f5e;
  /* Visible so the +4px hover zoom can paint into gaps / past pad. */
  overflow: visible;
}

/*
 * Shared absolute box — inset matches grid padding so the board always fills the
 * content box (no JS width/height; those went stale and shrank the lattice).
 */
.pr-heat__board {
  position: absolute;
  inset: 2px;
  z-index: 0;
  pointer-events: none;
}

.pr-heat__canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  /* Promote all three the same way so veil opacity compositing does not drift. */
  transform: translateZ(0);
}

.pr-heat__canvas--bright {
  z-index: 2;
}

/* Solid mute veil canvas — sole heatmap enter/leave opacity animation. */
.pr-heat__mute-veil {
  z-index: 1;
  opacity: 0;
  transition: opacity var(--pr-heat-dim-ms, 200ms) ease;
}

.pr-heat__mute-veil--on {
  opacity: 1;
}

.pr-heat__hover {
  position: absolute;
  z-index: 3;
  border-radius: 1px;
  box-sizing: border-box;
  pointer-events: none;
  /* Size + fill from hoverOverlayStyle; stroke matches board gap (#303f5e / 2px). */
  box-shadow: 0 0 0 2px #303f5e;
}

.pr-heat__title {
  flex: none;
  margin: 31px 0 0;
  color: #e7e7e7;
  font-size: 19px;
  font-weight: 600;
  line-height: 22px;
  text-align: center;
}

.pr-heat__metric {
  flex: none;
  margin: 13px 0 0;
  color: #b3b3b3;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
}

.pr-heat__empty {
  margin: auto;
  color: #b3b3b3;
  text-align: center;
}
</style>

<!--
  Unscoped: Teleport → body (CounterHoverTip / OverviewCharts pattern). Scoped
  selectors can fail to paint position/color on the teleported node.
-->
<style>
.pr-heat-cell-tip.pr-tooltip {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  box-sizing: border-box;
  padding: 8px 10px;
  background: var(--pr-surface-raised, #363636);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  color: #b3b3b3;
  font-size: 12px;
  line-height: 1.45;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* No enter fade — cell switches must feel instant (swimlane EventTooltip). */
}

.pr-heat-cell-tip__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pr-heat-cell-tip__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: #e8e8e8;
}

.pr-heat-cell-tip__value {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: #e8e8e8;
}
</style>
