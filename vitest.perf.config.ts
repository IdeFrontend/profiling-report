import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

process.env.NODE_ENV = 'test';

/** Isolated config so factory perf bench is not in the default green suite. */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@profiling-report': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/perf/**/*.spec.ts'],
    globals: false,
  },
});
