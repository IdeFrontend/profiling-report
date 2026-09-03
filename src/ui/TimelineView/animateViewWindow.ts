export type AnimViewWindow = { startTime: number; endTime: number };

const DEFAULT_DURATION_MS = 400;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Tween both window edges together toward the target (direct path).
 * Span is strictly lerp(spanFrom, spanTo) — monotonic, so a zoom-in target
 * never widens mid-flight. Instant when reduced-motion or duration is 0.
 */
export function animateViewWindow(opts: {
  from: AnimViewWindow;
  to: AnimViewWindow;
  onUpdate: (window: AnimViewWindow) => void;
  durationMs?: number;
  onDone?: () => void;
}): () => void {
  const duration =
    prefersReducedMotion() ? 0 : Math.max(0, opts.durationMs ?? DEFAULT_DURATION_MS);

  if (duration === 0) {
    opts.onUpdate({ ...opts.to });
    opts.onDone?.();
    return () => {};
  }

  const { from, to } = opts;
  let raf = 0;
  let cancelled = false;
  const t0 = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - t0) / duration);
    const e = easeInOutCubic(t);
    opts.onUpdate({
      startTime: lerp(from.startTime, to.startTime, e),
      endTime: lerp(from.endTime, to.endTime, e),
    });
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      opts.onUpdate({ ...to });
      opts.onDone?.();
    }
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
  };
}

/**
 * Tween a scalar `from` → `to` with the same ease + reduced-motion behaviour as
 * `animateViewWindow`. Used for the lane collapse/expand slide (progress 0..1).
 */
export function animateProgress(opts: {
  from: number;
  to: number;
  onUpdate: (value: number) => void;
  durationMs?: number;
  onDone?: () => void;
}): () => void {
  const duration =
    prefersReducedMotion() ? 0 : Math.max(0, opts.durationMs ?? DEFAULT_DURATION_MS);

  if (duration === 0) {
    opts.onUpdate(opts.to);
    opts.onDone?.();
    return () => {};
  }

  const { from, to } = opts;
  let raf = 0;
  let cancelled = false;
  const t0 = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - t0) / duration);
    const e = easeInOutCubic(t);
    opts.onUpdate(lerp(from, to, e));
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      opts.onUpdate(to);
      opts.onDone?.();
    }
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
  };
}
