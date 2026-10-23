import { describe, expect, it } from 'vitest';
import {
  cssRowHeight,
  cssScrollFromDevice,
  deviceScrollFromCss,
  isUsableGeometry,
  trailingRowCount,
} from '../../src/ui/SourceView/editorTableSync';

describe('editorTableSync', () => {
  it('maps device and CSS scroll without drift at integer dpr', () => {
    expect(deviceScrollFromCss(40, 2)).toBe(80);
    expect(cssScrollFromDevice(80, 2)).toBe(40);
    expect(cssRowHeight({ lineHeight: 36, dpr: 2 })).toBe(18);
  });

  it('trailingRowCount mirrors editor virtual blank lines', () => {
    expect(
      trailingRowCount({
        dpr: 2,
        lineHeight: 36,
        editorHeight: 360,
        maxVScrollPos: 0,
        numLines: 10,
        fontSize: 24,
        fontFamily: 'Consolas',
      }),
    ).toBe(0);
    expect(
      trailingRowCount({
        dpr: 2,
        lineHeight: 36,
        editorHeight: 360,
        maxVScrollPos: 720,
        numLines: 10,
        fontSize: 24,
        fontFamily: 'Consolas',
      }),
    ).toBe(20);
  });

  it('isUsableGeometry rejects zero metrics', () => {
    expect(
      isUsableGeometry({
        dpr: 0,
        lineHeight: 36,
        editorHeight: 100,
        maxVScrollPos: 0,
        numLines: 1,
        fontSize: 12,
        fontFamily: null,
      }),
    ).toBe(false);
  });
});
