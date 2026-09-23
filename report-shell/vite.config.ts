import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname);
const svgPath = resolve(root, '../src/ui/StatsAside/MemoryTopologyPanel/memory-topology.svg');

/**
 * Shell builds must be self-contained (file:// / CI artifact). The library keeps
 * `?url&no-inline` for MSTT hosts; here we rewrite that import to a data URL so
 * MemoryTopologyPanel does not fetch `/memory-topology.svg`.
 */
function inlineMemoryTopologySvg(): Plugin {
  const virtualId = '\0npu-rep-memory-topology-data-url';
  return {
    name: 'inline-memory-topology-svg',
    enforce: 'pre',
    resolveId(id) {
      if (id.includes('memory-topology.svg')) return virtualId;
      return null;
    },
    load(id) {
      if (id !== virtualId) return null;
      const b64 = readFileSync(svgPath).toString('base64');
      return `export default ${JSON.stringify(`data:image/svg+xml;base64,${b64}`)};`;
    },
  };
}

export default defineConfig({
  root,
  plugins: [inlineMemoryTopologySvg(), vue()],
  resolve: {
    alias: {
      '@profiling-report': resolve(root, '../src'),
    },
  },
  build: {
    outDir: resolve(root, '../dist/report-shell'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: {
      input: resolve(root, 'index.html'),
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/shell.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
