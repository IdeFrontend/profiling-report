import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailParameter from './DetailParameter.vue';

describe('DetailParameter', () => {
  it('PR-DPARAM-001: renders one row per args entry with the producer key', () => {
    const wrapper = mount(DetailParameter, {
      props: { args: { Pc_addr: '0xf00103da', Process_bytes: 512 } },
    });

    expect(wrapper.find('[data-testid="detail-parameter"]').exists()).toBe(true);
    expect(wrapper.findAll('.pr-detail-parameter__key').map((n) => n.text())).toEqual([
      'Pc_addr',
      'Process_bytes',
    ]);
    expect(wrapper.text()).toContain('0xf00103da');
    expect(wrapper.text()).toContain('512');
  });

  it('PR-DPARAM-002: shows the empty note without usable args', () => {
    expect(mount(DetailParameter).find('[data-testid="detail-parameter-empty"]').exists()).toBe(
      true,
    );
    expect(
      mount(DetailParameter, { props: { args: { Code: '' } } })
        .find('[data-testid="detail-parameter-empty"]')
        .exists(),
    ).toBe(true);
  });

  it('PR-DPARAM-003: path values render as links and arrays stack under one key', () => {
    const wrapper = mount(DetailParameter, {
      props: {
        args: {
          Code: [
            '/usr/local/Ascend/ascend-toolkit/latest/tools/tikcpp/impl/dav_c220000000/a.cpp',
            '/usr/local/Ascend/ascend-toolkit/latest/tools/tikcpp/lib/matmul/impl/b.h',
          ],
        },
      },
    });

    expect(wrapper.findAll('.pr-detail-parameter__key')).toHaveLength(1);
    const values = wrapper.findAll('.pr-detail-parameter__value--path');
    expect(values).toHaveLength(2);
    expect(values[0].attributes('title')).toContain('dav_c220000000');
  });

  it('PR-DPARAM-004: drops the DATA-36a transport keys and the adapter-injected cat', () => {
    const wrapper = mount(DetailParameter, {
      props: {
        args: {
          event_id: 'mov-out',
          dependencies: ['step-17'],
          cat: 'ascend_hardware',
          Pc_addr: '0xf00103da',
        },
      },
    });

    expect(wrapper.findAll('.pr-detail-parameter__key').map((n) => n.text())).toEqual(['Pc_addr']);
    expect(wrapper.text()).not.toContain('step-17');
    expect(wrapper.text()).not.toContain('ascend_hardware');
  });
});
