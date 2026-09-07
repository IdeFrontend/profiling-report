import type { InjectionKey, Ref } from 'vue';

/**
 * ReportLayout provides this while `grid-template-columns` is tweening
 * (aside show/hide). SwimlaneCanvas freezes the WebGL/Canvas backing store
 * and lets CSS stretch the bitmap until the track settles.
 */
export const ASIDE_TRACK_ANIMATING_KEY: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('prAsideTrackAnimating');
