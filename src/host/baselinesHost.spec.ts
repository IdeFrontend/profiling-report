import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBaselinesHost } from './baselinesHost';

/** Files-like target for onFileChosen — the host never reads beyond these fields. */
function fileEvent(name: string, size = 10, lastModified = 123): Event {
  const el = { files: [{ name, size, lastModified }], value: '' };
  return { target: el } as unknown as Event;
}

/** Host with a real input in the DOM; the native dialog itself never opens. */
function hostWithInput() {
  const input = document.createElement('input');
  input.type = 'file';
  const click = vi.spyOn(input, 'click').mockImplementation(() => {});
  return { host: createBaselinesHost(() => input), input, click };
}

describe('createBaselinesHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty — no storage, the host seeds and applies the library emits', () => {
    const host = createBaselinesHost(() => null);
    expect(host.baselines.value).toEqual([]);
    expect(host.selectedBaselineId.value).toBeNull();
    expect(host.selectedBaselineOperator.value).toBeNull();

    host.onBaselinesUpdate([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    host.onSelectedBaselineId('b1');
    host.onSelectedBaselineOperator('matmul');
    expect(host.baselines.value).toEqual([{ id: 'b1', name: 'a', path: '/a.npu-rep' }]);
    expect(host.selectedBaselineId.value).toBe('b1');
    expect(host.selectedBaselineOperator.value).toBe('matmul');
    host.onSelectedBaselineOperator(null);
    expect(host.selectedBaselineOperator.value).toBeNull();

    // Session-only by design: nothing survives a page reload, and no storage is
    // touched anywhere (persistence belongs to a real host like MSTT).
    const fresh = createBaselinesHost(() => null);
    expect(fresh.baselines.value).toEqual([]);
    expect(fresh.selectedBaselineId.value).toBeNull();
    expect(fresh.selectedBaselineOperator.value).toBeNull();
  });

  it('resolves the pick with a disambiguated pseudo-path; cancel resolves null', async () => {
    const { host, click } = hostWithInput();
    const pending = host.pickBaselineFile();
    host.onFileChosen(fileEvent('profile.npu-rep', 42, 7));
    const pick = await pending;
    expect(pick).toEqual({ name: 'profile.npu-rep', path: 'profile.npu-rep (42 B, 7)' });
    expect(click).toHaveBeenCalledTimes(1);
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
    const { host } = hostWithInput();
    const pending = host.pickBaselineFile();
    const el = { files: [], value: '' };
    host.onFileChosen({ target: el } as unknown as Event);
    expect(await pending).toBeNull();
  });

  it('settles a replaced pick with null and resolves immediately without an input', async () => {
    const { host, click } = hostWithInput();
    const first = host.pickBaselineFile();
    const second = host.pickBaselineFile();
    expect(click).toHaveBeenCalledTimes(2);
    // The orphaned first promise settles instead of leaking.
    await expect(first).resolves.toBeNull();
    host.onPickCancel();
    await expect(second).resolves.toBeNull();

    // No input in the host DOM → Browse must not hang.
    const bare = createBaselinesHost(() => null);
    await expect(bare.pickBaselineFile()).resolves.toBeNull();
  });
});
