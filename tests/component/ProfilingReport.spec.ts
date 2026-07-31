import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProfilingReport from '../../src/ui/ProfilingReport.vue';

describe('ProfilingReport scaffold', () => {
  it('PR-SCAFFOLD-003: mounts placeholder root', () => {
    const wrapper = mount(ProfilingReport, {
      props: { title: 'scaffold' },
    });
    expect(wrapper.get('[data-testid="profiling-report"]').text()).toContain('scaffold');
  });
});
