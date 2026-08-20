import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CursorTimestamp from './CursorTimestamp.vue';

describe('CursorTimestamp', () => {
  it('PR-CURSOR-001: renders stem at xRatio position and label bubble with text', () => {
    const wrapper = mount(CursorTimestamp, {
      props: { xRatio: 0.45, label: '00:04.456' },
    });
    const line = wrapper.find('[data-testid="cursor-line"]');
    expect(line.exists()).toBe(true);
    expect(line.attributes('style')).toContain('left: 45%');
    const label = wrapper.find('[data-testid="cursor-label"]');
    expect(label.exists()).toBe(true);
  });

  it('PR-CURSOR-002: label text matches prop', () => {
    const wrapper = mount(CursorTimestamp, {
      props: { xRatio: 0.1, label: '00:12.345' },
    });
    expect(wrapper.get('[data-testid="cursor-label"]').text()).toBe('00:12.345');
  });

  it('PR-CURSOR-003: renders with correct component class', () => {
    const wrapper = mount(CursorTimestamp, {
      props: { xRatio: 0.5, label: '00:00.000' },
    });
    const line = wrapper.get('[data-testid="cursor-line"]');
    expect(line.classes()).toContain('pr-cursor');
    const label = wrapper.get('[data-testid="cursor-label"]');
    expect(label.classes()).toContain('pr-cursor__label');
  });

  it('PR-CURSOR-004: labelAbove parks pill above axis with animated transform', async () => {
    const wrapper = mount(CursorTimestamp, {
      props: { xRatio: 0.5, label: '00:01.787', labelAbove: true },
    });
    const label = wrapper.get('[data-testid="cursor-label"]');
    expect(label.classes()).toContain('pr-cursor__label--above');

    const src = (await import('./CursorTimestamp.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-cursor__label--above\s*\{[^}]*transform:\s*translate\(-50%,\s*calc\(-100%\s*-\s*6px\)\)/,
    );
    expect(src).toMatch(/\.pr-cursor__label\s*\{[^}]*transition:\s*transform\s+180ms\s+ease/);
    expect(src).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*transition:\s*none/,
    );
  });
});
