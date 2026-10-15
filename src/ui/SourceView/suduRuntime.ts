/**
 * Process-lifetime Sudu runtime cache.
 *
 * WorkerPool has no dispose/terminate in @sudu-ide/code-review — recreating a
 * pool on every Source tab mount leaks OS threads. Cache by workerUrl + thread
 * count and only dispose EditorView / ITextModel at the pane level.
 */

export type SuduApi = typeof import('@sudu-ide/code-review');
export type SuduWorkerPool = Awaited<ReturnType<SuduApi['newWorkerPool']>>;
export type SuduLangOptions = ReturnType<SuduApi['newLangOptions']>;
export type SuduEditorView = ReturnType<SuduApi['newEditor']>;

type PoolKey = string;

const pools = new Map<PoolKey, Promise<SuduWorkerPool>>();
let fontsPromise: Promise<FontFace[]> | null = null;
let apiPromise: Promise<SuduApi> | null = null;

export const DEFAULT_SUDU_THREADS = 3;

/** Sudu language id for Ascend C (Languages.ASCEND_C). */
export const ASCEND_C_LANG = 'ascend-c';

/**
 * Resolve Sudu API. TeaVM installs factories on `globalThis`/`self`; Vite can
 * also serve a stale prebundle that omits newer named exports (e.g.
 * `newLangOptions` in 0.0.130-alpha4) — merge both so upgrades work after
 * `rm -rf node_modules/.vite`.
 */
export function loadSuduApi(): Promise<SuduApi> {
  return (apiPromise ??= import('@sudu-ide/code-review').then((mod) => {
    const g = globalThis as typeof globalThis & Partial<SuduApi>;
    return new Proxy(mod, {
      get(target, prop, receiver) {
        const fromMod = Reflect.get(target, prop, receiver);
        if (fromMod != null) return fromMod;
        if (typeof prop === 'string' && prop in g) {
          return (g as Record<string, unknown>)[prop];
        }
        return fromMod;
      },
    }) as SuduApi;
  }));
}

export function getSuduWorkerPool(
  workerUrl: string,
  numThreads = DEFAULT_SUDU_THREADS,
): Promise<SuduWorkerPool> {
  const key = `${workerUrl}::${numThreads}`;
  let p = pools.get(key);
  if (!p) {
    p = loadSuduApi().then((api) => api.newWorkerPool(workerUrl, numThreads));
    pools.set(key, p);
  }
  return p;
}

type LangOptionsFactory = SuduApi['newLangOptions'];

function resolveNewLangOptions(api: Pick<SuduApi, 'newLangOptions'>): LangOptionsFactory | null {
  const fromApi = api.newLangOptions;
  if (typeof fromApi === 'function') return fromApi;
  const g = globalThis as typeof globalThis & { newLangOptions?: LangOptionsFactory };
  return typeof g.newLangOptions === 'function' ? g.newLangOptions : null;
}

/**
 * Ascend C LangOptions — same recipe as code-review sample `langOptions.js`:
 * `disableAll()` then `enable('ascend-c')`. Cpp must stay off: when both are
 * enabled, Model.language() forces cpp and AscendC highlighting never runs.
 *
 * Returns null when `newLangOptions` is missing (stale Vite prebundle).
 */
export function enableAscendC(api: Pick<SuduApi, 'newLangOptions'>): SuduLangOptions | null {
  const create = resolveNewLangOptions(api);
  if (!create) return null;
  const langOptions = create();
  langOptions.disableAll();
  langOptions.enable(ASCEND_C_LANG);
  return langOptions;
}

/**
 * Wire LangOptions onto a single editor.
 *
 * `@sudu-ide/code-review` `newEditor` ignores `EditArgs.langOptions` (demo-edit
 * and `newCodeReview` apply it). Mirror JsCodeReview: replace the component's
 * `$getLangOptions` supplier before setModel.
 */
export function applySuduLangOptions(
  editor: SuduEditorView,
  langOptions: SuduLangOptions,
): void {
  const java = (langOptions as { $javaLangOptions?: unknown }).$javaLangOptions;
  if (!java) return;
  type EditorComponent = {
    $getLangOptions?: { $get0?: () => unknown; $_02?: { $langOptions: unknown }; $_09?: unknown };
  };
  const component = (editor as { $editor0?: EditorComponent }).$editor0;
  if (!component) return;
  // Keep Editor0 in sync when the default lambda is still attached.
  const editor0 = component.$getLangOptions?.$_02;
  if (editor0) editor0.$langOptions = java;
  // Same shape as JsCodeReview$_init_$lambda$_0_1 (Supplier.get → java LangOptions).
  component.$getLangOptions = {
    $_09: java,
    $get0() {
      return java;
    },
  };
}

/** Optional: call once when the host supplies a codicon font URL. */
export function ensureSuduFonts(codiconUrl: string): Promise<FontFace[]> {
  return (fontsPromise ??= loadSuduApi().then((api) => api.loadFonts(codiconUrl)));
}

/** Test helper — clears module caches (does not terminate live workers). */
export function resetSuduRuntimeForTests(): void {
  pools.clear();
  fontsPromise = null;
  apiPromise = null;
}
