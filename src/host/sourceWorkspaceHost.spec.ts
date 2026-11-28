import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickSourceWorkspace, SOURCE_WORKSPACE_FOCUS_CANCEL_MS } from './sourceWorkspaceHost';

type FakeFile = {
  name: string;
  webkitRelativePath: string;
  text: () => Promise<string>;
};

function hiddenInput(): HTMLInputElement | null {
  return document.body.querySelector('input[type="file"][webkitdirectory]');
}

function setFiles(input: HTMLInputElement, files: FakeFile[]): void {
  Object.defineProperty(input, 'files', { configurable: true, value: files });
}

afterEach(() => {
  document.body.querySelectorAll('input[webkitdirectory]').forEach((input) => input.remove());
});

describe('pickSourceWorkspace host', () => {
  it('reads only the requested basenames and returns their relative paths', async () => {
    const wanted = vi.fn(async () => 'int kernel() {}\n');
    const unwanted = vi.fn(async () => 'nope\n');
    const promise = pickSourceWorkspace([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const input = hiddenInput()!;
    setFiles(input, [
      { name: 'kernel.asc', webkitRelativePath: 'ws/src/kernel.asc', text: wanted },
      { name: 'other.asc', webkitRelativePath: 'ws/src/other.asc', text: unwanted },
    ]);
    input.dispatchEvent(new Event('change'));

    await expect(promise).resolves.toEqual({
      files: [{ path: 'ws/src/kernel.asc', text: 'int kernel() {}\n' }],
    });
    expect(wanted).toHaveBeenCalledTimes(1);
    expect(unwanted).not.toHaveBeenCalled();
    expect(hiddenInput()).toBeNull();
  });

  it('resolves null and removes the input on cancel', async () => {
    const promise = pickSourceWorkspace([{ fileName: '/sdk/kernel.asc', basename: 'kernel.asc' }]);
    const input = hiddenInput()!;
    input.dispatchEvent(new Event('cancel'));

    await expect(promise).resolves.toBeNull();
    expect(hiddenInput()).toBeNull();
  });

  it('resolves null when the dialog closes without change or cancel', async () => {
    vi.useFakeTimers();
    const promise = pickSourceWorkspace([{ fileName: '/sdk/kernel.asc', basename: 'kernel.asc' }]);
    const input = hiddenInput()!;
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(SOURCE_WORKSPACE_FOCUS_CANCEL_MS);

    await expect(promise).resolves.toBeNull();
    expect(input.isConnected).toBe(false);
    expect(hiddenInput()).toBeNull();
    vi.useRealTimers();
  });

  it('keeps a pick when focus returns before change', async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => 'int kernel() {}\n');
    const promise = pickSourceWorkspace([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const input = hiddenInput()!;
    window.dispatchEvent(new Event('focus'));
    setFiles(input, [
      { name: 'kernel.asc', webkitRelativePath: 'ws/src/kernel.asc', text: read },
    ]);
    input.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(SOURCE_WORKSPACE_FOCUS_CANCEL_MS);

    await expect(promise).resolves.toEqual({
      files: [{ path: 'ws/src/kernel.asc', text: 'int kernel() {}\n' }],
    });
    expect(read).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('reads a basename that differs only by case', async () => {
    const read = vi.fn(async () => 'int Kernel() {}\n');
    const promise = pickSourceWorkspace([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const input = hiddenInput()!;
    setFiles(input, [
      { name: 'Kernel.asc', webkitRelativePath: 'ws/src/Kernel.asc', text: read },
    ]);
    input.dispatchEvent(new Event('change'));

    await expect(promise).resolves.toEqual({
      files: [{ path: 'ws/src/Kernel.asc', text: 'int Kernel() {}\n' }],
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps a pick whose change lands well after focus', async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => 'int kernel() {}\n');
    const promise = pickSourceWorkspace([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const input = hiddenInput()!;
    window.dispatchEvent(new Event('focus'));
    // Slower than a frame, far below the fallback: some hosts deliver `change` late.
    await vi.advanceTimersByTimeAsync(1000);
    setFiles(input, [
      { name: 'kernel.asc', webkitRelativePath: 'ws/src/kernel.asc', text: read },
    ]);
    input.dispatchEvent(new Event('change'));

    await expect(promise).resolves.toEqual({
      files: [{ path: 'ws/src/kernel.asc', text: 'int kernel() {}\n' }],
    });
    vi.useRealTimers();
  });

  it('adopts the files already picked when the change event never fires', async () => {
    vi.useFakeTimers();
    const read = vi.fn(async () => 'int kernel() {}\n');
    const promise = pickSourceWorkspace([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const input = hiddenInput()!;
    window.dispatchEvent(new Event('focus'));
    setFiles(input, [
      { name: 'kernel.asc', webkitRelativePath: 'ws/src/kernel.asc', text: read },
    ]);
    await vi.advanceTimersByTimeAsync(SOURCE_WORKSPACE_FOCUS_CANCEL_MS);

    await expect(promise).resolves.toEqual({
      files: [{ path: 'ws/src/kernel.asc', text: 'int kernel() {}\n' }],
    });
    vi.useRealTimers();
  });

  it('keeps the picked files when focus follows change', async () => {
    const read = vi.fn(async () => 'int kernel() {}\n');
    const promise = pickSourceWorkspace([
      { fileName: '/sdk/kernel.asc', basename: 'kernel.asc' },
    ]);
    const input = hiddenInput()!;
    setFiles(input, [
      { name: 'kernel.asc', webkitRelativePath: 'ws/src/kernel.asc', text: read },
    ]);
    input.dispatchEvent(new Event('change'));
    window.dispatchEvent(new Event('focus'));

    await expect(promise).resolves.toEqual({
      files: [{ path: 'ws/src/kernel.asc', text: 'int kernel() {}\n' }],
    });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
