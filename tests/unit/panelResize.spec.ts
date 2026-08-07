import { describe, expect, it } from 'vitest';
import {
  ASIDE_WIDTH_DEFAULT,
  ASIDE_WIDTH_MAX,
  ASIDE_WIDTH_MIN,
  clampPanelWidth,
  GUTTER_WIDTH_DEFAULT,
  GUTTER_WIDTH_MAX,
  GUTTER_WIDTH_MIN,
  startHorizontalResize,
} from '../../src/ui/panelResize';

describe('panelResize', () => {
  it('clamps to min/max', () => {
    expect(clampPanelWidth(100, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX)).toBe(GUTTER_WIDTH_MIN);
    expect(clampPanelWidth(999, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX)).toBe(GUTTER_WIDTH_MAX);
    expect(clampPanelWidth(GUTTER_WIDTH_DEFAULT, GUTTER_WIDTH_MIN, GUTTER_WIDTH_MAX)).toBe(
      GUTTER_WIDTH_DEFAULT,
    );
  });

  it('startHorizontalResize applies direction for aside (left edge)', () => {
    const widths: number[] = [];
    const session = startHorizontalResize({
      startClientX: 1000,
      startWidth: ASIDE_WIDTH_DEFAULT,
      min: ASIDE_WIDTH_MIN,
      max: ASIDE_WIDTH_MAX,
      direction: -1,
      onChange: (w) => widths.push(w),
    });
    // Drag 40px left → wider aside
    expect(session.move(960)).toBe(ASIDE_WIDTH_DEFAULT + 40);
    expect(widths.at(-1)).toBe(ASIDE_WIDTH_DEFAULT + 40);
  });
});
