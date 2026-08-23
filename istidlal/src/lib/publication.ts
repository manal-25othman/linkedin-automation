/**
 * حالة النشر. القاعدة واحدة ولا استثناء لها: لا يرى القارئ تاريخًا مستقبليًّا.
 *
 * المقال المؤرَّخ بعد اليوم «مجدوَل»، والمقال المعلَّم `status: draft` «مسوّدة».
 * كلاهما يُستبعد من كل واجهة عامّة: القوائم، خريطة الموقع، التغذية، البحث،
 * والمقالات ذات الصلة — ولا تُولَّد له صفحة أصلًا.
 *
 * ملاحظة تشغيلية: الموقع يُولَّد ساكنًا، فـ«اليوم» هو يوم البناء. المقال
 * المجدوَل يظهر عند أول إعادة بناء بعد تاريخه (خطّاف نشر يومي في Vercel).
 */
export type PublicationStatus = "published" | "scheduled" | "draft";

/** تاريخ اليوم بصيغة ISO القصيرة (UTC) — نفس صيغة الواجهة الأمامية للمقالات. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value);
}

/**
 * يحسم حالة المقال من تاريخه ومن حقل `status` الاختياري.
 * أي تاريخ غير صالح يُعامل مسوّدة — الأسلم ألّا يُنشر ما لا نفهم تاريخه.
 */
export function resolveStatus(
  published: string,
  declared?: string,
  today: string = todayIso(),
): PublicationStatus {
  if (declared === "draft") return "draft";
  if (!isIsoDate(published)) return "draft";
  return published > today ? "scheduled" : "published";
}

export function isPubliclyVisible(status: PublicationStatus): boolean {
  return status === "published";
}
