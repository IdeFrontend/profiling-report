import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

// Vue's production build strips the devtools hook that @vue/test-utils records emits
// through, so a shell exporting NODE_ENV=production turns every `emitted()` assertion
// into `undefined`. Vite reads NODE_ENV while resolving this config — before `test.env`
// would apply — so pin it here, at the top, rather than trusting the caller's shell.
process.env.NODE_ENV = 'test';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@profiling-report': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'tests/unit/**/*.spec.ts', 'tests/component/**/*.spec.ts'],
    globals: false,
  },
});
