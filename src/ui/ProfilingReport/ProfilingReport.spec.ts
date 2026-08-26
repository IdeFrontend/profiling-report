import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import ProfilingReport from './ProfilingReport.vue';
import { emptyReportViewModel } from '../../adapters/adaptRep';
import type { SwimlaneModel } from '../../domain/types';

/** Two linked events, so the dock mounts its Relevent column. */
function depsModel(): SwimlaneModel {
  return {
    processes: [
      {
        id: 'p-0',
        name: 'Card0',
        threads: [
          {
            id: 't-0',
            name: 'Core0.Cube',
            events: [
              {
                id: 'a',
                name: 'A',
                startTime: 0,
                duration: 10,
                dependencies: { predecessors: [], successors: [{ tid: 't-0', index: 1 }] },
              },
              {
                id: 'b',
                name: 'B',
                startTime: 20,
                duration: 10,
                dependencies: { predecessors: [{ tid: 't-0', index: 0 }], successors: [] },
              },
            ],
          },
        ],
      },
    ],
    minTime: 0,
    maxTime: 1000,
  };
}

describe('ProfilingReport scaffold', () => {
  it('PR-ROOT-001, PR-SCAFFOLD-003: mounts report root with timeline chrome', () => {
    const wrapper = mount(ProfilingReport, {
      props: { title: 'scaffold' },
    });
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-tabs"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="tab-timeline"]').text()).toMatch(/时间线|Timeline/);
    expect(wrapper.get('[data-testid="profiling-report"]').attributes('data-font-family')).toBe(
      'system',
    );
  });

  it('PR-ROOT-007: fontFamily=harmony is exposed on the root for host A/B', () => {
    const wrapper = mount(ProfilingReport, {
      props: { title: 'harmony', fontFamily: 'harmony' },
    });
    expect(wrapper.get('[data-testid="profiling-report"]').attributes('data-font-family')).toBe(
      'harmony',
    );
  });

  it('PR-ROOT-006: top-left corner wash is 208×60 with blue fade gradient', async () => {
    const wrapper = mount(ProfilingReport, { props: { title: 'wash' } });
    expect(wrapper.find('[data-testid="corner-wash"]').exists()).toBe(true);
    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-root__corner-wash[\s\S]*?width:\s*208px/);
    expect(src).toMatch(/\.pr-root__corner-wash[\s\S]*?height:\s*60px/);
    expect(src).toMatch(
      /\.pr-root__corner-wash[\s\S]*?linear-gradient\(\s*90deg,\s*rgba\(0,\s*90,\s*219,\s*0\.1\)\s*3\.614%/,
    );
  });

  it('PR-ROOT-002: accepts pre-parsed model props', () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'external',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: emptyReportViewModel(),
      },
    });
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-axis"] [data-testid="axis-ruler"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="gutter-resize-handle"]').exists()).toBe(true);
  });

  it('PR-ROOT-003: switching dependency mode in the detail dock does not reload the page', async () => {
    const href = window.location.href;
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'deps-mode',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    (wrapper.vm as unknown as { selectEventById: (id: string) => void }).selectEventById('b');
    await nextTick();

    await wrapper
      .find('[data-testid="detail-relevant-direction-predecessors"]')
      .trigger('click');
    await nextTick();

    expect(window.location.href).toBe(href);
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    // Mode reached the walk: 'b' keeps its predecessor, the successor side is blank.
    expect(
      wrapper
        .find('[data-testid="detail-relevant-direction-predecessors"]')
        .attributes('aria-pressed'),
    ).toBe('true');
    expect(wrapper.find('[data-testid="detail-relevant-incoming-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="detail-relevant-outgoing-count"]').text()).toBe('0');
  });

  it('PR-STATS-006: aside close hides the stats panel', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'aside-close',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 100 },
        },
      },
    });
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    await wrapper.get('[data-testid="stats-aside-close"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="toggle-aside"]').attributes('aria-pressed')).toBe('false');
  });

  it('aside unavailable when only op name/type without duration or PIPE (I-Q6a)', () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'no-duration',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'relu', opType: 'vector' },
        },
      },
    });
    expect(wrapper.find('[data-testid="toggle-aside"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
  });

  it('toolbar lives in main column only (not full-width above aside)', () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'toolbar-column',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 100 },
        },
      },
    });
    const main = wrapper.find('.pr-main');
    expect(main.exists()).toBe(true);
    expect(main.find('[data-testid="report-toolbar"]').exists()).toBe(true);
    expect(main.find('[data-testid="time-axis"]').exists()).toBe(true);
    // Toolbar must not be a direct child of root sitting above the layout.
    const rootChildren = wrapper.find('[data-testid="profiling-report"]').element.children;
    const directToolbar = [...rootChildren].some(
      (el) => (el as HTMLElement).dataset?.testid === 'report-toolbar',
    );
    expect(directToolbar).toBe(false);
    expect(wrapper.find('.pr-layout__aside [data-testid="stats-aside"]').exists()).toBe(true);
  });

  it('PR-ROOT-005: multi-op npu-rep source renders OP selector and switches operator', async () => {
    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    const wrapper = mount(ProfilingReport, {
      props: { source: loadNpuRepBuffer() },
    });

    expect(wrapper.find('[data-testid="op-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op1');
    expect(wrapper.vm.selectedOperatorId).toBe('op1.npu.rep');

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const items = wrapper.findAll('[data-testid="op-item"]');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.text())).toEqual(['op1', 'op2']);
    expect(items[0].attributes('aria-selected')).toBe('true');
    await items[1].trigger('click');

    expect(wrapper.vm.selectedOperatorId).toBe('op2.npu.rep');
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op2');
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const after = wrapper.findAll('[data-testid="op-item"]');
    expect(after[1].attributes('aria-selected')).toBe('true');
  });

  it('PR-ROOT-005b: switching operator swaps models; re-select is a no-op', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swimA = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'ea', name: 'event-a', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    };
    const swimB = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'eb', name: 'event-b', startTime: 0, duration: 99 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 99,
    };
    const reportA = {
      ...emptyReportViewModel(),
      summary: { opName: 'alpha-op', taskDurationUs: 100 },
    };
    const reportB = {
      ...emptyReportViewModel(),
      summary: { opName: 'beta-op', taskDurationUs: 200 },
    };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swimA,
      reportModel: reportA,
      capabilities: ['roofline'],
      operators: [
        { id: 'a.npu.rep', label: 'a' },
        { id: 'b.npu.rep', label: 'b' },
      ],
      operatorReports: {
        'a.npu.rep': { swimlaneModel: swimA, reportModel: reportA, capabilities: ['roofline'] },
        'b.npu.rep': { swimlaneModel: swimB, reportModel: reportB, capabilities: ['dependencies'] },
      },
      selectedOperatorId: 'a.npu.rep',
    });

    try {
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      expect(wrapper.text()).toContain('alpha-op');
      expect(wrapper.find('[data-testid="profiling-report"]').attributes('data-capabilities')).toBe(
        'roofline',
      );

      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      expect(wrapper.vm.selectedOperatorId).toBe('b.npu.rep');
      expect(wrapper.text()).toContain('beta-op');
      expect(wrapper.find('[data-testid="profiling-report"]').attributes('data-capabilities')).toBe(
        'dependencies',
      );
      expect(wrapper.text()).not.toContain('alpha-op');

      const endBefore = wrapper.vm.viewState.endTime;
      wrapper.vm.viewState.searchQuery = 'keep-me';
      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      expect(wrapper.vm.viewState.searchQuery).toBe('keep-me');
      expect(wrapper.vm.viewState.endTime).toBe(endBefore);
    } finally {
      spy.mockRestore();
    }
  });
});
