import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1'}]
  },
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config'],
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'clover', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'dist/**', 'node_modules/**', '__tests__/**']
    }
  }
});
