import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSourceTabFontsForTests } from '../../src/ui/SourceView/sourceFonts';
import {
  getSuduWorkerPool,
  loadSuduApi,
  resetSuduRuntimeForTests,
} from '../../src/ui/SourceView/suduRuntime';

vi.mock('@sudu-ide/code-review', () => {
  const newWorkerPool = vi.fn(async () => ({ getNumThreads: () => 3 }));
  return {
    newWorkerPool,
    loadFonts: vi.fn(async () => []),
    newEditor: vi.fn(),
    newTextModel: vi.fn(),
    newLangOptions: vi.fn(() => ({
      disableAll: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      enableAll: vi.fn(),
      isEnabled: vi.fn(() => false),
    })),
  };
});

describe('suduRuntime cache', () => {
  afterEach(() => {
    resetSuduRuntimeForTests();
    resetSourceTabFontsForTests();
    vi.clearAllMocks();
  });

  it('getSuduWorkerPool returns the same promise for the same URL', async () => {
    const api = await loadSuduApi();
    const a = getSuduWorkerPool('/sudu/worker.js', 3);
    const b = getSuduWorkerPool('/sudu/worker.js', 3);
    expect(a).toBe(b);
    await a;
    expect(api.newWorkerPool).toHaveBeenCalledTimes(1);
    expect(api.newWorkerPool).toHaveBeenCalledWith('/sudu/worker.js', 3);
  });

  it('different URLs get different pools', async () => {
    const api = await loadSuduApi();
    await getSuduWorkerPool('/a.js', 3);
    await getSuduWorkerPool('/b.js', 3);
    expect(api.newWorkerPool).toHaveBeenCalledTimes(2);
  });

});
