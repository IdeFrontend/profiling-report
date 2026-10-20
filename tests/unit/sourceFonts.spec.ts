import { describe, expect, it } from 'vitest';
import {
  SOURCE_TAB_EDITOR_FONT,
  SOURCE_TAB_MONO_FAMILY,
  SOURCE_TAB_MONO_STACK,
} from '../../src/ui/SourceView/sourceFonts';

describe('sourceFonts', () => {
  it('PR-SRC-FONT-001: editor font uses bare monospace without fallbacks', () => {
    expect(SOURCE_TAB_MONO_FAMILY).toBe('monospace');
    expect(SOURCE_TAB_MONO_STACK).toBe('monospace');
    expect(SOURCE_TAB_EDITOR_FONT.family).toBe('monospace');
  });
});
