export type GutterLane = {
  id: string;
  name: string;
  utilization?: number;
  color: string;
  /** Present ⇒ folder (may be [] when collapsed). */
  children?: GutterLane[];
  /** When set, gutter localizes the label via i18n lane* keys. */
  categoryKey?: 'comm' | 'compute' | 'hbm';
};

export type GutterGroup = {
  id: string;
  name: string;
  lanes: GutterLane[];
};
