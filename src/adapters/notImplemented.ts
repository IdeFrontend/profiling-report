export function notImplemented(api: string): never {
  throw new Error(`[profiling-report] ${api} is not implemented yet`);
}
