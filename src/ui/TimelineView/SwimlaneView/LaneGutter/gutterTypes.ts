import type { LaneCategoryKey } from '../../../../domain/types';

export type GutterLane = {
  id: string;
  name: string;
  utilization?: number;
  color: string;
  /** Present ⇒ folder (may be [] when collapsed). */
  children?: GutterLane[];
  /** When set, gutter localizes the label via i18n lane* keys. */
  categoryKey?: LaneCategoryKey;
};

export type GutterGroup = {
  id: string;
  name: string;
  lanes: GutterLane[];
};
