import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MemoryTopologyPanel from './MemoryTopologyPanel.vue';

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
    expect(wrapper.findAll('[data-testid="edge-vec-ub"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="edge-ub-vec"]')).toHaveLength(2);
    for (const id of ['l1-l0a', 'l1-l0b', 'l0a-cube', 'l0b-cube', 'l0c-cube', 'cube-l0c']) {
      expect(wrapper.get(`[data-testid="edge-${id}"]`).text().length).toBeGreaterThan(0);
    }
  });

  it('PR-MEMTOP-003: omits NA/missing edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const gmWrite = wrapper.findAll('[data-testid="edge-gm-l2-write"]');
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
    const x = (id: string): number => Number(wrapper.get(`[data-testid="edge-${id}"]`).attributes('x'));

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
    expect(wrapper.findAll('[data-testid="edge-l0c-l1"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="edge-l0c-l2"]')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('KB');
  });
});
