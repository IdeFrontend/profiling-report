import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONT_FILES = [
  'HarmonyOS_Sans_SC_Light.woff2',
  'HarmonyOS_Sans_SC_Regular.woff2',
  'HarmonyOS_Sans_SC_Semibold.woff2',
] as const;

const FONT_URL_RE =
  /url\(\s*['"]?\.\.\/assets\/fonts\/([^'?]+)(?:\?[^'"]*)?['"]?\s*\)/g;

function rewriteFontUrls(css: string): string {
  return css.replace(FONT_URL_RE, "url('./fonts/$1')");
}

/** Ship HarmonyOS Sans license + stable CSS filenames next to dist. */
function copyFontArtifacts() {
  return {
    name: 'copy-harmonyos-font-artifacts',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      const srcFonts = resolve(__dirname, 'src/assets/fonts');
      const fontsDir = resolve(dist, 'fonts');
      mkdirSync(fontsDir, { recursive: true });
      copyFileSync(
        resolve(srcFonts, 'LICENSE.txt'),
        resolve(dist, 'LICENSE-HarmonyOS-Sans.txt'),
      );
      copyFileSync(resolve(srcFonts, 'LICENSE.txt'), resolve(fontsDir, 'LICENSE.txt'));
      for (const file of FONT_FILES) {
        copyFileSync(resolve(srcFonts, file), resolve(fontsDir, file));
      }
      // With cssCodeSplit, Vite may emit index.css for the lib entry — keep package export path.
      const indexCss = resolve(dist, 'index.css');
      const reportCss = resolve(dist, 'profiling-report.css');
      try {
        copyFileSync(indexCss, reportCss);
      } catch {
        /* already named profiling-report.css */
      }
      // Stable host import path; urls match dist layout (./fonts/*.woff2).
      const css = rewriteFontUrls(
        readFileSync(resolve(__dirname, 'src/ui/fonts.css'), 'utf8'),
      );
      writeFileSync(resolve(dist, 'fonts.css'), css);
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
    copyFontArtifacts(),
  ],
  build: {
    cssCodeSplit: false,
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
