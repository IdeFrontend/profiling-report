import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensureSourceTabFonts,
  resetSourceTabFontsForTests,
  SOURCE_TAB_EDITOR_FONT,
  SOURCE_TAB_MONO_FAMILY,
} from '../../src/ui/SourceView/sourceFonts';

vi.mock('../../src/ui/SourceView/suduRuntime', () => ({
  ensureSuduFonts: vi.fn(async () => []),
}));

describe('sourceFonts', () => {
  afterEach(() => {
    resetSourceTabFontsForTests();
    vi.restoreAllMocks();
  });

  it('PR-SRC-FONT-001: editor font uses JetBrains Mono, not Consolas', () => {
    expect(SOURCE_TAB_MONO_FAMILY).toBe('JetBrains Mono');
    expect(SOURCE_TAB_EDITOR_FONT.family).toBe('JetBrains Mono');
    expect(SOURCE_TAB_EDITOR_FONT.family).not.toBe('Consolas');
  });

  it('PR-SRC-FONT-002: ensureSourceTabFonts registers JetBrains Mono and calls fonts.load', async () => {
    const faces: Array<{ family: string }> = [];
    const load = vi.fn(async function (this: { family: string }) {
      return this;
    });
    class FakeFontFace {
      family: string;
      load = load;
      constructor(family: string) {
        this.family = family;
        faces.push(this);
      }
    }
    vi.stubGlobal('FontFace', FakeFontFace);
    const fontsLoad = vi.fn(async () => []);
    const fontsAdd = vi.fn();
    vi.stubGlobal('document', {
      fonts: {
        add: fontsAdd,
        load: fontsLoad,
        ready: Promise.resolve(),
      },
    });

    await ensureSourceTabFonts('/sudu/codicon.ttf');

    expect(faces.every((f) => f.family === 'JetBrains Mono')).toBe(true);
    expect(faces.some((f) => f.family === 'Consolas')).toBe(false);
    expect(load).toHaveBeenCalled();
    expect(fontsAdd).toHaveBeenCalled();
    expect(fontsLoad).toHaveBeenCalled();
    const loadSpecs = fontsLoad.mock.calls.map((call) => String(call.at(0) ?? ''));
    expect(loadSpecs.length).toBeGreaterThan(0);
    expect(loadSpecs.every((spec) => spec.includes('JetBrains Mono'))).toBe(true);
  });
});
