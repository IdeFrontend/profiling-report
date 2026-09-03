export declare const MIN_SUPPORTED_VERSION: string;
export declare function parseVersion(out: string): number[] | null;
export declare function compareVersions(a: number[], b: number[]): number;
export declare function resolveNpuCompute(
  opts?: {
    explicitPath?: string;
    allowDownload?: boolean;
    cacheDir?: string;
  },
  deps?: {
    versionCheck?: (bin: string) => Promise<{ ok: boolean; version?: string; reason?: string }>;
    isExecutable?: (file: string) => Promise<boolean>;
    findOnPath?: (name: string) => Promise<string | null>;
    download?: (cacheDir?: string) => Promise<string>;
  },
): Promise<{ bin: string; source: 'explicit' | 'autodetect' | 'download' }>;
