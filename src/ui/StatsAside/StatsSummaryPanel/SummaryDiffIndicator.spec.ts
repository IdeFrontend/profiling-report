import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SummaryDiffIndicator from './SummaryDiffIndicator.vue';

describe('SummaryDiffIndicator', () => {
  it('increase tone renders the up arrow, red badge class, and the text', () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: { tone: 'increase', text: '5%', directionLabel: 'increased' },
    });
    expect(wrapper.classes()).toContain('pr-diff--increase');
    expect(wrapper.find('.pr-icon').classes()).toContain('pr-icon--diff-up');
    expect(wrapper.find('.pr-diff__text').text()).toBe('5%');
    expect(wrapper.find('.pr-field-sr').text()).toBe('increased');
    wrapper.unmount();
  });

  it('decrease tone renders the down arrow and green badge class', () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: { tone: 'decrease', text: '3%', directionLabel: 'decreased' },
    });
    expect(wrapper.classes()).toContain('pr-diff--decrease');
    expect(wrapper.find('.pr-icon').classes()).toContain('pr-icon--diff-down');
    expect(wrapper.find('.pr-diff__text').text()).toBe('3%');
    wrapper.unmount();
  });

  it('renders a single root span so fallthrough attrs bind to it', () => {
    const wrapper = mount(SummaryDiffIndicator, {
      props: { tone: 'increase', text: '2.4', directionLabel: 'increased' },
      attrs: { 'data-testid': 'stats-diff' },
    });
    expect(wrapper.attributes('data-testid')).toBe('stats-diff');
    wrapper.unmount();
  });
});
