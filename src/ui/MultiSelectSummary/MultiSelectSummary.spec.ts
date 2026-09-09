import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MultiSelectSummary from './MultiSelectSummary.vue';
import type { MultiSelectSummaryItem } from '../../domain/types';

const rows: MultiSelectSummaryItem[] = [
  { name: 'Alpha', wallDuration: 3_000_000, selfTime: 3_000_000, avgWallDuration: 1_500_000 },
  { name: 'Beta',  wallDuration: 1_000_000, selfTime:   500_000, avgWallDuration: 1_000_000 },
  { name: 'Gamma', wallDuration: 2_000_000, selfTime: 2_000_000, avgWallDuration: 2_000_000 },
];

describe('MultiSelectSummary', () => {
  it('PR-MULTI-001: renders four column headers with SortIcon in each', () => {
    const w = mount(MultiSelectSummary, { props: { rows, count: 3 } });
    expect(w.find('[data-testid="col-name"]').exists()).toBe(true);
    expect(w.find('[data-testid="col-wallDuration"]').exists()).toBe(true);
    expect(w.find('[data-testid="col-selfTime"]').exists()).toBe(true);
    expect(w.find('[data-testid="col-avgWallDuration"]').exists()).toBe(true);
    // all headers start with neutral icon
    expect(w.findAll('[data-testid="sort-icon-none"]').length).toBe(4);
  });

  it('PR-MULTI-002: first click → asc; SortIcon shows up-arrow', async () => {
    const w = mount(MultiSelectSummary, { props: { rows, count: 3 } });
    await w.get('[data-testid="col-wallDuration"] button').trigger('click');
    expect(w.find('[data-testid="sort-icon-asc"]').exists()).toBe(true);
    expect(w.get('[data-testid="col-wallDuration"]').attributes('aria-sort')).toBe('ascending');
  });

  it('PR-MULTI-003: second click → desc; third → null (neutral icons)', async () => {
    const w = mount(MultiSelectSummary, { props: { rows, count: 3 } });
    const btn = w.get('[data-testid="col-wallDuration"] button');
    await btn.trigger('click');   // asc
    await btn.trigger('click');   // desc
    expect(w.find('[data-testid="sort-icon-desc"]').exists()).toBe(true);
    expect(w.get('[data-testid="col-wallDuration"]').attributes('aria-sort')).toBe('descending');
    await btn.trigger('click');   // reset
    expect(w.find('[data-testid="sort-icon-asc"]').exists()).toBe(false);
    expect(w.find('[data-testid="sort-icon-desc"]').exists()).toBe(false);
    expect(w.findAll('[data-testid="sort-icon-none"]').length).toBe(4);
    expect(w.get('[data-testid="col-wallDuration"]').attributes('aria-sort')).toBe('none');
  });

  it('PR-MULTI-004: active sort reorders rows; inactive columns show neutral icon; prop not mutated', async () => {
    const original = rows.map((r) => ({ ...r }));
    const w = mount(MultiSelectSummary, { props: { rows, count: 3 } });
    // asc wallDuration: Beta(1ms) < Gamma(2ms) < Alpha(3ms)
    await w.get('[data-testid="col-wallDuration"] button').trigger('click');
    const cells = w.findAll('[data-testid="row-name"]');
    expect(cells[0].text()).toBe('Beta');
    expect(cells[1].text()).toBe('Gamma');
    expect(cells[2].text()).toBe('Alpha');
    // inactive cols neutral
    expect(w.find('[data-testid="col-name"] [data-testid="sort-icon-none"]').exists()).toBe(true);
    // prop not mutated
    expect(rows).toEqual(original);
  });

  it('PR-MULTI-005: aria-sort on th matches sort state', async () => {
    const w = mount(MultiSelectSummary, { props: { rows, count: 3 } });
    // all none initially
    for (const key of ['name', 'wallDuration', 'selfTime', 'avgWallDuration']) {
      expect(w.get(`[data-testid="col-${key}"]`).attributes('aria-sort')).toBe('none');
    }
    await w.get('[data-testid="col-selfTime"] button').trigger('click');
    expect(w.get('[data-testid="col-selfTime"]').attributes('aria-sort')).toBe('ascending');
    expect(w.get('[data-testid="col-wallDuration"]').attributes('aria-sort')).toBe('none');
  });

  it('PR-MULTI-006: close emitted on × click; empty rows shows empty state; sort does not mutate prop', async () => {
    const w = mount(MultiSelectSummary, { props: { rows: [], count: 0 } });
    expect(w.find('[data-testid="multi-select-empty"]').exists()).toBe(true);
    expect(w.find('[data-testid="multi-select-table"]').exists()).toBe(false);
    await w.get('[data-testid="multi-select-close"]').trigger('click');
    expect(w.emitted('close')).toBeTruthy();
  });
});
