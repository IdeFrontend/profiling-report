import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatsAside from './StatsAside.vue';
import { emptyReportViewModel } from '../../adapters/adaptRep';
import type { ReportViewModel } from '../../domain/types';

function report(partial: Partial<ReportViewModel>): ReportViewModel {
  return { ...emptyReportViewModel(), ...partial };
}

describe('StatsAside', () => {
  it('PR-STATS-001: renders summary stats when a valid ReportViewModel is provided', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 1234 },
        }),
      },
    });

    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('relu');
  });

  it('PR-STATS-002: renders PIPE occupancy bars', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.75, colorKey: 'vector', side: 'vector' },
          ],
        }),
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
        report: report({
          summary: { opType: 'MIX' },
          pipeOccupancy: pipes,
        }),
      },
    });

    await mix.get('[data-testid="aside-mode-pipe"]').trigger('click');
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
        report: report({
          summary: { opType: 'vector' },
          pipeOccupancy: pipes,
        }),
      },
    });
    await vectorOnly.get('[data-testid="aside-mode-pipe"]').trigger('click');
    expect(vectorOnly.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
    const vectorRows = vectorOnly.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(vectorRows).toContain('Vector');
    expect(vectorRows).toContain('MTE2');
    expect(vectorRows).not.toContain('Cube');
  });

  it('PR-STATS-004: blank or unrecognized opType shows all PIPE sides', async () => {
    const pipes = [
      { id: 'cube', label: 'Cube', ratio: 0.8, colorKey: 'cube', side: 'cube' as const },
      { id: 'vector', label: 'Vector', ratio: 0.3, colorKey: 'vector', side: 'vector' as const },
    ];

    for (const opType of ['', 'unknown', 'custom-op']) {
      const wrapper = mount(StatsAside, {
        props: {
          report: report({
            summary: opType ? { opType } : {},
            pipeOccupancy: pipes,
          }),
        },
      });

      if (wrapper.find('[data-testid="aside-mode-pipe"]').exists()) {
        await wrapper.get('[data-testid="aside-mode-pipe"]').trigger('click');
      }
      expect(wrapper.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
      const rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
      expect(rows, `opType=${opType || '(blank)'}`).toContain('Cube');
      expect(rows, `opType=${opType || '(blank)'}`).toContain('Vector');
    }
  });

  it('PR-STATS-005: compute/memory modes show CSV tabs and emit view-full-csv', async () => {
    const computeTables = [
      {
        fileName: 'PipeUtilization.csv',
        headers: ['block_id', 'aiv_vec_ratio'],
        rows: [{ block_id: '0', aiv_vec_ratio: '0.1' }],
        blockIds: ['0'],
      },
    ];
    const memoryTables = [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aic_l1_read_bw(GB/s)'],
        rows: [{ block_id: '0', 'aic_l1_read_bw(GB/s)': '1.2' }],
        blockIds: ['0'],
      },
    ];
    const csvTexts = {
      'PipeUtilization.csv': 'block_id,aiv_vec_ratio\n0,0.1\n',
      'Memory.csv': 'block_id,aic_l1_read_bw(GB/s)\n0,1.2\n',
    };

    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { opName: 'x', opType: 'vector', taskDurationUs: 1 },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.1, colorKey: 'vector', side: 'vector' },
          ],
          computeTables,
          memoryTables,
          csvTexts,
        }),
      },
    });

    expect(wrapper.find('[data-testid="aside-modes"]').exists()).toBe(true);
    await wrapper.get('[data-testid="aside-mode-compute"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('aiv_vec_ratio');

    await wrapper.get('[data-testid="csv-view-all"]').trigger('click');
    expect(wrapper.emitted('view-full-csv')?.[0]?.[0]).toEqual({
      fileName: 'PipeUtilization.csv',
      text: csvTexts['PipeUtilization.csv'],
    });

    await wrapper.get('[data-testid="aside-mode-memory"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('MemoryL1');
  });

  it('PR-STATS-006: header title and close emit', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({}),
      },
    });
    expect(wrapper.text()).toMatch(/报告统计|Report statistics/);
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
    await wrapper.get('[data-testid="stats-aside-close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('PR-STATS-007: meta segments only when fields present', () => {
    const empty = mount(StatsAside, {
      props: {
        report: report({ summary: { opName: 'x' } }),
      },
    });
    expect(empty.find('[data-testid="stats-aside-meta"]').exists()).toBe(false);
    expect(empty.find('[data-testid="stats-aside-more"]').exists()).toBe(false);

    const withFreq = mount(StatsAside, {
      props: {
        report: report({ summary: { currentFreq: 1280 } }),
      },
    });
    const meta = withFreq.get('[data-testid="stats-aside-meta"]');
    expect(meta.text()).toMatch(/1280/);
    expect(meta.text()).not.toMatch(/核数|cores/i);
    expect(meta.text()).not.toMatch(/NPU ARCH/i);
    expect(withFreq.find('[data-testid="stats-aside-more"]').exists()).toBe(true);

    const full = mount(StatsAside, {
      props: {
        report: report({
          summary: {
            coreCount: 8,
            currentFreq: 1280,
            npuArchLabel: '212 teraOPs',
          },
        }),
      },
    });
    const fullMeta = full.get('[data-testid="stats-aside-meta"]').text();
    expect(fullMeta).toMatch(/8/);
    expect(fullMeta).toMatch(/1280/);
    expect(fullMeta).toMatch(/212 teraOPs/);
  });

  it('PR-STATS-008: 更多 visible with capability or meta; emits open-hardware-details', async () => {
    const viaCap = mount(StatsAside, {
      props: {
        report: report({}),
        capabilities: ['hardwareDetails'],
      },
    });
    expect(viaCap.find('[data-testid="stats-aside-more"]').exists()).toBe(true);
    await viaCap.get('[data-testid="stats-aside-more"]').trigger('click');
    expect(viaCap.emitted('open-hardware-details')).toBeTruthy();

    const viaMeta = mount(StatsAside, {
      props: {
        report: report({ summary: { currentFreq: 100 } }),
      },
    });
    await viaMeta.get('[data-testid="stats-aside-more"]').trigger('click');
    expect(viaMeta.emitted('open-hardware-details')).toBeTruthy();
  });

  it('PR-STATS-009: duration card has sketch chrome', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: { taskDurationUs: 4600 },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    const card = wrapper.get('[data-testid="stats-duration-card"]');
    expect(card.text()).toMatch(/整体耗时|Total time/);
    expect(card.text()).toMatch(/4\.60 ms/);
    expect(card.find('[data-testid="stats-duration-bar"]').exists()).toBe(true);
  });

  it('PR-STATS-010: no type card; secondary from blockDim or opName', () => {
    const withType = mount(StatsAside, {
      props: {
        report: {
          summary: { opType: 'vector', taskDurationUs: 1000, opName: 'relu' },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    expect(withType.find('[data-testid="stats-type-card"]').exists()).toBe(false);
    expect(withType.get('[data-testid="stats-duration-card"]').text()).toContain('relu');
    expect(withType.text()).not.toMatch(/类型|Type/);

    const withDim = mount(StatsAside, {
      props: {
        report: {
          summary: { taskDurationUs: 1000, blockDim: 8, opName: 'relu' },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    const secondary = withDim.get('[data-testid="stats-duration-secondary"]').text();
    expect(secondary).toMatch(/8/);
    expect(secondary).toMatch(/次迭代|iterations/);
    expect(secondary).not.toContain('relu');

    const bare = mount(StatsAside, {
      props: {
        report: {
          summary: { taskDurationUs: 1000 },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    expect(bare.find('[data-testid="stats-duration-secondary"]').exists()).toBe(false);
  });

  it('PR-STATS-011: compute/BW/util cards absent under I-Q6a', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: {
            taskDurationUs: 1000,
            computeTflops: 172,
            ioBandwidth: 0.08,
            avgCoreUtil: 0.69,
          },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    expect(wrapper.find('[data-testid="stats-compute-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-core-util-card"]').exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/算力情况|Computing power|输入带宽|Input bandwidth|平均核利用率|Average core/);
  });

  it('PR-STATS-012: PIPE scale and hatched bars', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          overviewSeries: [],
        },
      },
    });
    const scale = wrapper.get('[data-testid="pipe-scale"]').text();
    expect(scale).toContain('0%');
    expect(scale).toContain('100%');
    expect(wrapper.find('.pr-pipe-row__hatch').exists()).toBe(true);
    expect(wrapper.find('.pr-pipe-row__bar').exists()).toBe(true);
  });

  it('PR-STATS-013: absolute time in bar when present', () => {
    const withAbs = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            {
              id: 'vector',
              label: 'Vector',
              ratio: 0.5,
              colorKey: 'vector',
              side: 'vector',
              absoluteValue: 0.065455,
            },
          ],
          overviewSeries: [],
        },
      },
    });
    expect(withAbs.get('[data-testid="pipe-absolute"]').text()).toMatch(/0\.065/);

    const without = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          overviewSeries: [],
        },
      },
    });
    expect(without.find('[data-testid="pipe-absolute"]').exists()).toBe(false);
  });

  it('PR-STATS-014: Details emit open-pipe-details', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          overviewSeries: [],
        },
      },
    });
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.emitted('open-pipe-details')).toBeTruthy();
  });

  it('PR-STATS-015: Roofline section when points present; hidden when absent', () => {
    const withRoof = mount(StatsAside, {
      props: {
        report: {
          ...base(),
          roofline: {
            points: [
              {
                id: 'gm',
                label: 'GM Read + Write',
                intensity: 0.09,
                performance: 0.002,
                style: 'solid',
              },
            ],
            mixLabels: [],
            peakComputeTops: 1,
            peakBandwidthGBs: 16,
          },
        },
      },
    });
    expect(withRoof.find('[data-testid="stats-roofline"]').exists()).toBe(true);
    expect(withRoof.find('[data-testid="roofline-panel"]').exists()).toBe(true);

    const without = mount(StatsAside, {
      props: {
        report: base({ summary: { taskDurationUs: 1 } }),
      },
    });
    expect(without.find('[data-testid="stats-roofline"]').exists()).toBe(false);
  });
});
