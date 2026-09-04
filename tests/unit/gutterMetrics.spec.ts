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

  it('PR-GMET-002: default is clockCycle, else utilization', () => {
    expect(defaultGutterMetric(['utilization'])).toBe('utilization');
    expect(defaultGutterMetric(['clockCycle', 'utilization'])).toBe('clockCycle');
  });

  it('PR-GMET-003: clockCycle barWidth normalizes to max lane', () => {
    const rows = parsePipeRows(
      [
        'block_id,aiv_vec_time(us),aiv_scalar_time(us)',
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
    expect(bars.get('vec')?.barWidth).toBe(100);
    expect(bars.get('sc')?.barWidth).toBeCloseTo(50, 5);
    expect(bars.get('vec')?.relativeMax).toBe(true);
    expect(bars.get('sc')?.relativeMax).toBe(false);
    expect(bars.get('vec')?.label).toBe('10µs');
  });

  it('PR-GMET-008: clockCycle label keeps decimals when round would be 0', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_time(us),aiv_scalar_time(us)', '0,0.31,0.15'].join('\n'),
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
    expect(bars.get('vec')?.label).toBe('0.31µs');
    expect(bars.get('sc')?.label).toBe('0.15µs');
    // Folder mean (0.23) must not render as "0" on the thick bar.
    expect(bars.get('folder')?.label).toBe('0.23µs');
    expect(bars.get('vec')?.barWidth).toBe(100);
  });

  it('PR-GMET-003: tied clockCycle lanes get relativeMax false (all gray in UI)', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_time(us)', '0,10', '1,10'].join('\n'),
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
      ['block_id,aiv_vec_time(us),aiv_scalar_time(us)', '0,10,5'].join('\n'),
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
    expect(averageBarWidthForCard(cycleBars, 'clockCycle')).toBeCloseTo(75, 5);

    // Zero-width bar still counts toward ≥2 lanes (mean includes 0 → 50).
    const withZero = parsePipeRows(
      ['block_id,aiv_vec_time(us),aiv_scalar_time(us)', '0,10,0'].join('\n'),
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
              id: 'l1',
              name: 'Lane',
              events: [{ id: 'e1', name: 'busy', startTime: 0, duration: 400 }],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, [], 'utilization', 'card0');
    expect(bars.get('l1')).toMatchObject({ barWidth: 40, label: '40%', thresholdColor: true });
  });

  it('PR-GMET-005: clockCycle folder rollup means child values', () => {
    const rows = parsePipeRows(
      ['block_id,aiv_vec_time(us),aiv_scalar_time(us)', '0,10,4'].join('\n'),
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
    expect(bars.get('a')?.label).toBe('10µs');
    expect(bars.get('b')?.label).toBe('4µs');
    expect(bars.get('folder')?.label).toBe('7µs');
  });

  it('PR-GMET-006: ignores NA cells; mean-of-column-means for multi-column keys', () => {
    // Flat cell mean would be (10+10+100)/3 ≈ 40; mean-of-column-means is (10+100)/2 = 55.
    const rows = parsePipeRows(
      [
        'block_id,aic_mte2_time(us),aiv_mte2_time(us)',
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
    expect(bars.get('mte2')?.label).toBe('55µs');

    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const table = adapted.reportModel.computeTables.find((t) => t.fileName === 'PipeUtilization.csv');
    expect(table).toBeDefined();
    const fixtureRows = table!.rows;
    const metrics = availableGutterMetrics(
      adapted.swimlaneModel,
      fixtureRows,
      adapted.swimlaneModel.processes[0]!.id,
    );
    expect(metrics).toEqual(expect.arrayContaining(['clockCycle', 'utilization']));
    expect(metrics).not.toContain('cacheHit');
    expect(metrics).not.toContain('task');
  });
});
