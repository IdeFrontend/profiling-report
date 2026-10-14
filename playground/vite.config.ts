import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const templatePath = resolve(__dirname, '../dist/report-shell/template.html');
const publicTemplatePath = resolve(__dirname, 'public/npu-rep-html-template.txt');
const TEMPLATE_URL = '/npu-rep-html-template.txt';

/** Serve the report-shell template as text so Vite does not HTML-transform placeholders. */
function serveHtmlExportTemplate(): Plugin {
  function copyIfPresent() {
    if (!existsSync(templatePath)) return;
    mkdirSync(resolve(__dirname, 'public'), { recursive: true });
    copyFileSync(templatePath, publicTemplatePath);
  }
  const middleware = (req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (path !== TEMPLATE_URL) {
      next();
      return;
    }
    const file = existsSync(publicTemplatePath)
      ? publicTemplatePath
      : existsSync(templatePath)
        ? templatePath
        : null;
    if (!file) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('HTML export template missing. Run: npm run build:report-shell');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'serve-html-export-template',
    buildStart() {
      copyIfPresent();
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  plugins: [serveHtmlExportTemplate(), vue()],
  resolve: {
    alias: {
      '@profiling-report': resolve(__dirname, '../src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
