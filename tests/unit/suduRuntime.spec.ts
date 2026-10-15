import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSourceTabFontsForTests } from '../../src/ui/SourceView/sourceFonts';
import {
  applySuduLangOptions,
  ASCEND_C_LANG,
  enableAscendC,
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

  it('enableAscendC disables all then enables ascend-c (code-review sample)', async () => {
    const api = await loadSuduApi();
    const opts = enableAscendC(api);
    expect(opts).not.toBeNull();
    expect(api.newLangOptions).toHaveBeenCalledTimes(1);
    expect(opts!.disableAll).toHaveBeenCalledTimes(1);
    expect(opts!.enable).toHaveBeenCalledWith(ASCEND_C_LANG);
  });

  it('enableAscendC returns null when newLangOptions is missing', () => {
    expect(enableAscendC({ newLangOptions: undefined as never })).toBeNull();
  });

  it('applySuduLangOptions replaces supplier and Editor0.$langOptions', () => {
    const javaOpts = { tag: 'ascend-lang-opts' };
    const editor0 = { $langOptions: { tag: 'default' } };
    const editor = {
      $editor0: { $getLangOptions: { $_02: editor0 } as { $_02: typeof editor0; $get0?: () => unknown } },
    };
    applySuduLangOptions(editor as never, { $javaLangOptions: javaOpts } as never);
    expect(editor0.$langOptions).toBe(javaOpts);
    expect(editor.$editor0.$getLangOptions.$get0?.()).toBe(javaOpts);
  });
});
