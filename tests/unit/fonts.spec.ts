import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANVAS_LABEL_FONT, HARMONYOS_FONT_FAMILY } from '../../src/ui/fontStack';

describe('HarmonyOS Sans SC 2025 embed', () => {
  it('declares faces and points at vendored woff2 files', () => {
    const css = readFileSync(resolve(__dirname, '../../src/ui/fonts.css'), 'utf8');
    expect(css).toContain("font-family: 'HarmonyOS Sans SC 2025'");
    expect(css).toContain('HarmonyOS Sans Fonts');
    expect(css).toContain('--pr-font-family');
    expect(css).toMatch(/local\('HarmonyOS Sans SC'\)/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Light\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Regular\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Semibold\.woff2\?no-inline/);
    expect(css).toMatch(/font-display:\s*swap/);
  });

  it('tokens.css provides system font fallback without importing fonts.css', () => {
    const css = readFileSync(resolve(__dirname, '../../src/ui/tokens.css'), 'utf8');
    expect(css).toContain('--pr-font-family: ui-sans-serif, system-ui, sans-serif');
    expect(css).not.toContain("@import './fonts.css'");
    expect(css).not.toContain('@font-face');
  });

  it('exports a canvas label font stack matching the Harmony family name', () => {
    expect(HARMONYOS_FONT_FAMILY).toContain('HarmonyOS Sans SC 2025');
    expect(CANVAS_LABEL_FONT).toBe(`10px ${HARMONYOS_FONT_FAMILY}`);
  });
});
