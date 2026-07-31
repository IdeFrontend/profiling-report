import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Serve repo `data/out.rep` at `/data/out.rep` for playground + e2e. */
function serveRepoData(): Plugin {
  const outRep = resolve(__dirname, '../data/out.rep');
  return {
    name: 'serve-repo-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/data/out.rep') {
          const body = readFileSync(outRep);
          res.setHeader('Content-Type', 'application/octet-stream');
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
