import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
// SortIcon does not exist yet — this import will fail on first run.
import SortIcon from './SortIcon.vue';

describe('SortIcon', () => {
  it('PR-SORT-001: null renders unsorted double-arrow', () => {
    const w = mount(SortIcon, { props: { direction: null } });
    expect(w.find('[data-testid="sort-icon-none"]').exists()).toBe(true);
    expect(w.find('[data-testid="sort-icon-asc"]').exists()).toBe(false);
    expect(w.find('[data-testid="sort-icon-desc"]').exists()).toBe(false);
  });

  it('PR-SORT-002: asc renders up-arrow only', () => {
    const w = mount(SortIcon, { props: { direction: 'asc' } });
    expect(w.find('[data-testid="sort-icon-asc"]').exists()).toBe(true);
    expect(w.find('[data-testid="sort-icon-none"]').exists()).toBe(false);
  });

  it('PR-SORT-003: desc renders down-arrow only', () => {
    const w = mount(SortIcon, { props: { direction: 'desc' } });
    expect(w.find('[data-testid="sort-icon-desc"]').exists()).toBe(true);
    expect(w.find('[data-testid="sort-icon-none"]').exists()).toBe(false);
  });
});
