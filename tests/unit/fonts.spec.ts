import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HARMONYOS_CANVAS_LABEL_FONT,
  HARMONYOS_FONT_FAMILY,
  SYSTEM_CANVAS_LABEL_FONT,
  canvasLabelFont,
} from '../../src/ui/fontStack';

const UI_ROOT = resolve(__dirname, '../../src/ui');
const SHIPPED_WEIGHTS = new Set([400, 600]);

function walkUiFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkUiFiles(path, acc);
      continue;
    }
    if (/\.(vue|css)$/.test(name)) acc.push(path);
  }
  return acc;
}

function collectNumericFontWeights(filePath: string): number[] {
  const content = readFileSync(filePath, 'utf8');
  return [...content.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1]));
}

describe('HarmonyOS Sans SC 2025 embed', () => {
  it('declares Regular + Semibold @font-face rules only', () => {
    const css = readFileSync(resolve(UI_ROOT, 'fonts.css'), 'utf8');
    expect(css).toContain("font-family: 'HarmonyOS Sans SC 2025'");
    expect(css).toContain('HarmonyOS Sans Fonts');
    expect(css).not.toContain('--pr-font-family');
    expect(css).not.toMatch(/local\s*\(/);
    expect(css).not.toMatch(/HarmonyOS_Sans_SC_Light/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Regular\.woff2\?no-inline/);
    expect(css).toMatch(/HarmonyOS_Sans_SC_Semibold\.woff2\?no-inline/);
    expect(css).toMatch(/font-display:\s*swap/);
    const weights = [...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(weights.sort()).toEqual([400, 600]);
  });

  it('tokens.css scopes harmony token without importing fonts.css', () => {
    const css = readFileSync(resolve(UI_ROOT, 'tokens.css'), 'utf8');
    expect(css).not.toContain("@import './fonts.css'");
    expect(css).not.toContain('@font-face');
    expect(css).toContain('--pr-font-family: ui-sans-serif, system-ui, sans-serif');
    expect(css).toContain(".pr-root[data-font-family='harmony']");
  });

  it('UI font-weight values map to shipped HarmonyOS faces', () => {
    const bad: string[] = [];
    for (const file of walkUiFiles(UI_ROOT)) {
      if (file.endsWith('/fonts.css')) continue;
      for (const weight of collectNumericFontWeights(file)) {
        if (!SHIPPED_WEIGHTS.has(weight)) {
          bad.push(`${file}: font-weight ${weight}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('picks canvas label fonts by ReportFontFamily mode', () => {
    expect(HARMONYOS_FONT_FAMILY).toContain('HarmonyOS Sans SC 2025');
    expect(canvasLabelFont('system')).toBe(SYSTEM_CANVAS_LABEL_FONT);
    expect(canvasLabelFont('harmony')).toBe(HARMONYOS_CANVAS_LABEL_FONT);
  });
});
