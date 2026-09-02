import { describe, expect, it } from 'vitest';
import { CLEARTYPE_TEXT_POW, GRAYSCALE_TEXT_POW, TEXT_CLEARTYPE_FS, TEXT_GRAY_FS } from '../../src/swimlane/shaders';
import { clearTypeRasterSupported, eventLabelFont } from '../../src/swimlane/textAtlas';

describe('PR-RENDER: ClearType text atlas', () => {
  it('PR-RENDER-020: text shaders export sudu gamma constants', () => {
    expect(CLEARTYPE_TEXT_POW).toBe(2.25);
    expect(GRAYSCALE_TEXT_POW).toBe(0.625);
    expect(TEXT_CLEARTYPE_FS).toContain('mix(uBgColor.rgb, uColor.rgb');
    expect(TEXT_GRAY_FS).toContain('texture(sDiffuse, textureUV).a');
  });

  it('PR-RENDER-020: eventLabelFont uses shared CSS px size', () => {
    expect(eventLabelFont(10)).toMatch(/^10px /);
  });

  it('PR-RENDER-020: clearTypeRasterSupported is false in jsdom', () => {
    expect(clearTypeRasterSupported()).toBe(false);
  });
});
