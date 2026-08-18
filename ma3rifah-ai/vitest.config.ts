import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // اختبارات العزل تتصل بقاعدة بيانات حقيقية وقد تحتاج وقتًا أطول
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' حارس وقت البناء ولا معنى له في بيئة الاختبار
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
