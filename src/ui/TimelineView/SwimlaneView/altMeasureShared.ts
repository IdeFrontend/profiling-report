import type { InjectionKey, Reactive } from 'vue';
import { reactive } from 'vue';
import type { SwimEvent } from '../../../domain/types';

/** Which swim surface an Alt-measure endpoint was captured on. */
export type AltMeasureSurface = 'strip' | 'body' | 'solo';

/** Hovered/edge/cursor target while an Alt-measure session is active. */
export type AltMeasureTarget =
  | { eventId: string; time: number; surface: AltMeasureSurface }
  | { eventId: null; time: number; surface: AltMeasureSurface };

/** Shared across pin-strip + body canvases so measure can span sticky ↔ scroll lanes. */
export type AltMeasureShared = {
  anchorId: string | null;
  /** Surface where the user Alt+clicked the anchor (not inferred from pin list). */
  anchorSurface: AltMeasureSurface | null;
  target: AltMeasureTarget | null;
  pinned: boolean;
  altKeyHeld: boolean;
};

export const ALT_MEASURE_SHARED_KEY: InjectionKey<Reactive<AltMeasureShared>> =
  Symbol('altMeasureShared');

export const ALT_MEASURE_FIND_EVENT_KEY: InjectionKey<(id: string) => SwimEvent | null> = Symbol(
  'altMeasureFindEvent',
);

export function createAltMeasureShared(): Reactive<AltMeasureShared> {
  return reactive({
    anchorId: null,
    anchorSurface: null,
    target: null,
    pinned: false,
    altKeyHeld: false,
  });
}

export function clearAltMeasureShared(s: AltMeasureShared): void {
  s.anchorId = null;
  s.anchorSurface = null;
  s.target = null;
  s.pinned = false;
}
