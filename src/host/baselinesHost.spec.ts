import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createBaselinesHost } from './baselinesHost';
import { loadOutRepBytes } from '../../tests/helpers/fixtures';

/** Files-like target for onFileChosen — the host never reads beyond these fields. */
function fileEvent(name: string, size = 10, lastModified = 123): Event {
  const el = { files: [{ name, size, lastModified }], value: '' };
  return { target: el } as unknown as Event;
}

/** A real File the host retains and adapts (Browse flow). */
function realFileEvent(name: string, bytes: Uint8Array, lastModified = 123): Event {
  const file = new File([bytes.buffer as ArrayBuffer], name, { lastModified });
  const el = { files: [file], value: '' };
  return { target: el } as unknown as Event;
}

describe('createBaselinesHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty — no storage, the host seeds and applies the library emits', () => {
    const host = createBaselinesHost(() => null);
    expect(host.baselines.value).toEqual([]);
    expect(host.selectedBaselineId.value).toBeNull();

    host.onBaselinesUpdate([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    host.onSelectedBaselineId('b1');
    expect(host.baselines.value).toEqual([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    expect(host.selectedBaselineId.value).toBe('b1');

    // Session-only by design: nothing survives a page reload, and no storage is
    // touched anywhere (persistence belongs to a real host like MSTT).
    const fresh = createBaselinesHost(() => null);
    expect(fresh.baselines.value).toEqual([]);
    expect(fresh.selectedBaselineId.value).toBeNull();
  });

  it('resolves the pick with a disambiguated pseudo-path; cancel resolves null', async () => {
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 42, 7));
    const pick = await pending;
    expect(pick).toEqual({ name: 'profile.npu-rep', path: 'profile.npu-rep (42 B, 7)' });
    // Same name, different size/mtime → different path (no false dedupe).
    const second = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 99, 8));
    expect(await second).toEqual({ name: 'profile.npu-rep', path: 'profile.npu-rep (99 B, 8)' });

    const cancelled = host.pickBaselineFile();
    host.onPickCancel();
    expect(await cancelled).toBeNull();

    // A change with no pending pick is a no-op.
    expect(() => host.onFileChosen(fileEvent('stale.npu-rep'))).not.toThrow();
  });

  it('resolves null when the change event carries no file', async () => {
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    const el = { files: [], value: '' };
    host.onFileChosen({ target: el } as unknown as Event);
    expect(await pending).toBeNull();
  });

  it('adapts the selected baseline file into baselineReport via loadReportSource', async () => {
    const host = createBaselinesHost(() => null);
    // Browse: the pick resolves with the pseudo-path; the bytes stay in the glue.
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    const pick = await pending;
    expect(pick?.name).toBe('out.rep');

    // The picker emits the checked set; the entry carries the same pseudo-path.
    const entry = { id: 'b1', name: 'out.rep', path: pick!.path };
    host.onBaselinesUpdate([entry]);
    host.onSelectedBaselineId('b1');
    await flushPromises();

    const adapted = host.baselineReport.value;
    expect(adapted).not.toBeNull();
    expect(adapted!.baselineId).toBe('b1');
    expect(adapted!.report.reportModel).toBeDefined();

    // Deselecting (Not selected) drops the payload.
    host.onSelectedBaselineId(null);
    await flushPromises();
    expect(host.baselineReport.value).toBeNull();
  });

  it('a selected entry without retained bytes degrades to no comparison', async () => {
    const host = createBaselinesHost(() => null);
    // Non-demo entry without retained bytes: in the list, selected, but never
    // picked through Browse (path outside /data — no fetch fallback).
    host.onBaselinesUpdate([{ id: 'other-1', name: 'OPPROF_X', path: '/opprof/x' }]);
    host.onSelectedBaselineId('other-1');
    await flushPromises();
    expect(host.baselineReport.value).toBeNull();
  });

  it('a demo entry fetches its fixture bytes and adapts them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(loadOutRepBytes().buffer as ArrayBuffer, { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const host = createBaselinesHost(() => null);
    host.onBaselinesUpdate([{ id: 'demo-recent-1', name: 'OPPROF_A', path: '/data/out.rep' }]);
    host.onSelectedBaselineId('demo-recent-1');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith('/data/out.rep');
    const adapted = host.baselineReport.value;
    expect(adapted?.baselineId).toBe('demo-recent-1');
    expect(adapted?.report.reportModel).toBeDefined();
    vi.unstubAllGlobals();

    // A 404 (e.g. the exported HTML shell has no /data files) degrades.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const miss = createBaselinesHost(() => null);
    miss.onBaselinesUpdate([{ id: 'demo-recent-1', name: 'OPPROF_A', path: '/data/out.rep' }]);
    miss.onSelectedBaselineId('demo-recent-1');
    await flushPromises();
    expect(miss.baselineReport.value).toBeNull();
    vi.unstubAllGlobals();
  });

  it('a corrupt file degrades with a warning, never an error state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('broken.rep', new Uint8Array([1, 2, 3, 4])));
    const pick = await pending;
    host.onBaselinesUpdate([{ id: 'b1', name: 'broken.rep', path: pick!.path }]);
    host.onSelectedBaselineId('b1');
    await flushPromises();
    expect(host.baselineReport.value).toBeNull();
    expect(warn).toHaveBeenCalledWith('[baselinesHost] baseline adaptation failed', expect.anything());
  });

  it('re-picking the same file re-adapts (pickNonce bump after a stale payload)', async () => {
    const host = createBaselinesHost(() => null);
    const pending = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    const pick = await pending;
    const entry = { id: 'b1', name: 'out.rep', path: pick!.path };
    host.onBaselinesUpdate([entry]);
    host.onSelectedBaselineId('b1');
    await flushPromises();
    expect(host.baselineReport.value?.baselineId).toBe('b1');

    // The same file picked again (e.g. after a reload lost the payload):
    // the nonce re-runs the adaptation against the retained bytes.
    const again = host.pickBaselineFile();
    host.onFileChosen(realFileEvent('out.rep', loadOutRepBytes()));
    await again;
    host.onBaselinesUpdate([entry]);
    await flushPromises();
    expect(host.baselineReport.value?.baselineId).toBe('b1');
  });
});
