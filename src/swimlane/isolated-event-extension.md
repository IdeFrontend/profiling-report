# Extending Isolated Thin Events (WebGL Swimlane)

## Overview

Port of the Sudu-editor "highlight isolated events" feature to the profiling-report
WebGL swimlane renderer.

Very thin events (less than one device pixel wide) become invisible when zoomed
out. If such an event is isolated (large gaps to its neighbors on both sides),
it is extended toward a target size so it stays visible.

This port differs from the original Sudu implementation in one way: the target
size is a **vertex shader uniform** (`uExtendParameters`),
because the profiling-report renderer has no debug toggle.

## Vertex format

The swimlane mesh grows from 4 to 6 floats per vertex (stride 16 → 24 bytes):
a third attribute `aData` (index 2) carries inter-event distances.

```text
[ aPos.x, aPos.y, aTex.x, aTex.y, aData.x, aData.y ]
   pos      pos     uv      uv     gapPrev  gapNext
   (0)      (4)     (8)     (12)   (16)     (20)      byte offsets
```

  aData.x = distance from this event's start to the previous event's end
  aData.y = distance from this event's end to the next event's start

Distances are in event coordinate space (same units as aPos), relative to
`timeBase` like the interval pairs.

## Gap computation (JS side)

Gaps are computed in `createChunksFromPairs` while building each mesh chunk.
For every event, both neighboring distances are computed from the sorted
interval array:

  gapPrev = x0  - prev.end
  gapNext = next.begin - x1

### Edge / truncation policy

  eventRange = last event end - first event start  (across the whole lane)

  - First event of the line: gapPrev = eventRange (no predecessor)
  - Last event of the line (final chunk): gapNext = eventRange (no-successor)
  - When a chunk is truncated (intermediate chunk boundary), the last event
    still has a real neighbor, so gapNext is computed normally
  - Detection: `gi * 2 + 2 >= pairs.length` — true only for the true last event

This keeps edge events extendable when their one real neighboring gap is large.

## Vertex shader extension (branchless)

The vertex shader converts the gap distances to device pixels, then smoothly
ramps the extension from the larger geometry. No `if` statements — the ramp
yields continuous coverage across zoom levels (avoids the one-frame "pop" a
hard branch would cause).

```glsl
uniform vec3 uExtendParameters; // xyz = targetSize, margin1, margin2 — device px (CSS px × dpr); targetSize 0 disables

// distance → device px (scale only, no translation; not clip-space)
float gapPrevPx = aData.x * uSizePos.x * 0.5 * uResolution.x;
float gapNextPx = aData.y * uSizePos.x * 0.5 * uResolution.x;

float eventSize  = rPx - lPx;
float extendMax  = max(0.0, (uExtendParameters.x - eventSize) * 0.5); // per side
float factorL    = clamp((gapPrevPx - uExtendParameters.y) / (uExtendParameters.z - uExtendParameters.y), 0.0, 1.0);
float factorR    = clamp((gapNextPx - uExtendParameters.y) / (uExtendParameters.z - uExtendParameters.y), 0.0, 1.0);
float factor     = (factorL + factorR) * 0.5;   // averaged → max stays extendMax
float extend     = extendMax * factor;
float extendedL  = lPx - extend;
float extendedR  = rPx + extend;
```

Per-side linear factor:
  gap <= uExtendParameters.y (2px) → factor = 0 → no extension
  gap >= uExtendParameters.z (4px) → factor = 1 → full extension
  uExtendParameters.y < gap < uExtendParameters.z → linear interpolation (smooth transition)

Averaged factor keeps the max extension at `extendMax` when both gaps are large
(event reaches `uExtendParameters.x`), while still giving partial extension when only
one side has a large gap.

`extendMax = max(0.0, ...)` absorbs the `eventSize < uExtendParameters.x` check:
when the event is already wider than the target, extension is zero.

## Quad vertex snapping

The `floor`/`ceil` snapping must be applied to the **extended** bounds, so the
quad covers every pixel the extended event will write:

```glsl
float screenX = mix(floor(extendedL), ceil(extendedR), aTex.y);
```

  left vertices (aTex.y = 0) → floor(extendedL)
  right vertices (aTex.y = 1) → ceil(extendedR)

## Fragment shader

`vLrScreen` carries the **extended** bounds. The pixel shader uses them for both
the analytical horizontal coverage and the round-rect corner SDF, so an extended
isolated event renders at full size with its normal corner treatment:

  lPx = max(vLrScreen.x, vScreenPos.x - 0.5)
  rPx = min(vLrScreen.y, vScreenPos.x + 0.5)
  hCoverage = rPx - lPx
  cov = min(hCoverage, rrShape)

No change to the fragment shader was required.

## Files changed

  shaders.ts                 — SWIMLANE_VS: aData input, extension logic, uExtendParameters uniform
  WebGlSwimlaneRenderer.ts   — setVbSquareWithGaps, 6-float vertex layout (stride 24),
                               gap computation in createChunksFromPairs, aData attrib binding
