import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Occupancy hatch is a CSS contract, so assert the declared rule bodies in the SFC.
const src = readFileSync(resolve(__dirname, 'SourceMetricsTable.vue'), 'utf8');

function ruleBody(selector: string): string {
  const head = `\n${selector} {`;
  const start = src.indexOf(head);
  expect(src.indexOf(head, start + 1), `${selector} must have one rule`).toBe(-1);
  const open = start + head.length;
  return src.slice(open, src.indexOf('}', open));
}

describe('SourceMetricsTable occupancy hatch', () => {
  it('draws the 135deg hatch on the unfilled track, never on the fill', () => {
    const track = ruleBody('.pr-src-metrics__bar-track');
    // Axis stops at 135deg; horizontal period 4px is a whole number of device pixels at every DPR.
    expect(track).toContain(
      'repeating-linear-gradient(135deg, rgb(52 52 52) 0 1.0606601717798212px, transparent 1.0606601717798212px 2.8284271247461903px)',
    );
    expect(track).toContain('var(--table-bg)');

    const fill = ruleBody('.pr-src-metrics__bar-fill');
    expect(fill).not.toContain('gradient');

    const tip = ruleBody('.pr-src-metrics__tip');
    expect(tip).toContain('--table-bg: #1e1e1e');
  });
});
