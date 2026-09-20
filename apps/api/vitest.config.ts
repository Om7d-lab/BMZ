import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
  plugins: [
    // NestJS relies on emitted decorator metadata, which esbuild does not
    // produce. swc compiles the test files with it intact.
    swc.vite({ module: { type: 'es6' } }),
  ],
});
