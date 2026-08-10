import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RooflinePanel from './RooflinePanel.vue';
import type { RooflineViewModel } from '../../../domain/types';

const sample: RooflineViewModel = {
  points: [
    {
      id: 'gm',
      label: 'GM Read + Write',
      intensity: 0.09,
      performance: 0.0023,
      style: 'solid',
    },
  ],
  mixLabels: [
    { id: 'fp32', label: 'Vec_FP32', percent: 84.1 },
    { id: 'misc', label: 'Vec_MISC', percent: 15.9 },
  ],
  peakComputeTops: 1,
  peakBandwidthGBs: 16.9,
};

describe('RooflinePanel', () => {
  it('PR-ROOF-001: renders chart with point and roof', () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    expect(wrapper.find('[data-testid="roofline-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="roofline-chart"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="roofline-roof"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="roofline-point"]')).toHaveLength(1);
  });

  it('PR-ROOF-002: shows mix labels', () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    const mix = wrapper.find('[data-testid="roofline-mix"]');
    expect(mix.exists()).toBe(true);
    expect(mix.text()).toContain('Vec_FP32');
    expect(mix.text()).toContain('Vec_MISC');
  });

  it('PR-ROOF-003: empty points → no chart', () => {
    const wrapper = mount(RooflinePanel, {
      props: {
        model: { ...sample, points: [] },
      },
    });
    expect(wrapper.find('[data-testid="roofline-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="roofline-chart"]').exists()).toBe(false);
  });

  it('PR-ROOF-004: hover point shows tooltip', async () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    await wrapper.get('[data-testid="roofline-point"]').trigger('mouseenter');
    const tip = wrapper.find('[data-testid="roofline-tooltip"]');
    expect(tip.exists()).toBe(true);
    expect(tip.text()).toContain('Ops/Byte');
    expect(tip.text()).toContain('TOps/s');
  });
});
