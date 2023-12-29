import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ... Specify options here.
    testTimeout: 6 * 60 * 60 * 1000,
    watch: true,
  },
});
