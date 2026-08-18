import { randomInt } from "node:crypto";
import { CODE_ALPHABET } from "@/lib/affiliate/code-format";

/**
 * توليد الأكواد — يعتمد `node:crypto`، فلا يُستورد من الـ middleware.
 * صياغة الأكواد وتطبيعها في `code-format.ts` لأنها تعمل على الحافة أيضًا.
 */

export function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
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
