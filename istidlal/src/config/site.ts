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
  /**
   * بريد حقيقي — شرط أساسي في مراجعة أدسنس. يُضبط في البيئة عند النشر.
   * لا نضع عنوانًا وهميًّا هنا: العنوان غير المضبوط يعني أن الواجهة تعرض
   * نموذج المراسلة بدل عنوان لا يصل إليه أحد.
   */
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  editorialEmail: process.env.NEXT_PUBLIC_EDITORIAL_EMAIL ?? "",
  author: {
    name: "منال العرقي",
    role: "مهندسة أنظمة ذكاء اصطناعي تطبيقية",
    bio: "تعمل على نقل الأنظمة المبنيّة على النماذج اللغوية من دفتر التجارب إلى الإنتاج: الاسترجاع، التقييم، والتكلفة. تكتب في استدلال ما تختبره فعلًا، وتنشر القياس مع النتيجة.",
    url: "/about",
  },
  /**
   * حسابات الموقع. تُقرأ من البيئة ولا تُكتب هنا بقيم مُفترضة: رابط حساب
   * غير موجود يضرّ الثقة ويكسر `sameAs` في البيانات المهيكلة. غير المضبوط
   * لا يُعرض أصلًا.
   */
  social: {
    linkedin: process.env.NEXT_PUBLIC_LINKEDIN_URL ?? "",
    x: process.env.NEXT_PUBLIC_X_URL ?? "",
    github: process.env.NEXT_PUBLIC_GITHUB_URL ?? "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? "",
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

/** روابط الحسابات المضبوطة فعليًّا — تصلح لـ`sameAs` وللذيل. */
export function configuredProfiles(): string[] {
  return [
    siteConfig.social.linkedin,
    siteConfig.social.x,
    siteConfig.social.github,
    siteConfig.social.tiktok,
  ].filter((url): url is string => Boolean(url));
}

/** يبني رابطًا مطلقًا — مطلوب في canonical وopen graph وخريطة الموقع. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, siteConfig.url).toString();
}
