import type { InjectionKey, Reactive } from 'vue';
import { reactive } from 'vue';
import type { SwimEvent } from '../../../domain/types';

/** Hovered/edge/cursor target while an Alt-measure session is active. */
export type AltMeasureTarget =
  | { eventId: string; time: number }
  | { eventId: null; time: number };

/** Shared across pin-strip + body canvases so measure can span sticky ↔ scroll lanes. */
export type AltMeasureShared = {
  anchorId: string | null;
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
    target: null,
    pinned: false,
    altKeyHeld: false,
  });
}

export function clearAltMeasureShared(s: AltMeasureShared): void {
  s.anchorId = null;
  s.target = null;
  s.pinned = false;
}
