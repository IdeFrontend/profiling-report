import { describe, expect, it } from 'vitest';
import {
  DOCK_HEIGHT_COLLAPSED,
  DOCK_HEIGHT_MARQUEE_PREVIEW,
  marqueePreviewDockHeight,
} from './panelResize';

describe('marqueePreviewDockHeight', () => {
  const base = {
    scrollY: 0,
    contentTopPad: 0,
    targetHeight: DOCK_HEIGHT_COLLAPSED,
  };

  it('returns min when content fills the closed wrap (slack 0)', () => {
    // Closed wrap 400; content bottom at 400 → no slack.
    expect(
      marqueePreviewDockHeight({
        ...base,
        wrapHeightNow: 400 - DOCK_HEIGHT_MARQUEE_PREVIEW,
        currentPreviewHeight: DOCK_HEIGHT_MARQUEE_PREVIEW,
        contentHeight: 400,
      }),
    ).toBe(DOCK_HEIGHT_MARQUEE_PREVIEW);
  });

  it('caps at target when slack exceeds collapsed height', () => {
    // Closed wrap 500; content 100 → slack 400 → capped at 247.
    expect(
      marqueePreviewDockHeight({
        ...base,
        wrapHeightNow: 500,
        currentPreviewHeight: 0,
        contentHeight: 100,
      }),
    ).toBe(DOCK_HEIGHT_COLLAPSED);
  });

  it('uses available slack when between min and target', () => {
    expect(
      marqueePreviewDockHeight({
        ...base,
        wrapHeightNow: 300,
        currentPreviewHeight: 0,
        contentHeight: 200,
      }),
    ).toBe(100);
  });

  it('is stable across preview-height iterations (wrap shrink compensated)', () => {
    const closed = 500;
    const content = 200;
    const first = marqueePreviewDockHeight({
      ...base,
      wrapHeightNow: closed,
      currentPreviewHeight: 0,
      contentHeight: content,
    });
    expect(first).toBe(DOCK_HEIGHT_COLLAPSED);
    const second = marqueePreviewDockHeight({
      ...base,
      wrapHeightNow: closed - first,
      currentPreviewHeight: first,
      contentHeight: content,
    });
    expect(second).toBe(first);
  });

  it('accounts for scrollY and contentTopPad', () => {
    // Closed wrap 400; content 300; scroll 50; pad 20 → effectiveScroll 30
    // contentBottom = 300 - 30 = 270; slack = 400 - 270 = 130.
    expect(
      marqueePreviewDockHeight({
        wrapHeightNow: 400,
        currentPreviewHeight: 0,
        contentHeight: 300,
        scrollY: 50,
        contentTopPad: 20,
        targetHeight: DOCK_HEIGHT_COLLAPSED,
      }),
    ).toBe(130);
  });
});
