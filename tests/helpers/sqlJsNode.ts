import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';
import { configurePcSamplingSql } from '../../src/adapters/sourceCorrelation/readPcSamplingDb';

const require = createRequire(import.meta.url);

/** Wire Node wasm bytes for vitest (library itself does not import node:fs). */
export function configurePcSamplingSqlForNodeTests(): void {
  configurePcSamplingSql({
    initSqlJs: initSqlJs as never,
    wasmBinary: new Uint8Array(readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))),
  });
}
