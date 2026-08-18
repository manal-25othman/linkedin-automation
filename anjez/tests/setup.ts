/** يحمّل .env حتى تجد الاختبارات التكاملية DATABASE_URL دون تصديره يدويًا. */
import { readFileSync } from "node:fs";

try {
  const content = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
} catch {
  // لا ملفّ .env — الاختبارات التكاملية ستتخطّى نفسها.
}
