/**
 * تصنيفات دليل الأدوات. مستقلّة عن تصنيفات المقالات لأن السؤال مختلف:
 * المقال يسأل «كيف يعمل؟»، والأداة تسأل «بم أبنيه؟».
 */
export const toolCategories = [
  { slug: "vector-stores", name: "قواعد المتّجهات", short: "تخزين المتّجهات والبحث فيها" },
  { slug: "rag-frameworks", name: "أطر الاسترجاع", short: "بناء خطوط الاسترجاع المعزّز" },
  { slug: "agent-frameworks", name: "أطر الوكلاء", short: "تنسيق الأدوات والخطوات" },
  { slug: "evaluation", name: "التقييم والرصد", short: "قياس الجودة وتتبّع الانحدار" },
  { slug: "serving", name: "التشغيل والاستدلال", short: "خدمة النماذج وضبط التكلفة" },
  { slug: "security", name: "الأمن والحواجز", short: "الحدّ من الحقن والتسريب" },
] as const;

export type ToolCategory = (typeof toolCategories)[number];

export const toolCategoryBySlug = new Map<string, ToolCategory>(
  toolCategories.map((category) => [category.slug, category]),
);

/** الترخيص وطريقة التشغيل: حقائق ثابتة نسبيًّا، بخلاف الأسعار التي تتغيّر. */
export const licenseLabels = {
  "open-source": "مفتوح المصدر",
  proprietary: "مغلق المصدر",
} as const;

export const hostingLabels = {
  "self-hosted": "استضافة ذاتية",
  managed: "خدمة مُدارة",
  both: "ذاتية أو مُدارة",
} as const;

export type ToolLicense = keyof typeof licenseLabels;
export type ToolHosting = keyof typeof hostingLabels;
