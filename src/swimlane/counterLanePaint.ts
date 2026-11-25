/**
 * Canvas2D step-after area for swim CounterTrack lanes (Chrome CounterTrack-like).
 */

import type { SwimCounterSeries, SwimlaneViewWindow } from '../domain/types';
import { stepAfterVertices } from '../ui/TimelineView/OverviewCharts/stepPath';
import {
  COUNTER_LANE_HEIGHT,
  flatLaneHeight,
  LANE_PAD_Y,
  collapseShiftY,
  collapseAlpha,
  counterFolderPaintsOverlay,
  isCounterSeriesFolder,
  visibleIndexRange,
  collapseTweenOverlapsBands,
  type FlatLane,
  type CollapseTransform,
} from './layout';

/** OverviewCharts / UI-61 parity — CounterTrack fill at this alpha over series color. */
const FILL_ALPHA = 0.45;

function paintOneSeries(
  ctx: CanvasRenderingContext2D,
  series: SwimCounterSeries,
  color: string,
  view: SwimlaneViewWindow,
  width: number,
  plotTop: number,
  plotH: number,
  yMax: number,
  dpr: number,
): void {
  if (series.points.length === 0) return;
  const span = Math.max(1, view.endTime - view.startTime);
  const verts = stepAfterVertices(series.points, view.startTime, view.endTime);
  if (verts.length === 0) return;
  const toX = (t: number) => ((t - view.startTime) / span) * width;
  const toY = (v: number) => {
    const clamped = Math.min(yMax, Math.max(0, v));
    return plotTop + plotH * (1 - clamped / yMax);
  };
  const baseline = plotTop + plotH;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(toX(verts[0]!.t), baseline);
  ctx.lineTo(toX(verts[0]!.t), toY(verts[0]!.v));
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(toX(verts[i]!.t), toY(verts[i]!.v));
  }
  ctx.lineTo(toX(verts[verts.length - 1]!.t), baseline);
  ctx.closePath();
  ctx.globalAlpha = FILL_ALPHA;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(toX(verts[0]!.t), toY(verts[0]!.v));
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(toX(verts[i]!.t), toY(verts[i]!.v));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, dpr);
  ctx.stroke();
  ctx.restore();
}

/**
 * Paint counter step-after charts for visible counter lanes into an already-scaled
 * device-pixel canvas context (`width`/`height` are device px).
 * Collapsed multi-series folders paint every entry in `thread.counterSeries`
 * (shared Y); expanded folders are chevron-only — children paint as leaves.
 * Skips fold-hidden lanes (`collapseAlpha === 0`).
 */
export function paintCounterLanes(
  ctx: CanvasRenderingContext2D,
  lanes: readonly FlatLane[],
  view: SwimlaneViewWindow,
  width: number,
  height: number,
  dpr: number,
  collapse: CollapseTransform,
  collapsedIds: readonly string[] = [],
): void {
  const pad = LANE_PAD_Y * dpr;
  const viewH = height / Math.max(dpr, Number.EPSILON);
  const [lo, hi] = visibleIndexRange(
    lanes.length,
    (i) => collapseShiftY(lanes[i]!.y, collapse),
    (i) => {
      const lane = lanes[i]!;
      if (counterFolderPaintsOverlay(lane.thread, collapsedIds, collapse)) return COUNTER_LANE_HEIGHT;
      return flatLaneHeight(lane);
    },
    view.scrollY,
    viewH,
    !collapseTweenOverlapsBands(collapse),
  );
  for (let i = lo; i < hi; i++) {
    const lane = lanes[i]!;
    if (collapseAlpha(lane.y, collapse) <= 0) continue;

    // Rest-collapsed multi-series overlay only (not mid expand/collapse tween).
    const multiOverlay = counterFolderPaintsOverlay(lane.thread, collapsedIds, collapse);

    if (!lane.counter && !multiOverlay) continue;
    // Expanded multi-series folder: chevron only (even if wrongly flagged counter).
    if (lane.folder && isCounterSeriesFolder(lane.thread) && !multiOverlay) continue;

    const yCss = collapseShiftY(lane.y, collapse) - view.scrollY;
    const y0 = yCss * dpr;
    // Rest-collapsed multi-series overlay uses the taller counter band even when
    // the expanded-layout folder row is still LANE_HEIGHT.
    const bandCss = multiOverlay ? COUNTER_LANE_HEIGHT : flatLaneHeight(lane);
    const laneH = bandCss * dpr;
    if (y0 + laneH < 0 || y0 > height) continue;
    const plotTop = y0 + pad;
    const plotH = Math.max(1, laneH - pad * 2);

    if (multiOverlay) {
      const multi = lane.thread.counterSeries!;
      let yMax = 0;
      for (const s of multi) {
        if (s.yMax > yMax) yMax = s.yMax;
      }
      if (yMax <= 0) yMax = 1;
      for (const s of multi) {
        paintOneSeries(
          ctx,
          s,
          s.colorHex ?? lane.color,
          view,
          width,
          plotTop,
          plotH,
          yMax,
          dpr,
        );
      }
      continue;
    }

    const series = lane.thread.counter;
    if (!series || series.points.length === 0) continue;
    const yMax = series.yMax > 0 ? series.yMax : 1;
    paintOneSeries(
      ctx,
      series,
      series.colorHex ?? lane.color,
      view,
      width,
      plotTop,
      plotH,
      yMax,
      dpr,
    );
  }
}
