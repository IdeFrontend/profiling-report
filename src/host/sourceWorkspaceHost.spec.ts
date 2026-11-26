import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickSourceWorkspace } from './sourceWorkspaceHost';

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
    const promise = pickSourceWorkspace([{ fileName: '/sdk/kernel.asc', basename: 'kernel.asc' }]);
    const input = hiddenInput()!;
    window.dispatchEvent(new Event('focus'));

    await expect(promise).resolves.toBeNull();
    expect(input.isConnected).toBe(false);
    expect(hiddenInput()).toBeNull();
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
