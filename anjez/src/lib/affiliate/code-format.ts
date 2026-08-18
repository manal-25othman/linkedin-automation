/**
 * صياغة أكواد الإحالة وكوكيها — بلا أي اعتماد على وحدات Node.
 *
 * الفصل مقصود: الـ middleware يعمل على وقت تشغيل الحافة (Edge) الذي لا يوفّر
 * `node:crypto`، فلو بقيت هذه الثوابت في الملفّ الذي يولّد الأكواد لسحب
 * الـ middleware معه وحدةً لا تعمل هناك، وفشل البناء.
 */

export const REF_COOKIE = "anjez_ref";
export const REF_QUERY_PARAM = "ref";

/** الحروف المستعملة في التوليد — بلا الملتبس منها (O/0 و I/1/L). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * يُطبِّع ما يكتبه المستخدم: أحرف كبيرة، أرقام لاتينية، بلا فواصل.
 * لا محاولة لتصحيح الحروف الملتبسة: أبجدية التوليد أصلًا خالية منها،
 * فلا يوجد حرف صحيح تُردّ إليه، والتخمين يُنتج كودًا لمسوّق آخر.
 */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * قيمة كوكي الإحالة: «الكود:وقت النقر». غير موقّعة عمدًا — أسوأ ما يفعله من
 * يزوّرها أن ينسب البيع لكود مسوّق موجود، وهو ما يستطيعه أصلًا بفتح رابط الإحالة.
 */
export function encodeRefValue(code: string, clickedAt: Date = new Date()): string {
  return `${code}:${clickedAt.getTime()}`;
}

export function decodeRefValue(
  value: string | undefined | null,
): { code: string; clickedAt: Date } | null {
  if (!value) return null;
  const [rawCode, rawTime] = value.split(":");
  const code = normalizeCode(rawCode ?? "");
  const time = Number(rawTime);
  if (!code || !Number.isFinite(time)) return null;
  return { code, clickedAt: new Date(time) };
}
