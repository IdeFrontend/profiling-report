export type GutterLane = {
  id: string;
  name: string;
  utilization?: number;
  color: string;
  /** Present ⇒ folder (may be [] when collapsed). */
  children?: GutterLane[];
};

export type GutterGroup = {
  id: string;
  name: string;
  lanes: GutterLane[];
};
