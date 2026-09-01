import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatsAside from './StatsAside.vue';
import { adaptRep, emptyReportViewModel } from '../../adapters/adaptRep';
import { parseRep } from '../../adapters/parseRep';
import type { ReportViewModel } from '../../domain/types';
import { loadOutRepBytes } from '../../../tests/helpers/fixtures';

function report(partial: Partial<ReportViewModel> = {}): ReportViewModel {
  return { ...emptyReportViewModel(), ...partial };
}

function cannbotEntryReport(): ReportViewModel {
  return report({
    summary: { pid: '3073000', opType: 'mix', blockDim: 8, taskDurationUs: 1 },
    pipeOccupancy: [
      { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
    ],
    computeTables: [
      { fileName: 'PipeUtilization.csv', headers: ['item'], rows: [{ item: 'Vector' }], blockIds: ['0'] },
    ],
    memoryTables: [
      { fileName: 'Memory.csv', headers: ['block_id'], rows: [{ block_id: '0' }], blockIds: ['0'] },
    ],
  });
}

function csvOnlyEntryReport(): ReportViewModel {
  return report({
    computeTables: [
      { fileName: 'PipeUtilization.csv', headers: ['item'], rows: [{ item: 'Vector' }], blockIds: ['0'] },
    ],
    memoryTables: [
      { fileName: 'Memory.csv', headers: ['block_id'], rows: [{ block_id: '0' }], blockIds: ['0'] },
    ],
  });
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
          summary: { opType: 'MIX', taskDurationUs: 1 },
          pipeOccupancy: pipes,
        }),
      },
    });

    await mix.get('[data-testid="pipe-occupancy"]');
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
          summary: { opType: 'vector', taskDurationUs: 1 },
          pipeOccupancy: pipes,
        }),
      },
    });
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

      expect(wrapper.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
      const rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
      expect(rows, `opType=${opType || '(blank)'}`).toContain('Cube');
      expect(rows, `opType=${opType || '(blank)'}`).toContain('Vector');
    }
  });

  it('PR-STATS-005: compute overlay is search-only; memory keeps 查看全部', async () => {
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

    expect(wrapper.find('[data-testid="aside-modes"]').exists()).toBe(false);
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('aiv_vec_ratio');
    expect(wrapper.find('[data-testid="csv-search"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="csv-block"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="csv-view-all"]').exists()).toBe(false);

    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('MemoryL1');
    await wrapper.get('[data-testid="csv-view-all"]').trigger('click');
    expect(wrapper.emitted('view-full-csv')?.[0]?.[0]).toEqual({
      fileName: 'Memory.csv',
      text: csvTexts['Memory.csv'],
    });
  });

  it('PR-STATS-006: header title and close emit', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({}),
      },
    });
    expect(wrapper.text()).toMatch(/报告统计|Report statistics/);
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
    const icon = wrapper.get('[data-testid="stats-aside-icon"]');
    expect(icon.find('path').exists()).toBe(true);
    expect(icon.find('polyline').exists()).toBe(true);
    await wrapper.get('[data-testid="stats-aside-close"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('PR-STATS-007: meta segments only when fields present; 更多 always on report shell', () => {
    const empty = mount(StatsAside, {
      props: {
        report: report({ summary: { opName: 'x', currentFreq: 1280 } }),
      },
    });
    expect(empty.find('[data-testid="stats-aside-meta"]').exists()).toBe(false);
    expect(empty.find('[data-testid="stats-aside-more"]').exists()).toBe(true);
    expect(empty.find('.pr-aside__meta').exists()).toBe(true);

    const withPid = mount(StatsAside, {
      props: {
        report: report({ summary: { pid: '1234' } }),
      },
    });
    const meta = withPid.get('[data-testid="stats-aside-meta"]');
    expect(meta.text()).toMatch(/进程|Process/);
    expect(meta.text()).toContain('1234');
    expect(meta.text()).not.toMatch(/核数|NPU ARCH|aic频率/i);
    expect(withPid.find('[data-testid="stats-aside-more"]').exists()).toBe(true);

    const full = mount(StatsAside, {
      props: {
        report: report({
          summary: {
            pid: '1234',
            opType: 'mix',
            blockDim: 10,
          },
        }),
      },
    });
    const fullMeta = full.get('[data-testid="stats-aside-meta"]').text();
    expect(fullMeta).toMatch(/进程|Process/);
    expect(fullMeta).toContain('1234');
    expect(fullMeta).toMatch(/算子类型|Op type/);
    expect(fullMeta).toMatch(/mix/i);
    expect(fullMeta).toMatch(/Blocks/);
    expect(fullMeta).toContain('10');
  });

  it('PR-STATS-008: 更多 always visible on report shell; emits open-hardware-details', async () => {
    const bare = mount(StatsAside, {
      props: { report: report({}) },
    });
    expect(bare.find('[data-testid="stats-aside-more"]').exists()).toBe(true);
    await bare.get('[data-testid="stats-aside-more"]').trigger('click');
    expect(bare.emitted('open-hardware-details')).toBeTruthy();
    expect(bare.find('[data-testid="hardware-info-missing"]').exists()).toBe(true);
    expect(bare.text()).toMatch(/缺少 hardware info|Missing hardware info/);

    const viaMeta = mount(StatsAside, {
      props: {
        report: report({ summary: { pid: '100' } }),
      },
    });
    await viaMeta.get('[data-testid="stats-aside-more"]').trigger('click');
    expect(viaMeta.emitted('open-hardware-details')).toBeTruthy();
  });

  it('PR-STATS-009: duration card has sketch chrome', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 4600 } }),
      },
    });
    const card = wrapper.get('[data-testid="stats-duration-card"]');
    expect(card.classes()).toContain('pr-card--top');
    expect(card.text()).toMatch(/整体耗时|Total time/);
    expect(card.get('.pr-card__num').text()).toBe('4.60');
    expect(card.get('.pr-card__unit').text()).toBe('ms');
    expect(card.get('[data-testid="stats-duration-value"]').attributes('title')).toBe('4.6 ms');
    expect(card.find('[data-testid="stats-duration-bar"]').exists()).toBe(true);
  });

  it('PR-STATS-009c: duration rounds to 2 dp; tooltip keeps full value', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 1.800123 } }),
      },
    });
    const value = wrapper.get('[data-testid="stats-duration-value"]');
    expect(value.get('.pr-card__num').text()).toBe('1.80');
    expect(value.get('.pr-card__unit').text()).toBe('µs');
    expect(value.attributes('title')).toBe('1.800123 µs');
  });

  it('PR-STATS-009b: summary cards use sketch 3+2 grid spans', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000 },
          bandwidthCards: [
            {
              id: 'input',
              sides: [{ side: 'aic', measuredGBs: 80, peakGBs: 1600 }],
            },
            {
              id: 'output',
              sides: [{ side: 'aiv', measuredGBs: 90, peakGBs: 1600 }],
            },
          ],
        }),
      },
    });
    expect(wrapper.get('[data-testid="stats-summary"]').classes()).toContain('pr-cards');
    expect(wrapper.get('[data-testid="stats-duration-card"]').classes()).toContain('pr-card--top');
    expect(wrapper.get('[data-testid="stats-compute-card"]').classes()).toContain('pr-card--top');
    expect(wrapper.get('[data-testid="stats-core-util-card"]').classes()).toContain('pr-card--top');
    expect(wrapper.get('[data-testid="stats-bandwidth-input"]').classes()).toContain('pr-card--bw');
    expect(wrapper.get('[data-testid="stats-bandwidth-output"]').classes()).toContain('pr-card--bw');
  });

  it('PR-STATS-010: no type card; secondary from blockDim or opName', () => {
    const withType = mount(StatsAside, {
      props: {
        report: report({
          summary: { opType: 'vector', taskDurationUs: 1000, opName: 'relu' },
        }),
      },
    });
    expect(withType.find('[data-testid="stats-type-card"]').exists()).toBe(false);
    expect(withType.get('[data-testid="stats-duration-card"]').text()).toContain('relu');
    expect(withType.get('[data-testid="stats-aside-meta"]').text()).toMatch(/算子类型|Op type/);

    const withDim = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000, blockDim: 8, opName: 'relu' },
        }),
      },
    });
    const secondary = withDim.get('[data-testid="stats-duration-secondary"]').text();
    expect(secondary).toMatch(/8/);
    expect(secondary).toMatch(/次迭代|iterations/);
    expect(secondary).not.toContain('relu');

    const withCore = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000, blockDim: 8, coreCount: 72, opType: 'vector' },
        }),
      },
    });
    const ratioSecondary = withCore.get('[data-testid="stats-duration-secondary"]').text();
    expect(ratioSecondary).toMatch(/8/);
    expect(ratioSecondary).toMatch(/72/);

    const bare = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 1000 } }),
      },
    });
    expect(bare.find('[data-testid="stats-duration-secondary"]').exists()).toBe(false);
  });

  it('PR-STATS-031: duration bar util % from blockDim/coreCount; clamps at 100%', () => {
    const util = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000, blockDim: 8, coreCount: 72, opType: 'vector' },
        }),
      },
    });
    const fill = util.get('.pr-card__bar-fill--duration');
    expect(fill.attributes('style')).toMatch(/width:\s*11\.111/);

    const clamped = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000, blockDim: 40, coreCount: 36, opType: 'mix' },
        }),
      },
    });
    expect(clamped.get('.pr-card__bar-fill--duration').attributes('style')).toContain('width: 100%');

    const decorative = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 1000, blockDim: 8 } }),
      },
    });
    expect(decorative.get('.pr-card__bar-fill--duration').attributes('style')).toContain('width: 15%');
  });

  it('PR-STATS-011: compute/util are N/A placeholders; BW not from summary.ioBandwidth', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: {
            taskDurationUs: 1000,
            computeTflops: 172,
            ioBandwidth: 0.08,
            avgCoreUtil: 0.69,
          },
        }),
      },
    });
    const compute = wrapper.get('[data-testid="stats-compute-card"]');
    expect(compute.text()).toMatch(/算力情况|Computing power/);
    expect(compute.text()).toContain('N/A');
    expect(compute.text()).not.toMatch(/172|90\s*%/);
    const core = wrapper.get('[data-testid="stats-core-util-card"]');
    expect(core.text()).toMatch(/平均核利用率|Average core/);
    expect(core.text()).toContain('N/A');
    expect(core.text()).not.toMatch(/0\.69|82\s*%|24\/24/);
    expect(wrapper.find('[data-testid="stats-bandwidth-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-bandwidth-output"]').exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/输入带宽|Input bandwidth/);
  });

  it('PR-STATS-011b: BW-only summary hides compute/util placeholders', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: {},
          bandwidthCards: [
            {
              id: 'input',
              sides: [{ side: 'aic', measuredGBs: 80, peakGBs: 1600 }],
            },
            {
              id: 'output',
              sides: [{ side: 'aiv', measuredGBs: 90, peakGBs: 1600 }],
            },
          ],
        }),
      },
    });
    expect(wrapper.find('[data-testid="stats-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-duration-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-compute-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-core-util-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-bandwidth-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-bandwidth-output"]').exists()).toBe(true);
  });

  it('PR-STATS-024: I/O bandwidth cards with aic|aiv columns, duration chrome, GB/s, bar = score%', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000 },
          bandwidthCards: [
            {
              id: 'input',
              sides: [
                { side: 'aic', measuredGBs: 80, peakGBs: 1600 },
                { side: 'aiv', measuredGBs: 90, peakGBs: 1600 },
              ],
            },
            {
              id: 'output',
              sides: [{ side: 'aiv', measuredGBs: 1.56, peakGBs: 1600 }],
            },
          ],
        }),
      },
    });
    const input = wrapper.get('[data-testid="stats-bandwidth-input"]');
    expect(input.classes()).toContain('pr-card');
    expect(input.text()).toMatch(/输入带宽|Input bandwidth/);
    expect(input.find('.pr-bw-cols').exists()).toBe(true);
    expect(input.get('[data-testid="stats-bandwidth-input-aic"]').text()).toMatch(/aic/);
    expect(input.get('[data-testid="stats-bandwidth-input-aic"]').text()).toMatch(/80\.0 \/ 1600\.0 GB\/s/);
    const aicScore = input.get('[data-testid="stats-bandwidth-input-aic-score"]');
    expect(aicScore.classes()).toContain('pr-card__value');
    expect(aicScore.text()).toBe('5');
    expect(input.get('[data-testid="stats-bandwidth-input-aic-bar"]').attributes('style')).toMatch(
      /width:\s*5%/,
    );
    expect(input.get('[data-testid="stats-bandwidth-input-aiv-score"]').text()).toBe('6');
    expect(input.get('[data-testid="stats-bandwidth-input-aiv"]').text()).toMatch(/90\.0 \/ 1600\.0 GB\/s/);
    expect(input.get('[data-testid="stats-bandwidth-input-aiv-bar"]').attributes('style')).toMatch(
      /width:\s*6%/,
    );

    const output = wrapper.get('[data-testid="stats-bandwidth-output"]');
    expect(output.classes()).toContain('pr-card');
    expect(output.text()).toMatch(/输出带宽|Output bandwidth/);
    expect(output.find('[data-testid="stats-bandwidth-output-aic"]').exists()).toBe(false);
    expect(output.get('[data-testid="stats-bandwidth-output-aiv"]').text()).toMatch(/1\.56 \/ 1600\.0 GB\/s/);
  });

  it('PR-STATS-024: out.rep cards use 1600 GB/s peak (~1% score), not max of measured', () => {
    const { reportModel } = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(StatsAside, { props: { report: reportModel } });
    const aiv = wrapper.get('[data-testid="stats-bandwidth-input-aiv"]');
    expect(aiv.get('[data-testid="stats-bandwidth-input-aiv-score"]').text()).toBe('1');
    expect(aiv.text()).toMatch(/GB\/s/);
    expect(aiv.text()).not.toMatch(/TB\/s/);
    expect(wrapper.find('[data-testid="stats-bandwidth-input-aic"]').exists()).toBe(false);
  });

  it('PR-STATS-012: PIPE scale and hatched bars', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
        }),
      },
    });
    const scale = wrapper.get('[data-testid="pipe-scale"]').text();
    expect(scale).toContain('0%');
    expect(scale).toContain('100%');
    expect(wrapper.find('.pr-pipe-chart').exists()).toBe(true);
    expect(wrapper.find('.pr-pipe-row__hatch').exists()).toBe(true);
    expect(wrapper.find('.pr-pipe-row__bar').exists()).toBe(true);
    expect(wrapper.get('.pr-pipe-row__track').find('.pr-pipe-row__pct').exists()).toBe(true);
  });

  it('PR-STATS-013: absolute time in bar when present', () => {
    const withAbs = mount(StatsAside, {
      props: {
        report: report({
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
        }),
      },
    });
    expect(withAbs.get('[data-testid="pipe-absolute"]').text()).toMatch(/0\.065/);
    const track = withAbs.get('.pr-pipe-row__track');
    expect(track.find('.pr-pipe-row__bar .pr-pipe-row__abs').exists()).toBe(false);
    expect(track.find(':scope > .pr-pipe-row__abs').exists()).toBe(true);

    const without = mount(StatsAside, {
      props: {
        report: report({
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
        }),
      },
    });
    expect(without.find('[data-testid="pipe-absolute"]').exists()).toBe(false);
  });

  it('PR-STATS-014: Details emit open-pipe-details', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
        }),
      },
    });
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.emitted('open-pipe-details')).toBeTruthy();
    // No csvTables → stay on overview (no blank drill-down)
    expect(wrapper.find('[data-testid="stats-pipe-details"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
  });

  it('PR-STATS-015: Roofline section when points present; hidden when absent', () => {
    const withRoof = mount(StatsAside, {
      props: {
        report: report({
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
        }),
      },
    });
    expect(withRoof.find('[data-testid="stats-roofline"]').exists()).toBe(true);
    expect(withRoof.find('[data-testid="roofline-panel"]').exists()).toBe(true);

    const without = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 1 } }),
      },
    });
    expect(without.find('[data-testid="stats-roofline"]').exists()).toBe(false);
  });

  it('PR-STATS-016: 详情 switches to compute mode when tables exist', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { opType: 'vector' },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aiv_vec_ratio'],
              rows: [{ block_id: '0', aiv_vec_ratio: '0.5' }],
              blockIds: ['0'],
            },
          ],
          csvTexts: {
            'PipeUtilization.csv': 'block_id,aiv_vec_ratio\n0,0.5\n',
          },
        }),
      },
    });
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.emitted('open-pipe-details')).toBeTruthy();
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(false);
  });

  it('PR-STATS-017: topology 详情 shows memory CSV overlay', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aic_l1_read_bw(GB/s)'],
              rows: [{ block_id: '0', 'aic_l1_read_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          csvTexts: { 'Memory.csv': 'block_id,aic_l1_read_bw(GB/s)\n0,1.2\n' },
        }),
      },
    });
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
  });

  it('PR-STATS-018: 更多 navigates to hardware when hardwareDetails present', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        capabilities: ['hardwareDetails'],
        report: report({
          hardwareDetails: {
            sections: [
              {
                id: 'op',
                title: 'OpBasicInfo',
                fields: [{ key: 'Op Name', value: 'add_custom' }],
              },
            ],
          },
        }),
      },
    });
    await wrapper.get('[data-testid="stats-aside-more"]').trigger('click');
    expect(wrapper.emitted('open-hardware-details')).toBeTruthy();
    expect(wrapper.find('[data-testid="stats-hardware-details"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('add_custom');
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-hardware-details"]').exists()).toBe(false);
  });

  it('PR-STATS-018b: OpBasicInfo fallback still renders hardware panel', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          hardwareDetails: {
            sections: [
              {
                id: 'op',
                title: 'OpBasicInfo',
                fields: [{ key: 'Op Name', value: 'relu' }],
              },
            ],
          },
        }),
      },
    });
    await wrapper.get('[data-testid="stats-aside-more"]').trigger('click');
    expect(wrapper.find('[data-testid="hardware-info-missing"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('relu');
  });

  it('PR-STATS-019: topology section when labelled edges present; hidden when absent', () => {
    const withTopo = mount(StatsAside, {
      props: {
        report: report({
          memoryTopology: {
            nodes: [{ id: 'gm', label: 'GM' }, { id: 'l2', label: 'L2 Cache' }],
            edges: [{ id: 'gm-l2-read', from: 'gm', to: 'l2', label: '1.56 GB/s' }],
          },
        }),
      },
    });
    expect(withTopo.find('[data-testid="stats-topology"]').exists()).toBe(true);
    expect(withTopo.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);

    const without = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1 } }) },
    });
    expect(without.find('[data-testid="stats-topology"]').exists()).toBe(false);
  });

  it('PR-STATS-020: no mode-tab switcher on stacked report', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.1, colorKey: 'vector', side: 'vector' },
          ],
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id'],
              rows: [{ block_id: '0' }],
              blockIds: ['0'],
            },
          ],
        }),
      },
    });
    expect(wrapper.find('[data-testid="aside-modes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-summary"]').exists()).toBe(true);
  });

  it('PR-STATS-021: overlay returns to stack when report changes', async () => {
    const withCompute = report({
      summary: { taskDurationUs: 1 },
      pipeOccupancy: [
        { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
      ],
      computeTables: [
        {
          fileName: 'PipeUtilization.csv',
          headers: ['block_id', 'aiv_vec_ratio'],
          rows: [{ block_id: '0', aiv_vec_ratio: '0.5' }],
          blockIds: ['0'],
        },
      ],
    });
    const wrapper = mount(StatsAside, { props: { report: withCompute } });
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(true);

    await wrapper.setProps({ report: report({ summary: { taskDurationUs: 2 } }) });
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-duration-card"]').exists()).toBe(true);

    const stale = report({
      summary: { taskDurationUs: 1 },
      memoryTables: [
        {
          fileName: 'Memory.csv',
          headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
          rows: [
            { block_id: '0', 'aiv_main_mem_read_bw(GB/s)': 'NA' },
            { block_id: '1', 'aiv_main_mem_read_bw(GB/s)': '2.5' },
          ],
          blockIds: ['0', '1'],
        },
      ],
    });
    const swapped = mount(StatsAside, { props: { report: stale } });
    expect(swapped.text()).toContain('2.50 GB/s');
    await swapped.setProps({
      report: report({
        summary: { taskDurationUs: 1 },
        memoryTables: [
          {
            fileName: 'Memory.csv',
            headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
            rows: [
              { block_id: '0', 'aiv_main_mem_read_bw(GB/s)': '1.56' },
              { block_id: '1', 'aiv_main_mem_read_bw(GB/s)': 'NA' },
            ],
            blockIds: ['0', '1'],
          },
        ],
      }),
    });
    expect(swapped.text()).toContain('1.56 GB/s');
    expect(swapped.text()).not.toContain('2.50 GB/s');
  });

  it('PR-STATS-022: topology does not keep another block’s labels', async () => {
    const tables = [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
        rows: [
          { block_id: '0', 'aiv_main_mem_read_bw(GB/s)': '1.56' },
          { block_id: '1', 'aiv_main_mem_read_bw(GB/s)': 'NA' },
        ],
        blockIds: ['0', '1'],
      },
    ];
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: tables,
          memoryTopology: {
            nodes: [{ id: 'gm', label: 'GM' }, { id: 'l2', label: 'L2 Cache' }],
            edges: [{ id: 'gm-l2-read', from: 'gm', to: 'l2', label: '1.56 GB/s' }],
          },
          csvTexts: { 'Memory.csv': 'block_id,aiv_main_mem_read_bw(GB/s)\n0,1.56\n1,NA\n' },
        }),
      },
    });
    expect(wrapper.text()).toContain('1.56 GB/s');
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    await wrapper.get('[data-testid="csv-block"]').setValue('1');
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-topology"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('1.56 GB/s');
  });

  it('PR-STATS-022: CSV tab fallback does not rewrite topology block', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
              rows: [
                { block_id: '0', 'aiv_main_mem_read_bw(GB/s)': 'NA' },
                { block_id: '1', 'aiv_main_mem_read_bw(GB/s)': '1.56' },
              ],
              blockIds: ['0', '1'],
            },
            {
              fileName: 'MemoryL0.csv',
              headers: ['block_id', 'aic_l0a_read_bw(GB/s)'],
              rows: [{ block_id: '0', 'aic_l0a_read_bw(GB/s)': 'NA' }],
              blockIds: ['0'],
            },
          ],
          csvTexts: {
            'Memory.csv': 'block_id,aiv_main_mem_read_bw(GB/s)\n0,NA\n1,1.56\n',
            'MemoryL0.csv': 'block_id,aic_l0a_read_bw(GB/s)\n0,NA\n',
          },
        }),
      },
    });
    expect(wrapper.text()).toContain('1.56 GB/s');
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    await wrapper.get('[data-testid="csv-tab-MemoryL0.csv"]').trigger('click');
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.text()).toContain('1.56 GB/s');
  });

  it('PR-STATS-023: memory 详情 stays available when topology diagram is hidden', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aic_l1_read_bw(GB/s)'],
              rows: [{ block_id: '0', 'aic_l1_read_bw(GB/s)': 'NA' }],
              blockIds: ['0'],
            },
          ],
          csvTexts: { 'Memory.csv': 'block_id,aic_l1_read_bw(GB/s)\n0,NA\n' },
        }),
      },
    });
    expect(wrapper.find('[data-testid="stats-topology"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('MemoryL1');
  });

  it('PR-STATS-025: aside shell is black; roofline / PIPE / topology islands are grey', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-aside\s*\{[^}]*background:\s*var\(--pr-bg-aside\)/s);
    expect(src).toMatch(/\.pr-cards\s*\{[^}]*background:\s*var\(--pr-bg-aside\)/s);
    expect(src).toMatch(/\.pr-card__bar-track\s*\{[^}]*background:\s*var\(--pr-bg-aside\)/s);
    expect(src).toMatch(
      /\.pr-panel--pipe,\s*\.pr-panel--topo\s*\{[^}]*background:\s*var\(--pr-bg-panel\)/s,
    );
  });

  it('PR-STATS-025c: summary grid aligns with stack islands (no horizontal well inset)', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-cards\s*\{[^}]*padding:\s*0\s+0\s+8px/s);
  });

  it('PR-STATS-025b: section titles sit outside grey islands', () => {
    const pipes = [
      { id: 'cube', label: 'Cube', ratio: 0.8, colorKey: 'cube', side: 'cube' as const },
    ];
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1, opType: 'cube' },
          pipeOccupancy: pipes,
          roofline: {
            points: [{ id: 'p1', label: 'x', intensity: 1, performance: 1, style: 'solid' }],
            mixLabels: [],
            peakComputeTops: 10,
            peakBandwidthGBs: 1000,
          },
          memoryTopology: {
            nodes: [{ id: 'gm', label: 'GM' }, { id: 'l2', label: 'L2 Cache' }],
            edges: [{ id: 'gm-l2-read', from: 'gm', to: 'l2', label: '1 GB/s' }],
          },
        }),
      },
    });

    const pipeSection = wrapper.get('[data-testid="pipe-occupancy"]');
    expect(pipeSection.find('.pr-stack-section__head h4').exists()).toBe(true);
    expect(pipeSection.find('.pr-panel--pipe .pr-stack-section__head').exists()).toBe(false);
    expect(pipeSection.find('.pr-panel--pipe').exists()).toBe(true);

    const topoSection = wrapper.get('[data-testid="stats-topology"]');
    expect(topoSection.find('.pr-stack-section__head h4').exists()).toBe(true);
    expect(topoSection.find('.pr-panel--topo .pr-stack-section__head').exists()).toBe(false);

    const rooflineSection = wrapper.get('[data-testid="stats-roofline"]');
    expect(rooflineSection.find('.pr-panel').exists()).toBe(false);
    expect(rooflineSection.find('.pr-roofline__title').exists()).toBe(true);
    expect(rooflineSection.find('.pr-roofline__card').exists()).toBe(true);
  });

  it('PR-STATS-026: cannbot icon entries render in summary, compute and memory sections', () => {
    const wrapper = mount(StatsAside, { props: { report: cannbotEntryReport() } });

    const summaryBtn = wrapper.get('[data-testid="cannbot-summary"]');
    expect(summaryBtn.find('svg').exists()).toBe(true);
    expect(summaryBtn.element.parentElement).toBe(
      wrapper.get('[data-testid="stats-aside-meta"]').element,
    );

    const computeBtn = wrapper.get('[data-testid="cannbot-compute"]');
    expect(computeBtn.find('svg').exists()).toBe(true);
    const computeActions = computeBtn.element.parentElement!;
    expect(computeActions).toBe(wrapper.get('[data-testid="pipe-details"]').element.parentElement);
    expect(computeActions.classList.contains('pr-pipe-head__actions')).toBe(true);
    expect(computeActions.children[0]).toBe(computeBtn.element);

    const memoryBtn = wrapper.get('[data-testid="cannbot-memory"]');
    expect(memoryBtn.find('svg').exists()).toBe(true);
    const memoryActions = memoryBtn.element.parentElement!;
    expect(memoryActions).toBe(
      wrapper.get('[data-testid="topology-details"]').element.parentElement,
    );
    expect(memoryActions.classList.contains('pr-pipe-head__actions')).toBe(true);
    expect(memoryActions.children[0]).toBe(memoryBtn.element);

    const empty = mount(StatsAside, { props: { report: report({}) } });
    expect(empty.find('[data-testid="cannbot-summary"]').exists()).toBe(true);

    // Icon gating tracks payload data, not section visibility: pipe bars without
    // compute tables carry no compute payload, so the compute icon stays hidden.
    const pipeOnly = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
        }),
      },
    });
    expect(pipeOnly.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
    expect(pipeOnly.find('[data-testid="cannbot-compute"]').exists()).toBe(false);

    // CSV-only fallback (PR-UI-008): icons render on the compute/memory list titles.
    const csvOnly = mount(StatsAside, { props: { report: csvOnlyEntryReport() } });
    expect(csvOnly.find('[data-testid="stats-compute"]').exists()).toBe(true);
    expect(csvOnly.find('[data-testid="stats-memory"]').exists()).toBe(true);
    const csvComputeBtn = csvOnly.get('[data-testid="cannbot-compute"]');
    expect(csvComputeBtn.element.parentElement!.classList.contains('pr-aside__detail-head')).toBe(true);
    const csvMemoryBtn = csvOnly.get('[data-testid="cannbot-memory"]');
    expect(csvMemoryBtn.element.parentElement!.classList.contains('pr-aside__detail-head')).toBe(true);
  });

  it('PR-STATS-027: cannbot icons emit open-cannbot with the section scope', async () => {
    const wrapper = mount(StatsAside, { props: { report: cannbotEntryReport() } });

    await wrapper.get('[data-testid="cannbot-summary"]').trigger('click');
    await wrapper.get('[data-testid="cannbot-compute"]').trigger('click');
    await wrapper.get('[data-testid="cannbot-memory"]').trigger('click');
    expect(wrapper.emitted('open-cannbot')).toEqual([['summary'], ['compute'], ['memory']]);

    const csvOnly = mount(StatsAside, { props: { report: csvOnlyEntryReport() } });
    await csvOnly.get('[data-testid="cannbot-compute"]').trigger('click');
    await csvOnly.get('[data-testid="cannbot-memory"]').trigger('click');
    expect(csvOnly.emitted('open-cannbot')).toEqual([['compute'], ['memory']]);
  });
});
