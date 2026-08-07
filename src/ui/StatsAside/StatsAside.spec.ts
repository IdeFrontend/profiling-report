import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatsAside from './StatsAside.vue';

describe('StatsAside', () => {
  it('PR-STATS-001: renders summary stats when a valid ReportViewModel is provided', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 1234 },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });

    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('relu');
  });

  it('PR-STATS-002: renders PIPE occupancy bars', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.75, colorKey: 'vector', side: 'vector' },
          ],
          overviewSeries: [],
        },
      },
    });

    expect(wrapper.text()).toContain('Vector');
    expect(wrapper.text()).toContain('75');
  });

  it('PR-STATS-003: Cube|Vector toggle only for MIX and filters by side', async () => {
    const pipes = [
      { id: 'cube', label: 'Cube', ratio: 0.8, colorKey: 'cube', side: 'cube' as const },
      { id: 'vector', label: 'Vector', ratio: 0.3, colorKey: 'vector', side: 'vector' as const },
      { id: 'mte2', label: 'MTE2', ratio: 0.16, colorKey: 'mte2', side: 'both' as const },
    ];

    const mix = mount(StatsAside, {
      props: {
        report: {
          summary: { opType: 'MIX' },
          pipeOccupancy: pipes,
          overviewSeries: [],
        },
      },
    });

    expect(mix.find('[data-testid="pipe-side-toggle"]').exists()).toBe(true);
    expect(mix.text()).toContain('Cube');
    expect(mix.text()).toContain('MTE2');
    expect(mix.text()).not.toMatch(/\bVector\b.*30%|30%.*\bVector\b/);
    // Vector bar hidden on default cube side; label may appear on toggle button
    expect(mix.findAll('.pr-pipe-row').map((r) => r.text()).join('|')).not.toContain('Vector');

    await mix.get('[data-testid="pipe-side-vector"]').trigger('click');
    const rowsAfter = mix.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rowsAfter).toContain('Vector');
    expect(rowsAfter).toContain('MTE2');
    expect(rowsAfter).not.toContain('Cube');

    const vectorOnly = mount(StatsAside, {
      props: {
        report: {
          summary: { opType: 'vector' },
          pipeOccupancy: pipes,
          overviewSeries: [],
        },
      },
    });
    expect(vectorOnly.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
    const vectorRows = vectorOnly.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(vectorRows).toContain('Vector');
    expect(vectorRows).toContain('MTE2');
    expect(vectorRows).not.toContain('Cube');
  });
});
