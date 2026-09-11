import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MemoryTopologyPanel, {
  DEFAULT_MAX_W,
  SLOT_MAX_W,
  fitFontSize,
} from './MemoryTopologyPanel.vue';

const model = {
  nodes: [
    { id: 'gm', label: 'GM' },
    { id: 'l2', label: 'L2 Cache' },
    { id: 'cube', label: 'Cube' },
    { id: 'ub', label: 'UB' },
  ],
  edges: [
    { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '1.56 GB/s' },
    { id: 'l2-ub', from: 'l2', to: 'ub', label: '0.00 GB/s' },
    { id: 'vec-ub', from: 'vec', to: 'ub', label: '0.10 GB/s' },
    { id: 'ub-vec', from: 'ub', to: 'vec', label: '0.20 GB/s' },
    { id: 'gm-l2-write', from: 'gm', to: 'l2' },
    { id: 'l1-l0a', from: 'l1', to: 'l0a', label: '1.00 GB/s' },
    { id: 'l1-l0b', from: 'l1', to: 'l0b', label: '2.00 GB/s' },
    { id: 'l0a-cube', from: 'l0a', to: 'cube', label: '3.00 GB/s' },
    { id: 'l0b-cube', from: 'l0b', to: 'cube', label: '4.00 GB/s' },
    { id: 'l0c-cube', from: 'l0c', to: 'cube', label: '5.00 GB/s' },
    { id: 'cube-l0c', from: 'cube', to: 'l0c', label: '6.00 GB/s' },
    { id: 'l0c-l1', from: 'l0c', to: 'l1', label: '7 KB' },
    { id: 'l0c-l2', from: 'l0c', to: 'l2', label: '8 KB' },
  ],
};

/** Chrome geometry (448×540 units): GM x16–56, L2 x94–134, cluster rows x188–432. */
const CHROME = { gmRight: 56, l2Left: 94, l2Right: 134, clusterLeft: 188 };

describe('MemoryTopologyPanel', () => {
  it('PR-MEMTOP-001: renders the chrome asset and the L2 node anchor', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    const chrome = wrapper.get('image');
    expect(chrome.attributes('href')).toContain('memory-topology.svg');
    expect(chrome.attributes('width')).toBe('448');
    expect(chrome.attributes('height')).toBe('540');
    expect(wrapper.find('[data-testid="node-l2"]').exists()).toBe(true);
    expect(wrapper.get('svg').attributes('viewBox')).toBe('0 0 448 540');
  });

  it('PR-MEMTOP-002: renders data-driven edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
    // Two-slot edges get one element per slot (AIV0 + AIV1), and the slot index makes each
    // testid unique — a bare `edge-vec-ub` twice was ambiguous for `getByTestId`-style queries.
    expect(wrapper.find('[data-testid="edge-vec-ub-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edge-vec-ub-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edge-ub-vec-0"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="edge-ub-vec-1"]').exists()).toBe(true);
    for (const id of ['l1-l0a', 'l1-l0b', 'l0a-cube', 'l0b-cube', 'l0c-cube', 'cube-l0c']) {
      expect(wrapper.get(`[data-testid="edge-${id}-0"]`).text().length).toBeGreaterThan(0);
    }
  });

  it('PR-MEMTOP-002b: every drawn value has a unique testid', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const drawn = wrapper
      .findAll('[data-testid^="edge-"]')
      .map((el) => el.attributes('data-testid'));
    expect(drawn.length).toBeGreaterThan(1);
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('PR-MEMTOP-003: omits NA/missing edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const gmWrite = wrapper.findAll('[data-testid="edge-gm-l2-write-0"]');
    expect(gmWrite.length).toBe(1);
    expect(gmWrite[0]!.text()).not.toContain('GB/s');
  });

  it('PR-MEMTOP-004: hides diagram when model empty', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model: null } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-005: edge labels update when model changes', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
    await wrapper.setProps({
      model: {
        ...model,
        edges: [{ id: 'gm-l2-read', from: 'gm', to: 'l2', label: '9.99 GB/s' }],
      },
    });
    expect(wrapper.text()).toContain('9.99 GB/s');
    expect(wrapper.text()).not.toContain('1.56 GB/s');
  });

  it('PR-MEMTOP-006: edge labels sit in the pillar corridors', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          edges: [
            { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '16.89 GB/s' },
            { id: 'l2-ub', from: 'l2', to: 'ub', label: '16.76 GB/s' },
            { id: 'l2-l1-read', from: 'l2', to: 'l1', label: '1.20 GB/s' },
          ],
        },
      },
    });
    const x = (id: string): number =>
      Number(wrapper.get(`[data-testid="edge-${id}-0"]`).attributes('x'));

    // GM↔L2 labels sit between the GM pillar and the L2 pillar...
    expect(x('gm-l2-read')).toBeGreaterThan(CHROME.gmRight);
    expect(x('gm-l2-read')).toBeLessThan(CHROME.l2Left);
    // ...and L2↔cluster labels between the L2 pillar and the row stack. The export draws
    // these horizontally in the corridor (unlike the earlier redraw, which rotated them).
    for (const id of ['l2-ub', 'l2-l1-read']) {
      expect(x(id)).toBeGreaterThan(CHROME.l2Right);
      expect(x(id)).toBeLessThan(CHROME.clusterLeft);
    }
  });

  it('PR-MEMTOP-007: shows L2 Peak(%) when peakPct set', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          nodes: model.nodes.map((n) => (n.id === 'l2' ? { ...n, peakPct: 81.25 } : n)),
          edges: [
            ...model.edges,
            { id: 'l2-hit', from: 'l2', to: 'l2', label: '81.25%' },
          ],
        },
      },
    });
    expect(wrapper.get('[data-testid="node-l2-peak"]').text()).toBe('81.25%');
    expect(wrapper.text()).not.toMatch(/\bPeak\b/);
    expect(wrapper.find('[data-testid="edge-l2-hit"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="node-l2"]').classes()).toContain('pr-topo__l2');
  });

  it('PR-MEMTOP-007b: omits Peak chrome when peakPct absent', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.find('[data-testid="node-l2-peak"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-007c: falls back to the l2-hit label in the same plate', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          edges: [...model.edges, { id: 'l2-hit', from: 'l2', to: 'l2', label: '77.50%' }],
        },
      },
    });
    // No peakPct, so the one plate shows the hit rate and keeps the `l2-hit` testid.
    const plate = wrapper.get('[data-testid="edge-l2-hit"]');
    expect(plate.text()).toBe('77.50%');
    expect(wrapper.find('[data-testid="node-l2-peak"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="edge-l2-hit"]')).toHaveLength(1);
    expect(wrapper.find('svg').text()).not.toContain('77.50%77.50%');
  });

  it('PR-MEMTOP-008: right-click emits open-details', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    await wrapper.get('[data-testid="memory-topology-panel"]').trigger('contextmenu');
    expect(wrapper.emitted('open-details')).toHaveLength(1);
  });

  it('PR-MEMTOP-008b: right-click does not emit when openDetailsOnContextmenu is false', async () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: { model, openDetailsOnContextmenu: false },
    });
    await wrapper.get('[data-testid="memory-topology-panel"]').trigger('contextmenu');
    expect(wrapper.emitted('open-details')).toBeUndefined();
  });

  it('PR-MEMTOP-009: edges with no chrome slot are not drawn', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    // The export carries no KB plate, so L0C→L1 / L0C→GM datagrams stay in the 详情 tabs.
    expect(wrapper.findAll('[data-testid^="edge-l0c-l1"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid^="edge-l0c-l2"]')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('KB');
  });

  it('PR-MEMTOP-011: describes the drawn values to assistive tech', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const id = wrapper.get('svg').attributes('aria-describedby');
    expect(id).toBeTruthy();
    const summary = wrapper.get(`[id="${id}"]`);
    expect(summary.classes()).toContain('pr-topo__sr');
    // Node labels from the model, so the numbers are not bare text.
    expect(summary.text()).toContain('GM → L2 Cache: 1.56 GB/s');
    expect(summary.text()).toContain('L2 Cache:');
    // Only slots the diagram draws: `l0c-l1` / `l0c-l2` carry KB and have no plate.
    expect(summary.text()).not.toContain('KB');
    expect(summary.text()).not.toContain('7 KB');
  });

  it('PR-MEMTOP-011: gives each instance its own description id', () => {
    // The stacked aside and the fullscreen overlay render two panels in the *same* app, so a
    // hardcoded id would collide and point both diagrams at one description. `useId` is unique
    // per app, which two separate `mount()` calls would not reproduce (each is its own app).
    const Host = defineComponent({
      components: { MemoryTopologyPanel },
      props: { model: { type: Object, required: true } },
      template: `<div>
        <MemoryTopologyPanel :model="model" />
        <MemoryTopologyPanel :model="model" />
      </div>`,
    });
    const wrapper = mount(Host, { props: { model } });
    const ids = wrapper.findAll('svg').map((s) => s.attributes('aria-describedby'));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(wrapper.findAll('.pr-topo__sr')).toHaveLength(2);
    expect(wrapper.get(`[id="${ids[0]}"]`).text()).toBe(wrapper.get(`[id="${ids[1]}"]`).text());
    expect(wrapper.get(`[id="${ids[0]}"]`).text().length).toBeGreaterThan(0);
  });
});

describe('MemoryTopologyPanel value fit (PR-MEMTOP-010)', () => {
  /** Natural widths measured in Chrome for this panel's type (6.3px/800, system sans). */
  const WIDTHS: Record<string, number> = {
    '504.00 GB/s': 43.19,
    '12.34 GB/s': 37.33,
    '1.56 GB/s': 32.75,
    '100.00%': 31.11,
  };

  /** jsdom has no SVG text metrics; stand in for the browser's `getComputedTextLength`. */
  function stubMetrics(): () => void {
    const proto = SVGTextElement.prototype as unknown as Record<string, unknown>;
    const had = Object.prototype.hasOwnProperty.call(proto, 'getComputedTextLength');
    const prev = proto.getComputedTextLength;
    proto.getComputedTextLength = function (this: SVGTextElement) {
      return WIDTHS[this.textContent ?? ''] ?? 20;
    };
    return () => {
      if (had) proto.getComputedTextLength = prev;
      else delete proto.getComputedTextLength;
    };
  }

  it('keeps the base size while a value fits its corridor', () => {
    expect(fitFontSize(37.33, 'l2-ub')).toBe(6.3); // 37.33 ≤ the link bound
    expect(fitFontSize(43.19, 'l2-l1-read')).toBe(6.3);
    expect(fitFontSize(31.11, 'l2-peak')).toBe(6.3); // `100.00%` inside the 40-unit pillar
    expect(fitFontSize(0, 'gm-l2-read')).toBe(6.3); // blank slot
  });

  it('keeps every slot bound inside its own corridor', () => {
    // Walls measured off the export at each slot's own height band; a value is centred on its
    // slot, so the nearer wall binds. This covers *every* slot: the row stack's inner corridors
    // are much tighter than the pillars' and once shared a single (too generous) default.
    const CORRIDORS: Record<string, [number, number, number]> = {
      // slot: [left wall, slot centre, right wall]
      'gm-l2-read': [55.75, 74.5, 94],
      'gm-l2-write': [55.75, 75.3, 94],
      'l2-ub': [133.75, 159.7, 188],
      'ub-l2': [133.75, 160.4, 188],
      'l2-l1-read': [133.75, 159.7, 188],
      'l2-l1-write': [133.75, 159.7, 188],
      'ub-vec': [315, 338.2, 361],
      'vec-ub': [315, 338.2, 361],
      'l1-l0a': [217, 239.7, 262],
      'l1-l0b': [217, 240.1, 262],
      'l0a-cube': [282, 302.9, 322],
      'l0b-cube': [282, 302.9, 322],
      'cube-l0c': [353, 373.5, 394],
      'l0c-cube': [353, 373.5, 394],
      'l2-peak': [94, 113.8, 133.75],
    };
    expect(Object.keys(SLOT_MAX_W).sort()).toEqual(Object.keys(CORRIDORS).sort());
    for (const [slot, [left, centre, right]] of Object.entries(CORRIDORS)) {
      const half = SLOT_MAX_W[slot]! / 2;
      expect(centre - half, `${slot} left`).toBeGreaterThanOrEqual(left);
      expect(centre + half, `${slot} right`).toBeLessThanOrEqual(right);
    }
  });

  it('shrinks a value that outgrows the tight GM↔L2 corridor', () => {
    const tight = SLOT_MAX_W['gm-l2-read']!;
    expect(fitFontSize(43.19, 'gm-l2-read')).toBeCloseTo((tight / 43.19) * 6.3, 6);
    expect(fitFontSize(37.33, 'gm-l2-write')).toBeLessThan(6.3);
  });

  it('shrinks a value that outgrows a tight row-stack corridor', () => {
    // 43.19 units overflows L0B↔Cube / Cube↔L0C / L1↔L0A, which the old single default let pass.
    // (Values this wide are real: the sample fixture's GM↔L2 label is already `504.00 GB/s`.)
    for (const slot of ['l0b-cube', 'cube-l0c', 'l1-l0a', 'ub-vec']) {
      expect(fitFontSize(43.19, slot), slot).toBeLessThan(6.3);
      expect(fitFontSize(43.19, slot), slot).toBeCloseTo((SLOT_MAX_W[slot]! / 43.19) * 6.3, 6);
    }
    // …and a 3-digit value alone is enough to overflow the tightest of them.
    expect(fitFontSize(41.7, 'l0b-cube')).toBeLessThan(6.3);
    expect(fitFontSize(41.7, 'l0b-cube')).toBeCloseTo((SLOT_MAX_W['l0b-cube']! / 41.7) * 6.3, 6);
    // While the wide pillar corridors still hold those values at full size.
    expect(fitFontSize(43.19, 'l2-ub')).toBe(6.3);
  });

  it('falls back to the tightest bound for a slot the table forgets', () => {
    const tightest = Math.min(...Object.values(SLOT_MAX_W));
    expect(DEFAULT_MAX_W).toBe(tightest);
    expect(fitFontSize(DEFAULT_MAX_W, 'nope')).toBe(6.3);
    expect(fitFontSize(DEFAULT_MAX_W + 1, 'nope')).toBeLessThan(6.3);
  });

  it('PR-MEMTOP-010: applies the fitted size only to the over-wide label', async () => {
    const restore = stubMetrics();
    try {
      const wrapper = mount(MemoryTopologyPanel, {
        props: {
          model: {
            ...model,
            edges: [
              { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '504.00 GB/s' },
              { id: 'l2-ub', from: 'l2', to: 'ub', label: '1.56 GB/s' },
            ],
          },
        },
      });
      await nextTick();
      const wide = wrapper.get('[data-testid="edge-gm-l2-read-0"]');
      const fits = wrapper.get('[data-testid="edge-l2-ub-0"]');
      expect(wide.text()).toBe('504.00 GB/s');
      const px = /font-size:\s*([\d.]+)px/.exec(wide.attributes('style') ?? '')?.[1];
      expect(Number(px)).toBeCloseTo((SLOT_MAX_W['gm-l2-read']! / 43.19) * 6.3, 4);
      expect(fits.attributes('style') ?? '').not.toContain('font-size');
    } finally {
      restore();
    }
  });
});
