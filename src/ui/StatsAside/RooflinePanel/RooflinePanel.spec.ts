import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RooflinePanel from './RooflinePanel.vue';
import {
  ROOFLINE_CHART_H,
  ROOFLINE_CHART_W,
  ROOFLINE_MIX_TOP_INSET,
  ROOFLINE_OPS_GAP_FROM_PLOT,
  ROOFLINE_PAD,
  ROOFLINE_TOPS_GAP_ABOVE_PLOT,
  ROOFLINE_X_TICK_BELOW_PLOT,
} from './rooflineLayout';
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

  it('PR-ROOF-001b: raised card has under-roof gradient wash', () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    expect(wrapper.find('.pr-roofline__card').exists()).toBe(true);
    const area = wrapper.find('[data-testid="roofline-area"]');
    expect(area.exists()).toBe(true);
    expect(area.attributes('d') ?? '').toMatch(/^M /);
    expect(area.attributes('fill')).toContain('pr-roofline-area');
    const grad = wrapper.find('[data-testid="roofline-area-gradient"]');
    expect(grad.exists()).toBe(true);
    // Ridge-anchored: y1 below plot top when peak is below Y_MAX.
    expect(Number(grad.attributes('y1'))).toBeGreaterThan(ROOFLINE_PAD.t);
    const stops = grad.findAll('stop');
    expect(stops.length).toBeGreaterThanOrEqual(3);
    expect(stops[0]!.attributes('stop-color')).toBe('#3078f0');
    expect(stops[0]!.attributes('stop-opacity')).toBe('0.16');
  });

  it('PR-ROOF-002: shows mix labels', () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    const mix = wrapper.find('[data-testid="roofline-mix"]');
    expect(mix.exists()).toBe(true);
    expect(mix.text()).toContain('Vec_FP32');
    expect(mix.text()).toContain('Vec_MISC');
    expect(mix.text()).toContain('84.100000%');
    expect(mix.find('.pr-roofline__mix-name').exists()).toBe(true);
    expect(mix.find('.pr-roofline__mix-pct').exists()).toBe(true);
  });

  it('PR-ROOF-002b: layout — sketch-calibrated label positions and left inset', () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    const svg = wrapper.get('[data-testid="roofline-chart"]');
    expect(Number(svg.attributes('width'))).toBe(ROOFLINE_CHART_W);
    expect(Number(svg.attributes('height'))).toBe(ROOFLINE_CHART_H);
    const frame = wrapper.get('.pr-roofline__frame');
    const plotTop = Number(frame.attributes('y'));
    const plotLeft = Number(frame.attributes('x'));
    const plotW = Number(frame.attributes('width'));
    const plotH = Number(frame.attributes('height'));
    const plotBottom = plotTop + plotH;
    const xTickY = plotBottom + ROOFLINE_X_TICK_BELOW_PLOT;

    expect(ROOFLINE_CHART_W).toBe(428);
    expect(ROOFLINE_CHART_H).toBe(294);
    expect(plotTop).toBe(ROOFLINE_PAD.t);
    expect(plotLeft).toBe(ROOFLINE_PAD.l);
    expect(plotW).toBe(ROOFLINE_CHART_W - ROOFLINE_PAD.l - ROOFLINE_PAD.r);

    const mix = wrapper.get('[data-testid="roofline-mix"]');
    expect(Number(mix.attributes('y'))).toBe(plotTop + ROOFLINE_MIX_TOP_INSET);

    const xTick = wrapper.get('.pr-roofline__tick');
    expect(Number(xTick.attributes('y'))).toBe(xTickY);

    const ops = wrapper.get('.pr-roofline__axis--x');
    expect(Number(ops.attributes('y'))).toBe(plotBottom);
    expect(Number(ops.attributes('x'))).toBe(plotLeft + plotW + ROOFLINE_OPS_GAP_FROM_PLOT);
    expect(ops.attributes('text-anchor')).toBe('start');
    expect(ops.attributes('dominant-baseline')).toBe('middle');

    const tops = wrapper.get('.pr-roofline__axis--y');
    expect(Number(tops.attributes('y'))).toBe(plotTop - ROOFLINE_TOPS_GAP_ABOVE_PLOT - 9);
    expect(Number(tops.attributes('y')) + 9).toBe(plotTop - ROOFLINE_TOPS_GAP_ABOVE_PLOT);
    expect(Number(tops.attributes('x'))).toBe(plotLeft);
    expect(tops.attributes('dominant-baseline')).toBe('hanging');
    expect(tops.attributes('text-anchor')).toBe('end');

    expect(wrapper.find('.pr-roofline__markers [data-testid="roofline-point"]').exists()).toBe(true);
    expect(wrapper.find('.pr-roofline__plot [data-testid="roofline-point"]').exists()).toBe(false);
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
