import type { ResolveSourceFileRequest } from '../adapters/sourceCorrelation/resolveSourceFile';

const REQUEST_TYPE = 'profiling-report/source-file-request';
const RESPONSE_TYPE = 'profiling-report/source-file-response';
const TIMEOUT_MS = 10_000;

type VsCodeApi = { postMessage(message: unknown): void };

type VsCodeWindow = Window & {
  acquireVsCodeApi?: () => VsCodeApi;
  vscode?: VsCodeApi;
};

let cachedAcquire: (() => VsCodeApi) | undefined;
let cachedApi: VsCodeApi | undefined;
let nextRequestId = 0;

/** VS Code throws on a second `acquireVsCodeApi`; memoize per acquire function. */
function vsCodeApi(): VsCodeApi | null {
  // Hosts such as MSTT acquire the API at module load and expose it on `window`.
  const hostApi = (window as VsCodeWindow).vscode;
  if (hostApi && typeof hostApi.postMessage === 'function') return hostApi;
  const acquire = (window as VsCodeWindow).acquireVsCodeApi;
  if (typeof acquire !== 'function') return null;
  if (cachedAcquire === acquire && cachedApi) return cachedApi;
  try {
    cachedApi = acquire();
    cachedAcquire = acquire;
    return cachedApi;
  } catch {
    return null;
  }
}

export function hasVsCodeHost(): boolean {
  return vsCodeApi() !== null;
}

/**
 * Ask the VS Code extension for source text the report pack did not embed.
 * Resolves `null` when no host exists, the host replies without text, or the
 * host does not answer within 10 s.
 */
export function requestSourceFile(
  request: ResolveSourceFileRequest,
): Promise<string | null> {
  const api = vsCodeApi();
  if (!api) return Promise.resolve(null);
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${++nextRequestId}`;
    let settled = false;
    const finish = (text: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(text);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: unknown; requestId?: unknown; text?: unknown }
        | null
        | undefined;
      if (!data || data.type !== RESPONSE_TYPE || data.requestId !== requestId) return;
      finish(typeof data.text === 'string' ? data.text : null);
    };
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    try {
      api.postMessage({
        type: REQUEST_TYPE,
        requestId,
        fileName: request.fileName,
        basename: request.basename,
      });
    } catch {
      finish(null);
    }
  });
}
