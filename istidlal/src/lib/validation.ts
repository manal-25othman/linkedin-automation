/**
 * تحقّق من المدخلات على الخادم. القاعدة: ما يصل من المتصفّح نصّ مجهول،
 * والتحقّق في الواجهة راحةٌ للمستخدم لا حاجز أمان.
 */

/** بريد صالح في حدود ما يمكن التحقّق منه دون إرسال رسالة. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL.test(value.trim());
}

export function isFilledText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

/** يقرأ حقلًا نصّيًّا بأمان مهما كان شكل الجسم الوارد. */
export function readField(body: unknown, key: string): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}
