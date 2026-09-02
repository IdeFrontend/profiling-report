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
  it('PR-GMET-001: omits clockCycle/cacheHit when CSV lacks columns', () => {
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [{ id: 'l1', name: 'Core0.Vec0/VECTOR', events: [{ id: 'e1', name: 'x', startTime: 0, duration: 100 }] }],
        },
      ],
    };
    expect(availableGutterMetrics(model, [], 'card0')).toEqual(['task', 'utilization']);
  });

  it('PR-GMET-002: default is clockCycle, else task, else utilization', () => {
    expect(defaultGutterMetric(['task', 'utilization'])).toBe('task');
    expect(defaultGutterMetric(['clockCycle', 'task', 'utilization'])).toBe('clockCycle');
    expect(defaultGutterMetric(['utilization'])).toBe('utilization');
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
    expect(bars.get('vec')?.label).toBe('10');
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
    expect(bars.get('vec')?.label).toBe('0.31');
    expect(bars.get('sc')?.label).toBe('0.15');
    // Folder mean (0.23) must not render as "0" on the thick bar.
    expect(bars.get('folder')?.label).toBe('0.23');
    expect(bars.get('vec')?.barWidth).toBe(100);
  });

  it('PR-GMET-003b: tied lanes get relativeMax false (all gray in UI)', () => {
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            { id: 'a', name: 'Core0.Vec0/VECTOR', events: [{ id: 'e1', name: 'x', startTime: 0, duration: 1 }] },
            { id: 'b', name: 'Core0.Vec1/VECTOR', events: [{ id: 'e2', name: 'y', startTime: 0, duration: 1 }] },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, [], 'task', 'card0');
    expect(bars.get('a')?.relativeMax).toBe(false);
    expect(bars.get('b')?.relativeMax).toBe(false);
  });

  it('PR-GMET-007: averageBarWidth is 50 for util; mean barWidth for relative metrics', () => {
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

  it('PR-GMET-005: task folder rollup sums child counts', () => {
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
                { id: 'a', name: 'A', events: [{ id: '1', name: 'x', startTime: 0, duration: 1 }] },
                { id: 'b', name: 'B', events: [{ id: '2', name: 'y', startTime: 0, duration: 1 }, { id: '3', name: 'z', startTime: 0, duration: 1 }] },
              ],
            },
          ],
        },
      ],
    };
    const bars = gutterBarsForCard(model, [], 'task', 'card0');
    expect(bars.get('folder')?.label).toBe('3');
    expect(bars.get('a')?.label).toBe('1');
    expect(bars.get('b')?.label).toBe('2');
  });

  it('PR-GMET-006: ignores NA cells when aggregating CSV means', () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const table = adapted.reportModel.computeTables.find((t) => t.fileName === 'PipeUtilization.csv');
    expect(table).toBeDefined();
    const rows = table!.rows;
    const metrics = availableGutterMetrics(adapted.swimlaneModel, rows, adapted.swimlaneModel.processes[0]!.id);
    expect(metrics).toContain('clockCycle');
    const bars = gutterBarsForCard(
      adapted.swimlaneModel,
      rows,
      'clockCycle',
      adapted.swimlaneModel.processes[0]!.id,
    );
    expect(bars.size).toBeGreaterThan(0);
  });
});
