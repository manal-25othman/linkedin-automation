import { randomInt } from "node:crypto";

/**
 * حروف وأرقام بلا الملتبس منها (0/O و 1/I/L): الأكواد تُملى صوتيًا وتُكتب يدويًا
 * في نماذج الطلب، وكل حرف ملتبس يتحوّل إلى «الكود غير صحيح» عند العميل.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * يُطبِّع ما يكتبه المستخدم: أحرف كبيرة، أرقام لاتينية، بلا فواصل.
 * لا محاولة لتصحيح الحروف الملتبسة: أبجدية التوليد أصلًا خالية من
 * (O/0/I/1/L)، فلا يوجد حرف صحيح تُردّ إليه، والتخمين يُنتج كودًا لمسوّق آخر.
 */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * كود مقترح من اسم المسوّق (إن كان لاتينيًا) وإلا كود عشوائي.
 * الاسم العربي لا يصلح داخل رابط، والتحويل الصوتي يُنتج أكوادًا مربكة.
 */
export function suggestCode(name: string): string {
  const latin = name
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  return latin.length >= 3 ? `${latin}${randomCode(3)}` : randomCode(7);
}

/** رقم الطلب: ANJ-YYMM-XXXXXX — مقروء، وغير قابل للتخمين التسلسلي. */
export function generateOrderNumber(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `ANJ-${yy}${mm}-${randomCode(6)}`;
}
