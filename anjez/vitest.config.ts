import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // وحدات الخادم تستورد "server-only"، وهو يرمي خارج بيئة Next.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    // الاختبارات التكاملية تشترك في قاعدة بيانات واحدة؛ التوازي يجعلها تتصادم.
    fileParallelism: false,
    setupFiles: ["tests/setup.ts"],
  },
});
