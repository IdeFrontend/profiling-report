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

  it('PR-STATS-044: idle and settled show only analysis; running shows only stop', () => {
    const idle = mount(CannbotActions, { props: { scope: 'summary' } });
    expect(idle.get('[data-testid="cannbot-summary"]').attributes('aria-label')).toBe(t('cannbotAsk'));
    expect(idle.findAll('button')).toHaveLength(1);

    const run = mount(CannbotActions, { props: { scope: 'summary', sessions: running } });
    const stopBtn = run.get('[data-testid="cannbot-summary"]');
    expect(stopBtn.attributes('aria-label')).toBe(t('cannbotStop'));
    expect(stopBtn.text()).toContain(t('cannbotAnalyzing'));
    expect(run.findAll('button')).toHaveLength(1);

    const done = mount(CannbotActions, { props: { scope: 'summary', sessions: settled } });
    expect(done.findAll('button')).toHaveLength(1);
    expect(done.get('[data-testid="cannbot-summary"]').attributes('aria-label')).toBe(t('cannbotAsk'));
  });

  it('PR-STATS-044b: analysis and stop clicks emit the corresponding scope', async () => {
    const idle = mount(CannbotActions, { props: { scope: 'summary' } });
    await idle.get('[data-testid="cannbot-summary"]').trigger('click');
    expect(idle.emitted('open-cannbot')).toEqual([['summary']]);

    const run = mount(CannbotActions, { props: { scope: 'compute', sessions: { compute: { sessionId: 'c-1', status: 'running' } } } });
    await run.get('[data-testid="cannbot-compute"]').trigger('click');
    expect(run.emitted('open-cannbot-stop')).toEqual([['compute']]);
    expect(run.emitted('open-cannbot')).toBeUndefined();

    const done = mount(CannbotActions, { props: { scope: 'memory', sessions: { memory: { sessionId: 'm-1', status: 'stopped' } } } });
    await done.get('[data-testid="cannbot-memory"]').trigger('click');
    expect(done.emitted('open-cannbot')).toEqual([['memory']]);
    expect(done.emitted('open-cannbot-stop')).toBeUndefined();
  });

  it('PR-STATS-044c: without a session for the scope only analysis is available', () => {
    const none = mount(CannbotActions, { props: { scope: 'summary' } });
    expect(none.get('[data-testid="cannbot-summary"]').attributes('aria-label')).toBe(t('cannbotAsk'));

    // Sibling scopes having sessions never leaks into a scope without its own key.
    const siblingOnly = mount(CannbotActions, { props: { scope: 'compute', sessions: running } });
    expect(siblingOnly.get('[data-testid="cannbot-compute"]').attributes('aria-label')).toBe(t('cannbotAsk'));
    expect(siblingOnly.findAll('button')).toHaveLength(1);
  });

  it('PR-CANNBOT-003: every non-running status (completed / stopped / error / unknown) derives settled; only running derives running', () => {
    for (const status of ['completed', 'stopped', 'error', 'unknown'] as const) {
      const w = mount(CannbotActions, {
        props: { scope: 'summary', sessions: { summary: { sessionId: 's', status } } },
      });
      expect(w.get('button').attributes('aria-label'), status).toBe(t('cannbotAsk'));
    }
    const run = mount(CannbotActions, {
      props: { scope: 'summary', sessions: { summary: { sessionId: 's', status: 'running' } } },
    });
    expect(run.get('button').attributes('aria-label')).toBe(t('cannbotStop'));
  });
});
