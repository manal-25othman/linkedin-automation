/**
 * فحص المحتوى قبل النشر: يطبّق قواعد سياسة التحرير آليًّا.
 * يُشغَّل بـ`npm run check:content` وفي التكامل المستمر.
 */
import fs from "node:fs";
import path from "node:path";

import { parseFrontmatter } from "../src/lib/frontmatter";
import { categoryBySlug } from "../src/config/categories";
import { todayIso } from "../src/lib/publication";

const DIR = path.join(process.cwd(), "content", "articles");
const errors: string[] = [];
const warnings: string[] = [];

const files = fs.readdirSync(DIR).filter((file) => file.endsWith(".md"));
const seenTitles = new Set<string>();

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(DIR, file), "utf8"));
  const fail = (message: string) => errors.push(`${slug}: ${message}`);
  const warn = (message: string) => warnings.push(`${slug}: ${message}`);

  if (!/^[a-z0-9-]+$/.test(slug)) fail("الرابط يجب أن يكون لاتينيًّا صغيرًا بشرطات فقط");

  // حقل slug يقرأه محرّر Pages CMS ليبني منه اسم الملف؛ تباعده عن اسم الملف
  // يعني مقالًا يُنشر على رابط غير الذي يظنّه الكاتب.
  const declaredSlug = data.slug ? String(data.slug) : "";
  if (!declaredSlug) fail("ينقصه حقل slug — يحتاجه المحرّر لبناء اسم الملف");
  else if (declaredSlug !== slug) fail(`حقل slug «${declaredSlug}» لا يطابق اسم الملف «${slug}»`);

  const title = String(data.title ?? "");
  if (!title) fail("العنوان مفقود");
  if (seenTitles.has(title)) fail("عنوان مكرّر مع مقال آخر");
  seenTitles.add(title);

  const description = String(data.description ?? "");
  if (description.length < 80) fail(`الوصف قصير (${description.length} حرفًا) — المطلوب ١٢٠–١٧٠`);
  if (description.length > 200) warn(`الوصف طويل (${description.length} حرفًا) وسيُقتطع في نتائج البحث`);

  if (!categoryBySlug.has(String(data.category ?? ""))) fail("تصنيف غير معرّف");
  if (!Array.isArray(data.tags) || data.tags.length === 0) fail("لا وسوم");
  const published = String(data.published ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(published)) {
    fail("تاريخ النشر بصيغة غير صحيحة");
  } else if (published > todayIso() && String(data.status ?? "") !== "scheduled") {
    // تاريخ مستقبلي بلا إعلان جدولة: خطأ تحريري، لا خيار تصميم.
    fail(`تاريخ نشر مستقبلي (${published}) بلا \`status: scheduled\``);
  }

  const takeaways = Array.isArray(data.takeaways) ? data.takeaways : [];
  if (takeaways.length < 3) fail("المطلوب ٣ نقاط خلاصة على الأقل");

  // قواعد البنية المفروضة في سياسة التحرير.
  if (!/^##\s+المراجع\s*$/m.test(body)) fail("لا يوجد قسم مراجع");
  if (!/^##\s+الأسئلة الشائعة\s*$/m.test(body)) fail("لا يوجد قسم أسئلة شائعة");
  // العرف التحريري: قسم يبدأ بـ«متى» يحدّد حدود الحلّ — متى يصلح ومتى لا.
  // بلا `\b`: حدود الكلمات في جافاسكربت معرَّفة على المحارف اللاتينية وحدها،
  // فلا تتحقّق بعد حرف عربي.
  if (!/^##\s+متى/m.test(body)) {
    warn("لا يوجد قسم «متى…» يحدّد حدود الحلّ — سياسة التحرير تشترطه");
  }

  const links = body.match(/\]\((https?:\/\/[^)]+)\)/g) ?? [];
  if (links.length < 3) warn(`مراجع خارجية قليلة (${links.length})`);

  const words = body.trim().split(/\s+/).length;
  if (words < 450) fail(`المقال قصير (${words} كلمة) — الحدّ ٤٥٠ كلمة`);
  else if (words < 600) warn(`${words} كلمة — المستهدف ٦٠٠+ لمقال يتنافس في البحث`);
}

console.log(`فُحص ${files.length} مقالًا.`);
for (const warning of warnings) console.log(`⚠︎  ${warning}`);
for (const error of errors) console.error(`✗  ${error}`);

if (errors.length > 0) {
  console.error(`\nفشل الفحص: ${errors.length} خطأ.`);
  process.exit(1);
}
console.log("✓ اجتاز كل المقالات فحص سياسة التحرير.");
