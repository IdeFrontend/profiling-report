import { afterEach, describe, expect, it, vi } from 'vitest';

import { hasVsCodeHost, onSourceFileUpdate, requestSourceFile } from './vscodeSourceFile';

type VsCodeApi = { postMessage: (message: unknown) => void };
type VsCodeWindow = Window & {
  acquireVsCodeApi?: () => VsCodeApi;
  vscode?: VsCodeApi;
};

const host = window as VsCodeWindow;

afterEach(() => {
  delete host.acquireVsCodeApi;
  delete host.vscode;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('vscodeSourceFile bridge', () => {
  it('PR-SRC-012: no VS Code API means no host and a null resolve', async () => {
    expect(hasVsCodeHost()).toBe(false);
    await expect(
      requestSourceFile({ fileName: '/build/gather_2d.asc', basename: 'gather_2d.asc' }),
    ).resolves.toBeNull();
  });

  it('PR-SRC-012: prefers the host-provided window.vscode API', async () => {
    const postMessage = vi.fn();
    const acquire = vi.fn(() => ({ postMessage: vi.fn() }));
    host.vscode = { postMessage };
    host.acquireVsCodeApi = acquire;
    expect(hasVsCodeHost()).toBe(true);

    const pending = requestSourceFile({
      fileName: '/build/gather_2d.asc',
      basename: 'gather_2d.asc',
    });
    const sent = postMessage.mock.calls[0]![0] as {
      type: string;
      requestId: string;
    };
    expect(sent.type).toBe('profiling-report/source-file-request');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'profiling-report/source-file-response',
          requestId: sent.requestId,
          text: 'via window.vscode',
        },
      }),
    );
    await expect(pending).resolves.toBe('via window.vscode');
    expect(acquire).not.toHaveBeenCalled();
  });

  it('PR-SRC-012: posts the exact request and resolves the matching reply', async () => {
    const postMessage = vi.fn();
    const acquire = vi.fn(() => ({ postMessage }));
    host.acquireVsCodeApi = acquire;
    expect(hasVsCodeHost()).toBe(true);
    expect(hasVsCodeHost()).toBe(true);
    expect(acquire).toHaveBeenCalledTimes(1);

    const pending = requestSourceFile({
      fileName: '/build/gather_2d.asc',
      basename: 'gather_2d.asc',
    });
    const sent = postMessage.mock.calls[0]![0] as {
      type: string;
      requestId: string;
      fileName: string;
      basename: string;
    };
    expect(sent).toEqual({
      type: 'profiling-report/source-file-request',
      requestId: expect.any(String),
      fileName: '/build/gather_2d.asc',
      basename: 'gather_2d.asc',
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'profiling-report/source-file-response',
          requestId: sent.requestId,
          text: 'extern "C" void gather_2d_custom() {}\n',
        },
      }),
    );
    await expect(pending).resolves.toBe('extern "C" void gather_2d_custom() {}\n');
  });

  it('PR-SRC-012: ignores replies with another requestId or type', async () => {
    const postMessage = vi.fn();
    host.acquireVsCodeApi = () => ({ postMessage });
    const pending = requestSourceFile({ fileName: '/a.asc', basename: 'a.asc' });
    const sent = postMessage.mock.calls[0]![0] as { requestId: string };

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'profiling-report/source-file-response',
          requestId: 'other',
          text: 'wrong-id',
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'unrelated',
          requestId: sent.requestId,
          text: 'wrong-type',
        },
      }),
    );
    const resolved = vi.fn();
    void pending.then(resolved);
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'profiling-report/source-file-response',
          requestId: sent.requestId,
          text: 'right',
        },
      }),
    );
    await expect(pending).resolves.toBe('right');
  });

  it('PR-SRC-012: times out to null and removes the listener', async () => {
    vi.useFakeTimers();
    host.acquireVsCodeApi = () => ({ postMessage: vi.fn() });
    const remove = vi.spyOn(window, 'removeEventListener');
    const pending = requestSourceFile({ fileName: '/a.asc', basename: 'a.asc' });

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toBeNull();
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('PR-SRC-013: source-file-updated forwards valid payloads and unsubscribes', () => {
    const cb = vi.fn();
    const unsubscribe = onSourceFileUpdate(cb);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'profiling-report/source-file-updated',
          fileName: '/build/a.asc',
          basename: 'a.asc',
          text: 'extern "C" void updated() {}\n',
        },
      }),
    );
    expect(cb).toHaveBeenCalledWith({
      fileName: '/build/a.asc',
      basename: 'a.asc',
      text: 'extern "C" void updated() {}\n',
    });

    // Malformed payloads are ignored silently.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'profiling-report/source-file-updated', fileName: '/build/a.asc' },
      }),
    );
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'profiling-report/source-file-updated',
          fileName: '/build/a.asc',
          basename: 'a.asc',
          text: 'after',
        },
      }),
    );
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
