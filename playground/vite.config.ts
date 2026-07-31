import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Serve repo fixtures at `/data/*` for playground + e2e. */
function serveRepoData(): Plugin {
  const files: Record<string, { path: string; type: string }> = {
    '/data/out.rep': {
      path: resolve(__dirname, '../data/out.rep'),
      type: 'application/octet-stream',
    },
    '/data/out.trace.json': {
      path: resolve(__dirname, '../tests/fixtures/out.trace.json'),
      type: 'application/json',
    },
  };
  return {
    name: 'serve-repo-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = req.url?.split('?')[0] ?? '';
        const hit = files[key];
        if (hit) {
          const body = readFileSync(hit.path);
          res.setHeader('Content-Type', hit.type);
          res.end(body);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue(), serveRepoData()],
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
});
