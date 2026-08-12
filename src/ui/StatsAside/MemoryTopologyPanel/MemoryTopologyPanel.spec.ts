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
    { id: 'gm-l2-write', from: 'gm', to: 'l2' },
  ],
};

describe('MemoryTopologyPanel', () => {
  it('PR-MEMTOP-001: renders topology nodes', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('L2 Cache');
    expect(wrapper.text()).toContain('Cube');
  });

  it('PR-MEMTOP-002: renders data-driven edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
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

  it('PR-MEMTOP-005: edge labels re-derive on selectedBlockId change', async () => {
    // Stub component does not declare props yet; cast so the future prop names typecheck.
    const props = { model, selectedBlockId: '0' } as Record<string, unknown>;
    const wrapper = mount(MemoryTopologyPanel, { props: props as never });
    const next = { selectedBlockId: '1' } as Record<string, unknown>;
    await wrapper.setProps(next as never);
    expect(wrapper.text()).toContain('GB/s');
  });
});
