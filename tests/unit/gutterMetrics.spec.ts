import { describe, expect, it } from 'vitest';
import {
  availableGutterMetrics,
  averageBarWidthForCard,
  defaultGutterMetric,
  gutterBarsForCard,
} from '../../src/domain/gutterMetrics';
import type { SwimlaneModel } from '../../src/domain/types';
import { adaptRep, parseRep } from '../../src/index';
import { loadOutRepBytes } from '../helpers/fixtures';

function parsePipeRows(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const headers = lines[0]!.split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cols[i] ?? '').trim();
    });
    return row;
  });
}

describe('PR-GMET: gutter metrics', () => {
  it('PR-GMET-001: omits clockCycle when CSV lacks columns; empty Card has no modes', () => {
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [{ id: 'l1', name: 'Core0.Vec0/VECTOR', events: [{ id: 'e1', name: 'x', startTime: 0, duration: 100 }] }],
        },
        {
          id: 'empty',
          name: 'Empty',
          threads: [],
        },
      ],
    };
    expect(availableGutterMetrics(model, [], 'card0')).toEqual(['utilization']);
    expect(availableGutterMetrics(model, [], 'empty')).toEqual([]);
  });

  it('PR-GMET-002: default is utilization, else clockCycle, else null', () => {
    expect(defaultGutterMetric(['utilization'])).toBe('utilization');
    expect(defaultGutterMetric(['clockCycle'])).toBe('clockCycle');
    expect(defaultGutterMetric(['clockCycle', 'utilization'])).toBe('utilization');
    expect(defaultGutterMetric([])).toBeNull();
  });

  it('PR-GMET-003: barWidth is event coverage for both metrics; only labels differ', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles', '0,10,5'].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'vec',
              name: 'Core0.Vec0/VECTOR',
              events: [{ id: 'e1', name: 'x', startTime: 0, duration: 400 }],
            },
            {
              id: 'sc',
              name: 'Core0.Vec0/SCALAR',
              events: [{ id: 'e2', name: 'y', startTime: 0, duration: 200 }],
            },
          ],
        },
      ],
    };
    const util = gutterBarsForCard(model, rows, 'utilization', 'card0');
    const cycles = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(util.get('vec')?.barWidth).toBe(40);
    expect(util.get('sc')?.barWidth).toBe(20);
    expect(cycles.get('vec')?.barWidth).toBe(util.get('vec')?.barWidth);
    expect(cycles.get('sc')?.barWidth).toBe(util.get('sc')?.barWidth);
    expect(util.get('vec')?.label).toBe('40%');
    expect(cycles.get('vec')?.label).toBe('10');
    expect(cycles.get('sc')?.label).toBe('5');
    expect(cycles.get('vec')?.thresholdColor).toBe(true);
  });

  it('PR-GMET-008: clockCycle labels are bare cycle integers (no µs)', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles', '0,1502,108'].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'folder',
              name: '计算',
              events: [],
              children: [
                {
                  id: 'vec',
                  name: 'Core0.Vec0/VECTOR',
                  events: [{ id: 'e1', name: 'x', startTime: 0, duration: 500 }],
                },
                {
                  id: 'sc',
                  name: 'Core0.Vec0/SCALAR',
                  events: [{ id: 'e2', name: 'y', startTime: 0, duration: 100 }],
                },
              ],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(bars.get('vec')?.label).toBe('1 502');
    expect(bars.get('sc')?.label).toBe('108');
    expect(bars.get('folder')?.label).toBe('1 610');
    // Folder bar still mean coverage, same as utilization
    const util = gutterBarsForCard(model, rows, 'utilization', 'card0');
    expect(bars.get('folder')?.barWidth).toBe(util.get('folder')?.barWidth);
  });

  it('PR-GMET-007: averageBarWidth is 50 for both metrics', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles', '0,10,5'].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            { id: 'vec', name: 'Core0.Vec0/VECTOR', events: [] },
            { id: 'sc', name: 'Core0.Vec0/SCALAR', events: [] },
          ],
        },
      ],
    };
    const utilBars = gutterBarsForCard(model, [], 'utilization', 'card0');
    expect(averageBarWidthForCard(utilBars, 'utilization')).toBe(50);
    const cycleBars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(averageBarWidthForCard(cycleBars, 'clockCycle')).toBe(50);
  });

  it('PR-GMET-004: utilization uses event coverage and threshold flag', () => {
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'folder',
              name: '计算',
              events: [],
              children: [
                {
                  id: 'busy',
                  name: 'LaneBusy',
                  events: [{ id: 'e1', name: 'busy', startTime: 0, duration: 400 }],
                },
                {
                  id: 'idle',
                  name: 'LaneIdle',
                  events: [],
                },
              ],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, [], 'utilization', 'card0');
    expect(bars.get('busy')).toMatchObject({ barWidth: 40, label: '40%', thresholdColor: true });
    expect(bars.get('idle')).toMatchObject({ barWidth: 0, label: '0%', thresholdColor: true });
    expect(bars.get('folder')).toMatchObject({ barWidth: 20, label: '20%' });
  });

  it('PR-GMET-005: clockCycle folder label sums child cycles; bar stays util mean', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles', '0,10,4'].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'folder',
              name: '计算',
              events: [],
              children: [
                {
                  id: 'a',
                  name: 'Core0.Vec0/VECTOR',
                  events: [{ id: 'e1', name: 'x', startTime: 0, duration: 400 }],
                },
                {
                  id: 'b',
                  name: 'Core0.Vec0/SCALAR',
                  events: [{ id: 'e2', name: 'y', startTime: 0, duration: 200 }],
                },
              ],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(bars.get('a')?.label).toBe('10');
    expect(bars.get('b')?.label).toBe('4');
    expect(bars.get('folder')?.label).toBe('14');
    expect(bars.get('a')?.barWidth).toBe(40);
    expect(bars.get('b')?.barWidth).toBe(20);
    expect(bars.get('folder')?.barWidth).toBe(30);
  });

  it('PR-GMET-006: ignores NA; mean-of-column-means; derives cycles when only time+block totals exist', () => {
    const rows = parsePipeRows(
      [
        'block_id,aic_mte2_total_cycles,aiv_mte2_total_cycles',
        '0,10,NA',
        '1,10,NA',
        '2,NA,100',
      ].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'mte2',
              name: 'Core0.Cube/MTE2',
              events: [{ id: 'e1', name: 'x', startTime: 0, duration: 100 }],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(bars.get('mte2')?.label).toBe('55');

    const derivedRows = parsePipeRows(
      [
        'block_id,aiv_time(us),aiv_total_cycles,aiv_vec_time(us),aiv_scalar_time(us)',
        '0,1,1000,0.1,0.05',
      ].join('\n'),
    );
    const derivedModel: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'vec',
              name: 'Core0.Vec0/VECTOR',
              events: [{ id: 'e1', name: 'x', startTime: 0, duration: 100 }],
            },
            {
              id: 'sc',
              name: 'Core0.Vec0/SCALAR',
              events: [{ id: 'e2', name: 'y', startTime: 0, duration: 100 }],
            },
          ],
        },
      ],
    };
    const derived = gutterBarsForCard(derivedModel, derivedRows, 'clockCycle', 'card0');
    expect(derived.get('vec')?.label).toBe('100');
    expect(derived.get('sc')?.label).toBe('50');
    expect(derived.get('vec')?.label).not.toMatch(/µs/);

    // MIX derive: each side’s time × that side’s Hz, then mean (not one Hz for both times).
    const mixRows = parsePipeRows(
      [
        'block_id,aic_time(us),aic_total_cycles,aiv_time(us),aiv_total_cycles,aic_mte2_time(us),aiv_mte2_time(us)',
        '0,1,1000,1,2000,0.1,0.05',
      ].join('\n'),
    );
    const mixModel: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'mte2',
              name: 'Core0.Cube/MTE2',
              events: [{ id: 'e1', name: 'x', startTime: 0, duration: 100 }],
            },
          ],
        },
      ],
    };
    const mix = gutterBarsForCard(mixModel, mixRows, 'clockCycle', 'card0');
    // aic: 0.1×1000=100; aiv: 0.05×2000=100; mean=100 (single-side Hz would yield 75 or 150)
    expect(mix.get('mte2')?.label).toBe('100');

    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    expect(adapted.swimlaneModel).not.toBeNull();
    const table = adapted.reportModel.computeTables.find((t) => t.fileName === 'PipeUtilization.csv');
    expect(table).toBeDefined();
    const fixtureRows = table!.rows;
    const metrics = availableGutterMetrics(
      adapted.swimlaneModel!,
      fixtureRows,
      adapted.swimlaneModel!.processes[0]!.id,
    );
    expect(metrics).toEqual(expect.arrayContaining(['clockCycle', 'utilization']));
    expect(metrics).not.toContain('cacheHit');
    expect(metrics).not.toContain('task');
  });
});
