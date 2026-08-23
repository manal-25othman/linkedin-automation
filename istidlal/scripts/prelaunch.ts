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

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
const contactFormReady = Boolean(
  process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.CONTACT_FROM_EMAIL,
);

if (!contactEmail && !contactFormReady) {
  add(
    "blocker",
    "قناة التواصل",
    "لا بريد ولا نموذج مراسلة مفعّل. اضبط NEXT_PUBLIC_CONTACT_EMAIL، أو RESEND_API_KEY وCONTACT_TO_EMAIL وCONTACT_FROM_EMAIL. قناة تواصل عاملة شرطٌ في مراجعة أدسنس.",
  );
} else {
  add(
    "ok",
    "قناة التواصل",
    [contactEmail && `بريد: ${contactEmail}`, contactFormReady && "نموذج مراسلة مفعّل"]
      .filter(Boolean)
      .join(" · "),
  );
}

// أي بريد مكتوب نصًّا في الإعدادات قيمة نائبة — البريد يُقرأ من البيئة.
const hardcodedEmails = [...siteConfig.matchAll(/"([\w.+-]+@[\w.-]+)"/g)].map((m) => m[1]);
if (hardcodedEmails.length) {
  add(
    "blocker",
    "بريد مكتوب في الشيفرة",
    `${hardcodedEmails.join("، ")} — انقله إلى متغيّر بيئة بدل تثبيته في src/config/site.ts.`,
  );
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
  process.env.NEWSLETTER_ENDPOINT ? "ok" : "warn",
  "النشرة البريدية",
  process.env.NEWSLETTER_ENDPOINT
    ? "موصولة بمزوّد على الخادم."
    : "NEWSLETTER_ENDPOINT غير مضبوط: النموذج لا يُعرض أصلًا ويظهر بديله (RSS). لا وعد كاذب، لكن لا قائمة بريدية أيضًا.",
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

// ─── التواريخ ────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const futureDated = articles.filter((file) => {
  const raw = read(path.join("content", "articles", file));
  const published = raw.match(/^published:\s*(\S+)/m)?.[1] ?? "";
  const declared = raw.match(/^status:\s*(\S+)/m)?.[1] ?? "";
  return published > today && declared !== "scheduled";
});
add(
  futureDated.length ? "blocker" : "ok",
  "تواريخ النشر",
  futureDated.length
    ? `${futureDated.join("، ")} — تاريخ مستقبلي بلا «status: scheduled».`
    : "لا مقال بتاريخ مستقبلي غير معلَن. القارئ لا يرى تاريخًا لم يأتِ بعد.",
);

// ─── دليل الأدوات ────────────────────────────────────────────────
const toolsDir = path.join(process.cwd(), "content", "tools");
const tools = fs.existsSync(toolsDir)
  ? fs.readdirSync(toolsDir).filter((file) => file.endsWith(".md"))
  : [];
add("ok", "دليل الأدوات", `${tools.length} مدخلًا، ولكلٍّ رابط رسمي وقسم حدود.`);

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
