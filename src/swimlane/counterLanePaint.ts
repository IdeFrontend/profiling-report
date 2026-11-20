/**
 * Canvas2D step-after area for swim CounterTrack lanes (Chrome CounterTrack-like).
 */

import type { SwimlaneViewWindow } from '../domain/types';
import { stepAfterVertices } from '../ui/TimelineView/OverviewCharts/stepPath';
import { LANE_HEIGHT, LANE_PAD_Y, collapseShiftY, type FlatLane, type CollapseTransform } from './layout';

/** OverviewCharts / UI-61 parity — memory util CT uses `#E7434A` at this alpha. */
const FILL_ALPHA = 0.45;

/**
 * Paint counter step-after charts for visible counter lanes into an already-scaled
 * device-pixel canvas context (`width`/`height` are device px).
 */
export function paintCounterLanes(
  ctx: CanvasRenderingContext2D,
  lanes: readonly FlatLane[],
  view: SwimlaneViewWindow,
  width: number,
  height: number,
  dpr: number,
  collapse: CollapseTransform,
): void {
  const span = Math.max(1, view.endTime - view.startTime);
  const pad = LANE_PAD_Y * dpr;
  for (const lane of lanes) {
    if (!lane.counter) continue;
    const series = lane.thread.counter;
    if (!series || series.points.length === 0) continue;
    const yCss = collapseShiftY(lane.y, collapse) - view.scrollY;
    const y0 = yCss * dpr;
    const laneH = LANE_HEIGHT * dpr;
    if (y0 + laneH < 0 || y0 > height) continue;
    const plotTop = y0 + pad;
    const plotH = Math.max(1, laneH - pad * 2);
    const yMax = series.yMax > 0 ? series.yMax : 1;
    const verts = stepAfterVertices(series.points, view.startTime, view.endTime);
    if (verts.length === 0) continue;
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
    ctx.fillStyle = lane.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(toX(verts[0]!.t), toY(verts[0]!.v));
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(toX(verts[i]!.t), toY(verts[i]!.v));
    }
    ctx.strokeStyle = lane.color;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.stroke();
    ctx.restore();
  }
}
