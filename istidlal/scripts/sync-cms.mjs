/**
 * ينسخ حزمة المحرّر من node_modules إلى public/admin.
 * السبب: استضافة المحرّر مع الموقع بدل تحميله من CDN خارجي — فلا يتوقّف
 * التحرير على توفّر طرف ثالث، ولا يُحمّل الموقعُ زائرَه سكربتًا خارجيًّا.
 * يعمل تلقائيًّا قبل `dev` و`build`.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const source = path.join(process.cwd(), "node_modules", "@sveltia", "cms", "dist", "sveltia-cms.js");
const targetDir = path.join(process.cwd(), "public", "admin");
const target = path.join(targetDir, "sveltia-cms.js");

try {
  await stat(source);
} catch {
  console.warn("⚠︎ حزمة المحرّر غير مثبّتة — شغّل npm install. سيبقى /admin بلا محرّر.");
  process.exit(0);
}

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
const { size } = await stat(target);
console.log(`✓ نُسخت حزمة المحرّر إلى public/admin (${Math.round(size / 1024)}KB).`);
