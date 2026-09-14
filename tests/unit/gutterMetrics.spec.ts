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

  it('PR-GMET-003: clockCycle barWidth is share of report-wide leaf sum', () => {
    const rows = parsePipeRows(
      [
        'block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles',
        '0,10,5',
        '1,10,5',
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
            { id: 'vec', name: 'Core0.Vec0/VECTOR', events: [] },
            { id: 'sc', name: 'Core0.Vec0/SCALAR', events: [] },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    // T = 10 + 5 = 15
    expect(bars.get('vec')?.barWidth).toBeCloseTo((10 / 15) * 100, 5);
    expect(bars.get('sc')?.barWidth).toBeCloseTo((5 / 15) * 100, 5);
    expect(bars.get('vec')?.relativeMax).toBe(true);
    expect(bars.get('sc')?.relativeMax).toBe(false);
    expect(bars.get('vec')?.label).toBe('10');
    expect(bars.get('sc')?.label).toBe('5');
  });

  it('PR-GMET-003: report-wide denom spans all Cards', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles', '0,10,10'].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [{ id: 'vec', name: 'Core0.Vec0/VECTOR', events: [] }],
        },
        {
          id: 'card1',
          name: 'Card1',
          threads: [{ id: 'sc', name: 'Core0.Vec0/SCALAR', events: [] }],
        },
      ],
    };
    const bars0 = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    const bars1 = gutterBarsForCard(model, rows, 'clockCycle', 'card1');
    // T = 10 + 10 = 20 across both Cards
    expect(bars0.get('vec')?.barWidth).toBeCloseTo(50, 5);
    expect(bars1.get('sc')?.barWidth).toBeCloseTo(50, 5);
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
                { id: 'vec', name: 'Core0.Vec0/VECTOR', events: [] },
                { id: 'sc', name: 'Core0.Vec0/SCALAR', events: [] },
              ],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(bars.get('vec')?.label).toBe('1 502');
    expect(bars.get('sc')?.label).toBe('108');
    // Folder sums children
    expect(bars.get('folder')?.label).toBe('1 610');
  });

  it('PR-GMET-003: tied clockCycle lanes get relativeMax false (all gray in UI)', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_total_cycles', '0,10', '1,10'].join('\n'),
    );
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            { id: 'a', name: 'Core0.Vec0/VECTOR', events: [] },
            { id: 'b', name: 'Core0.Vec1/VECTOR', events: [] },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(bars.get('a')?.relativeMax).toBe(false);
    expect(bars.get('b')?.relativeMax).toBe(false);
  });

  it('PR-GMET-007: averageBarWidth is 50 for util; mean barWidth for clockCycle', () => {
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
    // barWidths 10/15*100 and 5/15*100 → mean 50
    expect(averageBarWidthForCard(cycleBars, 'clockCycle')).toBeCloseTo(50, 5);

    const withZero = parsePipeRows(
      ['block_id,aiv_vec_total_cycles,aiv_scalar_total_cycles', '0,10,0'].join('\n'),
    );
    const zeroBars = gutterBarsForCard(model, withZero, 'clockCycle', 'card0');
    expect(zeroBars.get('sc')?.barWidth).toBe(0);
    expect(averageBarWidthForCard(zeroBars, 'clockCycle')).toBeCloseTo(50, 5);
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
    // Folder mean includes idle child: (0.4 + 0) / 2 = 0.2 → 20%
    expect(bars.get('folder')).toMatchObject({ barWidth: 20, label: '20%' });
  });

  it('PR-GMET-005: clockCycle folder rollup sums child values', () => {
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
                { id: 'a', name: 'Core0.Vec0/VECTOR', events: [] },
                { id: 'b', name: 'Core0.Vec0/SCALAR', events: [] },
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
    // Folder bar = 14/14 of report leaves under this card only… leaves total T=14
    expect(bars.get('folder')?.barWidth).toBeCloseTo(100, 5);
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
          threads: [{ id: 'mte2', name: 'Core0.Cube/MTE2', events: [] }],
        },
      ],
    };
    const bars = gutterBarsForCard(model, rows, 'clockCycle', 'card0');
    expect(bars.get('mte2')?.label).toBe('55');

    // Fixture gap path: time + block totals → absolute cycles (no µs label).
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
            { id: 'vec', name: 'Core0.Vec0/VECTOR', events: [] },
            { id: 'sc', name: 'Core0.Vec0/SCALAR', events: [] },
          ],
        },
      ],
    };
    const derived = gutterBarsForCard(derivedModel, derivedRows, 'clockCycle', 'card0');
    // rate = 1000 cycles/µs → vec=100, sc=50
    expect(derived.get('vec')?.label).toBe('100');
    expect(derived.get('sc')?.label).toBe('50');
    expect(derived.get('vec')?.label).not.toMatch(/µs/);

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
