import { afterEach, describe, expect, it } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import StatsAside from './StatsAside.vue';
import { adaptRep, emptyReportViewModel } from '../../adapters/adaptRep';
import {
  buildMemoryTopologyFromCategories,
  firstLabelledMemoryTopology,
} from '../../adapters/memoryTopology';
import { parseRep } from '../../adapters/parseRep';
import type { ReportViewModel } from '../../domain/types';
import { loadOutRepBytes } from '../../../tests/helpers/fixtures';
import { t } from '../../i18n';

function report(partial: Partial<ReportViewModel> = {}): ReportViewModel {
  return { ...emptyReportViewModel(), ...partial };
}

/** Unmount every wrapper after its test so the shared card tooltip leaves the document with it. */
enableAutoUnmount(afterEach);

/**
 * Summary-card number tooltip (PR-STATS-041): the exact value is the first (bold) line, the metric
 * description the second. `locale` must match the mount under test — `exactValue` is localized, so
 * an `en` mount asserting against the default zh-CN label would silently mismatch.
 */
function cardTipValue(exact: string, locale?: string): string {
  return `${t('exactValue', locale)}: ${exact}`;
}

/**
 * The popover is teleported to `body` (PR-STATS-041), so it lives outside the mounted wrapper —
 * `wrapper.find` cannot see it. Query the document, as the other teleporting specs do
 * (ContextMenu / ReportToolbar / OverviewCharts); `enableAutoUnmount` tears each node down.
 */
const CARD_TIP = '[data-testid="stats-card-tooltip"]';
const tipRoot = (): HTMLElement | null => document.querySelector(CARD_TIP);
const tipOpen = (): boolean => tipRoot() !== null;
const tipPart = (testid: string): string | null =>
  document.querySelector(`[data-testid="${testid}"]`)?.textContent?.trim() ?? null;

/** Hover one summary-card trigger and read the open tooltip's value + hint lines. */
async function hoverCardTip(
  wrapper: ReturnType<typeof mount>,
  selector: string,
): Promise<{ value: string | null; hint: string | null }> {
  await wrapper.get(selector).trigger('pointerenter', { clientX: 10, clientY: 20 });
  return {
    value: tipPart('stats-card-tooltip-value'),
    hint: tipPart('stats-card-tooltip-hint'),
  };
}

/**
 * Chrome the card popover must share with the timeline `EventTooltip` / overview value tip
 * (PR-STATS-041). Listed once so the parity test fails only when one of the two actually drifts.
 */
const SHARED_TOOLTIP_CHROME = [
  'position: fixed',
  'pointer-events: none',
  'box-sizing: border-box',
  'padding: 8px 10px',
  'background: var(--pr-surface-raised, #363636)',
  'border: 1px solid rgba(255, 255, 255, 0.05)',
  'border-radius: 12px',
  'box-shadow: 0 0 16px rgba(0, 0, 0, 0.2)',
  'font-size: 12px',
  'line-height: 1.45',
  'min-width: 180px',
] as const;

/**
 * jsdom measures every box as 0×0, so truncation has to be stated: shadow the two widths the
 * ellipsis check reads. `scrollWidth > clientWidth` is exactly what PR-STATS-036's e2e probe uses.
 */
function setLabelTruncation(el: Element, truncated: boolean): void {
  Object.defineProperty(el, 'scrollWidth', { value: truncated ? 200 : 100, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true });
}

/** Open the PIPE CardMetricSelect and pick an option ('' = All). */
async function pickPipeBlock(
  wrapper: ReturnType<typeof mount>,
  value: string,
): Promise<void> {
  await wrapper.get('[data-testid="pipe-block-select"] .pr-metric-select__trigger').trigger('click');
  const opt = document.querySelector(
    `[data-testid="pipe-block-option-${value}"]`,
  ) as HTMLElement | null;
  expect(opt).not.toBeNull();
  opt!.click();
  await wrapper.vm.$nextTick();
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

  it('PR-STATS-014b: one block selector scopes PIPE + topology — All = summary.jsonl (DATA-19/28/29)', async () => {
    // All scope (DATA-28): the producer's non-NA mean across block_id, not block 0's row.
    const allMemory = {
      id: 'Memory',
      title: 'Memory',
      fields: [{ key: 'aiv_main_mem_read_bw(GB/s)', value: '4.0' }],
    };
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { opType: 'vector', taskDurationUs: 1 },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aiv_vec_ratio'],
              rows: [
                { block_id: '0', aiv_vec_ratio: '0.2' },
                { block_id: '1', aiv_vec_ratio: '0.8' },
              ],
              blockIds: ['0', '1'],
            },
          ],
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_main_mem_read_bw(GB/s)'],
              rows: [
                { block_id: '0', 'aiv_main_mem_read_bw(GB/s)': '1.0' },
                { block_id: '1', 'aiv_main_mem_read_bw(GB/s)': '2.0' },
                { block_id: '2', 'aiv_main_mem_read_bw(GB/s)': '9.0' },
              ],
              blockIds: ['0', '1', '2'],
            },
          ],
          // All scope (DATA-28): the producer's non-NA mean across block_id, not block 0's row.
          summaryCategories: [allMemory],
          // The adapter's `All` snapshot (PR-VM-012) — the aside reads it, it does not derive it.
          memoryTopology: buildMemoryTopologyFromCategories([allMemory])!,
        }),
      },
    });

    await wrapper.get('[data-testid="pipe-block-select"] .pr-metric-select__trigger').trigger('click');
    const options = [...document.querySelectorAll('[data-testid^="pipe-block-option-"]')].map((el) =>
      (el.getAttribute('data-testid') ?? '').replace(/^pipe-block-option-/, ''),
    );
    // Every id the report carries (compute ∪ memory) — a memory-only id must still be selectable, or
    // the memory overlay switcher (same state) would leave this one blank.
    expect(options).toEqual(['', '0', '1', '2']);
    // Close the teleported menu before further assertions.
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(wrapper.find('[data-testid="pipe-block-switcher"]').exists()).toBe(true);
    // Default locale zh-CN → 分块; English keeps "Block".
    expect(wrapper.find('[data-testid="pipe-block-switcher"]').text()).toContain('分块');
    // Same CardMetricSelect chrome as card-header / ArchDiagram Metric (not native .pr-block-pill).
    expect(wrapper.get('[data-testid="pipe-block-select"]').classes()).toContain('pr-metric-select');
    expect(wrapper.get('.pr-pipe-row__pct').text()).toBe('50%');
    // All = summary.jsonl aggregate (4.0), not the first block's 1.0.
    expect(wrapper.text()).toContain('4.00 GB/s');

    await pickPipeBlock(wrapper, '1');
    expect(wrapper.get('.pr-pipe-row__pct').text()).toBe('80%');
    expect(wrapper.text()).toContain('2.00 GB/s');
    expect(wrapper.text()).not.toContain('4.00 GB/s');

    // All must return to the summary.jsonl aggregate from a non-default pick (not via an intervening `0`).
    await pickPipeBlock(wrapper, '');
    expect(wrapper.get('.pr-pipe-row__pct').text()).toBe('50%');
    expect(wrapper.text()).toContain('4.00 GB/s');
    expect(wrapper.text()).not.toContain('2.00 GB/s');

    await pickPipeBlock(wrapper, '0');
    expect(wrapper.get('.pr-pipe-row__pct').text()).toBe('20%');
    expect(wrapper.text()).toContain('1.00 GB/s');
  });

  it('PR-STATS-014c (DATA-19/29): 详情 follows the block selector — picked id reads its CSV row', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { opType: 'vector', taskDurationUs: 1 },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aiv_vec_ratio'],
              rows: [
                { block_id: '0', aiv_vec_ratio: '0.2' },
                { block_id: '1', aiv_vec_ratio: '0.8' },
              ],
              blockIds: ['0', '1'],
            },
          ],
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_ub_to_gm_bw(GB/s)'],
              rows: [
                { block_id: '0', 'aiv_ub_to_gm_bw(GB/s)': '1.5' },
                { block_id: '1', 'aiv_ub_to_gm_bw(GB/s)': '1.7' },
              ],
              blockIds: ['0', '1'],
            },
          ],
          // Product default 详情: the summary.jsonl category list.
          summaryCategories: [
            {
              id: 'PipeUtilization',
              title: 'PipeUtilization',
              fields: [{ key: 'aiv_vec_ratio', value: '0.42' }],
            },
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_ub_to_gm_bw(GB/s)', value: '1.6' }],
            },
          ],
          csvTexts: {
            'PipeUtilization.csv': 'block_id,aiv_vec_ratio\n0,0.2\n1,0.8\n',
            'Memory.csv': 'block_id,aiv_ub_to_gm_bw(GB/s)\n0,1.5\n1,1.7\n',
          },
        }),
      },
    });

    // All keeps the summary.jsonl category list (product default) with search …
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.find('[data-testid="summary-category-list"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="summary-search"]').exists()).toBe(true);
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');

    // … a picked block switches 详情 to that block's CSV row.
    await pickPipeBlock(wrapper, '1');
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    expect(wrapper.find('[data-testid="summary-category-list"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="csv-field-list"]').text()).toContain('0.8');
    expect(wrapper.get('[data-testid="csv-field-list"]').text()).not.toContain('0.42');
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');

    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="summary-category-list"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="csv-field-list"]').text()).toContain('1.7');
  });

  it('PR-STATS-014d (DATA-29): a picked block with no data blanks the tile — never the All aggregate', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        capabilities: ['roofline'],
        report: report({
          summary: { opType: 'vector', taskDurationUs: 1 },
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' },
          ],
          // BW / compute / roofline All values exist …
          bandwidthCards: [
            { id: 'input', sides: [{ side: 'aicore', measuredGBs: 800, peakGBs: 1600 }] },
          ],
          computeCard: {
            sides: [{ side: 'aic', measuredTflops: 10, peakTflops: 20 }],
          },
          roofline: {
            points: [{ id: 'gm', label: 'GM', intensity: 1, performance: 1, style: 'solid' }],
            mixLabels: [],
            peakComputeTops: 1,
            peakBandwidthGBs: 1600,
          },
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aiv_vec_ratio'],
              rows: [
                { block_id: '0', aiv_vec_ratio: '0.2' },
                { block_id: '1', aiv_vec_ratio: '0.8' },
              ],
              blockIds: ['0', '1'],
            },
          ],
          // … but the picked block has no Memory.csv / ArithmeticUtilization.csv rows.
          memoryTables: [],
        }),
      },
    });

    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="stats-compute-card"]').classes()).not.toContain('pr-card--na');
    await pickPipeBlock(wrapper, '1');
    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-roofline"]').exists()).toBe(false);
    // Compute keeps its cell as the N/A placeholder — no All measurement under the block label.
    const naCard = wrapper.get('[data-testid="stats-compute-card"]');
    expect(naCard.classes()).toContain('pr-card--na');
    expect(naCard.text()).toContain('N/A');
    expect(naCard.text()).not.toContain('10');
    // PIPE re-reads the block's own row (0.8, not the All 0.5) …
    expect(wrapper.get('.pr-pipe-row__pct').text()).toBe('80%');
    expect(wrapper.text()).not.toContain('50%');
    // … and the selector stays reachable so All can be restored.
    expect(wrapper.find('[data-testid="pipe-block-switcher"]').exists()).toBe(true);
    await pickPipeBlock(wrapper, '');
    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="stats-compute-card"]').classes()).not.toContain('pr-card--na');
    expect(wrapper.get('.pr-pipe-row__pct').text()).toBe('50%');
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
    expect(mix.find('[data-testid="pipe-side-cube"]').exists()).toBe(true);
    expect(mix.find('[data-testid="pipe-side-vector"]').exists()).toBe(true);
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

  it('PR-STATS-038: emulate Cube|Vector 0|Vector 1 toggle filters by core (UI-54)', async () => {
    const pipes = [
      { id: 'mte3', label: 'MTE3', ratio: 0.0, colorKey: 'mte3', side: 'aic' as const },
      { id: 'mte3', label: 'MTE3', ratio: 0.1856, colorKey: 'mte3', side: 'aiv0' as const },
      { id: 'mte3', label: 'MTE3', ratio: 0.264, colorKey: 'mte3', side: 'aiv1' as const },
      { id: 'scalar', label: 'Scalar', ratio: 0.505, colorKey: 'scalar', side: 'aic' as const },
      { id: 'scalar', label: 'Scalar', ratio: 0.484, colorKey: 'scalar', side: 'aiv0' as const },
      { id: 'scalar', label: 'Scalar', ratio: 0.489, colorKey: 'scalar', side: 'aiv1' as const },
    ];

    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          pipeOccupancy: pipes,
        }),
      },
    });

    await wrapper.get('[data-testid="pipe-occupancy"]');
    expect(wrapper.find('[data-testid="pipe-side-toggle"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pipe-side-aic"]').text()).toBe('Cube');
    expect(wrapper.find('[data-testid="pipe-side-aiv0"]').text()).toBe('Vector 0');
    expect(wrapper.find('[data-testid="pipe-side-aiv1"]').text()).toBe('Vector 1');

    let rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('Scalar');
    expect(rows).toContain('51'); // round(0.505*100)
    expect(rows).not.toContain('19'); // aiv0 MTE3 ~19%
    expect(rows).not.toContain('26'); // aiv1 MTE3

    await wrapper.get('[data-testid="pipe-side-aiv0"]').trigger('click');
    rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('MTE3');
    expect(rows).toContain('19'); // round(0.1856*100)
    expect(rows).not.toContain('26');
    expect(rows).not.toContain('51');

    await wrapper.get('[data-testid="pipe-side-aiv1"]').trigger('click');
    rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('26'); // round(0.264*100)
    expect(rows).not.toContain('19');

    // Re-passing an equivalent report must not wipe Vector 1 back to Cube (aic).
    await wrapper.setProps({
      report: report({
        summary: { taskDurationUs: 1 },
        pipeOccupancy: [...pipes],
      }),
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="pipe-side-aiv1"]').classes()).toContain(
      'pr-pipe-toggle__btn--active',
    );
    rows = wrapper.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('26');
  });

  it('PR-STATS-038: single emulate core keeps bars with opType AIC/AIV (UI-54)', async () => {
    // After UI-54 drops unresolved cores, a pack may have only side aic (or only aiv0).
    // Must not fall through to knownSide (aic→cube / aiv→vector) and blank the list.
    const aicOnly = [
      { id: 'scalar', label: 'Scalar', ratio: 0.505, colorKey: 'scalar', side: 'aic' as const },
      { id: 'mte3', label: 'MTE3', ratio: 0.0, colorKey: 'mte3', side: 'aic' as const },
    ];
    const aic = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1, opType: 'AIC' },
          pipeOccupancy: aicOnly,
        }),
      },
    });
    await aic.get('[data-testid="pipe-occupancy"]');
    expect(aic.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
    let rows = aic.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('Scalar');
    expect(rows).toContain('51');
    expect(rows).toContain('MTE3');

    const aivOnly = [
      { id: 'scalar', label: 'Scalar', ratio: 0.484, colorKey: 'scalar', side: 'aiv0' as const },
      { id: 'mte3', label: 'MTE3', ratio: 0.1856, colorKey: 'mte3', side: 'aiv0' as const },
    ];
    const aiv = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1, opType: 'AIV' },
          pipeOccupancy: aivOnly,
        }),
      },
    });
    await aiv.get('[data-testid="pipe-occupancy"]');
    expect(aiv.find('[data-testid="pipe-side-toggle"]').exists()).toBe(false);
    rows = aiv.findAll('.pr-pipe-row').map((r) => r.text()).join('|');
    expect(rows).toContain('Scalar');
    expect(rows).toContain('48');
    expect(rows).toContain('19');
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
        headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
        rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
        blockIds: ['0'],
      },
    ];
    const csvTexts = {
      'PipeUtilization.csv': 'block_id,aiv_vec_ratio\n0,0.1\n',
      'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n',
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

  it('PR-STATS-006b: overlay headers show back and omit close', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
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
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
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

    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);

    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    const computeOverlay = wrapper.get('[data-testid="stats-compute"]');
    expect(computeOverlay.find('[data-testid="stats-aside-back"]').exists()).toBe(true);
    expect(computeOverlay.find('[data-testid="stats-aside-close"]').exists()).toBe(false);
    // Shell close stays under the opaque overlay so leave can fade back to it.
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
    // Shell header + stacked main are inert while drilled in (PR-STATS-006b).
    expect(wrapper.get('.pr-aside__head').attributes('inert')).toBeDefined();
    expect(wrapper.get('.pr-aside__main').attributes('inert')).toBeDefined();

    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
    expect(wrapper.get('.pr-aside__head').attributes('inert')).toBeUndefined();
    expect(wrapper.get('.pr-aside__main').attributes('inert')).toBeUndefined();

    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    const memoryOverlay = wrapper.get('[data-testid="stats-memory"]');
    expect(memoryOverlay.find('[data-testid="stats-aside-back"]').exists()).toBe(true);
    expect(memoryOverlay.find('[data-testid="stats-aside-close"]').exists()).toBe(false);

    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    await wrapper.get('[data-testid="stats-aside-more"]').trigger('click');
    const hwOverlay = wrapper.get('[data-testid="stats-hardware-details"]');
    expect(hwOverlay.find('[data-testid="stats-aside-back"]').exists()).toBe(true);
    expect(hwOverlay.find('[data-testid="stats-aside-close"]').exists()).toBe(false);

    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
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

  it('PR-STATS-007: emulate omits meta row, 更多, and summary cards (DATA-47)', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          profile: 'emulate',
          summary: { pid: '9', opType: 'mix', blockDim: 4, taskDurationUs: 1000, opName: 'k' },
          pipeOccupancy: [{ id: 'cube', label: 'Cube', ratio: 0.5, colorKey: 'cube', side: 'cube' }],
        }),
      },
    });
    expect(wrapper.find('[data-testid="stats-aside-meta"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside-more"]').exists()).toBe(false);
    expect(wrapper.find('.pr-aside__meta').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-duration-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cannbot-summary"]').exists()).toBe(false);
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

  it('PR-STATS-009: duration card has sketch chrome', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 4600 } }),
      },
    });
    const card = wrapper.get('[data-testid="stats-duration-card"]');
    expect(card.classes()).toContain('pr-card');
    expect(card.classes()).not.toContain('pr-card--bw');
    expect(card.text()).toMatch(/整体耗时|Total time/);
    expect(card.get('.pr-card__num').text()).toBe('4.60');
    expect(card.get('.pr-card__unit').text()).toBe('ms');
    expect(await hoverCardTip(wrapper, '[data-testid="stats-duration-value"]')).toEqual({
      value: cardTipValue('4.6 ms'),
      hint: t('durationValueHint'),
    });
    expect(card.find('[data-testid="stats-duration-bar"]').exists()).toBe(false);
  });

  it('PR-STATS-009c: duration rounds to 2 dp; tooltip keeps full value', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 1.800123 } }),
      },
    });
    const value = wrapper.get('[data-testid="stats-duration-value"]');
    expect(value.get('.pr-card__num').text()).toBe('1.80');
    expect(value.get('.pr-card__unit').text()).toBe('µs');
    expect(await hoverCardTip(wrapper, '[data-testid="stats-duration-value"]')).toEqual({
      value: cardTipValue('1.800123 µs'),
      hint: t('durationValueHint'),
    });
  });

  it('PR-STATS-009b: summary cards use sketch 2x2 grid', () => {
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
    expect(wrapper.find('[data-testid="stats-duration-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-core-util-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-compute-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-bandwidth-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-bandwidth-output"]').exists()).toBe(false);
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
    expect(secondary).toMatch(/Blocks/);
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

  it('PR-STATS-031: duration secondary shows `{blockDim} Blocks / {coreCount} 核` (bar removed)', () => {
    const util = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000, blockDim: 8, coreCount: 72, opType: 'vector' },
        }),
      },
    });
    expect(util.find('[data-testid="stats-duration-bar"]').exists()).toBe(false);
    expect(util.find('.pr-card__bar-fill--duration').exists()).toBe(false);
    const secondary = util.get('[data-testid="stats-duration-secondary"]').text();
    expect(secondary).toContain('8');
    expect(secondary).toContain('72');
    expect(secondary).toMatch(/Blocks/);

    const blockOnly = mount(StatsAside, {
      props: {
        report: report({ summary: { taskDurationUs: 1000, blockDim: 8 } }),
      },
    });
    expect(blockOnly.get('[data-testid="stats-duration-secondary"]').text()).toContain('8');
    expect(blockOnly.get('[data-testid="stats-duration-secondary"]').text()).toContain('Blocks');
  });

  it('PR-STATS-032: compute card Cube|Vector columns, score bar, TFLOPS subtitle (DATA-2..4, UI-33)', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000, opType: 'mix' },
          computeCard: {
            sides: [
              { side: 'aic', measuredTflops: 172, peakTflops: 320 },
              { side: 'aiv', measuredTflops: 15.8, peakTflops: 30 },
            ],
          },
        }),
      },
    });
    expect(wrapper.get('[data-testid="stats-compute-aic-score"]').text()).toBe('54');
    expect(wrapper.get('[data-testid="stats-compute-aiv-score"]').text()).toBe('53');
    expect(wrapper.get('[data-testid="stats-compute-aic-bar"]').attributes('style')).toContain('width: 54%');
    expect(wrapper.get('[data-testid="stats-compute-aic"]').text()).toMatch(/Cube/);
    expect(wrapper.get('[data-testid="stats-compute-aiv"]').text()).toMatch(/Vector/);
    expect(wrapper.text()).toMatch(/172.*320.*TFLOPS/);
    expect(wrapper.get('[data-testid="stats-compute-card"]').classes()).not.toContain('pr-card--na');
  });

  it('PR-STATS-032b: Vector-only / write-only columns use secondary bar hue', () => {
    const computeOnly = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000 },
          computeCard: {
            sides: [{ side: 'aiv', measuredTflops: 15, peakTflops: 30 }],
          },
        }),
      },
    });
    expect(
      computeOnly.get('[data-testid="stats-compute-aiv-bar"]').classes(),
    ).toContain('pr-card__bar-fill--secondary');

    const writeOnly = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000 },
          bandwidthCards: [
            {
              id: 'output',
              sides: [{ side: 'aiv', measuredGBs: 90, peakGBs: 1600 }],
            },
          ],
        }),
      },
    });
    expect(
      writeOnly.get('[data-testid="stats-bandwidth-write-bar"]').classes(),
    ).toContain('pr-card__bar-fill--secondary');
  });

  it('PR-STATS-011: compute/util are N/A placeholders when derived fields absent', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: {
            taskDurationUs: 1000,
          },
        }),
      },
    });
    const compute = wrapper.get('[data-testid="stats-compute-card"]');
    expect(compute.text()).toMatch(/算力情况|Computing power/);
    expect(compute.text()).toContain('N/A');
    expect(compute.text()).not.toMatch(/172|90\s*%/);
    const core = wrapper.get('[data-testid="stats-core-util-card"]');
    expect(core.text()).toMatch(/AICore 并行使用率|AICore parallel/);
    expect(core.text()).toContain('N/A');
    expect(core.text()).not.toMatch(/0\.69|82\s*%|24\/24/);
    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-bandwidth-read"]').exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/带宽利用率|Bandwidth utilization/);
  });

  it('PR-STATS-011c: compute/util render real values from summary.jsonl derived fields', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: {
            taskDurationUs: 1000,
            aicFlops: 100,
            aivFlops: 80,
            aicFlopsTheoretical: 200,
            aivFlopsTheoretical: 160,
            parallelUtilization: 0.981418,
            parallelBalance: 0.933769,
          },
          computeCard: {
            sides: [
              { side: 'aic', measuredTflops: 100, peakTflops: 200 },
              { side: 'aiv', measuredTflops: 80, peakTflops: 160 },
            ],
          },
        }),
      },
    });
    expect(wrapper.get('[data-testid="stats-compute-aic-score"]').text()).toContain('50');
    const core = wrapper.get('[data-testid="stats-core-util-card"]');
    expect(core.text()).toMatch(/AICore 并行使用率|AICore parallel/);
    expect(wrapper.get('[data-testid="stats-aicore-util-score"]').text()).toMatch(/98\.14\s*%/);
    expect(await hoverCardTip(wrapper, '[data-testid="stats-aicore-util-score"]')).toEqual({
      value: cardTipValue('98.1418%'),
      hint: t('parallelUtilHint'),
    });
    expect(wrapper.get('[data-testid="stats-aicore-balance-score"]').text()).toMatch(/93\.38\s*%/);
    expect(await hoverCardTip(wrapper, '[data-testid="stats-aicore-balance-score"]')).toEqual({
      value: cardTipValue('93.3769%'),
      hint: t('parallelBalanceHint'),
    });
    expect(wrapper.get('[data-testid="stats-aicore-util"]').text()).toMatch(
      /并行使用率|Parallel utilization/,
    );
    expect(wrapper.get('[data-testid="stats-aicore-balance"]').text()).toMatch(/负载均衡|Load balance/);
    expect(wrapper.get('[data-testid="stats-aicore-util-bar"]').attributes('style')).toMatch(
      /width:\s*98\.14%/,
    );
    expect(wrapper.get('[data-testid="stats-aicore-balance-bar"]').classes()).toContain(
      'pr-card__bar-fill--secondary',
    );
  });

  it('PR-STATS-040: every summary-card number carries an exact value + description', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 4600, blockDim: 8, coreCount: 24 },
          computeCard: {
            sides: [{ side: 'aic', measuredTflops: 100, peakTflops: 200 }],
          },
          bandwidthCards: [
            { id: 'input', sides: [{ side: 'aic', measuredGBs: 800, peakGBs: 1600 }] },
          ],
        }),
      },
    });
    // Duration keeps the exact (unrounded) amount as the leading line.
    expect(await hoverCardTip(wrapper, '[data-testid="stats-duration-value"]')).toEqual({
      value: cardTipValue('4.6 ms'),
      hint: t('durationValueHint'),
    });
    // The secondary had only a description before — now it states the figure too.
    expect(await hoverCardTip(wrapper, '[data-testid="stats-duration-secondary"]')).toEqual({
      value: cardTipValue('8 Blocks / 24 核'),
      hint: t('durationSecondaryBlocksPerCore'),
    });
    // Scores are exact integers on screen, so the tip leads with the precise percent behind them.
    expect(await hoverCardTip(wrapper, '[data-testid="stats-compute-aic-score"]')).toEqual({
      value: cardTipValue('50%'),
      hint: t('computeScoreHint').replace('{side}', 'Cube'),
    });
    expect(await hoverCardTip(wrapper, '[data-testid="stats-bandwidth-read-score"]')).toEqual({
      value: cardTipValue('50%'),
      hint: t('bandwidthScoreHint').replace('{dir}', t('bwRead')),
    });
    // …and so do the `measured / peak` sub-ratios, which keep the raw values.
    expect(await hoverCardTip(wrapper, '[data-testid="stats-compute-aic"] .pr-card__sub')).toEqual({
      value: cardTipValue('100 / 200 TFLOPS'),
      hint: t('computeRatioHint').replace('{side}', 'Cube'),
    });
    expect(await hoverCardTip(wrapper, '[data-testid="stats-bandwidth-read"] .pr-card__sub')).toEqual({
      value: cardTipValue('800 / 1600 GB/s'),
      hint: t('bandwidthRatioHint').replace('{dir}', t('bwRead')),
    });
  });

  it('PR-STATS-040: tooltips localize with the mount locale', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        locale: 'en',
        report: report({
          summary: { taskDurationUs: 4600 },
          computeCard: {
            sides: [{ side: 'aic', measuredTflops: 100, peakTflops: 200 }],
          },
        }),
      },
    });
    expect(await hoverCardTip(wrapper, '[data-testid="stats-duration-value"]')).toEqual({
      value: cardTipValue('4.6 ms', 'en'),
      hint: t('durationValueHint', 'en'),
    });
    expect(await hoverCardTip(wrapper, '[data-testid="stats-compute-aic-score"]')).toEqual({
      value: cardTipValue('50%', 'en'),
      hint: t('computeScoreHint', 'en').replace('{side}', 'Cube'),
    });
    // The whole point of the helper's `locale` argument: an `en` mount must not assert zh-CN copy.
    expect(cardTipValue('4.6 ms', 'en')).toContain('Exact value');
    expect(cardTipValue('4.6 ms', 'en')).not.toContain(t('exactValue', 'zh-CN'));
  });

  it('PR-STATS-040: Exact value lines strip binary-float residue from summed sides', async () => {
    // BW 读 sums the aic + aiv sides (DATA-8): 0.1 + 0.2 must not read as 0.30000000000000004.
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1000 },
          computeCard: {
            // A mean can carry residue too: (1.1 + 2.2) / 2.
            sides: [{ side: 'aic', measuredTflops: 1.6500000000000001, peakTflops: 320 }],
          },
          bandwidthCards: [
            {
              id: 'input',
              sides: [
                { side: 'aic', measuredGBs: 0.1, peakGBs: 1600 },
                { side: 'aiv', measuredGBs: 0.2, peakGBs: 1600 },
              ],
            },
          ],
        }),
      },
    });
    expect(await hoverCardTip(wrapper, '[data-testid="stats-bandwidth-read"] .pr-card__sub')).toEqual({
      value: cardTipValue('0.3 / 1600 GB/s'),
      hint: t('bandwidthRatioHint').replace('{dir}', t('bwRead')),
    });
    expect(await hoverCardTip(wrapper, '[data-testid="stats-compute-aic"] .pr-card__sub')).toEqual({
      value: cardTipValue('1.65 / 320 TFLOPS'),
      hint: t('computeRatioHint').replace('{side}', 'Cube'),
    });
  });

  it('PR-STATS-040: duration value strips the residue its /1000 into ms introduces', async () => {
    // Not just sums and means: 1000.004 µs divides to 1.0000040000000001 in binary floats.
    const wrapper = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1000.004 } }) },
    });
    const value = wrapper.get('[data-testid="stats-duration-value"]');
    expect(value.get('.pr-card__num').text()).toBe('1.00');
    expect(await hoverCardTip(wrapper, '[data-testid="stats-duration-value"]')).toEqual({
      value: cardTipValue('1.000004 ms'),
      hint: t('durationValueHint'),
    });
    // Each instance teleports its own popover into `body`, so the first has to go before the
    // second mounts — otherwise both nodes sit in the document and the query above reads the
    // stale one. (Production mounts one aside; this is a test-only collision.)
    wrapper.unmount();
    // A sub-µs amount stays exact rather than rounding through 12 significant digits.
    const micro = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1.800123 } }) },
    });
    expect(await hoverCardTip(micro, '[data-testid="stats-duration-value"]')).toEqual({
      value: cardTipValue('1.800123 µs'),
      hint: t('durationValueHint'),
    });
  });

  it('PR-STATS-041: the shared card tooltip matches the timeline chrome, not a native `title`', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    const timeline = (await import('../EventTooltip/EventTooltip.vue?raw')).default as string;
    const rule = (css: string, selector: string) =>
      new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

    const tip = rule(src, '\\.pr-stat-tip');
    const eventTip = rule(timeline, '\\.pr-tooltip');
    /*
     * This is a deliberate lock, not an accident: the requirement is that the two popovers look
     * the same, so the shared declarations are listed once and both components are checked against
     * them. Changing `EventTooltip`'s chrome is meant to land here too.
     */
    for (const decl of SHARED_TOOLTIP_CHROME) {
      expect(eventTip, `EventTooltip dropped the shared chrome "${decl}"`).toContain(decl);
      expect(tip, `card tooltip is missing the shared chrome "${decl}"`).toContain(decl);
    }
    expect(tip).toContain('animation: pr-stat-tip-in 120ms ease');

    // No native `title` survives in the summary grid — every hover goes through the one popover.
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          computeCard: { sides: [{ side: 'aic', measuredTflops: 100, peakTflops: 200 }] },
        }),
      },
    });
    const grid = wrapper.get('[data-testid="stats-summary"]');
    expect(grid.findAll('[title]')).toEqual([]);
    // …and `data-tip` is the very string the trigger renders, not a second copy of it.
    for (const el of grid.findAll('.pr-bw-col__side[data-tip]')) {
      expect(el.attributes('data-tip')).toBe(el.text());
    }
  });

  it('PR-STATS-041b: the popover flips rather than run off the viewport edge', async () => {
    const wrapper = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1 } }) },
    });
    const value = wrapper.get('[data-testid="stats-duration-value"]');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const style = () => tipRoot()!.getAttribute('style')!;

    // Plenty of room to the right: follow the pointer, as the timeline tip does (12px offset).
    await value.trigger('pointerenter', { clientX: 10, clientY: 20 });
    expect(style()).toContain('left: 22px');
    expect(style()).toContain('right: auto');

    // Within a popover's width of the right edge — the aside's whole right-hand column — the box
    // has to hang off the pointer's other side instead of losing its text off-screen.
    await value.trigger('pointerenter', { clientX: vw - 10, clientY: 20 });
    expect(style()).toContain('left: auto');
    expect(style()).toContain('right: 22px');

    // Past the halfway line it grows upward for the same reason.
    await value.trigger('pointerenter', { clientX: 10, clientY: vh - 10 });
    expect(style()).toContain('top: auto');
    expect(style()).toContain('bottom: 22px');
    expect(style()).toContain('left: 22px');
  });

  it('PR-STATS-041c: value triggers reach the tooltip by keyboard and name it for AT', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toContain(':focus-visible');

    const wrapper = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 4600 } }) },
    });
    const value = wrapper.get('[data-testid="stats-duration-value"]');
    // `title` used to carry the exact value to assistive tech; `aria-describedby` at the popover
    // is the replacement, and `tabindex` is what makes it reachable without a pointer.
    expect(value.attributes('tabindex')).toBe('0');
    const describedBy = value.attributes('aria-describedby');
    expect(describedBy).toBeTruthy();

    await value.trigger('focus');
    const tip = tipRoot()!;
    expect(tip.getAttribute('role')).toBe('tooltip');
    expect(tip.getAttribute('id')).toBe(describedBy);

    await value.trigger('blur');
    expect(tipOpen()).toBe(false);
  });

  it('PR-STATS-041c: a cancelled gesture or an aside scroll closes the popover', async () => {
    const wrapper = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1 } }) },
    });
    const value = wrapper.get('[data-testid="stats-duration-value"]');

    // A touch drag starting on the card fires `pointercancel`, never `pointerleave`.
    await value.trigger('pointerenter', { clientX: 10, clientY: 20 });
    expect(tipOpen()).toBe(true);
    await value.trigger('pointercancel');
    expect(tipOpen()).toBe(false);

    // Wheel-scrolling the body slides the card out from under a pointer-pinned popover.
    await value.trigger('pointerenter', { clientX: 10, clientY: 20 });
    expect(tipOpen()).toBe(true);
    await wrapper.get('.pr-aside__body').trigger('scroll');
    expect(tipOpen()).toBe(false);
  });

  it('PR-STATS-041d: a column label only opens the tooltip while it is cut', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          computeCard: { sides: [{ side: 'aic', measuredTflops: 100, peakTflops: 200 }] },
        }),
      },
    });
    const label = wrapper.get('[data-testid="stats-compute-aic"] .pr-bw-col__side');

    // Fully visible: echoing the label back is noise.
    setLabelTruncation(label.element, false);
    await label.trigger('pointerenter', { clientX: 10, clientY: 20 });
    expect(tipOpen()).toBe(false);

    // Ellipsized: the truncation escape hatch PR-STATS-036 promises.
    setLabelTruncation(label.element, true);
    await label.trigger('pointerenter', { clientX: 10, clientY: 20 });
    expect(tipPart('stats-card-tooltip-value')).toBe('Cube');
    expect(tipPart('stats-card-tooltip-hint')).toBeNull();
    // Nothing extra for AT to hear: the label text is in the DOM behind the ellipsis either way.
    expect(label.attributes('tabindex')).toBeUndefined();
    expect(label.attributes('aria-describedby')).toBeUndefined();

    // It closes again if the column widens under the pointer instead of stranding the echo.
    setLabelTruncation(label.element, false);
    await label.trigger('pointermove', { clientX: 12, clientY: 22 });
    expect(tipOpen()).toBe(false);
  });

  it('PR-STATS-041f: the popover is teleported to `body`, clear of the panel that covered it', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toContain('<Teleport to="body">');
    // The layering the teleport escapes: the aside slot is z-index 0 and the timeline panel 1, so
    // every tip that flipped left of the seam was painted over for the width of the overlap.
    const { default: reportLayout } = (await import('../ReportLayout/ReportLayout.vue?raw')) as {
      default: string;
    };
    const rule = (sel: string) =>
      new RegExp(`${sel}\\s*\\{([^}]*)\\}`).exec(reportLayout)?.[1] ?? '';
    expect(rule('\\.pr-main')).toContain('z-index: 1');
    expect(rule('\\.pr-layout__aside')).toContain('z-index: 0');

    const wrapper = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1 } }) },
    });
    await hoverCardTip(wrapper, '[data-testid="stats-duration-value"]');

    expect(tipRoot()?.parentElement).toBe(document.body);
    expect(wrapper.element.contains(tipRoot())).toBe(false);
    expect(tipRoot()?.closest('.pr-layout__aside')).toBeNull();
    expect(tipRoot()?.closest('.pr-main')).toBeNull();
    // Still anchored by the same viewport-space inline style, just from a higher context.
    expect(tipRoot()?.getAttribute('style')).toMatch(/(left|right): \d+px/);
  });

  it('PR-STATS-041e: both tooltip lines are white, the value leading on weight', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    const rule = (selector: string) =>
      new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(src)?.[1] ?? '';

    expect(rule('\\.pr-stat-tip')).toContain('color: #ffffff');
    // The hint is a full sentence, so it keeps contrast with the value instead of the timeline
    // tip's muted `#969696`; only the weight (600) separates the two lines.
    expect(rule('\\.pr-stat-tip__hint')).toContain('color: #ffffff');
    expect(rule('\\.pr-stat-tip__value')).toContain('font-weight: 600');
  });

  it('PR-STATS-011c: AICore clamps out-of-range fractions for score and bar', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: {
            taskDurationUs: 1,
            parallelUtilization: 1.5,
            parallelBalance: -0.42,
          },
        }),
      },
    });
    const utilScore = wrapper.get('[data-testid="stats-aicore-util-score"]');
    expect(utilScore.get('.pr-card__num').text()).toBe('100.00');
    expect(await hoverCardTip(wrapper, '[data-testid="stats-aicore-util-score"]')).toEqual({
      value: cardTipValue('150%'),
      hint: t('parallelUtilHint'),
    });
    expect(wrapper.get('[data-testid="stats-aicore-util-bar"]').attributes('style')).toMatch(
      /width:\s*100%/,
    );
    const balScore = wrapper.get('[data-testid="stats-aicore-balance-score"]');
    expect(balScore.get('.pr-card__num').text()).toBe('0.00');
    expect(await hoverCardTip(wrapper, '[data-testid="stats-aicore-balance-score"]')).toEqual({
      value: cardTipValue('-42%'),
      hint: t('parallelBalanceHint'),
    });
    expect(wrapper.get('[data-testid="stats-aicore-balance-bar"]').attributes('style')).toMatch(
      /width:\s*0%/,
    );
  });

  it('PR-STATS-011c: AICore shows a single column when only one parallel field is set', () => {
    const utilOnly = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1, parallelUtilization: 0.5 },
        }),
      },
    });
    expect(utilOnly.find('[data-testid="stats-aicore-util"]').exists()).toBe(true);
    expect(utilOnly.find('[data-testid="stats-aicore-balance"]').exists()).toBe(false);
    expect(utilOnly.get('[data-testid="stats-aicore-util-score"]').text()).toMatch(/50\.00\s*%/);

    const balanceOnly = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1, parallelBalance: 0.75 },
        }),
      },
    });
    expect(balanceOnly.find('[data-testid="stats-aicore-util"]').exists()).toBe(false);
    expect(balanceOnly.find('[data-testid="stats-aicore-balance"]').exists()).toBe(true);
    expect(balanceOnly.get('[data-testid="stats-aicore-balance-score"]').text()).toMatch(
      /75\.00\s*%/,
    );
  });

  it('PR-STATS-011b: BW-only summary hides compute/util placeholders', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: {},
          computeCard: {
            sides: [{ side: 'aiv', measuredTflops: 15, peakTflops: 30 }],
          },
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
    expect(wrapper.find('[data-testid="stats-bandwidth-card"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-bandwidth-read"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-bandwidth-write"]').exists()).toBe(true);
  });

  it('PR-STATS-024: bandwidth util card with 读|写 columns, GB/s, bar = score%', async () => {
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
    const card = wrapper.get('[data-testid="stats-bandwidth-card"]');
    expect(card.classes()).toContain('pr-card');
    expect(card.text()).toMatch(/带宽利用率|Bandwidth utilization/);
    expect(card.find('.pr-bw-cols').exists()).toBe(true);
    const read = card.get('[data-testid="stats-bandwidth-read"]');
    expect(read.text()).toMatch(/读|Read/);
    // DATA-8: read = aic + aiv = 80 + 90 = 170 → score round(170/1600×100) = 11
    expect(read.get('[data-testid="stats-bandwidth-read-score"]').text()).toMatch(/11/);
    expect(read.text()).toMatch(/170\.0 \/ 1600\.0\s*GB\/s/);
    expect(await hoverCardTip(wrapper, '[data-testid="stats-bandwidth-read"] .pr-card__sub')).toEqual({
      value: cardTipValue('170 / 1600 GB/s'),
      hint: t('bandwidthRatioHint').replace('{dir}', t('bwRead')),
    });
    expect(read.get('[data-testid="stats-bandwidth-read-bar"]').attributes('style')).toMatch(
      /width:\s*11%/,
    );
    const write = card.get('[data-testid="stats-bandwidth-write"]');
    expect(write.text()).toMatch(/写|Write/);
    expect(write.text()).toMatch(/1\.56 \/ 1600\.0\s*GB\/s/);
  });

  it('PR-STATS-024: out.rep cards use 1600 GB/s peak (~1% score), not max of measured', () => {
    const { reportModel } = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(StatsAside, { props: { report: reportModel } });
    const read = wrapper.get('[data-testid="stats-bandwidth-read"]');
    expect(read.get('[data-testid="stats-bandwidth-read-score"]').text()).toMatch(/1/);
    expect(read.text()).toMatch(/GB\/s/);
    expect(read.text()).not.toMatch(/TB\/s/);
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
    const roofReport = report({
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
    });

    const withRoof = mount(StatsAside, {
      props: { capabilities: ['roofline'], report: roofReport },
    });
    expect(withRoof.find('[data-testid="stats-roofline"]').exists()).toBe(true);
    expect(withRoof.find('[data-testid="roofline-panel"]').exists()).toBe(true);

    // Phase 2 opt-in: the current release hides the card, points or not.
    const unflagged = mount(StatsAside, { props: { report: roofReport } });
    expect(unflagged.find('[data-testid="stats-roofline"]').exists()).toBe(false);

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
    expect(wrapper.get('[data-testid="stats-compute"]').classes()).toContain('pr-aside__detail--overlay');
    // Stack stays mounted under the opaque overlay so leave can fade out over it (PR-STATS-039).
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
  });

  it('PR-STATS-017: topology 详情 shows memory CSV overlay', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          // All scope (DATA-19 / DATA-29): the diagram reads the summary.jsonl category mean.
          summaryCategories: [
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ],
          csvTexts: { 'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n' },
        }),
      },
    });
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
  });

  it('PR-STATS-017b: topology right-click opens memory CSV overlay (UI-35)', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          // All scope (DATA-19 / DATA-29): the diagram reads the summary.jsonl category mean.
          summaryCategories: [
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ],
          // The adapter's `All` snapshot (PR-VM-012) — the aside reads it, it does not derive it.
          memoryTopology: buildMemoryTopologyFromCategories([
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ])!,
          csvTexts: { 'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n' },
        }),
      },
    });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    await wrapper.get('[data-testid="memory-topology-panel"]').trigger('contextmenu');
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

  it('PR-STATS-019: topology section when the model is drawable; hidden when absent', () => {
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

    // Labels on plated-less edges only (`l0c-l1` KB lives in the 详情 tabs, PR-MEMTOP-009): the
    // diagram and **全屏** stay out, exactly as for an absent model.
    const slotlessOnly = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTopology: {
            nodes: [{ id: 'l0c', label: 'L0C' }, { id: 'l1', label: 'L1' }],
            edges: [{ id: 'l0c-l1', from: 'l0c', to: 'l1', label: '7.00 KB' }],
          },
        }),
      },
    });
    expect(slotlessOnly.find('[data-testid="stats-topology"]').exists()).toBe(false);
    expect(slotlessOnly.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
    expect(slotlessOnly.find('[data-testid="topology-fullscreen"]').exists()).toBe(false);

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

    // All scope = the summary.jsonl aggregate (DATA-28), not one block's CSV row. The aside reads
    // the adapter's `All` snapshot (PR-VM-012), so the fixture has to carry it.
    const memoryReport = (value: string) => {
      const categories = [
        { id: 'Memory', title: 'Memory', fields: [{ key: 'aiv_main_mem_read_bw(GB/s)', value }] },
      ];
      return report({
        summary: { taskDurationUs: 1 },
        summaryCategories: categories,
        memoryTopology: buildMemoryTopologyFromCategories(categories)!,
      });
    };
    const stale = memoryReport('2.5');
    const swapped = mount(StatsAside, { props: { report: stale } });
    expect(swapped.text()).toContain('2.50 GB/s');
    await swapped.setProps({ report: memoryReport('1.56') });
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
          // UI-49: the in-box badges live in `PipeUtilization.csv`, so the picked-block rebuild gets
          // them only because the aside joins the compute table to the Memory* ones.
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aiv_vec_ratio'],
              rows: [
                { block_id: '0', aiv_vec_ratio: '0.5' },
                { block_id: '1', aiv_vec_ratio: '0.9' },
              ],
              blockIds: ['0', '1'],
            },
          ],
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

    // UI-49: the picked-block rebuild joins `PipeUtilization.csv` to the Memory* tables, so block 0
    // brings its own in-box badge back — the pipe ratio × 100 (DATA-28).
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    await wrapper.get('[data-testid="csv-block"]').setValue('0');
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.get('[data-testid="edge-gm-l2-read-0"]').text()).toBe('1.56 GB/s');
    expect(wrapper.get('[data-testid="plate-vec-0"]').text()).toBe('50.00%');
  });

  it('PR-STATS-022: CSV tab fallback does not rewrite topology block', async () => {
    const tables = [
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
    ];
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: tables,
          // CSV-only pack (no summary.jsonl): All falls back to the first labelled block — the
          // adapter's snapshot rule (PR-VM-012), which the aside reads instead of re-deriving.
          memoryTopology: firstLabelledMemoryTopology(tables)!.model,
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
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': 'NA' }],
              blockIds: ['0'],
            },
          ],
          csvTexts: { 'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,NA\n' },
        }),
      },
    });
    expect(wrapper.find('[data-testid="stats-topology"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('MemoryL1');
  });

  it('PR-STATS-035: memory 详情 CSV field list also offers the PipeUtilization tab (UI-38)', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aic_mte1_ratio', 'aic_mte2_ratio', 'aiv_mte3_ratio'],
              rows: [
                {
                  block_id: '0',
                  aic_mte1_ratio: '0.28',
                  aic_mte2_ratio: '0.65',
                  aiv_mte3_ratio: '0.14',
                },
              ],
              blockIds: ['0'],
            },
          ],
          csvTexts: {
            'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n',
            'PipeUtilization.csv':
              'block_id,aic_mte1_ratio,aic_mte2_ratio,aiv_mte3_ratio\n0,0.28,0.65,0.14\n',
          },
        }),
      },
    });

    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    expect(wrapper.find('[data-testid="csv-tab-Memory.csv"]').exists()).toBe(true);
    // MTE utilizations are readable here; the export gives MTE no value plate, so the diagram
    // stays exactly as designed (no MTE slot).
    await wrapper.get('[data-testid="csv-tab-PipeUtilization.csv"]').trigger('click');
    expect(wrapper.text()).toContain('aic_mte2_ratio');
    expect(wrapper.text()).toContain('aiv_mte3_ratio');
  });

  it('PR-STATS-035 boundary: memory summary categories win, so no PipeUtilization tab there', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          summaryCategories: [
            { id: 'Memory', title: 'Memory', fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }] },
            {
              id: 'PipeUtilization',
              title: 'PipeUtilization',
              fields: [{ key: 'aic_mte2_ratio', value: '0.65' }],
            },
          ],
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          computeTables: [
            {
              fileName: 'PipeUtilization.csv',
              headers: ['block_id', 'aic_mte2_ratio'],
              rows: [{ block_id: '0', aic_mte2_ratio: '0.65' }],
              blockIds: ['0'],
            },
          ],
        }),
      },
    });

    await wrapper.get('[data-testid="topology-details"]').trigger('click');
    // The memory surface renders the category list it has, memory files only — the compute
    // category is served by 计算 详情, not duplicated here (PR-STATS-035).
    expect(wrapper.find('[data-testid="summary-category-list"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="summary-category-tab-Memory"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="summary-category-tab-PipeUtilization"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="csv-tab-PipeUtilization.csv"]').exists()).toBe(false);
  });

  it('PR-STATS-033: header is cannbot + 详情; 全屏 lives in the diagram bar, hidden with it', () => {
    const withTopo = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          // All scope (DATA-19 / DATA-29): the diagram reads the summary.jsonl category mean.
          summaryCategories: [
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ],
          // The adapter's `All` snapshot (PR-VM-012) — the aside reads it, it does not derive it.
          memoryTopology: buildMemoryTopologyFromCategories([
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ])!,
          csvTexts: { 'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n' },
        }),
      },
    });
    const actions = withTopo.get('[data-testid="stats-topology"] .pr-pipe-head__actions');
    expect(actions.findAll('button').map((b) => b.attributes('data-testid'))).toEqual([
      'cannbot-memory',
      'topology-details',
    ]);
    // The bar's 全屏 is the aside's only fullscreen control (MemoryTopologyPanel PR-MEMTOP-014);
    // it sits inside the panel, after the zoom controls, and only when the aside asks for it.
    const bar = withTopo.get('[data-testid="topology-controls"]');
    expect(bar.findAll('button').map((b) => b.attributes('data-testid'))).toEqual([
      'topology-zoom-out',
      'topology-zoom-in',
      'topology-zoom-fit',
      'topology-fullscreen',
    ]);
    const fullscreen = bar.get('[data-testid="topology-fullscreen"]');
    expect(fullscreen.find('svg').exists()).toBe(true);
    expect(fullscreen.attributes('aria-label')).toBe('全屏');

    const without = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': 'NA' }],
              blockIds: ['0'],
            },
          ],
          summaryCategories: [
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: 'NA' }],
            },
          ],
        }),
      },
    });
    expect(without.find('[data-testid="topology-fullscreen"]').exists()).toBe(false);
    expect(without.find('[data-testid="topology-controls"]').exists()).toBe(false);
    expect(without.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
    expect(without.find('[data-testid="topology-details"]').exists()).toBe(true);
  });

  it('PR-STATS-034: 全屏 emits open-topology-fullscreen; does not open CSV overlay', async () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          summary: { taskDurationUs: 1 },
          memoryTables: [
            {
              fileName: 'Memory.csv',
              headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
              rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
              blockIds: ['0'],
            },
          ],
          // All scope (DATA-19 / DATA-29): the diagram reads the summary.jsonl category mean.
          summaryCategories: [
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ],
          // The adapter's `All` snapshot (PR-VM-012) — the aside reads it, it does not derive it.
          memoryTopology: buildMemoryTopologyFromCategories([
            {
              id: 'Memory',
              title: 'Memory',
              fields: [{ key: 'aiv_gm_to_ub_bw(GB/s)', value: '1.2' }],
            },
          ])!,
          csvTexts: { 'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n' },
        }),
      },
    });
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    const emitted = wrapper.emitted('open-topology-fullscreen');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]![0]).toMatchObject({
      edges: expect.arrayContaining([expect.objectContaining({ label: expect.any(String) })]),
    });
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(false);
  });

  it('PR-STATS-037: archDiagram Metric select sits above the diagram and rebuilds labels', async () => {
    const { topologyFromArchDiagramMetrics } = await import('../../adapters/emulateMemoryTopology');
    const archCsv = [
      'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
      '1,l2_cached_ratio,50',
      '2,hbm_to_l2_syn_gbs,1.5',
      '3,hbm_to_l2_syn_cnt,8',
      '4,hbm_to_l2_syn_ratio,0.25',
    ].join('\n');
    const topo = topologyFromArchDiagramMetrics(archCsv)!;
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          profile: 'emulate',
          memoryTopology: topo,
          csvTexts: { 'ArchDiagramMetrics.csv': archCsv },
          memoryTables: [
            {
              fileName: 'ArchDiagramMetrics.csv',
              headers: ['ArchDiagramId', 'ArchDiagramParameterName', 'ArchDiagramParameterValue'],
              rows: [],
              blockIds: [],
            },
          ],
        }),
        capabilities: ['archDiagram'],
      },
    });
    const switcher = wrapper.get('[data-testid="topology-metric-switcher"]');
    expect(switcher.text()).toContain('指标');
    expect(wrapper.get('[data-testid="topology-metric-select"]').attributes('data-value')).toBe(
      'bandwidth_per_operator',
    );
    expect(wrapper.text()).toContain('1.50 GB/s');
    await wrapper.get('[data-testid="topology-metric-select"] .pr-metric-select__trigger').trigger('click');
    const opt = document.querySelector(
      '[data-testid="topology-metric-option-number_of_requests"]',
    ) as HTMLElement | null;
    expect(opt).not.toBeNull();
    opt!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('8');
    expect(wrapper.text()).not.toContain('1.50 GB/s');
  });

  it('PR-STATS-037: archDiagram mode with no drawable plates hides diagram (no *_gbs fallback)', async () => {
    const { topologyFromArchDiagramMetrics } = await import('../../adapters/emulateMemoryTopology');
    // Operator BW only — no L2 peak, no *_cnt / *_ratio. Adapter snapshot is drawable; cnt mode is not.
    const archCsv = [
      'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
      '1,hbm_to_l2_syn_gbs,1.5',
    ].join('\n');
    const topo = topologyFromArchDiagramMetrics(archCsv)!;
    expect(topo).toBeDefined();
    const wrapper = mount(StatsAside, {
      props: {
        report: report({
          profile: 'emulate',
          memoryTopology: topo,
          csvTexts: { 'ArchDiagramMetrics.csv': archCsv },
          memoryTables: [
            {
              fileName: 'ArchDiagramMetrics.csv',
              headers: ['ArchDiagramId', 'ArchDiagramParameterName', 'ArchDiagramParameterValue'],
              rows: [],
              blockIds: [],
            },
          ],
        }),
        capabilities: ['archDiagram'],
      },
    });
    expect(wrapper.find('[data-testid="stats-topology"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('1.50 GB/s');
    await wrapper.get('[data-testid="topology-metric-select"] .pr-metric-select__trigger').trigger('click');
    const opt = document.querySelector(
      '[data-testid="topology-metric-option-number_of_requests"]',
    ) as HTMLElement | null;
    expect(opt).not.toBeNull();
    opt!.click();
    await wrapper.vm.$nextTick();
    // DATA-30: hide plates only — Metric switcher stays so 算子带宽 is reachable again.
    expect(wrapper.find('[data-testid="stats-topology"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('1.50 GB/s');
    expect(wrapper.find('[data-testid="topology-metric-switcher"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(false);
    await wrapper.get('[data-testid="topology-metric-select"] .pr-metric-select__trigger').trigger('click');
    const back = document.querySelector(
      '[data-testid="topology-metric-option-bandwidth_per_operator"]',
    ) as HTMLElement | null;
    expect(back).not.toBeNull();
    back!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="stats-topology"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('1.50 GB/s');
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

  it('PR-STATS-028: orange top wash sits under the header inside the aside', async () => {
    const wrapper = mount(StatsAside, {
      props: { report: report({ summary: { taskDurationUs: 1 } }) },
    });
    const wash = wrapper.find('[data-testid="aside-wash"]');
    expect(wash.exists()).toBe(true);
    const aside = wrapper.find('[data-testid="stats-aside"]');
    expect(aside.element.contains(wash.element)).toBe(true);
    expect(aside.element.firstElementChild).toBe(wash.element);

    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-aside__wash[\s\S]*?height:\s*96px/);
    expect(src).toMatch(
      /\.pr-aside__wash[\s\S]*?linear-gradient\(\s*181\.55deg,\s*rgba\(244,\s*132,\s*12,\s*0\.1\)\s*-20\.986%/,
    );
    expect(src).toMatch(/\.pr-aside__wash[\s\S]*?pointer-events:\s*none/);
  });

  it('PR-STATS-029: stacked body scrolls vertically only (no horizontal bar)', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-aside__body\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(src).toMatch(/\.pr-aside__body\s*\{[^}]*overflow-y:\s*auto/s);
    expect(src).not.toMatch(/\.pr-aside__body\s*\{[^}]*overflow:\s*auto/s);
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
        capabilities: ['roofline'],
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

  it('PR-STATS-039: detail overlays use a 200ms opacity-only transition covering header + body', async () => {
    const src = (await import('./StatsAside.vue?raw')).default as string;
    expect(src).toMatch(/<Transition[^>]*name="pr-aside-detail"/);
    expect(src).toMatch(
      /\.pr-aside-detail-enter-active,\s*\.pr-aside-detail-leave-active\s*\{[^}]*transition:\s*opacity\s+200ms\s+ease/s,
    );
    expect(src).toMatch(/\.pr-aside-detail-enter-from,\s*\.pr-aside-detail-leave-to\s*\{[^}]*opacity:\s*0/s);
    expect(src).not.toMatch(/\.pr-aside-detail-enter-from[\s\S]*?scale\(/);
    expect(src).toMatch(/\.pr-aside-detail-leave-active\s*\{[^}]*pointer-events:\s*none/s);
    expect(src).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?\.pr-aside-detail-enter-active/);
    // Overlay owns back + title so they fade with the tables.
    expect(src).toMatch(
      /pr-aside__detail--overlay[\s\S]*?data-testid="stats-aside-back"[\s\S]*?detailTitle/s,
    );

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
        }),
      },
    });
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    const overlay = wrapper.get('[data-testid="stats-compute"]');
    expect(overlay.classes()).toContain('pr-aside__detail--overlay');
    expect(overlay.find('[data-testid="stats-aside-back"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
    await wrapper.get('[data-testid="stats-aside-back"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
  });

  it('PR-STATS-006c: performance-hints title-row trigger renders once and emits open-performance-hints', async () => {
    const hintsReport = {
      ...emptyReportViewModel(),
      summary: { taskDurationUs: 1 },
      performanceHints: [{ message: 'hint', origin: 'kernel' as const }],
    };
    const summary = mount(StatsAside, {
      props: { capabilities: ['performanceHints'], report: hintsReport },
    });
    expect(summary.find('[data-testid="stats-performance-hints"]').exists()).toBe(false);
    expect(summary.findAll('[data-testid="performance-hints-trigger"]')).toHaveLength(1);
    // Title-row placement: trigger precedes the close control.
    const trigger = summary.get('[data-testid="performance-hints-trigger"]').element;
    const close = summary.get('[data-testid="stats-aside-close"]').element;
    expect(
      trigger.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(summary.get('[data-testid="performance-hints-trigger"]').text()).toBe('性能分析');

    const csvOnly = mount(StatsAside, {
      props: { capabilities: ['performanceHints'], report: { ...csvOnlyEntryReport(), performanceHints: hintsReport.performanceHints } },
    });
    expect(csvOnly.findAll('[data-testid="performance-hints-trigger"]')).toHaveLength(1);

    await csvOnly.get('[data-testid="performance-hints-trigger"]').trigger('click');
    expect(csvOnly.emitted('open-performance-hints')).toHaveLength(1);
  });

  it('PR-STATS-006c: performance-hints title-row trigger omitted on overlay shells', async () => {
    const hints = [{ message: 'hint', origin: 'kernel' as const }];
    const wrapper = mount(StatsAside, {
      props: {
        capabilities: ['performanceHints'],
        report: report({
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
          performanceHints: hints,
        }),
      },
    });
    expect(wrapper.find('[data-testid="performance-hints-trigger"]').exists()).toBe(true);
    await wrapper.get('[data-testid="pipe-details"]').trigger('click');
    // Overlay keeps the report-shell close (inert under the overlay) but drops the hints link.
    expect(wrapper.find('[data-testid="performance-hints-trigger"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside-close"]').exists()).toBe(true);
  });

  it('PR-STATS-006c: performance-hints entry hidden without the capability', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          ...emptyReportViewModel(),
          summary: { taskDurationUs: 1 },
          performanceHints: [{ message: 'hint', origin: 'kernel' as const }],
        },
      },
    });
    expect(wrapper.find('[data-testid="performance-hints-trigger"]').exists()).toBe(false);
  });
});
