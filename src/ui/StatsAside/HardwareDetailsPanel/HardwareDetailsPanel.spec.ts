import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HardwareDetailsPanel from './HardwareDetailsPanel.vue';

describe('HardwareDetailsPanel', () => {
  it('PR-HW-001: renders section fields', () => {
    const wrapper = mount(HardwareDetailsPanel, {
      props: {
        model: {
          sections: [
            {
              id: 'op',
              title: 'OpBasicInfo',
              fields: [
                { key: 'Op Name', value: 'add_custom' },
                { key: 'Current Freq', value: '1650' },
              ],
            },
          ],
        },
      },
    });
    expect(wrapper.find('[data-testid="hardware-details"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('OpBasicInfo');
    expect(wrapper.text()).toContain('add_custom');
    expect(wrapper.text()).toContain('1650');
  });

  it('PR-HW-003: field values display at most four decimals, residue trimmed', () => {
    const wrapper = mount(HardwareDetailsPanel, {
      props: {
        model: {
          sections: [
            {
              id: 'op',
              title: 'OpBasicInfo',
              fields: [
                { key: 'Current Freq', value: '1.7999999999999999' },
                { key: 'Op Name', value: 'add_custom' },
              ],
            },
          ],
        },
      },
    });
    expect(wrapper.text()).toContain('1.8');
    expect(wrapper.text()).toContain('add_custom');
    wrapper.unmount();
  });

  it('PR-HW-002: empty sections → no panel', () => {
    const wrapper = mount(HardwareDetailsPanel, {
      props: { model: { sections: [] } },
    });
    expect(wrapper.find('[data-testid="hardware-details"]').exists()).toBe(false);
  });
});
