import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SortArrows from './SortArrows.vue';

describe('SortArrows', () => {
  it('PR-SORTICON-001: draws two opposed hollow triangles, not a text glyph', async () => {
    const wrapper = mount(SortArrows);
    const svg = wrapper.get('svg');

    // A ◇ (or ▲▼) as text renders at the font's mercy — size, weight and
    // baseline all drift per platform. The sketch's mark is a drawn pair.
    expect(svg.text()).toBe('');
    expect(svg.attributes('aria-hidden')).toBe('true');
    // Sketch: 33x48 device px at 4x → 8x12 CSS px.
    expect(svg.attributes('viewBox')).toBe('0 0 8 12');
    expect([svg.attributes('width'), svg.attributes('height')]).toEqual(['8', '12']);

    const paths = wrapper.findAll('path');
    expect(paths).toHaveLength(2);

    // The two triangles mirror across the box's horizontal midline (y=6): each
    // apex sits at one end, each base faces the other. That mirroring is what
    // reads as "this column sorts" — a single arrow would read as a direction.
    const apexY = (d: string) => Number(d.match(/^M[\d.]+ ([\d.]+)/)![1]);
    const [up, down] = paths.map((p) => apexY(p.attributes('d') ?? ''));
    expect(up).toBeLessThan(6);
    expect(down).toBeGreaterThan(6);
    expect(up + down).toBe(12);

    // Bases meet at the midline as two adjacent rows, mirroring the sketch —
    // one stroke width apart, so the pair reads as a single control.
    const baseY = (d: string) => Number(d.match(/L[\d.]+ ([\d.]+)/)![1]);
    const [upBase, downBase] = paths.map((p) => baseY(p.attributes('d') ?? ''));
    expect(upBase + downBase).toBe(12);
    expect(downBase - upBase).toBe(1);

    const css = (await import('./SortArrows.vue?raw')).default as string;
    expect(css).toMatch(/fill:\s*none/);
    expect(css).toMatch(/stroke:\s*currentColor/);
  });
});
