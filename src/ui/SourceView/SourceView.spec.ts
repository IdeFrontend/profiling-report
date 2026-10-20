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
    setVScrollVisible: vi.fn(),
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
    getVScrollPos: () => 0,
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
    revealLineInCenter: ReturnType<typeof vi.fn>;
  };
  return last;
}

describe('SourceView', () => {
  beforeEach(async () => {
    resetSuduRuntimeForTests();
    const { newEditor } = await import('@sudu-ide/code-review');
    vi.mocked(newEditor).mockClear();
  });

  it('PR-SOURCE-001: renders dual panes without dock shell', async () => {
    const wrapper = mount(SourceView, {
      props: { model: mockSourceCorrelation() },
    });
    await flushPromises();
    const { newEditor } = await import('@sudu-ide/code-review');
    expect(vi.mocked(newEditor).mock.calls[0]?.[0]).toMatchObject({ disableParser: true });
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    // Source keeps Sudu; SASS is a plain table (# · Address · Assembly · metrics).
    expect(wrapper.findAll('[data-testid="sudu-code-pane"]').length).toBe(1);
    expect(wrapper.find('[data-testid="asm-table-pane"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-dock"]').exists()).toBe(false);
    // Source metrics titles sit above the editor; SASS has its own header in the table.
    expect(wrapper.findAll('[data-testid="sudu-metrics-header-row"]').length).toBe(1);
    const sourceTitles = wrapper.find('[data-testid="sudu-source-header-titles"]');
    expect(sourceTitles.exists()).toBe(true);
    expect(sourceTitles.text()).toContain('#');
    expect(sourceTitles.text()).toContain('Source');
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
    // Hot mapped line from mock: sharpen.cpp:46 → asm 1..5
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    const correlated = asmTable.findAll('tr.pr-src-metrics__row--correlated');
    expect(correlated.map((r) => Number(r.attributes('data-line')))).toEqual([1, 2, 3, 4, 5]);
  });

  it('PR-SOURCE-004: stall cell hover shows stall-tooltip', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model }, attachTo: document.body });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const stallCell = sourceTable.find('tr[data-line="46"] td[data-col="samplingStall"]');
    expect(stallCell.exists()).toBe(true);
    await stallCell.trigger('mouseenter');
    // Teleported to body (pane overflow / z-index seam).
    expect(document.querySelector('[data-testid="stall-tooltip"]')).toBeTruthy();
    await stallCell.trigger('mouseleave');
    expect(document.querySelector('[data-testid="stall-tooltip"]')).toBeNull();
    wrapper.unmount();
  });

  it('PR-SOURCE-004b: stall tooltip flips at the viewport edge (right pane)', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model }, attachTo: document.body });
    // Right panel (SASS) Sampling Stall is where the card used to run off-screen.
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    const stallCell = asmTable.find('tr[data-line="1"] td[data-col="samplingStall"]');
    expect(stallCell.exists()).toBe(true);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const style = () => document.querySelector('[data-testid="stall-tooltip"]')?.getAttribute('style') ?? '';

    await stallCell.trigger('mouseenter', { clientX: 40, clientY: 40 });
    expect(style()).toContain('left: 52px');
    expect(style()).toContain('right: auto');

    await stallCell.trigger('mouseenter', { clientX: vw - 10, clientY: 40 });
    expect(style()).toContain('left: auto');
    expect(style()).toContain(`right: 22px`);

    await stallCell.trigger('mouseenter', { clientX: 40, clientY: vh - 10 });
    expect(style()).toContain('top: auto');
    expect(style()).toContain('bottom: 22px');

    await stallCell.trigger('mouseleave');
    wrapper.unmount();
  });

  it('PR-SOURCE-005: asm row click keeps chosen asm line and marks source + siblings', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    await flushPromises(); // Sudu boot must finish before setLine can touch the editor
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    // asm line 2 maps to sharpen.cpp:46; must not snap caret to mapped[0]=1
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await flushPromises();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    expect(sourceTable.find('tr[data-line="46"]').classes()).toContain('pr-src-metrics__row--current');
    // Sibling asm rows for the same source line stay correlated (right-panel start).
    expect(
      asmTable.findAll('tr.pr-src-metrics__row--correlated').map((r) => Number(r.attributes('data-line'))),
    ).toEqual([1, 2, 3, 4, 5]);
    // Sudu caret must move + reveal (asm → source), not only metrics highlight.
    const ed = await latestSuduEditor();
    expect(ed.setPosition).toHaveBeenCalledWith({ lineNumber: 46, column: 1 });
    expect(ed.revealLineInCenter).toHaveBeenCalledWith(46);
    // Canvas overlay marks the mapped source line even when focus stays on asm.
    const overlay = wrapper.find('[data-testid="sudu-current-line-overlay"]');
    expect(overlay.exists()).toBe(true);
  });

  it('PR-SOURCE-006: unmapped source line clears asm highlight', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);
    // Line 1 is the include — not mapped in mock (sharpen.cpp:1 absent from sourceToAsm)
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
    expect(wrapper.find('[data-testid="source-scroll-bottom"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-sort-asc"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-sort-desc"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-download"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-hide-zeros"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-toggle-shortcuts"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-user-guide"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-link-source"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-link-asm"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-redo-resolve"]').exists()).toBe(false);
    // Shared chrome pill (tokens.css) — same family as CSV / PIPE block selects.
    expect(wrapper.find('[data-testid="source-file-select"]').classes()).toContain('pr-block-pill');
    expect(wrapper.find('[data-testid="source-navigate-by"]').classes()).toContain('pr-block-pill');
    expect(wrapper.find('[data-testid="source-asm-navigate-by"]').classes()).toContain('pr-block-pill');
  });

  it('PR-SOURCE-008: empty find is a no-op; query find walks matches; sort jumps hot', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const search = wrapper.find('[data-testid="source-search"]');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const findNext = wrapper.find('[data-testid="source-find-next"]');

    expect(findNext.attributes('disabled')).toBeDefined();
    await findNext.trigger('click');
    await wrapper.vm.$nextTick();
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);

    await search.setValue('sharpen');
    await wrapper.vm.$nextTick();
    expect(findNext.attributes('disabled')).toBeUndefined();
    expect(sourceTable.findAll('tr.pr-src-metrics__row--match').length).toBeGreaterThan(0);
    await findNext.trigger('click');
    await wrapper.vm.$nextTick();
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current').length).toBe(1);

    await search.setValue('');
    await wrapper.find('[data-testid="source-sort-asc"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current').length).toBe(1);
  });

  it('PR-SOURCE-009: shared Link views off keeps source click from moving asm caret', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const linkSource = wrapper.find('[data-testid="source-link-source"]');
    const linkAsm = wrapper.find('[data-testid="source-link-asm"]');
    expect(linkSource.attributes('aria-pressed')).toBe('true');
    expect(linkAsm.attributes('aria-pressed')).toBe('true');
    await linkAsm.trigger('click');
    await wrapper.vm.$nextTick();
    // Both sides share one toggle state.
    expect(linkSource.attributes('aria-pressed')).toBe('false');
    expect(linkAsm.attributes('aria-pressed')).toBe('false');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(sourceTable.find('tr[data-line="46"]').classes()).toContain('pr-src-metrics__row--current');
    expect(asmTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    // Toggling the other button turns linking back on for both.
    await linkSource.trigger('click');
    await wrapper.vm.$nextTick();
    expect(linkSource.attributes('aria-pressed')).toBe('true');
    expect(linkAsm.attributes('aria-pressed')).toBe('true');
  });

  it('PR-SOURCE-010: bottom dock (inline / markers / stats) is not rendered', () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    expect(wrapper.find('[data-testid="source-dock"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-dock-inline"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-dock-markers"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-dock-stats"]').exists()).toBe(false);
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
    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);

    await wrapper.find('[data-testid="source-scroll-top"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    expect(sourceTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);

    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);
  });

  it('PR-SOURCE-016: scroll-to-bottom suppresses correlated highlights at last lines', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);

    await wrapper.find('[data-testid="source-scroll-bottom"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    expect(sourceTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    const srcLast = model.files[0]!.text.split(/\r?\n/).length;
    const asmLast = model.assembly.lines[model.assembly.lines.length - 1]!.line;
    expect(sourceTable.find(`tr[data-line="${srcLast}"]`).classes()).toContain(
      'pr-src-metrics__row--current',
    );
    expect(asmTable.find(`tr[data-line="${asmLast}"]`).classes()).toContain(
      'pr-src-metrics__row--current',
    );
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
    // asm:2 → source:46; mapped group is [1..5] — must not bounce to 1 on caret echo.
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');

    // Simulate Sudu echoing caret after sourcePane.setLine(46).
    await wrapper.findComponent({ name: 'SuduCodePane' }).vm.$emit('update:currentLine', 46);
    await wrapper.vm.$nextTick();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');
    expect(asmTable.find('tr[data-line="1"]').classes()).not.toContain('pr-src-metrics__row--current');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    expect(sourceTable.find('tr[data-line="46"]').classes()).toContain('pr-src-metrics__row--current');
  });

  it('PR-SOURCE-014b: late caret echo after syncOrigin expires still keeps asm caret', async () => {
    vi.useFakeTimers();
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await wrapper.vm.$nextTick();
    // Past the syncOrigin safety window — echo must still not snap via mapped[0].
    vi.advanceTimersByTime(400);
    await wrapper.findComponent({ name: 'SuduCodePane' }).vm.$emit('update:currentLine', 46);
    await wrapper.vm.$nextTick();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');
    expect(asmTable.find('tr[data-line="1"]').classes()).not.toContain('pr-src-metrics__row--current');
    vi.useRealTimers();
  });

  it('PR-SOURCE-015: switching Source file clears caret and correlation', async () => {
    const base = mockSourceCorrelation();
    const other = {
      ...base.files[0]!,
      id: 'other.cpp',
      path: 'other.cpp',
      language: 'ascend-c',
      text: 'extern "C" __global__ __aicore__ void other(GM_ADDR x) {\n    AscendC::TPipe pipe;\n}\n',
      lines: [
        { line: 1, values: { instructionsExecuted: 1, samplingStall: 0, warpOccupancy: 0.1 } },
        { line: 2, values: { instructionsExecuted: 2, samplingStall: 0, warpOccupancy: 0.2 } },
      ],
    };
    const model = { ...base, files: [...base.files, other] };
    const wrapper = mount(SourceView, { props: { model } });
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await sourceTable.find('tr[data-line="46"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated').length).toBeGreaterThan(0);

    await wrapper.find('[data-testid="source-file-select"]').setValue('other.cpp');
    await wrapper.vm.$nextTick();
    expect((wrapper.find('[data-testid="source-file-select"]').element as HTMLSelectElement).value).toBe(
      'other.cpp',
    );
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
  });

  it('PR-SOURCE-017: column resize handles drag to change SASS column width', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    const asmHead = wrapper.find('[data-testid="asm-table-pane"] [data-testid="source-metrics-head"]');
    const handle = asmHead.find('[data-testid="source-col-resize"][data-col="assembly"]');
    expect(handle.exists()).toBe(true);
    const col = asmHead.find('col.pr-src-metrics__col--assembly');
    // Widths render as % of preferred-px total so the table fits the pane.
    const pct = (el: { attributes: (n: string) => string | undefined }) =>
      Number.parseFloat((el.attributes('style') ?? '').match(/width:\s*([\d.]+)%/)?.[1] ?? '0');
    const before = pct(col);
    expect(before).toBeGreaterThan(0);
    await handle.trigger('pointerdown', { button: 0, clientX: 100, pointerId: 1 });
    await handle.trigger('pointermove', { clientX: 160, pointerId: 1 });
    await handle.trigger('pointerup', { pointerId: 1 });
    await wrapper.vm.$nextTick();
    // assembly default 280 → 340; its share of the total must rise.
    expect(pct(col)).toBeGreaterThan(before);
  });
});
