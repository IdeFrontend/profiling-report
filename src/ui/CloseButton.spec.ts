import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CloseButton from './CloseButton.vue';

describe('CloseButton', () => {
  it('PR-CLOSE-001: renders a stroked ✕ centered in a square button, not a text glyph', async () => {
    const wrapper = mount(CloseButton, { props: { label: 'Close' } });
    const btn = wrapper.get('button');

    // A typographic × sits on the font's math axis, so it never optically centers.
    // The icon must be a stroked path with no text content to shift.
    expect(btn.text()).toBe('');
    const svg = wrapper.get('svg');
    expect(svg.attributes('aria-hidden')).toBe('true');
    const [x1, y1, w, h] = (svg.attributes('viewBox') ?? '').split(' ').map(Number);
    expect([x1, y1]).toEqual([0, 0]);
    expect(w).toBe(h); // square box → the cross is symmetric about both axes

    // The two strokes are the box diagonals with equal inset on every side.
    const d = wrapper.get('path').attributes('d') ?? '';
    const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    expect(nums).toHaveLength(8);
    const inset = nums[0];
    for (const n of nums) expect(Math.min(n, w - n)).toBe(inset);

    const css = (await import('./CloseButton.vue?raw')).default as string;
    expect(css).toMatch(/\.pr-close\s*\{[\s\S]*?align-items:\s*center/);
    expect(css).toMatch(/\.pr-close\s*\{[\s\S]*?justify-content:\s*center/);
  });

  it('PR-CLOSE-002: label drives both aria-label and title; click emits through', async () => {
    const wrapper = mount(CloseButton, { props: { label: '关闭' } });
    const btn = wrapper.get('button');
    expect(btn.attributes('aria-label')).toBe('关闭');
    expect(btn.attributes('title')).toBe('关闭');
    expect(btn.attributes('type')).toBe('button');

    await btn.trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });
});
