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
      color: '#32BE8C',
      seriesId: 'aiv-fp32',
    },
  ],
  mixLabels: [
    { id: 'fp32', label: 'Vec_FP32', percent: 84.1 },
    { id: 'misc', label: 'Vec_MISC', percent: 15.9 },
  ],
  series: [
    {
      id: 'aiv-fp32',
      group: 'aiv',
      label: 'AIV fp32',
      color: '#32BE8C',
      peakComputeTops: 13.5,
      peakBandwidthGBs: 1600,
      slopeStyle: 'solid',
    },
  ],
};

describe('RooflinePanel', () => {
  it('PR-ROOF-001: renders chart with point and roof', () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    expect(wrapper.find('[data-testid="roofline-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="roofline-chart"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="roofline-roof"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="roofline-point"]')).toHaveLength(1);
    const knees = wrapper.findAll('[data-testid="roofline-knee"]');
    expect(knees).toHaveLength(sample.series.length);
    expect(knees[0]!.attributes('fill')).toBe('#262626');
    expect(knees[0]!.attributes('stroke')).toBe(sample.series[0]!.color);
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

  it('PR-ROOF-002b: layout — sketch-calibrated label positions and left inset', async () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    const svg = wrapper.get('[data-testid="roofline-chart"]');
    expect(Number(svg.attributes('width'))).toBe(ROOFLINE_CHART_W);
    expect(Number(svg.attributes('height'))).toBe(ROOFLINE_CHART_H);
    expect(svg.attributes('style') ?? '').not.toMatch(/width:\s*\d+px/);
    const roofSrc = (await import('./RooflinePanel.vue?raw')).default as string;
    expect(roofSrc).toMatch(/\.pr-roofline__svg\s*\{[^}]*width:\s*100%/s);
    const frame = wrapper.get('.pr-roofline__frame');
    const plotTop = Number(frame.attributes('y'));
    const plotLeft = Number(frame.attributes('x'));
    const plotW = Number(frame.attributes('width'));
    const plotH = Number(frame.attributes('height'));
    const plotBottom = plotTop + plotH;
    const xTickY = plotBottom + ROOFLINE_X_TICK_BELOW_PLOT;

    expect(ROOFLINE_CHART_W).toBe(440);
    expect(ROOFLINE_CHART_H).toBe(303);
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
    // Left edge aligns with card title / AIV / AIC (not end-anchored at the plot).
    expect(Number(tops.attributes('x'))).toBe(0);
    expect(tops.attributes('dominant-baseline')).toBe('hanging');
    expect(tops.attributes('text-anchor')).toBe('start');

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

  it('PR-ROOF-005: interim host shape (root peaks, no series) still draws a roof', () => {
    const legacy = {
      points: sample.points,
      mixLabels: [],
      peakComputeTops: 13.5,
      peakBandwidthGBs: 1600,
    } as unknown as RooflineViewModel;
    const wrapper = mount(RooflinePanel, { props: { model: legacy } });
    expect(wrapper.find('[data-testid="roofline-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="roofline-roof"]').exists()).toBe(true);
  });

  it('PR-ROOF-006: legend under title, left-aligned AIV/AIC rows', async () => {
    const multi: RooflineViewModel = {
      ...sample,
      series: [
        {
          id: 'aiv-fp16',
          group: 'aiv',
          label: 'AIV fp16',
          color: '#8C78F0',
          peakComputeTops: 10,
          peakBandwidthGBs: 1600,
          slopeStyle: 'solid',
        },
        {
          id: 'aiv-fp32',
          group: 'aiv',
          label: 'AIV fp32',
          color: '#32BE8C',
          peakComputeTops: 13.5,
          peakBandwidthGBs: 1600,
          slopeStyle: 'solid',
        },
        {
          id: 'aic-fp32',
          group: 'aic',
          label: 'AIC fp32',
          color: '#B4E04A',
          peakComputeTops: 20,
          peakBandwidthGBs: 1600,
          slopeStyle: 'solid',
        },
      ],
    };
    const wrapper = mount(RooflinePanel, { props: { model: multi } });
    const head = wrapper.get('.pr-roofline__card-head');
    const title = wrapper.get('.pr-roofline__chart-title');
    const legend = wrapper.get('[data-testid="roofline-legend"]');
    expect(head.element.contains(legend.element)).toBe(true);
    // Title precedes legend in DOM (column stack, not a side-by-side header).
    expect(
      title.element.compareDocumentPosition(legend.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const src = (await import('./RooflinePanel.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-roofline__card-head\s*\{[^}]*flex-direction:\s*column/s);
    expect(src).toMatch(/\.pr-roofline__card-head\s*\{[^}]*gap:\s*10px/s);
    expect(src).toMatch(/\.pr-roofline__legend\s*\{[^}]*display:\s*grid/s);
    expect(src).toMatch(/\.pr-roofline__leg-head\s*\{[^}]*color:\s*#c4c4c4/s);
    expect(src).toMatch(/\.pr-roofline__leg-item\s*\{[^}]*color:\s*#8a8a8a/s);
    // max(2 AIV, 1 AIC) → two shared item columns (nth swatches align).
    expect(legend.attributes('style') ?? '').toMatch(/repeat\(2,\s*max-content\)/);
    expect(legend.text()).toContain('AIV:');
    expect(legend.text()).toContain('AIV fp16');
    expect(legend.text()).toContain('AIC:');
    expect(legend.text()).toContain('AIC fp32');
    expect(wrapper.findAll('.pr-roofline__leg-item')).toHaveLength(3);
    expect(wrapper.findAll('.pr-roofline__leg-pad')).toHaveLength(1);
  });

  it('PR-ROOF-004: hover point shows tooltip inside card without layout jump', async () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    const card = wrapper.get('.pr-roofline__card');
    const tip = wrapper.get('[data-testid="roofline-tooltip"]');
    expect(card.element.contains(tip.element)).toBe(true);
    // Tip is a reserved in-flow band under the SVG (not absolute over ticks).
    const src = (await import('./RooflinePanel.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-roofline__tip\s*\{[^}]*min-height:\s*calc\(11px\s*\*\s*1\.2\)/s,
    );
    expect(src).not.toMatch(/\.pr-roofline__tip\s*\{[^}]*position:\s*absolute/s);

    const heightBefore = card.element.getBoundingClientRect().height;
    await wrapper.get('[data-testid="roofline-point"]').trigger('mouseenter');
    expect(tip.text()).toContain('Ops/Byte');
    expect(tip.text()).toContain('TOps/s');
    expect(card.element.getBoundingClientRect().height).toBe(heightBefore);
  });

  it('PR-ROOF-004: tooltip follows the current point when the model is replaced', async () => {
    const wrapper = mount(RooflinePanel, { props: { model: sample } });
    await wrapper.get('[data-testid="roofline-point"]').trigger('mouseenter');
    const next: RooflineViewModel = {
      ...sample,
      points: [{ ...sample.points[0]!, intensity: 12, performance: 4 }],
    };
    await wrapper.setProps({ model: next });
    const tip = wrapper.get('[data-testid="roofline-tooltip"]').text();
    expect(tip).toContain('12.000');
    expect(tip).toContain('4.000');
    expect(tip).not.toContain('0.090');
  });

  it('PR-ROOF-007: log domains have no hard X/Y cap for chip-scale roofs', () => {
    // Ridge = peakCompute * 1000 / BW = 5e5 * 1000 / 1600 ≈ 3.125e5 → decade ceil 1e6.
    const huge: RooflineViewModel = {
      ...sample,
      series: [
        {
          id: 'aic-int8-fp8',
          group: 'aic',
          label: 'AIC int8 fp8',
          color: '#F0A020',
          peakComputeTops: 500_000,
          peakBandwidthGBs: 1600,
          slopeStyle: 'dashed',
        },
      ],
    };
    const wrapper = mount(RooflinePanel, { props: { model: huge } });
    const tickTexts = wrapper.findAll('.pr-roofline__tick').map((n) => n.text());
    // Old caps (X 1e3 / Y 1e5) would stop at 1K / 100K and omit these.
    expect(tickTexts).toContain('100K');
    expect(tickTexts).toContain('1000K');
  });

  it('PR-ROOF-007: intensities below 1e-3 stay on their own decade', () => {
    const low: RooflineViewModel = {
      points: [
        { id: 'lo', label: 'lo', intensity: 1e-4, performance: 1, style: 'solid', color: '#32BE8C' },
        { id: 'hi', label: 'hi', intensity: 1e-3, performance: 1, style: 'solid', color: '#8C78F0' },
      ],
      mixLabels: [],
      series: [],
    };
    const wrapper = mount(RooflinePanel, { props: { model: low } });
    const cxs = wrapper.findAll('[data-testid="roofline-point"]').map((n) => Number(n.attributes('cx')));
    expect(Math.max(...cxs) - Math.min(...cxs)).toBeGreaterThan(10);
    expect(wrapper.findAll('.pr-roofline__tick').map((n) => n.text())).toEqual(
      expect.arrayContaining(['0.0001', '0.001']),
    );
  });

  it('PR-ROOF-007b: lone power-of-ten point still yields finite coordinates', () => {
    // niceFloor(1)=niceCeil(1)=1 → without a decade guard, log map divides by zero.
    const lone: RooflineViewModel = {
      points: [
        {
          id: 'gm',
          label: 'GM',
          intensity: 1,
          performance: 1,
          style: 'solid',
          color: '#32BE8C',
        },
      ],
      mixLabels: [],
      series: [],
    };
    const wrapper = mount(RooflinePanel, { props: { model: lone } });
    const pt = wrapper.get('[data-testid="roofline-point"]');
    expect(Number.isFinite(Number(pt.attributes('cx')))).toBe(true);
    expect(Number.isFinite(Number(pt.attributes('cy')))).toBe(true);
    expect(wrapper.findAll('.pr-roofline__tick').map((n) => n.text())).toEqual(
      expect.arrayContaining(['1', '10']),
    );
  });
});
