import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CannbotActions from './CannbotActions.vue';
import type { CannbotSessions } from '../../domain/cannbot';
import { t } from '../../i18n';

describe('CannbotActions', () => {
  const settled: CannbotSessions = {
    summary: { sessionId: 's-1', status: 'completed' },
  };
  const running: CannbotSessions = {
    summary: { sessionId: 's-2', status: 'running' },
  };

  it('PR-STATS-044: idle renders 分析 | 引用; running renders 正在分析 | 引用; settled renders 分析 | 引用 | 查看', () => {
    const idle = mount(CannbotActions, { props: { scope: 'summary' } });
    expect(idle.get('[data-testid="cannbot-summary"]').attributes('aria-label')).toBe(t('cannbotAsk'));
    expect(idle.get('[data-testid="cannbot-summary-reference"]').attributes('aria-label')).toBe(t('cannbotReference'));
    expect(idle.find('[data-testid="cannbot-summary-view"]').exists()).toBe(false);

    const run = mount(CannbotActions, { props: { scope: 'summary', sessions: running } });
    const stopBtn = run.get('[data-testid="cannbot-summary"]');
    expect(stopBtn.attributes('aria-label')).toBe(t('cannbotStop'));
    expect(stopBtn.text()).toContain(t('cannbotAnalyzing'));
    expect(run.find('[data-testid="cannbot-summary-reference"]').exists()).toBe(true);
    expect(run.find('[data-testid="cannbot-summary-view"]').exists()).toBe(false);

    const done = mount(CannbotActions, { props: { scope: 'summary', sessions: settled } });
    expect(done.findAll('.pr-cannbot-actions__btn')).toHaveLength(3);
    expect(done.get('[data-testid="cannbot-summary"]').attributes('aria-label')).toBe(t('cannbotAsk'));
    expect(done.get('[data-testid="cannbot-summary-reference"]').attributes('aria-label')).toBe(t('cannbotReference'));
    expect(done.get('[data-testid="cannbot-summary-view"]').attributes('aria-label')).toBe(t('cannbotView'));
  });

  it('PR-STATS-044b: idle / settled reference click emits cannbot-reference; running click emits open-cannbot-stop; settled emits open-cannbot / cannbot-view with the scope', async () => {
    const idle = mount(CannbotActions, { props: { scope: 'summary' } });
    await idle.get('[data-testid="cannbot-summary-reference"]').trigger('click');
    expect(idle.emitted('cannbot-reference')).toEqual([['summary']]);

    const run = mount(CannbotActions, { props: { scope: 'compute', sessions: { compute: { sessionId: 'c-1', status: 'running' } } } });
    await run.get('[data-testid="cannbot-compute"]').trigger('click');
    expect(run.emitted('open-cannbot-stop')).toEqual([['compute']]);
    expect(run.emitted('open-cannbot')).toBeUndefined();

    const done = mount(CannbotActions, { props: { scope: 'memory', sessions: { memory: { sessionId: 'm-1', status: 'stopped' } } } });
    await done.get('[data-testid="cannbot-memory"]').trigger('click');
    await done.get('[data-testid="cannbot-memory-reference"]').trigger('click');
    await done.get('[data-testid="cannbot-memory-view"]').trigger('click');
    expect(done.emitted('open-cannbot')).toEqual([['memory']]);
    expect(done.emitted('cannbot-reference')).toEqual([['memory']]);
    expect(done.emitted('cannbot-view')).toEqual([['memory']]);
    expect(done.emitted('open-cannbot-stop')).toBeUndefined();
  });

  it('PR-STATS-044c: without sessions (browser / playground) every scope stays idle — 引用常驻, no 查看, no stop', () => {
    const none = mount(CannbotActions, { props: { scope: 'summary' } });
    expect(none.find('[data-testid="cannbot-summary-reference"]').exists()).toBe(true);
    expect(none.find('[data-testid="cannbot-summary-view"]').exists()).toBe(false);
    expect(none.text()).not.toContain(t('cannbotAnalyzing'));

    // Sibling scopes having sessions never leaks into a scope without its own key.
    const siblingOnly = mount(CannbotActions, { props: { scope: 'compute', sessions: settled } });
    expect(siblingOnly.get('[data-testid="cannbot-compute"]').attributes('aria-label')).toBe(t('cannbotAsk'));
    expect(siblingOnly.find('[data-testid="cannbot-compute-reference"]').exists()).toBe(true);
  });

  it('PR-CANNBOT-003: every non-running status (completed / stopped / error / unknown) derives settled; only running derives running', () => {
    for (const status of ['completed', 'stopped', 'error', 'unknown'] as const) {
      const w = mount(CannbotActions, {
        props: { scope: 'summary', sessions: { summary: { sessionId: 's', status } } },
      });
      expect(w.find('[data-testid="cannbot-summary-reference"]').exists(), status).toBe(true);
      expect(w.find('[data-testid="cannbot-summary-view"]').exists(), status).toBe(true);
    }
    const run = mount(CannbotActions, {
      props: { scope: 'summary', sessions: { summary: { sessionId: 's', status: 'running' } } },
    });
    expect(run.find('[data-testid="cannbot-summary-reference"]').exists()).toBe(true);
    expect(run.find('[data-testid="cannbot-summary-view"]').exists()).toBe(false);
    expect(run.text()).toContain(t('cannbotAnalyzing'));
  });
});
