/**
 * Step-after vertices for overview counter series (DATA-39).
 * Holds each sample's value until the next sample time, then jumps.
 */

export interface StepPoint {
  t: number;
  v: number;
}

/**
 * Build polyline vertices for a step-after plot clipped to [windowStart, windowEnd].
 * Points must be sorted by `t` ascending.
 */
export function stepAfterVertices(
  points: readonly StepPoint[],
  windowStart: number,
  windowEnd: number,
): StepPoint[] {
  if (points.length === 0 || !(windowEnd > windowStart)) return [];

  // Last sample at or before windowStart (value held into the window).
  let holdIdx = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.t <= windowStart) holdIdx = i;
    else break;
  }

  const out: StepPoint[] = [];
  if (holdIdx >= 0) {
    out.push({ t: windowStart, v: points[holdIdx]!.v });
  } else {
    // First sample starts after the window origin — begin at that sample.
    const first = points[0]!;
    if (first.t > windowEnd) return [];
    out.push({ t: first.t, v: first.v });
    holdIdx = 0;
  }

  for (let j = holdIdx + 1; j < points.length; j++) {
    const p = points[j]!;
    if (p.t > windowEnd) break;
    const prevV = out[out.length - 1]!.v;
    out.push({ t: p.t, v: prevV });
    out.push({ t: p.t, v: p.v });
  }

  const last = out[out.length - 1]!;
  if (last.t < windowEnd) {
    out.push({ t: windowEnd, v: last.v });
  }
  return out;
}

export function strokePathFromVertices(
  vertices: readonly StepPoint[],
  toX: (t: number) => number,
  toY: (v: number) => number,
): string {
  if (vertices.length === 0) return '';
  let d = `M ${toX(vertices[0]!.t)} ${toY(vertices[0]!.v)}`;
  for (let i = 1; i < vertices.length; i++) {
    d += ` L ${toX(vertices[i]!.t)} ${toY(vertices[i]!.v)}`;
  }
  return d;
}

export function areaPathFromVertices(
  vertices: readonly StepPoint[],
  baselineY: number,
  toX: (t: number) => number,
  toY: (v: number) => number,
): string {
  if (vertices.length === 0) return '';
  const first = vertices[0]!;
  const last = vertices[vertices.length - 1]!;
  let d = `M ${toX(first.t)} ${baselineY}`;
  d += ` L ${toX(first.t)} ${toY(first.v)}`;
  for (let i = 1; i < vertices.length; i++) {
    d += ` L ${toX(vertices[i]!.t)} ${toY(vertices[i]!.v)}`;
  }
  d += ` L ${toX(last.t)} ${baselineY} Z`;
  return d;
}
