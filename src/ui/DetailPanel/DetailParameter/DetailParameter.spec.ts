import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { SourceFileModel } from '../../../domain/types';
import DetailParameter from './DetailParameter.vue';

const sourceFiles: SourceFileModel[] = [
  {
    id: 'gather_2d.asc',
    path: 'gather_2d.asc',
    text: 'int x;\n',
    metricsColumns: [],
    lines: [{ line: 1, values: {} }],
  },
];

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

  it('PR-DPARAM-005: a matching frame is a Source link; unknown paths are not', async () => {
    const bare = '/home/chenning/asc-devkit/examples/gather_2d/gather_2d.asc';
    const wrapper = mount(DetailParameter, {
      props: {
        sourceFiles,
        args: {
          Code: [bare, '/tmp/not-bundled.cpp'],
          source: 'None:None',
          stack: [{ FileName: bare, Line: 0 }],
        },
      },
    });

    const links = wrapper.findAll('[data-testid="source-frame-link"]');
    expect(links).toHaveLength(2);
    expect(links[0]!.text()).toBe(bare);
    expect(wrapper.text()).toContain('None:None');
    expect(wrapper.text()).toContain('/tmp/not-bundled.cpp');
    expect(wrapper.findAll('.pr-detail-parameter__value--path').filter((n) => n.element.tagName === 'SPAN')).toHaveLength(1);

    await links[0]!.trigger('click');
    expect(wrapper.emitted('open-source')?.[0]).toEqual([bare]);
    await links[1]!.trigger('click');
    expect(wrapper.emitted('open-source')?.[1]).toEqual([{ FileName: bare, Line: 0 }]);
  });

  it('PR-DPARAM-005: an unmatched object stays JSON; a link title keeps the other fields', () => {
    const bare = '/home/chenning/asc-devkit/examples/gather_2d/gather_2d.asc';
    const missed = { FileName: '/tmp/a.cpp', Line: 12, Column: 4 };
    const hit = { FileName: bare, Line: 39, Column: 2 };
    const wrapper = mount(DetailParameter, {
      props: { sourceFiles, args: { missed, hit } },
    });

    expect(wrapper.text()).toContain(JSON.stringify(missed));
    expect(wrapper.text()).not.toContain('/tmp/a.cpp:12');
    const link = wrapper.get('[data-testid="source-frame-link"]');
    expect(link.text()).toBe(`${bare}:39`);
    expect(link.attributes('title')).toBe(JSON.stringify(hit));
    expect(wrapper.findAll('[data-testid="source-frame-link"]')).toHaveLength(1);
  });
});
