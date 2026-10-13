import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { mockSourceCorrelation } from '../../adapters/sourceCorrelation/mockSourceCorrelation';
import SourceView from './SourceView.vue';
import { resetSuduRuntimeForTests } from './suduRuntime';

vi.mock('./sourceFonts', () => ({
  ensureSourceTabFonts: vi.fn(async () => undefined),
  SOURCE_TAB_CODICON_URL: '/sudu/codicon.ttf',
  SOURCE_TAB_MONO_FAMILY: 'JetBrains Mono',
  SOURCE_TAB_MONO_STACK: "'JetBrains Mono', ui-monospace, monospace",
  SOURCE_TAB_EDITOR_FONT: { family: 'JetBrains Mono', size: 12, weight: 400 },
}));

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => ({ getNumThreads: () => 3 })),
  loadFonts: vi.fn(async () => []),
  newEditor: vi.fn(() => ({
    setModel: vi.fn(),
    setVScrollListener: vi.fn(),
    setCaretListener: vi.fn(),
    setPosition: vi.fn(),
    getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
    revealLine: vi.fn(),
    revealLineInCenter: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
    getDevicePixelRatio: () => 1,
    getLineHeight: () => 18,
    getEditorHeight: () => 200,
    getMaxVScrollPos: () => 0,
    getNumLines: () => 10,
    getFontSize: () => 12,
    getFontFamily: () => 'JetBrains Mono',
    setVScrollPos: vi.fn(),
  })),
  newTextModel: vi.fn(() => ({ dispose: vi.fn() })),
}));

async function latestSuduEditor() {
  const { newEditor } = await import('@sudu-ide/code-review');
  const results = vi.mocked(newEditor).mock.results;
  const last = results[results.length - 1]?.value as {
    setPosition: ReturnType<typeof vi.fn>;
    revealLine: ReturnType<typeof vi.fn>;
  };
  return last;
}

describe('SourceView', () => {
  beforeEach(async () => {
    resetSuduRuntimeForTests();
    const { newEditor } = await import('@sudu-ide/code-review');
    vi.mocked(newEditor).mockClear();
  });

  it('PR-SOURCE-001: renders dual panes and dock shell', () => {
    const wrapper = mount(SourceView, {
      props: { model: mockSourceCorrelation() },
    });
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    // Source keeps Sudu; SASS is a plain table (# · Address · Assembly · metrics).
    expect(wrapper.findAll('[data-testid="sudu-code-pane"]').length).toBe(1);
    expect(wrapper.find('[data-testid="asm-table-pane"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-dock"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-dock-inline"]').exists()).toBe(true);
    // Source metrics titles sit above the editor; SASS has its own header in the table.
    expect(wrapper.findAll('[data-testid="sudu-metrics-header-row"]').length).toBe(1);
    expect(wrapper.find('[data-testid="asm-table-pane"] [data-testid="source-metrics-head"]').exists()).toBe(
      true,
    );
  });

  it('PR-SOURCE-002: mock badge visible for mock model', () => {
    const wrapper = mount(SourceView, {
      props: { model: mockSourceCorrelation() },
    });
    expect(wrapper.find('[data-testid="source-mock-badge"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-view"]').attributes('data-mock')).toBe('true');
  });

  it('PR-SOURCE-003: source row click marks correlated asm lines', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    // Hot mapped line from mock: sharpen.py:4 → asm 1,2,3
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    await sourceTable.find('tr[data-line="4"]').trigger('click');
    await wrapper.vm.$nextTick();
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    const correlated = asmTable.findAll('tr.pr-src-metrics__row--correlated');
    expect(correlated.map((r) => Number(r.attributes('data-line')))).toEqual([1, 2, 3]);
  });

  it('PR-SOURCE-004: stall cell hover shows stall-tooltip', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model }, attachTo: document.body });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const stallCell = sourceTable.find('tr[data-line="4"] td[data-col="samplingStall"]');
    expect(stallCell.exists()).toBe(true);
    await stallCell.trigger('mouseenter');
    expect(wrapper.find('[data-testid="stall-tooltip"]').exists()).toBe(true);
    await stallCell.trigger('mouseleave');
    expect(wrapper.find('[data-testid="stall-tooltip"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-SOURCE-005: asm row click keeps chosen asm line and marks source', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    await flushPromises(); // Sudu boot must finish before setLine can touch the editor
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    // asm line 2 maps to sharpen.py:4; must not snap caret to mapped[0]=1
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await flushPromises();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    expect(sourceTable.find('tr[data-line="4"]').classes()).toContain('pr-src-metrics__row--current');
    // Sudu caret must move + reveal (asm → source), not only metrics highlight.
    const ed = await latestSuduEditor();
    expect(ed.setPosition).toHaveBeenCalledWith({ lineNumber: 4, column: 1 });
    expect(ed.revealLine).toHaveBeenCalledWith(4);
  });

  it('PR-SOURCE-006: unmapped source line clears asm highlight', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="4"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);
    // Line 1 is the def line — mapped in mock? sharpen.py:1 not in sourceToAsm
    await sourceTable.find('tr[data-line="1"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
  });

  it('PR-SOURCE-007: sketch toolbar controls are present', () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    expect(wrapper.find('[data-testid="source-search"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-toolbar-actions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-find-next"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-find-prev"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-scroll-top"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-sort-asc"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-sort-desc"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-download"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-hide-zeros"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-user-guide"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-link-source"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-link-asm"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-redo-resolve"]').exists()).toBe(true);
    // Shared chrome pill (tokens.css) — same family as CSV / PIPE block selects.
    expect(wrapper.find('[data-testid="source-file-select"]').classes()).toContain('pr-block-pill');
    expect(wrapper.find('[data-testid="source-navigate-by"]').classes()).toContain('pr-block-pill');
    expect(wrapper.find('[data-testid="source-asm-navigate-by"]').classes()).toContain('pr-block-pill');
  });

  it('PR-SOURCE-008: search marks matches; find-next walks hot lines', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const search = wrapper.find('[data-testid="source-search"]');
    await search.setValue('sharpen');
    await wrapper.vm.$nextTick();
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    expect(sourceTable.findAll('tr.pr-src-metrics__row--match').length).toBeGreaterThan(0);

    await search.setValue('');
    await wrapper.find('[data-testid="source-find-next"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current').length).toBe(1);
  });

  it('PR-SOURCE-009: asm link off keeps source click from moving asm caret', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    await wrapper.find('[data-testid="source-link-asm"]').trigger('click');
    await wrapper.vm.$nextTick();
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="4"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(sourceTable.find('tr[data-line="4"]').classes()).toContain('pr-src-metrics__row--current');
    expect(asmTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
  });

  it('PR-SOURCE-010: dock inline row click selects source line', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    expect(wrapper.find('[data-testid="source-dock-inline-panel"]').exists()).toBe(true);
    const row = wrapper.find('[data-testid="source-dock-inline-row"]');
    expect(row.exists()).toBe(true);
    await row.trigger('click');
    await wrapper.vm.$nextTick();
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current').length).toBe(1);
  });

  it('PR-SOURCE-011: asm Navigate By is enabled and independent', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const asmNav = wrapper.find('[data-testid="source-asm-navigate-by"]');
    expect(asmNav.attributes('disabled')).toBeUndefined();
    await asmNav.setValue('samplingStall');
    expect((asmNav.element as HTMLSelectElement).value).toBe('samplingStall');
    expect((wrapper.find('[data-testid="source-navigate-by"]').element as HTMLSelectElement).value).toBe(
      'instructionsExecuted',
    );
  });

  it('PR-SOURCE-012: scroll-to-top suppresses correlated highlights until next click', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="4"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);

    await wrapper.find('[data-testid="source-scroll-top"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    expect(sourceTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);

    await sourceTable.find('tr[data-line="4"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);
  });

  it('PR-SOURCE-013: SASS pane is table-only with sketch column order', () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    const asm = wrapper.find('[data-testid="asm-table-pane"]');
    expect(asm.exists()).toBe(true);
    expect(asm.find('[data-testid="sudu-editor-host"]').exists()).toBe(false);
    const heads = asm.findAll('[data-testid="source-metrics-head"] th').map((th) => th.text());
    expect(heads).toEqual([
      '#',
      'Address',
      'Assembly',
      'Instructions Executed',
      'Sampling Stall',
      'Warp Occupancy',
    ]);
    const row1 = asm.find('tr[data-line="1"]');
    expect(row1.find('[data-col="address"]').text()).toMatch(/00007f7b/);
    expect(row1.find('[data-col="assembly"]').text().length).toBeGreaterThan(0);
  });

  it('PR-SOURCE-014: Sudu caret echo after asm click does not snap asm to mapped[0]', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    // asm:2 → source:4; mapped group is [1,2,3] — must not bounce to 1 on caret echo.
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');

    // Simulate Sudu echoing caret after sourcePane.setLine(4).
    await wrapper.findComponent({ name: 'SuduCodePane' }).vm.$emit('update:currentLine', 4);
    await wrapper.vm.$nextTick();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');
    expect(asmTable.find('tr[data-line="1"]').classes()).not.toContain('pr-src-metrics__row--current');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    expect(sourceTable.find('tr[data-line="4"]').classes()).toContain('pr-src-metrics__row--current');
  });
});
