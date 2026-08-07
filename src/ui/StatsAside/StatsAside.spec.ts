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
      { id: 'mte2', label: 'MTE2', ratio: 0.5, colorKey: 'mte2', side: 'cube' as const },
      { id: 'vector', label: 'Vector', ratio: 0.3, colorKey: 'vector', side: 'vector' as const },
      { id: 'mte2', label: 'MTE2', ratio: 0.16, colorKey: 'mte2', side: 'vector' as const },
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
    let rows = mix.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('Cube');
    expect(rows).toContain('MTE2');
    expect(rows).toContain('50');
    expect(rows).not.toContain('Vector');

    await mix.get('[data-testid="pipe-side-vector"]').trigger('click');
    rows = mix.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('Vector');
    expect(rows).toContain('MTE2');
    expect(rows).toContain('16');
    expect(rows).not.toContain('Cube');

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

  it('PR-STATS-004: empty opType shows all PIPE sides', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            { id: 'cube', label: 'Cube', ratio: 0.8, colorKey: 'cube', side: 'cube' },
            { id: 'vector', label: 'Vector', ratio: 0.3, colorKey: 'vector', side: 'vector' },
          ],
          overviewSeries: [],
        },
      },
    });

    expect(wrapper.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
    const rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('Cube');
    expect(rows).toContain('Vector');
  });
});
