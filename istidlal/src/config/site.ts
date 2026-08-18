/**
 * الإعدادات المركزية للموقع. كل قيمة تظهر في السيو أو الترويسة أو الذيل
 * تُقرأ من هنا، فلا تتناثر النصوص في المكوّنات.
 */
export const siteConfig = {
  name: "استدلال",
  nameLatin: "Istidlal",
  /** يُقرأ من البيئة عند النشر؛ القيمة الافتراضية للتطوير المحلي. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://istidlal.ai",
  tagline: "من المقدّمة إلى النتيجة",
  description:
    "مدونة عربية متخصصة في هندسة أنظمة الذكاء الاصطناعي التطبيقية: الاسترجاع المعزّز (RAG)، الوكلاء، تقييم النماذج، اقتصاد الاستدلال، وأمن تطبيقات النماذج اللغوية — بالقياس لا بالانطباع.",
  locale: "ar",
  /** بريد حقيقي — شرط أساسي في مراجعة أدسنس. */
  email: "hello@istidlal.ai",
  editorialEmail: "editor@istidlal.ai",
  author: {
    name: "منال العرقي",
    role: "مهندسة أنظمة ذكاء اصطناعي تطبيقية",
    bio: "تعمل على نقل الأنظمة المبنيّة على النماذج اللغوية من دفتر التجارب إلى الإنتاج: الاسترجاع، التقييم، والتكلفة. تكتب في استدلال ما تختبره فعلًا، وتنشر القياس مع النتيجة.",
    url: "/about",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/istidlal",
    x: "https://x.com/istidlal_ai",
    github: "https://github.com/istidlal",
    rss: "/rss.xml",
  },
  /** معرّف الناشر في أدسنس. يُفعَّل السكربت فقط عند ضبطه في البيئة. */
  adsense: {
    client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "",
  },
  analytics: {
    ga4: process.env.NEXT_PUBLIC_GA4_ID ?? "",
  },
} as const;

/** يبني رابطًا مطلقًا — مطلوب في canonical وopen graph وخريطة الموقع. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, siteConfig.url).toString();
}
