import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HARMONYOS_CANVAS_LABEL_FONT,
  HARMONYOS_FONT_FAMILY,
  SYSTEM_CANVAS_LABEL_FONT,
  canvasLabelFont,
} from '../../src/ui/fontStack';

describe('HarmonyOS Sans SC 2025 embed', () => {
  it('declares @font-face rules for vendored woff2 files', () => {
    const css = readFileSync(resolve(__dirname, '../../src/ui/fonts.css'), 'utf8');
    expect(css).toContain("font-family: 'HarmonyOS Sans SC 2025'");
    expect(css).toContain('HarmonyOS Sans Fonts');
    expect(css).not.toContain('--pr-font-family');
    expect(css).toMatch(/local\('HarmonyOS Sans SC'\)/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Light\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Regular\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Semibold\.woff2\?no-inline/);
    expect(css).toMatch(/font-display:\s*swap/);
  });

  it('tokens.css imports faces and scopes the harmony token per instance', () => {
    const css = readFileSync(resolve(__dirname, '../../src/ui/tokens.css'), 'utf8');
    expect(css).toContain("@import './fonts.css'");
    expect(css).toContain('--pr-font-family: ui-sans-serif, system-ui, sans-serif');
    expect(css).toContain(".pr-root[data-font-family='harmony']");
  });

  it('picks canvas label fonts by ReportFontFamily mode', () => {
    expect(HARMONYOS_FONT_FAMILY).toContain('HarmonyOS Sans SC 2025');
    expect(canvasLabelFont('system')).toBe(SYSTEM_CANVAS_LABEL_FONT);
    expect(canvasLabelFont('harmony')).toBe(HARMONYOS_CANVAS_LABEL_FONT);
  });
});
