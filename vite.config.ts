import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Ship HarmonyOS Sans license next to dist so published packages retain the Agreement. */
function copyFontLicense() {
  return {
    name: 'copy-harmonyos-font-license',
    closeBundle() {
      mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
      copyFileSync(
        resolve(__dirname, 'src/assets/fonts/LICENSE.txt'),
        resolve(__dirname, 'dist/LICENSE-HarmonyOS-Sans.txt'),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.lib.json',
      rollupTypes: true,
    }),
    copyFontLicense(),
  ],
  build: {
    assetsInlineLimit: 0,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ProfilingReport',
      fileName: 'profiling-report',
      cssFileName: 'profiling-report',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';
          if (/\.woff2$/i.test(name)) {
            return 'fonts/[name][extname]';
          }
          return '[name][extname]';
        },
      },
    },
  },
});
