/**
 * فحص ما قبل الإطلاق: يكشف القيم النائبة والإعدادات الناقصة التي تعمل
 * محليًّا وتفشل — أو تُحرج — على نطاق حقيقي. يُشغَّل بـ`npm run prelaunch`.
 */
import fs from "node:fs";
import path from "node:path";

type Level = "blocker" | "warn" | "ok";
const results: { level: Level; label: string; detail: string }[] = [];

const add = (level: Level, label: string, detail: string) =>
  results.push({ level, label, detail });

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

// ─── النطاق والهوية ──────────────────────────────────────────────
const siteConfig = read("src/config/site.ts");
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

if (!siteUrl) {
  add(
    "blocker",
    "رابط الموقع",
    "NEXT_PUBLIC_SITE_URL غير مضبوط. بدونه تُبنى الروابط الأساسية وخريطة الموقع وصور المشاركة على النطاق الافتراضي في الشيفرة.",
  );
} else if (siteUrl.includes("localhost")) {
  add("blocker", "رابط الموقع", `القيمة «${siteUrl}» محلية ولا تصلح للنشر.`);
} else {
  add("ok", "رابط الموقع", siteUrl);
}

const emails = [...siteConfig.matchAll(/"([\w.+-]+@[\w.-]+)"/g)].map((m) => m[1]);
const unverifiedEmails = emails.filter((email) => email.endsWith("@istidlal.ai"));
if (unverifiedEmails.length) {
  add(
    "blocker",
    "بريد التواصل",
    `${unverifiedEmails.join("، ")} — بريد حقيقي يعمل شرطٌ في مراجعة أدسنس. غيّره في src/config/site.ts أو فعّل النطاق.`,
  );
} else {
  add("ok", "بريد التواصل", emails.join("، ") || "لا بريد معرَّف");
}

// ─── التحليلات والإعلانات ────────────────────────────────────────
add(
  process.env.NEXT_PUBLIC_GA4_ID ? "ok" : "warn",
  "قياس الزيارات",
  process.env.NEXT_PUBLIC_GA4_ID
    ? "GA4 مضبوط ويُحمَّل بعد الموافقة."
    : "NEXT_PUBLIC_GA4_ID غير مضبوط — الموقع سينشر بلا قياس. اضبطه قبل الإطلاق لتبدأ البيانات من اليوم الأول.",
);

add(
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? "ok" : "ok",
  "أدسنس",
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT
    ? "مضبوط — تأكّد أن القبول تمّ فعلًا قبل تفعيله."
    : "غير مضبوط، وهذا الصحيح قبل القبول: المساحات تبقى صامتة محجوزة الأبعاد.",
);

// ─── النشرة البريدية ─────────────────────────────────────────────
add(
  process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT ? "ok" : "warn",
  "النشرة البريدية",
  process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT
    ? "موصولة بمزوّد."
    : "غير موصولة: النموذج يفتح رسالة بريد بدل حفظ المشترك. أخفِ النموذج أو اربطه بمزوّد قبل الإطلاق.",
);

// ─── المحرّر ─────────────────────────────────────────────────────
const hasOauth = Boolean(process.env.GITHUB_OAUTH_ID && process.env.GITHUB_OAUTH_SECRET);
add(
  hasOauth ? "ok" : "warn",
  "المحرّر المدمج",
  hasOauth
    ? "الدخول بضغطة واحدة مفعّل."
    : "مفتاحا OAuth غير مضبوطين — يبقى التحرير عبر Pages CMS أو رمز شخصي. راجع docs/EDITOR.md.",
);

// ─── المحتوى ─────────────────────────────────────────────────────
const articles = fs
  .readdirSync(path.join(process.cwd(), "content", "articles"))
  .filter((file) => file.endsWith(".md"));

if (articles.length >= 25) {
  add("ok", "حجم المحتوى", `${articles.length} مقالًا — يكفي للتقديم لأدسنس.`);
} else {
  add(
    "warn",
    "حجم المحتوى",
    `${articles.length} مقالًا. أدسنس يتوقّع ٢٥–٣٠ مقالًا وحركة مستقرّة؛ انشر أولًا ثم قدّم.`,
  );
}

const pages = fs.readdirSync(path.join(process.cwd(), "content", "pages"));
const required = [
  "about.md",
  "contact.md",
  "privacy-policy.md",
  "cookie-policy.md",
  "terms.md",
  "disclaimer.md",
  "editorial-policy.md",
  "advertising-policy.md",
];
const missing = required.filter((file) => !pages.includes(file));
add(
  missing.length ? "blocker" : "ok",
  "الصفحات الإلزامية",
  missing.length ? `ناقص: ${missing.join("، ")}` : `الثماني كلها موجودة.`,
);

// ─── التقرير ─────────────────────────────────────────────────────
const icon = { blocker: "✗", warn: "⚠︎", ok: "✓" } as const;
const order: Level[] = ["blocker", "warn", "ok"];

console.log("\nفحص ما قبل الإطلاق — استدلال\n" + "─".repeat(48));
for (const level of order) {
  for (const item of results.filter((r) => r.level === level)) {
    console.log(`${icon[level]}  ${item.label}: ${item.detail}`);
  }
}

const blockers = results.filter((r) => r.level === "blocker").length;
const warnings = results.filter((r) => r.level === "warn").length;
console.log("─".repeat(48));
console.log(`${blockers} مانع · ${warnings} تنبيه · ${results.length - blockers - warnings} سليم\n`);

// لا نُفشل الأمر: هذا تقرير قرارٍ لا بوابة بناء.
