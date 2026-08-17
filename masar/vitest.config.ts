import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /*
        حزمة server-only ترمي خطأً عند استيرادها خارج شرط react-server، وهو
        سلوكها المقصود في المتصفح. في الاختبارات نستبدلها بوحدة فارغة كي
        تُختبر وحدات الخادم كما هي بلا تعديل عليها.
      */
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
