import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { mockSourceCorrelation } from '../../adapters/sourceCorrelation/mockSourceCorrelation';
import { t } from '../../i18n';
import SourceView from './SourceView.vue';
import { resetSuduRuntimeForTests } from './suduRuntime';

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => ({ getNumThreads: () => 3 })),
  // Mirror real Sudu: setPosition notifies setCaretListener when the line changes.
  newEditor: vi.fn(() => {
    let caretListener: ((lineNumber: number) => void) | null = null;
    let position = { lineNumber: 1, column: 1 };
    return {
      setModel: vi.fn(),
      setVScrollListener: vi.fn(),
      setVScrollVisible: vi.fn(),
      setCaretListener: vi.fn((cb: ((lineNumber: number) => void) | null) => {
        caretListener = cb;
      }),
      setPosition: vi.fn((pos: { lineNumber: number; column: number }) => {
        const prev = position.lineNumber;
        position = pos;
        if (caretListener && pos.lineNumber !== prev) caretListener(pos.lineNumber);
      }),
      getPosition: vi.fn(() => position),
      revealLine: vi.fn(),
      revealLineInCenter: vi.fn(),
      focus: vi.fn(),
      setTheme: vi.fn(),
      hasFocus: vi.fn(() => false),
      dispose: vi.fn(),
      getDevicePixelRatio: () => 1,
      getLineHeight: () => 18,
      getEditorHeight: () => 200,
      getMaxVScrollPos: () => 0,
      getNumLines: () => 10,
      getFontSize: () => 12,
      getFontFamily: () => 'monospace',
      getVScrollPos: () => 0,
      setVScrollPos: vi.fn(),
    };
  }),
  newTextModel: vi.fn(() => ({ dispose: vi.fn() })),
}));

async function latestSuduEditor() {
  const { newEditor } = await import('@sudu-ide/code-review');
  const results = vi.mocked(newEditor).mock.results;
  const last = results[results.length - 1]?.value as {
    setPosition: ReturnType<typeof vi.fn>;
    revealLine: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    setTheme: ReturnType<typeof vi.fn>;
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
    // Sudu caret moves + gains focus so drawCaret paints the selection (no custom overlay).
    const ed = await latestSuduEditor();
    expect(ed.setPosition).toHaveBeenCalledWith({ lineNumber: 46, column: 1 });
    expect(ed.revealLine).toHaveBeenCalledWith(46);
    expect(ed.focus).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="sudu-current-line-overlay"]').exists()).toBe(false);
    const pane = (await import('./SuduCodePane.vue?raw')).default as string;
    expect(pane).not.toContain('pr-sudu-pane__overlay--current');
  });

  it('PR-SOURCE-006b: unmapped asm row clears source metrics and Sudu current-line theme', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    await flushPromises();
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    // Mapped first so the editor has a caret/theme to clear.
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await flushPromises();
    expect(sourceTable.find('tr[data-line="46"]').classes()).toContain('pr-src-metrics__row--current');
    const ed = await latestSuduEditor();
    ed.setTheme.mockClear();
    // Mock asm line 99 is unmapped (no asmToSource entry).
    const unmapped =
      model.assembly.lines.find((r) => model.asmToSource[r.line] == null)?.line ?? null;
    expect(unmapped).not.toBeNull();
    await asmTable.find(`tr[data-line="${unmapped}"]`).trigger('click');
    await flushPromises();
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(ed.setTheme).toHaveBeenCalled();
    const theme = ed.setTheme.mock.calls.at(-1)?.[0] as Record<number | string, string>;
    // CurrentLineBackground overridden to editor plane so Sudu stop painting the old line.
    expect(theme[14]).toBe('#1a1a1a');
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

  it('PR-SOURCE-008: Source-selected search does not mark tables; Asm search chips + find', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const search = wrapper.find('[data-testid="source-search"]');
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    const findNext = wrapper.find('[data-testid="source-find-next"]');

    expect(findNext.attributes('disabled')).toBeDefined();
    // Default selected pane is Source — query must not paint either metrics table.
    await search.setValue('sharpen');
    await wrapper.vm.$nextTick();
    expect(findNext.attributes('disabled')).toBeUndefined();
    expect(sourceTable.findAll('[data-testid="source-asm-match"]')).toHaveLength(0);
    expect(asmTable.findAll('[data-testid="source-asm-match"]')).toHaveLength(0);
    await findNext.trigger('click');
    await wrapper.vm.$nextTick();
    // Editor find is TODO — caret stays put on Source-selected search.
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);

    // Select SASS pane → Assembly-column search with CLA chips.
    await wrapper.find('[data-testid="source-pane-asm"]').trigger('pointerdown');
    await search.setValue('FFMA');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('[data-testid="source-asm-match"]').length).toBeGreaterThan(0);
    // Address-only needles do not match.
    await search.setValue('00007f7b');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('[data-testid="source-asm-match"]')).toHaveLength(0);

    await search.setValue('FFMA');
    await findNext.trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--current').length).toBe(1);

    await search.setValue('');
    await wrapper.find('[data-testid="source-sort-asc"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmTable.findAll('tr.pr-src-metrics__row--current').length).toBe(1);
  });

  it('PR-SOURCE-018: one pane selected (Source default); outside click keeps selection', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    const sourcePane = wrapper.find('[data-testid="source-pane-source"]');
    const asmPane = wrapper.find('[data-testid="source-pane-asm"]');
    expect(sourcePane.classes()).toContain('pr-source-view__pane--selected');
    expect(asmPane.classes()).not.toContain('pr-source-view__pane--selected');

    await asmPane.trigger('pointerdown');
    await wrapper.vm.$nextTick();
    expect(asmPane.classes()).toContain('pr-source-view__pane--selected');
    expect(sourcePane.classes()).not.toContain('pr-source-view__pane--selected');

    // Chrome / search is outside the panes — must not clear selection.
    await wrapper.find('[data-testid="source-search"]').trigger('pointerdown');
    await wrapper.vm.$nextTick();
    expect(asmPane.classes()).toContain('pr-source-view__pane--selected');

    const src = (await import('./SourceView.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-source-view__pane-body\s*\{[^}]*border:\s*2px solid transparent/);
    expect(src).toMatch(/pane--selected \.pr-source-view__pane-body\s*\{[^}]*border-color:\s*var\(--pr-src-accent/);
    expect(src).not.toMatch(/#2e4a7a/);
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
    const wrapper = mount(SourceView, { props: { model }, attachTo: document.body });
    const asmNav = wrapper.find('[data-testid="source-asm-navigate-by"]');
    expect(asmNav.attributes('disabled')).toBeUndefined();
    await asmNav.trigger('click');
    const stall = document.querySelector(
      '[data-testid="source-asm-navigate-by-menu"] [data-value="samplingStall"]',
    ) as HTMLElement;
    stall.click();
    await wrapper.vm.$nextTick();
    expect(asmNav.text()).toContain('Sampling Stall');
    expect(wrapper.find('[data-testid="source-navigate-by"]').text()).toContain('Instructions Executed');
    wrapper.unmount();
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

  it('PR-SOURCE-014b: second caret echo for the same mapped group keeps asm caret', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model } });
    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    await asmTable.find('tr[data-line="2"]').trigger('click');
    await wrapper.vm.$nextTick();
    const sudu = wrapper.findComponent({ name: 'SuduCodePane' });
    // First echo clears syncOrigin; a second echo must still not snap via mapped[0] / steal pane.
    await sudu.vm.$emit('update:currentLine', 46);
    await wrapper.vm.$nextTick();
    await sudu.vm.$emit('update:currentLine', 46);
    await wrapper.vm.$nextTick();
    expect(asmTable.find('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--current');
    expect(asmTable.find('tr[data-line="1"]').classes()).not.toContain('pr-src-metrics__row--current');
    expect(wrapper.find('[data-testid="source-pane-asm"]').classes()).toContain(
      'pr-source-view__pane--selected',
    );
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

    const search = wrapper.get('[data-testid="source-search"]');
    await search.setValue('FFMA');
    await wrapper.vm.$nextTick();

    const fileSelect = wrapper.find('[data-testid="source-file-select"]');
    await fileSelect.trigger('click');
    const otherOpt = document.querySelector(
      '[data-testid="source-file-select-menu"] [data-value="other.cpp"]',
    ) as HTMLElement;
    otherOpt.click();
    await wrapper.vm.$nextTick();
    expect(fileSelect.text()).toContain('other.cpp');
    expect(sourceTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--current')).toHaveLength(0);
    expect(asmTable.findAll('tr.pr-src-metrics__row--correlated')).toHaveLength(0);
    expect((search.element as HTMLInputElement).value).toBe('FFMA');
  });

  it('PR-SOURCE-017: column resize trades with the next col; other cols stay put', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    const asmHead = wrapper.find('[data-testid="asm-table-pane"] [data-testid="source-metrics-head"]');
    const handle = asmHead.find('[data-testid="source-col-resize"][data-col="assembly"]');
    expect(handle.exists()).toBe(true);
    // Last column has no right neighbor — no handle.
    expect(asmHead.find('[data-testid="source-col-resize"][data-col="warpOccupancy"]').exists()).toBe(
      false,
    );
    const pct = (el: { attributes: (n: string) => string | undefined }) =>
      Number.parseFloat((el.attributes('style') ?? '').match(/width:\s*([\d.]+)%/)?.[1] ?? '0');
    const assembly = asmHead.find('col.pr-src-metrics__col--assembly');
    const instr = asmHead.find('col.pr-src-metrics__col--instructionsExecuted');
    const stall = asmHead.find('col.pr-src-metrics__col--samplingStall');
    const beforeAsm = pct(assembly);
    const beforeInstr = pct(instr);
    const beforeStall = pct(stall);
    await handle.trigger('pointerdown', { button: 0, clientX: 100, pointerId: 1 });
    await handle.trigger('pointermove', { clientX: 160, pointerId: 1 });
    await handle.trigger('pointerup', { pointerId: 1 });
    await wrapper.vm.$nextTick();
    // Boundary assembly|instructionsExecuted moved; stall (further right) unchanged.
    expect(pct(assembly)).toBeGreaterThan(beforeAsm);
    expect(pct(instr)).toBeLessThan(beforeInstr);
    expect(pct(stall)).toBeCloseTo(beforeStall, 5);
  });

  it('PR-SOURCE-019: single-item dropdowns open; popup uses the metric menu', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() }, attachTo: document.body });
    const ids = [
      'source-left-view',
      'source-right-view',
      'source-file-select',
      'source-navigate-by',
      'source-asm-select',
      'source-asm-navigate-by',
    ];
    for (const id of ids) {
      const trigger = wrapper.get(`[data-testid="${id}"]`);
      expect(trigger.element.tagName).toBe('BUTTON');
      expect(trigger.attributes('disabled')).toBeUndefined();
      expect(trigger.classes()).toContain('pr-block-pill');
    }

    await wrapper.get('[data-testid="source-left-view"]').trigger('click');
    const menu = document.querySelector('[data-testid="source-left-view-menu"]');
    expect(menu).toBeTruthy();
    expect(menu?.classList.contains('pr-source-select__menu')).toBe(true);
    const options = menu!.querySelectorAll('[data-testid="source-left-view-option"]');
    expect(options).toHaveLength(1);
    expect(options[0]?.classList.contains('pr-source-select__option--selected')).toBe(true);
    expect(options[0]?.textContent).toContain('Source');

    await wrapper.get('[data-testid="source-asm-select"]').trigger('click');
    const asmMenu = document.querySelector('[data-testid="source-asm-select-menu"]');
    expect(asmMenu?.querySelectorAll('[data-testid="source-asm-select-option"]')).toHaveLength(1);
    expect(asmMenu?.querySelector('.pr-source-select__option--selected')?.textContent).toContain(
      'sharpen[abi:v1,mock-ascendc]',
    );

    const popup = (await import('./SourcePillSelect.vue?raw')).default as string;
    expect(popup).toMatch(/\.pr-source-select__menu\s*\{[^}]*background:\s*#2a2a2a/);
    expect(popup).toMatch(/\.pr-source-select__option--selected\s*\{[^}]*background:\s*#3078f0/);
    expect(popup).toMatch(/border-radius:\s*4px/);
    wrapper.unmount();
  });

  it('PR-SOURCE-020: search reuses the timeline control; clear does not widen it', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    expect(wrapper.find('.pr-source-view__search').exists()).toBe(false);
    expect(wrapper.find('.pr-toolbar__search').exists()).toBe(true);
    const search = wrapper.find('[data-testid="source-search"]');
    await search.setValue('FFMA');
    await wrapper.vm.$nextTick();
    const clear = wrapper.find('[data-testid="source-search-clear"]');
    expect(clear.exists()).toBe(true);
    expect(clear.element.parentElement?.classList.contains('pr-toolbar__search')).toBe(true);

    const src = (await import('../ReportToolbar/ToolbarSearch.vue?raw')).default as string;
    expect(src).toMatch(/width:\s*190px/);
    expect(src).toMatch(/box-sizing:\s*border-box/);
    expect(src).toMatch(/\.pr-toolbar__search-clear\s*\{[^}]*position:\s*absolute/);
    expect(src).toMatch(/flex:\s*0 0 190px/);
    const view = (await import('./SourceView.vue?raw')).default as string;
    expect(view).not.toMatch(/pr-source-view__search/);
    expect(view).toContain('ToolbarSearch');

    await wrapper.find('[data-testid="source-pane-asm"]').trigger('pointerdown');
    await search.trigger('keydown', { key: 'Enter' });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('[data-testid="source-metrics"]')[1]!.findAll('tr.pr-src-metrics__row--current').length).toBe(
      1,
    );
  });

  it('PR-SOURCE-021: editor context menu is Copy only and copies the selection', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    await flushPromises();
    const ed = await latestSuduEditor() as {
      getText?: () => string;
      $editor0?: {
        $model: {
          $selection: {
            $startPos: { $line: number; $charPos: number };
            $endPos: { $line: number; $charPos: number };
          };
        };
      };
    };
    ed.getText = () => 'alpha\nbeta';
    ed.$editor0 = {
      $model: {
        $selection: {
          $startPos: { $line: 0, $charPos: 1 },
          $endPos: { $line: 0, $charPos: 4 },
        },
      },
    };
    const writeText = vi.fn(async () => {});
    const prevClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const host = wrapper.get('[data-testid="sudu-editor-host"]');
    let bubbled = false;
    host.element.addEventListener('contextmenu', () => {
      bubbled = true;
    });
    const opened = host.element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 30,
      clientY: 40,
    }));
    await wrapper.vm.$nextTick();
    expect(opened).toBe(false);
    expect(bubbled).toBe(false);

    const menu = document.querySelector('[data-testid="sudu-context-menu"]');
    expect(menu).toBeTruthy();
    expect(menu?.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
    expect(menu?.textContent).toContain('Copy');
    expect(menu?.textContent ?? '').not.toMatch(/Go to|Align With|Language|Settings/);

    document.querySelector<HTMLButtonElement>('[data-testid="sudu-context-copy"]')?.click();
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith('lph');
    expect(document.querySelector('[data-testid="sudu-context-menu"]')).toBeNull();

    writeText.mockClear();
    ed.$editor0!.$model.$selection.$endPos = { $line: 0, $charPos: 1 };
    host.element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 30,
      clientY: 40,
    }));
    await wrapper.vm.$nextTick();
    document.querySelector<HTMLButtonElement>('[data-testid="sudu-context-copy"]')?.click();
    await flushPromises();
    expect(writeText).not.toHaveBeenCalled();

    host.element.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 12,
      clientY: 12,
    }));
    await wrapper.vm.$nextTick();
    expect(document.querySelector('[data-testid="sudu-context-menu"]')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wrapper.vm.$nextTick();
    expect(document.querySelector('[data-testid="sudu-context-menu"]')).toBeNull();

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: prevClipboard });
    wrapper.unmount();
    expect(document.querySelector('[data-testid="sudu-context-menu"]')).toBeNull();
  });

  it('PR-SOURCE-022: both pane bars wrap together when one overflows', async () => {
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() }, attachTo: document.body });
    await flushPromises();
    const bars = wrapper.findAll('[data-testid="source-pane-bar"]');
    expect(bars).toHaveLength(2);

    function box(el: Element, width: number, which: 'client' | 'offset') {
      Object.defineProperty(el, which === 'client' ? 'clientWidth' : 'offsetWidth', {
        configurable: true,
        value: width,
      });
    }

    const [left, right] = bars.map((b) => b.element);
    // Left fits; right Source + Navigate By does not.
    box(left!, 600, 'client');
    box(left!.querySelector('.pr-source-view__pane-bar-lead')!, 200, 'offset');
    box(left!.querySelector('.pr-source-view__pane-bar-nav')!, 180, 'offset');
    box(right!, 600, 'client');
    box(right!.querySelector('.pr-source-view__pane-bar-lead')!, 450, 'offset');
    box(right!.querySelector('.pr-source-view__pane-bar-nav')!, 180, 'offset');
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="source-view"]').attributes('data-pane-bars')).toBe('two');
    expect(wrapper.get('[data-testid="source-view"]').classes()).toContain('pr-source-view--pane-bars-two');
    expect(wrapper.findAll('.pr-source-view__pane-bar-break')).toHaveLength(2);

    box(right!.querySelector('.pr-source-view__pane-bar-lead')!, 200, 'offset');
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="source-view"]').attributes('data-pane-bars')).toBe('one');
    wrapper.unmount();
  });

  it('PR-SOURCE-023: left pane hides columns until the editor geometry is ready', async () => {
    const { newEditor } = await import('@sudu-ide/code-review');
    const original = vi.mocked(newEditor).getMockImplementation();
    let editorHeight = 0;
    vi.mocked(newEditor).mockImplementationOnce((args) => {
      const ed = (original?.(args) ?? {}) as unknown as Record<string, unknown>;
      return { ...ed, getEditorHeight: () => editorHeight } as ReturnType<typeof newEditor>;
    });
    const wrapper = mount(SourceView, { props: { model: mockSourceCorrelation() } });
    await flushPromises();
    const pane = wrapper.get('[data-testid="sudu-code-pane"]');
    expect(pane.classes()).toContain('pr-sudu-pane--loading');
    expect(pane.attributes('aria-busy')).toBe('true');
    expect(wrapper.find('[data-testid="sudu-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sudu-metrics-header-row"]').exists()).toBe(true);
    expect(pane.find('.pr-sudu-pane__stage').exists()).toBe(true);

    editorHeight = 200;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await wrapper.vm.$nextTick();
    expect(pane.classes()).not.toContain('pr-sudu-pane--loading');
    expect(wrapper.find('[data-testid="sudu-loading"]').exists()).toBe(false);
    expect(pane.attributes('aria-busy')).toBe('false');
    expect(wrapper.find('[data-testid="sudu-editor-host"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="source-metrics"]')[0]!.find('tr[data-line="1"]').exists()).toBe(true);
    if (original) vi.mocked(newEditor).mockImplementation(original);
    wrapper.unmount();
  });

  it('PR-SOURCE-024: asc/desc step the selected pane by its Navigate By metric', async () => {
    const model = mockSourceCorrelation();
    const wrapper = mount(SourceView, { props: { model }, attachTo: document.body });
    await flushPromises();

    function ordered(file: { lines: { line: number; values: Record<string, number | string | null> }[] }, col: string, desc: boolean) {
      const rows = file.lines
        .filter((l) => {
          const v = l.values[col];
          return typeof v === 'number' ? v !== 0 : v != null && v !== '';
        })
        .map((l) => ({
          line: l.line,
          value: typeof l.values[col] === 'number' ? l.values[col] : 0,
        }));
      rows.sort((a, b) => {
        if (a.value !== b.value) return desc ? b.value - a.value : a.value - b.value;
        return desc ? b.line - a.line : a.line - b.line;
      });
      return rows;
    }

    const asmInstr = ordered(model.assembly, 'instructionsExecuted', false);
    const asmStall = ordered(model.assembly, 'samplingStall', false);
    expect(asmInstr[0]!.line).not.toBe(asmStall[0]!.line);

    await wrapper.find('[data-testid="source-link-asm"]').trigger('click');
    await wrapper.find('[data-testid="source-pane-asm"]').trigger('pointerdown');
    // Other pane's Navigate By must not steer this walk.
    await wrapper.get('[data-testid="source-navigate-by"]').trigger('click');
    (document.querySelector(
      '[data-testid="source-navigate-by-menu"] [data-value="samplingStall"]',
    ) as HTMLElement).click();
    await wrapper.vm.$nextTick();

    const asmTable = wrapper.findAll('[data-testid="source-metrics"]')[1]!;
    const asmCurrent = () => {
      const row = asmTable.find('tr.pr-src-metrics__row--current');
      return row.exists() ? Number(row.attributes('data-line')) : null;
    };

    await wrapper.find('[data-testid="source-sort-asc"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmCurrent()).toBe(asmInstr[0]!.line);
    // Action buttons — never stay in the selected/pressed chrome.
    expect(wrapper.find('[data-testid="source-sort-asc"]').classes()).not.toContain(
      'pr-source-view__icon-btn--on',
    );
    expect(wrapper.find('[data-testid="source-sort-asc"]').attributes('aria-pressed')).toBeUndefined();

    await wrapper.find('[data-testid="source-sort-asc"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmCurrent()).toBe(asmInstr[1]!.line);
    expect(asmInstr[1]!.value).toBeGreaterThanOrEqual(asmInstr[0]!.value);

    const asmDesc = ordered(model.assembly, 'instructionsExecuted', true);
    const from = asmCurrent()!;
    const descNext = asmDesc[(asmDesc.findIndex((r) => r.line === from) + 1) % asmDesc.length]!.line;
    await wrapper.find('[data-testid="source-sort-desc"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmCurrent()).toBe(descNext);
    expect(wrapper.find('[data-testid="source-sort-desc"]').classes()).not.toContain(
      'pr-source-view__icon-btn--on',
    );
    expect(wrapper.find('[data-testid="source-sort-desc"]').attributes('aria-pressed')).toBeUndefined();
    expect(wrapper.find('[data-testid="source-sort-asc"]').attributes('aria-label')).toBe(
      t('sourceSortAsc'),
    );
    expect(wrapper.find('[data-testid="source-sort-desc"]').attributes('aria-label')).toBe(
      t('sourceSortDesc'),
    );

    // Last desc line wraps to the highest.
    await asmTable.find(`tr[data-line="${asmDesc[asmDesc.length - 1]!.line}"]`).trigger('click');
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-testid="source-sort-desc"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(asmCurrent()).toBe(asmDesc[0]!.line);

    // Source pane uses its own Navigate By, not the asm selector.
    await wrapper.find('[data-testid="source-pane-source"]').trigger('pointerdown');
    await wrapper.get('[data-testid="source-asm-navigate-by"]').trigger('click');
    (document.querySelector(
      '[data-testid="source-asm-navigate-by-menu"] [data-value="warpOccupancy"]',
    ) as HTMLElement).click();
    await wrapper.vm.$nextTick();
    const sourceStall = ordered(model.files[0]!, 'samplingStall', false);
    const sourceWarp = ordered(model.files[0]!, 'warpOccupancy', false);
    expect(sourceStall[0]!.line).not.toBe(sourceWarp[0]!.line);
    const sourceTable = wrapper.findAll('[data-testid="source-metrics"]')[0]!;
    await wrapper.find('[data-testid="source-sort-asc"]').trigger('click');
    await wrapper.vm.$nextTick();
    const sourceRow = sourceTable.find('tr.pr-src-metrics__row--current');
    expect(Number(sourceRow.attributes('data-line'))).toBe(sourceStall[0]!.line);
    wrapper.unmount();
  });
});
