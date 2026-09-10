import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MultiSelectSummary from './MultiSelectSummary.vue';
import type { SwimEvent, SwimlaneModel } from '../../domain/types';

function ev(id: string, name: string, startTime: number, duration: number): SwimEvent {
  return { id, name, startTime, duration };
}

/** Three selected events plus one unselected `beta` so the model average differs. */
const selectedEvents: SwimEvent[] = [
  ev('a', 'alpha', 0, 100),
  ev('b', 'beta', 200, 300),
  ev('c', 'gamma', 600, 200),
];

const model: SwimlaneModel = {
  minTime: 0,
  maxTime: 2000,
  processes: [
    {
      id: 'p-0',
      name: 'Card0',
      threads: [
        {
          id: 't-0',
          name: 'Core0.Cube',
          events: [...selectedEvents, ev('d', 'beta', 1000, 100)],
        },
      ],
    },
  ],
};

function mountPanel(props: Partial<Record<string, unknown>> = {}) {
  return mount(MultiSelectSummary, {
    props: { selectedEvents, model, unit: 'ns', ...props },
  });
}

/** Row ids in render order, so sort assertions read as a sequence. */
function rowOrder(wrapper: ReturnType<typeof mountPanel>): string[] {
  return wrapper
    .findAll('tbody tr')
    .map((r) => r.attributes('data-testid')?.replace('multi-select-row-', '') ?? '');
}

describe('MultiSelectSummary', () => {
  it('PR-MSEL-001: header shows count and Slices tab label', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="multi-select-count"]').text()).toContain('3');
    expect(wrapper.get('[data-testid="multi-select-tab"]').text()).toBe('Slices (3)');
  });

  it('PR-MSEL-002: table lists every selected event across four columns', () => {
    const wrapper = mountPanel({ locale: 'en' });
    expect(wrapper.findAll('tbody tr')).toHaveLength(3);
    expect(wrapper.findAll('thead th')).toHaveLength(4);

    const headers = wrapper.findAll('thead th').map((h) => h.text());
    expect(headers[1]).toContain('Wall Duration');
    expect(headers[2]).toContain('Self time');
    expect(headers[3]).toContain('Average Wall Duration');

    // Wall Duration and Self time are the event's own duration (Q23 interim).
    expect(wrapper.get('[data-testid="multi-select-duration-a"]').text()).toContain('100 ns');
    expect(wrapper.get('[data-testid="multi-select-selfTime-a"]').text()).toContain('100 ns');
    // Average spans ALL model events named `beta` (300 + 100) / 2, not just the selected one.
    expect(wrapper.get('[data-testid="multi-select-avgDuration-b"]').text()).toContain('200 ns');
  });

  it('PR-MSEL-003: default sort is Wall Duration descending; header alternates asc and desc', async () => {
    const wrapper = mountPanel();
    expect(rowOrder(wrapper)).toEqual(['b', 'c', 'a']);
    expect(wrapper.get('[data-testid="multi-select-sort-duration"]').attributes('aria-sort')).toBe(
      'descending',
    );

    // A different column enters the cycle at ascending.
    await wrapper.get('[data-testid="multi-select-sort-name"]').trigger('click');
    expect(rowOrder(wrapper)).toEqual(['a', 'b', 'c']);

    await wrapper.get('[data-testid="multi-select-sort-name"]').trigger('click');
    expect(rowOrder(wrapper)).toEqual(['c', 'b', 'a']);

    // Third click returns to ascending; sorting never drops to selection order.
    await wrapper.get('[data-testid="multi-select-sort-name"]').trigger('click');
    expect(rowOrder(wrapper)).toEqual(['a', 'b', 'c']);
    expect(wrapper.get('[data-testid="multi-select-sort-name"]').attributes('aria-sort')).toBe(
      'ascending',
    );
  });

  it('PR-MSEL-003b: every header carries a sort icon; sorted column changes glyph direction', async () => {
    const wrapper = mountPanel();
    // Default: sortKey='duration' desc → duration shows ↓, other 3 show ↕.
    expect(wrapper.findAll('thead th [data-testid="sort-icon-none"]')).toHaveLength(3);
    expect(wrapper.find('[data-testid="sort-icon-desc"]').exists()).toBe(true);
    // No text glyph — drawn SVG only.
    expect(wrapper.find('thead th').text()).not.toContain('◇');

    // Click duration again (active, desc → asc).
    await wrapper.get('[data-testid="multi-select-sort-duration"]').trigger('click');
    expect(wrapper.find('[data-testid="sort-icon-asc"]').exists()).toBe(true);

    // Click a different column → that column goes asc, others neutral.
    await wrapper.get('[data-testid="multi-select-sort-name"]').trigger('click');
    expect(wrapper.find('[data-testid="sort-icon-asc"]').exists()).toBe(true);
    expect(wrapper.findAll('thead th [data-testid="sort-icon-none"]')).toHaveLength(3);

    // aria-sort still drives the colour change via CSS.
    const src = (await import('./MultiSelectSummary.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-multi-select__sort\[aria-sort='ascending'\]/);
    expect(src).toMatch(/\.pr-multi-select__sort\[aria-sort='descending'\]/);
  });

  it('PR-MSEL-004: numeric cells carry a bar proportional to the column max', () => {
    const wrapper = mountPanel();
    const bars = wrapper
      .get('[data-testid="multi-select-duration-b"]')
      .find('.pr-multi-select__bar-fill');
    // b is the longest (300) — full bar.
    expect(bars.attributes('style')).toContain('width: 100%');
    const shortest = wrapper
      .get('[data-testid="multi-select-duration-a"]')
      .find('.pr-multi-select__bar-fill');
    // 100 / 300.
    expect(shortest.attributes('style')).toMatch(/width:\s*33\./);
  });

  it('PR-MSEL-004b: an all-equal column fills every bar', () => {
    const flat = [ev('x', 'x', 0, 50), ev('y', 'y', 100, 50)];
    const wrapper = mountPanel({ selectedEvents: flat, model: null });
    for (const id of ['x', 'y']) {
      expect(
        wrapper
          .get(`[data-testid="multi-select-duration-${id}"]`)
          .find('.pr-multi-select__bar-fill')
          .attributes('style'),
      ).toContain('width: 100%');
    }
  });

  it('PR-MSEL-005: clicking a name emits select-single with the full event', async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-testid="multi-select-name-c"]').trigger('click');
    expect(wrapper.emitted('select-single')?.[0]).toEqual([selectedEvents[2]]);
  });

  it('PR-MSEL-006: header × emits close', async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-testid="multi-select-close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('PR-MSEL-007: dragging the top edge up grows the dock and clamps at the floor', async () => {
    const wrapper = mountPanel({ height: 247 });
    const handle = wrapper.get('[data-testid="multi-select-resize-handle"]');

    await handle.trigger('pointerdown', { button: 0, clientY: 800 });
    await handle.trigger('pointermove', { clientY: 700 });
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([347]);

    await handle.trigger('pointermove', { clientY: 4000 });
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([247]);

    const before = wrapper.emitted('update:height')?.length ?? 0;
    await handle.trigger('pointerup');
    await handle.trigger('pointermove', { clientY: 100 });
    expect(wrapper.emitted('update:height')?.length ?? 0).toBe(before);
  });

  it('PR-MSEL-008: the table body scrolls, not the dock', () => {
    const wrapper = mountPanel();
    // The dock is fixed at `height`; only the body claims the leftover and scrolls.
    expect(wrapper.find('.pr-multi-select__body').exists()).toBe(true);
    expect(wrapper.find('.pr-multi-select__table').exists()).toBe(true);
  });

  it('PR-MSEL-008: caps rendered rows but keeps the full selection count', () => {
    const largeSelection = Array.from({ length: 1001 }, (_, index) =>
      ev(`event-${index}`, `event-${index}`, index, index + 1),
    );
    const wrapper = mountPanel({ selectedEvents: largeSelection, model: null });

    expect(wrapper.get('[data-testid="multi-select-count"]').text()).toContain('1001');
    expect(wrapper.get('[data-testid="multi-select-visible-count"]').text()).toContain('1000 of 1001');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1000);
  });

  it('handles a 125001-event marquee without a spread-argument overflow', () => {
    const largeSelection = Array.from({ length: 125001 }, (_, index) =>
      ev(`event-${index}`, `event-${index}`, index, index + 1),
    );
    const wrapper = mountPanel({ selectedEvents: largeSelection, model: null });

    expect(wrapper.get('[data-testid="multi-select-visible-count"]').text()).toContain('1000 of 125001');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1000);
  }, 15_000);

  it('single marquee hit still renders a one-row table (spec edge case)', () => {
    const wrapper = mountPanel({ selectedEvents: [selectedEvents[0]] });
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('[data-testid="multi-select-tab"]').text()).toBe('Slices (1)');
  });

  it('long names keep the full text in title', () => {
    const long = ev('l', 'a'.repeat(200), 0, 10);
    const wrapper = mountPanel({ selectedEvents: [long], model: null });
    expect(wrapper.get('[data-testid="multi-select-name-l"]').attributes('title')).toBe(long.name);
  });
});
