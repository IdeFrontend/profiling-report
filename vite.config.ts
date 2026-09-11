import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.lib.json',
      rollupTypes: true,
    }),
  ],
  build: {
    // Lib mode inlines every JS-referenced asset no matter what this is set to: Vite's
    // `shouldInline` returns true as soon as `build.lib` is set, before it reads the limit.
    // The limit therefore only governs CSS `url()` references — the icon masks, largest
    // ~4 kB — and raising it past 4 KiB keeps those inlined rather than emitting requests the
    // consuming app never serves. The 200 kB memory-topology chrome is a JS reference, so it
    // opts out explicitly: it is imported with `?no-inline` (checked before the lib
    // short-circuit) and ships as `dist/memory-topology.svg`, a file the host serves next to
    // the bundle instead of carrying it as base64 in the JS.
    assetsInlineLimit: 8192,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ProfilingReport',
      fileName: 'profiling-report',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
});
