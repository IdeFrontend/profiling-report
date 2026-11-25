import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SummaryDiffIndicator from './SummaryDiffIndicator.vue';

describe('SummaryDiffIndicator', () => {
  it('PR-SDI-001: increase tone renders the up arrow, red badge class, and the text', () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: { tone: 'increase', text: '5%', directionLabel: 'increased' },
    });
    expect(wrapper.classes()).toContain('pr-diff--increase');
    expect(wrapper.find('.pr-icon').classes()).toContain('pr-icon--diff-up');
    expect(wrapper.find('.pr-diff__text').text()).toBe('5%');
    expect(wrapper.find('.pr-field-sr').text()).toBe('increased');
    wrapper.unmount();
  });

  it('PR-SDI-002: decrease tone renders the down arrow and green badge class', () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: { tone: 'decrease', text: '3%', directionLabel: 'decreased' },
    });
    expect(wrapper.classes()).toContain('pr-diff--decrease');
    expect(wrapper.find('.pr-icon').classes()).toContain('pr-icon--diff-down');
    expect(wrapper.find('.pr-diff__text').text()).toBe('3%');
    wrapper.unmount();
  });

  it('PR-SDI-003: renders a single root span so fallthrough attrs bind to it', () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: { tone: 'increase', text: '2.4', directionLabel: 'increased' },
      attrs: { 'data-testid': 'stats-diff' },
    });
    expect(wrapper.attributes('data-testid')).toBe('stats-diff');
    wrapper.unmount();
  });

  it('PR-SDI-004: the tip prop opens the multi-baseline popup on hover', async () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: {
        tone: 'increase',
        text: '1.00',
        directionLabel: 'Increased',
        tip: [
          { label: 'Current', value: '2.00' },
          { label: '基线 1', value: '3.00', tone: 'decrease', delta: '1.00' },
        ],
      },
    });
    expect(wrapper.attributes('tabindex')).toBe('0');
    await wrapper.trigger('pointerenter');
    const tip = document.querySelector('[data-testid="baseline-compare-tip"]');
    expect(tip).not.toBeNull();
    const rows = [...tip!.querySelectorAll('[data-testid^="baseline-compare-tip-row-"]')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Current');
    expect(rows[1].textContent).toContain('基线 1');
    // The popup prints the BARE magnitude: the tinted badge carries the
    // direction, so a decrease never carries a minus (product review).
    expect(rows[1].querySelector('.pr-diff__text')?.textContent).toBe('1.00');
    // ONE shared grid keeps every row aligned (values right, deltas left), and
    // the current value can reach the box's top-right inset.
    const src = (await import('./SummaryDiffIndicator.vue?raw')).default as string;
    expect(src).toMatch(/grid-template-columns:\s*max-content 76px max-content/);
    expect(src).toMatch(/\.pr-diff-tip__row\s*\{[^}]*display:\s*contents/s);
    await wrapper.trigger('pointerleave');
    expect(document.querySelector('[data-testid="baseline-compare-tip"]')).toBeNull();

    const plain = mount(SummaryDiffIndicator, {
      props: { tone: 'decrease', text: '0.10', directionLabel: 'Decreased' },
    });
    expect(plain.attributes('tabindex')).toBeUndefined();
    await plain.trigger('pointerenter');
    expect(document.querySelector('[data-testid="baseline-compare-tip"]')).toBeNull();
  });

  it('PR-SDI-005: a dense-list badge is described, not a tab stop', () => {
    const tip = [
      { label: 'Current', value: '2.00' },
      { label: 'Baseline 1', value: '3.00', tone: 'decrease' as const, delta: '1.00' },
    ];
    const wrapper = mount(SummaryDiffIndicator, {
      props: {
        tone: 'increase',
        text: '1.00',
        directionLabel: 'Increased',
        tip,
        focusable: false,
      },
    });
    // No per-row tab stop in a details list...
    expect(wrapper.attributes('tabindex')).toBeUndefined();
    // ...but the comparison text still reaches assistive tech.
    const describedBy = wrapper.attributes('aria-describedby');
    expect(describedBy).toBeTruthy();
    // VTU mounts detached from the document, so read the described node from
    // the wrapper itself (the popup tests query `document` only for teleports).
    const described = wrapper.find(`#${describedBy}`);
    expect(described.exists()).toBe(true);
    expect(described.text()).toBe('Current 2.00; Baseline 1 3.00 1.00');
    wrapper.unmount();
  });
});
