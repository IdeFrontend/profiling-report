import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('HarmonyOS Sans SC 2025 embed', () => {
  it('declares faces and points at vendored woff2 files', () => {
    const css = readFileSync(resolve(__dirname, '../../src/ui/fonts.css'), 'utf8');
    expect(css).toContain("font-family: 'HarmonyOS Sans SC 2025'");
    expect(css).toContain('HarmonyOS Sans Fonts');
    expect(css).toMatch(/HarmonyOS_Sans_SC_Light\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Regular\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Semibold\.woff2\?no-inline/);
    expect(css).toMatch(/font-display:\s*swap/);
  });
});
